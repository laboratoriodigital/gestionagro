# CORE de la plataforma ED1 — Plan de trabajo y backlog

**Versión:** 0.1.0 · 5 oct 2026
**Dueño del producto:** Sebas. **Gerencia del proyecto y Scrum:** el asistente, que también hace los commits; el dueño hace el push, aprueba los PR y valida en staging.
**Fuente única de:** hitos, sprints, épicas, historias, work items, estado y velocidad **del CORE** (identidad, organizaciones, productos, planes, cobros, tokens, cuenta, autorización para agentes y la operación común de la plataforma). Lo del agro sigue en `../BACKLOG.md`; lo de la Tienda, en `../tienda/TIENDA-3.0.md` §19.
**Lo que manda sobre este documento:** `../ecosistema/ECOSISTEMA-DIGITAL-ED1-v1.4.md` (ED1 §N) → `../ARQUITECTURA.md` (ADR-N, P1–P21) → `PLATAFORMA.md` (el diseño, §N). Aquí se planea; allí se decide. Ante una contradicción, se señala antes de actuar.
**Lecciones:** `BITACORA_CORE.md` (bitácora core N), `../BITACORA.md` (bitácora agro N) y `../tienda/BITACORA-ecommerce.md` (bitácora ecommerce N). Los patrones P1–P21 son del ecosistema y conservan su número.

---

## 0. En una página

**Qué es el proyecto.** Llevar el CORE v0, que hoy sirve a un solo producto (CultivoPro), a un CORE **con dimensión de producto**, listo para la Tienda 3.0 y para lo que venga, con su propia cara: la **cuenta ED1** en `cuenta.laboratorio-digital.com`. Es la decisión 6 del dueño (ED1 [D6], ADR-20) y la hoja de ruta P0–P6 de PLATAFORMA §7, más dos cosas que esa hoja no tenía: el **sistema de diseño del ecosistema** y la **cuenta** (ED1 §16).

**La regla del proyecto:** nada de lo que hoy funciona se rompe. Hay cuadernos instalados con la URL y el emisor de hoy (P10); todo contrato se expande, se migra y se contrae.

| Hito | Qué queda funcionando | Fase de PLATAFORMA §7 | Cierra | Fecha objetivo | Desbloquea |
|---|---|---|---|---|---|
| **HC0 · Producto como dato** | `productos.json`, `cuentas.json`, `dominios.json` y `celdas.json` v2 con sus esquemas; convención de commits con guardia; versión propia del CORE | P0 | C2 | 30 oct 2026 | — |
| **HC1 · Producto en el CORE** | Migraciones 0006 y 0008 con la receta probada en D1; API por producto (expandir); kill switches por producto; tokens N (verifican v1 y v2); vigía en modo pago | P1 | C4 | 27 nov 2026 | **Tienda M0** (con Workers Paid y la zona `.app`) |
| **HC2 · Cuenta v0 con el sistema de diseño** | `@ed1/ui` v2 (tokens, tipografía, componentes, galería y presupuestos); `cuenta.laboratorio-digital.com`: entrar y ver mis organizaciones; el CORE emite v2 | parte de P2 | C6 | 23 dic 2026 | — |
| **HC3 · Tokens v2 cerrados** | v1 contraído; sesión por producto | P2 | C7 | 22 ene 2027 | **Tienda M2** (panel) |
| **HC4 · Planes por periodo** | 1, 3, 6 y 12 meses, meses calendario, crédito al cambiar de plan, gracia, celdas al día. **CORE 1.0.0** | P3 | C7 | 22 ene 2027 | **Tienda M4** (cobro del plan) |
| **HC5 · Legible por agentes** | Capa estática en `cultivopro.co` y en el CORE; `verificar-agentes` detiene producción | P4 | C8 | 5 feb 2027 | — |
| **HC6 · OAuth y MCP** | El CORE como servidor de autorización OAuth 2.1; consentimiento y «Aplicaciones conectadas»; MCP del cuaderno (lectura); mis datos (Ley 1581) | P5 | C10 | 5 mar 2027 | **Tienda M7** (agentes) |
| **HC7 · Correo** | Entrar con correo (enlace mágico) y avisos por correo; copia cifrada fuera de Cloudflare con simulacro | P6 | C11 | 19 mar 2027 | Alta abierta de la Tienda sin Google |

**Fuera de alcance, a propósito:**

- **Product Engine, Admin OS y automatizaciones configurables** (ED1 §3.11, regla de tres): siguen esperando su tercer caso.
- **Migrar el sitio y el cuaderno de CultivoPro al diseño nuevo:** preparada (HU-C6.7), con disparador.
- **MCP del comercio:** es de la Tienda (M7). **Factura electrónica:** gancho sin activar (PLATAFORMA §4.8, [D5]).
- **El sitio principal `laboratorio-digital.com`:** necesita la marca pública del ecosistema (ED1 Fase 0). Reusará el sistema de diseño cuando exista esa decisión.

---

## 1. Supuestos del plan

Si alguno es falso, se reordena el plan.

| Supuesto | Valor | Por qué importa |
|---|---|---|
| Equipo | El dueño (producto, validación y aprobación) + el asistente (análisis, código, pruebas, documentos y commits) | ED1 §25: las horas del dueño son el límite real |
| Sprints | 2 semanas, de lunes a viernes, con el mismo calendario del agro | Las ceremonias se comparten |
| Escala | Fibonacci; **1 punto ≈ 3 h ideales** con asistencia, igual que el agro | Se compara con el agro |
| Velocidad planeada | **20 puntos por sprint** (16 en sprints con festivo; 14 en el corto de diciembre) | El agro planeó 10 y tocó 69 de sus 81 historias en 5 días (217 commits del 30 sep al 5 oct). Se planea el doble de 10, no el ritmo observado, porque ese ritmo dejó 57 historias **«En sprint» esperando validación** |
| **Cuello de botella** | **La validación del dueño en staging, no la construcción** | Por eso hay límite de trabajo en curso (§2.6) y una historia no se cuenta terminada sin validar |
| Reparto de las horas | Hasta HC1, el CORE va primero (la Tienda M0 depende de él). Desde HC1, CORE y Tienda corren en dos carriles con el límite de §2.6. El agro, solo mantenimiento | Decisión D-C4 (§9) |
| Festivos | 12 oct, 2 nov, 16 nov, 8 dic, 25 dic 2026; 1 y 11 ene, 22, 25 y 26 mar 2027 | Sprints cortos: C1, C3, C4, C5, C6 y C7 |
| Congelamiento | **Del 18 dic 2026 al 11 ene 2027 no se publica a producción** | Un contrato roto con nadie mirando dura dos semanas (P10) |
| Workers Paid | Lo activa el dueño con el M0 de la Tienda (PLATAFORMA §3.2), en el C4 | El vigía en modo pago (HU-C11.1) y el correo (EC10) lo necesitan |

---

## 2. Cómo se trabaja

### 2.1 GitHub flow

- `main` protegida. Todo cambio entra por PR **a `main`**, que el dueño aprueba y fusiona.
- Cada rama sale de `origin/main` actualizado y vive poco: una historia, una rama.
- **Nombre de rama:** `<tipo>/c<épica>.<n>-<tema>`, por ejemplo `feat/c3.1-entrar-con-producto` o `docs/core-plan-y-backlog`.
- Si dos ramas tocan el mismo archivo, se prueba `git merge-tree --write-tree origin/main <rama>` antes del push. Cuando el dueño fusiona una, la otra se actualiza con `git merge origin/main`.
- Una historia que depende de otra sin fusionar lo dice, y espera.

### 2.2 Commits: `tipo(alcance): descripción`

- **Tipos:** `feat`, `fix`, `docs`, `refactor`, `test`, `ci`, `build`, `perf`, `chore`, `revert`.
- **Alcances del CORE:** `core`, `cuenta`, `ui`, `tokens`, `productos`, `migraciones`, `pagos`, `planes`, `oauth`, `mcp`, `agentes`, `correo`, `vigia`, `despliegue`, `ci`, `versiones`, `bitacora`.
- **Descripción** en español, en minúscula, sin punto final, de 72 caracteres o menos. Dice qué cambia para quien usa el sistema, no qué archivo se tocó.
- **Cuerpo:** el porqué, la historia (`HU-C3.1`), el control negativo y lo que no cambia.
- **Sin la marca de Claude Code:** ni `Co-Authored-By`, ni `Claude-Session`, ni «Generated with Claude Code», en commits ni en PR (pedido del dueño, 5 oct 2026). Lo vigila HU-C0.2.

```text
feat(core): la sesión nace con su producto

HU-C3.1. Sin producto en la solicitud, la sesión es del agro mientras dure la
transición (P10). Control negativo: aceptar una vuelta de otro producto hace
fallar «entrar.test.ts › vuelta de otro producto».
```

### 2.3 Versionado semántico `x.y.z`, por producto

PLATAFORMA §6.3 pide una versión por producto. HU-C0.3 la trae para el CORE:

- **El CORE y su cuenta** llevan la versión de `apps/core/package.json`. Etiquetas `core-vX.Y.Z` y su propio `apps/core/CHANGELOG.md`.
- **El agro** sigue con la versión de la raíz y sus etiquetas `vX.Y.Z` hasta que llegue la Tienda (`tienda-vX.Y.Z`). Las `vX.Y.Z` existentes son historia del agro.

| Cambio en el CORE | Versión |
|---|---|
| Rompe un contrato que usa una app instalada o una celda (token, ruta, parámetro obligatorio) **después** de su fase de contraer | Mayor |
| Capacidad nueva compatible, o una fase de expandir | Menor |
| Arreglo sin cambio de contrato | Parche |

Mientras el CORE esté en `0.x`, un menor puede contraer, siempre con las tres fases de PLATAFORMA §4.6. **CORE 1.0.0** se publica cuando el contrato queda estable: tokens v2 únicos, API v1 por producto y planes por periodo (HC4).

| Versión | Sprint | Qué trae |
|---|---|---|
| core-v0.2.0 | C2 | Versión propia; lectura de `productos.json` |
| core-v0.3.0 | C4 | Producto en la base y en la API (expandir), auditoría, kill switches por producto, tokens N |
| core-v0.4.0 | C5 | Emite v2; refresh por producto; `cuenta.laboratorio-digital.com`; entrar a la cuenta |
| core-v0.5.0 | C6 (se publica el 12 ene, por el congelamiento) | Mis organizaciones; precios por periodo en la base; límites por Worker |
| **core-v1.0.0** | C7 | Contrae v1; pagar 1, 3, 6 o 12 meses; cambio de plan; gracia; celdas al día |
| core-v1.1.0 | C8 | Mis sesiones, mis pagos, actividad; lo legible por agentes del CORE |
| core-v1.2.0 | C10 | OAuth 2.1, aplicaciones conectadas, mis datos |
| core-v1.3.0 | C11 | Entrar con correo y avisos por correo |

### 2.4 Pull request

- Título con la forma de un commit. Descripción con la plantilla de `.github/pull_request_template.md`: qué cambia, **control negativo**, qué documento cambió (P18) y la Definición de Terminado.
- Una pieza del diseño pasa a `ARQUITECTURA.md`, con su ADR, **en el mismo PR que la implementa** (PLATAFORMA, «Cómo se usa»).
- Al cerrar cada parte, el asistente entrega los comandos exactos de `git` y `gh` para el push y el PR, y las pruebas que el dueño debe hacer, paso a paso: qué abrir, qué tocar y qué debe verse.

### 2.5 Ceremonias para un equipo de dos (~1,5 h del dueño por sprint)

| Ceremonia | Cuándo | Qué sale |
|---|---|---|
| Planeación (30 min) | Lunes del sprint | Meta del sprint, historias comprometidas y **orden de validación** |
| Revisión (30 min) | Viernes de cierre | Demostración en staging con los pasos exactos; lo que el dueño valida pasa a «Terminada» |
| Retrospectiva (15 min) | Viernes de cierre | Qué va a `BITACORA_CORE.md` y qué patrón se confirmó |
| Refinamiento (15 min) | Miércoles de la segunda semana | Historias del sprint siguiente que cumplen la Definición de Listo |

### 2.6 Límite de trabajo en curso

- **Como mucho 4 historias del CORE esperando validación del dueño.** Con 4, no se abre una nueva: se prepara la demostración de las pendientes.
- Una historia se cuenta en la velocidad **el día que el dueño la valida**, no el día que se fusiona.

---

## 3. Definición de Listo y de Terminado

### 3.1 Definición de Listo (DoR)

Una historia entra a un sprint solo si:

1. Tiene criterios de aceptación verificables, con **al menos uno negativo** (lo que no debe pasar).
2. Está estimada y cabe en un sprint (≤ 5 puntos).
3. Sus dependencias están terminadas, o en el mismo sprint antes que ella.
4. Dice **qué pasa con los clientes instalados** (cuadernos con la URL y el emisor de hoy, P10) y en qué fase va: expandir, migrar o contraer.
5. Cita su **respaldo** (PLATAFORMA §N, ED1 §N, ADR-N) o dice que ningún documento la cubre (memoria del proyecto: premisas antes de decidir).
6. Si consume cuota o dinero (Worker, D1, KV, R2, correo), trae su estimación y el nombre de su kill switch.
7. Nombra los patrones de las bitácoras que corre riesgo de repetir.
8. Si tiene pantalla, trae su boceto en palabras: qué ve la persona, qué toca y qué dice cada estado (cargando, vacío, error).

### 3.2 Definición de Terminado (DoD)

