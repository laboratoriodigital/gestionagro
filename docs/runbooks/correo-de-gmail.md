# Runbook · El permiso de Gmail para los correos

**Cuándo:** una vez por ambiente (staging primero, con la cuenta de Gmail de prueba; producción con la cuenta de Laboratorio Digital), y otra vez si `/api/salud` dice «el permiso de Gmail no sirve». Sin este permiso nada se rompe: cada correo queda anotado como no enviado, y nada finge haber salido.

**Qué guarda** en el ambiente de GitHub (PLATAFORMA §4.11, ARQUITECTURA §7.5):

| Secreto | Qué es |
|---|---|
| `CORREO_GMAIL_CLIENTE_ID` | El cliente de OAuth «de escritorio», solo para enviar. No es el de «entrar con Google» |
| `CORREO_GMAIL_CLIENTE_SECRETO` | Su secreto |
| `CORREO_GMAIL_REFRESH` | El permiso duradero de enviar (`gmail.send`) con la cuenta |
| `CORREO_GMAIL_REMITENTE` | La dirección de la cuenta, que va en el `From` |

## Antes, una sola vez en Google Cloud

1. Entra a [console.cloud.google.com](https://console.cloud.google.com) con la cuenta de Gmail que va a enviar. Usa un proyecto aparte del de «entrar con Google».
2. **APIs y servicios › Biblioteca:** busca «Gmail API» y actívala.
3. **Pantalla de consentimiento de OAuth:** tipo «Externo», con el nombre «Laboratorio Digital · correos». Agrega el permiso `…/auth/gmail.send`. Luego, en **Público**, pulsa **Publicar la app**: queda «En producción». *En «prueba», el permiso vence a los 7 días.* Google avisará que la app no está verificada: es normal, porque solo la usa esta cuenta.
4. **Credenciales › Crear credenciales › ID de cliente de OAuth**, tipo **App de escritorio**, con el nombre «Correos de la Tienda». Deja abierta la ventana con el id y el secreto.

## Pasos

1. En una terminal, en la carpeta del repositorio, revisa que `gh` tenga sesión:

   ```bash
   gh auth status
   ```

2. Corre el script con el ambiente:

   ```bash
   node scripts/correo/permiso-de-gmail.ts --ambiente staging
   ```

3. Pega el id del cliente y su secreto. El secreto no se ve al pegarlo.
4. Se abre el navegador. Entra con **la cuenta que envía**. En el aviso de app no verificada, pulsa **Avanzado › Ir a Laboratorio Digital** y acepta el permiso de enviar correos.
5. Cuando la pestaña diga «Listo», vuelve a la terminal. Debe decir `✅ Permiso guardado en «staging»: los correos salen desde …`.
6. Vuelve a correr el flujo `desplegar`, o fusiona el siguiente PR. Desde ese despliegue, los acuses de los pedidos y los avisos salen por correo.

Para producción, lo mismo con `--ambiente produccion` y la cuenta de Laboratorio Digital.

## Lo que el script nunca hace

- **Mostrar el secreto o el permiso** en la pantalla. Van a `gh` por su entrada, no como argumentos.
- **Pasar por un servidor de afuera.** Google devuelve el código a esta misma máquina (`127.0.0.1`), con un `state` y PKCE. Una vuelta con otro `state` no cuenta.
- **Guardar un permiso que no sirve.** Antes de guardarlo, pide con él un acceso como lo hará el Worker, y exige que incluya enviar correos.

## Si algo falla

| Mensaje | Qué hacer |
|---|---|
| «gh no pudo leer el ambiente» | `gh auth login`, y revisa que el ambiente exista en GitHub › Settings › Environments |
| «el id del cliente termina en .apps.googleusercontent.com» | Copia otra vez el id y el secreto de **Credenciales** |
| «Google no dio el permiso (access_denied)» | Volviste atrás en el permiso, o entraste con otra cuenta. Corre el script de nuevo |
| «Google no dio el permiso duradero» | Google ya había dado uno a esta app. Quita su acceso en [myaccount.google.com/permissions](https://myaccount.google.com/permissions) y vuelve a correrlo |
| «el permiso no incluye enviar correos» | En la pantalla de Google, marca la casilla de Gmail |
| «pasaron 5 minutos sin la vuelta de Google» | Vuelve a correrlo y acepta en el navegador antes de los 5 minutos |
| En `/api/salud`: «el permiso de Gmail no sirve» | Se venció (la app quedó «en prueba») o alguien lo quitó: revisa el paso 3 de Google Cloud y vuelve a correr el script |

## Renovar o retirar

- **Renovar:** volver a correr el script reemplaza los cuatro secretos.
- **Retirar:** quita el acceso de la app en la cuenta de Google, o borra el cliente en **Credenciales**. Los correos dejan de salir y quedan anotados como no enviados.
- **La cuenta de Gmail** se cuida como un secreto más, con segundo factor (`docs/runbooks/credenciales.md`).
