---
name: Laboratorio Digital
description: El boletín del periodo, el mundo visual del rediseño del ecosistema (primero, la consola del dueño).
colors:
  tinta-institucional: "#1d3a8a"
  tinta-palida: "#dbe3f5"
  regla-azul: "#c9d3ea"
  sello-superior: "#166534"
  sello-alto: "#1d3a8a"
  sello-basico: "#94490a"
  sello-bajo: "#b91c1c"
  atencion-fondo: "#fdf0e1"
  atencion-texto: "#7a3d06"
  papel-bond: "#ffffff"
  texto: "#0b0b0a"
  texto-suave: "#5a5a54"
  gris-quieto: "#76766f"
typography:
  display:
    fontFamily: "Geist, system-ui, sans-serif"
    fontSize: "clamp(1.875rem, 8.5vw, 2.5rem)"
    fontWeight: 350
    lineHeight: 1.05
    letterSpacing: "-0.03em"
    fontFeature: "tnum"
  headline:
    fontFamily: "Geist, system-ui, sans-serif"
    fontSize: "clamp(1.66rem, 3.2vw, 2.08rem)"
    fontWeight: 600
    lineHeight: 1.1
    letterSpacing: "-0.02em"
  title:
    fontFamily: "Geist, system-ui, sans-serif"
    fontSize: "1.33rem"
    fontWeight: 600
    letterSpacing: "-0.01em"
  body:
    fontFamily: "Geist, system-ui, sans-serif"
    fontSize: "1.0625rem"
    fontWeight: 400
    fontFeature: "tnum"
  small:
    fontFamily: "Geist, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
  label:
    fontFamily: "Geist, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 600
    letterSpacing: "0.08em"
rounded:
  sello: "10px"
  foco: "4px"
  pildora: "999px"
spacing:
  "1": "0.25rem"
  "2": "0.5rem"
  "3": "0.75rem"
  "4": "1rem"
  "6": "1.5rem"
  "8": "2rem"
  "12": "3rem"
  "16": "4rem"
components:
  franja:
    backgroundColor: "{colors.tinta-institucional}"
    textColor: "{colors.papel-bond}"
    typography: "{typography.headline}"
    padding: "1.5rem 1rem 1rem"
  renglon-guia:
    backgroundColor: "{colors.tinta-palida}"
    textColor: "{colors.tinta-institucional}"
    typography: "{typography.small}"
    padding: "0.75rem 1rem"
  renglon-guia-atencion:
    backgroundColor: "{colors.atencion-fondo}"
    textColor: "{colors.atencion-texto}"
  sello:
    rounded: "{rounded.sello}"
    typography: "{typography.small}"
    width: "7.5rem"
    padding: "0.25rem 0.5rem"
  boton-en-franja:
    textColor: "{colors.papel-bond}"
    rounded: "{rounded.pildora}"
    height: "48px"
    padding: "0 1rem"
  boton-reintentar:
    backgroundColor: "{colors.papel-bond}"
    textColor: "{colors.tinta-institucional}"
    rounded: "{rounded.pildora}"
    height: "48px"
    padding: "0 1rem"
---

# Design System: Laboratorio Digital

## Overview

**Creative North Star: "El boletín del periodo"**

El boletín de notas del colegio colombiano: papel bond blanco, una franja institucional azul tinta que encabeza la hoja con la fecha y el periodo, filas de formulario separadas por reglas finas y, en cada fila, un desempeño sellado a mano. Quien lo abre sabe en segundos qué va bien y qué pide atención, sin leer una gráfica. El mundo nació en la consola del dueño (C12, 23 oct 2026) y es el punto de partida del rediseño del resto del ecosistema; si cada pantalla lo hereda tal cual o lo adapta se decide al rediseñar la siguiente.

La densidad es la de un formulario: una fila por asunto, en su lugar de siempre, con una sola cifra grande que nada le disputa. La personalidad vive en los detalles precisos —el doble filete, el leve giro del sello, el tinte que cubre la fila— y no en la decoración. Se rechaza el tablero de tarjetas de cifras y gráficas que trae toda consola de la categoría.

**Key Characteristics:**
- Papel blanco siempre: se lee de mañana, en el teléfono, con luz natural.
- Bandas de borde a borde; el contenido respeta un margen de lectura de 1rem en el teléfono y una columna de 72rem centrada en pantallas anchas.
- El desempeño gobierna el color: el sello y el tinte pálido de su fila salen del mismo tono.
- Cifras tabulares en todo el boletín.
- La regla de calificación está escrita en la pantalla, sin fórmulas ocultas.

## Colors

Una tinta azul institucional sobre papel, y cuatro tintas de sello que solo aparecen para decir un desempeño.

### Primary
- **Azul tinta institucional** (tinta-institucional): la franja, el doble filete que abre cada sección, el chevrón, los enlaces a los runbooks y el anillo de foco.
- **Azul tinta pálido** (tinta-palida): el texto secundario dentro de la franja, el filete inferior de la franja, el renglón guía cuando todo está al día y la selección de texto.
- **Regla azul** (regla-azul): las reglas finas que separan filas y observaciones.

### Secondary
- **Verde Superior** (sello-superior): al día, y esta semana entró plata o llegaron espacios nuevos.
- **Azul Alto** (sello-alto): al día, sin novedades. Es la misma tinta institucional: estar al día es el estado de la casa.
- **Ámbar Básico** (sello-basico): planes que vencen o están en gracia, o un pago esperando más de una hora.
- **Rojo Bajo** (sello-bajo): un pago en revisión; también los errores de carga.
- **Fondo y texto de atención** (atencion-fondo, atencion-texto): el renglón guía cuando algún producto pide atención.

