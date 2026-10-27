# Registro de cambios del Parqueadero ED1

Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/). Versión semántica propia del parqueadero en `apps/parqueadero-sitio/package.json`, con etiquetas `parqueadero-vX.Y.Z` (HU-Q0.3, PLATAFORMA §6.3). Hasta la `0.0.0` vivió solo en staging; la `0.1.0` es la primera en producción, en su dominio (HU-Q5.2), con la que opera el primer cliente. Lo que cambia `apps/parqueadero-*` o `packages/parqueadero-*` se anota aquí en el mismo PR; la guardia del CI lo exige. Los paquetes compartidos que nacieron con el parqueadero (`@ed1/impresion`, `@ed1/whatsapp`) se anotan en el `CHANGELOG.md` de la raíz.

## [Sin publicar]

## [0.9.2] - 2026-10-27

El teléfono del parqueadero sube a la nube aunque otro haya entrado antes sin subir nada.

### Corregido
- Una caja que entró a la nube y en una hora no subió nada ya no le cierra el paso a la que trae el parqueadero: «Subir este parqueadero» la reemplaza y la caja conserva su serie y sus números. Con algo ya arriba, la regla de siempre: un teléfono nuevo se suma vacío (HU-Q13.9, bitácora 44).

## [0.9.1] - 2026-10-27

La placa se lee de lejos en el recibo.

### Cambiado
- En el papel de la entrada, la salida y la mensualidad, la placa sale en negrita, al doble de alto y de ancho y centrada, con el vehículo al lado (HU-Q13.8). Reemplaza la línea «Placa … Carro»: el recibo crece una sola línea. Una placa muy larga va sola y el vehículo debajo.

## [0.9.0] - 2026-10-23

El operador sin Google entra a la caja con un enlace a su correo.

### Agregado
- «Cuenta y nube» deja entrar con un enlace al correo del operador, para quien no tiene Google (HU-C10.2, HU-Q7.6), con los mismos términos aceptados.

## [0.8.0] - 2026-10-19

El recibo de salida en papel puede salir solo si lo piden, y la impresora ya no saca después lo que la caja dio por perdido.

### Agregado
- Ajustes › «¿Y el recibo de salida?» (HU-Q13.7): «Igual que el de entrada» (como siempre) o «En papel solo si lo pide». A pedido, el recibo de salida no se imprime solo; sigue en la pantalla, por WhatsApp y con «Imprimir». El de entrada no cambia.

### Corregido
- Un recibo que la caja dio por no salido podía imprimirse después, cuando la impresora volvía (bitácora 43). Ahora, al dejar de esperarla, la caja corta lo que faltaba por mandar.

## [0.7.2] - 2026-10-14

Las entregas pendientes se ven y bajan.

### Corregido
- La señal «entregas pendientes» de la cabecera solo subía (bitácora 42, HU-Q13.6). Ahora se toca y muestra los recibos que no salieron por la impresora, cuántas veces y por qué. «Abrir para imprimir» abre el recibo para imprimirlo otra vez, y sale de la lista cuando el papel sale o el conductor lo escanea en pantalla. «Quitar de la lista» quita los que ya se entregaron de otra forma.

## [0.7.1] - 2026-10-14

La mensualidad se cobra con su fecha y su valor, y la lista dice quién debe.

### Corregido
- Después de «No cobrar ahora», «Cobrar mensualidad» cobraba el mes siguiente entero: otra fecha y otro valor (bitácora 40, HU-Q13.5). Ahora cobra primero lo que falta pagar de la vigencia, con su prorrateo.
- La lista de abonados y su detalle dicen «Al día hasta el …», «Debe desde el …» o «Venció el …», cada uno con su color.
- El cobro de la mensualidad muestra el detalle del prorrateo: los días de cada tramo sobre los del mes y lo que vale.
- Dos mensualidades cobradas en el mismo minuto: «Anular la mensualidad» anula la última, la que llega más lejos.

## [0.7.0] - 2026-10-14

La mensualidad puede ir del 1 al último día del mes.

### Agregado
- Los meses de la mensualidad, de fecha a fecha o del 1 al último día (HU-Q13.4): Ajustes › «Los meses de la mensualidad van». Del 1 al último día, el abonado nuevo vence el último día del mes, una mensualidad contratada a mitad de mes cobra esos días en proporción (calendario u hábiles, según Ajustes) y el mes siguiente se cobra entero. Por omisión sigue de fecha a fecha, como siempre.

## [0.6.0] - 2026-10-14

Lo que pidió el primer parqueadero ya operando: la hora como la lee, los domingos y festivos, y la mensualidad por días hábiles.

### Agregado
- La hora militar o con a. m. y p. m. (HU-Q13.1): Ajustes › «Cómo se escribe la hora». La usan las pantallas de la caja, el papel, el WhatsApp, la pantalla del recibo y su enlace, el cierre de turno y el recibo de la mensualidad.
- La tarifa de domingos y festivos (HU-Q13.2), opcional, para el carro y la moto: «Por minuto en domingos y festivos» y «Día completo en domingos y festivos». Cada minuto vale según el día en que empieza; los festivos son los de Colombia. El recibo, el aviso de tarifas y la página del recibo la muestran.
- La mensualidad por días calendario o hábiles (HU-Q13.3): Ajustes › «Una mensualidad empezada cobra». Con días hábiles, una mensualidad empezada cobra los lunes a viernes que no son festivo que cubre, sobre los del mes entero.

