# Estudio de mercado y vigilancia tecnológica de herramientas de ecommerce
## Colombia, Latinoamérica y referentes globales — Implicaciones para ED1

**Versión:** 1.0  
**Fecha de corte:** 4 de octubre de 2026, hora de Colombia.  
**Documento de referencia:** `ECOSISTEMA-DIGITAL-ED1-v1.2.md`, versión del 28 de septiembre de 2026, suministrado por el usuario.  
**Naturaleza del trabajo:** investigación documental de fuentes públicas; análisis competitivo, tecnológico y económico; recomendaciones e hipótesis de validación.  
**Alcance temporal:** información accesible al corte. No representa resultados de todo octubre ni del cierre de 2026.  
**Moneda:** COP, MXN, ARS o USD según cada fuente; no se convierten cifras entre monedas sin una tasa y fecha explícitas.

> **Resultado principal del análisis:** ED1 tiene una oportunidad que merece validación en herramientas operativas para pequeños comercios colombianos que venden por WhatsApp, redes y tiendas existentes. La investigación no demuestra todavía disposición a pagar por otra plataforma de tiendas. Conviene comprobar primero la utilidad recurrente de resolver catálogo, precio, pedido, cobro y conciliación, y decidir después si se construye un SaaS de ecommerce completo.

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

### 1.2 Recomendaciones para ED1 — juicio del consultor

- **Entrada inicial:** calculadora de rentabilidad por pedido, preparación de catálogo y cotizador/pedido para WhatsApp, con procesamiento local cuando sea posible.
- **Primer producto de pago a contrastar:** administración sencilla de pedidos y conciliación, con exportación de datos y conexiones a proveedores existentes.
- **Alternativa de monetización temprana:** implementación, preparación de catálogo y automatización acotada para comercios; convertir lo repetible en software después de observar varios casos.
- **Posponer:** marketplace propio, OMS empresarial, logística propia, motor contable/fiscal completo y agentes autónomos que ejecuten pagos sin controles comerciales probados.
- **Mantener la premisa ED1:** infraestructura sin gasto recurrente durante validación, dentro de cuotas. Contabilizar aparte pagos, mensajería, IA, soporte y trabajo humano.

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

Se priorizaron fuentes primarias: gremios, autoridades, responsables de los estándares, documentación de fabricantes y reportes de las propias empresas. El blog de AMVO se utiliza con una salvedad expresa: la cifra mexicana allí atribuida al EVO 2026 no sustituye la revisión integral de su base metodológica. No se utilizaron estimaciones anónimas ni cifras de consultoras sin acceso al método para calcular un TAM de software.

### 2.3 Procedimiento y cobertura

1. Lectura de ED1 para identificar público, restricciones y modelo de crecimiento.
2. Búsqueda de publicaciones 2025–2026 y revisión de páginas oficiales de producto.
3. Apertura de documentos y verificación específica de moneda, período, planes y condiciones relevantes.
4. Contraste de fuentes que podían inducir errores: precios regionales, cargo de plataforma frente a procesamiento de pago, datos nominales frente a reales, API pública frente a contratación comercial.
5. Construcción de matrices, diagnóstico e hipótesis de validación.

Se revisaron proveedores representativos, no todos los productos existentes. El registro final contiene 79 entradas: el documento ED1 y 78 referencias externas, algunas con más de un recurso enlazado. Algunas páginas son dinámicas y no contienen una fecha editorial verificable; se identifican como observaciones al corte, no como archivos históricos certificados.

### 2.4 Límites que afectan la decisión

