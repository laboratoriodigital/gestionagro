# Bitácora de fallos — Parqueadero ED1 (bitácora parqueadero)

Todo lo que se rompió en el parqueadero, quién lo rompió, por qué pasó y cómo se arregló. Sirve para tres cosas:

- que un fallo no vuelva por el mismo camino;
- que quien llegue después vea que las decisiones raras del parqueadero tienen una cicatriz detrás;
- que, al unir las bitácoras del ecosistema en el segundo cerebro de ED1, esta sea la parte de lo que pasa cuando el software **toca el mundo físico**: una impresora por Bluetooth, un teléfono de pie y al sol, la plata contada al final del turno y el dato de una persona que no es cliente de ED1, el conductor.

Esta bitácora nace con cuatro de ventaja:

- la del agro (`../BITACORA.md`), que construyó el CORE v0 y pagó lo que enseñan la nube, el navegador sin red e IndexedDB;
- la del CORE (`../plataforma/BITACORA_CORE.md`), lo que comparten los productos;
- la de la Tienda 3.0 (`../tienda/BITACORA_TIENDA3.md`), el otro producto con datos y dinero de terceros, que nació un día antes;
- la de la Tienda 2.0 (`../tienda/BITACORA-ecommerce.md`), que pagó lo que enseña WhatsApp.

El éxito de esta bitácora se mide por los patrones heredados que **no** reaparecen. El plan está en `BACKLOG-PARKING.md` («plan §N») y las historias de M0, en `BACKLOG-PARKING_MVP.md` («MVP §N»).

**Severidad** = qué tan caro sale, no qué tan difícil fue arreglarlo.

| | |
|---|---|
| 🔴 **Crítico** | Se cobra más que el tope de la ciudad, o se cobra mal; se pierde o se repite un registro o un número de recibo; un recibo sale sin un campo que exige la ley; el número del conductor sale del teléfono por otro camino que WhatsApp, o no se borra; la caja dice «impreso» o «enviado» sin saberlo; el cierre cuadra en la caja y no en la plata. Casi siempre silencioso |
| 🟠 **Grave** | La caja no abre, no registra, no imprime o no restaura, pero se ve; bloquea un turno, la puesta en marcha o un despliegue |
| 🟡 **Medio** | Cuesta tiempo, confunde, o deja una prueba o un documento mintiendo |
| ⚪ **Menor** | Cosmético, redacción, números desactualizados |

---

## Cómo se une con las otras bitácoras (segundo cerebro de ED1)

Las convenciones son las de las bitácoras agro, core y tienda3, para que unirlas sea concatenarlas y no migrarlas:

1. **Los patrones son del ecosistema, no del proyecto.**
   - P1–P21 conservan **el mismo número y la misma regla** en todas las bitácoras. Aquí no se renumeran ni se reescriben; se añaden entradas que los confirman.
   - Un patrón nuevo que nace aquí recibe un id **provisional** `PQ<n>` («patrón parqueadero»), como `PA<n>` en el agro, `PC<n>` en el CORE y `PT<n>` en la Tienda. Pasa a un número global `P<n>` cuando exista el archivo común `CONOCIMIENTO.md`.
2. **Las entradas se citan con su proyecto:** «bitácora parqueadero 1», «bitácora tienda3 2», «bitácora core 4», «bitácora agro 29». El número nunca cambia.
3. **La ficha es la misma línea en todas**, para extraerla con una expresión regular. El proyecto va al principio y la versión es la del parqueadero (`parqueadero-X.Y.Z`); mientras el parqueadero no tenga versión propia (HU-Q0.3), es `parqueadero-0.0.0`:

```
*Ficha:* parqueadero · *(mío)* · 🟡 Medio · P18 · parqueadero-0.0.0 · 2026-10-07
```

4. **Un cambio de rumbo o una lección que ya está en otra bitácora no se copia** (P2): se cita. Las decisiones del diseño hasta el 6 oct 2026 están en `ARQUITECTURA-PARQUEADERO.md` (ADR-31 a ADR-40) y sus cambios del 7 oct, en el plan §1.

---

## Lo aprendido

Lista viva de patrones.

- **En el parqueadero** dice cómo toma forma el patrón aquí.
- **Lo impedirá** es la guardia prevista, con la historia del plan o del MVP que la construye.
- **Lo impide hoy** se escribe solo cuando esa guardia existe, falla en rojo con el defecto puesto y se comprobó al escribirlo.
- **Entradas** son los números de esta bitácora que lo confirman.

Al 7 oct 2026 no hay código del parqueadero. Lo que ya existe son las 56 comprobaciones del modelo de datos con `node:sqlite` (`sql/probar-parqueadero.mjs`), que pasan a D1 en HU-Q7.2, y por eso P1 es el único con «Lo impide hoy».

### Heredados del ecosistema

#### P1 · El fallo que funciona es el caro
- **Regla:** lo que cae a un respaldo, a un valor de fábrica o a un «no pasa nada» tiene que gritar.
- **En el parqueadero:** un monto ilegible nunca vale 0 (`MontoIlegible`); una sede sin datos legales no registra; una impresora apagada deja el recibo pendiente y lo dice, nunca «Impreso»; un número repetido con otro id falla y va a cuarentena, no se pierde como «duplicado».
- **Lo impedirá:** HU-Q1.1, HU-Q3.2, HU-Q3.3, HU-Q3.6, HU-Q7.4.
- **Lo impide hoy:** `sql/probar-parqueadero.mjs`, con `ON CONFLICT (id) DO NOTHING`. Con `INSERT OR IGNORE`, cinco comprobaciones se ven en rojo (bitácora parqueadero 1).
- **Entradas:** parqueadero 1.

