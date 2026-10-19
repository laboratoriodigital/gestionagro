# Runbook · Rotar la llave maestra de la Tienda

**Cuándo:**
- si la llave maestra pudo quedar expuesta: un equipo perdido con el gestor abierto, un registro con su valor, alguien que ya no debe tenerla;
- y una vez al año como práctica, primero en staging.

Si se perdió del todo y no hay copia, no es este runbook: es [tienda-incidente-datos-personales.md](tienda-incidente-datos-personales.md).

**Qué es:** la llave maestra (KEK, TIENDA-3.0 §14.2) no cifra los datos. Envuelve las llaves de cada tienda (DEK), y esas cifran las llaves de Bold, los contactos de los compradores y los índices. Rotar es poner una KEK nueva y volver a envolver con ella las mismas DEK. **Los datos cifrados no se tocan**, y nada deja de leerse en ningún momento (HU-T17.6).

| Secreto | Qué hace durante la rotación |
|---|---|
| `TIENDA_KEK_V1` (la de antes) | Sigue abriendo lo que envolvió, hasta que el despliegue lo reenvuelve todo |
| `TIENDA_KEK_V2` (la nueva) | Envuelve todo lo nuevo desde el despliegue que la carga. La de número más alto es siempre la vigente |

El flujo de despliegue carga de `TIENDA_KEK_V1` a `TIENDA_KEK_V5`.

## Pasos

1. Ten abierto tu gestor de contraseñas y revisa la sesión de `gh`:

   ```bash
   gh auth status
   ```

2. Crea la llave siguiente. El script dice cuál es (`TIENDA_KEK_V2` si hoy está la V1):

   ```bash
   node scripts/tienda/generar-secretos.ts --ambiente staging --rotar-kek
   ```

   Como con la primera, la llave va al portapapeles y nunca a la pantalla. Pégala en el gestor con el nombre que dice el script («Tienda · llave maestra V2 · staging») y responde `sí`.
3. Corre el flujo `desplegar` (o fusiona el siguiente PR). En el resumen, el paso de la Tienda dice:
   - `llaves de la Tienda: envuelve v2, N reenvueltas`.
   - Si dice «todavía con otra KEK», el cron sigue reenvolviendo cada hora (solo en producción). Vuelve a desplegar para terminar antes.
4. Cuando el resumen ya no diga «todavía con otra KEK», borra `TIENDA_KEK_V1` del ambiente: GitHub › Settings › Environments › staging › Environment secrets.
5. Despliega otra vez. Antes de borrar la V1 del Worker, el despliegue comprueba dos cosas:
   - que ninguna llave de ninguna tienda siga envuelta con ella;
   - que la V2 sola abre todas las llaves.

   Si las dos se cumplen, el resumen dice `retiradas del Worker: TIENDA_KEK_V1`.
6. **Guarda la copia de la V1 en el gestor 4 meses más.** Los respaldos guardan las llaves envueltas como estaban ese día: el mensual más viejo tiene 3 meses (HU-T17.3). Restaurar en un shard vacío desde un respaldo de antes de la rotación necesita la V1. Pasados los 4 meses, bórrala del gestor.

En producción, lo mismo con `--ambiente produccion`, después de haberlo hecho en staging.

## Lo que nunca pasa

- **Borrar una llave maestra que todavía se usa.** Si sacas la V1 del ambiente antes de tiempo, el despliegue lo detecta. Falla con «TIENDA_KEK_V1 salió del ambiente de GitHub, pero todavía envuelve N llave(s)» y no borra ninguna del Worker. Vuelve a ponerla con el valor de tu gestor, o espera a que termine de reenvolver.
- **Retirar si algo no abre.** Si la vigente sola no abre alguna llave, el despliegue dice «la KEK vigente no abre N llave(s)» y no retira nada. Es un incidente: no borres la vieja, y sigue [tienda-incidente-datos-personales.md](tienda-incidente-datos-personales.md).
- **Mostrar una llave.** Ni el script, ni el despliegue, ni `/api/salud` la muestran. La salud solo dice sus nombres: `keks: ["v1", "v2"]`.

## Si algo falla

| Mensaje | Qué hacer |
|---|---|
| «no tiene una llave maestra que rotar» | El ambiente no tiene ninguna: es el primer despliegue. Sigue [secretos-de-la-tienda.md](secretos-de-la-tienda.md) |
| «el flujo de despliegue carga hasta TIENDA_KEK_V5» | Retira primero las viejas (pasos 4 y 5) y vuelve a rotar |
| «sus llaves no se reenvolvieron» | La API no respondió en la ruta del despliegue: mira el registro del Worker y vuelve a desplegar. Nada se borró |
| En `/api/salud`, `kek: "ilegible"` | Alguna de las llaves del ambiente no son 32 bytes en base64: vuelve a pegarla desde el gestor con `gh secret set TIENDA_KEK_V<n> --env <ambiente>` |
