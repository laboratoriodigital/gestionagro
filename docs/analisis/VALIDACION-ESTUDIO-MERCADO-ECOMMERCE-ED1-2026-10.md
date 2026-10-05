# Validación del estudio de mercado de ecommerce a la luz del ecosistema digital

_5 de octubre de 2026. Valida `ESTUDIO-MERCADO-ECOMMERCE-ED1-2026-10.md` (versión 1.0, corte del 4 oct 2026) contra dos cosas:_

- _ED1: `docs/ECOSISTEMA-DIGITAL-ED1-v1.2.md` y sus hallazgos [H1]–[H16] (`docs/REVISION-HALLAZGOS-ED1.md`)._
- _Lo que el ecosistema ya construyó, midió o decidió: la línea ecommerce y su Tienda 2.0 (`docs/BITACORA-ecommerce.md`), la plataforma que corre en producción con CultivoPro (`docs/ARQUITECTURA.md` y el código del CORE y de la celda, v0.3.0), el análisis de la Tienda 3.0 (`integracion-tienda-ecosistema.md`) y el método de demanda de búsqueda (`docs/validacion/busquedas-2026-12.md`)._

_Los ajustes ya están aplicados en el estudio, que pasa a la versión 1.1. Cada cambio lleva la etiqueta de su hallazgo, por ejemplo **[V3]**. Los hallazgos se numeran V para no chocar con [H1]–[H16] de ED1 ni con HA1–HA4 de ARQUITECTURA §14._

## Conclusión, primero

**El estudio está bien hecho, y lo que afirma del mercado se sostiene donde se pudo comprobar. Lo que no conocía es el ecosistema por dentro, y eso cambia su pregunta principal.**

- **Su método es el mejor que tiene hoy el ecosistema para estudiar un mercado.** Cada cifra lleva fuente y tipo de evidencia, los límites se dicen y hay una lista de afirmaciones que se evitan. Conviene usarlo de plantilla. Las cifras que se comprobaron de nuevo coinciden: el cierre 2025 de la CCCE (COP 145,4 billones, 684,6 millones de transacciones, +11,1 % en valor y +19,9 % en número) y el contenido de la Ley 2439 de 2024.
- **Solo leyó ED1.** No sabía tres cosas:
  1. El ecosistema **ya opera tiendas**: hay dos tiendas 2.0 en operación (dato del dueño, 5 oct 2026, §5), con cobro por Bold, y la 2.0 es el único producto vigente.
  2. **Ya tiene la plataforma** que el estudio da por construir: cuentas, organizaciones y roles; cobro con adaptador y conciliación; aislamiento por cliente; cuotas vigiladas.
  3. Ya hay **un análisis que recomienda la Tienda 3.0** sobre esa plataforma.
- **Por eso su pregunta ya no es la del dueño.** El estudio pregunta «¿se construye un SaaS de tiendas?». La pregunta real es **«¿se sigue con la 2.0 más herramientas, o se invierte en la 3.0, y con qué señal?»**. La señal que el estudio pide (pago real, soporte por comercio, retención, cobro confiable) se puede **empezar a medir ya** con los comercios reales de la línea, antes de cualquier piloto nuevo. Son pocos, así que no reemplazan el piloto; pero son conducta real, no respuestas de entrevista.

Cinco ajustes de fondo:

1. **[V1]** Reconocer lo que el ecosistema ya tiene y empezar a medir con los comercios reales de la línea ecommerce.
2. **[V2]** Medir la demanda de búsqueda de cada herramienta con el método que ya usó el agro, antes de construirla.
3. **[V3]** Corregir una cuota que ED1 ya había corregido y sumar las restricciones reales de la cuenta: cuotas compartidas con CultivoPro y un solo Cron Trigger libre.
4. **[V4]** Aplicar la economía unitaria a los planes del propio ecosistema: con la tarifa que observó el estudio, la comisión de Bold se lleva más del 5 % de un plan de COP 39.000 cobrado mes a mes.
5. **[V5]** Rehacer el paquete de cinco herramientas: tres encajan con ED1 §10.4, una necesita servidor y la del QR puede prometer más de lo que comprueba.

Y seis precisiones:

- **[V6]** La tienda alojada entrega HTML por producto.
- **[V7]** WhatsApp: la tarifa que faltaba y la regla de Meta sobre IA.
- **[V8]** Fases y umbrales de ED1.
- **[V9]** El CORE todavía habla de fincas.
- **[V10]** Datos personales, términos y antiabuso.
- **[V11]** Correcciones menores.

## 1. Criterio

- Se evalúa el estudio con su propio método (§2.2: dato publicado, capacidad documentada, oferta observada, inferencia, hipótesis, no confirmado) y contra ED1 y el estado del ecosistema.
- Un hallazgo es lo que cambia una decisión, una prioridad o una cifra. Lo demás va en correcciones menores.
- Lo que sale del repositorio se marca **Dato interno**, una etiqueta nueva que el estudio adopta en su versión 1.1. Es comprobable, pero describe al ecosistema, no al mercado.
- Ningún ajuste agrega gasto recurrente. Varios lo evitan.
- Dos cosas no se pudieron comprobar porque el acceso estaba bloqueado: los precios de Tiendanube Colombia y el tarifario de Bold. Se usan los valores que observó el estudio, con su fuente (S16 y S39), y se dice cada vez.

