# Bitácora de fallos — Tienda 3.0 (bitácora tienda3)

Todo lo que se rompió en la Tienda 3.0, quién lo rompió, por qué pasó y cómo se arregló. Sirve para tres cosas:

- que un fallo no vuelva por el mismo camino;
- que quien llegue después vea que las decisiones raras de la Tienda tienen una cicatriz detrás;
- que, al unir las bitácoras del ecosistema en el segundo cerebro de ED1, esta sea la parte de lo que pasa cuando el dinero y los datos son **de terceros**: los comercios y sus compradores.

Esta bitácora nace con tres de ventaja:

- la de la Tienda 2.0 (`BITACORA-ecommerce.md`, 113 entradas, P1–P21), que es la de este mismo producto en otra arquitectura;
- la del agro (`../BITACORA.md`), que construyó el CORE v0 y pagó lo que enseña la nube;
- la del CORE (`../plataforma/BITACORA_CORE.md`), lo que comparten los productos.

El éxito de esta bitácora se mide por los patrones heredados que **no** reaparecen. El plan y sus historias están en `BACKLOG_TIENDA3.md` («HU-T…»).

**Severidad** = qué tan caro sale, no qué tan difícil fue arreglarlo.

| | |
|---|---|
| 🔴 **Crítico** | Se pierde o se duplica una venta; se marca pagado lo que no se pagó, o se cobra mal; se vende lo que no hay; una tienda ve o toca datos de otra; se filtra una llave de Bold o un dato de un comprador; una tienda queda **viva y muda** (se ve, pero no recibe pedidos). Casi siempre silencioso |
| 🟠 **Grave** | Bloquea publicar, cobrar, entrar al panel o desplegar, pero se ve |
| 🟡 **Medio** | Cuesta tiempo, confunde, o deja una prueba o un documento mintiendo |
| ⚪ **Menor** | Cosmético, redacción, números desactualizados |

---

## Cómo se une con las otras bitácoras (segundo cerebro de ED1)

Las convenciones son las de las bitácoras agro y core, para que unirlas sea concatenarlas y no migrarlas:

1. **Los patrones son del ecosistema, no del proyecto.**
   - P1–P21 conservan **el mismo número y la misma regla** en todas las bitácoras. Aquí no se renumeran ni se reescriben; se añaden entradas que los confirman.
   - Un patrón nuevo que nace aquí recibe un id **provisional** `PT<n>` («patrón tienda»), como `PA<n>` en el agro y `PC<n>` en el CORE. Pasa a un número global `P<n>` cuando exista el archivo común `CONOCIMIENTO.md`. Así, dos proyectos no abren el mismo P22 en paralelo.
2. **Las entradas se citan con su proyecto:** «bitácora tienda3 1», «bitácora ecommerce 61», «bitácora core 2», «bitácora agro 29». El número nunca cambia. «tienda3» distingue esta bitácora de la de la 2.0, que es «ecommerce».
3. **La ficha es la misma línea en todas**, para extraerla con una expresión regular. El proyecto va al principio y la versión es la de la Tienda (`tienda-X.Y.Z`); mientras la Tienda no tenga versión propia (HU-T0.2), es `tienda-0.0.0`:

```
*Ficha:* tienda3 · *(mío)* · 🟠 Grave · P1, P20 · tienda-0.3.0 · 2027-05-20
```

4. **Un cambio de rumbo o una lección que ya está en otra bitácora no se copia** (P2): se cita. Las decisiones del diseño de la Tienda hasta el 5 oct 2026 están en la bitácora agro, «Cambios de rumbo» (ADR-21, ADR-23, ADR-27 y la versión 0.2 de TIENDA).

Cuando exista `CONOCIMIENTO.md`, llevará la tabla global de patrones, las entradas por patrón de todos los proyectos y la guardia que lo impide en cada uno.

---

## Lo aprendido

Lista viva de patrones.

- **En la Tienda 3.0** dice cómo toma forma el patrón aquí.
- **Lo impedirá** es la guardia prevista, con la historia de `BACKLOG_TIENDA3.md` que la construye.
- **Lo impide hoy** se escribe solo cuando esa guardia existe, falla en rojo con el defecto puesto y se comprobó al escribirlo.
- **Entradas** son los números de esta bitácora que lo confirman.

Al 6 oct 2026, en la tarde, la Tienda tiene sus cuatro paquetes puros (sprint T0) y dos patrones con «Lo impide hoy»: P1 y P17. Las 82 comprobaciones del modelo de datos siguen con `node:sqlite` (`sql/probar-tienda.mjs`) y pasan a D1 en HU-T2.1 (hecho el 13 oct 2026: `tests/repo/shard-tienda.test.ts`, también en workerd).

### Heredados del ecosistema

#### P1 · El fallo que funciona es el caro
- **Regla:** lo que cae a un respaldo, a un valor de fábrica o a un «no pasa nada» tiene que gritar.
- **En la Tienda 3.0:** un precio ilegible nunca vale 0; un campo obligatorio vacío nunca se llena con un valor de fábrica (en la 2.0, el celular de fábrica mandaba los pedidos de otra tienda a la primera); un hostname sin tienda responde «Esta dirección no tiene tienda», nunca otra tienda; un pago aprobado sin existencias sube arriba del panel; un horno que falla deja la versión anterior y dice por qué.
- **Lo impedirá:** HU-T1.1, HU-T1.4, HU-T4.3, HU-T5.1, HU-T10.3, HU-T11.7.
- **Entradas:** tienda3 7.
- **Lo impide hoy:** `@ed1/dinero` lanza ante un monto ilegible en vez de devolver 0, y `@ed1/tienda-schema` no trae ningún valor por defecto en contacto ni en la ficha legal; las dos pruebas se vieron en rojo con el defecto puesto (6 oct 2026).

#### P2 · Dos copias del mismo procedimiento: una siempre se queda atrás
- **Regla:** una sola fuente, y lo demás se deriva de ella. Si no se puede, una aserción ata las dos copias.
- **En la Tienda 3.0:** `@ed1/dinero` para el navegador, la API y el horno; `@ed1/tienda-schema` para el panel y la API; `permisos.ts` decide en la API y esconde en el panel; `planes.json` ↔ `funciones.json`; `tienda-import/1` = `tienda-export/1`; las plantillas legales en un solo sitio; el KV se deriva de D1; los días hábiles en `@ed1/calendario`, compartido con el CORE; el SQL de los anexos de TIENDA ↔ el archivo de migración.
- **Lo impedirá:** HU-T1.1, HU-T1.2, HU-T1.4, HU-T2.1, HU-T2.2, HU-T7.1, HU-T10.7, HU-T17.1.
- **Entradas:** tienda3 1, 4.

#### P3 · Windows
- **Regla:** lo que corre en la máquina del operador corre en Windows, y una prueba en Linux no lo ve.
- **En la Tienda 3.0:** `generar-kek.ts`, `cargar.ts` y `desde-2.0.ts` corren en la máquina del dueño, con fotos y hojas XLSX. Al revés: las capturas visuales se toman solo en Linux.
- **Lo impedirá:** el trabajo `scripts-windows` que ya existe; HU-T2.5, HU-T12.3, HU-T12.4.
- **Entradas:** —

#### P4 · Una prueba que solo sabe ver la primera tienda no prueba el producto
- **Regla:** ninguna prueba nombra a un cliente real; se prueba con uno de prueba y, además, con OTRO.
- **En la Tienda 3.0:** aquí el patrón vuelve a su casa. Toda prueba corre con Comercio Ensayo Uno (ropa, variantes, inventario, pago en línea, dominio propio) **y** Comercio Ensayo Dos (panadería, sin inventario, solo WhatsApp). Los nombres de las tiendas reales están en la lista de términos prohibidos. La 404 y la página de tienda cerrada son de cada tienda (bitácora ecommerce 55).
- **Lo impedirá:** HU-T2.6; la Definición de Terminado, punto 4.
- **Entradas:** —

#### P5 · Una comprobación que da lo mismo con el defecto y sin él no comprueba nada
- **Regla:** antes de dar una comprobación, preguntar qué respondería sin el cambio. Toda aserción nueva se ve en rojo con su defecto puesto.
- **En la Tienda 3.0:** sin `CHECK (reservado <= stock)`, la última unidad se vende dos veces; sin el trigger de aceptación, un pedido web sin prueba sale de `pendiente`; sin el escapado, el corpus de XSS se ejecuta. Cada PR dice su control negativo.
- **Lo impedirá:** la plantilla de PR; la Definición de Terminado, punto 3.
- **Entradas:** tienda3 5.

#### P6 · Lo que se escribe para los que vienen después deja fuera al primero
- **Regla:** el cliente cero también es un cliente.
- **En la Tienda 3.0:** las dos tiendas 2.0 entran por el mismo formato de carga y el mismo panel que una tienda nueva; el corte de la segunda usa el runbook corregido por la primera; la Tienda entra al CORE por el mismo `productos.json` que el agro.
- **Lo impedirá:** HU-T2.2, HU-T12.2, HU-T12.8, HU-T13.4.
- **Entradas:** —

#### P7 · Una caché convierte un chequeo en un recuerdo
- **Regla:** un instrumento lee la fuente, no la caché; una caché guarda respuestas, no fracasos.
- **En la Tienda 3.0:** el KV de hostnames es una caché de D1 que un cron reconstruye cada día, y si difieren gana D1; el despacho guarda 30 s en memoria lo que leyó, pero nunca un error al leer; los kill switches tienen 60 s de caché, dichos en el runbook; la versión publicada va en la clave de la caché del borde, así que publicar no necesita purgar.
- **Lo impedirá:** HU-T2.7, HU-T5.1, HU-T17.1.
- **Entradas:** —

#### P8 · El reloj es una entrada que nadie declara
- **Regla:** fecha, hora y huso se mueven en la prueba que dice cubrir el reloj.
- **En la Tienda 3.0:** días hábiles con festivos y Semana Santa; apartados de 15 minutos, links de 60 minutos a 24 h, conciliación a 24 h; el tablero comparado con el mes anterior a la misma altura (bitácora ecommerce, patrón 8); la gracia de 7 días del plan; la purga a 24 meses; la fecha comercial en Bogotá.
- **Lo impedirá:** HU-T1.2, HU-T11.4, HU-T13.5, HU-T14.2, HU-T17.2.
- **Entradas:** —

#### P9 · Reproducir antes de diagnosticar
- **Regla:** ningún diagnóstico se da por bueno sin reproducir el fallo.
- **En la Tienda 3.0:** un pago que no se reflejó se reproduce con el aviso exacto de Bold (cuerpo y firma) contra el D1 local; un horneado distinto, con los mismos datos en los dos runtimes.
- **Lo impedirá:** HU-T11.5, HU-T11.6 (un Bold falso que firma y responde de verdad).
- **Entradas:** tienda3 6, 8, 9.

#### P10 · El que se actualiza a sí mismo corre su versión vieja
- **Regla:** un arreglo en el que se actualiza llega una versión tarde. Y quien vuelve atrás corre también la vieja.
- **En la Tienda 3.0:** lo «instalado» aquí son las páginas horneadas con una release anterior, que piden sus scripts a `/_t/<release>/`; los carritos guardados en los teléfonos; los enlaces de seguimiento ya compartidos; el aviso de Bold registrado en la cuenta de cada comercio con la dirección del subdominio; y la PWA del panel en caché.
- **Lo impedirá:** HU-T4.6 (anillos y 90 días de assets), HU-T5.4, HU-T6.3, HU-T11.5, HU-T8.1; la Definición de Listo, punto 4.
- **Entradas:** —

#### P11 · Lo que depende de SER la semilla no puede decidir si una tienda publica
- **Regla:** una compuerta solo mira invariantes que valen para cualquier cliente.
- **En la Tienda 3.0:** la compuerta mira lo horneado de esa tienda, no la suite de desarrollo; la prueba de humo de producción comprueba que los comercios de prueba **no** estén.
- **Lo impedirá:** HU-T4.3, HU-T2.9.
- **Entradas:** —

#### P12 · El permiso que se comprueba es el que se usa
- **Regla:** un token se prueba antes de sembrarlo y con la acción que va a hacer.
- **En la Tienda 3.0:** `CF_SAAS_TOKEN` se verifica creando y leyendo un hostname de prueba; la llave de identidad de Bold, contra `payment-voucher`; la secreta, con el cobro de prueba guiado. Es la causa 4 de la 2.0: cuatro permisos que se pisan.
- **Lo impedirá:** HU-T11.2, HU-T11.3, HU-T13.1.
- **Entradas:** tienda3 10.

#### P13 · Un secreto no viaja por donde queda escrito
- **Regla:** llaves y tokens solo en los almacenes de secretos, nunca en una dirección, un pantallazo o un documento. Lo mismo, los datos de las personas.
- **En la Tienda 3.0:** las llaves de Bold, cifradas con la DEK de la tienda y visibles solo por su huella; la KEK, en los secretos y en una copia fuera de línea; el secreto del seguimiento, en el fragmento y como huella en la base; nada del comprador en `sessionStorage` (bitácora ecommerce 46); los datos de la transferencia, nunca horneados.
- **Lo impedirá:** HU-T1.3, HU-T2.5, HU-T6.2, HU-T6.3, HU-T9.2, HU-T11.2, HU-T11.4.
- **Entradas:** tienda3 10.

#### P14 · Los fallos silenciosos del lenguaje y del shell
- **Regla:** `| tee` sin `pipefail`, un `try/catch` que protege, dos funciones con el mismo nombre: no fallan, siguen.
- **En la Tienda 3.0:** un `catch` alrededor de la llamada a Bold que convierta un error en «esperando» para siempre; un comando de commit sin `pipefail` (bitácora core 4).
- **Lo impedirá:** el lint y las guardias de flujos que ya existen; HU-T11.6 y HU-T11.7.
- **Entradas:** —

#### P15 · Un aviso tiene que llegar a donde alguien mira, y nombrar la causa
- **Regla:** el aviso va donde está la persona, dice qué pasó y qué hacer.
- **En la Tienda 3.0:** el comerciante mira el panel desde el teléfono: lo urgente (cobro a revisar, pagado sin existencias, llaves que faltan) va arriba, en rojo y en palabras (bitácora ecommerce 57); la compuerta da todas las fallas a la vez; el botón deshabilitado dice qué falta.
- **Lo impedirá:** HU-T3.4, HU-T4.3, HU-T9.1, HU-T11.2, HU-T11.7.
- **Entradas:** —

