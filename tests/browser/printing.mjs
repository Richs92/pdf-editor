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
  await page.evaluate(()=>{const open=window.open.bind(window);window.open=(...args)=>{const popup=open(...args);if(popup){popup.__prints=0;popup.print=()=>{popup.__prints++;};}return popup;};});
  console.log('Verificando impresión:',module);
  const pending=page.context().waitForEvent('page');await page.locator('#print-document').click();const popup=await pending.catch(async error=>{console.log(module,await page.locator('[role=status]').allTextContents(),await page.locator('#print-document').evaluate(b=>({disabled:b.disabled,hidden:b.hidden})));throw error;});
  try{await popup.waitForFunction(()=>window.__prints===1,{},{timeout:30000});}catch(error){console.log(module,await popup.locator('body').innerText(),await page.locator('[role=status]').allTextContents());throw error;}
  assert.equal(await popup.locator('.sheet').count(),pages);assert.equal(await popup.locator('form').count(),0);assert.ok(await popup.locator('style').allTextContents().then(items=>items.some(s=>s.includes('@page'))));
  assert.equal(await popup.getByRole('link',{name:'Descargar PDF',exact:true}).count(),1);
  await popup.getByRole('button',{name:'Imprimir',exact:true}).click();assert.equal(await popup.evaluate(()=>window.__prints),2);
  assert.ok(app.state.logs.some(e=>e.action==='document_print_requested'&&e.module===module));await popup.close();
  if(module!=='contracts'){const input=page.locator('input:not([readonly]):not([type=checkbox])').first();await input.fill('CAMBIO');await page.locator('#print-document').waitFor({state:'hidden'});}
 }
 await page.goto(app.url+'/contracts.html');await page.locator('#workspace').waitFor({state:'visible'});await page.locator('#exports').waitFor({state:'visible'});await page.evaluate(()=>{window.open=()=>null;});await page.locator('#print-document').click();await page.getByText('Permite las ventanas emergentes',{exact:false}).waitFor();
 assert.deepEqual(errors,[]);console.log('Impresión: cuatro módulos, todas las páginas, PDF aislado, menú nativo simulado, log, cambios pendientes y ventanas bloqueadas.');
}finally{await browser.close();await app.close();}
