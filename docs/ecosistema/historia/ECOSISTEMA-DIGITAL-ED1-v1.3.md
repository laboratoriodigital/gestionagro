# ED1 — Ecosistema Digital
## Diseño y Arquitectura del Ecosistema Digital v1.3

**Estado:** Diseño consolidado, revisado y contrastado con dos productos reales (CultivoPro y la línea de tiendas)  
**Versión:** 1.3  
**Proyecto:** laboratorio-digital.com (ED1 es el nombre interno del ecosistema; la marca pública se define en la Fase 0)  
**Propósito:** Cerrar y ampliar la visión del ecosistema ED1, convirtiéndola en una arquitectura empresarial, tecnológica, editorial y de crecimiento coherente con una premisa de operación de costo cero o costo marginal cero durante la fase de validación.

> **Nota de alcance:** Este documento conserva la lógica y terminología del diseño original. Las ampliaciones incorporan una segunda capa operativa basada en **Cloudflare + GitHub Actions**, con presupuestos, automatización y degradación controlada para permanecer dentro de cuotas gratuitas mientras el volumen lo permita.

> **Nota de la versión 1.2:** Incorpora la revisión del 28 de septiembre de 2026 (ver `REVISION-HALLAZGOS-ED1.md`). Los cambios se marcan con la etiqueta del hallazgo correspondiente, por ejemplo **[H3]**. Cada sistema distingue ahora entre su **versión de validación (MVP)** y su **arquitectura objetivo**: el diseño completo se conserva como destino, pero solo se construye lo que la fase actual justifica.

> **Nota de la versión 1.3 (5 de octubre de 2026):** incorpora lo que enseñaron dos productos reales: CultivoPro, que ya corre con cuentas, cobros y celdas, y la línea de tiendas (Tienda 2.0 en operación y Tienda 3.0 diseñada). Las fuentes son `docs/arquitectura/PLATAFORMA.md`, `docs/arquitectura/TIENDA-3.0.md` y `docs/analisis/` del repositorio de CultivoPro. La v1.2 no se edita: este documento la reemplaza. La numeración de la v1.2 se conserva, porque el código y los documentos citan «ED1 §N»; lo nuevo entra como subsección con número nuevo y una etiqueta:
> - **[D1]–[D6]**: decisiones del dueño del 5 oct 2026.
> - **[HA1]–[HA8]**: hallazgos de la arquitectura de CultivoPro (ARQUITECTURA §14).
> - **[V1]–[V11]**: validación del estudio de mercado de ecommerce.
> - **[AR]**: preparación para agentes.
> - **[PC]**: proveedores y cuentas.
>
> El detalle de cada etiqueta está en el §43.

## Control de versiones

| Versión | Fecha | Cambios |
|---|---|---|
| 1.1 | Sep 2026 | Diseño conceptual consolidado con capa Cloudflare + GitHub Actions |
| 1.2 | 28 sep 2026 | Público objetivo (ICP); static-first y regla de tres; MVP vs objetivo por sistema; analítica sin D1; hosting temporal aislado y antiabuso; alcance server-side; autenticación, pagos, email, legal y respaldos; quality gate SEO; métricas de validación; roadmap reordenado; anexo de cuotas ampliado |
| 1.3 | 5 oct 2026 | Excepciones declaradas (agro y ecommerce); el CORE con dimensión de producto (§5.4); planes prepagados por periodo; principio «legible por agentes» (§3.12, §5.5, §12.4); desvío declarado de static-first para tiendas multi-comercio (§3.10); cuentas con propósito y graduación, con la cuenta paga (§22.2); gobierno de proveedores (§22.3); aislamiento de riesgo, no de cuota ([HA1]); controles técnicos en lugar de asesoría legal ([D5]); anexo de cuotas con Workers Paid (§41) y registro de hallazgos (§43) |

---

# 1. Resumen ejecutivo

ED1 es un ecosistema digital compuesto por herramientas web gratuitas, productos SaaS y servicios digitales conectados mediante una infraestructura tecnológica y comercial común.

La premisa fundamental es:

> Construir herramientas digitales gratuitas de utilidad real, con el menor costo marginal posible, utilizarlas para generar tráfico y usuarios, monetizar parte de ese tráfico y convertir una proporción de los usuarios en clientes de productos SaaS.

El ecosistema no se concibe como una colección de sitios independientes.

Se concibe como una única plataforma con:

- una identidad de marca;
- una cuenta de usuario común;
- un núcleo tecnológico compartido;
- un sistema de administración central;
- un CMS;
- un sistema de analítica;
- un motor de automatizaciones;
- un motor de monetización;
- un sistema SEO;
- múltiples productos y herramientas.

La arquitectura debe permitir pasar de unas pocas herramientas iniciales a cientos de productos sin multiplicar proporcionalmente la complejidad administrativa.

La evolución conceptual de ED1 añade una distinción fundamental:

```text
CLOUDFLARE = PLANO DE EJECUCIÓN
GITHUB    = PLANO DE CONSTRUCCIÓN Y OPERACIÓN
```

Cloudflare ejecuta el ecosistema en producción; GitHub Actions construye, valida, publica, prueba y mantiene sus piezas sin convertir cada tarea operativa en trabajo manual.

El objetivo no es simplemente “usar servicios gratis”. El objetivo es diseñar el sistema para que **su consumo de recursos sea deliberadamente pequeño, medible, cacheable, automatizable y reversible**.

La fase de validación tiene un foco explícito **[H2]**: herramientas útiles para **pequeños negocios, independientes y agentes/inmobiliarias de habla hispana, empezando por Colombia/LATAM**, porque ese es el público que puede recorrer la escalera hasta los productos SaaS previstos.

**Desde la v1.3**, el ecosistema ya tiene una plataforma probada en producción: el CORE (identidad, organizaciones, roles, planes y cobro), celdas multi-tenant y despliegue por anillos. La construyó el primer producto con cuentas, CultivoPro. Sobre ella entran dos verticales como **excepciones declaradas** ([D3]):

- el agro, fuera del ICP, con su cliente cero (ARQUITECTURA ADR-2);
- el ecommerce, dentro del ICP pero antes de su fase (Tienda 3.0).

El CORE gana la dimensión de producto para servir a los dos ([D6], §5.4).

---

# 2. Visión estratégica

El modelo general es:

```text
                         INTERNET
                            │
                            ▼
                     TRÁFICO DIGITAL
                            │
                 ┌──────────┼──────────┐
                 │          │          │
                SEO      Referidos  Publicidad
                 │          │          │
                 └──────────┼──────────┘
                            ▼
                     HERRAMIENTAS
                       GRATUITAS
                            │
                            ▼
                     USUARIO ANÓNIMO
                            │
                ┌───────────┴───────────┐
                ▼                       ▼
          Usa herramienta          Se registra
                │                       │
                │                    CUENTA ED1
                │                       │
                └───────────┬───────────┘
                            ▼
                        SEGMENTACIÓN
                            │
              ┌─────────────┼─────────────┐
              ▼             ▼             ▼
          Publicidad     Premium         SaaS
              │             │             │
              └─────────────┼─────────────┘
                            ▼
                          INGRESOS
                            │
                            ▼
                      MÁS PRODUCTOS
                            │
                            ▼
                       MÁS TRÁFICO
```

El objetivo es crear un **flywheel digital**:

```text
TRÁFICO
  ↓
UTILIDAD
  ↓
RETORNO
  ↓
CUENTA
  ↓
RELACIÓN
  ↓
PRODUCTO
  ↓
INGRESOS
  ↓
NUEVAS HERRAMIENTAS
  ↓
MÁS TRÁFICO
```

La arquitectura, la experiencia y el marketing deben estar diseñados para acelerar ese ciclo y no únicamente para aumentar pageviews.

## 2.1 Público objetivo (ICP) de la fase de validación **[H2]**

El flywheel solo gira si quien usa la herramienta gratuita es la misma persona que podría comprar el producto de la siguiente capa. Por eso ED1 declara un perfil de cliente ideal (ICP) para la validación:

| Dimensión | Definición |
|---|---|
| Quién | Pequeños negocios, independientes/freelancers, comercios con venta por redes/WhatsApp, agentes e inmobiliarias pequeñas |
| Dónde | Colombia primero, luego LATAM hispanohablante |
| Idioma | Español primero; i18n preparada en rutas y contenido, sin traducir hasta validar |
| Problema | Tareas administrativas y comerciales repetitivas (cotizar, cobrar, calcular impuestos y márgenes, publicar productos/inmuebles, compartir documentos) |
| Siguiente capa natural | Cuenta con historial → premium → ecommerce / inmobiliario / CRM |

Las utilidades genéricas (PDF, imágenes, texto) siguen existiendo como **tráfico de soporte** browser-first, pero no son el núcleo del embudo: sus usuarios rara vez pertenecen al ICP y compiten en el segmento más saturado.

**Excepciones declaradas [D3].** Un producto puede entrar antes de su fase (§33), o fuera del ICP, solo como **excepción declarada**: escrita, con su motivo, su alcance acotado y sus propias métricas de validación fijadas antes de medir. Hoy hay dos:

| Producto | Excepción a | Motivo | Dónde se acota |
|---|---|---|---|
| CultivoPro (agro) | ICP (§2.1) y fases (§33) | Hay una operación real, la finca cero, que registrar desde el trasplante | ARQUITECTURA ADR-2 y §2.3 |
| Tienda 3.0 (ecommerce) | Fase 7 (§33) | Dos tiendas 2.0 en operación ([D1]) y una plataforma ya probada. Se diseña desde cero, y los datos de las tiendas actuales se cargan después con scripts | TIENDA-3.0 §1.1 y §19; métricas del estudio de ecommerce §16.3 |

Las palabras clave de cada línea se miden, pero no bloquean estos proyectos ([D2]).

