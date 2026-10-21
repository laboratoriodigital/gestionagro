# Runbook · El alta de una tienda

**Qué es:** el comercio abre su tienda solo, desde el teléfono (HU-T13.4, TIENDA-3.0 §13.3).
1. Entra al panel con Google.
2. Si su cuenta no tiene tienda, el panel le muestra **Abre tu tienda**: escribe el nombre y la dirección (`<nombre>.laboratorio-digital.app`, que dice al escribir si está libre) y pasa la verificación de Turnstile.
3. Toca **Abrir mi tienda**. El panel crea su organización en el CORE, que le asigna celda y shard, y la API abre la tienda en `borrador`, con las formas de pago de fábrica (D-T4).
4. Desde ahí, el panel de siempre: los términos, los datos legales, el WhatsApp, el primer producto y publicar.

**Por ahora, solo en staging** (D-T14, 20 oct 2026). En producción la Tienda sigue pausada en el CORE hasta que el dueño decida lanzar, y entonces se quita de `activos_en_staging` en `infrastructure/productos-de-prueba.json` y se activa en `infrastructure/productos.json`.

## Una sola vez: lo que el alta necesita

### 1. Turnstile

1. En Cloudflare, abre **Turnstile › Add widget**:
   - nombre: «Tienda · alta»;
   - dominios: `panel.laboratorio-digital.app` y el del panel de staging (`tienda-panel-staging.laboratoriodigital-la.workers.dev`);
   - modo: **Managed**.
2. Guarda la clave del sitio y el secreto en cada ambiente de GitHub, sin que aparezcan en la pantalla. Cada comando pide el valor; pégalo y pulsa Enter.

   ```bash
   gh secret set TURNSTILE_SITIO --env staging
   ```
   ```bash
   gh secret set TURNSTILE_SECRETO --env staging
   ```

   Repite los dos con `--env produccion` cuando la Tienda se lance.
3. Despliega: los secretos llegan al Worker solo con el despliegue siguiente. Guardarlos no basta (validación del 20 oct 2026). Sin ellos, la pantalla dice «Abrir una tienda todavía no está disponible» y nada se crea.

### 2. Las direcciones de las tiendas nuevas

Hoy el despacho solo recibe las direcciones de los comercios de prueba. Para las tiendas nuevas:
1. En Cloudflare, zona `laboratorio-digital.app` › **DNS › Records**, agrega un registro comodín:
   - tipo `AAAA`;
   - nombre `*`;
   - contenido `100::`;
   - proxy encendido.

   Los nombres que ya existen (`panel.`, `img.`, `origen.`, el parqueadero) tienen sus propios registros, y ganan.
2. Marca la celda de la Tienda en `infrastructure/celdas.json`, por PR. El despliegue agrega al despacho:
   - con `"comodin": "staging"` (hoy, D-T14), solo `*--staging.laboratorio-digital.app/*` en staging;
   - con `"comodin": true`, al lanzar, también `*.laboratorio-digital.app/*` en producción.

   El comodín también cubre la dirección de las fotos (`img--staging.`, `img.`): el despacho las deja pasar a su origen sin tomarlas por una tienda.
3. Revisa después del despliegue que `panel.`, `img.`, `img--staging.` y el parqueadero sigan respondiendo: una foto de Ensayo Dos en staging tiene que verse.

## Probar el alta desde cero (WI-T13.4.3)

En staging, con una cuenta de Google que no tenga tiendas:
1. Abre el panel de staging y entra.
2. Abre una tienda de prueba, por ejemplo «Tienda de prueba del dueño». Su dirección será `tienda-de-prueba-del-dueno--staging.laboratorio-digital.app`.
3. Acepta los términos, llena los datos legales, agrega un producto con foto y publica.
4. Abre su dirección: tiene que mostrar la tienda.

## Si algo falla

| Lo que dice la pantalla | Qué hacer |
|---|---|
| «Abrir una tienda todavía no está disponible», sin casilla de verificación | Falta `TURNSTILE_SECRETO` o `TURNSTILE_SITIO` en el ambiente, o el despliegue después de guardarlos |
| «No cargó la verificación» o «No pudimos confirmar que eres una persona. Recarga la página» | Turnstile no cargó o falló en el teléfono. Recargar; si sigue, revisa en Cloudflare que el dominio del panel esté en el widget |
| La casilla dice «Código de error: 110200» | El dominio del panel no está en el widget. En Cloudflare, Turnstile › el widget › Hostname management, agrega el del panel de ese ambiente (paso 1) y guarda; recargar basta, sin desplegar |
| «No pudimos confirmar que eres una persona» | Turnstile no aceptó la verificación. Que lo intente otra vez; si sigue, revisa en Cloudflare que el dominio del panel esté en el widget |
| «Esa dirección la acaba de tomar otra tienda» | Dos altas pidieron la misma dirección a la vez y la otra ganó. Elige otra |
| «Ese nombre es de una marca conocida» | Está en `infrastructure/dominios.json` como marca. Si de verdad es su marca, se quita de allí por PR, con su prueba |
| «Tu tienda quedó a medias» | La organización se creó en el CORE, pero la tienda no abrió. Volver a tocar «Abrir mi tienda» sigue donde quedó: el id se guarda en el teléfono hasta terminar |
| La tienda abrió y su dirección no responde | Falta el comodín (paso 2), o el despliegue después de marcar la celda |
