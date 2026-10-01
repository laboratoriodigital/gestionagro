# Gestión Agro — Arquitectura

**Estado:** aprobada (Fase 0)
**Versión:** 0.1.0 · 30 sep 2026
**Proyecto:** ED1 Agro (línea agrícola de laboratorio-digital.com), repositorio `laboratoriodigital/gestionagro`
**Documentos que manda este:** `ECOSISTEMA-DIGITAL-ED1-v1.2.md` (ED1 §), `REVISION-HALLAZGOS-ED1.md` ([H1]–[H16]), `Estudio de mercado software para invernaderos y agricultura.md` (Estudio), `BITACORA-ecommerce.md` (bitácora ecommerce). El plan de trabajo vive en `BACKLOG.md` y lo que se rompa, en `BITACORA.md`.

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

Cada decisión tiene número fijo; el código y el backlog la citan como `ADR-N`. Estado: **Propuesta** hasta que el dueño la apruebe, **Aceptada** después. Revisión del 30 sep 2026 (HU-E0.1): ADR-1 a ADR-18 aceptadas sin cambios. ADR-19 aceptada con el plan B por decisión del dueño: subdominio propio, mismas rutas; el spike HU-E1.4 se cancela.

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
| 19 | Host `agro.laboratorio-digital.com` con las rutas de siempre: calculadoras en `/herramientas/agro/<slug>/`, cuaderno en `/agro/app/`, QR en `/agro/t/` | Subdominio propio desde el día 1, sin spike. Las rutas no cambian, así que volver al dominio principal (o a otro dominio) es cambiar el host y redirigir; los QR impresos siguen sirviendo con la redirección | Dominio principal verificado por el spike HU-E1.4 (cancelado); rutas cortas en el subdominio | Aceptada (30 sep 2026) |

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
   - El plan Finca no se cobra hasta que se cumplan los umbrales de la etapa 4 → 7.
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
- **Rutas (ADR-19):** en el host `agro.laboratorio-digital.com`: `/herramientas/agro/calculadora-dpv/`, `/herramientas/agro/periodo-de-carencia/`, … y la tabla de contenidos `/herramientas/agro/`. El Worker del sitio es dueño de todo el subdominio y sirve assets estáticos sin ejecutar el script, salvo `/api/*`. Si después se valida pasar al dominio principal o a un dominio nuevo, se cambia el host y se redirige con 301; las rutas no cambian.
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
| `sesion` | refresh token (hash), dispositivo, creado, expira, revocado |
| `organizacion` | id, nombre, tipo (`finca`, `asesor`, `cadena`), plan, **celda_id**, **shard**, anillo |
| `membresia` | usuario × organización × rol |
| `invitacion` | código de un solo uso (hash), rol, expira, creada_por |
| `celda` | id, url base de la API, clave pública vigente y anterior, estado |

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
  - Access token JWT Ed25519 de 12 h, con `sub`, `org`, `rol`, `celda`, `shard` y `anillo`.
  - Refresh token opaco de 60 días, rotado a lo sumo una vez al día. Cada rotación es una escritura en D1, así que no se hace por hora. El último giro se deduce de `sesion.expira` (giro + 60 días), sin columnas nuevas.
  - El token lleva la organización si la persona tiene una sola o si la pide; sin ninguna, `org` va en null (crea la suya en HU-E4.3).
  - Kill switch `ks:agro-core` (en el KV de flags de la celda del CORE): apagado, nadie entra ni renueva; los access ya emitidos valen hasta que vencen.
  - Offline, el access vencido no impide registrar, solo sincronizar.
- **Invitaciones sin email:** el propietario genera un enlace de un solo uso y lo comparte por WhatsApp (`wa.me/?text=…`). El código viaja en el **fragmento** `#`, no en la ruta ni en la query (P13).
- **Directorio:** se consulta **solo al iniciar sesión**. La celda y el shard viajan en el token, así que ninguna solicitud de sincronización toca el CORE.

### 5.5 Celda

Una celda = en **una** cuenta de Cloudflare:

- Worker `agro-api-c{N}` (Hono), solo `/api/*`.
- D1 `agro_c{N}_s{1..k}`: shards. Cada organización vive entera en uno.
- R2 `agro-c{N}`: fotos, exportaciones y respaldos.
- KV `agro-c{N}-flags`: kill switches, degradación y anillos de funciones.
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

