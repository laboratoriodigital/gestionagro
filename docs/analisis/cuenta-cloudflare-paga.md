# Análisis: lo que una cuenta paga de Cloudflare le da al ecosistema

_5 de octubre de 2026. Responde a la pregunta del dueño: «Tengo otra cuenta de Cloudflare de la cual pago algunos servicios (no son las dos free), ¿qué posibilidades le da eso al ecosistema?». Completa `docs/arquitectura/PLATAFORMA.md` §3 y alimenta `ECOSISTEMA-DIGITAL-ED1-v1.3.md`._

> **Cómo se verificó.**
> - El proxy de la sesión bloqueó developers.cloudflare.com, cloudflare.com y blog.cloudflare.com.
> - Las cifras salen del resumen del buscador sobre la página oficial, que se nombra en cada fila **(r)**. No se leyeron las páginas.
> - Lo marcado **(N)** es memoria del investigador, sin verificar.
> - **Nada de esto se usa para fijar un precio sin abrir antes la página oficial.**
> - Los términos de uso no se pudieron releer. La lectura vigente es la del 30 sep 2026 (ARQUITECTURA §6.5).

## Conclusión, primero

**Una cuenta con Workers Paid (USD 5 al mes por cuenta) es el lugar natural de lo que cobra.**

Cambia la naturaleza del límite: en el plan gratuito, al agotar la cuota diaria **se corta el servicio** hasta las 19:00 de Colombia. En el pago, el exceso **se factura**. Además trae lo que el diseño de la Tienda 3.0 necesita y el plan gratuito no da:

- 250 crons por cuenta (en la principal hay 5 y ya se usan 4);
- hasta 5 minutos de CPU por invocación;
- 1.000 consultas a D1 por invocación;
- bases de 10 GB;
- Time Travel de 30 días;
- correo a cualquier destinatario;
- colas con retención de días;
- Containers.

**Lo que no da:**

- más reglas de WAF ni «Markdown for Agents»: dependen del plan de **cada zona** (Pro o Business), no de Workers Paid;
- un tope duro de gasto (N);
- más hostnames de Cloudflare for SaaS gratis: son 100 en cualquier plan.

**Cómo se usa** (detalle en `PLATAFORMA.md` §3):

- **Una cuenta, un propósito.** La paga es la **plataforma comercial**: Tienda 3.0, luego el CORE y los productos que gradúen. La gratuita principal es el **laboratorio de validación**.
- **Nunca repartir un producto entre cuentas gratuitas para sumar cuota** (HA1).
- **Lo que hospeda contenido no confiable de usuarios no va en la cuenta paga de la plataforma**, como el hosting temporal de ED1 §14. Una suspensión por abuso tumbaría la tienda. Va en una cuenta propia, también paga, cuando ese producto exista. Ese es el «aislamiento de riesgo» legítimo de HA1.

**Lo que hace falta del dueño:** la lista de §2, para saber qué paga hoy esa cuenta, y activar Workers Paid si no lo tiene.

---

## 1. Qué cambia con Workers Paid

