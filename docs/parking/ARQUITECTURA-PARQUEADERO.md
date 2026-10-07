# Parqueadero ED1 — arquitectura de la solución

**Estado:** propuesta de arquitectura. Ninguna decisión de este documento está aceptada: las ADR-31 a ADR-40 esperan al dueño (§1).
**Versión:** 0.1 · 6 oct 2026
**Producto:** caja de parqueadero offline-first para parqueaderos pequeños y medianos de Colombia, con recibos impresos desde el navegador y enviados por WhatsApp. Nombre comercial por decidir; id de producto `parqueadero`.
**Depende de:** `../plataforma/PLATAFORMA.md` (el CORE con dimensión de producto, la cuenta, los dominios y los tokens v2) y `../ARQUITECTURA.md` (las piezas que ya corren: CORE v0, celdas, sincronización, QR firmado).
**Documentos que manda este:** `../ecosistema/ECOSISTEMA-DIGITAL-ED1-v1.4.md` (ED1 §N), `../ARQUITECTURA.md` (ADR-1 a ADR-30), `../tienda/TIENDA-3.0.md` (lecciones de WhatsApp y del panel), `../BITACORA.md` y `../tienda/BITACORA-ecommerce.md` (P1–P21), y en esta carpeta el estudio de mercado (`ESTUDIO-MERCADO-PARQUEADEROS-ED1-2026-10.md`, «estudio §N»).

> **Resultado principal.** El MVP que el cliente ya quiere pagar se puede entregar **sin esperar a la plataforma y sin costo de nube**: una caja que corre completa en el navegador del teléfono o del PC, guarda en el dispositivo, imprime el recibo en la GOOJPRT PT-210 por Bluetooth y, en el mismo momento, lo manda al WhatsApp del conductor desde el WhatsApp del parqueadero. El recibo es **uno solo** y sale por cuatro caminos (papel, enlace, mensaje y pantalla) desde el mismo modelo, con los campos que exige la Ley 1480 art. 18. La cuenta, la sincronización entre cajas, el recibo verificado y el WhatsApp automático llegan después, en hitos que montan sobre lo que la Tienda 3.0 ya está obligando a construir (tokens v2, sesión por producto, Workers Paid).
>
> **El SQL no es un borrador.** El modelo del servidor (§10) está en `sql/parqueadero/0001_parqueadero_v1.sql`, con su prueba: `node docs/parking/sql/probar-parqueadero.mjs docs/parking/sql/parqueadero/0001_parqueadero_v1.sql`. Son 56 comprobaciones, en verde el 6 oct 2026 con Node 22.22, y con sus controles negativos (P5).
>
> **Evidencia.** Lo que viene del repositorio se cita por su sección. Lo que viene de afuera lleva la etiqueta del estudio: *Dato publicado*, *Norma*, *Capacidad documentada*, *Oferta observada*, *Inferencia*, *Hipótesis*. Las fuentes externas están en §21: las de impresión llevan la letra I y las de WhatsApp y del marco legal la W.


**Contenido.** 0 Resumen · 1 Decisiones · 2 Contexto y alcance · 3 Principios · 4 Vista general · 5 La caja · 6 Recibos · 7 Impresión · 8 WhatsApp · 9 Tarifas · 10 Modelo de datos · 11 Cuentas y dispositivos · 12 API · 13 Seguridad y cumplimiento · 14 Operación · 15 Pruebas · 16 Monorepo · 17 Costos · 18 Hitos · 19 Riesgos y decisiones · 20 Hallazgos · 21 Fuentes · Anexo A (SQL) · Anexo B (maquetas)

---

## 0. Resumen

**Qué pidió el dueño (6 oct 2026):** la arquitectura detallada de la solución y su relación con ED1, más una necesidad puntual de un cliente que ya tiene disposición a pagar: imprimir desde el navegador del celular o del PC los recibos que se entregan a los conductores, y mandar ese mismo recibo al WhatsApp del conductor en el momento de imprimir, para que el papel deje de usarse a corto y mediano plazo. La impresora del MVP es la **GOOJPRT PT-210** (58 mm, ESC/POS, Bluetooth).

**Las diez decisiones que sostienen el diseño** (§1, todas propuestas):

1. **El cliente es el parqueadero cero** y el producto entra como excepción declarada, como el agro (ADR-2) y la Tienda (ADR-21). Ya no falta la señal que el estudio pedía antes de construir (estudio §17.3) [ADR-31].
2. **El MVP es una caja local:** funciona completa en el navegador, sin cuenta y sin servidor. La nube no es requisito del primer recibo [ADR-32].
3. **Un recibo, cuatro salidas.** Papel ESC/POS, enlace firmado, texto de WhatsApp y QR en pantalla salen del mismo objeto, y una prueba exige que los cuatro lleven los campos de la ley (P2) [ADR-33].
4. **Imprimir desde el navegador con adaptadores.** Web Bluetooth a la PT-210 es el camino principal, Web Serial el segundo y el diálogo de impresión del sistema el respaldo. Sin app nativa ni programa instalado en el PC. **En iPhone no hay camino directo:** ningún navegador de iOS habla Bluetooth con la impresora (§7.8) [ADR-34].
5. **WhatsApp en el MVP es un enlace `wa.me`** que abre el WhatsApp del parqueadero con el número del conductor y el recibo escrito. Gratis, sin plantillas, sin verificación de negocio. La WhatsApp Cloud API llega en M3, solo en planes pagos, con el número de cada parqueadero, presupuesto y kill switch [ADR-35].
6. **Recibos verificables sin red** con una llave por dispositivo que la celda certifica (M2). En el MVP el recibo va sin firma y no finge estar verificado [ADR-36].
7. **Las tarifas son dato,** y los topes de cada ciudad son contenido versionado. Un paquete puro liquida igual en la caja y en la calculadora gratuita [ADR-37].
8. **El número del conductor no sale del dispositivo,** salvo hacia WhatsApp, y se borra 24 h después de cerrar la estadía. Solo llega a la celda con la Cloud API, cifrado y con el consentimiento registrado [ADR-38].
9. **Tercer producto con cuentas:** se extraen la sincronización, la firma de fragmentos y los enlaces de WhatsApp a paquetes comunes (ED1 §3.11) [ADR-39].
10. **Vive en `parqueadero.laboratorio-digital.app`** (ADR-27), y la zona se activa **antes del primer recibo**: un enlace impreso o enviado por WhatsApp no se puede corregir después [ADR-40].

**Qué depende de qué:**

| Hito | Deja funcionando | Necesita de la plataforma |
|---|---|---|
| **M0 · MVP del cliente** | Caja local, tarifas, recibo en la PT-210, WhatsApp por enlace, QR en pantalla, página del recibo, turno y cierre, respaldo en archivo | Nada. Solo la zona `laboratorio-digital.app` activa |
| **M1 · Cuenta y varias cajas** | Entrar, reclamar lo local, sincronizar, roles, cobro del plan | PLATAFORMA P1 (producto en el CORE) y P2 (tokens v2); P3 para cobrar 3, 6 y 12 meses |
| **M2 · Recibo verificado** | Firma sin red por dispositivo, fotos del estado en la nube por 30 días, mensualidades, reportes por turno | M1 |
| **M3 · WhatsApp automático** | Envío por la Cloud API con plantilla de utilidad; recibo por autoservicio con un QR en la entrada | M1, Workers Paid y el cifrado de sobre (`packages/cifrado`, de la Tienda) |
| **M4 · Facturación** | Integrar el facturador del parqueadero (no emitir) | Como la Tienda (TIENDA-3.0 §14.5) |

> **Las historias, los sprints y las fechas de estos hitos están en `BACKLOG-PARKING.md`** (7 oct 2026), que es la fuente del plan; las 37 historias de M0, las demostraciones y el piloto, en `BACKLOG-PARKING_MVP.md`. Tres cambios frente a esta tabla: M1 no espera las fases P1 y P2 enteras, sino HU-C3.1, HU-C4.3 y HU-C4.4 del CORE, que ya están construidas, y solo el cobro por periodo (HU-Q7.10) espera a HC4; Workers Paid ya no es condición de M1 ni de M3, que lo pide solo si su cola lo exige (HU-Q9.4, D-Q10; bitácora parqueadero 6); y las mensualidades con cobro son de M2 (HU-Q8.4; bitácora parqueadero 7).

---

## 1. Decisiones (ADR)

Numeración continua con `../ARQUITECTURA.md` §1, que llega hasta ADR-30. Todas **propuestas**. Cuando el dueño acepte una, pasa a esa tabla en el pull request que la construye (P18).

| ADR | Decisión | Por qué, en una línea | Alternativa descartada | Estado |
|---|---|---|---|---|
| 31 | El parqueadero entra como **excepción declarada**, con el cliente del MVP como **parqueadero cero**, tratado como cualquier otro (ADR-1) | Hay un cliente con disposición a pagar: es la evidencia que el estudio exigía (estudio §16, §17.3) | Esperar a la fase 7 de ED1 (§33), o construir para «los demás» y dejar fuera al primero (P6) | Propuesta |
| 32 | El MVP es una **caja local**: navegador, IndexedDB y archivos. Sin cuenta, sin API de celda y sin D1. El sitio estático solo recibe eventos anónimos cuando hay red (§14.4) | El cliente paga ahora y la plataforma tiene sus fases ocupadas por la Tienda. Es además el peldaño «usuario recurrente» de la escalera (ED1 §38) | Esperar a la sincronización para entregar algo | Propuesta |
| 33 | **Un modelo de recibo, cuatro salidas** (papel, enlace, WhatsApp, pantalla), con paridad probada | «El mismo recibo» es el pedido literal del cliente, y P2: dos copias de un texto legal se separan | Una plantilla por canal | Propuesta |
| 34 | **Impresión por adaptadores en el navegador.** Web Bluetooth a la PT-210 primero; Web Serial (Bluetooth clásico en Android y en el PC, o el puerto COM) como segundo camino; el diálogo del sistema como respaldo | Cero instalación y cero costo. La PT-210 habla BLE y, probablemente, Bluetooth clásico, que Chrome para Android alcanza con Web Serial desde la versión 138 (§7.1, §7.2) | App nativa; agente de impresión en el PC; servidor de impresión | Propuesta |
| 35 | **WhatsApp por enlace `wa.me`** desde el WhatsApp del parqueadero en el MVP. Cloud API en M3, solo en planes pagos, con número propio de cada parqueadero, presupuesto y kill switch | Es lo que ya funciona en la Tienda y en CultivoPro, y la barrera de la API no es el costo sino habilitar el canal (TIENDA-3.0 §20.3; ED1 v1.4 [C]) | Un número de la plataforma que envía a nombre de todos los parqueaderos | Propuesta |
| 36 | **Firma sin red:** cada dispositivo tiene una llave Ed25519 que no sale de él, y la celda la certifica; el recibo lleva la firma y el certificado | El QR del agro sin señal sale «sin verificar» (ARQUITECTURA §5.9). En una caja, sin señal es lo normal | Firmar solo con red (el modelo del agro) | Propuesta (M2) |
| 37 | **Tarifas como catálogo** por sede y tipo de vehículo; **topes por ciudad** como contenido versionado; liquidación en `packages/parqueadero-tarifas`, puro | Los topes cambian cada enero y por ciudad (estudio §13.2). La calculadora gratuita y la caja deben dar lo mismo (P2) | Tarifas en el código | Propuesta |
| 38 | **El número del conductor no sale del dispositivo** en M0–M2, salvo hacia WhatsApp, y se borra 24 h después de cerrar la estadía | Mínimo necesario (Ley 1581, TIENDA-3.0 §14.3): para un enlace `wa.me` no hace falta guardarlo | Guardarlo en la celda desde el MVP | Propuesta |
| 39 | **Regla de tres cumplida:** `packages/sync` deja de ser del agro; la firma de fragmentos sale de `packages/trazabilidad`; los enlaces de WhatsApp van a `packages/whatsapp` | Agro, Tienda y parqueadero los usan (ED1 §3.11) | Copiar el código del cuaderno | Propuesta (M1) |
| 40 | **Host `parqueadero.laboratorio-digital.app`**, con la caja en `/caja/` y el recibo en `/r/`. La zona se activa antes del primer recibo | ADR-27. Un recibo impreso o enviado guarda su enlace para siempre (la lección de ADR-19) | Empezar en `workers.dev` y mudar después | Propuesta |

---

## 2. Contexto y alcance

### 2.1 El cliente y su necesidad

- **Quién:** un parqueadero con disposición a pagar (dato del dueño, 6 oct 2026). Su tamaño, ciudad, tarifas y número de cajas **no se conocen todavía** y se piden antes de M0 (§19.2).
- **Qué pide:**
  1. Imprimir desde el navegador del celular o del PC el recibo que se entrega al conductor.
  2. Mandar ese mismo recibo al WhatsApp que el conductor da en ese momento.
  3. Que el papel deje de usarse a corto y mediano plazo.
- **Con qué:** una **GOOJPRT PT-210**, impresora térmica portátil de 58 mm, ESC/POS, Bluetooth.
- **Lo que la ley le pide al recibo** (estudio §13.1, *Norma*): fecha y hora de recepción, identificación del vehículo, su estado y el valor del servicio (Ley 1480 art. 18), con los datos del prestador y un número de recibo (Circular Única de la SIC). El estado se puede documentar con medios tecnológicos, y un documento electrónico vale como escrito si queda accesible (Ley 527 art. 6).

### 2.2 Lo que entra en el MVP, y lo que no

| Entra (M0) | No entra, a propósito | Cuándo |
|---|---|---|
| Entrada por placa, tipo de vehículo, estado con lista y notas | Lectura de placa con la cámara | Hipótesis por probar (estudio §8.3) |
| Salida con liquidación por minuto, fracción u hora, gracia, tope diario y tiquete perdido | Pago en línea del conductor | ED1 no recauda el dinero del conductor (estudio §9.1) |
| Recibo de entrada y de salida en papel, por WhatsApp y en pantalla | WhatsApp automático (Cloud API) | M3 (§8.5) |
| Página pública del recibo (`/r/`) | Recibo firmado y verificado | M2 (§6.3) |
| Turno: apertura, cierre con conteo y cierre impreso | Varias cajas sincronizadas | M1 |
| Respaldo en archivo y exportación | Respaldo en la nube | M1 |
| Fotos del estado, guardadas en el dispositivo | Fotos en la nube | M2 |
| Medio de pago registrado (efectivo, QR, datáfono) | Factura electrónica o tiquete POS electrónico | M4, integrando el facturador del parqueadero |
| Mensualidades sencillas por placa | Convenios con comercios, visitantes de copropiedad | Por demanda (estudio §7.2) |

**Nota del plan (7 oct 2026):** las «mensualidades sencillas por placa» se parten en dos. En M0 la caja solo reconoce a un abonado vigente por su placa y no le cobra la salida (`BACKLOG-PARKING_MVP.md` HU-Q3.11, Should); las mensualidades con plan, cobro y recordatorio son de M2, como dicen §0 y §18 (`BACKLOG-PARKING.md` HU-Q8.4). Bitácora parqueadero 7.

### 2.3 Tensiones con ED1, dichas antes de construir

1. **Fase.** Un SaaS vertical es la fase 7 (ED1 §33). El parqueadero entra antes como excepción declarada [ADR-31], con métricas fijadas antes de medir (§18.2), como pide ED1 [D3].
2. **El MVP corre antes que la plataforma.** M0 no usa el CORE ni una celda: no choca con las fases P1–P3 que la Tienda necesita. M1 sí espera a P1 y P2 (§11).
3. **Regla de tres.** El parqueadero es el tercer producto con cuentas: autoriza extraer lo común [ADR-39], y obliga a hacerlo en M1, no después.
4. **La zona `laboratorio-digital.app` no está activa** (`infrastructure/dominios.json`, `zona_activa: false`). La Tienda la activa en su M0. El parqueadero la necesita antes, porque su primer recibo publica un enlace [ADR-40].
5. **Privacidad.** «Tus datos no salen de tu teléfono» es cierto en M0 y deja de serlo en M1. La promesa se escribe por hito (estudio §13.5).

### 2.4 La escalera aplicada (ED1 §38)

| Peldaño | En el parqueadero | Hito |
|---|---|---|
| Herramienta gratuita | Calculadora de tarifa con el tope de la ciudad; generador de recibo de entrada; aviso de tarifas y derechos (estudio §12.2) | Con M0: comparten `parqueadero-tarifas` y `parqueadero-recibos` |
| Usuario recurrente | La caja local, sin cuenta | M0 |
| Cuenta | Sincronizar, varias cajas, respaldo | M1 |
| Premium | Recibo verificado, fotos en la nube, reportes, mensualidades | M2 |
| Herramienta de negocio | WhatsApp automático, varias sedes | M3 |
| Servicios | Puesta en marcha: impresora, tarifas y textos legales | Desde el piloto (estudio §10.2) |

---

## 3. Principios aplicados

Se heredan ED1 §3, los patrones P1–P21 (`../BITACORA.md` › Lo aprendido), las reglas R1–R6 (PLATAFORMA §2) y PT1 (`../tienda/BITACORA_TIENDA3.md`). Aquí, solo cómo toman forma en una caja de parqueadero:

| Regla | Forma concreta aquí |
|---|---|
| Browser-first | Liquidación, recibo, ESC/POS, QR, compresión de fotos, reportes y cierre de turno se calculan en el dispositivo |
| Offline-first | Ninguna pantalla espera a la red para registrar, cobrar o imprimir. La impresión por Bluetooth no usa internet |
| Static-first | La caja, la página del recibo y las herramientas son assets estáticos: gratis en cualquier plan (`../plataforma/cuenta-cloudflare.md` §1) |
| Budget-first | M0 no gasta nube. M1 declara su presupuesto en `apps/parqueadero-*/product.yaml` (§14) |
| P1 · El fallo que funciona es el caro | Una impresión que no salió lo dice y ofrece reintentar o mandar por WhatsApp; nunca se marca «entregado» sin respuesta del adaptador. Un número de recibo repetido falla, no se pierde (§10). Un tope de ciudad vencido se avisa, no se aplica en silencio |
| P2 · Una sola fuente | Un modelo de recibo para los cuatro canales; un motor de tarifas para caja y calculadora; los topes en un archivo de contenido |
| P8 · El reloj es una entrada | La hora del recibo es la del dispositivo: la caja la compara con el reloj del servidor cuando hay red y avisa si está corrida (§5.6). Bogotá es UTC−5 fijo |
| P13 · Un secreto no viaja por donde queda escrito | El recibo viaja en el fragmento `#` y no llega a ningún servidor. Ningún teléfono en una URL de la plataforma |
| P15 · Un aviso tiene que llegar a donde alguien mira | El estado de la impresora y del respaldo vive en la cabecera de la caja, no en un menú |
| P16 · Un flujo que nunca ha corrido de verdad no está probado | El MVP no se entrega sin imprimir en una PT-210 real y mandar a un WhatsApp real (§15.3) |
| P20 · Lo que se ofrece tiene que llegar por el camino que la persona recorre | El recibo digital tiene que abrirse desde el WhatsApp del conductor, en su teléfono, sin cuenta |
| PT1 · Lo que sobrevive a un tercero no puede vivir solo en el navegador que lo empezó | El recibo entero va en el enlace: la página no necesita la base del parqueadero para mostrarlo |
| R1 · Lo que va a crecer es dato | Tipos de registro, catálogos, medios de pago, tipos de vehículo y topes son tablas o contenido |
| R6 · Un permiso por producto y propósito | Kill switches, presupuesto y credenciales propias del parqueadero (§14) |

