# Runbook: un parqueadero se va (exportar, entregar, verificar y purgar)

**Para qué:** que un parqueadero que deja el servicio reciba todo lo suyo antes de que se borre de la nube, y que nada se borre sin esa entrega (PARQUEADERO §14.5 runbook 5, HU-Q10.2, P21).

**Cuándo aplica:** solo con el parqueadero en la nube. Hasta HU-Q7.12, eso es staging: en producción la caja no sube nada, y lo del parqueadero vive en sus teléfonos y en sus respaldos.

**Quién lo corre:** el dueño de Laboratorio Digital, en su PC con Windows, desde la carpeta del repositorio (`D:\CoWork\gestionagro`). El script es `scripts/baja-parqueadero.ts`; solo usa Node.

## Lo que hace y lo que no

| Hace | No hace |
|---|---|
| Exporta todo lo del parqueadero en la celda: registros, catálogos y versiones anteriores, en el mismo archivo `parqueadero-export/1` del respaldo, más su CSV para Excel | Borrar algo sin la fila de `purga`: el trigger `registro_sin_borrado` lo rechaza en D1 |
| Da la huella (SHA-256) del archivo que se entrega | Borrar lo que quedó dentro de los teléfonos de las cajas |
| Antes de purgar, compara la celda con el archivo: si llegó algo que no se entregó, no borra | Borrar las cajas retiradas: se quedan para que ninguna vuelva a subir nada |
| Deja en `purga` quién autorizó, cuándo y la huella de lo entregado | Cerrar la cuenta ni el parqueadero en el CORE |

## Pasos

0. **El token.** En PowerShell, con el token de Cloudflare que tiene «Account → D1: Edit» (el mismo del despliegue) y el id de la cuenta:

   ```powershell
   $env:CF_API_TOKEN = "<token>"
   $env:CF_ACCOUNT_ID = "<id de la cuenta>"
   ```

1. **Retirar todas sus cajas.** Con la cuenta del propietario: **«Cuenta y nube»** › «Cajas del parqueadero» › **«Retirar»** cada una (runbook `docs/runbooks/parqueadero-retirar-caja.md`). Así no llega nada después de exportar. El script no exporta si queda una sin retirar, y dice cuáles.

2. **Exportar.** Con el id del parqueadero (`org_id`, el que el CORE le dio):

   ```powershell
   node scripts/baja-parqueadero.ts exportar --destino staging --org <org_id> --salida baja
   ```

   Escribe en la carpeta `baja` el archivo `.json` y su `.csv`, y muestra la **huella**. Anótela.

3. **Entregar.** Mande los dos archivos al parqueadero por el medio que acordaron (correo, una memoria USB). El `.json` abre en una caja nueva con **«Restaurar»**, en Más › **«Respaldo»**, y no borra nada de lo que haya; el `.csv` abre en Excel. Pídale que confirme que lo recibió.

4. **Verificar.** Con el archivo que se entregó, tal cual:

   ```powershell
   node scripts/baja-parqueadero.ts verificar --archivo baja\<archivo>.json --huella <huella>
   ```

   Si dice que el archivo no es el entregado, no siga: exporte y entregue otra vez.

5. **Purgar.** Solo con la entrega confirmada. `--confirmar` es el nombre del parqueadero, como lo dice su sede:

   ```powershell
   node scripts/baja-parqueadero.ts purgar --destino staging --org <org_id> --archivo baja\<archivo>.json --huella <huella> --autor "<su nombre>" --confirmar "<nombre del parqueadero>"
   ```

   Antes de borrar vuelve a revisar todo: la huella, que el archivo esté entero, que no haya cajas sin retirar y que la celda tenga exactamente lo que se entregó. Después escribe la fila de `purga` y borra los registros, los catálogos, sus versiones anteriores y lo que estaba en cuarentena. Dice cuánto borró.

6. **Guardar la constancia.** Guarde el archivo entregado, su huella y la salida de la purga junto con la confirmación del parqueadero. La fila de `purga` en la celda es la otra mitad: dice quién autorizó, cuándo y con qué huella.

## Si algo no sale

- **«primero retire sus cajas (A, B)»:** vuelva al paso 1 con esas series.
- **««registro» en la celda no es igual a lo entregado»:** algo llegó después de exportar (una caja que se reactivó, o un envío que esperaba señal). Retire las cajas, exporte y entregue otra vez.
- **«el archivo no tiene la huella dada»:** el archivo cambió o no es el que se entregó. Use el que se entregó, o repita desde el paso 2.
- **«ese parqueadero ya tiene una purga con otra huella»:** ya se purgó con otra entrega. Busque esa constancia antes de hacer nada.
- **Se cortó a mitad de la purga:** repita el mismo comando con la misma huella; termina lo que faltó. Si ya no quedaba nada, lo dice.
- **«no existe la base …» o «al token le falta…»:** revise el destino (`staging` o `produccion`) y el token del paso 0.

## El ensayo (CA2)

Para comprobar de punta a punta, en staging y con Parqueadero Ensayo Dos (un parqueadero de prueba que ninguna cuenta tiene), que el trigger rechaza el `DELETE` sin purga, que no exporta con una caja activa, que la huella se verifica y que la purga no deja nada:

- En GitHub: Actions › **ensayo-baja-parqueadero** › «Run workflow» (`.github/workflows/ensayo-baja-parqueadero.yml`), o
- En el PC, con el token del paso 0: `node scripts/baja-parqueadero.ts ensayar --destino staging`

El ensayo deja la celda como estaba. Nunca corre en producción.
