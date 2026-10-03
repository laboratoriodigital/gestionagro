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
- **Entradas:** agro 12.

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
- **Entradas:** agro 13.

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
- **Entradas:** agro 12.

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
| Costo por kg = (insumos + mano de obra + otros costos) / kg cosechados, por nave (HU-E7.3) | Insumos + mano de obra, sobre lo vendible, por ciclo (2 oct 2026) | No existe un registro de «otros costos»: crearlo es un tipo nuevo con contrato, matriz y pantalla, y nadie lo ha pedido. Por eso la pantalla dice qué no incluye (CA3). Se divide por lo vendible porque es lo que fija el precio: dividir por lo cosechado daría un costo menor que el real. El ciclo es la unidad natural de una nave, y una nave con dos ciclos en un año no mezcla sus cuentas |
| El formato del CSV para la Tienda se lee de la documentación de la Tienda (HU-E6.5, P9) | El cuaderno propone el formato v1 y la Tienda lo confirma al importarlo (2 oct 2026) | La documentación de la Tienda vive en otro repositorio. El dueño pidió que lo propusiera. Para no esconder la suposición, el formato está escrito en un solo lugar (`disponibilidad.ts`) y queda pendiente probarlo en la hoja real |
| Kg por hora «a partir de cosechas con personas y horas» (HU-E7.4) | La cosecha pasa a v2 con las horas de cada persona (2 oct 2026) | La historia suponía que la cosecha tenía horas, y no las tenía. Cruzarla con una labor «Cosecha» del mismo día adivinaría a quién y cuánto. Se agregó el campo opcional con traductor desde v1 (P10), como la aplicación v2. La regla que deja: antes de calcular algo, verificar que el dato existe en el esquema, no en la historia |
| Calendario de carencias en el peldaño premium (HU-E9.1) | Gratis, en el peldaño usuario recurrente, con un interruptor por plan (2 oct 2026) | El análisis de palabras clave (HU-E0.2) ya lo había decidido gratis para traer tráfico; el dueño pidió poder encenderlo o apagarlo, y quedó en `content/agro/cuaderno/funciones.json` porque el plan gratuito no tiene sesión y un flag en la nube no le llegaría. El Estudio de mercado lo pone en «usuario recurrente» y la escalera de ARQUITECTURA §2.4 no lo nombra en Premium/Finca; cada área ya mostraba su carencia gratis (HU-E3.10). Se paga exportarlo, en la carpeta de HU-E9.2. Es la primera historia contrastada con las tres fuentes desde la entrada 29, y el contraste cambió el peldaño |
| Fotos de monitoreo en todos los planes (30 al mes en el gratuito) | Solo en el plan Finca (2 oct 2026) | El dueño lo corrigió: la escalera de ARQUITECTURA §2.4 ya las ponía en Premium/Finca (bitácora agro 29) |
| Un catálogo `cliente` | El cliente va dentro del despacho, con nombre y tipo (HU-E6.3) | Un catálogo nuevo obliga a rehacer el CHECK de `catalogo` en la celda y a un `agro-export` v2. Pasa a catálogo cuando haga falta editar un cliente o guardar su contacto |
| Reporte semanal con Search Console | Search Console después (2 oct 2026) | Decisión del dueño: pide una cuenta de servicio de Google; el reporte dice que falta |
| Una base local por finca con el id de su organización (`gestionagro-cuaderno-<org>`, HU-E4.7) | La base de siempre conserva su nombre y las nuevas llevan un uuid v7 (3 oct 2026) | Renombrar la base actual era una migración de todos los teléfonos para nada, y una finca solo local no tiene organización. La organización va en la lista de fincas del teléfono |
| Varias bodegas de insumos en el plan Exportador (HU-E7.5) | A la hoja de ruta, preparada sin sprint (3 oct 2026) | El dueño pedía varias bodegas o almacenes en una misma finca, y prefirió no construirla aún por lo que implica: un catálogo nuevo, la migración del CHECK de `catalogo` en la celda y un `agro-export` v2 |
| Herramienta 2: «dosis por bomba» (E10) | Calendario de carencias en `/herramientas/agro/periodo-de-carencia/` (1 oct 2026) | Keyword Planner (HU-E0.2): dosis no trae búsquedas en ninguna de sus cuatro formas; «periodo de carencia» es el único término con más de 50 al mes en Colombia. El cálculo ya existe en el cuaderno. Dosis queda preparada hasta la medición del 25 feb 2027 |

---

## Lo que el terreno enseñó, y no fue culpa de nadie