#### P16 · Un flujo que nunca ha corrido de verdad no está probado
- **Regla:** se corre de punta a punta antes de llamarlo camino normal.
- **En la Tienda 3.0:** la Tienda va a producción, vacía, meses antes de la primera tienda real; el pago se prueba con el ambiente de pruebas de Bold en staging, con botón y con link; la restauración se ensaya antes de guardar pedidos de terceros; cada corte tiene marca de vuelta.
- **Lo impedirá:** HU-T2.9, HU-T11.3, HU-T11.8, HU-T17.4, HU-T12.6.
- **Entradas:** —

#### P17 · El instrumento también miente
- **Regla:** un doble que simplifica una propiedad que el código real promete miente el día que alguien depende de ella.
- **En la Tienda 3.0:** el modelo se probó con `node:sqlite` y falta D1; el horno se prueba en Node y en workerd porque `Intl` cambia entre runtimes; el Bold falso firma de verdad con la llave vacía de pruebas; un navegador de escritorio no codifica imágenes como Safari.
- **Lo impedirá:** HU-T2.1, HU-T4.1, HU-T8.3, HU-T11.5, HU-T11.6.
- **Entradas:** tienda3 2.
- **Lo impide hoy:** `tests/repo/tienda-paquetes-puros.test.ts`: ningún paquete puro de la Tienda (`dinero`, `calendario`, `cifrado`, `tienda-schema`) usa `Intl`, el reloj, el azar ni módulos de Node; la prueba se vio atrapar cada forma prohibida (6 oct 2026).

#### P18 · Un documento no lanza una excepción cuando miente
- **Regla:** lo que un documento afirma del código lo ata una aserción; el redundante se borra.
- **En la Tienda 3.0:** TIENDA propone, ARQUITECTURA decide; los anexos de SQL los ata una prueba al archivo; los runbooks, una prueba que busca lo que nombran. Un documento que cita a otro dice lo que el otro dice.
- **Lo impedirá:** HU-T17.5; la Definición de Terminado, punto 8.
- **Entradas:** tienda3 1, 4, 5, 6, 7, 8, 9.
- **Lo impide hoy:** los anexos A y B de TIENDA tienen que ser copias exactas de las migraciones, y una prueba lo exige (`tests/repo/shard-tienda.test.ts`, HU-T2.1).

#### P19 · Un rojo que no significa nada enseña a no mirar los rojos
- **Regla:** una guarda con falsos positivos o un intermitente se arregla o se quita.
- **En la Tienda 3.0:** las mediciones de Lighthouse varían de una corrida a otra: corren solas, con repeticiones, y su tope se fija con la medición, no con un deseo.
- **Lo impedirá:** HU-T3.6.
- **Entradas:** —

#### P20 · Lo que se le ofrece a alguien tiene que llegar por el camino que esa persona recorre
- **Regla:** se prueba desde quien mira.
- **En la Tienda 3.0:** el comprador con un teléfono barato a 360 px y al sol; el rastreador y el agente que no ejecutan JavaScript (bitácora ecommerce 31); el enlace pegado en WhatsApp, que tiene que mostrar foto, nombre y precio; el comprador que vuelve de pagar en otro navegador; el comerciante con 300 pedidos.
- **Lo impedirá:** HU-T3.5, HU-T3.7, HU-T4.1, HU-T5.2, HU-T11.9, HU-T15.1.
- **Entradas:** tienda3 2, 3.

#### P21 · Lo que borra antes de escribir convierte un fallo en una pérdida
- **Regla:** escribir primero, verificar, borrar después.
- **En la Tienda 3.0:** la carga nunca borra antes de escribir; restaurar une, nunca reemplaza el presente (bitácora ecommerce 77); volver atrás el sitio no toca pedidos ni inventario; un plan vencido oculta lo que pasa del límite, no lo borra; un hostname retirado no se borra; la KEK vieja se retira solo cuando ninguna DEK la usa.
- **Lo impedirá:** HU-T10.4, HU-T12.2, HU-T13.5, HU-T13.7, HU-T17.4, HU-T17.6.
- **Entradas:** —

### Nuevos (provisionales)

#### PT1 · Lo que tiene que sobrevivir a un viaje por un tercero no puede vivir solo en el navegador que lo empezó
- **Regla:** cuando el flujo sale a un tercero (Bold, el banco de PSE, otra aplicación) y vuelve, la persona puede volver en otra pestaña, otro navegador u otro teléfono. Lo que necesita para seguir (su pedido, su enlace, su carrito) se le entrega **antes** de salir, o lo puede recuperar el servidor; nunca vive solo en `sessionStorage` o en la memoria de la página.
- **Por qué:** es la tercera vez. En la 2.0, el carrito volvía vacío al regresar de pagar (bitácora ecommerce 47) y el enlace de rastreo se quedaba en la otra pestaña (bitácora ecommerce 61). El diseño de la 3.0 lo repetía con el secreto del seguimiento (bitácora tienda3 3).
- **Lo impedirá:** HU-T11.9.
- **Entradas:** tienda3 3.

---

## Herencia: lo que otras bitácoras ya pagaron y le toca a la Tienda 3.0

No se copian las entradas (P2): se citan, con la historia de `BACKLOG_TIENDA3.md` que hereda su regla.

| Bitácora | Qué enseñó | Dónde lo hereda la Tienda 3.0 |
|---|---|---|
| ecommerce, crítico | «El botón de WhatsApp se apagaba sin decir por qué»: venta perdida y silenciosa | El botón dice qué falta y lleva al campo (HU-T3.4, HU-T6.1); §5.1 del backlog |
| ecommerce, crítico | La configuración de fábrica traía el celular de la primera tienda | Vacío nunca es valor de fábrica (HU-T1.4, HU-T10.3); WhatsApp verificado antes de publicar (HU-T4.3) |
| ecommerce, crítico | Toda tienda decía que el pedido lo confirmaba otro comercio | Todo texto con el nombre del comercio sale de sus datos (HU-T4.1) |
| ecommerce, crítico | `Number(celda) \|\| 0` convierte «no se pudo leer» en «es gratis» | Un monto ilegible lanza (HU-T1.1); la hoja de la 2.0 se lee y lo ilegible se reporta (HU-T12.4) |
| ecommerce, crítico | La llave de pago estaba en el repositorio; un token salió en un pantallazo | Llaves cifradas y solo su huella visible (HU-T11.2); la KEK nunca se imprime (HU-T2.5) |
| ecommerce 31 | La tienda era invisible para quien no ejecuta JavaScript; sin `lastmod` del reloj | Todo se hornea con JSON-LD; el `lastmod` sale del dato (HU-T4.1) |
| ecommerce 40 | Con un botón de pago, los dos compradores de la última unidad pagan | Apartar en el mismo lote que cobra, con `CHECK` (HU-T11.4) |
| ecommerce 41 | Un cupón de 50 usos no se agotaba nunca | HU-T10.1, CA2 |
| ecommerce 46 y 47 | Datos del comprador en `sessionStorage`; el carrito perdido al volver de pagar | HU-T11.4 y HU-T11.9; PT1 |
| ecommerce 53 y 54 | La tarjeta hablaba de la última combinación mirada; generar filas vacías agotaba la tienda | HU-T3.4, CA3; HU-T8.2, CA4 |
| ecommerce 55 | La 404 era de otro comercio | La 404 y la tienda cerrada, de cada tienda (HU-T5.1) |
| ecommerce 57 | Sin llaves, la tienda cobraba por WhatsApp y el aviso estaba donde nadie miraba | HU-T11.2, CA3 |
| ecommerce 61 | El enlace de rastreo se quedaba en la otra pestaña | HU-T11.9; PT1 |
| ecommerce 62 | Los filtros de pedidos que había que tocar dos veces | Filtros sin red y lecturas con turno (HU-T9.1) |
| ecommerce 64 | Un permiso escondido en la página es un adorno | La API decide con la matriz (HU-T10.5) |
| ecommerce 65 | Ver antes de publicar | HU-T8.6 |
| ecommerce 71 y 84 | El aspecto sobrio, sin fuentes de terceros, y retocar sin romper las pruebas | §5 del backlog; D-T2; HU-T3.3 |
| ecommerce 77 | Volver atrás no puede traer el pasado encima del presente | HU-T10.4, HU-T17.4 |
| ecommerce, menores | Un emoji al principio del mensaje rompía la caja de WhatsApp | HU-T6.1, CA2 |
| ecommerce, TRASLADO §4 | Las siete causas de dolor de la 2.0 | TIENDA §2; un despliegue, ningún código por tienda (§5.8 del backlog) |
| agro, terreno | Safari no codifica WebP en `canvas.toBlob` | HU-T8.3; bitácora tienda3 2 |
| agro, terreno | Un aviso fuera de la vista es un botón que no hace nada | §5.1 del backlog; HU-T3.4, HU-T3.5 |
| agro, terreno | Una pantalla vacía no enseña lo que una llena sí | HU-T3.5, HU-T3.7 |
| agro, terreno | La CSP ignora en silencio los estilos que pone el código | El tema es una hoja horneada (HU-T3.2) |
| agro, terreno | `page.goto` justo después de guardar corta la escritura en IndexedDB | HU-T8.1, CA3 |
| agro, terreno | Staging se despliega solo y producción no; un dominio en el Worker equivocado | Producción temprana, probada en el dominio público (HU-T2.9) |
| agro, terreno | Una versión creada con el token de Actions no dispara otros flujos | Etiqueta y despliegue en la misma corrida (HU-T0.2) |
| agro, terreno | Heredar una solución es heredar su contexto (Bold desde Apps Script) | La 2.0 no usaba los avisos de Bold porque Apps Script no lee cabeceras; la 3.0 sí (HU-T11.5) |
| agro, terreno | Proponer un formato que nadie leyó es aplazar el error | La hoja de la 2.0 se lee por nombre de columna, con una hoja de ejemplo (HU-T12.4) |
| agro 29 | Una decisión se valida contra el documento que la decide | Definición de Listo, punto 5 |
| core 1 | Una cita que no dice lo que dice el citado | Bitácora tienda3 4 |
| core 2 | La guarda de huérfanas revisa toda la base | HU-T2.1, CA4 |
| core 4 | Un commit salió con el lint en rojo por falta de `pipefail` | §3.1 del backlog |
| core 5 | Un número de un instrumento se mira con «¿es razonable?» | HU-T3.3, CA3 |
| core, terreno | El cuello de botella es validar, no construir | §3.6 del backlog: límite de trabajo en curso |
| core, terreno | Dos sesiones en la misma carpeta comparten la rama | La Tienda en su copia de trabajo (`D:\CoWork\gestionagro-tienda`) |
| core, terreno | Una referencia se abre antes de copiarla | Porsche y Tracksmith se abrieron el 6 oct 2026 (§5.2 del backlog) |

---

## Cómo escribir una entrada

Igual que en las otras bitácoras, para que se lean y se extraigan igual:

| Campo | Qué lleva | Cómo se reconoce |
|---|---|---|
| Número y título | El siguiente número libre y el síntoma o la lección en una frase | `**N · Título.**` al empezar el párrafo |
| Qué pasó | Cuándo, en qué tienda de prueba, ruta, cola o flujo, qué se estaba haciendo | Primeras frases |
| Síntoma literal | El mensaje tal cual salió | Entre «…» o en un bloque de código |
| Causa raíz | Por qué pasó, no solo dónde | Prosa |
| Cómo se reprodujo | D1 local, staging, el aviso exacto de Bold, la página horneada… o «sin reproducir», dicho | Prosa |
| Arreglo | Qué cambió, y por qué así | Prosa |
| Qué lo prueba | Prueba y aserciones, con su control negativo | `**Lo prueba(n)**` |
| La regla | La lección que sirve fuera de este caso | `La regla:` en negrita |
| Ficha | Proyecto, autoría, severidad, patrones, versión y fecha | Última línea |

- **Autoría:** *(mío)*, lo rompió o lo afirmó el asistente; *(tuyo)*, el dueño; *(compartido)*; *(del terreno)*, la plataforma, Bold, un navegador o un proveedor.
- **Versión:** la de la Tienda que trae el arreglo (`tienda-X.Y.Z`); `tienda-0.0.0` antes de HU-T0.2.

Cuatro reglas que no se rompen:

1. Una entrada nueva va al final, con el siguiente número. No se renumera.
2. Lo escrito no se reescribe. Se añade *(Hoy: …)* o *(Después: bitácora tienda3 N)*.
3. Se cita el síntoma, no la interpretación.
4. Sin control negativo no hay «lo prueba».

---

## Afirmaciones mías que resultaron falsas

Van aparte porque no son fallos de código: son cosas que dije con seguridad y no eran ciertas.

*(Ninguna todavía. Las del diseño de la Tienda hasta el 5 oct 2026 están en la bitácora agro, por ejemplo la 3, sobre el cobro de WhatsApp.)* *(Hoy: hay dos, abajo.)*

- **14 oct 2026: «el carrito vive en `/pedido/`».** En HU-T5.4 horneé el carrito en `/pedido/` y lo dejé así en el PR #180, sin contrastarlo con TIENDA §5.4, que pone el carrito en `/carrito/` y deja `/pedido/#c=…&s=…` para el seguimiento (y `/pedido/pago/` para la vuelta de Bold). Lo vi al escribir HU-T6.3, que necesita esa ruta. Se corrigió en T6 antes de que hubiera un enlace compartido: el carrito se guarda en `localStorage`, no en la ruta, así que nadie perdió nada. La regla de siempre (premisas antes de decidir): **una ruta pública se toma de la tabla de rutas del diseño, no de la historia que la usa primero.**
- **15 oct 2026: «la Tienda quedó en producción».** En la revisión del estado del proyecto lo afirmé porque el paso «Desplegar la Tienda» del despliegue a producción figuraba «success» en la API de GitHub. Ese paso tiene `continue-on-error: true`: el paso figura en verde aunque falle, y el error está en la anotación del trabajo («Process completed with exit code 1.»). La regla: **el estado de un paso con `continue-on-error` no dice si funcionó; se leen las anotaciones o el resumen de la corrida** (bitácora tienda3 12).
- **15 oct 2026: «la prueba automática ya cubre que la tienda llena se publica».** Lo escribí en el runbook de la revisión con la tienda llena (HU-T3.7). La prueba publicaba con `omitir: ['sin-foto']`, como la publicación de los comercios de prueba, y la siembra no ponía fotos: en staging, la tienda llena no se pudo publicar. La regla: **una prueba que se salta una puerta de la compuerta no dice que se publica; dice que se publicaría sin esa puerta** (bitácora tienda3 22).
- **17 oct 2026: «la tienda llena se publica en 6 tandas».** Lo escribí en la bitácora tienda3 30 y en el PR #203. Lo decía una prueba que corre en Node, donde una solicitud no tiene tope de CPU, y cada tanda vuelve a hornear la tienda entera: 1,3 s de CPU contra los 10 ms del plan gratuito. En staging no se publicó (bitácora tienda3 31). La regla: **lo que se afirma de una solicitud en la plataforma se mide contra todos sus topes, también el de CPU, no solo los que se acaban de romper.**

