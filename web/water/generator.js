import {currentMonth} from '../dates.js';
import {waterFields} from './fields.js';
const months=['ENERO','FEBRERO','MARZO','ABRIL','MAYO','JUNIO','JULIO','AGOSTO','SEPTIEMBRE','OCTUBRE','NOVIEMBRE','DICIEMBRE'];
const short=['ENE','FEB','MAR','ABR','MAY','JUN','JUL','AGO','SEP','OCT','NOV','DIC'];
export function waterDates(now=new Date()){
 const {year,month}=currentMonth(now);const previousMonth=month===1?12:month-1,previousYear=month===1?year-1:year;
 return {issue:`03 ${months[month-1]} ${year}`,due:`07 ${months[month-1]} ${year}`,billing:`${months[month-1]} ${year}`,currentReading:`03 ${short[month-1]} ${year}`,previousReading:`03 ${short[previousMonth-1]} ${previousYear}`};
}
export function validateWater(data){
 const account=String(data.account??'').trim(),name=String(data.name??'').trim(),address=String(data.address??'').trim().replace(/\r?\n/g,' ');
 if(!/^[0-9]{9}$/.test(account))throw Error('La cuenta debe tener nueve dígitos, conservando los ceros iniciales.');
 if(!name||name.length>100||/[\r\n]/.test(name))throw Error('Escribe un nombre de hasta 100 caracteres.');
 if(!address||address.length>220)throw Error('Escribe una dirección de hasta 220 caracteres.');
 return {account:' '+account,name,address,category:'DOMÉSTICA'};
}
export async function generateWater(PDFLib,templateBytes,data,now=new Date()){
 const values={...validateWater(data),...waterDates(now)};
 const doc=await PDFLib.PDFDocument.load(templateBytes),page=doc.getPages()[0];const font=await doc.embedFont(PDFLib.StandardFonts.Helvetica);
 for(const field of waterFields){
  const text=values[field.key];let size=field.size,width;
  try{width=font.widthOfTextAtSize(text,size);}catch{throw Error('Usa caracteres latinos en el nombre y la dirección.');}
  while(width>field.width&&size>6){size-=.25;width=font.widthOfTextAtSize(text,size);}
  page.pushOperators(PDFLib.pushGraphicsState(),PDFLib.concatTransformationMatrix(Math.min(1,field.width/width),0,0,1,field.x,0));
  page.drawText(text,{x:0,y:page.getHeight()-field.baseline,size,font});
  page.pushOperators(PDFLib.popGraphicsState());
 }
 return doc.save();
}
