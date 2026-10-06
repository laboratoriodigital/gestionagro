# Plataforma ED1 — el CORE con dimensión de producto

**Estado:** propuesta de arquitectura, con las decisiones del dueño del 5 oct 2026 ya incorporadas (las de la mañana y las de la tarde)
**Versión:** 0.2 · 5 oct 2026
**Alcance:** el CORE como servicio de todos los productos (identidad, organizaciones, roles, planes, cobros y directorio), la cuenta de Cloudflare, los dominios, la preparación para agentes y el repositorio. El producto de comercio electrónico que se construye encima está en `../tienda/TIENDA-3.0.md`.
**Documentos que manda este:** `../ecosistema/ECOSISTEMA-DIGITAL-ED1-v1.4.md` (ED1 §N), `../ARQUITECTURA.md` (ADR-N, P1–P21, §N), y en esta carpeta `cuenta-cloudflare.md` y `proveedores-de-computo.md`.

> **Cómo se usa.** Este documento propone; `ARQUITECTURA.md` decide. Cada pieza pasa allí, con su ADR y su tabla en §5.4, en el mismo pull request que la implementa (P18). Hasta entonces, el diseño vive aquí. El SQL de §4 no es un borrador: está en `sql/core/`, con su prueba (`sql/probar-core.mjs`), corrida contra las migraciones reales 0001–0005 del CORE.
>
> **Versión 0.2 (5 oct 2026, tarde).** Cuatro decisiones nuevas del dueño cambian §3, §4.8, §6 y §9: todo en la cuenta de Cloudflare de siempre, los tres dominios del ecosistema, planes de 1, 3, 6 y 12 meses y el repositorio renombrado a `plataforma`. Al verificar los dominios apareció además un límite de Cloudflare que cambia el diseño anterior: no admite como zona un dominio de la Public Suffix List (§3.4).

---

## 0. Resumen

**Lo que decidió el dueño el 5 oct 2026**, en respuesta a la validación del estudio de ecommerce (`../tienda/VALIDACION-ESTUDIO-MERCADO-ECOMMERCE-ED1-2026-10.md` §5):

1. Hay dos tiendas 2.0 en operación.
2. Las palabras clave se miden, pero no bloquean este proyecto.
3. El ecommerce entra como **excepción declarada**, como el agro con ADR-2.
4. Se ofrecen **todos los periodos de plan**, prepagados: mensual, trimestral y anual. En la tarde sumó el semestral (decisión 9).
5. Sin contador ni abogado por ahora. Todo se hace con rigor técnico.
6. **El CORE gana la dimensión de producto y queda listo para crecer.**

El mismo día pidió además:

- Integrar los principios de preparación para agentes de isitagentready.com «hasta donde lo permita el modelo».
- Diseñar la Tienda 3.0 **desde cero**. Los datos de las tiendas actuales se cargan después con scripts.

**En la tarde**, con el estudio de ecommerce definitivo (v1.3, `../tienda/ESTUDIO-MERCADO-ECOMMERCE-ED1-2026-10-v1.3.md`), sumó cuatro más:

7. **Una sola cuenta de Cloudflare:** «la misma cuenta actual, donde ya se viene usando todo» (§3.1).
8. **Los dominios:** `laboratorio-digital.com` es el principal; `laboratorio-digital.app`, el de las tiendas y los proyectos nuevos; `cultivopro.co`, el del agro y sus derivados (§3.3).
9. **Planes de 1, 3, 6 y 12 meses** (§4.8).
10. **El repositorio pasa de `gestionagro` a `plataforma`** (§6.1).

**Las ocho decisiones de este documento:**

1. **El producto es una dimensión de primer nivel del CORE.**
   - Un producto declara sus tipos de organización, sus roles, sus planes y sus precios por periodo.
   - Toda organización, membresía, invitación, sesión, interés, pago y celda pertenece a un producto.
   - Las combinaciones imposibles las rechaza la base con claves foráneas compuestas, no solo el código. Ejemplos: un rol del agro en una tienda, una tienda en una celda del agro, un plan de otro producto.
   - **Agregar un producto es un archivo y un despliegue, no una migración** (§4).
2. **Tokens v2.**
   - Nuevos reclamos: `aud` (el producto), `plan`, `plan_vence` y `auth_time`.
   - El emisor pasa de `agro-core` a `ed1-core`, con un periodo de aceptación de ambos.
   - El refresh token sirve a un solo producto (§4.6).
3. **Planes de 1, 3, 6 y 12 meses, prepagados.**
   - Los periodos son una **tabla de referencia**, no un `CHECK`: el de 6 meses llegó horas después del diseño con 1, 3 y 12, y con un `CHECK` habría obligado a rehacer dos tablas (§4.3).
   - Se cuentan en meses calendario en America/Bogota.
   - Cambiar de plan convierte en días lo que quedaba del anterior.
   - No hay débito automático (§4.8).
4. **Una sola cuenta de Cloudflare, la de siempre** (§3.1–§3.2).
   - Workers Paid se activa en ella cuando la Tienda 3.0 lo necesita, en su M0. Desde entonces el exceso se factura en vez de cortar el servicio, para todos los productos.
   - Cada producto se aísla por presupuesto, kill switch y celdas, no por cuenta.
   - El CORE se queda donde está: no hay mudanza, ni puente, ni disparador.
5. **Tres dominios, con un papel cada uno** (§3.3, ADR-27).
   - `laboratorio-digital.com`: el ecosistema y el CORE (`cuenta.laboratorio-digital.com`).
   - `laboratorio-digital.app`: las tiendas y los proyectos nuevos, en un solo espacio de nombres de primer nivel.
   - `cultivopro.co`: el agro y sus derivados.
   - **Sin Public Suffix List**, porque Cloudflare no la admite en una zona propia. Lo que daba se cubre de otra forma (§3.4).
6. **El monorepo de la plataforma es este repositorio, renombrado a `laboratoriodigital/plataforma`.** No se crea uno nuevo con `git filter-repo`: renombrar conserva los secretos, los ambientes, los issues y la historia de las PR (§6). Esto corrige `../tienda/integracion-tienda-ecosistema.md` §6.
7. **Preparación para agentes como principio** (ED1 §3.12):
   - Primero, la capa estática y gratuita: reglas para bots de IA, señales de contenido, `llms.txt`, gemelos en Markdown, catálogo de API y habilidades.
   - Después, capacidades: MCP y el CORE como servidor de autorización OAuth 2.1.
   - En comercio, el agente prepara y **una persona paga** (§5).
8. **Una receta verificada para reconstruir tablas en D1.**
   - El hallazgo: con claves foráneas diferidas, rehacer una tabla padre falla al confirmar.
   - El «arreglo» habitual deja pasar violaciones reales sin avisar.
   - La receta agrega una guarda que hace fallar la migración si queda una sola fila huérfana (§4.4).

**Lo que no cambia:** ADR-1 a ADR-19 siguen vigentes. La finca cero es una organización más (ADR-1). Los tokens se verifican en las celdas sin llamar al CORE (ADR-10). Escalar es pagar, no abrir cuentas (ADR-7).

---

## 1. Punto de partida

### 1.1 El CORE v0, en una tabla

Hoy el CORE (`apps/core`) atiende un solo producto, y lo nombra en doce sitios:

| Dónde | Qué dice hoy | Qué pasa a decir |
|---|---|---|
| `organizacion.tipo` | `CHECK (tipo IN ('finca','asesor','cadena'))` | Clave foránea a `producto_tipo (producto, tipo)` |
| `organizacion.plan` | `CHECK (plan IN ('gratuito','finca','exportador','cadena'))` | Clave foránea a `plan (producto, id)` |
| `membresia.rol` e `invitacion.rol` | `CHECK (rol IN ('propietario','supervisor','operario','asesor','auditor'))` | Clave foránea a `producto_rol (producto, rol)` |
| `interes_plan.plan` | `CHECK` con los planes del agro | Clave foránea a `plan` |
| `pago.producto` | `CHECK (producto IN ('agro'))` | Clave foránea a `producto` |
| `pago.meses` | `CHECK (meses > 0)`; el código siempre escribe 1 | Clave foránea a `periodo` (1, 3, 6 y 12) y precio por periodo en `plan_precio` |
| `identidad.proveedor` | `CHECK (proveedor IN ('google'))` | Clave foránea a `proveedor_identidad` (llega `correo`) |
| `usuario.politica_*` | Una política (la del agro) | `aceptacion_politica (usuario, producto, versión)` |
| `entrar.ts › vueltaPermitida` | Solo pantallas bajo `/agro/app/` | Rutas de vuelta declaradas por cada producto |
| `pagos.ts` | `planes.json` del cuaderno; vuelta bajo `/agro/app/`; referencia `agro-…` | Los planes del producto de la organización; vuelta y prefijo del producto |
| `packages/tokens` | `EMISOR = 'agro-core'`; sin `aud` | `ed1-core` con aceptación dual; `aud` = producto |
| `constantes.ts` y `politica.ts` | `PRODUCTO_CORE = 'agro-core'`; la política del agro | Kill switch del CORE y uno por producto; política por producto |

### 1.2 Restricciones que mandan sobre el diseño

- **D1 cuenta cada índice como una fila escrita** (bitácora agro, «Lo que el terreno enseñó»). Cada índice nuevo va con su costo.
- **50 consultas por invocación** en el plan gratuito y 1.000 en el pago (ED1 §41). Ningún flujo del CORE debe pasar de 30.
- **Cron Triggers: 5 por cuenta en el plan gratuito, y ya se usan 4.** Son el CORE y la API de la celda c0, en producción y en staging. Ningún producto nuevo cabe con cron propio hasta activar Workers Paid, que da 250 (§3.2).
- **El que se actualiza corre su versión vieja (P10).** Hay cuadernos instalados con la URL del CORE y el emisor de hoy. Todo cambio de contrato se expande, se migra y se contrae.
- **D1 aplica siempre las claves foráneas.** No se pueden apagar, solo diferir (informe de investigación de la cuenta; ver `cuenta-cloudflare.md`).

---

## 2. Principios de este diseño

Se heredan los de ED1 §3 y los patrones P1–P21. Estos seis son reglas nuevas que salen de diseñar el CORE para varios productos:

| Regla | Qué exige | Por qué |
|---|---|---|
| **R1 · Lo que va a crecer es dato** | Un conjunto que crecerá (productos, roles, planes, estados, proveedores) va en una **tabla de referencia** con clave foránea, no en un `CHECK`. Solo lo cerrado de verdad (sí/no, `pruebas`/`produccion`) es `CHECK` | En SQLite, cambiar un `CHECK` obliga a rehacer la tabla (§4.4). Agregar una fila a una tabla de referencia es un `INSERT` |
| **R2 · Producto en todo** | No hay fila de negocio sin producto, directo o heredado de su organización | Sin eso, la segunda línea de producto mezcla datos |
| **R3 · Lo imposible lo rechaza la base** | Las claves foráneas compuestas (`(org_id, producto)`, `(producto, rol)`, `(celda_id, producto)`) hacen imposibles los cruces entre productos | El código se equivoca; la base no se olvida. La prueba lo demuestra con los cruces inválidos (§4.3) |
| **R4 · Ninguna clave foránea con `ON DELETE CASCADE`** | Ni en el CORE ni en las celdas | En D1, `DROP TABLE` de una padre hace un `DELETE` implícito. Con `CASCADE` se llevaría a las hijas al rehacer la tabla |
| **R5 · Toda reconstrucción, con la receta de §4.4** | `defer_foreign_keys` encendido, rehacer, apagarlo y correr la guarda de huérfanas | El arreglo habitual deja pasar violaciones reales (§4.4) |
| **R6 · Un permiso por producto y por propósito** | Cada producto tiene su kill switch, su presupuesto y sus credenciales. Cada credencial sirve a un propósito, con el alcance mínimo | P12. Es la causa 4 de la Tienda 2.0: cuatro permisos que se pisan. Con una sola cuenta, el aislamiento entre productos descansa en esta regla (§3.1) |

---

## 3. Cuenta, dominios y crecimiento

### 3.1 Una sola cuenta: la de siempre

