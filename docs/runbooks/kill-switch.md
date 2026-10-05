# Runbook: apagar un producto (kill switch)

**Para qué:** cortar en un par de minutos, sin desplegar, el consumo o el fallo de un producto (HU-E8.1, ARQUITECTURA §8.2).

## Qué apaga hoy cada clave

| Clave | Qué se apaga | Qué sigue funcionando |
|---|---|---|
| `ks:agro-calculadora-dpv` | La recepción de eventos (`POST /api/eventos` responde 503 y no escribe en Analytics Engine) | La calculadora: es una página estática que no pasa por el Worker |
| `ks:agro-core` | Entrar con Google y renovar la sesión (`/api/core/auth/*` responde 503), y pedir el permiso de Google Drive para la copia del productor (`/api/core/drive/*`). La crea el despliegue del CORE aunque no tenga `product.yaml` | El cuaderno en el teléfono; quien ya entró sigue con su access hasta que vence (12 h) |
| `ks:agro-cuaderno` | La API de la celda: `/api/v1/*` responde 503 con `Retry-After` (HU-E5.1). Apaga la subida de datos (HU-E5.2): el teléfono espera lo que diga `Retry-After` y lo pendiente se queda en su cola. El aviso al operario en palabras llega con HU-E8.6 | El cuaderno en el teléfono: registra y guarda sin señal ni sincronización |

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
| Verificar encendido | 204 | 204 | 1 oct 2026, 12:11:00 |
| Poner `ks:agro-calculadora-dpv` = `apagado` en `agro-c0-flags-staging` | — | Hecho por el dueño | Entre 12:11:00 y 12:11:30 (no se anotó la hora exacta) |
| Verificar cada 30 s hasta ver 503 | 503 antes de 2 min | 503 | 12:11:30 y 12:12:00 |
| Volver a `encendido` y verificar hasta ver 204 | 204 antes de 2 min | 204 | 12:12:31 |

**Lectura (1 oct 2026):** el apagado se vio en la primera verificación después del cambio y el encendido, en la siguiente. Del último 204 al 204 de vuelta pasaron 91 s. Como no se anotó la hora de cada cambio en el panel, la cifra exacta de cada propagación no se conoce: se sabe que fue menor que 30–60 s en esta prueba, dentro de los 2 minutos documentados. La próxima prueba anota también la hora de cada «Save».
