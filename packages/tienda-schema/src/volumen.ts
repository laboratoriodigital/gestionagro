/**
 * La tienda llena (HU-T3.7, TIENDA-3.0 §10.3): 2.000 productos de 6 combinaciones y 300 pedidos del
 * mes en todos los estados, para Comercio Ensayo Uno. Una pantalla vacía no enseña lo que una llena
 * sí (bitácora agro, terreno).
 *
 * - **Solo local y staging (CA1).** La corre `scripts/tienda/sembrar-volumen.ts`, que se niega a
 *   tocar otra base. El despliegue no la siembra: llenar staging es una decisión de quien revisa.
 * - **Determinista.** Sin azar ni reloj propio: los mismos datos cada vez, y el mes es el de
 *   `ahora`, en la hora de Colombia.
 * - **Sin datos de nadie.** Los pedidos no llevan contacto: la bandeja los muestra sin comprador.
 */
import type { ComercioDeEnsayo, ProductoDeEnsayo } from './ensayos.ts';

const TIPOS = [
  'Camisa',
  'Blusa',
  'Pantalón',
  'Falda',
  'Vestido',
  'Chaqueta',
  'Bermuda',
  'Overol',
  'Chaleco',
  'Kimono',
  'Camiseta',
  'Short',
  'Enterizo',
  'Saco',
  'Top',
  'Bata',
  'Poncho',
  'Ruana',
  'Pijama',
  'Gabán',
] as const;
const MATERIALES = [
  'lino',
  'algodón',
  'seda',
  'lana',
  'dril',
  'popelina',
  'franela',
  'gasa',
  'pana',
  'satín',
] as const;
const MODELOS = [
  'Brisa',
  'Cerro',
  'Quebrada',
  'Sabana',
  'Páramo',
  'Ladera',
  'Cañada',
  'Vereda',
  'Llano',
  'Meseta',
] as const;
const COLORES = ['Arena', 'Tierra', 'Musgo', 'Noche', 'Hueso', 'Arcilla'] as const;
const TALLAS = ['S', 'M', 'L'] as const;

/** Cada estado con la forma de pago que la base le admite (`pedido`, sus CHECK). */
const ESTADOS: readonly (readonly [estado: string, forma: string, peso: number])[] = [
  ['pendiente', 'a_convenir', 4],
  ['por_pagar', 'en_linea', 1],
  ['confirmado', 'transferencia', 3],
  ['pagado', 'en_linea', 2],
  ['despachado', 'transferencia', 3],
  ['entregado', 'efectivo', 8],
  ['cancelado', 'a_convenir', 2],
  ['devuelto', 'transferencia', 1],
];
const CIUDADES = ['Medellín', 'Bogotá', 'Cali', 'Envigado', 'Rionegro'] as const;

export const VOLUMEN = { productos: 2000, combinaciones: 6, pedidos: 300, colecciones: 10 };

const sinTildes = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '');
const slugDe = (t: string) =>
  sinTildes(t)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
const de = <T>(lista: readonly T[], i: number) => lista[i % lista.length] as T;

/** Los productos: «Camisa de lino Brisa», cada uno con 3 tallas y 2 colores. */
export function productosDeVolumen(n = VOLUMEN.productos): ProductoDeEnsayo[] {
  return Array.from({ length: n }, (_, i) => {
    const tipo = de(TIPOS, i);
    const material = de(MATERIALES, Math.floor(i / TIPOS.length));
    const modelo = de(MODELOS, Math.floor(i / (TIPOS.length * MATERIALES.length)));
    const vuelta = Math.floor(i / (TIPOS.length * MATERIALES.length * MODELOS.length));
    const nombre = `${tipo} de ${material} ${modelo}${vuelta ? ` ${vuelta + 1}` : ''}`;
    const colores = [de(COLORES, i), de(COLORES, i + 3)];
    const id = `vol-p-${String(i + 1).padStart(4, '0')}`;
    return {
      id,
      slug: slugDe(nombre),
      nombre,
      opciones: [
        { nombre: 'Talla', valores: [...TALLAS] },
        { nombre: 'Color', valores: colores },
      ],
      retracto: 'aplica',
      variantes: TALLAS.flatMap((talla, t) =>
        colores.map((color, c) => {
          const j = t * 2 + c;
          return {
            id: `${id}-${j + 1}`,
            clave: `${talla}|${color}`,
            precioCop: 39000 + (i % 40) * 1000 + t * 2000,
            // Uno de cada 13 se agota: el tablero y el inventario los tienen que mostrar.
            stock: (i * 7 + j) % 13,
          };
        }),
      ),
    };
  });
}

const texto = (v: string) => `'${v.replaceAll("'", "''")}'`;
/** Inserciones de a 100 filas: una por fila haría el archivo eterno, y D1 limita el tamaño. */
const enLotes = (inicio: string, filas: readonly string[]) =>
  Array.from(
    { length: Math.ceil(filas.length / 100) },
    (_, k) =>
      `${inicio} VALUES\n${filas.slice(k * 100, k * 100 + 100).join(',\n')}\nON CONFLICT DO NOTHING;`,
  );

const ALFABETO = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
/** Un código de seis letras de Crockford, distinto para cada número. */
const codigoDe = (n: number) => {
  let s = '';
  let x = n;
  for (let k = 0; k < 5; k++) {
    s = (ALFABETO[x % 32] as string) + s;
    x = Math.floor(x / 32);
  }
  return `V${s}`;
};

