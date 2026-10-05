# Estudio de mercado y vigilancia tecnológica de herramientas de ecommerce
## Colombia, Latinoamérica y referentes globales — Implicaciones para ED1

**Versión:** 1.3: complementada el 5 de octubre de 2026 con el informe «Ecommerce en Colombia y Latinoamérica» (complementos **[C1]–[C13]**, anexo §20). La 1.2 fue validada a la luz del ecosistema y puesta al día con las respuestas del dueño ese mismo día (ver «Control de versiones»).  
**Fecha de corte:** 4 de octubre de 2026, hora de Colombia. Lo agregado en la versión 1.1 se consultó el 5 de octubre de 2026. Lo agregado en la versión 1.3 se consultó el 30 de septiembre de 2026; tres páginas se reabrieron el 5 de octubre (§18.6).  
**Documento de referencia:** `docs/ecosistema/historia/ECOSISTEMA-DIGITAL-ED1-v1.2.md`, versión del 28 de septiembre de 2026. Desde la versión 1.1, también lo que el ecosistema ya construyó, midió o decidió (§3.3).  
**Validación:** `VALIDACION-ESTUDIO-MERCADO-ECOMMERCE-ED1-2026-10.md`, en esta misma carpeta: hallazgos [V1]–[V11] y por qué cambió cada sección.  
**Complemento:** informe «Ecommerce en Colombia y Latinoamérica: funcionalidades, proveedores, precios y modelos de monetización», del 30 de septiembre de 2026 [S132]. De ahí salen los complementos [C1]–[C13]; el anexo §20 dice qué entró, qué no y por qué.  
**Naturaleza del trabajo:** investigación documental de fuentes públicas; análisis competitivo, tecnológico y económico; recomendaciones e hipótesis de validación.  
**Alcance temporal:** información accesible al corte. No representa resultados de todo octubre ni del cierre de 2026.  
**Moneda:** COP, MXN, ARS o USD según cada fuente; no se convierten cifras entre monedas sin una tasa y fecha explícitas.

> **Resultado principal del análisis:** ED1 tiene una oportunidad que merece validación en herramientas operativas para pequeños comercios colombianos que venden por WhatsApp, redes y tiendas existentes. La investigación documental no demuestra por sí sola disposición a pagar por otra plataforma de tiendas. **[V1]** Pero el ecosistema ya opera tiendas, con comercios reales y un producto vigente (la Tienda 2.0), y ya tiene la plataforma que una tienda alojada necesita (§3.3). La decisión no es si se construye un SaaS de ecommerce: es si se sigue con la 2.0 más herramientas o se invierte en la 3.0. Conviene comprobar primero, con esos comercios y con las herramientas, la utilidad recurrente de resolver catálogo, precio, pedido, cobro y conciliación, y decidir la inversión con esa señal.

### Control de versiones

| Versión | Fecha | Cambios |
|---|---|---|
| 1.0 | 4 oct 2026 | Investigación documental, con ED1 v1.2 como única fuente sobre el proyecto |
| 1.1 | 5 oct 2026 | Validación a la luz del ecosistema. Lo que ya existe (§3.3) **[V1]**; medir la demanda antes de construir (§12.6) **[V2]**; cuotas corregidas y restricciones de la cuenta (§9.4) **[V3]**; cobro y economía unitaria de los planes de ED1 (§10.4, §13) **[V4]**; paquete de herramientas (§15) **[V5]**; HTML por producto en la tienda alojada (§12.3) **[V6]**; tarifas de WhatsApp y regla de Meta sobre IA (§11.1, §12.1) **[V7]**; fases y umbrales de ED1 (§16) **[V8]**; lo que la plataforma ya resuelve y lo que falta (§8.1, §16.4) **[V9]**; datos personales, términos y antiabuso (§14.1) **[V10]**; correcciones menores **[V11]** |
| 1.2 | 5 oct 2026 | Respuestas del dueño (validación §5): hay dos tiendas 2.0 en operación, no dos comercios en la Tienda Básica (§3.3, S80); la Tienda 3.0 entra como excepción declarada y se diseña desde cero, con los datos actuales cargados por scripts (§15.3). Arquitectura en `docs/plataforma/` y `docs/tienda/` |
| 1.3 | 5 oct 2026 | Complemento con el informe «Ecommerce en Colombia y Latinoamérica» (30 sep 2026), sin cambiar las conclusiones de la 1.2. Contexto de mercado adicional (§4.1, §4.2) **[C1]**; precios de plataformas y tasa efectiva de VTEX (§6.3, §7.1) **[C2]**; cómo empaqueta y cobra el mercado lo básico y lo premium (§8.1, §8.4) **[C3]**; más tarifas de pasarelas, PayU→Rapyd y Addi (§10.2, §10.5) **[C4]**; fuente primaria de WhatsApp y herramientas de marketing (§11.1, §11.6) **[C5]**; precios de facturación (§11.2) **[C6]**; entrega y contraentrega (§11.3) **[C7]**; comisiones de marketplaces (§11.4) **[C8]**; modelos de monetización observados y líneas por uso (§13.1, §13.2) **[C9]**; escenarios de costo total del comercio (§7.4) **[C10]**; hipótesis de empaquetado y precio (§13.6) **[C11]**; límites de infraestructura y camino 2.0 → 3.0 (§9.4, §15.3) **[C12]**; radar, pendientes y control editorial (§17, §19) **[C13]**. Fuentes S94–S133 (§18.6) |

---

## 1. Resumen ejecutivo

### 1.1 Hallazgos sustentados

1. **Existe actividad comercial digital significativa en Colombia.** La CCCE reporta para 2025 ventas nominales de COP 145,4 billones, 684,6 millones de transacciones y una participación del débito a cuenta/PSE del 57,2 % en valor. Para el primer trimestre de 2026 comunica un crecimiento anual del número de transacciones de hasta el 22,2 %. Son mediciones del comercio, no del gasto en software para crear tiendas. [S02–S03]
2. **La oferta de plataformas ya cubre mucho más que una vitrina y un carrito.** En las páginas oficiales revisadas aparecen funciones de administración, multicanalidad, B2B, automatización, IA e integraciones. Su inclusión depende de plan, país y producto. No basta replicar una lista de funciones para obtener una ventaja competitiva. [S16, S18, S21, S24–S28]
3. **La localización altera la comparación económica.** Tiendanube Colombia publica tres planes de pago y 0 % de comisión de plataforma; su oferta gratuita en otros países no puede trasladarse a Colombia. Shopify publica cargos por proveedores externos y su lista de Shopify Payments no incluye Colombia al corte. [S16–S19]
4. **Los modelos comerciales cambian.** Ecwid documenta ajustes de precios en marzo de 2026; BigCommerce presenta planes Core/Growth/Scale/Performance y diferencia proveedores de pago integrados y abiertos. Una comparación antigua puede omitir cargos actuales. [S22–S23, S25]
5. **El QR dinámico con monto tiene vías comerciales documentadas.** Nequi publica una API que genera el QR por cobro y permite consultar su estado; exige contrato vigente, certificación y pruebas. La fuente no permite concluir costo cero. Bre-B ofrece pagos por QR, pero su documentación general no demuestra acceso universal a una API gratuita para cualquier sitio. [S45–S46]
6. **La venta mediante agentes de IA ya tiene documentación técnica.** Se revisaron ACP de OpenAI, UCP de Google y catálogos para agentes de Shopify. Un estándar abierto no equivale a activación comercial inmediata: OpenAI señala que Instant Checkout está disponible para socios aprobados. [S72–S74]
7. **Hay un ecosistema de herramientas complementarias.** Facturación, contabilidad, logística y marketplaces cuentan con APIs o integraciones documentadas. Esto abre posibilidades para productos que mejoren una tienda existente, además de crear tiendas nuevas. [S51–S57]
8. **[V1] El ecosistema ya opera tiendas y tiene la plataforma.** La línea ecommerce tiene comercios reales con cobro por Bold, y un producto vigente, la Tienda 2.0. CultivoPro tiene en producción cuentas, organizaciones y roles, cobro con adaptador y conciliación, aislamiento por cliente y vigía de cuota. Un análisis recomienda construir la Tienda 3.0 sobre esa plataforma. Es dato interno, comprobable en el repositorio, no evidencia de mercado. [S80–S82, S85]
9. **[C10] En un comercio pequeño, cobrar cuesta más que la plataforma.** Con tarifas públicas observadas y tres escenarios ilustrativos de 50, 500 y 2.500 pedidos al mes, el cobro en línea explica entre el 80 % y el 90 % del costo de la pila cuando la plataforma no cobra comisión. Una comisión de plataforma del 1–2 % sobre las ventas suma más que su mensualidad. Es aritmética de supuestos declarados, no una medición (§7.4). [S16, S18, S39, S117]
10. **[C4] [C7] [C8] Vender por cada canal cuesta órdenes de magnitud distintos.** Un marketplace publica comisiones de 8–20 % por venta y a otro se le atribuyen de 6–20 %. Las pasarelas agregadoras publican entre 2,64 % y 3,29 % más un cargo fijo, y cobran más por entregar el dinero antes. El recaudo contraentrega se observa entre 1,5 % y 4 % en una fuente secundaria. Ninguna es tarifa contractual (§10.2, §11.3, §11.4). [S39, S41, S107, S120, S122, S124]

### 1.2 Recomendaciones para ED1 — juicio del consultor

- **Entrada inicial:** calculadora de rentabilidad por pedido, preparación de catálogo y cotizador/pedido para WhatsApp, con procesamiento local cuando sea posible. **[V2]** Antes de construirlas, medir su demanda de búsqueda con el método que el ecosistema ya usó (§12.6).
- **Primer producto de pago a contrastar:** administración sencilla de pedidos y conciliación, con exportación de datos y conexiones a proveedores existentes. **[V1]** La primera evidencia de pago, soporte y retención se toma de los comercios reales de la línea ecommerce, antes de un piloto nuevo. El cobro con Bold y su conciliación ya existen (§10.4).
- **Alternativa de monetización temprana:** implementación, preparación de catálogo y automatización acotada para comercios; convertir lo repetible en software después de observar varios casos.
- **Posponer:** marketplace propio, OMS empresarial, logística propia, motor contable/fiscal completo y agentes autónomos que ejecuten pagos sin controles comerciales probados.
- **Mantener la premisa ED1:** infraestructura sin gasto recurrente durante validación, dentro de cuotas. Contabilizar aparte pagos, mensajería, IA, soporte y trabajo humano. **[V3]** Las cuotas gratuitas se comparten con CultivoPro y queda un solo Cron Trigger libre en la cuenta: lo transaccional de una tienda pide Workers Paid (USD 5 al mes) o compartir el despachador (§9.4).
- **[V4] Antes del primer cobro real de un plan:** términos y condiciones, factura electrónica y la decisión sobre el IVA o su exclusión, con contador y abogado (§13.3, §14.1).
- **[C3] [C7] Tratar la contraentrega y el costo de entrega como parte del básico colombiano.** La versión 1.2 no los cubría. Entran primero como campos de la calculadora de rentabilidad (herramienta 1) y como pregunta de entrevista, antes que como integración (§8.1, §11.3, §15.2, §16.2).
- **[C11] Anclar la hipótesis de precio de la tienda alojada en lo que el comercio ya paga por separado** (tienda + facturador), y probarla con prepago. No cambia la decisión de §17.3 (§13.6).
- **[C13] Sumar al radar** el paso de PayU a Rapyd, la tasa de cambio para los costos en USD y las comisiones de marketplaces (§17.1).

Estas recomendaciones no son cuotas de mercado, pronósticos de ventas ni resultados de entrevistas. El plan de comprobación está en la sección 16.

---

## 2. Metodología, trazabilidad y límites

### 2.1 Qué se investigó

Se estudiaron cinco mercados relacionados:

| Mercado | Qué vende o resuelve | Relación con ED1 |
|---|---|---|
| Plataformas de tienda | Catálogo, carrito, checkout y administración | Posible vertical SaaS futuro |
| Complementos para comercio | Precios, imágenes, feeds, pedidos, CRM, analítica | Herramientas gratuitas y premium |
| Servicios habilitadores | Pagos, mensajería, facturación, logística | Integraciones y costos externos |
| Canales de venta | WhatsApp, redes, marketplaces, búsqueda | Adquisición y ejecución comercial |
| Servicios profesionales | Implementación, migración, automatización y operación | Ingreso temprano y aprendizaje del cliente |

La unidad competitiva no es solamente la página de tienda: también es la combinación de software, canal, datos, servicios y confianza que permite completar y atender una venta.

### 2.2 Jerarquía de evidencia

| Etiqueta | Uso en el informe | Qué permite concluir |
|---|---|---|
| **Dato publicado** | Informe gremial, publicación estadística o reporte financiero | Lo que la entidad reporta, para su período y metodología |
| **Capacidad documentada** | Documentación técnica oficial | Que existe una interfaz o función descrita; no que haya sido probada aquí |
| **Oferta observada** | Tarifario o página de planes oficial | Condiciones públicas visibles al corte; no una cotización contractual |
| **Inferencia** | Interpretación que conecta varios hallazgos | Una conclusión razonada, revisable |
| **Hipótesis/propuesta** | Segmento, precio, experimento o prioridad ED1 | Algo que requiere comprobación con usuarios o datos propios |
| **No confirmado** | Acceso insuficiente, ambigüedad o ausencia de evidencia | No se transforma en afirmación negativa ni en dato inventado |
| **Dato interno [V1]** | Código, bitácoras, decisiones y mediciones del propio ecosistema, en este repositorio | Lo que el ecosistema ya construyó, midió o decidió; no es evidencia del mercado |
| **Fuente secundaria [C]** | Comparador, blog de proveedor, agencia, medio o consultora que cita una tarifa o un dato | Orientación para saber dónde mirar; se confirma en la fuente primaria antes de decidir o contratar. No sostiene por sí sola ninguna recomendación |

Se priorizaron fuentes primarias: gremios, autoridades, responsables de los estándares, documentación de fabricantes y reportes de las propias empresas. El blog de AMVO se utiliza con una salvedad expresa: la cifra mexicana allí atribuida al EVO 2026 no sustituye la revisión integral de su base metodológica. No se utilizaron estimaciones anónimas ni cifras de consultoras sin acceso al método para calcular un TAM de software.

### 2.3 Procedimiento y cobertura

1. Lectura de ED1 para identificar público, restricciones y modelo de crecimiento.
2. Búsqueda de publicaciones 2025–2026 y revisión de páginas oficiales de producto.
3. Apertura de documentos y verificación específica de moneda, período, planes y condiciones relevantes.
4. Contraste de fuentes que podían inducir errores: precios regionales, cargo de plataforma frente a procesamiento de pago, datos nominales frente a reales, API pública frente a contratación comercial.
5. Construcción de matrices, diagnóstico e hipótesis de validación.

Se revisaron proveedores representativos, no todos los productos existentes. El registro final contiene 79 entradas: el documento ED1 y 78 referencias externas, algunas con más de un recurso enlazado. **[V1]** La versión 1.1 suma S80–S93 (§18.5): ocho de dato interno del ecosistema y seis externas. Algunas páginas son dinámicas y no contienen una fecha editorial verificable; se identifican como observaciones al corte, no como archivos históricos certificados.

**[C]** La versión 1.3 suma S94–S133 (§18.6): 38 externas, una de dato interno (S131) y el informe complementario (S132). De las externas, 13 son páginas oficiales del proveedor o de la entidad; las demás son secundarias y se marcan así cada vez que se usan.

### 2.4 Límites que afectan la decisión

- No se realizaron entrevistas, encuestas propias, compras de prueba ni implementaciones en sandbox. El estudio establece un mapa documental, no una certificación de funcionamiento.
- No se obtuvieron cifras comparables de participación de plataformas de tienda específicamente en Colombia. Volumen global, tiendas declaradas, tráfico y participación de software son métricas distintas.
- No se estimaron volumen de búsqueda, CPC, CAC, conversión o disposición a pagar de ED1. Deben medirse.
- No se suman cifras nacionales de distinto alcance para producir un supuesto mercado LATAM comparable.
- El tablero brasileño consultado no expuso en la extracción una serie numérica utilizable; no se rellenó con una proyección de prensa.
- El resumen CCCE fue accesible; los enlaces a sus informes completos no se recuperaron. Las cifras se atribuyen a ese resumen y no se supone conocer toda su metodología.
- La edición CAPECE 2025–2026 se identificó, pero no se recuperó su informe completo. Se distingue de los datos visibles de la edición 2024–2025.
- Los precios pueden variar por impuestos, periodicidad, promoción, volumen, tipo de negocio y negociación. No se prometen tarifas de contratación.
- **[V1]** La versión 1.0 solo conoció ED1. La 1.1 incorpora lo que el ecosistema ya tiene (§3.3), pero no los datos comerciales de sus comercios (cuáles pagan, cuánto, soporte, retención), que no están en este repositorio: los da el dueño (§16.1).
- **[V11]** En la versión 1.1 no se pudieron abrir de nuevo los precios de Tiendanube Colombia (S16) ni el tarifario de Bold (S39): se usan como los observó la 1.0. Sí se comprobaron los totales de 2025 de la CCCE y el contenido de la Ley 2439 de 2024.
- **[C]** Lo agregado en la versión 1.3 viene de un informe de escritorio hecho con otro criterio de fuentes: usó comparadores, blogs de proveedores, agencias y consultoras. Aquí cada dato entra con su etiqueta (§2.2) y lo secundario no sostiene ninguna decisión.
- **[C]** El 30 de septiembre no abrieron el tarifario de Wompi, las tarifas de PayU ni la ayuda de comisiones de Mercado Pago. Sus cifras salen de una fuente secundaria o de otra página oficial, y se dice en cada caso (§10.2).
- **[C]** Ese informe traía dos datos que esta versión corrige en vez de heredar: precios de Shopify tomados de una fuente secundaria, que no coinciden con la página de Colombia (S18), y un cambio de Meta para el 1 de octubre de 2026 que la documentación oficial no recoge (§11.1). El detalle está en §20.2.

---

## 3. Lectura del proyecto ED1

ED1 plantea herramientas gratuitas útiles como adquisición, retorno y cuenta como relación, y premium/SaaS/servicios como monetización. Su público inicial incluye pequeños negocios, independientes y comercios que venden por redes o WhatsApp, empezando por Colombia. Privacidad, contexto local y baja fricción son ejes de posicionamiento. La arquitectura propone procesamiento en navegador, páginas estáticas y APIs pequeñas; extraer plataforma después de contar con casos reales. [S01]

### 3.1 Qué significa esto para ecommerce

| Principio ED1 | Aplicación comercial | Pregunta que debe responder la validación |
|---|---|---|
| Herramienta gratuita de utilidad real | Resolver una tarea completa, aunque el usuario no compre | ¿Ahorra tiempo o evita un error observable? |
| Mismo público a lo largo del embudo | Herramientas utilizadas por el comerciante, no solo por compradores | ¿Quién utiliza la herramienta puede pagar la siguiente capa? |
| Contexto Colombia/LATAM | COP, prácticas de entrega, PSE, QR, formatos locales | ¿El contexto local mejora el resultado frente a una opción genérica? |
| Browser-first | Imágenes, cálculos, CSV y lectura local de QR | ¿La operación puede realizarse sin subir datos? |
| Costo cero en validación | Limitar cómputo, almacenamiento y automatización | ¿Qué sucede al agotar cada cuota? |
| Regla de tres | Extraer componentes desde comercios y flujos reales | ¿Hay suficientes usos distintos para justificar una abstracción? |
| Owner-first **[V11]** | Edición y administración por el comerciante. En ED1 el *owner* es el dueño del ecosistema (S01 §3.7): que el comerciante se atienda solo es lo que protege sus horas (S01 §25) | ¿Una operación cotidiana todavía requiere al desarrollador o al dueño? |

**Inferencia:** una herramienta que prepara el catálogo o identifica pérdidas por pedido puede atraer al mismo usuario que luego necesita pedidos e inventario. Una herramienta genérica con tráfico alto pero sin presencia de comerciantes puede aportar menos al vertical ecommerce. Debe probarse mediante segmentación voluntaria y observación de uso, no asumirse por el nombre de la herramienta.

### 3.2 Dos ventas que deben mantenerse separadas

ED1 puede vender una suscripción a un comerciante; ese comerciante, a su vez, vende productos a sus clientes. Son relaciones distintas. Sus cobros, facturas, impuestos, devoluciones, credenciales y reportes no deben mezclarse. El ingreso bruto procesado por una tienda tampoco es ingreso de ED1.

### 3.3 Lo que el ecosistema ya tiene **[V1] [V9]**

Dato interno, al 5 de octubre de 2026. Cambia el punto de partida del resto del estudio: varias capacidades que aquí se proponen ya existen y se reutilizan; otras existen, pero todavía hablan de otro producto.

| Pieza | Estado | Qué resuelve de este estudio | Fuente |
|---|---|---|---|
| Línea ecommerce | Dos tiendas 2.0 en operación (dato del dueño, 5 oct 2026; la versión 1.1 las ubicaba en la línea anterior, la «Tienda Básica»). La Tienda 2.0 («Tienda Panel», 1.0.0) es el único producto vigente: hoja de Google, Apps Script y un Worker por tienda, catálogo horneado, cobro con Bold y flota por anillos | Conducta real de pago, soporte y retención, que se empieza a medir ya (§16.1); el camino «2.0 → 3.0» (§15.3) | S80. El dueño precisó el 5 oct 2026 que hay dos tiendas 2.0 en operación |
| Tienda 3.0 (propuesta) | Análisis del 4 oct 2026: construirla sobre la plataforma, con cada tienda como una fila y no como un repositorio; la 2.0 sigue hasta migrar | La arquitectura de la «Tienda alojada completa» (§15.1) | S81 |
| CORE (cuentas) | En producción con CultivoPro: Google, organizaciones, membresías, roles, invitaciones y planes con vencimiento; tokens Ed25519 que cada celda verifica sin llamar al CORE | Administración y roles (§8.1); recuperación de cuenta con Google (§16.4). Sus valores todavía son del agro (§16.4) | S82, S85 |
| Cobro | Bold detrás de un adaptador; monto calculado en el servidor; verificación por API; conciliación cada 15 min; estado «revisar» si el monto no coincide | El flujo de §10.4, ya construido para los planes de CultivoPro | S83, S85 |
| Datos por cliente | Celdas con shards de D1; `org_id` en cada fila, con una prueba que lo exige en cada consulta; exportación portable | Aislamiento por comercio y exportación (§8.1, §9.2, §16.4) | S82, S85 |
| Operación | Kill switch por producto; vigía horario de cuota con niveles de degradación; alertas al dueño por Telegram; reporte semanal | Presupuesto por producto y degradación (§9.4) | S82 |
| Medición de demanda | Método con Keyword Planner: tipos de dato y regla de decisión fijada antes de ver los datos (1 oct 2026) | La medición que la versión 1.0 no hizo (§12.6) | S84 |
| Respaldo semanal de D1 | Diseñado; espera la señal del dueño | La restauración probada de §16.4: todavía no | S83 |

Lo que le falta a una tienda alojada no es la plataforma. Es el panel del comerciante, el catálogo horneado por tienda, los dominios propios, el correo transaccional y la migración de los comercios (S81, §4.2).

---

## 4. Mercado: Colombia y referencias regionales