## [0.5.0] - 2026-10-13

M1 en producción: la cuenta, la nube, varias cajas y el pago del plan, en la caja del cliente.

### Agregado
- La cuenta y la nube en producción (HU-Q7.12): Más › «Cuenta y nube» entra con Google, sube el parqueadero con todo lo de la caja (sus números siguen siendo suyos), suma otras cajas con su propia serie, y lo de cada caja sube y baja solo, sin cortar una venta. La celda c2 del parqueadero queda en producción, con su API, su base y su llave de recibos: los recibos se firman y `/r/` los verifica.
- En producción también: la copia en el Google Drive de la cuenta, con las fotos de los vehículos; los términos de la nube; y pagar el plan con Bold desde «Cuenta y nube».

### Cambiado
- El plan Parqueadero cuesta COP 29.900 al mes por sede (precio del dueño, 13 oct 2026): COP 85.000 el trimestre, 161.000 el semestre y 299.000 el año.

## [0.4.1] - 2026-10-13

El escáner lee el recibo con menos lucha, antes de entrar en operación.

### Corregido
- Escanear el recibo costaba en la puesta en marcha. La cámara mira con más resolución y enfoque continuo si el teléfono lo tiene, unas ocho veces por segundo, y lee también el cuadro guía del centro, donde un QR de papel pequeño pesa más. La pantalla muestra ese cuadro, y la linterna aparece si el teléfono la tiene. El QR que se imprime en el recibo pasa de unos 28 mm a unos 36 mm (bitácora 39).

## [0.4.0] - 2026-10-13

La caja de la presentación al cliente: la operación simple, sin turnos si el parqueadero trabaja así, y una caja que vuelve arriba al cambiar de pantalla. En producción, la cuenta, la nube y el pago del plan siguen apagados: llegan con M1, en la `0.5.0`.

### Cambiado
- Operación simple para el cliente que trabaja sin turnos: una sede nueva empieza en «Sin turnos» y una existente puede elegirlo en Ajustes después de cerrar el turno abierto. Se registra, cobra y anula con los mismos controles, sin aperturas ficticias; Reportes resume el día y permite descargar CSV. Las sedes antiguas conservan sus turnos. El inicio prioriza entrada, escaneo y vehículos adentro; la administración queda en «Más opciones». La placa usa el teclado del teléfono o PC, foto y WhatsApp son opcionales, y el efectivo exacto se cobra dejando «Recibido» vacío, como explica el campo.

### Corregido
- Al cambiar de pantalla, la caja vuelve arriba para que los botones principales queden a la vista. Si el navegador bloquea compartir el respaldo, se descarga el archivo; cancelar el diálogo conserva la cancelación (bitácora parqueadero 38).

### Agregado
- El cobro del plan por periodo (HU-Q7.10), en staging: «Cuenta y nube» dice el plan del parqueadero y hasta cuándo sigue la nube, y el propietario paga 1, 3, 6 o 12 meses con Bold; al volver, el CORE confirma el pago y la caja sigue sincronizando con el plan nuevo. La cabecera avisa cuando el plan vence pronto o está en los días de gracia. Con el plan vencido o el gratuito, la nube queda en pausa y lo dice; la caja sigue registrando, cobrando e imprimiendo. La política de la cuenta pasa a la versión 3: Bold como aliado para pagar.

## [0.3.0] - 2026-10-12

La caja con la que se entrega el primer parqueadero: más clara, el recibo como recibo, el aviso de tarifas, los abonados con su mensualidad, los reportes del día y lo que ahorra, y las herramientas gratuitas del sitio. Las fotos ya se borran del teléfono a los 30 días de la salida. En producción, la cuenta, la nube, la copia en Drive y la firma del recibo siguen apagadas: llegan con M1, en la `0.4.0`.

