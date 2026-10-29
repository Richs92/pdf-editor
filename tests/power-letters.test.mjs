import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import PizZip from 'pizzip';
import {validateContract,groupINEPhotos} from '../web/word-generator.js';
import {powerLetterPeople} from '../web/power-letters.js';
const catalog=JSON.parse(await readFile('web/contracts-catalog.json'));
test('cartas poder: campos del original, sin datos personales y participantes correctos',async()=>{
 for(const id of ['carta-poder-cfe','carta-poder-japac']){
  const item=catalog.find(c=>c.id===id),xml=new PizZip(await readFile('web/'+item.template)).file('word/document.xml').asText();
  for(const f of item.fields)assert.ok(xml.includes('{'+f.key+'}'),id+': '+f.key);
  for(const old of ['Morga Tapia','Guerrero Guevara','LARA FIERROS','ESPINOZA ZAZUETA','1214079148947','2829161582','000258829','5621'])assert.ok(!xml.includes(old));
  const values=validateContract(item,{seller:'OTORGANTE DE PRUEBA',buyer:'AUTORIZADO DE PRUEBA',sellerId:'001234',account:'000123456'});assert.equal(values.sellerId,'001234');assert.equal(values.seller,'OTORGANTE DE PRUEBA');assert.equal(values.buyer,'AUTORIZADO DE PRUEBA');
  const people=powerLetterPeople(id);assert.equal(people.length,id==='carta-poder-cfe'?4:2);
  const photos=people.flatMap(([person])=>[{person,face:'back'},{person,face:'front'}]).reverse();
  const grouped=groupINEPhotos(photos,id);assert.deepEqual(grouped.map(x=>x.title),people.map(x=>x[1]));for(const g of grouped)assert.deepEqual(g.photos.map(x=>x.face),['front','back']);
  if(id.endsWith('japac')){assert.equal(values.account,'000123456');assert.ok(xml.includes('PODER AMPLIO'));assert.ok(!item.fields.some(f=>f.key.startsWith('witness')));}else{assert.ok(xml.includes('mi documento de identificación'));for(const key of ['witness1','witness2'])assert.match(values[key],/^_+$/);}
 }
});
