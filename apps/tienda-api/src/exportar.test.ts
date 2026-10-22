/**
 * HU-T10.7: «Descargar todo». La tienda Uno, con lo suyo sembrado aquí, se exporta por la API del
 * panel, se carga en una tienda vacía (la Tres) por la misma API de la carga, y se vuelve a
 * exportar: las huellas salen iguales tabla por tabla (CA3). Ningún dato es de una persona real.
 */
import { importarKek } from '@ed1/cifrado';
import type { BaseD1 } from '@ed1/d1';
import { baseLocal } from '@ed1/d1/local';
import { revisarCarga } from '@ed1/tienda-schema';
import {
  type ComercioDeEnsayo,
  ENSAYO_DOS,
  ENSAYO_UNO,
  siembraDelControl,
  siembraDelShard,
} from '@ed1/tienda-schema/ensayos';
import { type Firmante, firmanteDesde, firmarAcceso, generarClavePrivada } from '@ed1/tokens';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { cifrarContacto } from './bandeja.ts';
import { type Exportacion, TABLAS } from './exportar.ts';
import { KEK_VIGENTE } from './llaves.ts';
import { CABECERA_DESPACHO, CABECERA_TIENDA, crearApp, type Env } from './worker.ts';

const CONFIGURACION = 'apps/tienda-api/wrangler.c1.jsonc';
const SECRETO = 'secreto-de-prueba-de-exportar';
const T0 = Date.UTC(2026, 9, 15, 15);
const AHORA = new Date(T0).toISOString();
const PERSONA = '0199e0a0-0000-7000-8000-0000000000d9';
const UNO = ENSAYO_UNO.org;
const HOST = 'ensayo-uno--staging.mitiendapro.co';
const MEDIOS = 'img--staging.laboratorio-digital.app';
const KEK = Buffer.from(Array.from({ length: 32 }, (_, i) => i + 11)).toString('base64');
/** Una tienda recién creada: sin ajustes ni productos. */
const ENSAYO_TRES: ComercioDeEnsayo = {
  org: '0199e0a0-0000-7000-8000-0000000000c3',
  slug: 'ensayo-tres',
  nombre: 'Comercio Ensayo Tres',
  plan: 'pro',
  ajustes: {},
  productos: [],
};
const TRES = ENSAYO_TRES.org;
const FOTO = 'f'.repeat(64);

let shard: BaseD1;
let control: BaseD1;
let firmante: Firmante;
const cerrar: (() => Promise<void>)[] = [];

const env = (): Env => ({
  CELDA: 'c1',
  PRODUCTO: 'tienda',
  SECRETO_DESPACHO: SECRETO,
  CORE_CLAVES: JSON.stringify([firmante.publica]),
  TIENDA_KEK_V1: KEK,
  MEDIOS,
  tienda_c1_s1: shard,
  tienda_control: control,
});

type Rol = 'propietario' | 'colaborador';
const pedir = async (
  ruta: string,
  cuerpo?: unknown,
  o: { rol?: Rol; org?: string; entro?: number } = {},
) => {
  const { token } = await firmarAcceso(
    firmante,
    {
      sub: PERSONA,
      org: o.org ?? UNO,
      rol: o.rol ?? 'propietario',
      celda: 'c1',
      shard: 'tienda_c1_s1',
      anillo: 1,
      aud: 'tienda',
      plan: 'pro',
      auth_time: Math.floor((o.entro ?? T0) / 1000),
    },
    T0,
    2,
  );
  return crearApp({ ahora: () => T0, enSegundoPlano: () => undefined }).request(
    `/api/panel/v1/${ruta}`,
    {
      method: cuerpo === undefined ? 'GET' : 'POST',
      headers: {
        [CABECERA_DESPACHO]: SECRETO,
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
      },
      ...(cuerpo === undefined ? {} : { body: JSON.stringify(cuerpo) }),
    },
    env(),
  );
};
const exportar = async (org = UNO) => {
  const r = await pedir('exportar', undefined, { org });
  expect(r.status).toBe(200);
  return (await r.json()) as Exportacion;
};

const correr = (sql: string, ...v: unknown[]) =>
  shard
    .prepare(sql)
    .bind(...v)
    .run();

