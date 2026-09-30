# tests/

- `repo/`: guardias del repositorio (scripts sin shell, dependencias válidas…).
- `fixtures/`: las dos fincas de prueba (HU-E1.7). Importarlas desde `fixtures/fincas.ts`.
- `terminos-prohibidos.json`: nombres reales de la finca cero y de sus personas. Una prueba falla si aparecen en el código. Antes de hacer público el repositorio, este archivo sale y se pasa por `TERMINOS_PROHIBIDOS_RUTA`.
- `caos/`: batería de caos de sincronización (HU-E5.6).

Ninguna prueba nombra una finca o una persona real (P4).
