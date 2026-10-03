# Cobrar el plan en línea con Bold (HU-E0.7)

El propietario de una finca paga un mes del plan Finca desde **Planes**, con PSE, Nequi o tarjeta, en la página de Bold. El CORE calcula el monto, firma el cobro, le pregunta a Bold si se pagó y activa el plan por 30 días. Si la persona no vuelve a la pantalla, la conciliación (cada 15 min) lo activa igual.

## Qué se tomó de la Tienda y qué no

La Tienda ya cobra con Bold (su `docs/PAGOS-BOLD.md`). Su modelo resolvía una venta con existencias en Apps Script; aquí se cobra un plan desde un Worker. Se validó pieza por pieza (3 oct 2026):

| De la Tienda | Aquí | Por qué |
|---|---|---|
| El servidor calcula el monto y firma el cobro (SHA-256 de orden + monto + COP + secreta) | **Igual** | La página no decide cuánto se cobra |
| La vuelta de Bold no se cree: se le pregunta a su API (`payment-voucher`) | **Igual** | Cualquiera puede escribir la dirección de vuelta |
| Aprobado por otro monto → «revisar», no es venta | **Igual** | |
| Llaves de pruebas y de producción separadas | **Igual**: staging usa las de pruebas; producción, las reales | |
| Un cobro sin noticias en 24 h queda vencido | **Igual** | Bold deja de responder por él |
| Disparador cada 5 min mientras haya cobros abiertos | **Cron Trigger cada 15 min**, que lee una fila si no hay ninguno | Un plan no compite por la última unidad: 15 min bastan y gastan menos |
| Apartar existencias 15 min, datos de entrega, candado de Apps Script | **No aplica** | Un plan no tiene existencias ni entrega |
| Llaves por tienda (cada comercio cobra a sus clientes) | **Una cuenta de Bold del ecosistema**, en el CORE | Aquí quien vende es Laboratorio Digital |
| Sin aviso de Bold (webhook): Apps Script no ve las cabeceras | **Sin webhook por ahora**, aunque el Worker sí podría verificarlo | La consulta autenticada ya dice la verdad y Bold no manda avisos en pruebas. Se agrega cuando se lea su documentación de la firma (P9) |
| Bold amarrado al código | **Adaptador** `ProveedorDePago` (ED1 §5.3) | Cambiar de pasarela es escribir otro adaptador |
| — | El pago dice su **producto** (`agro`) y su **proveedor** (`bold`) | El CORE es el del ecosistema (ARQUITECTURA §14, HA3) |

## Activarlo

1. En el panel de Bold: *Integraciones › Botón de pagos*. Copia la **llave de identidad** y la **llave secreta** del ambiente de pruebas.
2. En GitHub › Settings › Secrets and variables › Actions, crea `BOLD_IDENTIDAD_PRUEBAS` y `BOLD_SECRETA_PRUEBAS`.
3. El próximo despliegue a staging las carga en el CORE. Sin ellas, «Pagar» responde que no está disponible.

## Probarlo en staging, antes de cobrar de verdad

1. Entra al cuaderno de staging como propietario de una finca en la nube y abre **Planes**.
2. «Pagar un mes · COP 39.000». La página de Bold dice **Modo de pruebas**.
3. **Aprobado:** tarjeta VISA `4111111111111111` (o PSE › *BANCO QUE APRUEBA*). Al volver: «¡Pago confirmado! Tu plan está activo hasta el …». En Cuenta: «Plan de esta finca: Finca hasta el …».
4. **Rechazado:** tarjeta `4970110000000062` (o *BANCO QUE RECHAZA*). Dice que no se cobró nada, y el plan no cambia.
5. **No volver:** paga y cierra la pestaña antes de volver. En 15 min o menos, el plan queda activo (la conciliación). Se ve al abrir Cuenta.
6. **Recargar** la pantalla de vuelta, o tocar «Verificar ahora» varias veces: no suma otro mes.

Solo después: `BOLD_IDENTIDAD_PRODUCCION` y `BOLD_SECRETA_PRODUCCION` en GitHub, publicar la versión y hacer un pago real de valor bajo.

## Lo que no hace todavía

- **Factura electrónica (DIAN):** el pago no la emite. Mientras tanto, se factura a mano con el comprobante de Bold. Hay que decidirlo con el contador antes del primer cobro real (ED1 §5.3).
- **Débito automático:** no hay. Se paga mes a mes. Una semana antes del vencimiento, Planes lo avisa; al vencer, la finca vuelve al plan Gratis sin perder nada.
- **Cambiar el precio:** `cobro_mensual_cop` del plan en `content/agro/cuaderno/planes.json`. Lo fija el dueño, dentro del rango que muestra el plan. Hoy es 39.000.