- No se realizaron entrevistas, encuestas propias, compras de prueba ni implementaciones en sandbox. El estudio establece un mapa documental, no una certificación de funcionamiento.
- No se obtuvieron cifras comparables de participación de plataformas de tienda específicamente en Colombia. Volumen global, tiendas declaradas, tráfico y participación de software son métricas distintas.
- No se estimaron volumen de búsqueda, CPC, CAC, conversión o disposición a pagar de ED1. Deben medirse.
- No se suman cifras nacionales de distinto alcance para producir un supuesto mercado LATAM comparable.
- El tablero brasileño consultado no expuso en la extracción una serie numérica utilizable; no se rellenó con una proyección de prensa.
- El resumen CCCE fue accesible; los enlaces a sus informes completos no se recuperaron. Las cifras se atribuyen a ese resumen y no se supone conocer toda su metodología.
- La edición CAPECE 2025–2026 se identificó, pero no se recuperó su informe completo. Se distingue de los datos visibles de la edición 2024–2025.
- Los precios pueden variar por impuestos, periodicidad, promoción, volumen, tipo de negocio y negociación. No se prometen tarifas de contratación.

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
| Owner-first | Edición y administración por el comerciante | ¿Una operación cotidiana todavía requiere al desarrollador? |

**Inferencia:** una herramienta que prepara el catálogo o identifica pérdidas por pedido puede atraer al mismo usuario que luego necesita pedidos e inventario. Una herramienta genérica con tráfico alto pero sin presencia de comerciantes puede aportar menos al vertical ecommerce. Debe probarse mediante segmentación voluntaria y observación de uso, no asumirse por el nombre de la herramienta.

### 3.2 Dos ventas que deben mantenerse separadas

ED1 puede vender una suscripción a un comerciante; ese comerciante, a su vez, vende productos a sus clientes. Son relaciones distintas. Sus cobros, facturas, impuestos, devoluciones, credenciales y reportes no deben mezclarse. El ingreso bruto procesado por una tienda tampoco es ingreso de ED1.

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

---

## 8. Estado del arte funcional

Las siguientes matrices son una **síntesis de requisitos y diseño** a partir del panorama revisado, no una lista de funciones incluidas por todos los proveedores.

### 8.1 Capacidades básicas de una tienda operable

| Dominio | Capacidad mínima | Criterio de aceptación propuesto | Prioridad ED1 |
|---|---|---|---|
| Catálogo | Producto, precio, SKU interno, imágenes, categorías | El comerciante publica y corrige sin editar código | Alta si se valida catálogo |
| Variantes | Talla/color u otras opciones con SKU y stock | El pedido conserva variante y precio correctos | Alta para productos físicos |
| Experiencia | Móvil, navegación y búsqueda proporcional al catálogo | El cliente encuentra y entiende el producto | Alta |
| Carrito | Cantidades, subtotal y desglose | El total se recalcula con reglas de servidor al cobrar | Alta en fase transaccional |
| Pedido | Identificador, cliente, ítems, totales y estados | Se puede reconstruir qué se compró y qué falta | Alta |
| Cobro | Medio local y estado verificable | No se marca pagado por una captura o un retorno del navegador | Alta |
| Entrega | Dirección, retiro/entrega, costo y seguimiento | El cliente conoce costo y condiciones antes de confirmar | Alta |
| Inventario | Existencia y cambios por operación | Se previenen o identifican sobreventas | Según frecuencia de pedidos |
| Administración | Acceso, roles básicos y auditoría | Cada comercio ve solo sus datos | Alta al ofrecer SaaS |
| Posventa | Contacto, novedades, devoluciones y reembolsos | Hay proceso y registro, no solo una página de compra | Alta |
| Datos | Exportación de catálogo, clientes y pedidos | Se obtiene una copia utilizable sin intervención del desarrollador | Alta |
| SEO | URLs, metadatos, sitemap y contenido de producto | Datos visibles y estructurados consistentes | Alta |
| Seguridad | TLS, secretos, validación y respaldo | No hay credenciales privadas en el frontend | Alta |
| Analítica | Eventos y resultado comercial | Pedido enviado, pago aprobado y entrega se distinguen | Alta |

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