### 4.1 Colombia — datos disponibles

| Indicador | Período | Valor publicado | Fuente y alcance |
|---|---|---:|---|
| Ventas online nominales | 2025 | COP 145,4 billones | Resumen CCCE de cierre; crecimiento nominal 11,1 % |
| Ventas online reales | 2025 | COP 105,7 billones | Serie real publicada por CCCE; crecimiento 5,9 % |
| Número de compras/transacciones | 2025 | 684,6 millones | Crecimiento anual 19,9 % |
| Ticket nominal promedio | 2025 | COP 212.373 | Caída 7,3 % según CCCE |
| Débito a cuenta/PSE: participación en valor | 2025 | 57,2 % | No es participación de una pasarela |
| Débito a cuenta/PSE: participación en número | 2025 | 46,5 % | Denominador diferente del anterior |
| Crecimiento del número de transacciones | Primer trimestre de 2026 | Hasta 22,2 % anual | Comunicación pública CCCE de ese trimestre |

Fuente: [S02–S03]. En español, un billón corresponde a un millón de millones. Las cifras nominales y reales no deben mezclarse; el resumen no aporta aquí todos los detalles de base y deflactor.

La CCCE también publica un análisis de madurez digital basado en EMICRON 2024 que considera 5,3 millones de micronegocios. **Ese universo no es un conteo de tiendas digitales, compradores de software ni clientes potenciales ya calificados de ED1.** Sirve para identificar un campo de investigación sobre digitalización, no para multiplicarlo automáticamente por una tarifa SaaS. [S04]

**Implicaciones — inferencia:**

- La relevancia de los pagos desde cuenta hace insuficiente diseñar una tienda colombiana solamente alrededor de tarjetas internacionales.
- Más transacciones con menor ticket puede hacer especialmente importante el cargo fijo por pago y el tiempo de atención por pedido. No demuestra por sí solo que el comercio necesite otra plataforma.
- La oportunidad debe medirse por comerciantes con una tarea no resuelta y capacidad de adopción, además de tamaño de ventas online.

**[C1] Contexto adicional de Colombia.** Datos que la versión 1.2 no traía. Cada uno con su alcance; los de consultora o prensa no se mezclan con la serie de la CCCE.

| Indicador | Período | Valor | Fuente y límite |
|---|---|---:|---|
| Peso del ecommerce en el comercio minorista | 2025 | ≈ 2,4 % en promedio | Resumen CCCE [S02] |
| Caída acumulada del ticket nominal | 2020–2025 | 35,8 % | Forbes Colombia, que cita a la CCCE [S94]. Secundaria |
| Cuarto trimestre: ventas y transacciones | Q4 2025 | COP 39,7 billones; +18,2 % en transacciones | Forbes Colombia [S94]. Secundaria |
| Compras desde el celular | 2024 | 87 % de las ventas online | PCMI [S95]. Consultora; método no auditado |
| Mezcla de medios de pago, por valor | 2024 | Tarjeta de crédito internacional 43 %; transferencias 34 %; débito 6 %; billeteras 5 %; BNPL 4 %; crédito local 3 %; efectivo 3 % | PCMI [S95]. No es comparable con el 57,2 % de la CCCE: otro año, otro universo y otra clasificación |
| Tráfico de los mayores comercios | Nov 2024 | Mercado Libre 37 millones de visitas; Falabella 15; AliExpress 14; Homecenter 11; Alkosto 11 | PCMI [S95]. Es tráfico, no ventas ni participación |
| Bre-B | Oct 2025 – may 2026 | En operación desde octubre de 2025; hasta 5 millones de operaciones diarias; 34,9 millones de usuarios; más de 105 millones de llaves; ticket promedio COP 155.755 | Infobae, con cifras del sistema al 4 de mayo de 2026 [S97]. Secundaria |

Lectura (inferencia):

- **Dos fuentes describen la mezcla de pagos de forma distinta y no se promedian.** La CCCE pone el débito a cuenta/PSE en 57,2 % del valor de 2025; PCMI pone la tarjeta de crédito internacional primero en 2024. Coinciden en lo que importa para el producto: una tienda colombiana sin pago desde cuenta deja por fuera una parte grande del mercado.
- **La adopción de Bre-B es alta, pero no prueba una vía de integración.** Refuerza la vigilancia de §10.1; no cambia que la API depende de la entidad contratada (S46).
- **El ticket cae mientras las transacciones crecen.** Refuerza lo dicho arriba sobre el cargo fijo por pago; se cuantifica en §10.2.
- **La concentración del tráfico en marketplaces** es un argumento para medir la coexistencia (§11.4), no para estimar la demanda de tiendas propias.

### 4.2 Latinoamérica — comparación con denominadores explícitos

| País | Evidencia disponible | Período real del dato | Lectura para ED1 |
|---|---|---|---|
| México | El blog oficial AMVO atribuye al EVO 2026 MXN 941 mil millones de ecommerce retail y crecimiento de 19,2 % | Ventas de 2025, informe publicado en 2026 | Mercado para investigar después de Colombia; el dato no mide software SaaS. El informe completo requiere descarga mediante formulario |
| Argentina | CACE informa ARS 19.533.815 millones y 181,5 millones de órdenes; +28 % en facturación y +21 % en órdenes | Enero–junio de 2026 | Evaluar inflación, cuotas y operación local; el crecimiento nominal no prueba crecimiento real |
| Chile | CCS informa aproximadamente USD 10 mil millones, +11,6 % nominal y algo más de 9 % real | 2025 | Mercado con necesidades locales de pagos y logística; hubo revisión de metodología |
| Perú | CAPECE 2024–2025 publica 18,7 millones de compradores, 335.000 comercios online y 40 % del ecommerce en marketplaces | Edición 2024–2025; no se atribuye a resultados completos de 2026 | Evaluar herramientas para coexistir con marketplaces y venta directa. No usar la edición previa como actualización 2026 |
| Brasil | Se localizaron el portal de datos ABComm/ABIACOM y la oferta Webshoppers de NIQ; no se recuperó una serie anual homogénea utilizable | No confirmado para una comparación cuantitativa al corte | Estudiar como entrada independiente: portugués, pagos y operación local; no asumir que traducir resuelve la expansión |

Fuentes: [S05–S11, S78]. La tabla evita un ranking en USD: retail, servicios, universos encuestados, IVA, tipos de cambio y métodos difieren.

**Control de calidad de Argentina:** el PDF CACE, de agosto de 2026, permite verificar la unidad monetaria. La fase de oferta usa 160 encuestas completas y 36 parciales de empresas socias, con trabajo de campo del 6 al 24 de julio; sus indicadores se proyectan y ajustan metodológicamente. La cifra de facturación incluye IVA. No equivale a un censo de todas las tiendas. El PDF evita una inconsistencia en la expresión verbal del monto presente en la página web de resumen. [S07]

**Control de calidad de México:** la página AMVO confirma la existencia y publicación del EVO 2026; la cifra de ventas se recuperó de una publicación de su blog que la atribuye al estudio. La confianza en período y atribución es mayor que la capacidad de auditar aquí su estimación completa. Se excluyen rankings mundiales derivados sin revisar su método. [S05–S06]

**[C1] Una estimación regional de consultora.** eMarketer estima para 2025 unos USD 191.250 millones de ventas de retail ecommerce en Latinoamérica, con crecimiento de 12,2 %; atribuye a Brasil, México y Argentina el 84,5 % y a México una penetración del 17,7 % del retail. Es una estimación cuyo método no se auditó aquí: se registra como contexto, no entra en la tabla anterior y no se usa para calcular un TAM (§2.2, §4.4). [S96]

### 4.3 Referencia mundial

El Census Bureau de Estados Unidos estima para el segundo trimestre de 2026 ventas retail online ajustadas estacionalmente de USD 340,2 mil millones, con crecimiento interanual de 12,2 %. La serie no está ajustada por cambios de precios. Es una referencia de un país, no un mercado mundial ni un TAM de plataformas. [S12]

El análisis mundial de este informe se concentra en capacidades, arquitectura, distribución y modelos de negocio que pueden contrastarse en documentación primaria. No se presenta una cifra global de ingresos de herramientas ecommerce sin una serie verificable y comparable.

### 4.4 Tamaño comercial de la oportunidad ED1

**No hay base suficiente para un TAM/SAM/SOM numérico confirmado.** Se propone estimarlo así:

| Capa | Definición útil | Información por obtener |
|---|---|---|
| TAM | Comercios de la geografía definida con el problema que el producto resuelve | Universo consistente; frecuencia y gravedad de la tarea |
| SAM | Comercios que ED1 puede atender con su idioma, canales, integraciones y soporte | Segmentación, requisitos bancarios y operativos, dispositivos |
| SOM | Comercios que puede captar, activar y retener con recursos reales | Embudo medido, CAC, capacidad de soporte, retención |

Para ingresos, utilizar **comercios pagadores × ingreso medio neto por comercio**, no ventas totales de ecommerce × porcentaje arbitrario. La sección 13 incluye escenarios puramente ilustrativos que no reemplazan esta estimación.

---

## 5. Clientes, necesidades y sustitutos

### 5.1 Segmentos a validar

| Segmento propuesto | Trabajo a resolver | Sustituto que debe investigarse | Posible entrada ED1 |
|---|---|---|---|
| Comercio social inicial | Publicar productos y recibir un pedido entendible | Chat, catálogo en WhatsApp, hoja de cálculo | Preparador de catálogo y pedido compartible |
| Comercio con pedidos frecuentes | Saber qué se debe cobrar y qué está pendiente | Listas manuales y revisión de movimientos | Bandeja de pedidos y conciliación |
| Tienda existente con baja eficiencia | Preparar imágenes, precios o feeds correctos | Plugins, agencia, trabajo manual | Herramientas complementarias exportables |
| Negocio con local y venta online | Evitar stock descoordinado | ERP/POS y hojas auxiliares | Importación y alertas; integración antes de sustituir el ERP |
| Venta por cotización/B2B pequeño | Cotizar, aplicar condiciones y seguir aprobaciones | PDF, email y chat | Cotizador con conversión a pedido |
| Agencia o implementador | Repetir configuraciones con menos trabajo | Plantillas y scripts propios | Utilidades por lotes y servicios empaquetados |

Esta es una segmentación analítica propuesta; no se afirma que cada segmento haya sido cuantificado en Colombia.

### 5.2 Factores de compra que conviene investigar

La entrevista debe contrastar: facilidad de uso desde móvil, tiempo para publicar, confiabilidad del cobro, costos totales, portabilidad, soporte, medios locales, manejo de entrega y claridad fiscal. Una plataforma más barata puede ser menos conveniente si el comerciante pierde ventas, duplica stock o emplea más tiempo operándola. Esta última frase es una relación económica, no un resultado de encuesta.

### 5.3 Criterios de selección para un comerciante

1. ¿Vende productos físicos, digitales, servicios, reservas o combinaciones?
2. ¿Cuántas variantes, pedidos y ubicaciones necesita administrar?
3. ¿Quién mantendrá catálogo, soporte y devoluciones?
4. ¿Qué medios de pago están contratables por su empresa y país?
5. ¿Necesita emitir factura electrónica e integrarse con su contabilidad?
6. ¿Qué datos y configuraciones puede recuperar si migra?
7. ¿Cuánto cuesta operar al volumen actual y al siguiente nivel?

ED1 puede convertir esta evaluación en una herramienta gratuita de selección y costo total, siempre que mantenga actualizado el registro de proveedores y muestre supuestos.

---

## 6. Estructura competitiva y actores de referencia

### 6.1 Familias de solución

| Familia | Ventaja potencial | Carga que sigue existiendo | Ajuste analítico a ED1 |
|---|---|---|---|
| SaaS integrado | Arranque rápido, administración y operación gestionada | Suscripción, restricciones y dependencias | Competidor del vertical; posible cliente de utilidades |
| Tienda incorporable | Añadir comercio a un sitio existente | Límites del servicio y compatibilidad de pago | Referente para el HTML actual |
| Software autohospedado | Control de código y extensiones | Infraestructura, mantenimiento y seguridad | Útil para servicios de implementación |
| Plataforma vinculada a ERP | Coherencia con inventario y administración | Configuración empresarial y módulos | Integración preferible a reconstruir funciones |
| Headless/componible | Control de experiencia y combinación de servicios | Integración, operación y observabilidad | Referente posterior a demanda comprobada |
| Marketplace | Acceso al canal y servicios asociados | Reglas, comisiones y relación mediada | Canal de coexistencia y conectores |
| Comercio social | Cercanía con el canal usado por el cliente | Atención y seguimiento del pedido | Hipótesis de entrada prioritaria |

La familia no determina automáticamente el costo o la dificultad: se debe cotizar y probar el caso concreto.

### 6.2 Plataformas representativas

Las capacidades siguientes están documentadas o aparecen en su oferta oficial. **No significan que todas estén incluidas en el plan inicial, disponibles en Colombia o probadas en esta investigación.** Las columnas de ajuste y fricción son evaluación del consultor.

| Plataforma | Tipo / foco observado | Capacidades de referencia | Fricción a evaluar | Papel para ED1 | Fuentes |
|---|---|---|---|---|---|
| Shopify | SaaS global | Tienda, inventario, canales, B2B e IA según oferta actual | Proveedores locales, cargos externos, apps y portabilidad | Referente competitivo; utilidades/conectores | S18–S19 |
| Tiendanube/Nuvemshop | SaaS regional | Administración, aplicaciones, precios mayoristas e integraciones | Diferencias por país y plan | Referente directo para pequeño comercio LATAM | S16–S17 |
| Jumpseller | SaaS | Canales sociales, productos digitales, cotizaciones, reservas y suscripciones | Inclusión por plan; costos de pagos y funciones específicas | Referente regional y posible ecosistema de servicios | S21 |
| WooCommerce | WordPress autohospedado | Núcleo abierto, extensiones y elección de procesador | Hosting, plugins, actualizaciones y soporte | Servicios de implementación y complementos | S20 |
| Ecwid by Lightspeed | Comercio incorporable y sitio propio | Starter/Venture/Business/Unlimited; incorporación a sitios | Plan requerido, cambios tarifarios y gateway local | Comparación con incorporar checkout al HTML existente | S22–S23 |
| Wix eCommerce | Constructor integrado | Tienda, administración y múltiples conexiones de pago | País, plan y límites de personalización | Alternativa para comerciante con poca capacidad técnica | S24 |
| BigCommerce | SaaS con opciones de extensión | Planes por escala de ventas y proveedores de pago | Umbrales, subida de plan y tarifa por proveedores abiertos | Referencia de economía de plataforma | S25 |
| VTEX | Plataforma empresarial | Referente de comercio conectado a escala | Contrato e implementación del caso local | Benchmark para capacidades posteriores, no MVP | S15 |
| Adobe Commerce | Comercio empresarial | B2B y experiencias desacopladas; catálogo/precios | Edición, módulos, servicios e implementación | Referencia para B2B y catálogo complejo | S26 |
| Salesforce Commerce Cloud | Suite empresarial | Comercio conectado con el ecosistema Salesforce | Licenciamiento, datos y operación de integraciones | Referente para CRM/comercio integrado | S27 |
| commercetools | Comercio componible | Capacidades de comercio y precios por mercado/canal | Diseño e integración de varios componentes | Arquitectura objetivo si el caso lo justifica | S28 |
| PrestaShop | Autohospedado | Motor de tienda con ecosistema y requisitos PHP/MySQL | Operación, módulos y compatibilidad por versión | Servicios y migraciones | S29–S30 |
| Odoo eCommerce | Comercio vinculado a aplicaciones empresariales | Tienda y conexión con suite operativa | Edición, hosting, módulos y localización fiscal | Integraciones administrativas | S31 |
| Medusa | Backend de comercio | Despliegue de aplicación con PostgreSQL y Redis | Runtime y dependencias operativas | Evaluación posterior de un backend existente | S32 |
| Saleor | API headless | API GraphQL; núcleo publicado con BSD-3-Clause | Despliegue y ecosistema de integración | Referente técnico para API de comercio | S33 |
| Vendure | Headless | TypeScript, Node.js y GraphQL; núcleo GPLv3 | Base de datos, despliegue y términos de licencia/extensiones | Referente técnico y de plugins | S34 |
| Loja Integrada | Plataforma brasileña | Oferta local; cambios de plan gratuito en junio de 2026 | Requisitos brasileños y restricciones del plan | Vigilancia de freemium regional | S35 |
| Tray | Plataforma brasileña | Tienda, pagos/envíos y ecosistema de venta | Plan, intermediario de pago y operación local | Vigilancia de integración vertical | S36 |

No se atribuye a los proyectos abiertos una posición de liderazgo comercial por estrellas de GitHub o actividad del repositorio. Tampoco se homogeneizan Magento Open Source y Adobe Commerce, ni núcleo abierto y servicio cloud gestionado.

### 6.3 Qué significa “líder” en este estudio

Se seleccionan referentes por actividad documentada, amplitud de capacidades y pertinencia, sin fabricar un ranking de participación colombiana.

| Actor | Indicador verificable seleccionado | Qué demuestra | Qué no demuestra |
|---|---|---|---|
| Shopify | Reporte Q2 2026: crecimiento de ingresos de 34 % y presencia declarada de millones de negocios en más de 175 países | Escala y actividad global según la empresa | Participación de tiendas colombianas |
| Mercado Libre | Reporte Q2 2026: GMV cercano a USD 22 mil millones | Escala de su ecosistema regional de comercio | Mercado de plataformas de tienda independiente |
| VTEX | Reporte Q2 2026: GMV de USD 5.700,5 millones | Actividad de comercios atendidos por su plataforma | Ventas propias de VTEX o liderazgo por número de pymes |

Fuentes: [S13–S15]. GMV es valor bruto comercial procesado según la definición de cada entidad; no equivale a ingreso de software. Estos valores no se suman para calcular participación regional.

**[C2] Una lectura adicional de VTEX.** Su reporte anual de 2025 declara un GMV de USD 20.500 millones, ingresos de USD 240,5 millones (USD 234,9 millones de suscripción), unos 2.200 clientes y un ingreso recurrente anual promedio por tienda de USD 144.600. De ahí sale que sus ingresos equivalen a ≈ 1,2 % del GMV (inferencia: 240,5 / 20.500). No es una tarifa: es el promedio de toda su base, con mínimos y contratos distintos. Ilustra dos cosas: el modelo de participación sobre ventas del segmento empresarial (§13.1) y que su cliente típico está muy lejos del público de ED1. [S101]

### 6.4 Análisis competitivo — inferencias

**Sustitutos:** el comercio puede seguir en WhatsApp, contratar una agencia, usar una plataforma o combinar hojas y servicios. Por tanto, el competidor de ED1 no siempre será otra tienda.

**Poder de los proveedores:** gateways, mensajería, canales y servicios fiscales condicionan costos y disponibilidad. La API debe encapsularse mediante adaptadores, pero un adaptador no elimina la dependencia contractual.

**Poder del cliente:** cambiar de tienda puede implicar migrar catálogo, URLs, órdenes e integraciones. Las utilidades que funcionan sin migración permiten probar valor con menor compromiso.

**Entrada de nuevos competidores:** la creación de una vitrina es técnicamente accesible; conseguir confianza, distribución, operación y soporte recurrente exige recursos distintos.

**Rivalidad:** los proveedores documentan funciones amplias y servicios incorporados. La oportunidad ED1 debe apoyarse en una tarea específica mejor resuelta, aprendizaje local y adquisición eficiente, no en una supuesta ausencia general de software.

---

## 7. Precios, gratuidad y costo total

### 7.1 Observaciones de precios al corte

| Proveedor | Oferta observada | Condición relevante | Fuente |
|---|---|---|---|
| Tiendanube Colombia | Básico COP 33.900/mes; Tiendanube COP 74.900/mes; Avanzado COP 249.900/mes | Página local; prueba de 7 días; publica 0 % de costo por transacción de plataforma | S16 |
| Shopify Colombia | Basic USD 25/mes; Grow USD 65/mes; Advanced USD 399/mes | Pago mensual; valores anuales equivalentes: USD 19, 49 y 299/mes | S18 |
| Shopify: pago externo | Basic 2 %; Grow 1 %; Advanced 0,6 % | Evaluar aplicación al método concreto y agregar procesador; no sumar automáticamente a pagos manuales | S18 |
| WooCommerce | Núcleo sin mensualidad y sin reparto de ingresos de plataforma | Hosting, extensiones y procesamiento son partidas separadas | S20 |
| Jumpseller | Publica planes y 0 % de cargo general de transacción | La vista recuperada mezcla selector mensual/anual; no se fija aquí una mensualidad comparable. Suscripciones de productos documentan 0,5 % por pedido | S21 |
| Ecwid | Cuatro planes de pago observados | La documentación actual enumera Starter, Venture, Business y Unlimited. No se presume plan gratuito nuevo | S22–S23 |
| BigCommerce | Core USD 29/mes equivalente con facturación anual | Hasta USD 30.000 de GMV TTM; ascenso de plan según umbral. La tarifa de proveedor abierto es otra partida | S25 |
| Plataformas empresariales/componibles | Presupuesto por alcance y contrato | No se inventan tarifas locales ni costo final de implementación | S26–S28 |

Precios de lista recuperados; no cotizaciones. Impuestos y condiciones comerciales deben verificarse antes de contratar. Una prueba gratuita o descuento temporal no constituye una operación gratuita permanente.

**[C2] Complementos a la tabla de precios.** La columna de fuente dice cuáles son oficiales y cuáles secundarias.

| Proveedor | Oferta observada | Condición relevante | Fuente |
|---|---|---|---|
| Jumpseller | Basic USD 10,80; Plus USD 18,90; Pro USD 37,80; Premium USD 75,60; Advanced USD 225, al mes. 10 % menos con pago anual | Página global en USD, reabierta el 5 oct 2026: resuelve la ambigüedad de S21. 0 % de comisión de plataforma; 0,5 % por pedido en suscripciones de productos | S99 (oficial) |
| Shopify Plus | Desde USD 2.300/mes; 0,2 % con proveedor de pago externo | Misma página S18, reabierta el 5 oct 2026. Basic, Grow y Advanced coinciden con la tabla de arriba | S18 (oficial) |
| Shopify: aplicaciones | USD 50–500 al mes en apps; 6 a 15 apps por tienda | Estimación de una agencia colombiana; no es una medición | S106 (secundaria) |
| Tiendanube Colombia | Los tres precios de S16 se observaron iguales el 30 sep 2026 | Lo que cambia por plan: usuarios (1, 3, ilimitados), exportaciones al mes (1, 4, ilimitadas) y nivel de analítica | S16 (oficial) |
| Wix | Core USD 29; Business USD 39; Business Elite USD 159, al mes con pago anual | No es la página de Colombia | S100 (secundaria) |
| Salesforce Commerce Cloud | ≈ 1–3 % del GMV en B2C; implementación USD 200.000 a más de 2 millones | Estimaciones de una agencia y de un competidor. Salesforce no publica tarifa | S102–S103 (secundarias) |
| Adobe Commerce | Licencia ≈ USD 40.000 a más de 125.000 al año; implementación USD 150.000 a más de 1 millón | Estimación de una agencia; no es cotización | S102 (secundaria) |
| Implementación en Colombia | WooCommerce: COP 3–6 millones (validación), 6–12 (básica), 12–25 (crecimiento), más de 25 (compleja). Otra agencia: USD 300–800 (plantilla), 800–2.500, 2.500–6.000 (a medida), 6.000–15.000 o más | Oferta de dos agencias. Sirve de referencia para los servicios de §11.5; no es un precio de mercado | S104–S105 (secundarias) |

