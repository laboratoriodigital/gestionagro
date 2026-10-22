# Runbook · La compra de prueba de M1

**Cuándo:** una vez, para dar por aceptado M1 (HU-T5.7, WI-T5.7.2), y otra vez si se rehace la vitrina o el pedido. Se hace en staging, desde el teléfono del dueño.

**Qué ya está probado antes de esto** (`apps/tienda-api/src/aceptacion-m1.test.ts` y la e2e «HU-T5.7 CA2» de `tests/e2e/tienda-vitrina.spec.ts`): los dos comercios se cargan con su archivo `tienda-import/1`, se publican y el despacho los sirve sin preguntarle a la base; el comprador llega de la portada a WhatsApp a 360 px sin fallas de axe. Lo que falta es un teléfono de verdad, con su red y su WhatsApp.

**Los números de WhatsApp de los comercios son de mentira** (+57 300 000 0001 y +57 300 000 0002). WhatsApp se abre con el pedido escrito, pero no se envía.

## Pasos

1. En el teléfono, abre `https://ensayo-uno--staging.mitiendapro.co`. Debe verse «Comercio Ensayo Uno» y «Ropa de lino, hecha despacio.».
2. Abre **Camisa de lino**. Elige **L** y **Azul**: dice que la combinación está agotada y ofrece «Avísame cuando haya». Tócalo una vez; no pide ningún dato.
3. Elige **M** y **Arena** y toca **Agregar al pedido**. Abajo aparece «Tu pedido 1».
4. Toca **Tu pedido**. Está la camisa con su precio, 129.000. Elige **Transferencia**; el botón dice lo que falta hasta que marques la casilla de los términos.
5. Marca la casilla y toca **Enviar por WhatsApp**. Llegas al acuse: el código del pedido, el número, el total, la forma de pago y el envío con su plazo.
6. En el acuse, toca **Enviar por WhatsApp**. WhatsApp se abre con el pedido escrito y el enlace de seguimiento. **No lo envíes.** Copia el enlace de seguimiento y cierra WhatsApp.
7. Abre el enlace de seguimiento en el navegador. Es la misma página del acuse, al día: debajo del código dice «Estado: Recibido: la tienda lo va a confirmar», y abajo la lista de sus pasos con la fecha y la hora (HU-T6.3).
8. Abre `https://ensayo-dos--staging.mitiendapro.co` → **Pan de bono**. Dice que no tiene derecho de retracto por ser un alimento perecedero.
9. En el panel de staging, `https://tienda-panel-staging.laboratoriodigital-la.workers.dev`, entra con tu cuenta de Google, elige **Comercio Ensayo Uno** y luego **Comercio Ensayo Dos**: cada una muestra su estado, tu rol de propietario y su plan.
10. Escribe en el hilo qué pasos pasaron y cuáles no, con una captura de lo que falló.

## Lo que nunca se hace

- Enviar el mensaje de WhatsApp: el número no es de nadie y podría serlo algún día.
- Hacer la compra de prueba en producción: los comercios de prueba no existen allá, y la prueba de humo falla si aparecen (HU-T2.9).
- Usar datos reales en un pedido de prueba: solo los de Ensayo Uno y Ensayo Dos.