- **D1 cuenta las entradas de índice como filas escritas.** Un `INSERT` en una tabla con dos índices son tres filas contra la cuota de 100.000 al día. Cada índice nuevo es una decisión de presupuesto.
- **La cuota diaria de D1 se reinicia a las 00:00 UTC**, que son las 19:00 en Colombia. Un día de trabajo en la finca cruza dos «días» de cuota.
- **Una invocación de Worker gratuito admite 50 consultas a D1.** La sincronización sube en lotes de ≤ 25 operaciones.
- **Los términos de Cloudflare prohíben esquivar cuotas, crear cuentas en masa y registrarse por terceros** (§2.2.1 a, c, e).
- **`corepack enable` no sirve en la máquina del dueño** (30 sep 2026). Escribe los atajos en `C:\Program Files\nodejs` y falla con `EPERM: operation not permitted, open 'C:\Program Files\nodejs\pnpx'`. Con `--install-directory` tampoco: el corepack 0.33 de Node 22.18 busca `bin\pnpm.cjs`, que pnpm 12 ya no trae. pnpm se instala con `npm install -g pnpm@<versión de packageManager>`, que escribe en `AppData\Roaming\npm` (README, Arranque).
- **La descarga de Chromium de Playwright no funciona en la máquina del dueño** (30 sep 2026): `Request to https://cdn.playwright.dev/… timed out`, con sandbox y sin él, aunque `curl` baja el mismo archivo. En Windows local, `playwright.config.ts` usa el Microsoft Edge instalado (`channel: msedge`, mismo motor Chromium); en CI se usa el Chromium de Playwright. `PW_CANAL` fuerza uno u otro.
- **El Miniflare que trae wrangler 4.144 es la 5 alfa, con otra API** (1 oct 2026): `new Miniflare({ modules, script, d1Databases })` falla con `Unrecognized keys`, y `workers: [{…}]` tampoco sirve. Las pruebas del CORE levantan D1 local con `getPlatformProxy` de wrangler, que es la interfaz estable (`apps/core/src/d1-local.ts`).
- **`wrangler d1 migrations apply` contesta «yes» solo en CI** (`isNonInteractiveOrCI`), y si alguien contestara «no» sale con código 0 sin aplicar nada. Por eso la prueba de humo del CORE consulta la base: una migración que no corrió se ve como 503.
- **Proponer un formato que nadie leyó es aplazar el error.** El CSV v1 para la Tienda tenía columnas propias; la hoja de la Tienda lee otras por nombre, pide `Stock` entero y vende productos, no lotes. Bastaba leer su CONTRATOS §4, que estaba en la máquina del dueño (3 oct 2026). Y la prueba nueva enseñó otra cosa: sin ciclo iniciado, la cosecha no sabe su cultivo, así que muchos lotes reales saldrían sin producto. Por eso la pantalla lo dice.
- **Un filtro pensado para Google vació la página para las personas.** La página de entrada listaba solo lo `activo`, para no pedirle a Google que indexara algo sin revisión. Mientras las dos calculadoras esperaban al agrónomo, quien llegaba leía «La primera calculadora está en preparación», con las dos funcionando a un toque. Lo que se indexa y lo que se le muestra a quien ya llegó son decisiones distintas (pedido del dueño, 3 oct 2026).
- **Staging se despliega solo y producción no.** Tres días después de la 0.1.0, producción no tenía la calculadora de carencia ni la política de datos (404), y staging sí. Validar en staging no dice qué ve la gente: hay que mirar también el dominio público.
- **Un refresh token que rota no se puede copiar.** Con varias fincas en el teléfono, cada base tendría su sesión; la primera que se renovara invalidaría a las demás. Hay una sola, y pasa a la finca que se abre (HU-E4.7). Una prueba vieja de HU-E4.2 («nada en localStorage») frenó la primera versión, que anotaba la lista aun con una sola finca: ahora se anota solo al agregar la segunda.
- **Lo que una pantalla anota, las demás no lo ven solas.** El nombre de la finca nueva se anotaba al abrir Cuenta, y la cabecera decía «Finca nueva» después de configurarla: lo encontró la e2e. La cabecera vuelve a anotar después de cada escritura. Su control negativo (abrir siempre la base de siempre) hace fallar las dos e2e de HU-E4.7.
- **Antes de abrir una función, mirar qué regla de seguridad deja de cumplirse.** Para aplicar por cama, la carencia tenía que mirar camas y naves: la cosecha solo miraba el área cosechada, y una cama tratada no habría bloqueado cosechar su nave (revisión del dueño, 3 oct 2026). Se cerró primero, con su control negativo.
- **Un botón que reintenta y obtiene la misma respuesta parece roto.** «Intentar confirmar» sí reintentaba, pero sin señal de que lo hizo. Todo reintento dice que lo intentó, cuándo y el motivo exacto (revisión del dueño, 3 oct 2026).
- **Una prueba de tiempo de reloj mide la máquina, no el cálculo.** La de la carpeta en PDF pasaba sola y fallaba con las otras pruebas en paralelo (4,4 s contra 2,5 s). Ahora mide el tiempo de CPU del proceso.
- **Una temporada «perfecta» no prueba las alertas.** La primera simulación tenía todos los datos bien; el dueño pidió errores a propósito (carencia vigente y desconocida, bodega en negativo, compra sin precio, insumo no permitido en ecológico, cosecha corregida después del lote). Cada caso se comprobó con las funciones de la app antes de entregar el archivo.
- **El service worker no controla la página en la primera visita:** una ruta de caché en tiempo de ejecución no ve lo que esa página descarga. El generador de la carpeta en PDF no quedaba guardado y sin señal fallaba (HU-E9.2). Se trae por adelantado cuando la sección está disponible, y la e2e recarga con el service worker al mando, como en la vida real. Su control negativo (quitar la ruta) la hace fallar.
- **Navegar con `page.goto` apenas se toca «Guardar» corta la escritura en IndexedDB.** En local alcanzaba a terminar; en CI, más lento, no: la e2e de HU-E10.2 no encontraba a la persona recién creada. Antes de navegar se espera a que lo guardado aparezca en pantalla (P19). Un CI en verde en local no prueba nada sobre los tiempos.
- **Dos PR que insertan una línea en el mismo punto del CHANGELOG chocan.** Antes de dar el push se prueba `git merge-tree --write-tree` contra las ramas abiertas, y cada historia anota su línea en otro lugar de la lista.
- **`astro-island` es `display: contents`: no tiene caja, y `scrollIntoView()` sobre ella no mueve nada.** Una isla `client:visible` no hidrataba en la prueba de presupuesto. Se desplaza hasta su primer hijo (HU-E2.3).
- **La fuente estándar de un PDF (WinAnsi) no tiene el signo menos «−» Unicode:** pdf-lib lanza al escribirlo. En el PDF solo van caracteres latinos (tildes, °, —, ×), y una prueba arma el PDF con cada cultivo del catálogo (HU-E2.3).
- **La API de Telegram exige el token del bot en la ruta de la URL** (HU-E8.3). No hay otra forma de llamarla; es una excepción dicha a P13, y la URL nunca va al log (ARQUITECTURA §7.5).
- **`visibility: hidden` esconde pero conserva el espacio:** al imprimir, una etiqueta de 5 × 5 cm sacaba 12 hojas (bitácora agro 28). Para imprimir solo una parte, se saca lo demás con `display: none`.
- **Un flujo `workflow_dispatch` solo aparece en Actions cuando el archivo está en la rama por defecto.** «telegram-chat» no se podía correr desde su rama.
- **Safari no codifica WebP en `canvas.toBlob`**: devuelve PNG. La foto del monitoreo cae a JPEG ahí.
- **IndexedDB no indexa claves nulas.** Un `valor_jornal` general (sin persona) no aparece por el índice `persona_id`; se busca recorriendo la tabla, que es pequeña.
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
- El dueño activa Analytics Engine en Cloudflare. *(Después: en esta cuenta, «activar» es crear el primer dataset. Se crean `agro_eventos_staging` y `agro_eventos`, los nombres de `celdas.json`. El mensaje del resumen y el runbook se corrigieron.)*
- `causaDeWrangler` cita en el resumen el error de wrangler, sin colores. Si el código ya se vio en una corrida real, agrega qué hacer. Solo entran códigos observados, no supuestos (P1).

