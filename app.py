import json
import re
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import fitz

ROOT = Path(__file__).resolve().parent
TEMPLATE = ROOT / 'data/template.pdf'
DEFAULTS = {'name': 'ANDRADE PARRA JUAN SIMON', 'address': 'PUERTO NATALES 4666 E CP.00000\nBLVD. DEL LAGO Y PUERTO BANUS\nZONA DORADA IC.P.80014\nCULIACAN,Sin.', 'service': '546140300406'}

def generate(data):
    name = str(data.get('name', '')).strip()
    lines = str(data.get('address', '')).strip().splitlines()
    service = str(data.get('service', '')).strip()
    if not name or len(name) > 70 or '\n' in name or not 1 <= len(lines) <= 4 or any(not x.strip() or len(x) > 65 for x in lines):
        raise ValueError('Escribe un nombre (máximo 70 caracteres) y de 1 a 4 líneas de dirección (máximo 65 caracteres por línea).')
    if not re.fullmatch(r'\d{12}', service, flags=re.ASCII):
        raise ValueError('El número de servicio debe tener exactamente 12 dígitos.')
    for value in [name, *lines]:
        try: value.encode('cp1252')
        except UnicodeEncodeError: raise ValueError('Usa caracteres latinos en el nombre y la dirección.')
    doc = fitz.open(TEMPLATE)
    page = doc[0]
    edits = [(fitz.Rect(24.8,69.3,225,82.4),name,9,'hebo',78), (fitz.Rect(94.2,138,145,146),service,7,'helv',144)]
    for i, line in enumerate(lines):
        edits.append((fitz.Rect(25,88+i*10,225,96+i*10),line.strip(),7,'helv',94+i*10))
    page.add_redact_annot(fitz.Rect(24.8,87.9,225,126),fill=False)
    for rect, *_ in edits: page.add_redact_annot(rect,fill=False)
    old = '01 546140300406 261004 000000230 6'
    footer_rect = page.search_for(old)[0]
    page.add_redact_annot(fitz.Rect(footer_rect.x0,560,footer_rect.x1,564),fill=False)
    page.apply_redactions(images=0, graphics=0)
    for rect,text,size,font,y in edits:
        while fitz.get_text_length(text,fontname=font,fontsize=size)>rect.width and size>5: size-=0.25
        page.insert_text((rect.x0,y),text,fontsize=size,fontname=font)
    page.insert_text((footer_rect.x0,563.8),f'01 {service} 261004 000000230 6',fontname='hebo',fontsize=6)
    result = doc.tobytes(garbage=4,deflate=True)
    doc.close()
    return result

class Handler(BaseHTTPRequestHandler):
    def respond(self, body, content_type, status=200):
        self.send_response(status)
        self.send_header('Content-Type', content_type)
        self.send_header('Content-Length', str(len(body)))
        self.send_header('Cache-Control', 'no-store')
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if self.path == '/api/defaults':
            return self.respond(json.dumps(DEFAULTS).encode(), 'application/json')
        files = {'/': ('static/index.html','text/html; charset=utf-8'), '/template.pdf': ('data/template.pdf','application/pdf')}
        if self.path not in files: return self.respond(b'Not found','text/plain',404)
        filename, mime = files[self.path]
        self.respond((ROOT / filename).read_bytes(),mime)

    def do_POST(self):
        if self.path != '/api/generate': return self.respond(b'Not found','text/plain',404)
        try:
            length = int(self.headers.get('Content-Length',0))
            if not 0 < length <= 16384: raise ValueError('Solicitud demasiado grande o vacía.')
            data = json.loads(self.rfile.read(length))
            if not isinstance(data,dict): raise ValueError('Formulario inválido.')
            result = generate(data)
        except (ValueError,TypeError) as error:
            return self.respond(json.dumps({'error':str(error)}).encode(),'application/json',400)
        self.respond(result,'application/pdf')

if __name__ == '__main__':
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument('--port',type=int,default=8000)
    parser.add_argument('--host',default='0.0.0.0')
    args = parser.parse_args()
    ThreadingHTTPServer((args.host,args.port),Handler).serve_forever()
