# Documento · TERMINAVIT

Home con cuatro secciones: **Contratos y pagaré, CFE, Agua y Predial**. Incluye acceso por correo/contraseña, administración de usuarios, permisos por sección y log central de actividad.

## Activar el sistema privado

Sigue [Activar Home y Admin](docs/ACTIVAR-ADMIN.md): crea Supabase, ejecuta los scripts SQL, configura tu primer administrador y guarda las dos variables de servidor en Netlify. No hay usuarios ni contraseñas de producción predefinidos. La rama `feature/home-admin-access` está preparada para revisión y no sustituye el sitio público hasta completar la configuración.

Netlify usa `npm ci && npm run build`, Node 22 y la carpeta pública `dist`. El build separa las páginas y plantillas privadas en `netlify/private-assets/`; Netlify Functions valida la sesión, el estado del usuario y el permiso antes de servirlas. No despliegues esta versión como ZIP estático con Netlify Drop ni uses un servidor HTTP estático para las secciones privadas.

Las variables `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` existen solo en el servidor. Las sesiones usan cookies HttpOnly/Secure. Las contraseñas temporales se generan con criptografía del servidor; cada usuario debe cambiarlas antes de trabajar. Las tablas usan RLS y las funciones SQL de administración no se pueden invocar con una clave anónima. No se guardan documentos, fotos de INE ni contenido de formularios en el backend; solo perfiles, permisos y eventos.

## Desarrollo y pruebas

```sh
npm ci
npm run build
npm test
npm run test:admin
npm run test:cfe
npm run test:contracts
npm run test:predial
npm run test:water
```

Las pruebas de navegador usan un sustituto **solo de pruebas** de Supabase, creado bajo `tests/helpers/` y excluido del despliegue. La migración SQL se prueba en PostgreSQL embebido PGlite. Requieren Chromium; `CHROMIUM_PATH` permite indicar su ruta. Para desarrollo con Supabase real, guarda las variables en un `.env` local ignorado y usa Netlify CLI (`npx netlify-cli dev`) tras construir el proyecto.

La generación de PDF y Word sigue ocurriendo en el navegador. Sus dependencias se incluyen localmente en `dist/vendor` y no dependen de una CDN. Las secciones privadas están en `/contracts.html`, `/cfe.html`, `/water.html` y `/predial.html`.

## Alcance

Nombre de hasta 70 caracteres; dirección de hasta cuatro líneas de 65 caracteres; servicio de 12 dígitos. El texto reduce su tamaño para caber. El servicio visible también cambia en el talón inferior. Los datos fiscales del receptor se actualizan en la segunda página: RFC opcional de 12 o 13 caracteres, razón social opcional de hasta 120 caracteres, régimen fiscal de texto libre de hasta 150 caracteres (incluye opción seleccionable de Sueldos y Salarios e Ingresos Asimilados a Salarios) y CP fiscal de 5 dígitos. Se comprueba su formato, sin consultar el SAT. Los códigos QR, de barras y dígitos de control conservan su contenido original; la edición no constituye una reemisión del comprobante.

Las plantillas y sus datos iniciales se sirven tras comprobar sesión y permiso. Los datos que el usuario escribe y el PDF que genera se procesan localmente en su navegador; la app no envía ese contenido al servidor. El servidor recibe únicamente los eventos de acceso, generación y solicitud de descarga.

El servidor Python anterior (`app.py`) es una implementación local histórica sin el nuevo control de acceso y no se despliega. La versión de Netlify usa el Home y las funciones de autorización descritas arriba.

## Fechas automáticas

En cada generación se lee la fecha actual del dispositivo en la zona `America/Mazatlan`. Se toma octubre de 2026, mes de pago de la plantilla, como referencia y se desplazan meses y años por igual en las 28 fechas visibles: pago, corte de ambas páginas, periodo facturado, impresión e historial. Los días y la hora original se conservan. El código de fecha visible en el talón también se desplaza; los códigos QR y de barras no se regeneran, ni se recalculan consumos o importes. El resumen del formulario muestra el periodo y vencimientos antes de descargar. Cambiar las fechas de esta copia no constituye una nueva emisión ni acredita vigencia ante CFE.

Las pruebas de fechas incluyen noviembre, cambio de año y límite de mes en Mazatlán. Para comprobar la distribución fiscal después de `npm test`: `python3 tests/check_fiscal_layout.py` (requiere PyMuPDF).

