# Análisis: otros proveedores de cómputo y servicios para el ecosistema

_5 de octubre de 2026. Responde al pedido del dueño: «Analizar la posibilidad de integrar al ecosistema digital otras herramientas que ofrecen servicios de cómputo también con límites decentes como Vercel y otros que consideren aporten al ecosistema y al esquema de crecimiento y gobernanza visionado». Alimenta `../ecosistema/ECOSISTEMA-DIGITAL-ED1-v1.4.md` §22.2 y §22.3. Al día con las decisiones de la tarde del 5 oct 2026 (una sola cuenta de Cloudflare) y con el estudio de ecommerce v1.3, que corrigió lo que este análisis decía de WhatsApp (§7, trampa 10)._

> **Cómo se verificó.** El proxy bloqueó casi todos los sitios oficiales y el cupo de búsquedas de la sesión se agotó. El investigador usó tres caminos:
> - los **repositorios oficiales de documentación** de cada proveedor en GitHub, con la fecha de su último commit **(V)**;
> - el resumen del buscador sobre la página oficial **(r)**;
> - la lista comunitaria *free-for-dev* **(S)**.
>
> Lo marcado **(N)** es memoria, sin verificar. **Ninguna cifra N o S decide nada sin abrir antes la página oficial.**

## Conclusión, primero

**Cloudflare sigue siendo el plano de ejecución y GitHub el de construcción** (ED1 §1, §22, §23). Ningún proveedor de los evaluados mejora a Cloudflare en lo que el ecosistema ya hace: sitios estáticos, Workers en el borde, D1, R2 y KV. Integrar uno que lo duplique suma una cuenta, un secreto, un contrato y una factura, sin capacidad nueva.

**Lo que sí aporta, por capacidad faltante:**

| Capacidad que falta o es débil | Recomendación | Estado |
|---|---|---|
| **Una copia de los datos fuera de Cloudflare** (plan de salida, ED1 §20.3) | Un bucket en **Google Cloud Storage** o en **Backblaze B2** para el respaldo mensual cifrado | **Adoptar ya**, con la Tienda 3.0 (M0) |
| **Correo transaccional** antes de Workers Paid, y como respaldo del correo de Cloudflare | **Resend** (3.000 al mes, 100 al día) o **Brevo** (300 al día), detrás del adaptador `CorreoTransaccional` | **Adoptar** si el enlace mágico llega antes que Workers Paid |
| **Errores y crons vigilados desde fuera** (un Worker caído no se avisa a sí mismo) | **Sentry Developer** (tope duro) para errores y **Healthchecks.io** para los crons | **Adoptar** con la Tienda 3.0 |
| **Búsqueda** en catálogos grandes | **Orama** (código abierto, Apache-2.0) **dentro del navegador o del Worker**: no es un proveedor | Adoptar cuando una tienda pase de unos 500 productos |
| **Cómputo pesado o largo** (conversores con servidor de ED1 §15, procesar imágenes o PDF a escala) | Primero **Containers de Cloudflare** (con Workers Paid). En reserva, **Google Cloud Run en São Paulo** | **Reserva**, con disparador (§4) |
| **Postgres** (consultas relacionales que D1 no da, residencia en Suramérica) | **Neon** (100 proyectos gratis en una cuenta, región São Paulo) | **Reserva** |
| **Mensajería con clientes** | `wa.me` (gratis) y Telegram para el dueño. **WhatsApp Cloud API** cuando se demuestre ahorro de atención (estudio de ecommerce §11.1). El costo no es la barrera: dentro de la ventana de atención, los mensajes de servicio y las plantillas de utilidad no se cobran. Lo es habilitar el canal | Reserva |

**Lo que se descarta, con su motivo:**

- **Vercel Hobby:** prohíbe el uso comercial, no tiene DPA y entrena IA por defecto.
- **GitHub Pages para negocios y Actions como backend:** lo prohíben sus términos.
- **Netlify, Deno Deploy, Render, Fly.io, Koyeb, Railway y Azure:** duplican lo que ya hay o no tienen tope de gasto.
- **El plan Free de AWS:** vence a los 6 meses.
- **Supabase como núcleo:** se pausa a los 7 días sin uso y da 2 proyectos.
- **PlanetScale:** no tiene plan gratis.
- **n8n para clientes:** su licencia no lo permite.

