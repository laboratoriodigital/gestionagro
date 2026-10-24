# El asistente de la finca: probarlo en staging

**Para qué:** conectar un asistente de inteligencia artificial de verdad (Claude o ChatGPT) al cuaderno de una finca de ensayo en staging, preguntarle por cada cosa que sabe responder y comprobar que con el plan gratuito, con el acceso quitado o con el interruptor apagado no lee nada. Es la aceptación con un cliente real que falta para encenderlo en producción (HU-C9.7, HC6; HU-E0.12).

**Toma:** unos 40 minutos, más la espera de hasta una hora para que la celda copie el plan.

## Lo que hay en staging

| Qué | Dirección |
|---|---|
| El cuaderno | <https://agro-sitio-staging.laboratoriodigital-la.workers.dev/agro/app/> |
| El asistente (MCP) | `https://agro-api-c0-staging.laboratoriodigital-la.workers.dev/mcp` |
| La cuenta y los permisos | <https://agro-core-staging.laboratoriodigital-la.workers.dev/> |

El asistente responde seis preguntas, todas de solo lectura: el calendario de carencias, lo último que se anotó, el costo por kilo, la bodega, el rendimiento de cada nave y las aplicaciones de un periodo. Solo para fincas con el plan Finca o superior.

## 1. Prepara la finca de ensayo

1. Abre el cuaderno de staging en el teléfono o en el computador.
2. Entra con tu cuenta de Google (en la bienvenida o en **Más → Cuenta**).
3. Si no tienes una finca de ensayo en staging, créala: «Finca Ensayo Uno», con dos naves, por ejemplo **Nave 1** de 600 m² y **Nave 2** de 400 m². En **Más → Cuenta**, toca **Subir mi finca a la nube**.
4. Anota lo que el asistente va a leer:
   - **Más → Áreas:** inicia un ciclo de tomate en la Nave 1, con las plantas.
   - **Más → Insumos:** un insumo con carencia y reentrada (por ejemplo 3 días y 4 horas).
   - **Más → Costos → Registrar una compra o un ajuste:** una compra de ese insumo con su precio.
   - **Más → Personas:** una persona con su valor de jornal.
   - **Anotar → Aplicaciones:** una aplicación de ese insumo en la Nave 1, con la cantidad usada.
   - **Anotar → Labores:** una labor de 4 horas en la Nave 1, con la persona.
   - **Anotar → Cosecha:** una cosecha en kg en la Nave 1, con algo de descarte.
5. Espera a que la cabecera diga **Sin registros pendientes**: todo subió a la nube.

## 2. Dale el plan Finca

En el cuaderno de staging, **Más → Cuenta → Ver los planes → Finca**, y paga un mes con el Bold de pruebas. Si prefieres no pasar por Bold, usa el flujo **registrar-pago-en-efectivo** de GitHub con el ambiente de staging.

La celda copia el plan de cada finca en su vuelta de cada hora. Espera hasta una hora antes del paso 4. Mientras no lo tenga, el asistente responde que viene con el plan Finca, y eso también sirve como prueba (paso 5).

## 3. Conecta el asistente

**Con Claude** (claude.ai, en el computador):

1. **Configuración → Conectores → Agregar conector personalizado.**
2. Nombre: `CultivoPro staging`. URL: `https://agro-api-c0-staging.laboratoriodigital-la.workers.dev/mcp`.
3. Toca **Conectar**. Claude se registra solo y abre la pantalla de permisos de la cuenta de staging.
4. Entra con el mismo Google, elige **Finca Ensayo Uno** y revisa lo que pide: «Leer los registros de tu finca y lo que sale de ellos: carencias, costos, bodega y rendimiento. No puede cambiar nada.»
5. Toca **Permitir**. Vuelves a Claude con el conector activo.

**Con ChatGPT:** si tu plan permite conectores personalizados (en la configuración, con el modo de desarrollador), crea uno con la misma URL y autenticación OAuth. El resto es igual. Los nombres de los menús cambian seguido: si no los encuentras, usa Claude.

## 4. Pregúntale (una pregunta por cada cosa que sabe)

En una conversación nueva, con el conector encendido:

| Pregunta | Lo que debe responder |
|---|---|
| «¿Qué nave puedo cosechar hoy en mi finca?» | La Nave 1 en carencia hasta el día que diga el cuaderno en **Carencias**; la Nave 2, que se puede |
| «¿Qué se anotó esta semana?» | La aplicación, la labor, la cosecha y lo demás, sin lo que corregiste |
| «¿Cuánto me costó el kilo de tomate en este ciclo?» | La misma cifra de **Más → Costos → Costo por kilo**. Si falta un precio, dice «al menos» |
| «¿Qué insumo se me va a acabar?» | Lo que queda del insumo, lo usado en 30 días y para cuántos días alcanza |
| «¿Qué nave rindió más por metro cuadrado?» | Las cifras de **Más → Rendimiento**, con la mejor nave primero |
| «Resúmeme las aplicaciones de los últimos seis meses» | Cada aplicación con fecha, nave, producto, dosis, carencia, reentrada y quién aplicó |

Compara cada cifra con la pantalla del cuaderno: deben ser iguales, porque salen de las mismas cuentas. Si alguna no coincide, copia la pregunta y la respuesta y mándamelas.

## 5. Lo que no debe pasar

1. **Sin plan Finca:** antes de que la celda copie el plan, o en otra finca con el plan Gratis, cualquier pregunta debe responder que el asistente viene con el plan Finca, sin dar datos.
2. **Acceso quitado:** abre tu cuenta de Laboratorio Digital de staging, <https://agro-core-staging.laboratoriodigital-la.workers.dev/> (no la pantalla «Cuenta» del cuaderno: desde ella, el enlace **Abrir mi cuenta** lleva ahí). Entra con el mismo Google y, en **Asistentes con acceso**, toca **Quitar acceso** junto a Claude. La siguiente pregunta debe fallar con «Quitaron este acceso», sin datos.
3. **Interruptor apagado:** apaga `ks:agro-mcp` en staging (`docs/runbooks/kill-switch.md`). En un par de minutos el asistente debe decir que está en pausa, y el cuaderno sigue igual. Vuelve a encenderlo.
4. **Pedirle que anote:** «Anota un riego de 1.000 litros en la Nave 2.» Debe decir que no puede: solo lee.

## 6. Cuéntame cómo fue

Con lo que pase, anoto la aceptación en HU-C9.7 y HU-E0.12. Si todo sale bien, el siguiente PR enciende el servidor de permisos en producción (`servidorOAuthActivo` del CORE) y quita el «Pronto» de la landing (`ASISTENTE_EN_PRODUCCION` en `apps/sitio/src/landing/contenido.ts`). Luego se conecta con `https://mcp.cultivopro.co/mcp`.
