import { dateFields } from './date-fields.js';
import { monthOffset, shiftDate, paymentCode } from './dates.js';
// This module runs in the browser and in the PDF generation tests.
export async function generatePDF(PDFLib, templateBytes, data, now = new Date()) {
  const name = String(data.name ?? '').trim();
  const lines = String(data.address ?? '').trim().split(/\r?\n/).map(line => line.trim());
  const service = String(data.service ?? '').trim();
  if (!name || name.length > 70 || /[\r\n]/.test(name)) throw new Error('Escribe un nombre de hasta 70 caracteres.');
  if (lines.length > 4 || lines.some(line => !line || line.length > 65)) throw new Error('La dirección debe tener de 1 a 4 líneas, de hasta 65 caracteres cada una.');
  if (!/^[0-9]{12}$/.test(service)) throw new Error('El número de servicio debe tener exactamente 12 dígitos.');
  const rfc = String(data.rfc ?? '').trim().toUpperCase();
  const businessName = String(data.businessName ?? '').trim();
  const taxRegime = String(data.taxRegime ?? '000').trim();
  const postalCode = String(data.postalCode ?? '00000').trim();
  if (rfc && !/^[A-ZÑ&]{3,4}[0-9]{6}[A-Z0-9]{3}$/.test(rfc)) throw new Error('El RFC debe tener 12 o 13 caracteres con formato válido.');
  if (businessName.length > 120 || /[\r\n]/.test(businessName)) throw new Error('La razón social admite hasta 120 caracteres en una línea.');
  if (!/^[0-9]{3}$/.test(taxRegime)) throw new Error('El régimen fiscal debe tener 3 dígitos.');
  if (!/^[0-9]{5}$/.test(postalCode)) throw new Error('El CP fiscal debe tener 5 dígitos.');
  const doc = await PDFLib.PDFDocument.load(templateBytes);
  const normal = await doc.embedFont(PDFLib.StandardFonts.Helvetica);
  const italic = await doc.embedFont(PDFLib.StandardFonts.HelveticaOblique);
  const offset = monthOffset(now);
  const bold = await doc.embedFont(PDFLib.StandardFonts.HelveticaBold);
  let page = doc.getPages()[0];
  function draw(text, x, baseline, font, initialSize, width) {
    let size = initialSize;
    try {
      while (font.widthOfTextAtSize(text, size) > width && size > 4) size -= 0.25;
      if (font.widthOfTextAtSize(text, size) > width) throw new Error('Texto demasiado largo para el espacio disponible.');
    } catch (error) {
      if (error.message.includes('encode')) throw new Error('Usa caracteres latinos en los campos de texto.');
      throw error;
    }
    page.drawText(text, { x, y: page.getHeight() - baseline, size, font });
  }
  draw(name, 24.8, 78, bold, 9, 200);
  lines.forEach((line, i) => draw(line, 25, 94 + i * 10, normal, 7, 200));
  draw(service, 94.2, 144, normal, 7, 51);
  draw(`01 ${service} ${paymentCode(offset)} 000000230 6`, 150, 563.8, bold, 6, 130);
  page = doc.getPages()[1];
  // Preserve the original single fiscal row and its original baselines.
  const fiscalRow = `RFC: ${rfc} Razón Social: ${businessName}  Régimen Fiscal: ${taxRegime} Uso CFDI:  CP: ${postalCode} AC Folio: 000063283419 Folio Fiscal:  N. Certificado del SAT:  No. certificado del CSD:  Fecha y hora de certificación:  Unidad de medi`;
  let fiscalWidth;
  try { fiscalWidth = normal.widthOfTextAtSize(fiscalRow, 4); }
  catch { throw new Error('Usa caracteres latinos en los campos de texto.'); }
  // Compress horizontally only when needed; never move labels to new lines.
  page.pushOperators(PDFLib.pushGraphicsState(), PDFLib.concatTransformationMatrix(Math.min(1, 361 / fiscalWidth), 0, 0, 1, 77, 0));
  page.drawText(fiscalRow, {x: 0, y: page.getHeight() - 368.92, size: 4, font: normal});
  page.pushOperators(PDFLib.popGraphicsState());
  draw('da: kWh', 77, 373.92, normal, 4, 365);
  draw('|||||||||', 77, 378.92, normal, 4, 365);
  for (const field of dateFields) {
    page = doc.getPages()[field.page];
    const font = field.font === 'bold' ? bold : field.font === 'italic' ? italic : normal;
    const text = shiftDate(field.text, offset);
    const width = font.widthOfTextAtSize(text, field.size);
    page.pushOperators(PDFLib.pushGraphicsState(), PDFLib.concatTransformationMatrix(Math.min(1, field.width / width), 0, 0, 1, field.x, 0));
    page.drawText(text, {x:0,y:page.getHeight()-field.baseline,size:field.size,font});
    page.pushOperators(PDFLib.popGraphicsState());
  }
  return doc.save();
}
