const months = ['ENE','FEB','MAR','ABR','MAY','JUN','JUL','AGO','SEP','OCT','NOV','DIC'];
export function currentMonth(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {timeZone:'America/Mazatlan',year:'numeric',month:'numeric'}).formatToParts(now);
  return {year:Number(parts.find(p=>p.type==='year').value),month:Number(parts.find(p=>p.type==='month').value)};
}
export function monthOffset(now = new Date()) {
  const {year,month} = currentMonth(now);
  return (year - 2026) * 12 + month - 10;
}
export function shiftDate(text, offset) {
  const numeric = text.includes('/');
  const [day, rawMonth, rawYear] = text.split(numeric ? '/' : ' ');
  const month = numeric ? Number(rawMonth)-1 : months.indexOf(rawMonth);
  const year = numeric ? Number(rawYear) : 2000+Number(rawYear);
  const total = year*12+month+offset;
  const shiftedYear = Math.floor(total/12), shiftedMonth = ((total%12)+12)%12;
  return numeric ? `${day}/${String(shiftedMonth+1).padStart(2,'0')}/${shiftedYear}` : `${day} ${months[shiftedMonth]} ${String(shiftedYear%100).padStart(2,'0')}`;
}
export function paymentCode(offset) {
  const text=shiftDate('04 OCT 26',offset).split(' ');
  return `${text[2]}${String(months.indexOf(text[1])+1).padStart(2,'0')}${text[0]}`;
}
