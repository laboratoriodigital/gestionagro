# Bitácora de fallos — CORE de la plataforma ED1 (bitácora core)

Todo lo que se rompió en el CORE, quién lo rompió, por qué pasó y cómo se arregló. Sirve para tres cosas:

- que un fallo no vuelva por el mismo camino;
- que quien llegue después vea que las decisiones raras del CORE tienen una cicatriz detrás;
- que, al unir las bitácoras del ecosistema, esta sea la parte de lo que **comparten** los productos: identidad, organizaciones, planes, cobros, tokens y la cuenta.

Esta bitácora nace con dos bitácoras de ventaja: la del ecommerce (`../tienda/BITACORA-ecommerce.md`, 113 entradas) y la del agro (`../BITACORA.md`, 29 entradas), que construyó el CORE v0. El CORE es lo único que todos los productos usan a la vez, así que aquí un fallo no se queda en un producto. El éxito de esta bitácora se mide por los patrones heredados que **no** reaparecen.

**Severidad** = qué tan caro sale, no qué tan difícil fue arreglarlo.

| | |
|---|---|
| 🔴 **Crítico** | Un producto ve o toca datos de otro; se filtra un token, una llave o un dato personal; se cobra mal, o se activa un plan sin pago; **nadie puede entrar** a ningún producto. Casi siempre silencioso |
| 🟠 **Grave** | Bloquea la entrada, el cobro, el despliegue o una celda, pero se ve |
| 🟡 **Medio** | Cuesta tiempo, confunde, o deja una prueba mintiendo |
| ⚪ **Menor** | Cosmético, redacción, números desactualizados |

---

## Cómo se une con las otras bitácoras (segundo cerebro de ED1)

Las convenciones son las de la bitácora agro, para que unir las bitácoras sea concatenarlas y no migrarlas:

1. **Los patrones son del ecosistema, no del proyecto.**
   - P1–P21 conservan **el mismo número y la misma regla** en todas las bitácoras. Aquí no se renumeran ni se reescriben; se añaden entradas que los confirman.
   - Un patrón nuevo que nace aquí recibe un id **provisional** `PC<n>` («patrón core»), como `PA<n>` en el agro. Pasa a un número global `P<n>` cuando exista el archivo común `CONOCIMIENTO.md`. Así, dos proyectos no abren el mismo P22 en paralelo.
2. **Las entradas se citan con su proyecto:** «bitácora core 1», «bitácora agro 25», «bitácora ecommerce 111». El número nunca cambia.
3. **La ficha es la misma línea en todas**, para extraerla con una expresión regular. El proyecto va al principio y la versión es la del CORE (`core-X.Y.Z`):

```
*Ficha:* core · *(mío)* · 🟠 Grave · P10, P13 · core-0.3.0 · 2026-11-20
```

4. **Un cambio de rumbo o una lección que ya está en otra bitácora no se copia** (P2): se cita. Las decisiones del diseño del CORE hasta el 5 oct 2026 están en la bitácora agro, «Cambios de rumbo» (filas de ADR-22, ADR-23, ADR-26 y ADR-27).

Cuando exista `CONOCIMIENTO.md`, llevará la tabla global de patrones, las entradas por patrón de todos los proyectos y la guardia que lo impide en cada uno.

---

## Lo aprendido

Lista viva de patrones.

- **En el CORE** dice cómo toma forma el patrón aquí.
- **Lo impedirá** es la guardia prevista, con la historia de `BACKLOG_CORE.md` que la construye.
- **Lo impide hoy** se escribe solo cuando esa guardia existe, falla en rojo con el defecto puesto y se comprobó al escribirlo.
- **Entradas** son los números de esta bitácora que lo confirman.

Al 5 oct 2026 el CORE v0 tiene las guardias que heredó del agro (pruebas del CORE, guardias de repositorio y flujos). Ninguna historia de este backlog está construida, así que ningún patrón tiene todavía «Lo impide hoy» propio del CORE.

### Heredados del ecosistema

#### P1 · El fallo que funciona es el caro
- **Regla:** lo que cae a un respaldo, a un valor de fábrica o a un «no pasa nada» tiene que gritar.
- **En el CORE:** un token sin `plan` vale como `gratuito`, nunca como el pagado. Si el CORE no responde, la celda conserva el plan anterior y avisa: el plan nunca baja «por si acaso». Un correo que no se pudo enviar no se cuenta como enviado. Un catálogo de API vacío no se publica.
- **Lo impedirá:** HU-C4.1, HU-C5.6, HU-C10.1, HU-C8.4.
- **Entradas:** —

