# TiendaPro — Backlog de perfeccionamiento

**Versión:** 0.2.0 · 26 oct 2026
**Nace de:** `CONTRASTE-TIENDANUBE-2026-10.md`, pedido por el dueño el 26 oct 2026: lo que Tiendanube ofrece y TiendaPro tiene a medias o no tiene.
**Estado:** **refinado y listo para ejecutar por sprint** (decisión del dueño del 26 oct 2026). Cada sprint es un PR y una versión menor de la Tienda; al cerrarse, sus historias pasan a «Construida» y esperan la validación del dueño, como en `BACKLOG_TIENDA3.md`.
**Decisiones del dueño del 26 oct 2026:** las compras sin terminar van en **Pro**; la **venta de productos digitales** entra al backlog (EP6), ya no espera disparador.
**Lo que manda:** ED1 → `ARQUITECTURA.md` (P1–P21) → `TIENDA-3.0.md`. Cada historia dice qué premisa cuida. Se trabaja igual que el resto de la Tienda: GitHub flow, un PR por sprint, las definiciones de Listo y de Terminado de `BACKLOG_TIENDA3.md` §4 y textos cálidos y sin técnica. El plan de Cloudflare sigue siendo el gratuito: ninguna historia lo necesita pagado.

---

## 0. En una página

| Épica | Historias | Puntos |
|---|---|---:|
| **EP1 · Vender más** | HU-P1.1 a HU-P1.5 | 16 |
| **EP2 · Avisarle a cada quien a tiempo** | HU-P2.1 y HU-P2.2 | 5 |
| **EP3 · Administrar más rápido** | HU-P3.1 a HU-P3.3 | 10 |
| **EP4 · Una vitrina más completa** | HU-P4.1 a HU-P4.4 | 9 |
| **EP5 · Acompañar al comerciante** | HU-P5.1 y HU-P5.2 | 5 |
| **EP6 · Vender productos digitales** | HU-P6.1 a HU-P6.3 | 12 |
| **Total** | 19 historias | **57** |

### 0.1 Los sprints

Tres sprints de unos 20 puntos, la velocidad planeada de la Tienda. Las fechas son un techo, no una meta: los sprints de lanzamiento se construyeron en un día.

| Sprint | Fechas (techo) | Objetivo | Historias | Puntos | Versión |
|---|---|---|---|---:|---|
| **PF1** | 27 oct – 2 nov 2026 (construido el 27 oct) | **Vender más y perder menos ventas:** compras sin terminar, promociones por cantidad, correos al comprador, cambios masivos, redes y la ayuda | HU-P1.1 (5), HU-P1.2 (3), HU-P2.1 (3), HU-P3.1 (5), HU-P4.3 (1), HU-P5.1 (3) | 20 | tienda 1.5.0 |
| **PF2** | 3 – 9 nov 2026 (construido el 28 oct) | **Productos digitales y control del día a día** | HU-P6.1 (5), HU-P6.2 (5), HU-P6.3 (2), HU-P2.2 (2), HU-P3.2 (2), HU-P1.3 (2) | 18 | tienda 1.6.0 |
| **PF3** | 10 – 16 nov 2026 (construido el 28 oct) | **Una vitrina más completa y más control** | HU-P4.1 (3), HU-P4.2 (3), HU-P4.4 (2), HU-P1.4 (3), HU-P1.5 (3), HU-P3.3 (3), HU-P5.2 (2) | 19 | tienda 1.7.0 |

**Por qué este orden.** PF1 junta lo que más mueve ventas y lo que el comerciante necesita para arrancar solo (la ayuda), sin nada que espere al dueño. PF2 lleva los productos digitales, que piden un almacén privado que crea el dueño (WI-P6.1.4) antes de empezar. PF3 es pulido de la vitrina y del panel.

### 0.2 Listas para empezar (Definición de Listo)

| Sprint | ¿Listo? | Lo que falta antes de empezar |
|---|---|---|
| PF1 | **Sí** | Nada: cabe en la arquitectura de hoy y no pide nada del dueño. El WhatsApp de soporte de TiendaPro (HU-P5.1 CA3) puede llegar durante el sprint |
| PF2 | Casi | El dueño crea el almacén privado de los archivos digitales en R2 (WI-P6.1.4): el token del despliegue no tiene permiso de R2, a propósito |
| PF3 | Sí | — |