---

## 4. Vista general

```text
            CONDUCTOR                         OPERADOR (cajero, administrador, propietario)
               │                                         │
   WhatsApp ◄──┼──── wa.me (WhatsApp del parqueadero) ◄──┤
   del         │                                         ▼
   conductor   │      ┌──────────── parqueadero.laboratorio-digital.app (assets estáticos) ───────────┐
               │      │  /            sitio y herramientas gratuitas (Astro + islas Preact)            │
               ├─────►│  /r/#<recibo> página del recibo: lee el fragmento, verifica la firma (M2)       │
               │      │  /caja/       PWA de la caja: IndexedDB · service worker · ESC/POS · QR         │
               │      └────────────────────────────────────────────────┬───────────────────────────────┘
   escanea el QR                                                       │ Web Bluetooth (BLE), sin internet
   del papel o de la pantalla                                          ▼
                                                            GOOJPRT PT-210 (58 mm, ESC/POS)

   ─────────────────────────────── desde M1 ───────────────────────────────
   /caja/ ──sync push/pull, fotos, certificados──► CELDA c2 (producto parqueadero)
                                                   Worker parqueadero-api-c2 (Hono) · solo /api/*
                                                   D1 parqueadero_c2_s{k} · R2 (fotos 30 días, respaldos)
                                                   KV (flags, kill switches) · Cron (vigía, respaldo, purgas)
                                                   [M3] Cola y webhooks de WhatsApp Cloud API
                                                            ▲ verifica tokens con la clave pública
   /caja/ ──entrar, organización, plan──► CORE (cuenta.laboratorio-digital.com)
                                          usuarios, sesiones por producto, organizaciones, roles,
                                          invitaciones, planes y cobro con Bold, directorio → celda

   GITHUB: monorepo `plataforma` → CI (licencias, pruebas, e2e) → despliegue por anillos. Nunca toca datos ([H6]).
```

### 4.1 Componentes

| Componente | Qué es | Dónde | Hito |
|---|---|---|---|
| `apps/parqueadero-sitio` | Sitio, herramientas gratuitas, página del recibo `/r/` y la PWA `/caja/` como assets | Worker de assets estáticos en `parqueadero.laboratorio-digital.app` | M0 |
| `apps/parqueadero-caja` | La PWA: Preact, Dexie, Workbox. Entradas, salidas, cobro, turnos, recibos, impresora, WhatsApp, respaldo | Se construye dentro del sitio, en `/caja/` | M0 |
| `apps/parqueadero-api` | API de la celda: sincronización, dispositivos, firma, fotos, exportación; crons; en M3 la cola y los webhooks de WhatsApp | Celda c2, `parqueadero-api-c2` | M1 |
| `packages/parqueadero-tarifas` | Liquidación pura: minutos, fracción, gracia, topes, nocturna, tope diario, redondeo | Compartido por caja y calculadora | M0 |
| `packages/parqueadero-recibos` | El modelo `Recibo` y sus cuatro salidas | Caja, página `/r/`, generador gratuito | M0 |
| `packages/impresion` | Adaptadores de impresora y codificador ESC/POS. No sabe nada de parqueaderos | Caja; después, Tienda (punto de venta) y cuaderno (etiquetas de lote) | M0 |
| `packages/parqueadero-schema` | Esquemas zod de registros y catálogos, con versiones y contratos (P10) | Caja, API, pruebas | M0 |
| `packages/whatsapp` | Enlaces `wa.me`, normalización del número, reglas del texto | Sale del código del agro y la Tienda [ADR-39] | M0 |
| `packages/sync` | Protocolo de sincronización sin las entidades del agro | Generalizado [ADR-39] | M1 |
| `packages/firma` | Fragmento firmado (`datos.firma[.certificado]`) | Sale de `packages/trazabilidad` [ADR-39] | M0 (formato), M2 (firma) |
| `content/parqueadero/` | Topes por ciudad, textos legales, planes, política de datos | Contenido versionado | M0 |

### 4.2 Relación con cada pieza de ED1

| Pieza de ED1 | Qué toma el parqueadero | Qué devuelve | Hito |
|---|---|---|---|
| **CORE** (PLATAFORMA §4) | Usuarios, Google y enlace mágico, organizaciones, roles por producto, invitaciones por WhatsApp, planes de 1, 3, 6 y 12 meses con Bold, auditoría | El producto `parqueadero` en `productos.json` (§11.1) | M1 |
| **Tokens v2** (PLATAFORMA §4.6) | `aud = parqueadero`, `plan`, `plan_vence`, `auth_time` | — | M1 |
| **Celdas** (ARQUITECTURA §5.5, PLATAFORMA §4.9) | Una celda c2 del producto, shards `parqueadero_c2_s{k}` | — | M1 |
| **Sincronización** (ARQUITECTURA §5.6) | Push/pull, cuarentena, ids UUIDv7, versiones N-1 | El paquete generalizado [ADR-39] | M1 |
| **QR firmado** (ARQUITECTURA §5.9) | Formato `datos.firma` en el fragmento y verificación en una página estática | La firma sin red por dispositivo [ADR-36], que el agro puede adoptar | M2 |
| **Tienda 3.0** | Lecciones de WhatsApp (§8.1), cifrado de sobre, `auth_time` para datos sensibles, los dos comercios de prueba (P4) | `packages/impresion` para su canal de punto de venta (TIENDA-3.0 §20.3) | M0–M3 |
| **Dominios** (ADR-27) | `parqueadero.laboratorio-digital.app` | El nombre `parqueadero` reservado en `dominios.json › reservados_app.proyecto`, para que ninguna tienda lo tome | M0 |
| **Presupuesto y vigía** (PLATAFORMA §4.10) | Vigía, alertas por Telegram (ADR-16), kill switches | `product.yaml` con su presupuesto | M1 |
| **Eventos** (`packages/eventos`) | Analytics Engine sin datos personales | Eventos de recibo por canal: la métrica del papel (§8.4) | M0 |
| **Sistema de diseño** (ADR-29) | `@ed1/ui` v2, Geist autoalojada | Componentes de teclado de placa y de dinero | M0 |
| **Respaldos** (ARQUITECTURA §8.3, ADR-30) | R2 semanal y copia cifrada en el Drive del dueño | — | M1 |
| **Agentes** (ADR-24) | Capa estática del sitio: `llms.txt`, gemelos en Markdown | — | Con el sitio |
| **Herramientas gratuitas** (ED1 §10.4) | Familia Negocios | Cuatro herramientas que llevan a la caja (estudio §14.2) | M0 |

---

## 5. La caja (PWA)

### 5.1 Pantallas y flujos

**Entrada (objetivo: menos de 10 segundos con la impresora conectada):**

1. Placa con un teclado propio: mayúsculas, sin espacios. El patrón decide el tipo de vehículo por defecto (`ABC123` carro, `ABC12D` moto) y el operador puede cambiarlo. Una placa fuera de patrón (extranjera, diplomática, remolque) se acepta con una confirmación, no se bloquea (P1).
2. Si la placa tiene una estadía abierta, lo dice y no crea otra.
3. Si es de un abonado vigente, lo marca.
4. Estado del vehículo: «sin novedad» o una lista corta (rayón, golpe, vidrio, espejo, llanta, otro) con la parte y una nota. Fotos opcionales.
5. WhatsApp del conductor, opcional, con la casilla de autorización (§8.3).
6. **Registrar.** En una transacción de IndexedDB: el registro, el consecutivo y la estadía abierta. Después, la pantalla del recibo (§5.2).

**Salida:**

1. Escanear el QR del papel o del teléfono del conductor, o buscar la placa entre las estadías abiertas.
2. La liquidación con su detalle: minutos, tarifa, gracia, tope y redondeo (§9).
3. Medio de pago: efectivo (con lo recibido y el cambio), QR o transferencia, datáfono, abonado, cortesía con motivo. El QR del propio parqueadero se muestra en pantalla: ED1 no toca el dinero.
4. **Cobrar.** Registro de salida con su consecutivo, y la pantalla del recibo de salida.
5. **Tiquete perdido:** cobro configurable y nota de identificación, como un caso de la liquidación, no como una excepción del código.

**La pantalla del recibo** (la misma para entrada y salida):

| Acción | Comportamiento |
|---|---|
| Imprimir | Automático al registrar si la sede dice «imprimir siempre» y la impresora está conectada. Si no, un botón |
| Enviar por WhatsApp | Un enlace ya armado, listo para un toque (§8.2) |
| Mostrar QR | El conductor escanea la pantalla con su cámara y se lleva el enlace del recibo, sin dar su número ni gastar papel (§6.5) |
| Reimprimir | Sale con la marca «COPIA» y queda registrada (§7.6) |

**Estadías abiertas:** lista por hora de entrada, con búsqueda por placa y el tiempo corriendo.

**Turno:** apertura con la base de caja; cierre con conteo de efectivo, lo esperado (calculado en el dispositivo), la diferencia y su motivo. El cierre se imprime en la PT-210.

**Ajustes** (los que tocan dinero o textos legales piden el PIN de administrador en M0, y `auth_time` reciente desde M1): datos legales de la sede, tarifas, recibo, impresora, WhatsApp, PIN, respaldo.

### 5.2 Almacén local (Dexie sobre IndexedDB)

| Tabla | Qué guarda | Sincroniza (M1) |
|---|---|---|
| `registros` | Todo lo inmutable: entradas, salidas, anulaciones, entregas de recibo, turnos, movimientos de caja, pagos de abonados | Sí |
| `catalogos` | Sede, tarifas, abonados, ajustes del recibo, puntos | Sí |
| `estadias` | Las abiertas, para buscar rápido. Se deriva de `registros` y se puede reconstruir | No |
| `meta` | Id del dispositivo, serie, último consecutivo, vínculo con la organización (M1) | No |
| `impresora` | El dispositivo Bluetooth elegido, ancho del papel, página de códigos, prueba superada | No: cada caja tiene la suya |
| `contactos` | WhatsApp del conductor por estadía, con su autorización y vencimiento | **No, nunca en M0–M2** [ADR-38] |
| `entregas_pendientes` | Impresiones o envíos que fallaron y esperan reintento | No |
| `fotos` | Fotos WebP comprimidas, con su estadía | M2 (a R2) |
| `outbox` · `rechazos` | Cola de salida y cuarentena local, como el cuaderno | M1 |

### 5.3 Reglas de la app

Las del cuaderno (ARQUITECTURA §5.3), con estas formas:

1. **Registrar nunca espera a la red ni a la impresora.** El recibo existe aunque la impresora esté apagada.
2. **El consecutivo se asigna en la misma transacción que el registro.** Una transacción que falla no gasta número.
3. **Actualizar no corta una venta:** la versión nueva espera mientras haya un formulario abierto, una impresión en curso o un turno sin cerrar con operaciones pendientes.
4. **El dispositivo dice dónde está cada dato:** en M0, «solo en este dispositivo» y la fecha del último respaldo; desde M1, los tres estados del cuaderno.
5. **Almacenamiento persistente** (`navigator.storage.persist()`). Si el navegador no lo concede, la cabecera lo dice y el cierre de turno pide el respaldo.
6. **Respaldo en M0:** archivo `parqueadero-export/1` (JSON) con todo, más un CSV para Excel. Se ofrece al cerrar cada turno y se puede compartir (`navigator.share`) al correo o al Drive del dueño del parqueadero. Es el mismo formato de la exportación de M1 y de la carga al reclamar (P2).
7. **Español de Colombia, pesos enteros, 360 px, al sol.** Botones grandes y alto contraste: la caja se usa de pie y con guantes.

### 5.4 Numeración sin red

- Cada dispositivo tiene una **serie** (A, B, C…) y numera sus recibos `A-000123`. Dos cajas sin red nunca repiten un número, sin coordinarse.
- En M0 la serie es «A». Al reclamar en M1, el primer dispositivo conserva la suya y los siguientes reciben la siguiente libre. La base lo garantiza: la serie es única por parqueadero y un recibo solo entra con la serie de su dispositivo (§10, anexo A).
- El número es el que pide la Circular Única: el recibo lo imprime, el mensaje lo lleva y la búsqueda de la salida lo acepta.

### 5.5 Fotos del estado

- `<input type="file" accept="image/*" capture="environment">`, comprimida en el navegador a WebP de unos 100 KB (ADR-15).
- En M0 viven en el dispositivo hasta cerrar la estadía más 30 días, y salen en el respaldo.
- Desde M2 suben a R2 con un nombre aleatorio de 128 bits que viaja en el fragmento del recibo. Una regla de ciclo de vida del bucket las borra a los 30 días (*Capacidad documentada* de R2, por confirmar en el panel), sin escrituras en D1.
- Se fotografía el vehículo, no a las personas. La caja lo dice en la cámara.
- **Nota del plan (7 oct 2026):** Safari no codifica WebP en `canvas.toBlob` y devuelve PNG (bitácora tienda3 2). Ahí la foto se guarda en JPEG, con su formato real (HU-Q3.3, HU-Q8.3). Y en M0 las fotos no salen en el respaldo, que se comparte por correo y no las aguantaría: viven en el dispositivo hasta M2 (HU-Q3.10). Bitácora parqueadero 8.

### 5.6 El reloj

- La hora del recibo es la del dispositivo: es la que cuenta para el conductor y para la liquidación.
- Cuando hay red, la caja lee la cabecera `Date` del sitio estático (gratis) y, si la diferencia pasa de 2 minutos, avisa en rojo y pide corregir la hora. No corrige en silencio (P8, como `reloj-corrido` del cuaderno).
- Las fechas locales se calculan con UTC−5 fijo: Colombia no tiene horario de verano. Sin `Intl` para formatear lo que va impreso, porque cambia entre navegadores (P17).

---

## 6. Recibos: un modelo, cuatro salidas

### 6.1 El modelo `Recibo` y lo que exige la ley

`packages/parqueadero-recibos` arma un objeto `Recibo` a partir del registro y de los catálogos vigentes en ese instante (sede, tarifa, ajustes). Las cuatro salidas se generan de él y de nada más.

| Campo | Entrada | Salida | Por qué | Papel | Enlace | WhatsApp | Pantalla |
|---|---|---|---|---|---|---|---|
| Nombre, NIT, dirección y teléfono del prestador | Sí | Sí | Circular Única: datos del prestador | Sí | Sí | Nombre | Vía enlace |
| Número de recibo | Sí | Sí | Circular Única | Sí | Sí | Sí | Vía enlace |
| Fecha y hora de entrada | Sí | Sí | Ley 1480 art. 18 | Sí | Sí | Sí | Vía enlace |
| Placa y tipo de vehículo | Sí | Sí | Ley 1480 art. 18 | Sí | Sí | Sí | Vía enlace |
| Estado del vehículo | Sí | — | Ley 1480 art. 18; órdenes de la SIC de 2022 | Sí | Sí, con fotos desde M2 | Resumen | Vía enlace |
| Tarifa y tope | Sí | Sí | Valor del servicio; informar tarifas (SIC) | Sí | Sí | Sí | Vía enlace |
| Póliza (aseguradora y número) | Si la sede la tiene | Sí | Bogotá: la factura lleva los datos de la póliza (Decreto 461 de 2019) | Sí | Sí | — | Vía enlace |
| Hora de salida, minutos y total | — | Sí | Valor del servicio | Sí | Sí | Sí | Vía enlace |
| Medio de pago | — | Sí | Informar medios de pago (SIC) | Sí | Sí | Sí | Vía enlace |
| Texto de responsabilidad y derechos | Sí | Sí | Los avisos que eximen no valen (estudio §13.1) | Corto | Completo | Enlace | Vía enlace |

- Una prueba arma recibos de entrada y salida para los dos parqueaderos de prueba y exige que **cada salida contenga cada campo marcado** (P2, P5 con un campo quitado).
- Lo que el parqueadero no llenó no se imprime vacío: la caja no deja registrar hasta que los datos legales de la sede están completos, como la compuerta de publicación de la Tienda (TIENDA-3.0 §10.2). Ningún valor de fábrica (lección «el celular de la primera tienda», bitácora ecommerce).
- **Este recibo no es una factura.** La factura electrónica o el tiquete POS electrónico los emite el facturador del parqueadero (M4; estudio §13.3).

### 6.2 Papel: ESC/POS a 58 mm

- 384 puntos de ancho y 32 caracteres por línea en la fuente A (*Oferta observada* en las fichas de la PT-210 y perfil `pos-5890` del codificador, §7.1).
- El texto se arma en `packages/parqueadero-recibos` con un ancho fijo y se codifica en `packages/impresion`. El QR se imprime con el comando nativo de la impresora, o como imagen si la página de prueba lo rechaza (§7.3, §7.7).
- Maqueta, a 32 columnas, de un recibo de entrada (anexo B tiene la de salida y la del cierre de turno):

```text
     PARQUEADERO ENSAYO UNO
       NIT 900.000.000-0
         Tel 3000000000
      Calle 1 # 2-3, Bogota
--------------------------------
RECIBO DE ENTRADA       A-000123
06/10/2026 18:05
Placa ABC123               Carro
Estado: rayon puerta trasera der
--------------------------------
Tarifa: $230 por minuto
Tope por dia: $30.000
Poliza: Aseguradora 0000000
--------------------------------
          [ QR 28 mm ]
      Codigo para la salida
--------------------------------
Conserve este recibo. El
parqueadero responde por el
vehiculo (Ley 1480, art. 18).
 Pida su recibo por WhatsApp.
```

- Las tildes y la ñ dependen de la página de códigos de la impresora. La configuración imprime una página de prueba con `áéíóúñÑ¿¡$` y el operador dice si se ven bien. Si no, la caja translitera (`a`, `n`) y lo dice en ajustes; nunca imprime basura (P1).
- **Ahorro de papel desde el primer recibo:** márgenes mínimos, sin logo por defecto, y solo el avance necesario para rasgar después del pie (la PT-210 no corta, §7.1). Un recibo así mide unos 9–11 cm (*Inferencia*, a medir con la PT-210 real).

### 6.3 El enlace y la página del recibo (`/r/`)

