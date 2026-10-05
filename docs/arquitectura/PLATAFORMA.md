# Plataforma ED1 — el CORE con dimensión de producto

**Estado:** propuesta de arquitectura, con las decisiones del dueño del 5 oct 2026 ya incorporadas
**Versión:** 0.1 · 5 oct 2026
**Alcance:** el CORE como servicio de todos los productos (identidad, organizaciones, roles, planes, cobros y directorio), las cuentas de Cloudflare, la preparación para agentes y el repositorio. El producto de comercio electrónico que se construye encima está en `TIENDA-3.0.md`, en esta carpeta.
**Documentos que manda este:** `ECOSISTEMA-DIGITAL-ED1-v1.3.md` (ED1 §N), `ARQUITECTURA.md` (ADR-N, P1–P21, §N), `analisis/cuenta-cloudflare-paga.md`, `analisis/proveedores-de-computo.md`.

> **Cómo se usa.** Este documento propone; `ARQUITECTURA.md` decide. Cada pieza pasa allí, con su ADR y su tabla en §5.4, en el mismo pull request que la implementa (P18). Hasta entonces, el diseño vive aquí. El SQL de §4 no es un borrador: está en `sql/core/`, con su prueba (`sql/probar-core.mjs`), corrida contra las migraciones reales 0001–0005 del CORE.

---

## 0. Resumen

**Lo que decidió el dueño el 5 oct 2026**, en respuesta a la validación del estudio de ecommerce (`analisis/VALIDACION-ESTUDIO-MERCADO-ECOMMERCE-ED1-2026-10.md` §5):

1. Hay dos tiendas 2.0 en operación.
2. Las palabras clave se miden, pero no bloquean este proyecto.
3. El ecommerce entra como **excepción declarada**, como el agro con ADR-2.
4. Se ofrecen **todos los periodos de plan**: mensual, trimestral y anual, prepagados.
5. Sin contador ni abogado por ahora. Todo se hace con rigor técnico.
6. **El CORE gana la dimensión de producto y queda listo para crecer.**

El mismo día pidió además:

- Integrar los principios de preparación para agentes de isitagentready.com «hasta donde lo permita el modelo».
- Diseñar la Tienda 3.0 **desde cero**. Los datos de las tiendas actuales se cargan después con scripts.

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
3. **Planes de 1, 3 y 12 meses, prepagados.**
   - Se cuentan en meses calendario en America/Bogota.
   - Cambiar de plan convierte en días lo que quedaba del anterior.
   - No hay débito automático (§4.8).
4. **Tres cuentas con un propósito declarado cada una** (§3):
   - La gratuita principal es el laboratorio de validación.
   - La paga es la plataforma comercial.
   - La segunda gratuita se declara o se cierra.
   - Un producto **gradúa** de una cuenta a otra mudando sus celdas. Nunca se reparte entre cuentas gratuitas (HA1).
5. **El CORE se queda en la cuenta principal en esta etapa**, con un dominio estable (`cuenta.laboratorio-digital.com`). Se muda a la cuenta paga cuando se cumpla un disparador escrito (§3.5).
6. **El monorepo de la plataforma es este repositorio, renombrado.** No se crea un repositorio nuevo con `git filter-repo`: renombrar conserva los secretos, los ambientes, los issues y la historia de las PR (§6). Esto corrige `analisis/integracion-tienda-ecosistema.md` §6.
7. **Preparación para agentes como principio** (se propone como ED1 §3.12):
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
| `pago.meses` | `CHECK (meses > 0)`; el código siempre escribe 1 | `CHECK (meses IN (1, 3, 12))` y precio por periodo en `plan_precio` |
| `identidad.proveedor` | `CHECK (proveedor IN ('google'))` | Clave foránea a `proveedor_identidad` (llega `correo`) |
| `usuario.politica_*` | Una política (la del agro) | `aceptacion_politica (usuario, producto, versión)` |
| `entrar.ts › vueltaPermitida` | Solo pantallas bajo `/agro/app/` | Rutas de vuelta declaradas por cada producto |
| `pagos.ts` | `planes.json` del cuaderno; vuelta bajo `/agro/app/`; referencia `agro-…` | Los planes del producto de la organización; vuelta y prefijo del producto |
| `packages/tokens` | `EMISOR = 'agro-core'`; sin `aud` | `ed1-core` con aceptación dual; `aud` = producto |
| `constantes.ts` y `politica.ts` | `PRODUCTO_CORE = 'agro-core'`; la política del agro | Kill switch del CORE y uno por producto; política por producto |

### 1.2 Restricciones que mandan sobre el diseño

- **D1 cuenta cada índice como una fila escrita** (bitácora agro, «Lo que el terreno enseñó»). Cada índice nuevo va con su costo.
- **50 consultas por invocación** en el plan gratuito y 1.000 en el pago (ED1 §41). Ningún flujo del CORE debe pasar de 30.
- **Cron Triggers: 5 por cuenta en el plan gratuito, y ya se usan 4.** Son el CORE y la API de la celda c0, en producción y en staging. Ningún producto nuevo cabe con cron propio en la cuenta principal.
- **El que se actualiza corre su versión vieja (P10).** Hay cuadernos instalados con la URL del CORE y el emisor de hoy. Todo cambio de contrato se expande, se migra y se contrae.
- **D1 aplica siempre las claves foráneas.** No se pueden apagar, solo diferir (cuenta paga, informe de investigación; ver `analisis/cuenta-cloudflare-paga.md`).

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
| **R6 · Un permiso por producto y por cuenta** | Cada producto tiene su kill switch, su presupuesto y sus credenciales. Ninguna credencial cruza cuentas si no es imprescindible | P12. Es la causa 4 de la Tienda 2.0: cuatro permisos que se pisan |

