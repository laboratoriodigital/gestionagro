# Runbook: arreglos del parqueadero durante el congelamiento

**Para qué:** del 18 de diciembre de 2026 al 11 de enero de 2027 no se publica nada a producción (BACKLOG_CORE §1, BACKLOG-PARKING §2). La caja del cliente ya está en producción y su turno no para: si un fallo la detiene, este runbook dice cómo publicar el arreglo sin romper el congelamiento para lo demás (HU-Q6.2).

## Qué cuenta como emergencia

Solo lo que deja al parqueadero sin poder **registrar, cobrar o entregar el recibo** por ningún camino: ni papel, ni WhatsApp, ni QR. Una impresora que no imprime **no** es emergencia mientras **«Enviar por WhatsApp»** y **«Mostrar QR»** funcionen: se atiende con el runbook «La impresora no imprime» y el arreglo espera al 12 de enero.

## Pasos

1. **El dueño presente.** Nada se publica sin él al teléfono.
2. **Reproducir antes de arreglar (P9):** con el diagnóstico (**«Copiar diagnóstico para soporte»**) y, si se puede, con una e2e que falle igual.
3. **Rama `fix/…` desde `main`**, con el cambio más chico que arregle: nada de lo que espera al fin del congelamiento.
4. Entrada en «Sin publicar» de `apps/parqueadero-sitio/CHANGELOG.md` y la versión del parqueadero con el último número arriba (`0.2.x`). Solo sube la versión del parqueadero: ni el agro ni el CORE se publican.
5. **Staging primero:** con la caja de staging en el Android del equipo, el caso que fallaba y una entrada, una salida y un cierre completos.
6. El dueño aprueba y fusiona. El flujo publica solo el parqueadero.
7. **Fuera del turno:** se le pide al cajero tocar **«Actualizar»** después de cerrar el turno. La caja nunca se recarga sola en medio de un recibo.
8. Entrada en `docs/parking/BITACORA-PARKING.md` con la causa raíz y la regla.

## Lo que no se hace

- Publicar a producción sin pasar por staging.
- Publicar en medio de un turno o pedir recargar la caja con un recibo abierto.
- Mezclar en el mismo PR otra cosa que el arreglo.
