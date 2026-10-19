import {test} from 'node:test';import assert from 'node:assert/strict';import {commissionTerms} from '../web/exclusiva-terms.js';import {validateContract} from '../web/word-generator.js';import {readFile} from 'node:fs/promises';
const catalog=JSON.parse(await readFile('web/contracts-catalog.json'));
test('comisión: porcentaje, decimales con punto o coma, letra y límites',()=>{
 assert.deepEqual(commissionTerms(''),{commission:'',commissionWords:''});assert.equal(commissionTerms('5').commissionWords,'Cinco por ciento');assert.equal(commissionTerms('7,5').commissionWords,'Siete punto cinco por ciento');assert.equal(commissionTerms('0.05').commissionWords,'Cero punto cero cinco por ciento');assert.equal(commissionTerms('100').commissionWords,'Cien por ciento');for(const value of ['-1','101','5.001','cinco','Infinity'])assert.throws(()=>commissionTerms(value),/Comisión/);
});
test('ambas exclusivas: defaults, vigencia opcional, comisión derivada y plazos restantes conservados',()=>{
 for(const item of catalog.filter(c=>c.group==='Exclusiva')){
  assert.equal(item.fields.find(f=>f.key==='commission').default,'5');assert.equal(item.fields.find(f=>f.key==='durationDays').default,'90');
  const values=validateContract(item,{commission:'6.5',commissionWords:'Cinco por ciento',durationDays:'120'});assert.equal(values.commissionWords,'Seis punto cinco por ciento');assert.equal(values.durationDays,'120');assert.match(validateContract(item,{}).durationDays,/^_+$/);assert.throws(()=>validateContract(item,{durationDays:'0'}),/al menos/);
 }
});
