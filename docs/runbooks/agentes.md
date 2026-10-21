# Lo que leen los agentes

**Para qué:** que un buscador con IA o el asistente de un productor lea cultivopro.co sin ejecutar JavaScript (EC8, PLATAFORMA §5.3).

## Qué hay publicado

| Qué | Dónde | De dónde sale |
|---|---|---|
| Quién puede leer y para qué | `/robots.txt` | `content/agentes.json` (HU-C8.1). La prueba de humo exige que lo publicado sea lo generado |
| Qué hay en el sitio | `/llms.txt` | Las páginas públicas del build (HU-C8.2) |
| Cada página pública en Markdown | `/<ruta>/index.md` | El mismo HTML de la página, convertido al armar el despliegue (`scripts/lib/gemelos.ts`) |
| El aviso de que existe el Markdown | `<link rel="alternate" type="text/markdown">` y la cabecera `Link` | `Base.astro` y `scripts/lib/cabeceras.ts` |

**Pública** es lo que se indexa. Una calculadora en revisión agronómica (`estado: borrador`) no tiene gemelo ni sale en `llms.txt`, igual que no sale en el sitemap. Cuando se publique, aparece sola en el build siguiente.

## Comprobar lo publicado

El despliegue lo hace solo después de cada publicación a staging, y se detiene si algo falta (HU-C8.5). Para mirarlo a mano, desde la carpeta del repositorio y después de `pnpm build`:

```bash
node scripts/verificar-agentes.ts https://cultivopro.co
```

Sin dirección, revisa staging. Como segunda opinión, abre <https://isitagentready.com> con `cultivopro.co` desde tu computador: su puntaje no es el criterio, pero si dice algo que el script no ve, avísame.

## Las tiendas (HU-T15.1 a HU-T15.7)

Cada tienda hornea lo suyo: `robots.txt`, `llms.txt`, los gemelos `.md`, `/openapi.json` con su catálogo en `/.well-known/api-catalog`, y `/.well-known/agent-skills/comprar/SKILL.md` con su huella. Si el comercio encendió el MCP en Ajustes › Agentes, también `/.well-known/mcp/server-card.json`, y `POST /mcp` responde.

El despliegue de la Tienda revisa los dos comercios de prueba de staging con `scripts/lib/verificar-tienda.ts` después de su humo; una falla detiene producción. Para probar el MCP con un cliente real (Claude, ChatGPT o el inspector de MCP), en un comercio de prueba con el MCP encendido:

```text
https://<tienda>/mcp
```

Sin autenticación. El asistente prepara el pedido y entrega un enlace `/pedido/confirmar/#c=…&s=…`: ábrelo, acepta los términos y paga con el Bold de pruebas.

El MCP del comercio (`https://tienda-panel-staging.laboratoriodigital-la.workers.dev/mcp` en staging, `https://mcp.laboratorio-digital.app/mcp` en producción) pide OAuth del CORE. Mientras la Tienda siga `pausado` en `infrastructure/productos.json`, el CORE no lo autoriza.

## Pedir Markdown con `Accept: text/markdown` (el spike de HU-C8.2, CA2)

El Worker del sitio no corre en las páginas públicas (static-first), así que la negociación solo la puede hacer una **regla de reescritura de la zona**. Falta comprobar si el plan gratuito la permite. Toma unos 10 minutos:

1. Cloudflare → la zona **cultivopro.co** → **Rules** → **Transform Rules** → **Rewrite URL** → **Create rule**.
2. Nombre: `Markdown para agentes`.
3. **If incoming requests match** → **Custom filter expression** → **Edit expression**, y pega:
   ```
   any(http.request.headers["accept"][*] contains "text/markdown") and ends_with(http.request.uri.path, "/") and not starts_with(http.request.uri.path, "/agro/app/") and not starts_with(http.request.uri.path, "/api/")
   ```
4. **Then** → **Path** → **Rewrite to** → **Dynamic**, y pega:
   ```
   concat(http.request.uri.path, "index.md")
   ```
5. **Query** → **Preserve**. **Deploy**.
6. Comprueba desde una terminal:
   ```bash
   curl -s -H "Accept: text/markdown" https://cultivopro.co/agro/guia/ | head -3
   ```
   Debe empezar con `# Cómo usar CultivoPro`. Y sin la cabecera, la página de siempre:
   ```bash
   curl -s https://cultivopro.co/agro/guia/ | head -1
   ```

**Si el panel no deja elegir «Dynamic» o la expresión** (porque el plan gratuito no lo trae), no se paga un plan por esto: se acepta la opción b de PLATAFORMA §5.3. Los agentes siguen la cabecera `Link` y el `<link rel="alternate">`, que ya están. Avísame qué pasó para anotarlo.

Una página sin gemelo (un borrador) pedida con `Accept: text/markdown` responde 404 con la regla: un agente que la pida así no se lleva una página en revisión.
