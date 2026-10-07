# sql/ — el modelo de datos propuesto del parqueadero, con su prueba

Migración **propuesta**: no está en `infrastructure/migraciones/`, así que ningún despliegue la aplica. Pasa allí, con su prueba en D1 local (`getPlatformProxy`), en el M1 del parqueadero (`../ARQUITECTURA-PARQUEADERO.md` §18). El MVP (M0) no la necesita: guarda todo en el dispositivo.

| Archivo | Qué es | Documento |
|---|---|---|
| `parqueadero/0001_parqueadero_v1.sql` | El shard de una celda de parqueaderos | `../ARQUITECTURA-PARQUEADERO.md` §10 y anexo A |
| `probar-parqueadero.mjs` | La prueba | Este archivo |

El anexo A de `../ARQUITECTURA-PARQUEADERO.md` es una copia del archivo SQL. Si difieren, manda el archivo.

## Cómo se prueba

Con Node 22.5 o posterior (`node:sqlite`), desde la raíz del repositorio:

```sh
node docs/parking/sql/probar-parqueadero.mjs docs/parking/sql/parqueadero/0001_parqueadero_v1.sql
```

Dice `TODO EN VERDE` o el número de fallas, y sale con código distinto de cero si algo falla. El 6 oct 2026 dio **56 comprobaciones** en verde con Node 22.22. Prueba:

- la forma: `org_id` en toda tabla de datos, ninguna `CASCADE` y solo los cuatro índices justificados;
- dos parqueaderos de prueba con datos distintos (P4);
- el número de recibo: no se repite en un parqueadero, sí entre parqueaderos, y cada dispositivo numera con su serie, aunque ya esté retirado;
- que reenviar un registro no lo duplique, y que un número repetido con otro id **falle** en vez de perderse;
- la salida que llega antes que su entrada, y la estadía que las agrupa;
- las anulaciones: con lo que anulan, del mismo parqueadero, sin borrar el original;
- la inmutabilidad, y la purga que solo pasa después de exportar (P21);
- que un tipo nuevo de registro sea un `INSERT` (R1);
- un lote del push con una operación mala: todo o nada, y después una por una a la cuarentena;
- los catálogos con su historial, el conflicto y la versión que no baja.

Los controles negativos (P5) se corrieron al escribirla: quitar el trigger de inmutabilidad, la guarda de serie, la unicidad del número o el filtro de la purga pone en rojo la comprobación que le corresponde. Cambiar `ON CONFLICT (id) DO NOTHING` por `INSERT OR IGNORE` pone en rojo cinco: `OR IGNORE` también se salta en silencio las violaciones de `CHECK` y de unicidad (ver §20 del documento).

## Lo que este instrumento no imita (P17)

- **No es D1.** Es el SQLite de Node.
- **Un lote se simula** con `BEGIN … COMMIT` y `ROLLBACK`, que es lo que hace un `batch` de D1. No se simulan los límites de consultas por invocación ni de filas escritas.
- **No hay concurrencia real:** D1 aplica las escrituras de una base de a una, y la prueba corre los lotes en orden.