El dueño lo decidió el 5 oct 2026, en la tarde: «usar la misma cuenta actual de Cloudflare donde ya se viene usando todo». Es la cuenta ED1 principal (`laboratoriodigital-la.workers.dev`).

| En la cuenta, hoy | Qué hay | Fuente |
|---|---|---|
| Zonas | `laboratorio-digital.com` y `cultivopro.co`. Se suma `laboratorio-digital.app` con el M0 de la Tienda 3.0 (§3.3) | Panel de Cloudflare |
| CultivoPro, celda c0 | Sitio, CORE y API de la celda, cada uno con staging | `infrastructure/celdas.json` |
| Tiendas 2.0 | Las dos en operación, en subdominios de `laboratorio-digital.com`. Su Worker tiene que estar en la cuenta de la zona | `tienda/docs/DESPLIEGUE.md` de la Tienda 2.0, «Dominio propio» |
| Plan | Gratuito. Workers Paid se activa con el M0 de la Tienda 3.0 (§3.2) | — |

Las otras dos cuentas del dueño (una gratuita y otra con algunos servicios pagos) **quedan fuera de la plataforma**: ningún producto se despliega en ellas. Si algún día se usan, se declaran con su propósito (§3.5).

**Por qué una sola, y no una cuenta paga aparte para lo que cobra**, como proponía la versión 0.1:

- **No hay nada que mudar.** La llave de firma del CORE, la URL que tienen los cuadernos instalados y las zonas se quedan donde están. Mudar el CORE pedía un Worker puente, 90 días de convivencia y mover la zona o servirla como hostname personalizado.
- **Workers Paid es por cuenta.** Los mismos USD 5 al mes le dan sus límites a **todos** los productos. El agro deja de cortarse a las 19:00 sin otra suscripción, y el CORE gana crons y correo.
- **Las tiendas 2.0 ya están en esta cuenta**, y las 3.0 también lo estarán. El día del cambio, la redirección es una regla de la misma zona.
- **El aislamiento que importa es por producto, y ya existe:** presupuesto declarado, kill switch y celdas con sus propias bases (ARQUITECTURA §8). La cuenta es la unidad de facturación, no la de aislamiento.

**Lo que se acepta a cambio:** todo depende de una cuenta. Una suspensión o un compromiso de la cuenta tumbaría todos los productos a la vez. La respuesta no es repartir, sino poder salir (§3.5): una copia mensual cifrada fuera de Cloudflare, dominios con recuperación aparte y la cuenta con segundo factor.

### 3.2 Workers Paid en la misma cuenta

**Cuándo:** con el M0 de la Tienda 3.0 (TIENDA-3.0 §19), que lo necesita para existir. Necesita crons (hay 5 y se usan 4), colas con retención, más de 10 ms de CPU para hornear y 1.000 consultas por invocación. Se activa antes solo si el agro o el CORE lo necesitan primero, por ejemplo para el correo del enlace mágico (§4.11).

**Qué cambia para todos los productos** (cifras en `cuenta-cloudflare.md` §1):

- El exceso **se factura en vez de cortar el servicio**. Un producto ya no deja sin base a los demás a las 19:00 de Colombia.
- 250 crons por cuenta, 1.000 consultas a D1 por invocación, hasta 5 minutos de CPU, bases de 10 GB, Time Travel de 30 días y correo a cualquier destinatario.
- Lo incluido es **de la cuenta**, no de cada producto: 10 millones de solicitudes y 50 millones de filas escritas al mes, entre otros. Cada producto declara su parte en su `product.yaml`, como hoy declara su parte de la cuota gratuita (ARQUITECTURA §8.1).

**Qué cambia en la operación** (P1, P16):

1. **El vigía cambia de vara.**
   - Hoy compara contra cuotas diarias y degrada por niveles.
   - Con Workers Paid, compara el consumo del mes contra lo incluido y proyecta el costo en dólares (§4.10).
   - El código ya lo espera: cada celda declara su `plan` en `celdas.json` (`free`, `paid` o `cliente`), y `vigia.ts` falla a propósito con `paid` («las cuotas del plan «paid» no están definidas en el vigía», P1).
   - El pull request que activa Workers Paid cambia `plan` a `paid` y le da al vigía sus cuotas del mes, con su prueba.
2. **Presupuesto en dinero por producto** (`product.yaml › presupuesto.usd_mes`), y las **alertas de facturación** de Cloudflare como segunda red. No hay tope duro de gasto (investigación, sin verificar).
3. **Límites por Worker** (`limits.cpu_ms`, `limits.subrequests`) y workers.dev apagado en producción, para que un error no se vuelva factura (`cuenta-cloudflare.md` §5).
4. **Los kill switches siguen siendo por producto.** Con el 100 % del presupuesto en dinero, el vigía apaga la capacidad que el producto declare, nunca la venta.

**Lo que no cambia:** HA1. Escalar es pagar, no abrir cuentas. Un producto nunca se reparte entre cuentas gratuitas para sumar cuota (ARQUITECTURA §6.5).

### 3.3 Dominios (ADR-27)

| Dominio | Para qué | Regla |
|---|---|---|
| `laboratorio-digital.com` | El ecosistema: el sitio principal y el CORE (`cuenta.laboratorio-digital.com`, Workers Custom Domain) | No sirve contenido de comercios ni de usuarios ([V10], ED1 §14.1). Las dos tiendas 2.0 que viven ahí son la excepción heredada: al cargarse en la 3.0 se redirigen con 301 a su dirección nueva (TIENDA-3.0 §17.3) |
| `laboratorio-digital.app` | Las tiendas sin dominio propio (`<slug>.laboratorio-digital.app`); los servicios de la tienda (`panel.`, `img.`, `mcp.`, `origen.`), y los **proyectos nuevos** del ecosistema (`<proyecto>.laboratorio-digital.app`) | Un solo espacio de nombres de primer nivel, compartido por tiendas y proyectos. Un nombre lo toma una tienda o lo reserva la plataforma, nunca los dos (§3.4) |
| `cultivopro.co` | El agro y sus derivados (ADR-19): el sitio y las calculadoras, el cuaderno (`/agro/app/`) y lo que venga, como `mcp.cultivopro.co` (§5.5). Un producto agrícola nuevo que se le parezca vive aquí | — |
| Dominios de los comercios | La tienda en el dominio del comercio | Hostname personalizado de Cloudflare for SaaS en la zona `laboratorio-digital.app`. `www` es el canónico; la raíz, solo si el DNS del comercio hace CNAME flattening. Detalle en TIENDA-3.0 §4 |

**Las tres zonas van en la misma cuenta.** Lo exigen los Workers Custom Domains, los dominios personalizados de R2 y Cloudflare for SaaS: la zona, el Worker y el bucket tienen que estar en la misma cuenta (`cuenta-cloudflare.md` §1).

**Qué trae `.app`:**

- **Solo HTTPS, de fábrica.** El dominio de nivel superior `.app` está entero en la lista de precarga HSTS de los navegadores (conocimiento previo, no consultado en esta sesión).
  - Toda dirección de la zona necesita certificado. Cloudflare lo da gratis (Universal SSL) para la raíz y el primer nivel (`*.laboratorio-digital.app`).
  - Por eso las tiendas y los proyectos van en el **primer nivel**. Una dirección como `x.y.laboratorio-digital.app` pediría un certificado avanzado: Advanced Certificate Manager, USD 10 al mes por zona (por resumen, sin verificar).
- **La reputación del ecosistema queda aparte.** Una tienda fraudulenta en `.app` no arrastra a `laboratorio-digital.com`, al CORE ni a su correo (§4.11).

### 3.4 Sin la Public Suffix List, y qué la reemplaza

La versión 0.1 proponía pedir que el dominio de tiendas entrara en la **Public Suffix List** (PSL), para que cada tienda fuera un «sitio» aparte para el navegador.

**Con la zona en Cloudflare eso no se puede.**

- Cloudflare exige que el dominio de una zona esté un nivel por debajo de un sufijo de la PSL. Un dominio inscrito en ella deja de ser registrable y no se puede agregar como zona, salvo en el plan Enterprise.
- Fuente: documentación de Cloudflare y su comunidad, por resumen del buscador, el 5 oct 2026.
- Y la zona tiene que estar en Cloudflare para servir las tiendas (§3.3).

**Lo que la PSL daba, el diseño ya lo da:**

| Riesgo que cubre la PSL | Cómo queda cubierto sin ella |
|---|---|
| Una tienda pone cookies que lee otra | Las tiendas no usan cookies. El carrito va en `localStorage` y el panel en IndexedDB, que son **por origen**: cada `<slug>.laboratorio-digital.app` es un origen distinto |
| Un script de terceros comparte su cookie entre tiendas (`_ga` o `_fbp` en `.laboratorio-digital.app`) | GA4 y el píxel de Meta solo en tiendas con dominio propio (TIENDA-3.0 §4.1 y §11.6). Los comercios no pueden subir JavaScript |
| Una tienda fraudulenta arrastra la reputación de las demás (listas de bloqueo, Safe Browsing) | Ficha legal completa antes de publicar, reporte en el pie de cada tienda, suspensión con un clic y ningún directorio común de tiendas (TIENDA-3.0 §4.4). Es el riesgo que queda: está en §8 |

**El escape, si ese riesgo se cumple** (por ejemplo, una marca de Safe Browsing sobre todo el dominio):

- Las tiendas sin dominio propio pasan a un segundo nivel: `<slug>.t.laboratorio-digital.app`.
- `t.laboratorio-digital.app` se inscribe en la PSL y lleva un certificado comodín de segundo nivel.
- Las direcciones viejas responden 301.

Antes de pedirlo hay que confirmar que Cloudflare acepte una entrada de la PSL **dentro** de una zona propia. No se hace mientras no haga falta.

**El espacio de nombres compartido** (tiendas y proyectos en el primer nivel):

- **La base de control guarda los reservados.** `tienda_control.slug_reservado` lista los nombres que una tienda no puede tomar, con su motivo:
  - `infraestructura`: `www`, `panel`, `img`, `mcp`, `origen`, `correo`…;
  - `suplantacion`: `admin`, `soporte`, `pagos`, `cuenta`…;
  - `proyecto` y `marca`.
- **Los de `proyecto` y `marca` salen de un archivo,** `infrastructure/dominios.json`, que el despliegue copia a la base (P2). Una prueba exige que todo hostname de `laboratorio-digital.app` que aparezca en una configuración de Worker del repositorio esté en ese archivo.
- **La base lo hace cumplir en los dos sentidos.** Una tienda no toma un nombre reservado, y no se reserva un nombre que ya tiene tienda. El despliegue que lo intente falla con el nombre, en vez de quitarle la dirección a un comercio (P1). Probado en `../tienda/sql/probar-tienda.mjs`.
- **`--` dentro de un nombre queda para la plataforma.** El staging de la tienda usa `<slug>--staging.laboratorio-digital.app`, con rutas propias del Worker de staging, más específicas que el comodín de producción.

### 3.5 Reglas de gobierno de la cuenta

1. **La cuenta se declara** en `infrastructure/cuentas.json`: nombre, plan, dueño, contactos de recuperación y las cuentas que quedan fuera de la plataforma.
   - Ningún identificador de cuenta va en ese archivo. Los identificadores siguen en los secretos de GitHub, como hoy.
   - Una prueba exige que cada celda de `celdas.json` nombre una cuenta declarada: hoy, la principal; mañana, la de un cliente con celda dedicada (ADR-8).
2. **Ningún producto se reparte entre cuentas gratuitas** (HA1). Es la lectura prudente de Cloudflare §2.2.1(c), que prohíbe esquivar cuotas. El texto de los términos no se pudo volver a leer el 5 oct 2026 (egreso bloqueado): la lectura es la del 30 sep 2026 (ARQUITECTURA §6.5).
3. **Con Workers Paid, alertas de facturación** por cada producto de uso (Workers, D1, R2, Queues, correo), y el presupuesto de cada producto también en dinero (§3.2).
4. **Credenciales por propósito, con el alcance mínimo:**
   - un token de despliegue;
   - un token de métricas de solo lectura;
   - un token de Cloudflare for SaaS solo con el permiso de hostnames personalizados de la zona `laboratorio-digital.app`.

   Los tres en los ambientes de GitHub, como hoy.
