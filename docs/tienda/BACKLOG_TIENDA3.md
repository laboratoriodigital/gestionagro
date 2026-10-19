# Tienda 3.0 — Plan de trabajo y backlog

**Versión:** 0.1.0 · 6 oct 2026
**Dueño del producto:** Sebas. **Gerencia del proyecto y Scrum:** el asistente, que hace los commits, el push y los PR; el dueño aprueba, fusiona y valida en staging.
**Fuente única de:** hitos, sprints, épicas, historias, work items, estado y velocidad **de la Tienda 3.0**. Lo del CORE está en `../plataforma/BACKLOG_CORE.md`, lo del agro en `../BACKLOG.md` y lo del parqueadero en `../parking/BACKLOG-PARKING.md`, que le ofrece `@ed1/whatsapp` y `@ed1/impresion` (su §12).
**Lo que manda sobre este documento:** `../ecosistema/ECOSISTEMA-DIGITAL-ED1-v1.4.md` (ED1 §N) → `../ARQUITECTURA.md` (ADR-N, P1–P21) → `TIENDA-3.0.md` (el diseño, «TIENDA §N») y `../plataforma/PLATAFORMA.md` (lo común). El mercado: `ESTUDIO-MERCADO-ECOMMERCE-ED1-2026-10-v1.3.md` («estudio §N»). Aquí se planea; allí se decide. Ante una contradicción, se señala antes de actuar.
**Lecciones:** `BITACORA_TIENDA3.md` (bitácora tienda3 N), `BITACORA-ecommerce.md` (bitácora ecommerce N, la de la Tienda 2.0), `../plataforma/BITACORA_CORE.md` (bitácora core N) y `../BITACORA.md` (bitácora agro N). Los patrones P1–P21 son del ecosistema y conservan su número.

---

## 0. En una página

**Qué es el proyecto.** Construir la Tienda 3.0 que diseña `TIENDA-3.0.md`: tiendas en línea para comercios pequeños de Colombia que venden por WhatsApp, con un solo despliegue para todas, sobre el CORE y la cuenta del ecosistema. Entra como **excepción declarada** (ADR-21, ED1 §2.1 [D3]) y se construye por los hitos de TIENDA §19, con un frontend **bonito, minimalista y moderno** desde el primer sprint (§5).

**Las tres reglas del proyecto:**

1. **Las tiendas 2.0 se quedan en la 2.0.** Ninguna se migra a la 3.0 (decisión del dueño del 13 oct 2026). Son la referencia de lo que ya funciona: lo que la 3.0 toma de ellas se puede cambiar, mejorar o quitar (TIENDA anexo C, bitácora tienda3 9).
2. **Ninguna visita toca la base y ninguna versión se publica a todas las tiendas a la vez** (TIENDA §1.3).
3. **Lo que mueve plata se verifica, no se cree** (TIENDA §0, decisiones 5 a 7).

| Hito | Qué queda funcionando | Cierra | Fecha objetivo (plan base) | Necesita del CORE o del dueño | Versión |
|---|---|---|---|---|---|
| **M0 · Fundación** | Paquetes puros (`dinero`, `calendario`, `cifrado`, `tienda-schema`), migraciones en D1, la Tienda en el registro de productos, celda, KEK, tres apps en staging, dos comercios de prueba, presupuesto y kill switches | T2 (la aceptación con un token real, en T3: HU-T2.10) | 23 dic 2026 (staging) | HC1 y HU-C4.3; los secretos de la Tienda (dueño). En el plan gratuito: la zona `.app` ya está activa y Workers Paid espera un dato que lo exija (bitácora tienda3 7) | — |
| **M1 · La tienda pública** | Horno, compuerta, publicación en cola, despacho por `Host`, vitrina con su diseño, carrito, cotizar, pedido por WhatsApp con su forma de pago, acuse, seguimiento, solicitudes con radicado, textos legales, carga del operador. La vitrina en producción, sin tiendas | T7 | 19 mar 2027 | — | `tienda-v0.1.0` (T6) y `v0.2.0` |
| **M2 · El panel** | Entrar, productos con variantes y fotos, inventario, pedidos, confirmar por WhatsApp, despacho, contraentrega con su recaudo y liquidación, envíos, cupones, ajustes, publicar y volver atrás, equipo, registro, exportar y el tablero | T11 | 14 may 2027 | HU-C4.3 y HU-C4.4 (C5), HU-C3.2 | `v0.3.0` |
| **M3 · Cobrar** | Llaves de Bold cifradas, cobro de prueba guiado, apartados, botón y links de pago, avisos firmados, conciliación, caos, revisión de seguridad y restauración probada | T14 | 25 jun 2027 | — | `v0.4.0` |
| ~~M6 · Las tiendas actuales~~ | **Retirado** el 13 oct 2026: ninguna tienda 2.0 se migra. Sus historias de carga, paridad y corte salieron del plan (§8, ET12) | — | — | — | — |
| **M4 · Dominios, alta y plan** | Dominios propios con prevalidación, canónico y alias, alta por el comercio, plan por 1, 3, 6 o 12 meses, antiabuso y baja | T16 | 23 jul 2027 | HC4, HU-C11.5; HC7 para el alta sin Google | `v0.5.0` |
| **M5 · Medición** | Medición propia, resumen diario por correo, GA4 y Meta con consentimiento, feeds y reconciliación | T17 | 6 ago 2027 | HU-C10.1 (correo) | **`v1.0.0`** |
| **M7 · Agentes** | OpenAPI, habilidad de compra, MCP público, confirmar el pedido de un agente, `verificar-agentes` y el MCP del comercio | T18 | 20 ago 2027 | HU-C8.5, HC6 | `v1.1.0` |
| **M8 · Factura integrada** | `DocumentoFiscal` con el facturador del comercio (nivel intermedio) | T19 | 3 sep 2027 | — | `v1.2.0` |

**En cifras:** 18 épicas, 111 historias refinadas vigentes (más las preparadas de §9 y 5 retiradas), **345 puntos** en 21 sprints (T0 a T20, el último de holgura). **Hasta el alta abierta (M0 a M4): 303 puntos.**

**Las fechas son un techo, no una meta.** Salen de la velocidad planeada (20 puntos por sprint, como el CORE) y del calendario que comparten los dos carriles. El CORE construyó sus sprints C1, C2 y C3 en tres días: si la velocidad **validada** de T1 a T3 pasa de 20, el plan se acorta (§6.2). Lo que manda es el orden de las dependencias, no las fechas.

**Fuera de alcance, a propósito** (TIENDA §0 y §20.3, cada uno con su disparador en §9): cuentas de comprador, marketplace o directorio común, otra pasarela distinta de Bold, emitir facturación electrónica, WhatsApp Cloud API, guías integradas, varias bodegas, punto de venta, B2B, conversiones del lado del servidor, multimoneda y multidioma.

---

## 1. Lo que encontró el contraste con las fuentes, antes de escribir código

Cada historia se contrastó con TIENDA, ED1, ARQUITECTURA y el estudio (memoria del proyecto: «premisas antes de decidir»). Esto es lo que el contraste cambió o descubrió:

| # | Hallazgo | Qué cambia en el plan | Registro |
|---|---|---|---|
| 1 | TIENDA §19 deja el **tablero** en M5, después de cargar las tiendas (M6), y su propio anexo C exige que cada puerta que una tienda usa pase antes de cargarla. La 2.0 tiene tablero | HU-T14.2 pasa a M2 (T11) | Bitácora tienda3 1 |
| 2 | TIENDA §11.5 promete fotos WebP comprimidas en el navegador. **Safari no codifica WebP** en `canvas.toBlob`: devuelve PNG (bitácora agro, terreno) | HU-T8.3 cae a JPEG donde no hay WebP, y la ruta dice el formato real | Bitácora tienda3 2 |
| 3 | Pagar en línea y volver en otro navegador deja al comprador sin su enlace de seguimiento: TIENDA §9.3 confía en «el enlace que llegó en el acuse», y en el pago en línea el acuse no siempre llega por WhatsApp ni por correo. Es la trampa de la bitácora ecommerce 61 | HU-T11.9 entrega el enlace **antes** de abrir Bold; patrón provisional PT1 | Bitácora tienda3 3 |
| 4 | TIENDA §15.4 pide una copia **mensual** fuera de Cloudflare con el proveedor por elegir; ADR-30 decidió una **semanal**, cifrada, en el Google Drive del dueño | HU-T17.3 cita ADR-30; TIENDA §15.4 corregido | Bitácora tienda3 4 |
| 5 | D-C1 decidió Geist «solo en la cuenta». La Tienda no puede darla por decidida | Decisión D-T2 (§10) | — |
| 6 | Los días hábiles con festivos los necesitan la Tienda (solicitudes, TIENDA §8.6) y el CORE (HU-C7.7, WI-C7.7.3). TIENDA §8.6 dudaba entre `dinero` y `calendario` | Un solo paquete neutro, `@ed1/calendario`, que construye la Tienda primero (HU-T1.2) y el CORE reusa (P2) | — |
| 7 | TIENDA §11.7 pide `lastmod` por producto en el sitemap; la bitácora ecommerce 31 lo quitó porque rompía el horneado determinista | El `lastmod` sale del dato (`actualizado` del producto), nunca del reloj del horno (HU-T4.1) | — |
| 8 | Si alguna tienda 2.0 usa dominio propio, GA4 o el píxel de Meta, correos o páginas propias, el orden de §19 la dejaría sin eso al cortar | HU-T12.1 lo averigua en T0, y lo que salga se mueve antes de M6 | — |
| 9 | TIENDA §19 estimó 17 semanas hasta vender. El desglose da 279 puntos: unos 16 sprints a 20 puntos | §6.2: de dónde sale la diferencia y las palancas para acortar | — |
| 10 | El CORE va muy por delante de su plan (C3 construido el 6 oct). El arranque de la Tienda depende de HC1 validado y de dos tareas del dueño, no de una fecha | T0 como carril de holgura (D-T1) y T1 «el lunes siguiente a HC1» (§6) | — |

---

## 2. Supuestos del plan

Si alguno es falso, se reordena el plan.

| Supuesto | Valor | Por qué importa |
|---|---|---|
| Equipo | El dueño (producto, validación y aprobación) + el asistente (análisis, código, pruebas, documentos, commits, push y PR) | ED1 §25: las horas del dueño son el límite real |
| Sprints | 2 semanas, de lunes a viernes, **con el mismo calendario del CORE**: T1 = C5, T2 = C6 … T7 = C11 | Las ceremonias se comparten |
| Escala | Fibonacci; **1 punto ≈ 3 h ideales** con asistencia, igual que el CORE y el agro | Se compara entre carriles |
| Velocidad planeada | **20 puntos por sprint**, 16 con festivo, 12 en los cortos | La del CORE (BACKLOG_CORE §1). Se planea por validación, no por construcción |
| **Cuello de botella** | **La validación del dueño en staging** (bitácora core, terreno) | Límite de trabajo en curso (§3.6); una historia cuenta el día que el dueño la valida |
| Reparto de horas | **D-C4:** el CORE primero hasta HC1; después, dos carriles. T0 solo en la holgura del CORE (D-T1) | El camino crítico de la Tienda manda el orden del CORE (HC1 → HC3 → HC4) |
| Arranque | T1 empieza el lunes siguiente a: HC1 validado, Workers Paid activo y la zona `laboratorio-digital.app` en la cuenta | Son las condiciones de M0 (TIENDA §19) |
| Festivos | 2026: 8 y 25 dic. 2027: 1 y 11 ene; 22, 25 y 26 mar; 10 y 31 may; 7 jun; 5 y 20 jul; 16 ago | Sprints cortos: T1, T2, T3, T8, T11, T13, T15, T16, T18 |
| Congelamiento | **Del 18 dic 2026 al 11 ene 2027 no se publica a producción** (BACKLOG_CORE §1) | T2 solo llega a staging |
| La 2.0 | Sus dos tiendas siguen vendiendo con sus techos (TIENDA §17.3): una cuenta de Google por tienda, 30 ejecuciones simultáneas, 20.000 filas de pedidos | Si una se acerca a un techo, se adelanta su corte (riesgo R3) |

---

## 3. Cómo se trabaja

### 3.1 GitHub flow

- **Una copia de trabajo propia:** `D:\CoWork\gestionagro-tienda` (`git worktree`), aparte de la carpeta del dueño y de la del CORE (`D:\CoWork\gestionagro-core`). Antes de cambiar de rama, `git status`: lo que no es de la Tienda no se lleva (bitácora core, terreno).
- `main` protegida. Todo cambio entra por PR **a `main`**, que el dueño aprueba y fusiona.
- **Una rama y un PR por sprint, con un commit por historia** (`feat/t1-sprint`), como el CORE: cada PR gasta dos corridas del CI de los 2.000 minutos del mes. Lo que urge o tiene otro riesgo va en su rama: `<tipo>/t<épica>.<n>-<tema>`, por ejemplo `fix/t11.5-firma-de-bold`.
- Cada rama sale de `origin/main` actualizado. Si toca un archivo que también toca el carril del CORE (`productos.json`, `celdas.json`, `desplegar.yml`, `CHANGELOG.md`, `packages/pagos`), se prueba `git merge-tree --write-tree origin/main <rama>` contra la rama abierta del CORE antes del push, y al fusionarse una se actualiza la otra con `git merge origin/main`.
- Todo comando que decide un commit empieza con `set -o pipefail;` y corre lint y typecheck antes (bitácora core 4).

### 3.2 Commits: `tipo(alcance): descripción`

- **Tipos:** `feat`, `fix`, `docs`, `refactor`, `test`, `ci`, `build`, `perf`, `chore`, `revert`.
- **Alcances de la Tienda** (en minúsculas, como exige la guardia de HU-C0.2): `tienda`, `vitrina`, `panel`, `horno`, `despacho`, `pedidos`, `cobros`, `bold`, `inventario`, `recaudos`, `legal`, `solicitudes`, `dominios`, `planes`, `medicion`, `agentes`, `mcp`, `factura`, `carga`, `migraciones`, `cifrado`, `dinero`, `calendario`, `ui`, `despliegue`, `ci`, `versiones`, `bitacora`.
- **Descripción** en español, en minúscula, sin punto final, de 120 caracteres o menos (eran 72 hasta el 13 oct 2026). Dice qué cambia para quien usa la tienda, no qué archivo se tocó.
- **Cuerpo:** el porqué, la historia (`HU-T6.1`), el control negativo y lo que no cambia.
- **Sin la marca de Claude Code**, ni en commits ni en PR: ni `Co-Authored-By`, ni `Claude-Session`, ni «Generated with Claude Code» (pedido del dueño; lo vigila la guardia del CI).

```text
feat(pedidos): el pedido por whatsapp guarda qué textos aceptó el comprador

HU-T6.1. La huella de los términos y el instante quedan en el pedido; la base
no deja salir de «pendiente» un pedido web sin ellos. Control negativo: sin
el trigger, «pedido sin aceptación» se ve en rojo.
```

### 3.3 Versionado semántico: `tienda-vX.Y.Z`

La Tienda tiene versión propia (HU-T0.2, como HU-C0.3 para el CORE): un solo `package.json` (propuesta: `apps/tienda-api`), su `CHANGELOG.md` y etiquetas `tienda-vX.Y.Z`. Al fusionar un PR que la sube, se publica **solo la Tienda**; si sube también el CORE, primero el CORE.

| Cambio | Versión |
|---|---|
| Rompe, después de 1.0.0, un contrato que alguien usa: `/api/v1`, `tienda-import/1` o `tienda-export/1`, las direcciones públicas de una tienda, el enlace de seguimiento o el aviso de Bold registrado | Mayor |
| Capacidad nueva compatible; una sección de ajustes con `esquema` nuevo y su traductor; una versión nueva del horno (se re-hornea por anillos, HU-T4.6) | Menor |
| Arreglo sin cambio de contrato | Parche |

| Versión | Sprint | Qué trae |
|---|---|---|
| `tienda-v0.1.0` | T6 | La vitrina en producción, sin tiendas: el camino a producción probado (HU-T2.9) |
| `tienda-v0.2.0` | T7 | M1: la tienda pública |
| `tienda-v0.3.0` | T11 | M2: el panel |
| `tienda-v0.4.0` | T14 | M3: cobrar en línea |
| `tienda-v0.5.0` | T16 | M4: dominios propios, alta abierta y plan |
| **`tienda-v1.0.0`** | T17 | M5. El contrato público queda estable: `/api/v1`, los formatos de carga y exportación y los ajustes con esquema |
| `tienda-v1.1.0` | T18 | M7: agentes |
| `tienda-v1.2.0` | T19 | M8: factura integrada |

*15 oct 2026:* al retirar M6 (13 oct) esta tabla quedó corrida un sprint (dos filas de M4 y `v1.0.0` en T18), distinta de la tabla de hitos de §0 y del plan de §6.1. Se alineó con ellas: M4 es `v0.5.0` en T16 y lo demás llega un sprint antes (bitácora tienda3 13).

### 3.4 Pull request

- Título con la forma de un commit. Descripción con la plantilla del repositorio: qué cambia, **control negativo**, qué documento cambió (P18) y la Definición de Terminado.
- Una pieza de TIENDA pasa a `ARQUITECTURA.md`, con su ADR, **en el mismo PR que la implementa**.
- Al cerrar cada parte, el asistente entrega los comandos exactos y las pruebas que el dueño debe hacer, paso a paso: qué abrir, qué tocar y qué debe verse.

### 3.5 Ceremonias, compartidas con el CORE (~45 min más del dueño por sprint)

| Ceremonia | Cuándo | Qué sale para la Tienda |
|---|---|---|
| Planeación (+15 min) | Lunes del sprint, después de la del CORE | Meta del sprint, historias comprometidas y orden de validación |
| Revisión (+20 min) | Viernes de cierre | Demostración en staging con los pasos exactos; lo validado pasa a «Terminada» |
| Retrospectiva (+10 min) | Viernes de cierre | Qué va a `BITACORA_TIENDA3.md` y qué patrón se confirmó |
| Refinamiento (en la del CORE) | Miércoles de la segunda semana | Historias del sprint siguiente que cumplen la Definición de Listo |

### 3.6 Límite de trabajo en curso

- **Como mucho 3 historias de la Tienda esperando validación, y 6 entre los dos carriles.** Con el tope, no se abre una nueva: se prepara la demostración de las pendientes.
- Una historia cuenta en la velocidad **el día que el dueño la valida**, no el día que se fusiona.
- Cuando los dos carriles compiten por la misma revisión, manda el camino crítico de la Tienda: HC1 → M0 → M1 → M2 → M3 → M4 (sin M6 desde el 13 oct 2026).

---

## 4. Definición de Listo y de Terminado

### 4.1 Definición de Listo (DoR)

Una historia entra a un sprint solo si:

1. Tiene criterios de aceptación verificables, con **al menos uno negativo** (❌).
2. Está estimada y cabe en un sprint (≤ 5 puntos).
3. Sus dependencias están terminadas, o van antes en el mismo sprint, **incluidas las del CORE** (§12).
4. Dice **qué pasa con lo que ya está publicado** (P10): páginas horneadas con otra release, carritos guardados en teléfonos, enlaces de seguimiento ya compartidos, el aviso de Bold registrado en la cuenta del comercio, la PWA del panel en caché. Y en qué fase va un contrato: expandir, migrar o contraer.
5. Cita su **respaldo** (TIENDA §N, ED1 §N, ADR-N, estudio §N) o dice que ningún documento la cubre.
6. Si consume cuota o dinero (Worker, D1, R2, KV, cola, correo), trae su estimación y el nombre de su kill switch.
7. Nombra los patrones de las bitácoras que corre riesgo de repetir.
8. Si tiene pantalla, trae su boceto en palabras: qué ve la persona, qué toca, el texto principal y qué dice cada estado (cargando, vacío, error).
9. Si traduce una norma, dice el artículo y el control técnico que la verifica (ED1 §20.1 [D5]).

### 4.2 Definición de Terminado (DoD)

1. Fusionada a `main` por el PR del sprint, con el CI en verde: lint, typecheck, pruebas, build, licencias, commits y guardias de repositorio.
2. Pruebas unitarias de la lógica; pruebas de la API contra D1 (el instrumento rápido en el PR y el D1 local de workerd en `main`, HU-C11.7).
3. **Control negativo** escrito en el PR: qué defecto se puso y cómo se vio en rojo (P5).
4. **Probada con los dos comercios de prueba**, Ensayo Uno y Ensayo Dos (P4). Ningún nombre real en el código.
5. Si toca el despacho: **cero consultas a D1 por visita**. Si toca el horno: **los mismos bytes en Node y en workerd**. Si toca dinero: la tabla de casos de `@ed1/dinero`.
6. Si toca llaves o datos personales: cifrados, ausentes de logs, respuestas y archivos horneados (una prueba los busca), y la lectura queda en el registro.
7. Si tiene pantalla: e2e en 360 y 1280 px, **axe sin violaciones**, dentro de los presupuestos de §5.6, y textos cálidos y sin técnica. El panel en claro y oscuro; la vitrina en los modos que su tema permita.
8. Documentación al día en el mismo PR (P18). Si la pieza sale de TIENDA, su ADR entra a `ARQUITECTURA.md`.
9. Entrada en el CHANGELOG de la Tienda (desde HU-T0.2; antes, el de la raíz) y versión subida si se publica.
10. Desplegada en staging, prueba de humo en verde y **validada por el dueño** con los pasos que dio el asistente.
11. Si algo se rompió o se aprendió en el camino, hay entrada en `BITACORA_TIENDA3.md`.

---

## 5. Dirección de diseño: la vitrina y el panel

El dueño pidió desde el inicio un frontend **bonito, minimalista y moderno**, con dos referencias: Porsche Colombia y Tracksmith Colombia. Esta sección traduce las dos a reglas que no rompen las premisas del ecosistema, del CORE ni de la Tienda. La construye la épica ET3 y la aprueba el dueño en la galería (HU-T3.1) antes de que exista una pantalla de verdad.

**La Tienda 2.0 no aporta apariencia** (pedido del dueño del 13 oct 2026): ni colores, ni tipografía, ni plantillas, ni la disposición de sus páginas. El diseño sale de esta sección y de sus referencias. De la 2.0 solo se toman funcionalidades que ya sirven y lecciones de comportamiento de su bitácora (por ejemplo, que un botón deshabilitado diga qué falta), y aun esas se pueden cambiar.

Hay **dos caras con dos trabajos distintos**:

- **La vitrina** es del comercio: su marca va adelante y la plataforma desaparece. Lenguaje «editorial de tienda».
- **El panel** es de Laboratorio Digital: el lenguaje «editorial técnico» del ecosistema (BACKLOG_CORE §4.2), con el acento de la Tienda.

### 5.1 Premisas que el diseño no rompe

| Premisa | Qué exige al diseño |
|---|---|
| **Cero D1 por visita y horneado determinista** (TIENDA §1.3, §10.4) | Todo lo visible se hornea. Lo dinámico (carrito, cotizar, seguimiento, pago) son islas pequeñas. Nada de fecha, azar ni `Intl` en el HTML |
| **Abre rápido en un teléfono barato** (TIENDA §1.3) | HTML de portada < 50 KB y JS < 60 KB comprimido; LCP < 2,5 s en 4G lento a 360 px. Sin video, sin carruseles automáticos y una sola imagen con prioridad por página |
| **La personalización es dato** (TIENDA §2; P2) | El comercio elige entre opciones; nunca sube CSS ni código. El tema es una hoja horneada con su huella (`/tema-<huella>.css`) |
| **CSP `'self'` sin `'unsafe-inline'`** (TIENDA §11.4) | Estilos en hojas; fuentes autoalojadas; Bold es el único tercero, y solo al pagar. La CSP ignora en silencio un `<style>` en línea (bitácora agro, terreno) |
| **Sin cookies** (TIENDA §4.1) | Ningún aviso de cookies en una tienda que no mide con terceros. GA4 y Meta solo con dominio propio y consentimiento (HU-T14.4) |
| **P20 · desde quien mira** | 360 px primero, sol en la pantalla, dedos grandes (objetivos de 48 px). La ficha, el precio y lo que pide la ley se leen **sin JavaScript**; nada nace con opacidad 0 esperando un script |
| **El botón dice qué falta** (bitácora ecommerce, crítico «El botón de WhatsApp se apagaba sin decir por qué») | Un botón deshabilitado nombra lo que falta y, al tocarlo, lleva al campo |
| **Un aviso va donde está la acción** (bitácora agro, terreno; P15) | Lo que responde una acción aparece junto a ella, nunca arriba de otra pantalla |
| **WCAG 2.2 AA** (TIENDA §11.9) | Contraste **calculado** al guardar los colores, foco visible, todo usable con teclado, `autocomplete` correcto en los datos de entrega, `lang="es-CO"` |
| **Textos públicos cálidos y sin técnica** (memoria del proyecto) | «Tu tienda está en pruebas: los pagos no son reales», nunca «ambiente sandbox» (§5.7) |
| **Información veraz** (Ley 1480) | Nada de urgencia inventada: ni contadores falsos, ni «quedan 2» que no salga del inventario |

### 5.2 Lo que se toma de cada referencia

Las dos se abrieron el 6 oct 2026 antes de escribir esta sección (bitácora core, terreno: «una referencia se abre antes de copiarla»).

| Referencia | Qué se vio | Qué se toma | Qué no se toma |
|---|---|---|---|
| **Porsche Colombia** | Portada a sangre con un titular grande y ligero; navegación de tres piezas (menú, marca centrada, país); tarjetas negras de esquinas amplias con etiquetas en píldora («Gasolina», «Eléctrico») y una flecha como acción | El titular grande y ligero con el interletrado cerrado; mucho aire; tarjetas de radio amplio; etiquetas en píldora; la flecha como «ver más»; la navegación mínima | El video automático con su botón de pausa, el peso de las imágenes y la tipografía propietaria |
| **Tracksmith** | Titulares serif ligeros (56 px, peso 300, interletrado −2 px) con una palabra en cursiva como énfasis («Natural *Performance*»); etiquetas pequeñas en mayúsculas espaciadas para el material; tinta azul marino en vez de negro; un acento cálido (bronce) en los botones; grilla de productos sobre gris claro con el nombre en serif; ficha con la foto a un lado, muestras de color redondas, tallas en píldora y un botón que dice qué falta («Select a size»); mosaico de colecciones con el texto sobre la foto; franja de anuncio arriba | La pareja serif + sans con la cursiva como énfasis; las etiquetas en mayúscula espaciada (aquí en Geist Mono); la tinta azul como opción; el acento del comercio en el botón principal; la ficha completa con el botón que nombra lo que falta; el mosaico de colecciones; la franja (que además sirve para «tienda en pruebas») | Sus fuentes propietarias (Akzidenz-Grotesk Extended y SainteColombe), el aviso de cookies con seguimiento y el formato de precio con coma de miles (aquí, `$80.000`) |

**La síntesis:** papel y tinta, **un acento del comercio**, titulares grandes y ligeros, **sans o serif para lo humano y mono para lo exacto** (precios, códigos, radicados, guías y plazos). Una pantalla, una decisión.

### 5.3 La vitrina: la marca del comercio, adelante

- **La plataforma desaparece.** Ningún logo de Laboratorio Digital en la tienda, salvo «Hecha con…» en el pie del plan `gratis` (TIENDA §1.4).
- **Dos estilos tipográficos, como dato** (`apariencia`, decisión D-T2):
  - **«Precisión»** (Porsche): Geist en la display, peso 300–400 e interletrado −0,03 em; Geist Mono para precios y etiquetas. No agrega bytes a lo que ya existe.
  - **«Editorial»** (Tracksmith): una serif de licencia libre (OFL) para los titulares, con su cursiva para el énfasis; Geist para el texto y Geist Mono para lo exacto.
- **Color:** el papel y la tinta de `@ed1/ui` v2 (tinta negra o azul) y **un acento del comercio** en el botón principal, los enlaces y el foco. El panel ofrece 8 acentos ya validados y un color libre que se valida igual (HU-T3.2).
- **Tres portadas, como dato:**
  - **Editorial:** una foto a sangre con un titular y una frase; luego destacados y colecciones.
  - **Catálogo:** directo a la grilla. Es la de la panadería con 40 productos (Ensayo Dos).
  - **Colecciones:** un mosaico con el nombre de cada colección sobre su foto.
- **La proporción de las fotos es de la tienda** (4:5 para ropa, 1:1 para comida), fija para que la grilla no salte (CLS).
- **Grilla:** 2 columnas a 360 px, 3 en tableta y 4 en escritorio. Nombre, precio «desde» y una etiqueta (agotado, oferta) en píldora.
- **Ficha:** la foto arriba en el teléfono y a un lado en escritorio; nombre en display; precio en cifras tabulares con el «antes» tachado; variantes en píldoras y muestras de color; lo agotado tachado con «Avísame»; un botón fijo abajo que dice qué falta; y debajo, lo que la ley pide antes de comprar: plazo de entrega, retracto e IVA incluido.
- **Carrito y resumen:** una hoja que sube desde abajo en el teléfono; las formas de pago como tarjetas grandes; la casilla de aceptación **sin marcar**; el total en grande y en mono.
- **Seguimiento:** una línea de tiempo con cada paso y su fecha, en palabras del comprador.
- **Pie:** la ficha legal completa, los textos legales, el enlace a la SIC, «Solicitudes» y el reporte.
- **Movimiento:** 150–250 ms con salida suave; revelado al desplazar solo con `animation-timeline` dentro de `@supports`; nada con `prefers-reduced-motion`; ninguna animación con JavaScript.
- **Modo oscuro:** la vitrina es clara por defecto, porque las fotos del comercio se tomaron para fondo claro. El comercio puede elegir «oscuro» o «según el teléfono», y el contraste se valida en los dos.

### 5.4 Las pantallas de la vitrina

| Ruta | Qué ve el comprador | Historia |
|---|---|---|
| `/` | La portada del estilo que eligió el comercio | HU-T5.2 |
| `/c/<colección>/` | La grilla de la colección | HU-T5.2 |
| `/p/<producto>/` | La ficha con variantes, precio y lo que pide la ley | HU-T5.2 |
| `/buscar/?q=` | Resultados al escribir, sin red | HU-T5.3 |
| `/carrito/` | El carrito, el resumen previo y las formas de pago | HU-T5.4, HU-T6.1 |
| `/pedido/#c=…&s=…` | El seguimiento | HU-T6.3 |
| `/pedido/pago/` | La vuelta de Bold | HU-T11.9 |
| `/pedido/confirmar/#…` | Confirmar un pedido que preparó un agente | HU-T15.5 |
| `/solicitud/` | Radicar una pregunta, queja, retracto o reclamo de datos | HU-T6.4 |
| `/legal/<texto>/` | Términos, privacidad, envíos, retracto y garantía | HU-T7.1 |
| 404 y tienda cerrada | Páginas editoriales con el nombre y el contacto **de esa tienda** (bitácora ecommerce 55) | HU-T5.1 |

### 5.5 El panel: editorial técnico, con el acento de la Tienda

- **El lenguaje del CORE** (BACKLOG_CORE §4.2–§4.5): tinta y papel, sans para lo humano y mono para lo exacto, componentes base de `@ed1/ui` v2. El tema `tienda` cambia solo el acento: la propuesta es un tono cálido (cobre), que se valida con su prueba de contraste en HU-T3.2.
- **Se usa desde el teléfono todo el día.** Navegación inferior a 360 px (Inicio, Pedidos, Productos, Más) y lateral en escritorio.
- **Una acción principal por pantalla**, abajo y al alcance del pulgar.
- **Lo urgente arriba, en palabras:** cobros a revisar, pagos sin existencias, recaudos atrasados, solicitudes por vencer (P15).
- **Los estados con texto y color**, nunca solo color. Los datos del comprador **tapados** hasta que alguien los pide, y esa lectura queda registrada.
- **Listas que aguantan 300 pedidos:** tarjetas en el teléfono, tabla en escritorio; filtros en la página, sin red (bitácora ecommerce 62).

| Pantalla | Qué ve el comerciante | Historia |
|---|---|---|
| Inicio | Ventas de hoy y del mes contra el mes anterior, lo que hay que hacer y el margen de la contraentrega | HU-T14.2 |
| Pedidos | La bandeja, el detalle, «Confirmar por WhatsApp», «Cobrar con link», despachar y cancelar | HU-T9.1–HU-T9.6, HU-T11.8 |
| Recaudos | Lo por recaudar y lo recaudado sin liquidar, con su antigüedad; liquidar varios | HU-T9.5 |
| Productos e inventario | Productos con variantes y fotos, colecciones y el libro de cada variante | HU-T8.2–HU-T8.5 |
| Venta | Envíos, cupones y páginas | HU-T10.1, HU-T10.2 |
| Solicitudes | Radicados con su plazo | HU-T9.7 |
| Ajustes | Por sección; lo que mueve la plata pide volver a entrar | HU-T10.3 |
| Cobro | Llaves de Bold, cobro de prueba, comisiones y plazos | HU-T11.2, HU-T11.3 |
| Publicar y versiones | La compuerta con todas sus fallas, el avance y «Volver a esta» | HU-T10.4 |
| Equipo, registro y datos | Colaboradores, quién hizo qué, descargar todo y los derechos del titular | HU-T10.5–HU-T10.7, HU-T7.3 |
| Dominio y plan | Conectar un dominio, el plan y su vencimiento | HU-T13.1, HU-T13.5 |

### 5.6 Presupuestos (los mide el CI, no la vista)

| Medida | Vitrina (por página) | Panel | Cómo se mide |
|---|---|---|---|
| HTML | Portada < 50 KB (TIENDA §1.3) | — | Prueba sobre lo horneado |
| JavaScript | < 60 KB comprimido, islas incluidas; el de Bold no cuenta y solo carga al pagar | Inicial ≤ 60 KB y ≤ 30 KB por pantalla, con gzip | e2e que espera las islas (bitácora agro 14) |
| CSS | ≤ 20 KB con gzip, tema incluido | ≤ 20 KB | Ídem |
| Fuentes | ≤ 70 KB (D-T2) | Las de la cuenta (ADR-29) | Ídem |
| Imagen principal | La de la portada ≤ 120 KB (800 px) | — | Ídem |
| LCP | < 2,5 s en 4G lento, CPU ×4, 360 px | ≤ 2,5 s | Lighthouse CI, solo y con repeticiones (P19) |
| CLS | ≤ 0,05 | ≤ 0,05 | Lighthouse CI |
| Accesibilidad | 100 y axe sin violaciones | 100 y axe sin violaciones | Lighthouse CI y `@axe-core/playwright` |
| Consultas a D1 por visita | **0** | — | Prueba del despacho con un D1 que falla si se le habla |

Los de la vitrina vienen de TIENDA §1.3; los del panel y los de CSS, fuentes e imagen son la propuesta de este plan, y HU-T3.6 los confirma con las primeras mediciones.

### 5.7 Textos: cálidos y sin técnica

| No | Sí |
|---|---|
| «Ambiente sandbox» | «Tu tienda está en pruebas: los pagos no son reales» |
| «Error 401» | «Vuelve a entrar para seguir» |
| «Webhook pendiente» | «Estamos esperando la confirmación de Bold» |
| «Stock insuficiente por reservas activas» | «Hay 2 unidades apartadas por pagos en curso» |
| «Validación de compuerta fallida» | «Antes de publicar te falta: tu NIT, una foto en “Vestido rosa” y el plazo de “Envío a Bogotá”» |
| «Contraentrega: estado por_recaudar» | «La transportadora todavía no te ha consignado» |

### 5.8 Lo que no se hace, y por qué

- **Ningún framework de CSS de terceros ni íconos en fuente web:** los tokens son la única fuente (P2); los íconos son un sprite SVG.
- **Ni video, ni carruseles automáticos, ni ventanas de suscripción:** pesan, distraen y no venden en un teléfono barato.
- **Ninguna animación con JavaScript.**
- **Ningún código, plantilla ni CSS por tienda:** es la causa 1 de la 2.0 con otro nombre.

---

## 6. Plan de sprints

### 6.1 Los sprints

**T0 no es un sprint con fecha:** es un carril de holgura (decisión D-T1). Solo avanza cuando el carril del CORE tiene 4 historias esperando validación o su sprint ya está construido, y solo con trabajo que no necesita la nube ni el CORE. Tope: 21 puntos.

