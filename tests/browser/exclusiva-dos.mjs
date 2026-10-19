import {chromium} from 'playwright';import assert from 'node:assert/strict';import {mkdir,readFile} from 'node:fs/promises';import PizZip from 'pizzip';import {startTestApp,browserLogin} from '../helpers/test-app.mjs';
const app=await startTestApp(),browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
try{
 const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true,acceptDownloads:true}),errors=[];page.on('pageerror',e=>errors.push(e.message));await browserLogin(page,app.url);await page.goto(app.url+'/contracts.html');await page.locator('#workspace').waitFor({state:'visible'});await page.locator('[data-group="Exclusiva"]').click();await page.locator('[data-id="contrato-exclusiva-dos"]').click();
 for(const [key,value]of [['buyer','ANA PROPIETARIA UNO'],['buyer2','LUIS PROPIETARIO DOS'],['seller','PROFESIONAL TRES']]){const field=page.locator('#field-'+key);await field.evaluate(el=>el.closest('details').open=true);await field.fill(value);}
 assert.equal(await page.locator('.signature-card').count(),3);assert.equal(await page.locator('.photo-card').count(),6);
 for(const person of ['Propietario 1','Propietario 2','Profesional'])for(const face of ['Frente','Reverso']){
  const image=await page.evaluate(label=>{const c=document.createElement('canvas');c.width=856;c.height=540;const ctx=c.getContext('2d');ctx.fillStyle='#ddd';ctx.fillRect(0,0,856,540);ctx.fillStyle='#111';ctx.font='24px Arial';ctx.fillText('PRUEBA SINTETICA '+label,30,100);return c.toDataURL().split(',')[1];},person+' '+face);
  await page.getByLabel('Subir imagen: '+person+' · '+face+' de INE',{exact:true}).setInputFiles({name:'prueba.png',mimeType:'image/png',buffer:Buffer.from(image,'base64')});await page.locator('#form-status').filter({hasText:'INE añadida.'}).waitFor();
 }
 for(let i=0;i<3;i++){
  const card=page.locator('.signature-card').nth(i),canvas=card.locator('canvas');await canvas.scrollIntoViewIfNeeded();const b=await canvas.boundingBox();await page.mouse.move(b.x+b.width*.15,b.y+b.height*.5);await page.mouse.down();await page.mouse.move(b.x+b.width*.4,b.y+b.height*.2,{steps:6});await page.mouse.move(b.x+b.width*.8,b.y+b.height*.8,{steps:6});await page.mouse.up();await card.getByRole('button',{name:'Usar firma',exact:true}).click();
 }
 await page.waitForFunction(()=>document.querySelectorAll('#document-preview canvas').length>=5&&document.querySelector('#preview-state').textContent==='Vista previa actualizada');await mkdir('artifacts/signatures',{recursive:true});
 let download=page.waitForEvent('download');await page.locator('#word-download').click();await(await download).saveAs('artifacts/signatures/exclusiva-dos.docx');
 const zip=new PizZip(await readFile('artifacts/signatures/exclusiva-dos.docx')),xml=zip.file('word/document.xml').asText();assert.equal((xml.match(/TerminavitINE/g)||[]).length,3);
 for(const key of ['buyer','buyer2','seller'])assert.ok(zip.file('word/media/terminavit-signature-'+key+'.png'));
 const cells=await page.evaluate(text=>{const ns='http://schemas.openxmlformats.org/wordprocessingml/2006/main',doc=new DOMParser().parseFromString(text,'application/xml');return [...doc.getElementsByTagNameNS(ns,'tc')].filter(c=>/PROPIETARIO 1|PROPIETARIO 2|EL PROFESIONAL/.test(c.textContent)).map(c=>({text:c.textContent,images:c.getElementsByTagNameNS(ns,'drawing').length}));},xml);
 assert.equal(cells.length,3);assert.ok(cells.every(c=>c.images===1));assert.ok(cells[0].text.includes('ANA PROPIETARIA UNO'));assert.ok(cells[1].text.includes('LUIS PROPIETARIO DOS'));assert.ok(cells[2].text.includes('PROFESIONAL TRES'));
 download=page.waitForEvent('download');await page.locator('#pdf-download').click();await(await download).saveAs('artifacts/signatures/exclusiva-dos.pdf');
 await page.locator('#field-buyer2').evaluate(el=>el.closest('details').open=true);await page.locator('#field-buyer2').fill('CAMBIO DEL SEGUNDO PROPIETARIO');await page.waitForFunction(()=>document.querySelector('#preview-state').textContent==='Vista previa actualizada'&&document.querySelector('#document-preview').textContent.includes('CAMBIO DEL SEGUNDO PROPIETARIO'));
 await page.locator('[data-id="contrato-exclusiva"]').click();assert.equal(await page.locator('.photo-card').count(),4);assert.equal(await page.locator('#signature-section').isVisible(),false);assert.deepEqual(errors,[]);
 console.log('Exclusiva dos propietarios: tres firmas en sus campos, seis caras de INE en tres anexos, Word, PDF y revocación al cambiar datos.');
}finally{await browser.close();await app.close();}