### 0.3 Lo que se valida al cerrar cada sprint

- **PF1:** dejar una compra sin terminar en una tienda Pro de staging y verla en el panel; armar «lleva 3, paga 2»; recibir los correos de un pedido; subir un 5 % los precios de una colección; ver Instagram en el pie; leer dos guías de la ayuda.
- **PF2:** vender un PDF de prueba con un cobro de prueba de Bold, descargarlo desde el seguimiento y comprobar que el enlace vence; ver «por agotarse»; filtrar pedidos por fecha y canal; un cupón solo para una colección.
- **PF3:** elegir un tema listo; tres imágenes en la bienvenida; una oferta que empieza y termina sola; un texto para grabar; invitar a alguien con el rol «Despachos»; la calculadora en tiendapro.co.

---

## EP1 · Vender más

#### HU-P1.1 · Compras sin terminar, con el permiso del comprador
- **Capa:** vitrina, API y panel · **Prioridad:** Must · **Puntos:** 5 · **Sprint:** PF1 · **Plan:** Pro (e IA Pro, que trae todo lo de Pro) · **Estado:** Construida (27 oct 2026, tienda 1.5.0), por validar. `compras-pendientes.ts`, migración 0021, `compras_sin_terminar` en funciones.json; la casilla en el carrito solo con ese plan.
- Como comerciante, quiero ver quién dejó una compra sin terminar y escribirle, para no perder la venta.
- **Referencia:** Tiendanube, «carritos abandonados». Estudio §8.4: la recuperación de carrito pide contactos autorizados.
- **CA1.** En el carrito de una tienda Pro, el comprador puede dejar su WhatsApp o su correo y marcar «Recordarme mi compra si no la termino». La casilla viene **sin marcar**.
- **CA2.** Si en 2 horas no hay pedido con ese carrito (su código de 6 caracteres), el panel lo muestra en «Pedidos › Compras sin terminar»: productos, total, cuándo y el contacto.
- **CA3.** «Escribirle por WhatsApp» abre el chat del comerciante con un mensaje listo y el enlace para retomar el carrito. «Ya le escribí» la saca de la lista y queda en el registro.
- **CA4 ❌.** Sin la casilla marcada no se guarda nada. Los contactos van cifrados (`@ed1/cifrado`) y se borran a los 30 días o cuando hay pedido con ese carrito (purga diaria, HU-T17.2). Una tienda Gratis no muestra la casilla y la API la rechaza.
- **Cuida:** Ley 1581 y TIENDA §14.3 (mínimo necesario, finalidad dicha en la casilla); una visita no toca la base (el registro va en un `POST` de la isla del carrito, con su límite por IP); sin WhatsApp Cloud API (`BACKLOG_TIENDA3` §9). El correo automático de recordatorio queda fuera: lo pide el disparador de email marketing.
- **Work items:** WI-P1.1.1 `[código]` migración `compra_pendiente` (cifrada, con vencimiento) y `POST /api/v1/carrito/recordar` · WI-P1.1.2 `[código]` la casilla en la isla del carrito · WI-P1.1.3 `[código]` la lista en el panel y «Ya le escribí» · WI-P1.1.4 `[prueba]` sin casilla no hay fila; la purga; Gratis rechazada; e2e del carrito · WI-P1.1.5 `[doc]` la finalidad en la política de datos de la tienda (HU-T7.1).

