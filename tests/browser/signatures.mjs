import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,readFile} from 'node:fs/promises';
import PizZip from 'pizzip';
import {startTestApp,browserLogin} from '../helpers/test-app.mjs';
const app=await startTestApp(),browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
try{
 const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true,acceptDownloads:true}),errors=[],uploads=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(r.method()!=='GET')uploads.push(r.url());});
 await browserLogin(page,app.url);await page.goto(app.url+'/contracts.html');await page.locator('#workspace').waitFor({state:'visible'});
 assert.equal(await page.locator('#signature-section').isVisible(),false);
 await page.locator('[data-group="Recibo de apartado"]').click();await page.locator('#signature-section').waitFor({state:'visible'});
 const cards=page.locator('.signature-card');assert.equal(await cards.count(),2);
 for(let i=0;i<2;i++){
  const card=cards.nth(i),canvas=card.locator('canvas');await canvas.scrollIntoViewIfNeeded();const b=await canvas.boundingBox();
  await page.mouse.move(b.x+b.width*.15,b.y+b.height*.5);await page.mouse.down();await page.mouse.move(b.x+b.width*.3,b.y+b.height*.2,{steps:6});await page.mouse.move(b.x+b.width*.5,b.y+b.height*.8,{steps:6});await page.mouse.move(b.x+b.width*.8,b.y+b.height*.3,{steps:6});await page.mouse.up();await card.getByRole('button',{name:'Usar firma',exact:true}).click();
 }
 await page.getByText('Vista previa actualizada',{exact:true}).waitFor();await page.waitForFunction(()=>document.querySelectorAll('#document-preview img').length===2);
 await page.getByRole('button',{name:'Actualizar vista previa',exact:true}).click();await page.getByText('Vista previa actualizada',{exact:true}).waitFor();assert.equal(await page.locator('#document-preview img').count(),2);
 await mkdir('artifacts/signatures',{recursive:true});let download=page.waitForEvent('download');await page.locator('#word-download').click();await(await download).saveAs('artifacts/signatures/apartado-firmado.docx');
 const zip=new PizZip(await readFile('artifacts/signatures/apartado-firmado.docx'));for(const person of ['buyer','seller'])assert.ok(zip.file('word/media/terminavit-signature-'+person+'.png'));
 const cells=await page.evaluate(xml=>{const d=new DOMParser().parseFromString(xml,'application/xml'),ns='http://schemas.openxmlformats.org/wordprocessingml/2006/main';return [...d.getElementsByTagNameNS(ns,'tc')].filter(c=>c.textContent.endsWith('Entrega')||c.textContent.endsWith('Recibe')).map(c=>({text:c.textContent,images:c.getElementsByTagNameNS(ns,'drawing').length}));},zip.file('word/document.xml').asText());
 assert.equal(cells.length,2);assert.ok(cells.every(c=>c.images===1));
 download=page.waitForEvent('download');await page.locator('#pdf-download').click();await(await download).saveAs('artifacts/signatures/apartado-firmado.pdf');
 await cards.nth(0).getByRole('button',{name:'Limpiar y quitar firma',exact:true}).click();await page.waitForFunction(()=>document.querySelectorAll('#document-preview img').length===1);
 // Editing the underlying document invalidates remaining ink.
 await page.locator('#field-buyer').evaluate(el=>el.closest('details').open=true);await page.locator('#field-buyer').fill('NOMBRE MODIFICADO');await page.waitForFunction(()=>document.querySelectorAll('#document-preview img').length===0);
 await page.locator('[data-group="Pagaré"]').click();assert.equal(await page.locator('#signature-section').isVisible(),false);
 assert.ok(uploads.every(u=>u.includes('/.netlify/functions/api/')));assert.deepEqual(errors,[]);
 console.log('Firmas: dos personas en su campo, vista previa, Word, PDF, borrar, invalidación al editar y exclusión en otros documentos.');
}finally{await browser.close();await app.close();}