---

## Cambios de rumbo

No son errores. Son decisiones que cambiaron con información nueva. Las anteriores al 6 oct 2026 que tocan a la Tienda están en la bitácora agro.

| De | A | Por qué |
|---|---|---|
| El tablero en M5, después de cargar las tiendas (TIENDA §19) | El tablero en M2, antes de M6 (HU-T14.2) *(Hoy: M6 se retiró el 13 oct 2026; el tablero sigue en M2)* | El anexo C de TIENDA exige que cada puerta que una tienda usa pase antes de cargarla, y la 2.0 tiene tablero (bitácora tienda3 1) |
| Los días hábiles «en `packages/dinero` o en un `packages/calendario`» (TIENDA §8.6) | `@ed1/calendario`, neutro y compartido con el CORE (HU-T1.2) | El CORE necesita lo mismo para la Ley 1581 (HU-C7.7): una sola fuente (P2) |
| Las fotos siempre en WebP (TIENDA §11.5) | WebP, o JPEG donde el navegador no produce WebP (HU-T8.3) | Safari devuelve PNG (bitácora tienda3 2) |
| Hitos con fechas fijas desde el diseño (TIENDA §19) | Sprints con el calendario del CORE, que arrancan cuando se cumplen sus condiciones (HC1, Workers Paid y la zona `.app`) | El CORE construyó sus tres primeros sprints en tres días: lo que manda es el orden de las dependencias |
| Cargar las dos tiendas 2.0 en la 3.0 en M6, con paridad, marca de vuelta y corte (TIENDA §17 y anexo C) | Ninguna tienda 2.0 se migra; son la referencia de lo que ya funciona (decisión del dueño del 13 oct 2026) | El dueño lo decidió al contestar la paridad. Salen 15 puntos y M4 llega un sprint antes (bitácora tienda3 9) |
| Workers Paid desde M0 (TIENDA §0, versión 0.2) | El plan gratuito hasta que un dato lo exija (decisión del dueño del 6 oct 2026) | Costo cero mientras se pueda. T1 se construyó así; lo que queda abierto, con su historia, en la bitácora tienda3 7 |

---

## Lo que el terreno enseñó, y no fue culpa de nadie

- **Las dos referencias de diseño usan tipografías propietarias.** Porsche usa la suya; Tracksmith, Akzidenz-Grotesk Extended y SainteColombe (medido en la página el 6 oct 2026). Se transfiere la idea (la pareja de serif ligera y sans, la cursiva como énfasis, el titular grande con el interletrado cerrado), no la fuente: las de la Tienda tienen que ser de licencia libre y autoalojadas (D-T2).
- **La ficha de Tracksmith hace lo que la 2.0 aprendió por las malas.** Su botón principal dice «Select a size» hasta que la persona elige talla: es la regla del crítico de la bitácora ecommerce sobre el botón de WhatsApp. Se toma como patrón de la vitrina, no solo como estilo.
- **Un año en Colombia no siempre tiene 18 festivos.** Cuando dos caen el mismo lunes, son 17: en 2030 la Pascua es el 21 de abril, el Sagrado Corazón (+71) cae el 1 de julio, y San Pedro y San Pablo (29 de junio, sábado) se corre a ese mismo lunes. La primera prueba de `@ed1/calendario` suponía 18 siempre y falló en 2030 (HU-T1.2). Contar días hábiles es contar fechas distintas, no festivos.

---

## Entradas numeradas

**1 · TIENDA pone el tablero después de cargar las tiendas, y su propio anexo exige tenerlo antes.**

*Qué pasó.* El 6 oct 2026, al repartir las historias del plan entre los hitos de TIENDA §19, contrasté M6 («las tiendas actuales») con el anexo C, que es su condición de entrada.

*Síntoma literal.*
- TIENDA §19, fila de M5 (después de M6 en el orden de §19): «`/_m` → Analytics Engine, tablero, resumen diario, reporte semanal…».
- TIENDA anexo C: «Antes de cargar una tienda (M6), cada fila que esa tienda use tiene que pasar en staging», y su fila `tablero`: «Ventas y pendientes» → «`tablero`» → «Cuadra con los pedidos de prueba».

*Causa raíz.* El orden de los hitos y la lista de paridad se escribieron en momentos distintos de la versión 0.2 (la paridad entró con el estudio v1.3). Ninguna prueba ata un documento consigo mismo (P18), y M5 juntaba el tablero, que solo lee pedidos de D1, con la medición por eventos, que sí puede esperar.

*Cómo se reprodujo.* Leyendo la fila de M5 y la fila `tablero` del anexo C con los dos abiertos.

*Arreglo.* El tablero (HU-T14.2) pasa a M2, en T11; la medición por eventos, los correos y el consentimiento siguen en M5. TIENDA §19 lleva una nota que lo dice. Y como el anexo C es la condición de M6, HU-T12.1 averigua en T0 qué más usa cada tienda 2.0 (dominio propio, GA4 o Meta, correos, páginas), para que el orden no lo descubra el día del corte.

**Lo prueba:** nada todavía; es un documento. La guardia llega con HU-T12.5: una fila que la tienda usa y no pasa detiene su corte.

La regla: **un hito se contrasta con la condición de entrada del hito siguiente, no solo con su propia lista. Lo que «va después» puede ser lo que otro necesita antes.**

*Ficha:* tienda3 · *(mío)* · 🟡 Medio · P18, P2 · tienda-0.0.0 · 2026-10-06

**2 · TIENDA promete fotos WebP desde el navegador, y Safari no las produce.**

*Qué pasó.* El 6 oct 2026, al escribir HU-T8.3 (fotos del panel), crucé TIENDA §11.5 con la sección «Lo que el terreno enseñó» de la bitácora agro.

*Síntoma literal.*
- TIENDA §11.5: «El panel comprime en el navegador. Genera WebP de 400, 800 y 1600 px y sube las derivadas».
- Bitácora agro, terreno: «Safari no codifica WebP en `canvas.toBlob`: devuelve PNG. La foto del monitoreo cae a JPEG ahí».

*Causa raíz.* El diseño de la Tienda tomó la idea del agro (comprimir en el navegador, ADR-15) sin su cicatriz. En un iPhone, el panel habría subido PNG con nombre `.webp`, o fotos varias veces más pesadas, sin que ninguna prueba en Chromium lo viera (P17: el instrumento de las e2e no es el teléfono del comerciante).

*Cómo se reprodujo.* Sin reproducir en la Tienda, que no tiene código; el comportamiento ya lo midió el agro.

*Arreglo.* HU-T8.3 cae a JPEG cuando el navegador no produce WebP, y la ruta (`<ancho>.<formato>`) y `medio.formatos` dicen el formato real. Su CA3 prueba con un `toBlob` que devuelve PNG, como Safari. TIENDA §11.5 lleva la nota.

**Lo prueba:** nada todavía; la prueba llega con HU-T8.3.

La regla: **cuando un producto hereda una técnica de otro, hereda también su sección del terreno. Se lee antes de escribir la historia.**

*Ficha:* tienda3 · *(mío)* · 🟡 Medio · P17, P20 · tienda-0.0.0 · 2026-10-06

**3 · Pagar en línea y volver en otro navegador dejaba al comprador sin su seguimiento: el diseño repetía la bitácora ecommerce 61.**

*Qué pasó.* El 6 oct 2026, al escribir HU-T11.9, seguí el camino de un comprador que paga con PSE: sale a su banco y puede volver en otro navegador, como en la prueba real de la 2.0 (empezó en Brave y terminó en Chrome).

*Síntoma literal.*
- TIENDA §8.4: «El secreto nace en el navegador… en la base solo queda su SHA-256».
- TIENDA §9.3: «Si el token se perdió (la persona volvió en otro navegador), la página ofrece el enlace de seguimiento, que llegó en el acuse».
- TIENDA §8.5: el acuse es la página de confirmación, el mensaje de WhatsApp (que en el pago en línea no se manda) y el correo «si la persona lo dejó».

*Causa raíz.* El secreto vive solo en el navegador que empezó, y en el pago en línea el acuse puede no haber salido de ese navegador. Es la misma forma de la bitácora ecommerce 61 («lo que tiene que sobrevivir a un viaje por un tercero no puede vivir en una pestaña»), y de la 47. El dinero no estaba en riesgo: el aviso de Bold marca el pago. El comprador, sí: pagó y no tiene cómo ver su pedido sin escribirle al comercio.

*Cómo se reprodujo.* Sin reproducir: no hay código. Se siguió el flujo en el documento.

*Arreglo.* HU-T11.9: antes de abrir Bold, la página entrega el enlace de seguimiento (copiar, o mandárselo por WhatsApp) y lo guarda en el `localStorage` de la tienda, que sobrevive a cerrar la pestaña. Si vuelve sin el token, la página explica cómo encontrar el pedido, sin un error. Una e2e paga en un contexto de navegador y vuelve en otro. TIENDA §9.3 lleva la nota. Como es la tercera vez, nace el patrón provisional PT1.

**Lo prueba:** nada todavía; la e2e llega con HU-T11.9.

La regla: **lo que la persona necesita después de un viaje por un tercero se le entrega antes de salir.**

*Ficha:* tienda3 · *(mío)* · 🟡 Medio · P20, PT1 · tienda-0.0.0 · 2026-10-06

**4 · TIENDA sigue pidiendo una copia mensual fuera de Cloudflare con el proveedor por elegir, y ADR-30 ya decidió otra cosa.**

*Qué pasó.* El 6 oct 2026, al escribir HU-T17.3 (respaldos), contrasté TIENDA §15.4 con ARQUITECTURA.

*Síntoma literal.*
- TIENDA §15.4, punto 3: «Una copia mensual fuera de Cloudflare, ya cifrada… El proveedor se elige en `../plataforma/proveedores-de-computo.md`».
- ARQUITECTURA, ADR-30 (aceptada el 5 oct 2026, en la noche): «La copia fuera de Cloudflare va al Google Drive del dueño (15 GB gratis): semanal, cifrada antes de salir, con la llave fuera de Google».

*Causa raíz.* ADR-30 se decidió horas después de la versión 0.2 de TIENDA, en el plan del CORE, que corrigió PLATAFORMA (bitácora core 1) pero no TIENDA. Es la misma familia de la bitácora core 1: un documento que cita a otro y no dice lo que el otro dice (P18), con dos copias de la misma decisión (P2).

*Cómo se reprodujo.* Buscando «fuera de Cloudflare» en `docs/tienda/` y en ARQUITECTURA.

*Arreglo.* TIENDA §15.4 dice ahora lo que decidió ADR-30 y cita HU-C11.4 y HU-T17.3. La frecuencia vive en un solo lugar cuando HU-C11.4 la construya.

**Lo prueba:** nada todavía; es un documento. La guardia llega con HU-C11.4.

La regla: **una decisión nueva en ARQUITECTURA se busca en todos los diseños que la tocan, no solo en el que la provocó.**

*Ficha:* tienda3 · *(mío)* · 🟡 Medio · P18, P2 · tienda-0.0.0 · 2026-10-06


**5 · TIENDA prometía que el redondeo del cupón favorece al comprador, y la fórmula que escribía favorece al comercio.**

*Qué pasó.* El 6 oct 2026, al escribir `@ed1/dinero` (HU-T1.1), copié la fórmula del descuento por porcentaje de TIENDA §6 y, al ponerle el comentario, no cuadraba con su propia frase.

*Síntoma literal.* TIENDA §6, punto 3.2: «`porcentaje`: `⌊subtotal × % / 100⌋`; el redondeo favorece al comprador».

*Causa raíz.* El piso **del descuento** hace el descuento más pequeño, y por eso el total más grande: con un subtotal de 33.333 y 10 %, el descuento exacto es 3.333,3; el piso da 3.333 y el comprador paga 30.000, cuando la promesa dice 29.999. La frase y la fórmula se escribieron pensando en cosas distintas (el piso «del total» sí favorecería al comprador). Ninguna prueba ataba la promesa a la fórmula: era un documento (P18).

*Cómo se reprodujo.* Con ese caso, a mano y en la prueba.

*Arreglo.* Manda la promesa, que es la decisión de producto y la que protege al consumidor: `⌈subtotal × % / 100⌉`. TIENDA §6 se corrigió con su nota. La diferencia nunca pasa de un peso por pedido.

**Lo prueba** `packages/dinero/src/index.test.ts`, «porcentaje: el redondeo favorece al comprador», con el caso de 33.333. Control negativo: con `Math.floor`, la prueba se ve en rojo.

La regla: **cuando un documento da una fórmula y una promesa sobre ella, la prueba se escribe contra la promesa, con un caso donde las dos lecturas den distinto.**

*Ficha:* tienda3 · *(mío)* · ⚪ Menor · P18, P5 · tienda-0.0.0 · 2026-10-06

**6 · El plan medía la paridad contra la Tienda Panel, y las dos tiendas que venden son de la Tienda Básica.**

*Qué pasó.* El 6 oct 2026, al empezar HU-T12.1 (qué usa cada tienda 2.0), leí el registro público de la flota de la 2.0 (`laboratoriodigital/tiendas`, `flota.json` y `ESTADO.md`).