#### HU-P1.2 · Promociones por cantidad
- **Capa:** API, horno y panel · **Prioridad:** Should · **Puntos:** 3 · **Sprint:** PF1 · **Plan:** Pro · **Estado:** Construida (27 oct 2026, tienda 1.5.0), por validar. **Cambió al construir:** la promoción va en el producto (migración 0020, columna `promocion`) y no en una tabla aparte; ponerla a toda una categoría se hace con HU-P3.1. La cuenta está en `@ed1/dinero` (`descuentoPorCantidad`). Queda pendiente que «Descargar todo» y la carga la lleven (WI-P1.2.5).
- Como comerciante, quiero ofrecer «lleva 3 y paga 2» o «10 % desde 2 unidades», para vender más por pedido.
- **Referencia:** Tiendanube, «descuentos por cantidad».
- **CA1.** En «Venta › Promociones», una promoción con producto o colección, cantidad mínima, y un porcentaje o unidades de regalo, con vigencia.
- **CA2.** La ficha dice la promoción; el carrito la aplica y el resumen muestra el descuento en su línea.
- **CA3 ❌.** El servidor la recalcula al cotizar: un carrito que dice otra cosa no se cobra. No se suma con otra promoción en el mismo producto; con un cupón, se aplica primero la promoción.
- **Cuida:** «lo que el comprador vio es lo que paga» (TIENDA §1.3) y `@ed1/dinero` (pesos enteros, el reparto del descuento).
- **Work items:** WI-P1.2.1 `[código]` tabla `promocion` y su cálculo en `cotizar` · WI-P1.2.2 `[código]` la pantalla del panel · WI-P1.2.3 `[código]` la etiqueta en la ficha (horno) · WI-P1.2.4 `[prueba]` los dos tipos, el redondeo y el ❌ del carrito alterado · WI-P1.2.5 `[código]` la promoción en «Descargar todo» y en la carga (pendiente).

#### HU-P1.3 · Cupones por producto o colección
- **Capa:** API y panel · **Prioridad:** Could · **Puntos:** 2 · **Sprint:** PF2 · **Plan:** todos · **Estado:** Construida (28 oct 2026, tienda 1.6.0), por validar. Migración 0022 (`alcance`); `@ed1/dinero` calcula el cupón sobre sus productos. El panel elige categorías; los productos sueltos, por ahora solo por la API. **Al construirla apareció que el carrito no tenía dónde escribir un cupón** (bitácora tienda3 65): ahora lo tiene, si la tienda tiene cupones activos.
- Como comerciante, quiero que un cupón aplique solo a unos productos, para hacer promociones puntuales.
- **CA1.** Un cupón puede limitarse a productos o colecciones; sin límite, aplica a todo, como hoy.
- **CA2 ❌.** Un carrito sin esos productos recibe «este cupón no aplica a tu compra», y el descuento nunca pasa del valor de esos productos.
- **Work items:** WI-P1.3.1 `[código]` el alcance del cupón y su cálculo · WI-P1.3.2 `[prueba]`.

#### HU-P1.4 · Ofertas programadas
- **Capa:** API y horno · **Prioridad:** Could · **Puntos:** 3 · **Sprint:** PF3 · **Plan:** Pro · **Estado:** Construida (28 oct 2026, tienda 1.7.0), por validar. **Cambió al construir:** la oferta es del producto y en porcentaje, igual para todas sus combinaciones, no un precio por combinación: un formulario corto y una sola regla (`precioDeOferta` en `@ed1/dinero`). Migración 0026. El horno recibe la hora como dato (`ahora`); la tarea `ofertas-programadas` re-hornea cada hora, desde la medianoche de Colombia, las tiendas con una oferta que empieza hoy o terminó ayer, una vez por día. **Validación del 28 oct 2026:** la lista de productos del panel marca la oferta que rige y la que viene (tienda 1.7.1).
- Como comerciante, quiero dejar lista la oferta del fin de semana, para que empiece y termine sola.
- **Referencia:** Tiendanube, «activación programada por fecha».
- **CA1.** El precio de oferta de una combinación puede tener fecha de inicio y de fin; fuera de ellas rige el precio normal.
- **CA2.** El cron de cada hora re-hornea solo lo que cambia al empezar y al terminar (re-horneado mínimo, HU-T4.5).
- **CA3 ❌.** El horno no lee el reloj: la fecha llega como dato. Mientras no se re-hornea, la cotización manda y nunca cobra un precio vencido.
- **Work items:** WI-P1.4.1 `[código]` las fechas en la variante y en `cotizar` · WI-P1.4.2 `[código]` el cron · WI-P1.4.3 `[prueba]`.

