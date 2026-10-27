# Parqueadero ED1 — Plan de trabajo y backlog

**Versión:** 0.1.0 · 7 oct 2026
**Dueño del producto:** Sebas. **Gerencia del proyecto y Scrum:** el asistente, que hace los commits, el push y los PR; el dueño aprueba, fusiona, valida en staging y lleva la relación con el cliente.
**Fuente única de:** hitos, sprints, épicas, historias de M1 a M3, work items, decisiones, riesgos y velocidad **del parqueadero**. Las historias de M0, el MVP del primer cliente, están refinadas solo en `BACKLOG-PARKING_MVP.md` («MVP §N»); aquí van su sprint, sus puntos y su lugar en el plan (P2). Si un título o unos puntos difieren entre los dos, manda el MVP. Lo del CORE está en `../plataforma/BACKLOG_CORE.md`, lo de la Tienda en `../tienda/BACKLOG_TIENDA3.md` y lo del agro en `../BACKLOG.md`.
**Lo que manda sobre este documento:** `../ecosistema/ECOSISTEMA-DIGITAL-ED1-v1.4.md` (ED1 §N) → `../ARQUITECTURA.md` (ADR-N, P1–P21) → `ARQUITECTURA-PARQUEADERO.md` (el diseño, «PARQUEADERO §N», con las ADR-31 a ADR-40 propuestas) y `../plataforma/PLATAFORMA.md` (lo común). El mercado: `ESTUDIO-MERCADO-PARQUEADEROS-ED1-2026-10.md` («estudio §N»). Aquí se planea; allí se decide. Ante una contradicción, se señala antes de actuar.
**Lecciones:** `BITACORA-PARKING.md` (bitácora parqueadero N), `../tienda/BITACORA_TIENDA3.md` (bitácora tienda3 N), `../tienda/BITACORA-ecommerce.md` (bitácora ecommerce N), `../plataforma/BITACORA_CORE.md` (bitácora core N) y `../BITACORA.md` (bitácora agro N). Los patrones P1–P21 son del ecosistema y conservan su número.

> **Para un equipo que llega nuevo.** Este documento es el mapa completo. El trabajo de las próximas seis semanas está en `BACKLOG-PARKING_MVP.md`, que empieza por lo que hay que hacer el primer día (MVP §3). El diseño técnico está en `ARQUITECTURA-PARQUEADERO.md` y el porqué comercial en el estudio.

---

## 0. En una página

**Qué es el proyecto.** Construir la caja de parqueadero que diseña `ARQUITECTURA-PARQUEADERO.md`: corre completa en el navegador del teléfono o del PC, sin red, imprime el recibo en la GOOJPRT PT-210 por Bluetooth y, en el mismo momento, lo manda al WhatsApp del conductor desde el WhatsApp del parqueadero, para que el papel deje de usarse. Entra como **excepción declarada**, con el primer cliente como parqueadero cero (ADR-31, propuesta). Primero va el MVP que ese cliente ya quiere pagar (M0); después, la cuenta, la firma sin red y el WhatsApp automático, sobre el CORE.

**Las tres reglas del proyecto:**

1. **Registrar, cobrar e imprimir nunca esperan a la red.** Ni a la nube, ni al CORE, ni a WhatsApp (PARQUEADERO §5.3). Ningún kill switch ni plan vencido detiene una entrada (PARQUEADERO §14.2).
2. **Un recibo, cuatro salidas.** Papel, enlace, WhatsApp y pantalla salen del mismo objeto y dicen lo mismo, con los campos que exige la ley. Una prueba lo exige (ADR-33).
3. **Lo que no se confirma no se da por hecho.** «Enviado a la impresora» no es «impreso», y «abierto en WhatsApp» no es «entregado» (PARQUEADERO §7.3 y §8.2). El conductor elige el recibo digital o recibe papel.

| Hito | Qué queda funcionando | Cierra | Fecha objetivo | Necesita del CORE o del dueño | Versión |
|---|---|---|---|---|---|
| **M0 · MVP del cliente** | La caja instalable en Android o Windows: tarifas con tope, entrada y salida, recibo en la PT-210, WhatsApp por enlace, QR en pantalla, la página `/r/`, turno con cierre impreso y respaldo en archivo. Puesta en marcha y primer turno real con el cliente | Q5 | **Demostración al cliente el 30 oct 2026** y **piloto del 9 al 13 nov** | Nada del CORE. Del dueño: D-Q1 a D-Q9, los datos del cliente y la zona `laboratorio-digital.app` activa antes de Q3 | `parqueadero-v0.1.0` (Q3) y `v0.2.0` (Q5) |
| **M1 · Cuenta y varias cajas** | El parqueadero en el CORE, celda c2, sincronización, entrar y reclamar lo local, dispositivos con serie, roles, respaldo en la nube, cobro del plan por periodo | Q9 | 22 ene 2027 | HU-C3.1, HU-C4.3 y HU-C4.4, ya construidas; HC4 solo para el cobro por periodo (HU-Q7.10) | `v0.5.0` |
| **M2 · Recibo verificado** | Firma sin red por dispositivo y su verificación en `/r/`, fotos del estado en la nube por 30 días, mensualidades, reportes por turno y lo que ahorra el parqueadero en papel | Q11 | 19 feb 2027 | — | **`v1.0.0`** |
| **M3 · WhatsApp automático** | Envío por la Cloud API con el número de cada parqueadero, plantilla de utilidad, estados de entrega y recibo por autoservicio con un QR en la entrada | Q13 | 19 mar 2027, **solo si se cumple su disparador** (§8, EQ9) | Un parqueadero que pague un plan que lo cubra y tenga su negocio verificado en Meta; `@ed1/cifrado` (HU-T1.3) | `v1.1.0` |
| **M4 · Facturación** | Integrar el facturador del parqueadero, sin emitir | — | Preparada (§9) | Un parqueadero obligado a facturar | `v1.2.0` |

**En cifras:** 12 épicas con historias (EQ0 a EQ11; EQ12 está preparada), **77 historias refinadas y 229 puntos en 14 sprints** (Q0 a Q13), más tres sin sprint que salieron de la medición de búsqueda (HU-Q11.2 espera; HU-Q11.6 y HU-Q11.7 se planean después de M1). **El MVP (M0): 40 historias y 116 puntos en seis sprints de una semana** (HU-Q4.5, HU-Q6.5 y HU-Q6.6 se agregaron el 8 oct 2026, en la puesta en marcha).

**La fecha del 30 de octubre es un compromiso con el cliente, no un techo.** Si una semana se queda corta, se recorta alcance en el orden de MVP §4.4; la fecha no se corre. Desde M1, las fechas vuelven a ser un techo, como en el CORE y la Tienda: lo que manda es el orden de las dependencias.

**Fuera de alcance, a propósito** (PARQUEADERO §19.3; cada uno con su disparador en §9): lectura de placa con la cámara, pago en línea del conductor, emitir factura electrónica, varias sedes con reporte consolidado, convenios con comercios y copropiedades, barreras, sensores, cámaras fijas y reservas, app nativa, e imprimir desde un iPhone.

---

## 1. Lo que encontró el contraste con las fuentes, antes de escribir código

Cada historia se contrastó con PARQUEADERO, el estudio, ED1, ARQUITECTURA, los tres backlogs y el código de `origin/main` del 7 oct 2026 (memoria del proyecto: «premisas antes de decidir»). Esto es lo que el contraste cambió o descubrió:

| # | Hallazgo | Qué cambia en el plan | Registro |
|---|---|---|---|
| 1 | PARQUEADERO §9 promete pesos enteros y su prueba, pero no nombra `@ed1/dinero`, que ya está en `main` (`pesos(valor, campo)`, `formatearPesos()`, `MontoIlegible`, sin `Intl`) con su guardia de paquetes puros (`tests/repo/tienda-paquetes-puros.test.ts`) | `parqueadero-tarifas` y `parqueadero-recibos` usan `@ed1/dinero`; ninguna función de pesos propia (HU-Q1.1, HU-Q1.4). Nota en PARQUEADERO §9 | Bitácora parqueadero 5 |
| 2 | PARQUEADERO §10.3, §14.1 y §17 cuentan con Workers Paid «ya pagado por la Tienda». El 6 oct el dueño decidió que Workers Paid ya no es condición y se activa solo si hace falta. En el plan gratuito, D1 permite 100.000 filas escritas al día **para toda la cuenta**: a 1.800 filas diarias por parqueadero, caben unos 55 si fueran los únicos | M1 se diseña para el plan gratuito, con su presupuesto en filas y su vigía (HU-Q7.13, nueva) y la decisión D-Q10. Notas en PARQUEADERO §0, §10.3, §14.1 y §17 | Bitácora parqueadero 6 |
| 3 | PARQUEADERO §2.2 pone «mensualidades sencillas por placa» en M0, y §0 y §18 las ponen en M2 | M0 solo marca abonados por placa (HU-Q3.11, Should). Las mensualidades con plan, cobro y recordatorio son M2 (HU-Q8.4). Nota en §2.2 | Bitácora parqueadero 7 |
| 4 | PARQUEADERO §5.5 comprime las fotos del estado a WebP en el navegador. Safari no codifica WebP en `canvas.toBlob`: devuelve PNG. Es la bitácora tienda3 2 otra vez | Las fotos caen a JPEG donde no hay WebP (HU-Q3.3, HU-Q8.3). En M0 no van en el archivo de respaldo, que se manda por correo (MVP §5, HU-Q3.10). Nota en §5.5 | Bitácora parqueadero 8 |
| 5 | PARQUEADERO §18.1 construye dos herramientas gratuitas en la semana 3 de M0; el estudio §12.2 pide medir su búsqueda antes de construir | Las herramientas salen de M0. HU-Q11.1 mide primero (Q6) y la calculadora y el generador dependen de lo que diga. El aviso de tarifas y derechos (HU-Q11.3) se hace sin esperar, porque el cliente lo usa en su entrada. Nota en §18.1 | Bitácora parqueadero 9 |
| 6 | PARQUEADERO §20.5 dice que el código de `wa.me` existe dos veces, en el agro y en la Tienda. En `origin/main` hay **tres copias en el agro**, todas para compartir sin número (`wa.me/?text=`: `apps/cuaderno/src/almacen/invitacion.ts:118`, `apps/sitio/src/islas/carencia-logica.ts:176`, `apps/sitio/src/islas/dpv-logica.ts:134`) y **ninguna en la Tienda 3.0**, que todavía no tiene código | `@ed1/whatsapp` nace con las dos formas, con número y sin él (HU-Q1.6), y se ofrece al agro y a la Tienda (§12). Nota en §20.5 | Bitácora parqueadero, «Afirmaciones falsas» 3 |
| 7 | PARQUEADERO §0 y §18 dicen que M1 necesita PLATAFORMA P1 y P2. Contra BACKLOG_CORE, M1 solo necesita HU-C3.1, HU-C4.3 y HU-C4.4, que ya están construidas y en validación, más lo ya fusionado de C1 y C2. Solo el cobro por periodo espera a HC4 | M1 arranca en Q6, justo después del piloto. Solo HU-Q7.10 espera a HC4 (C7). Nota en §18 | — |
| 8 | `@ed1/eventos` ya existe y su lista de eventos es cerrada (`tool.opened`, `tool.completed`, `tool.shared`, `tool.next_step`). Los eventos de recibo por canal de PARQUEADERO §14.4 no están | HU-Q5.3 expande la lista (P10: expandir antes de usar), sin placas ni números | — |
| 9 | `infrastructure/dominios.json` tiene `laboratorio-digital.app` con `zona_activa: false` y `reservados_app.proyecto` vacío, y todo hostname de esa zona que use un Worker tiene que estar declarado allí | HU-Q5.2 declara el host, reserva el nombre `parqueadero` y lo publica antes de la demostración; decisión D-Q4 | — |
| 10 | PARQUEADERO §18 estimó M0 en 3 semanas de construcción. El desglose da 109 puntos, y el MVP no se entrega sin la matriz en el equipo real (PARQUEADERO §15.3) ni sin que el dueño valide | M0 en seis sprints semanales con dos entregas: la demostración del 30 oct (`v0.1.0`) y el piloto del 9 al 13 nov (`v0.2.0`), con un orden de recorte (MVP §4.4). Nota en §18 | Bitácora parqueadero, «Cambios de rumbo» |

---

## 2. Supuestos del plan

Si alguno es falso, se reordena el plan.

| Supuesto | Valor | Por qué importa |
|---|---|---|
| Equipo de referencia | El dueño (producto, validación, relación con el cliente) + el asistente (análisis, código, pruebas, documentos, commits, push y PR) | ED1 §25: las horas del dueño son el límite real |
| Si lo ejecuta otro equipo | Un dueño de producto con decisión (Sebas), un desarrollador líder de TypeScript con PWA, IndexedDB y Web Bluetooth, un desarrollador de frontend, QA a medio tiempo con los equipos reales y quien haga de Scrum Master. Roles y RACI en MVP §2 | Los puntos son relativos: el equipo mide su velocidad en Q1 y Q2 y el plan se recalcula en la planeación de Q3 (R12) |
| Sprints | **M0: una semana, de lunes a viernes** (D-Q2). Desde Q6, dos semanas con el calendario del CORE: Q6 = C4, Q7 = C5 … Q13 = C11 | La urgencia del cliente pide revisar cada viernes; después, las ceremonias se comparten |
| Escala | Fibonacci; **1 punto ≈ 3 h ideales** con asistencia, igual que el CORE, la Tienda y el agro | Se compara entre carriles |
| Velocidad planeada | **M0: 25 puntos por semana, 20 en las semanas cortas**, porque el parqueadero va primero en la validación (D-Q1). Desde Q6: 20 por sprint, 16 con festivo y 12 en los cortos | Se planea por validación, no por construcción |
| **Cuello de botella** | La validación del dueño y, en M0, **el equipo real**: la PT-210, un Android, un PC con Windows y dos WhatsApp de prueba | Límite de trabajo en curso (§3.6); una historia cuenta el día que el dueño la valida |
| Festivos | 2026: 12 oct; 2 y 16 nov; 8 y 25 dic. 2027: 1 y 11 ene; 22, 25 y 26 mar | Con festivo: Q1, Q4, Q6, Q7 y Q9. Cortos: Q0 (empieza un miércoles) y Q8 |
| Congelamiento | Del 18 dic 2026 al 11 ene 2027 no se publica a producción (BACKLOG_CORE §1). Q8 solo llega a staging | **La caja del cliente ya está en producción.** Un arreglo que la detenga se publica por la excepción del runbook de emergencias (HU-Q6.2), con el dueño presente |
| Costo de nube | M0: USD 0, con assets estáticos y eventos en la capa gratuita (PARQUEADERO §17). M1 y M2: el plan gratuito (D-Q10) | Nada que presupuestar antes de M1 |
| El cliente | Entrega los datos de MVP §1 a más tardar el **14 oct**, recibe la demostración del 30 oct y abre su parqueadero al piloto | Sin sus datos, Q2 sigue con los parqueaderos de prueba y el riesgo R2 se activa |

---

## 3. Cómo se trabaja

### 3.1 GitHub flow

- **Una copia de trabajo propia:** `D:\CoWork\gestionagro-parqueadero` (`git worktree add`), aparte de la carpeta del dueño, la del CORE (`D:\CoWork\gestionagro-core`) y la de la Tienda (`D:\CoWork\gestionagro-tienda`). Antes de cambiar de rama, `git status`: lo que no es del parqueadero no se lleva (bitácora core, terreno).
- `main` protegida. Todo cambio entra por PR **a `main`**, que el dueño aprueba y fusiona.
- **Una rama y un PR por sprint, con un commit por historia** (`feat/q1-sprint`), como el CORE y la Tienda. Lo que urge o tiene otro riesgo va en su rama: `<tipo>/q<épica>.<n>-<tema>`, por ejemplo `fix/q2.3-trozos-ble`. El plan va en `docs/q0-plan-y-backlog`.
- Cada rama sale de `origin/main` actualizado. Si toca un archivo que también tocan los otros carriles (`productos.json`, `celdas.json`, `dominios.json`, `desplegar.yml`, `CHANGELOG.md`, `pnpm-lock.yaml`, `packages/eventos`, `packages/sync`), se prueba `git merge-tree --write-tree origin/main <rama>` contra las ramas abiertas del CORE y de la Tienda antes del push, y al fusionarse una se actualizan las otras con `git merge origin/main`.
- Todo comando que decide un commit empieza con `set -o pipefail;` y corre lint y typecheck antes (bitácora core 4).

### 3.2 Commits: `tipo(alcance): descripción`

- **Tipos:** `feat`, `fix`, `docs`, `refactor`, `test`, `ci`, `build`, `perf`, `chore`, `revert`.
- **Alcances del parqueadero** (en minúsculas, como exige la guardia de HU-C0.2): `parqueadero`, `caja`, `tarifas`, `topes`, `recibos`, `impresion`, `whatsapp`, `firma`, `turnos`, `respaldo`, `sync`, `dispositivos`, `fotos`, `mensualidades`, `legal`, `medicion`, `herramientas`, `migraciones`, `despliegue`, `ci`, `versiones`, `bitacora`.
- **Descripción** en español, en minúscula, sin punto final, de 120 caracteres o menos (eran 72 hasta el 13 oct 2026). Dice qué cambia para quien usa la caja, no qué archivo se tocó.
- **Cuerpo:** el porqué, la historia (`HU-Q2.3`), el control negativo y lo que no cambia.
- **Sin la marca de Claude Code**, ni en commits ni en PR: ni `Co-Authored-By`, ni `Claude-Session`, ni «Generated with Claude Code» (pedido del dueño; lo vigila la guardia del CI).

```text
feat(impresion): la caja imprime en la pt-210 por bluetooth desde chrome

HU-Q2.3. Trozos de 180 bytes cada 30 ms, y de 100 cada 50 ms si el
navegador rechaza uno. La pantalla dice «Enviado a la impresora», nunca
«Impreso». Control negativo: con trozos de 600 bytes, la prueba del
adaptador falso se ve en rojo.
```

### 3.3 Versionado semántico: `parqueadero-vX.Y.Z`

El parqueadero tiene versión propia (HU-Q0.3, como HU-C0.3 para el CORE y HU-T0.2 para la Tienda): un solo `package.json`, el de `apps/parqueadero-sitio` (que construye la caja), su `CHANGELOG.md` y etiquetas `parqueadero-vX.Y.Z`. Al fusionar un PR que la sube, se publica **solo el parqueadero**.