#### P2 · Dos copias del mismo procedimiento: una siempre se queda atrás
- **Regla:** una sola fuente, y lo demás se deriva de ella. Si no se puede, una aserción ata las dos copias.
- **En el CORE:** `productos.json` → tablas de referencia; `planes.json` → página de precios y `plan_precio`; `celdas.json` → configuraciones y tabla `celda`; los orígenes de cada producto → CORS; los tokens de diseño → todas las apps.
- **Lo impedirá:** HU-C1.1, HU-C1.2, HU-C2.3, HU-C3.5, HU-C6.1.
- **Entradas:** core 1.

#### P3 · Windows
- **Regla:** lo que corre en la máquina del operador corre en Windows, y una prueba en Linux no lo ve.
- **En el CORE:** los scripts de despliegue y de versiones corren también en Windows. Al revés: las capturas visuales del sistema de diseño se toman solo en Linux, porque Windows dibuja las fuentes distinto.
- **Lo impedirá:** el trabajo `scripts-windows` que ya existe; HU-C6.4.
- **Entradas:** —

#### P4 · Una prueba que solo sabe ver la primera tienda no prueba el producto
- **Regla:** ninguna prueba nombra a un cliente real; se prueba con uno de prueba y, además, con OTRO.
- **En el CORE:** el «otro» es **otro producto**. Toda historia se prueba con el agro y con el producto de ensayo, que existe solo en D1 local y en staging. También al revés: probar la base que ya existe (la de producción, con los datos del v0), no solo la recién creada.
- **Lo impedirá:** HU-C3.7; la Definición de Terminado (`BACKLOG_CORE.md` §3.2, punto 4); la compatibilidad v0 de HU-C2.2.
- **Entradas:** —

#### P5 · Una comprobación que da lo mismo con el defecto y sin él no comprueba nada
- **Regla:** antes de dar una comprobación, preguntar qué respondería sin el cambio. Toda aserción nueva se ve en rojo con su defecto puesto.
- **En el CORE:** cada cruce imposible entre productos tiene su caso que la base rechaza; cada guardia del CI (commits, CSP, presupuestos) se ve atrapar su defecto.
- **Lo impedirá:** la plantilla de PR; HU-C0.2; la matriz de HU-C2.2.
- **Entradas:** —

#### P6 · Lo que se escribe para los que vienen después deja fuera al primero
- **Regla:** el cliente cero también es un cliente.
- **En el CORE:** el primer producto es el agro, y la dimensión de producto se escribe pensando en la Tienda. El agro pasa por el mismo `productos.json`, la misma asignación y los mismos tokens: nada de «el agro es el caso por defecto» escrito en el código, salvo durante la transición declarada.
- **Lo impedirá:** HU-C1.1 (el agro en el archivo), HU-C3.8 (contraer los `DEFAULT 'agro'`).
- **Entradas:** —

#### P7 · Una caché convierte un chequeo en un recuerdo
- **Regla:** un instrumento lee la fuente, no la caché; una caché guarda respuestas, no fracasos.
- **En el CORE:** las celdas guardan la llave pública del CORE. Un `kid` desconocido se vuelve a pedir; no se guarda «no encontré la llave». Los kill switches tienen 60 s de caché, y así se documenta. El plan de cada organización en la celda es una copia, y dice desde cuándo.
- **Lo impedirá:** HU-C3.6, HU-C4.2, HU-C5.6.
- **Entradas:** —

#### P8 · El reloj es una entrada que nadie declara
- **Regla:** fecha, hora y huso se mueven en la prueba que dice cubrir el reloj.
- **En el CORE:** meses calendario en Bogotá (12 meses no son 360 días), 29 de febrero, 18:59/19:01, días hábiles con festivos para los plazos de la Ley 1581, `exp` y `auth_time` de los tokens, y 12 h entre N+1 y N+2.
- **Lo impedirá:** HU-C5.1, HU-C5.5, HU-C7.7.
- **Entradas:** —

#### P9 · Reproducir antes de diagnosticar
- **Regla:** ningún diagnóstico se da por bueno sin reproducir el fallo.
- **En el CORE:** los fallos de entrada se reproducen con la solicitud exacta de la app publicada; los de base, en D1 local con `getPlatformProxy`.
- **Lo impedirá:** las pruebas de contrato de HU-C3.1 y HU-C4.1.
- **Entradas:** —

