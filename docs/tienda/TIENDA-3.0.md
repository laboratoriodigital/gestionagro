# Tienda 3.0 — arquitectura

**Estado:** propuesta de arquitectura, diseñada desde cero por decisión del dueño (5 oct 2026)
**Versión:** 0.2 · 5 oct 2026
**Depende de:** `../plataforma/PLATAFORMA.md`: el CORE con dimensión de producto, la cuenta, los dominios, los tokens v2 y la preparación para agentes.
**Documentos que manda este:** `../ecosistema/ECOSISTEMA-DIGITAL-ED1-v1.4.md`, `../ARQUITECTURA.md` (ADR-20 a ADR-27) y, en esta carpeta, el estudio de mercado vigente (`ESTUDIO-MERCADO-ECOMMERCE-ED1-2026-10-v1.3.md`), el análisis de integración (`integracion-tienda-ecosistema.md`) y la bitácora ecommerce (`BITACORA-ecommerce.md`, P1–P21).

> **Desde cero.** El dueño decidió el 5 oct 2026 que pasar la Tienda 2.0 no es requisito del diseño: «podemos generar scripts luego para subir su data. Podemos idearla de 0».
> - Aquí no se hereda **ningún contrato** de la 2.0: ni columnas, ni claves de configuración, ni puertas, ni direcciones.
> - Se heredan sus **lecciones**: los patrones P1–P21 y lo que se probó en producción (§2).
> - Los datos de las dos tiendas en operación entran después, con el formato de carga de §17. Su contrato de puertas sirve como **lista de paridad**, no como contrato (anexo C).
>
> **El SQL no es un borrador.** El modelo de datos de §5 está en `infrastructure/migraciones/tienda/` y `infrastructure/migraciones/tienda-control/`, donde lo aplica el despliegue, con su prueba: `tests/repo/shard-tienda.test.ts`. Son 82 comprobaciones, en verde el 5 oct 2026 con `node:sqlite` 3.50.4 y, desde HU-T2.1 (13 oct 2026), también en el D1 local de workerd. El texto completo está en los anexos A y B, y la prueba falla si dejan de ser copias de los archivos.
>
> **Versión 0.2 (5 oct 2026, tarde).** Integra el estudio de mercado definitivo (v1.3, complementos [C1]–[C13]) y cuatro decisiones del dueño:
> - todo en la cuenta de Cloudflare de siempre, con Workers Paid desde M0 *(hoy: en el plan gratuito hasta que un dato exija Workers Paid, decisión del dueño del 6 oct 2026; lo que eso deja abierto está en la bitácora tienda3 7)*;
> - las tiendas en `laboratorio-digital.app`, y sin la Public Suffix List (§4.1);
> - planes de 1, 3, 6 y 12 meses, con los cuatro niveles hipotéticos del estudio (§1.4);
> - el repositorio `plataforma`.
>
> Del estudio entran: las formas de pago de Colombia con la contraentrega y su recaudo (§8.7), el link de pago como parte del cobro (§9.6), integrar el facturador del comercio antes que emitir (§14.5), el catálogo para Meta y la reconciliación de eventos (§11.6), las bodegas preparadas (§7.5), los insumos de la 2.0 para la carga (§17 y anexo C) y la corrección de lo que la 0.1 decía de WhatsApp (§20.3).

---

## 0. Resumen

**Qué es.** Tiendas en línea para pequeños comercios de Colombia que venden por WhatsApp.

- La tienda vive en su dominio, o en `<nombre>.laboratorio-digital.app`.
- Abre en un segundo en un teléfono barato.
- Tiene catálogo con variantes, inventario por variante, fotos, colecciones y ofertas.
- Los pedidos llegan por WhatsApp con un código. Se pagan en línea con **el Bold del comercio** (botón o link de pago), contra entrega, por transferencia o en efectivo.
- La contraentrega se sigue hasta que la plata llega a la cuenta del comercio.
- El panel web sirve para todo.
- El comprador sigue su pedido con un enlace.
- Los textos legales y las obligaciones del comercio electrónico colombiano vienen hechos.
- Un agente de IA puede leer la tienda y preparar un pedido que una persona confirma.

**Cómo está hecha, en once decisiones:**

1. **Un solo despliegue para todas las tiendas, en la cuenta de siempre, con Workers Paid.** Una tienda es un conjunto de filas en un shard de D1, una versión publicada en R2 y unos hostnames. No es un repositorio, ni una hoja, ni una cuenta (causa 1 de la 2.0).
2. **Las visitas no tocan la base.**
   - Un Worker de despacho resuelve la tienda por el `Host` y entrega archivos ya horneados desde R2, con caché en el borde.
   - Cada visita cuesta una ejecución del Worker, de alrededor de 1 ms y sin D1, incluida en los 10 millones mensuales de Workers Paid.
   - Es un **desvío declarado** de ED1 §3.10, que pide que ninguna ruta pública pase por el Worker. Con dominios de cientos de comercios no hay otra forma de saber qué tienda pidieron (§3.3).
3. **Publicar es hornear una versión inmutable.**
   - Se hornean los archivos de la versión y su manifiesto con huellas.
   - Publicar cambia el puntero de la tienda. Volver atrás también lo cambia, en segundos y sin hornear.
   - El horneado es determinista: los mismos datos dan los mismos bytes (§10).
4. **Todo producto tiene al menos una variante.** Precio, inventario, SKU y fotos viven siempre en la variante. No hay dos caminos (§5).
5. **La sobreventa la impide la base.**
   - Apartar suma a `reservado` con un trigger.
   - Un `CHECK (reservado <= stock)` hace fallar completo el lote del segundo comprador de la última unidad.
   - D1 escribe de a uno por base, así que no hay carrera (§7).
6. **El pago se verifica, no se cree.**
   - Webhook de Bold firmado con la llave secreta **del comercio** (`x-bold-signature`).
   - Consulta a Bold como respaldo y conciliación por cron.
   - Las llaves se guardan con cifrado de sobre (§9).
7. **Las formas de pago de Colombia, con una sola verdad sobre «pagado».**
   - En línea, a convenir por el chat, contra entrega, por transferencia y en efectivo.
   - Solo lo que verificó Bold figura `pagado`. Lo demás lo confirma el comercio y queda `confirmado`: «un pedido enviado al chat no figura como pagado» (estudio §8.1).
   - La contraentrega tiene su propio libro: por recaudar, recaudada, devuelta o perdida, con sus costos en el margen (§8.7).
8. **Los datos personales del comprador están cifrados en la base.**
   - Se cifran con una llave por tienda.
   - Se buscan por índice ciego, y cada lectura queda registrada.
   - Al dar de baja una tienda se borra la llave: borrado criptográfico (§14).
9. **El cumplimiento es parte del modelo, no un texto aparte:**
   - aceptación verificable de los términos en cada pedido;
   - solicitudes con radicado;
   - retracto por producto;
   - acuse de recibo;
   - la ficha legal sin la cual no se publica.

   Lo exigen la Ley 1480 y la Ley 2439 de 2024 (§14).
10. **Legible por agentes**, como lo pide `PLATAFORMA.md` §5:
    - por tienda: `robots.txt` con señales, `llms.txt`, gemelos en Markdown con negociación, catálogo de API, habilidades y MCP público;
    - feeds de productos para Google y Meta;
    - el agente prepara y una persona paga (§11, §13).
11. **El comercio entra con el CORE**, con Google o con un enlace por correo. Su colaborador entra con una invitación. Su plan se paga en el CORE, por 1, 3, 6 o 12 meses (`PLATAFORMA.md` §4).

**Lo que no hace (fuera del MVP, a propósito):**

- cuentas de comprador;
- marketplace o directorio común de tiendas, que la convertiría en «portal de contacto» (Ley 2439 art. 6);
- cobro en línea con otra pasarela que no sea Bold;
- **emitir** facturación electrónica: se integra el facturador del comercio, en el nivel intermedio (§14.5);
- WhatsApp Cloud API. El costo no es la barrera: dentro de la ventana de atención, los mensajes de servicio y las plantillas de utilidad no se cobran. Lo son la verificación del negocio, las plantillas aprobadas, el consentimiento del comprador y la cuota del intermediario (§20.3);
- guías con la transportadora integrada (la contraentrega sí se registra, a mano);
- varias bodegas, punto de venta y B2B: el modelo los deja preparados (§7.5) y llegan con el nivel alto;
- multimoneda;
- multidioma.

Cada uno tiene su disparador en §20.

---

## 1. El producto

### 1.1 Para quién

El ICP de ED1 §2.1: comercios pequeños de Colombia que venden por redes y WhatsApp, sin equipo técnico. Por ejemplo, una panadería, una tienda de ropa o de belleza, o un productor como la finca cero. Hoy administran en una hoja de cálculo o de memoria.

El estudio (§3, §16) pide validar con ellos que resolver catálogo, precio, pedido, cobro y conciliación vale una mensualidad. La Tienda 3.0 entra como **excepción declarada** (ADR-21), igual que el agro con ADR-2. Se construye por hitos, y cada hito tiene sus métricas de §16.3 del estudio, fijadas antes de medir.

### 1.2 Lo que da

| Para | Qué |
|---|---|
| El comprador | Una tienda rápida en su teléfono. Catálogo con buscador, colecciones, variantes y fotos. Carrito. Pedido por WhatsApp con su código; pago en línea con PSE, tarjeta, Nequi o Botón Bancolombia (los medios de Bold), contra entrega, por transferencia o en efectivo, según lo que ofrezca la tienda. Resumen descargable antes de comprar. Seguimiento con un enlace. Solicitudes (preguntas, quejas, retracto) con radicado. «Avísame cuando haya» |
| El comerciante | Un panel web para productos con variantes y fotos, inventario con su historia, pedidos y estados, confirmación por WhatsApp antes de despachar, recaudos de contraentrega por liquidar, links de pago, envíos, cupones, páginas, ajustes, dominio, cobro en línea, publicación con «volver atrás», equipo, solicitudes, tablero de ventas, exportación completa y registro de cambios |
| Su agente de IA (opcional) | El MCP del comercio con los permisos que el comerciante conceda: pedidos, inventario y catálogo. Nada que mueva dinero (`PLATAFORMA.md` §5.4) |
| El agente del comprador | La tienda legible en Markdown, sus políticas, su API pública y el MCP público para buscar, consultar disponibilidad y preparar un pedido que la persona confirma |

### 1.3 Promesas medibles

Van en la página de planes y las vigila una prueba o el vigía:

| Promesa | Medida | Dónde se vigila |
|---|---|---|
| Abre rápido en un teléfono barato | LCP < 2,5 s en 4G lento, 360 px. HTML de la portada < 50 KB; JS < 60 KB comprimido | Lighthouse CI con presupuesto, en cada PR del horno |
| Una visita no consulta la base | Cero consultas a D1 en `GET` de páginas | Prueba del despacho con un D1 que falla si se le habla |
| Lo que el comprador vio es lo que paga | El servidor recalcula; un carrito distinto no se cobra | §6, §7 y pruebas de cotización |
| No se vende lo que no hay | `CHECK (reservado <= stock)` | §7 y la prueba de la última unidad |
| Tus datos son tuyos | Exportación completa en cualquier momento, en el mismo formato con que se cargan | §12 y §17 |
| Si una versión nuestra tumba tu tienda, es nuestra | Volver atrás en segundos (§10). Una versión del código nunca se publica a todas las tiendas a la vez (anillos) | TRASLADO D5 de la 2.0, escrito antes de vender |

### 1.4 Planes

Los planes viven en `content/tienda/planes.json` (P2), con el formato de `PLATAFORMA.md` §4.2: precio por 1, 3, 6 y 12 meses. Qué permite cada plan está en `content/tienda/funciones.json`. Una prueba ata los dos archivos, como en el agro.

**Son hipótesis, no tarifas.** El estudio propone cuatro niveles (§13.6 [C11]) para contrastar con los comercios reales de la línea antes de fijar nada. Los precios los fija el dueño.

| Plan | Mes (hipótesis) | Para quién | Incluye | Límite que empuja al siguiente |
|---|---:|---|---|---|
| `gratis` | COP 0 | Probar y vender poco | Catálogo y pedido por WhatsApp, a convenir. `<nombre>.laboratorio-digital.app`. Marca «Hecha con…» | Hasta 15 productos (propuesta), un usuario, sin dominio propio |
| `entrada` | COP 29.900 | El comercio que vende cada semana | Cobro en línea con su Bold (botón y link de pago), contraentrega con su recaudo, transferencia y efectivo. Opciones de envío. Dominio propio. Sin marca. Feeds para Google y Meta | Un usuario, sin automatizaciones |
| `intermedio` | COP 89.900 | El que vende todos los días | Lo anterior, más factura integrada con el facturador del comercio (§14.5), automatizaciones (resumen diario, recordatorios de confirmación y de recaudo, cancelación de lo no pagado) y colaboradores (3, propuesta) | Facturas incluidas, una bodega |
| `alto` | COP 249.900 | Mayorista o con local | Lo anterior, más el MCP y la API del comercio, y, cuando se construyan, varias bodegas, punto de venta y B2B (§7.5, §20.3) | — |

**Por periodo**, con la propuesta de `PLATAFORMA.md` §4.2 (5 % menos en el trimestre, 10 % en el semestre y dos meses de regalo en el año, redondeado a miles hacia abajo):

| Plan | 1 mes | 3 meses | 6 meses | 12 meses |
|---|---:|---:|---:|---:|
| `entrada` | 29.900 | 85.000 | 161.000 | 299.000 |
| `intermedio` | 89.900 | 256.000 | 485.000 | 899.000 |
| `alto` | 249.900 | 712.000 | 1.349.000 | 2.499.000 |

**Las cuatro reservas del estudio, que el diseño respeta:**

- **El nivel gratuito tiene costo.** Cada tienda gratuita consume cuota de la cuenta y trae riesgo de abuso (§4.4). Su tamaño lo decide el presupuesto del producto, no el mercado.
- **El recaudo pesa más en el precio bajo.** A COP 29.900 al mes, la comisión de Bold es el 5,9 %. Por eso existen los periodos largos.
- **La entrada compite con un precio conocido.** Quedar COP 4.000 por debajo de Tiendanube Básico no es una ventaja. La diferencia está en lo que incluye: cobro, entrega y pedido por WhatsApp resueltos.
- **El intermedio depende de terceros.** La factura integrada usa el facturador del comercio (§14.5), y ningún costo por documento está cotizado.

**Solo la suscripción se planea.** Las líneas por uso que el estudio deja como hipótesis (participación de una pasarela aliada, margen sobre guías y sobre mensajes, §13.2 [C9]) no entran a ninguna proyección. Si un día entran, cumplen sus tres condiciones: ED1 nunca es agregador de pagos, se divulgan en la página de precios y no se proyectan sin contrato firmado y un comercio usándolas.

**La gracia al vencer es de 7 días** (`gracia_dias`). Después, la tienda pasa a los límites de `gratis` sin borrar nada (P21):

- deja de cobrar en línea, pero sigue recibiendo pedidos por WhatsApp;
- el dominio propio redirige al subdominio;
- los productos que pasen del límite quedan ocultos, no borrados.

---

## 2. Principios y lecciones

Se heredan ED1 §3, los patrones P1–P21 y las reglas R1–R6 de `PLATAFORMA.md` §2. Esta tabla dice cómo queda construida cada lección de la 2.0, sin su contrato:

| Lección (bitácora ecommerce, TRASLADO §3–§5) | En la 3.0 |
|---|---|
| El catálogo horneado: las visitas cuestan cero | Versiones horneadas en R2. El despacho no consulta D1 (§3.3, §10) |
| El horneado determinista | Funciones puras en `packages/tienda-horno`, sin reloj ni `Intl` (formato de pesos propio, porque `Intl` cambia entre runtimes, P17). Huella del manifiesto: mismos datos, misma huella; sin cambios no hay versión nueva |
| Contratos que solo crecen (R1 de la 2.0) | Esquema con versión y migraciones (expandir, migrar, contraer). Ajustes por sección con `esquema` y traductores. API pública en `/api/v1` |
| La personalización es dato, nunca un archivo del comercio | Ajustes por sección validados con zod. Ningún código por tienda |
| Sin los datos de la empresa no se publica | Compuerta de publicación (§10.2): ficha legal completa (Ley 1480 art. 50 lit. a) y ningún corchete en una página pública |
| Lo que mueve la plata pide la clave otra vez | Una entrada reciente (`auth_time` ≤ 10 min) para llaves de pago, ambiente de cobro, número de WhatsApp y modo de cobro (§12.3) |
| Apartar antes de cobrar; el pago se consulta, no se cree | `apartado` con trigger y `CHECK`. Webhook firmado y consulta. Nunca los parámetros de vuelta (§7, §9) |
| El rastreo con un secreto aparte | El secreto nace en el navegador, viaja en el fragmento y en la base solo queda su huella (§8.4) |
| Medición propia, sin datos personales | `/_m` → Analytics Engine, sin cookies ni IP. GA4 y Meta solo con consentimiento (§11.6) |
| La compuerta pequeña: invariantes sobre lo desplegado | La compuerta mira los archivos horneados, no la suite de desarrollo (§10.2) |
| Volver atrás en tres capas, con simulacro | Datos (Time Travel de 30 días y exportaciones), sitio (puntero de versión) y código (desplegar la etiqueta anterior). Simulacro trimestral (§15.4) |
| Fotos en capas, con rescate | El navegador comprime y sube derivadas WebP. R2 las guarda por contenido. Un dominio de imágenes sin Worker (§11.5) |
| Ningún secreto en el repositorio ni en la hoja | Cifrado de sobre para llaves y datos personales (§14.2) |
| Las siete causas de dolor (TRASLADO §4) | 1: un despliegue. 2: nada se actualiza a sí mismo (lo despliega Actions con el commit exacto). 3: compuerta separada de la suite. 4: credenciales por propósito, ninguna por tienda. 5: informes con todas las fallas. 6: D1 en vez de Sheets. 7: pruebas contra D1 local real y dos comercios de prueba |
| Los cinco mecanismos de idempotencia del pedido (ARQUITECTURA de la 2.0, §8, leída en la 1.0.0; estudio §15.3 [C12]) | Cada uno tiene su equivalente, casi siempre en la base (anexo C) |
| La 2.0 hornea fotos y catálogo en GitHub Actions, con minutos de una cuota compartida que crecen con cada tienda (confirmado en la 1.0.0; estudio §9.4 [C12]) | Las fotos se comprimen en el navegador y se hornea en una cola de Workers (§10.3). Actions solo construye y despliega el código ([H6]) |

---

## 3. Vista general

### 3.1 Componentes

```text
                        COMPRADOR (o su agente)                      COMERCIANTE (o su agente)
                               │                                               │
     www.mitienda.co ──────────┤ (Cloudflare for SaaS)            panel.laboratorio-digital.app
     mitienda.laboratorio-digital.app ┤ (primer nivel, Universal SSL)             │
                               ▼                                               ▼
 ┌──────────── CUENTA ED1 PRINCIPAL (la de siempre, con Workers Paid desde M0) ─────────────────┐
 │                                                                                              │
 │  tienda-sitio (Worker de DESPACHO)                         tienda-panel (PWA, assets)        │
 │   Host → KV TIENDA_HOSTS → {org, celda, versión}             /api/* → binding de servicio ─┐ │
 │   GET  → R2 sitios/<org>/<versión>/… (+ caché)                                             │ │
 │   POST /api/v1/* · /mcp · /_m → binding de servicio ─┐                                      │ │
 │   assets comunes (/_t/<release>/app.js, css)         │                                      │ │
 │                                                      ▼                                      ▼ │
 │                                    tienda-api (Hono) — celda c1 ───────────────────────────── │
 │                                     · pública: cotizar, pedidos, cobros, seguimiento,         │
 │                                       solicitudes, avísame, MCP                               │
 │                                     · panel: /api/panel/v1/* (token del CORE, aud=tienda)     │
 │                                     · avisos de Bold (webhook firmado por comercio)           │
 │                                     · cola «horno» (consumidor) · crons                       │
 │                                         │            │             │            │             │
 │                       D1 tienda_c1_s{k} (shards)  D1 tienda_control  R2 tienda-c1  KV flags   │
 │                       pedidos, catálogo, cobros,  slugs, reservas,   sitios/,      kill        │
 │                       recaudos                    dominios           objetos/,     switches    │
 │                                                                      medios/,                   │
 │                                                                      respaldos/                 │
 │   Analytics Engine (eventos) · Email Service (correos) · Rate Limiting · Queues               │
 │                                                                                              │
 │   En la misma cuenta: CORE (cuenta.laboratorio-digital.com) y CultivoPro (c0, cultivopro.co)  │
 └──────────────────────────────────────────────────────────────────────────────────────────────┘
          ▲ verifica tokens (Ed25519, sin llamar al CORE)            ▲ API de hostnames (SaaS)
          │                                                         │
   CORE: identidad, organización `tienda`, roles,            Bold (la cuenta de CADA comercio)
   planes y cobro de la mensualidad                           botón y links de pago, webhook
                                                              firmado, consulta de transacciones
```

| Componente | Qué es | Por qué así |
|---|---|---|
| **`tienda-sitio`** | Worker con assets estáticos comunes y la lógica de despacho. Ruta `*.laboratorio-digital.app/*` y el origen de respaldo de Cloudflare for SaaS. Los proyectos del ecosistema en `.app` tienen rutas propias, más específicas que el comodín | Un Worker atiende todos los hostnames, propios y de la plataforma (§4) |
| **`tienda-panel`** | PWA Preact, solo assets. `run_worker_first` únicamente en `/api/*`, que pasa a `tienda-api` por binding de servicio | Cero ejecuciones por pantalla. Mismo origen para la API, sin CORS |
| **`tienda-api`** | Hono sobre Workers, `workers_dev: false` y **sin rutas públicas**. Solo se llega a él por los bindings de servicio de `tienda-sitio` y `tienda-panel`. Incluye el consumidor de la cola del horno y los crons | Sin rutas públicas, la cabecera interna con la tienda resuelta por el despacho es confiable: nadie de afuera puede escribirla |
| **D1 `tienda_c{N}_s{k}`** | Shards de la celda (anexo A) | Una tienda vive entera en un shard (como el agro) |
| **D1 `tienda_control`** | Una por despliegue: nombres cortos y hostnames, únicos en todo el producto (anexo B) | La unicidad global no cabe en un shard |
| **KV `TIENDA_HOSTS`** | `h:<hostname>` → `{org, celda, shard, version, canonico, estado}` | Lectura caliente y barata en cada visita. Se deriva de D1 (P2) y un cron diario lo reconstruye completo |
| **R2 `tienda-c{N}`** | `sitios/` (manifiestos), `objetos/` (archivos por huella), `medios/` (fotos), `legal/` (textos aceptados, sin vencimiento), `respaldos/` y `exportaciones/` | Contenido direccionado: un archivo idéntico se guarda una vez para todas las versiones |
| **Queues `tienda-horno`** | Un mensaje por publicación | El horneado puede tardar más que una solicitud y se reintenta solo |
| **Crons** | Cada 5 min, cada 15 min, cada hora, diario y semanal (§15.3) | Con Workers Paid hay 250 por cuenta; en el plan gratuito, 5, y ya se usan 4 |

### 3.2 Los caminos de una solicitud

| Camino | Pasa por | Toca D1 | Costo dominante |
|---|---|---|---|
| Ver una página de la tienda | despacho → KV (con caché en memoria) → caché del borde o R2 | **No** | 1 ejecución de Worker. R2 clase B solo si la caché no la tiene |
| Ver una foto | `img.laboratorio-digital.app` (dominio personalizado de R2) | No | Ninguno con la caché. R2 clase B si no la tiene. **No ejecuta Worker** |
| Cotizar el carrito | despacho → API | Lectura | 2 ejecuciones y unas 5 filas leídas |
| Pedido por WhatsApp | despacho → API | Escritura | Unas 12 filas escritas (§5.5) |
| Pago en línea | despacho → API → Bold (firma); aviso de Bold → API | Escritura | Unas 45 filas escritas por pedido de 2 líneas |
| Publicar | panel → API → cola → horno → R2 → KV | Lectura | Clase A de R2 solo por los archivos nuevos |

### 3.3 Por qué el despacho por Worker (desvío declarado de ED1 §3.10)

ED1 §3.10 dice que ninguna ruta pública pasa por el Worker. Con una tienda por Worker, como en la 2.0, eso se cumple, pero es la causa 1: N despliegues.

Con un despliegue para todas, lo que Cloudflare sirve como asset estático depende solo de la ruta, no del hostname. Sin ejecutar algo no hay forma de saber de qué tienda es `www.mitienda.co/p/vestido/`.

**Alternativas evaluadas:**

| Opción | Por qué no |
|---|---|
| Un Worker o un proyecto de Pages por tienda | Es la causa 1 de la 2.0, con otro nombre |
| Todas las tiendas como assets de un Worker, más una regla de reescritura por hostname | Cada publicación de una tienda sería un despliegue del Worker de todas: el radio de una falla es todo el producto. Tope de 100.000 archivos por versión |
| R2 público, más reglas de reescritura de URL por hostname | Sin negociación de Markdown, sin redirecciones canónicas y sin cabeceras por tienda. Depende de reglas de zona limitadas por plan. Se guarda como **escape** si un día el volumen de visitas pesa en la factura |
| Workers for Platforms | Sirve para código **distinto** por cliente. Todas las tiendas usan el mismo código. Cuesta USD 25 al mes (memoria, sin verificar) |

**El costo, medido:**

- La ejecución del despacho no consulta D1. Hace como máximo una lectura de KV, cubierta por una caché en memoria de 30 s, y una de R2 cuando la caché del borde no tiene el archivo.
- Con 10 millones de solicitudes incluidas al mes (Workers Paid), caben unas 3,3 millones de visitas de 3 páginas: unas 650 tiendas con 5.000 visitas al mes.
- Lo incluido es **de la cuenta**: lo comparten el agro y el CORE. Cada producto declara su parte en su `product.yaml` (`PLATAFORMA.md` §3.2), y la de la tienda está en §15.1.
- Por encima de eso, USD 0,30 por millón.
- **La promesa de la 2.0 queda así:** ninguna visita consulta la base, y el costo por visita es del orden de una millonésima de dólar.

---

## 4. Dominios y direcciones