---

## 3. Cuentas, dominios y crecimiento

### 3.1 Hoy

| Cuenta | Plan | Qué aloja | Fuente |
|---|---|---|---|
| **A · ED1 principal** (`laboratoriodigital-la.workers.dev`) | Gratuito | Zonas `laboratorio-digital.com` y `cultivopro.co`. Celda c0 del agro: sitio, CORE y API, cada uno con staging. **Las dos tiendas 2.0**, que son subdominios de `laboratorio-digital.com`, y su Worker tiene que estar en la cuenta de la zona (`tienda/docs/DESPLIEGUE.md`, «Dominio propio») | `infrastructure/celdas.json` |
| **B · segunda gratuita** | Gratuito | Ningún documento de los repositorios dice qué aloja | Pendiente del dueño (§9) |
| **C · cuenta paga** | Paga (el dueño paga «algunos servicios») | No se sabe qué servicios. La lista de comprobación está en `analisis/cuenta-cloudflare-paga.md` §2 | Pendiente del dueño |

### 3.2 Propuesta: una cuenta, un propósito

```text
 CUENTA A · LABORATORIO (gratuita)          CUENTA C · PLATAFORMA (paga, Workers Paid)
 ─────────────────────────────────          ───────────────────────────────────────────
 Productos ANTES de sus umbrales             Productos que COBRAN o que ya los cumplieron
 · sitios estáticos y herramientas          · Tienda 3.0: despacho, API, panel, horno,
 · agro c0 (validación, plan gratuito)        R2, KV, colas, crons (TIENDA-3.0.md)
 · CORE (esta etapa) en                     · zona del dominio de tiendas (Cloudflare for SaaS)
   cuenta.laboratorio-digital.com           · celdas del agro cuando gradúe (c2, …)
 · tiendas 2.0 hasta que se carguen         · CORE, cuando se cumpla su disparador (§3.5)
   en la 3.0
        │                                              ▲
        └──── un producto «gradúa»: celda nueva en C, ─┘
              mudanza de organizaciones (ARQUITECTURA §6.4), retiro de la vieja

 CUENTA B (gratuita): un propósito declarado, sin producción (p. ej. pruebas de proveedores),
 o se cierra. Nunca una segunda mitad de un producto para sumar cuota.
 CUENTAS DE CLIENTES: celdas dedicadas en la cuenta del cliente (ADR-8).
```

**Por qué así:**

- **Free-first sigue valiendo para validar.** Un producto que todavía no prueba su demanda corre en la cuenta gratuita, con su presupuesto y su kill switch (ED1 §3.9).
- **Lo que cobra corre donde los límites suben pagando.** Una tienda que vende no puede quedarse sin servicio a las 19:00 porque otro producto agotó la cuota diaria de la cuenta.
  - En el plan gratuito, D1 rechaza consultas al pasar el límite hasta el reinicio de las 00:00 UTC.
  - En Workers Paid el exceso se factura en vez de cortar el servicio. Ver `analisis/cuenta-cloudflare-paga.md` §1.
- **Graduar ya está diseñado.** Mudar una organización de celda es una operación de rutina en el agro (ARQUITECTURA §6.4). Graduar un producto es aplicarla a todas sus organizaciones.

### 3.3 Reglas de gobierno

1. **Cada cuenta declara su propósito** en `infrastructure/cuentas.json`, con nombre, plan, propósito, dueño y contactos de recuperación.
   - Ningún identificador de cuenta va en ese archivo. Los identificadores siguen en los secretos de GitHub, como hoy.
   - Una prueba exige que cada celda de `celdas.json` nombre una cuenta declarada.
2. **Ningún producto se reparte entre cuentas gratuitas.** Todas las celdas de un producto en etapa gratuita van en la misma cuenta.
   - Es la lectura prudente de Cloudflare §2.2.1(c), que prohíbe esquivar cuotas (HA1).
   - El texto de los términos no se pudo volver a leer el 5 oct 2026 (egreso bloqueado): la lectura es la del 30 sep 2026 (ARQUITECTURA §6.5).
3. **La cuenta paga lleva alertas de facturación**, una por producto de uso (Workers, D1, R2, Queues, correo).
   - El presupuesto de cada producto en `product.yaml` se expresa también en dinero al mes.
   - El vigía la compara contra lo incluido en el plan (§4.10).
   - Según la investigación (sin verificar), Cloudflare no tiene un tope duro de gasto. Las alertas y el kill switch son lo único que hay.
4. **Credenciales por cuenta y por propósito:**
   - un token de despliegue por cuenta, con el alcance mínimo;
   - un token de métricas de solo lectura por cuenta;
   - un token de Cloudflare for SaaS solo con el permiso de hostnames personalizados de la zona de tiendas.
5. **Recuperación fuera de la cuenta operativa** (ED1 §20.3).
   - Segundo factor en todas las cuentas.
   - Contactos de recuperación distintos.
   - Los dominios registrados con un registrador y un correo que no dependan de la cuenta que los sirve.

### 3.4 Graduar un producto (gratuita → paga)

**Disparadores.** Gradúa con el primero que se cumpla:

- su consumo pasa el 50 % de su presupuesto declarado 7 días seguidos;
- entra su primer cliente que paga;
- necesita algo que solo da la cuenta paga: cron propio, colas con retención, CPU de más de 10 ms o correo a cualquier destinatario.

**Procedimiento:**

