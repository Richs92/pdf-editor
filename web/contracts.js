import {authorize,recordEvent} from './session.js';
await authorize('contracts');
import {archivePDF} from './document-archive.js';
import {commissionTerms} from './exclusiva-terms.js';
import {contractPDFPreview} from './contract-pdf-preview.js';
import {generateContractPDF} from './contract-pdf.js';
import {cropINEPhoto} from './ine-crop.js';
import {openPrintWindow,supportsDirectPrinting,shareForPrinting} from './print-document.js';
import {signaturePad} from './signature-pad.js';
import {autoCropINE} from './ine-detect.js';
import {formatPagareInput,pagareAmount} from './pagare-amount.js';
import {supportsPDFSharing,sharePDF} from './share-document.js';
import {generateWord} from './word-generator.js';
const $=selector=>document.querySelector(selector);
const form=$('#contract-form'), status=$('#form-status');
let catalog=[], current, generated, sourceVersion=0, pdfCache, busy=false, rendering=false, previewTimer, queuedManual=false, disposed=false, shareTimer, shareReady=null, shareFallback=false;
const signatureData=new Map();
const drafts=new Map(), photoData=new Map(), templates=new Map();
function schedulePreview(delay=650,manual=false){
 clearTimeout(previewTimer);
 if(disposed||!current)return;
 previewTimer=setTimeout(()=>{previewTimer=null;void prepareDocument({manual});},delay);
}
function markDirty(keepSignatures=false){
 if(!keepSignatures&&current&&signatureData.has(current.id)){signatureData.delete(current.id);buildSignaturePads();}
 sourceVersion++;generated=null;pdfCache=null;shareReady=null;shareFallback=false;clearTimeout(shareTimer);$('#exports').hidden=true;
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
    const subtitle=document.createElement('small');subtitle.textContent=item.group==='Exclusiva'?'Servicios inmobiliarios · Word y PDF':item.group==='Recibo de apartado'?'Recibo · Word y PDF':item.group==='Pagaré'?'Título de crédito · Word y PDF':'Promesa de compraventa · '+item.group;
    button.append(title,subtitle);button.addEventListener('click',()=>selectDocument(item));cards.append(button);
  }
  const preferred=catalog.find(item=>item.group===group && item.id===current?.id)||catalog.find(item=>item.group===group);
  if(preferred)selectDocument(preferred);
}
function selectDocument(item){
  saveDraft();current=item;markDirty();
  document.querySelectorAll('.template-choice').forEach(el=>{el.classList.toggle('selected',el.dataset.id===item.id);el.setAttribute('aria-pressed',el.dataset.id===item.id);});
  $('#preview-description').textContent=item.group==='Exclusiva'?'Vista del PDF que descargarás e imprimirás, con la misma tipografía, separación y paginación. Desliza dentro de la vista previa para recorrer las páginas.':'Revisa los datos y los anexos antes de descargar. Vista orientativa del Word. El PDF conserva el contenido y los anexos, con paginación propia. Desliza dentro de la vista previa para recorrer las páginas.';
  $('#document-group').textContent=item.group;$('#document-title').textContent=item.title;
  const fields=$('#fields');fields.replaceChildren();const groups=new Map();
  for(const field of item.fields){
    if(!groups.has(field.group)){const detail=document.createElement('details');const summary=document.createElement('summary');summary.textContent=field.group;detail.append(summary);groups.set(field.group,detail);fields.append(detail);}
    const wrapper=document.createElement('div');wrapper.className='field';const label=document.createElement('label');label.htmlFor='field-'+field.key;label.textContent=field.label;
    const input=document.createElement(field.type==='textarea'?'textarea':'input');input.id=label.htmlFor;input.name=field.key;input.placeholder='Opcional · se deja una línea si está vacío';input.maxLength=4000;
    if(moneyPairs(item.id).some(([amount])=>field.key===amount)){input.inputMode='decimal';input.maxLength=14;input.placeholder='Ej. 10,000';}
    if(moneyPairs(item.id).some(([,words])=>field.key===words)){input.readOnly=true;input.placeholder='Se calcula automáticamente con el importe';}
    if(field.key==='commission'&&item.group==='Exclusiva')input.inputMode='decimal';
    if(field.key==='commissionWords'&&item.group==='Exclusiva'){input.readOnly=true;input.placeholder='Se calcula automáticamente con la comisión';}
    if(field.type==='number'){input.type='number';input.min='0';input.step='1';input.inputMode='numeric';}
    if(field.key==='durationDays')input.min='1';
    input.value=drafts.get(item.id)?.[field.key]??field.default;wrapper.append(label,input);if(['sellerId','buyerId','buyer2Id'].includes(field.key)){const hint=document.createElement('p');hint.className='hint';hint.textContent='Tipo INE y número del reverso (CIC u OCR). Escribe el número tal como aparece en la credencial.';wrapper.append(hint);}groups.get(field.group).append(wrapper);
  }
  syncMoneyAmounts();syncCommission();
  buildPhotoCards();buildSignaturePads();$('#exports').hidden=true;status.textContent='La vista previa se actualiza automáticamente. Puedes dejar campos vacíos.';
  $('#document-preview').replaceChildren();const empty=document.createElement('div');empty.className='empty';empty.textContent='Cargando vista previa del documento…';$('#document-preview').append(empty);schedulePreview(0);
}
function buildSignaturePads(){
 const section=$('#signature-section'),area=$('#signature-pads');area.replaceChildren();section.hidden=!['recibo-apartado','contrato-exclusiva','contrato-exclusiva-dos'].includes(current?.id);if(section.hidden)return;
 const id=current.id;
 for(const [person,label]of (id==='contrato-exclusiva'?[['buyer','Propietario'],['seller','Profesional']]:id==='contrato-exclusiva-dos'?[['buyer','Propietario 1'],['buyer2','Propietario 2'],['seller','Profesional']]:[['buyer','Comprador · Entrega'],['seller','Asesor/vendedor · Recibe']])){
  area.append(signaturePad(label,signatureData.get(id)?.[person],signature=>{if(current.id!==id)return;signatureData.set(id,{...signatureData.get(id),[person]:signature});markDirty(true);buildSignaturePads();},()=>{const values={...signatureData.get(id)};delete values[person];signatureData.set(id,values);markDirty(true);buildSignaturePads();}));
 }
}
function photoSlots(){
 const note=current.id==='pagare',receipt=current.id==='recibo-apartado';
 const people=current.id==='contrato-exclusiva-dos'?[['buyer','Propietario 1'],['buyer2','Propietario 2'],['seller','Profesional']]:current.id==='contrato-exclusiva'?[['buyer','Cliente'],['seller','Profesional']]:receipt?[['buyer','Comprador'],['seller','Asesor/vendedor']]:[['seller',note?'Suscriptor':'Vendedor'],['buyer',note?'Beneficiario':'Comprador']];
 return people.flatMap(([person,label])=>[{key:person+'-front',label:label+' · Frente de INE'},{key:person+'-back',label:label+' · Reverso de INE'}]);
}
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
    return {bytes:new Uint8Array(await blob.arrayBuffer()),width:canvas.width,height:canvas.height,preview:URL.createObjectURL(blob),source:file};
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
    try{
     const source=input.files[0];if(source.size>15*1024*1024)throw Error('La imagen no debe superar 15 MB.');
     const result=await autoCropINE(source),photo=await readPhoto(result.blob);photo.source=source;photo.autoCropped=result.detected;
     const previous=photoData.get(key);if(previous)URL.revokeObjectURL(previous.preview);photoData.set(key,photo);
     if(current.id===documentId){markDirty();buildPhotoCards();status.textContent='INE añadida. La vista previa incluirá el anexo automáticamente.';}
    }catch(error){status.textContent=error.message;}finally{label.style.opacity='1';input.value='';}
   });controls.append(label);
  }
  const photo=photoData.get(key);
  if(photo){const crop=document.createElement('button');crop.type='button';crop.textContent='Recortar INE';crop.addEventListener('click',async()=>{
   try{const cropped=await cropINEPhoto(photo.source);if(!cropped)return;
   if(photoData.get(key)!==photo)return;
   const replacement=await readPhoto(cropped);replacement.source=photo.source;replacement.manualCrop=true;URL.revokeObjectURL(photo.preview);photoData.set(key,replacement);if(current.id===documentId){markDirty();buildPhotoCards();}}catch{status.textContent='No se pudo recortar la foto. Inténtalo de nuevo o sube otra imagen.';}
  });controls.append(crop);const remove=document.createElement('button');remove.type='button';remove.textContent='Quitar foto';remove.addEventListener('click',()=>{URL.revokeObjectURL(photo.preview);photoData.delete(key);markDirty();buildPhotoCards();});controls.append(remove);}
  card.append(controls);if(photo){const img=document.createElement('img');img.src=photo.preview;img.alt=slot.label;card.append(img);const note=document.createElement('p');note.className='hint';note.textContent=photo.manualCrop?'Recorte ajustado manualmente.':photo.autoCropped?'Recorte automático aplicado. Revisa que se vea la credencial completa.':'No se detectaron los bordes con suficiente claridad. Se conserva la foto completa; puedes usar Recortar INE.';card.append(note);}area.append(card);
 }
}
function lock(value){busy=value;document.querySelectorAll('.actions button,.tab,.template-choice').forEach(button=>button.disabled=value);if(!value)updateShareButton();}
function fitPreview(){
 const container=$('#document-preview'),style=getComputedStyle(container);const width=container.clientWidth-parseFloat(style.paddingLeft)-parseFloat(style.paddingRight);
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
 const sheets=[...source.querySelectorAll('section.docx')];
 sheets.forEach((sheet,index)=>{for(const footer of sheet.querySelectorAll('footer'))if(footer.textContent.includes('Página')){footer.textContent='Página '+(index+1)+' de '+sheets.length;footer.style.textAlign='center';}});
 const preview=$('#document-preview'),scrollTop=preview.scrollTop;preview.replaceChildren();
 // Preserve generated styles without exposing source markup as application code.
 source.querySelectorAll('style').forEach(style=>preview.append(style.cloneNode(true)));
 source.querySelectorAll('section.docx').forEach(section=>{const holder=document.createElement('div');holder.className='word-sheet';holder.append(section.cloneNode(true));preview.append(holder);});fitPreview();preview.scrollTop=scrollTop;
}
function moneyPairs(id){return id==='pagare'?[['amount','amountWords']]:['contrato-exclusiva','contrato-exclusiva-dos'].includes(id)?[['price','priceWords']]:id==='recibo-apartado'?['deposit','price','penalty'].map(key=>[key,key+'Words']):[];}
function syncMoneyAmounts(){
 for(const [amount,wordKey]of moneyPairs(current?.id)){
 const input=form.elements[amount],words=form.elements[wordKey],raw=input.value,start=input.selectionStart;
 try{
  const formatted=formatPagareInput(raw),significant=start===null?null:raw.slice(0,start).replace(/,/g,'').length;
  input.value=formatted;input.setCustomValidity('');words.value=pagareAmount(formatted).amountWords;
  if(significant!==null){let position=0,count=0;while(position<formatted.length&&count<significant){if(formatted[position]!==',')count++;position++;}input.setSelectionRange(position,position);}
 }catch(error){input.setCustomValidity(error.message);words.value='';}
 }
}
function syncCommission(){
 if(current?.group!=='Exclusiva')return;
 const input=form.elements.commission,words=form.elements.commissionWords;
 try{words.value=commissionTerms(input.value).commissionWords;input.setCustomValidity('');}catch(error){words.value='';input.setCustomValidity(error.message);}
}
form.addEventListener('invalid',event=>{const group=event.target.closest('details');if(group)group.open=true;},true);
form.addEventListener('input',event=>{if(event.target.closest('#fields')&&!event.isComposing){if(event.target.name==='commission')syncCommission();if(moneyPairs(current?.id).some(([key])=>event.target.name===key))syncMoneyAmounts();saveDraft();markDirty();}});
form.addEventListener('compositionend',event=>{if(event.target.closest('#fields')){syncCommission();saveDraft();markDirty();}});
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
  const bytes=await generateWord(template,item,data,photos,signatureData.get(item.id)||{});
  if(!isCurrent())return;
  let previewPDF;
  if(item.group==='Exclusiva'){previewPDF=await generateContractPDF(bytes);if(!isCurrent())return;await contractPDFPreview(previewPDF,$('#document-preview'),isCurrent);fitPreview();}else await renderDocument(bytes,isCurrent);
  if(!isCurrent())return;
  const ready={bytes,id:item.id,version,logged:null};generated=ready;pdfCache=previewPDF?{ready,promise:Promise.resolve(previewPDF)}:null;
  if(manual)await logGeneration(ready);
  if(!isCurrent())return;
  $('#exports').hidden=false;$('#preview-state').textContent='Vista previa actualizada';
  shareReady=null;shareFallback=false;clearTimeout(shareTimer);updateShareButton();
  if(supportsPDFSharing())shareTimer=setTimeout(()=>{void prepareShareFile(ready);},800);
  status.textContent=`Documento actualizado${photos.length?' con '+photos.length+' cara(s) de INE':''}. Revisa el contenido antes de descargar.`;
 }catch(error){if(isCurrent()){status.textContent=error.message;$('#preview-state').textContent='No se pudo actualizar. Revisa los datos o vuelve a intentar.';$('#exports').hidden=true;}}
 finally{
  rendering=false;
  if(isCurrent())$('#document-preview').setAttribute('aria-busy','false');
  if(queuedManual){queuedManual=false;schedulePreview(0,true);}else if(!isCurrent())schedulePreview();
 }
}
form.addEventListener('submit',event=>{event.preventDefault();if(current?.id==='pagare')syncMoneyAmounts();saveDraft();markDirty(true);void prepareDocument({manual:true});});