## 2. Lo que se confirma y conviene conservar

| Del estudio | Lo confirma el ecosistema |
|---|---|
| El método: jerarquía de evidencia, registro de fuentes y «afirmaciones que se evitan» (§2.2, §18, §19) | Es la regla P18 de las bitácoras («un documento no lanza una excepción cuando miente») llevada a un estudio de mercado. Mejor que el del estudio de mercado del agro, que no distinguía el tipo de cada cifra |
| «Dos ventas que deben mantenerse separadas» (§3.2) | Es la distinción central del análisis de la Tienda §4.3: en CultivoPro vende Laboratorio Digital; en una tienda vende el comercio, con su propio Bold |
| El flujo de cobro de §10.4: monto en el servidor, evento o consulta verificada, deduplicar, estados pendientes | Es lo que CultivoPro construyó con Bold (HU-E0.7): monto de `planes.json`, firma en el CORE, verificación con la API de Bold, conciliación cada 15 min y estado «revisar» si el monto no coincide |
| Las tres garantías del QR (§10.3) | Es P1 («el fallo que funciona es el caro»): lo que parece verificado y no lo está es el error más caro |
| La promesa de privacidad delimitada (§14.3) | ED1 §3.3 y [H7]. CultivoPro la vuelve prueba: una e2e compara lo que la política declara con lo que cada página carga |
| GitHub Actions no procesa pedidos ni archivos de clientes (§9.4) | ED1 §15.1 y [H6], y la regla que CultivoPro cumple con su reporte semanal de cifras agregadas (ADR-16) |
| Herramientas de rentabilidad y de cotización/pedido por WhatsApp como entrada (§15.2) | Son las prioridades de ED1 §10.4: margen, precio y punto de equilibrio; cotizaciones y cuentas de cobro; enlaces y mensajes de WhatsApp |
| Posponer marketplace, OMS, logística propia y agentes que pagan solos (§1.2) | ED1 §36: no se agrega una capa sin justificar la anterior |
| Infraestructura sin gasto recurrente en validación, con presupuesto por producto (§9.4) | ED1 §3.9 y §25.1; ARQUITECTURA §8 |

## 3. Hallazgos

### V1 · El estudio trata el ecommerce como terreno nuevo; el ecosistema ya opera tiendas y tiene la plataforma

**Qué dice el estudio.**

- Su resultado principal: la investigación «no demuestra todavía disposición a pagar por otra plataforma de tiendas»; conviene «decidir después si se construye un SaaS de ecommerce completo».
- En su priorización (§15.1), «Tienda alojada completa» tiene costo técnico «Alto» y queda en P2, «tras piloto pagado».
- §2.4 dice que no hubo entrevistas ni implementaciones. Su única fuente sobre el proyecto es ED1 (S01).

**Qué tiene el ecosistema (dato interno).**

- **La línea ecommerce, con comercios reales.**
  - **Dos tiendas 2.0 en operación**, según el dueño (5 oct 2026, §5).
  - *Corrección:* la primera redacción de esta validación las ubicaba en la línea anterior, la «Tienda Básica», por las entradas 66 y 67 de la bitácora ecommerce. El dato vigente es el del dueño.
  - La **Tienda 2.0** («Tienda Panel», 1.0.0, 30 sep 2026) es hoja de Google, Apps Script y un Worker por tienda, con catálogo horneado, cobro con Bold y una flota por anillos en `laboratoriodigital/tiendas`. Su primera tienda ya se despliega y se actualiza con esa flota (entrada 93).
  - La decisión 36 deja un solo producto, la 2.0. Los comercios se migran a ella uno por uno, y la 3.0 empieza de cero desde `TRASLADO-3.0.md` (entrada de la versión 1.0.0).
- **La plataforma**, en producción con CultivoPro (v0.3.0):
  - CORE con Google, organizaciones, membresías y roles; tokens Ed25519 verificados en cada celda.
  - Datos de cada cliente en shards de D1, con `org_id` en cada fila y una prueba que lo exige en cada consulta.
  - Cobro con Bold detrás de un adaptador, con conciliación cada 15 min.
  - Kill switch por producto, vigía de cuota y reporte semanal.
- **El análisis de la Tienda 3.0** (`integracion-tienda-ecosistema.md`, 4 oct 2026; ARQUITECTURA §14, HA4): construirla sobre esa plataforma, con cada tienda como una fila y no como un repositorio.

**Por qué importa.**