Detalle en §3.

---

## 1. Criterios de gobierno

Un proveedor entra al ecosistema solo si pasa estos ocho criterios. Se registran en `infrastructure/proveedores.json` (§5).

| # | Criterio | Por qué |
|---|---|---|
| 1 | **El plan que se usa permite el uso comercial** | ED1 monetiza. Vercel Hobby y GitHub Pages lo prohíben de forma expresa |
| 2 | **Tiene tope duro, o el plan se detiene al agotarse** | Budget-first (ED1 §3.9): fallar de forma útil antes que facturar en silencio |
| 3 | **Ofrece DPA o contrato de tratamiento en ese plan** | Ley 1581: el proveedor es encargado o subencargado de los datos (TIENDA-3.0 §14.3) |
| 4 | **Región:** Suramérica si hay; si no, Estados Unidos o la Unión Europea, con contrato | La Circular 005 de 2017 de la SIC incluye a Estados Unidos y a la UE entre los países adecuados (vigencia 2026 sin verificar). Con contrato de transmisión, el encargado puede estar afuera |
| 5 | **Salida:** formatos y API estándar | ED1 §20.3. La lógica en paquetes independientes del runtime |
| 6 | **No obliga a multiplicar cuentas para crecer** | HA1. Oracle prohíbe tener varias cuentas, Supabase cuenta los proyectos por usuario y Google suma la capa gratis por cuenta de facturación |
| 7 | **Se integra detrás de un adaptador** | Cambiarlo es escribir otro adaptador (ED1 §5.3; `ProveedorDePago` es el ejemplo) |
| 8 | **Credencial de alcance mínimo, en el ambiente de GitHub del producto que la usa** | P12, P13 y R6 |

---

## 2. Qué necesita el ecosistema y quién lo da

| Necesidad | Hoy | Primera opción | Reserva |
|---|---|---|---|
| Sitios y herramientas estáticas | Workers Static Assets | — | — |
| API en el borde | Workers | — | — |
| Cómputo pesado o largo | — | Containers de Cloudflare (Paid) | Cloud Run, São Paulo |
| SQL | D1 | — | Neon (Postgres) |
| Clave-valor, contadores, candados | KV, Durable Objects y D1 | — | Upstash Redis |
| Colas y flujos | Queues y Workflows (Paid) | — | Inngest |
| Almacenamiento de objetos | R2 | — | — |
| **Respaldo fuera de Cloudflare** | **No hay** | Google Cloud Storage o Backblaze B2 | — |
| Correo transaccional | Gmail de Apps Script (Tienda 2.0) | Correo de Cloudflare (Paid) | Resend, Brevo o SES |
| Búsqueda | — | Orama dentro de la app | Meilisearch Cloud (São Paulo) |
| Errores y monitoreo externo | Workers Logs y vigía con Telegram | Sentry y Healthchecks.io | Better Stack |
| Mensajería | Telegram (dueño) y `wa.me` | — | WhatsApp Cloud API |
| CI/CD | GitHub Actions | — | — |
| Pagos | Bold | — | Wompi (eventos firmados y tokenización) |

---

## 3. Evaluación por categoría

### 3.1 Cómputo y hosting

