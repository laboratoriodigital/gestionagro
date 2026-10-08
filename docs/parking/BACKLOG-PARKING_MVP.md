# Parqueadero ED1 — Backlog del MVP (M0)

**Versión:** 0.1.0 · 7 oct 2026
**Dueño del producto:** Sebas. **Gerencia del proyecto y Scrum:** el asistente, que hace los commits, el push y los PR; el dueño aprueba, fusiona, valida y lleva la relación con el cliente.
**Fuente única de:** las **40 historias refinadas de M0**, con sus criterios, bocetos y work items; los datos que se le piden al cliente; el primer día de un equipo nuevo; las demostraciones de cada viernes y el piloto. El plan completo (hitos, sprints, M1 a M3, decisiones, riesgos y velocidad) está en `BACKLOG-PARKING.md` («plan §N»). El sprint de cada historia lo fija el plan §6.1; el título, los puntos y los criterios, este documento.
**Lo que manda sobre este documento:** `../ecosistema/ECOSISTEMA-DIGITAL-ED1-v1.4.md` (ED1 §N) → `../ARQUITECTURA.md` (ADR-N, P1–P21) → `ARQUITECTURA-PARQUEADERO.md` («PARQUEADERO §N») → el plan. El mercado: `ESTUDIO-MERCADO-PARQUEADEROS-ED1-2026-10.md` («estudio §N»). Ante una contradicción, se señala antes de actuar.
**Lecciones:** `BITACORA-PARKING.md` (bitácora parqueadero N) y las bitácoras que cita el plan.

---

## 0. En una página

**Qué pidió el cliente**, en sus palabras (PARQUEADERO §2.1):

1. Imprimir desde el navegador del celular o del PC el recibo que se entrega al conductor.
2. Mandar ese mismo recibo al WhatsApp que el conductor da en ese momento.
3. Que el papel deje de usarse a corto y mediano plazo.

La impresora es la **GOOJPRT PT-210**: térmica portátil de 58 mm, ESC/POS, Bluetooth.

**Qué recibe el cliente con el MVP:** una caja que se instala desde Chrome en un Android o un PC con Windows y funciona sin internet. Registra la entrada con la placa y el estado del vehículo, imprime el recibo en la PT-210 y, en el mismo momento, deja listo el mismo recibo para enviarlo desde el WhatsApp del parqueadero, o lo muestra como un QR en pantalla. En la salida liquida con la tarifa y el tope de la ciudad, cobra y entrega el recibo de salida por los mismos caminos. Cierra el turno con un papel impreso y guarda un respaldo. **No necesita cuenta, ni servidor, ni pagarle nada a Meta.**

**Las fechas:**

| Fecha | Qué se ve | Versión |
|---|---|---|
| Viernes 9 oct | El plan en el repositorio, las decisiones del dueño y la PT-210 medida | — |
| Viernes 16 oct | La PT-210 imprime la página de prueba desde la caja instalada en un Android | — |
| Viernes 23 oct | Una entrada con su recibo impreso en menos de 10 segundos | — |
| **Viernes 30 oct** | **Demostración al cliente:** entrada, recibo impreso y por WhatsApp, QR en pantalla, la página del recibo y la salida con cobro, en `parqueadero.laboratorio-digital.app` | `parqueadero-v0.1.0` |
| Viernes 6 nov | Un turno completo: apertura, entradas, salidas, anulación, cierre impreso y respaldo | — |
| **Lunes 9 a viernes 13 nov** | **Piloto:** puesta en marcha y primeros turnos reales con el cliente, en paralelo con su talonario | `parqueadero-v0.2.0` |

**El MVP está terminado cuando:**

1. La matriz de PARQUEADERO §15.3 está en verde con la PT-210 del cliente y el teléfono que será su caja (HU-Q6.1).
2. Un turno real completo cierra sin diferencias entre la caja y el conteo (HU-Q6.4).
3. Cada recibo lleva los campos de la ley en sus cuatro salidas, y la prueba de paridad está en verde (HU-Q1.4).
4. La caja registra, cobra e imprime con el teléfono en modo avión (HU-Q6.3).
5. El número del conductor no sale del teléfono salvo hacia WhatsApp, y se borra 24 h después de la salida (HU-Q4.1).
6. El cliente sabe hacer el respaldo y restaurarlo, y hay un runbook para lo que falle (HU-Q3.10, HU-Q6.2).

**En cifras:** 40 historias y **116 puntos**: 104 Must y 12 Should (HU-Q2.5, HU-Q3.11, HU-Q5.3, HU-Q6.5 y HU-Q6.6).

**El orden va por riesgo.** Lo que nadie ha hecho antes en este ecosistema, imprimir por Bluetooth desde el navegador, va primero: si falla, quedan tres semanas para el segundo camino. Las pantallas que ya tienen un modelo en el cuaderno o en la Tienda van después.

---

## 1. Lo que necesitamos del cliente, y para cuándo

Lo pide el dueño (HU-Q0.2). **Los datos del cliente no entran al repositorio:** se guardan en la carpeta del dueño y se cargan en su caja durante la puesta en marcha. Su nombre entra a la lista de términos prohibidos de las pruebas.

| # | Dato | Para qué | Historia | Para cuándo |
|---|---|---|---|---|
| 1 | Ciudad, y el tope que reportó a la alcaldía si aplica | El tope de la liquidación | HU-Q1.2, HU-Q3.2 | 14 oct |
| 2 | Tarifas por tipo de vehículo: por minuto, fracción u hora; gracia; tope diario; nocturna; tiquete perdido | Configurar la caja y probarla con sus números | HU-Q1.1, HU-Q3.2 | 14 oct |
| 3 | Datos legales: razón social, NIT, dirección, teléfono, póliza (aseguradora y número) y registro (en Bogotá, el Registro Distrital) | Los campos que exige la ley en el recibo | HU-Q1.4, HU-Q3.2 | 14 oct |
| 4 | Una foto de un recibo de hoy, sin datos del conductor | Comparar campos y no perder nada que el cliente ya entrega | HU-Q1.4 | 14 oct |
| 5 | Vehículos por día, horario, turnos y cuántos cajeros | Dimensionar el turno y el piloto | HU-Q3.9, HU-Q6.4 | 14 oct |
| 6 | El equipo de la caja: Android (marca, modelo y versión), iPhone o PC con Windows | Elegir el camino de impresión (riesgo R4) | HU-Q2.3, HU-Q2.4 | 14 oct |
| 7 | Si ya tiene la PT-210, cuántas y desde cuándo | El paso 0 con su unidad | HU-Q2.1 | 14 oct |
| 8 | El WhatsApp del parqueadero: número, si es WhatsApp Business y si está en el mismo teléfono de la caja | Desde dónde sale el recibo | HU-Q4.1 | 14 oct |
| 9 | Medios de pago que acepta: efectivo, su QR, datáfono | La pantalla de cobro | HU-Q3.5 | 14 oct |
| 10 | Si es responsable de IVA y cómo factura hoy | Lo que el recibo no es (M4) | Plan §9 | 14 oct |
| 11 | Cuántos abonados tiene y cómo los controla | Si HU-Q3.11 entra o se recorta | HU-Q3.11 | 23 oct |
| 12 | Su meta de recibos digitales a 90 días | La métrica de la excepción (D-Q7) | HU-Q0.2 | 30 oct |

**Recibido el 7 oct 2026** (en la carpeta del dueño, fuera del repositorio): los datos 3, 4, 6, 7, 8, 9, 10 y 12, y en parte el 1, el 2, el 5 y el 11. Faltan:

- **Dato 2.** El recibo de hoy dice que las tres primeras horas se cobran por minuto y que después hay tarifa de día o de noche: falta cuánto vale cada una y desde qué hora es noche, además de la gracia, el tope diario y el tiquete perdido. Cambia la liquidación de HU-Q1.1: un tope por día no basta, hay un salto a tarifa plana a las tres horas.
- **Dato 3.** La razón social y el Registro Distrital.
- **Dato 5.** Vehículos por día, turnos y cajeros. La meta (dato 12) son 10.000 a 13.000 recibos digitales en 90 días: unos 110 a 145 por día.
- **Dato 6.** Marca, modelo y versión de Android y de Chrome: el equipo es de gama media y no muy reciente.
- **Dato 11.** Cuántos abonados. Hay mensualidades de moto con control manual, así que recortar HU-Q3.11 (Should) le quitaría algo que usa hoy.
- **Nuevo.** Si la caja sigue la numeración preimpresa de sus talonarios o empieza su propia serie.

**Preguntas para la conversación con el cliente** (de estudio §16.2; se anota lo que la persona hace, no lo que dice que haría):

1. Muéstreme cómo recibió y despachó los últimos diez vehículos, con las placas tapadas.
2. ¿Cómo cuadra la caja al final del turno? ¿Cuándo no cuadró la última vez, y por qué?
3. ¿Qué anota del estado del vehículo al recibirlo? ¿Algún cliente le reclamó un daño?
4. ¿Qué pasa cuando se cae el internet o se acaba la batería?
5. ¿Cuántos conductores cree que aceptarían el recibo por WhatsApp? ¿Les pide hoy el número para algo?

---

## 2. Roles y responsabilidades

| Rol | Quién, con el equipo de referencia | Si lo ejecuta otro equipo |
|---|---|---|
| Dueño del producto | Sebas | Sebas: decide alcance, acepta historias y habla con el cliente |
| Gerencia del proyecto y Scrum Master | El asistente | Un Scrum Master o un líder técnico con ese rol |
| Desarrollo | El asistente | Un desarrollador líder de TypeScript (PWA, IndexedDB, Web Bluetooth) y uno de frontend |
| QA en campo | El dueño, con el equipo real | Una persona de QA a medio tiempo con el kit de §3.3 |
| Parqueadero cero | El cliente: su propietario y sus cajeros | Igual |

**RACI** (R hace, A responde, C se consulta, I se informa):

| Actividad | Dueño | Asistente o equipo | QA en campo | Cliente |
|---|---|---|---|---|
| Decisiones D-Q1 a D-Q10 | A, R | C | — | I |
| Datos del cliente (§1) | A | C | — | R |
| Refinar, construir, probar y abrir el PR | A (aprueba y fusiona) | R | C | — |
| Validar en staging | A, R | C | R | — |
| La matriz en el equipo real | A | R (prepara) | R | — |
| Demostración del 30 oct | A, R | R | — | C |
| Puesta en marcha y piloto | A | R | R | C, y R de su operación |
| Zona `.app` y cuentas de la nube | A, R | C (da los pasos) | — | — |
| Bitácora, CHANGELOG y documentos | I | R | C | — |

---

## 3. El primer día de un equipo nuevo

### 3.1 Qué leer, en este orden (unas dos horas)

1. Este documento, §0 a §4.
2. `ARQUITECTURA-PARQUEADERO.md` §0, §5, §6, §7, §8.2 a §8.4 y §15.
3. El plan, §3 y §4: cómo se trabaja, la Definición de Listo y la de Terminado.
4. `BITACORA-PARKING.md`: «Lo aprendido» y «Lo que el terreno enseñó».
5. El estudio, §1: el resumen.

### 3.2 Comandos

Node 22.18 o posterior, y pnpm 11.28.2 por corepack. En Windows, desde Git Bash.

```bash
git clone https://github.com/laboratoriodigital/gestionagro.git
cd gestionagro
corepack enable
pnpm install
set -o pipefail; pnpm lint && pnpm typecheck && pnpm test
node docs/parking/sql/probar-parqueadero.mjs docs/parking/sql/parqueadero/0001_parqueadero_v1.sql
git worktree add ../gestionagro-parqueadero -b feat/q1-sprint origin/main
```

La prueba del SQL debe terminar con 56 comprobaciones en verde. Si no, eso es lo primero que se arregla, y va a la bitácora.

### 3.3 El equipo físico

| Pieza | Para qué | Historia |
|---|---|---|
| Una GOOJPRT PT-210 del equipo (D-Q8) y rollos de 57 mm | El paso 0, la página de prueba y la matriz | HU-Q2.1, HU-Q6.1 |
| Un Android de gama de entrada con Chrome 138 o posterior, y nRF Connect instalado | La caja de referencia; Web Bluetooth y Web Serial | HU-Q2.3, HU-Q2.4 |
| Un PC con Windows 10 o posterior, Chrome o Edge, y un cable USB de datos | El segundo equipo de la matriz; el diálogo del sistema con el driver POS58 | HU-Q2.4, HU-Q2.5 |
| Un iPhone | El camino sin papel: WhatsApp y QR | HU-Q4.1, HU-Q4.2 |
| Dos números de WhatsApp de prueba: uno con WhatsApp Business, que hace de parqueadero, y otro que hace de conductor | Enviar y recibir de verdad, sin molestar a nadie | HU-Q4.1 |

### 3.4 Cuentas

M0 no necesita ninguna cuenta nueva. El sitio se despliega desde el CI con las credenciales que ya tiene el repositorio; la zona `laboratorio-digital.app` la activa el dueño (D-Q4). Ni Meta, ni Bold integrado: el cliente paga el primer periodo con un link manual (D-Q5).

---

## 4. El plan, semana a semana

### 4.1 Las seis semanas

| Semana | Meta | Historias, en orden de validación | Lo que se ve el viernes |
|---|---|---|---|
| **Q0** · 7–9 oct | El plan, las decisiones y la PT-210 medida | HU-Q0.1, HU-Q0.2, HU-Q2.1 | El PR del plan; las decisiones; el informe del paso 0 |
| **Q1** · 13–16 oct | Imprimir desde el teléfono | HU-Q5.1, HU-Q3.1, HU-Q2.2, HU-Q2.3, HU-Q2.6, HU-Q1.6 | La página de prueba impresa desde la caja instalada (§7.1) |
| **Q2** · 19–23 oct | La entrada | HU-Q1.3, HU-Q1.1, HU-Q1.4, HU-Q1.5, HU-Q3.2, HU-Q3.3 | Cinco entradas cronometradas con su recibo (§7.2) |
| **Q3** · 26–30 oct | La demostración | HU-Q5.2, HU-Q0.3, HU-Q3.4, HU-Q3.5, HU-Q3.6, HU-Q4.4, HU-Q4.1, HU-Q4.2 | **El cliente ve el recorrido completo** (§7.3) |
| **Q4** · 3–6 nov | Un turno completo | HU-Q3.7, HU-Q3.8, HU-Q3.9, HU-Q3.10, HU-Q1.2, HU-Q4.3, HU-Q2.4 | Un turno con anulación, cierre impreso y restauración (§7.4) |
| **Q5** · 9–13 nov | El piloto | HU-Q6.1, HU-Q6.2, HU-Q6.3, HU-Q6.4, HU-Q3.11, HU-Q2.5, HU-Q5.3, HU-Q4.5, HU-Q6.5, HU-Q6.6 | La revisión del piloto con el cliente (§7.5) |

