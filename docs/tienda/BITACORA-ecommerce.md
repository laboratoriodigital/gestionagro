# Bitácora de fallos

Todo lo que se rompió, quién lo rompió, por qué pasó y cómo se arregló. Está
para dos cosas: que un fallo no vuelva por el mismo camino, y que quien llegue
después vea que las decisiones raras del código tienen una cicatriz detrás.

**Severidad** = qué tan caro sale, no qué tan difícil fue arreglarlo.

| | |
|---|---|
| 🔴 **Crítico** | Se pierde una venta, se filtra un secreto, o la tienda queda viva y muda. **Casi todos fueron silenciosos** |
| 🟠 **Grave** | Bloquea el trabajo o el despliegue, pero se ve |
| 🟡 **Medio** | Cuesta tiempo, confunde, o deja una prueba mintiendo |
| ⚪ **Menor** | Cosmético, redacción, números desactualizados |

---

## Lo aprendido

Lo que se repitió, destilado de toda la bitácora. Es la lista viva: cuando una
entrada nueva confirma un patrón, se añade su número; cuando enseña uno nuevo,
se abre el siguiente id. Cómo juntar esto con las bitácoras
de otros proyectos y aplicarlo antes de equivocarse: `CONOCIMIENTO.md`.

- **Los ids no cambian nunca.** P1–P8 son los «patrón 1» a «patrón 8» de
  siempre, con el mismo número, porque el código y los documentos los citan
  así. De P9 en adelante son nuevos. «P9» no es la entrada 9: una entrada se
  cita como «bitácora N».
- **Entradas** son los números de la bitácora. Las primeras no tienen número:
  se citan por su sección y el principio de su título.
- **Lo impide hoy** es lo que falla en rojo si el patrón vuelve: una batería,
  una aserción o una pieza del código, comprobada al escribir esto
  (29-sep-2026). Si no hay nada, se dice.

### P1 · El fallo que funciona es el caro
- **Regla:** lo que cae a un respaldo, a un valor de fábrica o a un «no pasa nada» tiene que gritar; si no, el respaldo se vuelve el estado normal.
- **Entradas:** 1, 17, 31, 36, 73, 81, 108, 111, 113; Críticos: *El maestro publicado se quedaba sin su hoja*, *La configuración de fábrica traía el celular…*, *Una batería de pruebas que reventaba contaba 0/0*, *`Number(celda) || 0`…*.
- **Lo impide hoy:** `pruebas/todas.sh` cuenta como rota la batería que no arranca; `montar/preparar-index.mjs` se niega a hornear una clave vacía o entre corchetes; `montar/publicar-maestro.mjs` repone `HOJA_ID` antes de subir.

### P2 · Dos copias del mismo procedimiento: una siempre se queda atrás
- **Regla:** una sola fuente, y lo demás se deriva de ella. Si no se puede, una aserción ata las dos copias. Vale igual para una lista, un número, un documento, un comentario o una justificación.
- **Entradas:** 2, 9, 18, 26, 29, 33, 41, 52, 80, 82, 83, 99, 100, 110; Críticos: *Y el mismo agujero seguía intacto en el flujo de Actions*, *El guardia dejaba pasar el catálogo…*; Medios: *El runbook hablaba de dos campos…*; Menores: *«758 aserciones»…*.
- **Lo impide hoy:** `PUBLICA` escrita una vez en `montaje.yml` y `fotos.yml`, y `pruebas/montaje.js` la compara con lo que escribe cada herramienta (99); `semilla.json` es la única lista de lo que es de la semilla; `pruebas/esquema.js` ata `CONTRATOS.md` al código; `pruebas/montaje.js` exige que todo secreto de un flujo esté en `ARQUITECTURA.md` (82).

### P3 · Windows
- **Regla:** lo que corre en la máquina del operador corre en Windows, y una prueba en Linux no lo ve.
- **Entradas:** 3, 25; Graves: *Publicar el maestro no corría en Windows*, *«Falta clasp» con clasp instalado*, *Dos herramientas se cargaban, no ejecutaban nada…*.
- **Lo impide hoy:** nada automático: ningún flujo corre en Windows. Lo mitigan las herramientas en Node, `pathToFileURL` y la salida en `pruebas/.salida/`.

### P4 · Una prueba que solo sabe ver la primera tienda no prueba el producto
- **Regla:** ninguna prueba del producto nombra a un comercio real; se prueba con un comercio de prueba y, además, con OTRO.
- **Entradas:** 4, 11, 12, 14, 55, 93, 102, 107, 111; Medios: *Cinco baterías daban por hecho que la tienda se llamaba «Orgánico»*.
- **Lo impide hoy:** `pruebas/marca.js` con la lista única `terminos-prohibidos.json`; `pruebas/respaldo.js` monta un comercio que no es el de la plantilla; `pruebas/tiendita.js` hornea otro comercio.

### P5 · Una comprobación que da lo mismo con el defecto y sin él no comprueba nada
- **Regla:** antes de dar una comprobación, preguntar qué respondería sin el cambio; si distingue, preguntar qué distingue de verdad. Toda aserción nueva se ve en rojo con su defecto puesto (control negativo) antes de darla por buena.
- **Entradas:** 5, 10, 11, 15, 19, 33, 34, 39, 46, 53, 60, 108; Graves: *Y la comprobación que di era la misma trampa de siempre*.
- **Lo impide hoy:** la regla del control negativo en `CONTRIBUIR.md`; canarios como «ESTA BATERÍA DISTINGUE» en `pruebas/respaldo.js`. Ninguna batería comprueba que las demás tengan su control.

### P6 · Lo que se escribe para los que vienen después deja fuera al primero
- **Regla:** la tienda cero —la semilla— también es una tienda: lo que se hace para «las demás» se corre contra ella.
- **Entradas:** 6, 106; Graves: *El repositorio semilla nunca pasó por su propio runbook*.
- **Lo impide hoy:** `release.yml` pone al día el maestro de la propia semilla (0.22.3), vigilado por `pruebas/montaje.js`.

### P7 · Una caché convierte un chequeo en un recuerdo
- **Regla:** un instrumento lee la fuente, no la caché; una caché guarda respuestas, no fracasos; y lo que cambia dentro de la corrida la invalida.
- **Entradas:** 7, 30, 56.
- **Lo impide hoy:** el sondeo caduca a los diez minutos (`montar/tienda.mjs`) y `montar/publicar-maestro.mjs` lo tira al publicar (`olvidarSondeo()`), probado en `pruebas/montaje.js`.

### P8 · El reloj es una entrada que nadie declara
- **Regla:** fecha, hora y huso se mueven en la prueba que dice cubrir el reloj; los meses se restan con `getMonth()`; lo que no puede existir ese día se salta diciéndolo; los tiempos se informan, no se afirman.
- **Entradas:** 8, 13, 27, 29, 91.
- **Lo impide hoy:** `pruebas/calendario.js`, que corre las baterías de calendario fingiendo días de un año bisiesto y con otro huso (`TZ`).

### P9 · Reproducir antes de diagnosticar
- **Regla:** ningún diagnóstico se da por bueno sin reproducir el fallo (emulador, repositorio de juguete, tiendita). Un error se lee por lo que dice, y cuatro arreglos que fallan igual son una sola hipótesis equivocada.
- **Entradas:** 25, 50, 56, 92, 99, 104, 106, 107; Críticos: *El acta se congela antes de que llegue el último sello*; Graves: *El maestro se inventaba su propia dirección*; las cinco *Afirmaciones mías que resultaron falsas*.
- **Lo impide hoy:** nada automático. Es regla de la casa, escrita en `RUNBOOK-TECNICO.md`.

### P10 · El que se actualiza a sí mismo corre su versión vieja
- **Regla:** un arreglo en el auto-actualizador llega una versión tarde. Lo que decide si una tienda publica vive en lo que la actualización escribe antes de usarlo (`pruebas/`), y lo que la tienda no puede entregarse se lo entrega otro: la flota.
- **Entradas:** 90, 92, 95, 101, 102, 103, 113.
- **Lo impide hoy:** `pruebas/publicacion.sh` elige la compuerta y llega con la actualización antes de correr; `flota/flujos.mjs` (en `tiendas`) entrega los flujos.

### P11 · Lo que depende de SER la semilla no puede decidir si una tienda publica
- **Regla:** la compuerta de una tienda solo mira invariantes sobre lo horneado con SUS datos; lo que solo es cierto en la semilla se comprueba allí y en una tienda se salta diciéndolo.
- **Entradas:** 13, 93, 95, 102, 104, 113.
- **Lo impide hoy:** `pruebas/tienda-viva.js`, elegida por `pruebas/publicacion.sh` con `donde.js` (`esSemilla()`); `pruebas/tiendita.js` corre la compuerta sin lo que `alta` no hereda y con otro comercio.

### P12 · El permiso que se comprueba es el que se usa, y ninguno opcional va en el camino crítico
- **Regla:** un token se prueba antes de sembrarlo y con la acción que va a hacer. `actions/checkout` deja una cabecera `extraheader` con el `GITHUB_TOKEN` que gana a cualquier token puesto en la URL del push, y el `GITHUB_TOKEN` no puede escribir `.github/workflows`.
- **Entradas:** 68, 87, 89, 92, 96, 97, 101, 102, 103.
- **Lo impide hoy:** los flujos de una tienda los entrega la flota con `FLOTA_TOKEN` por la API de contenidos, y la tienda los saca de su commit (103, `pruebas/actualizar.js`, `pruebas/tiendita.js`); `flota/pruebas.mjs` exige comprobar antes de sembrar (96); `pruebas/permiso.js` pregunta por los flujos, no por el repositorio (97).

### P13 · Un secreto no viaja por donde queda escrito
- **Regla:** llaves y tokens viven solo en las propiedades del script (y en los secretos de GitHub donde toca); nunca en la hoja, el repositorio, una dirección (solo POST), un pantallazo ni un resumen. Lo mismo, los datos del comprador.
- **Entradas:** 37, 46; Críticos: *La llave de pago estaba en el repositorio*, *Un token de GitHub clásico y el token de una tienda salieron en pantallazos*.
- **Lo impide hoy:** `pruebas/admin.js` revisa cada petición y exige que ni la clave ni el testigo vayan en una dirección; `pruebas/pagoweb.js` busca los datos del comprador en lo guardado; `flota/pruebas.mjs` exige que `PANEL_CLASPRC` no se imprima.

### P14 · Los fallos silenciosos del lenguaje y del shell
- **Regla:** una tubería sin `pipefail`, un `try/catch` que protege, dos funciones con el mismo nombre, una constante que nace `undefined` o una comparación que nunca coincide no fallan: siguen. Cada clase se ata con una aserción de clase, no de la línea que la destapó.
- **Entradas:** 36, 42, 51, 58, 110; Graves: *Dos herramientas se cargaban, no ejecutaban nada, y salían con código 0*; Medios: *Una tubería `| tee` sin `pipefail`…*, *Una función `pesos()` duplicada*.
- **Lo impide hoy:** `pruebas/montaje.js` exige `pipefail` en toda tubería con `tee`; `pruebas/esquema.js`: ninguna función del maestro se declara dos veces y ninguna constante nace con `undefined`; la guardia de puertas del maestro falla cerrada (36).

### P15 · Un aviso tiene que llegar a donde alguien mira, y nombrar la causa
- **Regla:** el aviso va donde está la persona —el resumen de la corrida, arriba del panel—, dice qué pasó en ESTA corrida y qué hacer. Un paso que corre `always()` después de un desastre, o un error de git al final, cuenta su pena y no la del desastre.
- **Entradas:** 20, 21, 44, 50, 57, 63, 87, 91, 92, 99, 105, 107.
- **Lo impide hoy:** la ficha común con que abren los resúmenes de los flujos de los dos repositorios, vigilada por `pruebas/montaje.js` (91).

### P16 · Un flujo que nunca ha corrido de verdad no está probado
- **Regla:** una guarda que nunca vio su caso está redactada, no comprobada; una aserción sobre el texto de un flujo no dice que funcione. Se corre de punta a punta, con sus secretos o con un repositorio de juguete, antes de llamarlo camino normal. Y leer el código para documentarlo es una prueba.
- **Entradas:** 19, 22, 24, 27, 69, 70, 103, 106; Críticos: *Y el mismo agujero seguía intacto en el flujo de Actions*.
- **Lo impide hoy:** repositorios de juguete con git de verdad en `pruebas/restaurar.js`, `pruebas/montaje.js` y `pruebas/tiendita.js`; `flota/pruebas.mjs` exige que `panel` le entregue a clasp su credencial (106). Nada obliga a que un flujo nuevo tenga su prueba de punta a punta.

### P17 · El instrumento también miente
- **Regla:** un emulador o un doble que simplifica una propiedad que el código real promete miente el día que alguien depende de ella; se implementa de verdad antes de apoyarse en él. Y lo que se prueba junto —la página y la hoja emulada— tiene que ser del mismo comercio.
- **Entradas:** 14, 24, 35, 39, 43, 48, 59, 111.
- **Lo impide hoy:** `pruebas/gas.js` usa el crypto de Node (con los bytes con signo, como Google), un `getUuid` aleatorio, un `LockService` que sabe si la llave está tomada y, desde la 0.24.1, una lista que rechaza también al código del maestro (111).

### P18 · Un documento no lanza una excepción cuando miente
- **Regla:** un procedimiento, un documento; el redundante se borra, no se marca. Lo que un documento o un comentario afirma del código lo ata una aserción, y «esto lo comprueba X» se verifica abriendo X.
- **Entradas:** 23, 26, 52, 80, 82, 96, 112; Graves: *El documento mandaba a sacar el stub de donde no sale*; *Afirmaciones mías que resultaron falsas* 3 y 4.
- **Lo impide hoy:** las guardias de documentación de `pruebas/montaje.js` (secretos en `ARQUITECTURA.md`, funciones y flujos que nombra el runbook, de dónde sale el stub); `pruebas/esquema.js` con `CONTRATOS.md`; `flota/pruebas.mjs` lee el orden real de `conectar` (96).

### P19 · Un rojo que no significa nada enseña a no mirar los rojos
- **Regla:** una guarda con falsos positivos, un motivo que ya se fue, un tope fijo, un intermitente o una X que nadie va a aprobar se arreglan o se quitan. Darlas por buenas siempre y darlas por molestas siempre son el mismo error.
- **Entradas:** 12, 17, 26, 27, 28, 36, 43, 113.
- **Lo impide hoy:** nada general. Casos sueltos: el tope del stub crece con las opciones (`pruebas/menu.js`), y `pruebas.yml` se salta los pull requests del bot.

### P20 · Lo que se le ofrece a alguien tiene que llegar por el camino que esa persona recorre
- **Regla:** se prueba desde quien mira —el comprador, el comerciante que no entra a GitHub, el rastreador que no ejecuta JavaScript—, no desde el estado interno.
- **Entradas:** 17, 31, 34, 57, 78, 85, 88, 109, 110, 112; Críticos: *El botón de WhatsApp se apagaba sin decir por qué*.
- **Lo impide hoy:** las baterías de navegador miran la pantalla, no las listas internas (34, `pruebas/hoja.js`); el SEO se hornea y lo revisa `pruebas/seo.js` (31).

### P21 · Lo que borra antes de escribir convierte un fallo en una pérdida
- **Regla:** reescribir datos del comercio es escribir primero (o guardar lo de antes en memoria) y borrar después; si escribir falla, lo de antes vuelve a su sitio. Y lo que escribe el script pasa por las mismas reglas que lo que escribe una persona.
- **Entradas:** 111.
- **Lo impide hoy:** `pruebas/presentacion.js` 3e (instalar sobre una Configuración con listas por fila) y `pruebas/restaurar.js` (restaurar una copia en otro orden), las dos vistas en rojo con el código de antes.

---

## Cómo escribir una entrada

Las buenas entradas ya traen estos campos, en prosa y en este orden. Escritas
así se leen como una historia y se pueden extraer igual.

| Campo | Qué lleva | Cómo se reconoce |
|---|---|---|
| Número y título | El siguiente número libre y el síntoma o la lección en una frase | `**NN · Título.**` al empezar el párrafo |
| Qué pasó | Cuándo, en qué tienda o flujo, qué se estaba haciendo | Primeras frases |
| Síntoma literal | El mensaje tal cual salió, sin arreglarlo | Entre «…» o en un bloque de código |
| Causa raíz | Por qué pasó, no solo dónde | Prosa |
| Cómo se reprodujo | Emulador, repositorio de juguete, tiendita… o «sin reproducir», dicho | Prosa |
| Arreglo | Qué cambió, y por qué así y no de otra forma | Prosa |
| Qué lo prueba | Batería y número de aserciones, y su control negativo: qué defecto se puso y se vio en rojo | `**Lo prueba(n)**` |
| La regla | La lección que sirve fuera de este caso, si la hay | `La regla:` y en negrita |
| Ficha | Autoría, severidad, patrones, versión y fecha | Última línea, con el formato de abajo |

La ficha es una sola línea al final, siempre igual:

```
*Ficha:* *(mío)* · 🟠 Grave · P6, P9 · 0.22.3 · 2026-09-29
```

- **Autoría:** *(mío)* —lo rompió o lo afirmó quien escribe esta bitácora, el
  asistente—, *(tuyo)* —el dueño—, *(compartido)* o *(del terreno)* —no fue
  culpa de nadie: la plataforma—.
- **Severidad:** la de la tabla de arriba: 🔴 Crítico, 🟠 Grave, 🟡 Medio, ⚪
  Menor. Es un campo, no un sitio: las entradas numeradas van todas juntas y
  en orden.
- **Patrones:** los ids de «Lo aprendido». Si la entrada enseña uno nuevo, se
  abre el siguiente id allí, con su regla y lo que lo impide.
- **Versión y fecha:** la versión que trae el arreglo y el día, en AAAA-MM-DD.

Y cuatro reglas para no romper lo que ya está:

1. **Una entrada nueva va al final de «Entradas numeradas»**, con el siguiente
   número. Los números no se reutilizan ni se renumeran: el código y los
   documentos citan «bitácora N».
2. **Lo escrito no se reescribe.** Si una entrada afirma algo del presente que
   dejó de ser cierto, se le añade al final una nota corta *(Hoy: …)*; si algo
   la continuó, *(Después: …)*, con el número de la entrada que lo cuenta.
3. **Se cita el síntoma, no la interpretación.** El mensaje literal es lo que
   buscará quien lo vuelva a ver.
4. **Sin control negativo no hay «lo prueba».** Si la aserción no se vio en
   rojo, se dice.

---

## 🔴 Críticos

**El maestro publicado se quedaba sin su hoja.** `maestro.gs` lleva
`var HOJA_ID = ''` en el repositorio porque es distinto en cada tienda. Subirlo
tal cual **borraba el valor del proyecto publicado**, y entonces la tienda caía
al inventario de respaldo que trae dentro: se veía perfecta y no registraba un
solo pedido. Lo delató el panel con un `NO RESPONDE` sobre una tienda que estaba
arriba. → Se repone antes de subir, se niega a subir sin él, y al terminar
pregunta `?a=bloques` para comprobar que abre su hoja. *(mío)*

**Y el mismo agujero seguía intacto en el flujo de Actions.** `maestro.yml`
tenía su propia copia del procedimiento escrita dentro del YAML —`cp maestro.gs
subida/`— con el fallo que ya se había arreglado en la herramienta. Nadie lo
había disparado todavía. → El flujo **llama** a la herramienta en vez de
reescribirla, y una batería impide que se vuelva a escribir dentro. *(mío)*

**La llave de pago estaba en el repositorio**, en cuatro sitios de
`CONTEXTO.md`. → Marcadores en el documento, el valor real en `secretos.md`
—que no se versiona— y la llave se entrega solo por la respuesta automática de
WhatsApp. *(compartido)*

**Un token de GitHub clásico y el token de una tienda salieron en pantallazos.**
→ Revocado y reemplazado por uno de grano fino con permiso de solo lectura
sobre Actions. El de la tienda es rotable y de alcance acotado. *(tuyo, resuelto
en el momento)*

**Toda tienda le decía a su comprador que el pedido lo confirmaba otro
comercio.** El mensaje de WhatsApp y el **consentimiento de datos** —lo que el
cliente marca antes de comprar— llevaban el nombre escrito a mano en el archivo
en vez de `${NEGOCIO}`. La panadería nombraba a la tienda de tomates. → Los dos
salen ahora del nombre de la tienda, y hay aserciones que lo impiden. *(mío)*

**La configuración de fábrica traía el celular de la primera tienda.** Una
tienda nueva que no lo cambiara le mandaba los pedidos a ese teléfono. **Un
número de fábrica no falla: funciona**, y por eso es el peor valor posible. →
El celular viene vacío y el nombre y el sitio entre corchetes; el montaje se
niega a escribir la página si siguen sin llenar. *(mío)*

**El botón de WhatsApp se apagaba sin decir por qué.** En un teléfono los datos
de entrega quedan más abajo del pliegue: el cliente llena el carrito, ve el
total, toca el botón y no pasa nada. Venta perdida, y silenciosa. → Un aviso en
el pie fijo que nombra qué falta, y tocarlo —o tocar el botón apagado— lleva al
campo vacío. *(mío; lo viste tú con clientes reales)*

**Una batería de pruebas que reventaba contaba 0/0**, así que sumaba lo mismo a
los dos lados del marcador y **la corrida podía salir verde con una batería
entera sin correr**. → `todas.sh` marca como rota cualquiera que no arranque, e
imprime su error. *(mío)*

**Una batería abría un archivo por la ruta de una máquina** (`$HOME/t/…`). Donde
ese archivo existía, probaba una copia congelada de la tienda; donde no,
reventaba entera. Junto con el punto anterior, es lo que tapó durante semanas el
fallo del nombre del comercio. → Se abre el archivo que las pruebas regeneran al
lado, en cada corrida, desde la página de verdad. *(mío)*

**Otra copia congelada, antes:** `pruebas/local.html` llevaba días sin
regenerarse y dos baterías estaban verdes contra una tienda que ya no existía
—con URLs de Netlify y cupones en el archivo—. → Se regenera en cada corrida.
De las cuatro aserciones que fallaron al descongelarla, **se corrigieron las
aserciones, no el código**, con la razón escrita en cada una. *(mío)*

**«¿Cambió algo?» no veía los archivos nuevos, y tiró un despliegue a la basura
en verde.** El montaje horneó `catalogo.json` por primera vez y el paso que
decide si abrir el pull request dijo **«Nada cambió en la hoja ni en el Drive»**,
porque `git diff` **no ve los archivos sin seguimiento**. La corrida terminó en
verde, el archivo se perdió con el runner, y la tienda siguió pidiéndole el
catálogo a Google como si nada. Se descubrió mirando por qué no había rama
`montaje/desde-la-hoja` en el remoto. → `git add -A -- publicar/` primero y la
comparación contra el índice, con aserciones que prohíben volver a la forma
vieja. *(mío)*

> El fallo que funciona, otra vez — y esta vez **en la herramienta que existe
> justamente para no perder trabajo**. Un paso llamado «¿Cambió algo?» que
> contesta que no cuando apareció un archivo nuevo no está roto a medias: está
> contestando otra pregunta.

**El acta se congela antes de que llegue el último sello.** El mensaje de
WhatsApp salió con el envío correcto y `Validaciones` lo guardó en 0. El sello
espera 400 ms; `registrar` sale de inmediato al pulsar el botón, revalida por su
cuenta y marca el pedido como registrado; cuando llega el sello nuevo, el
escritor del acta lo descarta porque «ya está registrado». **Reproducido en el
emulador con los números exactos del pedido `M4467`.** El dinero queda bien
—`Pedidos` cobra el total correcto— pero el acta, que es la prueba de cuánto
valía el pedido cuando se envió y el detector de discrepancias, queda mintiendo.
La protección del congelamiento es correcta; lo que está mal es **cuándo** se
activa. → **S1-13**: que `registrarPedido()` escriba el acta con su propia
revalidación, que es la autorizada, y solo después marque el registro. *(mío)*

> Lo encontró una pregunta del terreno que yo llevaba tres vueltas contestando
> con conjeturas. El código no se resistía: bastó con correrlo.

**`Number(celda) || 0` convierte «no se pudo leer» en «es gratis».** El maestro
lee así el precio, el stock, el valor del envío, el mínimo del cupón y sus usos
máximos. Si el comerciante escribe `$9.000` o `9,000` —lo más natural del mundo
en una hoja de cálculo— `Number()` da `NaN` y `|| 0` lo vuelve cero: producto
gratis, envío gratis, cupón sin mínimo, y cupón sin tope (porque `0` usos
máximos significa **sin tope**). Las cuatro consecuencias empujan contra el
comerciante y **ninguna falla**. Apareció tirando del hilo de un envío en 0 en
el pedido `M4467`. → Sale como **S1-10**: distinguir *vacío* de *ilegible*, y
que lo ilegible grite por los tres canales que ya existen. *(mío, latente desde
el principio)*

**El guardia dejaba pasar el catálogo y el `git add` no lo recogía: seis días
vendiendo un producto dado de baja.** El flujo `fotos` publica dos cosas —las
fotos y el catálogo horneado— y esa lista estaba escrita **dos veces**: el paso
que comprueba que no se cuele nada más permitía `publicar/fotos/` *y*
`publicar/catalogo.json`; el paso que hace el commit hacía `git add
publicar/fotos/` a secas. Mientras el comercio solo subió fotos, las dos listas
decían lo mismo. El día que dio de baja un producto —un cambio que **solo** toca
el catálogo— el guardia dijo «adelante», el índice quedó vacío, `git commit`
salió con código 1 y la corrida murió con `no changes added to commit`.

Un solo defecto, tres síntomas que parecían tres problemas: el producto inactivo
seguía a la venta, la página seguía sirviendo el catálogo de la semana pasada, y
las fotos `pan-1`/`pan-2` —que sí estaban descargadas y commiteadas— no se veían,
porque **lo que nombra a una foto es el catálogo**, y el catálogo no llegaba.
Las ventas seguían bien, y eso fue lo que retrasó el diagnóstico: el pedido pasa
por el maestro en vivo, no por el archivo horneado. → Una sola lista, `PUBLICA`,
en el `env` del job, leída por los dos pasos; `git add -A` para que un borrado en
el Drive también entre; y un índice vacío se explica en vez de salir como un
error de git. *(mío)*

