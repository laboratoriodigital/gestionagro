# Copia en el Google Drive del productor

**Para qué:** que cada finca guarde una copia de su cuaderno en su propio Google Drive y la traiga a otro teléfono (HU-E8.4, etapa 1; decisión del dueño, 5 oct 2026). La copia va del teléfono a la cuenta de Google de la persona: CultivoPro no la ve ni la guarda.

## Cómo funciona, en corto

1. En **Respaldo**, la persona toca «Guardar copia en mi Google Drive» o «Traer una copia de mi Google Drive».
2. Google le pide permiso para que CultivoPro cree y lea **solo sus propios archivos** (permiso `drive.file`, no sensible). La app no ve el resto de su Drive.
3. El CORE hace el intercambio con Google y devuelve el permiso sellado; el teléfono lo abre con un verificador que guardó antes de salir. El permiso dura una hora y no se guarda en ningún lado.
4. La copia queda en la carpeta **«CultivoPro · respaldos»** de su Drive. Se conservan las 8 más recientes.
5. Traer una copia pasa por la misma revisión que «Importar»: muestra qué agregaría y une sin reemplazar.

No se respalda sola en segundo plano: una app web no puede pedirle permiso a Google sin que la persona lo vea. A los 7 días sin copia, la pantalla lo recuerda. Las fotos todavía no van en la copia.

## Lo que hace el dueño en Google Cloud (una vez, ~10 minutos)

En el mismo proyecto del cliente de «Entrar con Google»:

1. <https://console.cloud.google.com> → **APIs y servicios** → **Biblioteca** → **Google Drive API** → **Habilitar**.
2. **APIs y servicios** → **Pantalla de consentimiento de OAuth** (o **Google Auth Platform → Acceso a los datos**) → **Agregar o quitar permisos** → marca `.../auth/drive.file` («Ver, editar, crear y borrar solo los archivos de Google Drive específicos que uses con esta app») → **Actualizar** → **Guardar**. Es un permiso no sensible: no pide la revisión de Google.
3. **APIs y servicios** → **Credenciales** → el cliente OAuth de «Entrar con Google» → **URI de redireccionamiento autorizados** → agrega las dos:
   - `https://agro-core-staging.laboratoriodigital-la.workers.dev/api/core/drive/callback`
   - `https://agro-core.laboratoriodigital-la.workers.dev/api/core/drive/callback`

   (Las mismas direcciones del CORE de `infrastructure/celdas.json`. Si el CORE cambia de dominio, se cambian aquí también.)
4. **Guardar.** Google puede tardar unos minutos en aceptar las direcciones nuevas.

No hay secretos nuevos: el CORE usa el mismo cliente de Google y deriva la clave del sello de la que ya tiene.

## Probar en staging

1. Abre el cuaderno de staging → **Respaldo** → «Guardar copia en mi Google Drive». Google pide el permiso; acéptalo.
2. Debe volver a Respaldo con «Copia guardada en tu Google Drive, en la carpeta «CultivoPro · respaldos», como …».
3. En <https://drive.google.com> debe aparecer la carpeta con el archivo.
4. En una **ventana de incógnito**, abre `…/agro/app/respaldo/` → «Traer una copia de mi Google Drive» → elige la copia → debe mostrar la tabla de lo que agregaría → **Importar**.

| Si dice | Qué pasa |
|---|---|
| «Google no dio el permiso» | Falta el paso 1 o 3, o la dirección de regreso no coincide letra por letra |
| Google muestra «redirect_uri_mismatch» | Falta la dirección del paso 3 para ese CORE |
| «Cancelaste el permiso en Google» | Se tocó «Cancelar» en Google; no se guardó nada |
| «Tu Google Drive está lleno» | La cuenta no tiene espacio |

## La caja del parqueadero (HU-Q10.1)

La caja usa lo mismo, en staging: Más › **Respaldo** › «Guardar copia en mi Google Drive» o «Traer una copia de mi Google Drive». La carpeta es **«Caja del parqueadero · respaldos»**, el archivo es el `parqueadero-export/1` de «Hacer el respaldo», y traer une con la revisión de «Restaurar». El CORE pide el permiso con `producto=parqueadero` y vuelve solo a la caja (`/caja/`) del origen que `infrastructure/productos.json` le da al parqueadero. No hay que tocar Google Cloud otra vez: es el mismo cliente y la misma dirección de regreso del CORE. Google muestra en el permiso el nombre de la aplicación del cliente OAuth, que es el mismo de CultivoPro.

Para probarlo, los pasos de arriba en `…/caja/` de staging; los mensajes son los mismos, de usted.

## Apagarlo

Usa el mismo kill switch del CORE, `ks:agro-core` (ver `kill-switch.md`): apaga entrar con Google y también pedir el permiso de Drive. El cuaderno sigue funcionando en el teléfono.

## Etapa 2

La copia semanal automática de todas las fincas al Drive del dueño, cifrada, es la ADR-30 y la HU-C11.4 del plan del CORE (`docs/plataforma/BACKLOG_CORE.md`).
