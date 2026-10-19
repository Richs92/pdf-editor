// Preview the actual export, so typography and page breaks match the printed PDF.
export async function contractPDFPreview(blob,container,isCurrent){
 const lib=await import('./vendor/pdf.mjs');lib.GlobalWorkerOptions.workerSrc=new URL('./vendor/pdf.worker.mjs',import.meta.url).href;
 const task=lib.getDocument({data:new Uint8Array(await blob.arrayBuffer()),standardFontDataUrl:new URL('./vendor/standard_fonts/',import.meta.url).href,cMapUrl:new URL('./vendor/cmaps/',import.meta.url).href,cMapPacked:true});
 let pdf;
 try{
  pdf=await task.promise;const fragment=document.createDocumentFragment();
  for(let n=1;n<=pdf.numPages;n++){
   if(!isCurrent())return;
   const page=await pdf.getPage(n),size=page.getViewport({scale:96/72}),viewport=page.getViewport({scale:1.8});
   const holder=document.createElement('div');holder.className='word-sheet';const section=document.createElement('section');section.className='docx pdf-export-sheet';section.style.width=size.width+'px';section.style.height=size.height+'px';
   const canvas=document.createElement('canvas');canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height);canvas.style.cssText='display:block;width:100%;height:100%';canvas.setAttribute('role','img');canvas.setAttribute('aria-label','Página '+n+' de '+pdf.numPages);
   await page.render({canvasContext:canvas.getContext('2d'),viewport}).promise;
   const text=document.createElement('span');text.className='pdf-accessible-text';text.textContent=(await page.getTextContent()).items.map(item=>item.str).join(' ').replace(/\s+/g,' ');section.append(canvas,text);holder.append(section);fragment.append(holder);page.cleanup();
  }
  if(isCurrent()){const scroll=container.scrollTop;container.replaceChildren(fragment);container.scrollTop=scroll;}
 }finally{if(pdf)await pdf.destroy();else await task.destroy();}
}