| Cambio | Versión |
|---|---|
| Rompe, después de 1.0.0, un contrato que alguien usa: el formato del enlace del recibo, `parqueadero-export/1`, `/api/v1` o la regla de series y consecutivos | Mayor |
| Capacidad nueva compatible; un esquema nuevo con su traductor | Menor |
| Arreglo sin cambio de contrato | Parche |

**El enlace del recibo es un contrato desde el primer recibo, no desde 1.0.0.** Un recibo impreso o enviado guarda su enlace para siempre (ADR-40): `/r/` lee todas las versiones del formato (`#1.` y `#c.`) que alguna vez se publicaron, y una prueba guarda un enlace de cada una.

| Versión | Sprint | Qué trae |
|---|---|---|
| `parqueadero-v0.1.0` | Q3 | La demostración al cliente, en producción en `parqueadero.laboratorio-digital.app` |
| `parqueadero-v0.2.0` | Q5 | M0: el piloto con el cliente |
| `parqueadero-v0.3.0` | Q11 | La entrega al primer cliente (13 oct 2026): lo de Q6 a Q11 que no necesita la nube. En producción, la cuenta, la nube, Drive y la firma siguen apagadas |
| `parqueadero-v0.4.0` | — | La presentación al cliente (13 oct 2026): la operación simple sin turnos (#167) y lo de Q12 que no necesita la nube |
| `parqueadero-v0.5.0` | Q12 | M1 en producción (2026-10-13): cuenta, varias cajas, nube, Drive y cobro del plan a COP 29.900. La prueba de dos cajas con el cliente (HU-Q7.12 CA1) va después |
| **`parqueadero-v1.0.0`** | Q11 | M2. Los contratos quedan estables: el enlace firmado, `parqueadero-export/1` y `/api/v1` |
| `parqueadero-v1.1.0` | Q13 | M3: WhatsApp automático |
| `parqueadero-v1.2.0` | — | M4: facturación integrada |

### 3.4 Pull request

- Título con la forma de un commit. Descripción con la plantilla del repositorio: qué cambia, **control negativo**, qué documento cambió (P18) y la Definición de Terminado. Sin la marca de Claude Code.
- Una pieza de PARQUEADERO pasa a `../ARQUITECTURA.md`, con su ADR aceptada, **en el mismo PR que la implementa**.
- Al cerrar cada historia, el asistente entrega los pasos exactos de la validación: qué abrir, en qué teléfono, qué tocar y qué debe salir en el papel o en el WhatsApp.

### 3.5 Ceremonias

**En M0, semanales y cortas** (unos 80 minutos del dueño por semana):

| Ceremonia | Cuándo | Qué sale |
|---|---|---|
| Planeación (20 min) | Lunes, o el primer día hábil | Meta de la semana, historias comprometidas y orden de validación |
| Seguimiento diario (por escrito) | Cada día, en el hilo del proyecto | Qué se validó, qué espera validación y qué está bloqueado |
| Refinamiento (20 min) | Miércoles | Historias de la semana siguiente que cumplen la Definición de Listo; preguntas para el cliente |
| Revisión (30 min) | Viernes | Demostración en el equipo real con los pasos exactos; lo validado pasa a «Terminada». **El 30 oct, con el cliente** |
| Retrospectiva (10 min) | Viernes | Qué va a `BITACORA-PARKING.md` y qué se recorta si la semana no alcanzó |

**Desde Q6, compartidas con el CORE y la Tienda:** +15 min en la planeación, +20 en la revisión y +10 en la retrospectiva, como hace la Tienda (BACKLOG_TIENDA3 §3.5).

### 3.6 Límite de trabajo en curso

- **Como mucho 3 historias del parqueadero esperando validación, y 6 entre los tres carriles.** Con el tope, no se abre una nueva: se prepara la demostración de las pendientes.
- Una historia cuenta en la velocidad **el día que el dueño la valida**, no el día que se fusiona.
- **Durante M0 (hasta el 13 nov), el parqueadero va primero en la validación** (D-Q1): hay un cliente esperando con fecha. Desde Q6, el orden vuelve al camino crítico de D-C4 y de la Tienda.

---

## 4. Definición de Listo y de Terminado

### 4.1 Definición de Listo (DoR)

Una historia entra a un sprint solo si:

1. Tiene criterios de aceptación verificables, con **al menos uno negativo** (❌).
2. Está estimada y cabe en un sprint (≤ 5 puntos).
3. Sus dependencias están terminadas, o van antes en el mismo sprint, **incluidas las del CORE** (§12) y las tareas del dueño (§10).
4. Dice **qué pasa con lo que ya está publicado** (P10): recibos impresos o enviados con su enlace, cajas instaladas con la versión anterior y su IndexedDB, respaldos `parqueadero-export/1` ya guardados, la impresora vinculada en cada caja. Y en qué fase va un contrato: expandir, migrar o contraer.
5. Cita su **respaldo** (PARQUEADERO §N, ADR-N, estudio §N, ED1 §N) o dice que ningún documento la cubre.
6. Si consume cuota o dinero (Worker, D1, R2, KV, cola, mensajes), trae su estimación y el nombre de su kill switch.
7. Nombra los patrones de las bitácoras que corre riesgo de repetir.
8. Si tiene pantalla, trae su boceto en palabras: qué ve el operador de pie y al sol, qué toca con una mano, el texto principal y qué dice cada estado (vacío, error, sin red, sin impresora).
9. Si traduce una norma, dice el artículo y el control técnico que la verifica (ED1 §20.1 [D5]).
10. **Si toca la impresora, WhatsApp o la cámara, dice en qué equipos reales se valida** (P16; MVP §6).

### 4.2 Definición de Terminado (DoD)

1. Fusionada a `main` por el PR del sprint, con el CI en verde: lint, typecheck, pruebas, build, licencias, commits y guardias de repositorio.
2. Pruebas unitarias de la lógica. Si toca el reloj, corren también con `TZ=Pacific/Kiritimati` (P8).
3. **Control negativo** escrito en el PR: qué defecto se puso y cómo se vio en rojo (P5).
4. **Probada con los dos parqueaderos de prueba**, Parqueadero Ensayo Uno y Parqueadero Ensayo Dos (P4). Ningún nombre real en el código: el del cliente está en la lista de términos prohibidos.
5. Si tiene pantalla: e2e a 360 px **con la red apagada**, axe sin violaciones, claro y oscuro, y textos cálidos y sin técnica (§5.3).
6. Si toca un recibo: la prueba de campos de la ley y la de paridad en verde (ADR-33).
7. Si toca la impresora, WhatsApp o la cámara: **probada en el equipo real** que dice su historia, con la fecha, el modelo del teléfono y la versión del navegador en `docs/parking/validacion/` (P16).
8. Si toca datos personales: el número del conductor no aparece en registros, eventos, respaldos ni logs (una prueba lo busca) y se borra a las 24 h de la salida (ADR-38).
9. Documentación al día en el mismo PR (P18). Si la pieza sale de PARQUEADERO, su ADR entra a `ARQUITECTURA.md`.
10. Entrada en el CHANGELOG del parqueadero (desde HU-Q0.3; antes, el de la raíz) y versión subida si se publica.
11. Desplegada en staging, prueba de humo en verde y **validada por el dueño** con los pasos que dio el asistente.
12. Si algo se rompió o se aprendió en el camino, hay entrada en `BITACORA-PARKING.md`.

---

## 5. Dirección de diseño: la caja

La caja es una herramienta de trabajo, no una vitrina: se usa de pie, al sol, con una mano, a veces con guantes y con un carro esperando. Hereda el lenguaje «editorial técnico» del ecosistema (`@ed1/ui` v2, ADR-29; BACKLOG_CORE §4.2) y le cambia el acento.

### 5.1 Premisas que el diseño no rompe

| Premisa | Qué exige al diseño |
|---|---|
| **La entrada en 10 segundos** (PARQUEADERO §5.1) | Placa, tipo, estado y «Registrar» en una sola pantalla. Nada de menús ni de pasos de confirmación en el camino normal |
| **De pie, al sol y con una mano** | Objetivos de toque de **56 px** (más que los 48 de la Tienda), texto base de 18 px, acción principal abajo y al alcance del pulgar, contraste AA calculado y nada que se diga solo con color |
| **Offline-first** | Ninguna pantalla espera a la red. No existe un «cargando» que dependa de internet |
| **P15 · El aviso va donde alguien mira** | La cabecera lleva siempre **cuatro señales**: impresora (conectada, sin probar o desconectada), respaldo (fecha del último), hora (bien o corrida) y entregas pendientes (cuántas). Nunca en un menú |
| **Lo exacto en mono** | Placa, número de recibo, montos y horas en Geist Mono con cifras tabulares; lo humano en Geist (D-C1) |
| **El acento del parqueadero** | El azul de la señal de parqueo de tránsito, validado con la prueba de contraste de `@ed1/ui` en claro y oscuro. **Modo oscuro** para el turno de noche, según el teléfono |
| **CSP `'self'` sin `'unsafe-inline'`** | Estilos en hojas y fuentes autoalojadas: la CSP ignora en silencio un `<style>` en línea (bitácora agro, terreno) |
| **Pesada como una herramienta, no como una app** | JavaScript inicial de la caja ≤ 80 KB con gzip, Dexie incluido. Lo confirma la primera medición (HU-Q3.1) |
| **El botón dice qué falta** (bitácora ecommerce, crítico) | Un botón deshabilitado nombra lo que falta («Falta la autorización») y lleva al campo |

### 5.2 Las pantallas

| Pantalla | Qué ve el operador | Historia |
|---|---|---|
| Inicio | Las estadías abiertas con el tiempo corriendo, un buscador de placa y el botón grande «Entrada» | HU-Q3.4 |
| Entrada | Teclado de placa propio, tipo de vehículo, estado con lista corta y «Registrar» | HU-Q3.3 |
| Salida | La liquidación con su detalle, el medio de pago y «Cobrar» | HU-Q3.5 |
| Recibo | Imprimir, «No salió», enviar por WhatsApp, mostrar QR y reimprimir copia | HU-Q3.6, HU-Q4.1 |
| Turno | Apertura con base, cierre con conteo, diferencia y motivo, cierre impreso | HU-Q3.9 |
| Primer uso | Datos legales de la sede, tarifas, PIN y aviso de privacidad, antes del primer recibo | HU-Q3.2, HU-Q4.4 |
| Ajustes | Sede, tarifas, recibo, papel, impresora, WhatsApp, PIN y respaldo | HU-Q3.2, HU-Q2.6, HU-Q4.3, HU-Q3.10 |
| `/r/` | La página pública del recibo, para el conductor | HU-Q4.2 |
| `/caja/imprimir/` | El recibo en HTML a 58 mm para el diálogo del sistema | HU-Q2.5 |

### 5.3 Textos: cálidos y sin técnica

| No | Sí |
|---|---|
| «GATT Server disconnected» | «La impresora está apagada o lejos» |
| «Impreso» (sin confirmación del equipo) | «Enviado a la impresora» |
| «Entregado por WhatsApp» | «Abierto en WhatsApp. ¿Se envió?» |
| «Reloj desincronizado» | «La hora de este teléfono está corrida 7 minutos. Corríjala antes de seguir» |
| «Tope excedido» | «Esta tarifa pasa del tope de Bogotá: $230 por minuto para carros» |
| «Storage no persistente» | «Este navegador puede borrar la caja si se llena el teléfono. Haga el respaldo al cerrar el turno» |
| «Validación fallida» | «Antes del primer recibo falta: el NIT y la póliza» |

### 5.4 Lo que no se hace, y por qué

- **Ningún paso extra en la entrada:** cada segundo es una fila de carros.
- **Ningún botón solo con ícono** para registrar, cobrar, imprimir o enviar.
- **Ninguna animación con JavaScript** ni sonido de fábrica.
- **Ningún tour de bienvenida:** la puesta en marcha es un servicio con una persona (HU-Q6.4).

---

## 6. Plan de sprints

### 6.1 Los sprints

| Sprint | Fechas (plan base) | Meta del sprint | Historias (puntos) | Pts | Hito |
|---|---|---|---|---|---|
| **Q0** (corto) | 7–9 oct 2026 | El plan en el repositorio, las decisiones del dueño y la PT-210 medida | HU-Q0.1 (2), HU-Q0.2 (2), HU-Q2.1 (1) | 5 | — |
| **Q1** (festivo) | 13–16 oct | **Imprimir desde el teléfono:** la PT-210 imprime la página de prueba desde la caja instalada en staging | HU-Q1.6 (2), HU-Q2.2 (5), HU-Q2.3 (5), HU-Q2.6 (3), HU-Q3.1 (3), HU-Q5.1 (2) | 20 | — |
| **Q2** | 19–23 oct | **La entrada:** las reglas puras y una entrada con su recibo impreso en menos de 10 segundos | HU-Q1.1 (5), HU-Q1.3 (3), HU-Q1.4 (5), HU-Q1.5 (3), HU-Q3.2 (3), HU-Q3.3 (5) | 24 | — |
| **Q3** | 26–30 oct | **Demostración al cliente:** salida y cobro, WhatsApp, QR en pantalla y `/r/` en su dominio | HU-Q0.3 (3), HU-Q3.4 (2), HU-Q3.5 (5), HU-Q3.6 (3), HU-Q4.1 (5), HU-Q4.2 (3), HU-Q4.4 (2), HU-Q5.2 (2) | 25 | `v0.1.0` |
| **Q4** (festivo) | 3–6 nov | **Un turno completo:** anular, reloj, turno con cierre impreso, respaldo, topes, Web Serial y el ajuste del papel | HU-Q1.2 (2), HU-Q2.4 (3), HU-Q3.7 (2), HU-Q3.8 (1), HU-Q3.9 (5), HU-Q3.10 (3), HU-Q4.3 (2) | 18 | — |
| **Q5** | 9–13 nov | **M0. El piloto:** la matriz en el equipo real, los runbooks, la aceptación sin red y el primer turno real con el cliente | HU-Q2.5 (2), HU-Q3.11 (2), HU-Q5.3 (3), HU-Q6.1 (3), HU-Q6.2 (2), HU-Q6.3 (2), HU-Q6.4 (3), HU-Q4.5 (2), HU-Q6.5 (3), HU-Q6.6 (2) | 24 | M0, `v0.2.0` |
| **Q6** (festivo) | 17–27 nov | Lo que enseñó el piloto; el parqueadero en el CORE, su celda, la sincronización común y su presupuesto | HU-Q3.12 (3), HU-Q7.1 (3), HU-Q7.2 (3), HU-Q7.3 (5), HU-Q7.13 (2), HU-Q11.1 (1) | 17 | — |
| **Q7** (festivo) | 30 nov–11 dic | La API de la celda y la caja que sincroniza; roles; el aviso de tarifas para la entrada | HU-Q7.4 (5), HU-Q7.5 (5), HU-Q7.8 (3), HU-Q11.3 (2) | 15 | — |
| **Q8** (corto) | 14–23 dic | Entrar y reclamar lo local; dispositivos; respaldo en la nube. Solo staging desde el 18 dic | HU-Q7.6 (5), HU-Q7.7 (3), HU-Q7.9 (2) | 10 | — |
| — | 24 dic–8 ene | Pausa y congelamiento. La caja del cliente sigue en `v0.3.x` | — | — | — |
| **Q9** (festivo) | 12–22 ene 2027 | **M1.** Cobro del plan por periodo, privacidad con cuenta, operación de la celda y dos cajas sin red que no repiten números | HU-Q7.10 (3), HU-Q7.11 (2), HU-Q7.12 (2), HU-Q10.1 (3), HU-Q10.2 (3), HU-Q10.4 (2) | 15 | M1, `v0.5.0` |
| **Q10** | 25 ene–5 feb | Firma sin red por dispositivo y su verificación; el generador de recibo y el sitio | HU-Q8.1 (5), HU-Q8.2 (5), HU-Q11.4 (2), HU-Q11.5 (2). HU-Q8.3 pasó a Q11 (espera R2) | 14 | — |
| **Q11** | 8–19 feb | **M2.** Fotos en la nube, mensualidades, reportes, lo que ahorra el parqueadero y el soporte medido | HU-Q8.3 (3), HU-Q8.4 (3), HU-Q8.5 (3), HU-Q8.6 (3), HU-Q8.7 (2), HU-Q10.3 (3). HU-Q8.5, HU-Q8.6 y HU-Q10.3 en el PR #156; HU-Q8.4 en el #157, sin el número del abonado; HU-Q11.6 y HU-Q11.7 en el #158 con la `v0.3.0` de la entrega. HU-Q8.3 hecha en el #158, con las fotos en el Drive de la cuenta (decisión del dueño, 12 oct 2026); HU-Q8.7 espera M1 en producción (HU-Q7.12) | 17 | M2, **`v1.0.0`** |
| **Q12** | 22 feb–5 mar | Sin el disparador de M3 (12 oct 2026), como dice la nota de abajo: el cobro del plan por periodo, que HC4 desbloqueó (#161). EQ9 sigue preparada | HU-Q7.10 (3) | 3 | — |
| **Q13** | 8–19 mar | Sin el disparador de M3 (14 oct 2026): lo que pidió el dueño con el cliente en operación. EQ9 sigue preparada | HU-Q13.1 (1), HU-Q13.2 (3), HU-Q13.3 (2), HU-Q13.4 (2), HU-Q13.5 (2), HU-Q13.6 (1), HU-Q13.7 (2), HU-Q13.8 (1) | 14 | `v0.6.0`, `v0.7.0`, `v0.7.1`, `v0.7.2`, `v0.8.0`, `v0.9.1` |

**Total:** 229 puntos en 14 sprints. M0: 116 (Q0–Q5). M1: 57 (Q6–Q9). M2: 31 (Q10–Q11). M3: 25 (Q12–Q13).

- **Q6 (17, con festivo) pasa su tope por un punto.** Si la velocidad validada de M0 no lo sostiene, HU-Q11.1 pasa a Q7. *(Hoy, 8 oct 2026: HU-Q11.2 salió de Q8 porque la medición de HU-Q11.1 dijo «se espera»; Q8 queda en 10.)*
- **Q12 lleva 10 puntos a propósito:** la verificación del negocio y la revisión de la app en Meta toman días de espera que no son puntos.
- **Si en la planeación de Q12 no se cumple el disparador de M3**, Q12 y Q13 se usan para lo que el cliente haya pedido de §9, y EQ9 queda preparada.

### 6.2 Por qué M0 no son tres semanas, y cómo se protege la fecha

PARQUEADERO §18 estimó M0 en tres semanas de construcción. Este plan cuenta lo que se **valida**, y suma lo que su §18.1 no desglosó: la matriz en el equipo real (PARQUEADERO §15.3), la versión propia y el dominio, el aviso de privacidad, los runbooks y la puesta en marcha con el cliente. Son 109 puntos. A 25 por semana son cuatro semanas y media de trabajo, más la semana del piloto.

**Cómo se protege el 30 de octubre:**

1. **El orden va por riesgo, no por pantallas.** Lo que nadie ha probado en este ecosistema (imprimir por Bluetooth desde el navegador en la PT-210) va primero, en Q0 y Q1. Si falla, hay tres semanas para el segundo camino.
2. **Cada viernes hay algo que se ve en papel:** la página de prueba (16 oct), una entrada con su recibo (23 oct) y el recorrido completo (30 oct).
3. **El orden de recorte está escrito antes de necesitarlo** (MVP §4.4): primero las cinco Should (12 puntos), luego Web Serial si el paso 0 confirma Bluetooth (3), luego el diálogo del sistema. Nunca se recortan los campos de la ley, la paridad, la matriz en la PT-210 real, el borrado del número del conductor ni el respaldo.

**Las palancas, si sobra velocidad:** adelantar HU-Q3.9 (turno) a Q3, para que la demostración muestre un cierre impreso, y adelantar M1 una semana.

### 6.3 La vista del camino crítico

```text
Dueño:  D-Q1…D-Q9 (Q0) ─► datos del cliente (14 oct) ─► zona .app activa (antes del 23 oct)
              │                    │                          │
M0:     Q0 paso 0 ─► Q1 imprimir ─► Q2 entrada ─► Q3 DEMO 30 oct ─► Q4 turno ─► Q5 PILOTO 9–13 nov
                                                                                      │
CORE:   HU-C3.1, HU-C4.3, HU-C4.4 (construidas) ─────────────────────► M1: Q6 ─► Q9 ─► M2: Q10–Q11 ─► M3 (disparador)
        HC4 (C7, 22 ene) ──────────────────────────────────────────────────► HU-Q7.10 (Q9)
```

En M0, **el camino crítico es del dueño y del cliente, no del código:** las decisiones de Q0, los datos del cliente y la zona activa. Después de M0, lo largo es M1, y nada del CORE lo frena.

---

## 7. Épicas

| Épica | Objetivo | Hitos | Pts |
|---|---|---|---|
| EQ0 · Gobierno | Plan, decisiones del dueño, datos del cliente, métricas fijadas antes de medir y versión propia | M0 | 7 |
| EQ1 · Reglas puras | `parqueadero-tarifas`, topes como contenido, `parqueadero-schema`, `parqueadero-recibos` con sus cuatro salidas, el enlace del recibo y `@ed1/whatsapp` | M0 | 20 |
| EQ2 · Impresión | `@ed1/impresion`: paso 0, ESC/POS, Web Bluetooth, Web Serial, el diálogo del sistema y el asistente con su página de prueba | M0 | 19 |
| EQ3 · Caja | La PWA: sede y tarifas, entrada, estadías, salida y cobro, pantalla del recibo, anular, reloj, turno, respaldo, abonados y los ajustes del piloto | M0, M1 | 37 |
| EQ4 · WhatsApp y recibo digital | `wa.me` con autorización, la página `/r/`, el ajuste del papel, el aviso de privacidad y el texto de responsabilidad | M0 | 14 |
| EQ5 · Sitio, dominio, despliegue y medición | Staging, el dominio en producción y los recibos por canal sin datos personales | M0 | 7 |
| EQ6 · Validación en campo y puesta en marcha | La matriz en el equipo real, runbooks, la aceptación sin red, el primer turno con el cliente, la caja más clara y el recibo como recibo | M0 | 15 |
| EQ7 · Cuenta, celda y varias cajas | El parqueadero en el CORE, celda y shard, `@ed1/sync` común, API, sincronización, entrar y reclamar, dispositivos, roles, respaldo en la nube, cobro del plan, privacidad con cuenta y presupuesto | M1 | 43 |
| EQ8 · Recibo verificado, fotos y mensualidades | Llave por dispositivo, firma sin red y su verificación, fotos en R2, mensualidades, reportes y lo que ahorra el parqueadero | M2 | 24 |
| EQ9 · WhatsApp automático | Tech Provider, registro integrado, plantilla, envío, estados, autoservicio y presupuesto de mensajes | M3 | 25 |
| EQ10 · Operación | Cron, respaldos y restauración, la salida de un parqueadero, soporte medido y runbooks de la celda | M1, M2 | 11 |
| EQ11 · Herramientas gratuitas | Medir la búsqueda, la calculadora de tarifa, el aviso de tarifas y derechos, el generador de recibo y el sitio | M1, M2 | 10 |
| EQ12 · Facturación | Integrar el facturador del parqueadero | M4 | Preparada |

---

## 8. Historias refinadas

Formato de cada historia, el del CORE y la Tienda:

- **Capa · Prioridad (MoSCoW) · Puntos · Sprint · Depende de · Estado.** Estados: `Refinada`, `En sprint`, `En validación`, `Terminada`, `Bloqueada`, `Preparada`.
- **Como / quiero / para.**
- **Respaldo:** el documento que la decide.
- **Criterios de aceptación** (CA), con al menos uno negativo (❌).
- **Boceto**, si tiene pantalla. **Lo publicado (P10)** y **Consumo y kill switch**, cuando aplican.
- **Patrones en riesgo.**
- **Work items** (WI): `[código]`, `[prueba]`, `[doc]`, `[infra]`, `[ci]`, `[diseño]`, `[dueño]` o `[campo]` (en el equipo real o con el cliente).

### 8.1 M0: las 40 historias del MVP

Refinadas, con sus criterios, bocetos y work items, en `BACKLOG-PARKING_MVP.md` §5. Aquí, su lugar en el plan:

| Historia | Épica | Prioridad | Pts | Sprint |
|---|---|---|---|---|
| HU-Q0.1 · Estudio, arquitectura, plan, backlogs y bitácora en el repositorio | EQ0 | Must | 2 | Q0 |
| HU-Q0.2 · Decisiones del dueño y datos del cliente antes de la primera línea de código | EQ0 | Must | 2 | Q0 |
| HU-Q0.3 · Versión propia y publicación del parqueadero | EQ0 | Must | 3 | Q3 |
| HU-Q1.1 · `@ed1/parqueadero-tarifas`: la liquidación pura, con el tope que nunca se pasa | EQ1 | Must | 5 | Q2 |
| HU-Q1.2 · Los topes de cada ciudad como contenido, con su vencimiento | EQ1 | Must | 2 | Q4 |
| HU-Q1.3 · `@ed1/parqueadero-schema` y el formato `parqueadero-export/1` | EQ1 | Must | 3 | Q2 |
| HU-Q1.4 · `@ed1/parqueadero-recibos`: un modelo y cuatro salidas con los campos de la ley | EQ1 | Must | 5 | Q2 |
| HU-Q1.5 · El enlace del recibo: forma completa y forma corta, con el formato de `@ed1/firma` | EQ1 | Must | 3 | Q2 |
| HU-Q1.6 · `@ed1/whatsapp`: números, texto y enlaces `wa.me` en un solo lugar | EQ1 | Must | 2 | Q1 |
| HU-Q2.1 · Paso 0: medir la PT-210 con nRF Connect antes de escribir el adaptador | EQ2 | Must | 1 | Q0 |
| HU-Q2.2 · `@ed1/impresion`: el contrato, la cola y el codificador ESC/POS a 58 mm | EQ2 | Must | 5 | Q1 |
| HU-Q2.3 · Imprimir por Web Bluetooth en la PT-210 | EQ2 | Must | 5 | Q1 |
| HU-Q2.4 · Imprimir por Web Serial: Bluetooth clásico en Android y el puerto COM en Windows | EQ2 | Must | 3 | Q4 |
| HU-Q2.5 · El diálogo de impresión del sistema a 58 mm | EQ2 | Should | 2 | Q5 |
| HU-Q2.6 · El asistente de la impresora y su página de prueba | EQ2 | Must | 3 | Q1 |
| HU-Q3.1 · La caja instalable en `/caja/`, sin red | EQ3 | Must | 3 | Q1 |
| HU-Q3.2 · Sede, tarifas y PIN: nada se registra sin los datos legales | EQ3 | Must | 3 | Q2 |
| HU-Q3.3 · La entrada en menos de 10 segundos, con su recibo impreso | EQ3 | Must | 5 | Q2 |
| HU-Q3.4 · Estadías abiertas: buscar por placa o por el QR del recibo | EQ3 | Must | 2 | Q3 |
| HU-Q3.5 · La salida y el cobro | EQ3 | Must | 5 | Q3 |
| HU-Q3.6 · La pantalla del recibo: QR, «No salió» y copias | EQ3 | Must | 3 | Q3 |
| HU-Q3.7 · Anular sin borrar | EQ3 | Must | 2 | Q4 |
| HU-Q3.8 · La hora del teléfono, comparada con la del servidor | EQ3 | Must | 1 | Q4 |
| HU-Q3.9 · El turno: apertura, cierre con conteo y cierre impreso | EQ3 | Must | 5 | Q4 |
| HU-Q3.10 · Respaldo en archivo y restauración que une | EQ3 | Must | 3 | Q4 |
| HU-Q3.11 · Abonados por placa | EQ3 | Should | 2 | Q5 |
| HU-Q4.1 · Enviar por WhatsApp con autorización, sin esperar a la red | EQ4 | Must | 5 | Q3 |
| HU-Q4.2 · La página del recibo `/r/` | EQ4 | Must | 3 | Q3 |
| HU-Q4.3 · El ajuste `papel`: siempre, o salvo recibo digital | EQ4 | Must | 2 | Q4 |
| HU-Q4.4 · El aviso de privacidad antes del primer número | EQ4 | Must | 2 | Q3 |
| HU-Q4.5 · El texto de responsabilidad del recibo de entrada, editable por la sede | EQ4 | Must | 2 | Q5 |
| HU-Q5.1 · El sitio en staging con HTTPS | EQ5 | Must | 2 | Q1 |
| HU-Q5.2 · `parqueadero.laboratorio-digital.app` declarado, reservado y en producción | EQ5 | Must | 2 | Q3 |
| HU-Q5.3 · Recibos por canal, sin datos personales | EQ5 | Should | 3 | Q5 |
| HU-Q6.1 · La matriz en el equipo real | EQ6 | Must | 3 | Q5 |
| HU-Q6.2 · Runbooks del MVP | EQ6 | Must | 2 | Q5 |
| HU-Q6.3 · La aceptación de M0, sin red, de punta a punta | EQ6 | Must | 2 | Q5 |
| HU-Q6.4 · Puesta en marcha y primer turno real | EQ6 | Must | 3 | Q5 |
| HU-Q6.5 · La caja, más clara y sobria | EQ6 | Should | 3 | Q5 |
| HU-Q6.6 · El recibo se ve como recibo | EQ6 | Should | 2 | Q5 |

### EQ3 · Caja (lo que sigue al piloto)

#### HU-Q3.12 · Lo que enseñó el piloto: los ajustes de la primera semana real
- **Capa:** caja · **Prioridad:** Must · **Puntos:** 3 · **Sprint:** Q6 · **Depende de:** HU-Q6.4 · **Estado:** Refinada
- Como operador del parqueadero cero, quiero que lo que me estorbó en la primera semana se corrija antes de sumar la cuenta, para no aprender la caja dos veces.
- **Respaldo:** PARQUEADERO §18 (el criterio de M0: un turno real sin diferencias); estudio §16.1; P6 (el cliente cero también es un cliente).
- **CA1.** Cada observación del registro del piloto (`docs/parking/validacion/piloto-parqueadero-cero.md`, de HU-Q6.4) tiene su decisión: arreglada aquí, convertida en historia con su lugar en el backlog, o descartada con el motivo.
- **CA2.** Lo que se arregla aquí cabe en 3 puntos. Lo que no cabe es una historia nueva que pasa por el refinamiento, no una ampliación de esta.
- **CA3 ❌.** Una observación sin decisión, o un arreglo sin su prueba, deja la historia sin terminar.
- **Patrones en riesgo:** P6, P16, P18.
- **Work items:** WI-Q3.12.1 `[dueño]` repasar el registro con el cliente · WI-Q3.12.2 `[código]` arreglos · WI-Q3.12.3 `[prueba]` uno por arreglo · WI-Q3.12.4 `[doc]` backlog y bitácora.

### EQ7 · Cuenta, celda y varias cajas (M1)

#### HU-Q7.1 · El parqueadero en el CORE, como dato
- **Capa:** CORE (dato) · **Prioridad:** Must · **Puntos:** 3 · **Sprint:** Q6 · **Depende de:** HU-C1.1 y HU-C1.2 (fusionadas), HU-Q0.2 (nombre comercial) · **Estado:** Hecha: la entrada en `productos.json`, los planes, la política en borrador y la prueba de que el CORE no lo nombra (PR #139); el dueño aceptó ADR-31 el 8 oct 2026 y pasa a `../ARQUITECTURA.md` §1 (WI-Q7.1.4, PR #146)
- Como dueño, quiero que el parqueadero entre al CORE por el mismo `productos.json` que el agro y la Tienda, para que la cuenta, los roles y el plan no se escriban otra vez.
- **Respaldo:** PARQUEADERO §11.1; PLATAFORMA §4.2; ADR-31; P6.
- **CA1.** `infrastructure/productos.json` tiene la entrada `parqueadero` de PARQUEADERO §11.1: orígenes de producción y staging, `rutas_de_vuelta: ["/caja/"]`, roles propietario, administrador y cajero, `gracia_dias: 7` y `excepcion: "ADR-31"`. Pasa el esquema de HU-C1.1.
- **CA2.** `content/parqueadero/planes.json` lleva los planes de estudio §10.3 como hipótesis (`gratis` y `parqueadero`, con los periodos de HU-C1.2) y `content/parqueadero/privacidad/politica.json` existe. El despliegue los copia a la base de staging (HU-C2.3).
- **CA3 ❌.** Un rol, un plan o un origen que el esquema no conoce hace fallar el CI. Ningún archivo de código del CORE nombra `parqueadero`: el producto es dato (R1), y una prueba lo busca.
- **Patrones en riesgo:** P2, P6, P10.
- **Work items:** WI-Q7.1.1 `[código]` entrada en `productos.json` · WI-Q7.1.2 `[código]` planes y política · WI-Q7.1.3 `[prueba]` esquema y búsqueda · WI-Q7.1.4 `[doc]` ADR-31 pasa aceptada a `../ARQUITECTURA.md`.

#### HU-Q7.2 · La celda c2 y el shard del parqueadero en D1
- **Capa:** datos y nube · **Prioridad:** Must · **Puntos:** 3 · **Sprint:** Q6 · **Depende de:** HU-C1.4, HU-C2.1 y HU-C11.7, HU-Q7.13 · **Estado:** Hecha (PR #145 y PR #147, 8 oct 2026; el despliegue de staging después de #147 terminó en verde con la celda preparada): c2 en `celdas.json`, la migración en `infrastructure/migraciones/parqueadero/`, las 56 comprobaciones en verde en los dos instrumentos (`tests/repo/shard-parqueadero.test.ts`) y el despliegue que prepara la celda solo en staging, con el visto bueno del dueño del 8 oct 2026. La única diferencia que apareció fue del instrumento, no de D1: bitácora parqueadero 28. La primera corrida de staging se saltó la celda: bitácora parqueadero 29
- Como dueño, quiero que el modelo que ya se probó con `node:sqlite` corra en D1 con la receta del CORE, para no descubrir en producción lo que el instrumento no ve.
- **Respaldo:** PARQUEADERO §10.2 y anexo A; P17 (`node:sqlite` no es D1).
- **CA1.** `docs/parking/sql/parqueadero/0001_parqueadero_v1.sql` se muda a `infrastructure/migraciones/parqueadero/`, y PARQUEADERO §10.2 y el anexo A enlazan el archivo en vez de copiarlo (P2). `celdas.json` gana la celda c2 del producto `parqueadero`, con shards `parqueadero_c2_s{k}` (HU-C1.4).
- **CA2.** Las 56 comprobaciones de `probar-parqueadero.mjs` corren también contra el D1 local de workerd (HU-C11.7) y dan lo mismo. Lo que difiera es una entrada de la bitácora.
- **CA3 ❌.** Con `INSERT OR IGNORE` en lugar de `ON CONFLICT (id) DO NOTHING`, la comprobación de la fila con un `CHECK` roto se ve en rojo en los dos instrumentos (bitácora parqueadero 1).
- **Lo publicado (P10):** nada; la celda nace vacía. Las cajas de M0 llegan por HU-Q7.6.
- **Consumo y kill switch:** filas por día dentro del presupuesto de HU-Q7.13; `ks:parqueadero`.
- **Patrones en riesgo:** P1, P5, P17, P18.
- **Work items:** WI-Q7.2.1 `[infra]` celda c2 · WI-Q7.2.2 `[código]` mudar la migración · WI-Q7.2.3 `[prueba]` las 56 en D1 local · WI-Q7.2.4 `[doc]` PARQUEADERO enlaza el archivo.

#### HU-Q7.3 · `@ed1/sync` sin las entidades del agro
- **Capa:** paquete · **Prioridad:** Must · **Puntos:** 5 · **Sprint:** Q6 · **Depende de:** — · **Estado:** Hecha (PR #138): `@ed1/sync` sin entidades de producto; el agro en `@ed1/agro-schema/sync` y el parqueadero en `@ed1/parqueadero-schema/sync`, con su batería y la guardia de imports
- Como equipo, quiero un solo protocolo de sincronización para el cuaderno y la caja, para que un arreglo en uno llegue al otro.
- **Respaldo:** ADR-39 (regla de tres, ED1 §3.11); ARQUITECTURA §5.6; PARQUEADERO §4.1.
- **CA1.** `packages/sync` expone el protocolo (cola de salida, push de hasta 25 operaciones, acks `aceptado`, `duplicado`, `cuarentena` y `reintentar`, pull por cursores, ids UUIDv7, versiones N-1) con las entidades como parámetro. Las del agro se mudan al cuaderno.
- **CA2.** Las pruebas del cuaderno pasan sin cambiar una aserción, y una batería nueva corre el protocolo con los tipos de registro del parqueadero.
- **CA3 ❌.** Un import de una entidad del agro dentro de `packages/sync` hace fallar una guardia de repositorio, como la de paquetes puros.
- **Lo publicado (P10):** los cuadernos instalados con la versión anterior siguen sincronizando. El formato en el cable no cambia en esta historia: es un expandir, no un contraer.
- **Patrones en riesgo:** P2, P10, P17.
- **Work items:** WI-Q7.3.1 `[código]` extraer el protocolo · WI-Q7.3.2 `[prueba]` el cuaderno intacto · WI-Q7.3.3 `[prueba]` batería del parqueadero · WI-Q7.3.4 `[ci]` guardia de imports · WI-Q7.3.5 `[doc]` ARQUITECTURA §5.6.

#### HU-Q7.4 · `parqueadero-api`: salud, push, pull y cuarentena
- **Capa:** API de la celda · **Prioridad:** Must · **Puntos:** 5 · **Sprint:** Q7 · **Depende de:** HU-Q7.2, HU-Q7.3, HU-Q7.13, HU-C4.1 · **Estado:** Hecha (PR #148, 8 oct 2026; el despliegue de staging terminó en verde, con la prueba de humo de `/api/salud` y el 401 sin token): la API en `apps/parqueadero-api` con salud, push, pull y cuarentena; 30 pruebas en los dos instrumentos de D1 con sus controles negativos; el despliegue de staging la publica en `parqueadero-api-c2-staging` (PARQUEADERO §12). Hasta HU-Q7.7 una caja sin alta manda sus recibos a cuarentena
- Como caja, quiero subir mis registros y bajar los de las otras cajas de la sede, sin perder ni repetir uno, para que dos cajas cuadren.
- **Respaldo:** PARQUEADERO §12 y §10.2; las convenciones de la celda agro.
- **CA1.** Hono, solo `/api/*`. `GET /api/salud` sin token; `POST /api/v1/sync/push` y `GET /api/v1/sync/pull` con el token del CORE (`aud = parqueadero`) verificado sin llamar al CORE, y el `org_id` del token en cada consulta (lo exige la prueba de repositorio de `org_id`).
- **CA2.** El push escribe con `INSERT … ON CONFLICT (id) DO NOTHING`: un reenvío devuelve `duplicado`; un consecutivo repetido o un `CHECK` roto devuelve `cuarentena` con su motivo. Un lote que falla se reintenta operación por operación, y solo la mala va a cuarentena.
- **CA3.** Con `ks:parqueadero` apagado responde `503` con `Retry-After`, y la caja sigue registrando (HU-Q7.5).
- **CA4 ❌.** Un token de otro producto (`aud = tienda`), de otra organización o vencido devuelve 401 o 403 y no escribe. Un `INSERT OR IGNORE` puesto a propósito pone en rojo la prueba de la fila con el `CHECK` roto.
- **Consumo y kill switch:** unas 6 filas por vehículo (PARQUEADERO §10.3); `ks:parqueadero`; el vigía de HU-Q7.13.
- **Patrones en riesgo:** P1, P5, P12, P17.
- **Permisos (HU-Q7.8):** cada operación del push pasa por `decidirEscritura` de `@ed1/parqueadero-schema/sync` con el rol y el usuario del token; una negada va a cuarentena con su motivo, y la prueba de CA3 de HU-Q7.8 se repite contra la ruta (WI-Q7.8.2).
- **Work items:** WI-Q7.4.1 `[código]` app y rutas · WI-Q7.4.2 `[código]` push con reintento por operación · WI-Q7.4.3 `[prueba]` D1 local con los dos parqueaderos de prueba · WI-Q7.4.4 `[infra]` `parqueadero-api-c2` en staging · WI-Q7.4.5 `[doc]` PARQUEADERO §12.

#### HU-Q7.5 · La caja sincroniza sin cortar una venta
- **Capa:** caja · **Prioridad:** Must · **Puntos:** 5 · **Sprint:** Q7 · **Depende de:** HU-Q7.4 · **Estado:** Hecha (PR #151, fusionado el 8 oct 2026): en staging. CA3 con dos navegadores, 5 vehículos por caja para cuidar los minutos de CI (`tests/e2e/parqueadero-dos-cajas.spec.ts`), y con las 20 por caja en el arnés (`tests/integracion/parqueadero-dos-cajas.test.ts`); CA4 en el arnés, y lo de no recargar con la cola llena es HU-Q3.1 CA3, porque la cola vive en IndexedDB. Hasta HU-Q7.6 ninguna caja tiene `nube` y la cola no se llena; hasta HU-Q7.7 una caja nueva toma la serie A y lo suyo va a cuarentena con el motivo de la serie
- Como cajero, quiero que lo que registro llegue solo a la celda cuando hay red, sin que la caja me haga esperar, para no pensar en la sincronización.
- **Respaldo:** PARQUEADERO §5.2 (`outbox`, `rechazos`) y §5.3 (reglas 1, 3 y 4); ARQUITECTURA §5.3 (las tres señales del cuaderno).
- **CA1.** Cada registro nuevo entra a `outbox` en la misma transacción de IndexedDB que el registro. El envío corre en segundo plano y nunca entre el toque de «Registrar» y el recibo.
- **CA2.** La cabecera dice dónde está el dato con los tres estados del cuaderno («en este dispositivo», «enviando», «en la nube») y cuántos hay en cuarentena. Un rechazo se ve con su motivo en palabras.
- **CA3.** Dos cajas sin red registran 20 entradas y salidas cada una, se conectan y quedan con los mismos registros, sin números repetidos ni perdidos (e2e con dos contextos de navegador).
- **CA4 ❌.** Con la red cortada a mitad de un push, ningún registro se pierde ni se duplica. Una versión nueva de la app con la cola llena no recarga mientras haya un formulario abierto o una impresión en curso.
- **Lo publicado (P10):** las cajas sin cuenta (`v0.2.x` y `v0.3.x`) siguen igual; la cola solo se llena después de entrar (HU-Q7.6).
- **Patrones en riesgo:** P1, P10, P15, P21.
- **Work items:** WI-Q7.5.1 `[código]` cola y envío · WI-Q7.5.2 `[código]` cabecera · WI-Q7.5.3 `[prueba]` e2e de dos cajas · WI-Q7.5.4 `[prueba]` corte a mitad del push.

#### HU-Q7.6 · Entrar desde la caja y reclamar lo local
- **Capa:** caja y API · **Prioridad:** Must · **Puntos:** 5 · **Sprint:** Q8 · **Depende de:** HU-Q7.5, HU-C3.1, HU-C4.3, HU-C4.4 · **Estado:** Hecha (PR #153, fusionado el 8 oct 2026): en staging, «Cuenta y nube» en la caja (`apps/parqueadero-sitio/src/caja/cuenta.ts`) y `POST /api/v1/reclamar` con `GET /api/v1/resumen` en la celda (`apps/parqueadero-api/src/dispositivos.ts`). CA2 cambia de forma por el plan gratuito: la celda registra la caja con su serie y lo de la caja sube por la cola, de a 25 y con los mismos ids; la caja lo da por subido cuando `resumen` dice lo mismo que ella (P21; bitácora, «Cambios de rumbo»). CA4 lo cubre la restauración, que ya rechazaba el archivo entero; WI-Q7.6.3 con un respaldo hecho por el código de `v0.2.0` (`tests/fixtures/parqueadero-respaldo-v0.2.0.json`). Quedan para el refinamiento con el cliente: el `auth_time` de CA3 y WI-Q7.8.3, que esperan a saber cómo entra un cajero sin Google (CA1); hasta entonces sigue el PIN. WI-Q7.6.5 es del dueño, en staging
- Como propietario del parqueadero cero, quiero crear mi cuenta y subir todo lo que la caja guardó desde el piloto, con los mismos números, para no empezar de cero.
- **Respaldo:** PARQUEADERO §11.3 y §5.4; HU-E4.3 del agro (el mismo patrón); P21.
- **CA1.** «Entrar» lleva a la cuenta con el producto `parqueadero` (HU-C3.1) y vuelve a `/caja/` con un token v2 (`aud = parqueadero`, HU-C4.3) que se refresca por producto (HU-C4.4). Mientras no exista entrar con correo (HU-C10.2, C11), entrar pide una cuenta de Google: cómo trabaja un cajero que no la tiene se decide con el cliente en el refinamiento de Q8.
- **CA2.** `POST /api/v1/reclamar` carga un `parqueadero-export/1` con los mismos ids y es idempotente. La caja marca lo local como enviado solo después de que la celda lo escribe y lo verifica (P21).
- **CA3.** El primer dispositivo conserva su serie «A». Los ajustes sensibles (tarifas, datos legales, el WhatsApp de la sede) piden `auth_time` reciente en vez del PIN de M0.
- **CA4 ❌.** Un archivo de otra organización, uno alterado (su huella no coincide) o uno de una versión desconocida se rechaza entero, con el motivo, y no borra nada local.
- **Lo publicado (P10):** los respaldos hechos en M0 se pueden reclamar; una prueba guarda uno de `v0.2.0`.
- **Patrones en riesgo:** P6, P10, P21.
- **Work items:** WI-Q7.6.1 `[código]` entrar y volver · WI-Q7.6.2 `[código]` reclamar · WI-Q7.6.3 `[prueba]` con un respaldo de `v0.2.0` · WI-Q7.6.4 `[prueba]` archivo alterado · WI-Q7.6.5 `[campo]` reclamar en staging un respaldo de Ensayo Uno hecho con `v0.2.0`.
- **Permisos (HU-Q7.8):** con la cuenta, la caja esconde lo que `TABLA` niega al rol del token y deja de pedir el PIN para eso (WI-Q7.8.3).
- **Lo que no hace:** reclamar la caja del cliente en producción. Eso pasa en HU-Q7.12, después de que HU-Q7.11 deja lista la promesa de privacidad con cuenta.

#### HU-Q7.7 · Dispositivos: alta con serie y retiro
- **Capa:** API y caja · **Prioridad:** Must · **Puntos:** 3 · **Sprint:** Q8 · **Depende de:** HU-Q7.6 · **Estado:** Hecha (PR #153, fusionado el 8 oct 2026): en staging, `POST`/`GET /api/v1/dispositivos` y `/retirar`; la caja retirada recibe 403 en push y pull, y su sesión de la cuenta se cierra con `telefonos/retirar` del CORE (el acceso ya emitido vence solo en 12 h). Las cajas en «Cuenta y nube»; runbook `docs/runbooks/parqueadero-retirar-caja.md`
- Como propietario, quiero dar de alta una segunda caja y retirar un teléfono perdido, para que dos cajas no repitan números y un teléfono robado no siga entrando.
- **Respaldo:** PARQUEADERO §5.4, §11.4 (puntos 1 y 3) y §12; runbook «Retirar un dispositivo» (PARQUEADERO §14.5).
- **CA1.** `POST /api/v1/dispositivos` da a cada dispositivo nuevo la siguiente serie libre del parqueadero; la base la hace única (anexo A).
- **CA2.** `/retirar` corta la sesión del dispositivo. Lo que registró antes sigue valiendo y se ve con su serie.
- **CA3 ❌.** Un registro que llega con una serie que no es la de su dispositivo va a cuarentena. Un dispositivo retirado no puede subir nada más.
- **Patrones en riesgo:** P1, P12.
- **Work items:** WI-Q7.7.1 `[código]` rutas · WI-Q7.7.2 `[código]` pantalla de dispositivos · WI-Q7.7.3 `[prueba]` serie ajena y retirado · WI-Q7.7.4 `[doc]` runbook (HU-Q10.4).

#### HU-Q7.8 · Roles y permisos como dato, los mismos en la caja y en la celda
- **Capa:** paquete, API y caja · **Prioridad:** Must · **Puntos:** 3 · **Sprint:** Q7 · **Depende de:** HU-Q7.1 · **Estado:** Hecha (PR #140, fusionado el 8 oct 2026): la matriz como dato y `decidirEscritura` (WI-Q7.8.1), la prueba de la matriz entera y su atadura a §11.2 y a `productos.json` (WI-Q7.8.4). La API decide con ella en HU-Q7.4 (WI-Q7.8.2) y la caja la usa al entrar con cuenta en HU-Q7.6 (WI-Q7.8.3); en M0 sigue el PIN
- Como propietario, quiero que un cajero no pueda cambiar tarifas ni anular lo de otro, para que el cierre de turno sea creíble.
- **Respaldo:** PARQUEADERO §11.2; `packages/sync/src/permisos.ts` (el modelo del cuaderno); bitácora ecommerce 64 (un permiso escondido en la página es un adorno).
- **CA1.** La matriz de PARQUEADERO §11.2 vive en un archivo de dato que importan la API, que decide, y la caja, que esconde.
- **CA2.** El cajero anula solo lo suyo, en los primeros 10 minutos y con motivo. Reimprimir queda registrado con su usuario.
- **CA3 ❌.** Una llamada directa a la API con un token de cajero para cambiar una tarifa devuelve 403 aunque la caja esconda el botón. Una prueba recorre la matriz entera contra la API.
- **Patrones en riesgo:** P2, P12.
- **Work items:** WI-Q7.8.1 `[código]` matriz · WI-Q7.8.2 `[código]` API · WI-Q7.8.3 `[código]` caja · WI-Q7.8.4 `[prueba]` matriz completa.

#### HU-Q7.9 · Respaldo en la nube y exportación
- **Capa:** API · **Prioridad:** Must · **Puntos:** 2 · **Sprint:** Q8 · **Depende de:** HU-Q7.6 · **Estado:** Hecha (PR #153, fusionado el 8 oct 2026): en staging. CA1 cambia de forma por el plan gratuito: sin R2 ni enlace temporal, la caja al día con la nube arma el mismo `parqueadero-export/1` con lo de todas las cajas y lo compara con `GET /api/v1/resumen`; la prueba de ida y vuelta es la del respaldo de `v0.2.0` reclamado. CA2 hecho («Respaldo», la cabecera y el cierre de turno). CA3: sin enlaces no hay enlace vencido; otra organización no ve nada, ni en el pull ni en el resumen
- Como propietario, quiero descargar todo lo de mi parqueadero cuando quiera, para no depender de que el teléfono no se pierda.
- **Respaldo:** PARQUEADERO §12 (`/api/v1/exportar`), §5.3 regla 6 y §2.2.
- **CA1.** `POST /api/v1/exportar` arma un `parqueadero-export/1` completo en R2 y devuelve un enlace temporal. Es el mismo formato del respaldo de M0 y de la carga al reclamar: una prueba de ida y vuelta los ata (P2).
- **CA2.** La pantalla de respaldo dice la fecha del último respaldo en la nube. Con la caja sincronizada, el cierre de turno deja de pedir el archivo.
- **CA3 ❌.** Un enlace vencido no descarga, y nadie puede pedir la exportación de otra organización.
- **Consumo y kill switch:** R2 dentro de la capa gratuita; la purga de exportaciones vencidas es del cron de HU-Q10.1.
- **Patrones en riesgo:** P2, P21.
- **Work items:** WI-Q7.9.1 `[código]` exportar · WI-Q7.9.2 `[prueba]` ida y vuelta · WI-Q7.9.3 `[código]` pantalla.

#### HU-Q7.10 · El cobro del plan por periodo
- **Capa:** CORE y caja · **Prioridad:** Must · **Puntos:** 3 · **Sprint:** Q12 (HC4 llegó con el #161) · **Depende de:** HU-C5.3, HU-C5.5 y HU-C5.6 (HC4), HU-Q7.1, D-Q5 · **Estado:** Hecha: en producción con la `v0.5.0` (13 oct 2026); el primer cliente tiene el plan pagado hasta el 20 oct 2027 (en efectivo, HU-C5.8). **CA1 cambia de forma:** el CORE no le avisa a la celda; la celda lee el plan del token, que el CORE ya emite con la gracia del producto (HU-C5.5), y la caja renueva su acceso al volver de Bold (bitácora, «Cambios de rumbo»). Pagar lo ve quien tiene «Equipo, plan y pago» (el propietario, §11.2). El precio lo fijó el dueño el 13 oct 2026: COP 29.900 al mes. Pendiente: WI-Q7.10.4
- Como propietario, quiero pagar 1, 3, 6 o 12 meses del plan con Bold desde la caja, para no depender de un link manual.
- **Respaldo:** PARQUEADERO §11.1 (`gracia_dias: 7`) y §14.2; PLATAFORMA §4.13; estudio §10.3.
- **CA1.** La caja muestra el plan, su vencimiento (`plan_vence` del token) y «Pagar», que abre el cobro del CORE con el producto `parqueadero`. El CORE avisa el pago a la celda (`POST /api/servicio/plan`).
- **CA2.** Siete días de gracia con aviso en la cabecera. Lo que el cliente pagó a mano desde el piloto (D-Q5) se registra como sus primeros periodos.
- **CA3 ❌.** **Un plan vencido nunca detiene una entrada, un cobro ni un recibo:** apaga la sincronización y el respaldo en la nube, y lo dice. Una prueba registra y cobra con el plan vencido.
- **Patrones en riesgo:** P1, P8, P21.
- **Work items:** WI-Q7.10.1 `[código]` plan en la caja · WI-Q7.10.2 `[código]` aviso a la celda · WI-Q7.10.3 `[prueba]` plan vencido · WI-Q7.10.4 `[dueño]` registrar los periodos pagados a mano.

#### HU-Q7.11 · La promesa de privacidad cambia con la cuenta
- **Capa:** legal · **Prioridad:** Must · **Puntos:** 2 · **Sprint:** Q9 · **Depende de:** HU-Q4.4, HU-Q7.5 · **Estado:** Hecha (PR #154, fusionado el 8 oct 2026): en staging. Los términos y el contrato de transmisión en `content/parqueadero/privacidad/terminos.json` (borrador para revisión de abogado), «Entrar con Google» solo con la casilla marcada, la versión y la hora en `meta` y en la fila de la caja (migración 0002), `?terminos=` en cada pedido a la celda y 403 `sin-terminos` sin ellos. Falta WI-Q7.11.1: los datos de Laboratorio Digital como encargado (hoy dicen «por completar»)
- Como parqueadero que crea su cuenta, quiero que lo que dice la caja sobre mis datos siga siendo cierto, para no prometer lo que ya no es.
- **Respaldo:** PARQUEADERO §13.2 (en M1 y M2, ED1 es Encargado) y §2.3 punto 5; estudio §13.5; Decreto 1377 art. 25.
- **CA1.** Antes de entrar, la caja dice qué pasa a la nube (registros, placas y, desde M2, fotos) y qué no (el número del conductor), y pide aceptar los términos con el contrato de transmisión. La aceptación queda con su versión y su hora.
- **CA2.** «Sus datos no salen de este teléfono» solo aparece en una caja sin cuenta; una prueba lo busca en las pantallas con sesión.
- **CA3 ❌.** Una caja con cuenta que no aceptó la versión vigente no sincroniza, y dice por qué.
- **Patrones en riesgo:** P1, P18.
- **Work items:** WI-Q7.11.1 `[dueño]` datos de Laboratorio Digital como encargado · WI-Q7.11.2 `[código]` · WI-Q7.11.3 `[prueba]` · WI-Q7.11.4 `[doc]` política y términos.

#### HU-Q7.12 · M1 en producción: dos cajas sin red que no repiten números
- **Capa:** aceptación · **Prioridad:** Must · **Puntos:** 2 · **Sprint:** Q12 · **Depende de:** HU-Q7.1 a HU-Q7.11, HU-Q7.13, HU-Q10.1 · **Estado:** En validación (13 oct 2026): el dueño pidió M1 en producción con la caja del cliente ya en operación. Se publica con la `0.5.0` (y el CORE `0.5.0`, por el directorio y el precio) **antes** de la prueba de dos cajas, que va después en el campo (`docs/parking/validacion/m1-dos-cajas.md`). Pendientes: CA1 y CA2 en el campo, CA3 (la humo de producción no revisa todavía los parqueaderos de prueba) y WI-Q7.12.4 (la revisión del abogado)
- Como dueño, quiero ver el criterio de M1 cumplido en producción con el cliente, para publicar `v0.5.0` sabiendo que funciona.
- **Respaldo:** PARQUEADERO §18 (criterio de M1).
- **CA1.** En producción, dos teléfonos sin red registran entradas y salidas de la misma sede, se conectan y quedan con los mismos registros, sin números repetidos ni perdidos. Lo registra `docs/parking/validacion/m1-dos-cajas.md`.
- **CA2.** La caja del cliente se reclama en producción con todo lo del piloto (HU-Q7.6), después de aceptar los términos de HU-Q7.11, y el respaldo semanal corrió al menos una vez (HU-Q10.1).
- **CA3 ❌.** La prueba de humo de producción comprueba que los parqueaderos de prueba **no** están en la base de producción (P11).
- **Patrones en riesgo:** P11, P16.
- **Work items:** WI-Q7.12.1 `[campo]` dos cajas con el cliente · WI-Q7.12.2 `[prueba]` humo de producción · WI-Q7.12.3 `[doc]` validación y CHANGELOG · WI-Q7.12.4 `[legal]` el aviso de privacidad con cuenta nombra la copia en el Drive del parqueadero y sus fotos, con la revisión pendiente del abogado (HU-Q10.1 y HU-Q8.3 la suben también en producción desde la `0.5.0`).

#### HU-Q7.13 · El presupuesto en el plan gratuito: filas de D1, vigía y kill switches
- **Capa:** operación · **Prioridad:** Must · **Puntos:** 2 · **Sprint:** Q6 · **Depende de:** HU-C3.6, HU-C11.1, D-Q10 · **Estado:** Hecha (PR #142, fusionado el 8 oct 2026): medido 1.699 filas al día en la cuenta (reporte semanal al 8 oct); presupuesto de 70.000 filas al día, unos 38 parqueaderos, en `productos.json` y no en un `product.yaml` (PARQUEADERO §14.1 dice por qué); el vigía reparte las filas por producto y avisa al 50, 75 y 90 %, con la simulación al 95 %. Las claves `ks:parqueadero` y `ks:parqueadero-fotos` quedan declaradas y las crea HU-Q7.2 en el KV de su celda. La caja de M0 no lee nada de la nube: que siga registrando con la sincronización apagada lo prueba HU-Q7.5 CA4
- Como dueño, quiero saber cuántos parqueaderos caben en el plan gratuito y que el vigía avise antes del límite, para activar Workers Paid solo cuando haga falta.
- **Respaldo:** la decisión del dueño del 6 oct 2026 («Workers Paid ya no es condición: se activa solo si hace falta»); PARQUEADERO §10.3, §14.1 y §14.2; PLATAFORMA §4.10. Nace del contraste (bitácora parqueadero 6).
- **CA1.** `apps/parqueadero-api/product.yaml` declara el presupuesto en filas escritas por día y en dólares. El límite es de la cuenta, no del producto: 100.000 filas escritas al día en D1 entre el agro, el CORE, la Tienda y el parqueadero. El tope práctico de parqueaderos se calcula con lo que los otros ya escriben, **medido**, no supuesto.
- **CA2.** El vigía de la plataforma avisa por Telegram al 50, 75 y 90 % del límite diario y dice qué producto lo está gastando. `ks:parqueadero` y `ks:parqueadero-fotos` existen en KV, con su caché dicha en el runbook.
- **CA3 ❌.** Con el límite simulado al 95 %, el vigía avisa y la caja **sigue registrando y cobrando**: la degradación apaga la sincronización, nunca la venta.
- **Patrones en riesgo:** P1, P7, P15.
- **Work items:** WI-Q7.13.1 `[código]` `product.yaml` · WI-Q7.13.2 `[código]` filas por día en el vigía · WI-Q7.13.3 `[prueba]` simulación al 95 % · WI-Q7.13.4 `[doc]` PARQUEADERO §14.1.

### EQ8 · Recibo verificado, fotos y mensualidades (M2)

#### HU-Q8.1 · Llave por dispositivo y certificado de la celda
- **Capa:** paquete, API y caja · **Prioridad:** Must · **Puntos:** 5 · **Sprint:** Q10 · **Depende de:** HU-Q7.7, HU-Q1.5 · **Estado:** Hecha (PR #155, fusionado el 8 oct 2026; el despliegue de staging terminó en verde)
- Como parqueadero, quiero que cada caja firme sus recibos sin red con una llave que nunca sale de ella, para que un recibo se pueda verificar aunque se emita sin señal.
- **Respaldo:** ADR-36; PARQUEADERO §11.4 y §6.3; ARQUITECTURA §5.9 (el QR firmado del agro).
- **CA1.** Al darse de alta, la caja genera un par Ed25519 con WebCrypto, con la llave privada no exportable en IndexedDB, y manda la pública. `POST /api/v1/dispositivos/certificado` devuelve un certificado firmado con `CELDA_RECIBO_PRIVATE_KEY`, que vence a los 30 días y se renueva solo en su última semana.
- **CA2.** `@ed1/firma` sale de `packages/trazabilidad` (ADR-39) con el formato `datos.firma[.certificado]` que HU-Q1.5 ya publica, y el agro sigue verificando sus QR con las mismas pruebas.
- **CA3 ❌.** Si el navegador no puede firmar con Ed25519, la caja emite sin firma y lo dice; **nunca cambia a una llave exportable**. La llave de recibos de la celda se genera una vez, y una prueba falla si el despliegue intenta reemplazarla.
- **Patrones en riesgo:** P2, P13, P17.
- **Work items:** WI-Q8.1.1 `[código]` extraer `@ed1/firma` · WI-Q8.1.2 `[código]` llave y certificado · WI-Q8.1.3 `[prueba]` el agro intacto · WI-Q8.1.4 `[prueba]` sin Ed25519 · WI-Q8.1.5 `[infra]` la llave de la celda · WI-Q8.1.6 `[doc]` ADR-36 aceptada.

#### HU-Q8.2 · El recibo firmado sin red y su verificación en `/r/`
- **Capa:** caja y página · **Prioridad:** Must · **Puntos:** 5 · **Sprint:** Q10 · **Depende de:** HU-Q8.1, HU-Q4.2 · **Estado:** Hecha (PR #155, fusionado el 8 oct 2026; el despliegue de staging terminó en verde)
- Como conductor, quiero saber que mi recibo es auténtico, aunque lo haya recibido de una caja sin señal.
- **Respaldo:** PARQUEADERO §6.3 (los casos y los tamaños); ADR-36.
- **CA1.** El enlace completo pasa a `#1.<datos>.<firma>.<certificado>`. `/r/` verifica la cadena con las llaves públicas de las celdas horneadas en el build (`GET /api/claves-recibo`), sin llamar a la API al abrir.
- **CA2.** Los cuatro casos de PARQUEADERO §6.3: verificado, en verde; sin firma, «Copia digital del recibo», sin alarma; alterado, en rojo; certificado vencido al emitir, en ámbar.
- **CA3.** El QR del papel sigue siendo la forma corta, en la versión 7. El enlace firmado solo va por WhatsApp y en pantalla.
- **CA4 ❌.** Cambiar un byte del fragmento muestra «Este recibo fue modificado». Un enlace `#1.` de M0, sin firma, sigue abriendo igual.
- **Lo publicado (P10):** todos los enlaces `#1.` y `#c.` impresos o enviados desde `v0.1.0`.
- **Patrones en riesgo:** P5, P10, P13.
- **Work items:** WI-Q8.2.1 `[código]` firmar al emitir · WI-Q8.2.2 `[código]` verificar en `/r/` · WI-Q8.2.3 `[prueba]` los cuatro casos · WI-Q8.2.4 `[prueba]` enlaces de cada versión publicada · WI-Q8.2.5 `[campo]` modo avión en dos teléfonos.

#### HU-Q8.3 · Fotos del estado en la nube por 30 días
- **Capa:** caja · **Prioridad:** Must · **Puntos:** 3 · **Sprint:** Q11 · **Depende de:** HU-Q10.1, HU-Q3.3 · **Estado:** Hecha (PR #158, 12 oct 2026), en staging, como Drive de HU-Q10.1. **Cambió el 12 oct 2026 por decisión del dueño:** «Las fotos en la nube, van para la cuenta del drive por ahora»: ya no espera R2. Los términos de la nube pasan a la versión 2, que dice adónde van las fotos (WI-Q8.3.5). De paso, la purga del teléfono que prometía PARQUEADERO §5.5 no existía y sale en la `0.3.0` (bitácora 36)
- Como parqueadero, quiero que las fotos del estado sobrevivan a un teléfono perdido durante la estadía y un mes más, para responder un reclamo.
- **Respaldo:** PARQUEADERO §5.5; ADR-15; bitácora parqueadero 8; HU-Q10.1 (la carpeta de Drive y su permiso). Cambios de rumbo de la bitácora, 12 oct 2026.
- **CA1.** Al guardar la copia en Drive (HU-Q10.1), con el mismo permiso, suben las fotos que falten a la carpeta «Caja del parqueadero · fotos · caja <serie>», con su formato real; una que ya está no sube otra vez. No suben solas: el permiso de Google dura una hora y no se renueva sin la persona (`drive.file`, sin refresh token), así que la copia del cierre de turno es la que las lleva. Registrar nunca espera a Drive (regla 1). Si las fotos fallan, la copia ya quedó y se dice aparte; la próxima sube las que faltan.
- **CA2.** En el teléfono, una foto se borra 30 días después de cerrada su estadía (la salida vigente o la anulación de la entrada; una salida anulada la vuelve a abrir). Las que borró esta caja se borran de su carpeta de Drive con la copia siguiente. **❌** Una caja restaurada desde la copia no borra de Drive nada que subió otra. `/r/` no las muestra (el Drive del parqueadero no es público).
- **CA4.** El formato del recibo no nombra a Drive: si las fotos vuelven a R2, los recibos de antes siguen leyéndose igual.
- **CA3 ❌.** Una foto que el navegador no puede codificar en WebP sube como JPEG con su formato real. La prueba usa un `toBlob` que devuelve PNG, como Safari: nunca sube un PNG con nombre `.webp`.
- **Consumo y kill switch:** sin costo para ED1 (el espacio es del Drive del parqueadero) y sin escrituras en D1. `ks:parqueadero-fotos` no aplica: las fotos no pasan por la celda.
- **Patrones en riesgo:** P13, P17, P20.
- **Work items:** WI-Q8.3.1 `[código]` subida a Drive · WI-Q8.3.2 `[código]` borrado a los 30 días · WI-Q8.3.3 `[prueba]` formato real · WI-Q8.3.4 `[campo]` iPhone y Android · WI-Q8.3.5 `[legal]` términos de la nube con las fotos.

#### HU-Q8.4 · Mensualidades: planes de abonado, cobro y recordatorio
- **Capa:** caja y paquete · **Prioridad:** Must · **Puntos:** 3 · **Sprint:** Q11 · **Depende de:** HU-Q3.11, HU-Q7.5 · **Estado:** Hecha (PR #157, fusionado el 9 oct 2026). CA2 cambiado por el dueño el 9 oct 2026: sin el WhatsApp del abonado, la caja lista las que vencen en 5 días y el cajero las recuerda en persona. El plan «noches» espera la tarifa de noche del cliente
- Como administrador, quiero cobrar las mensualidades y recordar las que vencen, para dejar el cuaderno de abonados.
- **Respaldo:** PARQUEADERO §0 (M2) y §8.4 (empujón 2); estudio §7.1 y §12.2 (herramienta 5); bitácora parqueadero 7.
- **CA1.** Un abonado tiene plan (mes, quincena o noches), placas, vigencia y valor. El pago es un registro `pago_abonado` con su número de recibo, y el prorrateo de un mes empezado sale de `parqueadero-tarifas`.
- **CA2.** La caja lista las mensualidades que vencen en 5 días con «Recordar por WhatsApp». **El número del abonado sigue ADR-38:** solo en el dispositivo que lo registró, con su autorización y una sola finalidad (los recordatorios de la mensualidad), y se borra 30 días después de que la mensualidad vence. Esa ampliación de ADR-38 entra a ARQUITECTURA con esta historia (P18).
- **CA3 ❌.** Una mensualidad vencida no entra como abonado: liquida como visitante y la caja lo dice.
- **Patrones en riesgo:** P8, P13, P18.
- **Work items:** WI-Q8.4.1 `[código]` abonados y pagos · WI-Q8.4.2 `[código]` prorrateo en `parqueadero-tarifas` · WI-Q8.4.3 `[código]` recordatorio · WI-Q8.4.4 `[prueba]` vencida y borrado · WI-Q8.4.5 `[doc]` ADR-38.

#### HU-Q8.5 · Reportes por turno y por cajero
- **Capa:** caja · **Prioridad:** Must · **Puntos:** 3 · **Sprint:** Q11 · **Depende de:** HU-Q7.8, HU-Q3.9 · **Estado:** Hecha (PR #156, fusionado el 9 oct 2026; el despliegue de staging terminó en verde): Más › «Reportes» con los turnos del día de todas las cajas que el teléfono tiene, cada uno con `resumirTurno` como su cierre; el cajero con cuenta ve los de su caja; CSV para Excel; «Totales parciales» con un turno abierto o un registro en cuarentena (CA3, con su control negativo)
- Como propietario, quiero ver desde mi casa los turnos de todas las cajas con sus diferencias, anulaciones y copias por cajero, para cuadrar sin ir al parqueadero.
- **Respaldo:** PARQUEADERO §13.1 (control de fraude) y §11.2 (quién ve qué); estudio §12.1 («cuadrar la plata»).
- **CA1.** Un reporte por día y por turno: entradas, salidas, total por medio de pago, diferencia del cierre con su motivo, y anulaciones y copias por cajero. Se calcula en el dispositivo con lo sincronizado, y el día comercial es el de Bogotá.
- **CA2.** El cajero ve solo el suyo; propietario y administrador, todos (HU-Q7.8). Se exporta a CSV para Excel.
- **CA3 ❌.** Un reporte con registros en cuarentena lo dice arriba y no da el total por cerrado (P1).
- **Patrones en riesgo:** P1, P8, P15.
- **Work items:** WI-Q8.5.1 `[código]` · WI-Q8.5.2 `[prueba]` con cuarentena · WI-Q8.5.3 `[prueba]` CSV.

#### HU-Q8.6 · Lo que ahorra el parqueadero: recibos por canal y papel
- **Capa:** caja · **Prioridad:** Should · **Puntos:** 3 · **Sprint:** Q11 · **Depende de:** HU-Q5.3, HU-Q7.5 · **Estado:** Hecha (PR #156, fusionado el 9 oct 2026; el despliegue de staging terminó en verde): Más › «Lo que ahorra» por semana y por mes, con `sede.costo_papel` opcional y sin valor de fábrica; las entregas cuadran con los eventos de HU-Q5.3 en una prueba con la caja (CA2); «No se envió» no cuenta como digital (CA3), y el cierre de turno, que sí lo contaba, quedó corregido (bitácora parqueadero 33)
- Como propietario, quiero ver cuántos recibos salieron por WhatsApp, en pantalla y en papel, y cuánto me ahorré en pesos, para decidir pasar a `salvo_digital`.
- **Respaldo:** PARQUEADERO §8.4 (COP 11 a 15 por recibo) y §14.4; la métrica «recibo digital» de §18.2.
- **CA1.** La caja muestra, por semana y por mes, los recibos por canal y el papel ahorrado, con el valor por recibo que declara la sede. Ese valor no tiene uno de fábrica (P1): se pide al configurarlo.
- **CA2.** Los números salen de los registros `entrega_recibo`, sin teléfono ni texto, y cuadran con los eventos de HU-Q5.3 del mismo periodo.
- **CA3 ❌.** Una entrega `abierto_en_whatsapp` que el operador marcó «No se envió» no cuenta como digital.
- **Patrones en riesgo:** P1, P2, P17.
- **Work items:** WI-Q8.6.1 `[código]` · WI-Q8.6.2 `[prueba]` cuadre con los eventos.

#### HU-Q8.7 · M2 aceptado y `parqueadero-v1.0.0`
- **Capa:** aceptación · **Prioridad:** Must · **Puntos:** 2 · **Sprint:** Q11 · **Depende de:** HU-Q8.1 a HU-Q8.6 · **Estado:** Refinada
- Como dueño, quiero publicar la 1.0.0 cuando los contratos públicos queden estables, para que un recibo de hoy se pueda abrir dentro de diez años.
- **Respaldo:** PARQUEADERO §18 (criterio de M2); §3.3 de este plan.
- **CA1.** Un recibo firmado en modo avión se verifica en otro teléfono, y uno alterado sale en rojo. Lo registra `docs/parking/validacion/m2-recibo-verificado.md`.
- **CA2.** `parqueadero-schema` congela sus contratos: el formato del enlace (`#1.` y `#c.`), `parqueadero-export/1` y `/api/v1`. Una prueba guarda un ejemplo de cada versión publicada desde `v0.1.0`.
- **CA3 ❌.** Quitar un campo de un contrato congelado pone el CI en rojo.
- **Patrones en riesgo:** P10, P16.
- **Work items:** WI-Q8.7.1 `[campo]` modo avión · WI-Q8.7.2 `[prueba]` contratos · WI-Q8.7.3 `[doc]` CHANGELOG y versión.

### EQ9 · WhatsApp automático (M3, con disparador)

**Disparador:** un parqueadero paga un plan que cubre los mensajes y tiene su negocio verificado en Meta (PARQUEADERO §19.3). Se revisa en la planeación de Q12; si no se cumple, EQ9 queda preparada y Q12–Q13 se usan para §9. Antes de refinar de nuevo, se releen en el navegador las dos páginas de precios de Meta que se contradicen (bitácora parqueadero 2).

#### HU-Q9.1 · Laboratorio Digital como Tech Provider de Meta
- **Capa:** cuenta y dueño · **Prioridad:** Must · **Puntos:** 3 · **Sprint:** Q12 · **Depende de:** el disparador · **Estado:** Refinada
- Como dueño, quiero a Laboratorio Digital verificado como Tech Provider, para que cada parqueadero conecte su propio número y le pague a Meta directamente.
- **Respaldo:** PARQUEADERO §8.5 (el modelo elegido); ADR-35.
- **CA1.** La app de Meta de Laboratorio Digital tiene la verificación del negocio y la revisión de la app aprobadas para los permisos que usa el registro integrado. Los pasos quedan en un runbook.
- **CA2.** Lo que cambió en las páginas de precios y de políticas de Meta desde el 6 oct 2026 queda en la bitácora antes de construir.
- **CA3 ❌.** Ningún token ni secreto de Meta queda en el repositorio, un documento o un pantallazo (P13); la guardia de secretos los busca.
- **Patrones en riesgo:** P12, P13, P17.
- **Work items:** WI-Q9.1.1 `[dueño]` verificación · WI-Q9.1.2 `[doc]` runbook · WI-Q9.1.3 `[ci]` guardia de secretos.

#### HU-Q9.2 · Registro integrado y coexistencia: el número es del parqueadero
- **Capa:** caja y API · **Prioridad:** Must · **Puntos:** 5 · **Sprint:** Q12 · **Depende de:** HU-Q9.1, HU-T1.3 (`@ed1/cifrado`) · **Estado:** Refinada
- Como propietario, quiero conectar a la caja el WhatsApp Business que ya uso, sin perder la app ni mis chats, para que los recibos salgan de mi número.
- **Respaldo:** PARQUEADERO §8.5 (coexistencia) y §13.2 (M3).
- **CA1.** Desde Ajustes › WhatsApp, el propietario hace el registro integrado con su número en coexistencia. La celda guarda el token cifrado con el sobre de `@ed1/cifrado` y solo muestra su huella.
- **CA2.** Cambiar o desconectar el número pide `auth_time` reciente y queda registrado.
- **CA3 ❌.** Un token que no puede enviar no se guarda: se prueba con la acción real (P12), y la pantalla dice qué falta.
- **Consumo y kill switch:** ninguno hasta enviar; `ks:parqueadero-whatsapp`.
- **Patrones en riesgo:** P12, P13.
- **Work items:** WI-Q9.2.1 `[código]` registro integrado · WI-Q9.2.2 `[código]` token cifrado · WI-Q9.2.3 `[prueba]` token sin permiso · WI-Q9.2.4 `[campo]` con el número del cliente.

#### HU-Q9.3 · La plantilla `recibo_parqueo`, de utilidad
- **Capa:** contenido · **Prioridad:** Must · **Puntos:** 2 · **Sprint:** Q12 · **Depende de:** HU-Q9.2 · **Estado:** Refinada
- Como parqueadero, quiero una plantilla aprobada que lleve el recibo y nada más, para pagar la tarifa de utilidad y no la de marketing.
- **Respaldo:** PARQUEADERO §8.5 (la plantilla).
- **CA1.** Cuerpo con número, placa, hora y total, y un botón URL al recibo. Se prueba si Meta acepta el fragmento `#` en el sufijo; si no, el sufijo es un id corto con un código que la celda resuelve, y esa decisión entra a ARQUITECTURA.
- **CA2.** La plantilla queda aprobada en la categoría utilidad, en español de Colombia, para cada parqueadero conectado.
- **CA3 ❌.** Una prueba rechaza la plantilla si lleva una palabra promocional de una lista (descuento, promoción, oferta…): recategorizada como marketing, cuesta USD 0,0125 en vez de 0,0008.
- **Patrones en riesgo:** P17, P18.
- **Work items:** WI-Q9.3.1 `[código]` plantilla · WI-Q9.3.2 `[prueba]` palabras · WI-Q9.3.3 `[dueño]` aprobación.

#### HU-Q9.4 · Enviar el recibo por la Cloud API
- **Capa:** API y caja · **Prioridad:** Must · **Puntos:** 5 · **Sprint:** Q13 · **Depende de:** HU-Q9.3, HU-Q7.5 · **Estado:** Refinada
- Como cajero, quiero que el recibo le llegue al conductor sin abrir WhatsApp, para atender más rápido.
- **Respaldo:** PARQUEADERO §8.5 (las piezas) y §12 (`POST /api/v1/whatsapp/enviar`); ADR-38 (M3).
- **CA1.** Con el canal activo, «Enviar» encola una entrega con canal `whatsapp_api`. El número del conductor viaja cifrado en la operación, queda en la celda con su autorización y se borra 24 h después de la salida; un cron lo borra y una prueba lo comprueba.
- **CA2.** La cola llama a la Graph API con `fetch` y el token del parqueadero, sin SDK. Si la cola necesita Workers Paid, se dice en D-Q10 antes de empezar Q13 (por verificar en la documentación de Cloudflare al refinar).
- **CA3 ❌.** Con `ks:parqueadero-whatsapp` apagado o sin red, la caja vuelve a `wa.me` sin perder el recibo. El número nunca aparece en logs ni en eventos: una prueba lo busca.
- **Consumo y kill switch:** USD 0,0008 por recibo en utilidad, que paga cada parqueadero a Meta (PARQUEADERO §8.6); `ks:parqueadero-whatsapp`.
- **Patrones en riesgo:** P1, P13, P17.
- **Work items:** WI-Q9.4.1 `[código]` cola y envío · WI-Q9.4.2 `[código]` cifrado y borrado · WI-Q9.4.3 `[prueba]` kill switch y logs · WI-Q9.4.4 `[campo]` con un número de prueba.

#### HU-Q9.5 · Estados de entrega en la caja, con el webhook firmado
- **Capa:** API y caja · **Prioridad:** Must · **Puntos:** 3 · **Sprint:** Q13 · **Depende de:** HU-Q9.4 · **Estado:** Refinada
- Como cajero, quiero saber si el recibo llegó y, si falló, imprimirlo.
- **Respaldo:** PARQUEADERO §8.5 (estados y firma del webhook).
- **CA1.** `GET` y `POST /api/whatsapp/webhook` verifican la suscripción y comprueban `X-Hub-Signature-256` con HMAC-SHA256 en tiempo constante. Los estados `sent`, `delivered`, `read` y `failed` llegan a la caja en el pull.
- **CA2.** Un `failed` sube a la cabecera con «Imprimir el recibo». La caja no promete `read`.
- **CA3 ❌.** Un aviso con la firma mal, o repetido, no cambia ningún estado.
- **Patrones en riesgo:** P9, P15, P17.
- **Work items:** WI-Q9.5.1 `[código]` webhook · WI-Q9.5.2 `[código]` estados en la caja · WI-Q9.5.3 `[prueba]` firma y repetidos.

#### HU-Q9.6 · Autoservicio con un QR en la entrada, y BAJA
- **Capa:** API · **Prioridad:** Must · **Puntos:** 3 · **Sprint:** Q13 · **Depende de:** HU-Q9.5, HU-Q11.3 · **Estado:** Refinada
- Como conductor, quiero escanear un letrero, mandar un mensaje y recibir mi recibo, sin dictarle mi número a nadie.
- **Respaldo:** PARQUEADERO §8.4 (empujón 6) y §8.5 (baja); Decreto 1377 art. 7 (conducta inequívoca).
- **CA1.** El letrero de HU-Q11.3 lleva un QR que abre el WhatsApp del parqueadero con `RECIBO ABC123`. Al recibirlo, la celda responde con el recibo de esa placa abierta, dentro de la ventana de 24 h.
- **CA2.** BAJA guarda la huella del número por parqueadero, y no se le vuelve a enviar.
- **CA3 ❌.** Un `RECIBO` con una placa sin estadía abierta responde que no la encuentra, sin revelar si esa placa estuvo antes.
- **Patrones en riesgo:** P13, P20.
- **Work items:** WI-Q9.6.1 `[código]` mensajes entrantes · WI-Q9.6.2 `[código]` BAJA · WI-Q9.6.3 `[prueba]` placa ajena.

#### HU-Q9.7 · Presupuesto de mensajes y vuelta a `wa.me`
- **Capa:** operación · **Prioridad:** Must · **Puntos:** 2 · **Sprint:** Q13 · **Depende de:** HU-Q9.4 · **Estado:** Refinada
- Como dueño, quiero que un cambio de Meta o un mes con muchos mensajes no se coma el margen de un parqueadero.
- **Respaldo:** PARQUEADERO §8.5, §8.6 y §14.2.
- **CA1.** `product.yaml` suma el costo por mensaje y por categoría, y el vigía avisa al 50, 75 y 90 % del presupuesto de cada parqueadero. La tarifa de Colombia vive en contenido versionado, con su fecha.
- **CA2.** Una plantilla recategorizada como marketing apaga el envío automático de ese parqueadero, que vuelve a `wa.me`, y el dueño recibe el aviso.
- **CA3 ❌.** Con el presupuesto agotado, ningún recibo se pierde: la caja ofrece `wa.me` y papel.
- **Patrones en riesgo:** P1, P15.
- **Work items:** WI-Q9.7.1 `[código]` · WI-Q9.7.2 `[prueba]` recategorizada y agotado.

#### HU-Q9.8 · M3 aceptado y `parqueadero-v1.1.0`
- **Capa:** aceptación · **Prioridad:** Must · **Puntos:** 2 · **Sprint:** Q13 · **Depende de:** HU-Q9.1 a HU-Q9.7 · **Estado:** Refinada
- Como dueño, quiero ver el criterio de M3 con un parqueadero real antes de publicar.
- **Respaldo:** PARQUEADERO §18 (criterio de M3) y §13.2.
- **CA1.** Un recibo llega sin que el operador toque WhatsApp, y su estado «entregado» se ve en la caja. Lo registra `docs/parking/validacion/m3-whatsapp.md`.
- **CA2.** Los textos legales dicen que ED1 es Encargado y Meta subencargado, y la política de la caja sube de versión.
- **CA3 ❌.** La prueba de humo de producción comprueba que un número de prueba ya no está en la celda 24 h después de su salida.
- **Patrones en riesgo:** P16, P18.
- **Work items:** WI-Q9.8.1 `[campo]` · WI-Q9.8.2 `[prueba]` humo · WI-Q9.8.3 `[doc]` textos y CHANGELOG.

### EQ10 · Operación

#### HU-Q10.1 · Respaldo en el Google Drive de la cuenta, como CultivoPro
- **Capa:** operación · **Prioridad:** Must · **Puntos:** 3 · **Sprint:** Q9 · **Depende de:** HU-Q7.4, HU-Q7.9 · **Estado:** Hecha (PR #154, fusionado el 8 oct 2026): en staging. El dueño cambió el destino el 8 oct 2026: «respaldo en la cuenta de Google con que se registre, tal cual quedó en CultivoPro». Sin cron ni R2: la celda ya es la copia del parqueadero (HU-Q7.9) y el vigía del agro ya mide sus filas (HU-Q7.13); bitácora, cambios de rumbo. Lo de Google pasó a `@ed1/drive`, que comparten el cuaderno y la caja; el CORE acepta `producto=` en el permiso de Drive, y la política del parqueadero pasa a la versión 2 para declararlo. Falta WI-Q10.1.3
- Como dueño, quiero que los datos de los parqueaderos tengan respaldo y que restaurarlo esté probado, antes de guardar los datos de un tercero en la nube.
- **Respaldo:** la copia del cuaderno (HU-E8.4, etapa 1; `docs/runbooks/drive-del-productor.md`); PARQUEADERO §14.3; ARQUITECTURA §8.3; P16.
- **CA1.** Más › «Respaldo» › «Guardar copia en mi Google Drive» sube el mismo `parqueadero-export/1` de «Hacer el respaldo» a la carpeta «Caja del parqueadero · respaldos» del Drive de quien lo pide, directo de la caja a su cuenta. Se conservan las 8 más recientes y cuenta como respaldo en la cabecera. Con la caja en la nube, primero sube y baja: la copia lleva lo de todas las cajas.
- **CA2.** «Traer una copia de mi Google Drive» lista las copias y une la elegida a la caja con la misma revisión de «Restaurar». Ensayado de punta a punta con Drive y CORE falsos (`tests/e2e/parqueadero-drive.spec.ts`); el permiso real de Google, en staging (WI-Q10.1.3).
- **CA3 ❌.** Traer une, nunca reemplaza el presente (bitácora ecommerce 77). Un permiso pedido hace más de 10 minutos, o desde otro teléfono, no se canjea; sin señal no sale de la caja; el token de Google nunca se guarda.
- **Patrones en riesgo:** P14, P16, P21.
- **Work items:** WI-Q10.1.1 `[código]` `@ed1/drive` y la copia de la caja · WI-Q10.1.2 `[prueba]` · WI-Q10.1.3 `[dueño]` en staging, guardar y traer una copia con su cuenta de Google · WI-Q10.1.4 `[doc]` política v2. Lo que pedía antes (un cron por celda, respaldo semanal a R2, aviso por Telegram) queda fuera mientras el dueño no lo pida.

#### HU-Q10.2 · Un parqueadero se va: exportar, entregar, verificar y purgar
- **Capa:** operación · **Prioridad:** Must · **Puntos:** 3 · **Sprint:** Q9 · **Depende de:** HU-Q7.9 · **Estado:** Hecha (PR #154, fusionado el 8 oct 2026): `scripts/baja-parqueadero.ts` (exportar, verificar, purgar y ensayar, por la API de D1, sin shell) y `docs/runbooks/parqueadero-baja.md`. No exporta con cajas sin retirar y no purga si la celda tiene algo que no se entregó; una purga cortada se termina repitiendo el comando. Probado en el D1 local con sqlite y workerd (`tests/integracion/parqueadero-baja.test.ts`), con Ensayo Uno en el mismo shard intacto. CA2: el flujo `ensayo-baja-parqueadero` pasó en el D1 de staging el 8 oct 2026 (D1 rechazó el `DELETE` sin purga, la huella se verificó y la celda quedó limpia)
- Como parqueadero que deja el servicio, quiero recibir todo lo mío antes de que se borre.
- **Respaldo:** PARQUEADERO §14.5 (runbook 5) y anexo A (`purga`); P21.
- **CA1.** El runbook y su script: exportación completa, entrega al parqueadero, huella verificada y, solo entonces, una fila en `purga` que habilita el `DELETE`.
- **CA2.** Ensayado de punta a punta en staging con Parqueadero Ensayo Dos.
- **CA3 ❌.** Sin la fila de `purga` con la huella de la exportación entregada, el trigger `registro_sin_borrado` rechaza el `DELETE` en D1.
- **Patrones en riesgo:** P21, P3 (el script corre en Windows).
- **Work items:** WI-Q10.2.1 `[código]` script · WI-Q10.2.2 `[prueba]` en D1 · WI-Q10.2.3 `[doc]` runbook.

#### HU-Q10.3 · El soporte, medido
- **Capa:** operación · **Prioridad:** Must · **Puntos:** 3 · **Sprint:** Q11 · **Depende de:** HU-Q6.2 · **Estado:** Hecha (PR #156, fusionado el 9 oct 2026; el despliegue de staging terminó en verde): `scripts/soporte-parqueadero.ts` y el runbook `parqueadero-soporte.md`; el registro es un CSV fuera del repositorio con solo sus cinco columnas (CA1); las causas con runbook lo nombran y una prueba lo ata al código (CA2); una sede sin filas sale «sin registros» (CA3). Falta WI-Q10.3.2, del dueño: anotar desde el piloto
- Como dueño, quiero saber cuántos minutos de soporte pide cada sede al mes, porque es la variable que decide si el negocio funciona (estudio §10.4).
- **Respaldo:** estudio §10.4 y §16.3 (la métrica de soporte); PARQUEADERO §18.2.
- **CA1.** Cada atención queda en un registro simple, sin datos del conductor: fecha, sede, canal, minutos y causa. Un script da el resumen del mes por sede.
- **CA2.** Las tres causas más comunes tienen su runbook o su arreglo en el backlog.
- **CA3 ❌.** Un mes sin registros de soporte no cuenta como cero: el resumen lo dice.
- **Patrones en riesgo:** P1, P15.
- **Work items:** WI-Q10.3.1 `[código]` registro y resumen · WI-Q10.3.2 `[dueño]` registrar desde el piloto · WI-Q10.3.3 `[doc]` runbooks.

#### HU-Q10.4 · Los runbooks de la celda, atados al código
- **Capa:** operación · **Prioridad:** Must · **Puntos:** 2 · **Sprint:** Q9 · **Depende de:** HU-Q7.7, HU-Q7.13 · **Estado:** Hecha (PR #154, fusionado el 8 oct 2026): `docs/runbooks/parqueadero-kill-switches.md` con `ks:parqueadero`, `ks:parqueadero-fotos` y `ks:core:parqueadero` y cómo verificarlos; la prueba `tests/repo/runbooks-parqueadero.test.ts` saca del código las rutas del Worker, las claves de `productos.json`, los KV de `celdas.json` y sus direcciones, y pone en rojo un runbook que nombre algo que no existe (CA3 con su control negativo)
- Como dueño, quiero los pasos exactos para retirar un teléfono robado y para apagar o prender la celda, sin adivinar.
- **Respaldo:** PARQUEADERO §14.5 (runbook 4) y §14.2; P18.
- **CA1.** `docs/runbooks/` tiene «Retirar un dispositivo del parqueadero» y «Kill switches del parqueadero», con los comandos exactos.
- **CA2.** Una prueba de repositorio comprueba que cada ruta, clave y script que esos runbooks nombran existe.
- **CA3 ❌.** Renombrar una clave en el código sin cambiar el runbook pone la prueba en rojo.
- **Patrones en riesgo:** P18.
- **Work items:** WI-Q10.4.1 `[doc]` runbooks · WI-Q10.4.2 `[prueba]` de repositorio.

### EQ11 · Herramientas gratuitas

La escalera de ED1 §38 aplicada (PARQUEADERO §2.4; estudio §12): las herramientas atraen y la caja retiene. **Se mide antes de construir** (estudio §12.2; bitácora parqueadero 9), salvo el aviso de tarifas y derechos, que el parqueadero cero necesita en su entrada.

#### HU-Q11.1 · Medir la búsqueda antes de construir
- **Capa:** producto · **Prioridad:** Must · **Puntos:** 1 · **Sprint:** Q6 · **Depende de:** — · **Estado:** Hecha (PR #144, fusionado el 8 oct 2026): la regla se fusionó antes de los datos (#137); con Keyword Planner del 8 oct 2026 se construyen la 5, la 6 y la 2, en ese orden, y esperan la 1, la 3, la 4 y la 7 (`docs/parking/validacion/herramientas-busqueda.md`). El dueño decidió seguir la regla el 8 oct 2026 (WI-Q11.1.3)
- Como dueño, quiero el volumen de búsqueda de las siete herramientas de estudio §12.2 con la regla de decisión escrita antes de ver los datos, para no construir las que nadie busca.
- **Respaldo:** estudio §12.2 («Antes de construir») y el método del 1 oct 2026 (estudio de ecommerce §12.6).
- **CA1.** `docs/parking/validacion/herramientas-busqueda.md` tiene la regla escrita y fusionada antes de consultar Keyword Planner, y después los datos con su fecha.
- **CA2.** Cada herramienta queda en «se construye», «se espera» o «no», según la regla.
- **CA3 ❌.** Una regla con fecha posterior a los datos invalida la medición; el historial del repositorio lo muestra.
- **Patrones en riesgo:** P18.
- **Work items:** WI-Q11.1.1 `[doc]` regla · WI-Q11.1.2 `[dueño]` Keyword Planner · WI-Q11.1.3 `[doc]` decisión.

#### HU-Q11.2 · La calculadora de tarifa con el tope de la ciudad
- **Capa:** sitio · **Prioridad:** Should · **Puntos:** 3 · **Sprint:** sin sprint · **Depende de:** HU-Q11.1 (que diga «se construye»), HU-Q1.1, HU-Q1.2 · **Estado:** Espera: HU-Q11.1 dijo «se espera» (demanda 50, con rangos; le bastaba 100). Se vuelve a medir con Search Console a los 90 días de publicado el aviso de tarifas (HU-Q11.3)
- Como conductor o parqueadero, quiero calcular lo que se debe cobrar por una estadía con el tope de mi ciudad, sin registrarme.
- **Respaldo:** estudio §12.2 (herramienta 1); PARQUEADERO §9.2 regla 4.
- **CA1.** Una página del sitio que importa el mismo `parqueadero-tarifas` de la caja: entrada, salida, tipo y ciudad, y da el total con su detalle.
- **CA2.** Una tabla de casos compartida da lo mismo en la calculadora y en la caja (P2). La página termina con el siguiente paso hacia la caja (`tool.next_step`).
- **CA3 ❌.** Un tope vencido se avisa en la calculadora igual que en la caja.
- **Patrones en riesgo:** P2, P8.
- **Work items:** WI-Q11.2.1 `[código]` · WI-Q11.2.2 `[prueba]` tabla compartida · WI-Q11.2.3 `[diseño]` página.

#### HU-Q11.3 · El aviso de tarifas, medios de pago y derechos, para imprimir
- **Capa:** sitio y caja · **Prioridad:** Must · **Puntos:** 2 · **Sprint:** Q7 · **Depende de:** HU-Q3.2 · **Estado:** Hecha (PR #150, 8 oct 2026): inicio › «Aviso de tarifas» en la caja, en carta u oficio y en una sola hoja. Falta WI-Q11.3.3: el aviso impreso en la entrada del cliente
- Como parqueadero, quiero el letrero que la SIC pide a la vista, con mis tarifas y la invitación al recibo digital, para ponerlo en la entrada.
- **Respaldo:** estudio §12.2 (herramienta 4) y §13.1; PARQUEADERO §8.4 (empujón 5). No espera a HU-Q11.1: su primer usuario es el parqueadero cero.
- **CA1.** Sale de los datos de la sede de la caja, o de un formulario en el sitio, en carta u oficio: tarifas, tope, medios de pago, póliza, derechos del usuario y «Pida su recibo por WhatsApp».
- **CA2.** Desde M3 lleva el QR de autoservicio (HU-Q9.6).
- **CA3 ❌.** Sin los datos legales completos no se genera: es la misma compuerta de HU-Q3.2.
- **Patrones en riesgo:** P2, P11.
- **Work items:** WI-Q11.3.1 `[código]` · WI-Q11.3.2 `[diseño]` letrero · WI-Q11.3.3 `[campo]` impreso en la entrada del cliente.

#### HU-Q11.4 · El generador de recibo de entrada
- **Capa:** sitio · **Prioridad:** Should · **Puntos:** 2 · **Sprint:** Q10 · **Depende de:** HU-Q11.1, HU-Q1.4 · **Estado:** Hecha (PR #155, fusionado el 8 oct 2026; el despliegue de staging terminó en verde)
- Como parqueadero que todavía no usa la caja, quiero hacer un recibo de entrada con el estado del vehículo e imprimirlo o mandarlo por WhatsApp.
- **Respaldo:** estudio §12.2 (herramienta 2); PARQUEADERO §2.4.
- **CA1.** Usa `parqueadero-recibos`, sin cuenta, y termina con el siguiente paso: «Lleve la caja en su teléfono».
- **CA2.** Imprime por el diálogo del sistema o manda por `wa.me`, con `@ed1/whatsapp`.
- **CA3 ❌.** El recibo del generador dice que salió de la herramienta y no lleva la serie de una caja: no se confunde con un recibo de caja.
- **Patrones en riesgo:** P2.
- **Work items:** WI-Q11.4.1 `[código]` · WI-Q11.4.2 `[prueba]`.

#### HU-Q11.5 · El sitio del parqueadero: portada, capa para agentes y el camino a la caja
- **Capa:** sitio · **Prioridad:** Must · **Puntos:** 2 · **Sprint:** Q10 · **Depende de:** HU-Q5.2 · **Estado:** Hecha (PR #155, fusionado el 8 oct 2026; el despliegue de staging terminó en verde)
- Como parqueadero que llega por una búsqueda, quiero entender en una página qué es la caja y probarla sin registrarme.
- **Respaldo:** ED1 §38; ADR-24 (capa estática para agentes); HU-C8.2.
- **CA1.** Una portada con las herramientas y la caja; `llms.txt` y gemelos en Markdown, como el agro.
- **CA2.** Cada herramienta emite `tool.opened`, `tool.completed` y `tool.next_step` de `@ed1/eventos`.
- **CA3 ❌.** Ninguna página del sitio carga un tercero: CSP `'self'`.
- **Patrones en riesgo:** P20.
- **Work items:** WI-Q11.5.1 `[código]` · WI-Q11.5.2 `[diseño]` · WI-Q11.5.3 `[prueba]` CSP.

#### HU-Q11.6 · El liquidador de mensualidades y prorrateos
- **Capa:** sitio · **Prioridad:** Should · **Puntos:** 3 · **Sprint:** sin sprint (se planea después de M1, primera de las herramientas) · **Depende de:** HU-Q11.1, HU-Q11.5 · **Estado:** En revisión (rama `feat/q11c-sprint`): `/herramientas/mensualidad-de-parqueadero/` con `liquidarMensualidad` de `@ed1/parqueadero-tarifas` y la tabla de casos compartida con la caja (`@ed1/parqueadero-tarifas/casos-de-mensualidad`)
- Como parqueadero, quiero calcular cuánto cobrar por una mensualidad que empieza a mitad de mes, o por varios meses, sin registrarme.
- **Respaldo:** estudio §12.2 (herramienta 5). HU-Q11.1 la midió primera: demanda 780 con rangos, y «parqueadero mensual» en 100–1 mil en Colombia (8 oct 2026). Sirve también en LATAM («cochera mensual», «pensión de estacionamiento»).
- **CA1.** Una página del sitio con tipo de vehículo, valor del mes y fecha de inicio, que da el prorrateo con su detalle día por día. Usa la misma lógica de mensualidades de la caja (HU-Q8.4), no una copia (P2).
- **CA2.** Termina con el siguiente paso hacia la caja (`tool.next_step`): llevar los abonados en el teléfono.
- **CA3 ❌.** Un valor ilegible o en cero no da un total: dice qué falta (P1).
- **Patrones en riesgo:** P1, P2.
- **Work items:** WI-Q11.6.1 `[código]` · WI-Q11.6.2 `[prueba]` tabla compartida con la caja · WI-Q11.6.3 `[diseño]` página.

#### HU-Q11.7 · Los cupos obligatorios para eléctricos (Ley 1964 de 2019)
- **Capa:** sitio · **Prioridad:** Should · **Puntos:** 2 · **Sprint:** sin sprint (se planea después de M1, después de HU-Q11.6) · **Depende de:** HU-Q11.1, HU-Q11.5 · **Estado:** En revisión (rama `feat/q11c-sprint`): `/herramientas/cupos-para-electricos/`. WI-Q11.7.1 hecho: la Ley 1964 de 2019, art. 7, leída el 9 oct 2026 en tres fuentes públicas (`content/parqueadero/cupos-electricos.json`). Falta WI-Q11.7.3 (Search Console a los 90 días de publicada)
- Como parqueadero, quiero saber cuántos cupos para vehículos eléctricos me exige la ley según mi número de cupos, sin registrarme.
- **Respaldo:** estudio §12.2 (herramienta 6). HU-Q11.1: demanda 500 con rangos, toda de «ley 1964 de 2019»; los términos del parqueadero no traen dato (8 oct 2026).
- **CA1.** Una página con el número de cupos que da los cupos eléctricos que exige la ley, con el artículo citado y su fecha de consulta (P18).
- **CA2.** A los 90 días de publicada, Search Console dice si la búsqueda trae parqueaderos o conductores: si las consultas son de conductores, se anota en HU-Q11.1 y no se le invierte más.
- **CA3 ❌.** Sin el texto vigente de la norma revisado, no se publica: una cifra legal de memoria no sale (P18).
- **Patrones en riesgo:** P18.
- **Work items:** WI-Q11.7.1 `[doc]` norma vigente · WI-Q11.7.2 `[código]` · WI-Q11.7.3 `[campo]` Search Console a los 90 días.

### EQ13 · Lo que pidió el cliente en la operación (Q13)

Pedido del dueño del 14 oct 2026, con el primer parqueadero ya operando. Sin el disparador de M3, Q13 lo toma (§6.1).

#### HU-Q13.1 · Hora militar u hora con a. m. y p. m.
- **Capa:** caja y recibos · **Prioridad:** Should · **Puntos:** 1 · **Sprint:** Q13 · **Estado:** Hecha (`v0.6.0`, 14 oct 2026)
- Como parqueadero, quiero ver y entregar las horas como las lee mi gente: `18:05` o `6:05 p. m.`.
- **CA1.** Ajustes › «Cómo se escribe la hora»: militar (por omisión) o con a. m. y p. m. Las pantallas de la caja, el papel, el WhatsApp, la pantalla del recibo, el cierre de turno y el recibo de la mensualidad la usan.
- **CA2.** `/r/` muestra la misma hora que el papel: el enlace la lleva en su versión 3 (`h: 1`). Un recibo con hora militar sigue saliendo en la versión de siempre.
- **CA3 ❌.** La medianoche y el mediodía son las 12 (`12:05 a. m.`, `12:00 p. m.`), nunca las 0.

#### HU-Q13.2 · Tarifa de domingos y festivos
- **Capa:** paquete, caja y recibos · **Prioridad:** Should · **Puntos:** 3 · **Sprint:** Q13 · **Estado:** Hecha (`v0.6.0`, 14 oct 2026)
- Como parqueadero, quiero cobrar otro valor por minuto y otro día completo los domingos y festivos, para el carro y la moto, sin que sea obligatorio configurarlo.
- **CA1.** Cada tarifa tiene, opcionales, «Por minuto en domingos y festivos» y «Día completo en domingos y festivos» (que cuenta desde los mismos minutos del día completo de siempre). Sin ellos, el domingo cobra como cualquier día.
- **CA2.** Cada minuto vale según el día de Bogotá en que empieza: domingo o festivo de Colombia (`@ed1/calendario`, Ley 51 de 1983), o día normal. El día completo de un bloque de 24 h es el del día en que empieza el bloque. El tope por día sigue igual. La línea del recibo dice «con domingo o festivo».
- **CA3 ❌.** Ni el valor ni el día completo de festivo pasan el tope legal por minuto: la caja no los guarda y dice por qué.
- **CA4.** El recibo, el aviso de tarifas y `/r/` muestran la tarifa de festivo; el enlace la lleva en su versión 3 (`fs`).

#### HU-Q13.3 · La mensualidad por días calendario o hábiles
- **Capa:** paquete y caja · **Prioridad:** Should · **Puntos:** 2 · **Sprint:** Q13 · **Estado:** Hecha (`v0.6.0`, 14 oct 2026)
- Como parqueadero, quiero que una mensualidad empezada cobre solo los días que cuento: todos, o los hábiles.
- **CA1.** Ajustes › «Una mensualidad empezada cobra»: días calendario (como antes) o días hábiles, de lunes a viernes que no son festivo en Colombia.
- **CA2.** Con hábiles, el prorrateo cuenta los hábiles que cubre sobre los del periodo entero, a la centena hacia abajo. Un periodo entero vale el valor del mes, sin importar cuántos hábiles tenga.
- **CA3.** La vigencia del abono no cambia: un abonado entra sin pagar cualquier día de su periodo. Lo que cambia es cuánto se cobra un periodo empezado.

#### HU-Q13.4 · Los meses de la mensualidad, de fecha a fecha o del 1 al último día
- **Capa:** paquete y caja · **Prioridad:** Should · **Puntos:** 2 · **Sprint:** Q13 · **Estado:** Hecha (`v0.7.0`, 14 oct 2026)
- Como parqueadero, quiero que la mensualidad vaya del 1 al último día del mes, y que si se contrata a mitad de mes esos días se cobren en proporción.
- **Respaldo:** pedido del dueño del 2026-10-14: «inicia el primero de cada mes y finaliza el último día del mes… esos 15 días se cobran proporcionales», y «dejar ambas opciones como configuración igual que las anteriores».
- **CA1.** Ajustes › «Los meses de la mensualidad van»: de fecha a fecha (como siempre, por omisión) o del 1 al último día del mes.
- **CA2.** Del 1 al último día: el abonado nuevo vence el último día del mes; el primer cobro, contratado a mitad de mes, cobra esos días sobre los del mes (calendario u hábiles, HU-Q13.3); el siguiente es el mes entero. Una vigencia que cruza meses cobra cada mes en su proporción.
- **CA3 ❌.** Sin la opción, todo sigue de fecha a fecha: los abonados de antes no cambian. El liquidador del sitio (HU-Q11.6) sigue con sus dos formas.

#### HU-Q13.5 · Quién debe y quién está al día, y cómo se llegó al cobro de la mensualidad
- **Capa:** paquete y caja · **Prioridad:** Must · **Puntos:** 2 · **Sprint:** Q13 · **Estado:** Hecha (`v0.7.1`, 14 oct 2026)
- Como cajero, quiero ver en la lista qué abonado debe y cuál ya pagó, y que el cobro de la mensualidad diga sus fechas y su valor correctos con el detalle del prorrateo.
- **Respaldo:** el dueño, 2026-10-14: «la fecha que muestra luego de pagar la mensualidad está mal, el valor también», «mostrar el detalle del prorrateo en el cobro de la mensualidad» y «en la sección de abonados no se distingue quién debe y quién ya pagó». Bitácora 40.
- **CA1.** La lista y el detalle dicen la cuenta de cada abonado con su color: «Al día hasta el …» (verde), «Debe desde el …» (rojo), «Venció el …» (amarillo) o «Inactivo». Al día es haber pagado en la caja hasta hoy y hasta el fin de la vigencia.
- **CA2.** «Cobrar mensualidad» cobra primero lo que falta pagar de la vigencia que corre (desde el día siguiente a lo pagado, o desde que empezó), con su prorrateo; con la vigencia pagada, el periodo siguiente.
- **CA3.** El cobro muestra el prorrateo tramo por tramo: «20/10 al 31/10 · 12 de 31 días» y su valor; un periodo entero no lleva detalle.
- **CA4 ❌.** «No cobrar ahora» no deja al abonado al día: entra como abonado (HU-Q13.3 CA3), pero la lista dice que debe. Dos mensualidades cobradas en el mismo minuto se anulan de la última a la primera.

#### HU-Q13.6 · Las entregas pendientes se ven, se reimprimen y bajan
- **Capa:** caja · **Prioridad:** Must · **Puntos:** 1 · **Sprint:** Q13 · **Estado:** Hecha (`v0.7.2`, 14 oct 2026)
- Como cajero, quiero saber qué recibos no salieron por la impresora y poder imprimirlos otra vez, y que la cuenta baje cuando salen.
- **Respaldo:** pregunta del dueño del 2026-10-14 sobre la señal «entregas pendientes»; aprobó el ajuste propuesto («haz el ajuste que propones»). Bitácora 42.
- **CA1.** Con entregas pendientes, la señal de la cabecera se toca y abre la lista: un recibo por fila (tipo, número y placa), cuántas veces no salió, la hora de la última y su motivo.
- **CA2.** «Abrir para imprimir» abre ese recibo (el de entrada o salida, o el de la mensualidad) para imprimirlo otra vez. Un recibo que sale en papel, o que el conductor escanea en pantalla, sale de la lista solo.
- **CA3.** «Quitar de la lista» quita la fila: el recibo se entregó de otra forma, o era una impresión que no es recibo (aviso, cierre, página de prueba).
- **CA4 ❌.** Un papel que no salió no quita la fila: la suma a la misma. El registro nunca se toca; solo la lista de lo que falta entregar.

#### HU-Q13.7 · El recibo de salida en papel solo si lo piden, y nada dado por perdido sale después
- **Capa:** caja y `@ed1/impresion` · **Prioridad:** Must · **Puntos:** 2 · **Sprint:** Q13 · **Estado:** Hecha (`v0.8.0`, 19 oct 2026)
- Como parqueadero, quiero que el recibo de salida no se imprima si el conductor no lo pide, y que la impresora nunca saque de golpe recibos que la caja ya dio por no salidos.
- **Respaldo:** el dueño, 2026-10-19: «luego de un día de trabajo, al cobrar todas las entradas y no imprimir el recibo de salida, la impresora imprimió de largo todos esos recibos de salida que no se necesitaban». Bitácora 43.
- **CA1.** Ajustes › «¿Y el recibo de salida?»: «Igual que el de entrada» (como siempre, por omisión) o «En papel solo si lo pide». A pedido, el de salida no se imprime al abrirse ni al volver; sigue en la pantalla, por WhatsApp y con «Imprimir».
- **CA2.** El de entrada no cambia: sale como diga «¿Cuándo sale el recibo en papel?». Es el que la ley exige al recibir el vehículo (Ley 1480 art. 18).
- **CA3.** Cuando la cola deja de esperar a la impresora (45 s), le pide al adaptador que corte el trabajo: por el puerto serie descarta lo que el navegador tenía por mandar y suelta el puerto; por Bluetooth no manda un trozo más. Un trabajo nuevo no reactiva el cortado.
- **CA4 ❌.** Lo que la caja dio por no salido no se imprime cuando la impresora despierta (prueba con una impresora falsa que se queda dormida a mitad de un recibo). Lo que la impresora ya recibió en su memoria no se puede retirar: la caja no lo ve (ver bitácora 43).

#### HU-Q13.8 · La placa con protagonismo en el papel
- **Capa:** recibos · **Prioridad:** Should · **Puntos:** 1 · **Sprint:** Q13 · **Estado:** En revisión (rama `feat/placa-destacada`)
- Como cajero, quiero ver la placa grande en el recibo, para encontrar el vehículo y comparar sin acercar el papel.
- **Respaldo:** el dueño, 2026-10-27: «quiero que la placa del vehículo que se imprime en el recibo tenga más protagonismo, un poco más grande y visible sin agrandar mucho el espacio de impresión para no desperdiciar papel».
- **CA1.** En el papel de la entrada, la salida y la mensualidad, la placa sale en negrita, al doble de alto y de ancho y centrada, con el vehículo en la misma línea («ABC123  Carro»). Reemplaza la línea «Placa ABC123 … Carro»: el recibo crece el alto de una sola línea.
- **CA2.** La hoja del diálogo de impresión la muestra igual (la misma marca de letra grande). La pantalla, el enlace y WhatsApp no cambian.
- **CA3 ❌.** Una placa que no cabe con el vehículo en la mitad de las columnas va sola, y el vehículo debajo en letra normal: ninguna línea se sale del papel.

---

## 9. Preparadas, sin sprint

| Historia | Disparador |
|---|---|
| EQ12 · Integrar el facturador del parqueadero (M4), con un spike de 3 puntos primero | Un parqueadero obligado a facturar. Primero se integra el facturador que ya tiene, sin emitir (PARQUEADERO §19.3; TIENDA-3.0 §14.5) |
| Revisión legal de los textos del recibo, el aviso de privacidad y los términos | Haya presupuesto para un abogado. Recomendada antes del tercer cliente. Corregir es cambiar contenido y publicar |
| Lectura de placa con la cámara | Un modelo de licencia permisiva que lea placas colombianas en menos de un segundo en un teléfono barato (estudio §8.3) |
| Pago en línea del conductor | Nunca como recaudo de ED1. Si un parqueadero lo pide, con sus propias llaves de Bold, como la Tienda |
| Varias sedes con reporte consolidado | Un cliente con dos sedes que pague el plan Varias sedes (estudio §10.3) |
| Convenios con comercios y visitantes de copropiedad | Tres clientes que lo pidan (regla de tres) |
| Imprimir desde un iPhone (Bluefy como plan C) | Un cliente que solo tenga iPhone y no acepte un Android de entrada como caja (PARQUEADERO §7.8). Se prueba sin soportarlo |
| RawBT como camino de impresión | La matriz de HU-Q6.1 encuentra un teléfono donde fallan Web Bluetooth y Web Serial (PARQUEADERO §7.5) |
| `@ed1/impresion` en el punto de venta de la Tienda y en las etiquetas de lote del agro | Uno de los dos carriles lo pide (PARQUEADERO §20.4) |
| Firma sin red para los QR de lote del agro | El agro lo pide, cuando `@ed1/firma` ya firme recibos (PARQUEADERO §20.3) |
| Herramientas 3 y 7 del estudio §12.2 | La próxima medición (Search Console, HU-Q11.1) dice «se construye». La 7, además, con la revisión de un contador. La 5 y la 6 ya son HU-Q11.6 y HU-Q11.7 |
| Impresora de 80 mm | Una caja fija de escritorio que la pida (PARQUEADERO §7.9) |
| App nativa | Una función que el navegador no pueda hacer y que un cliente pague |
| Workers Paid | El vigía de HU-Q7.13 pasa del 75 % de forma sostenida, o M3 lo exige (D-Q10) |
| Barreras, sensores, cámaras fijas y reservas | No (estudio §14.3) |

---

## 10. Decisiones del dueño para empezar

Se piden todas al principio, con su recomendación. Las de PARQUEADERO §19.2 conservan allí su número.

| # | Decisión | Recomendación | La necesita |
|---|---|---|---|
| D-Q1 | ¿El parqueadero va primero en la validación del dueño durante M0, del 7 oct al 13 nov? | **Sí.** Hay un cliente que paga y una fecha. El CORE y la Tienda siguen, con su validación después de la del parqueadero, y el límite entre carriles (§3.6) no cambia. Desde Q6, el orden vuelve a D-C4 | Q0 (ya) |
| D-Q2 | ¿Sprints de una semana en M0? | **Sí**, con revisión cada viernes. Desde Q6, dos semanas con el calendario del CORE | Q0 |
| D-Q3 | ¿Se aceptan ADR-31 a ADR-40? *(Hoy, 8 oct 2026: ADR-31 aceptada; las otras nueve siguen esperando.)* | **Aceptar las diez ahora.** ADR-36 (firma sin red) y la parte de `sync` de ADR-39 se construyen en M1 y M2, pero aceptarlas ya fija el formato del enlace desde el primer recibo, que después no se puede cambiar (ADR-40) | Q0, antes de HU-Q1.5 |
| D-Q4 | ¿Se activa la zona `laboratorio-digital.app`? | **Sí, antes del 23 oct.** El primer recibo publica su enlace (ADR-40). El asistente da los pasos exactos | HU-Q5.2 (Q3) |
| D-Q5 | ¿Qué paga el cliente en el piloto? | **El plan desde el primer día**, con un link de pago de Bold hecho a mano (el cobro integrado es HU-Q7.10), y la puesta en marcha como servicio aparte (estudio §10.2). El precio sale de estudio §10.3. Un pago real es la evidencia más fuerte (estudio §16.3) | Antes de la demostración (30 oct) |
| D-Q6 | ¿Nombre comercial del producto? | Decidirlo antes de Q3: va en la caja, en el recibo y en `/r/`. Mientras tanto, «Parqueadero» | Antes del 26 oct |
| D-Q7 | ¿Umbrales de las métricas de la excepción declarada? | Fijar en Q0 los de PARQUEADERO §18.2: impresión al primer intento ≥ 98 %, entrada ≤ 10 s, cuadre ≥ 95 %, pago real a los 30 días y soporte que quepa en la contribución. La meta de recibo digital a 90 días, con el cliente | HU-Q0.2 (Q0) |
| D-Q8 | ¿Se compra una PT-210 para el equipo? | **Sí**, COP 122.900 a 129.900 (PARQUEADERO §7.1). El paso 0 no puede esperar a visitar al cliente, y la matriz de 50 recibos no se corre con la impresora que él usa para trabajar | Q0 |
| D-Q9 | ¿Cómo arranca el ajuste `papel` en el piloto? | `siempre` las dos primeras semanas; después `salvo_digital`, si el cuadre está bien y el operador lo maneja sin pensar (PARQUEADERO §8.4) | HU-Q6.4 (Q5) |
| D-Q10 | ¿Workers Paid para M1? | **No.** M1 cabe en el plan gratuito con el vigía de HU-Q7.13. Se activa si el vigía pasa del 75 % de forma sostenida, o si M3 lo exige | Q6 |

**Tareas que solo puede hacer el dueño**, con la fecha que no frena el camino crítico:

| Tarea | Antes de | Detalle |
|---|---|---|
| Contestar D-Q1 a D-Q10 | 9 oct | §10 |
| Comprar la PT-210 del equipo y un paquete de rollos de 57 mm | 9 oct | D-Q8; sin ella, HU-Q2.1 se hace con la del cliente en su local |
| Pedirle al cliente los datos de MVP §1 | 14 oct | HU-Q0.2. Con la guía de preguntas de MVP §1 |
| Agendar con el cliente la demostración del 30 oct y el piloto del 9 al 13 nov | 16 oct | MVP §7 y §8 |
| Dos números de WhatsApp de prueba: uno hace de parqueadero y otro de conductor | 19 oct | HU-Q4.1 |
| Activar la zona `laboratorio-digital.app` en Cloudflare | 23 oct | D-Q4; HU-Q5.2. El asistente da los pasos |
| El link de pago de Bold para el primer periodo | 30 oct | D-Q5 |
| Los datos de Laboratorio Digital como encargado (nombre o razón social, identificación, domicilio, correo y teléfono) | Q8 | HU-Q7.11 |
| Consultar Keyword Planner con la regla ya escrita | Q6 | HU-Q11.1 |
| La verificación del negocio en Meta | Q12, si se cumple el disparador | HU-Q9.1 |

---

## 11. Riesgos del plan

| # | Riesgo | Prob. | Impacto | Respuesta |
|---|---|---|---|---|
| R1 | La validación del dueño no alcanza para tres carriles y la cola crece en plena urgencia | Alta | Alto | D-Q1: el parqueadero primero durante M0; el límite de 3 y de 6 (§3.6); la revisión del viernes es la validación |
| R2 | Los datos del cliente llegan tarde (ciudad, tarifas, datos legales, equipo) | Media | Alto | Todo lo que el cliente decide es dato, no código: Q2 sigue con Ensayo Uno y Ensayo Dos, y sus datos se cargan en un ajuste. Fecha límite: 14 oct |
| R3 | La PT-210 del cliente anuncia otro servicio BLE, otro nombre u otro firmware que la del equipo | Media | Medio | El paso 0 se repite con la unidad del cliente en la demostración; el adaptador prueba varios servicios y descubre; Web Serial es el segundo camino (PARQUEADERO §7.4 y §7.5) |
| R4 | La caja del cliente es un iPhone | Por saber | Alto | Se pregunta en Q0. Recomendación: un Android de entrada como caja; el iPhone sirve sin papel (PARQUEADERO §7.8) |
| R5 | La zona `laboratorio-digital.app` no está activa a tiempo | Media | Alto | D-Q4 con fecha. Si falta, la demostración se hace en staging, **ningún recibo real sale con un enlace de staging** y el piloto no empieza sin la zona |
| R6 | El cliente pide más durante el piloto y el alcance crece | Alta | Medio | Todo pedido nuevo va al backlog con su lugar; HU-Q3.12 tiene un tope de 3 puntos; el orden de recorte de MVP §4.4 |
| R7 | Se pierde o se daña el teléfono de la caja en M0 | Media | Alto | Respaldo al cerrar cada turno (HU-Q3.10), almacenamiento persistente pedido (HU-Q3.1) y M1 justo después del piloto |
| R8 | El soporte cuesta más de lo que el plan deja | Media | Alto | Runbooks y diagnóstico que se copia por WhatsApp (HU-Q6.2), soporte medido desde el piloto (HU-Q10.3) |
| R9 | Choques con los carriles del CORE y de la Tienda en archivos compartidos (`productos.json`, `celdas.json`, `dominios.json`, `desplegar.yml`, `packages/eventos`, `packages/sync`, CHANGELOG) | Media | Medio | Copia de trabajo propia; `git merge-tree` contra las ramas abiertas antes de cada push (§3.1) |
| R10 | Leer mal una norma sin abogado | Media | Alto | Los campos de la ley son una prueba del CI (HU-Q1.4); los textos viven en contenido y se cambian sin código; revisión legal preparada (§9) |
| R11 | Meta cambia precios o reglas (solo M3) | Alta | Medio | `wa.me` sigue siendo el camino por defecto; presupuesto y kill switch (HU-Q9.7); el disparador de M3 se revisa en Q12 |
| R12 | Un equipo nuevo no sostiene la velocidad planeada | Media | Medio | Los puntos son relativos; la velocidad se mide en Q1 y Q2 y el plan se recalcula en la planeación de Q3; el primer día está escrito (MVP §3) |

---

## 12. Lo que el parqueadero espera del CORE y de los otros carriles, y lo que les da

| Lo que necesita el parqueadero | De dónde | Sprint o estado | La usa |
|---|---|---|---|
| `@ed1/dinero`, `@ed1/eventos` | Paquetes en `main` | Fusionados | HU-Q1.1, HU-Q1.4, HU-Q5.3 |
| El producto en `productos.json` y planes con periodo | HU-C1.1, HU-C1.2 | C1–C2, fusionadas | HU-Q7.1 |
| `celdas.json` v2 y la receta probada en D1 | HU-C1.4, HU-C2.1 | C1–C2, fusionadas | HU-Q7.2 |
| El D1 local de workerd para las pruebas | HU-C11.7 | C2 | HU-Q7.2, HU-Q7.4 |
| Kill switches por producto | HU-C3.6 | C2 | HU-Q7.13 |
| Entrar con producto | HU-C3.1 | Construida, en validación | HU-Q7.6 |
| Las celdas verifican tokens v1 y v2 | HU-C4.1 | C4 | HU-Q7.4 |
| El CORE emite v2 y el refresh por producto | HU-C4.3, HU-C4.4 | Construidas, en validación | HU-Q7.6 |
| Los componentes base de `@ed1/ui` v2 | HU-C6.3 | C3 | Las pantallas de la caja. Si no están en `main` cuando arranca Q1, la caja usa los tokens de HU-C6.1 y migra después, sin frenar M0 |
| El vigía | HU-C11.1 | C4 | HU-Q7.13 |
| Pagar 1, 3, 6 o 12 meses, gracia y celdas al día (HC4) | HU-C5.3, HU-C5.5, HU-C5.6 | C7 | HU-Q7.10 |
| Entrar con correo, para operadores sin Google | HU-C10.2 | C11 | HU-Q7.6 (mientras tanto, solo Google) |
| La copia fuera de Cloudflare | HU-C11.4 | C11 | HU-Q10.1 |
| `@ed1/cifrado` | HU-T1.3 (Tienda) | En `main` | HU-Q9.2, HU-Q9.4 |
| La zona `laboratorio-digital.app` activa | El dueño | Pendiente (D-Q4) | HU-Q5.2 |

**Lo que el parqueadero les da:**

- **`@ed1/whatsapp`** (HU-Q1.6): a la Tienda, para «Pedir por WhatsApp» (HU-T6.1) y «Confirmar por WhatsApp» (HU-T9.3); al agro, para reemplazar sus tres copias de `wa.me` cuando las toque.
- **`@ed1/impresion`** (HU-Q2.2 a HU-Q2.5): al punto de venta de la Tienda y a las etiquetas de lote del agro, cuando lo pidan (§9).
- **`@ed1/sync` sin las entidades del agro** (HU-Q7.3) y **`@ed1/firma`** (HU-Q8.1): la regla de tres cumplida (ADR-39).
- **El nombre `parqueadero` reservado** en `dominios.json` (HU-Q5.2), antes de que la Tienda abra nombres en la zona.
- **El hallazgo de `INSERT OR IGNORE`** (bitácora parqueadero 1; PARQUEADERO §20.1), que el agro puede aplicar en el push de su celda.

---

## 13. Registro de velocidad

| Sprint | Comprometido | Validado por el dueño | Nota |
|---|---|---|---|
| Q0 | 5 | ✅ | El plan, las decisiones y el paso 0 con nRF Connect (#110) |
| Q1–Q5 | 111 | ✅ en producción: `0.1.0`, `0.1.1` y `0.2.0` (8 oct 2026) | M0 entero, del 7 al 8 oct (#111–#136). La matriz de la impresora queda para la entrega (HU-Q6.1); el primer turno real, HU-Q6.4 |
| Q6 | 17 | Solo staging | #137–#147. HU-Q3.12 espera la primera semana real |
| Q7 | 15 | Solo staging | #148–#151 |
| Q8 | 10 | Solo staging | #153 |
| Q9 | 15 | Solo staging | #154. HU-Q7.10 espera HC4 y HU-Q7.12 es la `v0.5.0` |
| Q10 | 14 | Solo staging | #155 |
| Q11 | 17 | Lo que no necesita la nube, en la `v0.3.0` de la entrega | #156–#158: 20 puntos hechos (HU-Q8.3, HU-Q8.4, HU-Q8.5, HU-Q8.6, HU-Q10.3, HU-Q11.6 y HU-Q11.7, estas dos sin sprint); HU-Q8.7 espera M1 en producción |
| Q13 | 14 | Con la `0.6.0` a la `0.8.0` y la `0.9.1` | HU-Q13.1 a HU-Q13.8, pedidas por el dueño del 14 al 27 oct 2026 |
| Q12 | 3 | En producción con la `0.5.0` | HU-Q7.10, sin el disparador de M3. HU-Q7.12 (M1 en producción) espera la decisión del dueño |

Desde el 12 oct 2026, un PR y un push por sprint completo, para ahorrar minutos de Actions (decisión del dueño).

---

## 14. De PARQUEADERO §18 a las historias

| Hito | Historias | Cuántas | Pts |
|---|---|---|---|
| M0 · MVP del cliente | HU-Q0.1 a HU-Q0.3, HU-Q1.1 a HU-Q1.6, HU-Q2.1 a HU-Q2.6, HU-Q3.1 a HU-Q3.11, HU-Q4.1 a HU-Q4.5, HU-Q5.1 a HU-Q5.3, HU-Q6.1 a HU-Q6.6 | 40 | 116 |
| M1 · Cuenta y varias cajas | HU-Q3.12, HU-Q7.1 a HU-Q7.13, HU-Q10.1, HU-Q10.2, HU-Q10.4, HU-Q11.1, HU-Q11.3 | 19 | 57 |
| M2 · Recibo verificado | HU-Q8.1 a HU-Q8.7, HU-Q10.3, HU-Q11.4, HU-Q11.5 | 10 | 31 |
| M3 · WhatsApp automático | HU-Q9.1 a HU-Q9.8 | 8 | 25 |
| M4 · Facturación | EQ12, preparada (§9) | — | — |
| **Total** | | **76** | **227** |
