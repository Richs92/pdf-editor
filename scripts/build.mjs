import { cp, mkdir, rm } from 'node:fs/promises';
import {dirname} from 'node:path';
await rm('dist', { recursive: true, force: true });
await mkdir('dist/vendor', { recursive: true });
await cp('web', 'dist', { recursive: true });
await cp('node_modules/pdf-lib/dist/pdf-lib.min.js', 'dist/vendor/pdf-lib.min.js');
await cp('node_modules/@pdf-lib/fontkit/dist/fontkit.umd.min.js', 'dist/vendor/fontkit.umd.min.js');
for (const name of ['pdf.mjs', 'pdf.worker.mjs']) {
  await cp(`node_modules/pdfjs-dist/legacy/build/${name}`, `dist/vendor/${name}`);
}
for (const name of ['standard_fonts','cmaps']) {
  await cp(`node_modules/pdfjs-dist/${name}`, `dist/vendor/${name}`, {recursive:true});
}
for (const [source,target] of [['pizzip/dist/pizzip.min.js','pizzip.min.js'],['jszip/dist/jszip.min.js','jszip.min.js'],['docx-preview/dist/docx-preview.min.js','docx-preview.min.js'],['pdfmake/build/pdfmake.min.js','pdfmake.min.js']]) {
  await cp('node_modules/'+source, 'dist/vendor/'+target);
}
// Ship OCR locally: no CDN requests and no IndexedDB language/image cache.
await mkdir('dist/vendor/ocr',{recursive:true});
for(const file of ['tesseract.esm.min.js','worker.min.js','tesseract.min.js.LICENSE.txt','worker.min.js.LICENSE.txt'])await cp('node_modules/tesseract.js/dist/'+file,'dist/vendor/ocr/'+file);
for(const file of ['tesseract-core-lstm.wasm.js','tesseract-core-lstm.wasm'])await cp('node_modules/tesseract.js-core/'+file,'dist/vendor/ocr/'+file);
await cp('node_modules/tesseract.js-core/LICENSE','dist/vendor/ocr/core-LICENSE');
await cp('node_modules/tesseract.js/LICENSE.md','dist/vendor/ocr/tesseract-LICENSE.md');

await cp('node_modules/@tesseract.js-data/spa/4.0.0_best_int/spa.traineddata.gz','dist/vendor/ocr/spa.traineddata.gz');
// Personal templates and module entry pages are served only after server auth.
await rm('netlify/private-assets',{recursive:true,force:true});
await mkdir('netlify/private-assets',{recursive:true});
const privateFiles=['contracts.html','contracts-catalog.json','templates','predial.html','predial/template.pdf','predial/defaults.json','predial/fields.js','water.html','water/template.pdf','water/defaults.json','template-clean.pdf','defaults.json'];
for(const path of privateFiles){
  await mkdir(dirname('netlify/private-assets/'+path),{recursive:true});
  await cp('dist/'+path,'netlify/private-assets/'+path,{recursive:true});
  await rm('dist/'+path,{recursive:true,force:true});
}
await cp('dist/index.html','netlify/private-assets/cfe.html');
await cp('web/home.html','dist/index.html');
await rm('dist/home.html',{force:true});
console.log('Home público en dist/; plantillas y secciones protegidas en netlify/private-assets/.');
