import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import * as PDFLib from 'pdf-lib';
import {waterDates,validateWater,generateWater} from '../web/water/generator.js';
const template=await readFile('web/water/template.pdf');
const data={account:'000990123',name:'MARÍA LÓPEZ PÉREZ',address:'AVENIDA NUEVA 123, CENTRO, CULIACÁN, SINALOA'};
test('agua: fechas congruentes en noviembre y al cambiar de año',()=>{
 assert.deepEqual(waterDates(new Date('2026-11-16T18:00:00Z')),{issue:'03 NOVIEMBRE 2026',due:'07 NOVIEMBRE 2026',billing:'NOVIEMBRE 2026',currentReading:'03 NOV 2026',previousReading:'03 OCT 2026'});
 const january=waterDates(new Date('2027-01-16T18:00:00Z'));assert.equal(january.previousReading,'03 DIC 2026');assert.equal(january.issue,'03 ENERO 2027');assert.equal(january.due,'07 ENERO 2027');
 assert.equal(waterDates(new Date('2026-11-01T03:00:00Z')).billing,'OCTUBRE 2026');
});
test('agua: nueve dígitos, textos válidos y categoría doméstica fija',()=>{
 for(const patch of [{account:'990123'},{account:'00099012X'},{name:''},{address:''}])assert.throws(()=>validateWater({...data,...patch}));
 assert.equal(validateWater({...data,category:'COMERCIAL'}).category,'DOMÉSTICA');
});
test('agua: exporta una página con datos nuevos y fechas de noviembre',async()=>{
 const bytes=await generateWater(PDFLib,template,data,new Date('2026-11-16T18:00:00Z'));
 assert.equal((await PDFLib.PDFDocument.load(bytes)).getPageCount(),1);
 await mkdir('artifacts/water',{recursive:true});await writeFile('artifacts/water/november.pdf',bytes);
 await assert.rejects(generateWater(PDFLib,template,{...data,name:'😀'}));
});