5. **Recuperación fuera de la cuenta** (ED1 §20.3):
   - segundo factor;
   - contactos de recuperación propios;
   - los tres dominios con un registrador y un correo que no dependan de Cloudflare.
6. **Plan de salida:** respaldo semanal en R2 y una copia semanal cifrada fuera de Cloudflare, en el Google Drive del dueño (ADR-30, decisión D-C5 del 5 oct 2026; ED1 §20.3; bitácora core 1). Es lo que convierte «todo en una cuenta» en un riesgo aceptable.
7. **Contenido arbitrario de usuarios, aparte.** Un producto que lo aloje, como el hosting temporal de ED1 §14, se evalúa cuando exista. Es el único caso en que una cuenta propia aislaría un riesgo real (HA1): una suspensión por abuso no debe tumbar las tiendas.

### 3.6 Dónde vive cada pieza

Todo en la misma cuenta. Lo que cambia por etapa es qué existe:

| Pieza | Hoy | Tienda 3.0 en construcción (M0–M3) | Tiendas cargadas (M6) |
|---|---|---|---|
| CORE | `agro-core` en workers.dev | Más `cuenta.laboratorio-digital.com` (P2 de §7), con la URL de workers.dev viva para los cuadernos instalados (P10) | Igual |
| CultivoPro | c0 | c0, con los límites de Workers Paid | c0. Una celda c2 cuando c0 se llene (ARQUITECTURA §6.3) |
| Tienda 3.0 | — | Despacho, API, panel y horno, en la celda c1 | c1 y sus shards |
| Zona `laboratorio-digital.app` | — | Entra a la cuenta en M0 | Igual |
| Tiendas 2.0 | Subdominios de `laboratorio-digital.com` | Siguen vendiendo | Redirigidas con 301, y retiradas tras 30 días sin volver atrás |

---

## 4. El CORE con dimensión de producto

### 4.1 Modelo conceptual

```text
 producto ─┬─< producto_tipo        (agro: finca, asesor, cadena · tienda: comercio)
           ├─< producto_rol         (agro: propietario…auditor · tienda: propietario, colaborador)
           ├─< plan ──< plan_precio (por periodo de `periodo`: 1, 3, 6 o 12 meses; con historia)
           ├─< celda                (cada celda es de un producto)
           └─< aceptacion_politica  (cada producto, su política)

 organizacion (producto, tipo, plan, plan_vence, estado, celda, shard, anillo)
   ├─< membresia  (usuario × organización, con un rol DEL producto de la organización)
   ├─< invitacion (rol del producto)
   ├─< interes_plan, pago (plan del producto; meses de `periodo`)
   └─  [producto] en la sesión: un refresh sirve a un solo producto

 usuario ─< identidad (google | correo) · ─< sesion (por producto) · ─< aceptacion_politica
```

**Una persona, muchas organizaciones de muchos productos.** Es la «cuenta ED1» de ED1 §16, con una entrada y un usuario. Cada token es de una organización y de un producto. Quien tiene una finca y una tienda entra una vez por app (orígenes distintos) y nunca usa con una el token de la otra.

### 4.2 El registro de productos (`infrastructure/productos.json`)

La lista de productos es un archivo versionado, como `celdas.json` (P2). El despliegue lo valida contra `schemas/productos.schema.json` y lo copia a las tablas `producto`, `producto_tipo`, `producto_rol`, `plan` y `plan_precio`, igual que hoy copia las celdas a `celda`. Un producto o un plan que sale del archivo no se borra de la base: queda `retirado` (P21), porque hay filas que lo nombran.

```json
{
  "$schema": "../schemas/productos.schema.json",
  "productos": [
    {
      "id": "agro",
      "nombre": "CultivoPro",
      "estado": "activo",
      "excepcion": "ADR-2",
      "app": { "origenes": "celdas.json › sitio", "rutas_de_vuelta": ["/agro/app/"] },
      "tipos": ["finca", "asesor", "cadena"],
      "roles": [
        { "id": "propietario", "administra": true, "invitable": true },
        { "id": "supervisor", "administra": false, "invitable": true },
        { "id": "operario", "administra": false, "invitable": true },
        { "id": "asesor", "administra": false, "invitable": true },
        { "id": "auditor", "administra": false, "invitable": false }
      ],
      "planes": "content/agro/cuaderno/planes.json",
      "politica": "content/agro/privacidad/politica.json",
      "prefijo_de_cobro": "agro",
      "gracia_dias": 0
    },
    {
      "id": "tienda",
      "nombre": "Tienda",
      "estado": "activo",
      "excepcion": "ADR-21",
      "app": {
        "origenes": { "produccion": "https://panel.laboratorio-digital.app", "staging": "https://panel--staging.laboratorio-digital.app" },
        "rutas_de_vuelta": ["/"]
      },
      "tipos": ["comercio"],
      "roles": [
        { "id": "propietario", "administra": true, "invitable": true },
        { "id": "colaborador", "administra": false, "invitable": true }
      ],
      "planes": "content/tienda/planes.json",
      "politica": "content/tienda/privacidad/politica.json",
      "prefijo_de_cobro": "tienda",
      "gracia_dias": 7
    }
  ]
}
```

- **`administra`** reemplaza al «propietario» que hoy está escrito en el código: quién paga, invita, cambia roles y quita personas. Un producto puede tener más de un rol que administra.
- **Los orígenes del agro no se copian:** siguen saliendo de `celdas.json › sitio`, que es su única fuente. Los productos nuevos los declaran en `app.origenes`. Cuando `celdas.json` se toque por la dimensión de producto (§4.9), `sitio` pasa aquí con su prueba.
- **Los planes y sus precios** siguen en el `planes.json` de cada producto, que es lo que lee su página de precios (P2). El formato crece sin romper (expandir):

  ```json
  { "id": "finca", "nombre": "Finca", "precio": "COP 39.000 a 59.000 al mes",
    "cobro_mensual_cop": 39000,
    "cobro": { "1": 39000, "3": 111000, "6": 210000, "12": 390000 } }
  ```

  - Las claves de `cobro` son periodos de la tabla `periodo`. Un periodo sin monto no se ofrece en ese plan.
  - Mientras existan los dos campos, una prueba exige que `cobro["1"]` sea igual a `cobro_mensual_cop`.
  - También exige que **a más meses, el mes no salga más caro**: `cobro[n] / n` no crece con `n`, así que `cobro["6"] ≤ 6 × cobro["1"]` y `cobro["12"] ≤ 2 × cobro["6"]`.
  - Todo monto es un entero de al menos COP 1.000, el mínimo de Bold.
  - `planes.test.ts` no cambia: ata el `precio` visible al estudio, no a `cobro`.

  Los montos de 3, 6 y 12 meses los fija el dueño. Los del ejemplo son una propuesta: 5 % menos en el trimestre, 10 % menos en el semestre y «dos meses de regalo» en el año, redondeados a miles hacia abajo (§4.8).

### 4.3 Modelo de datos: la migración 0006

`sql/core/0006_dimension_de_producto.sql` está escrito y probado. La prueba es `node docs/plataforma/sql/probar-core.mjs infrastructure/migraciones/core docs/plataforma/sql/core`, con Node 22.5 o posterior por `node:sqlite`.

La prueba:

- aplica las migraciones reales 0001–0005, cada una en su transacción, como `wrangler`;
- siembra los datos que escribe el código v0;
- aplica las propuestas 0006 a 0009 y hace 35 comprobaciones.

**Qué hace la 0006, tabla por tabla:**

| Tabla | Cambio | Claves e índices |
|---|---|---|
| `producto` (nueva) | `id`, `nombre`, `estado` (`activo`, `pausado`, `retirado`), `actualizado` | PK `id` (2–24 caracteres, `[a-z0-9-]`) |
| `producto_tipo` (nueva) | Tipos de organización de cada producto | PK `(producto, tipo)` |
| `producto_rol` (nueva) | Roles, con `administra` e `invitable` | PK `(producto, rol)` |
| `plan` (nueva) | Planes de cada producto; `gratuito` 0/1; `estado` | PK `(producto, id)` |
| `periodo` (nueva) | Los periodos de prepago: 1 (mensual), 3 (trimestral), 6 (semestral) y 12 (anual). Uno nuevo es un `INSERT` | PK `meses`, de 1 a 36 |
| `plan_precio` (nueva) | Precio por periodo, con `vigente_desde`; nunca se edita, entra uno nuevo | PK `(producto, plan, meses, vigente_desde)`; `meses` → `periodo`; `monto_cop ≥ 1000` |
| `celda` | + `producto` | `UNIQUE (id, producto)`, para que `organizacion` lo exija |
| `organizacion` | + `producto`, + `estado` (`activa`, `mudando`, `suspendida`, `baja`); `tipo` y `plan` sin `CHECK` | `UNIQUE (id, producto)`. FK a `(producto, tipo)`, a `(producto, plan)` y a `(celda_id, producto)`. Índice `organizacion_por_celda (producto, celda_id, shard)` para la asignación (1 fila por organización) |
| `membresia` | + `producto` | FK a `(org_id, producto)` → organización y a `(producto, rol)` → rol. Se recrea `membresia_por_finca` |
| `invitacion` | + `producto` | Las mismas dos FK |
| `interes_plan` | + `producto` | FK a la organización y al plan del producto |
| `pago` | `meses` → `periodo`; + `periodo_desde`, `periodo_hasta` (lo que cubrió el pago, escrito al aprobarlo) | FK a la organización, al plan del producto y al periodo. Se recrean `pago_org` y `pago_esperando` |
| `sesion` | + `producto` | Se recrea `sesion_por_usuario` |
| `aceptacion_politica` (nueva) | `(usuario, producto, versión, aceptada)`. Se llena con `usuario.politica_*` | PK `(usuario_id, producto, version)` |

**Compatibilidad hacia atrás (fase expandir).** Toda columna nueva trae el valor que supone el código v0: `producto = 'agro'` y `estado = 'activa'`. Entre la migración y el despliegue del Worker nuevo, el v0 sigue escribiendo sin saber que existe el producto, y la prueba lo comprueba con sus `INSERT` reales.

**Lo que la prueba demuestra** (salida del 5 oct 2026, «TODO EN VERDE»):

- Las 9 tablas conservan sus filas, `plan_vence` incluido.
- `PRAGMA foreign_key_check` vacío, `integrity_check = ok` y las claves foráneas siguen activas.
- `membresia` apunta a `organizacion` y no a una tabla intermedia `_nueva`.
- Un segundo producto entra **solo con datos**: un tipo, dos roles, dos planes, cuatro precios (uno por periodo), una celda, una organización y una membresía.
- Los cuatro periodos están sembrados, y uno nuevo (24 meses en la prueba) entra con dos `INSERT`, sin rehacer ninguna tabla (R1).
- **La guarda, con datos reales:** un pago viejo de 2 meses, que el v0 permitía con `CHECK (meses > 0)`, detiene la 0006 entera y deja la base como estaba. Sin la guarda, la migración habría pasado callada con una fila huérfana (§4.4, W4).
- Se rechazan, uno por uno:
  - un rol del agro en una tienda;
  - una membresía v0, sin producto, en una tienda;
  - una tienda con un plan del agro;
  - una tienda en una celda del agro;
  - un pago de tienda a nombre de una finca;
  - un pago por 2 meses, que no es un periodo;
  - un precio menor de COP 1.000;
  - una tienda de tipo `finca`;
  - un alcance para agentes que mueve dinero (0009);
  - un proveedor de identidad que no está en la tabla de referencia (0008, la propuesta de entrar con correo).

**Costo.** Cada fila copiada cuenta una vez por tabla y una por índice. Con el volumen de hoy (decenas de organizaciones y cientos de sesiones), la 0006 escribe unos pocos miles de filas: menos del 5 % de un día de la cuota gratuita.

### 4.4 Receta verificada para reconstruir tablas en D1

SQLite no cambia un `CHECK` ni agrega una columna con `REFERENCES` y un valor por defecto que no sea `NULL` sin rehacer la tabla. Se rehace con el procedimiento de SQLite: crear la tabla nueva, copiar, borrar la vieja y renombrar la nueva.