```text
https://parqueadero.laboratorio-digital.app/r/#1.<datos>[.<firma>.<certificado>]   (completa; «1» es la versión del formato)
https://parqueadero.laboratorio-digital.app/r/#c.<número>.<placa>.<tipo>.<hora>      (corta, para el papel)
```

- `datos`: JSON con claves cortas y horas en segundos, comprimido con deflate y en base64url. Lleva lo de la tabla de §6.1 y, desde M2, los nombres de las fotos.
- **El fragmento no llega a ningún servidor** (P13): abrir un recibo cuesta cero solicitudes de API, y funciona aunque el parqueadero deje de ser cliente (como ADR-14).
- La vista previa del enlace en WhatsApp es genérica («Recibo de parqueadero»): el lector de Meta no ve el fragmento. Así la placa no queda en los servidores de vista previa.
- **Firma** (M2, ADR-36):
  - El dispositivo firma `datos` con su llave Ed25519. La llave se genera en el navegador, no se puede exportar y vive en IndexedDB.
  - El `certificado` es la llave pública del dispositivo, su organización y su vencimiento, firmados por la celda.
  - La página verifica la cadena con las claves públicas de las celdas horneadas en el build, como `/agro/t/` (ARQUITECTURA §5.9).
- **Lo que muestra la página:**

| Caso | Muestra |
|---|---|
| Firma y certificado válidos | «Verificado: emitido por <parqueadero> desde la caja A» |
| Sin firma (M0) | «Copia digital del recibo». Sin sello verde, sin alarma |
| Firma o certificado que no coinciden | En rojo: «Este recibo fue modificado» |
| Certificado vencido al emitir | En ámbar: «Emitido con un certificado vencido» |

- **Dos formas del enlace, por tamaño.** Medido el 6 oct 2026 con un recibo de prueba de nombre y dirección largos (346 caracteres de JSON), comprimido con deflate de Node:

| Forma | Dónde va | Largo del enlace | QR de corrección L |
|---|---|---|---|
| Completa, sin firma (M0) | WhatsApp y QR en pantalla | 367 caracteres la entrada, 415 la salida (511 y 605 sin comprimir) | Versión 12–13: en pantalla, sin problema |
| Completa, firmada (M2) | WhatsApp y QR en pantalla | 610 la entrada, 658 la salida | Versión 17–18: 85–89 módulos, demasiado denso para papel térmico |
| Corta: `#c.<número>.<placa>.<tipo>.<hora>` | El papel | 136 | Versión 7: 45 módulos a 5 puntos (0,625 mm) son 28 mm |

- **El QR del papel es la forma corta.** Sirve para buscar la estadía en la salida y, escaneado por el conductor, abre `/r/` con el número, la placa y la hora, y le explica cómo pedir su copia completa. Un QR denso en papel térmico se lee mal, y más cuando el papel se borra (§8.4); el recibo legal es el papel mismo. Una prueba exige que la forma corta quepa en la versión 7 y la completa sin firma en la 13.
- **Fotos** (M2): la página las pide a R2 con su nombre aleatorio. Si ya pasaron los 30 días, dice «Las fotos se guardan 30 días».

### 6.4 El texto de WhatsApp

Reglas de `packages/whatsapp` (de la bitácora ecommerce y de HU-E2.4): sin emoji al principio, el nombre del negocio desde los datos de la sede y nunca escrito a mano, corto, y el enlace en su propia línea para que WhatsApp lo convierta en vínculo.

```text
Recibo de entrada A-000123 - Parqueadero Ensayo Uno
Placa ABC123 - Carro - 06/10/2026 6:05 p. m.
Estado: rayon puerta trasera derecha.
Tarifa: $230 por minuto, tope $30.000 por dia.
Su recibo:
https://parqueadero.laboratorio-digital.app/r/#1.q1YqU7JSMjQ0NDE3NFLSUcpMUbJS...
Usamos este numero solo para enviarle sus recibos.
```

### 6.5 Pantalla

La pantalla del recibo muestra el mismo enlace como QR grande. El conductor lo escanea con la cámara de su teléfono y abre su recibo: **ni papel, ni número, ni WhatsApp**. Es el canal de menor costo y el que no pide datos personales.

### 6.6 Paridad

`parqueadero-recibos` tiene una prueba de paridad: para cada recibo de prueba, el papel, el enlace decodificado y el texto de WhatsApp dicen el mismo número, la misma placa, la misma hora y el mismo total. Un cambio en una plantilla que rompa la paridad no pasa el CI.

---

## 7. Impresión desde el navegador

**En una frase:** en Android con Chrome y en Windows con Chrome o Edge, la caja le habla directo a la PT-210 por Bluetooth, sin internet, sin app y sin driver. En iPhone no hay camino directo desde el navegador, y eso decide qué equipo usa el cliente como caja (§7.8).

Las fuentes de esta sección llevan la letra I (§21.2).

### 7.1 La GOOJPRT PT-210: lo que se sabe y lo que falta confirmar

El fabricante no publica una ficha oficial con los detalles de Bluetooth. Lo específico del modelo sale de fichas de tiendas y de un SDK de Python **no oficial** (v0.1.0, sin licencia declarada, I41). Por eso:

- **El paso 0 de M0 es medir la unidad del cliente** con nRF Connect (gratis): nombre que anuncia, servicios y características. Se hace antes de escribir el adaptador.
- **El adaptador no se casa con un solo identificador:** prueba una lista y descubre (§7.4).

| Dato | Valor | Evidencia | Se confirma en |
|---|---|---|---|
| Papel | 57–58 mm; rollo de hasta 40 mm de diámetro | *Oferta observada* (I42) | Puesta en marcha |
| Ancho de impresión | 384 puntos (48 mm) a 203 ppp | *Oferta observada* (I42, I44) | Página de prueba |
| Columnas | 32 en la fuente A (12×24), 42 en la B | *Capacidad documentada* del perfil `pos-5890` del codificador (I35) | Página de prueba |
| Comandos | ESC/POS, con QR nativo (`GS ( k`, modelo 2) | *Oferta observada* (I42, I43); *Capacidad documentada* del SDK no oficial (I41) | Página de prueba. Un caso público imprimió el QR deformado con el juego de comandos de Epson (I40) |
| Páginas de códigos | `ESC t 2` = CP850, `16` = WPC1252, `19` = CP858 en el mapeo chino típico. Depende del firmware | *Capacidad documentada* (I35, I41) | Página de prueba (§7.7) |
| Bluetooth | «Bluetooth 4.0». El SDK implementa BLE y Bluetooth clásico (SPP, canal 1) para este modelo: probablemente es de modo dual | *Oferta observada* (I42–I44); *Inferencia* sobre I41 | nRF Connect y emparejamiento |
| Servicio BLE | Servicio `49535343-fe7d-4ae5-8fa9-9fafd205e455`; escritura `49535343-8841-43f4-a8d4-ecbe34729bb3`; notificación `49535343-1e4d-4bd9-ba61-23c647249616`. En otras revisiones del firmware: servicio `0000ff00-…`, escritura `0000ff02-…` | *Capacidad documentada* del SDK no oficial (I41) | nRF Connect |
| Escritura | Sin respuesta, en trozos de 182 bytes con 40 ms entre trozos | *Capacidad documentada* del SDK (I41) | 50 recibos seguidos (§15.3) |
| PIN (solo Bluetooth clásico) | `0000`; otros clones usan `1234` | *Capacidad documentada* (I48); *Inferencia* | Emparejamiento |
| USB | Mini o micro USB, con datos; driver «POS58» para Windows | *Oferta observada* (I44, I45); *Capacidad documentada* (I45) | Solo si se usa con un PC por cable |
| Batería | 1.500 mAh, 7,4 V. No hay dato del apagado automático | *Oferta observada* (I42, I44) | Un turno real |
| Cortador | Las fichas no lo mencionan: se rasga | *Inferencia* | Puesta en marcha |
| Precio en Colombia | COP 122.900–129.900 | *Oferta observada* en Falabella, 6 oct 2026 (I46). Mercado Libre no se pudo consultar | — |

Dos advertencias:

1. **Un módulo de modo dual suele aceptar un solo enlace a la vez** (*Inferencia*). Si el teléfono quedó conectado por Bluetooth clásico, o RawBT tiene la conexión, la impresora puede no aparecer por BLE. El runbook de la impresora (§14.5) empieza por ahí.
2. **La librería de referencia no ve una PT-210.** WebBluetoothReceiptPrinter (MIT) solo acepta el servicio `49535343…` si el nombre empieza por «TM-P» o «STAR L», y su perfil genérico filtra por `18F0` (I36). Por eso el adaptador Bluetooth es propio (§7.4); el codificador sí se usa (§7.3).

### 7.2 Caminos por dispositivo

| Equipo del cliente | Camino 1 | Camino 2 | Respaldo | Veredicto |
|---|---|---|---|---|
| **Android con Chrome**, o la caja instalada como app | Web Bluetooth (Chrome 56+) | Web Serial por Bluetooth clásico (Chrome 138+), con la PT-210 emparejada en Android | RawBT (§7.5) | **Recomendado** |
| **Windows con Chrome o Edge** | Web Bluetooth (Chrome 70+, Windows 10 Creators Update o posterior) | Web Serial al puerto COM que Windows crea al emparejar | Diálogo del sistema con el driver POS58 por USB (§7.5) | Bueno para una caja fija |
| **macOS con Chrome** | Web Bluetooth | Web Serial | — | Posible; no se prueba en M0 |
| **iPhone o iPad**, con cualquier navegador | — | — | Recibo digital, sin papel | **Sin impresión directa** (§7.8) |
| **Firefox** o un navegador dentro de otra app (WebView) | — | Firefox 151+ de escritorio tiene Web Serial con un complemento de permiso | — | La caja dice «Abra la caja en Chrome» |

- Evidencia: *Dato publicado* (I1–I5, I10, I12, I13). Chrome para Android suma Web Serial por USB en la versión 148 (I6).
- Web Bluetooth, Web Serial y WebUSB no existen en el WebView de Android (I1–I3). La caja instalada como app sí los tiene, porque corre en Chrome (*Inferencia*).
- **Ningún camino usa internet al imprimir.** Todos exigen HTTPS, que el sitio ya tiene.
- WebUSB por cable OTG funciona en Android (I3), pero un cable colgando del teléfono no sirve en una caja de pie: no se construye.

**Qué se le recomienda al cliente:** un teléfono Android con Chrome como caja. Si su caja es un iPhone y necesita papel, un Android de gama de entrada **como caja, no solo como impresora**: en M0 cada caja es independiente y el papel sale del dispositivo que registra. La pregunta va en §19.2.

### 7.3 `packages/impresion`: un contrato, varios adaptadores

El paquete no sabe qué es un parqueadero. Recibe un trabajo (bytes ESC/POS, o HTML para el diálogo del sistema) y lo entrega por un adaptador.

```ts
type Camino = 'bluetooth' | 'serial' | 'sistema' | 'rawbt' | 'prueba';

interface Impresora {
  readonly camino: Camino;
  /** Pide permiso y elige el equipo. Solo dentro de un toque del operador. */
  vincular(): Promise<Vinculo>;
  /** Vuelve a conectar sin selector, cuando el navegador lo permite. */
  reconectar(): Promise<boolean>;
  imprimir(trabajo: Trabajo): Promise<Resultado>;
  estado(): 'sin_vincular' | 'conectada' | 'desconectada' | 'ocupada';
}

type Resultado =
  | { ok: true; bytes: number; ms: number; papel: 'desconocido' | 'ok' }
  | { ok: false; motivo: 'cancelado' | 'sin_permiso' | 'fuera_de_alcance' | 'sin_caracteristica'
        | 'tiempo' | 'sin_papel' | 'no_soportado'; detalle: string };
```

- **Lo que el adaptador sabe, y lo que no (P17).** Una escritura sin respuesta por BLE dice que los bytes salieron del teléfono, no que salió papel. Por eso:
  - `papel: 'desconocido'` es lo normal, y la pantalla dice «Enviado a la impresora», no «Impreso».
  - Un botón **«No salió»** reimprime el original, sin marca de copia, y deja registrado el fallo.
  - Si la PT-210 responde a la consulta de estado del papel por su característica de notificación, `papel` pasa a `ok` o el resultado a `sin_papel`. Se prueba en §15.3.
- **Una cola por caja.** Un trabajo a la vez. Uno que falla queda en `entregas_pendientes` (§5.2) con su motivo, y la cabecera lo muestra (P15).
- **Codificador:** `@point-of-sale/receipt-printer-encoder` 4.x (MIT, I35) con el perfil `pos-5890`. Antes de codificar, todo texto que venga de una persona pasa por el filtro de bytes de control (§13.1).
  - **Nota de la construcción (7 oct 2026):** el codificador, con sus páginas de códigos, pesa unos 29 KB con gzip (4.0.1, medido con esbuild), más de un tercio del presupuesto de 80 KB de la caja (HU-Q3.1). Se importa al codificar el primer trabajo, no al abrir la caja, y el service worker lo guarda para trabajar sin red. `lean-qr` entra igual, solo si el QR va como imagen. Bitácora parqueadero 10.
- **QR:** el comando nativo si la página de prueba lo aprobó; si no, una imagen con `lean-qr` (MIT, I56). El nativo ocupa unos 50 bytes y la imagen unos 5 KB (*Inferencia*).
- **Adaptador `prueba`:** guarda los bytes en memoria. Lo usan las pruebas de punta a punta (§15.2) y las de bytes de referencia (§15.1).
- **Licencias:** todo lo que se usa es MIT o Apache-2.0 (I35–I40, I56). Nada AGPL (§15.4).

### 7.4 Web Bluetooth con la PT-210

**1. Vincular.** Un toque en «Conectar impresora». El navegador exige ese gesto y un contexto seguro (I9, I11).

```js
const SERVICIOS = [
  '49535343-fe7d-4ae5-8fa9-9fafd205e455', // PT-210 según el SDK no oficial (I41)
  0xff00,                                  // otras revisiones del firmware (I41)
  0x18f0,                                  // térmicas genéricas (I36, I47)
  'e7810a71-73ae-499d-8c15-faa9aef0c3f2',  // térmicas genéricas (I36, I47)
];
await navigator.bluetooth.requestDevice({
  filters: [{ namePrefix: 'PT' }, ...SERVICIOS.map((s) => ({ services: [s] }))],
  optionalServices: SERVICIOS,
});
```

Si la impresora anuncia otro nombre, «Ver todos los equipos» repite la llamada con `acceptAllDevices: true` y los mismos `optionalServices`.

**2. Encontrar dónde escribir.** La caja recorre los servicios en ese orden y toma la primera característica con `writeWithoutResponse` (o, si no hay, `write`). Guarda en la tabla `impresora` (§5.2) el nombre, el id que da el navegador, el servicio y la característica que funcionaron.

**3. Enviar.**
- Trozos de 180 bytes con `writeValueWithoutResponse` y 30 ms entre trozos. La especificación permite hasta 512 bytes por escritura (I11).
- Si el navegador rechaza un trozo, la caja baja a 100 bytes y 50 ms, reintenta y lo recuerda.
- Un recibo de texto de 1–2 KB sale en 1 o 2 segundos (*Inferencia*). La meta de 10 segundos por entrada (§5.1) lo cubre.

**4. Reconectar.**
- **Mientras la caja siga abierta,** `device.gatt.connect()` sobre el mismo equipo no pide selector. La caja reconecta antes de cada impresión si la impresora se apagó, y escucha `gattserverdisconnected` para mostrarlo.
- **Después de cerrar o recargar la caja,** el operador toca «Conectar» y elige la PT-210 otra vez. `getDevices()`, que lo evitaría, sigue detrás de una bandera en Chrome (I2). Es un toque por turno, y la cabecera lo pide en amarillo.
- La caja no manda bytes para mantener despierta la impresora: podrían imprimir.

**5. Errores que el operador ve.**

| Lo que dice el navegador | Lo que dice la caja | Qué ofrece |
|---|---|---|
| `NotFoundError`: cerró el selector | «No eligió impresora» | Volver a intentar |
| `NetworkError` o desconexión | «La impresora está apagada o lejos» | Reintentar, enviar por WhatsApp o mostrar el QR |
| No hay característica de escritura | «Esta impresora no se reconoce» | El diagnóstico |
| `InvalidModificationError`: trozo muy grande | Nada: baja el tamaño y reintenta | — |
| `SecurityError` | No debería pasar: la caja solo vincula desde un toque | Se registra como evento |

**6. Diagnóstico** (Ajustes › Impresora › Diagnóstico). Muestra el nombre, los servicios y las características con sus propiedades, y el último error. Un botón lo copia como texto para mandarlo a soporte por WhatsApp. Es el primer paso del runbook «La impresora no imprime» (§14.5).

### 7.5 Los otros caminos

**Web Serial, el segundo camino:**

- **Android (Chrome 138+).** La PT-210 se empareja una vez en los ajustes de Bluetooth de Android (PIN `0000`). La caja pide el puerto con `navigator.serial.requestPort()`; el perfil serie estándar (SPP) viene por defecto (I5, I8).
  - A diferencia de Web Bluetooth, `getPorts()` devuelve el puerto en la siguiente sesión, **sin selector** (I1).
  - En Android no hay eventos de conexión y desconexión (I1, I5): la caja reintenta al imprimir.
- **Windows.** El emparejamiento Bluetooth crea un puerto COM virtual que Web Serial abre (Chrome 89+; Bluetooth directo desde la 117, I8). Por USB, el driver de impresora reclama el dispositivo; la librería de referencia recomienda el puerto COM (I37).
- **Cuál es el principal en Android lo decide la prueba con la unidad real** (§15.3). Web Bluetooth no pide emparejar, pero pide elegir la impresora en cada sesión. Web Serial pide emparejar una vez y después reconecta solo. M0 construye los dos.

**Diálogo de impresión del sistema (`window.print()`):**

- Una vista `/caja/imprimir/` con el mismo recibo en HTML a 48 mm, `@page { size: 58mm auto; margin: 0 }` (Baseline 2024, I34) y el QR en SVG.
- **Windows:** la PT-210 por USB con el driver POS58 (I45). Para no ver el diálogo en cada recibo, un acceso directo de Chrome con `--kiosk-printing` imprime en la impresora predeterminada (I33). El runbook de puesta en marcha lo crea.
- **Android:** necesita un servicio de impresión instalado. RawBT lo es (I23); el de código abierto todavía es inmaduro (I27).
- El texto sale como imagen: más lento y menos nítido que ESC/POS (*Inferencia*). Es respaldo, no camino. Sirve también para imprimir un reporte en una impresora normal.

**RawBT (Android, opcional):**