| Proveedor | Plan gratis | ¿Comercial en gratis? | ¿Tope? | Región SA | Veredicto |
|---|---|---|---|---|---|
| **Vercel** Hobby | Por mes: 1 M invocaciones, 4 h de CPU activa, 100 GB de transferencia (r) | **No**: «restricted to non-commercial personal use only» (r) | Hobby se pausa. Pro (USD 20 por asiento) tiene gestión de gasto que pausa (r) | `gru1` (r) | **Descartar.** No comercial, sin DPA en Hobby (solo Pro y Enterprise) y, desde mar-2026, entrenamiento de IA activado por defecto en Hobby (r). Pro duplica Workers a USD 20 por asiento |
| **Netlify** Free | 300 créditos al mes (desde el 14-abr-2026: 20 créditos por GB, 15 por deploy) (r) | Sí según el foro, no en los términos (r) | Pausa al agotar (r) | N | **Descartar.** Duplica los assets de Workers. Errores de créditos en jul–sep 2026 (r) |
| **Deno Deploy** | 1 M solicitudes al mes (r) | N | Pausa (V) | **No** | **Descartar.** Duplica Workers. Classic cerró el 20-jul-2026 (V) |
| **Render** | Se duerme a los 15 min. Postgres gratis que expira a los 30 días (r) | «Not for production» (r) | Sin tope en planes pagos (r) | No | **Descartar** |
| **Fly.io** | **Sin plan gratis** para organizaciones nuevas (V) | — | **Sin alertas de facturación** (V) | `gru` | **Descartar** |
| **Railway** | Trial de USD 5; Hobby USD 5 al mes (V) | «Side hustles» (V) | Tope duro (V) | No | Solo si hiciera falta algo siempre encendido. Hoy no |
| **Koyeb** | 1 servicio en Frankfurt o Washington (r) | N | Deja Pro preseleccionado y preautoriza USD 29 (r) | No | **Descartar** |
| **Google Cloud Run** | Por cuenta de facturación y mes: 2 M solicitudes, 180.000 vCPU-s, 360.000 GiB-s (V) | Sí, con términos empresariales (V) | **No**: los presupuestos solo avisan; hay que automatizar el corte con Pub/Sub (V/N) | **`southamerica-east1`** (Tier 2, unos 40 % más caro) (V) | **Reserva** para cómputo pesado, con DPA incorporado (V) |
| **AWS** | Desde el 15-jul-2025, créditos de hasta USD 200 y plan Free de 6 meses, que suspende al vencer. Siempre gratis: Lambda 1 M solicitudes (r) | Sí | Free: suspende. Paid: sin tope (r) | `sa-east-1` | **Descartar** como cómputo. SES queda como reserva de correo |
| **Azure** | Static Web Apps Free «for personal projects» (V) | Dudoso | Solo las suscripciones con crédito tienen tope (V) | Brazil South (N) | **Descartar** |
| **Oracle** Always Free | VM Ampere y Autonomous DB (cifras N) | No lo prohíbe | Hasta pasar a pago por uso | N | Solo laboratorio: **una cuenta por persona** y reclamo de recursos inactivos (V) |

### 3.2 Bases de datos

| Proveedor | Plan gratis | ¿Comercial? | ¿Tope? | Región SA | Veredicto |
|---|---|---|---|---|---|
| **Neon** | **100 proyectos**, 1 GB por proyecto (20 GB en total), 100 CU-h por proyecto, escala a cero (V) | No encontró restricción (V) | **Free: corte duro.** Pagos: solo avisos (V) | **`aws-sa-east-1`** | **Reserva:** Postgres si un producto lo necesita, con un proyecto por producto en una sola cuenta |
| **Supabase** | **2 proyectos activos por usuario**, pausa a los 7 días, 500 MB, 50.000 MAU (V) | Sí (Términos v3, 1-ago-2026) (V) | Free no cobra. El tope de Pro no cubre el cómputo (V) | `sa-east-1` | Solo para prototipos. La pausa y los 2 proyectos no sirven para producción |
| **Upstash Redis** | 256 MB, 500.000 comandos al mes (V) | N | Presupuesto como tope (V) | `sa-east-1` | **Reserva:** contadores y límites si KV o Durable Objects no alcanzan |
| **Turso** | Archiva a los 10 días (V) | N | Bloquea (V) | No | Descartar: duplica D1 |
| **PlanetScale** | **Sin plan gratis** (V, 2024) | — | — | — | Descartar |
| **MongoDB Atlas** Free | 0,5 GB, pausa a los 30 días (V) | N | Sí | N | Descartar |
| **CockroachDB** | Exige tarjeta. São Paulo solo en Advanced (V) | N | Opcional | No | Descartar |
| **Convex** | Topes duros (V) | N | Sí | **No** | Descartar |

### 3.3 Correo transaccional

| Proveedor | Gratis | Veredicto |
|---|---|---|
| **Correo de Cloudflare** | Free: solo destinatarios verificados. Paid: 3.000 al mes y después USD 0,35 por 1.000 (r) | **Primera opción**, con Workers Paid en la cuenta (TIENDA-3.0 §15.5) |
| **Gmail por su API** | Una cuenta personal: unos 500 destinatarios al día. Gratis | **Primero**, por decisión del dueño del 13 oct 2026 (PLATAFORMA §4.11): el remitente es la dirección de Gmail, con `Reply-To` al comercio |
| **Resend** | 3.000 al mes, 100 al día (S) | **El siguiente**, cuando el tope de Gmail se acerque o una tienda pida su remitente propio |
| **Brevo** | 300 al día (S); empresa de la UE | Alternativa a Resend |
| **Amazon SES** | Sin capa gratis para cuentas nuevas desde el 21-jul-2026; precios nuevos (r) | Reserva a escala, con `sa-east-1` |
| Postmark · MailerSend · SendGrid · Mailgun | 100 al mes · 500 al mes · sin plan gratis (N) · N | Descartar |

