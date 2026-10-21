---
name: comprar
description: "Cómo comprar en Comercio Ensayo Dos: dónde está el catálogo, cómo cotizar y preparar un pedido, y que la aceptación y el pago los hace la persona."
---

# Comprar en Comercio Ensayo Dos

Pan de la casa, todas las mañanas.

## El catálogo

- `/catalogo.json`: cada producto con su dirección y sus combinaciones (`variantes`), cada una con su `id`, su precio en pesos colombianos (IVA incluido) y si hay disponibles.
- `/catalogo.md` y `/llms.txt`: lo mismo, para leer. La ficha de cada producto está en `/p/<producto>/index.md`, con lo que hay que saber antes de comprar: envío, retracto y garantía.

## Cotizar

`POST /api/v1/cotizar` con `{"lineas":[{"variante":"<id>","cantidad":1}]}`, y `envio` o `cupon` si los hay. Responde el total, los avisos de lo que cambió y el carrito corregido. No aparta unidades. La API está descrita en `/openapi.json`.

## Preparar el pedido

Esta tienda no tiene encendido su MCP. Dale a la persona la dirección de cada producto (`/p/<producto>/`): ella lo agrega a su pedido y lo envía desde la tienda.

## Lo que hace siempre la persona, nunca el agente

- Aceptar los términos de la tienda y escribir sus datos de entrega.
- Pagar: lo acordamos por whatsapp, transferencia.
- Un pedido preparado que nadie confirma se cancela solo a las 48 horas. Los agentes no apartan unidades: se apartan cuando la persona paga.

## Políticas

- [Términos y condiciones](/legal/terminos/index.md)
- [Política de tratamiento de datos](/legal/privacidad/index.md)
- [Envíos y devoluciones](/legal/envios/index.md)
- [Derecho de retracto](/legal/retracto/index.md)
- [Garantía](/legal/garantia/index.md)
- [Solicitudes](/solicitud/index.md)