*Síntoma literal.* `flota.json`: dos líneas, `tienda` («Tienda Panel») y `organico` («Tienda Básica: solo la hoja de cálculo… sin panel web»). Las dos tiendas que venden están en la línea `organico`, versión 3.6.2, en subdominios de `workers.dev`. La línea `tienda` solo tiene su semilla y `prueba1`.

*Causa raíz.* TIENDA-3.0 anexo C se escribió con «el contrato de puertas de la 2.0 (versión 1.0.0)», que es la Tienda Panel, y el plan (bitácora tienda3 1, HU-T12.5) lo tomó como la condición para cargar las tiendas. Nadie había cruzado ese contrato con qué producto usan las tiendas reales: la bitácora ecommerce 67 ya decía que Orgánico y Cinnamon son «la Tienda Básica», otro producto (P9: mirar la fuente antes de planear sobre ella; P18).

*Cómo se reprodujo.* Leyendo los dos archivos públicos de la flota.

*Arreglo.* `docs/tienda/paridad-tiendas-2.0.md` lo deja escrito y saca tres consecuencias: la paridad de M6 se mide contra lo que hace la hoja de la Básica (HU-T12.5); ninguna tiene dominio propio, así que M6 no necesita M4 (D-T7 se sostiene); y para ellas el panel es nuevo, así que el corte lleva una sesión guiada. El resto (cobro en línea, contraentrega, GA4, correos, volumen) son preguntas para el dueño: no se leyó el repositorio privado de una tienda real.

**Lo prueba:** nada todavía; es un documento. La guardia llega con HU-T12.5.

La regla: **antes de tomar un contrato como condición de algo, se comprueba que es el del producto que usan los clientes reales.**

*Ficha:* tienda3 · *(mío)* · 🟡 Medio · P9, P18 · tienda-0.0.0 · 2026-10-06

*(Después: bitácora tienda3 9. Ninguna tienda 2.0 se migra; la Tienda Básica queda como referencia.)*

**7 · TIENDA diseña con Workers Paid desde M0, y el dueño decidió el plan gratuito mientras se pueda.**

*Qué pasó.* El 13 oct 2026, al abrir T1 (la celda, las bases y las tres apps en staging), crucé el diseño con la decisión del dueño del 6 oct: «Workers Paid se utilizarán cuando sea estrictamente necesario y no haya otra salida para seguir avanzando o creciendo».

*Síntoma literal.* TIENDA-3.0, versión 0.2: «todo en la cuenta de Cloudflare de siempre, con Workers Paid desde M0». El diagrama de §3.1 dice «con Workers Paid desde M0», §15.3 se titula «Crons (con Workers Paid)», §15.4 cuenta 30 días de Time Travel y §5.5 mide contra 50 millones de filas escritas al mes. El backlog ponía «Workers Paid» como condición de T1 (§0, §10).

*Causa raíz.* El diseño y el plan se escribieron antes de la decisión, y la decisión se tomó en otra conversación (la del parqueadero, D-Q10). Ningún documento de la Tienda la recogía: el plan seguía esperando una tarea del dueño que ya no iba a llegar (P18). La zona `laboratorio-digital.app`, la otra condición de T1, ya estaba activa: el parqueadero salió a producción en ella.

*Cómo se reprodujo.* Leyendo `celdas.json` (las tres celdas en `plan: free`), `productos.json` (el parqueadero con su presupuesto de filas por día) y los cron de `generar-wrangler.ts` (4 de los 5 de la cuenta en uso).

*Arreglo.* T1 se construyó para el plan gratuito, sin esperar nada:
- la celda `c1` en `plan: free`, con un presupuesto de 5.000 filas escritas al día mientras no haya tiendas (HU-T2.2);
- staging en workers.dev, como el parqueadero: no pide permisos nuevos de la zona (HU-T2.3, HU-T2.4);
- el bucket R2 y la cola se crean con su primer uso (HU-T4.1 y HU-T4.3), no antes (P1).

Lo que el plan gratuito deja abierto, con la historia donde se decide con un dato:
- **Cron:** queda uno libre de los 5 de la cuenta, y TIENDA §15.3 pide cinco frecuencias. Los apartados ya vencen de forma perezosa (anexo A); lo demás puede ir en un solo cron por hora que reparte el trabajo. Se decide con el primer cron (HU-T4.6 o HU-T9.x).
- **CPU por invocación** (10 ms en el plan gratuito): el horno de una tienda puede no caber. Se mide en HU-T4.1; si no cabe, ese es el dato que justifica Workers Paid.
- **Time Travel de 7 días, no 30:** acorta la restauración puntual; la copia semanal de ADR-30 la cubre. El borrado criptográfico de §14.2 queda en menos de 35 días, no más.
- **Filas de D1 de toda la cuenta** (100.000 al día): el parqueadero tiene 70.000; la Tienda vive del resto hasta que el vigía (HU-T2.7) diga otra cosa.
- **R2:** hay que activarlo en la cuenta y el token de despliegue hoy lo tiene prohibido (HU-C11.5). Es una decisión del dueño antes de T3.

**Lo prueba:** `tests/repo/tienda-celda.test.ts` exige la celda en el plan gratuito y que producción no tome ningún hostname; `tests/repo/tienda-despliegue.test.ts`, que staging se prepare sin tocar producción. Control negativo: con `plan: paid` en c1, la primera prueba se ve en rojo.

La regla: **una decisión de costo tomada en otro proyecto se copia el mismo día a los documentos de todos los productos que la cuenta comparte; si no, el plan espera algo que nunca va a llegar.**

*Ficha:* tienda3 · *(compartido)* · 🟡 Medio · P18, P1 · tienda-0.0.0 · 2026-10-13

**8 · Las tiendas 2.0 mandan correos, y el plan ponía los correos de la 3.0 después de cargarlas.**

*Qué pasó.* El 13 oct 2026 el dueño contestó la hoja de paridad (HU-T12.1): las dos tiendas que venden mandan correos, el resumen del día al comercio o la confirmación al comprador.

*Síntoma literal.* Hoja de paridad: «¿Manda correos…? Sí». Backlog: «HU-T14.3 · El resumen diario y los correos de la tienda… **Sprint:** T18», y M6, la carga de las tiendas, cierra en T16. BACKLOG_CORE: «HU-C10.1 · Adaptador de correo… **Depende de:** Workers Paid activo».

*Causa raíz.* El plan ordenó M5 (medición y correo) después de M6 suponiendo que las tiendas no lo usaban; D-T8 ya decía «o antes si HU-T12.1 lo pide», y lo pidió. Lo nuevo es la segunda dependencia: el adaptador del CORE espera Workers Paid, y el dueño decidió el plan gratuito mientras se pueda (bitácora tienda3 7).

*Cómo se reprodujo.* Cruzando la respuesta con el sprint de HU-T14.3 y la dependencia de HU-C10.1.

*Arreglo.* HU-T14.3 pasa de T18 a T13, antes del primer corte, y de Should a Must. Cómo se manda correo en el plan gratuito queda como la decisión D-T11, con su recomendación: un proveedor con cuota gratuita detrás del mismo adaptador del CORE, o Workers Paid si el correo de Cloudflare sigue siendo solo del plan pago. Es el primer dato que puede exigir Workers Paid, y se dice así. Cupones, «Avísame» y contraentrega ya iban antes de M6.

**Lo prueba:** nada todavía; es un plan. La guardia llega con HU-T12.5: una fila de la paridad que la tienda usa y no pasa detiene su corte.

La regla: **una respuesta de paridad se cruza con el sprint de su historia y con las dependencias de esa historia, no solo con su hito.**

*Ficha:* tienda3 · *(compartido)* · 🟡 Medio · P9, P18 · tienda-0.0.0 · 2026-10-13

*(Después: bitácora tienda3 9. Sin migración, los correos siguen en T13 porque el alta abierta los necesita igual.)*

**9 · El plan cargaba las tiendas 2.0 en la 3.0, y el dueño decidió que ninguna se migra.**

*Qué pasó.* El 13 oct 2026, al contestar la segunda ronda de la paridad, el dueño escribió que ninguna tienda de las versiones anteriores se va a migrar al modelo nuevo: se toman de referencia para lo que ya funciona, y eso se puede cambiar, mejorar o quitar en la 3.0.

*Síntoma literal.* El backlog decía «Las tres reglas del proyecto: 1. La 2.0 sigue vendiendo hasta que la 3.0 pase, tienda por tienda, la lista de paridad», tenía un hito M6 («Las tiendas actuales», T16) y cinco historias de conversión, paridad, marca de vuelta y corte (HU-T12.4 a HU-T12.8, 15 puntos).

*Causa raíz.* El diseño (TIENDA §17 y anexo C) y el plan tomaron como objetivo cargar las tiendas en operación, y nadie había preguntado si el dueño quería migrarlas o empezar de cero con comercios nuevos. Tres reordenamientos del plan dependían de eso: el tablero antes de M6 (entrada 1), la paridad medida contra la Tienda Básica (entrada 6) y los correos antes del primer corte (entrada 8).

*Cómo se reprodujo.* Con la respuesta del dueño.

*Arreglo.*
- M6 sale del plan, y las cinco historias de carga y corte quedan «Retiradas».
- M4 (dominios, alta abierta y plan), M5, M7 y M8 llegan un sprint antes; T20 queda de holgura.
- La hoja de paridad y el anexo C pasan de condición a referencia. La carga asistida de un comercio nuevo desde un archivo (HU-T12.2 y HU-T12.3) se queda.
- Los reordenamientos de las entradas 1 y 8 se quedan por otra razón: los comercios de referencia usan tablero y correos, y el alta abierta los necesita igual.
- De la misma ronda nacen HU-T14.8 (verificar en Search Console con la etiqueta HTML, en T3) y las decisiones D-T12 (sin tope de pedidos en el plan gratuito) y D-T13 (GA4 en el subdominio con su cookie limitada; el píxel de Meta, solo con dominio propio).

**Lo prueba:** nada todavía; es un plan. Las cifras del backlog (345 puntos, 303 hasta el alta abierta) salen de sumar la tabla de sprints, no se escriben a mano.

La regla: **antes de planear la migración de algo que ya funciona, se pregunta si el dueño quiere migrarlo o solo aprender de ello; son dos planes distintos.**

*Ficha:* tienda3 · *(compartido)* · 🟡 Medio · P9, P18 · tienda-0.0.0 · 2026-10-13

**10 · TIENDA servía las fotos con un dominio propio del mismo bucket que guarda los respaldos y las exportaciones.**

*Qué pasó.* El 14 oct 2026, al preparar HU-T5.6 (las fotos sin Worker), crucé TIENDA §3.1 y §5.6 con cómo funciona un dominio propio de R2.

*Síntoma literal.* TIENDA §5.6: «R2 tienda-c{N}/ … medios/<org>/<huella>/… fotos (servidas por img.laboratorio-digital.app) … respaldos/<shard>/<AAAA-MM-DD>/<org>.json.gz … exportaciones/<org>/<id>.zip».

*Causa raíz.* Un dominio propio de R2 sirve **cualquier** clave del bucket, no una carpeta. Con `img.` conectado a `tienda-c{N}`, los respaldos semanales y las exportaciones de cada tienda, con los datos personales de sus compradores, quedaban a una dirección adivinable de distancia: la clave lleva el shard, la fecha y el id de la organización. Los respaldos van cifrados en sus sobres (§14.2), pero las exportaciones del comercio no, y los textos legales tampoco deberían estar ahí. Nadie había comprobado qué alcanza un dominio de bucket (P12: el permiso que se comprueba es el que se usa; P13).

*Cómo se reprodujo.* Sin reproducir en la cuenta, a propósito: el bucket no tiene todavía un dominio. Es cómo funciona un dominio propio de R2 en su documentación.

*Arreglo.* Las fotos van en un bucket aparte, `tienda-c1-medios` (`medios` en `celdas.json`), el único con dominio propio; el almacén nunca lleva dominio ni acceso público. `cargarCeldas` rechaza que los dos sean el mismo, y el runbook `docs/runbooks/tienda-fotos.md` dice qué no se hace. TIENDA §3.1 y §5.6 llevan la nota.

**Lo prueba** `tests/repo/tienda-celda.test.ts`, «un bucket de fotos igual al almacén no carga». Control negativo: con `medios` igual a `almacen`, `cargarCeldas` lanza.

La regla: **lo público y lo privado no comparten bucket: un dominio propio expone el bucket entero, no la carpeta que uno tenía en mente.**

*Ficha:* tienda3 · *(mío)* · 🔴 Alto · P12, P13 · tienda-0.0.0 · 2026-10-14

**11 · El límite de «Avísame» es por hora, y el limitador de Workers solo cuenta de a 10 o 60 segundos.**

*Qué pasó.* El 14 oct 2026, al configurar los límites por IP de cotizar (HU-T5.5) y de «Avísame» (HU-T6.5) en el plan gratuito.

*Síntoma literal.* HU-T6.5 CA2: «No se guarda ningún dato de la persona; 10 por hora por IP». El esquema de wrangler para `ratelimits`: `"period": { "enum": [10, 60] }`.

*Causa raíz.* La historia se escribió con un límite de negocio («10 por hora») sin contrastarlo con la herramienta que lo cumple. Contar por hora pedía guardar algo por IP: en el KV, mil escrituras al día para toda la cuenta en el plan gratuito; en la base, un dato de la persona, que CA2 prohíbe.

*Cómo se reprodujo.* `wrangler deploy --dry-run` con `period: 3600` falla la validación del esquema; con 60, lo acepta y lista `env.LIMITE_AVISAME (10 requests/60s)`.

*Arreglo.* Workers Rate Limiting, sin escribir en la base ni en el KV: cotizar con 30 por minuto (lo que pedía HU-T5.5) y «Avísame» con 10 por minuto por IP. Lo que la hora agregaba lo da el teléfono: la isla recuerda la variante por la que ya se preguntó y no vuelve a sumar. Cada destino tiene su propio contador (`namespace_id`), para que staging no gaste el de producción. Sin el limitador configurado, la API lo registra y responde igual: el límite cuida la base, no hace correcta la respuesta.

