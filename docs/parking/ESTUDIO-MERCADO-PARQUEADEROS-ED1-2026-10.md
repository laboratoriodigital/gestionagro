# Estudio de mercado y vigilancia tecnológica de parqueaderos
## Colombia, Latinoamérica y referentes globales — Implicaciones para ED1

**Versión:** 1.0, 6 de octubre de 2026.  
**Fecha de corte:** 6 de octubre de 2026, hora de Colombia. Cada fuente lleva su fecha de publicación cuando la página la muestra (§18).  
**Documentos de referencia:** `docs/ecosistema/ECOSISTEMA-DIGITAL-ED1-v1.4.md` (ED1 §N), `docs/ARQUITECTURA.md` y `docs/plataforma/PLATAFORMA.md`, al 6 de octubre de 2026.  
**Formato:** el mismo del estudio de ecommerce (`docs/tienda/ESTUDIO-MERCADO-ECOMMERCE-ED1-2026-10-v1.3.md`): jerarquía de evidencia, registro de fuentes S-numeradas y control editorial de afirmaciones.  
**Naturaleza del trabajo:** investigación documental de fuentes públicas; análisis competitivo, tecnológico, regulatorio y económico; recomendaciones e hipótesis de validación.  
**Alcance temporal:** información accesible al corte.  
**Moneda:** COP, USD, EUR o BRL según cada fuente. No se convierten cifras entre monedas sin una tasa y una fecha explícitas.

> **Resultado principal del análisis.** El parqueadero colombiano pequeño y mediano es un pequeño negocio del ICP de ED1 (ED1 §2.1) con una obligación legal que hoy cumple mal: entregar un recibo con la hora, el vehículo, **su estado** y el valor, cobrar por minuto con tope y responder por lo que custodia (§13). Ya existe un mercado de software local barato (COP 60.000–250.000 al mes) que resuelve entrada, salida y caja (§6.3). Lo que no se encontró es una herramienta gratuita que lo resuelva sin registro, ni una caja que funcione **sin red** y deje evidencia del estado del vehículo. La recomendación es entrar con herramientas gratuitas del ICP, medir su demanda, y construir el SaaS solo con un **parqueadero cero** como excepción declarada, después del M0 de la Tienda 3.0, que trae lo que el parqueadero también necesita de la plataforma.

### Control de versiones

| Versión | Fecha | Cambios |
|---|---|---|
| 1.0 | 6 oct 2026 | Primera versión: investigación documental, con ED1 v1.4 y lo construido en este repositorio como fuentes sobre el proyecto |

---

## 1. Resumen ejecutivo

### 1.1 Hallazgos sustentados

1. **La demanda de parqueo en Colombia es de motos antes que de carros.** El parque automotor cerró 2025 con 21.345.925 vehículos activos. Las motos son el 63 % (13.528.164); los demás vehículos suman 7.585.011. [S10]
2. **La ley pide trazabilidad por cada vehículo.** El recibo debe llevar fecha y hora de recepción, identificación del vehículo, su estado y el valor del servicio, y puede apoyarse en medios tecnológicos (Ley 1480 de 2011, art. 18). En 2022 la SIC dio 17 órdenes a parqueaderos de Bogotá por no documentar el estado del vehículo, no informar medios de pago ni tarifas y usar cláusulas para eludir la custodia. [S23–S25]
3. **Las tarifas son por minuto y con tope en las ciudades que las regulan.** En Bogotá, desde el 30 de enero de 2026, el máximo fuera de vía es de COP 230 por minuto para carros y COP 161 para motos (COP 253 y 177 con sello de oro). La fórmula del tope combina zona, tipo de vehículo y nivel de servicio, con redondeo a COP 50 (Decreto 461 de 2019). [S11–S12]
4. **Ya hay un mercado de software local para parqueaderos pequeños, y es barato.** Seis proveedores colombianos publican planes de COP 60.000 a 250.000 al mes, con prueba gratuita de 7 a 20 días. La factura electrónica suele ir por un tercero (Alegra) y se cobra aparte. Uno declara más de 500 parqueaderos activos. [S35–S40]
5. **Los grandes operadores se consolidan y se digitalizan.** Indigo, dueño de City Parking desde 2021, compró Central Parking System en enero de 2026 y pasa de 200 puntos. Parking procesa 1,5 millones de transacciones al mes, el 75 % en Bogotá, y su programa de fidelidad tiene 450.000 inscritos. [S20–S22]
6. **El pago digital del parqueo crece por tags, apps y QR.** Flypass opera en 214 parqueaderos y 12.000 parquímetros con más de 615.000 usuarios. La app de las Zonas de Parqueo Pago de Bogotá tiene más de 2 millones de usuarios y 9 millones de usos. Bre-B superó 34 millones de usuarios en seis meses. [S14, S17, S34]
7. **Afuera, el sector se concentra en pocos grupos.** Metropolis compró SP+ por USD 1.500 millones (2024). Arrive reúne ocho marcas, entre ellas EasyPark, ParkMobile, Flowbird y Parkopedia. ASSA ABLOY compró SKIDATA. Ninguno se enfoca en el parqueadero pequeño latinoamericano. [S45–S48]
8. **Las cifras de tamaño del mercado mundial no coinciden.** Dos consultoras dan USD 5.500 millones y USD 7.220 millones para la gestión de parqueaderos en 2025. No se usan para dimensionar la oportunidad de ED1. [S43–S44]
9. **En Brasil, lo digital ya es una quinta parte del ingreso del mayor operador.** Estapar obtuvo el 22,2 % de su ingreso del 3T25 por canales digitales, con su app Zul+ (8,8 millones de usuarios registrados). [S50–S51]
10. **Cobrar el parqueadero de visitantes en propiedad horizontal es legal y crea obligaciones.** Exige aprobación de la asamblea y reglamento. Una fuente secundaria cita a la DIAN: la copropiedad que cobra debe declarar IVA y facturar electrónicamente. [S30, S33]

### 1.2 Recomendaciones para ED1 — juicio del consultor

- **Entrar por herramientas gratuitas del ICP**, sin cuenta y 100 % en el navegador: calculadora de tarifa por minuto con el tope de la ciudad, recibo de entrada con el estado del vehículo, rentabilidad y punto de equilibrio de un parqueadero, y aviso de tarifas y derechos. Antes de construirlas, medir su demanda de búsqueda con el método del ecosistema (§12).
- **El primer producto pago, si la validación lo justifica, es una «caja de parqueadero» offline-first.** Entrada y salida por placa, tiquete con QR, foto del estado del vehículo, cobro por minuto, cierre de turno y mensualidades. Usa casi todo lo que la plataforma ya tiene (§3.3, §15).
- **El SaaS entra como excepción declarada** (ED1 §2.1, [D3]), como la Tienda 3.0: el parqueadero está en el ICP, pero un vertical SaaS es de la fase 7 (ED1 §33). La excepción tiene sentido con un **parqueadero cero** real, como la finca cero del agro.
- **Secuencia:** el SaaS después del M0 de la Tienda. El parqueadero necesita tokens por producto y Workers Paid, y los dos llegan con la Tienda (§15).
- **Precio:** dentro de la banda local, con prepago de 1, 3, 6 y 12 meses (ADR-22). La hipótesis de partida es COP 49.000–69.000 al mes por sede (§10.3).
- **Posponer:** hardware propio, barreras y cámaras fijas, recaudar el dinero del conductor, reservas y marketplace, parqueo en vía y licitaciones (§14.3).

Estas recomendaciones no son cuotas de mercado, pronósticos de ventas ni resultados de entrevistas. El plan de comprobación está en §16.

---

## 2. Metodología, trazabilidad y límites

### 2.1 Qué se investigó

| Mercado | Qué vende o resuelve | Relación con ED1 |
|---|---|---|
| Software de operación para parqueaderos pequeños y medianos | Entrada, salida, tiquete, caja, mensualidades, reportes | Posible vertical SaaS |
| Sistemas de control de acceso y recaudo (PARCS) | Barreras, cajeros, lectores, cámaras y su software | Referencia tecnológica; no es mercado objetivo |
| Pago y descubrimiento para el conductor | Apps de pago por placa, tags, parquímetros, reservas | Integraciones posibles y canal |
| Operación de parqueaderos | Operadores que gerencian, arriendan o tienen concesiones | Referencia de modelo de negocio; no es cliente inicial |
| Parqueo en propiedad horizontal y comercios con parqueadero | Control y cobro de visitantes, cupos de empleados y clientes | Segmentos a validar |

### 2.2 Jerarquía de evidencia

Se usan las mismas etiquetas del estudio de ecommerce (§2.2 de ese documento):

| Etiqueta | Qué permite concluir |
|---|---|
| **Dato publicado** | Lo que una entidad pública, un gremio o una empresa reporta, para su período y su método |
| **Norma** | El texto de una ley, decreto o resolución, o su lectura por la autoridad |
| **Oferta observada** | Condiciones públicas visibles al corte en la página del proveedor; no una cotización |
| **Capacidad documentada** | Que existe una función o interfaz descrita; no que se probó aquí |
| **Fuente secundaria** | Un medio, blog o proveedor que cita un dato; orienta, pero no sostiene una decisión |
| **Inferencia** | Una conclusión razonada que conecta hallazgos; revisable |
| **Hipótesis/propuesta** | Algo que se comprueba con usuarios o datos propios |
| **Dato interno** | Lo que el ecosistema ya construyó, midió o decidió, en este repositorio |
| **No confirmado** | Falta acceso o evidencia; no se convierte en afirmación |

### 2.3 Procedimiento

