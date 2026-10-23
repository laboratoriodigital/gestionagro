# La descripción del PR a la Public Suffix List

El texto para pegar en la plantilla del PR de `publicsuffix/list` (HU-T18.7), en inglés como piden. Las casillas van marcadas con `[x]`; lo que está entre `<!-- FILL IN -->` y `<!-- END FILL IN -->` es lo nuestro. Antes de enviarlo, el paso 0 de `tienda-public-suffix-list.md` tiene que estar cumplido.

Cambia `XXXX` por el número del PR cuando GitHub lo dé, aquí y en el registro `_psl`.

## La entrada en `public_suffix_list.dat`

En `===BEGIN PRIVATE DOMAINS===`, después del bloque de `ticket i/O GmbH` (`tickets.io`) y antes de `Tigris Data, Inc.`, con una línea en blanco antes y después:

```text
// TiendaPro : https://tiendapro.co
// Submitted by Laboratorio Digital <psl@tiendapro.co>
mitiendapro.co
```

El orden es alfabético por organización sin distinguir mayúsculas: «ticket» < «TiendaPro» < «Tigris». Sin espacios al final de las líneas.

## Las casillas

Todas van con `[x]`. En «Third-party limits worked around» se borran las dos líneas de ejemplo (Cloudflare y Let's Encrypt) y la línea «REMOVE THIS LINE…»: no le damos la vuelta a ningún límite, así que entre los dos comentarios no queda nada.

## Los textos

**Description of Organization:**

```text
Laboratorio Digital is a small software studio in Medellín, Colombia, that builds and operates web products for small businesses. TiendaPro (https://tiendapro.co) is one of them: a hosted online store platform for small Colombian merchants such as bakeries, clothing shops and natural beauty products. Each merchant creates a store from the TiendaPro panel and gets it served at <store>.mitiendapro.co; customers browse the catalog and the order is sent to the merchant's WhatsApp, and online payments go to the merchant's own account with Bold, a Colombian payment provider. Every store is run by a different, unrelated merchant, who is responsible for its own catalog and for its buyers' data.

I am Sebastian Urrego, founder and engineer at Laboratorio Digital. I build and operate the platform and I am submitting this request on behalf of the organization.
```

**Organization Website:**

```text
https://tiendapro.co
```

**Reason for PSL Inclusion:**

```text
mitiendapro.co is used only to host merchant stores: every subdomain is a separate store run by a different merchant. The platform's own website, merchant panel and email live on a separate domain, tiendapro.co, which is not part of this request.

Listing mitiendapro.co as a public suffix lets browsers treat each store as its own site. One store cannot set or read cookies for another store or for the parent domain, and storage, permissions and other site data stay isolated per store. The platform does not set any cookie scoped to mitiendapro.co itself, so the listing does not break any of our flows.

It also lets reputation systems such as Safe Browsing treat an abusive store on its own, without affecting the other merchants. As a shared hosting platform this is our main concern, together with cookie isolation.

We are not trying to work around any third-party limit. Store certificates are a single wildcard managed by Cloudflare, and we have no rate-limit issue with Let's Encrypt or anyone else.

mitiendapro.co is registered with more than two years remaining and auto-renewal on, and we will keep more than one year of term while it is listed. There are no previous issues or PRs for this section.
```

**Number of THOUSANDS of distinct users:** el número real de comercios con tienda en `mitiendapro.co` el día del envío, y si es real o estimado. Por ejemplo: `2 (current actual count of merchants with a store, as of <fecha>)`.

**Abuse contact URL:**

```text
https://tiendapro.co/
```

(El pie de cada página, «Reportar una tienda», lleva a `abuse@tiendapro.co`.)

**DNS Verification:**

```text
dig +short TXT _psl.mitiendapro.co
"https://github.com/publicsuffix/list/pull/XXXX"
```