1. Fusionada a `main` por PR, con CI en verde: lint, typecheck, pruebas, build, licencias y guardias de repositorio.
2. Pruebas unitarias de la lógica; pruebas de Worker con D1 local (`getPlatformProxy`) para lo que toca la base.
3. **Control negativo** escrito en el PR: qué defecto se puso y cómo se vio en rojo (P5).
4. **Probado con dos productos**: el agro y el producto de ensayo (P4 en versión CORE). Ningún nombre real en el código.
5. Si toca un contrato: prueba de contrato con la versión anterior del cliente (P10).
6. Si toca seguridad o dinero: escribe en `auditoria` (desde HU-C2.4) y nada sensible viaja en una URL (P13).
7. Si tiene pantalla: e2e en 360 px y 1280 px, claro y oscuro, **axe sin violaciones**, dentro de los presupuestos de §4.7, y textos revisados con la regla de textos públicos (cálidos y sin técnica).
8. Documentación al día en el mismo PR (P18). Si la pieza sale de PLATAFORMA, su ADR entra a `ARQUITECTURA.md`.
9. Versión del CORE subida y entrada en `apps/core/CHANGELOG.md` (desde HU-C0.3; antes, la raíz).
10. Desplegada a staging, prueba de humo en verde y **validada por el dueño** con los pasos que dio el asistente.
11. Si algo se rompió o se aprendió en el camino, hay entrada en `BITACORA_CORE.md`.

---

## 4. Dirección de diseño del frontend

El dueño pidió desde el inicio un frontend **bonito, minimalista y moderno**, con dos referencias: el sitio de Porsche Colombia y Coda Press. Esta sección traduce esas referencias a reglas que no rompen las premisas del ecosistema ni las del CORE. La construye la épica EC6 y la usa primero la cuenta (EC7).

### 4.1 Premisas que el diseño no rompe

| Premisa | Qué exige al diseño |
|---|---|
| **Static-first** (ED1 §3.10) | Las páginas de la cuenta son archivos estáticos. El Worker atiende solo `/api/core/*`, `/oauth/*` y `/.well-known/*`. Por ejemplo, en el consentimiento OAuth el Worker valida la solicitud y redirige a la página estática, con la solicitud en el fragmento |
| **Costo cero** (ED1 §3.2) | Nada de video, carruseles ni imágenes pesadas. La trama de fondo es un SVG de menos de 2 KB. Sin fuentes ni scripts de terceros |
| **P20 · desde quien mira** | 360 px primero, sol en la pantalla y dedos grandes: objetivos táctiles de 48 px, contraste AA (4,5:1 en texto), modo oscuro según la preferencia del teléfono |
| **P1 · el fallo que funciona** | «Cargando», «vacío» y «error» son tres estados distintos y dicen cosas distintas (bitácora agro 17). El contenido se ve **sin** animaciones: nada nace con opacidad 0 esperando un script |
| **P13 · secretos** | Ningún código ni token en la URL; van en el fragmento o en el cuerpo de un POST |
| **CSP `'self'`** sin `'unsafe-inline'` | Los estilos van en hojas, y lo dinámico en hojas construidas (`adoptedStyleSheets`). La CSP ignora en silencio un `<style>` en línea (bitácora agro, «Lo que el terreno enseñó») |
| **Textos públicos** | Cálidos y sin técnica: «Dónde has entrado» y no «sesiones activas»; «Aplicaciones que pueden ayudarte» y no «clientes OAuth» |
| **Owner-first** (ED1 §3.7) | La cuenta resuelve sola lo que hoy obligaría a escribirle al dueño: cerrar un teléfono perdido, descargar mis datos, ver qué pagué |
| **Accesibilidad** | `lang="es-CO"`, foco visible, todo usable con teclado, axe sin violaciones |

### 4.2 Lenguaje visual: «editorial técnico»

| Referencia | Qué se toma | Qué no se toma |
|---|---|---|
| **Porsche** | Titulares grandes y ligeros con el interletrado cerrado; mucho aire; tarjetas de radio amplio; botones en píldora; navegación mínima (marca y menú); imagen a sangre solo en una portada | Video automático, carruseles, imágenes pesadas, fuentes propietarias |
| **Coda Press** | Monoespaciada en mayúsculas para etiquetas, datos y titulares técnicos; fondo de tinta con trama; texto que pasa de gris a blanco al desplazarse; la página 404 como pieza editorial (el enlace de referencia, `/x`, es justamente su 404) | Aviso de cookies (la cuenta no usa cookies de medición), cursores propios, animación con JavaScript |

**La síntesis:**

- Tinta y papel, con **un acento por producto**.
- **Sans para lo humano** (titulares y texto), **mono para lo exacto**: fechas, montos, códigos, radicados y plazos.
- Una pantalla, una decisión. Los titulares dicen qué puede hacer la persona.

### 4.3 Tokens v2, en tres capas

`@ed1/ui` hoy tiene una hoja (`tokens.css`, v1) que usan el sitio y el cuaderno. **La v2 se agrega al lado y no la reemplaza** (P10: nada de lo que funciona cambia de aspecto sin decidirlo).

```text
@ed1/ui
├── src/tokens.css                 v1, intacta (sitio y cuaderno de CultivoPro)
└── src/v2/
    ├── primitivos.css             escala de grises 0–1000, acentos, tipografía, espacio, radios, tiempos
    ├── semanticos.css             --superficie, --texto, --texto-suave, --borde, --acento, --foco, --peligro, --exito
    ├── temas/ecosistema.css       tinta y papel + el acento del ecosistema (la cuenta)
    ├── temas/cultivopro.css       el verde de marca de hoy (#1f6b3a), para cuando se migre
    └── componentes/*.css
```

| Grupo | Propuesta (se valida con su prueba de contraste en HU-C6.1) |
|---|---|
| Tipo | Base de 17 px y escala 1,25. Display `clamp(2.5rem, 8vw, 6rem)`, peso 300–400, interletrado −0,03 em. Etiqueta mono de 0,75 rem en mayúsculas, interletrado +0,08 em |
| Espacio | Múltiplos de 4 px; secciones con 96–160 px de aire en escritorio y 48–64 px en el teléfono |
| Radios | 12 px en campos, 24 px en tarjetas y 999 px en píldoras |
| Profundidad | Sin sombras pesadas: bordes de 1 px y cambios de superficie |
| Movimiento | 150, 250 y 400 ms, con salida suave. Con `prefers-reduced-motion`, cero |
| Color | Claro y oscuro por preferencia. Cada pareja texto/superficie pasa 4,5:1, y la prueba lo calcula, no lo afirma (P18) |

### 4.4 Tipografía (decisión D-C1)

- **Propuesta:** Geist y Geist Mono (licencia SIL Open Font License 1.1), **autoalojadas**. Variables, en `woff2`, recortadas al latín con todo lo del español (tildes, ñ, ü, ¿, ¡, «, »), con `font-display: swap`.
- **Sin salto de diseño:** métricas de respaldo con `size-adjust`, para que el cambio de fuente no mueva la página (CLS ≈ 0). Solo se precarga la display.
- **Presupuesto:** 70 KB entre las dos.
- **Por qué no Google Fonts:** sería un tercero en cada visita, contra la CSP `'self'` y contra la política de datos.
- **Si el dueño prefiere cero bytes:** `system-ui` y `ui-monospace`, que es lo que hace hoy la v1. El diseño sigue funcionando; pierde carácter.

### 4.5 Componentes base (HU-C6.3)

Cada uno con sus estados, sin JavaScript salvo donde se dice:

- **Encabezado mínimo:** marca y menú; en el teléfono, el menú es un `<details>` sin JS.
- **Botón:** primario en píldora, secundario de contorno y de texto. Estados ocupado y deshabilitado con su motivo.
- **Campo:** etiqueta arriba, ayuda y error **junto al campo**; un formulario muestra **todos** sus errores en la misma vuelta (bitácora agro 16).
- **Tarjeta y lista de acciones.**
- **Aviso:** aparece **en la vista de la acción que lo causó** (bitácora agro, «un aviso fuera de la vista es un botón que no hace nada»).
- **Estado:** cargando, vacío con el porqué y qué hacer, y error con la causa (P15).
- **Etiqueta mono, pie con legales y confirmación** para lo irreversible (cerrar todas las sesiones, revocar una aplicación).
- **Páginas de error editoriales** (404 y 500), al estilo de la referencia.

### 4.6 Las pantallas de la cuenta (`cuenta.laboratorio-digital.com`)

| Ruta | Qué ve la persona | Historia |
|---|---|---|
| `/` | «Tu cuenta»: sus espacios en cada producto, como tarjetas con la marca del producto, su rol y su plan, y el botón para abrir la app | HU-C7.4 |
| `/entrar/` | Entrar con Google (y con correo, desde HC7). Si viene de una app, dice a cuál vuelve | HU-C7.3, HU-C10.2 |
| `/seguridad/` | Dónde has entrado (por producto y dispositivo) y las aplicaciones conectadas, con «Cerrar» y «Quitar acceso» | HU-C7.5, HU-C9.6 |
| `/pagos/` | Lo que pagó cada espacio que administras: plan, periodo cubierto y monto | HU-C7.6 |
| `/datos/` | Tus datos: descargarlos y radicar una consulta, un reclamo o una supresión, con su plazo | HU-C7.7 |
| `/actividad/` | El registro de lo que tocó seguridad o dinero en un espacio que administras | HU-C7.8 |
| `/autorizar/` | Quién pide permiso, para qué, sobre qué espacio y hasta cuándo | HU-C9.4 |
| `/_galeria/` | Todos los componentes en todos sus estados. No se indexa | HU-C6.4 |

### 4.7 Presupuestos (los mide el CI, no la vista)

| Medida | Tope por página de la cuenta | Cómo se mide |
|---|---|---|
| JavaScript | ≤ 20 KB con gzip | e2e que espera a que la página esté completa, islas incluidas (bitácora agro 14) |
| CSS | ≤ 15 KB con gzip | Ídem |
| Fuentes | ≤ 70 KB | Ídem |
| LCP | ≤ 2,0 s con la CPU ×4 y red lenta | Proyecto `@rendimiento`, solo y con un worker (bitácora agro 20) |
| CLS | ≤ 0,05 | Lighthouse CI |
| Accesibilidad | 100 en Lighthouse y axe sin violaciones | Lighthouse CI y `@axe-core/playwright` |

### 4.8 Lo que no se hace, y por qué

- **Ningún framework de CSS de terceros:** los tokens son la única fuente (P2), y cada dependencia es peso y licencia.
- **Ninguna animación con JavaScript, ni íconos en fuente web:** los íconos son un sprite SVG.
- **No se migra CultivoPro todavía:** HU-C6.7 queda preparada hasta que la cuenta lleve un mes estable y el dueño lo decida.

---

## 5. Plan de sprints

| Sprint | Fechas | Meta del sprint | Historias | Pts |
|---|---|---|---|---|
| **C1** (festivo) | 6–16 oct 2026 | El CORE sabe qué productos existen, la receta se prueba en D1 y el diseño tiene sus tokens | HU-C0.1 (1), HU-C0.2 (2), HU-C1.1 (3), HU-C1.3 (2), HU-C2.1 (3), HU-C6.1 (3), HU-C7.1 (2) | 16 |
| **C2** | 19–30 oct | **HC0.** La 0006 en staging, el despliegue copia los productos y el CORE tiene versión propia | HU-C0.3 (3), HU-C1.2 (2), HU-C1.4 (2), HU-C2.2 (5), HU-C2.3 (3), HU-C3.6 (2), HU-C6.2 (2) | 19 |
| **C3** (festivo) | 3–13 nov | Entrar, organizaciones y equipo saben de productos; auditoría; componentes base | HU-C2.4 (3), HU-C3.1 (5), HU-C3.2 (3), HU-C3.3 (2), HU-C6.3 (5) | 18 |
| **C4** (festivo) | 17–27 nov | **HC1.** Dos productos en staging; tokens N; el vigía en modo pago | HU-C3.4 (2), HU-C3.5 (2), HU-C3.7 (3), HU-C4.1 (3), HU-C4.2 (1), HU-C11.1 (5) | 16 |
| **C5** (festivo) | 30 nov–11 dic | El CORE emite v2 y la cuenta abre en su dominio | HU-C4.3 (3), HU-C4.4 (2), HU-C4.6 (3), HU-C6.4 (3), HU-C7.2 (3), HU-C7.3 (3) | 17 |
| **C6** (corto) | 14–23 dic | **HC2.** Mis organizaciones; precios por periodo en la base; movimiento y presupuestos. Solo staging desde el 18 dic | HU-C5.1 (2), HU-C5.2 (2), HU-C6.5 (2), HU-C6.6 (2), HU-C7.4 (3), HU-C11.2 (2) | 13 |
| — | 24 dic–8 ene | Pausa y congelamiento. Se anota lo que falle en staging | — | — |
| **C7** (festivo) | 12–22 ene 2027 | **HC3 y HC4. CORE 1.0.0:** v1 contraído, pagar por periodo, gracia, celdas al día | HU-C4.5 (2), HU-C5.3 (3), HU-C5.4 (2), HU-C5.5 (2), HU-C5.6 (3), HU-C5.7 (2), HU-C11.5 (2) | 16 |
| **C8** | 25 ene–5 feb | **HC5.** Lo legible por agentes; la cuenta muestra sesiones, pagos y actividad | HU-C7.5 (3), HU-C7.6 (2), HU-C7.8 (2), HU-C8.1 (2), HU-C8.2 (3), HU-C8.3 (3), HU-C8.4 (2), HU-C8.5 (3) | 20 |
| **C9** | 8–19 feb | El CORE autoriza agentes con consentimiento; CI de lo afectado | HU-C9.1 (2), HU-C9.2 (3), HU-C9.3 (3), HU-C9.4 (5), HU-C11.3 (3) | 16 |
| **C10** | 22 feb–5 mar | **HC6.** Refresh rotado, revocar, MCP del cuaderno y mis datos | HU-C9.5 (3), HU-C9.6 (3), HU-C9.7 (5), HU-C7.7 (5) | 16 |
| **C11** | 8–19 mar | **HC7.** Entrar con correo, avisos por correo y la copia fuera de Cloudflare | HU-C10.1 (3), HU-C10.2 (5), HU-C10.3 (2), HU-C11.4 (5) | 15 |

