# Activar Home, usuarios y permisos

El cambio está preparado en la rama `feature/home-admin-access`. No se ha aplicado al sitio de producción: primero crea Supabase y configura Netlify. El código falla con acceso cerrado si faltan esas variables; no hay usuarios ni contraseñas de producción predefinidos.

## 1. Crear el proyecto de Supabase

Entra a https://supabase.com/dashboard y crea un proyecto nuevo. El nombre puede ser `terminavit-documentos`. Guarda la contraseña de la base de datos de forma privada; esta app no necesita esa contraseña.

En **SQL Editor**, pega y ejecuta el contenido completo de [`supabase/setup.sql`](../supabase/setup.sql). El script crea perfiles, permisos y log, activa RLS y reserva los accesos de la aplicación al servidor. Puede volver a ejecutarse sin eliminar usuarios ni registros existentes.

En la configuración de **Authentication**, desactiva el registro público de usuarios. Los nuevos usuarios se darán de alta exclusivamente desde el Admin de la web. El inicio de sesión por correo y contraseña debe quedar habilitado.

## 2. Crear tu primer administrador

En **Authentication → Users**, agrega tu usuario con tu correo y una contraseña fuerte (mínimo 12 caracteres). Marca su correo como confirmado. No pongas esa contraseña en SQL, GitHub ni en este chat.

Abre [`supabase/bootstrap-admin.sql`](../supabase/bootstrap-admin.sql), reemplaza únicamente `REEMPLAZA_CON_TU_CORREO` por el correo del usuario que acabas de crear y ejecútalo en SQL Editor. Este paso te da el rol de administrador. No existe una página pública para autoasignarse ese rol.

## 3. Conectar Netlify con Supabase

En la configuración de API del proyecto de Supabase, localiza:

| Variable de Netlify | Valor que debes colocar de forma privada |
|---|---|
| `SUPABASE_URL` | URL del proyecto, del tipo `https://…supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | Clave JWT **legacy `service_role`**, no la clave `anon`/publicable |

Guarda ambas como variables de entorno de tu sitio en Netlify, para **Functions**, en los contextos donde vayas a probar/publicar la app. Si tu interfaz no permite elegir alcance, el código tampoco las incorpora al JavaScript de la web. La clave `service_role` es secreta: no la pongas en archivos, capturas, formularios de la app ni mensajes del chat.

No necesitas una clave pública de Supabase en el navegador, ni configurar un servidor SMTP para crear usuarios desde el Admin. La aplicación marca sus correos como confirmados y te muestra la contraseña temporal para compartirla tú.

## 4. Desplegar cuando estén listos los pasos anteriores

Puedes probar primero un despliegue de la rama `feature/home-admin-access` en Netlify. Cuando termines de configurar Supabase y las variables, incorpora esa rama a `main` y despliega. Los redirects y Netlify Functions están definidos en `netlify.toml`; no cambies la carpeta de publicación `dist`.

No subas únicamente un ZIP de `dist` a Netlify Drop: esta versión usa funciones de servidor y las plantillas privadas del build. Debe desplegarse desde el repositorio con `npm ci && npm run build`.

La web mostrará el Home después de iniciar sesión. CFE cambia a `/cfe.html`; Agua, Predial y Contratos conservan sus direcciones. El enlace `/admin.html` aparece solo para el administrador.

## 5. Comprobación en tu sitio

1. Entra con tu cuenta administradora y comprueba las cuatro secciones.
2. En Admin, crea un usuario con correo y nombre. Marca, por ejemplo, solo Agua.
3. Copia la contraseña temporal y entrégala por un medio privado. Se muestra una sola vez en la interfaz; si se pierde, genera otra con **Nueva contraseña**.
4. En otra sesión del navegador, entra con ese usuario. Debe cambiar la contraseña antes de usar documentos.
5. Comprueba que puede entrar a Agua y que CFE, Contratos y Predial aparecen bloqueados, incluso si pega sus URL directamente.
6. Genera y solicita descargar un documento. En Admin → Log de actividad debe aparecer el usuario, la sección, la acción y la fecha de Mazatlán.
7. Cambia los permisos o desactiva el usuario. El servidor aplicará el cambio en su próxima solicitud, sin esperar a que caduque la sesión.

## Qué registra el log

El servidor registra accesos correctos/fallidos, entradas a secciones, alta y modificación de usuarios, cambios de permisos, contraseñas restablecidas y cambios de contraseña. El navegador reporta generación y solicitud de descarga de documentos, con tipo de documento y formato.

No se guardan contraseñas, contenido de formularios, archivos generados ni fotos de INE. Los eventos del navegador no prueban que un archivo se guardó físicamente: el log indica su origen. Un administrador de la web puede consultar el registro, pero no modificarlo ni borrarlo desde la aplicación. El propietario de la base de datos conserva el control de su infraestructura.

## Límites y recuperación

La protección se aplica a las páginas y plantillas del nuevo despliegue. No cambia la visibilidad del repositorio, despliegues históricos ni archivos que ya se hayan descargado. Las credenciales de cada usuario son personales; si se comparten, el log identifica la cuenta utilizada.

Para recuperar la cuenta administradora, cambia su contraseña desde Supabase Authentication. No se incluye una contraseña maestra ni una ruta de recuperación sin autenticación.

Si ves “El administrador aún no ha activado el acceso al sistema”, comprueba las dos variables en Functions y vuelve a desplegar. Si Supabase tiene el proyecto pausado, reanúdalo desde su panel. Si la cuenta autentica pero no tiene perfil, verifica que ejecutaste ambos scripts SQL con el correo correcto.

## Pruebas incluidas

`npm test` verifica autorización, cookies de sesión, bloqueo sin configuración, permisos y la migración SQL en PostgreSQL embebido (PGlite). `npm run test:admin` verifica el flujo del administrador y de un usuario en un navegador móvil, usando un sustituto local de Supabase. Las pruebas no crean cuentas reales ni aplican cambios al proyecto de producción.

La conexión con Supabase real y el despliegue real en Netlify quedan pendientes hasta que configures el proyecto. No se ha afirmado que esa conexión ya esté activada.
