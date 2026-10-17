const clean=value=>value.replace(/\s+/g,' ').trim();
export function extractINEFields(text,{face='front'}={}) {
 const lines=String(text??'').normalize('NFC').toUpperCase().split(/\r?\n/).map(clean).filter(Boolean);
 const fields={name:'',address:'',identification:''};
 let section='';const names=[],address=[];
 const stop=/^(?:CLAVE\s+DE\s+ELECTOR|CURP|FECHA|A[ÑN]O|ESTADO|MUNICIPIO|SECCI[ÓO]N|LOCALIDAD|EMISI[ÓO]N|VIGENCIA|CIC|OCR|IDMEX|SEXO)\b/;
 for(const original of lines){
  let line=original.replace(/^N0MBRE\b/,'NOMBRE').replace(/^DOMICILI0\b/,'DOMICILIO');
  if(/^NOMBRE\b/.test(line)){section='name';line=line.replace(/^NOMBRE\s*:?\s*/,'');}
  else if(/^DOMICILIO\b/.test(line)){section='address';line=line.replace(/^DOMICILIO\s*:?\s*/,'');}
  else if(stop.test(line)){section='';continue;}
  line=line.replace(/(?:^|\s+)SEXO\s*:?\s*[HM].*$/,'').trim();
  if(!line||/^(?:INSTITUTO|NACIONAL|ELECTORAL|M[ÉE]XICO|CREDENCIAL|PARA VOTAR|FIRMA)\b/.test(line))continue;
  if(section==='name'&&names.length<4)names.push(line);
  if(section==='address'&&address.length<5)address.push(line);
 }
 fields.name=names.join(' ');fields.address=address.join('\n');
 const joined=lines.join('\n');
 // The credential number comes from the back, never from CURP or the voter key.
 if(face==='back'){
  fields.name='';fields.address='';
  const cic=joined.match(/\bCIC\s*:?\s*(\d{9})(?!\d)/);
  // The first nine digits after IDMEX are CIC; the tenth is its check digit.
  const mrz=joined.match(/\bIDMEX\s*(\d{9})\d(?=[<\s]|$)/);
  const ocr=joined.match(/\bOCR\s*:?\s*(\d{13})(?!\d)/);
  if(cic||mrz)fields.identification='INE, CIC: '+(cic||mrz)[1];
  else if(ocr)fields.identification='INE, OCR: '+ocr[1];
 }

 return fields;
}
export function ineTargetFields(documentId,side){
 const seller=side==='seller';
 return documentId==='pagare'?{name:seller?'subscriber':'beneficiary',address:seller?'subscriberAddress':'beneficiaryAddress'}:{name:seller?'seller':'buyer',address:seller?'sellerAddress':'buyerAddress',identification:seller?'sellerId':'buyerId'};
}
