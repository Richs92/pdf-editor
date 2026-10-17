"""Prepare named placeholders while retaining original Word runs and formatting."""
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
import re,json,xml.etree.ElementTree as ET
W='http://schemas.openxmlformats.org/wordprocessingml/2006/main'
NS={'w':W}
fields={}
def field(key,label,group='Datos del contrato',kind='text',default=''):
    fields[key]=dict(key=key,label=label,group=group,type=kind,default=default)

for key,label in [('seller','Nombre completo del vendedor'),('sellerId','Identificación del vendedor: tipo y número'),('sellerAddress','Domicilio completo del vendedor'),('civilStatus','Estado civil y datos del acta de matrimonio'),('buyer','Nombre completo del comprador'),('buyerId','Identificación del comprador: tipo y número'),('buyerAddress','Domicilio completo del comprador'),('spouse','Nombre completo del cónyuge')]:field(key,label,'Personas', 'textarea' if 'Address' in key or key=='civilStatus' else 'text')
for key,label in [('title','Escritura o título: número, fecha y notaría'),('registry','Datos de inscripción en el Registro Público'),('propertyAddress','Dirección completa del inmueble'),('boundaries','Medidas y colindancias'),('cadastre','Clave catastral'),('folio','Folio registral'),('lien','Tipo de gravamen'),('credit','Número de crédito'),('balance','Saldo insoluto ($)')]:field(key,label,'Inmueble', 'textarea' if key in ['title','registry','propertyAddress','boundaries'] else 'text')
for key,label in [('price','Precio de compraventa ($)'),('priceWords','Precio en letra'),('payment','Forma de pago'),('deposit','Depósito en garantía ($)'),('depositWords','Depósito en letra'),('penalty','Doble del depósito / penalización ($)'),('penaltyWords','Penalización en letra')]:field(key,label,'Importes y pago')
for key,label in [('cancelDays','Días para cancelar el gravamen'),('ratifyDays','Días para ratificar firmas'),('noticeDays','Días hábiles de anticipación para convocar a firma'),('penaltyDays','Días para pagar el doble del depósito'),('refundDays','Plazo de restitución del depósito (tabla de referencia)'),('thirdPartyDays','Anticipación para designar tercero (tabla de referencia)')]:field(key,label,'Plazos','number')
field('deadline','Fecha límite del contrato definitivo','Plazos')
for key,label in [('jurisdiction','Ciudad para jurisdicción (Sinaloa)'),('signCity','Ciudad y estado de firma'),('signHour','Hora de firma'),('signDay','Día de firma'),('signMonth','Mes de firma'),('signYear','Año de firma'),('notary','Nombre del notario público'),('notaryNumber','Número de notaría'),('notaryCity','Ciudad de la notaría (Sinaloa)')]:field(key,label,'Firma y notaría')
for key,label,default in [('subscriber','Nombre completo del suscriptor',''),('subscriberAddress','Domicilio completo del suscriptor',''),('beneficiary','Nombre del beneficiario','TERMINAVIT'),('beneficiaryAddress','Domicilio completo del beneficiario','Avenida Juan de la Barrera número 1141, local 8 “Plaza del Parque”, Colonia Chapultepec, CP 80040, Culiacán, Sinaloa'),('amount','Importe del pagaré ($)',''),('amountWords','Importe en letra (incluye centavos y moneda)',''),('issueCity','Lugar de suscripción','Culiacán, Sinaloa'),('issueDate','Fecha de suscripción (en letra)',''),('dueDate','Fecha de vencimiento (en letra)',''),('paymentCity','Lugar de pago','Culiacán, Sinaloa'),('ordinaryRate','Tasa ordinaria anual (%)','40'),('ordinaryWords','Tasa ordinaria en letra','cuarenta'),('lateRate','Tasa moratoria anual (%)','80'),('lateWords','Tasa moratoria en letra','ochenta'),('noteJurisdiction','Ciudad y estado para jurisdicción','Culiacán, Sinaloa')]:field(key,label,'Datos del pagaré',default=default)

