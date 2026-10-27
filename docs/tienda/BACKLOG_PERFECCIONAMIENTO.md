# TiendaPro — Backlog de perfeccionamiento

**Versión:** 0.1.0 · 26 oct 2026
**Nace de:** `CONTRASTE-TIENDANUBE-2026-10.md`, pedido por el dueño el 26 oct 2026: lo que Tiendanube ofrece y TiendaPro tiene a medias o no tiene.
**Estado de todo lo de aquí:** **propuesto, por priorizar con el dueño.** Nada entra a un sprint sin su visto bueno; cuando lo dé, la historia pasa a `BACKLOG_TIENDA3.md` con su sprint y su estado, y aquí queda la referencia.
**Lo que manda:** ED1 → `ARQUITECTURA.md` (P1–P21) → `TIENDA-3.0.md`. Cada historia dice qué premisa cuida. Se trabaja igual que el resto de la Tienda: GitHub flow, un PR por sprint, las definiciones de Listo y de Terminado de `BACKLOG_TIENDA3.md` §4 y textos cálidos y sin técnica.

---

## 0. En una página

| Épica | Historias | Puntos | Prioridad sugerida |
|---|---|---:|---|
| **EP1 · Vender más** | HU-P1.1 a HU-P1.5 | 16 | P1: HU-P1.1 y HU-P1.2 |
| **EP2 · Avisarle a cada quien a tiempo** | HU-P2.1 y HU-P2.2 | 5 | P1: HU-P2.1 |
| **EP3 · Administrar más rápido** | HU-P3.1 a HU-P3.3 | 10 | P1: HU-P3.1 |
| **EP4 · Una vitrina más completa** | HU-P4.1 a HU-P4.4 | 9 | P1: HU-P4.3 |
| **EP5 · Acompañar al comerciante** | HU-P5.1 y HU-P5.2 | 5 | P1 antes de vender en serio: HU-P5.1 |
| **Total** | 16 historias | **45** | P1: unos 20 puntos, un sprint |

**El sprint P1 sugerido (20 puntos):** HU-P1.1 (5), HU-P1.2 (3), HU-P2.1 (3), HU-P3.1 (5), HU-P4.3 (1) y HU-P5.1 (3).

Lo que tiene disparador y lo que no se hará está en el contraste, §5. Los disparadores nuevos (Addi, TikTok, productos digitales y email marketing) se suman a `BACKLOG_TIENDA3.md` §9.

---

## EP1 · Vender más

#### HU-P1.1 · Compras sin terminar, con el permiso del comprador
- **Capa:** vitrina, API y panel · **Prioridad:** Should · **Puntos:** 5 · **Plan:** Pro e IA Pro · **Estado:** Propuesta (el dueño la pidió el 26 oct 2026; falta confirmar el plan)
- Como comerciante, quiero ver quién dejó una compra sin terminar y escribirle, para no perder la venta.
- **Referencia:** Tiendanube, «carritos abandonados» y su correo automático. Estudio §8.4: la recuperación de carrito pide contactos autorizados.
- **CA1.** En el carrito, el comprador puede dejar su WhatsApp o su correo y marcar «Recordarme mi compra si no la termino». La casilla viene **sin marcar**.
- **CA2.** Si en 2 horas no hay pedido con ese carrito, el panel lo muestra en «Compras sin terminar»: productos, total, cuándo y el contacto.
- **CA3.** «Escribirle por WhatsApp» abre el chat del comerciante con un mensaje listo y el enlace para retomar el carrito. Un correo automático, solo en IA Pro y con el tope de correos de la tienda.
- **CA4 ❌.** Sin la casilla marcada no se guarda nada. Los contactos se borran a los 30 días o cuando hay pedido. No se registra en ningún `GET` de página.
- **Cuida:** Ley 1581 y TIENDA §14.3 (mínimo necesario); una visita no toca la base (el registro va en el `POST` de la isla del carrito); sin WhatsApp Cloud API (§9).

#### HU-P1.2 · Promociones por cantidad
- **Capa:** API, horno y panel · **Prioridad:** Should · **Puntos:** 3 · **Plan:** Pro e IA Pro · **Estado:** Propuesta
- Como comerciante, quiero ofrecer «lleva 3 y paga 2» o «10 % desde 2 unidades», para vender más por pedido.
- **Referencia:** Tiendanube, «descuentos por cantidad».
- **CA1.** En «Venta», una promoción con producto o colección, cantidad mínima, y un porcentaje o unidades de regalo, con vigencia.
- **CA2.** La ficha dice la promoción; el carrito la aplica y el resumen muestra el descuento.
- **CA3 ❌.** El servidor la recalcula al cotizar: un carrito que dice otra cosa no se cobra. No se suma con otra promoción en el mismo producto.
- **Cuida:** «lo que el comprador vio es lo que paga» (TIENDA §1.3) y `@ed1/dinero` (pesos enteros, el reparto del descuento).

