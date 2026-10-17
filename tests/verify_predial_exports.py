"""Run after npm test and npm run test:predial."""
from pathlib import Path
from collections import Counter
import fitz

with fitz.open('data/predial/original.pdf') as original:
    images=Counter(info['digest'] for info in original[0].get_image_info(hashes=True))
for name,optional in [('required',False),('optional',True),('browser-required',False),('browser-optional',True)]:
    with fitz.open(Path('artifacts/predial')/(name+'.pdf')) as pdf:
        assert len(pdf)==1
        text=pdf[0].get_text()
        for expected in ['007-012-034-056-078-001','MARÍA LÓPEZ PÉREZ','AVENIDA NUEVA 123, COLONIA CENTRO, CULIACÁN, SINALOA, CP 80000','30/11/2026']:
            assert text.count(expected)==2,(name,expected)
        for old in ['007-000-039-588-004-001','DUARTE VALENZUELA BRENDA OLIVIA','30/09/2026','PASEO DE OVIEDO']:
            assert old not in text,(name,old)
        expected=['12,500.01','321.50','88.75','DOCE MIL QUINIENTOS PESOS 01/100 M.N.'] if optional else ['46,504.00','132.00','43.52','CUARENTA Y SEIS MIL QUINIENTOS CUATRO']
        for value in expected:assert text.count(value)==2,(name,value)
        if optional:
            for old in ['46,504.00','132.00','43.52']:assert old not in text,(name,old)
        assert Counter(info['digest'] for info in pdf[0].get_image_info(hashes=True))==images,'Las imágenes deben conservarse'
        print(name+': ambas copias, campos opcionales e imágenes originales correctos')
