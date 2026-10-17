from pathlib import Path
import fitz,json,re
p=fitz.open('data/predial/original.pdf');fields=[]
lookup={'007-000-039-588-004-001':'cadastre','DUARTE VALENZUELA BRENDA OLIVIA':'name','30/09/2026':'expiry','CALLE PASEO DE OVIEDO S/N  FRACC. RESIDENCIAL ALAMEDA CP:':'address'}
for page in p:
 for b in page.get_text('rawdict')['blocks']:
  for line in b.get('lines',[]):
   for span in line['spans']:
    chars=span['chars'];text=''.join(c['c'] for c in chars);matches=[]
    if text in lookup:matches=[(0,len(text),lookup[text])]
    elif text.startswith('CUARENTA Y SEIS MIL'):matches=[(0,len(text),'totalWords')]
    elif ' $ *********46,504.00'==text:matches=[(0,len(text),'total')]
    elif 'SUP.TERR:' in text:
     for label,key in [('SUP.TERR:','terrain'),('SUP.CONS:','construction')]:
      m=re.search(re.escape(label)+r'\s*([\d.]+)',text);matches.append((m.start(1),m.end(1),key))
    for start,end,key in matches:
     subset=chars[start:end];r=fitz.Rect(subset[0]['bbox'])
     for c in subset[1:]:r|=fitz.Rect(c['bbox'])
     width={'name':298,'address':497,'cadastre':94,'expiry':42,'totalWords':398}.get(key,r.width)
     fields.append(dict(key=key,x=subset[0]['origin'][0],baseline=subset[0]['origin'][1],size=span['size'],width=width,original=text[start:end]))
     page.add_redact_annot(fitz.Rect(r.x0+.05,r.y0+1,r.x1-.05,r.y1-1),fill=False)
 page.apply_redactions(images=0,graphics=0)
p.save('web/predial/template.pdf',garbage=4,deflate=True)
assert len(fields)==16,len(fields)
Path('web/predial/fields.js').write_text('export const predialFields = '+json.dumps(fields,ensure_ascii=False)+';\n')
Path('web/predial/defaults.json').write_text(json.dumps(dict(cadastre='007-000-039-588-004-001',name='DUARTE VALENZUELA BRENDA OLIVIA',address='CALLE PASEO DE OVIEDO S/N  FRACC. RESIDENCIAL ALAMEDA CP:',expiry='2026-09-30',total='46504.00',terrain='132.00',construction='43.52'),ensure_ascii=False))
print('16 campos preparados, ocho en cada copia.')
