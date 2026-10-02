# Runbook: vigía de cuota de la celda

**Para qué:** que la celda mida cada hora cuánto de las cuotas gratuitas de Cloudflare se usó en **toda la cuenta**, y baje sola de nivel antes de llegar al bloqueo (HU-E8.2, ARQUITECTURA §8.2).

## Qué hace cada hora

1. Lee las métricas de la cuenta en la API GraphQL de Cloudflare: solicitudes a Workers, filas leídas y escritas de D1, lecturas y escrituras de KV, y operaciones de R2 (mensuales).
2. Toma la cuota más usada y fija el nivel:

   | Uso | Nivel |
   |---|---|
   | < 60 % | `normal` |
   | ≥ 60 % | `alerta` |
   | ≥ 75 % | `ahorro` |
   | ≥ 90 % | `esencial` |
   | ≥ 100 % | `bloqueo` |

3. Si el nivel cambió, lo escribe en la clave `nivel` del KV de flags (`agro-c0-flags` o `agro-c0-flags-staging`).
4. Las cuotas diarias se reinician a las 00:00 UTC (19:00 en Colombia). En la primera vuelta después de esa hora, el nivel vuelve a bajar solo.

**Si no puede leer alguna métrica, no dice «normal»:** deja al menos `alerta`, y nunca baja un nivel más alto que ya estaba. En el log de la celda dice qué fuente falló y por qué.

## Crear el token (una vez)

El vigía usa un token **de solo lectura**, aparte del de despliegue.

1. <https://dash.cloudflare.com/profile/api-tokens> → **Create Token** → **Create Custom Token**.
2. Nombre: `agro vigía de cuota (solo lectura)`.
3. Permisos: **Account** → **Account Analytics** → **Read**. Ningún otro.
4. Account Resources: **Include** → la cuenta de la celda.
5. **Continue to summary** → **Create Token**. Copia el token: no se vuelve a mostrar.
6. En GitHub: el repositorio → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**. Nombre: `CF_METRICAS_TOKEN`. Valor: el token.
7. El despliegue siguiente lo carga en el Worker. En el resumen del despliegue debe decir «vigía de cuota: token de métricas cargado».

Sin este secreto el despliegue sigue, pero lo avisa y el vigía deja la celda en `alerta`.

## Ver qué midió

Cloudflare → **Workers & Pages** → `agro-api-c0` (o `agro-api-c0-staging`) → **Logs**. Cada hora queda una línea así:

```text
vigía: nivel normal (sin cambio). solicitudes a Workers 3.1 %, filas leídas de D1 0.2 %, …
```

Una falla de lectura sale como error, con la fuente, por ejemplo `No se pudo leer: KV: …`.

Para probarlo sin esperar a la hora en punto: **Settings** → **Triggers** → **Cron Triggers**, y desde ahí se puede disparar.

## Cambiar el nivel a mano

Se puede editar la clave `nivel` en el KV, como un kill switch (ver `kill-switch.md`). Ten en cuenta que el vigía la vuelve a escribir en su siguiente vuelta si el consumo dice otra cosa.
