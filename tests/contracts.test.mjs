import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {validateContract} from '../web/word-generator.js';
const catalog=JSON.parse(await readFile(new URL('../web/contracts-catalog.json',import.meta.url),'utf8'));
test('las siete plantillas permiten dejar todos los datos pendientes como líneas imprimibles',()=>{
 assert.equal(catalog.length,7);
 for(const item of catalog){
  const values=validateContract(item,{});
  assert.deepEqual(Object.keys(values),item.fields.map(field=>field.key));
  for(const field of item.fields)assert.match(values[field.key],/^_{4,40}$/,item.id+': '+field.key);
 }
});
test('datos parciales: conserva lo escrito, incluyendo cero, y deja líneas solo en campos vacíos',()=>{
 const item={fields:[{key:'name',label:'Nombre',type:'text'},{key:'days',label:'Días',type:'number'},{key:'address',label:'Domicilio',type:'textarea'},{key:'emptyNumber',label:'Días pendientes',type:'number'}]};
 const values=validateContract(item,{name:'  ANA PÉREZ  ',days:0,address:'   '});
 assert.equal(values.name,'ANA PÉREZ');assert.equal(values.days,'0');assert.match(values.address,/^_+$/);assert.match(values.emptyNumber,/^_+$/);
 assert.throws(()=>validateContract(item,{days:'dos'}),/número entero/);
 assert.throws(()=>validateContract(item,{name:'x'.repeat(4001)}),/Revisa/);
});
