import {chromium} from 'playwright';
import {mkdir,readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {startTestApp,browserLogin} from '../helpers/test-app.mjs';
const app=await startTestApp();
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
await mkdir('artifacts/water',{recursive:true});
try{
 const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true,acceptDownloads:true});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await browserLogin(page,app.url);
 await page.goto(app.url+'/water.html');
 await page.locator('#status').filter({hasText:'Recibo listo.'}).waitFor();
 assert.equal(await page.locator('#preview canvas').count(),1);
 assert.equal(await page.locator('#category').inputValue(),'DOMÉSTICA');assert.ok(await page.locator('#category').evaluate(el=>el.readOnly));
 const dates=await page.evaluate(async()=>{const{waterDates}=await import('./water/generator.js');return waterDates();});
 for(const key of ['issue','due','billing'])assert.equal(await page.locator('#'+key).textContent(),dates[key]);
 await page.getByLabel('Cuenta',{exact:true}).fill('000990123');
 await page.getByLabel('Nombre',{exact:true}).fill('MARÍA LÓPEZ PÉREZ');
 await page.getByLabel('Dirección',{exact:true}).fill('AVENIDA NUEVA 123, CENTRO, CULIACÁN, SINALOA');
 assert.ok(await page.locator('#download').isHidden());
 await page.getByRole('button',{name:'Actualizar vista previa'}).click();
 await page.locator('#status').filter({hasText:'Recibo listo.'}).waitFor();
 await mkdir('artifacts/water',{recursive:true});
 const pending=page.waitForEvent('download');await page.locator('#download').click();await(await pending).saveAs('artifacts/water/browser.pdf');
 for(const width of [320,390,768,1360]){await page.setViewportSize({width,height:900});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Sin desbordamiento a '+width+' px');}
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:'artifacts/water/mobile.png',fullPage:true});
 assert.ok(await page.locator('#name').evaluate(el=>parseFloat(getComputedStyle(el).fontSize))>=16);assert.deepEqual(errors,[]);
 await page.goto(app.url+'/');await page.getByRole('link',{name:'Agua',exact:true}).click();assert.ok(page.url().endsWith('/water.html'));
 console.log('Agua: campos, categoría doméstica, fechas, descarga y vista móvil correctos.');
}finally{await browser.close();await app.close();}
