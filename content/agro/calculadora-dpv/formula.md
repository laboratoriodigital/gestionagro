---
revision_agronomica: pendiente
fuentes:
  - "Allen, R. G., Pereira, L. S., Raes, D. y Smith, M. (1998). FAO Irrigation and Drainage Paper 56, ecuación 11."
---

# Cómo se calcula el DPV

El déficit de presión de vapor (DPV) mide cuánta agua le «falta» al aire para saturarse. Con DPV bajo, la planta transpira poco y aparecen hongos; con DPV alto, transpira de más y cierra estomas.

## Fórmulas

Temperatura en °C, humedad relativa en %, resultado en kPa.

1. Presión de vapor de saturación (FAO-56, ecuación 11):
   `es(T) = 0,6108 × e^(17,27 × T / (T + 237,3))`
2. DPV del aire:
   `DPV = es(T) × (1 − HR / 100)`
3. DPV de la hoja, si se mide la temperatura de la hoja `Th`:
   `DPVh = es(Th) − es(T) × HR / 100`

## Ejemplo resuelto

Nave de tomate a media mañana: 24 °C y 70 % de humedad relativa.

- `es(24) = 0,6108 × e^(17,27 × 24 / 261,3) = 2,984 kPa`
- `DPV = 2,984 × (1 − 0,70) = 2,984 × 0,30 = 0,895 kPa` → se muestra «0,90 kPa».

Con la hoja a 24 °C y el aire a 26 °C y 60 %: `es(26) = 3,361 kPa`, la presión de vapor del aire es `3,361 × 0,60 = 2,017 kPa`, y `DPVh = 2,984 − 2,017 = 0,967 kPa`.

## Qué se acepta

- Temperatura de −10 a 60 °C y humedad de 0 a 100 %. Fuera de ese rango, o si el valor no es un número, la calculadora dice cuál campo está mal y no calcula. Nunca muestra 0 en lugar de un error.
- Los mismos números los usan la calculadora, el cuaderno y el nodo de riego (tabla `packages/agro-calc/casos/dpv.json`).

Los rangos recomendados por cultivo y etapa no están aquí: viven en el catálogo de rangos (HU-E2.2) y pasan por revisión agronómica.
