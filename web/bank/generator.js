import {currentMonth} from '../dates.js';
import {bankFields} from './fields.js';
const months=['ENERO','FEBRERO','MARZO','ABRIL','MAYO','JUNIO','JULIO','AGOSTO','SEPTIEMBRE','OCTUBRE','NOVIEMBRE','DICIEMBRE'];
const short=['ENE','FEB','MAR','ABR','MAY','JUN','JUL','AGO','SEP','OCT','NOV','DIC'];
export function bankDates(now=new Date()){
 const current=currentMonth(now),previous=new Date(Date.UTC(current.year,current.month-2,1));
 const year=previous.getUTCFullYear(),month=previous.getUTCMonth(),days=new Date(Date.UTC(year,month+1,0)).getUTCDate();
 return {period:`1 DE ${months[month]} AL ${days} DE ${months[month]} DE ${year}`,cutoff:`${days} ${months[month]} ${year}`,days:String(days),yearDays:String((Date.UTC(year,month,days)-Date.UTC(year,0,0))/86400000),movementDate:`1 ${short[month]}`,year,month:month+1};
}
export function validateBank(data){
 const result={};for(const key of ['name','address','client','rfc','account','clabe'])result[key]=String(data[key]??'').trim();
 result.rfc=result.rfc.toUpperCase();
 if(!result.name||result.name.length>100||/[\r\n]/.test(result.name))throw Error('Escribe un nombre de hasta 100 caracteres.');
 const address=result.address.split(/\r?\n/).map(line=>line.trim());if(!result.address||address.length>4||address.some(line=>line.length>65))throw Error('La dirección admite hasta cuatro líneas de 65 caracteres.');
 for(const [key,length,label]of [['client',9,'Número de cliente'],['account',13,'Cuenta Conecta BanBajío'],['clabe',18,'CLABE interbancaria']])if(!new RegExp('^[0-9]{'+length+'}$').test(result[key]))throw Error(`${label}: escribe ${length} dígitos, conservando los ceros iniciales.`);
 if(!/^[A-ZÑ&]{3,4}[0-9]{6}[A-Z0-9]{3}$/.test(result.rfc))throw Error('Revisa el formato del RFC.');
 for(let i=0;i<4;i++)result['address'+i]=address[i]||'';
 result.accountLabel='CUENTA CONECTA BANBAJIO '+result.account;result.detail='DETALLE DE LA CUENTA: CUENTA CONECTA BANBAJIO #'+result.account;
 return result;
}
export async function generateBank(PDFLib,templateBytes,data,now=new Date()){
 const values={...validateBank(data),...bankDates(now)};values.account=values.accountLabel;
 const doc=await PDFLib.PDFDocument.load(templateBytes);if(doc.getPageCount()!==1)throw Error('La plantilla debe contener únicamente la primera hoja.');
 const page=doc.getPages()[0],font=await doc.embedFont(PDFLib.StandardFonts.Helvetica),bold=await doc.embedFont(PDFLib.StandardFonts.HelveticaBold);
 for(const field of bankFields){
  const text=values[field.key];if(!text)continue;const selected=field.bold?bold:font;let size=field.size,width;
  try{width=selected.widthOfTextAtSize(text,size);}catch{throw Error('Usa caracteres latinos en el nombre y la dirección.');}
  while(width>field.width&&size>6){size-=.25;width=selected.widthOfTextAtSize(text,size);}
  const factor=Math.min(1,field.width/width),x=field.right!==null?field.right-width*factor:field.x;
  page.pushOperators(PDFLib.pushGraphicsState(),PDFLib.concatTransformationMatrix(factor,0,0,1,x,0));page.drawText(text,{x:0,y:page.getHeight()-field.baseline,size,font:selected});page.pushOperators(PDFLib.popGraphicsState());
 }
 page.drawText('DOCUMENTO EDITADO',{x:95,y:290,size:36,font:bold,color:PDFLib.rgb(.4,.4,.4),rotate:PDFLib.degrees(30),opacity:.2});
 page.drawText('COPIA EDITADA · SOLO HOJA 1 DEL ORIGINAL',{x:18,y:34,size:8,font:bold});
 page.drawText('NO VÁLIDO COMO ESTADO DE CUENTA EMITIDO POR EL BANCO',{x:18,y:22,size:8,font:bold});
 doc.setTitle('BanBajío · copia editada de la primera hoja');return doc.save();
}
