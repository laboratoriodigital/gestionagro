# Registro de cambios del CORE

Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/). Versión semántica propia del CORE en `apps/core/package.json`, con etiquetas `core-vX.Y.Z` (HU-C0.3, PLATAFORMA §6.3). El CORE va a producción solo cuando sube esta versión: una publicación del agro no lo arrastra. Lo que cambia el código del CORE se anota aquí en el mismo PR; la guardia del CI lo exige.

## [Sin publicar]

## [0.7.0] - 2026-10-22

El CORE abre TiendaPro en producción: crea sus tiendas y cobra sus planes.

### Cambiado
- La Tienda está activa en producción (HU-T18.6): el CORE crea sus organizaciones, cobra sus planes con Bold y ofrece los permisos del asistente del comercio (ver y cambiar el estado de los pedidos, ver y ajustar el inventario). En staging ya no se activa aparte: `activos_en_staging` queda vacío.
- La Tienda es TiendaPro (D-T15, HU-T18.2): el CORE la nombra así y acepta su panel de producción en `app.tiendapro.co` y su MCP del comercio en `mcp.tiendapro.co`.
- Los planes de la Tienda son Gratis, Pro e IA Pro (HU-T18.3). La migración 0011 pasa las organizaciones de Entrada e Intermedio a Pro y las de Alto a IA Pro, sin tocar hasta cuándo les dura lo pagado; los planes de antes quedan retirados, sin borrarse.

## [0.6.0] - 2026-10-20

El pago del plan en efectivo, registrado por el dueño desde GitHub, y lo que la Tienda necesita del CORE, todavía pausada en producción.

### Agregado
- El pago del plan en efectivo (HU-C5.8): el dueño lo registra con el flujo `registrar-pago-en-efectivo` y queda como uno de Bold, con `proveedor = 'efectivo'`, su periodo, la nota y quién lo registró en la auditoría; el plan se activa con la misma regla. La migración 0010 permite ese proveedor en `pago`. Pasos en `docs/runbooks/pago-en-efectivo.md`.
- El adaptador de correo `@ed1/correo` (HU-C10.1): Gmail por su API, con el refresh token de OAuth y el permiso `gmail.send`, para el CORE y la Tienda, cada uno con sus secretos. Sin configuración responde «no disponible» y nunca finge haber enviado. El código del CORE no cambia todavía: lo usará el enlace para entrar (HU-C10.2) y los avisos de vencimiento (HU-C10.3).

### Cambiado
- El adaptador de Bold sale del CORE a `@ed1/pagos` (HU-T11.1), para que la Tienda cobre con las llaves de cada comercio. El CORE solo cambia de dónde lo importa y sigue cobrando igual, con sus llaves en cada llamada. Un estado de Bold que no se conoce se traduce a «revisar», y el CORE lo trata como antes: sigue esperando hasta que venza.
- En staging, el CORE atiende la Tienda aunque en producción siga pausada (HU-T2.10): `productos-de-prueba.json` dice qué productos pausados se activan solo en staging, y la base de staging dice lo mismo. Producción no cambia.
- El catálogo conoce la Tienda, pausada (HU-T2.2): con sus planes y su política, pero el CORE no crea tiendas ni cobra sus planes mientras siga pausada.

## [0.5.0] - 2026-10-13

Lo de C10 que estaba en `main` y lo que M1 del parqueadero necesita del CORE en producción.

### Cambiado
- El directorio de producción lista la celda c2 del parqueadero: un parqueadero de la cuenta sincroniza con su API (HU-Q7.12).
- El catálogo trae el precio del plan Parqueadero, COP 29.900 al mes (85.000, 161.000 y 299.000 por 3, 6 y 12 meses), decidido por el dueño el 13 oct 2026.
- El catálogo trae la versión 3 de la política de la cuenta del parqueadero (Bold como aliado para pagar el plan, HU-Q7.10).
### Agregado
- Tus datos (HU-C7.7, Ley 1581): en la cuenta, «Descargar mis datos» con lo que el CORE guarda de ti, y hacer una consulta, un reclamo o una solicitud de supresión con número y fecha límite en días hábiles de Colombia (10 y 15, con festivos). Al dueño le llega un aviso por Telegram con el número y el plazo, sin el texto; si no sale, el cron lo reintenta. Rutas `POST /api/core/cuenta/{mis-datos,radicar,radicados}` y migración 0009 (`radicado_datos`). El CORE recibe ahora `TELEGRAM_BOT_TOKEN` y `TELEGRAM_CHAT_ID`.
- Revocar el acceso de un agente (HU-C9.6): `POST /oauth/revoke` (RFC 7009), y en la cuenta el bloque «Asistentes con acceso», con lo que puede hacer cada uno y «Quitar acceso». El recurso pregunta al CORE en cada solicitud si la concesión sigue viva (`ServicioDelCore.concesionVigente`).
- `POST /oauth/token` (HU-C9.5): el agente cambia su código (PKCE S256) por un token de 1 hora para su recurso, con emisor propio de agentes, y un refresh que rota en cada uso. Reusar un refresh ya usado quita el acceso entero y queda en la auditoría. Solo en staging por ahora.

