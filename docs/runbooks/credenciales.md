# Credenciales por propósito

**Para qué:** que cada token de Cloudflare tenga lo que su trabajo necesita y nada más (HU-C11.5, PLATAFORMA §3.5, R6, P12). Con una sola cuenta para todo, un token con permisos de más es la puerta por donde un error o una filtración toca lo que no debía. Fue la causa 4 de la Tienda 2.0: cuatro permisos que se pisaban.

**Cuándo se revisa:** en cada despliegue, antes de tocar nada. Si un token tiene un permiso de menos o uno de más, el despliegue se detiene sin cambiar nada y el resumen dice cuál.

## Los tokens y sus permisos

| Secreto de GitHub | Para qué | Permisos (exactamente estos) | Lo que el despliegue comprueba que **no** tenga |
|---|---|---|---|
| `CF_API_TOKEN` (ambientes `staging` y `produccion`) | Desplegar Workers, crear y migrar bases D1, KV de flags y dominios | **Account:** Workers Scripts (Edit), Workers KV Storage (Edit), D1 (Edit), Account Analytics (Read), Account Settings (Read). **User:** Memberships (Read). **Zone** `cultivopro.co`, `laboratorio-digital.com` y `laboratorio-digital.app`: Workers Routes (Edit) | User → API Tokens · Workers R2 Storage · Cloudflare Pages · Zone → DNS (en producción, en cada zona; comprobado el 12 oct 2026 que los dominios propios no lo necesitan) |
| `CF_METRICAS_TOKEN` | Que el vigía y el reporte semanal lean el consumo | **Account:** Account Analytics (Read). Ningún otro | User → API Tokens · Account Settings · Workers R2 Storage · Cloudflare Pages · Workers KV Storage · D1 |
| `CF_SAAS_TOKEN` (solo `produccion`, HU-T13.1) | Que la API de la Tienda cree, lea y borre los hostnames personalizados de los dominios propios de las tiendas | **Zone** `laboratorio-digital.app`, y solo esa: SSL and Certificates (Edit) y Zone (Read). Ningún permiso de cuenta | En observación (avisan, no detienen): User → API Tokens · Account Settings · Workers R2 Storage · Cloudflare Pages · Workers KV Storage · D1 · Zone → DNS. Antes de cargarlo, el despliegue comprueba que vea la zona y lea sus hostnames; si no, no lo carga y lo dice ([tienda-conectar-un-dominio.md](tienda-conectar-un-dominio.md)) |

Lo que la revisión **no** distingue: «Edit» frente a «Read» en un permiso que sí se tiene (los dos leen igual). Tampoco revisa «Workers Scripts» en el de métricas: Cloudflare le deja leer la lista de Workers a un token que solo tiene Account Analytics, así que esa lectura no dice nada (12 oct 2026). Por eso esta tabla dice el nivel exacto: al crear o editar un token, elige ese.

## Si el despliegue dice «tiene un permiso de más»

1. Abre <https://dash.cloudflare.com/profile/api-tokens>.
2. En el token que nombra el mensaje (el de despliegue o el del vigía), toca **⋯** → **Edit**.
3. Quita la fila del permiso que dice el mensaje. Deja las demás tal cual están en la tabla de arriba.
4. **Continue to summary** → **Update token**. El valor del token no cambia: el secreto de GitHub sigue igual.
5. En GitHub: **Actions** → la corrida que falló → **Re-run failed jobs**.

## Si dice «no se pudo comprobar»

Cloudflare respondió algo que no es ni «sí» ni «sin permiso» (por ejemplo, un error 500). El despliegue no lo da por bueno (P1). Vuelve a correrlo en unos minutos; si se repite, revisa <https://www.cloudflarestatus.com>.

## Lista de comprobación del dueño (CA2)

- [x] Segundo factor en la cuenta de Cloudflare (5 oct 2026).
- [x] Contactos de recuperación de la cuenta (5 oct 2026).
- [x] **Decidido el 12 oct 2026: los dominios se quedan en Cloudflare por ahora** (el dueño acepta el riesgo; se vuelve a mirar si cambia la cuenta o llega la Tienda). Lo que se presentó:
  **Los tres dominios** (`laboratorio-digital.com`, `cultivopro.co`, `laboratorio-digital.app`) están registrados en Cloudflare. Si la cuenta se suspende o se pierde, se van con ella, y con ellos el correo de recuperación que dependa de esos dominios. Hay que decidir una de dos:
  - **Transferir al menos `laboratorio-digital.com` a otro registrador.** Cuesta lo de un año de registro en el registrador nuevo (para un `.com`, del orden de USD 10 a 15; mira el precio el día que lo hagas) y ese año se suma al vencimiento. El DNS se puede quedar en Cloudflare: nada de lo publicado cambia. Pasos: en Cloudflare, **Domain Registration** → el dominio → **Configuration** → desbloquear y pedir el código de autorización; en el registrador nuevo, iniciar la transferencia con ese código y **dejar los mismos nameservers de Cloudflare**; aprobar el correo de confirmación. Tarda hasta 5 días. Un dominio registrado o transferido hace menos de 60 días no se puede transferir todavía.
  - **Aceptar el riesgo**, y que quede escrito: responde «acepto el riesgo de los dominios en Cloudflare» y se anota en la bitácora del CORE con la fecha.