#### P2 · Dos copias del mismo procedimiento: una siempre se queda atrás
- **Regla:** una sola fuente, y lo demás se deriva de ella. Si no se puede, una aserción ata las dos copias.
- **En el parqueadero:** `@ed1/dinero` para los pesos; un modelo de recibo y cuatro salidas con su prueba de paridad (ADR-33); `@ed1/whatsapp` reúne las copias de `wa.me` del agro; la misma `parqueadero-tarifas` en la caja y en la calculadora; `estadias` se reconstruye desde `registros`; los topes de cada ciudad, en contenido.
- **Lo impedirá:** HU-Q1.1, HU-Q1.2, HU-Q1.4, HU-Q1.6, HU-Q3.4, HU-Q11.2.
- **Entradas:** parqueadero 5, 6.

#### P3 · Windows
- **Regla:** lo que corre en la máquina del operador corre en Windows, y una prueba en Linux no lo ve.
- **En el parqueadero:** el PC con Windows es una caja de primera clase: Web Serial por el puerto COM y el diálogo del sistema con el driver POS58. El escáner del QR se comprueba en Windows, donde el navegador puede no traer `BarcodeDetector`.
- **Lo impedirá:** HU-Q2.4, HU-Q2.5, HU-Q3.4, HU-Q6.1.
- **Entradas:** —

#### P4 · Una prueba que solo sabe ver la primera tienda no prueba el producto
- **Regla:** ninguna prueba nombra a un cliente real; se prueba con uno de prueba y, además, con OTRO.
- **En el parqueadero:** toda prueba corre con Parqueadero Ensayo Uno (Bogotá, tope, por minuto, papel siempre) **y** Parqueadero Ensayo Dos (sin tope, fracción y nocturna, `abajo_100`, `salvo_digital`, abonados) (MVP §6.2). El nombre del cliente está en la lista de términos prohibidos.
- **Lo impedirá:** HU-Q0.2, HU-Q6.3; la Definición de Terminado, punto 4.
- **Entradas:** —

#### P5 · Una comprobación que da lo mismo con el defecto y sin él no comprueba nada
- **Regla:** antes de dar una comprobación, preguntar qué respondería sin el cambio. Toda aserción nueva se ve en rojo con su defecto puesto.
- **En el parqueadero:** una tarifa sobre el tope; el NIT quitado de una plantilla; una línea de 33 columnas; la transacción única del consecutivo quitada; trozos de Bluetooth de 600 bytes. Cada PR dice su control negativo.
- **Lo impedirá:** la plantilla de PR; la Definición de Terminado, punto 3.
- **Entradas:** parqueadero 1, 3.

#### P6 · Lo que se escribe para los que vienen después deja fuera al primero
- **Regla:** el cliente cero también es un cliente.
- **En el parqueadero:** el parqueadero cero entra por la misma puesta en marcha que cualquiera, y su caja de M0 llega a M1 por el mismo camino que una nueva: entrar, reclamar lo local desde su respaldo y sincronizar.
- **Lo impedirá:** HU-Q6.4, HU-Q7.6, HU-Q7.12.
- **Entradas:** —

#### P7 · Una caché convierte un chequeo en un recuerdo
- **Regla:** un instrumento lee la fuente, no la caché; una caché guarda respuestas, no fracasos.
- **En el parqueadero:** la hora del servidor se lee con `cache: 'no-store'`, o una respuesta guardada esconde el reloj corrido; la caja muestra la versión que corre, no la que cree tener.
- **Lo impedirá:** HU-Q3.8, HU-Q0.3.
- **Entradas:** —

#### P8 · El reloj es una entrada que nadie declara
- **Regla:** fecha, hora y huso se mueven en la prueba que dice cubrir el reloj.
- **En el parqueadero:** el reloj **es** la tarifa. Gracia exacta, minuto 0, medianoche, tres días con tope diario, nocturna que empieza y termina; UTC−5 fijo y sin `Intl` en el papel; el teléfono con la hora corrida; los topes vencen cada año. Las pruebas corren también con `TZ=Pacific/Kiritimati`.
- **Lo impedirá:** HU-Q1.1, HU-Q1.2, HU-Q3.8.
- **Entradas:** —

#### P9 · Reproducir antes de diagnosticar
- **Regla:** ningún diagnóstico se da por bueno sin reproducir el fallo.
- **En el parqueadero:** un «no imprime» se reproduce con la página de prueba y el diagnóstico copiable antes de tocar el adaptador; una diferencia de cierre se reproduce registro por registro contra el talonario (MVP §8.4).
- **Lo impedirá:** HU-Q2.6, HU-Q6.2, HU-Q6.4.
- **Entradas:** —

#### P10 · El que se actualiza a sí mismo corre su versión vieja
- **Regla:** un arreglo en el que se actualiza llega una versión tarde. Y quien vuelve atrás corre también la vieja.
- **En el parqueadero:** la caja es una PWA que se actualiza sola: una versión nueva no recarga en medio de una impresión, y los arreglos del piloto salen después de un cierre de turno. El enlace del recibo es un contrato desde el primer recibo: `/r/` lee todas las versiones que alguna vez se publicaron (ADR-40), y un respaldo de `v0.2.0` se restaura en M1.
- **Lo impedirá:** HU-Q1.3, HU-Q1.5, HU-Q6.3, HU-Q7.6.
- **Entradas:** —

#### P11 · Lo que depende de SER la semilla no puede decidir si una tienda publica
- **Regla:** una compuerta solo mira invariantes que valen para cualquier cliente.
- **En el parqueadero:** ninguna regla de la caja pregunta si es el parqueadero cero. Los campos de la ley y el tope valen para cualquier sede.
- **Lo impedirá:** HU-Q1.4, HU-Q3.2.
- **Entradas:** —

#### P12 · El permiso que se comprueba es el que se usa
- **Regla:** un token se prueba antes de sembrarlo y con la acción que va a hacer.
- **En el parqueadero:** el PIN de administrador se prueba con lo que protege (anular, tarifas, ajustes). Desde M1, los roles son dato y los decide la celda, no la pantalla.
- **Lo impedirá:** HU-Q3.2, HU-Q3.7, HU-Q7.8.
- **Entradas:** —

