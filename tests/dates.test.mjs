import {test} from 'node:test';
import assert from 'node:assert/strict';
import {monthOffset,shiftDate,paymentCode} from '../web/dates.js';
test('desplaza fechas de forma coherente y conserva días',()=>{
 const offset=monthOffset(new Date('2026-11-16T18:00:00Z'));
 assert.equal(offset,1);
 assert.equal(shiftDate('04 OCT 26',offset),'04 NOV 26');
 assert.equal(shiftDate('17 JUL 26',offset),'17 AGO 26');
 assert.equal(shiftDate('17 SEP 26',offset),'17 OCT 26');
 assert.equal(shiftDate('22/09/2026',offset),'22/10/2026');
 assert.equal(paymentCode(offset),'261104');
});
test('cambia de año y usa la zona horaria de Mazatlán',()=>{
 assert.equal(shiftDate('18 NOV 25',2),'18 ENE 26');
 assert.equal(shiftDate('04 OCT 26',3),'04 ENE 27');
 assert.equal(monthOffset(new Date('2026-11-01T03:00:00Z')),0);
 assert.equal(monthOffset(new Date('2026-11-01T12:00:00Z')),1);
});