Cloudflare documenta solicitudes gratuitas e ilimitadas para assets estáticos y distingue la ejecución del script Worker. D1 Free publica 5 millones de filas leídas al día, 100.000 escritas y 5 GB de almacenamiento incluido. Workers Free publica 100.000 solicitudes al día; las condiciones se deben comprobar antes de cada expansión. [S67–S69]

**Propuesta ED1:** estimar llamadas, filas leídas/escritas, almacenamiento y mensajes por comercio activo; mantener límites por producto y comercio, alertas, exportación y un modo de degradación explícito. Un escaneo sin índice o un webhook repetido puede consumir más presupuesto que la interfaz pública.

GitHub Actions sirve para construcción, pruebas y despliegue del software. Sus términos identifican como uso indebido, entre otros, su utilización como CDN o parte de una aplicación serverless con carga desproporcionada. No debe convertirse en el procesador de pedidos o archivos de clientes para eludir costos de ejecución. [S70]

### 9.5 Licencias, portabilidad y dependencia

- Distinguir el núcleo, plugins, temas, servicios cloud y marcas: cada uno puede tener condiciones diferentes.
- Saleor publica BSD-3-Clause. Vendure publica GPLv3 y explica excepciones de plugins y separación de consumidores de su API. PrestaShop dispone de una guía de compatibilidad de licencias. Esto no autoriza a atribuir una licencia única a todo el stack. [S30, S33–S34]
- Mantener un modelo exportable de producto, variante, cliente, pedido y evento de pago.
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

### 10.3 Tres garantías diferentes sobre QR

| Nivel | Qué puede comprobar | Qué evidencia requiere | Qué queda fuera |
|---|---|---|---|
| Lectura y validación de formato | Que el contenido se decodifica y corresponde al esquema soportado | Decodificador, especificación y casos de prueba | Identidad legítima del beneficiario y recepción de dinero |
| Comparación con datos esperados | Si monto/identificadores coinciden con un pedido o referencia confiable | Pedido canónico o referencia obtenida de canal confiable | Confirmación de abono |
| Confirmación de pago | Que el proveedor reporta estado final y datos consistentes | API/evento autenticado y conciliación | Garantía absoluta frente a disputas o reversión posterior |

EMVCo publica especificaciones para QR de pago y herramientas de autoevaluación de cumplimiento. La validación estructural no es prueba bancaria de autenticidad ni de pago recibido. Un control de errores como un CRC, cuando existe en el esquema, no debe venderse como firma digital: puede volver a calcularse sobre un contenido modificado. [S47; conclusión técnica sobre alcance de validación]

**Propuesta de posicionamiento para ED1:** indicar exactamente “contenido leído”, “formato soportado”, “monto coincide/no coincide con la referencia” o “estado confirmado por proveedor”. Evitar la etiqueta “transferencia verificada” si solo se ha procesado una fotografía o el texto de un QR.

Este estudio no revalida los QR específicos mencionados en conversaciones anteriores: en esta solicitud se recibió el documento ED1, no esos archivos ni una integración bancaria operativa.

### 10.4 Flujo técnico recomendado — propuesta

1. El servidor recalcula precio, envío y total; crea una orden con referencia única.
2. Un adaptador solicita el cobro al proveedor contratado, con la moneda y el importe esperados.
3. El cliente abre el checkout o QR emitido mediante el canal soportado.
4. El backend recibe un evento validado o consulta el estado por API.
5. Se comprueban referencia, comercio, importe, moneda y estado; se deduplica el evento.
6. Se actualiza el pedido y se gestionan pendientes, expirados, duplicados, devoluciones y discrepancias.

La API QR Nequi documenta consulta de estado; no se le atribuye un webhook específico no comprobado. La documentación de Bold advierte que ciertas notificaciones pueden demorarse hasta diez minutos. La interfaz debe contemplar el estado pendiente, no depender del retorno inmediato al navegador. [S38, S45, S79]

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

---

## 11. Integraciones, servicios y operación comercial

### 11.1 WhatsApp: tres capas distintas

