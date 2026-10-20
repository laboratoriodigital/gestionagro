# Runbook · La Tienda en el reporte semanal

**Qué es:** cada lunes, el flujo `reporte-semanal` abre un issue con el reporte del dueño. Desde HU-T14.7 trae una sección **Tienda (producción)** y otra **Tienda (staging)**, solo con conteos:
- las tiendas abiertas, las nuevas y las que tienen su catálogo publicado;
- los pedidos de la semana y los vendidos;
- los cobros en línea reales y los que siguen sin estado final después de 24 horas;
- el pago real: cuántas tiendas pagaron su plan;
- el soporte que anotaste;
- el costo del mes (lo gratis de R2 que se ha usado);
- si los umbrales de `content/tienda/validacion.json` siguen en propuesta.

Ningún nombre, celular, correo, dirección ni código de pedido sale en el reporte.

## Anotar el soporte que le das a un comercio

Cada vez que atiendes a un comercio (una llamada, un chat, una visita), anótalo:
1. GitHub › **Actions** › **anotar-soporte-tienda** › **Run workflow**.
2. Elige el ambiente (casi siempre `produccion`), pega el id de la organización de la tienda, escribe los minutos y elige el tema.
3. Si fue otro día, escribe la fecha (AAAA-MM-DD); si no, déjalo vacío.

Solo se guardan la tienda, el día, los minutos y el tema: no hay campo para notas, a propósito. El reporte suma los minutos de la semana y los compara con el umbral «soporte por comercio».

## Cuadrar ya los eventos de una tienda (HU-T14.6)

El Inicio del panel compara cada semana los pedidos y pagos de la tienda con lo que contó su medición. En producción lo hace la tarea `cuadre-de-eventos`, en el turno de cada tienda. Staging no tiene cron (D-T10), así que ahí se cuadra a mano:
1. GitHub › **Actions** › **cuadrar-tienda** › **Run workflow**.
2. Elige el ambiente y pega el id de la organización.
3. El flujo dice las dos cifras, y el cuadre sale en el Inicio del panel de esa tienda.

Llama a `POST /api/despliegue/cuadre` con el secreto del despacho. La semana es la de los 7 días de Colombia anteriores a hoy: un pedido de hoy cuenta la próxima semana.

## Si algo falla

| Lo que dice | Qué hacer |
|---|---|
| «No hay una tienda … en …» | El id no es de una tienda de ese ambiente. Cópialo de la tienda en el panel o del CORE |
| «La API respondió 503: sin métricas» | Falta `CF_METRICAS_TOKEN` o la cuenta en la API de la Tienda de ese ambiente: el próximo despliegue los carga |
| En el reporte, «Las tiendas: no se pudo leer (D1 respondió …)» | El token `CF_API_TOKEN` del reporte no lee esa base. Revisa sus permisos en `docs/runbooks/credenciales.md` |
| En el reporte, «Costo del mes: no se pudo leer R2» | `CF_METRICAS_TOKEN` necesita «Account Analytics: Read» |