## 2.2 Posicionamiento **[H7]**

ED1 se diferencia en tres ejes:

1. **Privacidad:** “tus archivos no salen de tu navegador”.
2. **Contexto local:** normativa, formatos y costumbres de Colombia/LATAM (IVA, retención, UVT, cuentas de cobro, WhatsApp).
3. **Cero fricción:** sin registro obligatorio, sin marcas de agua, rápido.

---

# 3. Principios fundamentales

## 3.1 Free-first

Las herramientas de adquisición deben ser gratuitas para el usuario siempre que sea económicamente viable.

El objetivo es minimizar la fricción de entrada.

## 3.2 Cost-zero architecture

“Gratis para el usuario” no significa necesariamente “costo cero para el propietario”.

ED1 buscará minimizar el costo mediante:

- procesamiento en navegador;
- CDN/cache;
- serverless;
- almacenamiento temporal;
- free tiers;
- open source;
- eliminación automática de archivos;
- procesamiento asíncrono;
- caching;
- reducción de consultas de base de datos;
- generación estática cuando sea posible;
- jobs automáticos en GitHub Actions;
- presupuestos y límites de consumo.

La definición operativa de “costo cero” será:

> **No requerir gasto recurrente mientras el ecosistema opere dentro del presupuesto gratuito planificado y no se fuerce artificialmente el crecimiento fuera de ese envelope.**

## 3.3 Browser-first

Siempre que una operación pueda ejecutarse de forma segura en el navegador, se priorizará el procesamiento local.

```text
PDF / imagen / texto
        │
        ▼
     Navegador
        │
  ┌─────┼─────┐
  ▼     ▼     ▼
proceso conversión validación
  │     │     │
  └─────┴─────┘
        ▼
     descarga
```

Esto reduce costo, latencia, almacenamiento y exposición de datos.

Además de una decisión técnica, browser-first es un **pilar de marca** **[H7]**: la promesa “tu archivo no sale de tu dispositivo” debe ser visible en la interfaz y verificable (sin subidas de red durante el procesamiento).

## 3.4 Utility-first

Las herramientas deben resolver un problema real incluso sin publicidad.

La publicidad será una capa secundaria.

No se construirán páginas cuyo único propósito sea mostrar anuncios.

## 3.5 One ecosystem

La arquitectura evita la fragmentación.

El usuario tendrá una única identidad:

```text
CUENTA ED1
│
├── Herramientas
├── Archivos
├── Sitios
├── Proyectos
├── Ecommerce
├── Inmobiliario
└── Suscripciones
```

La identidad única la da el CORE: una persona, muchas organizaciones de muchos productos, con un token y una sesión por producto ([D6], §5.4, §16).

## 3.6 Automation-first

Las operaciones repetitivas deben ser automatizables.

El propietario no debería necesitar intervenir manualmente en:

- emails;
- expiraciones;
- clasificación;
- seguimiento;
- estadísticas;
- publicación;
- mantenimiento;
- tareas periódicas;
- despliegues;
- validaciones;
- pruebas;
- limpieza de artefactos temporales.

## 3.7 Owner-first

El sistema debe estar diseñado alrededor del propietario.

La administración normal debe realizarse desde un panel web.

La regla es:

> Si una operación comercial normal requiere modificar código, el sistema debe evolucionar para eliminar esa dependencia.

## 3.8 Git-as-control-plane

GitHub no será la base de datos de usuarios ni el runtime de los productos.

GitHub será el plano de control del software y del contenido versionable:

```text
Idea
 ↓
Issue / especificación
 ↓
Código / contenido
 ↓
Pull Request
 ↓
Tests / lint / checks
 ↓
Build
 ↓
Deploy
 ↓
Smoke tests
 ↓
Producción
```

Esto permite que el ecosistema crezca de manera repetible sin aumentar el trabajo operativo en la misma proporción.

## 3.9 Budget-first

Cada componente deberá tener:

- cuota objetivo;
- cuota de alerta;
- cuota de degradación;
- cuota de bloqueo;
- política de recuperación.

El sistema debe preferir fallar de forma útil antes que consumir silenciosamente recursos que conviertan una arquitectura “$0” en una arquitectura con cargos inesperados.

Los presupuestos se definen **por producto**, no solo a nivel global, y cada producto tiene un **kill switch** que permite desactivarlo sin afectar a los demás **[H3][H13]**.

## 3.10 Static-first **[H3]**

Toda página pública y toda herramienta browser-first se publica como **asset estático** (generación estática). En Cloudflare, las solicitudes a assets estáticos son gratuitas e ilimitadas; solo las que ejecutan el script del Worker consumen la cuota diaria.

Regla:

> El Worker solo atiende `/api/*` y operaciones que de verdad requieren servidor. Ninguna ruta pública pasa por el Worker por defecto (no se usa `run_worker_first` sobre páginas públicas).

**Desvío declarado [D3][V6].** Un producto multi-comercio con dominios de sus clientes, como la Tienda 3.0, no puede saber qué tienda le pidieron sin ejecutar algo, porque los assets estáticos se eligen por ruta y no por hostname. Ahí la ruta pública pasa por un **Worker de despacho**, con tres condiciones:

1. **No consulta la base:** entrega archivos horneados desde R2, con caché en el borde.
2. **Declara su costo:** una ejecución de alrededor de 1 ms por página.
3. **Vive en una cuenta paga,** donde el límite sube pagando y no corta la venta.

Detalle en TIENDA-3.0 §3.3.

## 3.11 Build-when-proven (regla de tres) **[H1]**

Una abstracción de plataforma (Product Engine, Automation Engine configurable, Admin OS, contrato de producto) se **extrae** cuando existen al menos **tres casos reales** que la usan, no antes.

El diseño completo de este documento es la **arquitectura objetivo**. Lo que se construye en cada fase es la **versión mínima** que esa fase justifica (ver §4.1 y §33).

## 3.12 Legible por agentes **[AR]**

Todo lo público de un producto debe poder **leerlo, entenderlo y usarlo un agente de IA** sin ejecutar JavaScript, sin adivinar y sin costo extra para el ecosistema. Es la extensión de tres principios:

- **Static-first:** lo que lee un agente se hornea con lo público y no pasa por el Worker:
  - `robots.txt` con reglas para agentes y señales de contenido;
  - `llms.txt`;
  - gemelos en Markdown;
  - habilidades (Agent Skills);
  - catálogos de API.
- **Browser-first, del lado del agente:** una herramienta que corre en el navegador se ofrece al agente como **habilidad**, con la fórmula, los rangos y las fuentes. El agente calcula en su propio entorno.
- **Budget-first:** lo que sí ejecuta servidor (MCP, autorización OAuth para agentes) tiene presupuesto, límites y kill switch.

**En comercio, el agente prepara y una persona confirma y paga** (§12.4, §5.5). Lo exige la Ley 1480 (aceptación verificable), y los medios de pago del ICP no aceptan pagos delegados. El detalle de cada comprobación (las 16 de isitagentready.com) está en PLATAFORMA §5.

---

# 4. Arquitectura conceptual consolidada

ED1 está compuesto por seis sistemas principales:

```text
ED1
│
├── CORE
├── PRODUCT ENGINE
├── AUTOMATION ENGINE
├── GROWTH ENGINE
├── MONETIZATION ENGINE
└── ADMIN OS
```

A estos se agregan dos capacidades transversales:

```text
ED1
│
├── RUNTIME PLANE
│   └── Cloudflare
│
└── DELIVERY & CONTROL PLANE
    └── GitHub + GitHub Actions
```

La arquitectura completa se entiende mejor así:

```text
                           ED1
                            │
         ┌──────────────────┼──────────────────┐
         │                  │                  │
         ▼                  ▼                  ▼
      PRODUCT            GROWTH           MONETIZATION
         │                  │                  │
         └──────────────────┼──────────────────┘
                            ▼
                           CORE
                            │
         ┌──────────────────┼──────────────────┐
         ▼                  ▼                  ▼
      AUTOMATION         ADMIN OS          ANALYTICS
                            │
                            ▼
                  RUNTIME + DATA PLATFORM
                            │
               ┌────────────┴────────────┐
               ▼                         ▼
           Cloudflare              GitHub Actions
```

## 4.1 Versión de validación vs arquitectura objetivo **[H1]**

| Sistema | Versión de validación (MVP) | Arquitectura objetivo | Se evoluciona cuando |
|---|---|---|---|
| CORE | Layout, SEO y eventos compartidos; luego auth + planes. **v1.3:** CORE v0 en producción (CultivoPro): Google OIDC, organizaciones, roles, directorio de celdas, tokens Ed25519 y cobro con Bold. Gana la **dimensión de producto** ([D6], §5.4) | Identidad, organizaciones, permisos, entitlements, billing, auditoría, **autorización para agentes** (§5.5) | Hay cuentas reales (Fase 3). **Cumplido** por la excepción del agro; el segundo producto (Tienda 3.0) dispara la dimensión de producto |
| PRODUCT ENGINE | Un archivo `product.yaml` por herramienta, validado por esquema en CI | Productos configurables desde el Admin OS | ≥ 10 herramientas |
| AUTOMATION ENGINE | Manejadores de eventos en código + Cron Triggers | Motor trigger → conditions → actions configurable | ≥ 3 automatizaciones que el propietario quiera cambiar sin código |
| GROWTH ENGINE | Contenido por herramienta, relacionados, sitemap, Search Console | Experimentación, segmentos, recomendaciones | Hay tráfico estable |
| MONETIZATION ENGINE | Lista de espera premium; AdSense con CMP | Premium, SaaS, servicios | Hay intención de pago medida |
| ADMIN OS | CMS basado en Git + tableros existentes + reporte semanal automático | Panel único y Command Center | Hay cuentas, leads y pagos que administrar |
| ANALYTICS | Web Analytics + Search Console + Analytics Engine | Embudos por cuenta y cohortes | Hay cuentas (Fase 3) |