**Lo prueban** 3 pruebas de `tests/repo/despliegue.test.ts`, con la salida real de esta corrida. Control negativo: sin quitar los colores, fallan 2.

La regla: **un flujo que nunca corrió de verdad esconde la configuración de la cuenta. El primer despliegue también prueba el resumen: si la falla no se entiende sin abrir el registro, el resumen falló.**

*Ficha:* agro · *(compartido)* · 🟠 Grave · P15, P16 · 0.1.0 · 2026-10-01

**12 · Tres supuestos míos sobre cómo se usa una finca, corregidos por el dueño al probar en el teléfono.**

*Qué pasó.* El 1 oct 2026 el dueño probó en staging el cuaderno de HU-E3.3 a HU-E3.6 y encontró cinco huecos. Ninguno era un fallo de las pruebas: las pruebas comprobaban lo que yo había supuesto.
1. El asistente pedía un solo tipo de área para toda la finca («¿Cómo divides la finca?»). Una finca real tiene naves y lotes a la vez.
2. Las camas y los surcos no se podían editar; solo las áreas principales.
3. Después del registro inicial no había forma de agregar otra área.
4. Los insumos no se podían editar.
5. La unidad del insumo era una lista cerrada (L, mL, kg, g, cc, unidad). En la finca se compra por bulto, galón o caneca.

*Causa raíz.* Diseñé los formularios desde el modelo de datos, que sí permitía todo eso, y no desde el recorrido de quien los usa. Las fincas de prueba eran homogéneas (todas naves o todas bloques) y ningún caso recorría «volver después a agregar o corregir».

*Arreglo.*
- Tipo por área en el asistente.
- Editar e historial también para camas y surcos.
- «Agregar área» en la pantalla de Áreas.
- Editar insumos con historial.
- «Otra unidad…» con texto libre, que se conserva al editar.

**Lo prueban** 6 e2e nuevas, entre ellas una finca con naves y lotes. Control negativo: sin la validación del tipo por área, sin edición de camas, con «editar» que crea otro insumo y con la unidad propia ignorada, cada una falla su prueba.

La regla: **una prueba con datos uniformes confirma el supuesto con que se escribió. Las fincas de prueba tienen que traer la variedad del terreno (tipos mezclados, unidades raras), y cada catálogo necesita su camino de «corregir después».**

*Ficha:* agro · *(mío)* · 🟡 Medio · P4, P20 · 0.1.0 · 2026-10-01

**13 · Un commit salió con una prueba en rojo porque mi comando revisaba la salida de `tail`, no la de `verificar`.**

*Qué pasó.* El 1 oct 2026, al cerrar HU-E3.8, corrí `pnpm verificar 2>&1 | tail -1 && git add -A && git commit …`. `verificar` falló: la prueba de humo del despliegue ya revisaba la ruta nueva `/agro/app/registrar/`, y su respuesta simulada tenía las rutas escritas a mano. Aun así, el commit se hizo.

*Síntoma literal:* la última línea de la salida fue `[ELIFECYCLE] Command failed with exit code 1.` y, justo debajo, el hash del commit nuevo.

*Causa raíz.* Sin `pipefail`, el estado de salida de `a | tail` es el de `tail`, que siempre termina bien (P14). La regla existía para los flujos de CI y la guardia la exige allí, pero yo no la aplicaba en mis propios comandos.

*Arreglo.*
- La respuesta simulada de la prueba de humo se genera desde `RUTAS_APP`: una ruta nueva no vuelve a romperla (P2).
- Como el commit no estaba subido, se corrigió con `--amend`; la historia no lleva un commit en rojo.
- Desde ahora, los comandos con tubería antes de un commit llevan `set -o pipefail`.

La regla: **una regla que solo vigila al CI no protege los comandos de quien escribe el código. Si un paso decide si se hace el commit, su estado de salida tiene que ser el del paso, no el del último filtro.**

*Ficha:* agro · *(mío)* · 🟡 Medio · P2, P14 · 0.1.0 · 2026-10-01

**14 · La prueba del presupuesto de JS fallaba de vez en cuando, y además podía medir de menos.**

