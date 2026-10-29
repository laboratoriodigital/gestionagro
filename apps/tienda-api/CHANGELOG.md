# Registro de cambios de la Tienda 3.0

Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/). Versión semántica propia de la Tienda en `apps/tienda-api/package.json`, con etiquetas `tienda-vX.Y.Z` (HU-T0.2, PLATAFORMA §6.3). En `0.0.0` no se publica: vive en staging hasta que la `0.1.0` la lleve a producción sin tiendas (HU-T2.9). Lo de la Tienda anterior a este archivo está en el CHANGELOG de la raíz (versión 0.5.0 de CultivoPro).

## [Sin publicar]

## [1.7.1] - 2026-10-28

Lo que pidió la validación del sprint PF3.

### Corregido
- **Un pedido «Por pagar» ya no queda sin salida:** tiene «Preguntarle a Bold», por si el pago entró y el aviso no llegó. Si el pago venció sin pagarse, el pedido se puede cancelar; antes se le pregunta a Bold una última vez.
- **Un pago que llega tarde a un pedido cancelado** queda a revisar, sin descontar el inventario, y el pedido dice que hay que devolver la plata desde Bold.
- «Descargar estos pedidos» se ve como botón, igual que los de al lado.

### Agregado
- **La lista de productos marca la oferta programada:** «En oferta · 20 %» mientras rige, y «Oferta desde el 5 de nov» cuando viene.

## [1.7.0] - 2026-10-28

Sprint PF3 del perfeccionamiento: una vitrina más completa y más control.

### Agregado
- **Temas listos:** en «Ajustes › Apariencia», ocho estilos completos con nombre (Panadería, Moda, Belleza, Campo, Tecnología, Artesanías, Hogar y Minimal). Uno llena el color, la tinta, el estilo, la portada y la forma de las fotos, y cada cosa se puede cambiar después.
- **Varias imágenes en la bienvenida** (Pro e IA Pro): hasta dos imágenes más, que se deslizan con el dedo, cada una con su texto y a dónde lleva. Tu portada sigue cargando igual de rápido: las de más cargan cuando se van a ver.
- **Cómo sale en Google:** cada producto y cada página pueden tener su título y su descripción para buscadores, con una muestra de cómo se vería y un aviso si es muy largo. Sin escribirlos, todo queda como antes.
- **Ofertas programadas** (Pro e IA Pro): un porcentaje menos en un producto, del primer día al último. Empieza y termina sola, sin volver a publicar, con el precio de siempre tachado al lado. Fuera de sus días nunca se cobra.
- **Un texto del comprador** (Pro e IA Pro): un producto puede pedir «Nombre para grabar» o «Mensaje de la tarjeta», con su largo y si es obligatorio. Llega en el WhatsApp del pedido y en los datos de entrega, guardado con el mismo cuidado que ellos.
- **El rol «Despachos»:** invita a alguien que solo vea y mueva los pedidos, lleve los recaudos y mire el inventario, sin tocar precios, productos ni ajustes.
- **La calculadora de precios** en tiendapro.co/calculadora: a cuánto vender para que te quede lo que esperas, con la comisión de Bold y el envío. Gratis, sin registrarte y sin guardar nada.

## [1.6.0] - 2026-10-28

Sprint PF2 del perfeccionamiento: productos digitales y el control del día a día.

### Agregado
- **Productos digitales** (Pro e IA Pro): un producto puede ser digital, con un archivo por combinación (PDF, ZIP, MP3, MP4, JPG o PNG, de hasta 50 MB; hasta 1 GB por tienda). Tu cliente lo descarga desde el seguimiento de su pedido apenas su pago queda confirmado, con un enlace que vale 7 días y 5 descargas. Un pedido solo de digitales no pide envío ni va contra entrega. Guarda tus originales: estos archivos no entran en «Descargar todo».
- **El cupón en el carrito:** tus clientes ya pueden escribir un cupón en su pedido y ver cuánto descontó. Antes solo servía por los asistentes.
- **Cupones por categoría:** un cupón puede valer solo para algunas categorías; el descuento nunca pasa del valor de esos productos.
- **Por agotarse:** con «Avisarme cuando queden» en «Ajustes › Avisos», el Inicio y el resumen de la mañana te dicen qué combinaciones llegaron a ese número.
- **Pedidos por fecha y por canal**, y «Descargar estos pedidos» en una hoja, sin los datos de los compradores.

### Cambiado
- En la vista previa de tu tienda, el carrito ya muestra las promociones, los cupones y el envío: antes solo sumaba los precios.
- La política de retracto de cada tienda explica el de los productos digitales.

## [1.5.0] - 2026-10-27

Sprint PF1 del perfeccionamiento: vender más y perder menos ventas.

### Agregado
- **Compras sin terminar** (Pro e IA Pro): en el carrito, quien compra puede dejar su WhatsApp o su correo y marcar «Recordarme mi compra si no la termino», una casilla que nunca viene marcada. Si en 2 horas no hace el pedido, sale en «Pedidos › Compras sin terminar» con lo que llevaba; le escribes desde tu WhatsApp con el mensaje listo y marcas «Ya le escribí». El dato va cifrado y se borra a los 30 días o cuando hace el pedido.
- **Promociones por cantidad** (en cada producto): «lleva 3, paga 2» o «10 % menos desde 2 unidades», con fecha de fin si quieres. La ficha y la tarjeta la anuncian; el carrito la aplica antes que el cupón.
- **Correos al comprador** cuando su pedido se confirma, se paga, se despacha (con la transportadora y la guía) o se cancela, si dejó su correo.
- **Cambiar varios productos a la vez**: en «Productos › Cambiar varios», sube o baja el precio en un porcentaje o en pesos, activa, archiva, pon o quita una promoción, o manda a la papelera, eligiendo uno por uno o toda una categoría. Antes de aplicar te dice qué cambia, con un ejemplo.
- **Tus redes sociales** en el pie de la tienda: Instagram, TikTok y Facebook, en «Ajustes › Contacto».
- **La ayuda de TiendaPro** en tiendapro.co/ayuda/: siete guías cortas (tu primer producto, publicar, cobrar con Bold, tu dominio, cargar por lotes, contraentrega y Google) y el WhatsApp de soporte. Las pantallas del panel enlazan a su guía.

### Cambiado
- La política de datos de cada tienda dice la nueva finalidad: recordarte una compra sin terminar, solo si lo pides.

## [1.4.1] - 2026-10-26

### Cambiado
- La página de TiendaPro cuenta lo que ya trae cada tienda y no decía: «Avísame por WhatsApp» en lo agotado, subir el catálogo de una vez, volver a la versión anterior al publicar y descargar todo lo tuyo en cualquier plan. Suma dos preguntas: si TiendaPro cobra comisión por tus ventas (no) y si la tienda abre bien en cualquier teléfono.

