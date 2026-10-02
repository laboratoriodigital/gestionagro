/**
 * Etiqueta QR de un lote (HU-E6.4). Con señal y la finca en la nube, la celda arma y firma los
 * datos con lo que ella tiene (`/api/v1/lotes/firmar`): «verificado». Sin señal, el teléfono arma
 * los mismos campos con lo suyo, sin firma: «sin confirmar», y se puede reimprimir firmada después.
 * La firma se guarda en el teléfono: reimprimir no vuelve a pedirla.
 */
import type { Registro } from '@gestionagro/agro-schema';
import { codificar, type DatosQr, enlaceQr, fragmento } from '@gestionagro/trazabilidad';
import type { CuadernoDb } from './db.ts';
import type { Lote } from './lotes.ts';

export interface Etiqueta {
  enlace: string;
  datos: DatosQr;
  firmada: boolean;
  /** Por qué salió sin firma, en palabras; nulo si está firmada. */
  motivo: string | null;
}

const claveDe = (loteId: string) => `qr:${loteId}`;

/** Los datos del QR con lo que tiene el teléfono, en el mismo formato que arma la celda. */
export async function datosLocales(db: CuadernoDb, lote: Lote): Promise<DatosQr> {
  const cosechas = (await db.registro.bulkGet(lote.cosechas.map((c) => c.id))).filter(
    (r): r is Registro => !!r,
  );
  const finca = await db.finca.get(lote.registro.finca_id);
  const areaIds = [...new Set(cosechas.flatMap((r) => r.area_ids))];
  const areas = new Map(
    (await db.area.bulkGet(areaIds)).flatMap((a) => (a ? [[a.id, a.nombre]] : [])),
  );
  const cicloIds = [...new Set(cosechas.flatMap((r) => (r.ciclo_id ? [r.ciclo_id] : [])))];
  const ciclos = (await db.ciclo.bulkGet(cicloIds)).filter((c) => !!c);
  const unico = <T>(v: T[]) => (new Set(v).size === 1 ? (v[0] ?? null) : null);
  const fechas = cosechas.map((r) => r.fecha_agronomica).sort();
  const dia = lote.registro.fecha_agronomica;
  return {
    v: 1,
    l: lote.codigo,
    f: finca?.nombre ?? '',
    m: finca?.municipio ?? '',
    r: finca?.regimen === 'ecologico' ? 'ecologico' : 'convencional',
    c: unico(ciclos.map((c) => c.cultivo)),
    va: unico(ciclos.map((c) => c.variedad)),
    a: areaIds.map((id) => areas.get(id) ?? 'Área'),
    d: [fechas[0] ?? dia, fechas.at(-1) ?? dia],
  };
}

export async function etiquetaDelLote(
  db: CuadernoDb,
  lote: Lote,
  opciones: {
    origen: string;
    /** La API de la celda y el access; nulo sin señal o sin finca en la nube. */
    nube: { api: string; acceso: string } | null;
    fetchFn?: typeof fetch;
  },
): Promise<Etiqueta> {
  const { origen, nube, fetchFn = fetch } = opciones;
  const guardada = (await db.meta.get(claveDe(lote.registro.id)))?.valor as
    | { fragmento: string; datos: DatosQr }
    | undefined;
  if (guardada) {
    return {
      enlace: enlaceQr(origen, guardada.fragmento),
      datos: guardada.datos,
      firmada: true,
      motivo: null,
    };
  }
  const sinFirma = async (motivo: string): Promise<Etiqueta> => {
    const datos = await datosLocales(db, lote);
    return { enlace: enlaceQr(origen, fragmento(codificar(datos))), datos, firmada: false, motivo };
  };
  if (!nube) return sinFirma('Sin señal o sin la finca en la nube: sale «sin confirmar».');
  let r: Response;
  try {
    r = await fetchFn(`${nube.api}/api/v1/lotes/firmar`, {
      method: 'POST',
      headers: { authorization: `Bearer ${nube.acceso}`, 'content-type': 'application/json' },
      body: JSON.stringify({ lote_id: lote.registro.id }),
    });
  } catch {
    return sinFirma('Sin señal: sale «sin confirmar».');
  }
  const cuerpo = (await r.json().catch(() => ({}))) as {
    fragmento?: string;
    datos?: DatosQr;
    motivo?: string;
  };
  if (!r.ok || !cuerpo.fragmento || !cuerpo.datos) {
    return sinFirma(cuerpo.motivo ?? 'La nube no la pudo confirmar: sale «sin confirmar».');
  }
  await db.meta.put({
    clave: claveDe(lote.registro.id),
    valor: { fragmento: cuerpo.fragmento, datos: cuerpo.datos },
    actualizado: new Date().toISOString(),
  });
  return {
    enlace: enlaceQr(origen, cuerpo.fragmento),
    datos: cuerpo.datos,
    firmada: true,
    motivo: null,
  };
}