**Para cualquiera de ellos:** SPF, DKIM y DMARC del dominio que envía. Los correos de las tiendas salen de `laboratorio-digital.app` y los del CORE de `laboratorio-digital.com`, para que la reputación de una tienda no toque la entrada al ecosistema ([V10], ADR-27).

### 3.4 Observabilidad

| Proveedor | Gratis | Veredicto |
|---|---|---|
| **Sentry** Developer | 1 usuario, unos 5.000 errores; **corte duro**; datos en Estados Unidos o la UE (V/S) | **Adoptar** para los Workers y las PWA, sin datos personales en los eventos |
| **Healthchecks.io** | 20 checks (S); autoalojable con licencia BSD-3 (V) | **Adoptar:** cada cron hace ping al terminar, y su ausencia avisa |
| Better Stack | 10 monitores cada 3 min (S) | Reserva para monitorear la disponibilidad |
| UptimeRobot | Gratis «for hobby projects» (S) | Descartar |
| Axiom | 500 GB al mes, solo Estados Unidos (V) | Opcional |
| Grafana Cloud | 10.000 series (S) | Excesivo para la etapa |

### 3.5 Colas y automatización

| Proveedor | Gratis | Veredicto |
|---|---|---|
| **Inngest** | 50.000 ejecuciones, tope duro, sin tarjeta (V) | Reserva, solo si Queues y Workflows no bastan |
| Trigger.dev | Límites «soft» (V) | Descartar |
| **n8n** | Autoalojado: **solo uso interno** según su licencia (V) | Solo para automatizaciones del dueño, **nunca para ofrecerlo a clientes** |

### 3.6 Almacenamiento, medios y búsqueda

| Proveedor | Gratis | Veredicto |
|---|---|---|
| **Backblaze B2** | 10 GB (S). La documentación de Cloudflare ya no menciona la Bandwidth Alliance (egreso gratis entre ambos): reconfirmar (V, la ausencia) | **Candidato** para el respaldo fuera de Cloudflare |
| **Google Cloud Storage** | Capa gratis por cuenta de facturación (N para cifras) | **Candidato** para el respaldo, con DPA incorporado (V) y región São Paulo |
| Cloudinary · ImageKit | 25 créditos · 20 GB (S) | No hace falta: las fotos se comprimen en el navegador |
| **Orama** | Código abierto, Apache-2.0 (V) | **Adoptar** dentro de la app. Orama Cloud gratis se redujo (S) |
| Meilisearch Cloud | Plan Build con São Paulo (V) | Reserva |
| Algolia | 10.000 búsquedas al mes (S) | Reserva |

### 3.7 GitHub

**Todo verificado en `github/docs` y `github/site-policy` (V).**

- **Actions:** 2.000 minutos al mes en repositorios privados. Solo para **el ciclo de vida del software**: los términos prohíben usarlo como parte de una aplicación serverless o para otra cosa. Ninguna tarea de producción con datos de usuarios corre en Actions (ED1 §23.3; [H6]).
- **Pages:** «not intended for or allowed to be used as a free web-hosting service to run your online business, e-commerce site, or … commercial software as a service». **Ninguna tienda ni producto comercial en Pages.**
- **Copilot code review consume minutos de Actions** en repositorios privados.

---

## 4. Recomendaciones y disparadores

