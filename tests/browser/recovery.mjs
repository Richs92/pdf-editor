import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {startTestApp,ADMIN_ID} from '../helpers/test-app.mjs';
const app=await startTestApp();const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
try{
 const page=await browser.newPage();const tokenHash='browser-recovery-hash-01234567890123456789';app.state.recovery.set(tokenHash,ADMIN_ID);
 await page.goto(app.url+'/recover.html#token_hash='+tokenHash+'&type=recovery');await page.locator('#recover').waitFor({state:'visible'});
 assert.equal(new URL(page.url()).hash,'');assert.ok(app.state.recovery.has(tokenHash),'Abrir la página no consume el enlace');
 await page.getByLabel('Nueva contraseña',{exact:true}).fill('Recovered-personal-password-123!');await page.getByLabel('Repetir nueva contraseña',{exact:true}).fill('Recovered-personal-password-123!');await page.getByRole('button',{name:'Guardar nueva contraseña'}).click();await page.locator('#status').filter({hasText:'Contraseña actualizada.'}).waitFor();
 await page.getByRole('link',{name:'Ir a iniciar sesión'}).click();await page.getByLabel('Correo de usuario',{exact:true}).fill('admin@example.test');await page.getByLabel('Contraseña',{exact:true}).fill('Recovered-personal-password-123!');await page.getByRole('button',{name:'Iniciar sesión',exact:true}).click();await page.waitForURL(app.url+'/');await page.locator('#modules a.module-card').first().waitFor();
 await page.goto(app.url+'/#error=access_denied&error_code=otp_expired');await page.waitForURL(app.url+'/recover.html');await page.locator('#status').filter({hasText:'El enlace ya fue utilizado o venció.'}).waitFor();
 assert.equal(await page.locator('#recover').isHidden(),true);
 console.log('Recuperación: enlace sin consumo al abrir, contraseña nueva, acceso y aviso de enlace vencido correctos.');
}finally{await browser.close();await app.close();}