> El error que se veía en Actions era `no changes added to commit`, que manda a
> depurar git — el único de los tres que había hecho exactamente su trabajo.
> Patrón 2, y el más caro hasta ahora: no falló nada que el comerciante pudiera
> ver, salvo lo único que él mira, que es su tienda.

---

## 🟠 Graves

**El repositorio semilla nunca pasó por su propio runbook.** El montaje falló
tres veces seguidas al abrir el pull request, con todo lo demás en verde. La
causa estaba **escrita desde hacía semanas** en `RUNBOOK.md`, bloque B:

> Settings → Actions → General → Workflow permissions → *Allow GitHub Actions to
> create and approve pull requests* ✔
> Sin esa casilla, `montaje` corre entero, funciona, y falla en la última línea
> al abrir el pull request.

Predicción exacta del síntoma. Pero ese bloque es el de **crear una tienda
nueva**, y `organico` es el primero: existía antes que el runbook, así que nunca
se le aplicó. GitHub lo dice en una anotación al pie —*«GitHub Actions is not
permitted to create or approve pull requests»*— que solo ve quien sabe que
existe. → Casilla marcada, y el flujo lo explica ahora en su propio resumen
cuando pasa. *(mío)*

> **Es el patrón 4 al revés.** Una prueba que solo sabe ver la primera tienda no
> prueba el producto; un runbook que solo sabe ver las tiendas nuevas **no cubre
> la primera** — que es justamente donde se prueba todo. La lista de la tienda
> cero hay que correrla contra la tienda cero.


**El maestro se inventaba su propia dirección.** Convertía la URL `/dev` en
`/exec` reemplazando texto, y **los dos identificadores son distintos**: el stub
quedaba apuntando a una URL que no existe y Google devolvía una página de error
en vez de datos. → El maestro aprende su dirección real la primera vez que
alguien abre la URL publicada, y la recuerda.
**Mi primer diagnóstico fue equivocado** —dije que la implementación había
quedado privada— y lo corregiste probando desde el celular con datos. *(mío)*

**Dependencia circular.** La herramienta que arregla el `HOJA_ID` se lo
preguntaba al maestro, pero todas las puertas abrían la hoja para contestar: un
maestro sin hoja no podía decir ni cuál era su hoja. → Una puerta `identidad`
que contesta sin abrirla. *(mío)*

**Publicar el maestro no corría en Windows.** Era un script de bash, y npm los
ejecuta por `cmd.exe`: `"." no se reconoce como un comando`. Era la única
herramienta que no estaba en Node, y fue la que se rompió. → Reescrita en Node.
*(mío)*

**«Falta clasp» con clasp instalado.** En Windows npm instala `clasp.cmd`, y
Node desde la 18.20 no lo lanza sin shell; `clasp` pelado tampoco existe. Los
dos caminos fallan. Y peor: yo trataba **cualquier** fallo como "no está
instalado", así que reinstalarlo no podía ayudar. → Se pasa por el shell, y "no
está instalado" se distingue de "falló". *(mío)*

**Dos herramientas se cargaban, no ejecutaban nada, y salían con código 0.** La
comparación `import.meta.url === \`file://${process.argv[1]}\`` nunca coincide en
Windows, donde la ruta llega como `D:\CoWork\…`. Un fallo silencioso que parece
éxito. Lo delató un pantallazo tuyo sin salida. → `pathToFileURL`, y una prueba
que las ejecuta como subprocesos. *(mío)*

**Una URL pegada en un formulario tumbaba el alta entera**
(`unsupported protocol scheme`): la API pide `dueño/repositorio` y la barra de
direcciones da una URL. → Se normaliza antes de tocar la API. **Pedirle rigor a
quien llena el formulario es la solución que no funciona.** *(mío)*

**El panel se comía la primera tienda.** `filas()` ya excluía el encabezado y le
añadí un `.slice(1)` encima. Con una sola tienda registrada, se las comía todas.
→ Quitado, y la prueba usa una sola tienda a propósito. *(mío)*

**clasp 3 renombró sus comandos** (`deployments` → `list-deployments`). → Se
detecta la versión instalada y se usan los de esa. *(del terreno)*

**Falta una casilla y el montaje falla en la última línea.** Sin *Allow GitHub
Actions to create and approve pull requests*, el flujo corre entero, funciona, y
muere al abrir el pull request. → Está en el runbook, y el alta la marca sola.
*(del terreno)*
*(Hoy: `RUNBOOK.md` ya no existe; lo cuenta `DESPLIEGUE.md`, y `alta` la sigue
marcando sola.)*

**El documento mandaba a sacar el stub de donde no sale.** `ACTUALIZAR-UNA-TIENDA.md` y `SPRINT-0.md` decían «Menú de la hoja → *Generar configuración* → copiar el stub». Esa opción produce los dos bloques del `index.html`, que es otra cosa. Seguiste la instrucción, pegaste lo que no era, y Apps Script contestó **«no hay cambios que guardar»**: el menú se quedó viejo sin una sola señal de error. → Los dos documentos mandan ahora a ejecutar `generarStub` en el editor del **maestro**, dicen cómo se reconoce el stub bueno (`var NEGOCIO = '…';`) y qué significa que no haya cambios que guardar. Una aserción recorre `/docs` y falla si algún documento vuelve a juntar «stub» con «Generar configuración». *(mío)*

> El fondo del error: el stub es el código que **dibuja** ese menú. Mandar a arreglarlo desde el menú es pedirle a la tienda que se repare con lo que está roto.

**Y la comprobación que di era la misma trampa de siempre.** Dije «recarga la hoja: el menú se llama como el comercio». En la tienda que **se llama Orgánico** eso es idéntico antes y después: el rótulo pasó de la palabra escrita a mano a una variable que vale esa misma palabra, y las cinco opciones no se tocaron. Buscaste opciones nuevas que son del **Sprint 5** y todavía no existen. → Los dos documentos avisan de que el menú no cambia, y dan la única señal que sirve: `var NEGOCIO` en el editor de la hoja. Es el **segundo** caso de comprobación que da el mismo resultado antes y después —el primero fue la versión del Diagnóstico— y por eso pasa a los patrones. *(mío)*

---

## 🟡 Medios

**Una nota dentro de `devDependencies`.** Puse `"_comentario_sharp": "…"` para
explicar por qué hacía falta sharp en las pruebas, y `npm install` se negó:
*«name cannot start with an underscore»*. Cada clave de ahí es un **nombre de
paquete** para npm, no un sitio donde dejar una nota. El flujo `pruebas` quedó
rojo en el primer paso. → La nota se movió a un campo de primer nivel, que npm
ignora, y hay una aserción que valida el nombre de cada clave. *(mío)*

> **Lo que importa no es el error, es por qué no lo vi.** Corrí la suite entera
> antes de empujar y salió 1049/1049 — con `node_modules` ya instalado. El paso
> que fallaba, **instalar**, nunca se ejecutó. Comprobar con el trabajo ya hecho
> no comprueba el trabajo. Desde entonces, un cambio en `package.json` se prueba
> borrando `node_modules` primero.


**Dos menús «Diagnóstico», los dos diciendo «Versión de este código».**
Comparaste la del panel con la del maestro y parecía que el despliegue había
fallado. → «Versión del MAESTRO de esta tienda» y «Versión del PANEL». *(mío)*

**`todas.sh` solo imprimía el marcador.** Desde Actions el log es lo único que
hay, y `822/823` no dice qué se cayó. → Imprime las líneas `FALLA` debajo.
*(mío)*

**Cinco baterías daban por hecho que la tienda se llamaba «Orgánico».** Una
prueba así solo sabe ver la primera tienda: la segunda falla y nadie entiende
por qué. → Un comercio de prueba con nombre propio, y una aserción que prohíbe
la marca. *(mío)*

**Una tubería `| tee` sin `pipefail` se tragaba el fallo**: el shell por defecto
de Actions es `bash -e`, sin pipefail, así que manda el código de `tee`. Estaba
en dos flujos. *(mío)*

**El runbook hablaba de dos campos y el formulario tenía cinco**, dos de ellos
pidiendo datos que en ese punto del despliegue todavía no existen. → Una tabla
con todos, y una aserción que compara las dos listas. *(mío)*

**Una función `pesos()` duplicada** en el maestro; ganaba la última por
hoisting. Latente, nunca se manifestó. *(mío)*

**Un experimento a medias.** El menú de prueba del stub nombraba funciones que
nunca escribí, así que hacer clic no podía funcionar **nunca**. → Retirado una
vez medido lo que había que medir. *(mío)*

---

## ⚪ Menores

- **«758 aserciones» escrito a mano en seis sitios**, cuando ya iban por 900.
  → Se dijo «las 19 baterías», que tampoco duró: al llegar la 20 hubo que
    corregir seis archivos. Ahora se dice «todas las baterías», y una aserción
    impide volver a escribir el número.
- **`panel.gs` aparecía dos veces** en la tabla del README.
- **Un emoji al principio del mensaje** rompía la caja de escritura de WhatsApp.
  → Al final. *(del terreno)*

---

## Afirmaciones mías que resultaron falsas

Van aparte porque no son fallos de código: son cosas que dije con seguridad y
eran mentira. Todas las rectificaste tú.

1. **«Actions no puede correr las automatizaciones porque haría falta un
   llavero de todas las tiendas».** Falso: con un repositorio por tienda, los
   secretos son por repositorio y no hay llavero común.
2. **«El 403 de GitHub sin token es ocasional».** Falso: el cubo de 60 peticiones
   por hora es **por IP**, y Apps Script comparte IPs, así que está
   esencialmente siempre agotado.
3. **Escribí en la documentación una conclusión «medida» sobre el stub** a
   partir de tu primer reporte, y era incorrecta. Rectificaste —«sí funcionó el
   sin stub desde el maestro, salieron los dos menús»— y corregí el documento.
4. **«Menú de la hoja → Generar configuración → copiar el stub».** Falso, y lo
   dije dos veces: en la conversación y en dos documentos. El stub solo lo
   imprime `generarStub` —y `instalar()` al final— en el editor del maestro.
   Lo descubriste al pegar y no encontrar cambios que guardar.
5. **«El montaje falló porque se corrió sin la casilla del maestro»** (entrada
   50). Probablemente falso: con la casilla marcada fallaba igual, porque el
   index se horneaba con lo que el sondeo había preguntado antes de publicar
   el maestro. Lo dije sin mirar el orden de los pasos. Ver la entrada 56.

---

## Cambios de rumbo

No son errores. Son decisiones que se revirtieron con información nueva, y
conviene que quede por qué.

| De | A | Por qué |
|---|---|---|
| La configuración en la hoja | Un formulario de Actions con seis campos | Parecía menos trabajo manual |
| **De vuelta a la hoja** | | Un formulario era más frágil que una hoja de cálculo, que es lo que este producto ya sabe hacer bien |
| Dos flujos: `montaje` y `maestro` | Uno solo, con el orden fijo | Dispararlos en el orden equivocado es fácil y silencioso: publicar el maestro después de escribir la página deja la tienda avisando que la hoja responde otra versión |
| El alta dentro de la plantilla | Un repositorio de servicio | Pedir el nombre de un repositorio nuevo desde dentro del que ya es el nuevo no tiene sentido, y el token que crea repositorios no puede vivir en algo de lo que se sacan copias |
| El alta, aparcada | *(Hoy: el alta vive en `tiendas` › `alta` y `conectar`; bitácora 69 y 70.)* | Cada vuelta cuesta crear un repositorio de verdad para descubrir que un campo se llenó distinto. Con dos tiendas, a mano cuesta menos |
| «Orgánico» como nombre del producto | Orgánico es **un comercio** | Ningún nombre de comercio puede estar escrito en el código, ni siquiera en el menú de la hoja |
| Montar la tienda dos ya | Estabilizar la semilla primero | Montar contra una semilla que todavía se mueve es probar dos cosas a la vez sin saber cuál falló |
| Reiniciar en 1.0.0 | Saltar a 2.0.0 | Una versión menor que la anterior rompe el orden, y la regla del proyecto pedía mayor: una tienda vieja tiene que tocar la hoja y el maestro |

---

## Lo que el terreno enseñó, y no fue culpa de nadie

- **Los disparadores instalables no salvan al stub.** Desde el motor standalone
  se puede dibujar el menú en la hoja de otro, pero al hacer clic falla con
  `PERMISSION_DENIED`: la frontera es la **propiedad del proyecto**, no la
  autorización. Se midió, y el stub se queda.
- **Las 30 ejecuciones simultáneas de Apps Script no suben pagando.** Es el
  límite que decidió que cada tienda tenga su propia cuenta de Google.
- **Un pull request abierto con el `GITHUB_TOKEN` no dispara otros flujos.** Por
  eso las pruebas corren dentro del flujo que abre el PR y no después.
- **Las dos URLs de un web app, `/dev` y `/exec`, llevan identificadores
  distintos.** No se puede deducir una de la otra.

---

## Los ocho patrones que se repitieron

Si hay algo que llevarse de todo lo anterior, es esto.

*(Hoy la lista viva es «Lo aprendido», arriba: estos ocho son P1 a P8, con el
mismo número.)*

**1 · El fallo que funciona es el caro.** Los diez críticos tienen algo en
común: **ninguno falló**. El maestro sin hoja servía un inventario de respaldo;
el celular de fábrica entregaba los pedidos a alguien; la batería rota sumaba
0/0 y daba verde; el archivo congelado pasaba las pruebas. Todo lo que "cae a un
respaldo" tiene que gritar, o el respaldo se convierte en el estado normal.

**2 · Dos implementaciones del mismo procedimiento: una siempre se queda
atrás.** El flujo con su copia del montaje, el número de aserciones escrito a
mano, el runbook contra el formulario, la lista de lo que falta contra la
condición del botón. La regla que salió: **una sola fuente, y lo demás se
deriva de ella.**

**3 · Windows.** Tres de los cuatro fallos de herramientas eran específicos de
Windows, y **ninguna prueba corriendo en Linux podía verlos**. Sigue sin
resolverse: correr las baterías también en Windows está ofrecido y no aceptado.

**4 · Una prueba que solo sabe ver la primera tienda no prueba el producto.**
El producto es una tienda por comercio. Cinco baterías comparaban contra el
nombre de la primera; se descubrió montando la segunda, que es tarde.

**5 · Una comprobación mal elegida es peor que ninguna.** Tres veces, y las
tres las propuse yo.

Las dos primeras **daban lo mismo antes y después**: «mira que el Diagnóstico
diga la versión» —cuando `VERSION` no había cambiado a propósito— y «recarga la
hoja: el menú se llama como el comercio» —en la tienda que se llama como el
comercio—. El técnico quedó buscando una diferencia que no podía existir.

La tercera fue más disimulada, porque **sí produjo una diferencia**: «bloquea
`script.google.com` en DevTools y mira si la tienda sigue vendiendo». La tienda
cargó el inventario en segundos y parecía la prueba superada. No lo era: Apps
Script contesta **302** y redirige a `script.googleusercontent.com`, otro
dominio, que no estaba bloqueado. El catálogo nunca dejó de llegar. La prueba
midió una tienda con el maestro **vivo** y la dio por muerta.

La regla, en dos partes:

1. Antes de dar una comprobación, preguntarse **qué respondería con el cambio
   sin aplicar**. Si es lo mismo, no es una comprobación.
2. Y cuando sí distingue, preguntarse **qué está distinguiendo de verdad**. Una
   diferencia observable no es prueba de la hipótesis: es prueba de que algo
   cambió.

> El dato técnico, que vale por sí solo: **la puerta `/exec` de una aplicación
> web de Apps Script responde 302 hacia `script.googleusercontent.com/macros/echo`,
> y los datos salen de ahí.** Cualquier lista —de bloqueo, de permisos, una CSP—
> que nombre solo `script.google.com` está incompleta. Este proyecto ya lo sabía
> donde importaba: la CSP del `<head>` nombra los dos en `connect-src`. Lo que
> faltaba era saberlo también al escribir una prueba.

**6 · Lo que solo cubre a los que vienen después, deja fuera al primero.** La
prueba que solo conocía la primera tienda no veía la segunda; el runbook que
solo describe tiendas nuevas no cubre la primera. Es el mismo hueco por los dos
lados: **lo que se escribe para "los demás" se olvida de quien ya estaba**, y
quien ya estaba es donde se prueba todo.

---

**7 · Una caché convierte un chequeo en un recuerdo.** Dos veces en la misma
tarde, y las dos en el diagnóstico.

El informe llamaba a `catalogoPublico()`, que **cachea un minuto**. Con la caché
caliente, la lista de celdas ilegibles llegaba vacía: el informe daba todo por
bueno **mientras un precio llevaba una hora sin poderse leer**. Es el patrón 5
otra vez —una comprobación que contesta lo mismo con el problema puesto— pero
por un camino que no se ve leyendo la función: se ve leyendo lo que la función
llama.

La segunda fue mía y recién escrita: la caché de la respuesta de la tienda
guardaba **también los fallos**, y eso convertía un tropiezo de un segundo en el
veredicto de toda la ejecución. La cazó una aserción vieja, no una relectura.

La regla: **un instrumento no lee por la caché.** Lo que mide el estado actual
—un diagnóstico, una validación, una comprobación— lee la fuente. Y una caché
guarda respuestas, no fracasos: recordar «no se pudo» deja la función mintiendo
aunque el mundo ya conteste.

---

**8 · El reloj es una entrada que nadie declara.** El 10 de septiembre de 2026,
`tablero.js` amaneció en rojo sin que nadie hubiera tocado una línea. Llevaba
una semana en verde.

No era el producto: era la siembra. Un pedido fechado *«hace 40 días»*, con el
comentario *«fuera de todas las listas de 30 días»*. De las de 30 días, sí. De
la comparación contra el **mes pasado**, no: restar 40 días desde el día 10 cae
en el día 1 del mes anterior, que está dentro del tramo comparable. Sus 200.000
se sumaban a la base y seis aserciones se caían.

Esa batería **solo pasaba los primeros nueve días de cada mes**, y llevaba así
desde que se escribió. Nunca lo supimos porque todo el trabajo cayó entre el 4 y
el 9.

Al buscarle las vueltas aparecieron tres más, todas del mismo tipo: el ranking
de más vendidos se daba la vuelta el 1 y el 2 de marzo, porque febrero cabe
entero dentro de los 30 días; el correo del día 1 no encontraba un «día anterior
dentro del mes»; y un pedido fechado «ayer» el día 1 es del mes pasado, así que
la aserción que exigía que NO saliera en el CSV mensual **acusaba al producto de
un acierto**.

Y una trampa mía, recién puesta al arreglarlo: la primera corrección leía las
fechas del propio CSV. Eso no prueba qué filas salen, prueba **cómo se
serializa una fecha** — y la serialización cambiaba de mes a mes. Sustituí un
fallo de calendario por otro.

Tres reglas:

1. **Los meses se restan con `getMonth()`, no con días.** `new Date(a, m - 2, 15)`
   está fuera del mes pasado por construcción; `ahora - 40 días` está fuera
   *casi siempre*, que en una prueba es lo mismo que estar dentro.
2. **Si un escenario no puede existir ese día, se salta diciéndolo** — el día 1
   no hay un día anterior dentro del mes. Eso es distinto de saltárselo porque
   estorba: lo primero se anota, lo segundo se esconde.
3. **Una aserción no mide un formato si lo que quiere medir es una regla.** Se
   pregunta a la siembra qué filas deberían salir, y se comprueban esas.

Y una batería nueva, `calendario.js`, que corre las que miran el calendario
**fingiendo ser cada día de un año bisiesto** y exige el mismo marcador en
todos. Ninguna de las cuatro trampas se veía leyendo el código. Las cuatro se
veían corriéndolo otro día.

---

## Entradas numeradas

Desde la 9, una entrada por fallo o por decisión, en orden. El número es su
identificador: otras entradas, el código y los documentos las citan como
«bitácora N», así que no se renumera nunca. Las nuevas van al final, con la
plantilla de «Cómo escribir una entrada».

**9 · Dos cosas que hay que actualizar, y solo una tiene dueño.** El 14 de
septiembre de 2026, montando la tienda dos, todo estaba al día y la tienda
seguía abriendo con tomates.

El código se sincroniza de la semilla al repositorio de cada tienda.
`publicar/index.html` **no**, y con razón: no es código, es el archivo publicado
de ese comercio. Pero eso dejaba una actualización partida en dos, con la mitad
automatizada y la otra mitad en una línea de la guía —«traer el archivo nuevo al
repositorio de la tienda»— que alguien tenía que leer y hacer.

Lo que hace caro este fallo es que **no se ve**: la tienda quedó con los flujos,
la herramienta y las baterías de una versión, y la página de la anterior. Nada
está roto, nada avisa, el marcador sale verde. El síntoma aparece a tres pasos
de la causa, en el navegador de un comprador.

La regla: **si actualizar algo son dos cosas, la segunda se olvida.** No se
arregla escribiéndola mejor en el documento — se arregla haciendo que sea una
sola. Ahora el montaje se trae la página de la última versión de la semilla
antes de escribir encima lo de esa tienda, y el paso manual desapareció.
*(Hoy: ese paso se retiró al día siguiente —entrada 16—; la página llega con
`plantilla/`, que es de la semilla y viaja con cada actualización.)*

Y el corolario que conviene tener a mano al diseñar: **se puede reemplazar
entero lo que se genera entero.** Ese archivo se podía tirar y volver a traer
porque no queda en él un solo valor escrito a mano — el `<head>`, las
constantes, la paleta y el respaldo los escribe el montaje desde la hoja. El día
que alguien meta ahí un valor a mano, esta automatización se rompe en silencio.

---

**10 · Una comprobación que solo mira el principio del archivo no ve que el
archivo está cortado.** Recién escrita, y en el sitio donde más dolía.

El paso que trae la página de la semilla comprueba, antes de escribirla encima,
que lo descargado sea de verdad la plantilla: cuatro marcas que los pasos
siguientes van a buscar. Las cuatro viven en el primer tercio del archivo.
**Media descarga las traía todas**, pesaba sesenta mil bytes y pasaba la
revisión entera — justo el caso que esa revisión existe para atrapar.

Se vio porque la aserción que la probaba partía el archivo por la mitad y
esperaba un fallo que no llegó. Es el patrón 5 otra vez, y esta vez lo cazó una
prueba escrita el mismo día.

La regla: **para saber si algo llegó entero, hay que mirar el final.** La seña
que faltaba era `</html>`, que solo está si la descarga terminó. Vale para
cualquier cosa que se transfiera: el principio de un archivo no dice nada sobre
su tamaño.

---

**11 · Dos números que coinciden esconden dos pruebas que no prueban nada.**
Al escribir el catálogo de respaldo por tienda (4.20), dos baterías se pusieron
rojas. Las dos llevaban meses en verde. Ninguna de las dos había medido jamás lo
que decía su título.

- `cat.js` probaba el catálogo de respaldo poniendo el servidor en modo
  `caido`. `caido` tumba el registro y la validación, y **deja el catálogo
  vivo**: la sección medía una tienda con la hoja contestando con normalidad y
  la daba por muerta. El modo que hacía falta era `muerto`.
- `pag.js` esperaba a `pintado()`, que vuelve en cuanto la página dibuja algo —
  y lo primero que dibuja es el respaldo del archivo, antes de que llegue la
  hoja. Medía la paginación del archivo, no la de la hoja.

**Las dos pasaban por la misma razón: el respaldo del archivo tenía justo los
mismos ocho productos que la hoja emulada.** Esperar de más o de menos daba el
mismo número, y un modo o el otro daban el mismo número. Contestaban lo mismo
con el arreglo puesto y sin él.

El día en que el respaldo dejó de ser el de Orgánico, los dos números se
separaron y las dos hablaron.

La regla, que es una vuelta de tuerca del patrón 5: **cuando dos fuentes de un
dato tienen el mismo valor, ninguna prueba puede decir de cuál vino.** Si la
siembra y el archivo dicen lo mismo, hay que hacer que digan cosas distintas
antes de creerse una sola aserción.

---

**12 · Una guarda que acusa al producto de un acierto.** Al cerrar el 4.20 el
primer impulso fue calcar la guarda de la paleta (2.9.9): «ninguna batería de
navegador puede nombrar un producto de Orgánico». Marcó **diez** baterías.

Las diez tenían razón. Nombran tomates porque conducen la **hoja emulada**, que
es de fábrica y es idéntica en todas las tiendas. Lo que viaja por tienda es el
respaldo del archivo, no la hoja emulada — y esa diferencia una regla de texto
no la puede ver.

Se cambió por una batería, `respaldo.js`, que **monta una tienda que no es
Orgánico**, la sirve con la hoja muerta y mira qué se pinta. Lleva dentro su
propia prueba de que distingue: con el arreglo quitado, se cae.

La regla: **una guarda que produce falsos positivos se desactiva sola** — la
gente aprende a saltársela, y el día que acierta nadie la mira. Antes de poner
una regla de texto, hay que preguntarse si lo que quiere prohibir se puede
nombrar sin tocar lo que está bien. Cuando no se puede, no es una regla: es una
prueba, y hay que escribirla.

---

**13 · Un rojo que pide arreglar algo que no está roto.** El primer push del
4.20 al repositorio de la tienda salió rojo: `respaldo.js` 4/10 y `config.js`
con dos caídas, todas diciendo «Orgánico».

El código estaba bien. Lo que pasaba es que ese repositorio tenía el
`index.html` de antes —ver el 9— y las baterías estaban exigiendo algo que allí
**todavía no podía ser cierto**. El rojo mandaba a buscar un fallo inexistente:
el mismo error que cerró la tanda anterior, ahora del lado de las pruebas.

La regla ya estaba escrita en el patrón 8 y hubo que aplicarla en otro sitio:
**un escenario que hoy no puede existir se salta DICIÉNDOLO.** Las dos baterías
lo detectan y lo dicen, con los pasos que faltan.

Y la media vuelta que hacía falta para que eso no se convierta en lo otro:
`todas.sh` imprime los saltos **aunque el marcador salga verde**. Un salto que
solo existe dentro del archivo de salida que nadie abre es un salto escondido, y
de ahí a una batería que no corre desde hace tres meses hay un paso.