#### P13 · Un secreto no viaja por donde queda escrito
- **Regla:** llaves y tokens solo en los almacenes de secretos, nunca en una dirección, un pantallazo o un documento. Lo mismo, los datos de las personas.
- **En el parqueadero:** el recibo viaja en el fragmento `#`, que no llega a ningún servidor; el número del conductor no sale del teléfono salvo hacia WhatsApp y se borra 24 h después de la salida; la vista previa del enlace es genérica; los eventos de medición no llevan placas ni números; el PIN no se anota en ningún equipo nuestro.
- **Lo impedirá:** HU-Q1.5, HU-Q4.1, HU-Q4.2, HU-Q5.3.
- **Entradas:** —

#### P14 · Los fallos silenciosos del lenguaje y del shell
- **Regla:** `| tee` sin `pipefail`, un `try/catch` que protege, dos funciones con el mismo nombre: no fallan, siguen.
- **En el parqueadero:** `set -o pipefail` en todo comando que decide un commit (plan §3.1). La guardia que impide borrar busca `\bregistro\b`, y la tabla se llama `registros`: el plural pasa sin que nadie lo vea (HU-Q3.7, CA3).
- **Lo impedirá:** HU-Q3.7.
- **Entradas:** —

#### P15 · Un aviso tiene que llegar a donde alguien mira, y nombrar la causa
- **Regla:** el aviso va donde está la persona, dice qué pasó y qué hacer.
- **En el parqueadero:** la cabecera de la caja lleva siempre sus cuatro señales: impresora, respaldo, hora y entregas pendientes (plan §5). Nunca en un menú. El diagnóstico copiable nombra la causa.
- **Lo impedirá:** HU-Q3.1, HU-Q2.6, HU-Q6.2.
- **Entradas:** —

#### P16 · Un flujo que nunca ha corrido de verdad no está probado
- **Regla:** se corre de punta a punta antes de llamarlo camino normal.
- **En el parqueadero:** aquí el patrón manda. Ninguna historia que toca la impresora, WhatsApp o la cámara se cierra sin el equipo real (Definición de Listo, punto 10); el paso 0 mide la PT-210 antes del adaptador; la matriz de PARQUEADERO §15.3; el piloto corre en paralelo con el talonario.
- **Lo impedirá:** HU-Q2.1, HU-Q6.1, HU-Q6.4.
- **Entradas:** —

#### P17 · El instrumento también miente
- **Regla:** un doble que simplifica una propiedad que el código real promete miente el día que alguien depende de ella.
- **En el parqueadero:** el adaptador falso de impresora no rechaza trozos grandes ni se queda sin papel; Chromium en las e2e no es el teléfono del cajero; una herramienta que resume páginas no es el navegador; una maqueta en pantalla no es el papel de 32 columnas.
- **Lo impedirá:** HU-Q1.4, HU-Q2.2, HU-Q6.1.
- **Entradas:** parqueadero 1, 2, 3, 8.

#### P18 · Un documento no lanza una excepción cuando miente
- **Regla:** lo que un documento afirma del código lo ata una aserción; el redundante se borra.
- **En el parqueadero:** la arquitectura y el plan se contrastaron con `origin/main` antes de escribir una historia, y del contraste salieron cinco entradas. Los runbooks se atan con una prueba de repositorio.
- **Lo impedirá:** HU-Q6.2, HU-Q10.4; la Definición de Listo, punto 5.
- **Entradas:** parqueadero 2, 4, 6, 7, 9.

#### P19 · Un rojo que no significa nada enseña a no mirar los rojos
- **Regla:** una guarda con falsos positivos o un intermitente se arregla o se quita.
- **En el parqueadero:** un caso de la matriz en rojo no se pinta de verde con una nota. Una impresión que falla «a veces» se mide con 50 recibos seguidos; no se marca como intermitente.
- **Lo impedirá:** HU-Q6.1.
- **Entradas:** —

#### P20 · Lo que se le ofrece a alguien tiene que llegar por el camino que esa persona recorre
- **Regla:** se prueba desde quien mira.
- **En el parqueadero:** el conductor abre su recibo desde WhatsApp o con la cámara, sin cuenta y sin instalar nada; el cajero trabaja de pie, con una mano y al sol (blancos de 56 px, plan §5); el iPhone recibe el camino sin papel desde el primer paso del asistente.
- **Lo impedirá:** HU-Q2.6, HU-Q3.6, HU-Q4.2.
- **Entradas:** parqueadero 8.

#### P21 · Lo que borra antes de escribir convierte un fallo en una pérdida
- **Regla:** escribir primero, verificar, borrar después.
- **En el parqueadero:** anular sin borrar; la restauración une, no reemplaza; el número del conductor se borra después de la salida, nunca antes de entregar el recibo.
- **Lo impedirá:** HU-Q3.7, HU-Q3.10, HU-Q4.1.
- **Entradas:** —

#### PT1 · Lo que tiene que sobrevivir a un viaje por un tercero no puede vivir solo en el navegador que lo empezó
- Heredado de la Tienda 3.0, con su regla.
- **En el parqueadero:** el recibo viaja entero en el enlace, así que sobrevive a WhatsApp, a otro teléfono y a que la caja no haya sincronizado nunca. Lo que no sobrevive es saber si el mensaje salió: la caja pregunta «¿Se envió?».
- **Lo impedirá:** HU-Q1.5, HU-Q4.1.
- **Entradas:** —

### Nuevos (provisionales)

*(Ninguno todavía.)*

### Candidato: «enviado no es entregado»

Dos veces en el diseño, con la misma forma: la caja entrega algo a un tercero que no confirma.

1. La PT-210 recibe los bytes por Bluetooth con escritura sin respuesta: la caja sabe que los mandó, no que salieron en el papel. Dice «Enviado a la impresora», nunca «Impreso» (HU-Q3.6).
2. `wa.me` abre WhatsApp con el texto: la caja sabe que lo abrió, no que el conductor lo recibió. Dice «Abierto en WhatsApp. ¿Se envió?» (HU-Q4.1).

Si aparece una tercera vez, nace `PQ1` con la regla: **la pantalla dice hasta dónde llegó la caja, no hasta dónde cree que llegó el tercero.** Si no, queda como una forma de P17.