---

# 5. CORE

El CORE proporciona servicios compartidos por todo el ecosistema.

Responsabilidades:

- autenticación;
- usuarios;
- sesiones;
- permisos;
- organizaciones;
- configuración;
- eventos;
- archivos;
- API;
- preferencias;
- dominios;
- planes;
- entitlements;
- auditoría.

El CORE no debe conocer detalles específicos de cada producto.

Se agrega explícitamente el componente **Billing** (planes, entitlements, adaptador del proveedor de pagos) **[H8]**.

## 5.1 Contrato de producto

Cada producto se conecta al CORE mediante contratos estables:

```text
PRODUCT ID
SLUG
TIPO
ESTADO
PLANTILLA
SEO CONFIG
MONETIZATION CONFIG
FEATURE FLAGS
PLAN RULES
ANALYTICS EVENTS
AUTOMATIONS
```

El objetivo es que añadir un producto sea principalmente configuración, contenido y componentes reutilizables.

En la fase de validación, el contrato es un **archivo versionado en Git** por producto, validado por esquema en CI **[H1]**:

```yaml
id: calculadora-iva
slug: /herramientas/calculadora-iva
tipo: utility
estado: activo            # borrador | activo | pausado | retirado
familia: negocios
icp: true
plantilla: tool-basic
runtime: browser          # browser | api
seo:
  title: "Calculadora de IVA en Colombia"
  description: "..."
monetizacion:
  ads: [despues-resultado]
  ads_en_procesamiento: false
relacionados: [calculadora-retencion, cotizador]
eventos: [tool.opened, tool.completed]
presupuesto:
  api_requests_dia: 0
kill_switch: true
```

## 5.2 Autenticación **[H10]**

Cloudflare no ofrece gestión de usuarios final; la cuenta ED1 se implementa con una librería de autenticación sobre Workers + D1 o con un proveedor con free tier, eligiendo por: costo cero hasta el volumen de validación, facilidad de migración y soporte de:

- **login con Google**;
- **magic link** por email (consume presupuesto de email, §25).

No se usan contraseñas en la fase de validación: menos soporte, menos riesgo.

**v1.3:**

- **Implementado en el CORE v0** (ARQUITECTURA §5.4): Google OIDC con PKCE (librería Arctic), sesiones con refresh rotado como máximo una vez al día, invitaciones de un solo uso con el código en el fragmento, y tokens Ed25519 que cada celda verifica sin llamar al CORE.
- **El enlace por correo** llega con el proveedor de correo (§20.2; PLATAFORMA §4.11).
- **Una sesión sirve a un solo producto** ([D6]).

## 5.3 Pagos y facturación **[H8]**

El proveedor de pagos es una decisión estructural y se toma antes de la fase de monetización. Opciones, todas con costo variable por transacción y sin costo fijo:

- **Merchant of Record internacional** (p. ej. Paddle, Lemon Squeezy, Polar): gestiona impuestos globales.
- **Pasarela local** (p. ej. Wompi, Mercado Pago, PayU, ePayco): PSE, Nequi, tarjetas locales; mejor para clientes colombianos.

Si se vende a clientes en Colombia, se contempla la **facturación electrónica DIAN** y el IVA de servicios digitales. El CORE se comunica con el proveedor a través de un adaptador para poder cambiarlo.

**v1.3:**

- **Proveedor elegido: Bold**, con su botón de pagos, detrás del adaptador `ProveedorDePago`. El monto lo calcula el CORE y la firma la hace el servidor. La verdad del pago se le pregunta a Bold, con conciliación por cron.
- **Planes prepagados de 1, 3 y 12 meses, sin débito automático** ([D4]).
  - Cuentan en meses calendario.
  - Cambiar de plan convierte en días lo que quedaba.
  - El cobro anual baja la comisión de Bold del 5,2 % al 3,1 % del ingreso.
  - Detalle en PLATAFORMA §4.8.
- **La facturación electrónica queda como gancho.** Hay un adaptador `DocumentoFiscal` sin activar, porque no hay contador que fije la obligación ([D5]).
- **En el ecommerce, el dinero de las ventas va directo a la cuenta de Bold de cada comercio.** El ecosistema no es el vendedor ni maneja fondos de terceros. Las llaves de cada comercio se guardan con cifrado de sobre (TIENDA-3.0 §9).

## 5.4 Dimensión de producto **[D6][HA5]**

El CORE no conoce detalles de cada producto (§5), pero sí **qué productos existen y qué declara cada uno**:

- tipos de organización;
- roles, con quién administra;
- planes con su precio por periodo;
- política de datos;
- orígenes y pantallas de vuelta de su app;
- celdas.

Esa lista es un archivo versionado (`infrastructure/productos.json`) que el despliegue copia a tablas de referencia. Las claves foráneas compuestas hacen imposibles en la base los cruces entre productos: un rol del agro en una tienda, o una tienda en una celda del agro. **Agregar un producto es un archivo y un despliegue, no una migración.**

Los tokens llevan el producto (`aud`), el plan y el instante de la última entrada. Cada celda los verifica sin llamar al CORE. El modelo de datos y la migración están probados en PLATAFORMA §4.

## 5.5 Autorización para agentes **[AR]**

Para que el agente de una persona actúe en su nombre (MCP), el CORE se vuelve **servidor de autorización OAuth 2.1**:

- metadatos RFC 8414;
- PKCE obligatorio;
- clientes por documento de metadatos o registro dinámico;
- recurso RFC 8707 en cada token;
- consentimiento por organización;
- revocación.

**Ningún alcance de agente mueve dinero.** La base lo impide (PLATAFORMA §5.4).

---

# 6. PRODUCT ENGINE

El Product Engine permite representar cualquier producto como una entidad configurable.

Ejemplos:

- conversor PDF;
- compresor de imágenes;
- QR generator;
- hosting temporal;
- generador de cotizaciones;
- ecommerce;
- SaaS inmobiliario.

Conceptualmente:

```text
PRODUCT
│
├── Página
├── Herramienta
├── SEO
├── Analytics
├── Monetización
├── Automatizaciones
├── Configuración
└── Entitlements
```

El objetivo es que agregar un nuevo producto sea principalmente una operación administrativa y de composición de componentes existentes.

---

# 7. AUTOMATION ENGINE

El Automation Engine será transversal.

Modelo:

```text
TRIGGER
   ↓
CONDITIONS
   ↓
ACTIONS
```

Ejemplo:

```text
Usuario publica sitio
        ↓
crear sitio
        ↓
registrar expiración
        ↓
enviar URL
        ↓
2 días antes
        ↓
enviar recordatorio
```

Eventos potenciales:

- user.created
- user.login
- tool.opened
- tool.completed
- lead.created
- site.created
- site.expiring
- site.expired
- payment.completed
- subscription.created
- subscription.cancelled
- deploy.completed
- seo.generated
- content.published
- quota.warning
- quota.exceeded

Acciones potenciales:

- enviar email;
- crear lead;
- asignar segmento;
- crear tarea;
- ejecutar webhook;
- mostrar recomendación;
- publicar contenido;
- suspender sitio;
- eliminar archivos;
- actualizar sitemap;
- generar reporte;
- abrir incidente interno.

## 7.1 Versión de validación **[H1]**

Mientras existan pocas automatizaciones, se implementan como **manejadores de eventos en código** (por ejemplo `on('site.expiring', enviarRecordatorio)`) y tareas periódicas con **Cron Triggers** del Worker (máximo 5 por cuenta en el plan gratuito, por lo que se agrupan en un único cron que despacha tareas).

El motor configurable trigger → conditions → actions se construye cuando haya al menos tres automatizaciones que el propietario necesite modificar sin tocar código.

---

# 8. GROWTH ENGINE

El Growth Engine transforma herramientas en adquisición de usuarios.

Componentes:

- SEO;
- páginas públicas;
- contenido;
- internal linking;
- analytics;
- leads;
- segmentos;
- recomendaciones;
- experimentación;
- páginas de comparación;
- páginas de casos de uso;
- contenido de ayuda.

El objetivo no es únicamente conseguir visitas.

El objetivo es:

```text
VISITA
 ↓
UTILIDAD
 ↓
RETORNO
 ↓
CUENTA
 ↓
RELACIÓN
 ↓
PRODUCTO
```

## 8.1 Motor de interconexión

Cada herramienta debe conocer otras herramientas relacionadas.

```text
TOOL A
│
├── Related Tool B
├── Related Tool C
├── SaaS D
└── Content E
```

La navegación interna debe estar basada en utilidad y contexto, no en enlaces arbitrarios.

---

# 9. MONETIZATION ENGINE

ED1 utilizará múltiples fuentes de ingresos.

## Publicidad

- AdSense;
- otros proveedores publicitarios compatibles.

La publicidad debe ser configurable por producto, posición y dispositivo.

## Premium

Funciones avanzadas:

- mayores límites;
- almacenamiento;
- eliminación de publicidad;
- funcionalidades avanzadas;
- historial;
- automatizaciones;
- exportaciones.

## SaaS

Productos empresariales:

- ecommerce;
- inmobiliario;
- CRM;
- operaciones;
- otros verticales.

## Servicios

Opcionalmente:

- implementación;
- configuración;
- servicios B2B.

---

# 10. Familias de productos

ED1 tendrá tres grandes familias.

## 10.1 Utilidades

Herramientas de uso frecuente.

### Documentos

- PDF;
- Word;
- imágenes;
- OCR;
- compresión;
- extracción.

### Imágenes

- resize;
- compresión;
- conversión;
- favicon;
- thumbnails.

### Texto