---

**14 · El banco de pruebas era dos comercios a la vez.** El 14 de septiembre de
2026, el primer montaje de la tienda dos con la versión nueva reventó tres
baterías, y ninguna de las tres hablaba de lo que le pasaba.

- `val.js` murió con «Cannot read properties of undefined (reading 'stock')».
  Hacía `agregar('chonto')` **a propósito antes de que llegara el catálogo** —la
  sección mira la pantalla mientras la hoja tarda—, y lo que hay en ese momento
  es el catálogo de respaldo DEL ARCHIVO. En el archivo de una tienda de
  cosméticos no existe ningún `chonto`.
- `config.js` leía «Orgánico» sin red en el repositorio de otro comercio.
- `montaje.js` exigía `#D0211C` en una tienda cuya paleta ya era la suya — el
  patrón 4 dentro de la batería que vigila el patrón 4.

La causa era una sola: desde que el montaje escribe el catálogo de respaldo, el
`index.html` del repositorio es **de un comercio** y la hoja emulada de `gas.js`
es **de otro**. El banco estaba probando una tienda que no existe, y los
síntomas caían a tres pasos de ahí.

La regla: **el archivo y los datos que se prueban juntos tienen que ser del
mismo comercio.** El arreglo no fue borrar el respaldo del arnés —eso dejaría
sin probar justo el camino nuevo— sino reescribirlo con el catálogo de la hoja
emulada, con la misma herramienta que usa el flujo. Una línea en `todas.sh`, y
las tres baterías volvieron a medir lo que dice su título.

Y el corolario para el diseño: **cuando una entrada que era constante se vuelve
variable, hay que buscar quién la daba por constante.** El respaldo llevaba
siendo el mismo en todos los repositorios desde que existía. El día que dejó de
serlo, salieron diez baterías que se apoyaban en eso sin saberlo.

---

**15 · Declarar no es aplicar.** La primera comprobación de «¿esta tienda ya
tiene la página del 4.20?» miraba `typeof CONFIG_SEMILLA`.

Daba verde en los dos casos. Un archivo **anterior** al 4.20 acaba declarando
`CONFIG_SEMILLA` igual —se la escribe el montaje, que sí está al día— y no la
aplica nunca, porque la línea que la aplica no está en él. La constante existía;
la página seguía pintando el comercio de la plantilla.

La regla: **se comprueba el efecto, no la presencia.** La página pone ahora una
bandera después de aplicar la configuración, y esa bandera solo existe si el
trabajo se hizo. Es el patrón 5 en su forma más barata de cometer: mirar si algo
está escrito en vez de mirar si algo pasó.

---

**16 · Resolver el problema de la etapa siguiente cuesta el doble.** El 14 de
septiembre de 2026 se automatizó que cada tienda se trajera la página de la
última versión de la semilla. El código estaba bien y las baterías lo probaban.
Falló en el primer montaje real con un 404, y se retiró al día siguiente.

El 404 —las versiones de la semilla no son públicas— era el síntoma barato. El
caro fue otro: **el problema que eso resolvía no existe todavía.** Hoy una
tienda nueva se crea *a partir de la plantilla* y nace con la página dentro, así
que lo que esté bien en la semilla llega solo. Actualizar una tienda **ya
creada** es un problema real, pero llega cuando haya tiendas viejas — y hasta
entonces, aquel paso solo añadía un camino más que se podía caer, dentro del
flujo del que depende cada despliegue.

Lo que lo hizo fácil de cometer es que la petición sonaba igual: «que no haya
pasos manuales». La había, y era cierta — pero en la **entrega de una tienda
nueva**, no en la actualización de las que ya existen. Dos problemas parecidos,
uno urgente y otro no, y la solución del segundo se coló en el camino del
primero.

La regla: **antes de automatizar algo, preguntar cuántas veces va a pasar este
mes.** Si la respuesta es cero, lo que se está construyendo no es una mejora:
es una superficie de fallo con un plazo de caducidad. Anotarlo en la hoja de
ruta es más barato, y ahí no se cae.

Y la mitad que sí se quedó, porque valía por sí sola: **lo que se genera entero
se puede reemplazar entero**, y para saber si algo llegó completo hay que mirar
el final —las marcas del principio las trae media descarga—. Las dos están
escritas en el 4.18 para el día que toque.

---

**17 · El único botón que el comerciante puede apretar no llevaba lo que él
cambia.** El 15 de septiembre de 2026, recién montada la tienda tres, el
operador cambió el título del sitio en la hoja y apretó **Publicar ahora**. Salió
el mensaje de siempre —«tu tienda se está actualizando… se revisan los datos»—
y no cambió nada. Ningún error, en ninguna parte.

«Publicar ahora» dispara el flujo `fotos`, y lo que ese flujo publica está
acotado a propósito: `publicar/fotos` y `publicar/catalogo.json`. Es la lista
que lo deja fusionar sin una persona en medio. Pero **todo lo que se escribe en
la pestaña Configuración** —el título del sitio, el nombre del comercio, los
colores, los textos de la portada, el WhatsApp— no vive en ninguna de esas dos
rutas: vive en el `<head>` y en las constantes del `index.html`, que solo
escribía `montaje`.

Así que el comerciante tenía un botón que le prometía «se revisan los datos» y
que, para la mitad de los datos, no hacía nada. El patrón 1 otra vez, y en el
peor sitio: en la única palanca de la persona que no puede entrar a GitHub.

La regla: **lo que el producto le ofrece cambiar a alguien, tiene que llegar
por el camino que esa persona puede recorrer.** No basta con que exista un
flujo que lo haga; tiene que estar en el que ella dispara. Ahora `fotos`
escribe el `<head>`, mira la Configuración al decidir si hay novedades, y repone
el respaldo — y la lista de lo publicable sigue siendo una sola.

Y el segundo hallazgo de la misma tarde: el `montaje` abría un pull request y
esperaba a que alguien lo aprobara. Esa exigencia tenía sentido mientras el
montaje traía la PÁGINA de la semilla —subir de versión a una tienda es una
decisión—, y ese paso se había retirado el día anterior. Quedó la ceremonia sin
el motivo. **Una guarda cuyo motivo desapareció no se queda «por si acaso»: se
quita, o se convierte en un trámite que la gente aprende a saltarse.**

---

**18 · La tercera vez que la misma lista estaba escrita dos veces, en el mismo
archivo.** El 15 de septiembre de 2026, montada la tienda tres, el operador
cambió el título del sitio, apretó «Publicar ahora», el flujo dijo que había
novedades, publicó las fotos y el catálogo — y el título no llegó.

El día anterior se había ampliado `PUBLICA` para que este flujo publicara
también `publicar/index.html`, que es donde vive el título. Y publicaba. Lo que
pasaba estaba unas líneas antes: para rehacer la rama sobre el `main` de ese
instante, el flujo guarda los archivos generados, hace `git reset --hard` y los
repone. Esa copia **nombraba dos de las tres rutas a mano**:

```
cp -r publicar/fotos      "$guardado/publicar/"
cp publicar/catalogo.json "$guardado/publicar/"
```

El `reset --hard` se llevaba por delante el `index.html` que el paso anterior
acababa de escribir desde la hoja. Todo lo demás funcionaba: el paso que decide
si hay novedades lo miraba, el `git add` lo incluía, las baterías corrían sobre
él. Solo que para entonces ya era el de antes.

Es el **patrón 2 por tercera vez en este mismo archivo**, y las tres veces con
la misma forma: alguien amplía la lista de arriba y no ve la copia de más abajo.
La cura tampoco cambia: guardar y reponer recorriendo `$PUBLICA`.

La regla, afinada: **cuando un archivo ya tuvo dos veces el mismo fallo, la
tercera no se arregla con cuidado.** Se busca a mano toda ruta escrita en ese
archivo que debería salir de la lista, y se quita. Ahora hay una aserción por
cada uno de los tres sitios.

---

**19 · Una condición de trabajo no puede saltarse una corrida que está
retenida.** El mismo día, en el mismo pull request.

`pruebas.yml` lleva desde el Sprint 5 una condición para no repetirse sobre el
pull request que abre `fotos`, escrita precisamente porque *«esa corrida queda
esperando la aprobación de un mantenedor, caduca, y deja una X roja en un pull
request que ya se fusionó bien»*. La condición está bien escrita y la rama
coincide.

Y no sirve. GitHub **retiene la corrida entera** esperando aprobación, y eso
pasa antes de que se evalúe ninguna condición de ningún trabajo. El `if:` nunca
llega a ejecutarse. Llevábamos semanas creyendo que ese caso estaba cubierto
porque la condición existía, sin haber comprobado nunca que hiciera algo — el
patrón 5 aplicado a una condición en vez de a una aserción.

Lo que sí lo resuelve es no abrir el pull request: cuando el flujo va a publicar
solo, empuja directo a `main`. Las baterías ya corrieron enteras sobre esos
mismos bytes, así que el pull request no añadía una sola comprobación; solo
añadía una corrida retenida y una marca roja que no significaba nada.

La regla: **una guarda que nunca ha visto el caso que dice cubrir no está
comprobada, está redactada.** Vale para un `if:` de un flujo igual que para una
aserción. Si no se puede provocar el caso, al menos hay que dejar escrito que
no se ha visto nunca.

---

**20 · Un paso que hace cuatro cosas falla entero por la que menos importa.**
El 15 de septiembre de 2026, la tienda tres. El comercio cambió el título de su
tienda y apretó «Publicar ahora». El flujo hizo su trabajo: escribió el `<head>`
con el título nuevo, comprobó que el catálogo estaba al día, repuso el catálogo
de respaldo. Y murió con código 1, sin publicar nada, porque **una foto del
Drive contestó 404**.

El paso agrupaba cuatro herramientas bajo un mismo `estado=$?`, así que
cualquiera de las cuatro tumbaba las otras tres. Visto desde el comerciante:
cambió su título, apretó el botón, y lo que llegó fue una cruz roja.

La regla: **no todo lo que falla en un paso vale lo mismo.** Un `<head>` a
medias es una tienda publicada y muda — eso sí para. Una foto que no baja no
invalida lo que el comercio escribió en su hoja: se publica lo demás y **se dice
en grande**, en el resumen y en el commit. Un fallo que se traga en silencio es
peor que uno que para; uno que para por lo que no importa, también.

---

**21 · Un diagnóstico que contradice lo que acaba de pasar delante.** El mismo
404, mismo día.

El mensaje decía, siempre: *«El maestro respondió 404. Casi siempre es que la
implementación quedó con acceso Solo yo»*. Y salió **después** de que ese mismo
maestro, en esa misma corrida, hubiera contestado `identidad`, `bloques` y
`fotos`. Con acceso «Solo yo» no habría contestado ninguna de las tres.

El operador se fue a revisar una implementación que estaba perfectamente bien.
Es la tercera vez en dos días que un error apunta al sitio equivocado, y esta
tiene un agravante: **el propio registro, dos líneas más arriba, desmentía el
consejo.**

La regla: **un mensaje de error puede mirar lo que ya pasó en esta corrida, y
debe.** Ahora se recuerda qué acciones contestó cada maestro, y el 404 dice a
cuál le contestó, descarta explícitamente lo que ya está descartado, y ofrece la
causa que sí explica un 404 en una sola acción: Apps Script sirve los datos
desde `script.googleusercontent.com` por una redirección que caduca. Cuando no
ha contestado nada todavía, el consejo de siempre vuelve a ser el bueno.

Dicho corto: **si el programa tiene delante la prueba de que su consejo es
falso, no tiene excusa para darlo.**

---

**22 · Lo que ninguna batería podía probar.** El 15 de septiembre de 2026 se
hizo, por primera vez, un pedido completo con un teléfono que no era el del
comercio: pedido → WhatsApp → respuesta automática → transferencia → *Pagado* en
la hoja → el stock baja. Salió bien.

No hay nada que arreglar aquí, y por eso mismo vale anotarlo. **1372 aserciones
prueban las piezas; esta prueba probó la costura.** Y la costura es donde vive
todo lo que este proyecto ha aprendido a temer: el paso que funciona pero llega
al sitio equivocado, el que se salta en silencio, el que contesta lo mismo con
el fallo puesto y sin él.

La regla, que cierra la lista y no contradice ninguna de las anteriores: **una
suite verde es una hipótesis, no un hecho.** Dice que cada pieza hace lo que
alguien escribió que hiciera. No dice que el comprador pueda pagar. Eso solo lo
dice un comprador pagando, y hay que ir a buscarlo — una vez, a propósito, antes
de que lo haga uno de verdad.

---

**23 · Un documento no lanza una excepción cuando miente.** El 16 de septiembre
de 2026, al revisar toda la documentación para el cierre de la 3.0.0, aparecieron
cinco guías de despliegue distintas — `RUNBOOK.md`, `DESPLIEGUE-CLIENTE.md`,
`MONTAJE.md`, `INSTALAR.md`, `FOTOS.md` — y dos manuales largos para el
comerciante, cada uno contando una versión distinta de la misma tienda. Tres
enseñaban a subir fotos a Cloudinary cuando llevan meses yendo a Drive. Tres
decían que el catálogo «se lee en vivo, cambias la celda y en un minuto está en
línea» cuando se hornea desde el Sprint 2 y necesita **Publicar ahora**. Uno
llamaba «Confirmado» a un estado que se renombró a «Pagado» hace varias
versiones. Un ADR de `DECISIONES.md` describía el catálogo en vivo como el
presente y lo estático como una condición futura, cuando la migración ya había
pasado. Ninguno de estos siete documentos daba un error al abrirlo. Todos se
veían terminados, con capturas, con tablas, con el mismo tono seguro que un
documento correcto.

Ya se había visto esta forma exacta de fallo — RUNBOOK.md enseñando un menú
derogado (patrón 2, primera vez), el manual del dueño con el mismo error
(patrón 2, tercera). Lo que este día enseñó es la escala: no era un documento
atrasado, era **la mayoría de los documentos que explican cómo se usa el
producto**, acumulados sin que nadie los borrara cuando quedaron cubiertos por
uno mejor. Cada aviso de "esto está atrasado, ver DESPLIEGUE.md" que se le fue
agregando encima era honesto y no arreglaba nada: el documento seguía ahí,
segundos de una búsqueda, dispuesto a que alguien lo leyera primero.

La regla: **un documento redundante no se marca como atrasado, se borra.** Un
aviso en la cabecera es una curita sobre una fuente que sigue mintiendo debajo;
borrar es la única corrección que no se puede volver a saltar por accidente.
Antes de borrar, se rescata lo que seguía siendo cierto y no vivía en ningún
otro lado —una advertencia sobre `wrangler.jsonc`, una tabla de fallos comunes,
una decisión de diseño deliberada— y se le da una sola casa nueva. El objetivo
declarado no es "mantener las guías al día": es que **cada procedimiento tenga
un solo documento que lo cuente**, porque un documento que no puede fallar en
rojo solo se corrige si deja de tener con quién competir.

---

**24 · La primera corrida de verdad, y lo que solo ella podía enseñar.** El 18
de septiembre de 2026, `npm test` se corrió por primera vez con un Chromium de
verdad —no la lectura de código, no el cálculo a mano contra el emulador: el
navegador real, el mismo motor que corre en `montar.yml`— sobre las diez
baterías que la sesión anterior había reescrito para dejar de nombrar el
catálogo de Orgánico. Tres cosas se cayeron, y ninguna se había visto antes
porque nada, hasta ese momento, las había ejercitado de verdad:

Un typo en `e2e.js` —`=== 24` donde debía decir `=== 18`— sobrevivió a la
lectura porque *leer* una aserción y *ejecutarla* no es lo mismo: la primera
solo pregunta si el texto tiene sentido, la segunda pregunta si es cierto. Un
cálculo mal hecho en `val.js` —el total esperado era el subtotal con descuento
y sin envío, no el total— sobrevivió por la misma razón. Y `servidor.js`
tenía un bug de verdad, no de la sesión anterior: `/__reiniciar` limpiaba la
hoja emulada pero nunca volvía a llamar `configurar()`, así que cada sección de
`e2e.js` arrancaba sobre una tienda de fábrica —sin nombre, sin cupones, sin
tarifas— y el pedido se perdía en silencio. Nueve baterías más lo usan sin
darse cuenta cada vez que `todas.sh` arranca el servidor por primera vez, que
sí llama `configurar()`; solo `e2e.js`, reiniciando a mitad de su propia
corrida, podía tropezar con la ausencia.

`respaldo.js` enseñó algo más incómodo: dos de sus propias aserciones —una
escrita esta misma semana— estaban comprobando el archivo equivocado.
`plantilla/index.html` ya había cambiado «tomate» por «redondo», y esta
bitácora ya lo daba por corregido en todas partes. Pero lo que de verdad sirve
`arnes.mjs` a las baterías es `publicar/index.html` —el snapshot de Orgánico,
sin rehornear— y ESE archivo seguía diciendo «tomate». Revisar el código fuente
correcto y comprobar el archivo servido incorrecto puede dar el mismo
diagnóstico por casualidad, o el contrario por la misma casualidad; esta vez
dio el contrario, y solo abrir la página de verdad lo mostró. El canario
«ESTA BATERÍA DISTINGUE» —el que existe justamente para probar que la
comprobación de arriba prueba algo— había dejado de distinguir por una razón
parecida: su control negativo leía el mismo `index.html` que `arnes.mjs` ya
había sobrescrito con el respaldo de la hoja emulada, así que para cuando
llegaba ahí ya no quedaba nada de Orgánico que detectar. El control negativo
que sí sigue siendo negativo es `publicar/index.html` directo del
repositorio, el único archivo de la corrida al que nada le escribe un
respaldo antes de que esta batería lo lea.

La regla, que ya estaba en el ítem 22 y que esto vuelve a confirmar desde el
otro lado: **una suite verde en la lectura es una hipótesis sobre una
hipótesis.** No alcanza con que el código parezca correcto ni con que el
cálculo a mano cuadre: hay una clase de error —el typo que el ojo salta, la
función que dejó de llamar a la que la completaba, el control negativo que
dejó de ser negativo— que solo se ve corriendo la cosa de verdad, con las
piezas de verdad, de punta a punta. 1350 de 1364 aserciones en rojo o verde
sobre un Chromium real; lo que falta son cuatro baterías con deuda ya
documentada antes de esta sesión —`pedidos.js`, `correo.js`, `tablero.js`,
`calendario.js`, con su propio catálogo simulado atado al de Orgánico— y una
sola aserción de `montaje.js` que aparca el alta a propósito.

De paso, `todas.sh` seguía cortándose en Windows/Git Bash con «No such file or
directory», y aquí se dio por diagnosticado: una trampa EXIT que los subshells
heredaban mal. **Ese diagnóstico era falso**, y costaron otras tres
correcciones —cada una con su explicación convincente— antes de leer el mensaje
por lo que decía. El ítem 25 lo cuenta.


---

**25 · El error decía el nombre del archivo equivocado, y lo dijo cuatro
veces.** El 18 de septiembre de 2026, `npm test` llevaba cuatro intentos sin
terminar solo en la máquina del operador —Windows, Git Bash—. Cada intento
falló distinto, y cada uno dio pie a una explicación que se sostenía:

```
./todas.sh: line 132: /tmp/tmp.L7uZM86XYp/e2e.js: No such file or directory
./todas.sh: line 140: /tmp/tmp.aQSIdscTwZ/movil.js: No such file or directory
environment: line 18: /tmp/tmp.aQSIdscTwZ/e2e.js: No such file or directory
ejecutar-bateria.sh: line 65: /tmp/tmp.PSNAF4aXSX/e2e.js: No such file or directory
```

Se leyó cuatro veces como «no encuentra la batería `e2e.js`», y de ahí salieron
cuatro arreglos sobre la herencia entre subshells: una guardia por PID, después
`trap - EXIT` al entrar a la función, después las funciones exportadas con
`export -f`, después cada batería en su propio archivo. Cada uno cambió el
número de línea del mensaje, ninguno lo quitó — que era exactamente la pista.

Lo que decía el mensaje es otra cosa. Esas líneas son siempre las dos que
redirigen la salida de la batería: `> "$SALIDA/$f"` y `>> "$SALIDA/$f"`. Bash
monta las redirecciones ANTES de ejecutar el comando, y cuando no puede abrir
el destino lo reporta con la ruta del DESTINO. No faltaba `e2e.js`: faltaba el
directorio `/tmp/tmp.XXXX` donde había que escribirlo. En Git Bash el `/tmp` de
la shell y el que usa `mktemp.exe` no son forzosamente la misma carpeta de
Windows, así que `mktemp -d` creaba un directorio, imprimía una ruta de estilo
Unix, y esa ruta no resolvía al mismo sitio. Ninguna batería llegaba a arrancar
node, y como ninguna escribía una línea, el marcador salía vacío.

El cuelgue de cinco minutos era una segunda avería, tapada por la primera: el
portero del cupo de trabajadores preguntaba `$(jobs -rp | wc -l)`, y la tabla
de trabajos que ve un `$( )` es la de su propio subshell. En Git Bash seguía
enseñando corriendo a los dos trabajos ya muertos, la condición no bajaba
nunca, `wait -n` volvía en el acto porque no quedaba a quién esperar, y el
bucle giraba en vacío quemando un núcleo hasta que alguien apretaba Ctrl+C.

El arreglo no es ingenioso y por eso funciona: la salida se guarda en
`pruebas/.salida/`, una carpeta del repositorio que resuelve igual en toda
máquina —y que además queda, así que la salida entera de la batería que falló
se puede abrir después, en vez de borrarse sola—; el cupo se lleva anotando
PIDs y esperando al más viejo con `wait <pid>`; y no hay trampa EXIT que
heredar, porque lo que deje vivo una corrida cortada lo barre la siguiente por
los PID que dejó anotados.

La regla: **cuando un error nombra una ruta, la pregunta es qué se estaba
haciendo CON esa ruta** —abrirla para leer, para escribir, ejecutarla— y no qué
archivo del proyecto se llama parecido. El nombre de un archivo dentro de un
mensaje no lo convierte en el sujeto de la frase. Y el corolario, que es el
patrón 6 otra vez y duele más: **cuatro arreglos distintos que fallan igual no
son cuatro hipótesis descartadas, son una hipótesis equivocada probada cuatro
veces.** Cuando el segundo intento falla con la misma forma que el primero, lo
que hay que volver a leer es el mensaje, no el código.

Y en la misma corrida, la otra mitad del rojo: `pedidos.js`, `correo.js` y
`tablero.js` colgaban de un catálogo que ya no existía. La historia A-5 cambió
lo que siembra `instalar()` —dos filas de EJEMPLO inactivas, que es lo que
debe ver un comercio recién instalado— y esas tres baterías llevaban años
tomando prestado ese catálogo para probar inventario, agotados y más vendidos.
El propio plan lo había advertido por escrito: «la hoja emulada de las baterías
es otra cosa y no cambia; confundir las dos ya costó diez baterías en rojo una
vez». Volvió a costar cuatro. Ahora cada una pide su tienda con `configurar()`
y siembra a mano las existencias flojas que necesita mirar, en la prueba que
las mira — no en la semilla, que es de otro dueño.

---

**26 · Una X roja que no significaba nada, y la frase que la mantuvo viva.** El
18 de septiembre de 2026 corrió el primer `montaje` de este repositorio. Hizo
todo bien: leyó la hoja, bajó las fotos, horneó el catálogo, corrió las 29
baterías sobre los archivos ya escritos, abrió el pull request #1 y lo fusionó.
Y dejó una X roja: la corrida de `pruebas` disparada por ese pull request quedó
**retenida esperando la aprobación de un mantenedor**, nadie la aprobó —el flujo
ya había seguido— y caducó con «This workflow run required approval but was not
approved before it expired».

El daño no es la X: es lo que enseña. Una marca roja sobre un trabajo que salió
perfecto entrena a no mirar las marcas rojas, y la siguiente sí va a importar.

Lo desconcertante es que **esta lección ya estaba aprendida y escrita**, con
todas sus letras, dentro de este mismo repositorio. `fotos.yml` la lleva en un
comentario de dieciséis líneas: «abrir uno y fusionarlo en el mismo segundo no
era ceremonia inútil: era una X roja garantizada […] la retención es de la
CORRIDA: pasa antes de que se evalúe ninguna condición del trabajo». `fotos`
dejó de abrir pull request y empezó a empujar directo a `main`. `montaje` nunca
recibió el arreglo.

Y hay un tercer archivo en la historia, que es lo que la vuelve un caso de
manual. `pruebas.yml` se salta el pull request de `fotos` por esta razón
exacta, y a continuación explica por qué el de `montaje` sí se sigue
comprobando: «ese pull request espera a una persona». Era verdad cuando se
escribió. Dejó de serlo cuando `montaje` empezó a fusionar solo, y nadie volvió
a esa frase. Así que el comentario que describía la excepción **se convirtió en
la causa**: mientras dijera eso, la condición no cubría a `montaje`, y mientras
no lo cubriera, la X estaba garantizada.

Tres archivos, una sola regla, y solo uno al día: es el patrón 2 otra vez, pero
con una vuelta de tuerca que conviene anotar aparte. Aquí la copia atrasada no
era un dato duplicado —una lista, una versión, un menú—: era **una
justificación**. Un comentario que explica por qué algo es una excepción tiene
la misma obligación de estar al día que el código, y falla peor, porque una
justificación obsoleta no se ve obsoleta: se lee como una decisión pensada y
frena a quien iba a corregirlo.

El arreglo es el que el plan ya pedía por escrito (`PLAN-MVP.md` §4.7: «se
hornea, se prueba y se empuja a main sin que nadie apruebe nada»): `montaje`
publica directo en `main`, no abre pull request ninguno salvo que se le pida a
mano —la casilla del formulario ya existía y no servía para nada—, y `pruebas`
se salta los pull requests del bot vengan de `fotos` o de `montaje`. Las guardas
que sí protegen no se tocaron: solo se indexa `publicar/`, la identidad de la
hoja se comprueba antes, y ninguna batería puede estar en rojo para llegar a
publicar.