**Total:** 182 puntos en 11 sprints. Si la velocidad real del C1 y el C2 supera los 20, el plan se acorta: lo que manda el orden es el camino crítico de la Tienda (HC1 → HC3 → HC4), no las fechas.

**Lo que la Tienda espera del CORE** (TIENDA-3.0 §19):

| Hito de la Tienda | Necesita | Lo da | Desde |
|---|---|---|---|
| M0 · Fundación | P0, P1, Workers Paid y la zona `laboratorio-digital.app` | HC1 + tareas del dueño (§9) | 30 nov 2026 |
| M2 · Panel | P2 | HC3 | 25 ene 2027 |
| M4 · Plan por periodo | P3 | HC4 | 25 ene 2027 |
| M7 · Agentes | P5 | HC6 | 8 mar 2027 |

El panel de la Tienda (M2) entra con Google mientras llega el enlace por correo (HC7). Si un comercio piloto no tiene Google antes de marzo, HU-C10.2 se adelanta: es la palanca del plan.

---

## 6. Épicas

| Épica | Objetivo | Hito | Pts |
|---|---|---|---|
| EC0 · Gobierno del proyecto | Plan, bitácora, convención de commits con guardia y versión propia del CORE | HC0 | 6 |
| EC1 · Producto como dato | Productos, planes, cuentas, dominios y celdas en archivos versionados con esquema | HC0 | 9 |
| EC2 · El producto en la base | La receta probada en D1, la 0006, la copia de los productos a la base y la auditoría | HC1 | 14 |
| EC3 · La API por producto | Entrar, organizaciones, equipo, asignación, pagos, CORS y kill switches con producto | HC1 | 19 |
| EC4 · Tokens v2 y sesión por producto | Las tres fases de los tokens, JWKS y el dominio de la cuenta | HC1–HC3 | 14 |
| EC5 · Planes por periodo | 1, 3, 6 y 12 meses, meses calendario, crédito, gracia y celdas al día | HC4 | 16 |
| EC6 · Sistema de diseño ED1 | `@ed1/ui` v2: tokens, tipografía, componentes, galería, movimiento y presupuestos | HC2 | 17 (+5 preparada) |
| EC7 · Cuenta ED1 | `cuenta.laboratorio-digital.com`: entrar, organizaciones, sesiones, pagos, datos y actividad | HC2, HC5, HC6 | 23 |
| EC8 · Legible por agentes, capa estática | `robots.txt`, `llms.txt`, gemelos, habilidades y su verificación | HC5 | 13 |
| EC9 · OAuth 2.1 y MCP | El CORE como servidor de autorización y el MCP del cuaderno | HC6 | 24 |
| EC10 · Correo | Enlace mágico y avisos por correo | HC7 | 10 |
| EC11 · Operación de la plataforma | Vigía en modo pago, límites, despliegue por producto, copia fuera de Cloudflare y gobierno de la cuenta | HC1–HC7 | 17 |

---

## 7. Historias refinadas

Formato de cada historia:

- **Capa · Prioridad (MoSCoW) · Puntos · Sprint · Depende de · Estado.** Estados: `Refinada`, `En sprint`, `En validación`, `Terminada`, `Preparada`.
- **Como / quiero / para.**
- **Respaldo:** el documento que la decide.
- **Criterios de aceptación** (CA), con al menos uno negativo (❌).
- **Clientes instalados (P10)**, cuando aplica.
- **Consumo y kill switch**, cuando aplica.
- **Patrones en riesgo.**
- **Work items** (WI): `[código]`, `[prueba]`, `[doc]`, `[infra]`, `[diseño]` o `[dueño]`.

### EC0 · Gobierno del proyecto

#### HU-C0.1 · Plan, backlog y bitácora del CORE en el repositorio
- **Capa:** proceso · **Prioridad:** Must · **Puntos:** 1 · **Sprint:** C1 · **Depende de:** — · **Estado:** En validación (rama `docs/core-plan-y-backlog`)
- Como dueño, quiero el plan del CORE y su bitácora en el repositorio, para decidir el orden con el mismo método que el agro y unir después todas las bitácoras.
- **Respaldo:** PLATAFORMA §7; ED1 §3.8 (Git como plano de control); bitácora agro, «Cómo se une con las otras bitácoras».
- **CA1.** Existen `docs/plataforma/BACKLOG_CORE.md` y `docs/plataforma/BITACORA_CORE.md`, y `docs/README.md` los nombra.
- **CA2.** La bitácora usa la ficha extraíble con el proyecto `core`, los patrones P1–P21 sin renumerar y los provisionales `PC<n>`.
- **CA3 ❌.** Ningún hecho del plan contradice PLATAFORMA o ED1 sin decirlo: la contradicción de la copia fuera de Cloudflare se registra (bitácora core 1) y se corrige.
- **Work items:** WI-C0.1.1 `[doc]` backlog · WI-C0.1.2 `[doc]` bitácora · WI-C0.1.3 `[doc]` mapa de `docs/README.md`, fila en `../BACKLOG.md` y CHANGELOG · WI-C0.1.4 `[doc]` corregir la frecuencia de la copia en PLATAFORMA §3.5 y §8.