- contador;
- limpieza;
- JSON;
- Base64;
- URL encoding;
- UUID;
- hashes.

## 10.2 Web

Herramientas para crear y publicar.

- hosting temporal;
- HTML preview;
- QR;
- favicon;
- robots.txt;
- sitemap;
- meta tags;
- landing pages.

## 10.3 Negocios

Herramientas que conducen a productos SaaS.

- cotizaciones;
- facturas;
- margen;
- precios;
- UTM;
- enlaces WhatsApp;
- códigos de barras;
- ecommerce;
- CRM;
- inmobiliario.

## 10.4 Prioridad según el ICP **[H2]**

La familia **Negocios**, con contexto local, es el núcleo del embudo durante la validación. Ejemplos prioritarios:

- cotizaciones y cuentas de cobro;
- calculadoras de IVA, retención en la fuente, UVT y prestaciones sociales;
- margen, precio de venta y punto de equilibrio;
- enlaces, mensajes y catálogos de WhatsApp;
- QR para negocios;
- fichas de inmuebles y calculadoras de crédito hipotecario / arriendo.

Las familias **Utilidades** y **Web** aportan tráfico de soporte y se construyen solo en su versión browser-first.

**v1.3:** el ecommerce de la familia Negocios ya opera: dos tiendas 2.0 en producción ([D1]). Su versión definitiva, la Tienda 3.0, entra como excepción declarada ([D3], §2.1). El estudio de mercado de ecommerce recomienda acompañarla de herramientas gratuitas del ICP (rentabilidad del pedido, preparación de catálogo, diagnóstico de ficha), que alimentan su escalera.

---

# 11. Arquitectura de adquisición

Cada herramienta será potencialmente una landing SEO.

```text
Google
  ↓
/herramientas/comprimir-pdf
  ↓
Herramienta
  ↓
Resultado
  ↓
┌──────────────┬──────────────┬──────────────┐
│ herramienta  │ cuenta       │ producto     │
│ relacionada  │              │              │
└──────────────┴──────────────┴──────────────┘
```

La home será principalmente institucional y de navegación.

La adquisición ocurrirá principalmente en páginas profundas.

---

# 12. Estrategia SEO

Cada producto debe poder generar automáticamente:

- URL;
- title;
- meta description;
- canonical;
- sitemap;
- Open Graph;
- breadcrumbs;
- schema cuando corresponda;
- enlaces internos.

La estrategia será:

```text
Keyword
   ↓
Landing útil
   ↓
Herramienta
   ↓
Resultado
   ↓
Siguiente herramienta
```

No se generarán páginas de bajo valor únicamente para capturar keywords.

## 12.1 SEO como sistema editorial

SEO no se tratará como una colección de metadatos.

Cada página debe responder cuatro preguntas:

1. ¿Qué problema resuelve?
2. ¿Qué puede hacer el usuario inmediatamente?
3. ¿Qué resultado obtiene?
4. ¿Qué siguiente paso útil existe?

## 12.2 Quality gate por página **[H7]**

Ninguna página se publica si no supera un control verificable en CI:

- contenido propio, no una plantilla vacía;
- al menos un ejemplo real y un caso de uso;
- preguntas frecuentes específicas del problema;
- enlaces relacionados definidos en el contrato del producto;
- Core Web Vitals dentro del presupuesto de rendimiento;
- accesibilidad básica (WCAG AA).

Esto protege al ecosistema frente a las políticas de buscadores contra contenido escalado de bajo valor, que penalizan justamente los sitios con cientos de páginas similares.

## 12.3 Más allá del SEO **[H7]**

Las respuestas directas de IA en buscadores reducen los clics en consultas simples. ED1 mide y cultiva también el tráfico que no depende de Google: retorno directo, marcadores, enlaces compartidos (en especial por WhatsApp) y referidos. Es la mejor señal de utilidad real.

## 12.4 Preparación para agentes **[AR]**

Los asistentes y agentes de IA son un canal de descubrimiento y de uso. Cada producto genera, además de su SEO, lo que un agente necesita, y una prueba lo verifica contra staging antes de publicar (PLATAFORMA §5.8):

| Grupo | Qué se publica |
|---|---|
| Descubrimiento | `robots.txt` y `sitemap.xml` (con `lastmod`); cabeceras `Link` (RFC 8288) hacia el gemelo en Markdown, el catálogo de API y `llms.txt` |
| Contenido | Gemelos `.md` de cada página pública, con negociación `Accept: text/markdown` donde el producto ya pasa por un Worker o una regla de zona lo permita sin ejecutar el Worker; `llms.txt` |
| Control de bots | Reglas explícitas por familia de agentes y `Content-Signal` (`search=yes, ai-input=yes, ai-train=no`, salvo decisión distinta). Web Bot Auth solo si un producto opera un agente que visita sitios ajenos |
| Capacidades | Habilidades (Agent Skills) para las herramientas browser-first; catálogo de API (RFC 9727) cuando haya una API pública; MCP con su Server Card; OAuth del CORE (§5.5) |
| Comercio | Feeds de productos y traspaso a una persona. x402 y MPP no aplican al ICP. ACP y UCP se preparan sin publicar hasta que exista un medio de pago compatible en Colombia |

---

# 13. Publicidad

La publicidad será configurable por producto.

Ejemplo:

```text
Producto: Comprimir PDF

Publicidad:
✓ Activada

Posiciones:
✓ arriba
✓ después del resultado
✓ contenido relacionado
```

Los productos SaaS podrán no tener publicidad.

El objetivo es que la publicidad no perjudique:

- UX;
- confianza;
- conversión;
- velocidad.

La publicidad se entenderá como una monetización del tráfico adquirido por utilidad, no como el motivo de existir de la herramienta.

Reglas adicionales **[H9][H14]**:

- **No se muestran anuncios en la vista donde se procesan archivos sensibles**; solo antes o después del resultado. Protege la promesa de privacidad y el rendimiento.
- Para servir anuncios a usuarios del EEE, Reino Unido y Suiza, Google exige una **CMP certificada**; se usa la CMP de Google disponible en AdSense.
- La publicidad debe respetar el presupuesto de rendimiento de §12.2.

---

# 14. Hosting temporal

El hosting temporal será uno de los productos principales.

Flujo:

```text
ZIP
 ↓
Upload
 ↓
Validación
 ↓
R2
 ↓
Publicación
 ↓
HTTPS
 ↓
URL
 ↓
Expiración
```

El producto estará orientado a:

- demos;
- diseñadores;
- desarrolladores;
- agencias;
- estudiantes;
- landing pages;
- campañas;
- sitios temporales.

Monetización conceptual:

```text
GRATIS
7 días
  ↓
RENOVACIÓN
  ↓
PLAN MENSUAL
```

El hosting será estrictamente estático.

No se permitirá ejecutar código arbitrario del usuario en infraestructura ED1.

## 14.1 Aislamiento y antiabuso **[H5]**

“Estático” no equivale a “seguro”: el HTML y JavaScript del usuario se ejecutan en el navegador de quien visita el sitio, y el hosting gratuito es un vector habitual de páginas de phishing. Si ese contenido se sirviera bajo el dominio principal, el ecosistema completo podría acabar en listas de sitios peligrosos y perder SEO, AdSense y confianza.

Por eso:

- Los sitios de usuarios se sirven en un **dominio registrable separado** del dominio principal (patrón `github.io` / `netlify.app`) y, preferiblemente, en **otra cuenta de Cloudflare para aislar el riesgo** (abuso, reputación, suspensión), **paga y propia de ese producto**. Nunca una cuenta gratuita para sumar cuota: los términos de Cloudflare prohíben esquivar límites ([HA1]; §22.2). A mediano plazo se solicita su inclusión en la Public Suffix List.
- Publicar requiere **cuenta + Turnstile**. Ojo: Turnstile gratuito admite 10 hostnames por widget, así que no sirve como defensa de sitios en dominios de clientes; ahí mandan los límites por IP y por cuenta ([PC]).
- Validaciones al subir: tamaño, número de archivos, extensiones permitidas, ZIP traversal, detección de formularios de credenciales/pago y de marcas conocidas.
- Encabezados: CSP restrictiva y `X-Robots-Tag: noindex` para sitios gratuitos.
- **Flujo de abuso**: enlace “reportar” en cada sitio, buzón `abuse@`, suspensión con un clic desde el Admin y registro de quién publicó qué.
- **Términos de uso** específicos del hosting (contenido prohibido, retiro, responsabilidad).

Si los dominios de usuario llegan a usar dominio propio, se evalúa Cloudflare for SaaS (hostnames personalizados).

---

# 15. Conversores de documentos

El sistema tendrá dos modalidades.

## Browser-first

Cuando sea técnicamente viable:

```text
Archivo
 ↓
Browser
 ↓
Procesamiento
 ↓
Download
```

## Server-side

Cuando sea necesario:

```text
Archivo
 ↓
Worker
 ↓
Queue
 ↓
Workflow
 ↓
Resultado
```

Los archivos temporales deberán tener políticas de eliminación.

La regla será:

> Si el archivo no necesita salir del navegador, no debe salir del navegador.

## 15.1 Alcance de la modalidad server-side **[H6]**

En el plan gratuito, un Worker dispone de **10 ms de CPU** por invocación; Queues y Workflows orquestan pero no aportan cómputo adicional. No existe, por tanto, cómputo gratuito para conversiones pesadas (Word → PDF con fidelidad, OCR de gran volumen, compresión intensiva).

Además, los términos de GitHub prohíben usar Actions como parte de una aplicación serverless o para trabajo no relacionado con construir, probar o publicar el software del repositorio. **GitHub Actions nunca procesa archivos ni solicitudes de usuarios.**

En consecuencia:

