from pathlib import Path
from collections import Counter
from datetime import datetime
from zoneinfo import ZoneInfo
import fitz
months=['ENERO','FEBRERO','MARZO','ABRIL','MAYO','JUNIO','JULIO','AGOSTO','SEPTIEMBRE','OCTUBRE','NOVIEMBRE','DICIEMBRE']
short=['ENE','FEB','MAR','ABR','MAY','JUN','JUL','AGO','SEP','OCT','NOV','DIC']
now=datetime.now(ZoneInfo('America/Mazatlan'))
with fitz.open('data/water/original.pdf') as original:
    images=Counter(i['digest'] for i in original[0].get_image_info(hashes=True))
for filename,year,month in [('november',2026,11),('browser',now.year,now.month)]:
    previous=month-1 if month>1 else 12
    previous_year=year if month>1 else year-1
    with fitz.open(Path('artifacts/water')/(filename+'.pdf')) as pdf:
        assert len(pdf)==1
        text=pdf[0].get_text()
        expected=['000990123','MARÍA LÓPEZ PÉREZ','AVENIDA NUEVA 123, CENTRO, CULIACÁN, SINALOA','DOMÉSTICA',f'03 {months[month-1]} {year}',f'07 {months[month-1]} {year}',f'03 {short[month-1]} {year}',f'03 {short[previous-1]} {previous_year}', 'No. Recibo:','41442548','021531433','002356643-000440611-2','1,087.00']
        for value in expected:assert value in text,(filename,value)
        for old in ['COMERCIAL','NU?EZ HAROS MARCO ANTONIO','JUAN DE LA BARRERA']:assert old not in text,(filename,old)
        assert Counter(i['digest'] for i in pdf[0].get_image_info(hashes=True))==images
        print(filename+': datos y fechas coherentes, referencias e imágenes conservadas')
