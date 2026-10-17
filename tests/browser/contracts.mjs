import {chromium} from 'playwright';
import {mkdir,readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {startTestApp,browserLogin} from '../helpers/test-app.mjs';
const app=await startTestApp();
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
await mkdir('artifacts/contracts',{recursive:true});
try{
 const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true,acceptDownloads:true});
 const uploads=[];page.on('request',request=>{if(request.method()!=='GET')uploads.push(request.url());});
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await browserLogin(page,app.url);
 await page.goto(app.url+'/contracts.html');
 await page.locator('#workspace').waitFor({state:'visible'});
 const catalog=JSON.parse(await readFile('web/contracts-catalog.json','utf8'));
const sample={seller:'ANA PÉREZ GARCÍA',buyer:'LUIS LÓPEZ RUIZ',sellerId:'INE VENDEDOR 123456789',buyerId:'INE COMPRADOR 987654321',sellerAddress:'CALLE DEL VENDEDOR 10, CULIACÁN',buyerAddress:'CALLE DEL COMPRADOR 20, CULIACÁN',civilStatus:'casado bajo separación de bienes, acta 123, libro 2',title:'Escritura 1234 del 10 de enero de 2020, Notaría 5',registry:'Inscripción 42, libro 10',propertyAddress:'CALLE DEL INMUEBLE 30, CULIACÁN, SINALOA, CP 80000',boundaries:'Norte: 10 metros; sur: 10 metros; este: 20 metros; oeste: 20 metros',cadastre:'CAT-12345',folio:'FOL-67890',lien:'Hipoteca a favor de INFONAVIT',credit:'1234567890',balance:'100,000.00',price:'500,000.00',priceWords:'QUINIENTOS MIL',payment:'Transferencia bancaria',deposit:'50,000.00',depositWords:'CINCUENTA MIL',penalty:'100,000.00',penaltyWords:'CIEN MIL',deadline:'30 de noviembre de 2026',jurisdiction:'Culiacán',signCity:'Culiacán, Sinaloa',signHour:'12:00',signDay:'20',signMonth:'octubre',signYear:'2026',notary:'NOTARIO DE PRUEBA',notaryNumber:'5',notaryCity:'Culiacán',spouse:'MARÍA ESPOSA DE PRUEBA',subscriber:'PEDRO SUSCRIPTOR DE PRUEBA',subscriberAddress:'CALLE DEL SUSCRIPTOR 40, CULIACÁN',beneficiary:'TERMINAVIT',beneficiaryAddress:'AVENIDA DEL BENEFICIARIO 50, CULIACÁN',amount:'75,000.00',amountWords:'SETENTA Y CINCO MIL PESOS 00/100 MONEDA NACIONAL',issueCity:'Culiacán, Sinaloa',issueDate:'20 de octubre de 2026',dueDate:'20 de diciembre de 2026',paymentCity:'Culiacán, Sinaloa',ordinaryRate:'40',ordinaryWords:'cuarenta',lateRate:'80',lateWords:'ochenta',noteJurisdiction:'Culiacán, Sinaloa',propertyCity:'Culiacán, Sinaloa',liableParty:'ANA PÉREZ GARCÍA',reserveDays:'5',deadlineDay:'25',deadlineMonth:'octubre',deadlineYear:'2026'};
 // A synthetic ID image, with no real identity information.
 const image=await page.evaluate(()=>{const canvas=document.createElement('canvas');canvas.width=856;canvas.height=540;const c=canvas.getContext('2d');c.fillStyle='#dae9e1';c.fillRect(0,0,856,540);c.fillStyle='#225544';c.font='24px sans-serif';c.fillText('IDENTIFICACION DE PRUEBA - SIN DATOS REALES',30,100);return canvas.toDataURL('image/jpeg').split(',')[1];});
 for(const [index,item] of catalog.entries()){
  await page.locator(`.tab[data-group="${item.group}"]`).click();
  await page.locator(`.template-choice[data-id="${item.id}"]`).click();
  assert.equal(await page.locator('#fields [name]').count(),item.fields.length);
  await page.evaluate(sample=>{for(const el of document.querySelectorAll('#fields input,#fields textarea'))el.value=sample[el.name]||'15';document.querySelector('#contract-form').dispatchEvent(new Event('input',{bubbles:true}));},sample);
  if(item.id==='recibo-apartado'){
   await page.locator('#field-deposit').evaluate(el=>el.closest('details').open=true);
   await page.locator('#field-deposit').fill('10000');
   assert.equal(await page.locator('#field-deposit').inputValue(),'10,000');
   assert.equal(await page.locator('#field-depositWords').inputValue(),'Diez mil pesos m.n.');
  }
  if(index===0||index===1){
   const label=item.id==='pagare'?'Suscriptor':'Vendedor';
   await page.getByLabel('Subir imagen: '+label+' · Frente de INE',{exact:true}).setInputFiles({name:'ine-prueba.jpg',mimeType:'image/jpeg',buffer:Buffer.from(image,'base64')});
   await page.locator('#form-status').filter({hasText:'INE añadida.'}).waitFor();
   if(index===1){
    for(const side of ['Vendedor · Reverso de INE','Comprador · Frente de INE','Comprador · Reverso de INE']){
     await page.getByLabel('Subir imagen: '+side,{exact:true}).setInputFiles({name:'ine-prueba.jpg',mimeType:'image/jpeg',buffer:Buffer.from(image,'base64')});
     await page.locator('#form-status').filter({hasText:'INE añadida.'}).waitFor();
    }
   }
  }
  await page.getByRole('button',{name:'Actualizar vista previa',exact:true}).click();
  await page.locator('#exports').waitFor({state:'visible',timeout:60000});
  assert.ok((await page.locator('#document-preview').innerText()).includes(item.id==='pagare'?sample.subscriber:sample.seller));
  assert.ok(!(await page.locator('#document-preview').innerText()).includes('{seller}'));
  assert.ok(!(await page.locator('#document-preview').innerText()).includes('DATOS A COMPLETAR ANTES DE FIRMAR'));
  assert.ok(await page.locator('#document-preview section.docx').count()>0);
  const before=await page.evaluate(()=>visualViewport.scale);
  const input=page.locator('#fields input').first();await input.evaluate(el=>{el.closest('details').open=true;});await input.focus();
  assert.ok(await input.evaluate(el=>parseFloat(getComputedStyle(el).fontSize))>=16);
  assert.equal(await page.evaluate(()=>visualViewport.scale),before);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  let download=page.waitForEvent('download');await page.locator('#word-download').click();await(await download).saveAs('artifacts/contracts/'+item.id+'.docx');
  download=page.waitForEvent('download',{timeout:90000});await page.locator('#pdf-download').click();await(await download).saveAs('artifacts/contracts/'+item.id+'.pdf');
  if(index===0){
   download=page.waitForEvent('download');await page.locator('#google-download').click();assert.ok((await download).suggestedFilename().endsWith('.docx'));
   await page.screenshot({path:'artifacts/contracts/mobile.png',fullPage:true});
  }
  // Generate the same template with every field cleared, using the real submit button.
  assert.equal(await page.locator('#fields [required]').count(),0);
  await page.evaluate(()=>{for(const el of document.querySelectorAll('#fields input,#fields textarea'))el.value='';document.querySelector('#contract-form').dispatchEvent(new Event('input',{bubbles:true}));});
  assert.equal(await page.locator('#contract-form').evaluate(form=>form.checkValidity()),true);
  await page.getByRole('button',{name:'Actualizar vista previa',exact:true}).click();await page.locator('#exports').waitFor({state:'visible',timeout:60000});
  const blankPreview=await page.locator('#document-preview').innerText();assert.match(blankPreview,/_{24}/);assert.ok(!/\{[a-zA-Z][a-zA-Z0-9]*\}/.test(blankPreview));
  download=page.waitForEvent('download');await page.locator('#word-download').click();await(await download).saveAs('artifacts/contracts/'+item.id+'-blancos.docx');
  download=page.waitForEvent('download',{timeout:90000});await page.locator('#pdf-download').click();await(await download).saveAs('artifacts/contracts/'+item.id+'-blancos.pdf');
  if(index===0){
   await page.locator('#fields [name="subscriber"]').fill('NOMBRE PARCIAL DE PRUEBA');
   await page.getByRole('button',{name:'Actualizar vista previa',exact:true}).click();await page.locator('#exports').waitFor({state:'visible',timeout:60000});
   const partial=await page.locator('#document-preview').innerText();assert.ok(partial.includes('NOMBRE PARCIAL DE PRUEBA'));assert.match(partial,/_{24}/);
  }
  console.log(item.id+': datos completos, vacíos con líneas, Word, PDF y vista móvil correctos');
 }
 assert.deepEqual(errors,[]);assert.ok(uploads.every(url=>url.includes('/.netlify/functions/api/')), 'Solo se envían autenticación y eventos; no documentos ni imágenes');assert.ok(!JSON.stringify(app.state.logs).includes(sample.seller));
 // Data and pictures remain in memory, never in persistent browser storage.
 assert.equal(await page.evaluate(()=>localStorage.length+sessionStorage.length),0);
 await page.setViewportSize({width:1360,height:1000});
 await page.screenshot({path:'artifacts/contracts/desktop.png',fullPage:true});
}finally{await browser.close();await app.close();}
