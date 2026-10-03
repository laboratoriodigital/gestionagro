/**
 * Carpeta de cumplimiento en PDF (HU-E9.2), en Respaldo: los registros de un periodo para una
 * auditoría o un cliente exigente. Se arma en el teléfono, sin señal una vez descargado su
 * generador. Es del plan Finca (interruptor en `funciones.json`, CA4) y la pide quien administra la
 * finca. No afirma cumplir ninguna norma (CA2).
 */
import { fechaAgronomica, sumarDias } from '@gestionagro/agro-schema';
import { useEffect, useState } from 'preact/hooks';
import marca from '../../../../content/marca.json' with { type: 'json' };
import { cuaderno } from '../almacen/abierto.ts';
import { armarCarpeta } from '../almacen/carpeta.ts';
import type { Papel } from '../almacen/carpeta-pdf.ts';
import { funcionActiva } from '../almacen/funciones.ts';
import { leerSesion, planDeLaFinca, rolEnLaFinca } from '../almacen/sesion.ts';
import { corto, descargar } from '../descargar.ts';
import { fechaHora } from '../formato.ts';

/** Quien administra la finca (§9). Sin finca en la nube, el teléfono es de quien lo configuró. */
const ADMINISTRAN = [null, 'propietario', 'supervisor'];
/** Seis meses: lo que suele pedir una auditoría. */
const DIAS_POR_DEFECTO = 182;

export function CarpetaCumplimiento(props: { fincaId: string; nombreFinca: string }) {
  const hoy = fechaAgronomica(Date.now());
  const [acceso, setAcceso] = useState<'cargando' | 'plan' | 'rol' | 'si'>('cargando');
  const [desde, setDesde] = useState(sumarDias(hoy, -DIAS_POR_DEFECTO));
  const [hasta, setHasta] = useState(hoy);
  const [papel, setPapel] = useState<Papel>('carta');
  const [estado, setEstado] = useState<'listo' | 'armando' | 'hecho' | 'fallo'>('listo');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void leerSesion(cuaderno()).then((s) => {
      if (!funcionActiva('carpeta_cumplimiento', planDeLaFinca(s))) setAcceso('plan');
      else if (!ADMINISTRAN.includes(rolEnLaFinca(s))) setAcceso('rol');
      else {
        setAcceso('si');
        // Con señal, se trae el generador de una vez: así la carpeta queda lista para una
        // auditoría en la finca sin señal. Solo para quien la puede usar (plan Finca).
        if (navigator.onLine) void import('../almacen/carpeta-pdf.ts').catch(() => undefined);
      }
    });
  }, []);

  const generar = async () => {
    setError(null);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(desde) || !/^\d{4}-\d{2}-\d{2}$/.test(hasta)) {
      setError('Elige las dos fechas del periodo.');
      return;
    }
    if (desde > hasta) {
      setError('La fecha «desde» debe ser anterior a «hasta».');
      return;
    }
    setEstado('armando');
    try {
      const carpeta = await armarCarpeta(cuaderno(), props.fincaId, { desde, hasta });
      const { pdfDeCarpeta } = await import('../almacen/carpeta-pdf.ts');
      const bytes = await pdfDeCarpeta(
        carpeta,
        papel,
        fechaHora(new Date().toISOString()),
        marca.nombre,
      );
      descargar(
        `carpeta-${corto(props.nombreFinca)}-${desde}-a-${hasta}.pdf`,
        bytes,
        'application/pdf',
      );
      setEstado('hecho');
    } catch {
      setEstado('fallo');
    }
  };

  if (acceso === 'cargando' || acceso === 'rol') return null;
  return (
    <div data-prueba="carpeta-cumplimiento">
      <h2>Carpeta para auditoría (PDF)</h2>
      {acceso === 'plan' ? (
        <p class="ayuda" data-prueba="carpeta-plan">
          La carpeta con los registros de un periodo, lista para una auditoría o un cliente, viene
          con el plan Finca. <a href="/agro/app/planes/">Ver los planes</a>
        </p>
      ) : (
        <>
          <p>
            Aplicaciones, riegos, monitoreos, cosechas, lotes y despachos del periodo, con los
            registros corregidos marcados. Son los registros de la finca: no certifica el
            cumplimiento de ninguna norma.
          </p>
          <div class="campo">
            <label for="carpeta-desde">Desde</label>
            <input
              id="carpeta-desde"
              type="date"
              value={desde}
              onInput={(e) => {
                setDesde((e.currentTarget as HTMLInputElement).value);
                setEstado('listo');
              }}
            />
          </div>
          <div class="campo">
            <label for="carpeta-hasta">Hasta</label>
            <input
              id="carpeta-hasta"
              type="date"
              value={hasta}
              onInput={(e) => {
                setHasta((e.currentTarget as HTMLInputElement).value);
                setEstado('listo');
              }}
            />
          </div>
          <div class="campo">
            <label for="carpeta-papel">Papel</label>
            <select
              id="carpeta-papel"
              value={papel}
              onChange={(e) => setPapel((e.currentTarget as HTMLSelectElement).value as Papel)}
            >
              <option value="carta">Carta</option>
              <option value="a4">A4</option>
            </select>
          </div>
          {error && (
            <p class="error" role="alert">
              {error}
            </p>
          )}
          <div class="acciones">
            <button
              type="button"
              disabled={estado === 'armando'}
              onClick={() => void generar()}
              data-prueba="descargar-carpeta"
            >
              {estado === 'armando' ? 'Armando la carpeta…' : 'Descargar carpeta en PDF'}
            </button>
          </div>
          {estado === 'hecho' && (
            <p class="exito" role="status">
              Listo: la carpeta quedó en tus descargas.
            </p>
          )}
          {estado === 'fallo' && (
            <p class="error" role="alert">
              No se pudo armar la carpeta. Si es la primera vez, hace falta señal para bajar el
              generador; después funciona sin señal.
            </p>
          )}
        </>
      )}
    </div>
  );
}