## [0.4.0] - 2026-10-12

### Agregado
- Autorizar a un agente con consentimiento (HU-C9.4): `GET /oauth/authorize` con PKCE S256 y `resource` obligatorios, la pantalla `/autorizar/` de la cuenta (quién pide, qué podrá, sobre cuál espacio y hasta cuándo) y `POST /api/core/cuenta/autorizar`, que vuelve a validar y crea la concesión y un código de un uso. Los recursos de cada producto se declaran en `productos.json › recursos_oauth`. Solo en staging por ahora.
- Registro de clientes de OAuth (HU-C9.3): `POST /oauth/register` (RFC 7591) con tope de 10 por hora por IP, sin guardar la IP, y documentos de metadatos del cliente (CIMD) leídos y renovados cada día. Un cliente bloqueado no sigue. Solo en staging por ahora.
- Migración 0008: las tablas del servidor de autorización para agentes (`alcance`, `cliente_oauth`, `concesion_oauth`, `codigo_oauth`, `refresco_oauth`). La base exige que ningún alcance mueva dinero. Los alcances salen de `productos.json` y el despliegue los copia como el resto del catálogo; el agro declara `agro:registros:leer` (HU-C9.2).
- `GET /.well-known/oauth-authorization-server` (RFC 8414), solo en staging: en producción responde 404 hasta que exista el canje de tokens (HU-C9.2).
- La cuenta muestra dónde has entrado y deja cerrar una sesión, o todas menos esta, con una entrada con Google de menos de 10 minutos; cerrar queda en la auditoría y el refresh de esa sesión deja de servir (HU-C7.5). También tus pagos en los espacios que administras, con el periodo cubierto (HU-C7.6), y lo que pasó en ellos, en frases (HU-C7.8). Rutas `POST /api/core/cuenta/{sesiones,sesiones/cerrar,pagos,actividad}`, solo con token de la cuenta.
- `GET /.well-known/security.txt` (RFC 9116): a quién escribirle si se encuentra un fallo, con el correo de la política de la cuenta (HU-C8.4).
- `ServicioDelCore`: la entrada por la que una celda pide el plan de sus organizaciones, por service binding con RPC, sin URL ni token (HU-C5.6). Con `desde`, solo las que tuvieron un pago aprobado después; sin él, todas, con la gracia ya aplicada. **Va a producción antes que la celda que la usa.**
- La gracia de cada producto también en la lista de organizaciones que recibe la app (antes solo en el token), con la marca `aviso` para avisar a 7 días, a 1 día o en gracia (HU-C5.5).
- Cambiar de plan con días pagados por delante los convierte en días del plan nuevo, al precio mensual de cada uno. Nada se devuelve en dinero (HU-C5.4).
- Pagar un plan por 1, 3, 6 o 12 meses: el monto sale del precio vigente de ese periodo en la base, nunca de la app, y el periodo pagado queda en el pago (HU-C5.3).
- El permiso de Google Drive sirve a otro producto (HU-Q10.1): `/api/core/drive/inicio` acepta `producto=<id>` y entonces vuelve solo a un origen y una ruta de la app de ese producto, como al entrar. Sin `producto` sigue siendo el del cuaderno, y los cuadernos instalados no cambian. La política del parqueadero pasa a la versión 2 en el catálogo.
- El Parqueadero ED1 es un producto del CORE (HU-Q7.1): entra por `infrastructure/productos.json` como excepción declarada (ADR-31), con sus roles (propietario, administrador y cajero), siete días de gracia, sus planes como hipótesis (`gratis` y `parqueadero`, que todavía no se cobra en línea) y su política en borrador. Llega a producción con la próxima versión del CORE; la caja de hoy no cambia, porque sigue sin cuenta.

### Cambiado
- Cambiar el rol de alguien guarda en la auditoría también el rol de antes, para que la actividad diga «de operario a supervisor» (HU-C7.8).
- La versión de cada política y los planes de cada producto salen de `apps/core/src/catalogo.generado.json`, que arma `node scripts/generar-catalogo-core.ts`. Agregar un producto ya no es tocar el código del CORE, y una prueba impide que lo nombre (R1).

## [0.3.0] - 2026-10-07