La regla: **cuando se retira el motivo de una excepción, hay que ir a buscar
dónde está escrita esa excepción.** El código que la implementaba se corrigió
—`montaje` dejó de esperar a una persona— y el comentario que la razonaba
sobrevivió en otro archivo, sosteniendo el comportamiento viejo. Un `grep` del
motivo, no del mecanismo, es lo que lo habría encontrado.

---

**27 · Medir antes de decidir, con una batería que llevaba meses sin correr.**
El 18 de septiembre de 2026, al empezar el hito M1, había que resolver una
historia binaria: `limites.js` levanta un navegador, mide cinco tamaños de
catálogo y **no estaba en la lista de `todas.sh`**, así que no corría nunca. La
historia decía «o entra o se va», y la intuición decía que se va: M1 existe para
recortar minutos de Actions, y una batería con navegador es lo caro.

La intuición estaba equivocada por un factor grande. Medida, la corrida entera
cuesta **menos de tres segundos**: reutiliza un solo navegador para los cinco
tamaños y la página pinta rápido en todos. El número que sostenía la intuición
—«las doce baterías con navegador son el 99 % de la suite»— es cierto y no
aplicaba: lo caro de esas doce no es abrir el navegador, es todo lo que hacen
después.

Así que entra, y entrando resultó valer más de lo que parecía. La afirmación que
justifica tenerla es una que ninguna otra batería podía hacer: **a la primera
pantalla llegan 25 tarjetas tanto con 50 productos como con 1000.** Todas las
demás prueban con ocho productos, así que el día que alguien rompa la
paginación, ninguna se entera — y la tienda de un comercio con catálogo grande
le pide mil tarjetas de golpe al teléfono de su cliente.

Lo que NO se afirma también es una decisión: los milisegundos se imprimen y no
se comprueban. Una aserción sobre tiempos se cae sola un martes por la tarde en
un runner cargado, y una comprobación que falla por algo que está bien enseña a
ignorarla — que es el mismo daño del ítem 26, la marca roja que no significa
nada. El reloj es una entrada que nadie declaró (patrón 8): sirve para informar,
no para decidir.

La regla: **una historia binaria —«o entra o se va»— se contesta midiendo, no
razonando por categoría.** «Es una batería con navegador, luego es cara» es un
razonamiento sobre la clase, y la clase tenía dentro un caso que costaba tres
segundos. El hito entero se llama «medir antes de tocar nada»; la primera cosa
que midió fue una decisión propia.

Y de paso, la otra mitad de M1 que sí salió de un número: el cron de `fotos`
corría **cada cuatro horas** —seis arranques diarios, medidos como el 84 % de
los minutos de una tienda— para cazar fotos subidas al Drive sin avisar. Ahora
corre una vez al día y **no publica**: mira, avisa y se retira. Que no publique
no es un detalle de implementación, es lo que separa una red de seguridad de un
publicador automático: si el comerciante dejó seis fotos a medio subir, su
tienda no debería salir a producción a las tres de la mañana con el trabajo a
medias.

---

**28 · Las dos guardas que cazaron a quien las escribió.** El mismo día, al
montar la medición de tiempos del hito M1, dos aserciones del propio
repositorio se pusieron en rojo contra el cambio que las estaba estrenando. Las
dos tenían razón, y por motivos distintos que conviene separar.

La primera fue `escribe.js`, la batería de A-8 —«cada herramienta declara lo que
escribe»—. La herramienta nueva declaraba escribir `tiempos.json`, y además
abría `process.env.GITHUB_STEP_SUMMARY` para pegar ahí su tabla. Parecía
inofensivo: es el archivo que el runner ofrece justo para eso. Pero **una ruta
que sale del entorno no se puede declarar**, y una herramienta que escribe donde
su declaración no llega es exactamente el agujero que A-8 existe para tapar. El
arreglo dejó el diseño mejor de lo que estaba: la herramienta escribe un
`tiempos.md` que sí declara, y el flujo lo concatena — que es, además, como
funcionan todos los demás pasos de estos flujos desde siempre. La guarda no
señaló un descuido: señaló que había dos formas de hacer lo mismo y se estaba
usando la peor.

La segunda fue más incómoda. Una aserción comprobaba que `DESPLIEGUE.md`
documenta todos los campos del formulario de `montaje`, y lo hacía así:
`campos.length === 4 && campos.every(...)`. Al añadir el campo `sin_guardia` se
cayó — **y el documento estaba bien**. Lo que estaba mal era el `4`: una cifra
escrita a mano dentro de la comprobación que existe precisamente para cazar
cifras escritas a mano. El comentario encima de esa línea lleva meses contando
que el runbook hablaba de dos campos cuando el formulario tenía cinco.

La regla: **una guarda contra un número a mano no puede llevar un número a
mano.** Y la general, que es la que vale para las dos: una aserción que se cae
contra un cambio legítimo no siempre está defendiendo algo — a veces está
pidiendo que la arreglen a ella. Distinguir los dos casos es el trabajo, y la
respuesta está en qué se rompió: si lo que falla es el criterio, se corrige el
código; si lo que falla es la forma de medirlo, se corrige la aserción. Darlas
por buenas siempre y darlas por molestas siempre son el mismo error con distinto
signo.

---

**29 · La prueba que solo fallaba donde nadie la miraba.** El 18 de septiembre
de 2026, midiendo cuántas baterías conviene correr a la vez, la suite se puso en
rojo a las 19:02 hora de Colombia. Dos aserciones de `montaje.js`, sobre el
nombre de los respaldos de la hoja. A las 18:00 estaban verdes. No se había
tocado una línea.

El maestro nombra cada copia con `diaDeHoy()`, que arma la fecha con
`getFullYear/getMonth/getDate` — la fecha **local**. Las dos aserciones
comparaban contra `new Date().toISOString().slice(0, 10)` — la fecha **UTC**.
Colombia va cinco horas por detrás, así que desde las 19:00 hasta la medianoche
las dos fechas son días distintos, y la comparación se caía.

Lo importante no es el error: es **dónde no se veía**. Los runners de GitHub van
en UTC, donde las dos fechas coinciden siempre. Así que esto era verde en CI las
veinticuatro horas del día, todos los días, y rojo cinco horas diarias en la
máquina de cualquiera que trabaje desde Colombia — que es donde está el equipo.
Una prueba que solo falla donde nadie la mira es peor que una que falla siempre:
la que falla siempre se arregla el primer día.

Y el maestro tenía razón. Un comercio colombiano quiere sus respaldos fechados
con SU día, no con el de Greenwich. Lo que sobraba era la segunda copia de la
regla dentro de la prueba (patrón 2), así que se quitó: las aserciones le
preguntan la fecha al maestro con `g.api.diaDeHoy()` en vez de recalcularla.

`calendario.js` existía justamente para esta familia de fallos —«una prueba que
depende de qué día se corre no prueba nada»— y no lo cazó, porque movía el DÍA
y dejaba el HUSO quieto. Ahora corre `montaje.js` a tres horas distintas con
`TZ=America/Bogota`, dos de ellas en la franja en que allá ya es otro día que en
UTC. Con el defecto puesto se cae en dos de las tres; sin él, en ninguna — que
es la condición para dar una comprobación por buena en esta casa.

La regla: **una prueba que depende del reloj no depende solo de la fecha.**
Depende de la fecha, de la hora y del huso, y las tres tienen que moverse en la
prueba que dice cubrir el reloj. Y el corolario, que es el que duele: cuando una
comprobación es verde en CI y roja en una máquina de verdad, la sospecha por
defecto no es «la máquina está rara» — es que CI está mirando un solo punto de
un espacio con más dimensiones.

De paso, la medición que destapó todo esto. `todas.sh` decía «un trabajador por
núcleo, hasta cuatro», razonando que cada trabajador es un Chromium y más
competirían por CPU. Medido en una máquina de DOS núcleos: 151 s con uno, 94 s
con dos, **73 s con cuatro**, 71 s con seis. Con el doble de trabajadores que de
núcleos el reloj sigue bajando, porque estas baterías no gastan CPU: **esperan**
—a que arranque su servidor, a que cargue la página, a que se cumpla un
`waitFor`—. Atarlos a los núcleos era contar el recurso equivocado. Ahora son
cuatro por defecto, que es donde está la rodilla.

---

**30 · Lo que se repite no se nota; lo que se repite en otro archivo, menos.** El
18 de septiembre de 2026, cerrando el hito M1, se contaron las peticiones que el
flujo `fotos` le hace al maestro en una corrida. Salieron **siete**, y tres eran
la misma pregunta hecha dos veces: `bloques`, `fotos` y `catalogo`.

Nadie las duplicó a propósito ni por descuido. El flujo tiene dos pasadas —una
de `--revisar`, que mira si hay algo que hacer, y otra de publicar, que lo hace—
y cada herramienta pregunta lo suyo cuando le toca. Cada una, por separado, está
bien escrita. La duplicación no vive dentro de ninguna: vive en el hecho de que
se llaman dos veces, y eso no se ve leyendo ninguno de los archivos.

Y costaba caro por una razón que tampoco está escrita en ellos: **Apps Script
arranca en frío**. La primera llamada después de actualizar una implementación
tarda cuarenta segundos o más, documentados, y siete llamadas en serie son siete
oportunidades de pagarlo — en el camino crítico de publicar una foto, que es la
queja con la que empezó todo este hito.

El arreglo tiene dos decisiones que vale la pena separar de la mecánica.

La primera: **dónde vive la lectura del sondeo**. La tentación era darle a cada
herramienta un `--desde` propio. Serían siete sitios donde acordarse, y la que
se olvidara seguiría preguntando sin que nadie lo notara, porque funcionaría
igual. Se puso dentro de `alMaestro`, por donde pasan TODAS las preguntas. Ni
una sola herramienta cambió una línea, y no hay forma de que el mecanismo quede
a medias.

La segunda: **caduca a los diez minutos**, y eso es lo que lo separa de una
caché. Una caché sobrevive entre corridas, y entonces un montaje puede publicar
el catálogo de hace una hora sin que nadie se entere — un modo de fallo que este
proyecto lleva persiguiendo desde el primer día, porque no rompe nada: funciona,
y miente. Vencido, se dice en voz alta y se pregunta al maestro. El camino
lento, nunca el dato viejo.

Se cuenta de verdad. `sondeo.js` levanta un maestro de mentira que anota qué le
piden y corre las herramientas contra él, con `--desde` y sin. Una aserción
sobre el texto del archivo habría dicho que la llamada está escrita; solo quien
la recibe sabe si se hizo.

La regla: **una redundancia entre dos llamadas no se ve en el código de
ninguna de las dos.** Se ve contando lo que sale por el cable. Y la forma barata
de contarlo es la misma de siempre: poner al otro lado algo que lleve la cuenta,
en vez de leer más atentamente.

Un apunte de método, del mismo día: la primera versión de esa batería se plantó
entera. El maestro de mentira vivía en el proceso de la batería y los hijos se
lanzaban con `execFileSync` — que bloquea el bucle de eventos, así que el
servidor no podía contestar y todos esperaban el tope de noventa segundos. Un
servidor y una espera síncrona no caben en el mismo bucle. El síntoma —«se
cuelga»— no se parecía en nada a la causa, otra vez.

---

**31 · La tienda era invisible para quien no ejecuta JavaScript.** El 19 de
septiembre de 2026, empezando el hito M2, se miró qué ve Google al entrar a una
de estas tiendas. La respuesta: **nada**. Ni un producto, ni un precio, ni el
nombre del comercio en un sitio donde un rastreador lo busque.

No era un defecto: era una consecuencia que nadie había puesto en palabras. La
tienda pinta su catálogo desde JavaScript —fue la decisión correcta, y sigue
siéndolo— y los rastreadores no ejecutan JavaScript, o lo ejecutan tarde y a
regañadientes. Así que la página que se indexaba era la plantilla vacía. El
comerciante paga un dominio, publica su catálogo, y no sale en ninguna búsqueda.

Y es el modo de fallo que este proyecto lleva persiguiendo desde el primer día,
en su forma más pura: **no rompe nada**. La tienda se ve perfecta, el pedido
llega, el inventario baja. Simplemente no existe para quien la busca, y eso no
da error nunca.

La respuesta es la que ya había tomado el proyecto dos veces —para el catálogo y
para el respaldo—: **se hornea**. `montar/sembrar-seo.mjs` escribe en el HTML el
JSON-LD del comercio, del sitio y de cada producto con su oferta, y genera el
`sitemap.xml` y el `robots.txt`. Sale de `publicar/catalogo.json`, que se horneó
unos segundos antes, y no de otra pregunta al maestro: la tercera vez que se
toma esa decisión por la misma razón.

Dos detalles que valen más que la mecánica.

**Lo que está entre corchetes no existe.** La hoja siembra `[DIRECCIÓN]` y
`[RAZÓN SOCIAL]` como forma de decir «esto todavía no lo tengo», y la tienda ya
los esconde al pintar. Publicárselos a Google habría sido peor que omitirlos: un
dato de contacto falso en datos estructurados acaba en una ficha de empresa
equivocada, y eso lo arregla el comerciante por teléfono con Google, no nosotros
con un commit. La regla de esconder ya existía en un sitio; ahora existe en los
dos, y una batería lo comprueba con una dirección sin llenar a propósito.

**Sin fecha del día.** El `sitemap.xml` no lleva `<lastmod>`. Tenerlo es lo
natural y habría roto el determinismo de A-6: cada horneado parecería un cambio
y publicaría por nada — justo el gasto que M1 acababa de recortar. Dos hitos
seguidos tirando en direcciones opuestas sobre el mismo archivo, y el único
motivo por el que se vio es que A-6 dejó una aserción puesta.

La regla: **una decisión de arquitectura correcta puede tener una consecuencia
que nadie eligió.** Pintar desde JavaScript fue lo correcto y trajo gratis, sin
que nadie lo decidiera, que la tienda fuera invisible. Esas consecuencias no
aparecen en ninguna prueba, porque no son fallos de nada: hay que ir a
buscarlas preguntando qué ve cada uno de los que miran —el comprador, el
comerciante, y el que no ejecuta JavaScript.

---

**32 · Las dos direcciones del fallo no son la misma, y hay que elegir cuál para
cada dato.** El 19 de septiembre de 2026 se empezó C-1, las variantes: un labial
en tres tonos sin crear tres productos. La parte interesante no fue la sintaxis
ni el parseo — fue darse cuenta de que el mismo cambio necesita las DOS reglas de
fallo de esta casa, en sitios distintos y a propósito.

**El catálogo falla abierto.** Una celda `Variantes` que no se entiende NO saca
el producto de la tienda: lo deja a la venta sin variantes y reporta la celda.
Porque vender un labial sin tono deja un pedido que el comerciante resuelve con
un mensaje, y no venderlo es una venta perdida y callada.

**El pedido falla cerrado.** Una elección que el comercio no ofrece TUMBA LA
LÍNEA. Porque guardarla sería dejar un pedido que nadie puede despachar, y
adivinar cuál tono quiso decir es peor todavía.

Las dos son la misma regla vieja —«fallo abierto en el catálogo, fallo cerrado
en los cupones»— aplicada a un dato nuevo, y el trabajo fue decidir de qué lado
cae cada mitad. La batería las fija juntas, una al lado de la otra, con una
aserción que comprueba que un PRECIO ilegible sigue tumbando el producto: sin
esa aserción de contraste, alguien podría «unificar el criterio» algún día y
romper una de las dos sin notarlo.

Y una consecuencia que no estaba en el plan y salió sola al escribir la prueba.
La clave que evita líneas duplicadas en un pedido era el id del producto. Con
variantes eso significa que **dos tonos del mismo labial se convertían en uno**:
el comprador pedía Rosa y Nude, y recibía Rosa. La clave pasó a ser producto +
variante — y eso, a su vez, obligó a llevar la cuenta del stock por producto,
porque las dos líneas compiten por las mismas existencias (el stock es del
producto, no de la variante: decisión consciente de C-1, con su disparador
escrito para revisarla). Tres cambios encadenados que nadie había listado,
descubiertos por escribir la aserción antes de darla por buena.

La regla: **una decisión de diseño no se aplica a un dato nuevo copiándola,
sino preguntándole al dato cuál de sus mitades va de cada lado.** «Fallo abierto»
no es una propiedad del proyecto: es una propiedad de cada campo, y el mismo
cambio puede necesitar las dos.

Y el apunte de método: `esquema.js` cazó dos cosas el mismo día. Que la clave
nueva de `Configuración` se había metido EN MEDIO —R1 dice «solo se agrega, y
solo al final»— y que las columnas nuevas no estaban en `CONTRATOS.md`. El
contrato escrito y el contrato que corre son dos copias del mismo procedimiento,
y esa batería es la cuerda que los ata: sin ella, el documento se habría quedado
atrás ese mismo día.

---

**33 · El separador que nadie declaró, y la función escrita tres veces.** Ese
mismo 19 de septiembre se cerró C-1 por la página, y las dos cosas que costaron
no eran el selector.

**La primera: la línea del pedido ya tenía dueño.** El carrito le manda a la
hoja una cadena `id:cantidad`, separadas por comas. Meter la elección ahí
significa un tercer campo —`id:cantidad:Talla=M;Color=Rosa`— y con él **cinco
caracteres pasan a ser estructura**: `,` `:` `;` `=` y el `|` que ya venía de la
hoja. Un comercio que llame a una talla `40,5` —que es exactamente como se
numeran los zapatos en media Europa— parte la línea en dos y el pedido llega
diciendo otra cosa, sin error, sin aviso y sin nada que mirar.

No hay forma de adivinar qué quiso decir, así que se aplica la regla de la casa:
**el grupo entero se cae, el producto sigue a la venta sin esa elección, y queda
dicho en la consola.** Fallo abierto, como el resto del catálogo. Lo que no se
podía hacer era pintar un selector cuya respuesta no cabe en el sobre.

El apunte general: **un formato de texto sin escapes no tiene «un separador»,
tiene tantos como campos le vayas añadiendo**, y cada uno le prohíbe un carácter
a un dato que escribe una persona que no sabe que existe. Se documentó en
`CONTRATOS.md` al lado del campo, no en el código, porque a quien le va a pasar
es al comerciante.

**La segunda: `i.id + ":" + i.cantidad` estaba escrito a mano en tres sitios**
—la firma del pedido, la validación y el registro—. Patrón 2 de siempre, pero en
su forma más cara: bastaba olvidar uno para **sellar un pedido y registrar otro**
—la hoja confirmando el precio de «dos labiales» y el comercio recibiendo dos
tonos que nadie validó—. Pasaron a ser una sola función. Mientras el formato fue
`id:cantidad` las tres copias podían convivir años sin divergir; el día que el
formato creció, las tres tenían que cambiar a la vez o el fallo era invisible.
**Una duplicación inofensiva es solo una duplicación que todavía no ha tenido
motivo para divergir.**

Y el método, otra vez: la batería nueva se corrió con cuatro defectos puestos a
propósito —sin obligar a elegir, con la clave solo por id, sin la elección en la
línea, y con el stock contado por línea— antes de darla por buena. Los cuatro
salieron rojos. El primero enseñó algo de rebote: con la obligación quitada, la
batería no fallaba, **se colgaba treinta segundos** esperando un selector que el
propio defecto había cerrado. Una prueba que se cuelga en vez de contar lo que
falló es media prueba, así que cada tramo abre la ficha por su cuenta en lugar
de dar por hecho que sigue abierta.


---

**34 · Un control que ordena y no ordena.** C-4 parecía la historia más pequeña
del hito —dos puntos, una línea en el plan— y trajo la decisión más fácil de
equivocar, precisamente porque la respuesta cómoda suena a respeto.

El catálogo ponía los destacados delante. Al agregar «ordenar por precio», el
primer impulso —y lo que hace casi cualquier tienda— es **conservar** el
destacado arriba: es una decisión del comerciante, ¿por qué la iba a pisar un
selector? La respuesta es que **el comprador no puede saber que la está
pisando**. Ve «Precio: de menor a mayor», ve arriba un producto de $28.000, y la
única conclusión disponible es que ese es el más barato que hay. No hay marca,
no hay asterisco, no hay forma de enterarse. Un control que promete un orden y
entrega otro no es una concesión al comerciante: es una mentira, y encima una
que solo perjudica al que compra.

Así que destacar quedó definido como **una posición dentro del orden del
comercio, no una chincheta que gana siempre**. Cuando el comprador pide un
orden, la lista es ese orden y nada más. La insignia «Destacado» sigue ahí —eso
es información, no posición— y el comercio sigue mandando en la ENTRADA, que es
donde su decisión vale.

Y el cambio que nadie había pedido. Para que «Como en la hoja» fuera una opción
de verdad, `VISIBLES` tuvo que dejar de guardarse ya reordenado con los
destacados delante: guardarlo así **borraba para siempre el dato «en qué orden
lo escribió el comercio»**. Una lista ordenada al guardar parece un ahorro —se
ordena una vez en lugar de en cada pintado— y lo que hace es perder información
que todavía no sabías que ibas a necesitar. El orden se aplica ahora al pintar.

Eso destapó una aserción vieja de `hoja.js` que preguntaba «¿van los destacados
primero?» **mirando la lista interna**. Pasó en verde durante meses porque hasta
ese día la lista interna y la pantalla decían lo mismo; el día que dejaron de
decirlo, la aserción se cayó — y estaba bien que se cayera, porque lo que quería
saber era lo que ve el comprador y llevaba todo ese tiempo preguntándoselo a
otro. **Una prueba que mira el estado interno está midiendo la implementación,
no el comportamiento, y solo se nota cuando la implementación cambia.** Ahora
mira la rejilla, y cuenta las insignias contra la hoja y no contra la pantalla,
para que las dos líneas no digan lo mismo.

Lo pequeño que también costó: ordenar por nombre con `a.nombre < b.nombre`
manda «Ñame» detrás de «Zanahoria», porque compara números de carácter y la Ñ
vive después de la Z. En un catálogo colombiano eso se ve el primer día.
`localeCompare(b, "es")` y una aserción que lo fija con ese mismo producto.


---

**35 · El emulador decía que sí a cualquier cosa, y llevaba meses haciéndolo.**
D-1 empezó con una función de una línea en `pruebas/gas.js`:

```js
computeDigest: (alg, txt) => Array.from(Buffer.from(String(txt)))
```

Eso es la **identidad** con nombre de hash: devuelve los bytes del texto sin
tocarlos. Llevaba ahí desde que el emulador existe y nunca importó, porque nada
del maestro usaba `computeDigest`. El día que algo lo usara —guardar una clave—
cualquier aserción del tipo «la clave no se puede leer dentro de la huella»
habría pasado en verde sobre una huella que era la clave en claro.

No es un fallo del código: es un fallo del **instrumento**, y esos no los caza
ninguna prueba porque son el aparato con el que se mide. La regla que deja:
**un emulador puede mentir en lo que todavía nadie usa, y el día que alguien lo
use la mentira llega intacta y disfrazada de verde.** Antes de apoyar una
decisión nueva en una pieza del emulador, se mira si esa pieza está de verdad
implementada. Ahora `computeDigest` y `computeHmacSha256Signature` son el crypto
de node — y devuelven los bytes CON SIGNO, que es como los devuelve Apps Script,
para que olvidarse del `& 0xff` al pasarlos a hexadecimal se rompa aquí igual
que se rompería en Google.

Y dos decisiones de la historia que tienen poco que ver con criptografía:

**Los errores que no se distinguen.** «Usuario o clave que no corresponden» es
una sola frase para las dos cosas, y «Sesión no válida» una sola para «caducó»,
«esa firma no es mía» y «ese testigo es de otra tienda». No es discreción: dos
mensajes distintos convierten el formulario en un **buscador de usuarios** —se
prueban nombres hasta que cambia la frase— y al que entró bien no le sirven de
nada, porque haga lo que haga tiene que volver a entrar. La aserción está
escrita comparando los dos textos con `===`, para que separarlos algún día
«para ayudar al usuario» salga en rojo.

**Y el contador cuenta los intentos de usuarios que no existen.** Contar solo
los del usuario bueno es lo natural y es justo lo contrario de lo que hace
falta: el contador se vuelve el detector — se prueban nombres y el que bloquea,
existe.

**36 · Once puertas, once guardias escritas a mano.** El maestro despachaba con
una escalera de `if`, y cada función comprobaba su token por dentro. Funciona
perfectamente hasta que alguien agrega la doce y se le olvida la suya — y ese
olvido **no se ve**, porque una puerta sin guardia se comporta exactamente igual
que una puerta que funciona. No falla, no avisa, no sale en ningún log: contesta.

Ahora cada puerta declara a quién deja pasar en una tabla, la guardia se aplica
en un solo sitio, y `esquema.js` fotografía la lista de puertas: una nueva
obliga a un `--congelar`, que es un acto deliberado que aparece en el diff para
que alguien lo mire. Se quitaron seis comprobaciones duplicadas.

El detalle que parece paranoia y no lo es: una guardia con un nombre que no
existe **no deja pasar**. La alternativa —seguir de largo si no se reconoce la
guardia— significa que una errata en un nombre abre la puerta de par en par, y
que la forma de fallar del sistema de permisos sea «permitir». Un permiso que
falla abierto no es un permiso.

Y el rojo que enseñó algo de rebote: agregar la séptima opción al menú rompió
una aserción que exigía que el stub de la hoja cupiera en 70 líneas. El stub no
estaba engordando — una opción cuesta exactamente una línea de la lista. Un tope
fijo convierte cada opción nueva en un rojo que no significa nada, y **un rojo
que no significa nada enseña a subir el número sin mirar**. El tope pasó a ser
«64 más una por opción», que es lo que de verdad se quería vigilar: el stub
creciendo por cualquier otra razón.
*(Hoy: 58 más dos por opción, en `pruebas/menu.js`; bitácora 68.)*


---

**37 · La clave iba en la dirección, y lo escribí yo en D-1.** `?a=entrar`
aceptaba el usuario y la clave por GET: `…/exec?a=entrar&u=dona.rosa&c=…`. Toda
la historia D-1 estaba construida alrededor de que la clave no quede escrita en
ninguna parte —ni en la hoja, ni en el repositorio, ni en una celda—, y la
propia puerta de entrada la dejaba en el historial del navegador del mostrador
y en los registros de Google. El comentario de esa misma sección advertía del
token de montaje «viajando en la barra de direcciones»; nadie lo leyó contra la
puerta nueva, empezando por quien lo escribió. *(mío)*

