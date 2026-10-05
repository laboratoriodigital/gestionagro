# Search Console de cultivopro.co

**Estado (5 oct 2026):** la propiedad de tipo **Dominio** `cultivopro.co` ya está verificada. Faltan dos cosas: conectar el reporte semanal (una vez, ~15 minutos) y pedir la indexación (cuando el agrónomo apruebe).

## 1. Qué hacer ahora: nada con el sitemap ni con la indexación

Todavía no hay nada que pedirle a Google, y a propósito:

- Las dos calculadoras siguen en `borrador`: llevan `noindex` y **no entran al sitemap**. `https://cultivopro.co/sitemap.xml` sale vacío hasta que una herramienta esté `activo`.
- Si envías un sitemap vacío, o pides indexar una página `noindex`, Search Console solo mostrará errores.
- Lo que sí corre solo: Google ya conoce el dominio y empieza a registrar visitas y consultas.

## 2. Conectar el reporte semanal

El reporte de los lunes (un issue del repositorio) trae las impresiones y los clics de la semana en Google, comparados con la anterior. Para leerlas usa una **cuenta de servicio de solo lectura**: una cuenta de robot de Google que solo ve las cifras agregadas de Search Console. No es tu cuenta personal.

### 2.1 Crearla en Google Cloud

1. <https://console.cloud.google.com> → elige el proyecto donde está el cliente de «Entrar con Google» (o crea uno).
2. **APIs y servicios** → **Biblioteca** → busca **Google Search Console API** → **Habilitar**.
3. **IAM y administración** → **Cuentas de servicio** → **Crear cuenta de servicio**. Nombre: `cultivopro-reporte`. Salta los pasos de roles y de acceso: no necesita ninguno.
4. Entra a la cuenta creada → pestaña **Claves** → **Agregar clave** → **Crear clave nueva** → **JSON** → **Crear**. Se descarga un archivo `.json`.
5. En la pestaña **Detalles**, copia el **correo** de la cuenta (termina en `.iam.gserviceaccount.com`).

### 2.2 Darle acceso a la propiedad

1. <https://search.google.com/search-console> → propiedad `cultivopro.co` → **Configuración** → **Usuarios y permisos** → **Agregar usuario**.
2. Pega el correo de la cuenta de servicio. Permiso: **Restringido** (solo lectura).

### 2.3 Guardar la clave en GitHub

1. En el repositorio: **Settings** → **Secrets and variables** → **Actions** → **New repository secret**.
2. Nombre: `GOOGLE_SEARCH_CONSOLE_CLAVE`. Valor: **todo el contenido** del archivo `.json`, tal cual.
3. **Borra el archivo `.json` descargado** de tu computador. Esa clave solo debe vivir en GitHub. Nunca la pegues en un chat, un issue ni un archivo del repositorio.

### 2.4 Probar

**Actions** → **reporte-semanal** → **Run workflow**. El issue que se crea debe traer la sección «Google (Search Console…)».

| Lo que dice la sección | Qué significa |
|---|---|
| «falta el secreto GOOGLE_SEARCH_CONSOLE_CLAVE» | El secreto no está o tiene otro nombre |
| «no tiene acceso a sc-domain:cultivopro.co: agrégala como usuario» | Falta el paso 2.2 |
| «Google no dio acceso a la cuenta de servicio» | La clave está mal pegada o se borró; crea otra en el paso 2.1 |
| «Sin datos todavía…» | **Está bien**: todo conectado; Google tarda unos días en mostrar un sitio nuevo y aún no hay páginas por indexar |
| Impresiones y clics | Funciona |

Si algún día se filtra la clave: en Google Cloud, **Cuentas de servicio** → la cuenta → **Claves** → borra la clave, crea otra y actualiza el secreto.

## 3. Cuando el agrónomo apruebe (HU-E2.6)

1. Pasa la herramienta a `activo` como dice `docs/agro/validacion/revision-agronomica.md` y publica la versión. El sitemap se llena solo.
2. En Search Console → **Sitemaps** → agrega `sitemap.xml` → **Enviar**. Debe decir «Correcto» y mostrar las páginas descubiertas.
3. **Inspección de URLs** → pega la dirección de cada herramienta activa (por ejemplo `https://cultivopro.co/herramientas/agro/calculadora-dpv/`) → **Solicitar indexación**.
4. Anota la fecha en `docs/agro/validacion/dpv.md`: ahí empieza el reloj de 90 días de la DPV: la evaluación cae 90 días después de esa fecha (el plan original la ponía el 25 feb 2027, contando con publicar a fines de noviembre).