### Agregado
- `POST /api/core/cuenta/espacios`: los espacios de la persona en todos los productos, con rol, plan y la dirección de cada app. Solo con un token de la cuenta (HU-C7.4).
- Dos productos en staging (HU-C3.7): con `DESTINO=staging`, el CORE atiende además los productos de prueba (`infrastructure/productos-de-prueba.json`). En producción no existen: el despliegue se detiene si aparece uno en la base, y la prueba de humo exige que el CORE diga que no existe. Crear una organización toma el producto del token, y la cuenta no puede crear una.
- Los tokens de acceso son del formato del ecosistema (v2): dicen su producto, el plan vigente con la gracia ya aplicada y cuándo fue la última entrada con Google. Las celdas de producción los aceptan desde CultivoPro 0.4.0; los tokens anteriores siguen valiendo hasta que vencen (HU-C4.3).
- La cuenta del ecosistema es el producto `cuenta`, sin organizaciones (ADR-28), con su política. `POST /api/core/auth/salir` cierra una sesión en el CORE, solo desde la app de su producto (HU-C7.3).
- El Worker del CORE sirve las páginas de la cuenta como sus assets (`apps/cuenta`). Solo corre en `/api/core/*`, `/oauth/*` y `/.well-known/*`; lo demás lo entrega Cloudflare sin invocarlo (HU-C7.2).
- El CORE de producción tiene su dominio propio, `cuenta.laboratorio-digital.com`, además de la URL de workers.dev, que sigue igual. Antes de publicarlo, Google tiene que aceptar las dos direcciones de vuelta nuevas (`docs/runbooks/despliegue.md`) (HU-C4.6).
- Renovar la sesión solo funciona desde la app de su producto, y entrega solo las organizaciones de ese producto. Un intento desde otra app recibe 403, no gasta el refresh de su dueño y queda en la auditoría (HU-C4.4).

### Cambiado
- Un pago suma meses calendario en la fecha de Bogotá, no 30 días: pagado el 31 de enero, vence el 28 de febrero; pagado el 1 de octubre, el 1 de noviembre (HU-C5.1).

## [0.2.0] - 2026-10-06

### Agregado
- CORS por producto: el CORE deja leer a la app de cada producto del catálogo, y una sesión solo se usa desde la app de su producto, aunque la otra app también esté permitida. Las solicitudes con sesión tienen que traer `Origin`, como lo hace todo navegador (HU-C3.5).
- «Me interesa» y el pago usan los planes del producto de la organización, con el prefijo de cobro y la pantalla de vuelta de ese producto. Quien paga es quien tiene el rol que administra, no «propietario» escrito en el código. Sigue cobrando un mes (HU-C3.4).
- `GET /.well-known/jwks.json`: las llaves públicas del CORE en formato estándar (JWK `OKP`/`Ed25519`), las mismas de `/api/core/claves`. Durante una rotación se publica también la anterior, declarada en `CORE_CLAVE_ANTERIOR`; la parte privada nunca sale (HU-C4.2).
- Entrar con producto: `inicio` acepta `producto` (sin él, el agro), valida la vuelta y la política de ese producto, y la sesión nace con él. El canje solo se hace desde la app del producto de la sesión, y se mira antes de gastar el código (HU-C3.1).
- Auditoría de lo que toca seguridad o dinero (migración 0007): cada entrada, invitación aceptada, cambio de rol, persona quitada, teléfono retirado y pago cerrado deja una fila, en el mismo lote que el hecho. Quien administra la ve con `POST /api/core/auditoria/ver` (HU-C2.4).
- La base sabe de productos (migración 0006, ADR-20): productos, tipos, roles, planes, periodos de 1, 3, 6 y 12 meses y precios, con claves foráneas que hacen imposibles los cruces entre productos. Es la fase de expandir: el código de hoy sigue igual (HU-C2.2).
- El despliegue copia el catálogo de productos y precios desde `infrastructure/productos.json` y cada `planes.json`, y comprueba que la base diga lo mismo antes de publicar el Worker (HU-C2.3).
- Antes de migrar, el despliegue revisa que la base no tenga filas huérfanas (HU-C2.2).
- La copia del cuaderno en el Drive del productor: pedir el permiso de Google Drive (`/api/core/drive/*`, HU-E8.4, etapa 1). **El cuaderno que la usa necesita este CORE en producción:** la publicación que la lleve sube la versión del agro y la del CORE.
- Kill switches por producto (`ks:core:<producto>`), para los pagos (`ks:core:pagos`) y para todo el CORE (`ks:core`, además de `ks:agro-core`) (HU-C3.6).

### Cambiado
- Una organización nueva nace en una celda de su producto, con el plan gratuito de su producto y el rol que lo administra, y los pilotos se cuentan por producto (HU-C3.3).
- Invitar, cambiar roles, quitar personas y ver la auditoría los puede hacer quien tenga un rol que administra en el producto de la organización, no un «propietario» escrito en el código. Los roles invitables y la invitación salen del producto de la organización (HU-C3.2).
- Los paquetes internos pasan a `@ed1/*`, y el CORE deja de importar el paquete del agro: su Worker pesa 13,7 KB menos.

## [0.1.0] - 2026-10-04

### Agregado
- La línea base: el CORE v0 tal como está en producción con CultivoPro v0.3.0 (etiqueta `core-v0.1.0` sobre el mismo commit). Entrar con Google, organizaciones, invitaciones, equipo y teléfonos, directorio de celdas, interés en planes y pago del plan Finca con Bold. Su historia está en el `CHANGELOG.md` de la raíz hasta la v0.3.0.