1. Agregar en `celdas.json` una celda nueva en la cuenta C, con estado `activa`. La celda vieja queda `fuera` para organizaciones nuevas.
2. Desplegar. La asignación pone las organizaciones nuevas en la celda nueva (§4.9).
3. Mudar las organizaciones existentes con el procedimiento de ARQUITECTURA §6.4: congelar, exportar, importar, verificar con recuentos y huellas, conmutar y retirar. Se mudan por anillos: primero los pilotos.
4. Cuando la celda vieja no tiene organizaciones durante 30 días, se retira. Sus bases se exportan a R2 antes de borrarlas (P21).

**El agro hoy:** la etapa B de ARQUITECTURA §6.3 dice «la cuenta de c0 pasa a Workers Paid, o se abre una cuenta paga propia del agro». Con la cuenta C, la etapa B es **graduar a C**. No hace falta una suscripción nueva: comparte los USD 5 de C.

### 3.5 Dónde vive cada pieza, por etapa

| Pieza | T0 · hoy | T1 · Tienda 3.0 en construcción | T2 · tiendas cargadas | T3 · consolidación |
|---|---|---|---|---|
| CORE | A (`agro-core` en workers.dev) | A, con `cuenta.laboratorio-digital.com` y dimensión de producto | A | **C**, cuando se cumpla el disparador del CORE |
| Agro (sitio y celda) | A (c0) | A | A | A o **C** (graduado, §3.4) |
| Tienda 3.0 (despacho, API, panel, celdas) | — | **C** (c1) | C | C |
| Zona de tiendas (dominio aparte) | — | **C** | C | C |
| Tiendas 2.0 | A | A (siguen vendiendo) | Retiradas tras la carga y 30 días sin volver atrás | — |
| Zona `laboratorio-digital.com` | A | A | A | **C** (cuando ya no sirva Workers de A) |

**Disparador del CORE.** El CORE se muda a C con el primero que se cumpla:

- **la cuenta A pasa el 50 % de cualquier cuota diaria 7 días seguidos.** Así se mide la etapa B, y un CORE caído deja sin entrada a todos los productos;
- **el CORE necesita algo que solo da C**: otro cron, colas para el correo o más de 50 consultas por invocación;
- **la tienda tiene más de 20 comercios activos.** Su panel depende del CORE para entrar y renovar.

**Cómo se muda el CORE sin cerrar sesiones:**

1. **La llave de firma.** La privada no sale de su Worker (ARQUITECTURA §7.5). El CORE nuevo nace con otra, y publica la del viejo como `anterior` en `/api/core/claves`. Las celdas aceptan las dos por `kid` (`verificarConClaves`), y los access tokens viejos valen hasta su vencimiento: 12 h.
2. **Los datos.** `wrangler d1 export` del CORE viejo e importación en el nuevo, con 2 minutos de escrituras en pausa. Se pausa con un kill switch de mantenimiento: entrar y renovar responden 503 con `Retry-After`, y el cuaderno sigue registrando sin señal.
3. **La dirección.** Los clientes nuevos usan `cuenta.laboratorio-digital.com` desde T1. Los cuadernos instalados con la URL de workers.dev llegan a un **Worker puente** en A, que reenvía `/api/core/*` al nuevo. El puente vive hasta que la versión mínima de la app (`APP_MINIMA`) ya no use la URL vieja, y como mínimo 90 días.
4. **El dominio estable.** Mientras la zona `laboratorio-digital.com` siga en A, el Worker del CORE en C no puede tomarla como Custom Domain: Cloudflare exige que la zona esté en la misma cuenta. Hay dos caminos:
   - mudar la zona a C (T3; exige cambiar los servidores de nombres en el registrador);
   - servir `cuenta.laboratorio-digital.com` como hostname personalizado de la zona SaaS de C, que es O2O porque la zona de A también está en Cloudflare.

   Se elige en el momento. Cualquiera de los dos se prueba primero en staging (P16).

### 3.6 Dominios

| Dominio | Para qué | Dónde | Regla |
|---|---|---|---|
| `laboratorio-digital.com` | El ecosistema: sitio principal y CORE (`cuenta.`) | Zona en A (T0–T2) | Nunca sirve contenido de comercios ni de usuarios ([V10], ED1 §14.1). Las tiendas 2.0 que hoy viven ahí son la excepción heredada y salen en T2, con redirección 301 a su dirección nueva |
| `cultivopro.co` | El agro (ADR-19) | Zona en A | — |
| **Dominio de tiendas** (por registrar; el dueño elige el nombre) | Las tiendas sin dominio propio: `<slug>.<dominio de tiendas>`. Además: el panel (`panel.`), las imágenes (`img.`) y el origen de respaldo de Cloudflare for SaaS | Zona en **C** | Un dominio registrable aparte, que se pide incluir en la **Public Suffix List**. Así cada tienda es su propio «sitio» para el navegador: no comparte cookies, y la reputación de una no arrastra a las demás |
| Dominios de los comercios | La tienda en el dominio del comercio | DNS del comercio; hostname personalizado en la zona de tiendas de C | `www` como canónico. El dominio raíz, solo si el DNS del comercio hace CNAME flattening; si no, se redirige desde su proveedor. El «apex proxying» de Cloudflare es de Enterprise. Detalle en TIENDA-3.0 §4 |

---

## 4. El CORE con dimensión de producto

### 4.1 Modelo conceptual

