# Análisis: integración de la Tienda al ecosistema digital

_4 de octubre de 2026. Mirada de arquitecto de nube y de soluciones, pedida por el dueño. Contrasta la Tienda 2.0 (`laboratoriodigital/tienda`, «Tienda Panel», 1.0.0), su documento de traslado a la 3.0 (`tienda/docs/TRASLADO-3.0.md`) y su plan de flota (`PLAN-4.0.md`) con ED1 (`docs/ECOSISTEMA-DIGITAL-ED1-v1.2.md`) y con la arquitectura de CultivoPro (`docs/ARQUITECTURA.md`), que ya corre en producción con cuentas, pagos y varias fincas._

_Ajustado el 5 de octubre de 2026 con la validación del estudio de mercado de ecommerce (`VALIDACION-ESTUDIO-MERCADO-ECOMMERCE-ED1-2026-10.md`, en esta carpeta). Cada cambio lleva la etiqueta de su hallazgo, por ejemplo **[V6]**._

> **Puesto al día el 5 oct 2026, tras las decisiones del dueño.** Este análisis recomendó; el diseño ya está escrito:
> - `docs/arquitectura/PLATAFORMA.md`: el CORE con dimensión de producto, las cuentas, los agentes y el repositorio.
> - `docs/arquitectura/TIENDA-3.0.md`: el producto, con su modelo de datos probado.
>
> Lo que cambia frente a este análisis:
> - **§6:** el monorepo de la plataforma es **este repositorio renombrado**, no uno nuevo con la historia movida (PLATAFORMA §6.1; ADR-26).
> - **§4.3 y §8:** Bold sí tiene **webhooks firmados**, y la Tienda 3.0 los usa como camino principal (TIENDA-3.0 §9.4).
> - **La Tienda 3.0 se diseña desde cero:** la migración de la 2.0 deja de ser un requisito de diseño y pasa a scripts de carga (TIENDA-3.0 §17).
> - **La 2.0 tiene dos tiendas en operación** (dato del dueño).

## Conclusión, primero

**Sí conviene llevar la Tienda a esta arquitectura, pero como Tienda 3.0 construida sobre la plataforma del ecosistema, no como un traslado del código de la 2.0.**

- La 2.0 se queda viva, con correcciones, hasta que la 3.0 pueda migrar una tienda sin perder pedidos, rastreos ni dominio.
- La 3.0 es la opción **B** que su propio equipo ya puso sobre la mesa (TRASLADO-3.0 §6, D1 y D2): **una base multi-comercio en Cloudflare y un solo despliegue, donde cada tienda es una fila, no un repositorio.**

**Por qué:**

1. **Las siete causas de dolor de la 2.0 son, casi una por una, lo que esta arquitectura ya resolvió y probó** (tabla de §3). No hay que inventarlo: hay que reutilizarlo.
2. **El techo que no se compra.** Las 30 ejecuciones simultáneas por cuenta de Google y el «una cuenta de Google por tienda» no escalan como negocio. N cuentas con contraseñas, dos pasos y recuperación es un pasivo operativo que crece con cada venta.
3. **ED1 lo pide así** (§3.5 *One ecosystem*, §5.2–5.3 CORE con autenticación y pagos con adaptador, §23.3.1 monorepo para CORE y SaaS), y CultivoPro ya construyó la primera versión de cada pieza.
4. **El modelo de negocio mejora.** Dar de alta una tienda pasa de «crear cuenta de Google + repositorio + secretos + Worker + pegar el stub» a «crear una fila y apuntar un dominio».

**Lo que cuesta:** reconstruir el panel del comerciante (la 2.0 ya lo tiene completo), un proveedor de correo, y un camino de migración probado. Es un proyecto de varios meses, no un fin de semana. Por eso va por hitos, y la 2.0 sigue vendiendo mientras tanto.

## 1. Las dos arquitecturas, lado a lado