Se vio al diseñar D-2, al decidir cómo mandar el testigo en cada petición: la
respuesta obvia para el testigo —POST, en el cuerpo— era la misma que hacía
falta para la clave. Ahora `entrar` y todas las puertas del panel son **solo
por POST**, declarado en la tabla de puertas (`soloPost`), y por GET contestan
que no sin hacer nada — ni siquiera cuentan como intento fallido, porque si
contaran, cualquiera bloquearía la tienda con cinco visitas a una dirección.
`admin.js` no lo comprueba leyendo el código de la página: revisa **cada
petición que llegó al servidor**, incluida la dirección de los POST, y exige
que en ninguna esté la clave ni el testigo.

**38 · Lo que se leyó, no lo que hay.** El error que más se paga de un panel no
es de seguridad: es escribir la fila entera. El formulario se abre con 40 en
Stock; mientras está abierto se paga un pedido y queda en 37; el comerciante
corrige una tilde y guarda. La fila vuelve a decir 40. Nadie tocó el stock,
nadie vio nada raro, y la tienda ofrece tres croissants que no existen.

En la hoja eso no pasaba porque quien escribe ve lo que pisa. En el panel no lo
ve. Así que cada producto viaja con la huella de su fila tal como se leyó, y
guardar la exige: si la fila cambió entre medias, **no se escribe** y se dice.
Es la aserción central de `productos.js`, y la de `admin.js` la repite desde el
navegador cambiando la celda por detrás mientras el formulario está abierto.

La consecuencia que salió al hacer la foto: subirla cambia la fila (la celda
Imágenes), así que el formulario que la subió queda viejo por su propia mano. Si
la página no toma la versión nueva, el siguiente Guardar dice «este producto
cambió mientras lo editabas» — y lo cambió el comerciante, hace dos segundos.
**Un control de concurrencia se dispara también contra uno mismo**, y cada
escritura que hace la página tiene que devolver la versión con la que queda.

**39 · Tres aserciones que pasaban con el defecto puesto.** D-2 se escribió con
la regla de siempre —cada guardia se verifica ROJA con su defecto antes de
darla por buena— y la regla cazó tres, todas del mismo tipo:

- «La llave se suelta también cuando la operación falla» pasaba sin el
  `finally`. La falla que usaba era un rechazo educado (un precio ilegible),
  que vuelve por el camino normal y suelta la llave igual. La que importa es
  una **excepción** a mitad de escritura —cuota agotada, hoja protegida—. Ahora
  la prueba hace reventar la escritura.
- «Reintentar no duplica» pasaba con un número de operación NUEVO en cada
  reintento, porque el maestro rechaza el código repetido. No duplica, cierto;
  pero el comerciante lee «ya hay un producto con ese código» sobre el que
  acaba de crear. Lo que el mismo número compra es que el reintento **termine
  bien**, y eso es lo que se exige ahora.
- «Dice cómo subir la foto a mano» pasaba quitando la mitad del mensaje, porque
  la otra mitad seguía nombrando Drive y el archivo. Un defecto demasiado
  tímido no prueba la aserción; se rehízo quitándolo entero.

La lección es la misma que la del emulador en la entrada 35, un nivel más
arriba: **una aserción que pasa con el defecto está midiendo otro fallo**, y la
única forma de saberlo es poner el defecto. Y de paso, `admin.js` cazó un error
de verdad en la página: al guardar, el aviso «Guardado: … se verá al publicar»
se pintaba y se borraba en el mismo instante, porque recargar la lista limpiaba
los avisos. El comerciante nunca habría leído que tenía que publicar. *(mío)*

Del mismo tipo que la entrada 35, en el emulador: `LockService` era un objeto
que decía que sí a todo. Con eso «toda escritura va bajo llave» era imposible
de comprobar — una escritura con llave y una sin ella se veían igual. Ahora la
llave sabe si está tomada, y cada escritura del emulador queda anotada con eso.


---

**40 · El riesgo que ya existía, y que un botón de pago vuelve caro.** El 21 de
septiembre el dueño agregó al MVP cobrar en línea (M3.5) y, al mismo tiempo,
nombró un riesgo que la tienda tiene **hoy**: dos compradores pueden pedir la
última unidad a la vez. La hoja valida el stock al armar el pedido pero no lo
aparta — el inventario solo baja cuando el comerciante marca Pagado —. Mientras
el pago lo confirma una persona, eso se resuelve con un mensaje de disculpa y
nadie pierde plata. **Con un botón de pago, los dos pagan**, y a uno hay que
devolverle el dinero.

Por eso la primera historia de M3.5 no es el proveedor sino **apartar la
unidad** (E-1), y va antes. Un riesgo que hoy es barato no se deja para cuando
sea caro solo porque hoy nadie lo haya pagado.

Y la segunda lección vino de preguntarle al propio sistema qué puede hacer
antes de elegir proveedor: el maestro es un Apps Script, y su `doPost` **no ve
las cabeceras HTTP**. La mayoría de los avisos de pago van firmados en una
cabecera. Un aviso que no se puede verificar no puede marcar nada como pagado,
así que el aviso es solo un timbre y la verdad se le pregunta a la API del
proveedor. Eso se volvió el criterio que decide el proveedor (decisión 12), por
encima de la comisión. **Una restricción de la plataforma se lee antes de
comparar precios**, o se elige el más barato de los que no sirven.

Y de paso, por pedido del dueño: `instalar()` ya no imprime el código de la hoja
al final. Eran doscientas líneas en cada reinstalación —que es lo que se hace
para agregar una clave—, enterraban el resumen que había que leer y eran la
forma segura de pegar un stub viejo. Una aserción de `montaje.js` **exigía**
ese segundo camino; ahora exige que no exista. Y dos documentos decían que
«mirar el menú no comprueba nada» sin la excepción que D-1 acababa de crear: una
versión que agrega una opción al menú. Esa frase, leída al pie de la letra, es
la que hizo que la opción *Clave del panel* no apareciera hasta regenerar el
stub.

**41 · La tercera copia de la regla de venta, y el cupón que nunca se agotaba.**
D-3 hace que el panel cambie el estado de un pedido «con el mismo efecto que en
la hoja». Para probarlo había que mirar TODO lo que la hoja hace al cambiar un
estado, y ahí estaba: `recalcularResumen` decidía qué es una venta con
`indexOf('confirmado')`, una regla anterior a la lista de estados. «Pagado» —el
estado que el comerciante usa de verdad— no contaba en *Más vendidos* ni en los
usos de un cupón. **Un cupón con tope de 50 usos no se agotaba nunca.** Nadie lo
había visto porque el síntoma es la ausencia de algo. Es el patrón 2 otra vez:
`esVenta` ya existía y ya lo usaban el inventario y el tablero; esta era la
tercera copia de la regla, escrita antes que las otras dos y nunca migrada.
Arreglado con `esVenta`, y el panel y `alEditar` llaman ahora a la misma
función (`trasCambiarEstado`) en vez de a dos listas de pasos. La prueba
(`panelpedidos.js`) gasta un cupón de un uso con un pedido *Pagado* y se
verificó en rojo con la regla vieja puesta.

**42 · Una constante que nacía con huecos.** `HOJAS_QUE_SE_PUBLICAN` se declaró
como `[H_CATALOGO, H_CONFIG, H_ENVIOS]` arriba del archivo, antes de que esas
tres existieran. En Apps Script el archivo se ejecuta de arriba abajo: la lista
nació `[undefined, undefined, undefined]` y «editar el Catálogo a mano» nunca
habría marcado cambios sin publicar. Pasó las pruebas del panel —que guardan
por el panel— y lo cazó la de la hoja. Ahora es una función. Y como el hueco es
de una clase entera y no de esa línea, `esquema.js` tiene una aserción nueva:
**ninguna constante del maestro nace con `undefined` dentro**. Se comprobó en
rojo devolviendo la lista a su forma vieja.

**43 · La prueba que fallaba una de cada sesenta.** `entrar.js` se caía de vez
en cuando, y no era el código de entrar: el `getUuid` del emulador a veces daba
menos de 32 cifras hexadecimales (un número pequeño sin ceros a la izquierda) y
el testigo no pasaba su propia validación de forma. Arreglado en el emulador;
80 corridas seguidas limpias. Un rojo intermitente que se ignora enseña a
ignorar rojos: se persigue hasta la causa aunque la causa esté en la prueba.

**44 · Esperas que colgaban la corrida en vez de fallar.** Al verificar en rojo
la interfaz de D-3/D-4 —quitando el segundo toque de «Cancelar», o el error
junto al campo— la batería no decía FALLA: se quedaba colgada hasta que la
mataba el tope, sin una línea que leer. Las esperas nuevas de `admin.js` ya no
revientan la corrida: si se agota, la aserción siguiente es la que falla y dice
por qué. Un defecto tiene que producir un rojo legible, o no sirve de control.
Queda escrito un hueco: el test de navegador solo ve la barra de publicar en el
estado «no está configurado» (el servidor de pruebas no tiene GitHub); los otros
estados los cubre `panelpublicar.js` del lado del maestro, no la página.

**45 · La llave que se soltaba sola.** Cobrar en línea tiene que escribir tres
cosas juntas —el libro de pagos, los datos de entrega y el acta de
Validaciones— bajo la llave de Apps Script, para que dos compradores no aparten
la misma unidad. El acta la escribía `sellar()`, que **toma la llave y la suelta
al terminar**. La llave de Apps Script no se anida: pedirla otra vez la da, y
soltarla la suelta para todos. Así que el acta, escrita primero, dejaba el libro
de pagos y los datos de entrega escritos SIN llave. Lo cazó el emulador desde
que la llave sabe si está tomada (D-2): `pagos.js` exige que cada escritura del
cobro vaya `conLlave`. Arreglado partiendo `sellar()` en dos —la llave, y
`escribirActa()` para quien ya la tiene—. Verificado en rojo volviendo a
`sellar()`. Es el tipo de fallo que en producción no se ve nunca, hasta el día
en que dos personas pagan la misma torta en el mismo segundo.

**46 · Los datos del comprador que se colaban por la puerta de atrás.** La
página guarda el cobro en `sessionStorage` para sobrevivir a la ida y vuelta de
la pasarela. La regla era no guardar nada del comprador —la misma de la bandeja
de salida— y el objeto que se guardaba lo cumplía… salvo por `checkout`, que es
lo que se le pasa a Bold y lleva dentro nombre, correo, celular y dirección. Lo
vio una traza de depuración, no una prueba. Ahora se guarda sin esos dos campos
—Bold los tiene como opcionales— y `pagoweb.js` busca el nombre, el celular, el
correo y la dirección en lo guardado. Verificado en rojo. La lección es la de
siempre con los objetos anidados: «no guardo X» se comprueba buscando X en lo
guardado, no leyendo el código que arma lo guardado.

**47 · El carrito que se perdía al volver de pagar.** Al volver de la pasarela
la página se recarga y arranca con el catálogo de RESPALDO, el que va horneado
en el archivo. El carrito guardado se filtraba contra ese catálogo, y un
producto dado de alta en la hoja después del último horneado no está ahí: el
carrito volvía vacío y el comprador que había sido rechazado no tenía qué
reintentar. Ahora el carrito vuelve tal cual y **no se sanea mientras hay un
cobro en pantalla** (es el pedido que el maestro ya firmó); se sanea al volver
al carrito, ya con el catálogo bueno. `pagoweb.js` lo prueba con un producto
que solo existe en la hoja.

**48 · Una prueba que miraba la pantalla que se estaba yendo.** La batería de
navegador leía el número del cobro justo después de pulsar «Pagar» — pero la
pasarela de mentira navega a la vuelta cincuenta milisegundos después, y a
veces el número era el de la página que se iba. El síntoma era un carrito
vacío, y parecía el fallo 47; no lo era. Se espera la vuelta, no el reloj. Y en
el camino: el servidor de pruebas escribía toda celda como texto, y el maestro
—con razón— no lee «1» escrito como texto como un número (una cifra que no se
puede leer no vale nada). Una hoja de verdad guarda un 1 tecleado como número;
`/__celda?num=1` hace lo mismo.

**49 · Lo que la otra línea hizo con sus Actions, y lo que ya teníamos.** El
dueño pidió comparar. De sus siete medidas, cinco ya estaban aquí desde M1, dos
no: `release` repetía la suite entera sobre el commit que el push ya había
probado, y `fotos`/`montaje` corrían las 45 baterías para publicar datos. Se
tomaron las dos, con una diferencia: allá la guardia corta se usa siempre; aquí
**solo si GitHub confirma que el último commit de código pasó la suite**. Si el
código entró en rojo, o no se puede preguntar, corren todas. Una guardia que se
salta pruebas tiene que saber por qué se las puede saltar — si no, es un atajo.
Medido en la misma máquina: 47 s la corta, 102 s la entera.

**50 · El montaje que se negó a publicar, y tenía razón.** Después de subir los
pagos, el dueño corrió `montaje` y falló con cinco baterías en rojo. Una sola
causa: la tienda se hornea con la versión que CONTESTA el maestro publicado, y
el publicado seguía siendo el viejo —se había corrido sin la casilla del
maestro—. Con versiones distintas la página desconfía del maestro y no da por
verificado ningún total: por eso cayeron `e2e`, `movil`, `enlace` y `pagoweb`,
todas por lo mismo. La guardia corta (13 baterías, recién estrenada) hizo lo
que tenía que hacer: frenar la publicación antes de subirla. La lección no es
de código, es de lectura: **cinco rojos con la misma causa se leen desde el que
nombra la causa** (`LA VERSIÓN del maestro y la del index`), no desde el
primero de la lista.

**51 · Un `try/catch` que se tragaba la prueba.** El registro de cambios (D-6)
anota de qué producto era la celda editada a mano leyendo la columna A con
`getValue()`. El emulador de la hoja no tenía `getValue()` —solo
`getValues()`—, y como anotar nunca puede tumbar una edición, la llamada va
dentro de un `try/catch`: el registro salía sin el nombre del producto y nada
fallaba. Lo cazó la aserción que pide el `baguette` en «Dónde». Un `catch` que
protege al comerciante también protege al defecto de la prueba; por eso la
aserción mira el contenido de la fila y no solo que exista.

**52 · Una promesa escrita en un comentario.** El horneado decía, junto a sus
topes de variantes: «están escritos tres veces… lo que no se puede es que digan
números distintos, y eso lo comprueba variantes.js». `variantes.js` no lo
comprobaba. Al bajar los topes para C-1b (de 4 y 24 a 3 y 20) había que
cambiarlos en tres sitios, y nada habría avisado si se olvidaba uno. Ahora
`inventario.js` lee los tres. **Un comentario que dice «esto lo comprueba X» se
verifica abriendo X.**

**53 · La tarjeta que hablaba de la última combinación mirada.** Con inventario
por combinación, la tarjeta de un producto decía «Últimas 2 unidades» —las de
la nude M que el comprador acababa de mirar en la ficha— en vez del total. La
causa era el orden: agregar desde la ficha repintaba las tarjetas CON LA FICHA
ABIERTA, y el stock se calculaba con su elección. Ahora se cierra la ficha y
después se agrega, y la elección de la ficha solo vale mientras está abierta.
Al verificar en rojo, quitar esa segunda guarda ya no pone roja la batería: la
primera la tapa. Queda como defensa en profundidad, y dicho aquí para que nadie
crea que la cubre una prueba.

**54 · La compatibilidad que decidió el diseño.** El plan decía que las filas
del inventario por combinación las genera el maestro «con el stock vacío», y
también que un producto con Variantes y sin filas «se comporta como hoy». Las
dos juntas tenían un hueco: en cuanto el maestro generara las filas, el
producto tendría filas… vacías, y la suma sería cero. **Generar las filas
habría agotado la tienda.** La regla que las hace compatibles: el producto pasa
a venderse por combinación solo cuando UNA de sus filas tiene un número.
`inventario.js` lo prueba en rojo quitando esa condición.

**55 · La página 404 de otro comercio.** `publicar/404.html` seguía con el
título y los colores de Orgánico. Se hornea desde la plantilla en cada
montaje, pero ninguna batería miraba el archivo del repositorio. Ahora
`marca.js` lo revisa como a la plantilla y al maestro.

**56 · El index, siempre una publicación por detrás.** El montaje volvió a
fallar igual que en la 50 —`LA VERSIÓN del maestro y la del index`, maestro
2026-09-21-2 contra index 2026-09-21-1— y esta vez la explicación de la 50 no
alcanzaba. Mirando el flujo en orden: el **sondeo** (B-3, M1) pregunta
`bloques` al principio de la corrida, **antes** de publicar el maestro, y
preparar-index lo lee de ahí con `--desde`. Con la casilla del maestro marcada,
el index se horneaba con la versión que contestaba el maestro ANTES de
publicarse: siempre una por detrás, y las baterías en rojo aunque todo se
hubiera hecho bien. Lo metí yo con el sondeo y ninguna prueba cruzaba
«sondeo» con «publicar el maestro». Tres arreglos: `publicar-maestro.mjs` tira
el sondeo en cuanto la versión nueva queda publicada (`olvidarSondeo()`), su
comprobación espera hasta un minuto a que Google sirva la versión nueva, y
`preparar-index` **se niega a hornear** si el maestro vivo no es el del
repositorio, con un mensaje que dice qué casilla marcar, en el resumen de la
corrida. `montaje.js` prueba los tres, en rojo quitando cada uno. **Una caché
de diez minutos también es una caché**: lo que cambia dentro de la corrida la
invalida. *(mío)*

**57 · La hoja decía Pasarela y la tienda cobraba por WhatsApp.** Con la 0.8.0
publicada, `cobro_modo` en Pasarela y la tienda seguía mandando al WhatsApp.
La causa, confirmada por el dueño: las llaves de Bold no habían quedado
guardadas en las propiedades del script. El maestro hacía lo correcto —sin
llaves no se ofrece un botón que va a fallar— y lo decía en el Diagnóstico y
junto al campo en «Tu tienda»… donde nadie estaba mirando. Tres cambios: el
panel lo dice **arriba, en rojo, en las dos pantallas**, con el nombre exacto
de la llave que falta; las llaves se buscan también con el alias de la línea
anterior (`BOLD_BOTON_*`), sin mirar mayúsculas ni espacios en el nombre, y con
`_PRUEBAS` además de `_SANDBOX`; y `PAGOS-BOLD.md` dice que hay que pulsar
«Guardar propiedades del script». Del mismo día: el primer montaje de la 0.8.0
volvió a fallar y el segundo, un minuto después, pasó. Lo más probable es
Google tardando en servir la versión recién publicada; `preparar-index` ahora
espera hasta tres minutos **solo si el maestro se publicó en esa misma
corrida**. Sin haber visto el log no lo doy por seguro: si vuelve a pasar, el
resumen de la corrida ya trae el mensaje entero. **Un aviso que existe pero se
lee en otra pestaña no es un aviso.** *(el mensaje, mío)*

**58 · Dos funciones con el mismo nombre, y ganó la última.** Para los cupones
(0.9.0) escribí una `fechaIso` que devuelve el día (AAAA-MM-DD). Ya había una
`fechaIso` que devuelve la fecha con hora, y la usan los pedidos del panel. En
Apps Script dos `function` con el mismo nombre no dan error: gana la última,
en silencio. Los pedidos del panel quedaron con la fecha sin hora («hace 5
horas» pasó a contar desde la medianoche UTC) y ninguna batería lo vio, porque
ninguna miraba la hora. Lo encontré al escribir M5. La nueva se llama `diaIso`,
y `esquema.js` ahora falla si una función del maestro se declara dos veces —en
rojo con el defecto puesto—. Quedó publicada una versión (la 0.9.0) con el
fallo: se arregla sola al publicar esta. *(mío)*

**59 · El emulador que repetía los números al azar.** `Utilities.getUuid()` del
emulador devolvía un UUID con los primeros 24 caracteres fijos. Mientras nadie
lo usaba para azar no importaba; cuando el maestro pasó a sacar de ahí el
número de pedido (M5), `crearCobro` se quedó buscando un número libre para
siempre y `pagos.js` y `pagoweb.js` se colgaron. El emulador ahora da un UUID
aleatorio de verdad, como Google. **Un doble de prueba que simplifica una
propiedad que el código real sí promete termina mintiendo el día que alguien
depende de ella.**

**60 · Un control negativo que no se ponía rojo.** Al quitar el tope de cinco
intentos por código de recuperación (2.3), `recuperar.js` seguía en verde. El
tope sí existía; lo que pasaba es que el bloqueo general de la entrada —cinco
fallos seguidos— saltaba al mismo tiempo y paraba al código bueno por su
cuenta. Dos guardas que se tapan entre sí hacen que la prueba mida la que no
es. Ahora la prueba limpia el bloqueo general antes de mirar el tope por
código, y en rojo se pone roja. Es el mismo caso que la entrada 53, del otro
lado: allá la guarda redundante quedó como defensa en profundidad; aquí se
aisló para poder probarla.

**61 · El enlace de rastreo que se quedaba en la otra pestaña.** Probando un
pago real, el enlace «Sigue tu pedido» no salió ni en la pantalla de pago
confirmado ni en el WhatsApp. En la 0.10.0 el secreto del rastreo nacía en el
navegador del comprador y se guardaba en `sessionStorage` para mostrarlo al
volver de Bold; pero `sessionStorage` es de UNA pestaña, y Bold puede devolver
al comprador a otra —en la prueba, además, el pago empezó en Brave (el botón de
Bancolombia falló) y terminó en Chrome—. Ahora el secreto de un pedido cobrado
en línea lo pone el maestro, derivado del número y la firma de la tienda: lo
vuelve a calcular cuando quiere y se lo da solo a quien tiene el token del
cobro (`pago_estado`), además de mandarlo en el correo al comprador. `pagoweb.js`
lo prueba borrándole el secreto a la página antes de aprobar. **Lo que tiene
que sobrevivir a un viaje por un tercero no puede vivir en una pestaña.**

**62 · Los filtros de pedidos que había que tocar dos veces.** Cada toque en
«Nuevo», «Pagado»… era una ida y vuelta a Google (dos o tres segundos), la
lista se vaciaba mientras tanto, y si se tocaba otro filtro antes de que
contestara el primero, la respuesta vieja llegaba después y pisaba a la nueva:
de ahí el «a veces toca dar clic dos veces». Ahora los pedidos se traen una vez
y se filtran en la página, sin red; cada lectura lleva turno y solo se pinta la
última; mientras llega, se ve la lista de antes. Los ajustes de la tienda,
igual: se releen, pero solo se repintan si cambiaron. Del mismo día: el
Registro no decía quién había aprobado un pago en línea; ahora dice «Pasarela
Bold · transacción».

**63 · «Nada que publicar pese a haber detectado novedades».** El comerciante
pulsó «Publicar» y el flujo `fotos` salió en rojo en el último paso. No faltaba
nada: otra corrida (un montaje, o un «Publicar» anterior) había publicado lo
mismo minutos antes. El `concurrency` pone las corridas en fila, pero el
checkout de la que espera es el commit del momento en que SE PIDIÓ, no el de
cuando arranca: contra ese commit viejo veía novedades, horneaba lo que ya
estaba en `main`, y contra el `main` de ahora no quedaba nada. Ahora, si lo
horneado difería del commit de arranque pero no del `main` actual, la corrida
dice «Ya estaba publicado» y sale en verde; si no difería de ninguno, sigue
siendo el fallo de antes, que avisa que los dos pasos no miran lo mismo.
**Lo prueba** `montaje.js`, corriendo el trozo real del flujo sobre un
repositorio de juguete; control en rojo sin el arreglo.

**64 · Una segunda persona en el panel, y dónde viven sus permisos.** El dueño
pidió que alguien le ayude sin ver a dónde llega la plata. Lo tentador era
esconder campos en la página; eso no es un permiso, es un adorno: la página la
controla quien la usa. Los permisos quedaron en el maestro —una lista que
filtra lo que se enseña y rechaza lo demás al guardar, aunque la página lo
mande— y el testigo del colaborador sale de su propia huella, así que quitarlo
cierra sus sesiones sin tocar las del dueño. Un detalle que la prueba cazó: la
clave nueva del colaborador pasaba por la caché de operaciones (seis horas);
ahora se añade a la respuesta después. **Lo prueba** `colaborador.js` (31);
controles en rojo sin el filtro al guardar y sin `soloDueno`.

**65 · Ver antes de publicar.** Guardar no publica, y hasta hoy la única forma
de ver un cambio era publicarlo. La vista previa no necesitó nada nuevo en el
maestro: la tienda ya sabía leer la hoja en vivo (era su segundo camino, para
cuando no hay `catalogo.json`); con `?vista` lo toma primero, lo dice arriba,
no deja pedir y no toca la hoja. **Lo prueba** `vistaprevia.js` (13), con el
catálogo publicado simulado en el navegador; control en rojo sin el salto.

**66 · La flota, versión 1 — y lo que enseñó la primera tienda real.** La
regla era «sobrescribir, nunca fusionar». Al mirar Cinnamon Beauty contra
Orgánico aparecieron dos cosas: Cinnamon tenía un arreglo del SEO que su
semilla todavía no, y un `todas.sh` con su batería propia. Sobrescribir los
habría borrado sin ruido. La regla se quedó, con una tabla: cada archivo contra
la versión de la que salió la tienda, y lo que cambiaron las dos no se toca y
se dice. Segunda cosa: Orgánico no tiene la etiqueta `v3.6.1`, de la que salió
Cinnamon; sin base, la flota no pisa nada que difiera. Y tercera, la más
grande: Orgánico y Cinnamon son de la línea 3.x, con otra hoja; se conectan a
la flota con **su** semilla, y pasarlas a esta línea es una migración aparte.
Vive en `laboratoriodigital/tiendas` (`flota.json`, `flota/`, flujo `flota`,
35 pruebas sin red, una de punta a punta con repositorios de juguete).

