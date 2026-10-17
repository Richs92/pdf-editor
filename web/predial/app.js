import {installPDFPrinting} from '../print-document.js';
import {authorize,recordEvent,guardDownload} from '../session.js';
await authorize('predial');
import {generatePredial} from './generator.js';
import {renderPreview} from '../preview.js';
const $=id=>document.getElementById(id),form=$('predial-form'),status=$('status');
let template,revision=0,url,busy=false;
function dirty(){revision++;$('download').hidden=true;status.textContent='Hay cambios pendientes. Actualiza la vista previa.';}
function values(){
 const result=Object.fromEntries(new FormData(form));result.cadastre=Array.from({length:6},(_,i)=>$('key'+i).value).join('-');
 for(const key of ['Total','Terrain','Construction'])result['edit'+key]=$('edit'+key).checked;
 return result;
}
async function update(){
 const version=revision;busy=true;$('generate').disabled=true;status.textContent='Actualizando ambas copias…';
 try{
  const bytes=await generatePredial(window.PDFLib,template,values());if(version!==revision)return;
  await recordEvent('predial','document_generated');
  await renderPreview(bytes);if(version!==revision)return;
  const previous=url;url=URL.createObjectURL(new Blob([bytes],{type:'application/pdf'}));$('download').href=url;$('download').hidden=false;
  if(previous)setTimeout(()=>URL.revokeObjectURL(previous),30000);
  status.textContent='Ambas copias están actualizadas. Ya puedes descargar el PDF.';
 }catch(error){$('download').hidden=true;status.textContent=error.message;}finally{busy=false;$('generate').disabled=false;}
}
form.addEventListener('input',dirty);
for(const key of ['Total','Terrain','Construction'])$('edit'+key).addEventListener('change',()=>{const input=$(key.toLowerCase());input.disabled=!$('edit'+key).checked;input.required=$('edit'+key).checked;dirty();});
for(let i=1;i<5;i++)$('key'+i).addEventListener('input',event=>{event.target.value=event.target.value.replace(/[^0-9]/g,'').slice(0,3);});
$('key-blocks').addEventListener('paste',event=>{
 const text=event.clipboardData.getData('text').trim().replace(/-/g,'');
 if(!/^\d{18}$/.test(text))return;
 event.preventDefault();
 if(!text.startsWith('007')||!text.endsWith('001')){status.textContent='La clave debe comenzar con 007 y terminar con 001.';return;}
 for(let i=1;i<5;i++)$('key'+i).value=text.slice(i*3,i*3+3);dirty();
});
form.addEventListener('submit',event=>{event.preventDefault();if(!busy)update();});
for(const name of ['gesturestart','gesturechange'])document.addEventListener(name,event=>event.preventDefault(),{passive:false});
try{
 const [pdf,defaults]=await Promise.all([fetch('./predial/template.pdf'),fetch('./predial/defaults.json')]);
 if(!pdf.ok||!defaults.ok)throw Error('No se pudo cargar la plantilla. Recarga la página.');
 template=new Uint8Array(await pdf.arrayBuffer());const data=await defaults.json();
 data.cadastre.split('-').forEach((part,i)=>$('key'+i).value=part);
 for(const key of ['name','address','expiry','total','terrain','construction'])$(key).value=data[key];
 await update();
}catch(error){status.textContent=error.message;}

guardDownload($('download'),'predial');

installPDFPrinting(document.querySelector('#download'),'predial',document.querySelector('#status'));
