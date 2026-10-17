import {authorize,recordEvent,guardDownload} from '../session.js';
await authorize('bank');
import {generateBank,bankDates} from './generator.js';
import {renderPreview} from '../preview.js';
const $=id=>document.getElementById(id),form=$('bank-form'),status=$('status');let template,revision=0,url,busy=false;
function dirty(){revision++;$('download').hidden=true;status.textContent='Hay cambios pendientes. Actualiza la vista previa.';}
async function update(){
 const version=revision;busy=true;$('generate').disabled=true;status.textContent='Preparando copia editada…';
 try{
  const now=new Date(),dates=bankDates(now);$('period').textContent=dates.period;$('cutoff').textContent=dates.cutoff;
  const bytes=await generateBank(window.PDFLib,template,Object.fromEntries(new FormData(form)),now);if(version!==revision)return;
  await recordEvent('bank','document_generated');
  await renderPreview(bytes);if(version!==revision)return;
  const previous=url;url=URL.createObjectURL(new Blob([bytes],{type:'application/pdf'}));$('download').href=url;$('download').hidden=false;if(previous)setTimeout(()=>URL.revokeObjectURL(previous),30000);
  status.textContent='Documento editado listo. Ya puedes descargar el PDF.';
 }catch(error){status.textContent=error.message;$('download').hidden=true;}finally{busy=false;$('generate').disabled=false;}
}
form.addEventListener('input',dirty);form.addEventListener('submit',event=>{event.preventDefault();if(!busy)update();});
for(const name of ['gesturestart','gesturechange'])document.addEventListener(name,event=>event.preventDefault(),{passive:false});
try{const [pdf,defaults]=await Promise.all([fetch('./bank/template.pdf'),fetch('./bank/defaults.json')]);if(!pdf.ok||!defaults.ok)throw Error('No se pudo cargar la plantilla. Recarga la página.');template=new Uint8Array(await pdf.arrayBuffer());const data=await defaults.json();for(const [key,value]of Object.entries(data))$(key).value=value;await update();}catch(error){status.textContent=error.message;}

guardDownload($('download'),'bank');
