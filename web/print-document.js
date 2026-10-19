import {archivePDF} from './document-archive.js';
import {supportsPDFSharing} from './share-document.js';
import {recordEvent} from './session.js';
export function usesNativePDFPrinting(nav=navigator){return /iPad|iPhone|iPod/.test(nav.userAgent)||(nav.platform==='MacIntel'&&nav.maxTouchPoints>1);}
export const supportsDirectPrinting=()=>usesNativePDFPrinting()&&supportsPDFSharing();
export const shareForPrinting=file=>navigator.share({files:[file],title:'Imprimir documento'});
// Keep preparation in the active tab: iOS can suspend an opener behind a new tab.
export function openPrintWindow({module,documentId}={}){
 const dialog=document.createElement('dialog');dialog.className='document-print-dialog';dialog.style.cssText='position:fixed;inset:0;width:100%;max-width:100%;height:100%;max-height:100%;padding:0;border:0;margin:0;background:white';
 const close=document.createElement('button');close.type='button';close.textContent='Cerrar impresión';close.style.cssText='display:block;width:100%;padding:14px;border:0;background:#192b36;color:white;font:16px system-ui';
 const frame=document.createElement('iframe');frame.title='Documento listo para imprimir';frame.style.cssText='display:block;width:100%;height:calc(100% - 48px);border:0;background:white';dialog.append(close,frame);document.body.append(dialog);dialog.showModal();
 const win=frame.contentWindow,doc=win.document;doc.documentElement.lang='es';doc.head.replaceChildren();doc.body.replaceChildren();doc.title='Imprimir documento';
 let stopped=false,finished=false,task,renderTask,rejectStop,timer,ticker,url;
 const interrupted=new Promise((_,reject)=>{rejectStop=reject;});interrupted.catch(()=>{});
 const stop=error=>{if(stopped)return;stopped=true;clearTimeout(timer);clearInterval(ticker);rejectStop(error);try{renderTask?.cancel();}catch{}try{task?.destroy().catch(()=>{});}catch{}};
 const hide=()=>{stop(Error('Impresión cerrada.'));if(url)win.URL.revokeObjectURL(url);dialog.close();dialog.remove();};close.onclick=hide;dialog.addEventListener('cancel',event=>{event.preventDefault();hide();});
 const check=()=>{if(stopped||!dialog.isConnected)throw Error('La preparación de impresión se canceló.');};
 const wait=promise=>Promise.race([promise,interrupted]);
 const viewport=doc.createElement('meta');viewport.name='viewport';viewport.content='width=device-width,initial-scale=1';doc.head.append(viewport);
 const style=doc.createElement('style');style.textContent='*{box-sizing:border-box}body{margin:0;background:#e8edf0;font:16px system-ui;color:#192b36}.toolbar{padding:18px;background:white;position:sticky;top:0}button,a{display:inline-block;margin:6px;padding:12px 18px;border:0;border-radius:8px;background:#13775e;color:white;font:inherit;text-decoration:none}button:disabled{opacity:.5}.sheet{display:block;margin:16px auto;background:white;max-width:100%;height:auto}@media print{html,body{margin:0;padding:0;background:white}.toolbar{display:none!important}.sheet{display:block;margin:0;width:100%;max-width:none;break-after:page;page-break-after:always;break-inside:avoid}.sheet:last-child{break-after:auto;page-break-after:auto}}';doc.head.append(style);
 const toolbar=doc.createElement('div');toolbar.className='toolbar';
 const message=doc.createElement('p');message.textContent='Preparando todas las páginas…';message.setAttribute('role','status');
 const started=Date.now(),elapsed=doc.createElement('p');elapsed.id='print-elapsed';elapsed.setAttribute('role','timer');elapsed.setAttribute('aria-live','off');
 const updateElapsed=()=>{const seconds=Math.floor((Date.now()-started)/1000);elapsed.textContent=finished?'Listo en '+seconds+' s':stopped?'Preparación detenida a los '+seconds+' s':'Tiempo transcurrido: '+seconds+' s · límite: 45 s';};updateElapsed();ticker=setInterval(updateElapsed,1000);
 const progress=doc.createElement('progress');progress.setAttribute('aria-label','Progreso de preparación');progress.style.cssText='display:block;width:100%;height:14px;accent-color:#13775e;margin:12px 0';
 const stage=text=>{if(!stopped&&!finished)message.textContent=text;};
 const button=doc.createElement('button');button.textContent='Imprimir';button.disabled=true;button.onclick=()=>win.print();
 const hint=doc.createElement('p');hint.textContent='Selecciona tu impresora en el menú del dispositivo. En iPhone debe ser compatible con AirPrint; en Android puede requerir el servicio de impresión del fabricante. Conecta ambos a la misma red Wi-Fi.';
 toolbar.append(message,progress,elapsed,button,hint);doc.body.append(toolbar);
 const fail=error=>{stop(error);updateElapsed();progress.hidden=true;progress.style.display='none';if(dialog.isConnected){button.disabled=true;doc.querySelectorAll('.sheet').forEach(image=>image.remove());message.textContent=(error.message||'No se pudo preparar la impresión.')+' Puedes cerrar e intentarlo de nuevo, o descargar el PDF si está disponible.';}};
 timer=setTimeout(()=>{if(!finished)fail(Error('La preparación superó 45 segundos.'));},45000);
 return {
  wait,fail,stage,
  async show(blob,filename='documento.pdf'){
   check();stage('Cargando el documento para imprimir…');
   url=window.URL.createObjectURL(blob);const link=doc.createElement('a');link.href=url;link.download=filename;link.textContent='Descargar PDF';toolbar.append(link);
   let downloading=false;link.addEventListener('click',async event=>{
    event.preventDefault();if(downloading)return;downloading=true;link.textContent='Guardando copia privada…';
    try{await archivePDF(blob,module,{documentId});if(!dialog.isConnected)throw Error('Impresión cerrada.');const save=doc.createElement('a');save.href=url;save.download=filename;save.click();}catch(error){message.textContent=error.message;}finally{downloading=false;link.textContent='Descargar PDF';}
   });

   if(usesNativePDFPrinting()){
    // iOS may print the parent page instead of an iframe. Open the actual PDF
    // from an explicit tap after generation, with no HTML or raster conversion.
    const native=doc.createElement('a');native.id='native-pdf-print';native.href=url;native.target='_blank';native.rel='noopener';native.textContent='Abrir PDF para imprimir';toolbar.insertBefore(native,link);
    button.hidden=true;button.style.display='none';finished=true;clearTimeout(timer);clearInterval(ticker);updateElapsed();progress.max=1;progress.value=1;
    message.textContent='PDF listo. Pulsa Abrir PDF para imprimir y, en el visor del iPhone o iPad, usa Compartir → Imprimir.';
    hint.textContent='Se abrirá el PDF original con sus páginas, firmas y anexos. Elige una impresora compatible con AirPrint en la misma red Wi-Fi.';
    return;
   }

   try{await wait((async()=>{
   const pdfjs=await import('./vendor/pdf.mjs');pdfjs.GlobalWorkerOptions.workerSrc=new URL('./vendor/pdf.worker.mjs',import.meta.url).href;
   const bytes=new Uint8Array(await blob.arrayBuffer());check();task=pdfjs.getDocument({data:bytes,standardFontDataUrl:new URL('./vendor/standard_fonts/',import.meta.url).href,cMapUrl:new URL('./vendor/cmaps/',import.meta.url).href,cMapPacked:true});
   let pdf;
   try{
    pdf=await task.promise;progress.max=pdf.numPages;progress.value=0;
    for(let n=1;n<=pdf.numPages;n++){
     check();stage('Preparando página '+n+' de '+pdf.numPages+'…');
     const page=await pdf.getPage(n),size=page.getViewport({scale:1}),viewport=page.getViewport({scale:2});
     if(n===1){const css=doc.createElement('style');css.textContent=`@page{size:${size.width}pt ${size.height}pt;margin:0}`;doc.head.append(css);}
     const canvas=document.createElement('canvas');canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height);renderTask=page.render({canvasContext:canvas.getContext('2d'),viewport});await renderTask.promise;renderTask=null;
     check();
     const image=doc.createElement('img');image.className='sheet';image.alt='Página '+n+' de '+pdf.numPages;image.style.width=size.width+'pt';image.src=canvas.toDataURL('image/png');canvas.width=canvas.height=0;
     doc.body.append(image);await image.decode();check();progress.value=n;page.cleanup();
    }
    check();
    finished=true;clearTimeout(timer);clearInterval(ticker);updateElapsed();
    message.textContent=pdf.numPages+' página(s) listas. Si no se abre el menú, pulsa Imprimir. También puedes descargar el PDF y usar Compartir → Imprimir.';button.disabled=false;
    win.focus();win.print();
   }finally{if(pdf)await pdf.destroy();else if(task)await task.destroy();}
   })());}catch(error){fail(error);throw error;}
  }
 };
}
export function installPDFPrinting(anchor,module,status){
 const button=document.createElement('button');button.type='button';button.id='print-document';button.className='download';button.textContent='Imprimir';anchor.after(button);
 const available=()=>!anchor.hidden&&anchor.style.display!=='none'&&anchor.getAttribute('href')?.startsWith('blob:');
 let cached=null,loadingHref=null,sharing=false,fallback=false;
 const sync=()=>{button.hidden=!available();button.style.display=button.hidden?'none':'block';
  if(!available()){cached=null;return;}
  if(supportsDirectPrinting()&&!fallback){
   const href=anchor.href;button.disabled=sharing||cached?.href!==href;button.textContent=cached?.href===href?'Imprimir':'Preparando PDF para imprimir…';
   if(cached?.href!==href&&loadingHref!==href){loadingHref=href;void fetch(href).then(response=>{if(!response.ok)throw Error();return response.blob();}).then(blob=>{if(anchor.href===href&&available())cached={href,file:new File([blob],anchor.download||'documento.pdf',{type:'application/pdf'})};}).catch(()=>{fallback=true;}).finally(()=>{if(loadingHref===href)loadingHref=null;sync();});}
  }else {button.disabled=sharing;button.textContent='Imprimir';}
 };new MutationObserver(sync).observe(anchor,{attributes:true,attributeFilter:['href','hidden','style']});sync();
 button.addEventListener('click',async()=>{
  if(!available())return;
  if(supportsDirectPrinting()&&!fallback&&cached?.href===anchor.href){
   sharing=true;let result;try{result=shareForPrinting(cached.file);}catch(error){sharing=false;fallback=true;status.textContent='No se pudo abrir el menú. Pulsa Imprimir para usar la alternativa.';sync();return;}
   sync();const outcomes=await Promise.allSettled([result,recordEvent(module,'document_print_requested',{format:'pdf'})]);sharing=false;
   if(outcomes[0].status==='rejected'){if(outcomes[0].reason?.name==='AbortError')status.textContent='Menú cerrado. Puedes volver a imprimir.';else{fallback=true;status.textContent='No se pudo abrir el menú. Pulsa Imprimir para usar la alternativa.';}}
   else status.textContent='En el menú del iPhone elige Imprimir y selecciona tu impresora. La app no confirma la impresión.';
   if(outcomes[1].status==='rejected')status.textContent+=' No se pudo registrar la solicitud.';sync();return;
  }
  let view;const href=anchor.href;button.disabled=true;
  try{view=openPrintWindow({module});const response=await view.wait(fetch(href));if(!response.ok)throw Error('No se pudo preparar el PDF.');const blob=await view.wait(response.blob());await view.wait(recordEvent(module,'document_print_requested',{format:'pdf'}));if(!available()||anchor.href!==href)throw Error('El documento cambió. Actualiza la vista previa y vuelve a imprimir.');await view.show(blob,anchor.download);status.textContent='Se solicitó la impresión. El dispositivo permite seleccionar la impresora; la app no confirma que se haya impreso.';}
  catch(error){view?.fail(error);status.textContent=error.message;}finally{button.disabled=false;sync();}
 });
}