## [1.4.0] - 2026-10-26

Quien espera un producto agotado se lo dice a la tienda por WhatsApp, y el comerciante sabe a quién avisarle.

### Agregado
- En la ficha de un producto agotado, «Avísame por WhatsApp» abre el chat de la tienda con el mensaje listo: el producto, la combinación elegida y su enlace. Quien lo envía le deja su número a la tienda en su propio WhatsApp; la tienda sigue sin guardar datos de nadie, solo cuántos esperan. Si la tienda no tiene WhatsApp, el botón solo suma a la cuenta, como antes.
- El resumen diario nombra las combinaciones agotadas que más personas esperan, para avisarles cuando haya.

### Cambiado
- En el inventario, el aviso de quienes esperan dice dónde están sus mensajes: en tu WhatsApp, con «Hola, avísame cuando tengas…».
- En «Ajustes › Medición», el código de Google Search Console explica cómo obtenerlo: agregar la tienda como «Prefijo de URL» y elegir «Etiqueta HTML».

## [1.3.0] - 2026-10-26

El comerciante encuentra su tienda desde el panel, y quien llega a una tienda que todavía no abre ve una página con la cara de TiendaPro.

### Agregado
- El Inicio del panel muestra la dirección de tu tienda en línea, con «Abrir mi tienda» y «Copiar»; si todavía no la publicaste, te lleva a publicarla.

### Cambiado
- Las páginas que ve un visitante cuando una tienda todavía no abre, no existe o está en pausa ahora tienen la cara de TiendaPro. La de una tienda sin publicar dice «Esta tienda abre pronto» y le explica a su dueño cómo publicarla.

## [1.2.2] - 2026-10-24

### Corregido
- Cargar productos por lotes ya no falla cuando un producto de la hoja se llama igual que uno que ya está en tu tienda: el nuevo toma otra dirección («pan-de-bono-2») y el que ya estaba no cambia. Si una parte no se puede cargar, el panel dice cuántas entraron.

## [1.2.1] - 2026-10-24

### Cambiado
- IA Pro ya no promete la factura con tu propio facturador: llega cuando esté lista. El plan y su precio no cambian.

## [1.2.0] - 2026-10-23

El comerciante sin Google entra al panel con un enlace a su correo.

### Agregado
- El panel deja entrar con un enlace al correo, para el comerciante sin Google (HU-C10.2, HU-T13.4): debajo de «Entrar con Google», con la misma política aceptada. El enlace llega desde `avisos@tiendapro.co`.

## [1.1.0] - 2026-10-23

Lo que pidió el dueño después del lanzamiento: la carga por lotes en Pro, IA Pro a COP 49.900 con la factura, lo legal vigente y en palabras sencillas, los errores que llevan a su campo y la baja que se cumple.

### Agregado
- Cargar productos por lotes y subir un respaldo, en Pro e IA Pro (HU-T18.11): en «Más › Cargar productos y respaldos» bajas la plantilla, escribes tus productos en Excel (una fila por talla o color) y los subes de una vez; también sirve la hoja de «Descargar todo». Antes de cargar te dice todo lo que está mal, con su fila, y lo que va a entrar. Los nuevos se crean y los que ya existen solo cambian en lo que trae la hoja. El respaldo de «Descargar todo» vuelve a poner tus productos, colecciones, envíos, cupones, páginas y ajustes, sin borrar nada.

### Cambiado
- IA Pro cuesta COP 49.900 al mes y es el plan con la factura en tu propio facturador (HU-T18.9). Lo que ya pagaste no cambia.
- Los términos del servicio y la política de datos de tu cuenta ya están vigentes, en palabras más sencillas (HU-T18.10). Como cambiaron, el panel te los muestra otra vez para aceptarlos.
- Cuando un formulario tiene errores, el panel te lleva al primer campo que hay que corregir (HU-T18.12).
- La hoja de productos de «Descargar todo» trae la descripción y el nombre de las opciones.
- En la página de TiendaPro, los clientes piden «pan de bonos».

### Corregido
- Una tienda dada de baja ya no se puede cambiar ni volver a publicar (HU-T18.13): al entrar, el panel dice que está dada de baja y hasta cuándo puedes descargar lo suyo.

## [1.0.0] - 2026-10-22

TiendaPro abre al público. Cualquier comerciante entra a `tiendapro.co`, abre su tienda gratis en `app.tiendapro.co` y la tiene en `<nombre>.mitiendapro.co`, con los planes Gratis, Pro e IA Pro. Lo que hasta hoy estaba solo en staging (abrir una tienda, pagar el plan y conectar un dominio propio) queda abierto en producción.

### Agregado
- TiendaPro abierta a todos (HU-T18.6): abrir una tienda desde el panel, con la verificación de que es una persona; las tiendas nuevas responden en su dirección de `mitiendapro.co` con su candado desde el primer momento; el plan se paga con Bold; y el dominio propio se conecta desde «Más › Tu dominio».
- El despliegue revisa, sin abrir una tienda, que el alta esté lista y que una dirección nueva de `mitiendapro.co` llegue a la plataforma con su candado. Si algo falta, lo dice y no da el despliegue por bueno.
- La página de TiendaPro en `tiendapro.co` (sprint L2): qué es, cómo te llega un pedido por WhatsApp, lo que incluye, lo que hacen los asistentes de inteligencia artificial, los tres planes con sus precios y las preguntas frecuentes, con «Crear mi tienda gratis» en cada parte. Una tienda de ejemplo que cambia entre panadería, ropa y belleza, y un pedido que avanza en el teléfono al bajar. Abre rápido en cualquier teléfono y no usa programas de terceros.
- Los términos y la política de datos de TiendaPro, publicados en la página.

### Cambiado
- Los términos y la política salen con los datos de quien presta el servicio que hay: lo que falta ya no aparece como «por completar».
- TiendaPro, la marca de la Tienda (sprint L1, D-T15):
  - las tiendas viven en `mitiendapro.co`, como `panaderia.mitiendapro.co`; las direcciones de antes, en `laboratorio-digital.app`, llevan a las nuevas, y los avisos de Bold que ya estaban registrados con ellas siguen llegando;
  - el panel en `app.tiendapro.co`, con la marca TiendaPro, y el asistente del comerciante en `mcp.tiendapro.co`;
  - los correos de las tiendas salen como «Tu tienda vía TiendaPro»; en producción, desde `tiendapro.co` con Resend, y la respuesta le llega al comercio. Si el correo no está listo, se anota como no enviado y no gasta el tope del día;
  - tres planes: Gratis (hasta 10 productos, pedidos por WhatsApp, una persona y el sello «Hecha con TiendaPro» al pie), Pro (COP 24.900 al mes: cobro en línea, dominio propio sin sello, factura, hasta 3 personas y los asistentes de tus clientes pueden prepararles el pedido) e IA Pro (COP 49.000 al mes: lo de Pro, tu asistente gestiona tu tienda y el equipo sin límite). Quien tenía Entrada o Intermedio pasa a Pro y quien tenía Alto a IA Pro, con el tiempo que ya pagó;
  - «Reportar esta tienda» escribe a `abuse@tiendapro.co`.
