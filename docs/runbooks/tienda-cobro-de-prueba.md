# El cobro de prueba de una tienda (HU-T11.3)

**Para qué:** dejar una tienda lista para cobrar en línea con Bold. Primero cobra en el ambiente de pruebas de Bold, donde nadie paga de verdad. Cuando un pago de prueba se aprueba y el aviso de Bold llega, la tienda puede pasar a cobrar de verdad. La API no deja pasar sin eso.

Lo hace quien administra la tienda, desde el panel: **Más › Cobro en línea**. En staging, el dueño lo hace con Ensayo Uno y las llaves de pruebas que tiene (WI-T11.2.3 y WI-T11.3.3).

## Antes de empezar

- Los términos del servicio aceptados (Más › Términos del servicio).
- Las llaves de **pruebas** de la cuenta de Bold del comercio. Nunca se mandan por chat ni se guardan en un archivo: se pegan directo en el panel.

## Pasos

1. **Autorizar que se guarden las llaves.** En Más › Cobro en línea, lee la cláusula, marca la casilla y toca «Autorizar».
2. **Pegar las llaves de pruebas.** Elige «Pruebas», pega la de identidad y la secreta, y toca «Guardar y comprobar con Bold». Pide haber entrado hace menos de 10 minutos. Si Bold no reconoce la de identidad, lo dice y no guarda nada.
3. **La dirección de los avisos.** Copia la que muestra el paso 2 de «El cobro de prueba» y pégala en la cuenta de Bold, en la configuración de los avisos de pago (webhooks). Es la del subdominio de la tienda, por ejemplo `https://ensayo-uno--staging.laboratorio-digital.app/api/v1/avisos/bold`.
4. **Recibir pagos en línea.** En Ajustes › Venta, elige «En línea» o «Ambos» y publica la tienda. Mientras cobre en pruebas, cada página de la tienda lo dice en una franja arriba.
5. **El pago de prueba.** Abre la tienda, agrega algo al carrito y paga «En línea» con uno de los medios de prueba que da Bold. No cobra de verdad.
6. **Ver cómo va.** De vuelta en Más › Cobro en línea, toca «Ver cómo va»:
   - «Bold aprobó tu cobro de prueba y avisó…»: listo, la llave secreta y los avisos funcionan.
   - «Se aprobó, pero el aviso de Bold no llegó»: la dirección del paso 3 está mal o no se guardó en Bold. Corrígela y haz otro pago de prueba.
   - «Quedó rechazado»: inténtalo otra vez.

## Pasar a cobrar de verdad

1. Pega las llaves de **producción** (el mismo formulario, eligiendo «Producción»).
2. Toca «Pasar a cobrar de verdad». Sin el cobro de prueba aprobado o sin las llaves de producción, la API lo niega y dice por qué.
3. **Publica la tienda.** El cobro sigue en el ambiente de la versión publicada: hasta publicar, la tienda sigue en pruebas, con su franja. Así la franja y el cobro nunca se contradicen, y «Volver a esta» vuelve también al ambiente de esa versión.

Para volver a pruebas: «Volver a pruebas» y publicar.

## Si algo falla

- **Bold no reconoce la llave:** se copió incompleta o es de otro ambiente. Pega las dos otra vez.
- **El pago se aprobó y el aviso nunca llega:** la dirección de los avisos en Bold (paso 3). `docs/runbooks/tienda-avisos-de-bold.md` explica cómo se verifican.
- **La tienda no publica con el pago en línea:** la compuerta dice qué falta, en Más › Publicar y versiones.
