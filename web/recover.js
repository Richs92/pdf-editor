import {api} from './session.js';
const params=new URLSearchParams(location.hash.slice(1));
const query=new URLSearchParams(location.search);
let tokenHash=params.get('token_hash')||query.get('token_hash');
let accessToken=params.get('type')==='recovery'?params.get('access_token'):null;
const hasError=params.has('error')||query.has('error');
// Never keep recovery credentials in browser history, storage or page markup.
history.replaceState(null,'','/recover.html');
const form=document.querySelector('#recover'),status=document.querySelector('#status');
if(hasError)status.textContent='El enlace ya fue utilizado o venció. Solicita un correo nuevo y abre solamente el más reciente.';
else if(!tokenHash&&!accessToken)status.textContent='Abre esta página desde el enlace del correo de recuperación.';
else form.hidden=false;
form.addEventListener('submit',async event=>{
 event.preventDefault();const password=document.querySelector('#password').value;
 if(password!==document.querySelector('#confirm').value){status.textContent='Las contraseñas no coinciden.';return;}
 const button=form.querySelector('button');button.disabled=true;status.textContent='Guardando nueva contraseña…';
 try{
  await api('/auth/recover',{method:'POST',body:{password,...(tokenHash?{tokenHash}:{accessToken})},redirect:false});
  tokenHash=null;accessToken=null;form.reset();form.hidden=true;status.textContent='Contraseña actualizada. Ya puedes entrar con tu correo y la nueva contraseña.';document.querySelector('#login-link').hidden=false;
 }catch(error){status.textContent=error.message;button.disabled=false;if(error.code==='RECOVERY_EXPIRED'){tokenHash=null;accessToken=null;form.reset();form.hidden=true;}}
});
