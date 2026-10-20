# Runbook · Suspender una tienda

**Cuándo:**
- si una tienda vende con marca ajena, engaña a sus compradores o rompe los términos (TIENDA-3.0 §4.4);
- si una tienda en particular está fallando y hay que aislarla sin tocar a las demás.

Los reportes llegan a `abuse@laboratorio-digital.app`, el enlace «Reportar esta tienda» del pie de cada tienda.

## Suspender: un clic (HU-T13.6)

1. Busca el id de la organización de la tienda. Está en el registro de la tienda o en el CORE, o es el `org` de su dirección en el KV `TIENDA_HOSTS`.
2. En GitHub › **Actions › suspender-tienda › Run workflow**, llena:
   - **ambiente**: `produccion`, o `staging` para el simulacro;
   - **org**: el id de la tienda;
   - **accion**: `suspender`;
   - **motivo**: por qué, en una frase. Queda en el registro de la tienda.
3. El flujo dice `✅ La tienda quedó suspendida`. En unos dos minutos, todas sus direcciones responden **451** con «Esta tienda no está disponible». Eso incluye su dominio propio, su dirección de la plataforma y su API: no recibe pedidos ni cobros nuevos.
4. Anota en el registro de soporte el reporte y lo que hiciste.

Qué hace por dentro:
- la API pone la tienda en `suspendida`, deja su motivo en el registro y reescribe sus direcciones en `TIENDA_HOSTS` con ese estado (`apps/tienda-api/src/suspension.ts`);
- publicar no la levanta: sus direcciones siguen suspendidas.

## Lo que sigue funcionando

- **Las demás tiendas**, que siguen vendiendo.
- **El panel de la tienda.** El comercio puede entrar y descargar sus datos.
- **Los pagos ya hechos.** Bold no puede entregar sus avisos y los reintenta. La conciliación de cada hora corre en el cron, sin pasar por el despacho, y deja pagado lo que Bold aprobó.
- **Las solicitudes de los compradores** tienen su plazo legal y siguen corriendo. Si la tienda va a seguir suspendida, atiéndelas con el comercio ([tienda-incidente-datos-personales.md](tienda-incidente-datos-personales.md)).

## Levantar la suspensión

El mismo flujo con **accion** `levantar` y su motivo. La tienda vuelve a `abierta` si tenía una versión publicada, o a `borrador` si no.

## El simulacro (CA3), en staging

1. Corre el flujo con ambiente `staging`, la org de Comercio Ensayo Uno (`0199e0a0-0000-7000-8000-0000000000c1`), `suspender` y el motivo «simulacro».
2. Abre <https://ensayo-uno--staging.laboratorio-digital.app>: tiene que responder 451.
3. Abre <https://ensayo-dos--staging.laboratorio-digital.app>: tiene que seguir igual.
4. Levántala con el mismo flujo y comprueba que Ensayo Uno vuelve.

## Si la falla es de una tienda y no hay tiempo para el flujo

El kill switch `ks:tienda:<org>` en el KV `tienda-c1-flags` (o `tienda-c1-flags-staging`), con el valor `apagado`. La tienda responde 503 «no disponible por ahora», sin cambiar su estado. Pasos en [kill-switch.md](kill-switch.md).

## Si la falla es de todas las tiendas

Es `ks:tienda`, no este. Los pasos también están en [kill-switch.md](kill-switch.md).

## Los dominios que una tienda dejó (CA2)

Cada día, la tarea `hostnames-colgantes` pregunta el DNS público de los dominios propios retirados. Si alguno todavía apunta su CNAME aquí, avisa por Telegram. Nadie puede tomarlo sin crear su propio TXT (HU-T13.1). Pídele al comercio que borre el CNAME de su proveedor.

## El correo de los reportes (una vez, el dueño)

En Cloudflare, zona `laboratorio-digital.app` › **Email › Email Routing**:
1. Activa Email Routing (agrega los registros MX y SPF que pide).
2. Crea la dirección `abuse@laboratorio-digital.app` y reenvíala a tu correo.
3. Verifica tu correo cuando Cloudflare lo pida.