function pdfForReady(ready){
 if(pdfCache?.ready===ready)return pdfCache.promise;
 const cache={ready,promise:generateContractPDF(ready.bytes)};pdfCache=cache;
 cache.promise.catch(()=>{if(pdfCache===cache)pdfCache=null;});return cache.promise;
}
function updateShareButton(){
 const print=$('#print-document'),direct=supportsDirectPrinting()&&!shareFallback;print.disabled=busy||(direct&&shareReady?.ready!==generated);print.textContent=direct&&shareReady?.ready!==generated?'Preparando PDF para imprimir…':'Imprimir';
 const button=$('#whatsapp-share'),hint=$('#share-hint');
 if(!supportsPDFSharing()||shareFallback){button.disabled=busy;button.textContent='Descargar PDF para WhatsApp';hint.textContent='Descarga el PDF y adjúntalo manualmente en WhatsApp.';return;}
 button.disabled=busy||!shareReady||shareReady.ready!==generated;
 button.textContent=shareReady?.ready===generated?'Compartir por WhatsApp':'Preparando PDF para compartir…';
 hint.textContent='Se abrirá el menú de compartir del teléfono. Elige WhatsApp y el contacto. No se envía hasta que tú lo confirmes.';
}
async function prepareShareFile(ready){
 try{
  const blob=await pdfForReady(ready);
  if(disposed||generated!==ready)return;
  const file=new File([blob],ready.id+'-llenado.pdf',{type:'application/pdf'});
  if(!navigator.canShare({files:[file]})){shareFallback=true;}else shareReady={ready,file};
 }catch{if(generated===ready)shareFallback=true;}
 if(generated===ready)updateShareButton();
}
$('#whatsapp-share').addEventListener('click',()=>{
 if(!generated||busy)return;
 if(!supportsPDFSharing()||shareFallback){$('#pdf-download').click();return;}
 const prepared=shareReady;if(!prepared||prepared.ready!==generated)return;
 let sharing;
 try{sharing=sharePDF(prepared.file);}catch(error){shareFallback=true;updateShareButton();status.textContent=error.message;return;}
 // Log a sharing request, not delivery to WhatsApp or a specific recipient.
 const audit=logGeneration(prepared.ready).then(()=>recordEvent('contracts','document_share_requested',{documentId:prepared.ready.id,format:'pdf'}));
 Promise.allSettled([sharing,audit]).then(([result,logged])=>{
  if(generated!==prepared.ready)return;
  if(result.status==='rejected'){
   if(result.reason?.name==='AbortError')status.textContent='Menú de compartir cerrado. Puedes volver a intentarlo.';
   else {shareFallback=true;updateShareButton();status.textContent='No se pudo abrir el menú de compartir. Puedes descargar el PDF y adjuntarlo en WhatsApp.';}
  }else status.textContent='El documento se entregó al menú de compartir del teléfono. La app no confirma su envío ni entrega en WhatsApp.';
  if(logged.status==='rejected')status.textContent+=' No se pudo registrar la solicitud de compartir.';
 });
});