#### P10 · El que se actualiza a sí mismo corre su versión vieja
- **Regla:** un arreglo en el que se actualiza llega una versión tarde. Y quien vuelve atrás corre también la vieja.
- **En el CORE:** **el riesgo número uno del proyecto.** Hay cuadernos instalados con la URL de workers.dev, el emisor `agro-core` y solicitudes sin `producto`. Todo contrato se expande, se migra y se contrae, con un congelamiento en diciembre.
- **Lo impedirá:** las tres fases de HU-C4.1, HU-C4.3 y HU-C4.5; HU-C4.6 (workers.dev sigue viva); la lista de lo que no se renombra nunca (PLATAFORMA §6.1).
- **Entradas:** —

#### P11 · Lo que depende de SER la semilla no puede decidir si una tienda publica
- **Regla:** una compuerta solo mira invariantes que valen para cualquier cliente.
- **En el CORE:** la prueba de humo de producción no depende del producto de ensayo ni de una finca real: comprueba que el de ensayo **no** exista.
- **Lo impedirá:** HU-C3.7.
- **Entradas:** —

#### P12 · El permiso que se comprueba es el que se usa
- **Regla:** un token se prueba antes de sembrarlo y con la acción que va a hacer; ninguno opcional va en el camino crítico.
- **En el CORE:** con una sola cuenta para todo, el aislamiento entre productos descansa en credenciales por propósito (R6): despliegue, métricas y Cloudflare for SaaS, cada una con lo mínimo. Es la causa 4 de la Tienda 2.0: cuatro permisos que se pisan.
- **Lo impedirá:** HU-C11.5; `CELDA_SERVICE_TOKEN` comparado en tiempo constante (HU-C5.6).
- **Entradas:** —

#### P13 · Un secreto no viaja por donde queda escrito
- **Regla:** llaves y tokens solo en los almacenes de secretos, nunca en una dirección, un pantallazo o un documento. Lo mismo, los datos de las personas.
- **En el CORE:** códigos de invitación, enlaces mágicos y solicitudes de autorización van en el fragmento; tokens en el encabezado o en el cuerpo; en la base, solo la huella del enlace; `cuentas.json` sin identificadores de cuenta; JWKS sin la parte privada.
- **Lo impedirá:** HU-C1.3, HU-C4.2, HU-C9.4, HU-C10.2.
- **Entradas:** —

#### P14 · Los fallos silenciosos del lenguaje y del shell
- **Regla:** `| tee` sin `pipefail`, un `try/catch` que protege, dos funciones con el mismo nombre: no fallan, siguen.
- **En el CORE:** el validador de commits y los scripts de versión llevan su estado de salida; ningún `catch` amplio adivina la causa de un error de entrada (bitácora agro 23).
- **Lo impedirá:** las guardias de flujos que ya existen; HU-C0.2.
- **Entradas:** core 4.

#### P15 · Un aviso tiene que llegar a donde alguien mira, y nombrar la causa
- **Regla:** el aviso va donde está la persona, dice qué pasó y qué hacer.
- **En el CORE:** un token rechazado dice «vuelve a entrar», no «401»; una creación sin celda dice que todavía no hay dónde alojar el espacio; el vigía en modo pago dice cuánto y por qué; el aviso de un formulario queda junto a la acción.
- **Lo impedirá:** HU-C4.5, HU-C3.3, HU-C11.1, HU-C6.3.
- **Entradas:** —

#### P16 · Un flujo que nunca ha corrido de verdad no está probado
- **Regla:** se corre de punta a punta antes de llamarlo camino normal.
- **En el CORE:** la 0006 en staging antes que en producción; la publicación con `core-vX.Y.Z`; un pago real de 6 meses en pruebas; un cliente MCP real; un enlace mágico a un correo que no es de Google; el simulacro de restauración.
- **Lo impedirá:** HU-C2.2, HU-C0.3, HU-C5.3, HU-C9.7, HU-C10.2, HU-C11.4.
- **Entradas:** —

#### P17 · El instrumento también miente
- **Regla:** un doble que simplifica una propiedad que el código real promete miente el día que alguien depende de ella.
- **En el CORE:** la receta de reconstrucción se probó en `node:sqlite`, no en D1. El D1 local no reproduce la cuota diaria ni el límite de consultas por invocación. Un proveedor OAuth con un doble que no rota de verdad el refresh no prueba la detección de reuso.
- **Lo impedirá:** HU-C9.1.
- **Lo impide hoy:** la receta de reconstrucción corre en el D1 local de workerd, no solo en `node:sqlite` (`packages/d1/src/receta.test.ts`, HU-C2.1).
- **Entradas:** core 2.

