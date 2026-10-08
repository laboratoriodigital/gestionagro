# Arquitectura — CultivoPro y la plataforma ED1

**Estado:** aprobada (Fase 0)
**Versión:** 0.1.0 · 30 sep 2026 (al día con el producto v0.3.0 · 4 oct 2026)
**Proyecto:** CultivoPro (antes «Gestión Agro»), línea agrícola de ED1 en `cultivopro.co`, y las piezas de la plataforma que ya corren: CORE v0, celdas y despliegue. Repositorio `laboratoriodigital/plataforma` (antes `gestionagro`, ADR-26)
**Documentos que manda este:** `ecosistema/ECOSISTEMA-DIGITAL-ED1-v1.4.md` (ED1 §; la v1.3 y la v1.2 quedan como historia en `ecosistema/historia/`, con la misma numeración), `ecosistema/REVISION-HALLAZGOS-ED1.md` ([H1]–[H16]), `agro/ESTUDIO-MERCADO-AGRO-2026-09.md` (Estudio), `tienda/BITACORA-ecommerce.md` (bitácora ecommerce). El plan de trabajo vive en `BACKLOG.md` y lo que se rompa, en `BITACORA.md`. Lo que viene está diseñado en `plataforma/PLATAFORMA.md` y `tienda/TIENDA-3.0.md`, y pasa aquí con el pull request que lo construye.

> **Regla de este documento (P2, P18).** Cada número, límite o decisión se escribe una sola vez aquí y los demás documentos lo citan por su sección. Si el código contradice este documento, el que se corrige es uno de los dos en el mismo pull request, nunca «después».

---

## 0. Resumen

Gestión Agro es **un solo producto con dos puertas**: calculadoras agronómicas gratuitas (estáticas, 100 % en el navegador) y un **cuaderno de campo offline-first** que se vuelve SaaS vertical. Tu invernadero de tomate ecológico (2.000 m², 4 naves, sustrato, goteo) es la **finca cero**: el primer cliente real, tratado exactamente igual que cualquier otro.

Las cinco decisiones que sostienen todo:

1. **El dato nace y vive en el teléfono.** El cuaderno guarda en IndexedDB, calcula y genera reportes en el navegador; la nube solo **sincroniza**. Si la nube se cae o se queda sin cuota, en la finca nadie deja de registrar.
2. **Los registros son inmutables.** Corregir es escribir un registro nuevo que anula al anterior. Eso hace la sincronización casi libre de conflictos y deja una traza que un auditor (BPA, ecológico, GlobalG.A.P.) acepta.
3. **Multi-tenant en celdas portables, no una instancia por cliente.** Una celda = un despliegue (Worker + D1 + R2 + KV) en una cuenta de Cloudflare, con muchas fincas adentro. Ningún identificador de cuenta está escrito en el código; mudar una finca de celda es una operación de rutina.
4. **Escalar no es abrir cuentas gratis, es pasar a Workers Paid cuando un cliente lo pague.** Los términos de Cloudflare prohíben esquivar cuotas (§6.5). La finca cero y las primeras ~100 fincas caben en el plan gratuito; USD 5/mes lo cubre el primer plan Finca.
5. **El control del riego vive en la finca.** La nube de ED1 solo recibe resúmenes y entrega configuración (§5.11).

Contradicciones con ED1 que este documento resuelve de forma explícita (no las esconde): §2.3.

---

## 1. Decisiones (ADR)

Cada decisión tiene número fijo; el código y el backlog la citan como `ADR-N`. Estado: **Propuesta** hasta que el dueño la apruebe, **Aceptada** después. Revisión del 30 sep 2026 (HU-E0.1): ADR-1 a ADR-18 aceptadas sin cambios. ADR-19 aceptada con el plan B por decisión del dueño: subdominio propio, mismas rutas; el spike HU-E1.4 se cancela. Decisiones del dueño del 5 oct 2026: ADR-20 a ADR-22 aceptadas en la mañana; ADR-23, ADR-26 y ADR-27 en la tarde. ADR-24 y ADR-25 quedan propuestas. ADR-28 a ADR-30, aceptadas en la noche del 5 oct 2026 con las decisiones D-C1 a D-C5 del plan del CORE (`docs/plataforma/BACKLOG_CORE.md` §9). Su diseño está en `docs/plataforma/PLATAFORMA.md` y `docs/tienda/TIENDA-3.0.md`, y pasa a §5 en el pull request que implementa cada pieza (P18).

| ADR | Decisión | Por qué, en una línea | Alternativa descartada | Estado |
|---|---|---|---|---|
| 1 | La finca cero es un cliente más (mismo alta, mismos datos, mismas pruebas) | P6: lo que se escribe «para los demás» deja fuera al primero | Código o configuración especial para tu invernadero | Aceptada |
| 2 | Gestión Agro entra antes de sus umbrales ED1 como **excepción de cliente cero** | Hay una operación real que registrar desde el trasplante | Esperar a Fase 7 (§33 ED1) | Aceptada |
| 3 | Offline-first con IndexedDB; la nube es réplica, no fuente | 43 % de hogares rurales sin internet; costo; privacidad | App que depende de conexión | Aceptada |
| 4 | Registros inmutables + catálogos con última-escritura-gana e historial | Sincronización simple y auditable | CRDT o fusión campo a campo | Aceptada |
| 5 | Reportes, costos y carencias se calculan en el navegador | 10 ms de CPU del Worker gratuito; browser-first | Endpoints de reporte | Aceptada |
| 6 | Multi-tenant por celdas; directorio `organización → celda, shard` en el CORE | Un despliegue para cientos de fincas; mudanza posible | Un repositorio/cuenta por finca (modelo de la tienda) | Aceptada |
| 7 | Escalar pasando la celda a Workers Paid, no abriendo cuentas gratuitas | Cloudflare §2.2.1(c) | Celdas en cuentas gratuitas nuevas | Aceptada |
| 8 | Celdas dedicadas solo en cuentas **del cliente** (Cadena/Exportador) | Cloudflare §2.2.1(a): no registrarse a nombre de terceros | Cuentas creadas por ED1 a nombre del cliente | Aceptada |
| 9 | CORE v0 (identidad, organizaciones, membresías, directorio) se construye ya, mínimo | Primer producto con cuentas: extraer después cuesta migrar usuarios | Identidad dentro del Worker agro | Aceptada |
| 10 | Tokens firmados con Ed25519 por el CORE y verificados en cada celda sin llamarlo | Cero consultas cruzadas; celdas en otras cuentas | Sesión en cookie consultada al CORE | Aceptada |
| 11 | Sitio público y calculadoras con Astro (estático) + islas Preact; cuaderno como PWA Preact en `/agro/app/` | Static-first (§3.10 ED1), liviano en teléfonos baratos | SSR, React, app nativa | Aceptada |
| 12 | API de celda con Hono sobre Workers; SQL escrito a mano con migraciones de `wrangler` | Pocas dependencias; una sola fuente del esquema | ORM con su propio generador | Aceptada |
| 13 | Protocolo de sincronización versionado; el servidor **nunca descarta** un dato de campo por versión | P10: un teléfono puede pasar semanas con la versión vieja | Forzar actualización antes de subir | Aceptada |
| 14 | QR de trazabilidad = página estática + datos en el fragmento `#` + firma de la celda | Cero costo por escaneo; funciona para siempre | Página dinámica por lote | Aceptada |
| 15 | Fotos opcionales, comprimidas en el navegador y con cuota por plan | R2 gratuito da ~90 finca-año de fotos (§6.2) | Fotos ilimitadas | Aceptada |
| 16 | Alertas operativas al dueño por Telegram; reporte semanal por GitHub Actions con métricas agregadas | Gratis y sin datos de usuarios en Actions ([H6]) | Email transaccional desde el día 1 | Aceptada |
| 17 | Monorepo privado; `firmware/`, `hardware/` y `packages/agro-calc` se publican como espejo público cuando tengan su primera versión | Diseño abierto (Estudio) sin exponer el SaaS | Todo público desde el día 1 | Aceptada. Excepción temporal: público desde el 30 sep 2026 hasta que se reinicien los minutos de Actions de octubre; luego vuelve a privado (bitácora agro 5) |
| 18 | Herramientas del repositorio en Node/TypeScript, nunca scripts de bash para el operador | P3: tu máquina es Windows | Scripts `.sh` | Aceptada |
| 19 | Host `cultivopro.co` (era `agro.laboratorio-digital.com` hasta el 3 oct 2026, que redirige con 301) con las rutas de siempre: calculadoras en `/herramientas/agro/<slug>/`, cuaderno en `/agro/app/`, QR en `/agro/t/` | Subdominio propio desde el día 1, sin spike. Las rutas no cambian, así que volver al dominio principal (o a otro dominio) es cambiar el host y redirigir; los QR impresos siguen sirviendo con la redirección | Dominio principal verificado por el spike HU-E1.4 (cancelado); rutas cortas en el subdominio | Aceptada (30 sep 2026) |
| 20 | El CORE gana la **dimensión de producto**: tablas de referencia (producto, tipos, roles, planes, precios por periodo), claves foráneas compuestas, y sesión y token (`aud`) por producto (`PLATAFORMA.md` §4) | La Tienda 3.0 es el segundo producto del CORE: sin la dimensión, los `CHECK` del agro la impiden y los datos se mezclan | Un CORE por producto, o agregar tipos a los `CHECK` | Aceptada (5 oct 2026). Migración 0006 en `infrastructure/migraciones/core/` (HU-C2.2): probada en el D1 local de workerd, compatible con el código v0. Se aplica en staging al fusionar y en producción con la siguiente versión publicada |
| 21 | La Tienda 3.0 entra como **excepción declarada** (como ADR-2), diseñada **desde cero** sobre la plataforma. Los datos de las tiendas 2.0 se cargan después con scripts (`TIENDA-3.0.md`) | Dos tiendas 2.0 en operación y una plataforma probada. La 2.0 no escala: es una cuenta, una hoja y un repositorio por tienda | Esperar a la Fase 7 de ED1, o trasladar la 2.0 | Aceptada (5 oct 2026) |
| 22 | Planes **prepagados de 1, 3, 6 y 12 meses**, sin débito automático. Los periodos son una tabla de referencia (`PLATAFORMA.md` §4.3, §4.8) | La comisión fija de Bold pesa el 5,2 % en un plan mensual de COP 39.000, el 3,3 % en el semestral y el 3,1 % en el anual | Solo mensual; débito automático (Bold no lo ofrece) | Aceptada (5 oct 2026; el semestral, en la tarde). Meses calendario y crédito al cambiar de plan: propuestos |
| 23 | **Una sola cuenta de Cloudflare, la de siempre**, para todos los productos. Workers Paid se activa en ella con el M0 de la Tienda 3.0. Los productos se aíslan por presupuesto, kill switch y celdas, y ninguno se reparte entre cuentas gratuitas (`PLATAFORMA.md` §3.1–§3.2) | «Usar la misma cuenta actual de Cloudflare donde ya se viene usando todo» (dueño). Nada que mudar, y Workers Paid es por cuenta: el agro gana sus límites sin otra suscripción | Una cuenta paga aparte para lo que cobra, con graduación de productos (propuesta de la mañana, HA6) | Aceptada (5 oct 2026, tarde) |
| 24 | **Legible por agentes**: capa estática (`robots.txt` con señales, `llms.txt`, Markdown, habilidades, catálogo de API), luego OAuth del CORE y MCP. En comercio, el agente prepara y una persona paga (`PLATAFORMA.md` §5) | Pedido del dueño (isitagentready.com). Lo estático no cuesta, y lo demás tiene presupuesto y kill switch | Esperar a que los borradores sean estándar; o «Markdown for Agents» con plan Pro en cada zona | Propuesta |
| 25 | Reconstruir tablas en D1 **solo con la receta** de `PLATAFORMA.md` §4.4 (`defer_foreign_keys`, apagarlo y guarda de huérfanas). Ninguna FK con `ON DELETE CASCADE`. Lo que crece va en tablas de referencia, no en `CHECK` | Con FK diferidas, rehacer una padre falla al confirmar; el arreglo habitual (apagar el pragma) deja pasar violaciones reales sin avisar. Comprobado con `node:sqlite` | Confiar en `defer_foreign_keys` solo | Propuesta. Comprobado en el D1 local de workerd (HU-C2.1, 5 oct 2026): igual que `node:sqlite`, y la guarda revisa toda la base. Falta staging (HU-C2.2) |
| 26 | El monorepo de la plataforma es **este repositorio, renombrado a `laboratoriodigital/plataforma`**, con la Tienda como `apps/tienda-*` (`PLATAFORMA.md` §6) | Renombrar conserva secretos, ambientes, issues e historia. Mover con `filter-repo` obliga a recrear secretos (P12) | Repositorio nuevo con la historia movida (`docs/tienda/integracion-tienda-ecosistema.md` §6) | Aceptada (5 oct 2026, tarde). El renombre en GitHub lo hace el dueño (`docs/runbooks/renombrar-repositorio.md`) |
| 27 | **Tres dominios:** `laboratorio-digital.com` para el ecosistema y el CORE (`cuenta.`); `laboratorio-digital.app` para las tiendas y los proyectos nuevos, en el primer nivel y sin Public Suffix List; `cultivopro.co` para el agro y sus derivados (`PLATAFORMA.md` §3.3–§3.4) | Decisión del dueño. Las tiendas quedan aparte del ecosistema ([V10]). Cloudflare no admite como zona un dominio de la PSL (HA9) | Un dominio de tiendas inscrito en la PSL (propuesta de la mañana) | Aceptada (5 oct 2026, tarde) |
| 28 | **La cuenta ED1 es una app de primera parte del CORE**, declarada como el producto `cuenta` en `productos.json`: sin tipos ni planes, con su sesión propia y tokens `aud = cuenta` que solo abren `/api/core/cuenta/*` y nunca una celda (`BACKLOG_CORE.md` HU-C7.1) | Reusa la sesión por producto (R2) en vez de agregar una cookie del CORE como segundo mecanismo (P2). Un token de la cuenta robado no lee ni escribe datos de una finca o una tienda | La cuenta con cookie de sesión del CORE en su propio origen | Aceptada (5 oct 2026, D-C2). Se construye en HU-C7.3 |
| 29 | **Sistema de diseño `@ed1/ui` v2** al lado de la v1: tokens en tres capas (primitivos, semánticos y tema por producto), tipografía Geist y Geist Mono (OFL 1.1) **autoalojada** con un tope de 70 KB, sin JavaScript para animar y sin terceros. La v1 sigue en el sitio y el cuaderno hasta que el dueño decida migrarlos (`BACKLOG_CORE.md` §4) | Pedido del dueño: frontend bonito, minimalista y moderno desde el inicio, sin romper static-first, la CSP `'self'` ni los presupuestos | Fuentes del sistema (cero bytes, v1); Google Fonts (un tercero en cada visita) | Aceptada (5 oct 2026, D-C1 y D-C3) |
| 30 | **La copia fuera de Cloudflare va al Google Drive del dueño** (15 GB gratis): semanal, cifrada antes de salir, con la llave fuera de Google. Se suma al respaldo semanal en R2 de §8.3 (`BACKLOG_CORE.md` HU-C11.4) | Plan de salida de ED1 §20.3 a costo cero; el dueño ya eligió Drive para el respaldo del agro, por etapas | Google Cloud Storage o Backblaze B2 (`proveedores-de-computo.md` §4) | Aceptada (5 oct 2026, D-C5). La credencial y el tope de 15 GB se diseñan en HU-C11.4 |