- **La evidencia que el estudio pide en §16.3 se empieza a medir hoy** con esos comercios, sin piloto nuevo y sin escribir código: si pagan y cuánto, cuántos minutos de soporte piden al mes, si siguen y cuántos cobros necesitaron revisión a mano. Son dos: sirven para descubrir, no para estimar demanda, y no reemplazan el piloto pagado de §16.1.
- **La tienda alojada no cuesta «alto desde cero».** El CORE, el cobro, el aislamiento, el despliegue y la operación ya existen. Lo que falta es lo que nombra el análisis de la Tienda: el panel del comerciante, el catálogo horneado por tienda, los dominios propios, el correo y la migración. Son meses de trabajo, de costo **medio**, no alto.
- **A los dos caminos de §15.3 les falta el que ya está en marcha:** mantener la 2.0 y migrarla a la 3.0 cuando se cumplan condiciones.

**Ajuste.**

- Nueva §3.3, «Lo que el ecosistema ya tiene».
- Con eso se reescriben el resultado principal, §1.2, §15.1 (fila «Tienda alojada completa»), §15.3 (tercer camino), §16.1 (los comercios reales de la línea entran en los días 1–15), §17.2 y §17.3.
- La jerarquía de evidencia de §2.2 suma la etiqueta **Dato interno**.

### V2 · Falta medir la demanda de búsqueda, y el ecosistema ya tiene el método

**Qué dice el estudio.** «No se estimaron volumen de búsqueda, CPC, CAC, conversión o disposición a pagar de ED1. Deben medirse» (§2.4). Aun así, §12.5 abre su tabla de canales con el «SEO de intención operativa».

**Qué tiene el ecosistema.** HU-E0.2 (`docs/validacion/busquedas-2026-12.md`):

- Unos 25 términos en Keyword Planner, para Colombia y siete países de LATAM.
- Cada cifra con su tipo: V verificada, R rango, E estimación.
- **Una regla de decisión escrita antes de ver los datos**: demanda = Colombia + 0,3 × LATAM; desempate por cercanía al producto que se paga; veto a lo que no se puede publicar sin revisión.
- **Cambió una decisión.** La herramienta que el estudio del agro ponía primera no tenía búsquedas en ninguna de sus cuatro formas, y la segunda herramienta pasó a ser otra.
- **Dejó una lección de escala:** los 25 términos del agro suman unas 750 búsquedas al mes en Colombia (en rangos).

**Por qué importa.**

- ED1 hace de las impresiones en Search Console una condición para pasar de la Fase 1 (§19.1), y pide «potencial de búsqueda» como tercer filtro de toda herramienta (§34). Una herramienta sin búsquedas no pasa esa puerta, por buena que sea.
- Medir cuesta unas horas y se hace antes de construir.

**Ajuste.**

- Nueva §12.6, «Medir la demanda antes de construir»: la lista de términos por herramienta para pegar en Keyword Planner y la regla de decisión, fijada desde ya.
- La medición es la puerta de los días 1–15 de §16.1.

### V3 · Cuotas: una cifra que ED1 ya había corregido y cuatro restricciones reales de la cuenta

**Qué dice el estudio (§9.4).** «D1 Free publica 5 millones de filas leídas al día, 100.000 escritas y 5 GB de almacenamiento incluido. Workers Free publica 100.000 solicitudes al día».

**Qué dice el ecosistema.**

- **Los 5 GB son por cuenta, no por base.** El límite de diseño es 500 MB por base, con 10 bases por cuenta (ED1 §41, [H12]). ED1 corrigió esta misma confusión el 28 sep 2026.
- **D1 cuenta cada entrada de índice como fila escrita** (bitácora agro, «Lo que el terreno enseñó»). Un pedido que entra a una tabla con dos índices son 3 filas, así que las 100.000 escrituras diarias son unas 33.000 inserciones de ese tipo. Además, una invocación del Worker gratuito admite 50 consultas a D1.
- **Las cuotas son de la cuenta, y ya tienen dueño.** La cuenta del ecosistema (celda c0) atiende a CultivoPro, que declaró hasta el 25 % de las solicitudes al Worker y el 21 % de las filas escritas (ARQUITECTURA §8.1). Un producto de ecommerce en la misma cuenta declara su parte y su kill switch (ED1 §25.1).
- **No se abre otra cuenta gratuita para ganar cuota.** Lo prohíben los términos de Cloudflare, §2.2.1(c) (HA1; bitácora agro 4). Escalar es pasar a Workers Paid, USD 5 al mes (ADR-7).
- **Queda un solo Cron Trigger libre.** El plan gratuito da 5 por cuenta (ED1 §41), y ya hay 4: el CORE y la API de la celda, cada uno en producción y en staging (`apps/core/wrangler.jsonc`, `apps/api-celda/wrangler.c0.jsonc`). Una tienda que concilie pagos o libere por tiempo las unidades apartadas necesita un cron. Tiene dos salidas: compartir el despachador (ED1 §7.1) o pasar a Workers Paid.

**Ajuste.** §9.4 corregida, con esas restricciones y con lo que ya existe para vigilarlas: el vigía horario de cuota y sus niveles de degradación (ARQUITECTURA §8.2).

### V4 · Cobro y economía unitaria: el estudio diseñó lo que ya está construido, y su tarifa de Bold aplica a los planes del propio ecosistema

**Qué dice el estudio.**