| Dimensión | Tienda 2.0 (hoy) | CultivoPro / ED1 (hoy) |
|---|---|---|
| Unidad de despliegue | **Una por tienda**: hoja + Apps Script + repositorio + Worker | **Una por celda**: un Worker de API para muchas organizaciones, con datos en shards de D1 (ADR-6) |
| Base de datos | Google Sheets (tope de 20.000 filas de pedidos, 30 ejecuciones simultáneas, 6 min por ejecución) | D1 (SQL, migraciones versionadas, transacciones); `org_id` en cada fila |
| Identidad | Usuario y clave del panel por tienda, con huella y sal | **CORE** compartido: Google, sesiones con refresh rotado, membresías y roles, tokens Ed25519 verificados en cada celda sin llamar al CORE (ADR-9, ADR-10) |
| Página pública | Estática, horneada por tienda en Actions, servida por Workers Static Assets: costo por visita cero | Igual (Astro estático + islas), y con CSP por ruta |
| Pagos | Bold por tienda, llaves en las propiedades de su script | Bold detrás de un **adaptador** en el CORE (ED1 §5.3), conciliación por Cron, el pago con su producto y su proveedor |
| Medición | Contrato de eventos propio; GA4 o píxel opcionales | Analytics Engine, eventos agregados por producto y reporte semanal |
| Actualizar | Semilla → N repositorios por anillos, con un `semilla.lock` por tienda (PLAN-4.0 §3) | **Una** versión publicada una vez, por celdas y anillos (`celdas.json`), con publicación continua al fusionar |
| Secretos | Por tienda (propiedades del script, `CLASPRC`, `DISPARO_TOKEN`…) | Por ambiente de GitHub, cargados al Worker por stdin; nada por cliente |
| Operación | Panel de tiendas en una hoja del operador, que pregunta a cada maestro | Vigía de cuota, alertas por Telegram, kill switch por producto, reporte semanal |
| Pruebas | ~2.600 aserciones con un emulador de Apps Script (`gas.js`) | ~1.250 pruebas unitarias contra D1 local real (`getPlatformProxy`) y ~200 e2e en un teléfono de 360 px con accesibilidad |

## 2. Lo que la 2.0 hace muy bien y la 3.0 debe conservar

No todo es cambiar. Estas ideas de la Tienda son mejores que lo que hay en CultivoPro, o igual de buenas, y entran tal cual:

- **El catálogo horneado:** las visitas cuestan cero; el backend solo valida, registra y cobra.
- **El horneado determinista:** mismo dato, mismo archivo.
- **Contratos que solo crecen** (R1), y la hoja leída por nombre de columna.
- **Apartar las unidades antes de cobrar**, y el pago que se consulta, no se cree.
- **El rastreo con un secreto aparte.**
- **Los textos legales generados con los datos de la empresa:** sin ellos no se publica.
- **La compuerta pequeña**, con invariantes sobre lo desplegado y no sobre la suite de desarrollo.
- **Volver atrás en tres capas**, con simulacro.
- **La guía del comerciante en una página.**

Y los **contratos de datos** de TRASLADO §7 (producto, combinación, estados del pedido, ~56 claves de configuración, eventos) son el puente de la migración. CultivoPro ya los usa: el CSV de disponibilidad del cuaderno sale con las columnas del Catálogo de la Tienda.

## 3. Las siete causas de dolor y lo que ya está resuelto aquí

| # | Causa en la 2.0 (TRASLADO §4) | Lo que ya existe en CultivoPro / ED1 |
|---|---|---|
| 1 | Un código por tienda, desplegado N veces | Celdas multi-tenant: una versión se publica una vez. Dar de alta una finca es una fila en el CORE (ADR-6) |
| 2 | El que se actualiza a sí mismo corre su versión vieja | El despliegue lo hace un sistema aparte (`desplegar.yml` → `desplegar-destino.yml`) con el commit exacto; la PWA avisa de la versión nueva sin perder trabajo (HU-E3.1) |
| 3 | La suite de la semilla como guardia de producción | Compuerta = CI más la prueba de humo del despliegue sobre lo desplegado (P16) |
| 4 | Cuatro permisos que se pisan | Secretos por ambiente (staging y produccion), comprobación del token al empezar cada despliegue, inventario en ARQUITECTURA §7.5 atado por prueba |
| 5 | Fallar rápido esconde el fallo siguiente | El despliegue por celdas informa qué celda quedó sin tocar; las pruebas de repositorio informan todos los hallazgos de una vez |
| 6 | Google Sheets como base de datos | D1 con migraciones, índices, `org_id` y transacciones en batch |
| 7 | El instrumento mentía (`gas.js`) | Pruebas contra D1 local real y e2e en un navegador real, siempre con dos fincas de prueba de datos distintos (P4) |

