# Gestión Agro — Plan de trabajo y backlog

**Versión:** 0.1.0 · 30 sep 2026
**Dueño del producto y desarrollador:** Sebas
**Fuente única de:** hitos, sprints, épicas, historias, work items y su estado. La arquitectura se cita como `ARQUITECTURA §N` / `ADR-N`; las lecciones, como `P<n>` (ver `BITACORA.md`).

---

## 0. En una página

Dos carriles en paralelo desde el primer sprint:

- **Carril A · Herramienta gratuita DPV.** Primera calculadora publicada al cierre del S4 (27 nov 2026).
- **Carril B · Cuaderno de campo.** Registro local en tu invernadero desde el S5 (11 dic 2026). Equipo de 4 sincronizado al cierre del S10 (5 mar 2027).

> **Decisión del 30 sep 2026.** El trasplante es a mediados de octubre y la primera cosecha en enero de 2027, dos meses antes de lo que suponía este plan. El dueño decidió **mantener el orden** (la DPV primero). Consecuencias aceptadas: de octubre a diciembre la finca registra en papel; la primera cosecha se registra en papel hasta el S7 (HU-E6.1, 12–22 ene 2027); el equipo sincroniza después de la primera cosecha. La alternativa descartada era adelantar las 7 historias mínimas de §1.

| Hito | Qué queda funcionando | Cierra | Fecha objetivo |
|---|---|---|---|
| **H0 · Cimientos** | Repo, CI, contrato `product.yaml`, fincas de prueba | S1 | 16 oct 2026 |
| **H1 · DPV publicada** | `/herramientas/agro/calculadora-dpv/` en producción, indexada y midiendo | S4 | 27 nov 2026 |
| **H2 · Cuaderno en el invernadero** | PWA offline: finca, naves, ciclo, insumos, riego, clima, labores y aplicaciones en un teléfono | S5 (+S6 historial y exportación) | 11 dic 2026 (23 dic) |
| **H3 · Equipo sincronizado** | Cuentas Google, invitación por WhatsApp, roles, celda c0 y sincronización de 4 teléfonos | S10 | 5 mar 2027 |
| **H4 · Cosecha a la mesa** | Cosecha por nave, lotes de venta, despachos, QR de trazabilidad | S7–S12 | 2 abr 2027 |
| **H5 · Operación ZCOE** | Kill switch, vigía de cuota, respaldos, alertas y reporte semanal | S7–S12 | 2 abr 2027 |
| **H6 · Números de la finca** | Costos por ciclo y nave, costo por kg, jornales, rendimiento por operario | S13–S14 | 30 abr 2027 |
| **H7 · Cumplimiento y señal comercial** | Carpeta de cumplimiento en PDF, calendario de carencias público, lista de espera de planes con precio visible | S14–S15 | 14 may 2027 |
| **H8 · Conectado v0** (laboratorio, fuera de la capacidad de desarrollo) | Diseño de referencia y nodo de riego de una zona con estado seguro | Paralelo | Sin fecha |

**Validación (umbrales de las instrucciones §8):** la DPV se evalúa a los 90 días de publicada, el 25 feb 2027. `tool.completed / tool.opened` debe ser ≥ 60 % y las impresiones deben crecer cada semana. Si no se cumple, se aplica el criterio de pivote de ED1 §19.1 antes de construir la segunda herramienta.

---

## 1. Supuestos del plan

Si alguno es falso, se reordena el plan.

| Supuesto | Valor | Por qué importa |
|---|---|---|
| Capacidad | 1 persona, ~20 h/semana, sprints de 2 semanas | ED1 §25: las horas del dueño son el límite real del ZCOE |
| Horas productivas por sprint | ~30 h (40 h − ceremonias − 20 % de colchón para imprevistos y bitácora) | — |
| Escala de puntos | Fibonacci; **1 punto ≈ 3 h ideales** con asistencia de Claude | Se recalibra al cierre del S2 con la velocidad real |
| Velocidad inicial | **10 puntos por sprint** (7 en sprints cortos) | — |
| Trasplante | Mediados de octubre de 2026 (confirmado el 30 sep 2026) | Antes de H2: la finca registra en papel hasta el S5 |
| Primera cosecha | Enero de 2027 (confirmado el 30 sep 2026) | HU-E6.1 llega en el S7 (12–22 ene); si la cosecha empieza antes, esas semanas van en papel |
| Laboratorio de hardware | Fuera de las 20 h de desarrollo | Si las usa, baja la velocidad |
| Festivos | 12 oct, 2 nov, 16 nov, 8 dic, 25 dic 2026; 1 y 11 ene, 22, 25 y 26 mar 2027 | Sprints cortos: S6 y S12 |

Si el trasplante se adelanta, lo mínimo para registrar desde el primer día es HU-E3.2, E3.3, E3.4, E3.7, E3.9, E3.10 y E3.13 (17 puntos). Se adelantan esas y la DPV cede un sprint.

---

## 2. Definición de Listo y de Terminado

### 2.1 Definición de Listo (DoR)

Una historia entra a un sprint solo si:

1. Tiene criterios de aceptación verificables, con al menos uno negativo (lo que **no** debe pasar).
2. Está estimada y cabe en un sprint (≤ 5 puntos).
3. Sus dependencias están terminadas o en el mismo sprint antes que ella.
4. Dice su peldaño de la escalera y el siguiente paso del usuario.
5. Si consume cuota (Worker, D1, R2, KV, Analytics Engine), trae la estimación de consumo diario y el nombre de su kill switch.
6. Nombra los patrones de la bitácora que corre riesgo de repetir.
7. Si tiene fórmula, trae unidades, fuente y un ejemplo resuelto. Si tiene contenido agronómico, se marca `revision_agronomica: pendiente`.

### 2.2 Definición de Terminado (DoD)

1. Código fusionado a `main` por pull request, con CI en verde: lint, typecheck, pruebas, build, licencias y quality gate.
2. Pruebas unitarias para la lógica. Las funciones de `packages/` tienen casos reales resueltos.
3. **Control negativo** escrito en el pull request: qué defecto se puso y cómo se vio en rojo (P5).
4. Flujos de interfaz con e2e en viewport de 360 px. Si la historia toca datos, también sin conexión.
5. Probado con **las dos fincas de prueba**. Ningún nombre real en el código (P4).
6. Documentación actualizada en el mismo pull request si cambió algo que un documento afirma (P18).
7. Versión subida según semver y entrada en `CHANGELOG.md`.
8. Desplegado a staging. Smoke test en verde. Liberado al anillo que diga la historia.
9. Si algo se rompió en el camino, hay entrada en `BITACORA.md`.
10. Sin lint, typecheck, pruebas y build en verde **no se marca como terminado**, aunque «funcione» (instrucciones §11).

---

## 3. Plan de sprints

| Sprint | Fechas | Meta del sprint | Historias | Pts |
|---|---|---|---|---|
| **S1** | 5–16 oct 2026 | El repositorio sabe probarse solo y los contratos existen | HU-E0.1 (1), HU-E1.1 (3), HU-E1.2 (3), HU-E1.3 (2), HU-E1.7 (1) | 10 |
| **S2** | 19–30 oct | La fórmula DPV existe y la app guarda en el teléfono | HU-E2.1 (2), HU-E1.6 (3), HU-E3.2 (3). Los 2 puntos del spike cancelado quedan de colchón para lo que se atrase del S1 | 8 |
| **S3** | 3–13 nov | La calculadora funciona y el cuaderno se instala | HU-E2.2 (3), HU-E2.5 (2), HU-E3.1 (3), HU-E3.3 (2) | 10 |
| **S4** | 17–27 nov | **H1:** DPV en producción; catálogos del cuaderno | HU-E1.5 (3), HU-E2.4 (1), HU-E2.6 (1), HU-E3.4 (2), HU-E3.5 (1), HU-E3.6 (2) | 10 |
| **S5** | 30 nov–11 dic | **H2:** registrar el día a día del invernadero sin señal | HU-E3.7 (3), HU-E3.8 (1), HU-E3.9 (2), HU-E3.10 (3), HU-E3.14 (1) | 10 |
| **S6** (corto) | 14–23 dic | Corregir, exportar y conectar la DPV con el cuaderno | HU-E3.12 (2), HU-E3.13 (2), HU-E2.7 (1), HU-E0.2 (2) | 7 |
| — | 24 dic–8 ene | Pausa. La finca cero usa el cuaderno local; se anota todo lo que falla | — | — |
| **S7** | 12–22 ene 2027 | Entrar con Google; primeros kill switches; registrar cosecha | HU-E4.1 (3), HU-E4.2 (3), HU-E8.1 (2), HU-E6.1 (2) | 10 |
| **S8** | 25 ene–5 feb | Subir datos a la celda y reclamar lo local | HU-E5.1 (3), HU-E5.2 (3), HU-E4.3 (2), HU-E6.2 (2) | 10 |
| **S9** | 8–19 feb | Bajar datos, política de datos, invitar al equipo, roles | HU-E5.3 (3), HU-E0.5 (2), HU-E4.4 (2), HU-E4.5 (3) — la política antes de la primera invitación | 10 |
| **S10** | 22 feb–5 mar | **H3:** equipo sincronizado a prueba de caos; despachos | HU-E5.5 (2), HU-E8.6 (1), HU-E5.6 (3), HU-E6.3 (3) | 9 |
| **S11** | 8–19 mar | Conflictos visibles; vigía de cuota; respaldos; revocar | HU-E5.4 (2), HU-E4.6 (1), HU-E8.2 (3), HU-E8.4 (3), HU-E6.6 (1) | 10 |
| **S12** (corto) | 23 mar–2 abr | **H4 y H5:** QR de trazabilidad; plagas; alertas y reporte semanal | HU-E6.4 (3), HU-E3.11 (2), HU-E8.3 (2) | 7 |
| **S13** | 5–16 abr | Costos de insumos y jornales; carencias; disponibilidad para la tienda | HU-E7.1 (3), HU-E7.2 (2), HU-E9.1 (2), HU-E6.5 (2) | 9 |
| **S14** | 19–30 abr | **H6:** costo por kg y rendimiento; tabla DPV; calendario de carencias público | HU-E7.3 (2), HU-E7.4 (2), HU-E2.3 (2), HU-E10.1 (2) | 8 |
| **S15** | 3–14 may | **H7:** carpeta de cumplimiento; señal de pago | HU-E9.2 (5), HU-E10.2 (2), HU-E0.6 (2) | 9 |

**Preparadas, sin sprint** (tienen disparador, no fecha):

| Historia | Disparador |
|---|---|
| HU-E8.5 · Mudar una finca de celda (5) | Etapa B o C de ARQUITECTURA §6.3. Construirla antes es resolver el problema de la etapa siguiente (bitácora ecommerce 16). Lo que sí nace desde hoy es lo que la hace posible: `org_id` en cada fila, celdas por configuración y `agro-export v1` |
| HU-E9.3 · Autodiagnóstico ecológico/BPA (3) | Decisión de certificar |
| HU-E10.3 · Dosis por bomba (3) | La medición del 25 feb 2027 (HU-E0.2, regla 3) encuentra búsquedas en Colombia con otras formas de decirlo («cuántos cc por litro», «cuánto echarle a la bomba») |
| HU-E9.4 · Enlace de auditor (2) | Primera auditoría agendada |
| HU-E11.3 · Contrato de reporte de dispositivos (3) | HU-E11.2 funcionando 30 días en el laboratorio |
| HU-E11.4 · El riego ejecutado llena el cuaderno (2) | HU-E11.3 |

**Ceremonias para un equipo de uno** (~1,5 h por sprint):
- Planeación de 30 min el lunes.
- Revisión de 30 min el viernes. Incluye mirar la app en el teléfono de la finca: P20.
- Retrospectiva de 15 min, que decide si algo va a la bitácora.
- Refinamiento de 15 min del sprint siguiente.

La velocidad real se anota al cierre de cada sprint en §7.

---

## 4. Épicas

| Épica | Objetivo | Hito | Pts |
|---|---|---|---|
| E0 · Decisiones y validación | Cerrar la Fase 0 del agro y medir la demanda | H0, H3, H7 | 7 |
| E1 · Cimientos | Monorepo, CI, contratos, despliegue por anillos | H0, H1 | 15 (HU-E1.4 cancelada) |
| E2 · Herramienta DPV | Primera herramienta gratuita, puerta al cuaderno | H1 | 12 |
| E3 · Cuaderno offline | Registrar la operación sin señal | H2 | 29 |
| E4 · Identidad y equipo (CORE v0) | Cuentas, organizaciones, invitaciones, roles | H3 | 14 |
| E5 · Sincronización y celda | Varios teléfonos, un solo cuaderno | H3 | 16 |
| E6 · Cosecha, ventas y trazabilidad | Del surco al cliente, con QR | H4 | 13 |
| E7 · Costos y personal | Cuánto cuesta cada kilo | H6 | 9 |
| E8 · Operación ZCOE | Cuota, kill switch, respaldos, alertas, mudanza | H5 | 11 (+5 preparada) |
| E9 · Cumplimiento | Carencias, carpeta, auditoría | H6, H7 | 7 (+5 preparadas) |
| E10 · Herramienta 2: calendario de carencias | Segunda herramienta gratuita, la de más búsquedas en Colombia (HU-E0.2) | H7 | 4 (+3 preparada) |
| E11 · Línea Conectada | Laboratorio de hardware | H8 | 5 (+5 preparadas), fuera de capacidad |

---

## 5. Historias refinadas

Formato de cada historia:
- **Como / quiero / para.**
- **Peldaño:** dónde está en la escalera y cuál es el siguiente paso del usuario.
- **Prioridad** (MoSCoW) · **Puntos** · **Sprint** · **Depende de.**
- **Criterios de aceptación**, en forma Dado / Cuando / Entonces.
- **Patrones a vigilar** (bitácora).
- **Presupuesto** (si consume cuota).
- **Work items (WI):** tareas de 1 a 4 h.

Estados posibles: `Refinada` (cumple DoR), `En sprint`, `Terminada`, `Preparada` (refinada pero sin sprint).