#### P18 · Un documento no lanza una excepción cuando miente
- **Regla:** lo que un documento afirma del código lo ata una aserción; el redundante se borra.
- **En el CORE:** PLATAFORMA propone y ARQUITECTURA decide. Cada pieza pasa a ARQUITECTURA con su ADR en el PR que la implementa. Un documento que cita a otro dice lo que el otro dice.
- **Lo impedirá:** HU-C0.2 (la convención con su guardia); la Definición de Terminado, punto 8.
- **Entradas:** core 1.

#### P19 · Un rojo que no significa nada enseña a no mirar los rojos
- **Regla:** una guarda con falsos positivos o un intermitente se arregla o se quita.
- **En el CORE:** el validador de commits mira solo el rango del PR, no la historia; las capturas visuales solo en Linux; las pruebas de tiempo, solas.
- **Lo impedirá:** HU-C6.4, HU-C6.6.
- **Lo impide hoy:** la guardia de commits reconoce solo la forma real de la marca, y `tests/repo/commits.test.ts` lleva como caso el cuerpo que la primera versión marcó por error (bitácora core 3).
- **Entradas:** core 3.

#### P20 · Lo que se le ofrece a alguien tiene que llegar por el camino que esa persona recorre
- **Regla:** se prueba desde quien mira.
- **En el CORE:** la persona que entra desde el teléfono a 360 px, con sol; el comerciante sin cuenta de Google; el agente que no ejecuta JavaScript; el verificador de tokens que no es nuestro.
- **Lo impedirá:** EC6 y EC7 (360 px, claro y oscuro), HU-C10.2, EC8, HU-C4.2.
- **Entradas:** —

#### P21 · Lo que borra antes de escribir convierte un fallo en una pérdida
- **Regla:** escribir primero, verificar, borrar después.
- **En el CORE:** un producto o un plan que sale del archivo queda `retirado`, nunca se borra; reconstruir una tabla es crear la nueva, copiar y verificar antes de borrar la vieja; una supresión de datos se radica y se responde, no se ejecuta sola.
- **Lo impedirá:** HU-C2.3, la receta de HU-C2.1, HU-C7.7.
- **Entradas:** —

### Nuevos (provisionales)

#### PC1 · Lo que va a crecer es dato, no una restricción
- **Regla:** un conjunto que va a crecer (productos, roles, planes, periodos, proveedores, estados) va en una tabla de referencia con clave foránea, no en un `CHECK`. Solo lo cerrado de verdad (sí/no) es `CHECK`.
- **Por qué:** en SQLite, cambiar un `CHECK` obliga a rehacer la tabla. El 5 oct 2026 el periodo de 6 meses llegó horas después de un diseño con `CHECK (meses IN (1, 3, 12))`: habría obligado a rehacer `plan_precio` y `pago` (bitácora agro, «Cambios de rumbo», fila de ADR-22). Es la regla R1 de PLATAFORMA §2.
- **Lo impedirá:** la revisión de cada migración (Definición de Listo, punto 4) y HU-C2.2.
- **Entradas:** —

#### PC2 · Un arreglo que pone un contador en cero también esconde lo que contaba
- **Regla:** cuando el arreglo conocido de un error es apagar una verificación, se agrega otra verificación que falle si había algo real que contar.
- **Por qué:** rehacer una tabla padre en D1 falla al confirmar. El arreglo habitual (apagar `defer_foreign_keys` antes de confirmar) pone en cero el contador de violaciones diferidas, y con eso deja pasar callada una fila huérfana real (casos W1–W4 de PLATAFORMA §4.4, [HA8]). La guarda de huérfanas es la verificación que faltaba.
- **Lo impedirá:** la receta R5 en cada migración que rehace una tabla (HU-C2.2).
- **Lo impide hoy:** `packages/d1/src/receta.test.ts` corre W2 y W4 en el D1 local de workerd. Sin la guarda, W4 confirma con la huérfana y la prueba se ve en rojo (comprobado el 5 oct 2026).
- **Entradas:** core 2.

---

## Herencia: lo que otras bitácoras ya pagaron y le toca al CORE

No se copian las entradas (P2): se citan, con la historia de `BACKLOG_CORE.md` que hereda su regla.

