# Registrar un pago del plan en efectivo

Cuando un cliente te paga el plan en mano (el año del parqueadero, por ejemplo), lo registras desde GitHub. Queda igual que un pago en línea: aparece en «Tus pagos» de su cuenta, con su periodo, y el plan se activa con la misma regla. Se suma desde hoy, o desde el vencimiento si todavía no ha llegado. Queda anotado que fue en efectivo y quién lo registró (HU-C5.8).

## Antes

- Ten a mano el **correo con que el cliente entra a su cuenta** (el de quien la administra). Si administra más de un parqueadero, el flujo te dice los nombres y sus ids para que elijas.
- Ten claro **cuántos meses** pagó y **cuánto**. Si pagó el precio del plan, no hace falta escribir el monto: el año del Parqueadero vale $299.000.
- Entrégale su factura simple a mano, como dice `pagos-bold.md`, mientras no haya factura electrónica.

## Pasos

1. En GitHub: **Actions** → **registrar-pago-en-efectivo** → **Run workflow**.
2. Llena los campos:
   - **ambiente:** `produccion`.
   - **producto:** `parqueadero`, `agro` para una finca o `tienda` para TiendaPro.
   - **cliente:** el correo del cliente.
   - **plan:** `parqueadero` (en el agro, `finca`; en TiendaPro, `pro` o `ia-pro`).
   - **meses:** `12` para un año.
   - **monto:** vacío si pagó el precio; si te pagó otra cifra, escríbela (`280000` o `280.000`).
   - **nota:** cómo y dónde pagó, por ejemplo «Pagó el año en efectivo en la oficina, recibo 001».
   - **confirmar:** deja **no** la primera vez.
3. Abre la corrida y mira el resumen. Te dice el parqueadero, el plan que tenía, hasta cuándo queda y el monto. Si el monto no es el precio del periodo, te avisa.
4. Si todo está bien, corre el flujo otra vez con lo mismo y **confirmar: si**. El resumen dice «Pago en efectivo registrado».

La caja del cliente ve el plan en la próxima hora, o enseguida si cierra sesión y vuelve a entrar. En TiendaPro, la tienda toma el plan cuando el comercio vuelve a abrir su panel: ahí se publica otra vez con lo que su plan permite.

## Si algo sale mal

| El resumen dice | Qué hacer |
|---|---|
| «… no administra ninguna organización del producto …» | Revisa el correo y el producto. Un cajero no sirve: tiene que ser el de quien administra |
| «… administra 2: escriba el id de la que pagó» | Corre otra vez con el id que corresponde en **cliente** |
| «… no tiene precio por N meses: escriba el monto» | Escribe lo que te pagó en **monto** |
| «La organización cambió mientras se registraba el pago» | Otro pago llegó al mismo tiempo. Nada se aplicó: el pago queda rechazado con ese motivo. Corre el flujo otra vez |
| «al token le falta …» o «D1 no aceptó la consulta …» | Es del token de Cloudflare del ambiente; mira `credenciales.md` |

## Lo que no hace

- No borra ni corrige un pago ya registrado. Si te equivocaste, escríbeme: se corrige con otro registro, nunca borrando (P21).
- No emite factura ni manda correo al cliente.
- Sin **confirmar: si** no escribe nada.
