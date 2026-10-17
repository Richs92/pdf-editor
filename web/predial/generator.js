import {predialFields} from './fields.js';
const units=['CERO','UNO','DOS','TRES','CUATRO','CINCO','SEIS','SIETE','OCHO','NUEVE','DIEZ','ONCE','DOCE','TRECE','CATORCE','QUINCE','DIECISÉIS','DIECISIETE','DIECIOCHO','DIECINUEVE','VEINTE','VEINTIUNO','VEINTIDÓS','VEINTITRÉS','VEINTICUATRO','VEINTICINCO','VEINTISÉIS','VEINTISIETE','VEINTIOCHO','VEINTINUEVE'];
const tens=['','','','TREINTA','CUARENTA','CINCUENTA','SESENTA','SETENTA','OCHENTA','NOVENTA'];
const hundreds=['','CIENTO','DOSCIENTOS','TRESCIENTOS','CUATROCIENTOS','QUINIENTOS','SEISCIENTOS','SETECIENTOS','OCHOCIENTOS','NOVECIENTOS'];
function apocopate(text){return text.replace(/VEINTIUNO$/,'VEINTIÚN').replace(/UNO$/,'UN');}
function integerWords(n){
 if(n<30)return units[n];
 if(n<100)return tens[Math.floor(n/10)]+(n%10?' Y '+units[n%10]:'');
 if(n===100)return 'CIEN';
 if(n<1000)return hundreds[Math.floor(n/100)]+(n%100?' '+integerWords(n%100):'');
 if(n<1000000)return(Math.floor(n/1000)===1?'MIL':apocopate(integerWords(Math.floor(n/1000)))+' MIL')+(n%1000?' '+integerWords(n%1000):'');
 return(Math.floor(n/1000000)===1?'UN MILLÓN':apocopate(integerWords(Math.floor(n/1000000)))+' MILLONES')+(n%1000000?' '+integerWords(n%1000000):'');
}
export function decimalValue(raw,label){
 const value=String(raw??'').trim();
 if(!/^\d{1,9}(\.\d{1,2})?$/.test(value))throw Error(`${label}: escribe un número de hasta nueve dígitos y dos decimales, sin comas.`);
 const [whole,fraction='']=value.split('.');return {whole:Number(whole),cents:Number(fraction.padEnd(2,'0')),fixed:Number(whole)+'.'+fraction.padEnd(2,'0')};
}
export function moneyWords(raw){
 const {whole,cents}=decimalValue(raw,'Total');
 const number=apocopate(integerWords(whole));
 return `${number}${whole>=1000000&&whole%1000000===0?' DE':''} ${whole===1?'PESO':'PESOS'} ${String(cents).padStart(2,'0')}/100 M.N.`;
}
export function validatePredial(data){
 const cadastre=String(data.cadastre??'');
 if(!/^007(?:-\d{3}){4}-001$/.test(cadastre))throw Error('La clave catastral debe tener 18 números: 007, cuatro bloques de tres dígitos y 001.');
 const name=String(data.name??'').trim(),address=String(data.address??'').trim().replace(/\r?\n/g,' ');
 if(!name||name.length>100||/[\r\n]/.test(name))throw Error('Escribe un nombre de hasta 100 caracteres.');
 if(!address||address.length>220)throw Error('Escribe un domicilio de hasta 220 caracteres.');
 const expiry=String(data.expiry??'');
 if(!/^\d{4}-\d{2}-\d{2}$/.test(expiry))throw Error('Selecciona una fecha de vigencia válida.');
 const date=new Date(expiry+'T12:00:00Z');
 if(!Number.isFinite(date.getTime())||date.toISOString().slice(0,10)!==expiry||Number(expiry.slice(0,4))<1900)throw Error('Selecciona una fecha de vigencia válida.');
 const result={cadastre,name,address,expiry:expiry.split('-').reverse().join('/')};
 for(const key of ['total','terrain','construction']){
  if(data['edit'+key[0].toUpperCase()+key.slice(1)]===true){const value=decimalValue(data[key],key==='total'?'Total':key==='terrain'?'Superficie de terreno':'Superficie construida');result[key]=value.fixed;}
 }
 return result;
}
export async function generatePredial(PDFLib,templateBytes,data){
 const values=validatePredial(data);
 const doc=await PDFLib.PDFDocument.load(templateBytes);
 const page=doc.getPages()[0],font=await doc.embedFont(PDFLib.StandardFonts.Helvetica);
 if(values.total!==undefined){
  const [whole,fraction]=values.total.split('.');
  const formatted=Number(whole).toLocaleString('en-US')+'.'+fraction;
  values.total=' $ '+formatted.padStart(18,'*');values.totalWords=moneyWords(data.total);
 }
 for(const field of predialFields){
  const text=values[field.key]??field.original;
  let size=field.size,width;
  try{width=font.widthOfTextAtSize(text,size);}catch{throw Error('Usa caracteres latinos en el nombre y el domicilio.');}
  if(['name','address','totalWords'].includes(field.key)){
   while(width>field.width&&size>5){size-=.25;width=font.widthOfTextAtSize(text,size);}
  }
  page.pushOperators(PDFLib.pushGraphicsState(),PDFLib.concatTransformationMatrix(Math.min(1,field.width/width),0,0,1,field.x,0));
  page.drawText(text,{x:0,y:page.getHeight()-field.baseline,size,font});
  page.pushOperators(PDFLib.popGraphicsState());
 }
 return doc.save();
}