**67 · Dos productos, no una migración.** El dueño cambió el mapa: Orgánico y
Cinnamon no son tiendas viejas por traer a esta línea, son **la Tienda
Básica** —solo la hoja, más rápida—, y esta es **la Tienda Panel** —más fácil,
más cara, más lenta—. Lo que ayer era la tarea 3.6 del roadmap hoy es un «no».
Aprendizaje: la diferencia de esquema entre las dos hojas (bitácora 66) era
la señal de que eran dos productos, no dos versiones.

**68 · La tienda se actualiza sola, y dos cosas que no dejaba GitHub.** Todo
automático pedía que alguien hiciera lo que hacía una persona: rehornear con
los secretos de la tienda y fusionar. La flota no tiene esos secretos, así que
la actualización se mudó al `montaje` de la propia tienda, que ya sabía
publicar el maestro, hornear y probar. Dos muros: el `GITHUB_TOKEN` no puede
escribir `.github/workflows` —se resolvió con `SEMILLA_TOKEN`, y sin él se trae
lo demás y se dice—, y un maestro publicado antes de que fallen las baterías
deja la tienda viva con un maestro que su index no espera —se resolvió
volviendo a publicar el de antes, el del commit con el que arrancó la
corrida—. Dos detalles que cazaron las pruebas: el contenido de una sección
`<details>` cerrada no tiene `innerText` (hay que leer `textContent`), y el
tope de líneas del stub contaba una por opción cuando cada una cuesta dos.
**Lo prueba** `actualizar.js` (36), con repositorios de juguete de punta a punta.
*(Hoy: lo de `SEMILLA_TOKEN` no funcionó ni una vez —bitácora 103—; los flujos
de una tienda los entrega la flota.)*

**69 · El alta, desde el repositorio de servicio.** `tiendas` › alta › crear
hace lo que GitHub deja hacer desde ahí y deja escrito, con los datos de esa
tienda, lo que no: la cuenta de Google, la hoja y el maestro (cada tienda en
su cuenta, a propósito) y el diálogo de Cloudflare. `conectar` pone los
secretos y dispara el primer montaje. Como el flujo aparcado de antes, no se
documenta como el camino normal hasta que corra una vez de punta a punta.

**70 · El primer alta: «gh: Not Found (HTTP 404)», y un formulario que pedía
lo que todavía no existe.** El alta creaba la tienda con la API de plantillas
(`/generate`), que exige la semilla marcada como *Template repository* y un
token que la vea; falló con un 404 que no nombraba ninguna de las dos. Y el
formulario pedía de entrada la URL del maestro y su token, que no existen
hasta que la tienda tiene hoja. Ahora son dos flujos de tres campos: `alta`
(nombre, comercio, producto) CLONA la última etiqueta de la semilla —ya no
hace falta la marca de plantilla, y la tienda nace en una versión con nombre,
la base de sus actualizaciones—, la limpia de lo que es de otra tienda
(catálogo, fotos, fichas, imagen, dominio, `release`, `tienda.json`), y antes
de tocar nada pregunta si el token ve la semilla y lo dice en palabras.
`conectar` (nombre, URL, token) le pregunta al maestro por su hoja y su
proyecto, le escribe a la hoja el comercio, la dirección y el repositorio sin
pisar lo escrito, pone los secretos y dispara el primer montaje. Cloudflare
pasó al final de la lista: conectado antes, publicaría lo que no es la tienda.
**Lo prueban** 69 aserciones de `flota/pruebas.mjs`; control en rojo quitando
la limpieza del dominio.

**71 · El aspecto.** El dueño pidió el panel más sobrio. Se hizo con un
bloque de CSS al final que solo retoca —tinta casi negra, un gris, bordes más
suaves, más aire, foco visible, cifras tabulares—, sin tocar un id ni una
clase, porque las baterías leen la página por ellos, y sin fuentes de fuera
(la política de seguridad no las deja). El panel de la flota nació con el
mismo lenguaje: una página estática que escribe el flujo `estado`, sin
JavaScript, sin pedir nada al abrirse, para servir detrás de Cloudflare Access.

**72 · Sembrar los secretos desde el diagnóstico (3.4).** Medido en la línea
vieja: la mitad del montaje de una tienda se iba copiando secretos de una
pantalla a otra. Con `conectar` ya se sembraban cuatro (`MAESTRO_URL`,
`MAESTRO_TOKEN`, `HOJA_ID`, `SCRIPT_ID`) y el alta pone `SEMILLA_TOKEN`; faltaba
el permiso de GitHub del maestro, sin el cual Publicar y Actualizar desde el
panel no hacen nada. Ahora el maestro tiene la puerta `permiso` (token de
montaje, solo POST, no pisa uno puesto) y `conectar` se lo pone con
`DISPARO_TOKEN`, un token que solo sabe disparar flujos. A mano queda UNO:
`CLASPRC`, la credencial de Google de la tienda, que nadie más puede crear. Y
un error de la lista del alta, cazado al escribir esto: decía que el token
sale del menú › Diagnóstico, y ese menú no lo enseña a propósito — sale de
`diagnosticoCompleto()` en el editor, que ahora también dice dónde está
`conectar`. **Lo prueban** `permiso.js` (8) y 72 aserciones de la flota.

**73 · Las fotos con dominio propio: las dos maneras (decisión 22).** Con
`tienda.laboratorio-digital.com` se puede elegir que Cloudflare transforme las
fotos. No se quitó la manera de siempre —tres tamaños hechos en el montaje—:
es gratis sin límite y es el respaldo de la otra. Lo que faltaba era saber si
lo elegido de verdad pasa: una zona sin *Transformations* activado deja la
tienda viéndose igual, sin el ahorro, y nadie se entera. Montaje y Publicar
ahora lo preguntan con una foto del catálogo y lo dicen, sin tumbar nada.
**Lo prueba** `fotoscdn.js` (8).

**74 · «Falta HOJA_ID» en `conectar`, con el diagnóstico diciendo que sí.** El
primer `conectar` de verdad paró ahí, y el dueño tenía razón en extrañarse: el
diagnóstico abría la hoja. Los dos tenían razón. El editor y
`diagnosticoCompleto` corren el código de la cabeza; la aplicación web corre la
**versión implementada**, y esa era de antes de pegar `HOJA_ID`. El orden de
DESPLIEGUE lo invitaba: implementar (paso 5) antes de instalar (paso 7). Desde
la 0.17.0 `A0_instalar` guarda `HOJA_ID` también en las propiedades del script
—que son de todas las versiones— y el maestro las lee si la constante llega
vacía; el mensaje dice las dos salidas, y `conectar` también. La tienda que ya
existe necesita una sola vez *Implementar › Gestionar implementaciones › lápiz
› Nueva versión*. **Lo prueba** `hojaid.js` (5).

**75 · La hoja de administración de tiendas se llena sola.** La hoja «Panel de
tiendas» era el registro del negocio, pero cada tienda había que pegarla a mano
con su servicio y su token: lo mismo que `conectar` ya sabía. Ahora la hoja
tiene una puerta de escritura (`doPost` · `registrar_tienda`) con su propia
clave (menú › *Clave para el alta*, guardada en sus propiedades) y `conectar`
le deja la fila si tiendas tiene `PANEL_URL` y `PANEL_CLAVE`. Una tienda que ya
estaba solo actualiza servicio, token, sitio y producto: contacto, plan,
precio y notas son del operador y no se tocan. La columna *Producto* va al
final (R1). Y la hoja tomó el mismo lenguaje que los dos paneles: tinta, un
verde, un rojo, un ámbar, sin cuadrícula. Del flujo `alta` se fue
`tienda-nueva.yml`, el formulario viejo con los campos que ya no se usan.
**Lo prueban** `paneltiendas.js` (8) y 75 aserciones de la flota.

**76 · El stub de la tienda equivocada.** El dueño contó que el menú de la hoja
nueva solo le funcionó cuando pegó el stub «desde tienda» y no desde el
repositorio clonado. Funcionaba, sí, y era el peor de los dos resultados: un
stub generado por el maestro de OTRA tienda lleva la URL y el token de esa
otra, así que el menú aparece, contesta y administra —publica el catálogo, lee
los pedidos— de la tienda de al lado. El token no puede cazar esto: es el token
correcto del maestro equivocado. Lo que sí distingue una hoja de otra es su
ID, y el stub está pegado DENTRO de la hoja, así que ahora lo manda en cada
petición y el maestro rechaza lo que no es suyo, diciendo qué hacer. Un stub
anterior no manda nada y sigue funcionando: no se dejan tiendas sin menú por
una comprobación nueva. **Lo prueban** 5 aserciones de `menu.js`.

**77 · Volver atrás, que no existía.** Había copias semanales de la hoja, había
etiquetas de cada versión y había un commit por publicación: tres puntos de
restauración completos, y ninguna manera de volver a ellos que no fuera pegar
celdas a mano o editar archivos en GitHub. El modelo, entero, son esas tres
cosas con una puerta cada una: los datos, desde el editor del maestro
(`A5_respaldos` los lista, `A6_restaurarDatos` devuelve pestañas sueltas); el
sitio y la versión, desde el flujo `restaurar` de cada tienda. Tres decisiones
lo sostienen. Restaurar **no borra**: el sitio vuelve en un commit NUEVO
encima, nunca con un `push --force`, así que restaurar también se puede
deshacer. Restaurar **no puede traer lo que pasó**: Pedidos, Pagos, Datos de
entrega y el Registro no están en la lista, porque traer el domingo un
miércoles borra las ventas del lunes para arreglar un catálogo. Y antes de
tocar nada se guarda una copia, porque restaurar mal también es perder. La
única pieza nueva fue una línea en `actualizar-semilla.mjs`: pedir una versión
exacta ahora permite bajar, porque negarse ahí dejaba una tienda rota sin más
salida que editarle los archivos. **Lo prueba** `restaurar.js` (21).
*(Después: el sitio no volvía nunca —«Ya estaba así» siempre— hasta la 0.22.3;
bitácora 106.)*

**78 · «Aún no veo por dónde acceder».** El panel de tiendas eran tres pestañas
y las acciones vivían en la pestaña Actions de otro repositorio: para mirar una
tienda había que saber en qué columna estaba cada cosa, y para actuar, en qué
flujo. El portal es una pantalla —menú de la hoja › **Abrir el portal**— con
cada tienda, sus cifras y sus enlaces: ver la tienda, su panel, su repositorio,
publicar, volver atrás; y arriba, alta, conectar y actualizar la flota. Se
abre desde la hoja a propósito: no hay nada que desplegar ni que proteger,
porque quien puede abrir la hoja ya es quien puede ver esto. Y abrirlo no
consulta a ninguna tienda: pinta lo de la última actualización, que es lo que
evita que mirar cueste ejecuciones de Apps Script. **Lo prueban** 7 aserciones
de `paneltiendas.js`.

**79 · Los botones del portal llevaban a ninguna parte.** El portal saca el
dueño de la flota de la columna *Repositorio* de la pestaña Tiendas, y ahí cabe
lo que uno pega del navegador: `https://github.com/dueño/tienda`. Partido por
la barra, el «dueño» era `https:` y los botones apuntaban a
`github.com/https:/tiendas/actions/…`. `conectar` escribe la forma corta, así
que esto solo se ve en las filas puestas a mano — que son justo las primeras.
Se arregla donde se lee, no donde se usa: `leerTiendas` normaliza el
repositorio (quita el `https://github.com/`, el `.git`, las barras de más) y lo
que no tenga forma de `dueño/nombre` deja de ser un repositorio: el portal lo
dice en ámbar en vez de fabricar un enlace roto. La fila de ejemplo que deja
`instalar` tampoco sale ya en el portal, porque su repositorio es
`laboratoriodigital/[repositorio]`. Y si la flota no se llama `tiendas`, se
fija en las propiedades del panel (`REPO_FLOTA`). **Lo prueban** 5 aserciones
de `paneltiendas.js`.

**80 · La documentación que se quedó en el camino viejo.** El mapa de
despliegue seguía diciendo que el camino corto «todavía no ha corrido de punta
a punta en una tienda de verdad» —ya había montado dos— y presentaba los
dieciséis pasos manuales como el procedimiento de referencia; el roadmap tenía
en PENSADO o SIGUIENTE cosas hechas hacía dos versiones (3.3, 5.1), un número
3.10 repetido y los puntos de la fase 3 en desorden. Es el patrón 2 otra vez,
en documentación: la que no se actualiza en el mismo movimiento que el código
no miente enseguida, miente después. Ahora `DESPLIEGUE.md` abre con el camino
normal —qué hace `alta`, qué es de Google, qué hace `conectar`, y qué queda
corriendo solo después—, los pasos numerados están marcados con ⚙ cuando los
hace un flujo, y el roadmap dice al principio de la fase 3 qué está hecho y qué
sigue, en orden.

**81 · Medir sin quedar atados (decisión 23).** Faltaba lo obvio: nadie sabía
cuánta gente entra a una tienda. Se pedía «lo más sencillo posible», y lo más
sencillo es también lo que menos compromete: una clave en la hoja
—`analytics_id`— y el fragmento oficial de GA4 horneado en el `<head>`. Vacío
es el valor de fábrica y significa exactamente nada: sin script, sin cookies,
sin conexiones, y la política de seguridad de esa tienda ni nombra a Google.
Lo que costó pensar fue la otra mitad del encargo —no cerrarle la puerta al
medidor propio—: la página no llama a `gtag` por ahí suelto, llama a
`medir(evento, datos)`, que hoy se lo pasa a Google, no revienta nunca y no
mide la vista previa. Los tres puntos de medida ya están puestos (agregar al
carrito, enviar pedido, pagar en línea), así que el medidor propio será una
línea dentro de esa función y no una vuelta por todas las pantallas. Y la
trampa que casi se cuela: `_headers` es igual en todas las tiendas y se aplica
a la vez que el `<meta>`, mandando la más restrictiva — si no nombrara a
Google, la tienda que sí mide mediría cero sin un solo error visible, que es
exactamente lo que ya pasó una vez con `connect-src` y el catálogo. **Lo
prueba** `medicion.js` (14).

**82 · Tres documentos que faltaban, y el guardia que los mantiene vivos.** El
dueño pidió tres cosas: un runbook para el técnico que despliega, la lista
completa de lo que hace el producto, y la radiografía de la arquitectura «sin
suponer nada, con los secretos, dónde se crean y cómo se renuevan». Escribirlos
es media tarde; que sigan siendo ciertos dentro de tres versiones es el
problema de verdad —es el patrón 2 aplicado a la documentación, y ya nos costó
cuatro documentos borrados en la 3.0.0—. Así que los tres nacen con guardia:
cada `secrets.X` de cualquier flujo y cada propiedad que el maestro o el panel
tocan **tienen que estar nombradas** en `ARQUITECTURA.md`; el runbook solo
puede mandar ejecutar funciones que existen y nombrar flujos que existen; y la
lista de funcionalidades no puede dejarse fuera una opción del menú. Los tres
guardias se verificaron en rojo antes de darlos por buenos. **Lo prueban** 9
aserciones de `montaje.js`.

**83 · «Ver la tienda» llevaba al dominio de antes.** La columna *Sitio* de la
hoja de administración la escribió `conectar` el día del alta, con la dirección
que entonces existía; cuando la tienda se mudó a su dominio propio, esa celda
se quedó con la vieja y el botón del portal llevaba allí. El dato estaba en dos
sitios y uno se quedó atrás: patrón 2, otra vez. La dirección la sabe la
tienda —es su `sitio_url`, la misma con la que se hornea el canónico—, así que
ahora el portal enseña la que dice la tienda y `actualizar` copia esa dirección
a la fila y lo anota en la bitácora. Si la tienda no contesta, se usa la de la
fila: quedarse sin enlace es peor que un enlace viejo. **Lo prueban** 6
aserciones de `paneltiendas.js`.

**84 · El acabado, y tres peticiones que sobraban.** Para salir al aire se
pidió un aire más moderno «sin sacrificar velocidad ni simplicidad». Lo primero
que se fue, entonces, fue la tipografía de Google: dos `preconnect` y una hoja
de estilos de fuera antes de pintar una sola letra, en una tienda que presume
de no depender de nadie. Con la pila del sistema la página no espera a nada y
el carácter lo dan el peso, el interletrado y la escala. Lo demás es una capa
de acabado **al final de la hoja de estilos**, que no toca un id ni una clase
—el mismo procedimiento del panel en la 0.15.0, y por la misma razón: un
rediseño que mueve el HTML hay que volver a probarlo entero—: esquinas de 10px,
botones en píldora, líneas más claras, una sombra mínima en las tarjetas,
cifras tabulares en los precios y una respuesta de 120 ms al pasar y al pulsar.
Y, ya que no se cargan tipografías, la política de seguridad dejó de permitirlas
en sus tres copias: un permiso que sobra es una puerta abierta sin nadie detrás.

**85 · El diagnóstico donde trabaja el comercio.** El informe existía desde
siempre y vivía solo en el menú de la hoja; el comerciante que trabaja en el
panel no abre la hoja, así que llamaba para preguntar por qué su tienda «se
veía rara». Ahora está en el panel —*Revisión de tu tienda*, sin secretos y solo
para el dueño—, y de paso aprendió lo que las últimas versiones le enseñaron a
mirar: si el `HOJA_ID` vino de las propiedades (la versión implementada puede
ser anterior), qué versión del stub está pegada en la hoja, si el maestro tiene
su permiso de GitHub —sin él, Publicar y Actualizar no disparan nada—, si la
medición está encendida y bien escrita, y si de verdad se puede volver atrás:
cuántas copias hay y de cuándo es la última. Se pide a demanda, porque mirar no
puede costar una ejecución en cada visita.

**86 · El panel de la flota, publicado sin manos.** Se podía conectar el
repositorio en Cloudflare y esperar a que publicara solo, pero eso depende de
que alguien lo haya conectado. Con `CLOUDFLARE_API_TOKEN` y
`CLOUDFLARE_ACCOUNT_ID` en `tiendas`, el propio flujo `flota` › estado publica
`panel/` como Worker de recursos estáticos después de escribirlo. Sin esos dos
secretos no falla: lo dice en el resumen y sigue, porque un panel sin publicar
no es una avería. Lo que falta para dejarlo a la vista de verdad es ponerle
Cloudflare Access delante, que está explicado en `DESPLIEGUE.md`.

**87 · Dos mensajes que mandaban a mirar donde no era.** El primer intento de
actualizar `prueba1` desde la flota contestó «Ninguna tienda de esta línea en
esos anillos», y la tienda estaba en `flota.json`, en la línea correcta y en el
anillo 2. Lo que pasaba es que el campo *solo esta tienda* pide
`dueño/repositorio` y se escribió `prueba1`, que es como se llama la tienda en
todas las demás pantallas; al no encajar ninguna, el flujo daba la frase de «no
hay tiendas en esos anillos», que manda a revisar los anillos —lo único que
estaba bien—. Ahora se acepta el nombre corto y, cuando lo pedido no existe, se
dice eso, con la lista de las que sí hay y su anillo. El segundo fue peor,
porque el mensaje era correcto y aun así engañaba: pedir la actualización desde
el panel contestaba «No encuentro el repositorio laboratoriodigital/prueba1, o
el permiso no lo incluye». GitHub contesta **404 y no 403** cuando un token de
grano fino no alcanza un repositorio —no confirma que exista—, así que el
maestro no puede distinguir los dos casos; pero sí se puede decir cuál es el
probable: un `DISPARO_TOKEN` hecho sobre «Only select repositories» no incluye
las tiendas que nacieron después, y el alta crea una tienda nueva cada vez. El
mensaje ahora lo explica y, mejor todavía, `conectar` lo comprueba **antes** de
sembrar el permiso: pregunta con ese mismo token si ve el repositorio y lo dice
en el resumen. **Lo prueban** 4 aserciones de la flota.

**88 · El anillo, donde se mira.** «¿Cómo sé a qué anillo pertenece cada
tienda?» — estaba en `flota.json`, un archivo de un repositorio privado, y en
el panel estático de la flota. Quien opera mira el portal, así que ahora el
anillo viaja con el registro que manda `conectar` y vive en su propia columna
de la pestaña Tiendas —al final, R1—, con su chip en el portal. El dato sigue
decidiéndose en `flota.json`: esto es una copia para mirar, y se reescribe cada
vez que `conectar` pasa por ahí.

**89 · Rotar el token no arreglaba nada.** Se cambió `DISPARO_TOKEN` por uno
nuevo, se volvió a correr `conectar`… y la tienda siguió diciendo lo mismo,
ahora con 401: «el permiso no sirve o se venció». La causa era una regla
nuestra, escrita con buena intención: el maestro **no pisa un permiso ya
puesto**, para no quitarle a una tienda un token más acotado que alguien puso a
mano. Con esa regla, el único camino para cambiarlo era una casilla de forzar
que nadie sabía que existía, y el síntoma sobrevivía a la cura. La corrección
es medir en vez de suponer: antes de respetar el token guardado, el maestro le
pregunta a GitHub por el repositorio de ESTA tienda con ese mismo token; si
contesta, se respeta; si no —401, 403, 404 o silencio—, el que llega lo
reemplaza y queda anotado por qué. Un token que no abre la puerta no es un
token que haya que cuidar. Queda además la casilla `forzar_permiso` en
`conectar` para el caso contrario: cambiarlo aunque el actual sirva. **Lo
prueban** `permiso.js` (11) y 1 aserción de la flota.

**90 · El cronómetro tumbó el montaje.** La tienda de prueba publicó bien y la
corrida terminó en rojo: `Cannot find module montar/tiempos.mjs`. Ese archivo
mide cuánto tardó cada paso —es un servicio, no el trabajo—, y ese repositorio
no lo tenía. Lo que enseña el fallo no es dónde quedó el archivo, sino tres
huecos de diseño: un flujo puede llamar a una herramienta que ESE repositorio
no trae, y Node se cae sin decir que lo que falta es el cronómetro; una
herramienta ignorada por git viviría en la semilla y no llegaría nunca a
ninguna tienda, y nadie lo notaría hasta semanas después, en el repositorio de
otro; y el alta entrega la tienda sin comprobar que trae lo que sus propios
flujos ejecutan. Los tres se cerraron: el paso de los tiempos comprueba que el
archivo esté y, si no, lo dice en el resumen y sigue; una batería exige que
todo `node montar/x.mjs` de cualquier flujo exista **y esté versionado**; y el
alta se planta antes de entregar si la etiqueta que clonó no trae alguna. La
tienda que ya está se cura sola en la próxima actualización, que es la que le
lleva el archivo. **Lo prueban** 3 aserciones de `montaje.js` y 2 de la flota.

**91 · La prueba que solo era verdad hasta el día 28, y el resumen que no decía
de qué corrida era.** Las baterías se cayeron en Actions sin que nadie hubiera
tocado una línea: 2439 de 2440, y la que faltaba era la de los cobros del panel.
Sembraba dos tiendas —una que cobra el día 1 y otra el 28— y exigía que
**exactamente una** estuviera vencida. Eso es cierto del 2 al 28 de cada mes; el
29 las dos lo están, y el día 1 ninguna. La aserción no probaba la regla, probaba
la regla *y* el calendario del día en que se escribió. El producto estaba bien:
`cobrosDelMes()` marca vencido lo que tiene el día de cobro antes que hoy, y eso
no dependía de nada. Ahora los días se siembran relativos a hoy —el de ayer
vencido, el de hoy no— y, lo que importa más, `panel.js` entró en la máquina que
ya existía para esto: `calendario.js` la corre con el reloj falseado en diez días
de dos meses, entre ellos el 1, el 28 y los que solo existen en los meses largos.
La herramienta llevaba dos versiones cazando esta clase de fallo en el tablero y
en el correo; la batería que dependía del día estaba justo al lado, fuera de la
lista.

Aprovechando el viaje se revisaron los resúmenes de los **ocho** flujos de los
dos repositorios, que es lo único que lee quien no escribió el flujo. Tenían tres
defectos del mismo tipo. No decían **qué eran**: la página empezaba por el
volcado de la tercera herramienta, sin decir de qué tienda era la corrida, en qué
versión estaba, qué se había pedido ni quién lo había pedido. No decían **cómo
quedó la cosa**: «Publicado en `main`» solo aparecía si el paso de publicar
llegaba a correr, así que una corrida roja terminaba sin una sola frase sobre si
la tienda estaba tocada o no. Y **repetían**: el marcador de las baterías salía
tres veces en la misma pantalla —el TOTAL, la lista de baterías con problemas y
cada línea de FALLA—, que es la otra manera de no decir nada. Los ocho abren
ahora con la misma ficha (qué es esto, sobre qué, cómo está antes de tocar nada,
qué se pidió, quién lo pidió), `montaje` y `fotos` cierran diciendo en qué estado
queda la tienda pase lo que pase, el marcador se dice una vez y en rojo enseña
solo lo roto, y los volcados de cada herramienta quedan plegados a un clic. De
paso apareció un hueco de la 0.20.3: la tolerancia a que falte el cronómetro
estaba en `montaje` y no en `fotos`, que es el que corre todos los días en todas
las tiendas — la misma caída esperando en el flujo de al lado. **Lo prueban** 2
aserciones nuevas de `panel.js` y 1 de `calendario.js`, 5 de `montaje.js` y 4 de
la flota; y las tres que vigilan la forma del resumen se vieron en rojo antes de
darlas por buenas.

**92 · El permiso de la semilla tumbó el primer paso, y el error que se veía era
otro.** La tienda de prueba no conseguía actualizarse: cada montaje terminaba en
rojo con `Cannot find module montar/tiempos.mjs`, el fallo de la bitácora 90, que
ya estaba arreglado. No era eso. Arriba del todo, fuera de la pantalla, el
`checkout` moría con **403 · Write access to repository not granted**: TODOS los
pasos siguientes quedaban saltados y el único que llegaba a correr era el del
cronómetro, que lleva `always()` y se caía por un archivo que la actualización
—la que nunca llegó a correr— era justo la encargada de traer. El error visible
era el síntoma del síntoma.

