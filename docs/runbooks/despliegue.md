# Runbook · Despliegue

Cómo sale una versión a staging y a producción, y qué hacer si algo falla. La fuente de las celdas es `infrastructure/celdas.json`; el flujo es `.github/workflows/desplegar.yml`; el script, `scripts/desplegar.ts` (HU-E1.5, ARQUITECTURA §7.3).

## Qué se despliega hoy

El Worker del sitio (`agro-sitio`) en la cuenta de la celda c0:
- las calculadoras (`/herramientas/agro/…`);
- el cuaderno (`/agro/app/`);
- `POST /api/eventos`.

Y el CORE (HU-E4.1) en la misma cuenta, que es quien dice `core.celda` en `celdas.json`:
- la base D1 `agro_core` (`agro_core_staging` en staging), creada por el despliegue si no existe;
- antes de migrar, la revisión de filas huérfanas: si la base tiene alguna, o si no se puede saber, no se migra (HU-C2.2, bitácora core 2);
- sus migraciones (`infrastructure/migraciones/core/`);
- el catálogo de productos y precios, copiado de `infrastructure/productos.json` y de cada `planes.json`, y la tabla `celda`, copiada de `celdas.json`, en ese orden (HU-C2.3);
- la comparación del catálogo de la base con los archivos: si no coinciden, el Worker no se publica y el resumen nombra cada diferencia;
- el Worker `agro-core` en workers.dev, que hoy solo responde `GET /api/core/salud`.

Y la API de cada celda (HU-E5.1), en todas las celdas activas, después del sitio y del CORE:
- una base D1 por shard (`agro_c0_s1`, `agro_c0_s1_staging`), creada si no existe, con sus migraciones (`infrastructure/migraciones/celda/`);
- el Worker `agro-api-<celda>` en workers.dev, con la clave pública del CORE del mismo destino.

| Destino | Cuándo | Dónde |
|---|---|---|
| Staging | Solo, cada vez que el CI termina en verde en `main` | `https://agro-sitio-staging.<subdominio>.workers.dev` (la URL exacta queda en el resumen de la corrida) |
| Producción | Al publicar una versión en GitHub | `https://cultivopro.co` |

El CORE vive en workers.dev en los dos destinos: `https://agro-core-staging.<subdominio>.workers.dev` y `https://agro-core.<subdominio>.workers.dev`. En producción tiene además su dominio propio, `https://cuenta.laboratorio-digital.com` (HU-C4.6): lo declara `celdas.json › core.dominio` y wrangler lo crea como Custom Domain al desplegar, con su registro DNS. La URL de workers.dev no se apaga: los cuadernos instalados la usan. Staging nunca lleva el dominio (una prueba lo exige).

### Dos productos en staging (HU-C3.7): cómo validarlo

Staging tiene un segundo producto, **Ensayo**, que no existe en producción. Su app está en `https://ed1-ensayo-staging.laboratoriodigital-la.workers.dev`.

1. Abre el cuaderno de staging (`https://agro-sitio-staging.laboratoriodigital-la.workers.dev/agro/app/`) y entra con tu cuenta de Google. Debes ver tus fincas de staging.
2. En otra pestaña, abre la app de Ensayo, marca la casilla y toca **Entrar con Google** con la **misma** cuenta.
3. Toca **Crear un espacio de prueba**. Debe aparecer «Espacio de prueba (dueno, plan gratis)», y en «Lo que dice tu sesión», `aud: ensayo` y `celda: c9`.
4. Vuelve al cuaderno de staging y recarga: tus fincas siguen ahí, y el espacio de Ensayo **no** aparece.
5. En Ensayo, toca **Salir**.

Si en el paso 3 o en el 4 ves algo de un producto en el otro, dime qué viste.

### El dominio de la cuenta: lo que hace el dueño, una vez

Antes de la primera publicación que lo lleve:

1. En Cloudflare, zona **laboratorio-digital.com** → **DNS** → **Records**: no debe existir un registro llamado `cuenta`. Si existe, dime antes de publicar: el Custom Domain no se crea encima de otro registro.
2. En Google Cloud: **APIs y servicios** → **Credenciales** → el cliente OAuth de «Entrar con Google» → **URI de redireccionamiento autorizados** → agrega estas dos, sin borrar las que ya están:
   - `https://cuenta.laboratorio-digital.com/api/core/auth/google/callback`
   - `https://cuenta.laboratorio-digital.com/api/core/drive/callback`