### E0 · Decisiones y validación

#### HU-E0.1 · Aprobar las decisiones de arquitectura
**Como** dueño **quiero** revisar y aceptar o corregir los ADR 1–19 **para** que el código no discuta decisiones abiertas.
- **Peldaño:** transversal · **Prioridad:** Must · **Puntos:** 1 · **Sprint:** S1 · **Depende de:** — · **Estado:** En sprint (CA1 cumplido el 30 sep 2026: ADR-1 a 18 aceptadas, ADR-19 espera el spike; CA2 cumplido: las cuatro preguntas de ARQUITECTURA §15 respondidas y §1 actualizado)
- **Criterios de aceptación:**
  1. Dado ARQUITECTURA §1, cuando termina la revisión, entonces cada ADR dice `Aceptada` o tiene su corrección escrita.
  2. Dadas las preguntas abiertas de ARQUITECTURA §15, cuando se responden, entonces las respuestas quedan en el documento y los supuestos de §1 de este backlog se actualizan.
  3. No se empieza HU-E1.4 sin respuesta sobre el dominio.
- **Patrones:** P18.
- **WI:**
  - WI-E0.1.1 Leer ARQUITECTURA y marcar desacuerdos (1 h).
  - WI-E0.1.2 Sesión de ajuste y actualización del documento (1 h).
  - WI-E0.1.3 Fecha de trasplante y primera cosecha en §1 (0,5 h).

#### HU-E0.2 · Medir la demanda de búsqueda
**Como** dueño **quiero** el volumen de búsqueda en Colombia y LATAM de ~20 términos de calculadoras agronómicas **para** decidir la segunda y la tercera herramienta con datos.
- **Peldaño:** herramienta gratuita · **Prioridad:** Should · **Puntos:** 2 · **Sprint:** S6 · **Depende de:** H1 publicado (para ver impresiones reales) · **Estado:** En sprint (CA1 a CA3 con Keyword Planner el 1 oct 2026: rangos, marcados R. El dueño aceptó la recomendación el 1 oct 2026: el calendario de carencias reemplaza a «dosis por bomba» como herramienta 2 (E10) y dosis queda preparada. Falta Search Console de la DPV en producción para afinar)
- **Criterios de aceptación:**
  1. Dada una lista de 20 términos (DPV, déficit de presión de vapor, dosis por bomba, carencia, solución nutritiva, drenaje en sustrato, grados-día…), cuando se consultan en Google Keyword Planner o Search Console, entonces queda una tabla con volumen, fuente y fecha en `docs/validacion/busquedas-2026-12.md`.
  2. Cada cifra dice si es dato verificado o estimación.
  3. La tabla termina con una recomendación de orden para las herramientas 2 a 5.
- **Patrones:** P18.
- **WI:**
  - WI-E0.2.1 Lista de términos y variantes regionales (1 h).
  - WI-E0.2.2 Consulta y registro (2 h).
  - WI-E0.2.3 Recomendación (1 h).

#### HU-E0.5 · Política de tratamiento de datos y términos del cuaderno
**Como** productor **quiero** saber qué se guarda, dónde y quién lo ve **para** confiar mis datos y los de mis operarios.
- **Peldaño:** cuenta · **Prioridad:** Must (antes del primer usuario externo) · **Puntos:** 2 · **Sprint:** S9, antes de HU-E4.4 · **Depende de:** HU-E4.1 · **Estado:** Refinada
- **Criterios de aceptación:**
  1. Dada la política en `/agro/privacidad/`, cuando la lee un productor, entonces encuentra: responsable, finalidades, datos de operarios, dónde viven (teléfono y celda), cómo exportar y borrar, y el canal de reclamos (Ley 1581 de 2012).
  2. La política dice la verdad sobre lo que la app hace. Una prueba falla si la app carga un script de medición y la política dice que no hay (bitácora ecommerce 112).
  3. Al crear la cuenta se registra la aceptación con fecha y versión de la política.
  4. Queda marcada «requiere revisión de abogado» hasta que un abogado la revise.
- **Patrones:** P18, P20.
- **WI:**
  - WI-E0.5.1 Borrador de política y términos (2 h).
  - WI-E0.5.2 Página estática y enlace desde el registro (1 h).
  - WI-E0.5.3 Aceptación versionada en el CORE (1,5 h).
  - WI-E0.5.4 Prueba de coherencia política ↔ scripts cargados (1,5 h).

#### HU-E0.6 · Lista de espera de planes con precio visible
**Como** productor que ya usa el cuaderno **quiero** ver qué incluye el plan Finca y el Exportador y cuánto costarán **para** decidir si me interesa.
- **Peldaño:** premium → SaaS · **Prioridad:** Should · **Puntos:** 2 · **Sprint:** S15 · **Depende de:** HU-E4.3 · **Estado:** Refinada
- **Criterios de aceptación:**
  1. Dada la página de planes, cuando un usuario con cuenta toca «Me interesa», entonces se registra un evento de negocio en D1 con plan y organización, sin cobro ni tarjeta.
  2. Los precios son los del Estudio («Precios propuestos») y se marcan como precio de lanzamiento tentativo.
  3. La métrica «intención de pago / cuentas» aparece en el reporte semanal (HU-E8.3).
  4. No se muestra ningún banner ni popup durante el registro de datos (ED1 §28).
- **Presupuesto:** ≤ 50 escrituras D1/día.
- **WI:**
  - WI-E0.6.1 Página de planes (2 h).
  - WI-E0.6.2 Evento de negocio y tabla (1,5 h).
  - WI-E0.6.3 Métrica en el reporte (1 h).

#### Tareas del dueño (no son de desarrollo, pero consumen las mismas horas)

| Tarea | Cuándo | Horas | Resultado |
|---|---|---|---|
| T-0.3 Entrevistas: 5 productores bajo invernadero, 3 asesores técnicos, 2 restaurantes o cadenas compradoras | Oct–nov | 10 h | `docs/validacion/entrevistas.md`: dolor confirmado o no (umbral 0 → 1–2) |
| T-0.4 Conseguir agrónomo aliado que revise DPV y textos | Antes del S3 | 3 h | Resuelta el 30 sep 2026: el supervisor de la finca cero, agrónomo. Se registra en `product.yaml` por rol y fecha (`aprobada:<fecha>:agronomo-aliado`), no por nombre (P4) |
| T-0.5 Documentar el día a día real del invernadero: quién registra qué y cuándo | S3–S5 | 3 h | Ajusta los formularios de E3 |

### E1 · Cimientos