La causa: `montaje` se bajaba el repositorio con `SEMILLA_TOKEN || github.token`.
Ese permiso se copia a cada tienda para poder empujar sus `.github/workflows`, que
el `GITHUB_TOKEN` de Actions no puede escribir nunca; pero es de grano fino y el
de esta flota estaba acotado a la semilla. Un permiso pensado para UNA cosa
—empujar flujos— colgado del paso del que cuelga todo lo demás: si no alcanza,
la tienda no puede ni bajarse a sí misma, y encima no puede recibir el arreglo,
porque el arreglo viaja dentro de la actualización que no corre.

Tres cambios. El `checkout` vuelve al permiso propio de la tienda, que siempre
alcanza. El flujo PREGUNTA una vez si el de la semilla llega hasta aquí
(`GET /repos/…`) y, si no, lo dice en el resumen con lo que hay que ampliar
—*Repository access*, *Contents* y *Workflows* en escritura— en vez de dejar un
403 suelto. Y el empujón elige: con el de la semilla cuando sirve, con el propio
cuando no, así que un permiso corto deja los flujos una versión atrás pero no
deja la tienda sin publicar lo demás. La lección es la de siempre, en su versión
más cara: **un permiso opcional no puede estar en el camino crítico**, y un paso
que corre `always()` después de un desastre cuenta su propia pena, no la del
desastre. **Lo prueban** 6 aserciones de `actualizar.js` y 1 de `montaje.js`,
todas vistas en rojo antes de darlas por buenas.

**93 · La suite daba por hecho que corría en la semilla.** Con el permiso ya
arreglado, la primera tienda se actualizó de verdad —0.16.0 → 0.20.4, 28
archivos sobrescritos y 8 nuevos— y entonces se cayó en el paso siguiente: cinco
baterías en rojo dentro de la tienda, y sin ese verde no se publica. Ninguna de
las cinco estaba mirando un fallo del producto. `montaje.js` abría
`.github/workflows/release.yml`, que `alta` no le hereda a ninguna tienda porque
una tienda no corta versiones: ENOENT, batería entera caída y de paso
`calendario.js`, que la corre con el reloj falseado. `exif.js` pedía
`chonto-1.jpg`, una foto de muestra que tampoco se hereda. El control negativo de
`respaldo.js` exigía encontrar palabras del comercio de la plantilla en
`publicar/index.html`, que en una tienda es la tienda del comercio: se caía por
tener razón. Y `medicion.js` comparaba las tres copias de la política de
seguridad contra un `publicar/_headers` de la 0.16, porque ese archivo no viajaba
nunca.

Lo que enseña es una asimetría que no habíamos escrito: **estas baterías corren en
dos sitios** —aquí, y dentro de cada tienda antes de publicar— y estaban escritas
mirando solo uno. Una aserción cierta aquí y falsa allá no protege: bloquea. Y el
motivo que queda escrito en el resumen de la tienda es «batería en rojo», que no
es el motivo. Ahora lo que depende de SER la semilla se comprueba solo aquí y en
una tienda se salta diciéndolo (patrón 8, regla 2); la foto del manifiesto sale de
la carpeta y no de una lista escrita a mano; el control negativo del respaldo
escribe un TERCER comercio en el mismo archivo, así que no depende de qué
repositorio sea; `publicar/_headers` pasa a ser de la semilla —la única excepción
dentro de `publicar/`, y dicha— para que la política de seguridad deje de
quedarse en la versión en que nació la tienda; y una aserción nueva recorre las
baterías y exige que nadie abra a ciegas un archivo que una tienda no tiene.
**Lo prueban** 3 aserciones nuevas de `montaje.js` y 1 de `actualizar.js`, más una
tienda de juguete —sin lo que `alta` no hereda— donde la suite se corrió entera
antes de dar esto por bueno.

**94 · Actualizar escribía y nunca borraba.** Con las baterías ya arregladas, la
tienda de prueba llegó más lejos y se paró en una sola aserción: «el alta vieja no
existe». Y tenía razón: ahí estaba `servicio/`, el flujo de alta que la semilla
retiró en la 0.17.0, vivo dentro de una tienda nacida en la 0.16. La razón es que
la actualización solo sabía escribir: recorre los archivos de la versión NUEVA y
decide cuál copiar, así que lo que la semilla quitó no se quita en ninguna
parte — vive para siempre en cada tienda anterior. Casi siempre eso es basura
inofensiva; esta vez era basura que hacía fallar una batería DENTRO de la tienda
y, con ella, la publicación entera.

Ahora la versión nueva declara en su `semilla.json` qué retira, y la
actualización lo borra allá y lo dice en el resumen. La lista viaja con la
semilla y no con la tienda —una regla, un sitio— y va acotada, porque borrar es
lo único que no se puede deshacer: rutas relativas de dentro de la tienda, sin
`..`, sin raíz absoluta, y nunca `publicar/` —lo que el comercio publica— ni
`.git`. Lo que no encaja no se toca y sale nombrado en el informe. Un detalle que
importa: retirar algo cuenta como cambio aunque no se escriba ningún archivo, o
la tienda volvería a arrastrarlo en la corrida siguiente. Y una aserción cierra
el círculo: la semilla no puede retirar nada que todavía entregue. **Lo prueban**
4 aserciones de `actualizar.js`, con el control negativo —dejar borrar
`publicar/`— visto en rojo.
*(Después: el borrado ocurría en el disco de la corrida y no entraba en el
commit de `montaje`; bitácora 106.)*

**95 · Rompí sola la regla que acababa de escribir, y por eso ahora hay una
tiendita.** Tercera corrida seguida de la misma tanda, tercer rojo del mismo
tipo: una aserción cierta aquí y falsa dentro de la tienda. Esta vez la había
escrito yo en la entrada anterior —«la semilla no retira nada que todavía
entregue»—, que dentro de una tienda pregunta otra cosa: si esa tienda todavía
arrastra el resto viejo. Y sí lo arrastra, porque la actualización que borra lo
retirado es la que acaba de llegar, no la que corrió: **el que se actualiza a sí
mismo siempre ejecuta la versión anterior de sí mismo**, así que la limpieza
llega una versión más tarde. Escrita sin guarda, esa aserción bloqueaba justo la
publicación que lleva el arreglo. Lo mismo pasaba con «el alta vieja no existe»,
que también habla de la semilla.

Las dos se guardaron, pero lo que importa no es eso. La regla ya estaba escrita
—bitácora 93, con su aserción y todo— y aun así se rompió dos entradas después,
lo que quiere decir que no bastaba con escribirla. Ahora hay quien la vigile:
`pruebas/tiendita.js` arma una copia de este repositorio SIN lo que `alta` no
hereda, le mete de propina un resto de una versión vieja —lo que se encontró en
la primera tienda de verdad— y corre ahí las baterías que leen archivos del
repositorio. Tarda tres segundos y reproduce en el equipo lo que antes solo se
veía en la tienda de un cliente, veinte minutos y un montaje después. La primera
vez que se corrió encontró exactamente los dos rojos que la tienda estaba
enseñando en ese momento. **Lo prueban** ella misma, sus cinco aserciones, y las
dos guardas que la hicieron falta.

**96 · El permiso se sembraba primero y se comprobaba después.** La tienda ya
publicaba sola, y al tocar *Publicar* desde la hoja salió «el permiso de esta
tienda no sirve o se venció». El `DISPARO_TOKEN` de `tiendas` —el que el maestro
guarda como `GITHUB_TOKEN` para disparar flujos— está vencido o es de grano fino
sobre «Only select repositories» y no incluye a esa tienda. Eso solo, ya estaba
previsto: `conectar` lo comprueba y lo dice (bitácora 87). Lo que no estaba
previsto es el ORDEN. El comentario de la comprobación decía, con todas sus
letras, «se le pregunta aquí, ANTES de sembrárselo», y el programa hacía lo
contrario: sembraba el token y después preguntaba si servía. Como desde la
0.20.2 el maestro reemplaza el permiso que ya no sirve por el que llega
(bitácora 89), un token muerto **pisa uno bueno**, el aviso queda tres líneas
más abajo en un resumen que nadie vuelve a abrir, y el fallo sale semanas
después, en el mostrador, el día que el comercio toca Publicar.

Ahora se comprueba primero y, si no sirve, no se siembra: un permiso muerto no
borra al que la tienda pudiera tener. `conectar` no se cae por eso —los
secretos, la hoja y el primer montaje son lo que de verdad conecta una tienda—;
deja el aviso de GitHub en la corrida y dice qué ampliar. La lección es sobre los
comentarios: este describía la intención y llevaba versiones contradiciendo al
código de al lado. Un comentario no vigila nada; ahora hay una aserción que lee
el propio archivo y exige que la comprobación esté escrita ANTES de la siembra.
**Lo prueban** 3 aserciones de la flota, con el control negativo —invertir las
dos líneas— visto en rojo.

**97 · Se comprobaba el permiso preguntando por la puerta equivocada.** El
comercio tocaba Publicar y le salía «el permiso de esta tienda no sirve o se
venció» —con `DISPARO_TOKEN` bien puesto en `tiendas`, sobre todos los
repositorios del dueño—. El maestro tenía guardado un token viejo y no lo
reemplazaba, porque desde la 0.20.2 solo reemplaza el que ya no sirve… y la
comprobación de «sirve» era `GET /repos/{tienda}`, que solo demuestra *Metadata:
read*. Un token que ve el repositorio y no puede disparar nada pasaba la prueba y
se respetaba para siempre. Ahora se pregunta por los FLUJOS de ese repositorio,
que ya exige *Actions* —el permiso del que depende el botón—. No prueba la
escritura, porque probarla sería dispararla, pero descarta el caso que costó la
tarde. Volver a correr `conectar` reemplazó el token y el botón funcionó. **Lo
prueba** 1 aserción de `permiso.js`, con su control negativo.

**98 · El logo, y el archivo que ya estaba en su carpeta.** La clave `logo`
existía desde hacía versiones y solo aceptaba una URL de Cloudinary, que era la
única forma que había cuando se escribió: el comercio que sube su logo al Drive
—la misma carpeta donde ya tiene sus fotos— no tenía manera de usarlo. Ahora se
nombra igual que en la columna Imágenes del catálogo: el archivo (`logo.png`) o
una dirección completa, y lo resuelve `urlFoto()`, el mismo sitio por donde pasan
todas las fotos. Tres decisiones del dueño, y las tres estrechan a propósito:
**solo la barra** —ni portada ni pie: importa más que la página siga siendo una
sola petición y no se mueva al cargar—, **el mismo archivo sirve de icono** de la
pestaña —pedir dos archivos para lo mismo es pedir que uno se quede viejo— y **el
nombre sigue escrito** al lado, con el logo en `alt` vacío, porque lo que nombra
la tienda es lo que leen Google y un lector de pantalla y eso no se cambia por una
imagen. Si el archivo no llega, vuelve el signo dibujado en vez de un icono roto;
el logo cuenta como foto usada, así que el montaje deja de llamarlo «foto que
nadie usa» y empieza a avisar por nombre cuando está mal escrito; y el respaldo se
lo lleva, así que la marca se ve también con Google caído. **Lo prueba**
`pruebas/logo.js`, 21 aserciones.

**99 · «Nada que publicar pese a haber detectado novedades», otra vez, y esta vez
era una lista.** El flujo `fotos` decide qué publicar con una lista de rutas
escrita en el propio flujo (`PUBLICA`), y esa lista no incluía
`publicar/404.html` —que escribe `preparar-index`, una de las herramientas que ese
mismo flujo corre—. Así que al cambiar el nombre o los colores, el paso que MIRA
decía «hay novedades», el que PUBLICA no encontraba nada suyo, y la corrida moría
con un mensaje que suena a fallo de git y era una lista incompleta. Cada
herramienta ya declara lo que escribe (A-8 · `ESCRIBE`), así que la lista no se
revisa a ojo: una batería compara las dos cosas para todos los flujos. Y el
mensaje de ese fallo, que decía «mira los dos volcados», ahora enseña la lista de
lo que el flujo publica y el estado de TODO el repositorio, que es donde se ve si
el horneado escribió en otro sitio. **Lo prueba** 1 aserción de `montaje.js`, con
su control negativo.

**100 · El último copiar-y-pegar del despliegue, y la lista que paraba a la
flota.** Quedaba un paso manual en cada versión: abrir `panel.gs`, copiarlo y
pegarlo en el Apps Script de la hoja de administración. No era un problema
técnico sino una omisión: es EXACTAMENTE el mismo trabajo que el montaje ya hace
con el maestro de cada tienda —`clasp push` y actualizar la implementación—,
sobre otro proyecto. Así que lo hace la misma herramienta: `publicar-maestro.mjs`
recibe `ARCHIVO` y sube el que le digan, y un flujo nuevo en `tiendas` —`panel`—
clona la semilla en la versión pedida y la llama con `ARCHIVO=panel.gs`. Copiar
esa herramienta al otro repositorio habría sido la misma regla en dos sitios, y
la copia se separa de su original el día que una de las dos cambia (patrón 2).
Lo único distinto entre los dos casos es la hoja: el maestro lleva el id de la
suya horneado porque puede vivir suelto, y el panel está pegado a la suya y la
abre con `getActive()`. Dos secretos nuevos, solo en `tiendas`:
`PANEL_SCRIPT_ID` y `PANEL_CLASPRC`.
*(Después: `panel` nunca le entregaba `PANEL_CLASPRC` a clasp, así que no
había podido subir nada; bitácora 106.)*

En la misma tanda, `flota` › actualizar se detuvo en seco: «**prueba-panel**: no
pude leer su versión — 404. Me detengo aquí», y ninguna tienda recibió nada. El
repositorio de esa tienda de prueba ya no existe y su fila seguía en
`flota.json`, que lo edita una persona. Una tienda que NO ESTÁ no es un fallo de
la versión que se está repartiendo —es un dato viejo—, así que ahora se dice, se
salta y al final se recuerda cuáles hay que quitar de la lista; lo que sigue
deteniendo a la flota es una tienda que está y falla, que es para lo que existen
los anillos. Si no existe NINGUNA de las pedidas, eso sí es rojo: alguien pidió
repartir una versión y no se repartió a nadie. Y de paso, `actualizar.mjs` se
ejecutaba al importarlo: la batería que quería comprobar una función suya
arrancaba la actualización de la flota entera. Ahora lleva el mismo remate que
las demás herramientas —corre cuando se lanza, no cuando se importa—. **Lo
prueban** 3 aserciones de `montaje.js` y 8 de la flota.

**101 · Un archivo que nadie pidió dejó la tienda sin publicar.** La tienda de
prueba corrió su actualización entera —2473 aserciones en verde, el catálogo
horneado, las fotos bajadas— y el push se rechazó: «refusing to allow a GitHub
App to create or update workflow `.github/workflows/fotos.yml` without
`workflows` permission». GitHub no rechaza EL ARCHIVO: rechaza el push entero.
Así que la tienda se quedó sin publicar su catálogo, su índice y sus fotos por un
archivo de flujo que la actualización había escrito y que ni el comercio ni nadie
había pedido en esa corrida.

La causa de fondo es una asimetría que ya conocíamos y no habíamos rematado: el
`GITHUB_TOKEN` de Actions no puede escribir `.github/workflows` NUNCA, y el
permiso que sí puede —`SEMILLA_TOKEN`— es opcional. Lo que faltaba era que esa
asimetría no se pagara con todo lo demás. Dos redes, a propósito, porque la
primera depende de una comprobación que puede fallar y la segunda no depende de
nada: **no se commitea lo que no se va a poder empujar** —si los flujos están en
el índice y no hay permiso para ellos, se sacan y se publica el resto—, y si aun
así el rechazo llega, **se quitan del commit y se vuelve a empujar una vez**. En
los dos casos el resumen dice qué se quedó atrás y con qué llega: un
`SEMILLA_TOKEN` con *Contents* y *Workflows* en escritura sobre esa tienda. Una
publicación a medias es mejor que ninguna, siempre que se diga cuál es la mitad
que falta. **Lo prueban** 4 aserciones de `montaje.js`, con su control negativo,
y una simulación con un repositorio de juguete para comprobar que los comandos
hacen lo que el comentario dice.

**102 · Por qué la automatización de las tiendas tardó tanto, y el cambio que lo
cierra.** Lo pidió el dueño después de la duodécima vuelta: cada arreglo
destapaba el fallo siguiente, y cada fallo costaba media hora —cambio, push,
release, montaje en la tienda, captura, diagnóstico—. El último fue `config.js`
rojo dentro de prueba1: cuatro aserciones que daban por hecho que el icono de la
pestaña es el marcador dibujado, y prueba1 tiene logo —que desde la 0.21.0 es el
icono—. El propio archivo tenía escrita, desde hace meses, la lección exacta:
«el flujo `montaje` corre las baterías sobre el index.html que acaba de escribir
CON LA CONFIGURACIÓN DE ESA TIENDA, así que cualquier cosa quemada aquí es una
tienda que no se puede montar». La lección estaba escrita y se rompió igual.

Esa es la conclusión de la revisión: **no era mala suerte ni falta de cuidado;
era la arquitectura.** Mirando las entradas 90 a 102 juntas salen cinco causas,
y la primera explica casi todo:

1. **La guardia que decidía si una tienda publica era la suite de desarrollo de
   la semilla.** ~2.480 aserciones escritas para probar el código de la semilla,
   con los datos de muestra de la semilla, en el repositorio de la semilla. Al
   actualizarse, cada tienda las corría TODAS contra SUS datos y SU repositorio.
   Cada suposición de «ser la semilla» era un bloqueo esperando turno: el flujo
   `release` (93), las fotos de muestra (93), el respaldo de la plantilla (93),
   la carpeta `servicio/` (94, 95), un comercio con logo (102). Y no protegía de
   nada, porque el código de una tienda actualizada es el de una etiqueta que
   `release` no corta sin la suite completa en verde: repetir esas pruebas no
   añadía información, solo maneras de fallar. Encima era lo que se comía los
   minutos de Actions: dos a cinco por publicación.
2. **La tienda se actualiza con su versión vieja.** El que se actualiza a sí mismo
   ejecuta la versión anterior de sí mismo, así que un arreglo en el flujo o en
   la herramienta llega una versión tarde, y si la versión vieja bloquea la
   actualización, no hay forma de que la nueva llegue (90, 92, 95, 101).
3. **Cuatro permisos con alcances que se pisan** —`DISPARO`, `SEMILLA`, `FLOTA`,
   `ALTA`— y copias por tienda que envejecen solas (89, 92, 96, 97, 101).
4. **Fallar rápido en producción esconde el fallo siguiente**: cada corrida
   enseñaba uno solo, y cada uno costaba una vuelta entera.
5. **Mi definición de «hecho» era la equivocada**: «la suite en verde en la
   semilla», cuando lo que importa es «una tienda de verdad publica». Varios de
   los rojos los puse yo, con aserciones que eran ciertas aquí.

EL CAMBIO. En una tienda, lo que decide si se publica ya no es la suite: es
**`pruebas/tienda-viva.js`**, que mira los archivos reales de `publicar/` y SOLO
con invariantes —cosas ciertas para cualquier comercio con cualquier hoja, y
falsas únicamente cuando el horneado salió mal—: que la página sepa a qué maestro
preguntar y espere su misma versión, que su política la deje hablar con él, que
el catálogo se lea y no repita identificadores, que el respaldo lleve los mismos
productos que el catálogo y sea de la misma tienda, y que la página abra de
verdad en un navegador y pinte los productos de ESA tienda sin un error. Ni un
nombre, ni un color, ni un producto escritos: una aserción aparte lo exige. Lo
que es del comercio pero no bloquea —una foto nombrada que no subió— se avisa y
no detiene. En la semilla no cambia nada: ahí sí se prueba el código, entero.

La decisión vive en `pruebas/publicacion.sh` y no en el flujo, y eso resuelve la
causa 2 para este cambio: la actualización escribe `pruebas/` ANTES de correr la
guardia, así que una tienda con el flujo viejo ya usa la guardia nueva en la
misma corrida que la trae. Y la tiendita (95) corre ahora esa misma guardia,
también con los datos de OTRO comercio —su logo de icono, otros colores, otro
nombre—, que es exactamente lo que tumbó a prueba1: lo que antes se descubría en
producción se descubre en tres segundos antes del commit. La primera corrida lo
demostró encontrando un rojo mío en la aserción nueva, antes de que saliera de
aquí. Las causas 3 y 4 quedan anotadas en el plan: la 3 ya no tiene huecos
conocidos (89, 96, 97 y 101 los cerraron), y la 4 pierde casi todo su costo
cuando la guardia es pequeña y dice todo lo que falla de una vez. **Lo prueban**
`tienda-viva.js` (12), 4 aserciones de `montaje.js`, 2 de `tiendita.js` y la
revisada de `actualizar.js`, con los controles negativos en rojo —un horneado
contra otro maestro, un catálogo y un respaldo de corridas distintas, un error
de JavaScript en la página— y el positivo en verde: los datos de prueba1.

**103 · Ningún push de una tienda usó nunca `SEMILLA_TOKEN`, y los flujos pasan a
ser de la flota.** Con la tienda viva, prueba1 pasó la guardia en dos segundos
—12/12— y el push volvió a rechazarse: «refusing to allow a GitHub App to create
or update workflow». Esta vez se entendió por qué, y no era el permiso: el
montaje intentaba empujar con `SEMILLA_TOKEN` metido en la URL, y eso **no
funcionó ni una sola vez**. `actions/checkout` deja en `.git/config` una cabecera
de autorización con el permiso de Actions, y git la manda en cada petición a
GitHub gane quien gane en la URL. Mientras el checkout se hacía con
`SEMILLA_TOKEN` —hasta la 0.20.5— esa cabecera ERA la del token bueno y todo
funcionaba sin que nadie supiera por qué; cuando en la 0.20.5 lo cambié por el
permiso propio (bitácora 92, con buena intención), todos los pushes de todas las
tiendas pasaron a ir con el de Actions. Desde entonces ninguna tienda pudo
recibir flujos nuevos, y como el arreglo de cada cosa viajaba justo en esos
flujos, ninguna podía salir de ahí sola. Las bitácoras 101 y esta son el mismo
fallo visto dos veces.

La solución no es otro truco con el token sino quitarle a la tienda un trabajo
que no puede hacer. **Los flujos de una tienda los entrega la flota**: `FLOTA_TOKEN`
tiene *Workflows* en escritura sobre todas, así que `flota/flujos.mjs` copia los
`.github/workflows` de la semilla, en la versión pedida, a cada tienda —por la
API de contenidos, solo los que cambian—. Lo hace sola `flota › actualizar`
después de cada tienda que se actualiza bien, y se puede pedir a mano con
`flota › flujos`, que es también el rescate de una tienda atascada. Del lado de
la tienda, sus flujos no van nunca en su commit: los saca `publicacion.sh` —que
llega con la actualización ANTES de correr, así que funciona con el flujo viejo
que hay que rescatar— y los saca también el paso «¿Cambió algo?» del flujo
nuevo. El empujón deja de fingir que otro token en la URL cambia algo. Y
`SEMILLA_TOKEN` en cada tienda deja de hacer falta para los flujos: un permiso
menos por tienda, que era la causa 3 de la revisión. **Lo prueban** 7 aserciones
de la flota —con un GitHub de mentira en memoria: escribe solo lo que cambia,
pasa el `sha` al reemplazar, no escribe nada en ensayo—, 1 de la tiendita sobre
un git de verdad, y las revisadas de `montaje.js` y `actualizar.js`, con sus
controles negativos en rojo.

**104 · «Nada que publicar pese a haber detectado novedades» no era un caso raro:
pasaba siempre.** Con los flujos ya entregados por la flota, prueba1 se actualizó
en verde por primera vez —montaje #21— y aun así *Publicar ahora* volvió a morir
con ese mensaje. Esta vez se reprodujo con el emulador en vez de adivinar. El
flujo `fotos` decide si hay algo que publicar con un paso que MIRA, y después
otro PUBLICA. El que mira hornea la configuración desde la plantilla y la compara
con `publicar/index.html`; pero lo publicado lleva además lo que escriben después
`sembrar-respaldo` y `sembrar-seo`. Justo después de una publicación perfecta, lo
que mira medía 169.938 bytes y lo publicado 174.271: **distinto siempre**. Así que
el que mira decía «cambió la configuración de la hoja» en cada «Publicar ahora»
de cada tienda, el que publica horneaba exactamente lo mismo, y la corrida moría.
La bitácora 99 había encontrado un hueco real en la lista de `fotos` —`404.html`—,
pero no era ESTA causa, y di por bueno el diagnóstico sin reproducirlo: la lección
de la 102 otra vez.

El arreglo es contestar la pregunta que el paso hace: «¿cambió lo que la hoja pone
en la página?». Se aplica la hoja SOBRE lo publicado: si nada cambió sale idéntico
—comprobado—, y si cambió algo sale distinto justo en eso. Para publicar se sigue
partiendo de la plantilla, que es como llega el código nuevo de la semilla.

Y de paso, lo que se vio en la misma captura: la flota empuja los flujos de cada
tienda con un permiso que sí dispara `pruebas`, y `pruebas` corría la suite
entera de la semilla dentro de la tienda —dos o tres corridas de dos minutos por
entrega, rojas por las mismas suposiciones de la 102—. Ahora `pruebas` decide
con `publicacion.sh` como todo lo demás: en la semilla, todo; en una tienda, la
tienda viva. **Lo prueban** 4 aserciones de `montaje.js`, con el horneado
completo de verdad y su control negativo.

**105 · La flota se detuvo en una tienda que nadie usa.** Con la 0.22.2
publicada, `flota › actualizar` sin «solo esta tienda» tomó primero
`prueba-panel` —una tienda de prueba abandonada, todavía en la 0.15.0, que había
vuelto a aparecer en GitHub—, su montaje falló, y como debe ser «las siguientes
no se tocan»: prueba1, la que sí importaba, se quedó sin versión. No es un error
del producto: para eso son los anillos. Pero la lista no tenía forma de decir
«esta tienda existe y no entra en los repartos», y el mensaje no decía cómo
seguir. Ahora el anillo admite `"fuera"`: la tienda sigue en `flota.json` y en el
estado, pero ni `actualizar` ni `flujos` la tocan hasta que se le devuelva un
número; `prueba-panel` quedó así, con una nota. Y cuando la flota se detiene,
nombra las que quedaron sin tocar y los dos caminos: «solo esta tienda» o
`"anillo": "fuera"`. **Lo prueban** 4 aserciones de `flota/pruebas.mjs`, con su
control negativo (volver `prueba-panel` al anillo 2 la pone roja).
*(Después: `prueba-panel` salió de `flota.json`, porque no aportaba nada, y la
prueba exige ahora que no esté; bitácora 106.)*

