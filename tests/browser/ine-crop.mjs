import {chromium} from 'playwright';
import {mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {startTestApp,browserLogin} from '../helpers/test-app.mjs';
const app=await startTestApp(),browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
try{
 const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});const errors=[];page.on('pageerror',error=>errors.push(error.message));await browserLogin(page,app.url);await page.goto(app.url+'/contracts.html');await page.locator('#workspace').waitFor({state:'visible'});
 // A portrait phone photo with a small, slanted-text-free synthetic card on a noisy background.
 // It is intentionally not a replica of a real government ID and contains no real person.
 const data=await page.evaluate(()=>{
  const canvas=document.createElement('canvas');canvas.width=1200;canvas.height=1800;const c=canvas.getContext('2d');c.fillStyle='#34363c';c.fillRect(0,0,1200,1800);c.fillStyle='#ddd';c.font='32px Arial';for(let y=80;y<1800;y+=100)for(let x=30;x<1200;x+=180)c.fillText('400 1932',x,y);
  c.fillStyle='#eff2e5';c.fillRect(150,600,900,570);c.fillStyle='#aaa';c.fillRect(185,700,160,200);c.fillStyle='black';c.font='22px Arial';
  ['CREDENCIAL SINTETICA DE PRUEBA','NOMBRE','PEREZ','GARCIA','ANA MARIA','DOMICILIO','CALLE ROBLE 123','COL CENTRO 80000','CULIACAN, SIN.','CLAVE DE ELECTOR PRGRAN90010125M100','VIGENCIA 2025 - 2035'].forEach((line,i)=>c.fillText(line,390,640+i*43));
  return canvas.toDataURL('image/png').split(',')[1];
 });
 await page.getByLabel('Subir imagen: Vendedor · Frente de INE',{exact:true}).setInputFiles({name:'foto-vertical-sintetica.png',mimeType:'image/png',buffer:Buffer.from(data,'base64')});
 const dialog=page.getByRole('dialog');await dialog.waitFor();const canvas=dialog.locator('canvas'),box=await canvas.boundingBox();
 // Crop at original card coordinates, excluding the surrounding background numbers.
 await page.mouse.move(box.x+box.width*.125,box.y+box.height/3);await page.mouse.down();await page.mouse.move(box.x+box.width*.875,box.y+box.height*.65,{steps:12});await page.mouse.up();await dialog.getByRole('button',{name:'Usar recorte y leer',exact:true}).click();await dialog.waitFor({state:'hidden'});
 const review=page.locator('[data-ocr-slot="seller-front"]');await review.getByRole('button',{name:'Aplicar datos revisados'}).waitFor({timeout:120000});
 const name=await review.locator('[data-ocr-field="name"]').inputValue();assert.match(name,/PEREZ GARCIA ANA MARIA/);assert.ok(!/\d/.test(name));assert.match(await review.locator('[data-ocr-field="address"]').inputValue(),/CALLE ROBLE 123/);
 assert.equal(await page.locator('#field-seller').inputValue(),'');
 const photo=page.locator('.photo-card').filter({hasText:'Vendedor · Frente de INE'});const dimensions=await photo.locator('img').evaluate(img=>({width:img.naturalWidth,height:img.naturalHeight}));assert.ok(dimensions.width/dimensions.height>1.4);
 await photo.getByRole('button',{name:'Recortar INE',exact:true}).click();await dialog.waitFor();await dialog.getByRole('button',{name:'Girar 90°'}).click();await dialog.getByRole('button',{name:'Cancelar',exact:true}).click();assert.equal(await photo.locator('img').count(),1);
 await mkdir('artifacts/ine-crop',{recursive:true});await photo.screenshot({path:'artifacts/ine-crop/cropped-review.png'});assert.deepEqual(errors,[]);
 console.log('INE: encuadre de foto vertical, fondo con números excluido, lectura de nombre y domicilio, giro/cancelación y revisión antes de aplicar correctos.');
}finally{await browser.close();await app.close();}
