// Render every page ourselves: iOS's embedded PDF viewer only shows page one.
import * as pdfjsLib from './vendor/pdf.mjs';
pdfjsLib.GlobalWorkerOptions.workerSrc = './vendor/pdf.worker.mjs';
let previewRevision = 0;
export async function renderPreview(bytes) {
  const version = ++previewRevision;
  const task = pdfjsLib.getDocument({data: bytes.slice(),standardFontDataUrl:'./vendor/standard_fonts/',cMapUrl:'./vendor/cmaps/',cMapPacked:true});
  let doc;
  try {
    doc = await task.promise;
    const pages = document.createDocumentFragment();
    for (let number = 1; number <= doc.numPages; number++) {
      const page = await doc.getPage(number);
      const viewport = page.getViewport({scale:2});
      const canvas = document.createElement('canvas');
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      canvas.setAttribute('role','img');
      canvas.setAttribute('aria-label',`Página ${number} de ${doc.numPages} del recibo`);
      await page.render({canvasContext:canvas.getContext('2d'),viewport}).promise;
      const figure = document.createElement('figure');
      figure.className = 'pdf-page';
      const caption = document.createElement('figcaption');
      caption.textContent = `Página ${number} de ${doc.numPages}`;
      figure.append(caption,canvas);
      pages.append(figure);
      page.cleanup();
    }
    if (version === previewRevision) document.querySelector('#preview').replaceChildren(pages);
  } finally {
    if (doc) await doc.destroy();
    else await task.destroy();
  }
}
