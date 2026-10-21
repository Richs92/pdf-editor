"""Replace example data with optional fields; preserve the source's four sections."""
from pathlib import Path
import json
from docx import Document
from docx.shared import Inches,Pt
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
original=Document('data/originals/propuesta-intencion-compra.docx');doc=Document();s=doc.sections[0];s.page_width=Inches(8.5);s.page_height=Inches(11);s.top_margin=s.bottom_margin=Inches(.75);s.left_margin=s.right_margin=Inches(.8)
style=doc.styles['Normal'];style.font.name='Arial';style.font.size=Pt(11);style.paragraph_format.line_spacing=1.25;style.paragraph_format.space_after=Pt(7)
replace={3:'{issueCity}, a {issueDate}',8:'Tipo de Inmueble: {propertyType}',9:'Dirección: {propertyAddress}',10:'Colonia: {propertyColony}',11:'C.P.: {propertyCP}',12:'Ciudad: {propertyCity}',15:'Precio: ${price} ({priceWords})',17:'${deposit} ({depositWords}), a la firma del contrato de Compraventa, mismo que estoy dispuesto a firmar a mas tardar el día {deadline}.',19:'${balance} ({balanceWords}), para completar el monto total propuesto a la firma de la Escritura de Compraventa ante Notaría en un plazo que quedaría consignado en el mismo Contrato de Compraventa.',20:'Propongo que la escritura definitiva de compraventa sea firmada ante el Notario No. {notaryNumber} Lic. {notaryName}.',25:original.paragraphs[25].text.replace('3 días','{validityDays} días'),26:original.paragraphs[26].text.replace('$20,000.00 (Veinte mil Pesos M.N. 00/100)','${earnest} ({earnestWords})'),35:'{buyer}',37:'Nombre: {buyer}',38:'Dirección: {buyerAddress}',39:'Colonia: {buyerColony}',40:'C.P.: {buyerCP}',41:'Teléfono: {buyerPhone}',78:'{seller}',81:'Nombre: {seller}',82:'Dirección: {sellerAddress}',83:'Colonia: {sellerColony}',84:'C.P.: {sellerCP}',85:'Ciudad: {sellerCity}',114:original.paragraphs[114].text.replace('Juan Ricardo Guerrero Guevara','{agent}').replace('María José Grisel Enriquez Cabral','{receiptPayer}').replace('$5,000.00 (Cinco mil Pesos M.N. 00/100)','${receiptAmount} ({receiptAmountWords})'),122:'{agent}',158:original.paragraphs[158].text.replace('__________________________','{notification}'),170:'{buyer}'}
headings=[1,65,112,156]
for index,source in enumerate(original.paragraphs):
 text=replace.get(index,source.text).strip()
 if not text:continue
 p=doc.add_paragraph();p.alignment=WD_ALIGN_PARAGRAPH.LEFT;p.paragraph_format.widow_control=True
 if index in headings:
  p.alignment=WD_ALIGN_PARAGRAPH.CENTER;p.paragraph_format.keep_with_next=True;p.paragraph_format.space_after=Pt(16)
  if index!=1:p.paragraph_format.page_break_before=True
 run=p.add_run(text);run.font.name='Arial';run.font.size=Pt(13 if index in headings else 11);run.bold=index in headings
 if index==3:p.alignment=WD_ALIGN_PARAGRAPH.RIGHT;p.paragraph_format.space_after=Pt(14)
 if text.startswith('___') or index in [35,78,79,122,123,170]:p.alignment=WD_ALIGN_PARAGRAPH.CENTER
 if text.startswith('___'):p.paragraph_format.space_before=Pt(18);p.paragraph_format.keep_with_next=True
 if index in [35,78,122]:p.paragraph_format.keep_with_next=True
doc.save('web/templates/propuesta-compra.docx')
fields=[]
def f(key,label,group,type='text',default=''):fields.append(dict(key=key,label=label,group=group,type=type,default=default))
f('issueCity','Ciudad y estado de la propuesta','Fecha de propuesta',default='Culiacán, Sinaloa');f('issueDate','Fecha de propuesta (día, mes y año)','Fecha de propuesta')
for key,label,default in [('propertyType','Tipo de inmueble','Casa habitación'),('propertyAddress','Calle y número',''),('propertyColony','Colonia',''),('propertyCP','Código postal',''),('propertyCity','Ciudad y estado','Culiacán, Sinaloa')]:f(key,label,'Inmueble',default=default)
for key,label in [('buyer','Nombre completo del comprador / oferente'),('buyerAddress','Calle y número del comprador'),('buyerColony','Colonia del comprador'),('buyerCP','CP del comprador'),('buyerPhone','Teléfono del comprador')]:f(key,label,'Comprador / oferente')
for key,label in [('seller','Nombre completo del propietario'),('sellerAddress','Calle y número del propietario'),('sellerColony','Colonia del propietario'),('sellerCP','CP del propietario'),('sellerCity','Ciudad y estado del propietario')]:f(key,label,'Propietario')
for key,label in [('price','Precio propuesto'),('deposit','Anticipo a la firma del contrato'),('balance','Saldo pendiente (automático)'),('earnest','Garantía de seriedad de la oferta')]:
 f(key,label+' ($)','Oferta y pagos');f(key+'Words',label+' en letra (automático)','Oferta y pagos')
f('deadline','Fecha límite para firmar el contrato','Plazos y notaría');f('validityDays','Vigencia de la propuesta (días naturales)','Plazos y notaría','number','3');f('notaryNumber','Número de notaría','Plazos y notaría');f('notaryName','Nombre completo del notario','Plazos y notaría')
f('agent','Nombre del asesor / mediador','Recibo del mediador');f('receiptPayer','Persona que entrega el dinero al mediador','Recibo del mediador');f('receiptAmount','Importe recibido por el mediador ($)','Recibo del mediador');f('receiptAmountWords','Importe recibido en letra (automático)','Recibo del mediador');f('notification','Notificación del propietario recibida por el oferente','Recepción de aceptación',default='la aceptación')
path=Path('web/contracts-catalog.json');catalog=[item for item in json.loads(path.read_text()) if item['id']!='propuesta-compra'];catalog.append(dict(id='propuesta-compra',title='Propuesta de intención de compra',group='Intención de compra',template='templates/propuesta-compra.docx',fields=fields));path.write_text(json.dumps(catalog,ensure_ascii=False,indent=2)+'\n')
