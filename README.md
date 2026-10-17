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

## Contratos y pagaré

Desde el enlace **Contratos y pagaré** del editor se abre `contracts.html`. Incluye:

- Ratificados: soltero, separación de bienes y sociedad conyugal.
- Sin ratificar: soltero, separación de bienes y sociedad conyugal.
- Pagaré TERMINAVIT.

Cada plantilla tiene su formulario con campos distinguidos por contexto: identificación del vendedor/comprador, precio, depósito, penalización, plazos, datos del inmueble y firmas. Los datos repetidos se rellenan en el cuerpo, las firmas y las tablas de referencia. Las tasas e importes en letra se introducen expresamente; no se calculan ni se validan fiscal o jurídicamente. Las cláusulas y tablas de referencia de los originales se conservan, incluso cuando una tabla contiene campos que no aparecen en el cuerpo.

Las fotos opcionales de INE se capturan con la cámara del navegador (`capture="environment"`) o se cargan desde la galería, con frente/reverso del vendedor y del comprador. En el pagaré corresponden al suscriptor y al beneficiario. Se convierten a JPG en el navegador, se ajustan a un máximo de 1600 px y se insertan como anexos en páginas independientes. Las fotos se guardan en memoria por plantilla, sin `localStorage`, sin servidor, sin OCR ni subida automática. La opción de cámara depende de los permisos del dispositivo; la carga de imágenes funciona como alternativa.

**Descargas:** Word conserva los archivos de plantilla y sus formatos, reemplazando los marcadores e incorporando anexos. PDF usa texto seleccionable, formatos de párrafo, tablas (incluidas celdas combinadas) e imágenes, con paginación propia; la vista previa es una referencia del Word. Se incluyen tipografías Liberation (licencia en `web/fonts/LICENSE.txt`). Para Google Docs, se descarga el Word y el usuario lo sube a Drive y selecciona “Abrir con → Documentos de Google”; no se requiere ni se conecta una cuenta Google a esta app.

Las siete plantillas originales están en `data/contracts/`. `npm run prepare:contracts` regenera `web/templates/` y `web/contracts-catalog.json` con nombres de campo inequívocos, manteniendo los elementos XML del Word y sus namespaces. Ejecuta `npm run build` después de cualquier cambio.

### Verificación de contratos

Con Chromium disponible (`CHROMIUM_PATH` permite indicar su ruta):

```sh
npm ci
npm run build
npm run test:contracts
python3 tests/verify_contract_exports.py
```

La prueba de navegador abre las siete variantes, llena sus campos, incorpora imágenes ficticias en un contrato y un pagaré, descarga Word/PDF, comprueba la opción para Google Docs y el ancho móvil. La verificación de exportaciones requiere PyMuPDF y compara el contenido completo del Word con el PDF (descontando encabezados de tabla repetidos), revisa anexos y descarta páginas vacías. Los resultados se guardan únicamente en `artifacts/`, excluido de Git y del despliegue. No se prueba una cámara física ni una sesión real de Google Docs en el entorno automatizado.

## Recibo predial de Alameda

La opción **Predial** abre `predial.html`. Usa el PDF proporcionado y rellena las dos copias de su única página con los mismos datos:

- Clave catastral: seis bloques de tres dígitos, con `007` y `001` fijos. Admite pegar los 18 dígitos completos, con o sin guiones.
- Nombre, domicilio y vigencia hasta (fecha seleccionada manualmente; el PDF usa día/mes/año).
- Total, superficie de terreno y superficie construida: edición opcional con casillas de activación. Si no se activan, se conservan los valores originales aunque haya texto diferente en los cuadros deshabilitados.

Cuando se edita el total, su importe en letra se calcula en español con los mismos centavos en ambas copias. No se recalculan conceptos, periodos, calificación, referencias de pago ni códigos de barras. Se conservan imágenes y disposición del documento. La plantilla preparada elimina el texto anterior de los ocho campos por copia; la generación dibuja los nuevos valores en las posiciones originales.

El original está en `data/predial/original.pdf`. `npm run prepare:predial` regenera los archivos de `web/predial/` usando PyMuPDF. Para comprobar el formulario móvil, la descarga y ambas copias:

```sh
npm run build
npm test
npm run test:predial
python3 tests/verify_predial_exports.py
```

Las verificaciones comparan los campos en ambas mitades, el comportamiento de los opcionales y los contenidos de las imágenes originales. Resultados en `artifacts/predial/`, fuera del despliegue.