Las once etiquetas del eje horizontal del gráfico histórico también se actualizan con el mismo desplazamiento mensual que los finales de periodo de la tabla, en orden cronológico. Se mantienen las barras, los kWh, importes y pagos originales. Las etiquetas originales de la imagen se eliminaron de la plantilla para evitar superposiciones.

## Vista previa en celular

La vista previa usa PDF.js incluido localmente y dibuja todas las páginas en canvas, con ancho adaptable y sin visor PDF incrustado. Así no depende de la limitación del visor de iOS que mostraba solo la primera página. Los campos usan 16 px para evitar el zoom automático al enfocar en Safari. El viewport fija escala mínima/máxima 1 y se limitan los gestos de ampliación; algunos navegadores o ajustes de accesibilidad pueden ignorar esta restricción. Se mantiene el desplazamiento vertical normal y el PDF descargado sigue siendo el documento completo.

## Contratos y pagaré

Desde el Home, la sección **Contratos y pagaré** se abre `contracts.html`. Incluye:

- Ratificados: soltero, separación de bienes y sociedad conyugal.
- Sin ratificar: soltero, separación de bienes y sociedad conyugal.
- Pagaré TERMINAVIT.

Cada plantilla tiene su formulario con campos distinguidos por contexto: identificación del vendedor/comprador, precio, depósito, penalización, plazos, datos del inmueble y firmas. Los datos repetidos se rellenan en el cuerpo, las firmas y las tablas de referencia. Las tasas e importes en letra se introducen expresamente; no se calculan ni se validan fiscal o jurídicamente. Las cláusulas y tablas de referencia de los originales se conservan, incluso cuando una tabla contiene campos que no aparecen en el cuerpo.

Las fotos opcionales de INE se capturan con la cámara del navegador (`capture="environment"`) o se cargan desde la galería, con frente/reverso del vendedor y del comprador. En el pagaré corresponden al suscriptor y al beneficiario. Se intenta detectar y recortar la región rectangular de la credencial localmente. Si no hay bordes claros, se conserva la foto completa; el botón “Recortar INE” permite ajustar el encuadre desde el original. No se leen ni autocompletan datos de identificación. Se convierten a JPG en el navegador, se ajustan a un máximo de 1600 px y se insertan como anexos en páginas independientes. Las fotos se guardan en memoria por plantilla, sin `localStorage`, sin servidor, sin OCR ni subida automática. La opción de cámara depende de los permisos del dispositivo; la carga de imágenes funciona como alternativa.

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

## Recibo de agua JAPAC

La sección **Agua** (`water.html`) usa `recibo.pdf` como plantilla. Permite editar cuenta de nueve dígitos (conservando ceros iniciales), nombre y dirección. La categoría siempre se genera como **DOMÉSTICA**.

Las fechas se calculan en cada generación con la fecha del dispositivo, en horario de Mazatlán: emisión el día 03 del mes actual, vencimiento el día 07 y mes facturado igual al mes actual. La lectura actual queda en el día 03 de ese mes y la anterior en el día 03 del mes previo, incluyendo cambios de año. Se muestra un resumen antes de descargar. No se cambian los días ni se recalculan importes, tarifas, número de recibo, referencias de pago o QR al cambiar cuenta o categoría.

El original está en `data/water/original.pdf`. La plantilla preparada elimina solamente los nueve campos editables/dinámicos y conserva imágenes y fondos. Para regenerarla: `npm run prepare:water` (PyMuPDF). Verificación:

```sh
npm run build
npm test
npm run test:water
python3 tests/verify_water_exports.py
```

Incluye noviembre, cambio de año, zona horaria, categoría fija, descarga y anchos de pantalla de 320 a 1360 px. Los archivos de prueba se guardan en `artifacts/water/`, excluido del despliegue.

El **Recibo de apartado compra venta** se encuentra dentro de Contratos y pagaré, en su propio grupo. Su formulario permite editar fecha/lugar, comprador, receptor, persona sujeta a penalización, inmueble, apartado, precio, penalización y plazo de reserva (cinco días de forma predeterminada). Los importes se formatean con comas y se convierten a letra; los campos vacíos generan líneas imprimibles. Ofrece vista previa, Word, PDF y compartir, con los mismos permisos de contratos. La plantilla editable se reconstruye desde el PDF proporcionado, conservado en `data/originals/recibo-apartado.pdf`; el texto se adapta al contenido y puede cambiar de paginación con datos largos. Ejecuta `python3 scripts/prepare-apartado.py` para regenerar la plantilla y su entrada de catálogo. `prepare-contracts.py` también ejecuta ese paso al finalizar.