#### HU-P1.5 · Un texto del comprador en la ficha
- **Capa:** vitrina, API y panel · **Prioridad:** Could · **Puntos:** 3 · **Sprint:** PF3 · **Plan:** Pro · **Estado:** Construida (28 oct 2026, tienda 1.7.0), por validar. Migración 0027 (`pide_texto`). Un texto por línea: uno nuevo reemplaza al anterior. Va cifrado en el sobre de la entrega: en un pedido en línea con los demás datos; en uno por WhatsApp, en un sobre solo con los textos. El panel lo ve al abrir los datos de entrega. Un pedido que prepara un asistente o que se anota en el panel no lleva texto.
- Como comerciante que personaliza, quiero pedir «nombre para grabar» o «mensaje de la tarjeta» en la ficha.
- **Referencia:** Tiendanube, «campos personalizados».
- **CA1.** Un producto puede pedir un texto, con su etiqueta y su largo máximo (hasta 200), obligatorio o no.
- **CA2.** El texto llega al pedido, al WhatsApp y al panel.
- **CA3 ❌.** Se guarda como texto y se escapa al mostrarlo: nunca se ejecuta (HU-T4.2). Va cifrado con los datos de entrega del pedido.
- **Work items:** WI-P1.5.1 `[código]` el campo en el producto (`tienda-schema`) · WI-P1.5.2 `[código]` la isla y el pedido · WI-P1.5.3 `[prueba]`.

---

## EP2 · Avisarle a cada quien a tiempo

#### HU-P2.1 · Los correos del pedido al comprador
- **Capa:** API · **Prioridad:** Should · **Puntos:** 3 · **Sprint:** PF1 · **Plan:** todos · **Estado:** Construida (27 oct 2026, tienda 1.5.0), por validar. **Cambió al construir:** el correo no lleva el enlace de seguimiento, porque su secreto nace en el navegador y la base solo guarda su huella (TIENDA §8.4); dice el código y que el enlace es el del primer correo. Van con el tipo `acuse` del registro de correos, sin rehacer la tabla.
- Como comprador, quiero saber por correo cuando confirman, cobran, despachan o cancelan mi pedido.
- **Referencia:** Tiendanube, «e-mails automáticos» de pago, envío y cancelación.
- **CA1.** Si el comprador dejó su correo, recibe un correo cuando el pedido se confirma, se paga, se despacha (con la guía, si la hay) y se cancela, siempre con el enlace de seguimiento.
- **CA2.** Salen desde la marca con `Reply-To` al comercio, como el acuse (HU-T18.4); una sola vez por pedido y estado (`mandarUnaVez`).
- **CA3 ❌.** Cuentan para el tope de la tienda y de la celda (HU-T14.3); pasado el tope no salen, y el panel lo dice. Un correo fallido nunca cambia el estado del pedido.
- **Work items:** WI-P2.1.1 `[código]` los cuatro textos en `correos.ts` · WI-P2.1.2 `[código]` engancharlos a los cambios de estado · WI-P2.1.3 `[prueba]` uno por estado, el tope y el ❌.

#### HU-P2.2 · «Por agotarse»
- **Capa:** API y panel · **Prioridad:** Should · **Puntos:** 2 · **Sprint:** PF2 · **Plan:** todos · **Estado:** Construida (28 oct 2026, tienda 1.6.0), por validar. **Cambió al construir:** el mínimo ya existía en «Ajustes › Avisos» (`stockBajo`) sin usarse; es el de toda la tienda, y el de cada combinación queda para después. Índice `variante_por_quedan` (migración 0024, bitácora tienda3 66).
- Como comerciante, quiero saber antes de que algo se agote, para reponerlo a tiempo.
- **CA1.** Cada combinación puede tener un mínimo; por defecto, ninguno.
- **CA2.** El tablero y el resumen diario dicen cuáles están en su mínimo o por debajo.
- **Work items:** WI-P2.2.1 `[código]` el mínimo en el inventario · WI-P2.2.2 `[código]` tablero y resumen · WI-P2.2.3 `[prueba]`.

---

## EP3 · Administrar más rápido

