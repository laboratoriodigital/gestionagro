# Demanda de búsqueda de las herramientas gratuitas del parqueadero (HU-Q11.1)

**Estado:** regla escrita el 8 oct 2026, **antes** de consultar Keyword Planner. Faltan los datos (WI-Q11.1.2, el dueño) y la decisión (WI-Q11.1.3).
**Para qué:** decidir con datos cuáles de las siete herramientas del estudio §12.2 se construyen, cuáles esperan y cuáles no (CA2).
**Regla (P18):** ninguna cifra se escribe de memoria ni se estima sin decirlo. Cada celda lleva su tipo y su fuente. La regla de decisión de abajo se fusiona antes de ver los datos; si se cambia después, el historial del repositorio lo muestra y la medición no vale (CA3).
**Método:** el mismo del agro (`docs/agro/validacion/busquedas-2026-12.md`, 1 oct 2026), que sale del estudio de ecommerce §12.6.

## Las siete herramientas

| # | Herramienta (estudio §12.2) | Historia | Mercado que cuenta |
|---|---|---|---|
| 1 | Calculadora de tarifa por minuto, con el tope de la ciudad | HU-Q11.2 | Colombia (el tope es norma de Bogotá, S12) |
| 2 | Recibo de entrada con el estado del vehículo | HU-Q11.4 | Colombia (Ley 1480, art. 18) |
| 3 | Rentabilidad y punto de equilibrio de un parqueadero | Sin historia | Colombia + LATAM |
| 4 | Aviso de tarifas, medios de pago y derechos | HU-Q11.3 | Colombia (órdenes de la SIC) |
| 5 | Liquidador de mensualidades y prorrateos | Sin historia | Colombia + LATAM |
| 6 | Cupos obligatorios para eléctricos | Sin historia | Colombia (Ley 1964 de 2019) |
| 7 | IVA y factura del parqueadero de visitantes | Sin historia | Colombia (DIAN) |

La herramienta 4 se construye sin esperar esta medición, porque el cliente la usa en su entrada (backlog, decisión 5). Se mide igual: la cifra dice si su página en el sitio merece trabajo de búsqueda.

## Tipos de dato

| Tipo | Qué es | Cómo se escribe |
|---|---|---|
| **V** · verificado | Número exacto de Keyword Planner (cuenta con gasto) o impresiones reales de Search Console | `320 (V)` |
| **R** · rango | Rango de Keyword Planner sin gasto activo. Se escribe el valor que muestra Keyword Planner: «50» es 10–100 y «500» es 100–1 mil | `50 (R)` |
| **E** · estimación | Cualquier otra fuente o un cálculo propio; se dice cuál en «Notas» | `~50 (E)` |
| **—** | Sin datos o menos de 10 búsquedas al mes | `—` |

## Paso a paso (para el dueño)

### Keyword Planner (volumen mensual promedio de los últimos 12 meses)

1. Entra a <https://ads.google.com> → **Herramientas** → **Planificador de palabras clave** → **Obtener el volumen de búsqueda y las previsiones**.
2. Copia la lista del bloque «Lista para pegar» (abajo), pégala completa y toca **Comenzar**.
3. Arriba: **Ubicación = Colombia**, **Idioma = español**, **Red = Google**, **Rango = últimos 12 meses** (no un solo mes).
4. Ve a la pestaña **«Métricas históricas»**. **No** uses «Previsión»: esa estima clics de un anuncio y sale en 0 sin campaña activa.
5. **Descargar** (flecha arriba a la derecha) → **«Métricas de plan históricas»** → CSV. Guárdalo como `kp-parqueadero-colombia-AAAA-MM-DD.csv`.
6. Comprueba antes de enviarlo: debe tener **una fila por término** y las columnas «Keyword» (o «Palabra clave») y «Avg. monthly searches» (o «Promedio de búsquedas mensuales»). Si ves «Estimated Clicks» o «Campaign», es la previsión: vuelve al paso 4.
7. Cambia **Ubicación**: quita Colombia y agrega México, Perú, Ecuador, Chile y Argentina. Revisa que el filtro diga «5 ubicaciones». Repite los pasos 4 a 6 y guárdalo como `kp-parqueadero-latam-AAAA-MM-DD.csv`.
8. Pásame los dos CSV. Yo lleno la tabla y escribo la decisión con la regla de abajo.

