/**
 * Mano de obra en «Costos» (HU-E7.2): el costo de las labores por nave en un periodo y el valor del
 * jornal, general o por persona, con la fecha desde la que rige (cambiarlo no toca lo pasado).
 * Un jornal son 8 horas. No liquida nómina ni recargos: lo dice (CA3).
 */
import { HORAS_POR_JORNAL, leerNumero, valorVigente } from '@gestionagro/agro-calc';
import { ErrorDeValidacion, fechaAgronomica, type Persona } from '@gestionagro/agro-schema';
import { useEffect, useState } from 'preact/hooks';
import { cuaderno } from '../almacen/abierto.ts';
import { type ManoDeObraDeArea, manoDeObraPorArea } from '../almacen/mano-de-obra.ts';
import { type ClavePeriodo, OPCIONES_DE_PERIODO, periodoDe } from '../almacen/periodos.ts';
import { definirJornal, definirJornalGeneral, leerPersonas } from '../almacen/personas.ts';
import { Campo, CampoSeleccion } from '../componentes/Campo.tsx';
import { TablaDeslizable } from '../componentes/TablaDeslizable.tsx';

const pesos = (n: number) => `$ ${Math.round(n).toLocaleString('es-CO')}`;

export function ManoDeObra(props: {
  fincaId: string;
  areas: Map<string, string>;
  puedeCambiar: boolean;
}) {
  const hoy = fechaAgronomica(Date.now());
  const [clave, setClave] = useState<ClavePeriodo>('mes');
  const [filas, setFilas] = useState<ManoDeObraDeArea[] | null>(null);
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [vigentes, setVigentes] = useState<Map<string | null, number | null>>(new Map());
  const [quien, setQuien] = useState<string>('general');
  const [valor, setValor] = useState('');
  const [desde, setDesde] = useState(hoy);
  const [error, setError] = useState<string | null>(null);
  const [listo, setListo] = useState<string | null>(null);

  const cargar = () => {
    const db = cuaderno();
    void (async () => {
      setFilas(await manoDeObraPorArea(db, props.fincaId, periodoDe(clave, hoy)));
      const lista = await leerPersonas(db, props.fincaId);
      setPersonas(lista);
      const valores = await db.valor_jornal.filter((v) => v.finca_id === props.fincaId).toArray();
      const vigente = (id: string | null) =>
        valorVigente(
          valores
            .filter((v) => v.persona_id === id)
            .map((v) => ({
              desde: v.vigente_desde,
              valor: v.valor_cop,
              actualizado: v.actualizado,
            })),
          hoy,
        );
      setVigentes(
        new Map([[null, vigente(null)], ...lista.map((p) => [p.id, vigente(p.id)] as const)]),
      );
    })();
  };
  useEffect(cargar, [props.fincaId, clave]);

  const guardar = async (e: Event) => {
    e.preventDefault();
    setError(null);
    setListo(null);
    const leido = leerNumero(valor.replace(/\./g, ''));
    if (!leido.ok || !Number.isInteger(leido.valor) || leido.valor <= 0) {
      setError('Escribe el valor del jornal en pesos, sin decimales.');
      return;
    }
    try {
      const db = cuaderno();
      if (quien === 'general') await definirJornalGeneral(db, props.fincaId, leido.valor, desde);
      else await definirJornal(db, quien, leido.valor, desde);
      setValor('');
      setListo('Valor guardado: rige desde esa fecha y no cambia lo anterior.');
      cargar();
    } catch (err) {
      setError(
        err instanceof ErrorDeValidacion ? err.message : 'No se pudo guardar en el teléfono.',
      );
    }
  };

  const general = vigentes.get(null) ?? null;
  return (
    <div data-prueba="mano-de-obra">
      <h2>Mano de obra por nave</h2>
      <CampoSeleccion
        id="mano-periodo"
        etiqueta="Periodo"
        opciones={OPCIONES_DE_PERIODO}
        valor={clave}
        alCambiar={(x) => setClave((x || 'mes') as ClavePeriodo)}
      />
      {filas === null ? (
        <p class="ayuda">Calculando…</p>
      ) : filas.length === 0 ? (
        <p class="ayuda">No hay labores en este periodo.</p>
      ) : (
        <TablaDeslizable nombre="Mano de obra por nave">
          <table class="tabla-rendimiento" data-prueba="mano-por-area">
            <thead>
              <tr>
                <th scope="col">Nave</th>
                <th scope="col">Horas</th>
                <th scope="col">Costo</th>
              </tr>
            </thead>
            <tbody>
              {filas.map((f) => (
                <tr key={f.areaId}>
                  <th scope="row">{props.areas.get(f.areaId) ?? 'Área'}</th>
                  <td>{f.horas.toLocaleString('es-CO')}</td>
                  <td>
                    {pesos(f.costo)}
                    {f.sinValor > 0 && (
                      <span class="detalle-insumo"> · {f.sinValor} sin valor de jornal</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TablaDeslizable>
      )}
      <p class="ayuda">
        Un jornal son {HORAS_POR_JORNAL} horas. Es el costo para saber cuánto cuesta producir: la
        app no liquida nómina, recargos, horas extra ni prestaciones.
      </p>
      <h3>Valor del jornal</h3>
      <ul class="areas" data-prueba="valores-jornal">
        <li class="area">General de la finca: {general === null ? 'sin valor' : pesos(general)}</li>
        {personas.map((p) => (
          <li class="area" key={p.id}>
            {p.nombre}:{' '}
            {vigentes.get(p.id) != null
              ? pesos(vigentes.get(p.id) ?? 0)
              : general === null
                ? 'sin valor'
                : 'el general'}
          </li>
        ))}
      </ul>
      {props.puedeCambiar && (
        <form
          class="formulario-area"
          onSubmit={(e) => void guardar(e)}
          noValidate
          data-prueba="formulario-jornal"
        >
          <CampoSeleccion
            id="jornal-quien"
            etiqueta="Para quién"
            opciones={[
              { valor: 'general', texto: 'General de la finca' },
              ...personas.map((p) => ({ valor: p.id, texto: p.nombre })),
            ]}
            valor={quien}
            alCambiar={(x) => setQuien(x || 'general')}
          />
          <Campo
            id="jornal-valor"
            etiqueta="Valor del jornal en pesos"
            decimal
            valor={valor}
            alCambiar={setValor}
          />
          <div class="campo">
            <label for="jornal-desde">Rige desde</label>
            <input
              id="jornal-desde"
              type="date"
              value={desde}
              onInput={(e) => setDesde((e.currentTarget as HTMLInputElement).value)}
            />
          </div>
          {error && (
            <p class="error" role="alert">
              {error}
            </p>
          )}
          {listo && (
            <p class="exito" role="status">
              {listo}
            </p>
          )}
          <div class="acciones">
            <button type="submit">Guardar valor</button>
          </div>
        </form>
      )}
    </div>
  );
}