### Agregado
- Las fotos de los vehículos van con la copia al Google Drive de la cuenta (HU-Q8.3), en staging: al tocar «Guardar copia en mi Google Drive» suben las que falten a «Caja del parqueadero · fotos · caja A», y las que el teléfono borró a los 30 días se borran también allá con la copia siguiente. Si las fotos no suben, la copia queda guardada y la caja lo dice aparte. Los términos de la nube pasan a la versión 2, que dice adónde van las fotos.
- El liquidador gratuito de mensualidades (HU-Q11.6): `/herramientas/mensualidad-de-parqueadero/` calcula, sin cuenta, cuánto cobrar por una mensualidad que empieza a mitad de mes (hasta fin de mes, en proporción a los días) o por varios meses completos, con la cuenta de cada periodo y lo que vale un día. Usa `liquidarMensualidad` de `@ed1/parqueadero-tarifas`, la misma cuenta de la caja, y una tabla de casos compartida lo comprueba en los dos lados. Sin valor, o en cero, no da total y dice qué falta. Termina con «Lleve los abonados en su teléfono».
- Los cupos para vehículos eléctricos (HU-Q11.7): `/herramientas/cupos-para-electricos/` da, con los cupos del parqueadero, el mínimo que pide la Ley 1964 de 2019 (art. 7: el 2 %, hacia arriba para no quedar por debajo) y dice si su municipio está obligado. La norma, su texto citado, el Decreto 191 de 2021 sobre la señalización y la fecha de consulta (9 oct 2026) viven en `content/parqueadero/cupos-electricos.json` y se ven en la página.
- La portada lista las tres herramientas gratuitas en el orden de la demanda medida (HU-Q11.1), y `llms.txt` y los gemelos en Markdown las incluyen.
- Las mensualidades se cobran en la caja (HU-Q8.4). En «Abonados», tocar un abonado muestra su vigencia y su último pago, y «Cobrar mensualidad» cobra el periodo siguiente (o desde hoy, si venció) en efectivo, QR o transferencia, o datáfono, con su recibo numerado como los de entrada y salida, en papel. El cajero lo cobra sin el PIN, dentro del turno, y su efectivo entra al cierre. Cada abonado tiene plan de un mes o de una quincena; un abonado nuevo se cobra enseguida o se deja si ya pagó en el talonario, y un periodo más corto, como «solo hasta fin de mes», se cobra proporcional a sus días. Arriba de la lista salen las mensualidades que vencen en los próximos 5 días, y la entrada de un abonado que vence pronto dice «recuérdeselo». La caja no guarda el WhatsApp del abonado. Una mensualidad se puede anular con el PIN, y deja de contar.
- Lo que ahorra el parqueadero (HU-Q8.6): Más › «Lo que ahorra» dice, para esta semana, la pasada, este mes y el pasado, cuántos recibos salieron en papel, por WhatsApp y en la pantalla, cada uno contado una vez por el camino que llegó, y el papel ahorrado en recibos y en porcentaje. Con «Costo de cada recibo en papel», un campo opcional nuevo de Ajustes sin valor de fábrica, lo dice también en pesos; sin él no muestra pesos y lleva al campo. Sale de las entregas anotadas, sin teléfonos ni textos, y cuadra con los eventos que la caja cuenta para el sitio.
- Los reportes del día (HU-Q8.5): Más › «Reportes» muestra, para el día que se elija, los turnos de todas las cajas que el teléfono tiene (con la nube, todas las del parqueadero), cada uno con sus entradas, salidas, cobros por medio de pago, efectivo esperado, contado y diferencia con su motivo, y las anulaciones y copias de cada cajero. Cada turno cuenta igual que su cierre impreso, y es del día en que abrió. «Descargar para Excel» lo baja en CSV. Con un turno abierto o un registro del día en cuarentena en la nube, arriba dice que los totales son parciales y por qué. Con la cuenta, el cajero ve solo los turnos de su caja.
- El generador gratuito de recibo de entrada (HU-Q11.4): `/herramientas/recibo-de-entrada/` hace, sin cuenta, el recibo de entrada de un vehículo con los datos del parqueadero, su tarifa, el número de su talonario, la placa y el estado del vehículo, con la misma hoja de la caja. Se imprime por el diálogo del sistema (en papel sale solo la hoja) o se manda por WhatsApp con el número y la autorización del conductor. Sin un dato legal no sale, y dice todo lo que falta. El recibo dice al pie «Hecho con el generador gratuito de Parqueadero ED1. No es un recibo de caja.», no lleva serie de caja ni enlace a `/r/`. Los datos del parqueadero y el número siguiente se recuerdan en ese navegador; la placa y el WhatsApp del conductor no. Termina con «Lleve la caja en su teléfono».
- La portada del sitio (HU-Q11.5): `/` dice en una página qué es la caja, con «Abrir la caja» y las herramientas gratuitas, y tiene su gemelo en Markdown (`/index.md`) y `llms.txt` para los agentes, con el texto en un solo lugar (`src/sitio/contenido.ts`). La herramienta cuenta `tool.opened`, `tool.completed`, `tool.shared` y `tool.next_step` en un lote a `/_m`, que el Worker del parqueadero ahora también acepta, sin datos personales. Ninguna página pública carga nada de otro origen.
- El recibo verificado (HU-Q8.2), en staging: con su certificado, la caja firma el enlace completo de cada recibo de su serie, sin red, y `/r/` lo verifica con la llave de la celda que lleva dentro, sin pedir nada. Firmado y vigente dice en verde «Verificado: emitido por <parqueadero> desde la caja A»; firmado cuando el certificado ya había vencido, en ámbar «Emitido con un certificado vencido»; con un carácter cambiado, en rojo «Este recibo fue modificado»; sin firma, como los de siempre, «Copia digital del recibo.». El QR del papel sigue siendo el corto; el firmado va por WhatsApp y en el QR de la pantalla.
- Cada caja tiene su llave de firma (HU-Q8.1), en staging: al sincronizar, la caja genera una llave Ed25519 que no se puede sacar del teléfono y la nube le da un certificado con su serie que vale 30 días y se renueva solo en la última semana. Una caja retirada ya no lo recibe. «Cuenta y nube» dice si los recibos salen firmados y hasta cuándo, y si el navegador no puede firmar, que salen sin firma, como copia digital.
- La copia de la caja en el Google Drive de la cuenta (HU-Q10.1), en staging, como la del cuaderno de CultivoPro: Más › «Respaldo» › «Guardar copia en mi Google Drive» pide a Google el permiso para la carpeta «Caja del parqueadero · respaldos» y sube ahí el mismo archivo de «Descargar respaldo», directo de la caja a la cuenta de Google de quien lo pide; se conservan las 8 más recientes y cuenta como respaldo en la cabecera. «Traer una copia de mi Google Drive» lista esas copias y une la elegida a la caja con la misma revisión de «Restaurar», que no borra ni reemplaza nada. El permiso dura una sola copia y nunca se guarda. La política de las cuentas del parqueadero pasa a la versión 2 (borrador) para decir que la caja se conecta a Google Drive solo en ese momento. En producción no aparece hasta que el CORE la publique.
- Los términos de la nube (HU-Q7.11), en staging: antes de «Entrar con Google», «Cuenta y nube» dice qué sube a la nube (registros, placas, turnos y ajustes) y qué no sale del teléfono (el número del conductor y las fotos), con los términos y el contrato de transmisión de datos a un toque (`content/parqueadero/privacidad/terminos.json`, borrador para revisión de abogado). Sin marcar la casilla no se entra. La caja guarda la versión y la hora en que se aceptaron y la nube las anota en la fila de la caja. Una caja con cuenta sin la versión vigente queda en pausa (la cabecera dice «Nube en pausa: acepte los términos»), sigue registrando y cobrando, y los pide de nuevo; la nube tampoco la atiende. Con cuenta, el aviso de privacidad ya no dice «Sus datos no salen de este teléfono»: dice que los registros y las placas se guardan también en la nube, y que el número de celular no sale.
- La caja entra con la cuenta y sube el parqueadero a la nube (HU-Q7.6), solo en staging: Más › «Cuenta y nube» › «Entrar con Google» (la cuenta del ecosistema, con el producto parqueadero). Una caja con lo suyo ofrece «Subir este parqueadero a la nube»: el parqueadero se crea en la cuenta, la caja conserva su serie A y sus números, y todo lo que guardó sube solo, de a poco, con los mismos ids. Solo cuando la nube tiene lo mismo que la caja dice «verificado». Un respaldo de `v0.2.0` restaurado en un teléfono nuevo se sube igual. Salir de la cuenta no borra nada. En producción la caja no muestra la cuenta hasta HU-Q7.12.
- Varias cajas en un parqueadero (HU-Q7.7), en staging: un teléfono vacío entra con la cuenta y «Sumar esta caja a» el parqueadero le da la siguiente serie (B, C…) y le baja los ajustes y los vehículos adentro. Quien administra ve las cajas con su serie y su último número y puede retirar una perdida: la nube ya no le recibe ni le da nada, su sesión de la cuenta se cierra y lo que registró sigue valiendo con su serie. Runbook nuevo: `docs/runbooks/parqueadero-retirar-caja.md`.
- El respaldo en la nube (HU-Q7.9), en staging: con la caja en la nube, «Respaldo» dice desde cuándo está todo allá, la cabecera cuenta esa fecha como el último respaldo y el cierre de turno deja de pedir el archivo. «Descargar todo el parqueadero» arma el mismo archivo de siempre con lo de todas las cajas, después de subir y bajar, y dice si tiene todos los registros de la nube.
- La caja sincroniza con su celda sin cortar una venta (HU-Q7.5), en staging. Cada registro y cada cambio de Ajustes entran a una cola en la misma escritura que los guarda; la caja los sube en segundo plano al abrir, al volver la señal, a los pocos segundos de registrar y cada 2 minutos, y baja lo de las otras cajas de la sede, que también se cobra desde esta. La cabecera suma una señal: «Todo en la nube», «Enviando a la nube…» o «N en este dispositivo», con «sin señal», «entre de nuevo» o «la nube pidió esperar» cuando aplica, y lo que la celda no aceptó se ve con su motivo, sin borrarse de la caja. Cada caja ve solo su turno. La CSP de staging deja conectarse a la API de la celda; la de producción sigue sin conexiones hasta que la celda se publique (HU-Q7.12). Una caja sin cuenta, como la de hoy, no cambia: no llena la cola ni muestra la señal hasta entrar con la cuenta (HU-Q7.6).
- El aviso de tarifas y derechos para la entrada (HU-Q11.3): inicio › «Aviso de tarifas» arma, con los datos de Ajustes, el letrero que el conductor ve antes de dejar el vehículo: el parqueadero con su NIT, dirección y teléfono; la tarifa de cada vehículo con las mismas líneas del recibo y el tiquete perdido; los medios de pago que el parqueadero marca; sus derechos (texto en `content/parqueadero/aviso-tarifas.json`, pendiente de revisión de abogado); su texto de responsabilidad, la póliza si la tiene y «Pida su recibo por WhatsApp.». Se imprime en hoja carta u oficio y siempre en una sola hoja: si no cabe, la letra baja. Sin los datos legales o sin tarifa no sale, y dice qué falta.
- La celda del parqueadero ya tiene API, en staging (HU-Q7.4): `parqueadero-api-c2-staging` recibe lo que una caja sube y le devuelve lo de las otras cajas de su sede, con el token del CORE para el parqueadero. Un reenvío no duplica; un número de recibo repetido, una serie que no es de la caja o un permiso que el rol no tiene van a cuarentena con su motivo, y el resto del envío entra. Con `ks:parqueadero` apagado responde que la sincronización está en pausa. La caja de hoy no cambia: todavía no se conecta (HU-Q7.5).
- El modelo de datos del servidor ya es una migración de verdad (HU-Q7.2): `infrastructure/migraciones/parqueadero/0001_parqueadero_v1.sql`, aplicada en staging a la base de la celda c2, con sus 56 comprobaciones en el D1 local. La caja de hoy no cambia: sigue sin red ni cuenta.
- La caja ya tiene con qué sincronizar cuando llegue la cuenta (HU-Q7.3): `@ed1/parqueadero-schema/sync` valida lo que una caja subirá a su celda con el mismo protocolo del cuaderno (`@ed1/sync`, que ya no sabe de fincas). La caja de hoy no cambia: sigue sin red ni cuenta.
- Quién puede qué en un parqueadero, como dato (HU-Q7.8): propietario, administrador y cajero, con la tabla de PARQUEADERO §11.2 en `@ed1/parqueadero-schema/sync`. El cajero registra, cobra y reimprime; anula solo lo suyo y en los primeros 10 minutos; no cambia tarifas, datos legales ni textos del recibo. La celda decidirá con ella cuando exista su API (HU-Q7.4) y la caja la usará cuando tenga cuenta (HU-Q7.6). La caja de hoy no cambia: el PIN de administrador sigue protegiendo lo mismo.

