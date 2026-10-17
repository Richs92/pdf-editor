import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {startTestApp,browserLogin} from '../helpers/test-app.mjs';
import {mkdir} from 'node:fs/promises';
const app=await startTestApp(),browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
try{
 const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true,acceptDownloads:true});const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await browserLogin(page,app.url);assert.equal(await page.locator('#modules a.module-card').count(),5);
 await page.locator('#modules').getByRole('link',{name:/BanBajío/}).click();await page.locator('#status').filter({hasText:'Documento editado listo.'}).waitFor();assert.equal(await page.locator('#preview canvas').count(),1);
 await page.getByLabel('Nombre',{exact:true}).fill('NOMBRE SINTETICO DE PRUEBA');await page.getByLabel('Número de cliente',{exact:true}).fill('001234567');await page.getByRole('button',{name:'Actualizar vista previa'}).click();await page.locator('#status').filter({hasText:'Documento editado listo.'}).waitFor();
 const pending=page.waitForEvent('download');await page.locator('#download').click();await mkdir('artifacts/bank',{recursive:true});await(await pending).saveAs('artifacts/bank/browser.pdf');assert.ok(app.state.logs.some(log=>log.action==='document_downloaded'&&log.module==='bank'));assert.ok(!JSON.stringify(app.state.logs).includes('NOMBRE SINTETICO'));
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 // Old databases show the activation guide instead of a broken bank page.
 app.state.failures.push({path:'/rest/v1/rpc/app_write_audit',method:'POST',status:400,body:{code:'23514'}});
 await page.goto(app.url+'/bank.html');await page.waitForURL(app.url+'/activar-banbajio.html');assert.ok((await page.locator('pre').innerText()).includes('app_audit_module_check'));
 assert.deepEqual(errors,[]);console.log('BanBajío: Home, una hoja, edición, descarga, permisos, log, móvil y guía de activación correctos.');
}finally{await browser.close();await app.close();}