### 4.1 Los hostnames

Las tiendas viven en `laboratorio-digital.app` (ADR-27, `PLATAFORMA.md` §3.3), en el primer nivel, que cubre gratis el certificado universal de la zona. Ese nivel lo comparten con los proyectos nuevos del ecosistema.

| Hostname | Qué sirve | Cómo |
|---|---|---|
| `<slug>.laboratorio-digital.app` | La tienda sin dominio propio, y el alias de toda tienda | DNS comodín `*.laboratorio-digital.app`, ruta del Worker y certificado universal de la zona |
| `www.<dominio del comercio>` | La tienda en su dominio | Hostname personalizado de Cloudflare for SaaS (§4.2) |
| `<dominio del comercio>` (raíz) | Lo mismo, o una redirección a `www` | Solo si el DNS del comercio hace CNAME flattening o ALIAS. Si no, se redirige desde su proveedor (§4.3) |
| `panel.laboratorio-digital.app` | El panel | Custom Domain de `tienda-panel` |
| `img.laboratorio-digital.app` | Las fotos | Dominio personalizado del bucket R2. Sin Worker, con caché |
| `mcp.laboratorio-digital.app` | El MCP del comercio (OAuth) | Ruta de `tienda-api` (`PLATAFORMA.md` §5.5) |
| `origen.laboratorio-digital.app` | Origen de respaldo de Cloudflare for SaaS | Registro sin origen (`AAAA 100::`) con proxy, y la ruta del Worker |
| `<slug>--staging.laboratorio-digital.app`, `panel--staging.…` | Staging: los dos comercios de prueba y el panel | Rutas propias del Worker de staging, más específicas que el comodín. Ningún nombre de tienda lleva `--` (§5.3) |
| `<proyecto>.laboratorio-digital.app` | Un proyecto nuevo del ecosistema, que no es una tienda | Su propio Worker. El nombre se reserva en `infrastructure/dominios.json` antes de usarlo, y la base de control impide que una tienda lo tome o que se reserve el de una tienda que ya existe (`PLATAFORMA.md` §3.4) |

**Sin la Public Suffix List.** La versión 0.1 pedía inscribir el dominio de tiendas en la PSL. Cloudflare no admite como zona un dominio inscrito en ella, salvo en Enterprise (`PLATAFORMA.md` §3.4). Lo que la PSL protegía queda así:

- **Ninguna cookie.** El panel guarda su token en IndexedDB, como el cuaderno. La tienda guarda el carrito en `localStorage`. Los dos son **por origen**, y cada tienda es un origen.
- **Medición de terceros solo en dominios propios.** GA4 y el píxel de Meta, en un subdominio de la plataforma, pondrían sus cookies en `.laboratorio-digital.app`, compartidas entre todas las tiendas y los proyectos. Eso filtraría la identidad de un comprador de una tienda a otra.
  - El panel no ofrece esos scripts a una tienda sin dominio propio.
  - El despacho tampoco los deja cargar (CSP, §11.4).
- **La reputación** se cuida con la ficha legal antes de publicar, el reporte y la suspensión rápida (§4.4). Si un día una tienda hace marcar todo el dominio, el escape es un segundo nivel inscrito en la PSL (`PLATAFORMA.md` §3.4).

### 4.2 Conectar un dominio propio

1. En el panel, el comercio escribe `www.sudominio.co`.
2. La API crea el hostname personalizado con el token de Cloudflare for SaaS (`CF_SAAS_TOKEN`), que solo tiene permiso de hostnames de esa zona (R6).
   - Pide **prevalidación por TXT**: el certificado sale antes de que el tráfico llegue y el cambio no tiene minutos sin HTTPS.
   - Pide **verificación de propiedad por TXT**.
3. El panel muestra los registros exactos y en palabras:
   - `CNAME www → origen.laboratorio-digital.app`;
   - el TXT de propiedad `_cf-custom-hostname.www`;
   - el TXT del certificado `_acme-challenge.www`.
4. Un cron cada 5 min, y cada vez que el comercio abre esa pantalla, pregunta el estado. `dominio.estado` pasa de `pendiente` a `validando` y luego a `activo`, o a `error` con el motivo en palabras (P1).
5. Activo el dominio, el comercio elige si es el **canónico**. Si lo es, el subdominio de la plataforma pasa a `alias` y responde 301 al canónico, con ruta y consulta intactas.
6. El KV se actualiza y la versión vigente se vuelve a hornear con el canónico nuevo. Así cambian el sitemap, los canónicos, el JSON-LD y los feeds.

### 4.3 El dominio raíz

El «apex proxying» de Cloudflare for SaaS es de Enterprise (investigación, por resumen). Sin él:

- **Si el DNS del comercio está en Cloudflare**, o en un proveedor con CNAME flattening o ALIAS, se agrega la raíz como otro hostname personalizado, que redirige a `www`.
- **Si no**, el panel explica cómo redirigir la raíz a `www` desde el proveedor del comercio, con instrucciones para los registradores más comunes del país.
- **Nunca se pide al comercio mover su DNS a nuestra cuenta.** Su zona en una cuenta nuestra sería registrarla a nombre de un tercero (HA2).

### 4.4 Seguridad de los dominios

- **Toma de subdominios colgantes.** Si una tienda se va y deja su CNAME apuntando a nosotros, otra tienda no puede reclamar ese hostname: exige de nuevo la propiedad por TXT.
  - El hostname retirado queda en `tienda_control.dominio` con estado `retirado`, sin borrarse.
  - Un cron diario revisa si los retirados siguen apuntando aquí, y avisa.
- **HSTS:** `max-age=31536000` en las tiendas, **sin `includeSubDomains`** en dominios de comercios, porque sus otros subdominios no son nuestros. En `laboratorio-digital.app` no hace falta pedir nada: el dominio de nivel superior `.app` ya está en la lista de precarga de los navegadores, así que todo el dominio es solo HTTPS.
- **Tiendas fraudulentas** (phishing con marca ajena):
  - los términos de uso las prohíben;
  - cada tienda tiene en su pie el enlace de reporte (`abuse@laboratorio-digital.app`, con el reenvío de correo de la zona);
  - un clic del operador la suspende: `ks:tienda:<org>` y `tienda.estado = 'suspendida'`;
  - la tienda suspendida muestra una página neutra con 451 o 503;
  - `laboratorio-digital.app` está aparte de `laboratorio-digital.com`, así que una tienda fraudulenta no arrastra la reputación del ecosistema ni la del correo del CORE. Sin la PSL sí puede arrastrar a las demás tiendas y a los proyectos de `.app`: por eso la ficha legal va antes de publicar y la suspensión es de un clic.

---

## 5. Modelo de datos

### 5.1 Dónde vive cada dato

| Dato | Dónde | Fuente de verdad | Notas |
|---|---|---|---|
| Comercios, productos, variantes, inventario, pedidos, cobros, solicitudes y ajustes | D1 `tienda_c{N}_s{k}` (anexo A) | Sí | Una tienda entera en un shard |
| Nombres cortos y hostnames | D1 `tienda_control` (anexo B) | Sí | Únicos en todo el producto |
| Qué tienda y qué versión sirve cada hostname | KV `TIENDA_HOSTS` | No: se deriva de D1 | Un cron diario lo reconstruye. Si el KV y D1 difieren, gana D1 y se avisa (P1) |
| Sitios horneados | R2 `sitios/<org>/<versión>/manifiesto.json` y `objetos/<huella>` | No: se derivan de D1 | Inmutables. Se purgan las versiones de más de 90 días que no sean la vigente ni una de las 5 anteriores |
| Fotos | R2 `medios/<org>/<huella>/<ancho>.webp` | Sí (el original no se guarda: el navegador sube las derivadas) | Contenido direccionado. Se borran 30 días después de que ningún producto las use |
| Textos legales aceptados | R2 `legal/<org>/<huella>.md` | Sí | **Sin vencimiento mientras haya pedidos que los citen**: son la prueba de la aceptación (Ley 1480 art. 50 lit. e) |
| Identidad del comercio, roles y plan | CORE | Sí | La celda guarda una copia del plan (`PLATAFORMA.md` §4.13) |
| Llaves de Bold y datos personales | D1, cifrados con las llaves de la tienda (`llave`) | Sí | La KEK solo vive en los secretos del Worker (§14.2) |
| Eventos de medición | Analytics Engine | Sí | Sin datos personales. Nunca en D1 (ED1 §17.1) |
| Respaldos | R2 `respaldos/` y una copia fuera de Cloudflare | Copia | §15.4 |

### 5.2 Mapa

```text
tienda ─┬─ ajuste (por sección) ─ llave (DEK por propósito) ─ credencial (Bold, cifrada)
        ├─ coleccion ─< coleccion_producto >─ producto ─< variante ─< medio
        │                                                   │ └─< movimiento_inventario (trigger)
        │                                                   └─ interes_reposicion (conteos)
        ├─ envio_opcion · cupon · pagina
        ├─ pedido ─┬─< pedido_linea (copias del día) ──> variante
        │          ├── pedido_contacto (sobre cifrado, índice ciego)
        │          ├─< pedido_evento (trigger en cada cambio de estado y de recaudo)
        │          ├── contraentrega (recaudo: por recaudar → recaudado | devuelto | perdido)
        │          └─< cobro ─< apartado (triggers → variante.reservado)
        │               └─< aviso_proveedor (webhooks, sin repetir)
        ├─ solicitud (radicado, sobre cifrado)
        └─ publicacion · registro · operacion · importacion

tienda_control: slug · slug_reservado (con motivo) · dominio (hostname → org, canónico/alias, estado)
referencias:    ref_seccion_ajuste · ref_canal · ref_forma_pago · ref_campo_credencial · ref_pasarela
                · ref_motivo_inventario · ref_tipo_evento · ref_estado_pedido · ref_transicion_pedido
                · ref_estado_cobro · ref_transicion_cobro · ref_estado_contraentrega
                · ref_transicion_contraentrega · ref_tipo_solicitud · ref_motivo_reserva (control)
```

### 5.3 Las tablas

El DDL completo, con un comentario en cada decisión, está en el anexo A. Aquí va lo que hay que saber de cada grupo.

**Referencias** (se siembran en la migración y crecen con `INSERT`, R1). Todo lo que el estudio v1.3 hace crecer está aquí, no en un `CHECK`: un canal de punto de venta, otra pasarela, el facturador del comercio, Bre-B, el traslado entre bodegas.

- `ref_estado_pedido`: cada estado dice si **descuenta** inventario y si es **terminal**.
- `ref_transicion_pedido`, `ref_transicion_cobro` y `ref_transicion_contraentrega`: las únicas transiciones permitidas. Un trigger rechaza las demás.
- `ref_canal`: por dónde llegó el pedido, y si **exige la aceptación** de los términos para pasar de `pendiente` (la web y los agentes sí; el panel y las cargas no).
- `ref_forma_pago`: a convenir, en línea, contraentrega, transferencia y efectivo. Dice si la **verifica la plataforma** (solo en línea) y si lleva **recaudo** de un tercero (contraentrega).
- `ref_campo_credencial` y `ref_pasarela`: los proveedores que el comercio conecta (Bold para cobrar, Alegra para facturar) y los campos de cada credencial.
- `ref_motivo_inventario` y `ref_tipo_evento`: los motivos del libro de inventario y los tipos de evento del pedido.
- `ref_tipo_solicitud`: los plazos en días hábiles de cada tipo (§8.6).
- `ref_seccion_ajuste`: las secciones de ajustes, y si se hornean en el sitio.

**La tienda y sus ajustes:**

| Tabla | Claves | Lo importante |
|---|---|---|
| `tienda` | PK `org_id` (el de la organización del CORE) | `slug` (3–40, `[a-z0-9-]`, sin guion al borde); `estado` (`borrador`, `abierta`, `cerrada`, `suspendida`, `baja`); copia del `plan`; contadores `ultimo_numero` (desde 1000) y `ultima_solicitud`; `version_publicada` |
| `ajuste` | PK `(org_id, seccion)` | Un documento JSON por sección, validado con zod en `packages/tienda-schema`, con su número de `esquema` y una `version` para la concurrencia optimista. Nada secreto (§5.7) |
| `llave` | PK `(org_id, proposito, version)` | DEK envueltas con la KEK, una por propósito: `credenciales`, `datos_personales` e `indices` |
| `credencial` | PK `(org_id, proveedor, ambiente, campo)`; FK `(proveedor, campo)` → `ref_campo_credencial` | Llaves de Bold y, en el nivel intermedio, la del facturador del comercio, cifradas: AES-256-GCM, IV de 12 bytes, AAD con la fila. Solo se ve la `huella` |

**Catálogo:**

| Tabla | Claves | Lo importante |
|---|---|---|
| `producto` | PK `(org_id, id)`; `slug` único entre los no borrados; `ref_externa` única (cargas) | `opciones` en JSON (hasta 3 grupos de hasta 20 valores; el resto lo valida el código). `estado` (`borrador`, `activo`, `archivado`). `retracto` (`aplica` o `no_aplica`, con su motivo). `solo_mayores`. `iva_pct` (0, 5, 19 o nulo). `seo`. Borrado lógico |
| `variante` | PK `(org_id, id)`; única `(org_id, producto_id, clave)`; SKU único | **Toda venta es de una variante.** `precio_cop`, `precio_antes_cop` (debe ser mayor), `stock` (nulo = no se cuenta), `reservado`, `umbral_bajo`. **`CHECK (stock IS NULL OR reservado <= stock)`** es la guarda contra la sobreventa |
| `medio` | PK `(org_id, producto_id, id)` (`id` = SHA-256) | Medidas, `formatos` (anchos 400, 800 y 1600 en WebP) y `alt`. Con `variante_id` es la foto de esa variante |
| `coleccion` y `coleccion_producto` | Muchos a muchos | Un producto en varias colecciones |
| `movimiento_inventario` | Por variante, en orden | Lo escribe **un trigger** en cada cambio de `stock`: `delta`, `stock_resultante`, `motivo` (`venta`, `cancelacion`, `devolucion`, `ajuste`, `carga`, `conteo`) y `ref` |
| `interes_reposicion` | PK `(org_id, variante_id)` | «Avísame»: **solo conteos**, sin datos de nadie |

**Venta:**

- `envio_opcion`: precio, `gratis_desde_cop`, `ciudades` (nulo = todas), `dias_min` y `dias_max`.
- `cupon`: código en mayúsculas; `tipo` (`porcentaje` de 1 a 100, `valor` o `envio_gratis`); mínimo; vigencia; `usos ≤ usos_maximos`. Los usos solo cuentan con el pedido confirmado o pagado.

**Pedidos:**

