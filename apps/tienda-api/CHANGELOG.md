# Registro de cambios de la Tienda 3.0

Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/). Versión semántica propia de la Tienda en `apps/tienda-api/package.json`, con etiquetas `tienda-vX.Y.Z` (HU-T0.2, PLATAFORMA §6.3). En `0.0.0` no se publica: vive en staging hasta que la `0.1.0` la lleve a producción sin tiendas (HU-T2.9). Lo de la Tienda anterior a este archivo está en el CHANGELOG de la raíz (versión 0.5.0 de CultivoPro).

## [Sin publicar]

### Agregado
- Los kill switches de la Tienda funcionan (HU-T2.7): con `ks:tienda` apagado, toda tienda muestra «Volvemos pronto» y el panel queda en solo lectura; con `ks:tienda:<org>`, solo esa tienda queda en pausa. Al agotar su presupuesto, el vigía apagaría el horno y el MCP, nunca la venta; en el plan gratuito solo avisa, y ya cuenta las filas de la base de control como de la Tienda.
- La versión propia de la Tienda (HU-T0.2): este registro, las etiquetas `tienda-vX.Y.Z` y su paso de publicación. Un PR que cambia la Tienda sin anotarlo aquí no pasa el CI.
- `node scripts/tienda/generar-secretos.ts --ambiente staging|produccion` (HU-T2.5): genera una vez la llave maestra de la Tienda y el secreto del despacho, y los guarda en el ambiente de GitHub. La llave maestra va al portapapeles, nunca a la pantalla, y no se guarda sin la copia en el gestor de contraseñas. Runbook: `docs/runbooks/secretos-de-la-tienda.md`.
- Las tres apps de la Tienda en staging (HU-T2.4): la API, que solo responde al despacho y al panel; el despacho, que resuelve la tienda por la dirección sin tocar la base y muestra «Esta dirección no tiene tienda» cuando no la hay; y el panel, por ahora con su portada. El despliegue tiene un paso propio para la Tienda, que no detiene a los demás productos mientras no tenga tiendas.
- Las migraciones de la Tienda pasan a `infrastructure/migraciones/` (HU-T2.1), con sus 82 comprobaciones como pruebas en la base en proceso y en el D1 local de workerd. Los anexos de TIENDA-3.0 tienen que ser copias exactas de esos archivos.
- La celda c1 de la Tienda en `celdas.json` (HU-T2.3), con su shard y su base de control, y las configuraciones de sus tres Workers (API, despacho y panel) generadas desde ese archivo. La API no tiene rutas propias: solo se llega a ella desde el despacho y el panel.
- La Tienda 3.0 en el registro de productos, pausada (HU-T2.2): sus tipos, roles, planes como hipótesis (`content/tienda/planes.json`), lo que permite cada plan (`funciones.json`) y la política de sus cuentas en borrador. El CORE la conoce, pero no crea tiendas ni cobra planes hasta que exista su panel.