| Sprint | Fechas (plan base) | Meta del sprint | Historias (puntos) | Pts | Hito |
|---|---|---|---|---|---|
| **T0** (holgura) | Desde el 6 oct 2026, hasta que arranque T1 | Las reglas que no dependen de la nube, la dirección visual en la galería y saber qué usa cada tienda 2.0 | HU-T0.1 (1), HU-T1.1 (3), HU-T1.2 (3), HU-T1.3 (5), HU-T1.4 (5), HU-T3.1 (3), HU-T12.1 (1) | 21 | — |
| **T1** (festivo) | 30 nov–11 dic | La Tienda existe en el registro y en staging: celda, bases, KEK y tres apps desplegadas | HU-T2.1 (3), HU-T2.2 (3), HU-T2.3 (3), HU-T2.4 (5), HU-T2.5 (2) | 16 | — |
| **T2** (corto) | 14–23 dic | **M0.** Dos comercios de prueba en staging que entran con tokens de la Tienda, con versión propia y presupuesto vigilado. Solo staging desde el 18 dic | HU-T0.2 (3), HU-T2.6 (3), HU-T2.7 (2), HU-T2.8 (2), HU-T3.3 (2) | 12 | M0 |
| — | 24 dic–8 ene | Pausa y congelamiento | — | — | — |
| **T3** (festivo) | 12–22 ene 2027 | El horno produce los bytes de una tienda y el despacho los sirve sin tocar la base | HU-T2.10 (2), HU-T3.2 (3), HU-T4.1 (5), HU-T4.2 (2), HU-T5.1 (5), HU-T14.8 (2) | 19 | — |
| **T4** | 25 ene–5 feb | Publicar es hornear en cola con su compuerta; la vitrina tiene sus componentes | HU-T3.4 (5), HU-T4.3 (3), HU-T4.4 (5), HU-T5.3 (2), HU-T5.6 (2), HU-T17.1 (3) | 20 | — |
| **T5** | 8–19 feb | La vitrina completa: portada, colecciones, fichas, carrito, cotizar y los textos legales | HU-T5.2 (5), HU-T5.4 (3), HU-T5.5 (3), HU-T6.5 (1), HU-T7.1 (5), HU-T15.1 (3) | 20 | — |
| **T6** | 22 feb–5 mar | Se pide por WhatsApp con acuse y seguimiento; la carga del operador; la vitrina en producción sin tiendas | HU-T2.9 (2), HU-T3.6 (3), HU-T6.1 (5), HU-T6.2 (2), HU-T6.3 (3), HU-T12.2 (5) | 20 | `v0.1.0` |
| **T7** | 8–19 mar | **M1.** Solicitudes con radicado y la aceptación de la tienda pública; el panel abre la puerta | HU-T3.5 (5), HU-T5.7 (2), HU-T6.4 (5), HU-T7.2 (2, pasó a T14), HU-T8.1 (3), HU-T17.2 (2) | 19 | M1 |
| **T8** (corto) | 23 mar–2 abr | Productos con variantes y fotos desde el teléfono | HU-T8.2 (5), HU-T8.3 (3), HU-T8.4 (2), HU-T10.6 (2) | 12 | — |
| **T9** | 5–16 abr | Inventario con su libro, la bandeja de pedidos y los ajustes | HU-T4.5 (2), HU-T8.5 (3), HU-T9.1 (5), HU-T9.2 (2), HU-T9.3 (3), HU-T10.3 (5) | 20 | — |
| **T10** | 19–30 abr | Despachar, recaudar y liquidar la contraentrega; envíos, cupones, versiones y equipo | HU-T9.4 (3), HU-T9.5 (5), HU-T9.6 (3), HU-T10.1 (3), HU-T10.4 (3), HU-T10.5 (3) | 20 | — |
| **T11** (festivo) | 3–14 may | **M2.** Solicitudes en el panel, derechos del titular, exportación y tablero; revisión con la tienda llena | HU-T3.7 (2), HU-T7.3 (3), HU-T9.7 (3), HU-T10.7 (3), HU-T14.2 (5) | 16 | M2 |
| **T12** | 17–28 may | Las llaves del comercio cifradas y el primer cobro de prueba guiado | HU-T11.1 (3), HU-T11.2 (5, pasó a T14), HU-T11.3 (3, pasó a T14), HU-T11.4 (5), HU-T17.3 (3) | 19 | — |
| **T13** (festivo) | 1–11 jun | Bold avisa, se concilia, y cada respuesta tiene su camino | HU-T11.5 (5), HU-T11.6 (3), HU-T11.7 (3), HU-T11.9 (2), HU-T14.3 (3) | 16 | — |
| **T14** | 14–25 jun | **M3.** Los términos del comercio, sus llaves de Bold y el cobro de prueba guiado (lo que quedó de T7 y T12); links de pago, caos, revisión de seguridad y restauración probada; la carga asistida de fotos | HU-T7.2 (2), HU-T11.2 (5), HU-T11.3 (3), HU-T0.3 (1), HU-T4.6 (3), HU-T11.8 (3), HU-T11.10 (3), HU-T11.11 (3), HU-T12.3 (3), HU-T17.4 (3) | 29 (19 + 10 que vienen de T7 y T12) | M3 |
| **T15** (festivo) | 28 jun–9 jul | Dominios propios con prevalidación, los runbooks y la rotación de la KEK | HU-T13.1 (5), HU-T13.2 (3), HU-T13.3 (2), HU-T17.5 (2), HU-T17.6 (3) | 15 | — |
| **T16** (festivo) | 12–23 jul | **M4.** Alta abierta, plan por periodo, antiabuso y baja; medición propia y feeds | HU-T13.4 (5), HU-T13.5 (3), HU-T13.6 (3), HU-T13.7 (2), HU-T14.1 (3), HU-T14.5 (3) | 19 | M4 |
| **T17** | 26 jul–6 ago | **M5 · `tienda-v1.0.0`.** Resumen diario, consentimiento, reconciliación, páginas propias y el reporte del dueño | HU-T8.6 (2), HU-T10.2 (2), HU-T14.4 (3), HU-T14.6 (2), HU-T14.7 (2) | 11 | M5 |
| **T18** (festivo) | 9–20 ago | **M7.** Los agentes preparan pedidos que una persona confirma | HU-T15.2 (2), HU-T15.3 (2), HU-T15.4 (5), HU-T15.5 (3), HU-T15.6 (2), HU-T15.7 (5) | 19 | M7 |
| **T19** | 23 ago–3 sep | **M8.** La factura, en el facturador del comercio | HU-T16.1 (2), HU-T16.2 (5), HU-T16.3 (3), HU-T16.4 (2) | 12 | M8 |
| **T20** | 6–17 sep | Holgura: lo que traiga la validación con los primeros comercios | — | 0 | — |

