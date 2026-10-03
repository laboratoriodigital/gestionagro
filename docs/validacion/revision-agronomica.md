# Revisión agronómica de las herramientas gratuitas

Las dos calculadoras ya están hechas, probadas y en staging, pero siguen en `borrador`. Mientras tanto, Google no las indexa, no entran al sitemap y no corre el reloj de 90 días de HU-E2.6. Lo único que falta para publicarlas es esta revisión (ARQUITECTURA §5.1: «`revision_agronomica` aprobada antes de pasar a `activo`»).

- **Quién revisa:** el agrónomo aliado (supervisor de la finca cero, ARQUITECTURA, pregunta 4). Como también usa el producto, su revisión no es independiente, y así se anota.
- **Cómo se registra:** `aprobada:<aaaa-mm-dd>:agronomo-aliado`, por rol y nunca por nombre (P4).
- **Dónde:**
  - en `product.yaml`;
  - en `pagina.yaml`;
  - en el encabezado de cada `.md` de la carpeta de la herramienta.

## Lo que ya se validó (3 oct 2026)

Esto no reemplaza la revisión agronómica. Comprueba que lo que dice la página es lo que la calculadora hace.

| Qué | Cómo | Resultado |
|---|---|---|
| Cuentas del ejemplo de la DPV | Recalculadas a mano con la ecuación 11 de FAO-56: es(24) = 2,984 kPa; 24 °C y 70 % → 0,895 kPa; 28 °C y 55 % → 1,70 kPa; hoja a 24 °C con aire a 26 °C y 60 % → 0,967 kPa; 70 % a 16 °C → 0,55 kPa y a 28 °C → 1,13 kPa | Coinciden con el texto |
| DPV en staging | 24 °C, 70 %, tomate en producción | 0,90 kPa, «Algo alto», con su acción y la fuente |
| Ejemplo de la carencia en staging | 10/12/2026 a las 7:00, 3 días y 12 h | «Cosechar desde el 13/12» y «Entrar desde el 10/12/2026 19:00», como dice el ejemplo |
| Pruebas automáticas | Casos de `agro-calc`, otro huso horario, fin de mes y de año, 29 de febrero, sin red y accesibilidad en modo claro y oscuro | En verde |
| Producción | `agro.laboratorio-digital.com` (el dominio definitivo es `cultivopro.co` desde el 3 oct 2026) | Sigue en la versión 0.1.0: la DPV responde, pero la calculadora de carencia y la política de datos dan 404. Se corrige al publicar la próxima versión (ver «Después de aprobar») |

## Qué debe confirmar el agrónomo

Marca cada línea: **de acuerdo** o **ajustar** (con el texto que propone).

### Calculadora de DPV

1. La fórmula: FAO-56, ecuación 11, para la presión de saturación; DPV del aire = es(T) × (1 − HR/100); DPV de la hoja = es(Th) − es(T) × HR/100.
2. El rango para **tomate en producción**: en rango de 0,5 a 0,8 kPa, «algo bajo» o «algo alto» entre 0,4 y 1,2 kPa, y «bajo» o «alto» fuera de eso. Sale de Shamshiri y otros (2018), que recopila rangos de 0,4–0,8 a 0,47–1,27 kPa.
3. Las acciones de cada nivel:
   - **Bajo:** «El aire está casi saturado: la planta transpira poco y aumenta el riesgo de hongos. Ventila o calienta un poco».
   - **Algo bajo:** «Vigila la condensación en hojas y techo, sobre todo al amanecer».
   - **Algo alto:** «Vigila el riego y el marchitamiento en las horas de más calor».
   - **Alto:** «El aire está muy seco: la planta pierde agua y puede cerrar estomas. Nebuliza, sombrea o cierra ventanas si hace viento seco».
4. Las siete preguntas frecuentes de `content/agro/calculadora-dpv/pagina.yaml`, en especial dos:
   - cuándo medir: al amanecer, y entre el mediodía y las 2 de la tarde;
   - dónde colgar el termohigrómetro.