1. Lectura de ED1 v1.4, ARQUITECTURA y PLATAFORMA para saber cómo entra un producto nuevo.
2. Búsqueda de publicaciones 2024–2026 sobre parque automotor, normas, operadores, software y pagos en Colombia, y referentes de Latinoamérica y del mundo.
3. Apertura de cada página citada y verificación de moneda, fecha y alcance.
4. Matrices de competencia, funciones y precios; diagnóstico; hipótesis de validación.

El registro final tiene 59 fuentes: cinco documentos internos y 54 externas (§18). Las páginas de precios son dinámicas y se citan como observadas el 6 de octubre de 2026.

### 2.4 Límites que afectan la decisión

- **No se sabe cuántos parqueaderos hay en Colombia.** La actividad está en el código CIIU 5221 [S61], pero no se obtuvo el número de empresas inscritas. Bogotá tiene un Registro Distrital de Estacionamientos desde 2019 [S13], y su total no se publicó en lo consultado. Conseguir los dos números es la primera tarea de §16.
- No se hicieron entrevistas, encuestas, compras de prueba ni pruebas de los productos competidores. Lo que un proveedor promete es una oferta observada, no un funcionamiento comprobado.
- No se midió el volumen de búsqueda de ninguna herramienta. Debe medirse antes de construir (§12).
- Las cifras de tamaño del mercado mundial vienen de resúmenes públicos de informes pagos, con métodos que no se pudieron revisar (§4.1).
- No se leyó el texto completo de la Circular Única de la SIC. Su contenido sobre recibos se toma de un concepto de la propia SIC [S24].
- La obligación de IVA y factura electrónica en propiedad horizontal sale de una fuente secundaria que cita a la DIAN [S30]. Se confirma con un contador antes de diseñar sobre ella.
- **No soy abogado ni contador.** Lo regulatorio de §13 se confirma con asesoría antes del primer cobro, como ya pide el estudio de ecommerce para la Tienda.

---

## 3. Lectura del proyecto ED1

### 3.1 Cómo entra un producto nuevo al ecosistema

ED1 v1.4 fija las reglas, y CultivoPro y la Tienda 3.0 muestran cómo se aplican:

| Regla de ED1 | Qué exige | Aplicada al parqueadero |
|---|---|---|
| ICP de la validación (§2.1) | Pequeños negocios, independientes y comercios de Colombia | **El parqueadero pequeño está dentro del ICP.** No necesita la excepción de ICP que pidió el agro |
| Fases (§33) | El vertical SaaS es la fase 7, y ED1 nombra ecommerce o inmobiliario | **Un SaaS de parqueaderos antes de la fase 7 es una excepción declarada**, como la Tienda 3.0. Las herramientas gratuitas no la necesitan: son fase 1–2 |
| Excepción declarada ([D3]) | Escrita, con motivo, alcance acotado y métricas fijadas antes de medir | Se escribe solo si hay un parqueadero cero o una señal de las herramientas (§16) |
| Escalera (§38) | Herramienta gratuita → usuario recurrente → cuenta → premium → herramienta de negocio → SaaS → servicios | §12.1 |
| Seis filtros (§34) | Necesidad real, barato, búsqueda, conexión con otro producto, componentes existentes, usuario del ICP | §12.2, herramienta por herramienta |
| Contrato de producto (§5.1) | Un `product.yaml` por herramienta, validado en CI, con presupuesto y kill switch | Igual que las calculadoras del agro |
| Regla de tres (§3.11) | Una abstracción se extrae con tres casos reales | El parqueadero sería el tercer producto con cuentas (§15) |
| Budget-first (§3.9, §25.1) | Cada producto declara su presupuesto | §9.3 calcula el consumo por parqueadero |
| Dominios (ADR-27) | Los proyectos nuevos van en `laboratorio-digital.app` | Salvo que el dueño decida una marca propia, como `cultivopro.co` |

### 3.2 Dos ventas que deben mantenerse separadas

ED1 vendería una suscripción al parqueadero. El parqueadero cobra a cada conductor. Son relaciones distintas: sus cobros, facturas, impuestos, reclamos y datos no se mezclan. El dinero que pasa por la caja del parqueadero no es ingreso de ED1. Esta separación es la misma que el estudio de ecommerce pide para la Tienda (§3.2 de ese documento).

### 3.3 Lo que el ecosistema ya tiene **(dato interno)**

| Pieza | Estado al 6 oct 2026 | Qué resuelve para el parqueadero | Fuente |
|---|---|---|---|
| CORE con dimensión de producto | En producción el v0; la migración 0006 (productos, tipos, roles, planes, periodos) probada y en staging | Cuentas, sedes como organizaciones, roles, invitaciones por WhatsApp | S02, S03 |
| Planes prepagados con Bold | En producción para CultivoPro; periodos de 1, 3, 6 y 12 meses diseñados | El cobro de la suscripción | S02, S03 |
| Celdas multi-tenant | Worker + D1 por shards + R2 + KV; `org_id` exigido en cada consulta | Aislar cada parqueadero; exportar sus datos | S02 |
| Cuaderno offline-first | PWA con IndexedDB, cola de salida, sincronización y cuarentena | El patrón exacto de una caja que no puede parar sin red | S02 |
| Registros inmutables | Corregir es anular con un registro nuevo | Entrada, salida, cobro y anulación auditables, como pide la SIC | S02 |
| QR firmado | Datos en el fragmento `#` y firma Ed25519, verificables sin red | Un tiquete que el conductor y el parqueadero pueden verificar | S02 |
| Vigía, kill switch, respaldos | En producción en la celda c0 | Operar el producto con presupuesto | S02, S04 |

Lo que falta no es la plataforma. Es el dominio del parqueadero: tarifas, entrada y salida, mensualidades, caja, factura electrónica y el cobro al conductor (§15).

---

## 4. Mercado: mundo, Latinoamérica y Colombia

### 4.1 Referencia mundial

| Indicador | Valor | Etiqueta | Fuente |
|---|---|---|---|
| Gestión de parqueaderos, 2025 | USD 7.220 millones; USD 12.410 millones en 2030 (11,4 % anual) | Fuente secundaria (resumen de informe pago) | S43 |
| Gestión de parqueaderos, 2025 | USD 5.500 millones; USD 10.400 millones en 2034 (7,07 % anual) | Fuente secundaria (resumen de informe pago) | S44 |
| Indigo, ingreso 2025 | EUR 1.015,3 millones; margen EBITDA 47,2 %; 10 países | Dato publicado | S49 |
| Park24 (Times), Japón | Unos 1,37 millones de cupos en 7 países | Dato publicado | S52 |
| Metropolis + SP+ | USD 1.500 millones de valor empresa; más de 4.000 sitios; más de USD 4.000 millones de pagos al año | Dato publicado | S45 |
| Arrive | 8 marcas, más de 20.000 ciudades, 100 millones de usuarios al año | Dato publicado (autodeclarado) | S46 |

**Lectura.** Las dos estimaciones de 2025 difieren en un 31 % y miden cosas cercanas pero no iguales. No se usan para calcular un mercado para ED1. Sirven para una sola conclusión: el software de parqueaderos es un mercado de miles de millones de dólares dominado por grupos que venden a operadores grandes y a ciudades.

### 4.2 Latinoamérica

| País | Dato | Etiqueta | Fuente |
|---|---|---|---|
| Brasil | El sector de operación de parqueaderos mueve unos BRL 15.700 millones al año; Estapar e Indigo tienen cerca del 10 % cada uno | Fuente secundaria (medio) | S51 |
| Brasil | Estapar: 804 operaciones en 105 ciudades; ingreso neto del 3T25 BRL 486 millones (+21,7 %); 22,2 % del ingreso por canales digitales | Dato publicado (vía medio) | S50 |
| Brasil | Estapar: unos 520.000 cupos e ingreso 2025 de BRL 1.870 millones; Zul+ con 8,8 millones de usuarios registrados y 2,7 millones activos al mes | Fuente secundaria | S51 |
| Brasil | Indigo: 350.000 cupos e ingreso 2025 de BRL 1.700 millones | Fuente secundaria | S51 |
| México | Parkimovil reemplazó parquímetros con pago por app desde 2011 y entró a centros comerciales | Fuente secundaria (2015, antigua) | S59 |
| Región andina | TIBA (PARCS) entró a Chile, Perú, Ecuador, Argentina y Colombia con un integrador local | Dato publicado (2018, antiguo) | S53 |

**Inferencia.** El modelo regional maduro es el de Brasil: pocos operadores grandes que se consolidan, con una app propia que vende parqueo y otros servicios del carro. Colombia va en esa dirección con Indigo y Parking (§4.3). El parqueadero pequeño queda fuera de ese modelo.

### 4.3 Colombia

**Demanda: el parque automotor.**

| Indicador | Valor | Fuente |
|---|---|---|
| Vehículos activos al cierre de 2025 | 21.345.925 | S10 |
| Motos | 13.528.164 (63 %) | S10 |
| Demás vehículos | 7.585.011 | S10 |
| Matrículas iniciales 2025 | 1.250.321 a gasolina; 66.994 híbridos; 21.301 eléctricos | S10 |

**Oferta en Bogotá: el mejor dato público.**

| Indicador | Valor | Fuente |
|---|---|---|
| Tope fuera de vía, 2026 | COP 230/min carros; 161/min motos; 10/min bicicletas. Con sello de oro: 253, 177 y gratis | S11 |
| Zonas de Parqueo Pago (en vía) | Más de 10.000 cupos en 13 localidades; meta de más de 13.000 en 2026. Operador: Terminal de Transporte | S14, S15 |
| Uso de las ZPP | Más de 9 millones de usos; más de 2 millones de usuarios de la app; más de la mitad de las transacciones por la app | S14, S16 |
| Tarifa en vía, marzo 2026 | COP 900–2.350 por 10 minutos para carros; 700–1.650 para motos | S15 |
| Parqueaderos de la Terminal | 32 parqueaderos, unos 4.800 cupos; 24 cupos con carga eléctrica en 5 de ellos | S15 |

