import {authorize,api,moduleInfo} from './session.js';
const $=id=>document.getElementById(id),status=$('status');let users=[],editing,offset=0;
const actions={login:'Inicio de sesión',login_failed:'Intento de acceso fallido',login_denied:'Acceso a cuenta desactivada o no habilitada',logout:'Cierre de sesión',module_opened:'Entró a la sección',user_created:'Creó un usuario',user_updated:'Modificó usuario o permisos',password_changed:'Cambió su contraseña',password_recovered:'Recuperó su contraseña por correo',password_reset:'Generó contraseña',document_share_requested:'Solicitó compartir un documento',document_generated:'Generó un documento',document_downloaded:'Solicitó descargar un documento'};
function report(error){status.textContent=error.message||error;status.classList.add('error');}
function permissions(area,selected=[]){area.replaceChildren();for(const [key,item]of Object.entries(moduleInfo)){const label=document.createElement('label');label.className='check';const input=document.createElement('input');input.type='checkbox';input.value=key;input.checked=selected.includes(key);label.append(input,document.createTextNode(item.title));area.append(label);}}
const selected=area=>[...area.querySelectorAll('input:checked')].map(input=>input.value);
function showPassword(email,password){$('credential-email').textContent=email;$('temporary-password').value=password;$('temporary-password').type='password';$('show-password').textContent='Mostrar';$('credentials').hidden=false;$('credentials').scrollIntoView({behavior:'smooth',block:'start'});}
$('copy-password').addEventListener('click',async()=>{try{await navigator.clipboard.writeText($('temporary-password').value);status.textContent='Contraseña copiada.';}catch{report('No se pudo copiar. Pulsa Mostrar y cópiala manualmente.');}});
$('show-password').addEventListener('click',()=>{const input=$('temporary-password');input.type=input.type==='password'?'text':'password';$('show-password').textContent=input.type==='password'?'Mostrar':'Ocultar';});
$('close-password').addEventListener('click',()=>{$('temporary-password').value='';$('credentials').hidden=true;});
function edit(user){editing=user;$('edit-email').textContent=user.username;$('edit-name').value=user.display_name;$('edit-active').checked=user.active;permissions($('edit-permissions'),user.modules);$('edit-panel').hidden=false;$('edit-panel').scrollIntoView({behavior:'smooth',block:'start'});}
async function loadUsers(){
 const data=await api('/admin/users');users=data.users;const area=$('user-list');area.replaceChildren();const picker=$('log-user');const previous=picker.value;picker.replaceChildren(new Option('Todos',''));
 for(const user of users){
  picker.append(new Option(user.display_name+' · '+user.username,user.id));
  const row=document.createElement('div');row.style.cssText='padding:15px 0;border-bottom:1px solid #e1e7eb';const name=document.createElement('div');name.className='user-title';name.textContent=user.display_name;const email=document.createElement('div');email.className='hint';email.textContent=user.username;row.append(name,email);
  const flags=document.createElement('div');for(const flag of [user.role==='admin'?'Administrador':user.active?'Activo':'Desactivado',...user.modules.map(key=>moduleInfo[key].title)]){const pill=document.createElement('span');pill.className='pill'+(!user.active?' off':'');pill.textContent=flag;flags.append(pill);}row.append(flags);
  if(user.role!=='admin'){
   const controls=document.createElement('div');controls.className='row-actions';controls.style.marginTop='10px';const change=document.createElement('button');change.className='secondary';change.textContent='Editar permisos';change.addEventListener('click',()=>edit(user));
   const reset=document.createElement('button');reset.className='secondary';reset.textContent='Nueva contraseña';reset.addEventListener('click',async()=>{if(!confirm('¿Generar una nueva contraseña para '+user.username+'? La contraseña anterior dejará de funcionar.'))return;reset.disabled=true;try{const data=await api('/admin/users/'+user.id+'/reset-password',{method:'POST',body:{}});showPassword(user.username,data.temporaryPassword);await loadUsers();status.textContent='Contraseña restablecida.';}catch(error){report(error);}finally{reset.disabled=false;}});
   controls.append(change,reset);row.append(controls);
  }
  area.append(row);
 }
 picker.value=previous;
}
$('create-user').addEventListener('submit',async event=>{event.preventDefault();const button=event.currentTarget.querySelector('button');button.disabled=true;status.textContent='Creando usuario…';try{const values=Object.fromEntries(new FormData(event.currentTarget));const data=await api('/admin/users',{method:'POST',body:{...values,modules:selected($('create-permissions'))}});showPassword(data.username,data.temporaryPassword);$('create-user').reset();await loadUsers();status.textContent='Usuario creado. Comparte su contraseña de forma privada.';}catch(error){report(error);}finally{button.disabled=false;}});
$('edit-user').addEventListener('submit',async event=>{event.preventDefault();const button=event.currentTarget.querySelector('button');button.disabled=true;try{await api('/admin/users/'+editing.id,{method:'PATCH',body:{displayName:$('edit-name').value,active:$('edit-active').checked,modules:selected($('edit-permissions'))}});$('edit-panel').hidden=true;await loadUsers();status.textContent='Permisos actualizados. Se aplican desde la siguiente solicitud del usuario.';}catch(error){report(error);}finally{button.disabled=false;}});
$('cancel-edit').addEventListener('click',()=>$('edit-panel').hidden=true);
$('refresh-users').addEventListener('click',()=>loadUsers().catch(report));
async function loadLogs(){
 const query=new URLSearchParams({offset:String(offset)});if($('log-user').value)query.set('actor',$('log-user').value);if($('log-module').value)query.set('module',$('log-module').value);
 const data=await api('/admin/logs?'+query);const body=$('logs');body.replaceChildren();
 for(const item of data.items){
  const row=document.createElement('tr');const values=[new Intl.DateTimeFormat('es-MX',{timeZone:'America/Mazatlan',dateStyle:'short',timeStyle:'medium'}).format(new Date(item.occurred_at)),users.find(u=>u.id===item.actor_id)?.username||item.actor_email?.replace('@users.terminavit.invalid','')||'Usuario no identificado',actions[item.action]||item.action,moduleInfo[item.module]?.title||'Sistema',item.source==='browser'?'Navegador':'Servidor'];
  for(const value of values){const cell=document.createElement('td');cell.textContent=value;row.append(cell);}
  const details=item.details||{},parts=[];if(details.documentId)parts.push('Documento: '+details.documentId);if(details.format)parts.push('Formato: '+details.format);if(details.email)parts.push('Usuario creado: '+details.email.replace('@users.terminavit.invalid',''));if(details.modules)parts.push('Permisos: '+details.modules.map(m=>moduleInfo[m]?.title||m).join(', '));if('active'in details)parts.push(details.active?'Usuario activo':'Usuario desactivado');if(item.target_id&&!details.email)parts.push('Usuario: '+(users.find(u=>u.id===item.target_id)?.username||item.target_id));
  if(parts.length){const detail=document.createElement('div');detail.className='log-details';detail.textContent=parts.join(' · ');row.children[2].append(detail);}body.append(row);
 }
 if(!data.items.length){const row=document.createElement('tr');const cell=document.createElement('td');cell.colSpan=5;cell.textContent='No hay actividad para estos filtros.';row.append(cell);body.append(row);}
 $('previous-logs').disabled=offset===0;$('next-logs').disabled=!data.hasMore;$('log-page').textContent='Página '+(offset/50+1);
}
$('refresh-logs').addEventListener('click',()=>{offset=0;loadLogs().catch(report);});
$('previous-logs').addEventListener('click',()=>{offset=Math.max(0,offset-50);loadLogs().catch(report);});$('next-logs').addEventListener('click',()=>{offset+=50;loadLogs().catch(report);});
function tab(logs){$('users-panel').hidden=logs;$('logs-panel').hidden=!logs;$('users-tab').setAttribute('aria-pressed',!logs);$('logs-tab').setAttribute('aria-pressed',logs);if(logs)loadLogs().catch(report);}
$('users-tab').addEventListener('click',()=>tab(false));$('logs-tab').addEventListener('click',()=>tab(true));
try{const data=await authorize();if(data.user.role!=='admin'){location.replace('/');throw Error('Acceso reservado al administrador.');}permissions($('create-permissions'));await loadUsers();$('admin-content').hidden=false;status.textContent='';}catch(error){report(error);}
