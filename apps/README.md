# apps/

Aplicaciones desplegables (ARQUITECTURA §11). Cada una llega con la historia que la construye:

- `sitio/`: Astro, `/herramientas/agro/*`, `/agro/t/` y páginas legales (HU-E1.6).
- `cuaderno/`: PWA Preact en `/agro/app/` (HU-E3.1).
- `api-celda/`: Worker Hono de la celda (HU-E5.1).
- `core/`: Worker CORE v0 (HU-E4.1).
- `ensayo/`: la app del producto de ensayo, solo en staging (HU-C3.7): un Worker solo de assets.
- `cuenta/`: Astro estático en `cuenta.laboratorio-digital.com`, servido por el Worker del CORE (HU-C7.2).
- `parqueadero-sitio/`: el Parqueadero ED1 (HU-Q5.1). Astro estático y, en `/caja/`, la caja: PWA Preact con Dexie y Workbox, compilada con Vite desde `src/caja/` (HU-Q3.1). Ajustes, entrada y recibo (HU-Q3.2, HU-Q3.3) van en `vistas.tsx`, un trozo que se carga al primer toque: lo que pinta el inicio no importa zod (bitácora parqueadero 14). Un Worker solo de assets, en staging hasta HU-Q5.2.
- `tienda-api/`, `tienda-sitio/` y `tienda-panel/`: la Tienda 3.0 (HU-T2.4, TIENDA-3.0 §3.1). La API (Hono) no tiene rutas ni workers.dev: solo se llega a ella desde el despacho y el panel, con el secreto que comparten. El despacho resuelve la tienda por el `Host` en el KV `TIENDA_HOSTS`, sin tocar la base. El panel es solo assets y su Worker corre únicamente en `/api/*`. Sus configuraciones salen de `celdas.json` (`scripts/generar-wrangler.ts`).
- `tiendapro-sitio/`: la landing de TiendaPro en `tiendapro.co` (HU-T18.5, D-T15). Astro estático, un Worker solo de assets; sus planes salen de `content/tienda/planes.json` y `funciones.json`. «Crear tienda» lleva al panel del ambiente, que pone `scripts/armar-tiendapro.ts` (staging) o el despliegue (producción). Se despliega con la Tienda.