D1 aplica siempre las claves foráneas y solo deja **diferirlas** con `PRAGMA defer_foreign_keys`. Al probar ese camino el 5 oct 2026, con `node:sqlite` 3.50.4, apareció esto:

| Caso | Resultado |
|---|---|
| V1–V4. Rehacer una tabla padre con hijas, con o sin `defer_foreign_keys`, en cualquier orden, aunque se rehaga también la hija | **Falla al confirmar:** `FOREIGN KEY constraint failed`. Los datos están bien. El `DROP TABLE` de la padre cuenta violaciones diferidas que el `RENAME` no descuenta |
| W1. Lo mismo, apagando `defer_foreign_keys` antes de confirmar | Confirma. Apagarlo **pone en cero el contador** de violaciones diferidas (`pragma.c`: `nDeferredImmCons = 0`) |
| W2. Igual que W1, pero la copia **pierde** una fila padre: violación real | **Confirma igual, callado.** `foreign_key_check` muestra después la fila huérfana |
| W3. W1 + guarda | Confirma |
| W4. W2 + guarda | **Aborta:** `CHECK constraint failed: huerfanas = 0` |

**La receta (R5)** cierra toda migración que reconstruye una tabla:

```sql
PRAGMA defer_foreign_keys = on;
-- crear <tabla>_nueva → copiar → DROP TABLE <tabla> → ALTER TABLE <tabla>_nueva RENAME TO <tabla>
-- (nunca renombrar primero la vieja: desde SQLite 3.26 eso reescribe las FK de las hijas hacia ella)
-- recrear índices y triggers de <tabla>
PRAGMA defer_foreign_keys = off;
CREATE TABLE _guarda_fk (huerfanas INTEGER NOT NULL CHECK (huerfanas = 0));
INSERT INTO _guarda_fk (huerfanas) SELECT COUNT(*) FROM pragma_foreign_key_check;
DROP TABLE _guarda_fk;
```

- **Por qué la guarda:** sin ella, la migración que pierde datos se ve igual que la que no los pierde. Con ella, una sola fila huérfana revierte la migración entera, porque `wrangler` corre cada archivo en una transacción.
- **Ninguna FK con `ON DELETE CASCADE` (R4):** la investigación de la cuenta encontró en la documentación de D1 que `defer_foreign_keys` no impide las cascadas. El `DELETE` implícito del `DROP TABLE` borraría las hijas.
- **Verificado en el D1 local de workerd el 5 oct 2026** (HU-C2.1, `packages/d1/src/receta.test.ts`). Los cinco casos dan lo mismo que con `node:sqlite`: V1 falla al confirmar, W1 confirma, W2 confirma callado con la huérfana, W3 confirma y W4 vuelve atrás entero. D1 acepta `pragma_foreign_key_check` como función de tabla, así que la guarda va dentro de la migración y no hace falta la variante en `scripts/desplegar.ts`.
  - El mensaje de V1 en D1 es otro: «Durable Object was reset and rolled back to its last known good state because the application left the database in a state where constraints were violated: FOREIGN KEY constraint failed».
- **La guarda revisa toda la base, no solo la tabla que se rehace** (bitácora core 2). Una huérfana vieja en cualquier tabla detiene cualquier migración que lleve la guarda, aunque esa migración no pierda nada. Es lo que se quiere (P1), con una consecuencia: **antes de aplicar una migración con la guarda en producción, se corre `PRAGMA foreign_key_check` sobre la base de producción** y se resuelve lo que aparezca. Si no, la migración falla en producción por algo que no hizo, y parece culpa suya.
- **Falta staging** (P16): se comprueba al aplicar la 0006 en staging (HU-C2.2).

### 4.5 Las migraciones siguientes

Los números siguen el orden en que se construyen, no el del diseño: la auditoría llegó primero (P1 de la plataforma) y pasó a ser la 0007; entrar con correo pasó a 0008 (HU-C2.4, 6 oct 2026).

| Migración | Llega con | Qué hace |
|---|---|---|
| `0008_entrar_con_correo.sql` (era 0007) | Proveedor de correo (§4.11) | `proveedor_identidad` (`google`, `correo`) como referencia. Rehace `identidad`, que es solo hija, con la receta. Crea `enlace_correo`: huella del código, correo, producto, vuelta, 15 min, un uso. Índice `enlace_por_correo` para el tope de 3 por hora |
| `0007_auditoria.sql` (era 0008; ya en `infrastructure/migraciones/core/`, HU-C2.4) | P1 de la plataforma | `auditoria`: lo que toca seguridad o dinero (entradas, roles, pagos, concesiones a agentes), una fila por hecho. Índice parcial por organización |
| `0009_oauth_para_agentes.sql` | P5 de la plataforma (§5.4) | `alcance` (por producto, con `mueve_dinero CHECK = 0`), `cliente_oauth`, `concesion_oauth`, `codigo_oauth` (PKCE S256 obligatorio) y `refresco_oauth` (rotación y detección de reuso) |
| `00xx_contraer_*.sql` | Una versión después de que ningún código lea lo viejo | Quita `usuario.politica_*`, los `DEFAULT 'agro'` de transición y la aceptación de tokens v1 (§4.6) |

Las cuatro están en `sql/core/`. La prueba las aplica encadenadas sobre 0001–0005: «TODO EN VERDE», sin huérfanas. Además comprueba que se rechazan un alcance que mueve dinero y un proveedor de identidad desconocido.

### 4.6 Tokens v2

| Reclamo | v1 (hoy) | v2 | Para qué |
|---|---|---|---|
| `iss` | `agro-core` | `ed1-core` | El CORE es del ecosistema |
| `aud` | — | `agro`, `tienda`… (el producto de la organización) | Que el token del panel de una tienda no abra la celda del agro, ni al revés |
| `sub`, `iat`, `exp` | 12 h | Igual | — |
| `org`, `rol`, `celda`, `shard`, `anillo` | Sí | Igual | ADR-10: la celda no llama al CORE |
| `plan`, `plan_vence` | — | El plan vigente, con el vencimiento y la gracia ya aplicados | La API del producto aplica sus límites sin llamar al CORE |
| `auth_time` | — | Instante de la última entrada **interactiva** con Google o correo | Lo que mueve dinero pide una entrada reciente (TIENDA-3.0 §12) |
| `ver` | — | `2` | Las celdas distinguen sin adivinar |
| Cabecera `kid` | Sí | Igual | Rotación de la llave de firma |

**Transición, en tres versiones (P10):**

1. **N: verificar ambos.** `packages/tokens` acepta `iss` ∈ {`agro-core`, `ed1-core`}. Un token sin `aud` lo acepta **solo** una celda del producto `agro`. Sin `plan`, el plan es `gratuito`: el mínimo, dicho en el código. Se despliega en todas las celdas.
2. **N+1: emitir v2.** El CORE emite v2. Los v1 ya emitidos siguen valiendo hasta su `exp`.
3. **N+2: contraer.** Al menos 12 h después de N+1 en producción, las celdas rechazan v1. Una prueba de contrato firma tokens v1 y v2 y exige lo que acepta cada versión.

**JWKS.** Además de `/api/core/claves`, el CORE publica `/.well-known/jwks.json` con las llaves vigente y anterior en formato estándar: JWK `OKP`/`Ed25519`, RFC 7517 y RFC 8037. Lo necesitan los clientes OAuth de §5.4 y cualquier verificador que no sea nuestro.

**Sesión por producto.** `sesion.producto` se fija al entrar, según la app de origen. `POST /api/core/auth/refrescar` exige que el `Origin` sea de ese producto. Solo entrega tokens de organizaciones de ese producto: `elegirOrganizacion` filtra el directorio por producto. Un refresh robado del panel de una tienda no emite tokens del cuaderno.

### 4.7 La API del CORE, por producto

| Ruta | Hoy | v1 con producto |
|---|---|---|
| `GET /api/core/auth/google/inicio` | `vuelta` bajo `/agro/app/`; `politica` del agro | + `producto` (sin él, `agro`, mientras dure la transición). La vuelta se valida contra los orígenes y las rutas del producto. La política es la del producto. La cookie guarda el producto |
| `GET …/google/callback` · `POST …/canje` | Crea la sesión | La sesión nace con su producto. El canje lo exige del mismo origen |
| `POST /api/core/auth/refrescar` | Token de la organización pedida o de la única | Solo organizaciones del producto de la sesión |
| `POST /api/core/organizaciones` | Crea una finca (`tipo = 'finca'` fijo) | El producto sale de la sesión, nunca del cuerpo (R2). El `tipo` se valida contra `producto_tipo`. La asignación elige entre las celdas **de ese producto** |
| `POST /api/core/invitaciones[/ver\|/aceptar]` | Roles del agro; enlace a `/agro/app/unirme/` | Roles invitables del producto. El enlace es la pantalla «unirme» de la app del producto, con el código en el fragmento, como hoy (P13) |
| `POST /api/core/equipo/*` · `…/telefonos/*` | «Propietario» escrito en el código | Lo puede hacer quien tiene un rol con `administra` |
| `POST /api/core/interes[/ver]` | Planes del agro | Planes del producto de la organización |
| `POST /api/core/pago/crear` | Un mes; monto de `planes.json` del cuaderno | + `meses`: un periodo con precio vigente para ese plan (1, 3, 6 o 12). El monto sale de `plan_precio`, que el despliegue copia de `planes.json`. La referencia lleva el prefijo del producto (`tienda-<uuidv7>`) |
| `POST /api/core/pago/confirmar` · cron | Activa un mes | Activa `meses` con meses calendario (§4.8) y escribe `periodo_desde` y `periodo_hasta` |
| `POST /api/core/servicio/planes` (nueva) | — | Celda → CORE, una vez al día. Devuelve `plan` y `plan_vence` de las organizaciones de esa celda (§4.13) |
| `GET /.well-known/jwks.json` (nueva) | — | §4.6 |
| `GET /.well-known/oauth-authorization-server` y `/oauth/*` (nuevas) | — | §5.4 |

CORS: `ORIGENES_APP` pasa a ser la unión de los orígenes de todos los productos, y cada ruta comprueba además que el origen sea **del producto** de la sesión o del token.

### 4.8 Planes y cobros por periodo

1. **Prepago, sin débito automático.** Cada pago compra 1, 3, 6 o 12 meses. Bold no guarda la tarjeta y el CORE tampoco. Así funciona hoy (HU-E0.7) y así lo pide el estudio, sin débito automático (estudio ecommerce §13.4).
2. **Meses calendario en America/Bogota, no 30 días.** Hoy un mes son 30 días (`DIAS_POR_MES`). Con 12 meses serían 360: cinco días menos de lo que la persona cree que pagó.
   - `sumarMeses(desde, n)` suma meses en la fecha local de Bogotá, que no tiene horario de verano (UTC−5 fijo), y conserva la hora.
   - Si el día no existe en el mes de llegada, recorta al último día: 31 de enero + 1 mes = 28 o 29 de febrero.
   - Los pagos ya aprobados conservan su vencimiento: no se recalcula el pasado.
   - **Pruebas (P8):** 31 de enero; 29 de febrero de 2028 + 12 meses = 28 de febrero de 2029; un pago a las 18:59 y otro a las 19:01 de Bogotá; y la batería con `TZ=Pacific/Kiritimati`.
3. **Desde cuándo cuenta.** Desde el vencimiento vigente si es del **mismo plan** y aún no llegó (renovar no hace perder días), o desde ahora. Así lo hace hoy `nuevoVencimiento`.
4. **Cambiar de plan convierte lo que quedaba en días.**
   - `credito = ⌊días_restantes × precio_mensual(plan_viejo) / precio_mensual(plan_nuevo)⌋`, con el precio mensual vigente de cada uno.
   - Pasar a un plan más caro da menos días; a uno más barato, más. Desde el gratuito, cero.
   - El nuevo vencimiento es `sumarMeses(ahora, meses) + credito`.
   - **Ejemplo:** con 40 días de Finca (39.000 al mes) se paga un mes de Exportador (149.000): `⌊40 × 39.000 / 149.000⌋ = 10` días de crédito.
   - Nada se devuelve en dinero.