| Servicio | Plan gratuito | Workers Paid (USD 5/mes) | Excedente | Fuente |
|---|---|---|---|---|
| Solicitudes a Workers | 100.000/día | 10 M/mes | USD 0,30/M | dc/workers/platform/pricing/ (r) |
| CPU | 10 ms por invocación | 30 M CPU-ms/mes. 30 s por invocación, hasta 5 min con `limits.cpu_ms` (desde el 25-mar-2025) | USD 0,02/M CPU-ms | dc/workers/platform/limits/ (r) |
| Subrequests | 50 externas + 1.000 a Cloudflare | 10.000 por defecto, configurable (desde el 11-feb-2026) | — | changelog 2026-02-11 (r) |
| Workers por cuenta · crons | 100 · **5** | 500 · **250** | — | dc/workers/platform/limits/ (r) |
| Assets estáticos | Gratis e ilimitados; 20.000 archivos por versión | Gratis; 100.000 archivos (desde el 2-sep-2025) | — | dc/workers/static-assets/billing-and-limitations/ (r) |
| D1 · filas | 5 M leídas y 100.000 escritas por día; **al pasarse, falla hasta las 00:00 UTC** | 25.000 M leídas y 50 M escritas al mes | USD 0,001/M leídas; USD 1,00/M escritas | dc/d1/platform/pricing/ (r) |
| D1 · tamaño | 500 MB por base; 10 bases; 5 GB | 10 GB por base (no sube pagando); 50.000 bases; 1 TB | USD 0,75/GB-mes después de 5 GB | dc/d1/platform/limits/ (r) |
| D1 · consultas por invocación · Time Travel | 50 · 7 días | 1.000 · **30 días** | — | Ídem (r) |
| KV | 100.000 lecturas y **1.000 escrituras por día** | 10 M lecturas y 1 M escrituras al mes | USD 0,50/M lecturas; USD 5/M escrituras | dc/kv/platform/pricing/ (r) |
| R2 | 10 GB-mes, 1 M operaciones clase A y 10 M clase B, egreso gratis | Igual (va aparte de Workers) | USD 0,015/GB-mes; A 4,50/M; B 0,36/M | dc/r2/pricing/ (r). Pide activar la suscripción de R2 aun para la capa gratis |
| Queues | 10.000 operaciones/día, retención 24 h (gratis desde el **4-feb-2026**) | 1 M operaciones/mes, retención de 4 a 14 días | USD 0,40/M | changelog 2026-02-04 (r) |
| Workflows | 3.000 pasos/día | 500.000 pasos/mes | USD 0,80 por 100.000 pasos (desde ago-2026) | dc/workflows/reference/pricing/ (r) |
| Durable Objects | Solo con SQLite (desde el 7-abr-2025); 100.000 solicitudes/día | 1 M solicitudes/mes; almacenamiento con cobro desde el 7-ene-2026 | USD 0,15/M | dc/durable-objects/platform/pricing/ (r) |
| Containers y Sandbox | No | Sí (GA desde el 13-abr-2026) | Por uso de CPU, memoria y disco | changelog 2026-04-13 (r) |
| Envío de correo (Email Service, beta pública desde el 16-abr-2026) | **Solo a direcciones verificadas** | **3.000/mes a cualquier destinatario** | USD 0,35 por 1.000 | dc/email-service/platform/pricing/ (r) |
| Workers Logs | 200.000 eventos/día, 3 días | 20 M/mes, 7 días | USD 0,60/M. Desde el 1-dic-2026, por GB de ingesta | dc/workers/observability/logs/ (r) |
| Logpush de Workers · Tail Workers | No · No | Sí · Sí | — | (r) |
| Analytics Engine | 100.000 puntos/día | 10 M puntos/mes | Precio publicado, todavía no se cobra | (r) |
| Workers AI | 10.000 neurons/día | Igual. Algunos modelos grandes solo en Paid (desde el 28-jul-2026) | USD 0,011 por 1.000 neurons | (r) |

**Lo que no cambia con Workers Paid** (depende de otra cosa):

| Qué | De qué depende | Valor |
|---|---|---|
| Cloudflare for SaaS (dominios de clientes) | La zona; funciona en zonas gratuitas | 100 hostnames incluidos, después **USD 0,10 por hostname al mes**, máximo 50.000 (r) |
| Dominio raíz del cliente (apex) | «Apex proxying» es un add-on de **Enterprise** | Sin él: CNAME flattening en el DNS del cliente, o `www` con redirección (r) |
| Reglas de WAF | El plan de la zona | 5 personalizadas y 1 de rate limiting en Free; Pro 20 y 2; Business 100 y 5 (r) |
| «Markdown for Agents» | El plan de la zona | Pro, Business y Enterprise (r) |
| Turnstile | — | Gratis, pero **10 hostnames por widget**. «Cualquier hostname» es Enterprise (r) |
| Tope duro de gasto | — | **No hay**: solo notificaciones de uso (N) |

---

## 2. Lista de comprobación: qué tiene hoy la cuenta paga

Se mira en el panel de Cloudflare de esa cuenta, **Manage Account › Billing › Subscriptions**, y en la lista de zonas:

| Si aparece… | Habilita | Para el ecosistema |
|---|---|---|
| **Workers Paid** (Workers & Pages › Plans) | Todo §1 | La Tienda 3.0 se despliega ahí sin otro costo fijo. **Si no aparece, se activa**: USD 5/mes |
| **R2** (suscripción activa) | Almacenamiento de objetos | Sitios horneados, fotos y respaldos de la Tienda |
| Una **zona Pro o Business** | Más WAF, «Markdown for Agents» | Útil si esa zona es la de tiendas. No es necesaria para empezar |
| **Images** (plan pago) | Almacenamiento y entrega de imágenes | No hace falta: las fotos se comprimen en el navegador y se sirven desde R2 |
| **Stream** | Video | No está en ningún plan del ecosistema |
| **Zero Trust** con asientos pagos | Access para más de 50 usuarios | Proteger herramientas internas. Hasta 50 es gratis |
| **Registrar** (dominios registrados ahí) | Dominios al costo | El dominio de tiendas puede registrarse ahí (§4). Ojo: recuperación aparte (ED1 §20.3) |
| **Load Balancing**, **Argo**, **Spectrum** | Rendimiento y disponibilidad | No hacen falta en esta etapa |
| **Workers for Platforms** | Código distinto por cliente | No hace falta: todas las tiendas usan el mismo código (TIENDA-3.0 §3.3) |