---

## 2. Contexto y alcance

### 2.1 La finca cero

| Dato | Valor | Implicación de diseño |
|---|---|---|
| Cultivo | Tomate, manejo ecológico (sin certificar aún) | Régimen `ecologico` por finca/área; aviso si un insumo no está marcado como permitido; la calculadora de tanques A y B no aplica aquí |
| Área | ~2.000 m², 4 naves | Jerarquía finca → área (nave) → subárea opcional (cama/surco) |
| Sistema | Sustrato, riego por goteo, automatización después | El registro de riego mide CE y pH de entrada y drenaje y % de drenaje; el nodo ESP32 llenará ese mismo registro (§5.11) |
| Personas | Hasta 4 (operarios y supervisor), no siempre simultáneas, cada uno con smartphone propio | Roles; invitación por WhatsApp; modo «tablero» (un teléfono registra por otros) mientras no haya sincronización |
| Venta | Cliente final (tienda en línea), comerciantes pequeños, restaurantes, cadenas pequeñas y medianas | Lotes de venta, despachos, QR de trazabilidad, puente con la Tienda del ecosistema |
| Certificación | Futura, después de probar | Los registros se diseñan desde el día 1 para servir de evidencia; la carpeta de cumplimiento llega después |

### 2.2 Generalización: cualquier agroindustria del Estudio

Nada en el modelo nombra al tomate. Cultivo, variedad, tipos de área, tipos de labor, unidades de cosecha (kg, tallos, cajas) y régimen de producción son **catálogos**, no código. La prueba: el sistema de pruebas monta siempre dos fincas de prueba distintas —una de hortaliza bajo invernadero y una de flores o aguacate— y ninguna prueba nombra una finca real (P4, `BITACORA.md`).

| Cadena (Estudio) | Qué usa del mismo modelo | Qué agrega después |
|---|---|---|
| Hortalizas bajo invernadero (finca cero) | Todo lo de §5 | Solución nutritiva (convencional) |
| Flores | Áreas = bloques/camas; cosecha en tallos; personal y rendimiento | Poscosecha y clasificación; Florverde |
| Aguacate Hass | Áreas = lotes con hectáreas y geolocalización; carencias | Registro de predio exportador; GlobalG.A.P. |
| Café y cacao | Polígonos de parcela | Paquete EUDR para la cooperativa (plan Cadena) |

### 2.3 Tensiones con ED1, dichas antes de construir

1. **El agro no está en el ICP de ED1** (ED1 §2.1). Lo decidiste tú; queda escrito como ADR-2. Consecuencia: las métricas del flywheel de ED1 no validan el agro. El agro lleva sus propios umbrales, los de las instrucciones del proyecto §8.
2. **El SaaS antes de los umbrales** contradice la regla de tres y el roadmap (ED1 §3.11, §33, [H1]). La excepción se acota así:
   - Se construye solo lo que la finca cero usa esta temporada.
   - Toda abstracción de plataforma (Product Engine, Automation Engine) sigue esperando sus tres casos.
   - El plan Finca no se cobra hasta que se cumplan los umbrales de la etapa 4 → 7. *(Excepción del dueño, 3 oct 2026: si un cliente pide pagarlo, se cobra en línea con Bold, HU-E0.7. Un cliente que paga es la señal más fuerte que puede dar la validación; los umbrales siguen decidiendo cuándo se ofrece a todos.)*
3. **CORE v0 se adelanta a la Fase 3** (ADR-9). Es el primer caso real de cuentas en ED1. Se construye **mínimo** (§5.4) y sin nada de lo que ED1 lista como arquitectura objetivo del CORE (billing, entitlements configurables, auditoría general).
4. **Hallazgo nuevo para ED1:** aislar cuotas en «otra cuenta de Cloudflare» (ED1 §14.1, §25.1) roza la prohibición de esquivar cuotas de Cloudflare (§6.5). Se propone reformular ED1 como aislamiento de **riesgo** con cuenta paga o del cliente. Ver §14.

### 2.4 Escalera aplicada a este producto

| Peldaño ED1 (§38) | Qué ve el productor | Qué lo empuja al siguiente |
|---|---|---|
| Herramienta gratuita | Calculadora de DPV (luego carencias, BPA, grados-día; orden de HU-E0.2) | «Guarda esta lectura en tu cuaderno» |
| Usuario recurrente | Cuaderno local en el teléfono, sin cuenta, un área | Lo usa a diario; teme perder el celular |
| Cuenta | Google; sus datos suben y se sincronizan; invita al equipo | Necesita varias naves y personas |
| Premium / Finca | Varias áreas y usuarios, costos, carpeta PDF, fotos | Auditoría, cliente que pide trazabilidad |
| SaaS Exportador | QR y trazabilidad por lote, rendimiento por operario, alertas por WhatsApp | Su comprador exige GlobalG.A.P./Florverde |
| Cadena (B2B) | Portal de la exportadora/cooperativa sobre sus proveedores; celda dedicada | Cientos de proveedores |
| Conectado | Nodos ESP32 que riegan y llenan el cuaderno solos | Quiere automatizar sin pagar Priva |
| Servicios | Implementación, capacitación, preparación de auditoría | — |

---

## 3. Principios aplicados

Se heredan todos los de ED1 §3 y los de las instrucciones del proyecto §4. Aquí solo lo que cambia su forma en este producto, y las lecciones del ecommerce que se vuelven regla de diseño (la lista completa y cómo se vigila cada una: `BITACORA.md` › Lo aprendido).

| Regla | Forma concreta aquí |
|---|---|
| Browser-first | Cálculos, reportes, PDF, compresión de fotos y QR se hacen en el teléfono |
| Offline-first | Ninguna pantalla del cuaderno espera a la red para guardar |
| Static-first | Todo lo público es asset estático; el Worker de la celda solo atiende `/api/*` |
| Budget-first | Cada producto declara su presupuesto en `product.yaml`; la celda se degrada por niveles (§8) |
| P1 · El fallo que funciona es el caro | Nada cae a un valor de fábrica en silencio: un registro rechazado va a cuarentena **visible** en la app; un número ilegible es error, no cero |
| P2 · Una sola fuente | Esquemas de registro en `packages/agro-schema` (zod) usados por la app, la API y las pruebas; `infrastructure/celdas.json` es la única lista de celdas |
| P8 · El reloj es una entrada | Se guardan la fecha agronómica local (`YYYY-MM-DD`, America/Bogota) y los instantes en UTC; las pruebas corren con otro huso y en fin de mes |
| P10 · El que se actualiza corre su versión vieja | El servidor acepta el protocolo N-1 y avisa; las migraciones son expandir → migrar → contraer |
| P13 · Un secreto no viaja por donde queda escrito | Ningún token en URL; los secretos solo en los secretos de Cloudflare y de GitHub |
| P21 · Lo que borra antes de escribir | Mudanza, restauración e importación escriben primero, verifican y solo después retiran lo viejo |

---

## 4. Vista general

```text
                              PRODUCTOR / ASESOR / COMPRADOR
                                          │
             ┌────────────────────────────┼─────────────────────────────┐
             ▼                            ▼                             ▼
   /herramientas/agro/*            /agro/app/ (PWA)             /agro/t/#<datos>
   Calculadoras estáticas        Cuaderno offline-first        Trazabilidad QR estática
   (Astro + islas Preact)        IndexedDB · Service Worker     (verifica firma en el navegador)
             │                            │   ▲
             │ eventos en lote            │   │ sync push/pull (HTTPS, bearer)
             ▼                            ▼   │
   Analytics Engine / Web Analytics   ┌──────────────── CELDA N (cuenta Cloudflare) ────────────────┐
                                      │  Worker agro-api (Hono)  ·  solo /api/*                     │
                                      │  D1 agro_c{N}_s{1..k} (shards)   R2 (fotos, respaldos)      │
                                      │  KV (flags, kill switch)   Cron único (vigía, respaldo)     │
                                      │  [Conectado] /api/v1/dispositivos · Durable Object por finca│
                                      └─────────────────────────────────────────────────────────────┘
                                          ▲ verifica tokens con clave pública (sin llamar al CORE)
                                          │
                              ┌──────── CORE v0 (cuenta principal) ────────┐
                              │ Worker core-api · D1 core                   │
                              │ usuarios, identidades Google, sesiones,     │
                              │ organizaciones, membresías, invitaciones,   │
                              │ directorio organización → (celda, shard)    │
                              └─────────────────────────────────────────────┘

   GITHUB (plano de construcción): monorepo → CI → build estático → despliegue por anillos a cada celda
   Nunca procesa datos de fincas ni de usuarios ([H6]).

   EN LA FINCA (Conectado, después): sensores → nodo ESP32 (decide) → [RPi opcional, MQTT local] → resumen a la celda
```

---

## 5. Componentes

### 5.1 Sitio público y calculadoras

- **Qué es:** un Worker con **Static Assets** que sirve páginas generadas por Astro. Las calculadoras son islas Preact. Ninguna ruta pública ejecuta el script del Worker (sin `run_worker_first`), así que no consumen la cuota de 100.000 solicitudes/día (ED1 §3.10, [H3]).
- **Rutas (ADR-19):** en el host `cultivopro.co` (de `celdas.json`; el sitio, la CSP del cuaderno y el CORE lo leen de ahí): `/herramientas/agro/calculadora-dpv/`, `/herramientas/agro/periodo-de-carencia/`, … y la tabla de contenidos `/herramientas/agro/`. El Worker del sitio es dueño de todo el subdominio y sirve assets estáticos sin ejecutar el script, salvo `/api/*`. Si después se valida pasar al dominio principal o a un dominio nuevo, se cambia el host y se redirige con 301; las rutas no cambian.
- **Contrato:** un `product.yaml` por herramienta (ED1 §5.1), validado por `schemas/product.schema.json` en CI. Extensión agro:

```yaml
id: agro-calculadora-dpv
nombre: "Calculadora de DPV"   # nombre corto: migas, relacionados, índice
slug: /herramientas/agro/calculadora-dpv/
tipo: utility
estado: borrador            # borrador | activo | pausado | retirado
familia: agro
icp: false                  # el agro no está en el ICP de ED1 (§2.3)
peldano: herramienta-gratuita
siguiente_paso: agro-cuaderno   # a dónde lleva el resultado
plantilla: tool-agro
runtime: browser
seo:
  title: "Calculadora de DPV (déficit de presión de vapor) para invernadero"
  description: "..."
monetizacion:
  ads: []                   # sin anuncios mientras se valida
  ads_en_procesamiento: false
relacionados: [agro-cuaderno]  # solo productos que existen; carencias entra con HU-E10.1
eventos: [tool.opened, tool.completed, tool.shared, tool.next_step]
presupuesto:
  api_requests_dia: 0
  analytics_points_dia: 2000
kill_switch: true
revision_agronomica: pendiente   # pendiente | aprobada:<fecha>:<quién>
fuentes:
  - "FAO-56, ec. 11 (Allen et al., 1998)"
```

- **Marca (3 oct 2026):** el producto se llama **CultivoPro**. El nombre, el lema y el trazo de la hoja viven en `content/marca.json` (P2). `scripts/generar-iconos.ts` dibuja de ese trazo, sin dependencias y siempre igual, el favicon, los íconos de la app y los archivos de `/marca/`; `scripts/exportar-logo.ts` exporta los logos con el nombre. `tests/repo/marca.test.ts` e `iconos.test.ts` exigen que no quede el nombre anterior y que los archivos coincidan con el trazo.
- **Guías para la gente de campo (3 oct 2026):** `/agro/guia/` (para el productor) y `/agro/vendedores/` (para quien vende el plan), en lenguaje sencillo y sin términos técnicos.
- **Eventos:** se acumulan en la página y salen **una vez** por sesión con `navigator.sendBeacon` a `/api/eventos` del Worker del sitio, que los escribe en Workers Analytics Engine ([H4]). Una sesión cuesta una invocación del Worker. Muestreo configurable en `product.yaml` si una herramienta crece.
- **Quality gate** (ED1 §12.2) en CI: ejemplo resuelto, FAQ específica, fuente de cada fórmula, relacionados definidos, Core Web Vitals y WCAG AA. Agro agrega un control: **`revision_agronomica` aprobada antes de pasar a `activo`**.

### 5.2 `packages/agro-calc` — los cálculos

Funciones puras en TypeScript, sin dependencias, con unidades en el nombre (`temperaturaC`, `humedadRelativaPct`, `dpvKPa`). La calculadora pública, el cuaderno y el nodo ESP32 usan la misma función. El firmware la replica en C++, con una prueba que compara las dos sobre la misma tabla de casos (P2).

**DPV (primera herramienta).**

- Presión de vapor de saturación, FAO-56 ec. 11: `es(T) = 0,6108 · exp(17,27·T / (T + 237,3))` [kPa, T en °C].
- DPV del aire: `DPV = es(T) · (1 − HR/100)` [kPa].
- DPV de la hoja (opcional, con temperatura de hoja `Th`): `DPVh = es(Th) − es(T)·HR/100` [kPa].

Casos de prueba, calculados con esa fórmula:

| T aire (°C) | HR (%) | es (kPa) | DPV (kPa) |
|---|---|---|---|
| 24 | 70 | 2,984 | **0,895** |
| 28 | 55 | 3,780 | 1,701 |
| 22 | 85 | 2,644 | 0,397 |
| 16 | 90 | 1,818 | 0,182 |
| 26 aire, 24 hoja | 60 | es(24) = 2,984; ea = 2,017 | DPVh = **0,967** |

- **Rango de referencia para tomate (supuesto a validar con el agrónomo aliado):** el valor por defecto es 0,5–0,8 kPa, con aviso fuera de 0,4–1,2 kPa. Sale de la revisión de Shamshiri et al. (2018), que recopila rangos de 0,4–0,8 a 0,47–1,27 kPa según la fuente. El rango se guarda **por cultivo y etapa** en un catálogo, no en el código.

### 5.3 Cuaderno de campo (PWA)

| Pieza | Elección | Licencia |
|---|---|---|
| UI | Preact + `@preact/signals` + `preact-iso` | MIT |
| Almacén local | Dexie sobre IndexedDB | Apache-2.0 |
| Service worker | Workbox: precache del shell. `/api/*` no se intercepta: va siempre a la red y nunca queda en caché (P7); los datos viven en IndexedDB (HU-E3.1) | MIT |
| Validación | zod (esquemas de `packages/agro-schema`) | MIT |
| PDF y QR | pdf-lib, qrcode-generator | MIT |
| Firma/verificación | WebCrypto Ed25519 (nativo) | — |

Las licencias se verifican en CI (HU-E1.2). Una AGPL rompe el build y se decide a mano.

Reglas de la app:

1. **Guardar nunca espera a la red.** Todo registro se escribe en IndexedDB en una transacción con su operación de salida (`outbox`). La sincronización corre aparte.
2. **Instalable y usable sin cuenta** (peldaño «usuario recurrente»): una finca local con un área, sin límite de tiempo. Al crear la cuenta, lo local se **reclama** y sube (HU-E4.3).
3. **Actualizar no pierde datos:** la versión nueva del service worker espera. Se ofrece «Actualizar» y **nunca** se recarga sola mientras haya operaciones pendientes o un formulario abierto.
4. **El teléfono dice dónde está cada dato.** Tres estados: *solo en este teléfono*, *enviado*, *rechazado (ver por qué)*. Eso es P1 y P15 aplicado al campo.
5. **Modo tablero:** un teléfono de supervisor registra a nombre de personas sin cuenta (`persona_ids`). Sirve antes de que exista la sincronización y para operarios sin Google.
6. **Almacenamiento persistente:** se pide `navigator.storage.persist()` y se muestra el espacio usado. Se recuerda exportar si el navegador no concede persistencia.
7. **Español de Colombia, °C, kPa, L, m², ha, kg, COP**; fechas `dd/mm/aaaa`; teclados numéricos que aceptan coma decimal. Un valor ilegible **no es cero** (bitácora ecommerce, `Number(celda) || 0`).

### 5.4 CORE v0 (identidad, organizaciones, directorio)

Lo mínimo que exige tener cuentas, y nada más (ED1 §5, ADR-9):

| Tabla (`D1 core`) | Para qué |
|---|---|
| `usuario` | id, nombre, email, creado |
| `identidad` | proveedor (`google`), `sub`, usuario_id |
| `sesion` | refresh token (hash), **producto** (un refresh sirve a uno solo, 0006), dispositivo, creado, expira, revocado |
| `organizacion` | id, **producto**, nombre, tipo y plan (claves foráneas compuestas a los del producto, 0006), estado (`activa`, `mudando`, `suspendida`, `baja`), `plan_vence` (HU-E0.7: vencido, el directorio entrega «gratuito»), **celda_id**, **shard**, anillo |
| `membresia` | usuario × organización × rol, con el producto de la organización: un rol de otro producto lo rechaza la base (0006) |
| `invitacion` | código de un solo uso (hash), rol del producto de la organización, expira, creada_por |
| `celda` | id, **producto** (0006), url base de la API, clave pública vigente y anterior, estado |
| `interes_plan` | usuario × organización × plan (`finca`, `exportador`, `cadena`) con su fecha: la lista de espera con precio visible (HU-E0.6). Sin cobro ni tarjeta |
| `pago` | un cobro de Bold por intento: orden, organización, quién, plan, meses, monto que calculó el CORE, ambiente, estado (`esperando`, `aprobado`, `rechazado`, `revisar`) y la transacción (HU-E0.7). Desde la 0006, `meses` es un periodo de la tabla `periodo` y `periodo_desde`/`periodo_hasta` dicen lo que cubrió. Sin datos de tarjeta ni del comprador |
| `producto` | Los productos del CORE (ADR-20, 0006): id, nombre y estado (`activo`, `pausado`, `retirado`). La siembra la migración con el agro; el despliegue la pone al día desde `infrastructure/productos.json` (HU-C2.3) |
| `producto_tipo` | Los tipos de organización de cada producto (0006) |
| `producto_rol` | Los roles de cada producto, con `administra` e `invitable` (0006) |
| `plan` | Los planes de cada producto, con `gratuito` y estado (0006) |
| `periodo` | Los periodos de prepago: 1, 3, 6 y 12 meses (ADR-22). Uno nuevo es un INSERT, no un CHECK (0006) |
| `plan_precio` | Precio de cada plan por periodo, con `vigente_desde`: un precio no se edita, entra uno nuevo (0006) |
| `aceptacion_politica` | Qué versión de la política de cada producto aceptó cada persona y cuándo (0006). Reemplaza a `usuario.politica_*`, que se retira al contraer |
| `auditoria` | Lo que tocó seguridad o dinero, una fila por hecho (0007, HU-C2.4): entradas, invitaciones aceptadas, cambios de rol, personas quitadas, teléfonos retirados y pagos cerrados. Se escribe en el mismo lote que el hecho y solo si el hecho quedó. Sin lecturas ni renovaciones. La ve quien administra (`POST /api/core/auditoria/ver`) |

- **Dónde vive (HU-E4.1):**
  - Worker `agro-core` en workers.dev, con la base D1 `agro_core` (con `_staging` en staging), en la cuenta de la celda que dice `core.celda` en `celdas.json`.
  - Migraciones en `infrastructure/migraciones/core/`. Cada índice dice en la migración por qué existe (§6.2).
  - El despliegue crea la base, aplica las migraciones y copia `celdas.json` a la tabla `celda` (P2). Una celda que sale de `celdas.json` queda `fuera`; nunca se borra (P21).
  - Rutas: `GET /api/core/salud` (prueba de humo), `GET /api/core/claves` (clave pública de los tokens) y `/api/core/auth/*` (entrar con Google, HU-E4.2). Crear organizaciones desde la app llega con HU-E4.3.
  - Sus URL (producción y staging) están en `celdas.json` (`core.url`, `core.url_staging`): el cuaderno elige por host, y el despliegue falla si no coinciden con las que publica wrangler.
- **Dónde nace una organización (regla escrita, nunca a mano):**
  - **Celda:** la activa con shards que tenga menos organizaciones. A carga igual, la de anillo de despliegue menor y luego el id.
  - **Shard:** el de esa celda con menos organizaciones. A carga igual, el primero de `celdas.json`.
  - **Anillo de funciones (§7.3):** las 5 primeras organizaciones son pilotos (anillo 1); las demás, anillo 2. La finca cero es la primera que se crea (HU-E4.3).
  - Sin celda posible, la creación falla con el motivo. No hay celda por defecto (P1).
  - Código: `apps/core/src/asignacion.ts`.
- **Login:** Google OIDC con PKCE (librería Arctic, MIT), con el CORE como cliente confidencial. Sin contraseñas. Implementado en HU-E4.2 (`apps/core/src/entrar.ts`):
  1. El cuaderno abre `/api/core/auth/google/inicio?vuelta=<pantalla del cuaderno>`. El CORE solo acepta pantallas de `/agro/app/` en los orígenes que le pasa el despliegue (`ORIGENES_APP`), guarda `state`, `code_verifier` y la vuelta en una cookie `HttpOnly`, `Secure`, `SameSite=Lax` de 10 min, y redirige a Google.
  2. Google vuelve a `/api/core/auth/google/callback`. El CORE canjea el `code`, crea o encuentra al usuario por su `sub` de Google, crea la sesión y vuelve al cuaderno con un **código de entrada** en el fragmento (`#entrar=…`): un secreto de un solo uso que vence en 2 minutos. En D1 solo queda su hash.
  3. El cuaderno borra el fragmento de la barra de direcciones y canjea el código con un POST: recibe access y refresh en el cuerpo y los guarda en IndexedDB (`meta`, que no viaja en los respaldos).
  - Dirección de regreso registrada en Google Cloud: `<url del CORE>/api/core/auth/google/callback`, para producción, staging y `http://localhost:8787`. El enlace mágico por email llega cuando haya proveedor de email (ED1 §20.2).
- **Tokens (ADR-10):**
  - Access token JWT Ed25519 de 12 h, con `sub`, `org`, `rol`, `celda`, `shard` y `anillo`. Desde HU-C4.3 es v2 (PLATAFORMA §4.6): `iss = ed1-core`, `ver = 2`, `aud` (el producto de la organización, o el de la sesión sin organización), `plan` y `plan_vence` con la gracia del producto ya aplicada, y `auth_time` (la última entrada con Google; renovar no lo cambia). Las celdas aceptan v1 y v2 desde la fase N (HU-C4.1).
  - Refresh token opaco de 60 días, rotado a lo sumo una vez al día. Cada rotación es una escritura en D1, así que no se hace por hora. El último giro se deduce de `sesion.expira` (giro + 60 días), sin columnas nuevas.
  - El token lleva la organización si la persona tiene una sola o si la pide; sin ninguna, `org` va en null (crea la suya en HU-E4.3).
  - Kill switch `ks:agro-core` (en el KV de flags de la celda del CORE): apagado, nadie entra ni renueva; los access ya emitidos valen hasta que vencen.
  - Offline, el access vencido no impide registrar, solo sincronizar.