## 4. La arquitectura propuesta para la Tienda 3.0

```
                         tienda-de-ana.co · …   (sin dominio propio: un dominio aparte, nunca uno del ecosistema [V10])
                                              │ (dominios propios: Cloudflare for SaaS)
 Comprador ──► Worker del sitio de tiendas ── assets estáticos (estilos y scripts, iguales para todas)
               │  fichas y catálogo de SU tienda: HTML y JSON horneados en R2 [V6],
               │  con caché de CDN → costo por visita ≈ 0
               │  validar · registrar · cobrar · rastrear
               ▼
          API de celda «tienda» (Hono) ─── D1 shard: productos, combinaciones, pedidos, cupones,
               │   org_id en cada fila           envíos, configuración, pagos (sin datos de tarjeta)
               │   verifica el token del CORE sin llamarlo (Ed25519)
               │
 Comerciante ─► Panel PWA (/tienda/panel/) ──► CORE (el del ecosistema)
                                               identidad · organizaciones · roles · planes ·
                                               pagos (adaptador: Bold) · directorio org → celda
```

### 4.1 Qué se reutiliza tal cual

| Pieza del ecosistema | Uso en la Tienda 3.0 |
|---|---|
| **CORE** (`apps/core`) | El comerciante y su colaborador entran con el CORE. La tienda es una organización de tipo `tienda`. Roles: propietario y colaborador. Los planes y su vencimiento ya existen (`plan`, `plan_vence`). **[V9]** No basta con agregar un tipo. Hoy el esquema fija con `CHECK` los tipos (`finca`, `asesor`, `cadena`), los planes, los roles y el producto de cada pago (`agro`), y la vuelta del login y del pago solo acepta `/agro/app/`. Darle la dimensión de producto a la organización, el plan y el rol es una migración planeada, porque SQLite no cambia un `CHECK` sin rehacer la tabla: expandir, migrar y contraer (ARQUITECTURA §7.4) |
| **Tokens Ed25519, celdas y shards** (`packages/tokens`, `packages/d1`, `celdas.json`) | Celdas de tiendas en la misma cuenta (ADR-7: escalar pagando) o en una dedicada para un cliente grande (ADR-8). El directorio dice en qué celda vive cada tienda |
| **Despliegue por celdas y anillos** (`scripts/desplegar.ts`) | Las tiendas piloto en el anillo 1 y el resto en el 2, por configuración. Reemplaza la flota, `semilla.lock` y los N repositorios |
| **Kill switch, vigía de cuota, Telegram, reporte semanal** | Igual, con el producto `tienda` |
| **Eventos y Analytics Engine** (`packages/eventos`) | El contrato de la Tienda (`ver_producto` … `pago_confirmado`) entra como otro producto: la decisión 35 de la Tienda ya proponía esto |
| **Adaptador de pagos** (`proveedor-de-pago.ts`) | Se generaliza: hoy cobra con las llaves del ecosistema (CultivoPro vende sus planes); la Tienda cobra con **las llaves de cada comercio**. Ver §4.3 |
| **CSP por ruta, cabeceras, guardas de flujos, revisión de seguridad** | Igual. El script de Bold solo como `script-src` declarado en la política, como en el cuaderno |
| **Marca, `content/*.json` como única fuente, pruebas de coherencia** | El patrón P2, con sus guardas |

### 4.2 Qué hay que construir (no existe en ninguno de los dos)