- Una app que recibe el trabajo por un enlace `rawbt:` en base64 e imprime por Bluetooth, USB o red (I23, I25, I26).
- Es gratis, pero imprime un aviso en cada tiquete; sin aviso cuesta USD 30 de por vida o USD 1,50 al mes (I23, I24). Es propietaria.
- No es el camino por defecto: agrega una app, una licencia y un tercero. Queda documentada como salida de emergencia.

**Descartados:**

| Camino | Por qué no |
|---|---|
| Agente local en el PC (QZ Tray, WebApp Hardware Bridge) | Hay que instalarlo. QZ Tray pide «permitir» en cada trabajo sin un certificado Premium de USD 599 al año o un certificado propio en cada equipo (I29–I32) |
| Impresoras de red Epson o Star con su SDK web | Cuestan mucho más, y Chrome 142+ pide permiso de red local (I19, I20, I22) |
| WebUSB en Windows | El driver de impresora reclama el dispositivo (I37) |

### 7.6 Copias, reimpresiones y lo que queda registrado

- **Cada entrega de un recibo es un registro `entrega_recibo`** (anexo A) con el canal (`papel`, `whatsapp`, `pantalla`), el camino de impresión, el resultado y si es copia. No lleva el teléfono ni el texto.
- **Reimprimir** sale con «COPIA n» arriba y queda registrado con el usuario. El cierre de turno cuenta las copias por cajero (§13.1).
- **«No salió»** no es copia: reimprime el original y registra el fallo anterior.
- En M1, solo las copias viajan una por una a la celda. Las demás entregas viajan resumidas en el cierre de turno (§10.3).

### 7.7 Configuración y página de prueba

Un asistente de cuatro pasos en Ajustes › Impresora, que también se corre en la puesta en marcha:

1. **El equipo.** La caja mira qué tiene el navegador (`'bluetooth' in navigator`, `'serial' in navigator`, si es iOS) y propone el camino de §7.2. En iPhone lo dice desde el principio (§7.8).
2. **Vincular** (§7.4 o §7.5).
3. **Página de prueba:**

```text
PRUEBA DE IMPRESORA   06/10/2026
12345678901234567890123456789012
1) CP850    áéíóú ñÑ ¿¡ $
2) WPC1252  áéíóú ñÑ ¿¡ $
3) CP858    áéíóú ñÑ ¿¡ $
4) Sin tildes: aeiou nN ?! $
QR nativo:        [QR]
QR imagen:        [QR]
```

4. **Tres preguntas al operador:** qué línea se lee bien (1, 2, 3 o 4); si los dos QR se ven cuadrados y su teléfono los lee; si la regla de números cabe en una línea. Las respuestas quedan en la tabla `impresora`: la página de códigos (o transliterar), QR nativo o imagen, y las columnas.

Sin la prueba superada, la cabecera dice «Impresora sin probar» en amarillo.

### 7.8 iPhone

- Safari no implementa Web Bluetooth, WebUSB ni Web Serial (I12). Fuera de la Unión Europea, todo navegador de iOS usa el motor de Safari (I13): **Chrome en iPhone tampoco puede.**
- AirPrint necesita una impresora de red (I16), y la PT-210 no lo es. Las térmicas con AirPrint son de red y cuestan más de USD 380 (I17, I18).
- Hay navegadores de terceros con Web Bluetooth: Bluefy (gratis, v3.9.3 de enero de 2026, I14) y beacio (extensión de Safari para iOS 26.2+, sin valoraciones, I15). La caja funcionaría dentro de Bluefy, pero sus datos quedarían separados de Safari, no se instalaría como app y dependería de un solo tercero (*Inferencia*).
- **Recomendación:**
  - Si el cliente solo tiene iPhone y necesita papel, la caja es un Android de gama de entrada.
  - Un iPhone sí sirve como caja **sin papel**, con WhatsApp y el QR en pantalla. Eso empuja la meta de §8.4.
  - Bluefy queda documentado como plan C; no se soporta.

### 7.9 Si el cliente compra otra impresora

- 58 mm, ESC/POS y QR nativo.
- Bluetooth 4.x de modo dual (BLE y SPP).
- CP850, CP858 o WPC1252 en la autoprueba.
- Rollo de 40 mm y USB con datos.
- Antes de pagar, nRF Connect debe mostrar sus servicios GATT.
- 80 mm solo para una caja fija de escritorio.
- En este rango de precio no hay AirPrint (*Inferencia* sobre I16–I18).

---

## 8. WhatsApp: el mismo recibo, en el teléfono del conductor

**En una frase:** en el MVP, el recibo sale del WhatsApp del propio parqueadero por un enlace `wa.me` que la caja arma. Cuesta cero y no le pide nada a Meta. El envío automático por la Cloud API es M3. Y desde el 1 oct 2026 Meta cobra mensajes que el repositorio da por gratis (§8.6).

Las fuentes de esta sección llevan la letra W (§21.3).

### 8.1 Lo que ED1 ya aprendió, y cómo se aplica aquí

| Lección | De dónde | Aquí |
|---|---|---|
| El mensaje sale del WhatsApp del negocio, con `wa.me` y el texto ya escrito | Tienda, «Confirmar por WhatsApp» (TIENDA-3.0 §8); agro, HU-E2.4 y HU-E4.4 | El recibo sale del WhatsApp del parqueadero, nunca de un número de ED1 |
| El navegador del teléfono bloquea abrir WhatsApp si antes esperó a la red | Tienda: por eso el pedido usa dos toques | El enlace se arma al registrar, sin red. El toque solo navega: ningún `await` entre el toque y la apertura |
| Sin emoji al principio; el nombre del negocio sale de los datos | Bitácora ecommerce | Reglas de `packages/whatsapp`, con prueba (§15.1) |
| Ningún valor de fábrica | Bitácora ecommerce («el celular de la primera tienda») | La caja no envía hasta que la sede tiene su nombre y su número |
| El botón dice qué falta | Tienda | «Falta el WhatsApp del conductor», «Falta la autorización» |
| La vista previa del enlace importa | Tienda (Open Graph) | Vista previa genérica: el lector de Meta no ve el fragmento ni la placa (§6.3) |
| Cambiar el número de WhatsApp del negocio es sensible | Tienda: `auth_time` de 10 minutos | PIN de administrador en M0; `auth_time` desde M1 |
| La Cloud API queda fuera del MVP porque la barrera es habilitar el canal | TIENDA-3.0 §20.3; ED1 v1.4 [C] | Se mantiene: M3, solo en planes pagos (§8.5). Lo que cambia es el costo (§8.6) |
| Avisos por WhatsApp solo en planes pagos, con presupuesto y kill switch | ARQUITECTURA §5.10 | `ks:parqueadero-whatsapp` (§14.2) |
| Desde el 15 ene 2026, Meta no deja a los proveedores de IA usar la plataforma si un asistente de propósito general es la función principal | Estudio de ecommerce v1.3, §12.1 | El número del parqueadero solo manda recibos: sin chat de IA |

### 8.2 El envío por `wa.me` en el MVP

**El flujo, en la pantalla del recibo (§5.1):**

1. El operador escribe el número que dicta el conductor. `packages/whatsapp` lo normaliza (`300 123 4567`, `+57 300…` y `57300…` dan `573001234567`). Un número de otro país se elige con su indicativo.
2. La casilla de autorización, **sin marcar** (§8.3). Sin ella, el botón dice «Falta la autorización».
3. El enlace se arma en ese momento, sin red:
   `https://wa.me/573001234567?text=<texto codificado>`. El formato pide el número en internacional, sin `+`, ceros, paréntesis ni guiones (W17).
4. **Un toque en «Enviar por WhatsApp»** abre el WhatsApp del teléfono de la caja, en el chat del conductor, con el recibo escrito (§6.4). **El operador toca Enviar en WhatsApp:** ni el enlace ni la caja pueden enviar solos.
5. Al volver a la caja, la entrega queda registrada como `abierto_en_whatsapp`, no como «entregado»: `wa.me` no devuelve ninguna prueba de entrega (P17). Si el operador no lo envió, toca «No se envió».

**Imprimir y enviar son un solo momento.** Si la sede imprime siempre, el papel sale al registrar y el botón de WhatsApp ya está armado: imprimir no espera a WhatsApp ni WhatsApp al papel.

**Lo que depende del teléfono, y se prueba en §15.3:**

| Situación | Lo esperado | Evidencia |
|---|---|---|
| Android con WhatsApp y WhatsApp Business instalados | Android pregunta cuál usar. La puesta en marcha deja WhatsApp Business del parqueadero como predeterminado | *Inferencia* (W17) |
| PC con Windows | `wa.me` pasa por una página web que necesita red y abre WhatsApp Desktop o Web, con la sesión del parqueadero | *Inferencia* (W17) |
| Teléfono sin red | WhatsApp abre el chat y deja el mensaje en cola hasta reconectar. Abrir el chat de un número no guardado podría necesitar red | *Inferencia*, por probar |
| Un enlace largo | El recibo completo cabe en unos 370 caracteres de enlace (§6.3). Con el texto del mensaje, el enlace `wa.me` mide unos 840 caracteres codificados | Medido el 6 oct 2026; se prueba con WhatsApp real |

**El conductor abre su recibo enseguida.** Como el recibo viaja entero en el fragmento del enlace (§6.3), la página `/r/` lo muestra aunque la caja no haya sincronizado nunca. Un diseño con un id que el servidor resuelve tendría que esperar a la sincronización.

**«Compartir»** (`navigator.share` con el enlace y el texto) es un botón secundario para quien prefiere otro canal. No reemplaza a `wa.me`: no puede fijar el destinatario, y compartir archivos no funciona en Firefox ni en el WebView de Android (W18, W19).

### 8.3 Autorización y datos mínimos

**Lo que exige la norma:**

- La autorización es previa, expresa e informada, y queda en un medio que se pueda consultar (Ley 1581 arts. 3, 9 y 12, W31). Puede ser escrita, oral o por una conducta inequívoca; **el silencio no vale** (Decreto 1377 art. 7, W32).
- Meta pide que la persona haya dado su número y su autorización para recibir mensajes de ese negocio, y que se respeten las bajas. Se puede obtener en persona (W9, W15).
- Los Términos de WhatsApp Business App prohíben los mensajes no solicitados (W16). Un recibo que el conductor pidió y que el operador envía a mano es el uso para el que existe (*Inferencia*).

**Cómo lo hace la caja:**

| Pieza | Forma |
|---|---|
| Casilla | Sin marcar. Texto que el operador lee: «¿Autoriza que le enviemos sus recibos de hoy por WhatsApp a este número?» |
| Registro | Hora, operador y versión del aviso, en la tabla local `contactos` (§5.2). El registro `entrega_recibo` dice que hubo autorización, sin el número |
| Finalidad | Solo los recibos de esta estadía. Nada de promociones: eso necesitaría otra autorización, y la Ley 2300 de 2023 (art. 5) le pone horarios y reglas a lo comercial (W39) |
| Plazo | El número se borra 24 h después de la salida [ADR-38], o al anular la estadía |
| Baja | En M0, el conductor le dice al operador y no se le envía más: no hay lista que mantener, porque el número no se guarda. En M3, la palabra BAJA (§8.5) |
| Aviso de privacidad | La caja trae la plantilla para el parqueadero (§13.2), con su finalidad, sus derechos y su canal de consultas (Ley 1581 art. 12, W31) |

**Lo que queda fuera de la caja.** El chat con el conductor queda en el WhatsApp del parqueadero, con su historial. Eso lo administra el parqueadero como Responsable, no ED1; el aviso de privacidad lo dice.

**Quién es quién** (detalle en §13.2):

- En M0, ED1 no recibe ningún dato: no es Encargado.
- Desde M3, ED1 es Encargado, con un contrato de transmisión dentro de los términos del servicio (Decreto 1377 art. 25, W32), y Meta es subencargado. Estados Unidos figura como país con nivel adecuado de protección en la Circular Externa 005 de 2017 de la SIC (W40).
- **Registro Nacional de Bases de Datos:** solo lo deben hacer las sociedades con activos de más de 100.000 UVT y las entidades públicas (Decreto 090 de 2018, W33). Con la UVT de 2026 en COP 52.374 (W34), el umbral es de unos COP 5.237 millones. Un parqueadero pequeño no lo cruza (*Inferencia*).

### 8.4 Menos papel: la estrategia

**Lo que permite la ley:**

- El parqueadero debe entregar un recibo con fecha y hora, identificación del vehículo, estado y valor (Ley 1480 art. 18 num. 3, W35). Para el estado del vehículo, la ley dice que «podrá utilizarse medios tecnológicos».
- Un mensaje de datos vale como escrito si queda accesible para consulta posterior (Ley 527 art. 6, W38). La SIC ha dicho que la información del recibo puede darse por cualquier medio, incluidos los electrónicos (concepto 17-068254 de 2017, no vinculante, W36; y radicado 18-965 de 2018, I54).
- **Inferencia:** el recibo se expide cuando le llega al conductor. Con `wa.me` no hay prueba de entrega, así que la regla de la caja es: **el conductor elige el recibo digital, o recibe papel.** No hay un modo «nunca imprimir».

**El ajuste de la sede, `papel`:**

| Valor | Qué hace | Cuándo |
|---|---|---|
| `siempre` | Imprime al registrar. WhatsApp y el QR en pantalla se ofrecen además | Las primeras semanas, mientras el parqueadero se acostumbra |
| `salvo_digital` | La caja pregunta «¿Recibo por WhatsApp o en papel?», con WhatsApp primero. Imprime salvo que el conductor haya recibido el digital: WhatsApp abierto, o QR de la pantalla escaneado y confirmado por el operador | **Recomendado** desde que el operador lo maneja sin pensar |

**Los empujones, de menor a mayor esfuerzo:**

1. **Recibo de salida digital por defecto** si la entrada fue digital: el número ya está en el dispositivo.
2. **Mensualidades sin papel:** el abonado recibe todo por WhatsApp.
3. **QR en la pantalla** (§6.5): el conductor que no quiere dar su número también se lleva el recibo sin papel.
4. **El papel lo dice:** «Pida su recibo por WhatsApp» en el pie del tiquete.
5. **Un aviso en la entrada:** una herramienta gratuita genera el letrero con las tarifas, los derechos del usuario y la invitación al recibo digital (§2.4).
6. **M3, autoservicio:** un QR en la entrada abre el WhatsApp del parqueadero con el texto `RECIBO ABC123`. El conductor lo envía, eso abre la ventana de 24 h y cuenta como autorización por conducta inequívoca, y la caja le responde con su recibo (§8.5).

**Por qué le conviene al conductor:** el papel térmico se borra con calor, sol, humedad y grasa (I52, I53), y un tiquete en el tablero del carro puede borrarse en días (*Inferencia*). El recibo digital no.

**Por qué le conviene al parqueadero:**

- Un rollo de 57 mm × 20 m cuesta unos COP 2.200 (8 por COP 17.500, I49) y da unos 150 a 200 recibos (*Inferencia*): de **COP 11 a 15 por recibo**.
- Un parqueadero con 300 vehículos al día y dos recibos por vehículo gasta de COP 6.600 a 9.000 diarios en papel, unos **COP 200.000 a 270.000 al mes** (*Inferencia*). Es más que el precio de la PT-210.
- La caja le muestra al parqueadero los recibos por canal, el papel ahorrado y su valor en pesos (§14.4).

**La meta:** la fija el dueño con el cliente antes del día 1, como métrica de la excepción declarada (§18.2).

### 8.5 M3: WhatsApp Cloud API

**Cuándo:** cuando un parqueadero pague un plan que cubra los mensajes y tenga su negocio verificado en Meta (§19.3). Antes, `wa.me`.

**El modelo: cada parqueadero es dueño de su número.**

| Modelo | A favor | En contra | Decisión |
|---|---|---|---|
| **Registro integrado (Embedded Signup), con ED1 como Tech Provider** | Cada parqueadero tiene su cuenta de WhatsApp Business, su número, sus límites y su calidad. Encaja con que el parqueadero sea el Responsable | ED1 necesita verificación y revisión de app (W11). Cada parqueadero le paga a Meta con su tarjeta: un Tech Provider no tiene línea de crédito; un Solution Partner sí (W11, W12) | **Elegido** [ADR-35] |
| Un número de ED1 para todos | Una verificación, unas plantillas, una factura | Al inicio, 250 usuarios únicos en 24 h compartidos entre todos. Calidad compartida. El remitente no es el parqueadero, y la política prohíbe tergiversar la afiliación (W6, W15) | Descartado |
| On-Behalf-Of | — | Cerrado: el último registro fue el 29 sep 2025 (W13) | No existe |

**Coexistencia.** El parqueadero conserva su número en la app de WhatsApp Business y lo conecta a la API (W14):

- Requiere la app 2.24.17 o posterior, y solo se activa a través de un Tech Provider o un Solution Partner.
- Lo que el operador envía desde la app sigue gratis; lo que envía la API se cobra.
- Hasta 20 mensajes por segundo, y sin listas de difusión.
- Meta no publica exclusiones por país. Terceros la reportan disponible en todo el mundo salvo Nigeria y Sudáfrica (W30).

**Las piezas, en la celda (`parqueadero-api`):**

```text
caja ──sync: entrega_recibo (canal whatsapp_api)──► API ──► Cola ──► Graph API: POST /<PHONE_NUMBER_ID>/messages
                                                            │              (fetch y token Bearer, W7)
caja ◄──estado en el pull── registro entrega_recibo ◄── /api/whatsapp/webhook ◄── Meta: sent, delivered, read, failed
                                                        (firma X-Hub-Signature-256 con HMAC-SHA256
                                                         y comparación en tiempo constante, W20)
```

- **Sin SDK:** el oficial de Node está archivado desde el 7 jun 2023 (W21). `fetch` y Web Crypto del Worker bastan (W20).
- **El token de cada parqueadero** se guarda cifrado con el sobre de `packages/cifrado` (de la Tienda).
- **El número del conductor** viaja cifrado en la operación de sincronización, queda en la celda con su autorización y se borra 24 h después de la salida [ADR-38].
- **Estados:** Meta reintenta los mensajes hasta 30 días y los webhooks hasta 7 días (W7, W8). `read` no está garantizado. Un `failed` aparece en la caja con «Imprimir el recibo».
- **Baja:** un mensaje con la palabra BAJA, por parqueadero y por número (guardado como huella), y no se le vuelve a enviar.
- **Kill switch:** `ks:parqueadero-whatsapp` devuelve la caja a `wa.me` (§14.2).

**La plantilla `recibo_parqueo` (categoría utilidad):**

- Contenido no promocional sobre algo que el conductor pidió. Un recibo califica (W3).
- Cuerpo con el número, la placa, la hora y el total; un botón URL al recibo con sufijo dinámico de hasta 2.000 caracteres (W4). Si Meta no acepta el fragmento `#` en la URL de la plantilla, el sufijo es un id corto con un código que la celda resuelve (por probar).
- **Nada promocional.** Desde el 9 abr 2025 Meta recategoriza sola las plantillas mixtas como marketing, con un día de aviso (W3). En Colombia eso pasa el mensaje de USD 0,0008 a USD 0,0125 (§8.6). El presupuesto y el vigía lo detectan (§14.1).
- Revisión automática en 24 h o menos (W4, W5).