---

## Herencia: lo que otras bitácoras ya pagaron y le toca al parqueadero

No se copian las entradas (P2): se citan, con la historia que hereda su regla.

| Bitácora | Qué enseñó | Dónde lo hereda el parqueadero |
|---|---|---|
| ecommerce, crítico | `Number(celda) \|\| 0` convierte «no se pudo leer» en «es gratis» | `MontoIlegible` de `@ed1/dinero` (HU-Q1.1); PARQUEADERO §9.2, regla 5 |
| ecommerce, crítico | La configuración de fábrica traía el celular de la primera tienda | Ningún dato de la sede tiene valor de fábrica; sin datos legales no se registra (HU-Q3.2) |
| ecommerce, crítico | El botón de WhatsApp se apagaba sin decir por qué | La caja dice qué falta y lleva al campo (HU-Q3.2, HU-Q4.1) |
| ecommerce, menores | Un emoji al principio del mensaje rompía la caja de WhatsApp | `@ed1/whatsapp` (HU-Q1.6) |
| ecommerce 61; tienda3 PT1 | Lo que sobrevive a un tercero no vive en una pestaña | El recibo viaja en el enlace (HU-Q1.5) |
| agro, terreno; tienda3 2 | Safari no codifica WebP en `canvas.toBlob` | Las fotos caen a JPEG (HU-Q3.3, HU-Q8.3); bitácora parqueadero 8 |
| agro, terreno | `page.goto` justo después de guardar corta la escritura en IndexedDB | HU-Q6.3, CA2 |
| agro, terreno | Una versión creada con el token de Actions no dispara otros flujos | Etiqueta y despliegue en la misma corrida (HU-Q0.3, CA2) |
| agro, terreno | Staging se despliega solo y producción no; un dominio en el Worker equivocado | Producción temprana en el dominio público: `v0.1.0` antes de la demostración (HU-Q5.2) |
| agro, terreno | Un aviso fuera de la vista es un botón que no hace nada | Las cuatro señales de la cabecera (plan §5) |
| agro, P8 | La marca de «reloj corrido» del cuaderno | HU-Q3.8 |
| agro, «Afirmaciones falsas» 3 | El cobro de Meta dentro de la ventana | Bitácora parqueadero 2: la corrección también puede estar equivocada |
| agro 29 | Una decisión se valida contra el documento que la decide | La Definición de Listo, punto 5 |
| core 1; tienda3 4 | Una cita que no dice lo que dice el citado; una decisión nueva que no se buscó en los diseños | El contraste del plan §1; bitácora parqueadero 6 |
| core 4 | Un commit salió con el lint en rojo por falta de `pipefail` | Plan §3.1 |
| core 5 | Un número de un instrumento se mira con «¿es razonable?» | Las filas de D1 por parqueadero (HU-Q7.13) |
| core, terreno | El cuello de botella es validar, no construir | Límite de trabajo en curso (plan §3.6) |
| core, terreno | Dos sesiones en la misma carpeta comparten la rama | El parqueadero en su copia de trabajo (`D:\CoWork\gestionagro-parqueadero`) |

---

## Cómo escribir una entrada

Igual que en las otras bitácoras, para que se lean y se extraigan igual:

| Campo | Qué lleva | Cómo se reconoce |
|---|---|---|
| Número y título | El siguiente número libre y el síntoma o la lección en una frase | `**N · Título.**` al empezar el párrafo |
| Qué pasó | Cuándo, con qué parqueadero de prueba o en qué sede, en qué equipo (teléfono, navegador y versión, impresora), qué se estaba haciendo | Primeras frases |
| Síntoma literal | El mensaje tal cual salió, o lo que salió en el papel | Entre «…» o en un bloque de código |
| Causa raíz | Por qué pasó, no solo dónde | Prosa |
| Cómo se reprodujo | El adaptador falso, la PT-210 del equipo, staging, la matriz… o «sin reproducir», dicho | Prosa |
| Arreglo | Qué cambió, y por qué así | Prosa |
| Qué lo prueba | Prueba y aserciones, con su control negativo | `**Lo prueba(n)**` |
| La regla | La lección que sirve fuera de este caso | `La regla:` en negrita |
| Ficha | Proyecto, autoría, severidad, patrones, versión y fecha | Última línea |

- **Autoría:** *(mío)*, lo rompió o lo afirmó el asistente; *(tuyo)*, el dueño; *(compartido)*; *(del terreno)*, la plataforma, Meta, un navegador, la impresora o un proveedor.
- **Versión:** la del parqueadero que trae el arreglo (`parqueadero-X.Y.Z`); `parqueadero-0.0.0` antes de HU-Q0.3.
- **Sin datos de conductores.** Ni placas reales, ni números, ni fotos. Una placa de ejemplo es `ABC123`.

Cuatro reglas que no se rompen:

1. Una entrada nueva va al final, con el siguiente número. No se renumera.
2. Lo escrito no se reescribe. Se añade *(Hoy: …)* o *(Después: bitácora parqueadero N)*.
3. Se cita el síntoma, no la interpretación.
4. Sin control negativo no hay «lo prueba».

---

## Afirmaciones mías que resultaron falsas

Van aparte porque no son fallos de código: son cosas que dije con seguridad y no eran ciertas.

