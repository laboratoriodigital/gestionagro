# Runbook: apagar un producto (kill switch)

**Para qué:** cortar en un par de minutos, sin desplegar, el consumo o el fallo de un producto (HU-E8.1, ARQUITECTURA §8.2).

## Qué apaga hoy cada clave

| Clave | Qué se apaga | Qué sigue funcionando |
|---|---|---|
| `ks:agro-calculadora-dpv` | La recepción de eventos (`POST /api/eventos` responde 503 y no escribe en Analytics Engine) | La calculadora: es una página estática que no pasa por el Worker |
| `ks:agro-cuaderno` | **Nada todavía.** Se usará cuando exista la sincronización (HU-E5.x, HU-E8.6) | Todo el cuaderno, que hoy vive en el teléfono |

Las claves las crea el despliegue en `encendido` para cada `product.yaml` con `kill_switch: true`. Un despliegue **nunca** cambia una clave que ya existe: lo que apagues sigue apagado.

## Cuánto tarda

**Hasta 2 minutos.** Cada Worker guarda el valor en memoria hasta 60 s, y KV tarda hasta otros 60 s en propagar el cambio. No es instantáneo.

## Apagar

1. <https://dash.cloudflare.com> → tu cuenta → **Storage & Databases** → **Workers KV**.
2. Abre el namespace: **`agro-c0-flags`** (producción) o **`agro-c0-flags-staging`** (staging).
3. Busca la clave (p. ej. `ks:agro-calculadora-dpv`) → **Edit** → valor **`apagado`** → **Save**.
4. Espera 2 minutos y verifica (abajo).

Solo el valor exacto `apagado` apaga; mayúsculas y espacios no importan. Cualquier otro valor deja el producto encendido.

## Volver a encender

Lo mismo, con el valor **`encendido`**. También tarda hasta 2 minutos.

## Verificar

Envía un lote válido. Encendido responde **204**; apagado responde **503 «Producto apagado»**. En staging, cada lote encendido escribe un punto en el dataset de staging: no afecta producción.

Git Bash:

```bash
curl -s -o /dev/null -w "%{http_code}\n" -X POST https://agro-sitio-staging.laboratoriodigital-la.workers.dev/api/eventos -d '{"v":1,"producto":"agro-calculadora-dpv","eventos":{"tool.opened":1}}'
```

PowerShell:

```powershell
(Invoke-WebRequest -Method Post -Uri https://agro-sitio-staging.laboratoriodigital-la.workers.dev/api/eventos -Body '{"v":1,"producto":"agro-calculadora-dpv","eventos":{"tool.opened":1}}' -SkipHttpErrorCheck).StatusCode
```

> En Windows PowerShell 5.1 no existe `-SkipHttpErrorCheck`: el 503 sale como error rojo con «(503) Servidor no disponible». Eso también confirma que está apagado.

## Prueba real (CA4)

Se hace una vez en staging, después del primer despliegue con kill switch, y se anota aquí.

| Paso | Esperado | Resultado | Fecha y hora |
|---|---|---|---|
| Verificar encendido | 204 | | |
| Poner `ks:agro-calculadora-dpv` = `apagado` en `agro-c0-flags-staging` | — | | |
| Verificar cada 30 s hasta ver 503 | 503 antes de 2 min | | |
| Volver a `encendido` y verificar hasta ver 204 | 204 antes de 2 min | | |
