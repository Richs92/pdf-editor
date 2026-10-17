import {authorize,moduleInfo} from './session.js';
const status=document.querySelector('#status');
function redirectRecovery(){const recovery=new URLSearchParams(location.hash.slice(1));if(recovery.get('type')==='recovery'||recovery.has('error_code')){location.replace('/recover.html'+location.hash);return true;}return false;}
window.addEventListener('hashchange',redirectRecovery);
if(!redirectRecovery()){
try{
 const data=await authorize();document.querySelector('#greeting').textContent='Hola, '+data.user.display_name;
 const area=document.querySelector('#modules');
 for(const [key,item] of Object.entries(moduleInfo)){
  const allowed=data.modules.includes(key),card=document.createElement(allowed?'a':'section');card.className='module-card'+(allowed?'':' locked');if(allowed)card.href=item.path;
  const icon=document.createElement('span');icon.className='icon';icon.textContent=item.icon;
  const title=document.createElement('h2');title.textContent=item.title;
  const text=document.createElement('p');text.textContent=item.description;
  const open=document.createElement('span');open.className='open';open.textContent=allowed?'Entrar →':'Sin permiso de acceso';card.append(icon,title,text,open);area.append(card);
 }
 status.textContent=data.modules.length?'':'Todavía no tienes secciones asignadas. Contacta al administrador.';
}catch(error){status.textContent=error.message;status.classList.add('error');}

}