**Límites:** un portafolio nuevo puede escribir a 250 usuarios únicos en 24 h fuera de la ventana. Sube a 2.000, 10.000, 100.000 e ilimitado con la verificación del negocio o con 2.000 entregas de buena calidad en 30 días (W6). El autoservicio (§8.4) no gasta ese límite, porque el conductor escribe primero.

**Intermediarios (BSP), si ED1 no quiere ser Tech Provider** (*Oferta observada*):

| Proveedor | Cargo sobre la tarifa de Meta |
|---|---|
| Meta directo | Ninguno |
| Gupshup | USD 0,001 por mensaje; 6 % más en marketing sin MM Lite desde el 1 ene 2026 (W24, W25) |
| Twilio | USD 0,005 por mensaje, entrante o saliente (W22) |
| 360dialog | €49 a €500 al mes por número; plan de partner desde €250 al mes más €15 a €49 por canal (W23) |
| Infobip | Bajo cotización (W26) |

**Recomendación:** Meta directo, con ED1 como Tech Provider. Un BSP agrega un cargo por mensaje o por número que, con estos volúmenes, cuesta más que el mensaje.

### 8.6 Lo que cambió el 1 oct 2026, y contradice al repositorio

**El dato.** La página oficial de Meta «Pricing for non-template messages» (W2), que se presenta como la de los cambios próximos, dice que desde el 1 oct 2026:

- Meta cobra los mensajes de servicio (texto libre dentro de la ventana de 24 h), que no se cobraban desde noviembre de 2024.
- Meta cobra las plantillas de utilidad enviadas en respuesta a un usuario dentro de la ventana.
- Los mensajes dentro de las 72 h gratis que abre un anuncio de clic a WhatsApp siguen gratis.

La página general de precios (W1) sigue diciendo que los mensajes que no son plantilla y las plantillas de utilidad dentro de la ventana son gratis, con vigencia desde el 1 jul 2025. **Las dos son de Meta y se contradicen.** Ambas se leyeron el 6 oct 2026 (hora de Colombia) con una herramienta que resume la página: antes de corregir la bitácora, alguien las abre en el navegador.

**Lo que el repositorio dice hoy:** que dentro de la ventana esos mensajes son gratis (ED1 v1.4 [C]; TIENDA-3.0 §0 y §20.3), y la bitácora registra como afirmación falsa justamente el cobro desde el 1 oct 2026 (`BITACORA.md`, «Afirmaciones falsas» 3). Esa corrección se apoyó en la página general. La página de cambios próximos le da la razón a la afirmación original. Propuesta en §20.

**Lo que no cambia:** la barrera de la Cloud API sigue siendo habilitar el canal, y el MVP no la usa. `wa.me` sigue costando cero.

**Tarifas de Colombia desde el 1 oct 2026** (USD por mensaje entregado). Salen de reproducciones de terceros que coinciden; el archivo oficial de Meta no se pudo leer (W27):

| Categoría | USD |
|---|---|
| Marketing | 0,0125 |
| Utilidad | 0,0008 |
| Autenticación | 0,0008 |
| Servicio | 0,0008 |

- Meta factura en pesos colombianos desde el 1 abr 2026 (W1), pero los valores en COP no se obtuvieron.
- Los descuentos por volumen solo existen en utilidad y autenticación, por mercado y por mes (W1). Con estos volúmenes aplica la tarifa de lista (*Inferencia*).
- Varios BSP reportan 1.000 mensajes de servicio gratis al mes por número (W28). La página de Meta no lo menciona: **no se presupuesta con él.**

**Costo por 1.000 recibos** (a COP 4.000 por dólar, un supuesto):

| Escenario | USD | COP |
|---|---|---|
| `wa.me` (M0) | 0 | 0 |
| Plantilla de utilidad, Meta directo | 0,80 | ≈ 3.200 |
| Ídem, vía Gupshup | 1,80 | ≈ 7.200 |
| Ídem, vía Twilio | 5,80 | ≈ 23.200 |
| Ídem, vía 360dialog | 0,80 + €49 al mes por número | — |
| Si Meta la recategoriza como marketing | 12,50 | ≈ 50.000 |
| Autoservicio con mensaje de servicio | 0,80 (0 si existiera la franquicia de 1.000) | 0–3.200 |

**Lectura:** el mensaje cuesta menos que el papel que reemplaza (COP 11 a 15, §8.4). Lo caro de M3 es el registro de cada parqueadero en Meta y su soporte, no la tarifa (*Inferencia*).

### 8.7 Lo que no se hace

| No | Por qué |
|---|---|
| Automatizar WhatsApp Web o la app (bots, extensiones) | Lo prohíben los términos, y el número del parqueadero se puede perder (W15, W16) |
| Un número de ED1 que envía a nombre de los parqueaderos | §8.5 |
| Promociones por el mismo canal | Otra finalidad, otra autorización; además, la plantilla pasaría a marketing (§8.5) |
| Un asistente de IA en el número del parqueadero | Regla de Meta desde el 15 ene 2026 (§8.1) |
| Guardar el número del conductor en la celda antes de M3 | ADR-38 |

---

## 9. Tarifas (`packages/parqueadero-tarifas`)

### 9.1 El modelo

- **Tarifa** (catálogo, por sede y tipo de vehículo, con versión): modo (`minuto`, `fraccion`, `hora`), valor, tamaño de la fracción, minutos de gracia, tope por bloque de 24 h, franja nocturna con valor fijo, valor del tiquete perdido y redondeo (`ninguno`, `abajo_50`, `abajo_100`).
- **Tope de ciudad** (contenido, `content/parqueadero/topes.json`): ciudad, norma, vigencia, tipo de vehículo, máximo por minuto, regla del minuto iniciado. Para Bogotá desde el 30 ene 2026: COP 230 por minuto para carros y COP 161 para motos, COP 253 y 177 con sello de oro (Decretos 026 y 027 de 2026; estudio §1.1, *Norma*). La sede declara el suyo, que no puede pasar del máximo.
- **Liquidación** (pura): `liquidar(entrada, salida, tarifa, tope, abonado?, perdido?)` devuelve los minutos, las líneas con su concepto, el subtotal, el redondeo, el total y los avisos. Sin reloj ni red: recibe los instantes.

### 9.2 Reglas que el motor garantiza

1. **El total nunca pasa el tope legal.** `total ≤ minutos × tope_por_minuto` cuando la ciudad tiene tope. Una tarifa que lo rompería no se puede guardar, y la caja dice por qué. Una prueba de propiedad recorre duraciones de 1 minuto a 30 días.
2. **El redondeo solo baja.** Redondear hacia arriba puede cobrar más que el tope; por eso el motor solo ofrece redondeos hacia abajo (*Inferencia de diseño*; se confirma con la norma de cada ciudad).
3. **Un tope vencido grita.** Si el tope de la ciudad tiene más de 13 meses, la caja avisa en la cabecera: «el tope de Bogotá no está actualizado». No deja de cobrar (P1, P15).
4. **Lo mismo en todas partes.** La calculadora gratuita y la caja importan el mismo paquete (P2). La calculadora es la vitrina del motor.
5. **Pesos enteros.** Nada de `REAL` ni de `Number(x) || 0` (bitácora ecommerce). **Nota del plan (7 oct 2026):** las reglas son las de `@ed1/dinero`, que ya está en `main` (`pesos()`, `formatearPesos()`, `MontoIlegible`); `parqueadero-tarifas` y `parqueadero-recibos` no tienen funciones de pesos propias (HU-Q1.1, HU-Q1.4; bitácora parqueadero 5).

### 9.3 Pruebas

- **Tabla de casos** compartida: gracia exacta, minuto 0, cruce de medianoche, estadía de 3 días con tope diario, nocturna que empieza y termina, tiquete perdido, abonado que vence en medio de la estadía.
- **Reloj (P8):** la batería corre con `TZ=America/Bogota` y con `TZ=Pacific/Kiritimati`, el 31 de diciembre y el 29 de febrero de 2028.
- **Control negativo (P5):** subir una tarifa por encima del tope tiene que poner en rojo la prueba de propiedad.

---

## 10. Modelo de datos del servidor (M1)

### 10.1 Dónde vive cada dato

| Dato | M0 | M1 | M2 | M3 |
|---|---|---|---|---|
| Registros y catálogos | Dispositivo | Dispositivo y celda (D1) | Igual | Igual |
| Fotos del estado | Dispositivo | Dispositivo | R2, 30 días | Igual |
| WhatsApp del conductor | Dispositivo, hasta 24 h después de la salida | Igual | Igual | Celda, cifrado y con consentimiento (§8.5) |
| Configuración de la impresora | Dispositivo | Dispositivo | Dispositivo | Dispositivo |
| Llave privada del dispositivo | — | — | Dispositivo, no exportable | Igual |
| Plan, roles, usuarios | — | CORE | CORE | CORE |

### 10.2 El shard (`sql/parqueadero/0001_parqueadero_v1.sql`, anexo A)

Es el modelo de la celda agro (registros inmutables, catálogos con historial, cuarentena, `seq` por organización), con lo que el parqueadero necesita encima:

| Pieza | Para qué |
|---|---|
| `ref_tipo_registro` con `lleva_numero`, `abre_estadia` y `pide_anula` | La regla vive en la tabla de referencia, no en un `CHECK` por tipo: un tipo nuevo es un `INSERT` (R1) |
| `registro.estadia_id` | Agrupa entrada, salida y anulaciones. **Sin clave foránea:** una salida hecha sin red en otra caja puede llegar antes que su entrada, y eso no es un error |
| `registro.serie` y `consecutivo`, únicos por parqueadero | El número de recibo no se repite, y solo lo usa el dispositivo dueño de la serie |
| `dispositivo` | Series, llaves públicas y certificados (M2) |
| Triggers `registro_inmutable` y `registro_sin_borrado` | La base rechaza `UPDATE`. `DELETE` solo pasa con una fila en `purga`, que exige la huella de la exportación entregada (P21) |
| `purga` | El retiro de los datos de un parqueadero que se va, después de entregarle todo |

**Un hallazgo que cambia cómo se escribe el push:** `INSERT OR IGNORE`, el que usa la celda agro, también se salta en silencio las violaciones de `CHECK` y de unicidad, no solo el id repetido. El parqueadero usa `INSERT … ON CONFLICT (id) DO NOTHING`: el reenvío no duplica y un número repetido **falla** y va a cuarentena. La prueba lo demuestra con su control negativo (§20).

**El push de un lote con una operación mala:** un `batch` de D1 es todo o nada. Si falla, la API reintenta las operaciones de a una y manda a cuarentena solo la que falla. La prueba lo recorre.

### 10.3 Volumen y costo

Con los supuestos del estudio (150 vehículos al día; estudio §9.3):

| Escritura | Filas | Por qué |
|---|---|---|
| Entrada | 3 | Tabla, `registro_pull`, `registro_numero` |
| Salida | 3 | Ídem |
| Entregas de recibo | 0 por recibo | Viajan resumidas en el cierre de turno (por canal). Solo las **copias** viajan una por una, porque son el control de fraude |
| Cierre de turno y movimientos | Unas 10 al día | — |

Unas 6 filas por vehículo, 900 al día, y 1.800 con el margen ×2 del estudio. Con Workers Paid (50 M de filas al mes incluidas) caben unos 550 parqueaderos al 60 %; el costo marginal es de centavos de dólar por parqueadero al mes (estudio §9.3).

**Nota del plan (7 oct 2026):** el 6 oct el dueño decidió que Workers Paid ya no es condición y se activa solo si hace falta. En el plan gratuito, D1 permite 100.000 filas escritas al día para toda la cuenta: a 1.800 por parqueadero caben unos 55, si fueran los únicos (*Inferencia*). M1 se diseña para el plan gratuito, con su presupuesto en filas y su vigía (HU-Q7.13), y Workers Paid se activa cuando el vigía pase del 75 % de forma sostenida o M3 lo exija (D-Q10). Bitácora parqueadero 6.

---

## 11. Cuentas, sincronización y dispositivos (M1–M2)

### 11.1 El producto en el CORE

Una entrada en `infrastructure/productos.json` (PLATAFORMA §4.2): un archivo y un despliegue, no una migración.

```json
{
  "id": "parqueadero",
  "nombre": "Parqueadero",
  "estado": "activo",
  "excepcion": "ADR-31",
  "app": {
    "origenes": {
      "produccion": "https://parqueadero.laboratorio-digital.app",
      "staging": "https://parqueadero--staging.laboratorio-digital.app"
    },
    "rutas_de_vuelta": ["/caja/"]
  },
  "tipos": ["parqueadero"],
  "roles": [
    { "id": "propietario", "administra": true, "invitable": true },
    { "id": "administrador", "administra": false, "invitable": true },
    { "id": "cajero", "administra": false, "invitable": true }
  ],
  "planes": "content/parqueadero/planes.json",
  "politica": "content/parqueadero/privacidad/politica.json",
  "prefijo_de_cobro": "parqueadero",
  "gracia_dias": 7
}
```

- **Una organización es una sede.** Varias sedes son varias organizaciones de la misma persona (PLATAFORMA §4.1). El reporte consolidado llega con el plan Varias sedes (estudio §10.3).
- **`gracia_dias: 7`**, como la tienda: un parqueadero no puede dejar de recibir carros porque olvidó pagar. Y en el parqueadero ni siquiera puede: la caja es local (§14.2).
- **Operadores sin Google:** el enlace mágico por correo (PLATAFORMA §4.11) y las invitaciones por WhatsApp con el código en el fragmento.

### 11.2 Roles y permisos

Matriz como dato, la misma en la celda y en el dispositivo (como `packages/sync/src/permisos.ts`):

| Acción | Propietario | Administrador | Cajero |
|---|---|---|---|
| Registrar entrada y salida, cobrar, imprimir, enviar | Sí | Sí | Sí |
| Abrir y cerrar su turno | Sí | Sí | Sí |
| Anular | Sí | Sí | Solo lo suyo, en los primeros 10 minutos, con motivo |
| Reimprimir (copia) | Sí | Sí | Sí, queda registrada |
| Tarifas, datos legales, textos del recibo | Sí | Sí | No |
| Ver reportes de todos los turnos | Sí | Sí | Solo el suyo |
| Dispositivos: dar de alta, retirar | Sí | Sí | No |
| Equipo, plan y pago | Sí | No | No |

### 11.3 Reclamar lo local

Igual que el cuaderno (HU-E4.3): al crear la cuenta, el dispositivo sube lo que tenía con los mismos ids. La celda escribe primero, verifica y solo entonces el dispositivo marca lo local como enviado (P21). La serie del dispositivo se conserva (§5.4).

### 11.4 Dispositivos y certificados (M2)

1. **Alta:** el dispositivo genera su par Ed25519 con WebCrypto, con la llave privada no exportable, y manda la pública. La celda le asigna una serie y le devuelve un certificado firmado con su llave de recibos (`CELDA_RECIBO_PRIVATE_KEY`, que se genera una vez y no se reemplaza, como la de los QR del agro).
2. **Renovación:** el certificado vence a los 30 días y se renueva solo en cada sincronización de la última semana. Un dispositivo que pasa más de 30 días sin red firma con un certificado vencido, y la página lo dice en ámbar (§6.3).
3. **Retiro:** retirar un dispositivo corta su sesión y no renueva su certificado. Lo que firmó antes sigue siendo válido.
4. **Compatibilidad:** Ed25519 en WebCrypto es lo que el cuaderno ya usa para verificar (ARQUITECTURA §5.3). Si un navegador no lo tiene para firmar, la caja emite sin firma y lo dice; no cambia a una llave exportable en silencio.

---

## 12. API de la celda (`parqueadero-api-c{N}`, M1)

Convenciones de la celda agro: Hono, solo `/api/*`, token del CORE con `aud = parqueadero` verificado sin llamar al CORE, `org_id` del token en cada consulta, `503` con `Retry-After` si el kill switch está apagado.

| Ruta | Qué hace | Hito |
|---|---|---|
| `GET /api/salud` | Prueba de humo, sin token | M1 |
| `POST /api/v1/sync/push` | Hasta 25 operaciones; acks `aceptado`, `duplicado`, `cuarentena`, `reintentar` | M1 |
| `GET /api/v1/sync/pull` | Cambios después de los cursores de registros y catálogos | M1 |
| `POST /api/v1/reclamar` | Carga idempotente de un `parqueadero-export/1` hecho sin cuenta | M1 |
| `POST /api/v1/dispositivos` · `/retirar` | Alta con serie; retiro | M1 |
| `POST /api/v1/dispositivos/certificado` | Emite o renueva el certificado de firma | M2 |
| `GET /api/claves-recibo` | Llaves públicas de la celda, que el despliegue hornea en `/r/` | M2 |
| `PUT /api/v1/fotos/{nombre}` | WebP de hasta 300 KB, con cuota por plan | M2 |
| `POST /api/v1/exportar` | Exportación completa a R2 con enlace temporal | M1 |
| `POST /api/servicio/plan` | El CORE avisa un pago (PLATAFORMA §4.13) | M1 |
| `POST /api/v1/whatsapp/enviar` | Encola un recibo para la Cloud API | M3 |
| `GET`·`POST /api/whatsapp/webhook` | Verificación y estados de Meta, con la firma `X-Hub-Signature-256` comprobada | M3 |

---

## 13. Seguridad, privacidad y cumplimiento

### 13.1 Amenazas y controles

| Amenaza | Control |
|---|---|
| Un recibo alterado o inventado | Firma por dispositivo y certificado (M2). En M0, la prueba es el registro del parqueadero y la hora del mensaje en el WhatsApp del conductor, que pone un tercero |
| Un cajero que cobra y no registra, o reimprime para cobrar dos veces | Consecutivos por serie sin huecos; copias marcadas «COPIA» y registradas; anular pide motivo y rol; el cierre de turno muestra diferencias, anulaciones y copias por cajero |
| Texto del operador que manda comandos a la impresora | El codificador elimina los bytes de control (ESC, GS, DLE y los demás menores que 0x20, salvo el salto de línea) de todo texto que venga de una persona. Hay prueba |
| Texto que rompe el enlace de WhatsApp | `encodeURIComponent` en un solo lugar (`packages/whatsapp`), con prueba de tildes, `#`, `&` y saltos de línea |
| Teléfono robado | M0: PIN de administrador para ajustes, anulaciones y respaldo; el riesgo de los datos en el teléfono se dice. M1: retirar el dispositivo corta su sesión; tokens de 12 h |
| Otro teléfono se conecta a la impresora | Por BLE, la PT-210 acepta a quien esté cerca, sin emparejar (§7.5). Riesgo bajo: solo imprime. El papel falso se distingue por el QR verificado (M2) |
| Un recibo falso que llega por WhatsApp desde otro número | El recibo verdadero llega del número del parqueadero, que el conductor ve, y su enlace es de un solo dominio |
| Fuga de placas, fotos o números | Números solo en el dispositivo; fotos con nombre aleatorio y 30 días; la placa viaja en el fragmento y nunca en registros de acceso; `org_id` en toda consulta |
| Página del recibo comprometida | CSP `'self'`, sin terceros, verificación con llaves horneadas en el build, assets con huella |

