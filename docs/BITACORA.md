# Bitácora de fallos — Gestión Agro

Todo lo que se rompió, quién lo rompió, por qué pasó y cómo se arregló. Sirve para dos cosas:
- que un fallo no vuelva por el mismo camino;
- que quien llegue después vea que las decisiones raras del código tienen una cicatriz detrás.

Esta bitácora nace con 113 entradas de ventaja. La del ecommerce (`BITACORA-ecommerce.md`) ya pagó la mayoría de las lecciones, y aquí se convierten en reglas **antes** de escribir la primera línea de código. El éxito de esta bitácora se mide por los patrones heredados que **no** reaparecen.

**Severidad** = qué tan caro sale, no qué tan difícil fue arreglarlo.

| | |
|---|---|
| 🔴 **Crítico** | Se pierde un registro de campo, se filtra un dato o un secreto, se mezcla una finca con otra, o **un riego no se detiene**. Casi siempre silencioso |
| 🟠 **Grave** | Bloquea el trabajo, la sincronización o el despliegue, pero se ve |
| 🟡 **Medio** | Cuesta tiempo, confunde, o deja una prueba mintiendo |
| ⚪ **Menor** | Cosmético, redacción, números desactualizados |

---

## Cómo se une con las otras bitácoras (segundo cerebro de ED1)

La meta es que, cuando haya varias líneas creciendo, las bitácoras se lean como una sola. Para que eso sea un `cat` y no una migración, las tres convenciones se fijan desde hoy:

1. **Los patrones son del ecosistema, no del proyecto.**
   - P1–P21 son los del ecommerce, con **el mismo número y la misma regla**. Aquí no se renumeran ni se reescriben; se añaden entradas que los confirman.
   - Un patrón nuevo que nace aquí recibe un id **provisional** `PA<n>` («patrón agro»). Pasa a un número global `P<n>` cuando exista el archivo común `CONOCIMIENTO.md`. Así, dos proyectos no pueden abrir el mismo P22 en paralelo.
2. **Las entradas se citan con su proyecto:** «bitácora agro 3», «bitácora ecommerce 111». El número nunca cambia.
3. **La ficha es la misma línea en todas**, para que se pueda extraer con una expresión regular. Agro añade el proyecto al principio:

```
*Ficha:* agro · *(mío)* · 🟠 Grave · P6, P9 · 0.3.1 · 2026-11-14
```

Cuando exista `CONOCIMIENTO.md`, llevará tres cosas: la tabla global de patrones, la lista de entradas por patrón de todos los proyectos, y qué guardia lo impide en cada uno.

---

## Lo aprendido

Lista viva de patrones.
- Cuando una entrada confirma un patrón, se añade su número en **Entradas**.
- **En Agro** dice cómo toma forma el patrón en este producto.
- **Lo impedirá** es la guardia prevista, con la historia del backlog que la construye.
- **Lo impide hoy** se escribe solo cuando esa guardia existe, falla en rojo con el defecto puesto y se comprobó al escribirlo.

Al 30 sep 2026 no hay código, así que ningún patrón tiene todavía «Lo impide hoy».

### Heredados del ecommerce

#### P1 · El fallo que funciona es el caro
- **Regla:** lo que cae a un respaldo, a un valor de fábrica o a un «no pasa nada» tiene que gritar.
- **En Agro:**
  - Un registro que la celda no acepta no se descarta: va a cuarentena y se ve en rojo en el teléfono.
  - Un número ilegible (`9,5` mal leído) no es cero.
  - Una celda sin cuota no hace que la app finja haber sincronizado.
  - Un riego que no terminó es una alarma.
- **Lo impedirá:** esquemas zod sin `default` en campos de medida (HU-E3.2); cuarentena visible (HU-E5.2); estados «solo en este teléfono / enviado / rechazado» (HU-E3.14).
- **Entradas:** agro 1.

#### P2 · Dos copias del mismo procedimiento: una siempre se queda atrás
- **Regla:** una sola fuente, y lo demás se deriva de ella. Si no se puede, una aserción ata las dos copias.
- **En Agro:** la fórmula del DPV existe en TypeScript y en el firmware; el esquema de un registro, en la app, la API y las pruebas; la lista de celdas, en el despliegue y en el CORE; el formato de exportación, en respaldo, mudanza y portabilidad.
- **Lo impedirá:**
  - `packages/agro-schema` como única fuente de esquemas.
  - `infrastructure/celdas.json` como única lista de celdas, de la que se generan `wrangler.toml` y la tabla `celda`.
  - Una tabla de casos compartida entre `agro-calc` y el firmware (HU-E2.1, HU-E11.2).
  - `agro-export v1` como único formato (HU-E3.13, HU-E8.4, HU-E8.5).
- **Entradas:** —

