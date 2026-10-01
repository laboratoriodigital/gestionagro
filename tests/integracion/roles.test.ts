/**
 * Roles de punta a punta (HU-E4.5) con el arnés de teléfonos y la celda en memoria: el propietario
 * anota el jornal; el teléfono de un operario baja la finca sin él; si su rol sube a supervisor,
 * el teléfono vuelve a bajar y lo recibe; si baja otra vez, el teléfono lo borra.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { crearPersona, definirJornal } from '../../apps/cuaderno/src/almacen/personas.ts';
import { CLAVE_ROL, recibirCambios } from '../../apps/cuaderno/src/almacen/recepcion.ts';
import { FINCAS_DE_PRUEBA } from '../fixtures/fincas.ts';
import { type Celda, montarCelda, T0, telefonoConFinca, telefonoNuevo } from './arnes.ts';

let c: Celda;
beforeAll(async () => {
  c = await montarCelda();
}, 60_000);
afterAll(async () => c?.cerrar());
beforeEach(async () => c.vaciar());

describe.each(FINCAS_DE_PRUEBA.map((f) => [f.finca.nombre, f] as const))('%s', (_nombre, f) => {
  it('el operario no recibe el jornal; al subir a supervisor lo recibe, y al bajar se borra', async () => {
    const a = await telefonoConFinca(c, f, 1);
    const persona = await crearPersona(a.db, a.finca.id, {
      nombre: 'Persona Ensayo',
      rol: 'operario',
    });
    await definirJornal(a.db, persona.id, 60_000, '2026-10-01');
    // Algo que el operario sí ve, después del jornal: su cursor pasa por encima del jornal.
    await crearPersona(a.db, a.finca.id, { nombre: 'Persona Ensayo Dos', rol: 'operario' });
    await a.sincronizar(c.red().fn);

    const b = await telefonoNuevo(c, a.org, 'telefono-operario', 'operario');
    await b.sincronizar(c.red().fn);
    expect(await b.db.persona.count()).toBe(2);
    expect(await b.db.registro.count()).toBe(1);
    expect(await b.db.valor_jornal.count()).toBe(0);

    // Como supervisor, el teléfono vuelve a bajar desde el principio y recibe lo que le faltaba.
    const supervisor = {
      ...b.destino,
      acceso: await c.acceso(a.org, T0, 'supervisor'),
      rol: 'supervisor',
    };
    expect(
      (await recibirCambios(b.db, supervisor, { fetchFn: c.red().fn, ahora: () => T0 })).estado,
    ).toBe('al-dia');
    expect(await b.db.valor_jornal.count()).toBe(1);
    expect((await b.db.meta.get(CLAVE_ROL))?.valor).toBe('supervisor');

    // De vuelta a operario: lo que ya no le toca ver se borra del teléfono.
    await recibirCambios(b.db, b.destino, { fetchFn: c.red().fn, ahora: () => T0 });
    expect(await b.db.valor_jornal.count()).toBe(0);
    expect(await b.db.registro.count()).toBe(1); // lo demás sigue
  });
});
