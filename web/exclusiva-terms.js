import {integerWords} from './pagare-amount.js';
export function commissionTerms(raw){
 const text=String(raw??'').trim().replace(',','.');
 if(!text)return {commission:'',commissionWords:''};
 if(!/^\d{1,3}(\.\d{0,2})?$/.test(text)||Number(text)>100)throw Error('Comisión: escribe un porcentaje entre 0 y 100, con hasta dos decimales.');
 const commission=String(Number(text)),[whole,fraction]=commission.split('.');
 const words=integerWords(Number(whole))+(fraction?' punto '+[...fraction].map(digit=>integerWords(Number(digit))).join(' '):'')+' por ciento';
 return {commission,commissionWords:words[0].toUpperCase()+words.slice(1)};
}