#### P3 · Windows
- **Regla:** lo que corre en la máquina del operador corre en Windows, y una prueba en Linux no lo ve.
- **En Agro:** el dueño trabaja en `D:\CoWork\gestionagro`. Toda herramienta del repositorio es Node/TS (ADR-18). Nada de `.sh` en scripts de npm y nada de `import.meta.url === file://…` (bitácora ecommerce, «Dos herramientas se cargaban…»).
- **Lo impedirá:** trabajo de CI en `windows-latest` para `scripts/` (HU-E1.2); regla de Biome que prohíbe comparar `import.meta.url` con cadenas.
- **Entradas:** —

#### P4 · Una prueba que solo sabe ver la primera tienda no prueba el producto
- **Regla:** ninguna prueba nombra a un cliente real; se prueba con uno de prueba y, además, con OTRO.
- **En Agro:** la finca cero es la tuya, y es justo el nombre que no puede aparecer en el código. Las pruebas usan `Finca Ensayo Uno` (hortaliza) y `Finca Ensayo Dos` (flores). También aplica al revés: probar la base que ya existe, no solo la recién creada (bitácora ecommerce 111).
- **Lo impedirá:** `tests/terminos-prohibidos.json` + prueba de marca (HU-E1.7); prueba de migración de IndexedDB desde la versión anterior (HU-E3.2).
- **Entradas:** —

#### P5 · Una comprobación que da lo mismo con el defecto y sin él no comprueba nada
- **Regla:** antes de dar una comprobación, preguntar qué respondería sin el cambio. Toda aserción nueva se ve en rojo con su defecto puesto.
- **En Agro:** también aplica a las comprobaciones que se le piden al dueño («abre la app y mira que…»): tienen que distinguir.
- **Lo impedirá:** plantilla de pull request con el campo «Control negativo: qué defecto se puso y cómo se vio en rojo» (HU-E1.2); Definición de Terminado (`BACKLOG.md` §2).
- **Entradas:** agro 6, agro 8.

#### P6 · Lo que se escribe para los que vienen después deja fuera al primero
- **Regla:** el cliente cero también es un cliente: lo que se hace para «los demás» se corre contra él.
- **En Agro:** ADR-1. Tu invernadero entra por el mismo alta, la misma invitación y la misma celda que cualquier finca. Nada de «mientras tanto, a mano».
- **Lo impedirá:** el alta de la finca cero se hace con el flujo del producto (HU-E4.3) y queda registrada como prueba de aceptación.
- **Entradas:** agro 2.

#### P7 · Una caché convierte un chequeo en un recuerdo
- **Regla:** un instrumento lee la fuente, no la caché; una caché guarda respuestas, no fracasos.
- **En Agro:**
  - Los kill switches se leen con caché de hasta 60 s, y así se documenta.
  - El vigía de cuota lee la API de métricas, no un contador propio.
  - El service worker nunca cachea `/api/*` como respuesta válida.
- **Lo impedirá:** prueba de que un error de la API no queda en caché del service worker (HU-E3.1); prueba del tiempo máximo de un kill switch (HU-E8.1).
- **Entradas:** —

#### P8 · El reloj es una entrada que nadie declara
- **Regla:** fecha, hora y huso se mueven en la prueba que dice cubrir el reloj.
- **En Agro:**
  - Carencias y reentradas se cuentan en días locales.
  - La cuota de D1 se reinicia a las 19:00 hora Colombia.
  - Un teléfono con la hora mal escribe registros «del futuro».
  - Un ciclo de cultivo cruza fin de mes y de año.
- **Lo impedirá:** baterías de fechas con dos husos, fin de mes, 29 de febrero y 18:59/19:01 Bogotá (HU-E1.2, HU-E9.1); marca de «reloj corrido» (HU-E5.6).
- **Entradas:** —

#### P9 · Reproducir antes de diagnosticar
- **Regla:** ningún diagnóstico se da por bueno sin reproducir el fallo.
- **En Agro:** los fallos de sincronización se reproducen con la batería de caos, no se razonan.
- **Lo impedirá:** `tests/caos/` (HU-E5.6).
- **Entradas:** —

#### P10 · El que se actualiza a sí mismo corre su versión vieja
- **Regla:** un arreglo en el que se actualiza llega una versión tarde. Y quien vuelve atrás corre también la vieja.
- **En Agro:** el caso más probable del proyecto. Un teléfono de la finca puede pasar semanas sin actualizar la PWA y seguir sincronizando.
- **Lo impedirá:** protocolo N-1, nunca descartar por versión (ADR-13, HU-E5.5); migraciones expandir → migrar → contraer (ARQUITECTURA §7.4).
- **Entradas:** —

#### P11 · Lo que depende de SER la semilla no puede decidir si una tienda publica
- **Regla:** una compuerta solo mira invariantes que valen para cualquier cliente.
- **En Agro:** aquí no hay semilla clonada, pero sí hay anillos. Una compuerta de despliegue no puede depender de datos de la finca cero.
- **Lo impedirá:** smoke tests contra las fincas de prueba sembradas en staging (HU-E1.5).
- **Entradas:** —

