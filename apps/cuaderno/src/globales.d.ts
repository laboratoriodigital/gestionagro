/// <reference types="vite-plugin-pwa/client" />

/** Versión del producto, inyectada por Vite desde package.json de la raíz (ARQUITECTURA §7.1). */
declare const __VERSION_APP__: string;

/** Dónde vive el CORE según el host (infrastructure/celdas.json, HU-E4.2), inyectado por Vite. */
declare const __CORE__: { dominio: string; url: string; url_staging: string };
