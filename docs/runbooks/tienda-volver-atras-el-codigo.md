# Volver atrás una versión del código de la Tienda (HU-T4.6)

**Para qué:** una versión nueva de la plataforma (el horno, la vitrina, la API) salió mal y hay que volver a la anterior sin tumbar las tiendas. Es distinto de «Volver a esta» del panel, que mueve una tienda a una versión anterior de **su** contenido (HU-T10.4).

## Lo que pasa cuando sale una versión nueva

- **La vitrina nueva** (`/_t/<release>/`, sus estilos, su JavaScript y sus fuentes) llega con el despliegue. El despliegue sube también la release al almacén de la celda (`vitrina/<release>/`), y el despacho sigue sirviendo desde ahí las anteriores: una página horneada con la release de antes no se rompe. Cada release se guarda 90 días y mientras alguna versión publicada la use.
- **Las tiendas no se re-hornean todas a la vez.** Cada hora, la tarea `rehornear-por-release` del cron vuelve a hornear lo publicado de unas pocas tiendas con la release nueva:
  1. primero las del anillo 1, las piloto;
  2. pasadas 24 horas desde que llegó la release, y si ninguna del anillo 1 falló, las demás, de a 3 por shard y por hora.
- **Si una del anillo 1 falla**, la ronda se detiene: avisa por Telegram con la tienda y el motivo, y el resto sigue con la release de antes. La falla queda en `vitrina/<release>/release.json` y en `/api/salud` (la tarea en falla).

## Volver a la versión anterior

1. **Desplegar el código anterior.** Actions → desplegar → «Run workflow»: en «Use workflow from» la etiqueta anterior (por ejemplo `tienda-v0.1.0`), destino `produccion`, productos `tienda`. Es el mismo paso de `docs/runbooks/despliegue.md`.
2. **La vitrina anterior vuelve a ser la de ahora.** Sus archivos ya están en el almacén y vuelven a estar en los assets: nada que subir.
3. **Las tiendas que alcanzaron la release mala** se re-hornean solas con la de antes, por anillos, como cualquier release que llega: el reloj del anillo 1 de esa release ya había corrido, así que sigue de a 3 por hora.
4. **Una tienda que necesita volver ya:** su propietario usa «Volver a esta» en Más › Publicar y versiones, o publica otra vez.

## Si algo falla

- **Una página sin estilos:** pide su hoja (`/_t/<release>/vitrina.css`). Un 404 es una release que no se subió: el despliegue lo dice («su vitrina no quedó guardada»). Volver a desplegar la sube.
- **La ronda no avanza:** mira `vitrina/<release>/release.json` en el almacén. Si hay fallas, se arregla la causa y se borra la lista `fallas` de ese archivo: la próxima vuelta sigue.
- **Con Workers Paid todavía apagado** (bitácora tienda3 31), una tienda grande no cabe en una vuelta del cron: la tarea la cuenta como falla.
