"""Prepare only page one; originals stay separate and editable text is removed."""
from pathlib import Path
import fitz,json
source=Path('data/bank/original-page1.pdf')
doc=fitz.open(source);page=doc[0];fields=[]
# Redact complete spans for changing fields, preserving nearby labels and rules.
for block in page.get_text('dict')['blocks']:
 for line in block.get('lines',[]):
  for span in line['spans']:
   text=span['text'];key=None
   mapping={'1 DE SEPTIEMBRE AL 30 DE SEPTIEMBRE DE 2026':'period','049990369':'client','ROMD6809278C4':'rfc','DOMINGO ROBLES MACIAS':'name','CUENTA CONECTA BANBAJIO 0499903690201':'account','030730900047081215':'clabe','30 SEPTIEMBRE 2026':'cutoff','273':'yearDays'}
   key=mapping.get(text)
   if text=='30':key='days'
   if text.startswith('DETALLE DE LA CUENTA:'):key='detail'
   if text.strip()=='1 SEP':key='movementDate'
   if text in ['C GALAXIA 3961','COLONIA RUBEN JARAMILLO','CULIACAN ROSALES(SIN, MEXICO.','C.P. 80015']:key='address'+str(['C GALAXIA 3961','COLONIA RUBEN JARAMILLO','CULIACAN ROSALES(SIN, MEXICO.','C.P. 80015'].index(text))
   if text.startswith('CONTINUA EN LA SIGUIENTE') or text=='PAGINA 1 DE 20':key='remove'
   if key:
    rect=fitz.Rect(span['bbox']);page.add_redact_annot(rect,fill=(1,1,1))
    if key!='remove':
     width={'period':205,'client':120,'rfc':170,'name':275,'account':160,'clabe':100,'detail':570,'cutoff':130,'yearDays':20,'days':20,'movementDate':35}.get(key,275)
     fields.append(dict(key=key,x=round(span['origin'][0],3),baseline=round(span['origin'][1],3),size=round(span['size'],2),width=width,bold='Bold' in span['font'],right=293.94 if key in ['clabe','cutoff','account'] else None))
page.apply_redactions(images=0,graphics=0)
doc.set_metadata({})
doc.save('web/bank/template.pdf',garbage=4,deflate=True)
Path('web/bank/fields.js').write_text('export const bankFields='+json.dumps(fields,ensure_ascii=False,indent=2)+';\n')
Path('web/bank/defaults.json').write_text(json.dumps(dict(name='DOMINGO ROBLES MACIAS',address='C GALAXIA 3961\nCOLONIA RUBEN JARAMILLO\nCULIACAN ROSALES(SIN, MEXICO.\nC.P. 80015',client='049990369',rfc='ROMD6809278C4',account='0499903690201',clabe='030730900047081215'),ensure_ascii=False,indent=2)+'\n')
print('BanBajío: primera página preparada; campos:',len(fields))
