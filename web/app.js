import {monthOffset, shiftDate} from './dates.js';
import { generatePDF } from './pdf-editor.js';
const form = document.querySelector('#form');
const status = document.querySelector('#status');
const button = document.querySelector('#generate');
const download = document.querySelector('#download');
let templateBytes, blobUrl, revision = 0;
button.disabled = true;
download.style.display = 'none';
async function render(data, currentRevision) {
  const now = new Date();
  const offset = monthOffset(now);
  document.querySelector('#date-summary').textContent = `Fechas automáticas · Pago: ${shiftDate('04 OCT 26',offset)} · Corte: ${shiftDate('05 OCT 26',offset)} · Periodo: ${shiftDate('17 JUL 26',offset)}–${shiftDate('17 SEP 26',offset)}. Se conservan los días originales. Zona horaria: Mazatlán.`;
  const bytes = await generatePDF(window.PDFLib, templateBytes, data, now);
  if (currentRevision !== revision) return;
  const previousUrl = blobUrl;
  blobUrl = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
  document.querySelector('#preview').src = blobUrl;
  download.href = blobUrl;
  download.hidden = false;
  download.style.display = 'block';
  document.querySelector('#preview-label').textContent = 'Editado · 2 páginas';
  status.textContent = 'PDF listo. Ya puedes descargarlo.';
  if (previousUrl) setTimeout(() => URL.revokeObjectURL(previousUrl), 10000);
}
async function initialize() {
  try {
    const [defaultsResponse, templateResponse] = await Promise.all([fetch('./defaults.json'), fetch('./template-clean.pdf')]);
    if (!defaultsResponse.ok || !templateResponse.ok || !window.PDFLib) throw new Error('No se pudo cargar la plantilla. Recarga la página.');
    const defaults = await defaultsResponse.json();
    templateBytes = await templateResponse.arrayBuffer();
    for (const [key, value] of Object.entries(defaults)) form.elements[key].value = value;
    await render(defaults, revision);
    document.querySelector('#preview-label').textContent = 'Plantilla · 2 páginas';
    status.textContent = 'Plantilla lista para editar.';
    button.disabled = false;
  } catch (error) { status.textContent = error.message; }
}
form.addEventListener('input', () => {
  revision++;
  download.style.display = 'none';
  status.textContent = 'Hay cambios pendientes. Actualiza la vista previa.';
});
form.addEventListener('submit', async event => {
  event.preventDefault();
  button.disabled = true;
  status.textContent = 'Generando documento…';
  try { await render(Object.fromEntries(new FormData(form)), revision); }
  catch (error) { status.textContent = error.message; download.style.display = 'none'; }
  finally { button.disabled = false; }
});
initialize();