| Bitácora | Qué enseñó | Dónde lo hereda el CORE |
|---|---|---|
| agro 4 | Abrir cuentas gratuitas para ganar cuota choca con los términos de Cloudflare | Una sola cuenta con Workers Paid (ADR-23); HU-C11.1 |
| agro 5 | Una regla «antes de X, haz Y» sin guardia se incumple el día que X llega con prisa | HU-C0.2: la convención de commits nace con su guardia |
| agro 11 | El primer despliegue también prueba el resumen: la falla se nombra sin abrir el registro | HU-C0.3 (publicación del CORE) |
| agro 19 | Un dominio puesto a mano en el panel, en el Worker equivocado, parece un error del código | HU-C4.6: `cuenta.laboratorio-digital.com` generado, con su prueba |
| agro 25 | Una cuenta en dos fincas recibía un token sin finca y la app se creía vinculada | HU-C4.4: el refresh pide la organización |
| agro 29 | Una decisión de producto se valida contra el documento que la decide | Definición de Listo, punto 5 (respaldo de cada historia) |
| agro, «Afirmaciones falsas» 4 | Describí lo que creía que hacía una prueba sin releerla | Toda afirmación sobre una prueba se escribe con la prueba abierta |
| agro, terreno | Un refresh token que rota no se puede copiar | Sesión por producto (HU-C3.1, HU-C4.4) |
| agro, terreno | Un filtro de rama no es un filtro de origen (`workflow_run`) | HU-C0.2 y HU-C0.3 no agregan disparadores sin la guardia de origen |
| agro, terreno | Una versión creada con el token de Actions no dispara otros flujos | HU-C0.3: tag y despliegue del CORE en la misma corrida |
| agro, terreno | La CSP ignora en silencio un `<style>` en línea | Sistema de diseño (BACKLOG_CORE §4.1) y HU-C6.6 |
| agro, terreno | Un aviso fuera de la vista es un botón que no hace nada | Componente «Aviso» (HU-C6.3) |
| agro, terreno | «Cargando» y «vacío» son estados distintos (agro 17) | Componente «Estado» (HU-C6.3) |
| agro, terreno | Heredar una solución es heredar también su contexto (Bold desde Apps Script) | Antes de copiar algo de la Tienda 2.0 al CORE, se busca el límite que lo obligó |
| agro, terreno | D1 cuenta cada índice como fila escrita; 50 consultas por invocación; la cuota se reinicia a las 19:00 de Colombia | Cada índice nuevo con su costo (Definición de Listo, punto 6) |
| ecommerce, causa 4 de la Tienda 2.0 | Cuatro permisos que se pisan | R6 y HU-C11.5 |
| ecommerce, Críticos | La llave de pago estaba en el repositorio; un token salió en un pantallazo | P13; las llaves de Bold solo en los ambientes de GitHub y en el Worker |
| ecommerce, patrón 8 | Los meses se restan con `getMonth()`, no con días | HU-C5.1 |

---

## Cómo escribir una entrada

Igual que en las otras bitácoras, para que se lean y se extraigan igual:

| Campo | Qué lleva | Cómo se reconoce |
|---|---|---|
| Número y título | El siguiente número libre y el síntoma o la lección en una frase | `**N · Título.**` al empezar el párrafo |
| Qué pasó | Cuándo, en qué producto, celda, ruta o flujo, qué se estaba haciendo | Primeras frases |
| Síntoma literal | El mensaje tal cual salió | Entre «…» o en un bloque de código |
| Causa raíz | Por qué pasó, no solo dónde | Prosa |
| Cómo se reprodujo | D1 local, staging, la solicitud exacta de la app… o «sin reproducir», dicho | Prosa |
| Arreglo | Qué cambió, y por qué así | Prosa |
| Qué lo prueba | Prueba y aserciones, con su control negativo | `**Lo prueba(n)**` |
| La regla | La lección que sirve fuera de este caso | `La regla:` en negrita |
| Ficha | Proyecto, autoría, severidad, patrones, versión y fecha | Última línea |

- **Autoría:** *(mío)*, lo rompió o lo afirmó el asistente; *(tuyo)*, el dueño; *(compartido)*; *(del terreno)*, la plataforma o un proveedor.
- **Versión:** la del CORE que trae el arreglo (`core-X.Y.Z`). Antes de la versión propia del CORE (HU-C0.3), la de la raíz.

Cuatro reglas que no se rompen:

1. Una entrada nueva va al final, con el siguiente número. No se renumera.
2. Lo escrito no se reescribe. Se añade *(Hoy: …)* o *(Después: bitácora core N)*.
3. Se cita el síntoma, no la interpretación.
4. Sin control negativo no hay «lo prueba».

---

## Afirmaciones mías que resultaron falsas

Van aparte porque no son fallos de código: son cosas que dije con seguridad y no eran ciertas.

*(Ninguna todavía.)*