*Qué pasó.* El 1 oct 2026 una corrida completa de `verificar` falló en la e2e «/herramientas/agro/calculadora-dpv/: JS < 50 KB con gzip». Repetida cuatro veces, falló una.

*Síntoma literal:*

```text
Error: response.body: Test ended.
```

*Causa raíz.*
- El oyente de respuestas leía el cuerpo de cada script con `await` dentro del evento, y la prueba no esperaba esas lecturas: si terminaba antes, la lectura reventaba (P19).
- Lo más serio: la prueba medía al llegar a `load`. La isla de la calculadora (HU-E2.2) carga sus fragmentos después, así que el total podía no incluirlos (P17). Cuando se escribió la prueba (HU-E1.6) todavía no había isla, y entonces daba igual.

*Arreglo.* Se guardan las promesas de cada cuerpo y se esperan todas. En las páginas con isla, primero se espera a que hidrate. Medido así, el JS de la página de la DPV es de 12.782 bytes con gzip. Pasó 6 de 6.

La regla: **una prueba de presupuesto que mide «hasta load» deja de medir el día que la página carga algo después. Se mide hasta el estado en que la página está completa, y se esperan todas las lecturas que se abrieron.**

*Ficha:* agro · *(mío)* · 🟡 Medio · P17, P19 · 0.1.0 · 2026-10-01

**15 · Un control negativo destruyó un archivo y otros dos dieron verde contra un build viejo.**

*Qué pasó.* El 1 oct 2026, en HU-E3.7, corrí cuatro controles negativos seguidos. Cada uno respaldaba los archivos que iba a dañar y los restauraba después. El respaldo se nombraba por el nombre del archivo, y había dos `riego.ts`: `packages/agro-calc/src/riego.ts` y `apps/cuaderno/src/almacen/riego.ts`. El segundo respaldo pisó al primero. Al «restaurar», el `riego.ts` de agro-calc quedó con el contenido del cuaderno. Como aún no estaba en un commit, git no podía devolverlo.

*Síntomas.*
- El control B dijo `Tests  no tests`: el archivo de pruebas ni cargaba.
- Los controles C (CE vacía como 0) y D (unidad sin recordar) dieron **4 passed**, con el defecto puesto. El build del cuaderno fallaba en silencio (salida a `/dev/null`), así que las e2e corrieron contra el build anterior, sin el defecto.

*Causa raíz.*
- Respaldos con nombres que pueden chocar (P2: dos cosas con el mismo nombre).
- Un paso de build cuyo fallo no detenía el control (P14).

Un control negativo que corre contra un build viejo da exactamente el verde falso que existe para impedir (P5).

*Arreglo.*
- El archivo se reescribió desde el contenido exacto de esta sesión.
- Los respaldos llevan la ruta completa en el nombre.
- Si el build falla, el control se detiene con «BUILD FALLÓ: control inválido».
- Repetidos así, B, C y D fallan donde deben.
- Al final se comprueba que `git diff` solo muestra los cambios reales.

La regla: **el control negativo también es código que puede fallar. Respaldos con nombres únicos, cada paso con su estado de salida, y un «verde» solo vale si el defecto llegó de verdad a lo que se probó.**

*Ficha:* agro · *(mío)* · 🟠 Grave · P5, P14, P2 · 0.1.0 · 2026-10-01

**16 · Un error en CE o pH escondía el aviso de «drenado mayor que lo aplicado».**

*Qué pasó.* El 1 oct 2026 el dueño probó el riego en staging: con un error en la sección plegada de CE y pH, el formulario no decía que el volumen drenado era mayor que lo aplicado. Lo vio solo después de corregir CE y pH y volver a guardar.

*Causa raíz.* El formulario validaba en dos tiempos. En el teléfono revisaba formato y rangos (CE, pH, números legibles) y, si algo fallaba, salía. La regla «drenado ≤ aplicado» solo la revisaba `agro-calc` al guardar. Con un error del primer tiempo, el segundo nunca corría: el operario corrige un campo, guarda, y aparece un error nuevo que estaba ahí desde el principio. Las pruebas de HU-E3.7 probaban cada error por separado, nunca juntos.

*Arreglo.* El formulario corre las dos revisiones antes de decidir y muestra todos los errores a la vez, cada uno junto a su campo. Una e2e llena tres campos mal a la vez (duración 0, drenado 600 de 500, CE 12) y exige los tres mensajes; con la revisión del drenaje quitada, falla.

La regla: **un formulario muestra todos sus errores en la misma vuelta. Si una validación sale antes, las que vienen después quedan escondidas; las pruebas de errores incluyen uno con varios a la vez.**

*Ficha:* agro · *(mío)* · 🟡 Leve · P15 · 0.1.0 · 2026-10-01

**17 · «Primero agrega los insumos» con un insumo ya guardado.**

*Qué pasó.* El 1 oct 2026 el dueño probó Aplicaciones en staging y no vio el insumo «Prueba 3 días» ni los plazos; luego lo vio y pensó que había sido un error suyo. Al reproducirlo en el navegador del panel, la pestaña dijo «Primero agrega los insumos en Insumos» con el insumo guardado (comprobado en IndexedDB). Dos segundos después, la lista apareció.

*Causa raíz.* La lista arrancaba como `[]` y se llenaba al terminar la lectura de IndexedDB. Para la pantalla, «todavía no sé» y «no hay» eran el mismo valor, así que mientras cargaba afirmaba algo falso. En la máquina de desarrollo la lectura toma milisegundos y nadie lo ve; en un teléfono lento dura lo suficiente para leerlo, y quien lo lee cree que se perdieron datos. Es P1 en la pantalla: un valor por defecto que se hace pasar por un dato. Las e2e no lo atrapaban porque esperan hasta que aparece lo correcto, y esa espera esconde lo que se mostró antes.