3. **Guardar.** Google puede tardar unos minutos en aplicarlo.

Después de publicar, el resumen del despliegue dice si el dominio ya responde. Si dice que todavía no, mira otra vez en unos minutos: el certificado tarda en salir.

Para cada celda, el flujo hace cuatro cosas:
1. Verifica el token con lecturas y, si falta un permiso, lo nombra.
2. Despliega lo que la celda aloja: el sitio y, si es la celda del CORE, la base, las migraciones, el directorio y el Worker del CORE, en ese orden.
3. Corre la prueba de humo de cada cosa: páginas públicas, `noindex` del cuaderno y una API que rechaza lo inválido; en el CORE, que `/api/core/salud` responde 200 con las celdas activas de `celdas.json`. Las pruebas no escriben eventos ni datos.
4. Si algo falla, se detiene y nombra las celdas que quedaron sin tocar.

## Publicar en producción

Antes de la primera versión en `cultivopro.co`, mira [ambientes-github.md](ambientes-github.md): el ambiente `produccion` tiene que aceptar el tag `v*`, y el dominio no puede estar en el Worker de staging.

1. Confirma que `main` está en verde y que staging se ve bien.
2. En `CHANGELOG.md`, renombra «[Sin publicar]» a la versión con su fecha, y sube la versión en `package.json` de la raíz. Hazlo en un PR.
3. Publica la versión:

   ```bash
   gh release create v0.2.0 --repo laboratoriodigital/plataforma --target main --title "v0.2.0" --notes-from-tag
   ```

4. Mira la corrida «desplegar» en la pestaña Actions. El resumen dice el estado de cada celda.

## Si el despliegue falla

El resumen dice en qué celda se detuvo, qué permiso falta o qué parte del humo falló, y qué celdas quedaron sin tocar.