---

## Cambios de rumbo

No son errores. Son decisiones que cambiaron con información nueva. Las anteriores al 5 oct 2026 que tocan al CORE están en la bitácora agro.

| De | A | Por qué |
|---|---|---|
| Commits con `Co-Authored-By: Claude…` y `Claude-Session:` en el cuerpo | `tipo(alcance): descripción`, sin la marca de Claude Code en commits ni en PR (5 oct 2026) | Decisión del dueño al abrir el proyecto del CORE. La vigila HU-C0.2 |
| Una sola versión del producto en la raíz (ARQUITECTURA §7.1) | El CORE con su propia versión y etiquetas `core-vX.Y.Z` (HU-C0.3) | PLATAFORMA §6.3: con dos productos y un CORE, publicar uno no puede obligar a publicar los demás |
| La copia fuera de Cloudflare en Google Cloud Storage o Backblaze B2 (`proveedores-de-computo.md` §4) | En el Google Drive del dueño, semanal y cifrada (ADR-30, 5 oct 2026) | Decisión del dueño (D-C5): 15 GB gratis, y el mismo camino que ya eligió para el respaldo del agro por etapas. Lo que cambia: la cuota es de una cuenta personal, así que el vigía mide lo que Drive tiene, no lo que creemos haber subido (P7) |
| Los tres dominios con un registrador y un correo de recuperación fuera de Cloudflare (PLATAFORMA §3.5 regla 5) | Los tres registrados en Cloudflare, como ya estaban (5 oct 2026) | No fue una decisión nueva: al preguntar, el dueño dijo que todos están en Cloudflare. Queda como riesgo aceptado, mitigado con el segundo factor y los contactos de la cuenta, y se vuelve a presentar en HU-C11.5 |
| Una rama y un PR por historia (`entrega-por-partes`, bitácora agro) | Una rama y un PR por sprint, con un commit por historia (5 oct 2026) | El repositorio volvió a privado: cada PR gasta dos corridas completas del CI, unos 12 minutos de 2.000 al mes. El dueño pidió máxima eficiencia y valida por sprint en la revisión del viernes. Lo que urge va en su propia rama |
| La hoja de ruta P0–P6 sin interfaz propia del CORE (PLATAFORMA §7) | Con un sistema de diseño (EC6) y la cuenta en `cuenta.laboratorio-digital.com` (EC7) desde el primer sprint | Pedido del dueño: frontend bonito, minimalista y moderno desde el inicio; ED1 §16 ya preveía la cuenta |

---

## Lo que el terreno enseñó, y no fue culpa de nadie

- **El cuello de botella del agro no fue construir, fue validar.** Del 30 sep al 5 oct 2026 hubo 217 commits, y 57 de las 81 historias quedaron «En sprint», casi todas esperando la prueba del dueño. Planear por puntos de construcción habría prometido fechas que la validación no puede cumplir. Por eso el CORE cuenta la velocidad por lo validado y limita a 4 las historias en espera (`BACKLOG_CORE.md` §2.6).
- **Dos sesiones en la misma carpeta comparten la rama.** El 5 oct 2026, al crear `feat/c1-sprint` en `D:CoWorkgestionagro`, aparecieron `apps/core/src/drive.ts` y un cambio en `worker.ts` que no eran del CORE: otra sesión trabajaba ahí en el respaldo del agro en Drive. `git switch` se lleva los cambios sin confirmar a la rama nueva, así que esa sesión habría terminado haciendo commit en la rama del CORE. Nada se mezcló, porque el commit solo llevaba `docs/`: la carpeta volvió a `main` con sus cambios intactos, y el CORE se trabaja desde entonces en una copia aparte (`git worktree add ../gestionagro-core`), con su propio `node_modules` (pnpm lo arma en 9 s desde su almacén). Antes de cambiar de rama, se mira `git status`: lo que no es tuyo no se lleva.
- **Un trabajo de Actions en cola que nunca arranca puede ser GitHub.** El 5 oct 2026 los trabajos del PR #92 (`ci` y `scripts-windows`) quedaron en cola sin hora de inicio. No era el código ni los minutos (cuando faltan minutos, el trabajo falla en segundos con el mensaje de facturación: bitácora agro 5): githubstatus.com tenía un incidente abierto en Actions desde las 19:11 UTC. Antes de cancelar, relanzar o cambiar algo, se mira el estado de GitHub (`https://www.githubstatus.com/api/v2/incidents/unresolved.json`) y si el trabajo tiene `started_at`.
- **Una referencia se abre antes de copiarla.** El enlace de diseño `codapress.co.uk/x` lleva a la página 404 del sitio. Lo que el dueño señalaba era esa página, la tipografía y la trama, y la portada confirmó el resto. Se tomó lo de las dos.

