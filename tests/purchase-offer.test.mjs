import test from 'node:test';import assert from 'node:assert/strict';import PizZip from 'pizzip';import {readFile} from 'node:fs/promises';import {purchaseOfferAmounts} from '../web/purchase-offer.js';import {validateContract} from '../web/word-generator.js';
const catalog=JSON.parse(await readFile('web/contracts-catalog.json')),item=catalog.find(x=>x.id==='propuesta-compra');
test('propuesta: saldo exacto en centavos, importes y recibo independientes',()=>{
 const data=purchaseOfferAmounts({price:'1400000.10',deposit:'20000.05',earnest:'10000',receiptAmount:'5000'});assert.equal(data.balance,'1,380,000.05');assert.equal(data.receiptAmount,'5,000');assert.equal(data.earnest,'10,000');assert.equal(purchaseOfferAmounts({price:'0',deposit:'0'}).balance,'0.00');assert.equal(purchaseOfferAmounts({price:'1000'}).balance,'');assert.throws(()=>purchaseOfferAmounts({price:'100',deposit:'101'}),/anticipo/);
});
test('propuesta: todos los campos, cuatro secciones y sin datos de ejemplo',async()=>{
 const xml=new PizZip(await readFile('web/'+item.template)).file('word/document.xml').asText();for(const field of item.fields)assert.ok(xml.includes('{'+field.key+'}'),field.key);
 for(const title of ['PROPUESTA DE INTENCIÓN DE COMPRA','RESOLUCIÓN DEL PROPIETARIO','RECIBO OTORGADO','RECEPCIÓN DE LA ACEPTACIÓN'])assert.ok(xml.includes(title));
 for(const pii of ['Rodriguez Zazueta','Meza Ontiveros','Enriquez Cabral','Guerrero Guevara','Lago Baikal','Rinconada del Iris','6674360549','diciembre de 2024'])assert.ok(!xml.includes(pii),pii);
 const values=validateContract(item,{buyer:'COMPRADOR DE PRUEBA',price:'1000',deposit:'100',balance:'999',receiptPayer:'PERSONA DISTINTA'});assert.equal(values.balance,'900.00');assert.equal(values.buyer,'COMPRADOR DE PRUEBA');assert.equal(values.receiptPayer,'PERSONA DISTINTA');assert.match(values.seller,/^_+$/);
});
