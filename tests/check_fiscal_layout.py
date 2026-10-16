"""Run after npm test: python3 tests/check_fiscal_layout.py."""
import fitz

with fitz.open('artifacts/test-generated.pdf') as pdf:
    spans = [span for block in pdf[1].get_text('dict')['blocks']
             for line in block.get('lines', []) for span in line['spans']]
    row = next(span for span in spans if span['text'].startswith('RFC:'))
    for value in ['XAXX010101000', 'COMERCIALIZADORA DEL PACÍFICO SA DE CV',
                  'Régimen Fiscal: 601', 'CP: 80014', 'AC Folio: 000063283419']:
        assert value in row['text'], value
    assert abs(row['origin'][0] - 77) < .01
    assert abs(row['origin'][1] - 368.92) < .01
    assert row['bbox'][2] <= 442
    assert any(s['text'] == 'da: kWh' and abs(s['origin'][1] - 373.92) < .01 for s in spans)
    assert any(s['text'] == '|||||||||' and abs(s['origin'][1] - 378.92) < .01 for s in spans)
print('Distribución fiscal original verificada: una línea, orden, posición y ancho.')
