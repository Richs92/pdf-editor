import {test,before,after} from 'node:test';import assert from 'node:assert/strict';import {startTestApp,ADMIN_PASSWORD,USER_PASSWORD,USER_ID} from './helpers/test-app.mjs';
let app;before(async()=>{app=await startTestApp();});after(async()=>app.close());
function client(){const jar=new Map();return {async call(path,{method='GET',body,type,origin=app.url}={}){const response=await fetch(app.url+'/.netlify/functions/api'+path,{method,headers:{cookie:[...jar].map(([k,v])=>k+'='+v).join('; '),origin,...(body===undefined?{}:{'Content-Type':type||'application/json'})},body:body===undefined?undefined:type?body:JSON.stringify(body)});for(const cookie of response.headers.getSetCookie()){const pair=cookie.split(';')[0],i=pair.indexOf('=');jar.set(pair.slice(0,i),pair.slice(i+1));}const bytes=Buffer.from(await response.arrayBuffer());let data;try{data=JSON.parse(bytes.toString());}catch{data=null;}return {status:response.status,headers:response.headers,bytes,data};}};}
async function login(name){const c=client();assert.equal((await c.call('/auth/login',{method:'POST',body:{email:name+'@example.test',password:name==='admin'?ADMIN_PASSWORD:USER_PASSWORD}})).status,200);return c;}
const pdf=Buffer.concat([Buffer.from('%PDF-1.7\n%'),Buffer.from([0xff,0xe2,0x81,0x00]),Buffer.from('\n%%EOF\n')]);
test('archivo privado: copia binaria exacta, actor real y consulta exclusiva de admin',async()=>{
 const admin=await login('admin'),staff=await login('staff'),anonymous=client();
 const saved=await staff.call('/documents/archive?module=water&format=pdf',{method:'POST',type:'application/pdf',body:pdf});assert.equal(saved.status,201);assert.equal(app.state.documentBucket.public,false);
 const id=saved.data.archiveId,log=app.state.logs.find(l=>l.details.archiveId===id);assert.equal(log.actor_id,USER_ID);assert.equal(log.action,'document_downloaded');assert.equal(log.source,'server');
 const path='/admin/documents/'+id;assert.equal((await staff.call(path)).status,403);assert.equal((await anonymous.call(path)).status,401);
 const opened=await admin.call(path);assert.equal(opened.status,200);assert.deepEqual(opened.bytes,pdf);assert.match(opened.headers.get('cache-control'),/no-store/);assert.match(opened.headers.get('content-type'),/application\/pdf/);assert.ok(app.state.logs.some(l=>l.action==='document_viewed'&&l.details.archiveId===id));
});
test('archivo: permisos por módulo, CSRF, tamaño y contenido se validan antes de subir',async()=>{
 const staff=await login('staff');const before=app.state.documents.size;
 for(const [path,body,type,origin,status]of [
 ['/documents/archive?module=contracts&format=pdf',pdf,'application/pdf',app.url,403],
 ['/documents/archive?module=water&format=pdf',pdf,'application/pdf','https://otro.example',403],
 ['/documents/archive?module=water&format=pdf',Buffer.from('<html>no PDF</html>'),'application/pdf',app.url,400],
 ['/documents/archive?module=water&format=pdf',Buffer.alloc(3*1024*1024+1),'application/pdf',app.url,413],
 ['/documents/archive?module=water&format=exe',pdf,'application/pdf',app.url,400]
 ])assert.equal((await staff.call(path,{method:'POST',body,type,origin})).status,status);
 assert.equal(app.state.documents.size,before);
});
test('archivo: falla cerrado ante bucket público o error de guardado y revierte si falla el log',async()=>{
 const staff=await login('staff'),before=app.state.documents.size;
 app.state.documentBucket.public=true;assert.equal((await staff.call('/documents/archive?module=water&format=pdf',{method:'POST',body:pdf,type:'application/pdf'})).status,503);app.state.documentBucket.public=false;
 app.state.failures.push({path:'/rest/v1/rpc/app_write_audit',method:'POST',status:500,body:{code:'test'}});
 assert.equal((await staff.call('/documents/archive?module=water&format=pdf',{method:'POST',body:pdf,type:'application/pdf'})).status,503);assert.equal(app.state.documents.size,before);
 app.state.users.find(u=>u.id===USER_ID).active=false;assert.equal((await staff.call('/documents/archive?module=water&format=pdf',{method:'POST',body:pdf,type:'application/pdf'})).status,403);app.state.users.find(u=>u.id===USER_ID).active=true;
});
