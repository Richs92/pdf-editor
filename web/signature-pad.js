// Ink stays in memory and is exported as a transparent PNG, never uploaded.
export function signaturePad(label,saved,onSave,onRemove){
 const card=document.createElement('div');card.className='signature-card';
 const title=document.createElement('h3');title.textContent=label;
 const canvas=document.createElement('canvas');canvas.width=900;canvas.height=330;canvas.setAttribute('aria-label','Dibujar firma: '+label);canvas.style.touchAction='none';
 const ctx=canvas.getContext('2d');ctx.lineWidth=5;ctx.lineCap='round';ctx.lineJoin='round';ctx.strokeStyle='#111';let ink=false,active=null;
 const status=document.createElement('p');status.className='hint';status.setAttribute('role','status');status.textContent=saved?'Firma incluida en el documento.':'Firma con el dedo o el mouse y pulsa Usar firma.';
 if(saved){const image=new Image();image.onload=()=>{if(!ink){const scale=Math.min((canvas.width-40)/saved.width,(canvas.height-40)/saved.height);ctx.drawImage(image,(canvas.width-saved.width*scale)/2,(canvas.height-saved.height*scale)/2,saved.width*scale,saved.height*scale);}};image.src=saved.url;}
 const point=e=>{const r=canvas.getBoundingClientRect();return{x:(e.clientX-r.left)*canvas.width/r.width,y:(e.clientY-r.top)*canvas.height/r.height};};
 canvas.addEventListener('pointerdown',e=>{if(active!==null)return;active=e.pointerId;canvas.setPointerCapture(e.pointerId);const p=point(e);ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(p.x+.1,p.y+.1);ctx.stroke();ink=true;e.preventDefault();});
 canvas.addEventListener('pointermove',e=>{if(active!==e.pointerId)return;const p=point(e);ctx.lineTo(p.x,p.y);ctx.stroke();});
 const end=e=>{if(active===e.pointerId)active=null;};canvas.addEventListener('pointerup',end);canvas.addEventListener('pointercancel',end);
 const actions=document.createElement('div');actions.className='photo-buttons';
 const button=(text,fn)=>{const b=document.createElement('button');b.type='button';b.textContent=text;b.addEventListener('click',fn);actions.append(b);};
 button('Limpiar y quitar firma',()=>{ctx.clearRect(0,0,canvas.width,canvas.height);ink=false;onRemove();});
 button('Usar firma',()=>{
  if(!ink){status.textContent=saved?'La firma guardada ya está incluida.':'Primero dibuja tu firma.';return;}
  const data=ctx.getImageData(0,0,canvas.width,canvas.height).data;let x0=canvas.width,y0=canvas.height,x1=0,y1=0;
  for(let y=0;y<canvas.height;y++)for(let x=0;x<canvas.width;x++)if(data[(y*canvas.width+x)*4+3]){x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y);}
  if(x1<=x0||y1<=y0){status.textContent='Dibuja una firma antes de guardarla.';return;}
  x0=Math.max(0,x0-10);y0=Math.max(0,y0-10);x1=Math.min(canvas.width,x1+11);y1=Math.min(canvas.height,y1+11);
  const out=document.createElement('canvas');out.width=x1-x0;out.height=y1-y0;out.getContext('2d').drawImage(canvas,x0,y0,out.width,out.height,0,0,out.width,out.height);
  const url=out.toDataURL('image/png'),raw=atob(url.split(',')[1]);onSave({url,width:out.width,height:out.height,bytes:Uint8Array.from(raw,c=>c.charCodeAt(0))});
 });
 card.append(title,canvas,actions,status);return card;
}
