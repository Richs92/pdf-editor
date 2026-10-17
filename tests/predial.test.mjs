import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import * as PDFLib from 'pdf-lib';
import {generatePredial,validatePredial,moneyWords} from '../web/predial/generator.js';
import {predialFields} from '../web/predial/fields.js';
const defaults=JSON.parse(await readFile('web/predial/defaults.json','utf8'));
const template=await readFile('web/predial/template.pdf');
const data={...defaults,cadastre:'007-012-034-056-078-001',name:'MARÍA LÓPEZ PÉREZ',address:'AVENIDA NUEVA 123, COLONIA CENTRO, CULIACÁN, SINALOA, CP 80000',expiry:'2026-11-30'};
test('cada campo tiene exactamente dos posiciones en la plantilla',()=>{
 for(const key of ['cadastre','name','address','expiry','total','totalWords','terrain','construction'])assert.equal(predialFields.filter(field=>field.key===key).length,2);
});
test('valida clave, fecha y edición opcional explícita',()=>{
 for(const patch of [{cadastre:'008-012-034-056-078-001'},{cadastre:'007-012-034-056-078-002'},{cadastre:'007-12-034-056-078-001'},{expiry:'2026-02-30'},{name:''},{editTotal:true,total:'1,000.00'},{editTerrain:true,terrain:'-1'}])assert.throws(()=>validatePredial({...data,...patch}));
 assert.equal(validatePredial({...data,total:'INVALIDO',editTotal:false}).total,undefined);
});
test('importe en letra coincide con el total y sus centavos',()=>{
 for(const [amount,expected] of [['46504.00','CUARENTA Y SEIS MIL QUINIENTOS CUATRO PESOS 00/100 M.N.'],['12500.01','DOCE MIL QUINIENTOS PESOS 01/100 M.N.'],['1.00','UN PESO 00/100 M.N.'],['21.25','VEINTIÚN PESOS 25/100 M.N.'],['1000000.00','UN MILLÓN DE PESOS 00/100 M.N.']])assert.equal(moneyWords(amount),expected);
});
test('genera ambas copias con campos obligatorios y conserva los opcionales',async()=>{
 await mkdir('artifacts/predial',{recursive:true});
 const bytes=await generatePredial(PDFLib,template,data);assert.equal((await PDFLib.PDFDocument.load(bytes)).getPageCount(),1);
 await writeFile('artifacts/predial/required.pdf',bytes);
});
test('genera ambas copias con todos los campos opcionales activados',async()=>{
 const bytes=await generatePredial(PDFLib,template,{...data,editTotal:true,total:'12500.01',editTerrain:true,terrain:'321.50',editConstruction:true,construction:'88.75'});
 await mkdir('artifacts/predial',{recursive:true});await writeFile('artifacts/predial/optional.pdf',bytes);
});