| Proveedor | Para qué | Disparador | Costo esperado |
|---|---|---|---|
| **Google Cloud Storage** o **Backblaze B2** | Respaldo mensual cifrado fuera de Cloudflare | **Ya**, con la Tienda 3.0 (M0). Es el plan de salida de ED1 §20.3 | Centavos |
| **Sentry** Developer | Errores de Workers y PWA | Ya, con la Tienda 3.0 | USD 0 |
| **Healthchecks.io** | Crons vigilados desde fuera | Ya | USD 0 |
| **Resend** o **Brevo** | Enlace mágico y avisos del CORE si llegan antes que Workers Paid, y respaldo del correo de Cloudflare | Cuando llegue el enlace mágico sin Workers Paid (`PLATAFORMA.md` §4.11) | USD 0 en su capa gratis |
| **Orama** | Búsqueda en la tienda | Una tienda con más de unos 500 productos | USD 0 |
| **Cloud Run** (São Paulo) | Cómputo pesado | Un producto que necesite más de 5 min de CPU o más de lo que dan los Containers, o residencia en Suramérica | Su capa gratis, con corte automatizado |
| **Neon** | Postgres | Un producto con consultas relacionales que D1 no resuelva, o datos que deban quedarse en Suramérica | USD 0 en Free |
| **Upstash Redis** | Contadores y límites | KV, Durable Objects y el binding de rate limiting no alcanzan | USD 0 en Free |
| **Inngest** | Flujos durables | Queues y Workflows no alcanzan | USD 0 en Free |
| **WhatsApp Cloud API** | Avisos automáticos a compradores | Se demuestra ahorro de atención y la contribución por pedido soporta su costo (estudio de ecommerce §11.1) | Gratis dentro de la ventana de atención para servicio y utilidad; fuera de ella, unos USD 0,0008 por plantilla de utilidad en Colombia (S), más la cuota del intermediario |

---

## 5. Cómo entra un proveedor (gobierno como código)

1. **Un archivo, `infrastructure/proveedores.json`**, con una fila por proveedor: `id`, propósito, productos que lo usan, plan, cuenta (dueño y recuperación), si tiene tope, DPA (sí, no, o firmado con fecha), región, categorías de datos que recibe (ninguna, técnicos o personales), adaptador y fecha de la última revisión.
2. **Una prueba exige** que todo host externo al que llama un Worker o que carga una PWA esté en ese archivo:
   - los de `fetch` en el código;
   - los de `connect-src` y `script-src` en las CSP;
   - los de `ORIGENES_APP`.

   Es la misma idea de los secretos documentados de ARQUITECTURA §7.5 (P18).
3. **La política de datos de cada producto se arma con ese archivo:** sus subencargados y su ubicación salen de ahí. Así nunca dice algo distinto de lo que el código hace (P2).
4. **Revisión trimestral:** el vigía semanal lista los proveedores con revisión vencida.

---

## 6. Datos personales y proveedores (Ley 1581)

- **El proveedor que recibe datos personales es subencargado.** El contrato de transmisión con el comercio (TIENDA-3.0 §14.3) lo nombra con su ubicación.
- **DPA en el plan gratuito, según la investigación:**

  | Situación | Proveedores |
  |---|---|
  | Incorporado a los términos | Google Cloud (V), Supabase (V), AWS (r), Neon vía Databricks (V parcial) y Netlify (r) |
  | Hay que suscribirlo | Sentry (V) |
  | **No en el plan gratis** | **Vercel**, que lo da solo en Pro y Enterprise (r) |
  | No verificado | Cloudflare, Resend, Brevo, Upstash, Inngest y el resto: se confirma antes de adoptarlos |

- **Regla práctica:** a Sentry, Healthchecks y los respaldos no les llegan datos en claro.
  - Los eventos de errores se depuran antes de salir.
  - Los respaldos ya van cifrados con las llaves de cada tienda.
  - Así, la mayoría de proveedores no recibe datos personales legibles.

---

## 7. Trampas encontradas

1. **Vercel Hobby:** no comercial, sin DPA, entrenamiento de IA activado por defecto (mar-2026) y una pausa que puede durar hasta 30 días (r).
2. **Netlify:** 300 créditos son unos 15 GB de transferencia o 20 despliegues (r).
3. **Google Cloud:**
   - los presupuestos no cortan el gasto;
   - la capa gratis exige cuenta de facturación;
   - São Paulo es Tier 2, más caro y con una capa gratis que rinde menos (V).
4. **AWS:**
   - el plan Free suspende la cuenta a los 6 meses y borra los datos a los 90 días si no se pasa a pago (r);
   - SES quitó su capa gratis a las cuentas nuevas (r).
