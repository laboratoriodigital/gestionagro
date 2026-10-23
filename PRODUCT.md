# Product

<!-- impeccable:product-schema 1 -->

Laboratorio Digital (ED1 por dentro): un ecosistema de productos digitales para negocios pequeños de Colombia, sobre una sola plataforma común. Confirmado con el dueño el 23 oct 2026. Lo técnico vive en `docs/ARQUITECTURA.md` y `docs/plataforma/PLATAFORMA.md`; este archivo es lo que todo trabajo de diseño debe saber del producto.

## Platform

web

Todas las apps son web: sitios estáticos y aplicaciones instalables (PWA) en el navegador del teléfono. Ninguna es nativa.

## Users

Todos usan sobre todo el **teléfono**, en **español de Colombia**.

| Producto | Quién lo usa | En qué situación | Para qué |
|---|---|---|---|
| **CultivoPro** (`cultivopro.co`) | Productores y equipos de fincas bajo invernadero y agroindustria. La finca cero es un invernadero de tomate ecológico | En el campo, muchas veces sin señal, con las manos ocupadas | Anotar labores, aplicaciones, cosechas y ventas, y usar calculadoras agronómicas gratuitas |
| **TiendaPro** (`tiendapro.co`, las tiendas en `mitiendapro.co`) | Pequeños comercios: el dueño de la tienda y su equipo; y los compradores de cada tienda | El comercio administra su tienda desde el panel; el comprador compra desde la vitrina | Vender en línea. En el plan **Gratis** los pedidos llegan solo por WhatsApp; en **Pro** e **IA Pro** se cobra en línea con Bold y por otros medios |
| **Parqueadero** (`parqueadero.laboratorio-digital.app`) | El cajero del parqueadero y su administrador | En la caja, cobrando entradas y salidas, con o sin señal | Cobrar, imprimir el recibo y llevar la caja |
| **Cuenta** (`cuenta.laboratorio-digital.com`) | Cualquier persona de cualquiera de los productos | De vez en cuando | Ver sus espacios, sesiones, pagos, la actividad de lo que administra y sus datos personales |
| **Consola del dueño** (`/consola/` en la cuenta) | Solo el dueño de Laboratorio Digital | A diario, desde el teléfono | Ver qué entró, qué creció, qué se rompió y qué hay que revisar en todos los productos |

## Product Purpose

Dar a negocios pequeños herramientas que un negocio grande pagaría caro, a un precio que un negocio pequeño puede pagar, y que sigan funcionando cuando falla la señal o la nube. Cada producto nuevo se monta sobre la plataforma común (cuentas, equipos, planes y cobros, correos, privacidad y copias), así que cuesta menos que el anterior y suma clientes a la misma base.

El éxito se mide por producto: fincas que registran a diario, tiendas que venden y pasan de Gratis a un plan pagado, parqueaderos que cobran sin papel, y un dueño que sabe cómo va todo sin preguntar.

## Positioning

Herramientas que funcionan en el teléfono sin señal y casi sin costo, hechas en Colombia para negocios pequeños, donde los datos son del cliente. Lo que las hace posibles es el aprovechamiento de la infraestructura de nube, la optimización de recursos y la automatización: todo se diseña para el plan gratuito de Cloudflare, lo estático se hornea, lo que se puede calcular en el teléfono se calcula ahí, y la operación (despliegues, copias, avisos, cobros) corre sola.

## Operating Context

- **Teléfonos baratos y pantallas de 360 px**; las pruebas de punta a punta corren a ese ancho.
- **Sin señal o con señal mala:** el cuaderno y la caja guardan en el teléfono y sincronizan cuando pueden.
- **WhatsApp es el canal del comercio y del comprador** (pedidos, invitaciones al equipo, confirmaciones).
- **Entrar con Google o con un enlace al correo**, en una sola cuenta para todos los productos.
- **Planes prepagados por 1, 3, 6 o 12 meses**, pagados con Bold o en efectivo, con días de gracia y avisos antes de vencer.
- **El dueño opera** con GitHub (despliegues, pagos en efectivo), Telegram (avisos), el reporte semanal y la consola.

## Capabilities and Constraints

- **Planes de TiendaPro:** Gratis (COP 0: catálogo con pedidos por WhatsApp, hasta 10 productos, una persona en el panel), Pro (COP 24.900 al mes) e IA Pro (COP 49.900 al mes). La fuente es `content/tienda/planes.json`; no se escriben precios fuera de ahí.
- **Asistentes de IA:** con permiso de la persona, pueden leer o actuar sobre un espacio, nunca mover dinero.
- **Privacidad (Ley 1581):** cada producto tiene su política aceptada por versión; la persona descarga sus datos y radica solicitudes desde su cuenta. Nadie dentro de la app ve los datos de todos.
- **Nombres reales:** ninguna prueba ni pantalla de ejemplo usa una finca, un comercio o una persona real; se usan «Finca Ensayo Uno», «Ensayo Dos» y similares.
- **Lo que no se decide aquí:** la dirección visual del ecosistema. Las interfaces actuales funcionan, pero al dueño no le gustan, y todavía no hay una dirección de diseño definida (ver Brand Commitments).

## Brand Commitments

- **Nombres:** Laboratorio Digital es la marca del ecosistema, la cuenta y la consola. CultivoPro, TiendaPro y Parqueadero son las marcas de sus productos. CultivoPro tiene su hoja dibujada a mano (`content/marca.json`, `apps/sitio/public/marca/`).
- **Voz:** cálida, clara y en segunda persona («tú»; la caja del parqueadero usa «usted»). Lo que ve un cliente nunca nombra tecnologías ni cuenta el cómo técnico: dice qué puede hacer y qué pasa con sus datos.
- **Evaluación del dueño (23 oct 2026):** el ecosistema arrancó sin una directriz de diseño. Las interfaces actuales funcionan, pero no le gustan. **La única que le gustó es la landing de TiendaPro** (`apps/tiendapro-sitio`), hecha con referencias de páginas existentes.
- **Orden del rediseño, pedido por el dueño:** primero las interfaces de la consola del dueño (sprint C12, EC13); después, el rediseño de las demás.

## Evidence on Hand

- **Clientes cero reales:** la finca cero (CultivoPro) y el parqueadero cero (Parqueadero). Son reales, pero sus nombres no se publican ni se usan en pruebas.
- **TiendaPro:** abierta en producción desde el 22 oct 2026; los comercios de prueba son Ensayo Uno y Ensayo Dos.
- **No hay** testimonios, casos de éxito, cifras de clientes, prensa ni sellos que se puedan mostrar. No se inventan.

## Product Principles

1. **El teléfono primero, y sin señal también.** Si algo no se puede hacer en un teléfono barato con señal mala, no está terminado.
2. **El dato es del cliente.** Se exporta cuando quiera, se copia fuera de la nube cada semana y nadie lo mira sin permiso.
3. **Casi sin costo, por diseño.** Cada función se piensa para el plan gratuito y para escalar con los clientes, no antes.
4. **Lo que se repite, una sola vez.** Cuentas, planes, cobros, correos y privacidad viven en la plataforma común; cada producto se ocupa solo de lo suyo.
5. **Decir la verdad.** Lo que no está disponible se dice; nada finge haber funcionado.

## Accessibility & Inclusion

- **WCAG 2.1 AA** en todas las apps: las pruebas de punta a punta corren axe y fallan con una sola violación.
- **360 px sin moverse de lado**, objetivos táctiles grandes y texto legible en el campo y en la caja.
- Lenguaje sencillo para personas que no son técnicas.
