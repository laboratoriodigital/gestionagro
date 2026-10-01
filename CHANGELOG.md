# Registro de cambios

Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/). Versión semántica única del producto en `package.json` de la raíz (ARQUITECTURA §7.1).

## [Sin publicar]

### Corregido
- El resumen del despliegue cita el error de wrangler y, para códigos ya vistos (10089: Analytics Engine sin activar), dice qué hacer; antes decía «ver el registro» (bitácora agro 11).
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
- e2e con Playwright en un teléfono de 360 px (HU-E1.6, parte 2): contenido completo sin JavaScript y un solo `<h1>`, JS < 50 KB con gzip, LCP < 2,5 s con 4G lenta y CPU ×4, WCAG 2.1 AA con axe en modo claro y oscuro, y un solo envío de eventos por sesión. Corre dentro de `verificar` (paso `e2e`); el flujo de Windows lo omite con `--sin-e2e`.
- Calculadora de DPV (HU-E2.2): isla Preact que calcula mientras se escribe, acepta coma o punto, muestra «0,90 kPa», indica el rango por cultivo y etapa desde `packages/agro-calc/catalogos/rangos-dpv.json` (tomate en producción, con fuente), calcula el DPV de hoja y no hace ninguna solicitud al calcular. `agro-calc` agrega `leerNumero`, `formatearKPa` y `clasificarDpv`.
- PWA del cuaderno en `/agro/app/` (HU-E3.1): Vite + Preact + vite-plugin-pwa con service worker propio. Precache del shell (abre sin señal), `/api/*` nunca en caché, manifest instalable con íconos generados por `scripts/generar-iconos.ts`, `noindex`, y aviso de versión nueva que nunca recarga sola: con un formulario abierto o una escritura en curso solo avisa; si no, ofrece «Actualizar ahora».
- Configurar la finca (HU-E3.3): asistente de 3 pasos (finca, áreas, revisar) que arranca vacío; finca y áreas se guardan en una sola transacción; camas y surcos dentro de un área; editar un área sube su versión y guarda la anterior en `historial`. Almacén local v2: tabla `historial` y cola de salida con `entidad_id` y `version` (la migración completa las filas de v1).
- Página útil de la DPV (HU-E2.5): para qué sirve, ejemplo resuelto de tomate (24 °C y 70 %, luego 28 °C y 55 %), cómo se calcula, qué hacer con el resultado y 7 preguntas frecuentes; JSON-LD con migas, FAQPage y HowTo desde `pagina.yaml`. Control de calidad en CI (`scripts/lib/calidad.ts`): secciones obligatorias, ejemplo con números, ≥ 5 preguntas, pasos, fuentes con año, relacionados, ≥ 300 palabras y sin jerga interna. Revisión agronómica pendiente.
- Despliegue por celdas (HU-E1.5): `infrastructure/celdas.json` como única lista; `scripts/generar-wrangler.ts` genera `apps/sitio/wrangler.jsonc` (el Worker solo corre en `/api/*`, sin ids de cuenta); `scripts/armar-despliegue.ts` sube el cuaderno en `/agro/app/`; el build valida con `wrangler deploy --dry-run` los dos entornos. `.github/workflows/desplegar.yml`: staging cuando el CI pasa en `main`, producción al publicar una versión; por cada celda verifica el token nombrando el permiso que falta, despliega, corre la prueba de humo y se detiene nombrando las que quedaron sin tocar. Runbook en `docs/runbooks/despliegue.md`. Guardias de flujos nuevas: el despliegue no se cancela a medias y ninguna entrada se interpola en un comando.
- `packages/ui`: tokens de diseño (contraste, objetivos táctiles de 48 px, fuentes del sistema).
- Contrato `product.yaml`: campo obligatorio `nombre` (nombre corto).
- Plantilla de pull request con «Control negativo» y «¿Cambió algo que un documento afirma?».
