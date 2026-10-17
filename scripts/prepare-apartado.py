"""Create the editable receipt from the user-provided one-page PDF wording."""
from pathlib import Path
import json
from docx import Document
from docx.shared import Inches, Pt
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml import OxmlElement
from docx.oxml.ns import qn

doc=Document();section=doc.sections[0];section.page_width=Inches(8.5);section.page_height=Inches(11)
section.top_margin=Inches(1.05);section.bottom_margin=Inches(.75);section.left_margin=Inches(1.15);section.right_margin=Inches(1.15)
style=doc.styles['Normal'];style.font.name='Arial';style.font.size=Pt(11)
style.paragraph_format.space_after=Pt(10);style.paragraph_format.line_spacing=1.35

def p(text,align=WD_ALIGN_PARAGRAPH.JUSTIFY,bold=False):
 para=doc.add_paragraph();para.alignment=align;run=para.add_run(text);run.bold=bold;return para
p('RECIBO DE APARTADO COMPRA VENTA',WD_ALIGN_PARAGRAPH.CENTER,True)
p('{signCity} a {signDay} de {signMonth} del {signYear}.',WD_ALIGN_PARAGRAPH.RIGHT)
p('Recibo de {buyer} la cantidad de ${deposit} ({depositWords}), por concepto de apartado del inmueble ubicado en: {propertyAddress}, {propertyCity}.')
p('Con ello el propietario, se compromete a respetar la Compra del inmueble y el precio de VENTA por la cantidad de ${price} ({priceWords}).')
p('')
para=p('');para.add_run('PENALIZACIÓN: ').bold=True;para.add_run('En caso de que {liableParty} decida cancelar la operación de Venta por cuenta propia, se le penalizará por la cantidad de ${penalty} ({penaltyWords}), todo ello para solventar los gastos administrativos y de comercialización que se generan.')
p('Tras recibir un pago parcial del apartado, el Vendedor suspenderá la venta de la propiedad por {reserveDays} días (hasta el {deadlineDay} de {deadlineMonth} de {deadlineYear}). Si el Comprador no completa el pago en este periodo, se considera incumplimiento de la carta de apartado, liberando al Vendedor de obligaciones de reserva y permitiéndole reanudar la venta de la propiedad.')
p('')
table=doc.add_table(rows=1,cols=2)
for cell,name,label in [(table.cell(0,0),'buyer','Entrega'),(table.cell(0,1),'seller','Recibe')]:
 para=cell.paragraphs[0];para.alignment=WD_ALIGN_PARAGRAPH.CENTER;para.add_run('__________________________\n{'+name+'}\n'+label)
footer=section.footer.paragraphs[0];footer.alignment=WD_ALIGN_PARAGRAPH.RIGHT;footer.add_run('Página ')
field=OxmlElement('w:fldSimple');field.set(qn('w:instr'),'PAGE');footer._p.append(field)
doc.save('web/templates/recibo-apartado.docx')
fields=[]
def f(key,label,group,default='',type='text'):
 fields.append(dict(key=key,label=label,group=group,type=type,default=default))
for key,label,default in [('signCity','Ciudad y estado','Culiacán, Sinaloa'),('signDay','Día',''),('signMonth','Mes',''),('signYear','Año','')]:f(key,label,'Fecha y lugar',default)
f('buyer','Nombre de quien entrega / comprador','Personas');f('seller','Nombre de quien recibe / vendedor','Personas');f('liableParty','Nombre de la persona sujeta a penalización','Personas')
f('propertyAddress','Dirección del inmueble (sin ciudad y estado)','Inmueble',type='textarea');f('propertyCity','Ciudad y estado del inmueble','Inmueble','Culiacán, Sinaloa')
for key,label in [('deposit','Importe del apartado'),('price','Precio de venta'),('penalty','Importe de la penalización')]:
 f(key,label+' ($)','Importes');f(key+'Words',label+' en letra','Importes')
f('reserveDays','Días de reserva','Plazo de reserva','5','number')
for key,label in [('deadlineDay','Día límite'),('deadlineMonth','Mes límite'),('deadlineYear','Año límite')]:f(key,label,'Plazo de reserva')
pth=Path('web/contracts-catalog.json');catalog=json.loads(pth.read_text());catalog=[x for x in catalog if x['id']!='recibo-apartado'];catalog.append(dict(id='recibo-apartado',title='Recibo de apartado compra venta',group='Recibo de apartado',template='templates/recibo-apartado.docx',fields=fields));pth.write_text(json.dumps(catalog,ensure_ascii=False,indent=2)+'\n')
