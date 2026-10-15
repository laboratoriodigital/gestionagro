# Runbook · La revisión con la tienda llena

**Cuándo:** antes de cargar la primera tienda real (HU-T3.7), y otra vez cuando cambie mucho la vitrina o el panel. Una pantalla vacía no enseña lo que una llena sí.

**Qué hace:** llena a Comercio Ensayo Uno, en staging, con 2.000 productos de 6 combinaciones (3 tallas y 2 colores), 10 colecciones de 200 productos y 300 pedidos del mes en los 8 estados. Ningún dato es de una persona: los pedidos no tienen comprador. Volver a correrlo no duplica nada.

## 1. Llenar la tienda (2 minutos)

1. En GitHub → **Actions** → **sembrar-volumen-tienda** → **Run workflow**, sobre `main`.
2. Espera el ✅. El último paso dice «Comercio Ensayo Uno quedó llena en staging».
3. Entra al panel de staging como Ensayo Uno y, en **Más → Publicar y versiones**, publica.

En tu computador también se puede, sin tocar staging: `node scripts/tienda/sembrar-volumen.ts --destino local`.

## 2. El recorrido, en el teléfono (360 px de ancho)

Anota cada hallazgo con la pantalla, lo que esperabas y lo que viste. Una foto de la pantalla ayuda.

**La vitrina** (`ensayo-uno--staging.laboratorio-digital.app`):

1. La portada abre rápido y muestra 24 productos, con «Ver los 2001 productos» al final.
2. «Ver los … productos» lleva a la página 1 de 42; «Siguientes» y «Anteriores» caminan entre páginas sin perderse.
3. Una colección («De lino») muestra 48 productos por página y su navegación.
4. Una ficha con tallas y colores: elegir una combinación agotada lo dice antes de pedir.
5. «Buscar» encuentra «Kimono de seda» entre los 2.000.
6. El pedido con tres productos llega al carrito y a WhatsApp con sus tres líneas.

**El panel** (`panel--staging.laboratorio-digital.app`):

7. **Inicio:** el tablero muestra los pedidos del mes, lo que hay por confirmar y los agotados, sin tardar más de unos segundos.
8. **Pedidos:** la bandeja carga de a 50; «Ver más» llega hasta el último; los filtros por estado funcionan con 300.
9. **Productos:** la lista y la búsqueda responden con 2.000; abrir uno y guardarlo funciona.
10. **Inventario:** se lee y se encuentra una combinación agotada.
11. **Más → Descargar todo:** el archivo baja completo y las hojas abren en Excel.
12. **Más → Registro** y **Más → Publicar y versiones** cargan.

## 3. Lo que encuentres

Cada hallazgo entra como un arreglo en el sprint, o como una historia en el backlog si es grande, y queda en la bitácora de la Tienda (`docs/tienda/BITACORA_TIENDA3.md`). Si nada falla, se anota que el recorrido pasó y la fecha.

La prueba automática (`apps/tienda-api/src/volumen.test.ts`) ya cubre que la tienda llena se publica dentro de sus presupuestos y que el panel responde. El recorrido es para lo que una prueba no ve: si se entiende, si se encuentra, si cansa.
