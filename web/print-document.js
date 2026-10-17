import {recordEvent} from './session.js';
// Open synchronously during the click so mobile browsers can allow the window.
export function openPrintWindow(){
 const win=window.open('','_blank');
 if(!win)throw Error('Permite las ventanas emergentes para abrir la impresión. También puedes descargar el PDF e imprimirlo desde Archivos.');
 const doc=win.document;doc.title='Imprimir documento';doc.documentElement.lang='es';doc.head.replaceChildren();doc.body.replaceChildren();
 const viewport=doc.createElement('meta');viewport.name='viewport';viewport.content='width=device-width,initial-scale=1';doc.head.append(viewport);
 const style=doc.createElement('style');style.textContent='*{box-sizing:border-box}body{margin:0;background:#e8edf0;font:16px system-ui;color:#192b36}.toolbar{padding:18px;background:white;position:sticky;top:0}button,a{display:inline-block;margin:6px;padding:12px 18px;border:0;border-radius:8px;background:#13775e;color:white;font:inherit;text-decoration:none}button:disabled{opacity:.5}.sheet{display:block;margin:16px auto;background:white;max-width:100%;height:auto}@media print{html,body{margin:0;padding:0;background:white}.toolbar{display:none!important}.sheet{display:block;margin:0;width:100%;max-width:none;break-after:page;page-break-after:always;break-inside:avoid}.sheet:last-child{break-after:auto;page-break-after:auto}}';doc.head.append(style);
 const toolbar=doc.createElement('div');toolbar.className='toolbar';
 const message=doc.createElement('p');message.textContent='Preparando todas las páginas…';message.setAttribute('role','status');
 const button=doc.createElement('button');button.textContent='Imprimir';button.disabled=true;button.onclick=()=>win.print();
 const hint=doc.createElement('p');hint.textContent='Selecciona tu impresora en el menú del dispositivo. En iPhone debe ser compatible con AirPrint; en Android puede requerir el servicio de impresión del fabricante. Conecta ambos a la misma red Wi-Fi.';
 toolbar.append(message,button,hint);doc.body.append(toolbar);
 return {
  fail(error){if(!win.closed)message.textContent=error.message||'No se pudo preparar la impresión. Descarga el PDF para imprimirlo.';},
  async show(blob,filename='documento.pdf'){
   if(win.closed)return;
   const pdfjs=await import('./vendor/pdf.mjs');pdfjs.GlobalWorkerOptions.workerSrc=new URL('./vendor/pdf.worker.mjs',import.meta.url).href;
   const task=pdfjs.getDocument({data:new Uint8Array(await blob.arrayBuffer()),standardFontDataUrl:new URL('./vendor/standard_fonts/',import.meta.url).href,cMapUrl:new URL('./vendor/cmaps/',import.meta.url).href,cMapPacked:true});
   let pdf;
   try{
    pdf=await task.promise;
    for(let n=1;n<=pdf.numPages;n++){
     if(win.closed)return;
     const page=await pdf.getPage(n),size=page.getViewport({scale:1}),viewport=page.getViewport({scale:2});
     if(n===1){const css=doc.createElement('style');css.textContent=`@page{size:${size.width}pt ${size.height}pt;margin:0}`;doc.head.append(css);}
     const canvas=document.createElement('canvas');canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height);await page.render({canvasContext:canvas.getContext('2d'),viewport}).promise;
     if(win.closed)return;
     const image=doc.createElement('img');image.className='sheet';image.alt='Página '+n+' de '+pdf.numPages;image.style.width=size.width+'pt';image.src=canvas.toDataURL('image/png');canvas.width=canvas.height=0;
     doc.body.append(image);await image.decode();page.cleanup();
    }
    if(win.closed)return;
    const url=win.URL.createObjectURL(blob),link=doc.createElement('a');link.href=url;link.download=filename;link.textContent='Descargar PDF';toolbar.append(link);win.addEventListener('pagehide',()=>win.URL.revokeObjectURL(url),{once:true});
    message.textContent=pdf.numPages+' página(s) listas. Si no se abre el menú, pulsa Imprimir. También puedes descargar el PDF y usar Compartir → Imprimir.';button.disabled=false;
    win.focus();win.print();
   }finally{if(pdf)await pdf.destroy();else await task.destroy();}
  }
 };
}
export function installPDFPrinting(anchor,module,status){
 const button=document.createElement('button');button.type='button';button.id='print-document';button.className='download';button.textContent='Imprimir';anchor.after(button);
 const available=()=>!anchor.hidden&&anchor.style.display!=='none'&&anchor.getAttribute('href')?.startsWith('blob:');
 const sync=()=>{button.hidden=!available();button.style.display=button.hidden?'none':'block';};new MutationObserver(sync).observe(anchor,{attributes:true,attributeFilter:['href','hidden','style']});sync();
 button.addEventListener('click',async()=>{
  if(!available())return;let view;const href=anchor.href;button.disabled=true;
  try{view=openPrintWindow();const response=await fetch(href);if(!response.ok)throw Error('No se pudo preparar el PDF.');const blob=await response.blob();await recordEvent(module,'document_print_requested',{format:'pdf'});if(!available()||anchor.href!==href)throw Error('El documento cambió. Actualiza la vista previa y vuelve a imprimir.');await view.show(blob,anchor.download);status.textContent='Se solicitó la impresión. El dispositivo permite seleccionar la impresora; la app no confirma que se haya impreso.';}
  catch(error){view?.fail(error);status.textContent=error.message;}finally{button.disabled=false;sync();}
 });
}
