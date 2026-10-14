/**
 * Los dos comercios de prueba de la Tienda (HU-T2.6, TIENDA-3.0 §16, P4): un solo fixture para las
 * pruebas, la siembra de staging y las direcciones de staging. Distintos a propósito, para que nada
 * funcione solo para el primero:
 *
 * - **Comercio Ensayo Uno**, ropa: talla y color, inventario, plan `entrada` (pago en línea y, más
 *   adelante, un dominio propio de prueba).
 * - **Comercio Ensayo Dos**, panadería: sin inventario, solo WhatsApp, plan `gratis`, en el
 *   subdominio. Su pan no admite retracto: es perecedero (Ley 1480, art. 47).
 *
 * Nunca se siembran en producción (CA3): la siembra la arma el despliegue solo para staging, y la
 * prueba de humo de producción falla si los encuentra (HU-T2.9).
 */

export interface VarianteDeEnsayo {
  id: string;
  /** Los valores de las opciones en orden, unidos por «|»; '' sin opciones (anexo A). */
  clave: string;
  precioCop: number;
  /** `null`: sin inventario. */
  stock: number | null;
}

export interface ProductoDeEnsayo {
  id: string;
  slug: string;
  nombre: string;
  opciones: { nombre: string; valores: string[] }[];
  retracto: 'aplica' | { motivo: string };
  variantes: VarianteDeEnsayo[];
}

export interface ComercioDeEnsayo {
  org: string;
  slug: string;
  nombre: string;
  plan: 'gratis' | 'entrada';
  productos: ProductoDeEnsayo[];
}

export const ENSAYO_UNO: ComercioDeEnsayo = {
  org: '0199e0a0-0000-7000-8000-0000000000c1',
  slug: 'ensayo-uno',
  nombre: 'Comercio Ensayo Uno',
  plan: 'entrada',
  productos: [
    {
      id: 'p-camisa',
      slug: 'camisa-de-lino',
      nombre: 'Camisa de lino',
      opciones: [
        { nombre: 'Talla', valores: ['S', 'M', 'L'] },
        { nombre: 'Color', valores: ['Arena', 'Azul'] },
      ],
      retracto: 'aplica',
      variantes: [
        { id: 'v-camisa-s-arena', clave: 'S|Arena', precioCop: 129000, stock: 1 },
        { id: 'v-camisa-m-arena', clave: 'M|Arena', precioCop: 129000, stock: 4 },
        { id: 'v-camisa-l-azul', clave: 'L|Azul', precioCop: 129000, stock: 0 },
      ],
    },
  ],
};

export const ENSAYO_DOS: ComercioDeEnsayo = {
  org: '0199e0a0-0000-7000-8000-0000000000c2',
  slug: 'ensayo-dos',
  nombre: 'Comercio Ensayo Dos',
  plan: 'gratis',
  productos: [
    {
      id: 'p-pan-de-bono',
      slug: 'pan-de-bono',
      nombre: 'Pan de bono',
      opciones: [],
      retracto: { motivo: 'Alimento perecedero (Ley 1480, art. 47)' },
      variantes: [{ id: 'v-pan-de-bono', clave: '', precioCop: 1500, stock: null }],
    },
  ],
};

export const ENSAYOS: readonly ComercioDeEnsayo[] = [ENSAYO_UNO, ENSAYO_DOS];

/** Su dirección de staging: `--` no lo puede tomar ninguna tienda (TIENDA §4.1). */
export const hostDeStaging = (slug: string): string => `${slug}--staging.laboratorio-digital.app`;

const texto = (v: string) => `'${v.replaceAll("'", "''")}'`;
const numero = (n: number | null) => (n === null ? 'NULL' : String(n));

/**
 * La siembra del shard, en SQL literal para `wrangler d1 execute --file`. Aplicarla dos veces no
 * cambia nada (`ON CONFLICT DO NOTHING`): el despliegue la corre en cada staging.
 */
export function siembraDelShard(ensayos: readonly ComercioDeEnsayo[], ahora: string): string[] {
  const t = texto(ahora);
  return ensayos.flatMap((c) => [
    `INSERT INTO tienda (org_id, slug, nombre, estado, plan, creado, actualizado) VALUES (${texto(c.org)}, ${texto(c.slug)}, ${texto(c.nombre)}, 'abierta', ${texto(c.plan)}, ${t}, ${t}) ON CONFLICT DO NOTHING;`,
    ...c.productos.flatMap((p) => [
      `INSERT INTO producto (org_id, id, slug, nombre, estado, opciones, retracto, retracto_motivo, creado, actualizado) VALUES (${texto(c.org)}, ${texto(p.id)}, ${texto(p.slug)}, ${texto(p.nombre)}, 'activo', ${texto(JSON.stringify(p.opciones))}, ${p.retracto === 'aplica' ? "'aplica', NULL" : `'no_aplica', ${texto(p.retracto.motivo)}`}, ${t}, ${t}) ON CONFLICT DO NOTHING;`,
      ...p.variantes.map(
        (v) =>
          `INSERT INTO variante (org_id, id, producto_id, clave, precio_cop, stock, actualizado) VALUES (${texto(c.org)}, ${texto(v.id)}, ${texto(p.id)}, ${texto(v.clave)}, ${v.precioCop}, ${numero(v.stock)}, ${t}) ON CONFLICT DO NOTHING;`,
      ),
    ]),
  ]);
}

/** La siembra de la base de control: su nombre corto y su dirección de staging, canónica. */
export function siembraDelControl(
  ensayos: readonly ComercioDeEnsayo[],
  celda: string,
  ahora: string,
): string[] {
  const t = texto(ahora);
  return ensayos.flatMap((c) => [
    `INSERT INTO slug (slug, org_id, celda_id, creado) VALUES (${texto(c.slug)}, ${texto(c.org)}, ${texto(celda)}, ${t}) ON CONFLICT DO NOTHING;`,
    `INSERT INTO dominio (hostname, org_id, celda_id, tipo, rol, estado, creado, activado) VALUES (${texto(hostDeStaging(c.slug))}, ${texto(c.org)}, ${texto(celda)}, 'plataforma', 'canonico', 'activo', ${t}, ${t}) ON CONFLICT DO NOTHING;`,
  ]);
}

/** Las entradas de `TIENDA_HOSTS` de staging: `h:<host>` → la tienda (TIENDA §5.6). */
export function hostsDeStaging(
  ensayos: readonly ComercioDeEnsayo[],
  celda: string,
  shard: string,
): [string, string][] {
  return ensayos.map((c) => [
    `h:${hostDeStaging(c.slug)}`,
    JSON.stringify({
      org: c.org,
      celda,
      shard,
      version: null,
      canonico: hostDeStaging(c.slug),
      estado: 'abierta',
      rol: 'canonico',
    }),
  ]);
}
