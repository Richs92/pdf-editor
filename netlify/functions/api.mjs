import {randomBytes,createHash,timingSafeEqual} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import {MODULES,PAGES,allowedModules,canAccess,contentModule} from '../lib/access.mjs';
const COOKIE_ACCESS='document_access',COOKIE_REFRESH='document_refresh';
class HTTPError extends Error{constructor(status,message,code){super(message);this.status=status;this.code=code;}}
function settings(){
 const url=process.env.SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!url||!key)throw new HTTPError(503,'El administrador aún no ha activado el acceso al sistema.','SETUP_REQUIRED');
 const parsed=new URL(url);if(parsed.protocol!=='https:'&&!['localhost','127.0.0.1'].includes(parsed.hostname))throw new HTTPError(503,'Configuración del servicio no válida.','SETUP_REQUIRED');
 return{url:url.replace(/\/$/,''),key};
}
async function supabase(path,{method='GET',body,token,headers={}}={}){
 const config=settings();let response;
 try{response=await fetch(config.url+path,{method,headers:{apikey:config.key,Authorization:'Bearer '+(token||config.key),'Content-Type':'application/json',...headers},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(15000)});}catch{throw new HTTPError(503,'No se pudo conectar al servicio. Intenta de nuevo.');}
 const text=await response.text();let result;try{result=text?JSON.parse(text):null;}catch{result=null;}
 if(!response.ok){if(/invalid api key/i.test(result?.message||''))throw new HTTPError(503,'El servicio de acceso necesita revisión del administrador.');const error=new HTTPError(response.status>=500?503:response.status,'No se pudo completar la operación.');error.upstream=result;throw error;}
 return result;
}
const rpc=(name,body)=>supabase('/rest/v1/rpc/'+name,{method:'POST',body});
function cookies(event){return Object.fromEntries((event.headers?.cookie||'').split(';').filter(part=>part.includes('=')).map(part=>{const i=part.indexOf('=');return[part.slice(0,i).trim(),part.slice(i+1).trim()];}));}
function setSession(context,session){
 context.cookies=[`${COOKIE_ACCESS}=${session.access_token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${Math.min(Number(session.expires_in)||3600,3600)}`,`${COOKIE_REFRESH}=${session.refresh_token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=604800`];
}
function clearSession(context){context.cookies=[COOKIE_ACCESS,COOKIE_REFRESH].map(name=>`${name}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`);}
function json(context,status,data){return{statusCode:status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'},...(context.cookies.length?{multiValueHeaders:{'Set-Cookie':context.cookies}}:{}),body:JSON.stringify(data)};}
async function authenticate(event,context){
 const jar=cookies(event);let token=jar[COOKIE_ACCESS],auth;
 if(token)try{auth=await supabase('/auth/v1/user',{token});}catch(error){if(![401,403].includes(error.status))throw error;}
 if(!auth&&jar[COOKIE_REFRESH]){
  try{const session=await supabase('/auth/v1/token?grant_type=refresh_token',{method:'POST',body:{refresh_token:jar[COOKIE_REFRESH]}});setSession(context,session);token=session.access_token;auth=session.user;}catch(error){if(![400,401,403].includes(error.status))throw error;}
 }
 if(!auth){clearSession(context);throw new HTTPError(401,'Inicia sesión para continuar.','LOGIN_REQUIRED');}
 const profiles=await supabase('/rest/v1/app_users?id=eq.'+encodeURIComponent(auth.id)+'&select=*');const user=profiles?.[0];
 if(!user||!user.active){clearSession(context);throw new HTTPError(403,'Tu cuenta no tiene acceso activo. Contacta al administrador.','ACCOUNT_DISABLED');}
 const permissions=await supabase('/rest/v1/app_permissions?user_id=eq.'+encodeURIComponent(user.id)+'&select=module');
 context.token=token;context.user=publicUser(user);context.modules=allowedModules(user,(permissions||[]).map(p=>p.module));return user;
}
function requireReady(context){if(context.user.must_change_password)throw new HTTPError(403,'Cambia tu contraseña temporal para continuar.','PASSWORD_CHANGE_REQUIRED');}
function requireAdmin(context){requireReady(context);if(context.user.role!=='admin')throw new HTTPError(403,'Solo el administrador puede realizar esta acción.');}
function requireModule(context,module){requireReady(context);if(!canAccess(context.user,context.modules,module))throw new HTTPError(403,'No tienes permiso para entrar a esta sección.','MODULE_DENIED');}
function bodyJSON(event){
 if(Buffer.byteLength(event.body||'')>16384)throw new HTTPError(413,'Solicitud demasiado grande.');
 if(!(event.headers?.['content-type']||'').startsWith('application/json'))throw new HTTPError(415,'Formato de solicitud no válido.');
 try{const body=JSON.parse(event.body||'{}');if(!body||typeof body!=='object'||Array.isArray(body))throw Error();return body;}catch{throw new HTTPError(400,'Datos no válidos.');}
}
function sameOrigin(event){
 const origin=event.headers?.origin,host=event.headers?.host;
 try{if(!origin||new URL(origin).host!==host)throw Error();}catch{throw new HTTPError(403,'Origen de solicitud no permitido.');}
}
function text(value,label,max=120){if(typeof value!=='string'||!value.trim()||value.trim().length>max||/[\x00-\x1f]/.test(value))throw new HTTPError(400,'Revisa '+label+'.');return value.trim();}
function passwordText(value,label,min=1){if(typeof value!=='string'||!value.trim()||value.length<min||value.length>128||/[\x00-\x1f]/.test(value))throw new HTTPError(400,'Revisa '+label+'.');return value;}
function email(value){const result=text(value,'el correo',254).toLowerCase();if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(result))throw new HTTPError(400,'Escribe un correo válido.');return result;}
const USER_DOMAIN='users.terminavit.invalid';
function username(value){const name=text(value,'el usuario',32).toLowerCase();if(!/^[a-z][a-z0-9._-]{2,31}$/.test(name)||name==='admin')throw new HTTPError(400,'Usa de 3 a 32 letras, números, puntos, guiones o guiones bajos. El usuario admin está reservado.');return name;}
function publicUser(user){return {...user,username:user.role==='admin'?'admin':user.email?.replace('@'+USER_DOMAIN,'')};}
async function loginAddress(value){const name=text(value,'el usuario',254).toLowerCase();if(name.includes('@'))return email(name);if(name==='admin'){const admins=await supabase('/rest/v1/app_users?role=eq.admin&select=*&limit=2');if(admins?.length!==1||!admins[0].active)throw new HTTPError(401,'Usuario o contraseña incorrectos.');return admins[0].email;}return username(name)+'@'+USER_DOMAIN;}
async function initializeAdmin(address,password){
 const initial=process.env.ADMIN_INITIAL_PASSWORD;if(!initial||initial.length<12||!timingSafeEqual(createHash('sha256').update(initial).digest(),createHash('sha256').update(password).digest()))return false;
 const admins=await supabase('/rest/v1/app_users?role=eq.admin&select=*&limit=2');if(admins?.length!==1||!admins[0].active||admins[0].email!==address)return false;
 const auth=await supabase('/auth/v1/admin/users/'+admins[0].id);if(auth.app_metadata?.terminavit_password_initialized)return false;
 await supabase('/auth/v1/admin/users/'+admins[0].id,{method:'PUT',body:{password,app_metadata:{...auth.app_metadata,terminavit_password_initialized:true}}});return true;
}
function uuid(value){if(typeof value!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value))throw new HTTPError(400,'Identificador de usuario no válido.');return value;}
function modules(value){if(!Array.isArray(value)||value.some(m=>!MODULES.includes(m)))throw new HTTPError(400,'Selecciona permisos válidos.');return[...new Set(value)];}
const generatedPassword=()=>'Aa7!'+randomBytes(18).toString('base64url');
async function audit(context,action,module=null,target=null,details={},source='server',actorEmail=null){await rpc('app_write_audit',{p_actor:context.user?.id||null,p_action:action,p_module:module,p_target:target,p_source:source,p_details:details,p_email:actorEmail});}
async function login(event,context){
 const body=bodyJSON(event),address=await loginAddress(body.username??body.email);const password=passwordText(body.password,'la contraseña');let session;
 try{session=await supabase('/auth/v1/token?grant_type=password',{method:'POST',body:{email:address,password}});}catch(error){
  if([400,401,403].includes(error.status)&&await initializeAdmin(address,password)){session=await supabase('/auth/v1/token?grant_type=password',{method:'POST',body:{email:address,password}});}else if([400,401,403,429].includes(error.status)){await audit(context,'login_failed',null,null,{},'server',address);throw new HTTPError(error.status===429?429:401,error.status===429?'Demasiados intentos. Espera un minuto.':'Usuario o contraseña incorrectos.');}else throw error;
 }
 const profiles=await supabase('/rest/v1/app_users?id=eq.'+encodeURIComponent(session.user.id)+'&select=*');const user=profiles?.[0];
 if(!user?.active){context.user=user||null;await audit(context,'login_denied',null,null,{},'server',address);await supabase('/auth/v1/logout?scope=local',{method:'POST',token:session.access_token}).catch(()=>{});throw new HTTPError(403,'Tu cuenta no tiene acceso activo. Contacta al administrador.');}
 if(user.must_change_password){await supabase('/rest/v1/app_users?id=eq.'+user.id,{method:'PATCH',body:{must_change_password:false}});user.must_change_password=false;}
 context.user=user;await audit(context,'login');setSession(context,session);return json(context,200,{mustChangePassword:user.must_change_password});
}
async function targetUser(id){const list=await supabase('/rest/v1/app_users?id=eq.'+uuid(id)+'&select=*');if(!list?.[0]||list[0].role!=='user')throw new HTTPError(400,'Solo se pueden administrar usuarios normales.');return list[0];}
async function content(event,context){
 const path=event.queryStringParameters?.path||'';const module=contentModule(path);if(!module)throw new HTTPError(404,'Archivo no disponible.');
 try{await authenticate(event,context);requireModule(context,module);}catch(error){
  if(path.endsWith('.html')&&[401,403].includes(error.status)){
   if(error.code==='LOGIN_REQUIRED'||error.code==='PASSWORD_CHANGE_REQUIRED')return{statusCode:302,headers:{Location:error.code==='PASSWORD_CHANGE_REQUIRED'?'/account.html':'/login.html?next='+encodeURIComponent('/'+PAGES[module]),'Cache-Control':'no-store'},...(context.cookies.length?{multiValueHeaders:{'Set-Cookie':context.cookies}}:{}),body:''};
   return{statusCode:403,headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'},...(context.cookies.length?{multiValueHeaders:{'Set-Cookie':context.cookies}}:{}),body:'<!doctype html><html lang="es"><meta name="viewport" content="width=device-width"><title>Acceso restringido</title><body style="font:18px system-ui;padding:40px"><h1>Acceso restringido</h1><p>No tienes permiso para entrar a esta sección.</p><a href="/">Volver al Home</a></body></html>'};
  }throw error;
 }
 const root=resolve(process.env.APP_PRIVATE_ASSETS_DIR||'netlify/private-assets');const file=resolve(root,path);if(!file.startsWith(root+'/'))throw new HTTPError(404,'Archivo no disponible.');
 let bytes;try{bytes=await readFile(file);}catch{throw new HTTPError(404,'Archivo no disponible.');}
 if(path.endsWith('.html'))await audit(context,'module_opened',module);
 const mime={'.html':'text/html; charset=utf-8','.json':'application/json','.pdf':'application/pdf','.docx':'application/vnd.openxmlformats-officedocument.wordprocessingml.document','.js':'text/javascript'}[extname(path)]||'application/octet-stream';
 return{statusCode:200,headers:{'Content-Type':mime,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'},...(context.cookies.length?{multiValueHeaders:{'Set-Cookie':context.cookies}}:{}),isBase64Encoded:true,body:bytes.toString('base64')};
}
export async function handler(event){
 const context={cookies:[],user:null,modules:[]};
 try{
  const path=(event.path||'').replace(/^\/\.netlify\/functions\/api/,'')||'/';const method=event.httpMethod;
  if(method==='OPTIONS')return json(context,405,{error:'Método no permitido.'});
  settings();
  if(!['GET','POST','PATCH'].includes(method))throw new HTTPError(405,'Método no permitido.');
  if(method!=='GET')sameOrigin(event);
  if(method==='GET'&&(path==='/content'||contentModule((event.path||'').replace(/^\//,'')))){
   const original=(event.path||'').replace(/^\//,'');const requested=contentModule(original)?original:event.queryStringParameters?.path;
   return await content({...event,queryStringParameters:{...event.queryStringParameters,path:requested}},context);
  }
  if(path==='/auth/login'&&method==='POST')return await login(event,context);
  if(path==='/auth/recover'&&method==='POST'){
   const data=bodyJSON(event),password=passwordText(data.password,'la nueva contraseña');if(password.length<12)throw new HTTPError(400,'La contraseña debe tener al menos 12 caracteres.');
   let token,verified;
   if(typeof data.tokenHash==='string'&&/^[a-zA-Z0-9_-]{20,256}$/.test(data.tokenHash)){
    try{verified=await supabase('/auth/v1/verify',{method:'POST',body:{token_hash:data.tokenHash,type:'recovery'}});token=verified.access_token;}catch(error){if([400,401,403,422].includes(error.status))throw new HTTPError(400,'El enlace ya fue utilizado o venció. Solicita un correo nuevo.','RECOVERY_EXPIRED');throw error;}
   }else if(typeof data.accessToken==='string'&&data.accessToken.length<=8192&&/^[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+$/.test(data.accessToken))token=data.accessToken;
   else throw new HTTPError(400,'Abre el enlace del correo de recuperación.','RECOVERY_REQUIRED');
   let auth;try{auth=await supabase('/auth/v1/user',{token});}catch(error){if([401,403].includes(error.status))throw new HTTPError(400,'El enlace ya fue utilizado o venció. Solicita un correo nuevo.','RECOVERY_EXPIRED');throw error;}
   const profiles=await supabase('/rest/v1/app_users?id=eq.'+encodeURIComponent(auth.id)+'&select=*');const user=profiles?.[0];
   if(!user?.active)throw new HTTPError(403,'Esta cuenta no tiene acceso activo. Contacta al administrador.');
   context.user=user;await supabase('/auth/v1/user',{method:'PUT',token,body:{password}});await rpc('app_password_changed',{p_actor:user.id});await audit(context,'password_recovered');
   await supabase('/auth/v1/logout?scope=local',{method:'POST',token}).catch(()=>{});clearSession(context);return json(context,200,{ok:true});
  }
  await authenticate(event,context);
  if(path==='/me'&&method==='GET')return json(context,200,{user:context.user,modules:context.modules});
  if(path==='/auth/logout'&&method==='POST'){await audit(context,'logout');await supabase('/auth/v1/logout?scope=local',{method:'POST',token:context.token});clearSession(context);return json(context,200,{ok:true});}
  if(path==='/auth/password'&&method==='POST'){
   const data=bodyJSON(event);const password=passwordText(data.password,'la nueva contraseña');if(password.length<12)throw new HTTPError(400,'La contraseña debe tener al menos 12 caracteres.');
   const current=passwordText(data.currentPassword,'la contraseña actual');if(password===current)throw new HTTPError(400,'La nueva contraseña debe ser diferente.');
   let verified;try{verified=await supabase('/auth/v1/token?grant_type=password',{method:'POST',body:{email:context.user.email,password:current}});}catch{throw new HTTPError(400,'La contraseña actual no es correcta.');}
   await supabase('/auth/v1/user',{method:'PUT',token:verified.access_token,body:{password}});await rpc('app_password_changed',{p_actor:context.user.id});setSession(context,verified);return json(context,200,{ok:true});
  }
  requireReady(context);
  if(path==='/audit'&&method==='POST'){
   const data=bodyJSON(event);requireModule(context,data.module);
   if(!['document_generated','document_downloaded'].includes(data.action))throw new HTTPError(400,'Evento no válido.');
   const details={};if(data.documentId){if(!/^[a-z-]{1,60}$/.test(data.documentId))throw new HTTPError(400,'Documento no válido.');details.documentId=data.documentId;}
   if(data.format){if(!['pdf','docx','google-docs'].includes(data.format))throw new HTTPError(400,'Formato no válido.');details.format=data.format;}
   await audit(context,data.action,data.module,null,details,'browser');return json(context,200,{ok:true});
  }
  requireAdmin(context);
  if(path==='/admin/users'&&method==='GET'){
   const users=await supabase('/rest/v1/app_users?select=id,email,display_name,role,active,must_change_password,created_at,app_permissions(module)&order=created_at.desc&limit=500');
   return json(context,200,{users:(users||[]).map(({app_permissions:permissions,...user})=>({...publicUser(user),modules:allowedModules(user,(permissions||[]).map(p=>p.module))}))});
  }
  if(path==='/admin/users'&&method==='POST'){
   const data=bodyJSON(event),address=data.username!==undefined?username(data.username)+'@'+USER_DOMAIN:email(data.email),name=text(data.displayName,'el nombre'),perms=modules(data.modules),password=generatedPassword();let auth;
   try{auth=await supabase('/auth/v1/admin/users',{method:'POST',body:{email:address,password,email_confirm:true}});}catch(error){if(error.upstream?.code==='email_exists'||error.status===422)throw new HTTPError(409,'Ya existe ese nombre de usuario.');throw error;}
   const id=auth.id||auth.user?.id;if(!id)throw new HTTPError(503,'No se pudo crear el usuario.');
   try{await rpc('app_provision_user',{p_actor:context.user.id,p_id:id,p_email:address,p_name:name,p_modules:perms});}catch(error){await supabase('/auth/v1/admin/users/'+id,{method:'DELETE'}).catch(()=>{});throw error;}
   return json(context,201,{id,email:address,username:address.replace('@'+USER_DOMAIN,''),temporaryPassword:password});
  }
  const update=path.match(/^\/admin\/users\/([0-9a-f-]+)$/i);
  if(update&&method==='PATCH'){
   const data=bodyJSON(event);await targetUser(update[1]);const name=text(data.displayName,'el nombre'),perms=modules(data.modules);if(typeof data.active!=='boolean')throw new HTTPError(400,'Estado no válido.');
   await rpc('app_update_user',{p_actor:context.user.id,p_id:update[1],p_name:name,p_active:data.active,p_modules:perms});return json(context,200,{ok:true});
  }
  const reset=path.match(/^\/admin\/users\/([0-9a-f-]+)\/reset-password$/i);
  if(reset&&method==='POST'){
   await targetUser(reset[1]);const password=generatedPassword();await supabase('/auth/v1/admin/users/'+reset[1],{method:'PUT',body:{password}});await rpc('app_password_reset',{p_actor:context.user.id,p_id:reset[1]});return json(context,200,{temporaryPassword:password});
  }
  if(path==='/admin/logs'&&method==='GET'){
   const data=event.queryStringParameters||{},offset=Number(data.offset||0);if(!Number.isInteger(offset)||offset<0||offset>1000000)throw new HTTPError(400,'Página no válida.');
   const query=new URLSearchParams({select:'*',order:'occurred_at.desc,id.desc',limit:'51',offset:String(offset)});
   if(data.module){if(!MODULES.includes(data.module))throw new HTTPError(400,'Sección no válida.');query.set('module','eq.'+data.module);}
   if(data.actor)query.set('actor_id','eq.'+uuid(data.actor));
   const records=await supabase('/rest/v1/app_audit?'+query.toString());return json(context,200,{items:(records||[]).slice(0,50),hasMore:records?.length>50});
  }
  throw new HTTPError(404,'Recurso no disponible.');
 }catch(error){return json(context,error.status||500,{error:error.status?error.message:'No se pudo completar la operación. Intenta de nuevo.',...(error.code?{code:error.code}:{})});}
}