**Lo prueba** `tests/repo/tienda-celda.test.ts`, «la API limita por IP cotizar y avísame», y `apps/tienda-api/src/cotizar.test.ts`, «pasado el límite por IP: 429». Control negativo: con un limitador que deja pasar una, la segunda responde 429.

La regla: **un límite de negocio se escribe en las unidades que la herramienta sabe contar; si no, la historia promete lo que el plan no da.**

*Ficha:* tienda3 · *(mío)* · 🟢 Bajo · P1, P18 · tienda-0.0.0 · 2026-10-14

**12 · `tienda-v0.1.0` se etiquetó, el despliegue a producción figura en verde, y el paso de la Tienda en producción terminó en error.**

*Qué pasó.* El 15 oct 2026 a las 00:29 UTC, al fusionar el PR #181 (sprint T6), la corrida 38660320774 de «desplegar» subió la Tienda a `0.1.0`: staging, publicar (etiqueta y versión `tienda-v0.1.0` a las 00:32) y producción. Se vio el 15 oct al revisar el estado del proyecto.

*Síntoma literal.* La corrida y sus cuatro trabajos: `success`. El paso «Desplegar la Tienda» del trabajo `produccion / desplegar`: `success`. Las anotaciones de ese trabajo: «failure: Process completed with exit code 1.». Los trabajos de staging y publicar no tienen anotaciones de falla, ni el de producción de la corrida anterior (38583260273).

*Causa raíz.* El paso de la Tienda lleva `continue-on-error: true` a propósito (`desplegar-destino.yml`: «si falla, el paso queda en rojo y el resumen dice por qué, pero el trabajo sigue»), así que la corrida queda en verde aunque la Tienda no llegue a producción. Qué falló dentro del paso: **sin reproducir**; el registro de la corrida no se pudo descargar desde la sesión. Lo más probable es lo que el backlog ya anunciaba: la KEK y el secreto del despacho de producción eran tarea del dueño «antes de fusionar el PR de T6» y no figuraban hechos (BACKLOG_TIENDA3 §10). También puede ser la prueba de humo de HU-T2.9, que corre en el mismo paso.

*Cómo se reprodujo.* Sin reproducir. Se leyó la API de GitHub: `actions/runs/38660320774/jobs` y `check-runs/116180849752/annotations`.

*Arreglo.* Pendiente: el dueño lee el resumen de la corrida para confirmar la causa, genera los secretos de producción si faltan (`node scripts/tienda/generar-secretos.ts --ambiente produccion`) y repite el despliegue a mano a producción con `productos: tienda`. El backlog lo marca: HU-T2.9 sigue sin cumplir CA1 y la tarea del dueño pasa a «ya frena».

**Lo prueba:** nada todavía. Una etiqueta que sale aunque su producto no llegó a producción pide una comprobación en el despliegue, que es otra historia.

La regla: **una versión publicada no es una versión desplegada; con `continue-on-error`, lo que dice si funcionó es la anotación o el resumen, no el color del paso.**

*Ficha:* tienda3 · *(compartido)* · 🟠 Medio · P15, P16, P19 · tienda-0.1.0 · 2026-10-15

**13 · El plan y el mapa de documentos decían cosas que el repositorio ya no cumplía.**

*Qué pasó.* El 15 oct 2026, al contrastar el backlog, la bitácora y `docs/README.md` con el historial de git después del sprint T6.

*Síntoma literal.* BACKLOG_TIENDA3 §3.3: «`tienda-v0.5.0` | T16 | M4…» y «`tienda-v0.6.0` | T17 | M4…», con `tienda-v1.0.0` en T18, mientras §0 y §6.1 ponen M5 (`v1.0.0`) en T17. §6.1: «T6 | 22 feb–5 mar», con T6 fusionado el 14 oct 2026. §13: 34 historias «En validación» con un tope de 3 (§3.6). `docs/README.md`: `tienda/sql/` y `parking/sql/`, que no existen en `main`.

*Causa raíz.* Al retirar M6 (bitácora tienda3 9) se rehicieron la tabla de hitos y el plan de sprints, pero no la tabla de versiones; al mover las migraciones a `infrastructure/` (HU-T2.1 y HU-Q7.2) no se tocó el mapa. Cada cambio corrigió el documento que tenía al frente, no todos los que lo nombran (P2, P18).

*Cómo se reprodujo.* `ls docs/tienda/sql docs/parking/sql` falla en `main`; `git log` de `feat/t6-sprint`; la tabla de §3.3 contra la de §0.

*Arreglo.* La tabla de versiones se alineó con §0 y §6.1; §6.1 dice lo real y por qué las fechas no se recalculan hasta validar T1 a T6; el mapa nombra dónde están hoy las migraciones.

**Lo prueba:** nada todavía; una prueba de repositorio que compare las versiones de §0 con las de §3.3 sería la siguiente.

La regla: **al retirar un hito o mover un archivo, se busca cada documento que lo nombra, no solo el que se está editando.**

*Ficha:* tienda3 · *(mío)* · 🟢 Bajo · P2, P18 · tienda-0.1.0 · 2026-10-15

**14 · La Tienda llegó a producción y la prueba de humo dijo que no, porque buscaba la API en un dominio que no existe.**

*Qué pasó.* El 15 oct 2026, después de que el dueño generó los secretos de producción, se repitió a mano el despliegue a producción con `productos: tienda` (corrida 38669194046). El dueño pegó el resumen de la corrida en el hilo.

*Síntoma literal.* «✨ 1 secrets successfully created», luego «humo, intento 1: 1 fallas» hasta el intento 5, y «c1 · fallo · la Tienda se desplegó, pero la prueba de humo falló: https://tienda-api-c1.laboratorio-digital.app/api/salud: no respondió (fetch failed)».

*Causa raíz.* `urlQueNoDebeResponder` arma la dirección workers.dev de la API con el sufijo del host del panel. En staging el panel vive en `tienda-panel-staging.laboratoriodigital-la.workers.dev` y el sufijo es el subdominio de la cuenta; en producción el panel tiene su dominio (`panel.laboratorio-digital.app`, HU-T2.9) y el sufijo pasó a ser `laboratorio-digital.app`. El humo pedía `tienda-api-c1.laboratorio-digital.app`, un nombre que no resuelve, y contaba el «no respondió» como falla. Lo demás del humo pasó: era la única falla de cada intento. La prueba que fijaba esta función solo miraba staging (P5: la prueba cubría el ambiente donde ya funcionaba).

*Cómo se reprodujo.* Una prueba en `tests/repo/tienda-despliegue.test.ts` con el destino `produccion`: esperaba `https://tienda-api-c1.laboratoriodigital-la.workers.dev` y recibió `https://tienda-api-c1.laboratorio-digital.app`.

*Arreglo.* El subdominio de la cuenta sale siempre de `api_staging`, que vive en workers.dev en los dos ambientes. Después de fusionar, se repite el despliegue a mano a producción con `productos: tienda`.

**Lo prueba:** `tests/repo/tienda-despliegue.test.ts`, «en producción también: el panel tiene su dominio, pero la API se busca en workers.dev». Control negativo: con la función de antes, la prueba queda en rojo con el dominio que no existe.

La regla: **una prueba de despliegue que solo corre contra staging no prueba producción; cada función que arma una URL por destino se prueba con los dos destinos.**

*Ficha:* tienda3 · *(mío)* · 🟠 Medio · P5, P11 · tienda-0.1.0 · 2026-10-15

**15 · El panel le preguntaba a la API sin parar, porque el almacén se creaba de nuevo en cada render.**

*Qué pasó.* El 15 oct 2026, al escribir las e2e del panel (HU-T8.1), la prueba de «vuelve a entrar» nunca pudo tocar el enlace «Pedidos».

*Síntoma literal.* «locator.click: Test timeout of 30000ms exceeded … element was detached from the DOM, retrying», y la foto final mostraba la pantalla de entrar con el diálogo «Vuelve a entrar» encima.

*Causa raíz.* `App` recibía el almacén con un valor por defecto en sus parámetros (`{ almacen = almacenIndexedDb() }`). Ese valor se evalúa en cada render, así que cada render traía un almacén nuevo; `preguntar` dependía de él, el efecto que pregunta a `/api/panel/v1/yo` volvía a correr, su respuesta causaba otro render, y así sin fin. El efecto de apertura también dependía del almacén y releía la sesión en cada vuelta: cuando la sesión venció, la borró de la pantalla. Las pruebas unitarias no lo veían porque prueban las funciones, no el componente montado.

*Cómo se reprodujo.* La e2e de CA1 cuenta las preguntas a `/yo`: una al abrir y otra al cambiar de pantalla. Con el valor por defecto, la cuenta ya era mayor al abrir.

*Arreglo.* El almacén se crea una vez por montaje (`useMemo`).

**Lo prueba:** `tests/e2e/tienda-panel.spec.ts`, «CA1: entra con Google…» (las preguntas se cuentan) y «CA2: si la sesión vence…». Control negativo: con el valor por defecto de antes, las dos quedan en rojo.

La regla: **en un componente, un valor por defecto que crea un objeto es un objeto nuevo en cada render; lo que un efecto o un `useCallback` usa como dependencia se crea una vez.**

*Ficha:* tienda3 · *(mío)* · 🟡 Medio · P5, P19 · tienda-0.1.0 · 2026-10-15

**16 · Volver a desplegar staging sin cambios dejaba las dos tiendas de prueba en 404.**

*Qué pasó.* El 15 oct 2026 se relanzó el despliegue de staging con «productos: core», para que el dueño quedara de propietario de los comercios de prueba (HU-T2.10). El CORE salió bien; el paso de la Tienda salió en rojo, y como ese paso no detiene el trabajo, la corrida se vio verde. Lo encontró el dueño al pegar el resumen.

*Síntoma literal.* «la Tienda se desplegó, pero la prueba de humo falló: https://ensayo-uno--staging.laboratorio-digital.app/ respondió 404 sin la portada de Comercio Ensayo Uno», y lo mismo con Ensayo Dos. El despliegue de las 03:17, con el mismo código pero con una vitrina nueva, había pasado.

*Causa raíz.* En cada despliegue de staging, la siembra reescribe las entradas de `TIENDA_HOSTS` de los comercios de prueba con `version: null` y luego los publica. Si nada cambió desde la última publicación, `publicar` responde «nada cambió» y vuelve sin tocar los punteros, así que quedan en `null` y el despacho dice «Esta tienda todavía no abre». Solo pasaba cuando la vitrina no cambiaba, por eso no se vio antes.

*Cómo se reprodujo.* Una prueba publica, pisa el puntero con `version: null` y publica otra vez sin cambios: el puntero queda en `null`.

*Arreglo.* «Nada cambió» también reescribe los punteros de cada dirección con la versión publicada.

**Lo prueba:** `apps/tienda-api/src/publicar.test.ts`, «sin cambios, los punteros vuelven a la versión publicada aunque alguien los haya pisado». Control negativo: sin el arreglo, queda en rojo.

La regla: **lo que se deriva de la base (un puntero en el KV) se reescribe en cada publicación, cambie o no el contenido; nunca se confía en que siga como se dejó.**

*Ficha:* tienda3 · *(mío)* · 🟠 Medio · P5, P7 · tienda-0.1.0 · 2026-10-15

**17 · Cambiar de tienda desde «Más» se quedaba en «Abriendo tu tienda…» hasta recargar.**

*Qué pasó.* El 15 oct 2026, en la aceptación de staging (WI-T8.1.3), el dueño entró al panel con sus dos tiendas, abrió Ensayo Uno y luego eligió Ensayo Dos desde «Más».

*Síntoma literal.* «Al entrar a la tienda dos se queda el mensaje de entrando, toca actualizar la página para que muestre el inicio de tienda 2.»

*Causa raíz.* Elegir la tienda renovaba la sesión hacia ella y borraba lo que el panel sabía de la tienda anterior (`yo`), pero la pregunta a `/api/panel/v1/yo` solo se repetía al cambiar la pantalla o la ruta. Desde «Más» las dos seguían iguales (`panel` y `/mas/`), así que nadie preguntaba por la tienda nueva. La e2e de elegir tienda empezaba sin tienda elegida, donde la pantalla sí cambia, y no lo veía.

*Cómo se reprodujo.* Una e2e entra con Ensayo Uno, va a «Más», toca «Cambiar de tienda» y abre Ensayo Dos: la página queda en «Abriendo tu tienda…».

*Arreglo.* La pregunta se repite también cuando cambia la tienda de la sesión, y la tienda elegida abre en su inicio.

**Lo prueba:** `tests/e2e/tienda-panel.spec.ts`, «cambiar de tienda desde «Más» abre el inicio de la otra, sin recargar». Control negativo: sin el arreglo, queda en rojo con «Abriendo tu tienda…» en pantalla.

La regla: **lo que un efecto pregunta depende de todo lo que cambia la respuesta, no solo de la pantalla; y la e2e de un cambio empieza desde un estado ya elegido, no solo desde cero.**

*Ficha:* tienda3 · *(mío)* · 🟡 Medio · P5 · tienda-0.1.0 · 2026-10-15

**18 · En el seguimiento del pedido, la línea del estado no se reconocía como el estado.**

*Qué pasó.* El 15 oct 2026, en la compra de prueba de M1 (WI-T5.7.2), el dueño abrió el enlace de seguimiento y no encontró en qué iba el pedido.

*Síntoma literal.* «El enlace de seguimiento lleva de nuevo al acuse», y luego: «no veo la línea con el estado».

*Causa raíz.* La línea estaba (las pruebas la miraban), pero iba sola y sin nombre debajo del código: «Recibido: la tienda lo va a confirmar». El runbook, además, decía que diría «pendiente», que es el nombre interno del estado, no lo que ve el comprador. Leída sin contexto, la frase parecía parte del acuse.

*Cómo se reprodujo.* La e2e del pedido pide que la línea diga «Estado: Recibido: la tienda lo va a confirmar»; con la página de antes recibe la frase sin «Estado:».

*Arreglo.* La línea dice «Estado:» y el estado en negrita. Si el estado no se puede consultar, lo dice en esa misma línea. El paso 7 del runbook cita el texto que se ve.

**Lo prueba:** `tests/e2e/tienda-vitrina.spec.ts`, «HU-T6.1 y HU-T6.2 · enviar el pedido…» (la línea del estado con su nombre) y los dorados del horno. Control negativo: con la página de antes, la e2e queda en rojo.

