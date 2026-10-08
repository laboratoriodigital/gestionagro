# Runbook: retirar una caja perdida o robada

**Para qué:** que un teléfono perdido o robado deje de subir y bajar los datos del parqueadero, sin perder lo que registró antes (PARQUEADERO §11.4 punto 3 y §14.5, HU-Q7.7).

**Cuándo aplica:** solo con la caja en la nube. Hasta HU-Q7.12, eso es staging: en producción la caja no tiene cuenta, y un teléfono perdido se cubre con el último respaldo (runbook «Restaurar la caja en otro teléfono», `docs/runbooks/parqueadero-restaurar-caja.md`).

## Lo que hace y lo que no

| Hace | No hace |
|---|---|
| La celda deja de recibirle y de darle datos a esa caja, por su id | Borrar lo que esa caja registró: sigue valiendo con su serie |
| Cierra las sesiones de su cuenta abiertas en ese teléfono | Cerrar la sesión de otra cuenta: esa se cierra desde esa cuenta |
| La serie de la caja retirada no se le da a ninguna otra | Borrar los datos que quedaron dentro del teléfono |

El acceso que el teléfono ya tenía vence solo en 12 horas. Mientras tanto, la celda le cierra la puerta por el id de la caja.

## Pasos

1. En otra caja del parqueadero, o en un teléfono que entre con la cuenta del propietario o de un administrador: **«Cuenta y nube»**.
2. En «Cajas del parqueadero», busque la caja por su serie y toque **«Retirar»**.
3. Lea la pregunta y toque **«Sí, retirarla»**. Debe decir que quedó retirada; la lista la muestra «retirada» con su fecha.
4. Si el teléfono aparece después, no vuelve a sincronizar: su cola se queda en él. Para usarlo otra vez, como caja nueva, hay que vaciarlo (borrar los datos del sitio en Chrome), entrar con la cuenta y **«Sumar esta caja a»** el parqueadero: recibe una serie nueva.
5. Si la caja retirada era la única, el parqueadero sigue en la nube: en un teléfono vacío, entre con la cuenta y súmelo. Baja los ajustes y lo que estaba en la nube.

## Si algo no sale

- **«Con el rol de cajero no se dan de alta ni se retiran cajas»:** entre con la cuenta del propietario o de un administrador.
- **«Sin señal»:** nada cambió; repita con señal.
