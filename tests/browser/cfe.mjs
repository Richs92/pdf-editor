import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {startTestApp,browserLogin} from '../helpers/test-app.mjs';
const app=await startTestApp();const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
try{
 const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true,acceptDownloads:true});
 await browserLogin(page,app.url);await page.goto(app.url+'/cfe.html');
 await page.locator('#status').filter({hasText:'Plantilla lista para editar.'}).waitFor();assert.equal(await page.locator('#preview canvas').count(),2);
 await page.getByLabel('Nombre completo',{exact:true}).fill('María José Muñoz Güémez');
 assert.equal(await page.getByLabel('Nombre completo',{exact:true}).inputValue(),'MARIA JOSE MUÑOZ GUEMEZ');
 for(const [label,value,expected] of [['Calle y número','río bravo 123','RIO BRAVO 123'],['Entre calles','álamos y juárez','ALAMOS Y JUAREZ'],['Colonia','las quintás','LAS QUINTAS'],['Ciudad y estado','Culiacán, sin.','CULIACAN, SIN.']]){
  const input=page.getByLabel(label,{exact:true});await input.fill(value);assert.equal(await input.inputValue(),expected);
 }
 await page.getByLabel('Código postal de la dirección',{exact:true}).fill('01234');await page.getByRole('button',{name:'Actualizar vista previa'}).click();await page.locator('#status').filter({hasText:'PDF listo.'}).waitFor();
 const pending=page.waitForEvent('download');await page.locator('#download').click();const downloaded=await pending;assert.ok(downloaded.suggestedFilename().endsWith('.pdf'));await downloaded.saveAs('artifacts/cfe-structured-address.pdf');
 assert.ok(app.state.logs.some(log=>log.action==='document_downloaded'&&log.module==='cfe'));assert.ok(!JSON.stringify(app.state.logs).includes('MARIA JOSE'));
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 console.log('CFE: acceso autenticado, dos páginas, generación, descarga y log correctos.');
}finally{await browser.close();await app.close();}