#### HU-C0.2 · Convención de commits y PR, con su guardia
- **Capa:** CI · **Prioridad:** Must · **Puntos:** 2 · **Sprint:** C1 · **Depende de:** — · **Estado:** Refinada
- Como dueño, quiero que el CI rechace un commit que no siga `tipo(alcance): descripción` o que lleve la marca de Claude Code, para que la historia del repositorio se lea igual siempre sin depender de que alguien se acuerde.
- **Respaldo:** pedido del dueño (5 oct 2026); P18 (una regla escrita sin guardia se incumple: bitácora agro 5).
- **CA1.** `scripts/lib/commits.ts` valida cada commit del PR (`git log origin/main..HEAD`) y el título del PR: tipo de la lista, alcance opcional en minúsculas, descripción de 72 caracteres o menos.
- **CA2.** Rechaza `Co-Authored-By: Claude`, `Claude-Session:` y «Generated with Claude Code» en cualquier commit o en la descripción del PR, y nombra el commit.
- **CA3.** Los commits de fusión de GitHub («Merge pull request #N…») se aceptan.
- **CA4 ❌.** El título del PR llega al script por una variable de entorno, nunca interpolado en el `run:` (guardia de inyección de `scripts/lib/flujos.ts`).
- **Patrones en riesgo:** P5 (la guardia se ve en rojo con un commit malo), P14, P19 (sin falsos positivos con los commits viejos: solo mira el rango del PR).
- **Work items:** WI-C0.2.1 `[código]` validador con su tabla de casos buenos y malos · WI-C0.2.2 `[ci]` paso en `ci.yml` con `fetch-depth: 0` · WI-C0.2.3 `[doc]` plantilla de PR y `ARQUITECTURA.md` §7.1 · WI-C0.2.4 `[prueba]` control negativo: un commit con la marca pone el CI en rojo.

#### HU-C0.3 · Versión propia del CORE (`core-vX.Y.Z`)
- **Capa:** CI y despliegue · **Prioridad:** Must · **Puntos:** 3 · **Sprint:** C2 · **Depende de:** HU-C0.2 · **Estado:** Refinada
- Como dueño, quiero publicar el CORE cuando cambia el CORE, con su versión y su registro de cambios, para no publicar el agro por un cambio de cuenta ni al revés.
- **Respaldo:** PLATAFORMA §6.3; ARQUITECTURA §7.3 (publicación continua).
- **CA1.** `apps/core/package.json` lleva la versión del CORE, y `apps/core/CHANGELOG.md` su sección fechada. `tests/repo/version.test.ts` exige la sección para la versión del CORE igual que para la raíz.
- **CA2.** Al fusionar un PR que sube la versión del CORE, `desplegar.yml` crea `core-vX.Y.Z` con sus notas y publica **solo** el CORE en producción, en la misma corrida (una versión creada con el token de Actions no dispara otros flujos: bitácora agro, «Lo que el terreno enseñó»).
- **CA3 ❌.** Un PR que sube solo la versión de la raíz no publica el CORE, y uno que sube solo la del CORE no publica el sitio ni la celda.
- **CA4.** Las etiquetas `vX.Y.Z` existentes no se tocan.
- **Patrones en riesgo:** P2 (dos versiones: cada una con su fuente), P16 (se corre de punta a punta en staging antes de llamarlo camino normal).
- **Work items:** WI-C0.3.1 `[código]` `scripts/notas-de-version.ts` por producto · WI-C0.3.2 `[ci]` `desplegar.yml` decide qué productos publicar · WI-C0.3.3 `[prueba]` tabla de casos (sube raíz, sube CORE, suben las dos, no sube ninguna) · WI-C0.3.4 `[doc]` ARQUITECTURA §7.1 y §7.3, runbook de despliegue.

### EC1 · Producto como dato

#### HU-C1.1 · `infrastructure/productos.json`, su esquema y su lector
- **Capa:** datos · **Prioridad:** Must · **Puntos:** 3 · **Sprint:** C1 · **Depende de:** — · **Estado:** Refinada
- Como plataforma, quiero que la lista de productos sea un archivo versionado, para que agregar un producto sea un archivo y un despliegue y no una migración.
- **Respaldo:** PLATAFORMA §4.2; ED1 §5.4; R1 de PLATAFORMA §2.
- **CA1.** `schemas/productos.schema.json` valida el archivo en CI (`pnpm validar:productos` crece o se agrega uno nuevo, con el mismo informe de todas las fallas, P15).
- **CA2.** El archivo trae el producto `agro` con sus tipos, roles (con `administra` e `invitable`), su `planes.json`, su política, su prefijo de cobro y `gracia_dias: 0`. La Tienda entra en su M0, no aquí.
- **CA3 ❌.** Se rechazan: un id fuera de `[a-z0-9-]{2,24}`, un producto sin un rol que administre, un `planes` o `politica` que apunta a un archivo inexistente y dos productos con el mismo prefijo de cobro.
- **CA4.** `packages/productos` (`@ed1/productos`) da los tipos y la lectura del archivo. Lo usa el CORE; nadie más lo lee a mano (P2).
- **CA5.** Lo generado hoy (configuraciones de wrangler, `_headers`, tabla `celda`) sale **idéntico byte a byte** (criterio de P0).
- **Patrones en riesgo:** P2, P4 (la prueba también valida un segundo producto de ensayo en un archivo de prueba), P18.
- **Work items:** WI-C1.1.1 `[código]` esquema · WI-C1.1.2 `[código]` `@ed1/productos` · WI-C1.1.3 `[prueba]` casos inválidos uno por uno · WI-C1.1.4 `[prueba]` comparación byte a byte de lo generado · WI-C1.1.5 `[doc]` ARQUITECTURA §5.4.

#### HU-C1.2 · `planes.json` con precio por periodo
- **Capa:** datos · **Prioridad:** Must · **Puntos:** 2 · **Sprint:** C2 · **Depende de:** HU-C1.1 · **Estado:** Refinada
- Como dueño, quiero fijar el precio de 1, 3, 6 y 12 meses de cada plan en el mismo archivo que lee la página de precios, para que el cobro y lo que se muestra no se separen.
- **Respaldo:** PLATAFORMA §4.2 y §4.8; ADR-22; ED1 §5.3.
- **CA1.** Cada plan puede llevar `cobro` con claves de periodo. Un periodo sin monto no se ofrece en ese plan.
- **CA2.** Una prueba exige `cobro["1"] = cobro_mensual_cop` mientras existan los dos campos, montos enteros de al menos COP 1.000 (mínimo de Bold) y que **a más meses, el mes no salga más caro**.
- **CA3 ❌.** Un semestral más caro que seis meses, un periodo que no es 1, 3, 6 ni 12, o un monto con decimales fallan nombrando el plan.
- **CA4.** `planes.test.ts` no cambia: sigue atando el precio visible al estudio de mercado.
- **CA5.** Mientras el dueño no fije los montos de 3, 6 y 12 meses (decisión de PLATAFORMA §9.3), solo existe `"1"`, y nada más se ofrece.
- **Patrones en riesgo:** P2, P18.
- **Work items:** WI-C1.2.1 `[código]` formato y validación · WI-C1.2.2 `[prueba]` reglas con su control negativo · WI-C1.2.3 `[dueño]` montos de 3, 6 y 12 meses.

#### HU-C1.3 · `cuentas.json` y `dominios.json`
- **Capa:** datos · **Prioridad:** Must · **Puntos:** 2 · **Sprint:** C1 · **Depende de:** — · **Estado:** Refinada
- Como dueño, quiero declarada la cuenta de Cloudflare y los nombres reservados de los dominios, para que una celda no apunte a una cuenta que nadie declaró y una tienda no tome un nombre de la plataforma.
- **Respaldo:** PLATAFORMA §3.4 y §3.5; ADR-23 y ADR-27.
- **CA1.** `cuentas.json` declara la cuenta principal (nombre, plan, dueño, contactos de recuperación) y las que quedan fuera. **Sin identificadores de cuenta**: esos siguen en los secretos de GitHub.
- **CA2.** `dominios.json` declara los tres dominios con su papel y los nombres reservados de `laboratorio-digital.app` por motivo (`infraestructura`, `suplantacion`, `proyecto`, `marca`).
- **CA3 ❌.** Una prueba falla si un hostname de `laboratorio-digital.app` aparece en una configuración de Worker del repositorio sin estar declarado, o si `cuentas.json` contiene algo con forma de identificador de cuenta (32 caracteres hexadecimales).
- **Patrones en riesgo:** P2, P13, P18.
- **Work items:** WI-C1.3.1 `[código]` dos esquemas · WI-C1.3.2 `[prueba]` hostnames declarados y sin identificadores · WI-C1.3.3 `[dueño]` contactos de recuperación de la cuenta y de los tres dominios.

#### HU-C1.4 · `celdas.json` v2: producto y cuenta por celda
- **Capa:** datos · **Prioridad:** Must · **Puntos:** 2 · **Sprint:** C2 · **Depende de:** HU-C1.1, HU-C1.3 · **Estado:** Refinada
- Como plataforma, quiero que cada celda diga de qué producto es y en qué cuenta vive, para asignar organizaciones solo a celdas de su producto.
- **Respaldo:** PLATAFORMA §4.9.
- **CA1.** Cada celda declara `producto` (c0 es `agro`) y `cuenta` (una de `cuentas.json`).
- **CA2.** Los shards nuevos se llaman `<producto>_c<N>_s<k>`, y una prueba lo exige. Un shard que ya existe con otro nombre queda como excepción declarada: **los nombres de base no se renombran** (P10).
- **CA3 ❌.** Una celda sin producto, con un producto que no está en `productos.json` o con una cuenta no declarada hace fallar la validación.
- **CA4.** Lo generado sale idéntico byte a byte.
- **Work items:** WI-C1.4.1 `[código]` esquema v2 · WI-C1.4.2 `[prueba]` casos inválidos · WI-C1.4.3 `[prueba]` byte a byte.

### EC2 · El producto en la base

#### HU-C2.1 · La receta de reconstrucción, probada en D1 local
- **Capa:** base · **Prioridad:** Must · **Puntos:** 3 · **Sprint:** C1 · **Depende de:** — · **Estado:** Refinada
- Como plataforma, quiero saber si D1 se comporta como `node:sqlite` al rehacer tablas con claves foráneas, antes de migrar datos reales.
- **Respaldo:** PLATAFORMA §4.4 (falta verificar en D1, P17); R4 y R5; ED1 §20.3 [HA8].
- **CA1.** Una prueba con `getPlatformProxy` corre W1–W4 de PLATAFORMA §4.4 contra el D1 local y anota qué pasó en cada caso.
- **CA2.** Comprueba si D1 acepta `pragma_foreign_key_check` como función de tabla y si apagar `defer_foreign_keys` pone el contador en cero.
- **CA3.** Si D1 no acepta la función de tabla, la guarda pasa a `scripts/desplegar.ts` (correr `PRAGMA foreign_key_check` y detener el despliegue), y se dice en ARQUITECTURA que esa variante es peor.
- **CA4 ❌.** Sin la guarda, W2 (perder una fila padre) tiene que hacer fallar la prueba.
- **Patrones en riesgo:** P17 (el instrumento miente: aquí el instrumento es `node:sqlite`), P9.
- **Work items:** WI-C2.1.1 `[prueba]` W1–W4 en D1 local · WI-C2.1.2 `[doc]` resultado en PLATAFORMA §4.4 y bitácora core · WI-C2.1.3 `[doc]` ADR-25 en ARQUITECTURA.

#### HU-C2.2 · Migración 0006: el producto en la base, compatible con el v0
- **Capa:** base · **Prioridad:** Must · **Puntos:** 5 · **Sprint:** C2 · **Depende de:** HU-C2.1 · **Estado:** Refinada
- Como plataforma, quiero que toda organización, membresía, invitación, sesión, interés y pago pertenezca a un producto, y que la base rechace los cruces imposibles.
- **Respaldo:** PLATAFORMA §4.3; ADR-20; R2 y R3.
- **CA1.** `docs/plataforma/sql/core/0006_dimension_de_producto.sql` pasa a `infrastructure/migraciones/core/`, con la receta y la guarda.
- **CA2.** La matriz de PLATAFORMA §6.4 corre en D1 local: los diez cruces inválidos de §4.3 fallan uno por uno.
- **CA3.** **Compatibilidad v0:** entre la migración y el Worker nuevo, el código de hoy escribe y lee (los `INSERT` reales del v0, con `DEFAULT 'agro'`).
- **CA4.** Antes de aplicarla en producción: exportación de la base y marca de Time Travel anotada en el PR. Se aplica en staging, se valida y después en producción.
- **CA5 ❌.** Un pago viejo de 2 meses (dato que el v0 permitía) detiene la migración entera y deja la base como estaba.
- **Clientes instalados (P10):** ninguno lo nota. Es la fase de expandir.
- **Consumo:** unos pocos miles de filas escritas, menos del 5 % de un día de cuota (PLATAFORMA §4.3).
- **Patrones en riesgo:** P10, P16, P17, P21.
- **Work items:** WI-C2.2.1 `[código]` migración · WI-C2.2.2 `[prueba]` matriz en D1 local · WI-C2.2.3 `[prueba]` compatibilidad v0 · WI-C2.2.4 `[infra]` aplicar en staging · WI-C2.2.5 `[dueño]` validar y aprobar producción · WI-C2.2.6 `[doc]` ADR-20 y ARQUITECTURA §5.4.

#### HU-C2.3 · El despliegue copia `productos.json` a la base
- **Capa:** despliegue · **Prioridad:** Must · **Puntos:** 3 · **Sprint:** C2 · **Depende de:** HU-C1.1, HU-C1.2, HU-C2.2 · **Estado:** Refinada
- Como plataforma, quiero que las tablas `producto`, `producto_tipo`, `producto_rol`, `plan` y `plan_precio` sean siempre el archivo, como hoy `celda` es `celdas.json`.
- **Respaldo:** PLATAFORMA §4.2; P2; P21.
- **CA1.** Tras desplegar, las tablas de referencia coinciden con el archivo, y la prueba de humo lo comprueba consultando la base.
- **CA2.** Un producto o un plan que sale del archivo queda `retirado`; **nunca se borra** (P21).
- **CA3 ❌.** Una fila editada a mano en staging se ve en rojo en la siguiente prueba de humo, con la diferencia nombrada.
- **CA4.** Un precio nuevo entra como fila con `vigente_desde`; el anterior no se edita.
- **Work items:** WI-C2.3.1 `[código]` copia idempotente · WI-C2.3.2 `[prueba]` archivo ↔ base · WI-C2.3.3 `[doc]` runbook de despliegue.

#### HU-C2.4 · Auditoría de lo que toca seguridad o dinero (0008)
- **Capa:** base y API · **Prioridad:** Must · **Puntos:** 3 · **Sprint:** C3 · **Depende de:** HU-C2.2 · **Estado:** Refinada
- Como quien administra un espacio, quiero ver quién entró, quién cambió un rol y qué se pagó, para confiar en lo que pasa en mi organización.
- **Respaldo:** PLATAFORMA §4.12; ED1 §5 (auditoría).
- **CA1.** `auditoria` recibe una fila por hecho: entrada, invitación aceptada, cambio de rol, salida, teléfono retirado, pago cerrado, cambio de plan (y, desde EC9, concesiones a agentes).
- **CA2.** No registra lecturas ni refrescos (presupuesto de escrituras).
- **CA3.** `POST /api/core/auditoria/ver` entrega la auditoría de una organización **solo** a un rol que administra.
- **CA4 ❌.** Un operario recibe 403, y la auditoría de otra organización o de otro producto nunca aparece.
- **Consumo:** una fila y un índice por hecho; con el volumen de hoy, decenas por día.
- **Work items:** WI-C2.4.1 `[código]` 0008 y escrituras en cada flujo · WI-C2.4.2 `[código]` ruta de lectura · WI-C2.4.3 `[prueba]` cada hecho escribe una fila, y ninguna lectura escribe.

### EC3 · La API por producto

#### HU-C3.1 · Entrar con producto
- **Capa:** API · **Prioridad:** Must · **Puntos:** 5 · **Sprint:** C3 · **Depende de:** HU-C2.2, HU-C2.3 · **Estado:** Refinada
- Como persona que usa dos productos, quiero entrar a cada app y que la sesión sea de esa app, para que lo de una no abra la otra.
- **Respaldo:** PLATAFORMA §4.6 (sesión por producto) y §4.7; ED1 §5.2 y §16.
- **CA1.** `GET /api/core/auth/google/inicio` acepta `producto`. Sin él, es `agro` mientras dure la transición.
- **CA2.** La vuelta se valida contra los orígenes y las rutas de vuelta **del producto**. La política que se exige es la del producto, y se guarda en `aceptacion_politica`.
- **CA3.** La sesión nace con su producto; el canje exige el mismo origen.
- **CA4 ❌.** Una vuelta de otro producto, un producto `pausado` o una política de otro producto se rechazan con un motivo que la app puede mostrar.
- **Clientes instalados (P10):** el cuaderno de hoy no manda `producto` y sigue entrando igual. Una prueba lo hace con la solicitud exacta del cuaderno publicado.
- **Patrones en riesgo:** P10, P13, P4.
- **Work items:** WI-C3.1.1 `[código]` `entrar.ts` por producto · WI-C3.1.2 `[código]` política por producto · WI-C3.1.3 `[prueba]` contrato con la solicitud del cuaderno publicado · WI-C3.1.4 `[prueba]` producto de ensayo.

#### HU-C3.2 · Organizaciones, invitaciones y equipo por producto
- **Capa:** API · **Prioridad:** Must · **Puntos:** 3 · **Sprint:** C3 · **Depende de:** HU-C3.1 · **Estado:** Refinada
- Como quien administra, quiero que invitar, cambiar roles y quitar personas use los roles de mi producto, para que la tienda tenga sus roles y el agro los suyos.
- **Respaldo:** PLATAFORMA §4.7; R2 y R3.
- **CA1.** El producto de una organización nueva sale de la sesión, **nunca del cuerpo** de la solicitud. El tipo se valida contra `producto_tipo`.
- **CA2.** Invitar ofrece solo roles `invitable` del producto. El enlace lleva a la pantalla «unirme» de la app del producto, con el código en el fragmento (P13).
- **CA3.** «Propietario» deja de estar escrito en el código: puede administrar quien tenga un rol con `administra`.
- **CA4 ❌.** Un cuerpo con `producto: "tienda"` desde una sesión del agro no crea nada fuera del agro; un rol del agro en una organización de ensayo lo rechaza la base.
- **Work items:** WI-C3.2.1 `[código]` organizaciones · WI-C3.2.2 `[código]` invitaciones y equipo con `administra` · WI-C3.2.3 `[prueba]` cruces rechazados por la API y por la base.

#### HU-C3.3 · Asignación de celda por producto
- **Capa:** API · **Prioridad:** Must · **Puntos:** 2 · **Sprint:** C3 · **Depende de:** HU-C1.4, HU-C3.2 · **Estado:** Refinada
- Como plataforma, quiero que una organización nueva vaya a una celda de su producto, con los pilotos contados por producto.
- **Respaldo:** PLATAFORMA §4.9.
- **CA1.** `asignarUbicacion` recibe el producto y elige entre las celdas activas de ese producto, con las reglas de hoy.
- **CA2.** Las 5 primeras organizaciones **de cada producto** son pilotos (`anillo: 1`).
- **CA3 ❌.** Sin celda activa del producto, la creación falla con «no hay dónde alojar este espacio todavía», y no cae en una celda de otro producto.
- **Work items:** WI-C3.3.1 `[código]` · WI-C3.3.2 `[prueba]` dos productos, pilotos separados.

#### HU-C3.4 · Interés y pagos con el plan del producto
- **Capa:** API · **Prioridad:** Must · **Puntos:** 2 · **Sprint:** C4 · **Depende de:** HU-C3.2 · **Estado:** Refinada
- Como quien administra, quiero que el interés en un plan y el pago usen los planes de mi producto, con su prefijo y su pantalla de vuelta.
- **Respaldo:** PLATAFORMA §4.7.
- **CA1.** `interes` y `pago/crear` leen los planes del producto de la organización; la referencia lleva el prefijo del producto y la vuelta es una ruta del producto. Sigue siendo un mes (los periodos llegan en HU-C5.3).
- **CA2 ❌.** Un plan de otro producto se rechaza en la API y en la base.
- **Work items:** WI-C3.4.1 `[código]` · WI-C3.4.2 `[prueba]` con el producto de ensayo.

#### HU-C3.5 · CORS y origen por producto
- **Capa:** API y seguridad · **Prioridad:** Must · **Puntos:** 2 · **Sprint:** C4 · **Depende de:** HU-C3.1 · **Estado:** Refinada
- Como plataforma, quiero que cada ruta acepte solo el origen del producto de la sesión o del token, para que una app no use el CORE en nombre de otra.
- **Respaldo:** PLATAFORMA §4.7 (CORS).
- **CA1.** `ORIGENES_APP` es la unión de los orígenes de todos los productos, generada de `productos.json` y `celdas.json` (P2).
- **CA2 ❌.** Una solicitud con una sesión del agro desde el origen de otro producto recibe 403, aunque el origen esté en la unión.
- **Work items:** WI-C3.5.1 `[código]` · WI-C3.5.2 `[prueba]` matriz origen × producto.

#### HU-C3.6 · Kill switches del CORE por producto
- **Capa:** operación · **Prioridad:** Must · **Puntos:** 2 · **Sprint:** C2 · **Depende de:** HU-C1.1 · **Estado:** Refinada
- Como dueño, quiero apagar la entrada, la renovación o los pagos de un solo producto, para que un problema en la tienda no apague el agro.
- **Respaldo:** PLATAFORMA §4.10; ED1 §3.9 y §25.1.
- **CA1.** `ks:core` apaga todo el CORE, `ks:core:<producto>` lo de un producto y `ks:core:pagos` los cobros de todos. Durante la transición, `ks:agro-core` sigue valiendo: cualquiera de las dos en `apagado` apaga.
- **CA2.** El tiempo máximo hasta que un cambio se nota es el de la caché (60 s), dicho en el runbook (P7).
- **CA3 ❌.** Apagar `ks:core:agro` no afecta al producto de ensayo, y viceversa.
- **Work items:** WI-C3.6.1 `[código]` · WI-C3.6.2 `[prueba]` · WI-C3.6.3 `[doc]` `docs/runbooks/kill-switch.md`.

#### HU-C3.7 · Staging con dos productos
- **Capa:** prueba de aceptación · **Prioridad:** Must · **Puntos:** 3 · **Sprint:** C4 · **Depende de:** HU-C3.1 a HU-C3.6 · **Estado:** Refinada
- Como dueño, quiero ver en staging dos productos funcionando a la vez, para aceptar la fase P1 sin esperar a la Tienda.
- **Respaldo:** PLATAFORMA §7 (criterio de P1); P4 y P11.
- **CA1.** Un producto de ensayo (`ensayo`, con un tipo, dos roles, dos planes y una celda) se siembra **solo** en D1 local y en staging, como las fincas de prueba.
- **CA2.** Una e2e entra al agro y al producto de ensayo con la misma persona y comprueba que cada sesión ve solo lo suyo.
- **CA3 ❌.** El producto de ensayo no existe en producción: una prueba de humo de producción falla si aparece.
- **CA4.** En producción, el agro funciona igual para quien lo usa: la batería e2e del cuaderno pasa sin cambios.
- **Work items:** WI-C3.7.1 `[código]` siembra de staging · WI-C3.7.2 `[prueba]` e2e de dos productos · WI-C3.7.3 `[dueño]` validación de P1 en staging.

### EC4 · Tokens v2 y sesión por producto

#### HU-C4.1 · Tokens N: las celdas verifican v1 y v2
- **Capa:** tokens · **Prioridad:** Must · **Puntos:** 3 · **Sprint:** C4 · **Depende de:** — · **Estado:** Refinada
- Como plataforma, quiero que todas las celdas acepten los dos formatos antes de que el CORE emita el nuevo, para que ningún cuaderno instalado quede fuera.
- **Respaldo:** PLATAFORMA §4.6 (fase N); ADR-10.
- **CA1.** `packages/tokens` acepta `iss` ∈ {`agro-core`, `ed1-core`}. Un token sin `aud` lo acepta **solo** una celda del agro. Sin `plan`, el plan es `gratuito`.
- **CA2.** Una prueba de contrato firma tokens v1 y v2 y exige lo que acepta cada celda.
- **CA3 ❌.** Un token con `aud` de otro producto se rechaza; uno sin `aud` en una celda que no es del agro, también.
- **Patrones en riesgo:** P10, P17 (la prueba firma de verdad con Ed25519; no hay doble).
- **Work items:** WI-C4.1.1 `[código]` · WI-C4.1.2 `[prueba]` contrato v1/v2 · WI-C4.1.3 `[infra]` desplegar en todas las celdas antes de HU-C4.3.

#### HU-C4.2 · JWKS estándar
- **Capa:** tokens · **Prioridad:** Should · **Puntos:** 1 · **Sprint:** C4 · **Depende de:** — · **Estado:** Refinada
- Como verificador que no es nuestro, quiero las llaves del CORE en el formato estándar.
- **Respaldo:** PLATAFORMA §4.6 (JWKS); RFC 7517 y RFC 8037.
- **CA1.** `GET /.well-known/jwks.json` publica la llave vigente y la anterior como JWK `OKP`/`Ed25519`, con su `kid`.
- **CA2 ❌.** Nunca aparece la parte privada: la prueba busca el campo `d`.
- **Work items:** WI-C4.2.1 `[código]` · WI-C4.2.2 `[prueba]`.

#### HU-C4.3 · Tokens N+1: el CORE emite v2
- **Capa:** tokens · **Prioridad:** Must · **Puntos:** 3 · **Sprint:** C5 · **Depende de:** HU-C4.1 desplegada en todas las celdas, HU-C3.1 · **Estado:** Refinada
- Como app de un producto, quiero tokens con `aud`, `plan`, `plan_vence`, `auth_time` y `ver`, para aplicar mis límites sin llamar al CORE.
- **Respaldo:** PLATAFORMA §4.6.
- **CA1.** El CORE emite `iss = ed1-core`, `aud` = producto de la organización, `plan` y `plan_vence` con la gracia aplicada, `auth_time` de la última entrada interactiva y `ver = 2`.
- **CA2.** Los v1 ya emitidos valen hasta su `exp`.
- **CA3 ❌.** Renovar no cambia `auth_time`: solo una entrada con Google o con correo lo hace.
- **Work items:** WI-C4.3.1 `[código]` · WI-C4.3.2 `[prueba]` · WI-C4.3.3 `[doc]` ARQUITECTURA §5.4.

#### HU-C4.4 · Refresh por producto
- **Capa:** sesión · **Prioridad:** Must · **Puntos:** 2 · **Sprint:** C5 · **Depende de:** HU-C3.1 · **Estado:** Refinada
- Como persona, quiero que un refresh robado de una app no saque tokens de otra.
- **Respaldo:** PLATAFORMA §4.6 (sesión por producto); bitácora agro 25 (cuenta en dos fincas).
- **CA1.** `POST /api/core/auth/refrescar` exige un `Origin` del producto de la sesión y solo entrega tokens de organizaciones de ese producto.
- **CA2 ❌.** El refresh del producto de ensayo, presentado desde el origen del agro, recibe 403 y queda en la auditoría.
- **CA3.** Con dos organizaciones del mismo producto, el refresh pide la organización y no entrega un token sin ella (bitácora agro 25).
- **Work items:** WI-C4.4.1 `[código]` · WI-C4.4.2 `[prueba]`.

#### HU-C4.5 · Tokens N+2: las celdas rechazan v1
- **Capa:** tokens · **Prioridad:** Must · **Puntos:** 2 · **Sprint:** C7 · **Depende de:** HU-C4.3 en producción, el congelamiento terminado · **Estado:** Refinada
- Como plataforma, quiero cerrar la transición, para que el formato viejo no sea una puerta abierta.
- **Respaldo:** PLATAFORMA §4.6 (fase N+2).
- **CA1.** Al menos 12 h después de N+1 en producción (en el plan, más de un mes), las celdas rechazan v1.
- **CA2.** Antes de contraer, un registro de una semana muestra cero tokens v1 aceptados.
- **CA3 ❌.** La prueba de contrato firma un v1 y exige el rechazo, con un motivo que el cuaderno sabe mostrar («vuelve a entrar»), no un error genérico (P15).
- **Clientes instalados (P10):** un cuaderno viejo con su token v1 vencido renueva y recibe v2; uno con el token v1 vigente vuelve a entrar.
- **Work items:** WI-C4.5.1 `[código]` · WI-C4.5.2 `[prueba]` · WI-C4.5.3 `[dueño]` aprobar la contracción con el registro de la semana.

#### HU-C4.6 · `cuenta.laboratorio-digital.com`
- **Capa:** infraestructura · **Prioridad:** Must · **Puntos:** 3 · **Sprint:** C5 · **Depende de:** HU-C1.3 · **Estado:** Refinada
- Como persona, quiero entrar al ecosistema por una dirección que diga de quién es.
- **Respaldo:** PLATAFORMA §3.3 y §3.6; ADR-27; bitácora agro 19 (dominio en el Worker equivocado).
- **CA1.** El Worker del CORE de producción tiene el Workers Custom Domain `cuenta.laboratorio-digital.com`, declarado en `celdas.json` y generado (no puesto a mano en el panel).
- **CA2.** La URL de workers.dev sigue viva: los cuadernos instalados la usan (P10).
- **CA3.** Google acepta las dos URL de vuelta.
- **CA4 ❌.** Una prueba falla si el Worker de staging declara el dominio de producción.
- **Work items:** WI-C4.6.1 `[infra]` dominio generado · WI-C4.6.2 `[prueba]` · WI-C4.6.3 `[dueño]` URL de vuelta en la consola de Google, con los pasos exactos.

### EC5 · Planes por periodo

#### HU-C5.1 · Meses calendario en Bogotá
- **Capa:** lógica · **Prioridad:** Must · **Puntos:** 2 · **Sprint:** C6 · **Depende de:** — · **Estado:** Refinada
- Como persona que paga 12 meses, quiero que me cuenten 12 meses, no 360 días.
- **Respaldo:** PLATAFORMA §4.8 (2); P8; bitácora ecommerce, patrón 8 («los meses se restan con `getMonth()`»).
- **CA1.** `sumarMeses(desde, n)` suma meses en la fecha de Bogotá (UTC−5 fijo) y conserva la hora; si el día no existe, recorta al último del mes.
- **CA2.** Casos: 31 de enero + 1; 29 de febrero de 2028 + 12 = 28 de febrero de 2029; un pago a las 18:59 y otro a las 19:01 de Bogotá.
- **CA3.** La batería corre también con `TZ=Pacific/Kiritimati`.
- **CA4 ❌.** Volver a 30 días por mes pone la batería en rojo.
- **Work items:** WI-C5.1.1 `[código]` · WI-C5.1.2 `[prueba]` batería del reloj.

#### HU-C5.2 · Precios por periodo en la base
- **Capa:** datos · **Prioridad:** Must · **Puntos:** 2 · **Sprint:** C6 · **Depende de:** HU-C1.2, HU-C2.3 · **Estado:** Refinada
- Como plataforma, quiero que `plan_precio` tenga el precio vigente de cada plan y periodo, con su historia.
- **Respaldo:** PLATAFORMA §4.3 (`periodo`, `plan_precio`); ADR-22.
- **CA1.** El despliegue copia `cobro` a `plan_precio` con `vigente_desde`; un cambio de precio es una fila nueva.
- **CA2 ❌.** Un periodo que no está en `periodo` lo rechaza la base.
- **Work items:** WI-C5.2.1 `[código]` · WI-C5.2.2 `[prueba]`.

#### HU-C5.3 · Pagar 1, 3, 6 o 12 meses
- **Capa:** pagos · **Prioridad:** Must · **Puntos:** 3 · **Sprint:** C7 · **Depende de:** HU-C5.1, HU-C5.2, HU-C3.4 · **Estado:** Refinada
- Como quien administra, quiero pagar varios meses de una vez, para pagar menos comisión y olvidarme del pago por un tiempo.
- **Respaldo:** PLATAFORMA §4.8 (1, 3 y 6); ED1 §5.3; estudio de ecommerce §13.4 (sin débito automático).
- **CA1.** `POST /api/core/pago/crear` acepta `meses`: un periodo con precio vigente para ese plan. El monto sale de `plan_precio`, nunca del cliente.
- **CA2.** Al aprobarse, el plan cuenta desde el vencimiento vigente si es del mismo plan y aún no llegó, o desde ahora, y se escriben `periodo_desde` y `periodo_hasta`.
- **CA3.** La conciliación por cron sigue igual: solo «aprobado» con el monto exacto activa, una vez.
- **CA4 ❌.** Un periodo sin precio para ese plan, o un monto alterado en la vuelta, no activan nada y quedan en «revisar».
- **CA5.** **Aceptación de HC4:** un pago de 6 meses en el ambiente de pruebas de Bold, hecho por el dueño en staging.
- **Work items:** WI-C5.3.1 `[código]` · WI-C5.3.2 `[prueba]` · WI-C5.3.3 `[dueño]` pago de prueba de 6 meses · WI-C5.3.4 `[doc]` `docs/runbooks/pagos-bold.md`.

#### HU-C5.4 · Cambiar de plan convierte lo que quedaba en días
- **Capa:** pagos · **Prioridad:** Should · **Puntos:** 2 · **Sprint:** C7 · **Depende de:** HU-C5.3 · **Estado:** Refinada
- Como quien sube de plan, quiero que no se pierda lo que ya pagué.
- **Respaldo:** PLATAFORMA §4.8 (4).
- **CA1.** `credito = ⌊días_restantes × precio_mensual(viejo) / precio_mensual(nuevo)⌋`; el vencimiento nuevo es `sumarMeses(ahora, meses) + credito`.
- **CA2.** El ejemplo de PLATAFORMA (40 días de Finca a Exportador = 10 días) es un caso de la prueba.
- **CA3 ❌.** Desde el plan gratuito, el crédito es cero; nada se devuelve en dinero.
- **Work items:** WI-C5.4.1 `[código]` · WI-C5.4.2 `[prueba]`.

#### HU-C5.5 · Gracia por producto y avisos de vencimiento
- **Capa:** planes · **Prioridad:** Must · **Puntos:** 2 · **Sprint:** C7 · **Depende de:** HU-C4.3, HU-C5.3 · **Estado:** Refinada
- Como comercio, quiero unos días de gracia si olvido pagar, para no dejar de vender de un día para otro.
- **Respaldo:** PLATAFORMA §4.8 (5).
- **CA1.** `gracia_dias` del producto (0 en el agro): durante la gracia, el token lleva el plan pagado y la app recibe la marca para avisar.
- **CA2.** Avisos a 7 días y a 1 día del vencimiento, en la app; por correo cuando exista (HU-C10.3). Los dispara el cron que el CORE ya tiene, no uno nuevo.
- **CA3 ❌.** Pasada la gracia, el directorio entrega el plan gratuito sin tocar un dato.
- **Work items:** WI-C5.5.1 `[código]` · WI-C5.5.2 `[prueba]` con el reloj movido.

#### HU-C5.6 · Celdas al día con los planes
- **Capa:** CORE ↔ celdas · **Prioridad:** Must · **Puntos:** 3 · **Sprint:** C7 · **Depende de:** HU-C5.3 · **Estado:** Refinada
- Como celda, quiero enterarme de un pago o un vencimiento aunque nadie haya entrado a la app.
- **Respaldo:** PLATAFORMA §4.13; ADR-10.
- **CA1.** Una vez al día, cada celda pide `POST /api/core/servicio/planes` con su `CELDA_SERVICE_TOKEN` (comparado en tiempo constante) y recibe el plan de sus organizaciones.
- **CA2.** Al aprobar un pago, el CORE avisa a la celda; si el aviso se pierde, la sincronización diaria lo corrige.
- **CA3 ❌.** Si el CORE no responde, la celda conserva la copia anterior y avisa por Telegram (P1, P15). **El plan nunca baja «por si acaso».**
- **CA4.** Ninguna solicitud de un usuario hace que una celda llame al CORE.
- **Work items:** WI-C5.6.1 `[código]` ruta de servicio · WI-C5.6.2 `[código]` cron de la celda · WI-C5.6.3 `[prueba]` falla del CORE simulada.

#### HU-C5.7 · La pantalla de planes del cuaderno con los cuatro periodos
- **Capa:** app del agro · **Prioridad:** Should · **Puntos:** 2 · **Sprint:** C7 · **Depende de:** HU-C5.3 · **Estado:** Refinada
- Como productor, quiero elegir cuántos meses pagar y ver cuánto ahorro.
- **Respaldo:** PLATAFORMA §7 (P3); estudio del agro (precios visibles).
- **CA1.** Planes ofrece los periodos con precio, con el total y el valor por mes.
- **CA2.** El aviso del pago queda en la vista del botón (bitácora agro, «un aviso fuera de la vista»).
- **CA3 ❌.** Un periodo sin precio no aparece; nunca se muestra «COP 0».
- **Work items:** WI-C5.7.1 `[código]` · WI-C5.7.2 `[prueba]` e2e en 360 px.

### EC6 · Sistema de diseño ED1

#### HU-C6.1 · Tokens v2 en tres capas, claro y oscuro
- **Capa:** diseño · **Prioridad:** Must · **Puntos:** 3 · **Sprint:** C1 · **Depende de:** — · **Estado:** Refinada
- Como plataforma, quiero una sola fuente de color, tipo, espacio y movimiento para todas las apps, con un tema por producto.
- **Respaldo:** §4.3 de este documento; ED1 §1 (una identidad de marca) y §3.5; P2.
- **CA1.** `@ed1/ui/v2` con primitivos, semánticos y temas `ecosistema` y `cultivopro`. La v1 queda intacta.
- **CA2.** Una prueba calcula el contraste de cada pareja texto/superficie en claro y en oscuro y exige 4,5:1.
- **CA3 ❌.** Un color escrito a mano en un componente (fuera de los tokens) lo atrapa una regla de lint del CSS.
- **Work items:** WI-C6.1.1 `[diseño]` paleta y escala · WI-C6.1.2 `[código]` hojas · WI-C6.1.3 `[prueba]` contraste · WI-C6.1.4 `[prueba]` lint de colores sueltos.

#### HU-C6.2 · Tipografía autoalojada
- **Capa:** diseño · **Prioridad:** Should · **Puntos:** 2 · **Sprint:** C2 · **Depende de:** HU-C6.1, decisión D-C1 · **Estado:** Refinada
- Como persona, quiero que la cuenta se vea con carácter y cargue igual de rápido.
- **Respaldo:** §4.4 de este documento.
- **CA1.** Geist y Geist Mono en `woff2`, recortadas, con su licencia OFL en el paquete y una prueba que exige el archivo de licencia junto a cada fuente.
- **CA2.** Métricas de respaldo con `size-adjust`; la display se precarga.
- **CA3 ❌.** Una fuente de más de 35 KB, o una solicitud a un dominio de fuentes de terceros, pone la prueba en rojo.
- **Work items:** WI-C6.2.1 `[código]` recorte y `@font-face` · WI-C6.2.2 `[prueba]` peso y licencia · WI-C6.2.3 `[dueño]` decisión D-C1.

#### HU-C6.3 · Componentes base
- **Capa:** diseño · **Prioridad:** Must · **Puntos:** 5 · **Sprint:** C3 · **Depende de:** HU-C6.1 · **Estado:** Refinada
- Como app del ecosistema, quiero componentes con todos sus estados resueltos, para no reinventar el error, el vacío ni la confirmación.
- **Respaldo:** §4.5 de este documento; bitácora agro 16 y 17.
- **CA1.** Los componentes de §4.5 como componentes de Astro con su CSS, sin JavaScript salvo el menú del teléfono si `<details>` no alcanza.
- **CA2.** Cada componente con sus estados: normal, foco, ocupado, deshabilitado con motivo, error; y las listas con cargando, vacío y error.
- **CA3 ❌.** Un estado «vacío» no se puede mostrar mientras se carga: el componente no lo permite.
- **Work items:** WI-C6.3.1 `[diseño]` · WI-C6.3.2 `[código]` · WI-C6.3.3 `[prueba]` estados.

#### HU-C6.4 · Galería viva y control visual
- **Capa:** diseño y prueba · **Prioridad:** Must · **Puntos:** 3 · **Sprint:** C5 · **Depende de:** HU-C6.3 · **Estado:** Refinada
- Como dueño, quiero ver todos los componentes en una página y saber cuándo uno cambió sin querer.
- **Respaldo:** P5, P20.
- **CA1.** `/_galeria/` en la cuenta, con `noindex`, todos los componentes y estados en claro y oscuro.
- **CA2.** axe sin violaciones y capturas de 360 y 1280 px comparadas en CI. Las capturas se toman solo en Linux, porque Windows dibuja las fuentes distinto (P3).
- **CA3 ❌.** Cambiar el radio de un botón pone la comparación en rojo con la diferencia a la vista.
- **Work items:** WI-C6.4.1 `[código]` galería · WI-C6.4.2 `[prueba]` axe y capturas.

#### HU-C6.5 · Movimiento con propósito, sin JavaScript
- **Capa:** diseño · **Prioridad:** Could · **Puntos:** 2 · **Sprint:** C6 · **Depende de:** HU-C6.3 · **Estado:** Refinada
- Como persona, quiero que la página se sienta viva sin que tarde ni maree.
- **Respaldo:** §4.2 de este documento (el revelado de Coda Press).
- **CA1.** Revelado al desplazar con `animation-timeline: view()` dentro de `@supports`, y transiciones de 150 a 400 ms.
- **CA2.** Con `prefers-reduced-motion`, nada se mueve.
- **CA3 ❌.** En un navegador sin `animation-timeline`, todo el texto se ve desde el principio: una e2e lo comprueba desactivando la función.
- **Work items:** WI-C6.5.1 `[código]` · WI-C6.5.2 `[prueba]`.

#### HU-C6.6 · Presupuestos y CSP en el CI
- **Capa:** CI · **Prioridad:** Must · **Puntos:** 2 · **Sprint:** C6 · **Depende de:** HU-C6.4, HU-C7.2 · **Estado:** Refinada
- Como dueño, quiero que el CI rechace una pantalla que se pase de peso o que necesite `'unsafe-inline'`.
- **Respaldo:** §4.7 de este documento; ED1 §23.2; bitácora agro 14 y 20.
- **CA1.** Los topes de §4.7 en las pruebas de la cuenta; las de tiempo en el proyecto `@rendimiento`.
- **CA2 ❌.** Un `<style>` en línea o un script de un tercero hacen fallar la prueba de CSP.
- **Work items:** WI-C6.6.1 `[prueba]` · WI-C6.6.2 `[ci]` Lighthouse CI para la cuenta.

### EC7 · Cuenta ED1

#### HU-C7.1 · La cuenta como app de primera parte (decisión de arquitectura)
- **Capa:** arquitectura · **Prioridad:** Must · **Puntos:** 2 · **Sprint:** C1 · **Depende de:** — · **Estado:** Refinada
- Como plataforma, quiero decidir cómo entra una persona a su cuenta sin organización, sin romper la regla de que toda sesión tiene producto (R2).
- **Respaldo:** ED1 §16 (la cuenta en `cuenta.laboratorio-digital.com`); PLATAFORMA §4.1 y §4.6. **Ningún documento decide esto todavía.**
- **CA1.** Un ADR propuesto compara: (a) un producto `cuenta` en `productos.json`, sin tipos ni planes, con sesión propia y tokens `aud = cuenta` que solo abren `/api/core/cuenta/*`; (b) la cuenta sin token, con cookie de sesión del CORE en su propio origen.
- **CA2.** El ADR trae el modelo de amenazas: qué puede hacer un token de la cuenta robado y qué no (nunca entrar a una celda).
- **CA3 ❌.** La opción elegida no abre ninguna celda: lo comprueba una prueba de contrato en HU-C7.3.
- **Recomendación:** (a), porque reusa la sesión por producto y no agrega un segundo mecanismo (P2). Decisión D-C2.
- **Work items:** WI-C7.1.1 `[doc]` ADR-28 propuesto · WI-C7.1.2 `[dueño]` decisión.

#### HU-C7.2 · `apps/cuenta`: el esqueleto estático
- **Capa:** app · **Prioridad:** Must · **Puntos:** 3 · **Sprint:** C5 · **Depende de:** HU-C4.6, HU-C6.3 · **Estado:** Refinada
- Como persona, quiero que la cuenta abra rápido en mi teléfono y se vea como el resto del ecosistema.
- **Respaldo:** ED1 §3.10 y §16; §4 de este documento.
- **CA1.** Astro estático con `@ed1/ui` v2, servido como assets del Worker del CORE. El Worker corre primero **solo** en `/api/core/*`, `/oauth/*` y `/.well-known/*`.
- **CA2.** CSP `'self'`, `robots.txt` con `Disallow: /` y páginas de error editoriales.
- **CA3 ❌.** Una prueba falla si alguna página pública pasa por el Worker (`run_worker_first` fuera de esas rutas).
- **Work items:** WI-C7.2.1 `[código]` app · WI-C7.2.2 `[código]` generación de su configuración · WI-C7.2.3 `[prueba]` rutas estáticas · WI-C7.2.4 `[doc]` ARQUITECTURA §5.

#### HU-C7.3 · Entrar a la cuenta y salir
- **Capa:** app y API · **Prioridad:** Must · **Puntos:** 3 · **Sprint:** C5 · **Depende de:** HU-C7.1, HU-C7.2, HU-C3.1 · **Estado:** Refinada
- Como persona, quiero entrar con Google a mi cuenta, y salir cuando quiera.
- **Respaldo:** ED1 §5.2 y §16.
- **CA1.** «Entrar con Google» pide aceptar la política vigente (como el cuaderno) y vuelve a la cuenta.
- **CA2.** Si viene de una app (`?vuelve=`), la pantalla dice a cuál vuelve, y la vuelta se valida contra los orígenes declarados.
- **CA3.** «Salir» cierra la sesión de la cuenta en el CORE, no solo en el navegador.
- **CA4 ❌.** Un token de la cuenta presentado a una celda se rechaza (prueba de contrato).
- **Work items:** WI-C7.3.1 `[código]` · WI-C7.3.2 `[prueba]` e2e · WI-C7.3.3 `[dueño]` textos.

#### HU-C7.4 · Mis espacios en todos los productos
- **Capa:** app y API · **Prioridad:** Must · **Puntos:** 3 · **Sprint:** C6 · **Depende de:** HU-C7.3 · **Estado:** Refinada
- Como persona que tiene una finca y colabora en una tienda, quiero verlas juntas y abrir cada una con un toque.
- **Respaldo:** ED1 §16 («qué ve cada persona sale de la membresía y del plan»).
- **CA1.** Inicio muestra una tarjeta por organización: producto, nombre, rol, plan y vencimiento, y el botón que abre la app del producto.
- **CA2.** Estados: cargando, sin espacios (con qué hacer) y error con su causa.
- **CA3 ❌.** Nunca aparece una organización donde la persona no tiene membresía vigente.
- **Work items:** WI-C7.4.1 `[código]` `POST /api/core/cuenta/espacios` · WI-C7.4.2 `[código]` pantalla · WI-C7.4.3 `[prueba]` e2e con dos productos.

#### HU-C7.5 · Dónde has entrado
- **Capa:** app y API · **Prioridad:** Must · **Puntos:** 3 · **Sprint:** C8 · **Depende de:** HU-C7.4, HU-C4.4 · **Estado:** Refinada
- Como persona que perdió el teléfono, quiero cerrar la sesión de ese teléfono desde otro dispositivo.
- **Respaldo:** ED1 §16; owner-first (ED1 §3.7).
- **CA1.** Lista de sesiones por producto, con el dispositivo declarado y el último uso.
- **CA2.** «Cerrar» y «Cerrar todas menos esta» piden una entrada de menos de 10 minutos (`auth_time`) y quedan en la auditoría.
- **CA3 ❌.** Cerrar una sesión invalida su refresh: un refresco posterior con él recibe 401.
- **Work items:** WI-C7.5.1 `[código]` · WI-C7.5.2 `[prueba]`.

#### HU-C7.6 · Mis pagos
- **Capa:** app y API · **Prioridad:** Should · **Puntos:** 2 · **Sprint:** C8 · **Depende de:** HU-C5.3, HU-C7.4 · **Estado:** Refinada
- Como quien administra, quiero ver qué pagué, por cuánto tiempo y cuándo vence.
- **Respaldo:** PLATAFORMA §4.8 (7: `periodo_desde` y `periodo_hasta`).
- **CA1.** Lista de pagos de los espacios que administro: plan, periodo cubierto, monto en mono y estado.
- **CA2 ❌.** Un rol que no administra no ve los pagos.
- **Work items:** WI-C7.6.1 `[código]` · WI-C7.6.2 `[prueba]`.

#### HU-C7.7 · Tus datos (Ley 1581)
- **Capa:** app, API y cumplimiento · **Prioridad:** Must · **Puntos:** 5 · **Sprint:** C10 · **Depende de:** HU-C7.4 · **Estado:** Refinada
- Como titular de mis datos, quiero descargarlos y radicar una consulta, un reclamo o una supresión, y saber cuándo me responden.
- **Respaldo:** ED1 §20.1 [D5] (cada obligación legal, un control técnico); política de datos de cada producto.
- **CA1.** «Descargar mis datos» entrega un JSON con lo que el CORE guarda de la persona (usuario, identidades, membresías, aceptaciones, sesiones y pagos de lo que administra).
- **CA2.** Consulta, reclamo y supresión se radican con número y fecha límite en días hábiles de Colombia (con los festivos), y le llegan al dueño por Telegram.
- **CA3.** La supresión no borra en el acto: lo que la ley obliga a conservar (pagos) se conserva, y la respuesta lo explica.
- **CA4 ❌.** Nunca se descargan datos de otra persona, ni con el id en el cuerpo.
- **Pendiente:** los datos del responsable del tratamiento, que da el dueño (memoria «datos legales pendientes»).
- **Work items:** WI-C7.7.1 `[código]` exportación · WI-C7.7.2 `[código]` radicados y plazos · WI-C7.7.3 `[prueba]` días hábiles con festivos · WI-C7.7.4 `[dueño]` responsable y canal.

#### HU-C7.8 · La actividad de mi espacio
- **Capa:** app · **Prioridad:** Should · **Puntos:** 2 · **Sprint:** C8 · **Depende de:** HU-C2.4, HU-C7.4 · **Estado:** Refinada
- Como quien administra, quiero ver en palabras lo que pasó en mi espacio.
- **Respaldo:** PLATAFORMA §4.12.
- **CA1.** La auditoría en frases («Ana cambió a Luis de operario a supervisor»), con fecha y hora de Bogotá.
- **CA2 ❌.** Solo quien administra la ve.
- **Work items:** WI-C7.8.1 `[código]` · WI-C7.8.2 `[prueba]`.

### EC8 · Legible por agentes, capa estática

#### HU-C8.1 · Agentes y señales en `robots.txt`
- **Capa:** sitio del agro · **Prioridad:** Should · **Puntos:** 2 · **Sprint:** C8 · **Depende de:** decisión `ai-train` (PLATAFORMA §9.2) · **Estado:** Refinada
- Como dueño, quiero decir qué agentes pueden leer y para qué.
- **Respaldo:** PLATAFORMA §5.3 (1); ED1 §3.12.
- **CA1.** `content/agentes.json` lista las familias; el `robots.txt` generado las aplica y cierra `/api/` y `/agro/app/` para todos, con `Content-Signal` al final.
- **CA2 ❌.** Una prueba compara el `robots.txt` generado con la lista; editar el archivo generado a mano la pone en rojo.
- **Work items:** WI-C8.1.1 `[código]` · WI-C8.1.2 `[prueba]` · WI-C8.1.3 `[dueño]` decisión `ai-train`.

#### HU-C8.2 · `llms.txt` y gemelos en Markdown
- **Capa:** sitio del agro · **Prioridad:** Should · **Puntos:** 3 · **Sprint:** C8 · **Depende de:** — · **Estado:** Refinada
- Como agente, quiero leer el sitio sin ejecutar JavaScript.
- **Respaldo:** PLATAFORMA §5.3 (2–4).
- **CA1.** `/llms.txt` y un `index.md` junto a cada página pública, anunciados con `<link rel="alternate">` y la cabecera `Link`.
- **CA2.** Spike de 1 h: si las reglas de reescritura de la zona gratuita negocian `Accept: text/markdown`; si no, se acepta la opción b de PLATAFORMA §5.3 y se anota.
- **CA3 ❌.** Un enlace de `llms.txt` que no existe en el build hace fallar la prueba.
- **Work items:** WI-C8.2.1 `[código]` · WI-C8.2.2 `[prueba]` · WI-C8.2.3 `[infra]` spike de la reescritura.

#### HU-C8.3 · Las calculadoras como habilidades
- **Capa:** sitio del agro · **Prioridad:** Should · **Puntos:** 3 · **Sprint:** C8 · **Depende de:** HU-C8.2 · **Estado:** Refinada
- Como agente de un productor, quiero la fórmula, los rangos y las fuentes de la DPV y de la carencia, para calcular sin el navegador.
- **Respaldo:** PLATAFORMA §5.3 (5); ED1 §3.12 (browser-first del lado del agente).
- **CA1.** `/.well-known/agent-skills/index.json` con `sha256` calculado en el build, y un `SKILL.md` por herramienta.
- **CA2 ❌.** Solo se publica la habilidad de una herramienta `activo`: la misma compuerta de la revisión agronómica.
- **Work items:** WI-C8.3.1 `[código]` · WI-C8.3.2 `[prueba]` huella y compuerta.

#### HU-C8.4 · `security.txt`, JSON-LD, cabeceras `Link` y el CORE
- **Capa:** sitio y CORE · **Prioridad:** Could · **Puntos:** 2 · **Sprint:** C8 · **Depende de:** HU-C7.2 · **Estado:** Refinada
- **Respaldo:** PLATAFORMA §5.3 (4, 7 y 8, y «En el CORE»).
- **CA1.** `security.txt` (RFC 9116) en los dos dominios; `WebApplication` en cada calculadora; en el CORE, `robots.txt` con `Disallow: /` y los `/.well-known/` del CORE.
- **CA2 ❌.** El catálogo de API no se publica vacío (P1).
- **Work items:** WI-C8.4.1 `[código]` · WI-C8.4.2 `[prueba]`.

#### HU-C8.5 · `verificar-agentes` detiene producción
- **Capa:** CI · **Prioridad:** Should · **Puntos:** 3 · **Sprint:** C8 · **Depende de:** HU-C8.1 a HU-C8.4 · **Estado:** Refinada
- **Respaldo:** PLATAFORMA §5.8; P16.
- **CA1.** `scripts/verificar-agentes.ts` hace las comprobaciones de PLATAFORMA §5.1 contra staging, con un informe de todas las fallas a la vez (P15).
- **CA2 ❌.** Quitar una habilidad o cambiar su `sha256` detiene el despliegue a producción.
- **Work items:** WI-C8.5.1 `[código]` · WI-C8.5.2 `[ci]` · WI-C8.5.3 `[dueño]` segunda opinión con isitagentready.com desde su máquina.

### EC9 · OAuth 2.1 para agentes y MCP

#### HU-C9.1 · Spike: biblioteca del servidor de autorización
- **Capa:** arquitectura · **Prioridad:** Must · **Puntos:** 2 · **Sprint:** C9 · **Depende de:** — · **Estado:** Refinada
- **Respaldo:** PLATAFORMA §5.4 (Biblioteca).
- **CA1.** Se acepta `workers-oauth-provider` solo si guarda en D1 (no en KV) y si su doble de prueba rota el refresh de verdad (P17). Si no, Arctic y `@ed1/tokens`.
- **CA2.** La decisión queda en un ADR con lo que se probó.
- **Work items:** WI-C9.1.1 `[prueba]` prototipo · WI-C9.1.2 `[doc]` ADR.

#### HU-C9.2 · Migración 0009 y metadatos del servidor
- **Capa:** base y API · **Prioridad:** Must · **Puntos:** 3 · **Sprint:** C9 · **Depende de:** HU-C9.1, HU-C2.1 · **Estado:** Refinada
- **Respaldo:** PLATAFORMA §4.5 y §5.4.
- **CA1.** 0009 aplicada con la receta: `alcance` (con `mueve_dinero = 0` en la base), `cliente_oauth`, `concesion_oauth`, `codigo_oauth` y `refresco_oauth`.
- **CA2.** `/.well-known/oauth-authorization-server` (RFC 8414) con S256, `authorization_code` y `refresh_token`, y los alcances de todos los productos.
- **CA3 ❌.** Un alcance que mueve dinero lo rechaza la base.
- **Work items:** WI-C9.2.1 `[código]` · WI-C9.2.2 `[prueba]`.

#### HU-C9.3 · Registro de clientes
- **Capa:** API · **Prioridad:** Must · **Puntos:** 3 · **Sprint:** C9 · **Depende de:** HU-C9.2 · **Estado:** Refinada
- **Respaldo:** PLATAFORMA §5.4 (Registro del cliente) y §5.7.
- **CA1.** Client ID Metadata Documents y registro dinámico (RFC 7591) como respaldo, con tope por IP.
- **CA2 ❌.** Un cliente bloqueado no obtiene códigos, y un registro por encima del tope recibe 429.
- **Work items:** WI-C9.3.1 `[código]` · WI-C9.3.2 `[prueba]`.

#### HU-C9.4 · Autorizar, con consentimiento
- **Capa:** API y cuenta · **Prioridad:** Must · **Puntos:** 5 · **Sprint:** C9 · **Depende de:** HU-C9.3, HU-C7.3, HU-C6.3 · **Estado:** Refinada
- Como persona, quiero decidir qué puede hacer un asistente sobre mi espacio y hasta cuándo.
- **Respaldo:** PLATAFORMA §5.4 (Autorizar, Recurso); ED1 §5.5.
- **CA1.** `GET /oauth/authorize` exige PKCE S256 y `resource` (RFC 8707). El Worker valida y lleva a la página estática `/autorizar/` con la solicitud en el fragmento.
- **CA2.** La pantalla dice quién pide, qué alcances en palabras, sobre qué espacio (solo los del producto del recurso) y hasta cuándo.
- **CA3 ❌.** Sin PKCE, sin `resource` o con un `resource` de otro producto, no hay código. Ningún alcance de la pantalla mueve dinero.
- **Work items:** WI-C9.4.1 `[código]` ruta · WI-C9.4.2 `[código]` pantalla · WI-C9.4.3 `[prueba]` e2e y casos inválidos.

#### HU-C9.5 · Token y refresh rotado con detección de reuso
- **Capa:** API · **Prioridad:** Must · **Puntos:** 3 · **Sprint:** C10 · **Depende de:** HU-C9.4 · **Estado:** Refinada
- **Respaldo:** PLATAFORMA §5.4 (Token).
- **CA1.** Token de 1 h con `scope`, `azp`, `cnc` y `aud` = recurso. Refresh rotado en cada uso.
- **CA2 ❌.** Reusar un refresh ya rotado revoca la concesión entera y queda en la auditoría.
- **Work items:** WI-C9.5.1 `[código]` · WI-C9.5.2 `[prueba]`.

#### HU-C9.6 · Revocar y «Aplicaciones conectadas»
- **Capa:** API y cuenta · **Prioridad:** Must · **Puntos:** 3 · **Sprint:** C10 · **Depende de:** HU-C9.5, HU-C7.5 · **Estado:** Refinada
- **Respaldo:** PLATAFORMA §5.4 (Revocar).
- **CA1.** `POST /oauth/revoke` y, en `/seguridad/`, la lista de concesiones con su último uso y «Quitar acceso».
- **CA2 ❌.** Un token de una concesión revocada se rechaza en el recurso en la siguiente solicitud.
- **Work items:** WI-C9.6.1 `[código]` · WI-C9.6.2 `[prueba]` e2e.

#### HU-C9.7 · MCP del cuaderno (lectura)
- **Capa:** celda del agro · **Prioridad:** Should · **Puntos:** 5 · **Sprint:** C10 · **Depende de:** HU-C9.5 · **Estado:** Refinada
- Como productor, quiero preguntarle a mi asistente qué nave puedo cosechar hoy.
- **Respaldo:** PLATAFORMA §5.5 (Cuaderno).
- **CA1.** `mcp.cultivopro.co` en c0, con `/.well-known/oauth-protected-resource` (RFC 9728) y su Server Card. Lee registros y el calendario de carencias.
- **CA2.** Responde 401 con `WWW-Authenticate` y el enlace a sus metadatos.
- **CA3 ❌.** Un token con `aud` de otro recurso se rechaza; la herramienta de escritura no existe en esta historia.
- **Consumo y kill switch:** presupuesto propio en `product.yaml` y `ks:agro-mcp`; apagarlo no afecta el cuaderno.
- **Aceptación de HC6:** un cliente MCP real conecta, lee, y su concesión se revoca.
- **Work items:** WI-C9.7.1 `[código]` · WI-C9.7.2 `[prueba]` · WI-C9.7.3 `[dueño]` conectar un cliente real.

### EC10 · Correo

#### HU-C10.1 · Adaptador de correo y dominio que envía
- **Capa:** infraestructura · **Prioridad:** Must · **Puntos:** 3 · **Sprint:** C11 · **Depende de:** Workers Paid activo · **Estado:** Refinada
- **Respaldo:** PLATAFORMA §4.11; ED1 §20.2.
- **CA1.** `CorreoTransaccional` con el servicio de correo de Cloudflare; un proveedor externo cabe detrás del mismo adaptador.
- **CA2.** SPF, DKIM y DMARC en `laboratorio-digital.com`, comprobados con un envío real.
- **CA3 ❌.** Sin el binding, enviar responde «no disponible» y no finge haber enviado (P1).
- **Work items:** WI-C10.1.1 `[código]` · WI-C10.1.2 `[infra]` registros DNS · WI-C10.1.3 `[dueño]` verificar la entrega.

#### HU-C10.2 · Entrar con correo
- **Capa:** API y cuenta · **Prioridad:** Must · **Puntos:** 5 · **Sprint:** C11 · **Depende de:** HU-C10.1, HU-C7.3 · **Estado:** Refinada
- Como comerciante sin cuenta de Google, quiero entrar con un enlace a mi correo.
- **Respaldo:** PLATAFORMA §4.11; ED1 §5.2.
- **CA1.** 0007 con la receta. `POST /api/core/auth/correo/pedir` responde siempre lo mismo, exista o no la cuenta.
- **CA2.** Enlace de un solo uso, de 15 minutos, con el código en el fragmento; en la base, solo su huella.
- **CA3 ❌.** Un enlace usado o vencido no sirve; más de 3 por correo por hora, o por encima del límite por IP, se rechazan.
- **Aceptación de HC7:** un enlace llega a un correo que no es de Google y entra.
- **Work items:** WI-C10.2.1 `[código]` · WI-C10.2.2 `[código]` pantalla «revisa tu correo» · WI-C10.2.3 `[prueba]`.

#### HU-C10.3 · Avisos de vencimiento por correo
- **Capa:** planes · **Prioridad:** Should · **Puntos:** 2 · **Sprint:** C11 · **Depende de:** HU-C10.1, HU-C5.5 · **Estado:** Refinada
- **Respaldo:** PLATAFORMA §4.8 (5).
- **CA1.** Los avisos de 7 y 1 día salen por correo desde el cron que ya existe.
- **CA2 ❌.** Un aviso no se repite: dos corridas del cron el mismo día envían uno.
- **Work items:** WI-C10.3.1 `[código]` · WI-C10.3.2 `[prueba]`.

### EC11 · Operación de la plataforma

#### HU-C11.1 · El vigía en modo pago
- **Capa:** operación · **Prioridad:** Must · **Puntos:** 5 · **Sprint:** C4 · **Depende de:** Workers Paid activado por el dueño · **Estado:** Refinada
- Como dueño, quiero saber cuánto voy a pagar este mes antes de que llegue la factura.
- **Respaldo:** PLATAFORMA §3.2 y §4.10; ED1 §25.1.
- **CA1.** El PR que activa Workers Paid cambia `plan` a `paid` en `celdas.json` y le da al vigía las cuotas del mes (hoy falla a propósito con `paid`).
- **CA2.** El vigía compara el consumo del mes con lo incluido, proyecta el costo en dólares y avisa por Telegram al 50, 75 y 90 % o al pasar el presupuesto de un producto (`presupuesto.usd_mes`).
- **CA3 ❌.** Con el 100 % del presupuesto, apaga la capacidad que el producto declare, **nunca la venta**.
- **CA4.** Las alertas de facturación de Cloudflare quedan configuradas como segunda red.
- **Work items:** WI-C11.1.1 `[código]` · WI-C11.1.2 `[prueba]` · WI-C11.1.3 `[dueño]` activar Workers Paid y las alertas, y fijar el presupuesto de cada producto.

#### HU-C11.2 · Límites por Worker
- **Capa:** operación · **Prioridad:** Must · **Puntos:** 2 · **Sprint:** C6 · **Depende de:** HU-C11.1 · **Estado:** Refinada
- **Respaldo:** PLATAFORMA §3.2 (3); `cuenta-cloudflare.md` §5.
- **CA1.** `limits.cpu_ms` y `limits.subrequests` en cada Worker, generados de su declaración.
- **CA2 ❌.** workers.dev se apaga en los Workers nuevos de producción, pero **no** en el CORE ni en los que usan los cuadernos instalados (P10); una prueba lo cuida en los dos sentidos.
- **Work items:** WI-C11.2.1 `[código]` · WI-C11.2.2 `[prueba]`.

#### HU-C11.3 · CI de lo afectado y despliegue por producto
- **Capa:** CI · **Prioridad:** Should · **Puntos:** 3 · **Sprint:** C9 · **Depende de:** HU-C0.3 · **Estado:** Refinada
- **Respaldo:** PLATAFORMA §6.3; ARQUITECTURA §7.2 (menos de 8 minutos).
- **CA1.** Cada PR corre las pruebas de lo que cambió y de lo que depende de ello; las de repositorio, siempre.
- **CA2.** El despliegue va en orden: CORE, celdas de cada producto, sitios. Cada destino carga solo los secretos de su producto (R6).
- **CA3 ❌.** Un cambio en `packages/tokens` corre las pruebas de todas las celdas, no solo las del CORE.
- **Work items:** WI-C11.3.1 `[ci]` · WI-C11.3.2 `[prueba]`.

#### HU-C11.4 · Copia fuera de Cloudflare y simulacro de restauración
- **Capa:** operación · **Prioridad:** Must · **Puntos:** 5 · **Sprint:** C11 · **Depende de:** decisión D-C5 · **Estado:** Refinada
- Como dueño, quiero poder recuperar todo aunque la cuenta de Cloudflare quede suspendida.
- **Respaldo:** ED1 §20.3; PLATAFORMA §3.5 (6); `proveedores-de-computo.md` §4; bitácora core 1.
- **CA1.** Copia de las bases del CORE y de las celdas, cifrada antes de salir, en Google Cloud Storage o Backblaze B2, con la frecuencia de la decisión D-C5.
- **CA2.** Simulacro trimestral: restaurar en una base vacía y comparar recuentos y huellas.
- **CA3 ❌.** Una copia que no se puede descifrar o que no cuadra en el simulacro avisa por Telegram con la causa.
- **CA4.** La llave de cifrado no vive en la misma cuenta que la copia.
- **Work items:** WI-C11.4.1 `[código]` · WI-C11.4.2 `[prueba]` · WI-C11.4.3 `[dueño]` crear el bucket y su credencial de solo escritura.

#### HU-C11.5 · Gobierno de la cuenta y credenciales por propósito
- **Capa:** operación · **Prioridad:** Must · **Puntos:** 2 · **Sprint:** C7 · **Depende de:** HU-C1.3 · **Estado:** Refinada
- **Respaldo:** PLATAFORMA §3.5 (4 y 5); R6; causa 4 de la Tienda 2.0 (permisos que se pisan).
- **CA1.** Los tokens de despliegue, de métricas y de Cloudflare for SaaS, cada uno verificado con la acción que va a hacer antes de usarse (P12).
- **CA2.** Lista de comprobación del dueño: segundo factor, contactos de recuperación y los tres dominios con un registrador y un correo fuera de Cloudflare.
- **CA3 ❌.** Un token con más permisos de los declarados hace fallar la verificación y nombra el permiso de más.
- **Work items:** WI-C11.5.1 `[código]` · WI-C11.5.2 `[dueño]` lista de comprobación.

---

## 8. Preparadas, sin sprint

| Historia | Disparador |
|---|---|
| HU-C6.7 · Migrar el sitio y el cuaderno de CultivoPro a `@ed1/ui` v2 (5) | La cuenta lleva un mes estable en producción y el dueño lo decide. Es un cambio visible para los productores: se hace con la temporada cargada a 360 px (bitácora agro, «una pantalla vacía no enseña lo que una llena sí») |
| HU-C3.8 · Contraer la transición del CORE: `producto` obligatorio, sin `DEFAULT 'agro'`, sin `usuario.politica_*` ni `ks:agro-core` (3) | Ninguna versión instalada del cuaderno entra sin `producto` durante 30 días. Es **mayor** (core-v2.0.0) si cambia un parámetro obligatorio |
| HU-C9.8 · MCP del cuaderno con escritura (3) | HU-C9.7 un mes en uso. Las escrituras entran como operaciones con `dispositivo = mcp:<cliente>` y pasan por la cuarentena (PLATAFORMA §5.5) |
| HU-C11.6 · Consola del dueño v0 (5) | El tercer producto con cuentas y pagos (ED1 §3.11 y §31.1). Mientras tanto, el reporte semanal y los tableros |
| HU-C12.1 · Sitio principal `laboratorio-digital.com` con el sistema de diseño (5) | La marca pública del ecosistema (ED1 Fase 0, decisión D-C3) |

---

## 9. Decisiones del dueño para empezar

Se piden todas al principio. Cada una trae su recomendación; mientras no se decida, el plan sigue con ella.

| # | Decisión | Recomendación | La necesita |
|---|---|---|---|
| D-C1 | Tipografía propia autoalojada (Geist y Geist Mono) o fuentes del sistema | Propia, solo en la cuenta, con presupuesto de 70 KB | HU-C6.2 (C2) |
| D-C2 | La cuenta como producto `cuenta` con sesión propia, o con cookie del CORE | Producto `cuenta` (HU-C7.1) | HU-C7.3 (C5) |
| D-C3 | El nombre público del ecosistema en la cuenta («Laboratorio Digital»?) | El del dominio, hasta la Fase 0 de ED1 | HU-C7.2 (C5) |
| D-C4 | El reparto de las horas entre el CORE, la Tienda y el agro | CORE primero hasta HC1; después, dos carriles con el límite de §2.6 | Planeación del C1 |
| D-C5 | Frecuencia de la copia fuera de Cloudflare: semanal o mensual | Semanal dentro de Cloudflare (R2) y **mensual cifrada fuera**, como dicen ED1 §20.3 y `proveedores-de-computo.md` (bitácora core 1) | HU-C11.4 (C11) |
| — | Las de PLATAFORMA §9: presupuesto en dólares por producto, `ai-train`, precios de 3, 6 y 12 meses, gracia de la tienda | Las de PLATAFORMA §9 | HU-C11.1, HU-C8.1, HU-C1.2 |

**Tareas que solo puede hacer el dueño** (con fecha para no frenar el camino crítico):

| Tarea | Antes de | Detalle |
|---|---|---|
| Renombrar el repositorio en GitHub | C2 | `docs/runbooks/renombrar-repositorio.md` |
| Contactos de recuperación de la cuenta y los tres dominios | C2 | HU-C1.3 |
| Activar Workers Paid y las alertas de facturación | C4 (17 nov) | PLATAFORMA §3.2; HU-C11.1 |
| Agregar la zona `laboratorio-digital.app` | 30 nov (Tienda M0) | PLATAFORMA §9.5 |
| URL de vuelta de Google para `cuenta.laboratorio-digital.com` | C5 | HU-C4.6, con los pasos exactos |
| Bucket fuera de Cloudflare y su credencial de solo escritura | C11 | HU-C11.4 |
| Datos del responsable del tratamiento | C10 | HU-C7.7 |

---

## 10. Riesgos del plan

| Riesgo | Prob. | Impacto | Respuesta |
|---|---|---|---|
| La validación del dueño se atrasa y la cola crece (el agro dejó 57 historias esperando) | Alta | Alto | Límite de 4 en validación (§2.6); la revisión del viernes es la validación; la velocidad cuenta lo validado |
| Tres backlogs compiten por las mismas horas | Alta | Alto | D-C4. El orden lo pone el camino crítico de la Tienda, no el entusiasmo |
| Un cuaderno instalado deja de entrar (emisor, URL o parámetro nuevo) | Media | Alto | Tres fases de tokens; workers.dev viva; contrato con la solicitud del cuaderno publicado; congelamiento de diciembre |
| D1 rehace tablas distinto que `node:sqlite` | Media | Alto | HU-C2.1 va primero; Time Travel y exportación antes de producción |
| Factura sorpresa con Workers Paid | Media | Medio | HU-C11.1 en el mismo sprint en que se activa; límites por Worker (HU-C11.2) |
| El diseño se come el presupuesto de rendimiento | Media | Medio | Presupuestos en el CI desde HU-C6.6; la galería mide antes que las pantallas |
| Los borradores de agentes y MCP cambian de ruta | Alta | Bajo | Archivos horneados, ruta vigente y recomendada, una prueba fija las dos |
| Cumplimiento sin abogado (Ley 1581) | Media | Medio | Controles técnicos verificables (ED1 §20.1); HU-C7.7 radica y mide plazos; revisión legal cuando haya presupuesto |

---

## 11. Registro de velocidad

| Sprint | Comprometido | Validado por el dueño | Nota |
|---|---|---|---|
| C1 | 16 | — | — |

---

## 12. De la hoja de ruta de PLATAFORMA §7 a las historias

| Fase | Historias |
|---|---|
| P0 · Preparar | HU-C0.1 a HU-C0.3, HU-C1.1 a HU-C1.4 |
| P1 · Producto en el CORE | HU-C2.1 a HU-C2.4, HU-C3.1 a HU-C3.7, HU-C4.1, HU-C4.2 |
| P2 · Tokens v2 y sesión por producto | HU-C4.3 a HU-C4.6 |
| P3 · Planes por periodo | HU-C5.1 a HU-C5.7 |
| P4 · Agentes, capa estática | HU-C8.1 a HU-C8.5 |
| P5 · OAuth y MCP | HU-C9.1 a HU-C9.7 |
| P6 · Correo | HU-C10.1 a HU-C10.3 |
| Nuevo en este plan (ED1 §16 y el pedido de diseño) | EC6 (HU-C6.1 a HU-C6.6), EC7 (HU-C7.1 a HU-C7.8) |
| Operación común | HU-C11.1 a HU-C11.5 |