**Operadores grandes.**

| Operador | Tamaño | Fuente |
|---|---|---|
| City Parking (Indigo desde 2021) | 171 parqueaderos, más de 38.911 cupos, 18 ciudades. Ingresos 2024: COP 86.397 millones, con pérdida de COP 1.824 millones | S20 |
| Central Parking System (comprado por Indigo, ene 2026) | 102 negocios, más de 46.500 cupos. Ingresos operacionales 2024: COP 59.372 millones; ganancia de COP 1.221 millones | S20 |
| Parking | Cerca de 200 sedes en 13 ciudades; 1,5 millones de transacciones al mes (75 % en Bogotá); 450.000 inscritos en Be Parking | S21, S22 |
| Terminal de Transporte de Bogotá (pública) | El mayor operador de parqueo en vía de Bogotá y 32 parqueaderos | S15 |

**Inferencia sobre la estructura.** Indigo y Parking suman unos 400 puntos en Colombia. El resto de los parqueaderos —de barrio, de comercios, de clínicas, de iglesias, de copropiedades— no tiene un conteo público. El software local que declara más de 500 clientes [S39] sugiere que ese resto es de miles, no de decenas, pero el número está por medir (§2.4).

### 4.4 Tamaño comercial de la oportunidad ED1

No hay base para un TAM. En su lugar, la fórmula y tres escenarios ilustrativos. **No son una previsión de ingresos.**

```text
Ingreso mensual recurrente = parqueaderos que pagan × precio mensual por sede
```

| Escenario | Parqueaderos que pagan | Precio mensual supuesto | Ingreso mensual | Comparación |
|---|---|---|---|---|
| Piloto | 20 | COP 59.000 | COP 1,18 millones | Cubre Workers Paid de toda la cuenta |
| Tracción | 200 | COP 59.000 | COP 11,8 millones | Menos de la mitad de los clientes que un competidor declara (S39) |
| Escala | 1.000 | COP 59.000 | COP 59 millones | Supone una participación que hoy nadie demuestra |

Lo que el escenario no dice: cuántos parqueaderos existen, cuántos pagarían y cuánto soporte pide cada uno. Esa es la evidencia de §16.

---

## 5. Clientes, necesidades y sustitutos

### 5.1 Segmentos

| # | Segmento | Rasgos | Encaje con ED1 | Prioridad propuesta |
|---|---|---|---|---|
| A | Parqueadero independiente de barrio | 10–100 cupos, carros y motos, efectivo, uno o dos turnos, el dueño no está todo el día | ICP pleno; dolor de caja y de cumplimiento | **Primera** |
| B | Parqueadero de motos | Alto volumen, ticket bajo, rotación rápida | ICP; las motos son el 63 % del parque (S10) | **Primera**, junto con A |
| C | Comercio con parqueadero propio | Clínicas, restaurantes, colegios, iglesias, hoteles pequeños; validan el parqueo de sus clientes | ICP; el parqueo es secundario a su negocio | Segunda |
| D | Propiedad horizontal: parqueadero de visitantes | Cobro aprobado por asamblea; conflictos y planillas en papel (S33) | Fuera del ICP literal; un administrador atiende varias copropiedades | A validar en entrevistas |
| E | Operador mediano, 2–10 sedes | Varios turnos y sedes, mensualidades, factura electrónica | ICP en el borde; pide reportes por sede | Después del piloto |
| F | Eventos y parqueaderos temporales | Ferias, conciertos, temporada | Uso esporádico | Por demanda |
| G | Operadores grandes y concesiones | PARCS, barreras, LPR fijo, licitaciones | Fuera de alcance | No |
| H | Parqueo en vía de ciudades | Licitaciones, parquímetros, apps de pago | Fuera de alcance | No |

### 5.2 Necesidades y dolores

| Necesidad | Evidencia | Qué tiene que hacer el software |
|---|---|---|
| Que la plata cuadre | Las fugas de caja son el problema principal de muchos parqueaderos; el cobro manual concentra el riesgo en una persona y facilita «arreglos» y tiquetes duplicados (S41, fuente secundaria de un proveedor) | Cada entrada y salida queda registrada y no se borra; cierre por turno; anulaciones con motivo |
| Cumplir la ley de consumo | Ley 1480 art. 18; 17 órdenes de la SIC en 2022 (S23–S25) | Recibo con fecha, hora, placa, estado del vehículo y valor; tarifas y medios de pago visibles |
| Cobrar bien por minuto | Topes por minuto y redondeo a COP 50 en Bogotá (S11–S12) | Tarifas por tipo de vehículo, fracción, tope diario, gracia y nocturna, con el cálculo a la vista |
| Mensualidades | Todos los competidores las ofrecen (S35–S40) | Mensualidades por placa, vencimientos y recordatorios por WhatsApp |
| Facturar | IVA del 19 % al servicio (S30); factura o documento equivalente electrónico (S28–S29) | Emitir por un proveedor autorizado o integrarse con uno |
| No parar sin internet | Hipótesis: barrios y sótanos con mala señal | Registrar y cobrar sin red; sincronizar después |
| Saber cómo va el negocio sin estar ahí | Hipótesis | Ocupación, ingresos y cuadre en el teléfono del dueño |

### 5.3 Sustitutos

| Sustituto | Fortaleza | Debilidad |
|---|---|---|
| Talonario y cuaderno | Costo casi cero; nadie aprende nada | Sin control de caja; no documenta el estado del vehículo |
| Excel o planillas | Conocido | Se edita y se borra; no imprime tiquete |
| POS genérico | Factura | No sabe de placas, minutos ni mensualidades |
| Software local para parqueaderos | Hecho para el problema, COP 60.000–250.000 al mes | En línea; se paga desde el primer mes después de la prueba |
| PARCS con barreras | Control total | Inversión de equipos; para operadores grandes |

---

## 6. Estructura competitiva y actores de referencia

### 6.1 Familias de solución

| Familia | Qué hace | Actores de referencia | Cliente típico |
|---|---|---|---|
| PARCS (control de acceso y recaudo) | Barreras, cajeros, lectores, cámaras y software, a menudo en sitio | SKIDATA (ASSA ABLOY), Amano, TIBA, FlashParking | Operadores grandes, centros comerciales, aeropuertos |
| Integradores locales de PARCS | Diseñan, instalan y mantienen | PGS Colombia (representa a SKIDATA y Hikvision), Parqueaderos Inteligentes | Centros comerciales, clínicas, universidades |
| Visión por computador sin tiquete | Cámaras que reconocen la placa y cobran sin detener al conductor | Metropolis, Peter Park | Operadores con alto volumen |
| Pago para el conductor | Pago por placa, parquímetros virtuales, tags | Arrive (EasyPark, ParkMobile, Flowbird), Flypass, Gopass, app ZPP | Ciudades, operadores, conductores |
| App del operador | Fidelidad, pago y servicios del carro | Parking (Be Parking), Estapar (Zul+) | Conductores frecuentes |
| SaaS ligero para el parqueadero pequeño | Entrada, salida, tiquete, caja, mensualidades | Parqui, GoParqueo, FacturaventaPOS, ParqueApp, Parkingsof, ParkiiGo | Parqueaderos independientes |
| Gestión de copropiedades | Visitantes, cobros y cartera de la propiedad horizontal | Properix, ParkiiGo | Administradores de propiedad horizontal |

### 6.2 Plataformas representativas

| Actor | Origen | Qué ofrece | Dato | Fuente |
|---|---|---|---|---|
| Metropolis | EE. UU. | Pago sin detenerse con visión por computador | Compró SP+ (mayo 2024) | S45 |
| Arrive | Suecia | Pago móvil y datos de parqueo | 2025: EasyPark sumó Flowbird y Parkopedia y adoptó la marca Arrive. *No confundir con el «Arrive» (ex ParkWhiz) que se fusionó con FlashParking en enero de 2024* | S46, S48 |
| FlashParking | EE. UU. | Plataforma en la nube: con y sin barrera, LPR, valet, carga eléctrica | USD 60 millones de L Catterton (ene 2025); compró Parkonect, ParkIt, Ballparc y otras | S48 |
| SKIDATA | Austria | Acceso y recaudo para parqueo, esquí y estadios | Comprada por ASSA ABLOY (jul 2024) | S47 |
| Peter Park | Alemania | LPR y software en la nube, sin tiquete ni barrera | Precio a consultar | S58 |
| Indigo | Francia | Operación, concesiones y servicios digitales | 74 % de su EBITDA de infraestructura viene de concesiones | S49 |
| Flypass | Colombia | Billetera de movilidad: peajes, parqueaderos, parquímetros, combustible | 214 parqueaderos; más de 615.000 usuarios (ene 2026); más de 15.000 celdas de parquímetro y 640.000 usuarios (may 2026) | S17, S18 |
| Gopass | Colombia | Tag y app de movilidad | Pago de ZPP; membresía premium de COP 11.900 al mes; cargo de COP 500 por transacción en ZPP para el plan básico | S16, S19 |

### 6.3 Precios del software local para parqueaderos

Oferta observada el 6 de octubre de 2026. Precios mensuales en COP, sin IVA cuando la página no dice otra cosa.

