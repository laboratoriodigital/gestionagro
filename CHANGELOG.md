# Registro de cambios

Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/). Versión semántica única del producto en `package.json` de la raíz (ARQUITECTURA §7.1).

## [Sin publicar]

### Corregido
- `pnpm licencias` revisaba solo la raíz del monorepo; ahora recorre el workspace y falla si una dependencia declarada no aparece en el listado (bitácora agro 6).

### Añadido
- Monorepo pnpm con TypeScript estricto, Biome y Vitest (HU-E1.1).
- `pnpm verificar`: lint, typecheck, pruebas y build con resumen de todas las fallas.
- Guardias del repositorio: scripts de `package.json` sin shell (P3) y claves de dependencias válidas.
- Regla de Biome que prohíbe comparar `import.meta.url` con cadenas (P3).
- Contrato `product.yaml`: `schemas/product.schema.json` con la extensión agro, validador con mensajes en español (`pnpm validar:productos`, también dentro de `verificar`) y los contratos de la DPV y del cuaderno (HU-E1.3).
- Fincas de prueba `Finca Ensayo Uno` y `Finca Ensayo Dos` en `tests/fixtures/`, y guardia de términos prohibidos sobre apps/, packages/, content/, schemas/, infrastructure/, scripts/ y tests/ (HU-E1.7).
- CI en GitHub Actions (HU-E1.2): `ci.yml` corre `node scripts/verificar.ts --ci` (instalación desde cero con lockfile congelado, lint, typecheck, contratos, pruebas, build y licencias) y deja en el resumen de la corrida cada paso con ✅, ❌ u omitido, y la salida de cada falla. Cancela la corrida vieja de la rama; ningún trabajo pasa de 15 min.
- `scripts-windows.yml`: la misma verificación en `windows-latest` cuando cambian `scripts/` o las dependencias, y los lunes.
- `pnpm licencias`: falla con el nombre del paquete si una dependencia es AGPL o no declara licencia.
- Guardias de flujos: `| tee` exige `set -o pipefail`, todo secreto usado está en ARQUITECTURA §7.5, `timeout-minutes` ≤ 15 y cancelación por rama. Ninguna prueba espera por tiempo (P19).
- `packages/agro-calc`: `presionSaturacionKPa`, `dpvAireKPa` y `dpvHojaKPa` (FAO-56 ec. 11) con la tabla de casos `casos/dpv.json` que compartirá el firmware; un valor ilegible o fuera de rango lanza `ErrorDeMedida` con el campo, nunca 0 ni NaN (HU-E2.1).
- `packages/agro-schema` (HU-E3.2): esquemas zod v1 de finca, área, ciclo, persona, insumo y registro base, más `clima` v1; ningún campo de medida tiene `default` y el error nombra el campo. UUIDv7 y fecha agronómica con reloj inyectable (P8).
- `apps/cuaderno`: almacén local con Dexie; guardar un registro y su operación de salida es una sola transacción; se pide `navigator.storage.persist()` y se guarda la respuesta. Prueba de migración desde cada versión local anterior con las dos fincas de prueba.
- `apps/sitio` (HU-E1.6, parte 1): Astro estático en `agro.laboratorio-digital.com`. Cada herramienta se genera desde su `product.yaml` y su contenido en `content/agro/`: título, descripción, canonical, Open Graph, migas con JSON-LD, sitemap y robots. Un borrador lleva `noindex` y no entra al sitemap.
- `packages/eventos`: los eventos de una sesión salen en un solo `sendBeacon`; `POST /api/eventos` en el Worker del sitio escribe un punto de Analytics Engine por lote y solo acepta productos que declaran eventos.
- `packages/ui`: tokens de diseño (contraste, objetivos táctiles de 48 px, fuentes del sistema).
- Contrato `product.yaml`: campo obligatorio `nombre` (nombre corto).
- Plantilla de pull request con «Control negativo» y «¿Cambió algo que un documento afirma?».
