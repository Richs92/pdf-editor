import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import * as PDFLib from 'pdf-lib';
import {bankDates,validateBank,generateBank} from '../web/bank/generator.js';
const template=await readFile('web/bank/template.pdf'),defaults=JSON.parse(await readFile('web/bank/defaults.json','utf8'));
test('BanBajío: mes anterior completo, diciembre, enero y febrero bisiesto',()=>{
 for(const [date,year,month,days,yearDays]of [['2026-11-17T18:00:00Z',2026,10,'31','304'],['2026-12-01T18:00:00Z',2026,11,'30','334'],['2027-01-01T18:00:00Z',2026,12,'31','365'],['2028-03-01T18:00:00Z',2028,2,'29','60'],['2027-03-01T18:00:00Z',2027,2,'28','59']]){
  const result=bankDates(new Date(date));assert.deepEqual([result.year,result.month,result.days,result.yearDays],[year,month,days,yearDays]);
 }
 assert.equal(bankDates(new Date('2026-11-01T03:00:00Z')).month,9,'Todavía es octubre en Mazatlán');
});
test('BanBajío: identidad, RFC y cuentas validados sin perder ceros iniciales',()=>{
 assert.equal(validateBank(defaults).client,'049990369');
 for(const patch of [{client:'123'},{account:'123'},{clabe:'12'},{rfc:'INVALIDO'},{address:'a\nb\nc\nd\ne'}])assert.throws(()=>validateBank({...defaults,...patch}));
});
test('BanBajío: una hoja, campos repetidos y marca de copia editada',async()=>{
 await mkdir('artifacts/bank',{recursive:true});
 const bytes=await generateBank(PDFLib,template,{...defaults,name:'NOMBRE SINTÉTICO DE PRUEBA',address:'CALLE DE PRUEBA 123\nCOLONIA CENTRO\nCULIACÁN, SIN.\nC.P. 80000',client:'001234567',rfc:'XAXX010101000',account:'0012345678901',clabe:'030730000000000001'},new Date('2026-11-17T18:00:00Z'));
 assert.equal((await PDFLib.PDFDocument.load(bytes)).getPageCount(),1);await writeFile('artifacts/bank/noviembre.pdf',bytes);
});