| Proveedor | Planes | Qué limita el plan | Factura electrónica | Prueba | Fuente |
|---|---|---|---|---|---|
| Parqui | 60.000 · 110.000 · 170.000 · a medida | Vehículos al mes (1.800, 3.100, 5.000) y operadores (1, 2, 3) | Integración con Alegra, cobrada aparte por Alegra | 15 días | S35 |
| GoParqueo | 60.000 · 100.000 · 170.000 · 250.000 (hasta 3 sedes) | Cajeros y registros al mes (1.500, 2.500, 4.000) | Con Alegra | 7 días | S36 |
| FacturaventaPOS | 86.000 · 98.000 (con POS) · 109.000 (con factura) · 160.000 (todo) | Módulos | Incluida en los planes que la nombran | — | S37 |
| ParqueApp | 60.000 (600.000 al año) | Hasta 3 usuarios y 100 cupos | No la menciona | — | S38 |
| Parkingsof | 80.000 · 120.000 · 170.000 | Plan | Sí (DIAN) | 20 días | S39 |
| ParkiiGo | De gratis a 135.000 | Plan | Sí | — | S40 |

**Lo que dicen estos precios.**

- **Hay una banda clara:** COP 60.000–170.000 al mes por sede, con descuento anual del 10–20 %.
- **Se cobra por volumen** (vehículos o registros al mes) o por usuarios, no por cupo.
- **La factura electrónica se terceriza** y suele cobrarse aparte. La impresora térmica se compra aparte (S35).
- **Las funciones son casi las mismas en todos:** placa, tiquete con QR, tarifas por fracción, mensualidades, caja y reportes. Algunos agregan LPR con la cámara del teléfono o una cámara USB/IP (S36, S37) y un asistente de IA (S39).
- **Ninguno ofrece un plan gratuito permanente útil**, salvo el gratuito de ParkiiGo, cuyo alcance no se revisó.

### 6.4 Análisis competitivo — inferencias

1. **Competir por funciones no alcanza.** El paquete básico ya es estándar y barato. Copiarlo no da ventaja.
2. **La diferencia posible está en tres cosas que la oferta observada no muestra:**
   - **Funcionar sin red de verdad.** GoParqueo promete seguir con datos móviles cuando se cae el internet (S36); no se encontró una caja que registre y cobre sin ninguna conexión. El cuaderno de CultivoPro ya lo hace (§3.3).
   - **Evidencia del estado del vehículo**, con foto, hora y firma, que responde a la orden de la SIC (S23). Ningún competidor la destaca.
   - **Una herramienta gratuita que resuelva el cálculo y el recibo sin registrarse.** Es la puerta de ED1 (§12) y ningún competidor la ofrece.
3. **La distribución pesa más que el producto.** Seis proveedores con productos parecidos compiten por los mismos parqueaderos. Gana quien llega: búsqueda, WhatsApp, vendedores de impresoras, contadores y administradores de propiedad horizontal (§12.3).
4. **Los operadores grandes no son clientes.** Compran PARCS a integradores o tienen sistema propio (Parking usa el suyo desde 2011, S21).

---

## 7. Estado del arte funcional

### 7.1 Lo básico de una caja de parqueadero operable

| Capacidad | Por qué | Ya existe en la plataforma |
|---|---|---|
| Entrada por placa, tipo de vehículo y hora | Recibo de la Ley 1480 art. 18 | Registro inmutable con hora del teléfono y de la celda |
| Estado del vehículo con foto y notas | Ley 1480 art. 18; orden de la SIC (S23–S25) | Fotos comprimidas en el navegador (ADR-15) |
| Tiquete impreso o digital con QR | Recibo; búsqueda rápida a la salida | QR firmado de trazabilidad (`packages/trazabilidad`) |
| Salida con cobro por minuto o fracción | Tope por minuto y redondeo (S11–S12) | Por construir: paquete puro de tarifas |
| Tarifas por tipo de vehículo, gracia, tope diario, nocturna | Práctica de todos los competidores | Por construir |
| Mensualidades por placa | Todos los competidores | Catálogos con versión |
| Caja por turno: apertura, cierre y diferencias | Fugas de caja (S41) | Registros inmutables; reportes en el navegador |
| Anulación con motivo | Control de fraude | «Corregir es anular» |
| Roles: dueño, administrador, cajero | Control | CORE con roles por producto |
| Funcionar sin red | Hipótesis de §5.2 | Cuaderno offline-first |
| Tarifas y derechos visibles | Orden de la SIC | Herramienta gratuita (§12.2) |
| Exportar los datos | Portabilidad, confianza | Formato de exportación del agro |

### 7.2 Capacidades avanzadas

| Capacidad | Justificación | Cuándo |
|---|---|---|
| Factura electrónica o tiquete POS electrónico | Obligación tributaria de quien es responsable de IVA (S28–S30) | Con el primer cliente obligado, por un proveedor autorizado |
| Lectura de placa con la cámara del teléfono | Rapidez en la entrada | Hipótesis técnica (§8.3) |
| Varias sedes con reporte consolidado | Segmento E | Después del piloto |
| Convenios con comercios (validar el parqueo) | Segmento C | Por demanda |
| Visitantes de propiedad horizontal | Segmento D | Si la validación lo pide |
| Cupos preferentes para eléctricos | Ley 1964 de 2019: 2 % de los cupos en entidades públicas y comercios de municipios de categoría especial, 1 y 2 (S31) | Como dato del parqueadero, no como función |
| Pago digital del conductor (Bre-B, billeteras, tags) | Crecimiento del pago digital (S17, S34) | Primero QR estático del parqueadero; integraciones después |
| Reservas | Mercados maduros (Arrive, SpotHero) | Posponer |

### 7.3 Lo que no se debe construir al principio

Barreras y cajeros automáticos, guías de cupos con sensores, cámaras fijas con LPR en el servidor, pasarela propia para el conductor y marketplace de reservas. Son el terreno de los PARCS y de los operadores grandes, piden hardware y soporte en sitio, y no son lo que el parqueadero pequeño paga (§6.3).

---

## 8. Estado del arte tecnológico y compatibilidad con ED1

### 8.1 Tecnologías

| Tecnología | Qué resuelve | Madurez | Costo y dependencia | Encaje con ED1 |
|---|---|---|---|---|
| Tiquete con QR | Identificar la estadía a la salida | Alta | Impresora térmica o pantalla | Alto: QR firmado ya existe |
| LPR con cámara fija | Entrada y salida sin digitar | Alta en PARCS | Cámaras, servidor o equipo local | Bajo al inicio |
| LPR con el teléfono | Digitar menos | Ofrecida por competidores locales (S36, S37) | Modelo en el teléfono o en el servidor | Hipótesis (§8.3) |
| Tags RFID (Flypass, Gopass) | Cobro sin detenerse | Alta en Colombia (S17) | Lector en la entrada y acuerdo con el emisor | Posponer |
| Visión por computador sin tiquete | Cobro sin barrera ni tiquete | Alta en EE. UU. y Europa (S45, S58) | Cámaras y nube | Fuera de alcance |
| Pago por app y QR | Cobro sin efectivo | Alta (ZPP, Bre-B) | Comisión del medio de pago | QR estático primero |
| Sensores y guía de cupos | Mostrar cupos libres | Media | Hardware por cupo | Fuera de alcance |
| Estándar de datos APDS (ISO/TS 5206-1:2023) | Hablar el mismo idioma con apps y ciudades | Norma técnica publicada | Ninguno | Adoptar sus nombres desde el modelo de datos (§8.2) |

### 8.2 Tendencias

- **Sin tiquete y sin barrera.** LPR y pago digital reemplazan el papel y la barrera; la precisión de la placa y el cobro a quien se va sin pagar son los problemas abiertos (S55).
- **Consolidación.** Compras de Metropolis, ASSA ABLOY, Indigo y Arrive en 2024–2026 (S20, S45–S47).
- **El parqueadero como centro de servicios del carro.** Zul+ vende seguros y tags (S51); Flypass suma lavado, alineación y combustible (S19); la Terminal de Bogotá ofrece carga eléctrica (S15).
- **Pago inmediato interoperable.** Bre-B, en operación desde el 6 de octubre de 2025, con QR interoperable para comercios (S34).
- **Estándares de datos.** ISO adoptó en 2022 la especificación de la Alianza para Estándares de Datos de Parqueo (APDS), fundada por las asociaciones británica, europea e internacional de parqueo (S54). Usar sus nombres (sitios, tarifas, sesiones) desde el inicio abarata integrarse después.

### 8.3 Compatibilidad con los principios de ED1

| Principio | Aplicado al parqueadero | Riesgo |
|---|---|---|
| Browser-first (§3.3) | Calculadora de tarifas, recibo, reportes, compresión de fotos y QR en el teléfono | La lectura de placa en el navegador no está probada |
| Offline-first (ARQUITECTURA ADR-3) | La caja registra y cobra sin red | Dos cajeros en la misma placa sin red: se resuelve como los conflictos del cuaderno |
| Static-first (§3.10) | Herramientas y páginas públicas estáticas | — |
| Licencias (ARQUITECTURA §5.3) | El CI rompe con una dependencia AGPL | OpenALPR, la librería abierta más conocida, es AGPL-3.0 (S56). fast-alpr es MIT, pero en Python (S57): correría en un servidor, no en el teléfono, sin una conversión por probar |
| Budget-first | Ver §9.3 | El plan gratuito se queda corto rápido |

**Hipótesis técnica a probar antes de prometer LPR:** un modelo ONNX de placas, convertido para el navegador, que lea placas colombianas de carro y de moto en un teléfono barato en menos de un segundo. Si no se cumple, la placa se digita, como hoy hacen la mayoría.

---

## 9. Pagos, cobro e infraestructura

### 9.1 El cobro al conductor