### Cambiado
- La caja, más clara y sobria (HU-Q6.5). El inicio pone primero «Nueva entrada» y los vehículos adentro, cada uno en una fila con su placa, la hora y el tiempo corriendo; el turno es una línea, y Ajustes, Abonados, Respaldo y el aviso de privacidad van en una lista al final. Las cuatro señales de la cabecera ocupan dos líneas: lo que está bien va en gris y solo lo que falla toma color. «Anular» queda al final de la pantalla, en rojo y sin caja, y después de imprimir «Reimprimir» ya no compite con «Nueva entrada». Los campos de a dos quedan alineados aunque una etiqueta ocupe dos líneas. Ningún botón cambió de nombre.
- El recibo se ve como recibo (HU-Q6.6). En la caja y en el enlace `/r/`, una hoja: el parqueadero arriba con su NIT, dirección y teléfono; «Recibo de entrada» o «de salida» y el número grande; la placa amarilla; las horas, la tarifa o el cobro en grupos; el total grande con el medio de pago, y el texto legal al pie. El tiempo se dice en horas y minutos, con los minutos cobrados. El mensaje de WhatsApp trae el nombre del parqueadero en negrilla y las filas alineadas en letra de máquina, como el papel; el enlace sigue en su propia línea.

### Corregido
- Las fotos de los vehículos se borran del teléfono 30 días después de la salida, y «Respaldo» lo dice: antes se quedaban para siempre y con los meses llenaban el teléfono (bitácora 36). Las de los vehículos que siguen adentro no se tocan.
- El cierre de turno ya no cuenta como entregado por WhatsApp un recibo que el cajero marcó «No se envió»: ese recibo cuenta como sin entrega anotada, o por el camino que sí llegó.
- En staging, una caja en la nube que bajó un cambio de Ajustes hecho en otra caja ya no falla al hacer el respaldo, «Descargar todo el parqueadero» o la copia en Drive: el archivo acepta las versiones anteriores que vienen de la nube (`<id>@v1`). En producción no pasaba, porque la caja todavía no sincroniza.
- En modo oscuro, los botones salen en el azul de la caja y no en el lila del ecosistema (bitácora 27).
- Un vehículo que entró antes de corregir la tarifa en Ajustes sigue cobrándose con la tarifa con que entró, como lo dice su recibo; ahora la salida lo explica («Entró cuando el tope por día era de $1…») en vez de pedir que se revise Ajustes otra vez. Los que entran después pagan con la tarifa nueva.