La regla: **un dato que el comprador tiene que encontrar lleva su nombre al lado; y un runbook cita el texto que se ve en pantalla, nunca el nombre interno.**

*Ficha:* tienda3 · *(mío)* · 🟢 Bajo · P5 · tienda-0.1.0 · 2026-10-15

**19 · El registro decía «la combinación única» de un producto con tallas y colores.**

*Qué pasó.* El 15 oct 2026, al escribir las frases del inventario (HU-T8.5) sobre Ensayo Uno, la frase de un ajuste de M / Arena en «Camisa de lino» salió con «única». El registro de T8 (HU-T10.6) ya hacía lo mismo con cada combinación agregada, editada o quitada.

*Síntoma literal.* «Tú ajustaste las existencias de única en «Camisa de lino» de 4 a 10».

*Causa raíz.* El registro guardaba la combinación en un campo llamado `clave`, y `clave` también es una contraseña: la regla de lo sensible (CA2 de HU-T10.6) la cambiaba por su huella. La frase no encontraba texto y caía en «única», que es el nombre de la combinación de un producto sin opciones. Las pruebas del registro miraban que no hubiera datos sensibles en claro, y lo cumplía; ninguna leía la frase de una combinación con nombre.

*Cómo se reprodujo.* D1 local: una prueba del panel cambia el precio de la combinación Arena de un «Sombrero» con colores y lee el registro; con el campo `clave` la frase dice «única» en vez de «Arena».

*Arreglo.* La combinación se anota como `combinacion`, que no es un nombre sensible, y la frase la lee de ahí. `clave` sigue en la regla: sigue siendo una contraseña.

**Lo prueba:** `apps/tienda-api/src/panel-catalogo.test.ts`, «HU-T10.6: la frase de una combinación la nombra, no dice «única»». Control negativo: con el campo `clave`, la prueba queda en rojo con «única».

La regla: **una regla que borra por nombre de campo también borra lo que no es secreto y se llama igual; la prueba de que algo se tapa va con otra de que lo demás se sigue leyendo.**

*Ficha:* tienda3 · *(mío)* · 🟢 Bajo · P5 · tienda-0.1.0 · 2026-10-15

**20 · Con 2.000 productos, la portada pesaba 434 KB y la tienda no se podía publicar.**

*Qué pasó.* El 15 oct 2026, al publicar a Ensayo Uno llena (HU-T3.7) por la misma ruta de la cola del horno, la compuerta la detuvo. La portada, `/productos/` y cada colección listaban todos sus productos en una sola página.

*Síntoma literal.* «La página /index.html pesa 434 KB y el tope es 50 KB: acorta su texto para que abra rápido en un teléfono».

*Causa raíz.* El horno se escribió y se probó con los comercios de prueba, de 3 a 8 productos, y su presupuesto de peso (HU-T3.6) se midió en esa tienda. Nada había horneado una tienda del tamaño que TIENDA §10.3 promete, 2.000 productos. La compuerta hizo su trabajo: con una tienda real así, el comercio se habría quedado sin publicar.

*Cómo se reprodujo.* D1 local: `apps/tienda-api/src/volumen.test.ts` siembra la tienda llena y llama a `publicar`; antes del arreglo devuelve `bloqueada` con el peso de la portada.

*Arreglo.* La portada muestra los primeros 24 productos y «Ver los N productos», que lleva a `/productos/`. Esa lista y cada colección van de a 48 por página, con «Anteriores» y «Siguientes», `rel="prev"` y `rel="next"`, y cada página tiene su gemelo `.md` y su entrada en `sitemap.xml`. Una tienda de 24 productos o menos sale igual que antes: los dorados no cambiaron.

**Lo prueba:** `packages/tienda-horno/src/horno.test.ts`, «❌ con 2.000 productos con foto, ninguna página pasa su presupuesto», y `apps/tienda-api/src/volumen.test.ts`, «publicar pasa la compuerta en menos de un minuto…». Control negativo: con 5.000 por página, las dos quedan en rojo con el peso. *(Después: bitácora tienda3 22; la segunda se saltaba las fotos.)*

La regla: **un presupuesto medido en la tienda de prueba vale para la tienda de prueba; se mide también con la tienda del tamaño que se promete, antes de que llegue una real.**

*Ficha:* tienda3 · *(mío)* · 🟡 Medio · P4/P5 · tienda-0.1.0 · 2026-10-15

**21 · Con la tienda llena, el panel tardaba en abrir los productos y las colecciones, y una colección perdía productos al guardarse.**

*Qué pasó.* El 16 oct 2026, en el recorrido con la tienda llena en staging (WI-T3.7.3), el dueño sembró a Ensayo Uno con 2.000 productos y recorrió el panel. Al revisar por qué, salieron tres defectos más que nadie había visto todavía.

*Síntoma literal.* «Se demora un par de segundos en cargar los productos, colecciones, etc.» (el dueño).

*Causa raíz.* La lista de productos unía cada producto con sus combinaciones y agrupaba: SQLite recorría las 12.000 combinaciones de la tienda una vez por producto (1,4 s en D1 local, más la red). La lista traía hasta 500 de una vez y cortaba ahí sin decirlo. El editor de una colección pedía esa misma lista para pintar una casilla por producto, y al guardar mandaba solo los marcados que se veían: los miembros que no alcanzaban a cargarse salían de la colección. Guardar una colección de más de 99 productos revisaba que existieran con una sola consulta de un parámetro por producto, y D1 admite 100. El inventario y «Anotar un pedido» bajaban las 12.000 combinaciones de una vez (2,2 MB) y la segunda pintaba 12.000 casillas. Todo se escribió y se probó con los comercios de prueba, de 3 a 8 productos (P4); la prueba de volumen de T11 miraba que cada ruta respondiera, no qué traía ni cuánto tardaba.

*Cómo se reprodujo.* D1 local, con la siembra de volumen: la primera página de productos tardaba 1,4 s; el inventario devolvía 12.003 filas; guardar «De lino» (200 productos) llevaba 201 parámetros en una consulta; el editor de una colección de 60, con 50 a la vista, guardaba 50.

*Arreglo.* Las combinaciones se cuentan en una sola pasada (una subconsulta agrupada), y la primera página tarda 16 ms. Productos e inventario van de a 50 con un cursor, dicen el total («Se ven 50 de 2.001 productos.») y traen más con «Ver más»; los dos se buscan por nombre. El editor de una colección muestra sus productos de a 50, agrega otros buscándolos y guarda en el orden de la colección: lo que no se ha cargado sigue elegido, y solo sale lo que se desmarca. La revisión de los productos de una colección va de a 50. «Anotar un pedido» busca el producto, y lo que ya lleva cantidad sube a «En el pedido» al buscar otra cosa. El libro de una combinación la lee sola.

**Lo prueban:** `apps/tienda-api/src/volumen.test.ts`, «bitácora tienda3 21 · productos, colecciones e inventario con la tienda llena» (la lista de a 50 llega al último sin repetir, la primera página no pasa de 500 ms, guardar 200 no pasa de 100 parámetros, el inventario de a 50 y su búsqueda), y `tests/e2e/tienda-panel.spec.ts`, «bitácora tienda3 21 ❌: guardar una colección de 60 no saca a los que no se ven…» y «…anotar con 2.001 combinaciones…». Control negativo: con la unión de antes, la página tarda más de 500 ms; sin cursor, la lista no llega al último; revisando de a 500, la consulta lleva 201 parámetros; sin límite, el inventario trae 12.003 filas; guardando solo lo visible, faltan los 10 que no se veían; sin «En el pedido», la cantidad anotada se pierde al buscar.

La regla: **una lista que puede crecer se pide de a poco desde el primer día, dice cuántas hay y nunca guarda «lo que se ve» como si fuera todo.**

*Ficha:* tienda3 · *(mío)* · 🟡 Medio · P4, P21 · tienda-0.1.0 · 2026-10-16

**22 · La tienda llena no se pudo publicar porque sus productos no tenían foto.**

*Qué pasó.* El 16 oct 2026, en el mismo recorrido (WI-T3.7.3), el dueño publicó a Ensayo Uno llena desde el panel de staging. La compuerta la detuvo.

*Síntoma literal.* «la tienda no publico porque no tienen foto los productos» (el dueño). La compuerta da una falla por producto: «Sube una foto de «Bata de algodón Brisa»».

*Causa raíz.* La siembra de volumen creaba productos activos sin foto, y la compuerta no publica un producto activo sin foto (HU-T3.6). La prueba que debía verlo, «publicar pasa la compuerta en menos de un minuto», publicaba con `omitir: ['sin-foto']`, copiado de la publicación de los comercios de prueba: pasaba con el defecto y sin él (P5). Nadie había publicado la tienda llena por el camino del panel antes del recorrido (P16).

*Cómo se reprodujo.* D1 local: `volumen.test.ts` sin `omitir` devuelve `compuerta` con un «Sube una foto de…» por cada producto.

*Arreglo.* La siembra le pone a cada producto de Ensayo Uno que no tiene foto la primera que el comercio subió desde el panel: la misma huella, así que el archivo ya está en el almacén de medios y no se sube nada. En staging, si Ensayo Uno no tiene ninguna foto, no siembra nada y lo dice: «… sube una a cualquier producto desde el panel de staging y vuelve a correr esto». La prueba publica sin omitir nada, con el host de las fotos, y mira que la ficha lleve su imagen. El runbook dice, como primer paso, que se suba una foto.

**Lo prueban:** `apps/tienda-api/src/volumen.test.ts`, «publicar pasa la compuerta en menos de un minuto…» y «2.000 productos de 6 combinaciones…» (cada producto con su foto, una sola huella), y `tests/repo/tienda-sembrar-volumen.test.ts`, «❌ sin ninguna foto subida, no siembra nada y pide subir una desde el panel». Control negativo: sin poner las fotos, la publicación queda en rojo con «Sube una foto de «Bata de algodón Brisa»».

La regla: **una prueba de publicación no se salta ninguna puerta de la compuerta; si una puerta estorba, se siembra lo que la abre.**

*Ficha:* tienda3 · *(mío)* · 🟡 Medio · P5, P16 · tienda-0.1.0 · 2026-10-16

**23 · Pasado el plazo de un pago abandonado, la última unidad seguía pareciendo agotada.**

*Qué pasó.* El 16 oct 2026, al probar el pago en línea (HU-T11.4) contra el D1 local: un comprador aparta la última camisa S Arena y no paga; a los 16 minutos otro la pide.

*Síntoma literal.* `POST /api/v1/cobros` respondió `{"estado":"cambio","cotizacion":{…"avisos":[{"codigo":"linea_quitada","variante":"v-camisa-s-arena"}…]}}`: la tienda le quitó la camisa del pedido al segundo comprador.

*Causa raíz.* TIENDA §7.2 pone el vencimiento perezoso dentro del lote (paso 2a), después de recalcular (paso 1). La cotización cuenta `stock − reservado`, y `reservado` todavía incluía el apartado vencido, así que el lote nunca llegaba a correr. Hasta que pase el cron de conciliación (HU-T11.6), cada pago abandonado escondía sus unidades.

*Cómo se reprodujo.* D1 local: `apps/tienda-api/src/cobros.test.ts`, «pasados los 15 minutos, lo apartado vence al apartar otra vez».

*Arreglo.* Lo vencido de esas variantes se vence antes de cotizar, y el lote lo vuelve a hacer por si otro apartó entre tanto. TIENDA §7.2 lleva una nota que lo dice.

**Lo prueba** esa misma prueba. Control negativo: sin el vencimiento antes de cotizar, queda en rojo con `cambio`.

La regla: **un vencimiento perezoso va antes de la primera lectura que lo necesita, no solo antes de la escritura.**

*Ficha:* tienda3 · *(mío)* · 🟡 Medio · P5 · tienda-0.1.0 · 2026-10-16

**24 · La verificación de los avisos de Bold pedía el cobro antes de poder leerlo.**

*Qué pasó.* El 16 oct 2026, al escribir los avisos de Bold (HU-T11.5) sobre TIENDA §9.4.

*Síntoma literal.* El pseudocódigo de §9.4 dice «cobro = por metadata.reference → su ambiente → la llave secreta de ESE ambiente», y la misma sección dice que la verificación va «antes de leer el JSON». `metadata.reference` está dentro del JSON.

*Causa raíz.* Las dos frases venían de dos ideas buenas, escritas por separado: elegir la llave por el ambiente del cobro, y no parsear un cuerpo que nadie firmó. Juntas no se pueden cumplir.

*Cómo se reprodujo.* Sin reproducir: se vio al escribir el código, antes de correrlo.

*Arreglo.* La firma se verifica primero contra las dos llaves que la tienda puede tener: su secreta de producción y la de pruebas (64 bytes en cero). La que firma dice el ambiente del aviso. Solo entonces se lee el JSON y la referencia busca el cobro, y si el cobro es del otro ambiente, de otra tienda o no existe, no se escribe nada, ni en `aviso_proveedor`. Lo segundo importa porque la llave de pruebas es pública: sin esa regla, cualquiera podría llenar la tabla con avisos inventados. TIENDA §9.4 lleva una nota que lo dice.

**Lo prueban:** `apps/tienda-api/src/avisos.test.ts`, «❌ un aviso de pruebas sobre un cobro de producción no lo mueve ni deja fila; el de producción sí» y «❌ un aviso de pruebas de un cobro que no existe responde 200 sin escribir nada». Control negativo: sin comparar el ambiente, el primero queda en rojo, porque el aviso de pruebas mueve el cobro de producción.

La regla: **cuando la llave depende del contenido, se prueban las llaves posibles antes de leerlo, y lo que firma la llave pública no escribe nada que no sea suyo.**

*Ficha:* tienda3 · *(mío)* · 🟠 Alto · P9, P17 · tienda-0.1.0 · 2026-10-16

**25 · La guardia del `org_id` solo conocía las tablas de la primera migración.**

*Qué pasó.* El 16 oct 2026, al agregar la tabla `correo` en la 0006 para los correos de la tienda (HU-T14.3).

*Síntoma literal.* Con la consulta `SELECT estado, intentos, motivo FROM correo WHERE clave = ?`, sin `org_id`, `tests/repo/org-id-en-consultas.test.ts` quedaba en verde.

