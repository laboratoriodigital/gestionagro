# Demanda de búsqueda de calculadoras agronómicas (HU-E0.2)

**Estado:** cifras de Keyword Planner registradas el 1 oct 2026 (periodo: 1 sep 2025 – 31 ago 2026). Falta Search Console: la DPV necesita tiempo publicada para tener impresiones. Primer intento descartado: era la «Previsión» de una campaña, sin palabras clave y en 0.
**Para qué:** decidir con datos el orden de las herramientas 2 a 5 (Estudio de mercado, tabla de herramientas candidatas).
**Regla (P18):** ninguna cifra se escribe de memoria ni se estima sin decirlo. Cada celda lleva su tipo y su fuente.

## Tipos de dato

| Tipo | Qué es | Cómo se escribe |
|---|---|---|
| **V** · verificado | Número exacto de Keyword Planner (cuenta con gasto) o impresiones reales de Search Console | `320 (V)` |
| **R** · rango | Rango de Keyword Planner sin gasto activo | `100–1 mil (R)` |
| **E** · estimación | Cualquier otra fuente o un cálculo propio; se dice cuál en «Notas» | `~50 (E)` |
| **—** | Sin datos o menos de 10 búsquedas al mes | `—` |

## Paso a paso

### Keyword Planner (volumen mensual promedio de los últimos 12 meses)

1. Entra a <https://ads.google.com> → **Herramientas** → **Planificador de palabras clave** → **Obtener el volumen de búsqueda y las previsiones**.
2. Copia la lista del bloque «Lista para pegar» (abajo), pégala completa y toca **Comenzar**.
3. Arriba: **Ubicación = Colombia**, **Idioma = español**, **Red = Google**, **Rango = últimos 12 meses** (no un solo mes).
4. Ve a la pestaña **«Métricas históricas»**. **No** uses «Previsión»: esa estima clics de un anuncio y sale en 0 sin campaña activa.
5. **Descargar** (flecha arriba a la derecha) → **«Métricas de plan históricas»** → CSV. Guarda el archivo como `kp-colombia-AAAA-MM-DD.csv`.
6. Comprueba antes de enviarlo: debe tener **una fila por término** y las columnas «Keyword» (o «Palabra clave») y «Avg. monthly searches» (o «Promedio de búsquedas mensuales»). Si ves «Estimated Clicks» o «Campaign», es la previsión: vuelve al paso 4.
7. Cambia **Ubicación**: quita Colombia y agrega México, Perú, Ecuador, Chile, Argentina, Guatemala y Costa Rica. Revisa que el filtro diga «8 ubicaciones». Repite los pasos 4 a 6 y guárdalo como `kp-latam-AAAA-MM-DD.csv`.
8. Pásame los dos CSV. Yo lleno la tabla y escribo la recomendación.

> Si la cuenta no tiene campañas con gasto, Keyword Planner muestra rangos («100–1 mil»). Valen: se marcan **R**.

### Search Console (impresiones reales de la DPV, solo verificadas)

1. <https://search.google.com/search-console> → propiedad `agro.laboratorio-digital.com` → **Rendimiento** → **Resultados de búsqueda**.
2. Fechas: **últimos 3 meses**. Pestaña **Consultas**. Exportar → «CSV».
3. Guárdalo como `gsc-AAAA-MM-DD.csv`. De ahí salen las impresiones **V** de los términos de la DPV y las consultas que la gente escribe y no estaban en la lista.

Los CSV no se suben al repositorio (pueden traer consultas con datos personales); solo las cifras de la tabla.

## Lista para pegar en Keyword Planner

```text
déficit de presión de vapor
dpv invernadero
vpd invernadero
calcular dpv
déficit de presión de vapor tomate
dosis por bomba de espalda
cuánto echar por bomba de 20 litros
calibración de bomba de espalda
dosis por hectárea a litros
periodo de carencia
periodo de reentrada
calendario de carencias
solución nutritiva tomate
solución de steiner
cálculo de fertirriego
tanque a y b fertirriego
conductividad eléctrica solución nutritiva
porcentaje de drenaje riego
drenaje en sustrato
grados día
integral de luz diaria
requisitos bpa ica
lista de chequeo bpa ica
costo de producción tomate invernadero
liquidar jornal agrícola
```