- **Invitaciones sin email (HU-E4.4, `apps/core/src/invitaciones.ts`):** el propietario genera un enlace de un solo uso que vence en 7 días y lo comparte por WhatsApp (`wa.me/?text=…`). El código viaja en el **fragmento** (`/agro/app/unirme/#invitacion=…`), no en la ruta ni en la query (P13); en D1 solo queda su hash.
  - `POST /api/core/invitaciones` (solo `propietario`), `POST /api/core/invitaciones/ver` y `POST /api/core/invitaciones/aceptar`: el código va siempre en el cuerpo.
  - Aceptar es un solo batch: marca la invitación usada solo si sigue sin usar y vigente, y crea la membresía con su rol. Dos aceptaciones a la vez dejan una sola membresía. Quien ya es miembro no la gasta.
  - La persona invitada entra con Google; su token siguiente lleva la organización y el rol.
- **Revocar (HU-E4.6, `apps/core/src/equipo.ts`):**
  - `POST /api/core/telefonos/{ver,retirar}`: cada cuenta ve y retira sus propios teléfonos. Retirar revoca la sesión.
  - `POST /api/core/equipo/{ver,rol,quitar}`: el propietario ve quién tiene acceso, cambia roles y quita personas. Quitar borra la membresía; los registros siguen en la celda.
  - En los dos casos, el access ya emitido vale hasta 12 h. Nadie cambia su propio acceso.
- **Una cuenta en varias fincas (bitácora agro 25):** el teléfono pide siempre el token de la finca de su vínculo (`sesionDeLaFinca`). Sin pedirla, el CORE da un token sin finca.
- **Plan en la sesión (HU-E3.11):** cada organización de la sesión trae su `plan`, para que el teléfono ofrezca solo lo de su peldaño (§2.4). Por ejemplo, las fotos son del plan Finca. Sin dato, cuenta como gratuito.
- **Directorio:** se consulta **solo al iniciar sesión**. La celda y el shard viajan en el token, así que ninguna solicitud de sincronización toca el CORE.
- **La cuenta del ecosistema (HU-C7.2, ADR-28, `apps/cuenta`):** páginas de Astro estáticas que el Worker del CORE sirve como sus assets, en `cuenta.laboratorio-digital.com` (HU-C4.6).
  - El Worker corre primero **solo** en `/api/core/*`, `/oauth/*` y `/.well-known/*`; una página nunca gasta una invocación. La página 404 la sirve Workers Static Assets (`not_found_handling: 404-page`).
  - Sin JavaScript: los componentes v2 de Preact se usan sin `client:*` y llegan como HTML. CSP `'self'` en `_headers`, `noindex` en cada página y `Disallow: /` en `robots.txt`. `scripts/verificar-cuenta.ts` revisa el build y lo detiene si algo de eso no se cumple.
  - Al ser el mismo origen que el CORE, la cuenta llama a `/api/core/*` sin CORS.
  - **Entrar y salir (HU-C7.3):** la cuenta es el producto `cuenta` de `productos.json`, sin organizaciones. Se entra con un formulario `GET` a `/api/core/auth/google/inicio?producto=cuenta`, que exige la casilla de su política; su único script (la sesión, en archivo) canjea el código y guarda el refresh en el navegador. `POST /api/core/auth/salir` cierra la sesión en el CORE. El token de la cuenta no trae organización, así que ninguna celda lo acepta.
- **El Parqueadero ED1 (`apps/parqueadero-sitio`, `docs/parking/ARQUITECTURA-PARQUEADERO.md`):** un Worker solo de assets, en staging (`ed1-parqueadero-staging`) hasta que su dominio exista (HU-Q5.2). En `/caja/`, una PWA que funciona sin red e imprime por Web Bluetooth con `@ed1/impresion`; en M0 no tiene cuenta, API ni D1 (ADR-32), y su CSP solo deja conexiones a su origen (`scripts/lib/cabeceras-parqueadero.ts`). `scripts/desplegar.ts` lo publica después del CORE y su prueba de humo exige la caja con su CSP y su service worker.

### 5.5 Celda

Una celda = en **una** cuenta de Cloudflare:

- Worker `agro-api-c{N}` (Hono), solo `/api/*`.
- D1 `agro_c{N}_s{1..k}`: shards. Cada organización vive entera en uno.
- R2 `agro-c{N}`: fotos, exportaciones y respaldos.
- KV `agro-c{N}-flags`: kill switches, degradación y anillos de funciones. Una celda de otro producto lleva su nombre: `parqueadero-c2-flags` (HU-Q7.2).
- **Un** Cron Trigger despachador: vigía de cuota cada hora, respaldo semanal, purga de exportaciones vencidas (ED1 §7.1).

Ningún identificador de cuenta, base o dominio está en el código. Todo sale de `infrastructure/celdas.json` (fuente única, P2), del que se generan `wrangler.toml` por celda y la tabla `celda` del CORE:

```json
{
  "celdas": [
    {
      "id": "c0",
      "cuenta": "ED1 principal",
      "plan": "free",
      "anillo_despliegue": 0,
      "api": "https://agro-api-c0.<subdominio>.workers.dev",
      "api_staging": "https://agro-api-c0-staging.<subdominio>.workers.dev",
      "shards": ["agro_c0_s1"],
      "estado": "activa"
    }
  ]
}
```

**Implementado en HU-E5.1:**
- Worker `agro-api-<celda>` (`apps/api-celda`), con un binding D1 por shard cuyo nombre es el del shard. Su configuración (`apps/api-celda/wrangler.<celda>.jsonc`) se genera de `celdas.json`.
- `celdas.json` nombra la URL de la API de cada celda por destino (`api`, `api_staging`). El despliegue falla si wrangler publica otra, y la copia a la tabla `celda` del CORE: el cuaderno la recibe en el directorio al entrar.
- Migraciones de los shards en `infrastructure/migraciones/celda/`: `registro`, `catalogo` (todos los catálogos, con columna `entidad`), `entidad_historial` y `cuarentena`. Cada índice dice su costo; una prueba exige exactamente los justificados.
- `/api/v1/*` verifica el token con la clave pública que el despliegue lee de `/api/core/claves`, sin llamar al CORE. Organización, rol y shard salen del token. `GET /api/salud` (sin token) es la prueba de humo.
- Kill switch `ks:agro-cuaderno`: apagado, `/api/v1/*` responde 503 con `Retry-After`.

La celda **c0 es tu cuenta actual**, la misma que atiende el resto de ED1. El agro declara su parte del presupuesto (§8) para no dejar sin cuota a los demás productos.

### 5.6 Sincronización (protocolo v1)

```text
TELÉFONO                                                        CELDA
outbox (IndexedDB) ──POST /api/v1/sync/push  {protocolo:1, dispositivo, ops[≤25]}──►  valida (zod)
                    ◄── acks [{id, estado: aceptado|duplicado|cuarentena|reintentar}] ─  INSERT OR IGNORE por id
cursor local ───────GET  /api/v1/sync/pull?desde=<seq>&limite=200 ───────────────►  WHERE org=? AND seq>?
                    ◄── cambios + nuevo cursor ────────────────────────────────────
```

- **Ids UUIDv7 generados en el teléfono** (`packages/ids`, que también usa el CORE). Reintentar es inofensivo: el mismo id no se inserta dos veces.
- **Lotes de ≤ 25 operaciones** por solicitud. D1 gratuito permite 50 consultas por invocación del Worker (ED1 §41). Implementado (HU-E5.2): 3 lecturas y una escritura por operación en un solo `batch`, que es una transacción; 25 operaciones = 28 consultas. Actualizar un catálogo es una sola sentencia porque un trigger guarda la versión anterior en `entidad_historial` (migración 0002).
- **Orden de envío:** la finca primero, después los catálogos, al final los registros. Un catálogo editado varias veces viaja una vez, con su versión vigente. Protocolo compartido en `packages/sync`, que no sabe de ningún producto: cada uno le pasa sus entidades y sus esquemas (`crearValidador`, `crearPermisos`). Las del agro viven en `packages/agro-schema/src/sync.ts` y las del parqueadero en `packages/parqueadero-schema/src/sync.ts`; una guardia de repositorio impide que `packages/sync` importe de un producto (HU-Q7.3, ADR-39 del parqueadero). El formato en el cable no cambió.
- **`reintentar`:** si otro teléfono de la misma finca escribió el mismo catálogo en el mismo instante, la operación se queda en la cola y se reenvía; en la vuelta siguiente decide la regla de conflictos. Ninguna versión se pierde.
- **Conflictos de catálogos (HU-E5.4):** gana la última edición que llega a la celda.
  - Se guarda con la versión siguiente a la vigente, y la anterior queda en `entidad_historial` como «conflicto».
  - `catalogo.reemplazo` nombra el teléfono que perdió. Ese teléfono, al bajar, guarda un aviso con su versión y ofrece volver a ponerla como una edición nueva.
  - Un reenvío de datos que la celda ya tiene es `duplicado`.
  - Los registros no tienen conflictos: el mismo id es el mismo registro.
- **Tenant en el push:** una operación que dice ser de otra organización, de otra finca, o con un id que ya usa otra organización, va a cuarentena.
- **El servidor no guarda cursores por dispositivo.** El cursor vive en el teléfono (`seq` monotónico por organización, asignado al insertar). Cero escrituras de contabilidad.
- **Cuarentena, nunca descarte (P1).** Una operación que no valida se guarda con su motivo en `cuarentena` y el teléfono la muestra en rojo con el texto del motivo (tabla local `rechazo`; el dato sigue en su tabla). Un humano decide.
- **Vincular la finca (HU-E4.3):** `POST /api/core/organizaciones` con un id que genera el teléfono (idempotente). La sesión trae `url_api`, la API de la celda de esa organización. El vínculo vive en `meta`; los datos locales no se reescriben.
- **Versiones (ADR-13, P10):**
  - Cada operación lleva `v` (versión del esquema del registro).
  - El servidor acepta todas las versiones que alguna app publicada escribió y las traduce al leer.
  - Si la app es más vieja que `app_minima`, el push **se acepta igual** y la respuesta pide actualizar. Ningún dato de campo se pierde por venir de una app vieja.
  - Implementado (HU-E5.5): `APP_MINIMA` en `packages/agro-schema/src/sync.ts` (antes en `packages/sync`, HU-Q7.3); el teléfono manda su versión en cada push y muestra el pedido en el aviso de arriba. Los registros se guardan con la versión con que llegaron; `aVersionVigente` (`packages/agro-schema`) los traduce paso a paso al leerlos.
  - **Contrato de versiones:** cada app publicada deja en `packages/agro-schema/contratos/app-<versión>.json` una muestra de todo lo que escribe. Esos archivos no se editan ni se borran, y una prueba exige que la API vigente los acepte todos (P10).
- **Pull que no pisa lo pendiente:** un cambio remoto sobre una entidad con edición local pendiente se guarda como conflicto y se muestra (§5.7). Implementado (HU-E5.3): el teléfono guarda la versión de la nube en su historial local (`<id>@v<versión>#nube`) y conserva la suya; al subirla, gana por llegar después y el otro teléfono recibe el aviso (HU-E5.4).
- **Pull (HU-E5.3):** `GET /api/v1/sync/pull?registro=<seq>&catalogo=<seq>`, con dos cursores porque `seq` es por tabla. Hasta 200 cambios por página, catálogos primero; 2 lecturas, ninguna escritura. Cada página se aplica en el teléfono junto con su cursor, en una transacción. Lo que baja no entra a la cola de salida. Un teléfono sube primero y baja después.
- **Frecuencia:** al abrir la app, al volver la señal, cada 15 min con la app abierta, a los 3 s de guardar algo (si hay algo en la cola) y al volver a la app (como máximo cada 30 s). Espera exponencial si la celda responde 429 o está degradada; esa espera manda sobre todo lo demás (bitácora agro 22). Costo: unas 2 solicitudes por registro guardado, dentro de las ~100 por finca al día de §6.2 para 20 registros diarios.

### 5.7 Modelo de datos

**Catálogos** (mutables, `version`, última escritura gana y con historial en `entidad_historial`):

| Entidad | Campos clave |
|---|---|
| `finca` | nombre, municipio, régimen (`ecologico`/`convencional`), geolocalización (punto; polígono después, EUDR) |
| `area` | finca, padre (para cama/surco), tipo (`nave`, `bloque`, `lote`, `cama`), área m², capacidad (plantas) |
| `ciclo` | área(s), cultivo, variedad, fecha de siembra/trasplante, plantas, estado, fecha de fin |
| `persona` | nombre, rol en la finca, usuario_id opcional, valor de jornal (solo visible a propietario/supervisor) |
| `insumo` | nombre comercial, tipo (bioinsumo, fertilizante, fitosanitario, sustrato…), **registro ICA**, ingrediente activo, unidad, **carencia (días)** y **reentrada (horas)** copiadas de la etiqueta, permitido en ecológico (declarado por el usuario), precio |
| `cliente` | nombre, tipo (consumidor, restaurante, tienda, cadena), contacto. *Hoy (HU-E6.3) el cliente va dentro de cada despacho, con nombre y tipo y sin contacto. Pasa a ser catálogo cuando haga falta editarlo o guardar su contacto, junto con la migración que rehace el CHECK de `catalogo` y un `agro-export` v2* |
| `catalogo_*` | cultivos, variedades, tipos de labor, plagas, categorías de calidad, rangos de DPV por cultivo y etapa |

