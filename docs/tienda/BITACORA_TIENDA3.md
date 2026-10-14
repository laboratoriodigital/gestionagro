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

*(Ninguna todavía. Las del diseño de la Tienda hasta el 5 oct 2026 están en la bitácora agro, por ejemplo la 3, sobre el cobro de WhatsApp.)*

---

## Cambios de rumbo

No son errores. Son decisiones que cambiaron con información nueva. Las anteriores al 6 oct 2026 que tocan a la Tienda están en la bitácora agro.

| De | A | Por qué |
|---|---|---|
| El tablero en M5, después de cargar las tiendas (TIENDA §19) | El tablero en M2, antes de M6 (HU-T14.2) | El anexo C de TIENDA exige que cada puerta que una tienda usa pase antes de cargarla, y la 2.0 tiene tablero (bitácora tienda3 1) |
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
