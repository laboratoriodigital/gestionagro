---
version: 1
slug: "apps-cuenta-src-pages-consola-astro"
primary_target: "apps/cuenta/src/pages/consola.astro"
related_targets: ["apps/cuenta/src/consola.ts","apps/cuenta/src/estilos.css"]
---

# La consola del dueño

**Alcance y modo:** `/consola/` en la cuenta (EC13, C12). Modo Operar: el dueño completa una tarea, saber cómo va cada producto.

**Quién y para qué:** solo el dueño de Laboratorio Digital, de mañana, en el teléfono, con luz natural. Lo primero que necesita es cómo va cada producto (respuesta del dueño, 23 oct 2026). La consola solo lee: ningún control cambia nada; cada bloque enlaza a su runbook.

**Contenido:** los cuatro bloques del CORE (`/api/core/consola/{hoy,crecio,revisar,roto}`), reordenados por producto. Los productos son los del registro con organizaciones (CultivoPro, Parqueadero, TiendaPro), siempre en el mismo orden. Lo de toda la plataforma (solicitudes de datos, copia, correos) va en las observaciones generales.

**Desempeño de cada producto** (regla escrita en la pantalla, sin fórmulas ocultas): **Bajo** si tiene un pago en revisión; **Básico** si tiene un pago esperando hace más de 1 h, o planes que vencen o están en gracia; **Superior** si está al día y esta semana entró plata o llegaron espacios nuevos; **Alto** si está al día.

**Restricciones:** CSP `'self'`, fuentes servidas por el proyecto (`@ed1/ui` v2: Geist), 360 px sin moverse de lado, WCAG 2.1 AA, sin datos de personas.

**Decisiones abiertas:** el resto del ecosistema hereda o no este mundo; se decide al rediseñar la siguiente pantalla.

## Direction contract

THESIS: La consola es el boletín del periodo de los productos: cada producto en su fila, con su plata de hoy, su desempeño sellado y una observación escrita. Rechaza el tablero de tarjetas de cifras y gráficas que toda consola de la categoría trae.

OWN-WORLD: Papel bond blanco; una franja institucional azul tinta (#1D3A8A) encabeza el boletín con la fecha y el periodo en blanco; filas de formulario separadas por reglas finas de azul pálido; el desempeño es un sello de tinta (doble filete redondeado, mayúsculas, leve giro) en verde Superior, azul Alto, ámbar Básico o rojo Bajo, y su tinte pálido cubre la fila entera. Geist, cifras tabulares.

STORY: El dueño abre la consola, lee el renglón guía, recorre las tres filas y sabe en segundos qué producto va bien y cuál pide atención. Debajo, las observaciones generales y el detalle de cada bloque, con el runbook de lo que se hace.

FIRST VIEWPORT: A 360 × 740: la franja azul con «Boletín del día», la fecha y «Salir»; el renglón guía «3 productos · 1 para revisar»; tres filas del mismo alto, cada una con el nombre del producto a la izquierda y su sello a la derecha, la plata de hoy como la cifra más grande, «semana · mes» debajo y la observación en una línea. Movimiento firma: el sello se estampa una vez al cargar (baja con escala y opacidad, salida exponencial), quieto con movimiento reducido.

FORM: El boletín del periodo (el boletín de notas del colegio colombiano), posición 4 de 7 en la lista ordenada; seed key 5e13d420. Raises: escala fija de tamaños (atlas), renglón guía (diccionario), lugar fijo de cada producto (catálogo), prioridad declarada al recogerse (consola oscura), el color del desempeño gobierna la fila (mapa).

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