**Además, en la misma visita:**

- confirmar que la cuenta tiene **segundo factor**;
- revisar **quién es miembro**;
- dejar escrito en `infrastructure/cuentas.json` su propósito y su dueño (`PLATAFORMA.md` §3.3). El identificador de la cuenta no va ahí: va en los secretos de GitHub.

---

## 3. Qué le da a cada producto

| Producto | Qué gana en la cuenta paga | ¿Cuándo? |
|---|---|---|
| **Tienda 3.0** | Lo necesita para existir: CPU para hornear (más de 10 ms), colas con retención, crons (conciliación cada 15 min, apartados cada 5), correo a compradores y comercios, 1.000 consultas por invocación (un cobro de 30 líneas usa unas 95), y facturar el exceso en lugar de cortar la venta a las 19:00 | Desde su M0 (TIENDA-3.0 §19) |
| **CORE** | Crons y colas para los avisos de vencimiento y el enlace mágico por correo, consultas por invocación sin el techo de 50, y Time Travel de 30 días para la base de identidades | Cuando se cumpla su disparador (`PLATAFORMA.md` §3.5). El primero probable es el correo |
| **CultivoPro (agro)** | La etapa B de ARQUITECTURA §6.3 es **graduar a esta cuenta** (celda c2 y mudanza de fincas), sin pagar otra suscripción | Al pasar el 50 % de su presupuesto 7 días seguidos o con su primer cliente pago |
| **Herramientas y sitios estáticos** | Nada: los assets estáticos son gratis en cualquier plan | Se quedan en la gratuita |
| **Hosting temporal y conversores con servidor** (ED1 §14, §15) | Aislarlos en una **cuenta propia** (también paga) es lo que HA1 llama aislamiento de riesgo. **No en esta** | Cuando esos productos existan |

---

## 4. La topología que resulta

```text
 A · ED1 principal (gratuita) ── laboratorio: productos antes de sus umbrales, sitios estáticos,
                                  agro c0, CORE (por ahora), tiendas 2.0 (hasta cargarlas)
 B · segunda gratuita ────────── un propósito declarado y sin producción, o se cierra
 C · plataforma (Workers Paid) ── Tienda 3.0, zona de tiendas, celdas graduadas, CORE (después)
 D · (futura, paga) ──────────── contenido no confiable de usuarios (hosting temporal)
 Clientes ────────────────────── celdas dedicadas en SU cuenta (ADR-8)
```

**Por qué no meter todo en C de una vez:**

- **Free-first sigue valiendo para validar.** Un producto que todavía no demostró su demanda no gasta la cuota de los que facturan.
- **Mover el CORE tiene un costo:** la llave de firma, la URL de los cuadernos instalados y la zona del dominio (`PLATAFORMA.md` §3.5). Se hace cuando un disparador lo justifica.
- **Concentrar todo en una cuenta concentra el riesgo de suspensión.** Eso se mitiga con exportaciones fuera de Cloudflare (`proveedores-de-computo.md` §4), no juntando más.

---

## 5. Control de gasto sin tope duro

En la cuenta paga el exceso se factura. Según el investigador (N), Cloudflare no ofrece un tope duro. Las defensas, en orden:

1. **Assets estáticos para todo lo que se pueda.** Son gratis en cualquier plan.
2. **Límites por Worker:** `limits.cpu_ms` y `limits.subrequests` bajos en cada Worker.
3. **Desactivar workers.dev y las URL de vista previa** en producción. El WAF de la zona no las cubre (N).
4. **Reglas de WAF y rate limiting** en la zona de tiendas, y el **binding de rate limiting** en las rutas que escriben.
5. **Muestreo de logs** antes del 1 dic 2026, cuando la observabilidad pasa a cobrarse por GB.
6. **El vigía con presupuesto en dinero.**
   - Compara el consumo del mes contra lo incluido y proyecta el costo.
   - Avisa por Telegram al 50, 75 y 90 %.
   - Apaga la capacidad que el producto declare: el MCP o el horno, **nunca la venta**.
   - Ver `PLATAFORMA.md` §4.10.
7. **Notificaciones de facturación de Cloudflare**, como segunda red.

---

## 6. Términos y gobierno

- **HA1 sigue vigente.** El Self-Serve Subscription Agreement §2.2.1(c) prohíbe usar los servicios para esquivar límites o cuotas (leído el 30 sep 2026; ARQUITECTURA §6.5).
  - Tener varias cuentas propias con propósitos distintos no es esquivar cuotas.
  - Repartir **un mismo producto** entre cuentas gratuitas sí puede leerse así.
  - Esta vez no se pudo releer el texto. Antes de la etapa C del agro se confirma.
