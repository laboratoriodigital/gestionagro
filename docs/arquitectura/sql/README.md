# sql/ — el modelo de datos propuesto, con su prueba

Migraciones **propuestas**: no están en `infrastructure/migraciones/`, así que ningún despliegue las aplica. Cada una pasa allí, con su prueba en D1 local (`getPlatformProxy`), en el pull request que implementa su fase (`PLATAFORMA.md` §7, `TIENDA-3.0.md` §19).

| Carpeta | Qué es | Documento |
|---|---|---|
| `core/` | 0006 (dimensión de producto), 0007 (entrar con correo), 0008 (auditoría), 0009 (OAuth para agentes) | `PLATAFORMA.md` §4 |
| `tienda/` | 0001: el shard de una celda de tiendas | `TIENDA-3.0.md` §5 y anexo A |
| `tienda-control/` | 0001: nombres cortos y hostnames, únicos en todo el producto | `TIENDA-3.0.md` §5 y anexo B |

## Cómo se prueban

Con Node 22.5 o posterior (`node:sqlite`), desde la raíz del repositorio:

```sh
node docs/arquitectura/sql/probar-core.mjs infrastructure/migraciones/core docs/arquitectura/sql/core
node docs/arquitectura/sql/probar-tienda.mjs docs/arquitectura/sql/tienda/0001_tienda_v1.sql docs/arquitectura/sql/tienda-control/0001_control_v1.sql
```

Cada script dice `TODO EN VERDE` o el número de fallas, y sale con código distinto de cero si algo falla. El 5 oct 2026 dieron:

- `probar-core.mjs`: 29 comprobaciones. Aplica las migraciones reales 0001–0005 del CORE, siembra datos como los escribe el código de hoy, aplica 0006–0009 y comprueba filas, claves foráneas, la compatibilidad con el código v0 y los cruces inválidos entre productos.
- `probar-tienda.mjs`: 51 comprobaciones. Prueba la última unidad entre dos compradores, el vencimiento de un apartado, el pago tardío, las transiciones de pedido y de cobro, el historial y el libro de inventario, la aceptación de los términos, el radicado y los negativos de integridad.

## Lo que este instrumento no imita (P17)

- **No es D1.** Es el SQLite de Node (3.50.4). En particular, falta comprobar en D1 que acepte `pragma_foreign_key_check` como función de tabla y que apagar `defer_foreign_keys` ponga el contador en cero igual (`PLATAFORMA.md` §4.4).
- **Un lote se simula** con `BEGIN … COMMIT` y `ROLLBACK` si algo falla, que es lo que hace un `batch` de D1. No se simulan los límites de consultas por invocación ni de filas escritas.
- **No hay concurrencia real:** D1 aplica las escrituras de una base de a una, y la prueba corre los lotes en orden. La carrera por la última unidad se prueba con ese orden, que es el que impone D1.