> Si la cuenta no tiene campañas con gasto, Keyword Planner muestra rangos («100–1 mil»). Valen: se marcan **R**.

Los CSV no se suben al repositorio (pueden traer consultas con datos personales); solo las cifras de la tabla.

### Search Console (después, con una página publicada)

El sitio del parqueadero todavía no tiene páginas que se indexen (`/r/` es privada y no se indexa). La primera será el aviso de tarifas (HU-Q11.3). A los 90 días de publicada, se exportan las consultas de los últimos 3 meses (Rendimiento → Resultados de búsqueda → Consultas → CSV) y se llenan las impresiones **V** de la tabla de consultas reales.

## Lista para pegar en Keyword Planner

Las formas con «estacionamiento», «cochera» y «pensión» son las de México, Perú y Argentina; se miden para las herramientas 3 y 5, las únicas que sirven fuera de Colombia.

```text
tarifa parqueadero por minuto
cobro por minuto parqueadero
tarifas parqueaderos bogotá
tope tarifa parqueadero
cuánto cobran en un parqueadero por hora
calculadora de parqueadero
recibo de parqueadero
formato recibo de parqueadero
tiquete de parqueadero
talonario para parqueadero
ticket de estacionamiento
cuánto gana un parqueadero
negocio de parqueadero
cómo montar un parqueadero
rentabilidad de un parqueadero
negocio de estacionamiento
rentabilidad de un estacionamiento
aviso de tarifas parqueadero
letrero de tarifas parqueadero
derechos del usuario parqueadero
el parqueadero responde por robo
requisitos para un parqueadero
mensualidad parqueadero
cuánto cobrar mensualidad parqueadero
parqueadero mensual
pensión de estacionamiento
cochera mensual
ley 1964 de 2019
parqueaderos para carros eléctricos
cupos para vehículos eléctricos parqueadero
iva parqueadero
iva parqueadero propiedad horizontal
cobro parqueadero de visitantes conjunto
factura de parqueadero
```

## Resultados

| # | Término | Herramienta | Colombia | LATAM (México, Perú, Ecuador, Chile, Argentina) | Fuente y fecha | Notas |
|---|---|---|---|---|---|---|
| 1 | tarifa parqueadero por minuto | 1 · Calculadora de tarifa | | | | |
| 2 | cobro por minuto parqueadero | 1 · Calculadora de tarifa | | | | |
| 3 | tarifas parqueaderos bogotá | 1 · Calculadora de tarifa | | | | |
| 4 | tope tarifa parqueadero | 1 · Calculadora de tarifa | | | | |
| 5 | cuánto cobran en un parqueadero por hora | 1 · Calculadora de tarifa | | | | Forma coloquial |
| 6 | calculadora de parqueadero | 1 · Calculadora de tarifa | | | | |
| 7 | recibo de parqueadero | 2 · Recibo de entrada | | | | |
| 8 | formato recibo de parqueadero | 2 · Recibo de entrada | | | | |
| 9 | tiquete de parqueadero | 2 · Recibo de entrada | | | | |
| 10 | talonario para parqueadero | 2 · Recibo de entrada | | | | Lo que hoy compra el parqueadero cero |
| 11 | ticket de estacionamiento | 2 · Recibo de entrada | | | | Forma de LATAM; no cuenta para la 2 |
| 12 | cuánto gana un parqueadero | 3 · Rentabilidad | | | | |
| 13 | negocio de parqueadero | 3 · Rentabilidad | | | | |
| 14 | cómo montar un parqueadero | 3 · Rentabilidad | | | | |
| 15 | rentabilidad de un parqueadero | 3 · Rentabilidad | | | | |
| 16 | negocio de estacionamiento | 3 · Rentabilidad | | | | Forma de LATAM |
| 17 | rentabilidad de un estacionamiento | 3 · Rentabilidad | | | | Forma de LATAM |
| 18 | aviso de tarifas parqueadero | 4 · Aviso de tarifas | | | | |
| 19 | letrero de tarifas parqueadero | 4 · Aviso de tarifas | | | | |
| 20 | derechos del usuario parqueadero | 4 · Aviso de tarifas | | | | |
| 21 | el parqueadero responde por robo | 4 · Aviso de tarifas | | | | La busca el conductor |
| 22 | requisitos para un parqueadero | 4 · Aviso de tarifas | | | | |
| 23 | mensualidad parqueadero | 5 · Mensualidades | | | | |
| 24 | cuánto cobrar mensualidad parqueadero | 5 · Mensualidades | | | | |
| 25 | parqueadero mensual | 5 · Mensualidades | | | | |
| 26 | pensión de estacionamiento | 5 · Mensualidades | | | | Forma de México |
| 27 | cochera mensual | 5 · Mensualidades | | | | Forma de Argentina |
| 28 | ley 1964 de 2019 | 6 · Cupos eléctricos | | | | |
| 29 | parqueaderos para carros eléctricos | 6 · Cupos eléctricos | | | | |
| 30 | cupos para vehículos eléctricos parqueadero | 6 · Cupos eléctricos | | | | |
| 31 | iva parqueadero | 7 · IVA | | | | |
| 32 | iva parqueadero propiedad horizontal | 7 · IVA | | | | |
| 33 | cobro parqueadero de visitantes conjunto | 7 · IVA | | | | |
| 34 | factura de parqueadero | 7 · IVA | | | | También la busca quien quiere el soporte de su pago |

