import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {startTestApp,browserLogin} from '../helpers/test-app.mjs';
const app=await startTestApp(),browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
try{
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await browserLogin(page,app.url);
 for(const [path,module,pages]of [['/contracts.html','contracts',1],['/cfe.html','cfe',2],['/water.html','water',1],['/predial.html','predial',1]]){
  await page.goto(app.url+path);
  if(module==='contracts'){await page.locator('#workspace').waitFor({state:'visible'});await page.locator('[data-group="Recibo de apartado"]').click();await page.locator('#exports').waitFor({state:'visible'});}
  await page.locator('#print-document').waitFor({state:'visible',timeout:60000});
  await page.evaluate(()=>{
   window.open=()=>{throw Error('La impresión no debe abrir otra pestaña.');};
   new MutationObserver(()=>{for(const frame of document.querySelectorAll('.document-print-dialog iframe')){const win=frame.contentWindow;if(win.__prints===undefined){win.__prints=0;win.print=()=>{win.__prints++;};}}}).observe(document.body,{childList:true,subtree:true});
  });
  await page.locator('#print-document').click();
  const dialog=page.locator('.document-print-dialog'),print=page.frameLocator('.document-print-dialog iframe');
  await print.getByRole('button',{name:'Imprimir',exact:true}).waitFor({state:'visible'});
  await page.waitForFunction(()=>document.querySelector('.document-print-dialog iframe')?.contentWindow.__prints===1,{},{timeout:30000});
  assert.equal(await print.locator('.sheet').count(),pages);assert.equal(await print.getByRole('progressbar').evaluate(bar=>bar.value/bar.max),1);assert.match(await print.locator('#print-elapsed').innerText(),/Listo en \d+ s/);assert.equal(await print.locator('form').count(),0);assert.ok(await print.locator('style').allTextContents().then(items=>items.some(s=>s.includes('@page'))));
  assert.equal(await print.getByRole('link',{name:'Descargar PDF',exact:true}).count(),1);
  await print.getByRole('button',{name:'Imprimir',exact:true}).click();assert.equal(await page.evaluate(()=>document.querySelector('.document-print-dialog iframe').contentWindow.__prints),2);
  assert.ok(app.state.logs.some(e=>e.action==='document_print_requested'&&e.module===module));await dialog.getByRole('button',{name:'Cerrar impresión',exact:true}).click();
  if(module!=='contracts'){const input=page.locator('input:not([readonly]):not([type=checkbox])').first();await input.fill('CAMBIO');await page.locator('#print-document').waitFor({state:'hidden'});}
 }
 // Simulate a PDF renderer that never loads: the visible UI must recover.
 await page.goto(app.url+'/contracts.html');await page.locator('#workspace').waitFor({state:'visible'});await page.locator('[data-group="Recibo de apartado"]').click();await page.locator('#exports').waitFor({state:'visible'});
 await page.route('**/vendor/pdf.worker.mjs',()=>{});await page.clock.install();
 await page.locator('#print-document').click();const failed=page.frameLocator('.document-print-dialog iframe');
 await failed.getByRole('link',{name:'Descargar PDF',exact:true}).waitFor();await page.clock.fastForward(5000);assert.match(await failed.locator('#print-elapsed').innerText(),/Tiempo transcurrido: 5 s/);await page.clock.fastForward(40001);
 await failed.getByRole('status').filter({hasText:'superó 45 segundos'}).waitFor();assert.equal(await failed.getByRole('button',{name:'Imprimir',exact:true}).isDisabled(),true);const stopped=await failed.locator('#print-elapsed').innerText();await page.clock.fastForward(5000);assert.equal(await failed.locator('#print-elapsed').innerText(),stopped);assert.equal(await failed.getByRole('progressbar').count(),0);
 assert.equal(await failed.getByRole('link',{name:'Descargar PDF',exact:true}).count(),1);
 await page.getByRole('button',{name:'Cerrar impresión',exact:true}).click();assert.equal(await page.locator('#print-document').isEnabled(),true);
 assert.deepEqual(errors,[]);console.log('Impresión: cuatro módulos en la pestaña activa, páginas completas, cierre, log y recuperación con PDF disponible tras un lector bloqueado.');
}finally{await browser.close();await app.close();}