**Lo real al 15 oct 2026:** T0 a T11 se construyeron entre el 6 y el 15 oct de 2026, meses antes de las fechas de esta tabla. Las fechas no se recalculan todavía: §6.2 las recalcula con la velocidad **validada**, que llega a 25 puntos (T0, y HU-T8.2 y HU-T8.3 de T8, el 15 oct), con 58 historias esperando validación frente al tope de 3 (§3.6). Se recalculan cuando el dueño valide lo construido de T1 a T11 (bitácora tienda3 13). *(Hoy, 19 oct 2026: T0 a T13 se construyeron entre el 6 y el 17 oct. T12 quedó a medias: HU-T11.2 y HU-T11.3 esperaban HU-T7.2, que esperaba los datos del encargado, y las tres pasan a T14, donde los términos salen con «por completar» hasta que el dueño los dé, como en el parqueadero. Entre el 16 y el 17 oct el plan gratuito pidió cinco arreglos fuera de los sprints (PR #194 y #199 a #203; bitácora tienda3 26 a 30). La velocidad validada sigue en 25 puntos, con 66 historias esperando validación. El 19 oct se midió que la tienda llena no se puede hornear en una solicitud del plan gratuito (bitácora tienda3 31): es una decisión del dueño.)*

**Total:** 345 puntos. Hasta el alta abierta (T0 a T16, M4): 303. Desde el 13 oct 2026 ninguna tienda 2.0 se migra (bitácora tienda3 9): sus 15 puntos de carga y corte salieron, y los hitos de M4 en adelante llegan un sprint antes.

### 6.2 Por qué el plan es más largo que TIENDA §19, y cómo se acorta

TIENDA §19 estimó 17 semanas hasta vender, contando semanas de construcción. Este plan cuenta lo que el dueño alcanza a **validar** (20 puntos por sprint, la regla del CORE) y suma lo que §19 no desglosó:

- el sistema de diseño de la vitrina y del panel, pedido nuevo del dueño (ET3, 23 puntos);
- la producción temprana y la restauración probada antes de guardar datos de terceros (HU-T2.9, HU-T17.3, HU-T17.4);
- el cumplimiento traducido a controles (ET7 y las solicitudes, 18 puntos);
- la paridad completa, con el tablero antes de M6 (bitácora tienda3 1), la revisión de seguridad y la batería de caos.

**Las palancas, en orden de impacto:**

1. **La velocidad validada.** Si el dueño valida más de 20 por sprint, el plan se recalcula en la planeación siguiente (como el CORE):

   | Velocidad validada | M6 (retirado): las dos tiendas en la 3.0 |
   |---|---|
   | 20 (plan base) | Fines de julio de 2027 |
   | 30 | Mayo de 2027 |
   | 40 | Mediados de abril de 2027 |

2. **El arranque.** Si HC1 se valida y el dueño activa Workers Paid y la zona `.app` antes, T1 arranca antes y todo se corre con él: cada sprint conserva su contenido y su orden. Con T1 el 3 nov, todo llega unas 4 semanas antes.
3. **El carril de holgura T0** (D-T1): adelanta 21 puntos sin tocar el orden del CORE.
4. *(Retirada el 13 oct 2026: ninguna tienda 2.0 se migra, y M6 salió del plan.)* **El alcance de M6:** lo que HU-T12.1 diga que ninguna tienda 2.0 usa puede ir después de M6, como ya van las páginas propias y la vista previa (Should y Could).

### 6.3 La vista del camino crítico

```text
CORE:   HC1 ──► HU-C4.3/C4.4 (C5) ──► HC4 (C7) ──► HC6 (C10) ──► HC7 (C11)
          │            │                  │            │              │
Tienda: T0 ─► M0 ─► M1 ─────────► M2 ──► M3 ──► M4 ──► M5 ──► M7 ──► M8   (M6 retirado el 13 oct 2026)
              T1-T2  T3-T7        T7-T11  T12-T14 T15-16 T16-17  T17-18  T19    T20
```

Después de M0, **el camino crítico es el de la Tienda, no el del CORE**: cuando la Tienda necesita algo del CORE, en el plan base ya está hecho. Lo largo es el panel (M2), como ya advertía TIENDA §20.1.

---

## 7. Épicas

| Épica | Objetivo | Hitos | Pts |
|---|---|---|---|
| ET0 · Gobierno del proyecto | Plan, bitácora, versión propia y métricas de validación | M0, M3 | 5 |
| ET1 · Cimientos de código | `dinero`, `calendario`, `cifrado` y `tienda-schema`: las reglas puras que comparten navegador, API y horno | M0 | 16 |
| ET2 · Datos, nube y fundación | Migraciones, registro de productos, celda, apps, KEK, comercios de prueba, presupuesto, tokens y producción temprana | M0, M1 | 25 |
| ET3 · Diseño de la Tienda | Temas, tipografía, componentes de la vitrina y del panel, presupuestos y la revisión con la tienda llena | M0–M2 | 23 |
| ET4 · Horno y publicación | Bytes deterministas, compuerta, cola, re-horneados por existencias y por anillos | M1–M4 | 20 |
| ET5 · Vitrina pública | Despacho, portada, colecciones, fichas, buscador, carrito, cotizar y fotos | M1 | 22 |
| ET6 · Pedido y posventa del comprador | Pedido por WhatsApp, acuse, seguimiento, solicitudes y «Avísame» | M1 | 16 |
| ET7 · Cumplimiento | Textos legales generados, términos y contrato de transmisión, derechos del titular | M1, M2 | 10 |
| ET8 · Panel: catálogo e inventario | Entrar, productos con variantes, fotos, colecciones, inventario y vista previa | M2, M5 | 18 |
| ET9 · Panel: pedidos y contraentrega | Bandeja, datos auditados, confirmar, despachar, recaudos, liquidación y solicitudes | M2 | 24 |
| ET10 · Panel: venta, ajustes, equipo y datos | Envíos, cupones, páginas, ajustes, publicar, equipo, registro y exportar | M2, M5 | 21 |
| ET11 · Cobro en línea con Bold | Llaves, prueba guiada, apartados, botón, avisos, conciliación, links, caos y seguridad | M3 | 38 |
| ET12 · Carga asistida y referencia de la 2.0 | La referencia de lo que usa la 2.0 y la carga de un comercio nuevo desde un archivo. La conversión desde la 2.0, la paridad, la marca de vuelta y los cortes se retiraron el 13 oct 2026 | M1–M3 | 9 |
| ET13 · Dominios, alta y plan | Dominio propio, canónico, raíz, alta, plan, antiabuso y baja | M4 | 23 |
| ET14 · Medición, tablero y feeds | `/_m`, tablero, correos, GA4 y Meta, feeds, reconciliación y reporte | M2, M4, M5 | 21 |
| ET15 · Agentes | Capa estática por tienda, OpenAPI, habilidad, MCP público y del comercio | M1, M7 | 22 |
| ET16 · Factura integrada | `DocumentoFiscal` con el facturador del comercio | M8 | 12 |
| ET17 · Operación y confiabilidad | Crons, purgas, respaldos, simulacro, runbooks y rotación de la KEK | M1–M4 | 16 |

---

## 8. Historias refinadas

Formato de cada historia, el del CORE:

- **Capa · Prioridad (MoSCoW) · Puntos · Sprint · Depende de · Estado.** Estados: `Refinada`, `En sprint`, `En validación`, `Terminada`, `Preparada`.
- **Como / quiero / para.**
- **Respaldo:** el documento que la decide.
- **Criterios de aceptación** (CA), con al menos uno negativo (❌).
- **Boceto**, si tiene pantalla. **Lo publicado (P10)** y **Consumo y kill switch**, cuando aplican.
- **Patrones en riesgo.**
- **Work items** (WI): `[código]`, `[prueba]`, `[doc]`, `[infra]`, `[ci]`, `[diseño]` o `[dueño]`.

### ET0 · Gobierno del proyecto

#### HU-T0.1 · Plan, backlog y bitácora de la Tienda 3.0 en el repositorio
- **Capa:** proceso · **Prioridad:** Must · **Puntos:** 1 · **Sprint:** T0 · **Depende de:** — · **Estado:** Terminada (PR #101, fusionado el 6 oct 2026)
- Como dueño, quiero el plan de la Tienda y su bitácora en el repositorio, con el método del CORE, para decidir el orden y unir después todas las bitácoras en el segundo cerebro de ED1.
- **Respaldo:** TIENDA §19; BACKLOG_CORE §2–§4 (el método); bitácoras agro y core, «Cómo se une con las otras bitácoras».
- **CA1.** Existen `docs/tienda/BACKLOG_TIENDA3.md` y `docs/tienda/BITACORA_TIENDA3.md`, y los nombran `docs/README.md`, `docs/BACKLOG.md` y `BACKLOG_CORE.md`.
- **CA2.** La bitácora usa la ficha extraíble con el proyecto `tienda3`, los patrones P1–P21 sin renumerar y los provisionales `PT<n>`.
- **CA3 ❌.** Ninguna contradicción con TIENDA, ED1 o ARQUITECTURA queda callada: las cuatro que encontró el plan están en la bitácora (tienda3 1 a 4) y TIENDA dice dónde quedó cada una.
- **Work items:** WI-T0.1.1 `[doc]` backlog · WI-T0.1.2 `[doc]` bitácora · WI-T0.1.3 `[doc]` mapa de `docs/`, filas en los otros backlogs y CHANGELOG · WI-T0.1.4 `[doc]` notas en TIENDA §9.3, §11.5, §15.4 y §19.

#### HU-T0.2 · Versión propia de la Tienda y su publicación
- **Capa:** CI y despliegue · **Prioridad:** Must · **Puntos:** 3 · **Sprint:** T2 · **Depende de:** HU-T2.4, HU-C0.3 (hecha) · **Estado:** En validación (rama `feat/t2-sprint`. La versión vive en `apps/tienda-api/package.json` (0.0.0) con su `CHANGELOG.md`, adonde pasaron las entradas de T1 que estaban en el de la raíz sin publicar; el despacho y el panel no llevan versión, y una prueba lo exige. `decidirPublicacion` suma la Tienda al final del orden (CORE, agro, parqueadero, Tienda); el flujo crea `tienda-vX.Y.Z` con las notas de su CHANGELOG (`notas-de-version.ts --tienda`), y `verificar-changelog.ts` vigila sus versiones publicadas. La guardia del PR (`cambiaLaTienda`) cubre `apps/tienda-*` y `packages/tienda-*`, código y páginas, pero no sus pruebas ni los paquetes que la Tienda comparte (`dinero`, `calendario`, `cifrado`), que no son solo suyos. Controles negativos: en 0.0.0 no se publica, una prueba que cambia no exige CHANGELOG, `packages/dinero` tampoco)
- Como dueño, quiero publicar la Tienda cuando cambia la Tienda, con su versión y su registro de cambios, para no arrastrar el agro ni el CORE.
- **Respaldo:** PLATAFORMA §6.3; HU-C0.3; memoria del proyecto «publicar agro y CORE».
- **CA1.** La versión vive en un solo `package.json` (propuesta: `apps/tienda-api`), con su `CHANGELOG.md` y etiquetas `tienda-vX.Y.Z`. Las otras dos apps no llevan versión propia, y una prueba lo exige (P2).
- **CA2.** `scripts/lib/publicacion.ts` agrega el producto: un PR que sube la versión de la Tienda publica solo la Tienda, en la misma corrida que crea la etiqueta (una versión creada con el token de Actions no dispara otros flujos: bitácora agro, terreno). Si sube también el CORE, va primero el CORE.
- **CA3 ❌.** Un PR que cambia `apps/tienda-*/src` o `packages/tienda-*` sin anotar el CHANGELOG de la Tienda hace fallar el CI (la guardia de HU-C0.3, extendida).
- **Patrones en riesgo:** P2, P10, P16.
- **Work items:** WI-T0.2.1 `[código]` publicación por producto · WI-T0.2.2 `[ci]` destino `tienda` en `desplegar.yml` · WI-T0.2.3 `[prueba]` tabla de casos (sube la Tienda, el CORE, las dos o ninguna) · WI-T0.2.4 `[doc]` ARQUITECTURA §7.

#### HU-T0.3 · Los umbrales de validación, escritos antes de medir
- **Capa:** producto · **Prioridad:** Must · **Puntos:** 1 · **Sprint:** T14 (antes del alta abierta; era «antes del primer corte», que ya no existe) · **Depende de:** HU-T12.1 · **Estado:** En validación (rama `feat/t14-sprint`. `content/tienda/validacion.json`, en «propuesta»: pago real, soporte por comercio, retención, confiabilidad del cobro, activación y costo por uso, cada una con su umbral, su frecuencia y la tabla o la hoja de donde sale; el público adecuado y el tiempo por tarea dicen por qué se fijan después. `tests/repo/tienda-validacion.test.ts`: una métrica sin umbral, o con «por definir» sin motivo, no pasa (CA3, con su control negativo). Falta WI-T0.3.1, del dueño: cambiar lo que quiera y pasarla a «fijada», con su fecha, antes de la primera tienda real)
- Como dueño, quiero las métricas del estudio con su número antes de cargar la primera tienda, para no acomodar la regla a lo que salga.
- **Respaldo:** estudio §16.3 [V8]; ED1 §2.1 [D3] (excepción con métricas fijadas antes de medir); TIENDA §19.
- **CA1.** Un archivo de contenido (`content/tienda/validacion.json`) con pago real, soporte por comercio (minutos por semana), retención, confiabilidad del cobro, activación y costo por uso: cada una con umbral, frecuencia y fuente. Lo que no se puede anticipar dice cuál es y por qué.
- **CA2.** Hasta HU-T14.7, el dueño las mide con el tablero; desde entonces, las trae el reporte semanal.
- **CA3 ❌.** Una métrica sin umbral, o con «por definir» sin motivo, hace fallar la prueba.
- **Work items:** WI-T0.3.1 `[dueño]` umbrales · WI-T0.3.2 `[prueba]` · WI-T0.3.3 `[doc]`.

### ET1 · Cimientos de código

#### HU-T1.1 · `@ed1/dinero`: pesos enteros, el total y su reparto
- **Capa:** paquete · **Prioridad:** Must · **Puntos:** 3 · **Sprint:** T0 · **Depende de:** — · **Estado:** Terminada (PR #107, fusionado el 6 oct 2026. `packages/dinero`, 32 pruebas en 0,5 s. CA1 cambió en un punto: el porcentaje redondea con **techo**, porque el piso que escribía TIENDA §6 favorece al comercio y contradice su promesa (bitácora tienda3 5). CA2, la parte de workerd: el paquete no usa `Intl`, ni reloj, ni azar, ni módulos de Node, y la guardia `tests/repo/tienda-paquetes-puros.test.ts` lo exige; correrlo dentro de workerd llega con la API (HU-T2.4), que lo ejecuta en cada prueba. Es más barato atacar la causa (`Intl`) que levantar workerd por cada función pura. Controles negativos: con `Math.floor`, 1 prueba en rojo; con un `pesos()` que devuelve 0 en vez de lanzar, 10)
- Como comprador, quiero que el total que veo en el teléfono sea el que cobra el servidor y el que dice la página horneada.
- **Respaldo:** TIENDA §6; P2 (una sola fuente para navegador, API y horno); P17 (`Intl` cambia entre runtimes).
- **CA1.** Funciones puras: subtotal; descuento por porcentaje (`⌈subtotal × % / 100⌉`, a favor del comprador), por valor (`min`) y envío gratis; envío con `gratis_desde`; total; reparto del descuento por mayor residuo; formato `$80.000` propio, sin `Intl`.
- **CA2.** La tabla de casos de TIENDA §6 y los límites de COP 1.000 a 5.000.000 para cobrar en línea; la misma salida en Node y en workerd.
- **CA3 ❌.** Un monto que no es entero, es negativo o no se puede leer lanza nombrando el campo: **nunca vale 0** (bitácora ecommerce, crítico «`Number(celda) || 0`»). Un reparto que no suma exacto pone la prueba en rojo.
- **Patrones en riesgo:** P1, P2, P17.
- **Work items:** WI-T1.1.1 `[código]` · WI-T1.1.2 `[prueba]` tabla de casos · WI-T1.1.3 `[prueba]` Node y workerd.

#### HU-T1.2 · `@ed1/calendario`: días hábiles de Colombia, compartido con el CORE
- **Capa:** paquete · **Prioridad:** Must · **Puntos:** 3 · **Sprint:** T0 · **Depende de:** — · **Estado:** Terminada (PR #107, fusionado el 6 oct 2026. `packages/calendario`: festivos de 2020 a 2040, `esHabil`, `sumarDiasHabiles`, `diasHabilesEntre`, `sumarDiasCalendario` y `fechaEnBogota`, todo en UTC. 18 pruebas: las tablas de 2026 y 2027 escritas a mano, y la batería repetida con el huso de Kiritimati, comprobando que el cambio de huso sí llegó. Lo que enseñó: **un año no siempre tiene 18 festivos**; en 2030 el Sagrado Corazón y San Pedro y San Pablo caen el mismo lunes (bitácora tienda3, terreno). Controles negativos: sin San José, o contando sábados y domingos, 4 pruebas en rojo. WI-T1.2.3 hecho: HU-C7.7 del CORE lo nombra)
- Como comprador que radica un reclamo, quiero que el plazo que me dicen cuente los festivos de Colombia.
- **Respaldo:** TIENDA §8.6 y §14.3; Ley 51 de 1983; HU-C7.7 (WI-C7.7.3 pide lo mismo para el CORE): **un solo paquete para los dos** (P2), que construye quien llega primero.
- **CA1.** Festivos fijos, los que la Ley 51 corre al lunes y los que dependen de la Pascua (calculada), de 2026 a 2035; `esHabil`, `sumarDiasHabiles` y `sumarDiasCalendario`, en la fecha de Bogotá.
- **CA2.** Una prueba contra una tabla de 2026 y 2027 escrita a mano (Semana Santa incluida), y la batería corre también con `TZ=Pacific/Kiritimati` (P8).
- **CA3 ❌.** Correr San José o la Ascensión a otro día, o contar un sábado como hábil, pone la prueba en rojo.
- **Patrones en riesgo:** P8, P2.
- **Work items:** WI-T1.2.1 `[código]` · WI-T1.2.2 `[prueba]` tablas 2026–2027 · WI-T1.2.3 `[doc]` nota en HU-C7.7 de `BACKLOG_CORE.md`.

#### HU-T1.3 · `@ed1/cifrado`: sobre, campos, índice ciego y rotación
- **Capa:** paquete y seguridad · **Prioridad:** Must · **Puntos:** 5 · **Sprint:** T0 · **Depende de:** — · **Estado:** Terminada (PR #107, fusionado el 6 oct 2026. `packages/cifrado`, 12 pruebas en menos de un segundo. Un detalle que no estaba en los CA: el campo cifrado lleva la versión de su DEK (`<versión>:v1.<iv>.<cifrado>`), para leer lo viejo después de rotar una DEK y para que borrar la DEK de datos personales sea el borrado criptográfico. Sin `Buffer`, que no existe en workerd. CA4 (workerd) como en HU-T1.1: la guardia de paquetes puros y la ejecución real con la API (HU-T2.4). WI-T1.3.5 hecho: ARQUITECTURA §9. Control negativo: sin los datos asociados, 2 pruebas en rojo (otra fila y otro propósito))
- Como comercio, quiero que mis llaves de Bold y los datos de mis compradores no se puedan leer aunque alguien copie la base.
- **Respaldo:** TIENDA §9.2 y §14.2; ED1 §20; P13.
- **CA1.** AES-256-GCM con IV de 12 bytes al azar por escritura y AAD `org|tabla|campo|id`; una DEK por tienda y propósito (`credenciales`, `datos_personales`, `indices`), envuelta con la KEK con AAD `org|proposito|version`; índice ciego `HMAC-SHA256` truncado a 128 bits.
- **CA2.** Reenvolver todas las DEK con una KEK nueva sin tocar los campos; la vieja se retira solo cuando ninguna DEK la usa (P21).
- **CA3 ❌.** Un cifrado copiado a otra fila o a otra tienda no se descifra; una KEK equivocada falla sin decir nada del contenido. Ningún valor en claro sale en un error ni en un log: una prueba los busca.
- **CA4.** WebCrypto, con las mismas salidas en Node y en workerd (P17).
- **Nota (regla de tres):** `apps/core/src/drive.ts` ya sella con AES-GCM el token de Drive. No se mueve aquí hasta un tercer uso; queda anotado en §9.
- **Patrones en riesgo:** P13, P17, P21.
- **Work items:** WI-T1.3.1 `[código]` sobre y campos · WI-T1.3.2 `[código]` índice ciego · WI-T1.3.3 `[código]` rotación · WI-T1.3.4 `[prueba]` controles negativos · WI-T1.3.5 `[doc]` ARQUITECTURA §9.

#### HU-T1.4 · `@ed1/tienda-schema`: ajustes, permisos y el formato de carga
- **Capa:** paquete · **Prioridad:** Must · **Puntos:** 5 · **Sprint:** T0 · **Depende de:** — · **Estado:** Terminada (PR #107, fusionado el 6 oct 2026. `packages/tienda-schema`: `secciones.ts` (9 secciones, versiones y traductores, `faltantes` para la compuerta y `seccionesParaHornear`), `permisos.ts` (matriz, `decidir` con la entrada reciente y `accionesDeAjuste`) y `carga.ts` (`tienda-import/1` = `tienda-export/1` y `revisarCarga`, con todos los problemas cruzados a la vez). 22 pruebas. Dos decisiones que no estaban escritas: los esquemas aceptan una sección a medio llenar para guardar por partes, y lo que falta para publicar lo dice `faltantes` (así «vacío nunca es valor de fábrica» se cumple sin impedir guardar); y solo el aspecto y las señales para agentes tienen valores por defecto. Una prueba ata la lista de secciones y su `publica` a `ref_seccion_ajuste` de la migración: hoy la lee de `docs/tienda/sql/`, y pasa a `infrastructure/migraciones/` con HU-T2.1. Controles negativos: un WhatsApp con valor por defecto, `cobro` marcada como pública o una acción de cobro fuera de la matriz ponen pruebas en rojo)
- Como plataforma, quiero una sola definición de cada sección de ajustes, de la matriz de permisos y de `tienda-import/1`, que lean el panel, la API y el horno.
- **Respaldo:** TIENDA §5.7, §12.1 y §17.1; P2; R1 de la 2.0 (los contratos solo crecen).
- **CA1.** Esquemas zod de las 9 secciones de ajustes, cada uno con su número de `esquema` y un traductor de cada versión vieja a la vigente (como `aVersionVigente` del agro).
- **CA2.** `permisos.ts`: qué puede el propietario y qué el colaborador, por acción; lo que no está, negado (como HU-E4.5 del agro).
- **CA3.** `tienda-import/1` y `tienda-export/1` son el mismo esquema, idempotente por `ref_externa`.
- **CA4 ❌.** Un obligatorio vacío no se llena con un valor de fábrica: la validación lo devuelve como faltante (P1; bitácora ecommerce, crítico «el celular de la primera tienda»). Una acción que no está en la matriz se niega.
- **CA5.** Los datos de la transferencia viven en la sección `cobro` (`publica = 0`), y el esquema de lo horneado no los admite (TIENDA §5.7).
- **Patrones en riesgo:** P1, P2, P10.
- **Work items:** WI-T1.4.1 `[código]` secciones y traductores · WI-T1.4.2 `[código]` permisos · WI-T1.4.3 `[código]` carga y exportación · WI-T1.4.4 `[prueba]`.

### ET2 · Datos, nube y fundación

#### HU-T2.1 · Las migraciones 0001 de la tienda y del control, en D1
- **Capa:** base · **Prioridad:** Must · **Puntos:** 3 · **Sprint:** T1 · **Depende de:** HU-C2.1 y HU-C11.7 (hechas) · **Estado:** En validación (rama `feat/t1-sprint`. Las dos migraciones viven en `infrastructure/migraciones/tienda/` y `tienda-control/`, y `docs/tienda/sql/` se retiró. `tests/repo/shard-tienda.test.ts` corre las 82 comprobaciones con los dos instrumentos de HU-C11.7, el shard y la base de control en la misma configuración de `tienda-api`: en la base en proceso siempre, y en el D1 local de workerd cuando el cambio toca la base, en `main` y en la corrida semanal (`instrumentoDe()`), porque levantar dos bases en workerd cuesta unos 6 s de CI que un PR sin cambios de esquema no necesita gastar. En workerd pasan las 82 sin cambiar el esquema; solo `integrity_check` pasó a `quick_check`, que es el que D1 admite. Los anexos A y B de TIENDA citan los archivos y una prueba exige que sean sus copias. Desde que existe la migración de control, la prueba de dominios lee sus reservados de infraestructura, y ahora también revisa los hostnames de `productos.json` y `celdas.json`: `panel.laboratorio-digital.app` está reservado. CA4 (`foreign_key_check` antes de aplicar en una base con datos) va en el despliegue de HU-T2.4. Controles negativos: sin el `CHECK` de `reservado <= stock`, 4 pruebas en rojo; con un `ON DELETE CASCADE`, la de la forma del esquema; sin `panel` en los reservados, la de dominios)
- Como plataforma, quiero el esquema probado de la Tienda donde lo aplica el despliegue, con sus 82 comprobaciones contra el D1 de verdad.
- **Respaldo:** TIENDA §5 y anexos A y B; ADR-25; P17, P18.
- **CA1.** `docs/tienda/sql/` pasa a `infrastructure/migraciones/tienda/0001_tienda_v1.sql` y `infrastructure/migraciones/tienda-control/0001_control_v1.sql`. Los anexos de TIENDA citan el archivo, y una prueba falla si dicen otra cosa.
- **CA2.** Las 82 comprobaciones de `probar-tienda.mjs` corren como pruebas con el instrumento rápido y, en `main`, en el D1 local de workerd.
- **CA3 ❌.** Quitar `CHECK (reservado <= stock)` hace fallar «la última unidad»; una clave foránea con `ON DELETE CASCADE` la atrapa una prueba del esquema.
- **CA4.** Antes de aplicar en una base con datos, `PRAGMA foreign_key_check` sale vacío (bitácora core 2).
- **Patrones en riesgo:** P17, P18, PC1.
- **Work items:** WI-T2.1.1 `[código]` mover y aplicar · WI-T2.1.2 `[prueba]` las 82 en workerd · WI-T2.1.3 `[prueba]` anexo ↔ archivo · WI-T2.1.4 `[doc]` TIENDA, anexos.

#### HU-T2.2 · La Tienda en el registro de productos
- **Capa:** datos · **Prioridad:** Must · **Puntos:** 3 · **Sprint:** T1 · **Depende de:** HU-C1.1, HU-C1.2, HU-C1.3 · **Estado:** En validación (rama `feat/t1-sprint`. La Tienda entra **pausada**: el CORE la conoce con sus tipos, roles, planes y política, pero no crea tiendas ni cobra planes hasta M2 (`productoDe` responde «pausado»). Sus orígenes son los de `tienda-panel` (HU-T2.4). `productos.json` exige un presupuesto: USD 1 y 5.000 filas escritas de D1 al día, lo que gastan las pruebas de staging, hasta que HU-T2.7 lo fije; el de la celda del agro pasa de USD 11 a 12. La regla de `funciones.json` vive en `@ed1/tienda-schema` (`fallasDeFunciones`, `valorDe`, `cabe`): un límite que no se puede leer lanza, nunca vale «sin límite». Una prueba ata los precios a la tabla «Por periodo» de TIENDA §1.4. La política de las cuentas de la Tienda es un borrador, como la del parqueadero. CA3 (los reservados en `slug_reservado`) llega con la base de control en el despliegue (HU-T2.1 y HU-T2.4). Controles negativos: un plan de más o de menos en `funciones.json`, un límite con decimales, un semestral más caro y un rol del agro o del parqueadero en una tienda)
- Como plataforma, quiero que la Tienda exista como producto con sus tipos, roles, planes y nombres reservados, para que el CORE la conozca sin una migración.
- **Respaldo:** PLATAFORMA §4.2; ED1 §5.4; TIENDA §1.4 y §12.1; HU-C1.1 CA2 («la Tienda entra en su M0»).
- **CA1.** `productos.json`: producto `tienda`, tipo `tienda`, roles `propietario` (administra) y `colaborador` (invitable), `gracia_dias: 7`, su prefijo de cobro, su política y sus orígenes (`panel.laboratorio-digital.app` y el de staging).
- **CA2.** `content/tienda/planes.json` con los cuatro niveles y sus precios por periodo **como hipótesis** (TIENDA §1.4, D-T3), y `content/tienda/funciones.json` con los límites; una prueba ata los dos. Nada se cobra hasta HU-T13.5.
- **CA3.** Los nombres reservados de `dominios.json` llegan a `slug_reservado`, y uno que ya tenga tienda no se puede reservar (PLATAFORMA §6.4).
- **CA4 ❌.** Un plan en `funciones.json` que no está en `planes.json`, un semestral más caro que seis meses o un rol del agro en una tienda hacen fallar la prueba y la base.
- **Patrones en riesgo:** P2, P6 (la Tienda pasa por el mismo archivo que el agro), PC1.
- **Work items:** WI-T2.2.1 `[código]` registro · WI-T2.2.2 `[código]` planes y funciones · WI-T2.2.3 `[prueba]` · WI-T2.2.4 `[dueño]` D-T3.

#### HU-T2.3 · La celda de tiendas, declarada y generada
- **Capa:** infraestructura · **Prioridad:** Must · **Puntos:** 3 · **Sprint:** T1 · **Depende de:** HU-C1.4 · **Estado:** En validación (rama `feat/t1-sprint`. `celdas.json` declara la celda `c1` de la Tienda en el plan gratuito, con el shard `tienda_c1_s1` y un campo nuevo, `control`, para la base que no cabe en un shard (`tienda_control`, una por producto: `cargarCeldas` exige `<producto>_control`). `scripts/generar-wrangler.ts` genera `apps/tienda-api/wrangler.c1.jsonc`, `apps/tienda-sitio/wrangler.jsonc` y `apps/tienda-panel/wrangler.jsonc`; una prueba compara lo generado. La API va sin rutas ni workers.dev en los dos destinos, y el despacho y el panel llegan a ella por el binding `API_C1`. Su `api` en `celdas.json` es el panel, el único camino a ella. Cambió en tres puntos, por la premisa del plan gratuito (decisión del dueño del 6 oct 2026, bitácora tienda3 7): **staging vive en workers.dev** mientras no haya tiendas (las direcciones `<slug>--staging` llegan con los comercios de prueba, HU-T2.6); **producción no toma ningún hostname** hasta HU-T2.9; y **el bucket R2 y la cola no se crean todavía**: llegan con su primer uso, el horno (HU-T4.1) y la publicación en cola (HU-T4.3), porque no se declara lo que no existe (P1) y el token de despliegue hoy tiene prohibido R2 (HU-C11.5). Los KV de flags y `TIENDA_HOSTS` los crea el despliegue de HU-T2.4. Controles negativos: un shard `tienda_c2_s1` en c1, una base de control con el nombre de otro producto y una celda sin control)
- Como plataforma, quiero la celda `c1` de la Tienda con sus bases, bucket, KV y cola declarados en un solo archivo, y las configuraciones de los Workers generadas.
- **Respaldo:** TIENDA §3.1 y §5.6; PLATAFORMA §4.9 y §6.2.
- **CA1.** `celdas.json`: celda `c1` con producto `tienda` y la cuenta principal; shard `tienda_c1_s1`, `tienda_control`, R2 `tienda-c1`, KV `TIENDA_HOSTS` y de flags, y la cola `tienda-horno`; en staging y en producción.
- **CA2.** Las configuraciones de los tres Workers salen de ese archivo, nunca escritas a mano, y una prueba compara lo generado.
- **CA3 ❌.** Un shard que no sigue `tienda_c<N>_s<k>`, o un hostname de `laboratorio-digital.app` que no esté en `dominios.json`, hacen fallar la validación.
- **Consumo y kill switch:** los presupuestos de TIENDA §15.1; claves `ks:tienda*` (HU-T2.7).
- **Work items:** WI-T2.3.1 `[código]` · WI-T2.3.2 `[infra]` recursos de staging · WI-T2.3.3 `[prueba]`.

#### HU-T2.4 · Las tres apps y el despliegue a staging
- **Capa:** apps e infraestructura · **Prioridad:** Must · **Puntos:** 5 · **Sprint:** T1 · **Depende de:** HU-T2.3, la zona `laboratorio-digital.app` (dueño), HU-C11.2 si ya existe · **Estado:** En validación (rama `feat/t1-sprint`. `apps/tienda-api` (Hono): sin el secreto del despacho en `x-despacho` responde 404 a todo, como si no existiera; `GET /api/salud` mira el shard y la base de control y dice si la KEK se puede leer, nunca su valor. `apps/tienda-sitio`: el despacho resuelve la tienda por el `Host` en `TIENDA_HOSTS` con caché de 30 s, borra las cabeceras internas que llegan de afuera y pasa `/api/v1/*` a la API de la celda; un host sin tienda responde «Esta dirección no tiene tienda» (404). `apps/tienda-panel`: assets y el Worker solo en `/api/*`, con una portada «muy pronto» en el lenguaje de la galería. El despliegue tiene una parte nueva, `tienda` (`scripts/lib/celda-tienda.ts`): crea las bases, revisa `foreign_key_check` antes de migrar (CA4 de HU-T2.1), aplica las migraciones, copia los reservados de `dominios.json` a la base de control (CA3 de HU-T2.2), crea los KV de flags y de hosts, despliega los tres Workers con sus secretos por stdin y corre la prueba de humo: la salud de las dos bases por el panel, la portada, la página «sin tienda» y que la API **no** responda en workers.dev. Cambió en dos puntos: **staging vive en workers.dev** (las direcciones `<slug>--staging` llegan con HU-T2.6, bitácora tienda3 7) y **el paso de la Tienda no detiene la publicación de los demás productos** (`continue-on-error` hasta HU-T2.9): una Tienda sin tiendas no puede frenar al parqueadero, que tiene un cliente. Con varias celdas, el panel responde 503 hasta que el token diga cuál (HU-T2.8). Controles negativos: sin el secreto, con otro o con uno de más, 404; una cabecera `x-tienda` de afuera nunca llega a la API; el panel y la API con secretos distintos, 404; la API con workers.dev, falla del humo; reservar el nombre de una tienda existente, `slug-en-uso`)
- Como plataforma, quiero `tienda-sitio`, `tienda-panel` y `tienda-api` desplegados en staging con los caminos de TIENDA §3, para construir sobre algo que ya corre.
- **Respaldo:** TIENDA §3.1, §3.2 y §4.1; ED1 §3.10 (desvío declarado del despacho).
- **CA1.** `tienda-api` (Hono) con `workers_dev: false` y sin rutas: solo se llega por los bindings de servicio de `tienda-sitio` y `tienda-panel`, con `SECRETO_DESPACHO`.
- **CA2.** `tienda-panel` sirve solo assets, con `run_worker_first` únicamente en `/api/*`.
- **CA3.** Staging en `<slug>--staging.laboratorio-digital.app` y `panel--staging.laboratorio-digital.app`, con su prueba de humo. Si los límites por Worker (HU-C11.2) aún no existen, se declaran y se anota.
- **CA4 ❌.** Llamar a la API sin el binding responde 404, y una cabecera `x-tienda` que llega de afuera se ignora.
- **Patrones en riesgo:** P12, P16.
- **Work items:** WI-T2.4.1 `[código]` esqueletos · WI-T2.4.2 `[infra]` rutas y dominios generados · WI-T2.4.3 `[ci]` despliegue del producto `tienda` · WI-T2.4.4 `[prueba]` humo y el ❌ · WI-T2.4.5 `[dueño]` la zona `.app` (PLATAFORMA §9.5).

#### HU-T2.5 · La KEK y los secretos de la Tienda
- **Capa:** seguridad · **Prioridad:** Must · **Puntos:** 2 · **Sprint:** T1 · **Depende de:** HU-T2.3 · **Estado:** En validación, esperando al dueño (WI-T2.5.3) (rama `feat/t1-sprint`. El script se llama `scripts/tienda/generar-secretos.ts`, no `generar-kek.ts`: genera también `SECRETO_DESPACHO`, que HU-T2.4 necesita y que no puede nacer en el despliegue porque lo comparten tres Workers. La KEK va al portapapeles, nunca a la pantalla, y no se guarda en el ambiente hasta que el dueño confirma la copia en su gestor de contraseñas; después el portapapeles queda vacío. Lo que ya existe en el ambiente no se reemplaza. Corre en Windows con `clip` (P3). El despliegue los carga por stdin (HU-T2.4), y los dos están en ARQUITECTURA §7.5, que la prueba de secretos exige. Runbook: `docs/runbooks/secretos-de-la-tienda.md`. Controles negativos: responder «no», un equipo sin portapapeles, `gh` que no lee o no guarda, y secretos que ya existen: ninguno deja una KEK a medias ni en pantalla)
- Como dueño, quiero generar la llave maestra una vez, con una copia fuera de línea, para no perder nunca los datos cifrados de los comercios.
- **Respaldo:** TIENDA §14.2 y §14.6; P13; ARQUITECTURA §7.5.
- **CA1.** `scripts/tienda/generar-kek.ts` (Node, corre en Windows: P3) genera 32 bytes, los guarda en el ambiente de GitHub y pide confirmar la copia en el gestor de contraseñas antes de terminar. El despliegue la carga por stdin.
- **CA2.** `TIENDA_KEK_V1` y `SECRETO_DESPACHO` están en ARQUITECTURA §7.5, y la prueba de secretos lo exige.
- **CA3 ❌.** La KEK no se imprime nunca, ni en la consola ni en el resumen de Actions. Si el script no puede escribir en el ambiente, lo dice y no deja una KEK a medias.
- **Work items:** WI-T2.5.1 `[código]` · WI-T2.5.2 `[prueba]` · WI-T2.5.3 `[dueño]` generarla y guardar la copia.

#### HU-T2.6 · Los dos comercios de prueba, en local y en staging
- **Capa:** prueba · **Prioridad:** Must · **Puntos:** 3 · **Sprint:** T2 · **Depende de:** HU-T2.1, HU-C3.7 · **Estado:** En validación (rama `feat/t2-sprint`. Un solo fixture, `@ed1/tienda-schema/ensayos`: Ensayo Uno (ropa, talla y color, inventario, plan `entrada`) y Ensayo Dos (panadería, sin inventario, plan `gratis`, sin retracto por perecedero). De él salen la siembra del shard y de la base de control (idempotente), las entradas de `TIENDA_HOSTS` y las dos direcciones de staging del despacho, `ensayo-uno--staging` y `ensayo-dos--staging.laboratorio-digital.app`, como dominios propios del Worker de staging (P2). La API gana `GET /api/v1/tienda`, lo público por el despacho, y la prueba de humo de staging exige que cada comercio responda en su dirección con su nombre: el camino entero, Host → KV → despacho → API → shard. La regla de dominios acepta `<comercio de prueba>--staging`, que ninguna tienda puede tomar, y no el mismo nombre sin `--staging`. Los nombres de las dos tiendas reales están en los términos prohibidos (WI-T2.6.3: los puse yo desde la flota; el dueño puede sumar otros). CA3 a medias: la siembra nunca corre en producción (`ensayosDelDestino`), y la prueba de humo de producción que los busca llega con HU-T2.9. **Las organizaciones en el CORE de staging pasan a HU-T2.10**, con la aceptación de M0. Controles negativos: la siembra en producción es vacía; sin la cabecera del despacho, con un shard ajeno o con otra organización, la tienda no existe; `ensayo-uno` sin `--staging` no pasa la regla de dominios)
- Como plataforma, quiero dos comercios de prueba con datos distintos en cada prueba, para que nada funcione solo para el primero.
- **Respaldo:** TIENDA §16; P4; P11.
- **CA1.** **Comercio Ensayo Uno** (ropa: talla y color, inventario, pago en línea y dominio propio de prueba) y **Comercio Ensayo Dos** (panadería: sin inventario, solo WhatsApp, en el subdominio), con sus organizaciones en el CORE de staging.
- **CA2.** Las pruebas los toman de un solo fixture. Los nombres de las tiendas reales van a la lista de términos prohibidos.
- **CA3 ❌.** La siembra no corre en producción: la prueba de humo de producción falla si encuentra a cualquiera de los dos (HU-T2.9).
- **Work items:** WI-T2.6.1 `[código]` fixture y siembra · WI-T2.6.2 `[prueba]` · WI-T2.6.3 `[dueño]` los términos prohibidos.

#### HU-T2.7 · Presupuesto, kill switches y vigía de la Tienda
- **Capa:** operación · **Prioridad:** Must · **Puntos:** 2 · **Sprint:** T2 · **Depende de:** HU-C11.1, HU-C3.6 · **Estado:** En validación (rama `feat/t2-sprint`. Cambió en un punto, por el plan gratuito: el presupuesto no va en un `product.yaml` sino en `productos.json`, como el del parqueadero (P2: un solo lugar), con USD 1 y 5.000 filas escritas de D1 al día mientras no haya tiendas, y `al_agotarse` con el horno y el MCP. En el plan gratuito el vigía de la cuenta solo avisa; desde esta historia cuenta `tienda_control` como de la Tienda, no como «otras bases». Los cinco kill switches los crea el despliegue (HU-T2.4) y ya hacen algo: `ks:tienda` deja toda tienda en «Volvemos pronto» (503, sin caché) y la API en solo lectura; `ks:tienda:<org>` pausa una sola tienda. Los de cobros, MCP y horno quedan creados y se conectan con su historia. Runbook: `docs/runbooks/kill-switch.md`, con sus 2 minutos dichos (P7). Controles negativos: con `ks:tienda` apagado escribir da 503 y leer no; la pausa de una tienda no toca a la otra; un host sin tienda sigue en 404; el presupuesto nunca apaga `ks:tienda` ni `ks:tienda-cobros`)
- Como dueño, quiero saber cuánto cuesta la Tienda este mes y poder apagar una parte sin apagar la venta.
- **Respaldo:** TIENDA §15.1 y §15.2; ED1 §25.1; PLATAFORMA §9.1.
- **CA1.** `product.yaml` de la Tienda con los presupuestos de TIENDA §15.1 y su `usd_mes` (≤ 10, o lo que fije el dueño).
- **CA2.** `ks:tienda`, `ks:tienda:<org>`, `ks:tienda-cobros`, `ks:tienda-mcp` y `ks:tienda-horno`, creados por el despliegue, en el runbook, con sus 60 s de caché dichos (P7).
- **CA3 ❌.** Al 100 % del presupuesto, el vigía apaga el horno y el MCP, **nunca** la venta ni los avisos de Bold.
- **Work items:** WI-T2.7.1 `[código]` · WI-T2.7.2 `[prueba]` · WI-T2.7.3 `[doc]` `docs/runbooks/kill-switch.md` · WI-T2.7.4 `[dueño]` el presupuesto.

#### HU-T2.8 · La API de la Tienda verifica los tokens del CORE
- **Capa:** API y seguridad · **Prioridad:** Must · **Puntos:** 2 · **Sprint:** T2 · **Depende de:** HU-C4.1, HU-C4.3 · **Estado:** En validación (rama `feat/t2-sprint`. `/api/panel/v1/*` verifica con `@ed1/tokens` y las claves públicas del CORE, que el despliegue pone en `CORE_CLAVES` (las del CORE de staging en staging), sin llamarlo: `aud = tienda`, organización, rol, plan, `auth_time`, celda y shard salen del token. `GET /api/panel/v1/yo` dice a qué tienda llegó la sesión. La prueba estática `org-id-en-consultas` cubre la API de la Tienda con las tablas de su migración. **La aceptación de M0 con un token real del CORE de staging se movió a HU-T2.10**: la Tienda está pausada en el CORE, y emitir un token `aud = tienda` pide activarla solo en staging, que es trabajo del CORE. Controles negativos: tokens del agro, del parqueadero, vencido, firmado con otra clave, sin tienda, de otra celda y con un shard ajeno; una organización en la URL no cambia la tienda; la regla estática ve una consulta sin `org_id`)
- Como comercio, quiero que mi sesión del panel sirva solo para mi tienda.
- **Respaldo:** TIENDA §12.1 y §14.1; PLATAFORMA §4.6; ADR-10.
- **CA1.** El middleware de `/api/panel/v1/*` verifica con `@ed1/tokens`: `aud = tienda`, organización, rol, plan y `auth_time`.
- **CA2.** La prueba estática `org-id-en-consultas` cubre `apps/tienda-api`: el `org_id` sale del token o del Host resuelto por el despacho, nunca del cuerpo.
- **CA3 ❌.** Un token `aud = agro`, uno vencido o uno de otra organización reciben 401 o 403 con un motivo que el panel sabe mostrar («vuelve a entrar»).
- **Aceptación de M0:** el CORE de staging emite un token `aud = tienda` para Ensayo Uno y la API lo acepta.
- **Work items:** WI-T2.8.1 `[código]` · WI-T2.8.2 `[prueba]` contrato con tokens firmados de verdad (P17) · WI-T2.8.3 `[prueba]` `org_id`.

#### HU-T2.9 · La Tienda en producción, sin tiendas, con su prueba de humo
- **Capa:** despliegue · **Prioridad:** Must · **Puntos:** 2 · **Sprint:** T6 · **Depende de:** HU-T0.2, HU-T4.4, HU-T5.1 · **Estado:** En validación, esperando al dueño (WI-T2.9.3) (rama `feat/t6-sprint`. La versión sube a `0.1.0` al cerrar T6 y la fusión la despliega a producción. **Cambió:** en producción el despacho toma `origen.laboratorio-digital.app` y el panel `panel.laboratorio-digital.app`, los dos como dominios propios de sus Workers, que crean su registro DNS solos; el comodín `*.laboratorio-digital.app` pide un registro del dueño y llega con la primera tienda real (P1). `origen.`, sin tienda, responde «Esta dirección no tiene tienda» (CA1), y es el mismo origen de respaldo que Cloudflare for SaaS necesitará (TIENDA §4.1). La API dice en `/api/salud` su `ambiente` (variable generada por destino) y cuántos comercios de prueba hay en sus shards; la prueba de humo mira los dominios públicos en producción (CA2) y falla si el ambiente no es el del destino o si hay un comercio de prueba en producción (CA3). Controles negativos: una salud de staging en el despliegue a producción y dos comercios de prueba en producción ponen el humo en rojo. 15 oct 2026: la fusión etiquetó `tienda-v0.1.0`, pero el paso de la Tienda en el despliegue a producción terminó en error; con los secretos ya cargados, el despliegue a mano llegó hasta el humo, que buscaba la API en un dominio que no existe (bitácora tienda3 12 y 14). CA1 se cumple cuando el despliegue a producción termine en verde después de ese arreglo)
- Como dueño, quiero el camino a producción probado mucho antes de la primera tienda real, para que el día del corte no sea la primera vez.
- **Respaldo:** P16; bitácora agro, terreno («staging se despliega solo y producción no»; «un dominio en el Worker equivocado»).
- **CA1.** `tienda-v0.1.0` en producción: un hostname de `laboratorio-digital.app` sin tienda responde «Esta dirección no tiene tienda» (404), y `panel.laboratorio-digital.app` abre.
- **CA2.** La prueba de humo mira el dominio público, no solo staging.
- **CA3 ❌.** Falla si encuentra un comercio de prueba en producción, o si el destino, el dominio y el ambiente no coinciden.
- **Work items:** WI-T2.9.1 `[ci]` · WI-T2.9.2 `[prueba]` · WI-T2.9.3 `[dueño]` abrir el dominio público.

#### HU-T2.10 · La Tienda activa solo en staging, con las dos organizaciones de prueba
- **Capa:** CORE y prueba · **Prioridad:** Must · **Puntos:** 2 · **Sprint:** T3 · **Depende de:** HU-T2.6, HU-T2.8, HU-C3.7 (hecha) · **Estado:** En validación (rama `feat/t3-sprint`. CA1 y CA3: `productos-de-prueba.json` gana `activos_en_staging: ["tienda"]`, y una sola regla, `conActivosEnStaging` de `@ed1/productos`, la aplica al catálogo de staging del CORE y a la base de staging del despliegue; en producción nada cambia, y una prueba lo exige. Solo se activa un producto de verdad que esté pausado. **CA2 y la aceptación de M0 pasan a HU-T8.1**: para que el CORE emita un token `aud = tienda`, alguien tiene que entrar desde el origen de la Tienda, que es el panel, y la pantalla de entrar del panel es HU-T8.1. Con la Tienda activa en staging, el dueño podrá crear allí su tienda de prueba al entrar. Controles negativos: el CORE de producción responde «pausado»; activar el agro, que ya está activo, o un producto que no existe falla. **CA2, en T7 (rama `feat/t7-sprint`):** el paso «Desplegar el CORE» de staging crea las dos organizaciones con los ids del fixture en la celda c1 y su shard (`ensayosEnElCore`, `scripts/lib/celda-tienda.ts`), sin pisar una que ya exista, y hace propietario de las dos al correo de `TIENDA_CORREO_DUENO_STAGING` si ya tiene cuenta en ese CORE; después lee lo que quedó y lo dice. La prueba corre el SQL contra la base del CORE de verdad, con el catálogo y el directorio del mismo despliegue. Controles negativos: comparar el correo sin pasarlo a minúsculas y pisar el plan de una organización que ya existe; un correo con comillas o `$(` no llega al SQL)
- Como dueño, quiero que el CORE de staging emita un token de la Tienda para Ensayo Uno, para probar el panel con una sesión de verdad sin abrir la Tienda en producción.
- **Respaldo:** HU-T2.2 (la Tienda pausada); HU-C3.7 (productos que solo existen en staging); TIENDA §12.1.
- **CA1.** `productos-de-prueba.json` puede activar en staging un producto que en producción está pausado; el catálogo del CORE de staging y su base lo dicen igual (P2). Producción sigue igual.
- **CA2.** Las organizaciones de Ensayo Uno y Ensayo Dos existen en el CORE de staging, en la celda c1 y su shard, con los ids del fixture de HU-T2.6.
- **CA3 ❌.** Con la Tienda activa en staging, el CORE de producción sigue respondiendo «pausado» para la Tienda: una prueba lo exige.
- **Aceptación de M0:** el CORE de staging emite un token `aud = tienda` para Ensayo Uno y `GET /api/panel/v1/yo` del panel de staging lo acepta.
- **Work items:** WI-T2.10.1 `[código]` activar en staging · WI-T2.10.2 `[código]` las organizaciones de prueba · WI-T2.10.3 `[prueba]` · WI-T2.10.4 `[dueño]` entrar con su cuenta y probarlo.

### ET3 · Diseño de la Tienda

#### HU-T3.1 · La dirección visual en la galería: seis pantallas clave
- **Capa:** diseño · **Prioridad:** Must · **Puntos:** 3 · **Sprint:** T0 · **Depende de:** HU-C6.1 y HU-C6.2 (hechas) · **Estado:** Fusionada en el PR #107 (6 oct 2026), esperando la elección del dueño (D-T2) (`packages/ui/galeria-tienda/`: 8 páginas (índice, portada «Editorial» y «Catálogo», ficha, carrito, seguimiento, bandeja y detalle de un pedido contra entrega) y dos hojas, sobre los tokens de `@ed1/ui` v2. Se abren sin servidor, o con la configuración `galeria-tienda` de `.claude/launch.json`. La serif de «Editorial» se ve con las del sistema: la definitiva se elige en D-T2, sin descargar nada antes. Revisadas en el navegador a 375 y 1280 px; la revisión encontró y arregló dos cosas: la etiqueta de la portada no se leía sobre la foto oscura, y el nombre de la tienda chocaba con «Buscar» en el teléfono. `tests/repo/tienda-galeria.test.ts`, 13 pruebas: sin scripts, estilos en línea ni terceros, `noindex`, HTML < 50 KB, CSS ≤ 20 KB con gzip y el contraste de cada acento calculado. Control negativo: un acento bronce claro (#c08a4a) no pasa 4,5:1 y la prueba se ve en rojo)
- Como dueño, quiero ver la vitrina y el panel antes de construirlos, para aprobar la dirección con las referencias delante.
- **Respaldo:** §5 de este documento; pedido del dueño (Porsche y Tracksmith); ADR-29.
- **CA1.** Prototipos estáticos (HTML y CSS, sin datos reales) a 360 y 1280 px con los dos comercios de prueba: portada «Editorial» y «Catálogo», ficha con variantes, carrito con resumen y aceptación, seguimiento, bandeja de pedidos y el detalle de un pedido contra entrega.
- **CA2.** Los dos estilos tipográficos de §5.3 lado a lado, y cada prototipo dice su peso frente a los presupuestos de §5.6.
- **CA3 ❌.** Ningún contenido necesita JavaScript para leerse y ningún texto nace con opacidad 0.
- **CA4.** Viven con `noindex` en la galería del sistema de diseño (HU-C6.4) o, mientras no exista, como archivos estáticos que el dueño abre con un comando. El dueño elige, y la decisión queda en D-T2.
- **Patrones en riesgo:** P20, P4.
- **Work items:** WI-T3.1.1 `[diseño]` · WI-T3.1.2 `[código]` prototipos · WI-T3.1.3 `[dueño]` revisión con las referencias abiertas.

#### HU-T3.2 · Los temas: el del panel y el de cada vitrina, como dato
- **Capa:** diseño · **Prioridad:** Must · **Puntos:** 3 · **Sprint:** T3 · **Depende de:** HU-T3.1, HU-T1.4 · **Estado:** En validación (rama `feat/t3-sprint`. El panel: `@ed1/ui` v2 gana el acento `cobre` y el tema `tienda`, y la portada del panel deja su copia del color (P2). La vitrina: `@ed1/tienda-horno` (`tema.ts`) genera `tema-<huella>.css` con solo variables (acento, texto sobre el acento, tinta, proporción de las fotos y, en el modo del teléfono, su versión oscura). El contraste se calcula con `contraste()` del sistema de diseño contra sus superficies. Los ocho acentos del panel son tinta, cobre, bosque, vino, océano, ciruela, oliva y arcilla, y pasan 4,5:1 en claro y en oscuro. Un color libre que no se lee se rechaza con `AcentoIlegible`, que dice la razón y el color más cercano que sí pasa. El tono para el modo oscuro sí se deriva, porque el comercio elige uno, y el panel lo mostrará. El estilo tipográfico («precisión» o «editorial») va como `data-estilo`; sus fuentes esperan D-T2. Nada viene de la apariencia de la 2.0 (§5). Controles negativos: un amarillo sobre blanco y un acento oscuro en una tienda solo oscura se rechazan)
- Como comerciante, quiero elegir el color y el estilo de mi tienda sin que se vuelva ilegible; como plataforma, que eso sea un dato y nunca un archivo del comercio.
- **Respaldo:** TIENDA §5.7 (`apariencia`) y §10.1 (`/tema-<huella>.css`); ADR-29 (tema por producto); P2.
- **CA1.** `@ed1/ui` v2 gana el tema `tienda` para el panel. La vitrina genera `tema-<huella>.css` desde `apariencia`: acento, tinta (negra o azul), estilo tipográfico, portada, proporción de las fotos y modo.
- **CA2.** Al guardar, el contraste del acento y de su texto se **calcula** contra la superficie en claro y en oscuro y exige 4,5:1. El panel ofrece 8 acentos ya validados y un color libre que se valida igual.
- **CA3 ❌.** Un acento que no pasa se rechaza diciendo por qué y cuál pasaría; nunca se ajusta en silencio. Ningún estilo va en línea: la CSP lo ignoraría sin avisar (bitácora agro, terreno).
- **Work items:** WI-T3.2.1 `[diseño]` paleta de acentos · WI-T3.2.2 `[código]` generador del tema · WI-T3.2.3 `[prueba]` contraste calculado.

#### HU-T3.3 · La tipografía de la vitrina y del panel
- **Capa:** diseño · **Prioridad:** Should · **Puntos:** 2 · **Sprint:** T4 (era T2; esperó D-T2) · **Depende de:** D-T2, HU-C6.2 · **Estado:** En validación (rama `feat/t4-sprint`. D-T2 decidida el 13 oct 2026: Geist y Geist Mono, las del ecosistema, sin serif; CA1 cambió en eso. `scripts/armar-vitrina.ts` arma `/_t/<release>/` con los tokens y las fuentes de `@ed1/ui` v2 en una sola hoja (P2), las fuentes con su licencia y la isla de la vitrina sin tipos; `<release>` es la huella del contenido. Esos archivos son assets del despacho y no ejecutan el Worker (`run_worker_first: ["/*", "!/_t/*"]`). Las dos fuentes pesan 57 KB en total, cada una menos de 30 KB, con `font-display: swap` y respaldos con `size-adjust` de 104,8 % y 100 %. Controles negativos: una fuente de más de 35 KB, un `url(https:…)`, un `@import` o una `font-family` que no sea un token ponen la prueba en rojo)
- Como comprador, quiero que la tienda tenga carácter sin que tarde más en abrir.
- **Respaldo:** §5.3; ADR-29; bitácora core 5 (métricas del respaldo); bitácora ecommerce 84 (sin fuentes de terceros).
- **CA1.** Con D-T2 (a): Geist y Geist Mono del CORE, sin otra copia (P2), y para «Editorial» una serif OFL recortada al español con su licencia al lado; servidas desde `/_t/<release>/` con `font-display: swap` y un respaldo con `size-adjust`.
- **CA2.** Solo se precarga la display; el total de fuentes por página de la vitrina es de 70 KB o menos.
- **CA3 ❌.** Una fuente de más de 35 KB, una solicitud a un dominio de fuentes de terceros o un `size-adjust` fuera de 95–115 % ponen la prueba en rojo.
- **Work items:** WI-T3.3.1 `[código]` recorte · WI-T3.3.2 `[prueba]` peso, licencia y respaldo · WI-T3.3.3 `[dueño]` D-T2.

#### HU-T3.4 · Los componentes de la vitrina
- **Capa:** diseño · **Prioridad:** Must · **Puntos:** 5 · **Sprint:** T4 · **Depende de:** HU-T3.2 · **Estado:** En validación (rama `feat/t4-sprint`. `apps/tienda-sitio/vitrina/vitrina.css`, sobre los tokens del ecosistema: franja con «Buscar», tarjetas con la foto en la proporción de la tienda, la ficha con su elección en píldoras (lo agotado tachado), el botón principal, la barra del pedido, la búsqueda y el estado vacío. El horno escribe ese HTML, y la isla (`@ed1/tienda-horno/src/vitrina/`) lo mejora: `seleccion.ts`, pura y probada, decide el botón («Elige talla», «Agotada», «Agregar al pedido») y qué se tacha; `vitrina.ts` lo conecta, y al tocar el botón con algo faltando lleva al campo. La elección no se guarda (CA3). «Agregar al pedido» suma a una lista en el teléfono; el pedido llega con HU-T5.2 y HU-T6.1. **Lo que falta:** la galería con `srcset` espera las fotos (HU-T8.3), «Avísame» espera HU-T6.5, y la revisión con axe en el navegador va con las e2e de la vitrina (HU-T3.6). Controles negativos: una combinación agotada o que no existe nunca queda «lista»; nada táctil mide menos de 48 px)
- Como comprador en un teléfono barato, quiero entender el producto, elegir y pedir sin tropezar.
- **Respaldo:** §5.3 y §5.4; bitácora ecommerce, crítico «El botón de WhatsApp se apagaba sin decir por qué», y 53; bitácora agro, terreno («un aviso fuera de la vista…»).
- **CA1.** Tarjeta de producto, galería con `srcset`, selector de variantes (píldoras y muestras de color, lo agotado tachado y con «Avísame»), precio en cifras tabulares, barra fija del carrito, franja superior y pie legal; y los estados cargando, vacío y error.
- **CA2.** El botón principal deshabilitado dice qué falta («Elige una talla») y tocarlo lleva al campo.
- **CA3.** La elección de la ficha vale solo mientras la ficha está abierta: la tarjeta muestra lo del producto, no la última combinación mirada (bitácora ecommerce 53).
- **CA4 ❌.** El estado «vacío» no se puede mostrar mientras se carga; ningún objetivo táctil mide menos de 48 px.
- **Work items:** WI-T3.4.1 `[diseño]` · WI-T3.4.2 `[código]` componentes e islas · WI-T3.4.3 `[prueba]` estados y axe.

#### HU-T3.5 · Los componentes del panel
- **Capa:** diseño · **Prioridad:** Must · **Puntos:** 5 · **Sprint:** T7 · **Depende de:** HU-T3.2, HU-C6.3 · **Estado:** En validación (rama `feat/t7-sprint`. El panel es una PWA de Preact con Vite, como el cuaderno, sobre los tokens y componentes de `@ed1/ui` v2 (CA2): la hoja propia (`apps/tienda-panel/src/app/panel.css`) solo usa tokens. Componentes de la Tienda en `src/app/componentes/`: la barra con la tienda y el rol, la navegación (abajo a 360 px, al lado en escritorio), la lista que es tarjetas en el teléfono y tabla en escritorio (sobre `Contenido` de ui), el estado de un pedido con texto y color (uno desconocido sale neutro con su nombre), el dato tapado (el valor completo nunca llega al HTML), `validarTodo` y `Confirmar`. Todos están en `/_galeria/`, con una tienda llena de 300 pedidos. Control negativo: pintar el dato sin tapar)
- Como comerciante que trabaja desde el teléfono, quiero que el panel sea rápido y claro con 300 pedidos, no solo con tres.
- **Respaldo:** §5.5; BACKLOG_CORE §4.5; bitácora ecommerce 62; bitácora agro 16 y terreno («una pantalla vacía no enseña lo que una llena sí»).
- **CA1.** Navegación inferior a 360 px y lateral en escritorio; lista que es de tarjetas en el teléfono y tabla en escritorio; estados con texto y color; datos tapados; formularios con todos sus errores en una vuelta; confirmación de lo irreversible; aviso en la vista de la acción.
- **CA2.** Reusa los componentes base de `@ed1/ui` v2 y solo agrega los de la Tienda.
- **CA3 ❌.** Con 300 pedidos a 360 px, nada hace la página más ancha que el teléfono.
- **Work items:** WI-T3.5.1 `[diseño]` · WI-T3.5.2 `[código]` · WI-T3.5.3 `[prueba]` e2e con una tienda llena.

#### HU-T3.6 · Presupuestos y CSP de la Tienda en el CI
- **Capa:** CI · **Prioridad:** Must · **Puntos:** 3 · **Sprint:** T6 · **Depende de:** HU-T5.2, HU-C6.6 · **Estado:** En validación (rama `feat/t6-sprint`. **Cambió la herramienta:** sin Lighthouse CI, que pedía otro navegador y más minutos; `tests/e2e/tienda-presupuestos.spec.ts` mide lo horneado de Ensayo Uno con Playwright, como la cuenta (HU-C6.6): por página (portada, ficha, colección, carrito, pedido y un texto legal) JS ≤ 60 KB y hoja ≤ 20 KB con gzip, la portada ≤ 50 KB de HTML, y el LCP de la portada y la ficha ≤ 2,5 s con 4G lenta y CPU ×4, en `@rendimiento`, solo y con la mediana de tres (CA4). La CSP sale del horno (`@ed1/tienda-horno/csp`), la usa el despacho y la prueba compara cada recurso que la página carga con lo que ella permite (CA2). La compuerta rechaza un `<style>`, un `style=`, un `on…=`, un script en línea que no sea datos y un script o una hoja de afuera, y una portada de más de 50 KB (CA3, con la página, la cifra y el tope). Los presupuestos del panel llegan con sus pantallas (HU-T8.1). TIENDA §1.3 lleva la nota)
- Como dueño, quiero que el CI rechace una vitrina que se pase de peso o de tiempo, para cumplir la promesa de abrir en un teléfono barato.
- **Respaldo:** TIENDA §1.3 y §11.9; §5.6.
- **CA1.** Lighthouse CI sobre lo horneado de los dos comercios con los topes de §5.6, y los del panel sobre sus pantallas.
- **CA2.** La CSP de cada tienda sale del horno, y una prueba compara lo declarado con lo que la página carga de verdad (como la e2e del cuaderno).
- **CA3 ❌.** Un script de un tercero no declarado, un `<style>` en línea o pasarse de un tope ponen el CI en rojo, con la cifra y el tope.
- **CA4.** Las mediciones de tiempo corren solas y con repeticiones; un intermitente se arregla o se quita (P19).
- **Work items:** WI-T3.6.1 `[ci]` · WI-T3.6.2 `[prueba]` · WI-T3.6.3 `[doc]` los topes confirmados en §5.6.

#### HU-T3.7 · La revisión de diseño con la tienda llena
- **Capa:** diseño y prueba · **Prioridad:** Should · **Puntos:** 2 · **Sprint:** T11 · **Depende de:** HU-T8.2, HU-T9.1 · **Estado:** En validación (rama `feat/t11-sprint`. CA1: `packages/tienda-schema/src/volumen.ts` siembra 2.000 productos de 6 combinaciones, 10 colecciones «De lino»… y 300 pedidos del mes en los 8 estados, sin datos de nadie; volver a sembrar no duplica. `scripts/tienda/sembrar-volumen.ts` solo acepta `--destino local` o `staging`, y el flujo manual «sembrar-volumen-tienda» llena staging. CA3: `apps/tienda-api/src/volumen.test.ts` publica la tienda llena por la misma ruta de la cola, pasa la compuerta en menos de un minuto y ninguna consulta pasa de 100 parámetros; el tablero, la bandeja, productos, inventario y solicitudes responden. La tienda llena encontró que la portada pesaba 434 KB contra 50 y la compuerta no la dejaba publicar (bitácora tienda3 20): la portada muestra 24 y «Ver los N productos», y `/productos/` y cada colección van de a 48 por página. Control negativo: con 5.000 por página, la prueba de 2.000 productos con foto y la de publicar quedan en rojo con el peso de la portada. WI-T3.7.3, el recorrido del dueño: `docs/runbooks/tienda-revision-con-la-tienda-llena.md`. *(Hoy, 16 oct 2026: el dueño hizo el recorrido en staging; lo demás funcionó y salieron dos hallazgos, arreglados en la rama `fix/tienda-llena`. El panel tardaba con productos, colecciones e inventario, y una colección perdía los productos que no se veían al guardar: van de a 50 con total y búsqueda (bitácora tienda3 21). La tienda llena no se publicó porque sus productos no tenían foto, y la prueba de publicar se saltaba las fotos: la siembra les pone la que el comercio ya subió, y la prueba publica sin saltarse nada (bitácora tienda3 22). Falta que el dueño vuelva a sembrar y publique.)*)
- Como dueño, quiero ver la vitrina y el panel con 2.000 productos y 300 pedidos antes de cargar una tienda real.
- **Respaldo:** bitácora agro, terreno («una pantalla vacía no enseña lo que una llena sí»); TIENDA §10.3 (2.000 productos).
- **CA1.** Una siembra de volumen para Ensayo Uno (2.000 productos de 6 variantes y 300 pedidos del mes en todos los estados), solo en local y staging.
- **CA2.** El dueño recorre una lista dada a 360 px; lo que encuentre entra como arreglo o como historia, con su entrada en la bitácora.
- **CA3 ❌.** Esa tienda se hornea dentro del tiempo de la cola, y sus presupuestos siguen en verde.
- **Work items:** WI-T3.7.1 `[código]` siembra · WI-T3.7.2 `[prueba]` · WI-T3.7.3 `[dueño]` el recorrido.

### ET4 · Horno y publicación

#### HU-T4.1 · `@ed1/tienda-horno`: la tienda en bytes deterministas
- **Capa:** paquete · **Prioridad:** Must · **Puntos:** 5 · **Sprint:** T3 · **Depende de:** HU-T1.1, HU-T1.4, HU-T3.2 · **Estado:** En validación (rama `feat/t3-sprint`. `hornear()` produce la portada, una ficha por producto y una página por colección con su gemelo `.md`, `catalogo.json`, `catalogo.md`, `sitemap.xml`, `robots.txt` con las señales para agentes y el tema. Lleva JSON-LD (`Organization`, `WebSite` con `SearchAction`, `Product` con un `Offer` por variante y `BreadcrumbList`), Open Graph y, en la portada, la verificación de Google (HU-T14.8). `manifiesto()` da la huella SHA-256 de cada archivo y del conjunto, con WebCrypto. Sin reloj, ni azar, ni `Intl`: la guardia de paquetes puros lo exige también al horno. Archivos dorados de los dos comercios de prueba en `packages/tienda-horno/dorados/`, que se aceptan a propósito con `ACTUALIZAR_DORADOS=1`. CA2, la parte de workerd: como con los paquetes de T0, la guardia ataca la causa; la ejecución real llega cuando la API hornee (HU-T4.3). Controles negativos: una frase entre corchetes y una descripción «undefined» no llegan al HTML; un nombre con `</script>` sale escapado también dentro del JSON-LD; la tienda de Ensayo Dos no nombra a Ensayo Uno)
- Como comprador, buscador o agente, quiero leer la tienda entera sin ejecutar JavaScript.
- **Respaldo:** TIENDA §10.1, §10.4 y §11.7; bitácora ecommerce 31; P17, P20.
- **CA1.** Funciones puras que producen portada, colecciones y fichas con su gemelo `.md`, `catalogo.json` y `catalogo.md`, el sitemap, JSON-LD (`Product` con `Offer` por variante, `BreadcrumbList`, `Organization` y `WebSite` con `SearchAction`) y Open Graph.
- **CA2.** Los mismos datos dan los mismos bytes en Node y en workerd: claves ordenadas, sin reloj, ni azar, ni `Intl`. El `lastmod` del sitemap sale del dato (`actualizado`), nunca del reloj del horno.
- **CA3.** Archivos dorados de los dos comercios de prueba.
- **CA4 ❌.** Un dato entre corchetes, vacío o `undefined` no llega al JSON-LD ni al HTML: se omite o detiene la compuerta (bitácora ecommerce 31). Todo texto con el nombre del comercio sale de sus datos (bitácora ecommerce, crítico «el pedido lo confirmaba otro comercio»).
- **Lo publicado (P10):** cada versión del sitio guarda la versión del horno que la hizo (HU-T4.6).
- **Work items:** WI-T4.1.1 `[código]` · WI-T4.1.2 `[prueba]` dorados · WI-T4.1.3 `[prueba]` dos runtimes.

#### HU-T4.2 · Lo que escribe el comercio no se ejecuta
- **Capa:** seguridad · **Prioridad:** Must · **Puntos:** 2 · **Sprint:** T3 · **Depende de:** HU-T4.1 · **Estado:** En validación (rama `feat/t3-sprint`. `escapar.ts` de `@ed1/tienda-horno`: todo texto se escapa, y la descripción es Markdown sin HTML (párrafos, negrita, cursiva, listas y enlaces) con solo `https`, `mailto`, `tel` y `wa.me`. Un corpus de 14 cargas XSS sale inerte por las dos vías, y el control negativo corre el mismo corpus sin escapar y lo ve peligroso)
- Como comprador, quiero que una descripción no pueda robarme nada.
- **Respaldo:** TIENDA §14.1 (XSS guardado).
- **CA1.** Markdown sin HTML; solo se permiten enlaces `https`, `mailto`, `tel` y `wa.me`; todo se escapa al hornear.
- **CA2 ❌.** Un corpus de cargas XSS en descripciones, páginas y nombres sale inerte; con el escapado quitado, la prueba se ve en rojo.
- **Work items:** WI-T4.2.1 `[código]` · WI-T4.2.2 `[prueba]` corpus.

#### HU-T4.3 · La compuerta de publicación, con todas las fallas a la vez
- **Capa:** horno · **Prioridad:** Must · **Puntos:** 3 · **Sprint:** T4 · **Depende de:** HU-T4.1 · **Estado:** En validación (rama `feat/t4-sprint`. `compuerta()` de `@ed1/tienda-horno` corre sobre lo horneado de esa tienda y devuelve todas las fallas a la vez, cada una con qué hacer y en qué pantalla, en palabras. Usa `faltantes()` de `@ed1/tienda-schema` para la ficha legal y el WhatsApp verificado. Mira el texto visible (`[`, `{{`, `undefined`, `NaN`), al menos un producto activo con precio y foto, el motivo de lo que no admite retracto, los envíos de más de 30 días, el enlace a la SIC en el pie (el pie lo trae desde ahora), el peso de cada página y los enlaces internos. El pago en línea detiene mientras el cobro no exista (M3). **Pendiente, dicho en el código:** el enlace a las solicitudes en el pie llega con HU-T7.1, y el validador de HTML con HU-T3.6. `omitir` nombra las comprobaciones que se saltan, solo para los comercios de prueba de staging mientras no tengan fotos. Controles negativos: cada dato legal que falta, uno por uno; un WhatsApp sin verificar; un corchete público; un producto sin foto; uno sin retracto ni motivo; un enlace roto y un pie sin la SIC)
- Como comerciante, quiero saber de una vez todo lo que me falta para publicar, en palabras.
- **Respaldo:** TIENDA §10.2; P11 y P15; Ley 1480 art. 50 lit. a.
- **CA1.** Las 9 comprobaciones de TIENDA §10.2, sobre lo horneado **de esa tienda**, no sobre la suite (P11). La del pie legal se completa con HU-T7.1.
- **CA2.** La respuesta trae todas las fallas, cada una con qué hacer y dónde (§5.7).
- **CA3 ❌.** Cada dato legal que falta, un corchete público, un WhatsApp sin verificar o un producto activo sin foto detienen la publicación: la prueba los pone uno por uno.
- **Work items:** WI-T4.3.1 `[código]` · WI-T4.3.2 `[prueba]`.

#### HU-T4.4 · Publicar es hornear en cola, con manifiesto y huellas
- **Capa:** horno e infraestructura · **Prioridad:** Must · **Puntos:** 5 · **Sprint:** T4 · **Depende de:** HU-T4.3, HU-T2.3 · **Estado:** En validación (rama `feat/t4-sprint`. `apps/tienda-api/src/publicar.ts` hace los pasos de TIENDA §10.3: reserva la versión (el índice único deja una sola en curso), lee la tienda en siete consultas, hornea, pasa la compuerta, sube solo los objetos nuevos por huella, guarda y **relee** el manifiesto, y solo al final apunta `TIENDA_HOSTS` y `version_publicada`. Sin cambios, «Nada cambió» y la versión reservada se borra. `POST /api/panel/v1/publicar` lo pide con la matriz de permisos y `ks:tienda-horno` lo pausa. **Cambió en un punto, por el plan gratuito: sin cola todavía**; publica en la misma solicitud, porque una tienda pequeña cabe en ella, y el consumidor de la cola llamará a la misma función cuando el tamaño de una tienda lo pida (bitácora tienda3 7). En staging, el despliegue publica a los dos comercios de prueba por `POST /api/ensayo/publicar` (solo con `ENSAYOS=1` y el secreto del despacho en `x-ensayo`), y la prueba de humo exige sus portadas servidas desde R2; la única comprobación que se les omite son las fotos, hasta HU-T8.3. Los buckets `tienda-c1` y `tienda-c1-staging` los creó el dueño el 14 oct 2026. Controles negativos: un almacén que falla a la mitad deja la publicación `fallida` y la tienda en la versión anterior, con el KV intacto (prueba de caos); la compuerta detiene sin subir nada; una segunda publicación en curso responde 409; un rol fuera de la matriz, 403; con `ks:tienda-horno`, 503; sin almacén configurado, 503 y no finge publicar; la ruta de los ensayos no existe sin `ENSAYOS` o con otro secreto)
- Como comerciante, quiero publicar sin miedo: si algo falla, mi tienda sigue como estaba.
- **Respaldo:** TIENDA §10.3; P16 y P21.
- **CA1.** Los 9 pasos de TIENDA §10.3: una sola publicación en curso por tienda, objetos por huella (solo los nuevos), manifiesto con la huella del conjunto, verificación releyéndolo, puntero en el KV y `version_publicada`.
- **CA2.** Sin cambios, «Nada cambió» y ninguna versión nueva.
- **CA3 ❌.** Un horno que falla a la mitad deja la publicación `fallida` con su motivo, y la tienda sigue sirviendo la versión anterior (prueba de caos).
- **Consumo y kill switch:** clase A de R2 solo por los archivos nuevos (unos 6 al cambiar un precio); `ks:tienda-horno`.
- **Work items:** WI-T4.4.1 `[código]` cola y consumidor · WI-T4.4.2 `[prueba]` caos · WI-T4.4.3 `[doc]` ARQUITECTURA §5.

#### HU-T4.5 · Re-horneado mínimo cuando algo se agota
- **Capa:** horno · **Prioridad:** Should · **Puntos:** 2 · **Sprint:** T9 · **Depende de:** HU-T4.4, HU-T8.5 · **Estado:** En validación (rama `feat/t9-sprint`. Publicar guarda junto al manifiesto lo que horneó (`datos.json`). Cuando un ajuste de inventario o un pedido confirmado deja una combinación en 0 o la saca de 0, `apps/tienda-api/src/publicar.ts` (`rehornearExistencias`) vuelve a hornear esa misma versión con las existencias de ahora, después de responder y sin bloquear al comercio; nada más cambia. Con el interruptor `ks:tienda-horno` apagado no re-hornea y lo deja en el log. Controles negativos: sin la regla de cruzar el 0, un cambio que no agota ni repone re-hornea; sin mirar el interruptor, re-hornea con el horno apagado; publicar en vez de re-hornear sube lo que nadie ha publicado. La prueba lee la disponibilidad de cada combinación en los datos para buscadores de la ficha horneada)
- Como comprador, quiero que Google, los agentes y la ficha no me ofrezcan lo que ya no hay.
- **Respaldo:** TIENDA §7.4 («Existencias en la vitrina»).
- **CA1.** Una variante que pasa de disponible a agotada, o al revés, encola el re-horneado de su ficha, el catálogo y los feeds.
- **CA2 ❌.** Con `ks:tienda-horno` apagado, la cotización igual impide vender lo que no hay.
- **Work items:** WI-T4.5.1 `[código]` · WI-T4.5.2 `[prueba]`.

#### HU-T4.6 · Re-horneado por anillos cuando cambia el horno
- **Capa:** horno y despliegue · **Prioridad:** Must · **Puntos:** 3 · **Sprint:** T14 · **Depende de:** HU-T4.4, HU-T0.2 · **Estado:** En validación (rama `feat/t14-sprint`. Se encontró que cada despliegue reemplazaba los assets del despacho por la release nueva: una página horneada con la anterior se quedaba sin estilos ni JavaScript. CA2 y CA3: el despliegue sube su release al almacén de la celda (`POST /api/despliegue/vitrina`, con el secreto del despacho) y el despacho sirve desde ahí la que ya no tiene en sus assets, con caché inmutable; `releases-viejas` la borra a los 90 días si ninguna versión publicada la usa. CA1: `rehornear-por-release`, cada hora, re-hornea lo publicado (`rehornearExistencias`) del anillo 1 primero y del resto pasadas 24 h sin fallas, de a 3 tiendas por shard; una falla detiene la ronda y avisa. La 0012 guarda la release de cada versión publicada y el anillo de la tienda, que llega del CORE en el token. Runbook: `docs/runbooks/tienda-volver-atras-el-codigo.md`. La prueba usa dos releases: la portada horneada con la vieja carga sus archivos por el despacho después de desplegar la nueva. Controles negativos: una release que no se subió y una ruta con `..` dan 404; con una falla en el anillo 1, el resto no recibe la release)
- Como comerciante, quiero que una versión nueva de la plataforma nunca tumbe todas las tiendas a la vez.
- **Respaldo:** TIENDA §1.3 y §10.6; P10.
- **CA1.** Una release nueva re-hornea el anillo 1 (las tiendas piloto) y, después de 24 h sin errores, el resto en tandas por la cola.
- **CA2.** Los assets comunes de una release (`/_t/<release>/`) se conservan 90 días.
- **CA3 ❌.** Una página horneada con la release anterior sigue cargando sus scripts después de desplegar la nueva: la prueba usa dos releases.
- **Lo publicado (P10):** es justo esta historia.
- **Work items:** WI-T4.6.1 `[código]` · WI-T4.6.2 `[prueba]` · WI-T4.6.3 `[doc]` runbook «volver atrás una versión del código».

### ET5 · Vitrina pública

#### HU-T5.1 · El despacho: la tienda por su `Host`, sin tocar la base
- **Capa:** Worker · **Prioridad:** Must · **Puntos:** 5 · **Sprint:** T3 · **Depende de:** HU-T2.4, HU-T4.1 · **Estado:** En validación (rama `feat/t3-sprint`. El despacho sirve las páginas desde el almacén de la celda (`SITIOS`): el manifiesto de la versión publicada, que no cambia y se guarda en memoria, da la huella de cada ruta, y el archivo es `objetos/<hh>/<huella>`, como dice TIENDA §5.6. Con `Accept: text/markdown`, el gemelo y `Vary: Accept`; sin la barra final, 301 a la ruta con barra. Lleva las cabeceras de la vitrina: CSP sin nada en línea, HSTS sin `includeSubDomains`, `nosniff` y `Referrer-Policy`. `/api/*`, `/mcp` y `/_m` pasan a la API y nunca se redirigen. Una tienda sin versión publicada dice «Esta tienda todavía no abre», y un error al leer el KV ya no se guarda en la caché (P7). **Falta el almacén de verdad**: el bucket R2 espera la decisión del dueño (bitácora tienda3 7); hasta entonces, una tienda publicada sin almacén responde 503 y lo registra, y los comercios de prueba siguen sin versión publicada. La prueba de punta a punta hornea a Ensayo Uno, lo guarda en un almacén de mentira y lo sirve por el despacho con el shard como trampa: si alguien le habla, falla. CA4 (menos de 2 ms de CPU) se mide en HU-T11.10. Controles negativos: una ruta que no está, una tienda sin publicar, sin almacén, el KV que falla y un POST a una página)
- Como plataforma, quiero que una visita cueste una ejecución de un milisegundo y cero consultas a la base.
- **Respaldo:** TIENDA §3.3 y §11.1; ED1 §3.10 (desvío declarado).
- **CA1.** `Host` → caché en memoria de 30 s → KV → manifiesto → caché del borde o R2, con la versión en la clave de caché; el gemelo Markdown con `Accept: text/markdown` y `Vary: Accept`; las cabeceras del manifiesto (CSP, HSTS sin `includeSubDomains` en los dominios de comercios, `nosniff`, `Referrer-Policy`).
- **CA2.** Un hostname sin tienda responde 404 «Esta dirección no tiene tienda»; con el kill switch, la página de tienda cerrada con 503 y `Retry-After`; `/api/*`, `/mcp` y `/_m` pasan al binding y nunca se redirigen.
- **CA3 ❌.** Una prueba con un D1 que falla si se le habla recorre todas las páginas: cero consultas. Un error al leer el KV no se guarda en la caché (P7).
- **CA4.** La CPU se mide en la prueba de carga (HU-T11.10): menos de 2 ms por página.
- **Consumo y kill switch:** una ejecución por página, incluida en Workers Paid; `ks:tienda` y `ks:tienda:<org>`.
- **Work items:** WI-T5.1.1 `[código]` · WI-T5.1.2 `[prueba]` el D1 que falla · WI-T5.1.3 `[prueba]` 404 y tienda cerrada de esa tienda.

#### HU-T5.2 · Portada, colección y ficha con el diseño de la vitrina
- **Capa:** vitrina · **Prioridad:** Must · **Puntos:** 5 · **Sprint:** T5 · **Depende de:** HU-T3.4, HU-T4.1 · **Estado:** En validación, esperando al dueño (WI-T5.2.3) (rama `feat/t5-sprint`. Las tres portadas de `apariencia` en el horno: `catalogo` (todos los productos), `editorial` (el destacado, o el primero, grande arriba) y `colecciones` (las colecciones con la foto de su primer producto; sin colecciones, la de catálogo). La ficha dice antes de comprar el precio final (con «IVA incluido» solo si el comercio es responsable de IVA), cada envío con su costo y su plazo, el retracto o por qué no aplica, y si es solo para mayores, con su casilla: la isla no agrega el producto sin ella (la edad queda en el pedido con HU-T5.4). Las fotos salen de `medio` con `srcset` de los anchos que existen (400, 800 y 1600), `width` y `height`, `loading="lazy"` salvo la primera de la página, que lleva `fetchpriority="high"`; su URL es `https://<MEDIOS>/<org>/<huella>/<ancho>.webp`, y `MEDIOS` lo genera la configuración por destino (`img.` o `img--staging.`), que también cierra la CSP del despacho a ese host. **Islas sin Preact:** la isla de T3.4 es JavaScript sin dependencias y basta. Controles negativos: sin IVA declarado no promete «IVA incluido»; sin host de fotos, el marco vacío; sin JavaScript la ficha se lee entera. La prueba de 360 y 1280 px con CLS llega con la del carrito, HU-T5.4)
- Como comprador, quiero ver bien el producto, elegir su variante y saber antes de comprar lo que la ley me debe decir.
- **Respaldo:** TIENDA §11.2, §11.3 y §14.4; Ley 1480 art. 47, art. 50 lit. b y c, y art. 52.
- **Boceto:** §5.3 y §5.4.
- **CA1.** Las tres portadas de `apariencia`, la colección y la ficha, con islas Preact solo donde hacen falta (variantes y carrito).
- **CA2.** La ficha dice el precio con IVA incluido, el plazo de las opciones de envío y el retracto (o por qué no aplica); si es para mayores, pide confirmar la edad antes de agregar, y queda en el pedido.
- **CA3.** Fotos con `srcset` de 400, 800 y 1600 px, medidas explícitas y carga diferida; la de la portada, con prioridad.
- **CA4 ❌.** Sin JavaScript, la ficha se lee entera y el precio se ve; CLS ≤ 0,05.
- **Work items:** WI-T5.2.1 `[código]` · WI-T5.2.2 `[prueba]` e2e 360 y 1280 · WI-T5.2.3 `[dueño]` revisión visual.

#### HU-T5.3 · Buscar en el teléfono, sin red
- **Capa:** vitrina · **Prioridad:** Should · **Puntos:** 2 · **Sprint:** T4 · **Depende de:** HU-T4.1 · **Estado:** En validación (rama `feat/t4-sprint`. El horno hornea `/buscar/` y la isla busca con `buscar()` (`@ed1/tienda-horno/src/vitrina/buscar.ts`) sobre `catalogo.json`, cargado una vez al abrir: escribir no pide nada. Sin tildes ni mayúsculas y con todas las palabras; sin resultados dice qué probar y muestra las colecciones, y el aviso de «sin resultados» no aparece mientras carga. Controles negativos: una consulta sin coincidencias y una vacía no devuelven nada)
- Como comprador, quiero buscar «vestido rosa» y encontrarlo aunque escriba sin tildes.
- **Respaldo:** TIENDA §11.2 (`/buscar/?q=`).
- **CA1.** Busca sobre `catalogo.json` en el navegador, sin distinguir tildes ni mayúsculas.
- **CA2.** Sin resultados, dice qué probar y muestra las colecciones.
- **CA3 ❌.** Escribir no hace ninguna solicitud al servidor.
- **Work items:** WI-T5.3.1 `[código]` · WI-T5.3.2 `[prueba]`.

#### HU-T5.4 · El carrito en el teléfono, con su código de pedido
- **Capa:** vitrina · **Prioridad:** Must · **Puntos:** 3 · **Sprint:** T5 · **Depende de:** HU-T5.2 · **Estado:** En validación (rama `feat/t5-sprint`; **corregido en T6:** el carrito estaba en `/pedido/` y TIENDA §5.4 lo pone en `/carrito/`, con `/pedido/` para el seguimiento; bitácora tienda3, «Afirmaciones mías». `packages/tienda-horno/src/vitrina/carrito.ts`, puro: el carrito vive en el `localStorage` de cada tienda (`tienda:carrito`, versión 1) con su código de 6 caracteres de Crockford, generado una vez por carrito con `crypto.getRandomValues` (256 es múltiplo de 32: sin sesgo) y uno nuevo al vaciarlo. Topes de 30 líneas y 200 unidades, dichos en la ficha; son los de `LIMITES` de `@ed1/dinero`, que la isla no puede importar, y una prueba exige que sean iguales (P2). `sanear` quita lo que se agotó o ya no existe y lo dice, y **no toca nada si hay un cobro en pantalla** (CA3). La línea guarda la edad confirmada (HU-T5.2). El horno hornea `/pedido/` (sin indexar), donde la isla pinta las líneas con `textContent`, el código, las cantidades y el subtotal; sin la isla, la página ofrece el WhatsApp de la tienda. **Lo publicado (P10):** el carrito de T3 (`tienda:pedido`) se lee con código nuevo y lo dice; uno ilegible se descarta diciéndolo. **E2e nuevas:** la Tienda es el cuarto grupo de las e2e de lo afectado (HU-C11.8): el build de `tienda-sitio` hornea a Ensayo Uno en `apps/tienda-sitio/.ensayo/` y Playwright lo sirve en su propio origen. Miden el CLS de la portada y la ficha en 360 y 1280 px (WI-T5.2.2), la ficha sin JavaScript y el carrito de punta a punta. Controles negativos: el código nunca lleva I, L, O ni U con ningún byte; la línea 31 y la unidad 201 no entran)
- Como comprador, quiero que mi carrito siga ahí si cierro la pestaña, y no pedir dos veces por tocar dos veces.
- **Respaldo:** TIENDA §8.3 y §11.3; anexo C (número estable por carrito); bitácora ecommerce 47.
- **CA1.** Vive en el `localStorage` de la tienda (cada tienda es un origen); el código de 6 caracteres de Crockford se genera una vez por carrito.
- **CA2.** Topes de 30 líneas y 200 unidades por línea, dichos en la pantalla.
- **CA3 ❌.** El código nunca lleva I, L, O ni U. Mientras hay un cobro en pantalla, el carrito no se sanea (bitácora ecommerce 47).
- **Lo publicado (P10):** un carrito guardado con un formato anterior se lee o se descarta diciéndolo; nunca rompe la página.
- **Work items:** WI-T5.4.1 `[código]` · WI-T5.4.2 `[prueba]`.

#### HU-T5.5 · Cotizar: el servidor recalcula y corrige
- **Capa:** API · **Prioridad:** Must · **Puntos:** 3 · **Sprint:** T5 · **Depende de:** HU-T1.1, HU-T5.1 · **Estado:** En validación (rama `feat/t5-sprint`. `POST /api/v1/cotizar` en `apps/tienda-api/src/cotizar.ts`: llega por el despacho con la tienda de `x-tienda`, valida con zod (de 1 a 30 líneas, de 1 a 200 unidades, enteros) y calcula con `calcularTotal` y `cobrableEnLinea` de `@ed1/dinero` sobre los precios y las existencias de la base (`stock − reservado`). Lo agotado, lo que no existe y lo de otra tienda salen del carrito; lo que no alcanza se baja; el cupón (vigente, con usos) y el envío se buscan en la base; cada corrección es un aviso con su código. Responde el carrito corregido, si es cobrable y, si llegó `totalVisto` distinto del calculado, `cambio: true` con su aviso (CA3). Solo lee, así que sigue con `ks:tienda` apagado. **Límite:** 30 por minuto por IP con Workers Rate Limiting (`LIMITE_COTIZAR`, generado por destino); el plan gratuito lo permite y no escribe nada (bitácora tienda3 11). En `/pedido/`, la isla cotiza 300 ms después de cada cambio: aplica lo corregido diciéndolo (nunca con un cobro en pantalla) y, si el total cambió, lo muestra y pide revisarlo (CA2); sin respuesta, sigue con lo que sabe y lo dice. Controles negativos: un total visto distinto nunca pasa en silencio; la variante de otra tienda sale; 31 líneas, 201 unidades o decimales responden 422; pasado el límite, 429 con `Retry-After`)
- Como comprador, quiero que me digan si algo cambió antes de pedir, y nunca pagar un carrito distinto del que vi.
- **Respaldo:** TIENDA §6 (5) y §13.2; anexo C (`validar`).
- **CA1.** `POST /api/v1/cotizar` calcula con `@ed1/dinero` y responde subtotal, descuento, envío, total, avisos, si es cobrable y el carrito corregido.
- **CA2.** Si el total cambió, la página muestra lo corregido y pide aceptar de nuevo.
- **CA3 ❌.** Un total del navegador distinto del calculado nunca sigue en silencio. 30 por minuto por IP.
- **Consumo:** dos ejecuciones y unas 5 filas leídas.
- **Work items:** WI-T5.5.1 `[código]` · WI-T5.5.2 `[prueba]` la tabla de `dinero` por la API.

#### HU-T5.6 · Las fotos sin Worker
- **Capa:** infraestructura · **Prioridad:** Must · **Puntos:** 2 · **Sprint:** T4 · **Depende de:** HU-T2.3 · **Estado:** En validación, esperando al dueño (WI-T5.6.1) (rama `feat/t4-sprint`. **Cambió por seguridad** (bitácora tienda3 10): TIENDA §5.6 ponía las fotos en el mismo bucket que los respaldos y las exportaciones, y un dominio propio de R2 hace público **todo** su bucket. Las fotos van en un bucket aparte, `tienda-c1-medios` (`medios` en `celdas.json`), el único con dominio propio; `cargarCeldas` rechaza que sea el mismo que el almacén. Una prueba exige que ninguna configuración de Worker tome `img.` ni `img--staging.`: las fotos nunca ejecutan un Worker (CA2). El `Cache-Control: public, max-age=31536000, immutable` va en cada objeto al subirlo, y la subida llega con HU-T8.3, que también enlaza el bucket a la API. Pasos del dueño: `docs/runbooks/tienda-fotos.md`. Controles negativos: un `medios` igual al almacén no carga; una ruta de Worker en `img.` pone la prueba en rojo)
- Como plataforma, quiero que ver una foto no cueste una ejecución.
- **Respaldo:** TIENDA §3.2 y §11.5.
- **CA1.** `img.laboratorio-digital.app` es el dominio personalizado del bucket, con `Cache-Control: public, max-age=31536000, immutable`, en la ruta `<org>/<huella>/<ancho>.<formato>`.
- **CA2 ❌.** Una prueba de configuración falla si una ruta de imágenes pasa por un Worker.
- **Work items:** WI-T5.6.1 `[infra]` · WI-T5.6.2 `[prueba]`.

#### HU-T5.7 · Aceptación de M1
- **Capa:** prueba de aceptación · **Prioridad:** Must · **Puntos:** 2 · **Sprint:** T7 · **Depende de:** HU-T5.1 a HU-T5.5, HU-T6.1 a HU-T6.3, HU-T12.2 · **Estado:** En validación (rama `feat/t7-aceptacion-m1`. `apps/tienda-api/src/aceptacion-m1.test.ts`: la base empieza con la sola fila de cada tienda; su catálogo llega por `cargaDeEnsayo` (`@ed1/tienda-schema/ensayos`), el archivo `tienda-import/1` de cada comercio, que pasa la revisión sin problemas, se aplica dos veces y deja exactamente el fixture; luego se publica y el despacho sirve la portada y cada ficha por su dirección de staging con D1 como trampa y la API contada (CA1 y CA3). La e2e «HU-T5.7 CA2» recorre a 360 px portada, ficha, pedido y acuse con axe en cada pantalla, sin desbordar; los presupuestos de HU-T3.6 corren en la misma suite. Controles negativos: con `stock ?? 0` en la carga, el pan de bono, que no lleva inventario, queda en 0 y la prueba falla; una foto sin `alt` en la ficha y axe falla. Falta WI-T5.7.2: la compra de prueba del dueño, `docs/runbooks/tienda-aceptacion-m1.md`)
- Como dueño, quiero ver los dos comercios de prueba publicados en staging y comprar en ellos por WhatsApp desde mi teléfono.
- **Respaldo:** TIENDA §19 (criterio de M1).
- **CA1.** Los dos comercios cargados con `tienda-import/1`, publicados por la cola y servidos por el despacho.
- **CA2.** La e2e del comprador por WhatsApp a 360 px con axe, y los presupuestos de HU-T3.6 en verde.
- **CA3 ❌.** Cero consultas a D1 por visita en la prueba del despacho.
- **Work items:** WI-T5.7.1 `[prueba]` · WI-T5.7.2 `[dueño]` una compra de prueba con los pasos exactos.

### ET6 · Pedido y posventa del comprador

#### HU-T6.1 · Pedir por WhatsApp, con la forma de pago y la aceptación verificable
- **Capa:** vitrina y API · **Prioridad:** Must · **Puntos:** 5 · **Sprint:** T6 · **Depende de:** HU-T5.5, HU-T7.1, D-T4 · **Estado:** En validación (rama `feat/t6-sprint`. `POST /api/v1/pedidos` (`apps/tienda-api/src/pedidos.ts`): registra el pedido `pendiente` de canal `whatsapp` con la forma elegida, que tiene que ser una de las que ofrece la tienda (`en_linea` no se elige por WhatsApp), la huella de los términos (que tiene que ser la de la versión publicada, leída de su manifiesto) y el instante de la aceptación; la casilla llega en `true` o no hay pedido. Antes de escribir vuelve a cotizar: si algo cambió, no registra y devuelve lo corregido; un producto solo para mayores exige la edad en su línea, y la edad queda en el historial. Escribe el pedido, sus líneas (copias del día) y su primer paso en un lote; el número sale del lote. El `codigo` es la clave de idempotencia: el mismo código con el mismo secreto responde `duplicado` con el mismo texto (CA3), y con otro secreto, `codigo-en-uso`, sin decir nada del otro pedido. El texto para WhatsApp lo arma el servidor con lo escrito, sin emoji (CA2). En `/carrito/` las formas de pago son tarjetas grandes, la casilla viene sin marcar con los enlaces a los términos y la política, y el botón dice lo primero que falta (`venta.ts`). 10 por minuto por IP (`LIMITE_PEDIDOS`; bitácora tienda3 11). **El resumen imprimible** es el acuse (HU-T6.2). Controles negativos: tres envíos del mismo código dejan uno; una forma que la tienda no ofrece, otros términos, otro total o más de lo que hay no registran nada; en la base, un pedido web sin aceptación no sale de `pendiente` y uno por WhatsApp nunca queda `pagado` (CA4))
- Como comprador, quiero mandar mi pedido por WhatsApp eligiendo cómo pagar, y que quede claro qué acepté.
- **Respaldo:** TIENDA §8.2, §8.5 y §8.7; Ley 1480 art. 50 lit. c y d; anexo C (`registrar`).
- **Boceto:** el resumen previo con cada línea, el envío y el total; las formas de pago como tarjetas grandes; la casilla sin marcar con los enlaces a los términos y a la política; «Enviar por WhatsApp», que dice qué falta.
- **CA1.** `POST /api/v1/pedidos` crea el pedido `pendiente` con la forma elegida (una de las que ofrece la tienda), la huella de los textos aceptados y el instante. El resumen se imprime o se guarda como PDF desde el navegador.
- **CA2.** Abre `wa.me` con el resumen, la forma de pago y el enlace de seguimiento; si hay emoji, va al final (bitácora ecommerce, menores).
- **CA3.** Tres envíos con el mismo código dejan un solo pedido y responden `duplicado` (anexo C).
- **CA4 ❌.** Un pedido de la web sin aceptación no sale de `pendiente`: lo impide la base. Un pedido por WhatsApp nunca figura como pagado.
- **Consumo:** unas 9 filas escritas; 10 por hora por IP.
- **Work items:** WI-T6.1.1 `[código]` API · WI-T6.1.2 `[código]` pantalla · WI-T6.1.3 `[prueba]` e2e · WI-T6.1.4 `[prueba]` idempotencia.

#### HU-T6.2 · El acuse de recibo, en el momento
- **Capa:** vitrina · **Prioridad:** Must · **Puntos:** 2 · **Sprint:** T6 · **Depende de:** HU-T6.1 · **Estado:** En validación (rama `feat/t6-sprint`. Después de enviar, la página `/pedido/#c=…&s=…` muestra el acuse: código, número, estado, total, forma de pago, envío con su plazo, guía cuando la haya, las líneas y el enlace de seguimiento, con «Imprimir o guardar como PDF» (sin servidor, `@media print`) y, desde el teléfono que lo hizo, «Enviar por WhatsApp» con el texto del servidor. **Cambió:** el comprador toca ese botón en vez de abrir WhatsApp solo, porque abrirlo después de esperar la respuesta lo bloquean los navegadores. Los datos de la transferencia nunca se hornean: el carrito lleva solo los nombres de las formas de pago (CA2). Control negativo: con una cuenta de transferencia en los ajustes, ningún archivo publicado tiene su número, su banco ni su titular)
- Como comprador, quiero saber al instante qué pedí, cuánto, cuándo llega y cómo lo sigo.
- **Respaldo:** TIENDA §8.5; Ley 1480 art. 50 lit. d.
- **CA1.** La confirmación muestra código, número, total, plazo de la opción de envío, forma de pago y el enlace de seguimiento, y se puede imprimir.
- **CA2 ❌.** Los datos de la transferencia del comercio no están en ningún archivo horneado ni en una respuesta pública: viajan en el mensaje que manda el comercio (prueba sobre lo horneado, TIENDA §14.1).
- **Work items:** WI-T6.2.1 `[código]` · WI-T6.2.2 `[prueba]`.

#### HU-T6.3 · Seguir el pedido con un enlace que no se puede adivinar
- **Capa:** vitrina y API · **Prioridad:** Must · **Puntos:** 3 · **Sprint:** T6 · **Depende de:** HU-T6.1 · **Estado:** En validación (rama `feat/t6-sprint`. El secreto (16 bytes en base64url, 22 caracteres) nace en el navegador la primera vez que se envía el pedido y se reusa en cada reintento; en la base queda solo su SHA-256. El enlace es `/pedido/#c=<código>&s=<secreto>`: la isla lo lee del fragmento y pregunta por POST a `/api/v1/seguimiento`, que compara sin cortar y responde el estado en palabras, los pasos con su fecha, las líneas, los montos, el envío con su plazo y la guía solo si ya se despachó; nada del comprador, ni la ciudad (CA2). Código inexistente, secreto malo, pedido sin enlace o un cuerpo raro responden exactamente lo mismo; 20 por minuto por IP (`LIMITE_SEGUIMIENTO`); solo lee, así que sigue con `ks:tienda` apagado. Controles negativos: las cuatro fallas dan el mismo estado y el mismo cuerpo; el secreto no aparece en ningún registro ni en la URL de la API (CA3). En la compra de prueba del 15 oct 2026 el dueño no reconoció la línea del estado, que iba sin nombre: ahora dice «Estado: …» (bitácora tienda3 18))
- Como comprador, quiero ver en qué va mi pedido sin crear una cuenta, y que nadie más pueda verlo.
- **Respaldo:** TIENDA §8.4; P13; anexo C (`seguimiento`).
- **CA1.** El secreto (128 bits) nace en el navegador y viaja una sola vez; en la base queda solo su SHA-256. El enlace lleva código y secreto en el fragmento.
- **CA2.** La respuesta dice el estado en palabras, los pasos con su fecha, las líneas, el total y la guía; nada del comprador, ni siquiera la ciudad.
- **CA3 ❌.** Un código inexistente, un secreto malo o un pedido sin enlace responden exactamente lo mismo; 20 por hora por IP; el secreto no aparece en ninguna URL de servidor ni en un log.
- **Lo publicado (P10):** un enlace ya compartido sigue sirviendo hasta que el comercio genere uno nuevo (HU-T9.6).
- **Work items:** WI-T6.3.1 `[código]` · WI-T6.3.2 `[prueba]`.

#### HU-T6.4 · Las solicitudes con radicado
- **Capa:** vitrina, API y cumplimiento · **Prioridad:** Must · **Puntos:** 5 · **Sprint:** T7 · **Depende de:** HU-T1.2, HU-T7.1 · **Estado:** En validación (rama `feat/t7-sprint`. `POST /api/v1/solicitudes` y `POST /api/v1/solicitudes/seguimiento` en `apps/tienda-api/src/solicitudes.ts`. El radicado es por tienda (`tienda.ultima_solicitud`) y sube en el mismo lote que escribe la solicitud. El contacto, el texto, el código del pedido y la autorización (instante y huella de la política publicada) van en `sobre`, cifrados con la DEK `datos_personales` de la tienda, que nace con la primera solicitud (`apps/tienda-api/src/llaves.ts`, `cifrarSobre` en `@ed1/cifrado`, AAD `org|solicitud|sobre|id`); en claro quedan el tipo, las fechas y el estado. El secreto del enlace nace en el teléfono y solo se guarda su SHA-256 (migración `0002`); reenviar el mismo formulario responde la misma solicitud. Sin la KEK responde 503 y la página ofrece el correo y el WhatsApp. Los tipos salen de `@ed1/tienda-schema` y una prueba los ata a `ref_tipo_solicitud`. En la vitrina, el formulario va debajo del texto de `/solicitud/` (plantillas versión 2) y el seguimiento usa `#r=…&s=…`. **Cambió el límite** (bitácora tienda3 11): son 5 por minuto por IP (`LIMITE_SOLICITUDES`), no por hora. Controles negativos: con la AAD sin el id, el sobre no se abre; sin correr el retracto al hábil siguiente, el de Semana Santa 2027 vence el jueves santo; un tipo de más en la lista no pasa contra la tabla; el enlace en la consulta y no en el fragmento pone la e2e en rojo. Las alertas al comercio a 3 días llegan con el panel, M2)
- Como comprador, quiero preguntar, quejarme, retractarme o pedir mis datos, con un número y una fecha de respuesta.
- **Respaldo:** TIENDA §8.6 y §14.3; Ley 1480 art. 50 lit. g (Ley 2439 art. 4); Ley 1581 arts. 14 y 15.
- **CA1.** `/solicitud/`, con o sin pedido: tipo, texto, contacto y la autorización sin marcar. Responde `R-<consecutivo>` con fecha y hora y un enlace para seguirla.
- **CA2.** El vencimiento sale de `ref_tipo_solicitud` y de `@ed1/calendario`: días hábiles con festivos; el reembolso del retracto, 15 días calendario.
- **CA3 ❌.** Un plazo que cae en festivo se corre al siguiente hábil (prueba con Semana Santa). El contacto se guarda cifrado; 5 por hora por IP.
- **Work items:** WI-T6.4.1 `[código]` · WI-T6.4.2 `[prueba]` · WI-T6.4.3 `[doc]` el texto de ayuda.

#### HU-T6.5 · «Avísame cuando haya», sin datos de nadie
- **Capa:** vitrina y API · **Prioridad:** Should · **Puntos:** 1 · **Sprint:** T5 · **Depende de:** HU-T5.2 · **Estado:** En validación (rama `feat/t5-sprint`. `POST /api/v1/avisame` en `apps/tienda-api/src/avisame.ts`: suma uno en `interes_reposicion` si la variante de esa tienda está agotada (`stock − reservado ≤ 0`); una disponible o sin inventario responde 409, y la de otra tienda 404. No guarda ningún dato de la persona, ni la IP. **Cambió el límite** (bitácora tienda3 11): Workers Rate Limiting solo cuenta de a 10 o 60 segundos, así que son 10 por minuto por IP (`LIMITE_AVISAME`), y la hora la cubre el teléfono: la isla recuerda en `tienda:avisame` las variantes por las que ya preguntó y no vuelve a sumar. En la ficha, una combinación agotada muestra «Avísame cuando haya» y dice el resultado. Controles negativos: la tabla solo tiene `org_id`, `variante_id`, `personas`, `desde` y `ultimo`, y la IP no aparece en ninguna fila; pasado el límite no suma)
- Como comprador, quiero decir que me interesa algo agotado; como comerciante, saber cuántos esperan.
- **Respaldo:** TIENDA §5.3 (`interes_reposicion`) y §14.3 (mínimo necesario); anexo C (`avisame`).
- **CA1.** `POST /api/v1/avisame` suma uno si la variante está agotada.
- **CA2 ❌.** No se guarda ningún dato de la persona; 10 por hora por IP.
- **Work items:** WI-T6.5.1 `[código]` · WI-T6.5.2 `[prueba]`.

### ET7 · Cumplimiento

#### HU-T7.1 · Los textos legales de cada tienda, generados de su ficha
- **Capa:** cumplimiento · **Prioridad:** Must · **Puntos:** 5 · **Sprint:** T5 · **Depende de:** HU-T1.4, HU-T4.1 · **Estado:** En validación, esperando al dueño (WI-T7.1.4) (rama `feat/t5-sprint`. Las plantillas viven en `content/tienda/legal/` (`plantillas.json` con su versión y un `.md` por texto); `node scripts/tienda/generar-legal.ts` las lleva a `legal.generado.json`, que el horno importa, y una prueba exige que sea el generado (P2). `textosLegales()` arma primero el HTML de la plantilla y después pone los datos escapados: lo único del comercio que se vuelve HTML son sus textos de garantía y retracto, por `markdownSeguro`. Se hornean términos, privacidad, envíos y devoluciones, retracto y garantía en `/legal/<texto>/`, y **además `/solicitud/`** (cómo hacer una solicitud y sus plazos), porque el pie la enlaza y el formulario con radicado llega con HU-T6.4. El pie lleva la identidad del comercio, los seis enlaces y la SIC; `llms.txt` y el sitemap los incluyen. Publicar guarda cada texto también en `legal/<org>/<huella>.md`, sin vencimiento (CA2). Los subencargados van con su país: Cloudflare y WhatsApp siempre, Google y Meta solo si la tienda mide. Controles negativos: sin un dato de la ficha queda su `{{campo}}` y la compuerta no publica; sin textos, el pie tiene enlaces rotos; un `<script>` en la razón social sale escapado; las plantillas no nombran tecnologías)
- Como comerciante, quiero términos, política de datos, envíos, retracto y garantía correctos sin contratar a nadie; como comprador, leerlos en palabras claras.
- **Respaldo:** TIENDA §8.5, §14.3 y §14.4; ED1 §20.1 [D5]; memoria del proyecto «textos públicos sin técnica».
- **CA1.** Las plantillas viven en un solo lugar (`content/tienda/legal/`), versionadas, y el horno las llena con la ficha legal y la política de la tienda: `/legal/{terminos,privacidad,envios,retracto,garantia}/`, cada una con su `.md`.
- **CA2.** Cada texto aceptado se guarda en R2 por su huella, sin vencimiento mientras un pedido lo cite. El pie lleva la identidad del comercio, la SIC y «Solicitudes».
- **CA3 ❌.** Un dato que falta detiene la compuerta. Los textos no cuentan cómo está hecha la tienda; los subencargados se nombran como pide la ley, con su país.
- **Corregir es cambiar una plantilla y re-hornear** (TIENDA §20.1): una revisión legal futura no toca el código.
- **Work items:** WI-T7.1.1 `[doc]` plantillas · WI-T7.1.2 `[código]` · WI-T7.1.3 `[prueba]` · WI-T7.1.4 `[dueño]` lectura de las plantillas.

#### HU-T7.2 · Términos del comercio y contrato de transmisión, al entrar por primera vez
- **Capa:** cumplimiento y panel · **Prioridad:** Must · **Puntos:** 2 · **Sprint:** T14 (era T7; esperaba los datos del encargado, que mientras tanto salen «por completar») · **Depende de:** HU-T8.1 · **Estado:** En validación (rama `feat/t14-sprint`. El texto vive en `content/tienda/comercio/terminos.json`, con la cláusula de custodia de las llaves de Bold aparte (`custodia`, HU-T11.2), y los datos del encargado salen de `content/tienda/privacidad/politica.json`: lo que falta dice «por completar», como en el parqueadero. `@ed1/tienda-schema/comercio` arma el mismo texto para el panel y la API y su huella es el SHA-256 del texto entero. La 0009 guarda en la fila de la tienda la huella aceptada, cuándo y quién, y el registro la misma huella, en un lote; aceptar una huella que no es la vigente responde «cambiado». Solo el propietario acepta (`terminos.aceptar`); el colaborador los lee y el Inicio le dice quién los acepta. Sin la vigente, `publicar` y «Volver a esta» responden 403 `sin-terminos` (CA3); conectar el cobro, con HU-T11.2. Los comercios de prueba los acepta el dueño en staging: el despliegue publica sin pasar por el panel. Controles negativos: sin el freno en publicar y sin comparar la huella, rojo)
- Como Laboratorio Digital, encargado de los datos de los compradores, quiero que cada comercio acepte los términos y el contrato de transmisión antes de operar su tienda.
- **Respaldo:** TIENDA §4.4, §9.1 y §14.3 (Decreto 1377 art. 25); análisis de integración §4.3 (el dinero va a la cuenta del comercio).
- **CA1.** Al entrar por primera vez, o cuando cambie su versión, el panel pide aceptar; la aceptación queda en `registro` con la huella del texto.
- **CA2.** Los términos dicen que el dinero va a la cuenta de Bold del comercio, que Laboratorio Digital no es el vendedor, y prohíben las tiendas fraudulentas.
- **CA3 ❌.** Sin aceptar no se puede publicar ni conectar el cobro: la API lo rechaza aunque la pantalla no lo pida.
- **Pendiente:** los datos de Laboratorio Digital como encargado, que da el dueño (§10).
- **Work items:** WI-T7.2.1 `[doc]` textos · WI-T7.2.2 `[código]` · WI-T7.2.3 `[prueba]` · WI-T7.2.4 `[dueño]` los datos del encargado.

#### HU-T7.3 · Los derechos del titular y la conservación de los contactos
- **Capa:** cumplimiento y panel · **Prioridad:** Must · **Puntos:** 3 · **Sprint:** T11 · **Depende de:** HU-T9.2, HU-T9.7 · **Estado:** En validación (rama `feat/t11-sprint`. `apps/tienda-api/src/titular.ts` y «Más → Datos de un comprador» (`vistas/Titular.tsx`), que solo ve quien tiene `titular.gestionar`, con entrada reciente. Busca por el celular con el índice ciego (`pedido_contacto.celular_indice`); un contacto escrito antes del índice se abre, se compara y queda indexado. Descargar (`titular/1`), corregir (los campos vacíos se quedan como estaban, en todos sus pedidos) y suprimir dejan su rastro en el registro y en la historia de cada pedido (migración `0005_contacto_corregido_y_suprimido.sql`). Suprimir se lleva el contacto y deja el pedido; un pedido en curso conserva el suyo y se dice cuántos quedaron. CA2: `purgar_despues` sale de «Datos legales → Meses de conservación» (24 por omisión, de 12 a 60), y la política de privacidad dice ese plazo. Bajarlo acorta los contactos que ya están; alargarlo no alarga los viejos. La purga diaria se los lleva. Las consultas van de a 50: 120 pedidos de un mismo celular no pasan de los 100 parámetros de D1. Cada prueba ❌ se vio en rojo con su defecto, entre ellas el colaborador sin el 403 y las consultas sin partir en lotes. WI-T7.3.3: `docs/runbooks/tienda-incidente-datos-personales.md`, para que lo lea un abogado)
- Como comprador, quiero que el comercio pueda darme, corregir o borrar mis datos; como comerciante, hacerlo sin pedírselo a nadie.
- **Respaldo:** TIENDA §14.3; Ley 1581.
- **CA1.** El propietario busca a un comprador por su celular (índice ciego) y exporta, corrige o suprime sus contactos; cada acción queda en `registro`.
- **CA2.** `purgar_despues` a 24 meses por defecto (D-T5), ajustable entre 12 y 60; el cron diario purga, y el pedido queda como prueba de la venta sin el contacto.
- **CA3 ❌.** Suprimir no borra el pedido ni su historia; un colaborador no ve esta herramienta y la API se la niega.
- **Work items:** WI-T7.3.1 `[código]` · WI-T7.3.2 `[prueba]` · WI-T7.3.3 `[doc]` runbook del incidente de datos personales.

### ET8 · Panel: entrar, catálogo e inventario

#### HU-T8.1 · Entrar al panel y elegir la tienda
- **Capa:** panel · **Prioridad:** Must · **Puntos:** 3 · **Sprint:** T7 · **Depende de:** HU-T2.8, HU-T3.5 (mismo sprint, antes), HU-C4.3, HU-C4.4 · **Estado:** En validación (rama `feat/t7-sprint`. Entrar es el patrón del cuaderno con `producto=tienda`: el código del fragmento se borra de la barra antes de canjearlo, la sesión vive en IndexedDB (`tienda-panel`), con varias tiendas se elige y elegir es renovar hacia ella. `GET /api/panel/v1/yo` trae además las funciones del plan (`funcionesDelPlan` de `@ed1/tienda-schema`). Un 401 se renueva una vez; si sigue, «vuelve a entrar» aparece encima sin navegar, y los formularios guardan su borrador (CA2). El panel elige el CORE por su host: el de producción solo en `panel.`; su CSP deja conectarse a los dos CORE de `celdas.json`. Una ruta sin archivo responde con la app (`not_found_handling`). La versión nueva espera a «Actualizar». **Las organizaciones de prueba no se crean al entrar:** las crea el despliegue del CORE de staging (decisión del dueño del 15 oct 2026, «correo en un secreto»), ver HU-T2.10. La e2e encontró un almacén nuevo en cada render que hacía preguntar a la API sin fin; quedó una prueba que cuenta las preguntas. Controles negativos: guardar un token de otro producto, no renovar ante un 401 y el almacén por render. WI-T8.1.3: el 15 oct 2026 el dueño entró en staging, vio las dos tiendas y abrió cada una; encontró que cambiar de tienda desde «Más» se quedaba en «Abriendo tu tienda…» hasta recargar (bitácora tienda3 17), corregido con su e2e)
- **Desde HU-T2.10:** esta historia cierra la aceptación de M0: el CORE de staging emite un token `aud = tienda` al entrar desde el panel de staging, y `GET /api/panel/v1/yo` lo acepta. Las organizaciones de Ensayo Uno y Ensayo Dos en el CORE de staging (HU-T2.10 CA2) las crea el despliegue del CORE de staging, con el dueño de propietario (`TIENDA_CORREO_DUENO_STAGING`).
- Como comerciante, quiero entrar con Google y llegar a mi tienda; si tengo dos, elegir.
- **Respaldo:** TIENDA §12.1; PLATAFORMA §4.6; bitácora agro 25 (una cuenta en dos organizaciones).
- **Boceto:** «Entrar con Google» → si hay varias tiendas, una tarjeta por tienda con su nombre, rol y plan → Inicio. «Sin sesión», «sin tienda» y «error» dicen cosas distintas.
- **CA1.** PWA en `panel.laboratorio-digital.app`; el token vive en IndexedDB, sin cookies; `GET sesion` trae tienda, rol, plan y funciones del plan.
- **CA2.** Un 401 lleva a «vuelve a entrar» con el motivo, sin perder lo que la persona estaba escribiendo.
- **CA3 ❌.** Un token de otro producto no abre el panel. Las e2e esperan a que lo guardado aparezca antes de navegar (bitácora agro, terreno: `page.goto` corta IndexedDB).
- **Lo publicado (P10):** la PWA avisa de la versión nueva sin perder trabajo, como el cuaderno.
- **Work items:** WI-T8.1.1 `[código]` · WI-T8.1.2 `[prueba]` e2e · WI-T8.1.3 `[dueño]` entrar en staging.

#### HU-T8.2 · Productos con variantes
- **Capa:** panel y API · **Prioridad:** Must · **Puntos:** 5 · **Sprint:** T8 · **Depende de:** HU-T8.1, HU-T1.4, HU-T10.6 (mismo sprint) · **Estado:** Terminada (PR #188, fusionado el 15 oct 2026; el dueño la validó en staging el 15 oct: «se crea produto, variantes y se carga foto correctamente». `apps/tienda-api/src/catalogo.ts` guarda el producto con sus opciones y combinaciones en un solo lote, con los topes de CA1; quitar una combinación la deja inactiva, porque un pedido viejo la nombra. En el panel, «Productos» lista, busca y abre la papelera, y la ficha arma las combinaciones a partir de las opciones, cada una con su precio, su SKU y sus existencias. **CA2:** cada escritura lleva `version` y `op`; el lote termina con una guarda que lo aborta entero si otra escritura ganó la carrera entre la lectura y el lote, y la pantalla dice «Alguien más guardó este producto» con «Ver cómo quedó». **CA3:** la dirección anterior queda en el producto y el horno escribe el 301 en el manifiesto; el despacho solo redirige a otra ficha de la misma tienda. **CA1:** la papelera guarda 30 días; pasado eso no se lista ni se restaura, y la purga de HU-T17.2 la borra. Controles negativos: sin la guarda, dos guardadas a la vez se pisan; un precio vacío, en 0 o con centavos no se guarda y vuelve a su campo; un stock vacío sin elegir «no se cuenta» tampoco; el token de Ensayo Dos no ve los productos de Ensayo Uno; la e2e de 360 px con axe)
- Como comerciante, quiero crear un vestido con tallas y colores, cada combinación con su precio y existencias, desde el teléfono.
- **Respaldo:** TIENDA §5.3 (catálogo) y §12.4; anexo C (`productos`, `guardar_producto`, `guardar_combinaciones`).
- **CA1.** Hasta 3 grupos de opciones de hasta 20 valores y 100 variantes; todo producto tiene al menos una variante; estados borrador, activo y archivado; papelera de 30 días.
- **CA2.** Cada escritura lleva `version` y `op`: dos personas editando no se pisan sin verlo, y repetir no duplica.
- **CA3.** Cambiar el slug deja una redirección 301 horneada desde el anterior.
- **CA4 ❌.** Un precio ilegible o vacío nunca se guarda como 0. Un stock vacío significa «no se cuenta» solo si el comercio lo eligió (bitácora ecommerce 54: generar filas vacías agotaba la tienda).
- **Work items:** WI-T8.2.1 `[código]` API · WI-T8.2.2 `[código]` pantallas · WI-T8.2.3 `[prueba]` concurrencia e idempotencia.

#### HU-T8.3 · Fotos comprimidas en el teléfono, con el respaldo de Safari
- **Capa:** panel · **Prioridad:** Must · **Puntos:** 3 · **Sprint:** T8 · **Depende de:** HU-T8.2, HU-T5.6 · **Estado:** Terminada (PR #188, fusionado el 15 oct 2026; el dueño la validó en staging el 15 oct: «se crea produto, variantes y se carga foto correctamente». `apps/tienda-panel/src/app/fotos.ts` abre la foto derecha (EXIF), hace en un `canvas` las derivadas que alcanza el original (400, 800 y 1600 px) y sube solo esas; la huella SHA-256 del original es su nombre, así que la misma foto no se guarda dos veces. **CA2:** se pide WebP y, si el navegador devuelve otro tipo, todo sale en JPEG. `apps/tienda-api/src/medios.ts` revisa los bytes de cada derivada contra el formato que se declara y guarda en `<org>/<huella>/<ancho>.<formato>` con caché inmutable; `medio.formatos` dice el formato (`{"jpeg":{…}}`), y el horno arma las rutas con él. Hasta 12 fotos por producto. La API enlaza el bucket de las fotos solo en los ambientes que `medios_creados` de `celdas.json` nombra, porque enlazar uno que no existe tumba el despliegue; donde no lo nombra, subir responde «sin fotos» (503). El 15 oct 2026 el dueño eligió enlazarlo primero en staging (`["staging"]`); el 15 oct una foto subió bien en staging y el dueño eligió enlazarlo también en producción (`["produccion", "staging"]`). Controles negativos: la e2e con un `toBlob` que devuelve PNG, como Safari, manda `400.jpeg` y `800.jpeg` con bytes JPEG, y en rojo sin el respaldo; un PNG que dice ser WebP no se guarda; sin texto alternativo no sube; una derivada más ancha que el original no pasa; la foto de otra tienda no ve el producto)
- Como comerciante, quiero subir fotos desde el celular sin esperar ni gastar datos.
- **Respaldo:** TIENDA §11.5; ED1 §3.3; ADR-15; bitácora agro, terreno («Safari no codifica WebP en `canvas.toBlob`»); bitácora tienda3 2.
- **CA1.** El navegador genera las derivadas de 400, 800 y 1600 px y sube solo esas; el original no sale del teléfono; el texto alternativo es obligatorio.
- **CA2.** Si el navegador no produce WebP, las derivadas salen en JPEG, y la ruta y `medio.formatos` dicen el formato real.
- **CA3 ❌.** Una prueba con un `toBlob` que devuelve PNG (como Safari) produce JPEG, nunca un archivo `.webp` que no lo es.
- **Work items:** WI-T8.3.1 `[código]` · WI-T8.3.2 `[prueba]` · WI-T8.3.3 `[dueño]` subir una foto desde un iPhone, si hay uno a mano.

#### HU-T8.4 · Colecciones
- **Capa:** panel · **Prioridad:** Should · **Puntos:** 2 · **Sprint:** T8 · **Depende de:** HU-T8.2 · **Estado:** En validación (rama `feat/t8-sprint`. «Colecciones» en el panel: se crean, se ordenan con «Subir» y «Bajar» y cada una elige sus productos, que salen en el orden del catálogo. Un producto puede estar en varias; la vitrina solo muestra los activos que no están en la papelera. **CA2:** la confirmación dice «Sus productos siguen en la tienda» y borrar quita solo la colección. Controles negativos: borrar una colección deja sus productos; una colección con un producto que no está no se guarda; la versión vieja responde «cambiado»)
- Como comerciante, quiero agrupar mis productos en colecciones y ordenarlas.
- **Respaldo:** TIENDA §5.3.
- **CA1.** Un producto puede estar en varias colecciones; se ordenan las colecciones y el catálogo.
- **CA2 ❌.** Borrar una colección no borra sus productos.
- **Work items:** WI-T8.4.1 `[código]` · WI-T8.4.2 `[prueba]`.

#### HU-T8.5 · El inventario y su libro
- **Capa:** panel y API · **Prioridad:** Must · **Puntos:** 3 · **Sprint:** T9 · **Depende de:** HU-T8.2 · **Estado:** En validación (rama `feat/t9-sprint`. «Productos → Inventario» lista cada combinación con cuántas hay, cuántas están apartadas por pagos en curso y cuántas personas esperan. Cada una abre su libro: por qué cambió cada número (pedido confirmado, ajuste, conteo, carga). **CA1:** ajustar suma o resta y contar dice cuántas hay; ninguno baja de lo apartado. **CA2:** «Ya les avisé» pone en cero a quienes esperan y queda en el registro. Controles negativos: un ajuste o un conteo por debajo de lo apartado, o de cero, no cambia nada; otra tienda no ve ni toca el inventario; la e2e de 360 px con axe)
- Como comerciante, quiero ajustar existencias, contar, y saber por qué cambió cada número.
- **Respaldo:** TIENDA §7.1 y §7.4; anexo C (columna `Inventario`, `avisame_hecho`).
- **CA1.** Ajuste y conteo con su motivo; el libro de cada variante lo escribe un trigger; los «Avísame» de cada variante se ven y se marcan atendidos.
- **CA2 ❌.** Bajar el stock por debajo de lo apartado se rechaza con «Hay N unidades apartadas por pagos en curso»; el stock nunca queda negativo.
- **Work items:** WI-T8.5.1 `[código]` · WI-T8.5.2 `[prueba]`.

#### HU-T8.6 · Ver la tienda antes de publicar
- **Capa:** panel y horno · **Prioridad:** Should · **Puntos:** 2 · **Sprint:** T17 · **Depende de:** HU-T4.4 · **Estado:** Refinada
- Como comerciante, quiero ver cómo queda un cambio antes de que lo vean mis clientes.
- **Respaldo:** bitácora ecommerce 65. **Ningún documento de la 3.0 la cubre:** es una propuesta de este plan.
- **CA1.** «Vista previa» hornea sin mover el puntero y abre la versión en `/_vista/<huella del manifiesto>/`, con `noindex`, una franja que lo dice y sin poder pedir ni pagar.
- **CA2 ❌.** Una vista previa nunca entra al sitemap ni a la caché de la versión publicada.
- **Work items:** WI-T8.6.1 `[código]` · WI-T8.6.2 `[prueba]`.

### ET9 · Panel: pedidos y contraentrega

#### HU-T9.1 · La bandeja de pedidos
- **Capa:** panel · **Prioridad:** Must · **Puntos:** 5 · **Sprint:** T9 · **Depende de:** HU-T8.1, HU-T6.1 · **Estado:** En validación (rama `feat/t9-sprint`. «Pedidos» trae de a 50, del más nuevo al más viejo, con lo que necesita atención arriba. Los filtros por estado, forma de pago y número o comprador trabajan sobre lo que ya llegó, sin pedir nada. El comprador sale tapado desde el servidor («Ensayo D. · 300 ••• 4567»). Se actualiza al volver a la pestaña; una lectura vieja que llega tarde no pisa la nueva. Controles negativos: sin el turno, la lectura vieja pisa la lista; sin el cursor se repiten pedidos; ninguna respuesta de la bandeja lleva el nombre, el celular ni la dirección en claro; la e2e con 300 pedidos en 360 px y axe)
- Como comerciante, quiero ver qué pedidos tengo que confirmar, despachar o cobrar, y encontrar uno por su número o su comprador.
- **Respaldo:** TIENDA §12.2; anexo C (`pedidos`); bitácora ecommerce 62.
- **Boceto:** filtros de estado y forma de pago arriba; tarjetas con número, hora, total, forma y estado; y antes de todo, en rojo, lo que necesita atención (un cobro a revisar, un pago sin existencias).
- **CA1.** Lista por estado, forma de pago y texto, con cursor; los filtros trabajan en la página, sin red.
- **CA2.** Cada lectura lleva turno y solo se pinta la última; mientras llega, se ve la lista de antes.
- **CA3 ❌.** Una respuesta vieja nunca pisa a la nueva. Los datos del comprador salen tapados («María F.», «300 ••• 4567»).
- **Work items:** WI-T9.1.1 `[código]` · WI-T9.1.2 `[prueba]` e2e con 300 pedidos.

#### HU-T9.2 · Ver los datos de entrega deja huella
- **Capa:** panel y seguridad · **Prioridad:** Must · **Puntos:** 2 · **Sprint:** T9 · **Depende de:** HU-T9.1, HU-T1.3 · **Estado:** En validación (rama `feat/t9-sprint`. «Ver datos de entrega» descifra el contacto del pedido con la llave de la tienda y lo muestra; queda en la historia del pedido y en el registro («Tú viste los datos de entrega del pedido #1045»). Es la única ruta, con «Confirmar por WhatsApp», que devuelve el contacto en claro, y pide el permiso `pedidos.contacto_ver`. Controles negativos: sin la fila de la historia, la prueba queda en rojo; un rol sin el permiso no lo lee; los registros de la consola no lo guardan. **Falta un dato:** la vitrina todavía no le pide el contacto al comprador, así que los pedidos por WhatsApp dicen «Llegó por WhatsApp» y no tienen datos que ver)
- Como comprador, quiero que mis datos los vea solo quien despacha, y que quede registrado.
- **Respaldo:** TIENDA §12.5.
- **CA1.** «Ver datos de entrega» descifra ese pedido y escribe `contacto_leido` en su historial y en `registro`.
- **CA2 ❌.** Ninguna otra ruta devuelve datos en claro: una prueba busca los nombres y celulares de prueba en todas las respuestas y en los logs de las e2e.
- **Work items:** WI-T9.2.1 `[código]` · WI-T9.2.2 `[prueba]`.

#### HU-T9.3 · Confirmar por WhatsApp y confirmar el pedido
- **Capa:** panel y API · **Prioridad:** Must · **Puntos:** 3 · **Sprint:** T9 · **Depende de:** HU-T9.1, HU-T8.5 · **Estado:** En validación (rama `feat/t9-sprint`. «Confirmar por WhatsApp» arma el mensaje con las líneas, el total, la dirección y, si paga por transferencia, los datos de la cuenta, y abre el chat del comprador. Confirmar descuenta el inventario en el mismo lote que el pedido, con su línea en el libro («Pedido confirmado»), o dice qué combinación no alcanza sin tocar nada. Un pedido en línea no se confirma a mano. Controles negativos: sin el descuento, el inventario no cambia; sin revisar las existencias, confirmar no dice qué falta; sin la regla, un pedido en línea se confirmaría a mano; la e2e con axe)
- Como comerciante, quiero confirmar con el comprador antes de despachar, con el mensaje ya armado, y que el inventario baje al confirmar.
- **Respaldo:** TIENDA §7.4 y §8.7 («Confirmar antes de despachar»); estudio §11.3 [C7].
- **CA1.** «Confirmar por WhatsApp» abre `wa.me` con el resumen, la dirección si la dejó y lo que sigue según la forma de pago; en una transferencia, con los datos de la cuenta del comercio.
- **CA2.** «Confirmar» descuenta el inventario en un lote con la guarda; si no alcanza, lo dice y no confirma (P1).
- **CA3 ❌.** Un pedido contra entrega no se despacha sin estar confirmado, y uno confirmado a mano nunca dice que se pagó en línea: lo impide la base.
- **Work items:** WI-T9.3.1 `[código]` · WI-T9.3.2 `[prueba]`.

#### HU-T9.4 · Despachar con guía: la contraentrega nace con su recaudo
- **Capa:** panel y API · **Prioridad:** Must · **Puntos:** 3 · **Sprint:** T10 · **Depende de:** HU-T9.3 · **Estado:** En validación (rama `feat/t10-sprint`. `apps/tienda-api/src/ciclo.ts`: despachar guarda la transportadora y la guía, que el comprador ve en su seguimiento. Un pedido contra entrega nace con su recaudo `por_recaudar` en el mismo lote, con la comisión y el flete de ida si el comercio los sabe; vacíos son «no lo sé», nunca 0. La base tampoco deja despachar contra entrega sin la guía o sin el recaudo (`pedido_despachado_contraentrega`). Una transferencia sale sin guía y sin recaudo. En el panel, «Despachar» dice todo lo que falta en la misma vuelta. Controles negativos: sin el recaudo en el lote, la contraentrega sale sin recaudo; sin revisar lo que falta, despacha sin guía; sin la regla del panel, la e2e manda el despacho incompleto)
- Como comerciante, quiero anotar la transportadora y la guía al despachar, y que la plata de la contraentrega empiece a seguirse.
- **Respaldo:** TIENDA §8.7 (paso 1).
- **CA1.** Despachar crea, en el mismo lote, el recaudo `por_recaudar` con la comisión y el flete de ida si el comercio los conoce.
- **CA2 ❌.** Sin guía o sin recaudo, la base lo rechaza, y el panel dice cuál falta.
- **Work items:** WI-T9.4.1 `[código]` · WI-T9.4.2 `[prueba]`.

#### HU-T9.5 · Recaudos: recaudar, devolver, perder y liquidar
- **Capa:** panel y API · **Prioridad:** Must · **Puntos:** 5 · **Sprint:** T10 · **Depende de:** HU-T9.4 · **Estado:** En validación (rama `feat/t10-sprint`. Entregar contra entrega es recaudar, en el mismo lote, y la base no deja entregar con la plata por recaudar. Devolver pide si las unidades volvieron, que vuelven al inventario con su línea en el libro, y el flete de vuelta; «perdido» queda aparte. La pantalla «Pedidos → Recaudos» (`apps/tienda-panel/src/app/vistas/Recaudos.tsx`) muestra lo pendiente con su antigüedad en días de Bogotá y el neto de cada uno, y liquida varios con el número de la liquidación; si uno no está recaudado, no se marca ninguno. La aceptación de M2 es la e2e «HU-T9.5 · aceptación de M2»: confirmar, despachar, recaudar y liquidar. Controles negativos: sin cerrar el recaudo al entregar, la base niega la entrega; sin devolver al inventario, las unidades no vuelven; sin revisar lo dicho, se liquida lo que no se recaudó)
- Como comerciante, quiero saber cuánta plata de contraentrega me deben, cuánta ya cobré y cuánto me costó lo que se devolvió.
- **Respaldo:** TIENDA §8.7 (pasos 2 a 4 y «Lo que ve el comercio»); estudio §8.1 [C3] y §11.3 [C7].
- **Boceto:** la pantalla Recaudos con dos totales (por recaudar y recaudado sin liquidar) y su antigüedad; selección de varios para liquidar.
- **CA1.** Entregar y recaudar van juntos; devolver pide el flete de vuelta y si la unidad vuelve al inventario; «perdido» queda aparte.
- **CA2.** Liquidar marca varios recaudos con el número de la liquidación; el margen de cada pedido resta la comisión y los fletes.
- **CA3 ❌.** No se puede entregar con la plata por recaudar, ni liquidar lo que no se recaudó.
- **Aceptación de M2:** la e2e de contraentrega de punta a punta: confirmar, despachar, recaudar y liquidar.
- **Work items:** WI-T9.5.1 `[código]` · WI-T9.5.2 `[prueba]` e2e.

#### HU-T9.6 · Pedidos anotados, notas, enlace nuevo y cancelar o devolver
- **Capa:** panel y API · **Prioridad:** Must · **Puntos:** 3 · **Sprint:** T10 · **Depende de:** HU-T9.1 · **Estado:** En validación (rama `feat/t10-sprint`. «Anotar un pedido» (`apps/tienda-panel/src/app/vistas/Anotar.tsx`) registra uno que llegó por teléfono con el canal `panel`, sin aceptación de términos, y dice todos sus errores en la misma vuelta. Las notas van a la historia del pedido y el registro no copia lo que dicen. Un enlace de seguimiento nuevo invalida el anterior. Cancelar pregunta si las unidades vuelven; confirmar, cancelar y volver a confirmar no descuadra el inventario; uno despachado no se cancela, se recibe la devolución. Controles negativos: anotado con el canal `whatsapp`, la prueba falla; sin cambiar la huella, el enlace viejo sigue sirviendo; sin revisar las líneas, el panel manda un pedido vacío)
- Como comerciante, quiero anotar un pedido que me llegó por teléfono, dejar notas, y cancelar o recibir una devolución sin descuadrar el inventario.
- **Respaldo:** TIENDA §8.1, §8.2 (canal `panel`) y §8.4 (5); anexo C (`estado_pedido`, `enlace_seguimiento`).
- **CA1.** Crear con canal `panel` (sin aceptación); notas en el historial; un enlace de seguimiento nuevo que invalida el anterior.
- **CA2.** Cancelar o devolver suma al inventario si el comercio marca «volvió», una sola vez.
- **CA3 ❌.** Confirmar, cancelar y volver a confirmar no descuadra el stock (`descontado`, anexo C).
- **Work items:** WI-T9.6.1 `[código]` · WI-T9.6.2 `[prueba]`.

#### HU-T9.7 · Las solicitudes en el panel
- **Capa:** panel y cumplimiento · **Prioridad:** Must · **Puntos:** 3 · **Sprint:** T11 · **Depende de:** HU-T6.4, HU-T9.1 · **Estado:** En validación (rama `feat/t11-sprint`. `apps/tienda-api/src/panel-solicitudes.ts` y «Pedidos → Solicitudes» (`apps/tienda-panel/src/app/vistas/Solicitudes.tsx`). La lista pone primero las que esperan respuesta, de la que vence antes a la que vence después, así que la vencida queda arriba, con borde rojo y dicho en palabras; avisa a 3 días y el día que vence, en días de Colombia. El retracto vence con el reloj del reembolso (15 días calendario) y un pago aprobado sin existencias, con el suyo. Abrir una descifra lo que contó la persona y queda en el registro; responder guarda la respuesta en el mismo sobre cifrado y ofrece mandarla por el canal que dejó. Cerrar pide la respuesta, también en la base (migración `0004_solicitud_respondida.sql`). Controles negativos en rojo: sin el disparador, sin el orden por vencimiento, sin los avisos y sin el reloj de «sin existencias». La e2e «HU-T9.7 · CA1 y CA3…» recorre la lista, responder, mandarla y cerrar a 360 px)
- Como comerciante, quiero ver las solicitudes con su plazo y responderlas a tiempo.
- **Respaldo:** TIENDA §8.6.
- **CA1.** Lista por estado con su vencimiento; avisos a 3 días y el día del vencimiento; responder y cerrar.
- **CA2.** El retracto lleva el reloj del reembolso (15 días calendario) y un pago «sin existencias», el suyo.
- **CA3 ❌.** Una solicitud vencida sin respuesta aparece arriba, en rojo, y no se puede cerrar sin responder.
- **Work items:** WI-T9.7.1 `[código]` · WI-T9.7.2 `[prueba]`.

### ET10 · Panel: venta, ajustes, equipo y datos

#### HU-T10.1 · Envíos y cupones
- **Capa:** panel y API · **Prioridad:** Must · **Puntos:** 3 · **Sprint:** T10 · **Depende de:** HU-T1.1, HU-T8.1 · **Estado:** En validación (rama `feat/t10-sprint`. `apps/tienda-api/src/venta.ts` y «Más → Envíos y cupones». Los envíos llevan precio, «gratis desde», ciudades y días; si pasan de 30 días, la tienda lo dice con sus palabras (`plazoDelEnvio` en `packages/tienda-horno/src/legal.ts`) y el panel avisa. Un cupón dice sus usos y si se agotó. Los usos los cuenta la base al confirmar y los devuelve al cancelar (migración `0003_usos_del_cupon.sql`, con `cupon_contado` por pedido). **Cambió una regla:** un cupón que se agota mientras alguien paga se respeta, porque el pago no debe fallar, pero no cuenta más allá del tope. Controles negativos: sin el disparador, el cupón no cuenta; sin el tope, cuenta de más; cancelar sin `cupon_contado` devuelve un uso que no se contó; un plazo de 45 días sin su texto no pasa la compuerta; sin el aviso del panel, la e2e falla)
- Como comerciante, quiero mis opciones de envío por ciudad y mis cupones, con reglas que no se rompan solas.
- **Respaldo:** TIENDA §5.3 (venta) y §6; anexo C (`guardar_envio`, `guardar_cupon`); bitácora ecommerce 41.
- **CA1.** Envío con precio, «gratis desde», ciudades y días; si pasa de 30 días calendario, el texto lo dice (Ley 2439). Cupón por porcentaje, valor o envío gratis, con mínimo, vigencia y usos.
- **CA2 ❌.** Un cupón de 50 usos se agota a los 50 pedidos confirmados o pagados (bitácora ecommerce 41: el cupón nunca se agotaba); un pedido cancelado no gasta usos.
- **Work items:** WI-T10.1.1 `[código]` · WI-T10.1.2 `[prueba]` casos de `dinero`.

#### HU-T10.2 · Páginas propias
- **Capa:** panel · **Prioridad:** Could · **Puntos:** 2 · **Sprint:** T17 · **Depende de:** HU-T4.2 · **Estado:** Refinada
- Como comerciante, quiero una página «Quiénes somos» sin tocar código.
- **Respaldo:** TIENDA §5.3 (`pagina`). Va después de M6 porque el anexo C no la lista; si HU-T12.1 dice que una tienda 2.0 la usa, se adelanta.
- **CA1.** Markdown seguro, con su enlace en el pie o el menú.
- **CA2 ❌.** Una página no puede tomar la dirección de un texto legal ni de una ruta del sistema.
- **Work items:** WI-T10.2.1 `[código]` · WI-T10.2.2 `[prueba]`.

#### HU-T10.3 · Ajustes por sección, con la entrada reciente donde se mueve la plata
- **Capa:** panel y API · **Prioridad:** Must · **Puntos:** 5 · **Sprint:** T9 · **Depende de:** HU-T1.4, HU-T8.1, HU-C4.3 (`auth_time`) · **Estado:** En validación (rama `feat/t9-sprint`. «Más → Ajustes» lista las 9 secciones y lo que falta para publicar, en palabras. `apps/tienda-api/src/ajustes.ts` guarda cada sección sola. **CA1:** cada guardada lleva su `version`; si alguien guardó antes, responde 409 con la de ahora. **CA2:** cambiar el WhatsApp, el modo de pedido o el cobro con una entrada de hace más de 10 minutos responde 401 `reautenticar`; el panel pide entrar con Google sin renovar el acceso, y al volver el formulario está como estaba (borrador en el teléfono, con su versión). El colaborador no cambia el modo ni el cobro, y no ve el cobro. **CA3:** `whatsappVerificado` lo pone la API, nunca el formulario; un número nuevo queda sin verificar hasta abrir el chat de prueba y tocar «Sí, es mi WhatsApp». **CA4:** lo vacío no se guarda, y la compuerta no publica sin lo obligatorio. Controles negativos: uno por criterio en `panel-ajustes.test.ts`, más los datos de la transferencia que no salen en el registro; en la e2e, sin el borrador el número escrito se pierde al volver de entrar, y sin abrir el chat el botón de verificar aparece antes de tiempo)
- Como comerciante, quiero configurar mi tienda por partes; como plataforma, que cambiar por dónde llegan los pedidos o el dinero pida volver a entrar.
- **Respaldo:** TIENDA §5.7 y §12.3; bitácora ecommerce, crítico «la configuración de fábrica traía el celular de la primera tienda».
- **CA1.** Las 9 secciones con su esquema; guardar una es atómico y lleva su `version`.
- **CA2.** WhatsApp, modo de pedido, cobro y datos de la transferencia exigen `auth_time` de menos de 10 minutos; si no, 401 `reautenticar`, y el panel abre la entrada sin perder el formulario.
- **CA3.** El número de WhatsApp queda «sin verificar» hasta que el comercio abre el chat de prueba que arma el panel y confirma que es el suyo.
- **CA4 ❌.** Vacío nunca es un valor de fábrica: un obligatorio vacío detiene la compuerta con su motivo.
- **Work items:** WI-T10.3.1 `[código]` · WI-T10.3.2 `[prueba]` · WI-T10.3.3 `[dueño]` probar la entrada reciente.

#### HU-T10.4 · Publicar, versiones y volver atrás desde el panel
- **Capa:** panel · **Prioridad:** Must · **Puntos:** 3 · **Sprint:** T10 · **Depende de:** HU-T4.3, HU-T4.4 · **Estado:** En validación (rama `feat/t10-sprint`. «Más → Publicar y versiones» (`apps/tienda-panel/src/app/vistas/Publicar.tsx`): publicar dice todo lo que falta de la compuerta, cada cosa con un enlace a donde se arregla. Las versiones dicen cuándo, quién («Tú», «Otra persona del equipo» o «La tienda») y qué. «Volver a esta» (`POST /api/panel/v1/publicaciones/volver`, `volverA` en `publicar.ts`) mueve el puntero sin hornear y deja la frase en el registro; las existencias de ahora llegan después, en segundo plano. No vuelve a una fallida ni a la que ya se ve, y con otra en curso espera (409). CA3 se prueba con la caché de 30 s del despacho; la propagación del KV entre regiones queda fuera de la prueba. Controles negativos: con la falla de la compuerta sin mapear, el panel y la e2e no dicen qué falta; sin poner al día las existencias en segundo plano, las pruebas de volver fallan)
- Como comerciante, quiero publicar con un botón, ver mis versiones y volver a una anterior en segundos.
- **Respaldo:** TIENDA §10.5; anexo C (`publicacion`, `publicar`); bitácora ecommerce 77.
- **CA1.** «Publicar» muestra la compuerta con todas las fallas, o el avance de la cola.
- **CA2.** «Versiones» lista fecha, autor y resumen; «Volver a esta» mueve el puntero sin hornear.
- **CA3 ❌.** Volver atrás no deshace pedidos ni inventario, y el cambio se ve en menos de 60 s (criterio de M2).
- **Work items:** WI-T10.4.1 `[código]` · WI-T10.4.2 `[prueba]`.

#### HU-T10.5 · El equipo: un colaborador con sus límites
- **Capa:** panel y API · **Prioridad:** Must · **Puntos:** 3 · **Sprint:** T10 · **Depende de:** HU-C3.2, HU-T8.1 · **Estado:** En validación (rama `feat/t10-sprint`. La invitación es la del CORE (HU-C3.2): «Más → Equipo», que solo ve quien administra, la crea con el rol `colaborador` y arma el mensaje para WhatsApp con el enlace `/unirme/#invitacion=…` (`apps/tienda-panel/src/app/equipo.ts`). «Unirme» guarda el código en el teléfono, lo quita de la barra, muestra a qué tienda y de parte de quién, pasa por Google si hace falta y, al aceptar, renueva la sesión hacia la tienda nueva. En el panel, un campo de ajustes que pide un permiso del propietario lleva `pide` y se ve sin poder cambiarse; una prueba lo ata a `accionesDeAjuste`. Un 403 de la matriz se dice como «No se guardó». `apps/tienda-api/src/panel-colaborador.test.ts` recorre cada acción que la matriz niega al colaborador: modo de pedido, cobro e importar responden 403 recién entrado y nada cambia. Equipo y plan son del CORE; dominio, exportar con datos personales, factura y titular todavía no tienen ruta en la API, y la prueba falla el día que la tengan sin su 403. Controles negativos: con el cobro fuera de la matriz del propietario, la tabla y el 403 fallan; una acción sin ruta que aparece en la API rompe la prueba; el enlace con el código en la consulta, sin borrar el código al aceptar o sin `pide` en el modo, las pruebas del panel fallan; con «Equipo» para todos o el código en la barra, la e2e falla)
- Como comerciante, quiero que alguien me ayude con pedidos y productos sin ver a dónde llega la plata.
- **Respaldo:** TIENDA §12.1; anexo C (`colaborador`); bitácora ecommerce 64 (un permiso escondido en la página es un adorno).
- **CA1.** La invitación es del CORE, con el rol `colaborador`, y se manda por WhatsApp con el código en el fragmento.
- **CA2.** La matriz de `permisos.ts` decide en la API y esconde en el panel.
- **CA3 ❌.** Un colaborador que manda a la API un cambio de cobro, dominio, equipo, plan o modo de pedido, o una exportación con datos personales, recibe 403 aunque la pantalla no lo ofrezca.
- **Aceptación de M2:** la e2e del colaborador con sus límites.
- **Work items:** WI-T10.5.1 `[código]` · WI-T10.5.2 `[prueba]` la matriz · WI-T10.5.3 `[prueba]` e2e.

#### HU-T10.6 · El registro: quién hizo qué
- **Capa:** panel y API · **Prioridad:** Should · **Puntos:** 2 · **Sprint:** T8 · **Depende de:** HU-T8.1 · **Estado:** En validación (rama `feat/t8-sprint`. `apps/tienda-api/src/registro.ts`: cada escritura del catálogo y de las fotos deja su fila en el mismo lote, con el antes y el después. «Más → Registro» lo cuenta en frases («Tú cambiaste el precio de $129.000 a $119.000 en «Camisa de lino»»), de a páginas y con la hora de Bogotá. **CA2:** teléfonos, correos, documentos, direcciones y llaves quedan como su huella, a cualquier profundidad. Controles negativos: la fila guardada no tiene el dato personal; un rol fuera de la matriz no lee el registro; cada tienda ve solo el suyo; la e2e con el teléfono en Madrid muestra la hora de Bogotá)
- Como comerciante, quiero saber quién cambió un precio o un estado, y qué había antes.
- **Respaldo:** TIENDA §5.3 (`registro`); HU-C7.8 (la actividad en frases).
- **CA1.** Cada escritura del panel deja el antes y el después; la pantalla lo cuenta en frases, con la hora de Bogotá.
- **CA2 ❌.** Las llaves y los datos personales nunca están en el antes ni en el después: solo su huella.
- **Work items:** WI-T10.6.1 `[código]` · WI-T10.6.2 `[prueba]`.

#### HU-T10.7 · Descargar todo
- **Capa:** panel y API · **Prioridad:** Must · **Puntos:** 3 · **Sprint:** T11 · **Depende de:** HU-T12.2 · **Estado:** En validación (rama `feat/t11-sprint`. `apps/tienda-api/src/exportar.ts` y «Más → Descargar todo» (`vistas/Datos.tsx`). Sale `tienda-export/1` directo en la respuesta, sin copia en el almacén: ajustes sin el cobro, colecciones, productos con sus variantes, envíos, cupones, páginas y los pedidos cerrados, con las fotos por enlace. Lo que la carga no aceptaría se cuenta en `excluidos` con su razón. Las hojas CSV y XLSX se arman en el navegador (`app/exportar.ts`, con BOM y sin fórmulas). CA3: exportar, cargar en Ensayo Tres vacía y volver a exportar da las mismas huellas, tabla por tabla. Con datos personales, solo el propietario recién entrado, y queda en el registro. Las pruebas ❌ de CA2 y CA3 se vieron en rojo con su defecto)
- Como comerciante, quiero llevarme todos mis datos cuando quiera, en un formato que sirve para volver.
- **Respaldo:** TIENDA §1.3 («tus datos son tuyos») y §12.6; estudio §8.1 (datos).
- **CA1.** `tienda-export/1` en JSON, con las fotos por enlace; las hojas CSV y XLSX se arman en el navegador.
- **CA2.** Con datos personales: solo el propietario, con entrada reciente, y queda registrado.
- **CA3 ❌.** Exportar una tienda e importarla en una vacía da las mismas huellas, tabla por tabla.
- **Work items:** WI-T10.7.1 `[código]` · WI-T10.7.2 `[prueba]` ida y vuelta.

### ET11 · Cobro en línea con Bold

#### HU-T11.1 · `@ed1/pagos`: el adaptador sale del CORE y recibe las llaves en cada llamada
- **Capa:** paquete · **Prioridad:** Must · **Puntos:** 3 · **Sprint:** T12 · **Depende de:** — · **Estado:** En validación (rama `feat/t11.1-pagos`, PR aparte con permiso del dueño del 16 oct 2026. `packages/pagos` tiene `ProveedorDePago`, `proveedorBold(llaves, fetch)`, la firma de integridad y la tabla `ESTADOS_BOLD`; es un paquete puro, con la red como parámetro. El CORE solo cambia sus importaciones y sus pruebas pasan sin tocarlas. Lo que Bold diga y la tabla no conozca (`APPROVED_PARTIALLY`, `REFUNDED`, `constructor`…) es «revisar». Controles negativos: con «esperando» como respaldo, con `in` en vez de `Object.hasOwn` y con otra llave secreta, rojo)
- Como plataforma, quiero un solo adaptador de Bold para cobrar los planes y para cobrar las ventas de cada comercio.
- **Respaldo:** PLATAFORMA §6.2; análisis de integración §4.3; ED1 §5.3.
- **CA1.** `ProveedorDePago` y la traducción de los estados de Bold viven en `@ed1/pagos`; el CORE lo usa con sus llaves y la Tienda con las del comercio, pasadas en cada llamada.
- **CA2.** Las pruebas del CORE pasan sin cambios, y su entrada va al CHANGELOG del CORE (toca `apps/core/src`).
- **CA3 ❌.** Un estado de Bold que no se conoce se traduce a «revisar», nunca a «aprobado».
- **Patrones en riesgo:** P2; «heredar una solución es heredar su contexto» (bitácora agro, terreno).
- **Work items:** WI-T11.1.1 `[código]` · WI-T11.1.2 `[prueba]` · WI-T11.1.3 `[doc]` CHANGELOG del CORE.

#### HU-T11.2 · Las llaves de Bold del comercio
- **Capa:** panel, API y seguridad · **Prioridad:** Must · **Puntos:** 5 · **Sprint:** T14 (era T12) · **Depende de:** HU-T11.1, HU-T1.3, HU-T10.3, HU-T7.2 · **Estado:** En validación (rama `feat/t14-sprint`. La pantalla Más › Cobro, solo del propietario: los términos (HU-T7.2) y la cláusula de custodia, que se acepta aparte con su huella en el registro; el estado de las llaves en palabras por ambiente, con «Probar»; pegarlas, que pide entrada reciente; y las comisiones de TIENDA §9.7, atadas a la tabla por una prueba. `apps/tienda-api/src/llaves-de-bold.ts`: la de identidad se comprueba contra `payment-voucher` con una referencia que no existe; 404 es válida, 401 o 403 no, y si Bold no responde no se guarda nada. Las dos se cifran con la DEK `credenciales` (`credenciales.ts`, HU-T11.4) y el panel ve sus últimos 4. CA3: `yo` trae lo que falta para cobrar cuando el pago en línea está encendido, y el Inicio lo dice arriba y en rojo. CA4: la prueba de la API busca las dos llaves en cada respuesta, el registro, los logs, lo cifrado y lo horneado; la e2e, en `localStorage`, `sessionStorage`, IndexedDB, la consola y la dirección. Lo pegado no se guarda en el teléfono: si pide volver a entrar, se pega otra vez. Controles negativos: sin la custodia, sin la entrada reciente y con un 401 como válido, rojo. Falta WI-T11.2.3, del dueño: pegar las llaves de pruebas de Ensayo Dos en el panel de staging (Ensayo Uno lleno no se publica en staging hasta Workers Paid))
- Como comerciante, quiero conectar mi cuenta de Bold y saber que mi llave secreta está a salvo.
- **Respaldo:** TIENDA §9.2, §9.7 y §12.3; bitácora ecommerce 57 y crítico «la llave de pago estaba en el repositorio».
- **Boceto:** la pantalla Cobro: la cláusula para aceptar, las llaves de pruebas y de producción, «Probar», el estado en palabras, las comisiones por medio y «recibir el dinero de inmediato cuesta más».
- **CA1.** La aceptación de la cláusula de custodia queda en `registro` con su huella; pegar las llaves exige entrada reciente; se cifran con la DEK de credenciales y solo se ven sus últimos 4 caracteres.
- **CA2.** La de identidad se verifica contra `payment-voucher`: `NO_TRANSACTION_FOUND` es válida; 401 o 403 no, y se dice así.
- **CA3.** Con el modo en línea y llaves que faltan, el panel lo dice arriba, en rojo, con el nombre de lo que falta (bitácora ecommerce 57).
- **CA4 ❌.** Una prueba busca las llaves de prueba en los logs de las e2e, en las respuestas y en lo horneado: no están.
- **Work items:** WI-T11.2.1 `[código]` · WI-T11.2.2 `[prueba]` · WI-T11.2.3 `[dueño]` las llaves de pruebas de Ensayo Uno.

#### HU-T11.3 · El cobro de prueba guiado
- **Capa:** panel y vitrina · **Prioridad:** Must · **Puntos:** 3 · **Sprint:** T14 (era T12) · **Depende de:** HU-T11.2 (mismo sprint, antes), HU-T11.4 · **Estado:** En validación (rama `feat/t14-sprint`. CA1: en Más › Cobro en línea, «El cobro de prueba» va paso a paso: las llaves de pruebas, la dirección de los avisos para pegar en Bold (la del subdominio de la plataforma, TIENDA §9.4), recibir pagos en línea y publicar, pagar en la tienda y ver cómo va. La prueba la da por hecha solo un aviso firmado que aprueba un cobro de pruebas (la 0010 lo guarda en `tienda.prueba_aprobada`), también si la consulta de la página lo aprobó segundos antes; aprobado sin aviso, el panel dice que revise la dirección en Bold. CA2: con el pago en línea en pruebas, cada página horneada empieza con la franja «Tienda en pruebas» (`cobroEnPruebas`); la compuerta ya no detiene el pago en línea: pide las llaves del ambiente en que cobra. CA3: pasar `cobro.ambiente` a producción lo niega la API sin la prueba aprobada o sin las llaves de producción, y la compuerta igual. Se encontró que pasar a producción sin publicar habría cobrado de verdad con la franja «en pruebas» a la vista: cada versión publicada guarda su ambiente (`publicacion.cobro_ambiente`) y el cobro usa el de la versión que se muestra. Runbook: `docs/runbooks/tienda-cobro-de-prueba.md`. Controles negativos: sin marcar la prueba cuando el aviso llega después de la consulta, sin el freno a producción y guardando producción en la versión de pruebas, rojo. Falta WI-T11.3.3, del dueño: el pago de prueba con Ensayo Dos en staging)
- Como comerciante, quiero hacer un pago de prueba de verdad antes de cobrarle a un cliente.
- **Respaldo:** TIENDA §9.2 (4); P16.
- **CA1.** El panel guía un pago en el ambiente de pruebas de Bold desde la propia tienda, y comprueba la firma de integridad y el aviso.
- **CA2.** Mientras la tienda esté en pruebas, una franja lo dice en todas sus páginas.
- **CA3 ❌.** Sin un cobro de prueba aprobado, el panel no deja pasar a producción.
- **Work items:** WI-T11.3.1 `[código]` · WI-T11.3.2 `[prueba]` · WI-T11.3.3 `[dueño]` el pago de prueba.

#### HU-T11.4 · Apartar y cobrar en un lote: el botón de Bold
- **Capa:** vitrina y API · **Prioridad:** Must · **Puntos:** 5 · **Sprint:** T12 · **Depende de:** HU-T11.1, HU-T5.5, HU-T2.1 · **Estado:** En validación (rama `feat/t12-sprint`. `POST /api/v1/cobros` escribe en un lote el pedido `por_pagar` con su aceptación, las líneas, la entrega cifrada, el historial, el cobro `<código>-1` por 15 minutos y un apartado por línea; el botón sale firmado con `@ed1/pagos` y embebido, y la llave secreta no sale en ninguna respuesta. Las llaves se leen cifradas de `credencial` (`credenciales.ts`, que HU-T11.2 usará para guardarlas). En la vitrina, «En línea» pide nombre y celular, abre Bold y guarda en `sessionStorage` solo el token; antes de abrir Bold deja el enlace del pedido a la vista, y `/pedido/pago/` lleva a él sin creer lo que dice la dirección. La CSP deja cargar `checkout.bold.co` solo en `/carrito/`. **Límite por IP: 3 por minuto**, no cada 15 minutos: el limitador de Workers no cuenta 15 minutos (bitácora tienda3 11); lo que los 15 minutos agregaban lo cuida el tope de 40 cobros abiertos por tienda. Se encontró que lo vencido tenía que vencer antes de cotizar (bitácora tienda3 23). La compuerta sigue sin publicar una tienda que cobra en línea hasta el cobro de prueba guiado (HU-T11.3), y nadie puede guardar llaves hasta HU-T11.2. Controles negativos: sin apartados, sin vencer antes de cotizar, firmando con la identidad, sin el tope, sin el kill switch, sin comparar el token y guardando la entrega en la sesión, rojo)
- Como comprador, quiero pagar en línea y que nadie más se lleve la última unidad mientras pago.
- **Respaldo:** TIENDA §7.2 y §9.3; bitácora ecommerce 40 (apartar antes de cobrar) y 46 (datos del comprador en `sessionStorage`).
- **CA1.** Un solo lote: vencer lo vencido de esas variantes, contador, pedido `por_pagar` con su aceptación, líneas, contacto cifrado, cobro `esperando` por 15 minutos y apartados.
- **CA2.** La firma es `SHA-256(orderId + amount + "COP" + llave secreta)` y el botón va embebido; la página guarda en `sessionStorage` solo el token opaco del cobro, sin datos del comprador.
- **CA3 ❌.** Dos compradores por la última unidad: el segundo falla entero, sin pedido, sin cobro y sin gastar consecutivo. 40 cobros abiertos por tienda y 3 por IP cada 15 minutos.
- **Consumo y kill switch:** unas 40 filas escritas por pago de 2 líneas; `ks:tienda-cobros` apaga el pago en línea y deja el pedido por WhatsApp.
- **Work items:** WI-T11.4.1 `[código]` · WI-T11.4.2 `[prueba]` la última unidad · WI-T11.4.3 `[prueba]` lo guardado no tiene datos del comprador.

#### HU-T11.5 · Los avisos firmados de Bold
- **Capa:** API · **Prioridad:** Must · **Puntos:** 5 · **Sprint:** T13 · **Depende de:** HU-T11.4 · **Estado:** En validación (rama `feat/t13-sprint`. `POST /api/v1/avisos/bold` verifica la firma sobre el cuerpo crudo antes de leerlo, con la secreta de producción de la tienda y con la llave de pruebas (64 bytes en cero, fijada con un vector calculado aparte); la llave que firma dice el ambiente, y la referencia del aviso, el cobro. Un aviso de otro ambiente, de un cobro que no existe o de otra tienda no escribe ni una fila (bitácora tienda3 24). En un lote: `aviso_proveedor`, el cobro, los apartados, el inventario una vez por línea, el pedido y su historial; aprobado tarde sin unidades queda `aprobado_sin_existencias` con el pedido pagado y su atención; otro monto, `revisar`; la anulación que llega antes que su venta queda `ignorado` y se aplica al llegar la venta. Responde 401 a la firma inválida, 400 a lo ilegible, 500 si algo falla y 503 con `ks:tienda` apagado, para que Bold reintente. El runbook es `docs/runbooks/tienda-avisos-de-bold.md`. Controles negativos: la llave de pruebas sin rellenar, sin comparar el ambiente, sin `aviso_proveedor`, sin el camino sin existencias, sin reaplicar la anulación y sin comparar el monto, rojo)
- Como comerciante, quiero que un pago aprobado se refleje solo, y que nadie pueda fingirlo.
- **Respaldo:** TIENDA §9.4; P9 y P17.
- **CA1.** `POST /api/v1/avisos/bold` en el subdominio de la plataforma: HMAC-SHA256 de la base64 del cuerpo crudo con la secreta del ambiente del cobro, comparado en tiempo constante, antes de leer el JSON.
- **CA2.** En pruebas, la llave vacía se reemplaza por 64 bytes en cero (la prueba lo fija con un vector conocido), y un aviso solo mueve cobros de su mismo ambiente.
- **CA3.** Idempotente por `aviso_proveedor`; responde 200 en menos de 2 s; una anulación que llega antes que su venta queda `ignorado` y se reaplica después.
- **CA4 ❌.** Una firma inválida, un cuerpo alterado o un aviso de pruebas sobre un cobro de producción no mueven nada.
- **Lo publicado (P10):** la dirección del aviso no cambia aunque la tienda estrene dominio; el slug no se cambia después de publicar.
- **Work items:** WI-T11.5.1 `[código]` · WI-T11.5.2 `[prueba]` vectores con llave real y vacía · WI-T11.5.3 `[doc]` runbook «registrar el aviso en Bold».

#### HU-T11.6 · Consultar a Bold y conciliar
- **Capa:** API y cron · **Prioridad:** Must · **Puntos:** 3 · **Sprint:** T13 · **Depende de:** HU-T11.5, HU-T17.1 · **Estado:** En validación (rama `feat/t13-sprint`. `POST /api/v1/cobros/estado` recibe solo el token del cobro: si sigue esperando y la última consulta tiene más de 20 s, le pregunta a Bold con la identidad de su ambiente y aplica la respuesta en el mismo sitio que los avisos (`aplicarRespuesta`); si Bold falla, responde lo que hay. Comparte el límite por IP del seguimiento. **La vuelta del cron es cada hora, no cada 15 minutos**: la cuenta tiene un solo cron (HU-T17.1, D-T10); la espera de 5, 15, 30 y 60 minutos y las 20 consultas por tienda quedan como dice CA1. A las 24 h, `vencido` sin preguntar más; el pedido sigue por pagar para que un aviso tardío todavía lo pague (§7.3). Un 429 salta la tienda en la vuelta y avisa por Telegram; `@ed1/pagos` lo distingue con `ErrorDeBold`. Un estado de Bold que nadie leyó sigue esperando, con un log que lo nombra. Controles negativos: sin los 20 s, sin el tope de 20, sin vencer, sin saltar en el 429, sin la espera creciente, `VOIDED` como rechazo y un estado desconocido como aprobado, rojo)
- Como comprador que pagó y cerró la página, quiero que mi pedido igual quede pagado.
- **Respaldo:** TIENDA §9.5.
- **CA1.** Desde la página, como mucho una consulta a Bold cada 20 s por cobro. El cron de 15 minutos revisa los que esperan sin aviso, con espera de 5, 15, 30 y 60 minutos y 20 consultas por tienda por vuelta.
- **CA2.** A las 24 h sin noticias, `vencido`; un 429 salta esa tienda en la vuelta y avisa.
- **CA3 ❌.** `NO_TRANSACTION_FOUND` y `PENDING` siguen esperando; nunca se aprueba por lo que diga la vuelta del navegador.
- **Work items:** WI-T11.6.1 `[código]` · WI-T11.6.2 `[prueba]` con un Bold falso que firma y responde de verdad (P17).

#### HU-T11.7 · Cada respuesta de Bold, con su camino
- **Capa:** API y panel · **Prioridad:** Must · **Puntos:** 3 · **Sprint:** T13 · **Depende de:** HU-T11.5 · **Estado:** En validación (rama `feat/t13-sprint`. Cada fila de TIENDA §7.3 tiene su prueba en `avisos.test.ts` y `conciliar.test.ts`; se sumaron aprobado tarde con unidades, desde `vencido`, y la anulación después del pago. En la bandeja, «Pagado sin existencias» va antes que toda otra atención, con la fecha del pago, y el panel cuenta 15 días calendario de Bogotá: «quedan N días para reponer o devolver el dinero», y pasado el plazo lo sigue diciendo. **Despacharlo es haber repuesto**: lo que no salió del inventario sale al despachar, y si todavía no alcanza, no se despacha y dice qué combinación falta; despachado, deja de pedir atención. Devolver el dinero es cancelarlo y anular el pago en Bold, que llega como `reembolsado`. Controles negativos: sin ponerlo arriba, sin descontar al despachar, sin quitar la atención, el rechazo como pagado, los días en UTC y el reloj que se queda en cero, rojo)
- Como comerciante, quiero que el caso raro (otro monto, pagó tarde, ya no hay) me llegue arriba y con qué hacer.
- **Respaldo:** TIENDA §7.3; P1 y P15.
- **CA1.** Cada fila de TIENDA §7.3 es un caso de prueba: aprobado, otro monto (`revisar`), aprobado tarde con unidades y sin ellas, rechazado, vencido y anulado (`reembolsado`).
- **CA2.** «Pagado sin existencias» aparece arriba en el panel, con su reloj de 15 días calendario para reponer o devolver.
- **CA3 ❌.** Ningún caso fallido parece un pago confirmado (estudio §16.3, confiabilidad del cobro).
- **Work items:** WI-T11.7.1 `[código]` · WI-T11.7.2 `[prueba]`.

#### HU-T11.8 · Links de pago para el pedido que llegó por el chat
- **Capa:** panel y API · **Prioridad:** Must · **Puntos:** 3 · **Sprint:** T14 · **Depende de:** HU-T11.5 · **Estado:** En validación (rama `feat/t14-sprint`. `apps/tienda-api/src/links.ts` y «Cobrar con link» en el detalle del pedido. Primero se le pide el link a Bold (`crearLink` de `@ed1/pagos`, `POST /online/link/v1`, monto cerrado, la referencia del cobro y el vencimiento en nanosegundos, según la documentación de Bold «API Link de pagos»); después, en un lote, el pedido pasa a en línea y por pagar, nace el cobro con su link (la 0011 guarda el id y la dirección) y se aparta cada línea. Si Bold no responde nada cambia; si no hay unidades, tampoco. El panel arma el mensaje y abre WhatsApp con un enlace, sin número si el pedido no lo tiene. CA2: al vencer, la vuelta del cron y el panel al abrir el pedido le preguntan a Bold una última vez por el link (`consultarLink`); pagado, se aprueba; si no, lo apartado se libera y el pedido vuelve a pendiente, a convenir. El aviso trae la referencia del cobro, así que pagado dos veces es `repetido` o `ignorado` y descuenta una vez. Un rechazo de un link también devuelve la forma a convenir. Controles negativos: sin la última pregunta a Bold y sin devolver la forma, rojo. Falta WI-T11.8.3, del dueño: un pago con link en el ambiente de pruebas de Bold, la aceptación de M3)
- Como comerciante, quiero cobrar en línea un pedido de WhatsApp mandándole al cliente un link.
- **Respaldo:** TIENDA §9.6; estudio §8.1 [C3] (canal conversacional con link de pago).
- **CA1.** «Cobrar con link» en un pedido pendiente: el pedido pasa a en línea y por pagar, las unidades se apartan hasta el vencimiento (60 minutos por defecto, máximo 24 h) y el panel abre `wa.me` con el link.
- **CA2 ❌.** Un link vencido libera lo apartado y devuelve el pedido a pendiente; un link pagado dos veces no cuenta dos pagos.
- **Aceptación de M3:** un pago real con link en el ambiente de pruebas de Bold.
- **Work items:** WI-T11.8.1 `[código]` · WI-T11.8.2 `[prueba]` · WI-T11.8.3 `[dueño]` el pago de prueba con link.

#### HU-T11.9 · Volver de Bold sin perder el pedido
- **Capa:** vitrina · **Prioridad:** Must · **Puntos:** 2 · **Sprint:** T13 · **Depende de:** HU-T11.4, HU-T6.3 · **Estado:** En validación (rama `feat/t13-sprint`. Antes de abrir Bold, el enlace del pedido queda a la vista con «Copiar el enlace» y «Mandármelo por WhatsApp», y en el `localStorage` de la tienda; el correo en el acuse llega con HU-T14.3. En `/pedido/pago/` la página pregunta con el token de la sesión (`POST /api/v1/cobros/estado`, HU-T11.6): pagado, vacía el carrito y lleva al pedido; en proceso, lleva al pedido sin tocar el carrito; rechazado o vencido, deja los productos en el carrito con otro código y ofrece volver a él, porque el pedido de ese pago ya no se puede pagar otra vez. Sin token (otro navegador), explica cómo encontrar el pedido, sin un error; si este navegador guardó el enlace, lo abre. La e2e paga en un contexto y vuelve en otro. Controles negativos: sin renovar el carrito, sin preguntar con el token y sin la explicación, rojo)
- Como comprador que pagó con PSE y volvió en otro navegador, quiero igual encontrar mi pedido.
- **Respaldo:** TIENDA §8.4 y §9.3; bitácora ecommerce 47 y 61; bitácora tienda3 3 (PT1).
- **CA1.** Antes de abrir Bold, la página entrega el enlace de seguimiento para guardarlo (copiarlo o mandárselo por WhatsApp) y lo deja en el `localStorage` de la tienda. Si la persona dejó correo, va también en el acuse (desde HU-T14.3).
- **CA2.** Al volver, la página pregunta con el token del cobro; si no lo tiene, explica cómo encontrar el pedido, sin mostrar un error.
- **CA3 ❌.** Una e2e paga en un contexto de navegador y vuelve en otro: la persona llega a su pedido con el enlace que guardó, y en el primero no pierde el carrito (bitácora ecommerce 47).
- **Work items:** WI-T11.9.1 `[código]` · WI-T11.9.2 `[prueba]` · WI-T11.9.3 `[doc]` TIENDA §9.3.

#### HU-T11.10 · La batería de caos y de carga
- **Capa:** prueba · **Prioridad:** Must · **Puntos:** 3 · **Sprint:** T14 · **Depende de:** HU-T11.4 a HU-T11.8 · **Estado:** En validación (rama `feat/t14-sprint`. CA1: `apps/tienda-api/src/caos.test.ts`, contra el D1 de workerd y con todo a la vez: la última unidad entre 50 compradores, 100 cobros, avisos repetidos y en desorden con anulaciones antes de su venta, Bold con 500 y con 429, un KV con un hostname de una versión que ya no existe y publicar mientras entran 20 pedidos. CA3: después de cada caso, ninguna combinación con más apartado del que hay, ningún pedido con dos cobros aprobados, ninguna línea que salga dos veces del inventario y ningún pedido pagado sin un cobro que Bold aprobara. La batería encontró que el tope de 40 cobros abiertos se contaba antes del lote y con 100 a la vez quedaban 101 abiertos (bitácora tienda3 33): ahora se cuenta dentro del lote. CA2: el despacho gasta unos 0,1 ms de CPU por página en caliente (`tienda-vitrina.test.ts`, tope 2 ms), y `scripts/tienda/carga-de-staging.ts` con el flujo `carga-staging-tienda` carga las páginas y `cotizar` de un comercio de prueba: ningún 5xx, p95 de menos de 1,5 s, y el 429 del límite por IP. Controles negativos: con el tope contado fuera del lote, la de los 100 cobros queda en rojo; una página caída y un limitador ausente son fallas del script. Falta, del dueño: correr `carga-staging-tienda`, y si quiere, la regla de límite por visitante de la zona)
- Como dueño, quiero ver el cobro aguantar lo peor antes de un cliente real.
- **Respaldo:** TIENDA §14.1 y §16 (caos).
- **CA1.** La última unidad entre 50 compradores; 100 cobros simultáneos; avisos repetidos y en desorden; Bold con 5xx y 429; un KV con un hostname viejo; publicar mientras entran pedidos.
- **CA2.** Prueba de carga del despacho y de la API contra staging, con la regla de límite de la zona; la CPU del despacho por debajo de 2 ms por página (HU-T5.1).
- **CA3 ❌.** En ninguna corrida se vende de más, se cobra dos veces ni un caso fallido parece pagado.
- **Aceptación de M3:** la batería en verde.
- **Work items:** WI-T11.10.1 `[prueba]` · WI-T11.10.2 `[doc]` resultados en la bitácora.

#### HU-T11.11 · La revisión de seguridad antes del primer cobro real
- **Capa:** seguridad · **Prioridad:** Must · **Puntos:** 3 · **Sprint:** T14 · **Depende de:** HU-T11.10 · **Estado:** En validación (rama `feat/t14-sprint`. `docs/seguridad/revision-tienda-2026-10-19.md`: la tabla de TIENDA §14.1 contra lo construido, con el control y la prueba de cada amenaza (CA1). Ocho hallazgos: el tope de cobros que no aguantaba la concurrencia, los avisos sin tope por IP (ahora `LIMITE_AVISOS`, 60 por minuto, antes de leer el cuerpo), la franja «en pruebas» con cobro de verdad, las releases viejas sin servir y dos dependencias del build, todos remediados; la regla de límite de la zona, pendiente del dueño; dos bajos aceptados. CA2: ningún hallazgo alto abierto en lo construido; la toma de subdominios y la suspensión con un clic tienen su historia en M4, y los agentes en M7. Falta, del dueño: la regla de *Rate limiting* de la zona antes de la primera tienda real)
- Como dueño, quiero que alguien busque los huecos antes de guardar llaves y datos de comercios reales.
- **Respaldo:** análisis de integración §8 («revisión de seguridad antes del primer cobro real»); TIENDA §14.1; `docs/seguridad/`.
- **CA1.** La tabla de amenazas de TIENDA §14.1 contra lo construido, con cada hallazgo, su arreglo y su prueba en `docs/seguridad/`.
- **CA2 ❌.** Ningún hallazgo alto queda abierto al abrir el alta (M4; era «al empezar M6»).
- **Work items:** WI-T11.11.1 `[prueba]` revisión · WI-T11.11.2 `[código]` arreglos · WI-T11.11.3 `[doc]`.

### ET12 · Carga asistida y referencia de la 2.0

*El 13 oct 2026 el dueño decidió que ninguna tienda 2.0 se migra (bitácora tienda3 9). Quedan HU-T12.1, la referencia, y la carga asistida de un comercio nuevo desde un archivo (HU-T12.2 y HU-T12.3); la conversión desde la hoja de la 2.0, la paridad como condición, la marca de vuelta y los cortes salieron del plan.*

#### HU-T12.1 · Qué usa hoy cada tienda 2.0
- **Capa:** producto · **Prioridad:** Must · **Puntos:** 1 · **Sprint:** T0 · **Depende de:** — · **Estado:** Terminada (`docs/tienda/paridad-tiendas-2.0.md`, contestada por el dueño el 13 oct 2026; desde entonces es referencia, no condición: ninguna tienda 2.0 se migra. El 13 oct 2026 el dueño contestó para las dos tiendas: cobran con Bold (y vendrán otras pasarelas), ofrecen contraentrega, usan cupones, «Avísame» y correos, y la tienda activa paga 25.000 al mes. Los correos se adelantaron a T13 (bitácora tienda3 8); quedan seis preguntas, reescritas en §4 del documento. La parte pública ya cambió el plan: las dos tiendas que venden son de la **Tienda Básica** (solo la hoja, 3.6.2), no de la Tienda Panel con la que se escribió el anexo C, y ninguna tiene dominio propio: viven en `workers.dev` (bitácora tienda3 6). La segunda parte son 11 preguntas de sí, no o una cifra para el dueño. No se leyó el repositorio privado de una tienda real: tiene datos de su operación, y la herramienta lo detuvo; lo que hace falta lo sabe el dueño)
- Como dueño, quiero saber desde ya qué de la 2.0 usa cada tienda, para que el orden del plan no lo descubra el día del corte.
- **Respaldo:** TIENDA §17.3 y anexo C; estudio §15.3 [C12] y §16.2 (preguntas 8 y 9); bitácora tienda3 1.
- **CA1.** Una tabla por tienda con cada puerta del anexo C, más: dominio propio, GA4 o píxel de Meta, los correos que manda, páginas propias, cobro en línea, contraentrega, volumen de pedidos y qué tan cerca está de cada techo de la 2.0.
- **CA2.** Lo que una tienda usa y el plan deja después de M6 se mueve antes, y el plan lo dice (§6).
- **CA3 ❌.** Ninguna fila queda en «no sé» sin una pregunta concreta para el comercio.
- **Work items:** WI-T12.1.1 `[doc]` la lista, desde el anexo C y el repositorio de la 2.0 · WI-T12.1.2 `[dueño]` las respuestas y, si se puede, las preguntas 8 y 9 del estudio a los dos comercios.

#### HU-T12.2 · `tienda-import/1`: revisar y aplicar por partes
- **Capa:** API y script · **Prioridad:** Must · **Puntos:** 5 · **Sprint:** T6 · **Depende de:** HU-T1.4, HU-T2.8 · **Estado:** En validación (rama `feat/t6-sprint`. Sobre el formato de HU-T1.4 (`revisarCarga` de `@ed1/tienda-schema`, P2): `apps/tienda-api/src/importar.ts` revisa también lo que solo se ve al planear o contra la base (direcciones repetidas, una línea histórica sin su variante, un estado imposible para su forma de pago, un código que ya es de un pedido de la tienda) y responde todo a la vez sin escribir (CA1). Aplicar va por la API del panel con el permiso `importar` (`/api/panel/v1/importar/revisar` y `/aplicar`), en partes de a 40 sentencias, cada una un lote atómico, dentro del límite del plan gratuito; cada sentencia inserta o actualiza por `ref_externa` (o su clave natural) **solo si algo cambió**, así dos cargas iguales no cambian nada, y nunca borra (CA4); el cambio de existencias deja su movimiento con motivo `carga`. Los pedidos históricos entran con canal `carga`, sin datos personales, y nunca se reescriben (CA3). La tabla `importacion` anota en qué va cada archivo. `scripts/tienda/cargar.ts` revisa y, con `--aplicar`, aplica parte por parte con el token en `TIENDA_TOKEN`; las fotos se cuentan y se suben con HU-T8.3. **Cambió (CA2):** las escrituras del panel aún no existen; estas sentencias son las que reusarán sus pantallas (HU-T8.x). Controles negativos: la segunda carga deja la base idéntica; una parte con una sentencia rota no deja nada escrito; un colaborador sin el permiso recibe 403; un archivo con problemas no se aplica ni por partes; un histórico con datos del comprador no se carga)
- Como operador, quiero cargar una tienda entera desde un archivo, ver antes todos los problemas, y no duplicar nada si la corro dos veces.
- **Respaldo:** TIENDA §17.1; P15 y P21.
- **CA1.** «Revisar» responde todos los problemas a la vez sin escribir; «Aplicar» va por partes, dentro de los límites de D1, idempotente por `ref_externa`.
- **CA2.** La carga pasa por la misma lógica que las escrituras del panel; nunca escribe en D1 por fuera (P21: lo que escribe un script pasa por las reglas de una persona).
- **CA3.** Los pedidos históricos entran con canal `carga` y sin datos personales, salvo que el comercio confirme que tiene la autorización de sus compradores.
- **CA4 ❌.** Cargar dos veces el mismo archivo no cambia nada; un error a la mitad no deja la tienda a medias, y nada se borra antes de escribir.
- **Work items:** WI-T12.2.1 `[código]` revisar y aplicar · WI-T12.2.2 `[código]` `scripts/tienda/cargar.ts` mínimo (JSON y fotos locales) · WI-T12.2.3 `[prueba]`.

#### HU-T12.3 · `scripts/tienda/cargar.ts`: las fotos de una tienda, desde la máquina del dueño
- **Capa:** script · **Prioridad:** Must · **Puntos:** 3 · **Sprint:** T14 · **Depende de:** HU-T12.2, HU-T8.3 · **Estado:** En validación (rama `feat/t14-sprint`. `scripts/tienda/fotos-de-la-carga.ts`, que `cargar.ts` corre después de aplicar: baja cada foto del archivo, le saca la huella al original, hace las derivadas con `sharp` y las sube por `medios/subir` con el token del operador. Reusa del panel `derivar`, `huellaDe` y `formularioDeFoto` (P2): mismo nombre por huella, mismas derivadas en WebP o JPEG y el original nunca sale. El id del producto lo da `idDelProductoCargado`, el mismo que usa la carga. CA3: la que no se baja, no se abre, es muy pequeña o el panel no guarda se dice con su producto y su dirección, las demás siguen, y si faltó alguna sale con 1; volver a correrlo termina. CA2: `sharp` 0.34 trae sus binarios por plataforma y su script de instalación queda sin correr (`allowBuilds`); la prueba lo usa de verdad y corre en `scripts-windows`. Controles negativos: una foto de 300 px, una que no es foto y una que no está, cada una con su motivo)
- Como operador, quiero que el script baje las fotos de una tienda, haga sus derivadas y las suba con la carga.
- **Respaldo:** TIENDA §17.2; ADR-18; P3.
- **CA1.** Descarga las fotos, genera las de 400, 800 y 1600 px con el mismo nombre por huella que el panel y las sube por la API con el token del operador.
- **CA2.** Corre en Windows: lo prueba el trabajo `scripts-windows`.
- **CA3 ❌.** Una foto que no se puede bajar se reporta con su producto y no detiene las demás; el resumen dice cuántas faltaron.
- **Work items:** WI-T12.3.1 `[código]` · WI-T12.3.2 `[prueba]`.

#### HU-T12.4 · `scripts/tienda/desde-2.0.ts`: de la hoja al formato de carga
- **Capa:** script · **Prioridad:** Must · **Puntos:** 3 · **Sprint:** — · **Depende de:** HU-T12.2 · **Estado:** Retirada (13 oct 2026: ninguna tienda 2.0 se migra a la 3.0; bitácora tienda3 9)
- Como operador, quiero convertir la hoja de una tienda 2.0 al formato de carga, leyendo cada columna por su nombre.
- **Respaldo:** TIENDA §17.2; bitácora ecommerce, crítico «`Number(celda) || 0`»; bitácora agro, terreno («proponer un formato que nadie leyó es aplazar el error»).
- **CA1.** Lee la exportación XLSX por nombre de columna; el mapa de columnas vive solo en este script (la 3.0 no conoce la 2.0).
- **CA2 ❌.** Una celda ilegible (`$9.000`, `9,000`, vacía donde no puede) se reporta con hoja, fila y columna; nunca se vuelve 0.
- **Work items:** WI-T12.4.1 `[código]` · WI-T12.4.2 `[prueba]` con una hoja de ejemplo sin datos reales.

#### HU-T12.5 · La lista de paridad, como pruebas de contrato
- **Capa:** prueba · **Prioridad:** Must · **Puntos:** 5 · **Sprint:** — · **Depende de:** HU-T12.1, M3 · **Estado:** Retirada (13 oct 2026: ninguna tienda 2.0 se migra a la 3.0; bitácora tienda3 9)
- Como dueño, quiero saber que la 3.0 hace todo lo que cada tienda usa de la 2.0 antes de cargarla.
- **Respaldo:** TIENDA anexo C; estudio §15.3 [C12].
- **CA1.** Cada cosa que la tienda usa (HU-T12.1) tiene su comprobación en staging, y los casos de pedido, cobro y seguimiento de la suite de la 2.0 están traducidos a la batería de la API. *(6 oct 2026: las dos tiendas que venden son de la Tienda Básica; la paridad se mide contra lo que hace su hoja, no contra las puertas de la Tienda Panel del anexo C: bitácora tienda3 6.)*
- **CA2.** Los cinco mecanismos de idempotencia del pedido tienen su prueba.
- **CA3 ❌.** Una fila que la tienda usa y no pasa detiene su corte, y el informe dice cuál.
- **Work items:** WI-T12.5.1 `[prueba]` · WI-T12.5.2 `[doc]` el estado de la paridad por tienda.

#### HU-T12.6 · La marca de vuelta y la redirección desde la zona vieja
- **Capa:** despacho y operación · **Prioridad:** Must · **Puntos:** 2 · **Sprint:** — · **Depende de:** HU-T5.1 · **Estado:** Retirada (13 oct 2026: ninguna tienda 2.0 se migra a la 3.0; bitácora tienda3 9)
- Como dueño, quiero poder volver a la 2.0 en minutos si algo sale mal con una tienda.
- **Respaldo:** TIENDA §17.3 (pasos 3 a 5); estudio §15.3 [C12].
- **CA1.** `vuelta:<org>` en el KV de flags hace que el despacho responda 302 a la dirección de la 2.0, con la ruta, en todos los hostnames de la tienda.
- **CA2.** La regla 301 de la zona vieja hacia la dirección nueva se genera; no se pone a mano en el panel de Cloudflare (bitácora agro 19).
- **CA3 ❌.** Al quitar la marca, la tienda vuelve a la 3.0 sin re-hornear.
- **Work items:** WI-T12.6.1 `[código]` · WI-T12.6.2 `[prueba]` · WI-T12.6.3 `[doc]` runbook del corte.

#### HU-T12.7 · El corte de la primera tienda
- **Capa:** operación · **Prioridad:** Must · **Puntos:** 3 · **Sprint:** — · **Depende de:** HU-T12.3 a HU-T12.6, HU-T11.11, HU-T17.4 · **Estado:** Retirada (13 oct 2026: ninguna tienda 2.0 se migra a la 3.0; bitácora tienda3 9)
- Como comerciante, quiero pasar a la 3.0 sin dejar de vender un día.
- **Respaldo:** TIENDA §17.3; ADR-21. Va primero la que esté más cerca de un techo de la 2.0 (HU-T12.1).
- **CA1.** Carga en borrador con `noindex`, revisión con el comercio y corte: la 2.0 cerrada con un mensaje que lleva a la dirección nueva y la marca de vuelta lista.
- **CA2.** Una semana vendiendo en la 3.0 sin volver atrás.
- **CA3 ❌.** Ningún pedido se pierde: los de la 2.0 hasta el corte quedan en su hoja, y los de la 3.0 en su exportación.
- **Work items:** WI-T12.7.1 `[dueño]` la fecha con el comercio · WI-T12.7.2 `[código]` lo que salga · WI-T12.7.3 `[doc]` entrada en la bitácora.

#### HU-T12.8 · El corte de la segunda tienda
- **Capa:** operación · **Prioridad:** Must · **Puntos:** 2 · **Sprint:** — · **Depende de:** HU-T12.7 · **Estado:** Retirada (13 oct 2026: ninguna tienda 2.0 se migra a la 3.0; bitácora tienda3 9)
- Como comerciante, quiero lo mismo que la primera, con lo que la primera enseñó.
- **Respaldo:** TIENDA §17.3; P6.
- **CA1.** El mismo runbook, corregido con lo de la primera.
- **CA2.** Pasados 30 días sin volver atrás, se quita la marca y se retira la 2.0; la hoja queda con el comercio (P21).
- **CA3 ❌.** El runbook que se usa es el del repositorio, no notas aparte (P18).
- **Aceptación de M6:** cada tienda vende una semana en la 3.0 sin volver atrás.
- **Work items:** WI-T12.8.1 `[dueño]` · WI-T12.8.2 `[doc]`.

### ET13 · Dominios propios, alta abierta y plan

#### HU-T13.1 · Conectar un dominio propio, sin un minuto sin HTTPS
- **Capa:** API, panel e infraestructura · **Prioridad:** Must · **Puntos:** 5 · **Sprint:** T15 · **Depende de:** HU-C11.5, HU-T10.3 · **Estado:** Refinada
- Como comerciante, quiero que mi tienda viva en `www.midominio.co`, con instrucciones que entienda.
- **Respaldo:** TIENDA §4.2 y §4.4; ADR-27; ED1 [HA2].
- **Boceto:** escribe su dominio → tres registros explicados en palabras, con botón para copiar → un estado que se actualiza solo: pendiente, validando, activo, o error con su motivo.
- **CA1.** `CF_SAAS_TOKEN` con permiso solo sobre los hostnames de la zona, verificado con esa acción antes de usarse (P12); prevalidación del certificado y propiedad por TXT.
- **CA2.** Un cron cada 5 minutos, y la pantalla al abrirse, preguntan el estado.
- **CA3 ❌.** Reclamar un hostname retirado sin el TXT falla; nunca se pide mover el DNS del comercio a la cuenta del ecosistema.
- **Aceptación de M4:** un dominio de prueba conectado sin un solo minuto sin HTTPS.
- **Work items:** WI-T13.1.1 `[código]` · WI-T13.1.2 `[infra]` el token · WI-T13.1.3 `[prueba]` · WI-T13.1.4 `[dueño]` el dominio de prueba.

#### HU-T13.2 · Canónico y alias
- **Capa:** despacho y horno · **Prioridad:** Must · **Puntos:** 3 · **Sprint:** T15 · **Depende de:** HU-T13.1 · **Estado:** Refinada
- Como comerciante, quiero que Google vea una sola dirección de mi tienda.
- **Respaldo:** TIENDA §4.2 (pasos 5 y 6) y §11.1.
- **CA1.** Al elegir el canónico, el subdominio pasa a alias y responde 301 con la ruta y la consulta intactas; la versión vigente se re-hornea con el canónico (sitemap, canónicos, JSON-LD y feeds).
- **CA2 ❌.** `/api/*` y el aviso de Bold nunca se redirigen: un 301 a un POST no lo sigue cualquier cliente.
- **Work items:** WI-T13.2.1 `[código]` · WI-T13.2.2 `[prueba]`.

#### HU-T13.3 · El dominio sin «www»
- **Capa:** panel y documentación · **Prioridad:** Should · **Puntos:** 2 · **Sprint:** T15 · **Depende de:** HU-T13.1 · **Estado:** Refinada
- Como comerciante, quiero que `midominio.co`, sin «www», también llegue a mi tienda.
- **Respaldo:** TIENDA §4.3.
- **CA1.** Si el DNS del comercio aplana CNAME, la raíz es otro hostname que redirige a «www»; si no, el panel explica cómo redirigirla con los registradores más comunes del país.
- **CA2 ❌.** Nunca se ofrece mover la zona a la cuenta del ecosistema ([HA2]).
- **Work items:** WI-T13.3.1 `[código]` · WI-T13.3.2 `[doc]` instrucciones.

#### HU-T13.4 · El alta de una tienda por el comercio
- **Capa:** panel, API y CORE · **Prioridad:** Must · **Puntos:** 5 · **Sprint:** T16 · **Depende de:** HU-T2.2, HU-T7.2, HU-C3.2; HU-C10.2 para entrar sin Google · **Estado:** Refinada
- Como comerciante nuevo, quiero abrir mi tienda solo, en minutos, desde el teléfono.
- **Respaldo:** TIENDA §4.4 y §13.3 (`alta`); análisis de integración §5; ED1 §3.7 (owner-first).
- **Boceto:** nombre y dirección (`<nombre>.laboratorio-digital.app`, que dice al escribir si está libre) → aceptar términos y contrato → asistente: datos legales, WhatsApp y el primer producto → vista previa → publicar.
- **CA1.** Turnstile en el alta; el nombre cumple sus reglas y no está reservado; se crean la organización en el CORE, la tienda, el nombre y el hostname.
- **CA2.** Las formas de pago de fábrica son las de D-T4.
- **CA3 ❌.** Un nombre reservado o de suplantación se rechaza con su motivo; dos altas con el mismo nombre a la vez: una gana y la otra recibe «ese nombre ya está tomado».
- **Work items:** WI-T13.4.1 `[código]` · WI-T13.4.2 `[prueba]` · WI-T13.4.3 `[dueño]` el alta desde cero en staging.

#### HU-T13.5 · El plan de la tienda: 1, 3, 6 o 12 meses, y sus límites
- **Capa:** panel y CORE · **Prioridad:** Must · **Puntos:** 3 · **Sprint:** T16 · **Depende de:** HU-C5.3, HU-C5.5, HU-C5.6, D-T3 · **Estado:** Refinada
- Como comerciante, quiero pagar mi plan por varios meses y saber qué gano y qué pierdo si se vence.
- **Respaldo:** TIENDA §1.4; ADR-22; PLATAFORMA §4.8; P21.
- **CA1.** La pantalla de planes muestra los cuatro periodos con el total y el valor por mes; se paga con el Bold de Laboratorio Digital, en el CORE.
- **CA2.** Los límites de `funciones.json` se aplican en la API y en el horno: productos, usuarios, dominio propio y cobro en línea.
- **CA3 ❌.** Pasada la gracia de 7 días: deja de cobrar en línea pero sigue recibiendo por WhatsApp, el dominio propio redirige al subdominio, y lo que pasa del límite queda oculto, nunca borrado.
- **Aceptación de M4:** un plan semestral pagado en el ambiente de pruebas.
- **Work items:** WI-T13.5.1 `[código]` · WI-T13.5.2 `[prueba]` con el reloj movido · WI-T13.5.3 `[dueño]` el pago de prueba de 6 meses.

#### HU-T13.6 · Antiabuso: reporte, suspensión con un clic y hostnames colgantes
- **Capa:** operación · **Prioridad:** Must · **Puntos:** 3 · **Sprint:** T16 · **Depende de:** HU-T13.1 · **Estado:** Refinada
- Como plataforma, quiero cortar en un clic una tienda fraudulenta sin arrastrar a las demás.
- **Respaldo:** TIENDA §4.4 y §14.1.
- **CA1.** El enlace de reporte en el pie (`abuse@laboratorio-digital.app`, con el reenvío de correo de la zona); `ks:tienda:<org>` y el estado `suspendida` muestran una página neutra con 451 o 503.
- **CA2.** Un cron diario revisa si los hostnames retirados siguen apuntando aquí, y avisa.
- **CA3 ❌.** Suspender una tienda no toca a las otras (prueba con los dos comercios), y el runbook tiene su simulacro.
- **Work items:** WI-T13.6.1 `[código]` · WI-T13.6.2 `[infra]` el reenvío de correo · WI-T13.6.3 `[prueba]` · WI-T13.6.4 `[doc]` runbook «suspender una tienda».

#### HU-T13.7 · Dar de baja una tienda, y el borrado criptográfico
- **Capa:** operación y cumplimiento · **Prioridad:** Should · **Puntos:** 2 · **Sprint:** T16 · **Depende de:** HU-T10.7, HU-T1.3 · **Estado:** Refinada
- Como comerciante que se va, quiero llevarme mis datos y que los de mis compradores se borren de verdad.
- **Respaldo:** TIENDA §14.2 (borrado criptográfico efectivo a los 35 días).
- **CA1.** La baja ofrece la exportación, retira el hostname (que queda `retirado`, nunca borrado) y a los 30 días borra la DEK de datos personales.
- **CA2 ❌.** Después del borrado, ningún contacto de esa tienda se puede descifrar; la política de la tienda dice el plazo real (35 días).
- **Work items:** WI-T13.7.1 `[código]` · WI-T13.7.2 `[prueba]`.

### ET14 · Medición, tablero y feeds

#### HU-T14.1 · Medición propia, sin cookies
- **Capa:** vitrina y API · **Prioridad:** Must · **Puntos:** 3 · **Sprint:** T16 · **Depende de:** HU-T5.1 · **Estado:** Refinada
- Como comerciante, quiero saber qué miran y qué piden en mi tienda sin espiar a nadie.
- **Respaldo:** TIENDA §11.6; ED1 §17.1 (eventos fuera de D1).
- **CA1.** `POST /_m` con lotes de `ver_producto`, `agregar_al_carrito`, `iniciar_pedido`, `pagar_en_linea` y `pago_confirmado` al Analytics Engine, con la tienda como índice.
- **CA2 ❌.** Ni cookies, ni IP, ni identificadores: una prueba revisa lo que se escribe. 60 por minuto por IP.
- **Work items:** WI-T14.1.1 `[código]` · WI-T14.1.2 `[prueba]`.

#### HU-T14.2 · El tablero de ventas y pendientes
- **Capa:** panel · **Prioridad:** Must · **Puntos:** 5 · **Sprint:** T11 · **Depende de:** HU-T9.5, HU-T10.1 · **Estado:** En validación (rama `feat/t11-sprint`. `apps/tienda-api/src/panel-tablero.ts` y la pantalla de Inicio. Ventas, pedidos, ticket y tasa de cierre de hoy, del mes y del mes anterior a la misma altura; las ventas salen de los pedidos confirmados, pagados, despachados o entregados, nunca de los eventos. Los pendientes van con lo urgente arriba y en rojo, y lo que está en cero no se dice; un recaudo se atrasa a los 3 días hábiles, con festivos. El margen de la contraentrega cuenta los dos fletes. CA3: la prueba recorre cada día de 2028 a cualquier hora y en otro huso, y el 31 de marzo se compara con el 29 de febrero entero, y lo dice. Cada prueba ❌ (días hábiles, otro huso, el año bisiesto y otra tienda) se vio en rojo con su defecto. La comisión de los cobros en línea llega con M3)
- Como comerciante, quiero ver cómo voy hoy y este mes frente al anterior, y qué tengo pendiente.
- **Respaldo:** TIENDA §12.2; anexo C (`tablero`), que lo exige **antes** de M6 (bitácora tienda3 1); bitácora ecommerce, patrón 8.
- **CA1.** Ventas, pedidos, ticket y tasa de cierre del día, del mes y del mes anterior a la misma altura; los pendientes (por confirmar, por despachar, recaudos atrasados, solicitudes por vencer, cobros a revisar y agotados); el margen de la contraentrega. La comisión estimada de los cobros en línea se suma con M3.
- **CA2.** Las ventas salen de los pedidos, nunca de los eventos.
- **CA3 ❌.** La batería corre fingiendo cada día de un año bisiesto y en otro huso, y da lo mismo: los meses se restan con el calendario, no con días (bitácora ecommerce 8).
- **Aceptación de la paridad:** cuadra con los pedidos de los comercios de prueba.
- **Work items:** WI-T14.2.1 `[código]` · WI-T14.2.2 `[prueba]` el reloj.

#### HU-T14.3 · El resumen diario y los correos de la tienda
- **Capa:** operación · **Prioridad:** Must · **Puntos:** 3 · **Sprint:** T13 (antes del alta abierta; era T18. El primer corte ya no existe, pero las tiendas de referencia muestran que los comercios lo usan) · **Depende de:** HU-C10.1 (con Gmail, D-T11), HU-T14.2 · **Estado:** En validación (rama `feat/t13-sprint`, encima de `@ed1/correo`, #198. `apps/tienda-api/src/correos.ts` y la 0006 (`correo`: una fila por correo con su clave, sin destinatario ni texto). El resumen sale cada hora para la tienda a la que ya le toca, a la hora de Bogotá de Ajustes › Avisos (las 7 si no dice), con lo de hoy del tablero de HU-T14.2, las solicitudes por vencer con su radicado, que van aquí como pide TIENDA §8.6, y lo vendido ayer; sin nada que decir, no sale. El acuse sale al nacer el pedido en línea si el comprador dejó su correo, con el enlace de seguimiento (HU-T11.9 CA1), porque el secreto del enlace solo existe en esa solicitud. El cobro de prueba avisa al comercio si se supo por el aviso o por la consulta. CA1 con Gmail: el nombre de la tienda «vía Laboratorio Digital» y `Reply-To` al comercio. CA2: tope de 40 por tienda y de 300 por celda al día (los otros 100 de los 400 de Gmail, para el CORE), reservado en la misma sentencia que inserta, y `ks:tienda-correos`. CA3: solo `enviado` es enviado; lo fallido queda con su motivo, no gasta el tope y se reintenta en el día si fue la red, el cupo o la configuración; sin Gmail configurado, «no disponible». Un permiso vencido marca la tarea fallida en `/api/salud`. 19 pruebas; controles negativos: los fallidos contando para el tope, lo fallido como enviado, reintentar un rechazo, reenviar lo que quedó a mitad, la hora en UTC, sin el tope de la celda, el resumen sin novedad, el acuse sin enlace, sin el kill switch y la tarea que no marca el permiso vencido: rojo. Bitácora tienda3 25: la guardia del `org_id` solo leía la 0001. Falta: CA1 con `pedidos@laboratorio-digital.app` y SPF, DKIM y DMARC llega con el paso a Resend (WI-T14.3.2); WI-T14.3.4, del dueño, espera la cuenta de Gmail y su permiso; purgar las filas viejas de `correo`)
- Como comerciante, quiero un correo cada mañana con lo que tengo que hacer hoy; como comprador, el acuse en mi correo si lo dejé.
- **Respaldo:** TIENDA §8.5 y §15.5; ED1 §20.2 [D8].
- **CA1.** Remitente `«<Tienda>» <pedidos@laboratorio-digital.app>`, con respuesta al correo del comercio; SPF, DKIM y DMARC en `laboratorio-digital.app`, comprobados con un envío real.
- **CA2.** El resumen diario (con los recaudos atrasados), los avisos de solicitudes por vencer, el acuse al comprador y el resultado del cobro de prueba; con tope por tienda y por día.
- **CA3 ❌.** Un correo que no se pudo enviar no se cuenta como enviado (P1); sin el adaptador, «no disponible», nunca un falso éxito.
- **Si HU-T12.1 dice que una tienda 2.0 depende de sus correos, esta historia va antes de M6.**
- **Work items:** WI-T14.3.1 `[código]` · WI-T14.3.2 `[infra]` registros DNS · WI-T14.3.3 `[prueba]` · WI-T14.3.4 `[dueño]` verificar la entrega.

#### HU-T14.4 · GA4 y el píxel de Meta, con consentimiento y dominio propio
- **Capa:** vitrina · **Prioridad:** Should · **Puntos:** 3 · **Sprint:** T17 · **Depende de:** HU-T13.1 · **Estado:** Refinada
- Como comerciante con pauta, quiero medir mis campañas sin poner en riesgo a mis compradores.
- **Respaldo:** TIENDA §4.1, §11.4 y §11.6; Ley 1581; Decreto 1377 art. 7 (el silencio no autoriza).
- **CA1.** Solo con dominio propio; no cargan hasta que la persona acepta, en un aviso donde rechazar es tan fácil como aceptar; el consentimiento se guarda con su versión; todo evento de compra lleva el código del pedido.
- **CA2.** La CSP de la tienda agrega sus dominios solo cuando están configurados.
- **CA3 ❌.** En un subdominio de la plataforma, el panel no los ofrece y la CSP los bloquea; antes de aceptar, la página no les hace ninguna solicitud (e2e).
- **Si HU-T12.1 dice que una tienda 2.0 los usa, esta historia va antes de M6.**
- **Work items:** WI-T14.4.1 `[código]` · WI-T14.4.2 `[prueba]`.

#### HU-T14.5 · Los feeds de Google, Meta y agentes
- **Capa:** horno · **Prioridad:** Must · **Puntos:** 3 · **Sprint:** T16 · **Depende de:** HU-T4.5 · **Estado:** Refinada
- Como comerciante, quiero que mis productos salgan en Google, Instagram y WhatsApp sin cargarlos otra vez.
- **Respaldo:** TIENDA §10.1; estudio §8.1 [C3].
- **CA1.** `/feeds/google.xml`, `/feeds/meta.csv` y `/feeds/productos.jsonl`, si `agentes.feeds` está encendido, con la disponibilidad del inventario.
- **CA2 ❌.** Un producto sin foto o sin precio sale de los feeds, con su motivo en el panel; cada feed se valida en la prueba contra el formato de su destino.
- **Work items:** WI-T14.5.1 `[código]` · WI-T14.5.2 `[prueba]`.

#### HU-T14.6 · Eventos que cuadran con los pedidos
- **Capa:** panel · **Prioridad:** Should · **Puntos:** 2 · **Sprint:** T17 · **Depende de:** HU-T14.1, HU-T14.2 · **Estado:** Refinada
- Como comerciante, quiero saber cuánto de lo que dicen mis métricas es real.
- **Respaldo:** TIENDA §11.6; estudio §8.1 [C3] («los eventos de marketing se reconcilian con los pedidos»).
- **CA1.** Cada semana, el tablero compara los pedidos de la base con los eventos y muestra la diferencia en los dos sentidos.
- **CA2 ❌.** Las ventas del tablero no cambian con los eventos.
- **Aceptación de M5:** la diferencia se ve con los comercios de prueba.
- **Work items:** WI-T14.6.1 `[código]` · WI-T14.6.2 `[prueba]`.

#### HU-T14.7 · La Tienda en el reporte semanal del dueño
- **Capa:** operación · **Prioridad:** Should · **Puntos:** 2 · **Sprint:** T17 · **Depende de:** HU-T0.3, HU-T14.2 · **Estado:** Refinada
- Como dueño, quiero ver cada semana cómo van las tiendas y las métricas de validación.
- **Respaldo:** ED1 §31.1; ADR-16; estudio §16.3.
- **CA1.** Tiendas activas, pedidos, pago real, soporte (que anota el dueño), costo del mes y las métricas con su umbral (HU-T0.3).
- **CA2 ❌.** Ningún dato de un comprador sale en el reporte ([H6]).
- **Work items:** WI-T14.7.1 `[código]` · WI-T14.7.2 `[prueba]`.

#### HU-T14.8 · Verificar la tienda en Google Search Console
- **Capa:** paquete y horno · **Prioridad:** Should · **Puntos:** 2 · **Sprint:** T3 · **Depende de:** HU-T1.4 · **Estado:** En validación (rama `feat/t3-sprint`. La sección `medicion` acepta `googleVerificacion`, y `codigoDeVerificacionGoogle` (`@ed1/tienda-schema`) saca el código del texto que pegue el comercio: el código solo o la etiqueta `<meta name="google-site-verification">` entera, en mayúsculas o minúsculas y con los atributos en cualquier orden. `etiquetaDeVerificacionGoogle` arma la etiqueta que el horno pondrá en la portada (WI-T14.8.2 va con HU-T4.1). El texto del panel (WI-T14.8.3) llega con la pantalla de ajustes, HU-T10.3. Pedido del dueño del 13 oct 2026. Controles negativos: la etiqueta de otro buscador, un código con comillas, con un `<script>`, con espacios o corto)
- Como comerciante, quiero que Google verifique mi tienda sin tener que tocar un DNS que no es mío, para ver cómo me encuentran.
- **Respaldo:** pedido del dueño: en la 2.0, una tienda en un subdominio de la plataforma no se pudo verificar con el método del proveedor de dominio (Search Console pide un registro DNS en una zona que el comercio no controla). TIENDA §5.7 (`medicion`) y §11.7.
- **CA1.** La sección `medicion` acepta el código de verificación de Google: el comercio pega el código o la etiqueta `<meta name="google-site-verification" …>` entera, y se guarda solo el código. El horno lo pone en el `<head>` de la portada.
- **CA2.** El panel explica en palabras: en Search Console se crea una propiedad de **prefijo de URL** con la dirección de la tienda (`https://<nombre>.laboratorio-digital.app/`) y se elige el método **etiqueta HTML**. La propiedad de **dominio** no sirve para un subdominio de la plataforma, porque pide un registro DNS en una zona que el comercio no controla.
- **CA3 ❌.** Un código con comillas, espacios, `<` o `>` se rechaza: nunca llega crudo al HTML (HU-T4.2). Una etiqueta de otro buscador o de otro nombre no se confunde con la de Google.
- **Work items:** WI-T14.8.1 `[código]` el campo y su lectura · WI-T14.8.2 `[código]` la etiqueta en el horno (con HU-T4.1) · WI-T14.8.3 `[doc]` el texto del panel.

### ET15 · Agentes

#### HU-T15.1 · Cada tienda, legible por agentes (la capa estática)
- **Capa:** horno · **Prioridad:** Should · **Puntos:** 3 · **Sprint:** T5 · **Depende de:** HU-T4.1, D-T6 · **Estado:** En validación (rama `feat/t5-sprint`. `packages/tienda-horno/src/agentes.ts`: el `robots.txt` lleva las familias de `content/agentes.json` (las mismas del sitio, P2) y decide cada una con las señales de la sección `agentes` de esa tienda; `Disallow: /api/` y `/pedido/`, y la `Content-Signal`. `llms.txt` enlaza a los gemelos `.md` de productos y colecciones y al catálogo; `manifest.webmanifest` con el nombre y el color de la tienda. **Cambió:** `security.txt` no se hornea, porque su `Expires` depende del día y el horno no tiene reloj (P17): lo sirve el despacho con el correo del responsable de la plataforma (`content/tienda/privacidad/politica.json`). El despacho anuncia el gemelo también en la cabecera `Link` (CA2). Controles negativos: un enlace de `llms.txt` que no existe detiene la compuerta (CA3); con `ai-train=no` la familia de entrenamiento no lee nada)
- Como agente de un comprador, quiero entender qué vende la tienda y cómo comprar sin ejecutar JavaScript.
- **Respaldo:** TIENDA §11.8; ED1 §3.12; PLATAFORMA §5.3; ADR-24 (propuesta).
- **CA1.** `robots.txt` con las familias de `content/agentes.json`, `Disallow: /api/` y el `Content-Signal` de la sección `agentes`; `llms.txt`; `security.txt`; `manifest.webmanifest`.
- **CA2.** Los gemelos `.md` se anuncian con `<link rel="alternate">` y con la cabecera `Link`.
- **CA3 ❌.** Un enlace de `llms.txt` que no existe en lo horneado detiene la compuerta.
- **Work items:** WI-T15.1.1 `[código]` · WI-T15.1.2 `[prueba]`.

#### HU-T15.2 · La API pública, con su OpenAPI y su catálogo
- **Capa:** API · **Prioridad:** Should · **Puntos:** 2 · **Sprint:** T18 · **Depende de:** HU-T1.4 · **Estado:** Refinada
- Como agente o integrador, quiero saber qué ofrece la API de una tienda sin adivinar.
- **Respaldo:** TIENDA §11.8 y §13.1.
- **CA1.** OpenAPI 3.1 generada desde los esquemas zod, en `/openapi.json`, y `/.well-known/api-catalog`.
- **CA2 ❌.** Un cambio de esquema que rompe `/api/v1` hace fallar la prueba de contrato.
- **Work items:** WI-T15.2.1 `[código]` · WI-T15.2.2 `[prueba]`.

#### HU-T15.3 · La habilidad de compra
- **Capa:** horno · **Prioridad:** Should · **Puntos:** 2 · **Sprint:** T18 · **Depende de:** HU-T15.2 · **Estado:** Refinada
- Como agente, quiero las instrucciones para comprar en esta tienda: dónde está el catálogo, cómo preparar un pedido y que el pago lo hace la persona.
- **Respaldo:** TIENDA §11.8 (`/skills/comprar/SKILL.md`).
- **CA1.** `SKILL.md` por tienda, con su `sha256` en `/.well-known/agent-skills/index.json`.
- **CA2 ❌.** Una huella que no coincide detiene la compuerta.
- **Work items:** WI-T15.3.1 `[código]` · WI-T15.3.2 `[prueba]`.

#### HU-T15.4 · El MCP público de la tienda
- **Capa:** API · **Prioridad:** Should · **Puntos:** 5 · **Sprint:** T18 · **Depende de:** HU-T15.2, HU-T5.5 · **Estado:** Refinada
- Como agente de un comprador, quiero buscar, consultar disponibilidad y preparar un pedido para que la persona lo confirme.
- **Respaldo:** TIENDA §13.4; PLATAFORMA §5.6 y §5.7.
- **CA1.** `https://<tienda>/mcp`, sin estado (Streamable HTTP), con su Server Card y las cinco herramientas; buscar y ver leen lo horneado, no D1.
- **CA2.** `preparar_pedido` crea un pedido `pendiente` de canal `agente`, sin datos personales ni aceptación, con el enlace para que la persona lo confirme.
- **CA3 ❌.** Los agentes no apartan unidades; 5 por hora por IP y 50 pendientes de agente por tienda; ninguna herramienta mueve dinero; `ks:tienda-mcp` lo apaga sin tocar la tienda.
- **Work items:** WI-T15.4.1 `[código]` · WI-T15.4.2 `[prueba]` con un cliente MCP.

#### HU-T15.5 · Confirmar el pedido que preparó un agente
- **Capa:** vitrina · **Prioridad:** Should · **Puntos:** 3 · **Sprint:** T18 · **Depende de:** HU-T15.4, HU-T11.4 · **Estado:** Refinada
- Como comprador, quiero revisar y aceptar yo el pedido que preparó mi asistente, y pagarlo si quiero.
- **Respaldo:** TIENDA §8.2 (canal agente); ED1 §3.12 («el agente prepara y una persona paga»).
- **CA1.** `/pedido/confirmar/#<token>` muestra el pedido, pide la aceptación y, si la persona quiere pagar, crea el cobro o le ofrece seguir por WhatsApp.
- **CA2.** Los pedidos preparados y nunca confirmados se cancelan a las 48 h.
- **CA3 ❌.** Sin la aceptación de la persona, el pedido no sale de `pendiente`.
- **Aceptación de M7:** un cliente MCP real prepara un pedido que la persona confirma y paga.
- **Work items:** WI-T15.5.1 `[código]` · WI-T15.5.2 `[prueba]` · WI-T15.5.3 `[dueño]` probarlo con un cliente real.

#### HU-T15.6 · `verificar-agentes`, tienda por tienda
- **Capa:** CI · **Prioridad:** Should · **Puntos:** 2 · **Sprint:** T18 · **Depende de:** HU-C8.5, HU-T15.1 a HU-T15.4 · **Estado:** Refinada
- Como dueño, quiero que producción se detenga si una tienda deja de ser legible por agentes.
- **Respaldo:** PLATAFORMA §5.8.
- **CA1.** Las comprobaciones corren contra las dos tiendas de prueba en staging, con todas las fallas a la vez.
- **CA2 ❌.** Quitar una habilidad o alterar su huella detiene el despliegue a producción.
- **Work items:** WI-T15.6.1 `[ci]` · WI-T15.6.2 `[prueba]`.

#### HU-T15.7 · El MCP del comercio
- **Capa:** API · **Prioridad:** Could · **Puntos:** 5 · **Sprint:** T18 · **Depende de:** HC6 (HU-C9.5 y HU-C9.6), HU-T10.5 · **Estado:** Refinada
- Como comerciante, quiero que mi asistente me diga qué pedidos tengo por despachar y me ayude con el inventario.
- **Respaldo:** TIENDA §1.2 y §1.4 (plan `alto`); PLATAFORMA §5.4 y §5.5.
- **CA1.** `mcp.laboratorio-digital.app` con OAuth del CORE, recurso RFC 8707 y los permisos que el comerciante conceda: pedidos, inventario y catálogo.
- **CA2 ❌.** Ninguna herramienta mueve dinero ni lee llaves o datos personales; un token de otro recurso se rechaza; solo en el plan `alto`.
- **Work items:** WI-T15.7.1 `[código]` · WI-T15.7.2 `[prueba]` · WI-T15.7.3 `[dueño]` conectar un cliente real.

### ET16 · Factura integrada (nivel intermedio)

#### HU-T16.1 · Spike: la facturación de Bold y la API de Alegra
- **Capa:** arquitectura · **Prioridad:** Must (de M8) · **Puntos:** 2 · **Sprint:** T19 · **Depende de:** — · **Estado:** Refinada
- Como plataforma, quiero saber con qué facturador empezar antes de escribir el adaptador.
- **Respaldo:** TIENDA §14.5; estudio §11.2 [C6].
- **CA1.** Qué incluye la facturación de la cuenta de Bold y cómo crea Alegra una factura desde un pedido, con su ambiente de pruebas; escrito con fuentes y fecha.
- **CA2.** La decisión del primer adaptador queda en un ADR.
- **CA3 ❌.** Lo que no se pudo comprobar en un ambiente de pruebas se escribe como no comprobado, nunca como hecho; lo que otro dice haber leído se cita como suyo (bitácora agro, «Afirmaciones mías que resultaron falsas» 3).
- **Work items:** WI-T16.1.1 `[prueba]` prototipo · WI-T16.1.2 `[doc]` ADR.

#### HU-T16.2 · `DocumentoFiscal` y la migración 0002
- **Capa:** base y paquete · **Prioridad:** Must · **Puntos:** 5 · **Sprint:** T19 · **Depende de:** HU-T16.1 · **Estado:** Refinada
- Como comerciante del plan intermedio, quiero facturar mis pedidos en el facturador que ya uso.
- **Respaldo:** TIENDA §14.5 (puntos 1 a 3).
- **CA1.** El adaptador `DocumentoFiscal` con el primer facturador, y la tabla `factura` en su migración 0002, con la receta.
- **CA2 ❌.** Un documento que no salió del facturador nunca se llama «factura»: el PDF del pedido dice «resumen».
- **Work items:** WI-T16.2.1 `[código]` · WI-T16.2.2 `[prueba]`.

#### HU-T16.3 · La credencial del facturador y emitir desde un pedido
- **Capa:** panel y API · **Prioridad:** Must · **Puntos:** 3 · **Sprint:** T19 · **Depende de:** HU-T16.2, HU-T11.2 · **Estado:** Refinada
- Como comerciante, quiero emitir la factura de un pedido con un toque.
- **Respaldo:** TIENDA §14.5 (punto 2); §12.3 (entrada reciente).
- **CA1.** La credencial se cifra como las llaves de Bold y pide entrada reciente; «Emitir factura» en un pedido pagado o confirmado.
- **CA2 ❌.** Solo en el plan intermedio o superior; un error del facturador se muestra con su motivo y no marca nada como facturado.
- **Aceptación de M8:** una factura de prueba emitida en la cuenta de pruebas del facturador.
- **Work items:** WI-T16.3.1 `[código]` · WI-T16.3.2 `[prueba]` · WI-T16.3.3 `[dueño]` la cuenta de pruebas.

#### HU-T16.4 · Los datos de la factura, solo a quien la pide
- **Capa:** vitrina y cumplimiento · **Prioridad:** Must · **Puntos:** 2 · **Sprint:** T19 · **Depende de:** HU-T16.3 · **Estado:** Refinada
- Como comprador, quiero dar mis datos de facturación solo si quiero factura.
- **Respaldo:** TIENDA §14.5 (punto 4); Ley 1581 (mínimo necesario).
- **CA1.** «Quiero factura» pide solo lo que la factura necesita, y lo guarda cifrado.
- **CA2 ❌.** Quien no pide factura no ve esos campos, y la API no los acepta.
- **Work items:** WI-T16.4.1 `[código]` · WI-T16.4.2 `[prueba]`.

### ET17 · Operación y confiabilidad

#### HU-T17.1 · Los crons de la Tienda, y el KV reconstruido cada día
- **Capa:** operación · **Prioridad:** Must · **Puntos:** 3 · **Sprint:** T4 · **Depende de:** HU-T2.3 · **Estado:** En validación (rama `feat/t4-sprint`. **Cambió por el plan gratuito** (D-T10): un solo cron por hora, `0 * * * *`, el quinto de la cuenta y solo en producción; staging no tiene. `apps/tienda-api/src/tareas.ts` reparte por frecuencia: cada hora, cada día a las 3 a. m. de Bogotá y cada semana el lunes a esa hora; lo de 5 y 15 minutos se hace perezoso o pasa a cada hora. Cada tarea corre aparte y anota su última corrida en el KV de flags (`tarea:<nombre>`); `/api/salud` dice `al-dia`, `atrasada`, `fallo` o `nunca` (CA1, el vigía lo leerá). La diaria rehace `TIENDA_HOSTS` desde las bases con la misma forma que escribe publicar; si difiere, gana la base y avisa por Telegram (CA2). Controles negativos: una tarea que lanza no detiene a la siguiente y deja su causa (CA3); un KV con una dirección cambiada y otra faltante se corrige y avisa una vez; staging con cron pone la prueba en rojo)
- Como dueño, quiero que las tareas periódicas corran solas y avisen si una no corrió.
- **Respaldo:** TIENDA §15.3; P7.
- **CA1.** Un despachador por frecuencia (5 min, 15 min, 1 h, diario y semanal) en `tienda-api`; cada tarea anota su última corrida, y el vigía avisa si una no corrió.
- **CA2.** La tarea diaria reconstruye el KV de hostnames desde D1; si difieren, gana D1 y se avisa por Telegram con lo que cambió.
- **CA3 ❌.** Una tarea que falla no tumba a las demás de su frecuencia, y dice su causa.
- **Work items:** WI-T17.1.1 `[código]` · WI-T17.1.2 `[prueba]`.

#### HU-T17.2 · Las purgas diarias
- **Capa:** operación · **Prioridad:** Should · **Puntos:** 2 · **Sprint:** T7 · **Depende de:** HU-T17.1 · **Estado:** En validación (rama `feat/t7-sprint`. La tarea diaria `purgas` en `apps/tienda-api/src/tareas.ts` recorre cada tienda de cada shard y purga, con su `org_id`, lo borrado hace 30 días o más (colecciones, productos, envíos, cupones y páginas) y las `operacion` de 48 horas o más. Un producto se lleva sus variantes, fotos, enlaces a colecciones, libro de inventario y «avísame». **Cambió:** un producto con alguna variante en un pedido o un apartado se queda en la papelera, porque el pedido nombra la variante (P21); el resumen de la tarea dice cuántos. Las fotos en R2 no se tocan: son por huella y otra versión publicada puede usarlas. Las exportaciones vencen con una regla de ciclo de vida del almacén que pone el dueño: `docs/runbooks/tienda-ciclo-de-vida.md` (§10). Controles negativos: con 29 días, la tarea purga un producto al que le faltaba un milisegundo; sin retener lo vendido, la purga choca con la clave foránea del pedido y no borra nada)
- Como plataforma, quiero que lo temporal se borre a su plazo, y nunca antes.
- **Respaldo:** TIENDA §15.3 (diario); P21. Los contactos vencidos los purga HU-T7.3.
- **CA1.** Papelera a 30 días, `operacion` a 48 h, exportaciones a 7 días (regla de ciclo de vida de R2).
- **CA2 ❌.** Nada se purga antes de su plazo: una prueba con el reloj movido lo comprueba.
- **Work items:** WI-T17.2.1 `[código]` · WI-T17.2.2 `[prueba]`.

#### HU-T17.3 · La exportación semanal de cada tienda y la copia fuera de Cloudflare
- **Capa:** operación · **Prioridad:** Must · **Puntos:** 3 · **Sprint:** T12 · **Depende de:** HU-T10.7, HU-C11.4 · **Estado:** En validación, la parte de la Tienda (rama `feat/t12-sprint`. CA1: la tarea semanal `respaldos` (`apps/tienda-api/src/respaldos.ts`, el lunes a las 3 a. m. de Bogotá, solo en producción) guarda cada tienda en `respaldos/<org>/<fecha>.json` del almacén de la celda: la exportación `tienda-export/1`, todos los pedidos con sus líneas (la exportación deja fuera los que están en curso), y los contactos y las solicitudes en sus sobres, con las llaves de datos personales e índices envueltas por la KEK; las de credenciales no viajan. Quedan las 4 últimas y la primera de cada uno de los 3 últimos meses. CA2: antes de darlo por bueno, cuenta en la base productos, pedidos, líneas, contactos y solicitudes y los compara con el archivo; después lo relee y compara su huella; si no cuadra, no queda como bueno, avisa por Telegram con la tienda y la causa, y `/api/salud` dice la falla. Controles negativos: sin las llaves, el sobre del respaldo no se abre; sin la revisión, el respaldo que no cuadra se guarda y no avisa; sin rotar, quedan 14; con solo los pedidos de la exportación, falta el que está por confirmar; con las llaves de credenciales, la prueba lo ve. **Falta:** la copia semanal fuera de Cloudflare la hace HU-C11.4 del CORE, que todavía no existe; cuando exista, suma estos archivos)
- Como dueño, quiero poder recuperar cada tienda aunque falle la cuenta de Cloudflare.
- **Respaldo:** TIENDA §15.4; ED1 §20.3; **ADR-30** (semanal y cifrada en el Google Drive del dueño); bitácora tienda3 4.
- **CA1.** `tienda-export` semanal de cada tienda en R2 (se guardan 4 semanales y 3 mensuales), y la copia semanal cifrada de HU-C11.4 incluye las bases de la Tienda.
- **CA2 ❌.** Una exportación que no cuadra con la base avisa por Telegram; los datos personales salen en sus sobres, nunca en claro.
- **Work items:** WI-T17.3.1 `[código]` · WI-T17.3.2 `[prueba]`.

#### HU-T17.4 · El simulacro de restauración, antes de guardar datos de terceros
- **Capa:** operación · **Prioridad:** Must · **Puntos:** 3 · **Sprint:** T14 · **Depende de:** HU-T17.3 · **Estado:** En validación (rama `feat/t14-sprint`. El simulacro encontró que el respaldo de HU-T17.3 no se podía restaurar: llevaba el catálogo como la exportación, que al cargarse estrena ids, y los pedidos quedaban sin su combinación (bitácora tienda3 32). El respaldo pasó a `tienda-respaldo/2`: las filas de cada tabla como están en la base, con sus sobres cifrados, sin las llaves de las credenciales. `apps/tienda-api/src/restaurar.ts` las inserta en orden con `ON CONFLICT DO NOTHING` (CA2: une lo que falta y nunca reemplaza el presente), con las columnas de los triggers en cero para que no cuenten dos veces, y sube los consecutivos por encima de lo restaurado. CA1: en un shard vacío la tienda vuelve con las mismas huellas, tabla por tabla, y sus contactos se abren con la KEK. `scripts/tienda/restaurar.ts` arma el mismo SQL para `wrangler d1 execute`; `scripts/tienda/simulacro-de-restauracion.ts` y el flujo `simulacro-restauracion-tienda` lo hacen en staging, en una base que se borra al final. Runbook: `docs/runbooks/tienda-restaurar.md`. Controles negativos: con `INSERT OR REPLACE` y copiando lo que cuentan los triggers, rojo. Falta, del dueño: correr el flujo del simulacro en staging)
- Como dueño, quiero haber restaurado una tienda al menos una vez antes de cargar la primera real.
- **Respaldo:** TIENDA §15.4 (punto 4); estudio §16.4 («ningún piloto pagado debería guardar pedidos de terceros sin un respaldo restaurado al menos una vez»); bitácora ecommerce 77.
- **CA1.** En staging: restaurar Ensayo Uno en un shard vacío desde su exportación y comparar las huellas tabla por tabla.
- **CA2 ❌.** Restaurar une lo que falta, nunca reemplaza el presente: una restauración sobre una tienda con pedidos nuevos los conserva.
- **Work items:** WI-T17.4.1 `[prueba]` · WI-T17.4.2 `[doc]` runbook «restaurar una tienda».

#### HU-T17.5 · Los runbooks de la Tienda
- **Capa:** documentación · **Prioridad:** Must · **Puntos:** 2 · **Sprint:** T15 · **Depende de:** — · **Estado:** Refinada
- Como dueño, quiero cada operación delicada escrita paso a paso antes de necesitarla.
- **Respaldo:** TIENDA §15.6; P18.
- **CA1.** Alta, conectar un dominio, suspender, rotar la KEK, incidente de datos personales, restaurar, agregar un shard, volver atrás el código y el corte de una tienda.
- **CA2 ❌.** Una prueba recorre los runbooks y falla si nombran un script, un secreto o una ruta que no existe (como la guardia de documentos de la 2.0).
- **Work items:** WI-T17.5.1 `[doc]` · WI-T17.5.2 `[prueba]`.

#### HU-T17.6 · Rotar la KEK sin perder un dato
- **Capa:** seguridad · **Prioridad:** Must · **Puntos:** 3 · **Sprint:** T15 · **Depende de:** HU-T1.3, HU-T2.5 · **Estado:** Refinada
- Como dueño, quiero cambiar la llave maestra si alguna vez se expone, sin perder lo cifrado.
- **Respaldo:** TIENDA §9.2 (5) y §14.2.
- **CA1.** Una KEK nueva reenvuelve todas las DEK por la cola; la vieja se retira solo cuando ninguna la usa.
- **CA2 ❌.** En el simulacro de staging, todo se descifra después de rotar; un intento de borrar la vieja antes de tiempo se detecta y no borra nada.
- **Work items:** WI-T17.6.1 `[código]` · WI-T17.6.2 `[prueba]` · WI-T17.6.3 `[doc]` runbook.

---

## 9. Preparadas, sin sprint

| Historia | Disparador |
|---|---|
| HU-T7.4 · Revisión legal de las plantillas (3) | Haya presupuesto para un abogado (TIENDA §20.2.7). Recomendado antes del alta abierta (M4). Corregir es cambiar una plantilla y re-hornear |
| Cuentas de comprador | Más del 30 % de los pedidos de una tienda son de compradores que repiten, y lo piden (TIENDA §20.3) |
| Directorio o marketplace de tiendas | Nunca sin tratarlo antes como portal de contacto (Ley 2439 art. 6; Ley 1480 art. 53) |
| Otra pasarela (Mercado Pago, PayPal, Wompi) | El dueño elige la segunda pasarela (anunció Mercado Pago y PayPal el 13 oct 2026, HU-T12.1), un comercio no puede usar Bold o Bold cambia. `ProveedorDePago` ya lo permite: una pasarela nueva es un adaptador en `@ed1/pagos` |
| Emitir factura electrónica | La DIAN reglamenta el art. 616-1 inc. 8, o tres comercios sin facturador propio la piden |
| WhatsApp Cloud API para avisos de estado | Se demuestra ahorro de atención y la contribución por pedido lo soporta. La barrera es habilitar el canal, no el costo (estudio §11.1 [C5]) |
| Guías integradas (cotizar, generar y seguir) | Tres comercios con el mismo operador o agregador |
| Varias bodegas | Tres comercios del nivel alto con más de un punto de despacho (TIENDA §7.5: expandir, migrar y contraer) |
| Punto de venta | Un comercio que venda en un local los mismos productos (el canal `pos` es un `INSERT`) |
| B2B: listas de precios y cotizaciones | Pedidos empresariales comprobados (estudio §8.2) |
| Conversiones del lado del servidor (Meta) | Un comercio con pauta que lo pida, con su consentimiento y su token |
| Multimoneda y multidioma | La fase LATAM de ED1 |
| Disponibilidad de CultivoPro en la tienda del productor (feed firmado) | La finca cero abre su tienda. Hoy el cuaderno exporta el CSV con las columnas del catálogo (análisis de integración §9.1; HU-E6.5 del agro) |
| Enlaces de seguimiento de la 2.0 | El dueño decide conservarlos al cortar (TIENDA §17.3, punto 6): tabla aparte, con su migración |
| `@ed1/cifrado` también para el token de Drive del agro | Un tercer uso del cifrado de sobre (regla de tres, ED1 §3.11) |

---

## 10. Decisiones del dueño para empezar

Se piden todas al principio, con su recomendación. Las que vienen de TIENDA §20.2 conservan su número allí.

| # | Decisión | Recomendación | La necesita |
|---|---|---|---|
| D-T1 | ¿Se abre el carril de holgura T0 antes de HC1? | **Sí**, solo en la holgura del CORE (con 4 historias del CORE esperando validación, o su sprint ya construido), con tope de 21 puntos y nada que toque la nube ni el CORE. No cambia D-C4 | T0 (ya) |
| D-T2 | Tipografía de la vitrina y del panel | **Decidida el 13 oct 2026:** Geist para todo el texto y Geist Mono para precios, códigos y cifras, las del ecosistema (D-C1), en la vitrina y en el panel. «Editorial» es un tratamiento de la misma Geist, sin otra fuente. La marca del comercio llega por su logo y su color | HU-T3.3 |
| D-T3 | Los planes: los cuatro niveles del estudio, sus límites (15 productos en `gratis`, 3 colaboradores en `intermedio`) y sus precios por periodo (TIENDA §20.2.1) | Entran como **hipótesis** en HU-T2.2; nada se cobra hasta HU-T13.5. Antes de fijarlos, la pregunta 9 del estudio a los dos comercios | HU-T2.2 (T1); fijarlos antes de T17 |
| D-T4 | Las formas de pago de fábrica de una tienda nueva (§20.2.2) | A convenir y transferencia; contraentrega y efectivo cuando el comercio las active | HU-T6.1 (T6) |
| D-T5 | La conservación de los contactos (§20.2.3) | 24 meses por defecto, ajustable de 12 a 60 | HU-T7.3 (T11) |
| D-T6 | `ai-train` de las tiendas (§20.2.4) | `no` por defecto, `search` y `ai-input` en `yes`; cada comercio decide | HU-T15.1 (T5) |
| D-T7 | Las tiendas actuales antes del alta abierta: M6 → M4 (§20.2.5) | **Cerrada, no aplica**: el 13 oct 2026 el dueño decidió que ninguna tienda 2.0 se migra | — |
| D-T8 | El correo de la Tienda (§20.2.6) | El adaptador del CORE (HU-C10.1) con el servicio de correo de Cloudflare, enviando desde `laboratorio-digital.app` | HU-T14.3 (T18, o antes si HU-T12.1 lo pide) |
| D-T9 | Velocidad y carriles | 20 puntos por sprint en la Tienda; como mucho 3 historias suyas esperando validación y 6 entre los dos carriles (§3.6) | Planeación de T1 |
| D-T11 | Cómo manda correos la Tienda en el plan gratuito | **Decidida el 13 oct 2026:** primero Gmail por su API, gratis, detrás del adaptador `CorreoTransaccional` que comparte con el CORE (`@ed1/correo`); después Resend o similar, sin cambiar el producto. Cómo entra en la arquitectura: PLATAFORMA §4.11 | HU-T14.3 (T13) |
| D-T12 | El límite de pedidos del plan `gratis` | **Decidida el 13 oct 2026: sin tope de pedidos.** El gratuito se limita por productos (15), un usuario y sin dominio propio, como propone el estudio; si el costo crece, lo dice el vigía | HU-T13.5 |
| D-T13 | GA4 y el píxel de Meta en una tienda sin dominio propio | **Decidida el 13 oct 2026:** GA4 sí, con su cookie limitada a la dirección de la tienda; el píxel de Meta, solo con dominio propio, porque su cookie no se puede limitar y compartiría al comprador entre tiendas. Los dos, solo con el consentimiento del comprador | HU-T14.4 (T17) |
| D-T10 | Los cron de la Tienda en el plan gratuito: queda 1 de los 5 de la cuenta y TIENDA §15.3 pide cinco frecuencias | **Aplicada el 14 oct 2026 con la recomendación** (HU-T17.1): un solo cron por hora, solo en producción, que reparte por hora, día y semana; lo que pueda ser perezoso, perezoso (como los apartados). Workers Paid solo si un dato lo exige | El primer cron (HU-T17.1) |

**Tareas que solo puede hacer el dueño**, con la fecha que no frena el camino crítico:

| Tarea | Antes de | Detalle |
|---|---|---|
| Activar Workers Paid y las alertas de facturación | Cuando un dato lo exija | Decisión del 6 oct 2026: el plan gratuito mientras se pueda. Los datos que lo decidirían, en la bitácora tienda3 7 |
| Agregar la zona `laboratorio-digital.app` a la cuenta | Hecho | Activa: el parqueadero sale a producción en ella (13 oct 2026) |
| Contestar qué usa cada tienda 2.0 | T1 | HU-T12.1 |
| Generar la KEK y el secreto del despacho de **producción**, y guardar la copia de la KEK | Hecho | 15 oct 2026, antes de las 01:10 UTC (`node scripts/tienda/generar-secretos.ts --ambiente produccion`, `docs/runbooks/secretos-de-la-tienda.md`). Con ellos, el despliegue a mano del 15 oct cargó los secretos y el panel respondió; lo que siguió fallando fue la prueba de humo, que buscaba la API en un dominio que no existe (bitácora tienda3 14) |
| Generar la KEK y el secreto del despacho, y guardar la copia de la KEK | Hecho (staging) | `node scripts/tienda/generar-secretos.ts --ambiente staging` (HU-T2.5, `docs/runbooks/secretos-de-la-tienda.md`). Sin el secreto del despacho, el paso de la Tienda en el despliegue falla y lo dice |
| Activar R2 y crear `tienda-c1` y `tienda-c1-staging` | Hecho | 14 oct 2026. El token de despliegue sigue sin permiso de R2 (HU-C11.5): los buckets los crea el dueño en el panel |
| Crear los buckets de las fotos y conectarles `img.` e `img--staging.` | Hecho | Buckets creados el 14 oct 2026; el dueño les conectó `img.` e `img--staging.` el 15 oct 2026 (pasos 2 y 3 de `docs/runbooks/tienda-fotos.md`). Sin comprobar desde la sesión, que no alcanza `*.laboratorio-digital.app`: lo comprueba la primera foto que suba HU-T8.3. Nunca un dominio en el almacén |
| La cuenta de Gmail de los correos y su permiso de OAuth, en producción | T13 | HU-C10.1 y D-T11: PLATAFORMA §4.11 |
| La cuenta de Gmail de prueba y su permiso de OAuth, en staging | Al terminar T14 | El dueño tiene la cuenta (19 oct 2026). Falta su permiso: `node scripts/correo/permiso-de-gmail.ts --ambiente staging` (T14) guarda los cuatro secretos `CORREO_GMAIL_*` en el ambiente `staging` de GitHub |
| Activar Workers Paid para publicar tiendas grandes | Cuando la Tienda esté completa (decisión del dueño del 19 oct 2026) | Bitácora tienda3 31: publicar la tienda llena gasta 1,3 s de CPU por solicitud y el plan gratuito da 10 ms. Es el dato que la bitácora tienda3 7 esperaba |
| Leer, con un abogado, las plantillas de los textos legales de las tiendas, y los términos del comercio | T7 | WI-T7.1.4: `content/tienda/legal/`. Desde el 19 oct 2026 también `content/tienda/comercio/terminos.json` (HU-T7.2): los términos del servicio, el contrato de transmisión y la custodia de las llaves de Bold, en borrador. Corregir los del comercio es editar el JSON y subir su `version`: el panel los pide otra vez. Las plantillas de las tiendas están hoy en la versión 2 (15 oct 2026: «Solicitudes» explica el formulario con radicado, HU-T6.4). Corregir es editar el `.md`, subir la versión y generar; las tiendas lo toman al publicar |
| Los datos de Laboratorio Digital como encargado (nombre o razón social, identificación, domicilio, correo, teléfono) | Antes de la primera tienda real | HU-T7.2: términos y contrato de transmisión |
| Guardar el secreto `TIENDA_CORREO_DUENO_STAGING` (tu correo de Google) en el ambiente `staging` de GitHub, entrar una vez al panel de staging y volver a desplegar staging | Hecho | Guardado el 15 oct 2026. El despliegue del 19 oct dijo «comercios de prueba en el CORE: 2 organizaciones, el dueño es propietario» (HU-T2.10 CA2) |
| Poner la regla de ciclo de vida de 7 días a `exportaciones/` en `tienda-c1` y `tienda-c1-staging` | T10 | HU-T17.2: `docs/runbooks/tienda-ciclo-de-vida.md`. Antes de que el panel ofrezca «Descargar todo» (HU-T10.7) |
| Escribir a Bold por un esquema para plataformas | T12 | PLATAFORMA §9.7 (soporte.online@bold.co) |
| Llaves de pruebas de Bold para un comercio de prueba | Al terminar T14 | El dueño las tiene (19 oct 2026). Se pegan en el panel de staging de **Ensayo Dos**, en Más › Cobro en línea; nunca en un chat, un archivo ni un secreto de GitHub. Ensayo Uno lleno no se publica en staging hasta Workers Paid (bitácora tienda3 31) |
| La regla de *Rate limiting* de la zona `laboratorio-digital.app`: `/api/v1/*`, 60 solicitudes en 10 s por IP, bloquear 10 minutos | Antes de la primera tienda real | HU-T11.11, hallazgo 6 de `docs/seguridad/revision-tienda-2026-10-19.md` (y 4 de la revisión del 3 oct). Cloudflare › la zona › Security › WAF › Rate limiting rules |
| Correr la carga de staging (`carga-staging-tienda`) y el simulacro de restauración (`simulacro-restauracion-tienda`) | Antes de la primera tienda real | HU-T11.10 y HU-T17.4: Actions › el flujo › Run workflow. Si falla, el resumen dice qué; se anota en la bitácora de la Tienda |
| Fijar los umbrales de validación | Antes de la primera tienda real | HU-T0.3: `content/tienda/validacion.json` trae la propuesta del 19 oct 2026; se cambia lo que haga falta y se pone `"estado": "fijada"` con la fecha |
| Acordar con cada comercio la fecha de su corte | T15 | HU-T12.7 y HU-T12.8 |
| Un dominio de prueba para conectarlo como propio | T16 | HU-T13.1 |

---

## 11. Riesgos del plan

| # | Riesgo | Prob. | Impacto | Respuesta |
|---|---|---|---|---|
| R1 | La validación del dueño no alcanza para dos carriles y la cola crece | Alta | Alto | Límite de 3 y de 6 en validación (§3.6); la revisión del viernes es la validación; la velocidad cuenta lo validado |
| R2 | El panel tarda más de lo previsto: es el trabajo más grande (TIENDA §20.1) | Alta | Alto | M1 ya vende por WhatsApp con la carga del operador; la 2.0 sigue vendiendo; el panel se parte en cuatro sprints con valor propio |
| R3 | ~~Una tienda 2.0 toca un techo antes de M6~~ | — | — | No aplica desde el 13 oct 2026: ninguna tienda 2.0 se migra. Si una toca un techo, se atiende en la 2.0 |
| R4 | Bold cambia o restringe que una plataforma use las llaves de sus comercios | Media | Alto | La autorización expresa del comercio (HU-T11.2); preguntar a Bold antes de T12; `ProveedorDePago` admite otra pasarela |
| R5 | La referencia de la 2.0 trae más de lo planeado (dominio propio, GA4 o Meta, correos, páginas) | Baja | Medio | HU-T12.1 se cerró en T2 y ya movió lo que pedía (correos a T13, Search Console a T3). Sin migración, lo demás es una mejora, no una condición |
| R6 | El diseño se come el presupuesto de rendimiento | Media | Medio | La galería mide antes que las pantallas (HU-T3.1); presupuestos en el CI desde T6 (HU-T3.6) |
| R7 | Leer mal una norma sin abogado | Media | Alto | Cada obligación es un control verificable; las plantillas viven en un sitio y se re-hornean; revisión legal antes del alta abierta (§9) |
| R8 | Perder la KEK es perder los datos cifrados | Baja | Crítico | Copia fuera de línea desde T1 (HU-T2.5) y simulacro de rotación (HU-T17.6) |
| R9 | Choques con el carril del CORE en archivos compartidos (`productos.json`, `celdas.json`, `desplegar.yml`, `packages/pagos`, CHANGELOG) | Media | Medio | Copia de trabajo propia; `git merge-tree` contra la rama abierta del CORE antes de cada push |
| R10 | Factura sorpresa con Workers Paid | Media | Medio | `usd_mes` de la Tienda y el vigía (HU-T2.7); el horno y el MCP se apagan antes que la venta |
| R11 | Los correos caen en spam | Media | Medio | SPF, DKIM y DMARC, un remitente por tienda, tope diario y nada de promociones (HU-T14.3) |
| R12 | El plan gratuito no alcanza: la CPU del horno (10 ms), los cron o las filas de D1 de toda la cuenta | Media | Medio | Medirlo con el horno (HU-T4.1) y con el vigía (HU-T2.7): el dato decide Workers Paid, como pidió el dueño (bitácora tienda3 7) |

---

## 12. Lo que la Tienda espera del CORE, y lo que le da

| Lo que necesita la Tienda | Historia del CORE | Sprint del CORE | La usa |
|---|---|---|---|
| La Tienda en `productos.json` y en la base del CORE | HU-C1.1, HU-C1.2, HU-C2.2, HU-C2.3 | C1–C2 (fusionadas) | HU-T2.2 |
| Kill switches por producto | HU-C3.6 | C2 | HU-T2.7 |
| Entrar con producto, organizaciones y equipo por producto, celda por producto | HU-C3.1, HU-C3.2, HU-C3.3 | C3 | HU-T2.6, HU-T8.1, HU-T10.5, HU-T13.4 |
| Staging con dos productos y tokens N | HU-C3.7, HU-C4.1 | C4 | HU-T2.6, HU-T2.8 |
| El vigía en modo pago | HU-C11.1 | C4 | HU-T2.7 |
| Emitir v2 (`aud = tienda`, `plan`, `auth_time`) y refresh por producto | HU-C4.3, HU-C4.4 | C5 | HU-T2.8, HU-T8.1, HU-T10.3 |
| Componentes base, galería, presupuestos y CSP de `@ed1/ui` v2 | HU-C6.3, HU-C6.4, HU-C6.6 | C3, C5, C6 | HU-T3.1, HU-T3.4 a HU-T3.6 |
| Límites por Worker | HU-C11.2 | C6 | HU-T2.4 |
| Pagar 1, 3, 6 o 12 meses, gracia y celdas al día | HU-C5.3, HU-C5.5, HU-C5.6 | C7 | HU-T13.5 |
| Credenciales por propósito (`CF_SAAS_TOKEN`) | HU-C11.5 | C7 | HU-T13.1 |
| `verificar-agentes` | HU-C8.5 | C8 | HU-T15.6 |
| OAuth 2.1, token rotado y revocar | HU-C9.4 a HU-C9.6 | C9–C10 | HU-T15.7 |
| El adaptador de correo y entrar con correo | HU-C10.1, HU-C10.2 | C11 | HU-T14.3, HU-T13.4 |
| La copia fuera de Cloudflare | HU-C11.4 | C11 | HU-T17.3 |

**Lo que la Tienda le da al CORE:** `@ed1/calendario` (los días hábiles que pide HU-C7.7, construidos antes por HU-T1.2) y `@ed1/pagos` (el adaptador de Bold, que sale del CORE en HU-T11.1 con las pruebas del CORE intactas).

---

## 13. Registro de velocidad

| Sprint | Comprometido | Validado por el dueño | Nota |
|---|---|---|---|
| T0 | 21 | 17 (HU-T0.1, PR #101; HU-T1.1 a HU-T1.4, PR #107) | Carril de holgura, construido el 6 oct 2026. HU-T3.1 espera la elección del dueño (D-T2) y HU-T12.1 sus respuestas. Con 5 historias en validación se pasó el tope de 3 (§3.6) y no se abrió T1 hasta que el dueño fusionó el PR #107 y pidió seguir (13 oct 2026) |
| T1 | 16 | 0 (en validación: HU-T2.1 a HU-T2.5) | Construido el 13 oct 2026, en el plan gratuito (bitácora tienda3 7), en el PR del sprint. El dueño pidió avanzar por sprint: con T1 hay 7 historias esperando validación, más que el tope de 3 (§3.6). HU-T2.5 espera que el dueño corra el script de los secretos; sin él, el paso de la Tienda del despliegue queda en rojo sin detener a los demás |
| T2 | 12 | 0 (en validación: HU-T0.2, HU-T2.6, HU-T2.7 y HU-T2.8) | Construido el 13 oct 2026. La Tienda de T1 quedó viva en staging con sus secretos (salud de las dos bases, KEK legible). HU-T3.3 (2) espera la elección de la tipografía (D-T2). Nació HU-T2.10 (2, en T3): la Tienda activa solo en staging, con las organizaciones de prueba y la aceptación de M0, que es trabajo del CORE |
| T3 | 19 | 0 (en validación: HU-T2.10, HU-T3.2, HU-T4.1, HU-T4.2, HU-T5.1 y HU-T14.8) | Construido el 13 oct 2026, con el plan rehecho sin M6 (bitácora tienda3 9). El horno hornea a los dos comercios de prueba y el despacho los sirve en proceso; en staging falta el almacén R2, que espera al dueño. La tipografía (D-T2) espera su elección, con la recomendación nueva: la del ecosistema |
| T4 | 22 (20 + HU-T3.3, que esperó D-T2) | 0 (en validación: HU-T3.3, HU-T3.4, HU-T4.3, HU-T4.4, HU-T5.3, HU-T5.6 y HU-T17.1) | Construido el 14 oct 2026. Publicar ya hornea, pasa la compuerta y sube a R2 sin cola (plan gratuito); en staging los dos comercios de prueba se publican en cada despliegue. Las fotos cambiaron por seguridad a un bucket propio (bitácora tienda3 10), que espera al dueño. El cron de la Tienda es el quinto de la cuenta, solo en producción (D-T10) |
| T5 | 20 | 0 (en validación: HU-T5.2, HU-T5.4, HU-T5.5, HU-T6.5, HU-T7.1 y HU-T15.1) | Construido el 14 oct 2026. La vitrina queda completa en el horno: las tres portadas, la ficha con lo que pide la ley, las fotos con sus derivadas, el carrito con su código, cotizar en el servidor y «Avísame», y los textos legales de cada tienda. La Tienda tiene e2e propias (360 y 1280 px, CLS, sin JavaScript). El límite de «Avísame» quedó por minuto (bitácora tienda3 11). Esperan al dueño: la lectura de las plantillas legales (WI-T7.1.4) y la revisión visual (WI-T5.2.3) |
| T6 | 20 | 0 (en validación: HU-T2.9, HU-T3.6, HU-T6.1, HU-T6.2, HU-T6.3 y HU-T12.2) | Construido el 14 oct 2026. Se pide por WhatsApp con la aceptación verificable, el acuse y el seguimiento secreto; la vitrina tiene presupuestos y CSP en el CI; una tienda se carga desde un archivo. La versión `0.1.0` lleva la Tienda a producción sin tiendas, en `panel.` y `origen.`. El carrito pasó a `/carrito/`, como dice TIENDA §5.4 (bitácora tienda3, «Afirmaciones mías»). PR #181 fusionado el 14 oct; `tienda-v0.1.0` etiquetada el 15 oct, pero el paso de la Tienda en producción terminó en error: CA1 de HU-T2.9 sigue sin cumplirse (bitácora tienda3 12) |
| T7 | 17 de 19 | 0 (en validación: HU-T3.5, HU-T5.7, HU-T6.4, HU-T8.1 y HU-T17.2) | Construido el 15 oct 2026. Las solicitudes con radicado, cifradas y con su plazo en días hábiles; las purgas diarias; y el panel abre la puerta: entrar con Google, elegir la tienda y los componentes con una tienda llena. Se cerró además el CA2 de HU-T2.10: el despliegue de staging crea Ensayo Uno y Ensayo Dos en el CORE con el dueño de propietario. HU-T7.2 (2) espera los datos de Laboratorio Digital como encargado; HU-T5.7 (2), la aceptación de M1, quedó en validación: espera la compra de prueba del dueño |
| T8 | 12 | 8 (HU-T8.2 y HU-T8.3, validadas en staging el 15 oct; en validación: HU-T8.4 y HU-T10.6) | Construido el 15 oct 2026. Los productos con combinaciones, colecciones y fotos se editan desde el teléfono sin pisarse, y cada cambio queda en el registro en frases. Las fotos se comprimen en el teléfono y caen a JPEG donde no hay WebP. El bucket de las fotos se enlazó primero en staging, por decisión del dueño, y en producción el 15 oct, después de que una foto subiera bien en staging. Los cambios se ven en la tienda cuando se publique; publicar desde el panel llega con HU-T10.4 (T10) |
| T9 | 20 | 0 (en validación: HU-T4.5, HU-T8.5, HU-T9.1, HU-T9.2, HU-T9.3 y HU-T10.3) | Construido el 15 oct 2026. El panel ya atiende la tienda: el inventario con su libro, la bandeja de pedidos con el comprador tapado, ver sus datos de entrega dejando huella, confirmar por WhatsApp descontando el inventario, y los ajustes por sección con la entrada reciente donde se mueve la plata. Agotar o reponer re-hornea lo publicado sin publicar nada más. Se corrigió el registro, que decía «única» en vez de la combinación (bitácora tienda3 19). La vitrina todavía no pide el contacto del comprador: sin él, «Ver datos de entrega» no tiene qué mostrar en los pedidos por WhatsApp |
| T10 | 20 | 0 (en validación: HU-T9.4, HU-T9.5, HU-T9.6, HU-T10.1, HU-T10.4 y HU-T10.5) | Construido el 15 oct 2026. La contraentrega va de punta a punta: despachar con guía, recaudar al entregar, devolver o perder, y liquidar varios. Los pedidos que llegan por teléfono se anotan, y cancelar no descuadra el inventario. Envíos y cupones desde el panel: el cupón se agota en su tope sin hacer fallar un pago. Publicar dice todo lo que falta, y «Volver a esta» mueve la tienda a una versión anterior sin tocar pedidos ni inventario. El colaborador llega por WhatsApp y recibe 403 en lo que es del propietario. Las fotos se enlazaron en producción (PR #191) |
| T11 | 16 | 0 (en validación: HU-T3.7, HU-T7.3, HU-T9.7, HU-T10.7 y HU-T14.2) | Construido el 15 oct 2026. Las solicitudes se atienden desde el panel con su plazo; el tablero de Inicio compara con el mes anterior por el calendario; «Descargar todo» sale en el formato de la carga y vuelve igual; el comprador pide sus datos, que se corrijan o que se borren, y el plazo de conservación lo pone el comercio. La tienda llena (2.000 productos y 300 pedidos) se publica dentro de sus presupuestos después de partir la portada y las listas en páginas (bitácora tienda3 20). M2 queda construido; el recorrido del dueño con la tienda llena (WI-T3.7.3) y su validación lo cierran. |
| T12 | 11 de 19 | 0 (en validación: HU-T11.1, HU-T11.4 y HU-T17.3) | Construido el 16 oct 2026. El adaptador de Bold salió del CORE a `@ed1/pagos` (PR #195, aparte, con permiso del dueño); se paga en línea con el botón de Bold, con el pedido, el cobro y lo apartado en un solo lote, y cada tienda tiene su respaldo semanal en R2. HU-T11.2 y HU-T11.3 (8) pasaron a T14: esperaban HU-T7.2 |
| T13 | 16 | 0 (en validación: HU-T11.5, HU-T11.6, HU-T11.7, HU-T11.9 y HU-T14.3) | Construido el 16 oct 2026. Los avisos firmados de Bold dejan el pedido pagado solos, la página y el cron le preguntan a Bold por lo que no avisó, el pagado sin existencias tiene su camino, y la tienda manda correos por Gmail (`@ed1/correo`, HU-C10.1, PR #198). Después, sin sprint, el plan gratuito pidió cinco arreglos medidos con la tienda llena: listas de a 50, filas leídas, el freno de R2, la purga de versiones, las migraciones y publicar por tandas (PR #194 y #199 a #203; bitácora tienda3 26 a 30) |

---

## 14. De TIENDA §19 a las historias

| Hito | Historias | Pts |
|---|---|---|
| M0 · Fundación | HU-T0.1, HU-T0.2, HU-T1.1 a HU-T1.4, HU-T2.1 a HU-T2.8, HU-T3.1, HU-T3.3, HU-T12.1 | 49 |
| M1 · La tienda pública | HU-T2.9, HU-T3.2, HU-T3.4, HU-T3.6, HU-T4.1 a HU-T4.4, HU-T5.1 a HU-T5.7, HU-T6.1 a HU-T6.5, HU-T7.1, HU-T12.2, HU-T15.1, HU-T17.1 | 82 |
| M2 · El panel | HU-T3.5, HU-T3.7, HU-T4.5, HU-T7.2, HU-T7.3, HU-T8.1 a HU-T8.5, HU-T9.1 a HU-T9.7, HU-T10.1, HU-T10.3 a HU-T10.7, HU-T14.2 (por la paridad), HU-T17.2 | 80 |
| M3 · Cobrar | HU-T11.1 a HU-T11.11, HU-T17.3, HU-T17.4 | 44 |
| ~~M6 · Las tiendas actuales~~ | Retirado el 13 oct 2026. HU-T0.3, HU-T4.6 y HU-T17.5 pasaron a M3 y M4; HU-T12.3 es carga asistida; HU-T12.4 a HU-T12.8 se retiraron | — |
| M4 · Dominios, alta y plan | HU-T13.1 a HU-T13.7, HU-T17.6 | 26 |
| M5 · Medición | HU-T14.1, HU-T14.3 a HU-T14.8, HU-T8.6 y HU-T10.2 | 20 |
| M7 · Agentes | HU-T15.2 a HU-T15.7 | 19 |
| M8 · Factura integrada | HU-T16.1 a HU-T16.4 | 12 |
| **Total** | 114 historias | **356** |