| Capa | Alcance | Costo/condición que debe distinguirse |
|---|---|---|
| Enlace para abrir conversación | Llevar al cliente a un chat con mensaje preparado | No aporta automáticamente confirmación de pedido, inventario o pago |
| Aplicación WhatsApp Business | Catálogo y herramientas del negocio | Operación desde la aplicación; no equivale a una integración backend |
| WhatsApp Business Platform | Mensajería programática y automatización | Cobro por mensajes entregados según mercado/categoría; reglas y excepciones |

La documentación oficial describe catálogo en la app y un modelo por mensaje para Platform, con mensajes de servicio y ciertos mensajes de utilidad en respuesta al usuario sin cargo de Meta. Puede existir además costo del proveedor intermediario. No se recuperó una tarifa única aplicable a cualquier automatización colombiana. [S49–S50]

**Propuesta ED1:** empezar con mensajes preparados y estados de pedido propios. Adoptar Platform cuando se demuestre ahorro de atención y la contribución por pedido soporte su costo. Diferenciar el costo del canal de una función de IA que atienda esos mensajes.

### 11.2 Facturación y contabilidad

DIAN describe tres rutas: solución gratuita, desarrollo propio y proveedor tecnológico autorizado. Que exista un sistema gratuito no demuestra una API universal gratuita que una tienda pueda consumir sin habilitación. Su catálogo identifica proveedores autorizados, no tarifas de integración. [S53–S54]

Siigo documenta APIs de productos, clientes y facturas. Alegra describe sincronización de contactos/productos y creación de facturas desde pedidos mediante REST. La elegibilidad de la cuenta, plan, localización y factura electrónica debe comprobarse por cliente. [S51–S52]

**Propuesta:** integrar o exportar hacia el sistema que ya usa el comerciante. Una cotización, cuenta de cobro o PDF de pedido no debe rotularse como factura electrónica DIAN si no cumple el proceso fiscal correspondiente.

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

### 11.4 Marketplaces y venta multicanal

Mercado Libre documenta notificaciones de órdenes y cambios de ubicaciones de stock. Esto permite analizar conectores, pero no equivale a sincronización perfecta sin desarrollo, autorización y manejo de errores. [S57]

La integración necesita declarar cuál sistema manda sobre producto, precio, existencia y estado de pedido. Se deben definir reservas, reintentos, límites de API y reconciliación periódica. La compatibilidad con un marketplace es una obligación de mantenimiento continuo.

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

### 12.2 Comercio mediante agentes: alcance comprobado

- **ACP/OpenAI:** la especificación describe sesiones de checkout; construir con el protocolo está abierto, mientras Instant Checkout requiere aprobación del socio. [S72]
- **UCP/Google:** la documentación ofrece operaciones de identidad, carrito, checkout, pedidos y lealtad, conectadas con sus superficies de IA. La página general no basta para afirmar habilitación en Colombia. [S73]
- **Shopify:** documenta un catálogo global y uno por tienda para agentes, con capacidad de catálogo UCP e interfaces MCP. [S74]

**Inferencia:** la calidad del catálogo, las reglas de disponibilidad y una API fiable adquieren relevancia adicional. La respuesta ED1 de corto plazo debería ser preparar datos y operaciones portables; no gastar en varios protocolos antes de demostrar canal, elegibilidad e ingreso. MCP es una interfaz para herramientas, no por sí mismo un sistema de pago ni un mecanismo completo de autorización comercial.

### 12.3 SEO, feeds y datos de producto

Google documenta marcado `Product`/`Offer` para experiencias de merchant listing. La elegibilidad no garantiza que un producto aparezca ni sustituye la consistencia del precio, disponibilidad, entrega y contenido visible. [S62]

GS1 explica la asignación de GTIN y su uso en canales de venta. ED1 puede verificar formatos o generar la representación gráfica de un identificador legítimo; no debería inventar GTIN comerciales y venderlos como asignaciones válidas de GS1. Un SKU interno es otra cosa. [S64]

