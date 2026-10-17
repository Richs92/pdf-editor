import {test} from 'node:test';
import assert from 'node:assert/strict';
import {extractINEFields,ineTargetFields} from '../web/ine-fields.js';
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
 assert.equal(result.identification,'CREDENCIAL PARA VOTAR (INE), CLAVE DE ELECTOR: PRGRAN90010125M100');
 assert.deepEqual(extractINEFields('FOTO BORROSA\n123456789\nCURP PEGX900101MXXAAA00'),{name:'',address:'',identification:''});
});
test('INE: etiquetas en una línea, CIC explícito y datos incompletos',()=>{
 assert.deepEqual(extractINEFields('N0MBRE: ANA PEREZ\nDOMICILI0: CALLE 5\nVIGENCIA 2035'),{name:'ANA PEREZ',address:'CALLE 5',identification:''});
 assert.equal(extractINEFields('CIC: 123456789\nOCR 987654321').identification,'CREDENCIAL PARA VOTAR (INE), CIC: 123456789');
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
