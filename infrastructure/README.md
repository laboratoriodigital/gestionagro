# infrastructure/

Fuentes únicas de la plataforma (P2), cada una con su esquema en `schemas/` y su prueba en `tests/repo/`:

- `celdas.json`: las celdas, de donde salen las configuraciones de wrangler, la tabla `celda` y el orden del despliegue (HU-E1.5, ARQUITECTURA §5.5).
- `productos.json`: los productos del CORE, con sus tipos, roles, planes y política (HU-C1.1, PLATAFORMA §4.2). El despliegue los copiará a las tablas de referencia (HU-C2.3).
- `cuentas.json`: la cuenta de Cloudflare de la plataforma y las que quedan fuera, sin identificadores (HU-C1.3, PLATAFORMA §3.5).
- `dominios.json`: los tres dominios y los nombres de `laboratorio-digital.app` reservados por proyecto o marca (HU-C1.3, PLATAFORMA §3.4).

Y las migraciones SQL por base, en `migraciones/`.