**Herramientas propuestas:** verificador local de CSV, diagnóstico de fichas, generador de sitemap para catálogo, comprobador de consistencia de precio/disponibilidad y preparador de feeds. Requieren especificaciones vigentes y límites claros; no se deben presentar como certificación de aprobación del canal.

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

---

## 13. Monetización y economía unitaria

### 13.1 Cómo monetiza el ecosistema competitivo

La oferta revisada muestra suscripciones por plan, cobros por funciones/uso, cargos asociados a pagos, apps y servicios. Shopify documenta un programa específico de reparto de ingresos para desarrolladores de apps. No se presupone que ese programa aplique a cualquier proveedor o que ED1 cumpla ya sus requisitos. [S16, S18, S21, S25, S49, S71]

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

### 13.3 Fórmulas de control

Para la suscripción ED1:

`Ingreso neto por comercio = precio cobrado − descuentos − impuestos recaudados por cuenta de terceros − comisión de recaudo − reembolsos`

`Contribución por comercio = ingreso neto − infraestructura atribuible − mensajería − IA − otros servicios variables − soporte variable`

`Punto de equilibrio de comercios = costos fijos mensuales / contribución mensual positiva por comercio`

`CAC = gasto atribuible de adquisición / nuevos comercios pagadores atribuibles`

`Recuperación de CAC = CAC / contribución mensual de la cohorte`

Para una operación de tienda, medir margen de producto después de costos de pago, empaque, envío subsidiado, devolución y publicidad. Para LTV, usar cohortes y retención observada; no asumir permanencia indefinida ni extrapolar un mes sin cancelaciones.

### 13.4 Escenarios ilustrativos: no son previsión de ingresos

| Escenario hipotético | Comercios pagadores | Precio mensual supuesto | Facturación bruta aritmética |
|---|---:|---:|---:|
| Piloto pagado | 10 | COP 29.000 | COP 290.000/mes |
| Validación ampliada | 50 | COP 39.000 | COP 1.950.000/mes |
| Operación inicial | 200 | COP 49.000 | COP 9.800.000/mes |

Los precios no se derivan de una encuesta ni se recomiendan como tarifa final. No incluyen impuestos, recaudo, cancelaciones, adquisición, soporte ni consumo. Si la contribución hipotética fuera COP 25.000 por comercio y los costos fijos COP 1.000.000/mes, el equilibrio aritmético sería 40 comercios. Si el soporte reduce esa contribución a cero, aumentar clientes no resuelve el modelo.

Para publicidad en herramientas: `ingreso = vistas monetizables / 1.000 × RPM observado`. Sin RPM propio no se calcula ingreso esperado. Las vistas de compradores dentro de tiendas no deben confundirse con audiencia monetizable de utilidades.

### 13.5 Qué puede sostener una ventaja

**Inferencia estratégica:** bajo costo de infraestructura puede facilitar la validación, pero no es una barrera suficiente. Una ventaja más defendible puede surgir de plantillas y datos locales, una tarea mejor resuelta, distribución propia, soporte eficiente, confianza verificable y conectores mantenidos. El número de herramientas por sí solo no prueba que exista ese activo.

---

## 14. Confianza, privacidad y requisitos regulatorios

### 14.1 Colombia

El Estatuto del Consumidor —Ley 1480— incluye disposiciones sobre comercio electrónico. La Ley 2439 de 2024 modifica ese marco y establece medidas de protección en ese canal. Debe utilizarse el texto vigente para implementar obligaciones; una plantilla antigua de términos no basta. [S75–S76]