| Medio | Estado en Colombia | Qué haría ED1 |
|---|---|---|
| Efectivo | Predominante en el parqueadero pequeño (inferencia: S41 reporta caídas de cerca del 40 % del efectivo al pasar a pago electrónico) | Registrarlo y cuadrarlo |
| QR del parqueadero (Bre-B, billeteras) | Bre-B: 34 millones de usuarios y 670 millones de transacciones en seis meses (S34) | Mostrar el QR del propio parqueadero y registrar el pago; ED1 no toca el dinero |
| Datáfono | Común en operadores medianos | Registrar el medio |
| Tags (Flypass, Gopass) | 214 parqueaderos con Flypass (S17) | Posponer; requiere acuerdo con el emisor |
| Pago en línea con las llaves del parqueadero | Diseñado para la Tienda 3.0 (llaves por comercio, cifradas) | Reusar cuando la Tienda lo construya |

**Regla:** ED1 no recauda el dinero del conductor. Recaudar por cuenta de otros trae obligaciones financieras y de soporte que no caben en la validación.

### 9.2 El cobro de la suscripción

Igual que CultivoPro: Bold, prepago de 1, 3, 6 o 12 meses, sin débito automático (ADR-22). Con la comisión que el repositorio ya documenta (2,89 % + COP 900, antes del IVA de la comisión; PLATAFORMA §4.8), un mes de COP 59.000 cuesta COP 2.605 en comisión (4,4 %) y un año de COP 590.000 cuesta COP 17.951 (3,0 %). *Dato interno y aritmética.*

### 9.3 Consumo de infraestructura por parqueadero

Supuestos, con el método de ARQUITECTURA §6.2: un parqueadero de 150 vehículos al día; dos registros por vehículo (entrada y salida con cobro); 3 filas escritas por registro, por los índices; margen ×2; unas 2 solicitudes por registro; una foto de 100 KB por entrada, guardada 30 días. *Inferencia; se recalibra con el parqueadero cero.*

| Recurso | Por parqueadero | Plan gratuito (al 60 %) | Workers Paid | Costo marginal con Workers Paid |
|---|---|---|---|---|
| Filas escritas en D1 | ~1.800 al día | 60.000/día → **unos 33 parqueaderos** | 50 M al mes incluidas → unos 550 al 60 % | USD 1 por millón adicional → unos USD 0,05 al mes |
| Solicitudes al Worker | ~1.200 al día | 60.000/día → unos 50 | 10 M al mes incluidas → unos 165 al 60 % | USD 0,30 por millón → unos USD 0,01 al mes |
| Fotos en R2 | ~450 MB vivos (30 días) | 10 GB-mes → unos 22 | Igual | USD 0,015/GB-mes → menos de USD 0,01 al mes |

Fuente de las cuotas: `docs/plataforma/cuenta-cloudflare.md` §1 (S04).

**Lectura.**

- **Un parqueadero escribe unas 9 veces más que una finca** (1.800 contra 200 filas al día, ARQUITECTURA §6.2). En el plan gratuito, una celda aguanta unos 33 parqueaderos.
- **Con Workers Paid, el costo de infraestructura por parqueadero es de centavos de dólar al mes.** El costo que decide la economía es el soporte y la comisión del cobro, no la nube. Es la misma conclusión del estudio de ecommerce para las tiendas.
- **Las fotos se guardan por tiempo limitado** y se exportan al parqueadero. Guardarlas un año multiplica R2 por doce.

---

## 10. Monetización y economía unitaria

### 10.1 Cómo monetiza el mercado

| Modelo | Quién lo usa | Ejemplo | Fuente |
|---|---|---|---|
| Suscripción mensual por sede, según volumen o usuarios | SaaS local | COP 60.000–250.000 al mes | S35–S40 |
| Venta de hardware y mantenimiento | PARCS e integradores | SKIDATA, PGS Colombia | S42, S47 |
| Cargo por transacción al conductor | Apps de pago | Gopass: COP 500 por pago en ZPP en el plan básico | S16 |
| Membresía del conductor | Apps de movilidad | Gopass premium: COP 11.900 al mes | S19 |
| Operación: gerencia, arriendo o concesión | Operadores | Indigo: 74 % del EBITDA de infraestructura en concesiones | S49 |
| Fidelidad y servicios del carro | Operadores con app | Be Parking: más de 70 millones de horas gratis entregadas; Zul+ vende seguros y tags | S21, S51 |
| Datos de parqueo | Plataformas de datos | Parkopedia, ahora parte de Arrive | S46 |
| Carga eléctrica y servicios en sitio | Operadores | Terminal de Bogotá: 24 cupos con carga | S15 |

### 10.2 Modelos propuestos para ED1

| Modelo | Para qué | Riesgo | Decisión |
|---|---|---|---|
| Herramientas gratuitas | Adquisición y retorno (§12) | Tráfico que no paga | Sí, primero |
| Caja gratuita local, sin cuenta | Peldaño «usuario recurrente» | Que nadie suba al plan pago | Sí, con límite claro: un dispositivo y sin respaldo en la nube |
| Suscripción prepagada por sede | Ingreso principal | Precio aplastado por la banda local | Sí |
| Plan para administradores de propiedad horizontal | Canal hacia muchas copropiedades | Fuera del ICP literal | A validar |
| Servicios: puesta en marcha, avisos legales, capacitación | Ingreso temprano y aprendizaje | Horas del dueño | Acotado |
| Cargo por transacción o comisión sobre el parqueo | — | Mezcla las dos ventas de §3.2 | No en la validación |

### 10.3 Hipótesis de empaquetado y precio

Hipótesis para la lista de espera y el piloto, no precios decididos. Se ubican en la parte baja de la banda local (§6.3) porque el ancla es la caja gratuita.

| Plan | Qué incluye | Precio de partida (por sede, al mes, en prepago) |
|---|---|---|
| Gratis | Herramientas; caja en un teléfono, sin cuenta y sin respaldo | COP 0 |
| Parqueadero | Sincronización, 3 cajeros, fotos del estado por 30 días, mensualidades, cierre de turno, reportes | COP 49.000–69.000 |
| Varias sedes | Lo anterior por sede, con reporte consolidado | COP 99.000–149.000 por sede |
| Copropiedad | Visitantes y cobro aprobado por asamblea | COP 39.000–69.000 por copropiedad |
| Factura electrónica | Por un proveedor autorizado | El costo del proveedor, sin margen, mientras se valida |

### 10.4 Fórmulas de control

```text
Contribución por sede = precio − comisión del cobro − infraestructura − minutos de soporte × costo del minuto
Recuperación del costo de adquisición (meses) = costo de adquirir un parqueadero / contribución mensual
```

Con COP 59.000 al mes, la comisión de un mes es de COP 2.605 y la infraestructura es de centavos (§9). La variable que decide es el soporte: si un parqueadero pide una hora de soporte al mes, esa hora vale más que todo lo demás. Se mide desde el piloto (§16.3).

---

## 11. Integraciones y servicios

| Integración | Para qué | Estado | Recomendación |
|---|---|---|---|
| Factura electrónica (proveedor autorizado) | Cumplir con la DIAN | Los competidores usan Alegra (S35, S36). ED1 no tiene adaptador fiscal; el hueco `DocumentoFiscal` está previsto (PLATAFORMA §4.8) | Un proveedor, detrás del adaptador, cuando haya un cliente obligado |
| Impresora térmica portátil | Tiquete | Los competidores la venden aparte (S35) | Probar la impresión desde la PWA en el piloto. Bluetooth desde el navegador no está en todos los teléfonos: *por verificar* |
| WhatsApp (enlaces `wa.me`) | Recibo, recordatorio de mensualidad | Gratis; ya se usa en el agro | Sí |
| QR de pago del parqueadero | Cobro sin efectivo | Bre-B con QR interoperable (S34) | Mostrar el QR propio; sin integración |
| Tags y apps de movilidad | Cobro sin detenerse | Acuerdos comerciales (S16–S18) | Posponer |
| Google Maps (perfil del negocio) | Descubrimiento | Gratis | Guía para el parqueadero, no integración |

**Servicios que ED1 puede probar:** puesta en marcha en sitio, kit de avisos (tarifas, derechos, póliza), capacitación de cajeros y migración desde Excel. Son el ingreso temprano que recomienda el estudio de ecommerce, con el mismo límite: las horas del dueño.

---

## 12. Adquisición y crecimiento

### 12.1 La escalera ED1 aplicada al parqueadero

| Peldaño (ED1 §38) | Producto | Motivo para subir |
|---|---|---|
| Herramienta gratuita | Calculadora de tarifa por minuto; recibo con estado del vehículo; rentabilidad del parqueadero | Resolver el cálculo o el recibo de hoy sin registrarse |
| Usuario recurrente | Caja local en un teléfono: entradas, salidas y cierre del día | Dejar el talonario |
| Cuenta | Respaldo y sincronización; varios cajeros | No perder la caja si se pierde el teléfono; ver la caja desde la casa |
| Premium | Fotos del estado, mensualidades, reportes por turno | Cuadrar la plata y cumplir con la SIC |
| Herramienta de negocio | Varias sedes, factura electrónica, convenios | Crecer |
| SaaS | Plan por sede | — |
| Servicios / B2B | Administradores de propiedad horizontal; puesta en marcha | Atender muchas sedes |

### 12.2 Primeras herramientas gratuitas

Todas corren en el navegador. La columna «filtros» dice cuántos de los seis de ED1 §34 cumple sin medir; el de búsqueda queda pendiente en todas.