### Neutral
- **Papel bond** (papel-bond): el fondo de todo el boletín y del detalle abierto.
- **Tinta de texto** (texto) y **texto suave** (texto-suave): cuerpo y datos secundarios (semana, mes, notas).
- **Gris quieto** (gris-quieto): el estado mientras carga, antes de que haya desempeño.

### Named Rules
**The Tinte Rule.** La fila se tiñe con su propio tono de sello al 10 % sobre el papel (`color-mix(in srgb, <tono> 10%, papel)`), y ese tono debe pasar 4,5:1 sobre su tinte y sobre el papel. La prueba `tests/repo/boletin-contraste.test.ts` lo calcula; un tono que no pase no entra.

**The Solo Tokens Rule.** Ningún color va suelto en el CSS de la cuenta: todo sale de `--boletin-*` y de los grises de `tokens.ts`, mezclados con `color-mix`.

## Typography

**Display Font:** Geist (con system-ui)
**Body Font:** Geist (con system-ui)

**Character:** Una sola familia, servida por el proyecto, que gana jerarquía por peso y tamaño y no por mezcla de estilos: la cifra del día en peso ligero y grande; los nombres y títulos en peso fuerte.

### Hierarchy
- **Display** (350, clamp(1.875rem, 8.5vw, 2.5rem); 1.75rem en la tabla ancha, 1.05): la plata de hoy de cada producto, la cifra más grande de la fila.
- **Headline** (600, clamp(1.66rem, 3.2vw, 2.08rem), 1.1): el título de la franja.
- **Title** (600, 1.33rem): los títulos de sección (observaciones generales, cómo se califica).
- **Body** (400, 1.0625rem): nombres de producto (en 600), observaciones y resúmenes.
- **Small** (400, 0.875rem): fecha, semana y mes, notas, enlaces a runbooks, el texto del sello.
- **Label** (600, 0.75rem, 0.08em, mayúsculas): encabezados de columna de la tabla ancha y apartados del detalle.

### Named Rules
**The Una Cifra Rule.** Cada fila tiene una sola cifra grande, la de hoy. Semana y mes van en texto pequeño y suave, nunca compitiendo.

## Layout

En el teléfono cada producto es una fila apilada: nombre y sello arriba, la cifra de hoy, «Semana · Mes» debajo y la observación en una línea. Desde 52rem el boletín se vuelve una tabla con encabezados de columna (Producto y desempeño · Hoy · Semana · Mes · Observación) y la columna de observación es la más ancha. Nunca tarjetas. El orden de prioridad no cambia con el ancho: productos, observaciones generales, regla de calificación; en pantallas anchas las dos últimas van lado a lado (3fr y 2fr).

El margen de lectura es `max(1rem, (100% − 72rem) / 2)`: las bandas tocan los bordes y su contenido se alinea en una sola columna. El ritmo usa la escala de espacios (0.25 a 4rem); las secciones del pie se separan 3rem. A 360 px nada se mueve de lado.

## Elevation & Depth

Plano, sin sombras. La profundidad la dan la tinta y las reglas: el filete doble de 3px abre cada sección y cierra la franja, las reglas finas de 1px separan filas, y el tinte del desempeño distingue una fila de otra. El detalle abierto vuelve al papel blanco bajo una regla punteada.

### Named Rules
**The Sin Sombras Rule.** Nada flota sobre el papel. Si algo necesita separarse, lleva una regla o un tinte.

## Shapes

Formas de formulario: filas rectas de borde a borde, reglas horizontales y ningún contenedor redondeado. Las únicas curvas son el sello (10px, doble filete, girado −4°), los botones en píldora y el punto de estado de cada observación general.

## Components

### Buttons
- **Shape:** píldora (999px), 48px de alto mínimo para el dedo.
- **En la franja (Salir):** transparente, texto blanco, borde blanco al 55 %; al pasar, un velo blanco del 12 %.
- **Reintentar:** papel con borde y texto azul tinta.
- **Focus:** anillo de 2px azul tinta a 3px de distancia; blanco dentro de la franja.

### Sello del desempeño
Tinta de sello: doble filete de 3px del tono del desempeño, fondo de su tinte, texto en mayúsculas, 700, del mismo ancho siempre (7.5rem) y girado −4°. Se estampa una vez al cargar (420ms, `cubic-bezier(0.16, 1, 0.3, 1)`, de escala 1.55 y −9° a su sitio, con un desfase de 90ms por fila); con movimiento reducido aparece quieto.

### Fila de producto (signature)
Un `details` cuyo resumen es toda la fila: no hay un enlace suelto que parezca llevar a otra página. Fondo del tinte de su desempeño; al pasar, un 5 % más del tono. El chevrón azul tinta gira 180° al abrir; el detalle se lee sobre papel, con apartados en etiqueta.

### Renglón guía
Una línea en negrita pequeña bajo la franja que resume la vista («3 productos · 1 pide atención · 2 observaciones»): azul pálido si todo está al día, ámbar de atención si algo lo pide.

### Observación general
Título con un punto dibujado del tono de su estado, resumen teñido al 55 % con ese tono, la lista de casos en texto suave y el enlace a su runbook.

## Do's and Don'ts

### Do:
- **Do** poner cada producto siempre en el mismo lugar y orden, aunque cambie su desempeño.
- **Do** escribir en la pantalla la regla con la que se califica.
- **Do** teñir la fila con el tono de su sello al 10 % y probar el contraste antes de agregar un tono.
- **Do** abrir cada sección con el filete doble de 3px en azul tinta.

### Don't:
- **Don't** armar el boletín con tarjetas de cifras ni gráficas.
- **Don't** usar sombras ni contenedores redondeados para separar filas.
- **Don't** poner colores sueltos en el CSS: solo tokens y `color-mix`.
- **Don't** pasar la consola a tema oscuro: se lee de mañana, con luz natural.
