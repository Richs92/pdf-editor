# Documento · Editor PDF

Webapp estática para editar nombre, dirección, número de servicio, RFC, razón social, régimen fiscal y CP fiscal del PDF incluido. Genera la vista previa y descarga directamente en el navegador, sin API, cuentas ni secretos. Conserva las dos páginas y usa una plantilla cuyos campos anteriores se eliminaron, no simplemente se cubrieron.

## Netlify: subir la carpeta

1. Descarga `artifacts/pdf-editor-netlify.zip` y descomprímelo.
2. En Netlify abre **Add new project / Add new site → Deploy manually** (también puedes usar https://app.netlify.com/drop).
3. Arrastra la carpeta descomprimida que contiene `index.html`, `app.js`, `vendor/` y los demás archivos.
4. Netlify asignará una dirección pública al finalizar.

No subas la carpeta completa del repositorio ni el servidor Python. El ZIP contiene únicamente el sitio generado.

## Netlify: conectar Git

El archivo `netlify.toml` configura automáticamente `npm ci && npm run build` y la carpeta de publicación `dist`. Node 22. El repositorio debe contener estos cambios antes de conectar la rama en Netlify.

## Desarrollo estático

```sh
npm ci
npm run build
npm test
python3 -m http.server 8001 --directory dist
```

Después de editar `web/`, vuelve a ejecutar `npm run build`. La dependencia pdf-lib está fijada en el lockfile y se incluye localmente en `dist/vendor`; no depende de una CDN en ejecución.

## Alcance

Nombre de hasta 70 caracteres; dirección de hasta cuatro líneas de 65 caracteres; servicio de 12 dígitos. El texto reduce su tamaño para caber. El servicio visible también cambia en el talón inferior. Los datos fiscales del receptor se actualizan en la segunda página: RFC opcional de 12 o 13 caracteres, razón social opcional de hasta 120 caracteres, régimen fiscal de texto libre de hasta 150 caracteres (incluye opción seleccionable de Sueldos y Salarios e Ingresos Asimilados a Salarios) y CP fiscal de 5 dígitos. Se comprueba su formato, sin consultar el SAT. Los códigos QR, de barras y dígitos de control conservan su contenido original; la edición no constituye una reemisión del comprobante.

La plantilla y sus datos iniciales se distribuyen con el sitio y serán públicos al publicarlo. Los datos que el visitante escribe y el PDF que genera se procesan localmente en su navegador; la app no los envía a un servidor.

La versión Python anterior sigue disponible para desarrollo con `python3 -m venv .venv`, `.venv/bin/pip install -r requirements.txt`, `.venv/bin/python app.py` y `.venv/bin/python -m unittest -v`. Netlify usa la versión estática en `web/`.

## Fechas automáticas

En cada generación se lee la fecha actual del dispositivo en la zona `America/Mazatlan`. Se toma octubre de 2026, mes de pago de la plantilla, como referencia y se desplazan meses y años por igual en las 28 fechas visibles: pago, corte de ambas páginas, periodo facturado, impresión e historial. Los días y la hora original se conservan. El código de fecha visible en el talón también se desplaza; los códigos QR y de barras no se regeneran, ni se recalculan consumos o importes. El resumen del formulario muestra el periodo y vencimientos antes de descargar. Cambiar las fechas de esta copia no constituye una nueva emisión ni acredita vigencia ante CFE.

Las pruebas de fechas incluyen noviembre, cambio de año y límite de mes en Mazatlán. Para comprobar la distribución fiscal después de `npm test`: `python3 tests/check_fiscal_layout.py` (requiere PyMuPDF).

Las once etiquetas del eje horizontal del gráfico histórico también se actualizan con el mismo desplazamiento mensual que los finales de periodo de la tabla, en orden cronológico. Se mantienen las barras, los kWh, importes y pagos originales. Las etiquetas originales de la imagen se eliminaron de la plantilla para evitar superposiciones.

## Vista previa en celular

La vista previa usa PDF.js incluido localmente y dibuja todas las páginas en canvas, con ancho adaptable y sin visor PDF incrustado. Así no depende de la limitación del visor de iOS que mostraba solo la primera página. Los campos usan 16 px para evitar el zoom automático al enfocar en Safari. El viewport fija escala mínima/máxima 1 y se limitan los gestos de ampliación; algunos navegadores o ajustes de accesibilidad pueden ignorar esta restricción. Se mantiene el desplazamiento vertical normal y el PDF descargado sigue siendo el documento completo.