#### HU-P3.1 · Cambiar varios productos a la vez
- **Capa:** API y panel · **Prioridad:** Should · **Puntos:** 5 · **Sprint:** PF1 · **Plan:** todos · **Estado:** Terminada (construida el 27 oct 2026; validada por el dueño el 28 oct 2026)
- Como comerciante, quiero subir los precios un 5 % o esconder varios productos de una vez, sin la hoja de cálculo.
- **Referencia:** Tiendanube, «acciones masivas».
- **CA1.** En Productos, elegir varios (o una colección) y: cambiar el precio en un porcentaje o un valor, mostrar, esconder o borrar.
- **CA2.** Antes de aplicar, dice cuántos productos y combinaciones cambian, con un ejemplo de precio antes y después.
- **CA3 ❌.** Todo o nada: un lote que falla no deja la mitad cambiada (por partes de hasta 50 sentencias, como la carga). Cada cambio queda en el registro (HU-T10.6). Los precios quedan en pesos enteros y nunca en 0.
- **Work items:** WI-P3.1.1 `[código]` `POST /api/panel/v1/productos/lote` con vista previa · WI-P3.1.2 `[código]` la selección en el panel · WI-P3.1.3 `[prueba]` el redondeo, el todo o nada y el registro.

#### HU-P3.2 · Filtrar los pedidos por fecha y por canal
- **Capa:** panel y API · **Prioridad:** Should · **Puntos:** 2 · **Sprint:** PF2 · **Plan:** todos · **Estado:** Construida (28 oct 2026, tienda 1.6.0), por validar. Filtra lo que ya cargó la bandeja, como los demás filtros; la hoja nunca lleva datos de los compradores.
- Como comerciante, quiero ver los pedidos de la semana que llegaron por la tienda, o los que preparó un asistente.
- **Referencia:** Tiendanube, filtros por estado, fecha, envío y canal.
- **CA1.** La bandeja suma filtros por rango de fechas y por canal (tienda, anotado en el panel, asistente) a los que ya tiene.
- **CA2.** «Descargar estos pedidos» baja lo filtrado en una hoja, sin datos personales salvo para el propietario con entrada reciente (como HU-T10.7).
- **Work items:** WI-P3.2.1 `[código]` · WI-P3.2.2 `[prueba]`.

#### HU-P3.3 · Un rol para quien solo despacha
- **Capa:** paquete, API y panel · **Prioridad:** Could · **Puntos:** 3 · **Sprint:** PF3 · **Plan:** Pro e IA Pro · **Estado:** Construida (28 oct 2026, tienda 1.7.0), por validar. El rol `despachos` en `permisos.ts` y en `infrastructure/productos.json`, que lleva el CORE a 0.12.0. Una acción nueva, `inventario.ver`, separa ver el inventario de ajustarlo. El panel cambia «Productos» por «Inventario» y no ofrece lo que el rol no puede; la API lo niega con 403 (`panel-despachos.test.ts`).
- Como comerciante, quiero que quien despacha vea y mueva los pedidos sin tocar precios ni productos.
- **Referencia:** Tiendanube, «permisos específicos por perfil».
- **CA1.** Un tercer rol, «Despachos», en la invitación del equipo: pedidos, recaudos e inventario de solo lectura.
- **CA2 ❌.** La matriz de `permisos.ts` es la única fuente: la API rechaza lo que el rol no puede, aunque el panel no lo muestre.
- **Work items:** WI-P3.3.1 `[código]` el rol en `permisos.ts` y en el CORE (membresía) · WI-P3.3.2 `[código]` el panel · WI-P3.3.3 `[prueba]` cada acción prohibida.

---

## EP4 · Una vitrina más completa

#### HU-P4.1 · Temas listos
- **Capa:** horno y panel · **Prioridad:** Should · **Puntos:** 3 · **Sprint:** PF3 · **Plan:** todos · **Estado:** Terminada (construida el 28 oct 2026, tienda 1.7.0; validada por el dueño el 28 oct 2026). Ocho temas en `@ed1/tienda-schema/temas`, con los acentos del panel; una prueba del horno pasa cada uno en claro, en oscuro y con el modo del teléfono. **Cambió al construir:** para una tienda solo oscura, cada tema trae su acento aclarado (el horno no ajusta en silencio, bitácora tienda3 69). Elegirlo llena el formulario; la vista previa es la de «Publicar», después de guardar.
- Como comerciante sin diseñador, quiero elegir un estilo completo con un toque, para que mi tienda se vea bien de una vez.
- **Referencia:** Tiendanube, más de 60 plantillas.
- **CA1.** Seis a ocho temas con nombre (por ejemplo: Panadería, Moda, Belleza, Campo, Tecnología, Minimal), cada uno una combinación de acento, tinta, estilo, portada y proporción.
- **CA2.** Elegir un tema muestra la vista previa (HU-T8.6) y se puede ajustar después.
- **CA3 ❌.** Un tema es dato, no código: pasa por la misma compuerta de contraste y de peso (HU-T3.6).
- **Work items:** WI-P4.1.1 `[código]` los temas en `tienda-schema` · WI-P4.1.2 `[código]` el selector del panel · WI-P4.1.3 `[prueba]` contraste de cada tema.