**Q5 se prepara antes de empezar:** la matriz de HU-Q6.1 se va llenando desde Q1, con cada historia que toca la impresora o WhatsApp, y los runbooks de HU-Q6.2 se escriben en Q4. Así, el lunes 9 nov solo falta la puesta en marcha.

### 4.2 El camino crítico de M0

```text
Q0  HU-Q2.1 paso 0 ──────────────────────────┐
Q1  HU-Q5.1 staging ─► HU-Q3.1 caja ─► HU-Q2.6 asistente ◄── HU-Q2.3 bluetooth ◄── HU-Q2.2 impresion
                                                                   HU-Q1.6 whatsapp ─────────────┐
Q2  HU-Q1.3 schema ─► HU-Q1.1 tarifas ─► HU-Q3.2 sede ─► HU-Q3.3 ENTRADA ◄── HU-Q1.4 recibos ◄──┤
                                                  HU-Q1.5 enlace ◄─────────────────┘             │
Q3  HU-Q5.2 dominio ─► HU-Q4.2 /r/        HU-Q3.4 ─► HU-Q3.5 SALIDA      HU-Q4.4 ─► HU-Q4.1 WHATSAPP
    HU-Q0.3 versión ─► v0.1.0 ─► DEMOSTRACIÓN 30 oct
Q4  HU-Q3.7 ─► HU-Q3.9 TURNO ─► HU-Q3.10 respaldo      HU-Q3.8 · HU-Q1.2 · HU-Q4.3 · HU-Q2.4
Q5  HU-Q6.1 matriz ─► HU-Q6.3 aceptación ─► v0.2.0 ─► HU-Q6.4 PILOTO      (HU-Q6.2 runbooks)
```

Fuera del código, el camino crítico pasa por el dueño y el cliente: las decisiones de Q0, los datos del cliente el 14 oct y la zona activa antes del 23 oct (plan §10).

### 4.3 Las versiones

- **`parqueadero-v0.1.0`** al cerrar Q3: la demostración, en producción en el dominio. Ningún recibo real todavía.
- **`parqueadero-v0.2.0`** al cerrar las historias de Q5 que van antes del piloto (HU-Q6.1 a HU-Q6.3): la versión del piloto.
- **`v0.2.x`** durante el piloto: solo arreglos, publicados después de un cierre de turno, nunca en medio.

### 4.4 Si una semana se queda corta: el orden de recorte

Se decide en la retrospectiva del viernes, con el dueño. **La fecha del 30 oct no se corre; se recorta alcance, en este orden:**

1. HU-Q5.3 · Recibos por canal (Should, 3): pasa a Q6. La meta de papel se mide a mano en el piloto.
2. HU-Q3.11 · Abonados por placa (Should, 2): pasa a Q6 si el cliente tiene pocos abonados.
3. HU-Q2.5 · El diálogo del sistema (Should, 2): pasa a Q6 si la caja del cliente es un Android.
4. HU-Q2.4 · Web Serial (3): pasa a Q6 si el cliente usa Android y la matriz muestra que Web Bluetooth reconecta bien. Si su caja es un PC con Windows, no se recorta.
5. HU-Q1.2 · Los topes como contenido (2): solo si la ciudad del cliente no tiene tope. En Bogotá no se recorta: sin él, la caja puede cobrar por encima de la ley.

**Nunca se recorta:** los campos de la ley y la paridad (HU-Q1.4), la impresión por Bluetooth (HU-Q2.3), la entrada, la salida y el turno (HU-Q3.3, HU-Q3.5, HU-Q3.9), el respaldo (HU-Q3.10), el borrado del número del conductor (HU-Q4.1), el aviso de privacidad (HU-Q4.4), la matriz en el equipo real (HU-Q6.1) y el acompañamiento del primer turno (HU-Q6.4).

**Si el viernes 23 oct la entrada todavía no imprime en la PT-210**, HU-Q2.5 se adelanta a Q3 y la demostración imprime por el diálogo del sistema desde el PC, y se le dice al cliente qué falta y para cuándo. Mejor una demostración honesta que una pospuesta.

---

## 5. Las historias refinadas

Formato de cada historia, el del plan §8: capa, prioridad (MoSCoW), puntos, sprint, dependencias y estado; como, quiero, para; respaldo; criterios de aceptación con al menos uno negativo (❌); boceto si tiene pantalla; **en el equipo real**, si toca la impresora, WhatsApp o la cámara (plan §4.1, punto 10); patrones en riesgo; y work items (`[código]`, `[prueba]`, `[doc]`, `[infra]`, `[ci]`, `[diseño]`, `[dueño]` o `[campo]`).

### EQ0 · Gobierno

