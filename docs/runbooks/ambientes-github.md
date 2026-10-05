# Cómo funcionan los ambientes (environments) de GitHub en este proyecto

## La idea en una frase

Un **ambiente** es un destino de despliegue con nombre (aquí, `staging` y `produccion`) y con sus propias reglas: **desde dónde** se puede desplegar a él, **quién** tiene que aprobar y **qué secretos** puede leer. El flujo `desplegar.yml` declara a qué ambiente va cada corrida, y GitHub hace cumplir esas reglas antes de ejecutar un solo paso.

## El camino de un cambio

```
Tu PR ──► CI (pruebas, SIN secretos)
            │
            ▼  (apruebas y fusionas)
     push a main ──► CI en main ──► desplegar.yml ── ambiente «staging» ──► Workers *-staging (workers.dev)
                                                                          (CORE, celda y sitio de pruebas)

Publicas una versión (release v0.2.0) ──► desplegar.yml ── ambiente «produccion» ──► Workers de producción
                                                                                   + dominio cultivopro.co
```

- **Staging** se despliega solo, cada vez que algo llega a `main` y el CI queda en verde. Ahí pruebas con llaves de prueba (Bold en modo pruebas).
- **Producción** solo se despliega cuando **publicas una versión** (un *release*), o a mano con «Run workflow» eligiendo `produccion`.
- Desde el 3 oct 2026, el despliegue automático exige que el CI venga de un **push a main de este repositorio**. Un PR de un fork nunca llega a ejecutarse con los secretos (revisión de seguridad, hallazgo 1).

## Cómo está configurado hoy

| | `staging` | `produccion` |
|---|---|---|
| Desde dónde | rama `main` | rama `main` |
| Aprobación | ninguna | ninguna |
| Secretos propios | ninguno: usa los del repositorio | ninguno: usa los del repositorio |

Los secretos (Cloudflare, Google, Bold, Telegram) están en el **repositorio**, así que los dos ambientes los pueden leer. El script escoge cuáles usar según el destino: las llaves `BOLD_*_PRUEBAS` van a staging y las `BOLD_*_PRODUCCION` a producción.

## Lo que hay que cambiar antes de publicar la 0.2.0

1. **Permitir el tag de versión en `produccion`.** Una versión no corre desde una rama, sino desde su **tag** (`v0.2.0`). Con la regla «solo `main»`, GitHub detiene el despliegue: «Tag "v0.2.0" is not allowed to deploy to produccion due to environment protection rules».
   *GitHub › Settings › Environments › produccion › Deployment branches and tags › Add deployment branch or tag rule › **Tag** › `v*`.*
2. **Tu aprobación para producción** (recomendado). En *Environments › produccion › Required reviewers*, agrégate. Cada publicación queda esperando a que toques «Approve and deploy»: una segunda llave ante un error o un robo de cuenta.
3. **Llaves de producción solo para producción** (recomendado). Mueve `BOLD_IDENTIDAD_PRODUCCION` y `BOLD_SECRETA_PRODUCCION` del repositorio a *Environments › produccion › Environment secrets*, con el mismo nombre, y bórralas del repositorio. Así, ni una corrida de staging ni un error del script pueden leerlas. El flujo no cambia: un secreto del ambiente se lee igual que uno del repositorio.

## Publicar la versión 0.2.0, en orden

1. **Cloudflare:** quita `cultivopro.co` del Worker **`agro-sitio-staging`** (*Workers & Pages › agro-sitio-staging › Settings › Domains & Routes*). Hoy el dominio apunta a staging. Por eso el sitio carga lo nuevo, pero «Entrar con Google» llama al CORE de producción, que sigue en la 0.1.0 y responde «Ruta del CORE desconocida». Si no se quita, el despliegue de producción no puede tomar el dominio, porque ya es de otro Worker.
2. **GitHub:** el paso 1 de la sección anterior (el tag `v*` en `produccion`).
3. **Fusionar el PR de la versión** (`release/v0.2.0`: versión 0.2.0 en `package.json` y el CHANGELOG fechado).
4. **Publicar:**
   ```bash
   gh release create v0.2.0 --repo laboratoriodigital/plataforma --target main --title "v0.2.0" --notes-from-tag
   ```
5. **Mirar la corrida** «desplegar» en Actions. Si pusiste el revisor, apruébala. Al terminar:
   - el CORE de producción tiene las rutas nuevas y las migraciones 0002 a 0005;
   - el sitio de producción toma `cultivopro.co`;
   - Bold cobra con las llaves reales.
6. **Probar:** en `https://cultivopro.co/agro/app/cuenta/`, «Entrar con Google» debe llevar a Google, no al mensaje de error.
7. **La dirección vieja:** la regla de redirección 301 de `agro.laboratorio-digital.com` (runbook `cambio-de-dominio.md`).
