from pathlib import Path
import fitz,json
p=fitz.open('data/water/original.pdf');page=p[0];fields=[]
lookup={' 000440611':('account',73),'NU?EZ HAROS MARCO ANTONIO':('name',268),'JUAN DE LA BARRERA 1141-8, CHAPULTEPEC, CULIACAN':('address',265),'COMERCIAL':('category',70),'07 OCTUBRE 2026':('due',170),'03 OCTUBRE 2026':('issue',129),'OCTUBRE 2026':('billing',96),'03 OCT 2026':('currentReading',80),'03 SEP 2026':('previousReading',79)}
for b in page.get_text('dict')['blocks']:
 for line in b.get('lines',[]):
  for span in line['spans']:
   if span['text'] not in lookup:continue
   key,width=lookup[span['text']];r=fitz.Rect(span['bbox'])
   fields.append(dict(key=key,x=span['origin'][0],baseline=span['origin'][1],size=span['size'],width=width))
   page.add_redact_annot(fitz.Rect(r.x0+.05,r.y0+1,r.x1-.05,r.y1-1),fill=False)
assert len(fields)==9,len(fields)
page.apply_redactions(images=0,graphics=0)
p.save('web/water/template.pdf',garbage=4,deflate=True)
Path('web/water/fields.js').write_text('export const waterFields = '+json.dumps(fields)+';\n')
Path('web/water/defaults.json').write_text(json.dumps(dict(account='000440611',name='NU?EZ HAROS MARCO ANTONIO',address='JUAN DE LA BARRERA 1141-8, CHAPULTEPEC, CULIACAN'),ensure_ascii=False))
print('Nueve campos preparados sin cambiar imágenes, importes ni referencias.')