#### HU-P4.2 · Varias imágenes en la bienvenida
- **Capa:** horno · **Prioridad:** Could · **Puntos:** 3 · **Sprint:** PF3 · **Plan:** Pro · **Estado:** Terminada (construida el 28 oct 2026, tienda 1.7.0; validada por el dueño el 28 oct 2026). Dos imágenes más (`hero.segunda` y `hero.tercera`), con su texto y una dirección de la tienda. El plan va en `variasImagenes` (`bienvenida_con_imagenes` en funciones.json): un plan que baja las quita en el re-horneado, sin publicar.
- Como comerciante, quiero mostrar dos o tres imágenes en la bienvenida, cada una con su enlace.
- **Referencia:** Tiendanube, «banners, carruseles o videos».
- **CA1.** Hasta 3 imágenes que se deslizan con el dedo, con CSS y sin librería.
- **CA2 ❌.** La portada sigue por debajo de 50 KB y de 2,5 s (TIENDA §1.3): solo la primera imagen carga de entrada. Video no: rompe el presupuesto.
- **Work items:** WI-P4.2.1 `[código]` · WI-P4.2.2 `[prueba]` presupuesto y CLS a 360 px.

#### HU-P4.3 · Las redes sociales de la tienda
- **Capa:** paquete y horno · **Prioridad:** Should · **Puntos:** 1 · **Sprint:** PF1 · **Plan:** todos · **Estado:** Terminada (construida el 27 oct 2026; validada por el dueño el 28 oct 2026)
- Como comerciante, quiero que mi tienda lleve a mi Instagram, TikTok y Facebook.
- **CA1.** En «Ajustes › Contacto», los enlaces de Instagram, TikTok y Facebook; el pie de la tienda los muestra con su ícono.
- **CA2 ❌.** Solo direcciones de esas redes (`instagram.com`, `tiktok.com`, `facebook.com`); ningún script de ellas en la página.
- **Work items:** WI-P4.3.1 `[código]` el esquema de `contacto` (versión nueva con su traductor) y el pie · WI-P4.3.2 `[prueba]`.

#### HU-P4.4 · Título y descripción para buscadores
- **Capa:** paquete, horno y panel · **Prioridad:** Could · **Puntos:** 2 · **Sprint:** PF3 · **Plan:** todos · **Estado:** Construida (28 oct 2026, tienda 1.7.0), por validar. El del producto va en `producto.seo`, que ya existía; el de la página, en la migración 0025. **Cambió al construir:** sin texto propio, una página sigue sin descripción, como hoy (bitácora tienda3 70). Quien no lo manda (un asistente, la carga por lotes) no lo borra.
- Como comerciante, quiero decidir cómo aparece mi producto en Google.
- **Referencia:** Tiendanube, «personalización del SEO».
- **CA1.** Producto y página pueden tener título y descripción para buscadores; sin ellos, salen de su nombre y su descripción, como hoy.
- **CA2.** El panel muestra cómo se vería en Google y avisa si es muy largo.
- **Work items:** WI-P4.4.1 `[código]` · WI-P4.4.2 `[prueba]`.

---

## EP5 · Acompañar al comerciante

