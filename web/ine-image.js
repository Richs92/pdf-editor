export async function prepareINEImage(source){
 const local=source instanceof Blob,url=local?URL.createObjectURL(source):source,image=new Image();image.src=url;
 try{
  await image.decode();const longest=Math.max(image.naturalWidth,image.naturalHeight),scale=Math.min(2.5,Math.max(1,2200/longest),3200/longest);
  const canvas=document.createElement('canvas');canvas.width=Math.round(image.naturalWidth*scale);canvas.height=Math.round(image.naturalHeight*scale);
  const c=canvas.getContext('2d',{willReadFrequently:true});c.fillStyle='white';c.fillRect(0,0,canvas.width,canvas.height);c.drawImage(image,0,0,canvas.width,canvas.height);
  const pixels=c.getImageData(0,0,canvas.width,canvas.height),histogram=new Uint32Array(256),data=pixels.data;
  for(let i=0;i<data.length;i+=4){const gray=Math.round(.299*data[i]+.587*data[i+1]+.114*data[i+2]);data[i]=gray;histogram[gray]++;}
  const count=canvas.width*canvas.height;let low=0,high=255,sum=0;for(let i=0;i<256;i++){sum+=histogram[i];if(sum>=count*.02){low=i;break;}}sum=0;for(let i=255;i>=0;i--){sum+=histogram[i];if(sum>=count*.02){high=i;break;}}
  const range=Math.max(80,high-low);for(let i=0;i<data.length;i+=4){const gray=Math.max(0,Math.min(255,Math.round((data[i]-low)*255/range)));data[i]=data[i+1]=data[i+2]=gray;data[i+3]=255;}
  c.putImageData(pixels,0,0);return canvas;
 }finally{if(local)URL.revokeObjectURL(url);}
}