- El flujo de §10.4: monto en el servidor, adaptador, evento validado o consulta por API, deduplicar, estados pendientes.
- Las tarifas observadas de Bold (§10.2): tarjetas, 2,99 % + COP 900; PSE, Bancolombia y billeteras, 2,89 % + COP 900.
- Las fórmulas de §13.3 y los escenarios de §13.4: COP 29.000 a 49.000 al mes, con costos fijos de COP 1.000.000 al mes.

**Qué tiene el ecosistema.**

- **Ese flujo ya corre.** CultivoPro cobra su plan Finca con Bold (HU-E0.7):
  - el monto sale de `planes.json`;
  - la firma se calcula en el CORE;
  - la verdad se le pregunta a la API de Bold;
  - una conciliación cada 15 min activa a quien pagó y no volvió (`apps/core/src/proveedor-de-pago.ts`).
- La Tienda 2.0 cobra con Bold desde antes.
- **El proveedor que ED1 §5.3 pide elegir ya está elegido.** El adaptador permite cambiarlo.
- **El plan Finca cuesta COP 39.000 al mes**, un mes a la vez y sin débito automático (`content/agro/cuaderno/planes.json`).

**Cálculo (inferencia, con la tarifa que observó el estudio en S39 y antes del IVA de la comisión):**

| Cobro | Comisión | Peso sobre lo cobrado |
|---|---:|---:|
| COP 39.000 por PSE o billetera | 2,89 % + 900 = COP 2.027 | 5,2 % |
| COP 39.000 con tarjeta | 2,99 % + 900 = COP 2.066 | 5,3 % |
| COP 29.000 por PSE (el escenario más bajo del estudio) | COP 1.738 | 6,0 % |
| COP 468.000 por PSE (doce meses de una vez) | COP 14.425 | 3,1 % |

La lección del estudio sobre los tickets bajos (§7.3) vale para ED1 mismo: cobrar mes a mes sin débito automático paga la tarifa fija doce veces al año.

**Faltan tres cosas para cobrar en serio, en los dos productos:**

- **Factura electrónica DIAN** del propio ecosistema: pendiente con el contador (BACKLOG HU-E0.7).
- **IVA.** Un servicio que cumpla las condiciones de la DIAN para la computación en la nube está excluido (Estatuto Tributario, art. 476, numeral 24). Si no las cumple, lleva el 19 %, y eso cambia el ingreso neto de §13.3. *No confirmado: lo decide el contador.*
- **Términos y condiciones** de los planes pagos: ED1 §20.1 los pide y todavía no existen.

**Dos entradas más para las fórmulas de ED1:**

- Mientras la adquisición sea orgánica, el CAC se mide en horas del dueño ([H16], ED1 §18).
- El costo fijo real de la validación no es COP 1.000.000 en efectivo. Son USD 0 a 5 de infraestructura al mes y las horas del dueño (unas 20 a la semana, según el BACKLOG §1), que ED1 §25 declara como el límite real del presupuesto.

**Ajuste.**

- §10.4 dice qué ya está construido y qué le falta a la tienda: las llaves de Bold de cada comercio (análisis de la Tienda, §4.3).
- §13.3 suma las entradas de ED1: comisión fija, IVA o exclusión, y CAC en horas.
- §13.4 usa la estructura de costos real y propone, como hipótesis, el prepago trimestral o anual.
- §14.1 suma los términos, la factura y el IVA del propio ecosistema.

### V5 · El paquete de cinco herramientas

| # | Herramienta (§15.2) | Contra ED1 y el ecosistema | Ajuste |
|---|---|---|---|
| 1 | Rentabilidad del pedido | ED1 §10.4 la pone entre las prioritarias (margen, precio de venta, punto de equilibrio). Corre 100 % en el navegador | Se queda, y suma el **costo de cobrar** con tarifas fechadas por proveedor: las de §10.2, que el radar de §17.1 revisa cada mes. Es la pregunta local que mejor se puede responder con contexto colombiano |
| 2 | Catálogo listo para vender | ED1 §10.4: catálogos de WhatsApp | Se queda. Exporta primero al **formato de catálogo del ecosistema**: las columnas de la hoja «Catálogo» de la Tienda, que el cuaderno de CultivoPro ya produce. Después, a los de Tiendanube, Shopify y WooCommerce. Un solo contrato de producto (P2, una sola fuente) |
| 3 | Cotización o pedido para WhatsApp | ED1 §10.4: cotizaciones y cuentas de cobro; enlaces y mensajes de WhatsApp | Se queda. Lo que lleve datos del comprador viaja en el fragmento `#` del enlace, nunca en la ruta ni en la consulta (P13, un secreto no viaja por donde queda escrito), como las invitaciones de CultivoPro |
| 4 | Diagnóstico de ficha o tienda | Leer la tienda de otro desde una URL no se puede hacer en el navegador (CORS). Haría falta un Worker que descargue páginas ajenas: costo, 10 ms de CPU y riesgo de proxy abierto. ED1 §15.1: en validación, solo herramientas 100 % en el navegador | Trabaja sobre lo que el comerciante exporta o pega: CSV, feed o HTML. Leer una URL espera a que un ingreso lo pague |
| 5 | Lectura y comparación de QR | El estudio la pone en P1, «piloto controlado» (§15.1), pero la mete en el paquete de P0 (§15.2): se contradice. Además, la pregunta del comerciante es «¿me llegó la plata?», y un decodificador no la responde (P1, «el fallo que funciona es el caro»; P20, lo que se ofrece tiene que llegar por el camino de quien lo usa). El «QR para negocios» de ED1 §10.4 es otra herramienta: generar un QR para el catálogo, el chat o el link de pago | Sale del paquete inicial y queda como piloto controlado. El quinto lugar lo decide la medición de [V2], entre candidatos del estudio y de ED1 §10.4 |