### 13.2 Ley 1581 de 2012: quién es quién

| Hito | Responsable | Encargado | Qué cambia |
|---|---|---|---|
| M0 | El parqueadero | Nadie: ED1 no recibe datos | La caja trae la plantilla de política y el aviso de privacidad para el parqueadero |
| M1–M2 | El parqueadero | ED1, que guarda registros, placas y fotos | Contrato de transmisión con el parqueadero; política de ED1 como encargado; exportación y purga (P21) |
| M3 | El parqueadero | ED1 y Meta (WhatsApp), con el número del conductor | Consentimiento registrado con su texto y su hora; finalidad única (recibos); baja con una palabra |

Controles técnicos: la autorización del número es una casilla sin marcar, con el texto que el operador lee; la finalidad es solo enviar recibos; el número se borra 24 h después de la salida; nada personal en GitHub Actions ([H6]) ni en los eventos.

### 13.3 Ley 1480, Ley 527 y la DIAN

- **Ley 1480 art. 18 y Circular Única:** los campos de §6.1 son una prueba del CI, no una lista de deseos.
- **Ley 527 art. 6:** el recibo digital vale si queda accesible para consulta. La página `/r/` lo deja accesible con solo el enlace, sin cuenta y sin que el parqueadero siga siendo cliente.
- **El papel no desaparece por decreto de la caja:** si el conductor no tiene WhatsApp ni teléfono, el recibo se imprime. «Sin papel» es una preferencia de la sede, nunca una imposibilidad (§8.4).
- **DIAN:** el recibo de la caja no es factura ni tiquete POS electrónico. Integrar el facturador del parqueadero es M4, con su disparador (§19.3).

---

## 14. Operación

### 14.1 Presupuesto (`apps/parqueadero-api/product.yaml`, desde M1)

- `presupuesto.usd_mes`: lo fija el dueño. Con Workers Paid ya pagado por la Tienda, el costo marginal por parqueadero es de centavos (§10.3).
- El vigía de la plataforma proyecta el costo del mes y avisa por Telegram al 50, 75 y 90 % (PLATAFORMA §4.10).
- **Nota del plan (7 oct 2026):** mientras la cuenta esté en el plan gratuito, el presupuesto también se cuenta en filas escritas de D1 por día, y el vigía avisa antes del límite de la cuenta (HU-Q7.13, §10.3).

### 14.2 Kill switches y degradación

| Clave | Apaga | Lo que sigue funcionando |
|---|---|---|
| `ks:parqueadero` | Toda la API de la celda | **La caja entera:** registra, cobra, imprime y envía por `wa.me`. Sincroniza cuando vuelva |
| `ks:parqueadero-fotos` | La subida de fotos | Las fotos se quedan en el dispositivo |
| `ks:parqueadero-whatsapp` | La Cloud API (M3) | El envío por `wa.me` |
| `ks:core:parqueadero` | Entrar, renovar y pagar | Los dispositivos con sesión siguen; los demás trabajan en local |

**La propiedad que más importa:** ningún kill switch ni presupuesto agotado detiene una entrada, un cobro o un recibo, porque todo eso es local. La degradación apaga primero las fotos, luego el WhatsApp automático, y nunca la venta.

### 14.3 Crons, respaldos y avisos

- Un solo cron despachador por celda, como en el agro: vigía cada hora, respaldo semanal a R2 y copia cifrada al Drive del dueño (ADR-30), purga de exportaciones vencidas, y en M3 el reintento de la cola de WhatsApp.
- Alertas al dueño por Telegram (ADR-16).

### 14.4 Medición

- Eventos anónimos a Analytics Engine por `/_m` del Worker del sitio, en lote y cuando hay red, como la Tienda (TIENDA-3.0 §11.6). Sin placas, sin números, sin IP.
- Eventos: `recibo_entregado` (canal y tipo), `impresion_fallida` (adaptador y causa), `copia_impresa`, `respaldo_hecho`, `turno_cerrado`, `tiempo_de_salida` (segundos).
- En la caja, para el parqueadero: recibos por canal, papel ahorrado y su valor en pesos (§8.4).

### 14.5 Runbooks (`docs/runbooks/`)

1. **Puesta en marcha de un parqueadero:** datos legales completos, tarifas contra el tope, impresora con página de prueba superada, WhatsApp Business del parqueadero, aviso de privacidad impreso, primer respaldo.
2. **Cambio anual de topes:** leer el decreto, actualizar `topes.json`, publicar, verificar la calculadora y la caja.
3. **La impresora no imprime:** diagnóstico por pasos (§7.4).
4. **Retirar un dispositivo** perdido o robado.
5. **Un parqueadero se va:** exportar, entregar, verificar la huella, purgar (P21).

---

## 15. Calidad y pruebas

### 15.1 Unitarias (Vitest)

| Paquete | Qué exige | Control negativo (P5) |
|---|---|---|
| `parqueadero-tarifas` | Tabla de casos, reloj, total ≤ tope | Una tarifa sobre el tope |
| `parqueadero-recibos` | Campos de la ley en cada salida; paridad; 32 columnas; transliteración | Quitar el NIT de una plantilla |
| `impresion` | Bytes ESC/POS de referencia por recibo; trozos del tamaño pedido; QR; filtro de bytes de control | Dejar pasar un `ESC` de una nota |
| `whatsapp` | Números de Colombia (`300 123 4567`, `+57 300…`, `57300…`), texto sin emoji al inicio, codificación | Un emoji al principio |
| `firma` | Firmar, verificar, certificado vencido, fragmento alterado, tamaño del QR | Cambiar un byte del fragmento |
| `parqueadero-schema` | Contratos de cada versión publicada (P10) | Borrar un campo de un contrato |

### 15.2 De punta a punta (Playwright, 360 px, axe)

- Entrada → recibo → impresora de prueba (un adaptador falso que guarda los bytes) → enlace de WhatsApp con el número y el texto correctos → salida → liquidación → cierre de turno impreso.
- Todo con la red apagada (`setOffline(true)`).
- Una actualización de la app con una impresión en curso: no recarga.
- **Dos parqueaderos de prueba** con datos distintos (P4): Parqueadero Ensayo Uno (Bogotá, carros y motos, tope de ciudad, impresión siempre) y Parqueadero Ensayo Dos (otra ciudad sin tope, solo WhatsApp, mensualidades).

### 15.3 En el equipo real (P16)

El MVP no se entrega sin esta matriz, registrada en `docs/parking/validacion/impresion-pt210.md` con la fecha, el modelo del teléfono y la versión del navegador:

| Caso | Android + Chrome | Windows + Chrome o Edge | iPhone |
|---|---|---|---|
| Vincular la PT-210 y página de prueba (ñ, tildes, QR) | Debe pasar | Debe pasar | Ver §7.2 |
| 50 recibos seguidos | Debe pasar | Debe pasar | — |
| Paso 0: nombre, servicios y características con nRF Connect | Se anotan | — | — |
| La impresora se apaga sola y vuelve, con la caja abierta | Reconecta sin volver a elegir | Ídem | — |
| La caja se cierra y se vuelve a abrir | Web Bluetooth: un toque en «Conectar». Web Serial: reconecta sola. Se elige el camino principal (§7.5) | Ídem | — |
| Sin papel | Si la PT-210 lo reporta, la caja lo dice; si no, «No salió» reimprime (§7.3) | Ídem | — |
| QR del papel leído por tres teléfonos distintos | Abre `/r/` | Abre `/r/` | Abre `/r/` |
| Enviar por WhatsApp | Abre el chat con el texto | Abre WhatsApp Desktop o Web | Abre el chat |
| Modo avión de punta a punta | Registra, imprime y deja el mensaje en cola | Ídem | Registra y envía |

### 15.4 CI

Lint, tipos y pruebas de lo afectado; licencias (una AGPL rompe el build); la prueba de este SQL; las pruebas de repositorio (`org_id` en consultas, secretos). Objetivo de menos de 8 minutos (ARQUITECTURA §7.2).

---

## 16. En el monorepo

```text
plataforma/
├── apps/
│   ├── parqueadero-sitio/     sitio, herramientas, /r/ y la caja en /caja/ (assets) + /_m
│   ├── parqueadero-caja/      PWA (se construye dentro del sitio)
│   └── parqueadero-api/       celda: sync, dispositivos, firma, fotos, exportar; crons; [M3] WhatsApp
├── packages/
│   ├── parqueadero-tarifas/   liquidación pura
│   ├── parqueadero-recibos/   modelo Recibo y sus cuatro salidas
│   ├── parqueadero-schema/    zod, versiones y contratos
│   ├── impresion/             adaptadores y ESC/POS, sin conceptos de parqueadero
│   ├── whatsapp/              enlaces wa.me y reglas del texto (sale del agro y la tienda)
│   ├── firma/                 fragmento firmado (sale de trazabilidad)
│   └── sync/                  protocolo sin entidades del agro
├── content/parqueadero/       topes.json, planes.json, privacidad/, textos legales del recibo
├── infrastructure/            productos.json (+parqueadero), celdas.json (+c2), dominios.json (+reservado)
│                              migraciones/parqueadero/ (desde docs/parking/sql en M1)
└── docs/parking/              estudio, esta arquitectura, sql/, validacion/
```

Versión propia del producto (`parqueadero-vX.Y.Z`) y despliegue por anillos, como PLATAFORMA §6.3.

---

## 17. Costos

| Concepto | M0 | M1–M2 | M3 |
|---|---|---|---|
| Nube | USD 0: assets estáticos gratis; eventos dentro de la capa gratuita | Centavos por parqueadero al mes con Workers Paid (§10.3) | Igual, más la cola |
| WhatsApp | USD 0 (`wa.me`) | USD 0 | USD 0,0008 por recibo, unos COP 3,2 (§8.6). Lo paga cada parqueadero a Meta |
| Impresora | COP 122.900–129.900 (*Oferta observada*, §7.1). El cliente ya la tiene | — | — |
| Papel | COP 11 a 15 por recibo (*Inferencia*, §8.4) | Baja con cada recibo digital (§8.4) | — |
| Dominio | Ya registrado (`dominios.json`) | — | — |

**Lectura.** El MVP no le cuesta a ED1 nada por parqueadero. El costo que decide la economía sigue siendo el soporte (estudio §10.4), y en M3 el del mensaje, que se paga solo con un plan que lo cubra.

**Nota del plan (7 oct 2026):** M1 y M2 se planean en el plan gratuito de Cloudflare, con el vigía de filas de HU-Q7.13. Los «centavos por parqueadero con Workers Paid» de esta tabla aplican solo si se activa (D-Q10, §10.3).

---

## 18. Hitos

Supone las 20 horas por semana del dueño, con el asistente haciendo los commits (ARQUITECTURA §13). Las duraciones son estimaciones, no compromisos.

> **Las historias, los sprints y las fechas de estos hitos están en `BACKLOG-PARKING.md`** (7 oct 2026), que es la fuente del plan. Dos cambios frente a esta tabla: M0 no son tres semanas sino seis sprints semanales con dos entregas, la demostración al cliente del 30 oct (`v0.1.0`) y el piloto del 9 al 13 nov (`v0.2.0`), porque el desglose da 109 puntos y la matriz de §15.3 en el equipo real no se recorta (`BACKLOG-PARKING.md` §6.2); y M1 empieza en Q6, el 17 nov, porque del CORE solo necesita HU-C3.1, HU-C4.3 y HU-C4.4, ya construidas, y solo el cobro por periodo espera a HC4.

| Hito | Duración estimada | Depende de | Deja funcionando | Criterio de aceptación |
|---|---|---|---|---|
| **M0 · MVP del cliente** | 3 semanas | Zona `laboratorio-digital.app` activa; datos del cliente (§19.2) | Tarifas, caja local, recibos en la PT-210, WhatsApp por enlace, QR en pantalla, `/r/`, turno, respaldo, herramientas gratuitas de tarifa y recibo | La matriz de §15.3 en verde con la PT-210 del cliente. Un turno real completo sin diferencias |
| **M1 · Cuenta y varias cajas** | 3 semanas | PLATAFORMA P1 y P2 (y P3 para cobrar periodos) | Producto en el CORE, celda c2, reclamar, sincronizar, roles, respaldo en la nube, cobro del plan | Dos cajas sin red que se sincronizan sin repetir números ni perder registros |
| **M2 · Recibo verificado** | 2 semanas | M1 | Certificados de dispositivo, firma sin red, fotos en R2 por 30 días, mensualidades, reportes | Un recibo firmado en modo avión se verifica en otro teléfono; uno alterado sale en rojo |
| **M3 · WhatsApp automático** | 3 semanas | M1, Workers Paid, `packages/cifrado`, verificación de negocio del parqueadero | Cloud API con plantilla de utilidad, estados de entrega, QR de autoservicio en la entrada | Un recibo llega sin que el operador toque WhatsApp, y su estado «entregado» se ve en la caja |
| **M4 · Facturación** | Por estimar | Un cliente obligado a facturar | Integración con el facturador del parqueadero | Su disparador (§19.3) |

### 18.1 M0 por semanas

1. **Semana 1:** el paso 0 con la PT-210 del cliente (§7.1); `parqueadero-tarifas` con su tabla de casos; `parqueadero-schema`; la caja con entrada, salida, estadías abiertas y numeración; `parqueadero-recibos` con las cuatro salidas y la prueba de paridad.
2. **Semana 2:** `packages/impresion` con los adaptadores de Web Bluetooth, Web Serial y el diálogo del sistema; página de prueba; reconexión; `packages/whatsapp`; la pantalla del recibo; la página `/r/`.
3. **Semana 3:** turno y cierre impreso; ajustes con PIN; respaldo; las dos herramientas gratuitas; la matriz de §15.3 en la PT-210; la puesta en marcha con el cliente.

**Nota del plan (7 oct 2026):** las dos herramientas gratuitas salen de M0. El estudio §12.2 pide medir su búsqueda antes de construir: HU-Q11.1 mide en Q6, y la calculadora y el generador dependen de lo que diga. El aviso de tarifas y derechos para la entrada (HU-Q11.3) se hace sin esperar, porque el cliente lo usa. El orden de M0 por semanas está en `BACKLOG-PARKING_MVP.md` §4. Bitácora parqueadero 9.

### 18.2 Métricas de la excepción declarada (las fija el dueño antes del día 1)

Propuesta, sobre la del estudio (§16.3):

| Métrica | Definición | Umbral propuesto |
|---|---|---|
| Impresión confiable | Recibos impresos al primer intento / recibos impresos | ≥ 98 % |
| Tiempo de entrada | Segundos entre la placa y el recibo en la mano | ≤ 10 s |
| Recibo digital | Recibos por WhatsApp o pantalla / recibos entregados | Fijar con el cliente; meta a 90 días |
| Cuadre | Turnos sin diferencia / turnos cerrados | ≥ 95 % |
| Pago real | El cliente paga el primer periodo | Sí o no, a los 30 días |
| Soporte | Minutos por sede al mes | Debe caber en la contribución (estudio §10.4) |

---

## 19. Riesgos y decisiones del dueño

### 19.1 Riesgos

| Riesgo | Probabilidad | Impacto | Mitigación |
|---|---|---|---|
| El cliente usa iPhone: Safari no tiene Web Bluetooth | Por saber (§19.2) | Alto | §7.2: un Android de entrada o el PC para imprimir |
| La unidad del cliente anuncia otro servicio BLE, u otro nombre | Media: los datos del modelo vienen de un SDK no oficial (§7.1) | Medio | Paso 0 de M0 con nRF Connect; el adaptador prueba varios servicios y descubre; Web Serial como segundo camino (§7.4, §7.5) |
| El QR nativo de la PT-210 sale deformado | Media: ya pasó en un caso público (§7.1) | Bajo | La página de prueba lo detecta y la caja imprime el QR como imagen (§7.3) |
| Meta vuelve a cambiar precios o reglas | Alta: cambió el 1 abr y el 1 oct 2026 (§8.6) | Medio, solo en M3 | `wa.me` sigue disponible; presupuesto y kill switch; cada parqueadero paga su número |
| El reloj del teléfono está corrido | Media | Alto: recibos y cobros mal | Comparación con el reloj del servidor y aviso en rojo (§5.6) |
| Se pierde el teléfono en M0 | Media | Alto: la información del parqueadero | Respaldo al cerrar cada turno; M1 temprano si hay más de una caja |
| El WhatsApp del parqueadero es reportado o limitado por mensajes a desconocidos | Baja | Medio | Solo con autorización del conductor; texto transaccional; WhatsApp Business con perfil del negocio (§8.2) |
| La Cloud API se come el margen | Media | Medio | `wa.me` sigue siendo el camino por defecto; M3 solo en un plan que la cubra (§8.5) |
| Un tope de ciudad desactualizado | Media | Alto: cobro ilegal | Contenido versionado con aviso a los 13 meses; radar anual (estudio §17.1) |
| El conductor no quiere recibo digital | Alta al inicio | Bajo | El papel sigue disponible; se mide y se empuja con la pantalla y el autoservicio (§8.4) |

### 19.2 Decisiones y datos que se necesitan

**Del dueño:**

1. Aceptar o cambiar ADR-31 a ADR-40, empezando por la excepción declarada con este cliente como parqueadero cero.
2. Activar la zona `laboratorio-digital.app` ya, o usar otro dominio. Recomendación: activarla, porque el primer recibo publica el enlace.
3. Qué paga el cliente en el piloto. Recomendación: el plan desde el primer día, con un link de pago de Bold, porque un pago real es la evidencia más fuerte (estudio §16.3); y la puesta en marcha como servicio.
4. El nombre comercial del producto.
5. Las métricas de §18.2, antes del día 1.

**Del cliente, antes de M0:**

1. Ciudad, tarifas actuales y tope que reportó a la alcaldía, si aplica.
2. Datos legales: razón social, NIT, dirección, teléfono, póliza y registro (en Bogotá, el Registro Distrital).
3. Vehículos por día y horario; cuántas entradas y salidas; cuántos dispositivos.
4. Qué dispositivo usará: teléfono Android, iPhone o PC con Windows (§7.2).
5. El número de WhatsApp del parqueadero y si usa WhatsApp Business.
6. Si es responsable de IVA y cómo factura hoy.