**Registros** (inmutables; tabla `registro` con columnas comunes y `datos` JSON validado por tipo y versión):

```text
registro(id UUIDv7, org_id, finca_id, area_ids[], ciclo_id, tipo, v,
         fecha_agronomica 'YYYY-MM-DD' (hora local de la finca),
         instante_evento UTC (reloj del teléfono), instante_recibido UTC (reloj de la celda),
         autor_usuario_id, persona_ids[], dispositivo_id, origen (manual|tablero|dispositivo|importacion),
         anula_id (si corrige otro), datos JSON, seq)
```

| Tipo | `datos` (resumen) |
|---|---|
| `riego` | volumen por gotero o por área (L), pulsos, duración; CE (dS/m) y pH de entrada y de drenaje; volumen de drenaje → % drenaje calculado |
| `clima` | T (°C), HR (%), T de hoja opcional → DPV guardado **y** recalculable |
| `labor` | tipo (tutorado, deshoje, poda, polinización, limpieza…), horas, personas |
| `aplicacion` | insumo, dosis **según etiqueta** (texto + número), volumen de mezcla, equipo, área, responsable → vence carencia y reentrada |
| `monitoreo` | plaga o enfermedad, método (trampa, conteo), incidencia/severidad, foto opcional |
| `cosecha` | área, kg (o tallos/cajas), categoría de calidad, descarte; desde v2, horas de cada persona que cosechó (HU-E7.4, nulo si no se anotaron) |
| `lote_venta` | cosechas enteras que agrupa, código corto (`T-27MAR-2`, con el mes en letras), cantidad vendible (cosechado − descarte), unidad, cultivo. Implementado (HU-E6.2): una cosecha va en un solo lote; si dos teléfonos sin señal chocan en código o en cosecha, gana el lote más antiguo y el otro se muestra con letra y aviso (`apps/cuaderno/src/almacen/lotes.ts`) |
| `despacho` | cliente (nombre y tipo), lote(s) con su cantidad, unidad, precio por unidad en COP (nulo = no anotado), medio de pago. Implementado (HU-E6.3): solo lo ven propietario y supervisor |
| `movimiento_insumo` | entrada (compra, precio) o salida (vinculada a una aplicación) |
| `jornal` | persona, fecha, horas o jornal, labores |
| `nota` | texto libre, foto opcional |

- **Corregir = anular.** Un registro nuevo con `anula_id` apunta al anterior. La app muestra el vigente y guarda el historial. Nadie borra.
- **Reloj (P8):**
  - Si `instante_evento` e `instante_recibido` difieren en más de 10 min a favor del teléfono, se marca «reloj del teléfono corrido» y se avisa. No se corrige en silencio. Implementado (HU-E5.6): el ack del push trae `aviso: reloj-corrido` y el cuaderno pide corregir la hora en un aviso bajo la cabecera; el registro se guarda con su hora.
  - Carencias y reportes usan `fecha_agronomica`.
  - El límite diario de D1 se reinicia a las 00:00 UTC, que son las **19:00 en Bogotá**.
- **Tenant en cada fila.** Toda tabla lleva `org_id` y toda consulta de la API lo exige desde el token, nunca desde el cuerpo. Una prueba recorre todas las consultas del Worker y falla si alguna no filtra por `org_id` (P5: se ve en rojo quitando un filtro).

### 5.8 Reportes en el navegador (ADR-5)

Costos por ciclo y por área, costo por kg, rendimiento (kg/m², kg/planta, kg/hora-persona), calendario de carencias («¿qué nave puedo cosechar hoy?») y la carpeta de cumplimiento en PDF se calculan en el teléfono a partir de IndexedDB. La celda nunca ejecuta un reporte. Si un reporte es lento en un teléfono barato, se optimiza la consulta local, no se sube al servidor.

### 5.9 Trazabilidad por QR (ADR-14)

- El QR apunta a `/agro/t/#<datos>`: una página **estática** que lee el fragmento.
  - El fragmento no viaja al servidor.
  - Lleva: finca (nombre público), área, cultivo y variedad, fecha de cosecha, código de lote, régimen y firma.
- **Firma Ed25519 de la celda** sobre esos datos, pedida al crear el lote cuando hay señal. Sin señal, el QR se imprime como «sin verificar» y se puede reimprimir firmado después.
- La página verifica con las claves públicas de las celdas horneadas en el build. Con una firma válida muestra «verificado por Gestión Agro», y con una inválida lo dice en rojo.
- Costo por escaneo: cero. Funciona aunque la finca cambie de celda o ya no sea cliente.
- Nunca incluye datos personales (P13, Ley 1581).
- **Implementado (HU-E6.4):**
  - Formato y verificación en `packages/trazabilidad`, sin dependencias. El fragmento es `datos[.firma]`, con `datos` en JSON base64url y la firma Ed25519 sobre ese texto.
  - Firma: `POST /api/v1/lotes/firmar` (`apps/api-celda/src/qr.ts`), con los datos que la celda tiene guardados.
  - La clave `CELDA_QR_PRIVATE_KEY` la genera el despliegue una sola vez y nunca la reemplaza: cambiarla haría que las etiquetas impresas dejen de verificarse.
  - Página: `/agro/t/` (`apps/sitio/src/pages/agro/t/`), que verifica con @noble/ed25519.
  - Las claves públicas las lee el despliegue de `GET /api/claves-qr` de cada celda activa y las pone en `#claves-qr` de la página antes de subir el sitio. Por eso el orden por celda es CORE → API → sitio.

### 5.10 Integraciones

| Integración | Cuándo | Cómo |
|---|---|---|
| WhatsApp (compartir) | Desde la primera herramienta | Enlaces `wa.me` con texto; gratis |
| WhatsApp (alertas) | Planes pagos | WhatsApp Business Platform con presupuesto y kill switch propios; nunca en el plan gratuito |
| Tienda del ecosistema | Hito «Cosecha a la mesa» | Exportar disponibilidad en CSV (HU-E6.5), formato v1 propuesto por el cuaderno y descrito en `apps/cuaderno/src/almacen/disponibilidad.ts`: `producto, categoria, disponible, unidad, lote, cosechado_desde, cosechado_hasta, finca`, una fila por lote con saldo. La Tienda lo confirma al importarlo. Sin API cruzada hasta que la Tienda la tenga |
| DIAN | Cuando haya ventas facturables desde aquí | Adaptador a un proveedor autorizado (ED1 §5.3); fuera del MVP |
| Clima | Después | OpenWeather Agro u otro con nivel gratuito, cacheado por municipio y día |
| Satélite, maquinaria | No planeado | Estudio: baja relevancia para el ICP agro |

### 5.11 Línea Conectada (diseño de referencia; se construye en el laboratorio)

**Capas** (instrucciones del proyecto §6):

1. Campo: sensores y actuadores.
2. Nodo ESP32 con ESPHome: **aquí se decide**.
3. Raspberry Pi opcional con Home Assistant, Node-RED o Mycodo, y MQTT solo local.
4. Celda: resúmenes y configuración.

**Contrato con la nube:**

| Operación | Ruta | Frecuencia |
|---|---|---|
| Reporte en lote | `POST /api/v1/dispositivos/reporte` (token por dispositivo) | Cada 15–60 min; alarmas al instante |
| Configuración | `GET /api/v1/dispositivos/config?version=` | Consulta periódica; devuelve 304 si no cambió |
| Órdenes inmediatas | Durable Object por finca con WebSocket | Solo plan Conectado |

**El cuaderno se llena solo:** cada riego ejecutado llega como un registro `riego` con `origen: dispositivo`. Es el mismo tipo de registro que el manual.

**Qué pasa si…**

| Falla | Comportamiento | Estado seguro |
|---|---|---|
| Sin internet | El nodo sigue su programa guardado; acumula lecturas y las envía al volver | Programa local vigente |
| Sin WiFi al arrancar | Arranca con el último programa en flash | Válvulas cerradas hasta cargar un programa válido |
| Reinicio / apagón | Arranca con todas las salidas apagadas; no retoma un riego a medias sin confirmar el tiempo transcurrido | Válvulas cerradas, bomba apagada |
| Falla el sensor de humedad de sustrato | Pasa a riego por horario con los tiempos de respaldo configurados; alarma | Horario de respaldo, nunca «riego continuo» |
| Falla el sensor de T/HR | No actúa ventiladores por DPV; alarma; mando manual disponible | Ventiladores según horario de respaldo |
| Riego que no termina (válvula pegada, programa corrupto) | Watchdog por zona corta al superar el tiempo máximo | Válvula cerrada y bomba apagada; alarma por dos canales |
| Tanque vacío (si hay flotador) | Bomba bloqueada | Bomba apagada |
| La celda sin cuota o caída | Nada cambia en la finca; los reportes esperan | — |

**Obligatorio en todo tablero:** selector manual, apagado y automático; cargas de 110/220 V solo por contactor con protección e instalación conforme al RETIE, hecha por un electricista; caja IP65; token por dispositivo, TLS y OTA firmada. **Cualquier diseño eléctrico requiere revisión de un electricista certificado antes de conectarse.**

---

## 6. Multi-tenancy y capacidad

### 6.1 Por qué no se copia el modelo de la tienda

La tienda da una cuenta de Google por comercio porque las **30 ejecuciones simultáneas de Apps Script no suben pagando** (bitácora ecommerce, «Lo que el terreno enseñó»). Cloudflare es distinto: los límites **sí** suben pagando (Workers Paid, USD 5/mes). Por eso aquí conviene centralizar. Los anillos de despliegue por Actions, que ya funcionan, se conservan (§7.3).

### 6.2 Capacidad estimada de una celda

Supuestos para una finca tipo como la finca cero:
- Unos 20 registros al día más unos 10 cambios de catálogo.
- Cada escritura cuenta unas 3 filas escritas, porque D1 cuenta también las entradas de índice.
- Margen ×2.
- Unos 25 requests por usuario al día, con 4 usuarios.
- Unos 400 B por fila guardada.

| Recurso | Consumo por finca | Límite gratuito (ED1 §41, verificado 30 sep 2026) | Fincas por celda al 60 % |
|---|---|---|---|
| Filas escritas D1 | ~200/día | 100.000/día | **~300** |
| Solicitudes al Worker | ~100/día | 100.000/día | ~600 |
| Almacenamiento D1 | ~4,4 MB/año | 500 MB por base; 10 bases; 5 GB por cuenta | ~110 finca-año por shard; ~1.100 finca-año por celda |
| R2 (fotos a 150 KB, 2/día) | ~110 MB/año | 10 GB-mes | **~90 finca-año** → cuota de fotos por plan (ADR-15) |
| Analytics Engine | eventos de herramientas | 100.000 puntos/día | independiente del número de fincas |

**Lectura:** la finca cero consume menos del 1 % de la celda. El plan gratuito aguanta la validación completa (≤ 100 fincas) si las fotos se limitan.

Con Workers Paid (50 millones de filas escritas al mes, unas 1,6 millones al día; 10 GB por base; 1 TB por cuenta) una celda aguanta miles de fincas. Estas cifras se recalibran con el consumo real de la finca cero después de 30 días (HU-E8.2).

### 6.3 Etapas de escala

| Etapa | Disparador | Qué se hace | Costo |
|---|---|---|---|
| A · Validación | Hoy | c0 en tu cuenta actual, plan gratuito, presupuesto agro declarado | 0 |
| B · Crecimiento | La celda supera el 50 % de cualquier cuota diaria 7 días seguidos, **o** entra el primer cliente pago, **o** arranca el M0 de la Tienda 3.0, lo que pase primero | La cuenta del ecosistema pasa a Workers Paid (ADR-23). Es la misma cuenta de c0: sin otra cuenta y sin mudar fincas | USD 5/mes por la cuenta, compartidos con la Tienda; los cubre un plan Finca (COP 39.000–59.000) |
| C · Cadena | Una exportadora o cooperativa con cientos de proveedores | Celda dedicada **en la cuenta de Cloudflare del cliente**, con acceso de miembro para ED1; el cliente paga su plan | Del cliente |

### 6.4 Mudar una finca de celda (operación de rutina)

La mudanza, el respaldo y la portabilidad de datos (Ley 1581) usan **el mismo formato de exportación** (`agro-export v1`: JSON por tabla, con recuento y hash por tabla). Es una sola fuente (P2).

