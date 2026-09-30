# Registro de cambios

Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/). Versión semántica única del producto en `package.json` de la raíz (ARQUITECTURA §7.1).

## [Sin publicar]

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
- Plantilla de pull request con «Control negativo» y «¿Cambió algo que un documento afirma?».