### V6 · La tienda alojada tiene que entregar HTML por producto

**Qué dice el estudio.** El SEO tiene prioridad alta (§8.1: URLs, metadatos, sitemap y contenido de producto), y el marcado `Product`/`Offer` habilita las fichas en Google (§12.3, S62).

**Qué dice el ecosistema.**

- ED1 pide title, description, canonical, Open Graph y schema en cada página (§12), y que todo lo público sea estático (§3.10).
- La bitácora agro lo volvió regla: P20, «el rastreador que no ejecuta JavaScript», con el SEO horneado en el HTML.
- La Tienda 2.0 hornea el HTML de cada tienda.
- Pero el análisis de la 3.0 propone «la página, igual para todas», con el catálogo como JSON en R2 (§4 y §4.2, punto 1). Las fichas se pintarían en el navegador, sin `Product`/`Offer` ni Open Graph en el HTML.
- Google y la vista previa de un enlace en WhatsApp, que es el canal principal del ICP, verían una página sin producto.

**Ajuste.**

- **En el análisis de la Tienda** (§4 y §4.2, punto 1): al publicar, se hornea en R2 el HTML de cada ficha, con su JSON-LD y su Open Graph, además del JSON. El Worker resuelve la tienda por el `Host` y entrega ese archivo. Lo común (estilos y scripts) sigue como asset estático gratuito.
- **En el estudio** (§12.3): queda como requisito de la tienda alojada.

### V7 · WhatsApp e IA: la tarifa que faltaba y una regla de Meta

**Qué dice el estudio.**

- §11.1: «No se recuperó una tarifa única aplicable a cualquier automatización colombiana».
- §12.1: la «atención asistida» con IA, como prioridad posterior.

**Qué se encontró** (5 oct 2026, en una fuente secundaria que cita la tabla de Meta; confirmar en la página de Meta, S49, antes de contratar):

- **Tarifas en Colombia, por plantilla entregada:** marketing, USD 0,0125; utilidad, USD 0,0008; autenticación, USD 0,0008.
  - Las de utilidad no se cobran dentro de la ventana de 24 h de atención.
  - Un proveedor intermediario puede sumar su margen y una cuota.
- **Regla de Meta desde el 15 ene 2026:** no deja usar WhatsApp Business Platform a los proveedores de IA cuando un asistente de IA de propósito general es la función principal.
  - Sigue permitida la IA que una empresa usa para atender a sus propios clientes.
  - Siguen permitidas las automatizaciones estructuradas: confirmar un pedido, recordar un pago.

**Por qué importa.**

- Avisar el estado de 300 pedidos al mes, con tres mensajes de utilidad cada uno, cuesta unos USD 0,72 al mes. El costo del canal no es la barrera.
- Las barreras son la verificación del negocio, las plantillas aprobadas, el consentimiento del comprador y la cuota del intermediario.
- Un «asistente de IA de ED1 por WhatsApp» como producto propio cae en la zona que Meta prohibió. La IA dentro de la atención de cada comercio, no.

**Ajuste.** §11.1 y §12.1 con esas cifras y esa regla. El radar de §17.1 ya vigila WhatsApp cada mes.

### V8 · Fases y umbrales de ED1: el ecommerce compite con el inmobiliario, y el plan de 90 días mezcla fases

**Qué dice el estudio.** Un plan de 90 días (§16.1) que en un trimestre publica herramientas (Fase 1 de ED1), suma historial (Fase 3) y pide pago (Fase 4). De ED1 toma los umbrales de completado y de retorno (§16.3).

**Qué dice ED1.**

- Cada fase tiene una condición medible a 90 días (§19.1).
- No se agrega una capa sin justificar la anterior (§36).
- El primer vertical SaaS es «el vertical (ecommerce o inmobiliario) con más señal en las fases 2–4» (§33, Fase 7).

**Por qué importa.**

- **El estudio es la evidencia de un solo lado** de la decisión de la Fase 7. El inmobiliario no tiene estudio, y la decisión tiene que decirlo.
- **Juntar tres fases en 90 días contradice ED1**, salvo que se declare como excepción, igual que el agro con el ADR-2. Aquí la excepción tiene mejor razón que la del agro:
  - el ecommerce **sí** es el ICP de ED1 (ED1 §2.1);
  - las cuentas y el cobro ya existen, así que el piloto no pide plataforma nueva.