#### HU-P5.1 · La ayuda de TiendaPro
- **Capa:** sitio · **Prioridad:** Must · **Puntos:** 3 · **Sprint:** PF1 · **Plan:** todos · **Estado:** Construida (27 oct 2026, tienda 1.5.0), por validar. WhatsApp de soporte 300 861 0480 (dueño, 26 oct 2026), en `WHATSAPP_DE_SOPORTE`.
- Como comerciante, quiero una guía corta para cada cosa que tengo que hacer por primera vez.
- **Referencia:** Tiendanube, más de 600 tutoriales y soporte por WhatsApp.
- **CA1.** En `tiendapro.co/ayuda/`, guías de una pantalla: tu primer producto, publicar, conectar Bold, conectar tu dominio (con el caso de Hostinger y el «www»), cargar por lotes, atender un pedido contra entrega y verificar en Google.
- **CA2.** Las pantallas del panel que lo necesitan enlazan a su guía.
- **CA3.** El pie de la ayuda lleva el WhatsApp de soporte de TiendaPro (lo da el dueño).
- **Cuida:** textos cálidos y sin técnica; las guías salen de los runbooks, sin repetir lo técnico.
- **Work items:** WI-P5.1.1 `[doc]` las siete guías · WI-P5.1.2 `[código]` las páginas en `tiendapro-sitio` y su sitemap · WI-P5.1.3 `[código]` los enlaces del panel · WI-P5.1.4 `[dueño]` el WhatsApp de soporte.

#### HU-P5.2 · La calculadora de precios
- **Capa:** sitio · **Prioridad:** Could · **Puntos:** 2 · **Sprint:** PF3 · **Plan:** gratis, en `tiendapro.co` · **Estado:** Terminada (construida el 28 oct 2026, tienda 1.7.0; validada por el dueño el 28 oct 2026). En `tiendapro.co/calculadora/`. Las tarifas de Bold viven en `@ed1/tienda-schema/comisiones`, la misma tabla de la pantalla de cobro, con la fecha del Estudio (4 oct 2026). La ganancia es un porcentaje sobre el costo; el precio sube a los siguientes $100 y la comisión lleva su IVA (19 %).
- Como persona que vende, quiero saber a cuánto vender para que me quede lo que espero, con la comisión de Bold y el envío.
- **Referencia:** Tiendanube, herramientas gratis (calculadora de precios y de descuentos). Estudio: las herramientas gratis como entrada al producto.
- **CA1.** Costo, margen deseado, forma de pago y envío dan el precio de venta y lo que queda en el bolsillo.
- **CA2 ❌.** Corre en el navegador, sin guardar nada; las tarifas de Bold llevan la fecha en que se consultaron.
- **Work items:** WI-P5.2.1 `[código]` · WI-P5.2.2 `[prueba]` los cálculos con `@ed1/dinero`.

---

## EP6 · Vender productos digitales

Pedido del dueño del 26 oct 2026: guías, plantillas, cursos grabados, música o fotos que se entregan como un archivo. Antes estaba con disparador (contraste §5.1).

**Cómo encaja en la arquitectura.** El archivo vive en un almacén **privado** de R2, aparte del de las fotos (que es público). Nunca se hornea ni tiene una dirección pública: se entrega con un enlace temporal que firma la API después de que el pago está **verificado** (aviso firmado de Bold o conciliación, o el comerciante confirma la transferencia o el efectivo). Bajar el archivo no es una visita a una página: pasa por la API, que cuenta las descargas. El plan gratuito de R2 tiene 10 GB para toda la cuenta, así que cada archivo tiene tope y la cuenta de la tienda también.