1. **Congelar:** el CORE marca la organización como `mudando`. Los teléfonos siguen registrando localmente y el push responde «en mudanza, se reintenta» (sin pérdida, P1).
2. **Exportar:** la celda origen escribe el export en su R2.
3. **Importar:** la celda destino lo pide al endpoint de servicio de la origen (token de servicio entre celdas, nunca por Actions, [H6]) y lo inserta en su shard.
4. **Verificar:** los recuentos y hashes por tabla deben coincidir. Si no coinciden, se aborta y la origen sigue siendo la vigente (P21).
5. **Conmutar:** el CORE apunta la organización a la celda nueva. En el siguiente refresh, los teléfonos reciben el token con la celda nueva y hacen un pull completo.
6. **Retirar:** la origen marca la finca `mudada` y la purga a los 30 días. Borrar en origen es el último paso, nunca el primero.

La primera mudanza se prueba de punta a punta con dos celdas de prueba en local antes de usarla con una finca real (P16).

### 6.5 Términos de Cloudflare (verificado el 30 sep 2026)

El Self-Serve Subscription Agreement de Cloudflare:
- **§2.2.1(c)** prohíbe usar los servicios para esquivar límites de uso o cuotas.
- **§2.2.1(e)** prohíbe crear cuentas múltiples de forma automatizada.
- **§2.2.1(a)** prohíbe registrarse en nombre de un tercero.

Por eso ADR-7 y ADR-8. Abrir cuentas gratuitas para ganar cuota pone en riesgo **todas** las cuentas del ecosistema ([H15]). *No soy abogado: la lectura de estos términos se confirma con asesoría antes de la etapa C.*

---

## 7. Construcción, despliegue y operación

### 7.1 Flujo de trabajo

- **GitHub flow:** `main` protegida; ramas `feat/…`, `fix/…`, `docs/…`; pull request con CI en verde para fusionar.
- **Commits en español**, pequeños, con la forma `tipo(alcance): descripción` (feat, fix, docs, refactor, test, ci, build, perf, chore o revert; alcance en minúsculas; 72 caracteres o menos) y **sin la marca de Claude Code** en commits ni en PR (decisión del dueño, 5 oct 2026). La guardia `scripts/verificar-commits.ts` revisa en el CI los commits, el título y la descripción de cada PR (HU-C0.2, `docs/plataforma/BACKLOG_CORE.md` §2.2).
- **Versión semántica por producto** (`X.Y.Z`, HU-C0.3, PLATAFORMA §6.3). El agro (CultivoPro): `package.json` de la raíz, `CHANGELOG.md` y etiquetas `vX.Y.Z`; es la fuente de la versión del sitio, el cuaderno y la API de la celda (P2). El CORE: `apps/core/package.json`, `apps/core/CHANGELOG.md` y etiquetas `core-vX.Y.Z`, desde la línea base `core-v0.1.0` (el CORE de la v0.3.0). Un PR que cambia el código del CORE lo anota en su CHANGELOG: la guardia del CI lo exige. El parqueadero (HU-Q0.3): `apps/parqueadero-sitio/package.json`, `apps/parqueadero-sitio/CHANGELOG.md` y etiquetas `parqueadero-vX.Y.Z`; en `0.0.0` no se publica y vive solo en staging, y su guardia cubre `apps/parqueadero-*` y `packages/parqueadero-*`.
- **Etiquetas** `vX.Y.Z`, `core-vX.Y.Z` y `parqueadero-vX.Y.Z` al publicar. Las crea el flujo de despliegue al fusionar un PR que sube la versión de ese producto (§7.3, publicación continua), no una persona.

| Cambio | Versión |
|---|---|
| Rompe el protocolo de sincronización o el formato de exportación | Mayor |
| Nueva función | Menor |
| Arreglo | Parche |

### 7.2 CI (cada pull request)

```text
instalar (pnpm, desde cero cuando cambia package.json; bitácora ecommerce «nota en devDependencies»)
 → lint y formato (Biome) → typecheck (tsc estricto)
 → pruebas unitarias (Vitest) → pruebas de Worker con D1 local (@cloudflare/vitest-pool-workers)
 → e2e (Playwright: offline, TZ distinta, dos fincas de prueba, teléfono 360 px)
 → build → quality gate SEO y product.yaml → licencias → Lighthouse CI con presupuestos
 → resumen de la corrida con TODAS las fallas nombradas (P15)
```

- **Dos instrumentos para la base de las pruebas (HU-C11.7):** en los PR, una base en proceso sobre `node:sqlite` (`packages/d1/src/sqlite.ts`); en `main`, el D1 local de workerd (`D1_INSTRUMENTO=workerd`), así una diferencia entre los dos aparece al fusionar. Las pruebas que prueban D1 mismo (la receta de reconstrucción, la matriz de producto) usan siempre workerd.
- Toda tubería en los flujos lleva `set -o pipefail`. Una prueba de los flujos lo exige (P14).
- Las herramientas de `scripts/` también corren en `windows-latest`. Por costo de minutos, solo cuando cambian `scripts/` o una vez por semana (P3).
- Minutos: repo privado, 2.000 min/mes (ED1 §41). Objetivo: menos de 8 min por corrida y cancelar la corrida vieja de la misma rama.

### 7.3 Entornos y anillos

| Anillo | Qué es | Qué recibe primero |
|---|---|---|
| 0 · Local | `wrangler dev` con D1 local y las dos fincas de prueba | Todo |
| 1 · Staging | Workers `agro-sitio-staging`, `agro-core-staging` y `agro-api-c0-staging` (en `workers.dev`, de `celdas.json`) con sus propias D1 y fincas de prueba, en c0 | Cada fusión a `main` |
| 2 · Finca cero y pilotos | Organizaciones con `anillo: 1` en el CORE (las 5 primeras, §5.4) | Funciones nuevas vía flags en KV |
| 3 · Todas | Resto de organizaciones | La función cuando el anillo 2 pasa una semana sin fallas críticas |

- **El código del servidor se despliega por celda**, en el orden de `anillo_despliegue` de `celdas.json`, celda por celda con `scripts/desplegar.ts` (no con matriz: así se detiene en la primera falla y nombra las que quedaron sin tocar). Staging sale cuando el CI termina en verde en `main`; producción, al publicar una versión.
- **Publicación continua (4 oct 2026, v0.3.0).** El único paso a mano es aprobar y fusionar el PR. `.github/workflows/desplegar.yml`, en la misma corrida:
  1. Despliega staging (todo).
  2. `scripts/decidir-publicacion.ts` mira si la versión del agro, la del CORE y la del parqueadero ya tienen su etiqueta. Por cada una que no, crea la etiqueta (`vX.Y.Z`, `core-vX.Y.Z` o `parqueadero-vX.Y.Z`) y la versión en GitHub con las notas de su CHANGELOG (`scripts/notas-de-version.ts`, con `--core` o `--parqueadero`). El parqueadero en `0.0.0` no se publica.
  3. Despliega a producción, con ese mismo commit, **solo lo que se publicó** (`desplegar.ts --productos`): el CORE sin el agro, el agro sin el CORE, o los dos con el CORE primero. Así, publicar el agro no lleva a producción cambios del CORE que nadie publicó (HU-C0.3). El parqueadero publicado va a su dominio; mientras la zona no exista (HU-Q5.2), su producción falla y lo dice, sin caer a `workers.dev`.

  Un PR que no sube la versión solo llega a staging. Para publicar, el PR sube la versión (§7.1) y agrega su sección fechada `## [X.Y.Z] - AAAA-MM-DD`. `tests/repo/version.test.ts` no deja fusionar una versión sin su sección. La versión se crea dentro del mismo flujo porque una versión creada con el token de Actions no dispara otros flujos. Cada destino corre en su **ambiente de GitHub** (`staging`, `produccion`), con sus propios secretos, desde el flujo reutilizable `desplegar-destino.yml` (procedimiento: `docs/runbooks/ambientes-github.md`). A mano siguen «Run workflow» (destino y, para retomar, una sola celda) y publicar una versión desde GitHub. Hoy viven en c0 el sitio, el CORE (HU-E4.1) y la API de la celda (HU-E5.1). En cada celda el orden es: sitio, CORE y API, porque la API necesita la clave pública del CORE. Procedimiento: `docs/runbooks/despliegue.md`.
- **Las funciones se liberan por organización** con flags. En la tienda los anillos eran por repositorio; aquí son por organización y por celda.
- **Una celda o una organización pueden marcarse `fuera`** para no recibir repartos. Cuando un despliegue se detiene, el resumen nombra las que quedaron sin tocar y cómo seguir (bitácora ecommerce 105).

### 7.4 Migraciones de esquema

- **Expandir → migrar datos → contraer**, en versiones separadas. Nunca se renombra ni borra una columna en la misma versión que deja de usarla, porque los teléfonos con la app vieja siguen sincronizando (P10).
- **Antes de migrar una celda:** export de cada shard a R2. Time Travel de 7 días como segunda red (ED1 §20.3).
- **IndexedDB tiene migraciones propias** (versiones de Dexie). Una prueba abre una base creada con la versión anterior de la app y exige que no se pierda un registro (P4 al revés: probar la que ya existe, no la recién creada; bitácora ecommerce 111).

### 7.5 Secretos

- **Secretos de cada celda:** `CF_API_TOKEN` con alcance mínimo a esa cuenta y `CF_ACCOUNT_ID`. `celdas.json` nombra los secretos de cada celda; una prueba exige que estén en esta lista y que el flujo de despliegue los pase (HU-E1.5). Desde el 3 oct 2026 viven en los **ambientes de GitHub** `staging` y `produccion`, no a nivel de repositorio: cada destino ve solo los suyos, y `produccion` acepta la rama `main` y los tags `v*`. Una celda en otra cuenta (etapa C) tendrá los suyos. El flujo se los entrega a wrangler como `CLOUDFLARE_API_TOKEN` y `CLOUDFLARE_ACCOUNT_ID`.
- **Permisos del token de c0:** Account → Workers Scripts (Edit), Workers KV Storage (Edit), Account Analytics (Read), Account Settings (Read); User → Memberships (Read); Zone `laboratorio-digital.com` y, desde el 3 oct 2026, zone `cultivopro.co` → Workers Routes (Edit); Account → D1 (Edit), agregado el 1 oct 2026 para el CORE (HU-E4.1) editando el mismo token, sin rotarlo. El despliegue verifica D1 en la celda del CORE.
- **Secretos de Worker:**
  - Clave privada Ed25519 del CORE.
  - Clave de firma de QR por celda.
  - Tokens de servicio entre celdas.
  - Token del bot de Telegram.
- **Rotación de claves:** la tabla `celda` guarda la clave vigente y la anterior. El CORE publica la suya en `/api/core/claves` y en `/.well-known/jwks.json` (HU-C4.2); durante una rotación, la anterior llega como variable `CORE_CLAVE_ANTERIOR` (su JWK **pública**, no es un secreto) y se publica junto a la vigente hasta que venzan los tokens que firmó (12 h).
- **Cómo llegan los secretos al CORE (HU-E4.2):** `GOOGLE_CLIENT_ID` y `GOOGLE_CLIENT_SECRET` viven en GitHub y el despliegue los carga en el Worker con `wrangler secret bulk` por stdin, sin escribirlos en disco. `CORE_JWT_PRIVATE_KEY` no existe fuera del Worker: el despliegue la genera la primera vez que el Worker no la tiene y nunca la reemplaza (cambiarla cierra todas las sesiones). Staging y producción tienen claves distintas.
- **Llaves de Bold (HU-E0.7):** `BOLD_IDENTIDAD_PRUEBAS` y `BOLD_SECRETA_PRUEBAS` van a staging; `BOLD_IDENTIDAD_PRODUCCION` y `BOLD_SECRETA_PRODUCCION`, a producción. El despliegue las carga en el Worker del CORE como `BOLD_IDENTIDAD`, `BOLD_SECRETA` y `BOLD_AMBIENTE`, por stdin. Son opcionales: sin las dos llaves, pagar en línea responde «no disponible» y nada más cambia. Con una sola, el despliegue falla nombrando la que falta. La llave secreta nunca sale del CORE: la página recibe el cobro ya firmado.
- **Clave del QR de cada celda (HU-E6.4):** `CELDA_QR_PRIVATE_KEY` no existe fuera del Worker de la celda. El despliegue la genera la primera vez que el Worker no la tiene y nunca la reemplaza. Su parte pública la publica la celda en `/api/claves-qr` y va dentro de la página `/agro/t/`.
- **Telegram del dueño (HU-E8.3, ADR-16):** `TELEGRAM_BOT_TOKEN` (el bot) y `TELEGRAM_CHAT_ID` (el chat del dueño con el bot) viven en GitHub, y el despliegue los carga en el Worker de cada celda por stdin. El vigía avisa con ellos.
  - **Excepción a P13, dicha:** la API de Telegram exige el token del bot en la ruta de la URL; no hay otra forma. La llamada va solo de la celda a Telegram por HTTPS, y la URL nunca se escribe en el log (solo el estado HTTP; una prueba lo exige).
  - El chat se averigua con el flujo manual «telegram-chat», no pegando el token en un navegador.