| # | Herramienta | Para quién | Por qué | Filtros sin medir |
|---|---|---|---|---|
| 1 | Calculadora de tarifa por minuto, con el tope de Bogotá y redondeo a COP 50 | Parqueadero y conductor | Norma con fórmula (S12); multas de la SIC (S23) | 5 de 6 |
| 2 | Recibo de entrada con estado del vehículo, imprimible o por WhatsApp | Parqueadero | Ley 1480 art. 18 (S25) | 5 de 6 |
| 3 | Rentabilidad y punto de equilibrio de un parqueadero | Dueño o quien va a abrir uno | Decisión de inversión | 5 de 6; reusa margen y punto de equilibrio (familia Negocios) |
| 4 | Aviso de tarifas, medios de pago y derechos, para imprimir | Parqueadero | Orden de la SIC sobre información visible (S23) | 5 de 6 |
| 5 | Liquidador de mensualidades y prorrateos | Parqueadero | Todos los competidores la cobran | 5 de 6 |
| 6 | Calculadora de cupos obligatorios: 2 % para eléctricos | Parqueadero de comercio | Ley 1964 de 2019 (S31) | 4 de 6 |
| 7 | Calculadora de IVA y factura del parqueadero de visitantes | Administrador de copropiedad | DIAN, según fuente secundaria (S30) | 4 de 6; pide revisión de un contador |

**Antes de construir:** medir el volumen de búsqueda de cada una con el método que el ecosistema fijó el 1 de octubre de 2026 (Keyword Planner, tipos de dato y regla de decisión escritos antes de ver los datos; estudio de ecommerce §12.6).

### 12.3 Canales

- **Búsqueda en español**, una página útil por herramienta, con el quality gate de ED1 §12.2.
- **WhatsApp**: el recibo y el aviso se comparten; cada uno lleva el enlace a la herramienta.
- **Vendedores de impresoras térmicas y papelerías**, que ya venden talonarios a los parqueaderos. *Hipótesis.*
- **Contadores y administradores de propiedad horizontal**, que atienden a varios clientes a la vez, como los agrónomos en el agro.
- **Un gremio de parqueaderos.** No se identificó uno en lo consultado: *no confirmado*.

---

## 13. Confianza, privacidad y requisitos regulatorios

### 13.1 Consumo y responsabilidad

| Norma | Qué exige | Qué hace el software | Fuente |
|---|---|---|---|
| Ley 1480 de 2011, art. 18 | Recibo con fecha y hora de recepción, identificación del vehículo, su estado y el valor; se puede documentar el estado con medios tecnológicos. En el parqueo gratuito, se responde solo con dolo o culpa grave | Recibo con foto y hora; tiquete con QR | S25 |
| Circular Única de la SIC, título II, cap. 4 | Datos del prestador, del cliente, número de recibo, clase de servicio, defectos del bien | Plantilla del recibo con esos campos | S24 |
| Ley 527 de 1999, art. 6 | Un documento electrónico vale como escrito si queda accesible para consulta | Recibo digital por WhatsApp o en pantalla, y su consulta posterior | S24 |
| Código de Comercio, art. 1003 (según fuente secundaria) | El parqueo pagado crea un contrato de depósito | — | S27 |
| Órdenes de la SIC (2022) | Documentar el estado, informar medios de pago y tarifas, no eximirse de la custodia | Aviso de tarifas y derechos (§12.2) | S23 |
| Sanciones | Hasta 2.000 SMMLV por infringir normas de consumo; hasta 1.000 por desatender instrucciones | — | S23 |

Los avisos del tipo «no respondemos por robos» no eximen al parqueadero (S26, S27).

### 13.2 Tarifas

| Ciudad | Norma | Qué fija | Fuente |
|---|---|---|---|
| Bogotá | Decreto 461 de 2019 | Tope por minuto = factor de zona × factor de vehículo (1,0 carro; 0,7 moto) × factor de nivel de servicio × costo base; redondeo a COP 50; reporte a la alcaldía local antes de cobrar; factura con datos de la póliza | S12 |
| Bogotá | Decretos 026 y 027 de 2026 | Topes de 2026 (§4.3), ajustados con el IPC y el salario mínimo | S11 |
| Bogotá | Acuerdo 695 de 2017 y Decreto 769 de 2019 | Registro distrital obligatorio de estacionamientos | S13 |
| Otras ciudades | Decretos o resoluciones propios | Se identificaron documentos de tarifas de Bucaramanga y Palmira; no se revisaron | S62, S63 |

**Implicación de diseño:** el tope y la fórmula cambian cada enero y por ciudad. Son un catálogo, no código, como los rangos de DPV del agro.

### 13.3 Impuestos y facturación

- El servicio de parqueadero está gravado con IVA al 19 %, porque no está en la lista de servicios excluidos (Estatuto Tributario, art. 476). *Fuente secundaria* (S30).
- La DIAN tiene 12 tipos de documento equivalente electrónico; ninguno es propio del parqueadero. El parqueadero usa la factura electrónica o el tiquete POS electrónico (Resolución 000165 de 2023) (S28).
- El tiquete POS electrónico es obligatorio por calendario desde 2024 para quien está obligado a facturar, y ya no tiene el tope de 5 UVT del POS en papel (S29).
- En propiedad horizontal, quien presta el servicio de parqueo es responsable del IVA (ET, art. 462-2), y la DIAN habría dicho en 2025 que la copropiedad que cobra visitantes debe inscribirse y facturar. *Fuente secundaria* (S30).

**Lo que no se sabe:** cuántos parqueaderos pequeños no son responsables de IVA y por eso no facturan. Esto define si la factura electrónica es una función del plan básico o de uno superior. Se pregunta en las entrevistas (§16.2) y se confirma con un contador.

### 13.4 Datos personales

- Las grabaciones de video son datos personales (Ley 1581 de 2012). Exigen aviso, finalidad, acceso restringido y prohíben compartirlas por redes; la SIC sanciona hasta 2.000 SMMLV (S32).
- **Inferencia:** la placa, la foto del vehículo y su hora de entrada, ligadas a una persona, también lo son. El producto necesita política de tratamiento, aviso en el sitio, retención corta de las fotos y exportación, como el agro (ARQUITECTURA §9).
- Nada de esto viaja por GitHub Actions ([H6]).

### 13.5 La promesa de privacidad debe ser delimitada

«Tus datos no salen de tu teléfono» vale para la caja gratuita local. Con la sincronización, los datos van a la celda de ED1, cifrados en tránsito y aislados por `org_id`. La promesa se escribe así, sin exagerar.

---

## 14. Oportunidades y prioridades para ED1

### 14.1 Priorización analítica

| Opción | Necesidad | Diferencia posible | Costo para ED1 | Riesgo | Prioridad |
|---|---|---|---|---|---|
| Herramientas gratuitas (§12.2) | Alta (norma y caja) | Alta: nadie las ofrece | Bajo: estáticas | Poco tráfico | **1** |
| Caja offline-first con evidencia del estado | Alta | Media-alta | Medio: reusa la plataforma | Competencia barata | **2**, con parqueadero cero |
| Plan para propiedad horizontal | Media | Media | Medio | Fuera del ICP literal; regulación tributaria | 3, si la validación lo pide |
| Integración de tags y apps de pago | Media | Baja | Alto: acuerdos | Dependencia | Posponer |
| PARCS, LPR fijo, barreras | Para grandes | Baja | Alto: hardware | Fuera de la escalera | No |
| Marketplace de reservas | Baja en el segmento | Baja | Alto | Sin oferta | No |

### 14.2 Paquete inicial propuesto

1. Calculadora de tarifa por minuto (Bogotá primero, con su fórmula).
2. Recibo de entrada con estado del vehículo.
3. Rentabilidad y punto de equilibrio.
4. Aviso de tarifas y derechos.

Las cuatro van en la familia Negocios de ED1 (§10.3–§10.4), en `laboratorio-digital.app` o en el dominio que el dueño elija, con un `product.yaml` cada una.

### 14.3 Qué no hacer

- Fabricar o revender hardware de acceso.
- Recaudar el dinero del conductor.
- Competir en licitaciones de parqueo en vía o con los operadores grandes.
- Prometer LPR antes de probarlo en un teléfono barato.
- Guardar fotos sin límite de tiempo.
- Construir el SaaS antes de medir las herramientas o de tener un parqueadero cero.

---

## 15. Encaje con la plataforma

Dato interno, del mapa de arquitectura del 6 de octubre de 2026 (S02, S03):

| Pieza | Para el parqueadero | Trabajo |
|---|---|---|
| CORE: entrar, organizaciones, invitaciones, equipo | Cada parqueadero o sede es una organización. Roles: propietario (administra), administrador y cajero | Una entrada en `infrastructure/productos.json`, su `planes.json` y su política |
| Planes y cobro con Bold | La suscripción | Requiere los tokens v2 y la sesión por producto (PLATAFORMA §4.6), que llegan con la Tienda |
| Celda propia (`parqueadero_c<N>_s1`) | Datos de cada parqueadero aislados | Configuración en `celdas.json` |
| Patrón del cuaderno offline-first | La caja | Copiar el patrón a una app nueva |
| `packages/sync` | Sincronización | Generalizar: hoy tiene las entidades y roles del agro |
| `packages/trazabilidad` | Tiquete con QR firmado | Generalizar el formato |
| Tarifas | Cálculo por minuto, fracción, topes y redondeo | Paquete puro nuevo, con tabla de casos y pruebas de reloj (P8) |
| Workers Paid | El plan gratuito aguanta unos 33 parqueaderos (§9.3) | Se activa con el M0 de la Tienda (ADR-23) |

Con el agro y la Tienda, el parqueadero sería el **tercer producto** con cuentas. Eso justifica extraer a paquetes comunes la sincronización, el QR firmado y el patrón de app offline (ED1 §3.11).

---

## 16. Plan de validación comercial y técnica

### 16.1 Primeros 90 días — propuesta

