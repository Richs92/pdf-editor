import {chromium} from 'playwright';
import {mkdir,readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import PizZip from 'pizzip';
import {startTestApp,browserLogin} from '../helpers/test-app.mjs';
const app=await startTestApp();
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
try{
 const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true,acceptDownloads:true});
 const external=[],uploads=[],errors=[];
 page.on('request',request=>{if(!request.url().startsWith(app.url)&&!request.url().startsWith('blob:')&&!request.url().startsWith('data:'))external.push(request.url());if(request.method()!=='GET')uploads.push(request.url());});
 page.on('pageerror',error=>errors.push(error.message));
 await browserLogin(page,app.url);await page.goto(app.url+'/contracts.html');await page.locator('#workspace').waitFor({state:'visible'});
 const photo=async(firstName)=>Buffer.from(await page.evaluate(firstName=>{
  const canvas=document.createElement('canvas');canvas.width=1500;canvas.height=1000;const c=canvas.getContext('2d');c.fillStyle='white';c.fillRect(0,0,1500,1000);c.fillStyle='black';c.font='36px Arial';
  (firstName.startsWith('CIC:')?['IDENTIFICACION SINTETICA DE PRUEBA',firstName,'OCR: 1234567890123']:['IDENTIFICACION SINTETICA DE PRUEBA','NOMBRE','PEREZ','GARCIA',firstName,'DOMICILIO','CALLE ROBLE 123','COL CENTRO 80000','CULIACAN, SIN.','CLAVE DE ELECTOR PRGRAN90010125M100','CURP PEGX900101MXXAAA00','VIGENCIA 2025 - 2035']).forEach((line,i)=>c.fillText(line,60,65+i*65));
  return canvas.toDataURL('image/png').split(',')[1];
 },firstName),'base64');
 const sellerPhoto=await photo('ANA MARIA'),buyerPhoto=await photo('LUIS PEDRO');
 const attach=async(label,buffer,face='Frente')=>page.getByLabel('Subir imagen: '+label+' · '+face+' de INE',{exact:true}).setInputFiles({name:'ine-sintetica.png',mimeType:'image/png',buffer});
 const review=(side,face='front')=>page.locator(`[data-ocr-slot="${side}-${face}"]`);
 await attach('Vendedor',sellerPhoto);await review('seller').getByRole('button',{name:'Aplicar datos revisados'}).waitFor({timeout:120000});
 assert.equal(await page.locator('#field-seller').inputValue(),'','OCR must wait for review');
 assert.match(await review('seller').locator('[data-ocr-field="name"]').inputValue(),/PEREZ GARCIA ANA MARIA/);
 assert.match(await review('seller').locator('[data-ocr-field="address"]').inputValue(),/CALLE ROBLE 123/);
 await review('seller').locator('[data-ocr-field="name"]').fill('ANA MARIA PEREZ GARCIA');
 await review('seller').getByRole('button',{name:'Aplicar datos revisados'}).click();assert.equal(await page.locator('#field-seller').inputValue(),'ANA MARIA PEREZ GARCIA');assert.match(await page.locator('#field-sellerAddress').inputValue(),/CALLE ROBLE 123, COL CENTRO 80000, CULIACAN/);
 await attach('Vendedor',await photo('CIC: 123456789'),'Reverso');
 await review('seller','back').getByRole('button',{name:'Aplicar datos revisados'}).waitFor({timeout:120000});
 await review('seller','back').getByRole('button',{name:'Aplicar datos revisados'}).click();assert.equal(await page.locator('#field-sellerId').inputValue(),'INE, CIC: 123456789');
 await attach('Comprador',buyerPhoto);await review('buyer').getByRole('button',{name:'Aplicar datos revisados'}).waitFor({timeout:120000});

 await review('buyer').getByRole('button',{name:'Aplicar datos revisados'}).click();assert.match(await page.locator('#field-buyer').inputValue(),/PEREZ GARCIA LUIS PEDRO/);assert.equal(await page.locator('#field-buyerId').inputValue(),'');assert.equal(await page.locator('#field-seller').inputValue(),'ANA MARIA PEREZ GARCIA');
 // Replacing data already entered needs an explicit confirmation.
 await page.locator('#field-buyer').fill('COMPRADOR ESCRITO MANUALMENTE');
 page.once('dialog',dialog=>dialog.dismiss());await review('buyer').getByRole('button',{name:'Aplicar datos revisados'}).click();assert.equal(await page.locator('#field-buyer').inputValue(),'COMPRADOR ESCRITO MANUALMENTE');
 page.once('dialog',dialog=>dialog.accept());await review('buyer').getByRole('button',{name:'Aplicar datos revisados'}).click();assert.match(await page.locator('#field-buyer').inputValue(),/LUIS PEDRO/);
 await attach('Comprador',await photo('CIC: 987654321'),'Reverso');
 await review('buyer','back').getByRole('button',{name:'Aplicar datos revisados'}).waitFor({timeout:120000});
 await review('buyer','back').getByRole('button',{name:'Aplicar datos revisados'}).click();assert.equal(await page.locator('#field-buyerId').inputValue(),'INE, CIC: 987654321');
 await page.getByRole('button',{name:'Preparar documento',exact:true}).click();await page.locator('#exports').waitFor({state:'visible',timeout:60000});
 const pending=page.waitForEvent('download');await page.locator('#word-download').click();await mkdir('artifacts/ine',{recursive:true});await(await pending).saveAs('artifacts/ine/contrato-ine.docx');
 const zip=new PizZip(await readFile('artifacts/ine/contrato-ine.docx'));const xml=zip.file('word/document.xml').asText();assert.ok(xml.includes('ANA MARIA PEREZ GARCIA'));assert.ok(xml.includes('PEREZ GARCIA LUIS PEDRO'));assert.equal(Object.keys(zip.files).filter(name=>name.includes('terminavit-ine-')).length,4);assert.equal((xml.match(/TerminavitINE/g)||[]).length,2);
 const pdfDownload=page.waitForEvent('download',{timeout:90000});await page.locator('#pdf-download').click();await(await pdfDownload).saveAs('artifacts/ine/contrato-ine.pdf');
 // An upload to a different document must never reuse a previous person's OCR result.
 await page.locator('.tab[data-group="Pagaré"]').click();await attach('Suscriptor',sellerPhoto);await review('seller').getByRole('button',{name:'Aplicar datos revisados'}).waitFor({timeout:120000});
 await review('seller').getByRole('button',{name:'Aplicar datos revisados'}).click();assert.match(await page.locator('#field-subscriber').inputValue(),/ANA MARIA/);assert.equal(await page.locator('#field-beneficiary').inputValue(),'TERMINAVIT');
 // OCR failure must leave the attachment and manual form usable.
 await page.context().route('**/vendor/ocr/spa.traineddata.gz',route=>route.abort());
 await attach('Beneficiario',buyerPhoto);
 await review('buyer').getByText('No se pudo completar la lectura.',{exact:false}).waitFor({timeout:120000});
 assert.equal(await page.locator('#field-beneficiary').inputValue(),'TERMINAVIT');
 assert.equal(await page.locator('.photo-card').filter({hasText:'Beneficiario · Frente de INE'}).locator('img').count(),1);
 await page.context().unroute('**/vendor/ocr/spa.traineddata.gz');
 await review('buyer').getByRole('button',{name:'Volver a leer INE'}).click();
 await review('buyer').getByRole('button',{name:'Aplicar datos revisados'}).waitFor({timeout:120000});
 // Removing a photo also removes its extracted personal data.
 await page.locator('.photo-card').filter({hasText:'Beneficiario · Frente de INE'}).getByRole('button',{name:'Quitar foto'}).click();
 assert.equal(await review('buyer').count(),0);assert.equal(await page.locator('#field-beneficiary').inputValue(),'TERMINAVIT');
 assert.equal(await page.evaluate(()=>localStorage.length+sessionStorage.length),0);
 assert.deepEqual(await page.evaluate(()=>indexedDB.databases().then(items=>items.map(item=>item.name))),[]);
 assert.deepEqual(external,[]);assert.ok(uploads.every(url=>url.includes('/.netlify/functions/api/')));assert.ok(!JSON.stringify(app.state.logs).includes('PEREZ'));
 assert.deepEqual(errors,[]);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:'artifacts/ine/revision-mobile.png',fullPage:true});
 console.log('INE: OCR real local, revisión, correcciones, personas separadas, reemplazo confirmado, Word con anexos, pagaré y privacidad correctos.');
}finally{await browser.close();await app.close();}
