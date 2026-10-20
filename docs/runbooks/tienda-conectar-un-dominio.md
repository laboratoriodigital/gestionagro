# Runbook · Conectar el dominio propio de una tienda

**Qué es:** una tienda vive en `<slug>.laboratorio-digital.app`. El comercio puede conectarle su dominio, como `www.mitienda.co`, desde **Más › Tu dominio** del panel (HU-T13.1 a HU-T13.3, TIENDA-3.0 §4.2 a §4.4).

- El dominio sigue siendo suyo, en su proveedor: solo crea tres registros.
- Cloudflare for SaaS emite el certificado **antes** de que llegue el tráfico, así no hay un minuto sin HTTPS.
- **Nunca** se le pide mover su dominio ni su DNS a la cuenta de la plataforma.

**Solo en producción.** El origen de respaldo de Cloudflare for SaaS es uno por zona, y es el de producción. En staging, la pantalla dice «todavía no disponible».

## Una sola vez: activar Cloudflare for SaaS

Lo hace el dueño, porque el token de despliegue no tiene esos permisos.

1. En Cloudflare, en la zona `laboratorio-digital.app`, abre **SSL/TLS › Custom Hostnames** y pulsa **Enable**. Cloudflare pide un medio de pago aunque la zona sea gratuita: los primeros 100 hostnames no se cobran, y cada uno más cuesta USD 0,10 al mes. Cada tienda usa uno o dos (con «www» y sin ella).
2. El origen de respaldo tiene que ser un registro **sin origen** (así lo pide Cloudflare cuando un Worker atiende). En **DNS › Records**, agrega uno `AAAA`, nombre `saas-respaldo`, contenido `100::`, con el proxy encendido (nube naranja). Luego, en **SSL/TLS › Custom Hostnames › Fallback Origin**, escribe `saas-respaldo.laboratorio-digital.app` y guarda. Espera a que diga **Active**. Los comercios siguen apuntando su CNAME a `origen.laboratorio-digital.app`: cualquier nombre de la zona con proxy sirve de destino.
3. Crea el token en **My Profile › API Tokens › Create Token › Custom token**:
   - nombre: «Tienda · dominios propios»;
   - permisos: **Zone · SSL and Certificates · Edit** y **Zone · Zone · Read**;
   - recursos de zona: solo `laboratorio-digital.app`. Ningún permiso de cuenta.
4. Guárdalo en el ambiente `produccion` de GitHub, sin que aparezca en la pantalla:

   ```bash
   gh secret set CF_SAAS_TOKEN --env produccion
   ```

   Pega el token cuando lo pida y pulsa Enter.
5. Marca la celda de la Tienda con `"saas": true` en `infrastructure/celdas.json` y fusiona ese cambio por PR. Con la marca, el despliegue de producción:
   - prueba el token antes de cargarlo: tiene que ver la zona y leer sus hostnames; si no puede, no lo carga y lo dice en el resumen;
   - le dice a la API la zona de las tiendas (`ZONA_TIENDAS`);
   - agrega al despacho la ruta `*/*` de la zona, por donde llegan los dominios propios.
6. Revisa que `panel.`, `img.`, `origen.` y el parqueadero sigan respondiendo. Si alguno dejara de hacerlo por la ruta de toda la zona, en **Workers Routes** agrega una ruta para ese nombre (por ejemplo `img.laboratorio-digital.app/*`) con el Worker en **None**: la ruta más específica gana.

## Con cada tienda (lo hace el comercio; tú acompañas)

1. En **Más › Tu dominio**, el propietario escribe `www.sudominio.co` y pulsa **Conectar**.
2. La pantalla muestra tres registros, en orden, cada uno con su botón «Copiar»:
   - TXT `_cf-custom-hostname.www`: prueba que el dominio es suyo;
   - TXT `_acme-challenge.www`: deja listo el certificado;
   - CNAME `www` → `origen.laboratorio-digital.app`: **de último**.
3. El estado cambia solo:
   - «Esperando tus registros»;
   - «Registros encontrados: preparando el candado»;
   - «Conectado».

   La pantalla pregunta a Cloudflare al abrirse y cada minuto mientras está abierta. La tarea `dominios` del cron pregunta cada hora.
4. Conectado, el dominio todavía lleva a la dirección de la plataforma (alias). Con **Usar como dirección principal**:
   - la dirección de la plataforma pasa a llevar al dominio, con 301 y la ruta intacta;
   - lo publicado se vuelve a hornear con el dominio en el sitemap, los canónicos y el JSON-LD.

   La API nunca se redirige: el aviso de Bold sigue llegando por las dos direcciones.
5. **Sin «www»** (`sudominio.co`):
   - si su proveedor deja un CNAME en la raíz (Cloudflare, o un ALIAS o ANAME), la conecta igual, como segunda dirección;
   - si no, la pantalla explica cómo redirigirla a «www» desde GoDaddy, Hostinger, Namecheap u otro proveedor.

## Si algo falla

| Lo que dice la pantalla | Qué hacer |
|---|---|
| «Todavía no disponible» | Falta el paso único: el token, la marca `saas` o el despliegue. El resumen del despliegue dice cuál |
| «Esa dirección ya está conectada a otra tienda» | Otra tienda de la plataforma la tiene. Si el comercio prueba que es suya, la otra tienda la desconecta primero |
| «Esa dirección ya está conectada en Cloudflare a otra cuenta» | El dominio está en otro servicio que usa Cloudflare for SaaS (otra tienda en línea, por ejemplo). El comercio lo quita de allí y vuelve a conectar |
| «Todavía no vemos los registros» | Revisa con el comercio que los nombres y valores sean exactos. Algunos proveedores agregan solos el dominio al nombre: ahí va el nombre corto (`_acme-challenge.www`). Otros piden el completo, que la pantalla también muestra |
| «Pasaron varios días sin ver los registros» | Cloudflare dejó de esperar. Desconecta el dominio y conéctalo otra vez: salen valores nuevos |
| «Cloudflare no deja usar esta dirección aquí» | Cloudflare la bloqueó. Revisa el hostname en SSL/TLS › Custom Hostnames y, si no es claro, escribe a su soporte |

## Desconectar

**Desconectar** borra el hostname de Cloudflare y lo saca de `TIENDA_HOSTS`. Si era la dirección principal, la de la plataforma lo vuelve a ser y lo publicado se vuelve a hornear. La fila queda `retirado` en la base de control, sin borrarse.

Otra tienda que pida ese dominio después tiene que crear sus propios TXT: nunca hereda la validación de la anterior (TIENDA §4.4). El comercio puede borrar los tres registros de su proveedor.
