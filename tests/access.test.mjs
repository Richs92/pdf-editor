import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,access} from 'node:fs/promises';
import {startTestApp,ADMIN_PASSWORD,USER_PASSWORD,USER_ID,ADMIN_ID} from './helpers/test-app.mjs';
import {handler} from '../netlify/functions/api.mjs';
let app;
before(async()=>{app=await startTestApp();});after(async()=>app.close());
function client(){const jar=new Map();return{jar,async call(path,{method='GET',body,origin=app.url}={}){
 const response=await fetch(app.url+'/.netlify/functions/api'+path,{method,redirect:'manual',headers:{cookie:[...jar].map(([k,v])=>k+'='+v).join('; '),origin,...(body===undefined?{}:{'Content-Type':'application/json'})},body:body===undefined?undefined:JSON.stringify(body)});
 for(const cookie of response.headers.getSetCookie()){const [pair]=cookie.split(';');const i=pair.indexOf('=');jar.set(pair.slice(0,i),pair.slice(i+1));}
 let data;const raw=await response.text();try{data=JSON.parse(raw);}catch{data=raw;}return{status:response.status,data,headers:response.headers};
}};}
async function login(user='admin'){const result=client();const response=await result.call('/auth/login',{method:'POST',body:{email:user+'@example.test',password:user==='admin'?ADMIN_PASSWORD:USER_PASSWORD}});assert.equal(response.status,200);return result;}
test('sin configuración responde cerrado; no existe modo público de respaldo',async()=>{
 const saved=process.env.SUPABASE_SERVICE_ROLE_KEY;delete process.env.SUPABASE_SERVICE_ROLE_KEY;
 try{const result=await handler({path:'/.netlify/functions/api/me',httpMethod:'GET',headers:{}});assert.equal(result.statusCode,503);assert.equal(JSON.parse(result.body).code,'SETUP_REQUIRED');}finally{process.env.SUPABASE_SERVICE_ROLE_KEY=saved;}
});
test('no hay plantillas, datos personales o páginas privadas en dist',async()=>{
 for(const path of ['template-clean.pdf','defaults.json','predial/fields.js','predial/template.pdf','water/defaults.json','contracts.html','templates/pagare.docx'])await assert.rejects(access('dist/'+path));
 assert.ok((await readFile('dist/index.html','utf8')).includes('home.js'));
});
test('sin sesión no se pueden obtener ni páginas ni plantillas',async()=>{
 const anonymous=client();assert.equal((await anonymous.call('/me')).status,401);
 for(const path of ['template-clean.pdf','predial/fields.js','water/template.pdf','templates/pagare.docx'])assert.equal((await anonymous.call('/content?path='+path)).status,401);
 const page=await anonymous.call('/content?path=cfe.html');assert.equal(page.status,302);assert.ok(page.headers.get('location').startsWith('/login.html'));
 assert.equal((await anonymous.call('/content?path=../package.json')).status,404);
});
test('sesión HttpOnly, permisos en servidor, revocación inmediata y CSRF',async()=>{
 const staff=await login('staff');const me=await staff.call('/me');assert.deepEqual(me.data.modules,['cfe','water']);
 assert.equal((await staff.call('/content?path=template-clean.pdf')).status,200);
 const rewritten=await handler({path:'/cfe.html',httpMethod:'GET',headers:{cookie:[...staff.jar].map(([k,v])=>k+'='+v).join('; ')},queryStringParameters:{path:'cfe.html'}});assert.equal(rewritten.statusCode,200);
 assert.equal((await staff.call('/content?path=predial/template.pdf')).status,403);
 assert.equal((await staff.call('/admin/users')).status,403);
 assert.equal((await staff.call('/audit',{method:'POST',origin:'https://malicious.example',body:{module:'cfe',action:'document_generated'}})).status,403);
 assert.equal((await staff.call('/audit',{method:'POST',body:{module:'cfe',action:'user_created'}})).status,400);
 const admin=await login();assert.equal((await admin.call('/admin/users/'+USER_ID,{method:'PATCH',body:{displayName:'Usuario de prueba',active:true,modules:['water']}})).status,200);
 assert.equal((await staff.call('/content?path=template-clean.pdf')).status,403);
 assert.equal((await staff.call('/audit',{method:'POST',body:{module:'cfe',action:'document_downloaded',format:'pdf'}})).status,403);
 await admin.call('/admin/users/'+USER_ID,{method:'PATCH',body:{displayName:'Usuario de prueba',active:false,modules:['water']}});assert.equal((await staff.call('/me')).status,403);
 await admin.call('/admin/users/'+USER_ID,{method:'PATCH',body:{displayName:'Usuario de prueba',active:true,modules:['cfe','water']}});
});
test('crear, contraseña aleatoria, cambio obligatorio, permisos, reset y log',async()=>{
 const admin=await login();
 const created=await admin.call('/admin/users',{method:'POST',body:{displayName:'Nuevo usuario',email:'new@example.test',modules:['predial']}});assert.equal(created.status,201);assert.ok(created.data.temporaryPassword.length>=24);
 const id=created.data.id,password=created.data.temporaryPassword;
 const newbie=client();let response=await newbie.call('/auth/login',{method:'POST',body:{email:'new@example.test',password}});assert.equal(response.status,200);assert.equal(response.data.mustChangePassword,true);
 const cookie=response.headers.getSetCookie().join(';');for(const flag of ['HttpOnly','Secure','SameSite=Lax'])assert.ok(cookie.includes(flag));
 assert.equal((await newbie.call('/content?path=predial/template.pdf')).status,403);
 assert.equal((await newbie.call('/auth/password',{method:'POST',body:{currentPassword:password,password:'New-personal-password-123!'}})).status,200);
 assert.equal((await newbie.call('/content?path=predial/template.pdf')).status,200);
 assert.equal((await newbie.call('/content?path=water/template.pdf')).status,403);
 assert.equal((await newbie.call('/audit',{method:'POST',body:{module:'predial',action:'document_generated'}})).status,200);
 const audit=await admin.call('/admin/logs?actor='+id+'&module=predial');assert.ok(audit.data.items.some(item=>item.action==='document_generated'&&item.actor_email==='new@example.test'&&item.source==='browser'));
 const reset=await admin.call('/admin/users/'+id+'/reset-password',{method:'POST',body:{}});assert.equal(reset.status,200);assert.notEqual(reset.data.temporaryPassword,password);
 assert.equal((await newbie.call('/content?path=predial/template.pdf')).status,403);
 assert.equal((await admin.call('/admin/users/'+ADMIN_ID,{method:'PATCH',body:{displayName:'Try',active:false,modules:[]}})).status,400);
 const users=await admin.call('/admin/users');assert.ok(!JSON.stringify(users.data).includes(password));assert.ok(!JSON.stringify(app.state.logs).includes(password));assert.ok(!JSON.stringify(app.state.logs).includes(reset.data.temporaryPassword));
 assert.equal((await admin.call('/auth/logout',{method:'POST',body:{}})).status,200);assert.equal((await admin.call('/me')).status,401);
});