simple={'NOMBRE COMPLETO DEL PROMITENTE VENDEDOR':'seller','NOMBRE COMPLETO DEL PROMITENTE COMPRADOR':'buyer','DOMICILIO COMPLETO DEL VENDEDOR':'sellerAddress','DOMICILIO COMPLETO DEL COMPRADOR':'buyerAddress','ESCRITURA PÚBLICA / TÍTULO DE PROPIEDAD NÚMERO, FECHA Y NOTARÍA':'title','DATOS DE INSCRIPCIÓN':'registry','DESCRIPCIÓN DE MEDIDAS Y COLINDANCIAS':'boundaries','CLAVE CATASTRAL':'cadastre','FOLIO REGISTRAL':'folio','NÚMERO DE CRÉDITO':'credit','MONTO DEL SALDO INSOLUTO':'balance','FORMA DE PAGO: TRANSFERENCIA, CHEQUE CERTIFICADO, ETC.':'payment','MONTO DEL DEPÓSITO':'deposit','FECHA LÍMITE':'deadline','NOMBRE COMPLETO DEL CÓNYUGE':'spouse','NOMBRE DEL NOTARIO PÚBLICO':'notary','CIUDAD, ESTADO':'signCity','HORA':'signHour','DÍA':'signDay','MES':'signMonth','AÑO':'signYear','CASADO, EN CASO DE SER CASADO AGREGAR DATOS DE ACTA DE MATRIMONIO O SOLTERO':'civilStatus','ESTADO CIVIL, SOLTERO O CASADO':'civilStatus'}

def resolve(marker,text,previous,signatures):
    if marker in simple:return simple[marker]
    if marker.startswith('DIRECCIÓN COMPLETA'):return 'propertyAddress'
    if marker.startswith('TIPO DE GRAVAMEN'):return 'lien'
    if marker=='TIPO Y NÚMERO DE IDENTIFICACIÓN OFICIAL':
        return 'buyerId' if ('COMPRADOR' in previous and not text.startswith('a)')) or 'DOMICILIO COMPLETO DEL COMPRADOR' in text else 'sellerId'
    if marker=='NOMBRE COMPLETO':
        signatures[0]+=1
        return 'seller' if signatures[0]==1 else 'buyer'
    if marker=='CIUDAD, SINALOA':return 'notaryCity' if 'NOTARIO PÚBLICO' in text else 'jurisdiction'
    if marker in ['MONTO EN NÚMERO','MONTO EN LETRA']:
        context=text+' '+previous if len(text)<160 else text
        stem='penalty' if 'incumplimiento es atribuible a EL PROMITENTE VENDEDOR' in text else 'deposit' if 'MONTO DEL DEPÓSITO' in text else 'price'
        return stem+('Words' if marker=='MONTO EN LETRA' else '')
    if marker=='NÚMERO':
        if 'NOTARIO PÚBLICO NÚMERO' in text:return 'notaryNumber'
        context=(text+' '+previous).lower()
        if 'ratificaci' in context or 'ratificar sus firmas' in context:return 'ratifyDays'
        if 'cancelación' in context and 'gravamen' in context:return 'cancelDays'
        if 'convocar' in context or 'días hábiles de anticipación' in context:return 'noticeDays'
        if 'incumplimiento es atribuible' in context or 'doble del depósito' in context:return 'penaltyDays'
        if 'restituir el depósito' in context:return 'refundDays'
        if 'tercero adquirente' in context:return 'thirdPartyDays'
    raise ValueError((marker,text,previous))

def replace_ranges(paragraph,replacements):
    nodes=paragraph.findall('.//w:t',NS);offsets=[];pos=0
    for node in nodes:
        value=node.text or '';offsets.append((node,pos,pos+len(value)));pos+=len(value)
    for start,end,value in sorted(replacements,reverse=True):
        matching=[(n,a,b) for n,a,b in offsets if a<end and b>start]
        for j,(node,a,b) in enumerate(matching):
            text=node.text or ''
            left=max(0,start-a);right=min(b-a,end-a)
            node.text=text[:left]+(value if j==0 else '')+text[right:]
            node.set('{http://www.w3.org/XML/1998/namespace}space','preserve')