*Arreglo.*
- Las listas de Aplicaciones, Labores, Insumos y Personas arrancan en `null` («cargando») y muestran «Cargando…»; el «no hay» solo sale con la respuesta en la mano.
- La e2e instala un `MutationObserver` antes de abrir la pestaña y falla si el aviso apareció aunque sea un instante (`vigilarTexto`). Con la lista arrancando en `[]`, falla.

La regla: **«cargando» y «vacío» son estados distintos y la pantalla los dice distinto. Para probar que algo no se muestra, se vigila desde antes; esperar a que desaparezca no prueba nada.**

*Ficha:* agro · *(mío)* · 🟡 Leve · P1, P19 · 0.1.0 · 2026-10-01

**18 · El envío al salir de la página no se ve en las pruebas.**

*Qué pasó.* El 1 oct 2026, en HU-E2.7, la e2e esperaba ver el lote de eventos con `tool.next_step` al tocar «Guardar en mi cuaderno». Nunca llegó, ni con la interceptación de página ni con la de contexto. Al registrar todas las solicitudes, no aparecía ningún POST: Playwright no informa las solicitudes que hace una página mientras se descarga, y `sendBeacon` en `pagehide` sale justo entonces.

*Causa raíz.* El colector envía al ocultar la pestaña o al salir (`pagehide`), que es lo correcto en el navegador (P17: la herramienta no imita esa parte). La prueba confundió «no lo veo» con «no se envía».

*Arreglo.* La e2e detiene esa navegación con `preventDefault`, comprueba que el clic contó `tool.next_step` y dispara el envío como al ocultar la pestaña, igual que `sitio.spec.ts`. La navegación se prueba aparte. Queda pendiente verificar en staging que Analytics Engine recibe `tool.next_step` (HU-E2.6).

La regla: **antes de culpar al código porque una prueba no ve algo, se comprueba que la herramienta puede verlo. Lo que no puede, se prueba por otro camino y se anota qué falta verificar en el entorno real.**

*Ficha:* agro · *(mío)* · 🟢 Menor · P17, P5 · 0.1.0 · 2026-10-01

**19 · El dominio público servía staging, y el CI de `main` casi se pasa del tiempo.**

*Qué pasó.* El 1 oct 2026, después de fusionar HU-E4.1, el dueño escribió que «Cloudflare desplegó pero no se ve» y que el cuaderno no pedía actualizar. Al revisar, `agro.laboratorio-digital.com` y `agro-sitio-staging…workers.dev` servían los mismos archivos: el dominio estaba conectado a mano, en el panel de Cloudflare, al Worker de staging. El Worker de producción (`agro-sitio`) nunca se había desplegado, porque producción sale al publicar una versión y no había ninguna. Que no hubiera aviso de actualización era correcto: los dos PRs no tocaban el cuaderno y el `sw.js` era idéntico. El mismo día, el CI de `main` tardó 13 min 41 s de 15; 10,5 min fueron para instalar los navegadores de Playwright.

*Causa raíz.*
- El dominio: la configuración generada solo declara el dominio en producción, pero wrangler no quita un dominio que se agregó desde el panel; el despliegue a staging lo dejaba ahí sin decir nada. Consecuencias: lo fusionado a `main` salía al dominio público sin publicar versión, el primer despliegue a producción iba a chocar por el dominio, y cada dirección guarda sus propios datos en el teléfono (otro origen, otra base local).
- El CI: la clave de la caché de navegadores es el hash del lockfile, y en `main` solo valen las cachés creadas en `main`. Un lockfile nuevo (entró Hono) = sin caché = bajar Chromium y paquetes de Ubuntu, ese día con un espejo lento.

*Arreglo.* El dueño quitó el dominio del Worker de staging y se publica v0.1.0, cuyo despliegue a producción conecta el dominio a `agro-sitio`. La caché del CI agrega `restore-keys` para traer los navegadores de la corrida anterior aunque cambie el lockfile.

*Lo que falta.* Una guardia en el despliegue que falle si el Worker de staging tiene un dominio propio. Necesita leer los dominios de Workers con la API y comprobar antes que el token tiene ese permiso; queda para la siguiente historia de operación (HU-E8.2), para no agregar un rojo que no se ha visto funcionar (P19).

La regla: **lo que se configura en el panel y no en el repositorio no existe para el despliegue. Un dominio, una ruta o un secreto agregado a mano se anota aquí el mismo día y se pasa a la configuración, o se quita.**

*Ficha:* agro · *(dueño y mío)* · 🟠 Grave · P2, P16, P19 · 0.1.0 · 2026-10-01

**20 · La medición del Historial con CPU ×4 fallaba cuando había más pruebas en paralelo.**

*Qué pasó.* El 1 oct 2026, al agregar dos e2e pesadas de HU-E4.3 y E5.2, la prueba «90 días cargan en menos de 1 s con la CPU ×4» falló en 1 de 2 corridas completas (1.464 y 1.654 ms), y pasó siempre sola.

*Causa raíz.* Se comprobó antes de diagnosticar (P9): en el commit anterior, la suite pasó 3 de 3; con el código nuevo y sin las dos pruebas nuevas, también 3 de 3. El cambio de la app no la volvía lenta. La medición emula un teléfono lento frenando la CPU, pero corría al mismo tiempo que otras pruebas en los demás workers: medía la máquina ocupada además del teléfono. Dos pruebas más bastaron para pasar el umbral. El backlog decía que la cifra valía «también con toda la suite en paralelo»: era cierto con menos pruebas, y no era una garantía.

*Arreglo.* Las tres pruebas con CPU ×4 (Historial, abrir sin señal y LCP del sitio) llevan la etiqueta `@rendimiento` y corren en un proyecto aparte de Playwright, después de las demás y con un solo worker (`pnpm e2e`). El umbral no cambió.

