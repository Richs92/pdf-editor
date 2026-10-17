// Ñ is a distinct letter in Spanish; remove vowel accents while retaining Ñ.
export function normalizeCFEText(value) {
  return String(value ?? '').normalize('NFC').replace(/[áéíóúü]/gi, character => ({á:'a',é:'e',í:'i',ó:'o',ú:'u',ü:'u'}[character.toLowerCase()])).toUpperCase();
}
export function cfeAddressLines(data) {
  if (!Object.hasOwn(data, 'street')) {
    const lines=normalizeCFEText(data.address).trim().split(/\r?\n/).map(line=>line.trim());
    if(lines.length>4||lines.some(line=>!line||line.length>65))throw new Error('La dirección debe tener de 1 a 4 líneas, de hasta 65 caracteres cada una.');
    return lines;
  }
  const read=key=>normalizeCFEText(data[key]).trim();
  const street=read('street'),crossStreets=read('crossStreets'),colony=read('colony'),cityState=read('cityState');
  const postal=String(data.addressPostalCode??'').trim();
  if(!street||!colony||!cityState)throw new Error('Completa calle y número, colonia, y ciudad y estado.');
  if(!/^[0-9]{5}$/.test(postal))throw new Error('El código postal de la dirección debe tener 5 dígitos.');
  const lines=[street,crossStreets,`${colony} C.P.${postal}`,cityState];
  if(lines.some(line=>line.length>65||/[\r\n]/.test(line)))throw new Error('Cada línea de la dirección admite hasta 65 caracteres.');
  return lines;
}