Las tres últimas filas existen para dar orden de magnitud. La tabla original se abstuvo de dar tarifas empresariales, y esa abstención sigue siendo la posición del estudio: ninguna de estas cifras es una cotización.

### 7.2 Hallazgos que cambian la comparación

- **Tiendanube:** la existencia de planes gratuitos en Argentina/México no equivale a un plan gratuito colombiano. [S17]
- **BigCommerce:** la oferta actual diferencia Embedded Payment Providers y Open Payment Providers. Publica tarifas de 2 %, 1 % y 0,6 % para proveedores abiertos según plan de autoservicio. No se utiliza la afirmación universal de que cualquier gateway está libre de cargo de plataforma. [S25]
- **Ecwid:** hay una comunicación específica sobre modificaciones de precios desde el 2 de marzo de 2026. Un blog comparativo anterior puede estar desactualizado. [S23]
- **Jumpseller:** su 0 % general no excluye una comisión específica para la función de suscripciones de productos. [S21]

### 7.3 Modelo de costo total recomendado

Para un comercio:

`Costo mensual total = plataforma + hosting + dominio prorrateado + apps + pago procesado + mensajería + IA + facturación + logística + soporte/operación + publicidad + impuestos aplicables`

Para comparar dos alternativas, mantener el mismo catálogo, número de pedidos, ticket, medios de pago, ubicaciones, mensajes y nivel de soporte. Separar el costo del primer año —migración, diseño y configuración— del gasto recurrente.

**Ejemplo analítico, no cotización:** una comisión hipotética de 3 % + COP 900 representa COP 1.500 en un pedido de COP 20.000, equivalente al 7,5 %. En un pedido de COP 100.000 representa COP 3.900, equivalente al 3,9 %. El cargo fijo pesa más sobre tickets bajos. No se incluyen impuestos, devoluciones ni otros cargos.

Para ED1, “infraestructura a costo cero” y “procesamiento de pago a costo cero” son condiciones diferentes. También deben presupuestarse minutos de atención y mantenimiento, aunque el propietario no los pague en efectivo al inicio.

### 7.4 Escenarios ilustrativos de costo total del comercio **[C10]**

Aplicación del modelo de §7.3 a tres tamaños de comercio, con tarifas públicas observadas. **No son cotizaciones ni una medición de costos reales.**

Supuestos comunes: cobro con la tarifa de Bold para PSE y billeteras (2,89 % + COP 900, antes del IVA de la comisión; S39); facturación con Alegra según el tope de ingresos de cada plan (S117); USD convertidos a COP 3.306,86, TRM del 26 al 28 de septiembre de 2026 (S98). No incluyen fletes, publicidad, aplicaciones, implementación, impuestos ni horas de operación.

| Escenario | Pedidos/mes × ticket | Ventas del mes | Cobro | Tienda sin comisión | Tienda con comisión por proveedor externo |
|---|---|---:|---:|---|---|
| A · Inicial | 50 × COP 120.000 | COP 6 M | COP 218.400 (3,64 %) | Tiendanube Básico COP 33.900 + Alegra COP 17.900. **Total COP 270.200 (4,50 %)** | Shopify Basic USD 25 (COP 82.672) + 2 % (COP 120.000) + Alegra. **Total COP 438.972 (7,32 %)** |
| B · Frecuente | 500 × COP 150.000 | COP 75 M | COP 2.617.500 (3,49 %) | Tiendanube COP 74.900 + Alegra Pro COP 99.900 + email y WhatsApp COP 498.674. **Total COP 3.290.974 (4,39 %)** | Shopify Grow USD 65 (COP 214.946) + 1 % (COP 750.000) + lo mismo. **Total COP 4.181.020 (5,57 %)** |
| C · En crecimiento | 2.500 × COP 180.000 | COP 450 M | COP 15.255.000 (3,39 %) | Tiendanube Avanzado COP 249.900 + Alegra Plus COP 179.900 + email y WhatsApp COP 1.330.680. **Total COP 17.015.480 (3,78 %)** | Shopify Advanced USD 399 (COP 1.319.437) + 0,6 % (COP 2.700.000) + lo mismo. **Total COP 20.785.018 (4,62 %)** |

Email y WhatsApp, en B: Klaviyo para 5.000 perfiles (USD 100; S114, secundaria) más 4.000 mensajes de marketing y 1.000 de utilidad (USD 50,80; §11.1). En C: 10.000 perfiles (USD 150) más 20.000 mensajes de marketing y 3.000 de utilidad (USD 252,40). Fuentes: [S16, S18, S39, S98, S114, S117].

Lo que la aritmética muestra (inferencia):

- **El cobro es el costo dominante.** Con una plataforma sin comisión, explica el 81 %, el 80 % y el 90 % del total en A, B y C. Una décima de punto en la tarifa de cobro mueve más que un cambio de plan de la tienda.
- **La comisión por proveedor externo pesa más que la mensualidad.** En el escenario A, el 2 % de Shopify Basic son COP 120.000, frente a COP 82.672 de la suscripción. La brecha frente a una plataforma sin comisión es de 2,8 puntos en A, 1,2 en B y 0,8 en C.
- **El costo fijo de la tienda casi no pesa.** La suscripción de la plataforma sin comisión es el 0,6 %, el 0,1 % y el 0,06 % de las ventas en A, B y C.
- **Con más volumen se negocia.** Los escenarios usan tarifa pública. Un comercio del tamaño de C negocia el cobro o pasa a un modelo gateway (§10.2); eso no se modela.

Para ED1 esto afina dos cosas. La calculadora de rentabilidad (herramienta 1) responde la pregunta de mayor peso económico para el comerciante. Y una tienda alojada no gana por ser más barata que otra tienda: la diferencia entre mensualidades es pequeña frente al cobro y a la entrega (§11.3).

---

## 8. Estado del arte funcional

Las siguientes matrices son una **síntesis de requisitos y diseño** a partir del panorama revisado, no una lista de funciones incluidas por todos los proveedores.

### 8.1 Capacidades básicas de una tienda operable

| Dominio | Capacidad mínima | Criterio de aceptación propuesto | Prioridad ED1 | En el ecosistema hoy **[V9]** |
|---|---|---|---|---|
| Catálogo | Producto, precio, SKU interno, imágenes, categorías | El comerciante publica y corrige sin editar código | Alta si se valida catálogo | Tienda 2.0: catálogo en la hoja, con su contrato de columnas. El cuaderno de CultivoPro ya exporta con esas columnas (S80, S81) |
| Variantes | Talla/color u otras opciones con SKU y stock | El pedido conserva variante y precio correctos | Alta para productos físicos | Tienda 2.0: combinaciones con su precio (S80, S81) |
| Experiencia | Móvil, navegación y búsqueda proporcional al catálogo | El cliente encuentra y entiende el producto | Alta | Tienda 2.0: página horneada (S81) |
| Carrito | Cantidades, subtotal y desglose | El total se recalcula con reglas de servidor al cobrar | Alta en fase transaccional | Tienda 2.0: el backend valida, registra y cobra (S81) |
| Pedido | Identificador, cliente, ítems, totales y estados | Se puede reconstruir qué se compró y qué falta | Alta | Tienda 2.0: estados del pedido en su contrato (S81) |
| Cobro | Medio local y estado verificable | No se marca pagado por una captura o un retorno del navegador | Alta | Bold con verificación por API, en la Tienda 2.0 y en CultivoPro, que suma adaptador y conciliación cada 15 min (S81, S85) |
| Entrega | Dirección, retiro/entrega, costo y seguimiento | El cliente conoce costo y condiciones antes de confirmar | Alta | Tienda 2.0: envíos, y rastreo con un secreto aparte (S81) |
| Inventario | Existencia y cambios por operación | Se previenen o identifican sobreventas | Según frecuencia de pedidos | Tienda 2.0: aparta las unidades antes de cobrar (S81) |
| Administración | Acceso, roles básicos y auditoría | Cada comercio ve solo sus datos | Alta al ofrecer SaaS | CORE: roles, y aislamiento por `org_id` con una prueba; sus valores todavía son del agro (S82, S85) |
| Posventa | Contacto, novedades, devoluciones y reembolsos | Hay proceso y registro, no solo una página de compra | Alta | No confirmado en el repositorio |
| Datos | Exportación de catálogo, clientes y pedidos | Se obtiene una copia utilizable sin intervención del desarrollador | Alta | CultivoPro: exportación portable (`agro-export v1`). La Tienda 2.0 conserva la hoja del comercio (S81, S82) |
| SEO | URLs, metadatos, sitemap y contenido de producto | Datos visibles y estructurados consistentes | Alta | Tienda 2.0: HTML horneado por tienda. La 3.0 tiene que hornear el HTML de cada ficha (§12.3) |
| Seguridad | TLS, secretos, validación y respaldo | No hay credenciales privadas en el frontend | Alta | CSP por ruta, secretos por ambiente de GitHub y revisión de seguridad del 3 oct 2026 (S82). El respaldo semanal está pendiente (S83) |
| Analítica | Eventos y resultado comercial | Pedido enviado, pago aprobado y entrega se distinguen | Alta | Analytics Engine y reporte semanal en CultivoPro; la Tienda tiene su propio contrato de eventos (S81) |

**[C3] Tres capacidades básicas del contexto colombiano que la tabla no nombra.** Salen del informe complementario; su prioridad se confirma en entrevistas (§16.2).

| Dominio | Capacidad mínima | Criterio de aceptación propuesto | Prioridad ED1 | En el ecosistema hoy |
|---|---|---|---|---|
| Contraentrega | Ofrecer el pago al recibir y registrar su recaudo | El pedido distingue «por recaudar», «recaudado» y «devuelto»; el costo del recaudo entra en el margen (§11.3) | Alta donde el comercio ya la usa; a confirmar | No confirmado en el repositorio |
| Canal conversacional | Botón de WhatsApp y link de pago con el pedido identificado | Un pedido enviado al chat no figura como pagado (§11.1) | Alta | Tienda 2.0: pedido por WhatsApp y cobro con Bold (S81; S131) |
| Medición de marketing | GA4, píxel de Meta y catálogo para Meta y Google, con consentimiento | Los eventos de marketing se reconcilian con los pedidos (§12.4) | Media | Tienda 2.0: una sola función de medición con GA4 y píxel de Meta, según la arquitectura 0.22.3–0.25 (S131); verificar en la 1.0.0 |

### 8.2 Capacidades avanzadas y su justificación

| Capacidad | Problema que resuelve | Cuándo merece inversión | Complejidad/costo a medir |
|---|---|---|---|
| Promociones y cupones | Aplicar descuentos coherentes | Campañas reales con reglas repetidas | Interacción con impuestos, devoluciones y otras promociones |
| Recuperación de carrito | Retomar una intención no completada | Contactos autorizados y embudo medido | Mensajería, privacidad y atribución |
| Reseñas verificadas | Aportar confianza al producto | Volumen suficiente para moderación | Moderación y vínculo con una compra |
| B2B y cotización | Precios por cliente, volumen y aprobación | Pedidos empresariales comprobados | Roles, catálogo privado y condiciones comerciales |
| Suscripciones | Recompra o cobro periódico | Demanda de recurrencia verificable | Mandatos, pagos fallidos, cancelación y reposición |
| Omnicanalidad/POS | Coherencia entre local, tienda y canales | Se venden los mismos SKUs por varias vías | Stock, reservas y conciliación |
| PIM | Calidad de catálogo para muchos canales | Datos/atributos complejos y varias fuentes | Normalización, imágenes y gobernanza |
| OMS | Orquestar pedidos y excepciones | Varios almacenes/canales y reglas de entrega | División, devoluciones y estados distribuidos |
| WMS/fulfillment | Operar almacenamiento y despacho | Volumen que lo justifique | Ubicaciones, picking, empaque y SLA |
| Búsqueda avanzada | Encontrar productos con filtros o errores | Catálogo que supera navegación simple | Indexación, latencia y servicio externo |
| Personalización | Adaptar experiencia con datos | Señal suficiente y mejora comprobable | Privacidad, sesgo y costo de servir modelos |
| Internacionalización | Idioma, precio, cobro y cumplimiento por mercado | Ventas reales en el país destino | Moneda de presentación frente a liquidación; aduanas |
| Comercio de agentes | Descubrir, crear carrito y comprar desde IA | Elegibilidad, calidad de datos y tráfico | Protocolos, autorización, costos y errores |
| Antifraude | Gestionar riesgo comercial | Exposición medible por canal | Falsos rechazos, disputas y costo operativo |

**Implicación:** ED1 puede ofrecer utilidades para preparar datos de estas funciones mucho antes de operar todos sus motores: normalizar CSV, calcular rentabilidad, validar feeds, comprimir imágenes o contrastar información de un pedido.

### 8.3 Productos distintos requieren motores distintos

| Tipo de venta | Requisitos adicionales |
|---|---|
| Bienes físicos | Variantes, stock, transporte, devoluciones y costos de entrega |
| Productos digitales | Entrega protegida, límites de descarga, derechos de uso y soporte |
| Servicios/reservas | Disponibilidad, confirmación, cambios y cancelación |
| B2B por cotización | Versiones de oferta, vigencia, condiciones y aprobación |
| Suscripciones | Consentimiento de recurrencia, cobro fallido y suspensión/cancelación |
| Marketplace | Alta de vendedores, responsabilidades, liquidaciones y disputas |

No conviene tratar estas diferencias como simples tipos de producto en una plantilla si requieren estados y obligaciones operativas distintas.

### 8.4 Cómo empaqueta y cobra el mercado lo básico y lo premium **[C3]**

Las secciones 8.1 y 8.2 dicen qué es básico y qué es avanzado. Falta cómo se reparte entre planes y cómo se cobra, que es lo que un comerciante compara. Oferta observada en páginas oficiales, salvo donde se indica.

| Perspectiva | Suele estar en el plan de entrada | Suele reservarse a planes altos, apps o contrato | Cómo se cobra lo premium | Evidencia |
|---|---|---|---|---|
| Catálogo y administración | Productos ilimitados, plantillas, certificado SSL | Usuarios adicionales, exportaciones, varias bodegas, listas de precios, idiomas | Subida de plan | Tiendanube: usuarios 1, 3 o ilimitados; exportaciones 1, 4 o ilimitadas [S16]. Jumpseller: 4 bodegas en Premium; 10 bodegas y listas de precios en Advanced [S99] |
| Conversión | Carrito | Promociones, carrito abandonado, reseñas y cuenta de cliente (Jumpseller, desde Pro); venta cruzada (Advanced) | Subida de plan o aplicación | [S99]. En Tiendanube, promociones y recuperación de carrito figuran en todos los planes [S16] |
| Pagos | Integración con pasarelas locales | Menor comisión por proveedor externo | Porcentaje que baja al subir de plan | Shopify 2 % · 1 % · 0,6 % · 0,2 % [S18]; BigCommerce [S25] |
| Marketing | SEO, GA4, cupones | Automatización por email, SMS o WhatsApp | Por contactos o por mensaje, fuera de la plataforma | §11.1, §11.6 |
| Logística | Tarifas de envío configurables | Cotización con transportadora, guías, fulfillment | Por guía o por pedido, con el operador | §11.3 |
| Facturación | No incluida: aplicación o sistema externo | Factura electrónica integrada | Suscripción del facturador, por ingresos o documentos | §11.2 |
| Soporte | Chat y correo | Prioridad alta | Plan superior | Jumpseller: prioridad alta en Advanced [S99] |
| B2B, multitienda, headless | No incluido | Plan superior o empresarial | Contrato; participación sobre ventas en el segmento empresarial | §6.3, §7.1 |

Lectura (inferencia):

1. **No hay un estándar de qué es básico.** La misma función cambia de plan según el proveedor: recuperar el carrito está en todos los planes de Tiendanube y desde el tercer plan en Jumpseller. Copiar la lista de un competidor no dice qué espera el comerciante.
2. **Lo que más cuesta a un comercio pequeño se cobra fuera de la plataforma:** cobro, entrega, mensajes y factura (§7.4). La plataforma vende sobre todo administración y límites.
3. **Para ED1, la pregunta de empaquetado es qué límite empuja al siguiente plan.** Los que usa el mercado son usuarios, exportaciones, bodegas y soporte. Los candidatos propios están en §13.6 y son hipótesis.

---

## 9. Estado del arte tecnológico y compatibilidad con ED1

### 9.1 Arquitecturas

| Arquitectura | Descripción | Encaje con costo cero de validación | Evaluación |
|---|---|---|---|
| Sitio estático + pedido por WhatsApp | Catálogo servido como archivos; conversación completa el flujo | Alto para publicar; operación humana fuera del sitio | Probar valor y medir trabajo manual |
| Sitio estático + checkout alojado | Catálogo público y cobro gestionado por proveedor | Infraestructura pequeña; procesamiento con tarifa propia | Candidato cuando se contrate un proveedor |
| Aplicación serverless transaccional | API de pedidos, estado y datos persistentes | Condicionado a cuotas y carga | Evolución razonable tras validar necesidad |
| WordPress/WooCommerce o PrestaShop | Runtime y base tradicionales con extensiones | No equivale a servir solo HTML en Cloudflare | Útil en servicios, cotizando hosting/mantenimiento |
| Backend headless autohospedado | Motor API y storefront propio | Depende de runtime, base, colas y operación | No asumir que el motor corre sin cambios en Workers/D1 |
| SaaS headless/componible | Motor gestionado y experiencia desacoplada | Costos contractuales más integración | Considerar con necesidad y presupuesto demostrados |

**Evidencia de dependencias:** Medusa documenta PostgreSQL y Redis en su despliegue; PrestaShop especifica PHP y MySQL; Vendure se documenta sobre Node.js y Saleor ofrece una API GraphQL con un núcleo Python. La compatibilidad con Workers/D1 exige un análisis específico, no se deduce de “JavaScript”, “API” o “open source”. [S29, S32–S34]

### 9.2 Tecnologías y decisiones prácticas

| Componente | Alternativa de validación propuesta | Condición para cambiar |
|---|---|---|
| Páginas públicas | HTML/CSS/JS o generación estática; datos públicos cacheables | Necesidad comprobada de experiencia dinámica |
| Interfaz administrativa | Componentes simples y controles consistentes | Complejidad real de edición y permisos |
| Datos operativos | Esquema pequeño con aislamiento por comercio | Límites, consulta y concurrencia medidas |
| Archivos | Imágenes optimizadas; carga con límites y validación | Mayor volumen o formatos que requieran servidor |
| Importación | CSV con vista previa y errores por fila | Clientes con conectores/API recurrentes |
| Eventos | Webhooks autenticados, deduplicación y reintentos | Carga que exija colas durables |
| Búsqueda | Filtrado local de catálogo pequeño | Latencia/calidad insuficiente con datos reales |
| PWA | Evaluar si el comerciante necesita uso repetido/offline | Evidencia de dispositivo y conectividad |
| IA | Funciones optativas con presupuesto o credencial del cliente | Beneficio medido superior al costo |

No se recomienda seleccionar una librería concreta sin comprobar versión, licencia, mantenimiento y compatibilidad. El estudio de mercado no reemplaza esa evaluación de implementación.

### 9.3 Lo que necesariamente pertenece al servidor

En una tienda que cobra de forma automática: validar precios y descuentos; generar una orden canónica; custodiar credenciales privadas; verificar y deduplicar eventos; controlar permisos; registrar estados y reconciliar excepciones. La aritmética visible del carrito no constituye autorización de cobro.

El navegador puede calcular una vista previa, preparar archivos o decodificar un QR; la autoridad sobre una operación monetaria debe venir del sistema responsable del precio/pedido y del proveedor responsable del estado del pago.

### 9.4 Infraestructura y cuotas

Cloudflare documenta solicitudes gratuitas e ilimitadas para assets estáticos y distingue la ejecución del script Worker. D1 Free publica 5 millones de filas leídas al día, 100.000 escritas y 5 GB de almacenamiento incluido **por cuenta**. **[V3]** El límite de diseño es 500 MB por base, con 10 bases por cuenta [S86]. Workers Free publica 100.000 solicitudes al día; las condiciones se deben comprobar antes de cada expansión. [S67–S69]

**[V3] Cuatro restricciones que ya muerden en la cuenta del ecosistema** (dato interno):

- **Un índice también es una fila escrita.** D1 cuenta cada entrada de índice como fila escrita. Un pedido que entra a una tabla con dos índices son 3 filas, así que las 100.000 escrituras diarias son unas 33.000 inserciones de ese tipo. Además, una invocación del Worker gratuito admite 50 consultas a D1. [S87]
- **Las cuotas son de la cuenta, y ya tienen dueño.** La cuenta atiende a CultivoPro, que declaró hasta el 25 % de las solicitudes al Worker y el 21 % de las filas escritas. Un producto de ecommerce en la misma cuenta declara su parte y su kill switch (S01 §25.1). [S82]
- **No se abre otra cuenta gratuita para ganar cuota.** Lo prohíben los términos de Cloudflare, §2.2.1(c). Escalar es pasar a Workers Paid, USD 5 al mes. [S82, S87]
- **Queda un solo Cron Trigger libre.** El plan gratuito da 5 por cuenta (S01 §41), y ya hay 4: el CORE y la API de la celda de CultivoPro, cada uno en producción y en staging. Una tienda que concilie pagos o libere por tiempo las unidades apartadas necesita un cron: comparte el despachador (S01 §7.1) o pasa a Workers Paid. [S85]

**Propuesta ED1:** estimar llamadas, filas leídas/escritas, almacenamiento y mensajes por comercio activo; mantener límites por producto y comercio, alertas, exportación y un modo de degradación explícito. Un escaneo sin índice o un webhook repetido puede consumir más presupuesto que la interfaz pública. **[V3]** El vigía horario de cuota y sus niveles de degradación ya existen y se reutilizan. Pasar a Workers Paid les cambia la vara: deja de haber tope diario y lo que hay que vigilar es el gasto del mes. [S82]

GitHub Actions sirve para construcción, pruebas y despliegue del software. Sus términos identifican como uso indebido, entre otros, su utilización como CDN o parte de una aplicación serverless con carga desproporcionada. No debe convertirse en el procesador de pedidos o archivos de clientes para eludir costos de ejecución. [S70]

**[C12] Tres límites oficiales más, que tocan a la 2.0 y a la 3.0** (documentación de Cloudflare, consultada el 30 sep 2026):

- **Workers por cuenta: 100 en el plan gratuito y 500 en el pago.** La Tienda 2.0 usa un Worker por tienda (S80). La cuenta ya tiene los de CultivoPro, así que el techo real de tiendas 2.0 es menor que 100. La 3.0, con cada tienda como una fila (S81), lo elimina. [S128]
- **Dominios propios: Cloudflare for SaaS incluye 100 hostnames personalizados** y cobra USD 0,10 al mes por cada uno adicional, hasta 50.000, en los planes Free, Pro y Business. Es el costo publicado de los «dominios propios» que le faltan a la tienda alojada (§3.3). [S130]
- **Qué desbloquea Workers Paid, además de quitar el tope diario:** D1 pasa de 10 bases de 500 MB a 50.000 bases de 10 GB; las consultas por invocación, de 50 a 1.000; la CPU por solicitud, de 10 ms a 30 s; los Cron Triggers, de 5 a 250. Confirma con fuente oficial lo que **[V3]** tomó de la bitácora. [S128–S129]

