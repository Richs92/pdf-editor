# Usuarios y contraseñas sin correo

El administrador entra con el usuario **admin**. Para establecer su contraseña inicial sin enviar correos:

1. En Netlify, abre el sitio → Project configuration → Environment variables.
2. Añade `ADMIN_INITIAL_PASSWORD`, con una contraseña elegida por ti de al menos 12 caracteres. Mantén el valor secreto y disponible para Functions, en Production.
3. En Deploys, publica de nuevo el sitio (Trigger deploy).
4. Abre la web e inicia sesión con usuario `admin` y esa contraseña.
5. Después del primer acceso correcto puedes borrar esta variable. Su uso queda consumido en Supabase y no vuelve a restablecer la contraseña.

Conserva `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY`. No necesitas ejecutar SQL nuevo si ya creaste las tablas y el administrador.

En Admin, escribe el nombre, un usuario como `ana.ventas` y sus permisos. El sistema genera la contraseña y la muestra para entregarla al usuario. Puede entrar directamente. Si la olvida, pulsa **Nueva contraseña** y entrega la nueva. No se envían correos. El usuario puede cambiar su contraseña desde Mi cuenta si quiere.

Los usuarios admiten de 3 a 32 caracteres: letras, números, puntos, guiones y guiones bajos; empiezan con letra. Se convierten a minúsculas. `admin` está reservado.

Internamente Supabase requiere un identificador con formato de correo; usamos un alias técnico bajo `users.terminavit.invalid`, confirmado desde el servidor, sin correo real ni envíos. Las cuentas anteriores siguen aceptando su identificador anterior. Los permisos y el registro de actividad se conservan.

---

## Configuración original de la base de datos

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

No necesitas una clave pública de Supabase en el navegador, ni configurar un servidor SMTP para crear usuarios desde el Admin. La aplicación marca sus correos como confirmados y te muestra la contraseña para compartirla tú.

## 4. Desplegar cuando estén listos los pasos anteriores

Puedes probar primero un despliegue de la rama `feature/home-admin-access` en Netlify. Cuando termines de configurar Supabase y las variables, incorpora esa rama a `main` y despliega. Los redirects y Netlify Functions están definidos en `netlify.toml`; no cambies la carpeta de publicación `dist`.

No subas únicamente un ZIP de `dist` a Netlify Drop: esta versión usa funciones de servidor y las plantillas privadas del build. Debe desplegarse desde el repositorio con `npm ci && npm run build`.

La web mostrará el Home después de iniciar sesión. CFE cambia a `/cfe.html`; Agua, Predial y Contratos conservan sus direcciones. El enlace `/admin.html` aparece solo para el administrador.

## 5. Comprobación en tu sitio

1. Entra con tu cuenta administradora y comprueba las cuatro secciones.
2. En Admin, crea un usuario con nombre de acceso y nombre completo. Marca, por ejemplo, solo Agua.
3. Copia la contraseña y entrégala por un medio privado. Se muestra una sola vez en la interfaz; si se pierde, genera otra con **Nueva contraseña**.
4. En otra sesión del navegador, entra con ese usuario. Puede usar sus documentos directamente, sin cambiar la contraseña.
5. Comprueba que puede entrar a Agua y que CFE, Contratos y Predial aparecen bloqueados, incluso si pega sus URL directamente.
6. Genera y solicita descargar un documento. En Admin → Log de actividad debe aparecer el usuario, la sección, la acción y la fecha de Mazatlán.
7. Cambia los permisos o desactiva el usuario. El servidor aplicará el cambio en su próxima solicitud, sin esperar a que caduque la sesión.

## Qué registra el log

El servidor registra accesos correctos/fallidos, entradas a secciones, alta y modificación de usuarios, cambios de permisos, contraseñas restablecidas y cambios de contraseña. El navegador reporta generación y solicitud de descarga de documentos, con tipo de documento y formato.

No se guardan contraseñas en el log. Cada descarga nueva archiva un PDF privado con el contenido y anexos incluidos; el administrador puede abrirlo en “Ver documento”. El bucket privado de Supabase Storage se crea automáticamente con la clave service_role existente. Los registros anteriores no contienen archivos. Los eventos del navegador no prueban que un archivo se guardó físicamente: el log indica su origen. Un administrador de la web puede consultar el registro, pero no modificarlo ni borrarlo desde la aplicación. El propietario de la base de datos conserva el control de su infraestructura.

## Límites y recuperación

La protección se aplica a las páginas y plantillas del nuevo despliegue. No cambia la visibilidad del repositorio, despliegues históricos ni archivos que ya se hayan descargado. Las credenciales de cada usuario son personales; si se comparten, el log identifica la cuenta utilizada.

Para recuperar la cuenta administradora, configura primero **Authentication → URL Configuration**:

- **Site URL**: `https://pdfeditorterminavit.netlify.app`
- **Redirect URLs**: agrega `https://pdfeditorterminavit.netlify.app/recover.html` y la URL raíz de tu sitio.

Luego envía un correo nuevo desde **Authentication → Users → usuario → Send password recovery**. Usa solo el correo más reciente. La página `/recover.html` permite establecer una contraseña nueva sin pedir la anterior. Soporta el enlace predeterminado de Supabase (sesión de recuperación en el fragmento URL) y la variante de token hash de un solo uso. Los tokens se retiran inmediatamente de la URL del navegador y nunca se registran en el log.

Si el proveedor de correo consume enlaces automáticamente y el predeterminado vuelve a aparecer vencido, en **Authentication → Emails → Reset password** puede usarse este enlace, que solo se verifica al guardar la contraseña:

```html
<a href="{{ .SiteURL }}/recover.html#token_hash={{ .TokenHash }}&amp;type=recovery">Cambiar mi contraseña</a>
```

Después de modificar la plantilla, solicita un correo nuevo. No se incluye una contraseña maestra ni una ruta de recuperación sin autenticación.

Si ves “El administrador aún no ha activado el acceso al sistema”, comprueba las dos variables en Functions y vuelve a desplegar. Si Supabase tiene el proyecto pausado, reanúdalo desde su panel. Si la cuenta autentica pero no tiene perfil, verifica que ejecutaste ambos scripts SQL con el correo correcto.

## Pruebas incluidas

`npm test` verifica autorización, cookies de sesión, bloqueo sin configuración, permisos y la migración SQL en PostgreSQL embebido (PGlite). `npm run test:admin` verifica el flujo del administrador y de un usuario en un navegador móvil, usando un sustituto local de Supabase. Las pruebas no crean cuentas reales ni aplican cambios al proyecto de producción.

La conexión con Supabase real y el despliegue real en Netlify quedan pendientes hasta que configures el proyecto. No se ha afirmado que esa conexión ya esté activada.
