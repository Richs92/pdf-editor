import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {startTestApp,browserLogin} from '../helpers/test-app.mjs';
const app=await startTestApp();const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
try{
 const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true,acceptDownloads:true});
 await browserLogin(page,app.url);await page.goto(app.url+'/cfe.html');
 await page.locator('#status').filter({hasText:'Plantilla lista para editar.'}).waitFor();assert.equal(await page.locator('#preview canvas').count(),2);
 await page.getByLabel('Nombre completo',{exact:true}).fill('MARÍA JOSÉ MUÑOZ GÜÉMEZ');await page.getByRole('button',{name:'Actualizar vista previa'}).click();await page.locator('#status').filter({hasText:'PDF listo.'}).waitFor();
 const pending=page.waitForEvent('download');await page.locator('#download').click();assert.ok((await pending).suggestedFilename().endsWith('.pdf'));
 assert.ok(app.state.logs.some(log=>log.action==='document_downloaded'&&log.module==='cfe'));assert.ok(!JSON.stringify(app.state.logs).includes('MARÍA JOSÉ'));
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 console.log('CFE: acceso autenticado, dos páginas, generación, descarga y log correctos.');
}finally{await browser.close();await app.close();}