**[C12] Un dato interno relacionado con el párrafo anterior.** Según la arquitectura de la Tienda Panel en su versión 0.22.3, el montaje de cada tienda baja y convierte las fotos del comercio y hornea su catálogo dentro de GitHub Actions, en repositorios privados cuyos minutos salen de una cuota compartida. Es el uso que el párrafo anterior pide evitar, y crece en línea recta con el número de tiendas. Hay que verificar si la 1.0.0 lo mantiene; si es así, es otro argumento medible a favor de la 3.0 (§15.3). [S131]

### 9.5 Licencias, portabilidad y dependencia

- Distinguir el núcleo, plugins, temas, servicios cloud y marcas: cada uno puede tener condiciones diferentes.
- Saleor publica BSD-3-Clause. Vendure publica GPLv3 y explica excepciones de plugins y separación de consumidores de su API. PrestaShop dispone de una guía de compatibilidad de licencias. Esto no autoriza a atribuir una licencia única a todo el stack. [S30, S33–S34]
- Mantener un modelo exportable de producto, variante, cliente, pedido y evento de pago. **[V11]** En el ecosistema, «producto» ya nombra el contrato de una herramienta o un SaaS (`product.yaml`, `schemas/product.schema.json`). El producto de un comercio necesita otro nombre en el código y en los esquemas de la tienda: una palabra, un significado (patrón P2 de las bitácoras del ecosistema, «una sola fuente»).
- Preservar URLs o redirecciones al migrar; medir pérdida de integraciones y de configuración.
- Evitar que el formato del proveedor sea el único registro del negocio. Un archivo exportado sin relaciones ni estados puede ser insuficiente para continuar operando.

---

## 10. Pagos, QR y servicios financieros

### 10.1 Opciones documentadas para Colombia

| Proveedor / vía | Evidencia recuperada | Utilidad potencial | Condición pendiente para elegir | Fuentes |
|---|---|---|---|---|
| Wompi | Eventos de cambios de transacción y mecanismo de validación de integridad | Checkout y automatización de estados | Contratación, tarifa, medios y pruebas | S37 |
| Bold | Webhooks y consulta de transacciones; tarifas diferenciadas | Links/botón y conciliación | Producto contratado, demora y condiciones | S38–S39, S79 |
| Mercado Pago | Checkout y notificaciones webhook | Pago alojado/integrado y medios locales | Disponibilidad por integración, costo y liquidación | S40–S41 |
| PayU | API Colombia que documenta integración PSE | Cobro local y conexión regional | Contrato, tarifa y método efectivamente habilitado | S42 |
| ePayco | APIs, plugins, SDK, checkout y servicios de pagos divididos | Checkout; evaluar casos de varios participantes | Habilitación y alcance comercial específico | S44 |
| PayPal | Tabla de comisiones comerciales para cuenta colombiana | Evaluar venta internacional | Moneda, recepción, retiro, conversión y cargos | S43 |
| Nequi API QR | Monto/detalles, QR de una transacción y consulta de estado | Caso de QR dinámico para ecommerce | Contrato, certificación, pruebas y tarifa no confirmada | S45 |
| Banco/entidad con Bre-B | QR como forma de iniciar pago o transferencia | Cobro desde cuenta según servicio de la entidad | API, identificación del pedido, acceso y costo | S46 |

No se presenta una equivalencia funcional ni tarifaria entre PSE, transferencia por llave, QR Nequi y QR Bre-B. Son flujos que deben evaluarse por proveedor y producto.

### 10.2 Tarifas visibles que ilustran las diferencias

| Oferta | Tarifa pública observada | Alcance de la observación |
|---|---|---|
| Bold: Visa/Mastercard online | 2,99 % + COP 900 | Categoría publicada en su tarifario; condiciones por comercio |
| Bold: PSE/Bancolombia/billeteras online | 2,89 % + COP 900 | No se extrapola a cualquier transferencia bancaria |
| Bold: QR Online | 2,89 % | Diferente de QR Estándar, que el tarifario presenta a 0 % |
| Mercado Pago: checkout y disponibilidad inmediata | 3,29 % + COP 800 | La página también diferencia plazos de disponibilidad |

Fuentes: [S39, S41]. Estas observaciones no prueban costo total libre de impuestos o condiciones adicionales. No se sustituyen los tarifarios actuales por publicaciones educativas antiguas ni se aplica un precio de datáfono a un botón online.

**[C4] Más tarifas observadas.** Completan la tabla anterior; todas son antes de IVA sobre la comisión.

| Oferta | Tarifa pública observada | Alcance de la observación | Fuente |
|---|---|---|---|
| ePayco, agregador, con cuenta Davivienda | 2,64 % + COP 690 | Retiro: COP 6.500 + IVA. Disponibilidad en 24–72 h. Sin mensualidad | S107 (oficial) |
| ePayco, agregador, otros bancos | 3,29 % + COP 700 | PSE por menos de COP 60.000: COP 2.000 + IVA | S107 (oficial) |
| ePayco, modelo gateway | Instalación COP 490.000 con IVA; desde COP 101 por transacción | Exige código único de comercio; activación en 20–30 días. La tarifa del adquirente es otra partida | S107 (oficial) |
| Mercado Pago: checkout, dinero a 7 días | 2,99 % + COP 800 | Misma página que S41 | S41 (oficial) |
| Mercado Pago: checkout, dinero a 14 días | 2,79 % + COP 800 | Misma página que S41 | S41 (oficial) |
| Bold online, depósito inmediato | 3,59 % + COP 900 | Tarifario S39, reabierto el 30 sep 2026. Los valores de la tabla anterior se observaron iguales | S39 (oficial) |
| Wompi, agregador | 2,65 % + COP 700 | La página oficial no abrió. Dato de la calculadora de un tercero; un comparador de 2026 da 2,65–2,99 % | S108, S133 (secundarias) |
| PayU, en transición a Rapyd | 3,29 % + COP 300 | Blog de Tiendanube, julio de 2026. Tres retiros gratis al mes y luego COP 6.500 + IVA; 3–7 días hábiles | S109 (secundaria) |

El mismo cobro, en dos tickets (inferencia, antes de IVA):

| Oferta | Pedido de COP 20.000 | Pedido de COP 150.000 |
|---|---:|---:|
| PayU / Rapyd | COP 958 (4,8 %) | COP 5.235 (3,5 %) |
| ePayco con Davivienda | COP 1.218 (6,1 %) | COP 4.650 (3,1 %) |
| Wompi | COP 1.230 (6,2 %) | COP 4.675 (3,1 %) |
| Mercado Pago a 14 días | COP 1.358 (6,8 %) | COP 4.985 (3,3 %) |
| Mercado Pago a 7 días | COP 1.398 (7,0 %) | COP 5.285 (3,5 %) |
| Bold, PSE y billeteras | COP 1.478 (7,4 %) | COP 5.235 (3,5 %) |
| Bold, tarjeta | COP 1.498 (7,5 %) | COP 5.385 (3,6 %) |
| Mercado Pago inmediato | COP 1.458 (7,3 %) | COP 5.735 (3,8 %) |
| Bold, depósito inmediato | COP 1.618 (8,1 %) | COP 6.285 (4,2 %) |

Tres lecturas que la tabla original no permitía:

- **El orden cambia con el ticket.** La oferta con el cargo fijo más bajo es la más barata en el pedido pequeño, aunque su porcentaje esté entre los más altos, y queda a media tabla en el grande. No hay una pasarela más barata sin decir para qué ticket.
- **El plazo es un precio.** Recibir el dinero de inmediato cuesta 0,5 puntos más que a 14 días en Mercado Pago y 0,6 puntos más que al día siguiente en Bold.
- **Hay costos fuera de la comisión:** retiro a cuenta, IVA sobre la comisión y retenciones. ePayco publica, por ejemplo, una retención del 15 % del IVA en tarjeta de crédito. Afectan el flujo de caja más que el margen, y se comprueban con el contador.

La herramienta 1 debería pedir el ticket antes de comparar y mostrar el plazo como una opción con precio (§15.2).

### 10.3 Tres garantías diferentes sobre QR

| Nivel | Qué puede comprobar | Qué evidencia requiere | Qué queda fuera |
|---|---|---|---|
| Lectura y validación de formato | Que el contenido se decodifica y corresponde al esquema soportado | Decodificador, especificación y casos de prueba | Identidad legítima del beneficiario y recepción de dinero |
| Comparación con datos esperados | Si monto/identificadores coinciden con un pedido o referencia confiable | Pedido canónico o referencia obtenida de canal confiable | Confirmación de abono |
| Confirmación de pago | Que el proveedor reporta estado final y datos consistentes | API/evento autenticado y conciliación | Garantía absoluta frente a disputas o reversión posterior |

EMVCo publica especificaciones para QR de pago y herramientas de autoevaluación de cumplimiento. La validación estructural no es prueba bancaria de autenticidad ni de pago recibido. Un control de errores como un CRC, cuando existe en el esquema, no debe venderse como firma digital: puede volver a calcularse sobre un contenido modificado. [S47; conclusión técnica sobre alcance de validación]

**Propuesta de posicionamiento para ED1:** indicar exactamente “contenido leído”, “formato soportado”, “monto coincide/no coincide con la referencia” o “estado confirmado por proveedor”. Evitar la etiqueta “transferencia verificada” si solo se ha procesado una fotografía o el texto de un QR.

**[V11]** Este estudio no valida ningún QR concreto ni una integración bancaria en operación: describe qué puede comprobar cada nivel y qué queda fuera.

### 10.4 Flujo técnico recomendado — propuesta

1. El servidor recalcula precio, envío y total; crea una orden con referencia única.
2. Un adaptador solicita el cobro al proveedor contratado, con la moneda y el importe esperados.
3. El cliente abre el checkout o QR emitido mediante el canal soportado.
4. El backend recibe un evento validado o consulta el estado por API.
5. Se comprueban referencia, comercio, importe, moneda y estado; se deduplica el evento.
6. Se actualiza el pedido y se gestionan pendientes, expirados, duplicados, devoluciones y discrepancias.

La API QR Nequi documenta consulta de estado; no se le atribuye un webhook específico no comprobado. La documentación de Bold advierte que ciertas notificaciones pueden demorarse hasta diez minutos. La interfaz debe contemplar el estado pendiente, no depender del retorno inmediato al navegador. [S38, S45, S79]

**[V4] En el ecosistema, este flujo ya corre** (dato interno):

- CultivoPro cobra su plan con Bold así. El monto sale del servidor, la firma se calcula en el CORE, la verdad se le pregunta a la API de Bold, un estado «revisar» recoge el monto que no coincide y una conciliación cada 15 min activa a quien pagó y no volvió. [S83, S85]
- La Tienda 2.0 también cobra con Bold. [S80, S81]
- El proveedor que ED1 pide elegir antes de monetizar (S01 §5.3) ya está elegido, y el adaptador permite cambiarlo.
- A una tienda alojada le falta una sola cosa: que el adaptador use las llaves de **cada comercio**, cifradas, en vez de las del ecosistema, porque en una tienda el vendedor es el comercio (§3.2; S81 §4.3).
- Vender los planes de ED1 fuera de Colombia es otro asunto: ED1 contempla un *Merchant of Record* internacional para los impuestos de otros países (S01 §5.3), y este estudio no lo evaluó.

### 10.5 Expansión regional y financiación

| Mercado / servicio | Evidencia revisada | Implicación |
|---|---|---|
| Brasil | Banco Central describe Pix Automático para pagos recurrentes | Recurrencia debe analizarse con mandatos y proveedor local; no es solo generar un QR |
| Perú | Yape Empresa publica un cobro por servicio de recaudación | No asumir que toda recepción comercial es gratuita |
| Chile | Se identificó documentación de Transbank/Webpay; acceso técnico parcial | Completar comprobación comercial/técnica antes de seleccionar |
| Colombia: financiación | Addi tiene oferta para comercios aliados | Evaluar integración y términos del comercio; no asumir aumento de conversión por testimonios |
| Proveedor global: Stripe | Colombia no aparece en la lista de disponibilidad estándar de Payments recuperada | No planificar una cuenta colombiana como si el alta directa estuviera confirmada |

Fuentes: [S48, S58–S61]. En México no se completó una revisión primaria suficiente del proveedor y la vía de pago para recomendar una integración específica. Su selección permanece pendiente.

Los programas de financiación y las formas de pago recurrente introducen contratos, condiciones y gestión de excepciones. ED1 puede integrar un proveedor; convertirse en prestamista, custodio de fondos o agregador con liquidaciones sería un modelo empresarial adicional que este informe no valida.

**[C4] Dos actualizaciones de proveedores** (fuentes secundarias; confirmar antes de contratar):

- **PayU pasó a Rapyd.** La compra del negocio de pagos de PayU en Latinoamérica y África se cerró en marzo de 2025 por USD 610 millones, con una migración de marca prevista en unos 24 meses. La documentación de S42 sigue en pie, pero conviene revisar contrato, marca y hoja de ruta de la integración antes de elegirla. [S109]
- **Addi, condiciones para el comercio.** Financia compras de COP 50.000 a 10.000.000 en hasta 24 cuotas; el comercio recibe el dinero a 7, 30 o 60 días según el plan; la comisión varía por volumen, sector y campañas y no se publica; declara más de 3 millones de usuarios y más de 35.000 comercios. Exige que el comercio sea persona jurídica, lo que deja por fuera a una parte del público de ED1. [S110]

---

## 11. Integraciones, servicios y operación comercial

### 11.1 WhatsApp: tres capas distintas

| Capa | Alcance | Costo/condición que debe distinguirse |
|---|---|---|
| Enlace para abrir conversación | Llevar al cliente a un chat con mensaje preparado | No aporta automáticamente confirmación de pedido, inventario o pago |
| Aplicación WhatsApp Business | Catálogo y herramientas del negocio | Operación desde la aplicación; no equivale a una integración backend |
| WhatsApp Business Platform | Mensajería programática y automatización | Cobro por mensajes entregados según mercado/categoría; reglas y excepciones |

La documentación oficial describe catálogo en la app y un modelo por mensaje para Platform, con mensajes de servicio y ciertos mensajes de utilidad en respuesta al usuario sin cargo de Meta. Puede existir además costo del proveedor intermediario. No se recuperó una tarifa única aplicable a cualquier automatización colombiana. [S49–S50]

**[V7] Tarifas en Colombia** (fuente secundaria que cita la tabla de Meta; confirmar en S49 antes de contratar):

- Por plantilla entregada: marketing, USD 0,0125; utilidad, USD 0,0008; autenticación, USD 0,0008.
- Las de utilidad no se cobran dentro de la ventana de 24 h de atención. [S88]
- Con esas tarifas, avisar el estado de 300 pedidos al mes, con tres mensajes de utilidad cada uno, cuesta unos USD 0,72 al mes (inferencia).
- El costo del canal no es la barrera. Lo son la verificación del negocio, las plantillas aprobadas, el consentimiento del comprador y la cuota del intermediario.

**Propuesta ED1:** empezar con mensajes preparados y estados de pedido propios. Adoptar Platform cuando se demuestre ahorro de atención y la contribución por pedido soporte su costo. Diferenciar el costo del canal de una función de IA que atienda esos mensajes.

**[C5] Fuente primaria, corroboración y una alerta descartada.**

- **La documentación para desarrolladores de Meta, leída el 5 de octubre de 2026, confirma cuatro reglas.** Se cobra por mensaje de plantilla entregado desde el 1 de julio de 2025. Los mensajes que no son plantilla son gratis dentro de la ventana de atención abierta. Las plantillas de utilidad son gratis dentro de esa ventana. Y hay una ventana de 72 horas sin cargo para todo tipo de mensaje cuando el usuario llega por un anuncio de clic a WhatsApp o por el botón de una página. Las tarifas por país están en tablas descargables que no se abrieron. [S111]
- **Dos fuentes secundarias más coinciden con [V7] para Colombia:** marketing a USD 0,0125 (S112, de la que solo se vio el título del resultado) y utilidad y autenticación a USD 0,0008 (S113).
- **No confirmado, y por eso no se usa:** S113 afirma que desde el 1 de octubre de 2026 solo los primeros 1.000 mensajes de servicio al mes por número serían gratis. La documentación oficial, leída cuatro días después de esa fecha, no recoge el cambio. Queda en el radar (§17.1).
- **Implicación (inferencia):** la ventana de 72 horas hace barato el flujo «anuncio → chat → pedido», que es el del comercio social. Favorece la propuesta de empezar con mensajes preparados y estados propios.

### 11.2 Facturación y contabilidad

DIAN describe tres rutas: solución gratuita, desarrollo propio y proveedor tecnológico autorizado. Que exista un sistema gratuito no demuestra una API universal gratuita que una tienda pueda consumir sin habilitación. Su catálogo identifica proveedores autorizados, no tarifas de integración. [S53–S54]

Siigo documenta APIs de productos, clientes y facturas. Alegra describe sincronización de contactos/productos y creación de facturas desde pedidos mediante REST. La elegibilidad de la cuenta, plan, localización y factura electrónica debe comprobarse por cliente. [S51–S52]

**Propuesta:** integrar o exportar hacia el sistema que ya usa el comerciante. Una cotización, cuenta de cobro o PDF de pedido no debe rotularse como factura electrónica DIAN si no cumple el proceso fiscal correspondiente.

**[C6] Precios observados de facturación.** La sección decía qué rutas existen; faltaba el orden de magnitud de lo que paga el comerciante.

| Proveedor | Oferta observada | Condición relevante | Fuente |
|---|---|---|---|
| Alegra, facturación electrónica | COP 17.900, 49.900, 99.900 y 179.900 al mes; 25 % menos con pago anual | El plan lo fija el ingreso mensual del negocio: hasta COP 10, 40, 180 y 500 millones. Facturas ilimitadas y certificado digital incluido | S117 (oficial) |
| Alegra contabilidad · Siigo Nube · Loggro | Desde ≈ COP 69.900 · ≈ COP 146.000 con contrato anual · COP 108.990 a 279.990 | El comparador advierte que una implementación con POS, nómina e inventario puede costar 30–80 % más que el plan base | S119 (secundaria) |
| Bold | Facturación electrónica entre los beneficios sin costo de su cuenta | Mencionada en el tarifario; alcance y límites no revisados | S39 (oficial) |

Umbrales de 2026, según el blog de un proveedor [S118]: UVT de COP 52.374; obligación de facturar para personas jurídicas, responsables de IVA o INC, régimen SIMPLE y personas naturales con ingresos sobre 3.500 UVT (≈ COP 183,3 millones). Es una fuente secundaria: se confirma con el contador y no reemplaza a S53.

Lectura (inferencia):

- El facturador más barato observado (COP 17.900) es del mismo orden que la tienda más barata observada (COP 33.900). Juntos son el ancla de precio de §13.6.
- Los planes escalan por ingresos del negocio, no por funciones. Es un modelo de empaquetado distinto al de las tiendas (§8.4).
- Que una pasarela regale la factura sugiere que se está volviendo un gancho comercial y no un producto por sí mismo. Para la tienda alojada refuerza la propuesta de integrar el sistema del comerciante antes que emitir.

### 11.3 Logística

Envia documenta cotización, generación de etiquetas, seguimiento y validación de direcciones mediante su API multitransportador. Melonn documenta fulfillment multicanal e integraciones con tiendas/marketplaces, incluida una API. Son capacidades de proveedores: disponibilidad por ruta, país, contrato y tarifa debe verificarse. [S55–S56]

| Necesidad | Integración o proceso | Riesgo operativo a medir |
|---|---|---|
| Cotizar envío | Tarifa y servicio por destino/peso | Peso volumétrico, cobertura y vigencia |
| Crear guía | Orden de despacho y etiqueta | Datos incorrectos y pedidos duplicados |
| Informar entrega | Estado del transportador y excepciones | Estado técnico que no equivale a satisfacción del cliente |
| Fulfillment | Inventario, preparación y despacho | Diferencias de stock, empaque, almacenamiento y SLA |
| Devolución | Autorización, recolección y conciliación | Costos dobles y reposición incorrecta |

Una tienda puede cobrar una tarifa fija al inicio, pero debe informar sus condiciones y comprobar rentabilidad. La herramienta de margen ED1 debería incluir transporte, empaque, entrega fallida y devoluciones cuando el comercio conozca esos valores.

**[C7] Tarifas observadas de entrega y contraentrega.** La versión 1.2 no trataba el pago contra entrega. Los rangos siguientes vienen de una sola fuente secundaria, que los presenta como ilustrativos y dependientes del contrato y del volumen. [S120]

| Transportadora | Paquete de 1 kg | Comisión por recaudo contraentrega | Liquidación del recaudo | Entregas efectivas con confirmación previa |
|---|---|---|---|---|
| Interrapidísimo | COP 8.000–15.000 | 1,5–3 % + IVA | 24–48 h hábiles | 80–90 % (incluye rural) |
| Coordinadora | COP 9.000–16.000 | 2–3,5 % + IVA | 24–48 h hábiles | 85–93 % (urbano) |
| Servientrega | COP 10.000–18.000 | 2,5–4 % + IVA | 48–72 h hábiles | 85–93 % (urbano) |

Lectura (inferencia):

- **La entrega puede costar más que el cobro.** En un pedido de COP 120.000, un flete de COP 10.000 es el 8,3 %, frente al 3,6 % del cobro en línea de §7.4.
- **La contraentrega tiene un costo que no está en la tarifa.** Si entre el 7 % y el 20 % de esos pedidos no se entrega, el comercio paga el flete de ida y, según el contrato, el de vuelta. La tarifa de recaudo es la parte pequeña.
- **Confirmar el pedido antes de despachar** es la práctica que la fuente asocia a esas tasas de entrega. Es un uso concreto para los mensajes de utilidad de §11.1.

Sobre fulfillment: Melonn afirma que tercerizar ahorra entre 15 % y 30 % del costo real frente a la operación propia, y que la operación propia conviene por debajo de unos 100 pedidos al mes. Es la afirmación de un proveedor sobre su propio servicio, sin tarifas publicadas. [S121]

No se recuperó una fuente primaria sobre el peso de la contraentrega en Colombia ni sobre su tasa de devolución. Son preguntas de entrevista (§16.2) y campos de la herramienta 1 (§15.2).

### 11.4 Marketplaces y venta multicanal

Mercado Libre documenta notificaciones de órdenes y cambios de ubicaciones de stock. Esto permite analizar conectores, pero no equivale a sincronización perfecta sin desarrollo, autorización y manejo de errores. [S57]

La integración necesita declarar cuál sistema manda sobre producto, precio, existencia y estado de pedido. Se deben definir reservas, reintentos, límites de API y reconciliación periódica. La compatibilidad con un marketplace es una obligación de mantenimiento continuo.

**[C8] Comisiones observadas de canales.** La sección trataba la integración técnica; faltaba el costo de vender en el canal.

