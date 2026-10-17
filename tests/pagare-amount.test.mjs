import {test} from 'node:test';
import assert from 'node:assert/strict';
import {formatPagareInput,pagareAmount} from '../web/pagare-amount.js';
import {validateContract} from '../web/word-generator.js';
test('pagaré: comas y letra exacta, con centavos, apócopes y millones',()=>{
 for(const [raw,amount,words]of [
 ['10000','10,000','Diez mil pesos m.n.'],['10,000.5','10,000.50','Diez mil pesos 50/100 m.n.'],
 ['1','1','Un peso m.n.'],['21','21','Veintiún pesos m.n.'],['31000','31,000','Treinta y un mil pesos m.n.'],
 ['1000000','1,000,000','Un millón de pesos m.n.'],['0.01','0.01','Cero pesos 01/100 m.n.'],
 ['999999999.99','999,999,999.99','Novecientos noventa y nueve millones novecientos noventa y nueve mil novecientos noventa y nueve pesos 99/100 m.n.']
 ])assert.deepEqual(pagareAmount(raw),{amount,amountWords:words});
 assert.equal(formatPagareInput('10000.'),'10,000.');assert.equal(formatPagareInput('10000.5'),'10,000.5');
 assert.deepEqual(pagareAmount(''),{amount:'',amountWords:''});
 for(const raw of ['-10','10e3','abc','1.234','1000000000'])assert.throws(()=>pagareAmount(raw));
});
test('el Word deriva la letra del importe para evitar cantidades contradictorias',()=>{
 const contract={id:'pagare',fields:[{key:'amount',label:'Importe'},{key:'amountWords',label:'Letra'}]};
 assert.deepEqual(validateContract(contract,{amount:'10000',amountWords:'Un peso'}),{amount:'10,000',amountWords:'Diez mil pesos m.n.'});
 const blank=validateContract(contract,{amount:'',amountWords:'Diez pesos'});assert.match(blank.amount,/^_+$/);assert.match(blank.amountWords,/^_+$/);
});
