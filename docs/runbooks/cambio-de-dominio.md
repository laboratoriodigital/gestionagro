# Mudar el sitio a cultivopro.co (3 oct 2026)

El dominio definitivo es `cultivopro.co`. Las rutas no cambian (ADR-19): `/herramientas/agro/…`, `/agro/app/` y `/agro/t/`. El repositorio ya lo usa: `infrastructure/celdas.json` dice `cultivopro.co`, y de ahí salen la ruta del Worker del sitio, la dirección canónica y el sitemap, el origen que el CORE acepta y la CSP del cuaderno.

`cultivopro.co` ya está en la misma cuenta de Cloudflare que `laboratorio-digital.com` (mismos servidores de nombres), así que el Worker la puede tomar.

## Antes de publicar la versión (una vez)

1. **Token de despliegue.** El token `CF_API_TOKEN` necesita la zona nueva: en Cloudflare › My Profile › API Tokens, edita el token y, en *Zone Resources*, incluye `cultivopro.co` con **Zone → Workers Routes: Edit**. Sin eso, el despliegue se detiene y dice que «no ve la zona cultivopro.co».
2. **Google (entrar con Google).** En Google Cloud › APIs y servicios › Pantalla de consentimiento de OAuth: agrega `cultivopro.co` a los dominios autorizados y cambia la página principal y la política de privacidad a `https://cultivopro.co/agro/privacidad/`. La dirección de regreso es la del CORE y no cambia.

## Publicar

Publica la versión como siempre (`despliegue.md`). El Worker del sitio toma `cultivopro.co` como dominio propio. La prueba de humo revisa sus páginas.

## Que la dirección vieja lleve a la nueva (301)

Los enlaces compartidos y las etiquetas QR que se hayan impreso con `agro.laboratorio-digital.com` tienen que seguir sirviendo. Las páginas públicas no ejecutan el código del Worker (así no gastan su cuota), así que la redirección va en una regla de Cloudflare, en la zona `laboratorio-digital.com`:

1. **DNS:** si al publicar desapareció el registro `agro`, crea uno: tipo `AAAA`, nombre `agro`, contenido `100::`, **con el proxy encendido** (nube naranja). Solo sirve para que Cloudflare reciba las visitas y las redirija.
2. **Rules › Redirect Rules › Create rule:**
   - Si: *Hostname* es igual a `agro.laboratorio-digital.com`.
   - Entonces: *Dynamic*, expresión `concat("https://cultivopro.co", http.request.uri.path)`, código **301**, y marca **Preserve query string**.
3. **Probar:** `https://agro.laboratorio-digital.com/herramientas/agro/calculadora-dpv/?t=24&hr=70` debe llevar a `https://cultivopro.co/herramientas/agro/calculadora-dpv/?t=24&hr=70`.

## Search Console

Crea la propiedad de tipo **Dominio** con `cultivopro.co`. Pega el registro TXT que da Google en Cloudflare › DNS de `cultivopro.co`, con nombre `@`. Como es la raíz, no pasa lo del subdominio (`agro.` no tenía registro). Anota la fecha en `docs/agro/validacion/dpv.md` cuando pidas la indexación.

## Lo que no cambia

- Los `$id` de los esquemas (`schemas/*.schema.json`) siguen con la dirección vieja: son nombres de contrato, no direcciones que se visiten. Cambiarlos sería un contrato nuevo (`agro-export` v2).
- Los Workers del CORE y de la celda siguen en workers.dev.