## [0.2.0] - 2026-10-08

El recibo de entrada puede decir lo que dice el talonario del parqueadero.

### Agregado
- El texto de responsabilidad del recibo de entrada lo decide el parqueadero: Ajustes › «Texto de responsabilidad del recibo de entrada» trae la sugerencia de la ley («El parqueadero responde por el vehículo (Ley 1480, art. 18)») y se puede cambiar por el del talonario, de hasta 200 letras, como «Después de 45 días el parqueadero no se hace responsable del vehículo». Sale en el papel, en la pantalla y en el enlace de la entrada; vacío, vuelve la sugerencia. Los enlaces de siempre siguen iguales; el de una entrada con texto propio es la versión 2 del formato, que `/r/` ya lee (HU-Q4.5).

## [0.1.1] - 2026-10-08

La tarifa ya no puede dejar las salidas en $0 sin explicación: era un tope por día de $10 en Ajustes.

### Corregido
- Un tope por día o un valor del día completo menor que una hora de la tarifa ya no se guarda: Ajustes dice que es menos que una hora y pide el máximo en pesos por 24 horas, como 15.000. Un tope por día de $10 dejaba toda salida en $0.
- Una salida en $0 dice por qué, bajo el total: la gracia («Salió dentro de los 5 minutos de gracia: no paga»), el tope por día, el redondeo hacia abajo o una tarifa que da $0.