5. **Vencimiento y gracia.**
   - Al vencer, el directorio entrega el plan gratuito. Ya lo hace hoy.
   - Cada producto puede declarar `gracia_dias`: 0 en el agro y 7 en la tienda. Una tienda no puede dejar de vender de un día para otro porque se olvidó pagar.
   - En la gracia, el token lleva el plan pagado y la app muestra el aviso.
   - Avisos a 7 días y a 1 día del vencimiento, por correo cuando exista (§4.11). Los dispara el cron que el CORE ya tiene, no uno nuevo.
6. **Costo de cobrar** (Bold, PSE o billetera a 2,89 % + COP 900, antes del IVA de la comisión; estudio ecommerce §10.2, tarifa observada):

   | Pago | Monto | Comisión | % |
   |---|---|---|---|
   | 1 mes | 39.000 | 2.027 | 5,2 % |
   | 3 meses | 111.000 | 4.108 | 3,7 % |
   | 6 meses | 210.000 | 6.969 | 3,3 % |
   | 12 meses | 390.000 | 12.171 | 3,1 % |

   - En un año, las comisiones suman COP 24.324 con doce pagos mensuales, 16.432 con cuatro trimestrales, 13.938 con dos semestrales y 12.171 con uno anual.
   - **El plazo también es un precio** (estudio §10.2 [C4]): el depósito inmediato de Bold cuesta 3,59 % + COP 900. El CORE cobra con el depósito normal.
7. **Facturación electrónica.** No es parte de este diseño, porque no hay contador que fije la obligación (decisión 5 del dueño). El hueco queda listo:
   - `pago.periodo_desde` y `pago.periodo_hasta` dicen qué se cobró y por cuánto tiempo;
   - un adaptador `DocumentoFiscal` (como `ProveedorDePago`) puede emitirla después sin tocar el modelo;
   - el primer candidato es la facturación que Bold incluye en la cuenta de quien cobra con ellos (estudio §11.2 [C6]), antes que contratar un proveedor aparte. Falta revisar su alcance.

### 4.9 Celdas por producto

- **`celdas.json` v2:** cada celda declara su `producto` (obligatorio, con `agro` en c0) y su `cuenta`, que nombra una de `cuentas.json`: hoy siempre la principal, y la del cliente en una celda dedicada (ADR-8).
  - Los shards se llaman `<producto>_c<N>_s<k>`, como `tienda_c1_s1`. Una prueba exige que el prefijo sea el producto de su celda.
  - Los ids de celda siguen siendo `c<N>` y no se repiten entre productos: c0 es el agro y c1 la primera de la tienda.
- **Asignación por producto:**
  - `asignarUbicacion` recibe el producto y elige entre las celdas activas **de ese producto**. Las reglas siguen siendo las de hoy: la celda con menos organizaciones, después el shard con menos y las 5 primeras como pilotos.
  - Los pilotos se cuentan por producto: las 5 primeras tiendas son pilotos de la tienda, aunque ya haya fincas piloto.
- **Despliegue:**
  - `scripts/desplegar.ts` despliega por producto y, dentro de cada producto, por `anillo_despliegue`.
  - Orden: primero el CORE, porque las celdas leen su clave pública; después las celdas de cada producto; al final los sitios.
  - `generar-wrangler.ts` genera la configuración de cada Worker de cada producto desde `celdas.json` y `productos.json`.

### 4.10 Presupuestos, kill switches y vigía

| Clave (KV de flags) | Apaga | Dónde |
|---|---|---|
| `ks:core` (y `ks:agro-core` mientras dure la transición: cualquiera de las dos en `apagado` apaga) | Todo el CORE: entrar, renovar, pagar | KV de flags del CORE |
| `ks:core:<producto>` | Entrar, renovar y pagar de un producto | Ídem |
| `ks:core:pagos` | Los cobros de planes de todos los productos | Ídem |
| `ks:<producto>…` | Lo propio de cada producto (`ks:agro-cuaderno`, `ks:tienda`, `ks:tienda:<org>`, `ks:tienda-mcp`) | KV de la celda del producto |

- **Vigía con Workers Paid.** En el plan gratuito, el vigía compara contra cuotas diarias y degrada por niveles (ARQUITECTURA §8.2).
  - Con Workers Paid no hay corte: se factura. El vigía compara el consumo del mes contra lo incluido en Workers Paid, prorrateado por día, y **proyecta el costo del mes en dólares**.
  - Avisa por Telegram al 50, 75 y 90 % de lo incluido, o cuando el costo proyectado pase el **presupuesto mensual en dinero** de cada producto (`product.yaml › presupuesto.usd_mes`).
  - Con el 100 % del presupuesto en dinero aplica la degradación que el producto declare: el kill switch de una capacidad, nunca el de la venta.
- **Las alertas de facturación de Cloudflare** son la segunda red, por si el vigía falla (P1).

### 4.11 Entrar con correo (enlace mágico)

**Por qué hace falta.** El comerciante de una panadería puede no tener cuenta de Google (análisis de integración §4.2.6). ED1 §5.2 ya lo prevé.

**Flujo:**

1. `POST /api/core/auth/correo/pedir {correo, producto, vuelta, politica}`. Responde siempre lo mismo, exista o no la cuenta, para no revelar quién está registrado.
2. Envía un enlace de un solo uso, de 15 minutos, con el código en el fragmento, como las invitaciones (P13). En D1 queda solo su huella (0007).
3. La app lo canjea por POST y recibe access y refresh, igual que con Google.

**Topes:** 3 enlaces por correo por hora (índice `enlace_por_correo`) y un límite por IP con el binding de rate limiting.

**El proveedor de correo.**

- Con el plan gratuito, el servicio de correo de Cloudflare solo envía a direcciones verificadas. Con Workers Paid envía a cualquiera: 3.000 al mes incluidos, en beta pública desde abril de 2026 (investigación, por resumen).
- Por eso **el enlace mágico llega con Workers Paid** (§3.2). Si hiciera falta antes, va un proveedor externo por HTTP detrás del adaptador `CorreoTransaccional`. Ver `proveedores-de-computo.md`.
- **El correo del CORE sale de `laboratorio-digital.com`, y el de las tiendas de `laboratorio-digital.app`** (TIENDA-3.0 §15.5). Una tienda que acumule reportes de spam no afecta la entrega de los enlaces para entrar.

### 4.12 Auditoría

`auditoria` (0007) registra lo que toca seguridad o dinero: entradas, invitaciones aceptadas, cambios de rol, salidas, teléfonos retirados, pagos cerrados, cambios de plan y concesiones a agentes.

- **No registra lecturas ni refrescos**, por el presupuesto de escrituras.
- Quien administra una organización ve la auditoría de esa organización.
- Las celdas llevan su propio registro de lo que pasa dentro del producto. Por ejemplo, la tabla `registro` de la tienda (TIENDA-3.0 §5).

### 4.13 CORE ↔ celdas, fuera del camino caliente

- **Ninguna solicitud de un usuario hace que una celda llame al CORE** (ADR-10). La celda lee del token todo lo que necesita, plan incluido.
- **Una vez al día, cada celda pide al CORE** el plan de sus organizaciones: `POST /api/core/servicio/planes`. Así se entera de un pago o un vencimiento aunque nadie haya entrado al panel.
  - La solicitud va autenticada con un token de servicio de esa celda (`CELDA_SERVICE_TOKEN`, que ya está en la lista de ARQUITECTURA §7.5), comparado en tiempo constante.
  - Si falla, la celda conserva la copia anterior y avisa (P1). El plan nunca baja «por si acaso».
- **Al aprobar un pago, el CORE avisa a la celda** con el mismo token: `POST /api/servicio/plan` en la API de la celda. Si el aviso se pierde, la sincronización diaria lo corrige.

---

## 5. Preparación para agentes

El dueño pidió integrar «hasta donde lo permita el modelo» los principios que mide **isitagentready.com**, la herramienta de Cloudflare que califica de 0 a 100 qué tan listo está un sitio para agentes de IA.

**Las fuentes no se pudieron abrir el 5 oct 2026.** El proxy bloqueó isitagentready.com, blog.cloudflare.com y developers.cloudflare.com. Lo de esta sección sale de los resúmenes del buscador y de fuentes secundarias, citadas al final. Ninguna cifra de puntaje se usa para decidir.

### 5.1 Qué mide, y cómo está cultivopro.co hoy

Son 16 comprobaciones en cinco grupos. Las de comercio no puntúan en un sitio que no vende. Los niveles van de «no listo» a «Agent-Native».

| Grupo | Comprobación | Estándar | cultivopro.co hoy | Decisión |
|---|---|---|---|---|
| Descubrimiento | `robots.txt` | RFC 9309 | Sí: `Disallow: /api/` y `/agro/app/`, con `Sitemap` | Se conserva y crece (§5.3) |
| Descubrimiento | `sitemap.xml` | sitemaps.org | Sí: solo herramientas `activo` | Se agrega `lastmod` |
| Descubrimiento | Cabeceras `Link` | RFC 8288 | No | Sí, en `_headers`, estáticas (§5.3) |
| Contenido | Negociación de Markdown (`Accept: text/markdown`) | Convención (Cloudflare «Markdown for Agents») | No | Gemelos `.md` horneados. Ver la nota de §5.3 sobre el plan de la zona |
| Contenido | `llms.txt` | Propuesta llmstxt.org | No | Sí, horneado desde `content/` |
| Control de bots | Reglas para bots de IA en `robots.txt` | RFC 9309 + lista de agentes | No | Sí, explícitas por familia de agentes |
| Control de bots | Content Signals (`search`, `ai-input`, `ai-train`) | contentsignals.org | No | Sí: `search=yes, ai-input=yes, ai-train=no`, salvo que el dueño decida otra cosa (§9) |
| Control de bots | Web Bot Auth | Borrador IETF `webbotauth`; directorio en `/.well-known/http-message-signatures-directory` | No aplica | Solo si un producto **opera** un agente que visita sitios ajenos (§5.7) |
| Capacidades | MCP Server Card | Borrador SEP-2127, `/.well-known/mcp/server-card.json` (la ruta todavía puede cambiar) | No | Sí, cuando haya servidor MCP (§5.5) |
| Capacidades | Agent Skills | Borrador de descubrimiento v0.2.0, `/.well-known/agent-skills/index.json` | No | **Sí, de inmediato:** las calculadoras como habilidades (§5.3) |
| Capacidades | API Catalog | RFC 9727, `/.well-known/api-catalog` (`application/linkset+json`) | No | Sí, con las API públicas y su OpenAPI (§5.3) |
| Capacidades | OAuth / OIDC | RFC 8414 (metadatos del servidor) y RFC 9728 (recurso protegido) | No | El CORE como servidor de autorización (§5.4) |
| Comercio | x402 | HTTP 402 + stablecoins | No aplica | **No** (§5.6) |
| Comercio | MPP | HTTP 402 + Stripe/Tempo | No aplica | **No** (§5.6) |
| Comercio | UCP | Perfil en `/.well-known/ucp` | No aplica | En la tienda: preparado, sin publicar (§5.6) |
| Comercio | ACP | OpenAI + Stripe: feed de productos y checkout | No aplica | En la tienda: feed sí, checkout no (§5.6) |

### 5.2 El principio, y lo que el modelo no permite

**ED1 §3.12 (desde la v1.3), «legible por agentes»:** todo lo público de un producto se puede leer, entender y usar por un agente sin ejecutar JavaScript, sin adivinar y sin costo extra para el ecosistema.

Es la extensión natural de tres principios que ya existen:

- **Static-first (§3.10):** lo que un agente lee es estático y gratis. `llms.txt`, Markdown, habilidades, catálogos y tarjetas se hornean al publicar. Ninguno pasa por un Worker.
- **Browser-first (§3.3), del lado del agente:** una calculadora del ecosistema corre en el navegador del productor. Para un agente, la misma calculadora es una **habilidad**: la fórmula, sus rangos y sus fuentes en Markdown, y el agente calcula en su propio entorno. Costo para el ecosistema: cero.
- **Budget-first (§3.9):** lo que sí ejecuta servidor (MCP, OAuth) tiene presupuesto, límite por IP y kill switch, como cualquier producto.

