import { cp, mkdir, rm } from 'node:fs/promises';
await rm('dist', { recursive: true, force: true });
await mkdir('dist/vendor', { recursive: true });
await cp('web', 'dist', { recursive: true });
await cp('node_modules/pdf-lib/dist/pdf-lib.min.js', 'dist/vendor/pdf-lib.min.js');
for (const name of ['pdf.mjs', 'pdf.worker.mjs']) {
  await cp(`node_modules/pdfjs-dist/legacy/build/${name}`, `dist/vendor/${name}`);
}
for (const name of ['standard_fonts','cmaps']) {
  await cp(`node_modules/pdfjs-dist/${name}`, `dist/vendor/${name}`, {recursive:true});
}
console.log('Sitio estático listo en dist/');
