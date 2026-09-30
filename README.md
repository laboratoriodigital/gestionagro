# Gestión Agro

Calculadoras agronómicas gratuitas y un cuaderno de campo offline-first para fincas bajo invernadero y agroindustria. Línea agrícola de ED1.

- Qué es y por qué está hecho así: [`docs/ARQUITECTURA.md`](docs/ARQUITECTURA.md)
- Qué se construye y cuándo: [`docs/BACKLOG.md`](docs/BACKLOG.md)
- Qué se rompió y qué se aprendió: [`docs/BITACORA.md`](docs/BITACORA.md)
- Qué documento manda sobre qué: [`docs/README.md`](docs/README.md)

## Arranque

Requisitos: Node 22.18 o superior y pnpm 11 (la versión exacta está en `packageManager` de `package.json`).

```bash
npm install -g pnpm@11.28.2
```

```bash
pnpm install
```

```bash
pnpm verificar
```

`pnpm verificar` corre lint, typecheck, pruebas y build de todo el monorepo, **sigue aunque un paso falle** y al final resume todas las fallas juntas. Sin eso en verde, nada se da por terminado (BACKLOG §2.2).

| Comando | Qué hace |
|---|---|
| `pnpm lint` | Biome: formato y reglas (`noShadow`, sin `catch` vacío, sin comparar `import.meta.url` con cadenas) |
| `pnpm format` | Aplica el formato de Biome |
| `pnpm typecheck` | `tsc` estricto (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`) |
| `pnpm test` | Vitest |
| `pnpm test:cobertura` | Vitest con cobertura v8 |
| `pnpm build` | Build de cada paquete que lo tenga |
| `pnpm licencias` | Falla si alguna dependencia es AGPL o no declara licencia |
| `pnpm validar:productos` | Valida todos los `product.yaml` contra `schemas/product.schema.json` |

## Reglas de la casa

- Todo corre igual en Windows y en Linux. Las herramientas del repositorio son Node/TypeScript, nunca `.sh` (ADR-18, P3). Node ejecuta los `.ts` de `scripts/` directamente.
- Una aserción nueva se ve en rojo con su defecto puesto antes de fusionarla (P5).
- Ninguna prueba nombra una finca o una persona real: se usan `Finca Ensayo Uno` y `Finca Ensayo Dos` (P4).
- Estructura de carpetas: ARQUITECTURA §11.