#### P12 · El permiso que se comprueba es el que se usa
- **Regla:** un token se prueba antes de sembrarlo y con la acción que va a hacer; ninguno opcional va en el camino crítico.
- **En Agro:** `CF_API_TOKEN` por celda; token de servicio entre celdas para la mudanza.
- **Lo impedirá:** el flujo de despliegue verifica el token con una operación de solo lectura de esa cuenta antes de desplegar (HU-E1.5); la mudanza prueba el token de servicio antes de congelar la finca (HU-E8.5).
- **Entradas:** —

#### P13 · Un secreto no viaja por donde queda escrito
- **Regla:** llaves y tokens solo en los almacenes de secretos, nunca en una dirección, un pantallazo o un documento. Lo mismo, los datos de las personas.
- **En Agro:** el código de invitación va en el fragmento `#`; el token en el encabezado, nunca en la query; el QR no lleva datos personales.
- **Lo impedirá:** prueba que recorre las llamadas de la app y falla si un token o código aparece en una URL (HU-E4.4); lista de secretos atada a ARQUITECTURA §7.5 (HU-E1.2).
- **Entradas:** agro 5.

#### P14 · Los fallos silenciosos del lenguaje y del shell
- **Regla:** `| tee` sin `pipefail`, un `try/catch` que protege, dos funciones con el mismo nombre: no fallan, siguen.
- **En Agro:** TypeScript estricto (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`) y Biome con `noShadow` y sin `catch` vacíos.
- **Lo impedirá:** configuración de tsc y Biome (HU-E1.1); prueba de flujos que exige `pipefail` (HU-E1.2).
- **Entradas:** —

#### P15 · Un aviso tiene que llegar a donde alguien mira, y nombrar la causa
- **Regla:** el aviso va donde está la persona, dice qué pasó y qué hacer.
- **En Agro:** el operario mira el teléfono, no un log. «Sincronización en pausa hasta las 19:00; tus registros están guardados aquí» y no «Error 429».
- **Lo impedirá:** catálogo de mensajes con causa y acción (HU-E8.6); resumen de CI con todas las fallas (HU-E1.2).
- **Entradas:** —

#### P16 · Un flujo que nunca ha corrido de verdad no está probado
- **Regla:** se corre de punta a punta antes de llamarlo camino normal.
- **En Agro:** despliegue, respaldo, restauración y mudanza de celda.
- **Lo impedirá:** prueba de punta a punta de cada una (HU-E1.5, HU-E8.4, HU-E8.5).
- **Entradas:** —

#### P17 · El instrumento también miente
- **Regla:** un doble que simplifica una propiedad que el código real promete miente el día que alguien depende de ella.
- **En Agro:**
  - `fake-indexeddb` no reproduce cuotas ni desalojo del navegador.
  - El D1 local no reproduce el límite diario ni las 50 consultas por invocación.
  - Un emulador de ESP32 no reproduce un relé pegado.
- **Lo impedirá:** cada doble documenta lo que no imita, y el límite de 50 consultas se simula en las pruebas del Worker (HU-E5.2).
- **Entradas:** agro 6, agro 8.

#### P18 · Un documento no lanza una excepción cuando miente
- **Regla:** lo que un documento afirma del código lo ata una aserción; el redundante se borra.
- **En Agro:** ARQUITECTURA §7.5 (secretos), `celdas.json`, las rutas de ADR-19, los límites de cuota citados.
- **Lo impedirá:** guardias de documentación en CI (HU-E1.2).
- **Entradas:** agro 4, agro 5.

#### P19 · Un rojo que no significa nada enseña a no mirar los rojos
- **Regla:** una guarda con falsos positivos o un intermitente se arregla o se quita.
- **En Agro:** las pruebas e2e offline y de sincronización son candidatas a intermitencia. Se esperan estados, no tiempos.
- **Lo impedirá:** regla de revisión: ningún `waitForTimeout` en Playwright (HU-E1.2).
- **Entradas:** agro 5.

#### P20 · Lo que se le ofrece a alguien tiene que llegar por el camino que esa persona recorre
- **Regla:** se prueba desde quien mira.
- **En Agro:** el operario con guantes, sol en la pantalla y señal intermitente; el comprador que escanea el QR; el rastreador que no ejecuta JavaScript.
- **Lo impedirá:** e2e en viewport de 360 px y modo offline; SEO horneado (HU-E2.5).
- **Entradas:** —

#### P21 · Lo que borra antes de escribir convierte un fallo en una pérdida
- **Regla:** escribir primero, verificar, borrar después.
- **En Agro:** mudanza, restauración, importación y migraciones de IndexedDB. Y los registros no se borran nunca: se anulan (ADR-4).
- **Lo impedirá:** pruebas de mudanza y restauración con falla inyectada a la mitad (HU-E8.4, HU-E8.5).
- **Entradas:** —

### Nuevos (provisionales)

#### PA1 · Un comando de solo lectura también escribe
- **Regla:** en un entorno con permisos recortados (sin borrar, solo lectura, montado desde otra máquina), cualquier comando puede dejar un residuo que no se puede limpiar. Se usa la variante sin efectos (`git --no-optional-locks`, `--dry-run`) y se comprueba después que no quedó nada.
- **Entradas:** agro 1.
- **Lo impide hoy:** nada automático. Es regla de la casa.

---

## Cómo escribir una entrada

Igual que en la bitácora ecommerce, para que se lean y se extraigan igual:

| Campo | Qué lleva | Cómo se reconoce |
|---|---|---|
| Número y título | El siguiente número libre y el síntoma o la lección en una frase | `**N · Título.**` al empezar el párrafo |
| Qué pasó | Cuándo, en qué finca de prueba, celda o flujo, qué se estaba haciendo | Primeras frases |
| Síntoma literal | El mensaje tal cual salió | Entre «…» o en un bloque de código |
| Causa raíz | Por qué pasó, no solo dónde | Prosa |
| Cómo se reprodujo | Batería, D1 local, finca de prueba… o «sin reproducir», dicho | Prosa |
| Arreglo | Qué cambió, y por qué así | Prosa |
| Qué lo prueba | Batería y aserciones, y su control negativo | `**Lo prueba(n)**` |
| La regla | La lección que sirve fuera de este caso | `La regla:` en negrita |
| Ficha | Proyecto, autoría, severidad, patrones, versión y fecha | Última línea |

- **Autoría:**
  - *(mío)*: lo rompió o lo afirmó el asistente.
  - *(tuyo)*: el dueño.
  - *(compartido)*.
  - *(del terreno)*: la plataforma, el clima o la finca.
- **Versión:** la del producto que trae el arreglo. `0.0.0` antes del primer commit.

Cuatro reglas que no se rompen:

1. Una entrada nueva va al final, con el siguiente número. No se renumera.
2. Lo escrito no se reescribe. Se añade *(Hoy: …)* o *(Después: bitácora agro N)*.
3. Se cita el síntoma, no la interpretación.
4. Sin control negativo no hay «lo prueba».

---

## Afirmaciones mías que resultaron falsas

Van aparte porque no son fallos de código: son cosas que dije con seguridad y no eran ciertas.

1. **«Se abre una celda nueva (otra cuenta gratuita) al llegar al 60 % de la cuota».** Lo propuse el 30 sep 2026 como modelo de escala, con la advertencia de que no había verificado los términos. Al verificarlos: el Self-Serve Subscription Agreement de Cloudflare, §2.2.1(c), prohíbe usar los servicios para esquivar límites o cuotas. La escala es Workers Paid o una cuenta del cliente (ADR-7, ADR-8). Ver bitácora agro 4.
2. **«Caben unas 500 fincas por cuenta; el cuello de botella son las escrituras».** Contaba una fila por registro. Pero D1 cuenta también cada entrada de índice como fila escrita (verificado en la página de precios de D1), y no había mirado dos límites que muerden antes: 500 MB por base y 10 GB-mes de R2 para fotos. La cifra corregida es de ~300 fincas por escrituras y ~90 finca-año de fotos (ARQUITECTURA §6.2). La conclusión «el agro cabe en el plan gratuito durante la validación» sigue en pie. El número no.

---

## Cambios de rumbo

No son errores. Son decisiones que cambiaron con información nueva.

| De | A | Por qué |
|---|---|---|
| Gestión agrícola en la Fase 7 de ED1, después de validar | Ahora, como **cliente cero** (ADR-2) | El invernadero ya está en obra y hay una operación real que registrar desde el trasplante. Queda acotado: nada de plataforma sin tres casos, nada de cobro sin umbrales |
| Un repositorio y una cuenta por cliente (modelo de la tienda) | Celdas multi-tenant portables (ADR-6) | El límite que obligó a la tienda (30 ejecuciones simultáneas de Apps Script) no sube pagando; los de Cloudflare sí |
| Celdas en cuentas gratuitas nuevas | Workers Paid o cuenta del cliente (ADR-7, ADR-8) | Términos de Cloudflare §2.2.1 |
| Primera herramienta: «dosis por bomba» (orden de la lista del Estudio) | DPV | Sirve a la finca cero, no tiene riesgo legal de dosis y comparte sensor con la línea Conectada |
| CORE en la Fase 3 de ED1 | CORE v0 ahora, mínimo (ADR-9) | Es el primer producto con cuentas; extraerlo después obliga a migrar usuarios |

---

## Lo que el terreno enseñó, y no fue culpa de nadie

- **D1 cuenta las entradas de índice como filas escritas.** Un `INSERT` en una tabla con dos índices son tres filas contra la cuota de 100.000 al día. Cada índice nuevo es una decisión de presupuesto.
- **La cuota diaria de D1 se reinicia a las 00:00 UTC**, que son las 19:00 en Colombia. Un día de trabajo en la finca cruza dos «días» de cuota.
- **Una invocación de Worker gratuito admite 50 consultas a D1.** La sincronización sube en lotes de ≤ 25 operaciones.
- **Los términos de Cloudflare prohíben esquivar cuotas, crear cuentas en masa y registrarse por terceros** (§2.2.1 a, c, e).
- **`corepack enable` no sirve en la máquina del dueño** (30 sep 2026). Escribe los atajos en `C:\Program Files\nodejs` y falla con `EPERM: operation not permitted, open 'C:\Program Files\nodejs\pnpx'`. Con `--install-directory` tampoco: el corepack 0.33 de Node 22.18 busca `bin\pnpm.cjs`, que pnpm 12 ya no trae. pnpm se instala con `npm install -g pnpm@<versión de packageManager>`, que escribe en `AppData\Roaming\npm` (README, Arranque).
- **La descarga de Chromium de Playwright no funciona en la máquina del dueño** (30 sep 2026): `Request to https://cdn.playwright.dev/… timed out`, con sandbox y sin él, aunque `curl` baja el mismo archivo. En Windows local, `playwright.config.ts` usa el Microsoft Edge instalado (`channel: msedge`, mismo motor Chromium); en CI se usa el Chromium de Playwright. `PW_CANAL` fuerza uno u otro.
- **pnpm 11 se niega a correr cualquier script si una clave de dependencias no es un nombre de paquete** (`ERR_PNPM_INVALID_DEPENDENCY_NAME`). La guardia de `tests/repo/package-json.test.ts` lo repite para no depender de la versión de pnpm.

---

## Entradas numeradas

**1 · Un `git status` dejó el repositorio sin poder hacer commit.**

*Qué pasó.* El 30 sep 2026, al conectar por primera vez la carpeta `D:\CoWork\gestionagro` a la sesión, corrí `git status` para ver el estado del repositorio vacío.

*Síntoma literal:*

```text
warning: unable to unlink '…/gestionagro/.git/index.lock': Operation not permitted
```

*Causa raíz.* `git status` no es de solo lectura: toma un candado (`index.lock`) para refrescar el índice y lo borra al terminar. La carpeta estaba montada con el borrado desactivado, así que el candado se creó pero no se pudo quitar. El siguiente `git add` o `git commit` del dueño habría fallado con «Unable to create '…/index.lock': File exists», un mensaje que manda a buscar otro proceso de git que no existe.

*Arreglo.* El candado se movió fuera de `.git/` a `_to_delete/git-index.lock`, que el dueño borra cuando quiera. Desde entonces las consultas de git en esa carpeta se hacen con `git --no-optional-locks`.

**Lo prueba:** nada automático. Se comprobó con `ls .git` después de moverlo: no quedó candado.

La regla: **en una carpeta donde no se puede borrar, un comando de «solo mirar» también puede dejar basura. Se usa la variante sin efectos y se mira lo que quedó.** Abre PA1.

*Ficha:* agro · *(mío)* · 🟡 Medio · PA1, P1 · 0.0.0 · 2026-09-30

**2 · El primer pedido del proyecto contradecía sus propios documentos, y se dijo antes de construir.**

*Qué pasó.* El dueño pidió diseñar y priorizar el software de gestión agrícola «aunque no esté en el ecosistema». ED1 dice tres cosas que eso contradice:
- El agro no está en el ICP (ED1 §2.1).
- Los SaaS verticales van en la Fase 7 (ED1 §33).
- No se construye plataforma sin tres casos (ED1 §3.11).

Las instrucciones del proyecto piden señalar esas contradicciones antes de actuar.

*Arreglo.* No se ignoró ni se bloqueó: se acotó. ADR-2 declara la excepción de cliente cero con sus límites, y ADR-1 obliga a que la finca cero no tenga trato especial (P6). Quedó en ARQUITECTURA §2.3.

La regla: **una prioridad del dueño que contradice un documento del ecosistema no se discute en silencio ni se obedece en silencio: se escribe como excepción, con su alcance y la condición que la cierra.**

*Ficha:* agro · *(compartido)* · ⚪ Menor · P6 · 0.0.0 · 2026-09-30

**3 · El modelo de despliegue de la tienda no se copia, porque el límite que lo justificó no existe aquí.**

*Qué pasó.* El dueño propuso considerar el modelo de la tienda: un repositorio y una cuenta de Google por cliente, desplegados por anillos con Actions. Ese modelo nació de un límite concreto: las 30 ejecuciones simultáneas de Apps Script no suben pagando (bitácora ecommerce, «Lo que el terreno enseñó»).

*Causa raíz de no copiarlo.* En Cloudflare los límites sí suben pagando. Y el plan Cadena necesita que la exportadora vea a sus proveedores en un mismo sistema, lo que una instancia por finca impide.

*Arreglo.*
- Celdas multi-tenant portables (ADR-6).
- Se conservan los anillos de despliegue por Actions, que funcionan (ARQUITECTURA §7.3), aplicados por celda y por organización.

La regla: **antes de copiar una arquitectura de otra línea del ecosistema, se busca en su bitácora el límite que la obligó y se verifica si existe en la nueva plataforma.**

*Ficha:* agro · *(compartido)* · ⚪ Menor · P2 · 0.0.0 · 2026-09-30

**4 · Abrir cuentas gratuitas para ganar cuota choca con los términos de Cloudflare.**

*Qué pasó.* En la conversación de diseño propuse escalar abriendo una celda nueva en otra cuenta gratuita al llenar la anterior. Advertí que no lo había verificado. Al verificarlo, el Self-Serve Subscription Agreement dice:
- **§2.2.1(c):** prohíbe acceder a los servicios de una forma que busque esquivar límites o cuotas.
- **§2.2.1(e):** prohíbe crear cuentas múltiples con scripts.
- **§2.2.1(a):** prohíbe registrarse en nombre de un tercero.

*Por qué importa aunque no se construyó.* Una suspensión por incumplir términos no afecta solo al agro: apaga la cuenta que hoy sirve a todo ED1 ([H15]).

*Arreglo.* ADR-7: escalar con Workers Paid (USD 5/mes) cuando lo pague un cliente. ADR-8: las celdas dedicadas, solo en cuentas del cliente. Hallazgos HA1 y HA2 para ED1 y para la línea ecommerce (ARQUITECTURA §14).

**Lo prueba:** nada, es un documento. Lo ata ARQUITECTURA §6.5, con la fuente y la fecha.

La regla: **un modelo de escala que depende de la cuota gratuita de un proveedor se verifica contra sus términos, no solo contra su tabla de precios.**

*Ficha:* agro · *(mío)* · 🟠 Grave · P18 · 0.0.0 · 2026-09-30

**5 · Los Actions privados no arrancaban, el repositorio se hizo público y con él la lista de nombres reales.**

*Qué pasó.* El 30 sep 2026, al empujar el S1, las primeras cuatro corridas de `ci` y `scripts-windows` terminaron en rojo en 2 a 5 segundos. Los PR #1 y #2 se fusionaron así. Para que corrieran, el dueño pasó el repositorio a público; con eso, las corridas siguientes quedaron en verde en Linux y Windows.

*Síntoma literal:*

```text
The job was not started because recent account payments have failed or your spending limit needs to be increased. Please check the 'Billing & plans' section in your settings
```

*Causa raíz.* No era el código: los trabajos nunca arrancaron. Los repositorios privados gastan minutos de la organización; los públicos no. Según el dueño, los límites del mes estaban agotados. Que los haya agotado otra línea del ecosistema con repositorios en la misma organización es una hipótesis, *sin verificar*. Si es así, los 2.000 min/mes de ARQUITECTURA §7.2 no son del agro sino de toda la organización.

*Lo que costó.* Al hacerlo público quedaron expuestos:
- `tests/terminos-prohibidos.json`, con los nombres de personas de la finca cero. HU-E1.7 decía que la lista salía del repositorio **antes** de publicarlo, pero esa regla vivía en un documento, sin una guardia que la hiciera cumplir (P18);
- los emails de autor de los primeros commits;
- todo `docs/`.

Además, dos PR se fusionaron con el CI en rojo. Esta vez el rojo no hablaba del código, pero fusionar sobre rojo es justo lo que P19 enseña a no hacer.

*Arreglo.* El dueño aceptó la exposición y el repositorio vuelve a privado cuando se reinicien los minutos (ADR-17, excepción temporal). No se reescribe el historial.

**Lo impedirá (propuesto, no construido):**
- una prueba que falle si el repositorio es público y la lista sigue adentro (el flujo pasa `github.event.repository.private` a `verificar`);
- proteger `main` exigiendo los chequeos `ci` en verde para fusionar;
- medir los minutos de toda la organización en el reporte semanal (HU-E8.3).

La regla: **una condición que dice «antes de X, haz Y» y no tiene guardia se incumple el día que X llega con prisa. Y un rojo por falta de minutos se ve igual que un rojo del código: hay que leer la causa antes de fusionar.**

*Ficha:* agro · *(compartido)* · 🔴 Crítico · P13, P18, P19 · 0.1.0 · 2026-09-30

**6 · La guardia de licencias solo miraba la raíz del monorepo.**

*Qué pasó.* El 30 sep 2026, al agregar `dexie`, `zod` y `fake-indexeddb` en `apps/cuaderno` y `packages/agro-schema` (HU-E3.2), `pnpm licencias` siguió diciendo «✅ 59 dependencias con licencia permitida». Eran las mismas 59 de antes de instalar.

*Causa raíz.* Sin `--recursive`, `pnpm licenses list` lista solo el proyecto de la raíz. HU-E1.2 se cerró con los controles negativos hechos sobre la función que clasifica licencias, no sobre el instrumento que le entrega la lista. Mientras todas las dependencias vivían en la raíz, las dos cosas daban lo mismo (P5). Una AGPL en cualquier paquete del workspace habría pasado en verde.

*Cómo se reprodujo.* `pnpm licenses list --json` no contiene `dexie`; `pnpm -r licenses list --json` sí.

*Arreglo.* `--recursive`, y la guardia se comprueba a sí misma: toda dependencia declarada en un `package.json` del workspace tiene que aparecer en el listado, o la corrida falla y la nombra.

**Lo prueban** `tests/repo/licencias.test.ts` («la guardia de licencias se comprueba a sí misma») y la propia corrida de `pnpm licencias`. Control negativo: sin `--recursive` sale «❌ dexie / fake-indexeddb / zod: declarada en un package.json pero ausente del listado de licencias».

La regla: **un control negativo tiene que poner el defecto también en el instrumento, no solo en la regla que el instrumento alimenta. Si la lista de entrada no se comprueba, «0 rechazos» puede querer decir «0 revisados».**

*Ficha:* agro · *(mío)* · 🟠 Grave · P5, P17 · 0.1.0 · 2026-09-30

**7 · La raíz del repositorio se calculaba desde la ubicación del archivo, y el build de Astro lo movió.**

*Qué pasó.* El 30 sep 2026, en el primer `astro build` del sitio (HU-E1.6), la generación de páginas falló.

*Síntoma literal:*

```text
ENOENT: no such file or directory, open 'D:\CoWork\gestionagro\apps\sitio\dist\schemas\product.schema.json'
```

*Causa raíz.* `scripts/lib/repo.ts` definía la raíz como «dos carpetas arriba de este archivo». Era cierto mientras el archivo se ejecutaba donde vive. Astro empaqueta el código en `apps/sitio/dist/.prerender/`, y desde ahí dos carpetas arriba es `apps/sitio/dist`.

*Arreglo.* `encontrarRaiz` sube carpeta por carpeta hasta la que tiene `pnpm-workspace.yaml`. Funciona igual desde `scripts/`, desde las pruebas y desde el build.

**Lo prueba** el paso `build` de `verificar`, que genera las páginas desde los contratos. Control negativo: con la ruta fija de antes, el build falla con el mensaje citado.

La regla: **una ruta relativa al archivo que se ejecuta supone que nadie lo mueve. Un empaquetador lo mueve.**

*Ficha:* agro · *(mío)* · 🟡 Medio · P2, P16 · 0.1.0 · 2026-09-30

**8 · La prueba «calcular no hace solicitudes» contaba con la red apagada, y así no veía ninguna.**

*Qué pasó.* El 30 sep 2026, en HU-E2.2, la prueba e2e del CA5 apagaba la red (`context.setOffline(true)`), escribía valores y exigía que la lista de solicitudes estuviera vacía. Pasaba en verde.

*Cómo se descubrió.* Con el control negativo: la isla haciendo `fetch('/api/medir')` en cada cálculo. La prueba siguió en verde. El defecto sí estaba en el build (`apps/sitio/dist/_astro/CalculadoraDpv.*.js` contenía `api/medir`).

*Causa raíz.* Con el contexto sin conexión, Playwright no reporta en `page.on('request')` las solicitudes que la página intenta hacer. La lista vacía no significaba «no pidió nada», sino «no pude ver lo que pidió» (P17).

*Arreglo.* Dos pruebas: una cuenta las solicitudes **con** la red encendida, y la otra comprueba que se calcula **sin** red. Con el mismo defecto, la primera falla y nombra `http://localhost:4321/api/medir`.

La regla: **no midas una propiedad en las condiciones que apagan el instrumento. «Cero eventos» solo vale si el instrumento podía ver uno.**

*Ficha:* agro · *(mío)* · 🟡 Medio · P5, P17 · 0.1.0 · 2026-09-30

**9 · `context.route` no ve la petición con la que el navegador busca un service worker nuevo.**

*Qué pasó.* El 30 sep 2026, en HU-E3.1, la prueba de actualización simulaba una versión nueva interceptando `**/agro/app/sw.js` con `context.route` y agregándole un byte. El aviso de versión nueva nunca aparecía.

*Cómo se reprodujo.* Con una prueba de diagnóstico que contaba las veces que se ejecutaba la interceptación: `hits 0`, y el registro sin `waiting` ni `installing`. El navegador sí pidió el `sw.js`, pero Playwright no pasó esa petición por la ruta.

*Causa raíz.* La búsqueda de actualizaciones del service worker la hace el navegador por su cuenta, fuera de lo que intercepta `context.route` (P17).

*Arreglo.* Es el servidor de pruebas el que cambia un byte de `sw.js`, con `POST /__prueba/version-nueva`, una ruta que solo existe en `scripts/servir-estatico.ts`. Además, tras «Actualizar ahora» se espera la navegación como estado (`framenavigated`). Antes la prueba evaluaba en plena recarga y fallaba una de cada tres corridas (P19). Pasó cinco de cinco.

*También en el camino.* El primer build de la PWA no registraba el service worker: compilé antes de agregar el componente que lo registra. Y `vite-plugin-pwa` importa `workbox-window` sin declararlo: `Rolldown failed to resolve import "workbox-window"`. Se agregó como dependencia.

La regla: **antes de culpar a la app porque un evento no llega, comprueba que el instrumento lo puede producir: cuenta las veces que se ejecuta tu intercepción.**

*Ficha:* agro · *(mío)* · 🟡 Medio · P9, P17, P19 · 0.1.0 · 2026-09-30

**10 · Tres veces en un día, una barra invertida se perdió al escribir código desde la terminal.**

*Qué pasó.* El 30 sep 2026 escribí código desde comandos de shell (heredocs y `node -e` con plantillas de JavaScript). Tres veces se perdió una barra invertida:
1. HU-E2.2, regex del control negativo: el defecto no se aplicó. El control «falló» por otro motivo y lo noté porque no cuadraba.
2. HU-E1.5: el esquema de `celdas.json` quedó con `\.` dentro de una cadena JSON. `JSON.parse` lo rechazó: `Bad escaped character in JSON`.
3. HU-E1.5: la guardia de inyección de comandos quedó como `/${{s*(inputs.|…/`. **Ese regex no detecta nada**: la guardia pasaba en verde sobre cualquier flujo.

*Cómo se descubrió el tercero.* Con su caso malo en la prueba unitaria: `expected [] to deeply equal [ ObjectContaining… ]`. Sin ese control negativo (P5), la guardia habría quedado puesta, verde e inútil.

*Causa raíz.* Cada capa de shell y de plantilla consume un nivel de escapado. Un regex atraviesa dos o tres capas antes de llegar al archivo.

*Arreglo.* Los dos regex se corrigieron con la herramienta de edición, que escribe el texto tal cual. Desde ahora, el código con barras invertidas (regex, JSON con escapes, rutas de Windows) se escribe con las herramientas de archivo, no con comandos de shell.

**Lo prueba:** las pruebas unitarias de cada guardia traen su caso malo. Una guardia sin ese caso no se acepta.

La regla: **lo que pasa por más de una capa de escapado no se escribe desde la terminal. Y una guardia nueva no está terminada hasta verla atrapar su defecto.**

*Ficha:* agro · *(mío)* · 🟡 Medio · P5, P14 · 0.1.0 · 2026-09-30

**11 · La primera corrida real del despliegue: Analytics Engine no estaba activado, y el resumen no decía por qué falló.**

*Qué pasó.* El 1 oct 2026 (UTC), al fusionar HU-E1.5, corrió por primera vez «desplegar» contra staging. Lo que salió bien: la verificación del token pasó, el build pasó, y wrangler subió los 19 archivos. Luego, al crear el Worker, falló.

*Síntoma literal:*

```text
✘ [ERROR] A request to the Cloudflare API (/accounts/***/workers/scripts/agro-sitio-staging) failed.
  You need to enable Analytics Engine. Head to the Cloudflare Dashboard to enable: https://dash.cloudflare.com/***/workers/analytics-engine [code: 10089]
```

*Causa raíz.*
- Analytics Engine se activa una vez por cuenta, y la cuenta de c0 nunca lo había activado. Ni la verificación del token ni `wrangler deploy --dry-run` lo pueden ver: solo lo ve un despliegue real (P16).
- El resumen de la corrida decía «wrangler deploy falló; ver el registro de la corrida». Mandaba a buscar la causa en vez de nombrarla (P15).

*Arreglo.*
- El dueño activa Analytics Engine en Cloudflare.
- `causaDeWrangler` cita en el resumen el error de wrangler, sin colores. Si el código ya se vio en una corrida real, agrega qué hacer. Solo entran códigos observados, no supuestos (P1).

**Lo prueban** 3 pruebas de `tests/repo/despliegue.test.ts`, con la salida real de esta corrida. Control negativo: sin quitar los colores, fallan 2.

La regla: **un flujo que nunca corrió de verdad esconde la configuración de la cuenta. El primer despliegue también prueba el resumen: si la falla no se entiende sin abrir el registro, el resumen falló.**

*Ficha:* agro · *(compartido)* · 🟠 Grave · P15, P16 · 0.1.0 · 2026-10-01
