"""Two-owner version of the user's exclusivity contract; owners jointly form EL CLIENTE."""
from pathlib import Path
import json
from docx import Document
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml import OxmlElement
from docx.oxml.ns import qn

doc=Document('web/templates/contrato-exclusiva.docx')
for p in doc.paragraphs:
 text=p.text
 if 'Y POR LA OTRA {buyer}' in text:
  text=text.replace('Y POR LA OTRA {buyer}', 'Y POR LA OTRA {buyer} Y {buyer2}').replace('A QUIEN EN LO SUCESIVO SE LE DENOMINARÁ COMO “EL CLIENTE”','A QUIENES EN LO SUCESIVO SE LES DENOMINARÁ CONJUNTAMENTE COMO “EL CLIENTE”')
 if text.startswith('II. Declara el “CLIENTE”'):
  text='II. Declaran los dos propietarios que conforman “EL CLIENTE”, por su propio derecho y bajo protesta de decir verdad que:'
 if text.startswith('a) Ser una persona física'):
  text='a) Ser personas físicas, mayores de edad, con capacidad suficiente para obligarse en términos del presente contrato. Propietario 1: {buyer}, identificación: {buyerId}. Propietario 2: {buyer2}, identificación: {buyer2Id}.'
 text=text.replace('Ser legítimo propietario del inmueble','Ser legítimos copropietarios del inmueble')
 if text.startswith('c) Que señala como domicilio'):
  # Keep each owner's contact separate; preserve the following original d) text.
  tail=text.split('d)',1)
  text='c) Que señalan como domicilios para cualquier efecto legal: Propietario 1, {buyerAddress}, teléfono {buyerPhone}; Propietario 2, {buyer2Address}, teléfono {buyer2Phone}.'
  if len(tail)>1:text+=' d)'+tail[1]
 text=text.replace('Que puede disponer libremente','Que pueden disponer libremente').replace('y que es su deseo','y que es su deseo común')
 if text!=p.text:p.text=text
for table in list(doc.tables):
 if any('EL CLIENTE' in cell.text for row in table.rows for cell in row.cells):table._element.getparent().remove(table._element)
table=doc.add_table(rows=1,cols=3);caption=OxmlElement('w:tblCaption');caption.set(qn('w:val'),'TerminavitSignatures');table._tbl.tblPr.append(caption)
for index,(key,label) in enumerate([('buyer','PROPIETARIO 1'),('buyer2','PROPIETARIO 2'),('seller','EL PROFESIONAL')]):
 cell=table.cell(0,index);p=cell.paragraphs[0];p.alignment=WD_ALIGN_PARAGRAPH.CENTER
 mark=OxmlElement('w:bookmarkStart');mark.set(qn('w:id'),str(800+index));mark.set(qn('w:name'),'TerminavitSignature_'+key);p._p.append(mark)
 p.add_run('________________________\n“'+label+'”\nNombre: {'+key+'}')
 end=OxmlElement('w:bookmarkEnd');end.set(qn('w:id'),str(800+index));p._p.append(end)
doc.save('web/templates/contrato-exclusiva-dos.docx')
p=Path('web/contracts-catalog.json');catalog=json.loads(p.read_text());base=next(x for x in catalog if x['id']=='contrato-exclusiva');base['title']='Exclusiva · un propietario';fields=[dict(f) for f in base['fields']]
for f in fields:
 if f['key'].startswith('seller'):f['group']='Profesional'
 if f['key'] in ['buyer','buyerAddress','buyerPhone']:f['label']=f['label'].replace('cliente / propietario','propietario 1').replace('del cliente','del propietario 1');f['group']='Propietario 1'
for key,label in [('buyerId','Identificación del propietario 1: INE y número'),('buyer2','Nombre completo del propietario 2'),('buyer2Id','Identificación del propietario 2: INE y número'),('buyer2Address','Domicilio del propietario 2'),('buyer2Phone','Teléfono del propietario 2')]:
 fields.append(dict(key=key,label=label,group='Propietario 1' if key=='buyerId' else 'Propietario 2',type='textarea' if key.endswith('Address') else 'text',default=''))
order={key:index for index,key in enumerate(['Profesional','Propietario 1','Propietario 2','Inmueble','Precio y condiciones','Firma y jurisdicción'])};fields.sort(key=lambda f:order[f['group']])
catalog=[x for x in catalog if x['id']!='contrato-exclusiva-dos'];catalog.append(dict(id='contrato-exclusiva-dos',title='Exclusiva · dos propietarios',group='Exclusiva',template='templates/contrato-exclusiva-dos.docx',fields=fields));p.write_text(json.dumps(catalog,ensure_ascii=False,indent=2)+'\n')