#### HU-Q0.1 · Estudio, arquitectura, plan, backlogs y bitácora en el repositorio
- **Capa:** proceso · **Prioridad:** Must · **Puntos:** 2 · **Sprint:** Q0 · **Depende de:** — · **Estado:** Hecha (PR #110)
- Como dueño, quiero el estudio, la arquitectura, el plan, los dos backlogs y la bitácora del parqueadero en el repositorio, con el método del CORE y la Tienda, para que cualquier equipo pueda empezar y para unir después la bitácora al segundo cerebro de ED1.
- **Respaldo:** ADR-31 (aceptada el 8 oct 2026); BACKLOG_CORE §2 a §4 y BACKLOG_TIENDA3 §3 y §4 (el método); las bitácoras, «Cómo se une con las otras bitácoras».
- **CA1.** `docs/parking/` tiene el estudio, `ARQUITECTURA-PARQUEADERO.md`, `sql/`, `BACKLOG-PARKING.md`, `BACKLOG-PARKING_MVP.md` y `BITACORA-PARKING.md`, y los nombran `docs/README.md`, `docs/BACKLOG.md`, `BACKLOG_CORE.md`, `BACKLOG_TIENDA3.md` y el CHANGELOG.
- **CA2.** La bitácora usa la ficha extraíble con el proyecto `parqueadero`, los patrones P1–P21 sin renumerar y los provisionales `PQ<n>`.
- **CA3 ❌.** Ninguna contradicción encontrada queda callada: las del contraste (plan §1) están en la bitácora, y PARQUEADERO dice dónde quedó cada una. Los títulos y los puntos de las 40 historias coinciden entre este documento y el plan, y las sumas por sprint y por hito cuadran; una comprobación lo verifica, con un punto cambiado a propósito como control negativo.
- **Work items:** WI-Q0.1.1 `[doc]` plan · WI-Q0.1.2 `[doc]` backlog del MVP · WI-Q0.1.3 `[doc]` bitácora · WI-Q0.1.4 `[doc]` mapa de `docs/`, filas en los otros backlogs y CHANGELOG · WI-Q0.1.5 `[doc]` notas en PARQUEADERO.

#### HU-Q0.2 · Decisiones del dueño y datos del cliente antes de la primera línea de código
- **Capa:** producto · **Prioridad:** Must · **Puntos:** 2 · **Sprint:** Q0 · **Depende de:** HU-Q0.1 · **Estado:** En sprint (datos del cliente recibidos el 7 oct; faltan los de §1; decisiones D-Q1 a D-Q10 pendientes)
- Como dueño, quiero dejar escritas las decisiones, las métricas con su número y los datos del cliente antes de construir, para no acomodar la regla a lo que salga.
- **Respaldo:** plan §10 (D-Q1 a D-Q10); PARQUEADERO §18.2 y §19.2; estudio §16.3; ED1 §2.1 [D3] (una excepción declarada fija sus métricas antes de medir).
- **CA1.** `content/parqueadero/validacion.json` tiene las métricas de PARQUEADERO §18.2, cada una con definición, umbral, frecuencia y fuente. La que todavía no se puede fijar (la meta de recibo digital) dice por qué y cuándo se fija. Una prueba lo lee.
- **CA2.** El plan §10 registra lo que decidió el dueño en cada D-Q. Los datos del cliente de §1 quedan en la carpeta del dueño, fuera del repositorio, y su nombre entra a la lista de términos prohibidos de las pruebas (la de HU-E1.7 del agro).
- **CA3 ❌.** Una métrica sin umbral, o con «por definir» sin motivo, hace fallar la prueba. Una prueba que escribe el nombre del cliente hace fallar la de términos prohibidos.
- **Patrones en riesgo:** P4, P18.
- **Work items:** WI-Q0.2.1 `[dueño]` decisiones · WI-Q0.2.2 `[dueño]` datos del cliente · WI-Q0.2.3 `[código]` `validacion.json` · WI-Q0.2.4 `[prueba]` · WI-Q0.2.5 `[código]` término prohibido.

#### HU-Q0.3 · Versión propia y publicación del parqueadero
- **Capa:** CI y despliegue · **Prioridad:** Must · **Puntos:** 3 · **Sprint:** Q3 · **Depende de:** HU-Q5.1, HU-C0.3 (hecha) · **Estado:** Hecha (PR #114): versión propia, su CHANGELOG, la etiqueta `parqueadero-vX.Y.Z` y la guardia del CI. Queda en `0.0.0` (solo staging) hasta la `0.1.0` de la demostración; su producción espera HU-Q5.2 y, mientras tanto, falla y lo dice. La versión al pie del cierre de turno llega con HU-Q3.9
- Como dueño, quiero publicar el parqueadero cuando cambia el parqueadero, con su versión y su registro de cambios, para no arrastrar al agro, al CORE ni a la Tienda, y para saber qué versión tiene la caja del cliente.
- **Respaldo:** PARQUEADERO §16; PLATAFORMA §6.3; HU-C0.3; HU-T0.2.
- **CA1.** La versión vive en `apps/parqueadero-sitio/package.json`, con su `CHANGELOG.md` y etiquetas `parqueadero-vX.Y.Z`. La caja muestra su versión en Ajustes y al pie del cierre de turno.
- **CA2.** Un PR que sube la versión publica solo el parqueadero, en la misma corrida que crea la etiqueta: una versión creada con el token de Actions no dispara otros flujos (bitácora agro, terreno).
- **CA3 ❌.** Un PR que cambia `apps/parqueadero-*` o `packages/parqueadero-*` sin anotar el CHANGELOG del parqueadero hace fallar el CI (la guardia de HU-C0.3, extendida).
- **Patrones en riesgo:** P2, P10, P16.
- **Work items:** WI-Q0.3.1 `[código]` publicación por producto · WI-Q0.3.2 `[ci]` destino `parqueadero` en `desplegar.yml` · WI-Q0.3.3 `[prueba]` tabla de casos (sube el parqueadero, otro producto, varios o ninguno) · WI-Q0.3.4 `[doc]` ARQUITECTURA §7.

### EQ1 · Reglas puras

#### HU-Q1.1 · `@ed1/parqueadero-tarifas`: la liquidación pura, con el tope que nunca se pasa
- **Capa:** paquete · **Prioridad:** Must · **Puntos:** 5 · **Sprint:** Q2 · **Depende de:** HU-Q1.3 · **Estado:** Hecha (PR #113): 18 casos, propiedad de 3000 estadías y tres husos en verde
- Como conductor, quiero que me cobren lo que dice la tarifa y nunca más del tope legal; como parqueadero, que la caja y la calculadora den lo mismo.
- **Respaldo:** ADR-37; PARQUEADERO §9; bitácora parqueadero 5 (`@ed1/dinero`).
- **CA1.** `liquidar(entrada, salida, tarifa, tope, abonado?, perdido?)` es pura: recibe los instantes, sin reloj ni red, y devuelve los minutos, las líneas con su concepto, el subtotal, el redondeo, el total y los avisos. Modos `minuto`, `fraccion` y `hora`; gracia; tope por bloque de 24 h; franja nocturna con valor fijo; tiquete perdido; redondeo `ninguno`, `abajo_50` o `abajo_100`. Los montos son de `@ed1/dinero` (`pesos(valor, campo)`, `formatearPesos()`): ninguna función de pesos propia.
- **CA2.** La tabla de casos de PARQUEADERO §9.3 (gracia exacta, minuto 0, medianoche, tres días con tope diario, nocturna que empieza y termina, tiquete perdido, abonado que vence en medio) y una prueba de propiedad: para duraciones de 1 minuto a 30 días, `total ≤ minutos × tope_por_minuto` cuando la ciudad tiene tope. La batería corre con `TZ=America/Bogota` y con `TZ=Pacific/Kiritimati`, el 31 de diciembre y el 29 de febrero de 2028.
- **CA3 ❌.** Una tarifa por encima del tope no se puede guardar y pone en rojo la prueba de propiedad. Un monto ilegible lanza `MontoIlegible` nombrando el campo: nunca vale 0. El tipo del redondeo no admite redondear hacia arriba.
- **Patrones en riesgo:** P1, P2, P8, P17.
- **Work items:** WI-Q1.1.1 `[código]` liquidación · WI-Q1.1.2 `[prueba]` tabla de casos · WI-Q1.1.3 `[prueba]` propiedad · WI-Q1.1.4 `[prueba]` husos y fechas · WI-Q1.1.5 `[doc]` nota en PARQUEADERO §9.

#### HU-Q1.2 · Los topes de cada ciudad como contenido, con su vencimiento
- **Capa:** contenido · **Prioridad:** Must · **Puntos:** 2 · **Sprint:** Q4 · **Depende de:** HU-Q1.1 · **Estado:** Hecha (PR #118): topes.json con Bogotá, esquema en el CI, tope de la ciudad en la tarifa y aviso a los 13 meses
- Como parqueadero de Bogotá, quiero que la caja sepa el tope vigente de mi ciudad y me avise cuando esté viejo, para no cobrar de más sin saberlo.
- **Respaldo:** PARQUEADERO §9.1 y §9.2 (regla 3); estudio §13.2; Decretos 026 y 027 de 2026 de Bogotá (*Norma*).
- **CA1.** `content/parqueadero/topes.json` con ciudad, norma, vigencia, tipo de vehículo, máximo por minuto y la regla del minuto iniciado. Bogotá desde el 30 ene 2026: COP 230 por minuto para carros y COP 161 para motos; 253 y 177 con sello de oro. Un esquema lo valida.
- **CA2.** La sede declara su tope, que no puede pasar del máximo de su ciudad. Si el tope de la ciudad tiene más de 13 meses, la cabecera avisa «El tope de Bogotá no está actualizado» y la caja sigue cobrando (P1, P15).
- **CA3 ❌.** Un `topes.json` con un valor no entero, sin norma o con una vigencia futura no pasa el CI. Con el reloj de la prueba 14 meses adelante, el aviso aparece; con 12, no.
- **Lo publicado (P10):** las cajas instaladas reciben el contenido nuevo con la versión siguiente; el runbook «Cambio anual de topes» (HU-Q6.2) dice cómo.
- **Patrones en riesgo:** P1, P8, P15, P18.
- **Work items:** WI-Q1.2.1 `[código]` contenido y esquema · WI-Q1.2.2 `[código]` aviso · WI-Q1.2.3 `[prueba]`.

#### HU-Q1.3 · `@ed1/parqueadero-schema` y el formato `parqueadero-export/1`
- **Capa:** paquete · **Prioridad:** Must · **Puntos:** 3 · **Sprint:** Q2 · **Depende de:** — · **Estado:** Hecha (PR #113): esquemas contra el SQL del anexo A y ejemplo guardado de `parqueadero-export/1`
- Como equipo, quiero un solo esquema de registros y catálogos para la caja, el respaldo y después la API, para que lo que la caja guarda hoy se pueda subir mañana sin traducirlo.
- **Respaldo:** PARQUEADERO §4.1, §5.2, §5.3 (regla 6) y anexo A (`ref_tipo_registro`); P10.
- **CA1.** Esquemas zod con versión para los registros (`entrada`, `salida`, `pago_abonado`, `anulacion`, `entrega_recibo`, `turno_apertura`, `turno_cierre`, `movimiento_caja`, `nota`) y los catálogos (sede, tarifa, abonado, ajustes del recibo). Los tipos y sus banderas (`lleva_numero`, `abre_estadia`, `pide_anula`) coinciden con `ref_tipo_registro` del anexo A, y una prueba lee el SQL y los compara.
- **CA2.** `parqueadero-export/1`: un JSON con versión, sede, catálogos, registros y la huella SHA-256 del contenido, más un CSV para Excel. Es el formato del respaldo de M0 y de la carga al reclamar en M1 (P2).
- **CA3 ❌.** Un registro sin `id` UUIDv7, sin serie o con un consecutivo no entero no pasa el esquema. Un ejemplo guardado de `parqueadero-export/1` hace fallar la prueba si alguien le quita un campo al esquema (contrato, P10).
- **Patrones en riesgo:** P2, P10, P18.
- **Work items:** WI-Q1.3.1 `[código]` esquemas · WI-Q1.3.2 `[código]` exportación · WI-Q1.3.3 `[prueba]` contra el SQL · WI-Q1.3.4 `[prueba]` contrato.

#### HU-Q1.4 · `@ed1/parqueadero-recibos`: un modelo y cuatro salidas con los campos de la ley
- **Capa:** paquete · **Prioridad:** Must · **Puntos:** 5 · **Sprint:** Q2 · **Depende de:** HU-Q1.3, HU-Q1.6 · **Estado:** Hecha (PR #113): papel, WhatsApp y pantalla con las maquetas de §6.2 y el anexo B
- Como conductor, quiero que el papel, el mensaje y la página de mi recibo digan lo mismo, y lo que la ley exige.
- **Respaldo:** ADR-33; PARQUEADERO §6.1, §6.2, §6.4, §6.6 y anexo B; Ley 1480 art. 18; Circular Única de la SIC; Decreto 461 de 2019 (la póliza, en Bogotá).
- **CA1.** `armarRecibo(registro, catálogos)` produce un `Recibo`, y de él salen el texto de papel a 32 columnas, el objeto del enlace (HU-Q1.5), el texto de WhatsApp (con `@ed1/whatsapp`) y la vista de pantalla. Cada salida lleva los campos que marca la tabla de PARQUEADERO §6.1, en entrada y en salida. Los montos, con `formatearPesos()`.
- **CA2.** La prueba de paridad: con recibos de entrada y de salida de Ensayo Uno y de Ensayo Dos, el papel, el enlace decodificado y el texto de WhatsApp dicen el mismo número, la misma placa, la misma hora y el mismo total. Ninguna línea de papel pasa de 32 columnas (bitácora parqueadero 3). Con la impresora marcada «transliterar», las tildes y la ñ salen como `a` y `n`, nunca como basura.
- **CA3 ❌.** Quitar el NIT de una plantilla, o la póliza de un recibo de una sede que la tiene, pone en rojo la prueba de campos. Una línea de 33 columnas pone en rojo la de ancho.
- **Patrones en riesgo:** P1, P2, P5, P17.
- **Work items:** WI-Q1.4.1 `[código]` modelo · WI-Q1.4.2 `[código]` cuatro salidas · WI-Q1.4.3 `[prueba]` campos de la ley · WI-Q1.4.4 `[prueba]` paridad · WI-Q1.4.5 `[prueba]` 32 columnas · WI-Q1.4.6 `[doc]` anexo B.

#### HU-Q1.5 · El enlace del recibo: forma completa y forma corta, con el formato de `@ed1/firma`
- **Capa:** paquete · **Prioridad:** Must · **Puntos:** 3 · **Sprint:** Q2 · **Depende de:** HU-Q1.4 · **Estado:** Hecha (PR #113): forma completa sin firma y forma corta; la firma llega con `@ed1/firma`
- Como conductor, quiero abrir mi recibo desde un enlace o un QR aunque el parqueadero no tenga internet, y que ese enlace funcione siempre.
- **Respaldo:** PARQUEADERO §6.3; ADR-33, ADR-36 (el formato) y ADR-40; P13; PT1.
- **CA1.** La forma completa, `https://parqueadero.laboratorio-digital.app/r/#1.<datos>`, lleva un JSON de claves cortas comprimido con deflate y en base64url, con el formato `datos[.firma.certificado]` del QR firmado del agro (`packages/trazabilidad`, ARQUITECTURA §5.9), que `@ed1/firma` hereda en HU-Q8.1. En M0 va sin firma. La forma corta, `#c.<número>.<placa>.<tipo>.<hora>`, es la del papel.
- **CA2.** Con el recibo de prueba de nombre y dirección largos de PARQUEADERO §6.3, la forma corta cabe en un QR de versión 7 con corrección L, y la completa sin firma en la versión 13. Una prueba lo exige.
- **CA3 ❌.** Un fragmento alterado (un byte cambiado, base64 roto o una versión desconocida) se decodifica como un error con su motivo, nunca como un recibo distinto. Una prueba guarda un enlace de cada versión del formato y exige que siga abriendo: el enlace es un contrato desde el primer recibo (plan §3.3).
- **Patrones en riesgo:** P10, P13, PT1.
- **Work items:** WI-Q1.5.1 `[código]` codificar y decodificar · WI-Q1.5.2 `[prueba]` tamaños de QR · WI-Q1.5.3 `[prueba]` alterados y versiones.

#### HU-Q1.6 · `@ed1/whatsapp`: números, texto y enlaces `wa.me` en un solo lugar
- **Capa:** paquete · **Prioridad:** Must · **Puntos:** 2 · **Sprint:** Q1 · **Depende de:** — · **Estado:** Hecha (PR #111)
- Como equipo, quiero un solo lugar para armar enlaces de WhatsApp, para que las reglas que las bitácoras pagaron caro no se repitan en cada producto.
- **Respaldo:** ADR-39 (los enlaces van a `packages/whatsapp`); PARQUEADERO §6.4, §8.1, §8.2 y §13.1; bitácora ecommerce, menores (el emoji al principio); bitácora parqueadero, «Afirmaciones falsas» 3.
- **CA1.** `normalizarNumero` da `573001234567` para `300 123 4567`, `+57 300 123 4567` y `573001234567`, y acepta otros países con su indicativo. `enlaceConNumero(numero, texto)` arma `https://wa.me/<numero>?text=…`, y `enlaceParaCompartir(texto)` arma `https://wa.me/?text=…`, la forma que ya usa el agro en sus tres copias.
- **CA2.** `encodeURIComponent` en un solo lugar, con prueba de tildes, `#`, `&` y saltos de línea. El enlace del recibo va en su propia línea, para que WhatsApp lo convierta en vínculo.
- **CA3 ❌.** Un texto que empieza con emoji, o un número que no se puede normalizar, lanza nombrando el problema: nunca arma un enlace a un número inventado.
- **Patrones en riesgo:** P1, P2.
- **Work items:** WI-Q1.6.1 `[código]` · WI-Q1.6.2 `[prueba]` · WI-Q1.6.3 `[doc]` lo que reciben la Tienda y el agro (plan §12).

### EQ2 · Impresión

#### HU-Q2.1 · Paso 0: medir la PT-210 con nRF Connect antes de escribir el adaptador
- **Capa:** campo · **Prioridad:** Must · **Puntos:** 1 · **Sprint:** Q0 · **Depende de:** D-Q8, o la PT-210 del cliente · **Estado:** Refinada
- Como equipo, quiero saber qué anuncia de verdad la PT-210 antes de escribir el adaptador, porque lo que se sabe del modelo viene de un SDK no oficial.
- **Respaldo:** PARQUEADERO §7.1 (el paso 0) y §7.4; bitácora core, terreno («una referencia se abre antes de copiarla»).
- **CA1.** `docs/parking/validacion/pt210-paso-0.md` con la fecha, el nombre que anuncia, los servicios GATT y sus características con sus propiedades (`write`, `writeWithoutResponse`, `notify`), y si empareja por Bluetooth clásico y con qué PIN.
- **CA2.** La autoprueba de la impresora (el botón al encender), en foto: firmware, página de códigos y lo que diga de Bluetooth.
- **CA3 ❌.** Si el servicio no está en la lista de PARQUEADERO §7.4, la lista se corrige en HU-Q2.3 antes de escribir código, y queda una entrada en la bitácora.
- **En el equipo real:** la PT-210 del equipo y un Android con nRF Connect. Se repite con la unidad del cliente en la demostración del 30 oct.
- **Patrones en riesgo:** P9, P16, P17.
- **Work items:** WI-Q2.1.1 `[campo]` nRF Connect · WI-Q2.1.2 `[campo]` autoprueba · WI-Q2.1.3 `[doc]` informe.

#### HU-Q2.2 · `@ed1/impresion`: el contrato, la cola y el codificador ESC/POS a 58 mm
- **Capa:** paquete · **Prioridad:** Must · **Puntos:** 5 · **Sprint:** Q1 · **Depende de:** — · **Estado:** Hecha (PR #111)
- Como equipo, quiero un paquete de impresión que no sepa nada de parqueaderos, para que la Tienda y el agro lo usen después sin cambiarlo.
- **Respaldo:** ADR-34; PARQUEADERO §7.3 y §15.4 (licencias).
- **CA1.** La interfaz `Impresora` y el tipo `Resultado` de PARQUEADERO §7.3, con `papel: 'desconocido'` como lo normal. Una cola por caja: un trabajo a la vez; el que falla queda en `entregas_pendientes` con su motivo.
- **CA2.** El codificador `@point-of-sale/receipt-printer-encoder` 4.x con el perfil `pos-5890`. El QR, con el comando nativo (`GS ( k`) o como imagen con `lean-qr`, según lo que diga la página de prueba. El adaptador `prueba` guarda los bytes en memoria, y los bytes de referencia de un recibo de Ensayo Uno quedan en el repositorio.
- **CA3 ❌.** Todo texto que viene de una persona pasa por el filtro de bytes de control: una nota con `ESC` o `GS` sale sin ellos, y la prueba lo hace con el byte puesto. El paquete no importa nada de `parqueadero-*` (guardia de repositorio). Una dependencia AGPL rompe el build.
- **Patrones en riesgo:** P2, P5, P17.
- **Work items:** WI-Q2.2.1 `[código]` contrato y cola · WI-Q2.2.2 `[código]` codificador y QR · WI-Q2.2.3 `[prueba]` bytes de referencia · WI-Q2.2.4 `[prueba]` filtro de control · WI-Q2.2.5 `[ci]` guardia de imports.

#### HU-Q2.3 · Imprimir por Web Bluetooth en la PT-210
- **Capa:** paquete y caja · **Prioridad:** Must · **Puntos:** 5 · **Sprint:** Q1 · **Depende de:** HU-Q2.1, HU-Q2.2 · **Estado:** Hecha en staging (PR #111 y #112): imprimió en la PT210L real el 7 oct; falta la matriz de HU-Q6.1
- Como cajero, quiero que el recibo salga de la PT-210 desde el teléfono sin instalar nada, para entregarlo en segundos.
- **Respaldo:** ADR-34; PARQUEADERO §7.2 y §7.4 (los pasos y la tabla de errores).
- **CA1.** «Conectar impresora», solo desde un toque, llama a `requestDevice` con `namePrefix: 'PT'` y la lista de servicios de PARQUEADERO §7.4 corregida por el paso 0; «Ver todos los equipos» repite con `acceptAllDevices`. La caja recorre los servicios y guarda en `impresora` el servicio y la característica que funcionaron.
- **CA2.** Envía en trozos de 180 bytes cada 30 ms con `writeValueWithoutResponse`; si el navegador rechaza uno, baja a 100 bytes y 50 ms, reintenta y lo recuerda. Mientras la caja siga abierta, reconecta con `gatt.connect()` antes de imprimir, sin selector, y escucha `gattserverdisconnected` para mostrarlo en la cabecera. La pantalla dice «Enviado a la impresora».
- **CA3.** Los errores del navegador salen con los textos de PARQUEADERO §7.4 y su acción: reintentar, enviar por WhatsApp o mostrar el QR. El diagnóstico (Ajustes › Impresora) se copia como texto para soporte.
- **CA4 ❌.** Con el adaptador falso que rechaza trozos de más de 100 bytes, el envío baja de tamaño y termina; con trozos fijos de 600 bytes, la prueba se ve en rojo. La caja nunca manda bytes para mantener despierta la impresora.
- **En el equipo real:** la PT-210 del equipo con el Android de referencia; después, con Windows y Chrome.
- **Patrones en riesgo:** P1, P15, P16, P17.
- **Work items:** WI-Q2.3.1 `[código]` vincular y descubrir · WI-Q2.3.2 `[código]` enviar y reconectar · WI-Q2.3.3 `[código]` errores y diagnóstico · WI-Q2.3.4 `[prueba]` adaptador falso · WI-Q2.3.5 `[campo]` matriz.

#### HU-Q2.4 · Imprimir por Web Serial: Bluetooth clásico en Android y el puerto COM en Windows
- **Capa:** paquete · **Prioridad:** Must (baja a Should si la caja del cliente es Android y la matriz muestra que Web Bluetooth reconecta bien; §4.4) · **Puntos:** 3 · **Sprint:** Q4 · **Depende de:** HU-Q2.1, HU-Q2.2 · **Estado:** Hecha (PR #118): adaptador Web Serial, «Usar la impresora emparejada» y la caja que la recupera al abrir; falta la matriz con la PT210L emparejada
- Como cajero, quiero que la caja vuelva a encontrar la impresora sola al abrir el turno, sin elegirla cada vez.
- **Respaldo:** ADR-34; PARQUEADERO §7.5.
- **CA1.** Con la PT-210 emparejada una vez en Android, `navigator.serial.requestPort()` la toma, y en la sesión siguiente `getPorts()` la devuelve sin selector. En Windows, abre el puerto COM que crea el emparejamiento.
- **CA2.** Como Android no avisa conexión ni desconexión, la caja reintenta al imprimir y dice si falló.
- **CA3 ❌.** Si el navegador no tiene `navigator.serial` (Firefox, un WebView, un iPhone), el camino no aparece y la caja dice por qué: nunca muestra un botón que no puede funcionar.
- **En el equipo real:** Android con Chrome 138 o posterior y Windows con Chrome o Edge. El resultado decide el camino principal en Android (PARQUEADERO §7.5).
- **Patrones en riesgo:** P16, P17, P20.
- **Work items:** WI-Q2.4.1 `[código]` adaptador · WI-Q2.4.2 `[prueba]` sin `serial` · WI-Q2.4.3 `[campo]` matriz.

#### HU-Q2.5 · El diálogo de impresión del sistema a 58 mm
- **Capa:** caja · **Prioridad:** Should · **Puntos:** 2 · **Sprint:** Q5 · **Depende de:** HU-Q1.4 · **Estado:** Hecha en staging (PR #126): la hoja HTML de 48 mm de `@ed1/impresion` (`htmlDeBloques`) y el adaptador `sistema`, que la pone en la página de la caja solo mientras imprime, en lugar de una ruta `/caja/imprimir/` (la CSP no deja enmarcar otra página); `@page` sin `size`, porque `58mm auto` no es CSS válido (bitácora, afirmaciones falsas 5); el acceso directo con `--kiosk-printing` en la puesta en marcha. Falta probarlo en Windows con el driver POS58 (WI-Q2.5.3)
- Como parqueadero con un PC y la PT-210 por USB, quiero imprimir desde el diálogo normal de Windows; y cualquiera, imprimir un reporte en una impresora común.
- **Respaldo:** PARQUEADERO §7.5 (el diálogo del sistema y `--kiosk-printing`).
- **CA1.** `/caja/imprimir/` muestra el mismo recibo en HTML a 48 mm, con `@page { size: 58mm auto; margin: 0 }` y el QR en SVG, y llama a `window.print()`.
- **CA2.** El runbook de puesta en marcha explica el acceso directo de Chrome con `--kiosk-printing`, para no ver el diálogo en cada recibo.
- **CA3 ❌.** El recibo en HTML pasa la misma prueba de campos de la ley que el de papel: es otra salida del mismo modelo, no una plantilla aparte.
- **En el equipo real:** Windows con el driver POS58 y la PT-210 por USB.
- **Patrones en riesgo:** P2, P16.
- **Work items:** WI-Q2.5.1 `[código]` · WI-Q2.5.2 `[prueba]` campos · WI-Q2.5.3 `[campo]` Windows.

#### HU-Q2.6 · El asistente de la impresora y su página de prueba
- **Capa:** caja · **Prioridad:** Must · **Puntos:** 3 · **Sprint:** Q1 · **Depende de:** HU-Q2.2, HU-Q2.3, HU-Q3.1 · **Estado:** Hecha en staging (PR #111 y #112): página de prueba en la PT210L real el 7 oct
- Como cajero, quiero configurar la impresora en cuatro pasos y saber si las tildes y el QR salen bien, antes del primer cliente.
- **Respaldo:** PARQUEADERO §7.7 y §6.2.
- **CA1.** Cuatro pasos. El equipo: la caja mira si hay `bluetooth`, `serial` o es un iPhone, y propone el camino (en iPhone lo dice desde el principio). Vincular. La página de prueba de PARQUEADERO §7.7: la regla de 32 columnas, las cuatro líneas de páginas de códigos y el QR nativo y el de imagen. Y tres preguntas al operador.
- **CA2.** Las respuestas quedan en `impresora`: la página de códigos o transliterar, QR nativo o imagen, y las columnas. Sin la prueba superada, la cabecera dice «Impresora sin probar» en amarillo.
- **CA3 ❌.** Si el operador dice que ninguna línea con tildes se ve bien, la caja translitera y lo dice en Ajustes: nunca imprime basura.
- **Boceto:** una pantalla por paso, con «Siguiente» grande abajo. En el paso 4, cada pregunta con sus opciones como botones («Línea 1», «Línea 2»…) y la indicación «Mire el papel que acaba de salir».
- **En el equipo real:** la PT-210 del equipo con Android y con Windows.
- **Patrones en riesgo:** P1, P15, P16.
- **Work items:** WI-Q2.6.1 `[diseño]` boceto · WI-Q2.6.2 `[código]` asistente · WI-Q2.6.3 `[prueba]` transliterar · WI-Q2.6.4 `[campo]`.

### EQ3 · Caja

#### HU-Q3.1 · La caja instalable en `/caja/`, sin red
- **Capa:** caja · **Prioridad:** Must · **Puntos:** 3 · **Sprint:** Q1 · **Depende de:** HU-Q5.1, HU-C6.1 (fusionada) · **Estado:** Hecha en staging (PR #111): JS inicial de 47 KB con gzip; falta instalarla en el Android de referencia
- Como cajero, quiero instalar la caja en el teléfono como una app y que abra sin internet.
- **Respaldo:** ADR-32; PARQUEADERO §4.1, §5.2 y §5.3.
- **CA1.** Preact, Dexie y Workbox dentro de `apps/parqueadero-sitio`, en `/caja/`. Se instala desde Chrome en Android y en Windows, y abre en modo avión después de la primera carga.
- **CA2.** Pide almacenamiento persistente (`navigator.storage.persist()`) y, si el navegador no lo concede, la cabecera lo dice. La cabecera tiene sus cuatro señales desde el primer día (plan §5.1), aunque digan «sin configurar».
- **CA3 ❌.** Una versión nueva no recarga la caja mientras haya un formulario abierto o una impresión en curso: la prueba la publica en medio de una entrada. Un JavaScript inicial de más de 80 KB con gzip pone el CI en rojo; el tope se ajusta con la primera medición, no con un deseo (P19).
- **En el equipo real:** instalar en el Android de referencia y en Windows; abrir en modo avión.
- **Patrones en riesgo:** P10, P15, P19, P20.
- **Work items:** WI-Q3.1.1 `[código]` PWA · WI-Q3.1.2 `[código]` cabecera · WI-Q3.1.3 `[prueba]` actualización en medio de una entrada · WI-Q3.1.4 `[ci]` presupuesto de JS.

#### HU-Q3.2 · Sede, tarifas y PIN: nada se registra sin los datos legales
- **Capa:** caja · **Prioridad:** Must · **Puntos:** 3 · **Sprint:** Q2 · **Depende de:** HU-Q1.1, HU-Q1.3 · **Estado:** Hecha (PR #113): ajustes, PIN y e2e de la tarifa sobre el tope
- Como propietario, quiero configurar mi parqueadero una vez y que la caja no me deje entregar un recibo incompleto.
- **Respaldo:** PARQUEADERO §5.1 (Ajustes) y §6.1 (ningún valor de fábrica); bitácora ecommerce, crítico («el celular de la primera tienda»).
- **CA1.** Primer uso: los datos legales de la sede (nombre, NIT, dirección, teléfono, póliza si la tiene, registro), las tarifas por tipo de vehículo con su tope, y el PIN de administrador. Después, todo lo que toca dinero o textos legales pide el PIN.
- **CA2.** Mientras falte un dato legal obligatorio, «Entrada» dice qué falta y lleva al campo: «Antes del primer recibo falta: el NIT y la póliza».
- **CA3 ❌.** Ningún campo trae un valor de fábrica: una prueba recorre los ajustes vacíos y exige que el recibo no se pueda armar. Una tarifa por encima del tope no se guarda, y la caja dice por qué.
- **Boceto:** un formulario en una columna, en tres grupos (Su parqueadero, Tarifas, Seguridad), con «Guardar» abajo y lo que falta en rojo junto a cada campo.
- **Patrones en riesgo:** P1, P6, P15.
- **Work items:** WI-Q3.2.1 `[diseño]` · WI-Q3.2.2 `[código]` primer uso y ajustes · WI-Q3.2.3 `[código]` PIN · WI-Q3.2.4 `[prueba]` sin valores de fábrica.

#### HU-Q3.3 · La entrada en menos de 10 segundos, con su recibo impreso
- **Capa:** caja · **Prioridad:** Must · **Puntos:** 5 · **Sprint:** Q2 · **Depende de:** HU-Q3.2, HU-Q1.4, HU-Q1.5, HU-Q2.3 · **Estado:** Hecha (PR #113): entrada, recibo y e2e sin impresora y sin red; falta cronometrar en el equipo real
- Como cajero, quiero registrar un carro y entregarle el recibo antes de que se forme fila.
- **Respaldo:** PARQUEADERO §5.1 (Entrada), §5.3 (reglas 1 y 2), §5.4 y §5.5; ADR-15; bitácora parqueadero 8.
- **CA1.** Teclado de placa propio, en mayúsculas y sin espacios. `ABC123` propone carro y `ABC12D` moto; una placa fuera de patrón se acepta con una confirmación. Estado: «Sin novedad» o la lista corta (rayón, golpe, vidrio, espejo, llanta, otro) con la parte y una nota. Fotos opcionales, comprimidas en el navegador a WebP de unos 100 KB, o a JPEG donde el navegador no produce WebP, guardadas en `fotos` con su estadía.
- **CA2.** «Registrar» guarda en una sola transacción de IndexedDB el registro, el consecutivo (`A-000123`) y la estadía abierta, y abre la pantalla del recibo. Si la sede imprime siempre y la impresora está conectada, el recibo sale solo. Medido en la PT-210 con el Android de referencia: de la placa al papel en la mano, 10 segundos o menos.
- **CA3.** Si la placa ya tiene una estadía abierta, lo dice y no crea otra. Desde HU-Q3.11, si es de un abonado vigente, lo marca.
- **CA4 ❌.** Con la impresora apagada, el registro existe igual y la entrega queda en `entregas_pendientes`. Una transacción que falla no gasta número: dos fallos seguidos y una entrada buena dan consecutivos sin hueco. Un `toBlob` que devuelve PNG, como Safari, guarda un JPEG con su formato real.
- **Boceto:** la placa grande arriba con su teclado; el tipo en dos botones; «Sin novedad» marcado y «Agregar novedad»; el WhatsApp del conductor, opcional (HU-Q4.1); «Registrar» abajo, a todo lo ancho.
- **En el equipo real:** el Android de referencia con la PT-210, cronometrado; la foto en un iPhone.
- **Patrones en riesgo:** P1, P8, P16, P17.
- **Work items:** WI-Q3.3.1 `[diseño]` · WI-Q3.3.2 `[código]` teclado y formulario · WI-Q3.3.3 `[código]` transacción y consecutivo · WI-Q3.3.4 `[código]` fotos · WI-Q3.3.5 `[prueba]` sin hueco y sin impresora · WI-Q3.3.6 `[campo]` cronómetro.

#### HU-Q3.4 · Estadías abiertas: buscar por placa o por el QR del recibo
- **Capa:** caja · **Prioridad:** Must · **Puntos:** 2 · **Sprint:** Q3 · **Depende de:** HU-Q3.3 · **Estado:** Hecha (PR #114): lista, búsqueda, escáner con `BarcodeDetector` o jsQR, y QR de otra caja, de una estadía cerrada o cualquiera; falta leer el papel con la cámara del Android
- Como cajero, quiero encontrar el carro que sale en un segundo, por su placa o escaneando su recibo.
- **Respaldo:** PARQUEADERO §5.1 (Salida, punto 1, y estadías abiertas) y §6.3 (la forma corta sirve para buscar).
- **CA1.** El inicio muestra las estadías abiertas por hora de entrada, con el tiempo corriendo, y un buscador por placa que filtra al escribir, sin red.
- **CA2.** «Escanear» lee el QR del papel (forma corta) o el del teléfono del conductor (forma completa) con `BarcodeDetector`, y con una librería MIT o Apache-2.0 donde el navegador no lo tenga (se comprueba en Windows). Abre la salida de esa estadía.
- **CA3 ❌.** Un QR de otro parqueadero, o de una estadía ya cerrada, dice qué es y no abre una salida. `estadias` se reconstruye desde `registros`, y una prueba lo hace con la tabla borrada.
- **En el equipo real:** escanear el papel de la PT-210 con el Android y con la cámara del PC.
- **Patrones en riesgo:** P1, P2, P17.
- **Work items:** WI-Q3.4.1 `[código]` lista y buscador · WI-Q3.4.2 `[código]` escáner · WI-Q3.4.3 `[prueba]` reconstrucción · WI-Q3.4.4 `[campo]`.

#### HU-Q3.5 · La salida y el cobro
- **Capa:** caja · **Prioridad:** Must · **Puntos:** 5 · **Sprint:** Q3 · **Depende de:** HU-Q3.4, HU-Q1.1 · **Estado:** Hecha (PR #114): cobro con los cuatro medios, cambio, tiquete perdido, QR de pagos y cotización de 10 minutos
- Como cajero, quiero cobrar lo correcto, con el detalle a la vista, y entregar el recibo de salida.
- **Respaldo:** PARQUEADERO §5.1 (Salida) y §9.
- **CA1.** La liquidación con su detalle (minutos, tarifa, gracia, tope y redondeo) sale de `parqueadero-tarifas`.
- **CA2.** El medio de pago: efectivo, con lo recibido y el cambio; QR o transferencia del propio parqueadero, con su imagen en pantalla (ED1 no toca el dinero); datáfono; abonado; y cortesía con motivo. «Cobrar» guarda la salida con su consecutivo y abre la pantalla del recibo de salida.
- **CA3.** El tiquete perdido es un caso de la liquidación: el cobro configurado y una nota de identificación.
- **CA4 ❌.** Una cortesía sin motivo no se guarda. Un efectivo recibido menor que el total no deja cobrar. Un total por encima del tope no puede salir: lo garantiza HU-Q1.1, y aquí una e2e lo intenta.
- **Boceto:** arriba, la placa y el tiempo; en el centro, el total en grande con el detalle plegado; abajo, los medios de pago como botones grandes y «Cobrar».
- **Patrones en riesgo:** P1, P2.
- **Work items:** WI-Q3.5.1 `[diseño]` · WI-Q3.5.2 `[código]` · WI-Q3.5.3 `[prueba]` e2e con los dos parqueaderos.

#### HU-Q3.6 · La pantalla del recibo: QR, «No salió» y copias
- **Capa:** caja · **Prioridad:** Must · **Puntos:** 3 · **Sprint:** Q3 · **Depende de:** HU-Q3.3, HU-Q1.5 · **Estado:** Hecha (PR #114): «No salió», «COPIA n», QR en pantalla confirmado; cada entrega con su camino y su resultado
- Como cajero, quiero en una pantalla todas las formas de entregar el recibo; como conductor, llevármelo sin papel y sin dar mi número.
- **Respaldo:** PARQUEADERO §5.1 (la pantalla del recibo), §6.5 y §7.6.
- **CA1.** Cuatro acciones: Imprimir, Enviar por WhatsApp (HU-Q4.1), Mostrar QR (la forma completa, en grande, para que el conductor la escanee con su cámara) y Reimprimir.
- **CA2.** Cada entrega es un registro `entrega_recibo` con el canal (`papel`, `whatsapp` o `pantalla`), el camino, el resultado y si es copia, sin teléfono ni texto. «Reimprimir» sale con «COPIA n» arriba; «No salió» reimprime el original sin marca de copia y registra el fallo anterior. El QR en pantalla cuenta como entrega digital solo si el operador confirma que el conductor lo escaneó.
- **CA3 ❌.** Un recibo nunca se marca «Impreso»: dice «Enviado a la impresora». Una copia sin «COPIA» pone en rojo la prueba de bytes.
- **Boceto:** el número del recibo y la placa arriba; los cuatro botones en una cuadrícula de dos por dos; abajo, el estado de cada entrega («Enviado a la impresora», «Abierto en WhatsApp. ¿Se envió?»).
- **Patrones en riesgo:** P1, P17; el candidato a PQ1 de la bitácora.
- **Work items:** WI-Q3.6.1 `[diseño]` · WI-Q3.6.2 `[código]` · WI-Q3.6.3 `[prueba]` copias y «No salió».

#### HU-Q3.7 · Anular sin borrar
- **Capa:** caja · **Prioridad:** Must · **Puntos:** 2 · **Sprint:** Q4 · **Depende de:** HU-Q3.5 · **Estado:** Hecha (PR #118): anulación con motivo, operador y PIN; la guardia sin-borrar ve `registros` y lo que los reescribe
- Como propietario, quiero que un error se corrija con una anulación que deja rastro, no borrando, para que el cierre de turno sea creíble.
- **Respaldo:** PARQUEADERO §10.2 (registros inmutables), §11.2 y §13.1; P21.
- **CA1.** Anular una entrada o una salida crea un registro `anulacion` con el motivo, el operador y el id de lo anulado, y pide el PIN de administrador en M0. Una entrada anulada cierra su estadía; una salida anulada la reabre.
- **CA2.** El cierre de turno cuenta las anulaciones por operador.
- **CA3 ❌.** Ningún código de la caja borra ni reescribe un registro existente. La guardia `sin-borrar` del repositorio se extiende a la tabla `registros` de Dexie (hoy su expresión `\bregistro\b` no ve el plural), con su control negativo: un `registros.delete` puesto a propósito la pone en rojo.
- **Patrones en riesgo:** P5, P21.
- **Work items:** WI-Q3.7.1 `[código]` · WI-Q3.7.2 `[ci]` guardia extendida · WI-Q3.7.3 `[prueba]` reabrir y cerrar estadías.

#### HU-Q3.8 · La hora del teléfono, comparada con la del servidor
- **Capa:** caja · **Prioridad:** Must · **Puntos:** 1 · **Sprint:** Q4 · **Depende de:** HU-Q3.1 · **Estado:** Hecha (PR #118): HEAD a /sitio.css con no-store; corrida más de 2 minutos, en rojo
- Como conductor, quiero que la hora de mi recibo sea la verdadera, porque de ella sale lo que pago.
- **Respaldo:** PARQUEADERO §5.6; P8; el `reloj-corrido` del cuaderno; P7.
- **CA1.** Con red, la caja lee la cabecera `Date` del sitio con `fetch(…, { cache: 'no-store' })`. Si la diferencia pasa de 2 minutos, avisa en rojo y pide corregir la hora del teléfono; no la corrige en silencio.
- **CA2.** Las fechas impresas se calculan con UTC−5 fijo y sin `Intl`.
- **CA3 ❌.** Sin `cache: 'no-store'`, una respuesta guardada esconde el reloj corrido: la prueba quita la opción y se ve en rojo (P7).
- **Patrones en riesgo:** P7, P8, P17.
- **Work items:** WI-Q3.8.1 `[código]` · WI-Q3.8.2 `[prueba]` reloj corrido y caché.

#### HU-Q3.9 · El turno: apertura, cierre con conteo y cierre impreso
- **Capa:** caja · **Prioridad:** Must · **Puntos:** 5 · **Sprint:** Q4 · **Depende de:** HU-Q3.5, HU-Q3.7 · **Estado:** Hecha (PR #118): apertura, movimientos, conteo por denominación y cierre impreso del anexo B; falta compararlo en la PT-210
- Como cajero, quiero abrir y cerrar mi turno con la plata contada y un papel que lo pruebe, para entregar la caja sin discusiones.
- **Respaldo:** PARQUEADERO §5.1 (Turno) y anexo B (el cierre a 32 columnas); estudio §16.3 (cuadre).
- **CA1.** La apertura lleva el nombre del operador y la base de caja (`turno_apertura`). El cierre lleva el conteo del efectivo, lo esperado (calculado en el dispositivo), la diferencia y su motivo (`turno_cierre`). En medio, los movimientos de caja con su motivo (`movimiento_caja`).
- **CA2.** El cierre impreso en la PT-210, con la maqueta del anexo B, trae entradas, salidas, total por medio de pago, diferencia, anulaciones y copias por operador, y la versión de la caja. Al cerrar, ofrece el respaldo (HU-Q3.10).
- **CA3.** Un turno sigue abierto aunque se cierre la app, y al volver la caja lo retoma.
- **CA4 ❌.** Un cierre con diferencia y sin motivo no se guarda. Una entrada sin turno abierto obliga a abrirlo antes: ningún registro queda fuera de un turno.
- **Boceto:** el conteo por denominación con el total en grande; lo esperado y la diferencia debajo, en verde o en rojo con su número; «Cerrar e imprimir» abajo.
- **En el equipo real:** el cierre impreso en la PT-210, comparado con la maqueta del anexo B.
- **Patrones en riesgo:** P1, P8, P15.
- **Work items:** WI-Q3.9.1 `[diseño]` · WI-Q3.9.2 `[código]` apertura y cierre · WI-Q3.9.3 `[código]` cierre impreso · WI-Q3.9.4 `[prueba]` cuadre y diferencias · WI-Q3.9.5 `[campo]`.

#### HU-Q3.10 · Respaldo en archivo y restauración que une
- **Capa:** caja · **Prioridad:** Must · **Puntos:** 3 · **Sprint:** Q4 · **Depende de:** HU-Q1.3, HU-Q3.9 · **Estado:** Hecha (PR #118): respaldo compartido o descargado y restauración que une; falta compartir a Drive y restaurar en un segundo teléfono
- Como propietario, quiero guardar todo lo de la caja en un archivo al cerrar el turno y poder cargarlo en otro teléfono, para no perder el parqueadero si se pierde el teléfono.
- **Respaldo:** PARQUEADERO §5.3 (regla 6) y §2.2; bitácora ecommerce 77 (restaurar une, nunca reemplaza); P21; bitácora parqueadero 8.
- **CA1.** «Respaldo» arma un `parqueadero-export/1` con su CSV y los comparte con `navigator.share` (correo o Drive) o los descarga. La cabecera dice la fecha del último respaldo.
- **CA2.** «Restaurar» lee el archivo, verifica su huella y **une**: agrega por id lo que no está, sin tocar lo que ya hay, y dice cuántos registros agregó y cuántos ya estaban.
- **CA3.** **Las fotos no van en el archivo:** viven en el dispositivo hasta M2 (HU-Q8.3), porque las de unas semanas ya pasan del límite de adjuntos de un correo (*Inferencia*: unos 100 KB por foto). La pantalla del respaldo lo dice.
- **CA4 ❌.** Un archivo alterado, de otra sede o de una versión desconocida se rechaza entero, sin tocar lo local. Restaurar un respaldo viejo encima de una caja con registros nuevos no borra ninguno.
- **En el equipo real:** compartir al correo y a Drive desde el Android; restaurar en un segundo teléfono.
- **Patrones en riesgo:** P1, P21.
- **Work items:** WI-Q3.10.1 `[código]` respaldo · WI-Q3.10.2 `[código]` restaurar · WI-Q3.10.3 `[prueba]` unir y rechazar · WI-Q3.10.4 `[campo]`.

#### HU-Q3.11 · Abonados por placa
- **Capa:** caja · **Prioridad:** Should · **Puntos:** 2 · **Sprint:** Q5 · **Depende de:** HU-Q3.3, HU-Q3.5 · **Estado:** Hecha (PR #124): abonados con PIN, la placa marcada al entrar, la salida en 0 como «abonado» con «Abonado hasta» en el papel, WhatsApp y pantalla, y el vencido como visitante, dicho. `/r/` dice solo «abonado»: el enlace v1 no lleva la fecha
- Como cajero, quiero que la caja reconozca a los abonados por su placa y no les cobre la salida.
- **Respaldo:** PARQUEADERO §2.2 y §5.1 (entrada, punto 3); bitácora parqueadero 7 (las mensualidades con cobro son M2).
- **CA1.** Un catálogo de abonados con nombre o alias, placas, vigencia (desde y hasta) y nota, que solo cambia el administrador con su PIN.
- **CA2.** En la entrada, una placa de un abonado vigente se marca. En la salida, el medio de pago es «abonado», el total es 0 y el recibo dice «Abonado hasta <fecha>».
- **CA3 ❌.** Un abonado vencido liquida como visitante, y la caja lo dice. **La caja no guarda el WhatsApp del abonado en M0** (ADR-38): eso llega con las mensualidades de M2 (HU-Q8.4).
- **Patrones en riesgo:** P8, P13.
- **Work items:** WI-Q3.11.1 `[código]` · WI-Q3.11.2 `[prueba]` vigente y vencido.

### EQ4 · WhatsApp y recibo digital

#### HU-Q4.1 · Enviar por WhatsApp con autorización, sin esperar a la red
- **Capa:** caja · **Prioridad:** Must · **Puntos:** 5 · **Sprint:** Q3 · **Depende de:** HU-Q1.6, HU-Q1.4, HU-Q3.6, HU-Q4.4 · **Estado:** Hecha (PR #114): número y casilla, enlace sin `await`, `contactos` con borrado a 24 h y número reusado en la salida. El borrado al anular llega con HU-Q3.7: la anulación pone `borrar_en` en ese instante. Falta la matriz con los dos números reales
- Como conductor, quiero recibir mi recibo en mi WhatsApp en el momento en que me lo imprimen; como parqueadero, enviarlo desde mi número sin pagar nada.
- **Respaldo:** ADR-35 y ADR-38; PARQUEADERO §8.1 a §8.3 y §13.2; Ley 1581 arts. 3, 9 y 12; Decreto 1377 art. 7.
- **CA1.** En la entrada y en la pantalla del recibo: el número del conductor, normalizado por `@ed1/whatsapp`, y la casilla **sin marcar** con el texto que el operador lee: «¿Autoriza que le enviemos sus recibos de hoy por WhatsApp a este número?». Sin número o sin autorización, el botón dice qué falta.
- **CA2.** El enlace `wa.me` se arma al registrar, sin red, y **el toque solo navega**: ningún `await` entre el toque y la apertura, y una prueba lo exige. Al volver, la entrega queda `abierto_en_whatsapp`, con «No se envió» para corregirla. Imprimir no espera a WhatsApp, ni WhatsApp al papel.
- **CA3.** El número vive solo en `contactos`, con la hora, el operador y la versión del aviso, y se borra 24 h después de la salida o al anular la estadía. El recibo de salida usa el número de la entrada mientras la autorización siga vigente (PARQUEADERO §8.4, empujón 1).
- **CA4 ❌.** El número no aparece en `registros`, en el respaldo, en los eventos ni en la consola: una prueba lo busca en todos. Con el reloj movido 25 h después de una salida, el número ya no está. Una casilla marcada de fábrica pone la prueba en rojo.
- **Boceto:** bajo la placa, «WhatsApp del conductor (opcional)» con un teclado numérico, y debajo la casilla con su texto. En la pantalla del recibo, el botón grande «Enviar por WhatsApp».
- **En el equipo real:** con los dos números de prueba: el Android con WhatsApp Business del parqueadero (y WhatsApp normal instalado al lado), Windows con WhatsApp Desktop, y el iPhone; y en modo avión.
- **Patrones en riesgo:** P1, P13, P16, P17, P20.
- **Work items:** WI-Q4.1.1 `[diseño]` · WI-Q4.1.2 `[código]` número y autorización · WI-Q4.1.3 `[código]` enlace y entrega · WI-Q4.1.4 `[código]` borrado a 24 h · WI-Q4.1.5 `[prueba]` sin `await` · WI-Q4.1.6 `[prueba]` el número no se filtra · WI-Q4.1.7 `[campo]` matriz.

#### HU-Q4.2 · La página del recibo `/r/`
- **Capa:** sitio · **Prioridad:** Must · **Puntos:** 3 · **Sprint:** Q3 · **Depende de:** HU-Q1.5, HU-Q5.2 · **Estado:** Hecha (PR #114): `/r/` estática, sin API, sin placa en lo servido y a prueba de HTML en el nombre. En staging los recibos enlazan a la `/r/` de staging; el dominio llega con HU-Q5.2
- Como conductor, quiero abrir mi recibo desde el enlace de WhatsApp o desde el QR, sin cuenta y aunque el parqueadero no tenga internet.
- **Respaldo:** PARQUEADERO §6.3; Ley 527 art. 6; P13; PT1.
- **CA1.** Una página estática lee el fragmento y muestra el recibo completo con «Copia digital del recibo», sin sello verde en M0. La forma corta muestra el número, la placa y la hora, y explica cómo pedir la copia completa.
- **CA2.** Cero llamadas a una API al abrir. La vista previa del enlace en WhatsApp es genérica («Recibo de parqueadero»): ni la placa ni el número van en las etiquetas Open Graph. CSP `'self'`, sin terceros.
- **CA3 ❌.** Un fragmento alterado o de una versión desconocida muestra «No pudimos leer este recibo», nunca un recibo a medias. Una prueba busca la placa en el HTML servido y en las etiquetas de la vista previa, y no la encuentra.
- **En el equipo real:** el QR del papel leído por tres teléfonos distintos, entre ellos un iPhone.
- **Patrones en riesgo:** P10, P13, P20.
- **Work items:** WI-Q4.2.1 `[diseño]` · WI-Q4.2.2 `[código]` · WI-Q4.2.3 `[prueba]` sin placa en lo servido · WI-Q4.2.4 `[campo]` tres teléfonos.

#### HU-Q4.3 · El ajuste `papel`: siempre, o salvo recibo digital
- **Capa:** caja · **Prioridad:** Must · **Puntos:** 2 · **Sprint:** Q4 · **Depende de:** HU-Q4.1, HU-Q3.6 · **Estado:** Hecha (PR #118): `papel` siempre o salvo_digital, sin «nunca»; las sedes de antes conservan su ajuste
- Como propietario, quiero dejar de imprimir cuando el conductor ya tiene su recibo digital, sin dejar a nadie sin recibo.
- **Respaldo:** PARQUEADERO §8.4 (la tabla del ajuste); Ley 1480 art. 18; Ley 527 art. 6; D-Q9.
- **CA1.** El ajuste de la sede `papel`: `siempre` imprime al registrar y ofrece lo digital además; `salvo_digital` pregunta «¿Recibo por WhatsApp o en papel?», con WhatsApp primero, e imprime salvo que el conductor haya recibido el digital (WhatsApp abierto, o QR escaneado y confirmado).
- **CA2.** El pie del papel dice «Pida su recibo por WhatsApp».
- **CA3 ❌.** No existe un valor «nunca imprimir»: el tipo no lo admite y una prueba lo intenta. Con `salvo_digital` y «No se envió», la caja imprime.
- **Patrones en riesgo:** P1, P17.
- **Work items:** WI-Q4.3.1 `[código]` · WI-Q4.3.2 `[prueba]`.

#### HU-Q4.4 · El aviso de privacidad antes del primer número
- **Capa:** legal · **Prioridad:** Must · **Puntos:** 2 · **Sprint:** Q3 · **Depende de:** HU-Q3.2 · **Estado:** Hecha (PR #114): plantillas en `content/parqueadero/privacidad/aviso.json`, aceptación en la sede con su versión, impresión en la PT-210 y en hoja carta, y la frase «sin cuenta» en un solo lugar
- Como parqueadero, Responsable de los datos, quiero el aviso de privacidad y la política listos antes de pedirle a nadie su número.
- **Respaldo:** PARQUEADERO §8.3 y §13.2 (en M0 el parqueadero es el Responsable y ED1 no recibe datos); Ley 1581 art. 12.
- **CA1.** `content/parqueadero/privacidad/` con la plantilla del aviso y de la política para el parqueadero: la finalidad (solo los recibos de esa estadía), los derechos, el canal de consultas, el borrado a las 24 h y que el chat queda en el WhatsApp del parqueadero, que lo administra.
- **CA2.** La caja no deja guardar el primer número hasta que la sede acepta el aviso con su versión. El aviso se imprime en la PT-210 o en una hoja carta, para ponerlo a la vista.
- **CA3 ❌.** «Sus datos no salen de este teléfono» solo se dice en una caja sin cuenta (estudio §13.5), y el texto vive en un solo lugar: una prueba lo busca en el resto del código.
- **Patrones en riesgo:** P2, P18.
- **Work items:** WI-Q4.4.1 `[doc]` plantillas · WI-Q4.4.2 `[código]` aceptación y versión · WI-Q4.4.3 `[prueba]`.

#### HU-Q4.5 · El texto de responsabilidad del recibo de entrada, editable por la sede
- **Capa:** caja · **Prioridad:** Must · **Puntos:** 2 · **Sprint:** Q5 · **Depende de:** HU-Q1.4, HU-Q1.5 · **Estado:** Hecha (PR #133): el campo en Ajustes con la sugerencia de la ley, el texto en papel, pantalla y enlace (versión 2); en producción con la `0.2.0`
- Como propietario, quiero que el recibo de entrada diga lo que dice mi talonario (por ejemplo, «después de 45 días el parqueadero no se hace responsable»), partiendo del texto que sugiere la ley.
- **Respaldo:** pedido del dueño del 8 oct 2026, con el recibo original del parqueadero cero; Ley 1480 art. 18; estudio §13.1.
- **CA1.** Ajustes › Recibo trae «Texto de responsabilidad», con la sugerencia de la ley ya escrita. Lo que la sede guarde sale en la entrada por los cuatro caminos (papel, enlace, mensaje y pantalla); vacío, vuelve la sugerencia.
- **CA2.** Un recibo con el texto de la ley lleva el mismo enlace de siempre (versión 1); uno con texto propio lleva la versión 2, y la página `/r/` lee las dos.
- **CA3 ❌.** Un texto de más de 200 letras no se guarda, y un enlace de versión 2 alterado se lee como un error, nunca como otro recibo.
- **Patrones en riesgo:** P2, P18.
- **Work items:** WI-Q4.5.1 `[código]` · WI-Q4.5.2 `[prueba]`.

### EQ5 · Sitio, dominio, despliegue y medición

#### HU-Q5.1 · El sitio en staging con HTTPS
- **Capa:** despliegue · **Prioridad:** Must · **Puntos:** 2 · **Sprint:** Q1 · **Depende de:** — · **Estado:** Hecha (PR #111): staging se despliega al fusionar a `main`
- Como equipo, quiero el sitio y la caja en staging con HTTPS desde la primera semana, porque Web Bluetooth y el service worker no funcionan sin un contexto seguro.
- **Respaldo:** ADR-32; PARQUEADERO §4.1 y §7.2.
- **CA1.** `apps/parqueadero-sitio` (Astro con islas Preact) se despliega desde el CI como assets estáticos a un Worker de staging en `workers.dev`.
- **CA2.** En staging, cada recibo lleva «PRUEBA» en su primera línea y la cabecera lo dice: ningún recibo de staging se entrega a un conductor real.
- **CA3 ❌.** La prueba de humo de staging comprueba que `/caja/` responde con su service worker y su CSP; un despliegue de staging no tiene credenciales de producción.
- **Patrones en riesgo:** P11, P16.
- **Work items:** WI-Q5.1.1 `[infra]` Worker de staging · WI-Q5.1.2 `[ci]` despliegue · WI-Q5.1.3 `[prueba]` humo.

#### HU-Q5.2 · `parqueadero.laboratorio-digital.app` declarado, reservado y en producción
- **Capa:** despliegue · **Prioridad:** Must · **Puntos:** 2 · **Sprint:** Q3 · **Depende de:** D-Q4, HU-Q5.1 · **Estado:** Hecha (PR #120): el dueño confirmó el 7 oct la zona activa (registrada en Cloudflare, vence el 3 oct 2027) y el permiso «Workers Routes» del token de producción. Producción sale sola con la `0.1.0`
- Como conductor, quiero que el enlace de mi recibo siga funcionando dentro de años; como dueño, que ninguna tienda tome el nombre del parqueadero.
- **Respaldo:** ADR-40 y ADR-27; PARQUEADERO §2.3 (punto 4) y §20.2; `infrastructure/dominios.json`.
- **CA1.** `dominios.json` declara `parqueadero.laboratorio-digital.app` y agrega `parqueadero` a `reservados_app.proyecto`. La zona está activa y el Worker de producción responde en el host con HTTPS.
- **CA2.** La prueba de humo de producción abre `/caja/` y `/r/` en el dominio público.
- **CA3 ❌.** Ningún recibo de producción lleva un enlace de `workers.dev`: una prueba arma un recibo con la configuración de producción y busca el host. Si la zona no está activa, el despliegue a producción falla en vez de caer a `workers.dev` (P1).
- **Patrones en riesgo:** P1, P11, P16.
- **Work items:** WI-Q5.2.1 `[dueño]` activar la zona · WI-Q5.2.2 `[infra]` `dominios.json` · WI-Q5.2.3 `[ci]` producción · WI-Q5.2.4 `[prueba]` humo y host.

#### HU-Q5.3 · Recibos por canal, sin datos personales
- **Capa:** medición · **Prioridad:** Should · **Puntos:** 3 · **Sprint:** Q5 · **Depende de:** HU-Q3.6 · **Estado:** Hecha en staging (PR #127; el despliegue del 8 oct publicó el Worker con el dataset `parqueadero_eventos_staging` y el humo de `/_m` pasó): la lista cerrada y el lote v2 en `@ed1/eventos` (`parqueadero.ts`), los conteos de la caja en `medicion.ts` y el Worker de `/_m` con Analytics Engine (`apps/parqueadero-sitio/src/worker.ts`); la aceptación sin red comprueba el lote al volver la red. El tablero de estos conteos queda para cuando haya piloto
- Como dueño, quiero saber cuántos recibos salen por cada canal y cuántas impresiones fallan, para medir la meta de menos papel y la de impresión confiable.
- **Respaldo:** PARQUEADERO §14.4 y §18.2; `@ed1/eventos`.
- **CA1.** `@ed1/eventos` expande su lista cerrada (P10) con `recibo.papel`, `recibo.whatsapp`, `recibo.pantalla`, `recibo.copia`, `impresion.fallida` (con el adaptador y la causa), `respaldo.hecho` y `turno.cerrado`.
- **CA2.** La caja los manda en lote a `/_m` cuando hay red, como la Tienda; sin red, esperan.
- **CA3 ❌.** Ningún evento lleva placa, teléfono, nombre ni IP: una prueba arma eventos con datos de prueba y busca cada uno. Un evento fuera de la lista no se emite.
- **Patrones en riesgo:** P10, P13, P17.
- **Work items:** WI-Q5.3.1 `[código]` lista expandida · WI-Q5.3.2 `[código]` envío en lote · WI-Q5.3.3 `[prueba]` sin datos personales.

### EQ6 · Validación en campo y puesta en marcha

#### HU-Q6.1 · La matriz en el equipo real
- **Capa:** campo · **Prioridad:** Must · **Puntos:** 3 · **Sprint:** Q5 (se llena desde Q1) · **Depende de:** HU-Q2.3, HU-Q2.4, HU-Q4.1, HU-Q4.2 · **Estado:** En curso: `docs/parking/validacion/impresion-pt210.md` con las pruebas del 7 y 8 oct (en Windows, la impresora emparejada conecta, imprime y sigue conectada); falta el equipo que será la caja del cliente. Los casos explicados para el dueño están en la hoja del cajero y en la lista de la puesta en marcha
- Como dueño, quiero ver la caja funcionar en la PT-210 y en los teléfonos de verdad antes de llevarla al cliente.
- **Respaldo:** PARQUEADERO §15.3 (la matriz); P16.
- **CA1.** `docs/parking/validacion/impresion-pt210.md` tiene cada caso de la matriz de PARQUEADERO §15.3 en Android con Chrome y en Windows con Chrome o Edge, y lo que aplica en iPhone, con la fecha, el modelo, la versión del navegador y el resultado.
- **CA2.** 50 recibos seguidos sin pérdida; la impresora que se apaga y vuelve; la caja cerrada y reabierta; sin papel; y modo avión de punta a punta. El camino principal en Android queda elegido, Web Bluetooth o Web Serial, con su razón.
- **CA3 ❌.** Un caso en rojo no se pinta de verde con una nota: se arregla, o el criterio de salida del MVP se discute con el dueño antes del piloto.
- **En el equipo real:** todo el kit de §3.3, y la PT-210 y el teléfono del cliente en la puesta en marcha.
- **Patrones en riesgo:** P16, P17.
- **Work items:** WI-Q6.1.1 `[campo]` Android · WI-Q6.1.2 `[campo]` Windows · WI-Q6.1.3 `[campo]` iPhone · WI-Q6.1.4 `[doc]` registro.

#### HU-Q6.2 · Runbooks del MVP
- **Capa:** operación · **Prioridad:** Must · **Puntos:** 2 · **Sprint:** Q5 (se escriben en Q4) · **Depende de:** HU-Q2.6, HU-Q3.10 · **Estado:** Hecha (PR #121): los cinco runbooks, sus capturas a 360 px y la prueba `tests/repo/runbooks-parqueadero.test.ts`
- Como persona de soporte, quiero los pasos exactos para lo que va a fallar, para resolverlo por WhatsApp sin ir al parqueadero.
- **Respaldo:** PARQUEADERO §14.5 (runbooks 1 a 3).
- **CA1.** `docs/runbooks/` tiene «Puesta en marcha de un parqueadero», «La impresora no imprime» (empieza por el Bluetooth de modo dual, que acepta un solo enlace, y por el diagnóstico copiable), «Cambio anual de topes», «Restaurar la caja en otro teléfono» y «Arreglos durante el congelamiento».
- **CA2.** Cada runbook dice qué ve el operador, qué toca y qué debe salir, con capturas de la caja a 360 px.
- **CA3 ❌.** Una prueba de repositorio comprueba que cada pantalla, ajuste y archivo que un runbook nombra existe (P18).
- **Patrones en riesgo:** P15, P18.
- **Work items:** WI-Q6.2.1 `[doc]` runbooks · WI-Q6.2.2 `[prueba]` de repositorio.

#### HU-Q6.3 · La aceptación de M0, sin red, de punta a punta
- **Capa:** prueba · **Prioridad:** Must · **Puntos:** 2 · **Sprint:** Q5 · **Depende de:** las historias de M0, salvo HU-Q6.4 · **Estado:** Hecha (PR #125): `tests/e2e/parqueadero-aceptacion.spec.ts` recorre un turno sin red en Ensayo Uno y Ensayo Dos, con axe; una versión nueva espera a que termine la impresión; dos entradas a la vez no repiten número. Corre en el CI de cada PR
- Como dueño, quiero una prueba que recorra un turno entero sin red, para que ningún cambio posterior rompa el MVP sin que se vea.
- **Respaldo:** PARQUEADERO §15.2.
- **CA1.** Playwright a 360 px, con `setOffline(true)` y con Ensayo Uno y Ensayo Dos: apertura, entrada, recibo a la impresora falsa, enlace `wa.me` con el número y el texto correctos, salida, liquidación, anulación, cierre impreso y respaldo. Axe sin violaciones.
- **CA2.** Una versión nueva de la app en medio de una impresión no recarga. La prueba espera a que la transacción de IndexedDB termine antes de navegar (bitácora agro, terreno: `page.goto` justo después de guardar corta la escritura).
- **CA3 ❌.** Quitar la transacción única del registro y el consecutivo pone la prueba en rojo: dos entradas salen con el mismo número.
- **Patrones en riesgo:** P5, P16.
- **Work items:** WI-Q6.3.1 `[prueba]` e2e · WI-Q6.3.2 `[ci]` en cada PR que toca la caja.

#### HU-Q6.4 · Puesta en marcha y primer turno real
- **Capa:** campo · **Prioridad:** Must · **Puntos:** 3 · **Sprint:** Q5 · **Depende de:** HU-Q6.1, HU-Q6.2, HU-Q6.3, HU-Q5.2, D-Q5, D-Q9 · **Estado:** En curso (rama `docs/puesta-en-marcha`): el cliente opera con el MVP sin pasar por la demostración (bitácora, cambios de rumbo). Listos la hoja del cajero (`docs/runbooks/parqueadero-hoja-del-cajero.md`) y el registro del primer turno (`docs/parking/validacion/piloto-parqueadero-cero.md`); faltan los datos del cliente, la `0.1.0` en producción y el día 1
- Como cliente, quiero que alguien me deje la caja funcionando en mi parqueadero y me acompañe el primer turno.
- **Respaldo:** PARQUEADERO §14.5 (runbook 1) y §18 (criterio de M0); estudio §10.2 (la puesta en marcha como servicio) y §16.1.
- **CA1.** Con el runbook de puesta en marcha: datos legales completos, tarifas contra el tope, la impresora del cliente con su paso 0 y su página de prueba superada, WhatsApp Business del parqueadero como predeterminado, el aviso de privacidad impreso y a la vista, `papel` en `siempre` (D-Q9) y el primer respaldo.
- **CA2.** El primer turno real corre **en paralelo con el talonario**: cada carro recibe el recibo de la caja y el de siempre, y al cierre se comparan. `docs/parking/validacion/piloto-parqueadero-cero.md` registra, sin datos de conductores, los tiempos de entrada, las impresiones al primer intento, los recibos digitales, las diferencias y todo lo que el cliente observe.
- **CA3 ❌.** El talonario no se deja hasta tres turnos seguidos sin diferencia. Un turno con una diferencia sin explicar detiene el piloto hasta encontrar la causa.
- **En el equipo real:** la PT-210, el teléfono y el WhatsApp del cliente, en su parqueadero.
- **Patrones en riesgo:** P6, P16.
- **Work items:** WI-Q6.4.1 `[campo]` puesta en marcha · WI-Q6.4.2 `[campo]` primer turno · WI-Q6.4.3 `[doc]` registro del piloto · WI-Q6.4.4 `[dueño]` link de pago (D-Q5).

#### HU-Q6.5 · La caja, más clara y sobria
- **Capa:** caja · **Prioridad:** Should · **Puntos:** 3 · **Sprint:** Q5 · **Depende de:** HU-Q3.1 · **Estado:** Hecha (PR #134): el inicio con la entrada primero, la cabecera en dos líneas, filas sin caja, «Anular» al final y el azul de la caja en oscuro; en staging, sale en la versión siguiente
- Como cajero, quiero ver primero lo que hago cien veces al día (la entrada y los vehículos adentro) y que lo demás no compita con eso, para atender rápido sin buscar.
- **Respaldo:** pedido del dueño del 8 oct 2026 («mejora UI/UX, minimalista, sofisticado»), con la caja ya en producción; plan §5.1 (de pie, al sol y con una mano).
- **CA1.** El inicio pone primero «Nueva entrada» y los vehículos adentro; el turno es una línea; Ajustes, Abonados, Respaldo y el aviso de privacidad van en una lista aparte, al final. Ningún botón ni texto que nombran las pruebas, la hoja del cajero o los runbooks cambia de nombre.
- **CA2.** Las cuatro señales siguen siempre a la vista (HU-Q3.1 CA2), pero en dos líneas cortas: lo que está bien se dice en gris, y solo lo que falla toma color, con su texto. Nada se dice solo con color.
- **CA3 ❌.** A 360 px nada se desborda, los toques miden al menos 56 px y la caja y el asistente siguen pasando WCAG 2.1 AA en claro y en oscuro. Un contraste por debajo de AA hace fallar la prueba de axe.
- **Patrones en riesgo:** P15.
- **Work items:** WI-Q6.5.1 `[diseño]` · WI-Q6.5.2 `[código]` · WI-Q6.5.3 `[prueba]` capturas de los runbooks.

#### HU-Q6.6 · El recibo se ve como recibo
- **Capa:** caja y sitio · **Prioridad:** Should · **Puntos:** 2 · **Sprint:** Q5 · **Depende de:** HU-Q3.3, HU-Q4.2 · **Estado:** En revisión (PR #136): la hoja del recibo en la caja y en `/r/`, y el WhatsApp con las filas alineadas en 26 columnas
- Como conductor, quiero que el recibo en la pantalla, en el enlace y en WhatsApp se lea como el papel de siempre, para encontrar de un vistazo el parqueadero, la placa, la hora y lo que pagué.
- **Respaldo:** pedido del dueño del 8 oct 2026 («mejora la presentación del recibo A-xxx, y del mensaje a WhatsApp que se vea como recibo»); PARQUEADERO §6.4 y §6.5.
- **CA1.** La pantalla del recibo en la caja y la página `/r/` muestran una hoja de recibo: el parqueadero arriba con su NIT, dirección y teléfono; la clase y el número; la placa como placa; las horas, la tarifa o la liquidación en grupos; el total grande con el medio de pago; y abajo el texto legal. Lo mismo en las dos, de un solo modelo (ADR-33).
- **CA2.** El mensaje de WhatsApp lleva el nombre del parqueadero en negrilla y las filas en un bloque de ancho fijo de 26 columnas, alineadas como en el papel; el enlace sigue solo en su línea y lo que escribe la sede no rompe el formato.
- **CA3 ❌.** Ninguna fila del bloque pasa de 26 columnas, ni con una novedad larga; a 360 px nada se desborda y la hoja pasa WCAG 2.1 AA en claro y en oscuro.
- **Patrones en riesgo:** P15.
- **Work items:** WI-Q6.6.1 `[diseño]` · WI-Q6.6.2 `[código]` · WI-Q6.6.3 `[prueba]`.

---

## 6. Cómo se prueba

### 6.1 Las capas

| Capa | Con qué | Qué cubre | Cuándo corre |
|---|---|---|---|
| Unitarias | Vitest | Las reglas puras de PARQUEADERO §15.1: la liquidación y su tope, el recibo y sus cuatro salidas, los bytes ESC/POS, los números de WhatsApp y el enlace. Lo que toca el reloj corre también con `TZ=Pacific/Kiritimati` (P8) | Cada PR |
| De repositorio | Las guardias de `pnpm test` | Los campos de la ley en cada plantilla (HU-Q1.4); nada se borra de `registros` (HU-Q3.7); el nombre del cliente no aparece (HU-Q0.2); lo que nombra un runbook existe (HU-Q6.2); licencias; CHANGELOG del parqueadero (HU-Q0.3) | Cada PR |
| Del modelo de datos | `node docs/parking/sql/probar-parqueadero.mjs` | Las 56 comprobaciones de `0001_parqueadero_v1.sql` | Cada PR que toca `docs/parking/sql/` |
| De punta a punta | Playwright (`pnpm e2e`, proyecto `telefono-360`), con la red apagada y axe | Un turno entero con los dos parqueaderos de prueba (HU-Q6.3) | Cada PR que toca la caja, desde Q5 |
| En el equipo real | La matriz de PARQUEADERO §15.3 | Lo que ninguna prueba automática ve: el Bluetooth, el papel, WhatsApp, la cámara, el sol en la pantalla | Al cerrar cada historia que lo pide (plan §4.1, punto 10), y completa en HU-Q6.1 |

**El control negativo va en cada PR** (plan §4.2, punto 3): qué defecto se puso a propósito y qué prueba se vio en rojo. Cada historia de §5 trae el suyo, marcado ❌.

### 6.2 Los dos parqueaderos de prueba

Datos distintos a propósito, para que una regla escrita para un solo caso se vea en rojo (P4). Nombres, NIT, direcciones y pólizas inventados; viven en los datos de prueba del repositorio y en una sede de práctica del Android del equipo.

| | Parqueadero Ensayo Uno | Parqueadero Ensayo Dos |
|---|---|---|
| Ciudad | Bogotá | Una ciudad sin tope en `content/parqueadero/topes.json` |
| Vehículos | Carros y motos | Carros |
| Tarifa | `minuto`, con gracia y valor del tiquete perdido | `fraccion` de 15 minutos, con franja nocturna de valor fijo y tope diario propio |
| Tope de la ciudad | Sí: la liquidación nunca lo pasa | No |
| Redondeo | `ninguno` | `abajo_100` |
| `papel` | `siempre` | `salvo_digital` |
| Póliza | Con aseguradora y número | Sin póliza: el recibo omite la línea, no la deja vacía |
| Abonados | No | Sí (HU-Q3.11) |
| Equipo y camino | Android con Chrome y la PT-210 por Web Bluetooth | PC con Windows por Web Serial (puerto COM), y un iPhone sin papel |

### 6.3 Cómo se registra una prueba en el equipo real

En `docs/parking/validacion/impresion-pt210.md`, una fila por caso: fecha, caso de la matriz, equipo (marca, modelo y versión del sistema), navegador y versión, camino (Web Bluetooth, Web Serial o diálogo del sistema), resultado y, si falló, el enlace a la entrada de la bitácora. **Un caso que no se corrió se escribe «sin correr», nunca se deja en blanco.** Las fotos del papel se guardan fuera del repositorio si muestran algo del cliente.

---

## 7. Las demostraciones de cada viernes

Cada revisión sigue un guion escrito. El asistente lo entrega el jueves con los pasos exactos; el dueño lo corre en el equipo real; lo que no pasa queda en «En sprint» y va a la retrospectiva.

### 7.1 Viernes 16 oct · La página de prueba (Q1)

Con el dueño. El Android de referencia y la PT-210 del equipo.

1. Abrir el sitio de staging en Chrome e instalar la caja. Cerrarla, poner el teléfono en modo avión con el Bluetooth encendido y volver a abrirla: abre (HU-Q3.1).
2. Ajustes › Impresora: el asistente de cuatro pasos propone Web Bluetooth. Elegir la PT-210 en el selector de Chrome (HU-Q2.6).
3. La página de prueba: la regla de 32 columnas, las líneas de páginas de códigos con la ñ y las tildes, y los dos QR. Contestar las tres preguntas: la cabecera deja de decir «Impresora sin probar».
4. Escanear los QR del papel con otro teléfono: los lee.
5. Apagar la PT-210 con la caja abierta y volver a prenderla. Imprimir otra vez: reconecta sin volver a elegirla (HU-Q2.3).

**Pasa si** los cinco pasos salen. **Si la PT-210 no imprime**, se lee el informe del paso 0 (HU-Q2.1) y en la planeación del lunes 19 oct se decide si HU-Q2.4 (Web Serial) se adelanta a Q2 (riesgo R3).

### 7.2 Viernes 23 oct · Cinco entradas cronometradas (Q2)

Con el dueño. El Android y la PT-210, con Parqueadero Ensayo Uno.

1. Intentar registrar una entrada con la sede sin NIT: la caja no deja y dice qué falta (HU-Q3.2).
2. Completar la sede con el PIN de administrador. Cinco entradas con cronómetro, de la placa al papel en la mano: un carro sin novedad, una moto (`ABC12D`), un carro con un rayón y una foto, una placa fuera de patrón y un carro con dos novedades.
3. Registrar otra vez una placa que está adentro: lo dice y no crea otra estadía.
4. Apagar la impresora y registrar una entrada: el registro existe igual y su recibo queda pendiente (HU-Q3.3, CA4).
5. Leer los recibos contra la foto del recibo del cliente (dato 4 de §1): ningún campo que él entrega hoy falta.

**Pasa si** las cinco entradas toman 10 segundos o menos cada una (se anota cada tiempo) y los consecutivos no tienen hueco. **Si la entrada no imprime en la PT-210**, se activa la contingencia de §4.4.

### 7.3 Viernes 30 oct · La demostración al cliente (Q3)

**Antes:** `parqueadero-v0.1.0` en producción en `parqueadero.laboratorio-digital.app`. La caja de la demostración es el Android del equipo, configurado con la tarifa del cliente si ya llegó (si no, Ensayo Uno). **Esa caja no es la del piloto:** sus recibos no son recibos reales, y la del cliente empieza limpia en la puesta en marcha. Si el cliente trae su PT-210, se le corre el paso 0 antes de empezar (R3). **El jueves 29 oct hay un ensayo general** con este guion completo y se graba en video, como respaldo si algo falla en vivo.

**El guion, 30 minutos:**

| # | Min | Qué se muestra | Historia |
|---|---|---|---|
| 1 | 2 | Qué va a ver y qué no: sin cuenta, una sola caja, sin factura electrónica | — |
| 2 | 4 | La entrada de un carro con la placa que diga el cliente. El recibo sale en la PT-210, con el cronómetro a la vista | HU-Q3.3 |
| 3 | 4 | El mismo recibo por WhatsApp: el aviso de privacidad, el número del conductor (el teléfono del cliente) y el mensaje que le llega con el enlace | HU-Q4.4, HU-Q4.1 |
| 4 | 3 | El QR en pantalla: el cliente lo escanea y ve su recibo en `/r/`, en el dominio del producto | HU-Q3.6, HU-Q4.2 |
| 5 | 4 | La salida: escanear el QR del papel, la liquidación con su detalle y el tope, el cobro en efectivo con el cambio, y el recibo de salida impreso y por WhatsApp | HU-Q3.4, HU-Q3.5 |
| 6 | 3 | Sin internet: modo avión, una entrada y una salida. El WhatsApp espera y sale al volver la red | HU-Q3.1, HU-Q4.1 |
| 7 | 5 | El cliente o su cajero hace una entrada y una salida sin ayuda | — |
| 8 | 5 | Lo que sigue: el turno y el respaldo, el piloto del 9 al 13 nov, lo que se necesita de él, el precio y el pago (D-Q5) | — |

**Se anota**, sin datos de conductores: qué pregunta el cliente, dónde duda el cajero y qué pide. Lo que pide va al backlog con su lugar (R6). En la reunión no se promete nada que no esté en el plan: «Lo anotamos y le decimos cuándo».

**Si la impresión falla en vivo**, se sigue con WhatsApp y el QR, que no dependen de la impresora, y se muestra el video del ensayo. Si la contingencia de §4.4 se activó, la demostración imprime por el diálogo del sistema desde el PC y se le dice al cliente qué falta y para cuándo.

### 7.4 Viernes 6 nov · Un turno completo (Q4)

Con el dueño. El Android con Ensayo Uno y el PC con Ensayo Dos.

1. Abrir el turno con una base de caja.
2. Diez entradas y ocho salidas, con un tiquete perdido y una copia reimpresa.
3. Anular una entrada con su motivo: queda anulada, no borrada, y sale en el cierre (HU-Q3.7).
4. Con red, adelantar 10 minutos la hora del teléfono: la caja avisa en rojo y no la corrige sola (HU-Q3.8).
5. Cerrar con el conteo del efectivo, forzando una diferencia de $2.000: la caja la muestra y pide la explicación. Imprimir el cierre (HU-Q3.9).
6. Hacer el respaldo, restaurarlo en otro teléfono y restaurarlo otra vez encima: une sin duplicar ni perder (HU-Q3.10).
7. En el PC, una entrada y una salida de Ensayo Dos impresas por Web Serial (HU-Q2.4).

**Pasa si** el cierre cuadra con lo cobrado salvo la diferencia forzada, la anulación aparece y la restauración no duplica ni pierde.

### 7.5 Viernes 13 nov · La revisión del piloto (Q5)

Con el cliente, 30 minutos, y después la retrospectiva con el dueño.

1. Las métricas de PARQUEADERO §18.2 con el registro del piloto (§8.3): impresión al primer intento, tiempo de entrada, recibos digitales y cuadre.
2. Lo que observaron el cliente y sus cajeros.
3. Tres decisiones: si el talonario se deja (§8.4), cuándo `papel` pasa a `salvo_digital` (D-Q9) y la confirmación del pago del primer periodo (D-Q5).
4. Lo que pidieron, ya ordenado en el backlog: HU-Q3.12 tiene un tope de 3 puntos en Q6.

---

## 8. Puesta en marcha y piloto

**El día 1** es el del primer turno real: el lunes 9 nov por la tarde o el martes 10 nov, según elija el cliente en la demostración. El lunes en la mañana se cierran HU-Q6.1 a HU-Q6.3 y se publica `parqueadero-v0.2.0` (§4.3). D-*n* es *n* días hábiles antes del día 1.

### 8.1 Antes del día 1

| Cuándo | Qué | Quién | Listo si |
|---|---|---|---|
| D-5 | Confirmar con el cliente el día y la hora del primer turno, quién lo hará, que tiene rollos de 57 mm y el teléfono de la caja cargado | Dueño | Queda escrito en el hilo del proyecto |
| D-5 | Sus datos legales, tarifas y tope, cargados en una sede de práctica y comparados con un recibo suyo (dato 4 de §1) | Asistente prepara; dueño revisa | Ningún campo de la ley falta y ninguna tarifa pasa el tope |
| D-4 | Los runbooks de HU-Q6.2, leídos en voz alta con el dueño | Asistente | El dueño resuelve con ellos «La impresora no imprime» sin ayuda |
| D-3 | El aviso de privacidad impreso, para pegar a la vista, y una hoja de una página para el cajero: entrada, salida, «No salió» y cierre | Asistente | Impresos |
| D-2 | El link de pago de Bold del primer periodo (D-Q5) | Dueño | Enviado al cliente |
| D-1 | `parqueadero-v0.2.0` en producción; la matriz (HU-Q6.1) y la aceptación (HU-Q6.3) en verde; `/r/` responde en el dominio | Asistente; dueño valida | Las tres cosas |
| D-1 | El kit de la visita: la PT-210 del equipo como repuesto, un rollo, cargador, cable USB y el Android del equipo con la caja instalada | Dueño | En la maleta |

### 8.2 El día 1

Con el runbook «Puesta en marcha de un parqueadero» (HU-Q6.2), en este orden:

1. Instalar la caja en el teléfono del cliente desde `parqueadero.laboratorio-digital.app/caja/` y comprobar en la cabecera que el almacenamiento persistente quedó concedido (HU-Q3.1).
2. La sede: datos legales, tarifas contra el tope y el PIN de administrador, que elige el cliente y no se anota en ningún equipo nuestro.
3. Su PT-210: el paso 0 con nRF Connect, vincularla y la página de prueba.
4. Su WhatsApp Business como predeterminado y un envío de prueba al teléfono del dueño.
5. `papel` en `siempre` (D-Q9) y el aviso de privacidad pegado.
6. El cajero practica en el Android del equipo, con Ensayo Uno, **no en la caja del cliente**: la suya empieza limpia, con el consecutivo en 1.
7. Abrir el turno. **Cada carro recibe el recibo de la caja y el del talonario de siempre.**
8. Al cierre: el cierre impreso, la comparación con el talonario, el primer respaldo y la primera fila del registro del piloto.

**Acompañamiento (propuesta, se acuerda con el dueño):** presencial en la apertura, las dos primeras horas y el cierre; en medio, por WhatsApp. Si el turno es corto, todo el turno.

### 8.3 La semana del piloto

- **Canal:** un grupo de WhatsApp con el cliente, el dueño y quien da soporte. Lo primero que se pide es el diagnóstico copiable de la caja (HU-Q6.2).
- **Tiempo de respuesta (propuesta, se acuerda con el dueño):** en el horario del parqueadero, 15 minutos si la caja no registra o no cobra; 2 horas si no imprime o no envía, porque el talonario y el QR siguen; el día hábil siguiente para lo demás.
- **Arreglos:** `v0.2.x`, solo después de un cierre de turno, nunca en medio. Cada arreglo trae su prueba y, si repite un patrón, su entrada en la bitácora. La caja se actualiza al abrir el turno siguiente.
- **Registro:** `docs/parking/validacion/piloto-parqueadero-cero.md`, sin datos de conductores. Una fila por turno: fecha, entradas, impresiones al primer intento, recibos digitales, diferencias y su causa, observaciones y **minutos de soporte** (R8; HU-Q10.3 los automatiza en M1).
- **El respaldo, al cerrar cada turno** (R7). Mientras exista el talonario, el papel es el respaldo del respaldo.

### 8.4 Cuándo se deja el talonario

- **Tres turnos seguidos sin diferencia** entre la caja, el conteo y el talonario (HU-Q6.4, CA3). Las diferencias explicadas, como un error de conteo del cajero, se anotan y no reinician la cuenta.
- **Una diferencia sin explicar detiene el piloto** hasta encontrar la causa, registro por registro contra el talonario. La causa va a la bitácora.
- `papel` sigue en `siempre` dos semanas aunque el talonario se deje (D-Q9).

### 8.5 Si algo sale mal el día 1

| Pasa | Se hace |
|---|---|
| Chrome no encuentra la PT-210 del cliente | El runbook «La impresora no imprime»: primero, si está enlazada a otro teléfono (el Bluetooth de modo dual acepta un solo enlace). Después, Web Serial (HU-Q2.4). Después, la PT-210 del equipo. El turno sigue con el talonario y WhatsApp |
| La caja del cliente resulta ser un iPhone | La caja sin papel (WhatsApp y QR) y el talonario; se le recomienda un Android de entrada como caja (R4) |
| Se va el internet o la luz | La caja sigue sin red; los WhatsApp esperan y salen al volver |
| El cierre no cuadra | §8.4: se detiene y se compara registro por registro |
| El cliente pide algo nuevo | Se anota y va al backlog con su lugar; no se construye durante el piloto (R6) |

---

## 9. Los riesgos del MVP

Los siete del plan §11 que pueden mover el 30 oct o el piloto, con la señal que los delata a tiempo:

| Riesgo | Plan | Señal temprana | Qué se hace |
|---|---|---|---|
| La PT-210 no imprime desde Chrome por Bluetooth | R3 | El paso 0 (9 oct) o la página de prueba (16 oct) | Web Serial se adelanta; contingencia de §4.4 el 23 oct |
| La caja del cliente es un iPhone | R4 | El dato 6 de §1, el 14 oct | Un Android de entrada como caja; el iPhone, sin papel |
| Los datos del cliente llegan tarde | R2 | El 14 oct sin los datos 1 a 9 | Q2 sigue con Ensayo Uno y Ensayo Dos; sus datos entran como ajuste |
| La validación del dueño se atasca | R1 | Más de 3 historias esperando validación | D-Q1; no se abre otra historia hasta validar (plan §3.6) |
| La zona `.app` no está activa | R5 | El 23 oct sin la zona | La demostración en staging; ningún recibo real sale con un enlace de staging; el piloto no empieza sin la zona |
| El cliente pide más en la demostración o el piloto | R6 | Pedidos nuevos en §7.3 y §8.3 | Al backlog con su lugar; el orden de recorte de §4.4 |
| Se pierde o se daña el teléfono de la caja | R7 | — | Respaldo al cerrar cada turno; el talonario en paralelo hasta §8.4 |

---

## 10. El tablero y el seguimiento

### 10.1 Los estados

| Estado | Entra cuando | Sale cuando |
|---|---|---|
| Refinada | Cumple la Definición de Listo (plan §4.1) | Se compromete en la planeación del lunes |
| En sprint | Se compromete | Su commit está en la rama del sprint, el CI en verde y el asistente entregó los pasos de validación |
| En validación | Hay pasos de validación y una versión que el dueño puede abrir en el equipo real | El dueño la valida (pasa a Terminada) o la devuelve con lo que vio (vuelve a En sprint) |
| Terminada | Validada por el dueño y fusionada a `main`; cumple la Definición de Terminado (plan §4.2) | — |
| Bloqueada | Espera algo fuera del equipo: una decisión, un dato del cliente, la zona | Llega lo que esperaba. El seguimiento diario dice qué espera y desde cuándo |

**Límite:** como mucho 3 historias del parqueadero En validación (plan §3.6). Con el tope, no se empieza otra: se prepara la demostración de las que esperan.

### 10.2 Velocidad de M0

Se llena cada viernes. Una historia cuenta el día que el dueño la valida.

| Sprint | Fechas | Comprometido | Validado | Nota |
|---|---|---|---|---|
| Q0 | 7–9 oct | 5 | — | Semana corta |
| Q1 | 13–16 oct | 20 | — | Festivo el 12 oct |
| Q2 | 19–23 oct | 24 | — | |
| Q3 | 26–30 oct | 25 | — | Demostración al cliente; `v0.1.0` |
| Q4 | 3–6 nov | 18 | — | Festivo el 2 nov |
| Q5 | 9–13 nov | 24 | — | Piloto; `v0.2.0`. HU-Q4.5, HU-Q6.5 y HU-Q6.6 entraron el 8 oct, en la puesta en marcha |
| **M0** | | **116** | — | |

Si Q1 y Q2 validan menos de lo comprometido, el plan se recalcula en la planeación de Q3 (R12) con el orden de recorte de §4.4, nunca corriendo el 30 oct.

---

## 11. Después del MVP

- **El lunes 17 nov empieza Q6**, el primero de M1 y de dos semanas con el calendario del CORE (C4). Abre con HU-Q3.12: lo que pidió el piloto, con su tope de 3 puntos (plan §6.1).
- **El cliente sigue en `v0.2.x`** hasta que M1 le dé cuenta, varias cajas y sincronización. Su caja se reclama en producción en HU-Q7.12, desde su respaldo, después de los datos del encargado (HU-Q7.11).
- **El congelamiento del 18 dic al 11 ene no apaga su caja:** ya está en producción, y un arreglo que la detenga se publica por la excepción del runbook de emergencias, con el dueño presente (plan §2).
- **Lo que se mide a los 30 días del día 1:** el pago real del primer periodo y las métricas de PARQUEADERO §18.2. Con eso, el dueño decide si el parqueadero sigue como producto (estudio §16.3).
- **Lo que este documento deja de ser:** cuando M0 cierre, las historias de §5 quedan como registro. Lo que siga se planea en el plan, y lo aprendido queda en `BITACORA-PARKING.md`.