- **Token de métricas de cada celda (HU-E8.2):** `CF_METRICAS_TOKEN` es un token de **solo lectura** (permiso «Account → Account Analytics: Read») de la cuenta de la celda. El despliegue lo carga en el Worker de la celda con `wrangler secret bulk` por stdin, y el vigía lo usa cada hora para leer las métricas. No sirve para desplegar ni para escribir: por eso es aparte del de despliegue. `celdas.json` lo nombra en `secretos.metricas`.
- Una prueba exige que todo secreto que nombra un flujo esté listado en este documento (bitácora ecommerce 82). Lista actual: `CF_API_TOKEN`, `CF_ACCOUNT_ID`, `CF_METRICAS_TOKEN`, `CORE_JWT_PRIVATE_KEY`, `CELDA_QR_PRIVATE_KEY`, `CELDA_SERVICE_TOKEN`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_SEARCH_CONSOLE_CLAVE`, `BOLD_IDENTIDAD_PRUEBAS`, `BOLD_SECRETA_PRUEBAS`, `BOLD_IDENTIDAD_PRODUCCION`, `BOLD_SECRETA_PRODUCCION`.

---

## 8. Presupuesto (ZCOE agro), kill switches y degradación

### 8.1 Presupuesto declarado por producto (dentro de c0)

| Producto | Solicitudes Worker/día | Filas escritas D1/día | R2 | Analytics Engine/día |
|---|---|---|---|---|
| Calculadoras agro (todas) | ≤ 3.000 (eventos) | 0 | 0 | ≤ 20.000 |
| Cuaderno (sincronización) | ≤ 20.000 | ≤ 20.000 | ≤ 2 GB | ≤ 5.000 |
| CORE v0 | ≤ 2.000 | ≤ 1.000 | 0 | — |
| **Total agro en c0** | **≤ 25.000 (25 %)** | **≤ 21.000 (21 %)** | ≤ 2 GB | ≤ 25.000 |

El resto de la cuota de c0 queda para los demás productos de ED1. Cuando el agro pase su parte, se aplica la etapa B (§6.3).

### 8.2 Niveles de degradación de la celda

El vigía horario mide contra la cuota total de la cuenta, no solo contra la parte del agro.

| Nivel | Umbral de cualquier cuota diaria | Acción automática | Qué ve el usuario |
|---|---|---|---|
| Normal | < 60 % | — | — |
| Alerta | ≥ 60 % | Aviso al dueño (Telegram) | — |
| Ahorro | ≥ 75 % | Pausa subida de fotos y eventos de herramientas; pull cada 60 min | «Las fotos se subirán más tarde» |
| Esencial | ≥ 90 % | Solo push de registros; pull en pausa | «Sincronización en pausa hasta las 19:00 (hora de Colombia). Tus registros están guardados en este teléfono» |
| Bloqueo D1 | 100 % | D1 rechaza; la app espera sin perder nada | El mismo aviso, con la causa |

- **Kill switch por producto en KV** (`ks:<product.id>`, valor `encendido` o `apagado`, en `agro-c{N}-flags`): se lee con caché en memoria de hasta 60 s. A eso se suma la propagación de KV, que Cloudflare da como hasta 60 s o más: **apagar un producto tarda hasta 2 minutos**, y está escrito así para que nadie crea que es instantáneo (P7). El despliegue crea las claves que faltan y nunca toca las que existen. Runbook: `docs/runbooks/kill-switch.md`.
- **Qué ve el usuario (HU-E8.6):** los textos de la tabla los da un solo catálogo en el cuaderno (`mensajes-de-pausa.ts`); la celda solo dice la causa en el 503 (`apagado`, `esencial`, `bloqueo`) y su hora de reanudación. El push responde `bloqueo` antes de intentar escribir; el pull se pausa en `esencial` y `bloqueo`, y en `ahorro` responde con `nivel` para que el teléfono revise cada 60 min. Las pausas largas salen en un aviso bajo la cabecera en todas las pantallas.
- **Nivel de la celda en KV:** clave `nivel` del KV de flags (`normal`, `alerta`, `ahorro`, `esencial`, `bloqueo`), leída con la misma caché de 60 s que los kill switches. Sin clave es `normal`. La escribe el vigía (HU-E8.2); el pull ya la respeta (HU-E5.3).
- KV gratuito permite 1.000 escrituras al día. El vigía escribe como máximo 24 al día y solo cuando cambia de nivel.
- **Vigía (HU-E8.2, `apps/api-celda/src/vigia.ts`):**
  - Corre con el Cron Trigger horario de la celda.
  - Lee las métricas de toda la cuenta en la API GraphQL de Cloudflare: Workers, D1 (filas leídas y escritas), KV (lecturas, y la mayor de escrituras, borrados y listados) y R2 (operaciones de clase A y B del mes).
  - Compara contra las cuotas del plan gratuito.
  - Si no puede leer algo, el nivel queda al menos en «alerta» y no baja (P1).
  - **Filas de D1 por producto (HU-Q7.13):** las 100.000 filas escritas al día son de toda la cuenta. El vigía las pide por base (`databaseId`) y las reparte por producto con el mapa que hornea el despliegue (`PRODUCTO_DE_BASE`: el CORE por `celdas.json › core.d1`, cada shard por su prefijo `<producto>_c<N>_s<k>`, staging aparte). Avisa por Telegram al 50, 75 y 90 % del límite y cuando un producto pasa las filas que declara en `productos.json › presupuesto.d1_filas_escritas_dia`. Solo avisa: no apaga nada en el plan gratuito.
  - Token de solo lectura `CF_METRICAS_TOKEN` (§7.5). Runbook: `docs/runbooks/vigia-de-cuota.md`.

### 8.3 Respaldos

- **Semanal**, por el cron de la celda: `agro-export v1` de cada organización a R2 (ED1 §20.3).
- **Retención:** 4 semanales y 3 mensuales.
- **Restaurar se prueba**, no se supone. Hay una prueba de punta a punta que exporta, restaura en una base vacía y compara hashes (P16).
- **Restaurar nunca trae el pasado encima del presente:** los registros son aditivos, así que restaurar es **unir** lo que falte, no reemplazar (bitácora ecommerce 77).

---

## 9. Seguridad y privacidad

- **Autorización en la celda:** el rol viene del token. Operario: registra y ve lo suyo y lo de su área, sin costos ni ventas. Supervisor: todo lo operativo. Propietario: todo. Asesor: lectura de varias fincas. Auditor: solo lectura, con enlace que caduca.
  - **La matriz es un dato (HU-E4.5):** `packages/agro-schema/src/permisos-sync.ts` sobre `crearPermisos` de `packages/sync`, la misma para la celda y el teléfono (P2). Lo que no está en la matriz está negado. La celda decide; el teléfono solo esconde.

    | Entidad | Leen | Escriben |
    |---|---|---|
    | registro | todos | propietario, supervisor, operario |
    | tipo_labor, categoria_calidad | todos | propietario, supervisor, operario (se crean al registrar) |
    | area, ciclo, cultivo, insumo, persona | todos | propietario, supervisor |
    | finca | todos | propietario |
    | valor_jornal (costos) | propietario, supervisor | propietario, supervisor |
    | registro de tipo `despacho` (ventas, con precios; HU-E6.3) | propietario, supervisor | propietario, supervisor |

  - Los tipos de registro con permisos propios están en `MATRIZ_DE_REGISTROS`; los demás siguen la fila `registro`. Al bajar, la celda los excluye en la consulta (`tipo NOT IN (…)`).

  - Al subir, una operación que el rol no puede escribir va a cuarentena con el motivo; un rol que no escribe nada (asesor, auditor) recibe 403. Al bajar, el filtro por entidad va en la consulta.
  - Si el rol de una persona cambia, su teléfono borra lo que ya no le toca ver (salvo lo pendiente por subir) y baja de nuevo desde el principio.
  - Pendiente: «lo de su área» espera a que se puedan asignar personas a áreas; hoy el operario ve toda la finca, sin costos. El auditor con enlace que caduca llega con la carpeta de cumplimiento (HU-E9.2).
- **Aislamiento de tenant:** `org_id` del token en toda consulta, con prueba estática y control negativo (§5.7). La prueba es `tests/repo/org-id-en-consultas.test.ts` (HU-E4.5): lee cada consulta de la celda; las excepciones van con su motivo.
- **CSP estricta** en la PWA (implementada con HU-E0.5: `_headers` generado desde `celdas.json` por `scripts/armar-despliegue.ts`; `script-src 'self'` y `connect-src` solo hacia el propio origen, el CORE y las API de las celdas; la prueba de humo del despliegue exige que llegue): sin scripts de terceros ni anuncios en ninguna vista del cuaderno (instrucciones §9, ED1 §13). El token se guarda en IndexedDB. El riesgo de XSS se mitiga con esa CSP, dependencias mínimas y tokens cortos.
- **Cabeceras de seguridad por ruta (revisión del 3 oct 2026, `docs/seguridad/revision-2026-10-03.md`):** `scripts/lib/cabeceras.ts` arma el `_headers` del sitio. El cuaderno (`/agro/app/*`) lleva su CSP; la página del QR (`/agro/t/*`), una más estricta, sin conexiones; las páginas públicas (`/herramientas/*`, `/agro/privacidad/*`, `/agro/guia/*`, `/agro/vendedores/*`), la CSP pública. Todas llevan HSTS, `nosniff`, `frame-ancestors` y su política de referer. El script de Bold (`https://checkout.bold.co`) solo entra en `script-src` del cuaderno, que es donde se paga. El JSON-LD escapa `<` para que un texto no cierre su `<script>`.
- **Política de tratamiento de datos (HU-E0.5):** `/agro/privacidad/`, desde `content/agro/privacidad/politica.json`. Entrar con Google exige aceptar la versión vigente; el CORE guarda en `usuario` la versión y la fecha (`politica_version`, `politica_aceptada`). Una e2e compara lo que la política declara con lo que cada página carga de verdad.
- **Datos de operarios (Ley 1581):** mínimos. Nombre y rol; la cédula solo cuando exista nómina y con autorización escrita. Política de tratamiento y canal de reclamos antes del primer usuario externo (HU-E0.5). *Requiere revisión de un abogado.*
- **Portabilidad:** el productor exporta todo en `agro-export v1` o CSV cuando quiera. Es también la respuesta a «¿de quién son mis datos?».
- **Dispositivos perdidos:** el propietario revoca la sesión del dispositivo. Los datos locales de ese teléfono no se pueden borrar a distancia, y se dice así en la app.
- **Los números de fábrica no existen:** teléfonos, nombres y claves arrancan vacíos, y el alta se niega a continuar si siguen vacíos (bitácora ecommerce, «La configuración de fábrica traía el celular de la primera tienda»).
- **Cifrado de sobre de la Tienda 3.0 (`packages/cifrado`, HU-T1.3; TIENDA-3.0 §14.2):** una KEK de 32 bytes por secreto del Worker envuelve una DEK por tienda y propósito (`credenciales`, `datos_personales`, `indices`), con `org|proposito|version` como datos asociados. Cada campo va en AES-256-GCM con IV al azar y `org|tabla|campo|id` como datos asociados, así que copiarlo a otra fila o tienda no se descifra; lleva la versión de su DEK. El índice ciego es HMAC-SHA256 truncado a 128 bits. Solo WebCrypto, igual en el navegador, Node y workerd. Todavía no lo usa ningún Worker: lo usarán las llaves de Bold (HU-T11.2) y los contactos (HU-T6.1). El token de Drive del agro (`apps/core/src/drive.ts`) sigue con su propio sellado hasta un tercer uso (regla de tres).

---

## 10. Calidad y pruebas

- **Pirámide:** funciones puras (agro-calc, esquemas) → Worker con D1 local → e2e con Playwright en viewport de teléfono.
- **Siempre dos fincas de prueba**, `Finca Ensayo Uno` (hortaliza, 3 naves) y `Finca Ensayo Dos` (flores, 5 bloques). Una lista `terminos-prohibidos.json` impide que el nombre real de una finca o de una persona entre al código o a las pruebas (P4).
- **Control negativo obligatorio:** toda aserción nueva se ve en rojo con su defecto puesto antes de fusionarla, y el pull request dice cuál fue (P5).
- **Pruebas de reloj:** las baterías que usan fechas corren con `TZ=America/Bogota` y `TZ=Pacific/Kiritimati`, el último día del mes, el 29 de febrero y a las 18:59 y 19:01 hora Bogotá (reinicio de cuota) (P8).
- **Caos de sincronización:**
  - El mismo lote enviado dos veces.
  - Dos teléfonos editan la misma nave sin señal.
  - Un teléfono con el reloj adelantado un día.
  - Un push cortado a la mitad.
  - Una app vieja contra la API nueva.
  - La celda en nivel «Esencial».
  - Implementado (HU-E5.6) en `tests/caos/`, con dos casos más: token vencido sin señal y cuota de D1 agotada. Cada caso termina con la misma regla: cada registro existe exactamente una vez en la celda y en todos los teléfonos.
- **Fallas de la celda:** cualquier error inesperado del Worker de la celda responde 503 en JSON con `estado: falla-celda` y `Retry-After`; el teléfono distingue «no hubo respuesta» (sin señal) de «la nube respondió con un error» (bitácora agro 23).
- **Un flujo que nunca corrió no está probado (P16).** Despliegue, respaldo, restauración y mudanza tienen prueba de punta a punta antes de llamarse camino normal.
- **El instrumento también miente (P17).** Si se usa `fake-indexeddb` o un doble de D1, se documenta qué propiedad del original no imita.

---

## 11. Estructura del monorepo

```text
plataforma/                 (antes gestionagro, ADR-26)
├── apps/
│   ├── sitio/              Astro: /herramientas/agro/*, /agro/t/ (QR), páginas legales
│   ├── cuaderno/           PWA Preact: /agro/app/
│   ├── api-celda/          Worker Hono de la celda (/api/v1/*), cron despachador
│   └── core/               Worker CORE v0 (identidad, organizaciones, directorio)
├── packages/               todos con el alcance @ed1/* (antes @gestionagro/*)
│   ├── agro-calc/          Cálculos puros (DPV, carencias, drenaje, costos…) + tabla de casos
│   ├── agro-schema/        Esquemas zod de registros y catálogos, versiones y traductores
│   ├── ids/                UUIDv7 y su esquema: neutro, lo usan el CORE y los productos (R2)
│   ├── d1/                 Lo que el CORE y las celdas usan de D1, y el D1 local para pruebas
│   ├── tokens/             Tokens Ed25519 del CORE: firmar y verificar con la misma función
│   ├── kill-switch/        Kill switch por producto en KV
│   ├── sync/               Protocolo de sincronización (cliente y servidor comparten tipos)
│   ├── trazabilidad/       QR de trazabilidad de un lote: datos, fragmento y firma
│   ├── ui/                 Componentes y tokens de diseño
│   └── eventos/            Cliente de eventos en lote (tool.opened, tool.completed…)
├── content/agro/           Textos, FAQ, ejemplos y fuentes de cada herramienta (Markdown)
├── schemas/                product.schema.json, agro-export.schema.json
├── infrastructure/         celdas.json (fuente única), plantillas de wrangler, migraciones SQL por base
├── firmware/               ESPHome YAML / C++ (espejo público, ADR-17)
├── hardware/               Esquemas y lista de materiales (espejo público)
├── scripts/                Herramientas en Node/TS (Windows): generar wrangler, sembrar fincas de prueba
├── tests/                  e2e, caos de sincronización, fixtures de las dos fincas de prueba
└── docs/                   ARQUITECTURA.md, BACKLOG.md y BITACORA.md en la raíz; ecosistema/, plataforma/, agro/,
                            tienda/, runbooks/ y seguridad/ (mapa en docs/README.md)
```

---

## 12. Madurez y hoja de ruta técnica

Correspondencia con el modelo de madurez de ED1 §36 (el detalle por sprint está en `BACKLOG.md`):

| Nivel ED1 | Aquí | Hito del backlog |
|---|---|---|
| 0 · Utilidad estática | Calculadora DPV | H1 |
| 2 · Estado persistente (local) | Cuaderno en IndexedDB, sin cuenta | H2 |
| 1 · Worker/API + 3 · Cuentas | CORE v0 + celda c0 + sincronización | H3 |
| 3 · Cuentas (valor) | Cosecha, ventas, QR; costos y personal | H4, H6 |
| 4 · Automatización | Vigía de cuota, respaldos, alertas | H5 |
| 5 · Monetización | Lista de espera Finca/Exportador con precio visible; carpeta de cumplimiento | H7 |
| 6 · SaaS vertical | Cobro del plan Finca **cuando se cumplan los umbrales** | Fuera de este plan |

---

## 13. Riesgos técnicos

| Riesgo | Probabilidad | Impacto | Mitigación |
|---|---|---|---|
| El navegador borra IndexedDB (poco espacio, «limpiar datos») | Media | Alto | `storage.persist()`, aviso de «solo en este teléfono», sincronizar pronto, exportar |
| iOS y los service workers (menos persistencia en PWA no instalada) | Media | Medio | Pedir instalación; aviso específico en iOS; la finca cero usa Android |
| Conflictos de catálogo entre dos teléfonos sin señal | Media | Bajo | Última escritura gana con historial y aviso; los registros no chocan |
| App vieja semanas sin actualizar | Alta | Medio | Protocolo N-1, nunca descartar, aviso visible |
| Consumo de cuota compartido con el resto de ED1 | Media | Alto | Presupuesto por producto, vigía, etapa B |
| Error de cálculo agronómico | Baja | Alto | Agrónomo aliado, fuentes, casos resueltos en pruebas, remitir a la etiqueta ICA |
| El subdominio rinde menos en SEO que el dominio principal | Media | Bajo | Mismas rutas en ambos (ADR-19): mudar el host es un 301 |
| Tiempo del dueño (20 h/semana) | Alta | Alto | Alcance por hitos, regla «¿cuántas veces pasa este mes?» (bitácora ecommerce 16) |
| Falla del nodo de riego | Media | Alto | §5.11: estado seguro, watchdog, mando manual, dos canales |

---

## 14. Hallazgos para ED1 (propuestos, no aplicados)

Se numeran HA para no chocar con [H1]–[H16].

- **HA1 · Aislar cuotas con otra cuenta roza los términos de Cloudflare.** ED1 §14.1 y §25.1 proponen otra cuenta «para aislar cuotas». Cloudflare §2.2.1(c) prohíbe esquivar cuotas. Propuesta: reformular como aislamiento de **riesgo** (abuso, reputación) en una cuenta **paga** o del cliente, nunca como fuente de cuota gratuita extra.
- **HA2 · Registrarse a nombre de terceros.** Si ED1 crea cuentas de proveedores a nombre de sus clientes, choca con Cloudflare §2.2.1(a). Recomendación para la línea ecommerce: verificar con los términos de Google el modelo de «una cuenta de Google por tienda creada por ED1». *No lo he verificado; es una pregunta, no una conclusión.*
- **HA3 · CORE v0 nace en el agro.** Cuando la Fase 3 de ED1 llegue, el CORE no se diseña desde cero: se extiende el v0 (tablas de §5.4), que ya tendrá usuarios reales.
- **HA4 · La Tienda 3.0 sobre esta plataforma (4 oct 2026).** `docs/tienda/integracion-tienda-ecosistema.md` recomienda construir la Tienda 3.0 sobre el CORE, las celdas y el despliegue de este repositorio (opción B de las decisiones D1 y D2 de su `TRASLADO-3.0.md`): cada tienda es una fila y no un repositorio, con dominios propios por Cloudflare for SaaS y llaves de Bold por comercio cifradas en D1. La 2.0 se mantiene hasta migrar. El CORE y los paquetes salen a un monorepo de plataforma cuando la Tienda sea su segundo consumidor, no antes.
- **HA5 · El CORE con dimensión de producto (5 oct 2026).** ED1 §5 dice que el CORE «no debe conocer detalles específicos de cada producto». Sí debe conocer **qué productos existen y qué declara cada uno**: tipos, roles, planes y precios, política, orígenes y celdas. Propuesta: ED1 §5.4 (escrita desde la v1.3; vigente en la v1.4). Diseño en `docs/plataforma/PLATAFORMA.md` §4.
- **HA6 · Cuentas con propósito y graduación (5 oct 2026).** Con una cuenta paga, el aislamiento de HA1 quedaba así: la gratuita valida, la paga aloja lo que cobra, y lo que trae contenido no confiable va en una cuenta paga propia. *(Hoy: reemplazado en la tarde por ADR-23, una sola cuenta. Queda de HA6 solo lo del contenido no confiable, que se evalúa cuando exista ese producto; ED1 v1.4 §22.2.)*
- **HA7 · Legible por agentes (5 oct 2026).** Un principio nuevo, ED1 §3.12, que extiende static-first y browser-first al lado del agente. Detalle en `PLATAFORMA.md` §5.
- **HA8 · Reconstruir tablas en D1 (5 oct 2026).** Con claves foráneas diferidas, rehacer una tabla padre falla al confirmar. Apagar `defer_foreign_keys` dentro de la transacción pone el contador en cero y deja pasar violaciones reales. La receta con guarda está en `PLATAFORMA.md` §4.4 (ADR-25). Propuesta: nota en ED1 §20.3 y §22.1.
- **HA9 · La Public Suffix List y Cloudflare no se combinan (5 oct 2026).** ED1 §14.1 proponía pedir la PSL para los sitios de usuarios, y la arquitectura de la mañana, para el dominio de tiendas. Cloudflare no admite como zona un dominio inscrito en la PSL, salvo en Enterprise (documentación y comunidad de Cloudflare, por resumen). Las tiendas en `laboratorio-digital.app` se aíslan por origen, sin cookies propias y con suspensión rápida (`PLATAFORMA.md` §3.4). Propuesta: nota en ED1 §14.1 (escrita en la v1.4).

---

## 15. Preguntas abiertas

1. **Fecha estimada de trasplante y de primera cosecha.** Respondida el 30 sep 2026: trasplante a mediados de octubre de 2026 y primera cosecha en enero de 2027. El dueño decidió mantener el orden del backlog (la DPV primero); ver BACKLOG §1.
2. **Dominio:** respondida el 30 sep 2026: `laboratorio-digital.com` ya está en Cloudflare. El agro usó el subdominio `agro.laboratorio-digital.com` hasta el 3 oct 2026, cuando el dueño eligió el dominio definitivo `cultivopro.co` (ADR-19); un dominio propio se valida después si hace falta.
3. **¿El repositorio (hoy `plataforma`, antes `gestionagro`) es privado?** Respondida el 30 sep 2026: privado al inicio. Hacerlo público se decide después según el consumo de minutos de Actions (ED1 §41). Mientras sea privado, `tests/terminos-prohibidos.json` vive en el repositorio; antes de publicarlo, sale del repositorio (HU-E1.7). *(Hoy: el 30 sep 2026 se hizo público sin sacar la lista, porque los Actions privados no arrancaban por facturación. El dueño aceptó la exposición y vuelve a privado al reiniciarse los minutos. Bitácora agro 5.)*
4. **¿Hay agrónomo aliado** para revisar el DPV antes de publicarlo? Respondida el 30 sep 2026: sí, el supervisor de la finca cero, que es agrónomo. Como también es usuario del producto, su revisión no es independiente; se anota así en la revisión. En `product.yaml` se registra por rol (`aprobada:<fecha>:agronomo-aliado`), nunca por nombre, porque los nombres de la finca cero son términos prohibidos (P4).

---

## Fuentes

Consultadas el 30 sep 2026, salvo indicación.

- Cloudflare D1, límites: https://developers.cloudflare.com/d1/platform/limits/
- Cloudflare D1, precios (5 M filas leídas y 100.000 escritas por día en el plan gratuito; reinicio 00:00 UTC): https://developers.cloudflare.com/d1/platform/pricing/
- Cloudflare Workers, precios (Workers Paid USD 5/mes; D1 50 M filas escritas/mes incluidas): https://developers.cloudflare.com/workers/platform/pricing/
- Cloudflare Self-Serve Subscription Agreement, §2.2.1: https://www.cloudflare.com/terms/
- Allen, R. G., Pereira, L. S., Raes, D. y Smith, M. (1998). *Crop evapotranspiration* (FAO Irrigation and Drainage Paper 56), ecuación 11.
- Shamshiri, R. R. et al. (2018). Review of optimum temperature, humidity, and vapour pressure deficit for microclimate evaluation and control in greenhouse cultivation of tomato. *International Agrophysics*: https://www.ars.usda.gov/ARSUserFiles/20200500/Pubs%202018/Shamshiri2018%20-%20review%20optimum%20microclimate%20greenhouse.pdf
- MADR, Resolución 187 de 2006 (reglamento de productos agropecuarios ecológicos), modificada parcialmente por la Resolución 199 de 2016: https://www.invima.gov.co/biblioteca/reglamento-productos-agropecuarios-ecologicos-res187-2006 · https://vlex.com.co/vid/resolucion-numero-000199-2016-647142577. *Verificar vigencia con la certificadora antes de la certificación.*
- Resto de cuotas: ED1 §41 (verificadas por el propietario el 19 y 28 sep 2026).
