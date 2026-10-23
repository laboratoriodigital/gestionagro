/**
 * Los avisos de vencimiento por correo (HU-C10.3) contra un D1 local, con un correo falso y el
 * reloj movido (P8): a 7 días, a 1 día, una sola vez por escalón y solo a quien administra.
 */
import type { Correo, CorreoTransaccional, ResultadoDelEnvio } from '@ed1/correo';
import type { BaseD1 } from '@ed1/d1';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { cargarCeldas } from '../../../scripts/lib/celdas.ts';
import {
  cargarProductos as cargarRegistro,
  catalogoDelRepositorio,
} from '../../../scripts/lib/registro-productos.ts';
import { appDelProducto, esHoraDeAvisar, mandarAvisos } from './avisos-por-correo.ts';
import { baseDelCore, vaciarCore } from './base-de-prueba.ts';
import { sentenciasDelCatalogo } from './catalogo.ts';
import { sentenciasDeCeldas } from './celdas.ts';
import { TOPE_DIARIO_DEL_CORE } from './correo.ts';
import { CATALOGO_DE_STAGING } from './productos.ts';
import { crearOrganizacion, usuarioDeIdentidad } from './repositorio.ts';

const DIA = 24 * 60 * 60 * 1000;
/** Lunes 23 nov 2026, 9:05 a. m. de Bogotá (14:05 UTC): hora de avisar. */
const T0 = Date.UTC(2026, 10, 23, 14, 5);

let db: BaseD1;
let cerrar: () => Promise<void>;
beforeAll(async () => {
  ({ db, cerrar } = await baseDelCore());
}, 60_000);
afterAll(async () => cerrar?.());

let enviados: Correo[] = [];
let responde: ResultadoDelEnvio = { enviado: true, id: 'm' };
let disponible = true;
const correoFalso = (): CorreoTransaccional => ({
  proveedor: 'gmail',
  disponible,
  async enviar(c) {
    if (responde.enviado) enviados.push(c);
    return responde;
  },
});
const avisar = (ahora: number) =>
  mandarAvisos(
    db,
    CATALOGO_DE_STAGING,
    correoFalso,
    { destino: 'staging', origenes: ['https://agro.ejemplo.test'] },
    ahora,
  );

let orgId = '';
beforeEach(async () => {
  await vaciarCore(db);
  for (const s of [
    ...sentenciasDelCatalogo(catalogoDelRepositorio(cargarRegistro()), '2026-10-06T00:00:00.000Z'),
    ...sentenciasDeCeldas(cargarCeldas().celdas, 'staging'),
  ])
    await db.prepare(s).run();
  enviados = [];
  responde = { enviado: true, id: 'm' };
  disponible = true;
  const dueno = await usuarioDeIdentidad(
    db,
    { sub: 'g-dueno', nombre: 'Dueña', email: 'duena@example.com' },
    () => T0,
  );
  const otro = await usuarioDeIdentidad(
    db,
    { sub: 'g-otro', nombre: 'Colaborador', email: 'colabora@example.com' },
    () => T0,
  );
  const org = await crearOrganizacion(
    db,
    {
      propietarioId: dueno.id,
      nombre: 'Panadería Ensayo',
      tipo: 'tienda',
      producto: 'tienda',
      rolQueAdministra: 'propietario',
    },
    () => T0,
  );
  orgId = org.id;
  await db
    .prepare(
      "INSERT INTO membresia (usuario_id, org_id, producto, rol, creado) VALUES (?, ?, 'tienda', 'colaborador', ?)",
    )
    .bind(otro.id, orgId, new Date(T0).toISOString())
    .run();
  // Pagó Pro y le quedan 6 días y medio.
  await db
    .prepare("UPDATE organizacion SET plan = 'pro', plan_vence = ? WHERE id = ?")
    .bind(new Date(T0 + 6.5 * DIA).toISOString(), orgId)
    .run();
});

