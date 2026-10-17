import {chromium} from 'playwright';
import {mkdir,readFile} from 'node:fs/promises';
import {createServer} from 'node:http';
import {resolve,extname} from 'node:path';
import assert from 'node:assert/strict';
const root=resolve('dist');
const server=createServer(async(request,response)=>{try{
 const pathname=decodeURIComponent(new URL(request.url,'http://local').pathname);
 const file=resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
 if(!file.startsWith(root+'/')){response.writeHead(403).end();return;}
 const body=await readFile(file);const mime={'.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.html':'text/html','.json':'application/json','.pdf':'application/pdf'}[extname(file)]||'application/octet-stream';response.writeHead(200,{'Content-Type':mime}).end(body);
}catch{response.writeHead(404).end();}});
await new Promise(resolve=>server.listen(8093,'127.0.0.1',resolve));
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
try{
 const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true,acceptDownloads:true});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:8093/water.html');
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
 await page.goto('http://127.0.0.1:8093/');await page.getByRole('link',{name:'Agua',exact:true}).click();assert.ok(page.url().endsWith('/water.html'));
 console.log('Agua: campos, categoría doméstica, fechas, descarga y vista móvil correctos.');
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