- Los asistentes con inteligencia artificial pueden comprar en tu tienda, sin pagar por nadie (sprint T18, M7):
  - tu tienda explica a los asistentes cómo se compra en ella y describe lo que pueden pedirle;
  - con «¿Los asistentes pueden preparar pedidos en tu tienda?» encendido en «Ajustes › Agentes», el asistente de tu cliente busca productos, cotiza y le deja listo el pedido;
  - tu cliente abre su enlace, revisa el pedido, acepta tus términos y elige cómo pagar: por WhatsApp o en línea. Hasta entonces nada se aparta ni se cobra;
  - lo que nadie confirma en 48 horas se cancela solo, y en el panel esos pedidos dicen «Espera a tu cliente»;
  - en el plan Alto, tu propio asistente puede ver tus pedidos por despachar, cambiar su estado y ajustar tu inventario, con tu permiso y sin ver los datos de tus compradores. Se activa cuando la Tienda quede abierta a todos.
- La vitrina con más vida (sprint T17b, lo que pidió la validación del 20 oct 2026):
  - la bienvenida de la portada, con tu título, tu texto y tu imagen, en «Ajustes › Apariencia»;
  - tu logo en la franja y tu ícono en la pestaña y al guardar la tienda en el teléfono, en «Ajustes › Identidad»;
  - marca un producto como destacado, para que vaya primero, o como nuevo, para que lleve su etiqueta;
  - cada foto puede mostrarse con una combinación: al elegir «Azul», se ve la foto del azul;
  - las categorías arriba de los productos, para ver solo una;
  - «Ordenar por»: recomendado, lo más nuevo, nombre de la A a la Z y precio en los dos sentidos;
  - «Compartir» en cada producto, con el menú del teléfono o por WhatsApp.
- Lo que pidió la validación del 20 oct 2026:
  - el precio de antes sale tachado en la ficha y en la tarjeta;
  - la ficha dice «Quedan 2» y la tarjeta «Últimas unidades» cuando quedan pocas;
  - con varias fotos, la tarjeta deja pasarlas con el dedo y la ficha trae miniaturas para elegir;
  - en «Más › Equipo», quién tiene acceso, con «Quitar», y el tope de personas del plan;
  - «Publicar» queda arriba en cada pantalla del panel.
