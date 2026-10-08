# Runbook: kill switches del parqueadero

**Para qué:** pausar en un par de minutos, sin desplegar, la nube del parqueadero: por un fallo, por el presupuesto de filas de D1 (HU-Q7.13) o mientras se arregla algo (PARQUEADERO §14.2, HU-Q10.4). Lo general de las claves, el tiempo de propagación y el CORE está en `docs/runbooks/kill-switch.md`.

**Lo primero que hay que saber:** apagar la nube **nunca** detiene la venta. La caja registra, cobra e imprime sin red; lo que hizo se queda en su cola y sube cuando se vuelve a encender (HU-Q7.5 CA4, HU-Q7.13 CA3).

## Las claves

Viven en el KV de flags de la celda c2: **`parqueadero-c2-flags-staging`** en staging. La celda de producción todavía no existe: llega con HU-Q7.12.

| Clave | Qué se apaga | Qué sigue funcionando |
|---|---|---|
| `ks:parqueadero` | Toda la API de la celda: `/api/v1/*` responde 503 «La sincronización está en pausa» con `Retry-After: 120`. Eso apaga subir y bajar (`/api/v1/sync/push`, `/api/v1/sync/pull`), reclamar (`/api/v1/reclamar`), el resumen (`/api/v1/resumen`) y las cajas (`/api/v1/dispositivos`, `/api/v1/dispositivos/retirar`) | La caja completa en el teléfono o el PC. Espera lo que dice `Retry-After` y vuelve a intentar sola. `/api/salud` sigue respondiendo |
| `ks:parqueadero-fotos` | Todavía nada: la declara `infrastructure/productos.json` para las fotos en la nube, que llegan en M2 (HU-Q8.3) | Todo |
| `ks:core:parqueadero` | En el CORE (KV de la celda c0, ver `docs/runbooks/kill-switch.md`): entrar con la cuenta y renovar la sesión del parqueadero responden 503 | La caja; la que ya entró sigue sincronizando hasta que vence su acceso (12 h) |

El despliegue crea las claves en `encendido` y nunca cambia una que ya existe: lo que apagues sigue apagado aunque se despliegue.

## Apagar

1. <https://dash.cloudflare.com> → tu cuenta → **Storage & Databases** → **Workers KV**.
2. Abre **`parqueadero-c2-flags-staging`**.
3. Busca `ks:parqueadero` → **Edit** → valor **`apagado`** → **Save**. Anota la hora.
4. Espera hasta 2 minutos y verifica (abajo).

Solo el valor exacto `apagado` apaga; mayúsculas y espacios no importan.

## Volver a encender

Lo mismo con el valor **`encendido`**. Hasta 2 minutos después, las cajas suben lo que quedó en su cola, sin que nadie toque nada.

## Verificar

Sin token, la API responde **401** si está encendida y **503** si está apagada: el kill switch se revisa antes que la sesión.

Git Bash:

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://parqueadero-api-c2-staging.laboratoriodigital-la.workers.dev/api/v1/yo
```

PowerShell:

```powershell
(Invoke-WebRequest -Uri https://parqueadero-api-c2-staging.laboratoriodigital-la.workers.dev/api/v1/yo -SkipHttpErrorCheck).StatusCode
```

> En Windows PowerShell 5.1 no existe `-SkipHttpErrorCheck`: el 401 o el 503 salen como error rojo con el número. Ese número es la respuesta.

En la caja con cuenta, **«Cuenta y nube»** sigue mostrando lo que está **«Por subir»**: con la nube apagada, ese número crece y vuelve a cero al encender.

## Si algo no sale

- **Sigue respondiendo 401 después de 2 minutos:** revisa que el valor sea `apagado` y que editaste el KV de staging, no el del agro (`agro-c0-flags-staging`).
- **Responde 503 con la clave encendida:** mira el cuerpo de la respuesta. «La nube no está lista» es la configuración de la celda, no el kill switch: `GET /api/salud` dice qué falta.
