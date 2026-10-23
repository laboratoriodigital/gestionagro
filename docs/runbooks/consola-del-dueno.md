# Runbook · La consola del dueño

**Qué es:** `cuenta.laboratorio-digital.com/consola/`, con cuatro bloques: lo que entró hoy, en la semana y en el mes; lo que creció; lo que hay que revisar; y lo que se rompió (EC13, ED1 §31.1 y §32). Solo lee: no cambia nada, no entra a los datos de ningún cliente y no nombra a ninguna persona. Cada vez que la abres queda anotado en la auditoría.

**Quién la ve (D-C8):** las direcciones del secreto `CONSOLA_CORREOS`, con una entrada de hace menos de 12 horas. Cualquier otra cuenta ve «Esta página no es para tu cuenta».

## Ponerla en marcha (una vez por ambiente)

1. Guarda tu correo en cada ambiente de GitHub. Si son varios, sepáralos con comas:

   ```bash
   gh secret set CONSOLA_CORREOS --env staging
   ```

   ```bash
   gh secret set CONSOLA_CORREOS --env produccion
   ```

   `gh` pide el valor: escribe el correo con que entras (el de Google o el del enlace) y pulsa Enter.

2. Despliega el CORE para que lo reciba:

   ```bash
   gh workflow run desplegar.yml -f destino=staging -f productos=core
   ```

3. Abre `https://agro-core-staging.laboratoriodigital-la.workers.dev/consola/` (en producción, `https://cuenta.laboratorio-digital.com/consola/`), acepta la política y entra con Google o con tu correo.

## Lo que dice cada bloque

| Bloque | Qué hacer con lo que ves |
|---|---|
| **Hoy** | Un pago «para revisar» se mira en Bold. Si un cliente pagó en efectivo, se registra con [pago-en-efectivo.md](pago-en-efectivo.md) |
| **Lo que creció** | Solo números: para decidir dónde poner las horas |
| **Para revisar** | Las solicitudes de datos en rojo vencen en 3 días hábiles o menos. Se responden con [datos-del-responsable.md](datos-del-responsable.md) |
| **Lo que se rompió** | Una copia fallida se arregla con [copia-en-drive.md](copia-en-drive.md); los correos que no salen, con [correo-de-gmail.md](correo-de-gmail.md) o Resend |

## Si algo falla

- **«Esta página no es para tu cuenta»:** tu correo no está en `CONSOLA_CORREOS` de ese ambiente, o entraste con otra cuenta. Revisa el paso 1 y vuelve a desplegar.
- **«Tu entrada a la consola tiene más de 12 horas»:** vuelve a entrar. Es a propósito.
- **Un bloque dice «No se pudo leer»:** los demás siguen. Toca «Intentar de nuevo»; si persiste, la causa está en el log del Worker del CORE.