**106 · La semilla también es una tienda, y la auditoría encontró tres flujos que
nunca habían funcionado.** Con la 0.22.2 publicada, *Publicar ahora* en la tienda
de la propia semilla se paró con «EL MAESTRO PUBLICADO CONTESTA LA VERSIÓN
2026-09-22-7 Y ESTE REPOSITORIO TRAE LA 2026-09-22-8». A cada hija su
actualización le publica el maestro nuevo; la semilla cambia por push, y a ella
nadie se lo publicaba. La guarda de la bitácora 56 hizo su trabajo: paró antes de
escribir nada. Es el patrón 6 otra vez —lo que se escribió para las tiendas que
vienen después dejó fuera a la primera—. Desde la 0.22.3, `release` le pregunta
al maestro vivo con `preparar-index.mjs --al-dia` y, si quedó atrás, dispara
`montaje` con la casilla del maestro y PUBLICAR, que es lo que habría hecho una
persona; por eso `release.yml` pide ahora `actions: write`. Corre aunque no haya
nada que cortar, así que volver a correr `release` pone al día una semilla
atrasada.

Y auditando la documentación contra el código, para explicar qué hace cada
flujo, aparecieron tres que no habían corrido nunca de verdad. `restaurar ›
el-sitio` comparaba el árbol con el índice justo después de `git checkout
<commit> -- publicar/`, que deja los dos iguales: decía «Ya estaba así» siempre,
y el sitio no volvía nunca. `tiendas › panel` nunca escribía `~/.clasprc.json`,
y clasp solo lee su credencial de ahí: tener `PANEL_CLASPRC` en el entorno no
servía de nada. Y `montaje` borraba en disco lo que `semilla.json › retirados`
retira (bitácora 94), pero solo indexa `publicar/`, `wrangler.jsonc` y los
propios (`git add -A -- $PUBLICA`), así que el borrado nunca entraba en el
commit. Además, `restaurar` corría en otro grupo de concurrencia que `montaje` y
`fotos`, aunque los tres escriben `publicar/` en `main`. Los de git se
reprodujeron con repositorios de juguete. `restaurar` compara ahora contra
`HEAD` y comparte el grupo `tienda-…`; `panel` revisa el secreto con
`revisar-clasprc.mjs` y lo escribe antes de subir; `montaje` añade a lo que
indexa los `retirados` que git todavía conoce (un pathspec que no casa con nada
tumbaría el `git add` entero). Y como un retirado dentro de `.github/workflows`
—`tienda-nueva.yml`— no lo puede quitar la tienda, lo quita la flota:
`flota/flujos.mjs` lo borra por la API con el mismo permiso con que pone los
demás, nunca uno que la semilla todavía entrega.

La misma lectura encontró mensajes que mentían por el patrón 2, en código: el
resumen de `montaje` seguía pidiendo *Workflows* en escritura para
`SEMILLA_TOKEN` y prometiendo los flujos «en la próxima actualización», la
cabecera de `release` hablaba de pull requests por tienda, la de `fotos` de un
reloj de cuatro horas, `conectar` y `alta` mandaban a sacar el token del
Diagnóstico del menú —que no lo enseña, a propósito— y la ayuda de la hoja
decía al comercio que marcara «Confirmado», un estado que ya se llama
«Pagado». Corregidos en la misma versión.

La lección es la de P16, y cuesta decirla: las aserciones de `restaurar` y
de `panel` existían y estaban en verde, porque leían el texto del flujo. **Un
flujo que nunca ha corrido con sus secretos de verdad no está probado.** Y leer
el código para documentarlo es una prueba: los tres los encontró alguien que
tenía que explicar qué hacen.

De paso, `prueba-panel` —la tienda abandonada que la 105 dejó con `"anillo":
"fuera"`— salió de `flota.json`: no aportaba nada, y una fila que nadie usa es
una línea más que leer cada vez. Decisión del dueño. **Lo prueban** 3
aserciones de `pruebas/montaje.js` (el paso de `release`) y 2 más con git de
verdad y el trozo del flujo tal cual (los `retirados` entran en el commit), 2 de
`pruebas/restaurar.js` —con git de verdad—, 1 de `pruebas/actualizar.js` (el
mensaje del permiso) y 5 de `flota/pruebas.mjs` (la credencial de clasp, que
`prueba-panel` ya no está, y la flota que retira flujos, con su ensayo), con sus
controles negativos vistos en rojo: sin el paso de `release`, con la
comparación vieja, sin escribir `~/.clasprc.json` y sin indexar los
`retirados`.

*Ficha:* *(mío)* · 🟠 Grave · P6, P9, P16 · 0.22.3 · 2026-09-29

**107 · La 0.22.3, corrida en la semilla: una batería que solo veía la primera
tienda, y un 404 que no era el acceso.** El `release` de la 0.22.3 hizo lo que
debía: vio el maestro de la semilla atrás y disparó su `montaje`. Ese montaje
murió en «¿Esta hoja es la de esta tienda?» con ««identidad» contestó en 41 s»
y justo después «El maestro respondió 404 a «identidad»… lo primero a descartar
es el acceso de la implementación». El acceso estaba bien: otro montaje minutos
después pasó ese paso. Apps Script entrega la respuesta desde
`script.googleusercontent.com` por una redirección que caduca; si el script
tarda —y 41 s es tardar—, el 404 es de esa redirección. El mensaje ya conocía
esa causa (bitácora del 404 en UNA acción), pero solo la ofrecía si otra acción
había contestado en el mismo proceso, y el sondeo corre en otro. Ahora
`alMaestro` reintenta un 404 que llega tras más de 15 s, dos veces y con pausa,
y si se repite dice cuánto tardó en vez de mandar a mirar el acceso. No lo
reproduje contra Google —no se deja—: se reprodujo la forma, con un servidor
que tarda y contesta 404.

El montaje a mano, con la casilla del maestro, llegó más lejos y murió en las
baterías: `config.js` 22/25, «La pestaña del navegador dibuja un icono propio
-> fotos/tienda-virtual.png». Desde la 0.21.0 `favicon` —o el `logo`— manda
sobre el icono dibujado, y la hoja de la semilla ya tenía logo; la batería solo
sabía ver el dibujo. Es el patrón 4 en la misma batería que dice combatirlo: en
las tiendas no se vio porque su compuerta es la tienda viva (102), pero la
semilla corre la suite entera sobre SU index horneado con SU hoja. Ahora
`config.js` acepta las tres formas que produce `iconoDeLaTienda` —dibujo,
`fotos/<archivo>` que tiene que estar publicado, y `https://`— y en las tres
exige un `theme-color` de verdad.

**Lo prueban** 3 aserciones nuevas en `pruebas/montaje.js` con un servidor
HTTP de verdad (404 lento que se recupera, 404 rápido que no se reintenta, 404
lento que se repite), en rojo sin el arreglo; y `config.js` corrido con el icono
cambiado a una foto que existe (verde) y a una que no (rojo).

*Ficha:* *(mío)* · 🟠 Grave · P4, P9, P15 · 0.22.4 · 2026-09-29

**108 · Toda foto que no fuera `.jpg` se publicaba con otro nombre.** Con la
0.22.4 en verde quedaron dos síntomas que parecían distintos: en la semilla, el
logo `tienda-virtual.png` del Drive no llegó a `publicar/fotos/` y hubo que
subirlo a mano para que el montaje pasara; en prueba1, la foto del producto
—mismo nombre que en el Drive, en `.png`— no cargaba. Mirando la tienda viva:
`catalogo.json` nombraba `tienda-virtual.png`, el manifiesto de medidas tenía
sus tres derivadas webp (200), y `fotos/tienda-virtual.png` daba 404. La causa,
una línea de `traer-fotos.mjs › convertir`: el respaldo «con el nombre lógico»
se escribía siempre como `${raiz}.jpg`, en JPEG. Para una `.jpg` coincidía; para
una `.png` o una `.jpeg`, la tienda pedía un archivo que no existía, y un logo
con transparencia se habría vuelto negro alrededor. `exif.js` lo probaba solo
con `origen.jpg`: el único caso en que el defecto no se ve (P5).

Ahora el respaldo lleva el nombre exacto de la hoja y el formato de su
extensión (PNG conserva la transparencia), y `novedades` vuelve a bajar lo que
el registro da por publicado pero no está en disco: las tiendas afectadas se
curan solas en su siguiente montaje, sin tocar el Drive. De paso, lo que pidió
el dueño al verlo: el logo de la barra iba a 22 px, el tamaño del signo, y no
se entendía; ahora va a 40 px de alto (34 en el celular), con ancho libre hasta
un tope y sin el recorte cuadrado de las derivadas.

**Lo prueban** 4 aserciones de `pruebas/exif.js` con conversiones de verdad
(una `.png` con transparencia, una `.JPEG`, y el registro que miente), en rojo
sin el arreglo; y 3 de `pruebas/logo.js` (tamaño legible que cabe en la barra,
sin recorte).

*Ficha:* *(mío)* · 🔴 Crítico · P1, P5 · 0.22.5 · 2026-09-29

**109 · Cada opción nueva costaba un paso a mano en cada tienda.** El dueño
pidió el logo al doble y preguntó si elegir 40, 80 o 120 desde la hoja era
costoso. El código es poco —una clave `opcion` como `catalogo_columnas`, una
variable de CSS y una barra que crezca—. Lo caro estaba en otra parte: el panel
solo enseña las claves que la pestaña Configuración ya tiene, y solo
`instalar()` las agregaba. Cada clave nueva habría pedido abrir el editor de
Apps Script de cada tienda y correr `A0_instalar`, que es justo el tipo de paso
que esta automatización existe para quitar (la 0.11.0 ya lo pedía para
`catalogo_columnas`, y nadie lo había contado como costo). Ahora la puerta
`configuracion`, al abrir Ajustes, agrega las que falten con su valor de
fábrica y sin tocar ninguna escrita —lo mismo que hace `instalar()` con una hoja
vieja—, y la página lee una clave ausente como su valor de fábrica. Así
`logo_tamano` (40, 80 de fábrica, 120; en el celular 34, 52 o 68) llega a todas
sin tocar ningún editor.

De paso, `medicion.js` exigía que `analytics_id` fuera la ÚLTIMA clave de la
hoja: se puso roja con la primera clave nueva. Lo que R1 pide es que cada clave
entre al final *cuando nace*, no que sea la última para siempre.

**Lo prueban** 4 aserciones de `pruebas/panelconfig.js` (la clave nace en 80;
en una hoja vieja aparece sola al abrir Ajustes, sin tocar lo escrito, y se
guarda), en rojo sin el arreglo; 4 de `pruebas/logo.js`; y 4 de
`pruebas/config.js` que MIDEN el logo en el navegador (40/80/120, la barra lo
contiene, «grande» se lee 80, el celular baja), probadas sobre un index
horneado con la plantilla nueva; con el publicado viejo se saltan y lo dicen.

*Ficha:* *(mío)* · 🟡 Medio · P20 · 0.23.0 · 2026-09-29

**110 · La hoja estaba en el orden en que nacieron sus columnas, no en el que se
leen.** El dueño pidió precio por variante, una hoja ordenada —Catálogo primero,
columnas lógicas, listas donde haya opciones, Configuración por secciones, sin
la «Hoja 1» vacía, lo que se escribe a mano dentro del formato y un aviso si
falta algo obligatorio—, unificar los permisos de GitHub y una última revisión
de las Actions. Lo caro no era dibujar la hoja: el maestro leía Catálogo **por
posición** (`f[4]` es el precio), así que la regla R1 —«solo se agrega, y al
final»— había dejado Referencia, Precio antes, Umbral bajo y Variantes al fondo,
lejos de Precio y Stock, y mover una columna habría convertido precios en otra
cosa en silencio. Ahora Catálogo e Inventario por variante se leen **por el
nombre de su encabezado** (`mapaDeColumnas`): el código sigue hablando en el
orden de su ENCABEZADO y la hoja puede estar en el orden que se lee
(`ORDEN_VISIBLE_…`). Si una columna no se encuentra —alguien la renombró—, se lee
por posición, como antes, y se dice; y `asegurarColumnas` no le agrega una
«Precio» vacía que le robaría la lectura. Las columnas se mueven enteras
(`moveColumns`: valores, fórmulas, formato). Configuración va por secciones con
los títulos del panel (una fila «▸ …» no es una clave); todo lo que tiene
opciones sale con su lista desde la misma tabla que usa el panel (patrón 2); el
formato y las listas cubren mil filas por delante, no solo las escritas; lo
obligatorio se pinta en rojo con formato condicional; las pestañas van en el
orden en que se usan, con color; y la «Hoja 1» vacía se quita. Todo eso lo hace
`instalar()` y, en las tiendas que ya existen, la revisión de cada hora una vez
por versión (`ponerHojaAlDia`): ninguna tienda tiene que correr A0_instalar.

**El precio por variante** va en `Inventario por variante › Precio`, al lado de
Stock: vacío = el del producto. Lo cobra el maestro (`validarPedido` usa el de la
combinación), lo publica el catálogo (`precios`), la página lo muestra («Desde»
en la tarjeta, el de la elección en la ficha y el carrito) y el panel lo edita
junto al stock. Un precio ilegible no regala ni cobra el del producto: esa
combinación no se vende y queda anotada.

**Las Actions** (revisión con evidencia): `pruebas` cancela la corrida vieja de
la misma rama; se instala solo el Chromium sin ventana; ningún trabajo queda sin
tope de tiempo. Y dos fallos de verdad: cada commit de «Publicar ahora» decía
«las fotos NO se pudieron traer» porque leía `$fallo_fotos` desde OTRO paso —
otra shell, variable vacía, y vacío ≠ "0"—; y la ficha de `release` nunca veía
la última versión porque el checkout no baja etiquetas.

**Los permisos**: tres tokens en vez de cuatro (`ALTA_TOKEN` se funde en
`FLOTA_TOKEN`, que ya vivía en el mismo sitio y alcanzaba los mismos repos);
`SEMILLA_TOKEN` y `DISPARO_TOKEN` siguen aparte por menor privilegio. El análisis
señaló que `DISPARO_TOKEN` alcanza también a `tiendas`; el dueño aclaró que el
proyecto del maestro es de la cuenta de Laboratorio Digital y el comercio solo
edita la hoja, así que el token no queda a su vista: el riesgo queda anotado y
se cierra si esa cuenta se cuida.

**Lo prueban** `pruebas/presentacion.js` (hoja ordenada, hoja vieja que se ordena
sin perder datos ni fórmulas, encabezado renombrado, secciones, listas, filas
futuras con formato, reglas de obligatorios sin duplicarse, la revisión horaria),
`pruebas/combinaciones.js` (el precio en la tarjeta, la ficha, el carrito y el
sello; y la combinación vetada) con su control negativo —con el maestro cobrando
el precio del producto, el sello sale en 8.000 y la prueba se pone roja—,
`pruebas/inventario.js` (panel y maestro) y `pruebas/montaje.js` (topes, cancelación,
Chromium y la variable de las fotos). La suite entera corrió además sobre un
index con el código nuevo trasplantado, como lo dejará el montaje.

*Ficha:* *(mío)* · 🟠 Grave · P2, P4, P14, P20 · 0.24.0 · 2026-09-29

**111 · Ordenar Configuración borraba primero, y Google no dejaba escribir
después.** Con la 0.24.0 en la semilla, el dueño corrió `A0_instalar` en la
tienda de prueba del alta y salió «Exception: Elige de la lista: Sí, No»; al
repetirlo, «…WhatsApp, Pasarela» y «…Pruebas, Producción». Cada corrida, otro
texto. La causa: hasta la 0.23 las listas de Configuración se ponían **en la
fila de su clave**. `ordenarConfiguracion` (0.24.0) mete las secciones «▸ …», así
que cada valor cambia de fila y cae en una que tiene la lista de OTRA clave —
«WhatsApp» donde se espera Sí/No—. En Google, una lista con «rechazar la
entrada» rechaza también lo que escribe el script, con su texto de ayuda como
mensaje. Y la función hacía `clearContent()` antes de `setValues()`: al fallar
la escritura, Configuración quedaba vacía, y la corrida siguiente volvía a
agregar las claves con sus valores de fábrica. **Se perdieron los valores de
Configuración de esa tienda.** Lo mismo le pasa, en la revisión de cada hora
(`ponerHojaAlDia`), a toda tienda de antes de la 0.24.0 que reciba el maestro
0.24.0.

Por qué no lo vio nadie: el emulador aceptaba cualquier valor en una celda con
lista (P17), y la prueba de «hoja vieja que se ordena sin perder datos» de la
entrada 110 armaba la hoja vieja **sin** las listas de la 0.23 (P4: probaba la
tienda recién hecha, no la que existe). Esa afirmación de la 110 era falsa.

**El arreglo** (0.24.1): `ordenarConfiguracion` guarda lo de antes, quita las
listas de las filas que toca, escribe todo de una vez y, si falla, vuelve a
dejar lo que había; después `presentarConfiguracion` pone cada lista en la fila
de SU clave. Al hacer que el emulador rechace como Google salieron dos más del
mismo tipo: `migrarEstados` reescribía la columna Estado entera —también los
estados ilegibles que deja como están, que la lista rechaza— y ahora escribe
solo las celdas que cambian; y `restaurarDatos` escribía la copia sobre las
listas de hoy —una copia de antes de las secciones revienta igual, justo en la
herramienta para recuperar— y ahora las quita, vuelve a lo de antes si falla y
las repone siempre al final. El emulador solo rechaza lo que escribe el
**código**: las pruebas siguen pudiendo escribir a mano erratas y estados viejos,
que es lo que hay en las hojas de verdad.

**Lo prueban** `pruebas/presentacion.js` 3e (Configuración con las listas de la
0.23 en su fila: instalar no revienta, no pierde un valor y cada lista queda en
su clave) y `pruebas/restaurar.js` (restaurar una Configuración en otro orden),
ambas vistas en rojo con el código de antes —«Elige de la lista: Sí, No» y los
valores de fábrica—; `pruebas/pedidos.js` ya tenía el estado ilegible que hizo
caer a `migrarEstados`. Suite completa en verde (salvo el ícono de
`config.js`, que falta en el entorno y no en la tienda).

*Ficha:* *(mío)* · 🔴 Crítico · P1, P4, P17, P21 · 0.24.1 · 2026-09-29

**112 · La política de datos prometía que la tienda no guarda nada en el
navegador, y desde la 0.19.0 podía poner cookies de Google.** El dueño pidió el
píxel de Meta «de manera fácil desde configuración» y pensar en la analítica
propia. Al escribir el texto legal del píxel salió lo que nadie había mirado: la
política de tratamiento de datos, en la rama de WhatsApp, dice «no guarda nada
en tu navegador», y **no cambia** cuando la hoja pone `analytics_id`. La clave
decía «hay que avisarlo en la política de privacidad», pero la política la
escribe la página, no el comercio: nadie podía avisarlo. Una afirmación legal
falsa en todas las tiendas que midieran (P18), y la prueba de medición miraba el
`<head>` pero no lo que el comprador lee (P20).

**El arreglo** (0.25.0): la política dice quién mide leyendo lo que **de verdad
se cargó** en la página (`medidores()`: `gtag` o `fbq` definidos), no lo que la
hoja cree; con medidores explica qué se mide, que nunca va el nombre, el celular
ni la dirección, las cookies y cómo bloquearlas, y con Meta, que puede usarse
para anuncios. Sin medidores no habla de cookies. El píxel entra por el mismo
camino que GA4 (clave vacía de fábrica, fragmento horneado, CSP de esa tienda y
siempre en `_headers`) y sus eventos salen por `medir()`, que ahora traduce
**nuestros** cinco eventos a cada destino. Dos cosas que se decidieron con
cuidado: un pedido por WhatsApp es `InitiateCheckout` y no `Purchase` —no está
pagado, y Meta le atribuiría a los anuncios ventas que no existen—, y
`pagar_en_linea` sale al **abrir** la pasarela, no al pagar: el pago
confirmado es un evento nuevo, `pago_confirmado`, que sale una sola vez cuando
el maestro lo confirma.

**Lo prueban** `pruebas/medicion.js` (vacío es vacío, el fragmento y su CSP, lo
que se suele pegar mal, `_headers`, y `medir()` evaluado de la plantilla con un
`gtag` y un `fbq` de mentira: nombres de Meta, datos sin nada personal,
`eventID`, vista previa y un destino que revienta), `pruebas/legal.js` (la
política con y sin medidores) y `pruebas/montaje.js` (las tres copias de la CSP
con todos los hosts de medición que declara el maestro, no solo los primeros).
Controles negativos vistos en rojo: `enviar_pedido` como `Purchase` y la CSP sin
la imagen de Meta.

*Ficha:* *(mío)* · 🟠 Grave · P18, P20 · 0.25.0 · 2026-09-30

**113 · El cierre del MVP: el token salió de la dirección, y cerrarle la puerta
al GET rompía volver atrás.** El dueño pidió cerrar el MVP con lo crucial, poder
pasar las fotos desde la tarjeta sin abrir el producto, y dejar la documentación
al día con un traslado para empezar la 3.0 desde cero. Tres cosas se aprendieron.

**La primera, en el carrusel: `loading="lazy"` no sirve dentro de un carril
horizontal.** La tarjeta con varias fotos es un carril con `scroll-snap` —el dedo
lo mueve sin una línea de JavaScript— y la promesa era que la portada no pesara
más que antes. El control negativo lo desmintió: con todas las fotos en `src` y
`loading="lazy"`, el navegador pidió la segunda foto de cada tarjeta al pintar,
porque está «cerca» del viewport aunque nadie la vea. Por eso las fotos 2 en
adelante esperan en `data-src` y se piden la primera vez que alguien toca, pasa
el ratón, enfoca o desliza esa tarjeta. La caja deja de ser un `<button>`: un
carril no cabe en un botón, y el botón «Ver» sigue siendo el camino del teclado.

**La segunda, y la grave: cerrar el GET rompía volver atrás (P10).** El riesgo
que el plan arrastraba desde el principio —el token de montaje viajaba como `t=`
en la dirección y quedaba en los registros de Google— se cerró del lado de los
clientes: `alMaestro`, `publicar-maestro.mjs`, `conectar` y `panel.gs` lo mandan
en el cuerpo de un POST. Del lado del maestro, lo natural era marcar las puertas
de montaje `soloPost`, y así se hizo primero. El repaso de `DESPLIEGUE.md`
encontró lo que eso rompía, y lo reprodujo: `restaurar › la-version` a una
versión anterior escribe las herramientas VIEJAS —que preguntan por GET— y las
corre contra el maestro 1.0.0, que sigue vivo hasta que se publica el viejo. La
corrida se paraba en «¿Esta hoja es la de esta tienda?» y la tienda no podía
volver atrás sola. Es la misma forma de la causa 2 de la entrada 102, al revés:
el que se actualiza corre su versión vieja, y el que vuelve atrás también. El
maestro **acepta el GET y lo anota** (`TOKEN_POR_GET`: la acción y la fecha,
nunca el token), y el diagnóstico dice quién sigue mandándolo así (P1: el
respaldo que funciona tiene que gritar). Volver atrás vale más que la regla, y
la regla se cumple donde importa: ningún cliente de la 1.0.0 pone el token en
una dirección. Quedan dos, dichos: el stub de cada hoja (su token de menú) y
`panel.gs` hacia una Tienda Básica, cuyo maestro no atiende puertas por POST.

**La tercera: el rojo intermitente de `test.js` tenía causa (P19).** «Pasa sola
y falla con la suite» llevaba desde la 0.22.5 anotado como ruido. El cupón lo
valida el maestro por la red y la batería esperaba dos cuadros de pintura
(`pintado`), que es lo que se espera para lo que no sale de la red. Con la
suite en paralelo la respuesta llegaba después. Ahora espera a que el aviso deje
de decir «Validando…». Un rojo que se da por ruido enseña a no mirar los rojos.

Y lo que se cerró sin código: la causa 4 (que el montaje diga todo lo que falla
de una vez) quedó cerrada por diseño —la guardia de la tienda es pequeña y pone
todas sus FALLA en el resumen; `preparar-index` lista todas las claves que
bloquean— y pasa a la 3.0 como principio. La decisión 36 deja un solo producto:
la Tienda 2.0; Orgánico se migra cliente por cliente, y la definitiva empieza de
cero con `docs/TRASLADO-3.0.md`.

**Lo prueban** `pruebas/fotos.js` §6b (el carril, la segunda foto sin pedir
hasta que alguien toque —control negativo en rojo con `src` y `lazy`—, la flecha
que no abre la ficha, la tarjeta de una foto como siempre), `pruebas/montaje.js`
§0 (POST contesta; el GET contesta y queda anotado sin el token; ninguna
herramienta pone `t=`; `panel.gs` solo a la Básica), `pruebas/sondeo.js` (el
maestro de mentira cuenta los tokens que llegan en una dirección: cero),
`pruebas/panel.js` §2 y §2b, `flota/pruebas.mjs` en `tiendas`, y `pruebas/test.js`
corrido con la suite entera en paralelo.

**Y un rojo después del push, del que ya había aviso.** `pruebas` en la
semilla corre sobre el `publicar/index.html` que está en el repositorio, que es
el de la versión ANTERIOR hasta que el siguiente montaje lo hornea. La batería
nueva de `fotos.js` esperaba un carril que esa página no tiene y se colgaba.
Pasó igual con el precio por combinación en la 0.24.0 (`combinaciones.js`), y
la salida es la misma: si la página publicada no trae el carril, la batería lo
dice con un SALTA y sigue. Aquí no se vio porque la copia de trabajo prueba con
un `publicar/` rehorneado desde la plantilla: probar solo contra la página
nueva es la forma en que P11 vuelve (la prueba da por hecho ser la semilla
recién horneada).

*Ficha:* *(mío)* · 🟠 Grave · P1, P10, P11, P19 · 1.0.0 · 2026-09-30