La regla: **una prueba que mide tiempo corre sola. Si falla solo con otras pruebas al lado, se mide aparte; nunca se sube el umbral para que pase.**

*Ficha:* agro · *(mío)* · 🟡 Medio · P9, P17, P19 · 0.1.0 · 2026-10-01

**21 · La calculadora borraba lo escrito antes de cargar.**

*Qué pasó.* El 1 oct 2026 el CI de `main`, después de fusionar HU-E4.3/E5.2, falló en «Guardar en mi cuaderno»: al calcular, el resultado no apareció. El mismo código había pasado en el PR. Se reprodujo en local antes de diagnosticar (P9): 1 de 45 corridas con el código de `main`.

*Causa raíz.* La página de la calculadora trae los campos en el HTML estático (P20) y la isla Preact se activa después. Si la persona escribe antes de que cargue el JavaScript, Preact arranca con su estado vacío y deja los campos en blanco: lo escrito se pierde sin aviso. La prueba lo destapó de casualidad, al escribir apenas abría la página; en un teléfono con 3G lenta le pasa a una persona de verdad. Es P1 en la pantalla: un valor por defecto, el vacío, pisa lo que la persona escribió.

*Arreglo.* La isla toma como valor inicial lo que ya está escrito en sus campos. Una e2e retrasa a propósito el JavaScript de la isla 1,5 s, escribe antes y exige que los valores sigan y que se calcule; con el arreglo quitado, falla. Las pruebas de la calculadora pasaron 150 de 150 en 10 repeticiones.

La regla: **una isla que hidrata campos del HTML estático arranca con lo que ya tienen, no con su valor de fábrica. Toda isla con campos tiene una prueba que escribe antes de que cargue.**

*Ficha:* agro · *(mío)* · 🟠 Grave · P1, P20, P9 · 0.1.0 · 2026-10-01

**22 · Un registro nuevo se quedaba en el teléfono hasta recargar, y el otro teléfono decía que todo estaba en la nube.**

*Qué pasó.* El 1 oct 2026 el dueño probó HU-E5.3 en staging con dos navegadores. El registro nuevo de B no subió hasta recargar la página o tocar «Sincronizar ahora», aunque había internet. Mientras tanto, A decía «Todo está en la nube» y el registro de B le llegó varios minutos después.

*Causa raíz.* La sincronización corría al abrir la app, al volver la señal y cada 15 min (ARQUITECTURA §5.6). Guardar un registro no la disparaba: una persona que anota y guarda el teléfono deja el dato solo en el teléfono hasta 15 min, o hasta que vuelve a abrir la app. Las pruebas de HU-E5.2 subían con el botón o al vincular, nunca después de un registro nuevo con la app ya abierta. Y el texto «Todo está en la nube» hablaba de lo propio, pero se leía como si incluyera lo del equipo, que A solo revisa en su siguiente vuelta: afirmaba más de lo que sabía.

*Arreglo.*
- A los 3 s de guardar, si hay algo en la cola, el cuaderno sincroniza. Las escrituras de la propia sincronización no cuentan. Nunca sin señal ni antes de la espera que pidió la nube.
- Al volver a la app (`visibilitychange`), sincroniza, como máximo cada 30 s, para traer lo del equipo.
- El texto dice «Todo lo tuyo está en la nube. Lo del equipo se revisó a las hh:mm.».
- Las reglas están en `disparadores.ts`, con pruebas. Una e2e guarda un registro con la finca en la nube y exige que suba sin recargar; con el disparo quitado, falla.

La regla: **un dato nuevo sale del teléfono por sí solo, sin un gesto más. Y un estado dice de qué habla y desde cuándo: «lo tuyo» no es «lo de todos».**

*Ficha:* agro · *(mío)* · 🟠 Grave · P1, P15, P20 · 0.1.0 · 2026-10-01

**23 · Un error de la celda se le decía al operario como «sin señal».**

*Qué pasó.* El 1 oct 2026, escribiendo el caso 8 de la batería de caos (HU-E5.6, cuota de D1 agotada), el teléfono respondió «sin señal» cuando D1 rechazó la escritura. Había señal: la celda sí respondió.

*Causa raíz.* Ante un error inesperado, Hono responde un 500 con «Internal Server Error» en texto plano. El teléfono pedía y leía el JSON en el mismo `try`, y cualquier falla de ese bloque, incluida la de leer un texto que no es JSON, la contaba como falta de señal. Un error de la nube quedaba disfrazado de un problema del teléfono, y el operario habría buscado señal en vez de esperar (P15: el aviso no nombraba la causa). Ninguna prueba hacía fallar a la celda por dentro: todas usaban respuestas de error bien formadas.

*Arreglo.*
- La celda responde cualquier error inesperado con 503 en JSON, `estado: falla-celda` y `Retry-After`, y lo deja en el log (`app.onError`).
- El teléfono separa «no hubo respuesta» de «la respuesta no se pudo leer». Una respuesta buena cortada a mitad sigue siendo como no tenerla, y la cola no cambia (HU-E5.2, CA4). Un error que no es JSON se dice como error de la nube.
- Pruebas: un 500 en texto plano da «error», no «sin señal»; una base que falla da 503 «falla-celda»; el caso 8 de la batería lo cubre de punta a punta.

La regla: **pedir y leer son dos fallas distintas. Una causa que se adivina en un `catch` amplio termina siendo la equivocada.**

*Ficha:* agro · *(mío)* · 🟡 Medio · P15, P1, P17 · 0.1.0 · 2026-10-01

