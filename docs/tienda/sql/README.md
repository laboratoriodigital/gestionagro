# sql/ — el modelo de datos propuesto de la Tienda 3.0, con su prueba

Migraciones **propuestas**: no están en `infrastructure/migraciones/`, así que ningún despliegue las aplica. Pasan allí, con su prueba en D1 local (`getPlatformProxy`), en el M0 de la Tienda (`../TIENDA-3.0.md` §19). Las del CORE están en `../../plataforma/sql/`.

| Carpeta | Qué es | Documento |
|---|---|---|
| `tienda/` | 0001: el shard de una celda de tiendas | `../TIENDA-3.0.md` §5 y anexo A |
| `tienda-control/` | 0001: nombres cortos, reservados y hostnames, únicos en todo el producto | `../TIENDA-3.0.md` §4, §5 y anexo B |
| `probar-tienda.mjs` | La prueba | Este archivo |

Los anexos A y B de `../TIENDA-3.0.md` son copias de estos archivos. Si difieren, mandan los archivos.

## Cómo se prueba

Con Node 22.5 o posterior (`node:sqlite`), desde la raíz del repositorio:

```sh
node docs/tienda/sql/probar-tienda.mjs docs/tienda/sql/tienda/0001_tienda_v1.sql docs/tienda/sql/tienda-control/0001_control_v1.sql
```

Dice `TODO EN VERDE` o el número de fallas, y sale con código distinto de cero si algo falla. El 5 oct 2026 dio **82 comprobaciones** en verde. Prueba:

- la última unidad entre dos compradores, el vencimiento de un apartado, el pago tardío y el rechazo;
- el link de pago de un pedido que llegó por el chat, y que ese pedido no figura pagado sin Bold;
- la contraentrega de punta a punta: confirmar, despachar con guía, recaudar al entregar, liquidar, y devolver con la unidad de regreso y el flete de vuelta en el margen;
- las transiciones de pedido, de cobro y de recaudo, el historial y el libro de inventario;
- que lo que crece entra con un `INSERT` (el facturador de un comercio, un canal de punto de venta);
- la aceptación de los términos, el radicado y los negativos de integridad;
- en la base de control: los nombres reservados en los dos sentidos y que ningún nombre lleve `--`.

## Lo que este instrumento no imita (P17)

- **No es D1.** Es el SQLite de Node (3.50.4).
- **Un lote se simula** con `BEGIN … COMMIT` y `ROLLBACK` si algo falla, que es lo que hace un `batch` de D1. No se simulan los límites de consultas por invocación ni de filas escritas.
- **No hay concurrencia real:** D1 aplica las escrituras de una base de a una, y la prueba corre los lotes en orden. La carrera por la última unidad se prueba con ese orden, que es el que impone D1.
