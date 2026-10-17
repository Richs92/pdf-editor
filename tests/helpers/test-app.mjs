// Local-only Supabase substitute for authorization tests. Never built or deployed.
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import {randomUUID} from 'node:crypto';
import {handler} from '../../netlify/functions/api.mjs';
import {contentModule} from '../../netlify/lib/access.mjs';
export const ADMIN_ID='00000000-0000-4000-8000-000000000001',USER_ID='00000000-0000-4000-8000-000000000002';
export const ADMIN_PASSWORD='Admin-test-password-123!',USER_PASSWORD='Staff-test-password-123!';
async function listen(server){await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));return 'http://127.0.0.1:'+server.address().port;}
async function incoming(request){const chunks=[];for await(const part of request)chunks.push(part);return Buffer.concat(chunks).toString();}
export async function startTestApp(){
 const state={users:[{id:ADMIN_ID,email:'admin@example.test',display_name:'Administrador de prueba',role:'admin',active:true,must_change_password:false,created_at:'2026-01-01T00:00:00Z'},{id:USER_ID,email:'staff@example.test',display_name:'Usuario de prueba',role:'user',active:true,must_change_password:false,created_at:'2026-01-02T00:00:00Z'}],auth:[{id:ADMIN_ID,email:'admin@example.test',password:ADMIN_PASSWORD},{id:USER_ID,email:'staff@example.test',password:USER_PASSWORD}],permissions:[{user_id:USER_ID,module:'cfe'},{user_id:USER_ID,module:'water'}],logs:[],tokens:new Map(),refresh:new Map(),recovery:new Map(),calls:[],failures:[]};
 function session(user){const access_token='test-access-'+randomUUID(),refresh_token='test-refresh-'+randomUUID();state.tokens.set(access_token,user.id);state.refresh.set(refresh_token,user.id);return {access_token,refresh_token,expires_in:3600,user:{id:user.id,email:user.email}};}
 function actor(data){const user=state.users.find(u=>u.id===data.p_actor);if(!user||!user.active||user.must_change_password||user.role!=='admin')throw Error('Admin required');return user;}
 function log(data){const user=state.users.find(u=>u.id===data.p_actor);state.logs.push({id:state.logs.length+1,occurred_at:new Date().toISOString(),actor_id:data.p_actor||null,actor_email:user?.email||data.p_email||null,action:data.p_action,module:data.p_module||null,target_id:data.p_target||null,source:data.p_source||'server',details:data.p_details||{}});}
 const supabase=createServer(async(request,response)=>{
  const url=new URL(request.url,'http://local'),raw=await incoming(request);let body;try{body=raw?JSON.parse(raw):{};}catch{response.writeHead(400).end('{}');return;}
  const send=(status,data)=>{response.writeHead(status,{'Content-Type':'application/json'});response.end(JSON.stringify(data));};
  if(request.headers.apikey!=='test-service-key')return send(401,{});
  state.calls.push({method:request.method,path:url.pathname,body});
  const failure=state.failures.findIndex(item=>item.path===url.pathname&&(!item.method||item.method===request.method));if(failure!==-1){const item=state.failures.splice(failure,1)[0];return send(item.status,item.body);}
  try{
   if(url.pathname==='/auth/v1/verify'){const id=body.type==='recovery'?state.recovery.get(body.token_hash):null;const user=state.auth.find(u=>u.id===id);if(!user)return send(403,{code:'otp_expired'});state.recovery.delete(body.token_hash);return send(200,session(user));}
   if(url.pathname==='/auth/v1/token'){
    const user=url.searchParams.get('grant_type')==='refresh_token'?state.auth.find(u=>u.id===state.refresh.get(body.refresh_token)):state.auth.find(u=>u.email===body.email&&u.password===body.password);
    if(!user)return send(400,{code:'invalid_credentials'});return send(200,session(user));
   }
   if(url.pathname==='/auth/v1/user'){
    const token=request.headers.authorization?.replace('Bearer ',''),id=state.tokens.get(token),user=state.auth.find(u=>u.id===id);if(!user)return send(401,{});
    if(request.method==='PUT')user.password=body.password;return send(200,{id:user.id,email:user.email});
   }
   if(url.pathname==='/auth/v1/logout'){
    const token=request.headers.authorization?.replace('Bearer ','');state.tokens.delete(token);return send(200,{});
   }
   if(url.pathname==='/auth/v1/admin/users'&&request.method==='POST'){
    if(state.auth.some(u=>u.email===body.email))return send(422,{code:'email_exists'});
    const user={id:randomUUID(),email:body.email,password:body.password};state.auth.push(user);return send(200,{id:user.id,email:user.email});
   }
   const target=url.pathname.match(/^\/auth\/v1\/admin\/users\/(.+)$/);
   if(target){const user=state.auth.find(u=>u.id===target[1]);if(!user)return send(404,{});if(request.method==='DELETE')state.auth=state.auth.filter(u=>u!==user);else if(request.method==='PUT'){if(body.password)user.password=body.password;if(body.app_metadata)user.app_metadata=body.app_metadata;if(body.email_confirm)user.email_confirmed=true;}return send(200,{id:user.id,email:user.email,app_metadata:user.app_metadata});}
   if(url.pathname==='/rest/v1/app_users'){
    let users=state.users;const id=url.searchParams.get('id');if(id)users=users.filter(u=>u.id===id.replace('eq.',''));const role=url.searchParams.get('role');if(role)users=users.filter(u=>u.role===role.replace('eq.',''));if(request.method==='PATCH'){for(const user of users)Object.assign(user,body);}if(url.searchParams.get('select')?.includes('app_permissions'))users=users.map(user=>({...user,app_permissions:state.permissions.filter(p=>p.user_id===user.id).map(p=>({module:p.module}))}));return send(200,users);
   }
   if(url.pathname==='/rest/v1/app_permissions'){
    let permissions=state.permissions;const id=url.searchParams.get('user_id');if(id)permissions=permissions.filter(p=>p.user_id===id.replace('eq.',''));return send(200,permissions);
   }
   if(url.pathname==='/rest/v1/app_audit'){
    let logs=[...state.logs].reverse();const module=url.searchParams.get('module'),id=url.searchParams.get('actor_id');if(module)logs=logs.filter(l=>l.module===module.replace('eq.',''));if(id)logs=logs.filter(l=>l.actor_id===id.replace('eq.',''));const offset=Number(url.searchParams.get('offset')||0),limit=Number(url.searchParams.get('limit')||51);return send(200,logs.slice(offset,offset+limit));
   }
   if(url.pathname.startsWith('/rest/v1/rpc/')){
    const fn=url.pathname.split('/').pop();
    if(fn==='app_write_audit')log(body);
    else if(fn==='app_provision_user'){
     actor(body);state.users.push({id:body.p_id,email:body.p_email,display_name:body.p_name,role:'user',active:true,must_change_password:true,created_at:new Date().toISOString()});for(const module of body.p_modules)state.permissions.push({user_id:body.p_id,module});log({p_actor:body.p_actor,p_action:'user_created',p_target:body.p_id,p_details:{email:body.p_email,modules:body.p_modules}});
    }else if(fn==='app_update_user'){
     actor(body);const user=state.users.find(u=>u.id===body.p_id&&u.role==='user');if(!user)throw Error('User unavailable');user.display_name=body.p_name;user.active=body.p_active;state.permissions=state.permissions.filter(p=>p.user_id!==body.p_id);for(const module of body.p_modules)state.permissions.push({user_id:body.p_id,module});log({p_actor:body.p_actor,p_action:'user_updated',p_target:body.p_id,p_details:{active:body.p_active,modules:body.p_modules}});
    }else if(fn==='app_password_changed'){
     const user=state.users.find(u=>u.id===body.p_actor&&u.active);if(!user)throw Error('User unavailable');user.must_change_password=false;log({p_actor:body.p_actor,p_action:'password_changed'});
    }else if(fn==='app_password_reset'){
     actor(body);state.users.find(u=>u.id===body.p_id).must_change_password=true;log({p_actor:body.p_actor,p_action:'password_reset',p_target:body.p_id});
    }else throw Error('Unknown RPC');
    return send(200,null);
   }
   return send(404,{});
  }catch(error){return send(400,{code:'test_error',message:error.message});}
 });
 const previousURL=process.env.SUPABASE_URL,previousKey=process.env.SUPABASE_SERVICE_ROLE_KEY;
 process.env.SUPABASE_URL=await listen(supabase);process.env.SUPABASE_SERVICE_ROLE_KEY='test-service-key';
 const root=resolve('dist');
 const server=createServer(async(request,response)=>{
  try{
   const url=new URL(request.url,'http://local');const path=decodeURIComponent(url.pathname);
   if(path.startsWith('/.netlify/functions/api')||contentModule(path.slice(1))){
    const query=Object.fromEntries(url.searchParams);let route=path;
    if(contentModule(path.slice(1))){route='/.netlify/functions/api/content';query.path=path.slice(1);}
    const result=await handler({httpMethod:request.method,path:route,headers:request.headers,queryStringParameters:query,body:await incoming(request)});
    response.writeHead(result.statusCode,{...result.headers,...result.multiValueHeaders});response.end(result.isBase64Encoded?Buffer.from(result.body,'base64'):result.body);return;
   }
   const file=resolve(root,'.'+(path==='/'?'/index.html':path));if(!file.startsWith(root+'/')){response.writeHead(403).end();return;}
   const bytes=await readFile(file);const mime={'.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.html':'text/html','.json':'application/json','.ttf':'font/ttf','.pdf':'application/pdf'}[extname(file)]||'application/octet-stream';response.writeHead(200,{'Content-Type':mime});response.end(bytes);
  }catch{response.writeHead(404).end('Not found');}
 });
 const url=await listen(server);
 return {url,state,async close(){await new Promise(resolve=>server.close(resolve));await new Promise(resolve=>supabase.close(resolve));if(previousURL===undefined)delete process.env.SUPABASE_URL;else process.env.SUPABASE_URL=previousURL;if(previousKey===undefined)delete process.env.SUPABASE_SERVICE_ROLE_KEY;else process.env.SUPABASE_SERVICE_ROLE_KEY=previousKey;}};
}
export async function browserLogin(page,url,email='admin@example.test',password=ADMIN_PASSWORD){
 await page.goto(url+'/login.html');await page.getByLabel('Usuario',{exact:true}).fill(email);await page.getByLabel('Contraseña',{exact:true}).fill(password);await page.getByRole('button',{name:'Iniciar sesión',exact:true}).click();await page.waitForURL(url+'/');await page.locator('#modules .module-card').first().waitFor();
}