1. **El catálogo horneado por tienda, sin un repositorio por tienda.** Al publicar en el panel, la API escribe `catalogo.json` y las fotos derivadas en R2, con una clave por tienda y versión. El Worker del sitio los sirve con caché de CDN. Las visitas siguen sin tocar D1. Es el horneado de la 2.0 hecho en el servidor y no en Actions; ya no hay minutos de Actions por tienda.
   - **[V6]** Se hornea también el HTML de cada ficha, con su JSON-LD (`Product`/`Offer`) y su Open Graph. Sin eso, Google y la vista previa de un enlace en WhatsApp ven una página sin producto (ED1 §12; P20, «el rastreador que no ejecuta JavaScript»).
   - El Worker resuelve la tienda por el `Host` y entrega ese HTML. Lo común (estilos y scripts) sigue como asset estático gratuito.
2. **Dominios propios a escala.** *Cloudflare for SaaS* (hostnames personalizados), que ED1 §14.1 ya prevé. Un dominio del comercio apunta a nuestro Worker, y el Worker resuelve qué tienda es por el `Host`. Sin tocar el DNS de nadie más que el suyo.
   - **[V10]** Las tiendas sin dominio propio van en un dominio registrable separado de los del ecosistema, nunca como subdominio de `cultivopro.co` ni de `laboratorio-digital.com` (ED1 §14.1). Una tienda fraudulenta no puede arrastrar la reputación de los dominios del ecosistema.
   - Con eso van los términos de uso, el reporte, `abuse@` y la suspensión con un clic.
3. **El panel del comerciante** (paridad con la 2.0): productos con variantes y fotos, pedidos y estados, ajustes por grupos, cupones, envíos, tablero, colaborador. Es el trabajo más grande. Se hace como PWA Preact, como el cuaderno, con sus mismos componentes (`packages/ui`).
4. **Fotos:** comprimir en el navegador y subir a R2 (ADR-15 de CultivoPro), en vez de Drive → Actions → webp. Más rápido para el comerciante y sin pasos de servidor.
5. **Correo transaccional** (ED1 §20.2): el «correo del día», la confirmación de pago, el aviso de pedido. Hoy lo da Gmail del script (100 al día por cuenta). Hace falta un proveedor con capa gratuita y SPF, DKIM y DMARC del dominio que envía.
6. **Entrar sin Gmail.** El comerciante de una panadería puede no tener Gmail. ED1 §5.2 prevé el enlace mágico por correo, y depende del punto anterior.
7. **Importar y exportar la hoja.** La 3.0 lee el CSV y el XLSX de una hoja 2.0 por nombre de columna (contratos de §7) y la exporta igual. El comercio conserva la «propiedad y confianza» que hoy le da su hoja (TRASLADO D1) sin que la hoja sea la base de datos.

### 4.3 Los pagos: el punto que cambia de verdad

En CultivoPro **el vendedor es Laboratorio Digital**: una sola cuenta de Bold, con llaves en los secretos del CORE. En la Tienda **el vendedor es cada comercio**: cada uno tiene su Bold, y el dinero entra a su cuenta, no a la nuestra. Eso pide:

- **Llaves por organización, cifradas en D1.** Cifrado de sobre: una llave maestra (KEK) en los secretos del Worker, que cifra la llave de cada comercio (AES-GCM, `crypto.subtle`). Nunca en texto plano, nunca en el navegador; la de identidad solo viaja dentro de un cobro ya firmado, como hoy.
- **El adaptador recibe las llaves en cada llamada**, en vez de leerlas del entorno: `proveedorBold(llavesDe(org), fetch)`. Es un cambio pequeño en `proveedor-de-pago.ts`.
- **Apartar las unidades antes de cobrar** (lo que la Tienda hace con `LockService`) pasa a ser una fila con vencimiento en D1. La conciliación por Cron de CultivoPro, cada 15 min, la libera si nadie pagó.
- **Responsabilidad:** con el dinero en la cuenta del comercio, Laboratorio Digital no es el vendedor ni maneja fondos de terceros. Conviene dejarlo escrito en los términos (TRASLADO D5).

## 5. Las tiendas nuevas: cómo nace una con este modelo

