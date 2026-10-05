# docs/ — CultivoPro

Qué es cada documento y cuál manda sobre qué. Cada tema tiene una sola fuente (P2); los demás la citan.

| Documento | Es la fuente de | Se actualiza cuando |
|---|---|---|
| `ARQUITECTURA.md` | Decisiones (ADR-1…), componentes, cuotas y capacidad, secretos, despliegue | Cambia una decisión, un límite o un componente. Va en el mismo pull request que el código |
| `BACKLOG.md` | Hitos, sprints, historias, work items, velocidad | Planeación y cierre de cada sprint |
| `BITACORA.md` | Lo que se rompió, las afirmaciones falsas, los cambios de rumbo y los patrones | Algo se rompe o se aprende. Una entrada nueva va al final |
| `ECOSISTEMA-DIGITAL-ED1-v1.3.md` | Arquitectura, principios y fases de ED1 (se cita como ED1 §N). Vigente desde el 5 oct 2026: integra las decisiones del dueño, la dimensión de producto del CORE, la cuenta paga, los proveedores y la preparación para agentes (registro en su §43) | Por pedido del dueño, se creó aquí. Una versión nueva es un archivo nuevo; ninguna se edita después de publicada |
| `ECOSISTEMA-DIGITAL-ED1-v1.2.md` | Historia: la versión del 28 sep 2026, con la misma numeración que la v1.3 | Nunca |
| `REVISION-HALLAZGOS-ED1.md` | Hallazgos [H1]–[H16] de ED1 | No se edita aquí |
| `Estudio de mercado software para invernaderos y agricultura.md` | Mercado, competencia, precios y visión de hardware | Nueva investigación |
| `BITACORA-ecommerce.md` | Copia de referencia de la bitácora de la línea ecommerce (P1–P21, bitácora ecommerce N) | Se reemplaza por la versión vigente cuando se quiera releer. No se edita aquí |

Orden de precedencia ante una contradicción: documentos de ED1 → `ARQUITECTURA.md` → `BACKLOG.md`. Si una instrucción nueva contradice alguno, se señala antes de actuar (instrucciones del proyecto §1).

Carpetas:

- `runbooks/`: procedimientos paso a paso (despliegue, ambientes de GitHub, pagos con Bold, cambio de dominio, kill switch, vigía de cuota).
- `validacion/`: búsquedas, revisión agronómica y métricas de las herramientas.
- `seguridad/`: revisiones de seguridad, con cada hallazgo, su arreglo y su prueba.
- `analisis/`: análisis de arquitectura que miran más allá de este producto. Proponen; las decisiones van a `ARQUITECTURA.md` cuando el dueño las toma.
  - `integracion-tienda-ecosistema.md`: cómo integrar la Tienda al ecosistema y si conviene migrarla a esta arquitectura.
  - `ESTUDIO-MERCADO-ECOMMERCE-ED1-2026-10.md` y su `VALIDACION-…`: el mercado de ecommerce y su validación a la luz del ecosistema, con las respuestas del dueño.
  - `cuenta-cloudflare-paga.md`: qué le da al ecosistema una cuenta con Workers Paid, y la lista para revisar la que ya existe.
  - `proveedores-de-computo.md`: otros proveedores de cómputo y servicios, con los criterios de gobierno para integrarlos.
- `arquitectura/`: el diseño de la plataforma y de la Tienda 3.0, con su modelo de datos probado. Pasa a `ARQUITECTURA.md` (ADR-20 a ADR-26) en el pull request que implementa cada pieza.
  - `PLATAFORMA.md`: el CORE con dimensión de producto, las cuentas, los tokens v2, los planes por periodo, la preparación para agentes y el repositorio.
  - `TIENDA-3.0.md`: el producto de comercio electrónico, diseñado desde cero.
  - `sql/`: las migraciones propuestas y los scripts que las prueban con `node:sqlite` (ver su `README.md`).