### 19.3 Lo que no hace, y cuándo lo haría

| Fuera del MVP | Disparador |
|---|---|
| Lectura de placa con la cámara | Un modelo de licencia permisiva que lea placas colombianas en menos de un segundo en un teléfono barato (estudio §8.3) |
| WhatsApp Cloud API | El cliente paga un plan que cubre el costo de los mensajes, y el parqueadero tiene su negocio verificado en Meta (M3) |
| Factura electrónica o tiquete POS electrónico | Un parqueadero obligado a facturar que no tenga facturador. Primero se integra el suyo (TIENDA-3.0 §14.5) |
| Pago en línea del conductor | Nunca como recaudo de ED1. Si el parqueadero lo pide, con sus propias llaves de Bold, como la Tienda (TIENDA-3.0 §9) |
| Varias sedes con reporte consolidado | Un cliente con dos sedes que lo pague |
| Convenios con comercios y visitantes de copropiedad | Tres clientes que lo pidan (regla de tres) |
| Barreras, sensores, cámaras fijas, reservas | No (estudio §14.3) |
| App nativa | Una función que el navegador no pueda hacer y que un cliente pague |

---

## 20. Hallazgos para la plataforma (propuestos, no aplicados)

1. **`INSERT OR IGNORE` en el push de la celda agro** (`apps/api-celda/src/push.ts`). En SQLite, `OR IGNORE` también se salta las violaciones de `CHECK`, `NOT NULL` y unicidad, no solo el id repetido: una fila que pase zod pero no un `CHECK` de la base se reportaría como `duplicado` y se perdería en silencio (P1). Comprobado el 6 oct 2026 con `node:sqlite`: `INSERT OR IGNORE` con `v = 0` sobre `CHECK (v >= 1)` devuelve `changes = 0` sin error. **Propuesta:** `ON CONFLICT (id) DO NOTHING` y una prueba con un `CHECK` roto. No se tocó el código del agro.
2. **`dominios.json › reservados_app.proyecto` está vacío.** Antes de que la Tienda abra nombres en `laboratorio-digital.app`, `parqueadero` tiene que estar reservado, o una tienda podría tomarlo.
3. **Firma sin red por dispositivo** [ADR-36]. El cuaderno podría firmar sus QR de lote sin señal, en vez de imprimirlos «sin verificar» (ARQUITECTURA §5.9).
4. **`packages/impresion` sirve a los otros dos productos:** el punto de venta de la Tienda (TIENDA-3.0 §20.3) y las etiquetas de lote del cuaderno.
5. **El código de `wa.me` ya existe dos veces** (HU-E2.4 y HU-E4.4 del agro, y el «Confirmar por WhatsApp» de la Tienda). Con el parqueadero son tres: va a `packages/whatsapp` con las reglas de la bitácora (sin emoji al inicio, nombre desde los datos, enlace en su línea). **Nota del plan (7 oct 2026):** en `origin/main` hay tres copias en el agro, todas para compartir sin número, y ninguna en la Tienda 3.0, que todavía no tiene código. `@ed1/whatsapp` nace con las dos formas, con número y sin él (HU-Q1.6; bitácora parqueadero, «Afirmaciones falsas» 3).
6. **El cobro de WhatsApp desde el 1 oct 2026 contradice al repositorio** (§8.6). La página de Meta de cambios próximos dice que desde esa fecha se cobran los mensajes de servicio y las plantillas de utilidad dentro de la ventana; la página general sigue diciendo que son gratis. El repositorio siguió a la general (ED1 v1.4 [C], TIENDA-3.0 §0 y §20.3, `proveedores-de-computo.md` §0, §4 y §7) y registró el cobro como afirmación falsa (`BITACORA.md`, «Afirmaciones falsas» 3). **Propuesta:** abrir las dos páginas en el navegador; si la de cambios próximos se confirma, una entrada nueva en la bitácora que corrija la 3 sin borrarla, y las correcciones en esos documentos. La lección que se suma: una página oficial puede contradecir a otra; la de cambios próximos manda sobre la general. No cambia ninguna decisión: la barrera de la Cloud API sigue siendo habilitar el canal.
7. **Web Serial por Bluetooth en Chrome para Android (138+)** abre a la Tienda un camino a impresoras de Bluetooth clásico que la v1 no contempla, con reconexión sin selector (§7.5).

---

## 21. Fuentes

Consultadas el 6 oct 2026 (hora de Colombia). Junto a cada una va la fecha que muestra la página, o «sin fecha».

### 21.1 Del repositorio

- `docs/ecosistema/ECOSISTEMA-DIGITAL-ED1-v1.4.md` (ED1 §N, [C], [D3], [H6]).
- `docs/ARQUITECTURA.md` (ADR-1 a ADR-30; §5.3 cuaderno, §5.5 celdas, §5.6 sincronización, §5.9 QR firmado, §5.10 avisos, §7.2 CI, §8.3 respaldos, §13).
- `docs/plataforma/PLATAFORMA.md` (R1–R6; §4 CORE, §4.6 tokens v2, §4.9 celdas, §4.10 vigía, §6.3 anillos), `cuenta-cloudflare.md`, `proveedores-de-computo.md`, `BACKLOG_CORE.md`, `BITACORA_CORE.md`.
- `docs/tienda/TIENDA-3.0.md` (§8, §9, §10.2, §11.6, §14.3, §14.5, §20.3), `BACKLOG_TIENDA3.md`, `BITACORA_TIENDA3.md` (PT1), `BITACORA-ecommerce.md`, `ESTUDIO-MERCADO-ECOMMERCE-ED1-2026-10-v1.3.md` (§12.1), `VALIDACION-ESTUDIO-MERCADO-ECOMMERCE-ED1-2026-10.md`.
- `docs/BITACORA.md` (P1–P21; «Afirmaciones falsas» 3), `docs/BACKLOG.md` (HU-E2.4, HU-E4.4).
- `infrastructure/dominios.json`; `apps/api-celda/src/push.ts`, `qr.ts`; `apps/core/src/worker.ts`, `entrar.ts`; `docs/tienda/sql/tienda/0001_tienda_v1.sql` y `docs/tienda/sql/probar-tienda.mjs` (el modelo de la prueba de anexo A); `infrastructure/migraciones/celda/0001_celda_v1.sql`.
- En esta carpeta: `ESTUDIO-MERCADO-PARQUEADEROS-ED1-2026-10.md` («estudio §N»).

### 21.2 Impresión (I)

1. MDN, Web Serial API (mod. 2026-05-26) y BCD `api/Serial.json` (sin fecha): https://developer.mozilla.org/en-US/docs/Web/API/Web_Serial_API · https://github.com/mdn/browser-compat-data/blob/main/api/Serial.json
2. MDN BCD `api/Bluetooth.json`, `getDevices` tras bandera (sin fecha): https://github.com/mdn/browser-compat-data/blob/main/api/Bluetooth.json
3. MDN BCD `api/USB.json` (sin fecha): https://github.com/mdn/browser-compat-data/blob/main/api/USB.json
4. caniuse, Web Bluetooth (datos de sep 2026): https://caniuse.com/web-bluetooth
5. blink-dev, Intent to Ship: Web Serial over Bluetooth on Android (2025-04-24): https://groups.google.com/a/chromium.org/g/blink-dev/c/BqUGCcurReE/m/XbuAYkRxEQAJ
6. Notebookcheck, Chrome 148 Beta para Android añade Web Serial (2026-04-09): https://www.notebookcheck.org/Chrome-148-Beta-para-Android-anade-soporte-para-Web-Serial-y-SharedWorker.1269767.0.html
7. MDN, Firefox 151 for developers (2026-05-19): https://developer.mozilla.org/en-US/docs/Mozilla/Firefox/Releases/151
8. Chrome for Developers, Serial over Bluetooth on the web (act. 2023-10-13): https://developer.chrome.com/blog/serial-over-bluetooth
9. Chrome for Developers, Web Bluetooth (2015-07-21): https://developer.chrome.com/docs/capabilities/bluetooth
10. WebBluetoothCG, implementation-status.md (sin fecha): https://github.com/WebBluetoothCG/web-bluetooth/blob/main/implementation-status.md
11. Especificación Web Bluetooth, `index.bs`, límite de 512 bytes (sin fecha): https://github.com/WebBluetoothCG/web-bluetooth/blob/main/index.bs
12. WebKit, Tracking Prevention (mod. 2023-04-27): https://webkit.org/tracking-prevention/
13. Apple, Alternative browser engines, solo UE (sin fecha): https://developer.apple.com/support/alternative-browser-engines/
14. App Store, Bluefy (v3.9.3, 2026-01-27): https://apps.apple.com/us/app/bluefy-web-ble-browser/id1492822055
15. App Store, beacio / iOSWebBLE (v2.2.0, «20 sep»): https://apps.apple.com/us/app/ioswebble/id6761301368
16. Apple Support, AirPrint desde iPhone (2025-11-14): https://support.apple.com/en-afri/109349
17. MacTech, Star TSP654II AirPrint (2018-01-11, según la URL): https://www.mactech.com/2018/01/11/star-micronics-displays-apple-certified-airprint-pos-printer/amp/
18. Star, TSP143IV (act. 2026-10-05): https://starmicronics.com/product/tsp143iv-thermal-receipt-printer/
19. Star, manual de webPRNT (sin fecha): https://star-m.jp/products/s_print/sdk/webprnt/manual/en/_sampleProgram.htm
20. Epson, ePOS SDK JavaScript v2.27.0d (2025-01-10): https://download3.ebz.epson.net/dsc/f/03/00/16/62/49/81ee744a1b4847f8a109141db8c303cb87ac5c6d/ov_ePOS_SDK_JavaScript_2.27.0d.pdf
21. Epson, TM-m30III Wi-Fi/Bluetooth (sin fecha): https://www.epson.eu/fr_EU/produits/commerce/imprimantes-pour-points-de-vente/mpos-%26-tablet-pos-printers/tm-m30iii-wi-fi-and-bluetooth-model/p/41437
22. Chrome for Developers, Local Network Access (2025-06-09, act. 2025-09-29): https://developer.chrome.com/blog/local-network-access
23. Google Play, RawBT (ficha act. 2025-04-26): https://play.google.com/store/apps/details?id=ru.a402d.rawbtprinter
24. APKMirror, RawBT 7.1.2 (2025-05-04): https://www.apkmirror.com/apk/402d/rawbt-print-service/rawbt-inkless-print-service-7-1-2-release/
25. RawBT, guía web (sin fecha): https://rawbt.ru/start.html
26. B4X, ejemplo con `rawbt:` (2023-07-25): https://www.b4x.com/android/forum/threads/print-made-easy.149200/
27. open-escpos-print-service, GPL-3.0 (sin fecha): https://github.com/farminos/open-escpos-print-service
28. Sunmi, Printer Developer Docs v1.1.210807 (2021-08-07): https://file.cdn.sunmi.com/SUNMIDOCS/SunmiPrinter-Developer-Docs-1-1.pdf
29. QZ Tray, LICENSE.txt y versiones (v2.2.6, 2026-04-05; npm qz-tray 2.3.0, 2026-09-11): https://github.com/qzind/tray/blob/master/LICENSE.txt · https://github.com/qzind/tray/releases
30. QZ, Licensing (rev. 1.3, 2020-11-12) y Signing (sin fecha): https://qz.io/docs/licensing · https://qz.io/docs/signing
31. QZ, Premium Support, USD 599 al año (sin fecha): https://buy.qz.io/Premium-Support-_p_13.html
32. WebApp Hardware Bridge, MIT (v1.0.1, «07 Aug»): https://github.com/imTigger/webapp-hardware-bridge
33. Chromium, `chrome_switches.cc`, `kiosk-printing` (commit histórico, sin fecha): https://chromium.googlesource.com/chromium/src/+/57f212f/chrome/common/chrome_switches.cc
34. MDN, `@page` `size`, Baseline 2024 (sin fecha): https://developer.mozilla.org/en-US/docs/Web/CSS/@page/size
35. ReceiptPrinterEncoder: README, documentación y paquete 4.0.1 con el perfil `pos-5890` (npm 2026-09-18): https://github.com/NielsLeenheer/ReceiptPrinterEncoder · https://www.npmjs.com/package/@point-of-sale/receipt-printer-encoder
36. WebBluetoothReceiptPrinter, README y `src/main.js` (npm 2.1.0, 2026-09-18): https://github.com/NielsLeenheer/WebBluetoothReceiptPrinter
37. WebUSBReceiptPrinter (npm 2.1.0, 2026-09-18): https://github.com/NielsLeenheer/WebUSBReceiptPrinter
38. WebSerialReceiptPrinter (npm 2.0.0, 2024-09-21): https://github.com/NielsLeenheer/WebSerialReceiptPrinter
39. EscPosEncoder, obsoleta (npm 3.0.0, 2024-09-21): https://github.com/NielsLeenheer/EscPosEncoder
40. receiptline (npm 4.0.4, 2026-07-31) e issue #32 sobre la PT-210 (oct 2022): https://www.npmjs.com/package/receiptline · https://github.com/receiptline/receiptline/issues/32
41. goojprt-pt210-sdk, no oficial (v0.1.0, ©2026; licencia no indicada): https://goojprt-pt210-sdk.readthedocs.io/en/latest/api/constants.html (y los módulos `transport/ble` y `commands`)
42. Walmart, GOOJPRT PT-210 (sin fecha): https://www.walmart.com/ip/536512265
43. Newegg, GOOJPRT PT-210 (sin fecha): https://www.newegg.com/p/0ZK-0DJ6-00003
44. Ficha técnica Cameleon PT210 (sin fecha): https://community.appinventor.mit.edu/uploads/short-url/o6p635v8cjCXfj77IQgSCvKmsmI.pdf
45. OEMDrivers, PT-210 (mod. 2025-06-05): https://oemdrivers.com/printer-goojprt-pt-210
46. Falabella Colombia, «impresora térmica portátil» (observado 2026-10-06): https://www.falabella.com.co/falabella-co/shop/impresora-termica-portatil
47. B4X, Printing with BLE (nov–dic 2022): https://www.b4x.com/android/forum/threads/solved-printing-with-ble.144348/
48. GOOJPRT-Printer-Driver, PIN 0000 (sin fecha): https://github.com/1rfsNet/GOOJPRT-Printer-Driver
49. CapitalColombia, rollos de 57 mm (observado 2026-10-06): https://www.capitalcolombia.com/productos/colombia/bogota/suministros/rollos_de_papel_para_impresoras_pos/capitalcolombia/combo_de_8_rollos_de_papel_termico_de_57mm_x_10mts_cc1541c.php
50. Hansol, ficha técnica NTC PF48 (2025-03-28): https://www.thermalpaperdirect.com/site/thermal-paper/landing-pages/spec%20sheets/Hansol%20NTC%20PF%2048.pdf
51. Zebra, 8000D 10-Year Receipt (dic 2015): https://prod-www.zebra.com/content/dam/zebra_dam/en_gb/spec-sheets/8000d-10-year-receipt-spec-sheet-en-gb.pdf
52. National Archives of Australia, papeles térmicos (sin fecha): https://www.naa.gov.au/information-management/storing-and-preserving-information/preserving-information/managing-records-thermal-papers
53. Kestronics, How long does thermal printing last (2025-03-19): https://www.kestronics.co.uk/blogs/blog-3/how-long-does-thermal-printing-last
54. SIC, radicado 18-965 sobre el recibo de parqueadero (2018-01-03): https://sedeelectronica.sic.gov.co/sites/default/files/normatividad/042018/Rad180965Reciboparqueadero.PDF
55. DIAN, documento equivalente electrónico (mod. 2024-07-24): https://micrositios.dian.gov.co/sistema-de-facturacion-electronica/documento-equivalente-electronico
56. Registro npm, licencias y fechas de `canvas-dither`, `canvas-flatten`, `resize-image-data`, `@canvas/image-data`, `codepage-encoder` 3.0.2, `qrcode` 1.5.4 y `lean-qr` 2.7.4, todas MIT: https://registry.npmjs.org/

### 21.3 WhatsApp y marco legal (W)

