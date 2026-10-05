# Renombrar el repositorio: de `gestionagro` a `plataforma`

## La idea en una frase

GitHub renombra el repositorio en un clic y redirige el nombre viejo. Lo que hay que cuidar es lo que guarda el nombre por fuera de GitHub, y lo que **no** se renombra nunca. Es la decisión del dueño del 5 oct 2026 (ADR-26, `../plataforma/PLATAFORMA.md` §6.1).

## Antes

1. **Que no haya un despliegue corriendo** (Actions › desplegar).
2. **Que nadie vaya a crear después un repositorio `gestionagro`** en la organización: ocuparía el nombre viejo y rompería la redirección.

## En GitHub (lo hace el dueño)

Desde las sesiones de Claude no hay herramienta para renombrar un repositorio.

1. *GitHub › laboratoriodigital/gestionagro › Settings › General › Repository name.*
2. Escribe `plataforma` y toca **Rename**.

Se conservan los issues, los pull requests, las revisiones, las etiquetas `vX.Y.Z`, los ambientes `staging` y `produccion` con sus secretos, las variables y las reglas de las ramas.

## Después, en orden

1. **Tu clon en el computador.** Funciona igual por la redirección, pero conviene apuntarlo al nombre nuevo:
   ```bash
   git remote set-url origin https://github.com/laboratoriodigital/plataforma.git
   ```
   ```bash
   git remote -v
   ```
2. **Actions.** El siguiente push a `main` corre el CI y `desplegar` a staging. Los dos tienen que quedar en verde.
3. **Lo que guarda el nombre por fuera:**
   - la aplicación de GitHub de Claude y los entornos de Claude Code siguen al repositorio por su identificador; si un entorno deja de encontrarlo, se vuelve a elegir en su configuración;
   - *Settings › Webhooks* y *GitHub Apps*: cada uno con su última entrega en verde;
   - los comandos `gh … --repo`: con el nombre nuevo (la redirección también cubre el viejo).
4. **Cloudflare: nada.** Los Workers se despliegan desde Actions con tokens, no desde una conexión de Cloudflare con GitHub. Si algún día se conecta Workers Builds, se conecta al nombre nuevo.
5. **El repositorio por dentro ya está al día**: `README.md`, `docs/`, el `name` del `package.json` de la raíz, los comandos de los runbooks y los paquetes internos, que se llaman `@ed1/*` (antes `@gestionagro/*`, `PLATAFORMA.md` §6.1). Ninguno depende del nombre del repositorio.

## Lo que no se renombra (P10)

| Qué | Por qué |
|---|---|
| La base IndexedDB `gestionagro-cuaderno` y las `gestionagro-cuaderno-<id>` | Los teléfonos instalados la abren por ese nombre. Renombrarla los deja sin sus registros |
| Las claves `gestionagro.*` del almacenamiento local del cuaderno (finca activa, lista de fincas, lectura pendiente, unidad de riego) | Igual que la base |
| Los Workers `agro-sitio`, `agro-core` y `agro-api-c0` (y sus `-staging`), las bases D1 `agro_core` y `agro_c0_s1`, y los espacios KV de flags | Son los recursos en producción. Renombrarlos es crear otros y migrar |
| La cookie `agro_oauth` y el emisor `agro-core` | El emisor cambia solo con la transición de tokens v2, en tres versiones (`PLATAFORMA.md` §4.6) |
| Las etiquetas `vX.Y.Z` y el CHANGELOG | Son la historia de CultivoPro |

## Cómo se comprueba

- `https://github.com/laboratoriodigital/gestionagro` lleva a `https://github.com/laboratoriodigital/plataforma`.
- `git remote -v` muestra el nombre nuevo.
- El CI de `main` y `desplegar` a staging, en verde después del renombre.
- En el teléfono, el cuaderno abre con sus registros: nada de lo que vive en el teléfono cambió de nombre.

## Volver atrás

Renombrar otra vez a `gestionagro`, con los mismos pasos. La redirección se rehace sola.