- **Los umbrales de §16.3 «se establecen tras las primeras semanas».** El ecosistema aprendió a fijarlos **antes** de ver los datos, para no acomodarlos a lo que salga (`busquedas-2026-12.md`, regla).

**Ajuste.**

- §16.1 suma la fase de ED1 de cada tramo.
- §16.3 pide declarar los umbrales numéricos antes del día 1 y deja el lugar para que el dueño los fije.
- §17.3 registra que la decisión de la Fase 7 necesita también la señal del inmobiliario, o la decisión explícita de no esperarla.

### V9 · La plataforma existe, pero su CORE todavía habla de fincas

**Qué dice el estudio.** Pide administración con roles y aislamiento por comercio (§8.1), un esquema pequeño con aislamiento (§9.2) y pruebas de acceso entre comercios, de recuperación de cuenta y de restauración de datos (§16.4).

**Qué tiene el ecosistema (código, v0.3.0).**

- **Ya resuelto, y se reutiliza:**
  - `org_id` en cada fila, con una prueba que lee cada consulta de la celda y falla si alguna no lo filtra (`tests/repo/org-id-en-consultas.test.ts`);
  - la matriz de permisos como dato, la misma en el servidor y en el teléfono;
  - un formato de exportación portable (`agro-export v1`);
  - la batería de caos de la sincronización.
- **Todavía es del agro.** El esquema del CORE fija con `CHECK` los valores de un solo producto:
  - `organizacion.tipo` solo admite finca, asesor y cadena;
  - `plan` y `interes_plan.plan`, los planes del agro;
  - `membresia.rol`, propietario, supervisor, operario, asesor y auditor;
  - `pago.producto`, solo `agro`.
  - Y la vuelta del login y del pago solo acepta pantallas de `/agro/app/` (`apps/core/src/entrar.ts`, `pagos.ts`).
  - ED1 §5 pide lo contrario: «el CORE no debe conocer detalles específicos de cada producto».
- **Pendiente:** el respaldo semanal de D1 a R2 que pide ED1 §20.3 (HU-E8.4) espera la señal del dueño. Hoy la única red es el Time Travel de 7 días.

**Por qué importa.**

- El aislamiento por comercio, la parte difícil, ya está.
- Pero «agregar un tipo» (análisis de la Tienda, §4.1) es más que eso. SQLite no cambia un `CHECK` sin rehacer la tabla, así que darle la dimensión de producto a la organización, el plan y el rol es una migración planeada: expandir, migrar y contraer (ARQUITECTURA §7.4), escribiendo antes de borrar (P21). No es una línea.
- Ningún piloto pagado de ecommerce debería guardar pedidos de terceros sin un respaldo que se haya restaurado al menos una vez (P16).

**Ajuste.**

- §8.1 suma la columna «En el ecosistema hoy».
- §16.4 nombra lo que ya se prueba y lo que falta.
- En el análisis de la Tienda, la fila del CORE de §4.1 dice el alcance real.

### V10 · Datos personales, términos y antiabuso: con la tienda alojada, el papel de ED1 cambia

**Qué dice el estudio.** Una agenda (§14.1) en la que «roles de ED1/comerciante/proveedores y régimen aplicable» queda como comprobación pendiente, con la Ley 2439 de 2024 como marco.

**Qué dice el ecosistema.**

- **ED1 pasa a ser encargado del tratamiento.**
  - En la 2.0, los datos de los compradores viven en la hoja de Google del comercio.
  - En una tienda alojada (la 3.0) vivirían en la base de ED1. Laboratorio Digital sería encargado del tratamiento de cada comercio, que es el responsable (Ley 1581 de 2012).
  - Eso pide un contrato de transmisión de datos con cada comercio (Decreto 1377 de 2013, art. 25) y una política que lo diga.
  - La política de CultivoPro solo cubre el agro y espera revisión de abogado.
- **La Ley 2439 de 2024 recae en el comercio, que es el vendedor.** Lo obliga a devolver el dinero del retracto en máximo 15 días calendario, a informar el producto con claridad y a ofrecer un canal de quejas fácil de encontrar. La tienda alojada tiene que hacer posibles esas obligaciones (S76).
- **Un servicio que publica tiendas de terceros recibe tiendas fraudulentas.** ED1 §14.1 ya trae las defensas para el contenido de terceros:
  - un dominio registrable separado para las tiendas sin dominio propio;
  - términos de uso, reporte, `abuse@` y suspensión con un clic.
  - Bold verifica a cada comercio al abrirle su cuenta, pero eso no protege la reputación del dominio del ecosistema.

*Requiere revisión de un abogado.*

**Ajuste.** §14.1 con esas filas. §15.1 suma el antiabuso a la condición de la «Tienda alojada completa». En el análisis de la Tienda, §4.2 (punto 2) lo dice para los dominios.

### V11 · Correcciones menores

