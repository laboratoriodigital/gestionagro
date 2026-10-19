# Revisión de seguridad de la Tienda antes del primer cobro real (19 oct 2026)

HU-T11.11 (TIENDA-3.0 §14.1; análisis de integración §8). Antes de guardar llaves de Bold y datos de compradores de un comercio real, se revisó lo construido de T0 a T14 contra la tabla de amenazas del diseño, buscando los huecos. Es el sistema propio del dueño. Se revisó el código y se probó en local, con el D1 de workerd; nada contra producción ni contra una cuenta de Bold real.

## Alcance

| Superficie | Qué se miró |
|---|---|
| API de la celda (`apps/tienda-api`) | Quién llega (el secreto del despacho), de qué tienda es cada consulta, los permisos del panel, las rutas públicas y sus límites, los avisos de Bold, el cobro, los links, las llaves, los respaldos y las rutas del despliegue |
| Despacho (`apps/tienda-sitio`) | Resolución por `Host`, cabeceras internas, redirecciones, la vitrina de releases viejas, CSP |
| Panel (`apps/tienda-panel`) | Dónde se muestra lo que escribe otro, las llaves en el teléfono, la entrada reciente |
| Horno (`packages/tienda-horno`) | Escapado, enlaces permitidos, lo que nunca se hornea |
| Scripts del operador y flujos | `restaurar.ts`, `simulacro-de-restauracion.ts`, `carga-de-staging.ts`, `fotos-de-la-carga.ts` y sus flujos a mano |
| Dependencias | `pnpm audit --prod` |

## Hallazgos

| # | Severidad | Hallazgo | Estado |
|---|---|---|---|
| 1 | Media | **El tope de cobros abiertos no aguantaba la concurrencia.** Se contaba antes del lote: con 100 cobros a la vez quedaron 101 abiertos, y cada uno aparta unidades 15 minutos. | **Remediada** (bitácora tienda3 33). Se cuenta dentro del lote. Lo prueba `caos.test.ts`, con su control negativo. |
| 2 | Media | **Los avisos de Bold no tenían tope por IP.** Un aviso «de pruebas» lo firma cualquiera (Bold firma con la llave vacía), y cada uno lee D1 antes de descartarse. Mandados sin parar gastarían el día de lecturas de D1 de toda la cuenta, que ya se agotó dos veces (bitácora tienda3 26 y 29). | **Remediada.** `LIMITE_AVISOS`: 60 por minuto por IP, antes de leer el cuerpo; Bold reintenta un 429. Lo prueba `avisos.test.ts`. |
| 3 | Media | **Una tienda podía cobrar de verdad con la franja «en pruebas» a la vista.** Pasar a producción en los ajustes cambiaba el cobro antes de publicar. | **Remediada** en HU-T11.3: el cobro usa el ambiente de la versión publicada (`cobros.test.ts`). |
| 4 | Media | **Una release nueva de la vitrina dejaba sin estilos ni JavaScript a todas las tiendas horneadas con la anterior** (disponibilidad, no confidencialidad). | **Remediada** en HU-T4.6: las releases viejas se sirven 90 días desde el almacén (`releases.test.ts`). |
| 5 | Alta (no llega a los Workers) | **Dependencias del build:** `source-map-js` (GHSA-68fv-2mgg-jv7q, por vite) y `http-cache-semantics` (por astro), las dos con versión corregida. | **Remediada** con `overrides` en `pnpm-workspace.yaml`; `pnpm audit --prod` sin hallazgos, y los builds del panel y de la cuenta funcionan. |
| 6 | Media | **Agotar la cuota desde lo público con muchas IP.** Los límites por IP de la API frenan a una IP; muchas IP, no. Es el hallazgo 4 de la revisión del 3 oct, que sigue pendiente. | **Pendiente (configuración del dueño), antes de la primera tienda real.** La regla de *Rate limiting* de la zona (una gratis): `/api/v1/*` en `*.laboratorio-digital.app`, 60 solicitudes en 10 s por IP, bloquear 10 minutos. |
| 7 | Baja | `/api/salud` es público por el panel: dice si las bases responden, cuántos comercios de prueba hay, el ambiente y el estado de las tareas. Ningún secreto ni dato de una tienda. | **Riesgo aceptado.** Es la prueba de humo del despliegue. |
| 8 | Baja | El secreto del despacho también protege las rutas del despliegue (`x-ensayo`, `x-despliegue`): quien lo tenga puede publicar a los comercios de prueba en staging y subir una release. Lo tienen solo los Workers y el despliegue. | **Riesgo aceptado.** Rotarlo es el paso de `docs/runbooks/secretos-de-la-tienda.md`. |

Ningún hallazgo alto queda abierto en lo construido (CA2). Lo que todavía no existe tiene su historia antes del alta abierta (M4): ver la tabla siguiente.

## La tabla de amenazas de TIENDA §14.1, contra lo construido

