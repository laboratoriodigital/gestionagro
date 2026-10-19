# Runbook · Suspender una tienda

**Cuándo:**
- si una tienda vende con marca ajena, engaña a sus compradores o rompe los términos (TIENDA-3.0 §4.4);
- si una tienda en particular está fallando y hay que aislarla sin tocar a las demás.

**Qué hace hoy:** el kill switch `ks:tienda:<org>` del KV de flags de la celda.
- Toda dirección de esa tienda responde «Esta tienda no está disponible por ahora» (503, sin caché), y también su API.
- Las demás tiendas siguen vendiendo.
- El panel del comercio sigue abriendo.
- Nada se borra.

La suspensión con un clic desde un panel del operador, con `tienda.estado = 'suspendida'` y su simulacro, llega con HU-T13.6 (M4). Hasta entonces, es este paso a mano.

## Suspender

1. Busca el id de la organización de la tienda: es el `org` de su dirección en el KV `TIENDA_HOSTS`, o el de la tienda en el CORE.
2. En <https://dash.cloudflare.com>, abre **Storage & Databases › Workers KV** y el namespace `tienda-c1-flags`. En staging es `tienda-c1-flags-staging`.
3. **Add entry**:
   - clave `ks:tienda:<org>`, con el id;
   - valor `apagado`;
   - **Save**.
4. Espera 2 minutos: el despacho guarda las direcciones hasta 30 s y KV tarda hasta 60 s en propagar el cambio.
5. Abre la tienda: tiene que decir «Esta tienda no está disponible por ahora».
6. Anota en el registro de soporte por qué y cuándo.

## Lo que sigue funcionando

- **Los pagos ya hechos.** Mientras está suspendida, Bold no puede entregar sus avisos (reciben 503 y Bold reintenta). La conciliación de cada hora, que corre en el cron y no pasa por el despacho, igual deja pagado lo que Bold aprobó.
- **Las solicitudes de los compradores** tienen su plazo legal y siguen corriendo. Si la tienda va a seguir suspendida, atiéndelas desde la base con el comercio ([tienda-incidente-datos-personales.md](tienda-incidente-datos-personales.md)).

## Levantar la suspensión

El valor de `ks:tienda:<org>` a `encendido`, o borra la entrada. También tarda hasta 2 minutos.

## Si la falla es de todas las tiendas

Es `ks:tienda`, no este. Los pasos están en [kill-switch.md](kill-switch.md).