| Canal | Oferta observada | Condición relevante | Fuente |
|---|---|---|---|
| Éxito marketplace | 8–20 % + IVA según categoría; publicar es gratis; pago semanal | Logística con su operador (Go Éxito) o transporte propio. Vende también en Carulla.com y en pantallas de más de 170 tiendas | S122 (oficial) |
| Falabella | 6–20 % según segmento; 50 % de descuento los tres primeros meses | El porcentaje viene de una fuente secundaria. La página oficial confirma comisión por categoría y cobros por unidad en dropshipping y logística inversa, sin cifras | S123 (oficial), S124 (secundaria) |
| Mercado Libre | Colombia: no recuperada. Referencias: Argentina 11–17,5 % más un cargo fijo; Chile 13–20 % | No se trasladan a Colombia. El simulador oficial de costos es la fuente | S125 (secundarias) |
| Rappi | Comisión por venta que se informa durante el registro; darse de alta no cuesta | Publicidad dentro de la aplicación como servicio opcional | S126 (oficial) |
| TikTok Shop | Operativo en México y Brasil; Colombia en piloto con acceso limitado | A diciembre de 2025, según un proveedor de integraciones. Vigilar (§17.1) | S127 (secundaria) |

Lectura (inferencia): entre el 6–20 % de un marketplace y el 3–4 % del cobro en una tienda propia hay una diferencia que es el precio del tráfico. La herramienta 1 puede mostrarla con el mismo producto vendido por dos canales, que es una decisión que el comerciante toma a ciegas.

### 11.5 Servicios profesionales que ED1 puede probar

| Servicio propuesto | Resultado concreto | Forma económica sugerida | Límite para evitar trabajo abierto |
|---|---|---|---|
| Preparación de catálogo | Productos e imágenes listos para publicar/importar | Precio por lote y alcance | Número de SKUs, variantes y revisiones |
| Puesta en marcha | Tienda configurada con cobro/entrega probados | Proyecto cerrado | Plataforma, medios y pruebas incluidas |
| Migración | Datos y URLs migrados con verificación | Diagnóstico + ejecución | Integraciones y datos no recuperables |
| Automatización | Flujo pedido → cobro/estado → administración | Implementación + mantenimiento opcional | Un proceso, proveedores y excepción definidos |
| Optimización de conversión | Diagnóstico y cambios comprobables | Servicio por entregables | Sin prometer aumento de ventas |
| Operación asistida | Apoyo recurrente de catálogo o pedidos | Retainer con volumen | Horas, canales y SLA |

Estos son modelos propuestos, no precios de mercado observados. Los primeros proyectos pueden producir requisitos reales para el SaaS, siempre que ED1 registre costo y tiempo por cliente.

### 11.6 Herramientas de marketing y CRM: quién cobra qué **[C5]**

El estudio trataba WhatsApp y la analítica. Faltaban las herramientas de automatización que un comercio suma a su tienda, y su forma de cobro.

| Herramienta | Modelo de cobro | Oferta observada | Fuente y límite |
|---|---|---|---|
| Klaviyo | Por perfiles activos desde febrero de 2025, se les envíe o no | Gratis hasta 250 perfiles; USD 20 (500), 30 (1.000), 100 (5.000) y 150 (10.000) al mes | S114. Secundaria, publicada por un competidor |
| Doppler | Por contactos, por envíos o por créditos | Desde USD 10 al mes por contactos; SMS a Colombia a USD 0,0075; gratis hasta 500 contactos durante 90 días | S115 (oficial) |
| Cliengo y Leadsales | Por conversaciones, el primero; por usuario al mes, el segundo | Sin precios públicos recuperados | S116. Secundaria, publicada por una de las partes |

Lectura (inferencia):

- El marketing automatizado se cobra fuera de la plataforma y crece con el tamaño de la lista, no con las ventas. Un comercio puede pagar más por contactos inactivos que por su tienda.
- Para ED1 es un servicio de terceros que se integra, no un motor que se construye. La recuperación de carrito sigue condicionada al consentimiento del comprador (§8.2).

---

## 12. IA, descubrimiento, marketing y conversión

### 12.1 IA aplicada al comercio

| Aplicación | Valor posible | Control necesario | Prioridad propuesta |
|---|---|---|---|
| Descripciones y fichas | Acelerar borradores | Verificar medidas, materiales, garantías y derechos de imagen | Media; optativa |
| Normalización de catálogo | Completar atributos y categorías | Conservar dato original y revisión por lote | Alta si reduce trabajo probado |
| Atención asistida | Responder disponibilidad/condiciones | Consultar fuente vigente y escalar excepciones | Después de datos y estados fiables |
| Recomendación/búsqueda semántica | Mejorar descubrimiento | Evaluación de calidad y costo frente a búsqueda simple | Catálogos que lo justifiquen |
| Agente operativo | Ejecutar acciones en sistemas | Permisos, registro, confirmación y reversibilidad | Posterior al MVP |
| Predicción de demanda/precio | Apoyar decisiones | Datos suficientes y evaluación fuera de muestra | No prioritaria sin historial |

La tabla expresa posibilidades y controles de diseño. No se afirma que IA garantice rentabilidad o que todos los servicios permitan ejecutarla sin costo.

**[V7] Una regla de Meta limita la atención con IA por WhatsApp.**

- Desde el 15 de enero de 2026, Meta no deja usar WhatsApp Business Platform a los proveedores de IA cuando un asistente de propósito general es la función principal. [S89–S90]
- Siguen permitidas la IA que una empresa usa para atender a sus propios clientes y las automatizaciones estructuradas: confirmar un pedido, recordar un pago.
- Para ED1, la «atención asistida» de cada comercio cabe en la regla. Un asistente de IA de ED1 por WhatsApp como producto propio cae en la zona prohibida (inferencia; revisar el texto vigente de Meta antes de diseñarlo).

### 12.2 Comercio mediante agentes: alcance comprobado

- **ACP/OpenAI:** la especificación describe sesiones de checkout; construir con el protocolo está abierto, mientras Instant Checkout requiere aprobación del socio. [S72]
- **UCP/Google:** la documentación ofrece operaciones de identidad, carrito, checkout, pedidos y lealtad, conectadas con sus superficies de IA. La página general no basta para afirmar habilitación en Colombia. [S73]
- **Shopify:** documenta un catálogo global y uno por tienda para agentes, con capacidad de catálogo UCP e interfaces MCP. [S74]

**Inferencia:** la calidad del catálogo, las reglas de disponibilidad y una API fiable adquieren relevancia adicional. La respuesta ED1 de corto plazo debería ser preparar datos y operaciones portables; no gastar en varios protocolos antes de demostrar canal, elegibilidad e ingreso. MCP es una interfaz para herramientas, no por sí mismo un sistema de pago ni un mecanismo completo de autorización comercial.

### 12.3 SEO, feeds y datos de producto

Google documenta marcado `Product`/`Offer` para experiencias de merchant listing. La elegibilidad no garantiza que un producto aparezca ni sustituye la consistencia del precio, disponibilidad, entrega y contenido visible. [S62]

GS1 explica la asignación de GTIN y su uso en canales de venta. ED1 puede verificar formatos o generar la representación gráfica de un identificador legítimo; no debería inventar GTIN comerciales y venderlos como asignaciones válidas de GS1. Un SKU interno es otra cosa. [S64]

**Herramientas propuestas:** verificador local de CSV, diagnóstico de fichas, generador de sitemap para catálogo, comprobador de consistencia de precio/disponibilidad y preparador de feeds. Requieren especificaciones vigentes y límites claros; no se deben presentar como certificación de aprobación del canal.

**[V6] Requisito de una tienda alojada: el HTML de cada ficha.**

- El marcado `Product`/`Offer`, el título, la descripción y el Open Graph tienen que estar en el HTML que se entrega, no pintados después con JavaScript. ED1 lo pide para cada página (S01 §12), y la bitácora del agro lo volvió regla: «el rastreador que no ejecuta JavaScript».
- De eso dependen las fichas en Google y la vista previa de un enlace en WhatsApp, que es el canal principal del público de ED1.
- La Tienda 2.0 hornea el HTML de cada tienda. El diseño de la 3.0 debe hornear también el de cada producto, y no solo un catálogo en JSON (S81, §4.2).

### 12.4 Analítica y rendimiento

GA4 documenta eventos de ecommerce como `view_item`, `add_to_cart`, `begin_checkout`, `purchase` y `refund`. Los eventos de marketing se deben reconciliar con datos operativos: un mensaje enviado por WhatsApp no es un pago aprobado. [S63]

Google recomienda evaluar Core Web Vitals con LCP, INP y CLS; sus umbrales de buena experiencia son LCP ≤ 2,5 s, INP ≤ 200 ms y CLS ≤ 0,1, al percentil 75. W3C publica WCAG 2.2. Rendimiento y accesibilidad deben comprobarse en la interfaz real, especialmente en móvil. [S65–S66]

Para ED1, medir además: comerciante activado, catálogo utilizable, pedido creado, cobro confirmado, minutos por pedido, retorno y pago de la suscripción. Evitar datos personales en parámetros analíticos y separar el embudo del comprador del embudo de adquisición de comerciantes.

### 12.5 Crecimiento propuesto para ED1

| Canal | Propuesta | Qué debe medirse |
|---|---|---|
| SEO de intención operativa | Herramienta útil con ejemplo colombiano y resultado inmediato | Impresiones, uso completado y comerciantes identificados |
| WhatsApp/referidos | Resultado compartible, plantilla o catálogo con utilidad | Retorno y nuevos usuarios atribuidos, sin acceso indebido a contactos |
| Alianzas | Contadores, implementadores y asociaciones de comerciantes | Comercios activados y costo de atención |
| Contenido educativo | Explicar costo total, margen y diferencias de cobro | Uso de herramienta y avance a siguiente necesidad |
| Servicios | Caso demostrable, alcance y entregable concreto | Margen de contribución y repetibilidad |
| Publicidad pagada | Experimentos acotados tras conocer activación | CAC y recuperación, no solo clics |

No se asignan volúmenes de búsqueda ni presupuesto rentable sin medición. El posicionamiento debe comunicar la tarea resuelta; “gratis” es una condición de acceso, no una prueba de valor.

### 12.6 Medir la demanda antes de construir **[V2]**

El ecosistema ya midió la demanda de búsqueda de sus calculadoras del agro, y la medición cambió una decisión: la herramienta que el estudio de mercado del agro ponía primera no tenía búsquedas en ninguna de sus formas. Aquí se usa el mismo método. [S84]

1. **Keyword Planner**, en «Métricas históricas» de los últimos 12 meses, nunca en «Previsión». Primero Colombia; después México, Perú, Ecuador, Chile, Argentina, Guatemala y Costa Rica. En español y en la red de Google.
2. **Cada cifra con su tipo:** V (verificada: Keyword Planner con gasto, o Search Console), R (rango, sin gasto activo) o E (estimación, diciendo de dónde sale). Los CSV no se suben al repositorio; solo las cifras.
3. **La regla de decisión, fijada antes de ver los datos:**
   - Demanda de una herramienta = suma de Colombia de sus términos + 0,3 × suma de LATAM. Con rangos se usa el punto medio y la herramienta se marca «con rangos».
   - Desempate (±30 %): gana la que lleva al producto que se paga (pedidos y conciliación).
   - Veto: lo que no se puede publicar sin que su promesa se lea mal (la lectura de QR, §15.2) espera a su piloto controlado.
   - Si ninguna pasa de 50 búsquedas al mes en Colombia, la demanda no decide. Se ordena por cercanía al producto que se paga y se vuelve a medir con Search Console a los 90 días de publicar.

Lista para pegar. Son 25 términos, y la lista es una hipótesis de cómo se busca, no un resultado:

```text
calcular margen de ganancia
calculadora de precio de venta
cómo calcular el precio de venta
punto de equilibrio
margen de utilidad
comisión bold
cuánto cobra bold
comisión wompi
comisión mercado pago colombia
comisiones pasarelas de pago colombia
catálogo de whatsapp
cómo hacer un catálogo de productos
plantilla catálogo de productos
importar productos tiendanube
formato de cotización
cotización por whatsapp
cuenta de cobro
plantilla cuenta de cobro
cómo mejorar mi tienda online
fichas de producto
verificar pago nequi
comprobante nequi falso
qr bre-b
calculadora de iva
retención en la fuente
```

| Términos | Herramienta (§15.2) |
|---|---|
| Margen, precio de venta, punto de equilibrio, utilidad | 1 · Rentabilidad del pedido |
| Comisiones de Bold, Wompi, Mercado Pago y pasarelas | 1 · Costo de cobrar, dentro de la rentabilidad |
| Catálogo, plantilla, importar productos | 2 · Catálogo listo para vender |
| Cotización, cuenta de cobro | 3 · Cotización o pedido para WhatsApp |
| Mejorar la tienda, fichas de producto | 4 · Diagnóstico de fichas |
| Verificar un pago, comprobante, QR Bre-B | 5 · Lectura de QR (piloto controlado) |
| IVA, retención en la fuente | Candidatas de ED1 §10.4 al quinto lugar |

Los resultados se registran como en el agro, en un documento de validación propio de la línea ecommerce, con fuente y fecha por cifra.

**[C] Seis términos candidatos más.** Salen de los complementos de esta versión y se suman a la lista antes de medir, no después. Siguen siendo una hipótesis de cómo se busca. La regla de decisión no cambia.

```text
comisión epayco
cuánto cobra mercado libre por vender
calculadora comisión mercado libre
pago contra entrega
cuánto cuesta enviar un paquete
calculadora de envíos
```

Todos van a la herramienta 1: el costo de cobrar, el costo del canal y el costo de entregar son tres partes de la misma rentabilidad por pedido.

---

## 13. Monetización y economía unitaria

### 13.1 Cómo monetiza el ecosistema competitivo

La oferta revisada muestra suscripciones por plan, cobros por funciones/uso, cargos asociados a pagos, apps y servicios. Shopify documenta un programa específico de reparto de ingresos para desarrolladores de apps. No se presupone que ese programa aplique a cualquier proveedor o que ED1 cumpla ya sus requisitos. [S16, S18, S21, S25, S49, S71]

**[C9] Los modelos observados, con su evidencia.** El párrafo anterior los nombra; esta tabla dice quién usa cada uno.

| Modelo | Quién lo usa | Evidencia |
|---|---|---|
| Suscripción por niveles de funciones o de tamaño | Tiendanube, Jumpseller, Alegra, Doppler | S16, S99, S115, S117 |
| Suscripción más comisión por proveedor de pago externo | Shopify, BigCommerce | S18, S25 |
| Participación sobre las ventas procesadas | VTEX (ingresos ≈ 1,2 % del GMV); Salesforce Commerce Cloud (estimado por terceros) | S101; S102 (secundaria) |
| Licencia anual por tramos | Adobe Commerce (estimado por terceros) | S102 (secundaria) |
| Porcentaje más cargo fijo, con precio por plazo | Pasarelas agregadoras | §10.2 |
| Cobro por unidad de uso | WhatsApp por mensaje; transportadoras por guía; Klaviyo por perfil | §11.1, §11.3, §11.6 |
| Comisión por venta en el canal | Éxito, Falabella, Mercado Libre | §11.4 |
| Publicidad dentro del canal | Rappi | S126 |
| Servicios gratuitos alrededor del cobro | Bold: cuenta, tarjeta y facturación electrónica sin costo para quien procesa con ellos | S39. Que funcionen como gancho es una inferencia |

Lectura (inferencia): quien vende software a comercios pequeños tiende a obtener el ingreso de lo que rodea a la suscripción (pagos, envíos, mensajes, servicios financieros), no de la suscripción. Shopify y Bold lo muestran desde lados opuestos. No se sigue que ED1 pueda hacer lo mismo: esos modelos descansan en contratos, licencias y volumen que este estudio no valida (§10.5).

### 13.2 Modelos propuestos para ED1

| Modelo | Qué se vende | Ventaja posible | Costos/riesgos económicos | Momento sugerido |
|---|---|---|---|---|
| Gratuito con publicidad | Atención de usuarios de herramientas | Adquisición con baja fricción | Tráfico, consentimiento, rendimiento y confianza | Herramientas públicas con uso suficiente |
| Freemium | Historial, lotes, plantillas, exportación/automatización | Relación entre utilidad y mejora de productividad | Abuso, soporte y límites confusos | Después de retorno medido |
| Suscripción por comercio | Pedidos, estados, conciliación e integraciones | Ingreso recurrente ligado a operación | Churn, mensajería, soporte y confiabilidad | Piloto con pago real |
| Consumo medido | IA, mensajes o procesamiento costoso | Alineación entre costo y precio | Imprevisibilidad para el cliente | Funciones optativas con presupuesto |
| Implementación/migración | Resultado de puesta en marcha | Ingreso y aprendizaje directo | Horas y dependencia de personas | Puede probarse antes del SaaS |
| App/plugin/conector | Mejora de una plataforma existente | Distribución dentro del ecosistema | Revisiones, cambios de API y reparto de ingresos | Una integración con demanda comprobada |
| Referidos/afiliación | Recomendación comercial | Ingreso complementario | Conflicto de interés y requisitos del programa | Solo con programa confirmado y divulgación |
| Comisión por venta | Servicio comercial ligado a transacciones | Precio asociado a actividad | Atribución, regulación, reembolsos y aceptación | No priorizar en fase inicial |
| Donaciones | Apoyo voluntario a herramientas | Complemento simple | Ingreso irregular y costo del recaudo | Complementario, no base de proyección |

**Recomendación:** mantener herramientas gratis sin publicidad dentro de pantallas sensibles de pago, pedidos o conciliación. Monetizar historial, automatización y ahorro operativo cuando se verifique recurrencia. Esto es una propuesta de producto coherente con ED1, no una regla universal del mercado.

**[C9] Tres líneas por uso que el informe complementario propuso.** Entran como hipótesis, debajo de «Referidos/afiliación» y con sus mismas reservas.

| Línea | Qué se vende | Condición sin confirmar | Riesgo |
|---|---|---|---|
| Participación de una pasarela aliada | Volumen de comercios referidos | Que exista un programa de aliados aplicable a ED1 y qué paga. No se revisó ninguno | Conflicto de interés al recomendar pasarela; depender de un solo proveedor |
| Margen sobre guías | Guías compradas por volumen a un agregador y revendidas | Que el agregador lo permita y a qué tarifa | Soporte de entregas fallidas, que es caro (§11.3) |
| Margen sobre mensajes | Mensajes de WhatsApp con sobreprecio publicado | Cuota del intermediario y reglas de Meta | Imprevisibilidad para el cliente, igual que en «Consumo medido» |

Tres condiciones para cualquiera de ellas:

1. **Ninguna convierte a ED1 en agregador de pagos.** El dinero del comprador va del proveedor al comercio (§3.2, §10.5).
2. **Se divulgan.** Si ED1 recibe algo de un proveedor que recomienda, lo dice en su página de precios.
3. **No se proyecta ingreso con ellas** mientras no haya un contrato firmado y un comercio usándolas.

### 13.3 Fórmulas de control

Para la suscripción ED1:

`Ingreso neto por comercio = precio cobrado − descuentos − impuestos recaudados por cuenta de terceros − comisión de recaudo − reembolsos`

`Contribución por comercio = ingreso neto − infraestructura atribuible − mensajería − IA − otros servicios variables − soporte variable`

`Punto de equilibrio de comercios = costos fijos mensuales / contribución mensual positiva por comercio`

`CAC = gasto atribuible de adquisición / nuevos comercios pagadores atribuibles`

`Recuperación de CAC = CAC / contribución mensual de la cohorte`

Para una operación de tienda, medir margen de producto después de costos de pago, empaque, envío subsidiado, devolución y publicidad. Para LTV, usar cohortes y retención observada; no asumir permanencia indefinida ni extrapolar un mes sin cancelaciones.

**[V4] Entradas propias de ED1 para estas fórmulas:**

- **Comisión de recaudo.** ED1 cobra con Bold, mes a mes y sin débito automático. Con la tarifa observada en §10.2, la parte fija pesa más del 5 % en un plan de COP 39.000 (§13.4).
- **Impuestos.** Si el servicio cumple las condiciones de la DIAN para la computación en la nube, está excluido de IVA (Estatuto Tributario, art. 476, num. 24); si no, lleva el 19 %. *No confirmado: lo decide el contador.* [S91]
- **CAC.** Mientras la adquisición sea orgánica, el gasto de adquisición son horas del dueño, y el CAC se mide en horas o en su valor (S01 §18; S86, [H16]).
- **Costos fijos.** En validación son USD 0 a 5 de infraestructura al mes, más las horas del dueño, que ED1 declara como el límite real de su presupuesto (S01 §25). [S82, S83]

### 13.4 Escenarios ilustrativos: no son previsión de ingresos

| Escenario hipotético | Comercios pagadores | Precio mensual supuesto | Facturación bruta aritmética |
|---|---:|---:|---:|
| Piloto pagado | 10 | COP 29.000 | COP 290.000/mes |
| Validación ampliada | 50 | COP 39.000 | COP 1.950.000/mes |
| Operación inicial | 200 | COP 49.000 | COP 9.800.000/mes |

Los precios no se derivan de una encuesta ni se recomiendan como tarifa final. No incluyen impuestos, recaudo, cancelaciones, adquisición, soporte ni consumo. Si la contribución hipotética fuera COP 25.000 por comercio y los costos fijos COP 1.000.000/mes, el equilibrio aritmético sería 40 comercios. Si el soporte reduce esa contribución a cero, aumentar clientes no resuelve el modelo.

**[V4] El recaudo, con la tarifa observada de Bold** (inferencia, antes del IVA de la comisión; S39):

| Cobro | Comisión | Peso sobre lo cobrado |
|---|---:|---:|
| COP 29.000 por PSE o billetera | 2,89 % + 900 = COP 1.738 | 6,0 % |
| COP 39.000 por PSE o billetera | COP 2.027 | 5,2 % |
| COP 39.000 con tarjeta | 2,99 % + 900 = COP 2.066 | 5,3 % |
| COP 49.000 por PSE o billetera | COP 2.316 | 4,7 % |
| COP 468.000 por PSE (doce meses de una vez) | COP 14.425 | 3,1 % |

- Lo que vale para el pedido de bajo valor (§7.3) vale para la suscripción de ED1: cobrar mes a mes paga la tarifa fija doce veces al año. Hipótesis a probar: el prepago trimestral o anual.
- Los costos fijos de COP 1.000.000 de arriba son un supuesto aritmético. El costo fijo real de la validación son las horas del dueño (§13.3).

Para publicidad en herramientas: `ingreso = vistas monetizables / 1.000 × RPM observado`. Sin RPM propio no se calcula ingreso esperado. Las vistas de compradores dentro de tiendas no deben confundirse con audiencia monetizable de utilidades.

### 13.5 Qué puede sostener una ventaja

**Inferencia estratégica:** bajo costo de infraestructura puede facilitar la validación, pero no es una barrera suficiente. Una ventaja más defendible puede surgir de plantillas y datos locales, una tarea mejor resuelta, distribución propia, soporte eficiente, confianza verificable y conectores mantenidos. El número de herramientas por sí solo no prueba que exista ese activo.

### 13.6 Hipótesis de empaquetado y precio para la tienda alojada **[C11]**

Los escenarios de §13.4 usan precios supuestos sin ancla. El informe complementario propuso una, y cuatro niveles. Entran como **hipótesis a contrastar con los comercios reales de la línea** (§16.1), no como tarifa recomendada. No cambian la decisión de §17.3.

**El ancla: lo que el comercio paga hoy por separado.**