- **Ids UUIDv7 generados en el teléfono.** Reintentar es inofensivo: el mismo id no se inserta dos veces.
- **Lotes de ≤ 25 operaciones** por solicitud. D1 gratuito permite 50 consultas por invocación del Worker (ED1 §41). Implementado (HU-E5.2): 3 lecturas y una escritura por operación en un solo `batch`, que es una transacción; 25 operaciones = 28 consultas. Actualizar un catálogo es una sola sentencia porque un trigger guarda la versión anterior en `entidad_historial` (migración 0002).
- **Orden de envío:** la finca primero, después los catálogos, al final los registros. Un catálogo editado varias veces viaja una vez, con su versión vigente. Protocolo compartido en `packages/sync`.
- **`reintentar`:** si otro teléfono de la misma finca escribió el mismo catálogo en el mismo instante, la operación se queda en la cola y se reenvía; en la vuelta siguiente se guarda como conflicto. Ninguna versión se pierde.
- **Tenant en el push:** una operación que dice ser de otra organización, de otra finca, o con un id que ya usa otra organización, va a cuarentena.
- **El servidor no guarda cursores por dispositivo.** El cursor vive en el teléfono (`seq` monotónico por organización, asignado al insertar). Cero escrituras de contabilidad.
- **Cuarentena, nunca descarte (P1).** Una operación que no valida se guarda con su motivo en `cuarentena` y el teléfono la muestra en rojo con el texto del motivo (tabla local `rechazo`; el dato sigue en su tabla). Un humano decide.
- **Vincular la finca (HU-E4.3):** `POST /api/core/organizaciones` con un id que genera el teléfono (idempotente). La sesión trae `url_api`, la API de la celda de esa organización. El vínculo vive en `meta`; los datos locales no se reescriben.
- **Versiones (ADR-13, P10):**
  - Cada operación lleva `v` (versión del esquema del registro).
  - El servidor acepta todas las versiones que alguna app publicada escribió y las traduce al leer.
  - Si la app es más vieja que `app_minima`, el push **se acepta igual** y la respuesta pide actualizar. Ningún dato de campo se pierde por venir de una app vieja.
  - Implementado (HU-E5.5): `APP_MINIMA` en `packages/sync`; el teléfono manda su versión en cada push y muestra el pedido en el aviso de arriba. Los registros se guardan con la versión con que llegaron; `aVersionVigente` (`packages/agro-schema`) los traduce paso a paso al leerlos.
  - **Contrato de versiones:** cada app publicada deja en `packages/agro-schema/contratos/app-<versión>.json` una muestra de todo lo que escribe. Esos archivos no se editan ni se borran, y una prueba exige que la API vigente los acepte todos (P10).
- **Pull que no pisa lo pendiente:** un cambio remoto sobre una entidad con edición local pendiente se guarda como conflicto y se muestra (§5.7). Implementado (HU-E5.3): el teléfono guarda la versión de la nube en su historial local (`<id>@v<versión>#nube`) y conserva la suya; al subirla, la celda la guarda como conflicto. Elegir cuál queda es HU-E5.4.
- **Pull (HU-E5.3):** `GET /api/v1/sync/pull?registro=<seq>&catalogo=<seq>`, con dos cursores porque `seq` es por tabla. Hasta 200 cambios por página, catálogos primero; 2 lecturas, ninguna escritura. Cada página se aplica en el teléfono junto con su cursor, en una transacción. Lo que baja no entra a la cola de salida. Un teléfono sube primero y baja después.
- **Frecuencia:** al abrir la app, al volver la señal y cada 15 min con la app abierta, con espera exponencial si la celda responde 429 o está degradada.

### 5.7 Modelo de datos

**Catálogos** (mutables, `version`, última escritura gana y con historial en `entidad_historial`):