**24 · En «Cambiar cosechas» no se podía sumar una cosecha al lote, y el código `M-0110-1` se confundía.**

*Qué pasó.* El 1 oct 2026 el dueño probó HU-E6.2 en staging e informó tres cosas:
- No se podían agregar más lotes.
- Al cambiar el lote que había creado, no podía añadir otra cosecha.
- En el código del lote, el mes 10 se confundía: `0110` no se lee como «1 de octubre».

*Causa raíz.*
- Con «Cambiar cosechas» abierto, la misma cosecha libre salía en dos listas, «Cosechas sin lote» y la del lote, con el mismo `id` en su casilla. Tocar el texto de la cosecha marca la casilla del primer elemento con ese `id`, que es la de la otra lista. La e2e marcaba la casilla con `getByLabel` sobre la lista correcta, sin tocar el texto como lo hace una persona en el teléfono, y nunca abría las dos listas a la vez. Por eso no lo vio.
- Cuando todas las cosechas anotadas ya estaban en un lote, la pantalla no ofrecía nada para elegir y solo decía «No hay cosechas sin lote», sin decir por qué ni qué hacer. Para el dueño, eso era «no se puede agregar más lotes».
- `ddmm` pegado (`0110`) se lee como un número, no como una fecha.
- Además, un lote corregido saltaba al primer lugar de la lista, porque se ordenaba por la versión vigente y no por cuándo se armó.

*Arreglo.*
- Cada lista usa sus propios `id`, y la de «Cosechas sin lote» se esconde mientras se cambia un lote.
- Sin cosechas libres, la pantalla dice que todas ya están en un lote y lleva a Registrar.
- El código lleva el mes en letras: `M-01OCT-1`. Los códigos viejos de staging siguen siendo válidos.
- Los lotes se ordenan por su primera versión.
- Una e2e reproduce lo del dueño tocando el texto de cada cosecha: arma un lote, arma otro con una cosecha nueva y suma una cosecha a un lote ya armado. Sin el arreglo, falla.

Queda por confirmar con el dueño: si «agregar más lotes» quería decir partir una misma cosecha en varios lotes (hoy una cosecha entra entera en un solo lote).

La regla: **la e2e toca la pantalla como la toca la persona: el texto, no solo la casilla. Y una lista vacía dice por qué está vacía y qué hacer.**

*Ficha:* agro · *(mío)* · 🟡 Medio · P15, P16 · 0.1.0 · 2026-10-01

**25 · Una cuenta en dos fincas dejaba de sincronizar, y el teléfono decía que estaba vinculado.**

*Qué pasó.* El 1 oct 2026, después de probar invitaciones y roles en staging, el dueño informó que los registros ya no se sincronizaban entre teléfonos.

*Causa raíz.*
- El CORE pone la finca en el token solo si la persona tiene una sola o si la pide (HU-E4.2). Con invitaciones (HU-E4.4), una cuenta puede quedar en dos fincas: la suya y la que la invitó.
- Al volver a entrar con Google, el canje no pide finca, así que el token llega sin finca. El teléfono veía su finca en la lista de la cuenta y se daba por «vinculado», sincronizaba con ese token y la celda respondía 403 «sin organización» a cada envío.
- Al renovar, el teléfono pedía `sesion.org_id`, que era nulo, así que la sesión nunca se corregía sola.
- Las pruebas usaban siempre cuentas con una sola finca. El arnés de teléfonos simulados arma el token a mano con la finca puesta, y no pasa por el CORE.

*Arreglo.*
- `sesionDeLaFinca` (`vinculo.ts`) pide siempre la finca del vínculo del teléfono. Si la sesión es de otra finca, o no tiene ninguna, la renueva en ese momento aunque el access siga vigente.
- La usan la sincronización y Cuenta.
- Pruebas con una cuenta en dos fincas: con el access vigente y con el access vencido. Con la renovación forzada quitada, falla.

*Confirmado:* el dueño lo vio en su cuenta, que tenía dos fincas (entrada 26).

La regla: **un estado como «vinculada» se comprueba con lo que la nube va a recibir (el token), no con una lista que lo hace parecer posible. Y el arnés de pruebas no debe saltarse al servidor que arma ese token.**

*Ficha:* agro · *(mío)* · 🟠 Grave · P15, P16, P17 · 0.1.0 · 2026-10-01

**26 · Del celular al computador, lo nuevo llegaba solo con el botón.**

*Qué pasó.* El 1 oct 2026 el dueño confirmó el caso de la entrada 25: su cuenta tenía dos fincas («prueba1» y «celular») y, al elegir una, sincronizó bien. Pero también vio que los cambios del PC llegaban al celular casi de inmediato, y los del celular al PC solo tocando «Sincronizar ahora».

*Causa raíz.* El celular sube lo suyo a los 3 s de guardar (entrada 22). Pero un teléfono o computador solo baja lo del equipo al abrir, cada 15 min y al volver a verse (`visibilitychange`). En el celular, cambiar de app oculta la pestaña y al volver la muestra, así que cada regreso trae lo del PC. En un computador la pestaña casi nunca se oculta: pasar a otra ventana y volver no dispara nada. El arreglo de la entrada 22 se pensó y se probó solo en el teléfono.

*Arreglo.*
- Además de `visibilitychange`, el cuaderno revisa lo del equipo cuando su ventana recibe el foco y cuando la persona toca la página, como máximo cada 30 s.
- Si es muy pronto, no abre la base.
- La revisión automática sigue cada 15 min, para no gastar la cuota diaria de la nube (ARQUITECTURA §6.2).
- Una e2e con el reloj adelantado exige que el foco y el toque bajen lo del equipo, y que no lo hagan antes de 30 s. Sin los disparadores nuevos, falla.