async function pedido(
  n: number,
  estado: string,
  linea: { nombre: string; opciones: string; sku?: string; variante: string },
  contacto?: Record<string, string>,
) {
  const id = `ped-exp-${n}`;
  const codigo = `EXP0${'ABCDEFGHJK'[n]}${'ABCDEFGHJK'[n]}`;
  await correr(
    `INSERT INTO pedido (org_id, id, codigo, numero, estado, canal, forma_pago, subtotal_cop, total_cop,
       terminos_huella, aceptado, cambiado_por, creado, actualizado)
     VALUES (?, ?, ?, ?, ?, 'whatsapp', 'transferencia', 129000, 129000, ?, ?, 'comprador', ?, ?)`,
    UNO,
    id,
    codigo,
    1500 + n,
    estado,
    'a'.repeat(64),
    AHORA,
    new Date(T0 - (10 - n) * 3_600_000).toISOString(),
    AHORA,
  );
  await correr(
    `INSERT INTO pedido_linea (org_id, pedido_id, linea, producto_id, variante_id, nombre, opciones, sku,
       precio_unitario_cop, cantidad, total_cop)
     VALUES (?, ?, 1, 'p-camisa', ?, ?, ?, ?, 129000, 1, 129000)`,
    UNO,
    id,
    linea.variante,
    linea.nombre,
    linea.opciones,
    linea.sku ?? null,
  );
  if (contacto) {
    const kek = await importarKek(KEK_VIGENTE, Buffer.from(KEK, 'base64'));
    const s = await cifrarContacto({ db: shard, org: UNO }, kek, id, contacto, AHORA);
    await correr(
      `INSERT INTO pedido_contacto (org_id, pedido_id, sobre, iv, llave_version, creado, purgar_despues)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      UNO,
      id,
      s.sobre,
      s.iv,
      s.version,
      AHORA,
      AHORA,
    );
  }
  return codigo;
}

const CONTACTO = {
  nombre: 'Ensayo Dos Compradora',
  celular: '3001234567',
  direccion: 'Calle de prueba 99',
};
const M_ARENA = {
  nombre: 'Camisa de lino',
  opciones: 'Talla: M · Color: Arena',
  variante: 'v-camisa-m-arena',
};
const codigos: Record<string, string> = {};

beforeAll(async () => {
  const s = await baseLocal({
    configuracion: CONFIGURACION,
    binding: 'tienda_c1_s1',
    base: 'tienda',
  });
  const c = await baseLocal({
    configuracion: CONFIGURACION,
    binding: 'tienda_control',
    base: 'tienda-control',
  });
  shard = s.db;
  control = c.db;
  cerrar.push(s.cerrar, c.cerrar);
  const todas = [ENSAYO_UNO, ENSAYO_DOS, ENSAYO_TRES];
  for (const sql of siembraDelShard(todas, AHORA)) await shard.prepare(sql.replace(/;$/, '')).run();
  for (const sql of siembraDelControl(todas, 'c1', AHORA))
    await control.prepare(sql.replace(/;$/, '')).run();
  firmante = await firmanteDesde(await generarClavePrivada());

  // Lo de la tienda Uno que la carga sabe escribir, y lo que no viaja.
  await correr(
    `INSERT INTO coleccion (org_id, id, slug, nombre, posicion, actualizado) VALUES (?, 'col-verano', 'verano', 'Verano', 0, ?)`,
    UNO,
    AHORA,
  );
  await correr(
    `INSERT INTO coleccion_producto (org_id, coleccion_id, producto_id, posicion) VALUES (?, 'col-verano', 'p-camisa', 0)`,
    UNO,
  );
  await correr(
    `UPDATE variante SET sku = 'CAM-S-ARENA' WHERE org_id = ? AND id = 'v-camisa-s-arena'`,
    UNO,
  );
  await correr(
    `INSERT INTO envio_opcion (org_id, id, nombre, precio_cop, gratis_desde_cop, ciudades, dias_min, dias_max, posicion)
     VALUES (?, 'env-medellin', 'Medellín', 9000, 200000, '["Medellín"]', 1, 2, 0)`,
    UNO,
  );
  await correr(
    `INSERT INTO envio_opcion (org_id, id, nombre, precio_cop, dias_min, dias_max, posicion, activa)
     VALUES (?, 'env-apagado', 'Apagado', 5000, 1, 2, 1, 0)`,
    UNO,
  );
  await correr(
    `INSERT INTO cupon (org_id, codigo, tipo, valor, minimo_cop, usos_maximos) VALUES (?, 'ENSAYO10', 'porcentaje', 10, 0, 50)`,
    UNO,
  );
  await correr(
    `INSERT INTO pagina (org_id, id, slug, titulo, cuerpo_md, actualizado) VALUES (?, 'pag-cambios', 'cambios', 'Cambios', '# Cambios', ?)`,
    UNO,
    AHORA,
  );
  await correr(
    `INSERT INTO medio (org_id, id, producto_id, variante_id, posicion, alt, ancho, alto, formatos, creado)
     VALUES (?, ?, 'p-camisa', 'v-camisa-m-arena', 0, 'Camisa de lino arena', 1600, 2000, ?, ?)`,
    UNO,
    FOTO,
    JSON.stringify({ webp: { 400: 1000, 800: 3000, 1600: 9000 } }),
    AHORA,
  );
  codigos['entregado'] = await pedido(1, 'entregado', M_ARENA, CONTACTO);
  codigos['porSku'] = await pedido(2, 'cancelado', {
    nombre: 'Camisa de lino talla S',
    opciones: '',
    sku: 'CAM-S-ARENA',
    variante: 'v-camisa-s-arena',
  });
  codigos['enCurso'] = await pedido(3, 'pendiente', M_ARENA, CONTACTO);
  // Se vendió con otro nombre y sin SKU: la carga no sabría de qué variante es.
  codigos['renombrado'] = await pedido(4, 'entregado', { ...M_ARENA, nombre: 'Camisa vieja' });

  // Una solicitud, por la ruta pública, como llega desde la tienda.
  const r = await crearApp({ ahora: () => T0 }).request(
    `https://${HOST}/api/v1/solicitudes`,
    {
      method: 'POST',
      body: JSON.stringify({
        tipo: 'reclamo',
        texto: 'La camisa llegó con una costura abierta en la manga.',
        contacto: '3001234567',
        acepta: true,
        seguimiento: 'exportarsolicitud00001',
      }),
      headers: {
        [CABECERA_DESPACHO]: SECRETO,
        [CABECERA_TIENDA]: JSON.stringify({ org: UNO, shard: 'tienda_c1_s1' }),
        'content-type': 'application/json',
      },
    },
    env(),
  );
  expect(r.status).toBe(200);
}, 120_000);
afterAll(async () => {
  for (const c of cerrar) await c();
});