| Entidad | Campos clave |
|---|---|
| `finca` | nombre, municipio, régimen (`ecologico`/`convencional`), geolocalización (punto; polígono después, EUDR) |
| `area` | finca, padre (para cama/surco), tipo (`nave`, `bloque`, `lote`, `cama`), área m², capacidad (plantas) |
| `ciclo` | área(s), cultivo, variedad, fecha de siembra/trasplante, plantas, estado, fecha de fin |
| `persona` | nombre, rol en la finca, usuario_id opcional, valor de jornal (solo visible a propietario/supervisor) |
| `insumo` | nombre comercial, tipo (bioinsumo, fertilizante, fitosanitario, sustrato…), **registro ICA**, ingrediente activo, unidad, **carencia (días)** y **reentrada (horas)** copiadas de la etiqueta, permitido en ecológico (declarado por el usuario), precio |
| `cliente` | nombre, tipo (consumidor, restaurante, tienda, cadena), contacto |
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
| `cosecha` | área, kg (o tallos/cajas), categoría de calidad, descarte |
| `lote_venta` | cosechas que agrupa, código corto, fecha |
| `despacho` | cliente, lote(s), cantidad, precio, medio de pago |
| `movimiento_insumo` | entrada (compra, precio) o salida (vinculada a una aplicación) |
| `jornal` | persona, fecha, horas o jornal, labores |
| `nota` | texto libre, foto opcional |

- **Corregir = anular.** Un registro nuevo con `anula_id` apunta al anterior. La app muestra el vigente y guarda el historial. Nadie borra.
- **Reloj (P8):**
  - Si `instante_evento` e `instante_recibido` difieren en más de 10 min a favor del teléfono, se marca «reloj del teléfono corrido» y se avisa. No se corrige en silencio.
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

### 5.10 Integraciones

| Integración | Cuándo | Cómo |
|---|---|---|
| WhatsApp (compartir) | Desde la primera herramienta | Enlaces `wa.me` con texto; gratis |
| WhatsApp (alertas) | Planes pagos | WhatsApp Business Platform con presupuesto y kill switch propios; nunca en el plan gratuito |
| Tienda del ecosistema | Hito «Cosecha a la mesa» | Exportar disponibilidad (producto, kg, lote) en CSV con el formato que lee la hoja de la Tienda; sin API cruzada hasta que la Tienda la tenga |
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
| B · Crecimiento | La celda supera el 50 % de cualquier cuota diaria 7 días seguidos, **o** entra el primer cliente pago | La cuenta de c0 pasa a Workers Paid. Si el agro necesita aislarse del resto de ED1, se abre una **cuenta paga** propia del agro y se mudan las fincas (§6.4) | USD 5/mes, cubierto por un plan Finca (COP 39.000–59.000) |
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
- **Commits en español**, pequeños.
- **Versión semántica única del producto** (`X.Y.Z`) en `package.json` de la raíz. Es la fuente de la versión de la app, la API y el `CHANGELOG.md` (P2).
- **Etiquetas** `vX.Y.Z` al publicar.

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

- Toda tubería en los flujos lleva `set -o pipefail`. Una prueba de los flujos lo exige (P14).
- Las herramientas de `scripts/` también corren en `windows-latest`. Por costo de minutos, solo cuando cambian `scripts/` o una vez por semana (P3).
- Minutos: repo privado, 2.000 min/mes (ED1 §41). Objetivo: menos de 8 min por corrida y cancelar la corrida vieja de la misma rama.

### 7.3 Entornos y anillos

| Anillo | Qué es | Qué recibe primero |
|---|---|---|
| 0 · Local | `wrangler dev` con D1 local y las dos fincas de prueba | Todo |
| 1 · Staging | Worker `agro-api-staging` + D1 `agro_staging` en c0, con fincas de prueba sembradas | Cada fusión a `main` |
| 2 · Finca cero y pilotos | Organizaciones con `anillo: 1` en el CORE (las 5 primeras, §5.4) | Funciones nuevas vía flags en KV |
| 3 · Todas | Resto de organizaciones | La función cuando el anillo 2 pasa una semana sin fallas críticas |

- **El código del servidor se despliega por celda**, en el orden de `anillo_despliegue` de `celdas.json`, celda por celda con `scripts/desplegar.ts` (no con matriz: así se detiene en la primera falla y nombra las que quedaron sin tocar). Staging sale cuando el CI termina en verde en `main`; producción, al publicar una versión. Hoy viven en c0 el sitio, el CORE (HU-E4.1) y la API de la celda (HU-E5.1). En cada celda el orden es: sitio, CORE y API, porque la API necesita la clave pública del CORE. Procedimiento: `docs/runbooks/despliegue.md`.
- **Las funciones se liberan por organización** con flags. En la tienda los anillos eran por repositorio; aquí son por organización y por celda.
- **Una celda o una organización pueden marcarse `fuera`** para no recibir repartos. Cuando un despliegue se detiene, el resumen nombra las que quedaron sin tocar y cómo seguir (bitácora ecommerce 105).