1. **«El recibo completo cabe en el QR del papel».** Lo escribí el 6 oct 2026 en el primer borrador de PARQUEADERO §6.3: el enlace llevaba el recibo «para que quepa en un QR de 58 mm», y estimé el firmado en unos 500 a 650 caracteres. Al medirlo ese mismo día con un recibo de nombre y dirección largos: el completo sin firma mide 367 caracteres la entrada y 415 la salida; el firmado, 610 y 658, que es un QR de versión 17 a 18, de 85 a 89 módulos, demasiado denso para papel térmico. El papel lleva ahora la forma corta (136 caracteres, versión 7, 28 mm) y la completa va por WhatsApp y en pantalla. HU-Q1.5, CA2, lo exige con una prueba.
2. **«La PT-210 corta el papel».** El primer borrador del recibo terminaba con «el corte justo después del pie». Ninguna ficha de la PT-210 menciona un cortador: se rasga (*Inferencia*, se confirma en la puesta en marcha). PARQUEADERO §6.2 dice ahora «solo el avance necesario para rasgar después del pie».
3. **«El código de `wa.me` ya existe dos veces, en el agro y en la Tienda»** (PARQUEADERO §20.5, 6 oct 2026). En `origin/main` del 7 oct hay **tres copias en el agro**, las tres para compartir sin número (`apps/cuaderno/src/almacen/invitacion.ts:118`, `apps/sitio/src/islas/carencia-logica.ts:176`, `apps/sitio/src/islas/dpv-logica.ts:134`), y **ninguna en la Tienda 3.0**, que todavía no tiene código. La cifra salió de los documentos, no de buscar en el código. `@ed1/whatsapp` nace con las dos formas, con número y sin él (HU-Q1.6).

---

## Cambios de rumbo

No son errores. Son decisiones que cambiaron con información nueva.

| De | A | Por qué |
|---|---|---|
| M0 en 3 semanas (PARQUEADERO §18) | Seis sprints semanales: la demostración el 30 oct (`v0.1.0`) y el piloto del 9 al 13 nov (`v0.2.0`), con un orden de recorte (plan §6; MVP §4.4) | El desglose da 109 puntos, y el MVP no se entrega sin la matriz en el equipo real ni sin que el dueño valide (plan §6.2) |
| Dos herramientas gratuitas en la semana 3 de M0 (PARQUEADERO §18.1) | Medir la búsqueda primero (HU-Q11.1, Q6); el aviso de tarifas y derechos sin esperar (HU-Q11.3) | Bitácora parqueadero 9 |
| M1 con Workers Paid «ya pagado por la Tienda» (PARQUEADERO §10.3, §14.1, §17) | M1 en el plan gratuito, con presupuesto en filas y vigía (HU-Q7.13; D-Q10) | La decisión del dueño del 6 oct 2026; bitácora parqueadero 6 |
| Mensualidades sencillas en M0 (PARQUEADERO §2.2) | Abonados por placa en M0 (HU-Q3.11, Should); mensualidades con plan y cobro en M2 (HU-Q8.4) | Bitácora parqueadero 7 |
| M1 espera a PLATAFORMA P1 y P2 (PARQUEADERO §0 y §18) | M1 arranca en Q6, justo después del piloto; solo el cobro por periodo espera a HC4 (HU-Q7.10) | HU-C3.1, HU-C4.3 y HU-C4.4 ya están construidas (plan §1, hallazgo 7) |
| Las fotos del estado en el respaldo de M0 | Fuera del archivo de respaldo en M0 (HU-Q3.10, CA3) | El respaldo se manda por correo, y con fotos pasaría el límite de un adjunto (*Inferencia*) |

---

## Lo que el terreno enseñó, y no fue culpa de nadie

- **Un iPhone no imprime en la PT-210 desde ningún navegador.** Safari no tiene Web Bluetooth, WebUSB ni Web Serial, y fuera de la Unión Europea todo navegador de iOS usa su motor: Chrome en iPhone tampoco puede (PARQUEADERO §7.8). El iPhone sirve como caja sin papel; la caja con papel es un Android.
- **Lo que se sabe de la PT-210 sale de un SDK no oficial.** El fabricante no publica los detalles de Bluetooth. Los UUID del servicio, los trozos de 182 bytes cada 40 ms y el PIN salen de un SDK de Python no oficial y sin licencia declarada (PARQUEADERO §7.1). Por eso existe el paso 0 (HU-Q2.1).
- **La librería de referencia no ve una PT-210.** WebBluetoothReceiptPrinter solo acepta el servicio `49535343…` si el nombre empieza por «TM-P» o «STAR L». El adaptador Bluetooth es propio; el codificador de la misma familia sí se usa (PARQUEADERO §7.1 y §7.4).
- **`getDevices()` sigue detrás de una bandera en Chrome.** Después de cerrar la caja, el operador toca «Conectar» y elige la PT-210 otra vez: un toque por turno, pedido en amarillo en la cabecera (PARQUEADERO §7.4).
- **`wa.me` no da prueba de entrega.** La caja sabe que abrió WhatsApp, no que el mensaje salió. Por eso pregunta «¿Se envió?», y por eso no hay un modo «nunca imprimir» (PARQUEADERO §8.4).
- **La vista previa de WhatsApp no ve el fragmento.** El lector de enlaces de Meta no recibe lo que va después de `#`: la vista previa es genérica y la placa no queda en sus servidores. Aquí el límite juega a favor (PARQUEADERO §6.3).
- **El papel térmico se borra** con calor, sol, humedad y grasa, y un tiquete en el tablero del carro puede borrarse en días (*Inferencia*). El recibo legal es el papel; la copia que dura es la digital (PARQUEADERO §8.4).

---

## Entradas numeradas

**1 · `INSERT OR IGNORE` también se traga un `CHECK` roto: el push de la celda agro reportaría como duplicada una fila que la base rechazó.**

*Qué pasó.* El 6 oct 2026, al escribir el modelo de datos del parqueadero (`sql/parqueadero/0001_parqueadero_v1.sql`) y su prueba, leí el push de la celda agro (`apps/api-celda/src/push.ts`) para copiar su forma de idempotencia: un reenvío del mismo registro no falla ni se duplica.

*Síntoma literal.* Con `node:sqlite` (Node 22.22), una tabla con `CHECK (v >= 1)`:

```
INSERT OR IGNORE … (id, v) VALUES ('a', 0)   →  {"lastInsertRowid":0,"changes":0}
INSERT … ON CONFLICT (id) DO NOTHING (v = 0)   →  CHECK constraint failed: v>=1
```

