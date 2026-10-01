# Runbook · Despliegue

Cómo sale una versión a staging y a producción, y qué hacer si algo falla. La fuente de las celdas es `infrastructure/celdas.json`; el flujo es `.github/workflows/desplegar.yml`; el script, `scripts/desplegar.ts` (HU-E1.5, ARQUITECTURA §7.3).

## Qué se despliega hoy

El Worker del sitio (`agro-sitio`) en la cuenta de la celda c0:
- las calculadoras (`/herramientas/agro/…`);
- el cuaderno (`/agro/app/`);
- `POST /api/eventos`.

Y el CORE (HU-E4.1) en la misma cuenta, que es quien dice `core.celda` en `celdas.json`:
- la base D1 `agro_core` (`agro_core_staging` en staging), creada por el despliegue si no existe;
- sus migraciones (`infrastructure/migraciones/core/`);
- la tabla `celda`, copiada de `celdas.json`;
- el Worker `agro-core` en workers.dev, que hoy solo responde `GET /api/core/salud`.

Y la API de cada celda (HU-E5.1), en todas las celdas activas, después del sitio y del CORE:
- una base D1 por shard (`agro_c0_s1`, `agro_c0_s1_staging`), creada si no existe, con sus migraciones (`infrastructure/migraciones/celda/`);
- el Worker `agro-api-<celda>` en workers.dev, con la clave pública del CORE del mismo destino.

| Destino | Cuándo | Dónde |
|---|---|---|
| Staging | Solo, cada vez que el CI termina en verde en `main` | `https://agro-sitio-staging.<subdominio>.workers.dev` (la URL exacta queda en el resumen de la corrida) |
| Producción | Al publicar una versión en GitHub | `https://agro.laboratorio-digital.com` |

El CORE vive en workers.dev en los dos destinos: `https://agro-core-staging.<subdominio>.workers.dev` y `https://agro-core.<subdominio>.workers.dev`. Su dominio se decide con el login (HU-E4.2).

Para cada celda, el flujo hace cuatro cosas:
1. Verifica el token con lecturas y, si falta un permiso, lo nombra.
2. Despliega lo que la celda aloja: el sitio y, si es la celda del CORE, la base, las migraciones, el directorio y el Worker del CORE, en ese orden.
3. Corre la prueba de humo de cada cosa: páginas públicas, `noindex` del cuaderno y una API que rechaza lo inválido; en el CORE, que `/api/core/salud` responde 200 con las celdas activas de `celdas.json`. Las pruebas no escriben eventos ni datos.
4. Si algo falla, se detiene y nombra las celdas que quedaron sin tocar.

## Publicar en producción

1. Confirma que `main` está en verde y que staging se ve bien.
2. En `CHANGELOG.md`, renombra «[Sin publicar]» a la versión con su fecha, y sube la versión en `package.json` de la raíz. Hazlo en un PR.
3. Publica la versión:

   ```bash
   gh release create v0.2.0 --repo laboratoriodigital/gestionagro --target main --title "v0.2.0" --notes-from-tag
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
| «falta el secreto GOOGLE_CLIENT_ID y/o GOOGLE_CLIENT_SECRET en GitHub» | Sembrarlos en Settings → Secrets and variables → Actions, con los valores del cliente OAuth «agro-core» de Google Cloud |
| «entrar: Google recibe otro client_id…» o «la dirección de regreso es…» | El secreto de GitHub no es el del cliente «agro-core», o la URL del CORE cambió. Corrige el secreto, o agrega la dirección nueva en Google Cloud → APIs & Services → Credentials → agro-core → Authorized redirect URIs |
| «CORE desplegado en …, pero celdas.json dice …» | La URL de workers.dev del CORE cambió (otra cuenta o subdominio). Corrige `core.url` / `core.url_staging` en `celdas.json` por PR y agrega la dirección de regreso nueva en Google Cloud |
| «al token le falta «Account → D1: Edit»…» | Editar el token en Cloudflare y agregar ese permiso. El valor del token no cambia, así que el secreto de GitHub sigue igual |
| «migraciones del CORE falló» | El resumen cita el error de wrangler. Antes de reintentar, mira en Cloudflare → D1 → la base → Console qué tablas quedaron (no está verificado si wrangler deshace una migración a medias). Corrige la migración con un archivo **nuevo**, nunca editando uno ya aplicado |
| «el CORE (…) no entregó su clave pública…» | La API de la celda se despliega después del CORE. Si el CORE está en otra celda, despliégalo primero; si es la misma, revisa la falla del CORE más arriba en el resumen |
| «API de c0 desplegada en …, pero celdas.json dice …» | Corrige `api` / `api_staging` de esa celda en `celdas.json` por PR y vuelve a desplegar |
| «/api/salud: respondió 503 (Falta …)» o «faltan tablas de la migración» | La configuración o una migración del shard no llegaron. Vuelve a correr el flujo con `solo_celda`; si se repite, cópiame el resumen |
| «/api/core/salud: respondió 503 (sin-celdas…)» | El paso del directorio no corrió o `celdas.json` no tiene celdas activas. Vuelve a correr el flujo con `solo_celda` |
| «la prueba de humo falló» | El Worker quedó desplegado. Revisa la ruta que falló; si es grave, vuelve a la versión anterior (abajo) |

Para seguir después de corregir: Actions → desplegar → «Run workflow», con el mismo destino y `solo_celda` igual a la celda que falló.

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
