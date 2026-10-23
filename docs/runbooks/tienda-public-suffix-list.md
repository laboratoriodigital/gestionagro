# Runbook · `mitiendapro.co` en la Public Suffix List

**Qué es:** la Public Suffix List (PSL) es la lista pública con que los navegadores y Google saben que `panaderia.mitiendapro.co` y `zapatos.mitiendapro.co` son sitios de dueños distintos (HU-T18.7, D-T15). Con la inscripción, una tienda no puede poner cookies a las demás y la reputación de una no arrastra a las otras ni a la marca.

**Solo `mitiendapro.co`.** `tiendapro.co` es la marca y no aloja tiendas: no se inscribe (HU-T18.7 CA3).

## 0. Antes de pedirla

La plantilla del PR pide cosas que no dependen del código. Sin ellas el PR se cierra, y una solicitud rechazada queda en el registro público de la lista:

- **Usuarios.** La PSL solo considera proyectos con 2.000 a 3.000 usuarios distintos o más, contados como los comercios con tienda en `mitiendapro.co`, no como sus visitantes. Se pide el número real o estimado y si es lo uno o lo otro. Con la Tienda recién abierta, todavía no se cumple: la inscripción espera a que haya comercios (revisado el 22 oct 2026).
- **El contacto de abuso, publicado.** Tiene que verse en `https://tiendapro.co/`: el pie dice «Reportar una tienda» con `abuse@tiendapro.co`. Hace falta que la landing esté en producción.
- **Un correo de rol, vigilado.** No uno personal: `psl@tiendapro.co`, reenviado con Email Routing (zona `tiendapro.co` › Email › Email Routing › Routing rules) a un buzón que se lea. La PSL exige respuesta en máximo 30 días mientras el dominio esté en la lista.
- **Dos años de registro.** Lo verifica el dueño en el registrador de `mitiendapro.co`, con la renovación automática encendida.
- **La respuesta de Cloudflare**, abajo.

### La respuesta de Cloudflare

La bitácora tienda3 51 dejó una pregunta abierta: si Cloudflare for SaaS (los dominios propios de los comercios, con `origen.mitiendapro.co`) sigue funcionando en una zona inscrita fuera de Enterprise, y si la zona se podría volver a crear si algún día se borra. Las zonas inscritas que ya sirven en Cloudflare con comodín y certificado (`bearblog.dev`, `srv.us`, `vp4.me`) dicen que lo demás sigue.

- Si Cloudflare confirma que sí: sigue con el paso 1.
- Si dice que no, o no responde: la decisión vuelve al dueño. La alternativa más barata es no inscribirla, como Tiendanube (bitácora tienda3 51).

**Nunca borres la zona `mitiendapro.co` de Cloudflare después de inscribirla:** una zona nueva tiene que estar un nivel debajo de un sufijo de la lista, y `mitiendapro.co` ya sería un sufijo.

## 1. Abrir el PR en GitHub

1. Entra a <https://github.com/publicsuffix/list> y crea un *fork* con tu cuenta.
2. En tu fork, edita `public_suffix_list.dat` y agrega la entrada en `===BEGIN PRIVATE DOMAINS===`, en el lugar y con el texto de `tienda-psl-descripcion-del-pr.md`.
3. Abre el PR contra `publicsuffix/list` y pega en la plantilla las casillas y los textos de `tienda-psl-descripcion-del-pr.md`.

4. Copia la dirección del PR, por ejemplo `https://github.com/publicsuffix/list/pull/1234`.

## 2. El registro `_psl` en Cloudflare

1. En Cloudflare, zona `mitiendapro.co` › **DNS › Records › Add record**.
2. Tipo `TXT`, nombre `_psl`, contenido: la dirección del PR del paso 1, tal cual, por ejemplo `https://github.com/publicsuffix/list/pull/1234`.
3. Guarda. Los revisores de la PSL lo comprueban con `dig +short TXT _psl.mitiendapro.co`. El registro se queda mientras el dominio esté en la lista: no se borra.

## 3. Mientras se revisa, y después

- **El registro del dominio tiene que durar más de dos años.** En Cloudflare › Domain Registration › `mitiendapro.co`, la renovación automática encendida y, si hace falta, uno o dos años más pagados.
- La revisión del PR puede tardar semanas, y Cloudflare toma su copia de la lista de 4 a 8 semanas después de que se fusiona.
- Después de que Cloudflare tome el cambio, abre una tienda de staging (`<nombre>--staging.mitiendapro.co`) y una de producción y comprueba que responden con su candado. Si alguna falla, se anota en la bitácora de la Tienda.

## 4. Google Search Console (HU-T18.7 CA2)

1. Entra a <https://search.google.com/search-console> con tu cuenta de Google.
2. **Agregar propiedad › Dominio**, escribe `tiendapro.co` y copia el registro TXT que da Google.
3. En Cloudflare, zona `tiendapro.co` › **DNS › Records › Add record**: tipo `TXT`, nombre `@`, contenido el que dio Google. Vuelve a Search Console y pulsa **Verificar**.
4. Repite con `mitiendapro.co`, en su zona. Las tiendas con dominio propio se verifican aparte, desde su panel (HU-T14.8).
5. En la propiedad `tiendapro.co`, **Sitemaps** › agrega `https://tiendapro.co/sitemap.xml`.
