# Runbook · Registrar el aviso de Bold de una tienda

**Cuándo:** una vez por tienda y por ambiente, cuando el comercio conecta sus llaves de Bold (HU-T11.2). Hoy no se usa todavía: ninguna tienda puede guardar llaves hasta esa historia, y el asistente de alta del panel hará estos pasos con el comercio (TIENDA §9.4).

**Por qué:** el aviso es el camino principal para saber que un pago se aprobó (HU-T11.5). Sin él, el pedido queda esperando hasta que la consulta a Bold lo encuentre (HU-T11.6).

## La dirección

| Ambiente de Bold | Dirección que se registra |
|---|---|
| Pruebas | `https://<slug>--staging.mitiendapro.co/api/v1/avisos/bold` (la de antes, en `laboratorio-digital.app`, sigue llegando: HU-T18.1) |
| Producción | `https://<slug>.mitiendapro.co/api/v1/avisos/bold` |

- Siempre el subdominio de la plataforma, **nunca el dominio propio** de la tienda: ese puede cambiar, y el subdominio no. Por eso el slug no se cambia después de publicar.
- Sin barra al final y por HTTPS. Un alias que redirige no sirve: Bold no sigue un 301 en un POST.

## Pasos

1. Entra al panel de comercios de Bold con la cuenta del comercio y busca la sección de webhooks (en la documentación de Bold está en Integraciones).
2. Agrega la dirección del ambiente que corresponde, de la tabla de arriba. Bold admite hasta 5 direcciones por cuenta.
3. Marca los eventos de venta y de anulación: `SALE_APPROVED`, `SALE_REJECTED`, `VOID_APPROVED` y `VOID_REJECTED`.
4. Haz un pago de prueba en la tienda de staging (el cobro de prueba guiado, HU-T11.3) y mira que el pedido quede pagado en el panel sin tocar nada.

## Si el pedido no quedó pagado

En el registro del Worker de la API (`wrangler tail` sobre `tienda-api-c1` o su staging):

| Lo que se ve | Qué es | Qué hacer |
|---|---|---|
| Respuesta 401 | La firma no corresponde a ninguna llave de la tienda | Revisar que la llave secreta guardada sea la del ambiente correcto |
| `aviso de Bold sin cobro en …` | El aviso es de otro ambiente, de otra tienda, o el cobro no existe | Revisar que la dirección registrada sea la del ambiente correcto |
| Respuesta 503 | `ks:tienda` está apagado | Nada: Bold reintenta solo (15 min, 1 h, 4 h, 8 h y 24 h) |
| Respuesta 500 y `el aviso de Bold falló` | Un error nuestro | Bold reintenta; si sigue fallando, es un incidente, con la línea del error |

## Lo que nunca se hace

- Registrar la dirección de producción en la cuenta de pruebas de Bold, o al revés. Un aviso de pruebas lo puede firmar cualquiera, y por eso la API no deja que mueva un cobro de producción.
- Copiar la llave secreta en un chat, un correo o un ticket para revisarla: el panel guardará solo sus últimos 4 caracteres a la vista (HU-T11.2).