### 7.4 Migraciones de esquema

- **Expandir → migrar datos → contraer**, en versiones separadas. Nunca se renombra ni borra una columna en la misma versión que deja de usarla, porque los teléfonos con la app vieja siguen sincronizando (P10).
- **Antes de migrar una celda:** export de cada shard a R2. Time Travel de 7 días como segunda red (ED1 §20.3).
- **IndexedDB tiene migraciones propias** (versiones de Dexie). Una prueba abre una base creada con la versión anterior de la app y exige que no se pierda un registro (P4 al revés: probar la que ya existe, no la recién creada; bitácora ecommerce 111).

### 7.5 Secretos

- **Secretos de cada celda:** `CF_API_TOKEN` con alcance mínimo a esa cuenta y `CF_ACCOUNT_ID`. `celdas.json` nombra los secretos de cada celda; una prueba exige que estén en esta lista y que el flujo de despliegue los pase (HU-E1.5). Hoy viven a nivel de repositorio; una celda en otra cuenta (etapa C) tendrá los suyos. El flujo se los entrega a wrangler como `CLOUDFLARE_API_TOKEN` y `CLOUDFLARE_ACCOUNT_ID`.
- **Permisos del token de c0:** Account → Workers Scripts (Edit), Workers KV Storage (Edit), Account Analytics (Read), Account Settings (Read); User → Memberships (Read); Zone `laboratorio-digital.com` → Workers Routes (Edit); Account → D1 (Edit), agregado el 1 oct 2026 para el CORE (HU-E4.1) editando el mismo token, sin rotarlo. El despliegue verifica D1 en la celda del CORE.
- **Secretos de Worker:**
  - Clave privada Ed25519 del CORE.
  - Clave de firma de QR por celda.
  - Tokens de servicio entre celdas.
  - Token del bot de Telegram.