- En la fase de validación **solo se lanzan herramientas 100 % viables en el navegador** (pdf-lib, pdf.js, Canvas/WebCodecs, WASM, tesseract.js).
- Las conversiones que requieren servidor quedan fuera del alcance hasta que un ingreso las pague, o se ofrecen como **premium**.
- Se revisan las **licencias** de las librerías: se prefieren MIT/Apache; las AGPL (p. ej. Ghostscript, MuPDF) solo se usan asumiendo sus obligaciones.

---

# 16. Cuenta única

La cuenta será transversal.

El usuario podrá acceder a:

```text
MI CUENTA
│
├── Historial
├── Herramientas
├── Archivos
├── Sitios
├── Proyectos
├── Ecommerce
├── Inmobiliario
└── Facturación
```

No todos los módulos deben ser visibles para todos los usuarios.

La visibilidad debe derivarse de permisos y contexto de producto.

**v1.3 [D6]:** la cuenta única la implementa el CORE.

- **Una persona** puede pertenecer a organizaciones de varios productos, con un rol en cada una (por ejemplo, propietaria de una finca y colaboradora de una tienda).
- **Cada app pide un token de su producto,** y su sesión solo sirve para ese producto. Un refresh robado de una app no abre la otra.
- **Qué ve cada persona** sale de la membresía y del plan de cada organización (PLATAFORMA §4).

---

# 17. Analítica

ED1 tendrá analytics propios basados en eventos.

Ejemplos:

- page.view
- tool.opened
- tool.started
- tool.completed
- download
- signup.started
- signup.completed
- lead.created
- product.clicked
- subscription.started
- subscription.cancelled

El sistema distinguirá:

- usuario anónimo;
- usuario registrado;
- cliente;
- suscriptor.

La analítica deberá estar diseñada para responder preguntas de negocio, no únicamente preguntas de tráfico.

## 17.1 Arquitectura de analítica a costo cero **[H4]**

Escribir cada evento en D1 consumiría la cuota de escritura que necesitan cuentas, leads y sitios, y cada envío sería una invocación del Worker. La analítica se organiza en tres capas:

```text
TRÁFICO        → Cloudflare Web Analytics (sin cookies)
ADQUISICIÓN    → Google Search Console
PRODUCTO       → Workers Analytics Engine
                 (eventos agrupados en lote desde el navegador,
                  muestreo en eventos de alto volumen)
NEGOCIO        → D1 (solo cuenta creada, lead, pago, suscripción)
```

Workers Analytics Engine aún no factura según Cloudflare; su cuota se re-verifica antes de depender de él.

---

# 18. Métricas estratégicas

El dashboard del propietario mostrará:

## Adquisición

- visitantes;
- fuente;
- keywords;
- páginas de entrada.

## Activación

- herramientas iniciadas;
- herramientas completadas;
- descargas.

## Retención

- retorno 1 día;
- 7 días;
- 30 días.

## Conversión

- visitante → cuenta;
- cuenta → lead;
- lead → SaaS;
- trial → pago.

## Monetización

- ingresos publicitarios;
- MRR;
- ARPU;
- LTV;
- CAC (con adquisición orgánica, el costo principal es el tiempo del propietario: se mide en horas o en su valor) **[H16]**.

## Infraestructura

- coste por usuario;
- almacenamiento;
- requests;
- operaciones;
- errores;
- consumo por servicio;
- cuota restante.

---

# 19. Indicadores de salud del ecosistema

Se propone mantener como indicador central:

```text
Ecosystem Revenue per User = Ingresos del ecosistema / Usuarios activos
```

Complementado por:

```text
Cost per Activated User
Active Tool Rate
Return User Rate
Tool → Account Conversion
Account → Product Conversion
Quota Utilization
Revenue per Compute Unit
```

No se optimizará una métrica aislada.

## 19.1 Métricas de validación por fase **[H16]**

Durante la validación el ingreso es cercano a cero, así que cada fase declara la hipótesis que valida, su métrica y su umbral. Los valores son de partida y se calibran con datos reales:

| Fase | Hipótesis | Métrica | Umbral a 90 días |
|---|---|---|---|
| Utility MVP | Las herramientas resuelven algo real | `tool.completed / tool.opened` | ≥ 60 % |
| Utility MVP | Hay demanda orgánica | Impresiones en Search Console | Crecimiento semanal sostenido |
| Growth | Hay retorno | Usuarios que vuelven en 30 días | ≥ 15 % |
| Cuenta | La cuenta aporta valor | Visitante → cuenta | ≥ 1–2 % |
| Monetización | Hay intención de pago | Clics en premium / lista de espera | ≥ 3 % de las cuentas |

**Criterio de pivote:** si tras el plazo no se alcanzan los umbrales, se revisa el ICP o la familia de herramientas **antes** de construir más plataforma.

**v1.3:**

- **Una excepción declarada** (§2.1) se mide con **sus** métricas, fijadas antes de medir: pago real, soporte por comercio, retención y cobro confiable para el ecommerce (estudio de ecommerce §16.3).
- **Las palabras clave se miden en todas las líneas, pero no bloquean una excepción declarada** ([D2]).

---

# 20. Seguridad

Todas las herramientas deberán considerar:

- rate limiting;
- validación de inputs;
- Turnstile;
- límites por usuario;
- límites por IP;
- expiración de archivos;
- validación MIME;
- magic bytes;
- protección ZIP traversal;
- protección contra abuso;
- logging;
- gestión de secretos;
- separación de privilegios;
- aislamiento de contenido no confiable (dominio y cuenta separados para contenido de usuarios, ver §14.1).

## 20.1 Legal y privacidad **[H9]**

- **Ley 1581 de 2012 (habeas data):** política de tratamiento de datos, autorización del titular y canal de consultas y reclamos. Se verifica si aplica el registro en el RNBD de la SIC.
- **Términos y condiciones** generales y del hosting temporal.
- **Consentimiento** para publicidad (CMP, §13) y política de cookies.
- **Licencias open source** de las dependencias (§15.1).
- **v1.3 [D5]:** sin abogado ni contador por ahora.
  - Cada obligación legal se traduce en un **control técnico verificable**, con su prueba.
  - En el ecommerce, por ejemplo:
    - Ley 1480 y Ley 2439 de 2024: ficha legal sin la cual no se publica, aceptación verificable, solicitudes con radicado y retracto por producto.
    - Ley 1581: contrato de transmisión con el comercio, cifrado de los datos de compradores y plazos de consulta y reclamo en días hábiles.
  - Las plantillas legales viven en un solo sitio, así que corregirlas es cambiar una plantilla y regenerar.
  - Un abogado las revisa cuando haya presupuesto (TIENDA-3.0 §14).

## 20.2 Email **[H11]**

- Proveedor de email transaccional con free tier y cuota diaria incluida en el ZCOE.
- **SPF, DKIM y DMARC** configurados desde el primer envío.
- **Cloudflare Email Routing** (gratuito) para recibir `soporte@` y `abuse@`.
- **v1.3 [PC]:**
  - El envío de Cloudflare (Email Service, beta pública desde abril de 2026) solo envía a direcciones verificadas en el plan gratuito, y a cualquiera en Workers Paid, con 3.000 al mes incluidos.
  - Primera opción en la cuenta paga.
  - Respaldo, o principal mientras el CORE siga en la gratuita: Resend o Brevo, detrás del adaptador `CorreoTransaccional` (§22.3).

## 20.3 Continuidad, respaldos y plan de salida **[H12][H15]**

- D1 ofrece Time Travel de 7 días en el plan gratuito; además se hace un **respaldo semanal** exportando D1 a R2 mediante un Cron Trigger del Worker (no mediante GitHub Actions si el respaldo contiene datos personales).
- La lógica de negocio vive en paquetes independientes del runtime para poder migrar si fuera necesario.
- El dominio principal se protege con 2FA y contactos de recuperación separados de la cuenta operativa. Una suspensión de la cuenta de Cloudflare o GitHub no debe impedir recuperar datos ni dominio.
- **v1.3:**
  - **Time Travel:** en Workers Paid son 30 días.
  - **Una copia mensual, ya cifrada, fuera de Cloudflare** (Google Cloud Storage o Backblaze B2, §22.3) cubre la suspensión de la cuenta.
  - **Restaurar se prueba con un simulacro trimestral.**
  - **Reconstruir una tabla en D1 sigue una receta probada:** con claves foráneas diferidas, el arreglo habitual deja pasar violaciones reales sin avisar ([HA8]; PLATAFORMA §4.4).

---

# 21. Filosofía de infraestructura

La arquitectura seguirá esta prioridad:

```text
1. Browser
2. CDN / Cache
3. Static assets
4. Serverless
5. Queue
6. Workflow
7. almacenamiento temporal
8. infraestructura pesada
```

La idea se amplía con una segunda dimensión:

```text
BUILD → TEST → DEPLOY → OPERATE → OBSERVE → CLEANUP
```

GitHub Actions será el mecanismo de automatización del ciclo de software; Cloudflare será el entorno de ejecución.

---

# 22. Cloudflare como infraestructura principal

Arquitectura conceptual:

```text
                           CLOUDFLARE
                               │
                ┌──────────────┼──────────────┐
                │              │              │
               DNS            CDN          SSL/TLS
                │              │              │
                └──────────────┼──────────────┘
                               │
                             Workers
                               │
                ┌──────────────┼──────────────┐
                │              │              │
               D1             R2            Queue
                │              │              │
                │              │           Workflow
                │              │              │
                └──────────────┼──────────────┘
                               │
                           ED1 CORE
```

## 22.1 Rol de cada servicio

### Workers

Runtime HTTP, APIs ligeras, SSR cuando sea necesario, endpoints, routing y automatizaciones pequeñas. Las páginas públicas y las herramientas browser-first se sirven como **static assets** (gratuitos e ilimitados) y no invocan el Worker **[H3]**.

