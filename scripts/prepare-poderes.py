"""Prepare optional fields from the two user-supplied power letters."""
from pathlib import Path
import json
from docx import Document
from docx.shared import Inches,Pt
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
catalog_path=Path('web/contracts-catalog.json')
catalog=[x for x in json.loads(catalog_path.read_text()) if x['id'] not in ['carta-poder-cfe','carta-poder-japac']]
for institution in ['cfe','japac']:
 doc=Document();section=doc.sections[0];section.page_width=Inches(8.5);section.page_height=Inches(11);section.top_margin=section.bottom_margin=Inches(.8);section.left_margin=section.right_margin=Inches(.85)
 style=doc.styles['Normal'];style.font.name='Arial';style.font.size=Pt(11);style.paragraph_format.line_spacing=1.3;style.paragraph_format.space_after=Pt(12)
 p=doc.add_paragraph('{signCity}, a {signDay} de {signMonth} de {signYear}.');p.alignment=WD_ALIGN_PARAGRAPH.RIGHT
 p=doc.add_paragraph();p.alignment=WD_ALIGN_PARAGRAPH.CENTER;p.paragraph_format.space_before=Pt(24);p.paragraph_format.space_after=Pt(28);r=p.add_run('CARTA PODER '+institution.upper());r.bold=True;r.font.size=Pt(16)
 if institution=='cfe':
  doc.add_paragraph('CFE Suministrador de Servicios Básicos:').runs[0].bold=True
  doc.add_paragraph('Por medio de la presente, Yo {seller} con número de identidad {sellerId} otorgo el poder a {buyer} con número de identidad {buyerId} para que lleve a cabo la gestión de {procedure}, ya que no puedo asistir personalmente.')
  doc.add_paragraph('Hago constar, que mi representante tendrá en su poder mi documento de identificación, y espero que mi voluntad se cumpla a cabalidad.')
 else:
  doc.add_paragraph('PRESENTE:\nJUNTA MUNICIPAL DE AGUA POTABLE Y ALCANTARILLADO DE CULIACÁN;').runs[0].bold=True
  doc.add_paragraph('Por medio de la presente, Yo {seller} me identifico con mi credencial para votar con número IDMEX: {sellerId} otorgo PODER AMPLIO para que en mi representación {buyer} que se identifica con su credencial para votar con número IDMEX: {buyerId} lleve a cabo la gestión de {procedure}, del inmueble ubicado en {propertyAddress}, con número de cuenta {account}, ya que no puedo asistir personalmente, solicito se le entreguen las facilidades y personalmente el documento que argumento en mi representación.')
 p=doc.add_paragraph('Atentamente,');p.paragraph_format.space_before=Pt(15);p.paragraph_format.space_after=Pt(20)
 table=doc.add_table(rows=0,cols=2);table.autofit=False
 table.columns[0].width=table.columns[1].width=Inches(3.3)
 caption=OxmlElement('w:tblCaption');caption.set(qn('w:val'),'TerminavitSignatures');table._tbl.tblPr.append(caption)
 people=[('seller','Otorgante de poder'),('buyer','Autorizado · acepta el poder')]
 if institution=='cfe':people.extend([('witness1','Testigo 1'),('witness2','Testigo 2')])
 for start in range(0,len(people),2):
  row=table.add_row()
  for cell,(key,label) in zip(row.cells,people[start:start+2]):
   p=cell.paragraphs[0];p.alignment=WD_ALIGN_PARAGRAPH.CENTER;p.paragraph_format.space_before=Pt(35);p.paragraph_format.space_after=Pt(4);p.add_run('________________________')
   p=cell.add_paragraph(label);p.alignment=WD_ALIGN_PARAGRAPH.CENTER;p.paragraph_format.space_after=Pt(4)
   p=cell.add_paragraph('{'+key+'}');p.alignment=WD_ALIGN_PARAGRAPH.CENTER;p.paragraph_format.space_after=Pt(8)
   for para in cell.paragraphs[:-1]:para.paragraph_format.keep_with_next=True
 doc.save('web/templates/carta-poder-'+institution+'.docx')
 fields=[]
 def f(key,label,group,default=''):fields.append(dict(key=key,label=label,group=group,type='text',default=default))
 for key,label,default in [('signCity','Ciudad y estado','Culiacán, Sinaloa'),('signDay','Día',''),('signMonth','Mes',''),('signYear','Año','')]:f(key,label,'Fecha y lugar',default)
 for key,label in [('seller','Nombre completo del otorgante'),('sellerId','Número de identificación del otorgante'+(' (IDMEX)' if institution=='japac' else '')),('buyer','Nombre completo del autorizado'),('buyerId','Número de identificación del autorizado'+(' (IDMEX)' if institution=='japac' else ''))]:f(key,label,'Personas')
 if institution=='cfe':
  f('witness1','Nombre completo del testigo 1','Testigos');f('witness2','Nombre completo del testigo 2','Testigos')
 else:
  f('propertyAddress','Domicilio completo del inmueble','Inmueble y servicio');f('account','Número de cuenta JAPAC','Inmueble y servicio')
 f('procedure','Trámite que se autoriza','Trámite','cambio de nombre de mi contrato de luz' if institution=='cfe' else 'solicitar la CARTA DE NO ADEUDO')
 catalog.append(dict(id='carta-poder-'+institution,title='Carta poder '+institution.upper(),group='Cartas poder',template='templates/carta-poder-'+institution+'.docx',fields=fields))
catalog_path.write_text(json.dumps(catalog,ensure_ascii=False,indent=2)+'\n')