## [0.1.0] - 2026-10-08

La primera versión en producción, en `parqueadero.laboratorio-digital.app/caja/`: la caja con la que opera el primer parqueadero. Lo impreso ya no lleva la marca PRUEBA.

### Agregado
- Recibos por canal, sin datos personales: la caja cuenta los recibos en papel, por WhatsApp, en pantalla y las copias; las impresiones que fallan, con la impresora y la causa (también «No salió»); los respaldos y los cierres de turno. Sin red, los guarda en el teléfono; con red, los manda en un lote al sitio, que los anota en Analytics Engine sin placa, número, nombre ni IP. El sitio corre un Worker solo para recibirlos (`/_m`); todo lo demás sigue siendo estático (HU-Q5.3).
- Imprimir con el diálogo de impresión del equipo: en un PC con Windows y la PT-210 por USB, o con cualquier impresora instalada, el asistente ofrece «Usar el diálogo de impresión». El recibo sale en una hoja de 48 mm con los mismos datos que el papel térmico, su QR y la marca PRUEBA en staging. Con el acceso directo de Chrome de la puesta en marcha (`--kiosk-printing`), sale sin ver el diálogo. La caja lo recuerda al abrir. Un navegador sin Bluetooth, salvo el iPhone, lo propone desde el primer paso (HU-Q2.5).
- La aceptación del MVP en cada cambio: una prueba recorre un turno entero con el teléfono sin red, en los dos parqueaderos de prueba (con póliza y sin ella): apertura, entrada con su recibo impreso y su enlace de WhatsApp, salida con cambio, anulación, cierre impreso y respaldo. También comprueba que una versión nueva no recarga la caja mientras imprime y que dos entradas a la vez nunca salen con el mismo número. Corre en el CI de cada PR (HU-Q6.3).
- Abonados por placa: en «Abonados», el administrador agrega con su PIN la placa, una referencia, la vigencia y el valor de la mensualidad. Al entrar, la placa de un abonado vigente se marca con «Abonado hasta». Al salir, no paga, el medio es «abonado» y el recibo dice hasta cuándo. Un abono vencido se cobra como visitante y la caja lo dice; si venció mientras el vehículo estaba adentro, se cobra desde ese día. La caja no guarda el WhatsApp del abonado (HU-Q3.11).
- La dirección propia del parqueadero: la caja y los recibos viven en `parqueadero.laboratorio-digital.app`, con conexión segura, y el nombre queda reservado para que ninguna tienda lo tome. Los buscadores pueden encontrar la página del parqueadero, pero nunca la caja ni los recibos de los conductores. Se publica con la primera versión, la de la demostración (HU-Q5.2).
- La impresora emparejada: si la impresora ya está emparejada en los ajustes de Bluetooth del teléfono o del PC, el asistente ofrece «Usar la impresora emparejada», y desde entonces la caja la encuentra sola cada vez que abre, sin elegirla otra vez. En un navegador que no puede, el botón no aparece (HU-Q2.4).
- Menos papel sin dejar a nadie sin recibo: en Ajustes, el recibo en papel sale «Siempre, al registrar» o «Si no lo recibe por WhatsApp o QR». Con la segunda, el recibo pregunta «¿Recibo por WhatsApp o en papel?» con WhatsApp primero, y al terminar imprime si el conductor no lo recibió por WhatsApp ni escaneó el QR; «No se envió» también imprime. No existe la opción de no imprimir nunca. Las sedes que ya tenían el ajuste anterior lo conservan (HU-Q4.3).
- Los topes de cada ciudad: la caja conoce el tope legal de Bogotá (desde el 30 de enero de 2026, $230 por minuto para carros, $161 para motos y $10 para bicicletas; con sello de oro, $253, $177 y gratis). Una tarifa de una sede en Bogotá no puede declarar un tope mayor, y los ajustes dicen cuál es y qué norma lo fija. Si el tope de la ciudad tiene más de 13 meses, el inicio avisa «El tope de Bogotá no está actualizado» y la caja sigue cobrando. Los topes llegan con cada versión nueva de la caja (HU-Q1.2).
- La hora del teléfono, revisada: con internet, la caja compara su hora con la del sitio al abrir, cada 30 minutos y al volver la señal. Si está corrida más de 2 minutos, la cabecera lo dice en rojo («La hora del teléfono está 7 min atrasada: corríjala»); la caja nunca la cambia sola, porque de esa hora sale lo que se cobra (HU-Q3.8).
- Respaldo y restauración: «Respaldo» guarda todo lo de la caja en un archivo, con su copia para Excel, y lo comparte al correo o a Drive, o lo descarga. La cabecera dice la fecha del último respaldo y lo vuelve a pedir pasado un día; el cierre del turno lo ofrece. «Restaurar» une el archivo con lo que hay, sin borrar nada, y dice cuánto agregó; un archivo dañado, de otro parqueadero o de otra versión se rechaza entero y la caja queda como estaba. En un teléfono nuevo, la numeración de los recibos sigue donde iba. Las fotos no van en el respaldo (HU-Q3.10).
- El turno: se abre con quién atiende y la base de caja, y ningún recibo queda fuera de un turno. En medio se anotan los gastos y los ingresos de la caja con su concepto. Al cerrar, el cajero cuenta el efectivo por billete y moneda; la caja calcula lo esperado y la diferencia, que en rojo pide su motivo. El cierre sale en la impresora con las entradas, las salidas, lo cobrado por medio de pago, las anulaciones, las copias, los recibos entregados por papel, WhatsApp o pantalla y el papel ahorrado. Si se cierra la app, el turno sigue abierto al volver (HU-Q3.9).
- Anular sin borrar: una entrada o una salida mal hechas se anulan desde su recibo o desde la salida, con el motivo y el PIN de administrador. La anulación queda anotada con quién la hizo, y nada se borra. Una entrada anulada sale de la lista de adentro; una salida anulada deja el vehículo adentro otra vez, con su hora de entrada. Un recibo anulado ya no se imprime ni se envía (HU-Q3.7).
- El inicio de la caja lista los vehículos que están adentro, con su hora de entrada y el tiempo corriendo, y los busca por placa sin internet. «Escanear recibo» lee con la cámara el QR del papel o el del teléfono del conductor y abre su salida; un QR de otro parqueadero, de una estadía que ya salió o que no es un recibo dice qué es (HU-Q3.4).
- La salida y el cobro: el total en grande con su detalle, tiquete perdido, y efectivo con lo recibido y el cambio, QR o transferencia (con la imagen del QR del parqueadero que se carga en Ajustes), datáfono o cortesía con su motivo. Se cobra lo que el cajero vio; si pasan más de 10 minutos, la caja vuelve a calcular. El recibo de salida usa la tarifa con que entró el vehículo (HU-Q3.5).
- Cada entrega del recibo queda anotada, sin teléfono ni texto: «No salió» reimprime el original sin marca de copia, «Reimprimir» sale con «COPIA n» y el QR en pantalla cuenta solo si el cajero confirma que el conductor lo escaneó (HU-Q3.6).
- La página del recibo `/r/`: el conductor abre su recibo desde el enlace de WhatsApp o el QR, sin cuenta y sin que la página llame a ningún servidor. La vista previa del enlace no dice la placa ni el número, y un enlace alterado dice «No pudimos leer este recibo». En staging, los recibos enlazan a la `/r/` de staging (HU-Q4.2).
- El aviso de privacidad y la política de datos para el parqueadero (`content/parqueadero/privacidad/`), llenos con sus datos legales. La caja no pide ningún número de WhatsApp hasta que el parqueadero acepta el aviso en Ajustes, y lo imprime en la impresora o en hoja carta para ponerlo a la vista (HU-Q4.4).
- El recibo va al WhatsApp del conductor: su número, con la casilla de autorización sin marcar, en la entrada o en la pantalla del recibo. El botón dice qué falta, y el toque abre WhatsApp sin esperar a nada. El número vive solo en el teléfono, nunca en los registros ni en el respaldo, sirve también para el recibo de salida y se borra 24 horas después de la salida (HU-Q4.1).
- Versión propia: el parqueadero se publica con la versión de `apps/parqueadero-sitio/package.json`, este registro de cambios y etiquetas `parqueadero-vX.Y.Z`, sin arrastrar al agro ni al CORE. En `0.0.0` vive solo en staging; la `0.1.0` llega con su dominio. La caja muestra su versión en Ajustes, y un PR que cambia el parqueadero sin anotarlo aquí no pasa el CI (HU-Q0.3).
- la entrada con su recibo en la caja. Los ajustes piden los datos legales del parqueadero, las tarifas con su tope y un PIN de administrador, y no traen nada lleno de fábrica; mientras falte algo, «Nueva entrada» dice qué falta y lleva al campo. La placa se escribe con un teclado propio que propone carro o moto, con novedades y fotos opcionales. El recibo sale solo si el parqueadero lo pide, con su número `A-000001`; si la impresora no está, la entrada queda guardada y el recibo en entregas pendientes. Una reimpresión dice «COPIA», el QR se puede mostrar en la pantalla y el recibo se comparte por WhatsApp. Todo funciona sin internet (HU-Q3.2, HU-Q3.3).
- las reglas del parqueadero en paquetes puros. `@ed1/parqueadero-schema` valida cada registro y catálogo como el modelo de datos, y arma y verifica el respaldo `parqueadero-export/1` con su CSV para Excel. `@ed1/parqueadero-tarifas` liquida por minuto con gracia, día completo, noche y tiquete perdido, y nunca cobra por encima del tope legal. `@ed1/parqueadero-recibos` arma un mismo recibo para el papel de 58 mm, WhatsApp y la pantalla, con los campos de la ley, y su enlace con todo el recibo adentro (HU-Q1.1, HU-Q1.3, HU-Q1.4, HU-Q1.5).
- la caja en `/caja/`, instalable en el teléfono y que abre sin internet, con su cabecera de cuatro señales (impresora, respaldo, hora y entregas pendientes) y el asistente de la impresora: reconoce el equipo (en iPhone avisa desde el principio que no puede imprimir), conecta la PT-210, imprime una página de prueba y pregunta qué línea se lee bien. Si ninguna página de códigos sirve, imprime sin tildes y lo dice. Una versión nueva nunca recarga la caja en medio de algo. Se publica en staging, donde todo lo impreso dice «PRUEBA» (HU-Q3.1, HU-Q2.6, HU-Q5.1).
- Diseñado para su primer cliente (`docs/parking/`): el estudio de mercado de los parqueaderos en Colombia y la arquitectura de la solución (`ARQUITECTURA-PARQUEADERO.md`, ADR-31 a ADR-40, propuestas): una caja que funciona sin red en el navegador, imprime el recibo en la GOOJPRT PT-210 y manda el mismo recibo al WhatsApp del conductor. Su modelo de datos se prueba con `node:sqlite` (`sql/`).
- Plan de trabajo y backlog refinado del Parqueadero ED1 (`docs/parking/BACKLOG-PARKING.md`): cuatro hitos con sprints (M0 a M3) y uno preparado, 14 sprints (Q0 a Q13), 13 épicas y 75 historias con sus work items, y la dirección de diseño de la caja. El MVP del primer cliente, en su propio backlog (`docs/parking/BACKLOG-PARKING_MVP.md`): 37 historias en seis sprints semanales, la demostración del 30 oct y el piloto del 9 al 13 nov. Y su bitácora (`docs/parking/BITACORA-PARKING.md`), con las convenciones de las otras para unirlas y lo que el contraste con las fuentes encontró en el diseño, ya anotado en `ARQUITECTURA-PARQUEADERO.md`.

