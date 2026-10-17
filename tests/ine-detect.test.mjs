import test from 'node:test';
import assert from 'node:assert/strict';
import {findCardRegion} from '../web/ine-detect.js';
function fixture(w,h,rect){
 const data=new Uint8ClampedArray(w*h*4);
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=(y*w+x)*4,inside=rect&&x>=rect.x&&x<rect.x+rect.w&&y>=rect.y&&y<rect.y+rect.h;const value=inside?225:50;data[i]=data[i+1]=data[i+2]=value;data[i+3]=255;}
 return data;
}
test('INE: detecta credencial horizontal y vertical sin leer datos',()=>{
 for(const rect of [{x:40,y:100,w:180,h:114},{x:90,y:40,w:114,h:180}]){
  const found=findCardRegion(fixture(300,300,rect),300,300);assert.ok(found);
  assert.equal(found.x,rect.x/300);assert.equal(found.y,rect.y/300);assert.equal(found.w,rect.w/300);assert.equal(found.h,rect.h/300);
 }
});
test('INE: conserva fotos sin bordes y descarta formas que no son de tarjeta',()=>{
 assert.equal(findCardRegion(fixture(200,300),200,300),null);
 assert.equal(findCardRegion(fixture(300,300,{x:50,y:50,w:200,h:200}),300,300),null);
 assert.equal(findCardRegion(fixture(300,200,{x:0,y:0,w:300,h:200}),300,200),null);
});