- La Tienda en el reporte semanal (HU-T14.7): el issue de cada lunes dice cuántas tiendas hay y venden, los cobros reales, el pago de los planes, el soporte que anotó el dueño y lo gratis de R2 que se ha usado, con el umbral de cada métrica. Solo conteos: nada de un comprador. El flujo «anotar-soporte-tienda» anota cada atención con sus minutos.
- Tus métricas frente a tus pedidos (HU-T14.6): cada semana, el Inicio del panel compara los pedidos y pagos de tu tienda con lo que contó su medición, y explica la diferencia en los dos sentidos. Tus ventas siempre salen de tus pedidos. El flujo «cuadrar-tienda» lo calcula al momento.
- Google Analytics y el píxel de Meta, con permiso del comprador (HU-T14.4): con el código en «Ajustes › Medición», la tienda pide permiso antes de medir, con «No acepto» y «Acepto» iguales, y nada de Google ni de Meta carga hasta que la persona acepta. Cada compra lleva el código del pedido. El píxel de Meta solo se ofrece con tu propio dominio.
- Las páginas propias (HU-T10.2): en «Más › Páginas» el comercio escribe «Quiénes somos», «Cómo comprar» o lo que quiera, con negrita, listas y enlaces. Cada una sale en su tienda al publicar, con su enlace al pie de cada página. Una página no puede tomar una dirección que la tienda ya usa.
- Ver la tienda antes de publicar (HU-T8.6): en «Publicar y versiones», «Ver antes de publicar» da un enlace que muestra cómo quedará la tienda con lo que tienes ahora en el panel, sin cambiar lo que ven tus clientes. Dura un día, no aparece en los buscadores y ahí no se puede pedir ni pagar. Si a la tienda le falta algo para publicar, también lo dice.
- El plan de la tienda (HU-T13.5): en «Más › Tu plan» el comercio ve su plan, hasta cuándo le dura y lo que pasa si vence, y paga un plan por 1, 3, 6 o 12 meses, con el total y lo que sale al mes, con Bold. Lo que cada plan permite se cumple: con el gratuito, la tienda muestra hasta 15 productos y recibe los pedidos por WhatsApp, sin cobro en línea, contraentrega, dominio propio ni feeds. Si el plan vence, pasados los 7 días de gracia, la tienda sigue vendiendo por WhatsApp, su dominio propio lleva a su dirección de laboratorio-digital.app y lo que pasa del límite se oculta; nada se borra, y al pagar y publicar vuelve. Por ahora solo en staging, con el Bold de pruebas.
- Abrir una tienda desde el panel (HU-T13.4): quien entra sin tienda escribe el nombre y la dirección, que dice al momento si está libre, confirma que es una persona y la tienda queda lista para llenarla, con pedidos por WhatsApp y pago a convenir o por transferencia. Por ahora solo en staging.
- Dar de baja la tienda (HU-T13.7): en «Más › Dar de baja la tienda» el propietario la saca de internet, después de ofrecerle descargar todo. Tiene 30 días para descargar lo suyo; ese día se borran las llaves de los datos de sus compradores y las copias de seguridad de la tienda. La política de datos y los términos del comercio dicen el plazo real: 60 días como máximo.
- Suspender una tienda con un clic (HU-T13.6): el flujo «suspender-tienda» la deja fuera del aire con una página neutra, sin tocar a las demás, y su motivo queda en el registro; con el mismo flujo se levanta. Cada día se revisa si algún dominio que una tienda dejó todavía apunta aquí, y se avisa.
- La medición propia de la tienda (HU-T14.1): la tienda cuenta cuántas veces se ve un producto, se agrega al pedido, se empieza un pedido, se abre el pago y se confirma, sin cookies ni datos de quien visita. Es la base de lo que el tablero dirá de las visitas.
- Tus productos en Google, Meta y los asistentes de compra (HU-T14.5): en «Ajustes › Agentes» se encienden los feeds, y la tienda los mantiene al día con cada publicación y con cada cambio de existencias. La pantalla dice la dirección de cada uno para pegarla en Google Merchant Center o en Meta, y qué productos quedaron fuera porque les falta la foto o el precio.
- Tu dominio (HU-T13.1 a HU-T13.3): en «Más › Tu dominio» quien administra la tienda conecta su propio dominio, como www.mitienda.co. La pantalla dice los tres registros que crea en su proveedor, con un botón para copiarlos, y se actualiza sola hasta decir «Conectado». El candado (HTTPS) está listo antes de la primera visita. Conectado, puede volverlo la dirección principal: la de la plataforma lleva a él y la tienda se prepara otra vez con su dominio. La dirección sin «www» se conecta si su proveedor lo permite; si no, la pantalla explica cómo redirigirla. El dominio sigue siendo del comercio, en su proveedor. Necesita que el dueño active Cloudflare for SaaS (`docs/runbooks/tienda-conectar-un-dominio.md`); mientras tanto, la pantalla dice que todavía no está disponible.
- Los runbooks de la Tienda (HU-T17.5): suspender una tienda, conectar un dominio y agregar un shard, y una prueba que falla si un runbook nombra algo que no existe.
- Rotar la llave maestra (HU-T17.6): `generar-secretos.ts --rotar-kek` crea la siguiente con su copia fuera de línea, y el despliegue vuelve a envolver con ella las llaves de todas las tiendas, sin tocar los datos cifrados. La vieja se borra solo cuando ya nada la usa y la nueva abre todo; si se quita antes de tiempo, el despliegue lo dice y no borra nada. Los pasos están en `docs/runbooks/tienda-rotar-la-kek.md`.
- Los términos del comercio (HU-T7.2): antes de publicar por primera vez, el propietario lee y acepta los términos de la plataforma y el acuerdo de custodia de los datos de sus compradores. Queda dicho quién aceptó, cuándo y qué texto; si el texto cambia, se vuelve a aceptar antes de publicar.
- Las llaves de Bold de cada tienda (HU-T11.2): en «Más → Cobro en línea» el propietario pega sus llaves de pruebas y de producción, recién entrado. Se comprueban con Bold antes de guardarlas, se guardan cifradas y nunca se vuelven a mostrar; la pantalla dice las comisiones de Bold y la dirección de avisos que va en su panel.
- El cobro de prueba guiado (HU-T11.3): con las llaves de pruebas, la tienda se publica con una franja «en pruebas» en cada página y se hace un pago de prueba. Solo después de un pago de prueba aprobado se pasa a cobrar de verdad, y el cobro usa siempre el ambiente de la versión publicada: nunca se cobra de verdad con la franja a la vista. Los pasos están en `docs/runbooks/tienda-cobro-de-prueba.md`.
- Los links de pago (HU-T11.8): en un pedido por pagar, «Cobrar con un link» crea un link de Bold por el total, con su vencimiento, para mandarlo por WhatsApp. Cuando Bold avisa, el pedido queda pagado como con el botón; un link vencido se cierra solo y el pedido vuelve a «a convenir».
- Restaurar una tienda (HU-T17.4): una tienda se restaura desde su respaldo semanal sin pisar lo que ya existe, y el flujo «simulacro-restauracion-tienda» lo prueba en staging en una base aparte que se borra al terminar. Los pasos están en `docs/runbooks/tienda-restaurar.md`.
- La vitrina por anillos (HU-T4.6): una versión nueva del código de la vitrina re-hornea primero las tiendas del primer anillo, y las demás 24 horas después si nada falló. Las tiendas horneadas con una versión anterior la siguen viendo 90 días. Volver atrás está en `docs/runbooks/tienda-volver-atras-el-codigo.md`.
- Las fotos de la carga (HU-T12.3): al cargar una tienda desde un archivo, las fotos de cada producto se suben con sus tamaños, como desde el panel; si falta alguna, la carga lo dice y termina con error.
- Los umbrales de validación (HU-T0.3): `content/tienda/validacion.json` propone qué se mide, cada cuánto y desde dónde, antes de la primera tienda real.
- La prueba de carga de staging (HU-T11.10): el flujo «carga-staging-tienda» pide las páginas de un comercio de prueba muchas veces a la vez y revisa que ninguna falle, que respondan rápido y que el límite por visitante responda.
- El permiso de Gmail (HU-T14.3): `scripts/correo/permiso-de-gmail.ts` guarda el permiso de enviar correos de la cuenta en el ambiente de GitHub, sin mostrarlo. Los pasos están en `docs/runbooks/correo-de-gmail.md`.
- Las versiones viejas del sitio se borran solas de R2 (bitácora tienda3 28). Se borran las de más de 90 días que no son la que ve la tienda ni una de las 5 anteriores. Cada lunes se borran los archivos que ya no usa ninguna tienda; si no se sabe con certeza, no se borra nada. En «Publicar y versiones», una versión borrada dice que ya no se puede volver a ella.
- El freno de R2 (bitácora tienda3 27): cada hora la Tienda mide cuánto de lo gratis de R2 usó la cuenta. Al 75 % avisa por Telegram; al 90 % del espacio o de las escrituras apaga publicar y subir fotos, para que no empiece a cobrar a la tarjeta, y los vuelve a encender solo por debajo del 80 %. La venta y los cobros nunca se apagan. Necesita el token de métricas (`CF_METRICAS_TOKEN`), el mismo del vigía.
- `ks:tienda-fotos` pausa la subida de fotos; las que ya están siguen en la tienda.
- Los correos de la tienda (HU-T14.3): cada mañana, a la hora que el comercio eligió en Avisos, un resumen con lo que hay que hacer hoy, las solicitudes por vencer y lo vendido ayer; al pagar en línea, el acuse al comprador que dejó su correo, con el enlace para seguir su pedido; y el resultado del cobro de prueba. Salen por Gmail con el nombre de la tienda y las respuestas le llegan al comercio. Un correo que no salió queda anotado y nunca cuenta como enviado. Mientras no esté la cuenta de Gmail, no sale ninguno. `ks:tienda-correos` los apaga.
- Volver de Bold sin perder el pedido (HU-T11.9): antes de pagar, la tienda muestra el enlace del pedido con «Copiar el enlace» y «Mandármelo por WhatsApp». Al volver de Bold, si el pago pasó, lleva al pedido; si no pasó, los productos siguen en el carrito para intentarlo otra vez. Quien vuelve desde otro navegador ve cómo encontrar su pedido, sin un error.
- Pagado sin existencias (HU-T11.7): si alguien paga tarde y ya no hay unidades, el pedido aparece primero en «Necesitan atención», con los días que quedan de los 15 para reponer o devolver el dinero. Al despacharlo, las unidades salen del inventario; si todavía no alcanzan, el panel dice cuál falta y no lo despacha. Ningún pago rechazado, vencido o por otro monto se ve como pagado.
- Conciliar con Bold (HU-T11.6): si el aviso de Bold no llega, la página del pago le pregunta a Bold, como mucho cada 20 segundos, y cada hora se revisan los pagos que siguen esperando, hasta 20 por tienda. Un pago aprobado queda pagado aunque la persona haya cerrado la página. A las 24 horas sin noticias el cobro vence, pero el pedido sigue por pagar por si el aviso llega tarde. Lo que diga la dirección de vuelta de Bold nunca aprueba un pago.
- Los avisos de Bold (HU-T11.5): cuando Bold aprueba un pago, el pedido queda pagado solo y el inventario baja una vez, aunque el aviso llegue repetido. Un aviso sin la firma de Bold, o con el cuerpo cambiado, no mueve nada. Si se aprobó otro monto, el pedido queda por revisar; si se aprobó tarde y ya no había unidades, queda pagado y arriba, para reponer o devolver; si se rechazó, las unidades vuelven a estar disponibles; si se anuló, queda reembolsado. La dirección que se registra en Bold está en `docs/runbooks/tienda-avisos-de-bold.md`.
- Pagar en línea con Bold (HU-T11.4): en el carrito, «En línea» pide el nombre y el celular de quien recibe y abre el pago de Bold sin salir de la tienda. Mientras la persona paga, las unidades quedan apartadas 15 minutos; si dos personas van por la última, la segunda lo sabe antes de pagar y su intento no deja pedido ni gasta número. Con `ks:tienda-cobros` apagado no se cobra en línea y queda el pedido por WhatsApp. Ninguna tienda lo ofrece todavía: falta conectar las llaves (HU-T11.2) y el cobro de prueba (HU-T11.3).
- El respaldo semanal de cada tienda (HU-T17.3): cada lunes la tienda queda guardada en el almacén de la celda, con todos sus pedidos y los datos de los compradores cifrados como están en la base. Se guardan las 4 últimas semanas y un respaldo por cada uno de los 3 últimos meses. Si un respaldo no cuadra con la base, avisa por Telegram y no queda como bueno.
- Las solicitudes en el panel (HU-T9.7): en «Pedidos → Solicitudes» la que venció sin respuesta va arriba y en rojo, y se avisa a 3 días y el día que vence. El retracto cuenta los 15 días del reembolso. Responder ofrece mandar la respuesta por donde la persona dejó su contacto, y una solicitud no se cierra sin respuesta.
- El tablero de Inicio (HU-T14.2): ventas, pedidos, ticket y tasa de cierre de hoy y del mes, contra el mes anterior a la misma altura del calendario; lo pendiente, con lo urgente arriba; y el margen de la contraentrega.
- Descargar todo (HU-T10.7): en «Más → Descargar todo» la tienda baja en `tienda-export/1`, el mismo formato de la carga, y en hojas para Excel. Los datos de los compradores van aparte, solo para el propietario recién entrado, y queda registrado.
- Datos de un comprador (HU-T7.3): en «Más → Datos de un comprador» el propietario busca por el celular y descarga, corrige o borra sus datos; el pedido queda como prueba de la venta. En «Datos legales» se elige cuántos meses se guardan los contactos (de 12 a 60, 24 si no se dice), y la política de privacidad dice ese plazo.
- La tienda llena (HU-T3.7): el flujo «sembrar-volumen-tienda» llena a Comercio Ensayo Uno en staging con 2.000 productos y 300 pedidos para revisar la vitrina y el panel, con su recorrido en `docs/runbooks/tienda-revision-con-la-tienda-llena.md`.
- Despachar un pedido (HU-T9.4): se anota la transportadora y la guía, y el comprador las ve en su seguimiento. Un pedido contra entrega no sale sin guía, y al salir queda la plata por recaudar, con la comisión y el flete si se saben.
- Los recaudos de la contraentrega (HU-T9.5): entregar es recaudar; devolver pregunta si las unidades volvieron y cuánto costó el flete de vuelta; un envío perdido queda aparte. En «Pedidos → Recaudos» se ve lo pendiente, con sus días, y se liquidan varios a la vez con el número de la liquidación.
- Más sobre cada pedido (HU-T9.6): anotar uno que llegó por teléfono, dejarle notas, mandar un enlace de seguimiento nuevo (el anterior deja de servir) y cancelarlo preguntando si las unidades vuelven al inventario.
- Envíos y cupones (HU-T10.1): en «Más → Envíos y cupones» se crean los envíos con su precio, sus ciudades y sus días, y los cupones con su tope de usos. Si un envío tarda más de 30 días, la tienda lo dice. Cada cupón dice cuántas veces se usó y si se agotó; uno que se agota mientras alguien paga no le hace fallar el pago.
- Publicar y volver atrás (HU-T10.4): en «Más → Publicar y versiones» se publica desde el panel, y si algo falta se dice todo de una vez, con dónde se arregla. Cada versión dice cuándo y quién la publicó; «Volver a la versión» pone la tienda como estaba en segundos, sin tocar los pedidos ni el inventario.
- El equipo (HU-T10.5): quien administra la tienda invita a un colaborador con un enlace por WhatsApp. El colaborador atiende pedidos, productos e inventario, pero no cambia el cobro, el modo de pedido, el equipo ni el plan, aunque lo intente por fuera del panel.
- El inventario con su libro (HU-T8.5): en «Productos → Inventario» se ve cuántas hay de cada combinación, cuántas están apartadas por pagos en curso y cuántas personas esperan una agotada. Cada combinación cuenta por qué cambió cada número. Se puede ajustar (entraron o salieron) o contar (cuántas hay de verdad), sin bajar nunca de lo apartado. «Ya les avisé» marca que se avisó a quienes esperaban.
- Agotar o reponer se ve en la tienda sin publicar (HU-T4.5): cuando una combinación se agota o vuelve a haber, la tienda publicada se actualiza sola con las existencias de ahora, y nada más cambia.
- La bandeja de pedidos (HU-T9.1): en «Pedidos» se ven de a 50, del más nuevo al más viejo, con lo que necesita atención arriba. Los filtros por estado, forma de pago y número funcionan sin señal sobre lo que ya llegó. El nombre y el celular del comprador salen tapados.
- Ver los datos de entrega (HU-T9.2): «Ver datos de entrega» muestra el nombre, el celular y la dirección del comprador, y deja dicho en el pedido y en el registro quién los vio.
- Confirmar un pedido (HU-T9.3): «Confirmar por WhatsApp» arma el mensaje para el comprador con lo que pidió, el total, la dirección y, si paga por transferencia, los datos de la cuenta. Confirmar descuenta el inventario; si una combinación no alcanza, lo dice y no confirma.
- Los ajustes de la tienda (HU-T10.3): en «Más → Ajustes» se configura la tienda por partes (identidad, contacto, apariencia, venta, cobro, datos legales, medición, buscadores y avisos) y se ve qué falta para publicar. Cambiar el WhatsApp, cómo llegan los pedidos o los datos del cobro pide haber entrado con Google hace menos de 10 minutos; si no, el panel pide volver a entrar sin perder lo escrito. Un WhatsApp nuevo queda sin verificar hasta abrir el chat de prueba y confirmar que es el propio. Lo vacío nunca se guarda como un valor de fábrica.
- Los productos desde el teléfono (HU-T8.2): en «Productos» del panel el comerciante crea un vestido con tallas y colores, y cada combinación lleva su precio, su referencia y sus existencias. Un precio vacío nunca se guarda como 0. Si dos personas editan el mismo producto, la segunda ve que alguien guardó antes y no pisa lo de la otra. Si cambia la dirección de un producto, la anterior lleva a la nueva. Lo borrado queda 30 días en la papelera y se puede restaurar.
- Las colecciones (HU-T8.4): agrupar los productos en colecciones, como «Lino» o «Para regalar», y ordenarlas. Un producto puede estar en varias, y borrar una colección no borra sus productos.
- Las fotos de los productos (HU-T8.3): se comprimen en el teléfono, y solo suben los tamaños que la tienda necesita; la foto original no sale del teléfono. En Safari, que no hace WebP, salen en JPEG. Cada foto necesita una descripción para quien no la puede ver. Se pueden subir en staging y en producción.
- El registro (HU-T10.6): en «Más → Registro» se ve quién cambió qué y qué había antes, en frases y con la hora de Bogotá. Los teléfonos, los correos y las llaves nunca se guardan ahí.
- Las solicitudes con radicado (HU-T6.4): en «Solicitudes» de cada tienda, cualquier persona, con o sin pedido, hace una pregunta, una queja o un reclamo, se retracta de una compra, pide la reversión de un pago o pide ver, corregir o borrar sus datos. Recibe un número de radicado, la fecha y la hora, la fecha límite para la respuesta (en días hábiles de Colombia, con festivos) y un enlace para ver en qué va. Lo que cuenta la persona y cómo responderle se guardan cifrados con la llave de cada tienda. El texto de «Solicitudes» explica cómo hacerla y pasa a la versión 2 de las plantillas legales.
- El panel de la tienda abre la puerta (HU-T8.1 y HU-T3.5): el comerciante entra con Google desde su teléfono y llega a su tienda; si tiene dos, elige cuál. Ve el estado de su tienda, su rol y lo que su plan permite. Si la sesión vence, el panel le pide volver a entrar sin sacarlo de donde estaba, y lo que estaba escribiendo se queda guardado en el teléfono. Una sesión de otra aplicación no abre el panel. Los pedidos y los productos llegan en las próximas versiones.
- Comercio Ensayo Uno y Comercio Ensayo Dos tienen dueño en la cuenta de staging (HU-T2.10): el despliegue de staging crea sus organizaciones y hace propietario al dueño con el correo guardado en un secreto, para probar el panel con una sesión de verdad.
- Las purgas diarias (HU-T17.2): lo que el comercio borró se va a los 30 días, y nunca antes; los productos que ya se vendieron se quedan, porque sus pedidos los nombran. Las descargas del comercio vencerán a los 7 días con una regla del almacén (`docs/runbooks/tienda-ciclo-de-vida.md`).