#### HU-P6.1 · El producto digital y su archivo
- **Capa:** paquete, API y panel · **Prioridad:** Should · **Puntos:** 5 · **Sprint:** PF2 · **Plan:** Pro e IA Pro · **Estado:** Construida (28 oct 2026, tienda 1.6.0), por validar. Buckets creados por el dueño el 28 oct 2026 (WI-P6.1.4). **Cambió al construir:** el archivo sube en una sola solicitud, directo a R2 y sin pasar por la memoria del Worker; R2 verifica la huella que calcula el panel. Topes del dueño: 50 MB y 1 GB; sin respaldo.
- Como comerciante, quiero vender un archivo, para no tener que mandarlo a mano a cada comprador.
- **CA1.** Un producto puede ser **digital**: lleva un archivo (PDF, ZIP, MP3, MP4, JPG o PNG) de hasta 50 MB, sin existencias ni peso; puede tener variantes (por ejemplo, «PDF» y «PDF + audio»), cada una con su archivo.
- **CA2.** El archivo se sube desde el panel a la carpeta de la tienda en el almacén privado; el panel dice cuánto espacio lleva la tienda (tope de 1 GB por tienda).
- **CA3 ❌.** El archivo nunca está en una dirección pública, ni en el horno, ni en «Descargar todo» (que lleva solo su nombre y su huella). Un tipo distinto o un archivo más grande se rechaza antes de subir. Una tienda Gratis no puede marcar un producto como digital.
- **Cuida:** el freno de R2 (`freno-r2.ts`): las subidas cuentan para el presupuesto de la cuenta.
- **Work items:** WI-P6.1.1 `[código]` migración (`producto.tipo`, `archivo_digital`) y `tienda-schema` · WI-P6.1.2 `[código]` subir por partes al almacén privado · WI-P6.1.3 `[prueba]` tipos, tope, Gratis rechazada y que no salga en el horno · WI-P6.1.4 `[dueño]` crear el bucket privado `tienda-digitales` (y el de staging) en R2: el token del despliegue no tiene permiso de R2.

#### HU-P6.2 · La entrega después del pago
- **Capa:** API, vitrina y correo · **Prioridad:** Should · **Puntos:** 5 · **Sprint:** PF2 · **Plan:** Pro e IA Pro · **Estado:** Construida (28 oct 2026, tienda 1.6.0), por validar. Pendiente: «reenviar» desde el panel y el enlace en el correo, que necesita la dirección de la tienda (WI-P6.2.5).
- Como comprador, quiero descargar lo que compré apenas pague, y volver a bajarlo si lo pierdo.
- **CA1.** Con el pago verificado, el seguimiento del pedido (HU-T6.3) muestra «Descargar», y el correo del pedido (si dejó su correo) lleva el mismo enlace.
- **CA2.** El enlace vale 7 días y 5 descargas; el comprador puede pedir uno nuevo desde el seguimiento, y el comerciante puede reenviarlo desde el pedido.
- **CA3 ❌.** Sin pago verificado no hay enlace: nunca se cree lo que dice el navegador al volver de Bold (TIENDA §9). Un enlace vencido, gastado o de otro pedido responde «este enlace ya no sirve» sin decir por qué. La descarga queda en el registro del pedido.
- **Work items:** WI-P6.2.1 `[código]` el enlace firmado y su cuenta · WI-P6.2.2 `[código]` la descarga desde el almacén privado · WI-P6.2.3 `[código]` el seguimiento y el correo · WI-P6.2.4 `[prueba]` sin pago, vencido, gastado, de otro pedido y con un cobro de prueba de Bold.

#### HU-P6.3 · La ficha y lo legal de lo digital
- **Capa:** horno y legal · **Prioridad:** Should · **Puntos:** 2 · **Sprint:** PF2 · **Plan:** Pro e IA Pro · **Estado:** Construida (28 oct 2026, tienda 1.6.0), por validar. **Cambió al construir:** la excepción del retracto va en la política de retracto (plantillas v6), que el comprador ya acepta con los términos; la casilla aparte queda para la revisión legal (HU-T7.4).
- Como comprador, quiero saber antes de pagar que es un archivo, cómo lo recibo y si puedo retractarme.
- **CA1.** La ficha dice «Producto digital: lo descargas apenas pagues» y el tipo y tamaño del archivo; el carrito no pide dirección ni cobra envío si todo es digital.
- **CA2.** Los términos de la tienda explican el retracto de lo digital según las excepciones de la Ley 1480 art. 47, y el carrito pide aceptarlo antes de pagar, con una casilla sin marcar. El texto exacto queda para la revisión legal (HU-T7.4): mientras tanto, la plantilla dice solo lo que la ley dice.
- **CA3 ❌.** La compuerta no publica un producto digital sin su archivo; contraentrega no se ofrece para un carrito solo digital.
- **Work items:** WI-P6.3.1 `[código]` la ficha y el carrito · WI-P6.3.2 `[doc]` la plantilla legal (HU-T7.1) · WI-P6.3.3 `[prueba]` compuerta y carrito.