describe('descargar todo (HU-T10.7)', () => {
  it('CA1: tienda-export/1, que la carga acepta, con las fotos por enlace y sin datos personales', async () => {
    const e = await exportar();
    expect(e.formato).toBe('tienda-export/1');
    expect(revisarCarga(e)).toMatchObject({ ok: true });
    expect(e.colecciones).toEqual([{ refExterna: 'verano', nombre: 'Verano', slug: 'verano' }]);
    const camisa = e.productos.find((p) => p.refExterna === 'p-camisa');
    expect(camisa?.colecciones).toEqual(['verano']);
    expect(camisa?.medios).toEqual([
      {
        url: `https://${MEDIOS}/${UNO}/${FOTO}/1600.webp`,
        alt: 'Camisa de lino arena',
        variante: ['M', 'Arena'],
      },
    ]);
    expect(camisa?.variantes).toContainEqual({
      valores: ['S', 'Arena'],
      sku: 'CAM-S-ARENA',
      precioCop: 129000,
      stock: 1,
    });
    // El envío apagado no viaja: la carga lo dejaría encendido.
    expect(e.envios.map((x) => x.refExterna)).toEqual(['env-medellin']);
    expect(e.cupones.map((x) => x.codigo)).toEqual(['ENSAYO10']);
    expect(e.paginas).toEqual([
      { refExterna: 'pag-cambios', titulo: 'Cambios', slug: 'cambios', md: '# Cambios' },
    ]);
    // ❌ Lo que la carga no aceptaría se cuenta, no se exporta como si sirviera.
    expect(e.pedidos.map((p) => p.codigo)).toEqual([codigos['entregado'], codigos['porSku']]);
    expect(e.excluidos).toEqual({ pedidosEnCurso: 1, pedidosSinSuVariante: 1 });
    expect(e).not.toHaveProperty('datosPersonales');
    expect(Object.keys(e.ajustes)).not.toContain('cobro');
    const texto = JSON.stringify(e);
    for (const dato of ['3001234567', 'Ensayo Dos Compradora', 'Calle de prueba 99', 'costura'])
      expect(texto).not.toContain(dato);
  });

  it('❌ CA3: exportar, cargar en una tienda vacía y volver a exportar da las mismas huellas, tabla por tabla', async () => {
    const a = await exportar();
    const revisar = await pedir('importar/revisar', { carga: a }, { org: TRES });
    expect(revisar.status).toBe(200);
    const { resumen } = (await revisar.json()) as { resumen: { partes: number } };
    for (let parte = 0; parte < resumen.partes; parte++) {
      const r = await pedir('importar/aplicar', { carga: a, parte }, { org: TRES });
      expect(r.status, `parte ${parte}`).toBe(200);
    }
    const b = await exportar(TRES);
    // Las fotos van por enlace y la carga todavía no las baja (HU-T12.2 solo las cuenta): es la
    // única tabla que no vuelve, y se dice aquí para que no se esconda.
    const vuelven = TABLAS.filter((t) => t !== 'medios');
    expect(b.ajustes).toEqual(a.ajustes);
    for (const t of vuelven) expect(b.huellas[t], t).toBe(a.huellas[t]);
    expect(b.huellas['medios']).not.toBe(a.huellas['medios']);
    expect(b.productos.flatMap((p) => p.medios)).toEqual([]);
    const sinFotos = (e: Exportacion) => e.productos.map(({ medios: _, ...p }) => p);
    expect(sinFotos(b)).toEqual(sinFotos(a));
    expect(b.pedidos).toEqual(a.pedidos);
    expect(b.ajustes).toEqual(a.ajustes);
  });

  it('❌ CA2: los datos personales, solo el propietario y recién entrado', async () => {
    const colaborador = await pedir('exportar?datos=personales', undefined, { rol: 'colaborador' });
    expect(colaborador.status).toBe(403);
    expect(await colaborador.json()).toMatchObject({ estado: 'prohibido' });
    const hace = await pedir('exportar?datos=personales', undefined, { entro: T0 - 3_600_000 });
    expect(hace.status).toBe(401);
    expect(await hace.json()).toMatchObject({ estado: 'reautenticar' });
    // Sin datos personales, el colaborador sí descarga.
    expect((await pedir('exportar', undefined, { rol: 'colaborador' })).status).toBe(200);
  });

  it('CA2: con datos personales, los contactos de los pedidos y las solicitudes, y queda registrado', async () => {
    const r = await pedir('exportar?datos=personales');
    expect(r.status).toBe(200);
    expect(r.headers.get('cache-control')).toBe('no-store');
    const e = (await r.json()) as Exportacion;
    expect(revisarCarga(e)).toMatchObject({ ok: true });
    expect(e.datosPersonales?.pedidos).toEqual([
      { codigo: codigos['entregado'], ...CONTACTO },
      { codigo: codigos['enCurso'], ...CONTACTO },
    ]);
    expect(e.datosPersonales?.solicitudes).toEqual([
      expect.objectContaining({
        tipo: 'Reclamo',
        contacto: '3001234567',
        texto: 'La camisa llegó con una costura abierta en la manga.',
        respuesta: null,
      }),
    ]);
    const registro = (await (await pedir('registro')).json()) as { filas: { frase: string }[] };
    expect(registro.filas[0]?.frase).toBe(
      'Tú descargaste todos los datos de la tienda, con los datos personales',
    );
    expect(registro.filas.map((f) => f.frase)).toContain(
      'Tú descargaste todos los datos de la tienda',
    );
  });
});