| Amenaza | Lo construido | Lo prueba | Estado |
|---|---|---|---|
| Una tienda lee datos de otra | El `org_id` sale del token o de `x-tienda`, nunca del cuerpo; FK compuestas con `org_id` | `tests/repo/org-id-en-consultas.test.ts` (toda consulta, con sus excepciones razonadas), `panel.test.ts` y las pruebas con los dos comercios de prueba | Cubierta |
| Alguien finge ser el despacho | Sin el secreto del despacho, la API responde 404; el despacho y el panel borran las cabeceras internas que llegan de afuera | `worker.test.ts` de los tres Workers | Cubierta |
| XSS guardado | Markdown sin HTML, solo enlaces `https`, `mailto`, `tel` y `wa.me`; todo escapado; CSP sin `unsafe-inline`; la compuerta rechaza lo que va en línea | `escapar.test.ts` (corpus de cargas), `compuerta.test.ts`, `tienda-presupuestos.spec.ts` | Cubierta |
| Robo de la sesión del comercio | Tokens del CORE por producto; entrada reciente para lo que mueve plata, el WhatsApp y los datos de compradores; registro | Pruebas del CORE; `panel-colaborador.test.ts`; `llaves-de-bold.test.ts` (pegar llaves pide entrada reciente) | Cubierta |
| Fraude con tarjetas desde la tienda | Checkout de Bold; límites por IP; tope de cobros abiertos atómico; monto mínimo y tope por tienda | `cobros.test.ts`, `caos.test.ts`, `carga-de-staging.ts` | Cubierta en el código; **la regla de la zona falta** (hallazgo 6) |
| Vaciar el inventario a punta de apartados | 15 minutos de vida; tope por tienda (en el lote) y por IP; los links aparta quien administra | `caos.test.ts`: la última unidad entre 50 y 100 cobros a la vez | Cubierta |
| Webhook falso | HMAC sobre el cuerpo crudo, comparación de WebCrypto; un aviso de pruebas solo mueve cobros de pruebas; tope por IP | `avisos.test.ts` (vectores con llave real y vacía, otro ambiente, tope) | Cubierta |
| Fuga de la llave secreta de Bold o de datos personales | Sobres con AAD; la KEK fuera de la base; ni logs ni respuestas; el respaldo lleva los sobres cifrados y no lleva las credenciales | `llaves-de-bold.test.ts` (CA4: respuestas, registro, logs, lo cifrado y lo horneado), e2e del panel (teléfono y consola), `respaldos.test.ts` | Cubierta |
| Toma de subdominios | Las direcciones de la plataforma las pone el despliegue; no hay dominios propios todavía | — | **Pendiente: HU-T13.1 y HU-T13.6 (M4)**, antes de que un comercio conecte su dominio |
| Tienda fraudulenta | Términos con la prohibición (HU-T7.2), ficha legal antes de publicar, «Reportar esta tienda» en el pie, kill switch por tienda (`ks:tienda:<org>`) | `terminos.test.ts`, `compuerta.test.ts`, `worker.test.ts` del despacho | Parcial: **la suspensión con un clic y su simulacro son HU-T13.6 (M4)** |
| Un sitio clonado cambia los datos de la transferencia | No se hornean ni salen por la API pública | `publicar.test.ts` | Cubierta |
| Cuenta de Cloudflare o GitHub comprometida | Tokens por propósito: el de despliegue sin R2; el de métricas de solo lectura | Revisión trimestral (dueño) | Configuración del dueño |
| Inyección de instrucciones a agentes | No hay agentes todavía | — | **Pendiente: M7** (PLATAFORMA §5.7) |

## Lo que se probó y está bien

- **Las rutas nuevas de este sprint:**
  - términos y custodia: solo el propietario y solo la huella vigente;
  - llaves: comprobadas con Bold y nunca devueltas;
  - links: la dirección que da Bold se exige `https`;
  - la vitrina de releases viejas: solo nombres de archivo de la vitrina, sin `..`;
  - el despliegue de la release: con un segundo secreto en su cabecera.
- **Las redirecciones del despacho** van solo a la ficha de un producto de la misma tienda: nunca a otro origen.
- **El SQL de la restauración** valida cada nombre de columna antes de escribirlo y escapa cada valor; una columna que no es un nombre se rechaza (`tienda-restaurar.test.ts`).
- **Los correos** no ponen direcciones en sus registros de error.
- **Los scripts del operador** que hablan con la cuenta corren en flujos a mano, con el ambiente `staging`, y la carga solo acepta las direcciones de los comercios de prueba.

## Lo que hace el dueño

1. La regla de *Rate limiting* de la zona (hallazgo 6), antes de la primera tienda real.
2. Las recomendaciones de la revisión del 3 oct que sigan pendientes: la aprobación de colaboradores externos en Actions, los revisores del ambiente `produccion` y el repositorio privado.