---

## Entradas numeradas

**1 · Dos documentos piden la copia fuera de Cloudflare con frecuencias distintas, y uno cita al otro diciendo lo contrario.**

*Qué pasó.* El 5 oct 2026, al escribir HU-C11.4 (copia fuera de Cloudflare) del plan del CORE, contrasté la historia con sus tres fuentes.

*Síntoma literal.*
- `PLATAFORMA.md` §3.5, regla 6: «**Plan de salida:** exportaciones semanales fuera de Cloudflare (`proveedores-de-computo.md` §4)». Lo mismo en §3.1 y en la tabla de riesgos de §8.
- `proveedores-de-computo.md`, el documento que esa regla cita: «para el respaldo mensual cifrado».
- ED1 §20.3: «un respaldo semanal exportando D1 a R2» (dentro de Cloudflare) y «una copia mensual, ya cifrada, fuera de Cloudflare».

*Causa raíz (probable, porque no se puede reproducir cómo se escribió).* PLATAFORMA la escribió el asistente. Lo más probable es que, al juntar las decisiones de la tarde en la versión 0.2, se mezclaran las dos copias de ED1 §20.3: la semanal, que va a R2, y la mensual, que es la de afuera. Lo que sí es seguro: la cita a `proveedores-de-computo.md` le daba autoridad a una frecuencia que ese documento no dice, y ninguna prueba ata un documento a lo que dice otro (P18).

*Cómo se reprodujo.* Buscando «semanal» y «mensual» en los tres documentos.

*Arreglo.*
- PLATAFORMA §3.1, §3.5 y §8 dicen ahora lo mismo que ED1: semanal a R2 y mensual cifrada fuera de Cloudflare.
- La frecuencia final queda como decisión del dueño (D-C5 de `BACKLOG_CORE.md` §9), con la de ED1 como recomendación, porque ED1 manda sobre PLATAFORMA (`docs/README.md`, orden de precedencia). *(Hoy: el dueño decidió el mismo día una copia semanal y cifrada en su Google Drive, ADR-30.)*
- Cuando HU-C11.4 la construya, la frecuencia vivirá en un solo archivo de configuración, y una prueba atará el runbook a ese archivo.

**Lo prueba:** nada todavía; es un documento. La guardia llega con HU-C11.4.

La regla: **cuando un documento cita a otro como fuente de una cifra, la cifra se copia con el otro abierto. Una cita que no dice lo que el citado dice es peor que ninguna, porque parece verificada.**

*Ficha:* core · *(mío)* · 🟡 Medio · P18, P2 · 0.3.0 · 2026-10-05

**2 · La guarda de huérfanas revisa toda la base, no solo la tabla que se rehace.**

*Qué pasó.* El 5 oct 2026, en HU-C2.1, corrí por primera vez en el D1 local de workerd los cinco casos de la receta de PLATAFORMA §4.4, que solo se habían probado con `node:sqlite`. Corrían uno tras otro sobre la misma base. W3 (la guarda, sin pérdida de datos) tenía que confirmar, y no confirmó.

*Síntoma literal:*

```text
{"caso":"W3","confirmo":false,"error":"D1_ERROR: CHECK constraint failed: huerfanas = 0: SQLITE_CONSTRAINT (extended: SQLITE_CONSTRAINT_CHECK)", …}
```

*Causa raíz.* La guarda cuenta `SELECT COUNT(*) FROM pragma_foreign_key_check`, sin filtrar por tabla: revisa **toda** la base. W2, que corrió antes, había dejado a propósito una huérfana real en `h_W2`, y esa fila hizo fallar la migración de W3, que no perdía nada. D1 no tenía nada que ver: se comporta igual que `node:sqlite` en los cinco casos y acepta la función de tabla. Lo que no estaba escrito era el alcance de la guarda. En `node:sqlite` no se vio porque cada caso corría en su propia base.

*Cómo se reprodujo.* Una prueba conserva la huérfana de W2 y corre W3 después: falla. Al borrar las tablas de W2, W3 confirma.

*Arreglo.*
- Cada caso de la prueba limpia sus tablas al terminar, y un caso aparte demuestra la propiedad.
- Se decidió **no** filtrar la guarda por tabla: una huérfana vieja en producción es un dato roto, y detenerse es lo correcto (P1). La consecuencia se escribió donde se aplica: antes de migrar una base con la guarda, `PRAGMA foreign_key_check` tiene que salir vacío, y el despliegue lo comprobará (HU-C2.2, CA4b; PLATAFORMA §4.4).

