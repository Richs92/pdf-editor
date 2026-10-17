import {chromium} from 'playwright';
import {readFile,mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
import PizZip from 'pizzip';
import {startTestApp,browserLogin} from '../helpers/test-app.mjs';
const app=await startTestApp();const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
try{
 const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true,acceptDownloads:true});const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await browserLogin(page,app.url);await page.goto(app.url+'/contracts.html');
 const ready=()=>page.waitForFunction(()=>document.querySelector('#preview-state')?.textContent==='Vista previa actualizada'&&document.querySelector('#document-preview').getAttribute('aria-busy')==='false'&&!document.querySelector('#exports').hidden,{},{timeout:60000});
 await ready();assert.ok(await page.locator('#document-preview section.docx').count()>0);
 assert.equal(app.state.logs.filter(log=>log.action==='document_generated').length,0,'Automatic previews do not spam the audit log');
 const catalog=JSON.parse(await readFile('web/contracts-catalog.json','utf8'));
 for(const item of catalog){
  await page.locator(`.tab[data-group="${item.group}"]`).click();await page.locator(`.template-choice[data-id="${item.id}"]`).click();
  const key=item.id==='pagare'?'subscriber':'seller',value='VISTA AUTOMATICA '+item.id.toUpperCase();
  await page.locator('#field-'+key).fill(value);await ready();
  assert.ok((await page.locator('#document-preview').innerText()).includes(value));
  await page.locator('#field-'+key).fill('');await ready();assert.ok(!(await page.locator('#document-preview').innerText()).includes(value));assert.match(await page.locator('#document-preview').innerText(),/_{24}/);
 }
 // Rapid edits and template changes must never allow an older render to win.
 await page.locator('#field-seller').fill('VALOR VIEJO');
 await page.locator('.tab[data-group="Pagaré"]').click();
 const input=page.locator('#field-subscriber');await input.fill('PRIMER VALOR');await input.fill('SEGUNDO VALOR');await input.fill('ULTIMO VALOR CORRECTO');await ready();
 const preview=await page.locator('#document-preview').innerText();assert.ok(preview.includes('ULTIMO VALOR CORRECTO'));assert.ok(!preview.includes('VALOR VIEJO'));assert.ok(!preview.includes('PRIMER VALOR'));
 const pending=page.waitForEvent('download');await page.locator('#word-download').click();await mkdir('artifacts/contract-preview',{recursive:true});await(await pending).saveAs('artifacts/contract-preview/automatico.docx');
 const xml=new PizZip(await readFile('artifacts/contract-preview/automatico.docx')).file('word/document.xml').asText();assert.ok(xml.includes('ULTIMO VALOR CORRECTO'));assert.ok(!xml.includes('PRIMER VALOR'));
 assert.equal(app.state.logs.filter(log=>log.action==='document_generated').length,1);assert.ok(!JSON.stringify(app.state.logs).includes('ULTIMO VALOR'));
 assert.deepEqual(errors,[]);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:'artifacts/contract-preview/mobile.png',fullPage:true});
 console.log('Vista automática: siete plantillas, campos vacíos, ediciones rápidas, cambios de documento, descarga vigente y auditoría sin duplicados correctos.');
}finally{await browser.close();await app.close();}
