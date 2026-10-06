# docs/ — la plataforma ED1

Qué es cada documento, cuál manda sobre qué y dónde está cada uno. Cada tema tiene una sola fuente (P2); los demás la citan.

Desde el 5 oct 2026 este repositorio es la **plataforma** del ecosistema (`laboratoriodigital/plataforma`, ADR-26), con dos productos: **CultivoPro**, en producción, y la **Tienda 3.0**, diseñada. Por eso `docs/` se ordena por producto.

```text
docs/
├── README.md              este mapa
├── ARQUITECTURA.md        lo construido: decisiones (ADR-1 a ADR-30), componentes, cuotas, secretos y despliegue
├── BACKLOG.md             qué se construye y cuándo
├── BITACORA.md            lo que se rompió y lo que se aprendió (la bitácora agro)
├── ecosistema/            ED1: la arquitectura, los principios y las fases del ecosistema
│   └── historia/          las versiones anteriores de ED1, que no se editan
├── plataforma/            lo que comparten los productos: CORE, cuenta, dominios, agentes y proveedores
│   ├── BACKLOG_CORE.md    plan, sprints e historias del CORE
│   ├── BITACORA_CORE.md   lo que se rompió y se aprendió en el CORE (la bitácora core)
│   └── sql/               migraciones propuestas del CORE, con su prueba
├── agro/                  CultivoPro: su estudio de mercado y sus mediciones
│   └── validacion/
├── tienda/                la Tienda 3.0 y la línea ecommerce
│   ├── BACKLOG_TIENDA3.md plan, sprints e historias de la Tienda 3.0
│   ├── BITACORA_TIENDA3.md lo que se rompió y se aprendió en la Tienda 3.0 (la bitácora tienda3)
│   ├── historia/          el estudio de mercado anterior
│   └── sql/               migraciones propuestas de la tienda, con su prueba
├── runbooks/              procedimientos paso a paso
└── seguridad/             revisiones de seguridad
```

`ARQUITECTURA.md`, `BACKLOG.md` y `BITACORA.md` se quedan en la raíz porque el código y las pruebas los leen por esa ruta (`tests/repo/`, `apps/core/src/core.test.ts`).

## Qué manda sobre qué

| Documento | Es la fuente de | Se actualiza cuando |
|---|---|---|
| `ARQUITECTURA.md` | Decisiones (ADR-1 a ADR-30), componentes construidos, cuotas y capacidad, secretos, despliegue | Cambia una decisión, un límite o un componente. Va en el mismo pull request que el código |
| `BACKLOG.md` | Hitos, sprints, historias, work items y velocidad | Planeación y cierre de cada sprint |
| `BITACORA.md` | Lo que se rompió, las afirmaciones falsas, los cambios de rumbo y los patrones | Algo se rompe o se aprende. Una entrada nueva va al final |
| `ecosistema/ECOSISTEMA-DIGITAL-ED1-v1.4.md` | Arquitectura, principios y fases de ED1 (se cita como ED1 §N). Vigente desde la tarde del 5 oct 2026: la cuenta única, los dominios, los periodos de plan, el repositorio y el estudio de ecommerce definitivo (registro en su §43) | Por pedido del dueño, una versión nueva es un archivo nuevo. Ninguna se edita después de publicada: la anterior pasa a `historia/` |
| `ecosistema/historia/` | ED1 v1.2 (28 sep 2026) y v1.3 (5 oct 2026, en la mañana), con la misma numeración | Nunca |
| `ecosistema/REVISION-HALLAZGOS-ED1.md` | Hallazgos [H1]–[H16] de ED1 | No se edita aquí |
| `plataforma/PLATAFORMA.md` | El diseño del CORE con dimensión de producto, la cuenta de Cloudflare, los dominios, los tokens v2, los planes por periodo, la preparación para agentes y el repositorio | Cambia el diseño. Cada pieza pasa a `ARQUITECTURA.md` en el pull request que la implementa |
| `plataforma/BACKLOG_CORE.md` | Hitos, sprints, épicas, historias, work items y velocidad del CORE, con la dirección de diseño del frontend del ecosistema | Planeación y cierre de cada sprint del CORE |
| `plataforma/BITACORA_CORE.md` | Lo que se rompió y se aprendió en el CORE («bitácora core N»), con las mismas convenciones que las otras bitácoras para unirlas | Algo se rompe o se aprende en el CORE. Una entrada nueva va al final |
| `plataforma/cuenta-cloudflare.md` | La cuenta del ecosistema con Workers Paid: cifras, lista para activarlo y control de gasto | Cambian los precios, el plan o la cuenta |
| `plataforma/proveedores-de-computo.md` | Otros proveedores de cómputo y servicios, con los criterios de gobierno para integrarlos | Entra o sale un proveedor |
| `plataforma/sql/` | Las migraciones propuestas del CORE (0006 a 0009) y su prueba con `node:sqlite` (ver su `README.md`) | Con el diseño |
| `agro/ESTUDIO-MERCADO-AGRO-2026-09.md` | Mercado, competencia, precios y visión de hardware del agro: el «Estudio» que citan ARQUITECTURA y BACKLOG | Nueva investigación. `planes.test.ts` ata sus precios a la página de planes |
| `agro/validacion/` | Demanda de búsqueda, revisión agronómica y métricas de las herramientas | Cada medición |
| `tienda/TIENDA-3.0.md` | El diseño del producto de comercio electrónico, con su modelo de datos probado | Cambia el diseño |
| `tienda/BACKLOG_TIENDA3.md` | Hitos, sprints, épicas, historias, work items y velocidad de la Tienda 3.0, con la dirección de diseño de la vitrina y del panel | Planeación y cierre de cada sprint de la Tienda |
| `tienda/BITACORA_TIENDA3.md` | Lo que se rompió y se aprendió en la Tienda 3.0 («bitácora tienda3 N»), con las mismas convenciones que las otras bitácoras para unirlas | Algo se rompe o se aprende en la Tienda 3.0. Una entrada nueva va al final |
| `tienda/ESTUDIO-MERCADO-ECOMMERCE-ED1-2026-10-v1.3.md` | El mercado de ecommerce: competencia, pagos, entrega, facturación y precios. Es del dueño, y el definitivo | Por el dueño. Una versión nueva es un archivo nuevo; la anterior pasa a `historia/` |
| `tienda/VALIDACION-ESTUDIO-MERCADO-ECOMMERCE-ED1-2026-10.md` | La validación del estudio contra el ecosistema ([V1]–[V11]) y las respuestas del dueño | — |
| `tienda/integracion-tienda-ecosistema.md` | Por qué la Tienda 3.0 va sobre esta plataforma | — |
| `tienda/BITACORA-ecommerce.md` | Copia de referencia de la bitácora de la línea ecommerce (P1–P21, «bitácora ecommerce N») | Se reemplaza por la vigente cuando se quiera releer. No se edita aquí |
| `tienda/historia/` | El estudio de ecommerce v1.2 | Nunca |
| `tienda/sql/` | Las migraciones propuestas de la tienda y su prueba (ver su `README.md`) | Con el diseño |
| `runbooks/` | Procedimientos paso a paso: despliegue, ambientes de GitHub, pagos con Bold, cambio de dominio, kill switch, vigía de cuota y renombrar el repositorio | Cambia el procedimiento |
| `seguridad/` | Revisiones de seguridad, con cada hallazgo, su arreglo y su prueba | Cada revisión |