| Período | Trabajo | Evidencia exigida | Decisión | Fase ED1 |
|---|---|---|---|---|
| Días 1–15 | Conteo de parqueaderos (RUES por CIIU 5221; Registro Distrital de Bogotá). Medición de la búsqueda de las herramientas de §12.2. 15–20 entrevistas en los segmentos A, B y D | Cifras con su fuente; tareas, frecuencia y alternativa actual | Qué herramientas se construyen; si hay un parqueadero cero | 0 · Decisiones |
| Días 16–45 | Publicar 2–4 herramientas | Completado, público, retorno | Elegir la herramienta de entrada | 1–2 · Utility MVP y Growth |
| Días 46–75 | Si hay parqueadero cero: caja offline-first en un teléfono durante 30 días | Cuadres sin diferencias, tiempo por salida, registros en cuarentena, soporte | Excepción declarada sí o no | 3–4, como excepción declarada |
| Días 76–90 | Oferta de pago a los usuarios de la caja | Pago real, retención, soporte por sede | SaaS acotado, solo herramientas, o pivote | Insumo para la decisión de inversión |

### 16.2 Preguntas de entrevista

1. Muéstreme cómo recibió y despachó los últimos diez vehículos, con las placas ocultas.
2. ¿Cómo cuadra la caja al final del turno? ¿Cuándo no cuadró la última vez y por qué?
3. ¿Qué anota del estado del vehículo al recibirlo? ¿Alguna vez un cliente reclamó un daño?
4. ¿Cuánto cobra por minuto, fracción, día y mes? ¿Cómo lo calcula?
5. ¿Qué parte de los pagos es en efectivo, con QR o con tarjeta?
6. ¿Factura? ¿Es responsable de IVA? ¿Cuánto le cuesta hoy?
7. ¿Cuántas mensualidades tiene y cómo cobra las vencidas?
8. ¿Qué pasa cuando se cae el internet o se acaba la batería?
9. ¿Usa o usó algún programa? ¿Cuánto pagaba y por qué lo dejó?
10. ¿Aceptaría un piloto de 30 días, y pagar después por un resultado concreto?

Se registra lo que la persona hace, no lo que dice que haría.

### 16.3 Métricas y umbrales

Las de ED1 §19.1 rigen para las herramientas (≥ 60 % de completado, retorno ≥ 15 % a 30 días). Una excepción declarada se mide con sus propias métricas, fijadas antes de medir (ED1 §19.1, v1.3). Propuesta; **los números los fija el dueño antes del día 1**:

| Métrica | Definición | Umbral propuesto |
|---|---|---|
| Público adecuado | Usuarios de las herramientas que se identifican como parqueadero | Fijar antes de publicar |
| Cuadre | Turnos cerrados sin diferencia / turnos cerrados | ≥ 95 % en el piloto |
| Tiempo de salida | Segundos entre buscar la placa y entregar el recibo | Menor que el proceso actual |
| Sin red | Registros hechos sin conexión que llegan a la celda una sola vez | 100 % |
| Pago real | Parqueaderos que pagan / parqueaderos que reciben la oferta | Fijar antes de ofrecer |
| Soporte | Minutos por sede al mes | Debe caber en la contribución (§10.4) |
| Retención | Sedes activas a los 60 días | Fijar antes del piloto |

---

## 17. Vigilancia tecnológica y comercial

### 17.1 Radar

| Señal | Por qué importa | Qué vigilar | Frecuencia |
|---|---|---|---|
| Topes de tarifas por ciudad | Cambian el catálogo de tarifas | Decretos de enero en Bogotá, Medellín, Cali y Barranquilla | Anual |
| Órdenes y sanciones de la SIC a parqueaderos | Lo que la caja debe probar | Comunicados de la SIC | Trimestral |
| Factura electrónica y tiquete POS | Si se vuelve función básica | Resoluciones de la DIAN | Trimestral |
| Bre-B y QR interoperable | Cobro sin efectivo sin integración | Banco de la República | Trimestral |
| Flypass, Gopass y la app ZPP | Canal o competencia si bajan al parqueadero pequeño | Anuncios y aliados | Trimestral |
| Consolidación de operadores | Indigo, Parking y la Terminal | Compras y aperturas | Semestral |
| Competidores locales de SaaS | Precio y funciones | Sus páginas de planes | Trimestral |
| LPR en el teléfono | Si la lectura de placa se vuelve barata y abierta | Modelos ONNX con licencia permisiva | Semestral |
| Carga eléctrica | Matrículas de eléctricos e híbridos (S10); cupos de la Ley 1964 | RUNT | Anual |
| Metropolis, Arrive y FlashParking en Latinoamérica | Entrada de un grande | Anuncios | Semestral |

### 17.2 Evidencia todavía pendiente

- Número de parqueaderos en Colombia y en Bogotá (§2.4).
- Volumen de búsqueda de las herramientas (§12.2).
- Quién factura y quién no (§13.3).
- Si la impresión por Bluetooth y la lectura de placa funcionan desde la PWA en teléfonos baratos (§8.3, §11).
- Disposición a pagar, con pago real (§16).
- Si existe un gremio de parqueaderos (§12.3).

### 17.3 Decisión de inversión recomendada

1. **Ahora:** las herramientas gratuitas, sin excepción declarada, porque están en el ICP y en la fase 1–2.
2. **Con un parqueadero cero y después del M0 de la Tienda:** la caja offline-first como excepción declarada, escrita como ADR, con las métricas de §16.3.
3. **Sin parqueadero cero:** esperar la señal de las herramientas antes de construir plataforma.

---

## 18. Registro de fuentes y evidencia

Consultadas el 6 de octubre de 2026, salvo indicación. La fecha entre paréntesis es la de publicación cuando la página la muestra.

### 18.1 Documentos del proyecto (dato interno)

| # | Documento |
|---|---|
| S01 | `docs/ecosistema/ECOSISTEMA-DIGITAL-ED1-v1.4.md` |
| S02 | `docs/ARQUITECTURA.md` |
| S03 | `docs/plataforma/PLATAFORMA.md` |
| S04 | `docs/plataforma/cuenta-cloudflare.md` |
| S05 | `docs/tienda/ESTUDIO-MERCADO-ECOMMERCE-ED1-2026-10-v1.3.md` (método) |

### 18.2 Colombia: parque automotor, Bogotá y operadores