catalog=[]
for source in sorted(Path('data/contracts').glob('*.docx')):
    key=source.stem
    with ZipFile(source) as z:
        xml=z.read('word/document.xml').decode()
        # Preserve namespace prefixes used by Word's compatibility attributes.
        for prefix,uri in re.findall(r'xmlns:([\w]+)="([^"]+)"',xml):
            if not re.fullmatch(r'ns\d+',prefix):ET.register_namespace(prefix,uri)
        root=ET.fromstring(xml)
        if key!='pagare':
            # The final checklist is internal guidance, not part of the client contract.
            body=root.find('w:body',NS)
            children=list(body)
            guide=next((i for i,node in enumerate(children) if 'DATOS A COMPLETAR ANTES DE FIRMAR' in ''.join(n.text or '' for n in node.findall('.//w:t',NS))),None)
            if guide is None:raise ValueError(f'{source.name}: no se encontró la guía interna esperada')
            start=guide
            while start>0:
                previous=children[start-1]
                if previous.tag!='{'+W+'}p' or ''.join(previous.itertext()).strip() or previous.find('.//w:drawing',NS) is not None or previous.find('.//w:sectPr',NS) is not None:break
                start-=1
            for node in children[start:]:
                if node.tag!='{'+W+'}sectPr':body.remove(node)
        paragraphs=root.findall('.//w:p',NS);used=[];signatures=[0]
        texts=[''.join(n.text or '' for n in p.findall('.//w:t',NS)) for p in paragraphs]
        for i,(p,text) in enumerate(zip(paragraphs,texts)):
            replacements=[]
            if key!='pagare':
                for match in re.finditer(r'\[([^]]+)\]',text):
                    f=resolve(match[1],text,texts[i-1] if i else '',signatures)
                    replacements.append((match.start(),match.end(),'{'+f+'}'));used.append(f)
            else:
                # Match the original note's actual text, including its repeated dates and names.
                mapping={
                    1:[('000,000.00','amount')],2:[('Culiacán, Sinaloa','issueCity')],3:[('15 de julio de 2026','issueDate')],4:[('1° de diciembre de 2026','dueDate')],5:[('Culiacán, Sinaloa','paymentCity')],
                    6:[('XXXXXXXX','subscriber'),('xxxxx','subscriberAddress'),('TERMINAVIT','beneficiary'),('000,000.00','amount'),('CANTIDAD EN LETRA 00/100 MONEDA NACIONAL','amountWords'),('Avenida Juan de la Barrera número 1141, local 8 “Plaza del Parque”, en la Colonia Chapultepec, código postal 80040,  en la ciudad de Culiacán, Sinaloa','beneficiaryAddress'),('1° (primero) de diciembre de 2026 (dos mil veintiséis)','dueDate')],
                    7:[('40%','ordinaryRate'),('cuarenta','ordinaryWords'),('80%','lateRate'),('ochenta','lateWords')],8:[('Culiacán, Sinaloa','noteJurisdiction')],11:[('XXXXXX','subscriber')],12:[('XXXXX, Culiacán, Sinaloa','subscriberAddress')],16:[('XXXXX','subscriber')]}
                for old,f in mapping.get(i,[]):
                    start=text.find(old)
                    if start<0:raise ValueError((i,old))
                    value='{'+f+'}'+('%' if old in ['40%','80%'] else '')
                    replacements.append((start,start+len(old),value));used.append(f)
            replace_ranges(p,replacements)
        xml=ET.tostring(root,encoding='utf-8',xml_declaration=True)
        serialized=xml.decode()
        root_tag=re.search(r'<w:document\b[^>]*>',serialized).group()
        declarations=''.join(' xmlns:'+prefix+'="'+uri+'"' for prefix,uri in re.findall(r'xmlns:([\w]+)="([^"]+)"',z.read('word/document.xml').decode()) if ('xmlns:'+prefix+'=') not in root_tag)
        serialized=serialized.replace(root_tag,root_tag[:-1]+declarations+'>',1)
        xml=serialized.encode()
        with ZipFile(Path('web/templates')/source.name,'w',ZIP_DEFLATED) as output:
            for item in z.infolist():output.writestr(item,xml if item.filename=='word/document.xml' else z.read(item.filename))
        status='Pagaré' if key=='pagare' else 'Sin ratificar' if key.startswith('sin-') else 'Ratificados'
        title='Pagaré TERMINAVIT' if key=='pagare' else 'Soltero' if key.endswith('soltero') else 'Sociedad conyugal' if key.endswith('sociedad') else 'Separación de bienes'
        selected=[fields[k].copy() for k in dict.fromkeys(used)]
        for f in selected:
            if f['key']=='civilStatus' and key.endswith('soltero'):f['default']='soltero'
        catalog.append(dict(id=key,title=title,group=status,template='templates/'+source.name,fields=selected))
Path('web/contracts-catalog.json').write_text(json.dumps(catalog,ensure_ascii=False,indent=2))
print('\n'.join(c['id']+': '+str(len(c['fields']))+' campos' for c in catalog))