- **Rotación de claves:** la tabla `celda` guarda la clave vigente y la anterior.
- **Cómo llegan los secretos al CORE (HU-E4.2):** `GOOGLE_CLIENT_ID` y `GOOGLE_CLIENT_SECRET` viven en GitHub y el despliegue los carga en el Worker con `wrangler secret bulk` por stdin, sin escribirlos en disco. `CORE_JWT_PRIVATE_KEY` no existe fuera del Worker: el despliegue la genera la primera vez que el Worker no la tiene y nunca la reemplaza (cambiarla cierra todas las sesiones). Staging y producción tienen claves distintas.
- Una prueba exige que todo secreto que nombra un flujo esté listado en este documento (bitácora ecommerce 82). Lista actual: `CF_API_TOKEN`, `CF_ACCOUNT_ID`, `CORE_JWT_PRIVATE_KEY`, `CELDA_QR_PRIVATE_KEY`, `CELDA_SERVICE_TOKEN`, `TELEGRAM_BOT_TOKEN`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`.

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
- **Nivel de la celda en KV:** clave `nivel` del KV de flags (`normal`, `alerta`, `ahorro`, `esencial`, `bloqueo`), leída con la misma caché de 60 s que los kill switches. Sin clave es `normal`. La escribe el vigía (HU-E8.2); el pull ya la respeta (HU-E5.3).
- KV gratuito permite 1.000 escrituras al día. El vigía escribe como máximo 24 al día y solo cuando cambia de nivel.

### 8.3 Respaldos

- **Semanal**, por el cron de la celda: `agro-export v1` de cada organización a R2 (ED1 §20.3).
- **Retención:** 4 semanales y 3 mensuales.
- **Restaurar se prueba**, no se supone. Hay una prueba de punta a punta que exporta, restaura en una base vacía y compara hashes (P16).
- **Restaurar nunca trae el pasado encima del presente:** los registros son aditivos, así que restaurar es **unir** lo que falte, no reemplazar (bitácora ecommerce 77).

---

## 9. Seguridad y privacidad

- **Autorización en la celda:** el rol viene del token. Operario: registra y ve lo suyo y lo de su área, sin costos ni ventas. Supervisor: todo lo operativo. Propietario: todo. Asesor: lectura de varias fincas. Auditor: solo lectura, con enlace que caduca.
- **Aislamiento de tenant:** `org_id` del token en toda consulta, con prueba estática y control negativo (§5.7).
- **CSP estricta** en la PWA (*pendiente: aún no hay cabecera CSP; con el login, los tokens ya viven en IndexedDB, así que entra antes del primer usuario externo, con HU-E0.5*): sin scripts de terceros ni anuncios en ninguna vista del cuaderno (instrucciones §9, ED1 §13). El token se guarda en IndexedDB. El riesgo de XSS se mitiga con esa CSP, dependencias mínimas y tokens cortos.
- **Datos de operarios (Ley 1581):** mínimos. Nombre y rol; la cédula solo cuando exista nómina y con autorización escrita. Política de tratamiento y canal de reclamos antes del primer usuario externo (HU-E0.5). *Requiere revisión de un abogado.*
- **Portabilidad:** el productor exporta todo en `agro-export v1` o CSV cuando quiera. Es también la respuesta a «¿de quién son mis datos?».
- **Dispositivos perdidos:** el propietario revoca la sesión del dispositivo. Los datos locales de ese teléfono no se pueden borrar a distancia, y se dice así en la app.
- **Los números de fábrica no existen:** teléfonos, nombres y claves arrancan vacíos, y el alta se niega a continuar si siguen vacíos (bitácora ecommerce, «La configuración de fábrica traía el celular de la primera tienda»).

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
- **Un flujo que nunca corrió no está probado (P16).** Despliegue, respaldo, restauración y mudanza tienen prueba de punta a punta antes de llamarse camino normal.
- **El instrumento también miente (P17).** Si se usa `fake-indexeddb` o un doble de D1, se documenta qué propiedad del original no imita.

---

## 11. Estructura del monorepo

```text
gestionagro/
├── apps/
│   ├── sitio/              Astro: /herramientas/agro/*, /agro/t/ (QR), páginas legales
│   ├── cuaderno/           PWA Preact: /agro/app/
│   ├── api-celda/          Worker Hono de la celda (/api/v1/*), cron despachador
│   └── core/               Worker CORE v0 (identidad, organizaciones, directorio)
├── packages/
│   ├── agro-calc/          Cálculos puros (DPV, carencias, drenaje, costos…) + tabla de casos
│   ├── agro-schema/        Esquemas zod de registros y catálogos, versiones y traductores
│   ├── sync/               Protocolo de sincronización (cliente y servidor comparten tipos)
│   ├── ui/                 Componentes y tokens de diseño
│   └── eventos/            Cliente de eventos en lote (tool.opened, tool.completed…)
├── content/agro/           Textos, FAQ, ejemplos y fuentes de cada herramienta (Markdown)
├── schemas/                product.schema.json, agro-export.schema.json
├── infrastructure/         celdas.json (fuente única), plantillas de wrangler, migraciones SQL por base
├── firmware/               ESPHome YAML / C++ (espejo público, ADR-17)
├── hardware/               Esquemas y lista de materiales (espejo público)
├── scripts/                Herramientas en Node/TS (Windows): generar wrangler, sembrar fincas de prueba
├── tests/                  e2e, caos de sincronización, fixtures de las dos fincas de prueba
└── docs/                   ARQUITECTURA.md, BACKLOG.md, BITACORA.md, ADR, runbooks
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

---

## 15. Preguntas abiertas

1. **Fecha estimada de trasplante y de primera cosecha.** Respondida el 30 sep 2026: trasplante a mediados de octubre de 2026 y primera cosecha en enero de 2027. El dueño decidió mantener el orden del backlog (la DPV primero); ver BACKLOG §1.
2. **Dominio:** respondida el 30 sep 2026: `laboratorio-digital.com` ya está en Cloudflare. El agro usa por ahora el subdominio `agro.laboratorio-digital.com` (ADR-19); un dominio propio se valida después si hace falta.
3. **¿El repositorio `gestionagro` es privado?** Respondida el 30 sep 2026: privado al inicio. Hacerlo público se decide después según el consumo de minutos de Actions (ED1 §41). Mientras sea privado, `tests/terminos-prohibidos.json` vive en el repositorio; antes de publicarlo, sale del repositorio (HU-E1.7). *(Hoy: el 30 sep 2026 se hizo público sin sacar la lista, porque los Actions privados no arrancaban por facturación. El dueño aceptó la exposición y vuelve a privado al reiniciarse los minutos. Bitácora agro 5.)*
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