5. **Supabase:** pausa a los 7 días, 2 proyectos por usuario, y el tope de Pro no cubre el cómputo (V).
6. **Neon:** en Free se suspende el cómputo al pasar el límite. En los planes pagos no hay tope (V).
7. **GitHub:**
   - Actions no es un backend y Pages no es para negocios (V);
   - el almacenamiento de Actions se acumula por hora, así que borrar artefactos no baja lo ya cobrado (V).
8. **Oracle:** una sola cuenta por persona; las cuentas inactivas se suspenden (V).
9. **Backblaze B2 y la Bandwidth Alliance:** el egreso gratis hacia Cloudflare hay que reconfirmarlo (V, la ausencia en la documentación de Cloudflare).
10. **WhatsApp, corregido el 5 oct 2026.** La primera versión de este análisis decía que desde el 1 oct 2026 Meta cobra los mensajes de servicio y las plantillas de utilidad dentro de la ventana de 24 h. **Era falso.**
    - La documentación oficial, leída el 5 oct 2026 por el estudio de ecommerce (§11.1 [C5], S111), dice lo contrario: dentro de la ventana de atención, los mensajes que no son plantilla y las plantillas de utilidad no se cobran. Hay además 72 horas sin cargo cuando la persona llega por un anuncio.
    - Lo que no está confirmado es un tope de 1.000 mensajes de servicio gratis al mes por número, que afirma una fuente secundaria. Está en el radar del estudio (§17.1).
    - La trampa real es otra: habilitar el canal pide verificar el negocio, plantillas aprobadas, el consentimiento del comprador y la cuota de un intermediario.

---

## Fuentes

Consultadas el 5 oct 2026. (V) en el repositorio oficial de documentación en GitHub, con fecha del último commit en el informe del investigador. (r) por resumen del buscador. (S) en la lista *free-for-dev*.

- Vercel: https://vercel.com/docs/limits/fair-use-guidelines · /docs/plans/hobby · /docs/spend-management · /docs/regions (r).
- Netlify: https://docs.netlify.com/manage/accounts-and-billing/billing/billing-for-credit-based-plans/ · changelog 2026-04-14 (r).
- Deno Deploy: repositorio `denoland/docs` (V).
- Render: https://render.com/docs/free · /pricing (r).
- Fly.io: repositorio `superfly/docs` (V).
- Railway: repositorio `railwayapp/docs` (V).
- Koyeb: https://www.koyeb.com/docs/faqs/pricing (r).
- Google Cloud: https://cloud.google.com/run/pricing · /functions/pricing-1stgen · /free · /firestore/pricing (V).
- AWS: https://aws.amazon.com/free · /ses/pricing · anuncio del 15-jul-2025 (r).
- Azure: repositorio `MicrosoftDocs/azure-docs` (V).
- Oracle: https://www.oracle.com/cloud/free/ · /cloud/free/faq/ (V).
- Supabase: repositorio `supabase/supabase` (V).
- Neon: repositorio `neondatabase/website` (V).
- Turso: repositorio `tursodatabase/turso-docs` (V).
- Upstash: repositorio `upstash/docs` (V).
- PlanetScale: repositorio `planetscale/docs` (V).
- MongoDB: repositorio `mongodb/docs` (V).
- CockroachDB: repositorio `cockroachdb/docs` (V).
- Xata: repositorio `xataio/docs` (V).
- Convex: repositorio `get-convex/convex-backend` (V).
- Sentry: repositorio `getsentry/sentry-docs` (V).
- Healthchecks.io: repositorio `healthchecks/healthchecks` (V).
- Axiom: repositorio `axiomhq/docs` (V).
- Inngest: repositorio `inngest/website` (V).
- Trigger.dev: repositorio `triggerdotdev/trigger.dev` (V).
- n8n: `n8n-io/n8n` LICENSE.md (V).
- Meilisearch: repositorio `meilisearch/documentation` (V).
- Orama: `oramasearch/orama` LICENSE.md (V).
- GitHub: repositorios `github/docs` y `github/site-policy` (V).
- Lista comunitaria: https://github.com/ripienaar/free-for-dev (S).
- WhatsApp: estudio de ecommerce v1.3 (`../tienda/ESTUDIO-MERCADO-ECOMMERCE-ED1-2026-10-v1.3.md`) §11.1, S88, S111 y S113.
- Normas colombianas: ver las fuentes de `../tienda/TIENDA-3.0.md`.