```text
 producto ─┬─< producto_tipo        (agro: finca, asesor, cadena · tienda: comercio)
           ├─< producto_rol         (agro: propietario…auditor · tienda: propietario, colaborador)
           ├─< plan ──< plan_precio (por periodo: 1, 3, 12 meses; con historia)
           ├─< celda                (cada celda es de un producto)
           └─< aceptacion_politica  (cada producto, su política)

 organizacion (producto, tipo, plan, plan_vence, estado, celda, shard, anillo)
   ├─< membresia  (usuario × organización, con un rol DEL producto de la organización)
   ├─< invitacion (rol del producto)
   ├─< interes_plan, pago (plan del producto; meses ∈ {1, 3, 12})
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
        "origenes": { "produccion": "https://panel.<dominio de tiendas>", "staging": "https://tienda-panel-staging.<cuenta C>.workers.dev" },
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
    "cobro": { "1": 39000, "3": 111000, "12": 390000 } }
  ```

  Mientras existan los dos campos, una prueba exige que `cobro["1"]` sea igual a `cobro_mensual_cop`. También exige que `cobro["3"] ≤ 3 × cobro["1"]`, que `cobro["12"] ≤ 12 × cobro["1"]` y que todo monto sea un entero ≥ 1.000, el mínimo de Bold. `planes.test.ts` no cambia: ata el `precio` visible al estudio, no a `cobro`.

  Los montos de 3 y 12 meses los fija el dueño. Los del ejemplo son una propuesta: 5 % menos en el trimestre y «dos meses de regalo» en el año, redondeados a miles (§4.8).

### 4.3 Modelo de datos: la migración 0006

`sql/core/0006_dimension_de_producto.sql` está escrito y probado. La prueba es `node docs/arquitectura/sql/probar-core.mjs infrastructure/migraciones/core docs/arquitectura/sql/core`, con Node 22.5 o posterior por `node:sqlite`.

La prueba:

- aplica las migraciones reales 0001–0005, cada una en su transacción, como `wrangler`;
- siembra los datos que escribe el código v0;
- aplica las propuestas 0006 a 0009 y hace 29 comprobaciones.

**Qué hace la 0006, tabla por tabla:**

| Tabla | Cambio | Claves e índices |
|---|---|---|
| `producto` (nueva) | `id`, `nombre`, `estado` (`activo`, `pausado`, `retirado`), `actualizado` | PK `id` (2–24 caracteres, `[a-z0-9-]`) |
| `producto_tipo` (nueva) | Tipos de organización de cada producto | PK `(producto, tipo)` |
| `producto_rol` (nueva) | Roles, con `administra` e `invitable` | PK `(producto, rol)` |
| `plan` (nueva) | Planes de cada producto; `gratuito` 0/1; `estado` | PK `(producto, id)` |
| `plan_precio` (nueva) | Precio por periodo, con `vigente_desde`; nunca se edita, entra uno nuevo | PK `(producto, plan, meses, vigente_desde)`; `meses ∈ {1,3,12}`; `monto_cop ≥ 1000` |
| `celda` | + `producto` | `UNIQUE (id, producto)`, para que `organizacion` lo exija |
| `organizacion` | + `producto`, + `estado` (`activa`, `mudando`, `suspendida`, `baja`); `tipo` y `plan` sin `CHECK` | `UNIQUE (id, producto)`. FK a `(producto, tipo)`, a `(producto, plan)` y a `(celda_id, producto)`. Índice `organizacion_por_celda (producto, celda_id, shard)` para la asignación (1 fila por organización) |
| `membresia` | + `producto` | FK a `(org_id, producto)` → organización y a `(producto, rol)` → rol. Se recrea `membresia_por_finca` |
| `invitacion` | + `producto` | Las mismas dos FK |
| `interes_plan` | + `producto` | FK a la organización y al plan del producto |
| `pago` | `meses ∈ {1,3,12}`; + `periodo_desde`, `periodo_hasta` (lo que cubrió el pago, escrito al aprobarlo) | FK a la organización y al plan del producto. Se recrean `pago_org` y `pago_esperando` |
| `sesion` | + `producto` | Se recrea `sesion_por_usuario` |
| `aceptacion_politica` (nueva) | `(usuario, producto, versión, aceptada)`. Se llena con `usuario.politica_*` | PK `(usuario_id, producto, version)` |

**Compatibilidad hacia atrás (fase expandir).** Toda columna nueva trae el valor que supone el código v0: `producto = 'agro'` y `estado = 'activa'`. Entre la migración y el despliegue del Worker nuevo, el v0 sigue escribiendo sin saber que existe el producto, y la prueba lo comprueba con sus `INSERT` reales.

**Lo que la prueba demuestra** (salida del 5 oct 2026, «TODO EN VERDE»):

- Las 9 tablas conservan sus filas, `plan_vence` incluido.
- `PRAGMA foreign_key_check` vacío, `integrity_check = ok` y las claves foráneas siguen activas.
- `membresia` apunta a `organizacion` y no a una tabla intermedia `_nueva`.
- Un segundo producto entra **solo con datos**: un tipo, dos roles, dos planes, tres precios, una celda, una organización y una membresía.
- Se rechazan, uno por uno:
  - un rol del agro en una tienda;
  - una membresía v0, sin producto, en una tienda;
  - una tienda con un plan del agro;
  - una tienda en una celda del agro;
  - un pago de tienda a nombre de una finca;
  - un pago por 2 meses;
  - un precio menor de COP 1.000;
  - una tienda de tipo `finca`.

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
- **Ninguna FK con `ON DELETE CASCADE` (R4):** la investigación de la cuenta paga encontró en la documentación de D1 que `defer_foreign_keys` no impide las cascadas. El `DELETE` implícito del `DROP TABLE` borraría las hijas.
- **Falta verificar en D1 (P17):** el instrumento fue `node:sqlite`, no D1.
  - Antes de aplicar la 0006 en staging, una prueba con `getPlatformProxy` (el D1 local de `packages/d1`) corre W1–W4.
  - Comprueba que D1 acepte `pragma_foreign_key_check` como función de tabla y que apagar el pragma ponga el contador en cero igual.
  - Si D1 no acepta la función de tabla, la guarda se reemplaza por un paso de `scripts/desplegar.ts`: correr `PRAGMA foreign_key_check` después de migrar y detener el despliegue si devuelve filas.
  - Esa variante es peor, porque la migración ya quedó aplicada. Por eso se prueba primero.

