# Datos del responsable de la política de datos

**Para qué:** completar o cambiar quién responde por los datos personales en la política de privacidad (Ley 1581 de 2012), sin tocar código.

## Dónde están

Un solo archivo: [`content/agro/privacidad/politica.json`](../../content/agro/privacidad/politica.json), bloque `responsable`. De ahí lo lee la página `/agro/privacidad/` (P2: una sola fuente). No hay que cambiar nada más.

```json
"responsable": {
  "nombre": "CultivoPro.co",
  "identificacion": null,
  "domicilio": "Medellín, Colombia",
  "correo": "laboratoriodigital.la@gmail.com",
  "telefono": null
}
```

Lo que está en `null` la página lo muestra como «por completar».

## Cómo editarlo desde GitHub, sin instalar nada

1. Abre el archivo en GitHub y toca el lápiz (**Edit this file**).
2. Cambia solo el texto entre comillas. Para dejar un dato vacío escribe `null`, sin comillas.
3. **Commit changes…** → «Create a new branch for this commit and start a pull request» → **Propose changes** → **Create pull request**.
4. Espera la marca verde de la verificación y aprueba el pull request. El sitio se actualiza solo.

Cuidado: una coma de más o de menos rompe el archivo. Si la verificación sale roja con un error de JSON, revisa las comas y las comillas de la línea que tocaste.

## Qué falta para marcarla «vigente»

La política arranca en `"estado": "borrador"` y una prueba automática no deja pasarla a `"vigente"` mientras:

- alguno de los cinco datos del responsable esté vacío (hoy faltan **identificación**, cédula o NIT, y **teléfono**);
- `"revision"` siga diciendo «requiere revisión de abogado».

Cuando el abogado la apruebe, en el mismo archivo:

1. `"estado": "vigente"`.
2. `"revision": "revisada por <nombre del abogado o de la firma> el <aaaa-mm-dd>"`.
3. Si el abogado cambia lo que la política promete (qué se guarda, con quién se comparte), sube también `"version"`: el cuaderno vuelve a pedir que cada persona la acepte.

Completar o corregir los datos del responsable **no** cambia la versión: no cambia lo que la política promete.

## Antes del primer usuario externo

Debe estar `vigente`. Es la condición para invitar a alguien de fuera de la finca cero o para publicar las calculadoras (HU-E4.4, HU-E2.6).
