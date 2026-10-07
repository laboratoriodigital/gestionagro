# La matriz en el equipo real: PT-210 y la caja

**HU-Q6.1, PARQUEADERO §15.3, P16.** El MVP no se entrega sin esta matriz en verde con la PT-210 y el teléfono del cliente. Se llena desde Q1, con cada prueba de campo: fecha, equipo, navegador y resultado.

**Regla (CA3 ❌):** un caso en rojo no se pinta de verde con una nota. Se arregla, o el criterio de salida del MVP se discute con el dueño antes del piloto.

Estados: ✅ pasó · ❌ falló · 🟡 pasó con un cambio o una condición · ⬜ sin probar.

## Los equipos

| Clave | Qué es | Datos |
|---|---|---|
| **PT-C** | La impresora del primer cliente | GOOJPRT `PT210L_30F2`, Bluetooth clásico y LE, emparejada en Android (nRF Connect: BONDED). Anuncia `0x18F0` y `e7810a71-73ae-499d-8c15-faa9aef0c3f2`. No obedece `FS .`: queda en modo chino de dos bytes |
| **AND-D** | El Android del dueño, el de las pruebas del 7 oct 2026 | Samsung Galaxy S24 Ultra, Chrome 154.0.8037.126 (afirmación falsa 4: no es un Huawei) |
| **WIN** | Un PC con Windows y Chrome o Edge | Sin probar |
| **IPH** | Un iPhone | Sin probar |

## La matriz

| Caso | Android + Chrome | Windows + Chrome o Edge | iPhone |
|---|---|---|---|
| Paso 0: nombre, servicios y características con nRF Connect | ✅ PT-C, 7 oct (arriba) | — | — |
| Vincular la PT-210 y página de prueba | 🟡 Bluetooth web: imprime, después de desvincular y vincular de nuevo (bitácora 12 y 13). Impresora emparejada (Web Serial): ⬜ | ⬜ | Debe decir desde el paso 1 que no puede (e2e en verde); en el equipo ⬜ |
| Tildes y ñ en la página de prueba | ❌ PT-C se come la letra que sigue a la tilde (bitácora 19). Con «Ninguna» debe salir sin tildes: ⬜ | ⬜ | — |
| QR del papel | ⬜ | ⬜ | — |
| 50 recibos seguidos | ⬜ | ⬜ | — |
| La impresora se apaga y vuelve, con la caja abierta | ❌ Bluetooth web: no reconecta (bitácora 17 y 18). Impresora emparejada: ⬜ | ⬜ | — |
| Bloquear el teléfono y volver | ❌ Bluetooth web (bitácora 19). Impresora emparejada: ⬜ | — | — |
| La caja se cierra y se vuelve a abrir | ❌ Bluetooth web: la luz queda azul y la caja nueva no entra hasta apagar el Bluetooth del teléfono (bitácora 21). Impresora emparejada, sin selector: ⬜ | ⬜ | — |
| Sin papel | ⬜ (un rollo al revés imprime en blanco: la autoprueba lo descarta) | ⬜ | — |
| Escanear el QR del recibo en la caja | ✅ AND-D con jsQR, 7 oct, después de #117 | ⬜ | — |
| QR del papel leído por tres teléfonos distintos | ⬜ (uno: AND-D) | ⬜ | ⬜ |
| Enviar por WhatsApp | ✅ AND-D, 7 oct: abre el chat con el recibo | ⬜ | ⬜ |
| La página `/r/` desde el enlace de WhatsApp | ✅ AND-D, 7 oct: abre con el recibo | ⬜ | ⬜ |
| Modo avión de punta a punta | ⬜ | ⬜ | ⬜ |
| El cierre de turno impreso contra el anexo B | ⬜ | ⬜ | — |
| Respaldo a Drive y restaurar en otro teléfono | ⬜ | ⬜ | — |

## El camino principal en Android (CA2)

**Por decidir.** El candidato es la impresora emparejada (Web Serial): la PT-C ya está emparejada, acepta un solo enlace, y por Bluetooth web la conexión se cayó o no volvió en cuatro pruebas seguidas (bitácora 17, 18, 19 y 21). Se decide con la fila «La caja se cierra y se vuelve a abrir» y la de los 50 recibos en verde por ese camino. Si AND-D no tiene Chrome 138 o posterior, la prueba va en el teléfono del cliente.

## Registro de pruebas

Una fila por prueba, la más nueva arriba. El diagnóstico copiado va al hilo del proyecto; aquí, lo que concluye.

| Fecha | Equipo y navegador | Versión de la caja | Qué se probó | Resultado |
|---|---|---|---|---|
| 2026-10-07 | AND-D · PT-C | `main` tras #120 | «Conectar impresora» por Bluetooth web, desde Ajustes y desde el recibo | ❌ Conecta y se cae al buscar los servicios en los 4 intentos; tarda 2 minutos en decirlo (bitácora 24). La impresora emparejada: sin probar |
| 2026-10-07 | AND-D · PT-C | `main` tras #117 | Escáner, WhatsApp y `/r/`; imprimir varias entradas; bloquear y volver | Escáner, WhatsApp y `/r/` ✅. Imprime dos recibos y después no vuelve: luz azul, conexión que se cae en los 4 intentos (bitácora 21) |
| 2026-10-07 | AND-D · PT-C | `main` tras #116 | Varias entradas; bloquear el teléfono; tildes; escáner | Reconecta solo con malabares; las tildes se comen la letra; el escáner no lee (bitácora 19) |
| 2026-10-07 | AND-D · PT-C | `main` tras #115 | Conectar, desconectar, nuevo registro | Conecta la primera vez; desde el recibo no vuelve, sin mensaje (bitácora 18) |
| 2026-10-07 | AND-D · PT-C | `main` tras #114 | Apagar y prender la impresora | No reconecta: «no se reconoce» (bitácora 17) |
| 2026-10-07 | AND-D · PT-C | `main` tras #111 | Vincular y página de prueba | «No se reconoce»; vincular de nuevo en Android lo arregla. La primera página salió en blanco: el rollo estaba al revés (bitácora 12 y 13) |
