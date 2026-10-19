# Runbook · Agregar un shard a la celda de la Tienda

**Cuándo:** antes de que el shard que hay se acerque a sus límites (TIENDA-3.0 §3.2, ARQUITECTURA §5.4):
- su base pasa de 5 GB (el tope de una base D1 es 10 GB);
- o sus lecturas diarias se acercan a lo que el vigía de cuota marca para la Tienda.

Un shard nuevo no mueve a ninguna tienda: las que existen se quedan donde están. Solo las tiendas nuevas pueden nacer allí.

## Antes: cuenta las bases de la cuenta

El plan gratuito de Cloudflare admite **10 bases D1 por cuenta**, sumando las de staging. Cada shard nuevo son dos: `tienda_c1_s2` y `tienda_c1_s2_staging`. Míralas en **Storage & Databases › D1**. Si no caben, es el momento de Workers Paid: la decisión del dueño (19 oct 2026) es activarlo al terminar la Tienda.

## Pasos

1. En `infrastructure/celdas.json`, en la celda de la Tienda, agrega el nombre del shard nuevo a `shards`:

   ```json
   "shards": ["tienda_c1_s1", "tienda_c1_s2"],
   ```

   El nombre sigue el patrón `tienda_c<celda>_s<n>`: la API solo reconoce como shard un binding con ese nombre.
2. Regenera las configuraciones de Wrangler y revisa el cambio:

   ```bash
   node scripts/generar-wrangler.ts
   ```

   La API de la celda tiene ahora un binding D1 más, con las migraciones del shard.
3. Fusiona el PR. El despliegue:
   - crea la base del shard en cada ambiente (`asegurarBaseD1`) y le aplica todas las migraciones de `infrastructure/migraciones/tienda`;
   - el CORE copia la lista de shards de `celdas.json`, y desde entonces cada organización nueva de la Tienda nace en el shard con menos organizaciones (`apps/core/src/asignacion.ts`).
4. Revisa la salud: `https://panel.laboratorio-digital.app/api/salud` tiene que decir `"shards": 2` y `"estado": "ok"`.
5. Las tareas del cron (purgas, respaldos, conciliación, dominios) recorren todos los shards solas: no hay nada que cambiar en ellas.

## Lo que no se hace

- **Mover una tienda de shard.** Hoy no hay herramienta. Una tienda vive en el shard donde nació, y su token del CORE lo dice.
- **Quitar un shard** de la lista mientras tenga tiendas: el CORE seguiría mandando a sus organizaciones a un shard que la API ya no conoce (`apps/core/src/celdas.ts`).