El recibo de apartado permite firmas dibujadas localmente: comprador en Entrega y asesor/vendedor en Recibe. Usa “Usar firma” para insertarlas en vista previa, Word y PDF; puedes quitarlas individualmente. Cambiar los datos o anexos invalida las firmas y exige volver a dibujarlas. La firma es una imagen, sin verificación de identidad ni certificado de plataforma. No se transmite ni se guarda de forma persistente. Verifica con `npm run test:signatures`.

El botón Imprimir prepara todas las páginas del PDF en un visor dentro de la pestaña activa y abre el diálogo del dispositivo. Está disponible en los cuatro módulos y registra `document_print_requested` (solicitud, no confirmación de impresión). Para Wi-Fi se utiliza el sistema de impresión del dispositivo, como AirPrint o el servicio de Android; la app no descubre impresoras ni se conecta a ellas directamente. Si el diálogo no abre, el visor incluye un botón Imprimir y descarga del PDF. La preparación tiene un límite de 45 segundos, un botón de cierre y una descarga disponible en cuanto se obtiene el PDF, incluso si el lector se bloquea. Verifica el flujo con `npm run test:printing`; la prueba sustituye el diálogo nativo, por lo que no valida una impresora física.

En iPhone/iPad el visor de impresión ofrece **Abrir PDF para imprimir**: abre el Blob del PDF original en una pestaña nueva mediante un enlace explícito, después de terminar la generación. En el visor nativo se utiliza Compartir → Imprimir. No se llama a `iframe.print()` ni se rasteriza el documento en esta ruta, porque iOS puede imprimir la interfaz padre recortada. El resto de dispositivos mantiene la vista de páginas con el diálogo de impresión.

Si el iPhone/iPad permite compartir archivos desde el navegador, el PDF se prepara antes de habilitar Imprimir. El clic llama directamente a Web Share con el PDF adjunto, conservando el gesto del usuario. El usuario elige Imprimir en la hoja nativa y selecciona su impresora. No se abre un visor intermedio. Si no está disponible o falla, se conserva el visor del PDF como alternativa. La app no puede seleccionar la acción Imprimir dentro de la hoja nativa ni confirmar su disponibilidad.

El grupo **Exclusiva** incorpora el contrato de mediación y servicios inmobiliarios del usuario. Su original se conserva en `data/originals/contrato-exclusiva.pdf` y su transcripción en `.txt`; `python3 scripts/prepare-exclusiva.py` regenera el DOCX y el catálogo (también se ejecuta desde `prepare-contracts.py`). Las cláusulas y tasas del original se conservan; solo sus espacios y los lugares de firma/jurisdicción son campos del formulario. El precio se convierte automáticamente a letra, los campos vacíos quedan como líneas y los anexos identifican Cliente y Profesional. No se habilita firma dibujada en este contrato; se imprime para firma a mano.

**Exclusiva · dos propietarios** define a ambos copropietarios como la parte cliente y mantiene las cláusulas de la versión base. Incluye datos y contacto separados, frente/reverso de INE y firma dibujada de cada propietario y del profesional. Cada persona tiene su propio campo de firma y su propia hoja de anexos. Los cambios en datos o anexos invalidan las firmas. `prepare-exclusiva.py` regenera ambas variantes; `npm run test:exclusiva-dos` comprueba las tres firmas y las tres hojas de INE en Word/PDF. La firma dibujada es una imagen local; no añade una certificación de identidad.

Ambas versiones de Exclusiva permiten editar comisión y vigencia inicial, con defaults 5 % y 90 días. La comisión acepta hasta dos decimales (punto o coma) y su texto se deriva automáticamente también al exportar. La vigencia acepta días enteros positivos y puede dejarse vacía. Los plazos de renovación y protección posteriores se conservan según el contrato original.

La presentación de ambas versiones de Exclusiva usa Arial 11, interlineado 1.3, márgenes de 0.8 pulgadas, título y encabezados diferenciados, incisos separados y paginación natural. El formulario muestra el PDF de exportación, reutilizado en descarga e impresión, para que la vista previa tenga exactamente la misma distribución. Los campos siguen siendo editables en el Word. No se limita el contrato a dos páginas.
