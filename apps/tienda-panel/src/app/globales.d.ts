/// <reference types="vite-plugin-pwa/client" />

/** La versión de la Tienda (`apps/tienda-api/package.json`), inyectada por Vite. */
declare const __VERSION_PANEL__: string;

/** El dominio del panel de producción y los dos CORE (`infrastructure/celdas.json`), por Vite. */
declare const __CORE_DEL_PANEL__: { panel: string; url: string; url_staging: string };