*Causa raíz.* La lista de tablas de la Tienda salía de `0001_tienda_v1.sql`, porque cuando se escribió (HU-T2.8) no había otra migración. Las 0002 a 0005 solo agregaron columnas y referencias, así que nadie lo notó. La primera tabla nueva habría quedado sin guardia, y una consulta suya podría leer los correos de otra tienda.

*Cómo se reprodujo.* La consulta de arriba, con la guardia como estaba.

*Arreglo.* La guardia lee todas las migraciones del shard, y exige que `correo` esté en su lista.

**Lo prueba** `tests/repo/org-id-en-consultas.test.ts`, «conoce las tablas del shard y encuentra las consultas». Control negativo: leyendo solo la 0001, esa prueba queda en rojo; leyendo todas, la consulta sin `org_id` queda en rojo.

La regla: **una guardia que lee una lista de archivos lee todos los que cumplen la regla, no el que existía cuando se escribió.**

*Ficha:* tienda3 · *(mío)* · 🟡 Medio · P1, P9 · tienda-0.1.0 · 2026-10-16

**26 · Una sola carga de Productos con la tienda llena gastó el día de D1 de toda la cuenta.**

*Qué pasó.* El 16 oct 2026, en el recorrido con la tienda llena en staging (WI-T3.7.3). Desde las 14:20 UTC fallaron los despliegues de #194, #195, #196 y #198, en «Desplegar el CORE», y hasta las 00:00 UTC ninguna base de la cuenta respondió: el CORE, el agro, el parqueadero y la Tienda, en staging y en producción.

*Síntoma literal.* `Your account has exceeded D1's free tier daily row read limit. Upgrade to a paid plan or wait until tomorrow (midnight UTC) to continue. [code: 7500]`.

*Causa raíz.* El plan gratuito da 5 millones de filas leídas al día para toda la cuenta, y D1 cuenta cada fila que recorre una consulta, también las de un índice. En la versión de staging (056a1a6), la lista de Productos unía cada producto con las combinaciones de la tienda: 2.001 × 12.003, es decir 24.025.578 filas en una sola carga. La #194 la había bajado a 25 mil, pero su despliegue ya no pudo correr. Midiendo lo demás salieron tres más:

- Sin estadísticas, SQLite prefiere recorrer la tienda entera por la llave primaria (`org_id`) antes que el índice de las combinaciones de un producto. Por eso abrir o guardar un producto leía las 12.000 combinaciones, y la purga diaria leía 40.000 filas aunque no tuviera nada que purgar.
- El inventario leía 60.000 filas por página, porque unía y contaba todas las combinaciones.
- El tablero leía 13.000 filas para contar las agotadas.

Ninguna prueba medía filas leídas: la base en proceso no las cuenta, y la de workerd sí, pero nadie las sumaba (P17).

*Cómo se reprodujo.* `apps/tienda-api/src/lecturas.test.ts` con la versión de antes: la lista de productos lee 24.716 filas y el inventario 60.015.

*Arreglo.* La 0007 agrega cuatro índices, `variante_por_producto`, `variante_agotada`, `producto_en_orden` y `producto_en_orden_por_slug`, y la columna `producto.combinaciones`, que mantienen tres triggers. Las consultas nombran su índice con `INDEXED BY`, para que el plan no dependa de lo que el planificador adivine. Si el índice falta, la consulta falla en vez de leer la tienda. Las listas eligen primero la página de productos y después leen sus combinaciones. La purga no nombra productos cuando no hay ninguno que purgar.

| Lectura | Antes | Después |
|---|---|---|
| Lista de Productos | 24.716 | menos de 5.000 |
| Inventario | 60.015 | menos de 5.000 |
| Tablero | 14.256 | menos de 5.000 |
| Abrir un producto | 12.013 | menos de 300 |

**Lo prueba** `apps/tienda-api/src/lecturas.test.ts`, que corre siempre con el D1 de workerd y la tienda llena. Pone un tope por lista (5.000 filas), por ficha o cambio (300), por corrida de cada tarea (300 la de cada hora, 5.000 la diaria, 50.000 la semanal) y para publicar y exportar. El mensaje nombra la consulta que más leyó. Control negativo: con el código de antes, 8 de esas pruebas quedan en rojo; sin el trigger que cambia de producto una combinación, la cuenta de `combinaciones` queda desfasada.

La regla: **una consulta se mide por las filas que lee, no por lo que tarda; y si importa qué índice usa, lo nombra.**

*Ficha:* tienda3 · *(mío)* · 🔴 Alto · P17, P7 · tienda-0.1.0 · 2026-10-16

**27 · R2 no se detiene al agotarse: cobra. Y nada lo frenaba.**

*Qué pasó.* El 16 oct 2026, después de la 26, el dueño pidió revisar qué otro límite de la cuenta podía fallar igual y vigilar R2, que no para el servicio sino que cobra a la tarjeta. El dueño decidió seguir en el plan gratuito. La revisión completa está en `tienda/limites/riesgos-de-la-cuenta-cloudflare.md`, en los archivos del proyecto.

*Causa raíz.* Cuatro cosas, encontradas leyendo el código, no en producción:

- El vigía del agro medía las operaciones de R2, pero no el espacio guardado. Al acercarse a lo gratis subía el nivel del agro, que pausa la sincronización del cuaderno y no usa R2. La Tienda, que es la que escribe en R2, seguía igual.
- Una publicación que se cortaba a mitad (el Worker se reinicia, se pasa de tiempo) quedaba «horneando» para siempre: nadie más podía publicar ni volver a una versión, y el panel abierto la leía cada 3 segundos todo el día.
- La purga diaria y el respaldo semanal recorrían todas las tiendas en la misma corrida del cron. En el plan gratuito una corrida tiene un tope de 50 consultas a D1: con unas pocas tiendas, el respaldo dejaba de caber.
- Nadie podía pausar la subida de fotos, que es lo que más espacio ocupa.

*Arreglo.*

- **El freno de R2** (`apps/tienda-api/src/freno-r2.ts`), una tarea de cada hora del cron de producción. Mide en la API de métricas lo de toda la cuenta: el espacio de las últimas 24 horas y las operaciones del mes. Desde el 75 % avisa por Telegram, una vez por escalón. Desde el 90 % del espacio o de las escrituras apaga `ks:tienda-horno` y `ks:tienda-fotos`, nunca la venta ni los cobros, y anota cuáles apagó él. Por debajo del 80 % enciende solo esas; si el dueño cambió una a mano, no la toca. Las lecturas (clase B) las hace la vitrina al servir las páginas, y apagar no las baja: solo avisa. Si no puede medir, no apaga ni enciende nada y la tarea queda en falla en `/api/salud`. Mide con el mismo token de solo lectura del vigía (`CF_METRICAS_TOKEN`), que ahora también recibe la Tienda.
- **`ks:tienda-fotos`**: apagado, subir una foto responde 503 «Subir fotos está en pausa»; las que ya están siguen en la tienda.
- **El vigía del agro** sigue midiendo y diciendo R2, pero el nivel lo deciden solo las cuotas diarias, como dice ARQUITECTURA §8.2.
- **Una publicación que lleva 10 minutos sin terminar vence**: queda «fallida» con el motivo, al pedir otra, al volver a una versión o al abrir «Publicar y versiones». El panel, mientras algo se hornea, lee la lista a los 3, 6, 12… segundos, hasta una vez por minuto.
- **La purga y el respaldo se reparten**: cada tienda tiene su hora del día para la purga y su hora de la semana para el respaldo, sacadas de su id. La tarea corre cada hora y solo atiende a las tiendas de esa hora.

*Lo que falta.* Borrar de R2 las versiones de más de 90 días que no sean la vigente ni una de las 5 anteriores (TIENDA §351), con los objetos que ya ningún manifiesto nombra. Los objetos son por huella y los comparten todas las tiendas de la celda: borrar uno que todavía se usa rompe una vitrina. Va en su propio cambio, con su prueba. Mientras tanto, el freno impide que R2 cobre. Las reglas de caché, de WAF y de tope por visitante del dominio de las fotos se ponen en el panel de Cloudflare: los pasos están en `docs/runbooks/tienda-fotos.md`.

**Lo prueba** `freno-r2.test.ts`: lo que mide y desde cuándo; al 91 % apaga las dos y avisa una vez; entre el 80 y el 90 % no suelta; por debajo, enciende solo lo suyo; la clase B solo avisa; sin poder medir no toca nada. `vigia.test.ts`: R2 al 95 % deja el nivel en «normal». `publicar.test.ts`: una publicación de 9 minutos sigue en curso y una de 11 vence. `tareas.test.ts` y `respaldos.test.ts`: fuera de su hora no se purga ni se respalda ninguna tienda, y 480 tiendas se reparten entre las horas. Control negativo: sin el freno, sin la condición de lo suyo, soltando sin medir, sin vencer, sin el turno o con todas en la misma hora, cada una de esas pruebas queda en rojo.

La regla: **lo que cobra al pasarse se frena antes, desde el producto que lo gasta; y lo que puede quedar a medias tiene un plazo.**

*Ficha:* tienda3 · *(mío)* · 🟠 Medio · P1, P7 · tienda-0.1.0 · 2026-10-16

**28 · Lo que R2 guarda del sitio solo crecía, y no se podía borrar sin saber quién lo usa**

*Qué pasó.* Lo que quedó pendiente de la 27, el 16 oct 2026, mientras el día de D1 se reiniciaba.

*Causa raíz.* Tres cosas, encontradas leyendo el código:

- Cada versión deja en R2 su manifiesto y lo horneado, que en una tienda llena pesan cientos de KB, y la tienda publica sola cada vez que algo se agota o vuelve a haber (HU-T4.5). Nada se borraba nunca: el espacio solo crecía, hasta que el freno de la 27 apagara publicar.
- Los objetos van por huella y los comparten todas las versiones y todas las tiendas de la celda que tengan el mismo archivo. Nada decía cuáles se usaban: borrar uno que otra tienda todavía sirve rompe su vitrina, y R2 no avisa.
- El cron anotaba cada tarea en el KV de flags en cada corrida. Desde la 27 la purga y el respaldo corren cada hora, y eran 120 escrituras al día de las 1.000 que tiene toda la cuenta.

*Arreglo.*

- **Cada día, en la hora de cada tienda** (`versiones-del-sitio`, `apps/tienda-api/src/purga-de-sitios.ts`): lee los manifiestos de sus versiones nuevas y anota en `sitios/<org>/vivos.json`, por huella, la versión más nueva que la usa. Con ese índice al día, purga las versiones de más de 90 días que no son la vigente ni una de las 5 anteriores (TIENDA §351). Borra su manifiesto y lo horneado y las marca con `publicacion.purgada` (migración 0008), y saca del índice las huellas que solo usaban ellas. El panel dice que a una purgada ya no se puede volver, y la API tampoco deja.
- **Cada lunes** (`objetos-sin-uso`): borra los objetos que no nombra el índice de ninguna tienda y que se subieron 6 horas antes del índice más viejo. Lo que sube una publicación en curso queda después, y no se toca. Las tiendas salen de las carpetas de `sitios/`, no de la base. Si a una le falta el índice, o lo tiene de hace más de 2 días, no borra nada y lo dice. `legal/`, los respaldos y las exportaciones no se tocan.
- El índice basta porque lo que se purga es siempre lo más viejo, salvo la vigente, que no se purga nunca. Una huella cuya versión más nueva se purgó solo la usaban versiones purgadas, o la vigente si es más vieja (después de «Volver a esta»): esa se vuelve a leer.
- **Una tarea que sigue bien se anota una vez por su plazo**: la diaria, una vez al día; la semanal, una vez a la semana. Una falla, y la vuelta de una falla, se anotan siempre.

*Lo que falta.* El cron de la Tienda corre solo en producción: el almacén de staging no se purga. Una corrida lee hasta 20 manifiestos por tienda, porque el CPU del cron en el plan gratuito es poco. Una tienda que publica más que eso al día no purga ni deja barrer hasta ponerse al día; la tarea lo dice en `/api/salud`. El 17 oct el dueño puso la regla de firewall del dominio de las fotos. El tope por visitante no cabe en el plan gratuito, porque esa regla no acepta el host. No hace falta: lo que cobra es saltarse la caché, y eso lo bloquea el firewall (`docs/runbooks/tienda-fotos.md`).

**Lo prueba** `purga-de-sitios.test.ts`, contra el shard local con Ensayo Uno y Ensayo Dos. Prueba cuáles se purgan, también después de «Volver a esta», y que borra lo de las purgadas y no deja volver a ellas. Prueba que la vigente vieja conserva sus huellas, que sin el índice al día no purga y que lo que se hornea queda para mañana. En el barrido, la huella que Ensayo Uno dejó de usar y Ensayo Dos usa se queda, lo de una publicación en curso se queda, y sin un índice no se borra nada. `tareas.test.ts`: en 24 horas la repartida se anota 3 veces (la primera, la falla y la vuelta). `publicacion.test.ts` del panel: a una purgada no se vuelve. Control negativo: sin la vigente vieja, sin esperar el índice, sin el margen, sin el índice de la otra tienda, sin las 5 anteriores o sin los 90 días, barriendo fuera de `objetos/`, sin la marca en «Volver», o anotando siempre, cada una queda en rojo.

La regla: **antes de borrar lo que se comparte, se sabe quién lo usa; y si no se sabe, no se borra.**

*Ficha:* tienda3 · *(mío)* · 🟠 Medio · P4, P21 · tienda-0.1.0 · 2026-10-16

**29 · Una migración leyó 24 millones de filas y volvió a agotar el día de D1 de la cuenta**

*Qué pasó.* El 17 oct 2026 a las 00:03 UTC, recién reiniciado el día de D1, se volvió a desplegar staging. A las 00:15 el despliegue del parqueadero de staging ya decía «Your account has exceeded D1's free tier daily row read limit». El límite es de toda la cuenta: también lo usa el parqueadero de producción, que tiene un cliente.

