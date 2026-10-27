# TiendaPro frente a Tiendanube: qué hacemos mejor, igual, qué mejorar y qué esperar

**Fecha:** 26 oct 2026 · **Pedido por:** el dueño · **Versión de TiendaPro contrastada:** tienda 1.4.0 (en #249)
**Fuentes:** la página de funcionalidades de Tiendanube Colombia ([tiendanube.com/co/funcionalidades](https://www.tiendanube.com/co/funcionalidades), leída el 26 oct 2026) y su página de planes (S16 del estudio, leída otra vez el mismo día). De TiendaPro: el código de `main`, `TIENDA-3.0.md` y `BACKLOG_TIENDA3.md`.
**Lo que manda:** ED1 → `ARQUITECTURA.md` (P1–P21) → `TIENDA-3.0.md`. Ninguna propuesta de este documento rompe sus premisas; las que chocan con ellas van en §5, con la razón.
**Lo que sale de aquí:** `BACKLOG_PERFECCIONAMIENTO.md`, con las historias propuestas, por priorizar con el dueño.

> Cuidado al leer: de Tiendanube solo sabemos lo que su página dice, no cómo funciona por dentro ni qué tan bien. «Igual» quiere decir que los dos lo ofrecen, no que lo hayamos medido lado a lado.

---

## 1. En una página

| | Cuántas | Las más importantes |
|---|---:|---|
| **Ya lo hacemos mejor** | 14 | Pedido por WhatsApp completo, contraentrega con recaudo, agentes de IA (MCP), plan gratis y Pro más barato con dominio, velocidad medida, lo legal de Colombia resuelto, tus datos sin límite de exportación |
| **Lo hacemos igual** | 14 | Catálogo con variantes, cupones, envíos por ciudad, inventario automático, GA4 y Meta, feeds de Google y Meta, equipo de 1, 3 o sin límite, dominio con SSL, panel en el celular |
| **Lo tenemos a medias: opción de mejora** | 15 | Compras sin terminar, correos de estado al comprador, promociones por cantidad, acciones masivas, filtros de pedidos, temas listos, redes sociales en la tienda, ayuda para el comerciante |
| **Con disparador: backlog de perfeccionamiento** | 11 | TikTok, crédito con Addi y otras pasarelas, transportadoras integradas, varias bodegas, mayoristas, tienda física, idiomas, API de conversiones, productos digitales, email marketing |
| **No lo haremos, a propósito** | 4 | Código fuente editable por el comercio, tienda de aplicaciones de terceros, contraseñas, cobrar por conversación de IA |

**La conclusión.** TiendaPro ya compite en lo que más pesa para el comercio pequeño de Colombia que vende por WhatsApp: el pedido, el cobro, la entrega contra pago y lo legal. Tiendanube gana en **amplitud**: más plantillas, más pasarelas, transportadoras, canales (TikTok, tienda física) y un ecosistema de aplicaciones. La mayoría de esa amplitud ya está en `BACKLOG_TIENDA3.md` §9 con su disparador, y debe seguir esperando a que un comercio real la pida. Lo que sí conviene hacer pronto es lo que mueve ventas sin romper nada: **las compras sin terminar, los correos de estado al comprador, las promociones por cantidad y las acciones masivas**.

---

## 2. Lo que ya hacemos mejor

| # | Tema | Tiendanube (lo que dice su página) | TiendaPro hoy | Por qué es mejor |
|---|---|---|---|---|
| 1 | **WhatsApp** | «Botón en la tienda para atender clientes» | El pedido completo sale por WhatsApp: carrito, código del pedido, forma de pago, aceptación de términos y acuse (HU-T6.1, HU-T6.2). El comerciante confirma por WhatsApp desde el panel (HU-T9.3). «Avísame por WhatsApp» en lo agotado (tienda 1.4.0) | El ICP vende por WhatsApp: allá es un botón de chat; aquí es el canal de venta, con el pedido registrado y su código |
| 2 | **Contraentrega** | No la menciona | La contraentrega nace con su recaudo, se sigue hasta que la transportadora liquida y el tablero muestra su margen (HU-T9.4, HU-T9.5) | En Colombia gran parte del pequeño comercio cobra contra entrega; nadie más lo concilia |
| 3 | **Agentes de IA** | «Chat Nube»: COP 450 a 625 por conversación con IA; «recursos de IA para productos» con 30, 150 o usos ilimitados por plan | La tienda es legible por agentes (Markdown, políticas, OpenAPI). El **MCP público** deja que el asistente del comprador busque, consulte y prepare un pedido que la persona confirma (Pro). El **MCP del comercio** deja que su asistente vea pedidos, cambie estados y ajuste inventario y catálogo (IA Pro) (HU-T15.1 a HU-T15.7) | Sin cobro por conversación: el asistente es del comprador o del comerciante. Ninguna tienda de la región vende a agentes de IA |
| 4 | **Precio** | Básico COP 33.900, Tiendanube COP 74.900, Avanzado COP 249.900; sin plan gratis en Colombia; 0 % de comisión | **Gratis** (10 productos), **Pro** COP 24.900 con dominio propio, cobro en línea y feeds, **IA Pro** COP 49.900; 0 % de comisión; descuento por 3, 6 y 12 meses | Se puede empezar sin pagar, y el plan con dominio cuesta menos que el más barato de Tiendanube |
| 5 | **Velocidad** | «Velocidad optimizada», sin cifra | Promesa medida en cada PR: carga en menos de 2,5 s con 4G lenta en un teléfono de 360 px, portada de menos de 50 KB y JavaScript de menos de 60 KB. Una visita nunca toca la base (TIENDA §1.3) | Es una promesa que vigila una prueba, no un adjetivo |
| 6 | **Lo legal de Colombia** | No lo menciona | Términos, privacidad, retracto y garantía generados de la ficha del comercio; la compuerta no publica sin datos legales; solicitudes (preguntas, quejas, retracto) con radicado y plazo; derechos del titular (HU-T6.4, HU-T7.1 a HU-T7.3; Leyes 1480, 1581 y 2439) | Le quita al comercio un riesgo que casi ninguno sabe resolver solo |
| 7 | **Privacidad** | Píxel de Facebook, Google Analytics y otras herramientas | Medición propia sin cookies; GA4 y Meta solo con el consentimiento del comprador; «Avísame» sin guardar datos de nadie (HU-T14.1, HU-T14.4, HU-T6.5) | Mide sin pedir permiso para lo básico y respeta a quien no acepta |
| 8 | **Publicar sin miedo** | No lo menciona | Cada publicación es una versión: se puede volver atrás en segundos. Nuestras versiones de código llegan por anillos, nunca a todas las tiendas a la vez (HU-T10.4, HU-T4.6) | Un error nuestro o del comercio no tumba la tienda |
| 9 | **Tus datos** | Exportaciones mensuales de ventas: 1, 4 o ilimitadas según el plan | «Descargar todo» en cualquier momento y en cualquier plan, en el mismo formato con que se carga; subir un respaldo lo restaura (HU-T10.7, HU-T18.11) | Sin cupo: los datos son del comercio |
| 10 | **No vender lo que no hay** | «Actualización automática del stock tras cada compra» | Lo mismo, y además las unidades se apartan mientras el comprador paga en línea; la base no deja reservar más de lo que hay (TIENDA §7) | Dos compradores no pagan la última unidad |
| 11 | **Pagos seguros** | Medios de pago con tarifas especiales | Cobra con **su propio Bold**: el dinero llega directo al comercio. Las llaves van cifradas; cada pago se consulta y se concilia, nunca se cree lo que dice el navegador (HU-T11.1 a HU-T11.11) | Sin intermediario y con cada peso verificado |
| 12 | **Seguimiento** | «Rastreo de pedidos» | Enlace de seguimiento que no se puede adivinar, sin crear cuenta (HU-T6.3) | El comprador no necesita usuario ni contraseña |
| 13 | **Registro de cambios** | Permisos por perfil | Además, un registro de quién hizo qué, con su hora (HU-T10.6) | Si algo cambió, se sabe quién fue |
| 14 | **Dominio propio** | Dominio propio | Se conecta desde el panel, sin un minuto sin candado, con canónico y alias y la redirección automática (HU-T13.1 a HU-T13.3) | Probado el 26 oct 2026 con `losutiles.online` en un proveedor externo |

---

## 3. Lo que hacemos igual

| # | Tema | Tiendanube | TiendaPro | Nota |
|---|---|---|---|---|
| 1 | Catálogo | Productos físicos y digitales, variantes, SKU, peso y stock | Variantes (hasta 3 opciones), SKU, stock y foto por combinación; colecciones; destacado y nuevo | Sin productos digitales ni peso (§4, §5) |
| 2 | Carga masiva | Panel, API o acciones masivas | Carga por hoja de cálculo en Pro e IA Pro; API para agentes | Faltan las acciones masivas dentro del panel (§4) |
| 3 | Diseño en el celular | Plantillas optimizadas para móviles | Pensado primero para el teléfono, con presupuesto de peso | Igual o mejor (§2.5) |
| 4 | Personalización visual | Logo, colores, tipografía, destacados y banners sin programar | Logo, favicon, acento, tinta, dos estilos tipográficos, tres portadas, bienvenida de lado a lado, orden del catálogo | Menos variedad de plantillas (§4) |
| 5 | Cupones | Descuentos, cupones y envíos gratis, con fecha | Por porcentaje, valor o envío gratis, con mínimo, vigencia y usos | Faltan descuentos por cantidad y cupones por producto (§4) |
| 6 | Envíos | Costo y plazo por departamento y ciudad; retiro en punto | Opciones con precio, «gratis desde», ciudades y plazo; «Recoger en el local» como opción | Sin transportadoras integradas (§5) |
| 7 | Inventario | Stock automático y alertas de lo que se agota | Libro de inventario; los agotados en el tablero y en el resumen diario | Falta el aviso de «por agotarse» con umbral (§4) |
| 8 | Estadísticas | Visitas, ventas, facturación y productos | Ventas, pedidos, ticket y tasa de cierre del día, del mes y del mes anterior; visitas y embudo con medición propia | Equivalentes |
| 9 | Medición de campañas | Píxel de Meta, GA4 | GA4 y píxel de Meta con consentimiento (Meta con dominio propio) | Sin la API de conversiones (§5) |
| 10 | Google Shopping | Productos en Google | Feeds para Google, Meta y agentes (Pro) | Igual |
| 11 | Equipo | 1, 3 o ilimitados usuarios; permisos por perfil | Gratis 1, Pro 3, IA Pro sin límite; propietario y colaborador | Un solo rol de colaborador (§4) |
| 12 | Correos automáticos | Registro, contraseña, compra, pago, envío, cancelación y carritos | Acuse del pedido, resultado del cobro de prueba y resumen diario al comerciante | Faltan los correos de estado al comprador (§4). Registro y contraseña no aplican: se entra con Google o con un enlace |
| 13 | Pedidos manuales y filtros | Entrada manual de pedidos; filtros por estado, fecha, envío y canal | Pedidos anotados; filtros por estado, forma de pago y texto | Faltan filtros por fecha y canal (§4) |
| 14 | Administrar desde el celular | App móvil | El panel se instala en el teléfono como una aplicación y funciona igual | Sin tienda de aplicaciones de por medio |

---

## 4. Lo que tenemos a medias: opciones de mejora

Cada una cabe en la arquitectura de hoy. La historia propuesta está en `BACKLOG_PERFECCIONAMIENTO.md`.

| # | Mejora | Lo que dice Tiendanube | Lo que falta en TiendaPro | La premisa que hay que cuidar | Historia |
|---|---|---|---|---|---|
| 1 | **Compras sin terminar** | «Visibilidad de compras no terminadas y estrategias de recuperación»; correo de carrito abandonado | El carrito vive en el teléfono del comprador; el comerciante no ve nada | Ley 1581: solo con el contacto y el permiso del comprador, casilla sin marcar, borrado a los 30 días. Sin WhatsApp Cloud API: el comerciante escribe desde su teléfono | HU-P1.1 |
| 2 | **Correos de estado al comprador** | Confirmación de compra, pago, envío y cancelaciones | Solo el acuse al hacer el pedido | El tope de correos por tienda y por celda (HU-T14.3); solo si el comprador dejó su correo | HU-P2.1 |
| 3 | **Promociones por cantidad** | Descuentos por cantidad | Solo cupones | El servidor recalcula: lo que el comprador ve es lo que paga | HU-P1.2 |
| 4 | **Cupones por producto o colección** | Restricciones por producto | El cupón aplica a todo el carrito | Lo mismo que la anterior | HU-P1.3 |
| 5 | **Ofertas programadas** | Activación programada por fecha | El precio de antes no tiene fechas | El horneado no usa el reloj: el cron re-hornea al empezar y al terminar | HU-P1.4 |
| 6 | **Texto personalizado en la ficha** | Campos personalizados en variantes y ventas | No hay | Lo que escribe el comprador nunca se ejecuta: va como texto al pedido | HU-P1.5 |
| 7 | **Alerta de «por agotarse»** | Alertas de productos por agotarse | Solo los agotados | — | HU-P2.2 |
| 8 | **Acciones masivas en el panel** | Precios, ocultar, publicar o borrar varios | Solo por hoja de cálculo | Cada cambio queda en el registro; un lote que falla no deja nada a medias | HU-P3.1 |
| 9 | **Filtros por fecha y canal** | Por estado, fecha, medio de envío y canal | Por estado, forma de pago y texto | — | HU-P3.2 |
| 10 | **Un rol «solo pedidos»** | Permisos específicos por perfil | Propietario y colaborador | La matriz de permisos (`permisos.ts`) es la única fuente | HU-P3.3 |
| 11 | **Temas listos** | Más de 60 plantillas | Combinar acento, tinta, estilo y portada a mano | La personalización es dato, nunca código del comercio | HU-P4.1 |
| 12 | **Varias imágenes en la bienvenida** | Banners, carruseles o videos | Una imagen | Portada de menos de 50 KB y carga en menos de 2,5 s: sin video y con poco JavaScript | HU-P4.2 |
| 13 | **Redes sociales en la tienda** | Integración con redes | No hay enlaces a Instagram, TikTok o Facebook | — | HU-P4.3 |
| 14 | **Título y descripción para buscadores** | Personalización del SEO | Salen solos de la descripción del producto | — | HU-P4.4 |
| 15 | **Ayuda para el comerciante** | Más de 600 tutoriales, soporte por WhatsApp, chat y videollamada; herramientas gratis (calculadora de precios) | Runbooks técnicos; ninguna guía para el comerciante | Textos cálidos y sin técnica | HU-P5.1, HU-P5.2 |

---

## 5. Lo que queda con disparador, y lo que no se hará

### 5.1 Con disparador (backlog de perfeccionamiento, sin sprint)

Varios ya estaban en `BACKLOG_TIENDA3.md` §9; aquí se suman los que trae Tiendanube.

| Funcionalidad de Tiendanube | Disparador para construirla | Dónde estaba |
|---|---|---|
| Otras pasarelas (Mercado Pago, PayU, Nequi directo) | El dueño elige la segunda pasarela, o un comercio no puede usar Bold | §9 |
| **Compras a crédito con Addi** | Tres comercios con ticket alto lo piden. Addi pide persona jurídica (estudio S110) | Nuevo |
| Transportadoras integradas (Coordinadora, Servientrega, Interrapidísimo, Envía) | Tres comercios con el mismo operador o agregador | §9 (guías integradas) |
| Varios centros de distribución | Tres comercios con más de un punto de despacho | §9 (varias bodegas) |
| Precios mayoristas | Pedidos empresariales comprobados | §9 (B2B) |
| Tienda física | Un comercio que venda en un local los mismos productos | §9 (punto de venta) |
| Varios idiomas y monedas | La fase LATAM de ED1 | §9 |
| API de conversiones de Meta | Un comercio con pauta que lo pida | §9 |
| **TikTok (catálogo y botón de compra)** | Tres comercios que vendan por TikTok lo piden. El feed de Meta ya es la base | Nuevo |
| **Productos digitales** | Tres comercios lo piden. Pide entregar un archivo después del pago, sin exponerlo | Nuevo |
| **Email marketing** | Un comercio con base de compradores que aceptaron recibir correos. Se resuelve exportando a su herramienta (Doppler, Perfit), no construyéndola | Nuevo |

### 5.2 Lo que no se hará, y por qué

| Funcionalidad de Tiendanube | Por qué no | Lo que ofrecemos en su lugar |
|---|---|---|
| **Acceso al código fuente** (HTML, CSS y JavaScript del comercio) | Rompe «la personalización es dato, nunca un archivo del comercio» y «lo que escribe el comercio no se ejecuta» (TIENDA §2, HU-T4.2). Un código por tienda impide hornear, revisar la seguridad y publicar por anillos | Temas listos (HU-P4.1) y ajustes por sección |
| **Tienda de aplicaciones de terceros** | Un código ajeno dentro de la tienda rompe la CSP, el presupuesto de peso y la privacidad | La API pública y los dos MCP: las integraciones hablan con la tienda desde afuera |
| **Registro y contraseñas** (del comprador y del comerciante) | Sin contraseñas no hay robo de contraseñas ni correos de recuperación. Las cuentas de comprador esperan su disparador (§9) | Entrar con Google o con un enlace al correo; seguimiento con un enlace |
| **Cobrar por conversación de IA** | El asistente es del comprador o del comerciante; no le cobramos a nadie por hablar con su tienda | El MCP público (Pro) y el del comercio (IA Pro) |

---

## 6. Lo que recomiendo

1. **Ahora, en un sprint (P1, unos 20 puntos):** compras sin terminar (HU-P1.1), correos de estado al comprador (HU-P2.1), promociones por cantidad (HU-P1.2), acciones masivas (HU-P3.1) y redes sociales en la tienda (HU-P4.3). Son las que más mueven ventas y ahorran tiempo, sin costo de infraestructura.
2. **Después (P2):** temas listos, filtros, «por agotarse», ofertas programadas, cupones por producto y la ayuda para el comerciante.
3. **Antes de vender en serio:** la ayuda para el comerciante (HU-P5.1). Tiendanube compite con 600 tutoriales y soporte por WhatsApp; nuestra ventaja es que la tienda es simple, pero el comerciante igual necesita una guía para su primer producto, su Bold y su dominio.
4. **Esperar al comercio real** para todo lo de §5.1. Copiar la lista de un competidor no dice qué necesita el comerciante (estudio §8.4, punto 1).
