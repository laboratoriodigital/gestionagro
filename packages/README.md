# packages/

Paquetes compartidos (ARQUITECTURA §11): `agro-calc` (HU-E2.1), `agro-schema` (HU-E3.2), `sync`, `ui`, `eventos` (HU-E1.6), `kill-switch` (HU-E8.1), `tokens` (firmar y verificar los access del CORE, HU-E4.2), `ids` (UUIDv7, neutro), `productos` (los productos del CORE y sus reglas, HU-C1.1) y `d1` (lo que el CORE y las celdas usan de D1, y su D1 local de pruebas).

De la Tienda 3.0 (`docs/tienda/BACKLOG_TIENDA3.md`), puros y sin nada que cambie entre runtimes (`tests/repo/tienda-paquetes-puros.test.ts`): `dinero` (pesos enteros, el total y su reparto, HU-T1.1) y `calendario` (días hábiles de Colombia con sus festivos y la fecha de Bogotá, HU-T1.2; neutro: también es del CORE, HU-C7.7) y `cifrado` (cifrado de sobre, campos atados a su fila, índice ciego y rotación de la llave maestra, solo con WebCrypto, HU-T1.3).

Sus funciones tienen casos reales resueltos (DoD 2).