**Lo que el modelo no permite, y por qué:**

| Límite | Consecuencia |
|---|---|
| Static-first prohíbe `run_worker_first` sobre páginas públicas (ED1 §3.10) | Negociar `Accept: text/markdown` en `cultivopro.co` no puede hacerlo el Worker del sitio. Las alternativas están en §5.3 |
| La zona `cultivopro.co` está en plan gratuito | El «Markdown for Agents» de Cloudflare es de los planes Pro, Business y Enterprise (resumen del buscador). Pagar un plan Pro solo para eso no se justifica hoy |
| Bold no tiene tokens de pago delegados, ni split, ni cobro iniciado por un tercero (investigación de pagos) | Ningún agente paga solo. El agente prepara el pedido y **una persona paga** (§5.6) |
| Los comercios del ICP no reciben stablecoins ni operan con Stripe en COP | x402 y MPP no aplican |
| Ley 1480, art. 50 (modificado por la Ley 2439 de 2024): resumen previo, aceptación expresa y verificable, y acuse de recibo | El paso final de una compra lo da la persona, con la evidencia guardada (TIENDA-3.0 §14) |

### 5.3 La capa estática (fase 1, costo cero)

**En `cultivopro.co`** (`apps/sitio`). Todo sale de `content/` y de los contratos `product.yaml`, en el mismo build (P2):

1. **`robots.txt` con familias de agentes.**
   - Buscadores y asistentes con enlace al sitio: `OAI-SearchBot`, `Claude-SearchBot`, `PerplexityBot`, `ChatGPT-User`, `Claude-User` y `Perplexity-User`. Permitidos en lo público.
   - Entrenamiento: `GPTBot`, `ClaudeBot`, `Google-Extended`, `CCBot`, `Applebot-Extended`, `meta-externalagent` y `Bytespider`. Según la decisión `ai-train` (§9).
   - `/api/` y `/agro/app/` siguen cerrados para todos.
   - Al final, `Content-Signal: search=yes, ai-input=yes, ai-train=no`.
   - La lista de agentes vive en `content/agentes.json`, no en el código, y una prueba compara el `robots.txt` generado con ella.
2. **`/llms.txt`.**
   - Qué es CultivoPro y para quién.
   - Las herramientas `activo`, con enlace a su gemelo `.md`.
   - La guía, la política de datos y cómo contactar.
   - Una prueba exige que todo enlace del archivo exista en el build.
3. **Gemelos en Markdown.**
   - Cada página pública tiene su `index.md` al lado de su `index.html`. Sale de los mismos `content/agro/<herramienta>/0N-*.md` que ya alimentan la página.
   - El HTML lo anuncia con `<link rel="alternate" type="text/markdown" href="…/index.md">` y con una cabecera `Link` igual.
   - **Negociar `Accept: text/markdown` sin ejecutar el Worker** se puede de dos maneras:
     - **a)** Una regla de reescritura de URL de la zona (Transform Rules), con la condición `any(http.request.headers["accept"][*] contains "text/markdown")`, que reescribe `/<ruta>/` a `/<ruta>/index.md`. Corre antes del Worker y la sirve el asset estático gratuito. Falta verificar que la reescritura dinámica esté disponible en el plan gratuito de la zona.
     - **b)** Si no lo está, el comprobador no verá la negociación y los agentes seguirán el `Link`. Se acepta: no se paga un plan Pro por eso.
4. **Cabeceras `Link`** en `_headers` (`scripts/lib/cabeceras.ts`), estáticas por ruta:
   - `rel="alternate"; type="text/markdown"` hacia el gemelo;
   - `rel="api-catalog"` (RFC 9727) en la raíz;
   - `rel="describedby"` hacia `/llms.txt`.
5. **Habilidades (Agent Skills).**
   - `/.well-known/agent-skills/index.json`, con `name`, `type: skill-md`, `description`, `url` y `sha256`. La huella se calcula en el build.
   - Primeras habilidades: `calcular-dpv` y `periodo-de-carencia`. Cada `SKILL.md` lleva la fórmula (FAO-56, ecuación 11, para el DPV), los rangos por cultivo y etapa, el ejemplo resuelto, los límites («las carencias salen de la etiqueta ICA del producto; esto no la reemplaza») y las fuentes.
   - **Solo se publica la habilidad de una herramienta `activo`.** Es la misma compuerta de la revisión agronómica que manda sobre el sitemap.
6. **`/.well-known/api-catalog`.** Hoy no hay ninguna API pública para terceros: la de la celda es del cuaderno. El catálogo se publica cuando exista la primera, que serán el servidor MCP o la API pública de una tienda. Mientras tanto no se publica vacío: un catálogo vacío es un «sí» falso (P1).
7. **`/.well-known/security.txt`** (RFC 9116): contacto y política de divulgación. No es parte del puntaje, pero un agente o una persona que encuentre un fallo necesita a quién escribirle.
8. **JSON-LD.** Hoy hay `BreadcrumbList`, `FAQPage` y `HowTo`. Se agrega `WebApplication` en cada calculadora, con `applicationCategory`, `offers` a precio 0 e `isAccessibleForFree`.

**En las tiendas**, todo lo anterior se hornea **por tienda**, con lo que decide el comercio (TIENDA-3.0 §11). Ahí sí hay negociación de Markdown, porque las tiendas ya pasan por el Worker de despacho.

**En el CORE:**

- `/.well-known/oauth-authorization-server`;
- `/.well-known/jwks.json`;
- `robots.txt` con `Disallow: /`, porque no tiene páginas para indexar.

### 5.4 El CORE como servidor de autorización OAuth 2.1 (fase 2)

Sirve para que el agente **de una persona**, por ejemplo Claude o ChatGPT con MCP, actúe en su nombre sobre su finca o su tienda, con su permiso explícito y sin contraseña. Ejemplos: «¿qué nave puedo cosechar hoy?» o «¿cuántos pedidos tengo por despachar?».

| Pieza | Diseño |
|---|---|
| Metadatos | `GET /.well-known/oauth-authorization-server` (RFC 8414): `issuer`, `authorization_endpoint`, `token_endpoint`, `registration_endpoint`, `revocation_endpoint`, `jwks_uri`, `code_challenge_methods_supported: ["S256"]`, `grant_types_supported: ["authorization_code", "refresh_token"]` y los `scopes_supported` de todos los productos |
| Registro del cliente | **Client ID Metadata Documents** (el `client_id` es una URL HTTPS con los metadatos del cliente; es lo que pide la especificación de autorización de MCP desde 2025-11-25, según conocimiento previo, sin verificar en esta sesión) y **registro dinámico** (RFC 7591) como respaldo. Tope de registros por IP. Un cliente se puede bloquear (`cliente_oauth.estado`) |
| Autorizar | `GET /oauth/authorize`. La persona entra con Google o correo, como siempre, elige la organización (solo las del producto del recurso pedido) y ve una pantalla de consentimiento: quién pide, qué alcances, sobre qué organización y hasta cuándo |
| Recurso | El parámetro `resource` (RFC 8707) es obligatorio. El token sale con `aud` = ese recurso (por ejemplo `https://mcp.laboratorio-digital.app`). Un token para el MCP de la tienda no sirve en la API del agro |
| Token | El mismo formato de §4.6, con `scope`, `azp` (el cliente) y `cnc` (la concesión), y **1 hora** de vida. Refresh rotado en cada uso; **reusar uno ya rotado revoca la concesión entera**, porque es señal de robo (`refresco_oauth.rotado`) |
| Alcances | Por producto, en la tabla `alcance` (0009). La regla está escrita en la base: `mueve_dinero = 0`. Ningún alcance de agente cambia datos de cobro, llaves de pago, números de WhatsApp ni el ambiente de cobro: eso sigue pidiendo a la persona una entrada reciente en la app (TIENDA-3.0 §12). Ejemplos: `agro:registros:leer`, `agro:registros:escribir`, `tienda:pedidos:leer`, `tienda:pedidos:estado`, `tienda:catalogo:leer`, `tienda:catalogo:escribir` |
| Revocar | `POST /oauth/revoke`. En la app, «Aplicaciones conectadas» lista las concesiones con su último uso y las retira con un toque |
| Auditoría | Conceder, usar por primera vez, revocar y detectar reuso quedan en `auditoria` (0007) |
| Recurso protegido | Cada servidor que acepta estos tokens publica `/.well-known/oauth-protected-resource` (RFC 9728), con `resource`, `authorization_servers: [<emisor del CORE>]` y `scopes_supported`. Responde `401` con `WWW-Authenticate: Bearer resource_metadata="…"` |
| Biblioteca | Se evalúa `workers-oauth-provider` (Cloudflare, MIT), que implementa el proveedor OAuth 2.1 sobre Workers. Se acepta solo si guarda en D1 (no en KV: 1.000 escrituras al día en el plan gratuito) y si su doble de prueba implementa la rotación de verdad (P17). Si no, se escribe con Arctic y `packages/tokens`, que ya existen |

### 5.5 Servidores MCP

| Servidor | Dónde | Herramientas | Autenticación | Costo y límites |
|---|---|---|---|---|
| **Tienda, público** (uno por tienda) | `https://<tienda>/mcp`, en el despacho de la tienda | `buscar_productos`, `ver_producto`, `consultar_disponibilidad`, `preparar_pedido` (deja el pedido `pendiente` y devuelve el enlace para que **la persona** lo confirme por WhatsApp o pague con Bold), `seguimiento` (con código y secreto) | Ninguna. Es lo mismo que ve un comprador | Lee lo horneado en R2, salvo disponibilidad y pedido. Límite por IP y por tienda. `ks:tienda-mcp`. Detalle en TIENDA-3.0 §13.4 |
| **Tienda, del comercio** | `https://mcp.laboratorio-digital.app` | Pedidos (listar, cambiar estado), inventario (ajustar), catálogo (crear, editar, publicar) | OAuth del CORE (§5.4), `aud` = este recurso | Presupuesto del panel. Nada que mueva dinero |
| **Cuaderno** | `https://mcp.cultivopro.co`, en c0 y con su presupuesto | Leer registros y calendario de carencias; registrar una labor o una nota | OAuth del CORE; `aud` = este recurso | El mismo protocolo de la celda: las escrituras entran como operaciones con `dispositivo = mcp:<cliente>` y pasan por la misma validación y cuarentena (P1) |

Cada servidor publica su **Server Card** (`/.well-known/mcp/server-card.json`): identidad, documentación, endpoint remoto (Streamable HTTP) y versiones del protocolo. No lista sus herramientas.

Como la ruta del borrador cambió más de una vez, el despacho también responde en la ruta que el borrador recomiende al implementar, y una prueba fija las dos.

### 5.6 Comercio agéntico: lo que sí y lo que no

| Protocolo | Qué exige | Decisión | Por qué |
|---|---|---|---|
| **x402** (Coinbase) | Pagos en stablecoins por solicitud, con HTTP 402 | No | Los comercios del ICP cobran en pesos con Bold. Un pago en criptoactivos no es un medio que la tienda pueda ofrecer |
| **MPP** (Stripe y Tempo) | HTTP 402 con `WWW-Authenticate: Payment`; pago con Stripe (tokens compartidos) o stablecoins | No | Stripe no es la pasarela de estos comercios. Se revisa si algún día una API del ecosistema se cobra por uso |
| **ACP** (OpenAI y Stripe) | Feed de productos con el formato de OpenAI, cuatro endpoints de checkout y un token de pago delegado del proveedor | **Feed sí; checkout no** | El feed se hornea gratis desde el catálogo (TIENDA-3.0 §11) y sirve también para los listados gratuitos de Google. El checkout necesita que el proveedor de pago acepte tokens delegados, y Bold no lo ofrece |
| **UCP** (Google y Shopify) | Perfil `/.well-known/ucp` con servicios, capacidades (`dev.ucp.shopping.checkout`…), manejadores de pago y llaves para firmar webhooks | **Preparado, sin publicar** | El dominio de la tienda ya separa preparar el pedido de pagarlo, y el pago se entrega a una persona. Se publica cuando UCP admita un manejador de pago disponible en Colombia, detrás de `f_ucp` por tienda. Publicar un perfil que promete un checkout que no funciona es peor que no publicarlo (P1) |

