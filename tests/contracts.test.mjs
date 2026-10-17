import PizZip from 'pizzip';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {validateContract,groupINEPhotos} from '../web/word-generator.js';
const catalog=JSON.parse(await readFile(new URL('../web/contracts-catalog.json',import.meta.url),'utf8'));
test('las ocho plantillas permiten dejar todos los datos pendientes como líneas imprimibles',()=>{
 assert.equal(catalog.length,8);
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

test('anexos: una hoja por persona, frente antes del reverso aunque se suban en otro orden',()=>{
 const photos=[{person:'buyer',face:'back'},{person:'seller',face:'back'},{person:'buyer',face:'front'},{person:'seller',face:'front'}];
 const groups=groupINEPhotos(photos,'ratificado-soltero');
 assert.deepEqual(groups.map(group=>group.title),['Vendedor','Comprador']);
 for(const group of groups)assert.deepEqual(group.photos.map(photo=>photo.face),['front','back']);
 assert.equal(groupINEPhotos([{person:'seller',face:'back'}],'pagare')[0].title,'Suscriptor');
});

test('contratos de cliente: sin guía interna, con cláusulas, firmas y originales conservados',async()=>{
 for(const item of catalog.filter(item=>['Ratificados','Sin ratificar'].includes(item.group))){
  const original=new PizZip(await readFile('data/contracts/'+item.id+'.docx')).file('word/document.xml').asText();
  const prepared=new PizZip(await readFile('web/'+item.template)).file('word/document.xml').asText();
  assert.ok(original.includes('DATOS A COMPLETAR ANTES DE FIRMAR'),item.id);
  assert.ok(!prepared.includes('DATOS A COMPLETAR ANTES DE FIRMAR'),item.id);
  assert.ok(!prepared.includes('Los campos resaltados en amarillo'),item.id);
  assert.ok(prepared.includes('{seller}')&&prepared.includes('{buyer}'),item.id);
  assert.ok(prepared.includes('EL PROMITENTE VENDEDOR'),item.id);
  if(item.group==='Ratificados')assert.ok(prepared.includes('{notary}'),item.id);
  assert.ok(!item.fields.some(field=>['refundDays','thirdPartyDays'].includes(field.key)),item.id);
 }
});

test('recibo de apartado: importes y letra congruentes, campos vacíos y cláusulas del original',async()=>{
 const item=catalog.find(item=>item.id==='recibo-apartado');assert.ok(item);
 const values=validateContract(item,{deposit:'10000',depositWords:'INCORRECTO',price:'500000.50',penalty:'0',buyer:'ANA PÉREZ'});
 assert.equal(values.deposit,'10,000');assert.equal(values.depositWords,'Diez mil pesos m.n.');assert.equal(values.priceWords,'Quinientos mil pesos 50/100 m.n.');assert.equal(values.penaltyWords,'Cero pesos m.n.');assert.equal(values.buyer,'ANA PÉREZ');assert.match(values.seller,/^_+$/);
 const xml=new PizZip(await readFile('web/'+item.template)).file('word/document.xml').asText();
 for(const field of item.fields)assert.ok(xml.includes('{'+field.key+'}'),field.key);
 for(const phrase of ['RECIBO DE APARTADO COMPRA VENTA','PENALIZACIÓN','gastos administrativos y de comercialización','reanudar la venta de la propiedad','Entrega','Recibe'])assert.ok(xml.includes(phrase));
 assert.ok((await readFile('data/originals/recibo-apartado.pdf')).subarray(0,5).toString()==='%PDF-');
});
