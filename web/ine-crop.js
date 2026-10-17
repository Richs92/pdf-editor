// Local image crop. The original remains in memory for subsequent adjustments.
export async function cropINEPhoto(source){
 const url=URL.createObjectURL(source),image=new Image();image.src=url;
 try{await image.decode();return await cropDialog(image,source);}finally{URL.revokeObjectURL(url);}
}
function cropDialog(image,source){return new Promise(resolve=>{
 const dialog=document.createElement('dialog');dialog.className='ine-crop-dialog';
 const title=document.createElement('h2');title.textContent='Encuadra únicamente la INE';
 const hint=document.createElement('p');hint.textContent='Arrastra sobre la imagen desde una esquina de la credencial hasta la opuesta. Deja fuera el teclado, la mesa y otros objetos. Usa Girar si hace falta.';
 const canvas=document.createElement('canvas');canvas.setAttribute('aria-label','Área para recortar la INE');
 let rotated=0,rect={x:0,y:0,w:1,h:1},start,dragging=false;
 const stage=document.createElement('canvas');
 const buttons=document.createElement('div');buttons.className='crop-actions';
 const makeButton=text=>{const button=document.createElement('button');button.type='button';button.textContent=text;buttons.append(button);return button;};
 const rotate=makeButton('Girar 90°'),reset=makeButton('Restablecer'),use=makeButton('Usar recorte y leer'),whole=makeButton('Usar foto completa'),cancel=makeButton('Cancelar');
 const status=document.createElement('p');status.setAttribute('role','status');
 let finished=false;function finish(value){if(finished)return;finished=true;dialog.close();dialog.remove();resolve(value);}
 function draw(){
  const c=canvas.getContext('2d'),w=canvas.width,h=canvas.height;c.clearRect(0,0,w,h);c.drawImage(stage,0,0,w,h);
  c.fillStyle='rgba(0,0,0,.5)';c.beginPath();c.rect(0,0,w,h);c.rect(rect.x*w,rect.y*h,rect.w*w,rect.h*h);c.fill('evenodd');
  c.strokeStyle='#14a884';c.lineWidth=4;c.strokeRect(rect.x*w,rect.y*h,rect.w*w,rect.h*h);
 }
 function prepare(){
  const scale=Math.min(1,1200/Math.max(image.naturalWidth,image.naturalHeight)),iw=Math.round(image.naturalWidth*scale),ih=Math.round(image.naturalHeight*scale);
  stage.width=rotated%2?ih:iw;stage.height=rotated%2?iw:ih;const c=stage.getContext('2d');c.fillStyle='white';c.fillRect(0,0,stage.width,stage.height);c.translate(stage.width/2,stage.height/2);c.rotate(rotated*Math.PI/2);c.drawImage(image,-iw/2,-ih/2,iw,ih);
  const previewScale=Math.min(1,1000/Math.max(stage.width,stage.height));canvas.width=Math.round(stage.width*previewScale);canvas.height=Math.round(stage.height*previewScale);rect={x:0,y:0,w:1,h:1};draw();
 }
 const point=event=>{const box=canvas.getBoundingClientRect();return{x:Math.max(0,Math.min(1,(event.clientX-box.left)/box.width)),y:Math.max(0,Math.min(1,(event.clientY-box.top)/box.height))};};
 canvas.addEventListener('pointerdown',event=>{start=point(event);dragging=true;canvas.setPointerCapture(event.pointerId);event.preventDefault();});
 canvas.addEventListener('pointermove',event=>{if(!dragging)return;const end=point(event);rect={x:Math.min(start.x,end.x),y:Math.min(start.y,end.y),w:Math.abs(start.x-end.x),h:Math.abs(start.y-end.y)};draw();});
 const end=()=>{dragging=false;};canvas.addEventListener('pointerup',end);canvas.addEventListener('pointercancel',end);
 rotate.addEventListener('click',()=>{rotated=(rotated+1)%4;prepare();});reset.addEventListener('click',prepare);
 whole.addEventListener('click',()=>finish(source));cancel.addEventListener('click',()=>finish(null));dialog.addEventListener('cancel',event=>{event.preventDefault();finish(null);});
 use.addEventListener('click',async()=>{
  const fullWidth=rotated%2?image.naturalHeight:image.naturalWidth,fullHeight=rotated%2?image.naturalWidth:image.naturalHeight;
  const cropWidth=rect.w*fullWidth,cropHeight=rect.h*fullHeight;
  if(cropWidth<180||cropHeight<100){status.textContent='El recorte es demasiado pequeño. Incluye la credencial completa.';return;}
  use.disabled=true;const output=document.createElement('canvas'),scale=Math.min(1,3200/Math.max(cropWidth,cropHeight));output.width=Math.round(cropWidth*scale);output.height=Math.round(cropHeight*scale);
  const c=output.getContext('2d');c.fillStyle='white';c.fillRect(0,0,output.width,output.height);c.scale(scale,scale);c.translate(-rect.x*fullWidth,-rect.y*fullHeight);c.translate(fullWidth/2,fullHeight/2);c.rotate(rotated*Math.PI/2);c.drawImage(image,-image.naturalWidth/2,-image.naturalHeight/2);
  const blob=await new Promise(done=>output.toBlob(done,'image/jpeg',.95));if(!blob){status.textContent='No se pudo recortar. Vuelve a intentar.';use.disabled=false;return;}finish(blob);
 });
 dialog.append(title,hint,canvas,status,buttons);document.body.append(dialog);prepare();dialog.showModal();
 });}
