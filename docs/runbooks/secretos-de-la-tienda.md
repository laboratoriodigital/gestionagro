# Runbook · Los secretos de la Tienda

**Cuándo:** una sola vez por ambiente, antes del primer despliegue de la Tienda en ese ambiente (staging ahora; producción con HU-T2.9). Sin `SECRETO_DESPACHO`, el paso «Desplegar la Tienda» del flujo `desplegar` falla y dice que corras este runbook. No detiene a los demás productos.

**Qué genera** (HU-T2.5, TIENDA-3.0 §14.2 y §14.6, ARQUITECTURA §7.5):

| Secreto | Para qué | Si se pierde |
|---|---|---|
| `SECRETO_DESPACHO` | Lo comparten el despacho, el panel y la API de la Tienda: la API no responde a quien no lo trae | Se genera otro y se vuelve a desplegar. No se pierde nada |
| `TIENDA_KEK_V1` | La llave maestra que cifra las llaves de Bold y los datos de los compradores | **Sin ella, esos datos no se recuperan.** Por eso lleva una copia fuera de línea |

## Pasos

1. En una terminal, en la carpeta del repositorio, revisa que `gh` tenga sesión:

   ```bash
   gh auth status
   ```

2. Ten abierto tu gestor de contraseñas.
3. Corre el script con el ambiente:

   ```bash
   node scripts/tienda/generar-secretos.ts --ambiente staging
   ```

4. Cuando diga que la llave está en tu portapapeles, pégala en el gestor con el nombre «Tienda · llave maestra · staging» y guárdala. La llave **no** aparece en la pantalla.
5. Responde `sí`. El script la guarda en el ambiente de GitHub y vacía el portapapeles.
6. Vuelve a correr el flujo `desplegar` (o fusiona el siguiente PR). En el resumen, el paso de la Tienda dice la dirección del panel y del despacho.

## Lo que el script nunca hace

- **Reemplazar un secreto que ya existe.** Una KEK nueva dejaría ilegible lo cifrado con la vieja. Rotarla es otro paso, con `--rotar-kek`: se crea la siguiente y el despliegue reenvuelve todas las llaves de las tiendas con ella antes de retirar la vieja ([tienda-rotar-la-kek.md](tienda-rotar-la-kek.md)).
- **Mostrar la llave maestra** en la pantalla o en el resumen de Actions.
- **Guardar la llave maestra sin tu copia.** Si respondes `no`, o el equipo no tiene portapapeles, no la guarda: vuelve a correrlo cuando puedas copiarla.

## Si algo falla

| Mensaje | Qué hacer |
|---|---|
| `gh no pudo leer los secretos del ambiente` | `gh auth login`, y revisa en GitHub → Settings → Environments que el ambiente exista |
| `gh no pudo guardar …` | Tu usuario necesita permiso de administrador del repositorio para escribir secretos de ambiente |
| `no se pudo copiar la llave maestra al portapapeles` | Córrelo desde el PC con Windows (usa `clip`) |
