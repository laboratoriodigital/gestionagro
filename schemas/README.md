# schemas/

`product.schema.json` (HU-E1.3) y `agro-export.schema.json` (HU-E3.13). Una sola fuente por formato (P2).

`agro-export.schema.json` no se edita a mano: se genera desde `packages/agro-schema/src/exportacion.ts` con `node scripts/generar-esquema-export.ts`, y una prueba exige que coincida.