### Cambiado
- Buscar va debajo de «Productos», encima de las categorías y junto a «Ordenar por», y al escribir muestra lo que coincide, con su foto y su precio. Arriba queda la lupa. La bienvenida de la portada va de lado a lado, con tu título, tu texto y el botón sobre tu foto.
- Buscar y el pedido van en la franja de arriba de cada página; la barra del pedido de abajo ya no está. En la ficha, el precio, el de antes y cuántas quedan van juntos, sin encimarse, y los envíos se ven en el pedido y en «Envíos y devoluciones». En el panel, las colecciones se llaman categorías.

### Corregido
- El asistente de compras solo prepara pedidos cuando la tienda ya se publicó con él encendido: antes, sin publicar, el enlace para confirmar llevaba a una página que no existía (bitácora tienda3 50).
- En staging, una tienda de prueba que no se volvía a publicar en un despliegue quedaba diciendo «Esta tienda todavía no abre»; ahora sigue mostrando su última versión (bitácora tienda3 49).
- Un producto sin opciones ya se puede agregar al pedido, y llega bien al carrito (bitácora tienda3 45).
- El aviso de «Guardado» de un producto sale junto al botón cada vez que guardas, con la hora y un acceso a publicar.
- Los flujos «cuadrar-tienda», «suspender-tienda» y «anotar-soporte-tienda» instalan lo que necesitan antes de correr.
- Vaciar el pedido ya no deja que vuelva un producto cuando la confirmación del total llega tarde (bitácora tienda3 44).
- Abrir una tienda (HU-T13.4): si la verificación de que eres una persona todavía no está lista, no carga o falla, la pantalla lo dice y pide recargar, en vez de quedarse quieta. Las tiendas nuevas de staging ya tienen dirección, sin tocar la de las fotos.
- Los límites por visitante de la tienda (cotizar, pedidos, pagos, avisos de Bold y los demás) ya cuentan por quien visita. Antes no frenaban a nadie, porque la API no veía su dirección (bitácora tienda3 37).
- El simulacro de restauración ya no necesita una base nueva en la cuenta: restaura en una base local del flujo, porque el plan gratuito no admite más bases (bitácora tienda3 38).
- Un pago en línea que no se completó ya no deja el pedido atascado: al volver a pagar, la tienda toma otro código sola y abre el pago. El carrito tiene «Vaciar el pedido». Al publicar sin cambios, el panel explica que la tienda ya está al día y que las llaves de Bold no necesitan publicar (bitácora tienda3 36).
- El pago en línea ya se abre en pantalla completa: antes salía en una ventanita al pie del carrito, porque la tienda no dejaba aplicar el diseño de la página de pago de Bold (bitácora tienda3 35).
- Ya no pueden quedar más cobros abiertos que el tope de la tienda cuando muchas personas pagan a la vez: el tope se cuenta en el mismo paso que aparta las unidades (bitácora tienda3 33).
- Los avisos de Bold tienen un tope de 60 por minuto por visitante, para que nadie pueda gastar el día de D1 de la cuenta mandando avisos falsos (`docs/seguridad/revision-tienda-2026-10-19.md`).
- Una versión nueva de la vitrina ya no deja sin estilos a las tiendas horneadas con la anterior (HU-T4.6).
- El despliegue de staging ya no falla con la tienda llena: la publica solo si cabe en el plan gratuito, y si no, la omite y lo dice (bitácora tienda3 31).
- Dos dependencias del armado con fallas conocidas pasan a su versión corregida.
- El cron de la Tienda ya no escribe en el KV en cada corrida de cada tarea: una que sigue bien se anota una vez por su plazo, y una falla siempre. Eran 120 de las 1.000 escrituras diarias de la cuenta (bitácora tienda3 28).
- Una migración de la Tienda ya no puede gastar el día de D1 de toda la cuenta: cada una se prueba contra la tienda llena, y ninguna puede leer más de 200.000 filas. La 0007 leía 24 millones con Ensayo Uno lleno, y ahora lee 16.000 (bitácora tienda3 29).
- Una tienda grande ya se puede publicar: sube por partes, el panel dice cuántos archivos faltan y la tienda sigue mostrando la versión anterior hasta que termina. Antes, la primera publicación de una tienda de 2.000 productos se cortaba a la mitad, porque una solicitud del plan gratuito no alcanza para 4.200 archivos (bitácora tienda3 30).
- Una publicación que se cortó a mitad ya no deja la tienda sin poder publicar: a los 10 minutos queda fallida, con el motivo, y se puede publicar otra vez. Mientras algo se publica, el panel revisa cada vez más espaciado, hasta una vez por minuto, en vez de cada 3 segundos (bitácora tienda3 27).
- La purga diaria y el respaldo semanal ya no corren todas las tiendas a la misma hora: cada una tiene la suya, para que cada corrida quepa en el tope de consultas del plan gratuito (bitácora tienda3 27).
- Con la tienda llena, el panel ya no gasta el límite diario de D1 de toda la cuenta (bitácora tienda3 26). Antes, una carga de Productos leía 24 millones de filas; ahora cada lista lee menos de 5.000 filas y abrir un producto menos de 300. Lo vigila una prueba con tope de filas por pantalla y por tarea.
- Con la tienda llena, el panel ya no tarda en abrir los productos, las colecciones ni el inventario. Las listas van de a 50, dicen cuántos hay y se buscan por nombre; una colección ya no pierde al guardar los productos que no se veían, y una de más de 99 productos ya se puede guardar. «Anotar un pedido» busca el producto en vez de mostrar todas las combinaciones (bitácora tienda3 21).
- La siembra de la tienda llena le pone a cada producto de Ensayo Uno la foto que ya se subió desde el panel, para que se pueda publicar; sin ninguna foto, lo dice antes de sembrar (bitácora tienda3 22).
- Una tienda con muchos productos ya se puede publicar: la portada muestra los primeros 24 con «Ver los N productos», y la lista de productos y cada colección van de a 48 por página. Antes la portada de una tienda con 2.000 productos pesaba 434 KB y no pasaba la revisión de publicar.
- En «Más → Registro», cambiar una combinación ya no dice «la combinación única» cuando el producto tiene tallas o colores: dice «M / Arena».
- En el seguimiento del pedido, la línea que dice en qué va ahora empieza por «Estado:», para que no se confunda con el resto del acuse.
- En el panel, cambiar de tienda desde «Más» ya no se queda en «Abriendo tu tienda…»: abre el inicio de la tienda elegida sin recargar.
- Volver a desplegar staging sin cambios en la vitrina ya no deja a los comercios de prueba en «Esta tienda todavía no abre»: publicar sin cambios también vuelve a apuntar cada dirección a la versión publicada.
- El despliegue a producción de la Tienda ya no falla al final por buscar la API en una dirección que no existe: la revisión de que la API no se puede abrir desde afuera mira la dirección correcta en los dos ambientes.

