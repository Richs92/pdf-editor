import {api,safeNext} from './session.js';
const form=document.querySelector('form'),status=document.querySelector('#status'),button=form.querySelector('button');
form.addEventListener('submit',async event=>{
 event.preventDefault();button.disabled=true;status.textContent='Iniciando sesión…';
 try{const data=Object.fromEntries(new FormData(form));const result=await api('/auth/login',{method:'POST',body:data,redirect:false});form.elements.password.value='';if(result.mustChangePassword){location.assign('/account.html');return;}const current=await api('/me');location.assign(safeNext(new URLSearchParams(location.search).get('next'),current.modules));}
 catch(error){status.textContent=error.message;status.classList.add('error');button.disabled=false;}
});
try{const current=await api('/me',{redirect:false});location.replace(current.user.must_change_password?'/account.html':safeNext(new URLSearchParams(location.search).get('next'),current.modules));}catch(error){if(error.code==='SETUP_REQUIRED'){status.textContent=error.message;button.disabled=true;}}
