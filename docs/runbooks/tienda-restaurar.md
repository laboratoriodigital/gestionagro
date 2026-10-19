# Restaurar una tienda (HU-T17.4)

**Para qué:** recuperar una tienda cuyos datos se dañaron o se perdieron, desde su respaldo semanal (HU-T17.3), sin pisar lo que la tienda ya tiene. Y probar, antes de cargar la primera tienda real, que se puede (el simulacro).

## Lo que hay que saber antes

- **Los respaldos** están en el almacén R2 de la celda: `respaldos/<org>/<AAAA-MM-DD>.json`. Se guardan las 4 últimas semanas y el primero de cada uno de los 3 últimos meses. Los hace la tarea semanal del cron, que solo corre en producción.
- **Solo sirven los de la versión 2** (`"formato": "tienda-respaldo/2"`, desde el 19 oct 2026). Los de la versión 1 llevaban el catálogo con otros ids y los pedidos quedaban sin su combinación (bitácora tienda3 32): el script los rechaza.
- **Restaurar une lo que falta y nunca reemplaza el presente.** Cada fila entra solo si no está. Un pedido que llegó después del respaldo, o un producto que se cambió, se quedan como están.
- **Lo que no vuelve:** las llaves de Bold de la tienda (nunca viajan en el respaldo; el comercio las pega otra vez en Más › Cobro en línea), las operaciones del panel y las importaciones. Los datos personales vuelven en sus sobres cifrados y se abren con la KEK de siempre (`TIENDA_KEK_V1`), que no viaja en el respaldo: sin ella no se abren.
- El archivo del respaldo no trae datos personales en claro, pero sí los datos de la tienda. Se guarda fuera del repositorio y se borra al terminar.

## El simulacro, en staging

Lo corre el dueño, una vez antes de la primera tienda real, y cada vez que cambie el esquema de la base.

1. En GitHub: **Actions › simulacro-restauracion-tienda › Run workflow**, sobre `main`.
2. El flujo lee a Comercio Ensayo Uno de la base de staging, crea una base vacía `tienda-simulacro-<fecha>`, le aplica las migraciones, restaura y compara tabla por tabla. Al final borra su base.
3. **Bien:** cada tabla con ✅ y al final «La tienda volvió igual, tabla por tabla.».
4. **Mal:** la tabla con ❌ es la que no volvió igual. Se anota en la bitácora de la Tienda antes de cargar datos de terceros.
5. Si se canceló a mitad, la base `tienda-simulacro-…` puede quedar: se borra en Cloudflare, en **Storage & Databases › D1**. Nunca se borra la del shard (`tienda_c1_s1_staging`).

Con Ensayo Uno lleno lee unas 40.000 filas y escribe unas 20.000, del día de D1 de toda la cuenta (5 millones de lecturas y 100.000 escrituras): se corre de día, una vez, no en un ciclo.

## Restaurar de verdad

1. **Bajar el respaldo.** En Cloudflare, en el almacén R2 de la celda (`tienda-c1` en producción), carpeta `respaldos/<org>/`, el archivo del día anterior al daño. Se guarda en una carpeta fuera del repositorio.
2. **Armar el SQL**, desde la carpeta del repositorio:

   ```bash
   node scripts/tienda/restaurar.ts <respaldo.json> --sql <carpeta>/restaurar.sql
   ```

   Dice cuántas filas trae cada tabla y deja al lado `restaurar.contar.sql`.
3. **Aplicarlo** a la base del shard de la tienda (la de producción es `tienda_c1_s1`), con un token que tenga «D1: Edit»:

   ```bash
   pnpm --filter @ed1/tienda-api exec wrangler d1 execute tienda_c1_s1 --remote --file <carpeta>/restaurar.sql
   ```

   Si se corta, se corre otra vez: lo que ya entró no se repite.
4. **Contar** con `restaurar.contar.sql` y comparar con lo que dijo el paso 2.
5. **Publicar** la tienda desde su panel (o «Volver a esta» a su última versión) para que las direcciones apunten bien.
6. Avisar al comercio que pegue otra vez sus llaves de Bold, y borrar el respaldo y el SQL de la carpeta.