| Combinación observada | Costo mensual | Qué no incluye |
|---|---:|---|
| Tienda más barata + facturador más barato (Tiendanube Básico + Alegra, plan de entrada) | COP 51.800 | Cobro, guías, mensajes |
| Tienda intermedia + facturador intermedio (Tiendanube + Alegra, segundo plan) | COP 124.800 | Cobro, guías, mensajes |

Fuentes: [S16, S117]. Es una suma de precios de lista, no lo que paga un comercio concreto. Lo que pagan las dos tiendas 2.0 es el dato que falta (§17.2).

**Los cuatro niveles propuestos.**

| Nivel | Precio hipotético al mes | Referencia de mercado | Límite que empuja al siguiente | Recaudo con Bold (PSE) |
|---|---:|---|---|---:|
| Gratis: catálogo y pedido por WhatsApp | COP 0 | Sin equivalente permanente observado en Colombia (§7.2) | Número de productos, un usuario, sin dominio propio | — |
| Entrada: tienda con cobro y entrega | COP 29.900 | Tiendanube Básico, COP 33.900 | Un usuario, sin automatizaciones | COP 1.764 (5,9 %) |
| Intermedio: factura integrada y automatización | COP 89.900 | Tienda + facturador, COP 124.800 | Facturas incluidas, una bodega | COP 3.498 (3,9 %) |
| Alto: B2B, POS, varias bodegas, API | COP 249.900 | Tiendanube Avanzado, COP 249.900 | — | COP 8.122 (3,3 %) |

Cuatro reservas, que vienen del propio estudio:

- **El nivel gratuito tiene costo.** Cada tienda gratuita consume cuota de la cuenta compartida (§9.4) y es una tienda de terceros en la infraestructura de ED1, con su riesgo de abuso (§14.1). Su tamaño se decide con el presupuesto por producto, no con el mercado.
- **El recaudo pesa más en el precio bajo.** A COP 29.900 mensuales, Bold se lleva el 5,9 %. Vale la hipótesis de **[V4]**: probar prepago trimestral o anual.
- **El precio de entrada compite con uno conocido.** Quedar COP 4.000 por debajo de Tiendanube Básico no es una ventaja (§7.4). La diferencia tendría que estar en lo que incluye: cobro, entrega y pedido por WhatsApp resueltos.
- **El nivel intermedio depende de terceros.** Incluir la factura exige revender un proveedor tecnológico o integrar el del comercio (§11.2); ningún costo por documento se cotizó.

**Ilustración de ingreso por comercio en el nivel intermedio.** Aritmética con supuestos, como en §13.4:

| Línea | Supuesto | Ingreso mensual | Estado |
|---|---|---:|---|
| Suscripción | 1 comercio | COP 89.900 | Hipótesis de precio |
| Participación de pasarela | 0,3 % de COP 30 millones procesados | COP 90.000 | Sin programa confirmado (§13.2) |
| Margen sobre guías | 150 guías × COP 1.000 | COP 150.000 | Sin contrato confirmado (§13.2) |
| Margen sobre mensajes | 1.000 mensajes × COP 19 (COP 60 de precio, ≈ COP 41 de costo) | COP 18.700 | Sin intermediario cotizado |
| **Total** | | **≈ COP 348.600** | Solo la primera línea depende de ED1 |

Tres cuartas partes de ese total salen de líneas que ningún proveedor ha confirmado. La lectura prudente es la contraria a la del informe complementario: **el ingreso con el que se puede planear es la suscripción**, y las demás líneas se suman cuando haya un contrato. Con las fórmulas de §13.3, a esa suscripción hay que restarle el recaudo (COP 3.498), el costo por documento de la factura incluida y los minutos de soporte.

Qué se le pregunta a los comercios reales antes de fijar nada: cuánto pagan hoy por tienda, facturador, mensajes y envíos; qué límite los haría subir de plan; y si prefieren pagar por adelantado con descuento (§16.2).

---

## 14. Confianza, privacidad y requisitos regulatorios

### 14.1 Colombia

El Estatuto del Consumidor —Ley 1480— incluye disposiciones sobre comercio electrónico. La Ley 2439 de 2024 modifica ese marco y establece medidas de protección en ese canal. Debe utilizarse el texto vigente para implementar obligaciones; una plantilla antigua de términos no basta. [S75–S76]

| Área de revisión propuesta | Requisito de producto que conviene preparar | Comprobación pendiente |
|---|---|---|
| Identificación del vendedor | Datos y canales de contacto del comercio | Información exigible según operación |
| Oferta/precio | Producto, total, envío y condiciones claros | Impuestos y forma de presentar el precio |
| Compra | Resumen, aceptación y evidencia del pedido | Conservación y obligaciones aplicables |
| Posventa | Flujo de consultas, reclamos, devoluciones y reversión. **[V10]** La Ley 2439 de 2024 pide devolver el dinero del retracto en máximo 15 días calendario y ofrecer un canal de quejas fácil de encontrar: la tienda alojada tiene que hacerlo posible | Plazos, excepciones y texto vigente [S76, S93] |
| Datos personales | Finalidad, permisos, retención y controles por comercio. **[V10]** En una tienda alojada, ED1 es encargado del tratamiento de cada comercio, que es el responsable: contrato de transmisión de datos con cada uno y una política que lo diga | Roles de ED1/comerciante/proveedores y régimen aplicable. Requiere abogado [S92] |
| Facturación | Integración o proceso de emisión | Obligación y habilitación del comerciante |
| Comunicaciones | Consentimientos y preferencias | Reglas del canal y de contacto comercial |
| Antiabuso **[V10]** | Tiendas de terceros en la infraestructura de ED1: dominio registrable separado para las tiendas sin dominio propio, términos de uso, reporte, `abuse@` y suspensión con un clic (S01 §14.1) | Qué verifica Bold al abrir la cuenta de cada comercio y qué le queda a ED1 |
| Las ventas de ED1 **[V4]** | Términos y condiciones de los planes pagos (S01 §20.1); factura electrónica de ED1 a sus clientes; IVA o exclusión como computación en la nube | Contador y abogado, antes del primer cobro real [S83, S91] |

El cuadro es una agenda de implementación, no una enumeración exhaustiva de obligaciones legales. ED1 ya incluye privacidad y Ley 1581 en su visión; el diseño final debe revisar los tratamientos concretos y las responsabilidades contractuales. [S01]

### 14.2 Pagos y seguridad

PCI SSC documenta cambios de SAQ A relacionados con seguridad de ecommerce y los requisitos 6.4.3/11.6.1. La elegibilidad y el alcance dependen de cómo se integre el checkout. Utilizar una pasarela no demuestra por sí solo que toda responsabilidad de seguridad de la tienda desaparezca. [S77]

**Propuesta técnica:** checkout alojado o componentes del proveedor, sin almacenar datos de tarjeta; inventario de scripts en páginas sensibles; validación de webhooks; mínimos privilegios; aislamiento de comercios; respaldos verificables; auditoría de cambios de precios y pedidos.

### 14.3 La promesa de privacidad debe ser delimitada

“Tus archivos no salen del navegador” puede ser verificable para herramientas locales. No debe extenderse al checkout, la mensajería o la factura si esas operaciones transmiten datos a terceros. La interfaz debe indicar en qué momento y con qué propósito ocurre una transferencia de datos.

---

## 15. Oportunidades y prioridades para ED1

### 15.1 Priorización analítica

La evaluación usa cinco criterios: cercanía al público ED1, posibilidad de ejecución barata, recurrencia potencial, integración necesaria y riesgo de promesa incorrecta. **Las categorías son juicio del consultor, no medición de demanda.**

| Oportunidad | Cercanía al público | Costo técnico inicial | Recurrencia a probar | Riesgo/condición principal | Prioridad |
|---|---|---|---|---|---|
| Calculadora de contribución por pedido | Alta | Bajo, navegador | Media | Supuestos fiscales/tarifarios editables | P0 |
| Preparador de catálogo CSV/imágenes | Alta | Bajo–medio, navegador | Media–alta | Compatibilidad y preservación de datos | P0 |
| Cotizador/pedido para WhatsApp | Alta | Bajo para exportar; medio para historial | Alta | No llamar pago a un pedido enviado | P0 |
| Lectura/comparación local de QR | Alta para el caso del proyecto | Bajo–medio | Desconocida | Describir límites de lo comprobado. **[V5]** El comerciante quiere saber si le llegó la plata, y un decodificador no lo responde | P1, piloto controlado; fuera del paquete inicial (§15.2) |
| Validador de datos de producto/feed | Alta para tiendas existentes | Medio | Media | Especificación y diagnóstico actualizados | P1 |
| Historial y bandeja de pedidos | Alta | Medio | Alta | Autenticación, aislamiento y exportación | P1 tras comprobar uso |
| Conciliación con proveedor contratado | Alta | Medio–alto | Alta | Acceso, costos y fuente bancaria fiable | P1 condicionada |
| Conector contable | Alta | Medio–alto | Alta | Plan y localización fiscal del cliente | P2 |
| Tienda alojada completa | Alta | **[V1]** Medio: reutiliza cuentas, cobro, aislamiento y operación del ecosistema (§3.3); faltan el panel, el catálogo horneado por tienda, los dominios propios y la migración | Alta | Soporte, checkout, inventario y posventa. **[V10]** Antiabuso para tiendas de terceros | P2, tras la señal de los comercios reales de la línea (§16.1) y un piloto pagado |
| Marketplace propio | Indeterminada | Muy alto | Indeterminada | Dos lados del mercado, liquidación y disputas | Posponer |
| Suite empresarial componible | Baja para validación inicial | Muy alto | Dependiente de contratos | Implementación y operación complejas | Posponer |

P0 = comprobar primero; P1 = siguiente experimento o dependencia; P2 = inversión posterior a evidencia.

### 15.2 Paquete inicial propuesto

**Herramienta 1 — Rentabilidad del pedido:** precio, costo de producto, cargo de pago editable, empaque, envío y descuento. Resultado descargable y explicación de supuestos. Monetización posterior: escenarios guardados, lotes y conexión con ventas reales. **[V5]** Trae el costo de cobrar con tarifas fechadas por proveedor: las de §10.2, que el radar de §17.1 revisa cada mes. Es la pregunta local que mejor se responde con contexto colombiano, y ED1 la pone entre sus prioridades (S01 §10.4).

**[C4] [C7] [C8] Campos que esta versión le suma a la herramienta 1.** El ticket, pedido antes de comparar pasarelas, porque el orden cambia con él (§10.2). El plazo de disponibilidad del dinero, como opción con precio. El costo de retiro a cuenta. El recaudo contraentrega, la tasa de pedidos devueltos y el flete de vuelta (§11.3). La comisión del canal, para comparar el mismo producto en tienda propia y en marketplace (§11.4). Todas las tarifas, editables y con fecha; las secundarias, marcadas como tales.

**Herramienta 2 — Catálogo listo para vender:** importar CSV, señalar campos faltantes, revisar variantes, preparar imágenes y exportar por destino. Monetización posterior: historial, plantillas y sincronización. **[V5]** Exporta primero al formato de catálogo del ecosistema: las columnas de la hoja «Catálogo» de la Tienda, que el cuaderno de CultivoPro ya produce. Después, a los de Tiendanube, Shopify y WooCommerce. Así hay un solo contrato de producto. [S80, S81]

**Herramienta 3 — Cotización/pedido para WhatsApp:** producto, cantidad, entrega y vigencia; producir mensaje y documento legible. Monetización posterior: seguimiento, estados y colaboración. **[V5]** Lo que lleve datos del comprador viaja en el fragmento `#` del enlace, que no llega a ningún servidor; nunca en la ruta ni en la consulta. Así viajan las invitaciones de CultivoPro. [S82]

**Herramienta 4 — Diagnóstico de ficha/tienda:** evaluar datos de producto, claridad del precio, contacto y consistencia técnica según reglas verificables. Monetización posterior: informe, lote o servicio de mejora. **[V5]** Trabaja sobre lo que el comerciante exporta o pega: CSV, feed o HTML. Leer una tienda desde su URL no se puede hacer en el navegador (CORS), y pediría un Worker que descargue páginas ajenas, con su costo y su riesgo de abuso. Espera a que un ingreso lo pague (S01 §15.1).

**Herramienta 5 — Lectura y comparación de QR:** empezar por decodificación y formato soportado, con monto comparado contra referencia aportada. Mantener separada una futura integración de confirmación bancaria. Solo lanzar después de validar decodificación, mensajes y límites con ejemplos legítimos. **[V5]** Sale del paquete inicial. §15.1 la pone en P1, como piloto controlado, y quien la use quiere saber si le llegó la plata, algo que un decodificador no responde. El «QR para negocios» de ED1 §10.4 es otra herramienta: generar un QR para el catálogo, el chat o el link de pago.

**[V5] El quinto lugar del paquete inicial** lo decide la medición de §12.6, entre los candidatos de este estudio y los de ED1 §10.4 (por ejemplo, el IVA en el precio).

El paquete conserva el objetivo ED1 de cinco herramientas iniciales, pero sus integrantes deben ajustarse a entrevistas y uso real. Si el QR atrae principalmente compradores ajenos al público pagador, no asumir que tiene el mismo valor de embudo que catálogo/pedidos.

### 15.3 Dos caminos tras la validación

| Camino | Condición de elección | Producto resultante |
|---|---|---|
| Complementos para tiendas existentes | El problema persiste con plataforma y el cliente no quiere migrar | Utilidades premium, app, conector o servicio |
| Comercio social y pedidos | Hay operación frecuente fuera de una tienda y pago por ordenarla | Catálogo/pedidos/conciliación con tienda opcional |
| Tienda alojada para los comercios de la línea **[V1]** | Los comercios reales pagan, se quedan y piden un soporte que cabe en su contribución (§16.3) | Hoy, las dos tiendas 2.0 siguen vendiendo. La 3.0 se construye como excepción declarada, diseñada desde cero sobre la plataforma del ecosistema, y los datos de las tiendas actuales se cargan con scripts (decisiones del dueño del 5 oct 2026; `docs/tienda/TIENDA-3.0.md`) |

Los tres pueden compartir datos y herramientas. Los dos primeros no necesitan una plataforma universal antes de tener usuarios, y el tercero ya la tiene (§3.3).

**[C12] Lo que queda del informe complementario para el camino 2.0 → 3.0.** Ese informe propuso migrar la tienda por etapas, con el backend actual y uno nuevo conviviendo detrás del mismo contrato de puertas. La decisión del dueño del 5 de octubre (3.0 diseñada desde cero, datos cargados con scripts) la reemplaza y es la que vale. De aquella propuesta quedan tres insumos para `docs/tienda/TIENDA-3.0.md`, todos tomados de la arquitectura 0.22.3 de la Tienda Panel y por verificar en la 1.0.0 [S131]:

| Insumo | Contenido | Para qué sirve |
|---|---|---|
| Lo básico que le falta a la 2.0 frente al mercado | Confirmación del pago por webhook (hoy, un disparador de conciliación); guías y contraentrega; factura electrónica; avisos automáticos por WhatsApp. Las cuatro dependen de terceros y de eventos | Alcance mínimo de integraciones de la 3.0 (§8.1, §8.4) |
| Techos medibles de la 2.0 | Una cuenta de Google por tienda, con su segundo factor y una credencial que caduca; 30 ejecuciones simultáneas de Apps Script por cuenta; 20.000 filas de pedidos por hoja (6.000 a 10.000 pedidos); un Worker por tienda (§9.4) | Criterio para decidir qué tienda se carga primero y argumento medible de la inversión (§17.3) |
| Lo que vale conservar | El contrato de puertas como especificación de la API; los cinco mecanismos de idempotencia del pedido; la suite de pruebas como pruebas de contrato; y una marca por tienda que permita volver a la 2.0 mientras se comprueba la carga | Reducir el riesgo de la carga por scripts con dos tiendas que siguen vendiendo |

El primer techo que se toca no es de infraestructura: es el tiempo del dueño por tienda, que ED1 declara como el límite real de su presupuesto (S01 §25).

---

## 16. Plan de validación comercial y técnica

### 16.1 Primeros 90 días — propuesta

| Período | Trabajo | Evidencia exigida | Decisión | Fase ED1 **[V8]** |
|---|---|---|---|---|
| Días 1–15 | 15–20 entrevistas con comercios de al menos dos segmentos. **[V1]** Incluyen a los comercios reales de la línea ecommerce, con sus datos de pago, soporte y retención. **[V2]** Medición de la demanda de búsqueda (§12.6) | Ejemplos de tareas, frecuencia, tiempo y alternativa actual; cifras de búsqueda con su tipo | Seleccionar problema concreto y las herramientas que se construyen | 0 · Decisiones |
| Días 16–30 | Prototipos de las primeras utilidades; acompañar 5–10 usos reales | Resultado utilizable, errores y tiempo ahorrado | Publicar/iterar o descartar | 1 · Utility MVP |
| Días 31–45 | Publicación de 3–5 herramientas y contenido propio | Completado, público, retorno y siguiente necesidad | Elegir la herramienta de entrada | 1–2 · Utility MVP y Growth |
| Días 46–60 | Piloto asistido con historial/pedidos; solicitar pago por alcance concreto | Pago real, soporte y uso recurrente | Validar monetización o revisar propuesta | 3–4 · Cuenta y monetización, como excepción declarada |
| Días 61–75 | Una integración de pago o administración, si hay contrato y necesidad. **[V4]** El cobro con Bold ya existe: integrarlo es usarlo, no construirlo | Pruebas de estado, duplicados, fallos y exportación | Confirmar confiabilidad y costo | 4 · Monetización |
| Días 76–90 | Análisis de cohortes y economía | Retención, contribución y dependencia del soporte | Elegir complemento, SaaS acotado o pivote | Insumo de la Fase 7 (S01 §33) |

Los tamaños de muestra sirven para descubrimiento y pilotos, no para estimar con representatividad estadística la demanda nacional.

**[V8] Una excepción que conviene declarar.**

- ED1 mide cada fase a 90 días (S01 §19.1) y no agrega una capa sin justificar la anterior (S01 §36). Este plan junta las fases 1 a 4 en un trimestre.
- Eso es una excepción, como la que el agro declaró en su ADR-2, y tiene mejor razón que la del agro: el ecommerce sí es el público objetivo de ED1 (S01 §2.1), y las cuentas y el cobro ya existen (§3.3).
- Si el dueño la acepta, queda escrita como decisión. Si no, el plan se estira a una fase por trimestre.

### 16.2 Preguntas de entrevista

1. Muestre cómo recibió, cobró y entregó los últimos pedidos, con datos personales ocultos.
2. ¿Qué paso repite más y dónde ocurren errores o retrasos?
3. ¿Qué herramientas utiliza y cuánto paga por cada una?
4. ¿Cómo distingue pedido, pago pendiente, pago recibido y devolución?
5. ¿Qué debe volver a registrar en otro sistema?
6. ¿Qué tendría que funcionar para cambiar ese paso? ¿Qué no está dispuesto a migrar?
7. ¿Aceptaría un piloto pagado con un entregable específico? ¿Por qué?
8. **[C7]** ¿Qué parte de sus pedidos sale contra entrega, cuántos se devuelven y quién paga el flete de vuelta?
9. **[C11]** ¿Cuánto paga hoy al mes, por separado, por tienda, facturación, mensajes y envíos? ¿Cuál de esos pagos le molesta más?

Registrar evidencia de comportamiento; no sustituirla por respuestas positivas a una descripción atractiva del producto.

### 16.3 Métricas y umbrales

ED1 propone como puntos de partida ≥60 % de herramientas completadas, ≥15 % de retorno a 30 días y señales de cuenta/premium. Son objetivos internos de la visión, no benchmarks de ecommerce observados. [S01]

| Métrica adicional propuesta | Definición | Umbral de decisión |
|---|---|---|
| Público adecuado | Comerciantes que usan la herramienta / usuarios identificados voluntariamente | Establecer tras primeras semanas; no confundir visitas con comercios |
| Tiempo por tarea | Tiempo del proceso actual frente al piloto comparable | Mejora observable, sin sacrificar exactitud |
| Activación del comercio | Publica catálogo usable o completa el flujo objetivo | Definir por tarea antes del lanzamiento |
| Pago real | Comercios que pagan / comercios que reciben oferta concreta | Validar antes de ampliar plataforma |
| Soporte por comercio | Minutos atribuibles por semana/mes | Debe caber en contribución y capacidad del equipo |
| Confiabilidad del cobro | Estados y totales reconciliados; excepciones identificadas | Ningún caso fallido debe parecer pago confirmado |
| Costo por uso | Solicitudes, filas, mensajes y servicios por tarea | Dentro de presupuesto declarado |
| Retención | Comercios activos de cohorte al período siguiente | Segmentar por frecuencia natural de la tarea |

**[V8] Los umbrales se fijan antes del día 1, no después de ver los datos.**

- El ecosistema aprendió a escribir la regla antes de medir, para no acomodarla a lo que salga (S84).
- Cada métrica de esta tabla lleva su número antes de empezar. Lo fija el dueño, con la frecuencia natural de la tarea como guía.
- «Establecer tras las primeras semanas» queda solo para lo que no se puede anticipar, y se dice cuál es.

### 16.4 Pruebas de integración necesarias

Para un piloto de pagos: estado pendiente, aprobación, rechazo, expiración, evento repetido, firma inválida, monto/moneda diferentes, demora, indisponibilidad y reembolso según el proveedor. Para catálogo: CSV inválido, variantes duplicadas, precios incoherentes, tamaño de imágenes y exportación/importación. Para SaaS: acceso entre comercios, recuperación de cuenta y restauración de datos.

Estas son pruebas propuestas. No se reportan como realizadas en este estudio.

**[V9] Lo que la plataforma del ecosistema ya prueba, y lo que le falta** (dato interno; S82, S83, S85):

- **Ya se prueba:**
  - el acceso entre clientes, con una prueba que lee cada consulta y falla si alguna no filtra por `org_id`;
  - la recuperación de cuenta, porque se entra con Google y sin contraseñas;
  - los cobros aprobados, rechazados, repetidos, con otro monto o sin regreso del comprador, en el cobro de los planes de CultivoPro;
  - la sincronización con caos: lotes repetidos, cortes a la mitad, relojes corridos, versiones viejas y cuota agotada.
- **Falta:**
  - **la restauración.** El respaldo semanal de D1 a R2 que pide ED1 §20.3 está diseñado y espera la señal del dueño; hoy la red es el Time Travel de 7 días. Ningún piloto pagado debería guardar pedidos de terceros sin un respaldo restaurado al menos una vez;
  - **un CORE que no sea solo del agro.** Su esquema fija con `CHECK` los tipos de organización, los planes, los roles y el producto de cada pago, todos del agro, y la vuelta del login y del pago solo acepta la app del agro. ED1 §5 pide un CORE que no conozca los detalles de cada producto. Darle la dimensión de producto es una migración planeada (SQLite no cambia un `CHECK` sin rehacer la tabla), no una línea.

---

## 17. Vigilancia tecnológica y comercial

### 17.1 Radar

