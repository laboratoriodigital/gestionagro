---
revision_agronomica: pendiente
fuentes:
  - "Allen, R. G., Pereira, L. S., Raes, D. y Smith, M. (1998). FAO Irrigation and Drainage Paper 56, ecuación 11."
---

## Cómo se calcula el DPV

Temperatura en °C, humedad relativa en %, resultado en kPa (kilopascales).

1. Presión de vapor de saturación, es decir, cuánta agua cabe en el aire a esa temperatura (FAO-56, ecuación 11):
   `es(T) = 0,6108 × e^(17,27 × T / (T + 237,3))`
2. DPV del aire: lo que le falta al aire para llenarse.
   `DPV = es(T) × (1 − HR / 100)`
3. DPV de la hoja, si mides la temperatura de la hoja `Th` con un termómetro infrarrojo:
   `DPVh = es(Th) − es(T) × HR / 100`

### DPV de la hoja, con números

Aire a 26 °C y 60 %, hoja a 24 °C:

- `es(26) = 3,361 kPa`, así que el vapor que hay en el aire es `3,361 × 0,60 = 2,017 kPa`.
- `es(24) = 2,984 kPa` en la superficie de la hoja.
- `DPVh = 2,984 − 2,017 = 0,967 kPa` → la calculadora muestra «0,97 kPa».

### Qué valores acepta

Temperatura de −10 a 60 °C y humedad de 0 a 100 %. Si un valor está fuera de ese rango o no es un número, la calculadora dice cuál campo revisar y no calcula. Nunca muestra 0 en lugar de un error.

El cuaderno de campo y la calculadora usan exactamente la misma fórmula: el número que ves aquí es el mismo que queda anotado allá.