| Área de revisión propuesta | Requisito de producto que conviene preparar | Comprobación pendiente |
|---|---|---|
| Identificación del vendedor | Datos y canales de contacto del comercio | Información exigible según operación |
| Oferta/precio | Producto, total, envío y condiciones claros | Impuestos y forma de presentar el precio |
| Compra | Resumen, aceptación y evidencia del pedido | Conservación y obligaciones aplicables |
| Posventa | Flujo de consultas, reclamos, devoluciones y reversión | Plazos, excepciones y texto vigente |
| Datos personales | Finalidad, permisos, retención y controles por comercio | Roles de ED1/comerciante/proveedores y régimen aplicable |
| Facturación | Integración o proceso de emisión | Obligación y habilitación del comerciante |
| Comunicaciones | Consentimientos y preferencias | Reglas del canal y de contacto comercial |

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
| Lectura/comparación local de QR | Alta para el caso del proyecto | Bajo–medio | Desconocida | Describir límites de lo comprobado | P1, piloto controlado |
| Validador de datos de producto/feed | Alta para tiendas existentes | Medio | Media | Especificación y diagnóstico actualizados | P1 |
| Historial y bandeja de pedidos | Alta | Medio | Alta | Autenticación, aislamiento y exportación | P1 tras comprobar uso |
| Conciliación con proveedor contratado | Alta | Medio–alto | Alta | Acceso, costos y fuente bancaria fiable | P1 condicionada |
| Conector contable | Alta | Medio–alto | Alta | Plan y localización fiscal del cliente | P2 |
| Tienda alojada completa | Alta | Alto | Alta | Soporte, checkout, inventario y posventa | P2 tras piloto pagado |
| Marketplace propio | Indeterminada | Muy alto | Indeterminada | Dos lados del mercado, liquidación y disputas | Posponer |
| Suite empresarial componible | Baja para validación inicial | Muy alto | Dependiente de contratos | Implementación y operación complejas | Posponer |

P0 = comprobar primero; P1 = siguiente experimento o dependencia; P2 = inversión posterior a evidencia.

### 15.2 Paquete inicial propuesto

**Herramienta 1 — Rentabilidad del pedido:** precio, costo de producto, cargo de pago editable, empaque, envío y descuento. Resultado descargable y explicación de supuestos. Monetización posterior: escenarios guardados, lotes y conexión con ventas reales.

**Herramienta 2 — Catálogo listo para vender:** importar CSV, señalar campos faltantes, revisar variantes, preparar imágenes y exportar por destino. Monetización posterior: historial, plantillas y sincronización.

**Herramienta 3 — Cotización/pedido para WhatsApp:** producto, cantidad, entrega y vigencia; producir mensaje y documento legible. Monetización posterior: seguimiento, estados y colaboración.

**Herramienta 4 — Diagnóstico de ficha/tienda:** evaluar datos de producto, claridad del precio, contacto y consistencia técnica según reglas verificables. Monetización posterior: informe, lote o servicio de mejora.

**Herramienta 5 — Lectura y comparación de QR:** empezar por decodificación y formato soportado, con monto comparado contra referencia aportada. Mantener separada una futura integración de confirmación bancaria. Solo lanzar después de validar decodificación, mensajes y límites con ejemplos legítimos.

El paquete conserva el objetivo ED1 de cinco herramientas iniciales, pero sus integrantes deben ajustarse a entrevistas y uso real. Si el QR atrae principalmente compradores ajenos al público pagador, no asumir que tiene el mismo valor de embudo que catálogo/pedidos.

### 15.3 Dos caminos tras la validación

| Camino | Condición de elección | Producto resultante |
|---|---|---|
| Complementos para tiendas existentes | El problema persiste con plataforma y el cliente no quiere migrar | Utilidades premium, app, conector o servicio |
| Comercio social y pedidos | Hay operación frecuente fuera de una tienda y pago por ordenarla | Catálogo/pedidos/conciliación con tienda opcional |

Ambos pueden compartir datos y herramientas. No necesitan una plataforma universal antes de tener usuarios.

---

## 16. Plan de validación comercial y técnica

### 16.1 Primeros 90 días — propuesta

