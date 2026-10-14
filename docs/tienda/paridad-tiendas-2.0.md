# Qué usa hoy cada tienda 2.0 (HU-T12.1)

**Estado:** cerrada el 13 oct 2026. **Ninguna tienda 2.0 se migra a la 3.0** (decisión del dueño): esta hoja ya no es la lista de lo que hay que tener antes de cargarlas, sino la **referencia** de lo que ya funciona en la 2.0. Lo que la 3.0 toma de aquí se puede cambiar, mejorar o quitar (bitácora tienda3 9). **Nada de su apariencia pasa a la 3.0**: ni colores, ni tipografía, ni plantillas (pedido del dueño del 13 oct 2026; el diseño es el de BACKLOG_TIENDA3 §5).

**Para qué sirve:** decir qué usan de verdad los comercios de la línea, para ordenar el plan de la 3.0. *(Antes del 13 oct 2026 servía para cargar estas tiendas en M6, que se retiró.)*

## 1. Lo que dice la flota

| Tienda | Producto 2.0 | Versión | Dirección | Anillo |
|---|---|---|---|---|
| Orgánico | **Tienda Básica** (solo la hoja, sin panel web) | 3.6.2 | subdominio de `workers.dev` | semilla de su línea |
| Cinnamon Beauty | **Tienda Básica** | 3.6.2 | subdominio de `workers.dev` | 1 |
| Laboratorio Digital | Tienda Panel | 1.1.3 | `tienda.laboratorio-digital.com` | semilla (no vende) |
| prueba1 | Tienda Panel | 1.1.2 | `prueba1.laboratorio-digital.com` | 2 (prueba) |

**Lo que esto cambia del plan:**

1. **Las dos tiendas que venden son de la Tienda Básica, no de la Tienda Panel.** El anexo C de TIENDA-3.0 se escribió con las puertas de la Tienda Panel. La paridad de M6 se mide contra lo que hace la Básica desde su hoja: catálogo, variantes, reservas, configuración, envíos, cupones, pedidos, pagos, datos de entrega, más vendidos y tablero (las pestañas de su contrato de datos). HU-T12.5 lo dice así.
2. **Ninguna tiene dominio propio.** Viven en `workers.dev`, así que M6 no necesita los dominios propios de M4: se redirige de su dirección vieja a `<nombre>.laboratorio-digital.app`. El orden M6 → M4 se sostiene (D-T7).
3. **Para ellas el panel es nuevo.** Hoy trabajan en la hoja. El corte (HU-T12.7) incluye una sesión guiada del panel, y «Descargar todo» (HU-T10.7) con hojas CSV y XLSX es lo que reemplaza la costumbre de tener la hoja.
4. **El tablero lo tienen en la hoja** (pestaña `Tablero`): HU-T14.2 antes de M6 se confirma (bitácora tienda3 1).
5. **La hoja de la Básica no es la de la Panel.** `scripts/tienda/desde-2.0.ts` (HU-T12.4) lee la exportación de la Básica; si un día se carga una tienda de la Panel, es otro mapa de columnas en el mismo script.

## 2. Lo que contestó el dueño

Una fila por cosa. Basta con «sí», «no» o la cifra. Lo que diga «sí» y el plan tenga después de M6 se mueve antes.

| Pregunta | Respuesta del dueño (13 oct 2026) | Qué cambia en el plan |
|---|---|---|
| ¿Cobra en línea con Bold? | Sí. A futuro, otras pasarelas como Mercado Pago y PayPal. Al principio se vende por WhatsApp | Nada para M6: M1 vende por WhatsApp y M3 cobra con Bold antes de M6. Las otras pasarelas pasan de «fuera de alcance» a **preparadas** (§9 del backlog): `ProveedorDePago` ya las admite |
| ¿Ofrece contraentrega? ¿Qué parte de los pedidos sale así y cuántos se devuelven? | Sí, como opción general de envío. La cifra no la tiene clara | Nada: M2 la trae (HU-T9.4, HU-T9.5). La cifra se pregunta de otra forma (§4) |
| ¿Usa cupones? | Sí | Nada: HU-T10.1 va en M2 |
| ¿Usa «Avísame cuando haya»? | Sí | Nada: HU-T6.5 va en M1 |
| ¿Tiene GA4 o el píxel de Meta configurados? | Sin respuesta | Ver §4 |
| ¿Manda correos (el del día al comercio o la confirmación al comprador)? | Sí | **HU-T14.3 se adelanta de T18 a T13**, antes del primer corte (bitácora tienda3 8) |
| ¿Tiene páginas propias («Quiénes somos», etc.)? | Sin respuesta | Ver §4 |
| ¿Más de una persona maneja la tienda? | Sin respuesta | Ver §4 |
| ¿Cuántos pedidos al mes, más o menos? | Sin respuesta | Ver §4 |
| ¿Cuántos productos y variantes? | 3 variantes con 4 opciones cada una | Lo leo como 3 grupos (talla, color…) de 4 valores: hasta 64 combinaciones por producto. Cabe en `tienda-import/1` (3 grupos, 20 valores por grupo, 100 combinaciones). Falta cuántos productos (§4) |
| ¿Cuánto paga hoy al mes, por separado, por tienda, facturación, mensajes y envíos? (estudio §16.2, pregunta 9) | La tienda activa paga 25.000 al mes | Está cerca del plan `entrada` de la hipótesis (29.900). Falta separar lo demás (§4) |