*Causa raíz.* En SQLite, `OR IGNORE` es una forma de resolver conflictos que se aplica a `UNIQUE`, `NOT NULL`, `CHECK` y la llave primaria, no solo al id repetido. Se usó para la idempotencia, pero su alcance es mayor. En la celda, una fila que pase zod y no un `CHECK` de la base volvería como `duplicado` y se perdería sin ruido (P1). El instrumento hace más de lo que su nombre promete (P17).

*Cómo se reprodujo.* Con `node:sqlite`, el 6 oct 2026, y otra vez el 7 oct para esta entrada.

*Arreglo.* El parqueadero usa `ON CONFLICT (id) DO NOTHING`, que solo se salta el id repetido: un número repetido con otro id, o un `CHECK` roto, falla y la operación va a cuarentena con su motivo (HU-Q7.4). En el agro no se tocó el código: queda propuesto en PARQUEADERO §20.1 y en el plan §12.

**Lo prueba:** `sql/probar-parqueadero.mjs` (56 comprobaciones). Control negativo, corrido el 7 oct 2026: con `INSERT OR IGNORE` en lugar de `ON CONFLICT (id) DO NOTHING`, cinco comprobaciones se ven en rojo, entre ellas «otro id con el mismo número falla (va a cuarentena)» y «un número repetido tumba el lote entero (como un batch de D1)», y la prueba termina con código 1.

La regla: **un mecanismo de idempotencia se prueba con una fila que la base debe rechazar, no solo con una repetida.**

*Ficha:* parqueadero · *(compartido)* · 🟡 Medio · P1, P5, P17 · parqueadero-0.0.0 · 2026-10-06

**2 · Las dos páginas de precios de Meta se contradicen sobre el cobro dentro de la ventana de 24 h.**

*Qué pasó.* El 6 oct 2026, al calcular el costo de M3 (PARQUEADERO §8.6), volví a leer las páginas de precios de WhatsApp Business de Meta.

*Síntoma literal.* La página de los mensajes que no son plantilla, que se presenta como la de los cambios próximos, dice que desde el 1 oct 2026 Meta cobra los mensajes de servicio y las plantillas de utilidad dentro de la ventana. La página general de precios sigue diciendo que son gratis, con vigencia desde el 1 jul 2025 (PARQUEADERO §8.6, fuentes W1 y W2).

*Causa raíz.* Meta publicó el cambio en una página y no actualizó la otra. El repositorio, el 5 oct, registró ese cobro como afirmación falsa apoyándose en la página general (bitácora agro, «Afirmaciones falsas» 3): una corrección también puede estar equivocada. Y las dos se leyeron con una herramienta que resume la página, no en el navegador (P17).

*Cómo se reprodujo.* Leyendo las dos páginas el 6 oct 2026. Falta abrirlas en el navegador.

*Arreglo.* Nada en el MVP: `wa.me` cuesta cero. PARQUEADERO §8.6 lo registra y §20.6 propone abrir las dos páginas en el navegador y, si la de cambios próximos se confirma, añadir una entrada a la bitácora agro que corrija la 3 sin borrarla. EQ9 vuelve a leerlas antes de refinar (plan, disparador de M3).

**Lo prueba:** nada; es una fuente externa. La revisión llega con el disparador de M3, en la planeación de Q12.

La regla: **cuando dos páginas oficiales se contradicen, la de los cambios próximos manda sobre la general, y las dos se abren en el navegador antes de corregir nada.**

*Ficha:* parqueadero · *(del terreno)* · 🟡 Medio · P17, P18 · parqueadero-0.0.0 · 2026-10-06

**3 · Una línea de 35 columnas en una maqueta de recibo de 32.**

*Qué pasó.* El 6 oct 2026, al escribir las maquetas a 32 columnas de PARQUEADERO (anexo B), la cabecera del recibo juntaba el NIT y el teléfono en una sola línea.

*Síntoma literal.* La línea «NIT … Tel …» medía 35 columnas.

*Causa raíz.* La maqueta se escribió mirando, no midiendo: en una pantalla, 35 y 32 columnas se ven casi iguales. En la PT-210, la línea habría partido el teléfono en dos renglones (*Inferencia*). La maqueta era un instrumento que no tenía el ancho del papel (P17).

*Cómo se reprodujo.* Midiendo cada línea del anexo B con un script.

*Arreglo.* La línea se partió en dos, centradas. HU-Q1.4 lleva la prueba de ancho: ninguna línea de papel pasa de 32 columnas.

**Lo prueba:** el 7 oct 2026, la revisión de consistencia de este plan midió todas las maquetas del anexo B: ninguna pasa de 32. En el código, la prueba llega con HU-Q1.4, cuyo CA3 pone una línea de 33 columnas y la ve en rojo.

La regla: **lo que tiene un ancho fijo se mide, no se mira.**

*Ficha:* parqueadero · *(mío)* · ⚪ Menor · P5, P17 · parqueadero-0.0.0 · 2026-10-06

**4 · ADR-32 decía «sin Worker», y la caja manda sus eventos a `/_m`, que es un Worker.**

*Qué pasó.* El 6 oct 2026, al revisar la arquitectura contra su §14.4 (medición).

*Síntoma literal.*
- ADR-32, primera versión: «El MVP es una **caja local**: navegador, IndexedDB y archivos. Sin cuenta, sin Worker, sin D1».
- PARQUEADERO §14.4 y §16: los eventos anónimos van al `/_m` del sitio del parqueadero.

*Causa raíz.* «Worker» quería decir «la API de la celda», y el sitio estático también corre en un Worker para recibir eventos. Una palabra que nombra dos cosas, en una negación, que es donde un documento miente más fácil (P18).

*Cómo se reprodujo.* Leyendo ADR-32 con §14.4 y §16 abiertos.

*Arreglo.* ADR-32 dice ahora: «Sin cuenta, sin API de celda y sin D1. El sitio estático solo recibe eventos anónimos cuando hay red (§14.4)».

**Lo prueba:** nada; es un documento.

La regla: **una negación en una decisión («sin X») se busca en todo el documento antes de darla por buena.**

