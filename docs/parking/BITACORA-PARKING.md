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
- **Lo impide hoy:** `sql/probar-parqueadero.mjs`, con `ON CONFLICT (id) DO NOTHING`. Con `INSERT OR IGNORE`, cinco comprobaciones se ven en rojo (bitácora parqueadero 1). *(Hoy, 8 oct 2026: `tests/repo/shard-parqueadero.test.ts`, en `node:sqlite` y en el D1 local de workerd; el mismo control negativo pone en rojo las mismas comprobaciones en los dos (HU-Q7.2, bitácora parqueadero 28).)*
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
- **En el parqueadero:** el adaptador falso de impresora no rechaza trozos grandes ni se queda sin papel; Chromium en las e2e no es el teléfono del cajero; una herramienta que resume páginas no es el navegador; una maqueta en pantalla no es el papel de 32 columnas; un arnés en Node no tiene la CSP del navegador.
- **Lo impedirá:** HU-Q1.4, HU-Q2.2, HU-Q6.1.
- **Entradas:** parqueadero 1, 2, 3, 8, 30.

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

1. **«El recibo completo cabe en el QR del papel».** Lo escribí el 6 oct 2026 en el primer borrador de PARQUEADERO §6.3: el enlace llevaba el recibo «para que quepa en un QR de 58 mm», y estimé el firmado en unos 500 a 650 caracteres. Al medirlo ese mismo día con un recibo de nombre y dirección largos: el completo sin firma mide 367 caracteres la entrada y 415 la salida; el firmado, 610 y 658, que es un QR de versión 17 a 18, de 85 a 89 módulos, demasiado denso para papel térmico. El papel lleva ahora la forma corta (136 caracteres, versión 7, 28 mm) y la completa va por WhatsApp y en pantalla. HU-Q1.5, CA2, lo exige con una prueba. *(Hoy, 7 oct: con el formato compacto del código, la corta mide 77 caracteres, versión 4, y la completa larga 409, versión 13; PARQUEADERO §6.3.)*
2. **«La PT-210 corta el papel».** El primer borrador del recibo terminaba con «el corte justo después del pie». Ninguna ficha de la PT-210 menciona un cortador: se rasga (*Inferencia*, se confirma en la puesta en marcha). PARQUEADERO §6.2 dice ahora «solo el avance necesario para rasgar después del pie».
3. **«El código de `wa.me` ya existe dos veces, en el agro y en la Tienda»** (PARQUEADERO §20.5, 6 oct 2026). En `origin/main` del 7 oct hay **tres copias en el agro**, las tres para compartir sin número (`apps/cuaderno/src/almacen/invitacion.ts:118`, `apps/sitio/src/islas/carencia-logica.ts:176`, `apps/sitio/src/islas/dpv-logica.ts:134`), y **ninguna en la Tienda 3.0**, que todavía no tiene código. La cifra salió de los documentos, no de buscar en el código. `@ed1/whatsapp` nace con las dos formas, con número y sin él (HU-Q1.6).
4. **«El teléfono de la caja es un Huawei sin los servicios de Google»** (bitácora 19, 7 oct 2026). Lo saqué de la pestaña ADVERTISER de nRF Connect, que decía «HUAWEI», y con eso expliqué por qué el escáner no leía. El dueño dijo el mismo día que es un **Samsung Galaxy S24 Ultra** con Chrome 154: ese nombre era otro equipo. El escáner sí quedó leyendo después de #117, pero la causa de que antes no leyera queda sin confirmar (la resolución de la cámara, el error que apagaba el bucle, o el detector). La matriz y la memoria se corrigieron.
5. **«`@page { size: 58mm auto; margin: 0 }` da una hoja del ancho del rollo»** (PARQUEADERO §7.5 y HU-Q2.5 CA1, 6 oct 2026). Al escribir la hoja del diálogo del sistema, el 7 oct, se la di a Chromium 141 y la leyó como `@page { margin: 0px; }`: descartó `size` entero, porque `58mm auto` no es un valor válido (la propiedad acepta una o dos longitudes, o un tamaño con nombre). Con una sola longitud, `58mm`, la hoja sería cuadrada. La caja pone solo `margin: 0` y deja el ancho y el largo del papel al driver POS58; la hoja mide 48 mm por su contenido. PARQUEADERO §7.5 y el backlog se corrigieron.

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
| `POST /api/v1/reclamar` carga el archivo entero de la caja (PARQUEADERO §12, HU-Q7.6 CA2) | `reclamar` solo registra la caja con su serie; lo suyo sube por la cola de siempre, de a 25, y `GET /api/v1/resumen` lo verifica (P21) | Plan gratuito (HU-Q7.13): 50 consultas y 10 ms de CPU por invocación, y la caja del cliente llegará con unos 10.000 recibos (PARQUEADERO §11.3) |
| `POST /api/v1/exportar` a R2 con enlace temporal (HU-Q7.9 CA1) | La caja al día arma el mismo archivo con lo de todas las cajas y lo compara con `resumen` | Lo mismo: leer el parqueadero entero no cabe en una invocación. Sin R2 no hay objetos que purgar ni enlaces que vencer (PARQUEADERO §12) |
| `auth_time` reciente en vez del PIN para los ajustes sensibles (HU-Q7.6 CA3) y la caja escondiendo lo que el rol no puede (WI-Q7.8.3) | Siguen el PIN y la caja de M0, también con cuenta | CA1 deja para el refinamiento con el cliente cómo entra un cajero sin cuenta de Google; hasta saberlo, solo el propietario entra |
| La demostración del 30 oct (`v0.1.0`) y después el piloto del 9 nov (`v0.2.0`) | Puesta en marcha directa: la `0.1.0` es la versión con la que el cliente opera, después de la matriz en su equipo (HU-Q6.1) y con el primer turno en paralelo con el talonario (HU-Q6.4) | El cliente cerró la compra el 7 oct de 2026 y entra a operar con el MVP (dueño, 8 oct). Todas las historias de código de M0 ya estaban en `main` |
| Cron por celda con respaldo semanal a R2 y aviso por Telegram (HU-Q10.1, PARQUEADERO §14.3) | La copia en el Google Drive de la cuenta con que se entra, como el cuaderno de CultivoPro (HU-E8.4); sin cron ni R2 | Decisión del dueño, 8 oct 2026: «respaldo en la cuenta de Google con que se registre, tal cual quedó en CultivoPro». La celda ya es la copia del parqueadero (HU-Q7.9) y el plan gratuito no paga leerlo entero en un cron |
| Las fotos del estado a R2, con un ciclo de vida de 30 días en el bucket (HU-Q8.3, PARQUEADERO §5.5) | Al Google Drive de la cuenta, con cada copia de HU-Q10.1 (no solas: el permiso de Google dura una hora); la caja las borra a los 30 días y `/r/` no las muestra | Decisión del dueño, 12 oct 2026: «Las fotos en la nube, van para la cuenta del drive por ahora». R2 no está activado y el plan sigue gratuito |
| `v0.3.0` es M1 (plan §3.3) | `v0.3.0` es la caja de la entrega del 13 oct: lo de Q6 a Q11 que no necesita la nube. M1 pasa a `v0.4.0` | Seis sprints estaban en `main` sin publicar, y el cliente recibe la caja el 13 oct de 2026 (dueño, 12 oct) |
| M1 es la `v0.4.0` (cambio de rumbo del 12 oct) | La `v0.4.0` es la presentación al cliente del 13 oct (la operación simple, #167); M1 pasa a la `v0.5.0` | El dueño presentó la caja al cliente el 13 oct de 2026 y pidió llevar a producción lo que estaba en `main` |
| M1 se publica cuando dos cajas sin red pasan en producción (HU-Q7.12 CA1) | M1 se publica el 2026-10-13, con la caja del cliente en operación, y la prueba de dos cajas va después en el campo | Decisión del dueño, 2026-10-13: «Continuemos con eso». Staging pasó la misma prueba en la e2e de dos cajas y en la integración (HU-Q7.5) |
| El plan Parqueadero a COP 59.000 (la hipótesis del estudio, de 49.000 a 69.000) | COP 29.900 al mes por sede | Decisión del dueño, 2026-10-13 |
| Q13 era M3 (WhatsApp automático) | Q13 son la hora de 12 h, la tarifa de domingos y festivos y la mensualidad por días hábiles (HU-Q13.1 a HU-Q13.3) | Pedido del dueño, 2026-10-14, con el cliente operando; M3 sigue sin su disparador |
| Un PR por historia o por parte de un sprint | Un PR y un push por sprint completo | Decisión del dueño, 12 oct 2026, para ahorrar minutos de Actions |
| El CORE avisa el pago a la celda (`POST /api/servicio/plan`, HU-Q7.10 CA1) | La celda lee el plan del token: con el gratuito, o pasada la gracia, responde 402 `sin-plan` y la caja sigue igual | El CORE ya pone el plan con su gracia en el token (HU-C5.5) y el acceso dura minutos: un pago se ve en la vuelta siguiente, sin llamada nueva ni copia del plan en la celda (HU-C5.6 también cambió de forma) |

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

**12 · La PT210L real se vinculó y la caja dijo «Esta impresora no se reconoce».**

*Qué pasó.* El 7 oct 2026, en la primera prueba de campo en staging (HU-Q2.6), con el Android del dueño y la impresora del cliente: el selector la mostró, se eligió, la caja tardó unos segundos y dijo «Esta impresora no se reconoce». El diagnóstico no se podía copiar: solo existía después de vincular bien.

*Síntoma literal.* «Esta impresora no se reconoce» en el paso 2 del asistente.

*Lo que se sabe.* nRF Connect muestra el equipo como `PT210L_30F2`, Bluetooth clásico y LE, emparejado, y anuncia los servicios `0x18F0` y `e7810a71-73ae-499d-8c15-faa9aef0c3f2`. Los dos ya estaban en la lista de la caja. Así que la causa no es el servicio, y queda sin confirmar. Lo que el código permitía:
- Un error al leer las características de un servicio salía como «no se reconoce» (`NotFoundError` se traducía así) y cortaba la búsqueda en vez de seguir con el siguiente.
- Si el equipo soltaba la conexión GATT mientras se recorrían los servicios (es común en uno clásico y LE ya emparejado), cada servicio fallaba y la búsqueda terminaba sin nada, sin reconectar.
- El orden ponía primero dos servicios que este equipo no tiene: cada consulta fallida cuesta tiempo en Android.

*Arreglo.* Los dos servicios de la PT210L van primero. Un servicio que falla se anota y la búsqueda sigue. Si la conexión se cayó, se reconecta una vez y se busca de nuevo. Se agregan cinco servicios de los módulos BLE de las térmicas baratas. Y el diagnóstico se puede copiar desde el aviso: dice el equipo, cada servicio que falló con su error y los servicios que el permiso deja ver.

**Lo prueban** las pruebas de `bluetooth.test.ts` «si suelta la conexión mientras busca, reconecta y la encuentra (PT210L)», «un servicio que no entrega sus características no tumba la búsqueda» y «si no se reconoce, el diagnóstico dice el equipo y los servicios que se ven». La confirmación es de campo: la misma PT210L en staging, y si vuelve a fallar, su diagnóstico.

La regla: **un aviso de error en el campo siempre deja copiar lo que el código vio; un error sin diagnóstico obliga a adivinar.**

*Ficha:* parqueadero · *(mío)* · 🟠 Alto · P15, P16 · parqueadero-0.0.0 · 2026-10-07

*(Hoy: la causa apareció y no era del código. Bitácora parqueadero 13.)*

**13 · La PT210L dejó de decir «no se reconoce» al desvincularla y vincularla otra vez en Android.**

*Qué pasó.* El 7 oct 2026, antes de que el arreglo de la entrada 12 llegara a staging, el dueño desvinculó la PT210L en los ajustes de Bluetooth de Android, la vinculó de nuevo y la caja la reconoció e imprimió con la versión anterior.

*Síntoma literal.* El mismo de la entrada 12: «Esta impresora no se reconoce».

*Causa raíz.* Un vínculo viejo en Android (*Inferencia*: es lo único que cambió entre el intento fallido y el bueno). La impresora estaba emparejada como Bluetooth clásico y LE desde antes de la caja, y con ese vínculo el navegador no veía sus servicios.

*Cómo se reprodujo.* Sin reproducir: no hay cómo dañar el vínculo a propósito con la PT-210 falsa.

*Arreglo.* Ninguno en el código. El arreglo de la entrada 12 queda: no estorba, y el diagnóstico que deja copiar es lo que habría mostrado los servicios vacíos. «Desvincular y volver a vincular» pasa a ser el primer paso de soporte de la impresora (HU-Q6.2).

**Lo prueba** el campo: la misma PT210L imprimió en staging después de vincularla de nuevo.

La regla: **antes de cambiar el código por un fallo de Bluetooth en el campo, se prueba quitar el vínculo y hacerlo de nuevo; cuesta un minuto y descarta lo que el código no puede ver.**

*Ficha:* parqueadero · *(del terreno)* · 🟡 Medio · P16 · parqueadero-0.0.0 · 2026-10-07

**14 · Con la entrada, el JS inicial de la caja pasó de 46 KB a 89 KB con gzip.**

*Qué pasó.* El 7 oct 2026, en el sprint Q2, al conectar los ajustes, la entrada y el recibo a la caja. El tope es de 80 KB (HU-Q3.1, CA3).

*Síntoma literal.* `gzip -c index-*.js | wc -c` → `88747`.

*Causa raíz.* Los esquemas del parqueadero usan zod, y `@ed1/ids` también (su `id` es un esquema). Con las pantallas importadas desde `App.tsx` y `uuidv7` desde `main.tsx`, zod y los recibos entraban al trozo que la caja necesita para abrir.

*Cómo se reprodujo.* El build de `apps/parqueadero-sitio` y la e2e del presupuesto.

*Arreglo.* Ajustes, entrada y recibo viven en `vistas.tsx`, que se carga al primer toque y está en la precarga del service worker: sin red abre igual. `uuidv7` se crea ahí, no en `main.tsx`. El inicio no importa nada que traiga zod. Queda en 47 KB al abrir y 42 KB al primer toque.

**Lo prueba** la e2e «JS inicial ≤ 80 KB con gzip», que con las pantallas importadas desde `App.tsx` habría medido esos 88,7 KB del build, y la e2e «sin red, la entrada abre y registra», que carga el trozo nuevo sin conexión.

La regla: **un paquete que valida con zod no se importa desde lo que pinta la primera pantalla; se carga con la pantalla que lo usa.**

*Ficha:* parqueadero · *(mío)* · 🟡 Medio · P19 · parqueadero-0.0.0 · 2026-10-07

**15 · Los ajustes se salían de la pantalla de 360 px y el botón «Guardar» quedaba debajo de otro campo.**

*Qué pasó.* El 7 oct 2026, en las e2e nuevas de los ajustes, en el teléfono de 360 px.

*Síntoma literal.* «`<input id="tarifa-moto-nocheValor"/>` from `<fieldset class="grupo">` subtree intercepts pointer events», y la página medía 561 px de ancho.

*Causa raíz.* Un `fieldset` no se encoge por debajo del ancho de su contenido (`min-inline-size: min-content` por defecto), y en la cuadrícula de dos columnas cada `input` pedía su ancho natural de unos 20 caracteres.

*Cómo se reprodujo.* La e2e de los ajustes, con el botón «Guardar» tapado.

*Arreglo.* `fieldset { min-inline-size: 0 }`, columnas `minmax(0, 1fr)` y los campos al 100 % del ancho.

**Lo prueban** las e2e que llenan los ajustes: con el arreglo pasan, y sin él el clic en «Guardar» se agota. Las de WCAG revisan además los ajustes, la entrada y el recibo.

La regla: **todo formulario nuevo de la caja se llena en una e2e a 360 px; un formulario que solo se mira en el escritorio esconde lo que se sale.**

*Ficha:* parqueadero · *(mío)* · 🟢 Bajo · P20 · parqueadero-0.0.0 · 2026-10-07

**16 · La caja decía «0.1.0» sin haberse publicado nunca, y con la publicación por producto se habría publicado sola al fusionar.**

*Qué pasó.* El 7 oct 2026, al darle al parqueadero su versión propia (HU-Q0.3). `apps/parqueadero-sitio/package.json` traía `0.1.0` desde Q1, copiado de la plantilla de una app, mientras las fichas de esta bitácora ya decían `parqueadero-0.0.0`.

*Síntoma literal.* Ninguno todavía: lo vio la tabla de casos de `decidirPublicacion` antes de escribir el flujo. Con la etiqueta `parqueadero-v0.1.0` inexistente, el primer merge habría creado la versión en GitHub y pedido producción para un parqueadero sin dominio.

*Causa raíz.* Una versión sin etiqueta significa «publícame» (HU-C0.3). Un número puesto a mano antes de que el producto se publicara rompe esa regla en silencio.

*Arreglo.* El parqueadero queda en `0.0.0`, que `decidirPublicacion` trata como «todavía no se publica». La `0.1.0` llega en el PR de la demostración, con su sección fechada en `apps/parqueadero-sitio/CHANGELOG.md`. Si para entonces la zona no existe, la producción del parqueadero falla y lo dice, nunca cae a `workers.dev` (HU-Q5.2 CA3).

**Lo prueba** la tabla de `tests/repo/publicacion.test.ts`: en `0.0.0` no publica, en `0.1.0` sin etiqueta publica solo el parqueadero, y publicado no hace nada.

La regla: **la versión de un producto la sube el PR que lo publica; antes, `0.0.0`.**

*Ficha:* parqueadero · *(mío)* · 🟡 Medio · P16 · parqueadero-0.0.0 · 2026-10-07

**17 · Después de apagar y prender la PT210L, la caja no la volvía a conectar y decía «Esta impresora no se reconoce».**

*Qué pasó.* El 7 oct 2026, en la prueba del dueño con la PT210L del primer cliente, después de apagarla y prenderla. Antes, la página de prueba había salido en blanco: el rollo estaba al revés, y con el papel bien puesto la autoprueba imprimió.

*Síntoma literal.* El diagnóstico copiado de la caja: «0x18f0: NetworkError: GATT Server is disconnected. Cannot retrieve services.», lo mismo en los nueve servicios y en los dos intentos, y «Último error: Ningún servicio conocido tiene una característica de escritura. Servicios visibles: ninguno».

*Causa raíz.* Android soltaba la conexión GATT apenas abría, antes de que la caja pidiera el primer servicio (*Inferencia*: es la desconexión inmediata que Android da con una conexión vieja sin limpiar, conocida como el estado 133). La caja reintentaba una sola vez y sin pausa, y al no hallar característica culpaba a la impresora.

*Cómo se reprodujo.* Con una impresora falsa cuya conexión se cae las primeras veces (`bluetooth.test.ts`).

*Arreglo.* `conectarYBuscar` intenta hasta 4 veces, con 1, 2 y 3 s de pausa, y deja de preguntar por servicios en cuanto la conexión se cae. Si se cae en todas, el motivo es «La impresora está apagada o lejos», con qué hacer: apagar y prender el Bluetooth del teléfono y cerrar otra app conectada a la impresora. PR #115.

**Lo prueban** dos pruebas nuevas de `bluetooth.test.ts`: tres caídas y conecta al cuarto intento, y cuatro caídas que dicen «apagada o lejos». Sin las pausas, quedan en rojo con la del PT210L de la bitácora 13.

La regla: **«no se reconoce» solo se dice con la conexión abierta; una conexión que se cae es otro problema y tiene otro texto.**

*Ficha:* parqueadero · *(terreno)* · 🟠 Alto · P15 · parqueadero-0.0.0 · 2026-10-07

**18 · Después de conectar y desconectar la PT210L, un recibo nuevo no la volvía a conectar, y la caja no decía nada ni dejaba copiar el diagnóstico.**

*Qué pasó.* El 7 oct 2026, con el arreglo de la entrada 17 ya en staging, el dueño probó con la PT210L del primer cliente. Conectó; luego no volvió a reconectar. La desvinculó en Android y conectó. Volvió a fallar; apagó la impresora, puso el teléfono en modo avión, recargó la caja y conectó otra vez, y conectar y desconectar desde el asistente funcionó. Después registró una entrada, y desde el recibo la impresora no volvió a conectar: no salió ningún mensaje y no había cómo copiar el diagnóstico. nRF Connect, el mismo día, muestra la impresora como `PT210L_30F2`, **BONDED**, «CLASSIC and LE», anunciando `0x18F0` y `e7810a71-…`.

*Síntoma literal.* Ninguno en pantalla: ese es el fallo.

*Causa raíz.* Tres cosas del código, y una del teléfono que el código no ve:
- Al reconectar, la caja llamaba a `gatt.connect()` sin soltar antes la conexión vieja. Android puede quedarse con una conexión que ya no sirve después de que la impresora se suelta, y un `connect()` encima de ella falla o se queda esperando (*Inferencia*: es el consejo conocido para el estado 133 de Android; no se reprodujo con la unidad real).
- Un `connect()` que no respondía no tenía plazo. El recibo esperaba lo que tardara la cola, hasta 30 s, con «Enviando a la impresora…», y si la cola se rendía antes que el adaptador, el recibo dado por perdido podía salir después.
- El recibo solo ofrecía «Imprimir». Cuando no salía, decía el motivo y nada más: ni reconectar, ni elegir otra vez, ni el diagnóstico, que vivía en el inicio y en el asistente. Y en el inicio, «Conectar impresora» aparecía solo antes de la primera conexión: con la impresora suelta no había ningún botón, y la cabecera decía «toque para conectar» sin ser un botón (P15).
- La impresora está emparejada en Android como clásica y LE. Con ese vínculo la conexión LE del navegador es frágil: es lo que ya mostró la entrada 13, y lo que hace que Web Serial (HU-Q2.4), que usa justo ese emparejamiento, sea el candidato a camino principal en Android.

*Cómo se reprodujo.* Con la PT-210 falsa: una cuyo primer `connect()` nunca responde, otra que cuenta si se soltó la conexión antes de abrir otra, y en la e2e una que se apaga con la caja abierta (`__apagar()`).

*Arreglo.* `conectarYBuscar` suelta la conexión vieja antes de cada intento (`gatt.disconnect()`) y corta el que no responde en 6 s; con los 4 intentos y sus pausas, a lo sumo 30 s, y la cola espera 45. Dos reconexiones a la vez comparten la misma, e imprimir espera la que está en curso. El estado `conectando` se ve en la cabecera y nunca se queda puesto. En la caja, `ConexionImpresora` (`conexion.tsx`) ofrece «Reconectar impresora», «Elegir la impresora otra vez» y el diagnóstico, en el inicio y en el recibo que no salió; al reconectar, el recibo sale solo. El recibo nunca deja el botón esperando (`try/finally`). Si elegir otra impresora falla, la que estaba conectada sigue siendo la de la caja.

**Lo prueban** cuatro pruebas nuevas de `bluetooth.test.ts` («antes de reconectar suelta la conexión vieja», «un connect() que no responde se corta», «dos reconexiones a la vez abren una sola», «si no reconecta, queda desconectada»), dos de `caja.test.ts` y la e2e «bitácora 18 · la impresora se apagó». Control negativo, corrido el 7 oct 2026: con el adaptador de antes, las tres primeras quedan en rojo, y también «se apagó: lo dice, y al imprimir reconecta», que ahora cuenta el estado `conectando`. La confirmación es de campo, en la matriz de HU-Q6.1.

La regla: **cada pantalla donde puede fallar la impresora ofrece cómo arreglarlo y el diagnóstico; un error que solo se arregla desde otra pantalla es un error sin salida.**

*Ficha:* parqueadero · *(mío y del terreno)* · 🟠 Alto · P15, P16, P20 · parqueadero-0.0.0 · 2026-10-07

**19 · La PT210L se quedaba sin conexión después de bloquear el teléfono, las tildes se comían la letra siguiente y el escáner no leía el QR.**

*Qué pasó.* El 7 oct 2026, con el arreglo de la entrada 18 en staging, el dueño imprimió varios registros seguidos. Tres cosas: (1) la primera vez después de bloquear el teléfono y volver a la caja tuvo que conectarla otra vez, limpiando con el modo avión; (2) en el papel no salían las letras con tilde ni la letra que sigue; (3) el escaneo del QR del recibo no funcionaba. En nRF Connect, la pestaña ADVERTISER del mismo teléfono dice «HUAWEI».

*Síntoma literal.* «No salen las tildes y la letra que sigue a la tilde». Del escáner, ningún mensaje.

*Causa raíz.*
- **El bloqueo.** Mientras la página está congelada, Android puede soltar la conexión sin que el navegador avise: al volver, `connected` dice que sí y la primera escritura falla. La caja solo reconectaba si el navegador decía que la conexión estaba cerrada (*Inferencia*: no se reprodujo con la unidad real).
- **Las tildes.** El codificador ya manda `FS .` (`1c 2e`), el comando que apaga el modo chino de dos bytes, justo después de `ESC @`. Que se pierda la tilde **y** la letra siguiente es justo ese modo: cada byte mayor que `0x80` se toma como la primera mitad de un carácter chino. Así que esta PT210L ignora `FS .` (*Inferencia*, por confirmar con la foto de la página de prueba). Con «Ninguna» en la prueba, la caja translitera y no se pierde nada; la muestra vieja, `áéíóú ñÑ ¿¡ $`, no dejaba ver la letra perdida, porque cada tilde iba junto a otra tilde.
- **El escáner.** En un teléfono sin los servicios de Google, `BarcodeDetector` existe y nunca lee nada (*Capacidad documentada*: Chrome en Android lo apoya en esos servicios). La caja usaba el detector solo porque existía, y jsQR, que sí funciona ahí, nunca se cargaba. Además, un error al leer un QR raro apagaba el escáner sin decir nada.

*Cómo se reprodujo.* Con la PT-210 falsa: una cuya primera escritura falla con la conexión «abierta», y otra que falla a mitad del recibo. Y con un `BarcodeDetector` falso que no lee ningún formato.

*Arreglo.*
- Si el **primer** trozo de un recibo falla con `NetworkError`, el adaptador suelta la conexión, abre otra y lo manda una vez más. Si ya salió una parte, no lo repite: un papel a medias no sale dos veces. Al volver a la caja después de 2 minutos oculta, se abre otra conexión aunque el navegador diga que la vieja sigue (`alVolverALaCaja`); volver de WhatsApp a los pocos segundos no toca nada.
- La muestra de la página de prueba es «Él tenía más años»: cada tilde va seguida de una letra, y la pregunta dice que una línea a la que le falta una letra no sirve.
- `detectorQueLeeQr` pregunta `getSupportedFormats()` y, si no trae `qr_code`, el escáner usa jsQR, con la cámara a 1280×720 y la imagen reducida a 800 px de ancho. Un QR que falla se dice y el escáner sigue mirando.

**Lo prueban** dos pruebas nuevas de `bluetooth.test.ts` (reintenta si falla el primer trozo; no repite si falla a mitad), las de `alVolverALaCaja` en `caja.test.ts` y las de `lector.test.ts` (un detector sin `qr_code` usa jsQR). Control negativo: sin el reintento, la primera prueba da `ok: false`; con el detector viejo, el que no lee ningún formato se usaría igual. La confirmación es de campo: la foto de la página de prueba nueva, y escanear un recibo con el Huawei.

La regla: **una capacidad del navegador se pregunta por lo que hace, no por si existe; y una conexión que el navegador da por abierta se confirma con la primera escritura.**

*Ficha:* parqueadero · *(mío y del terreno)* · 🟠 Alto · P15, P16, P17 · parqueadero-0.0.0 · 2026-10-07

*(Hoy: el teléfono no es un Huawei sino un Samsung S24 Ultra; la causa del escáner queda sin confirmar. Afirmación falsa 4.)*

**20 · El commit de la impresora emparejada salió sin las líneas de los dos CHANGELOG.**

*Qué pasó.* El 7 oct 2026, en el sprint Q4, al cerrar HU-Q2.4. Un solo comando corría el guion que escribía los CHANGELOG, el formato, el lint, el typecheck, las pruebas y el commit.

*Síntoma literal.* `Error: falta en CHANGELOG.md: ### Agregado` del guion, y aun así `3114775 feat(impresion): la impresora emparejada por Web Serial`.

*Causa raíz.* El comando era `node guion.cjs && set -euo pipefail && pnpm exec biome check --write . || true; pnpm lint …`. El guion falló, el `|| true` tapó la falla de toda la cadena, y lo que venía después del `;` corrió sin `set -e`: lint, pruebas y commit, todo en verde, sin el CHANGELOG. El guion fallaba porque buscaba «### Agregado» con una línea en blanco que el CHANGELOG de la raíz no tiene. Es la bitácora agro 13 y la core 4 otra vez, por otro camino.

*Cómo se reprodujo.* Es el registro del comando: la falla y el commit en la misma salida.

*Arreglo.* Un commit aparte con las dos líneas (`docs(parqueadero): la impresora emparejada en los dos changelog`). La guardia del CI habría atrapado el del parqueadero, no el de la raíz.

**Lo prueba** nada automático; es una regla de cómo trabajo.

La regla: **un comando que termina en commit empieza con `set -euo pipefail` y no lleva ni `|| true` ni `;`: cada paso que falla detiene el commit.**

*Ficha:* parqueadero · *(mío)* · 🟡 Medio · P14 · parqueadero-0.0.0 · 2026-10-07

**21 · La PT210L imprimía dos veces y después no volvía: su luz seguía azul hasta apagar el Bluetooth del teléfono.**

*Qué pasó.* El 7 oct 2026, con #116 y #117 en staging. La impresora conecta la primera vez (su luz pasa de verde a azul claro), imprime una entrada y la reimprime. Al salir de la pantalla, dentro de la caja o fuera de ella, ya no imprime; la luz sigue azul y solo vuelve a verde al apagar el Bluetooth del teléfono. Después cuesta volver a conectar. El mismo día, el escáner con jsQR leyó el recibo, y la página `/r/` abrió desde WhatsApp.

*Síntoma literal.* El diagnóstico copiado: «Impresora: PT210L_30F2 (sin usar)», «Estado: sin_vincular» y, en los cuatro intentos, «0x18f0: NetworkError: GATT Server is disconnected. Cannot retrieve services.», con «Último error: La conexión se cayó en los 4 intentos».

*Causa raíz.* (*Inferencia*: no se puede reproducir sin la unidad.) «sin usar» y «sin_vincular» dicen que el diagnóstico es de una caja recién abierta: la sesión anterior se cerró o se recargó. La luz azul dice que la impresora seguía con un enlace abierto al teléfono. Dos cosas lo dejaban así:
- La caja nunca soltaba la conexión al cerrarse; Android puede dejarla viva sin dueño, y cada `connect()` nuevo choca con ella y se cae al instante.
- La impresora está emparejada como clásica y LE y solo acepta un enlace a la vez. Con el emparejamiento, Android puede abrir su propio enlace clásico; mientras lo tenga, la conexión LE del navegador no entra. Es lo mismo que mostraron las entradas 13, 17, 18 y 19.

*Cómo se reprodujo.* Con la PT-210 falsa: la caja suelta la conexión al cerrar, y el diagnóstico sobrevive a una recarga.

*Arreglo.* El adaptador tiene `soltar()` (Bluetooth: `gatt.disconnect()`; puerto serie: `close()`), y la caja lo llama en `pagehide`. El diagnóstico trae una línea de tiempo con los segundos de cada cambio de estado y de cada impresión, y la caja guarda el de la sesión anterior para mostrarlo después de recargar. El asistente ofrece primero «Usar la impresora emparejada» (Web Serial, HU-Q2.4), que va justo por el enlace clásico que Android ya tiene, y lo recuerda junto a un error de Bluetooth.

**Lo prueban** «suelta la conexión a propósito, y la línea de tiempo lo cuenta» (`bluetooth.test.ts`) y «el diagnóstico sobrevive a la recarga» (`caja.test.ts`). La confirmación es de campo: la PT210L por «Usar la impresora emparejada».

La regla: **una conexión que la caja abre, la caja la cierra; lo que queda abierto al irse lo hereda la siguiente.**

*Ficha:* parqueadero · *(del terreno)* · 🟠 Alto · P15, P16 · parqueadero-0.0.0 · 2026-10-07
**22 · Otro commit con el lint en rojo, ahora con `set -euo pipefail` en la primera línea.**

*Qué pasó.* El 7 oct 2026, al cerrar HU-Q5.2, dos horas después de la entrada 20. El comando empezaba con `set -euo pipefail` y tenía cada paso en su propia línea: guion, lint, typecheck, pruebas, commit y push.

*Síntoma literal.* `scripts\desplegar.ts:528:57 lint/suspicious/noShadow` y, debajo, `cf4b08e feat(parqueadero): el dominio parqueadero.laboratorio-digital.app`, ya en GitHub.

*Causa raíz.* En la herramienta Bash de esta máquina, un `set -e` no detiene las líneas siguientes del mismo comando: cada línea corre aunque la anterior falle. La memoria de trabajo ya lo decía («las líneas de un comando no se encadenan solas»), y la entrada 20 sacó una regla que no lo cubría.

*Arreglo.* `fix(despliegue): el destino del parqueadero no tapa el del despliegue`, con todo encadenado con `&&` en una sola línea lógica.

**Lo prueba** nada automático. El CI habría quedado en rojo con el lint.

La regla: **lo que termina en commit o push va en una sola cadena con `&&`; `set -e` y las líneas sueltas no detienen nada aquí.** Corrige la de la entrada 20.

*Ficha:* parqueadero · *(mío)* · 🟡 Medio · P14 · parqueadero-0.0.0 · 2026-10-07

**23 · En 360 px, el recibo salía apretado en una columna y la pantalla se salía 13 px por la derecha.**

*Qué pasó.* El 7 oct 2026, al sacar las capturas de los runbooks (HU-Q6.2) a 360 px. Estaba así desde Q2: la captura del recibo de la entrada 18 ya lo mostraba, y nadie lo miró.

*Síntoma literal.* «Tarifa: $230 por minuto» partida palabra por palabra en una columna de unos 60 px, el NIT cortado («800123»), y `document.documentElement.scrollWidth` = 373 con la ventana en 360.

*Causa raíz.* `.filas` es una cuadrícula de dos columnas, `max-content 1fr`, pensada para «etiqueta | valor». Pero `Recibo.tsx` y `Turno.tsx` envuelven cada par en un `<div>` (válido dentro de `<dl>`): la cuadrícula repartía **pares**, uno por columna. La primera columna tomaba el ancho de la dirección entera, la segunda quedaba con lo que sobraba, y la tarjeta crecía más que la pantalla.

*Cómo se reprodujo.* `sinDesborde` en tres e2e (el recibo de la entrada, el de «salvo recibo digital» y el cierre del turno). Control negativo: sin el arreglo, dos se ven en rojo con 373 ≤ 360.

*Arreglo.* `.filas > div { display: contents }`: las etiquetas y los valores son las celdas, y la segunda columna es `minmax(0, 1fr)`.

**Lo prueban** las tres e2e con `sinDesborde`.

La regla: **la bitácora 15 decía «todo formulario nuevo se llena en una e2e a 360 px»; vale para toda pantalla: cada e2e que abre una pantalla nueva mira también que nada se salga.**

*Ficha:* parqueadero · *(mío)* · 🟡 Medio · P20 · parqueadero-0.0.0 · 2026-10-07

**24 · Conectar tardaba dos minutos en decir que no, y decía «apagada o lejos» con la impresora prendida al lado.**

*Qué pasó.* El 7 oct 2026, con #119 en staging, en el Samsung S24 Ultra del dueño (Chrome 154.0.8037.126) y la PT210L emparejada. Tanto desde Ajustes como desde el recibo, «Conectar» esperaba un par de minutos antes del error. Una vez recargó la caja en medio de la espera.

*Síntoma literal.* El diagnóstico: los cuatro intentos con «0x18f0: NetworkError: GATT Server is disconnected. Cannot retrieve services.» y «se desconectó al buscar los servicios»; la línea de tiempo, `+3 s conectando` y `+130 s sin_vincular`; y, antes de recargar, una sesión que se quedó en `conectando`.

*Causa raíz.* Dos cosas mías y una del teléfono:
- El plazo de 6 s de la entrada 18 cubría el `connect()`, pero no la búsqueda de servicios. Aquí cada `connect()` respondía, y era `getPrimaryService` la que esperaba unos 30 s hasta que Android la cortaba: 4 intentos de 30 s más las pausas son los 127 s de la línea de tiempo.
- Conectar y caerse al buscar, en todos los intentos, no es «apagada o lejos»: la impresora estaba prendida y respondía. La caja culpaba a la distancia.
- (*Inferencia*, la misma de la entrada 21.) La PT210L acepta un solo enlace y el teléfono, que la tiene emparejada, ya tiene uno con ella. Por Bluetooth web la caja alcanza a conectar y se queda sin servicios. Las dos configuraciones con sentido son: emparejada y por la impresora emparejada (Web Serial), o sin emparejar y por Bluetooth web. La mezcla es la que falla.

*Cómo se reprodujo.* Con una PT-210 falsa cuya consulta de servicios no contesta nunca, y en la e2e con una que conecta y se cae al buscar.

*Arreglo.* Las consultas de servicios y características tienen plazo de 5 s (`MS_POR_BUSQUEDA`); la que no contesta suelta la conexión y cuenta como caída. Con los 4 intentos, el no llega en unos 25 s. Si conecta y se cae al buscar en todos, el motivo es `enlace_ocupado` («La impresora está ocupada con otro enlace del teléfono»), con qué hacer. Donde falla la conexión (inicio y recibo), la caja ofrece también «Usar la impresora emparejada», en primer lugar si el enlace estaba ocupado. Y el diagnóstico empieza diciendo qué caminos tiene el navegador.

**Lo prueban** «un servicio que no contesta se corta: dice que no en segundos» (`bluetooth.test.ts`; sin el plazo, la prueba se agota esperando), «si se cae en los 4 intentos, dice que el enlace está ocupado», «el diagnóstico dice qué caminos tiene el navegador» (`caja.test.ts`) y la e2e «bitácora 24».

La regla: **todo lo que espera al navegador tiene plazo, no solo lo primero; y un error no culpa a la distancia si la impresora contestó.**

*Ficha:* parqueadero · *(mío y del terreno)* · 🟠 Alto · P8, P15, P17 · parqueadero-0.0.0 · 2026-10-07

**25 · Un guion metió una copia entera de esta bitácora dentro de la entrada 19, y nadie lo vio en cuatro PR.**

*Qué pasó.* El 7 oct 2026, en el arreglo de #117. Se encontró horas después, al leer la sección de afirmaciones falsas y verla dos veces.

*Síntoma literal.* El archivo pasó de 654 a 1331 líneas en un commit que solo agregaba la entrada 19; la entrada 19 quedó cortada en «áéíóú ñÑ ¿¡» con el archivo entero pegado detrás.

*Causa raíz.* El guion insertaba la entrada con `s.replace(marca, marca + entrada)`. Con un texto como reemplazo, JavaScript interpreta `` $` `` como «todo lo que va antes de la coincidencia», y la entrada citaba la muestra vieja de la página de prueba, que termina en `$`. Es P14, los fallos silenciosos del lenguaje: no hubo error, ni el lint, ni las pruebas, ni la revisión del diff (677 líneas nuevas en un archivo de documentos) lo detuvieron.

*Cómo se reprodujo.* `git log` del archivo: el commit `adb8946` es el primero con dos «## Lo aprendido».

*Arreglo.* Se quitó la copia cortando con `slice`, sin `replace`. `tests/repo/bitacoras.test.ts` falla si una bitácora repite una sección o un número de entrada; con el archivo de antes del arreglo, se ve en rojo. Los guiones de documentos insertan con `indexOf` y `slice`.

**Lo prueba** `tests/repo/bitacoras.test.ts`, en las cinco bitácoras del repositorio.

La regla: **un texto que se inserta no pasa por `String.replace` como reemplazo; y un diff de documentos con cientos de líneas que nadie escribió se lee antes del commit.**

*Ficha:* parqueadero · *(mío)* · 🟠 Alto · P14 · parqueadero-0.0.0 · 2026-10-07

**26 · El arreglo de la tarifa en $0 llegó a `main` después de publicada la `0.1.0`, y al resolver el conflicto la sección publicada del CHANGELOG cambió.**

*Qué pasó.* El 8 oct 2026, en la madrugada de la puesta en marcha. #131 (la salida en $0 dice por qué; el tope por día menor que una hora no se guarda) y #130 (la `0.1.0`) estaban abiertos a la vez. El orden pedido era #131 y después #130, con el arreglo dentro de la `0.1.0`. Se fusionó #130 primero: la `0.1.0` se publicó (`parqueadero-v0.1.0`) y salió a producción sin el arreglo. Al traer `main` a #131, el conflicto del CHANGELOG se resolvió a mano y se fusionó.

*Síntoma literal.* En el CI de `main`, commit `f2c236c`:

```
❌ apps/parqueadero-sitio/CHANGELOG.md: la sección [0.1.0] ya se publicó (parqueadero-v0.1.0) y cambió. Lo nuevo va en «[Sin publicar]».
```

El despliegue a staging se saltó.

*Causa raíz.* La resolución dejó el «Corregido» en «[Sin publicar]», que estaba bien, pero borró el encabezado `## [0.1.0] - 2026-10-08` y su párrafo, así que el «Agregado» de la `0.1.0` quedó como si no se hubiera publicado. El orden de fusión vivía solo en un mensaje del hilo; nada en los PR lo hacía cumplir.

*Cómo se reprodujo.* `git diff parqueadero-v0.1.0 f2c236c -- apps/parqueadero-sitio/CHANGELOG.md`.

*Arreglo.* #132 devuelve la `0.1.0` a lo que dice su etiqueta y publica el arreglo como `0.1.1`. Un arreglo que tiene que salir en una versión ya no se pide «antes de» otro PR: se lleva dentro del PR de la versión, o la versión espera en borrador.

**Lo prueba** `scripts/verificar-changelog.ts`, que es el que lo vio: en `f2c236c` sale en rojo; con #132, en verde.

La regla: **cuando dos PR deben fusionarse en orden, el segundo queda en borrador hasta que el primero entre; un orden escrito en un mensaje no se cumple solo.**

*Ficha:* parqueadero · *(compartido)* · 🟢 Bajo · P5 · parqueadero-0.1.1 · 2026-10-08

**27 · En modo oscuro, la caja nunca tuvo su azul: el lila del ecosistema le ganaba por especificidad.**

*Qué pasó.* El 8 oct 2026, al revisar la caja pantalla por pantalla para HU-Q6.5. En oscuro, los botones principales salían lila (`#94a9ff`), no el azul claro de la señal de parqueo (`#7fb0f0`) que dice `estilos.css`.

*Síntoma literal.* Las capturas a 360 px en oscuro: «Configurar impresora», «Abrir turno» y «Nueva entrada» en lila.

*Causa raíz.* Los tokens del ecosistema ponen el oscuro en `:root:not([data-tema='claro'])`, que pesa (0, 2, 0). La caja lo redefinía en `:root`, que pesa (0, 1, 0): aunque su hoja carga después, pierde. En claro no se notaba porque los dos usan `:root`.

*Cómo se reprodujo.* `pnpm --filter @ed1/parqueadero-sitio run build` y la caja con `emulateMedia({ colorScheme: 'dark' })`.

*Arreglo.* La caja usa el mismo selector que los tokens; con el mismo peso, gana la hoja que carga después. De paso, al animar el color de los botones, axe midió un azul a medio camino (4,2:1) y la prueba de contraste salió en rojo: ahora solo se anima el gesto de tocar, y el color cambia de una vez.

**Lo prueba** la e2e de WCAG 2.1 AA en claro y en oscuro (`tests/e2e/parqueadero-caja.spec.ts`), que corre en cada PR, y las capturas de los runbooks.

La regla: **una variable que redefine un token se escribe con el mismo selector del token, no con uno más corto.**

*Ficha:* parqueadero · *(mío)* · 🟢 Bajo · P15 · parqueadero-0.2.0 · 2026-10-08

**28 · El D1 local no podía cargar la migración del parqueadero: partía mal un trigger y un «;» con comentario.**

*Qué pasó.* El 8 oct 2026, en HU-Q7.2, al correr por primera vez las 56 comprobaciones del shard con `baseLocal` de `@ed1/d1/local`, en `node:sqlite` y en el D1 local de workerd. El mismo archivo pasaba con `probar-parqueadero.mjs`, que lo corría entero con `exec`.

*Síntoma literal.* En los dos instrumentos, antes de la primera comprobación:

```text
D1_ERROR: incomplete input: SQLITE_ERROR
```

*Causa raíz.* `sentenciasDe` parte las migraciones por «;» al final de línea y reconoce un `CREATE TRIGGER … END;` solo si empieza una sentencia nueva. Dos formas válidas del SQL del parqueadero lo engañaban: una línea en blanco antes del trigger (contaba como el comienzo de una sentencia, así que el trigger se partía en cada «;» de su cuerpo) y `('punto');  -- puesto de trabajo`, cuyo «;» no queda al final de la línea. Las migraciones del agro y del CORE no tenían ninguna de las dos, así que el partidor nunca se había probado con ellas. No es una diferencia entre `node:sqlite` y D1: el error venía del instrumento de prueba, y `wrangler d1 migrations apply` las acepta.

*Cómo se reprodujo.* Partiendo el archivo con `sentenciasDe` y corriendo cada sentencia en un `DatabaseSync` en memoria: falla en `registro_reglas`.

*Arreglo.* Un trigger empieza aunque lo precedan líneas en blanco, y un «;» seguido de un comentario `--` cierra la sentencia. La migración no se tocó.

**Lo prueban** dos casos en `tests/repo/shard-parqueadero.test.ts` y las 56 comprobaciones, que sin el arreglo no llegan a correr. Control negativo de CA3, corrido el mismo día: con `INSERT OR IGNORE` en lugar de `ON CONFLICT (id) DO NOTHING`, las mismas secciones se ven en rojo en los dos instrumentos, entre ellas «la fecha local va como AAAA-MM-DD» (un `CHECK` que `OR IGNORE` se salta), y el total baja de 56 a 44; sin el trigger de inmutabilidad, «un registro no se modifica» se ve en rojo en los dos.

La regla: **un instrumento de prueba que parte SQL también se prueba con el SQL nuevo antes de culpar a la base; el archivo que ya pasaba en otro instrumento es la pista.**

*Ficha:* parqueadero · *(mío)* · 🟢 Bajo · P17 · parqueadero-0.2.0 · 2026-10-08

**29 · La corrida de staging de #145 se saltó la celda c2: solo despliega el CORE y el agro.**

*Qué pasó.* El 8 oct 2026, al fusionar #145 (HU-Q7.2), la corrida «desplegar» de staging terminó en verde. Al revisar qué había preparado para c2, el código dice que no la tocó.

*Síntoma literal.* Deducido del código, sin el log: el registro de la corrida no se pudo leer desde la sesión del asistente. Para c2, la línea del resumen es:

```text
parqueadero: sin publicar en este despliegue (su versión no cambió)
```

*Causa raíz.* El despliegue preparaba una celda del parqueadero solo si la corrida nombraba al producto (`--productos parqueadero`). La de staging nunca lo nombra: sin lista, `productosADesplegar` devuelve `core` y `agro`, y el parqueadero solo entra cuando se publica una versión suya. La caja de staging no tenía el problema porque se despliega junto al CORE sin mirar esa lista. Las pruebas de #145 cubrían la configuración, los ids por destino y la exclusión de producción, pero no qué corrida llega a llamar la preparación.

*Cómo se reprodujo.* Con `preparaLasCeldasDelParqueadero('staging', productosADesplegar(undefined))`, que con la regla vieja da `false`.

*Arreglo.* Staging prepara las celdas del parqueadero en cada corrida, como despliega la caja de staging. Producción sigue igual: solo cuando se publica el parqueadero, y hoy eso se limita a la nota de producción.

**Lo prueba** «staging la prepara aunque su lista de productos sea la de siempre» en `tests/repo/celda-despliegue.test.ts`. Control negativo: con la condición de antes, la prueba se ve en rojo.

La regla: **una rama nueva del despliegue se prueba con la lista de productos que de verdad recibe cada destino, no con la que uno supone.**

*Ficha:* parqueadero · *(mío)* · 🟢 Bajo · P1 · parqueadero-0.2.0 · 2026-10-08

**30 · La caja que sincronizaba en las pruebas no podía hablar con la celda en el navegador: su CSP solo dejaba su origen.**

*Qué pasó.* El 8 oct 2026, con HU-Q7.5 en verde en las pruebas de integración (las cajas y el Worker de la celda en el mismo proceso), la e2e de dos cajas en dos navegadores no subió nada: la cabecera decía «3 en este dispositivo, sin señal» con la red puesta.

*Síntoma literal.* En la consola de la caja:

```text
Refused to connect to 'https://parqueadero-api-c2.ejemplo.test/api/v1/sync/push' because it violates the following Content Security Policy directive: "connect-src 'self'".
```

*Causa raíz.* La CSP de la caja nació en M0 sin cuenta ni API (ADR-32) con `connect-src 'self'`, y nada la ataba a las celdas. Las pruebas de integración llaman al `fetch` de Node, que no aplica CSP. Y la caja dice «sin señal» porque, para `fetch`, una conexión que la CSP bloquea es igual a no tener red.

*Cómo se reprodujo.* La e2e `tests/e2e/parqueadero-dos-cajas.spec.ts` contra el `dist` armado antes del arreglo.

*Arreglo.* La CSP sale de `celdas.json` (P2) por entorno: en staging, `connect-src 'self'` más la API de staging de cada celda del parqueadero; en producción, solo `'self'` hasta que HU-Q7.12 publique la celda, la misma regla del directorio del CORE. La prueba de humo del despliegue compara con la CSP de su entorno.

**Lo prueban** «la caja se conecta a la API de su celda en staging, y en producción a ninguna» en `tests/repo/parqueadero-sitio.test.ts` y la e2e de dos cajas. Control negativo: con la CSP de antes, la e2e se ve en rojo en la primera subida, y la prueba de humo de staging falla con la CSP de producción.

La regla: **una conexión nueva de la caja se prueba en un navegador con las cabeceras que se despliegan; un arnés en Node no tiene CSP.**

*Ficha:* parqueadero · *(mío)* · 🟢 Bajo · P17 · parqueadero-0.2.0 · 2026-10-08

**31 · La lista de cajas comparaba el parqueadero de la caja con el de su propia fila, no con el del token: la guardia de tenant la paró.**

*Qué pasó.* El 8 oct 2026, al escribir `GET /api/v1/dispositivos` (HU-Q7.7), la lista sumaba a cada caja su último número con una subconsulta. Las pruebas de la API estaban en verde en los dos instrumentos de D1; la batería completa no.

*Síntoma literal.* En `tests/repo/org-id-en-consultas.test.ts`:

```text
dispositivos.ts: select d.id, d.serie, d.nombre, d.estado, d.creado, d.retirado, (selec…
AssertionError: expected 'from registro sin «where … org_id = ?»' to be null
```

*Causa raíz.* La subconsulta decía `WHERE r.org_id = d.org_id AND r.serie = d.serie`. Daba bien, porque la consulta de afuera filtra `d.org_id` por el token, pero la regla de la celda es que cada `FROM` de una tabla con datos de un parqueadero diga el suyo con el `org_id` del token: un cambio en la consulta de afuera dejaría a la de adentro leyendo de todos. Las pruebas de la API no lo podían ver, porque con un solo parqueadero el resultado es el mismo.

*Cómo se reprodujo.* La batería completa de vitest, con `dispositivos.ts` nuevo en `apps/parqueadero-api/src`.

*Arreglo.* La subconsulta dice `r.org_id = ?1`, el mismo parámetro del token, y `dispositivos.ts` entró a la lista de archivos que la guardia revisa.

**Lo prueba** la misma guardia, que ahora recorre `dispositivos.ts`. Control negativo: con la subconsulta de antes, la guardia se ve en rojo con el mensaje de arriba.

La regla: **una consulta nueva de la celda se corre con la batería entera antes de darla por buena; la guardia de tenant ve lo que una prueba con un solo parqueadero no puede ver.**

*Ficha:* parqueadero · *(mío)* · 🟢 Bajo · P4, P12 · parqueadero-0.2.0 · 2026-10-08

**32 · El script del generador llevaba `infrastructure/productos.json` entero al navegador.**

*Qué pasó.* El 8 oct 2026, al construir el generador de recibo de entrada (HU-Q11.4), su script tomaba el nombre de su producto para los eventos de `contenido.ts`, que lee `infrastructure/productos.json` para saber el dominio.

*Síntoma.* Después de `astro build`, buscar `kill_switches` y `rutas_de_vuelta` en `apps/parqueadero-sitio/dist/_astro/` encontraba el archivo del script del generador. No se guardó la salida exacta.

*Causa raíz.* Vite empaqueta todo lo que importa un script de cliente, también un JSON importado por un módulo que la página solo usa al construir. Los kill switches, las cuotas y las rutas de vuelta de todos los productos quedaban en un archivo público, y el script pesaba más de lo que hacía.

*Cómo se reprodujo.* `grep` del `dist` armado, como arriba.

*Arreglo.* La página escribe el producto en el formulario (`data-producto`) al construir, y el script lo lee de ahí: el script del cliente no importa `contenido.ts`. Su JS quedó en 1,8 KB con gzip, más la hoja del recibo que comparte con `/r/`.

**Lo prueba** «el código que corre en el navegador no carga `contenido.ts` ni `productos.json`» en `apps/parqueadero-sitio/src/sitio/contenido.test.ts`. Control negativo: con el import de antes, la prueba se ve en rojo.

La regla: **un script de cliente no importa un módulo hecho para el build; lo que necesita de él, la página se lo deja escrito en el HTML.**

*Ficha:* parqueadero · *(mío)* · 🟢 Bajo · P13 · parqueadero-0.2.0 · 2026-10-08

**33 · El cierre de turno contaba como WhatsApp un recibo que el cajero marcó «No se envió».**

*Qué pasó.* El 9 oct 2026, al construir «Lo que ahorra» (HU-Q8.6), su CA3 pide que un WhatsApp abierto y después marcado «No se envió» no cuente como digital. El cierre de turno (HU-Q3.9) ya contaba los recibos por canal, y la prueba nueva del cierre con esa entrega salió en rojo contra su código.

*Síntoma literal.* La prueba «❌ un WhatsApp marcado «No se envió» no cuenta como entregado» de `turno.test.ts`, con el código de antes:

```text
-   "sinEntrega": 1,
-   "whatsapp": 0,
+   "sinEntrega": 0,
+   "whatsapp": 1,
```

*Causa raíz.* El recibo de la caja anota dos entregas cuando el cajero toca «No se envió»: primero `abierto`, al abrir WhatsApp, y después `no_enviado`. El cierre ignoraba la segunda en vez de deshacer la primera, así que el recibo quedaba como entregado por WhatsApp. Con el papel no pasaba: ahí «No salió» ya restaba el envío.

*Cómo se reprodujo.* `resumirTurno` con las entregas de ensayo más una `no_enviado` sobre el recibo de salida que ya tenía su `abierto`.

*Arreglo.* El canal de cada recibo sale de un solo lugar, `entregasDeLosRecibos` (`packages/parqueadero-recibos/src/entregas.ts`), que usan el cierre, el reporte del día y «Lo que ahorra». Recorre las entregas en orden: `abierto` suma, `no_enviado` resta, igual que «No salió» en el papel.

**Lo prueba** la prueba de arriba, que con el código de antes da el síntoma literal; y «las entregas cuadran con los eventos de HU-Q5.3 del periodo (CA2)» en `apps/parqueadero-sitio/src/caja/ahorro.test.ts`, con la caja de verdad.

La regla: **una acción que deshace otra se cuenta restando, no ignorándose; y lo que dos pantallas cuentan igual sale de una sola función.**

*Ficha:* parqueadero · *(mío)* · 🟡 Medio · P1, P2 · parqueadero-0.2.0 · 2026-10-09

**34 · La prueba WCAG de la caja fallaba si corría después de las 19:00 de Bogotá.**

*Qué pasó.* El 9 oct 2026, a las 22:33 de Bogotá, la validación completa del PR de mensualidades (#157) salió con dos fallas: la prueba «HU-Q3.1 · la caja y el asistente terminado pasan WCAG 2.1 AA», en modo claro y oscuro. Esa misma prueba había pasado en el CI del PR #156, de día.

*Síntoma literal.*

```text
Error: expect(locator).toBeVisible() failed
Locator: getByTestId('turno-del-reporte')
- textbox "Día": 2026-10-09
- paragraph: Ese día no se abrió ningún turno.
```

*Causa raíz.* La prueba abría el turno con la hora real y después movía el reloj de la página tres horas (`Date.now() + 180 min`) para la salida. Desde las 19:00 de Bogotá esas tres horas caen en el día siguiente, y «Reportes» abre en el día de hoy, que ya no tiene el turno. La caja estaba bien: la prueba dependía de la hora a la que corría.

*Cómo se reprodujo.* Corriendo la prueba a las 22:33 de Bogotá; con el reloj fijo a mediodía, pasa.

*Arreglo.* La prueba fija el reloj al empezar (20 oct 2026, 10:00 de Bogotá) y la salida es ese instante más tres horas (`tests/e2e/parqueadero-caja.spec.ts`, PR #157).

**Lo prueba** la misma prueba, que con el reloj fijo da igual a cualquier hora.

La regla: **una prueba que mueve el reloj empieza desde un reloj fijo; la hora real hace que pase de día y falle de noche.**

*Ficha:* parqueadero · *(mío)* · 🟢 Bajo · P8 · parqueadero-0.2.0 · 2026-10-09

**35 · Seis pruebas de la celda del parqueadero fallaban en la máquina del dueño y pasaban en el CI: el Node mínimo del repositorio no servía.**

*Qué pasó.* El 12 oct 2026, al preparar la `0.3.0` de la entrega, `pnpm test` en la máquina del dueño (Windows, Node 22.18.0) dio seis fallas en `parqueadero-reclamar`, `dispositivos` y `terminos`. El CI del mismo commit estaba en verde.

*Síntoma literal.* La API respondía 503 y su registro decía:
```text
parqueadero-api: falla inesperada: D1_ERROR: column index out of range
```

*Causa raíz.* La consulta de `dispositivos.ts` usa `?1` dos veces, para el `org_id` del token (el arreglo de la entrada 31). `node:sqlite` de Node 22.18 y 22.19 no liga un parámetro numerado repetido; desde 22.20 sí. El CI instala el último Node 22 y nunca lo vio; `package.json` decía `>=22.18.0`, una promesa que nadie había probado.

*Cómo se reprodujo.* Una consulta de dos líneas con `?1` repetido en `DatabaseSync`, con `npx -p node@22.19.0` (falla) y `npx -p node@22.20.0` (pasa). Con 22.20, las tres suites en verde.

*Arreglo.* `engines` y el README piden Node 22.20 o posterior. `packages/d1/src/sqlite.test.ts` prueba un `?1` repetido con un nombre que dice la versión: en un Node viejo, la falla dice por qué.

**Lo prueba** «un ?1 repetido liga el mismo valor en las dos partes, como D1», que en Node 22.18 sale en rojo con el síntoma de arriba.

La regla: **la versión mínima que dice `engines` es una afirmación: la prueba que la cubre lleva su número, porque el CI solo ve la última.**

*Ficha:* parqueadero · *(mío)* · 🟢 Bajo · P17 · parqueadero-0.3.0 · 2026-10-12

**36 · La arquitectura decía que las fotos se borran a los 30 días de la salida, y ninguna línea las borraba.**

*Qué pasó.* El 12 oct 2026, al diseñar HU-Q8.3 (las fotos al Drive de la cuenta), busqué la purga del teléfono para reusarla: PARQUEADERO §5.5 dice «En M0 viven en el dispositivo hasta cerrar la estadía más 30 días». No estaba. La caja de producción toma fotos desde la `0.1.0`.

*Síntoma literal.* Ninguno en pantalla: `db.fotos` solo tenía `add`. Buscando en `apps/parqueadero-sitio/src/caja/`, las únicas escrituras de `fotos` eran la entrada y el respaldo; la purga de los números (`purgarContactos`, HU-Q4.1) sí existía.

*Causa raíz.* La regla vivía en la arquitectura y en ninguna historia con su criterio: HU-Q3.3 pide tomarlas y comprimirlas, HU-Q3.10 dejarlas fuera del respaldo, y la de los números tuvo su CA3 con prueba. Hasta cuatro fotos de unos 100 KB por vehículo, sin borrarse, llenan el teléfono de la caja con los meses (*Inferencia*: 200 entradas al día con una foto son unos 600 MB al mes).

*Cómo se reprodujo.* `purgarFotos` no existía; la prueba nueva, con una salida de hace 31 días, no tenía qué llamar.

*Arreglo.* `purgarFotos` (`datos.ts`) corre con la de los números, al abrir la caja y cada 10 minutos: borra las fotos de las estadías cerradas hace más de 30 días (la salida vigente o la anulación de la entrada; una salida anulada la vuelve a abrir) y anota sus ids para borrarlas también de Drive (HU-Q8.3). Sale en la `0.3.0`, la de la entrega.

**Lo prueban** «se quedan 30 días después de la salida y se borran después» y «una entrada anulada cierra la estadía; una salida anulada la vuelve a abrir» (`fotos-vencidas.test.ts`).

La regla: **un plazo que promete la arquitectura es una historia con su prueba; si solo está escrito, nadie lo construye.**

*Ficha:* parqueadero · *(mío)* · 🟡 Medio · P13, P20 · parqueadero-0.3.0 · 2026-10-12

**37 · La e2e de las dos cajas se colgó 5 minutos en el CI esperando el teclado de la placa, y en local pasa siempre.**

*Qué pasó.* El 12 oct 2026, en el CI del PR #160 (minutos de Actions, sin cambios en la caja). La misma e2e había pasado en los dos CI de #158 (21,7 s) y pasó dos veces seguidas en local (32 s). El paso e2e tardó 477 s en vez de unos 270.

*Síntoma literal.*
```text
Test timeout of 300000ms exceeded.
Error: locator.click: Test ended.
  - waiting for getByRole('group', { name: 'Teclado de la placa' }).getByRole('button', { name: 'A', exact: true })
    at entrar (tests/e2e/parqueadero-dos-cajas.spec.ts:121:9)
```

*Causa raíz.* Sin confirmar. La caja estaba sin red, registrando entradas, y la pantalla no tenía el teclado con la «A» (*Inferencia*: otra pantalla encima, o el teclado ya en números por una placa a medio escribir). El CI no guardaba lo que vio Playwright, así que no hay con qué decidir, y el plazo de 300 s convirtió un cuelgue en 5 minutos facturables.

*Cómo se reprodujo.* No se reprodujo: en local pasa.

*Arreglo.* Parcial, hasta verlo otra vez: si el CI falla, sube `test-results/` como artefacto por tres días (la página y el error de cada e2e que falló), y la prueba se corta a los 90 s en vez de 300. Si se repite, la causa va aquí con el contexto.

**Lo prueba** nada todavía: es una entrada abierta.

La regla: **una e2e intermitente no se corre otra vez a ciegas; se guarda lo que vio y su plazo es el de una corrida lenta, no cinco veces más.**

*Ficha:* parqueadero · *(del terreno)* · 🟡 Medio · P15, P19 · parqueadero-0.3.0 · 2026-10-12

**38 · Al simplificar la caja, el inicio conservaba el desplazamiento y compartir podía bloquear el respaldo.**

*Qué pasó.* El 12 oct 2026, en la revisión visual y las pruebas de navegador de la operación sin turnos. Después de Ajustes, el inicio podía quedar desplazado y ocultar Nueva entrada. En la prueba de respaldo, el navegador rechazó compartir con `NotAllowedError` y no descargó la copia.

*Causa raíz.* La navegación interna conservaba el desplazamiento de la pantalla anterior. El respaldo confiaba en que disponer de `navigator.share` era suficiente para entregar el archivo, aunque el navegador podía impedir su uso.

*Arreglo.* La navegación vuelve arriba y desactiva la restauración automática del navegador. El respaldo descarga el archivo si compartir falla con `NotAllowedError`; una cancelación del usuario sigue siendo una cancelación.

**Lo prueban** las pruebas de navegador del respaldo y la aceptación con las dos sedes de ensayo; el recorrido sin turnos se revisó también a 360 y 1280 px. La corrida completa terminó con 52 pruebas aprobadas y una captura de runbooks omitida por diseño.

La regla: **una capacidad disponible puede fallar al usarla; el respaldo necesita una forma de entrega comprobada.**

*Ficha:* parqueadero · *(mío)* · 🟡 Medio · P5, P15 · sin publicar · 2026-10-12

**39 · En la puesta en marcha, escanear el recibo del cliente costaba: había que «luchar un poco» con la cámara.**

*Qué pasó.* El 13 oct 2026, antes de entrar en operación, el dueño probó el escáner con los recibos impresos en la PT-210 del cliente.

*Síntoma literal.* «Toca luchar un poco para escanear el recibo del cliente» (el dueño). Sin error en pantalla: la cámara tardaba en leer o había que mover el papel varias veces.

*Causa raíz.* Tres cosas mías que se suman (*Inferencia*, sin medir con el teléfono del cliente): el QR del papel medía unos 25 a 28 mm (módulos de 5 puntos, 0,6 mm); el escáner pedía 1280×720 y le pasaba al detector la imagen entera, donde un QR de 3 cm a un palmo ocupa poco; y miraba cada 250 ms, sin pedir enfoque continuo. Nada guiaba dónde poner el papel.

*Cómo se reprodujo.* No se reprodujo en una prueba: el escáner no tiene e2e con cámara. Se midió lo que se imprime (`codificar`) y lo que recorta el escáner (`recorteCentral`).

*Arreglo.* El QR del papel pasa a módulos de 7 a 8 puntos (unos 36 mm; nativo `size: 8`, el máximo de la PT-210). El escáner pide 1920×1080 y enfoque continuo si la cámara lo tiene, mira cada 120 ms, alterna la imagen entera y el cuadro del centro (el 60 % que la pantalla marca con un cuadro guía), y jsQR prueba también invertido. Si el teléfono tiene linterna, aparece «Prender la linterna». Sale en la `0.4.1`.

**Lo prueban** el cuadro guía y su recorte (`lector.test.ts`: el CSS y el recorte dicen el mismo 60 %) y los bytes de referencia del recibo (`index.test.ts` de `@ed1/impresion`), que cambiaron con el tamaño del QR. Falta la prueba en el teléfono del cliente: va a la matriz.

La regla: **lo que el cajero escanea cien veces al día se prueba con el papel y el teléfono de verdad antes de entregar; un QR que «se lee» en el escritorio no es uno que se lee en la caja.**

*Ficha:* parqueadero · *(mío y del terreno)* · 🟡 Medio · P16, P20 · parqueadero-0.4.1 · 2026-10-13

**40 · Después de «No cobrar ahora», la mensualidad se cobraba con otra fecha y otro valor, y la lista no decía quién debía.**

*Qué pasó.* El 14 oct 2026, con el cliente en operación, el dueño agregó un abonado con «No cobrar ahora» y luego le cobró desde su detalle.

*Síntoma literal.* «La fecha que muestra luego de pagar la mensualidad está mal, el valor también» y «en la sección de abonados no se distingue quién debe y quién ya pagó» (el dueño).

*Causa raíz.* Mía. La caja daba por pagada la vigencia del catálogo: «No cobrar ahora» se pensó para el talonario de antes (HU-Q8.4), y desde el detalle «Cobrar mensualidad» cobraba siempre el periodo siguiente al `hasta`, entero. El abonado que no había pagado octubre recibía el cobro de noviembre. La lista decía «Vigente · del … al …», que es igual para el que pagó y para el que no.

*Cómo se reprodujo.* La e2e de HU-Q8.4 lo afirmaba como correcto: después de «No cobrar ahora», el cobro esperaba $300.000 del 01/11 al 30/11.

*Arreglo.* La caja calcula hasta dónde pagó cada abonado con sus mensualidades no anuladas (`pagadoHastaDe`). El cobro empieza por lo que falta de la vigencia que corre, con su prorrateo, y lo muestra tramo por tramo (`detalleDelProrrateo`). La lista y el detalle dicen «Al día», «Debe» o «Venció» con su color. Al probarlo salió otro: dos mensualidades cobradas en el mismo minuto se ordenaban al azar, y «Anular la mensualidad» podía anular la primera. Ahora la última es la que llega más lejos. Sale en la `0.7.1`.

**Lo prueban** `cuenta-del-abonado.test.ts` y `detalle-del-prorrateo.test.ts`, y la e2e de HU-Q8.4: debe, paga octubre en proporción, queda al día y renueva noviembre entero. Los abonados de antes sin pagos en la caja aparecen como «Debe»: el cliente empezó el 13 oct, así que se acepta.

La regla: **lo que no se cobró no está pagado; la pantalla dice quién debe con la misma fuente que cobra.**

*Ficha:* parqueadero · *(mío)* · 🔴 Alto · P1, P15 · parqueadero-0.7.1 · 2026-10-14

**41 · La 0.7.1 se publicó, pero no llegó a producción, y volver a desplegar a mano tampoco la llevó.**

*Qué pasó.* El 14 oct 2026 se fusionó el PR de la 0.7.1 (bitácora 40). Staging se actualizó y se creó `parqueadero-v0.7.1`, pero la caja de producción siguió en la 0.7.0.

*Síntoma literal.* «Los cambios no se publicaron en producción», y después: «desplegar terminó, pero no actualizó la aplicación de producción» (el dueño).

*Causa raíz.* Dos cosas.
- La primera corrida se detuvo en c0: la sonda de R2 respondió como si `CF_API_TOKEN` tuviera «Workers R2 Storage». El dueño dice que el token no lo tenía desde el día anterior, y en la corrida a mano de la mañana la misma sonda pasó. *Inferencia*, sin comprobar: una respuesta pasajera de Cloudflare. Los reintentos de esa corrida ya no vieron versión nueva, porque la etiqueta existía.
- La segunda es mía. «Run workflow» no tenía la entrada `productos`, y sin ella el despliegue solo lleva el CORE y el agro (HU-C0.3). La parte del parqueadero dijo «nada que desplegar (su versión no cambió)» y la corrida terminó en verde sin tocar la caja. Una versión publicada a mano tenía el mismo problema.

*Cómo se reprodujo.* En el registro de la corrida a mano: `PRODUCTOS:` vacío y «Parte parqueadero: nada que desplegar en produccion».

*Arreglo.* `desplegar.yml` acepta `productos` en «Run workflow» y lo pasa al despliegue. Una versión publicada a mano lleva su producto por el prefijo de la etiqueta (`parqueadero-v`, `tienda-v`). El runbook de despliegue dice cómo pedir el parqueadero. Lo prueba `tests/repo/flujos.test.ts`.

La regla: **un despliegue en verde que no tocó lo que se quería es una falla silenciosa; lo que se despliega a mano se elige, no se adivina.**

*Ficha:* parqueadero · *(mío y del terreno)* · 🔴 Alto · P1, P17 · sin versión propia · 2026-10-14

**42 · La señal «entregas pendientes» solo subía: no se podía ver qué faltaba ni hacerla bajar.**

*Qué pasó.* El 14 oct 2026, con el cliente operando, el dueño preguntó qué significaba el mensaje de entregas pendientes arriba a la derecha.

*Síntoma literal.* «¿Qué significa el mensaje de entregas pendientes en la parte superior derecha?» (el dueño).

*Causa raíz.* Mía. HU-Q3.3 CA4 guardaba cada papel que no salía en `entregas_pendientes` para que la cabecera lo contara (P15), pero nada leía la tabla ni la vaciaba. Reimprimir el recibo no la tocaba, y no había pantalla para ver cuáles eran: la cuenta en rojo solo podía crecer, y una señal que siempre está en rojo deja de decir algo.

*Cómo se reprodujo.* La e2e de HU-Q3.3 afirmaba que la señal decía «1» y terminaba ahí; nadie probó qué pasaba después.

*Arreglo.* La señal, con pendientes, es un botón que abre la lista: una fila por recibo, con cuántas veces no salió, la hora y el motivo. «Abrir para imprimir» abre el recibo (o el de la mensualidad), y `registrarEntrega` quita sus pendientes cuando el papel sale o el conductor escanea el recibo. «Quitar de la lista» deja al cajero quitar el resto. Sale en la `0.7.2`.

**Lo prueban** `pendientes.test.ts` (agrupar, salir al imprimirse, ❌ un papel fallido no la quita, quitar a mano) y la e2e de HU-Q3.3, que ahora sigue: abre la lista, abre el recibo, vuelve a fallar en la misma fila y la quita.

La regla: **una señal que cuenta un problema necesita el camino para resolverlo; si solo sube, enseña a no mirarla.**

*Ficha:* parqueadero · *(mío)* · 🟡 Medio · P15, P5 · parqueadero-0.7.2 · 2026-10-14

**43 · Al final del día, la impresora sacó de largo los recibos de salida que nadie había pedido.**

*Qué pasó.* El 19 oct 2026 el cliente le contó al dueño que, después de un día de trabajo, cobró las salidas sin imprimir su recibo y la impresora los imprimió todos seguidos.

*Síntoma literal.* «Luego de un día de trabajo, al cobrar todas las entradas y no imprimir el recibo de salida, la impresora imprimió de largo todos esos recibos de salida que no se necesitaban» (el cliente, por el dueño).

*Causa raíz.* Tres cosas; las dos primeras, mías.
- **La caja manda siempre el de salida.** Con «Siempre, al registrar» lo imprime al abrir el recibo; con «Si no lo recibe por WhatsApp o QR», al volver si no hubo digital. No había forma de no imprimir el de salida, que el cliente no necesita.
- **Lo dado por perdido seguía en camino.** La cola deja de esperar a los 45 s y lo anota como pendiente, pero el adaptador seguía con su envío: el puerto serie guardaba los bytes por mandar y Bluetooth seguía con los trozos. Cuando la impresora volvía, salía lo que la caja ya había dado por no salido. Una prueba con una impresora falsa que se duerme a mitad del recibo lo muestra.
- **Lo que la impresora ya recibió.** *Inferencia*, sin medir con la PT-210 del cliente: sin papel, con la tapa abierta o dormida, la impresora puede guardar en su memoria lo que le llega e imprimirlo todo al volver. La caja escribe sin respuesta y no lo puede saber, ni retirarlo. Hay que preguntarle al cliente si se le acabó el papel o la apagó durante el día.

*Cómo se reprodujo.* La segunda, en `cortar.test.ts`: por el puerto serie y por Bluetooth, con el segundo trozo esperando a la impresora. La primera, leyendo `Recibo.tsx`. La tercera, sin reproducir: no hay cómo con la PT-210 falsa.

*Arreglo.* Ajustes › «¿Y el recibo de salida?» → «En papel solo si lo pide»: el de salida sale solo con «Imprimir»; el de entrada no cambia (Ley 1480 art. 18). La cola le pide al adaptador que corte el trabajo al vencer el tiempo (`cancelar`), con un número por trabajo para que uno nuevo no reactive el cortado. Sale en la `0.8.0`.

**Lo prueban** `cortar.test.ts` (la cola corta; por el puerto serie y por Bluetooth no sale el resto; ❌ sin cortar habría salido), `registro.test.ts` (`papelDelRecibo`) y la e2e HU-Q13.7: con la salida a pedido, la entrada sale en papel y la salida no manda un byte. Falta la PT-210 del cliente sin papel: va a la matriz de validación.

La regla: **lo que la caja da por perdido tiene que estar perdido de verdad; y lo que nadie pidió no se imprime.**

*Ficha:* parqueadero · *(mío y del terreno)* · 🔴 Alto · P1, P15, P17 · parqueadero-0.8.0 · 2026-10-19

**44 · El teléfono del parqueadero no pudo subir a la nube: otra caja, vacía, ya tenía su lugar.**

*Qué pasó.* El 27 oct 2026 el dueño sumó un segundo teléfono al parqueadero del primer cliente. No bajaron los ajustes ni las entradas de la serie A. En el primer teléfono, «Cuenta y nube» seguía ofreciendo «Subir este parqueadero», y al tocarlo la nube lo rechazaba.

*Síntoma literal.* «Al registrar una nueva caja con la misma cuenta en otro celular no se ven las entradas con numeración A. Adicionalmente […] no toma los valores de la configuración del parqueadero ya configurados en el primer celular» (el dueño). En el primero: «Este parqueadero ya tiene cajas en la nube. Una caja con recibos propios no se suma a él […]».

*Causa raíz.* Consultado en la base de producción, solo lectura y con permiso del dueño: el parqueadero tenía **una caja, la serie A, sin un solo registro ni ajuste en la nube**. Su id nació el 19 oct a las 23:03, 14 s después de aceptar los términos, y la caja entró el 20 oct a las 14:09, al quedar pagado el plan. El teléfono que hoy tiene el parqueadero tiene otro id: la nube no lo reconoce como suyo y, por la regla de HU-Q7.6, una caja con recibos propios no entra donde ya hay cajas. *Inferencia*, sin poder ver ese teléfono: la caja de la nube es otro almacenamiento (otro navegador o un teléfono que se configuró ese día), que entró y nunca subió nada. La regla era mía: miraba si había cajas, no si alguna tenía algo arriba.

*Cómo se reprodujo.* En `dispositivos.test.ts`, con una caja de hace 7 días sin nada arriba: reclamar respondía `con-cajas`.

*Arreglo.* `reclamar` deja entrar a la caja que trae la sede cuando el parqueadero no tiene registros ni ajustes en la nube y sus cajas entraron hace más de una hora: las borra (no tienen nada) y la caja entra con su serie y sus números. La hora le da a una caja recién reclamada tiempo de subir lo suyo. Lo que la reemplazada suba con su serie va a cuarentena, porque la base exige que la serie sea de la caja que hizo el recibo. Sale en la `0.9.2`.

**Lo prueban** `dispositivos.test.ts`: la caja vacía de hace días no cierra el paso y lo de ella va a cuarentena; ❌ la de media hora, la que subió algo y la que no trae sede sí lo cierran.

La regla: **una caja que no subió nada no tiene números que defender; no le cierra el paso a la que sí los tiene.**

*Confirmado en producción.* «Ahora sí funcionó bien: subí a la nube la primera caja, los registros se fueron subiendo rápido, y la otra caja inmediatamente ya los veía, se configuró automáticamente y pudo registrar con otra numeración» (el dueño, 27 oct 2026).

*Ficha:* parqueadero · *(mío)* · 🔴 Alto · P1, P21 · parqueadero-0.9.2 · 2026-10-27
