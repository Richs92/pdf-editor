export const moduleInfo={contracts:{title:'Contratos y pagaré',path:'/contracts.html',icon:'▤',description:'Seis contratos y pagaré, con anexos de identificación.'},cfe:{title:'CFE',path:'/cfe.html',icon:'ϟ',description:'Datos del recibo de electricidad y fechas del periodo.'},water:{title:'Agua',path:'/water.html',icon:'◉',description:'Recibo de agua, categoría y fechas de facturación.'},predial:{title:'Predial',path:'/predial.html',icon:'⌂',description:'Clave catastral y las dos copias del recibo.'},bank:{title:'BanBajío',path:'/bank.html',icon:'▣',description:'Primera hoja, datos de cliente y periodo anterior. Copia marcada como editada.'}};
const API='/.netlify/functions/api';
export async function api(path,{method='GET',body,redirect=true}={}){
 const response=await fetch(API+path,{method,credentials:'same-origin',headers:body===undefined?{}:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body),cache:'no-store'});
 let data;try{data=await response.json();}catch{throw Error('El servicio no está disponible. Intenta de nuevo.');}
 if(!response.ok){
  if(redirect&&data.code==='LOGIN_REQUIRED'&&location.pathname!=='/login.html')location.assign('/login.html');
  if(redirect&&data.code==='PASSWORD_CHANGE_REQUIRED'&&location.pathname!=='/account.html')location.assign('/account.html');
  const error=Error(data.error||'No se pudo completar la operación.');error.code=data.code;error.status=response.status;throw error;
 }
 return data;
}
let sessionPromise;
export async function session(){if(!sessionPromise)sessionPromise=api('/me').catch(error=>{sessionPromise=null;throw error;});return sessionPromise;}
export function safeNext(value,modules){const item=Object.entries(moduleInfo).find(([,item])=>item.path===value);return item&&modules.includes(item[0])?value:'/';}
export async function authorize(module){
 let data;try{data=await session();}catch(error){const status=document.querySelector('#status,#form-status');if(status)status.textContent=error.message;throw error;}
 if(data.user.must_change_password){location.replace('/account.html');throw Error('Cambia tu contraseña para continuar.');}
 if(module&&!data.modules.includes(module)){location.replace('/');throw Error('No tienes permiso para esta sección.');}
 mountNavigation(data);return data;
}
export function mountNavigation(data){
 const nav=document.querySelector('header nav');if(!nav)return;
 nav.replaceChildren();
 function link(text,href){const anchor=document.createElement('a');anchor.textContent=text;anchor.href=href;if(location.pathname===href)anchor.setAttribute('aria-current','page');nav.append(anchor);}
 link('Home','/');
 for(const key of data.user.must_change_password?[]:data.modules)if(moduleInfo[key])link(moduleInfo[key].title,moduleInfo[key].path);
 if(data.user.role==='admin'&&!data.user.must_change_password)link('Admin','/admin.html');
 link('Mi cuenta','/account.html');
 const logout=document.createElement('button');logout.type='button';logout.className='session-logout';logout.textContent='Salir';logout.addEventListener('click',async()=>{logout.disabled=true;try{await api('/auth/logout',{method:'POST',body:{}});location.assign('/login.html');}catch(error){logout.textContent=error.message;logout.disabled=false;}});nav.append(logout);
}
export const recordEvent=(module,action,details={})=>api('/audit',{method:'POST',body:{module,action,...details}});
export function guardDownload(anchor,module,details={}){
 let downloading=false;
 anchor.addEventListener('click',async event=>{
  event.preventDefault();if(downloading||anchor.hidden)return;downloading=true;
  const href=anchor.href;
  try{await recordEvent(module,'document_downloaded',{format:'pdf',...details});if(anchor.href!==href||anchor.hidden)throw Error('El documento cambió. Actualiza la vista previa.');const link=document.createElement('a');link.href=href;link.download=anchor.download;link.click();}
  catch(error){const status=document.querySelector('#status');if(status)status.textContent=error.message;}
  finally{downloading=false;}
 });
}

window.addEventListener('pagehide',()=>{
 const temporary=document.querySelector('#temporary-password');if(temporary)temporary.value='';
});
window.addEventListener('pageshow',async event=>{
 if(!event.persisted)return;
 try{
  const current=await api('/me',{redirect:false});
  const module=Object.entries(moduleInfo).find(([,item])=>item.path===location.pathname)?.[0];
  if(current.user.must_change_password||module&&!current.modules.includes(module)||location.pathname==='/admin.html'&&current.user.role!=='admin')location.replace(current.user.must_change_password?'/account.html':'/');
  else location.reload();
 }catch{document.body.replaceChildren();location.replace('/login.html');}
});

for(const name of ['gesturestart','gesturechange'])document.addEventListener(name,event=>event.preventDefault(),{passive:false});
