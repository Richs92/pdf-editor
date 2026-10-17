// Find a light, card-shaped region locally. Ambiguous photos keep their original.
// This detects the physical rectangle; it does not read or verify identity data.
export function findCardRegion(rgba,width,height){
 const gray=new Uint8Array(width*height);
 for(let i=0;i<gray.length;i++)gray[i]=Math.round(.299*rgba[i*4]+.587*rgba[i*4+1]+.114*rgba[i*4+2]);
 let best=null;
 for(const threshold of [105,135,165,195,220]){
  const seen=new Uint8Array(gray.length),queue=new Int32Array(gray.length);
  for(let seed=0;seed<gray.length;seed++){
   if(seen[seed]||gray[seed]<threshold)continue;
   let head=0,tail=1,minX=width,minY=height,maxX=0,maxY=0;queue[0]=seed;seen[seed]=1;
   while(head<tail){const p=queue[head++],x=p%width,y=Math.floor(p/width);minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);
    for(const n of [x? p-1:-1,x<width-1?p+1:-1,y?p-width:-1,y<height-1?p+width:-1])if(n>=0&&!seen[n]&&gray[n]>=threshold){seen[n]=1;queue[tail++]=n;}
   }
   const w=maxX-minX+1,h=maxY-minY+1,area=w*h,fraction=area/gray.length,ratio=Math.max(w,h)/Math.min(w,h),fill=tail/area;
   if(fraction<.07||fraction>.94||ratio<1.35||ratio>1.95||fill<.62||w<40||h<40)continue;
   // Require separation from the background on every visible side. A bright
   // patch inside a card is not enough to justify cutting off the card edges.
   const contrasts=[];
   const side=(vertical,inside,outside,from,to)=>{if(outside<0||outside>=(vertical?width:height))return;let a=0,b=0,n=0;for(let v=from;v<=to;v++){a+=gray[vertical?v*width+inside:inside*width+v];b+=gray[vertical?v*width+outside:outside*width+v];n++;}contrasts.push((a-b)/n);};
   const inset=Math.max(2,Math.round(Math.min(w,h)*.035));
   side(true,minX+inset,minX-3,minY+inset,maxY-inset);side(true,maxX-inset,maxX+3,minY+inset,maxY-inset);
   side(false,minY+inset,minY-3,minX+inset,maxX-inset);side(false,maxY-inset,maxY+3,minX+inset,maxX-inset);
   if(contrasts.length<3||contrasts.some(value=>value<16))continue;
   const score=fill+fraction*.3-Math.abs(ratio-1.586)*.6+Math.min(...contrasts)/255;
   if(!best||score>best.score)best={x:minX/width,y:minY/height,w:w/width,h:h/height,score};
  }
 }
 return best;
}
export async function autoCropINE(source){
 const url=URL.createObjectURL(source),image=new Image();image.src=url;
 try{
  await image.decode();const scale=Math.min(1,360/Math.max(image.naturalWidth,image.naturalHeight));
  const probe=document.createElement('canvas');probe.width=Math.round(image.naturalWidth*scale);probe.height=Math.round(image.naturalHeight*scale);
  const ctx=probe.getContext('2d',{willReadFrequently:true});ctx.drawImage(image,0,0,probe.width,probe.height);
  const region=findCardRegion(ctx.getImageData(0,0,probe.width,probe.height).data,probe.width,probe.height);
  if(!region)return {blob:source,detected:false};
  // Keep a small margin to protect text at the edge of the credential.
  const margin=.012,x=Math.max(0,region.x-region.w*margin),y=Math.max(0,region.y-region.h*margin);
  const w=Math.min(1-x,region.w*(1+margin*2)),h=Math.min(1-y,region.h*(1+margin*2));
  const sw=w*image.naturalWidth,sh=h*image.naturalHeight,output=document.createElement('canvas'),s=Math.min(1,2400/Math.max(sw,sh));
  output.width=Math.round(sw*s);output.height=Math.round(sh*s);output.getContext('2d').drawImage(image,x*image.naturalWidth,y*image.naturalHeight,sw,sh,0,0,output.width,output.height);
  const blob=await new Promise(resolve=>output.toBlob(resolve,'image/jpeg',.95));
  return {blob:blob||source,detected:Boolean(blob)};
 }finally{URL.revokeObjectURL(url);}
}
