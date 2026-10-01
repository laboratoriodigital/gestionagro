import { describe, expect, it } from 'vitest';
import {
  abrirFormulario,
  actividadActual,
  conEscritura,
  decidirActualizacion,
} from './actividad.ts';

describe('decidir qué hacer con una versión nueva (HU-E3.1, CA2)', () => {
  const libre = { formulariosAbiertos: 0, escriturasEnCurso: 0 };

  it('sin versión nueva no hace nada', () => {
    expect(decidirActualizacion(false, libre)).toBe('nada');
  });

  it('sin actividad en curso ofrece el botón; nunca recarga sola', () => {
    expect(decidirActualizacion(true, libre)).toBe('ofrecer');
  });

  it('con un formulario abierto o una escritura en curso, solo avisa', () => {
    expect(decidirActualizacion(true, { ...libre, formulariosAbiertos: 1 })).toBe('esperar');
    expect(decidirActualizacion(true, { ...libre, escriturasEnCurso: 2 })).toBe('esperar');
  });
});

describe('registro de actividad', () => {
  it('un formulario cuenta mientras está abierto, y cerrarlo dos veces no descuenta de más', () => {
    const cerrar = abrirFormulario();
    expect(actividadActual().formulariosAbiertos).toBe(1);
    cerrar();
    cerrar();
    expect(actividadActual().formulariosAbiertos).toBe(0);
  });

  it('una escritura cuenta hasta terminar, también si falla', async () => {
    let durante = -1;
    await expect(
      conEscritura(async () => {
        durante = actividadActual().escriturasEnCurso;
        throw new Error('falla de prueba');
      }),
    ).rejects.toThrow('falla de prueba');
    expect(durante).toBe(1);
    expect(actividadActual().escriturasEnCurso).toBe(0);
  });
});
