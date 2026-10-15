# Runbook · Las exportaciones de la Tienda vencen a los 7 días

**Cuándo:** una vez por ambiente, antes de que el panel ofrezca «Descargar todo» (HU-T10.7). Es la parte de HU-T17.2 que no hace el cron: las demás purgas (papelera a 30 días, `operacion` a 48 horas) las hace la tarea diaria `purgas` (`apps/tienda-api/src/tareas.ts`).

**Por qué una regla del bucket** (TIENDA-3.0 §15.3 y §5.6): las descargas del comercio llevan datos de sus compradores y viven en `exportaciones/<org>/<id>.zip` del almacén. Una regla de ciclo de vida de R2 las borra sola a los 7 días, sin código ni escrituras en D1. El token de despliegue no tiene permiso de R2 (HU-C11.5), así que la regla la pone el dueño.

## Pasos

Con la sesión de `wrangler` del dueño (`npx wrangler login`), desde la raíz del repositorio:

```
npx wrangler r2 bucket lifecycle add tienda-c1-staging exportaciones-7-dias exportaciones/ --expire-days 7
npx wrangler r2 bucket lifecycle add tienda-c1 exportaciones-7-dias exportaciones/ --expire-days 7
```

O en el panel de Cloudflare: **R2 → `tienda-c1` → Settings → Object lifecycle rules → Add rule**, con el nombre `exportaciones-7-dias`, el prefijo `exportaciones/` y «Delete objects after 7 days». Lo mismo en `tienda-c1-staging`.

Para comprobarla: `npx wrangler r2 bucket lifecycle list tienda-c1`. Debe salir la regla con el prefijo `exportaciones/` y 7 días.

## Lo que nunca se hace

- Una regla sin prefijo, o con otro prefijo: borraría los sitios publicados (`sitios/`, `objetos/`), los respaldos o los textos legales aceptados (`legal/`, que no vencen).
- Poner esta regla en el bucket de las fotos (`tienda-c1-medios`).