5. «Para otros cultivos, la calculadora da el valor sin indicación». Antes de agregar otro cultivo hace falta su rango con su fuente.
5b. **Rosa, pimentón y pepino (agregados el 3 oct 2026, pedido del dueño).** Son propuestas armadas con las fuentes citadas, no rangos copiados de una tabla: confirmar o ajustar cada uno.

    | Cultivo | En rango | Aviso fuera de | Fuentes y razonamiento |
    |---|---|---|---|
    | Rosa (producción de tallos) | 0,6–1,0 kPa | 0,4–1,3 kPa | Arve et al. (2013): con humedad del 90 % (DPV ≈ 0,23 kPa), los estomas funcionan mal y la flor dura menos en florero; el testigo estaba en ≈ 0,7 kPa. Liu, Wu y Cohen (2007): DPV alto reduce el área foliar del tallo. |
    | Pimentón (producción) | 0,5–1,0 kPa | 0,3–1,5 kPa | Bakker (1991): entre 0,3 y 0,9 kPa la cosecha de pimentón no cambió. Yu et al. (2023): en hortalizas bajo cubierta, el óptimo diurno es 0,5–1,5 kPa y hay estrés por encima de 1,5. |
    | Pepino (producción) | 0,5–0,9 kPa | 0,4–1,4 kPa | Bakker (1991): el pepino rindió más con humedad alta de día, dentro de 0,3–0,9 kPa. Yu et al. (2023): estrés por encima de 1,5 kPa. |

### Calculadora de carencia y reentrada

6. **La carencia se cuenta en días de calendario:** el día de la aplicación es el cero, y la fecha que sale es el primer día en que se puede cosechar.

   > **Pregunta abierta, la más importante de esta revisión.** Con esta regla, si se aplica el 10/12 a las 7:00 con 3 días de carencia, se puede cosechar desde el 13/12 a primera hora. Eso son 65 horas, no 72. ¿Es la forma correcta de leer la etiqueta en Colombia, o debe contarse en horas (desde el 13/12 a las 7:00)? Si son horas, se cambia en un solo lugar: `vencimientoCarencia` de `agro-calc`, que comparten la calculadora y el cuaderno.

7. **La reentrada se cuenta en horas**, desde la hora exacta de la aplicación.
8. **Vacío no es cero:** sin el dato, la calculadora dice «desconocida, mira la etiqueta» y no da fecha.
9. **Con dos productos, manda la carencia más larga**, y una nueva aplicación reinicia la cuenta.
10. **Consejos de «Qué hacer con el resultado»:**
    - ventilar antes de entrar aunque ya se haya cumplido la reentrada;
    - preguntar al comprador si exige un intervalo más largo;
    - poner el aviso en la puerta de la nave.
11. **Las siete preguntas frecuentes** de `content/agro/periodo-de-carencia/pagina.yaml`. Revisar en especial «¿Puedo cosechar antes si lavo la fruta?».
12. **Las fuentes.** Confirmar que siguen vigentes:
    - el Decreto 1843 de 1991 (hoy recogido en normas posteriores del sector salud: confirmar cuál citar);
    - la Resolución ICA 30021 de 2017;
    - el Código de Conducta FAO y OMS (2014).

### Para las dos

13. La pregunta y lo que se necesita, como aparecen en la página de entrada (`entrada` en cada `pagina.yaml`).
14. Detalle de uso, para decidir: la calculadora de DPV empieza en «Sin cultivo», y la tabla imprimible empieza en «Tomate — Producción». ¿Deben empezar igual?

## Después de aprobar

1. **En el repositorio**, por PR:
   - `revision_agronomica: aprobada:<fecha>:agronomo-aliado` en los tres lugares de cada herramienta;
   - `estado: activo` en su `product.yaml`.

   El CI rechaza `activo` si `product.yaml` no tiene la revisión aprobada. Los otros dos lugares no los revisa: hay que cambiarlos a mano.
2. **Publicar la versión 0.2.0** (runbook `despliegue.md`, «Publicar en producción»). Así llegan a producción:
   - la calculadora de carencia;
   - la política de datos;
   - la página de entrada nueva.
3. **En Search Console:** pedir la indexación de `/herramientas/agro/` y de cada calculadora, y anotar la fecha en `docs/validacion/dpv.md` (HU-E2.6, CA2). Ese día empieza el reloj de 90 días.
4. **La métrica:** el reporte semanal ya trae, por herramienta, las veces que se abrió, se completó, se compartió y se llevó al cuaderno, y desde hoy también la **tasa de completado** de esta semana y la anterior (HU-E2.6, CA3).
