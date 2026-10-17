import {chromium} from 'playwright';
import {mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {startTestApp,browserLogin} from '../helpers/test-app.mjs';
const app=await startTestApp(),browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
try{
 const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});const requests=[];page.on('request',request=>requests.push(request.url()));const errors=[];page.on('pageerror',error=>errors.push(error.message));await browserLogin(page,app.url);await page.goto(app.url+'/contracts.html');await page.locator('#workspace').waitFor({state:'visible'});
 // A portrait phone photo with a small, slanted-text-free synthetic card on a noisy background.
 // It is intentionally not a replica of a real government ID and contains no real person.
 const data=await page.evaluate(()=>{
  const canvas=document.createElement('canvas');canvas.width=1200;canvas.height=1800;const c=canvas.getContext('2d');c.fillStyle='#34363c';c.fillRect(0,0,1200,1800);c.fillStyle='#ddd';c.font='32px Arial';for(let y=80;y<1800;y+=100)for(let x=30;x<1200;x+=180)c.fillText('400 1932',x,y);
  c.fillStyle='#eff2e5';c.fillRect(150,600,900,570);c.fillStyle='#aaa';c.fillRect(185,700,160,200);c.fillStyle='black';c.font='22px Arial';
  ['CREDENCIAL SINTETICA DE PRUEBA','NOMBRE','PEREZ','GARCIA','ANA MARIA','DOMICILIO','CALLE ROBLE 123','COL CENTRO 80000','CULIACAN, SIN.','CLAVE DE ELECTOR PRGRAN90010125M100','VIGENCIA 2025 - 2035'].forEach((line,i)=>c.fillText(line,390,640+i*43));
  return canvas.toDataURL('image/png').split(',')[1];
 });
 await page.getByLabel('Subir imagen: Vendedor · Frente de INE',{exact:true}).setInputFiles({name:'foto-vertical-sintetica.png',mimeType:'image/png',buffer:Buffer.from(data,'base64')});
 const photo=page.locator('.photo-card').filter({hasText:'Vendedor · Frente de INE'});
 await photo.getByText('Recorte automático aplicado.',{exact:false}).waitFor();
 assert.equal(await page.getByRole('dialog').count(),0);
 assert.equal(await page.locator('[data-ocr-slot]').count(),0);
 assert.equal(await page.getByRole('button',{name:/Leer.*INE/i}).count(),0);
 assert.equal(await page.locator('#field-seller').inputValue(),'');
 const dimensions=await photo.locator('img').evaluate(img=>({width:img.naturalWidth,height:img.naturalHeight}));
 assert.ok(Math.abs(dimensions.width/dimensions.height-900/570)<.08);
 assert.ok(dimensions.width>=890&&dimensions.width<=950);
 const dialog=page.getByRole('dialog');
 await photo.getByRole('button',{name:'Recortar INE',exact:true}).click();await dialog.waitFor();await dialog.getByRole('button',{name:'Girar 90°'}).click();await dialog.getByRole('button',{name:'Cancelar',exact:true}).click();assert.equal(await photo.locator('img').count(),1);
 await mkdir('artifacts/ine-crop',{recursive:true});await photo.screenshot({path:'artifacts/ine-crop/cropped-review.png'});assert.deepEqual(errors,[]);
 // Ambiguous, low-contrast photos must remain intact and editable manually.
 const blank=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=600;c.height=900;const x=c.getContext('2d');x.fillStyle='#888';x.fillRect(0,0,600,900);return c.toDataURL().split(',')[1];});
 await page.getByLabel('Subir imagen: Comprador · Frente de INE',{exact:true}).setInputFiles({name:'sin-bordes.png',mimeType:'image/png',buffer:Buffer.from(blank,'base64')});
 const buyer=page.locator('.photo-card').filter({hasText:'Comprador · Frente de INE'});
 await buyer.getByText('No se detectaron los bordes',{exact:false}).waitFor();
 assert.equal(await buyer.locator('img').evaluate(img=>img.naturalWidth/img.naturalHeight),600/900);
 await buyer.getByRole('button',{name:'Recortar INE',exact:true}).click();await dialog.waitFor();
 const box=await dialog.locator('canvas').boundingBox();await page.mouse.move(box.x+box.width*.1,box.y+box.height*.2);await page.mouse.down();await page.mouse.move(box.x+box.width*.9,box.y+box.height*.6,{steps:10});await page.mouse.up();
 await dialog.getByRole('button',{name:'Usar recorte',exact:true}).click();await buyer.getByText('Recorte ajustado manualmente.',{exact:true}).waitFor();
 assert.equal(await page.locator('#field-buyer').inputValue(),'');assert.deepEqual(errors,[]);
 assert.ok(!requests.some(url=>/vendor\/ocr|tesseract/.test(url)));
 console.log('INE: recorte automático sin OCR, formulario intacto, ajuste manual y foto original conservada cuando no se detectan bordes.');
}finally{await browser.close();await app.close();}
