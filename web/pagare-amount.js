const units=['cero','uno','dos','tres','cuatro','cinco','seis','siete','ocho','nueve','diez','once','doce','trece','catorce','quince','dieciséis','diecisiete','dieciocho','diecinueve','veinte','veintiuno','veintidós','veintitrés','veinticuatro','veinticinco','veintiséis','veintisiete','veintiocho','veintinueve'];
const tens=['','','','treinta','cuarenta','cincuenta','sesenta','setenta','ochenta','noventa'];
const hundreds=['','ciento','doscientos','trescientos','cuatrocientos','quinientos','seiscientos','setecientos','ochocientos','novecientos'];
const apocopate=text=>text.replace(/veintiuno$/,'veintiún').replace(/uno$/,'un');
export function integerWords(n){
 if(n<30)return units[n];
 if(n<100)return tens[Math.floor(n/10)]+(n%10?' y '+units[n%10]:'');
 if(n===100)return 'cien';
 if(n<1000)return hundreds[Math.floor(n/100)]+(n%100?' '+integerWords(n%100):'');
 if(n<1000000)return(Math.floor(n/1000)===1?'mil':apocopate(integerWords(Math.floor(n/1000)))+' mil')+(n%1000?' '+integerWords(n%1000):'');
 return(Math.floor(n/1000000)===1?'un millón':apocopate(integerWords(Math.floor(n/1000000)))+' millones')+(n%1000000?' '+integerWords(n%1000000):'');
}
function parse(raw){
 let value=String(raw??'').trim().replace(/,/g,'');
 if(!value)return null;
 if(value.startsWith('.'))value='0'+value;
 if(!/^\d{1,9}(\.\d{0,2})?$/.test(value))throw Error('Importe: escribe solo números, hasta nueve dígitos y dos decimales.');
 const [whole,fraction]=value.split('.');return {whole:Number(whole),fraction};
}
export function formatPagareInput(raw){
 const value=parse(raw);if(!value)return '';
 return value.whole.toLocaleString('en-US')+(value.fraction!==undefined?'.'+value.fraction:'');
}
export function pagareAmount(raw){
 const value=parse(raw);if(!value)return {amount:'',amountWords:''};
 const {whole,fraction}=value,cents=(fraction??'').padEnd(2,'0');
 const amount=whole.toLocaleString('en-US')+(fraction!==undefined?'.'+cents:'');
 const words=apocopate(integerWords(whole))+(whole>=1000000&&whole%1000000===0?' de':'')+(whole===1?' peso':' pesos')+(cents!=='00'?' '+cents+'/100':'')+' m.n.';
 return {amount,amountWords:words[0].toUpperCase()+words.slice(1)};
}

// Derive words only where the template defines both monetary fields.
export function contractMoneyPairs(contract){
 const keys=new Set((contract?.fields||[]).map(field=>field.key));
 return ['amount','price','deposit','penalty','balance','earnest','receiptAmount'].filter(key=>keys.has(key)&&keys.has(key+'Words')).map(key=>[key,key+'Words']);
}