### D1

Datos relacionales operativos de baja complejidad y fuerte orientación a lectura.

En el plan gratuito cada base tiene un máximo de **500 MB** (10 bases, 5 GB en total por cuenta) **[H12]**. Se separa desde el inicio:

```text
core       → usuarios, cuentas, planes, entitlements
business   → leads, sitios, eventos de negocio
<vertical> → una base por SaaS vertical cuando llegue
```

**v1.3:**

- En Workers Paid cada base llega a 10 GB, con 50.000 bases por cuenta.
- D1 aplica siempre las claves foráneas.
- Para cambiar un `CHECK` hay que rehacer la tabla con la receta de PLATAFORMA §4.4 ([HA8]).
- Lo que va a crecer (estados, roles, planes) va en tablas de referencia, no en `CHECK`.

### KV

Configuración, feature flags y kill switches que cambian poco (el plan gratuito permite 1.000 escrituras/día). No se usa para contadores ni sesiones.

### R2

Objetos, archivos y assets temporales o persistentes que requieran almacenamiento separado del runtime.

### Queues

Desacoplamiento de tareas y protección frente a picos.

### Workflows

Procesos durables que necesiten espera, reintentos, pasos o temporización.

### CDN / Cache / Assets

Entrega eficiente de recursos estáticos y reducción del trabajo en Worker.

## 22.2 Cuentas, propósito y graduación **[PC][HA1][HA6]**

Las cuotas gratuitas son por cuenta, y los términos prohíben abrir cuentas para esquivarlas ([HA1]). El ecosistema tiene tres cuentas, y cada una declara **un propósito**:

| Cuenta | Plan | Propósito |
|---|---|---|
| Principal | Gratuita | **Laboratorio de validación:** productos antes de sus umbrales, sitios estáticos, la celda c0 del agro, el CORE en esta etapa y las tiendas 2.0 hasta que se carguen en la 3.0 |
| Segunda | Gratuita | Un propósito declarado y sin producción, o se cierra. **Nunca** la segunda mitad de un producto para sumar cuota |
| Plataforma | **Workers Paid** (USD 5/mes) | **Lo que cobra:** la Tienda 3.0, la zona del dominio de tiendas y las celdas que gradúan. Después, el CORE, cuando se cumpla su disparador |
| (Futura) | Paga | Contenido no confiable de usuarios (hosting temporal, §14): aislamiento de riesgo |
| De clientes | La del cliente | Celdas dedicadas, con acceso de miembro para el ecosistema |

**Graduar** un producto de la gratuita a la paga es mudar sus organizaciones a una celda nueva (ARQUITECTURA §6.4). Pasa con el primero de tres disparadores:

- el producto pasa el 50 % de su presupuesto 7 días seguidos;
- entra su primer cliente que paga;
- necesita algo que solo da la paga.

En la cuenta paga no hay corte sino factura, y según la investigación no hay tope duro de gasto. Por eso cada producto declara además un **presupuesto en dinero**, y el vigía proyecta el costo del mes (§25.1). Detalle en PLATAFORMA §3 y `analisis/cuenta-cloudflare-paga.md`.

## 22.3 Proveedores complementarios y su gobierno **[PC]**

Cloudflare es el plano de ejecución y GitHub el de construcción. **Otro proveedor entra solo si da una capacidad que falta**, no si duplica una que ya hay, y si pasa ocho criterios:

1. Uso comercial permitido en el plan que se usa.
2. Tope duro, o el plan se detiene al agotarse.
3. DPA en ese plan.
4. Región en Suramérica, o en Estados Unidos o la UE con contrato de transmisión.
5. Salida en formatos estándar.
6. Crecer sin multiplicar cuentas.
7. Integración detrás de un adaptador.
8. Credencial de alcance mínimo.

**Lo que se adopta:**

- un respaldo fuera de Cloudflare (Google Cloud Storage o Backblaze B2);
- Sentry y Healthchecks.io para errores y crons;
- un proveedor de correo de respaldo (Resend o Brevo);
- Orama (código abierto) para búsqueda dentro de la app.

**Lo que queda en reserva, con disparador:** Cloud Run en São Paulo, Neon, Upstash e Inngest.

**Lo que se descarta:**

- Vercel Hobby, porque prohíbe el uso comercial;
- GitHub Pages para negocios y Actions como backend, porque lo prohíben sus términos;
- los que duplican Workers o no tienen tope.

Los proveedores se registran en `infrastructure/proveedores.json`. Una prueba exige que todo host externo del código y de las CSP esté en ese registro, y las políticas de datos nombran a sus subencargados desde él. Detalle en `analisis/proveedores-de-computo.md`.

---

# 23. GitHub como segundo plano de infraestructura

GitHub tendrá cuatro papeles principales.

## 23.1 Source of truth del software

```text
Repositorio
├── apps
├── packages
├── infrastructure
├── content
├── schemas
├── tests
└── docs
```

## 23.2 CI/CD

Cada cambio debe recorrer:

```text
commit
 ↓
lint
 ↓
typecheck
 ↓
unit tests
 ↓
build
 ↓
security checks
 ↓
deploy preview / staging
 ↓
smoke test
 ↓
production
```

## 23.3 Automatización periódica

GitHub Actions podrá ejecutar, según necesidad:

- auditorías;
- validaciones;
- generación de sitemaps;
- chequeos de enlaces;
- pruebas de endpoints;
- mantenimiento de dependencias;
- generación de contenido predefinido;
- reportes de consumo;
- tareas de housekeeping;
- smoke tests programados sobre los endpoints propios;
- el **reporte semanal** del propietario (§31.1).

**Límite explícito [H6]:** GitHub Actions no se usa para procesar archivos, solicitudes ni datos de usuarios; eso infringiría sus términos (uso como aplicación serverless o trabajo no relacionado con el software del repositorio).

## 23.3.1 Estrategia de repositorios

- **Monorepo privado** para CORE, Admin y SaaS.
- **v1.3 [HA4]:** el monorepo de la plataforma es el repositorio de CultivoPro **renombrado**, no uno nuevo con la historia movida. Renombrar conserva los secretos, los ambientes, los issues y la historia. La Tienda 3.0 entra como `apps/tienda-*` (PLATAFORMA §6).
- Opcionalmente, las herramientas browser-first en un **repositorio público**: minutos de Actions sin costo en runners estándar y confianza de marca (código auditable que respalda la promesa de privacidad).

## 23.4 Gobernanza

GitHub deberá ser el mecanismo para controlar cambios en:

- código;
- infraestructura como código;
- configuración;
- esquemas;
- contenido versionable;
- plantillas;
- políticas.

---

# 24. Arquitectura dual: Runtime + Delivery

```text
                    GITHUB
                      │
                 Git repository
                      │
                GitHub Actions
                      │
          ┌───────────┼───────────┐
          ▼           ▼           ▼
       Test/Build   Migrations   Deploy
          │           │           │
          └───────────┼───────────┘
                      ▼
                  CLOUDFLARE
                      │
       ┌──────────────┼──────────────┐
       ▼              ▼              ▼
    Workers           D1             R2
       │              │              │
       └──────────────┼──────────────┘
                      ▼
                   Usuarios
```

Esto evita confundir “automatización de desarrollo” con “automatización de producción”. Son complementarias, no intercambiables.

---

# 25. Estrategia de operación a $0

La premisa de costo cero se organizará en un **Zero-Cost Operating Envelope (ZCOE)**.

```text
ZCOE
│
├── Compute budget
├── Requests budget
├── D1 budget
├── R2 budget
├── Queue budget
├── Workflow budget
├── GitHub Actions budget
├── Email/API budget
└── Human time budget
```

El último componente es importante:

> El sistema debe minimizar también el costo de tiempo del propietario.

Una arquitectura que no cobra dinero pero requiere horas manuales todos los días no cumple el objetivo económico completo de ED1.

## 25.1 Presupuestos por producto y aislamiento **[H3][H13]**

Las cuotas gratuitas son **por cuenta** y todos los productos las comparten. Por eso:

- cada producto declara su presupuesto en su contrato (`presupuesto` en `product.yaml`);
- cada producto tiene **kill switch** en KV;
- los productos con contenido no confiable o picos impredecibles (hosting temporal) viven en **otra cuenta/zona**, paga y propia, para aislar el **riesgo**; nunca una cuenta gratuita para sumar cuota ([HA1], §22.2);
- **v1.3 [PC]:** en una cuenta paga, cada producto declara también su **presupuesto en dinero** (`usd_mes`). El vigía proyecta el costo del mes y apaga primero las capacidades accesorias (MCP, horneado), nunca la venta;
- las alertas de cuota llegan por email o mensajería antes del umbral de degradación.

El número de horas semanales disponibles del propietario se declara explícitamente: es el límite real del ZCOE.

---

# 26. Diseño anti-crecimiento accidental

El sistema no debe asumir que “más tráfico siempre es mejor”.

Debe asumir:

```text
MÁS TRÁFICO
    ↓
MÁS CONSUMO
    ↓
MÁS CUOTA UTILIZADA
    ↓
¿MONETIZA SUFICIENTEMENTE?
```

Cuando la respuesta sea no, el sistema deberá poder:

- activar cache más agresivo;
- reducir operaciones dinámicas;
- limitar funciones costosas;
- aumentar esperas o colas;
- reducir almacenamiento temporal;
- desactivar features no críticas;
- exigir login en operaciones de alto costo;
- reservar funciones costosas para planes premium.

---

# 27. Diseño del producto gratuito

La herramienta gratuita debe tener tres capas:

```text
CAPA 1 — Utility
La tarea funciona.

CAPA 2 — Return
Existe un motivo para regresar.

CAPA 3 — Relationship
Existe un motivo razonable para crear una cuenta.
```

La cuenta no debe ser obligatoria para cada interacción.

