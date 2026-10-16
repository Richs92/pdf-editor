import unittest
import fitz
from app import generate, DEFAULTS

class PDFTests(unittest.TestCase):
    def test_replace_and_preserve_pages(self):
        data = dict(name='MARÍA LÓPEZ', address='CALLE NUEVA 123\nCOLONIA CENTRO\nMAZATLÁN, SINALOA', service='123456789012')
        with fitz.open(stream=generate(data),filetype='pdf') as pdf:
            self.assertEqual(len(pdf),2)
            text = pdf[0].get_text()
            self.assertIn(data['name'],text)
            self.assertIn('CALLE NUEVA 123',text)
            self.assertEqual(text.count(data['service']),2)
            self.assertNotIn(DEFAULTS['name'],text)
            self.assertNotIn(DEFAULTS['service'],text)
            self.assertNotIn('PUERTO NATALES',text)
            self.assertEqual(text.count('80014 14-03-05 XAXX-010101 005 CFE'),2)
            with fitz.open('data/template.pdf') as original:
                self.assertEqual(pdf[1].get_text(),original[1].get_text())
    def test_invalid_fields(self):
        for patch in [{'service':'123'},{'address':'a\nb\nc\nd\ne'},{'name':''},{'name':'😀'}]:
            with self.subTest(patch=patch), self.assertRaises(ValueError):
                generate(DEFAULTS | patch)

if __name__ == '__main__': unittest.main()