**El patrón que sí funciona hoy en Colombia: traspaso a una persona.**

1. El agente busca, consulta la disponibilidad y prepara el pedido con el MCP de la tienda.
2. Recibe un enlace `https://<tienda>/pedido/confirmar/#<token>`.
3. La persona lo abre, ve el resumen, acepta los términos y paga con Bold, o lo confirma por WhatsApp.

Así se cumple el art. 50 de la Ley 1480 (resumen, aceptación expresa y verificable, acuse de recibo). Los datos personales los escribe la persona en la página, no el agente. **Un pedido preparado por un agente no tiene datos personales hasta que la persona lo confirma.**

### 5.7 Seguridad y presupuesto de lo agéntico

- **Los agentes no apartan unidades.** Apartar pasa al tocar «Pagar», detrás de la persona (TIENDA-3.0 §7). Si no fuera así, un agente podría vaciar el inventario a punta de apartados de 15 minutos.
- **Límites:** binding de rate limiting por IP y por tienda, en `preparar_pedido`, `consultar_disponibilidad` y el registro OAuth. Topes de pedidos `pendiente` de canal `agente` por tienda y por hora.
- **Web Bot Auth, para verificar a otros.** Con el borrador de la IETF, un agente que firma sus solicitudes (RFC 9421, Ed25519, con su directorio de llaves) se puede verificar en el Worker. Se implementa como paquete opcional (`packages/web-bot-auth`) cuando el tráfico de agentes lo justifique. Su efecto es identificar al agente en `pedido.agente` y darle límites más amplios, **nunca** saltarse la persona.
- **Web Bot Auth, para firmar nosotros.** Solo si un producto opera un agente que visita sitios ajenos, como un comprobador de tiendas o un lector de precios. Entonces se publica `/.well-known/http-message-signatures-directory` y el agente firma.
- **Inyección de instrucciones.** El contenido de un comercio llega a agentes de terceros: descripciones, páginas y nombres. El horno escapa todo y no ejecuta nada (TIENDA-3.0 §11). El texto del comercio es del comercio; los términos de uso de la tienda le prohíben instrucciones dirigidas a agentes que engañen al comprador.
- **Presupuesto:** cada servidor MCP declara su presupuesto en `product.yaml` y tiene su kill switch. Apagarlo no afecta la tienda ni el cuaderno.

### 5.8 Cómo se prueba

- **`scripts/verificar-agentes.ts`** hace las 16 comprobaciones de §5.1 contra staging, sin depender de un servicio externo: pide cada archivo, valida su formato, revisa que los enlaces existan y que las huellas de las habilidades coincidan.
  - Corre en la prueba de humo del despliegue a staging.
  - Un archivo que falta o no cuadra **detiene el despliegue a producción** (P16), con el mismo informe de todas las fallas de una vez (P15).
- **Control negativo (P5):** quitar una habilidad del build o cambiar su `sha256` pone la prueba en rojo.
- **isitagentready.com** se usa como segunda opinión desde la máquina del dueño, porque el proxy de estas sesiones lo bloquea. Su número no es criterio de aceptación: lo son las comprobaciones propias.

---

## 6. Repositorio y código

### 6.1 El monorepo de la plataforma es este repositorio, renombrado

El análisis de integración (§6) proponía crear `laboratoriodigital/plataforma` y **mover** la historia con `git filter-repo` cuando la Tienda fuera el segundo consumidor. Ese momento llegó, y se corrige el cómo: **se renombra este repositorio**. El dueño eligió el nombre el 5 oct 2026: `laboratoriodigital/gestionagro` pasa a `laboratoriodigital/plataforma`, y la Tienda entra como `apps/tienda-*`.

| | Repositorio nuevo + `filter-repo` | Renombrar este |
|---|---|---|
| Historia de git | Se reescribe: cambian los hashes y las etiquetas `vX.Y.Z` | Intacta |
| Issues, PR, revisiones y bitácoras que las citan | Se quedan en el viejo | Intactos; GitHub redirige el nombre viejo |
| Ambientes `staging` y `produccion` con sus secretos | **Hay que crearlos de nuevo y volver a pegar cada secreto**: la causa 4 de la Tienda 2.0 (P12) | Intactos |
| Clones locales | Clonar de nuevo | Siguen funcionando por la redirección. Se actualiza el `remote` cuando convenga |
| Costo | Medio día, con riesgo en secretos | Minutos |

**Lo que el renombre exige, en tres partes:**

1. **En GitHub, lo hace el dueño:** Settings › General › Repository name. Desde aquí no hay herramienta para hacerlo. Los pasos, lo que hay que revisar después y lo que no se toca están en `../runbooks/renombrar-repositorio.md`.
2. **En el repositorio, ya hecho** (pull request de la reorganización de `docs/`, 5 oct 2026): `README.md`, `docs/README.md`, el `name` del `package.json` de la raíz y los comandos `gh … --repo` de los runbooks.
3. **Hecho en un pull request mecánico aparte** (5 oct 2026, el de los paquetes internos):
   - los paquetes pasaron de `@gestionagro/*` a `@ed1/*`: 137 archivos de código, con el lockfile regenerado con `pnpm`, nunca a mano;
   - `uuidv7` e `id` salieron de `@ed1/agro-schema` a un paquete neutro, `@ed1/ids`. El CORE ya no importa el paquete del agro (R2), y su Worker compilado pesa 13,7 KB menos. `@ed1/agro-schema` los reexporta, así que nada de lo que ya los importaba de ahí se rompió;
   - lo compilado salió igual salvo lo que explica el cambio: `_headers` y las configuraciones de wrangler, idénticos byte a byte; los paquetes de JavaScript, con el código de los ids reordenado.

**Lo que no se renombra nunca** (P10: hay teléfonos con la versión vieja): la base IndexedDB `gestionagro-cuaderno` y sus `gestionagro-cuaderno-<id>`, las claves `gestionagro.*` del almacenamiento local del cuaderno, los nombres de los Workers, las bases D1 y los espacios KV, la cookie `agro_oauth` y el emisor `agro-core` (este, solo con la transición de §4.6).

### 6.2 Estructura

```text
plataforma/
├── apps/
│   ├── core/                CORE (identidad, organizaciones, productos, planes, cobros, OAuth)
│   ├── sitio/ cuaderno/ api-celda/   CultivoPro (sin renombrar: los nombres de Worker y las rutas siguen)
│   ├── tienda-sitio/        Despacho de las tiendas por Host + assets comunes (TIENDA-3.0 §3)
│   ├── tienda-panel/        Panel PWA del comercio
│   └── tienda-api/          API de la celda de tiendas + horno (cola) + crons
├── packages/
│   ├── tokens/ d1/ kill-switch/ eventos/ ui/ ids/   comunes (ids/ ya existe, con uuidv7 e id)
│   ├── productos/           tipos y lectura de infrastructure/productos.json
│   ├── pagos/               ProveedorDePago (sale de apps/core: ahora lo usan el CORE y la tienda)
│   ├── cifrado/             cifrado de sobre (AES-256-GCM), índices ciegos (HMAC), rotación de KEK
│   ├── dinero/              pesos enteros, descuentos y redondeo (tabla de casos)
│   ├── agro-calc/ agro-schema/ sync/ trazabilidad/    del agro
│   └── tienda-schema/ tienda-horno/                   de la tienda
├── content/ (agro/, tienda/, marca.json, agentes.json)
├── infrastructure/ (productos.json, cuentas.json, dominios.json, celdas.json, migraciones/{core,celda,tienda,tienda-control})
├── schemas/ scripts/ tests/
└── docs/ (ecosistema/, plataforma/, agro/, tienda/, runbooks/, seguridad/)
```

`packages/pagos` se extrae ahora porque la Tienda es su segundo consumidor. Con la regla de tres (ED1 §3.11), el resto de los paquetes comunes se extrae cuando lo use el tercero.

### 6.3 CI y versiones por producto

- **CI de lo afectado.** Cada PR corre lint, typecheck y pruebas de los paquetes que cambió y de los que dependen de ellos (`pnpm --filter "...[origin/main]"`).
  - Las pruebas de repositorio corren siempre: secretos, flujos, `org_id` en consultas.
  - Objetivo: menos de 8 minutos por corrida (ARQUITECTURA §7.2). Con el repositorio privado, los minutos de Actions vuelven a ser el recurso escaso (ED1 §41).
- **Versión por producto.**
  - Hoy hay una sola versión, en el `package.json` de la raíz. Pasa a una por producto (`apps/<producto>/package.json`) y una del CORE.
  - Etiquetas `agro-vX.Y.Z`, `tienda-vX.Y.Z` y `core-vX.Y.Z`. Las `vX.Y.Z` existentes quedan como historia del agro.
  - `desplegar.yml` publica el producto cuya versión subió, por celdas y anillos, como hoy.
- **Despliegue por producto.** Cada destino carga solo los secretos de su producto (R6). El orden es CORE → celdas de cada producto → sitios (§4.9).

### 6.4 Pruebas nuevas de la plataforma

| Prueba | Qué exige | Control negativo (P5) |
|---|---|---|
| Matriz de producto | Las combinaciones inválidas de §4.3 fallan en D1 local (`getPlatformProxy`), no solo en `node:sqlite` | Quitar una FK compuesta y verla en rojo |
| Receta de reconstrucción | W1–W4 de §4.4 en D1 local | Quitar la guarda: W2 pasa y la prueba falla |
| Compatibilidad v0 | Entre migrar y desplegar, el código v0 escribe y lee | Quitar un `DEFAULT 'agro'` |
| Tokens v1/v2 | Lo que acepta cada versión de §4.6 | Aceptar un `aud` ajeno |
| `productos.json` ↔ base | Tras el despliegue, las tablas de referencia son el archivo | Editar una fila a mano |
| `planes.json` | `cobro["1"] = cobro_mensual_cop`; a más meses, el mes no sale más caro; solo periodos de `periodo`; mínimo de Bold | Un semestral más caro que seis meses |
| `dominios.json` | Todo hostname de `laboratorio-digital.app` en una configuración de Worker está declarado, y los reservados llegan a `slug_reservado` | Una ruta nueva sin declarar |
| Meses calendario | Casos de §4.8 con `TZ=America/Bogota` y `TZ=Pacific/Kiritimati` | Volver a 30 días |
| Agentes | `verificar-agentes.ts` (§5.8) | Quitar o alterar una habilidad |

---

## 7. Hoja de ruta de la plataforma

Supone las 20 horas por semana del dueño, con Claude haciendo los commits (ARQUITECTURA §13). Cada fase deja algo funcionando y en producción. Ninguna rompe lo que ya funciona. Las historias, los sprints y las fechas de estas fases están en `BACKLOG_CORE.md`, que suma el sistema de diseño y la cuenta.

| Fase | Duración estimada | Deja funcionando | Criterio de aceptación |
|---|---|---|---|
| **P0 · Preparar** | 1 semana | Paquetes `@ed1/*` y `@ed1/ids`: **hechos** (5 oct 2026). Falta `productos.json`, `cuentas.json` y `dominios.json`, con sus esquemas. El renombre del repositorio en GitHub lo hace el dueño | CI en verde. Lo generado (wrangler, `_headers`, tabla `celda`) es **idéntico byte a byte** al de antes |
| **P1 · Producto en el CORE** | 2 semanas | Migraciones 0006 y 0007 (receta probada en D1 local y staging). API con producto (expandir). Tokens N (verifican v1 y v2). Asignación por producto. Kill switches por producto | Staging con dos productos (agro y una tienda de prueba sembrada) y las pruebas de §6.4 en verde. En producción, el agro idéntico para el usuario |
| **P2 · Tokens v2 y sesión por producto** | 1 semana | N+1 (emitir v2) y N+2 (contraer, 12 h después). `cuenta.laboratorio-digital.com` con su redirección de Google | Un cuaderno instalado con la URL vieja sigue entrando y sincronizando. Un token de tienda no abre la celda del agro |
| **P3 · Planes por periodo** | 1 semana | `periodo` y `plan_precio` desde `planes.json`. Cobros de 1, 3, 6 y 12 meses. Meses calendario. Crédito al cambiar de plan. La pantalla de planes del cuaderno con los cuatro periodos | Las pruebas de reloj (P8). Un pago real de prueba de 6 meses en el ambiente de pruebas de Bold |
| **P4 · Agentes, capa estática** | 1 semana | En `cultivopro.co`: `robots.txt` con agentes y señales, `llms.txt`, gemelos `.md`, `Link`, habilidades, `security.txt` y JSON-LD. `verificar-agentes.ts` en la prueba de humo | Las comprobaciones propias en verde contra staging y producción |
| **P5 · OAuth y MCP** | 3 semanas | Migración 0009. Servidor de autorización. Consentimiento y «Aplicaciones conectadas». MCP del cuaderno (lectura). Después, el MCP del comercio (tras el M2 de la Tienda) | Un cliente MCP real conecta, lee, y su concesión se revoca. Reusar un refresh revoca la concesión |
| **P6 · Correo** | 1 semana, con Workers Paid activo (§3.2) | Adaptador de correo y 0008 (enlace mágico). Avisos de vencimiento por correo | Un enlace llega a un correo que no es de Google y entra. Un enlace usado o vencido no vuelve a servir |