#### HU-E1.1 · Monorepo que corre igual en Windows y en CI
**Como** desarrollador **quiero** un monorepo con pnpm, TypeScript estricto, Biome y Vitest **para** que cada paquete se pruebe igual en mi Windows y en Actions.
- **Peldaño:** transversal · **Prioridad:** Must · **Puntos:** 3 · **Sprint:** S1 · **Depende de:** HU-E0.1 · **Estado:** Terminada (fusionada a `main` el 30 sep 2026, PR #1 y #2; CI en verde en Linux y Windows)
- **Criterios de aceptación:**
  1. Dado un clon limpio en Windows y en Linux, cuando corro `pnpm install && pnpm verificar`, entonces corren lint, typecheck, pruebas y build de todos los paquetes con el mismo resultado.
  2. `tsconfig` base con `strict`, `noUncheckedIndexedAccess` y `exactOptionalPropertyTypes`.
  3. Ningún script de `package.json` invoca `bash`, `sh` ni rutas con `/` fijas. Hay una prueba que lo verifica (P3).
  4. La estructura de carpetas es la de ARQUITECTURA §11.
  5. Un `package.json` con una clave inválida en `devDependencies` hace fallar la instalación en CI. Se comprueba con control negativo (bitácora ecommerce, «nota en devDependencies»).
- **Patrones:** P3, P14.
- **WI:**
  - WI-E1.1.1 Esqueleto de carpetas y `pnpm-workspace.yaml` (1 h).
  - WI-E1.1.2 tsconfig base y por paquete (1,5 h).
  - WI-E1.1.3 Biome con reglas `noShadow`, sin catch vacío y sin `import.meta.url` comparado con cadenas (2 h).
  - WI-E1.1.4 Vitest con cobertura (1 h).
  - WI-E1.1.5 Script `verificar` en Node (1 h).
  - WI-E1.1.6 Prueba «ningún script usa shell» (1,5 h).
  - WI-E1.1.7 README de arranque (1 h).

#### HU-E1.2 · CI que dice todo lo que falla
**Como** desarrollador **quiero** que cada pull request corra lint, typecheck, pruebas, build, licencias y guardias de documentación y resuma **todas** las fallas **para** no descubrir una falla por corrida.
- **Peldaño:** transversal · **Prioridad:** Must · **Puntos:** 3 · **Sprint:** S1 · **Depende de:** HU-E1.1 · **Estado:** Terminada (fusionada a `main` el 30 sep 2026, PR #1 y #2; CI en verde en Linux y Windows)
- **Criterios de aceptación:**
  1. Dado un pull request, cuando corre `ci.yml`, entonces el resumen de la corrida lista cada verificación con ✅ o ❌ y, debajo, cada falla con su mensaje (P15).
  2. Una dependencia con licencia AGPL o sin licencia hace fallar el build con el nombre del paquete.
  3. Toda tubería con `tee` lleva `set -o pipefail`. Una prueba de los YAML lo exige, con control negativo.
  4. Un secreto nombrado en un flujo y ausente de ARQUITECTURA §7.5 hace fallar la corrida (P18).
  5. La corrida vieja de la misma rama se cancela. Ningún trabajo pasa de 15 min.
  6. Existe un trabajo `windows-latest` para `scripts/` que corre si cambian `scripts/**` y los lunes.
  7. La plantilla de pull request pide «Control negativo» y «¿Cambió algo que un documento afirma?».
- **Patrones:** P5, P14, P15, P18, P19.
- **Presupuesto:** Actions < 8 min por corrida.
- **WI:**
  - WI-E1.2.1 `ci.yml` con los pasos y la cancelación (2 h).
  - WI-E1.2.2 Resumen de fallas en `$GITHUB_STEP_SUMMARY` (2 h).
  - WI-E1.2.3 Verificador de licencias (1,5 h).
  - WI-E1.2.4 Guardias de YAML (pipefail) y de secretos documentados (2 h).
  - WI-E1.2.5 Trabajo Windows condicionado (1 h).
  - WI-E1.2.6 Plantilla de pull request (0,5 h).

#### HU-E1.3 · Contrato `product.yaml` agro validado en CI
**Como** dueño **quiero** que cada herramienta declare su contrato (peldaño, siguiente paso, presupuesto, kill switch, revisión agronómica) **para** que ninguna salga sin sus reglas.
- **Peldaño:** transversal · **Prioridad:** Must · **Puntos:** 2 · **Sprint:** S1 · **Depende de:** HU-E1.1 · **Estado:** Terminada (fusionada a `main` el 30 sep 2026, PR #1 y #2; CI en verde en Linux y Windows)
- **Criterios de aceptación:**
  1. Dado `schemas/product.schema.json` con la extensión agro de ARQUITECTURA §5.1, cuando un `product.yaml` omite `presupuesto`, `kill_switch`, `peldano` o `siguiente_paso`, entonces CI falla y nombra el campo.
  2. Un producto en estado `activo` con `revision_agronomica: pendiente` hace fallar CI.
  3. `relacionados` solo acepta ids de productos que existen.
  4. `runtime: api` exige `presupuesto.api_requests_dia > 0` y una justificación.
- **Patrones:** P2, P18.
- **WI:**
  - WI-E1.3.1 Esquema JSON (1,5 h).
  - WI-E1.3.2 Validador en Node con Ajv y mensajes en español (2 h).
  - WI-E1.3.3 `product.yaml` de la DPV y del cuaderno (1 h).
  - WI-E1.3.4 Pruebas con control negativo (1,5 h).

#### HU-E1.7 · Dos fincas de prueba y ningún nombre real
**Como** desarrollador **quiero** fixtures de dos fincas de prueba distintas y una lista de términos prohibidos **para** que ninguna prueba dependa de la finca cero.
- **Peldaño:** transversal · **Prioridad:** Must · **Puntos:** 1 · **Sprint:** S1 · **Depende de:** HU-E1.1 · **Estado:** Terminada (fusionada a `main` el 30 sep 2026, PR #1 y #2; CI en verde en Linux y Windows)
- **Criterios de aceptación:**
  1. Existen `Finca Ensayo Uno` (hortaliza, 3 naves, ecológica) y `Finca Ensayo Dos` (flores, 5 bloques, convencional) en `tests/fixtures/`.
  2. `tests/terminos-prohibidos.json` contiene los nombres reales de la finca cero y de sus personas. La lista vive fuera del repositorio público si algún día se publica.
  3. CI falla si un término prohibido aparece en `apps/`, `packages/`, `content/` o `tests/`, excepto en la propia lista.
- **Patrones:** P4, P6.
- **WI:**
  - WI-E1.7.1 Fixtures (1 h).
  - WI-E1.7.2 Prueba de términos prohibidos con control negativo (1,5 h).

#### HU-E1.4 · Spike: servir `/herramientas/agro/` en el dominio principal sin gastar cuota — *Cancelada*

> Cancelada el 30 sep 2026: el dueño eligió el subdominio `agro.laboratorio-digital.com` con las mismas rutas (ADR-19 aceptada). Se conserva como referencia si algún día se valida mudar al dominio principal.

**Como** dueño **quiero** saber si un Worker con Static Assets puede servir rutas del dominio principal gratis **para** decidir ADR-19.
- **Peldaño:** herramienta gratuita · **Prioridad:** Must · **Puntos:** 2 (caja de tiempo: 6 h) · **Sprint:** S2 · **Depende de:** HU-E0.1 (respuesta sobre el dominio) · **Estado:** Cancelada
- **Criterios de aceptación:**
  1. Dado un Worker de prueba con assets en una ruta del dominio, cuando se piden 100 páginas, entonces las métricas de Cloudflare muestran 0 invocaciones del script, o se documenta que no es así.
  2. El resultado queda en ARQUITECTURA ADR-19 como `Aceptada` o con el plan B (subdominio) aplicado, con la fuente y la fecha.
  3. Nada del spike queda desplegado al terminar.
- **Patrones:** P9, P16.
- **WI:**
  - WI-E1.4.1 Montar el Worker de prueba (2 h).
  - WI-E1.4.2 Medir con las métricas del panel (1 h).
  - WI-E1.4.3 Documentar y retirar (1 h).

#### HU-E1.6 · Cascarón del sitio: layout, SEO, relacionados y eventos en lote
**Como** visitante **quiero** páginas rápidas, legibles en el teléfono y con herramientas relacionadas **para** resolver y seguir.
- **Peldaño:** herramienta gratuita · **Prioridad:** Must · **Puntos:** 3 · **Sprint:** S2 · **Depende de:** HU-E1.3 · **Estado:** En sprint (rama `feat/e1.6-cascaron-sitio`: CA1 a CA5 hechos y probados en local; se cierra al fusionar con CI en verde)
- **Criterios de aceptación:**
  1. Dado un `product.yaml`, cuando se hace el build de Astro, entonces se generan el título, la descripción, el canonical, Open Graph, las migas y el sitemap sin escribirlos a mano.
  2. Los eventos `tool.opened`, `tool.completed`, `tool.shared` y `tool.next_step` se acumulan y salen en **un** `sendBeacon` por sesión. Una prueba cuenta las solicitudes: 1.
  3. La página renderiza el contenido completo sin JavaScript (P20). La calculadora es una isla.
  4. Presupuesto de rendimiento: LCP < 2,5 s en un perfil 4G lento, JS de la página < 50 KB comprimido.
  5. Accesibilidad WCAG AA verificada con axe en CI.
- **Patrones:** P20, P2.
- **Presupuesto:** 1 invocación del Worker por sesión con eventos; Analytics Engine ≤ 20.000 puntos/día para todo agro.
- **WI:**
  - WI-E1.6.1 Layout y tokens de `packages/ui` (2 h).
  - WI-E1.6.2 SEO derivado del contrato (2 h).
  - WI-E1.6.3 `packages/eventos` con lote y beacon (2 h).
  - WI-E1.6.4 Endpoint `/api/eventos` → Analytics Engine (1,5 h).
  - WI-E1.6.5 Lighthouse CI y axe (1,5 h).

#### HU-E1.5 · Despliegue por anillos desde `celdas.json`
**Como** dueño **quiero** que una fusión a `main` despliegue a staging y que publicar una versión despliegue a cada celda en su orden **para** no desplegar a mano ni en el orden equivocado.
- **Peldaño:** transversal · **Prioridad:** Must · **Puntos:** 3 · **Sprint:** S4 · **Depende de:** HU-E1.2 (HU-E1.4 cancelada; el host sale de ADR-19) · **Estado:** En sprint (rama `feat/e1.5-despliegue`. CA1 a CA5 hechos y probados sin red; CA6, la corrida real contra staging, ocurre al fusionar a `main`)
- **Criterios de aceptación:**
  1. `infrastructure/celdas.json` es la única lista de celdas. `scripts/generar-wrangler` produce la configuración por celda y una prueba compara (P2).
  2. Antes de desplegar, el flujo verifica el `CF_API_TOKEN` de esa celda con una lectura. Si falla, se detiene con el nombre de la celda y el permiso que falta (P12).
  3. El flujo despliega en el orden de `anillo_despliegue`, se detiene en la primera celda que falle y nombra las que quedaron sin tocar y cómo seguir (bitácora ecommerce 105).
  4. Una celda con `estado: fuera` no recibe despliegues.
  5. Después de cada despliegue corre un smoke test contra las fincas de prueba sembradas en staging, nunca contra la finca cero (P11).
  6. El flujo se corrió de punta a punta al menos una vez contra staging antes de cerrar la historia (P16).
- **Patrones:** P2, P11, P12, P15, P16.
- **WI:**
  - WI-E1.5.1 `celdas.json` y su esquema (1 h).
  - WI-E1.5.2 Generador de wrangler (2 h).
  - WI-E1.5.3 `desplegar.yml` con matriz y orden (2,5 h).
  - WI-E1.5.4 Verificación del token (1 h).
  - WI-E1.5.5 Smoke tests (1,5 h).
  - WI-E1.5.6 Corrida real y ajuste (1,5 h).

### E2 · Herramienta DPV

#### HU-E2.1 · Función pura de DPV con fuente y casos
**Como** desarrollador **quiero** `dpvAireKPa` y `dpvHojaKPa` en `packages/agro-calc` **para** que la calculadora, el cuaderno y el firmware den el mismo número.
- **Peldaño:** herramienta gratuita · **Prioridad:** Must · **Puntos:** 2 · **Sprint:** S2 · **Depende de:** HU-E1.1 · **Estado:** Terminada (fusionada a `main` el 30 sep 2026, PR #1 y #2; CI en verde en Linux y Windows)
- **Criterios de aceptación:**
  1. Dados los casos de ARQUITECTURA §5.2, cuando se ejecutan las pruebas, entonces coinciden a 0,001 kPa: 24 °C/70 % → 0,895; 28/55 → 1,701; 22/85 → 0,397; 16/90 → 0,182; hoja 24 °C con aire 26 °C/60 % → 0,967.
  2. HR fuera de 0–100 %, T fuera de −10 a 60 °C o un valor no numérico **lanzan error**. Nunca devuelven 0 ni `NaN` (P1).
  3. La tabla de casos está en `packages/agro-calc/casos/dpv.json` y es la que usará el firmware (P2).
  4. Cada función documenta fórmula, unidades y fuente (FAO-56, ec. 11).
- **Patrones:** P1, P2.
- **WI:**
  - WI-E2.1.1 Funciones y tipos (1,5 h).
  - WI-E2.1.2 Tabla de casos y pruebas con control negativo (2 h).
  - WI-E2.1.3 Documentación en el código y en `content/` (1 h).

#### HU-E2.2 · Calcular el DPV del invernadero
**Como** productor con invernadero **quiero** poner temperatura y humedad y ver el DPV con una indicación clara **para** decidir si ventilo, cierro o nebulizo.
- **Peldaño:** herramienta gratuita → siguiente: guardar la lectura en el cuaderno (HU-E2.7) · **Prioridad:** Must · **Puntos:** 3 · **Sprint:** S3 · **Depende de:** HU-E2.1, HU-E1.6 · **Estado:** En sprint (rama `feat/e2.2-calculadora-dpv`. CA5: probado con la página abierta y sin red; abrirla de cero sin red depende de la caché HTTP del despliegue, HU-E1.5)
- **Criterios de aceptación:**
  1. Dado T = 24 °C y HR = 70 %, cuando escribo los valores, entonces veo «0,90 kPa», con coma decimal, sin tocar un botón.
  2. Dado el cultivo «Tomate» y etapa «Producción», cuando el DPV está en 0,5–0,8 kPa, entonces se indica «en rango». Fuera de 0,4–1,2 kPa se indica «alto» o «bajo» con una acción sugerida en lenguaje de finca. Los rangos salen del catálogo y citan su fuente.
  3. Acepta «24,5» y «24.5». Rechaza «24,,5» con un mensaje junto al campo, sin calcular.
  4. Opción avanzada: temperatura de hoja → DPV de hoja.
  5. Funciona sin conexión si la página ya se había abierto (caché del navegador), y ningún dato sale del teléfono. En la red del navegador no aparece ninguna solicitud al calcular.
  6. Se emite `tool.completed` la primera vez que hay un resultado válido.
- **Patrones:** P1, P20.
- **Presupuesto:** 0 solicitudes al calcular.
- **WI:**
  - WI-E2.2.1 Isla Preact con campos numéricos accesibles (2,5 h).
  - WI-E2.2.2 Catálogo de rangos por cultivo y etapa (1,5 h).
  - WI-E2.2.3 Indicador y mensajes (1,5 h).
  - WI-E2.2.4 e2e en 360 px, sin red y con control negativo (2 h).
  - WI-E2.2.5 Eventos (1 h).

#### HU-E2.5 · Página útil de la DPV
**Como** productor que llega desde Google **quiero** entender qué es el DPV, un ejemplo con números de invernadero colombiano y respuestas a mis dudas **para** confiar en el resultado.
- **Peldaño:** herramienta gratuita · **Prioridad:** Must · **Puntos:** 2 · **Sprint:** S3 · **Depende de:** HU-E2.2, T-0.4 · **Estado:** En sprint (rama `feat/e2.5-pagina-dpv`. CA1, CA2 y CA4 hechos; CA4 enlaza al cuaderno, la otra herramienta relacionada entra con HU-E10.1. Falta CA3: aprobación del agrónomo)
- **Criterios de aceptación:**
  1. La página responde las cuatro preguntas de ED1 §12.1 y pasa el quality gate: ejemplo resuelto (24 °C y 70 % en una nave de tomate a media mañana), al menos 5 preguntas frecuentes específicas y fuentes con fecha.
  2. Aclara que los rangos son de referencia y varían por cultivo, variedad y etapa.
  3. El agrónomo aliado aprobó el texto: `revision_agronomica: aprobada:<fecha>:<quién>`.
  4. Enlaza al cuaderno y a una herramienta relacionada que exista.
- **Patrones:** P18, P20.
- **WI:**
  - WI-E2.5.1 Borrador del contenido (2 h).
  - WI-E2.5.2 Revisión agronómica (1 h del dueño).
  - WI-E2.5.3 Schema.org (FAQPage, HowTo) (1 h).
  - WI-E2.5.4 Ajustes del quality gate (1 h).

#### HU-E2.4 · Compartir el resultado por WhatsApp
**Como** productor **quiero** mandar el resultado a mi asesor o a mi grupo **para** discutirlo sin capturas de pantalla.
- **Peldaño:** herramienta gratuita (adquisición por referidos) · **Prioridad:** Should · **Puntos:** 1 · **Sprint:** S4 · **Depende de:** HU-E2.2 · **Estado:** En sprint (rama `feat/e2.4-compartir-whatsapp`. CA4: el texto no lleva emoji)
- **Criterios de aceptación:**
  1. Dado un resultado, cuando toco «Compartir por WhatsApp», entonces se abre WhatsApp con un texto que incluye T, HR, DPV, indicación y enlace a la calculadora con los valores cargados.
  2. El enlace lleva solo T y HR, nunca datos personales (P13).
  3. Abrir el enlace muestra el mismo resultado. Hay e2e con control negativo.
  4. Emoji, si hay, al final del texto (bitácora ecommerce, «Un emoji al principio…»).
- **WI:**
  - WI-E2.4.1 Texto y enlace `wa.me` (1 h).
  - WI-E2.4.2 Lectura de parámetros (1 h).
  - WI-E2.4.3 e2e (1 h).

#### HU-E2.6 · Publicar, indexar y medir
**Como** dueño **quiero** la DPV en producción, en el sitemap y en Search Console, con la tasa de completado visible **para** empezar el reloj de 90 días.
- **Peldaño:** herramienta gratuita · **Prioridad:** Must · **Puntos:** 1 · **Sprint:** S4 · **Depende de:** HU-E1.5, HU-E2.5 · **Estado:** Refinada
- **Criterios de aceptación:**
  1. El `product.yaml` pasa a `activo` y CI lo acepta (revisión agronómica aprobada).
  2. La URL está en el sitemap, se solicitó su indexación y la fecha queda en `docs/validacion/dpv.md`.
  3. Una consulta de Analytics Engine documentada devuelve `tool.completed / tool.opened` por semana.
  4. El kill switch `ks:agro-calculadora-dpv` apaga el envío de eventos sin romper la calculadora.
- **WI:**
  - WI-E2.6.1 Publicación (0,5 h).
  - WI-E2.6.2 Search Console y Web Analytics (1 h).
  - WI-E2.6.3 Consulta de la métrica (1 h).

#### HU-E2.7 · De la calculadora al cuaderno
**Como** productor que calculó el DPV **quiero** guardar esa lectura **para** llevar el historial del clima de mi nave sin volver a escribirla.
- **Peldaño:** herramienta gratuita → usuario recurrente · **Prioridad:** Should · **Puntos:** 1 · **Sprint:** S6 · **Depende de:** HU-E3.8 · **Estado:** En sprint (rama `feat/e2.7-calculadora-a-cuaderno`. CA2: «instalado» = este navegador ya tiene la base del cuaderno (`indexedDB.databases()`, mismo dominio); sin finca, la lectura espera 2 h en el teléfono hasta que se configure. CA3: el envío real sale en `pagehide`; la e2e lo comprueba deteniendo la navegación, porque Playwright no ve solicitudes de una página que se descarga — verificar en staging con Analytics Engine)
- **Criterios de aceptación:**
  1. Dado un resultado, cuando toco «Guardar en mi cuaderno», entonces se abre el cuaderno con un registro de clima prellenado (T, HR y T de hoja) para elegir la nave. Los datos pasan en el fragmento, sin red.
  2. Sin cuaderno instalado, se explica en una línea qué es y se ofrece abrirlo, sin pedir cuenta (ED1 §28).
  3. Se emite `tool.next_step`.
- **WI:**
  - WI-E2.7.1 Botón y paso de datos (1,5 h).
  - WI-E2.7.2 Recepción en el cuaderno (1 h).
  - WI-E2.7.3 e2e (0,5 h).

#### HU-E2.3 · Tabla de DPV imprimible
**Como** supervisor **quiero** una tabla de temperatura × humedad con el DPV coloreado según mi cultivo **para** pegarla en la nave y decidir sin teléfono.
- **Peldaño:** herramienta gratuita · **Prioridad:** Could · **Puntos:** 2 · **Sprint:** S14 · **Depende de:** HU-E2.2 · **Estado:** Refinada
- **Criterios de aceptación:**
  1. Dado el cultivo y un rango de T (p. ej. 12–34 °C) y de HR (40–95 %), cuando imprimo, entonces sale una tabla en una hoja A4 o carta, legible en blanco y negro (patrón además del color).
  2. Los valores coinciden con `agro-calc`. La prueba compara 10 celdas al azar.
  3. PDF generado en el navegador (pdf-lib), sin servidor.
- **WI:**
  - WI-E2.3.1 Tabla y estilos de impresión (2 h).
  - WI-E2.3.2 PDF (2 h).
  - WI-E2.3.3 Pruebas (1 h).

### E3 · Cuaderno offline

#### HU-E3.2 · Almacén local con esquema versionado
**Como** desarrollador **quiero** Dexie sobre IndexedDB con esquemas de `packages/agro-schema`, ids UUIDv7 y migraciones locales **para** que ningún dato se pierda al actualizar la app.
- **Peldaño:** usuario recurrente · **Prioridad:** Must · **Puntos:** 3 · **Sprint:** S2 · **Depende de:** HU-E1.1 · **Estado:** En sprint (rama `feat/e3.2-almacen-local`)
- **Criterios de aceptación:**
  1. Guardar un registro y su operación de salida (`outbox`) es **una** transacción. Si falla una, no queda ninguna.
  2. Un registro con un campo de medida vacío o ilegible no se guarda y el error nombra el campo (P1).
  3. Dada una base creada con la versión N−1 del esquema con datos de las dos fincas de prueba, cuando abre la versión N, entonces no se pierde ningún registro. La prueba se ve en rojo con una migración que borra una tabla (P4, P21).
  4. Se pide `navigator.storage.persist()` y se guarda si fue concedido.
  5. Las pruebas usan `fake-indexeddb`, y el archivo de pruebas documenta que no imita cuotas ni desalojo (P17).
- **Patrones:** P1, P4, P17, P21.
- **WI:**
  - WI-E3.2.1 `agro-schema`: finca, área, ciclo, persona, insumo y registro base (2 h).
  - WI-E3.2.2 Dexie, tablas e índices (1,5 h).
  - WI-E3.2.3 UUIDv7 y reloj (1 h).
  - WI-E3.2.4 Transacción registro + outbox (1,5 h).
  - WI-E3.2.5 Prueba de migración N−1 → N (2 h).
  - WI-E3.2.6 Persistencia (0,5 h).

#### HU-E3.1 · PWA instalable que no pierde datos al actualizarse
**Como** operario **quiero** abrir el cuaderno desde un ícono en mi teléfono aunque no haya señal **para** registrar en la nave.
- **Peldaño:** usuario recurrente · **Prioridad:** Must · **Puntos:** 3 · **Sprint:** S3 · **Depende de:** HU-E3.2, HU-E1.6 · **Estado:** En sprint (rama `feat/e3.1-pwa-cuaderno`. CA2: «operaciones pendientes» = escrituras en curso, no la cola de salida; el texto dice «podrás aplicarla cuando termines» porque nunca se aplica sola. El caso «formulario abierto» tiene e2e con el asistente de HU-E3.3)
- **Criterios de aceptación:**
  1. Dado que el cuaderno se abrió una vez con señal, cuando lo abro en modo avión, entonces carga completo en menos de 3 s en un teléfono de gama baja (perfil de CPU ×4 en Playwright).
  2. Hay una versión nueva y hay operaciones pendientes o un formulario abierto: la app **no** se recarga sola y muestra «Hay una actualización; se aplicará cuando termines».
  3. El service worker nunca guarda en caché una respuesta de error de `/api/*` (P7). Hay prueba.
  4. Manifest con nombre, íconos, `scope: /agro/app/`, color y `display: standalone`. Instalable en Android Chrome.
  5. `noindex` en todo `/agro/app/`.
- **Patrones:** P7, P10, P20.
- **WI:**
  - WI-E3.1.1 Shell Preact y rutas (2 h).
  - WI-E3.1.2 Workbox y estrategia de caché (2 h).
  - WI-E3.1.3 Flujo de actualización seguro (2 h).
  - WI-E3.1.4 Manifest e íconos (1 h).
  - WI-E3.1.5 e2e offline y de actualización con control negativo (2 h).

#### HU-E3.3 · Configurar mi finca y mis naves
**Como** propietario **quiero** crear mi finca, su régimen (ecológico o convencional) y sus áreas (naves, bloques o lotes) con su tamaño **para** registrar cada cosa en su lugar.
- **Peldaño:** usuario recurrente · **Prioridad:** Must · **Puntos:** 2 · **Sprint:** S3 · **Depende de:** HU-E3.2 · **Estado:** En sprint (rama `feat/e3.3-finca-y-naves`)
- **Criterios de aceptación:**
  1. Dado un teléfono sin datos, cuando abro el cuaderno, entonces un asistente de 3 pasos crea la finca (nombre, municipio, régimen) y sus áreas (tipo, nombre, m²).
  2. Nombre y municipio arrancan **vacíos**; no hay valores de ejemplo que puedan quedarse (bitácora ecommerce, «configuración de fábrica»).
  3. Un área puede tener subáreas (cama, surco) opcionales.
  4. Editar un área crea una nueva versión y deja historial.
  5. Funciona igual con `Finca Ensayo Uno` (naves) y `Finca Ensayo Dos` (bloques) (P4).
- **WI:**
  - WI-E3.3.1 Asistente de configuración (2,5 h).
  - WI-E3.3.2 CRUD de áreas con historial (2 h).
  - WI-E3.3.3 e2e con las dos fincas (1,5 h).

#### HU-E3.4 · Ciclo de cultivo
**Como** supervisor **quiero** registrar qué cultivo y variedad se sembró en cada nave, cuándo y cuántas plantas **para** calcular rendimiento y organizar las labores por ciclo.
- **Peldaño:** usuario recurrente · **Prioridad:** Must · **Puntos:** 2 · **Sprint:** S4 · **Depende de:** HU-E3.3 · **Estado:** En sprint (rama `feat/e3.4-ciclo-de-cultivo`)
- **Criterios de aceptación:**
  1. Dado un área, cuando creo un ciclo con cultivo, variedad, fecha de trasplante y número de plantas, entonces queda activo y los registros nuevos de esa área se asocian a él por defecto.
  2. Cultivo y variedad salen de un catálogo editable; agregar una variedad nueva no requiere código.
  3. Cerrar un ciclo pide fecha de fin y no deja crear registros nuevos sobre él (pide confirmación explícita).
  4. Los días desde el trasplante se calculan con la fecha agronómica local. Hay prueba en fin de mes y en cambio de año (P8).
- **Patrones:** P8.
- **WI:**
  - WI-E3.4.1 Modelo y formulario (2 h).
  - WI-E3.4.2 Catálogo de cultivos y variedades (1,5 h).
  - WI-E3.4.3 Pruebas de fechas (1,5 h).

#### HU-E3.5 · Personas de la finca
**Como** supervisor **quiero** tener la lista de personas que trabajan, aunque no tengan cuenta **para** asignarles labores y cosechas.
- **Peldaño:** usuario recurrente · **Prioridad:** Must · **Puntos:** 1 · **Sprint:** S4 · **Depende de:** HU-E3.3 · **Estado:** En sprint (rama `feat/e3.5-e3.6-personas-insumos`)
- **Criterios de aceptación:**
  1. Una persona tiene nombre y rol en la finca. El valor del jornal es opcional y se guarda aparte, visible solo para propietario y supervisor.
  2. No se pide cédula ni teléfono (minimización de datos, Ley 1581).
  3. Una persona inactiva no aparece en los formularios pero conserva su historial.
- **WI:**
  - WI-E3.5.1 Modelo y lista (1,5 h).
  - WI-E3.5.2 Pruebas (1 h).

#### HU-E3.6 · Insumos con los datos de su etiqueta
**Como** supervisor **quiero** registrar cada insumo con su registro ICA, carencia y reentrada tal como dice la etiqueta **para** que la app me avise antes de cosechar o entrar a una nave aplicada.
- **Peldaño:** usuario recurrente · **Prioridad:** Must · **Puntos:** 2 · **Sprint:** S4 · **Depende de:** HU-E3.3 · **Estado:** En sprint (rama `feat/e3.5-e3.6-personas-insumos`)
- **Criterios de aceptación:**
  1. Un insumo tiene nombre comercial, tipo, registro ICA, ingrediente activo, unidad, carencia (días), reentrada (horas) y «permitido en producción ecológica», declarado por el usuario.
  2. El formulario dice textualmente que los datos se copian de la etiqueta del producto registrado ante el ICA y que la app no recomienda productos ni dosis.
  3. En una finca con régimen ecológico, un insumo no marcado como permitido muestra un aviso al usarlo. No lo bloquea: la decisión es del productor.
  4. Carencia vacía **no es cero**. La app la trata como «desconocida» y lo muestra en rojo en el calendario (P1).
- **Patrones:** P1.
- **WI:**
  - WI-E3.6.1 Modelo y formulario (2 h).
  - WI-E3.6.2 Textos legales y aviso ecológico (1 h).
  - WI-E3.6.3 Pruebas con control negativo de «vacío ≠ 0» (1,5 h).

#### HU-E3.7 · Registrar el riego en sustrato
**Como** operario **quiero** anotar el riego de cada nave con volumen, CE y pH de entrada y de drenaje **para** saber si estoy regando de más o de menos.
- **Peldaño:** usuario recurrente · **Prioridad:** Must · **Puntos:** 3 · **Sprint:** S5 · **Depende de:** HU-E3.4 · **Estado:** En sprint (rama `feat/e3.7-registro-riego`)
- **Criterios de aceptación:**
  1. Dado un riego con volumen aplicado y volumen drenado (en mL por gotero o L por nave), cuando guardo, entonces veo el % de drenaje = drenado / aplicado × 100, calculado en `agro-calc` con sus casos.
  2. CE en dS/m y pH con rangos válidos (CE 0–10, pH 3–10). Fuera de rango, el campo avisa y no guarda. Vacío es «no medido», distinto de 0.
  3. Se puede registrar el riego de varias naves de una vez con los mismos valores.
  4. Guardar funciona en modo avión y el registro queda «solo en este teléfono».
  5. El formulario se llena en menos de 30 s con una mano (4 campos visibles, teclado numérico).
  6. *(Agregado por el dueño el 1 oct 2026.)* Duración del riego en minutos, opcional y visible junto a los volúmenes: esquema `riego` v2; los v1 siguen válidos.
- **Patrones:** P1, P20.
- **WI:**
  - WI-E3.7.1 `drenajePct` en agro-calc con casos (1 h).
  - WI-E3.7.2 Esquema del registro `riego` v1 (1 h).
  - WI-E3.7.3 Formulario rápido (3 h).
  - WI-E3.7.4 Registro múltiple (1,5 h).
  - WI-E3.7.5 e2e offline (1,5 h).

#### HU-E3.8 · Registrar el clima con DPV calculado
**Como** operario **quiero** anotar temperatura y humedad de la nave y ver el DPV al instante **para** tener el historial del clima sin sensores.
- **Peldaño:** usuario recurrente · **Prioridad:** Must · **Puntos:** 1 · **Sprint:** S5 · **Depende de:** HU-E2.1, HU-E3.4 · **Estado:** En sprint (rama `feat/e3.8-registro-clima`. CA3: el cuaderno ya lee `#t=…&hr=…&th=…`; el botón de la calculadora es HU-E2.7)
- **Criterios de aceptación:**
  1. El registro `clima` guarda T, HR, T de hoja opcional y el DPV calculado, recalculable desde los datos crudos.
  2. La indicación de rango usa el mismo catálogo que la calculadora pública (P2).
  3. Acepta datos prellenados desde la calculadora (HU-E2.7).
- **WI:**
  - WI-E3.8.1 Esquema y formulario (2 h).
  - WI-E3.8.2 Pruebas (1 h).

#### HU-E3.9 · Registrar labores
**Como** operario **quiero** anotar qué labor hice, en qué nave, con quién y cuántas horas **para** que quede constancia y se puedan calcular los costos.
- **Peldaño:** usuario recurrente · **Prioridad:** Must · **Puntos:** 2 · **Sprint:** S5 · **Depende de:** HU-E3.5 · **Estado:** En sprint (rama `feat/e3.9-registro-labores`. CA1: el catálogo arranca vacío y las cinco labores del ejemplo se ofrecen como sugerencia; entran al catálogo al usarlas. CA3: el aviso de más de 12 h no bloquea, pide confirmar)
- **Criterios de aceptación:**
  1. Tipos de labor desde un catálogo editable (tutorado, deshoje, poda, polinización, limpieza…).
  2. Se eligen una o varias personas: modo tablero, sin necesidad de cuenta.
  3. Horas con medias horas. Una labor de más de 12 h por persona en un día avisa.
  4. Las últimas 3 labores usadas aparecen primero.
- **WI:**
  - WI-E3.9.1 Esquema y catálogo (1,5 h).
  - WI-E3.9.2 Formulario con recientes (2,5 h).
  - WI-E3.9.3 Pruebas (1 h).

#### HU-E3.10 · Registrar aplicaciones y ver cuándo vence la carencia
**Como** supervisor **quiero** anotar cada aplicación con el insumo, la dosis de la etiqueta y la nave **para** saber cuándo se puede cosechar y cuándo entrar de nuevo.
- **Peldaño:** usuario recurrente → premium (carpeta) · **Prioridad:** Must · **Puntos:** 3 · **Sprint:** S5 · **Depende de:** HU-E3.6 · **Estado:** En sprint (rama `feat/e3.10-aplicaciones-carencia`. CA1: la fecha mostrada es el primer día en que se cosecha (aplicado el 10/12 con 3 días → se cosecha desde el 13/12); lo confirma el agrónomo aliado. Carencia y reentrada se copian del insumo al aplicar; si eran desconocidas, completar el insumo levanta el bloqueo. La reentrada desconocida también va en rojo)
- **Criterios de aceptación:**
  1. Dado un insumo con carencia de 3 días aplicado el 10 de diciembre en la nave 2, cuando guardo, entonces la nave 2 muestra «No cosechar hasta el 13/12» y «Reentrada desde <fecha y hora>».
  2. La dosis se registra como texto y número con la etiqueta «según etiqueta del producto». La app no sugiere dosis (instrucciones §7).
  3. Los vencimientos se calculan en fecha agronómica local y se prueban con TZ distinta, fin de mes y 29 de febrero (P8).
  4. Carencia «desconocida» se muestra como bloqueo rojo hasta que se complete el insumo (P1).
  5. En régimen ecológico, el aviso de HU-E3.6 aparece también aquí.
- **Patrones:** P1, P8.
- **WI:**
  - WI-E3.10.1 `vencimientoCarencia` y `vencimientoReentrada` en agro-calc con casos (2 h).
  - WI-E3.10.2 Esquema y formulario (2,5 h).
  - WI-E3.10.3 Indicador por nave (1,5 h).
  - WI-E3.10.4 Pruebas de reloj (2 h).

#### HU-E3.14 · Saber dónde está cada dato
**Como** operario **quiero** ver si mis registros están solo en el teléfono, enviados o rechazados **para** no perder trabajo ni creer que algo se envió cuando no.
- **Peldaño:** usuario recurrente → cuenta · **Prioridad:** Must · **Puntos:** 1 · **Sprint:** S5 · **Depende de:** HU-E3.2 · **Estado:** En sprint (rama `feat/e3.14-donde-esta-cada-dato`. CA1 y CA2 hechos; CA3 hecho con HU-E5.2: lo que la celda pone en cuarentena queda en la tabla local `rechazo` y se ve en rojo con su motivo en la cabecera y en Cuenta)
- **Criterios de aceptación:**
  1. En la cabecera, un indicador dice cuántos registros están «solo en este teléfono». Tocarlo explica qué significa.
  2. Antes de existir la sincronización, el indicador recomienda exportar cada semana (HU-E3.13).
  3. Un registro rechazado (desde E5) se ve en rojo con su motivo en palabras.
- **Patrones:** P1, P15.
- **WI:**
  - WI-E3.14.1 Indicador y explicación (2 h).
  - WI-E3.14.2 Pruebas (1 h).

#### HU-E3.12 · Historial por nave y corregir sin borrar
**Como** supervisor **quiero** ver lo registrado por nave y día y corregir un error **para** que el cuaderno sea confiable sin perder la traza.
- **Peldaño:** usuario recurrente → premium · **Prioridad:** Must · **Puntos:** 2 · **Sprint:** S6 · **Depende de:** HU-E3.7, HU-E3.9, HU-E3.10 · **Estado:** En sprint (rama `feat/e3.12-historial-corregir`. CA1: medido en e2e con la CPU ×4, 1.350 registros de 90 días cargan en 0,4–0,5 s medidos dentro de la página; desde el 1 oct 2026 la medición corre sin otras pruebas en paralelo (bitácora agro 20); la lista muestra de a 50. CA2: «quién» es el teléfono que anotó y el que corrigió; con cuentas (E4) será la persona. Se corrige clima, riego, labor y aplicación; una corrección conserva área y fecha del evento)
- **Criterios de aceptación:**
  1. El historial filtra por nave, tipo y rango de fechas, y carga 90 días en menos de 1 s en gama baja.
  2. «Corregir» crea un registro nuevo con `anula_id`. El historial muestra el vigente y, al tocarlo, la versión anulada con quién y cuándo.
  3. No existe una acción que borre un registro (ADR-4).
- **Patrones:** P21.
- **WI:**
  - WI-E3.12.1 Consulta local indexada (1,5 h).
  - WI-E3.12.2 Lista y filtros (2 h).
  - WI-E3.12.3 Corrección con anulación (2 h).
  - WI-E3.12.4 Pruebas (1 h).

#### HU-E3.13 · Exportar e importar todo
**Como** propietario **quiero** descargar todo mi cuaderno en un archivo y poder restaurarlo **para** tener respaldo aunque pierda el teléfono, y para pasar datos entre teléfonos mientras no haya sincronización.
- **Peldaño:** usuario recurrente · **Prioridad:** Must · **Puntos:** 2 · **Sprint:** S6 · **Depende de:** HU-E3.12 · **Estado:** En sprint (rama `feat/e3.13-exportar-importar`. CA1: el esquema JSON se genera desde agro-schema y una prueba exige que coincida; un respaldo real valida contra él con Ajv. CA2: si el teléfono ya tiene otra finca, el archivo se rechaza. La cola de salida y meta no viajan; lo importado no entra a la cola, E5 decide cómo subirlo. CA4: celdas de texto que empiezan por = + - @ llevan ' para que Excel no las ejecute)
- **Criterios de aceptación:**
  1. Exporta en `agro-export v1` (JSON con recuento y hash por tabla) y en CSV por tipo de registro. Formato definido en `schemas/agro-export.schema.json`, la misma fuente que usarán el respaldo y la mudanza (P2).
  2. Importar **une**: agrega lo que falta por id y no reemplaza nada existente. Un archivo corrupto a la mitad no deja la base a medias (P21).
  3. Tras exportar e importar en otro teléfono vacío, los recuentos y hashes coinciden. Hay prueba de ida y vuelta con las dos fincas.
  4. El CSV abre bien en Excel en español: separador `;`, UTF-8 con BOM y coma decimal.
- **Patrones:** P2, P21, P3 (Excel en Windows).
- **WI:**
  - WI-E3.13.1 Esquema del export (1 h).
  - WI-E3.13.2 Exportador JSON y CSV (2 h).
  - WI-E3.13.3 Importador que une (2 h).
  - WI-E3.13.4 Pruebas de ida y vuelta con falla inyectada (2 h).

#### HU-E3.11 · Monitoreo de plagas y enfermedades
**Como** supervisor **quiero** registrar lo que veo en trampas y plantas, con foto si hace falta **para** actuar a tiempo y tener la evidencia del manejo integrado.
- **Peldaño:** usuario recurrente → premium · **Prioridad:** Should · **Puntos:** 2 · **Sprint:** S12 · **Depende de:** HU-E3.4 · **Estado:** Refinada
- **Criterios de aceptación:**
  1. Plaga o enfermedad desde un catálogo editable, método (trampa, conteo, observación) e incidencia o severidad en escala simple.
  2. La foto se comprime en el teléfono a ≤ 150 KB (WebP). Sin sincronización, se queda local.
  3. La cuota de fotos por plan está en la configuración y se muestra «x de y fotos este mes» (ADR-15).
- **Presupuesto:** R2 ≤ 110 MB/año por finca con 2 fotos/día.
- **WI:**
  - WI-E3.11.1 Esquema y catálogo (1,5 h).
  - WI-E3.11.2 Captura y compresión (2 h).
  - WI-E3.11.3 Cuota de fotos (1 h).
  - WI-E3.11.4 Pruebas (1 h).

### E4 · Identidad y equipo (CORE v0)

#### HU-E4.1 · CORE v0: organizaciones, membresías y directorio
**Como** dueño del ecosistema **quiero** un CORE mínimo con usuarios, organizaciones, membresías, invitaciones y directorio de celdas **para** que el agro tenga cuentas sin construir el CORE completo de ED1.
- **Peldaño:** cuenta · **Prioridad:** Must · **Puntos:** 3 · **Sprint:** S7 · **Depende de:** HU-E1.5 · **Estado:** En sprint (rama `feat/e4.1-core-v0`. CA1 a CA4 hechos y probados con D1 local de wrangler; la prueba de CA1 lee la lista de tablas de ARQUITECTURA §5.4. CA3: regla en `apps/core/src/asignacion.ts`, con 5 organizaciones piloto en anillo 1. Sin endpoints públicos más allá de `/api/core/salud`: crear cuentas espera el login de HU-E4.2. Falta la corrida real: el despliegue a staging crea `agro_core_staging`)
- **Criterios de aceptación:**
  1. Las tablas de ARQUITECTURA §5.4 existen como migraciones SQL de wrangler. Ninguna tabla fuera de esa lista (regla de tres).
  2. La tabla `celda` se genera desde `celdas.json` y una prueba las compara (P2).
  3. Una organización nace con `celda_id`, `shard` y `anillo`, asignados por una regla escrita (la celda activa con menos carga), no a mano.
  4. Pruebas del Worker con D1 local cubren la creación, la membresía y el directorio.
- **Patrones:** P2, P6.
- **Presupuesto:** ≤ 1.000 escrituras D1/día.
- **WI:**
  - WI-E4.1.1 Migraciones (2 h).
  - WI-E4.1.2 Worker core con Hono (2 h).
  - WI-E4.1.3 Asignación de celda (1,5 h).
  - WI-E4.1.4 Pruebas (2 h).

#### HU-E4.2 · Entrar con Google y seguir trabajando sin señal
**Como** productor **quiero** entrar con mi cuenta de Google, sin contraseñas nuevas **para** que mis datos se respalden y sincronicen.
- **Peldaño:** cuenta · **Prioridad:** Must · **Puntos:** 3 · **Sprint:** S7 · **Depende de:** HU-E4.1 · **Estado:** En sprint (rama `feat/e4.2-entrar-con-google`. CA1: el código de un uso viaja en el fragmento y se canjea por POST; los tokens van al almacén local (`meta`). CA2: sin señal la pantalla Cuenta dice «sin sesión para sincronizar» y registrar no espera; la renovación al volver la señal la usará la sincronización (E5). CA3: probado con D1 local contando escrituras. CA4: e2e y pruebas del CORE recorren URLs, log, localStorage y D1. CA5: la clave privada la genera el despliegue como secreto del Worker; `/api/core/claves` publica la pública. El dueño entró con Google en staging el 1 oct 2026: sesión activa, usuario y sesión en `agro_core_staging`, salir conserva los registros)
- **Criterios de aceptación:**
  1. Login con Google OIDC y PKCE. Al volver, la app recibe un access token JWT Ed25519 de 12 h y un refresh de 60 días, guardados en IndexedDB.
  2. Sin señal y con el access vencido, la app sigue registrando y solo pospone la sincronización. El usuario ve «sin sesión para sincronizar», no un error.
  3. El refresh se rota a lo sumo una vez al día. Una prueba cuenta las escrituras.
  4. Ningún token aparece en una URL, en `localStorage` ni en logs (P13). Hay prueba que recorre las solicitudes.
  5. La clave privada solo existe como secreto del Worker core. Las celdas tienen la pública.
- **Patrones:** P13, P12.
- **WI:**
  - WI-E4.2.1 Cliente OAuth en Google Cloud (1 h, dueño).
  - WI-E4.2.2 Flujo con Arctic (2,5 h).
  - WI-E4.2.3 Emisión y rotación de tokens (2 h).
  - WI-E4.2.4 Manejo offline en la app (2 h).
  - WI-E4.2.5 Pruebas de seguridad (1,5 h).

#### HU-E4.3 · Crear mi finca en la nube y subir lo que ya registré
**Como** productor que usaba el cuaderno sin cuenta **quiero** que al crear la cuenta mi finca y mis registros suban **para** no perder nada ni volver a escribir.
- **Peldaño:** usuario recurrente → cuenta · **Prioridad:** Must · **Puntos:** 2 · **Sprint:** S8 · **Depende de:** HU-E4.2, HU-E5.2 · **Estado:** En sprint (rama `feat/e4.3-e5.2-subir-finca`. CA1: «Subir mi finca a la nube» en Cuenta crea la organización con un id del teléfono (reintentar no crea otra), renueva la sesión hacia ella y encola por lotes todo lo que no estaba en la cola (lo importado). Los datos locales no se reescriben: el vínculo vive en `meta` y la celda pone la organización del token. CA2: pendiente, la finca cero se da de alta así en producción. CA3: si la cuenta ya tiene fincas, las nombra y pregunta; si el teléfono está vinculado a otra cuenta, no sube nada)
- **Criterios de aceptación:**
  1. Dado un teléfono con la finca local, cuando creo la cuenta, entonces se crea la organización, la finca local se vincula a ella y todos sus registros entran al outbox.
  2. La finca cero se da de alta **por este flujo**, no a mano. Queda como prueba de aceptación de H3 (P6).
  3. Si el teléfono ya tenía otra finca vinculada, la app pregunta. No mezcla.
- **Patrones:** P6.
- **WI:**
  - WI-E4.3.1 Vinculación local → organización (2 h).
  - WI-E4.3.2 Encolado masivo por lotes (1,5 h).
  - WI-E4.3.3 Pruebas (1,5 h).

#### HU-E4.4 · Invitar al equipo por WhatsApp
**Como** propietario **quiero** invitar a mis operarios y al supervisor con un enlace por WhatsApp y un rol **para** que cada uno registre desde su teléfono.
- **Peldaño:** cuenta → Finca · **Prioridad:** Must · **Puntos:** 2 · **Sprint:** S9 · **Depende de:** HU-E4.3 · **Estado:** Refinada
- **Criterios de aceptación:**
  1. «Invitar» genera un enlace de un solo uso que vence en 7 días, con el rol elegido, y abre WhatsApp con el texto listo.
  2. El código va en el fragmento `#` y viaja al CORE en el cuerpo de un POST (P13). Hay prueba.
  3. Un enlace usado o vencido dice por qué no sirve y a quién pedir otro.
  4. Al aceptar, la persona entra con Google y ve la finca con su rol.
- **Patrones:** P13, P15.
- **WI:**
  - WI-E4.4.1 Endpoint de invitaciones (2 h).
  - WI-E4.4.2 Pantalla de invitar y aceptar (2 h).
  - WI-E4.4.3 Pruebas (1,5 h).

#### HU-E4.5 · Roles y permisos
**Como** propietario **quiero** que cada rol vea y haga solo lo suyo **para** proteger costos, ventas y datos personales.
- **Peldaño:** Finca · **Prioridad:** Must · **Puntos:** 3 · **Sprint:** S9 · **Depende de:** HU-E4.4, HU-E5.1 · **Estado:** Refinada
- **Criterios de aceptación:**
  1. Operario, supervisor, propietario, asesor y auditor con la matriz de ARQUITECTURA §9, aplicada **en la celda**. La interfaz solo esconde; la celda decide.
  2. Un operario que llama a la API de costos recibe 403. Hay prueba por cada fila de la matriz.
  3. Una prueba estática recorre todas las consultas SQL del Worker y falla si alguna no filtra por `org_id` del token (control negativo: quitar un filtro).
- **Patrones:** P5.
- **WI:**
  - WI-E4.5.1 Matriz como datos (1 h).
  - WI-E4.5.2 Middleware de autorización (2 h).
  - WI-E4.5.3 Prueba estática de `org_id` (2 h).
  - WI-E4.5.4 Interfaz por rol (2 h).
  - WI-E4.5.5 Pruebas (2 h).

#### HU-E4.6 · Revocar un teléfono o una persona
**Como** propietario **quiero** quitar el acceso de un teléfono perdido o de alguien que ya no trabaja **para** proteger la finca.
- **Peldaño:** Finca · **Prioridad:** Should · **Puntos:** 1 · **Sprint:** S11 · **Depende de:** HU-E4.5 · **Estado:** Refinada
- **Criterios de aceptación:**
  1. Revocar invalida el refresh de ese dispositivo. El access sigue válido como máximo 12 h, y así se dice en pantalla.
  2. La app explica que los datos ya guardados en ese teléfono no se pueden borrar a distancia.
  3. Los registros de esa persona se conservan.
- **WI:**
  - WI-E4.6.1 Endpoint y pantalla (2 h).
  - WI-E4.6.2 Pruebas (1 h).

### E5 · Sincronización y celda

#### HU-E5.1 · API de la celda con tenant en cada consulta
**Como** desarrollador **quiero** el Worker `agro-api` con verificación de token, shard por organización y kill switch **para** recibir datos de muchas fincas sin mezclarlas.
- **Peldaño:** cuenta · **Prioridad:** Must · **Puntos:** 3 · **Sprint:** S8 · **Depende de:** HU-E4.2, HU-E8.1 · **Estado:** En sprint (rama `feat/e5.1-api-celda`. CA1: la clave pública la lee el despliegue del CORE del mismo destino; solo `/api/v1/yo` usa el token hasta HU-E5.2. CA2: catálogos en una tabla `catalogo` con `entidad`, no una por catálogo; `seq` por organización en `registro` y `catalogo`; la prueba exige exactamente los índices justificados. CA3: la clave es `ks:agro-cuaderno`, la del `product.yaml` del cuaderno, que el despliegue ya crea; el texto original decía `ks:agro-cuaderno-sync`, que no existe en ningún contrato (P2). Probado con D1 local y en staging por el dueño el 1 oct 2026: salud, 401 sin token, `url_api` en el directorio del CORE y las tablas del shard)
- **Criterios de aceptación:**
  1. Todo `/api/v1/*` exige un JWT válido firmado por el CORE (clave pública de la configuración). `org_id` y `shard` salen del token, nunca del cuerpo.
  2. Migraciones SQL de la celda: `registro`, catálogos, `entidad_historial` y `cuarentena`. Cada índice está justificado con su costo en filas escritas (bitácora agro, «Lo que el terreno enseñó»).
  3. `ks:agro-cuaderno` apagado → 503 con mensaje en español y `Retry-After`. *(Corregido el 1 oct 2026: decía `ks:agro-cuaderno-sync`; el kill switch sale del `product.yaml` del cuaderno.)*
  4. Ningún identificador de cuenta, base o dominio en el código; todo sale de la configuración generada (ADR-6).
- **Patrones:** P2, P13.
- **Presupuesto:** ≤ 20.000 solicitudes/día y ≤ 20.000 filas escritas/día para todo el cuaderno en c0.
- **WI:**
  - WI-E5.1.1 Migraciones (2 h).
  - WI-E5.1.2 Middleware de token y shard (2 h).
  - WI-E5.1.3 Kill switch con caché de 60 s (1 h).
  - WI-E5.1.4 Pruebas (2 h).

#### HU-E5.2 · Subir registros sin duplicar ni perder
**Como** operario **quiero** que lo que registré suba solo cuando hay señal **para** no tener que acordarme.
- **Peldaño:** cuenta · **Prioridad:** Must · **Puntos:** 3 · **Sprint:** S8 · **Depende de:** HU-E5.1 · **Estado:** En sprint (rama `feat/e4.3-e5.2-subir-finca`. CA1: 3 lecturas + 1 escritura por op en un batch, 25 ops = 28 consultas; la prueba cuenta cada consulta. CA2 y CA4: prueba de punta a punta teléfono → celda con D1 local, cortando la respuesta. CA3: cuarentena con motivo, tabla local `rechazo`. CA5: 429/503 esperan de 30 s a 30 min, o lo que diga `Retry-After`. Agregado: estado `reintentar` para cuando dos teléfonos escriben el mismo catálogo en el mismo instante, y la versión vieja o en conflicto de un catálogo va a `entidad_historial` (trigger, migración 0002). Falta la corrida real en staging)
- **Criterios de aceptación:**
  1. El push sube lotes de ≤ 25 operaciones. La prueba simula el límite de 50 consultas por invocación y falla si un lote lo supera (P17).
  2. Reenviar el mismo lote devuelve `duplicado` para cada operación y no crea filas nuevas.
  3. Una operación inválida va a `cuarentena` con su motivo y el teléfono la muestra en rojo (HU-E3.14). **Nunca** se descarta (P1).
  4. Un corte de red a mitad del lote deja el outbox consistente: lo confirmado sale, lo demás se reintenta.
  5. Reintentos con espera exponencial ante 429 o 503.
- **Patrones:** P1, P17.
- **WI:**
  - WI-E5.2.1 Endpoint push con `INSERT OR IGNORE` en batch (2,5 h).
  - WI-E5.2.2 Cuarentena (1,5 h).
  - WI-E5.2.3 Cliente de envío en la app (2 h).
  - WI-E5.2.4 Pruebas con corte y duplicados (2 h).

#### HU-E5.3 · Bajar lo que registraron los demás
**Como** supervisor **quiero** ver en mi teléfono lo que registró el equipo **para** tener el cuaderno completo.
- **Peldaño:** Finca · **Prioridad:** Must · **Puntos:** 3 · **Sprint:** S9 · **Depende de:** HU-E5.2 · **Estado:** Refinada
- **Criterios de aceptación:**
  1. El pull usa el cursor `seq` guardado en el teléfono y trae hasta 200 cambios por página. El servidor no escribe nada para atender un pull.
  2. Aplicar cambios remotos nunca pisa una edición local pendiente. Si chocan, se registra un conflicto (HU-E5.4).
  3. Con la celda en nivel «Esencial», el pull se pausa y la app dice por qué (HU-E8.6).
  4. Un teléfono nuevo del mismo usuario baja todo el historial de la finca.
- **WI:**
  - WI-E5.3.1 Endpoint pull (2 h).
  - WI-E5.3.2 Aplicador local (2,5 h).
  - WI-E5.3.3 Pruebas con dos teléfonos simulados (2 h).

#### HU-E5.5 · Versiones viejas que siguen sirviendo
**Como** operario que no actualiza la app **quiero** que mis registros suban igual **para** no perder días de trabajo.
- **Peldaño:** cuenta · **Prioridad:** Must · **Puntos:** 2 · **Sprint:** S10 · **Depende de:** HU-E5.2 · **Estado:** Refinada
- **Criterios de aceptación:**
  1. Cada operación lleva `v`. El servidor acepta todas las versiones que alguna app publicada escribió. Una prueba envía registros v1 a la API vigente.
  2. Si la app es más vieja que `app_minima`, el push **se acepta** y la respuesta pide actualizar. La app lo muestra en lenguaje simple.
  3. Una prueba de contrato impide publicar una API que no acepte los esquemas de la versión anterior (P10).
- **Patrones:** P10.
- **WI:**
  - WI-E5.5.1 Traductores de versión en `agro-schema` (2 h).
  - WI-E5.5.2 Encabezados y aviso (1 h).
  - WI-E5.5.3 Prueba de contrato N−1 (2 h).

#### HU-E5.4 · Dos teléfonos editan lo mismo sin señal
**Como** supervisor **quiero** que, si dos personas cambian el mismo insumo o nave sin señal, no se pierda ninguna versión **para** corregir con información completa.
- **Peldaño:** Finca · **Prioridad:** Should · **Puntos:** 2 · **Sprint:** S11 · **Depende de:** HU-E5.3 · **Estado:** Refinada
- **Criterios de aceptación:**
  1. En los catálogos gana la última escritura según el orden de llegada a la celda, y la otra versión queda en `entidad_historial`.
  2. El perdedor ve «Tu cambio en <entidad> fue reemplazado por el de <persona>» con opción de reaplicarlo.
  3. Los registros (inmutables) nunca generan conflicto. Hay prueba.
- **WI:**
  - WI-E5.4.1 Historial y regla de resolución (2 h).
  - WI-E5.4.2 Aviso en la app (1,5 h).
  - WI-E5.4.3 Pruebas (1,5 h).

#### HU-E5.6 · Batería de caos de sincronización
**Como** dueño **quiero** una batería que rompa la sincronización a propósito **para** saber que no se pierden datos antes de dárselo a otras fincas.
- **Peldaño:** transversal · **Prioridad:** Must · **Puntos:** 3 · **Sprint:** S10 · **Depende de:** HU-E5.3, HU-E5.5, HU-E8.6 · **Estado:** Refinada
- **Criterios de aceptación:**
  1. Casos en `tests/caos/`, todos con las dos fincas de prueba:
     - lote duplicado;
     - corte a la mitad;
     - dos teléfonos sin señal;
     - reloj del teléfono adelantado un día;
     - app vieja;
     - celda en nivel «Esencial»;
     - token vencido sin señal;
     - cuota de D1 agotada (simulada).
  2. Invariante de todos: **al final, cada registro creado en cualquier teléfono existe exactamente una vez en la celda y en todos los teléfonos**.
  3. El reloj adelantado se marca como «reloj del teléfono corrido» (P8).
  4. Cada caso se vio en rojo con un defecto puesto a propósito (P5).
- **Patrones:** P5, P8, P9, P16.
- **WI:**
  - WI-E5.6.1 Arnés de teléfonos simulados (3 h).
  - WI-E5.6.2 Los 8 casos (4 h).
  - WI-E5.6.3 Controles negativos (2 h).

### E6 · Cosecha, ventas y trazabilidad

#### HU-E6.1 · Registrar la cosecha por nave
**Como** operario **quiero** anotar los kilos cosechados por nave y calidad **para** saber cuánto produce cada nave y qué se puede vender.
- **Peldaño:** usuario recurrente → Finca · **Prioridad:** Must (antes de la primera cosecha) · **Puntos:** 2 · **Sprint:** S7 · **Depende de:** HU-E3.4, HU-E3.10 · **Estado:** En sprint (rama `feat/e6.1-registrar-cosecha`. CA1: unidad kg, tallos, cajas u otra; calidades en un catálogo de la finca que arranca vacío con «Primera, Segunda, Tercera» como sugerencia. CA2: el almacén vuelve a calcular la carencia al guardar y bloquea también si es desconocida; la confirmación guarda el motivo, la fecha y los insumos. Quién cosechó es opcional)
- **Criterios de aceptación:**
  1. Kg (o la unidad del cultivo: tallos, cajas) por nave, categoría de calidad desde el catálogo y descarte.
  2. Si la nave está dentro del periodo de carencia, la app **bloquea** con el motivo y la fecha de vencimiento. Una confirmación explícita queda registrada en el registro.
  3. Funciona sin señal y en modo tablero.
- **Patrones:** P1, P8.
- **WI:**
  - WI-E6.1.1 Esquema `cosecha` v1 (1 h).
  - WI-E6.1.2 Formulario con bloqueo por carencia (2,5 h).
  - WI-E6.1.3 Pruebas (1,5 h).

#### HU-E6.2 · Armar un lote de venta
**Como** supervisor **quiero** agrupar cosechas en un lote con un código corto **para** despacharlo y rastrearlo.
- **Peldaño:** Finca → Exportador · **Prioridad:** Must · **Puntos:** 2 · **Sprint:** S8 · **Depende de:** HU-E6.1 · **Estado:** Refinada
- **Criterios de aceptación:**
  1. Un lote tiene código corto legible (p. ej. `T-2703-2`: cultivo, fecha y consecutivo), creado sin señal y único por finca.
  2. Un kilo cosechado no puede estar en dos lotes: la app lo impide con un mensaje.
  3. El lote muestra de qué naves y fechas viene.
- **WI:**
  - WI-E6.2.1 Esquema y código (1,5 h).
  - WI-E6.2.2 Pantalla de armado (2 h).
  - WI-E6.2.3 Pruebas (1,5 h).

#### HU-E6.3 · Despachos a mis clientes
**Como** propietario **quiero** registrar a quién le vendí, cuánto, de qué lote y a qué precio **para** saber qué vendí y poder rastrear cualquier reclamo.
- **Peldaño:** Finca · **Prioridad:** Must · **Puntos:** 3 · **Sprint:** S10 · **Depende de:** HU-E6.2, HU-E4.5 · **Estado:** Refinada
- **Criterios de aceptación:**
  1. Clientes por tipo: consumidor, restaurante, tienda, cadena.
  2. Despacho con cliente, lote(s), cantidad, precio en COP y medio de pago.
  3. Solo propietario y supervisor ven precios (HU-E4.5).
  4. Un despacho que excede el saldo del lote avisa y no guarda.
  5. Precio ilegible no es cero (P1).
- **Patrones:** P1.
- **WI:**
  - WI-E6.3.1 Clientes (1,5 h).
  - WI-E6.3.2 Despacho con saldo de lote (2,5 h).
  - WI-E6.3.3 Permisos y pruebas (2 h).

#### HU-E6.6 · Rendimiento por nave y por planta
**Como** propietario **quiero** ver kg/m² y kg/planta por nave y ciclo **para** comparar naves y decidir.
- **Peldaño:** Finca · **Prioridad:** Should · **Puntos:** 1 · **Sprint:** S11 · **Depende de:** HU-E6.1 · **Estado:** Refinada
- **Criterios de aceptación:**
  1. Calculado en el navegador (ADR-5) con funciones de `agro-calc` probadas con casos.
  2. Compara naves del mismo ciclo en una tabla simple.
- **WI:**
  - WI-E6.6.1 Funciones (1 h).
  - WI-E6.6.2 Pantalla (1,5 h).

#### HU-E6.4 · QR de trazabilidad verificable
**Como** cliente que compra tomate **quiero** escanear un QR y ver de qué finca, nave y fecha viene **para** confiar en que es lo que me dicen.
- **Peldaño:** Exportador (valor para la venta directa) · **Prioridad:** Should · **Puntos:** 3 · **Sprint:** S12 · **Depende de:** HU-E6.2, HU-E5.3 · **Estado:** Refinada
- **Criterios de aceptación:**
  1. Cada lote genera un QR hacia `/agro/t/#<datos>`, una página estática que muestra finca (nombre público), cultivo, variedad, régimen, área y fecha de cosecha.
  2. Con señal, la celda firma los datos (Ed25519). La página muestra «verificado» con firma válida, «sin verificar» sin firma, y «no coincide» en rojo si se alteró. Control negativo: cambiar un carácter.
  3. El QR no contiene datos personales. Hay prueba (P13).
  4. Imprimible en etiqueta de 5 × 5 cm.
- **Presupuesto:** 0 solicitudes por escaneo; 1 por firma de lote.
- **WI:**
  - WI-E6.4.1 Endpoint de firma (1,5 h).
  - WI-E6.4.2 Página estática de verificación (2,5 h).
  - WI-E6.4.3 Generador de QR y etiqueta (1,5 h).
  - WI-E6.4.4 Pruebas (1,5 h).

#### HU-E6.5 · Disponibilidad para la tienda en línea
**Como** propietario que también vende en la Tienda del ecosistema **quiero** exportar lo que tengo disponible por producto **para** actualizar mi catálogo sin volver a contar.
- **Peldaño:** puente entre verticales de ED1 · **Prioridad:** Could · **Puntos:** 2 · **Sprint:** S13 · **Depende de:** HU-E6.3 · **Estado:** Refinada
- **Criterios de aceptación:**
  1. CSV con producto, kg disponibles (cosechado − despachado) y lote, con el formato de columnas que lee la hoja de la Tienda. El formato se confirma leyendo la documentación de la Tienda, no se supone (P9).
  2. No hay conexión directa entre sistemas en esta versión.
- **WI:**
  - WI-E6.5.1 Leer el formato de la Tienda (1 h).
  - WI-E6.5.2 Exportador (2 h).
  - WI-E6.5.3 Prueba (1 h).

### E7 · Costos y personal

#### HU-E7.1 · Costo de los insumos
**Como** propietario **quiero** registrar compras de insumos y que cada aplicación descuente lo usado **para** saber cuánto gasto por nave y ciclo y cuánto me queda en bodega.
- **Peldaño:** herramienta de negocio · **Prioridad:** Should · **Puntos:** 3 · **Sprint:** S13 · **Depende de:** HU-E3.10 · **Estado:** Refinada
- **Criterios de aceptación:**
  1. Entrada de bodega con cantidad, unidad y precio. Salida automática al registrar una aplicación con cantidad.
  2. Costo promedio ponderado calculado en `agro-calc` con casos.
  3. Existencias negativas avisan (algo no se registró) sin bloquear el registro de campo.
- **WI:**
  - WI-E7.1.1 Movimientos (2 h).
  - WI-E7.1.2 Costo ponderado (1,5 h).
  - WI-E7.1.3 Pantalla de bodega (2 h).
  - WI-E7.1.4 Pruebas (1,5 h).

#### HU-E7.2 · Jornales y mano de obra
**Como** propietario **quiero** que las horas de labores se conviertan en costo de mano de obra por nave **para** conocer el costo real.
- **Peldaño:** herramienta de negocio · **Prioridad:** Should · **Puntos:** 2 · **Sprint:** S13 · **Depende de:** HU-E3.9, HU-E3.5 · **Estado:** Refinada
- **Criterios de aceptación:**
  1. Valor de jornal por persona o general, con la fecha desde la que rige. Cambiarlo no altera los costos pasados.
  2. Costo de labores por nave y periodo.
  3. La app no liquida nómina ni recargos. Remite a la futura calculadora de jornales (Estudio, herramienta 7).
- **WI:**
  - WI-E7.2.1 Valor de jornal con vigencia (1,5 h).
  - WI-E7.2.2 Cálculo y pantalla (2 h).
  - WI-E7.2.3 Pruebas (1 h).

#### HU-E7.3 · Costo por kilo y margen por ciclo
**Como** propietario **quiero** ver cuánto me cuesta producir un kilo en cada nave y cuánto gano al venderlo **para** fijar precios a restaurantes y tiendas con números.
- **Peldaño:** herramienta de negocio → Finca · **Prioridad:** Should · **Puntos:** 2 · **Sprint:** S14 · **Depende de:** HU-E7.1, HU-E7.2, HU-E6.3 · **Estado:** Refinada
- **Criterios de aceptación:**
  1. Costo por kg = (insumos + mano de obra + otros costos registrados) / kg cosechados, por nave y ciclo. Calculado en el navegador con casos.
  2. Margen = ingresos de despachos − costos. Solo lo ven propietario y supervisor.
  3. Dice qué costos no están incluidos (arriendo, depreciación del invernadero) para que el número no engañe.
- **WI:**
  - WI-E7.3.1 Funciones (1,5 h).
  - WI-E7.3.2 Pantalla (2 h).
  - WI-E7.3.3 Pruebas (1 h).

#### HU-E7.4 · Rendimiento por operario
**Como** supervisor **quiero** ver kg cosechados por hora y labores por persona **para** organizar el trabajo y reconocer a quien rinde.
- **Peldaño:** Exportador (flores: dolor principal del Estudio) · **Prioridad:** Could · **Puntos:** 2 · **Sprint:** S14 · **Depende de:** HU-E6.1, HU-E3.9 · **Estado:** Refinada
- **Criterios de aceptación:**
  1. Kg/hora por persona y periodo, a partir de cosechas con personas y horas.
  2. Visible solo para propietario y supervisor.
  3. Dice cuántos registros no tienen horas y por eso no entran al cálculo (P1).
- **WI:**
  - WI-E7.4.1 Funciones (1,5 h).
  - WI-E7.4.2 Pantalla (1,5 h).
  - WI-E7.4.3 Pruebas (1 h).

### E8 · Operación ZCOE

#### HU-E8.1 · Kill switch por producto
**Como** dueño **quiero** apagar un producto desde KV sin desplegar **para** cortar un consumo o un fallo en un minuto.
- **Peldaño:** transversal · **Prioridad:** Must · **Puntos:** 2 · **Sprint:** S7 · **Depende de:** HU-E1.5 · **Estado:** En sprint (rama `feat/e8.1-kill-switch`. CA1 y CA2 hechos y probados con KV y Cloudflare falsos; apagar tarda hasta 2 min, no 1: 60 s de caché más la propagación de KV, corregido en ARQUITECTURA §8.2. CA3 espera a la sincronización (HU-E5.x) y al aviso de HU-E8.6: hoy `ks:agro-cuaderno` no apaga nada. CA4: prueba real del dueño en staging el 1 oct 2026, anotada en el runbook: apagado y encendido visibles en la primera o segunda verificación de 30 s)
- **Criterios de aceptación:**
  1. Clave `ks:<product.id>` en KV. El Worker la lee con caché de hasta 60 s, y la prueba mide ese máximo (P7).
  2. Todos los `product.yaml` con `kill_switch: true` tienen su clave creada por el despliegue. CI lo verifica.
  3. Apagar la sincronización deja la app registrando localmente con el aviso de HU-E8.6.
  4. Runbook de una página en `docs/runbooks/kill-switch.md`, probado una vez de verdad.
- **Patrones:** P7, P16.
- **WI:**
  - WI-E8.1.1 Lector con caché (1,5 h).
  - WI-E8.1.2 Creación de claves en el despliegue (1,5 h).
  - WI-E8.1.3 Runbook y prueba real (1,5 h).

#### HU-E8.6 · «Sincronización en pausa» dicho como es
**Como** operario **quiero** que la app me diga en palabras simples por qué no sincroniza y cuándo volverá **para** seguir trabajando tranquilo.
- **Peldaño:** transversal · **Prioridad:** Must · **Puntos:** 1 · **Sprint:** S10 · **Depende de:** HU-E5.2 · **Estado:** Refinada
- **Criterios de aceptación:**
  1. Un catálogo de mensajes cubre: sin señal, sin sesión, celda en «Ahorro», celda en «Esencial» o bloqueada (con «hasta las 19:00, hora de Colombia»), kill switch, app vieja y finca en mudanza.
  2. Cada mensaje dice qué pasó, que los datos están a salvo en el teléfono y qué hacer (P15).
  3. La hora de reanudación se calcula con el reinicio de cuota a las 00:00 UTC. Hay prueba con dos husos (P8).
- **Patrones:** P8, P15.
- **WI:**
  - WI-E8.6.1 Catálogo y componente (2 h).
  - WI-E8.6.2 Pruebas (1 h).

#### HU-E8.2 · Vigía de cuota de la celda
**Como** dueño **quiero** que la celda mida su consumo cada hora y se degrade sola por niveles **para** no llegar al bloqueo sin aviso ni tumbar a los demás productos de ED1.
- **Peldaño:** transversal · **Prioridad:** Must · **Puntos:** 3 · **Sprint:** S11 · **Depende de:** HU-E8.1 · **Estado:** Refinada
- **Criterios de aceptación:**
  1. Un único Cron Trigger despachador (ED1 §7.1) consulta cada hora la API de métricas de Cloudflare (Workers, D1, R2) de **toda** la cuenta y calcula el % de cada cuota diaria.
  2. Aplica los niveles de ARQUITECTURA §8.2 escribiendo en KV solo cuando cambia de nivel (≤ 24 escrituras/día).
  3. Lee la fuente de métricas, no un contador propio (P7). Si no puede leerla, lo dice como alerta, no como «normal» (P1).
  4. Después de 30 días con la finca cero, se recalibran las cifras de ARQUITECTURA §6.2 con el consumo real (P18).
- **Patrones:** P1, P7, P18.
- **WI:**
  - WI-E8.2.1 Consulta GraphQL de métricas (2,5 h).
  - WI-E8.2.2 Niveles y escritura en KV (2 h).
  - WI-E8.2.3 Pruebas con métricas simuladas (2 h).
  - WI-E8.2.4 Recalibración a los 30 días (1 h, recordatorio).

#### HU-E8.4 · Respaldo semanal y restauración probada
**Como** dueño **quiero** un respaldo semanal por finca en R2 y una restauración probada **para** recuperar una finca sin depender de Time Travel.
- **Peldaño:** transversal · **Prioridad:** Must · **Puntos:** 3 · **Sprint:** S11 · **Depende de:** HU-E3.13, HU-E5.1 · **Estado:** Refinada
- **Criterios de aceptación:**
  1. El cron exporta cada organización en `agro-export v1` a R2. Retención: 4 semanales y 3 mensuales.
  2. Restaurar **une** (agrega lo que falta) y nunca reemplaza el presente con el pasado (bitácora ecommerce 77).
  3. Prueba de punta a punta: exportar, restaurar en un shard vacío y comparar hashes. Con falla inyectada a la mitad, el destino queda sin cambios (P16, P21).
  4. Nada del respaldo pasa por GitHub Actions ([H6]).
- **Presupuesto:** R2 ≤ 1 GB para respaldos en c0 durante la validación.
- **WI:**
  - WI-E8.4.1 Exportador en el Worker (2 h).
  - WI-E8.4.2 Retención (1 h).
  - WI-E8.4.3 Restaurador que une (2,5 h).
  - WI-E8.4.4 Prueba de punta a punta (2 h).

#### HU-E8.3 · Alertas al dueño y reporte semanal
**Como** dueño **quiero** una alerta en Telegram cuando la celda sube de nivel o algo falla, y un reporte semanal con las métricas de validación **para** operar sin mirar tableros a diario.
- **Peldaño:** transversal · **Prioridad:** Should · **Puntos:** 2 · **Sprint:** S12 · **Depende de:** HU-E8.2 · **Estado:** Refinada
- **Criterios de aceptación:**
  1. El cron envía un mensaje al bot de Telegram del dueño con nivel, cuota y causa.
  2. Si Telegram falla, se deja constancia en el log y se reintenta en la siguiente hora; no se silencia (P1).
  3. Un flujo de Actions, los lunes, arma el reporte solo con métricas agregadas de Analytics Engine, Search Console y Cloudflare. Nunca con datos de fincas ([H6]). Incluye `tool.completed/opened`, impresiones, cuentas, retorno a 30 días e intención de pago.
  4. El reporte llega como issue del repositorio (notificación gratuita de GitHub).
- **Patrones:** P1, P15.
- **WI:**
  - WI-E8.3.1 Bot y envío (1,5 h).
  - WI-E8.3.2 Flujo semanal (2,5 h).
  - WI-E8.3.3 Pruebas (1 h).

#### HU-E8.5 · Mudar una finca de celda — *Preparada*
**Como** dueño **quiero** mover una finca a otra celda sin que sus usuarios pierdan un registro **para** escalar (etapa B) o dar celda propia a un cliente Cadena (etapa C).
- **Peldaño:** Cadena · **Prioridad:** Could (hasta que llegue el disparador) · **Puntos:** 5 · **Sprint:** — · **Disparador:** ARQUITECTURA §6.3, etapa B o C · **Depende de:** HU-E8.4 · **Estado:** Preparada
- **Criterios de aceptación:**
  1. Sigue los 6 pasos de ARQUITECTURA §6.4, con el mismo `agro-export v1`.
  2. Probada primero entre dos celdas locales con las dos fincas de prueba, de punta a punta (P16).
  3. Con falla inyectada en importar o verificar, la celda origen sigue vigente y nada se borra (P21).
  4. El token de servicio entre celdas se prueba antes de congelar la finca (P12).
  5. Los teléfonos registran durante la mudanza y suben después sin duplicar.
- **WI:**
  - WI-E8.5.1 Estado `mudando` en el CORE (1,5 h).
  - WI-E8.5.2 Endpoint de servicio de exportación (2 h).
  - WI-E8.5.3 Importador en destino (2,5 h).
  - WI-E8.5.4 Verificación y conmutación (2,5 h).
  - WI-E8.5.5 Purga diferida (1 h).
  - WI-E8.5.6 Prueba de punta a punta con fallas (3 h).

### E9 · Cumplimiento

#### HU-E9.1 · ¿Qué nave puedo cosechar hoy?
**Como** supervisor **quiero** un calendario de carencias y reentradas por nave **para** no cosechar ni entrar donde no se debe.
- **Peldaño:** premium (su versión pública, para una aplicación, es HU-E10.1; las dos usan `vencimientoCarencia` y `vencimientoReentrada` de agro-calc, P2) · **Prioridad:** Should · **Puntos:** 2 · **Sprint:** S13 · **Depende de:** HU-E3.10 · **Estado:** Refinada
- **Criterios de aceptación:**
  1. Vista de hoy: cada nave en verde (se puede), rojo (carencia o reentrada vigente, con fecha y hora de fin) o gris (carencia desconocida).
  2. Vista de 14 días hacia adelante.
  3. Probada con dos husos, fin de mes y 29 de febrero (P8).
- **Patrones:** P1, P8.
- **WI:**
  - WI-E9.1.1 Cálculo por nave (1,5 h).
  - WI-E9.1.2 Vistas (2 h).
  - WI-E9.1.3 Pruebas de reloj (1,5 h).

#### HU-E9.2 · Carpeta de cumplimiento en PDF
**Como** propietario **quiero** generar un PDF con aplicaciones, riegos, monitoreos, cosechas y trazabilidad de un periodo **para** mostrarlo en una auditoría o a un cliente exigente.
- **Peldaño:** premium (motivo para pagar) · **Prioridad:** Should · **Puntos:** 5 · **Sprint:** S15 · **Depende de:** HU-E3.12, HU-E6.4, HU-E9.1 · **Estado:** Refinada
- **Criterios de aceptación:**
  1. PDF generado en el navegador (pdf-lib). Encabezado con finca, periodo y fecha de generación. Secciones por tipo de registro, con los anulados marcados.
  2. No afirma cumplir ninguna norma. Dice «registros de la finca para el periodo», y la estructura se revisa contra la lista de verificación de la certificación que se elija (T-0.4).
  3. Un periodo de 6 meses de la finca de prueba se genera en menos de 10 s en gama baja.
  4. Queda como función del plan Finca en la lista de espera (HU-E0.6), sin cobro.
- **WI:**
  - WI-E9.2.1 Diseño de secciones (2 h).
  - WI-E9.2.2 Generador (5 h).
  - WI-E9.2.3 Rendimiento (2 h).
  - WI-E9.2.4 Pruebas (2 h).

#### HU-E9.3 · Autodiagnóstico ecológico/BPA — *Preparada*
**Como** productor que quiere certificarse **quiero** una lista de chequeo que me diga qué me falta **para** preparar la auditoría.
- **Puntos:** 3 · **Disparador:** decisión de certificar · **Estado:** Preparada.
- **Criterios de aceptación:**
  1. Basada en la lista oficial vigente de la norma elegida, verificada con fecha.
  2. Reporte imprimible.
  3. Cada ítem enlaza al registro del cuaderno que lo evidencia.

#### HU-E9.4 · Enlace de auditor — *Preparada*
**Como** propietario **quiero** dar a un auditor acceso de solo lectura que vence **para** que revise sin pedirme archivos.
- **Puntos:** 2 · **Disparador:** primera auditoría agendada · **Estado:** Preparada.
- **Criterios de aceptación:**
  1. Rol auditor con vencimiento.
  2. Solo lectura verificada en la celda.
  3. Registro de accesos.

### E10 · Herramienta 2: calendario de carencias

> **Cambio del 1 oct 2026.** La herramienta 2 era «dosis por bomba». HU-E0.2 midió que ninguna de sus cuatro formas de búsqueda trae datos, y que «periodo de carencia» es el único término con más de 50 búsquedas al mes en Colombia (100–1 mil). El dueño aceptó la recomendación: el calendario de carencias pasa a ser la herramienta 2 y dosis queda preparada (HU-E10.3). El cálculo ya existe y está probado en el cuaderno (HU-E3.10).

#### HU-E10.1 · ¿Desde cuándo puedo cosechar y entrar?
**Como** productor que acaba de aplicar un producto **quiero** poner la fecha y hora de la aplicación con la carencia y la reentrada de la etiqueta **para** saber desde qué día puedo cosechar y desde qué hora puedo entrar a la nave.
- **Peldaño:** herramienta gratuita → siguiente: registrar la aplicación en el cuaderno (HU-E10.2) · **Prioridad:** Should · **Puntos:** 2 · **Sprint:** S14 · **Depende de:** H1, HU-E3.10 · **Estado:** Refinada
- **Criterios de aceptación:**
  1. Entradas: fecha y hora de la aplicación (por defecto, ahora), carencia en días y reentrada en horas, copiadas de la etiqueta. Salida: «Cosechar desde el dd/mm» y «Entrar desde el dd/mm/aaaa hh:mm». Usa `vencimientoCarencia` y `vencimientoReentrada` de agro-calc y la tabla `casos/carencia.json`; la calculadora no tiene su propia copia del cálculo (P2). Ejemplo: aplicado el 10/12 a las 7:00 con 3 días y 12 h → cosechar desde el 13/12, entrar desde el 10/12/2026 19:00.
  2. Carencia o reentrada vacía **no es cero**: se muestra «desconocida, mira la etiqueta» y no se da fecha (P1). Un valor ilegible o negativo se marca junto al campo, sin calcular.
  3. Texto permanente: «Copia la carencia y la reentrada de la etiqueta del producto registrado ante el ICA. Esta herramienta solo cuenta los días». No hay catálogo de productos (instrucciones §7).
  4. Fechas en hora de Colombia; pruebas con otro huso, fin de mes y 29 de febrero (P8). Ninguna solicitud al calcular.
  5. Revisión agronómica aprobada antes de `activo`.
- **Patrones:** P1, P2, P8.
- **Presupuesto:** 0 solicitudes al calcular; eventos dentro del presupuesto de las calculadoras (ARQUITECTURA §8.1). Kill switch `ks:agro-periodo-de-carencia`.
- **WI:**
  - WI-E10.1.1 `product.yaml` y textos (1 h).
  - WI-E10.1.2 Isla con las funciones de agro-calc (2,5 h).
  - WI-E10.1.3 e2e en 360 px, con TZ distinta y control negativo (1,5 h).

#### HU-E10.2 · Página útil y puente al cuaderno
**Como** productor **quiero** entender qué son la carencia y la reentrada con un ejemplo de invernadero **para** confiar en la fecha y no cosechar antes de tiempo.
- **Puntos:** 2 · **Sprint:** S15 · **Depende de:** HU-E10.1 · **Estado:** Refinada
- **Criterios de aceptación:**
  1. Pasa el quality gate, con preguntas frecuentes del tipo «¿la carencia cuenta desde el día de la aplicación?» y «¿qué pasa si la etiqueta no dice reentrada?».
  2. Tiene «Guardar como aplicación en mi cuaderno», que prellena HU-E3.10 con la fecha, sin red, y emite `tool.next_step`.
  3. La DPV y esta herramienta se enlazan como relacionadas.
- **WI:**
  - WI-E10.2.1 Contenido (2 h).
  - WI-E10.2.2 Puente (1,5 h).

#### HU-E10.3 · Calcular cuánto producto echar en la bomba — *Preparada*
**Como** productor **quiero** convertir la dosis de la etiqueta (por hectárea o por litro) a la cantidad por bomba o tanque **para** preparar la mezcla sin errores.
- **Puntos:** 3 · **Disparador:** la medición del 25 feb 2027 (HU-E0.2, regla 3) encuentra búsquedas en Colombia · **Estado:** Preparada (era HU-E10.1 hasta el 1 oct 2026)
- **Criterios de aceptación:**
  1. Entradas:
     - dosis de etiqueta en cm³/L, mL/L, g/L, L/ha o kg/ha;
     - volumen de la bomba o tanque;
     - volumen de mezcla por hectárea o por área.

     Salida: cantidad por bomba y número de bombas. Casos resueltos en `agro-calc`.
  2. Texto permanente: «Usa la dosis de la etiqueta del producto registrado ante el ICA. Esta herramienta solo convierte unidades». No hay catálogo de productos ni dosis sugeridas (instrucciones §7).
  3. Unidades incompatibles (g/L para un líquido que dice mL) avisan en lugar de convertir.
  4. Revisión agronómica aprobada antes de `activo`.
- **Patrones:** P1.

### E11 · Línea Conectada (laboratorio, fuera de la capacidad de desarrollo)

#### HU-E11.1 · Diseño de referencia del nodo de riego de una zona
**Como** dueño **quiero** documentado el nodo ESP32 de una zona (esquema, lista de materiales, estados seguros y tabla de fallas) **para** construirlo sin improvisar y publicarlo como diseño abierto.
- **Puntos:** 2 · **Estado:** Refinada
- **Criterios de aceptación:**
  1. `hardware/nodo-riego-1z/` con esquema, lista de materiales con precios en COP y fuente, y la tabla «qué pasa si…» de ARQUITECTURA §5.11.
  2. Marcado «requiere revisión de electricista (RETIE) antes de conectar la bomba».
  3. Estado seguro y tiempo máximo por zona definidos **antes** de conectar la primera bomba (Estudio, próximos pasos).
- **WI:**
  - WI-E11.1.1 Esquema (2 h).
  - WI-E11.1.2 Lista de materiales (1 h).
  - WI-E11.1.3 Tabla de fallas (1 h).
  - WI-E11.1.4 Revisión eléctrica (externa).

#### HU-E11.2 · Firmware del nodo con estado seguro
**Como** productor **quiero** que el nodo riegue según su programa sin internet y cierre la válvula ante cualquier falla **para** no perder la cosecha ni la bomba.
- **Puntos:** 3 · **Depende de:** HU-E11.1 · **Estado:** Refinada
- **Criterios de aceptación:**
  1. ESPHome YAML en `firmware/nodo-riego-1z/`: programa en flash, salidas apagadas al arrancar y watchdog por zona con tiempo máximo.
  2. Pruebas de banco documentadas:
     - quitar WiFi a mitad de un riego;
     - reiniciar a mitad de un riego;
     - desconectar el sensor de sustrato;
     - forzar un riego que excede el máximo.
     
     Cada una con el resultado observado.
  3. Si usa la fórmula del DPV, la prueba compara contra `packages/agro-calc/casos/dpv.json` (P2).
- **WI:**
  - WI-E11.2.1 YAML base (3 h).
  - WI-E11.2.2 Watchdog y estado seguro (3 h).
  - WI-E11.2.3 Pruebas de banco (3 h).

#### HU-E11.3 · El nodo reporta a la celda — *Preparada*
**Como** productor con plan Conectado **quiero** ver en el cuaderno las lecturas de mi nodo **para** no anotar a mano lo que ya mide.
- **Puntos:** 3 · **Disparador:** HU-E11.2 funcionando 30 días en el laboratorio · **Estado:** Preparada
- **Criterios de aceptación:**
  1. `POST /api/v1/dispositivos/reporte` con token por dispositivo, revocable, en lotes cada 15–60 min.
  2. La configuración baja por consulta con 304 si no cambió.
  3. Presupuesto propio y kill switch `ks:agro-conectado` (ARQUITECTURA §5.11).
  4. Sin la celda, el nodo sigue igual.

#### HU-E11.4 · El riego ejecutado llena el cuaderno — *Preparada*
**Como** supervisor **quiero** que cada riego del nodo aparezca como registro `riego` con `origen: dispositivo` **para** tener la carpeta completa sin escribir.
- **Puntos:** 2 · **Disparador:** HU-E11.3 · **Estado:** Preparada
- **Criterios de aceptación:**
  1. Usa el mismo esquema `riego` de HU-E3.7 (P2).
  2. Un reporte repetido no duplica registros.

---

## 6. Riesgos del plan y cómo se reprioriza

| Riesgo | Señal temprana | Respuesta |
|---|---|---|
| La velocidad real es menor que 10 | Cierre del S2 por debajo de 8 | Se recorta H6 y H7 antes que H2 y H3; nunca se recortan pruebas ni la DoD |
| El trasplante se adelanta | Fecha confirmada antes del 30 nov | Ocurrió el 30 sep 2026 (mediados de octubre). El dueño mantuvo el orden; ver la decisión de §0. Si el papel no alcanza en la finca (menos de 5 registros al día o datos perdidos en noviembre), se reabre y se adelantan las 7 historias de §1 |
| La DPV no pasa el umbral a 90 días | Completado < 60 % o impresiones planas | Criterio de pivote (ED1 §19.1): revisar herramienta o cultivo antes de la segunda calculadora |
| La finca cero no usa el cuaderno a diario | Menos de 5 registros por día en enero | Revisión con el equipo de la finca (P20) antes de seguir con E4–E5 |
| El laboratorio de hardware absorbe horas | Velocidad baja dos sprints seguidos | Se declara y se ajusta la capacidad en §1 |
| Una historia crece más de 5 puntos en refinamiento | — | Se parte antes de entrar al sprint |

---

## 7. Registro de velocidad

| Sprint | Comprometido | Terminado | Nota |
|---|---|---|---|
| S1 | 10 | 9 (HU-E1.1, 1.2, 1.3, 1.7) + HU-E2.1 del S2 adelantada | Terminado el 30 sep 2026, antes de empezar el sprint. HU-E0.1 (1 pt) espera la fusión de `docs/e0.1-adr`. La velocidad no se recalibra con esto: es trabajo con asistencia continua, no 20 h/semana |
