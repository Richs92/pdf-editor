import {test} from 'node:test';
import assert from 'node:assert/strict';
import {normalizeCFEText,cfeAddressLines} from '../web/cfe-fields.js';
const address={street:'río síñaloa 123',crossStreets:'álamos y juárez',colony:'las quintás',addressPostalCode:'01234',cityState:'Culiacán, sin.'};
test('CFE: mayúsculas sin acentos, con Ñ, puntuación y números',()=>{
 assert.equal(normalizeCFEText('María José Muñoz Güémez'),'MARIA JOSE MUÑOZ GUEMEZ');
 assert.equal(normalizeCFEText('Culiaca\u0301n, sin.'),'CULIACAN, SIN.');
});
test('dirección: cuatro líneas y CP con prefijo, conserva ceros iniciales',()=>{
 assert.deepEqual(cfeAddressLines(address),['RIO SIÑALOA 123','ALAMOS Y JUAREZ','LAS QUINTAS C.P.01234','CULIACAN, SIN.']);
 assert.equal(cfeAddressLines({...address,crossStreets:''})[1],'');
 for(const patch of [{addressPostalCode:'1234'},{addressPostalCode:'C.P.01234'},{street:''},{street:'a\nb'},{colony:'a'.repeat(65)}])assert.throws(()=>cfeAddressLines({...address,...patch}));
});