**Orden de precedencia ante una contradicción:** documentos de ED1 → `ARQUITECTURA.md` → `BACKLOG.md`. Los diseños de `plataforma/` y `tienda/` proponen; `ARQUITECTURA.md` decide, y lo construido manda sobre lo diseñado. Si una instrucción nueva contradice alguno, se señala antes de actuar (instrucciones del proyecto §1).

## Los dominios (ADR-27)

| Dominio | Para qué |
|---|---|
| `laboratorio-digital.com` | El ecosistema: el sitio principal y el CORE (`cuenta.laboratorio-digital.com`) |
| `laboratorio-digital.app` | Las tiendas (`<nombre>.laboratorio-digital.app`) y los proyectos nuevos |
| `cultivopro.co` | CultivoPro y sus derivados |

Los tres en la misma cuenta de Cloudflare (ADR-23). Detalle en `plataforma/PLATAFORMA.md` §3.

## Dónde quedó cada documento (reorganización del 5 oct 2026)

Los documentos de `historia/`, el CHANGELOG y las entradas ya escritas de las bitácoras conservan las rutas de su fecha. Esta tabla las traduce:

| Antes | Ahora |
|---|---|
| `ECOSISTEMA-DIGITAL-ED1-v1.3.md` | `ecosistema/historia/ECOSISTEMA-DIGITAL-ED1-v1.3.md`; la vigente es `ecosistema/ECOSISTEMA-DIGITAL-ED1-v1.4.md` |
| `ECOSISTEMA-DIGITAL-ED1-v1.2.md` | `ecosistema/historia/ECOSISTEMA-DIGITAL-ED1-v1.2.md` |
| `REVISION-HALLAZGOS-ED1.md` | `ecosistema/REVISION-HALLAZGOS-ED1.md` |
| `arquitectura/PLATAFORMA.md` | `plataforma/PLATAFORMA.md` |
| `analisis/cuenta-cloudflare-paga.md` | `plataforma/cuenta-cloudflare.md` |
| `analisis/proveedores-de-computo.md` | `plataforma/proveedores-de-computo.md` |
| `arquitectura/sql/core/`, `arquitectura/sql/probar-core.mjs` | `plataforma/sql/core/`, `plataforma/sql/probar-core.mjs` |
| `Estudio de mercado software para invernaderos y agricultura.md` | `agro/ESTUDIO-MERCADO-AGRO-2026-09.md` |
| `validacion/` | `agro/validacion/` |
| `arquitectura/TIENDA-3.0.md` | `tienda/TIENDA-3.0.md` |
| `analisis/ESTUDIO-MERCADO-ECOMMERCE-ED1-2026-10-v1.3.md` | `tienda/ESTUDIO-MERCADO-ECOMMERCE-ED1-2026-10-v1.3.md` |
| `analisis/ESTUDIO-MERCADO-ECOMMERCE-ED1-2026-10.md` (v1.2) | `tienda/historia/ESTUDIO-MERCADO-ECOMMERCE-ED1-2026-10-v1.2.md` |
| `analisis/VALIDACION-ESTUDIO-MERCADO-ECOMMERCE-ED1-2026-10.md` | `tienda/VALIDACION-ESTUDIO-MERCADO-ECOMMERCE-ED1-2026-10.md` |
| `analisis/integracion-tienda-ecosistema.md` | `tienda/integracion-tienda-ecosistema.md` |
| `BITACORA-ecommerce.md` | `tienda/BITACORA-ecommerce.md` |
| `arquitectura/sql/tienda/`, `arquitectura/sql/tienda-control/`, `arquitectura/sql/probar-tienda.mjs` | `tienda/sql/tienda/`, `tienda/sql/tienda-control/`, `tienda/sql/probar-tienda.mjs` |
| `arquitectura/sql/README.md` | `plataforma/sql/README.md` y `tienda/sql/README.md` |