**Con la Tienda 3.0** (TIENDA-3.0 §19):

- Su M0 necesita P0, P1 y Workers Paid activado en la cuenta (§3.2).
- Su M2 (panel) necesita P2.
- Cobrar su plan con 3, 6 y 12 meses necesita P3.
- Su MCP de comercio está dentro de P5.

---

## 8. Riesgos

| Riesgo | Prob. | Impacto | Mitigación |
|---|---|---|---|
| La reconstrucción de tablas se comporta distinto en D1 que en `node:sqlite` | Media | Alto | La receta se prueba en D1 local y en staging antes de producción. Respaldo: el paso de verificación en `desplegar.ts` (§4.4) y Time Travel |
| Un cuaderno viejo deja de entrar por el cambio de emisor o de URL | Media | Alto | Tres versiones de tokens (§4.6). La URL de workers.dev sigue viva: el CORE no se muda. Prueba con un token v1 real |
| Todo en una cuenta: una suspensión o un compromiso tumba todos los productos a la vez | Baja | Alto | Copia mensual cifrada fuera de Cloudflare (ED1 §20.3; `proveedores-de-computo.md` §4). Dominios con recuperación aparte (ED1 §20.3). Segundo factor y tokens por propósito. Nada de contenido arbitrario de usuarios en la cuenta (§3.5) |
| Una tienda fraudulenta hace que se marque todo `laboratorio-digital.app`, que no está en la PSL | Baja | Alto | Ficha legal antes de publicar, reporte y suspensión con un clic. Escape a un segundo nivel inscrito en la PSL (§3.4) |
| Factura sorpresa con Workers Paid (sin tope duro) | Media | Medio | Presupuesto en dinero por producto, vigía con proyección, alertas de facturación, límites de CPU y subrequests por Worker, y el WAF de la zona |
| Los borradores de agentes (Server Card, Agent Skills) cambian de ruta | Alta | Bajo | Se sirven en la ruta vigente y en la recomendada, y una prueba las fija. Son archivos horneados: cambiarlos es barato |
| Un agente abusa de los pedidos | Media | Medio | Los agentes no apartan. Límites por IP y por tienda. `ks:tienda-mcp` |
| El tiempo del dueño | Alta | Alto | Fases cortas que dejan algo en producción. La Tienda 2.0 sigue vendiendo mientras tanto |

---

## 9. Decisiones y tareas que quedan para el dueño

Ya decididas el 5 oct 2026 y fuera de esta lista: el nombre del dominio de tiendas (`laboratorio-digital.app`), qué cuenta se usa (la de siempre), los periodos (1, 3, 6 y 12 meses) y el nombre del repositorio (`plataforma`).

**Decisiones:**

1. **El presupuesto mensual en dólares** de cada producto, para cuando la cuenta tenga Workers Paid (§3.2, §4.10).
2. **`ai-train`**: si el contenido del ecosistema se ofrece para entrenar modelos (§5.3). La propuesta es `no`, que es lo que Cloudflare pone por defecto, con `search` y `ai-input` en `yes`, que es lo que da visibilidad en asistentes.
3. **Los precios de 3, 6 y 12 meses** de cada plan (§4.2, §4.8), y la gracia de la tienda (7 días propuestos).

**Tareas que solo puede hacer el dueño:**

4. **Renombrar el repositorio en GitHub** (`../runbooks/renombrar-repositorio.md`).
5. **Agregar `laboratorio-digital.app` a la cuenta como zona**, con su registrador y su correo de recuperación fuera de Cloudflare (ED1 §20.3), antes del M0 de la Tienda.
6. **Activar Workers Paid** en la cuenta cuando arranque el M0 (USD 5 al mes, en el panel de Cloudflare), y las alertas de facturación (§3.2).
7. **Escribir a Bold** (soporte.online@bold.co) para preguntar si existe un esquema para plataformas que integran en nombre de sus comercios. Hoy cada comercio entrega sus llaves, y Bold dice que la secreta no se comparte con terceros: hace falta la autorización expresa del comercio en los términos de la tienda (TIENDA-3.0 §9).

---

## 10. ADR propuestos

Pasan a `ARQUITECTURA.md` §1, con su estado. Los «aceptados» ya los decidió el dueño el 5 oct 2026.

| ADR | Decisión | Estado |
|---|---|---|
| 20 | El CORE gana la dimensión de producto: tablas de referencia, FK compuestas, sesión y token por producto (§4) | Aceptada (decisión 6 del dueño). El diseño detallado queda propuesto |
| 21 | La Tienda 3.0 entra como **excepción declarada**, diseñada desde cero sobre la plataforma. Los datos de las tiendas actuales se cargan después con scripts | Aceptada (decisión 3 y mensaje del 5 oct) |
| 22 | Planes prepagados de 1, 3, 6 y 12 meses, sin débito automático. Los periodos, en una tabla de referencia | Aceptada (decisiones 4 y 9). Meses calendario y crédito al cambiar de plan: propuesta (§4.8) |
| 23 | Una sola cuenta de Cloudflare, la de siempre, con Workers Paid desde el M0 de la Tienda. Los productos se aíslan por presupuesto, kill switch y celdas. Nunca se reparte un producto entre cuentas gratuitas (§3.1–§3.2) | Aceptada (decisión 7). Reemplaza la propuesta de la 0.1: cuentas por propósito y graduación |
| 24 | Preparación para agentes como principio: capa estática primero, OAuth y MCP después, comercio con traspaso a una persona | Propuesta (pedido del dueño) |
| 25 | Reconstruir tablas solo con la receta de §4.4, sin `ON DELETE CASCADE` y con lo que crece en tablas de referencia | Propuesta |
| 26 | El monorepo de la plataforma es este repositorio, renombrado a `laboratoriodigital/plataforma` (§6.1) | Aceptada (decisión 10). El renombre en GitHub lo hace el dueño |
| 27 | Tres dominios: `laboratorio-digital.com` (ecosistema y CORE), `laboratorio-digital.app` (tiendas y proyectos nuevos, en el primer nivel y sin PSL) y `cultivopro.co` (agro y derivados) (§3.3–§3.4) | Aceptada (decisión 8). Sin PSL por el límite de Cloudflare del 5 oct |

---

## Fuentes

Consultadas el 5 oct 2026. El proxy de la sesión bloqueó isitagentready.com, blog.cloudflare.com, developers.cloudflare.com, community.cloudflare.com y cloudflare.com. Lo marcado **(resumen)** sale del resumen del buscador sobre esa página, no de la página leída. Las cifras de Cloudflare están en `cuenta-cloudflare.md`, con su fuente una por una.

**Preparación para agentes**
- Cloudflare, *Agent Readiness score*: https://isitagentready.com/ · https://blog.cloudflare.com/agent-readiness/ (resumen). Secundarias: https://www.searchenginejournal.com/all-you-need-to-know-about-cloudflares-agent-readiness-score/ · https://nohacks.co/blog/cloudflare-agent-readiness-score (resumen).
- Markdown for Agents: https://developers.cloudflare.com/fundamentals/reference/markdown-for-agents/ · https://developers.cloudflare.com/changelog/2026-02-12-markdown-for-agents (resumen: Pro, Business, Enterprise y SSL for SaaS; no en el plan gratuito).
- Content Signals: https://contentsignals.org · https://blog.cloudflare.com/content-signals-policy (resumen).
- Web Bot Auth: https://datatracker.ietf.org/doc/html/draft-ietf-webbotauth-httpsig-protocol-00 · https://developers.cloudflare.com/bots/reference/bot-verification/web-bot-auth (resumen).
- MCP Server Card (SEP-1649 → SEP-2127, borrador): https://mcpplaygroundonline.com/blog/mcp-server-cards-well-known-discovery (secundaria, resumen).
- Descubrimiento de Agent Skills (borrador v0.2.0): https://agentskills.io/integrate-skills · https://specification.website/spec/agent-readiness/agent-skills-discovery/ (resumen).
- UCP: https://developers.google.com/merchant/ucp/guides/ucp-profile · https://shopify.engineering/ucp (resumen).
- ACP: https://stripe.com/newsroom/news/stripe-openai-instant-checkout · https://www.agenticcommerce.dev/ (resumen).
- MPP: https://developers.cloudflare.com/agents/agentic-payments/mpp (resumen).
- x402: mencionado por las fuentes de isitagentready. Su especificación no se consultó en esta sesión.

**Estándares**
- RFC 9309 (robots), RFC 8288 (Web Linking), RFC 9727 (api-catalog), RFC 8414 (metadatos del servidor de autorización), RFC 9728 (metadatos del recurso protegido), RFC 8707 (indicadores de recurso), RFC 7591 (registro dinámico), RFC 7636 (PKCE), RFC 7517 y RFC 8037 (JWK, Ed25519), RFC 9116 (security.txt), RFC 9421 (firmas de mensajes HTTP): https://www.rfc-editor.org/.
- Especificación de autorización de MCP y Client ID Metadata Documents: https://modelcontextprotocol.io/specification. Conocimiento previo, no consultado en esta sesión.

**SQLite y D1**
- SQLite, *ALTER TABLE* (procedimiento de 12 pasos y reescritura de FK al renombrar): https://www.sqlite.org/lang_altertable.html.
- SQLite, *PRAGMA defer_foreign_keys* y el contador puesto en cero al apagarlo: https://www.sqlite.org/pragma.html#pragma_defer_foreign_keys y `src/pragma.c`. Comprobado con `node:sqlite` 3.50.4: `sql/probar-core.mjs` y los casos W1–W4 de §4.4.
- D1, claves foráneas siempre activas y `defer_foreign_keys` sin efecto sobre `ON DELETE CASCADE`: https://developers.cloudflare.com/d1/sql-api/foreign-keys/ (resumen).

**Dominios y Public Suffix List**
- Cloudflare, *Onboard a domain*: el dominio de una zona tiene que estar un nivel por debajo de un sufijo de la PSL: https://developers.cloudflare.com/fundamentals/manage-domains/add-site/ (resumen).
- Comunidad de Cloudflare, *How to add a domain which is on public suffix list* y *Add a PSL domain*: un dominio de la PSL no se agrega como zona, salvo en Enterprise: https://community.cloudflare.com/t/how-to-add-a-domain-which-is-on-public-suffix-list/467396 · https://community.cloudflare.com/t/add-a-psl-public-suffix-list-domain/266190 (resumen).
- Public Suffix List, guías de la sección privada (registro TXT `_psl`, dos años de registro por delante): https://github.com/publicsuffix/list/wiki/Guidelines (resumen).
- `.app` en la lista de precarga HSTS: conocimiento previo, no consultado en esta sesión.

**Pagos y normas**
- Bold, webhooks (`x-bold-signature`), consulta de transacciones, links de pago, llaves y tarifas: ver las fuentes de TIENDA-3.0 §9.
- Ley 1581 de 2012, Decreto 1377 de 2013, Circular Externa 005 de 2017 de la SIC, Ley 1480 de 2011 y Ley 2439 de 2024: ver las fuentes de TIENDA-3.0 §14.