- **§2.2.1(a), registrarse a nombre de un tercero.** Las celdas dedicadas van en la cuenta **del cliente**, con acceso de miembro para el ecosistema (ADR-8). Los dominios de los comercios **no** se agregan como zonas a nuestras cuentas: se conectan con Cloudflare for SaaS (TIENDA-3.0 §4.3).
- **Programa «Tenant»** para socios que administran cuentas de clientes. Aparece en `dc/tenant/` (r), sin leer. Se revisa si algún día el ecosistema administra cuentas de clientes a escala.

---

## 7. Trampas encontradas

1. **D1 gratuito bloquea al exceder**, y el límite es **por cuenta**, no por base. Un producto puede dejar sin base a los demás a las 19:00 de Colombia (r).
2. **D1 aplica siempre las claves foráneas.** `defer_foreign_keys` no impide las cascadas: rehacer una tabla padre con `ON DELETE CASCADE` borra sus hijas (r). La receta probada está en `PLATAFORMA.md` §4.4.
3. **KV gratuito: 1.000 escrituras al día.** No sirve para sesiones, contadores ni apartados (r).
4. **Queues gratuito: 10.000 operaciones al día**, unos 3.300 mensajes, con 24 h de retención (r).
5. **Observabilidad:** desde el 1 oct 2026 los traces cuentan como eventos de logs, y desde el 1 dic 2026 se cobra por GB (r).
6. **Workflows cobra por pasos** desde agosto de 2026 (r).
7. **R2 pide activar su suscripción por checkout** aun para la capa gratuita (r).
8. **Límites que no suben pagando:**
   - D1: 10 GB por base;
   - KV: 1 escritura por segundo por clave;
   - assets: 25 MiB por archivo;
   - Queues: mensajes de 128 KB;
   - correo: 5 MiB por mensaje;
   - Cloudflare for SaaS: 50.000 hostnames sin Enterprise (r).
9. **Turnstile no escala con dominios de clientes:** 10 hostnames por widget (r).
10. **La factura puede llevar el IVA colombiano** sobre servicios digitales del exterior, y el banco puede cobrar comisión por compras en el exterior (N).

---

## Fuentes

Consultadas el 5 oct 2026 por resumen del buscador (r). `dc/` es `https://developers.cloudflare.com/`.

- Workers: dc/workers/platform/pricing/ · dc/workers/platform/limits/ · dc/workers/static-assets/billing-and-limitations/ · dc/workers/observability/logs/workers-logs/ · dc/workers/observability/logs/logpush/ · dc/workers/observability/logs/tail-workers/ · dc/workers/ci-cd/builds/limits-and-pricing/.
- Changelog: 2025-03-25 (CPU), 2025-09-02 (assets), 2026-02-04 (Queues gratis), 2026-02-11 (subrequests), 2026-04-13 (Containers GA), 2026-04-16 (Email Service), 2026-07-28 (modelos solo en Paid), 2026-09-01 (D1 gratuito), 2026-09-04 (tamaño del Worker), 2026-09-30 (Logpush). En `dc/changelog/post/<fecha>-…`.
- D1: dc/d1/platform/pricing/ · dc/d1/platform/limits/ · dc/d1/sql-api/foreign-keys/ · dc/d1/best-practices/use-indexes/ · dc/d1/best-practices/read-replication/.
- KV: dc/kv/platform/pricing/ · dc/kv/platform/limits/.
- R2: dc/r2/pricing/ · dc/r2/buckets/event-notifications/.
- Queues: dc/queues/platform/pricing/ · dc/queues/platform/limits/.
- Workflows: dc/workflows/reference/pricing/ · dc/workflows/reference/limits/.
- Durable Objects: dc/durable-objects/platform/pricing/.
- Containers: dc/containers/pricing/.
- Cloudflare for SaaS: dc/cloudflare-for-platforms/cloudflare-for-saas/plans/ · …/advanced-settings/worker-as-origin/ · …/apex-proxying/ · …/saas-customers/how-it-works/.
- Custom Domains: dc/workers/configuration/routing/custom-domains/.
- Mover zonas: dc/fundamentals/manage-domains/move-domain/.
- Correo: dc/email-service/platform/pricing/ · dc/email-service/platform/limits/.
- Images: dc/images/pricing/.
- Otros: dc/turnstile/plans/ · dc/waf/custom-rules/ · dc/waf/rate-limiting-rules/ · dc/analytics/analytics-engine/pricing/.
- Términos: https://www.cloudflare.com/terms/ (lectura del 30 sep 2026, ARQUITECTURA §6.5).
