import {authorize,recordEvent} from './session.js';
await authorize('contracts');
import {generateContractPDF} from './contract-pdf.js';
import {generateWord} from './word-generator.js';
const $=selector=>document.querySelector(selector);
const form=$('#contract-form'), status=$('#form-status');
let catalog=[], current, generated, sourceVersion=0, pdfCache, busy=false;
const drafts=new Map(), photoData=new Map(), templates=new Map();
function markDirty(){sourceVersion++;generated=null;pdfCache=null;$('#exports').hidden=true;status.textContent='Hay cambios pendientes. Prepara el documento para actualizarlo.';}
function getValues(){return Object.fromEntries(new FormData(form));}
function saveDraft(){if(current)drafts.set(current.id,getValues());}
function setGroup(group){
  saveDraft();
  document.querySelectorAll('.tab').forEach(button=>{const active=button.dataset.group===group;button.classList.toggle('active',active);button.setAttribute('aria-pressed',active);});
  const cards=$('#templates');cards.replaceChildren();
  for(const item of catalog.filter(item=>item.group===group)){
    const button=document.createElement('button');button.className='template-choice';button.dataset.id=item.id;
    const title=document.createElement('strong');title.textContent=item.title;
    const subtitle=document.createElement('small');subtitle.textContent=item.group==='Pagaré'?'Título de crédito · Word y PDF':'Promesa de compraventa · '+item.group;
    button.append(title,subtitle);button.addEventListener('click',()=>selectDocument(item));cards.append(button);
  }
  const preferred=catalog.find(item=>item.group===group && item.id===current?.id)||catalog.find(item=>item.group===group);
  if(preferred)selectDocument(preferred);
}
function selectDocument(item){
  saveDraft();current=item;markDirty();
  document.querySelectorAll('.template-choice').forEach(el=>{el.classList.toggle('selected',el.dataset.id===item.id);el.setAttribute('aria-pressed',el.dataset.id===item.id);});
  $('#document-group').textContent=item.group;$('#document-title').textContent=item.title;
  const fields=$('#fields');fields.replaceChildren();const groups=new Map();
  for(const field of item.fields){
    if(!groups.has(field.group)){const detail=document.createElement('details');detail.open=true;const summary=document.createElement('summary');summary.textContent=field.group;detail.append(summary);groups.set(field.group,detail);fields.append(detail);}
    const wrapper=document.createElement('div');wrapper.className='field';const label=document.createElement('label');label.htmlFor='field-'+field.key;label.textContent=field.label;
    const input=document.createElement(field.type==='textarea'?'textarea':'input');input.id=label.htmlFor;input.name=field.key;input.placeholder='Opcional · se deja una línea si está vacío';input.maxLength=4000;
    if(field.type==='number'){input.type='number';input.min='0';input.step='1';input.inputMode='numeric';}
    input.value=drafts.get(item.id)?.[field.key]??field.default;wrapper.append(label,input);groups.get(field.group).append(wrapper);
  }
  buildPhotoCards();$('#exports').hidden=true;status.textContent='Llena los datos que tengas y prepara tu documento. Los campos vacíos se convertirán en líneas para escribir a mano.';
  $('#document-preview').replaceChildren();const empty=document.createElement('div');empty.className='empty';empty.textContent='Llena los datos disponibles y pulsa “Preparar documento”. Puedes dejar campos vacíos.';$('#document-preview').append(empty);
}
function photoSlots(){const note=current.id==='pagare';return [{key:'seller-front',label:(note?'Suscriptor':'Vendedor')+' · Frente de INE'},{key:'seller-back',label:(note?'Suscriptor':'Vendedor')+' · Reverso de INE'},{key:'buyer-front',label:(note?'Beneficiario':'Comprador')+' · Frente de INE'},{key:'buyer-back',label:(note?'Beneficiario':'Comprador')+' · Reverso de INE'}];}
function photoKey(key){return current.id+'-'+key;}
async function readPhoto(file){
  if(file.size>15*1024*1024)throw Error('La imagen no debe superar 15 MB.');
  const url=URL.createObjectURL(file);
  try{
    const img=new Image();img.src=url;await img.decode();
    const scale=Math.min(1,1600/Math.max(img.naturalWidth,img.naturalHeight));
    const canvas=document.createElement('canvas');canvas.width=Math.round(img.naturalWidth*scale);canvas.height=Math.round(img.naturalHeight*scale);
    const context=canvas.getContext('2d');context.fillStyle='white';context.fillRect(0,0,canvas.width,canvas.height);context.drawImage(img,0,0,canvas.width,canvas.height);
    const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',.88));if(!blob)throw Error('No se pudo convertir la imagen.');
    return {bytes:new Uint8Array(await blob.arrayBuffer()),width:canvas.width,height:canvas.height,preview:URL.createObjectURL(blob)};
  }catch(error){if(error.message.includes('15 MB'))throw error;throw Error('No se pudo leer la imagen. Prueba con una foto JPG o PNG.');}finally{URL.revokeObjectURL(url);}
}
function buildPhotoCards(){
 const area=$('#photos');area.replaceChildren();
 for(const slot of photoSlots()){
  const key=photoKey(slot.key),card=document.createElement('div');card.className='photo-card';const title=document.createElement('h3');title.textContent=slot.label;card.append(title);
  const controls=document.createElement('div');controls.className='photo-buttons';
  for(const camera of [true,false]){
   const label=document.createElement('label');label.textContent=camera?'Tomar foto':'Subir imagen';const input=document.createElement('input');input.type='file';input.accept='image/*';input.hidden=true;input.setAttribute('aria-label',(camera?'Tomar foto: ':'Subir imagen: ')+slot.label);if(camera)input.capture='environment';label.append(input);
   input.addEventListener('change',async()=>{
    if(!input.files[0])return;label.style.opacity='.5';status.textContent='Procesando imagen…';
    try{const photo=await readPhoto(input.files[0]);const previous=photoData.get(key);if(previous)URL.revokeObjectURL(previous.preview);photoData.set(key,photo);markDirty();buildPhotoCards();status.textContent='INE añadida. Prepara el documento para incluir el anexo.';}catch(error){status.textContent=error.message;}finally{label.style.opacity='1';input.value='';}
   });controls.append(label);
  }
  const photo=photoData.get(key);
  if(photo){const remove=document.createElement('button');remove.type='button';remove.textContent='Quitar foto';remove.addEventListener('click',()=>{URL.revokeObjectURL(photo.preview);photoData.delete(key);markDirty();buildPhotoCards();});controls.append(remove);}
  card.append(controls);if(photo){const img=document.createElement('img');img.src=photo.preview;img.alt=slot.label;card.append(img);}area.append(card);
 }
}
function lock(value){busy=value;document.querySelectorAll('.actions button,.tab,.template-choice').forEach(button=>button.disabled=value);}
function fitPreview(){
 const container=$('#document-preview');const width=container.clientWidth;
 container.querySelectorAll('.word-sheet').forEach(holder=>{
  const section=holder.firstElementChild;const scale=Math.min(1,width/section.offsetWidth);
  holder.style.width=section.offsetWidth*scale+'px';holder.style.height=section.offsetHeight*scale+'px';section.style.transform=`scale(${scale})`;
 });
}
new ResizeObserver(fitPreview).observe($('#document-preview'));
async function renderDocument(bytes){
 const source=$('#render-source');source.replaceChildren();
 await window.docx.renderAsync(bytes.slice().buffer,source,undefined,{className:'docx',inWrapper:true,breakPages:true,ignoreLastRenderedPageBreak:false,renderHeaders:true,renderFooters:true,renderFootnotes:true,useBase64URL:true});
 await Promise.all([...source.querySelectorAll('img')].map(image=>image.decode().catch(()=>{})));
 if(document.fonts?.ready)await document.fonts.ready;
 const preview=$('#document-preview');preview.replaceChildren();
 // Preserve generated styles without exposing source markup as application code.
 source.querySelectorAll('style').forEach(style=>preview.append(style.cloneNode(true)));
 source.querySelectorAll('section.docx').forEach(section=>{const holder=document.createElement('div');holder.className='word-sheet';holder.append(section.cloneNode(true));preview.append(holder);});fitPreview();
}
form.addEventListener('invalid',event=>{const group=event.target.closest('details');if(group)group.open=true;},true);
form.addEventListener('input',()=>{saveDraft();markDirty();});
form.addEventListener('submit',async event=>{
 event.preventDefault();if(busy)return;lock(true);status.textContent='Preparando el documento y sus anexos…';const version=sourceVersion;
 try{
  const item=current;let template=templates.get(item.id);if(!template){const response=await fetch('./'+item.template);if(!response.ok)throw Error('No se pudo cargar la plantilla.');template=new Uint8Array(await response.arrayBuffer());templates.set(item.id,template);}
  const photos=photoSlots().flatMap(slot=>{const photo=photoData.get(photoKey(slot.key));return photo?[{...photo,label:slot.label}]:[];});
  const bytes=await generateWord(template,item,getValues(),photos);
  await recordEvent('contracts','document_generated',{documentId:item.id});
  await renderDocument(bytes);
  if(version!==sourceVersion){status.textContent='Hay cambios nuevos. Vuelve a preparar el documento.';return;}
  generated={bytes,id:item.id};pdfCache=null;$('#exports').hidden=false;status.textContent=`Documento listo${photos.length?' con '+photos.length+' anexo(s) de INE':''}. Revisa el contenido antes de descargar.`;
 }catch(error){status.textContent=error.message;$('#exports').hidden=true;}finally{lock(false);}
});
function download(blob,filename){const url=URL.createObjectURL(blob);const link=document.createElement('a');link.href=url;link.download=filename;link.click();setTimeout(()=>URL.revokeObjectURL(url),30000);}
async function wordDownload(format='docx'){if(!generated)return;const ready=generated;await recordEvent('contracts','document_downloaded',{documentId:ready.id,format});if(generated!==ready)throw Error('El documento cambió. Vuelve a prepararlo.');download(new Blob([generated.bytes],{type:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'}),generated.id+'-llenado.docx');}
$('#word-download').addEventListener('click',()=>wordDownload().catch(error=>status.textContent=error.message));
$('#google-download').addEventListener('click',async()=>{try{await wordDownload('google-docs');status.textContent='Word descargado. Súbelo a Google Drive y selecciona “Abrir con → Documentos de Google”. Los anexos están incluidos.';}catch(error){status.textContent=error.message;}});
$('#pdf-download').addEventListener('click',async()=>{
 if(!generated||busy)return;const prepared=generated,version=sourceVersion;lock(true);status.textContent='Generando PDF. Puede tardar unos segundos…';
 try{
  const result=pdfCache||await generateContractPDF(prepared.bytes);
  if(version!==sourceVersion){status.textContent='Hay cambios nuevos. Vuelve a preparar el documento.';return;}
  await recordEvent('contracts','document_downloaded',{documentId:prepared.id,format:'pdf'});
  if(version!==sourceVersion)throw Error('El documento cambió. Vuelve a prepararlo.');
  pdfCache=result;download(result,prepared.id+'-llenado.pdf');status.textContent='PDF descargado con los datos y anexos incluidos.';
 }catch(error){status.textContent='No se pudo generar el PDF. Puedes descargar el Word. '+error.message;}finally{lock(false);}

});
for(const button of document.querySelectorAll('.tab'))button.addEventListener('click',()=>setGroup(button.dataset.group));
for(const event of ['gesturestart','gesturechange'])document.addEventListener(event,e=>e.preventDefault(),{passive:false});
try{const response=await fetch('./contracts-catalog.json');if(!response.ok)throw Error('No se pudo cargar el catálogo.');catalog=await response.json();setGroup('Ratificados');$('#workspace').hidden=false;$('#loading').hidden=true;}catch(error){$('#loading').textContent=error.message;}