Debe ser una evolución natural del uso recurrente.

---

# 28. Estrategia de conversión

El ecosistema debe evitar el patrón:

```text
VISITA → POPUP → REGISTRO
```

Y favorecer:

```text
VISITA
 ↓
RESUELVE PROBLEMA
 ↓
OBTIENE RESULTADO
 ↓
DESCUBRE MEJORAS / HISTORIAL / SIGUIENTE HERRAMIENTA
 ↓
CUENTA
 ↓
PRODUCTO
```

La monetización debe aparecer cuando el usuario percibe valor adicional, no antes de que experimente la utilidad principal.

---

# 29. Product factory

Una de las capacidades estratégicas de ED1 será la **Product Factory**.

La idea:

```text
KEYWORD / PROBLEMA
        ↓
SPEC
        ↓
COMPONENTES REUTILIZABLES
        ↓
TEMPLATE
        ↓
TOOL
        ↓
SEO PAGE
        ↓
ANALYTICS
        ↓
MONETIZATION
        ↓
DEPLOY
```

Una nueva herramienta no debe convertirse en un proyecto nuevo desde cero.

Debe ser una composición de:

- UI;
- lógica;
- schema;
- SEO metadata;
- eventos;
- reglas de monetización;
- enlaces relacionados;
- pruebas.

---

# 30. Content factory

El mismo principio debe aplicarse al contenido.

```text
TEMA
 ↓
BRIEF
 ↓
PLANTILLA
 ↓
CONTENIDO
 ↓
VALIDACIÓN
 ↓
INTERNAL LINKING
 ↓
SITEMAP
 ↓
PUBLICACIÓN
```

GitHub Actions puede automatizar validaciones y generación de artefactos derivados cuando la política editorial lo permita.

No se usará generación automática para crear páginas de bajo valor a escala.

---

# 31. Administración y Owner OS

El propietario debe poder administrar:

- productos;
- herramientas;
- contenido;
- SEO;
- usuarios;
- leads;
- automatizaciones;
- publicidad;
- planes;
- métricas;
- configuración;
- feature flags;
- cuotas;
- incidentes.

Desde un único panel.

## Dashboard conceptual

```text
ECOSISTEMA

Usuarios
├── Nuevos usuarios
├── Usuarios activos
└── Herramientas usadas

Ingresos
├── Publicidad
├── Premium
└── SaaS

Costos / Cuotas
├── Infraestructura
├── Email
├── APIs
└── Free tier utilization

Growth
├── SEO
├── Landing pages
├── Conversiones
└── Retención

Alertas
├── Cuotas
├── Errores
├── Seguridad
└── Oportunidades
```

El dashboard debe servir para tomar decisiones, no solamente para consultar datos.

## 31.1 Owner OS en la fase de validación **[H1]**

Antes de construir un panel propio, el Owner OS se compone de piezas existentes que ya son paneles web:

- **CMS basado en Git** (p. ej. Keystatic, Decap o edición Markdown en la web de GitHub): el propietario edita contenido y contratos de producto desde el navegador y GitHub Actions publica. Cumple *owner-first* y *Git-as-control-plane* sin desarrollar un CMS.
- Tableros de **Cloudflare, Search Console y AdSense**.
- **Reporte semanal automático** generado por GitHub Actions a partir de las APIs de analítica y enviado por email: responde las preguntas del Command Center (§32) en su versión mínima.

El panel propio se construye cuando existan cuentas, leads y pagos que administrar.

---

# 32. Command center del propietario

El Owner OS debería evolucionar desde un dashboard pasivo a un **Command Center**:

```text
TODAY
│
├── What changed?
├── What broke?
├── What grew?
├── What is near limit?
├── What earns money?
├── What converts?
└── What should be reviewed?
```

Las respuestas deben provenir de eventos y métricas del ecosistema.

---

# 33. Roadmap conceptual consolidado

El roadmap se reordena para respetar el modelo de madurez (§36) y la regla de tres (§3.11) **[H1]**. Cada fase tiene una condición de paso medible (§19.1).

| Fase | Contenido | Condición para pasar |
|---|---|---|
| 0 — Decisiones | ICP, marca pública, idioma, 5 herramientas iniciales, métricas de validación, política de datos y términos | Documento aprobado |
| 1 — Utility MVP estático | 5 herramientas browser-first del ICP, generación estática, cascarón compartido (layout, SEO, relacionados, eventos), repositorio + CI/CD, Web Analytics + Search Console | Publicado e indexado |
| 2 — Growth | Contenido útil por herramienta, internal linking, quality gate en CI, 5–10 herramientas más | Umbrales de completado e impresiones |
| 3 — Cuenta y retorno | Autenticación (Google + magic link), historial/favoritos, email transaccional, D1 `core` | Retorno ≥ umbral |
| 4 — Monetización ligera | AdSense con CMP (fuera de vistas sensibles), lista de espera premium, proveedor de pagos | Intención de pago ≥ umbral |
| 5 — Extracción de plataforma | Product Engine, automatizaciones configurables y Admin OS, extraídos de lo que ya existe | ≥ 3 casos reales por abstracción |
| 6 — Hosting temporal | Dominio y cuenta separados, antiabuso, términos, expiración | Controles de §14.1 implementados |
| 7 — Primer vertical SaaS | El vertical (ecommerce o inmobiliario) con más señal en las fases 2–4 | — |
| 8 — Segundo vertical SaaS | El vertical restante, sobre los componentes ya probados | — |

**v1.3, estado real ([D3]):**

- **Fase 3.** Su núcleo (autenticación con Google, cuentas y CORE) ya existe, construido por la excepción del agro.
- **Fase 7, ecommerce.** Se adelanta como excepción declarada: la Tienda 3.0 se construye por hitos (TIENDA-3.0 §19) mientras la 2.0 sigue vendiendo.
- **Lo que no se adelanta:**
  - las abstracciones de plataforma de la fase 5, que siguen esperando su tercer caso (§3.11). Son el Product Engine y las automatizaciones configurables;
  - el hosting temporal de la fase 6.

---

# 34. Criterio para decidir qué construir

Una nueva herramienta debería pasar por cinco filtros:

```text
¿Resuelve una necesidad real?
        ↓
¿Puede ejecutarse barato?
        ↓
¿Tiene potencial de búsqueda / descubrimiento?
        ↓
¿Conecta con otro producto?
        ↓
¿Puede operar con componentes existentes?
        ↓
¿Su usuario pertenece al ICP o compra algún
producto de la escalera?                      [H2]
```

La respuesta positiva en los seis no obliga a construirla, pero hace que merezca evaluación.

---

# 35. Criterio para retirar una herramienta

Una herramienta puede ser candidata a desactivación si durante un periodo suficiente presenta combinación de:

- bajo uso;
- baja retención;
- bajo valor estratégico;
- alto costo relativo;
- problemas de seguridad;
- mantenimiento desproporcionado;
- ausencia de relación con otros productos.

La capacidad de retirar es tan importante como la capacidad de lanzar.

---

# 36. Arquitectura de madurez

ED1 debe crecer por capas:

```text
NIVEL 0
Static utility

NIVEL 1
Worker/API

NIVEL 2
Persistent state

NIVEL 3
User accounts

NIVEL 4
Automation

NIVEL 5
Monetization

NIVEL 6
SaaS vertical
```

No se debe incorporar una capa superior mientras la anterior no esté económicamente justificada.

---

# 37. Principio de separación de costos

Cada usuario puede generar:

```text
TRÁFICO
COMPUTE
STORAGE
DATABASE
QUEUE
WORKFLOW
EMAIL
SUPPORT
```

El sistema debe medir esos componentes individualmente.

Esto permitirá conocer:

```text
Revenue per User
vs
Infrastructure Cost per User
```

y, más importante todavía:

```text
Revenue per User
vs
Operational Complexity per User
```

---

# 38. Modelo de negocio del ecosistema

El modelo de negocio será una escalera:

```text
FREE UTILITY
      ↓
REPEAT USER
      ↓
ACCOUNT
      ↓
PREMIUM
      ↓
BUSINESS TOOL
      ↓
SAAS
      ↓
SERVICES / B2B
```

No todos los usuarios recorrerán toda la escalera.

El objetivo es disponer de una escalera y que cada usuario encuentre una siguiente capa relevante.

---

# 39. Ventaja estratégica buscada

La ventaja de ED1 no sería una sola herramienta.

Sería la combinación:

```text
MÁS HERRAMIENTAS
      +
MÁS PÁGINAS ÚTILES
      +
MÁS DATOS DE USO
      +
MÁS COMPONENTES REUTILIZABLES
      +
MÁS AUTOMATIZACIÓN
      +
MÁS PRODUCTOS
```

Cada nueva pieza debe aumentar la utilidad de las demás.

---

# 40. Principio empresarial final

ED1 no se optimizará herramienta por herramienta.

Se optimizará el ecosistema:

```text
TRÁFICO
   ↓
UTILIDAD
   ↓
USUARIO
   ↓
RETENCIÓN
   ↓
RELACIÓN
   ↓
PRODUCTO
   ↓
INGRESOS
   ↓
NUEVAS HERRAMIENTAS
   ↓
MÁS TRÁFICO
```

La herramienta gratuita es el punto de entrada.

La cuenta es la relación.

El SaaS es una de las principales capas de monetización.

La automatización reduce el costo operativo.

Cloudflare ejecuta el producto; lo público se sirve estático.

GitHub Actions industrializa la construcción y operación técnica, nunca el procesamiento de datos de usuarios.

La plataforma se extrae de productos reales, no se construye antes que ellos.

El presupuesto gratuito condiciona la arquitectura.

El ecosistema es el activo estratégico.

---

# 41. Anexo — Envelope de costo cero validado

