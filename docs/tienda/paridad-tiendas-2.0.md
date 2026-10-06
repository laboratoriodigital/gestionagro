# Qué usa hoy cada tienda 2.0 (HU-T12.1)

**Estado:** a medias. La primera parte sale del registro público de la flota (`laboratoriodigital/tiendas`, `flota.json` y `ESTADO.md`, leídos el 6 oct 2026). La segunda la contesta el dueño: son preguntas de sí o no y de cifras, una por fila.

**Para qué sirve:** M6 carga estas tiendas en la 3.0, y TIENDA-3.0 anexo C exige que cada cosa que una tienda use pase antes en staging. Si algo de aquí no está en el plan antes de M6, se mueve (`BACKLOG_TIENDA3.md` §6).

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

## 2. Lo que falta, y lo contesta el dueño

Una fila por cosa. Basta con «sí», «no» o la cifra. Lo que diga «sí» y el plan tenga después de M6 se mueve antes.

| Pregunta | Orgánico | Cinnamon Beauty | Si es «sí», qué historia se adelanta |
|---|---|---|---|
| ¿Cobra en línea con Bold? | | | Ninguna: M3 ya va antes de M6 |
| ¿Ofrece contraentrega? ¿Qué parte de los pedidos sale así y cuántos se devuelven? | | | Ninguna: M2 la trae (HU-T9.4, HU-T9.5) |
| ¿Usa cupones? | | | Ninguna: HU-T10.1 va en M2 |
| ¿Usa «Avísame cuando haya»? | | | Ninguna: HU-T6.5 va en M1 |
| ¿Tiene GA4 o el píxel de Meta configurados? | | | HU-T14.4 (hoy en M5). Sin dominio propio la 3.0 no los carga (TIENDA §4.1): hay que hablarlo |
| ¿Manda correos (el del día al comercio o la confirmación al comprador)? | | | HU-T14.3 (hoy en M5) |
| ¿Tiene páginas propias («Quiénes somos», etc.)? | | | HU-T10.2 (hoy en M5) |
| ¿Más de una persona maneja la tienda? | | | Ninguna: HU-T10.5 va en M2 |
| ¿Cuántos pedidos al mes, más o menos? | | | Decide cuál se corta primero (la que esté más cerca de un techo de la 2.0) |
| ¿Cuántos productos y variantes? | | | Ídem |
| ¿Cuánto paga hoy al mes, por separado, por tienda, facturación, mensajes y envíos? (estudio §16.2, pregunta 9) | | | D-T3: los precios de los planes |

Cuando esté contestada, esta tabla se completa aquí y HU-T12.1 pasa a «En validación».
