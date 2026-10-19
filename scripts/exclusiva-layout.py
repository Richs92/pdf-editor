"""Shared, readable typography for both editable exclusivity contracts."""
import re
from docx.shared import Inches,Pt
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml.ns import qn

def apply_layout(doc):
 for section in doc.sections:
  section.top_margin=Inches(.75);section.bottom_margin=Inches(.75);section.left_margin=section.right_margin=Inches(.8)
 normal=doc.styles['Normal'];normal.font.name='Arial';normal.font.size=Pt(11)
 normal.paragraph_format.line_spacing=1.3;normal.paragraph_format.space_after=Pt(7)
 title='PRESTACIÓN DE SERVICIOS INMOBILIARIOS'
 if doc.paragraphs[0].text!=title:doc.paragraphs[0].insert_paragraph_before(title)
 clause=re.compile(r'^(?:PRIMERA|SEGUNDA|TERCERA|CUARTA|QUINTA|SEXTA|SÉPTIMA|OCTAVA|NOVENA)\s*\.?\s*-?\s*\([^)]*\)')
 for p in list(doc.paragraphs):
  match=clause.match(p.text)
  if match and p.text[match.end():].strip():
   heading=p.insert_paragraph_before(match.group());p.text=p.text[match.end():].strip()
 for p in doc.paragraphs:
  text=p.text.strip();fmt=p.paragraph_format
  fmt.page_break_before=False;fmt.widow_control=True;fmt.keep_together=False;fmt.keep_with_next=False
  fmt.left_indent=Inches(0);fmt.space_before=Pt(0);fmt.space_after=Pt(7);fmt.line_spacing=1.3
  heading=text in ['DECLARACIONES','CLÁUSULAS'];is_clause=bool(clause.fullmatch(text));declaration=bool(re.match(r'^(?:I|II|III)\. Declara',text))
  p.alignment=WD_ALIGN_PARAGRAPH.LEFT
  if text==title:p.alignment=WD_ALIGN_PARAGRAPH.CENTER;fmt.space_after=Pt(16);fmt.keep_with_next=True
  elif heading:p.alignment=WD_ALIGN_PARAGRAPH.CENTER;fmt.space_before=Pt(13);fmt.space_after=Pt(10);fmt.keep_with_next=True
  elif is_clause or declaration:fmt.space_before=Pt(10);fmt.space_after=Pt(6);fmt.keep_with_next=True
  elif re.match(r'^(?:[abcd]\)|[123]\.|I{1,3}\.|IV\.|V\.|VI\.)',text):fmt.left_indent=Inches(.15);fmt.line_spacing=1.25
  for run in p.runs:
   run.font.name='Arial';run.font.size=Pt(14 if text==title else 12 if heading else 11)
   fonts=run._element.get_or_add_rPr().rFonts
   if fonts is not None:
    for key in ['asciiTheme','hAnsiTheme','eastAsiaTheme','cstheme']:fonts.attrib.pop(qn('w:'+key),None)
   if text==title or heading or is_clause or declaration:run.bold=True
 for table in doc.tables:
  for row in table.rows:
   for cell in row.cells:
    for p in cell.paragraphs:
     p.paragraph_format.space_before=Pt(12);p.paragraph_format.space_after=Pt(6);p.paragraph_format.line_spacing=1.2
     for run in p.runs:run.font.name='Arial';run.font.size=Pt(10)
