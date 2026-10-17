# Activar BanBajío

Se agrega una quinta sección con permisos independientes y registro de actividad. Solo contiene la primera hoja del PDF proporcionado. Las descargas llevan una marca de documento editado y conservan los saldos e importes del original.

En el proyecto Supabase conectado a Netlify, abre **SQL Editor → New query**, pega el contenido de [supabase/add-bank.sql](../supabase/add-bank.sql) y pulsa **Run**. Esto amplía las dos restricciones de módulos, sin borrar usuarios, permisos ni actividad. Es repetible. Después, Admin permite asignar BanBajío a los usuarios.

También se incluyen estas instrucciones en `/activar-banbajio.html`. Si una base existente aún no admite este módulo, la sección redirige a esa guía. No necesitas nuevas variables de Netlify.

Los periodos son del mes natural anterior en la zona America/Mazatlan, con último día correcto, fecha de corte, días mensuales y días acumulados del año. Las fechas visibles de los tres movimientos de la primera hoja conservan su día 1 y siguen el mes del periodo. Los importes, referencias y descripciones conservan sus valores originales y no se recalculan.