## [0.1.0] - 2026-10-14

La Tienda sale a producción sin tiendas: el camino queda probado antes de la primera tienda real. La vitrina está completa en staging, con los dos comercios de prueba.

### Agregado
- La Tienda en producción (HU-T2.9): el panel en panel.laboratorio-digital.app y el despacho en origen.laboratorio-digital.app, que sin tienda dice «Esta dirección no tiene tienda». La prueba de humo mira los dominios públicos y falla si encuentra un comercio de prueba en producción o si el ambiente no es el del despliegue.
- Cargar una tienda entera desde un archivo (HU-T12.2): primero se revisa y se dicen todos los problemas a la vez; después se aplica por partes, sin duplicar nada si se corre dos veces y sin borrar lo que ya estaba.
- La tienda no puede pesar de más ni cargar cosas de terceros (HU-T3.6): cada página se mide en un teléfono lento antes de salir, y una tienda que traiga algo de afuera no se publica.
- Seguir el pedido (HU-T6.3): el comprador ve en qué va su pedido con el enlace que recibió, sin crear una cuenta, y nadie más puede verlo.
- El acuse de recibo (HU-T6.2): al enviar el pedido, el comprador ve su código, el número, el total, la forma de pago, el envío y su plazo, y lo puede imprimir o guardar como PDF.
- Pedir por WhatsApp (HU-T6.1): en «Tu pedido» el comprador elige cómo pagar entre las formas que ofrece la tienda, acepta los términos y envía. La tienda guarda el pedido con lo que aceptó y abre WhatsApp con el pedido ya escrito. Si se toca dos veces, sigue siendo un solo pedido.
- «Avísame cuando haya» (HU-T6.5): en una combinación agotada, el comprador le dice a la tienda que la espera, con un toque y sin dejar ningún dato suyo. La tienda sabe cuántas personas esperan cada producto.
- Cotizar (HU-T5.5): antes de pedir, la tienda confirma con sus precios y su inventario lo que hay en el pedido. Si algo cambió, se agotó o ya no alcanza, el pedido se corrige y se le dice al comprador, y si el total es otro, se le pide revisarlo: nunca se pide un total distinto del que vio.
- El carrito de cada tienda (HU-T5.4): lo que el comprador elige se guarda en su teléfono, con un código de pedido que no cambia aunque cierre la página, y se ve en «Tu pedido», donde puede cambiar las cantidades. Si algo se agotó mientras tanto, sale del pedido y se lo decimos.
- La portada, las colecciones y la ficha de cada tienda (HU-T5.2): tres formas de portada para elegir, las fotos de cada producto en el tamaño justo para cada pantalla, y en cada ficha lo que el comprador debe saber antes de pedir: el precio final, el costo y el plazo de cada envío, si puede retractarse y si el producto es solo para mayores de edad.
- Los textos legales de cada tienda (HU-T7.1): términos y condiciones, política de datos, envíos y devoluciones, retracto, garantía y cómo hacer una solicitud, escritos en palabras claras y llenos con los datos de cada comercio. El pie de cada página muestra quién vende y enlaza a todos. Si falta un dato, la tienda no se publica hasta completarlo. Son un borrador para que lo revise un abogado.
- Cada tienda se deja leer por los asistentes y los buscadores (HU-T15.1): dice qué agentes la pueden leer según lo que elija el comercio, ofrece un índice con sus productos en texto plano y se puede guardar en la pantalla del teléfono con su nombre y su color. También dice a quién escribir si alguien encuentra un fallo de seguridad.
- Las tareas periódicas de la Tienda (HU-T17.1): corren solas cada hora en producción y dicen en la salud si alguna se atrasó o falló, sin que una que falla detenga a las demás. Cada día se revisa que cada dirección lleve a su tienda; si algo no cuadra, se corrige desde la base y se avisa al dueño por Telegram.
- Las fotos de las tiendas tendrán su propio almacén público, aparte del que guarda los respaldos y las exportaciones (HU-T5.6): así un enlace a una foto nunca deja ver otra cosa. Los pasos para crearlo están en `docs/runbooks/tienda-fotos.md`.
- Publicar una tienda (HU-T4.4): la tienda se hornea, pasa la compuerta y sube a su almacén solo lo que cambió; si algo falla a la mitad, la tienda sigue como estaba. Sin cambios, dice «Nada cambió». En staging, los dos comercios de prueba se publican en cada despliegue y se ven en sus direcciones.
- La compuerta de publicación (HU-T4.3): antes de publicar, la tienda dice todo lo que falta de una vez, cada cosa con qué hacer y dónde: los datos legales, el WhatsApp sin confirmar, un producto sin foto o sin precio, un texto con corchetes, un enlace roto. El pie de cada tienda enlaza a la Superintendencia de Industria y Comercio.
- La vitrina tiene su forma (HU-T3.3, HU-T3.4 y HU-T5.3): la letra del ecosistema (Geist y Geist Mono), tarjetas, la ficha con la elección de talla y color que dice qué falta, lo agotado tachado, la barra del pedido y una búsqueda que funciona en el teléfono sin red.
- El despacho sirve la tienda horneada (HU-T5.1): cada página sale del almacén con su versión publicada y las cabeceras de seguridad de la vitrina, y su gemelo para agentes con `Accept: text/markdown`, sin tocar la base. Una tienda que todavía no publica dice «Esta tienda todavía no abre».
- La Tienda está activa en el CORE de staging (HU-T2.10), para probarla con sesiones de verdad cuando el panel tenga su entrada; en producción sigue pausada.
- El horno de la Tienda (HU-T4.1): cada tienda en archivos estáticos que se leen sin JavaScript, con su gemelo para agentes, el catálogo, el sitemap y los datos estructurados para buscadores. Lo que escribe el comercio nunca se ejecuta (HU-T4.2).
- El color de cada tienda (HU-T3.2): ocho acentos que siempre se leen bien y un color libre que se revisa al guardarlo; si no se lee, se dice cuál se parece y sí se lee. El panel de la Tienda tiene su propio tono, cobre, en el sistema de diseño del ecosistema.
- La tienda se puede verificar en Google Search Console (HU-T14.8): el comercio pega el código o la etiqueta HTML que le da Google, y se guarda solo el código, listo para la portada. Es el método que sirve para una tienda en un subdominio de la plataforma, que no puede verificarse por el proveedor de dominio.
- Los dos comercios de prueba en staging (HU-T2.6): Comercio Ensayo Uno, de ropa con tallas, colores e inventario, y Comercio Ensayo Dos, una panadería sin inventario, cada uno en su dirección `<nombre>--staging.laboratorio-digital.app`. Salen de un solo fixture, se siembran en cada despliegue de staging y nunca en producción. La prueba de humo exige que cada uno responda en su dirección con su nombre.
- La API de la Tienda acepta los tokens del CORE (HU-T2.8): solo los de la Tienda, vigentes y de su celda. La tienda, el rol y el plan salen del token, nunca de lo que mande el navegador, y un token que no sirve recibe un motivo que el panel sabe mostrar («vuelve a entrar»).
- Los kill switches de la Tienda funcionan (HU-T2.7): con `ks:tienda` apagado, toda tienda muestra «Volvemos pronto» y el panel queda en solo lectura; con `ks:tienda:<org>`, solo esa tienda queda en pausa. Al agotar su presupuesto, el vigía apagaría el horno y el MCP, nunca la venta; en el plan gratuito solo avisa, y ya cuenta las filas de la base de control como de la Tienda.
- La versión propia de la Tienda (HU-T0.2): este registro, las etiquetas `tienda-vX.Y.Z` y su paso de publicación. Un PR que cambia la Tienda sin anotarlo aquí no pasa el CI.
- `node scripts/tienda/generar-secretos.ts --ambiente staging|produccion` (HU-T2.5): genera una vez la llave maestra de la Tienda y el secreto del despacho, y los guarda en el ambiente de GitHub. La llave maestra va al portapapeles, nunca a la pantalla, y no se guarda sin la copia en el gestor de contraseñas. Runbook: `docs/runbooks/secretos-de-la-tienda.md`.
- Las tres apps de la Tienda en staging (HU-T2.4): la API, que solo responde al despacho y al panel; el despacho, que resuelve la tienda por la dirección sin tocar la base y muestra «Esta dirección no tiene tienda» cuando no la hay; y el panel, por ahora con su portada. El despliegue tiene un paso propio para la Tienda, que no detiene a los demás productos mientras no tenga tiendas.
- Las migraciones de la Tienda pasan a `infrastructure/migraciones/` (HU-T2.1), con sus 82 comprobaciones como pruebas en la base en proceso y en el D1 local de workerd. Los anexos de TIENDA-3.0 tienen que ser copias exactas de esos archivos.
- La celda c1 de la Tienda en `celdas.json` (HU-T2.3), con su shard y su base de control, y las configuraciones de sus tres Workers (API, despacho y panel) generadas desde ese archivo. La API no tiene rutas propias: solo se llega a ella desde el despacho y el panel.
- La Tienda 3.0 en el registro de productos, pausada (HU-T2.2): sus tipos, roles, planes como hipótesis (`content/tienda/planes.json`), lo que permite cada plan (`funciones.json`) y la política de sus cuentas en borrador. El CORE la conoce, pero no crea tiendas ni cobra planes hasta que exista su panel.