## Resultados

| # | Término | Herramienta candidata | Colombia | LATAM (México, Perú, Chile, Argentina, Ecuador) | Fuente y fecha | Notas |
|---|---|---|---|---|---|---|
| 1 | déficit de presión de vapor | 3 · DPV (publicada) | 50 (R) | 500 (R) | KP, 1 oct 2026 |  |
| 2 | dpv invernadero | 3 · DPV (publicada) | — | — | KP, 1 oct 2026 |  |
| 3 | vpd invernadero | 3 · DPV (publicada) | — | — | KP, 1 oct 2026 | Sigla en inglés que también se busca |
| 4 | calcular dpv | 3 · DPV (publicada) | — | — | KP, 1 oct 2026 |  |
| 5 | déficit de presión de vapor tomate | 3 · DPV (publicada) | — | — | KP, 1 oct 2026 |  |
| 6 | dosis por bomba de espalda | 1 · Dosis por bomba | — | — | KP, 1 oct 2026 |  |
| 7 | cuánto echar por bomba de 20 litros | 1 · Dosis por bomba | — | — | KP, 1 oct 2026 | Forma coloquial |
| 8 | calibración de bomba de espalda | 1 · Dosis por bomba | — | — | KP, 1 oct 2026 |  |
| 9 | dosis por hectárea a litros | 1 · Dosis por bomba | — | — | KP, 1 oct 2026 |  |
| 10 | periodo de carencia | 2 · Calendario de carencias | 500 (R) | 500 (R) | KP, 1 oct 2026 | LATAM: −90 % a tres meses y −90 % anual. Puja alta en LATAM (161–57.725 COP): hay anunciantes |
| 11 | periodo de reentrada | 2 · Calendario de carencias | 50 (R) | 50 (R) | KP, 1 oct 2026 |  |
| 12 | calendario de carencias | 2 · Calendario de carencias | — | — | KP, 1 oct 2026 |  |
| 13 | solución nutritiva tomate | 4 · Solución nutritiva A y B | — | — | KP, 1 oct 2026 |  |
| 14 | solución de steiner | 4 · Solución nutritiva A y B | 50 (R) | 50 (R) | KP, 1 oct 2026 | Competencia media en LATAM (índice 35) |
| 15 | cálculo de fertirriego | 4 · Solución nutritiva A y B | — | — | KP, 1 oct 2026 |  |
| 16 | tanque a y b fertirriego | 4 · Solución nutritiva A y B | — | — | KP, 1 oct 2026 |  |
| 17 | conductividad eléctrica solución nutritiva | 4 · Solución nutritiva A y B | — | — | KP, 1 oct 2026 |  |
| 18 | porcentaje de drenaje riego | Riego (ya en el cuaderno) | — | — | KP, 1 oct 2026 | Si es alto, el % de drenaje puede ser página pública |
| 19 | drenaje en sustrato | Riego (ya en el cuaderno) | — | — | KP, 1 oct 2026 |  |
| 20 | grados día | 10 · Grados-día y DLI | 50 (R) | 50 (R) | KP, 1 oct 2026 |  |
| 21 | integral de luz diaria | 10 · Grados-día y DLI | — | — | KP, 1 oct 2026 |  |
| 22 | requisitos bpa ica | 5 · Autodiagnóstico BPA-ICA | — | — | KP, 1 oct 2026 |  |
| 23 | lista de chequeo bpa ica | 5 · Autodiagnóstico BPA-ICA | 50 (R) | 50 (R) | KP, 1 oct 2026 | LATAM: −100 % a tres meses |
| 24 | costo de producción tomate invernadero | 6 · Costo de producción | — | — | KP, 1 oct 2026 |  |
| 25 | liquidar jornal agrícola | 7 · Jornales y recargos | — | — | KP, 1 oct 2026 |  |

**Totales** (suma de los términos, según Keyword Planner): Colombia 750; LATAM 1.200 (México 441, Perú 266, Chile 198, Argentina 153, Ecuador 74). Guatemala y Costa Rica se pidieron y no traen datos.