### Consultas reales de Search Console que no estaban en la lista

| Consulta | Impresiones (V) | Clics | Posición media | Herramienta |
|---|---|---|---|---|
| | | | | |

## Regla de decisión

Escrita el 8 oct 2026, antes de ver los datos, para no acomodarla a ellos.

1. **Demanda** de cada herramienta = suma de Colombia de sus términos. Solo en las herramientas 3 y 5, que no dependen de una norma colombiana, se suma además 0,3 × la suma de LATAM. Colombia pesa más: es el mercado de la caja paga. Con rangos se usa el valor que muestra Keyword Planner y la herramienta se marca «con rangos».
2. **Cada herramienta queda en uno de tres estados** (CA2):
   - **«se construye»** si su demanda llega a **200** o si uno de sus términos está en «100–1 mil» o más en Colombia. Las herramientas 1 y 2 reusan paquetes que la caja ya tiene (`parqueadero-tarifas`, `parqueadero-recibos`) y cuestan 2 o 3 puntos: les basta una demanda de **100**.
   - **«se espera»** si su demanda está entre **50** y el umbral anterior. No se construye ahora; se vuelve a medir con Search Console (abajo).
   - **«no»** si su demanda es menor que **50**: ningún término trae dato. Queda en «Lo que no se hace» del backlog con esta medición como razón.
3. **Vetos que la demanda no levanta.** La herramienta 7 no se publica sin la revisión de un contador, aunque diga «se construye» (estudio §12.2). La herramienta 4 se construye en todo caso (HU-Q11.3); su estado solo dice si su página merece trabajo de búsqueda.
4. **Si ninguna herramienta llega a 50**, la demanda no decide: las herramientas 1 y 2 quedan en «se espera» por su costo bajo y su cercanía a la caja, las demás en «no», y se vuelve a medir con Search Console a los 90 días de publicado el aviso de tarifas (HU-Q11.3).
5. **El orden** entre las que digan «se construye» sigue la demanda. A demanda parecida (±30 %) gana la que lleva a la caja: 2, luego 1, luego 5, luego las demás.

## Decisión

Se escribe cuando la tabla tenga cifras (WI-Q11.1.3). La decide el dueño a partir de la recomendación.

| Herramienta | Colombia | LATAM | Demanda | Estado |
|---|---|---|---|---|
| 1 · Calculadora de tarifa | | — | | |
| 2 · Recibo de entrada | | — | | |
| 3 · Rentabilidad | | | | |
| 4 · Aviso de tarifas | | — | | |
| 5 · Mensualidades | | | | |
| 6 · Cupos eléctricos | | — | | |
| 7 · IVA | | — | | |