| Área | Qué revisar | Frecuencia propuesta | Evento que cambia una decisión |
|---|---|---|---|
| Plataformas | Planes, cargos, límites, funciones y país | Mensual; antes de contratar | Cambio de costo total o elegibilidad |
| Pagos/QR | Tarifas, acceso API, firma, estados y liquidación | Mensual y por cambio contractual | Nuevas vías de confirmación o costo |
| Bre-B | Publicaciones del Banco y oferta de la entidad contratada | Mensual | API contratada útil para un pedido |
| WhatsApp | Tarifas/categorías, reglas y proveedores | Mensual | Costo que altera contribución o restricciones |
| DIAN/consumidor | Requisitos, normas y servicios oficiales | Antes de cada cambio relevante | Modificación que afecta compra/factura/posventa |
| ACP/UCP/catálogos IA | Versiones, países, acceso y requisitos | Trimestral; antes de implementar | Canal elegible con demanda o piloto concreto |
| Open source | Versiones, seguridad, licencia y dependencias | Mensual | Fin de soporte o cambio que afecta mantenimiento |
| Infraestructura | Cuotas, precio y uso propio | Mensual y alertas operativas | Cercanía a límite o cambio de free tier |
| SEO/canales | Datos de producto, políticas y resultados propios | Mensual | Errores de feed o caída medible de adquisición |
| Proveedores: dueño y marca **[C13]** | PayU en transición a Rapyd; otras compras o cambios de marca | Trimestral | Cambio de contrato, API, tarifa o soporte |
| Tasa de cambio **[C13]** | TRM para los costos en USD: Workers Paid, Shopify, Klaviyo, WhatsApp | Mensual | Variación que altera el costo total de §7.4 o el costo fijo de §13.3 |
| Marketplaces y comercio social **[C13]** | Comisiones por categoría; TikTok Shop en Colombia | Trimestral | Canal nuevo con checkout nativo o cambio de comisión |
| WhatsApp: mensajes de servicio **[C13]** | La afirmación no confirmada de un tope de 1.000 mensajes de servicio gratis al mes (§11.1) | Mensual, en la documentación oficial (S111) | Que Meta la publique: cambia el costo de atender por chat |

El registro de cambios debe conservar fecha, URL, condición anterior, condición nueva, comercios afectados y responsable de la decisión. Las páginas comerciales dinámicas conviene archivarlas cuando soporten una contratación.

### 17.2 Evidencia todavía pendiente

| Pendiente | Por qué importa | Cómo completarlo |
|---|---|---|
| Mercado colombiano de software de tienda por segmento | Tamaño comercial del vertical | Encuesta/entrevistas, fuentes con metodología y datos propios |
| Participación local por plataforma | Comparación real de líderes | Estudio representativo o censo con unidad y sesgos explícitos |
| Informe CCCE completo y detalle Q1 2026 | Base, cobertura y revisiones | Recuperar documentos oficiales completos |
| EVO AMVO 2026 íntegro | Auditoría del valor y consumidor | Descarga legítima y lectura del método |
| CAPECE 2025–2026 íntegro | Actualización de Perú | Obtener informe, evitando mezclar ediciones |
| Brasil con series accesibles | Panorama cuantitativo de un mercado clave | Exportaciones ABIACOM/NIQ con método y período |
| Contrato/tarifa Nequi QR | Caso con monto y confirmación a costo conocido | Respuesta comercial y certificación |
| API del banco/entidad Bre-B | Confirmación y referencia de pedidos | Documentación y contrato del proveedor específico |
| Wompi/PayU/PayPal/ePayco: costo final ED1 | Comparación económica homogénea | Cotización según volumen, cuenta, moneda y liquidación |
| Mensajería por comercio | Economía de automatización | Mezcla real de categorías y presupuesto |
| Demanda, CAC y disposición a pagar | Viabilidad de negocio | Embudo y pilotos pagados; la demanda de búsqueda, con el método de §12.6 **[V2]** |
| Datos comerciales de los comercios de la línea **[V1]** | Primera conducta real de pago, soporte y retención | Los da el dueño: cuáles pagan, cuánto, desde cuándo y cuánto soporte piden al mes |
| Señal del vertical inmobiliario **[V8]** | ED1 elige el primer vertical SaaS entre ecommerce e inmobiliario (S01 §33) | Un estudio equivalente, o la decisión explícita de no esperarlo |
| Licencias/versiones del stack elegido | Viabilidad técnica y de distribución | Revisión de versiones concretas antes de implementar |
| Tarifario oficial de Wompi y de PayU/Rapyd **[C13]** | Completar la comparación de §10.2 con fuentes primarias | Abrir las páginas oficiales o pedir cotización |
| Comisión de Mercado Libre Colombia por categoría **[C13]** | Comparar canales con cifras del país (§11.4) | Simulador oficial de costos |
| Peso de la contraentrega y su tasa de devolución **[C13]** | Margen real del comercio; alcance de la herramienta 1 | Entrevistas, datos de las dos tiendas 2.0 y una fuente primaria |
| Tablas de tarifas de Meta por país **[C13]** | Confirmar [V7] y [C5] en fuente primaria | Descargar las tablas enlazadas en S111 |
| Programas de aliados de pasarelas y agregadores de envíos **[C13]** | Las líneas por uso de §13.2 | Respuesta comercial de cada proveedor |
| Costo por documento de un proveedor tecnológico de factura **[C13]** | El nivel intermedio de §13.6 | Cotización |
| Factura electrónica por país: México, Brasil, Chile, Perú, Argentina **[C13]** | Expansión regional. El informe complementario la listó sin fuente primaria y por eso no entró | Fuente de cada autoridad tributaria |
| La arquitectura de la Tienda 2.0 en su versión 1.0.0 **[C13]** | Los insumos de §9.4 y §15.3 se leyeron en la 0.22.3 | Releer `ARQUITECTURA.md` de la Tienda en la versión vigente |

### 17.3 Decisión de inversión recomendada

**Autorizar experimentos de herramientas y servicios con costo controlado; condicionar el desarrollo de la tienda SaaS a uso recurrente, pagos reales y operación sostenible.** Si la señal favorece complementos, ED1 puede monetizar sin reemplazar la plataforma del cliente. Si favorece comercio social, el primer SaaS debe resolver pedidos y cobro con claridad antes de añadir funciones empresariales.

**[V1] [V8] Lo que esa decisión significa en este ecosistema:**

- La «tienda SaaS» ya existe en su forma 2.0. Lo que se condiciona es la inversión en la 3.0 sobre la plataforma (S81).
- Las condiciones son las métricas de §16.3, medidas primero con los comercios reales de la línea y después con el piloto.
- Antes de esa inversión hacen falta tres cosas de la plataforma: el respaldo restaurado, el CORE con la dimensión de producto y el HTML por producto (§16.4, §12.3).
- Esta decisión es la mitad de la de la Fase 7 de ED1. La otra mitad es la señal del inmobiliario, o la decisión explícita de no esperarla (§17.2).

---

## 18. Registro de fuentes y evidencia

**Convención:** todos los recursos externos se consultaron para este estudio al corte del 4 de octubre de 2026 en Colombia. “Sin fecha editorial confirmada” significa que no se atribuye una fecha de publicación; la observación es del contenido recuperado. Los identificadores Sxx son referencias internas del informe. No hay fuentes ficticias ni se atribuye contenido completo a un documento cuyo acceso fue parcial.

### 18.1 Mercado y documento de proyecto

