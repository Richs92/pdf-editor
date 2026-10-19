import PizZip from 'pizzip';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {validateContract,groupINEPhotos} from '../web/word-generator.js';
const catalog=JSON.parse(await readFile(new URL('../web/contracts-catalog.json',import.meta.url),'utf8'));
test('las diez plantillas permiten dejar todos los datos pendientes como líneas imprimibles',()=>{
 assert.equal(catalog.length,10);
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
 const receipt=groupINEPhotos(photos,'recibo-apartado');
 assert.deepEqual(receipt.map(group=>group.title),['Comprador','Asesor/vendedor']);
 assert.deepEqual(receipt.map(group=>group.person),['buyer','seller']);
 for(const group of receipt)assert.deepEqual(group.photos.map(photo=>photo.face),['front','back']);
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

test('exclusiva: nueve cláusulas, fundamentos conservados y campos opcionales',async()=>{
 const item=catalog.find(item=>item.id==='contrato-exclusiva');assert.ok(item);
 const xml=new PizZip(await readFile('web/'+item.template)).file('word/document.xml').asText();
 for(const key of item.fields.map(field=>field.key))assert.ok(xml.includes('{'+key+'}'),key);
 for(const clause of ['PRIMERA','SEGUNDA','TERCERA','CUARTA','QUINTA','SEXTA','SÉPTIMA','OCTAVA','NOVENA'])assert.ok(xml.includes(clause),clause);
 for(const text of ['Artículo 24','Fracción XVI','{durationDays}','{commission}','{commissionWords}','16%','60 días','90 días','50%','3%'])assert.ok(xml.includes(text),text);
 const filled=validateContract(item,{buyer:'CLIENTE DE PRUEBA',seller:'PROFESIONAL DE PRUEBA',price:'1250000.50'});assert.equal(filled.price,'1,250,000.50');assert.equal(filled.priceWords,'Un millón doscientos cincuenta mil pesos 50/100 m.n.');assert.match(filled.folio,/^_+$/);
 assert.deepEqual(groupINEPhotos([{person:'seller',face:'front'},{person:'buyer',face:'back'}],item.id).map(group=>group.title),['Cliente','Profesional']);
});

test('exclusiva dos propietarios: parte cliente conjunta, campos y anexos separados',async()=>{
 const item=catalog.find(item=>item.id==='contrato-exclusiva-dos');assert.ok(item);const xml=new PizZip(await readFile('web/'+item.template)).file('word/document.xml').asText();
 for(const field of item.fields)assert.ok(xml.includes('{'+field.key+'}'),field.key);
 assert.ok(xml.includes('CONJUNTAMENTE COMO'));assert.ok(xml.includes('legítimos copropietarios'));for(const person of ['buyer','buyer2','seller'])assert.ok(xml.includes('TerminavitSignature_'+person));
 const groups=groupINEPhotos([{person:'seller',face:'front'},{person:'buyer2',face:'back'},{person:'buyer2',face:'front'},{person:'buyer',face:'front'}],item.id);assert.deepEqual(groups.map(g=>g.title),['Propietario 1','Propietario 2','Profesional']);assert.deepEqual(groups[1].photos.map(p=>p.face),['front','back']);
 const values=validateContract(item,{buyer:'PRIMER PROPIETARIO',buyer2:'SEGUNDO PROPIETARIO',price:'1000000'});assert.equal(values.priceWords,'Un millón de pesos m.n.');assert.equal(values.buyer2,'SEGUNDO PROPIETARIO');
 const original=catalog.find(item=>item.id==='contrato-exclusiva');assert.ok(!original.fields.some(f=>f.key==='buyer2'));
});

test('exclusivas: cuerpo Arial 11, interlineado amplio, márgenes y encabezados separados',async()=>{
 for(const id of ['contrato-exclusiva','contrato-exclusiva-dos']){
  const zip=new PizZip(await readFile('web/templates/'+id+'.docx')),styles=zip.file('word/styles.xml').asText(),doc=zip.file('word/document.xml').asText();
  const normal=styles.match(/<w:style\b[^>]*w:styleId="Normal"[\s\S]*?<\/w:style>/)[0];assert.match(normal,/w:ascii="Arial"/);assert.match(normal,/w:sz w:val="22"/);assert.match(normal,/w:line="312"/);assert.match(doc,/w:left="1152"/);assert.ok(doc.includes('PRESTACIÓN DE SERVICIOS INMOBILIARIOS'));assert.ok(doc.includes('w:keepNext'));
 }
});