describe('HU-C10.3 · avisos de vencimiento por correo', () => {
  it('CA1: a 7 días le llega a quien administra, no al colaborador, con el plan, la fecha y adónde ir', async () => {
    expect(await avisar(T0)).toBe(1);
    expect(enviados.map((c) => c.para)).toEqual(['duena@example.com']);
    const [aviso] = enviados;
    expect(aviso?.asunto).toBe('Tu plan de Panadería Ensayo vence en 7 días');
    expect(aviso?.texto).toContain(
      'El plan Pro de Panadería Ensayo en TiendaPro vence el 29 de noviembre',
    );
    expect(aviso?.texto).toContain('tienes 7 días más');
    expect(aviso?.texto).toContain(
      'https://tienda-panel-staging.laboratoriodigital-la.workers.dev/',
    );
  });

  it('CA2 ❌: dos corridas el mismo día mandan uno; el de 1 día sale aparte, también una vez', async () => {
    await avisar(T0);
    await avisar(T0 + 60 * 60 * 1000);
    expect(enviados).toHaveLength(1);
    const unDia = T0 + 6 * DIA; // 9:05 a. m., a medio día de vencer
    expect(await avisar(unDia)).toBe(1);
    expect(await avisar(unDia + 60 * 60 * 1000)).toBe(0);
    expect(enviados.map((c) => c.asunto)).toEqual([
      'Tu plan de Panadería Ensayo vence en 7 días',
      'Tu plan de Panadería Ensayo vence mañana',
    ]);
  });

  it('pagar otro periodo cambia la fecha, y el aviso del periodo nuevo vuelve a salir', async () => {
    await avisar(T0);
    await db
      .prepare('UPDATE organizacion SET plan_vence = ? WHERE id = ?')
      .bind(new Date(T0 + 6 * DIA).toISOString(), orgId)
      .run();
    expect(await avisar(T0 + 60 * 60 * 1000)).toBe(1);
  });

  it('lo que no salió se reintenta en la hora siguiente, hasta 3 veces', async () => {
    responde = { enviado: false, motivo: 'falla', detalle: 'la red' };
    for (let h = 0; h < 4; h++) await avisar(T0 + h * 60 * 60 * 1000);
    const fila = await db
      .prepare("SELECT estado, intentos FROM correo_del_core WHERE tipo = 'aviso'")
      .first<{ estado: string; intentos: number }>();
    expect(fila).toEqual({ estado: 'fallido', intentos: 3 });
  });

  it('sin la configuración del correo no escribe nada, y el aviso sale cuando exista', async () => {
    disponible = false;
    expect(await avisar(T0)).toBe(0);
    expect((await db.prepare('SELECT count(*) AS n FROM correo_del_core').first())?.['n']).toBe(0);
    disponible = true;
    expect(await avisar(T0 + 60 * 60 * 1000)).toBe(1);
  });

  it('con el cupo del día gastado no sale y no gasta un intento', async () => {
    const hoy = new Date(T0).toISOString().slice(0, 10);
    for (let i = 0; i < TOPE_DIARIO_DEL_CORE; i++) {
      await db
        .prepare(
          "INSERT INTO correo_del_core (clave, tipo, dia, estado, creado, actualizado) VALUES (?, 'enlace', ?, 'enviado', ?, ?)",
        )
        .bind(`enlace:${i}`, hoy, new Date(T0).toISOString(), new Date(T0).toISOString())
        .run();
    }
    expect(await avisar(T0)).toBe(0);
    expect(
      (
        await db.prepare("SELECT count(*) AS n FROM correo_del_core WHERE tipo = 'aviso'").first()
      )?.['n'],
    ).toBe(0);
  });

  it('fuera de hora, o con el plan lejos de vencer, no manda nada', async () => {
    expect(await avisar(T0 + 30 * 60 * 1000)).toBe(0); // 9:35: no es la primera vuelta de la hora
    expect(await avisar(Date.UTC(2026, 10, 24, 4, 0))).toBe(0); // 11 p. m. de Bogotá
    await db
      .prepare('UPDATE organizacion SET plan_vence = ? WHERE id = ?')
      .bind(new Date(T0 + 20 * DIA).toISOString(), orgId)
      .run();
    expect(await avisar(T0)).toBe(0);
    expect(enviados).toHaveLength(0);
  });

  it('la hora de avisar es de 8 a. m. a 7 p. m. de Bogotá, en la primera vuelta de cada hora', () => {
    expect(esHoraDeAvisar(Date.UTC(2026, 10, 23, 13, 0))).toBe(true); // 8:00
    expect(esHoraDeAvisar(Date.UTC(2026, 10, 23, 12, 59))).toBe(false); // 7:59
    expect(esHoraDeAvisar(Date.UTC(2026, 10, 24, 0, 14))).toBe(true); // 7:14 p. m.
    expect(esHoraDeAvisar(Date.UTC(2026, 10, 24, 1, 0))).toBe(false); // 8:00 p. m.
  });

  it('el agro lleva a su cuaderno en el destino de la celda', () => {
    const agro = CATALOGO_DE_STAGING.productos.find((p) => p.id === 'agro');
    if (!agro) throw new Error('falta el agro');
    expect(appDelProducto(agro, 'produccion', ['https://cultivopro.co'])).toBe(
      'https://cultivopro.co/agro/app/',
    );
  });
});
