import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import * as PDFLib from 'pdf-lib';
import {startTestApp,browserLogin} from '../helpers/test-app.mjs';
const app=await startTestApp(),browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
try{
 const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.addInitScript(()=>{
  window.__shares=[];window.__shareMode='success';
  Object.defineProperty(navigator,'canShare',{configurable:true,value:data=>Boolean(data.files?.length&&data.files.every(file=>file.type==='application/pdf'))});
  Object.defineProperty(navigator,'share',{configurable:true,value:data=>{
   if(!navigator.userActivation.isActive)throw Error('Share must be called directly from a click');
   if(window.__shareMode==='cancel')return Promise.reject(new DOMException('Cancelled','AbortError'));
   return data.files[0].arrayBuffer().then(buffer=>{let binary='';for(const byte of new Uint8Array(buffer))binary+=String.fromCharCode(byte);window.__shares.push({name:data.files[0].name,type:data.files[0].type,data:btoa(binary)});});
  }});
 });
 await browserLogin(page,app.url);await page.goto(app.url+'/contracts.html');await page.locator('#field-seller').fill('PERSONA DE PRUEBA PARA COMPARTIR');
 const share=page.locator('#whatsapp-share');await page.waitForFunction(()=>{const button=document.querySelector('#whatsapp-share');return button&&!button.disabled&&!button.closest('#exports').hidden;},{},{timeout:90000});
 await share.click();await page.waitForFunction(()=>window.__shares.length===1);
 const first=await page.evaluate(()=>window.__shares[0]);assert.equal(first.type,'application/pdf');assert.ok(first.name.endsWith('.pdf'));assert.ok((await PDFLib.PDFDocument.load(Buffer.from(first.data,'base64'))).getPageCount()>0);
 await mkdir('artifacts/share',{recursive:true});await writeFile('artifacts/share/contrato.pdf',Buffer.from(first.data,'base64'));
 await page.locator('#form-status').filter({hasText:'menú de compartir del teléfono'}).waitFor();assert.ok(app.state.logs.some(log=>log.action==='document_share_requested'&&log.module==='contracts'));assert.ok(!JSON.stringify(app.state.logs).includes('PERSONA DE PRUEBA'));
 await page.evaluate(()=>window.__shareMode='cancel');await share.click();await page.locator('#form-status').filter({hasText:'Menú de compartir cerrado.'}).waitFor();assert.equal(await share.isEnabled(),true);
 // Clear the old file when editing, and share the new note with its latest amount.
 await page.evaluate(()=>window.__shareMode='success');await page.locator('.tab[data-group="Pagaré"]').click();await page.locator('#field-subscriber').fill('SUSCRIPTOR NUEVO PARA COMPARTIR');await page.locator('#field-amount').fill('10000');
 await page.waitForFunction(()=>{const button=document.querySelector('#whatsapp-share');return button&&!button.disabled&&!button.closest('#exports').hidden;},{},{timeout:90000});
 await share.click();await page.waitForFunction(()=>window.__shares.length===2);const note=await page.evaluate(()=>window.__shares[1]);assert.equal(note.name,'pagare-llenado.pdf');assert.notEqual(note.data,first.data);await writeFile('artifacts/share/pagare.pdf',Buffer.from(note.data,'base64'));
 // Browsers with no native file sharing offer an actual download, never a fake WhatsApp send.
 const desktop=await browser.newPage({acceptDownloads:true});await browserLogin(desktop,app.url);await desktop.goto(app.url+'/contracts.html');await desktop.locator('#exports').waitFor({state:'visible'});
 // Explicitly turn off file sharing for the desktop fallback test.
 await desktop.evaluate(()=>{Object.defineProperty(navigator,'canShare',{configurable:true,value:()=>false});document.querySelector('#field-seller').value='PERSONA DE PRUEBA';document.querySelector('#field-seller').dispatchEvent(new Event('input',{bubbles:true}));});
 await desktop.getByRole('button',{name:'Descargar PDF para WhatsApp',exact:true}).waitFor();await desktop.locator('#exports').waitFor({state:'visible'});
 const pending=desktop.waitForEvent('download');await desktop.locator('#whatsapp-share').click();assert.ok((await pending).suggestedFilename().endsWith('.pdf'));
 assert.deepEqual(errors,[]);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 console.log('Compartir: PDF real, gesto directo, cancelación, pagaré actualizado, alternativa de descarga y log sin datos personales correctos.');
}finally{await browser.close();await app.close();}