1. **Documento de referencia.** ED1 está en el repositorio (`docs/ECOSISTEMA-DIGITAL-ED1-v1.2.md`); ya no es un «archivo suministrado». El encabezado y S01 lo dicen.
2. **Una cita que nadie puede comprobar.** §10.3 cerraba con «los QR específicos mencionados en conversaciones anteriores». Un documento del repositorio no puede apoyarse en una conversación que el repositorio no tiene (P18). Queda una frase neutra.
3. **«Owner-first».** En ED1, el *owner* es el dueño del ecosistema (ED1 §3.7), no el comerciante. Que el comerciante se atienda solo sirve a ese principio porque cada pedido que necesita al desarrollador consume las horas del dueño (ED1 §25). §3.1 del estudio lo precisa.
4. **Un nombre, un significado (P2).** En el ecosistema, «producto» ya es el contrato de una herramienta o un SaaS (`product.yaml`, `schemas/product.schema.json`). El producto de un comercio necesita otro nombre en el código y en los esquemas de la tienda. §9.5 lo anota.

## 4. Ajustes aplicados

### 4.1 En el estudio (versión 1.1)

| Sección | Cambio | Hallazgo |
|---|---|---|
| Encabezado, resultado principal y control de versiones | Versión 1.1; ED1 en el repositorio; la pregunta reformulada | V1, V11 |
| §1.1 y §1.2 | Hallazgo 8 (lo que ya existe); recomendaciones con medición previa, cuotas reales y requisitos antes del primer cobro | V1–V4 |
| §2.2, §2.3 y §2.4 | Etiqueta «Dato interno»; el registro suma S80–S93; dos límites nuevos: la 1.1 no tiene los datos comerciales de los comercios de la línea, y no pudo reabrir los precios de Tiendanube ni de Bold | V1, V11 |
| §3.1 y §3.3 | «Owner-first» precisado; nueva tabla de lo que el ecosistema ya tiene | V1, V9, V11 |
| §8.1 | Columna «En el ecosistema hoy» | V9 |
| §9.4 y §9.5 | Cuotas corregidas y restricciones de la cuenta; nombre del producto de un comercio | V3, V11 |
| §10.3 y §10.4 | Frase neutra; el flujo ya corre y qué falta para la tienda | V4, V11 |
| §11.1 y §12.1 | Tarifas de WhatsApp en Colombia y regla de Meta sobre IA | V7 |
| §12.3 y §12.6 | HTML por producto; medir la demanda antes de construir | V2, V6 |
| §13.3 y §13.4 | Entradas de ED1 en las fórmulas; costos reales y peso de la tarifa fija | V4 |
| §14.1 | Encargado del tratamiento, términos, factura, IVA y antiabuso | V4, V10 |
| §15.1, §15.2 y §15.3 | Costo de la tienda alojada; paquete de herramientas; tercer camino | V1, V5, V10 |
| §16.1, §16.3 y §16.4 | Comercios reales de la línea y medición en los días 1–15; fase de ED1 por tramo; umbrales antes del día 1; pruebas que ya existen | V1, V2, V8, V9 |
| §17.2 y §17.3 | Datos de los comercios reales como evidencia pendiente; decisión de inversión | V1, V8 |
| §18 y §19 | S01 actualizada; fuentes S80–S93; tres afirmaciones más que se evitan; la conclusión de inversión empieza por lo que ya existe | V1, V3, V7, V11 |

### 4.2 En el análisis de la Tienda (`integracion-tienda-ecosistema.md`)

Cuatro ajustes que salen de esta validación, marcados en el texto con su etiqueta:

- **§4 y §4.2, punto 1, HTML por producto [V6]:** el catálogo horneado por tienda incluye el HTML de cada ficha, no solo el JSON.
- **§4.2, punto 2, dominios [V10]:** las tiendas sin dominio propio van en un dominio registrable separado de los del ecosistema, con términos de uso, reporte, `abuse@` y suspensión con un clic (ED1 §14.1).
- **§4.1, fila del CORE [V9]:** no es «agregar un tipo». Es darle la dimensión de producto a la organización, el plan y el rol, y abrir la vuelta del login y del pago a la app de cada producto, con su migración planeada.
- **§10, punto 2 [V1, V8]:** el arranque de la 3.0 suma una condición medible: las métricas de §16.3 del estudio, tomadas en los comercios reales de la línea.

Y una corrección de paso (P18): **§9, punto 2** decía que las calculadoras de CultivoPro «ya traen tráfico». Siguen en borrador, sin indexar, y su demanda medida es pequeña.

## 5. Lo que el repositorio no sabía: respuestas del dueño (5 oct 2026)

