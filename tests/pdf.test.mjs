import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import * as PDFLib from 'pdf-lib';
import { generatePDF } from '../web/pdf-editor.js';
const template = await readFile('web/template-clean.pdf');
const values = {name:'MARÍA LÓPEZ',address:'CALLE NUEVA 123\nCOLONIA CENTRO\nMAZATLÁN, SINALOA',service:'123456789012'};
test('genera un PDF de dos páginas con campos nuevos', async () => {
  const bytes = await generatePDF(PDFLib,template,values);
  const doc = await PDFLib.PDFDocument.load(bytes);
  assert.equal(doc.getPageCount(),2);
  await mkdir('artifacts',{recursive:true});
  await writeFile('artifacts/test-generated.pdf',bytes);
});
test('rechaza datos inválidos',async () => {
  for(const patch of [{name:''},{name:'😀'},{service:'123'},{service:'１２３４５６７８９０１２'},{address:'a\nb\nc\nd\ne'}]) {
    await assert.rejects(generatePDF(PDFLib,template,{...values,...patch}));
  }
});