| Mensaje | Qué hacer |
|---|---|
| «You need to enable Analytics Engine» [code: 10089] | Cloudflare → Workers & Pages → Analytics Engine → crear los datasets `agro_eventos_staging` y `agro_eventos` (los nombres salen de `dataset_eventos` en `celdas.json`). Crear el primero activa Analytics Engine en la cuenta |
| «falta el secreto CF_API_TOKEN en GitHub» | Sembrarlo en Settings → Secrets and variables → Actions |
| «el token … no es válido o está vencido» | Crear un token nuevo con los permisos de ARQUITECTURA §7.5 y reemplazar el secreto |
| «al token le falta «Account → Workers Scripts: Edit»…» | Editar el token en Cloudflare y agregar ese permiso |
| «el token no ve la zona …» | Agregar «Zone → Workers Routes: Edit» para esa zona |
| «CF_API_TOKEN (o CF_METRICAS_TOKEN) tiene un permiso de más: «…»» | Quitar ese permiso del token en Cloudflare, con los pasos de `docs/runbooks/credenciales.md`. El valor no cambia: el secreto de GitHub sigue igual (HU-C11.5) |
| «CF_METRICAS_TOKEN no puede leer las métricas de la cuenta» | Es un aviso: el despliegue sigue y el vigía deja la celda en alerta. Dale «Account → Account Analytics: Read» al token del vigía (`docs/runbooks/vigia-de-cuota.md`) |
| «falta el secreto BOLD_SECRETA_PRUEBAS en GitHub» (o cualquiera de las cuatro de Bold) | Hay una llave de Bold sin su pareja. Siembra las dos del ambiente (identidad y secreta, del panel de Bold › Integraciones › Botón de pagos), o borra la que quedó sola: sin ninguna, pagar en línea dice «no disponible» |
| «falta el secreto GOOGLE_CLIENT_ID y/o GOOGLE_CLIENT_SECRET en GitHub» | Sembrarlos en Settings → Secrets and variables → Actions, con los valores del cliente OAuth «agro-core» de Google Cloud |
| «entrar: Google recibe otro client_id…» o «la dirección de regreso es…» | El secreto de GitHub no es el del cliente «agro-core», o la URL del CORE cambió. Corrige el secreto, o agrega la dirección nueva en Google Cloud → APIs & Services → Credentials → agro-core → Authorized redirect URIs |
| «CORE desplegado en …, pero celdas.json dice …» | La URL de workers.dev del CORE cambió (otra cuenta o subdominio). Corrige `core.url` / `core.url_staging` en `celdas.json` por PR y agrega la dirección de regreso nueva en Google Cloud |
| «al token le falta «Account → D1: Edit»…» | Editar el token en Cloudflare y agregar ese permiso. El valor del token no cambia, así que el secreto de GitHub sigue igual |
| «la base del CORE tiene N fila(s) huérfana(s)…» | Una fila apunta a otra que ya no existe. La guarda de las migraciones la rechazaría (bitácora core 2). Mira la lista del resumen en Cloudflare → D1 → la base → Console, decide si la fila se borra o se arregla, y vuelve a desplegar. No se migra con huérfanas |
| «no se pudo revisar si la base del CORE tiene filas huérfanas» | wrangler no pudo consultar la base: el resumen cita su error. Suele ser el permiso de D1 del token. Sin la revisión no se migra (P1) |
| «el catálogo de la base no es el de productos.json y planes.json» | El SQL del catálogo no se aplicó entero, o alguien editó la base a mano entre los dos pasos. Vuelve a correr el despliegue: reescribe el catálogo. Si la diferencia sigue, es un error del código de `apps/core/src/catalogo.ts` |
| «migraciones del CORE falló» | El resumen cita el error de wrangler. Antes de reintentar, mira en Cloudflare → D1 → la base → Console qué tablas quedaron (no está verificado si wrangler deshace una migración a medias). Corrige la migración con un archivo **nuevo**, nunca editando uno ya aplicado |
| «el CORE (…) no entregó su clave pública…» | La API de la celda se despliega después del CORE. Si el CORE está en otra celda, despliégalo primero; si es la misma, revisa la falla del CORE más arriba en el resumen |
| «API de c0 desplegada en …, pero celdas.json dice …» | Corrige `api` / `api_staging` de esa celda en `celdas.json` por PR y vuelve a desplegar |
| «/api/salud: respondió 503 (Falta …)» o «faltan tablas de la migración» | La configuración o una migración del shard no llegaron. Vuelve a correr el flujo con `solo_celda`; si se repite, cópiame el resumen |
| «/api/core/salud: respondió 503 (sin-celdas…)» | El paso del directorio no corrió o `celdas.json` no tiene celdas activas. Vuelve a correr el flujo con `solo_celda` |
| «la prueba de humo falló» | El Worker quedó desplegado. Revisa la ruta que falló; si es grave, vuelve a la versión anterior (abajo) |

Para seguir después de corregir: Actions → desplegar → «Run workflow», con el mismo destino y `solo_celda` igual a la celda que falló.

**Los productos.** «Run workflow» con `productos` vacío despliega solo el CORE y el agro. Para el parqueadero o la Tienda, escríbelo: `productos` = `parqueadero` (o `core,agro,parqueadero`). Desde la terminal:

```bash
gh workflow run desplegar -f destino=produccion -f productos=parqueadero
```

Una versión publicada a mano en GitHub lleva su producto por la etiqueta: `parqueadero-v…` despliega el parqueadero y `tienda-v…` la Tienda (bitácora parqueadero 41).

Si una celda no debe recibir este reparto: `"estado": "fuera"` en `infrastructure/celdas.json`, por PR.

## Volver a la versión anterior

Actions → desplegar → «Run workflow»:
- en «Use workflow from», elige la etiqueta de la versión anterior (por ejemplo `v0.1.0`);
- destino `produccion`.

Despliega exactamente ese código. Nada se borra: los datos del cuaderno viven en los teléfonos y en D1, no en el Worker.

## Lo que este runbook no cubre todavía

- Despliegue de la API de la celda y migraciones de sus shards (HU-E5.1, ARQUITECTURA §7.4).
- Export de la base del CORE a R2 antes de migrar (§7.4); llega con los respaldos (HU-E8.4). Mientras tanto, la red es Time Travel de D1 (7 días en el plan gratuito).

Kill switches: `docs/runbooks/kill-switch.md`.
