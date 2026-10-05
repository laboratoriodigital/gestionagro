# sql/ — el modelo de datos propuesto del CORE, con su prueba

Migraciones **propuestas**: no están en `infrastructure/migraciones/`, así que ningún despliegue las aplica. Cada una pasa allí, con su prueba en D1 local (`getPlatformProxy`), en el pull request que implementa su fase (`../PLATAFORMA.md` §7). Las de la Tienda 3.0 están en `../../tienda/sql/`.

| Archivo | Qué es | Documento |
|---|---|---|
| `core/0006_dimension_de_producto.sql` | El producto en todo el CORE: tablas de referencia (productos, tipos, roles, planes, periodos y precios), claves foráneas compuestas, sesión por producto | `../PLATAFORMA.md` §4.3 |
| `core/0007_entrar_con_correo.sql` | Proveedor de identidad como referencia y enlace mágico por correo | `../PLATAFORMA.md` §4.5, §4.11 |
| `core/0008_auditoria.sql` | Lo que toca seguridad o dinero, una fila por hecho | `../PLATAFORMA.md` §4.12 |
| `core/0009_oauth_para_agentes.sql` | Servidor de autorización OAuth 2.1 para MCP, sin alcances que muevan dinero | `../PLATAFORMA.md` §5.4 |
| `probar-core.mjs` | La prueba | Este archivo |

## Cómo se prueba

Con Node 22.5 o posterior (`node:sqlite`), desde la raíz del repositorio:

```sh
node docs/plataforma/sql/probar-core.mjs infrastructure/migraciones/core docs/plataforma/sql/core
```

Dice `TODO EN VERDE` o el número de fallas, y sale con código distinto de cero si algo falla. El 5 oct 2026 dio **35 comprobaciones** en verde:

- aplica las migraciones reales 0001–0005 del CORE y siembra datos como los escribe el código de hoy;
- aplica 0006–0009 y comprueba filas, claves foráneas, la compatibilidad con el código v0 y los cruces inválidos entre productos;
- comprueba los cuatro periodos (1, 3, 6 y 12 meses) y que uno nuevo entre con dos `INSERT`, sin rehacer tablas;
- rechaza un alcance para agentes que mueve dinero y un proveedor de identidad desconocido;
- **prueba la guarda con datos reales:** un pago viejo de 2 meses detiene la 0006 entera y deja la base como estaba.

## Lo que este instrumento no imita (P17)

- **No es D1.** Es el SQLite de Node (3.50.4). En particular, falta comprobar en D1 que acepte `pragma_foreign_key_check` como función de tabla y que apagar `defer_foreign_keys` ponga el contador en cero igual (`../PLATAFORMA.md` §4.4).
- **Una migración se simula** con `BEGIN … COMMIT` y `ROLLBACK` si algo falla, que es lo que hace `wrangler` con cada archivo. No se simulan los límites de consultas por invocación ni de filas escritas.
