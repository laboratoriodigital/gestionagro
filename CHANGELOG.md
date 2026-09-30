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
