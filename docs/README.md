# docs/ — Gestión Agro

Qué es cada documento y cuál manda sobre qué. Cada tema tiene una sola fuente (P2); los demás la citan.

| Documento | Es la fuente de | Se actualiza cuando |
|---|---|---|
| `ARQUITECTURA.md` | Decisiones (ADR-1…), componentes, cuotas y capacidad, secretos, despliegue | Cambia una decisión, un límite o un componente. Va en el mismo pull request que el código |
| `BACKLOG.md` | Hitos, sprints, historias, work items, velocidad | Planeación y cierre de cada sprint |
| `BITACORA.md` | Lo que se rompió, las afirmaciones falsas, los cambios de rumbo y los patrones | Algo se rompe o se aprende. Una entrada nueva va al final |
| `ECOSISTEMA-DIGITAL-ED1-v1.2.md` | Arquitectura, principios y fases de ED1 (se cita como ED1 §N) | No se edita aquí: vive en el ecosistema |
| `REVISION-HALLAZGOS-ED1.md` | Hallazgos [H1]–[H16] de ED1 | No se edita aquí |
| `Estudio de mercado software para invernaderos y agricultura.md` | Mercado, competencia, precios y visión de hardware | Nueva investigación |
| `BITACORA-ecommerce.md` | Copia de referencia de la bitácora de la línea ecommerce (P1–P21, bitácora ecommerce N) | Se reemplaza por la versión vigente cuando se quiera releer. No se edita aquí |

Orden de precedencia ante una contradicción: documentos de ED1 → `ARQUITECTURA.md` → `BACKLOG.md`. Si una instrucción nueva contradice alguno, se señala antes de actuar (instrucciones del proyecto §1).

Carpetas que irán apareciendo: `validacion/` (búsquedas, entrevistas, métricas de la DPV) y `runbooks/` (kill switch, despliegue, restauración).