### Corregido
- «Conectar impresora» tardaba unos dos minutos en decir que no y culpaba a la distancia con la impresora al lado. Ahora dice que no en unos 25 segundos, explica que la impresora está ocupada con otro enlace del teléfono y ofrece «Usar la impresora emparejada» ahí mismo, en el inicio y en el recibo. El diagnóstico empieza diciendo qué puede este navegador (bitácora parqueadero 24).
- en un teléfono de 360 px, los datos del recibo y del turno salían apretados en una columna angosta (la tarifa palabra por palabra, el NIT cortado) y la pantalla se salía por la derecha. Ahora cada etiqueta va con su valor y nada se sale (bitácora parqueadero 23).
- después de imprimir un par de recibos, la impresora quedaba «conectada» al teléfono y la caja ya no entraba hasta apagar el Bluetooth. Ahora la caja suelta la conexión al cerrarse, el diagnóstico guarda lo de antes de recargar, y el asistente recomienda primero la impresora emparejada, que usa el enlace que el teléfono ya tiene con ella (bitácora parqueadero 21).
- el escáner no leía ningún QR en teléfonos sin los servicios de Google, como los Huawei: el lector del teléfono estaba, pero no leía. Ahora la caja pregunta antes si lee QR y, si no, usa el suyo, con la imagen de la cámara en mejor resolución. Un QR que no se entiende lo dice y el escáner sigue mirando. Al volver a la caja después de un rato con el teléfono bloqueado, la impresora se reconecta sola. La página de prueba explica que una línea a la que le falta una letra no sirve, y que con «Ninguna» la caja imprime sin tildes (bitácora parqueadero 19).
- un recibo que no salía de la impresora no ofrecía cómo arreglarlo: el botón esperaba sin mensaje y el diagnóstico solo estaba en el inicio. Ahora el recibo dice por qué no salió y ofrece «Reconectar impresora», «Elegir la impresora otra vez» y «Copiar diagnóstico para soporte»; al reconectar, el recibo sale solo. Mientras reconecta dice «Reconectando la impresora…». El inicio ofrece lo mismo cuando la impresora se soltó, no solo al abrir la caja, y la cabecera ya no dice «toque para conectar», porque no es un botón (bitácora parqueadero 18).
- la PT210L del primer cliente respondía «Esta impresora no se reconoce». La causa era un vínculo viejo en Android: desvincularla y vincularla otra vez lo arregló. Además, la caja busca primero los servicios que ese modelo anuncia, sigue con el siguiente si uno falla, vuelve a conectar si la impresora suelta la conexión y, si aun así no la reconoce, deja copiar un diagnóstico con lo que vio (bitácora parqueadero 12 y 13).
