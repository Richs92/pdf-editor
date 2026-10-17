import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import * as PDFLib from 'pdf-lib';
import { generatePDF } from '../web/pdf-editor.js';
const template = await readFile('web/template-clean.pdf');
const values = {name:'MARÍA LÓPEZ',address:'CALLE NUEVA 123\nCOLONIA CENTRO\nMAZATLÁN, SINALOA',service:'123456789012',rfc:'XAXX010101000',businessName:'COMERCIALIZADORA DEL PACÍFICO SA DE CV',taxRegime:'601',postalCode:'80014'};
test('genera un PDF de dos páginas con campos nuevos', async () => {
  const bytes = await generatePDF(PDFLib,template,values,new Date('2026-11-16T18:00:00Z'));
  const doc = await PDFLib.PDFDocument.load(bytes);
  assert.equal(doc.getPageCount(),2);
  await mkdir('artifacts',{recursive:true});
  await writeFile('artifacts/test-generated.pdf',bytes);
});
test('rechaza datos inválidos',async () => {
  for(const patch of [{name:''},{name:'😀'},{rfc:'INVALIDO'},{businessName:'😀'},{taxRegime:''},{taxRegime:'😀'},{taxRegime:'a'.repeat(151)},{taxRegime:'a\nb'},{postalCode:'8001'},{service:'123'},{service:'１２３４５６７８９０１２'},{address:'a\nb\nc\nd\ne'}]) {
    await assert.rejects(generatePDF(PDFLib,template,{...values,...patch}));
  }
});

test('acepta el régimen de salarios y nombres personalizados', async () => {
  for (const taxRegime of ['Sueldos y Salarios e Ingresos Asimilados a Salarios', 'Régimen Simplificado de Confianza']) {
    const bytes = await generatePDF(PDFLib,template,{...values,taxRegime},new Date('2026-11-16T18:00:00Z'));
    const filename = taxRegime.startsWith('Sueldos') ? 'salary' : 'custom';
    await mkdir('artifacts',{recursive:true});
    await writeFile(`artifacts/regime-${filename}.pdf`,bytes);
    assert.equal((await PDFLib.PDFDocument.load(bytes)).getPageCount(),2);
  }
});
