# Runbook · Incidente con datos personales de la Tienda

**Cuándo:** cuando sospeches que alguien que no debía vio, copió, cambió o borró datos de los compradores de una o más tiendas: un token filtrado, una llave expuesta, un error que mostró el contacto de un pedido a quien no era, un respaldo que salió de donde debía, un aviso de Cloudflare o de un comercio. **Ante la duda, empieza.** Si resulta que no hubo nada, se cierra con esa conclusión escrita.

**Quién:** el dueño de Laboratorio Digital. Laboratorio Digital es el **encargado** de esos datos; cada comercio es su **responsable** (TIENDA-3.0 §14.3, Ley 1581, Decreto 1377 art. 25). Es un borrador para que lo lea un abogado, como los textos legales (WI-T7.1.4).

**Plazo:** el reporte a la SIC se hace dentro de los **15 días hábiles** desde que se detecta (Circular Externa 003 de 2018). Cuenta los días hábiles con los festivos de Colombia; anota el día y la hora en que lo supiste, porque desde ahí corre.

## Qué datos hay y dónde

| Dato | Dónde vive | Cómo está |
|---|---|---|
| Contacto del pedido (nombre, celular, correo, dirección, notas) | `pedido_contacto.sobre` en el shard de la tienda | Cifrado con la DEK `datos_personales` de la tienda; la DEK, envuelta con `TIENDA_KEK_V1` |
| Celular para buscar | `pedido_contacto.celular_indice` | HMAC con la DEK `indices`: no se puede leer el celular desde él |
| Contenido de una solicitud | `solicitud.sobre` | Cifrado como el contacto |
| Ciudad del pedido | `pedido.ciudad` | En claro: es lo único (mínimo necesario) |
| Quién vio o cambió qué | `registro` y `pedido_evento` (`contacto_leido`, `contacto_corregido`, `contacto_suprimido`) | Sin datos personales |

Sin la KEK, una copia de la base no abre ningún contacto. **Que se haya expuesto la KEK, o un token del panel de un propietario, es lo que convierte un susto en un incidente.**

## 1. Contener (la primera hora)

1. **Corta el acceso.** Según lo que pasó:
   - Una falla de la API o de la vitrina: apaga `ks:tienda` (todas) o crea `ks:tienda:<org>` (una tienda), como dice `docs/runbooks/kill-switch.md`. La API queda en solo lectura y nadie más escribe.
   - Una cuenta de un comercio comprometida: que el comercio cambie la clave de su cuenta de Google y cierre sus sesiones abiertas en Google. Mientras tanto, `ks:tienda:<org>` deja esa tienda quieta.
   - Un secreto expuesto (`SECRETO_DESPACHO`, un token de Cloudflare): rótalo como dice `docs/runbooks/secretos-de-la-tienda.md` o `docs/runbooks/credenciales.md`.
   - La KEK expuesta: es el caso grave. No la borres (sin ella no se lee nada de lo cifrado); rotarla es reenvolver todas las DEK con una nueva antes de retirar la vieja (TIENDA §14.2). Avisa en el hilo del proyecto antes de tocar producción.
2. **No borres nada que sirva de prueba**: ni filas, ni registros, ni respaldos. La purga diaria de contactos vencidos puede seguir corriendo: lo que borra es lo que ya debía irse.
3. Anota en un archivo privado, fuera del repositorio: qué viste, cuándo y cómo te enteraste.

## 2. Entender el alcance (el primer día)

1. **Qué tiendas.** El registro de cada tienda dice quién leyó contactos y cuándo: `pedido.contacto_ver`, `titular.exportar`, `exportar.datos_personales`, y en la historia de cada pedido, `contacto_leido`. Busca lecturas que nadie del comercio reconozca.
2. **Qué compradores.** Cuenta los pedidos con contacto de esas tiendas en la ventana del incidente. No copies sus datos a ningún lado para contarlos: el número basta.
3. **Qué datos.** Si solo hubo acceso a filas cifradas sin la KEK, dilo así: los contactos no se pudieron leer. Si hubo lecturas por el panel, esos contactos sí se vieron.
4. Escribe una entrada en la bitácora de la Tienda (`docs/tienda/BITACORA_TIENDA3.md`) **sin datos personales**: qué falló, cuándo, a cuántas tiendas y a cuántos compradores tocó, qué se hizo.

## 3. Avisar

1. **A cada comercio afectado**, por su correo de la ficha legal, el mismo día que conozcas el alcance: qué pasó, qué datos, de cuántos compradores, qué hiciste y qué puede hacer él. Es el responsable: él decide cómo avisar a sus compradores, y puedes ayudarle con el texto.
2. **A la SIC**, dentro de los 15 días hábiles, por el canal que la SIC tenga vigente para reportar incidentes de seguridad. Revisa el canal y el formulario el día del reporte: cambian. Guarda el radicado que te den.
3. Si un comprador escribe por la vitrina, su solicitud llega con radicado y vencimiento (HU-T6.4 y HU-T9.7) y se responde como cualquier reclamo de datos.

## 4. Cerrar

1. Vuelve a encender lo que apagaste solo cuando la causa esté corregida, con su PR y su prueba.
2. Completa la entrada de la bitácora con la causa, la corrección y el radicado de la SIC.
3. Si cambió algo que un documento afirma (este runbook, la política de privacidad, TIENDA-3.0), corrígelo en el mismo PR.

## Lo que este runbook nunca pide

- Mandar datos de compradores por WhatsApp, correo o el chat del proyecto, ni siquiera para mostrar el problema.
- Borrar el registro o la historia de un pedido.
- Desactivar la purga diaria o alargar el plazo de conservación para «guardar evidencia»: la evidencia es el registro.
