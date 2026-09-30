# Registro de cambios

Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/). Versión semántica única del producto en `package.json` de la raíz (ARQUITECTURA §7.1).

## [Sin publicar]

### Añadido
- Monorepo pnpm con TypeScript estricto, Biome y Vitest (HU-E1.1).
- `pnpm verificar`: lint, typecheck, pruebas y build con resumen de todas las fallas.
- Guardias del repositorio: scripts de `package.json` sin shell (P3) y claves de dependencias válidas.
- Regla de Biome que prohíbe comparar `import.meta.url` con cadenas (P3).