1. Meta, Pricing on the WhatsApp Business Platform (sin fecha; vuelta a leer el 6 oct 2026 para §8.6): https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing
2. Meta, Pricing for non-template messages, página de cambios próximos (sin fecha; vuelta a leer el 6 oct 2026 para §8.6): https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing/non-template-messages
3. Meta, Template categorization (sin fecha): https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/template-categorization
4. Meta, Template components (sin fecha): https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/components
5. Meta, Template fundamentals (sin fecha): https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/overview
6. Meta, Messaging limits (sin fecha): https://developers.facebook.com/documentation/business-messaging/whatsapp/messaging-limits
7. Meta, Send messages (sin fecha): https://developers.facebook.com/documentation/business-messaging/whatsapp/messages/send-messages
8. Meta, Webhooks (sin fecha): https://developers.facebook.com/documentation/business-messaging/whatsapp/webhooks/overview/
9. Meta, Getting opt-in (sin fecha): https://developers.facebook.com/documentation/business-messaging/whatsapp/getting-opt-in
10. Meta, Phone numbers (sin fecha): https://developers.facebook.com/documentation/business-messaging/whatsapp/business-phone-numbers/phone-numbers
11. Meta, Get started for Tech Providers (sin fecha): https://developers.facebook.com/documentation/business-messaging/whatsapp/solution-providers/get-started-for-tech-providers
12. Meta, Solution Partners (sin fecha): https://developers.facebook.com/documentation/business-messaging/whatsapp/solution-providers/overview
13. Meta, OBO model deprecation (sin fecha): https://developers.facebook.com/documentation/business-messaging/whatsapp/solution-providers/obo-model-deprecation
14. Meta, Onboarding WhatsApp Business app users, coexistencia (sin fecha): https://developers.facebook.com/documentation/business-messaging/whatsapp/embedded-signup/onboarding-business-app-users/
15. WhatsApp Business Messaging Policy (act. 2026-09-23): https://whatsappbusiness.com/policy/
16. WhatsApp, Terms for WhatsApp Business App (vigentes desde 2026-09-23): https://www.whatsapp.com/legal/WhatsApp-Terms-for-WhatsApp-Business-App
17. WhatsApp FAQ, Click to chat (sin fecha): https://whatsapp.com/faq/en/general/26000030
18. MDN, `Navigator.share` (2026-07-16): https://developer.mozilla.org/en-US/docs/Web/API/Navigator/share
19. MDN BCD, `api/Navigator.json` (sin fecha): https://raw.githubusercontent.com/mdn/browser-compat-data/main/api/Navigator.json
20. Cloudflare, Web Crypto en Workers (2026-09-30): https://developers.cloudflare.com/workers/runtime-apis/web-crypto/
21. WhatsApp Node SDK, archivado (2023-06-07): https://github.com/WhatsApp/WhatsApp-Nodejs-SDK
22. Twilio, precios de WhatsApp («septiembre 2026»): https://www.twilio.com/en-us/whatsapp/pricing
23. 360dialog, precios (sin fecha): https://360dialog.com/pricing
24. Gupshup, precios ISV (sin fecha): https://www.gupshup.ai/isv-partners/whatsapp-api/pricing
25. Gupshup, cambio de cargos (2025-12-29): https://support.gupshup.io/hc/en-us/articles/53700207494169
26. Infobip, precios (sin fecha): https://www.infobip.com/whatsapp-business/pricing
27. Reproducciones de la tarifa de Meta: https://whautomate.com/tools/whatsapp-business-api-pricing-calculator (sin fecha) · https://zernio.com/whatsapp-api-pricing (sin fecha) · https://app.wali.chat/help/pricing-table (sin fecha) · https://leadsales.io/blog/whatsapp-business-api-cuanto-cuesta/ (2026-08-24)
28. Franquicia de 1.000 mensajes de servicio, secundarias: https://respond.io/blog/whatsapp-pricing-change-2026 (2026-10-06) · https://www.ycloud.com/blog/whatsapp-api-message-pricing-update-effective-october-1-2026 (2026-09-04)
29. Chattigo, cuánto cobra WhatsApp Business por mensaje (2026-06-02): https://blog.chattigo.com/whatsapp-business/cuanto-cobra-whatsapp-business-por-mensaje
30. Chakra, coexistencia (2025-11-01, act. jun 2026): https://chakrahq.com/article/whatsapp-coexistence-live-eu-uk-europe-whatsapp-business-for-api-live/
31. Ley 1581 de 2012 (2012-10-17): http://www.secretariasenado.gov.co/senado/basedoc/ley_1581_2012.html
32. Decreto 1377 de 2013 (2013-06-27; compilado en el Decreto 1074 de 2015): https://www.alcaldiabogota.gov.co/sisjur/normas/Norma1.jsp?i=53646
33. Decreto 090 de 2018 (ene 2018): https://www.saludcapital.gov.co/Normo/tic/decreto_0090_de_2018.pdf
34. INCP, UVT 2026 (dic 2025): https://incp.org.co/publicaciones/infoincp-publicaciones/impuestos/2025/12/dian-fijo-en-52-374-en-valor-de-la-uvt-para-el-ano-gravable-2026/
35. Ley 1480 de 2011 (2011-10-12): http://www.secretariasenado.gov.co/senado/basedoc/ley_1480_2011.html
36. SIC, concepto 17-068254 (2017; nota de Ámbito Jurídico del 2017-04-28): https://ambitojuridico.com/sites/default/files/BancoMedios/Archivos/cpto-17068254-17.pdf
37. SIC, boletín jurídico sobre recibos electrónicos en parqueaderos (abr 2018; **no se pudo leer**): https://www.sic.gov.co/boletin-juridico-abril-2018/los-recibos-electronicos-que-se-expiden-en-los-parqueaderos
38. Ley 527 de 1999 (1999-08-18): http://www.secretariasenado.gov.co/senado/basedoc/ley_0527_1999.html
39. Ley 2300 de 2023 (2023-07-10): http://www.secretariasenado.gov.co/senado/basedoc/ley_2300_2023.html
40. SIC, Circular Externa 005 (2017-08-10): https://operaciones.colombiacompra.gov.co/sites/cce_public/files/cce_informe_seguimiento/superindustria-circularexterna-2017-n0000005_20170810_1.pdf
41. caniuse, Background Sync (2026-03-05): https://caniuse.com/background-sync

**Lo que no se pudo leer:** el archivo oficial de tarifas de Meta y sus valores en COP; la guía de nombres visibles de Meta; el boletín de la SIC de abril de 2018 (W37); los precios de Mercado Libre; el sitio de RawBT en `rawbt.app`.

---

## Anexo A. El shard de parqueaderos (`sql/parqueadero/0001_parqueadero_v1.sql`)

Copia del archivo. **Si difieren, manda el archivo**, que es el que prueba `sql/probar-parqueadero.mjs` (§10.2, `sql/README.md`).

```sql
-- Parqueadero · shard de una celda de parqueaderos (`parqueadero_c{N}_s{k}`), migración 0001.
-- Fuente del diseño: docs/parking/ARQUITECTURA-PARQUEADERO.md §7. Probada con node:sqlite (falta D1).
-- Propuesta: no está en infrastructure/migraciones/, así que ningún despliegue la aplica. Pasa allí
-- en el M1 del parqueadero, con su prueba en D1 local (getPlatformProxy).
--
-- Es el modelo de la celda agro (infrastructure/migraciones/celda/0001 a 0003) con lo que el
-- parqueadero necesita encima. Reglas de este esquema (las vigilan pruebas):
-- 1. Toda tabla de datos lleva `org_id`. La API lo toma del token (aud = parqueadero), nunca del
--    cuerpo de la solicitud.
-- 2. Dinero en pesos enteros (`*_cop`) dentro de `datos`, validado con zod en el teléfono y en la API
--    (packages/parqueadero-schema). Nunca REAL. Un valor ilegible no es cero (P1).
-- 3. Instantes en UTC ISO-8601 (TEXT). La fecha local de Bogotá va aparte en `fecha_local` (P8).
-- 4. Lo que va a crecer (tipos de registro, catálogos, orígenes) es una tabla de referencia con
--    clave foránea, no un CHECK (R1): agregar un tipo es un INSERT.
-- 5. Ninguna clave foránea lleva ON DELETE CASCADE (R4).
-- 6. Los registros son inmutables: corregir es anular con un registro nuevo (ADR-4). La base
--    rechaza UPDATE, y DELETE solo pasa con una purga autorizada después de exportar (P21).
-- 7. Cada índice dice su costo en filas escritas.
-- 8. Ningún dato de contacto del conductor llega aquí: el número de WhatsApp no sale del
--    dispositivo en el MVP ni en M1 (ADR-38). La foto del vehículo vive en R2, no en D1.

-- ── Referencias ────────────────────────────────────────────────────────────────────────────────

CREATE TABLE ref_tipo_registro (
  id TEXT PRIMARY KEY,
  lleva_numero INTEGER NOT NULL CHECK (lleva_numero IN (0, 1)),  -- 1: es un recibo con consecutivo
  abre_estadia INTEGER NOT NULL CHECK (abre_estadia IN (0, 1)),  -- 1: su id es el de la estadía
  pide_anula INTEGER NOT NULL CHECK (pide_anula IN (0, 1))       -- 1: no existe sin lo que anula
) WITHOUT ROWID;
INSERT INTO ref_tipo_registro (id, lleva_numero, abre_estadia, pide_anula) VALUES
  ('entrada', 1, 1, 0),          -- recibo de entrada (Ley 1480 art. 18)
  ('salida', 1, 0, 0),           -- liquidación y cobro; puede llegar antes que su entrada
  ('pago_abonado', 1, 0, 0),     -- recibo de una mensualidad
  ('anulacion', 0, 0, 1),        -- anula otro registro, con motivo
  ('entrega_recibo', 0, 0, 0),   -- cómo se entregó un recibo: papel, WhatsApp, pantalla, copia
  ('turno_apertura', 0, 0, 0),
  ('turno_cierre', 0, 0, 0),
  ('movimiento_caja', 0, 0, 0),  -- gasto o ingreso manual de la caja
  ('nota', 0, 0, 0);

CREATE TABLE ref_entidad (
  id TEXT PRIMARY KEY
) WITHOUT ROWID;
INSERT INTO ref_entidad (id) VALUES
  ('sede'),           -- datos legales del parqueadero: razón social, NIT, dirección, póliza, registro
  ('tarifa'),         -- por tipo de vehículo, con su vigencia
  ('abonado'),        -- mensualidad por placa
  ('ajuste_recibo'),  -- encabezado, pie, textos legales, ancho del papel
  ('punto');          -- puesto de trabajo: entrada, salida o ambos

CREATE TABLE ref_origen (
  id TEXT PRIMARY KEY
) WITHOUT ROWID;
INSERT INTO ref_origen (id) VALUES ('manual'), ('tablero'), ('importacion'), ('sistema');

-- ── Dispositivos ───────────────────────────────────────────────────────────────────────────────

-- Cada teléfono o PC que registra. La serie numera sus recibos sin coordinarse con nadie
-- (A-000123, B-000045): dos cajas sin red no pueden repetir un número. La llave pública es la del
-- par Ed25519 que el dispositivo generó; la celda la certifica para firmar recibos sin red (ADR-36).
-- Costo: la tabla (clave primaria) y `dispositivo_serie`: 2 filas por alta, que es rara.
CREATE TABLE dispositivo (
  org_id TEXT NOT NULL,
  id TEXT NOT NULL,
  serie TEXT NOT NULL CHECK (length(serie) BETWEEN 1 AND 3 AND serie NOT GLOB '*[^A-Z0-9]*'),
  nombre TEXT NOT NULL,
  llave_publica TEXT,                     -- base64url, 32 bytes; nula hasta la primera certificación
  certificado_hasta TEXT,                 -- vencimiento del último certificado emitido
  estado TEXT NOT NULL CHECK (estado IN ('activo', 'retirado')),
  creado TEXT NOT NULL,
  retirado TEXT,
  PRIMARY KEY (org_id, id),
  CHECK ((estado = 'retirado') = (retirado IS NOT NULL))
) WITHOUT ROWID;
CREATE UNIQUE INDEX dispositivo_serie ON dispositivo (org_id, serie);

-- ── Registros (inmutables) ─────────────────────────────────────────────────────────────────────

-- `id` es el UUIDv7 del dispositivo: reenviar el mismo lote no duplica (INSERT OR IGNORE).
-- `estadia_id` agrupa todo lo de una estadía: la entrada (estadia_id = id), la salida, las
-- entregas de sus recibos y sus anulaciones. Sin clave foránea: una salida hecha sin red en otra
-- caja puede llegar antes que su entrada, y eso no es un error (P1: nunca se descarta).
CREATE TABLE registro (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  seq INTEGER NOT NULL,
  tipo TEXT NOT NULL REFERENCES ref_tipo_registro (id),
  v INTEGER NOT NULL CHECK (v >= 1),
  fecha_local TEXT NOT NULL CHECK (fecha_local GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9]'),
  instante_evento TEXT NOT NULL,          -- reloj del dispositivo
  instante_recibido TEXT NOT NULL,        -- reloj de la celda
  autor_usuario_id TEXT,                  -- nulo en lo que se hizo sin cuenta y se reclamó después
  dispositivo_id TEXT NOT NULL,
  origen TEXT NOT NULL REFERENCES ref_origen (id),
  anula_id TEXT,
  estadia_id TEXT,
  serie TEXT,
  consecutivo INTEGER CHECK (consecutivo IS NULL OR consecutivo >= 1),
  datos TEXT NOT NULL CHECK (json_valid(datos)),
  CHECK ((serie IS NULL) = (consecutivo IS NULL))
);
-- Pull: «cambios de esta organización después de <seq>». Costo: 1 fila por registro.
CREATE UNIQUE INDEX registro_pull ON registro (org_id, seq);
-- Un número de recibo no se repite en un parqueadero. También es la búsqueda por número del
-- recibo automático por WhatsApp (M3). Costo: 1 fila, solo en los registros con número.
CREATE UNIQUE INDEX registro_numero ON registro (org_id, serie, consecutivo)
  WHERE consecutivo IS NOT NULL;

-- Lo que la base garantiza de un registro, con la tabla de referencia (R1).
CREATE TRIGGER registro_reglas
BEFORE INSERT ON registro
BEGIN
  SELECT RAISE(ABORT, 'este tipo de registro es un recibo y necesita serie y consecutivo')
   WHERE NEW.consecutivo IS NULL
     AND (SELECT lleva_numero FROM ref_tipo_registro WHERE id = NEW.tipo) = 1;
  SELECT RAISE(ABORT, 'este tipo de registro no lleva número de recibo')
   WHERE NEW.consecutivo IS NOT NULL
     AND (SELECT lleva_numero FROM ref_tipo_registro WHERE id = NEW.tipo) = 0;
  SELECT RAISE(ABORT, 'una entrada abre su propia estadía: estadia_id = id')
   WHERE (SELECT abre_estadia FROM ref_tipo_registro WHERE id = NEW.tipo) = 1
     AND (NEW.estadia_id IS NULL OR NEW.estadia_id <> NEW.id);
  SELECT RAISE(ABORT, 'una anulación necesita el registro que anula')
   WHERE (SELECT pide_anula FROM ref_tipo_registro WHERE id = NEW.tipo) = 1
     AND NEW.anula_id IS NULL;
  -- Se anula lo que esta organización tiene. La celda manda el registro original antes que su
  -- anulación (el orden de la cola de salida), así que esto no deja datos de campo afuera.
  SELECT RAISE(ABORT, 'anula un registro que este parqueadero no tiene')
   WHERE NEW.anula_id IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM registro WHERE id = NEW.anula_id AND org_id = NEW.org_id);
  -- La serie es la del dispositivo que la tiene asignada, aunque ya esté retirado: un recibo
  -- hecho sin red antes del retiro llega después y se acepta (P1).
  SELECT RAISE(ABORT, 'la serie del recibo no es la del dispositivo que lo hizo')
   WHERE NEW.serie IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM dispositivo
        WHERE org_id = NEW.org_id AND id = NEW.dispositivo_id AND serie = NEW.serie
     );
END;

CREATE TRIGGER registro_inmutable
BEFORE UPDATE ON registro
BEGIN
  SELECT RAISE(ABORT, 'un registro no se modifica: se anula con otro (ADR-4)');
END;

-- Retirar los datos de un parqueadero que se va, después de entregarle la exportación (P21).
-- `exportacion_huella` es el SHA-256 del archivo que se verificó antes de borrar.
CREATE TABLE purga (
  org_id TEXT PRIMARY KEY,
  autorizada TEXT NOT NULL,
  autor TEXT NOT NULL,
  exportacion_huella TEXT NOT NULL CHECK (length(exportacion_huella) = 64)
) WITHOUT ROWID;

CREATE TRIGGER registro_sin_borrado
BEFORE DELETE ON registro
BEGIN
  SELECT RAISE(ABORT, 'un registro solo se borra con una purga autorizada después de exportar')
   WHERE NOT EXISTS (SELECT 1 FROM purga WHERE org_id = OLD.org_id);
END;

-- ── Catálogos (mutables, la última escritura gana, con historial) ──────────────────────────────

CREATE TABLE catalogo (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  seq INTEGER NOT NULL,
  entidad TEXT NOT NULL REFERENCES ref_entidad (id),
  version INTEGER NOT NULL CHECK (version >= 1),
  v INTEGER NOT NULL CHECK (v >= 1),
  datos TEXT NOT NULL CHECK (json_valid(datos)),
  actualizado TEXT NOT NULL,
  dispositivo_id TEXT NOT NULL,
  reemplazo TEXT CHECK (reemplazo IS NULL OR json_valid(reemplazo))
);
-- Pull de catálogos. Costo: 1 fila por escritura (2 al actualizar, que mueve `seq`).
CREATE UNIQUE INDEX catalogo_pull ON catalogo (org_id, seq);

CREATE TABLE entidad_historial (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  entidad TEXT NOT NULL,
  entidad_id TEXT NOT NULL,
  version INTEGER NOT NULL,
  datos TEXT NOT NULL CHECK (json_valid(datos)),
  reemplazada TEXT NOT NULL,
  motivo TEXT NOT NULL CHECK (motivo IN ('edicion', 'conflicto'))
);

-- Actualizar un catálogo es una sola sentencia: la versión anterior pasa al historial aquí.
-- Costo: la fila del historial y su clave, solo cuando cambia la versión.
CREATE TRIGGER catalogo_a_historial
BEFORE UPDATE OF version ON catalogo
BEGIN
  SELECT RAISE(ABORT, 'un catálogo no cambia de parqueadero ni de entidad')
   WHERE NEW.org_id <> OLD.org_id OR NEW.entidad <> OLD.entidad;
  SELECT RAISE(ABORT, 'la versión de un catálogo solo sube')
   WHERE NEW.version <= OLD.version;
  INSERT OR IGNORE INTO entidad_historial
    (id, org_id, entidad, entidad_id, version, datos, reemplazada, motivo)
  VALUES
    (OLD.id || '@v' || OLD.version, OLD.org_id, OLD.entidad, OLD.id, OLD.version, OLD.datos,
     NEW.actualizado, CASE WHEN NEW.reemplazo IS NULL THEN 'edicion' ELSE 'conflicto' END);
END;

-- ── Cuarentena ─────────────────────────────────────────────────────────────────────────────────

-- Lo que no valida se guarda con su motivo en palabras y el dispositivo lo muestra en rojo (P1).
-- `id` es el de la operación: reenviarla no duplica. Sin índice extra.
CREATE TABLE cuarentena (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  dispositivo_id TEXT NOT NULL,
  recibido TEXT NOT NULL,
  motivo TEXT NOT NULL,
  operacion TEXT NOT NULL CHECK (json_valid(operacion))
);
```

---

## Anexo B. Maquetas a 32 columnas

Sin tildes, como salen si la página de prueba elige transliterar (§7.7). Con una página de códigos aprobada, salen con tildes.

**Recibo de salida:**

```text
     PARQUEADERO ENSAYO UNO
       NIT 900.000.000-0
         Tel 3000000000
      Calle 1 # 2-3, Bogota
--------------------------------
RECIBO DE SALIDA        A-000124
Entrada A-000123
Placa ABC123               Carro
Entro          06/10/2026 18:05
Salio          06/10/2026 21:05
Tiempo                   180 min
--------------------------------
Valor por minutos ($230) $41.400
Tope por dia aplicado    $30.000
TOTAL                    $30.000
Pago: efectivo
Recibido $50.000  Cambio $20.000
--------------------------------
Poliza: Aseguradora 0000000
Este recibo no es factura.
 Pida su recibo por WhatsApp.
```

**Cierre de turno:**

```text
     PARQUEADERO ENSAYO UNO
CIERRE DE TURNO            T-012
Caja A          Operador: Caja 1
Abrio          06/10/2026 06:00
Cerro          06/10/2026 14:00
--------------------------------
Entradas                     142
Salidas                      137
Abiertas al cierre             5
Anulaciones                    1
Copias impresas                2
--------------------------------
Por medio de pago
Efectivo              $1.154.300
QR o transferencia      $612.000
Datafono                 $98.000
--------------------------------
Base                    $100.000
Efectivo esperado     $1.254.300
Contado               $1.250.000
Diferencia               -$4.300
Motivo: cambio mal dado
--------------------------------
Recibos entregados           279
  Papel                      160
  WhatsApp                    98
  Pantalla                    21
Papel ahorrado: 119 recibos
```
