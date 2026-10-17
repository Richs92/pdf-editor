"""After npm run test:contracts, compare every exported Word/PDF and its INE annexes."""
from collections import Counter
from pathlib import Path
from zipfile import ZipFile
import json
import re
import unicodedata
import xml.etree.ElementTree as ET
import fitz

NS={'w':'http://schemas.openxmlformats.org/wordprocessingml/2006/main'}
W='{'+NS['w']+'}'
def normalized(text):
    return re.sub(r'\s+', '', unicodedata.normalize('NFKC',text)).replace('\xad','')

for item in json.loads(Path('web/contracts-catalog.json').read_text()):
    base=Path('artifacts/contracts')/item['id']
    with ZipFile(base.with_suffix('.docx')) as archive:
        assert archive.testzip() is None
        root=ET.fromstring(archive.read('word/document.xml'))
        text=''.join(t.text or '' for t in root.findall('.//w:t',NS))
        assert not re.search(r'\{[a-zA-Z][a-zA-Z0-9]*\}|\[[A-ZÁÉÍÓÚÑ][^]]*\]',text),item['id']
        photos=[n for n in archive.namelist() if 'terminavit-ine' in n]
        with fitz.open(base.with_suffix('.pdf')) as pdf:
            ptext=''.join(page.get_text() for page in pdf)
            # Word table headers intentionally repeat when a table crosses PDF pages.
            expected=Counter(normalized(text))
            actual=Counter(normalized(ptext))
            for row in root.findall('.//w:tr',NS):
                header=row.find('w:trPr/w:tblHeader',NS)
                if header is None or header.get(W+'val') in ['0','false','off']:
                    continue
                heading=normalized(''.join(t.text or '' for t in row.findall('.//w:t',NS)))
                repeats=normalized(ptext).count(heading)-normalized(text).count(heading)
                if repeats>0:actual.subtract(Counter({k:v*repeats for k,v in Counter(heading).items()}))
            assert expected==actual,(item['id'],expected-actual,actual-expected)
            assert all(page.get_text().strip() or page.get_images() for page in pdf),'Página vacía'
            assert sum(len(page.get_image_info()) for page in pdf)==len(photos),(item['id'],'Anexos incompletos')
            assert sum(bool(page.get_images()) for page in pdf)==(2 if len(photos)==4 else len(photos)),(item['id'],'Las caras no están agrupadas por persona')
            if len(photos)==4:
                annex=[page for page in pdf if page.get_image_info()]
                for role,page in zip(['Vendedor','Comprador'],annex):
                    images=page.get_image_info()
                    assert len(images)==2,(item['id'],role,'Falta una cara')
                    assert images[0]['bbox'][3]<images[1]['bbox'][1],(item['id'],'Imágenes superpuestas')
                    assert role in page.get_text()
                    assert page.get_text().index('Frente de INE')<page.get_text().index('Reverso de INE')
                groups=[table for table in root.findall('.//w:tbl',NS) if table.find('w:tblPr/w:tblCaption',NS) is not None and table.find('w:tblPr/w:tblCaption',NS).get(W+'val')=='TerminavitINE']
                assert len(groups)==2,(item['id'],'Una hoja por persona')
                for table in groups:
                    assert table.find('w:tr/w:trPr/w:cantSplit',NS) is not None
                    assert len(table.findall('.//w:drawing',NS))==2
            for value in ['PEDRO SUSCRIPTOR DE PRUEBA'] if item['id']=='pagare' else ['ANA PÉREZ GARCÍA','LUIS LÓPEZ RUIZ','INE VENDEDOR 123456789','INE COMPRADOR 987654321']:
                assert normalized(value) in normalized(text) and normalized(value) in normalized(ptext)
            print(f"{item['id']}: texto completo, {len(pdf)} páginas y {len(photos)} anexos verificados")

# Empty form exports still contain the template's text and handwriting lines in both formats.
for item in json.loads(Path('web/contracts-catalog.json').read_text()):
    base=Path('artifacts/contracts')/(item['id']+'-blancos')
    with ZipFile(base.with_suffix('.docx')) as archive:
        root=ET.fromstring(archive.read('word/document.xml'))
        text=''.join(t.text or '' for t in root.findall('.//w:t',NS))
        assert not re.search(r'\{[a-zA-Z][a-zA-Z0-9]*\}',text),item['id']
        assert '_'*24 in text,item['id']
        with fitz.open(base.with_suffix('.pdf')) as pdf:
            ptext=''.join(page.get_text() for page in pdf)
            assert '_'*24 in ptext,item['id']
            assert text.count('_')==ptext.count('_'),(item['id'],'Líneas incompletas en PDF')
            assert all(page.get_text().strip() or page.get_images() for page in pdf),'Página vacía'
        print(item['id']+': líneas para completar a mano verificadas en Word y PDF')