**Lo prueba** `packages/d1/src/receta.test.ts`, «la guarda revisa TODA la base». Control negativo: sin la guarda, W4 y ese caso se ven en rojo.

La regla: **una verificación global falla por cosas que no hizo quien la corre. Antes de confiar en ella en producción, se mira qué hay ya en la base; si no, la primera migración sana que llegue cargará con un fallo ajeno.**

*Ficha:* core · *(del terreno)* · 🟡 Medio · PC2, P17, P1 · 0.3.0 · 2026-10-05

**3 · La guardia de commits marcó el commit que la creaba, porque el mensaje describía la regla.**

*Qué pasó.* El 5 oct 2026, antes de abrir el PR del sprint C1, corrí la guardia de HU-C0.2 sobre los commits de la rama. Marcó el commit 4ee3d35, el que crea la guardia.

*Síntoma literal:*

```text
- commit 4ee3d35 «ci(commits): guardia de la convención de commits y del PR»: lleva la marca de Claude Code (Co-Authored-By: Claude)
- commit 4ee3d35 «ci(commits): guardia de la convención de commits y del PR»: lleva la marca de Claude Code («Generated with Claude Code»)
```

*Causa raíz.* El cuerpo del commit explicaba la regla: «sin
Co-Authored-By: Claude, Claude-Session ni «Generated with Claude Code»». Los patrones buscaban las palabras, no la forma de la marca. Y el corte de línea dejó una línea que empezaba igual que el trailer. Las pruebas de la guardia traían la marca real y textos inocentes, pero no un texto que **hablara** de la marca, que es justo lo que escribe quien documenta la regla.

*Cómo se reprodujo.* `COMMITS_DESDE=origin/main node scripts/verificar-commits.ts` en la rama.

*Arreglo.* La guardia reconoce solo las formas reales: el trailer `Co-Authored-By: Claude … <correo>` al principio de línea, `Claude-Session:` seguido de una dirección, y el enlace `Generated with [Claude Code](https://…)`. No hubo que reescribir la historia de la rama: con la guardia corregida, el commit pasa.

**Lo prueba** `tests/repo/commits.test.ts`, «no confunde un texto que DESCRIBE la regla con la marca», con el cuerpo real de 4ee3d35. Control negativo: el commit 9ce2e03 del PR #90, que sí lleva la marca, sigue saliendo con sus tres fallas.

La regla: **una guardia de texto se prueba también contra el texto de quien explica la regla. Lo que se busca es la forma de la cosa, no las palabras que la nombran.**

*Ficha:* core · *(mío)* · 🟡 Medio · P19, P5 · 0.3.0 · 2026-10-05

**4 · Un commit salió con el lint en rojo porque el comando revisaba la salida de `tail`: la bitácora agro 13, otra vez.**

*Qué pasó.* El 5 oct 2026, al cerrar HU-C3.6, corrí `pnpm run lint 2>&1 | tail -1 && git add -A && git commit …`. El lint falló (`noShadow` en una prueba y en el Worker) y el commit se hizo igual. Lo vi porque la última línea decía `[ELIFECYCLE] Command failed with exit code 1.` justo antes del hash del commit nuevo.

*Causa raíz.* Sin `pipefail`, el estado de `a | tail` es el de `tail`. La regla ya existía (bitácora agro 13: «los comandos con tubería antes de un commit llevan `set -o pipefail`»), pero el shell de cada comando empieza de cero y la regla vivía en mi memoria de la sesión, no en el comando. Es P14 y, sobre todo, P18: una regla escrita sin guardia.

*Arreglo.* El commit no estaba subido: se corrigió el lint y se rehízo con `--amend`. En la misma corrección, `set -o pipefail` detuvo el segundo intento, que también tenía un error. Desde ahora, todo comando mío que decide un commit empieza con `set -o pipefail`, y la regla quedó en la memoria del proyecto, que se carga en cada sesión.

**Lo prueba:** nada automático: es un comando del asistente, no del repositorio. La guardia real es el CI, que corre el lint en cada PR.

La regla: **una regla que depende de que alguien se acuerde se olvida en el primer comando con prisa. Si no puede tener guardia, va en la memoria que se carga sola, no en la de la conversación.**

*Ficha:* core · *(mío)* · 🟡 Medio · P14, P18 · 0.3.0 · 2026-10-05