function download(blob,filename){const url=URL.createObjectURL(blob);const link=document.createElement('a');link.href=url;link.download=filename;link.click();setTimeout(()=>URL.revokeObjectURL(url),30000);}
async function wordDownload(format='docx'){if(!generated)return;const ready=generated;await logGeneration(ready);await archivePDF(await pdfForReady(ready),'contracts',{documentId:ready.id,format});if(generated!==ready)throw Error('El documento cambió. Vuelve a prepararlo.');download(new Blob([generated.bytes],{type:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'}),generated.id+'-llenado.docx');}
$('#word-download').addEventListener('click',()=>wordDownload().catch(error=>status.textContent=error.message));
$('#google-download').addEventListener('click',async()=>{try{await wordDownload('google-docs');status.textContent='Word descargado. Súbelo a Google Drive y selecciona “Abrir con → Documentos de Google”. Los anexos están incluidos.';}catch(error){status.textContent=error.message;}});
$('#print-document').addEventListener('click',async()=>{
 if(!generated||busy)return;
 if(supportsDirectPrinting()&&!shareFallback&&shareReady?.ready===generated){
  const ready=generated;let result;try{result=shareForPrinting(shareReady.file);}catch(error){shareFallback=true;updateShareButton();status.textContent='No se pudo abrir el menú. Pulsa Imprimir para usar la alternativa.';return;}
  lock(true);const outcomes=await Promise.allSettled([result,logGeneration(ready).then(()=>recordEvent('contracts','document_print_requested',{documentId:ready.id,format:'pdf'}))]);lock(false);
  if(outcomes[0].status==='rejected'){if(outcomes[0].reason?.name==='AbortError')status.textContent='Menú cerrado. Puedes volver a imprimir.';else{shareFallback=true;updateShareButton();status.textContent='No se pudo abrir el menú. Pulsa Imprimir para usar la alternativa.';}}
  else status.textContent='En el menú del iPhone elige Imprimir y selecciona tu impresora. La app no confirma la impresión.';
  if(outcomes[1].status==='rejected')status.textContent+=' No se pudo registrar la solicitud.';return;
 }
 let view;const ready=generated;lock(true);
 try{
  view=openPrintWindow({module:'contracts',documentId:ready.id});view.stage('Generando el PDF con firmas y anexos…');const pdf=await view.wait(pdfForReady(ready));if(generated!==ready)throw Error('El documento cambió. Espera la vista previa actualizada y vuelve a imprimir.');
  await view.wait(logGeneration(ready));await view.wait(recordEvent('contracts','document_print_requested',{documentId:ready.id,format:'pdf'}));
  if(generated!==ready)throw Error('El documento cambió. Vuelve a imprimir la versión actualizada.');
  await view.show(pdf,ready.id+'-llenado.pdf');status.textContent='Impresión solicitada. Selecciona la impresora en el menú del dispositivo.';
 }catch(error){if(pdfCache?.ready===ready)pdfCache=null;view?.fail(error);status.textContent=error.message;}finally{lock(false);if(!generated)schedulePreview(0);}
});
$('#pdf-download').addEventListener('click',async()=>{
 if(!generated||busy)return;const prepared=generated,version=sourceVersion;lock(true);status.textContent='Generando PDF. Puede tardar unos segundos…';
 try{
  const result=await pdfForReady(prepared);
  if(version!==sourceVersion){status.textContent='Hay cambios nuevos. Vuelve a preparar el documento.';return;}
  await logGeneration(prepared);
  if(version!==sourceVersion)throw Error('El documento cambió. Espera a que se actualice la vista previa.');
  await archivePDF(result,'contracts',{documentId:prepared.id,format:'pdf'});
  if(version!==sourceVersion)throw Error('El documento cambió. Vuelve a prepararlo.');
  download(result,prepared.id+'-llenado.pdf');status.textContent='PDF descargado con los datos y anexos incluidos.';
 }catch(error){status.textContent='No se pudo generar el PDF. Puedes descargar el Word. '+error.message;}finally{lock(false);if(!generated)schedulePreview(0);}

});
for(const button of document.querySelectorAll('.tab'))button.addEventListener('click',()=>setGroup(button.dataset.group));
for(const event of ['gesturestart','gesturechange'])document.addEventListener(event,e=>e.preventDefault(),{passive:false});
try{const response=await fetch('./contracts-catalog.json');if(!response.ok)throw Error('No se pudo cargar el catálogo.');catalog=await response.json();setGroup('Ratificados');$('#workspace').hidden=false;$('#loading').hidden=true;}catch(error){$('#loading').textContent=error.message;}

window.addEventListener('pagehide',()=>{disposed=true;clearTimeout(previewTimer);clearTimeout(shareTimer);});
