import {test} from 'node:test';
import assert from 'node:assert/strict';
import {extractINEFields,ineTargetFields,ineFieldSelection} from '../web/ine-fields.js';
const front=`INSTITUTO NACIONAL ELECTORAL
CREDENCIAL PARA VOTAR
NOMBRE
PEREZ
GARCIA
ANA MARIA SEXO M
DOMICILIO
CALLE ROBLE 123
COL CENTRO 80000
CULIACAN, SIN.
CLAVE DE ELECTOR PRGRAN90010125M100
CURP PEGX900101MXXAAA00
FECHA DE NACIMIENTO 01/01/1990
VIGENCIA 2025 - 2035`;
test('INE: extrae solo los datos rotulados, sin mezclar sexo, CURP ni vigencia',()=>{
 const result=extractINEFields(front);
 assert.equal(result.name,'PEREZ GARCIA ANA MARIA');
 assert.equal(extractINEFields(front.replace('NOMBRE\n','NOMBRE SEXO M\n')).name,'PEREZ GARCIA ANA MARIA');
 assert.equal(result.address,'CALLE ROBLE 123\nCOL CENTRO 80000\nCULIACAN, SIN.');
 assert.equal(result.identification,'');
 assert.deepEqual(extractINEFields('FOTO BORROSA\n123456789\nCURP PEGX900101MXXAAA00'),{name:'',address:'',identification:''});
});
test('INE: etiquetas en una línea, CIC explícito y datos incompletos',()=>{
 assert.deepEqual(extractINEFields('N0MBRE: ANA PEREZ\nDOMICILI0: CALLE 5\nVIGENCIA 2035'),{name:'ANA PEREZ',address:'CALLE 5',identification:''});
 assert.equal(extractINEFields('CIC: 123456789\nOCR 987654321',{face:'back'}).identification,'INE, CIC: 123456789');
 assert.equal(extractINEFields('OCR 987654321').identification,'');
});
test('INE: vendedor y comprador se asignan a su persona en los siete documentos',()=>{
 for(const id of ['ratificado-soltero','ratificado-separacion','ratificado-sociedad','sin-ratificar-soltero','sin-ratificar-separacion','sin-ratificar-sociedad']){
  assert.deepEqual(ineTargetFields(id,'seller'),{name:'seller',address:'sellerAddress',identification:'sellerId'});
  assert.deepEqual(ineTargetFields(id,'buyer'),{name:'buyer',address:'buyerAddress',identification:'buyerId'});
 }
 assert.deepEqual(ineTargetFields('pagare','seller'),{name:'subscriber',address:'subscriberAddress'});
 assert.deepEqual(ineTargetFields('pagare','buyer'),{name:'beneficiary',address:'beneficiaryAddress'});
});

test('reverso: CIC desde MRZ, sin incluir dígito verificador; OCR solo cuando está rotulado',()=>{
 assert.equal(extractINEFields('IDMEX1234567890<<1234567890123',{face:'back'}).identification,'INE, CIC: 123456789');
 assert.equal(extractINEFields('OCR: 1234567890123',{face:'back'}).identification,'INE, OCR: 1234567890123');
 assert.equal(extractINEFields('CLAVE DE ELECTOR PRGRAN90010125M100\nCURP PEGX900101MXXAAA00',{face:'back'}).identification,'');
});

test('INE: rechaza números como nombre y fragmentos sueltos del domicilio',()=>{
 const text='NOMBRE\n400 1932 GUERRERO GUEVARA\nDOMICILIO\nLA\nION SAN GABRIEL ARCANGEL 2625\nO\nCURP ABCD';
 const fields=extractINEFields(text);assert.equal(fields.name,'');assert.equal(fields.address,'ION SAN GABRIEL ARCANGEL 2625');
 assert.deepEqual(ineFieldSelection({...fields,name:'GUERRERO GUEVARA'},{text,confidence:95}),{name:false,address:true,identification:false});
 for(const metadata of [{confidence:95,needsCrop:true},{confidence:65}])assert.ok(Object.values(ineFieldSelection({name:'ANA PEREZ',address:'CALLE ROBLE 123',identification:''},metadata)).every(value=>value===false));
});