### 4.5 Las migraciones siguientes

| Migración | Llega con | Qué hace |
|---|---|---|
| `0007_entrar_con_correo.sql` | Proveedor de correo (§4.11) | `proveedor_identidad` (`google`, `correo`) como referencia. Rehace `identidad`, que es solo hija, con la receta. Crea `enlace_correo`: huella del código, correo, producto, vuelta, 15 min, un uso. Índice `enlace_por_correo` para el tope de 3 por hora |
| `0008_auditoria.sql` | P1 de la plataforma | `auditoria`: lo que toca seguridad o dinero (entradas, roles, pagos, concesiones a agentes), una fila por hecho. Índice parcial por organización |
| `0009_oauth_para_agentes.sql` | P5 de la plataforma (§5.4) | `alcance` (por producto, con `mueve_dinero CHECK = 0`), `cliente_oauth`, `concesion_oauth`, `codigo_oauth` (PKCE S256 obligatorio) y `refresco_oauth` (rotación y detección de reuso) |
| `00xx_contraer_*.sql` | Una versión después de que ningún código lea lo viejo | Quita `usuario.politica_*`, los `DEFAULT 'agro'` de transición y la aceptación de tokens v1 (§4.6) |

Las cuatro están en `sql/core/`. La prueba las aplica encadenadas sobre 0001–0005: «TODO EN VERDE», sin huérfanas. Además comprueba que se rechaza un alcance que mueve dinero y un proveedor de identidad desconocido.

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
| Cabecera `kid` | Sí | Igual | Rotación y mudanza del CORE (§3.5) |

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
| `POST /api/core/pago/crear` | Un mes; monto de `planes.json` del cuaderno | + `meses` ∈ {1, 3, 12}. El monto sale de `plan_precio` vigente, que el despliegue copia de `planes.json`. La referencia lleva el prefijo del producto (`tienda-<uuidv7>`) |
| `POST /api/core/pago/confirmar` · cron | Activa un mes | Activa `meses` con meses calendario (§4.8) y escribe `periodo_desde` y `periodo_hasta` |
| `POST /api/core/servicio/planes` (nueva) | — | Celda → CORE, una vez al día. Devuelve `plan` y `plan_vence` de las organizaciones de esa celda (§4.13) |
| `GET /.well-known/jwks.json` (nueva) | — | §4.6 |
| `GET /.well-known/oauth-authorization-server` y `/oauth/*` (nuevas) | — | §5.4 |

CORS: `ORIGENES_APP` pasa a ser la unión de los orígenes de todos los productos, y cada ruta comprueba además que el origen sea **del producto** de la sesión o del token.

### 4.8 Planes y cobros por periodo

1. **Prepago, sin débito automático.** Cada pago compra 1, 3 o 12 meses. Bold no guarda la tarjeta y el CORE tampoco. Así funciona hoy (HU-E0.7) y así lo pide el estudio, sin débito automático (estudio ecommerce §13.4).
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
6. **Costo de cobrar** (Bold, PSE o billetera a 2,89 % + COP 900; estudio ecommerce §10.2, tarifa observada):

   | Pago | Monto | Comisión | % |
   |---|---|---|---|
   | 1 mes | 39.000 | 2.027 | 5,2 % |
   | 3 meses | 111.000 | 4.108 | 3,7 % |
   | 12 meses | 390.000 | 12.171 | 3,1 % |

   En un año, doce pagos mensuales cuestan COP 24.324 en comisiones. Uno anual cuesta 12.171.
7. **Facturación electrónica.** No es parte de este diseño, porque no hay contador que fije la obligación (decisión 5 del dueño). El hueco queda listo:
   - `pago.periodo_desde` y `pago.periodo_hasta` dicen qué se cobró y por cuánto tiempo;
   - un adaptador `DocumentoFiscal` (como `ProveedorDePago`) puede emitirla después sin tocar el modelo.

### 4.9 Celdas por producto

- **`celdas.json` v2:** cada celda declara su `producto` (obligatorio, con `agro` en c0) y su `cuenta`, que nombra una de `cuentas.json`.
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
| `ks:core` (y `ks:agro-core` mientras dure la transición: cualquiera de las dos en `apagado` apaga) | Todo el CORE: entrar, renovar, pagar | KV de la cuenta del CORE |
| `ks:core:<producto>` | Entrar, renovar y pagar de un producto | Ídem |
| `ks:core:pagos` | Los cobros de planes de todos los productos | Ídem |
| `ks:<producto>…` | Lo propio de cada producto (`ks:agro-cuaderno`, `ks:tienda`, `ks:tienda:<org>`, `ks:tienda-mcp`) | KV de la celda del producto |

- **Vigía en la cuenta paga.** En la cuenta gratuita el vigía compara contra cuotas diarias y degrada por niveles (ARQUITECTURA §8.2).
  - En la cuenta paga no hay corte: se factura. El vigía compara el consumo del mes contra lo incluido en Workers Paid, prorrateado por día, y **proyecta el costo del mes en dólares**.
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