| Tabla | Claves | Lo importante |
|---|---|---|
| `pedido` | PK `(org_id, id)`; únicos `(org_id, codigo)` y `(org_id, numero)` | `codigo`: 6 caracteres de Crockford, lo genera el navegador y hace idempotente el envío. `numero`: el consecutivo (#1001). `estado`, `canal` y **`forma_pago`**, que se elige mientras está `pendiente`. Montos con `CHECK (total = subtotal − descuento + envío)`. `seguimiento_huella`. **`terminos_huella` + `aceptado`**: obligatorios en todo pedido de un canal que exige aceptación y pase de `pendiente`. **Solo `en_linea` puede estar `por_pagar` o `pagado`, y nunca `confirmado`** (§8.7). `transportadora` y `guia`. `atencion` (`sin_existencias`, `monto`, `datos`). `cambiado_por`, que el trigger lleva al historial. `agente` |
| `pedido_linea` | PK `(org_id, pedido_id, linea)` | **Copias del día**: nombre, opciones, SKU y precio. `CHECK (total = precio × cantidad)`. `descontado` hace idempotente el descuento de inventario |
| `pedido_contacto` | PK `(org_id, pedido_id)` | Sobre cifrado con nombre, celular, correo, dirección y notas. `celular_indice` (HMAC) para buscar. `purgar_despues` |
| `pedido_evento` | Por pedido, en orden | Cada cambio de estado y de recaudo lo escribe un trigger. Las notas, los pagos y las lecturas del contacto, el API |
| `contraentrega` | PK `(org_id, pedido_id)` | La plata de un pedido contra entrega: `estado` con su máquina, `monto_cop`, `comision_cop`, `flete_ida_cop`, `flete_vuelta_cop` (solo si se devolvió), `liquidado` (solo si se recaudó) y `liquidacion_ref`. Nace al despachar (§8.7) |

**Cobro en línea:**

- `cobro`: un intento de pago, por botón o por link. El `id` es la referencia que viaja a Bold (`<código>-<intento>`). `proveedor` → `ref_pasarela`. `monto_cop ≥ 1000`. `estado` con su máquina de estados. `token_huella` (la página pregunta con un token opaco). `consultas`, `ultima_consulta` y `vence`. **Un solo cobro `esperando` por pedido** (índice único parcial).
- `apartado`: `cantidad` por variante; `estado` (`activo`, `consumido`, `liberado`, `vencido`); `vence`. Triggers: crear suma a `reservado`, cerrar resta. Un apartado no cambia de variante ni de cantidad y no vuelve a estar activo.
- `aviso_proveedor`: PK `(org_id, proveedor, aviso_id)`. Un webhook repetido no se aplica dos veces.

**Contenido y operación:**

| Tabla | Qué guarda |
|---|---|
| `pagina` | Páginas propias en Markdown. Las legales se generan; no se escriben aquí |
| `publicacion` | Versiones del sitio (`en_cola` → `horneando` → `lista` → `publicada`/`reemplazada`/`fallida`) con su huella. **Una sola en curso por tienda** (índice único parcial) |
| `solicitud` | Radicado consecutivo por tienda, tipo, pedido, canal, estado, sobre cifrado y vencimiento en días hábiles (§8.6) |
| `registro` | Quién hizo qué, con antes y después |
| `operacion` | Respuestas guardadas por clave `op`: repetir una escritura del panel no la aplica dos veces |
| `importacion` | Cargas con el formato `tienda-import/1` (§17) |

### 5.4 Lo que garantiza la base, y lo que garantiza el código

**La base** (comprobado en `tests/repo/shard-tienda.test.ts`, 82 comprobaciones):

- No hay sobreventa: el segundo comprador de la última unidad falla entero, sin pedido ni cobro, y el consecutivo no avanza.
- El inventario no queda negativo: un pago tardío sin unidades no descuenta y toma el camino «aprobado sin existencias».
- Una línea no puede ser de la variante de otra tienda (FK compuesta con `org_id`).
- Los montos cuadran (`CHECK`).
- Las transiciones de pedido y de cobro son solo las permitidas (triggers con tablas de referencia).
- Todo cambio de estado deja su historial y todo cambio de inventario su fila en el libro (triggers).
- Un pedido de un canal que exige aceptación no pasa de `pendiente` sin su prueba.
- «Pagado» es solo lo que verificó Bold: un pedido que llegó por el chat no llega a `pagado` sin un cobro, y uno confirmado a mano no dice que se pagó en línea.
- La contraentrega no se despacha sin guía ni recaudo, no se entrega sin recaudar, no se devuelve sin decir qué pasó con la plata y no se liquida si no se recaudó.
- La forma de pago se fija al salir de `pendiente`.
- Lo que crece entra con un `INSERT`: la prueba agrega el facturador de un comercio y un canal de punto de venta sin rehacer ninguna tabla.
- Un producto sin retracto dice por qué.
- Un solo cobro esperando por pedido y una sola publicación en curso por tienda.
- Los códigos no tienen letras ambiguas, los cupones no pasan sus usos y los apartados son inmutables.
- En la base de control: una tienda no toma un nombre reservado, no se reserva el nombre de una tienda que ya existe y ningún nombre lleva `--`.
- Toda tabla de datos lleva `org_id` y ninguna clave foránea tiene `ON DELETE CASCADE`.

**El código** (con prueba propia, porque la base no puede saberlo):

- El `org_id` sale del token o del Host, nunca del cuerpo. Se adapta la prueba estática `org-id-en-consultas` del agro.
- Los límites de un pedido: 30 líneas, 200 unidades por línea y COP 5.000.000 para cobrar en línea, el tope del 2.0 y de Bold.
- Los topes de las opciones (3 × 20, 100 variantes).
- El cálculo del total (§6).
- Los plazos en días hábiles con festivos (§8.6).
- La validación de cada sección de ajustes.

### 5.5 Volumen y costo

Filas escritas, contando índices como lo cuenta D1:

| Operación | Filas escritas (aprox.) |
|---|---|
| Crear un producto con 6 variantes y 6 fotos | 1 + 1 (slug) + 6×2 (variante + única) + 6 = **20** |
| Pedido por WhatsApp de 2 líneas, con contacto | pedido 4 + líneas 2 + contacto 2 + contador 1 = **9** (más 2 por evento al confirmar, más 2 por línea en el libro) |
| Pago en línea de 2 líneas, aprobado | pedido 4 + líneas 2 + contacto 2 + contador 1 + cobro 4 + apartados 4 + reservado 2 + aprobación (cobro 1, apartados 2, variantes 2, libro 4, líneas 2, pedido 1, evento 2, aviso 1) = **unas 40** |
| Contraentrega de 2 líneas, de punta a punta | confirmar y descontar como el de WhatsApp + recaudo 2 (fila e índice) + despachar 1 + evento 2 + recaudar 1 + evento 2 + liquidar 2 = **unas 10 más** que un pedido por WhatsApp |
| Publicar (sin cambios de datos) | publicación 2–3. Lo demás va a R2 |

**Lo que eso significa:**

- **Workers Paid incluye 50 millones de filas escritas al mes.** Son más de un millón de pagos en línea al mes. Un shard con 100 tiendas que venden 300 pedidos al mes cada una escribe alrededor de 1,2 millones de filas al mes: el 2,4 % de lo incluido.
- **Almacenamiento:** un pedido con su contacto y su historia ocupa unos 2–3 KB. 300 pedidos al mes son unos 10 MB al año por tienda, y el catálogo unos 2 MB. Con el límite de 10 GB por base, **un shard aguanta unas 800 tiendas‑año**.
- **Regla de shards:** cuando un shard pasa de 5 GB (50 %) se agrega otro a `celdas.json`, y la asignación pone ahí las tiendas nuevas. Mover una tienda entre shards es la mudanza de ARQUITECTURA §6.4 con `tienda-export`.

### 5.6 R2 y KV

```text
R2 tienda-c{N}/
  sitios/<org>/<version>/manifiesto.json   {ruta: {huella, tipo, bytes, cabeceras}} + huella del conjunto
  objetos/<hh>/<huella>                     archivos del sitio por contenido (compartidos entre versiones)
  medios/<org>/<huella>/<400|800|1600>.webp fotos (servidas por img.laboratorio-digital.app)
  legal/<org>/<huella>.md                   términos y política tal como se aceptaron
  respaldos/<shard>/<AAAA-MM-DD>/<org>.json.gz   tienda-export semanal
  exportaciones/<org>/<id>.zip              descargas del comercio (vencen a los 7 días, regla de ciclo de vida)

KV TIENDA_HOSTS
  h:<hostname> → {"org":"…","celda":"c1","shard":"tienda_c1_s1","version":42,
                  "canonico":"www.mitienda.co","estado":"abierta","rol":"canonico"}
KV (flags de la celda): ks:tienda · ks:tienda:<org> · ks:tienda-cobros · ks:tienda-mcp · ks:tienda-horno · nivel
                        vuelta:<org> → dirección de la 2.0 mientras dura el corte de esa tienda (§17.3)
```

### 5.7 Ajustes por sección

| Sección | Campos (resumen) | ¿Se hornea? | ¿Pide entrada reciente? |
|---|---|---|---|
| `identidad` | Nombre visible, logo, ícono, frase | Sí | No |
| `contacto` | WhatsApp (E.164, verificado con un mensaje de prueba que el comercio envía), correo y horario | Sí | **Sí, el WhatsApp**: es por donde llegan los pedidos (en la 2.0, un celular de fábrica mandaba pedidos a otro) |
| `apariencia` | Colores con contraste AA verificado, estilo de portada, orden del catálogo | Sí | No |
| `venta` | Modo de pedido (`whatsapp`, `en_linea` o ambos); formas de pago que ofrece (contraentrega por ciudad, transferencia, efectivo al recoger); abierta o cerrada con su mensaje; pedido mínimo; textos de cómo comprar | Sí | **Sí, el modo** |
| `cobro` | Ambiente de Bold (`pruebas` o `produccion`), tope por pedido y los datos de la transferencia. Estos **no se hornean ni salen por la API pública**: viajan en el mensaje que el comercio manda desde su WhatsApp (§8.7). Es la lección de la 2.0: clonar el sitio y cambiar la llave de pago | No | **Sí, todo** |
| `legal` | Razón social, tipo de persona, NIT o cédula, dirección de notificación judicial, ciudad, teléfono, correo, responsable de IVA, textos de garantía y retracto | Sí | No |
| `medicion` | Identificadores de GA4 y del píxel de Meta (solo con dominio propio, §4.1) y textos del aviso de consentimiento | Sí | No |
| `agentes` | `search`, `ai-input` y `ai-train` (por defecto `yes`, `yes`, `no`), MCP público sí o no, feeds (Google, Meta y agentes) sí o no | Sí | No |
| `avisos` | Correo del resumen diario, hora y umbrales | No | No |

**Vacío nunca es un valor de fábrica (P1).** Un campo obligatorio vacío no se rellena con nada: detiene la publicación con su motivo (§10.2).

---

## 6. Dinero, impuestos y redondeo

`packages/dinero` es la única fuente de estas reglas (P2). La usan el navegador, para mostrar, el API, para cobrar, y el horno.

1. **Pesos enteros.** Ningún `REAL`, ningún decimal. Se muestran como `$80.000` con un formateador propio, no con `Intl`: el resultado de `Intl` cambia entre el navegador, Node y workerd (P17), y el horno tiene que ser determinista.
2. **Los precios incluyen impuestos.** La Ley 1480 art. 50 exige el precio total con impuestos. `iva_pct` es informativo: sirve para un reporte, y para una factura cuando exista.
3. **Orden del cálculo:**
   1. Subtotal: suma de `precio × cantidad`.
   2. Descuento del cupón:
      - `porcentaje`: `⌈subtotal × % / 100⌉`; el redondeo favorece al comprador. *(Hasta el 6 oct 2026 decía `⌊…⌋` con esta misma promesa, y el piso del descuento favorece al comercio: bitácora tienda3 5. Lo implementa `@ed1/dinero`, HU-T1.1.)*
      - `valor`: `min(valor, subtotal)`.
      - `envio_gratis`: no descuenta; pone el envío en 0.
   3. Envío: el de la opción, o 0 si `subtotal − descuento ≥ gratis_desde_cop`.
   4. Total = subtotal − descuento + envío. La base comprueba la igualdad.
4. **Reparto del descuento entre líneas** (para devoluciones parciales): proporcional al total de cada línea, con el método del mayor residuo para que la suma dé exacto. Se calcula cuando se necesita, con la misma función.
5. **Lo que se cobra es lo que se vio.** El navegador manda su total. Si el servidor calcula otro (cambió un precio o se agotó algo), responde con el carrito corregido y los avisos, y **no cobra** hasta que la persona vuelva a aceptar. «No se cobra un carrito distinto del que se vio» (TRASLADO §3).
6. **Límites:** COP 1.000 a 5.000.000 para cobrar en línea, que es el mínimo de Bold y el tope por pedido. El comercio puede bajar el tope en `cobro`.

---

## 7. Inventario y apartados

### 7.1 El modelo

```text
disponible(v) = stock(v) − reservado(v)          (stock nulo: no se cuenta, siempre disponible)
reservado(v)  = Σ apartados activos de v         (lo mantienen los triggers, no el código)
garantía      : CHECK (stock IS NULL OR reservado <= stock)  y  CHECK (stock IS NULL OR stock >= 0)
```

D1 aplica las escrituras de una base de a una, y un `batch` es una transacción. Dos lotes que compiten por la última unidad se ordenan solos: el segundo viola el `CHECK` y se revierte **entero**, sin pedido, sin cobro y sin consecutivo gastado. No hacen falta candados como el `LockService` de la 2.0.

### 7.2 Pagar en línea: un lote

```text
POST /api/v1/cobros  {codigo, items, cupon, envio, entrega, acepta: {terminos_huella}, seguimiento}
  1. Recalcular (§6). Si cambia, responder el carrito corregido (sin escribir).
  2. Un solo batch:
     a. UPDATE apartado SET estado='vencido' WHERE variante IN (…) AND activo AND vence <= ahora
        (vencimiento perezoso: lo vencido de ESAS variantes se libera antes de apartar)
     b. UPDATE tienda SET ultimo_numero = ultimo_numero + 1
     c. INSERT pedido (por_pagar, con terminos_huella y aceptado, numero = el contador)
     d. INSERT pedido_linea × n · INSERT pedido_contacto (sobre cifrado)
     e. INSERT cobro (esperando, vence = ahora + 15 min, token_huella)
     f. INSERT apartado × n  → trigger: reservado += cantidad → CHECK
  3. Firmar el cobro con la llave secreta del comercio y devolver los datos del botón de Bold.
  Si 2 falla por el CHECK: ninguna escritura queda; se responde qué variante no alcanzó.
```

El lote cuesta unas 3 + 3n consultas. Con 30 líneas son unas 95, bien por debajo de las 1.000 por invocación del plan pago.

### 7.3 Cuando Bold responde

| Respuesta | Lote |
|---|---|
| Aprobado, a tiempo | `cobro` → `aprobado`; apartados → `consumido` (trigger: reservado −= cantidad); `variante.stock −= cantidad` con `cambio_motivo = 'venta'` (trigger: libro); `pedido_linea.descontado = 1`; `pedido` → `pagado` (trigger: historial); `cupon.usos += 1` |
| Aprobado **por otro monto** | `cobro` → `revisar`; `pedido.atencion = 'monto'`; aviso al comercio. Los apartados siguen hasta que el comercio decida |
| Aprobado **después de vencer**, con unidades | Igual que a tiempo, desde `vencido` (transición permitida) |
| Aprobado después de vencer, **sin unidades** | El lote normal falla por `stock >= 0` y se corre el de respaldo: `cobro` → `aprobado_sin_existencias`; `pedido` → `pagado` con `atencion = 'sin_existencias'`; no se toca el inventario. El panel lo muestra arriba: el comercio repone o devuelve el dinero. Probado (§5.4) |
| Rechazado | `cobro` → `rechazado`; apartados → `liberado`; `pedido` → `pendiente` (puede intentar otra vez) |
| Sin noticias en 24 h | `cobro` → `vencido`; apartados ya vencidos |
| Anulación aprobada (`VOID_APPROVED`) | `cobro` → `reembolsado`. El pedido lo mueve el comercio (`cancelado` o `devuelto`) con su motivo |

### 7.4 Los demás caminos del inventario

- **Pedido por WhatsApp:** no aparta. Como en la 2.0, solo el pedido confirmado o pagado descuenta. Confirmarlo es un lote que descuenta con la misma guarda. Si no alcanza, el panel lo dice y no confirma (P1).
- **Cancelar o devolver** un pedido que ya descontó suma de vuelta, si el comercio marca «volvió al inventario» (`motivo` `cancelacion` o `devolucion`).
- **Ajuste a mano o conteo:** `cambio_motivo = 'ajuste'` o `'conteo'`. Si el stock nuevo queda por debajo de lo apartado, el `CHECK` lo rechaza y el panel dice «hay N unidades apartadas por pagos en curso».
- **Barrido:** un cron cada 5 min pasa a `vencido` los apartados vencidos de todas las tiendas (higiene; el vencimiento perezoso ya cubre el momento de comprar).
- **Topes contra el abuso:** 40 cobros esperando por tienda (el `MAX_COBROS_ABIERTOS` de la 2.0) y 3 por IP cada 15 minutos (binding de rate limiting). **Los agentes no apartan** (`PLATAFORMA.md` §5.7).
- **Existencias en la vitrina:**
  - Cuando una variante pasa de disponible a agotada, o al revés, se encola un **re-horneado mínimo**: su ficha, el catálogo y los feeds.
  - Si `ks:tienda-horno` está apagado, el JSON-LD queda como estaba y la cotización igual impide vender lo que no hay.
  - Así la disponibilidad que leen Google y los agentes no miente por mucho tiempo.

### 7.5 Varias bodegas: preparadas, no construidas

El nivel alto del estudio incluye varias bodegas (§1.4), y el nivel intermedio limita a una. La v1 guarda el inventario en la variante, con una sola bodega implícita. Cuando llegue su disparador (§20.3), entra con expandir, migrar y contraer, sin rehacer el modelo:

1. **Expandir:** `bodega` (una `principal` por tienda) y `existencia (org_id, variante_id, bodega_id, stock, reservado)`, con el mismo `CHECK (reservado <= stock)`. `apartado` gana `bodega_id`.
2. **Migrar:** cada `variante.stock` y `variante.reservado` pasa a la existencia de la bodega principal, en un lote por tienda. Los triggers de `apartado` y del libro apuntan a `existencia`, y el libro registra `traslado` entre bodegas, que es un `INSERT` en `ref_motivo_inventario`.
3. **Contraer:** `variante.stock` deja de escribirse. Lo que se hornea y se cotiza es la suma de las bodegas que despachan a la ciudad del comprador.

La guarda contra la sobreventa sigue siendo un `CHECK` en una fila, ahora por bodega.

---

## 8. Pedidos

### 8.1 Estados

| Estado | Descuenta | Llega desde | Lo mueve |
|---|---|---|---|
| `pendiente` | No | Nuevo (WhatsApp, agente o panel) · `por_pagar` (pago rechazado) | Comprador o agente (crear); sistema |
| `por_pagar` | No (aparta) | `pendiente` · nuevo (pago en línea) | Sistema |
| `confirmado` | Sí | `pendiente` | Comercio, después de confirmar con el comprador: pagó por fuera (transferencia, efectivo) o va contra entrega. Nunca un pago en línea (§8.7) |
| `pagado` | Sí | `por_pagar` | Sistema: Bold aprobó el botón o el link |
| `despachado` | Sí | `confirmado` · `pagado` | Comercio, con transportadora y guía. Si va contra entrega, nace su recaudo |
| `entregado` | Sí | `despachado` | Comercio. Si fue contra entrega, con la plata recaudada |
| `cancelado` | No (devuelve si había descontado) | `pendiente` · `por_pagar` · `confirmado` · `pagado` | Comercio o sistema |
| `devuelto` | No (devuelve si el comercio lo marca) | `despachado` · `entregado` | Comercio: retracto, garantía, reversión o un envío contra entrega que no se recibió (recaudo devuelto o perdido) |

### 8.2 Canales

- **WhatsApp:**
  1. La persona elige cómo pagar, entre las formas que ofrece la tienda (§8.7). Acepta los términos y toca «Enviar por WhatsApp».
  2. El API registra el pedido `pendiente`, con su forma de pago y su prueba de aceptación.
  3. El navegador abre `wa.me/<número de la tienda>?text=<resumen, forma de pago y enlace de seguimiento>`.
  - Los datos de entrega viajan en el chat. Por eso el contacto es opcional en este canal, como en la 2.0.
  - Si el comercio decide cobrarlo en línea, le manda un **link de pago** (§9.6).
- **En línea:** §7.2.
- **Panel:** el comercio anota un pedido que le llegó por otro lado. Sin prueba de aceptación, porque no la hubo en la web.
- **Agente:** el MCP crea el pedido `pendiente` **sin datos personales ni aceptación**. La persona lo confirma en `/pedido/confirmar/#<token>`, que pide la aceptación y, si quiere pagar, crea el cobro (`PLATAFORMA.md` §5.6).
- **Carga:** pedidos históricos de una importación (§17).

### 8.3 Código y número

- **`codigo`** son 6 caracteres de Crockford (`0-9A-Z` sin I, L, O, U), generados en el navegador una vez por carrito.
  - Es la clave de idempotencia: reenviar el mismo pedido responde `duplicado` y no crea otro (bitácora ecommerce: el doble toque creaba dos pedidos).
  - Probabilidad de choque en una tienda: 1 en unos mil millones por par. El `UNIQUE` la atrapa.
- **`numero`** es el consecutivo humano (#1001, #1002). Lo asigna el lote; un lote fallido no lo gasta.

### 8.4 Seguimiento

1. **El secreto nace en el navegador:** 128 bits en base64url, 22 caracteres. Viaja una vez en el cuerpo y en la base solo queda su SHA-256 (`seguimiento_huella`).
2. **El enlace** es `https://<tienda>/pedido/#c=<código>&s=<secreto>`. El secreto va en el **fragmento**, que no llega a ningún servidor ni queda en un registro (P13). La página lo lee y pregunta por POST a `/api/v1/seguimiento`.
3. **La respuesta** dice el estado en palabras del comprador, los pasos con su fecha, las líneas, el total y la guía si ya se despachó. **Nada del comprador, ni la ciudad.**
4. **Cualquier fallo responde exactamente lo mismo:** código inexistente, secreto malo o pedido sin enlace (heredado de la 2.0). Hay límite por IP.
5. **El comercio** puede generar un enlace nuevo desde el panel. El anterior deja de servir.

### 8.5 Acuse de recibo y prueba

**La Ley 1480 art. 50** (modificado por la Ley 2439 de 2024) exige, antes de comprar:

- un resumen del pedido, imprimible o descargable;
- la aceptación expresa, inequívoca y verificable;
- el acuse de recibo a más tardar el día calendario siguiente, con el plazo de entrega, el precio exacto, el envío y la forma de pago;
- conservar la prueba.

| Exigencia | Cómo |
|---|---|
| Resumen previo descargable | La pantalla de confirmación lo muestra completo y se imprime o guarda como PDF desde el navegador (sin servidor) |
| Aceptación verificable | Casilla **sin marcar** con enlaces a los términos y a la política. El pedido guarda la huella exacta de esos textos (`terminos_huella`) y el instante (`aceptado`). Los textos quedan en R2 por su huella (`legal/`) |
| Acuse de recibo | En el momento: la página de confirmación con código, número, total, plazo de entrega de la opción, forma de pago y enlace de seguimiento, y el mismo resumen en el mensaje de WhatsApp. Por correo si la persona lo dejó (§15.5) |
| Prueba duradera | El pedido, sus líneas (copias del día), su historial y la huella de los términos no se borran. El contacto se purga a su plazo (§14.3), pero la relación comercial queda probada |

### 8.6 Solicitudes, retracto y reversión

- **Radicado.** Cualquier persona abre una solicitud desde el pie de la tienda (`/solicitud/`), con o sin pedido. Recibe un **radicado** (`R-<consecutivo>` con fecha y hora) y la puede seguir. El comercio la atiende en el panel. Lo pide la Ley 2439 art. 4, que modifica el literal g del art. 50.
- **Tipos y plazos** (`ref_tipo_solicitud`):

  | Tipo | Plazo |
  |---|---|
  | Petición, queja o reclamo | 15 días hábiles |
  | Retracto | 5 días hábiles desde la entrega, para ejercerlo (art. 47); reembolso en 15 días calendario |
  | Reversión del pago | Decreto 587 de 2016 |
  | Consulta de datos personales | 10 días hábiles + 5 (Ley 1581 art. 14) |
  | Reclamo de datos personales | 15 días hábiles + 8 (Ley 1581 art. 15) |

- **El vencimiento** se calcula con un calendario de **días hábiles colombianos con festivos**. La Ley 51 de 1983 corre varios festivos al lunes, así que no basta con saltar sábados y domingos. Va en `packages/dinero` o en un `packages/calendario`, con pruebas para cada año, Semana Santa incluida.
- **Avisos al comercio:** el panel avisa a 3 días y el día del vencimiento, y lo incluye en el resumen diario.
- **Retracto por producto:** `producto.retracto`. El comercio marca las excepciones de la ley (perecederos, personalizados, de uso personal…) con su motivo, y la ficha lo dice antes de comprar.
- **Reversión:** el comprador la pide con una solicitud de tipo `reversion`. El comercio la gestiona con Bold. Si Bold anula (`VOID_APPROVED`), el cobro pasa a `reembolsado`.

### 8.7 Formas de pago y contraentrega

El estudio v1.3 pone tres capacidades en el básico colombiano (§8.1 [C3]): la contraentrega con su recaudo, el canal conversacional con link de pago, y la medición de marketing. Las dos primeras están aquí y en §9.6; la tercera, en §11.6.

**Las formas de pago** (`ref_forma_pago`):

| Forma | Quién la verifica | Cómo sigue el pedido |
|---|---|---|
| `a_convenir` | Nadie: se acuerda en el chat | `pendiente` → el comercio la cambia por la que acordaron, o manda un link de pago |
| `en_linea` | **Bold** (botón o link) | `por_pagar` → `pagado` (§7.2, §9) |
| `contraentrega` | La transportadora, al entregar | `confirmado` → `despachado` con su recaudo → `entregado` al recaudar, o `devuelto` |
| `transferencia` | El comercio, con el comprobante que llega al chat | `confirmado` cuando la ve en su cuenta |
| `efectivo` | El comercio, al recoger en el local | `confirmado` |

**Una sola verdad sobre «pagado».** Solo `en_linea` llega a `pagado`, y solo por un cobro que Bold aprobó. Lo que el comercio confirma a mano queda `confirmado`, y la base rechaza un `confirmado` que diga «en línea». Así se cumple el criterio del estudio: «un pedido enviado al chat no figura como pagado». La forma de pago se elige mientras el pedido está `pendiente`; después, cambiarla escondería de dónde salió la plata, y un trigger lo impide.

**Confirmar antes de despachar.** Es la práctica que el estudio asocia a las entregas efectivas (§11.3 [C7]): 80–93 % con confirmación previa, según la transportadora.

- El panel tiene un botón **«Confirmar por WhatsApp»** que abre `wa.me` con un mensaje armado para el comprador: el resumen, la dirección (si la dejó en la web) y lo que sigue según la forma de pago. En una transferencia, el mensaje lleva los datos de la cuenta del comercio, que **no se hornean** (§5.7).
- Lo manda el comercio desde su WhatsApp, sin API de WhatsApp ni plantillas aprobadas (§20.3).
- La máquina de estados lo exige: un pedido contra entrega no pasa de `pendiente` a `despachado` sin estar `confirmado`.

**La contraentrega, de punta a punta** (tabla `contraentrega`, una fila por pedido):

1. **Despachar.** En el mismo lote se crean el recaudo (`por_recaudar`, por el total del pedido, con la comisión de recaudo y el flete de ida si el comercio los conoce) y el despacho con su transportadora y su guía. Sin guía o sin recaudo, la base lo rechaza.
2. **Entregar.** Entregar y recaudar van en el mismo lote: el recaudo pasa a `recaudado` y el pedido a `entregado`. La base no deja entregar con la plata por recaudar.
3. **Liquidar.** Cuando la transportadora consigna, el comercio marca los recaudos de esa liquidación con su número, de a varios. Solo se liquida lo recaudado.
4. **Devolver.** Si el comprador no lo recibe, el recaudo pasa a `devuelto` con el flete de vuelta, la unidad vuelve al inventario si el comercio lo marca (libro: `devolucion`) y el pedido a `devuelto`. Si la transportadora lo pierde, el recaudo queda `perdido`.

**Lo que ve el comercio** (tablero y resumen diario):

- lo **por recaudar** y lo **recaudado sin liquidar**, con su antigüedad: la liquidación tarda de 24 a 72 horas hábiles según la transportadora (estudio §11.3);
- **el margen de cada pedido contra entrega**: total, menos la comisión de recaudo (de 1,5 a 4 % más IVA, en lo observado), menos el flete de ida, menos el de vuelta si se devolvió. Es el costo que el estudio pide poner a la vista: «el costo mayor es el pedido que no se entrega» (§19 [C7]);
- la tasa de devoluciones del mes, que es la cifra que el estudio quiere medir en entrevistas (§17.2).

**Lo que no hace la v1:** cotizar el flete, generar la guía ni seguirla con la API de la transportadora. El comercio escribe la guía. Las guías integradas tienen su disparador en §20.3.

---

## 9. Cobro con Bold, por comercio

### 9.1 Quién cobra

**El dinero va de la tarjeta, el PSE o la billetera del comprador a la cuenta de Bold del comercio.**

- Laboratorio Digital no es el vendedor, no recibe ni retiene fondos de terceros y no cobra comisión sobre las ventas.
- Bold no tiene pagos divididos ni un esquema de plataforma (investigación de pagos), y tampoco hace falta.
- La mensualidad de la tienda se cobra aparte, en el CORE, con el Bold de Laboratorio Digital (`PLATAFORMA.md` §4.8).

### 9.2 Las llaves del comercio

1. **Autorización expresa.** Bold dice que la llave secreta no se comparte con terceros. Antes de pegarla, el comercio acepta en el panel la cláusula de los términos que autoriza a Laboratorio Digital, como encargado, a custodiarla y usarla **solo** para tres cosas:
   - firmar sus cobros;
   - verificar los avisos de Bold;
   - consultar el estado de sus pagos.

   La aceptación queda en `registro` con la huella del texto.
2. **Entrada reciente** (`auth_time` ≤ 10 min, §12.3). Se piden las llaves de identidad y secreta, de pruebas y de producción.
3. **Cifrado:**
   - DEK `credenciales` de la tienda, con AES-256-GCM, un IV de 12 bytes al azar por campo y como AAD `org_id|bold|ambiente|campo`.
   - La DEK va envuelta con la KEK (`TIENDA_KEK_v<n>`, secreto del Worker).
   - Nunca en texto plano, en un log, en el navegador ni en una respuesta. El panel ve solo la huella (los últimos 4 caracteres).
4. **Verificación al guardar.** La llave de identidad se prueba consultando `payment-voucher` de una referencia inexistente:
   - `NO_TRANSACTION_FOUND` (404): la llave es válida.
   - 401 o 403: no lo es, y se dice así.
   - La secreta no se puede probar contra Bold sin un cobro. Se prueba con el **cobro de prueba guiado**: un pago real en el ambiente de pruebas de Bold desde la tienda, que verifica la firma de integridad y el aviso. Sin él, el panel no deja pasar a producción.
5. **Rotación de la KEK.** Una KEK nueva (`kek_id`) reenvuelve las DEK con un trabajo de la cola. La vieja se retira cuando ninguna DEK la usa (P21). Una llave del comercio se rota cuando él la cambia en Bold.

### 9.3 Firmar un cobro

```text
orderId     = <codigo>-<intento>                 (letras, números y guion; único por intento)
amount      = total_cop                          (entero, impuestos incluidos; 1.000–5.000.000)
firma       = hex(SHA-256(orderId + amount + "COP" + llave_secreta))
botón       = { orderId, currency: "COP", amount, apiKey: <identidad>, integritySignature: firma,
                description (≤ 100), redirectionUrl: "https://<tienda>/pedido/pago/",
                renderMode: "embedded", expirationDate: vence en nanosegundos,
                customerData: {email, fullName, phone} si la persona los dio }
```

- **La vuelta no lleva secretos.** Bold le agrega `?bold-order-id=…&bold-tx-status=…`, y esos parámetros **nunca se creen**.
- La página guarda el token opaco del cobro en `sessionStorage` antes de abrir Bold. Al volver, pregunta con él (§9.5).
- Si el token se perdió (la persona volvió en otro navegador), la página ofrece el enlace de seguimiento, que llegó en el acuse.
- **Nota del plan (6 oct 2026):** en el pago en línea el acuse puede no haber salido del navegador que empezó (no hay mensaje de WhatsApp, y el correo es opcional). Por eso la página entrega el enlace de seguimiento **antes** de abrir Bold, para copiarlo o mandárselo por WhatsApp, y lo guarda en el `localStorage` de la tienda (`BACKLOG_TIENDA3.md` HU-T11.9; bitácora tienda3 3).

### 9.4 Avisos de Bold (webhooks)

Bold tiene webhooks firmados para el botón y los links (`SALE_APPROVED`, `SALE_REJECTED`, `VOID_APPROVED`, `VOID_REJECTED`). Se usan como **camino principal**, con la consulta como respaldo.

En la 2.0 no se podían usar: Apps Script no lee las cabeceras de una solicitud.

- **Dónde.** `POST https://<slug>.laboratorio-digital.app/api/v1/avisos/bold`.
  - Es el subdominio de la plataforma, que no cambia aunque la tienda estrene dominio. El slug no se cambia después de publicar.
  - El comercio la registra en su panel de Bold (admite hasta 5 direcciones). El asistente de alta del panel lo guía y lo prueba.
  - Las rutas `/api/*` **no se redirigen** en un alias: un 301 a un POST no lo sigue cualquier cliente.
- **Verificación**, antes de leer el JSON:

  ```text
  cuerpo   = await request.arrayBuffer()                         (crudo, sin parsear)
  cobro    = por metadata.reference → su ambiente → la llave secreta de ESE ambiente (descifrada)
  esperada = hex(HMAC-SHA256(llave, base64(cuerpo)))
  válido   = comparación en tiempo constante con la cabecera x-bold-signature
  ```

  - **En el ambiente de pruebas, Bold firma con una llave vacía.** WebCrypto no importa una llave HMAC de longitud cero. Se usan 64 bytes en cero, que por la definición de HMAC (la llave se rellena con ceros hasta el bloque) dan el mismo resultado. Una prueba lo fija con un vector conocido.
  - **Consecuencia:** cualquiera puede firmar un aviso «de pruebas». Por eso un aviso solo puede mover un cobro **de su mismo ambiente**, y una tienda en pruebas lo dice en una franja visible.
- **Proceso:**
  1. `INSERT OR IGNORE` en `aviso_proveedor` con `subject` + `type`. Si ya estaba, responde 200 (`repetido`).
  2. Si no, aplica la transición (§7.3) en un lote y verifica que `amount.total` sea igual a `monto_cop`; si no, pasa a `revisar`.
  3. Responde **200 en menos de 2 s**, que es lo que exige Bold.
  4. Si algo falla, responde 500 y Bold reintenta hasta 5 veces. El proceso es idempotente, así que un reintento no duplica nada.
- **En desorden.** Una anulación que llega antes que su venta queda en `aviso_proveedor` con resultado `ignorado` y su motivo. La conciliación (§9.5) la reaplica cuando llega la venta.

### 9.5 Consulta y conciliación

- **Desde la página:** `POST /api/v1/cobros/estado {token}`. Si el cobro sigue `esperando` y la última consulta tiene más de 20 s, pregunta a Bold (`GET payments.api.bold.co/v2/payment-voucher/{orderId}` con la identidad) y aplica.
- **Cron cada 15 min.** Revisa los cobros `esperando` de más de 5 minutos **sin aviso**.
  - Espera creciente: 5, 15, 30 y 60 minutos.
  - Como mucho 20 consultas por tienda y por vuelta, porque Bold bloquea por exceso sin publicar la cifra.
  - Con 24 h sin noticias, pasa a `vencido`.
  - Si Bold responde 429, la tienda se salta esa vuelta y se avisa.
- **Estados de Bold** (`PROCESSING`, `PENDING`, `APPROVED`, `REJECTED`, `FAILED`, `VOIDED`, `NO_TRANSACTION_FOUND`): se traducen en un solo sitio, `packages/pagos`.
  - `NO_TRANSACTION_FOUND` y `PENDING` siguen esperando.
  - `REJECTED` y `FAILED` son rechazo.
  - `VOIDED` es reembolso.

### 9.6 Links de pago (en M3, con el botón)

El estudio pone el canal conversacional en el básico, con prioridad alta: «botón de WhatsApp y link de pago con el pedido identificado» (§8.1 [C3]). Por eso el link entra con el botón, no después.

La API de links de Bold (`POST integrations.api.bold.co/online/link/v1`, con la llave de identidad del comercio) crea un enlace con monto cerrado, referencia y vencimiento.

**El pedido que llegó por el chat, cobrado en línea:**

1. En el panel, el comercio toca **«Cobrar con link»** en un pedido `pendiente`.
2. En un lote, el pedido pasa a `en_linea` y `por_pagar`, se crea el cobro `esperando` con la referencia `<código>-<intento>` y se apartan las unidades hasta el vencimiento del link: 60 minutos por defecto y como máximo 24 horas, que elige el comercio.
3. La API pide el link a Bold y el panel abre `wa.me` con el enlace, para que el comercio se lo mande al comprador.
4. El aviso firmado y la consulta son los de §9.4 y §9.5. Si el link vence sin pago, el cobro pasa a `vencido`, los apartados se liberan y el pedido vuelve a `pendiente`.

El link sirve también para el **traspaso de un pedido preparado por un agente** (`PLATAFORMA.md` §5.6), cuando la persona prefiere pagar desde el chat.

### 9.7 Lo que no se hace

- **No se tocan datos de tarjeta.** El checkout es el de Bold, embebido: no hay PCI que cumplir más allá de no interferir con él.
- **No se reembolsa por API.** El comercio anula desde su panel de Bold, y el aviso `VOID_APPROVED` lo refleja aquí.
- **No se guarda un medio de pago del comprador.**
- **No se cree en la página de vuelta** ni en lo que diga el navegador sobre un pago.

**Comisiones de referencia** (las paga el comercio, antes del IVA de la comisión). La fuente es el estudio, §10.2, con el tarifario oficial de Bold; si difieren, manda el estudio (P2):

| Medio, en línea | Comisión |
|---|---|
| Tarjeta Visa o Mastercard | 2,99 % + $900 |
| PSE, Bancolombia y billeteras | 2,89 % + $900 |
| QR en línea | 2,89 % |
| Depósito inmediato | 3,59 % + $900 |

- **El plazo es un precio** (estudio §10.2 [C4]): recibir el dinero de inmediato cuesta 0,6 puntos más que al día siguiente. La pantalla de cobro del panel lo explica, porque el comercio lo elige en su cuenta de Bold.
- **En el pedido pequeño pesa el cargo fijo:** en uno de COP 20.000, la comisión de PSE es el 7,4 %. El tablero muestra la comisión estimada de cada cobro.
- Encima van el IVA de la comisión y, en tarjeta, la retención que aplique al comercio.

---

## 10. Horneado y publicación

### 10.1 Qué se hornea, por tienda

| Archivo | Para |
|---|---|
| `/index.html`, `/c/<colección>/`, `/p/<producto>/` (+ `index.md` de cada uno) | Comprador, buscadores y agentes |
| `/catalogo.json` (lo que usa la página para el carrito y el buscador) y `/catalogo.md` | Página y agentes |
| `/legal/{terminos,privacidad,envios,retracto,garantia}/` (+ `.md`) | Ley 1480 y Ley 1581, generados con la ficha legal y la política de datos de la tienda |
| `/pedido/`, `/pedido/pago/`, `/pedido/confirmar/`, `/solicitud/` | Las páginas dinámicas, que son estáticas con su JavaScript |
| `/tema-<huella>.css` | Colores y tipografía de la tienda. Así la CSP de estilos queda en `'self'` |
| `/robots.txt`, `/sitemap.xml`, `/llms.txt`, `/.well-known/{api-catalog, agent-skills/index.json, mcp/server-card.json, security.txt}`, `/skills/comprar/SKILL.md` | Agentes (§11.8) |
| `/feeds/google.xml`, `/feeds/meta.csv`, `/feeds/productos.jsonl` (si `agentes.feeds`) | Listados gratuitos de Google, el catálogo de Meta (Instagram, Facebook y WhatsApp) y el feed de productos con el formato ACP. El estudio pone el catálogo para Meta y Google en el básico (§8.1 [C3]) |
| `/manifest.webmanifest`, íconos | Instalar la tienda en el teléfono |

Los assets comunes a todas las tiendas (`/_t/<release>/app.js`, `app.css` y las fuentes) son Workers Static Assets de `tienda-sitio`: gratis y fuera de R2.

### 10.2 La compuerta de publicación

Las comprobaciones miran **lo que se va a publicar**, no la suite de desarrollo (lección de la 2.0). Corren **todas** y el panel muestra todas las fallas de una vez (P15):

1. **Ficha legal completa:** razón social o nombre, NIT o cédula, dirección de notificación judicial, ciudad, teléfono y correo (Ley 1480 art. 50 lit. a).
2. Ninguna página pública contiene `[`, `{{`, `undefined`, `NaN` ni un valor de fábrica (P1).
3. Al menos un producto `activo` con precio y foto.
4. Si el modo incluye WhatsApp, un número verificado. Si incluye pago en línea: llaves verificadas, cobro de prueba hecho y ambiente `produccion` (o una franja «tienda en pruebas» visible).
5. Las opciones de envío tienen un plazo. Si alguno pasa de 30 días calendario, el texto lo dice, porque sin pacto el máximo es 30 (Ley 2439).
6. Todo producto `no_aplica` en retracto tiene su motivo.
7. El enlace a la SIC y el de solicitudes están en el pie.
8. El HTML pasa el validador y los presupuestos de peso (§1.3).
9. Los enlaces internos existen. Las huellas de las habilidades y del manifiesto coinciden.

### 10.3 El proceso

```text
panel «Publicar» → API: compuerta (§10.2) → INSERT publicacion (en_cola, version = max + 1)
                  → Queue tienda-horno: {org, version}
consumidor (tienda-api):
  1. publicacion → horneando (si otra está en curso, el índice único lo impide: se reintenta)
  2. leer los datos de la tienda (pocas consultas; dentro de 1.000 por invocación)
  3. hornear: packages/tienda-horno (funciones puras) → archivos {ruta → bytes}
  4. huella de cada archivo; los que no están en el manifiesto anterior → PUT objetos/<huella>
  5. PUT sitios/<org>/<version>/manifiesto.json (con la huella del conjunto)
  6. verificar: releer el manifiesto y comprobar el número de archivos y las huellas (P16)
  7. si la huella del conjunto es la de la versión publicada → «Nada cambió», sin versión nueva
  8. KV h:<hostname> → version, para cada hostname activo de la tienda
  9. tienda.version_publicada = version; publicacion → publicada; la anterior → reemplazada
Falla en cualquier paso → publicacion → fallida con el motivo; el sitio sigue en la versión anterior.
```

- **Por qué cola y no la solicitud del panel:** el horneado de una tienda grande (2.000 productos) puede pasar de lo que conviene esperar en una solicitud, y la cola reintenta sola. Con Workers Paid, el consumidor tiene hasta 5 minutos de CPU.
- **Costo:** clase A de R2 solo por los archivos nuevos. Republicar con un precio cambiado escribe la ficha, el catálogo, los feeds y el manifiesto: unos 6 objetos.

### 10.4 Determinismo

Los mismos datos y el mismo código del horno dan **los mismos bytes**:

- Ni el reloj ni el azar entran al HTML. La fecha `generado` va solo en el manifiesto.
- Todo se ordena por una clave estable.
- El JSON se serializa con las claves ordenadas.
- El formato de pesos es propio (§6).
- La prueba hornea dos veces y en dos runtimes (Node y workerd con `getPlatformProxy`), y exige bytes idénticos (P17).

### 10.5 Volver atrás

- **Desde el panel**, «Versiones» lista las publicadas con fecha, autor y resumen de cambios. «Volver a esta» escribe el puntero en el KV y `version_publicada`.
  - No hornea: es instantáneo, con la propagación de KV de hasta unos 60 s.
  - Los datos no cambian: volver atrás el sitio no deshace pedidos ni inventario.
- **Volver atrás los datos** es otra capa: Time Travel de D1 (30 días en el plan pago) o una exportación. Lo hace el operador con su runbook, nunca un botón del comercio, porque traería el pasado encima del presente (bitácora ecommerce 77).

### 10.6 Re-horneado por versión del código, por anillos

Cuando una versión nueva del producto cambia las plantillas, todas las tiendas necesitan su HTML nuevo. No se hornean todas a la vez:

1. Anillo 1 (las tiendas piloto).
2. Pasadas 24 h sin errores en las comprobaciones de la tienda, el resto, en tandas.

Cada versión del sitio guarda la versión del horno que la hizo. Los assets comunes de una release (`/_t/<release>/`) **se conservan 90 días**: una página horneada con la release anterior sigue cargando sus scripts mientras su tienda no se re-hornea (P10).

---

## 11. El sitio público

### 11.1 El despacho

```text
fetch(request):
  host = minúsculas(request.headers.host) sin puerto
  sitio = cacheEnMemoria(host, 30 s) ?? KV.get("h:" + host)        ── nada → 404 «Esta dirección no tiene tienda» (P1)
  si ks:tienda o ks:tienda:<org> apagado → página de tienda cerrada (503, Retry-After)
  si sitio.rol = alias y GET/HEAD → 301 a https://<canónico><ruta y consulta>
  si ruta empieza por /api/ , /mcp , /_m → TIENDA_API.fetch(request con «x-tienda: org, shard») (binding de servicio)
  si ruta empieza por /_t/ → ASSETS (comunes)
  variante = "md" si Accept contiene text/markdown y existe el gemelo; si no "html"
  manifiesto = cacheEnMemoria(org/versión) ?? R2.get(sitios/<org>/<versión>/manifiesto.json)
  archivo = manifiesto[ruta normalizada (+ index.html | index.md)] ── nada → 404 horneado de la tienda
  respuesta = caches.default.match(clave: host + versión + ruta + variante)
           ?? R2.get(objetos/<huella>) → guardar en caché del borde
  cabeceras del manifiesto (tipo, CSP de la tienda, Link, Vary: Accept, HSTS, nosniff, Referrer-Policy)
```

- **La versión va en la clave de caché.** Publicar cambia la versión, y con ella la clave: no hace falta purgar nada.
- **La cabecera `x-tienda` la pone solo el despacho.** `tienda-api` no tiene rutas públicas, así que nadie de afuera puede escribirla (§3.1). Aun así, `tienda-api` la ignora si la solicitud no llegó por el binding.
- **CPU objetivo:** menos de 2 ms por solicitud de página. La prueba de carga lo mide.

### 11.2 Direcciones de una tienda

```text
/                       portada            /p/<producto>/        ficha (variantes en la misma página)
/c/<colección>/         colección          /buscar/?q=           buscador (en el navegador, sobre catalogo.json)
/carrito/               carrito            /pedido/#c=…&s=…      seguimiento
/pedido/pago/           vuelta de Bold     /pedido/confirmar/#…  confirmar un pedido preparado por un agente
/solicitud/             radicar            /legal/<texto>/       textos legales
```

Las direcciones de producto usan el `slug`. Cambiar el `slug` deja un 301 desde el anterior, horneado en el manifiesto.

### 11.3 La página

- **Islas Preact** sobre HTML horneado: la ficha se lee sin JavaScript, que es la regla del rastreador y del agente (P20).
- **El carrito** vive en `localStorage` de la tienda, con el código del pedido generado una vez.
- **Al tocar «Enviar por WhatsApp» o «Pagar»**, la página cotiza (`/api/v1/cotizar`) y muestra el resumen con la casilla de aceptación sin marcar (§8.5).

### 11.4 CSP y scripts

```text
default-src 'self'; script-src 'self' https://checkout.bold.co [+ los de medición, solo con consentimiento];
style-src 'self'; img-src 'self' https://img.laboratorio-digital.app data:; connect-src 'self' [+ medición];
frame-src https://checkout.bold.co; form-action 'self' https://checkout.bold.co;
base-uri 'none'; object-src 'none'; frame-ancestors 'none'
```

La CSP de cada tienda se calcula al hornear según sus ajustes y va en el manifiesto. Una prueba compara lo que declara la política de datos de la tienda con lo que la página carga de verdad (como la e2e del cuaderno).

### 11.5 Fotos

- **El panel comprime en el navegador.** Genera WebP de 400, 800 y 1600 px y sube las derivadas. El original no sale del teléfono (browser-first).
  - **Nota del plan (6 oct 2026):** Safari no codifica WebP en `canvas.toBlob` y devuelve PNG (bitácora agro, terreno). Ahí las derivadas salen en JPEG, y la ruta (`<ancho>.<formato>`) y `medio.formatos` dicen el formato real (`BACKLOG_TIENDA3.md` HU-T8.3; bitácora tienda3 2).
- **Las fotos se sirven** desde `img.laboratorio-digital.app/<org>/<huella>/<ancho>.webp`, que es un dominio personalizado de R2, sin Worker, con `Cache-Control: public, max-age=31536000, immutable`.
- **La página usa `srcset`**, carga diferida y medidas explícitas, sin saltos de diseño.

### 11.6 Medición y consentimiento

- **Medición propia**, sin cookies, sin IP y sin identificadores. `POST /_m` envía lotes de eventos al Analytics Engine:
  - eventos: `ver_producto`, `agregar_al_carrito`, `iniciar_pedido`, `pagar_en_linea` y `pago_confirmado`;
  - campos: `item_id`, `quantity`, `value` y `currency`;
  - el índice es la tienda.
  - Como no trata datos personales, no pide consentimiento. Así lo dice la política de la tienda.
- **GA4 y el píxel de Meta**, solo si el comercio los configura y solo con dominio propio (§4.1).
  - **No cargan hasta que la persona acepta** en un aviso donde rechazar es tan fácil como aceptar.
  - El consentimiento se guarda en el navegador con la versión del aviso.
  - No se encontró una guía específica de la SIC sobre cookies. Se aplican el consentimiento previo, expreso e informado de la Ley 1581 y la prohibición del silencio como autorización (Decreto 1377 art. 7).
- **Los eventos se reconcilian con los pedidos**, que es el criterio del estudio para la medición de marketing (§8.1 [C3]):
  - todo evento de compra, propio o de terceros, lleva el `codigo` del pedido como identificador de la transacción, así GA4 y Meta no lo cuentan dos veces;
  - el tablero compara cada semana los pedidos de la base con los eventos `pago_confirmado` y `iniciar_pedido`, y muestra la diferencia: lo que no midieron los bloqueadores o el rechazo del consentimiento, y lo que se midió sin pedido;
  - la base manda: las ventas del tablero salen de los pedidos, nunca de los eventos.
- **La conversión del lado del servidor** (la API de conversiones de Meta) queda fuera del MVP, con su disparador (§20.3).

### 11.7 Buscadores y vista previa

- **JSON-LD:**
  - `Product` con `Offer` por variante: precio, `priceCurrency: COP` y `availability` según el inventario al hornear (§7.4);
  - `BreadcrumbList`;
  - `Organization` con la ficha legal;
  - `WebSite` con su `SearchAction`.
- **Open Graph** completo, para que un enlace pegado en WhatsApp muestre la foto, el nombre y el precio.
- **`sitemap.xml`** con `lastmod` por producto.
- **La tienda en `borrador`** se sirve con `noindex` y fuera del sitemap, solo para revisarla.

### 11.8 Legible por agentes (por tienda)

| Archivo o capacidad | Contenido |
|---|---|
| `robots.txt` | Familias de agentes (`content/agentes.json`), `Disallow: /api/`, `Content-Signal` de la sección `agentes`, `Sitemap` |
| `llms.txt` | Qué vende la tienda, cómo pedir, plazos, políticas, contacto, enlaces a `catalogo.md` y a los textos legales |
| Gemelos `.md` + negociación | Cada página tiene su `index.md`. El despacho entrega el Markdown con `Accept: text/markdown` (`Vary: Accept`). El HTML lo anuncia con `<link rel="alternate">` y con `Link` |
| `/.well-known/api-catalog` | La API pública de la tienda (§13.2) con su OpenAPI 3.1 (`/openapi.json`), generada desde los esquemas zod |
| `/.well-known/agent-skills/index.json` + `/skills/comprar/SKILL.md` | Cómo comprar en esta tienda: dónde está el catálogo, cómo preparar un pedido por la API o el MCP, que el pago lo hace una persona, plazos y políticas. Con su `sha256` |
| `/.well-known/mcp/server-card.json` + `/mcp` | El MCP público (§13.4), si `agentes.mcp` está encendido |
| Feeds | `/feeds/productos.jsonl` (campos del feed de ACP), `/feeds/google.xml` (listados gratuitos de Google) y `/feeds/meta.csv` (catálogo de Meta), si `agentes.feeds` está encendido |
| `/.well-known/ucp` | **No se publica** hasta que haya un manejador de pago para Colombia (`PLATAFORMA.md` §5.6) |

### 11.9 Accesibilidad y rendimiento

- **WCAG 2.2 AA:** contraste verificado al guardar los colores, controles con etiqueta, foco visible y `autocomplete` correcto en los datos de entrega (`name`, `tel`, `email`, `street-address`).
  - Los agentes que usan el navegador leen el árbol de accesibilidad: lo que sirve a una persona con lector de pantalla les sirve a ellos.
- **Pruebas:** axe en las e2e, Lighthouse CI con presupuestos y un teléfono de 360 px.

---

## 12. El panel

### 12.1 Entrar y roles

- **Se entra con el CORE**, con Google o con un enlace por correo (`PLATAFORMA.md` §4.11), con `producto = tienda`.
- **Se elige la tienda** cuando la persona tiene varias.
- **Las invitaciones** son del CORE: enlace por WhatsApp con el código en el fragmento.

| Rol | Puede |
|---|---|
| `propietario` (`administra`) | Todo: incluidas llaves de cobro, dominio, equipo, plan y exportación |
| `colaborador` | Productos, inventario, pedidos (ver datos de entrega para despachar), envíos, cupones, páginas y publicar. **No**: cobro, dominio, equipo, plan, exportar datos personales ni el modo de pedido |

La matriz es un dato (`packages/tienda-schema/permisos.ts`), compartida por el panel, que esconde, y el API, que decide. Lo que no está en la matriz está negado (como el agro, HU-E4.5).

### 12.2 Pantallas

Inicio (tablero) · Pedidos (con «Confirmar por WhatsApp» y «Cobrar con link») · Recaudos (contraentrega por recaudar y por liquidar) · Productos · Colecciones · Inventario (con el libro) · Envíos · Cupones · Páginas · Solicitudes · Ajustes (por sección) · Dominio · Cobro · Publicar y versiones · Equipo · Plan · Registro · Exportar e importar.

El tablero muestra:

- ventas, pedidos, ticket y tasa de cierre, del día, del mes y del mes anterior a la misma altura;
- lo que hay que hacer: pedidos por confirmar o por despachar, recaudos atrasados, solicitudes por vencer, cobros a revisar y agotados;
- el margen de los pedidos contra entrega y la comisión estimada de los cobros en línea (§8.7, §9.7).

### 12.3 Lo que pide una entrada reciente

Cambiar las llaves de Bold, el ambiente o el tope de cobro, los datos de la transferencia, la credencial del facturador, el número de WhatsApp o el modo de pedido exige `auth_time` de hace menos de 10 minutos. Si es más viejo, el API responde `401 reautenticar` y el panel abre la entrada con Google o con un enlace por correo.

Es la regla de la 2.0, «lo que mueve la plata pide la clave otra vez», con el CORE en lugar de una clave del panel.

### 12.4 Concurrencia e idempotencia

- **Concurrencia optimista.** Cada escritura lleva la `version` que leyó. `UPDATE … WHERE version = ?` sin filas responde `cambiado`, con la versión actual para comparar. Nadie pisa el cambio de otro sin verlo.
- **Idempotencia.** Cada escritura lleva su clave `op`. Repetirla devuelve la misma respuesta guardada en `operacion` (se purga a las 48 h).

### 12.5 Datos personales en el panel

En la 2.0, los datos de entrega no salían por ninguna puerta: el comercio los leía en su hoja. En la 3.0 no hay hoja, así que el panel es el único camino, y por eso es estricto:

- Los datos se muestran **tapados**: «María F.», «300 ••• 4567».
- «Ver datos de entrega» los descifra para ese pedido y deja la lectura en `pedido_evento` (`contacto_leido`) y en `registro`.
- Exportar datos personales es solo para el propietario, con entrada reciente, y queda registrado.

### 12.6 Exportar

«Descargar todo» produce el formato `tienda-export/1`: el mismo de la carga (§17), en JSON, con las fotos por enlace. Las hojas CSV o XLSX se arman en el navegador desde ese JSON.

Es la respuesta a «¿de quién son mis datos?», y es también el respaldo y la mudanza entre shards (P2: un solo formato).

---

## 13. API

### 13.1 Convenciones

- JSON en el cuerpo.
- Errores con **RFC 9457** (`application/problem+json`): `type`, `title`, `detail` en palabras del comercio o del comprador, y `errores` por campo.
- Versión en la ruta (`/api/v1`). Contratos que solo crecen (§2).
- Esquemas zod en `packages/tienda-schema`, de los que sale la OpenAPI 3.1 pública.
- Límites con `RateLimit-Policy` y `RateLimit`, y `Retry-After` en 429 y 503.
- Escrituras del panel con `op` y `version` (§12.4).

### 13.2 Pública (por el Host de la tienda)

| Ruta | Pide | Responde | Límite |
|---|---|---|---|
| `POST /api/v1/cotizar` | `items`, `cupon`, `envio`, `ciudad` | Subtotal, descuento, envío, total, avisos, cobrable, carrito corregido | 30 por min por IP |
| `POST /api/v1/pedidos` | `codigo`, `items`, `cupon`, `envio`, `ciudad`, `forma_pago`, `acepta`, `seguimiento`, `contacto?` | Pedido `pendiente`: número, total y texto para WhatsApp. `duplicado: true` si el código ya existe. La forma de pago tiene que ser una de las que ofrece la tienda | 10 por hora por IP |
| `POST /api/v1/cobros` | Lo anterior, más `entrega` | §7.2: datos del botón de Bold y token | 3 por 15 min por IP; 40 abiertos por tienda |
| `POST /api/v1/cobros/estado` | `token` | Estado del cobro (sin datos personales) | 1 consulta a Bold por 20 s por cobro |
| `POST /api/v1/seguimiento` | `codigo`, `secreto` | §8.4, con el mismo error para todo fallo | 20 por hora por IP |
| `POST /api/v1/solicitudes` | `tipo`, `pedido?`, `contacto`, `texto`, `acepta` | Radicado con fecha y hora | 5 por hora por IP |
| `GET /api/v1/solicitudes/{radicado}` + `POST` con el secreto | — | Estado y respuesta | Igual que seguimiento |
| `POST /api/v1/avisame` | `variante` | `ok` si está agotada (suma 1) | 10 por hora por IP |
| `POST /api/v1/avisos/bold` | Webhook firmado | 200 (§9.4) | — |
| `POST /_m` | Lote de eventos | 204 | 60 por min por IP |
| `POST /mcp` | MCP (Streamable HTTP) | §13.4 | §13.4 |

### 13.3 Panel (`panel.laboratorio-digital.app/api/panel/v1/*`, token del CORE con `aud = tienda`)

| Grupo | Rutas |
|---|---|
| Sesión | `GET sesion`: tienda, rol, plan y funciones del plan |
| Alta | `POST alta`: slug, nombre y ajustes vacíos; crea `tienda`, reserva el slug y el hostname de la plataforma |
| Catálogo | `productos` (listar y buscar), `productos/guardar`, `productos/estado`, `productos/borrar` (papelera), `productos/restaurar`, `variantes/guardar`, `medios/subir` (derivadas WebP), `medios/ordenar`, `colecciones/*` |
| Inventario | `inventario/ajustar` (`motivo`), `inventario/libro?variante=` |
| Pedidos | `pedidos?estado&forma&q&cursor`, `pedidos/{id}`, `pedidos/{id}/estado` (con guía y, contra entrega, su recaudo en el mismo lote), `pedidos/{id}/forma` (mientras esté pendiente), `pedidos/{id}/link` (link de pago de Bold, §9.6), `pedidos/{id}/contacto` (descifra y registra), `pedidos/{id}/seguimiento` (enlace nuevo), `pedidos/{id}/nota`, `pedidos/crear` (canal panel) |
| Recaudos | `recaudos?estado&cursor`, `recaudos/{pedido}/estado` (recaudado, devuelto o perdido, con sus costos), `recaudos/liquidar` (varios recaudos con el número de una liquidación) |
| Venta | `envios/*`, `cupones/*`, `paginas/*` |
| Ajustes | `ajustes` (todas las secciones, con su esquema), `ajustes/{seccion}` (guardar; algunas piden entrada reciente) |
| Cobro | `cobro/llaves` (guardar y verificar; entrada reciente), `cobro/prueba` (cobro de prueba guiado), `cobro/estado` (ambiente y última verificación) |
| Factura (nivel intermedio, M8) | `factura/credencial` (guardar y verificar; entrada reciente), `factura/estado`, `pedidos/{id}/factura` (emitirla en el facturador del comercio) |
| Dominio | `dominios`, `dominios/agregar`, `dominios/{host}/estado`, `dominios/{host}/canonico`, `dominios/{host}/retirar` |
| Publicar | `publicar` (compuerta + cola), `publicaciones`, `publicaciones/{v}/volver` |
| Solicitudes | `solicitudes?estado`, `solicitudes/{id}`, `solicitudes/{id}/responder`, `solicitudes/{id}/estado` |
| Operación | `tablero`, `registro?cursor`, `exportar`, `importaciones` (revisar y aplicar, §17), `avisame/{variante}/atendido` |
| Servicio | `POST /api/servicio/plan`: CORE → celda, con el token de servicio (`PLATAFORMA.md` §4.13) |

### 13.4 MCP público de la tienda

Servidor sin estado (Streamable HTTP) en `https://<tienda>/mcp`, con su Server Card.

| Herramienta | Entrada | Salida | Toca D1 |
|---|---|---|---|
| `buscar_productos` | `consulta?`, `coleccion?`, `max_precio?`, `limite ≤ 20` | Productos con nombre, precio desde, disponibilidad aproximada y enlace | No: lee `catalogo.json` horneado |
| `ver_producto` | `producto` (slug) | Ficha, variantes con precio y disponibilidad, políticas de envío y retracto | No |
| `consultar_disponibilidad` | `items` | Lo mismo que `cotizar`: total, avisos, cobrable | Lectura |
| `preparar_pedido` | `items`, `envio?`, `ciudad?` | Pedido `pendiente` de canal `agente`, **sin datos personales**, con el enlace `https://<tienda>/pedido/confirmar/#<token>` para que la persona lo confirme y pague, y el texto para WhatsApp | Escritura. 5 por hora por IP; 50 pendientes de agente por tienda |
| `seguimiento_de_pedido` | `codigo`, `secreto` | Igual que `/api/v1/seguimiento` | Lectura |

**Instrucciones del servidor** (las que lee el agente):

- el pago y la aceptación los hace la persona;
- los precios incluyen IVA;
- hay derecho de retracto salvo en los productos marcados.

Los pedidos preparados y nunca confirmados se cancelan solos a las 48 h.

---

## 14. Seguridad, privacidad y cumplimiento

Sin contador ni abogado por ahora (decisión 5 del dueño): **cada obligación legal se traduce en un control técnico verificable.** Las normas se leyeron en su texto (copias de SUIN-Juriscol y Función Pública en repositorios públicos) o por resumen, como dicen las fuentes. Interpretarlas no es asesoría legal: cuando haya presupuesto, un abogado revisa los textos generados (§20).

### 14.1 Amenazas y controles

| Amenaza | Control | Prueba |
|---|---|---|
| Una tienda lee datos de otra | `org_id` del token o del Host, nunca del cuerpo. FK compuestas con `org_id`. Shards | Prueba estática de consultas (`org-id-en-consultas`) y e2e con los dos comercios de prueba (P4) |
| Alguien finge ser el despacho (`x-tienda`) | `tienda-api` sin rutas públicas. Además, una cabecera con `SECRETO_DESPACHO` que comparten solo los dos Workers | Llamar al API sin el binding: 404 |
| XSS guardado en una descripción o una página | Markdown sin HTML, esquemas de URL permitidos (`https`, `mailto`, `tel`, `wa.me`) y todo escapado al hornear. CSP sin `unsafe-inline` | Corpus de cargas XSS en el horno, con control negativo |
| Robo de la sesión del comercio | Sesión por producto. Access de 12 h. Teléfonos revocables. Entrada reciente para lo que mueve dinero. Registro | Pruebas del CORE (`PLATAFORMA.md` §6.4) |
| Fraude con tarjetas desde la tienda | El checkout es de Bold, con sus controles. Límites por IP, tope de cobros abiertos y monto mínimo. Regla de rate limiting del WAF en la zona `laboratorio-digital.app` | Pruebas de carga contra staging |
| Vaciar el inventario a punta de apartados | 15 minutos de vida, tope por tienda y por IP. Los agentes no apartan | Caos: 100 cobros simultáneos |
| Webhook falso | HMAC con la llave del comercio. Un aviso de pruebas solo mueve cobros de pruebas | Vectores con llave real y vacía |
| Fuga de la llave secreta de Bold o de datos personales | Cifrado de sobre con AAD. Ni logs ni respuestas. La KEK fuera de la base | Prueba que busca llaves y datos personales en los logs de las e2e |
| Toma de subdominios | Propiedad por TXT; hostnames retirados que no se borran; cron de revisión (§4.4) | Reclamar un hostname retirado sin TXT: falla |
| Tienda fraudulenta | Términos, ficha legal antes de publicar, reporte en el pie, suspensión con un clic y un dominio aparte del ecosistema (§4.4) | Runbook de suspensión con simulacro |
| Un sitio clonado cambia los datos de la transferencia | Esos datos no se hornean ni salen por la API pública: viajan en el mensaje del comercio (§5.7, §8.7) | Ningún archivo horneado ni respuesta pública los contiene (prueba sobre los horneados) |
| Cuenta de Cloudflare o GitHub comprometida | Segundo factor, tokens con alcance mínimo por propósito, recuperación aparte (`PLATAFORMA.md` §3.5) | Revisión trimestral de tokens |
| Inyección de instrucciones a agentes | `PLATAFORMA.md` §5.7 | — |

**Turnstile no es la defensa principal.** El plan gratuito admite 10 hostnames por widget, y «cualquier hostname» es de Enterprise (investigación de la cuenta). Con dominios de comercios no escala. Se usa solo en `panel.` y en el alta de tiendas.

### 14.2 Cifrado

| Pieza | Diseño |
|---|---|
| **KEK** (llave maestra) | 32 bytes al azar, secreto del Worker `TIENDA_KEK_V<n>`. **A diferencia de la llave del CORE, no nace dentro del Worker.** Perder la del CORE cierra sesiones; perder la KEK pierde datos. La genera el dueño con `scripts/tienda/generar-kek.ts`, que la guarda en el ambiente de GitHub y le pide **una copia fuera de línea** (gestor de contraseñas). El despliegue la carga por stdin |
| **DEK** por tienda y propósito | AES-256-GCM al azar, una por `credenciales`, `datos_personales` e `indices`. Envuelta con la KEK, con AAD `org\|proposito\|version`, en `llave` |
| Campo cifrado | AES-256-GCM, IV de 96 bits al azar por escritura, AAD `org\|tabla\|campo\|id`. Copiar un cifrado a otra fila o a otra tienda no descifra |
| Índice ciego | `HMAC-SHA256(DEK indices, celular en E.164)`, truncado a 128 bits. Busca sin guardar en claro |
| Rotar la KEK | KEK nueva → la cola reenvuelve todas las DEK → la vieja se retira cuando ninguna la usa |
| Rotar una DEK | Versión nueva para lo que se escribe. Lo viejo se vuelve a cifrar en segundo plano o se queda con su versión |
| **Borrado criptográfico** | Dar de baja una tienda, ofrecida su exportación y pasados 30 días, borra su DEK `datos_personales`. Los respaldos de llaves se retienen 35 días y Time Travel guarda 30, así que **el borrado es efectivo a los 35 días** como máximo. Así lo dice la política |

### 14.3 Ley 1581 de 2012: controles técnicos

| Obligación | Control |
|---|---|
| **Roles.** El comercio es responsable de los datos de sus compradores. Laboratorio Digital es su **encargado**, y responsable de los datos de sus propios usuarios (los comercios) | **Contrato de transmisión** (Decreto 1377 art. 25) que el comercio acepta al dar de alta su tienda: alcance, actividades, obligaciones, seguridad, confidencialidad y subencargados con su ubicación (Cloudflare en Estados Unidos y el proveedor de correo). Aceptación registrada con la huella del texto |
| **Política de tratamiento** (Decreto 1377 art. 13) | Generada por tienda con su ficha: identidad, finalidades, derechos, canal, procedimiento y vigencia. Horneada en `/legal/privacidad/`. Sin ficha no se publica |
| **Autorización** previa, expresa e informada; el silencio no vale | Casilla sin marcar en cada pedido y en cada solicitud. La huella de los textos y el instante quedan en el pedido. Las novedades son una casilla aparte (`acepta_novedades`) |
| **Mínimo necesario** | WhatsApp sin contacto. Pedidos de agentes sin datos personales. Solo la ciudad en claro. «Avísame» sin datos de nadie |
| **Consultas y reclamos** (10 + 5 y 15 + 8 días hábiles) | Solicitudes `datos_consulta` y `datos_reclamo`, con vencimiento en días hábiles. Herramientas del panel para exportar, corregir y suprimir los datos de un comprador (búsqueda por índice ciego) |
| **Seguridad** (arts. 4 g, 17 d, 18 b) | §14.1 y §14.2 |
| **Incidentes** | Runbook: detectar, contener, avisar a los comercios afectados y reportar a la SIC en 15 días hábiles (Circular Externa 003 de 2018). Queda en el registro |
| **Conservación** | `pedido_contacto.purgar_despues`: 24 meses después del pedido, ajustable de 12 a 60 meses por el comercio. El cron purga. El pedido sin contacto sigue siendo la prueba de la venta |
| **Transmisión internacional** | Con contrato de transmisión no requiere autorización adicional del titular (Decreto 1377 art. 24). Además, la Circular 005 de 2017 de la SIC incluye a Estados Unidos entre los países con nivel adecuado. Su vigencia en 2026 no se pudo verificar |
| **RNBD** | Solo para sociedades con activos de más de 100.000 UVT (Decreto 090 de 2018). No aplica hoy a Laboratorio Digital. El panel se lo explica al comercio y le exporta el inventario de sus bases |

### 14.4 Ley 1480 de 2011 y Ley 2439 de 2024: controles técnicos

| Exigencia | Dónde |
|---|---|
| Art. 50 lit. a: identidad del proveedor siempre visible | Pie horneado con la ficha legal. La compuerta la exige (§10.2) |
| Lit. b: información del producto, vigencia de la oferta, disponibilidad y escala de las imágenes | Ficha con descripción, variantes, disponibilidad del inventario y `alt` |
| Lit. c: medios de pago, plazo de entrega, retracto y precio total con impuestos y envío aparte, **antes** de comprar | Resumen previo (§8.5) con el plazo de la opción de envío |
| Lit. d: resumen descargable, aceptación expresa y verificable, acuse de recibo al día siguiente como máximo | §8.5 |
| Lit. e: prueba en soporte duradero | Pedido, líneas, historial y textos aceptados en R2 sin vencimiento mientras se citen |
| Lit. f: seguridad de los medios | §14.1 |
| Lit. g (Ley 2439): solicitudes con radicado, fecha, hora y seguimiento | §8.6 |
| Lit. h (Ley 2439): entrega en el plazo pactado, o máximo 30 días calendario; si no hay producto, aviso y reembolso en 15 días calendario | Plazo en cada opción de envío. Recordatorio del panel por pedido sin despachar. «Sin existencias» lleva un reloj de 15 días |
| Parágrafo: enlace visible a la SIC | Pie horneado (compuerta) |
| Art. 47: retracto en 5 días hábiles, con excepciones; reembolso en 15 días calendario (Ley 2439) | `producto.retracto` con motivo. Solicitud `retracto`. Reloj de reembolso en el panel |
| Art. 48: prueba de la aceptación de las condiciones | `terminos_huella` + `aceptado` |
| Art. 51 y Decreto 587 de 2016: reversión del pago | Solicitud `reversion`. El `VOID_APPROVED` de Bold se refleja en el cobro |
| Art. 52: menores de edad | `producto.solo_mayores`: confirmación de edad antes de agregarlo al carrito, guardada en el pedido |
| Art. 53 y Ley 2439 art. 6: portal de contacto | La plataforma **no tiene directorio común de tiendas**. Si algún día lo tiene, ya guarda la ficha legal de cada comercio, que es el registro que esos artículos piden. Se revisa antes de construirlo (§20) |

### 14.5 Facturación electrónica: integrar la del comercio, no emitir

Sin contador no se fija ninguna obligación (decisión 5 del dueño). Lo que sí está claro, por el estudio (§11.2 [C6]): **integrar el sistema que ya usa el comerciante antes que emitir**.

- El facturador más barato observado cuesta lo mismo que una tienda (Alegra, desde COP 17.900 al mes, por ingresos del negocio).
- Bold incluye la facturación electrónica entre los beneficios de su cuenta, para quien cobra con ellos. Su alcance y sus límites no se revisaron.

**Cómo entra** (nivel intermedio, hito M8):

1. **Un adaptador `DocumentoFiscal`**, como `ProveedorDePago`. El primero es Alegra, que documenta la creación de facturas desde pedidos por REST (estudio S52). La facturación de Bold se evalúa en cuanto se conozca su alcance.
2. **La credencial del facturador es del comercio**, cifrada como las llaves de Bold. `credencial` ya la admite: Alegra está en `ref_campo_credencial` desde la v1, sin rehacer nada.
3. **Una tabla `factura`**, en su propia migración (0002), con el pedido, el proveedor, el número o el código que devuelva y su estado. No entra en la v1 porque no la usa nadie hasta M8.
4. **Los datos del comprador que pida la factura se piden solo a quien la quiera**, y van en su sobre cifrado (mínimo necesario, Ley 1581).
5. **Ningún documento se llama «factura»** si no salió del facturador: un PDF del pedido es un resumen, no una factura electrónica (estudio §11.2).

Ya están los datos que determinan la obligación: tipo de persona y responsable de IVA, en `legal`, e `iva_pct` por producto.

**Se vigilan dos puntos:**

- **ET art. 616-1 inc. 8** (Ley 2155 de 2021): obliga a las plataformas de comercio electrónico a ofrecer un servicio de facturación a sus usuarios. A julio de 2026 no estaba reglamentado. Si se reglamenta, el disparador de emitir está en §20.3.
- **El reporte DPI** de la Resolución DIAN 000227 de 2025: hay que validar si aplica.

### 14.6 Secretos

| Secreto | Dónde | Para |
|---|---|---|
| `TIENDA_KEK_V<n>` | Ambiente de GitHub → Worker (stdin), **más una copia fuera de línea** | §14.2 |
| `CF_SAAS_TOKEN` | Ambiente de GitHub → Worker de la API | Hostnames personalizados de la zona `laboratorio-digital.app`, y nada más |
| Los de la cuenta (ARQUITECTURA §7.5) | Ambientes de GitHub, como hoy | Desplegar y leer métricas. Es la misma cuenta: no hay secretos nuevos por cuenta |
| `CELDA_SERVICE_TOKEN` | CORE y celda | `PLATAFORMA.md` §4.13 |
| `SECRETO_DESPACHO` | `tienda-sitio` y `tienda-api` | §14.1 |
| `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` | Como hoy | Alertas |

Cuando se implemente, cada uno se lista en ARQUITECTURA §7.5, que es lo que exige su prueba.

---

## 15. Operación

### 15.1 Presupuesto (`apps/tienda-*/product.yaml`)

Para la etapa de 100 tiendas:

| Recurso | Presupuesto | Lo incluido en Workers Paid (de toda la cuenta) |
|---|---|---|
| Solicitudes a Workers | ≤ 3 M/mes | 10 M/mes |
| Filas escritas en D1 | ≤ 3 M/mes | 50 M/mes |
| Filas leídas en D1 | ≤ 200 M/mes | 25.000 M/mes |
| R2 | ≤ 10 GB · clase A ≤ 200 k/mes · clase B ≤ 3 M/mes | 10 GB · 1 M · 10 M |
| KV | lecturas ≤ 3 M/mes · escrituras ≤ 20 k/mes | 10 M · 1 M |
| Correo | ≤ 3.000/mes | 3.000/mes |
| **Dinero** (`usd_mes`) | **≤ USD 10/mes** sobre los 5 de la cuota | — |

Lo incluido lo comparten el agro y el CORE. Hoy consumen una fracción, que el vigía mide; si la suma de los presupuestos declarados pasa de lo incluido, el excedente se factura y el presupuesto en dinero lo dice (`PLATAFORMA.md` §3.2).

### 15.2 Kill switches

| Clave | Efecto |
|---|---|
| `ks:tienda` | Todas las tiendas muestran «volvemos pronto». El panel queda en solo lectura |
| `ks:tienda:<org>` | Una tienda: suspensión o falla aislada |
| `ks:tienda-cobros` | Se apaga el pago en línea. Las tiendas siguen recibiendo pedidos por WhatsApp |
| `ks:tienda-mcp` | MCP público y del comercio apagados |
| `ks:tienda-horno` | No se publica nada nuevo. Lo publicado sigue sirviéndose |

### 15.3 Crons (con Workers Paid)

> *Hoy, en el plan gratuito, queda un cron libre de los 5 de la cuenta: cómo caben estas frecuencias es la decisión D-T10 del backlog (bitácora tienda3 7).*

| Frecuencia | Qué hace |
|---|---|
| 5 min | Apartados vencidos. Estado de los hostnames en validación |
| 15 min | Conciliación de cobros (§9.5) |
| 1 h | Vigía: consumo y costo proyectado (`PLATAFORMA.md` §4.10) |
| Diario | Plan desde el CORE. Reconstruir el KV de hostnames desde D1. Reservados de `infrastructure/dominios.json` en la base de control. Purgas: papelera a 30 días, `operacion` a 48 h, exportaciones a 7 días, contactos vencidos. Revisión de hostnames retirados. Resumen diario a los comercios, con los recaudos atrasados. Pedidos preparados por agentes sin confirmar a 48 h |
| Semanal | `tienda-export` de cada tienda a R2, y copia fuera de Cloudflare (§15.4) |

### 15.4 Respaldos y restauración

1. **Time Travel de D1:** 30 días en el plan pago, cualquier minuto.
2. **`tienda-export` semanal** por tienda en R2. Se guardan 4 semanales y 3 mensuales.
3. **Una copia semanal fuera de Cloudflare,** ya cifrada, porque los datos personales van en sus sobres. Va al Google Drive del dueño, con la llave fuera de Google (ADR-30, que reemplazó la copia mensual con proveedor por elegir que decía esta sección: bitácora tienda3 4). La construye HU-C11.4 del CORE, y HU-T17.3 le suma las bases de la Tienda. Cubre la suspensión de la cuenta (ED1 §20.3), que con todo en una cuenta es el riesgo mayor (`PLATAFORMA.md` §3.1).
4. **Simulacro trimestral** en staging (P16): restaurar una tienda de prueba en un shard vacío y comparar huellas tabla por tabla. Restaurar es **unir** lo que falta, nunca reemplazar el presente (bitácora ecommerce 77).

### 15.5 Correo

- **Servicio de correo de Cloudflare**, con Workers Paid: 3.000 al mes incluidos para toda la cuenta. Está en beta pública desde abril de 2026 (investigación, por resumen).
- **Detrás de un adaptador** (`CorreoTransaccional`), para cambiarlo por otro sin tocar el producto.
- **Remitente:** `«<Tienda>» <pedidos@laboratorio-digital.app>`, con `Reply-To` al correo del comercio. SPF, DKIM y DMARC en `laboratorio-digital.app`. El correo del CORE sale de `laboratorio-digital.com`: una tienda que acumule reportes de spam no afecta los enlaces para entrar (`PLATAFORMA.md` §4.11).
- **Mensajes:**
  - el acuse al comprador, si dejó su correo;
  - el resumen diario al comercio;
  - los avisos de solicitudes por vencer;
  - el resultado del cobro de prueba.
- **Tope por tienda y por día**, para que una tienda no gaste la cuota de todas.

### 15.6 Runbooks

Se escriben con el hito que los necesita:

- alta de una tienda;
- conectar un dominio;
- suspender una tienda;
- rotar la KEK;
- incidente de datos personales;
- restaurar una tienda;
- agregar un shard;
- volver atrás una versión del código.

---

## 16. Calidad y pruebas

- **Siempre dos comercios de prueba, con datos distintos (P4):**
  - **Comercio Ensayo Uno**: ropa, variantes de talla y color, inventario, pago en línea y dominio propio de prueba;
  - **Comercio Ensayo Dos**: panadería, sin inventario, solo WhatsApp y subdominio de la plataforma.
  - Los nombres de las tiendas reales van a la lista de términos prohibidos.
- **Control negativo en cada aserción nueva (P5).** El PR dice cuál fue.

| Capa | Qué se prueba |
|---|---|
| Funciones puras | `dinero` (tabla de casos: cupones, redondeo, reparto por mayor residuo), `calendario` (festivos por año, Semana Santa, prórrogas), `tienda-schema` (cada sección, cada versión), `tienda-horno` (archivos dorados; **mismo resultado en Node y en workerd**, P17) |
| Base | Este esquema en D1 local con `getPlatformProxy`: las 82 comprobaciones de `tests/repo/shard-tienda.test.ts` (HU-T2.1), más la receta de reconstrucción (`PLATAFORMA.md` §4.4) |
| API con D1 local | Cotizar, pedir, cobrar, avisos con vectores de firma (llave real y vacía), conciliación con un Bold falso que implementa de verdad la firma y los estados (P17), permisos de la matriz, concurrencia optimista e idempotencia |
| e2e (Playwright, 360 px, axe) | Comprador: catálogo → WhatsApp; catálogo → pago con Bold en el ambiente de pruebas, en staging, de punta a punta (P16); pedido contra entrega → confirmar por WhatsApp → despachar → recaudar → liquidar; pedido del chat → link de pago → pagado. Comercio: producto con variantes y fotos → publicar → volver atrás; colaborador con sus límites. Agente: un cliente MCP prepara un pedido y la persona lo confirma |
| Caos | La última unidad entre 50 compradores. Avisos repetidos y en desorden. Bold con 5xx y 429. KV con un hostname viejo. Horno que falla a la mitad. Publicar mientras entran pedidos |
| Seguridad | Corpus de XSS. Aislamiento estático de consultas. Llaves y datos personales ausentes de los logs. CSP declarada contra la cargada |
| Rendimiento | Lighthouse CI con los presupuestos de §1.3. Cero consultas a D1 por visita |
| Cumplimiento | La compuerta con cada dato legal faltante. Ningún corchete público. El pie con la SIC y el radicado |
| Agentes | `verificar-agentes.ts` contra cada tienda de prueba (`PLATAFORMA.md` §5.8) |

---

## 17. Carga de las tiendas actuales (scripts, después)

El dueño lo pidió así: el diseño no depende de la 2.0. Sus datos entran con un **formato de carga** general, y un script propio de la 2.0 los traduce.

### 17.1 El formato `tienda-import/1`

```json
{
  "formato": "tienda-import/1",
  "tienda": { "slug": "ensayo-uno", "nombre": "Comercio Ensayo Uno" },
  "ajustes": { "identidad": { … }, "contacto": { … }, "legal": { … }, "venta": { … } },
  "colecciones": [ { "ref_externa": "C1", "nombre": "Vestidos", "slug": "vestidos" } ],
  "productos": [ {
    "ref_externa": "P001", "nombre": "Vestido", "descripcion_md": "…", "estado": "activo",
    "opciones": [ { "nombre": "Talla", "valores": ["S", "M"] } ],
    "variantes": [ { "valores": ["S"], "sku": "VS-S", "precio_cop": 80000, "stock": 3 } ],
    "medios": [ { "url": "https://…/foto.webp", "alt": "Vestido rosa", "variante": ["S"] } ],
    "colecciones": ["C1"]
  } ],
  "envios": [ … ], "cupones": [ … ], "paginas": [ … ],
  "pedidos": [ { "codigo": "…", "creado": "…", "estado": "entregado", "lineas": [ … ], "totales": { … } } ]
}
```

**Reglas:**

- **Idempotente por `ref_externa`.** Cargar dos veces no duplica.
- **«Revisar» antes de aplicar:** responde **todos** los problemas de una vez (P15), sin escribir nada.
- **Se aplica por partes,** dentro de los límites de D1, y nunca borra antes de escribir (P21).
- **Pedidos históricos:** opcionales, con canal `carga` y **sin datos personales**, salvo que el comercio confirme que tiene la autorización de sus compradores para trasladarlos.
- **Es el mismo formato de la exportación** (§12.6): una tienda que se va de la plataforma se lleva lo que necesita para volver.

### 17.2 Los scripts

- **`scripts/tienda/cargar.ts`** (Node/TS, corre en la máquina del dueño, P3):
  - lee un `tienda-import/1`;
  - descarga las fotos y genera sus derivadas WebP;
  - sube las fotos y la carga por la API del panel con el token del operador.
- **`scripts/tienda/desde-2.0.ts`** lee la exportación XLSX de la hoja de una tienda 2.0 **por nombre de columna** y produce el `tienda-import/1`. El mapa de columnas vive solo en este script: la 3.0 no conoce la 2.0.

### 17.3 El cambio de una tienda que ya vende

**Antes de cargarla**, la 3.0 pasa la lista de paridad del anexo C: hace todo lo que esa tienda usa hoy de la 2.0. Es lo que queda del contrato de puertas de la 2.0 (estudio §15.3 [C12]): una especificación para comparar, no un contrato que se hereda.

**Cuál va primero:** la que esté más cerca de un techo de la 2.0 (estudio §15.3 [C12], confirmados en su arquitectura 1.0.0):

- una cuenta de Google por tienda, con su segundo factor y una credencial que caduca;
- 30 ejecuciones simultáneas de Apps Script por cuenta, que consumen los pedidos, las validaciones y el panel en un pico;
- 20.000 filas en la hoja de pedidos, unos 6.000 a 10.000 pedidos;
- un Worker por tienda, con 100 por cuenta en el plan gratuito, que la cuenta comparte con CultivoPro.

**El cambio:**

1. Cargar en `borrador` (con `noindex`) y revisar con el comercio.
2. Conectar el dominio con prevalidación (§4.2) o preparar la redirección.
3. **Corte:**
   - publicar la 3.0;
   - en la 2.0, poner `tienda_abierta = No` con un mensaje que lleva a la dirección nueva, para que nadie pida en la vieja;
   - si la tienda vivía en un subdominio de `laboratorio-digital.com`, una regla de redirección 301 en esa zona, con la ruta y la consulta, hacia `<slug>.laboratorio-digital.app` o su dominio propio. Es la misma cuenta, así que es una regla más.
4. **Vuelta atrás, con una marca por tienda** (el cuarto insumo de [C12]):
   - la 2.0 queda intacta en solo lectura 30 días;
   - en el KV de flags, `vuelta:<org>` guarda la dirección de la 2.0. Con la marca puesta, el despacho responde 302 a esa dirección, con la ruta, en todos los hostnames de la tienda;
   - volver es abrir la 2.0, quitar la regla 301 y poner la marca. Los pedidos tomados en la 3.0 se exportan con `tienda-export`.
5. Pasados 30 días sin volver atrás, se quita la marca y se retira la 2.0. Su hoja queda con el comercio (P21).
6. **Enlaces de seguimiento viejos:** si se quieren conservar, el script puede cargar sus huellas en una tabla aparte, con una ruta heredada en el despacho. **No está en el esquema v1**; se agrega con su migración solo si se decide.

---

## 18. Costos

Con las tarifas de Workers Paid reunidas en `../plataforma/cuenta-cloudflare.md` (por resumen; se confirman antes de fijar precios). Supuestos por tienda y mes:

- 5.000 visitas de 3 páginas;
- 300 pedidos (un tercio pagados en línea);
- 60 MB de fotos y sitio;
- la tercera parte de las tiendas con dominio propio;
- 50 correos.

| Concepto | 100 tiendas | 500 tiendas | 2.000 tiendas |
|---|---|---|---|
| Workers Paid (cuota de la cuenta, compartida) | USD 5 | USD 5 | USD 5 |
| Solicitudes (1,5 / 7,5 / 30 M) | incluidas | incluidas | 20 M × 0,30 = USD 6 |
| CPU (unos 2 ms por solicitud) | incluida | incluida | unos USD 0,6 |
| Filas escritas en D1 (1,2 / 6 / 24 M) | incluidas | incluidas | incluidas |
| Almacenamiento D1, al año | 1,2 GB, incluido | 6 GB, unos USD 0,75 | 24 GB, unos USD 14 |
| R2 (6 / 30 / 120 GB) | incluido | unos USD 0,3 | unos USD 1,6 |
| Lecturas de KV (con caché en memoria y del borde) | incluidas | incluidas | hasta unos USD 10 |
| Hostnames de Cloudflare for SaaS (33 / 165 / 660) | incluidos | 65 × 0,10 = USD 6,5 | 560 × 0,10 = USD 56 |
| Correo (5.000 / 25.000 / 100.000) | unos USD 0,7 | unos USD 8 | unos USD 34 |
| **Total al mes** | **unos USD 6** | **unos USD 21** | **unos USD 127** |
| **Por tienda al mes** | USD 0,06 | USD 0,04 | USD 0,06 |

**Lectura:**

- La infraestructura cuesta centavos por tienda. En pesos, la cuota de Workers Paid son unos COP 16.534 al mes con la TRM de COP 3.306,86 del 28 sep 2026 (estudio §7.4, S98); la TRM está en el radar del estudio, que la revisa cada mes (§17.1 [C13]).
- Lo que más pesa a escala es el dominio propio (USD 0,10 por hostname al mes). Por eso está en los planes pagos.
- El costo real del producto sigue siendo el tiempo: soporte por comercio, que es una métrica de validación del estudio (§16.3).

---

## 19. Hitos

Supone 20 horas por semana del dueño, con Claude haciendo los commits. Cada hito deja algo en staging o en producción, con sus pruebas, y no rompe lo anterior.

> **Las historias, los sprints y las fechas de estos hitos están en `BACKLOG_TIENDA3.md`** (6 oct 2026), que es la fuente del plan. Dos cambios frente a esta tabla: el **tablero** pasa de M5 a M2, porque el anexo C lo exige antes de cargar una tienda (bitácora tienda3 1), y las fechas salen de la velocidad que el dueño alcanza a validar, no de estas semanas (`BACKLOG_TIENDA3.md` §6.2).

| Hito | Semanas | Depende de | Deja funcionando | Criterio de aceptación |
|---|---|---|---|---|
| **M0 · Fundación** | 2 | Plataforma P0–P1. Workers Paid activo y la zona `laboratorio-digital.app` en la cuenta (`PLATAFORMA.md` §3.2, §9) | `apps/tienda-*`, `tienda-schema`, `dinero`, `cifrado`, `calendario`. Migraciones de este documento. Producto `tienda` en `productos.json` y los reservados en `dominios.json`. KEK y secretos. Los dos comercios de prueba. El vigía en modo pago. Despliegue a staging (`<slug>--staging`) | Migraciones aplicadas en D1 de staging con la receta. Las 82 comprobaciones en D1 local. El CORE de staging emite tokens `aud=tienda` |
| **M1 · La tienda pública** | 4 | M0 | Despacho, horno (portada, colecciones, fichas, legales, archivos para agentes), compuerta, carrito, cotizar, pedido por WhatsApp con su forma de pago (a convenir, contraentrega, transferencia o efectivo), seguimiento, solicitudes con radicado. Alta por el operador con `tienda-import` | Los dos comercios publicados en staging. Presupuestos de Lighthouse. Cero D1 por visita. e2e del comprador por WhatsApp |
| **M2 · El panel** | 6 | M1, plataforma P2 | Entrar, productos con variantes y fotos, inventario, pedidos y contacto auditado, confirmar por WhatsApp, despacho con guía, recaudos de contraentrega y liquidación, envíos, cupones, páginas, ajustes, publicar, versiones y volver atrás, equipo, registro, exportar | e2e del comercio y del colaborador, y la de contraentrega de punta a punta. Volver atrás en menos de 60 s |
| **M3 · Cobrar** | 3 | M2 | Llaves cifradas, cobro de prueba guiado, apartados, botón y **links de pago** (§9.6), avisos de Bold, conciliación, acuse, reembolso reflejado | Pago real en el ambiente de pruebas de Bold de punta a punta en staging, con el botón y con un link. Batería de caos en verde |
| **M6 · Las tiendas actuales** | 2 | M3 | Scripts de carga. La marca de vuelta a la 2.0. Las dos tiendas 2.0 en la 3.0 (§17.3) | Cada tienda vende en la 3.0 una semana sin volver atrás. Antes, pasa la lista de paridad del anexo C |
| **M4 · Dominios, alta y plan** | 2 | M3, plataforma P3 | Hostnames personalizados con prevalidación, canónico y alias, alta por el comercio, cobro del plan por 1, 3, 6 o 12 meses, suspensión | Un dominio de prueba conectado sin minutos sin HTTPS. Un plan semestral pagado en pruebas |
| **M5 · Medición y tablero** | 1–2 | M2 | `/_m` → Analytics Engine, tablero, resumen diario, reporte semanal, consentimiento para GA4 y Meta, feeds de Google y Meta, y la reconciliación de eventos con pedidos | El tablero cuadra con los pedidos de los comercios de prueba, y la diferencia con los eventos se ve |
| **M7 · Agentes** | 2 | M1, plataforma P5 | MCP público, feed de agentes, habilidad de compra, OpenAPI y `verificar-agentes` por tienda. MCP del comercio | Un cliente MCP real prepara un pedido que la persona confirma y paga |
| **M8 · Factura integrada** (nivel intermedio) | 2 | M4 | Adaptador `DocumentoFiscal` con Alegra, credencial cifrada, migración 0002 (`factura`) y la sección de ajustes `factura` | Una factura de prueba emitida en la cuenta de pruebas del facturador desde un pedido pagado, sin pedir al comprador más datos de los que la factura necesita |

- **Hasta vender con las tiendas actuales** (M0, M1, M2, M3 y M6): unas **17 semanas**.
- **Con todo:** unas **25**.
- **Las tiendas actuales pasan antes del alta abierta (M4)** a propósito: validan con comercios reales antes de abrir la puerta a otros.
- **Las métricas de validación del estudio** (§16.3: pago real, soporte por comercio, retención y cobro confiable) se toman desde M6, con los umbrales fijados antes de medir.

---

## 20. Riesgos y decisiones abiertas

### 20.1 Riesgos

| Riesgo | Prob. | Impacto | Mitigación |
|---|---|---|---|
| El panel tarda más de lo previsto: es el trabajo más grande | Alta | Alto | Hitos con valor propio. M1 ya vende por WhatsApp con la carga del operador. La 2.0 sigue mientras tanto |
| Bold cambia o restringe que una plataforma use las llaves de sus comercios | Media | Alto | Autorización expresa del comercio. Preguntar a Bold por un esquema de integradores (`PLATAFORMA.md` §9). `ProveedorDePago` permite agregar Wompi, que tiene eventos firmados y tokenización |
| Se falsifican avisos de pruebas (llave vacía) | Alta | Bajo | Solo mueven cobros de pruebas, y la tienda en pruebas lo dice (§9.4) |
| Una tienda fraudulenta hace marcar todo `laboratorio-digital.app`, que no está en la PSL (§4.1) | Baja | Alto | Sin cookies. Medición de terceros solo con dominio propio. Ficha legal, reporte y suspensión con un clic. Escape a un segundo nivel inscrito en la PSL (`PLATAFORMA.md` §3.4) |
| La contraentrega se devuelve más de lo previsto (7–20 % de los pedidos, según el estudio) y el comercio no lo ve | Media | Medio | Confirmar por WhatsApp antes de despachar. El margen de cada recaudo, con sus dos fletes, a la vista (§8.7) |
| Leer mal una norma sin abogado | Media | Alto | Cada control se puede verificar y está en un solo sitio (los textos se generan): corregir es cambiar una plantilla y re-hornear todas las tiendas. Revisión de un abogado cuando haya presupuesto |
| Los correos caen en spam | Media | Medio | SPF, DKIM y DMARC, un solo remitente por tienda, tope diario y nada de promociones en el MVP |
| La observabilidad empieza a cobrar por GB (dic-2026) | Alta | Bajo | Muestreo de logs, nada de cuerpos en los logs, y presupuesto en el vigía |
| Re-hornear todas las tiendas en cada versión | Media | Medio | Por anillos y en tandas por la cola. Los assets de la release anterior se conservan 90 días (§10.6) |

### 20.2 Decisiones del dueño

Ya decididos el 5 oct 2026: el dominio (`laboratorio-digital.app`, sin PSL), la cuenta (la de siempre) y los periodos (1, 3, 6 y 12 meses).

1. **Los planes:** si se adoptan los cuatro niveles del estudio, con qué límites (15 productos en `gratis`, 3 colaboradores en `intermedio`) y con qué precios por periodo. Antes, preguntar a los dos comercios reales lo que pagan hoy por tienda, facturación, mensajes y envíos (estudio §16.2).
2. **Qué formas de pago ofrece una tienda de fábrica** al darse de alta. La propuesta: a convenir y transferencia; contraentrega y efectivo, cuando el comercio las active.
3. **La conservación de los datos de contacto** por defecto: 24 meses propuestos.
4. **`ai-train` de las tiendas:** la propuesta es `no` por defecto, y que cada comercio decida.
5. **Las dos tiendas antes del alta abierta** (orden M6 → M4), propuesto.
6. **El proveedor de correo:** el de Cloudflare con Workers Paid, o uno externo detrás del adaptador (`../plataforma/proveedores-de-computo.md`).
7. **Revisión legal de las plantillas** cuando haya presupuesto.

### 20.3 Lo que no hace, y cuándo lo haría

| Fuera del MVP | Disparador |
|---|---|
| Cuentas de comprador | Más del 30 % de los pedidos de una tienda son de compradores que repiten, y lo piden |
| Directorio o marketplace de tiendas | Nunca sin tratarlo antes como portal de contacto (Ley 2439 art. 6; Ley 1480 art. 53) |
| Otra pasarela (Wompi, Mercado Pago) | Un comercio que no puede usar Bold, o un cambio de Bold (§20.1) |
| Emitir facturación electrónica (no solo integrar la del comercio, §14.5) | La DIAN reglamenta el art. 616-1 inc. 8, o tres comercios sin facturador propio la piden (regla de tres) |
| WhatsApp Cloud API, para avisos automáticos de estado | Se demuestra ahorro de atención y la contribución por pedido soporta su costo (estudio §11.1). **El costo de Meta no es la barrera:** los mensajes que no son plantilla y las plantillas de utilidad son gratis dentro de la ventana de atención; hay 72 horas sin cargo cuando la persona llega por un anuncio; y fuera de la ventana, una plantilla de utilidad cuesta unos USD 0,0008 en Colombia (estudio §11.1 [V7][C5]). Lo son la verificación del negocio, las plantillas aprobadas, el consentimiento del comprador y la cuota del intermediario. El tope de 1.000 mensajes de servicio gratis al mes que afirma una fuente secundaria no está confirmado: está en el radar del estudio (§17.1) |
| Guías integradas (cotizar, generar y seguir con una API multitransportadora) | Tres comercios con el mismo operador o agregador. Mientras tanto, la contraentrega se registra a mano (§8.7) |
| Varias bodegas | Tres comercios del nivel alto con más de un punto de despacho (§7.5) |
| Punto de venta | Un comercio que venda en un local los mismos productos. El canal `pos` es un `INSERT` (probado en §5.4) |
| B2B: listas de precios y cotizaciones | Pedidos empresariales comprobados (estudio §8.2) |
| Conversiones del lado del servidor (API de conversiones de Meta) | Un comercio con pauta que lo pida, con su consentimiento y su token |
| Multimoneda o multidioma | La fase LATAM de ED1 |

---

## Fuentes

Consultadas el 5 oct 2026 por los investigadores de esta sesión. El proxy bloqueó la mayoría de los sitios oficiales. **(OT)**: texto oficial leído en una copia literal; **(r)**: resumen del buscador sobre la página oficial; **(S)**: secundaria.

**Bold**
- Botón de pagos, integración manual y personalizada: https://developers.bold.co/pagos-en-linea/boton-de-pagos/integracion-manual/integracion-manual (r).
- Llaves: https://developers.bold.co/pagos-en-linea/llaves-de-integracion (r).
- Webhooks, con `x-bold-signature`, reintentos y llave vacía en pruebas: https://www.developers.bold.co/webhook (r).
- Plugin oficial v3.0.3, con la verificación `hash_hmac('sha256', base64_encode($body), $secret)`: https://github.com/common-repository/bold-pagos-en-linea (OT).
- Consulta de transacciones: https://developers.bold.co/pagos-en-linea/seguimiento-de-transacciones (r).
- Links de pago: https://developers.bold.co/pagos-en-linea/api-link-de-pagos (r).
- Tarifas: https://bold.co/tarifas (r).

**Normas** (copias literales de SUIN-Juriscol y Función Pública en `github.com/legalize-dev/legalize-co` y otros, según el informe de la investigación)
- Ley 1581 de 2012 (OT) y Decreto 1377 de 2013 (OT).
- Decreto 090 de 2018: https://www.funcionpublica.gov.co/eva/gestornormativo/norma.php?i=85039 (OT).
- SIC, Circular Externa 005 de 2017: https://normograma.dian.gov.co/dian/compilacion/docs/circular_superindustria_0005_2017.htm (r).
- SIC, Circular Externa 003 de 2018 (incidentes) (r).
- Ley 1480 de 2011, consolidada con la Ley 2439 de 2024: https://www.suin-juriscol.gov.co/viewDocument.asp?id=1681955 (OT).
- Ley 2439 de 2024: https://www.suin-juriscol.gov.co/viewDocument.asp?id=30054269 (OT/r).
- Decreto 587 de 2016 (S, por cita).
- DIAN, Estatuto Tributario art. 616-1 y Resolución 000227 de 2025: https://normograma.dian.gov.co/ (S, por cita).

**WhatsApp**
- Reglas de cobro de Meta: estudio §11.1 [C5], con la documentación oficial leída el 5 oct 2026 (S111) y las tarifas de Colombia por fuentes secundarias (S88, S113). La versión 0.1 de este documento afirmaba que desde el 1 oct 2026 Meta cobra los mensajes de servicio y las plantillas de utilidad dentro de la ventana. **Era falso:** la fuente oficial no lo recoge (bitácora agro, «Afirmaciones mías que resultaron falsas»).

**Estudio de mercado v1.3** (`ESTUDIO-MERCADO-ECOMMERCE-ED1-2026-10-v1.3.md`)
- Capacidades básicas de Colombia (§8.1 [C3]), tarifas de pagos (§10.2 [C4]), facturación (§11.2 [C6]), entrega y contraentrega (§11.3 [C7]), marketing (§11.6 [C5]), líneas por uso (§13.2 [C9]), niveles de precio (§13.6 [C11]), límites de Cloudflare y los insumos de la 2.0 (§9.4 y §15.3 [C12]).

**La Tienda 2.0** (repositorio `laboratoriodigital/tienda`, versión 1.0.0, leído el 5 oct 2026)
- `docs/ARQUITECTURA.md` §8 (los cinco mecanismos de idempotencia) y §10 (los límites de Google), y `docs/CONTRATOS.md` §6 (las puertas). Base del anexo C.

**Cloudflare**
- Ver `../plataforma/cuenta-cloudflare.md`, y para la Public Suffix List, las fuentes de `../plataforma/PLATAFORMA.md`.

---

## Anexo A · Esquema del shard de tiendas (`infrastructure/migraciones/tienda/0001_tienda_v1.sql`)

Copia del archivo probado. Si difieren, manda el archivo, y la prueba `tests/repo/shard-tienda.test.ts` falla (HU-T2.1, P18).

```sql
-- Tienda 3.0 · shard de una celda de tiendas (`tienda_c{N}_s{k}`), migración 0001.
-- Fuente del diseño: docs/tienda/TIENDA-3.0.md §5. Probada con node:sqlite 3.50 (falta D1).
--
-- Reglas de este esquema (las vigilan pruebas, como en la celda agro):
-- 1. Toda tabla lleva `org_id`. El panel lo toma del token; lo público, del Host ya resuelto por
--    el despacho. Nunca del cuerpo de la solicitud.
-- 2. Dinero en pesos enteros (`*_cop INTEGER`). Nunca REAL. Un precio ilegible no es cero (P1).
-- 3. Instantes en UTC ISO-8601 (TEXT). La fecha comercial local (America/Bogota) se deriva (P8).
-- 4. Lo que va a crecer (estados, secciones) es una tabla de referencia con clave foránea, no un
--    CHECK: agregar un valor es un INSERT, no rehacer la tabla. Lo cerrado (sí/no, ambiente) es CHECK.
-- 5. Ninguna clave foránea lleva ON DELETE CASCADE: DROP TABLE hace un DELETE implícito y, en D1,
--    borraría las hijas al rehacer una tabla padre.
-- 6. Nada se borra en caliente: `borrado` marca la papelera y un cron purga a los 30 días (P21).
-- 7. Cada índice dice su costo (filas escritas de más por INSERT).
-- 8. Los datos personales del comprador no están en claro: `pedido_contacto.sobre` va cifrado con la
--    llave de datos personales de la tienda (AES-256-GCM, cifrado de sobre).

-- 0. Referencias ---------------------------------------------------------------------------

CREATE TABLE ref_seccion_ajuste (
  id TEXT PRIMARY KEY,
  publica INTEGER NOT NULL CHECK (publica IN (0, 1))   -- 1: se hornea en el sitio público
) WITHOUT ROWID;
INSERT INTO ref_seccion_ajuste (id, publica) VALUES
  ('identidad', 1), ('contacto', 1), ('apariencia', 1), ('venta', 1), ('cobro', 0),
  ('legal', 1), ('medicion', 1), ('agentes', 1), ('avisos', 0);

CREATE TABLE ref_estado_pedido (
  id TEXT PRIMARY KEY,
  descuenta INTEGER NOT NULL CHECK (descuenta IN (0, 1)),   -- 1: las unidades ya salieron del inventario
  terminal INTEGER NOT NULL CHECK (terminal IN (0, 1))
) WITHOUT ROWID;
INSERT INTO ref_estado_pedido (id, descuenta, terminal) VALUES
  ('pendiente', 0, 0),     -- llegó (WhatsApp, agente, panel) y nadie lo ha confirmado
  ('por_pagar', 0, 0),     -- espera un pago en línea; sus unidades están apartadas
  ('confirmado', 1, 0),    -- el comercio lo confirmó (pago por fuera, contraentrega)
  ('pagado', 1, 0),        -- pago en línea aprobado
  ('despachado', 1, 0),
  ('entregado', 1, 1),
  ('cancelado', 0, 1),
  ('devuelto', 0, 1);

CREATE TABLE ref_transicion_pedido (
  de TEXT NOT NULL REFERENCES ref_estado_pedido (id),
  a TEXT NOT NULL REFERENCES ref_estado_pedido (id),
  PRIMARY KEY (de, a)
) WITHOUT ROWID;
INSERT INTO ref_transicion_pedido (de, a) VALUES
  ('pendiente', 'por_pagar'), ('pendiente', 'confirmado'), ('pendiente', 'cancelado'),
  ('por_pagar', 'pagado'), ('por_pagar', 'pendiente'), ('por_pagar', 'cancelado'),
  ('confirmado', 'despachado'), ('confirmado', 'cancelado'),
  ('pagado', 'despachado'), ('pagado', 'cancelado'),
  ('despachado', 'entregado'), ('despachado', 'devuelto'),
  ('entregado', 'devuelto');

CREATE TABLE ref_estado_cobro (
  id TEXT PRIMARY KEY,
  abierto INTEGER NOT NULL CHECK (abierto IN (0, 1))
) WITHOUT ROWID;
INSERT INTO ref_estado_cobro (id, abierto) VALUES
  ('esperando', 1), ('aprobado', 0), ('aprobado_sin_existencias', 0), ('rechazado', 0),
  ('vencido', 0), ('revisar', 0), ('reembolsado', 0);

-- Los avisos de Bold pueden llegar repetidos o en desorden (una anulación antes que la venta):
-- solo estas transiciones existen. Un pago que llega después de vencer el apartado pasa de
-- `vencido` a `aprobado` (si aún hay unidades) o a `aprobado_sin_existencias`.
CREATE TABLE ref_transicion_cobro (
  de TEXT NOT NULL REFERENCES ref_estado_cobro (id),
  a TEXT NOT NULL REFERENCES ref_estado_cobro (id),
  PRIMARY KEY (de, a)
) WITHOUT ROWID;
INSERT INTO ref_transicion_cobro (de, a) VALUES
  ('esperando', 'aprobado'), ('esperando', 'aprobado_sin_existencias'), ('esperando', 'rechazado'),
  ('esperando', 'vencido'), ('esperando', 'revisar'),
  ('vencido', 'aprobado'), ('vencido', 'aprobado_sin_existencias'), ('vencido', 'revisar'),
  ('aprobado', 'reembolsado'), ('aprobado_sin_existencias', 'reembolsado'), ('revisar', 'reembolsado'),
  ('revisar', 'aprobado');

-- Por dónde llegó el pedido. `exige_aceptacion`: el comprador lo hizo en la web (o lo confirmó desde
-- el enlace de un agente) y, pasado `pendiente`, tiene que traer la prueba de que aceptó los términos
-- (trigger `pedido_aceptacion`). Lo anota el comercio (`panel`) o viene de una carga: no la exige.
-- Un canal nuevo (un punto de venta, un marketplace) es un INSERT (R1).
CREATE TABLE ref_canal (
  id TEXT PRIMARY KEY,
  exige_aceptacion INTEGER NOT NULL CHECK (exige_aceptacion IN (0, 1))
) WITHOUT ROWID;
INSERT INTO ref_canal (id, exige_aceptacion) VALUES
  ('whatsapp', 1), ('en_linea', 1), ('agente', 1), ('panel', 0), ('carga', 0);

-- Proveedores con los que el comercio conecta su cuenta, y los campos de su credencial. Cobrar con
-- otra pasarela o integrar un facturador (Alegra, del nivel intermedio del estudio v1.3 §13.6) es
-- sembrar filas, no rehacer `credencial` (R1).
CREATE TABLE ref_campo_credencial (
  proveedor TEXT NOT NULL,
  campo TEXT NOT NULL,
  proposito TEXT NOT NULL CHECK (proposito IN ('pago', 'factura')),
  PRIMARY KEY (proveedor, campo)
) WITHOUT ROWID;
INSERT INTO ref_campo_credencial (proveedor, campo, proposito) VALUES
  ('bold', 'identidad', 'pago'), ('bold', 'secreta', 'pago'),
  ('alegra', 'usuario', 'factura'), ('alegra', 'token', 'factura');

CREATE TABLE ref_pasarela (
  id TEXT PRIMARY KEY
) WITHOUT ROWID;
INSERT INTO ref_pasarela (id) VALUES ('bold');

-- Por qué cambió el inventario. `traslado` llegará con las bodegas (TIENDA-3.0 §7.5): un INSERT.
CREATE TABLE ref_motivo_inventario (
  id TEXT PRIMARY KEY
) WITHOUT ROWID;
INSERT INTO ref_motivo_inventario (id) VALUES
  ('venta'), ('cancelacion'), ('devolucion'), ('ajuste'), ('carga'), ('conteo');

CREATE TABLE ref_tipo_evento (
  id TEXT PRIMARY KEY
) WITHOUT ROWID;
INSERT INTO ref_tipo_evento (id) VALUES
  ('estado'), ('nota'), ('pago'), ('envio'), ('recaudo'), ('contacto_leido');

-- Cómo paga el comprador (estudio de ecommerce v1.3, §8.1 [C3] y §11.3 [C7]). Solo `en_linea` lo
-- verifica la plataforma, con Bold; los demás los confirma el comercio, y por eso un pedido pagado
-- por fuera queda `confirmado`, nunca `pagado` («un pedido enviado al chat no figura como pagado»).
-- `recaudo`: la plata la cobra un tercero al entregar y llega después, en una liquidación.
-- Un medio nuevo (Bre-B, por ejemplo) es un INSERT (R1).
CREATE TABLE ref_forma_pago (
  id TEXT PRIMARY KEY,
  verifica_plataforma INTEGER NOT NULL CHECK (verifica_plataforma IN (0, 1)),
  recaudo INTEGER NOT NULL CHECK (recaudo IN (0, 1))
) WITHOUT ROWID;
INSERT INTO ref_forma_pago (id, verifica_plataforma, recaudo) VALUES
  ('a_convenir', 0, 0),       -- se acuerda en el chat de WhatsApp (el camino de siempre)
  ('en_linea', 1, 0),         -- botón o link de pago del Bold del comercio
  ('contraentrega', 0, 1),    -- la transportadora cobra al entregar
  ('transferencia', 0, 0),    -- a la cuenta del comercio; el comprobante llega por el chat
  ('efectivo', 0, 0);         -- al recoger en el local

-- La plata de una contraentrega: por recaudar mientras viaja; recaudada al entregarse; devuelta si
-- el comprador no la recibe (el comercio paga la ida y, según su contrato, la vuelta); perdida si la
-- transportadora no responde por ella. Que llegue a la cuenta del comercio es `liquidado`, aparte.
CREATE TABLE ref_estado_contraentrega (
  id TEXT PRIMARY KEY,
  terminal INTEGER NOT NULL CHECK (terminal IN (0, 1))
) WITHOUT ROWID;
INSERT INTO ref_estado_contraentrega (id, terminal) VALUES
  ('por_recaudar', 0), ('recaudado', 1), ('devuelto', 1), ('perdido', 1);

CREATE TABLE ref_transicion_contraentrega (
  de TEXT NOT NULL REFERENCES ref_estado_contraentrega (id),
  a TEXT NOT NULL REFERENCES ref_estado_contraentrega (id),
  PRIMARY KEY (de, a)
) WITHOUT ROWID;
INSERT INTO ref_transicion_contraentrega (de, a) VALUES
  ('por_recaudar', 'recaudado'), ('por_recaudar', 'devuelto'), ('por_recaudar', 'perdido');

-- Solicitudes del comprador con radicado (Ley 1480 art. 50 lit. g, modificado por la Ley 2439 de
-- 2024) y de los titulares de datos (Ley 1581 arts. 14 y 15). `dias_habiles` y `prorroga` son los
-- plazos de respuesta; el vencimiento se calcula en código con el calendario de festivos de Colombia.
CREATE TABLE ref_tipo_solicitud (
  id TEXT PRIMARY KEY,
  dias_habiles INTEGER NOT NULL CHECK (dias_habiles > 0),
  prorroga INTEGER NOT NULL DEFAULT 0 CHECK (prorroga >= 0)
) WITHOUT ROWID;
INSERT INTO ref_tipo_solicitud (id, dias_habiles, prorroga) VALUES
  ('peticion', 15, 0), ('queja', 15, 0), ('reclamo', 15, 0),
  ('retracto', 5, 0),            -- plazo del comprador para ejercerlo (art. 47); el reembolso: 15 días calendario
  ('reversion', 15, 0),          -- participantes del proceso de pago (Decreto 587 de 2016)
  ('datos_consulta', 10, 5),     -- Ley 1581 art. 14
  ('datos_reclamo', 15, 8);      -- Ley 1581 art. 15

-- 1. La tienda y sus ajustes ----------------------------------------------------------------

-- Una fila por organización `tienda` del CORE que vive en este shard.
CREATE TABLE tienda (
  org_id TEXT PRIMARY KEY,
  -- Sin «--»: ese espacio es de la plataforma (<slug>--staging, TIENDA-3.0 §4.1).
  slug TEXT NOT NULL UNIQUE CHECK (
    length(slug) BETWEEN 3 AND 40 AND slug NOT GLOB '*[^a-z0-9-]*' AND slug NOT GLOB '-*' AND slug NOT GLOB '*-'
    AND slug NOT GLOB '*--*'
  ),
  nombre TEXT NOT NULL CHECK (length(nombre) BETWEEN 1 AND 80),
  estado TEXT NOT NULL CHECK (estado IN ('borrador', 'abierta', 'cerrada', 'suspendida', 'baja')),
  plan TEXT NOT NULL,                   -- copia del CORE (llega firmada en el token o por el cron)
  plan_vence TEXT,
  ultimo_numero INTEGER NOT NULL DEFAULT 1000 CHECK (ultimo_numero >= 1000),
  ultima_solicitud INTEGER NOT NULL DEFAULT 0 CHECK (ultima_solicitud >= 0),
  version_publicada INTEGER,            -- la que sirve el despacho; NULL = nunca publicada
  creado TEXT NOT NULL,
  actualizado TEXT NOT NULL
);

-- Ajustes por sección, validados por esquema en código (`packages/tienda-schema`, P2). Un documento
-- por sección: guardar una sección es atómico y su `esquema` permite traducir versiones viejas
-- al leerlas, como `aVersionVigente` del agro. Lo secreto nunca va aquí (ver `credencial`).
CREATE TABLE ajuste (
  org_id TEXT NOT NULL REFERENCES tienda (org_id),
  seccion TEXT NOT NULL REFERENCES ref_seccion_ajuste (id),
  esquema INTEGER NOT NULL CHECK (esquema >= 1),
  datos TEXT NOT NULL CHECK (json_valid(datos) AND json_type(datos) = 'object'),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
  actualizado TEXT NOT NULL,
  actualizado_por TEXT NOT NULL,
  PRIMARY KEY (org_id, seccion)
) WITHOUT ROWID;

-- Llaves de datos de la tienda (DEK), envueltas con la llave maestra (KEK) del Worker. Una por
-- propósito: borrar la de `datos_personales` al dar de baja una tienda deja ilegibles todos sus
-- datos de compradores de una vez (borrado criptográfico), sin tocar las credenciales.
CREATE TABLE llave (
  org_id TEXT NOT NULL REFERENCES tienda (org_id),
  proposito TEXT NOT NULL CHECK (proposito IN ('credenciales', 'datos_personales', 'indices')),
  version INTEGER NOT NULL CHECK (version >= 1),
  envuelta BLOB NOT NULL,               -- DEK cifrada con la KEK (AES-KW o AES-GCM)
  kek_id TEXT NOT NULL,                 -- qué KEK la envuelve: permite rotar la KEK reenvolviendo
  creada TEXT NOT NULL,
  retirada TEXT,
  PRIMARY KEY (org_id, proposito, version)
) WITHOUT ROWID;

-- Credenciales del comercio con su pasarela o su facturador. Cifradas con la DEK `credenciales`;
-- AAD = org_id|proveedor|ambiente|campo, para que un cifrado no sirva copiado a otra fila.
CREATE TABLE credencial (
  org_id TEXT NOT NULL REFERENCES tienda (org_id),
  proveedor TEXT NOT NULL,
  ambiente TEXT NOT NULL CHECK (ambiente IN ('pruebas', 'produccion')),
  campo TEXT NOT NULL,
  cifrado BLOB NOT NULL,
  iv BLOB NOT NULL CHECK (length(iv) = 12),
  llave_version INTEGER NOT NULL,
  huella TEXT NOT NULL,                 -- últimos 4 caracteres, para reconocerla en el panel
  guardada TEXT NOT NULL,
  verificada TEXT,                      -- última prueba exitosa contra el proveedor
  PRIMARY KEY (org_id, proveedor, ambiente, campo),
  FOREIGN KEY (proveedor, campo) REFERENCES ref_campo_credencial (proveedor, campo)
) WITHOUT ROWID;

-- 2. Catálogo -------------------------------------------------------------------------------

CREATE TABLE coleccion (
  org_id TEXT NOT NULL REFERENCES tienda (org_id),
  id TEXT NOT NULL,
  slug TEXT NOT NULL CHECK (slug NOT GLOB '*[^a-z0-9-]*' AND length(slug) BETWEEN 1 AND 80),
  nombre TEXT NOT NULL,
  descripcion_md TEXT NOT NULL DEFAULT '',
  posicion INTEGER NOT NULL DEFAULT 0,
  visible INTEGER NOT NULL DEFAULT 1 CHECK (visible IN (0, 1)),
  version INTEGER NOT NULL DEFAULT 1,
  actualizado TEXT NOT NULL,
  borrado TEXT,
  PRIMARY KEY (org_id, id)
) WITHOUT ROWID;
-- Costo: 1 fila por colección creada.
CREATE UNIQUE INDEX coleccion_slug ON coleccion (org_id, slug) WHERE borrado IS NULL;

-- Las opciones (hasta 3 grupos de hasta 20 valores) van en `opciones` como JSON validado: son
-- pocas, se leen siempre con el producto y no se consultan solas. Cada combinación vendible es una
-- `variante`. Un producto sin opciones tiene una sola variante: así precio, inventario y fotos
-- viven siempre en el mismo sitio.
CREATE TABLE producto (
  org_id TEXT NOT NULL REFERENCES tienda (org_id),
  id TEXT NOT NULL,
  slug TEXT NOT NULL CHECK (slug NOT GLOB '*[^a-z0-9-]*' AND length(slug) BETWEEN 1 AND 100),
  nombre TEXT NOT NULL CHECK (length(nombre) BETWEEN 1 AND 140),
  descripcion_md TEXT NOT NULL DEFAULT '' CHECK (length(descripcion_md) <= 20000),
  estado TEXT NOT NULL CHECK (estado IN ('borrador', 'activo', 'archivado')),
  opciones TEXT NOT NULL DEFAULT '[]' CHECK (
    json_valid(opciones) AND json_type(opciones) = 'array' AND json_array_length(opciones) <= 3
  ),
  requiere_envio INTEGER NOT NULL DEFAULT 1 CHECK (requiere_envio IN (0, 1)),
  iva_pct INTEGER CHECK (iva_pct IS NULL OR iva_pct IN (0, 5, 19)),   -- NULL: el comercio no lo declara
  destacado INTEGER NOT NULL DEFAULT 0 CHECK (destacado IN (0, 1)),
  -- Ley 1480 art. 47: el retracto aplica salvo las excepciones de la ley (perecederos,
  -- personalizados, de uso personal…); el comercio marca el producto y dice cuál.
  retracto TEXT NOT NULL DEFAULT 'aplica' CHECK (retracto IN ('aplica', 'no_aplica')),
  retracto_motivo TEXT,
  solo_mayores INTEGER NOT NULL DEFAULT 0 CHECK (solo_mayores IN (0, 1)),   -- art. 52: verificar edad
  posicion INTEGER NOT NULL DEFAULT 0,
  seo TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(seo)),
  ref_externa TEXT,                     -- id en el sistema de origen (carga desde la 2.0, CSV)
  version INTEGER NOT NULL DEFAULT 1,
  creado TEXT NOT NULL,
  actualizado TEXT NOT NULL,
  borrado TEXT,
  PRIMARY KEY (org_id, id),
  CHECK (retracto = 'aplica' OR retracto_motivo IS NOT NULL)
) WITHOUT ROWID;
-- Costo: 1 fila por producto creado. La ficha se sirve horneada; esto lo usan el horno y el panel.
CREATE UNIQUE INDEX producto_slug ON producto (org_id, slug) WHERE borrado IS NULL;
-- Costo: 1 fila por producto que trae `ref_externa` (solo las cargas). Hace idempotente la carga.
CREATE UNIQUE INDEX producto_ref_externa ON producto (org_id, ref_externa) WHERE ref_externa IS NOT NULL;

CREATE TABLE coleccion_producto (
  org_id TEXT NOT NULL,
  coleccion_id TEXT NOT NULL,
  producto_id TEXT NOT NULL,
  posicion INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (org_id, coleccion_id, producto_id),
  FOREIGN KEY (org_id, coleccion_id) REFERENCES coleccion (org_id, id),
  FOREIGN KEY (org_id, producto_id) REFERENCES producto (org_id, id)
) WITHOUT ROWID;

-- `stock` NULL: la variante no lleva inventario (se vende sin contar). `reservado` lo mantienen
-- los triggers de `apartado`; el CHECK es la guarda contra la sobreventa: dos compradores por la
-- última unidad hacen que el segundo lote falle completo (D1 escribe de a uno por base).
CREATE TABLE variante (
  org_id TEXT NOT NULL,
  id TEXT NOT NULL,
  producto_id TEXT NOT NULL,
  clave TEXT NOT NULL,                  -- valores de las opciones en orden, unidos por «|»; '' sin opciones
  sku TEXT,
  precio_cop INTEGER NOT NULL CHECK (precio_cop >= 0),
  precio_antes_cop INTEGER CHECK (precio_antes_cop IS NULL OR precio_antes_cop > precio_cop),
  stock INTEGER CHECK (stock IS NULL OR stock >= 0),
  reservado INTEGER NOT NULL DEFAULT 0 CHECK (reservado >= 0),
  umbral_bajo INTEGER CHECK (umbral_bajo IS NULL OR umbral_bajo >= 0),
  activa INTEGER NOT NULL DEFAULT 1 CHECK (activa IN (0, 1)),
  posicion INTEGER NOT NULL DEFAULT 0,
  cambio_motivo TEXT,                   -- lo pone quien cambia `stock`; lo lee el trigger del libro
  cambio_ref TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  actualizado TEXT NOT NULL,
  PRIMARY KEY (org_id, id),
  UNIQUE (org_id, producto_id, clave),
  FOREIGN KEY (org_id, producto_id) REFERENCES producto (org_id, id),
  CHECK (stock IS NULL OR reservado <= stock)
) WITHOUT ROWID;
-- El UNIQUE de arriba cuesta 1 fila por variante y sirve para leer las variantes de un producto.
-- Costo: 1 fila por variante con SKU. El comercio busca por SKU en el panel.
CREATE UNIQUE INDEX variante_sku ON variante (org_id, sku) WHERE sku IS NOT NULL;

-- Fotos: el navegador las comprime y el API las guarda en R2 por su huella (contenido
-- direccionado: la misma foto no se guarda dos veces). `variante_id` NULL = foto general.
CREATE TABLE medio (
  org_id TEXT NOT NULL,
  id TEXT NOT NULL CHECK (length(id) = 64 AND id NOT GLOB '*[^0-9a-f]*'),   -- SHA-256 del original
  producto_id TEXT NOT NULL,
  variante_id TEXT,
  posicion INTEGER NOT NULL DEFAULT 0,
  alt TEXT NOT NULL DEFAULT '',
  ancho INTEGER NOT NULL CHECK (ancho > 0),
  alto INTEGER NOT NULL CHECK (alto > 0),
  formatos TEXT NOT NULL CHECK (json_valid(formatos)),   -- {"400": bytes, "800": bytes, "1600": bytes}
  creado TEXT NOT NULL,
  PRIMARY KEY (org_id, producto_id, id),
  FOREIGN KEY (org_id, producto_id) REFERENCES producto (org_id, id),
  FOREIGN KEY (org_id, variante_id) REFERENCES variante (org_id, id)
) WITHOUT ROWID;

-- Libro de inventario: cada cambio de `stock` deja su fila (lo escribe un trigger, así ningún
-- camino lo olvida). Responde «¿por qué tengo 3?» y permite reconciliar.
CREATE TABLE movimiento_inventario (
  org_id TEXT NOT NULL,
  id INTEGER PRIMARY KEY,               -- rowid: orden de llegada
  variante_id TEXT NOT NULL,
  delta INTEGER NOT NULL CHECK (delta <> 0),
  stock_resultante INTEGER,
  motivo TEXT NOT NULL REFERENCES ref_motivo_inventario (id),
  ref TEXT,                              -- pedido o importación que lo causó
  instante TEXT NOT NULL,
  FOREIGN KEY (org_id, variante_id) REFERENCES variante (org_id, id)
);
-- Costo: 1 fila por movimiento. El panel lee el libro de una variante.
CREATE INDEX movimiento_por_variante ON movimiento_inventario (org_id, variante_id, id);

-- Avísame: cuántas personas esperan una variante agotada, sin datos de nadie (heredado de la 2.0:
-- el contacto queda en el WhatsApp del comercio).
CREATE TABLE interes_reposicion (
  org_id TEXT NOT NULL,
  variante_id TEXT NOT NULL,
  personas INTEGER NOT NULL CHECK (personas >= 1),
  desde TEXT NOT NULL,
  ultimo TEXT NOT NULL,
  PRIMARY KEY (org_id, variante_id),
  FOREIGN KEY (org_id, variante_id) REFERENCES variante (org_id, id)
) WITHOUT ROWID;

-- 3. Venta: envíos y cupones ----------------------------------------------------------------

CREATE TABLE envio_opcion (
  org_id TEXT NOT NULL REFERENCES tienda (org_id),
  id TEXT NOT NULL,
  nombre TEXT NOT NULL,
  precio_cop INTEGER NOT NULL CHECK (precio_cop >= 0),
  gratis_desde_cop INTEGER CHECK (gratis_desde_cop IS NULL OR gratis_desde_cop > 0),
  ciudades TEXT CHECK (ciudades IS NULL OR (json_valid(ciudades) AND json_type(ciudades) = 'array')),  -- NULL: todas
  dias_min INTEGER CHECK (dias_min IS NULL OR dias_min >= 0),
  dias_max INTEGER CHECK (dias_max IS NULL OR dias_max >= 0),
  activa INTEGER NOT NULL DEFAULT 1 CHECK (activa IN (0, 1)),
  posicion INTEGER NOT NULL DEFAULT 0,
  version INTEGER NOT NULL DEFAULT 1,
  borrado TEXT,
  PRIMARY KEY (org_id, id),
  CHECK (dias_min IS NULL OR dias_max IS NULL OR dias_min <= dias_max)
) WITHOUT ROWID;

CREATE TABLE cupon (
  org_id TEXT NOT NULL REFERENCES tienda (org_id),
  codigo TEXT NOT NULL CHECK (codigo = upper(codigo) AND length(codigo) BETWEEN 3 AND 24 AND codigo NOT GLOB '*[^A-Z0-9-]*'),
  tipo TEXT NOT NULL CHECK (tipo IN ('porcentaje', 'valor', 'envio_gratis')),
  valor INTEGER NOT NULL CHECK (valor >= 0),
  minimo_cop INTEGER NOT NULL DEFAULT 0 CHECK (minimo_cop >= 0),
  desde TEXT,
  hasta TEXT,
  usos_maximos INTEGER CHECK (usos_maximos IS NULL OR usos_maximos > 0),
  usos INTEGER NOT NULL DEFAULT 0 CHECK (usos >= 0),   -- solo pedidos confirmados o pagados
  activo INTEGER NOT NULL DEFAULT 1 CHECK (activo IN (0, 1)),
  version INTEGER NOT NULL DEFAULT 1,
  borrado TEXT,
  PRIMARY KEY (org_id, codigo),
  CHECK (tipo <> 'porcentaje' OR valor BETWEEN 1 AND 100),
  CHECK (usos_maximos IS NULL OR usos <= usos_maximos)
) WITHOUT ROWID;

-- 4. Pedidos --------------------------------------------------------------------------------

-- `codigo`: 6 letras y números sin ambiguos (base32 de Crockford). Lo genera el navegador una vez
-- por carrito: reenviar el mismo pedido no lo duplica. `numero`: el consecutivo humano (#1001).
-- `cambiado_por` lo escribe quien cambia el estado; el trigger lo lleva al historial.
CREATE TABLE pedido (
  org_id TEXT NOT NULL REFERENCES tienda (org_id),
  id TEXT NOT NULL,
  codigo TEXT NOT NULL CHECK (length(codigo) = 6 AND codigo NOT GLOB '*[^0-9A-HJKMNP-TV-Z]*'),
  numero INTEGER NOT NULL CHECK (numero > 1000),
  estado TEXT NOT NULL REFERENCES ref_estado_pedido (id),
  canal TEXT NOT NULL REFERENCES ref_canal (id),
  -- Se elige mientras el pedido está pendiente (trigger `pedido_forma_fija`). Pasar de `a_convenir`
  -- a `en_linea` es cobrar con un link de pago un pedido que llegó por el chat.
  forma_pago TEXT NOT NULL DEFAULT 'a_convenir' REFERENCES ref_forma_pago (id),
  subtotal_cop INTEGER NOT NULL CHECK (subtotal_cop >= 0),
  descuento_cop INTEGER NOT NULL DEFAULT 0 CHECK (descuento_cop >= 0),
  envio_cop INTEGER NOT NULL DEFAULT 0 CHECK (envio_cop >= 0),
  total_cop INTEGER NOT NULL CHECK (total_cop >= 0),
  cupon_codigo TEXT,
  envio_opcion_id TEXT,
  envio_nombre TEXT,                     -- copia: el nombre de la opción el día del pedido
  ciudad TEXT,                           -- en claro: decide envío y estadística; sola no identifica
  seguimiento_huella TEXT CHECK (seguimiento_huella IS NULL OR (length(seguimiento_huella) = 64 AND seguimiento_huella NOT GLOB '*[^0-9a-f]*')),
  atencion TEXT CHECK (atencion IS NULL OR atencion IN ('sin_existencias', 'monto', 'datos')),
  transportadora TEXT,                   -- con la guía, la ve el comprador en el seguimiento
  guia TEXT,
  agente TEXT,                           -- identidad del agente si llegó por MCP y la firmó (Web Bot Auth)
  -- Prueba de la aceptación (Ley 1480 arts. 48 y 50): la huella de los términos y la política que
  -- vio la persona (sus textos quedan en R2 por su huella, sin vencimiento) y el instante en que
  -- marcó la casilla, que nunca viene marcada. El pedido que prepara un agente no la tiene hasta
  -- que la persona lo confirma.
  terminos_huella TEXT CHECK (terminos_huella IS NULL OR (length(terminos_huella) = 64 AND terminos_huella NOT GLOB '*[^0-9a-f]*')),
  aceptado TEXT,
  acepta_novedades INTEGER NOT NULL DEFAULT 0 CHECK (acepta_novedades IN (0, 1)),
  cambiado_por TEXT NOT NULL,            -- 'comprador' | 'sistema' | 'usuario:<id>' | 'agente:<id>'
  version INTEGER NOT NULL DEFAULT 1,
  creado TEXT NOT NULL,
  actualizado TEXT NOT NULL,
  PRIMARY KEY (org_id, id),
  UNIQUE (org_id, codigo),
  UNIQUE (org_id, numero),
  CHECK (total_cop = subtotal_cop - descuento_cop + envio_cop),
  CHECK ((terminos_huella IS NULL) = (aceptado IS NULL)),
  -- Esperar o tener un pago en línea es solo de `en_linea`; confirmar a mano nunca lo es: lo que
  -- dice «pagado» lo verificó Bold. Un pedido web cuyo pago fue rechazado vuelve a `pendiente` y
  -- puede cambiar de forma (por ejemplo, a transferencia) antes de que el comercio lo confirme.
  CHECK (estado NOT IN ('por_pagar', 'pagado') OR forma_pago = 'en_linea'),
  CHECK (estado <> 'confirmado' OR forma_pago <> 'en_linea')
) WITHOUT ROWID;
-- Los dos UNIQUE cuestan 2 filas por pedido: el código lo pide el comprador (seguimiento) y el
-- número el comercio. Costo: 1 fila más por pedido. El panel lista por estado y fecha.
CREATE INDEX pedido_por_estado ON pedido (org_id, estado, creado);

CREATE TABLE pedido_linea (
  org_id TEXT NOT NULL,
  pedido_id TEXT NOT NULL,
  linea INTEGER NOT NULL CHECK (linea BETWEEN 1 AND 50),
  producto_id TEXT NOT NULL,
  variante_id TEXT NOT NULL,
  nombre TEXT NOT NULL,                  -- copias del día del pedido: cambiar el producto no cambia
  opciones TEXT NOT NULL DEFAULT '',     -- lo que se vendió («Talla: M · Color: Rosa»)
  sku TEXT,
  precio_unitario_cop INTEGER NOT NULL CHECK (precio_unitario_cop >= 0),
  cantidad INTEGER NOT NULL CHECK (cantidad BETWEEN 1 AND 999),
  total_cop INTEGER NOT NULL CHECK (total_cop >= 0),
  descontado INTEGER NOT NULL DEFAULT 0 CHECK (descontado IN (0, 1)),   -- ya salió del inventario
  PRIMARY KEY (org_id, pedido_id, linea),
  FOREIGN KEY (org_id, pedido_id) REFERENCES pedido (org_id, id),
  FOREIGN KEY (org_id, variante_id) REFERENCES variante (org_id, id),
  CHECK (total_cop = precio_unitario_cop * cantidad)
) WITHOUT ROWID;

-- Datos personales del comprador: un sobre cifrado (nombre, celular, correo, dirección, notas).
-- Solo los descifra el API para un usuario del comercio, y cada lectura queda en `registro`.
-- `celular_indice` es un HMAC con la DEK `indices`: permite buscar «los pedidos de este celular»
-- sin guardar el celular en claro.
CREATE TABLE pedido_contacto (
  org_id TEXT NOT NULL,
  pedido_id TEXT NOT NULL,
  sobre BLOB NOT NULL,
  iv BLOB NOT NULL CHECK (length(iv) = 12),
  llave_version INTEGER NOT NULL,
  celular_indice TEXT,
  creado TEXT NOT NULL,
  purgar_despues TEXT NOT NULL,          -- retención declarada en la política de la tienda
  PRIMARY KEY (org_id, pedido_id),
  FOREIGN KEY (org_id, pedido_id) REFERENCES pedido (org_id, id)
) WITHOUT ROWID;
-- Costo: 1 fila por pedido con celular. Búsqueda por celular en el panel.
CREATE INDEX contacto_por_celular ON pedido_contacto (org_id, celular_indice) WHERE celular_indice IS NOT NULL;

-- Historial del pedido: lo escribe el trigger en cada cambio de estado, y el API para notas.
CREATE TABLE pedido_evento (
  org_id TEXT NOT NULL,
  id INTEGER PRIMARY KEY,
  pedido_id TEXT NOT NULL,
  instante TEXT NOT NULL,
  tipo TEXT NOT NULL REFERENCES ref_tipo_evento (id),
  de TEXT,
  a TEXT,
  actor TEXT NOT NULL,
  detalle TEXT CHECK (detalle IS NULL OR json_valid(detalle)),
  FOREIGN KEY (org_id, pedido_id) REFERENCES pedido (org_id, id)
);
-- Costo: 1 fila por evento. La ficha del pedido muestra su historia.
CREATE INDEX evento_por_pedido ON pedido_evento (org_id, pedido_id, id);

-- La contraentrega de un pedido: nace al despacharlo y sigue la plata hasta la cuenta del
-- comercio. La transportadora y la guía están en el pedido (una sola fuente, P2). Sus costos
-- (comisión de recaudo, flete de ida y de vuelta) entran en el margen del pedido en el panel.
CREATE TABLE contraentrega (
  org_id TEXT NOT NULL,
  pedido_id TEXT NOT NULL,
  estado TEXT NOT NULL REFERENCES ref_estado_contraentrega (id),
  monto_cop INTEGER NOT NULL CHECK (monto_cop > 0),        -- lo que cobra la transportadora al entregar
  comision_cop INTEGER CHECK (comision_cop IS NULL OR comision_cop >= 0),          -- recaudo, con su IVA
  flete_ida_cop INTEGER CHECK (flete_ida_cop IS NULL OR flete_ida_cop >= 0),
  flete_vuelta_cop INTEGER CHECK (flete_vuelta_cop IS NULL OR flete_vuelta_cop >= 0),
  liquidado TEXT,                        -- cuándo llegó la plata a la cuenta del comercio
  liquidacion_ref TEXT,                  -- el número de la liquidación de la transportadora
  cambiado_por TEXT NOT NULL,
  creado TEXT NOT NULL,
  actualizado TEXT NOT NULL,
  PRIMARY KEY (org_id, pedido_id),
  FOREIGN KEY (org_id, pedido_id) REFERENCES pedido (org_id, id),
  CHECK (liquidado IS NULL OR estado = 'recaudado'),
  CHECK (flete_vuelta_cop IS NULL OR estado = 'devuelto')
) WITHOUT ROWID;
-- Lo que falta por recaudar o por liquidar, para el tablero. Costo: 1 fila mientras está abierta.
CREATE INDEX contraentrega_abierta ON contraentrega (org_id, estado)
  WHERE estado = 'por_recaudar' OR (estado = 'recaudado' AND liquidado IS NULL);

-- 5. Cobro en línea y apartados -------------------------------------------------------------

-- Un intento de pago. `id` es la referencia que viaja a Bold (`<codigo>-<intento>`).
-- `token_huella`: huella del token opaco con que la página pregunta por el pago.
CREATE TABLE cobro (
  org_id TEXT NOT NULL,
  id TEXT NOT NULL CHECK (id NOT GLOB '*[^0-9A-Z-]*'),
  pedido_id TEXT NOT NULL,
  proveedor TEXT NOT NULL REFERENCES ref_pasarela (id),
  ambiente TEXT NOT NULL CHECK (ambiente IN ('pruebas', 'produccion')),
  monto_cop INTEGER NOT NULL CHECK (monto_cop >= 1000),
  estado TEXT NOT NULL REFERENCES ref_estado_cobro (id),
  estado_proveedor TEXT,
  transaccion TEXT,
  medio TEXT,
  token_huella TEXT NOT NULL UNIQUE,
  consultas INTEGER NOT NULL DEFAULT 0,
  ultima_consulta TEXT,
  vence TEXT NOT NULL,                   -- hasta cuándo valen sus apartados
  creado TEXT NOT NULL,
  actualizado TEXT NOT NULL,
  PRIMARY KEY (org_id, id),
  FOREIGN KEY (org_id, pedido_id) REFERENCES pedido (org_id, id)
) WITHOUT ROWID;
-- Un pedido tiene a lo sumo un cobro esperando. Costo: 1 fila por cobro mientras espera.
CREATE UNIQUE INDEX cobro_uno_esperando ON cobro (org_id, pedido_id) WHERE estado = 'esperando';
-- Conciliación por cron: los que esperan, del más viejo al más nuevo. Costo: igual que el anterior.
CREATE INDEX cobro_esperando ON cobro (creado) WHERE estado = 'esperando';

-- Unidades apartadas para un cobro. Los triggers mantienen `variante.reservado`.
CREATE TABLE apartado (
  org_id TEXT NOT NULL,
  id INTEGER PRIMARY KEY,
  cobro_id TEXT NOT NULL,
  variante_id TEXT NOT NULL,
  cantidad INTEGER NOT NULL CHECK (cantidad > 0),
  estado TEXT NOT NULL CHECK (estado IN ('activo', 'consumido', 'liberado', 'vencido')),
  vence TEXT NOT NULL,
  creado TEXT NOT NULL,
  cerrado TEXT,
  FOREIGN KEY (org_id, cobro_id) REFERENCES cobro (org_id, id),
  FOREIGN KEY (org_id, variante_id) REFERENCES variante (org_id, id)
);
-- Liberar por variante los vencidos antes de apartar (vencimiento perezoso) y barrer por cron.
-- Costo: 1 fila por apartado activo.
CREATE INDEX apartado_activo ON apartado (org_id, variante_id, vence) WHERE estado = 'activo';

-- Avisos firmados del proveedor (webhooks), para no aplicar dos veces el mismo.
CREATE TABLE aviso_proveedor (
  org_id TEXT NOT NULL,
  proveedor TEXT NOT NULL,
  aviso_id TEXT NOT NULL,
  recibido TEXT NOT NULL,
  cobro_id TEXT,
  tipo TEXT NOT NULL,
  resultado TEXT NOT NULL CHECK (resultado IN ('aplicado', 'repetido', 'ignorado', 'error')),
  PRIMARY KEY (org_id, proveedor, aviso_id)
) WITHOUT ROWID;

-- Solicitudes con radicado. El contenido puede traer datos personales: va cifrado como el contacto.
CREATE TABLE solicitud (
  org_id TEXT NOT NULL REFERENCES tienda (org_id),
  id TEXT NOT NULL,
  radicado INTEGER NOT NULL CHECK (radicado >= 1),   -- consecutivo de la tienda; se muestra con fecha y hora
  tipo TEXT NOT NULL REFERENCES ref_tipo_solicitud (id),
  pedido_id TEXT,
  canal TEXT NOT NULL CHECK (canal IN ('web', 'whatsapp', 'correo', 'panel')),
  estado TEXT NOT NULL CHECK (estado IN ('radicada', 'en_tramite', 'respondida', 'cerrada')),
  sobre BLOB NOT NULL,
  iv BLOB NOT NULL CHECK (length(iv) = 12),
  llave_version INTEGER NOT NULL,
  creada TEXT NOT NULL,
  vence TEXT NOT NULL,                   -- calculado con días hábiles y festivos de Colombia
  respondida TEXT,
  cerrada TEXT,
  PRIMARY KEY (org_id, id),
  UNIQUE (org_id, radicado),
  FOREIGN KEY (org_id, pedido_id) REFERENCES pedido (org_id, id)
) WITHOUT ROWID;
-- El UNIQUE cuesta 1 fila por solicitud. Costo: 1 fila más. El panel lista las abiertas por vencimiento.
CREATE INDEX solicitud_abierta ON solicitud (org_id, vence) WHERE estado IN ('radicada', 'en_tramite');

-- 6. Contenido, publicación y operación -----------------------------------------------------

CREATE TABLE pagina (
  org_id TEXT NOT NULL REFERENCES tienda (org_id),
  id TEXT NOT NULL,
  slug TEXT NOT NULL CHECK (slug NOT GLOB '*[^a-z0-9-]*'),
  titulo TEXT NOT NULL,
  cuerpo_md TEXT NOT NULL CHECK (length(cuerpo_md) <= 50000),
  visible INTEGER NOT NULL DEFAULT 1 CHECK (visible IN (0, 1)),
  version INTEGER NOT NULL DEFAULT 1,
  actualizado TEXT NOT NULL,
  borrado TEXT,
  PRIMARY KEY (org_id, id)
) WITHOUT ROWID;
CREATE UNIQUE INDEX pagina_slug ON pagina (org_id, slug) WHERE borrado IS NULL;

-- Cada publicación es una versión inmutable del sitio en R2 (`sitios/<org>/<version>/`).
-- Volver atrás es apuntar el despacho a una versión anterior: no se hornea de nuevo.
CREATE TABLE publicacion (
  org_id TEXT NOT NULL REFERENCES tienda (org_id),
  version INTEGER NOT NULL CHECK (version >= 1),
  estado TEXT NOT NULL CHECK (estado IN ('en_cola', 'horneando', 'lista', 'publicada', 'reemplazada', 'fallida')),
  motivo TEXT,
  archivos INTEGER,
  bytes INTEGER,
  huella TEXT,                           -- SHA-256 del manifiesto: misma huella, mismo sitio
  pedida_por TEXT NOT NULL,
  pedida TEXT NOT NULL,
  publicada TEXT,
  PRIMARY KEY (org_id, version)
) WITHOUT ROWID;
-- Una sola publicación en curso por tienda. Costo: 1 fila mientras hornea.
CREATE UNIQUE INDEX publicacion_en_curso ON publicacion (org_id) WHERE estado IN ('en_cola', 'horneando');

-- Lo que hizo cada quien (heredado de la pestaña Registro de la 2.0, en serio).
CREATE TABLE registro (
  org_id TEXT NOT NULL,
  id INTEGER PRIMARY KEY,
  instante TEXT NOT NULL,
  actor TEXT NOT NULL,
  accion TEXT NOT NULL,
  entidad TEXT NOT NULL,
  entidad_id TEXT,
  antes TEXT CHECK (antes IS NULL OR json_valid(antes)),
  despues TEXT CHECK (despues IS NULL OR json_valid(despues))
);
-- Costo: 1 fila por acción registrada. El panel muestra el registro de la tienda.
CREATE INDEX registro_por_tienda ON registro (org_id, id);

-- Escrituras del panel con clave `op` (8–64 caracteres): repetir no aplica dos veces.
CREATE TABLE operacion (
  org_id TEXT NOT NULL,
  op TEXT NOT NULL CHECK (length(op) BETWEEN 8 AND 64),
  ruta TEXT NOT NULL,
  respuesta TEXT NOT NULL CHECK (json_valid(respuesta)),
  creada TEXT NOT NULL,
  PRIMARY KEY (org_id, op)
) WITHOUT ROWID;

CREATE TABLE importacion (
  org_id TEXT NOT NULL REFERENCES tienda (org_id),
  id TEXT NOT NULL,
  formato TEXT NOT NULL CHECK (formato IN ('tienda-import/1')),
  estado TEXT NOT NULL CHECK (estado IN ('revisando', 'lista', 'aplicando', 'aplicada', 'fallida')),
  resumen TEXT CHECK (resumen IS NULL OR json_valid(resumen)),
  problemas TEXT CHECK (problemas IS NULL OR json_valid(problemas)),
  pedida_por TEXT NOT NULL,
  creada TEXT NOT NULL,
  terminada TEXT,
  PRIMARY KEY (org_id, id)
) WITHOUT ROWID;

-- 7. Triggers -------------------------------------------------------------------------------

-- Apartar suma a `reservado`; si no alcanza, el CHECK de `variante` aborta el lote completo.
CREATE TRIGGER apartado_suma AFTER INSERT ON apartado
WHEN NEW.estado = 'activo'
BEGIN
  UPDATE variante SET reservado = reservado + NEW.cantidad
   WHERE org_id = NEW.org_id AND id = NEW.variante_id;
END;

-- Cerrar un apartado (consumido, liberado o vencido) resta de `reservado`.
CREATE TRIGGER apartado_resta AFTER UPDATE OF estado ON apartado
WHEN OLD.estado = 'activo' AND NEW.estado <> 'activo'
BEGIN
  UPDATE variante SET reservado = reservado - OLD.cantidad
   WHERE org_id = OLD.org_id AND id = OLD.variante_id;
END;

-- Un apartado no cambia de variante ni de cantidad, ni vuelve a estar activo.
CREATE TRIGGER apartado_inmutable BEFORE UPDATE ON apartado
WHEN NEW.cantidad <> OLD.cantidad OR NEW.variante_id <> OLD.variante_id OR NEW.org_id <> OLD.org_id
  OR (OLD.estado <> 'activo' AND NEW.estado <> OLD.estado)
BEGIN
  SELECT RAISE(ABORT, 'apartado-inmutable');
END;

-- Solo las transiciones de `ref_transicion_pedido`.
CREATE TRIGGER pedido_transicion BEFORE UPDATE OF estado ON pedido
WHEN NEW.estado <> OLD.estado
  AND NOT EXISTS (SELECT 1 FROM ref_transicion_pedido WHERE de = OLD.estado AND a = NEW.estado)
BEGIN
  SELECT RAISE(ABORT, 'transicion-de-pedido-invalida');
END;

-- Solo las transiciones de `ref_transicion_cobro`.
CREATE TRIGGER cobro_transicion BEFORE UPDATE OF estado ON cobro
WHEN NEW.estado <> OLD.estado
  AND NOT EXISTS (SELECT 1 FROM ref_transicion_cobro WHERE de = OLD.estado AND a = NEW.estado)
BEGIN
  SELECT RAISE(ABORT, 'transicion-de-cobro-invalida');
END;

-- Ningún cambio de estado queda sin historial (P1).
CREATE TRIGGER pedido_historial AFTER UPDATE OF estado ON pedido
WHEN NEW.estado <> OLD.estado
BEGIN
  INSERT INTO pedido_evento (org_id, pedido_id, instante, tipo, de, a, actor)
  VALUES (NEW.org_id, NEW.id, NEW.actualizado, 'estado', OLD.estado, NEW.estado, NEW.cambiado_por);
END;

-- Ningún cambio de inventario queda sin su fila en el libro.
CREATE TRIGGER variante_libro AFTER UPDATE OF stock ON variante
WHEN NEW.stock IS NOT OLD.stock AND NEW.stock IS NOT NULL AND OLD.stock IS NOT NULL
BEGIN
  INSERT INTO movimiento_inventario (org_id, variante_id, delta, stock_resultante, motivo, ref, instante)
  VALUES (NEW.org_id, NEW.id, NEW.stock - OLD.stock, NEW.stock, coalesce(NEW.cambio_motivo, 'ajuste'), NEW.cambio_ref, NEW.actualizado);
END;

-- La forma de pago se elige mientras el pedido está pendiente. Después, cambiarla escondería de qué
-- camino salió la plata.
CREATE TRIGGER pedido_forma_fija BEFORE UPDATE OF forma_pago ON pedido
WHEN NEW.forma_pago <> OLD.forma_pago AND OLD.estado <> 'pendiente'
BEGIN
  SELECT RAISE(ABORT, 'forma-de-pago-fija');
END;

-- Solo las transiciones de `ref_transicion_contraentrega`.
CREATE TRIGGER contraentrega_transicion BEFORE UPDATE OF estado ON contraentrega
WHEN NEW.estado <> OLD.estado
  AND NOT EXISTS (SELECT 1 FROM ref_transicion_contraentrega WHERE de = OLD.estado AND a = NEW.estado)
BEGIN
  SELECT RAISE(ABORT, 'transicion-de-contraentrega-invalida');
END;

-- Una contraentrega es de un pedido que se paga así.
CREATE TRIGGER contraentrega_de_su_pedido BEFORE INSERT ON contraentrega
WHEN NOT EXISTS (SELECT 1 FROM pedido p WHERE p.org_id = NEW.org_id AND p.id = NEW.pedido_id AND p.forma_pago = 'contraentrega')
BEGIN
  SELECT RAISE(ABORT, 'pedido-sin-contraentrega');
END;

-- El recaudo también deja su historia en el pedido.
CREATE TRIGGER contraentrega_historial AFTER UPDATE OF estado ON contraentrega
WHEN NEW.estado <> OLD.estado
BEGIN
  INSERT INTO pedido_evento (org_id, pedido_id, instante, tipo, de, a, actor)
  VALUES (NEW.org_id, NEW.pedido_id, NEW.actualizado, 'recaudo', OLD.estado, NEW.estado, NEW.cambiado_por);
END;

-- Despachar contra entrega exige la guía y la fila del recaudo, en el mismo lote.
CREATE TRIGGER pedido_despachado_contraentrega BEFORE UPDATE OF estado ON pedido
WHEN NEW.forma_pago = 'contraentrega' AND NEW.estado = 'despachado' AND OLD.estado <> 'despachado'
  AND (NEW.guia IS NULL OR NOT EXISTS (SELECT 1 FROM contraentrega c WHERE c.org_id = NEW.org_id AND c.pedido_id = NEW.id))
BEGIN
  SELECT RAISE(ABORT, 'contraentrega-sin-guia');
END;

-- Entregar un pedido contra entrega es recaudar su plata: la fila pasa a `recaudado` primero.
CREATE TRIGGER pedido_entregado_recaudado BEFORE UPDATE OF estado ON pedido
WHEN NEW.forma_pago = 'contraentrega' AND NEW.estado = 'entregado' AND OLD.estado <> 'entregado'
  AND NOT EXISTS (SELECT 1 FROM contraentrega c WHERE c.org_id = NEW.org_id AND c.pedido_id = NEW.id AND c.estado = 'recaudado')
BEGIN
  SELECT RAISE(ABORT, 'contraentrega-por-recaudar');
END;

-- Devolver uno que viajaba contra entrega dice qué pasó con la plata: devuelta o perdida.
CREATE TRIGGER pedido_devuelto_contraentrega BEFORE UPDATE OF estado ON pedido
WHEN NEW.forma_pago = 'contraentrega' AND NEW.estado = 'devuelto' AND OLD.estado = 'despachado'
  AND NOT EXISTS (SELECT 1 FROM contraentrega c WHERE c.org_id = NEW.org_id AND c.pedido_id = NEW.id AND c.estado IN ('devuelto', 'perdido'))
BEGIN
  SELECT RAISE(ABORT, 'contraentrega-sin-cerrar');
END;

-- Un pedido de un canal que exige aceptación no pasa de `pendiente` sin la prueba de que la persona
-- aceptó los términos (Ley 1480 arts. 48 y 50). Era un CHECK con los canales escritos; con los
-- canales en una tabla de referencia, son dos triggers: al crearlo y al cambiarle el estado.
CREATE TRIGGER pedido_aceptacion_al_crear BEFORE INSERT ON pedido
WHEN NEW.estado <> 'pendiente' AND NEW.aceptado IS NULL
  AND EXISTS (SELECT 1 FROM ref_canal WHERE id = NEW.canal AND exige_aceptacion = 1)
BEGIN
  SELECT RAISE(ABORT, 'pedido-sin-aceptacion');
END;
CREATE TRIGGER pedido_aceptacion BEFORE UPDATE OF estado ON pedido
WHEN NEW.estado <> 'pendiente' AND NEW.aceptado IS NULL
  AND EXISTS (SELECT 1 FROM ref_canal WHERE id = NEW.canal AND exige_aceptacion = 1)
BEGIN
  SELECT RAISE(ABORT, 'pedido-sin-aceptacion');
END;
```

## Anexo B · Base de control (`infrastructure/migraciones/tienda-control/0001_control_v1.sql`)

```sql
-- Tienda 3.0 · base de control `tienda_control` (una por despliegue del producto, sin shards).
-- Guarda lo que tiene que ser único en todo el producto: los nombres cortos y los hostnames.
-- El despacho no la lee en cada visita: lee el KV `TIENDA_HOSTS`, que se deriva de aquí (P2) y que
-- un cron reconstruye completo cada día para que una escritura perdida no quede para siempre.

-- El nombre corto es también el hostname de la tienda sin dominio propio: <slug>.laboratorio-digital.app
-- (ADR-27). Ese primer nivel lo comparten las tiendas y los proyectos nuevos del ecosistema, así que
-- un nombre lo toma una tienda o lo reserva la plataforma, nunca los dos (triggers del final).
CREATE TABLE slug (
  -- Sin «--»: ese espacio es de la plataforma (<slug>--staging).
  slug TEXT PRIMARY KEY CHECK (
    length(slug) BETWEEN 3 AND 40 AND slug NOT GLOB '*[^a-z0-9-]*' AND slug NOT GLOB '-*' AND slug NOT GLOB '*-'
    AND slug NOT GLOB '*--*'
  ),
  org_id TEXT NOT NULL UNIQUE,
  celda_id TEXT NOT NULL,
  creado TEXT NOT NULL
) WITHOUT ROWID;

-- Por qué un nombre no se puede tomar. `proyecto`: un proyecto del ecosistema vive o vivirá en
-- <nombre>.laboratorio-digital.app; `marca`: una marca ajena o del ecosistema (contra la suplantación).
-- Los de `proyecto` y `marca` los siembra el despliegue desde infrastructure/dominios.json (P2).
CREATE TABLE ref_motivo_reserva (
  id TEXT PRIMARY KEY
) WITHOUT ROWID;
INSERT INTO ref_motivo_reserva (id) VALUES ('infraestructura'), ('suplantacion'), ('proyecto'), ('marca');

CREATE TABLE slug_reservado (
  slug TEXT PRIMARY KEY CHECK (slug NOT GLOB '*[^a-z0-9-]*'),
  motivo TEXT NOT NULL REFERENCES ref_motivo_reserva (id)
) WITHOUT ROWID;
INSERT INTO slug_reservado (slug, motivo) VALUES
  ('www', 'infraestructura'), ('api', 'infraestructura'), ('panel', 'infraestructura'),
  ('img', 'infraestructura'), ('mcp', 'infraestructura'), ('origen', 'infraestructura'),
  ('correo', 'infraestructura'), ('estado', 'infraestructura'), ('cdn', 'infraestructura'),
  ('admin', 'suplantacion'), ('soporte', 'suplantacion'), ('ayuda', 'suplantacion'),
  ('pagos', 'suplantacion'), ('cuenta', 'suplantacion'), ('entrar', 'suplantacion'),
  ('seguridad', 'suplantacion'), ('abuse', 'suplantacion');

-- Un hostname que sirve a una tienda. `tipo`: de la plataforma (<slug>.laboratorio-digital.app) o
-- propio del comercio (hostname personalizado de Cloudflare for SaaS). `rol`: el canónico sirve;
-- un alias responde 301 al canónico. Un hostname retirado no se borra: volver a tomarlo exige
-- demostrar otra vez la propiedad (TXT), contra la toma de subdominios colgantes.
CREATE TABLE dominio (
  hostname TEXT PRIMARY KEY CHECK (
    hostname = lower(hostname) AND length(hostname) <= 253 AND hostname GLOB '*?.?*'
    AND hostname NOT GLOB '*[^a-z0-9.-]*' AND hostname NOT GLOB '.*' AND hostname NOT GLOB '*.'
  ),
  org_id TEXT NOT NULL,
  celda_id TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('plataforma', 'propio')),
  rol TEXT NOT NULL CHECK (rol IN ('canonico', 'alias')),
  estado TEXT NOT NULL CHECK (estado IN ('pendiente', 'validando', 'activo', 'error', 'retirado')),
  cf_hostname_id TEXT,                   -- id del hostname personalizado en Cloudflare for SaaS
  validacion TEXT CHECK (validacion IS NULL OR json_valid(validacion)),   -- registros TXT a crear
  motivo TEXT,
  creado TEXT NOT NULL,
  activado TEXT,
  retirado TEXT
) WITHOUT ROWID;
-- Un solo canónico activo por tienda. Costo: 1 fila por canónico activo.
CREATE UNIQUE INDEX dominio_un_canonico ON dominio (org_id) WHERE rol = 'canonico' AND estado = 'activo';
-- Los hostnames de una tienda, para el panel y para reconstruir el KV. Costo: 1 fila por hostname.
CREATE INDEX dominio_por_tienda ON dominio (org_id);

-- Un nombre reservado no lo toma una tienda, y uno que ya tiene tienda no se reserva: el despliegue
-- que intente reservarlo para un proyecto falla con el nombre (P1), en vez de quitarle la dirección.
CREATE TRIGGER slug_no_reservado BEFORE INSERT ON slug
WHEN EXISTS (SELECT 1 FROM slug_reservado WHERE slug = NEW.slug)
BEGIN
  SELECT RAISE(ABORT, 'slug-reservado');
END;
CREATE TRIGGER reserva_no_tomada BEFORE INSERT ON slug_reservado
WHEN EXISTS (SELECT 1 FROM slug WHERE slug = NEW.slug)
BEGIN
  SELECT RAISE(ABORT, 'slug-en-uso');
END;
```

## Anexo C · Lista de paridad con la Tienda 2.0

Lo que el estudio pide conservar de la 2.0 (§15.3 [C12]): su contrato de puertas **como especificación**, sus cinco mecanismos de idempotencia y su suite como pruebas de contrato. Se leyó en la versión 1.0.0 (`docs/CONTRATOS.md` §6 y `docs/ARQUITECTURA.md` §8). Antes de cargar una tienda (M6), cada fila que esa tienda use tiene que pasar en staging.

**Las puertas públicas y del panel:**

| Puerta de la 2.0 | Qué hace | En la 3.0 | Cómo se comprueba |
|---|---|---|---|
| `catalogo` · `version` | El catálogo para la página y la versión del backend | `/catalogo.json` horneado; la versión va en el manifiesto | e2e: el carrito con el catálogo horneado, sin API |
| `validar` | Recalcula el carrito contra la hoja | `POST /api/v1/cotizar` | Casos de `dinero` y la e2e del carrito corregido |
| `registrar` | Graba el pedido; `duplicado: true` si ya estaba | `POST /api/v1/pedidos`, con `duplicado` por `codigo` | Tres envíos del mismo pedido dejan uno |
| `pago_crear` · `pago_estado` | Cobro en línea y su estado | `POST /api/v1/cobros` y `/cobros/estado` | Pago real en el ambiente de pruebas de Bold (M3) |
| `seguimiento` | El pedido con su enlace | `POST /api/v1/seguimiento` | El mismo error para todo fallo |
| `avisame` | Cuenta las personas que esperan | `POST /api/v1/avisame` | Solo conteos |
| `entrar` · `recuperar_pedir` · `recuperar_confirmar` | Entrar al panel y recuperar la clave | El CORE, con Google o un enlace por correo. No hay clave que recuperar | e2e del panel |
| `sesion` | Quién entró y qué puede | `GET /api/panel/v1/sesion` | Matriz de permisos |
| `productos` · `guardar_producto` · `activar_producto` · `borrar_producto` · `guardar_combinaciones` | Catálogo con variantes | `productos/*` y `variantes/guardar` | e2e del comercio |
| `subir_foto` | Fotos del producto | `medios/subir`, con las derivadas del navegador | e2e con una foto real |
| `pedidos` · `estado_pedido` · `enlace_seguimiento` | Pedidos, estados y enlace nuevo | `pedidos/*` | Transiciones y libro de inventario |
| `configuracion` · `guardar_configuracion` | Las claves de la hoja | `ajustes/*`, por sección | Cada sección con su esquema |
| `guardar_envio` · `guardar_cupon` | Envíos y cupones | `envios/*` y `cupones/*` | Casos de `dinero` |
| `publicacion` · `publicar` | Publicar el catálogo | `publicar` y `publicaciones` (horno en cola) | Publicar y volver atrás en menos de 60 s |
| `tablero` | Ventas y pendientes | `tablero` | Cuadra con los pedidos de prueba |
| `avisame_hecho` | Atender un «avísame» | `avisame/{variante}/atendido` | — |
| `colaborador` | Dar acceso a otra persona | Invitación del CORE con el rol `colaborador` | e2e del colaborador con sus límites |
| `actualizacion` · `actualizar` · `diagnostico` | Que la tienda se actualice sola, y su diagnóstico | No existen: un despliegue para todas (causa 2). El diagnóstico es el registro, el vigía y la compuerta | — |
| Las de montaje (`panel`, `identidad`, `bloques`, `sembrar`, `fotos`, `foto`, `permiso`) y `menu` | Montar la tienda y su menú en la hoja | No existen: alta y carga con `tienda-import/1` (§17); no hay hoja | La carga de cada tienda, revisada antes de aplicarla |

**Los cinco mecanismos de idempotencia del pedido:**

| En la 2.0 | Problema que resolvió | En la 3.0 |
|---|---|---|
| Número de pedido estable por carrito | Un doble toque creaba dos pedidos | `codigo` generado una vez por carrito en el navegador (§8.3) |
| Deduplicación en el servidor (`duplicado: true`) | Tres envíos dejaban tres entradas | `UNIQUE (org_id, codigo)` y la respuesta `duplicado` |
| `LockService` y escritura por número en `Validaciones` | Dos validaciones simultáneas creaban dos filas | Un lote de D1, que escribe de a uno por base, y el `CHECK` de `reservado` (§7.1). No hacen falta candados |
| Columna `Inventario` (descontado o devuelto) | Confirmar, anular y volver a confirmar descuadraba el stock | `pedido_linea.descontado` y el libro de inventario (§5.3) |
| Congelado tras el envío | Una validación ya registrada se reescribía | Las líneas son copias del día y el pedido solo cambia por las transiciones permitidas |

**La suite de la 2.0 como prueba de contrato:** sus casos de pedido, cobro y seguimiento se traducen a la batería de la API de la 3.0 (§16). Lo que la 2.0 no podía probar, porque Apps Script no lee cabeceras, se agrega: el webhook firmado de Bold (§9.4).