| Paso | Tienda 2.0 (hoy) | Tienda 3.0 sobre el ecosistema |
|---|---|---|
| Cuenta | Crear una cuenta de Google nueva, con contraseña, dos pasos y recuperación | **Ninguna.** El comerciante entra con el CORE |
| Código | Clonar la semilla a un repositorio nuevo; flujos y secretos por tienda | **Ninguno.** Es una fila: la organización y su configuración |
| Backend | Publicar `maestro.gs` y pegar el stub en la hoja | Nada: la API de la celda ya atiende a todas |
| Sitio | Un Worker por tienda, conectado a su repositorio | El mismo Worker; un hostname personalizado si trae dominio propio |
| Actualizar | Repartir la versión a N repositorios por anillos | Una publicación por celda; la tienda la recibe sin hacer nada |
| Tiempo de alta | ~30 min medidos con la plantilla (PLAN-4.0 §1), más cuentas y secretos | Minutos, y casi todo lo hace el comerciante en el panel |
| Darla de baja | Borrar repositorio, Worker y cuenta, y conservar la hoja | Exportar su hoja, desactivar la organización y retirar el hostname |

Para el negocio, la diferencia es la que decide: **vender una tienda más deja de costar horas de montaje**, y el precio puede bajar o el margen subir.

## 6. Repositorios: dónde vive cada cosa

ED1 §23.3.1 pide un **monorepo privado para CORE, Admin y SaaS**. La forma de llegar sin romper lo que ya funciona:

1. **Hoy:** el CORE vive en `gestionagro`, y está bien (bitácora: «el CORE nace aquí», ARQUITECTURA §14 HA3). Un solo consumidor no justifica mudarlo (regla de tres, ED1 §3.11).
2. **Cuando arranque la Tienda 3.0 (el segundo consumidor):** se crea el monorepo de la plataforma (p. ej. `laboratoriodigital/plataforma`) con `apps/core`, `packages/` (tokens, d1, kill-switch, eventos, ui, sync), `scripts/` de despliegue y los verticales como apps: `apps/agro-*` (CultivoPro) y `apps/tienda-*`. Se **mueve** con su historial (`git filter-repo`), no se copia. Los nombres `agro-core` y `agro_core` pasan a `core` con una migración de nombres planeada (la base D1 no se renombra: se crea la nueva y se copia).
3. **La 2.0 y la Tienda Básica** quedan en sus repositorios hasta migrar. Las tiendas migradas no necesitan repositorio propio.

Un repositorio por vertical, que consuma paquetes publicados, solo conviene cuando un vertical necesite otro ritmo de versión o un equipo aparte. Hoy, con un solo operador, el monorepo es más barato: un CI, un despliegue y una sola fuente de los contratos.

## 7. Costos, en órdenes de magnitud

Cifras de la página de precios de Cloudflare a la fecha; se verifican antes de decidir y se miden con el vigía de cuota.

| | 10 tiendas | 100 tiendas | 500 tiendas |
|---|---|---|---|
| Workers Paid (una cuenta; ya está en ADR-7 para la celda) | USD 5/mes | USD 5/mes | USD 5–15/mes |
| D1 (pedidos y catálogo; visitas fuera de D1) | dentro de lo incluido | dentro de lo incluido | dentro de lo incluido |
| R2 (catálogos y fotos webp: ~50 MB por tienda) | gratis | gratis (~5 GB) | ~USD 0,4/mes |
| Cloudflare for SaaS (dominios propios) | gratis (100 incluidos) | gratis | ~USD 40/mes por 400 de más |
| Correo transaccional | capa gratuita | capa gratuita o ~USD 20/mes | ~USD 20–35/mes |
| **Cuentas de Google por tienda** | 10 cuentas que administrar | 100 | 500 (inviable) |
| **Repositorios y minutos de Actions** | 10 repos | 100 | 500 |

La 2.0 cuesta USD 0 en infraestructura, pero su costo real es tiempo de montaje y de cuentas, que crece en línea recta con cada tienda. La 3.0 cuesta unos pocos dólares al mes, casi fijos, y el tiempo por tienda nueva tiende a cero.

## 8. Riesgos y cómo se cubren