*Ficha:* parqueadero · *(mío)* · ⚪ Menor · P18 · parqueadero-0.0.0 · 2026-10-06

**5 · PARQUEADERO promete pesos enteros y no nombra `@ed1/dinero`, que ya está en `main`.**

*Qué pasó.* El 7 oct 2026, al escribir HU-Q1.1 (la liquidación), contrasté PARQUEADERO §9 con los paquetes de `origin/main`.

*Síntoma literal.*
- PARQUEADERO §9.2, regla 5: «Pesos enteros. Nada de `REAL` ni de `Number(x) || 0` (bitácora ecommerce)».
- `origin/main`: `@ed1/dinero` con `pesos(valor, campo)`, `formatearPesos()` y `MontoIlegible`, sin `Intl`, con su guardia de paquetes puros (`tests/repo/tienda-paquetes-puros.test.ts`).

*Causa raíz.* La arquitectura se escribió leyendo los documentos de la Tienda, no `packages/`. Con la regla y sin el paquete, `parqueadero-tarifas` habría escrito su propia función de pesos: una segunda copia del mismo procedimiento (P2).

*Cómo se reprodujo.* Buscando en `packages/` de `origin/main` antes de escribir la historia.

*Arreglo.* `parqueadero-tarifas` y `parqueadero-recibos` usan `@ed1/dinero`; ninguna función de pesos propia (HU-Q1.1, HU-Q1.4). PARQUEADERO §9 lleva la nota.

**Lo prueba:** nada todavía; llega con HU-Q1.1.

La regla: **antes de diseñar un paquete se busca en `packages/` lo que ya existe; una regla sin el nombre del paquete que la cumple invita a escribirlo otra vez.**

*Ficha:* parqueadero · *(mío)* · 🟡 Medio · P2 · parqueadero-0.0.0 · 2026-10-07

**6 · PARQUEADERO cuenta con Workers Paid «ya pagado por la Tienda», y el dueño decidió el mismo día que ya no es condición.**

*Qué pasó.* El 7 oct 2026, al escribir las historias de M1, contrasté los costos de PARQUEADERO con `BACKLOG_CORE.md` de `origin/main`.

*Síntoma literal.*
- PARQUEADERO §14.1: «Con Workers Paid ya pagado por la Tienda, el costo marginal por parqueadero es de centavos (§10.3)».
- `BACKLOG_CORE.md`, lo que la Tienda espera del CORE: «Workers Paid ya no es condición: se activa solo si hace falta (decisión del dueño, 6 oct 2026)».

*Causa raíz.* La decisión llegó al backlog del CORE el 6 oct y PARQUEADERO, escrito ese día, no la buscó: es la forma de la bitácora tienda3 4, una decisión nueva que no se busca en los diseños que la tocan (P18), con dos copias de la misma suposición (P2). En el plan gratuito, D1 permite 100.000 filas escritas al día **para toda la cuenta**. A 1.800 filas diarias por parqueadero, con el margen ×2 de PARQUEADERO §10.3, caben unos 55 si fueran los únicos de la cuenta, y no lo son (*Inferencia*).

*Cómo se reprodujo.* Leyendo los dos documentos el 7 oct 2026.

*Arreglo.* M1 se diseña para el plan gratuito, con su presupuesto en filas y su vigía (HU-Q7.13, nueva) y la decisión D-Q10. Notas en PARQUEADERO §0, §10.3, §14.1 y §17.

**Lo prueba:** nada todavía; el vigía llega con HU-Q7.13.

La regla: **«ya lo paga otro» es una dependencia, no un dato: se escribe con su condición y se revisa cada vez que el otro decide.**

*Ficha:* parqueadero · *(mío)* · 🟡 Medio · P18, P2 · parqueadero-0.0.0 · 2026-10-07

**7 · Las mensualidades estaban en M0 y en M2 a la vez.**

*Qué pasó.* El 7 oct 2026, al repartir las historias entre los hitos.

*Síntoma literal.*
- PARQUEADERO §2.2, columna «Entra (M0)»: «Mensualidades sencillas por placa».
- PARQUEADERO §0 y §18, M2: «… mensualidades …».

*Causa raíz.* Dos tablas del mismo documento escritas en momentos distintos, y «sencillas» no decía qué quedaba fuera (P18).

*Cómo se reprodujo.* Leyendo las tres secciones juntas.

*Arreglo.* M0 solo marca abonados por placa (HU-Q3.11, Should). Las mensualidades con plan, cobro y recordatorio son M2 (HU-Q8.4). PARQUEADERO §2.2 lleva la nota.

**Lo prueba:** nada; es un documento.

La regla: **cuando una función aparece en dos hitos, se escribe qué parte va en cada uno, con un verbo que se pueda probar.**

*Ficha:* parqueadero · *(mío)* · ⚪ Menor · P18 · parqueadero-0.0.0 · 2026-10-07

**8 · PARQUEADERO comprime las fotos a WebP en el navegador: la bitácora tienda3 2 otra vez.**

*Qué pasó.* El 7 oct 2026, al escribir HU-Q3.3 (la entrada con fotos del estado), crucé PARQUEADERO §5.5 con las bitácoras.

*Síntoma literal.*
- PARQUEADERO §5.5: la foto se toma con la cámara y se comprime «en el navegador a WebP de unos 100 KB (ADR-15)».
- Bitácora tienda3 2, del día anterior: «Safari no codifica WebP en `canvas.toBlob`: devuelve PNG».

*Causa raíz.* Heredé la técnica del agro sin su cicatriz, igual que la Tienda un día antes. La regla de la tienda3 2 («cuando un producto hereda una técnica de otro, hereda también su sección del terreno») no se aplicó al escribir la arquitectura, solo al escribir la historia. En un iPhone, la caja habría guardado PNG con nombre de WebP, sin que ninguna prueba en Chromium lo viera (P17, P20).

*Cómo se reprodujo.* Sin reproducir en el parqueadero, que no tiene código; el comportamiento ya lo midió el agro.

