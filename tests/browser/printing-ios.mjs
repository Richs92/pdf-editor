import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {startTestApp,browserLogin} from '../helpers/test-app.mjs';
const app=await startTestApp(),browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
try{
 const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true,userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1'}),errors=[],requests=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>requests.push(r.url()));await browserLogin(page,app.url);
 for(const path of ['/contracts.html','/cfe.html']){
  await page.goto(app.url+path);if(path.includes('contracts')){await page.locator('#workspace').waitFor({state:'visible'});await page.locator('[data-group="Recibo de apartado"]').click();await page.locator('#exports').waitFor({state:'visible'});}
  await page.locator('#print-document').waitFor({state:'visible'});
  await page.evaluate(()=>{window.print=()=>{throw Error('iOS no debe imprimir HTML');};});
  requests.length=0;await page.locator('#print-document').click();const view=page.frameLocator('.document-print-dialog iframe'),native=view.getByRole('link',{name:'Abrir PDF para imprimir',exact:true});await native.waitFor({state:'visible'});
  assert.equal(await native.getAttribute('target'),'_blank');assert.equal(await native.getAttribute('download'),null);assert.equal(await view.getByRole('button',{name:'Imprimir',exact:true}).count(),0);assert.equal(await view.locator('.sheet').count(),0);
  const pdf=await native.evaluate(async a=>{const response=await fetch(a.href),blob=await response.blob();return {type:blob.type,header:new TextDecoder().decode((await blob.arrayBuffer()).slice(0,5)),bytes:blob.size};});assert.equal(pdf.type,'application/pdf');assert.equal(pdf.header,'%PDF-');assert.ok(pdf.bytes>1000);
  assert.match(await view.getByRole('status').innerText(),/Compartir → Imprimir/);await page.getByRole('button',{name:'Cerrar impresión',exact:true}).click();assert.ok(!requests.some(url=>url.endsWith('/vendor/pdf.worker.mjs')));
 }
 const direct=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true,userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Safari/604.1'});
 await direct.addInitScript(()=>{window.__printShares=[];Object.defineProperty(navigator,'canShare',{configurable:true,value:()=>true});Object.defineProperty(navigator,'share',{configurable:true,value:async data=>{window.__printShares.push({active:navigator.userActivation.isActive,type:data.files[0].type,header:await data.files[0].slice(0,5).text()});}});});await browserLogin(direct,app.url);
 for(const path of ['/contracts.html','/cfe.html','/water.html','/predial.html']){
  await direct.goto(app.url+path);if(path.includes('contracts')){await direct.locator('#workspace').waitFor({state:'visible'});await direct.locator('[data-group="Recibo de apartado"]').click();await direct.locator('#exports').waitFor({state:'visible'});}
  await direct.getByRole('button',{name:'Imprimir',exact:true}).click({timeout:60000});await direct.waitForFunction(()=>window.__printShares.length===1);
  const result=await direct.evaluate(()=>window.__printShares[0]);assert.equal(result.active,true);assert.equal(result.type,'application/pdf');assert.equal(result.header,'%PDF-');assert.equal(await direct.locator('.document-print-dialog').count(),0);
 }
 await direct.close();
 assert.ok(!requests.some(url=>url.endsWith('/vendor/pdf.worker.mjs')));assert.deepEqual(errors,[]);
 console.log('Ruta iPhone: PDF original en enlace explícito, sin impresión HTML ni rasterización; carta y recibo de dos páginas preparados. No sustituye una prueba física de AirPrint.');
}finally{await browser.close();await app.close();}
