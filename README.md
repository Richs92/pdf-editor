# Documento · Editor PDF

Webapp estática para editar nombre, dirección y número de servicio del PDF incluido. Genera la vista previa y descarga directamente en el navegador, sin API, cuentas ni secretos. Conserva las dos páginas y usa una plantilla cuyos campos anteriores se eliminaron, no simplemente se cubrieron.

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

Nombre de hasta 70 caracteres; dirección de hasta cuatro líneas de 65 caracteres; servicio de 12 dígitos. El texto reduce su tamaño para caber. El servicio visible también cambia en el talón inferior. Los códigos QR, de barras, dígitos de control y datos fiscales conservan su contenido original; la edición no constituye una reemisión del comprobante.

La plantilla y sus datos iniciales se distribuyen con el sitio y serán públicos al publicarlo. Los datos que el visitante escribe y el PDF que genera se procesan localmente en su navegador; la app no los envía a un servidor.

La versión Python anterior sigue disponible para desarrollo con `python3 -m venv .venv`, `.venv/bin/pip install -r requirements.txt`, `.venv/bin/python app.py` y `.venv/bin/python -m unittest -v`. Netlify usa la versión estática en `web/`.
