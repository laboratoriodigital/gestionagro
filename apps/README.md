# apps/

Aplicaciones desplegables (ARQUITECTURA §11). Cada una llega con la historia que la construye:

- `sitio/`: Astro, `/herramientas/agro/*`, `/agro/t/` y páginas legales (HU-E1.6).
- `cuaderno/`: PWA Preact en `/agro/app/` (HU-E3.1).
- `api-celda/`: Worker Hono de la celda (HU-E5.1).
- `core/`: Worker CORE v0 (HU-E4.1).
- `ensayo/`: la app del producto de ensayo, solo en staging (HU-C3.7): un Worker solo de assets.
- `cuenta/`: Astro estático en `cuenta.laboratorio-digital.com`, servido por el Worker del CORE (HU-C7.2).
- `parqueadero-sitio/`: el Parqueadero ED1 (HU-Q5.1). Astro estático y, en `/caja/`, la caja: PWA Preact con Dexie y Workbox, compilada con Vite desde `src/caja/` (HU-Q3.1). Un Worker solo de assets, en staging hasta HU-Q5.2.
