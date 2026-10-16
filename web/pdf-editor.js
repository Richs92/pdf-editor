// This module runs in the browser and in the PDF generation tests.
export async function generatePDF(PDFLib, templateBytes, data) {
  const name = String(data.name ?? '').trim();
  const lines = String(data.address ?? '').trim().split(/\r?\n/).map(line => line.trim());
  const service = String(data.service ?? '').trim();
  if (!name || name.length > 70 || /[\r\n]/.test(name)) throw new Error('Escribe un nombre de hasta 70 caracteres.');
  if (lines.length > 4 || lines.some(line => !line || line.length > 65)) throw new Error('La dirección debe tener de 1 a 4 líneas, de hasta 65 caracteres cada una.');
  if (!/^[0-9]{12}$/.test(service)) throw new Error('El número de servicio debe tener exactamente 12 dígitos.');
  const doc = await PDFLib.PDFDocument.load(templateBytes);
  const normal = await doc.embedFont(PDFLib.StandardFonts.Helvetica);
  const bold = await doc.embedFont(PDFLib.StandardFonts.HelveticaBold);
  const page = doc.getPages()[0];
  function draw(text, x, baseline, font, initialSize, width) {
    let size = initialSize;
    try {
      while (font.widthOfTextAtSize(text, size) > width && size > 4) size -= 0.25;
      if (font.widthOfTextAtSize(text, size) > width) throw new Error('Texto demasiado largo para el espacio disponible.');
    } catch (error) {
      if (error.message.includes('encode')) throw new Error('Usa caracteres latinos en el nombre y la dirección.');
      throw error;
    }
    page.drawText(text, { x, y: page.getHeight() - baseline, size, font });
  }
  draw(name, 24.8, 78, bold, 9, 200);
  lines.forEach((line, i) => draw(line, 25, 94 + i * 10, normal, 7, 200));
  draw(service, 94.2, 144, normal, 7, 51);
  draw(`01 ${service} 261004 000000230 6`, 150, 563.8, bold, 6, 130);
  return doc.save();
}
