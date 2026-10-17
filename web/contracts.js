import {authorize,recordEvent} from './session.js';
await authorize('contracts');
import {generateContractPDF} from './contract-pdf.js';
import {recognizeINE} from './ine-ocr.js';
import {extractINEFields,ineTargetFields} from './ine-fields.js';
import {formatPagareInput,pagareAmount} from './pagare-amount.js';
import {generateWord} from './word-generator.js';
const $=selector=>document.querySelector(selector);
const form=$('#contract-form'), status=$('#form-status');
let catalog=[], current, generated, sourceVersion=0, pdfCache, busy=false, rendering=false, previewTimer, queuedManual=false, disposed=false;
const drafts=new Map(), photoData=new Map(), templates=new Map();
function schedulePreview(delay=650,manual=false){
 clearTimeout(previewTimer);
 if(disposed||!current)return;
 previewTimer=setTimeout(()=>{previewTimer=null;void prepareDocument({manual});},delay);
}
function markDirty(){
 sourceVersion++;generated=null;pdfCache=null;$('#exports').hidden=true;
 status.textContent='La vista previa se actualizará automáticamente.';
 $('#preview-state').textContent='Cambios pendientes · actualizando…';$('#document-preview').setAttribute('aria-busy','true');
 schedulePreview();
}
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
    if(item.id==='pagare'&&field.key==='amount'){input.inputMode='decimal';input.maxLength=14;input.placeholder='Ej. 10,000';}
    if(item.id==='pagare'&&field.key==='amountWords'){input.readOnly=true;input.placeholder='Se calcula automáticamente con el importe';}
    if(field.type==='number'){input.type='number';input.min='0';input.step='1';input.inputMode='numeric';}
    input.value=drafts.get(item.id)?.[field.key]??field.default;wrapper.append(label,input);if(['sellerId','buyerId'].includes(field.key)){const hint=document.createElement('p');hint.className='hint';hint.textContent='Tipo INE y número del reverso (CIC u OCR). Revisa el dato detectado antes de aplicarlo.';wrapper.append(hint);}groups.get(field.group).append(wrapper);
  }
  if(item.id==='pagare')syncPagareAmount();
  buildPhotoCards();$('#exports').hidden=true;status.textContent='La vista previa se actualiza automáticamente. Puedes dejar campos vacíos.';
  $('#document-preview').replaceChildren();const empty=document.createElement('div');empty.className='empty';empty.textContent='Cargando vista previa del documento…';$('#document-preview').append(empty);schedulePreview(0);
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
  const documentId=current.id,key=photoKey(slot.key),card=document.createElement('div');card.className='photo-card';const title=document.createElement('h3');title.textContent=slot.label;card.append(title);
  const controls=document.createElement('div');controls.className='photo-buttons';
  for(const camera of [true,false]){
   const label=document.createElement('label');label.textContent=camera?'Tomar foto':'Subir imagen';const input=document.createElement('input');input.type='file';input.accept='image/*';input.hidden=true;input.setAttribute('aria-label',(camera?'Tomar foto: ':'Subir imagen: ')+slot.label);if(camera)input.capture='environment';label.append(input);
   input.addEventListener('change',async()=>{
    if(!input.files[0])return;label.style.opacity='.5';status.textContent='Procesando imagen…';
    try{const photo=await readPhoto(input.files[0]);const previous=photoData.get(key);if(previous){previous.ocr?.controller?.abort();URL.revokeObjectURL(previous.preview);}photoData.set(key,photo);if(current.id===documentId){markDirty();buildPhotoCards();status.textContent='INE añadida. Revisa sus datos; la vista previa incluirá el anexo automáticamente.';}void scanPhoto(documentId,slot,photo);}catch(error){status.textContent=error.message;}finally{label.style.opacity='1';input.value='';}
   });controls.append(label);
  }
  const photo=photoData.get(key);
  if(photo){const remove=document.createElement('button');remove.type='button';remove.textContent='Quitar foto';remove.addEventListener('click',()=>{photo.ocr?.controller?.abort();URL.revokeObjectURL(photo.preview);photoData.delete(key);markDirty();buildPhotoCards();});controls.append(remove);}
  card.append(controls);if(photo){const img=document.createElement('img');img.src=photo.preview;img.alt=slot.label;card.append(img);buildOCRReview(card,documentId,slot,photo);}area.append(card);
 }
}
async function scanPhoto(documentId,slot,photo){
 if(photo.ocr?.state==='reading')return;
 const controller=new AbortController();photo.ocr={state:'reading',message:'Lectura en espera…',controller};
 const visible=()=>current.id===documentId&&photoData.get(documentId+'-'+slot.key)===photo;
 if(visible())buildPhotoCards();
 try{
  const result=await recognizeINE(photo.preview,{signal:controller.signal,onProgress:message=>{photo.ocr.message=message;if(visible()){const node=document.querySelector(`[data-ocr-status="${slot.key}"]`);if(node)node.textContent=message;}}});
  if(controller.signal.aborted)return;
  const values=extractINEFields(result.text,{face:slot.key.endsWith('-back')?'back':'front'});photo.ocr={state:'ready',values,selected:Object.fromEntries(Object.entries(values).map(([key,value])=>[key,Boolean(value)])),confidence:result.confidence};
 }catch(error){if(controller.signal.aborted)return;photo.ocr={state:'error',message:error.message||'No se pudo leer la INE. Puedes volver a intentar o llenar el formulario manualmente.'};}
 if(visible())buildPhotoCards();
}
function buildOCRReview(card,documentId,slot,photo){
 const ocr=photo.ocr,area=document.createElement('div');area.className='ocr-review';area.dataset.ocrSlot=slot.key;card.append(area);
 const message=document.createElement('p');message.className='hint';message.setAttribute('role','status');message.dataset.ocrStatus=slot.key;area.append(message);
 const read=document.createElement('button');read.type='button';read.className='secondary';read.textContent=ocr?'Volver a leer INE':'Leer datos de INE';read.disabled=ocr?.state==='reading';read.addEventListener('click',()=>scanPhoto(documentId,slot,photo));area.append(read);
 if(!ocr){message.textContent='El reverso permite detectar el CIC o el número OCR, si se leen claramente.';return;}
 if(ocr.state==='reading'){message.textContent=ocr.message;return;}
 if(ocr.state==='error'){message.textContent='No se pudo completar la lectura. La foto sigue adjunta; puedes llenar el formulario manualmente o volver a intentar.';return;}
 message.textContent=Object.values(ocr.values).some(Boolean)?'Revisa y corrige los datos antes de aplicarlos. '+(ocr.confidence<65?'La lectura tiene baja confianza; compárala con la foto.':''):'No se detectaron datos con claridad. Puedes escribirlos aquí o probar otra foto.';
 const targets=ineTargetFields(documentId,slot.key.split('-')[0]);
 for(const [key,label]of Object.entries({name:'Nombre detectado',address:'Domicilio detectado',identification:'Identificación detectada'})){
  if(!targets[key]||slot.key.endsWith('-front')&&key==='identification'||slot.key.endsWith('-back')&&key!=='identification')continue;
  const field=document.createElement('div');field.className='field';const id='ocr-'+slot.key+'-'+key;
  const title=document.createElement('label');title.htmlFor=id;title.textContent=label;
  const input=document.createElement(key==='address'?'textarea':'input');input.id=id;input.value=ocr.values[key];input.maxLength=4000;input.dataset.ocrField=key;
  input.addEventListener('input',()=>{ocr.values[key]=input.value;});
  const selectLabel=document.createElement('label');selectLabel.className='ocr-check';const check=document.createElement('input');check.type='checkbox';check.checked=ocr.selected[key];check.setAttribute('aria-label','Usar '+label.toLowerCase());check.addEventListener('change',()=>ocr.selected[key]=check.checked);selectLabel.append(check,document.createTextNode('Usar este dato'));
  field.append(title,input,selectLabel);area.append(field);
 }
 const apply=document.createElement('button');apply.type='button';apply.className='primary';apply.textContent='Aplicar datos revisados';apply.addEventListener('click',()=>{
  if(current.id!==documentId||photoData.get(documentId+'-'+slot.key)!==photo)return;
  const updates=Object.entries(targets).filter(([key])=>ocr.selected[key]&&ocr.values[key].trim()).map(([key,target])=>({input:form.elements[target],value:ocr.values[key].trim().replace(/\r?\n/g,', ')})).filter(item=>item.input);
  if(!updates.length){message.textContent='Selecciona al menos un dato con contenido para aplicar.';return;}
  if(updates.some(({input,value})=>input.value.trim()&&input.value.trim()!==value)&&!confirm('Los datos seleccionados reemplazarán información que ya está escrita en el formulario. ¿Continuar?'))return;
  for(const {input,value}of updates)input.value=value;
  saveDraft();markDirty();message.textContent='Datos aplicados al formulario. Puedes seguir editándolos.';status.textContent='Datos de INE aplicados. Actualizando la vista previa automáticamente.';
 });area.append(apply);
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
async function renderDocument(bytes,isCurrent){
 const source=$('#render-source');source.replaceChildren();
 await window.docx.renderAsync(bytes.slice().buffer,source,undefined,{className:'docx',inWrapper:true,breakPages:true,ignoreLastRenderedPageBreak:false,renderHeaders:true,renderFooters:true,renderFootnotes:true,useBase64URL:true});
 await Promise.all([...source.querySelectorAll('img')].map(image=>image.decode().catch(()=>{})));
 if(document.fonts?.ready)await document.fonts.ready;
 if(!isCurrent())return;
 const preview=$('#document-preview');preview.replaceChildren();
 // Preserve generated styles without exposing source markup as application code.
 source.querySelectorAll('style').forEach(style=>preview.append(style.cloneNode(true)));
 source.querySelectorAll('section.docx').forEach(section=>{const holder=document.createElement('div');holder.className='word-sheet';holder.append(section.cloneNode(true));preview.append(holder);});fitPreview();
}
function syncPagareAmount(){
 if(current?.id!=='pagare')return;
 const input=form.elements.amount,words=form.elements.amountWords,raw=input.value,start=input.selectionStart;
 try{
  const formatted=formatPagareInput(raw),significant=start===null?null:raw.slice(0,start).replace(/,/g,'').length;
  input.value=formatted;input.setCustomValidity('');words.value=pagareAmount(formatted).amountWords;
  if(significant!==null){let position=0,count=0;while(position<formatted.length&&count<significant){if(formatted[position]!==',')count++;position++;}input.setSelectionRange(position,position);}
 }catch(error){input.setCustomValidity(error.message);words.value='';}
}
form.addEventListener('invalid',event=>{const group=event.target.closest('details');if(group)group.open=true;},true);
form.addEventListener('input',event=>{if(event.target.closest('#fields')&&!event.isComposing){if(event.target.name==='amount')syncPagareAmount();saveDraft();markDirty();}});
form.addEventListener('compositionend',event=>{if(event.target.closest('#fields')){saveDraft();markDirty();}});
async function logGeneration(ready){
 if(!ready.logged)ready.logged=recordEvent('contracts','document_generated',{documentId:ready.id}).catch(error=>{ready.logged=null;throw error;});
 await ready.logged;
}
async function prepareDocument({manual=false}={}){
 clearTimeout(previewTimer);previewTimer=null;
 if(disposed||!current)return;
 if(rendering||busy){queuedManual=queuedManual||manual;return;}
 rendering=true;
 const version=sourceVersion,item=current,data=getValues();
 const isCurrent=()=>!disposed&&version===sourceVersion&&item.id===current.id;
 const photos=photoSlots().flatMap(slot=>{const photo=photoData.get(photoKey(slot.key));return photo?[{...photo,label:slot.label,person:slot.key.split('-')[0],face:slot.key.split('-')[1]}]:[];});
 $('#preview-state').textContent='Actualizando vista previa…';$('#document-preview').setAttribute('aria-busy','true');
 try{
  let template=templates.get(item.id);if(!template){const response=await fetch('./'+item.template);if(!response.ok)throw Error('No se pudo cargar la plantilla.');template=new Uint8Array(await response.arrayBuffer());templates.set(item.id,template);}
  if(!isCurrent())return;
  const bytes=await generateWord(template,item,data,photos);
  if(!isCurrent())return;
  await renderDocument(bytes,isCurrent);
  if(!isCurrent())return;
  const ready={bytes,id:item.id,version,logged:null};generated=ready;pdfCache=null;
  if(manual)await logGeneration(ready);
  if(!isCurrent())return;
  $('#exports').hidden=false;$('#preview-state').textContent='Vista previa actualizada';
  status.textContent=`Documento actualizado${photos.length?' con '+photos.length+' cara(s) de INE':''}. Revisa el contenido antes de descargar.`;
 }catch(error){if(isCurrent()){status.textContent=error.message;$('#preview-state').textContent='No se pudo actualizar. Revisa los datos o vuelve a intentar.';$('#exports').hidden=true;}}
 finally{
  rendering=false;
  if(isCurrent())$('#document-preview').setAttribute('aria-busy','false');
  if(queuedManual){queuedManual=false;schedulePreview(0,true);}else if(!isCurrent())schedulePreview();
 }
}
form.addEventListener('submit',event=>{event.preventDefault();if(current?.id==='pagare')syncPagareAmount();saveDraft();markDirty();void prepareDocument({manual:true});});

function download(blob,filename){const url=URL.createObjectURL(blob);const link=document.createElement('a');link.href=url;link.download=filename;link.click();setTimeout(()=>URL.revokeObjectURL(url),30000);}
async function wordDownload(format='docx'){if(!generated)return;const ready=generated;await logGeneration(ready);await recordEvent('contracts','document_downloaded',{documentId:ready.id,format});if(generated!==ready)throw Error('El documento cambió. Vuelve a prepararlo.');download(new Blob([generated.bytes],{type:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'}),generated.id+'-llenado.docx');}
$('#word-download').addEventListener('click',()=>wordDownload().catch(error=>status.textContent=error.message));
$('#google-download').addEventListener('click',async()=>{try{await wordDownload('google-docs');status.textContent='Word descargado. Súbelo a Google Drive y selecciona “Abrir con → Documentos de Google”. Los anexos están incluidos.';}catch(error){status.textContent=error.message;}});
$('#pdf-download').addEventListener('click',async()=>{
 if(!generated||busy)return;const prepared=generated,version=sourceVersion;lock(true);status.textContent='Generando PDF. Puede tardar unos segundos…';
 try{
  const result=pdfCache||await generateContractPDF(prepared.bytes);
  if(version!==sourceVersion){status.textContent='Hay cambios nuevos. Vuelve a preparar el documento.';return;}
  await logGeneration(prepared);
  if(version!==sourceVersion)throw Error('El documento cambió. Espera a que se actualice la vista previa.');
  await recordEvent('contracts','document_downloaded',{documentId:prepared.id,format:'pdf'});
  if(version!==sourceVersion)throw Error('El documento cambió. Vuelve a prepararlo.');
  pdfCache=result;download(result,prepared.id+'-llenado.pdf');status.textContent='PDF descargado con los datos y anexos incluidos.';
 }catch(error){status.textContent='No se pudo generar el PDF. Puedes descargar el Word. '+error.message;}finally{lock(false);if(!generated)schedulePreview(0);}

});
for(const button of document.querySelectorAll('.tab'))button.addEventListener('click',()=>setGroup(button.dataset.group));
for(const event of ['gesturestart','gesturechange'])document.addEventListener(event,e=>e.preventDefault(),{passive:false});
try{const response=await fetch('./contracts-catalog.json');if(!response.ok)throw Error('No se pudo cargar el catálogo.');catalog=await response.json();setGroup('Ratificados');$('#workspace').hidden=false;$('#loading').hidden=true;}catch(error){$('#loading').textContent=error.message;}

window.addEventListener('pagehide',()=>{disposed=true;clearTimeout(previewTimer);for(const photo of photoData.values())photo.ocr?.controller?.abort();});