| Riesgo | Mitigación |
|---|---|
| Rehacer el panel tarda más de lo previsto | Hitos con valor propio (TRASLADO §10): M1, la tienda pública, ya puede vender por WhatsApp con el catálogo importado de la hoja. La 2.0 sigue mientras tanto |
| Todo queda en un solo proveedor (Cloudflare) | Plan de salida de ED1 §20.3: exportación portable (`agro-export` ya existe; se hace `tienda-export`), respaldo semanal de D1 a R2 (HU-E8.4, pendiente) y la lógica en paquetes independientes del runtime |
| El comerciante extraña su hoja | Importar y exportar por nombre de columna; un «descargar todo» en el panel; la misma promesa que el cuaderno: tus datos son tuyos |
| Llaves de pago de terceros en nuestra base | Cifrado de sobre, rotación de la KEK, auditoría de accesos y nunca en logs. Revisión de seguridad antes del primer cobro real (como la del 3 oct 2026) |
| Una tienda con picos (campañas) afecta a otras | Shards por celda y anillos; una tienda grande puede tener celda dedicada en su cuenta (ADR-8); límite de solicitudes por tienda en el Worker |
| Migrar sin perder rastreos ni dominio | M6 de TRASLADO: tienda 3.0 en paralelo, comparación automática con la 2.0, y el dominio se apunta solo cuando coinciden |

## 9. Lo que se puede integrar ya, sin migrar nada

Sirve mientras la 3.0 se construye:

1. **CultivoPro → Tienda:** el CSV de disponibilidad ya sale con las columnas del Catálogo. El paso siguiente es un **feed firmado**: la celda agro publica `disponibilidad.json` de una finca, firmado con su llave de QR (que ya existe), y el maestro de la tienda del productor lo lee en el montaje en vez de importar el CSV a mano.
2. **Marca y sitio principal:** `laboratorio-digital.com` como vitrina de los dos productos, con enlaces cruzados. Las calculadoras de CultivoPro traerán tráfico cuando pasen la revisión agronómica y se indexen. Hoy siguen en borrador, y su demanda medida es pequeña (`docs/validacion/busquedas-2026-12.md`).
3. **Medición común:** que la Tienda 2.0 mande sus eventos agregados al mismo Analytics Engine (decisión 35 de la Tienda), para un solo reporte semanal del ecosistema.
4. **Aprendizaje compartido:** las bitácoras de ambos repositorios ya se citan entre sí (patrones P1–P21). Conviene una lista común de patrones del ecosistema.

## 10. Qué tiene que decidir el dueño

1. **D1 y D2 de la Tienda 3.0:** aceptar la opción B (base multi-comercio y un despliegue) como base de la 3.0. Es la recomendación de este análisis.
2. **Cuándo arranca la 3.0** frente a lo que falta en CultivoPro: respaldo semanal, revisión agronómica y prueba real en la finca cero. Recomendación: después de que CultivoPro tenga su primera temporada de uso real. Así el CORE llega a la Tienda probado con usuarios. **[V1] [V8]** Y con una condición medible, no solo de calendario: las métricas de §16.3 del estudio de ecommerce (`ESTUDIO-MERCADO-ECOMMERCE-ED1-2026-10.md`), es decir, pago real, soporte por comercio, retención y cobro confiable. Se toman en los comercios reales de la línea, con los umbrales fijados antes de medir.
3. **Proveedor de correo transaccional:** lo necesitan los dos productos (aviso de vencimiento del plan en CultivoPro, correo del día en la Tienda).
4. **Términos de la Tienda:** quién responde si una actualización tumba una tienda (TRASLADO D5) y la aclaración de que el dinero va a la cuenta de Bold del comercio.
5. **El monorepo de la plataforma:** crearlo al arrancar la 3.0, no antes.

## 11. Lo que NO se recomienda

- **Trasladar `maestro.gs` a un Worker línea por línea.** Arrastraría el modelo de una cuenta y un despliegue por tienda, que es la causa 1.
- **Mantener la hoja como base de datos detrás de la nueva API** (opción C de TRASLADO). Dos fuentes de verdad (P2): la peor de las tres opciones.
- **Abrir cuentas gratuitas de Cloudflare por tienda para tener más cuota.** Lo prohíben los términos de Cloudflare §2.2.1 (ADR-7, hallazgo HA1 para ED1).
- **Mudar el CORE a otro repositorio antes de que exista el segundo producto que lo usa.**