- En la cuenta gratuita, el servicio de correo de Cloudflare solo envía a direcciones verificadas. En la paga envía a cualquiera: 3.000 al mes incluidos, en beta pública desde abril de 2026 (investigación, por resumen).
- Por eso el enlace mágico es un **disparador para mudar el CORE a C** (§3.5). La alternativa, mientras tanto, es un proveedor externo por HTTP detrás del adaptador `CorreoTransaccional`. Ver `analisis/proveedores-de-computo.md`.

### 4.12 Auditoría

`auditoria` (0008) registra lo que toca seguridad o dinero: entradas, invitaciones aceptadas, cambios de rol, salidas, teléfonos retirados, pagos cerrados, cambios de plan y concesiones a agentes.

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

**ED1 §3.12 (propuesto), «legible por agentes»:** todo lo público de un producto se puede leer, entender y usar por un agente sin ejecutar JavaScript, sin adivinar y sin costo extra para el ecosistema.

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
| Recurso | El parámetro `resource` (RFC 8707) es obligatorio. El token sale con `aud` = ese recurso (por ejemplo `https://mcp.<dominio de tiendas>`). Un token para el MCP de la tienda no sirve en la API del agro |
| Token | El mismo formato de §4.6, con `scope`, `azp` (el cliente) y `cnc` (la concesión), y **1 hora** de vida. Refresh rotado en cada uso; **reusar uno ya rotado revoca la concesión entera**, porque es señal de robo (`refresco_oauth.rotado`) |
| Alcances | Por producto, en la tabla `alcance` (0009). La regla está escrita en la base: `mueve_dinero = 0`. Ningún alcance de agente cambia datos de cobro, llaves de pago, números de WhatsApp ni el ambiente de cobro: eso sigue pidiendo a la persona una entrada reciente en la app (TIENDA-3.0 §12). Ejemplos: `agro:registros:leer`, `agro:registros:escribir`, `tienda:pedidos:leer`, `tienda:pedidos:estado`, `tienda:catalogo:leer`, `tienda:catalogo:escribir` |
| Revocar | `POST /oauth/revoke`. En la app, «Aplicaciones conectadas» lista las concesiones con su último uso y las retira con un toque |
| Auditoría | Conceder, usar por primera vez, revocar y detectar reuso quedan en `auditoria` (0008) |
| Recurso protegido | Cada servidor que acepta estos tokens publica `/.well-known/oauth-protected-resource` (RFC 9728), con `resource`, `authorization_servers: [<emisor del CORE>]` y `scopes_supported`. Responde `401` con `WWW-Authenticate: Bearer resource_metadata="…"` |
| Biblioteca | Se evalúa `workers-oauth-provider` (Cloudflare, MIT), que implementa el proveedor OAuth 2.1 sobre Workers. Se acepta solo si guarda en D1 (no en KV: 1.000 escrituras al día en el plan gratuito) y si su doble de prueba implementa la rotación de verdad (P17). Si no, se escribe con Arctic y `packages/tokens`, que ya existen |

### 5.5 Servidores MCP

| Servidor | Dónde | Herramientas | Autenticación | Costo y límites |
|---|---|---|---|---|
| **Tienda, público** (uno por tienda) | `https://<tienda>/mcp`, en el despacho de la tienda | `buscar_productos`, `ver_producto`, `consultar_disponibilidad`, `preparar_pedido` (deja el pedido `pendiente` y devuelve el enlace para que **la persona** lo confirme por WhatsApp o pague con Bold), `seguimiento` (con código y secreto) | Ninguna. Es lo mismo que ve un comprador | Lee lo horneado en R2, salvo disponibilidad y pedido. Límite por IP y por tienda. `ks:tienda-mcp`. Detalle en TIENDA-3.0 §13.4 |
| **Tienda, del comercio** | `https://mcp.<dominio de tiendas>` | Pedidos (listar, cambiar estado), inventario (ajustar), catálogo (crear, editar, publicar) | OAuth del CORE (§5.4), `aud` = este recurso | Presupuesto del panel. Nada que mueva dinero |
| **Cuaderno** | `https://mcp.cultivopro.co` (cuando el agro gradúe, o en c0 con su presupuesto) | Leer registros y calendario de carencias; registrar una labor o una nota | OAuth del CORE; `aud` = este recurso | El mismo protocolo de la celda: las escrituras entran como operaciones con `dispositivo = mcp:<cliente>` y pasan por la misma validación y cuarentena (P1) |

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

El análisis de integración (§6) proponía crear `laboratoriodigital/plataforma` y **mover** la historia con `git filter-repo` cuando la Tienda fuera el segundo consumidor. Ese momento llegó. Se corrige el cómo: **se renombra este repositorio**, por ejemplo a `laboratoriodigital/plataforma`, y la Tienda entra como `apps/tienda-*`.

| | Repositorio nuevo + `filter-repo` | Renombrar este |
|---|---|---|
| Historia de git | Se reescribe: cambian los hashes y las etiquetas `vX.Y.Z` | Intacta |
| Issues, PR, revisiones y bitácoras que las citan | Se quedan en el viejo | Intactos; GitHub redirige el nombre viejo |
| Ambientes `staging` y `produccion` con sus secretos | **Hay que crearlos de nuevo y volver a pegar cada secreto**: la causa 4 de la Tienda 2.0 (P12) | Intactos |
| Clones locales | Clonar de nuevo | Siguen funcionando por la redirección. Se actualiza el `remote` cuando convenga |
| Costo | Medio día, con riesgo en secretos | Minutos |