const HORA = 3_600_000;
/** El primer instante del mes de `ahora` en Colombia (UTC−5, sin horario de verano). */
export function inicioDelMes(ahora: string): number {
  const bogota = new Date(Date.parse(ahora) - 5 * HORA).toISOString();
  return Date.parse(`${bogota.slice(0, 7)}-01T00:00:00-05:00`);
}

/** Los pedidos: repartidos desde el primer día del mes hasta `ahora`, en todos los estados. */
export function pedidosDeVolumen(
  productos: readonly ProductoDeEnsayo[],
  ahora: string,
  n = VOLUMEN.pedidos,
) {
  const desde = inicioDelMes(ahora);
  const hasta = Date.parse(ahora);
  const ruleta = ESTADOS.flatMap(([estado, forma, peso]) =>
    Array.from({ length: peso }, () => [estado, forma] as const),
  );
  return Array.from({ length: n }, (_, i) => {
    const [estado, forma] = de(ruleta, i * 7);
    const creado = new Date(desde + Math.floor(((hasta - desde) * (i + 0.5)) / n)).toISOString();
    const lineas = Array.from({ length: 1 + (i % 3) }, (_linea, k) => {
      const p = de(productos, i * 37 + k * 211);
      const v = de(p.variantes, i + k);
      const [talla, color] = v.clave.split('|');
      return {
        producto: p,
        variante: v,
        opciones: `Talla: ${talla} · Color: ${color}`,
        cantidad: 1 + ((i + k) % 2),
      };
    });
    const subtotal = lineas.reduce((s, l) => s + l.variante.precioCop * l.cantidad, 0);
    return {
      id: `vol-ped-${String(i + 1).padStart(3, '0')}`,
      codigo: codigoDe(i + 1),
      numero: 5001 + i,
      estado,
      forma,
      ciudad: de(CIUDADES, i),
      creado,
      subtotal,
      lineas,
    };
  });
}

/**
 * La siembra, en SQL literal para `wrangler d1 execute --file`. Va después de `siembraDelShard`,
 * que crea la tienda. Aplicarla dos veces no cambia nada.
 */
export function siembraDeVolumen(c: ComercioDeEnsayo, ahora: string): string[] {
  const org = texto(c.org);
  const t = texto(ahora);
  const productos = productosDeVolumen();
  const pedidos = pedidosDeVolumen(productos, ahora);
  const porMaterial = MATERIALES.map((m) => ({
    id: `vol-col-${slugDe(m)}`,
    slug: `de-${slugDe(m)}`,
    nombre: `De ${m}`,
    productos: productos.filter((p) => p.nombre.includes(` de ${m} `)),
  }));
  return [
    ...enLotes(
      'INSERT INTO producto (org_id, id, slug, nombre, estado, opciones, retracto, creado, actualizado)',
      productos.map(
        (p) =>
          `(${org}, ${texto(p.id)}, ${texto(p.slug)}, ${texto(p.nombre)}, 'activo', ${texto(JSON.stringify(p.opciones))}, 'aplica', ${t}, ${t})`,
      ),
    ),
    ...enLotes(
      'INSERT INTO variante (org_id, id, producto_id, clave, precio_cop, stock, actualizado)',
      productos.flatMap((p) =>
        p.variantes.map(
          (v) =>
            `(${org}, ${texto(v.id)}, ${texto(p.id)}, ${texto(v.clave)}, ${v.precioCop}, ${v.stock}, ${t})`,
        ),
      ),
    ),
    ...enLotes(
      'INSERT INTO coleccion (org_id, id, slug, nombre, posicion, actualizado)',
      porMaterial.map(
        (col, k) =>
          `(${org}, ${texto(col.id)}, ${texto(col.slug)}, ${texto(col.nombre)}, ${k}, ${t})`,
      ),
    ),
    ...enLotes(
      'INSERT INTO coleccion_producto (org_id, coleccion_id, producto_id, posicion)',
      porMaterial.flatMap((col) =>
        col.productos.map((p, k) => `(${org}, ${texto(col.id)}, ${texto(p.id)}, ${k})`),
      ),
    ),
    ...enLotes(
      `INSERT INTO pedido (org_id, id, codigo, numero, estado, canal, forma_pago, subtotal_cop, total_cop,
  ciudad, terminos_huella, aceptado, cambiado_por, creado, actualizado)`,
      pedidos.map(
        (p) =>
          `(${org}, ${texto(p.id)}, ${texto(p.codigo)}, ${p.numero}, ${texto(p.estado)}, 'whatsapp', ${texto(p.forma)}, ${p.subtotal}, ${p.subtotal}, ${texto(p.ciudad)}, '${'a'.repeat(64)}', ${texto(p.creado)}, 'comprador', ${texto(p.creado)}, ${texto(p.creado)})`,
      ),
    ),
    ...enLotes(
      `INSERT INTO pedido_linea (org_id, pedido_id, linea, producto_id, variante_id, nombre, opciones,
  precio_unitario_cop, cantidad, total_cop)`,
      pedidos.flatMap((p) =>
        p.lineas.map(
          (l, k) =>
            `(${org}, ${texto(p.id)}, ${k + 1}, ${texto(l.producto.id)}, ${texto(l.variante.id)}, ${texto(l.producto.nombre)}, ${texto(l.opciones)}, ${l.variante.precioCop}, ${l.cantidad}, ${l.variante.precioCop * l.cantidad})`,
        ),
      ),
    ),
  ];
}