*Arreglo.* HU-Q3.3 cae a JPEG donde el navegador no produce WebP y guarda el formato real; su CA4 prueba con un `toBlob` que devuelve PNG, como Safari. HU-Q8.3 hace lo mismo al subir. PARQUEADERO §5.5 lleva la nota.

**Lo prueba:** nada todavía; la prueba llega con HU-Q3.3.

La regla: **una cicatriz de otra bitácora se busca por la técnica, no por el producto: «WebP», no «las fotos de la Tienda». Y se busca al escribir la arquitectura, no solo la historia.**

*Ficha:* parqueadero · *(mío)* · 🟡 Medio · P17, P20 · parqueadero-0.0.0 · 2026-10-07

**9 · PARQUEADERO construía las herramientas gratuitas en M0, y el estudio pedía medir su búsqueda antes.**

*Qué pasó.* El 7 oct 2026, al estimar M0, contrasté PARQUEADERO §18.1 con el estudio §12.2.

*Síntoma literal.*
- PARQUEADERO §18.1, semana 3: «… las dos herramientas gratuitas …».
- Estudio §12.2, sobre los seis filtros de cada herramienta: «el de búsqueda queda pendiente en todas».

*Causa raíz.* El plan por semanas tomó lo que el estudio proponía construir y no lo que pedía medir antes de construir (P18). En M0 habrían competido con la impresión y el turno por la validación del dueño, sin saber si alguien las busca.

*Cómo se reprodujo.* Leyendo las dos secciones juntas.

*Arreglo.* Las herramientas salen de M0. HU-Q11.1 mide la búsqueda primero (Q6), y la calculadora y el generador dependen de lo que diga. El aviso de tarifas y derechos (HU-Q11.3) se hace sin esperar, porque el parqueadero cero lo necesita en su entrada. PARQUEADERO §18.1 lleva la nota.

**Lo prueba:** nada; es un plan. HU-Q11.1 deja la medición escrita antes de construir.

La regla: **lo que un estudio deja «pendiente de medir» entra al plan como una medición, con su historia, antes de la historia que construye.**

*Ficha:* parqueadero · *(mío)* · 🟡 Medio · P18 · parqueadero-0.0.0 · 2026-10-07

**10 · El codificador ESC/POS pesa 29 KB con gzip, y la caja tiene 80 KB para todo su JS inicial.**

*Qué pasó.* El 7 oct 2026, al escribir `@ed1/impresion` (HU-Q2.2), medí el codificador que eligió PARQUEADERO §7.3 antes de importarlo en la caja.

*Síntoma literal.* Un archivo que solo importa el codificador y codifica una línea y un QR, empaquetado con esbuild para el navegador y minificado:

```text
receipt-printer-encoder 4.0.1   106,3 KB   28.786 bytes con gzip
lean-qr 2.7.4                     6,6 KB    3.617 bytes con gzip
```

*Causa raíz.* §7.3 eligió el codificador por su perfil `pos-5890` y su licencia, sin pesarlo contra el presupuesto de HU-Q3.1. Trae las tablas de decenas de páginas de códigos y la definición de unas cuarenta impresoras; la caja usa tres páginas y un perfil.

*Cómo se reprodujo.* Con esbuild y `gzip -9`, como arriba.

*Arreglo.* `codificar()` importa el codificador (y `lean-qr`, solo para el QR como imagen) con `import()` al codificar el primer trabajo. El JS inicial de la caja no lo carga, y el service worker lo guarda para imprimir sin red. Se queda la librería en vez de escribir un codificador propio: la decisión es de ADR-34 y los bytes de referencia la vigilan.

**Lo prueba:** nada todavía; llega con el presupuesto de 80 KB de la caja (HU-Q3.1), que mide el JS inicial sin el codificador.

La regla: **una dependencia de la caja se pesa con gzip antes de importarla, y lo que solo sirve para imprimir se carga al imprimir.**

*Ficha:* parqueadero · *(mío)* · ⚪ Menor · P18 · parqueadero-0.0.0 · 2026-10-07

**11 · El QR como imagen funcionaba en Node y en el navegador dejaba la página de prueba esperando.**

*Qué pasó.* El 7 oct 2026, en la primera corrida de las e2e de la caja (HU-Q2.6) con la PT-210 falsa: el paso 3 del asistente no terminaba. Las pruebas unitarias de `@ed1/impresion`, en Node, daban la página de prueba completa con los dos QR.

*Síntoma literal.* En el paso 3, el botón «Imprimir página de prueba» quedaba deshabilitado y nunca aparecía «Enviado a la impresora.». Ningún mensaje en la pantalla.

*Causa raíz.* Dos defectos juntos:
- El codificador reconoce una imagen por el nombre de la clase (`input.constructor.name == 'ImageData'`). `documento.ts` traía una clase propia llamada `ImageData` para Node, y el minificador de Vite le cambia el nombre en el build de la caja. Con otro nombre, el codificador lanza «Could not determine the type of image input» (lo dice su código; el mensaje no llegó a la pantalla, por el defecto que sigue).
- `crearControl().imprimir()` dejaba escapar esa excepción, y el asistente no tenía `finally`: la pantalla quedaba «ocupada» para siempre (P15).

*Cómo se reprodujo.* Con la e2e de la caja contra el build de producción; en Node no se reproduce, porque ahí no hay minificador (P17).

*Arreglo.* En el navegador se usa el `ImageData` de verdad; en Node y workerd, la clase mínima con su nombre fijado con `Object.defineProperty`. Y `imprimir()` de la caja nunca lanza: un recibo que no se pudo armar vuelve como resultado con su motivo.

**Lo prueban** las e2e «el asistente imprime la página de prueba y guarda las respuestas» y «si ninguna línea con tildes se ve bien, translitera», que antes del arreglo estaban en rojo con este síntoma.

La regla: **lo que depende del nombre de una clase o de una función se prueba contra el build minificado, no solo contra el código fuente.**

*Ficha:* parqueadero · *(mío)* · 🟡 Medio · P15, P17 · parqueadero-0.0.0 · 2026-10-07