**Lo que el renombre exige**, en un solo PR mecánico al empezar P0:

1. Los paquetes pasan de `@gestionagro/*` a `@ed1/*`, con reemplazo en todo el repositorio y el lockfile regenerado con `pnpm`, nunca a mano.
2. `uuidv7` e `id` salen de `@gestionagro/agro-schema` a un paquete neutro (`@ed1/ids`). Hoy el CORE importa un paquete del agro (R2).
3. `README.md` y `docs/README.md` nombran la plataforma y sus productos.

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
│   ├── tokens/ d1/ kill-switch/ eventos/ ui/ ids/   comunes
│   ├── productos/           tipos y lectura de infrastructure/productos.json
│   ├── pagos/               ProveedorDePago (sale de apps/core: ahora lo usan el CORE y la tienda)
│   ├── cifrado/             cifrado de sobre (AES-256-GCM), índices ciegos (HMAC), rotación de KEK
│   ├── dinero/              pesos enteros, descuentos y redondeo (tabla de casos)
│   ├── agro-calc/ agro-schema/ sync/ trazabilidad/    del agro
│   └── tienda-schema/ tienda-horno/                   de la tienda
├── content/ (agro/, tienda/, marca.json, agentes.json)
├── infrastructure/ (productos.json, cuentas.json, celdas.json, migraciones/{core,celda,tienda,tienda-control})
├── schemas/ scripts/ tests/ docs/ (arquitectura/, runbooks/, …)
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
- **Despliegue por producto y por cuenta.** Cada destino carga solo los secretos de su cuenta y su producto (R6). El orden es CORE → celdas de cada producto → sitios (§4.9).

### 6.4 Pruebas nuevas de la plataforma

| Prueba | Qué exige | Control negativo (P5) |
|---|---|---|
| Matriz de producto | Las combinaciones inválidas de §4.3 fallan en D1 local (`getPlatformProxy`), no solo en `node:sqlite` | Quitar una FK compuesta y verla en rojo |
| Receta de reconstrucción | W1–W4 de §4.4 en D1 local | Quitar la guarda: W2 pasa y la prueba falla |
| Compatibilidad v0 | Entre migrar y desplegar, el código v0 escribe y lee | Quitar un `DEFAULT 'agro'` |
| Tokens v1/v2 | Lo que acepta cada versión de §4.6 | Aceptar un `aud` ajeno |
| `productos.json` ↔ base | Tras el despliegue, las tablas de referencia son el archivo | Editar una fila a mano |
| `planes.json` | `cobro["1"] = cobro_mensual_cop`, cotas por periodo, mínimo de Bold | Un trimestral más caro que tres meses |
| Meses calendario | Casos de §4.8 con `TZ=America/Bogota` y `TZ=Pacific/Kiritimati` | Volver a 30 días |
| Agentes | `verificar-agentes.ts` (§5.8) | Quitar o alterar una habilidad |

---

## 7. Hoja de ruta de la plataforma

Supone las 20 horas por semana del dueño, con Claude haciendo los commits (ARQUITECTURA §13). Cada fase deja algo funcionando y en producción. Ninguna rompe lo que ya funciona.

| Fase | Duración estimada | Deja funcionando | Criterio de aceptación |
|---|---|---|---|
| **P0 · Preparar** | 1 semana | Renombre del repositorio y de `@ed1/*`, `@ed1/ids`, `productos.json`, `cuentas.json` y sus esquemas. Cuenta C revisada (`analisis/cuenta-cloudflare-paga.md` §2) | CI en verde. Lo generado (wrangler, `_headers`, tabla `celda`) es **idéntico byte a byte** al de antes |
| **P1 · Producto en el CORE** | 2 semanas | Migraciones 0006 y 0008 (receta probada en D1 local y staging). API con producto (expandir). Tokens N (verifican v1 y v2). Asignación por producto. Kill switches por producto | Staging con dos productos (agro y una tienda de prueba sembrada) y las pruebas de §6.4 en verde. En producción, el agro idéntico para el usuario |
| **P2 · Tokens v2 y sesión por producto** | 1 semana | N+1 (emitir v2) y N+2 (contraer, 12 h después). `cuenta.laboratorio-digital.com` con su redirección de Google | Un cuaderno instalado con la URL vieja sigue entrando y sincronizando. Un token de tienda no abre la celda del agro |
| **P3 · Planes por periodo** | 1 semana | `plan_precio` desde `planes.json`. Cobros de 1, 3 y 12 meses. Meses calendario. Crédito al cambiar de plan. La pantalla de planes del cuaderno con los tres periodos | Las pruebas de reloj (P8). Un pago real de prueba de 3 meses en el ambiente de pruebas de Bold |
| **P4 · Agentes, capa estática** | 1 semana | En `cultivopro.co`: `robots.txt` con agentes y señales, `llms.txt`, gemelos `.md`, `Link`, habilidades, `security.txt` y JSON-LD. `verificar-agentes.ts` en la prueba de humo | Las comprobaciones propias en verde contra staging y producción |
| **P5 · OAuth y MCP** | 3 semanas | Migración 0009. Servidor de autorización. Consentimiento y «Aplicaciones conectadas». MCP del cuaderno (lectura). Después, el MCP del comercio (tras el M2 de la Tienda) | Un cliente MCP real conecta, lee, y su concesión se revoca. Reusar un refresh revoca la concesión |
| **P6 · Correo y mudanza del CORE** | Cuando se cumpla el disparador (§3.5) | Adaptador de correo, 0007 (enlace mágico) y procedimiento de §3.5 | Simulacro completo en staging antes de producción (P16) |