La regla: **«volver a la app» no se ve igual en un teléfono que en un computador. Un disparador se prueba en cada tipo de equipo donde se va a usar.**

*Ficha:* agro · *(mío)* · 🟡 Medio · P16, P20 · 0.1.0 · 2026-10-01

**27 · El teléfono que perdía un conflicto se quedaba con su versión para siempre.**

*Qué pasó.* El 1 oct 2026, diseñando HU-E5.4, encontré que dos teléfonos que editan la misma área sin señal terminaban con datos distintos. Nadie lo había reportado: solo se nota al comparar los dos teléfonos.

*Causa raíz.*
- A y B editan la v1, y los dos suben su «v2».
- La celda aceptaba la primera que llegaba y guardaba la segunda en el historial como conflicto. Al teléfono que llegó segundo le respondía «aceptado» y su cola quedaba vacía.
- Al bajar, ese teléfono recibía la v2 del otro, con el mismo número que la suya. El teléfono ignora una versión igual a la que tiene (`local.version === datos.version`), así que conservaba la suya.
- Resultado: dos teléfonos de la misma finca con dos «v2» distintas, sin aviso.
- Las pruebas de HU-E5.2 y E5.3 miraban que la celda no perdiera ninguna versión, pero no que los dos teléfonos terminaran iguales.

*Arreglo (HU-E5.4).*
- La celda guarda la versión que gana con un número nuevo (la vigente + 1), así que todo teléfono la baja.
- La que pierde queda en el historial, y `reemplazo` dice de qué teléfono era.
- Ese teléfono lo avisa y ofrece volver a poner su cambio.
- La prueba de dos teléfonos ahora exige que, después de sincronizar, los dos tengan el mismo nombre y la misma versión.

La regla: **en una prueba de sincronización, la invariante no es «la nube no pierde nada», es «todos los teléfonos terminan iguales, y lo que no quedó está guardado y se dice».**

*Ficha:* agro · *(mío)* · 🟠 Grave · P1, P15, P16 · 0.1.0 · 2026-10-01

**28 · Imprimir una etiqueta de 5 × 5 cm sacaba 12 hojas.**

*Qué pasó.* El 1 oct 2026 el dueño imprimió la etiqueta QR de un lote y el PDF salió con 12 hojas.

*Causa raíz.*
- La hoja de estilo de impresión escondía el resto de la página con `visibility: hidden` y dejaba visible la etiqueta. `visibility` esconde, pero el elemento sigue ocupando su lugar, así que el navegador imprimió todo el alto de la página en hojas de 5 × 5 cm.
- La prueba de HU-E6.4 medía el tamaño de la etiqueta con `emulateMedia('print')`, pero no contaba las hojas del documento impreso. Medía una pieza, no el resultado.

*Arreglo.*
- «Imprimir» copia la etiqueta a un contenedor propio en la raíz de la página, y la impresión quita todo lo demás con `display: none`. Al terminar, se limpia.
- Una e2e genera el PDF y exige una sola hoja de 5 × 5 cm (142 × 142 puntos). Con el código anterior daba 10.

La regla: **lo que se imprime se prueba sobre el documento impreso: hojas y tamaño, no solo la caja en pantalla.**

*Ficha:* agro · *(mío)* · 🟡 Medio · P16, P17 · 0.1.0 · 2026-10-01

**29 · Puse fotos en el plan gratuito sin mirar la escalera, que ya las ponía en el plan Finca.**

*Qué pasó.* El 1 oct 2026, en HU-E3.11 (monitoreo), decidí por mi cuenta que el plan gratuito tuviera 30 fotos al mes. El dueño respondió «la foto puede ser algo premium» y después: «recuerda las premisas para el diseño y toma de decisiones». Y el 2 oct: «recuerda siempre validar tus implementaciones contra la arquitectura, el ecosistema y el estudio de mercado».

*Causa raíz.*
- ARQUITECTURA §2.4 (la escalera aplicada al producto) ya decía que las fotos son del peldaño Premium/Finca. Decidí la cuota mirando solo el presupuesto de R2 de §6.2, que es una razón técnica, sin mirar la de producto.
- No había un paso fijo para contrastar cada decisión con las premisas antes de escribirla. Revisaba la historia y sus criterios de aceptación, pero no lo que la historia no dice y otro documento sí.
- No es la primera vez: la entrada 1 de «Afirmaciones mías que resultaron falsas» tiene la misma forma, una propuesta hecha sin verificar el documento que la decidía.

*Arreglo.*
- Las fotos son del plan Finca (commit `674f600`). El plan llega en la sesión y un plan desconocido cuenta como el gratuito.
- Desde HU-E7.1, cada historia empieza contrastando la decisión con las tres fuentes, y el mensaje al dueño dice qué premisa la respalda o que ninguna la cubre:
  - **ARQUITECTURA**: las cinco decisiones de §0, la escalera de §2.4, los principios P de §3, la matriz de §9 y las cifras de §6.2.
  - **ED1**: costo cero, browser-first, utility-first, owner-first y budget-first, con la revisión [H1]–[H16].
  - **Estudio de mercado**: para quién es, qué duele y qué paga cada segmento.
- Lo que la historia decide distinto de lo escrito se anota en «Cambios de rumbo».

**Lo prueban** las pruebas de HU-E3.11: con el plan gratuito no se ofrece la foto. Una e2e lo exige y otra prueba el plan Finca. La regla de proceso no tiene control negativo automático; su control es esta entrada.

La regla: **una decisión de producto se valida contra el documento que la decide, no contra el que la hace posible. Primero la escalera y el estudio; después la cuota.**

*Ficha:* agro · *(mío)* · 🟡 Medio · P18, P20 · 0.1.0 · 2026-10-02