**Cómo leer las cifras.** Sin gasto activo, Keyword Planner redondea: «50» corresponde a un rango de 10–100 y «500» a uno de 100–1 mil. Por eso son **R** y no **V**. «—» es que no trae dato: menos de 10 al mes o nada.

### Consultas reales de Search Console que no estaban en la lista

| Consulta | Impresiones (V) | Clics | Posición media | Herramienta |
|---|---|---|---|---|
| | | | | |

## Recomendación de orden para las herramientas 2 a 5

Se escribe cuando la tabla tenga cifras. La regla, decidida antes de ver los datos para no acomodarla a ellos:

1. **Demanda** de cada herramienta = suma de Colombia de sus términos + 0,3 × suma de LATAM. Colombia pesa más: es el mercado del producto pago. Con rangos se usa el valor medio del rango y la herramienta se marca «con rangos».
2. **Desempate y veto**, de la tabla del estudio: una herramienta que lleva al cuaderno (carencias, BPA-ICA) gana a demanda parecida (±30 %). Una que necesita revisión agronómica antes de publicar (dosis, solución nutritiva) no se publica sin ella (instrucciones §7).
3. Si ninguna herramienta pasa de **50 búsquedas al mes en Colombia**, la demanda no decide: se ordena por cercanía al cuaderno y se vuelve a medir con Search Console a los 90 días de la DPV (25 feb 2027).

**Demanda por herramienta** (regla 1: Colombia + 0,3 × LATAM; todas con rangos):

| Herramienta | Colombia | LATAM | Demanda |
|---|---|---|---|
| 2 · Calendario de carencias | 550 | 550 | **715** |
| 3 · DPV (publicada) | 50 | 500 | 200 |
| 4 · Solución nutritiva A y B | 50 | 50 | 65 |
| 5 · Autodiagnóstico BPA-ICA | 50 | 50 | 65 |
| 10 · Grados-día y DLI | 50 | 50 | 65 |
| 1 · Dosis por bomba | — | — | 0 |
| 6 · Costo de producción | — | — | 0 |
| 7 · Jornales y recargos | — | — | 0 |

| Orden | Herramienta | Demanda | Por qué |
|---|---|---|---|
| 2 | Calendario de carencias y reentradas | 715 (R) | La única con más de 50 búsquedas al mes en Colombia («periodo de carencia», 100–1 mil). Lleva al cuaderno, y el cálculo ya existe y está probado (`vencimientoCarencia`, HU-E3.10). Ojo: en LATAM cae −90 %; Colombia no muestra caída. |
| 3 | Autodiagnóstico BPA-ICA | 65 (R) | Empate con 4 y 10 (±30 %). Gana el desempate de la regla 2: lleva al cuaderno, y la carpeta BPA es la razón para pagar. |
| 4 | Grados-día y DLI | 65 (R) | Empate. No necesita revisión agronómica de dosis para publicarse. |
| 5 | Solución nutritiva A y B | 65 (R) | Empate. Va después porque no se publica sin revisión agronómica (instrucciones §7). |

**Lo que cambia frente al backlog.** El backlog tiene «dosis por bomba» como herramienta 2 (E10, H7). Ninguna de sus cuatro formas de búsqueda trae datos en Colombia ni en LATAM. Los datos no la apoyan como segunda. Antes de construirla conviene medir otras formas de decirlo (por ejemplo, «cuántos cc por litro», «cuánto echarle a la bomba») o reemplazarla por el calendario de carencias. **La decisión es del dueño.**

**Decisión del dueño (1 oct 2026):** se acepta la recomendación. El calendario de carencias reemplaza a «dosis por bomba» como herramienta 2 (BACKLOG, E10: HU-E10.1 y HU-E10.2, ruta `/herramientas/agro/periodo-de-carencia/`). Dosis por bomba queda preparada (HU-E10.3) hasta la medición del 25 feb 2027, que incluirá las otras formas de decirlo.

**Límites de estos datos.** Son rangos, no cifras exactas; un mes de Search Console de la DPV en producción los afina. Se vuelve a medir a los 90 días de la DPV (25 feb 2027), como dice la regla 3.