*Causa raíz.* La 0007 (bitácora 26) corrió a las 00:05 en el shard de staging, con Ensayo Uno lleno. Su `UPDATE producto SET combinaciones = (SELECT count(*) FROM variante …)` no nombraba el índice, y SQLite recorría todas las combinaciones de la tienda por cada producto: 2.000 × 12.000 = 24 millones de filas, casi 5 veces el día de toda la cuenta. La 26 arregló las consultas del panel con `INDEXED BY`, pero nadie midió la migración con la tienda llena: la prueba de lecturas siembra la tienda con todas las migraciones ya aplicadas (P17).

*Cómo se reprodujo.* `apps/tienda-api/src/migraciones.test.ts` con la 0007 de antes: «la que más leyó (24020004 filas): UPDATE producto SET combinaciones …».

*Arreglo.*

- **Cada migración del shard se mide contra la tienda llena**, con el D1 de workerd. La prueba siembra a Ensayo Uno con el esquema de antes de la 0007, aplica cada migración siguiente, una por una, y ninguna puede leer más de 200.000 filas. Una migración nueva entra sola en la prueba. `baseLocal` acepta `antesDe` para aplicar solo las migraciones de antes.
- **La 0007 nombra su índice** (`INDEXED BY variante_por_producto`) y lee 16.004 filas. Ya corrió en staging y no se repite allí: wrangler la recuerda por su nombre. Producción todavía no la corre, y la correrá así.

*Lo que falta.* El CORE, el agro y el parqueadero no tienen una tienda llena con que medir sus migraciones. El parqueadero tiene datos de un cliente: una migración suya que recorra una tabla grande por cada fila haría lo mismo.

**Lo prueba** `migraciones.test.ts`. Control negativo: con la 0007 de antes, la prueba queda en rojo con 24.065.649 filas.

La regla: **una migración se mide como una consulta: con la tienda llena y contando filas, antes de que corra donde cuesta.**

**30 · La tienda llena no se podía publicar: una solicitud no alcanza para 4.200 archivos**

*Qué pasó.* El 17 oct 2026 a las 00:03 UTC, en el despliegue de staging, la celda c1 falló al publicar a los comercios de prueba. Ensayo Uno estaba lleno (HU-T3.7) y nunca se había publicado así. El despliegue se detuvo y la celda c2 no se desplegó.

*Causa raíz.* En el plan gratuito, una invocación de un Worker hace como mucho 1.000 operaciones con R2, D1 y KV. La primera publicación de Ensayo Uno lleno sube 4.221 archivos, uno por uno, en una sola solicitud: se cortaba a la mitad. Ninguna prueba contaba las escrituras de una publicación con la tienda llena; la de lecturas contaba filas de D1, no operaciones (P17). Además, el despliegue publicaba a los dos comercios de prueba en la misma solicitud.

*Cómo se reprodujo.* `lecturas.test.ts` con la tienda llena y sin tandas: «operaciones con R2 en la tanda 1: expected 4223 to be less than or equal to 950».

*Arreglo.*

- **Publicar sube por tandas** de hasta 800 escrituras, 6 a la vez. Un texto legal cuenta por dos, porque también va a `legal/`. Si faltan archivos, se anota lo subido en `sitios/<org>/tandas.json`, se descarta la versión reservada y la API responde 202 con cuántos faltan. La tienda sigue mostrando la versión que tenía. La solicitud siguiente no vuelve a subir lo de las tandas de la última hora, y en la última se guardan el manifiesto y los punteros, como siempre. Lo subido y todavía sin manifiesto lo protege el margen de 6 horas del barrido de objetos (bitácora 28).
- **El panel vuelve a pedir solo**, hasta 30 veces, y dice cuántos archivos faltan. Si no alcanza, pide volver a publicar: sigue donde quedó.
- **El despliegue también**: mientras `/api/ensayo/publicar` responda 202 vuelve a pedir, hasta 20 veces. Cada solicitud sube archivos para una sola tienda de prueba; la otra va en la siguiente.

*Lo que falta.* El re-horneado de existencias (HU-T4.5) no va por tandas: sube solo las fichas, el catálogo y los feeds que cambiaron. Si un día cambian cientos de combinaciones a la vez, habría que partirlo igual.

**Lo prueba** `lecturas.test.ts`: la tienda llena se publica en 6 tandas y ninguna pasa de 950 operaciones. `publicar.test.ts`: con tandas de 5, la tienda queda como estaba hasta la última; nada se sube dos veces; una tanda de hace 61 minutos ya no cuenta. `tienda-ensayos.test.ts`: el despliegue publica en dos solicitudes y no pide sin fin. Control negativo: sin leer las tandas anotadas, sin su hora, contando un texto legal por uno, sin descartar la versión, sin repartir los comercios, sin repetir en el despliegue o sin el tope, cada una de esas pruebas queda en rojo.

La regla: **lo que hace una solicitud se cuenta contra el tope de una invocación, con la tienda llena; y lo que no cabe se parte en tandas que se pueden retomar.**

*Ficha:* tienda3 · *(mío)* · 🔴 Alto · P17, P1 · tienda-0.1.0 · 2026-10-17

**31 · La tienda llena no se puede hornear en una solicitud del plan gratuito: gasta 1,3 s de CPU y el tope es 10 ms.**

*Qué pasó.* El 19 oct 2026 el dueño volvió a correr el despliegue de staging del PR #203, que el 17 oct había fallado por el día de D1 (bitácora 29). El CORE, el agro y el parqueadero se desplegaron. La Tienda se desplegó, pero no pudo publicar a los comercios de prueba, y la prueba de humo falló 5 veces. Era la primera vez que Ensayo Uno lleno (HU-T3.7) llegaba a publicarse en staging.

*Síntoma literal.* «publicar a los comercios de prueba respondió 500: {"ensayo-uno":{"estado":"en-curso"},"ensayo-dos":{"estado":"en-curso"}}».

*Causa raíz.* En el plan gratuito una invocación tiene 10 ms de CPU. Publicar hornea la tienda entera en cada solicitud, también en cada tanda de la 30, que repartió las escrituras pero no el horno. Medido en local con `process.cpuUsage` alrededor de `publicar`: con Ensayo Uno lleno (2.000 productos, 4.221 archivos), cada tanda gasta entre 1,2 y 1,6 s de CPU; con Ensayo Uno de siempre (29 archivos), 31 ms la primera vez. Cloudflare tolera de más una tienda chica, no 100 veces más. La solicitud cortada deja su versión «horneando», y la siguiente, antes de los 10 minutos de la 27, responde «en-curso». La bitácora 7 ya lo había dejado escrito: «el horno de una tienda puede no caber. Se mide en HU-T4.1; si no cabe, ese es el dato que justifica Workers Paid». Se midió el 19 oct, con la tienda llena; con las de prueba cabía (P17: la prueba corre en Node, donde nada corta por CPU).

*Cómo se reprodujo.* En local, con la siembra de `lecturas.test.ts` y una prueba temporal que no quedó en el repositorio: cinco tandas «por-tandas» y una «publicada», cada una entre 1.235 y 1.563 ms de CPU. En staging no hay registros: la sesión no tiene acceso a la cuenta.

*Arreglo.* Ninguno en el código: es una decisión del dueño (§10 del backlog). Las salidas:

- **Workers Paid** (USD 5 al mes): 30 s de CPU por invocación, hasta 5 minutos. Una tienda de 2.000 productos cabe sin cambiar nada, y la misma activación trae las colas que TIENDA §1.3 supone para hornear. Es la que recomiendo, antes de la primera tienda real con más de unos 15 productos: una de 100 productos gastaría unos 70 ms por solicitud.
- **Hornear por partes**, sin pagar: cada solicitud hornea unas pocas fichas y las guarda; la última arma el manifiesto. Con unos 0,6 ms por producto, una tienda de 300 productos pediría unas 20 solicitudes, cada una por encima de los 10 ms, confiando en la tolerancia de Cloudflare, que no está escrita.

Mientras tanto, el paso de la Tienda del despliegue de staging queda en rojo con Ensayo Uno lleno y lo dice en el resumen, sin detener a los demás (`continue-on-error`). Ensayo Dos no tiene volumen: quedó «en-curso» porque la invocación que lo publicaba también se cortó.

*Lo que falta.* La decisión del dueño. Con Workers Paid no hay que cambiar el código, porque el tope por defecto es de 30 s: basta volver a desplegar staging. Sin él: hornear por partes, que es una historia nueva de unos 5 puntos. *(Hoy, 19 oct 2026: el dueño decidió activar Workers Paid cuando la Tienda esté completa. Mientras tanto, el despliegue de staging omite, diciéndolo, la tienda de prueba de más de 50 productos (`PRODUCTOS_DE_UN_ENSAYO_EN_EL_PLAN_GRATUITO`): Ensayo Uno lleno sigue con la versión que tenía y Ensayo Dos se publica. Lo prueba `apps/tienda-api/src/ensayo.test.ts`.)*

**Lo prueba** solo la medición, todavía: una prueba de CPU en Node no dice lo que mide Cloudflare. Con la decisión, la prueba es el despliegue de staging en verde con la tienda llena publicada.

La regla: **el horno se mide en CPU con la tienda más grande que se va a vender, antes de decir que cabe en una solicitud.**

*Ficha:* tienda3 · *(mío)* · 🔴 Alto · P17, P16 · tienda-0.1.0 · 2026-10-19

**32 · El respaldo semanal no se podía restaurar: los pedidos quedaban sin su combinación.**

*Qué pasó.* El 19 oct 2026, al escribir el simulacro de restauración (HU-T17.4), antes de que hiciera falta restaurar nada. El respaldo de HU-T17.3 ya corría cada semana en producción, sin tiendas reales todavía.

*Síntoma literal.* Sin reproducir en una restauración: se vio leyendo el código. La carga de un `tienda-export/1` le pone a cada producto el id `imp-p-<ref>` y a cada combinación `imp-v-<ref>-<clave>` (`importar.ts`), y las líneas de los pedidos respaldados nombran los ids de antes.

*Causa raíz.* El respaldo llevaba el catálogo como «Descargar todo», que sirve para llevarse la tienda a otro lado, y los pedidos como filas de la base. Son dos formatos que no se encuentran: en una base vacía, las líneas de los pedidos no tienen a qué combinación apuntar y la llave foránea las rechaza. HU-T17.3 probó que el archivo cuadra con la base y que sus sobres se abren, pero no que vuelve a ser una tienda (P16: un flujo que nunca ha corrido de verdad no está probado).

*Cómo se reprodujo.* No hizo falta: el simulacro se escribió con las filas tal como están.

*Arreglo.*

- **`tienda-respaldo/2`:** las filas de cada tabla de la tienda tal como están en la base (`TABLAS_DEL_RESPALDO`, en el orden en que se restauran), los bytes en base64. La exportación sigue en el archivo, para leerlo sin la base. Las llaves de las credenciales siguen sin viajar.
- **Restaurar une, no reemplaza:** cada fila con `ON CONFLICT DO NOTHING`. Las columnas que llevan los triggers (`producto.combinaciones`, `variante.reservado`) entran en cero y los triggers las cuentan al entrar cada combinación y cada apartado: copiadas, se contaban dos veces y el `CHECK` de lo apartado fallaba. Los consecutivos quedan por encima de lo restaurado.
- **El simulacro en staging** lee a Ensayo Uno por la API de D1, lo restaura en una base nueva y compara las huellas tabla por tabla. Staging no tiene cron y no tiene respaldos: el simulacro arma el suyo con la misma función.

*Lo que falta.* Correr el flujo en staging (dueño). Los respaldos de la versión 1 que haya en producción no se restauran: no hay tiendas reales, y el script los rechaza diciéndolo. Con la tienda llena, el respaldo y el simulacro leen el doble que antes: el tope de lecturas de la tarea semanal (50.000) se sigue cumpliendo.

**Lo prueba** `respaldos.test.ts`: en un shard vacío, las huellas de las 25 tablas salen iguales y el contacto se abre con la KEK; sobre la tienda con un pedido nuevo y un producto cambiado, vuelve lo que faltaba y lo presente se queda; restaurar dos veces no cambia nada; un respaldo de la versión 1 o con filas de otra tienda no se restaura. `tests/repo/tienda-simulacro.test.ts`: el simulacro contra una API de D1 de mentira, que también borra su base cuando algo falla. Control negativo: con `INSERT OR REPLACE` y copiando lo que cuentan los triggers, rojo.

La regla: **un respaldo se prueba restaurándolo, en una base vacía y sobre la tienda viva, antes de que haga falta.**

*Ficha:* tienda3 · *(mío)* · 🔴 Alto · P16, P21 · tienda-0.1.0 · 2026-10-19

**33 · Con 100 cobros a la vez, la tienda abrió 101: el tope de 40 se contaba antes del lote.**

*Qué pasó.* El 19 oct 2026, en la batería de caos del cobro (HU-T11.10), antes de que hubiera un cobro de verdad.

*Síntoma literal.* «expected 101 to be less than or equal to 40».

*Causa raíz.* `iniciarCobro` contaba los cobros abiertos de la tienda con un `SELECT` y, si eran menos de 40, escribía el lote. Cien solicitudes a la vez leían el mismo número antes de que ninguna escribiera, y todas pasaban. El tope protege lo apartado: sin él, un ataque de cobros que nadie paga deja la tienda sin unidades por 15 minutos. La prueba de HU-T11.4 abría los 40 de uno en uno, y así el defecto no se veía (P5: una comprobación que da lo mismo con el defecto y sin él no comprueba nada).

*Cómo se reprodujo.* `caos.test.ts`: cien `POST /api/v1/cobros` con `Promise.all` contra el D1 de workerd.

*Arreglo.* El lote del cobro termina con una sentencia que cuenta los abiertos de la tienda, con el nuevo incluido, y aborta el lote entero si pasan de 40 (`json('ocupada')`, como `SI_CAMBIO`). D1 aplica un lote como una transacción: dos lotes no se cuentan a la vez. El conteo de antes se queda, para no escribir lo que de todos modos no cabe.

**Lo prueba** `caos.test.ts`: con cien a la vez quedan 40 abiertos, y los demás reciben «ocupada» sin dejar pedido ni cobro. Control negativo: con el conteo solo antes del lote, rojo.

La regla: **un tope que protege algo compartido se cuenta en la misma transacción que lo gasta.**

*Ficha:* tienda3 · *(mío)* · 🟠 Medio · P5 · tienda-0.1.0 · 2026-10-19
