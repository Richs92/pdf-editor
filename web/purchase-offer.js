import {pagareAmount} from './pagare-amount.js';
export function purchaseOfferAmounts(data){
 const values={};
 for(const key of ['price','deposit','earnest','receiptAmount']){const result=pagareAmount(data[key]);values[key]=result.amount;values[key+'Words']=result.amountWords;}
 values.balance='';values.balanceWords='';
 if(values.price&&values.deposit){
  const cents=raw=>{const [whole,fraction='']=raw.replaceAll(',','').split('.');return Number(whole)*100+Number(fraction.padEnd(2,'0'));};
  const balance=cents(values.price)-cents(values.deposit);if(balance<0)throw Error('El anticipo no puede ser mayor que el precio propuesto.');
  const result=pagareAmount(Math.floor(balance/100)+'.'+String(balance%100).padStart(2,'0'));values.balance=result.amount;values.balanceWords=result.amountWords;
 }
 return values;
}
