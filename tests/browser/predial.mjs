import {chromium} from 'playwright';
import {mkdir,readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {startTestApp,browserLogin} from '../helpers/test-app.mjs';
const app=await startTestApp();
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
await mkdir('artifacts/predial',{recursive:true});
try{
 const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true,acceptDownloads:true});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await browserLogin(page,app.url);
 await page.goto(app.url+'/predial.html');
 await page.locator('#status').filter({hasText:'Ambas copias están actualizadas.'}).waitFor();
 assert.equal(await page.locator('#preview canvas').count(),1);
 assert.ok(await page.locator('#key0').evaluate(el=>el.readOnly));assert.ok(await page.locator('#key5').evaluate(el=>el.readOnly));
 assert.ok(await page.locator('#total').isDisabled());assert.ok(await page.locator('#terrain').isDisabled());assert.ok(await page.locator('#construction').isDisabled());
 for(let i=1;i<5;i++)await page.locator('#key'+i).fill(['012','034','056','078'][i-1]);
 await page.getByLabel('Nombre',{exact:true}).fill('MARÍA LÓPEZ PÉREZ');
 await page.getByLabel('Domicilio',{exact:true}).fill('AVENIDA NUEVA 123, COLONIA CENTRO, CULIACÁN, SINALOA, CP 80000');
 await page.getByLabel('Vigencia hasta',{exact:true}).fill('2026-11-30');
 assert.ok(await page.locator('#download').isHidden());
 await page.getByRole('button',{name:'Actualizar vista previa'}).click();
 await page.locator('#status').filter({hasText:'Ambas copias están actualizadas.'}).waitFor();
 await mkdir('artifacts/predial',{recursive:true});
 let download=page.waitForEvent('download');await page.locator('#download').click();await(await download).saveAs('artifacts/predial/browser-required.pdf');
 await page.getByLabel('Editar total',{exact:true}).check();await page.locator('#total').fill('12500.01');
 await page.getByLabel('Editar superficie de terreno',{exact:true}).check();await page.locator('#terrain').fill('321.50');
 await page.getByLabel('Editar superficie construida',{exact:true}).check();await page.locator('#construction').fill('88.75');
 await page.getByRole('button',{name:'Actualizar vista previa'}).click();
 await page.locator('#status').filter({hasText:'Ambas copias están actualizadas.'}).waitFor();
 download=page.waitForEvent('download');await page.locator('#download').click();await(await download).saveAs('artifacts/predial/browser-optional.pdf');
 for(const width of [320,390,768,1360]){await page.setViewportSize({width,height:900});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Sin desbordamiento a '+width+' px');}
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:'artifacts/predial/mobile.png',fullPage:true});
 await page.setViewportSize({width:1360,height:1000});await page.screenshot({path:'artifacts/predial/desktop.png',fullPage:true});
 assert.ok(await page.locator('#name').evaluate(el=>parseFloat(getComputedStyle(el).fontSize))>=16);assert.deepEqual(errors,[]);
 await page.goto(app.url+'/');await page.getByRole('link',{name:'Predial',exact:true}).click();assert.ok(page.url().endsWith('/predial.html'));
 console.log('Predial: campos segmentados, opcionales, descarga, vista móvil y navegación correctos.');
}finally{await browser.close();await app.close();}
