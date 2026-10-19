"""Recreate editable fields from the supplied PDF without changing its clauses."""
from pathlib import Path
import re,json
from docx import Document
from docx.shared import Inches,Pt
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
source=Path('data/originals/contrato-exclusiva.txt').read_text().replace('\u200b','')
keys=['seller','buyer','sellerId','sellerRFC','sellerAddress','propertyAddress','title','folio','cadastre','buyerAddress','buyerPhone','price','priceWords','conditions','signDay','signMonth','signYear',None,None,'buyer','seller']
assert len(re.findall(r'_{2,}',source))==len(keys)
iterator=iter(keys)
def replace(match):
 key=next(iterator);return '{'+key+'}' if key else match.group()
source=re.sub(r'_{2,}',replace,source).replace('{seller}A QUIEN','{seller} A QUIEN').replace('{priceWords}00/100 MXN','{priceWords}').replace('20 {signYear}','{signYear}')
source=source.replace('VIGENCIA (90 DIAS)', '{durationDays} días').replace('5% (Cinco por ciento)', '{commission}% ({commissionWords})')
source=source.replace('CULIACÁN, SINALOA renunciando','{jurisdiction} renunciando').replace('Ciudad de CULIACÁN,\nSINALOA','Ciudad de {signCity}')
doc=Document();section=doc.sections[0];section.page_width=Inches(8.5);section.page_height=Inches(11);section.top_margin=section.bottom_margin=Inches(.5);section.left_margin=section.right_margin=Inches(.45)
style=doc.styles['Normal'];style.font.name='Arial';style.font.size=Pt(10);style.paragraph_format.line_spacing=1.05;style.paragraph_format.space_after=Pt(3)
for index,page in enumerate(source.split('\f')):
 if not page.strip():continue
 # Let Word paginate naturally using the readable layout below.
 # The final signature block is recreated as a borderless table below.
 page=re.split(r'\n\s*_{10,}',page)[0] if index else page
 for block in re.split(r'\n\s*\n',page):
  text=re.sub(r'\s+',' ',block).strip()
  if not text or text in ['1','2']:continue
  # Remove only the extracted source's page number, not any clause numbering.
  text=re.sub(r'\s+[12]$','',text)
  text=text.replace('DECLARACIONES I.','DECLARACIONES\nI.')
  # Keep declarations, lettered items and service lists on separate paragraphs.
  parts=re.split(r'\n|(?=\b[abcd]\)\s)|(?=\b(?:III|II|IV|VI|V|I)\.\s)|(?=\b[123]\.\s+(?:Precio|Vigencia|Honorarios))',text)
  for part in parts:
   part=part.strip()
   if not part:continue
   p=doc.add_paragraph();p.alignment=WD_ALIGN_PARAGRAPH.JUSTIFY
   heading=part in ['DECLARACIONES','CLÁUSULAS']
   if heading:p.alignment=WD_ALIGN_PARAGRAPH.CENTER
   prefix=re.match(r'^(?:PRIMERA|SEGUNDA|TERCERA|CUARTA|QUINTA|SEXTA|SÉPTIMA|OCTAVA|NOVENA)\s*\.?\s*-?\s*\([^)]*\)',part)
   if prefix:p.add_run(prefix.group()).bold=True;p.add_run(part[len(prefix.group()):])
   else:p.add_run(part).bold=heading
# Signature names occur in the source block removed above, and stay editable here.
table=doc.add_table(rows=1,cols=2);caption=OxmlElement('w:tblCaption');caption.set(qn('w:val'),'TerminavitSignatures');table._tbl.tblPr.append(caption)
for cell,key,label in [(table.cell(0,0),'buyer','EL CLIENTE'),(table.cell(0,1),'seller','EL PROFESIONAL')]:
 p=cell.paragraphs[0];p.alignment=WD_ALIGN_PARAGRAPH.CENTER;p.add_run('____________________________\n“'+label+'”\nNombre: {'+key+'}')
import runpy
apply_layout=runpy.run_path('scripts/exclusiva-layout.py')['apply_layout'];apply_layout(doc)
doc.save('web/templates/contrato-exclusiva.docx')
fields=[]
def f(key,label,group,type='text',default=''):fields.append(dict(key=key,label=label,group=group,type=type,default=default))
for key,label in [('seller','Nombre completo del profesional'),('sellerId','Identificación del profesional: INE y número'),('sellerRFC','RFC del profesional'),('sellerAddress','Domicilio del profesional'),('buyer','Nombre completo del cliente / propietario'),('buyerAddress','Domicilio del cliente'),('buyerPhone','Teléfono del cliente')]:f(key,label,'Personas','textarea' if 'Address' in key else 'text')
for key,label in [('propertyAddress','Dirección completa del inmueble'),('title','Escritura o documento que acredita la propiedad'),('folio','Folio real del Registro Público'),('cadastre','Número de cuenta predial')]:f(key,label,'Inmueble','textarea' if key in ['propertyAddress','title'] else 'text')
f('durationDays','Vigencia del contrato (días)','Precio y condiciones','number','90');f('commission','Comisión (%)','Precio y condiciones',default='5');f('commissionWords','Comisión en letra (automático)','Precio y condiciones')
f('price','Precio del inmueble ($)','Precio y condiciones');f('priceWords','Precio en letra (automático)','Precio y condiciones');f('conditions','Condiciones adicionales del servicio','Precio y condiciones','textarea')
for key,label,default in [('jurisdiction','Ciudad y estado para jurisdicción','CULIACÁN, SINALOA'),('signCity','Ciudad y estado de firma','CULIACÁN, SINALOA'),('signDay','Día de firma',''),('signMonth','Mes de firma',''),('signYear','Año de firma (cuatro dígitos)','')]:f(key,label,'Firma y jurisdicción',default=default)
path=Path('web/contracts-catalog.json');catalog=[item for item in json.loads(path.read_text()) if item['id']!='contrato-exclusiva'];catalog.append(dict(id='contrato-exclusiva',title='Comercialización y servicios inmobiliarios en exclusiva',group='Exclusiva',template='templates/contrato-exclusiva.docx',fields=fields));path.write_text(json.dumps(catalog,ensure_ascii=False,indent=2)+'\n')
assert set(re.findall(r'\{(\w+)\}',source))=={f['key'] for f in fields}

# Regenerate the two-owner derivative as well.
import runpy
runpy.run_path("scripts/prepare-exclusiva-dos.py", run_name="__main__")