| # | Pregunta | Respuesta del dueño | Qué cambia |
|---|---|---|---|
| 1 | ¿Cuántos comercios tiene hoy la línea ecommerce, entre la Tienda Básica y la 2.0? [V1] | «Hay dos tiendas 2.0 operando» | Corrige V1 (§3) y la fila de la línea ecommerce del estudio (§3.3). Cuáles pagan, cuánto y cuánto soporte piden sigue pendiente: es la primera medición de §16.3 |
| 2 | ¿Se miden los 25 términos de §12.6 antes de construir? [V2] | «Se miden las keyword, pero no es bloqueante para este proyecto» | Se miden; no detienen la Tienda 3.0. Siguen decidiendo qué herramientas gratuitas se construyen (ED1 v1.3 §19.1) |
| 3 | ¿El ecommerce entra como excepción declarada, como el agro con el ADR-2? [V8] | «Sí, es una excepción declarada» | ARQUITECTURA ADR-21. ED1 v1.3 §2.1 y §33 |
| 4 | ¿Prepago trimestral o anual de los planes? [V4] | «Todas las opciones de planes» | Mensual, trimestral y anual, prepagados (ADR-22; `docs/arquitectura/PLATAFORMA.md` §4.8) |
| 5 | ¿Contador y abogado antes del primer cobro real? [V4, V10] | «Sin contador y abogado por ahora, hagamos todo con rigor técnico» | Cada obligación se traduce en un control técnico verificable (`docs/arquitectura/TIENDA-3.0.md` §14). Facturación electrónica: solo los ganchos |
| 6 | ¿El CORE gana la dimensión de producto cuando arranque la 3.0? [V9] | «El core gana dimensión de producto, dejémoslo listo para crecer» | ARQUITECTURA ADR-20; diseño y migración probada en `PLATAFORMA.md` §4 |

**El mismo día, el dueño agregó tres pedidos:**

1. Integrar los principios de preparación para agentes de isitagentready.com «hasta donde lo permita el modelo». Está en `PLATAFORMA.md` §5.
2. Diseñar la Tienda 3.0 **desde cero**: «la migración de la tienda 2.0 no es requisito, podemos generar scripts luego para subir su data». Está en `TIENDA-3.0.md`, y los scripts en su §17.
3. Analizar su cuenta paga de Cloudflare (`cuenta-cloudflare-paga.md`) y otros proveedores de cómputo (`proveedores-de-computo.md`). Todo se integra en `ECOSISTEMA-DIGITAL-ED1-v1.3.md`.

## 6. Fuentes de esta validación

Las fuentes nuevas entran al registro del estudio (§18.5) con los identificadores S80–S93.

**Del ecosistema (dato interno), al 5 oct 2026:**

- `docs/BITACORA-ecommerce.md`: entradas 66, 67 y 93, y la de la versión 1.0.0 (decisión 36).
- `docs/analisis/integracion-tienda-ecosistema.md`.
- `docs/ARQUITECTURA.md`: §5.4, §5.5, §8.1, §8.2, §9, ADR-7 y §14.
- `docs/BACKLOG.md`: §1, HU-E0.2, HU-E0.7 y HU-E8.4.
- `docs/validacion/busquedas-2026-12.md`.
- `docs/REVISION-HALLAZGOS-ED1.md`: [H12] y [H16].
- `docs/BITACORA.md` (agro): «Lo que el terreno enseñó» y entrada 4.
- Código (v0.3.0):
  - `infrastructure/migraciones/core/0001_core_v0.sql`, `0004_interes_en_planes.sql` y `0005_pago_de_planes.sql`;
  - `apps/core/src/entrar.ts`, `pagos.ts` y `proveedor-de-pago.ts`;
  - `apps/core/wrangler.jsonc` y `apps/api-celda/wrangler.c0.jsonc`;
  - `content/agro/cuaderno/planes.json`;
  - `tests/repo/org-id-en-consultas.test.ts`.

**Externas, consultadas el 5 oct 2026:**

- Leadsales, [Precios de WhatsApp Business API en 2026](https://leadsales.io/blog/whatsapp-business-api-cuanto-cuesta/). Tarifas por mensaje en Colombia. Es secundaria: se confirma en la tabla de Meta (S49).
- respond.io, [WhatsApp AI chatbot policy](https://respond.io/blog/whatsapp-ai-chatbot-policy), y ENTER.CO, [Meta bloqueará el uso de chatbots de IA de terceros en WhatsApp a partir de 2026](https://www.enter.co/?p=577334). La regla de Meta desde el 15 ene 2026. Secundarias.
- DIAN, [Oficio 1447 de 2019](https://normograma.dian.gov.co/dian/compilacion/docs/oficio_dian_1447_2019.htm). Doctrina sobre la exclusión de IVA de la computación en la nube (Estatuto Tributario, art. 476, num. 24). Consultada por resumen, no en texto completo.
- Función Pública, [Decreto 1377 de 2013](https://www.funcionpublica.gov.co/eva/gestornormativo/norma.php?i=53646). Art. 25, contrato de transmisión de datos personales.
- Holland & Knight, [Ley 2439 de 2024: modificaciones al Estatuto del Consumidor](https://www.hklaw.com/en/insights/publications/2025/01/ley-2439-de-2024-modificaciones-al-estatuto-del-consumidor-en-colombia). Resumen de la ley: devolución del retracto en 15 días calendario, información del producto y canal de quejas. El texto vigente es S76.
- Comprobación de cifras del estudio. Los totales del cierre 2025 de la CCCE (COP 145,4 billones; 684,6 millones de transacciones; +11,1 % y +19,9 %) coinciden con la cobertura pública consultada. Los precios de Tiendanube Colombia (S16) y el tarifario de Bold (S39) no se pudieron abrir: se usan como los observó el estudio.