#### HU-P1.3 · Cupones por producto o colección
- **Capa:** API y panel · **Prioridad:** Could · **Puntos:** 2 · **Plan:** todos · **Estado:** Propuesta
- Como comerciante, quiero que un cupón aplique solo a unos productos, para hacer promociones puntuales.
- **CA1.** Un cupón puede limitarse a productos o colecciones; sin límite, aplica a todo, como hoy.
- **CA2 ❌.** Un carrito sin esos productos recibe «este cupón no aplica a tu compra», y el descuento nunca pasa del valor de esos productos.

#### HU-P1.4 · Ofertas programadas
- **Capa:** API y horno · **Prioridad:** Could · **Puntos:** 3 · **Plan:** Pro e IA Pro · **Estado:** Propuesta
- Como comerciante, quiero dejar lista la oferta del fin de semana, para que empiece y termine sola.
- **Referencia:** Tiendanube, «activación programada por fecha».
- **CA1.** El precio de antes de una combinación puede tener fecha de inicio y de fin.
- **CA2.** El cron de la tienda re-hornea solo lo que cambia al empezar y al terminar (re-horneado mínimo, HU-T4.5).
- **CA3 ❌.** El horno no lee el reloj: la fecha llega como dato. Mientras no se re-hornea, la cotización manda (el servidor nunca cobra el precio vencido).

#### HU-P1.5 · Un texto del comprador en la ficha
- **Capa:** vitrina, API y panel · **Prioridad:** Could · **Puntos:** 3 · **Plan:** Pro e IA Pro · **Estado:** Propuesta
- Como comerciante que personaliza, quiero pedir «nombre para grabar» o «mensaje de la tarjeta» en la ficha.
- **Referencia:** Tiendanube, «campos personalizados».
- **CA1.** Un producto puede pedir un texto, con su etiqueta y su largo máximo, obligatorio o no.
- **CA2.** El texto llega al pedido, al WhatsApp y al panel.
- **CA3 ❌.** Se guarda como texto y se escapa al mostrarlo: nunca se ejecuta (HU-T4.2). Va cifrado con los datos del pedido si el comercio lo marca como personal.

---

## EP2 · Avisarle a cada quien a tiempo

#### HU-P2.1 · Los correos del pedido al comprador
- **Capa:** API · **Prioridad:** Should · **Puntos:** 3 · **Plan:** todos · **Estado:** Propuesta
- Como comprador, quiero saber por correo cuando confirman, cobran, despachan o cancelan mi pedido.
- **Referencia:** Tiendanube, «e-mails automáticos» de pago, envío y cancelación.
- **CA1.** Si el comprador dejó su correo, recibe un correo cuando el pedido se confirma, se paga, se despacha (con la guía, si la hay) y se cancela, siempre con el enlace de seguimiento.
- **CA2.** Salen desde la marca con `Reply-To` al comercio, como el acuse (HU-T18.4).
- **CA3 ❌.** Cuentan para el tope de la tienda y de la celda (HU-T14.3); pasado el tope no salen, y el panel lo dice. Un correo fallido nunca cambia el estado del pedido.

#### HU-P2.2 · «Por agotarse»
- **Capa:** API y panel · **Prioridad:** Should · **Puntos:** 2 · **Plan:** todos · **Estado:** Propuesta
- Como comerciante, quiero saber antes de que algo se agote, para reponerlo a tiempo.
- **CA1.** Cada combinación puede tener un mínimo; por defecto, ninguno.
- **CA2.** El tablero y el resumen diario dicen cuáles están en su mínimo o por debajo.

---

## EP3 · Administrar más rápido

#### HU-P3.1 · Cambiar varios productos a la vez
- **Capa:** API y panel · **Prioridad:** Should · **Puntos:** 5 · **Plan:** todos · **Estado:** Propuesta
- Como comerciante, quiero subir los precios un 5 % o esconder varios productos de una vez, sin la hoja de cálculo.
- **Referencia:** Tiendanube, «acciones masivas».
- **CA1.** En Productos, elegir varios (o una colección) y: cambiar el precio en un porcentaje o un valor, mostrar, esconder o borrar.
- **CA2.** Antes de aplicar, dice cuántos productos y combinaciones cambian, con un ejemplo.
- **CA3 ❌.** Todo o nada: un lote que falla no deja la mitad cambiada. Cada cambio queda en el registro (HU-T10.6). Los precios quedan en pesos enteros.

#### HU-P3.2 · Filtrar los pedidos por fecha y por canal
- **Capa:** panel y API · **Prioridad:** Should · **Puntos:** 2 · **Plan:** todos · **Estado:** Propuesta
- Como comerciante, quiero ver los pedidos de la semana que llegaron por WhatsApp, o los que preparó un asistente.
- **Referencia:** Tiendanube, filtros por estado, fecha, envío y canal.
- **CA1.** La bandeja suma filtros por rango de fechas y por canal (tienda, anotado en el panel, asistente) a los que ya tiene.
- **CA2.** «Descargar estos pedidos» baja lo filtrado en una hoja.

