# Runbook: anotar el soporte y sacar el resumen del mes

**Para qué:** saber cuántos minutos de soporte pide cada parqueadero al mes. Es la variable que decide si el negocio funciona: una hora de soporte al mes vale más que todo lo demás de una sede (estudio §10.4 y §16.3, HU-Q10.3).

**Quién lo lleva:** quien atiende a los parqueaderos, desde el piloto. El resumen lo corre el dueño de Laboratorio Digital en su PC con Windows, desde la carpeta del repositorio (`D:\CoWork\gestionagro`), con solo Node: `scripts/soporte-parqueadero.ts`.

## El registro

Un archivo CSV **fuera del repositorio** (por ejemplo, en el Drive de Laboratorio Digital), porque los nombres de los clientes no van en el código. Se abre y se llena en Excel. Cada atención es una fila con cinco columnas y nada más:

```csv
fecha;sede;canal;minutos;causa
2026-10-03;Parqueadero Ensayo Uno;whatsapp;15;impresora
2026-11-30;Parqueadero Ensayo Dos;whatsapp;0;ninguna
```

- **fecha:** el día de la atención, como `2026-10-09`.
- **sede:** el nombre del parqueadero, igual cada vez. Nunca un teléfono ni un dato del conductor: no hay columna para notas, y una fila con una columna de más no se cuenta.
- **canal:** `whatsapp`, `llamada`, `presencial` o `remoto`.
- **minutos:** lo que tomó, de 1 a 600.
- **causa:** una de la tabla. Si no es ninguna, `otra`.

**Un mes sin atenciones se anota.** Una sede sin filas en un mes sale como «sin registros», no como cero: puede ser que no hubo soporte o que nadie lo anotó (CA3, P1). Si de verdad no hubo, una fila con la causa `ninguna` y 0 minutos lo dice.

## Las causas y su runbook

| Causa | Qué es | Runbook |
|---|---|---|
| `impresora` | La PT-210 no imprime, no conecta o sale en blanco | `docs/runbooks/parqueadero-impresora-no-imprime.md` |
| `uso_de_la_caja` | El cajero no sabe cómo hacer algo en la caja | `docs/runbooks/parqueadero-hoja-del-cajero.md` |
| `puesta_en_marcha` | Instalar la caja, llenar Ajustes, el primer turno | `docs/runbooks/parqueadero-puesta-en-marcha.md` |
| `respaldo` | Bajar, restaurar o pasar la caja a otro teléfono | `docs/runbooks/parqueadero-restaurar-caja.md` |
| `caja_perdida` | Un teléfono perdido o robado | `docs/runbooks/parqueadero-retirar-caja.md` |
| `cobro_y_tarifas` | Un cobro que no cuadra o una tarifa mal puesta | Sin runbook |
| `whatsapp` | El recibo no llega o no abre por WhatsApp | Sin runbook |
| `cuenta_y_nube` | Entrar con la cuenta, sincronizar, la cuarentena | Sin runbook |
| `telefono_o_red` | El teléfono, el navegador o la red del parqueadero | Sin runbook |
| `otra` | Lo que no cabe en las demás | Sin runbook |
| `ninguna` | El mes no tuvo atenciones (0 minutos) | No aplica |

El resumen dice las tres causas con más minutos del mes. Si una no tiene runbook, se lleva al backlog como historia: un runbook nuevo o el arreglo que la quite (CA2).

## El resumen del mes

En PowerShell, desde la carpeta del repositorio:

```powershell
node scripts/soporte-parqueadero.ts "G:\Mi unidad\soporte-parqueadero.csv"
node scripts/soporte-parqueadero.ts "G:\Mi unidad\soporte-parqueadero.csv" --mes 2026-10 --costo-minuto 500
```

Sin `--mes`, es el mes anterior. Con `--costo-minuto`, dice también lo que costó en pesos el soporte de cada sede, para la contribución por sede del estudio §10.4. Dice por sede los minutos, las atenciones, los minutos por causa y por canal, y cuántas sedes del registro quedaron sin registros ese mes.

**Si sale «N filas no se contaron»:** el script dice la línea y por qué (una fecha mal escrita, un canal que no existe, una columna de más). Corríjala en Excel y córralo otra vez. Mientras haya una, termina con error, para que nadie lea un total al que le faltan filas.

**Excel en español guarda con punto y coma.** Si lo guarda con comas, también se lee, siempre que todo el archivo use el mismo separador.