Las cuotas cambian con el tiempo y deben volver a verificarse antes de activar nuevas cargas. Como referencia operativa para septiembre de 2026:

| Componente | Cuota gratuita relevante | Implicación de diseño |
|---|---:|---|
| Cloudflare Workers Free | 100.000 requests/día; 10 ms CPU por invocación | Browser/CDN primero; APIs pequeñas; evitar cómputo pesado síncrono |
| Cloudflare D1 Free | 5 M filas leídas/día; 100.000 filas escritas/día; 5 GB | Diseñar índices, caching y escrituras compactas |
| Cloudflare R2 Free | 10 GB-mes; 1 M operaciones A/mes; 10 M B/mes; egress gratuito | TTL, limpieza, evitar relecturas innecesarias |
| Cloudflare Queues Free | 10.000 operaciones/día | Reservar colas para tareas que realmente necesiten desacoplamiento |
| Cloudflare Workflows Free | 100.000 invocaciones/día compartidas con Workers; 3.000 steps/día; 1 GB-mes | Workflows para procesos durables, no para cada operación trivial |
| GitHub Actions, repos públicos | runners estándar gratuitos | Ideal para CI/CD y automatización del código público |
| GitHub Free, repos privados | 2.000 min/mes + 500 MB artifacts | CI compacto; conservar artefactos mínimos |
| Workers Static Assets **[H3]** | Solicitudes gratuitas e ilimitadas (salvo rutas con `run_worker_first`) | Todo lo público es estático; el Worker solo para `/api/*` |
| Workers Cron Triggers | 5 por cuenta | Un único cron despachador de tareas |
| D1 Free — límites de diseño **[H12]** | 500 MB por base; 10 bases; 50 consultas por invocación; Time Travel 7 días | Separar bases por dominio; respaldo semanal a R2 |
| Workers KV Free | 100.000 lecturas/día; 1.000 escrituras/día; 1 GB | Solo configuración, flags y kill switches |
| Workers Analytics Engine **[H4]** | 100.000 data points/día; 10.000 consultas/día (aún sin facturación) | Eventos de producto en lote y con muestreo |
| Términos de GitHub Actions **[H6]** | Prohibido usarlo como parte de una aplicación serverless o para trabajo ajeno al software del repositorio | Nunca procesa archivos ni solicitudes de usuarios |

**Interpretación:** estas cuotas permiten validar una primera versión real con costo monetario cero, pero no justifican asumir capacidad infinita. El sistema debe vigilar y degradar antes de llegar a los límites.

**v1.3 · Cuenta con Workers Paid (USD 5/mes por cuenta), referencia de octubre de 2026 [PC].** Cifras por resumen del buscador sobre las páginas oficiales: se vuelven a verificar antes de decidir.

| Componente | Workers Paid | Implicación de diseño |
|---|---:|---|
| Workers | 10 M solicitudes/mes (+USD 0,30/M); 30 M CPU-ms/mes; 30 s de CPU por invocación (hasta 5 min) | Horneado, conciliación y lotes grandes caben. El exceso **se factura, no corta** |
| Cron Triggers | 250 por cuenta | Crons por producto, sin despachador único |
| D1 | 25.000 M filas leídas y 50 M escritas/mes; 10 GB por base; 50.000 bases; 1.000 consultas por invocación; Time Travel 30 días | Shards grandes y lotes de hasta unas 95 consultas |
| KV | 10 M lecturas y 1 M escrituras/mes | Mapas de hostnames con escrituras frecuentes |
| Queues | 1 M operaciones/mes, retención de 4 a 14 días (en el gratuito: 10.000/día y 24 h, desde feb-2026) | Colas para horneado y avisos |
| Workflows | 500.000 pasos/mes (+USD 0,80 por 100.000) | Procesos durables con presupuesto |
| Email Service | 3.000 correos/mes a cualquier destinatario (+USD 0,35 por 1.000); en el gratuito, solo a verificados | Correo transaccional de la plataforma |
| Containers | Disponibles (GA abr-2026) | Cómputo pesado sin salir de Cloudflare |
| Cloudflare for SaaS (depende de la zona, no de Workers Paid) | 100 hostnames incluidos; +USD 0,10/hostname/mes; máx. 50.000; apex solo con Enterprise | El dominio propio va en los planes pagos de los productos |
| Lo que no sube pagando | D1 10 GB por base; KV 1 escritura/s por clave; assets 25 MiB por archivo; WAF según el plan de la zona; Turnstile 10 hostnames por widget; sin tope duro de gasto | Diseñar para esos techos |

Fuentes de la v1.3: `analisis/cuenta-cloudflare-paga.md`, con cada URL oficial. Consultadas el 5 de octubre de 2026 por resumen, porque el proxy de la sesión bloqueó el sitio oficial.

Fuentes oficiales consultadas el 19 de septiembre de 2026:

- Cloudflare Workers: https://developers.cloudflare.com/workers/platform/limits/
- Cloudflare D1: https://developers.cloudflare.com/d1/platform/pricing/
- Cloudflare R2: https://developers.cloudflare.com/r2/pricing/
- Cloudflare Queues: https://developers.cloudflare.com/queues/platform/pricing/
- Cloudflare Workflows: https://developers.cloudflare.com/workflows/reference/pricing/
- GitHub Actions: https://docs.github.com/en/billing/concepts/product-billing/github-actions

Fuentes adicionales consultadas el 28 de septiembre de 2026 (v1.2):

- Cloudflare Workers Static Assets: https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/
- Cloudflare D1 (límites): https://developers.cloudflare.com/d1/platform/limits/
- Cloudflare Workers KV: https://developers.cloudflare.com/kv/platform/pricing/
- Cloudflare Workers Analytics Engine: https://developers.cloudflare.com/analytics/analytics-engine/pricing/
- Términos de GitHub Actions: https://docs.github.com/en/site-policy/github-terms/github-terms-for-additional-products-and-features
- Google AdSense, consentimiento EEE/Reino Unido/Suiza: https://support.google.com/adsense/answer/13554116

---

# 42. Cierre

ED1 debe ser tratado como una empresa de software impulsada por una máquina de adquisición y monetización, no como un catálogo de utilidades.

La arquitectura correcta es aquella que permite que:

```text
UNA IDEA
  ↓
SE CONVIERTA EN PRODUCTO
  ↓
EL PRODUCTO SE CONVIERTA EN PÁGINA
  ↓
LA PÁGINA SE CONVIERTA EN TRÁFICO
  ↓
EL TRÁFICO SE CONVIERTA EN USUARIO
  ↓
EL USUARIO SE CONVIERTA EN RELACIÓN
  ↓
LA RELACIÓN SE CONVIERTA EN REVENUE
```

con el mínimo trabajo manual y el menor costo marginal posible.

Ese es el objetivo arquitectónico y empresarial de ED1.

---

# 43. Anexo — Decisiones y hallazgos integrados en la v1.3

| Etiqueta | Qué dice | Fuente | Dónde entra |
|---|---|---|---|
| [D1] | Hay dos tiendas 2.0 en operación | Dueño, 5 oct 2026 | §2.1, §10.4 |
| [D2] | Las palabras clave se miden, pero no bloquean el proyecto de ecommerce | Dueño | §2.1, §19.1 |
| [D3] | El ecommerce entra como excepción declarada, como el agro | Dueño | §1, §2.1, §3.10, §33 |
| [D4] | Planes mensual, trimestral y anual, prepagados | Dueño | §5.3 |
| [D5] | Sin contador ni abogado por ahora: rigor técnico | Dueño | §5.3, §20.1 |
| [D6] | El CORE gana la dimensión de producto y queda listo para crecer | Dueño | §3.5, §4.1, §5.4, §16 |
| [HA1] | Aislar cuotas con otra cuenta roza los términos de Cloudflare: se aísla el riesgo, con cuentas pagas o del cliente | ARQUITECTURA §14 | §14.1, §22.2, §25.1 |
| [HA2] | Registrarse a nombre de terceros (Cloudflare §2.2.1(a)) | ARQUITECTURA §14 | Los dominios de clientes se conectan con Cloudflare for SaaS, no como zonas propias (TIENDA-3.0 §4.3) |
| [HA3] | El CORE nace en el agro y se extiende, no se rediseña | ARQUITECTURA §14 | §4.1, §5.4 |
| [HA4] | La Tienda 3.0 sobre esta plataforma; el monorepo de plataforma | ARQUITECTURA §14; PLATAFORMA §6 | §23.3.1 |
| [HA5] | El CORE con dimensión de producto | PLATAFORMA §4 | §5.4 |
| [HA6] | Cuentas con propósito declarado y graduación de productos | PLATAFORMA §3 | §22.2 |
| [HA7] | Legible por agentes | PLATAFORMA §5 | §3.12, §5.5, §12.4 |
| [HA8] | Reconstruir tablas en D1: con claves foráneas diferidas, el arreglo habitual deja pasar violaciones reales; receta con guarda | PLATAFORMA §4.4 (comprobado con `node:sqlite`; falta en D1) | §20.3, §22.1 |
| [V1]–[V11] | Validación del estudio de mercado de ecommerce (dimensión de la oportunidad, herramientas, dominio aparte para tiendas [V10], horneado de fichas con JSON-LD [V6], etc.) | `analisis/VALIDACION-ESTUDIO-MERCADO-ECOMMERCE-ED1-2026-10.md` | §3.10 y la Tienda 3.0 |
| [AR] | Preparación para agentes (isitagentready.com) | Pedido del dueño; PLATAFORMA §5 | §3.12, §5.5, §12.4 |
| [PC] | Cuenta paga de Cloudflare y proveedores complementarios | `analisis/cuenta-cloudflare-paga.md`, `analisis/proveedores-de-computo.md` | §14.1, §20.2, §22.2, §22.3, §25.1, §41 |