| Período | Trabajo | Evidencia exigida | Decisión |
|---|---|---|---|
| Días 1–15 | 15–20 entrevistas con comercios de al menos dos segmentos | Ejemplos de tareas, frecuencia, tiempo y alternativa actual | Seleccionar problema concreto |
| Días 16–30 | Prototipos de las primeras utilidades; acompañar 5–10 usos reales | Resultado utilizable, errores y tiempo ahorrado | Publicar/iterar o descartar |
| Días 31–45 | Publicación de 3–5 herramientas y contenido propio | Completado, público, retorno y siguiente necesidad | Elegir la herramienta de entrada |
| Días 46–60 | Piloto asistido con historial/pedidos; solicitar pago por alcance concreto | Pago real, soporte y uso recurrente | Validar monetización o revisar propuesta |
| Días 61–75 | Una integración de pago o administración, si hay contrato y necesidad | Pruebas de estado, duplicados, fallos y exportación | Confirmar confiabilidad y costo |
| Días 76–90 | Análisis de cohortes y economía | Retención, contribución y dependencia del soporte | Elegir complemento, SaaS acotado o pivote |

Los tamaños de muestra sirven para descubrimiento y pilotos, no para estimar con representatividad estadística la demanda nacional.

### 16.2 Preguntas de entrevista

1. Muestre cómo recibió, cobró y entregó los últimos pedidos, con datos personales ocultos.
2. ¿Qué paso repite más y dónde ocurren errores o retrasos?
3. ¿Qué herramientas utiliza y cuánto paga por cada una?
4. ¿Cómo distingue pedido, pago pendiente, pago recibido y devolución?
5. ¿Qué debe volver a registrar en otro sistema?
6. ¿Qué tendría que funcionar para cambiar ese paso? ¿Qué no está dispuesto a migrar?
7. ¿Aceptaría un piloto pagado con un entregable específico? ¿Por qué?

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

### 16.4 Pruebas de integración necesarias

Para un piloto de pagos: estado pendiente, aprobación, rechazo, expiración, evento repetido, firma inválida, monto/moneda diferentes, demora, indisponibilidad y reembolso según el proveedor. Para catálogo: CSV inválido, variantes duplicadas, precios incoherentes, tamaño de imágenes y exportación/importación. Para SaaS: acceso entre comercios, recuperación de cuenta y restauración de datos.

Estas son pruebas propuestas. No se reportan como realizadas en este estudio.

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
| Demanda, CAC y disposición a pagar | Viabilidad de negocio | Embudo y pilotos pagados |
| Licencias/versiones del stack elegido | Viabilidad técnica y de distribución | Revisión de versiones concretas antes de implementar |

### 17.3 Decisión de inversión recomendada

**Autorizar experimentos de herramientas y servicios con costo controlado; condicionar el desarrollo de la tienda SaaS a uso recurrente, pagos reales y operación sostenible.** Si la señal favorece complementos, ED1 puede monetizar sin reemplazar la plataforma del cliente. Si favorece comercio social, el primer SaaS debe resolver pedidos y cobro con claridad antes de añadir funciones empresariales.

---

## 18. Registro de fuentes y evidencia

**Convención:** todos los recursos externos se consultaron para este estudio al corte del 4 de octubre de 2026 en Colombia. “Sin fecha editorial confirmada” significa que no se atribuye una fecha de publicación; la observación es del contenido recuperado. Los identificadores Sxx son referencias internas del informe. No hay fuentes ficticias ni se atribuye contenido completo a un documento cuyo acceso fue parcial.

### 18.1 Mercado y documento de proyecto

| ID | Responsable y recurso | Fecha/período | Evidencia utilizada / límite |
|---|---|---|---|
| S01 | ED1 — `ECOSISTEMA-DIGITAL-ED1-v1.2.md`, archivo suministrado | 28 sep 2026 | Público, arquitectura, principios y objetivos internos; no evidencia de mercado |
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

**Conclusión de inversión:** comprobar un problema pequeño, frecuente y pagable del comerciante; convertir la operación validada en producto. El estudio permite orientar esa elección con evidencia documental y delimita expresamente lo que todavía no se sabe.