## 3. Lo que cambió con las respuestas

1. **Los correos van antes de M6.** Las tiendas mandan correos hoy, y el plan los tenía en M5, después de cargarlas. HU-T14.3 pasa a T13. Depende del adaptador de correo del CORE (HU-C10.1), que su backlog ata a Workers Paid: cómo se manda correo en el plan gratuito es la decisión D-T11 (bitácora tienda3 8).
2. **Cupones, «Avísame» y contraentrega ya estaban antes de M6.** No se mueve nada.
3. **Otras pasarelas, preparadas.** Mercado Pago y PayPal entran a §9 del backlog con su disparador: el dueño elige la segunda pasarela. El cobro de la Tienda ya pasa por `ProveedorDePago` (HU-T11.1), así que una pasarela nueva es un adaptador, no otro diseño.
4. **Al principio, WhatsApp.** Confirma el orden del plan: M1 vende por WhatsApp antes que M3 cobre en línea.

## 4. Lo que falta aclarar

Basta con una línea por pregunta. Si las dos tiendas responden distinto, una línea por tienda.

| Pregunta | Para qué |
|---|---|
| De cada 10 pedidos, ¿cuántos se pagan al recibir (contraentrega)? Y de esos, ¿cuántos el cliente no recibe y el paquete vuelve? | El tablero de recaudos (HU-T9.6) y cuánto pesa el flete de vuelta |
| ¿Alguna de las dos tiene Google Analytics o el píxel de Meta puesto en la tienda? | Sin dominio propio, la 3.0 no los carga (TIENDA §4.1): si una los usa, hay que hablar del dominio antes de cortarla |
| ¿Tienen páginas aparte del catálogo, como «Quiénes somos» o «Envíos y devoluciones»? | HU-T10.2 (hoy en M5) se adelanta si las usan |
| ¿Cuántas personas entran a manejar cada tienda? | Si son varias, el equipo (HU-T10.5, en M2) va en la sesión guiada del corte |
| ¿Cuántos productos tiene cada una, y cuántos pedidos le llegan al mes, más o menos? | Decide cuál se corta primero |
| Los 25.000 al mes: ¿son lo que el comercio le paga a Laboratorio Digital por la tienda? ¿Paga aparte algo por factura electrónica, por mensajes de WhatsApp o por la transportadora? | Los precios de los planes (D-T3) |

## 5. Las respuestas del 13 oct 2026 (segunda ronda)

| Pregunta | Respuesta del dueño | Qué cambia en el plan |
|---|---|---|
| De cada 10 pedidos, ¿cuántos se pagan al recibir y cuántos vuelven? | Sin respuesta todavía | Nada: la contraentrega va en M2 igual |
| ¿GA4 o el píxel de Meta? | Sí, los dos, editables desde la configuración | Decisión D-T13: GA4 también en el subdominio, con su cookie limitada a la tienda; el píxel de Meta, solo con dominio propio (TIENDA §4.1) |
| Search Console | En la 2.0, una tienda en un subdominio de la plataforma no se pudo verificar con el método del proveedor de dominio | **HU-T14.8, nueva, en T3:** el código de la etiqueta HTML de Google en la configuración, como el de GA4 y el píxel. Es el método que sirve para un subdominio (propiedad de prefijo de URL) |
| ¿Páginas propias? | Sí: «Envíos y devoluciones», y puede haber más | HU-T10.2 (páginas propias) sigue en M5. La política de envíos y devoluciones del comercio ya sale de sus textos legales (HU-T7.1) |
| ¿Más de una persona? | Sí: que haya roles y perfiles | Ninguno: el equipo (HU-T10.5) va en M2, con el propietario y el colaborador; la matriz de permisos admite más roles sin migración (HU-T1.4) |
| ¿Cuántos pedidos al mes? | Incierto; pregunta si el plan gratis debe limitarlos | Decisión D-T12: sin tope de pedidos, como propone el estudio; el gratuito se limita por productos, un usuario y sin dominio propio |
| Los 25.000 al mes | Es solo el servicio de la tienda. No tienen factura electrónica, ni la API pública de WhatsApp; los envíos y la transportadora van por su cuenta | Para D-T3: hoy pagan 25.000 por lo que el plan `entrada` propone a 29.900, y el estudio compara con Tiendanube Básico a 33.900 |