**Con la Tienda 3.0** (TIENDA-3.0 §19):

- Su M0 necesita P0 y P1.
- Su M2 (panel) necesita P2.
- Cobrar su plan con 3 y 12 meses necesita P3.
- Su MCP de comercio está dentro de P5.

---

## 8. Riesgos

| Riesgo | Prob. | Impacto | Mitigación |
|---|---|---|---|
| La reconstrucción de tablas se comporta distinto en D1 que en `node:sqlite` | Media | Alto | La receta se prueba en D1 local y en staging antes de producción. Respaldo: el paso de verificación en `desplegar.ts` (§4.4) y Time Travel |
| Un cuaderno viejo deja de entrar por el cambio de emisor o de URL | Media | Alto | Tres versiones de tokens (§4.6). La URL de workers.dev sigue viva (puente si el CORE se muda). Prueba con un token v1 real |
| Concentrar productos en la cuenta C sube el riesgo de que una suspensión los tumbe todos | Baja | Alto | Exportaciones semanales fuera de Cloudflare (`analisis/proveedores-de-computo.md` §4). Dominios con recuperación aparte (ED1 §20.3). El agro se queda en A mientras no gradúe |
| Factura sorpresa en la cuenta paga (sin tope duro) | Media | Medio | Presupuesto en dinero por producto, vigía con proyección, alertas de facturación, límites de CPU y subrequests por Worker, y el WAF de la zona |
| Los borradores de agentes (Server Card, Agent Skills) cambian de ruta | Alta | Bajo | Se sirven en la ruta vigente y en la recomendada, y una prueba las fija. Son archivos horneados: cambiarlos es barato |
| Un agente abusa de los pedidos | Media | Medio | Los agentes no apartan. Límites por IP y por tienda. `ks:tienda-mcp` |
| El tiempo del dueño | Alta | Alto | Fases cortas que dejan algo en producción. La Tienda 2.0 sigue vendiendo mientras tanto |

---

## 9. Decisiones que quedan para el dueño

1. **El nombre del dominio de tiendas** (§3.6), para registrarlo en la cuenta C y pedir su inclusión en la Public Suffix List.
2. **El propósito de la cuenta B**, o cerrarla (§3.2).
3. **Qué servicios paga hoy la cuenta C**, con la lista de `analisis/cuenta-cloudflare-paga.md` §2, y si se activa Workers Paid en ella.
4. **El presupuesto mensual en dólares** de cada producto en la cuenta C (§4.10).
5. **`ai-train`**: si el contenido del ecosistema se ofrece para entrenar modelos (§5.3). La propuesta es `no`, que es lo que Cloudflare pone por defecto. `search` y `ai-input` en `yes`, que es lo que da visibilidad en asistentes.
6. **Los precios de 3 y 12 meses** de cada plan (§4.2, §4.8), y la gracia de la tienda (7 días propuestos).
7. **El nombre nuevo del repositorio** (§6.1).
8. **Escribir a Bold** (soporte.online@bold.co) para preguntar si existe un esquema para plataformas que integran en nombre de sus comercios. Hoy cada comercio entrega sus llaves, y Bold dice que la secreta no se comparte con terceros: hace falta la autorización expresa del comercio en los términos de la tienda (TIENDA-3.0 §9).

---

## 10. ADR propuestos

Pasan a `ARQUITECTURA.md` §1, con su estado. Los «aceptados» ya los decidió el dueño el 5 oct 2026.

| ADR | Decisión | Estado |
|---|---|---|
| 20 | El CORE gana la dimensión de producto: tablas de referencia, FK compuestas, sesión y token por producto (§4) | Aceptada (decisión 6 del dueño). El diseño detallado queda propuesto |
| 21 | La Tienda 3.0 entra como **excepción declarada**, diseñada desde cero sobre la plataforma. Los datos de las tiendas actuales se cargan después con scripts | Aceptada (decisión 3 y mensaje del 5 oct) |
| 22 | Planes prepagados de 1, 3 y 12 meses, sin débito automático | Aceptada (decisión 4). Meses calendario y crédito al cambiar de plan: propuesta (§4.8) |
| 23 | Cuentas con un propósito declarado: gratuita para validar, paga para lo que cobra; graduar mudando celdas; nunca repartir un producto entre cuentas gratuitas | Propuesta |
| 24 | Preparación para agentes como principio: capa estática primero, OAuth y MCP después, comercio con traspaso a una persona | Propuesta (pedido del dueño) |
| 25 | Reconstruir tablas solo con la receta de §4.4, sin `ON DELETE CASCADE` y con lo que crece en tablas de referencia | Propuesta |
| 26 | El monorepo de la plataforma es este repositorio renombrado | Propuesta |

---

## Fuentes

Consultadas el 5 oct 2026. El proxy de la sesión bloqueó isitagentready.com, blog.cloudflare.com, developers.cloudflare.com y cloudflare.com. Lo marcado **(resumen)** sale del resumen del buscador sobre esa página, no de la página leída. Las cifras de Cloudflare están en `analisis/cuenta-cloudflare-paga.md`, con su fuente una por una.

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

**Pagos y normas**
- Bold, webhooks (`x-bold-signature`), consulta de transacciones, links de pago, llaves y tarifas: ver las fuentes de TIENDA-3.0 §9.
- Ley 1581 de 2012, Decreto 1377 de 2013, Circular Externa 005 de 2017 de la SIC, Ley 1480 de 2011 y Ley 2439 de 2024: ver las fuentes de TIENDA-3.0 §14.