| ID | Responsable y recurso | Fecha/período | Evidencia utilizada / límite |
|---|---|---|---|
| S01 | ED1 — `docs/ecosistema/historia/ECOSISTEMA-DIGITAL-ED1-v1.2.md`, en este repositorio **[V11]** | 28 sep 2026 | Público, arquitectura, principios y objetivos internos; no evidencia de mercado |
| S02 | CCCE, [Informe de cierre ecommerce 2025 / Versión pública](https://ccce.org.co/noticias/informe-de-cierre-ecommerce-2025-version-publica/) | Publicación listada 24 feb 2026; datos 2025 | Resumen de ventas, transacciones y pagos; informe completo no recuperado |
| S03 | CCCE, [Primer informe público trimestral 2026](https://ccce.org.co/noticias/primer-informe-publico-trimestral-de-comercio-electronico-2026/) | Publicación listada 20 may 2026; Q1 2026 | Crecimiento de transacciones del resumen |
| S04 | CCCE, [Publicaciones](https://ccce.org.co/publicaciones/) | Entrada de coyuntura 15 jul 2026; EMICRON 2024 | Describe universo de micronegocios y análisis de madurez; acceso al artículo completo no recuperado |
| S05 | AMVO, [Estudios](https://amvo.org.mx/estudios) y [EVO 2026](https://amvo.org.mx/descarga-evo-2026) | EVO publicado marzo 2026 | Existencia, alcance y descarga; informe completo no recuperado |
| S06 | Blog AMVO, [5 claves para mejorar eficiencia operativa en pymes](https://blog.amvo.org.mx/blog/5-claves-para-mejorar-la-eficiencia-operativa-en-pymes-de-e-commerce) | Publicación 2026; cifra de 2025 | Cifra atribuida al EVO; publicación del blog no sustituye método del informe |
| S07 | CACE, [Informe Mid Term 2026, PDF](https://cdn.shopify.com/s/files/1/0598/0176/3934/files/2026_midterm_prensa.pdf?v=1787232688) | Agosto 2026; enero–junio | Ficha de oferta, unidades, facturación y órdenes; PDF consultado |
| S08 | CCS, [Comercio electrónico en Chile alcanzó USD 10 mil millones en 2025](https://www.ccs.cl/ecommerce/comercio-electronico-chile-2025/) | Datos 2025; publicación 2026 | Resultado y revisión metodológica declarada |
| S09 | CAPECE, [Observatorio ecommerce Perú 2024–2025](https://www.capece.org.pe/observatorio-ecommerce/) | Edición 2024–2025 | Indicadores visibles de comercios, compradores y marketplaces |
| S10 | CAPECE, [Observatorio 2025–2026](https://www.capece.org.pe/congreso-observatorio-ecommerce/) | Edición anunciada 2025–2026 | Identificación de nueva edición; no se utilizó un reporte completo no recuperado |
| S11 | ABComm/ABIACOM, [Portal de datos](https://dados.abcomm.org/) | Tablero dinámico | Identificación de fuente; no serie numérica recuperable |
| S12 | US Census Bureau, [Quarterly Retail E-Commerce Sales](https://www.census.gov/retail/eCommerce.html) | Q2 2026 | Retail estadounidense ajustado estacionalmente, no por precios |
| S13 | Shopify, [Q2 2026 financial results](https://www.shopify.com/news/shopify-q2-2026-financial-results) | 5 ago 2026 | Crecimiento y escala declarada; resultados propios |
| S14 | Mercado Libre, [Resultados Q2 2026 presentados ante SEC](https://www.sec.gov/Archives/edgar/data/1099590/000109959026000021/meli-20260805xex991.htm) | Agosto 2026; Q2 | GMV del ecosistema; no mercado de software |
| S15 | VTEX, [Q2 2026 presentado ante SEC](https://www.sec.gov/Archives/edgar/data/1793663/000119312526337917/vtex_2q26_pr_6k.htm) | Q2 2026 | Tabla de GMV y resultados propios |

### 18.2 Plataformas

| ID | Responsable y recurso | Evidencia utilizada |
|---|---|---|
| S16 | Tiendanube, [Planes Colombia](https://www.tiendanube.com/co/planes-y-precios) | Planes COP, comisión de plataforma y funciones listadas; sin fecha editorial confirmada |
| S17 | Tiendanube, [Costos y planes](https://www.tiendanube.com/blog/tiendanube-costos/) | Diferencia de oferta gratuita por país; artículo 2026 |
| S18 | Shopify, [Precios Colombia](https://www.shopify.com/co/precios) | Mensual/anual, pagos externos y capacidades listadas; sin fecha editorial confirmada |
| S19 | Shopify, [Países de Shopify Payments](https://help.shopify.com/en/manual/payments/shopify-payments/supported-countries) | Elegibilidad geográfica; lista observada al corte |
| S20 | WooCommerce, [Pricing](https://woocommerce.com/pricing/) | Núcleo abierto sin suscripción/revenue share; no se usó su comparativa para atribuir tarifas a rivales |
| S21 | Jumpseller, [Planes y precios Colombia](https://jumpseller.co/sign-up/) | Funciones, 0 % general y cargo específico de suscripciones; selector tarifario ambiguo en extracción |
| S22 | Ecwid, [Planes y funciones](https://support.ecwid.com/hc/en-us/articles/207100729-Ecwid-plans-and-features) | Cuatro planes actuales; sin fecha editorial confirmada |
| S23 | Ecwid, [Cambios de precios después del 2 de marzo de 2026](https://support.ecwid.com/hc/en-us/articles/25122701806108-Changes-to-the-Ecwid-plan-pricing-after-March-2-2026) | Existencia y alcance de actualización tarifaria |
| S24 | Wix, [eCommerce features](https://www.wix.com/ecommerce/features) | Capacidades anunciadas; disponibilidad por caso no probada |
| S25 | BigCommerce, [Pricing](https://www.bigcommerce.com/pricing/) | Planes actuales, GMV y Open Payment Provider Fee |
| S26 | Adobe, [Introduction to Adobe Commerce B2B](https://experienceleague.adobe.com/en/docs/commerce-admin/b2b/introduction) | Capacidades B2B y conexión de catálogo/precios; documentación observada al corte |
| S27 | Salesforce, [Commerce Cloud](https://www.salesforce.com/commerce/) | Oferta empresarial de comercio; no tarifa contractual |
| S28 | commercetools, [Pricing](https://commercetools.com/pricing) | Oferta componible y modelo comercial; no cotización Colombia |
| S29 | PrestaShop, [Requisitos de sistema](https://devdocs.prestashop-project.org/9/basics/installation/system-requirements/) | PHP/MySQL y compatibilidad por versión; sin afirmar que una versión sea la última |
| S30 | PrestaShop, [Licencias y compatibilidad](https://www.prestashop-project.org/maintainers-guide/general-guidelines/license/) | Condiciones y compatibilidad del ecosistema |
| S31 | Odoo, [eCommerce, documentación 18.0](https://www.odoo.com/documentation/18.0/applications/websites/ecommerce.html) | Capacidades de una versión documentada; no se afirma que 18.0 sea la última |
| S32 | Medusa, [Deployment overview](https://docs.medusajs.com/learn/deployment) | Runtime y dependencias de despliegue |
| S33 | Saleor, [Repositorio oficial](https://github.com/saleor/saleor) | API, stack y BSD-3-Clause del núcleo |
| S34 | Vendure, [Repositorio oficial](https://github.com/vendurehq/vendure) | Node/TypeScript/GraphQL, despliegue y GPLv3/excepciones |
| S35 | Loja Integrada, [Cambio del plan gratis desde 11/06/2026](https://ajuda.lojaintegrada.com.br/pt-BR/articles/15447351-o-que-muda-no-plano-gratis-a-partir-do-dia-11-06-2026) | Vigilancia de cambios del plan brasileño |
| S36 | Tray, [Sitio oficial](https://site.tray.com.br/) | Oferta local de tienda/pagos/envíos; condiciones por plan |

### 18.3 Pagos y operación

| ID | Responsable y recurso | Evidencia utilizada |
|---|---|---|
| S37 | Wompi, [Eventos Colombia](https://docs.wompi.co/docs/colombia/eventos/) | Estados y validación de integridad; no se atribuye una tarifa no confirmada |
| S38 | Bold, [Webhooks](https://developers.bold.co/webhook) | Eventos, seguridad y demora de algunos productos |
| S39 | Bold, [Tarifas](https://www.bold.co/tarifas/) | Categorías online/QR; oferta observada, no cotización |
| S40 | Mercado Pago, [Notificaciones de Checkout Pro](https://www.mercadopago.com.co/developers/es/docs/checkout-pro-orders/notifications?scope=prod) | Webhooks; verificar versión de integración elegida |
| S41 | Mercado Pago, [Checkout Colombia](https://www.mercadopago.com.co/herramientas-para-vender/check-out) | Tarifa/plazo y medios descritos; otras ofertas enlazadas no se dan por vigentes |
| S42 | PayU, [API de pagos Colombia](https://developers.payulatam.com/latam/es/docs/integrations/api-integration/payments-api-colombia.html) | Integración PSE; no tarifas contractuales |
| S43 | PayPal, [Comisiones para vendedores CO](https://paypalmanager-v2.paypal.com/co/business/paypal-business-fees) | Identificación de tabla comercial; acceso parcial, sin tarifa numérica atribuida |
| S44 | ePayco, [Desarrolladores](https://epayco.com/desarrolladores/) | APIs, SDK/checkout y habilitación de servicios |
| S45 | Nequi, [API QR para negocios](https://www.nequi.com.co/negocios/api-qr) | QR con monto, consulta de estado, contrato y certificación |
| S46 | Banco de la República, [Conozca Bre-B](https://www.banrep.gov.co/es/bre-b/que-es) | QR para iniciar pago/transferencia; no API universal atribuida |
| S47 | EMVCo, [Tecnología y especificaciones QR](https://www.emvco.com/emv-technologies/qr-codes/) | Especificaciones y herramientas de evaluación; no comprobación de abono |
| S48 | Stripe, [Disponibilidad global](https://stripe.com/global) | Lista estándar de Payments observada; no confundir otros productos con Payments |
| S49 | WhatsApp/Meta, [Platform pricing](https://whatsappbusiness.com/products/platform-pricing/) | Modelo por mensaje entregado, categorías y excepciones |
| S50 | WhatsApp, [About catalog](https://faq.whatsapp.com/405903568419894/?helpref=uf_share) | Catálogo en aplicación Business |
| S51 | Siigo, [Introducción API](https://developers.siigo.com/docs/siigoapi/) | Productos, clientes y facturas |
| S52 | Alegra, [Información general API](https://developer.alegra.com/docs/informaci%C3%B3n-general) | REST, sincronización y facturas desde pedidos |
| S53 | DIAN, [Cómo facturar](https://factura-electronica.dian.gov.co/como-facturar-1.html) | Rutas gratuita, propia y proveedor; no API gratuita universal atribuida |
| S54 | DIAN, [Proveedores tecnológicos](https://micrositios.dian.gov.co/sistema-de-facturacion-electronica/proveedores-tecnologicos/) | Catálogo/habilitación; no precios |
| S55 | Envia, [Introducción API](https://docs.envia.com/docs/getting-started) | Cotización, etiquetas y seguimiento; cobertura por ruta pendiente |
| S56 | Melonn, [Integraciones](https://www.melonn.com/integraciones/) | Conexiones multicanal y API del operador |
| S57 | Mercado Libre, [Notificaciones](https://developers.mercadolibre.com.co/es_co/productos-recibe-notificaciones) | Órdenes y ubicaciones de stock |
| S58 | Banco Central do Brasil, [Pix Automático](https://www.bcb.gov.br/pix-automatico) | Pagos recurrentes; no tarifa del proveedor atribuida |
| S59 | Yape, [Yape Empresa](https://www.yape.com.pe/productos/yape-empresa) | Existencia de cobro de recaudación comercial |
| S60 | Transbank, [SDK Webpay Plus](https://proyecto-ejemplo-node.transbankdevelopers.cl/api-reference/webpay-plus) | Documentación identificada; revisión comercial incompleta |
| S61 | Addi, [Oferta para aliados](https://co.addi.com/aliados) | Oferta de financiación para comercios; testimonios no usados como prueba causal |

### 18.4 Datos, estándares, infraestructura y regulación

| ID | Responsable y recurso | Evidencia utilizada |
|---|---|---|
| S62 | Google, [Merchant listing structured data](https://developers.google.com/search/docs/appearance/structured-data/merchant-listing?hl=en) | Product/Offer y elegibilidad de experiencias |
| S63 | Google Analytics, [Measure ecommerce](https://developers.google.com/analytics/devguides/collection/ga4/ecommerce) | Eventos de ecommerce |
| S64 | GS1, [GTIN para vender online](https://www.gs1.org/industries/selling-online) y [Cómo crear GTIN](https://www.gs1.org/services/activate/how-to-create-a-GTIN) | Identificación de producto y asignación |
| S65 | Google/web.dev, [Web Vitals](https://web.dev/articles/vitals) | Métricas y umbrales; actualización editorial visible 31 oct 2024 |
| S66 | W3C, [WCAG 2.2 Recommendation](https://www.w3.org/WAI/news/2023-10-05/wcag22rec/) | Publicación del estándar, 5 oct 2023 |
| S67 | Cloudflare, [Static assets: billing and limitations](https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/) | Distinción assets/ejecución Worker |
| S68 | Cloudflare, [D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/) | Cuotas incluidas observadas |
| S69 | Cloudflare, [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/) | Cuota diaria Free; precios sujetos a revisión |
| S70 | GitHub, [Términos adicionales de productos](https://docs.github.com/en/site-policy/github-terms/github-terms-for-additional-products-and-features) | Restricciones de uso de Actions |
| S71 | Shopify, [Revenue share de apps](https://shopify.dev/docs/apps/launch/distribution/revenue-share) | Existencia de programa de reparto; no ingreso esperado ED1 |
| S72 | OpenAI, [Agentic Checkout Spec](https://developers.openai.com/commerce/specs/checkout) | ACP y disponibilidad de Instant Checkout para socios aprobados |
| S73 | Google, [Universal Commerce Protocol](https://developers.google.com/universal-commerce-protocol) | Operaciones de comercio agéntico; país/activación pendientes |
| S74 | Shopify, [About Catalogs](https://shopify.dev/docs/agents/catalog) | Catálogo global/por tienda, UCP y MCP |
| S75 | Función Pública, [Ley 1480 de 2011](https://www.funcionpublica.gov.co/eva/gestornormativo/norma.php?i=44306) | Identificación del Estatuto y artículo 50; revisión de obligaciones no exhaustiva |
| S76 | Función Pública, [Ley 2439 de 2024](https://www.funcionpublica.gov.co/eva/gestornormativo/norma.php?i=257116) | Modificación del marco de consumidor ecommerce; expedida 19 dic 2024 |
| S77 | PCI SSC, [Actualización de SAQ A](https://blog.pcisecuritystandards.org/important-updates-announced-for-merchants-validating-to-self-assessment-questionnaire-a) | Publicación 30 ene 2025; alcance de seguridad ecommerce |
| S78 | NielsenIQ/Ebit, [Webshoppers](https://nielseniq.com/global/pt/landing-page/ebit/nielseniq-ebit-brasil/webshoppers/) | Fuente brasileña identificada; no cifra 2026 atribuida |
| S79 | Bold, [Consulta de transacciones](https://www.developers.bold.co/pagos-en-linea/consulta-de-transacciones) | Consulta de estado y posible demora tras retorno del comprador |

### 18.5 Fuentes de la versión 1.1 **[V1]–[V11]**

Consultadas el 5 de octubre de 2026. S80–S87 son dato interno del ecosistema; S88–S93 son externas.

| ID | Responsable y recurso | Fecha/período | Evidencia utilizada / límite |
|---|---|---|---|
| S80 | Ecosistema, `docs/tienda/BITACORA-ecommerce.md` (copia de referencia de la bitácora de la línea ecommerce) | Hasta 30 sep 2026 | Entradas 66 y 67 (comercios reales en la Tienda Básica; dos productos), 93 (primera tienda de la 2.0 actualizada por la flota) y la de la versión 1.0.0 (decisión 36: un solo producto, la Tienda 2.0). Sin precios ni pagos de los comercios |
| S81 | Ecosistema, `docs/tienda/integracion-tienda-ecosistema.md` | 4 oct 2026 | Lo que la Tienda 2.0 hace (§1–§2) y la propuesta de la 3.0 sobre la plataforma (§4) |
| S82 | Ecosistema, `docs/ARQUITECTURA.md` | Al día con la v0.3.0, 4 oct 2026 | CORE (§5.4), celdas (§5.5), presupuesto por producto (§8.1), niveles de degradación (§8.2), seguridad (§9), ADR-7 y hallazgos para ED1 (§14) |
| S83 | Ecosistema, `docs/BACKLOG.md` | 4 oct 2026 | Capacidad del dueño (§1); cobro con Bold y factura electrónica pendiente (HU-E0.7); respaldo semanal pendiente (HU-E8.4) |
| S84 | Ecosistema, `docs/agro/validacion/busquedas-2026-12.md` | 1 oct 2026 | Método de medición de la demanda de búsqueda y su resultado en el agro |
| S85 | Ecosistema, código de la v0.3.0 | 4 oct 2026 | Migraciones del CORE (`infrastructure/migraciones/core/`); vuelta del login y del pago (`apps/core/src/entrar.ts`, `pagos.ts`); adaptador de pago (`proveedor-de-pago.ts`) y sus pruebas; Cron Triggers (`apps/core/wrangler.jsonc`, `apps/api-celda/wrangler.c0.jsonc`); precio del plan (`content/agro/cuaderno/planes.json`); prueba de aislamiento (`tests/repo/org-id-en-consultas.test.ts`) |
| S86 | Ecosistema, `docs/ecosistema/REVISION-HALLAZGOS-ED1.md` | 28 sep 2026 | [H12]: 500 MB por base y 10 bases por cuenta; [H16]: CAC en horas |
| S87 | Ecosistema, `docs/BITACORA.md` (agro) | Hasta 4 oct 2026 | «Lo que el terreno enseñó»: índices como filas escritas, 50 consultas por invocación y términos de Cloudflare §2.2.1; entrada 4 |
| S88 | Leadsales, [Precios de WhatsApp Business API en 2026](https://leadsales.io/blog/whatsapp-business-api-cuanto-cuesta/) | 2026 | Tarifas por mensaje en Colombia. Secundaria: confirmar en S49 |
| S89 | respond.io, [WhatsApp AI chatbot policy](https://respond.io/blog/whatsapp-ai-chatbot-policy) | Sin fecha editorial confirmada | Regla de Meta, desde el 15 ene 2026, para proveedores de IA. Secundaria |
| S90 | ENTER.CO, [Meta bloqueará el uso de chatbots de IA de terceros en WhatsApp a partir de 2026](https://www.enter.co/?p=577334) | Sin fecha editorial confirmada | La misma regla, en español. Secundaria |
| S91 | DIAN, [Oficio 1447 de 2019](https://normograma.dian.gov.co/dian/compilacion/docs/oficio_dian_1447_2019.htm) | 2019 | Exclusión de IVA de la computación en la nube (Estatuto Tributario, art. 476, num. 24) y sus condiciones. Consultado por resumen, no en texto completo |
| S92 | Función Pública, [Decreto 1377 de 2013](https://www.funcionpublica.gov.co/eva/gestornormativo/norma.php?i=53646) | 2013 | Art. 25: contrato de transmisión de datos personales entre responsable y encargado |
| S93 | Holland & Knight, [Ley 2439 de 2024: modificaciones al Estatuto del Consumidor](https://www.hklaw.com/en/insights/publications/2025/01/ley-2439-de-2024-modificaciones-al-estatuto-del-consumidor-en-colombia) | 13 ene 2025 | Resumen: devolución del retracto en 15 días calendario, información del producto y canal de quejas. El texto vigente es S76 |

### 18.6 Fuentes de la versión 1.3 **[C1]–[C13]**

Consultadas el 30 de septiembre de 2026 para el informe complementario, salvo S18, S99 y S111, reabiertas el 5 de octubre. «Oficial» es la página del propio proveedor o entidad; «secundaria» es un tercero que cita el dato. S131 es dato interno.

| ID | Responsable y recurso | Tipo | Evidencia utilizada / límite |
|---|---|---|---|
| S94 | Forbes Colombia, [Comercio electrónico en Colombia alcanzó $145,4 billones en ventas en 2025](https://forbes.co/2026/02/19/tecnologia/comercio-electronico-en-colombia-alcanzo-1454-billones-en-ventas-en-2025) | Secundaria | Caída acumulada del ticket desde 2020 y cifras del cuarto trimestre, atribuidas a la CCCE |
| S95 | PCMI, [Datos del mercado del comercio electrónico en Colombia](https://paymentscmi.com/insights/datos-mercado-comercio-electronico-colombia/) | Secundaria (consultora) | Enero de 2025, datos de 2024: móvil, mezcla de pagos y tráfico. Método no auditado; no se usa para TAM |
| S96 | eMarketer, [Latin America ecommerce forecast 2025](https://www.emarketer.com/content/latin-america-ecommerce-forecast-2025-growth-outlook-argentina-brazil-mexico) | Secundaria (consultora) | Estimación regional de 2025. Solo contexto |
| S97 | Infobae, [Bre-B disparó sus transacciones en Colombia](https://www.infobae.com/colombia/2026/05/06/bre-b-disparo-sus-transacciones-en-colombia-y-ya-mueve-hasta-5-millones-de-operaciones-diarias/) | Secundaria (medio) | Cifras de adopción al 4 de mayo de 2026. No describe costos ni acceso para comercios |
| S98 | Noticias Caracol, [TRM del 28 de septiembre de 2026](https://www.noticiascaracol.com/economia/dolar-hoy-28-de-septiembre-de-2026-como-esta-la-trm-lunes-en-colombia-so35) | Secundaria (medio) | TRM de COP 3.306,86 para el 26–28 de septiembre, que cita la certificación de la Superintendencia Financiera. Única tasa usada para convertir (§7.4) |
| S99 | Jumpseller, [Planes y precios, página global](https://jumpseller.com/sign-up/) | Oficial | Precios mensuales en USD, descuento anual, 0 % de comisión y funciones por plan. Reabierta el 5 oct 2026. No es la página .co de S21 |
| S100 | Website Builder Expert, [Wix pricing](https://www.websitebuilderexpert.com/website-builders/wix-pricing/) | Secundaria | Planes de Wix con comercio. No es la oferta de Colombia |
| S101 | VTEX, [Resultados del cuarto trimestre y del año fiscal 2025](https://www.businesswire.com/news/home/20260226215111/en/VTEX-Reports-Fourth-Quarter-and-Fiscal-Year-2025-Financial-Results) | Oficial (comunicado de la empresa) | GMV, ingresos, clientes e ingreso recurrente por tienda de 2025. La razón ingresos/GMV es cálculo de este estudio |
| S102 | Bemeir, [Adobe Commerce vs Salesforce Commerce Cloud](https://bemeir.com/articles/adobe-commerce-vs-salesforce-commerce-cloud-enterprise-buyers-guide/) | Secundaria (agencia) | Rangos de licencia, participación e implementación. No son tarifas de los fabricantes |
| S103 | Swell, [Salesforce Commerce Cloud pricing](https://www.swell.is/content/salesforce-commerce-cloud-pricing) | Secundaria (competidor) | Rango de implementación. Parte interesada |
| S104 | Gulupa Digital, [Cuánto cuesta una tienda WooCommerce en Colombia](https://gulupadigital.com/cuanto-cuesta-tienda-woocommerce-colombia/) | Secundaria (agencia) | Rangos de implementación en COP; oferta propia de la agencia |
| S105 | MAJU Solutions, [Cuánto cuesta un e-commerce en Colombia (2026)](https://majusolutions.co/blog/cuanto-cuesta-un-ecommerce-en-colombia/) | Secundaria (agencia) | Rangos de implementación en USD; junio de 2026 |
| S106 | Oceanico, [El costo real de Shopify para tu negocio colombiano](https://oceanico.com.co/blog/shopify-costo-real-negocio-colombiano) | Secundaria (agencia) | Estimación de gasto en apps; mayo de 2026. Sus precios de planes no se usan: manda S18 |
| S107 | ePayco, [Tarifas](https://epayco.com/tarifas/) | Oficial | Modelos agregador y gateway, retiro, disponibilidad y retención publicada |
| S108 | Puro Ingenio Samario, [Calculadora de comisiones de Wompi](https://puroingeniosamario.com.co/herramientas/calculadora-wompi-colombia/) | Secundaria | Tarifa de Wompi que usa la calculadora. La página oficial de Wompi no abrió |
| S109 | Tiendanube, [Cómo usar PayU (ahora Rapyd)](https://www.tiendanube.com/blog/como-cobrar-online-con-payu/) | Secundaria | Compra por Rapyd, tarifa y retiros de PayU en Colombia; julio de 2026 |
| S110 | Tiendanube, [Addi: cómo recibir pagos a cuotas](https://www.tiendanube.com/blog/addi/) | Secundaria | Montos, cuotas, plazos de desembolso y requisito de persona jurídica |
| S111 | Meta, [Pricing on the WhatsApp Business Platform](https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing) | Oficial | Cobro por mensaje desde el 1 jul 2025 y reglas de gratuidad. Reabierta el 5 oct 2026. Las tablas por país no se abrieron |
| S112 | Ominiflow, [WhatsApp API pricing, Colombia](https://ominiflow.com/whatsapp-api-pricing/colombia) | Secundaria | Solo se vio el título del resultado de búsqueda, que da marketing a USD 0,0125. La página no se abrió |
| S113 | FormBeep, [Meta WhatsApp Business API pricing](https://formbeep.com/whatsapp-api-pricing/) | Secundaria | Utilidad y autenticación a USD 0,0008 en Colombia. Su afirmación sobre el 1 oct 2026 no se confirmó en S111 |
| S114 | Omnisend, [Klaviyo pricing in 2026](https://www.omnisend.com/blog/klaviyo-pricing/) | Secundaria (competidor) | Precios por perfiles y cambio de facturación. Parte interesada |
| S115 | Doppler, [Precios](https://www.fromdoppler.com/en/pricing/) | Oficial | Planes por contactos, envíos y créditos; SMS por país |
| S116 | Cliengo, [Cliengo vs Leadsales](https://guiawabusiness.cliengo.com/comparativas/cliengo-vs-leadsales) | Secundaria (parte interesada) | Modelos de cobro de ambos. Sin precios |
| S117 | Alegra, [Precios de facturación electrónica](https://www.alegra.com/colombia/facturacion-electronica/precios/) | Oficial | Cuatro planes, topes de ingreso y lo incluido |
| S118 | Alegra, [Cómo deben facturar las pymes en Colombia 2026](https://blog.alegra.com/colombia/como-deben-facturar-las-pymes-en-colombia/) | Secundaria (proveedor) | UVT y umbrales de 2026. No reemplaza a la DIAN (S53) |
| S119 | Programas Contabilidad, [Precios de software contable en Colombia 2026](https://programascontabilidad.com/comparativas-de-software/precios-de-software-contable-colombia-2026/) | Secundaria (comparador) | Rangos de Alegra, Siigo y Loggro |
| S120 | Andrey Business, [Servientrega o Interrapidísimo o Coordinadora 2026](https://www.andreybusiness.com/blog/servientrega-vs-coordinadora-vs-interrapidisimo-2026) | Secundaria | Rangos de flete, recaudo, liquidación y entregas. Fuente única; la presenta como ilustrativa |
| S121 | Melonn, [Costos: 3PL vs operación propia en Colombia](https://www.melonn.com/colombia/fulfillment/costos-3pl-vs-propio/) | Oficial (afirmación propia) | Ahorro declarado y umbral de pedidos. Sin tarifas |
| S122 | Éxito, [Marketplace](https://www.exito.com/marketplace) | Oficial | Comisión por categoría, pago semanal y logística |
| S123 | Falabella, [Cuánto cuesta vender en falabella.com](https://www.falabella.com.co/falabella-co/page/cuanto-cuesta-vender-en-falabella) | Oficial | Comisión por categoría y cobros logísticos, sin cifras en la página |
| S124 | Anytools, [Cómo vender en Falabella](https://anytools.global/blog/como-vender-en-falabella/) | Secundaria | Rango de comisión y descuento inicial; julio de 2026 |
| S125 | Jaguar Sheet, [Comisiones de Mercado Libre 2026](https://jaguarsheet.com/es/blog/comisiones-mercado-libre) y Wivo, [Cuánto cobra Mercado Libre por venta](https://www.wivoanalytics.com/blog/cuanto-cobra-mercado-libre-por-venta-en-2025-guia-completa-de-comisiones-envios-y-mas) | Secundarias | Argentina y Chile. No describen Colombia |
| S126 | Rappi, [Cuánto cobra Rappi a los comercios](https://merchants.rappi.com/es-co/cuanto-cobra-rappi-a-los-restaurantes) | Oficial | Comisión por venta informada en el registro; publicidad opcional |
| S127 | M2E Cloud, [TikTok Shop across LatAm](https://blog.m2ecloud.com/tiktok-shop-across-latam-where-it-s-live-and-what-s-coming/) | Secundaria | Estado por país a diciembre de 2025. No se usa su fecha de lanzamiento en México |
| S128 | Cloudflare, [Workers: limits](https://developers.cloudflare.com/workers/platform/limits/) | Oficial | Workers por cuenta, CPU, Cron Triggers y solicitudes |
| S129 | Cloudflare, [D1: limits](https://developers.cloudflare.com/d1/platform/limits/) | Oficial | Bases por cuenta, tamaño y consultas por invocación |
| S130 | Cloudflare, [Cloudflare for SaaS: plans](https://developers.cloudflare.com/cloudflare-for-platforms/cloudflare-for-saas/plans/) | Oficial | Hostnames personalizados incluidos y precio del adicional |
| S131 | Ecosistema, `ARQUITECTURA.md` de la Tienda Panel | Dato interno | Versión 0.22.3, con referencias hasta la 0.25, entregada por el dueño el 30 sep 2026. Anterior a la 1.0.0 vigente: lo que se toma de ella se verifica antes de usarse |
| S132 | Informe «Ecommerce en Colombia y Latinoamérica: funcionalidades, proveedores, precios y modelos de monetización» | Informe complementario | 30 sep 2026. Origen de [C1]–[C13]; lo que no entró está en §20.2 |
| S133 | BytechHub, [Pasarelas de pago en Colombia 2026](https://bytechhub.com/blog/pasarelas-de-pago-en-colombia-comparativa-2026/) | Secundaria (comparador) | Rango de Wompi; junio de 2026 |

---

## 19. Control editorial de afirmaciones

| Afirmación que se evita | Formulación que sí permite la evidencia |
|---|---|
| “El mercado colombiano de SaaS ecommerce vale COP 145,4 billones” | Esa es una cifra de ventas online publicada para 2025, no ingresos de software |
| “Todas las plataformas tienen las mismas funciones” | Hay capacidades documentadas con condiciones por plan, país y producto |
| “Tiendanube es gratis en Colombia” | La página colombiana revisada publica planes de pago |
| “Open source equivale a costo total cero” | Núcleo, infraestructura, operación y extensiones son partidas diferentes |
| “El QR válido prueba que pagaron” | La estructura y la confirmación bancaria son comprobaciones distintas |
| “Una API Nequi QR garantiza pagos sin comisión” | La capacidad está documentada; tarifa y contrato deben confirmarse |
| “UCP/ACP habilitan cualquier comercio inmediatamente” | Hay protocolos documentados y requisitos de activación comercial |
| “Hay demanda comprobada para el SaaS ED1” | La oportunidad es una hipótesis que requiere pilotos y pago real |
| “Los datos de distintos países son un TAM LATAM homogéneo” | Los períodos, denominadores y métodos no son directamente sumables |
| “Los escenarios son ingresos esperados” | Son aritmética de supuestos declarados, sin probabilidad ni demanda estimada |
| “ED1 todavía no tiene una tienda” **[V1]** | El ecosistema opera tiendas con comercios reales y tiene un producto vigente, la Tienda 2.0 |
| “Una tienda cabe gratis en la cuota de Cloudflare” **[V3]** | Las cuotas gratuitas son de la cuenta y se comparten con CultivoPro; queda un solo Cron Trigger libre |
| “Avisar por WhatsApp es caro” **[V7]** | En Colombia, un mensaje de utilidad cuesta unos USD 0,0008, según una fuente secundaria; lo que cuesta es habilitar el canal |
| “La pasarela cuesta 3 %” **[C4]** | El costo depende del ticket, del plazo en que se recibe el dinero y de cargos fuera de la comisión; el orden entre pasarelas cambia con el ticket |
| “Desde octubre de 2026 WhatsApp cobra los mensajes de servicio” **[C5]** | Lo afirma una fuente secundaria; la documentación oficial leída el 5 de octubre de 2026 no lo recoge |
| “VTEX cobra 1,2 % de las ventas” **[C2]** | Sus ingresos de 2025 equivalen a cerca del 1,2 % del GMV que declara; no es una tarifa |
| “Los escenarios de costo total son cotizaciones” **[C10]** | Son aritmética con tarifas públicas, una tasa de cambio fechada y supuestos declarados |
| “ED1 ganará un porcentaje de los pagos, las guías y los mensajes” **[C9]** | Son líneas hipotéticas; no se confirmó ningún programa ni contrato |
| “La contraentrega cuesta 2 %” **[C7]** | Ese es el rango observado del recaudo; el costo mayor es el pedido que no se entrega |
| “Una tienda propia es más cara que un marketplace porque tiene mensualidad” **[C8]** | Los marketplaces revisados publican 6–20 % por venta; la comparación depende del volumen y del tráfico propio |

**Conclusión de inversión:** comprobar un problema pequeño, frecuente y pagable del comerciante; convertir la operación validada en producto. El estudio permite orientar esa elección con evidencia documental y delimita expresamente lo que todavía no se sabe. **[V1]** En este ecosistema, la comprobación empieza por los comercios que ya atiende y por la plataforma que ya corre, no desde cero.


---

## 20. Anexo — Complementos de la versión 1.3

La versión 1.3 no cambia el resultado principal, las recomendaciones ni la decisión de inversión de la 1.2. Les agrega cifras de costo que faltaban y deja por escrito qué del informe complementario se descartó. [S132]

### 20.1 Qué entró y dónde

| Complemento | Qué agrega | Secciones | Evidencia predominante |
|---|---|---|---|
| **[C1]** | Peso en el retail, caída del ticket, móvil, mezcla de pagos, tráfico, adopción de Bre-B; estimación regional | §4.1, §4.2 | CCCE y fuentes secundarias |
| **[C2]** | Precios de Jumpseller y Shopify Plus verificados; Wix; rangos empresariales y de agencias; tasa efectiva de VTEX | §6.3, §7.1 | Oficial y secundaria |
| **[C3]** | Contraentrega, canal conversacional y medición como básicos; cómo se reparte lo básico y lo premium entre planes | §8.1, §8.4 | Oferta observada |
| **[C4]** | Tarifas de ePayco, Wompi, PayU y plazos de Mercado Pago y Bold; el mismo cobro en dos tickets; PayU → Rapyd; Addi | §10.2, §10.5 | Oficial y secundaria |
| **[C5]** | Reglas de cobro de WhatsApp en fuente primaria; alerta descartada; herramientas de marketing | §11.1, §11.6 | Oficial |
| **[C6]** | Precios de facturadores y umbrales de 2026 | §11.2 | Oficial y secundaria |
| **[C7]** | Fletes, recaudo contraentrega, liquidación y entregas efectivas | §11.3 | Secundaria, fuente única |
| **[C8]** | Comisiones de marketplaces y estado de TikTok Shop | §11.4 | Oficial y secundaria |
| **[C9]** | Modelos de monetización con su evidencia; tres líneas por uso como hipótesis | §13.1, §13.2 | Inferencia e hipótesis |
| **[C10]** | Escenarios de costo total para tres tamaños de comercio | §7.4 | Inferencia sobre oferta observada |
| **[C11]** | Ancla de precio, cuatro niveles hipotéticos e ilustración de ingreso por comercio | §13.6 | Hipótesis |
| **[C12]** | Límites oficiales de Cloudflare; el horneado en Actions; insumos para la 3.0 | §9.4, §15.3 | Oficial y dato interno |
| **[C13]** | Radar, pendientes y afirmaciones que se evitan | §17.1, §17.2, §19 | — |

Además, sin etiqueta propia: seis términos de búsqueda (§12.6), campos de la herramienta 1 (§15.2) y dos preguntas de entrevista (§16.2).

### 20.2 Qué no entró, y por qué

| Contenido del informe complementario | Decisión | Razón |
|---|---|---|
| Precios de Shopify: Basic USD 39, Grow USD 105 y 0,5 % en Advanced | No se heredan | Venían de una fuente secundaria. La página de Colombia, reabierta el 5 oct 2026, da USD 25, 65 y 399, con 2 %, 1 % y 0,6 % (S18). Los escenarios se recalcularon (§7.4) |
| «Desde el 1 de octubre de 2026 solo los primeros 1.000 mensajes de servicio son gratis» | No se usa; al radar | La documentación oficial de Meta no lo recoge (§11.1) |
| Escenario empresarial con tarifas de cobro negociadas | Fuera | Las tarifas eran supuestos sin fuente |
| Costo de «4 % a 5 % de las ventas» como hallazgo | Reemplazado por §7.4 | Se recalculó con tarifas oficiales y sin IVA de la comisión, para ser coherente con §13.4 |
| Tabla de factura electrónica por país | A pendientes (§17.2) | Sin fuente primaria revisada |
| Proveedores nombrados sin página abierta: Mipaquete, Aveonline, 99minutos, Treble y otros | No se registran como fuente | El estudio solo registra lo que se abrió (§18) |
| Ruta de migración de la tienda por etapas | Reemplazada | Decisión del dueño del 5 oct 2026: la 3.0 se diseña desde cero y los datos se cargan con scripts. Quedan tres insumos (§15.3) |
| Diagrama de arquitectura objetivo y hoja de ruta de fases | Fuera | Pertenecen a `docs/tienda/TIENDA-3.0.md`, no al estudio de mercado. Sus umbrales no tenían base medida |
| Posicionamiento «kit para vender por WhatsApp» y tabla frente a competidores | Fuera | Es propuesta de producto sin validación; el estudio ya trata el comercio social como hipótesis de entrada (§6.1, §15.3) |
| Estimaciones de consultoras como tamaño de mercado | Solo contexto | §2.2 no admite cifras sin método accesible para un TAM |
| «Un 3PL ahorra 15–30 %» como hecho | Entra como afirmación del proveedor | Es Melonn hablando de su propio servicio (§11.3) |
| «El ARPU objetivo es COP 349.000» | Entra invertido | Tres cuartas partes dependen de líneas sin confirmar; el ingreso planeable es la suscripción (§13.6) |

### 20.3 Dónde coinciden los dos trabajos

Hechos con métodos distintos, coinciden en: las cifras de la CCCE para 2025; los precios de Tiendanube Colombia y su 0 % de comisión; el tarifario de Bold; las tarifas de WhatsApp para Colombia; que Shopify Payments no está en Colombia y que eso encarece a Shopify para un comercio local; que GitHub Actions no debe procesar datos de clientes; y que el costo de la infraestructura no es el costo que decide. La coincidencia no convierte lo secundario en primario, pero indica que los complementos no contradicen la base del estudio.