#### HU-P3.3 · Un rol para quien solo despacha
- **Capa:** paquete, API y panel · **Prioridad:** Could · **Puntos:** 3 · **Plan:** Pro e IA Pro · **Estado:** Propuesta
- Como comerciante, quiero que quien despacha vea y mueva los pedidos sin tocar precios ni productos.
- **Referencia:** Tiendanube, «permisos específicos por perfil».
- **CA1.** Un tercer rol, «Despachos», en la invitación del equipo.
- **CA2 ❌.** La matriz de `permisos.ts` es la única fuente: la API rechaza lo que el rol no puede, aunque el panel no lo muestre.

---

## EP4 · Una vitrina más completa

#### HU-P4.1 · Temas listos
- **Capa:** horno y panel · **Prioridad:** Should · **Puntos:** 3 · **Plan:** todos · **Estado:** Propuesta
- Como comerciante sin diseñador, quiero elegir un estilo completo con un toque, para que mi tienda se vea bien de una vez.
- **Referencia:** Tiendanube, más de 60 plantillas.
- **CA1.** Seis a ocho temas con nombre (por ejemplo: Panadería, Moda, Belleza, Campo, Tecnología, Minimal), cada uno una combinación de acento, tinta, estilo, portada y proporción.
- **CA2.** Elegir un tema muestra la vista previa (HU-T8.6) y se puede ajustar después.
- **CA3 ❌.** Un tema es dato, no código: pasa por la misma compuerta de contraste y de peso (HU-T3.6).

#### HU-P4.2 · Varias imágenes en la bienvenida
- **Capa:** horno · **Prioridad:** Could · **Puntos:** 3 · **Plan:** Pro e IA Pro · **Estado:** Propuesta
- Como comerciante, quiero mostrar dos o tres imágenes en la bienvenida, cada una con su enlace.
- **Referencia:** Tiendanube, «banners, carruseles o videos».
- **CA1.** Hasta 3 imágenes que se deslizan con el dedo, con CSS y sin librería.
- **CA2 ❌.** La portada sigue por debajo de 50 KB y de 2,5 s (TIENDA §1.3): solo la primera imagen carga de entrada. Video no: rompe el presupuesto.

#### HU-P4.3 · Las redes sociales de la tienda
- **Capa:** paquete y horno · **Prioridad:** Should · **Puntos:** 1 · **Plan:** todos · **Estado:** Propuesta
- Como comerciante, quiero que mi tienda lleve a mi Instagram, TikTok y Facebook.
- **CA1.** En «Ajustes › Contacto», los enlaces de Instagram, TikTok y Facebook; el pie de la tienda los muestra con su ícono.
- **CA2 ❌.** Solo direcciones de esas redes (`instagram.com`, `tiktok.com`, `facebook.com`); ningún script de ellas en la página.

#### HU-P4.4 · Título y descripción para buscadores
- **Capa:** paquete, horno y panel · **Prioridad:** Could · **Puntos:** 2 · **Plan:** todos · **Estado:** Propuesta
- Como comerciante, quiero decidir cómo aparece mi producto en Google.
- **Referencia:** Tiendanube, «personalización del SEO».
- **CA1.** Producto y página pueden tener título y descripción para buscadores; sin ellos, salen de su nombre y su descripción, como hoy.
- **CA2.** El panel muestra cómo se vería en Google y avisa si es muy largo.

---

## EP5 · Acompañar al comerciante

#### HU-P5.1 · La ayuda de TiendaPro
- **Capa:** sitio · **Prioridad:** Must antes de vender en serio · **Puntos:** 3 · **Plan:** todos · **Estado:** Propuesta
- Como comerciante, quiero una guía corta para cada cosa que tengo que hacer por primera vez.
- **Referencia:** Tiendanube, más de 600 tutoriales y soporte por WhatsApp.
- **CA1.** En `tiendapro.co/ayuda`, guías de una pantalla con capturas: tu primer producto, publicar, conectar Bold, conectar tu dominio, cargar por lotes, atender un pedido contra entrega y verificar en Google.
- **CA2.** Cada pantalla del panel que lo necesite enlaza a su guía.
- **CA3.** El pie de la ayuda lleva el WhatsApp de soporte de TiendaPro.
- **Cuida:** textos cálidos y sin técnica; las guías salen de los runbooks, sin repetir lo técnico.

#### HU-P5.2 · La calculadora de precios
- **Capa:** sitio · **Prioridad:** Could · **Puntos:** 2 · **Plan:** gratis, en `tiendapro.co` · **Estado:** Propuesta
- Como persona que vende, quiero saber a cuánto vender para que me quede lo que espero, con la comisión de Bold y el envío.
- **Referencia:** Tiendanube, herramientas gratis (calculadora de precios y de descuentos). Estudio: las herramientas gratis como entrada al producto.
- **CA1.** Costo, margen deseado, forma de pago y envío dan el precio de venta y lo que queda en el bolsillo.
- **CA2 ❌.** Corre en el navegador, sin guardar nada; las tarifas de Bold llevan la fecha en que se consultaron.
