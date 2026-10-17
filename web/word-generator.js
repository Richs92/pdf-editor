import {pagareAmount} from './pagare-amount.js';
const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const escapeXML = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
export function validateContract(contract, data) {
  if(contract.id==='pagare')data={...data,...pagareAmount(data.amount)};
  const values = {};
  for (const field of contract.fields) {
    const value = String(data[field.key] ?? '').trim();
    if (!value) {
      const length=field.type==='number'?8:({signDay:4,signMonth:12,signYear:6}[field.key]??(field.type==='textarea'?40:24));
      values[field.key]='_'.repeat(length);
      continue;
    }
    if (value.length > 4000 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value)) throw new Error(`Revisa: ${field.label}.`);
    if (field.type === 'number' && !/^\d+$/.test(value)) throw new Error(`${field.label}: escribe un número entero de días.`);
    values[field.key] = value;
  }
  return values;
}
function parseXML(xml) {
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  if (doc.getElementsByTagName('parsererror').length) throw new Error('No se pudo leer la plantilla Word.');
  return doc;
}
function fillXML(xml, values) {
  const doc = parseXML(xml);
  for (const paragraph of doc.getElementsByTagNameNS(W, 'p')) {
    const nodes = [...paragraph.getElementsByTagNameNS(W,'t')];
    let offset = 0;
    const ranges = nodes.map(node => { const start = offset; offset += node.textContent.length; return {node,start,end:offset}; });
    const text = nodes.map(node => node.textContent).join('');
    const matches = [...text.matchAll(/\{([a-zA-Z][a-zA-Z0-9]*)\}/g)].reverse();
    for (const match of matches) {
      if (!(match[1] in values)) throw new Error(`Falta el campo ${match[1]}.`);
      const start = match.index, end = start + match[0].length;
      let first = true;
      for (const range of ranges.filter(r => r.start < end && r.end > start)) {
        const text = range.node.textContent;
        range.node.textContent = text.slice(0,Math.max(0,start-range.start)) + (first ? values[match[1]] : '') + text.slice(Math.min(range.end-range.start,end-range.start));
        range.node.setAttributeNS('http://www.w3.org/XML/1998/namespace','xml:space','preserve');
        first = false;
      }
    }
    for (const node of nodes) {
      if (!node.textContent.includes('\n')) continue;
      const parts = node.textContent.split(/\r?\n/);
      const fragment = doc.createDocumentFragment();
      parts.forEach((part,i) => {
        if(i) fragment.append(doc.createElementNS(W,'w:br'));
        const t = doc.createElementNS(W,'w:t'); t.textContent = part;
        t.setAttributeNS('http://www.w3.org/XML/1998/namespace','xml:space','preserve');
        fragment.append(t);
      });
      node.replaceWith(fragment);
    }
    // The yellow fill marks empty fields in the supplied templates.
    if (matches.length) for (const highlight of [...paragraph.getElementsByTagNameNS(W,'highlight')]) highlight.remove();
  }
  return new XMLSerializer().serializeToString(doc);
}
function paragraph(text, bold=false) {
  return `<w:p><w:r>${bold?'<w:rPr><w:b/></w:rPr>':''}<w:t xml:space="preserve">${escapeXML(text)}</w:t></w:r></w:p>`;
}
function photoXML(id, relationship, width, height) {
  const cx = Math.round(width), cy = Math.round(height);
  return `<w:p><w:r><w:drawing><wp:inline xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${cx}" cy="${cy}"/><wp:docPr id="${id}" name="INE ${id}"/><a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="${id}" name="INE ${id}"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip xmlns:r="${R}" r:embed="${relationship}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>`;
}
export function groupINEPhotos(photos,documentId){
  return ['seller','buyer'].flatMap(person=>{
    const selected=photos.filter(photo=>(photo.person||(/^(Vendedor|Suscriptor)/.test(photo.label)?'seller':'buyer'))===person)
      .sort((a,b)=>(a.face||(/Frente/.test(a.label)?'front':'back'))==='front'?-1:1);
    const title=documentId==='pagare'?(person==='seller'?'Suscriptor':'Beneficiario'):(person==='seller'?'Vendedor':'Comprador');
    return selected.length?[{person,title,photos:selected}]:[];
  });
}
export async function generateWord(templateBytes, contract, data, photos=[]) {
  const values = validateContract(contract,data);
  const zip = new window.PizZip(templateBytes);
  for (const filename of Object.keys(zip.files).filter(name => /^word\/(document|header\d*|footer\d*)\.xml$/.test(name))) {
    zip.file(filename, fillXML(zip.file(filename).asText(),values));
  }
  if (photos.length) {
    const doc = parseXML(zip.file('word/document.xml').asText());
    const body = doc.getElementsByTagNameNS(W,'body')[0];
    const sectPr = [...body.children].find(el=>el.localName==='sectPr');
    const relPath = 'word/_rels/document.xml.rels';
    const rels = parseXML(zip.file(relPath).asText());
    const types = parseXML(zip.file('[Content_Types].xml').asText());
    if (![...types.documentElement.children].some(el=>el.getAttribute('Extension')==='jpg')) {
      const type=types.createElementNS(types.documentElement.namespaceURI,'Default');
      type.setAttribute('Extension','jpg');type.setAttribute('ContentType','image/jpeg');types.documentElement.append(type);
    }
    let annex = '',index=0;
    for(const group of groupINEPhotos(photos,contract.id)){
      let contents=paragraph('ANEXO · IDENTIFICACIÓN OFICIAL',true)+paragraph(group.title,true);
      for(const photo of group.photos){
        const relation=`rIdTerminavitPhoto${index}`,filename=`terminavit-ine-${index}.jpg`;
        zip.file(`word/media/${filename}`,photo.bytes);
        const rel=rels.createElementNS(rels.documentElement.namespaceURI,'Relationship');
        rel.setAttribute('Id',relation);rel.setAttribute('Type',`${R}/image`);rel.setAttribute('Target',`media/${filename}`);rels.documentElement.append(rel);
        const scale=Math.min(5.5*914400/photo.width,2.45*914400/photo.height);
        contents+=paragraph(photo.label,true)+photoXML(5000+index,relation,photo.width*scale,photo.height*scale);index++;
      }
      // A single unsplittable row keeps both faces together in Word and PDF.
      annex+='<w:p><w:r><w:br w:type="page"/></w:r></w:p>'+`<w:tbl><w:tblPr><w:tblCaption w:val="TerminavitINE"/><w:tblBorders><w:top w:val="nil"/><w:left w:val="nil"/><w:bottom w:val="nil"/><w:right w:val="nil"/><w:insideH w:val="nil"/><w:insideV w:val="nil"/></w:tblBorders></w:tblPr><w:tblGrid><w:gridCol w:w="9000"/></w:tblGrid><w:tr><w:trPr><w:cantSplit/></w:trPr><w:tc>${contents}</w:tc></w:tr></w:tbl>`;
    }
    const fragment = parseXML(`<w:body xmlns:w="${W}" xmlns:r="${R}">${annex}</w:body>`);
    for (const node of [...fragment.documentElement.children]) body.insertBefore(doc.importNode(node,true),sectPr||null);
    zip.file('word/document.xml',new XMLSerializer().serializeToString(doc));
    zip.file(relPath,new XMLSerializer().serializeToString(rels));
    zip.file('[Content_Types].xml',new XMLSerializer().serializeToString(types));
  }
  return zip.generate({type:'uint8array',compression:'DEFLATE'});
}
