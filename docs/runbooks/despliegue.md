# Runbook · Despliegue

Cómo sale una versión a staging y a producción, y qué hacer si algo falla. La fuente de las celdas es `infrastructure/celdas.json`; el flujo es `.github/workflows/desplegar.yml`; el script, `scripts/desplegar.ts` (HU-E1.5, ARQUITECTURA §7.3).

## Qué se despliega hoy

El Worker del sitio (`agro-sitio`) en la cuenta de la celda c0:
- las calculadoras (`/herramientas/agro/…`);
- el cuaderno (`/agro/app/`);
- `POST /api/eventos`.

La API de la celda llega con HU-E5.1 y entra a este mismo recorrido.

| Destino | Cuándo | Dónde |
|---|---|---|
| Staging | Solo, cada vez que el CI termina en verde en `main` | `https://agro-sitio-staging.<subdominio>.workers.dev` (la URL exacta queda en el resumen de la corrida) |
| Producción | Al publicar una versión en GitHub | `https://agro.laboratorio-digital.com` |

Para cada celda, el flujo hace cuatro cosas:
1. Verifica el token con lecturas y, si falta un permiso, lo nombra.
2. Despliega.
3. Corre la prueba de humo: páginas públicas, `noindex` del cuaderno y una API que rechaza lo inválido. La prueba no escribe eventos.
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
| «la prueba de humo falló» | El Worker quedó desplegado. Revisa la ruta que falló; si es grave, vuelve a la versión anterior (abajo) |

Para seguir después de corregir: Actions → desplegar → «Run workflow», con el mismo destino y `solo_celda` igual a la celda que falló.

Si una celda no debe recibir este reparto: `"estado": "fuera"` en `infrastructure/celdas.json`, por PR.

## Volver a la versión anterior

Actions → desplegar → «Run workflow»:
- en «Use workflow from», elige la etiqueta de la versión anterior (por ejemplo `v0.1.0`);
- destino `produccion`.

Despliega exactamente ese código. Nada se borra: los datos del cuaderno viven en los teléfonos y en D1, no en el Worker.

## Lo que este runbook no cubre todavía

- Kill switches por producto (HU-E8.1).
- Despliegue de la API de la celda y migraciones de D1 (HU-E5.1, ARQUITECTURA §7.4).