| # | Fuente | Etiqueta |
|---|---|---|
| S10 | RUNT, [Boletín de prensa 001 de 2026](https://www.runt.gov.co/sites/default/files/Bolet%C3%ADn%20001%20de%202026.pdf) (27 feb 2026) | Dato publicado |
| S11 | Alcaldía de Bogotá, [Tarifas de parqueaderos y parqueo en vía 2026](https://bogota.gov.co/mi-ciudad/movilidad/tarifas-de-parqueaderos-y-parqueo-en-que-regiran-en-bogota-en-2026) (2 feb 2026) | Norma (vía comunicado) |
| S12 | [Decreto 461 de 2019 de Bogotá](https://www.redjurista.com/Compilaciones2018/tablas_GacetasBogota/2019/08/6610/d_alcabog_0461_2019.pdf) | Norma |
| S13 | Alcaldía de Bogotá, [Plazo para registrar parqueaderos públicos](https://bogota.gov.co/mi-ciudad/movilidad/hasta-el-18-de-marzo-hay-plazo-para-registrar-parqueaderos-publicos) (6 mar 2020) | Norma (vía comunicado) |
| S14 | Alcaldía de Bogotá, [Zonas de Parqueo Pago: más de 13.000 cupos](https://bogota.gov.co/mi-ciudad/movilidad/zonas-de-parqueo-pago-en-bogota-cupos-habilitados-para-2026) (16 mar 2026) | Dato publicado |
| S15 | Terminal de Transporte de Bogotá, [32 parqueaderos y más de 13.000 cupos en vía](https://www.terminaldetransporte.gov.co/con-32-parqueaderos-y-la-ampliacion-a-mas-de-13-000-cupos-de-estacionamiento-en-via-la-terminal-de-transporte-de-bogota-se-consolida-en-el-2026-como-el-principal-operador/) (14 mar 2026) | Dato publicado |
| S16 | Valora Analitik, [Gopass y Terminal de Transporte facilitan el pago en ZPP](https://www.valoraanalitik.com/gopaas-terminal-bogota-pagos-zonas/) (20 may 2025) | Fuente secundaria |
| S17 | Enter.co, [Qué es Flypass y dónde se puede usar](https://www.enter.co/colombia/que-es-flypass-como-funciona-y-donde-se-puede-usar-en-colombia/) (30 ene 2026) | Fuente secundaria |
| S18 | Valora Analitik, [Flypass supera las 15.000 celdas](https://www.valoraanalitik.com/flypass-amplia-su-cobertura-de-parquimetros-en-antioquia/) (22 may 2026) | Fuente secundaria |
| S19 | La República, [Los tags de peaje ofrecen descuentos y pagos](https://www.larepublica.co/empresas/los-tags-de-peaje-ahora-ofrecen-descuentos-pagos-y-mas-servicios-desde-sus-apps-4417611) | Fuente secundaria |
| S20 | Valora Analitik, [City Parking compra a Central Parking System](https://www.valoraanalitik.com/city-parking-compra-a-central-parking-system/) (14 ene 2026) | Fuente secundaria (cifras de estados financieros) |
| S21 | La Nota Económica, [Parking: 1,5 millones de transacciones mensuales](https://lanotaeconomica.com.co/movidas-empresarial/con-1-5-millones-de-transacciones-mensuales-parking-consolida-su-operacion-en-colombia-a-traves-de-la-innovacion) (8 nov 2024) | Fuente secundaria |
| S22 | Portafolio, [Parking lanzará su nueva app en 2025](https://www.portafolio.co/negocios/empresas/parking-lanzara-su-nueva-app-de-parqueo-en-2025-como-sera-616986) (6 nov 2024) | Fuente secundaria |

### 18.3 Normas y autoridades

| # | Fuente | Etiqueta |
|---|---|---|
| S23 | Publimetro, [17 parqueaderos de Bogotá con órdenes de la SIC](https://www.publimetro.co/noticias/2022/07/24/17-parqueaderos-en-bogota-algunos-de-los-mas-reconocidos-fueron-sancionados-por-la-sic/) (24 jul 2022) | Fuente secundaria (comunicado de la SIC) |
| S24 | SIC, [Concepto sobre el recibo de parqueadero, radicado 18-0965](https://sedeelectronica.sic.gov.co/sites/default/files/normatividad/042018/Rad180965Reciboparqueadero.PDF) | Norma (concepto) |
| S25 | Secretaría del Senado, [Ley 1480 de 2011](http://www.secretariasenado.gov.co/senado/basedoc/ley_1480_2011.html), art. 18 | Norma |
| S26 | Asuntos Legales, [Deberes de los parqueaderos](https://www.asuntoslegales.com.co/consumidor/cuales-son-los-deberes-de-los-parqueaderos-y-cuando-son-responsables-de-los-danos-3432583) (25 ago 2022) | Fuente secundaria |
| S27 | El Carro Colombiano, [Responsabilidad de los parqueaderos](https://www.elcarrocolombiano.com/notas-de-interes/responsabilidad-parqueaderos-colombia-robos-danos-ley/) | Fuente secundaria |
| S28 | DIAN, [Documento equivalente electrónico](https://micrositios.dian.gov.co/sistema-de-facturacion-electronica/documento-equivalente-electronico) | Norma (vía micrositio) |
| S29 | Fenalco, [ABC del tiquete POS electrónico](https://www.fenalco.com.co/blog/juridico-2/notijuridico-050-dian-publico-el-abece-del-documento-equivalente-electronico-tiquete-de-maquina-registradora-con-sistema-p-o-s-2775) | Fuente secundaria (gremio) |
| S30 | Gerencie, [Los servicios de parqueadero están gravados con IVA](https://www.gerencie.com/servicios-de-parqueaderos-y-de-grua-estan-gravados-con-iva.html) | Fuente secundaria |
| S31 | [Ley 1964 de 2019, art. 7](https://leyonline.co/laws/ley-1964-de-2019/articulo-7o-parqueaderos-preferenciales) | Norma (vía compilación) |
| S32 | Asuntos Legales, [Cámaras de vigilancia y restricciones legales](https://www.asuntoslegales.com.co/consumidor/evite-multa-camaras-de-vigilancia-tienen-restricciones-legales-4331547) (20 feb 2026) | Fuente secundaria |
| S33 | La Nota Económica, [Parqueaderos de visitantes en las copropiedades](https://lanotaeconomica.com.co/movidas-empresarial/parqueaderos-de-visitantes-en-colombia-el-reto-operativo-de-las-copropiedades-y-el-papel-de-la-tecnologia-en-su-gestion/) (26 abr 2026) | Fuente secundaria |
| S34 | Portafolio, [Bre-B supera 34 millones de usuarios](https://www.portafolio.co/tecnologia/tras-seis-meses-de-operacion-bre-b-acumula-mas-de-34-millones-de-usuarios-registrados-491906) (13 abr 2026) | Fuente secundaria |

### 18.4 Software y proveedores en Colombia

| # | Fuente | Etiqueta |
|---|---|---|
| S35 | [Parqui, planes](https://www.parqui.co/planes-software-para-control-de-parqueaderos/) | Oferta observada |
| S36 | [GoParqueo](https://goparqueo.com/) | Oferta observada |
| S37 | [FacturaventaPOS, parqueaderos](https://www.facturaventapos.com/parqueaderos.html) | Oferta observada |
| S38 | [ParqueApp](https://parqueapp.com/) | Oferta observada |
| S39 | [Parkingsof](https://parkingsof.com/) | Oferta observada (los clientes son autodeclarados) |
| S40 | [ParkiiGo](https://parkiigo.com/blog/se-pueden-cobrar-los-parqueaderos-de-visitantes-en-colombia/) | Oferta observada |
| S41 | Parqueaderos Inteligentes, [Administración de parqueaderos en Colombia](https://www.parqueaderosinteligentes.com/blog/administracion-parqueaderos-colombia-control-dinero-acceso) | Fuente secundaria (proveedor) |
| S42 | [PGS Colombia](https://pgscolombia.com/) | Oferta observada |

### 18.5 Mercado mundial y regional

| # | Fuente | Etiqueta |
|---|---|---|
| S43 | MarketsandMarkets, [Parking Management Market](https://www.marketsandmarkets.com/Market-Reports/parking-management-market-55041860.html) | Fuente secundaria |
| S44 | IMARC, [Global Parking Management Market](https://imarcgroup.com/global-parking-management-market) | Fuente secundaria |
| S45 | Metropolis, [Cierre de la compra de SP+](https://www.metropolis.io/news/metropolis-closes-acquisition-of-sp-plus) (16 may 2024) | Dato publicado |
| S46 | Arrive, [Acerca de](https://arrive.com/en/about/about-us) | Dato publicado (autodeclarado) |
| S47 | SKIDATA, [Adquisición por ASSA ABLOY](https://skidata.com/pr-news/skidata-to-be-acquired-by-assa-abloy-group) (22 jul 2024) | Dato publicado |
| S48 | Parking.net, [FlashParking](https://www.parking.net/parking-industry/flashparking) | Fuente secundaria |
| S49 | Indigo Group, [Resultados FY2025](https://www.group-indigo.com/wp-content/uploads/2026/03/Investors-Presentation-Indigo-Group-Financial-Results-FY-2025-vf-3.pdf) (mar 2026) | Dato publicado |
| S50 | Economic News Brasil, [Prévia da Allpark/Estapar no 3T25](https://economicnewsbrasil.com.br/2025/10/17/previa-da-allpark-estapar-no-3t25/) (17 oct 2025) | Fuente secundaria (reporte de la empresa) |
| S51 | InvestNews, [Estapar, Indigo y el sector de estacionamientos](https://investnews.com.br/negocios/estapar-indigo-setor-estacionamentos/amp/) | Fuente secundaria |
| S52 | [Park24](https://park24.co.jp/en) | Dato publicado |
| S53 | Parking.net, [ADEXUS se asocia con TIBA en Suramérica](https://www.parking.net/parking-news/tiba-parking-systems/adexus-partners-south-america) (22 ene 2018) | Fuente secundaria |
| S54 | Parking.net, [ISO adopta la especificación de datos de APDS](https://www.parking.net/parking-news/british-parking-association/iso-formally-adopts-global-parking-data-specification-based-on-alliance-for-parking-data-standards) | Fuente secundaria |
| S55 | CCV, [Entrevista sobre tendencias del parqueo](https://www.ccv.eu/en/?p=337054) | Fuente secundaria (proveedor) |
| S56 | [OpenALPR en GitHub](https://github.com/openalpr/openalpr) | Capacidad documentada |
| S57 | [fast-alpr en GitHub](https://github.com/ankandrew/fast-alpr) | Capacidad documentada |
| S58 | Capterra, [Peter Park](https://www.capterra.com/p/217460/Peter-Park/) | Fuente secundaria |
| S59 | El Financiero, [Parquímetro virtual mexicano](https://www.elfinanciero.com.mx/tech/parquimetro-virtual-mexicano-gusta-a-inversionistas/) (2015) | Fuente secundaria (antigua) |
| S60 | Alcaldía de Medellín, [Zonas de Estacionamiento Regulado](https://www.medellin.gov.co/movilidad/transito-transporte/zer-zona-de-estacionamiento-regulado-parquimetros) | Dato publicado |
| S61 | [Código CIIU 5221](https://www.ciiu.co/5221) | Fuente secundaria |
| S62 | Alcaldía de Bucaramanga, [Decreto 0219, tarifas de parqueaderos públicos](https://www.bucaramanga.gov.co/shared-files/162916/DECRETO-0219-TARIFAS-PARQUEADEROS-PUBLICOS-CATEGORIAS-B-C-Y-D.pdf) | Norma identificada, no revisada |
| S63 | Alcaldía de Palmira, [Resolución de tarifas de parqueaderos](https://palmira.gov.co/wp-content/uploads/2026/03/Resolucion-Tarifa-Parqueaderos-20260316.ULTF_.pdf) (mar 2026) | Norma identificada, no revisada |

---

## 19. Control editorial de afirmaciones

| Lo que este estudio **no** afirma | Por qué |
|---|---|
| Cuántos parqueaderos hay en Colombia | No se encontró el dato (§2.4) |
| El tamaño del mercado colombiano de software de parqueaderos | No hay base; las cifras mundiales no coinciden entre sí (§4.1) |
| Que los competidores funcionan como dicen | Son ofertas observadas, no probadas |
| Que el parqueadero pequeño pagaría a ED1 | Se valida con pago real (§16) |
| Que la lectura de placas en el navegador es viable | Es una hipótesis técnica (§8.3) |
| Que todo parqueadero debe facturar electrónicamente | Depende de si es responsable de IVA; se confirma con un contador (§13.3) |
| La lectura jurídica definitiva de la Circular Única o del art. 1003 del Código de Comercio | Se citan por un concepto de la SIC y por una fuente secundaria |
| Los precios de §10.3 | Son hipótesis para la lista de espera |
| Los escenarios de §4.4 y §9.3 | Son aritmética de supuestos declarados, no previsiones |
