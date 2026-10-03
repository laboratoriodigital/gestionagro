/**
 * Lotes de venta (HU-E6.2): elegir cosechas que todavía no están en un lote y armar uno con su
 * código corto. Cada lote dice de qué áreas y fechas viene (CA3); «Cambiar cosechas» lo corrige
 * sin perder el código. Funciona sin señal.
 *
 * Despachos (HU-E6.3): quien los ve (propietario y supervisor) ve el saldo de cada lote,
 * «Despachar» y la lista de despachos.
 */
import { ErrorDeValidacion, fechaAgronomica } from '@gestionagro/agro-schema';
import { useEffect, useState } from 'preact/hooks';
import { cuaderno } from '../almacen/abierto.ts';
import {
  clientesConocidos,
  type DatosDespacho,
  type Despacho,
  leerDespachos,
} from '../almacen/despachos.ts';
import { disponibilidadCsv } from '../almacen/disponibilidad.ts';
import {
  armarLote,
  type CosechaParaLote,
  cosechasSinLote,
  type Lote,
  leerLotes,
} from '../almacen/lotes.ts';
import { Paginador, usarPaginacion } from '../componentes/Paginador.tsx';
import { ControlesPlegables, Plegable, usarPlegables } from '../componentes/Plegables.tsx';
import { corto, descargar } from '../descargar.ts';
import { FormularioDespacho, ListaDespachos } from './Despachos.tsx';
import { EtiquetaQr } from './EtiquetaQr.tsx';
import { SinFinca, usarFinca } from './usarFinca.tsx';
import { SoloConsulta, usarPermisos } from './usarPermisos.tsx';

const coma = (n: number) => n.toLocaleString('es-CO', { maximumFractionDigits: 3 });
const fechaCorta = (f: string) => f.split('-').reverse().slice(0, 2).join('/');

function ElegirCosechas(props: {
  fincaId: string;
  cosechas: CosechaParaLote[];
  corrige?: Lote;
  alTerminar: () => void;
  alCancelar?: () => void;
}) {
  const [elegidas, setElegidas] = useState<Set<string>>(
    new Set(props.corrige?.cosechas.map((c) => c.id) ?? []),
  );
  const [error, setError] = useState<string | null>(null);
  const opciones = [...(props.corrige?.cosechas ?? []), ...props.cosechas];
  const total = opciones.filter((c) => elegidas.has(c.id)).reduce((s, c) => s + c.cantidad, 0);
  const unidades = [...new Set(opciones.filter((c) => elegidas.has(c.id)).map((c) => c.unidad))];

  // Un id por formulario: la misma cosecha libre puede estar en «Cosechas sin lote» y en el
  // lote que se está cambiando.
  const idDe = (cosecha: string) => `cosecha-${props.corrige?.registro.id ?? 'nuevo'}-${cosecha}`;
  const alternar = (id: string) => {
    const nuevas = new Set(elegidas);
    if (nuevas.has(id)) nuevas.delete(id);
    else nuevas.add(id);
    setElegidas(nuevas);
  };
  const guardar = async () => {
    setError(null);
    try {
      await armarLote(cuaderno(), props.fincaId, [...elegidas], {
        corrige: props.corrige?.registro,
      });
      setElegidas(new Set());
      props.alTerminar();
    } catch (e) {
      setError(
        e instanceof ErrorDeValidacion
          ? `No se armó el lote: ${e.campos.map((c) => c.motivo).join('; ')}.`
          : 'No se pudo guardar en el teléfono. Inténtalo otra vez.',
      );
    }
  };

  if (opciones.length === 0) {
    return (
      <p class="ayuda" data-prueba="sin-cosechas-libres">
        No hay cosechas sin lote: todas las anotadas ya están en uno. Para armar otro lote, anota la
        cosecha en <a href="/agro/app/registrar/">Registrar</a>.
      </p>
    );
  }
  return (
    <fieldset class="lote-cosechas" data-prueba="elegir-cosechas">
      <legend>
        {props.corrige ? `Cosechas del lote ${props.corrige.codigo}` : 'Cosechas sin lote'}
      </legend>
      {opciones.map((c) => (
        <div class="opcion" key={c.id}>
          <input
            id={idDe(c.id)}
            type="checkbox"
            checked={elegidas.has(c.id)}
            onChange={() => alternar(c.id)}
          />
          <label for={idDe(c.id)}>
            {c.area} · {fechaCorta(c.fecha)} · {c.categoria} · {coma(c.cantidad)} {c.unidad}
          </label>
        </div>
      ))}
      <p data-prueba="total-lote">
        {elegidas.size === 0
          ? 'Elige las cosechas que van juntas.'
          : `${elegidas.size} ${elegidas.size === 1 ? 'cosecha' : 'cosechas'} · ${coma(total)} ${unidades.join(' + ')}`}
      </p>
      {error && (
        <p class="error" role="alert">
          {error}
        </p>
      )}
      <div class="acciones">
        {props.alCancelar && (
          <button type="button" class="secundario" onClick={props.alCancelar}>
            Cancelar
          </button>
        )}
        <button type="button" disabled={elegidas.size === 0} onClick={() => void guardar()}>
          {props.corrige ? 'Guardar cambios' : 'Armar lote'}
        </button>
      </div>
    </fieldset>
  );
}

export function Lotes() {
  const estado = usarFinca();
  const permisos = usarPermisos();
  const arma = permisos.puede('escribir', 'registro');
  const veVentas = permisos.puedeRegistro('leer', 'despacho');
  const despacha = permisos.puedeRegistro('escribir', 'despacho');
  const [lotes, setLotes] = useState<Lote[] | null>(null);
  // Muchos lotes: por páginas y plegables (revisión del dueño, 3 oct 2026).
  const paginas = usarPaginacion(lotes?.length ?? 0, 25);
  const pagina = (lotes ?? []).slice(paginas.desde, paginas.hasta);
  const plegables = usarPlegables(pagina.map((l) => l.registro.id));
  const [cosechas, setCosechas] = useState<CosechaParaLote[]>([]);
  const [despachos, setDespachos] = useState<Despacho[]>([]);
  const [clientes, setClientes] = useState<DatosDespacho['cliente'][]>([]);
  const [abierto, setAbierto] = useState<{
    tipo: 'cambiar' | 'despachar' | 'etiqueta';
    id: string;
  } | null>(null);
  const fincaId = !estado.cargando && estado.finca ? estado.finca.id : null;

  const cargar = () => {
    if (!fincaId) return;
    const db = cuaderno();
    void Promise.all([
      leerLotes(db, fincaId),
      cosechasSinLote(db, fincaId),
      leerDespachos(db, fincaId),
      clientesConocidos(db, fincaId),
    ]).then(([l, c, d, k]) => {
      setLotes(l);
      setCosechas(c);
      setDespachos(d);
      setClientes(k);
      setAbierto(null);
    });
  };
  useEffect(cargar, [fincaId]);

  if (estado.cargando) return <p>Abriendo tu cuaderno…</p>;
  if (!fincaId) return <SinFinca />;

  return (
    <section aria-labelledby="titulo-lotes">
      <h1 id="titulo-lotes">Lotes de venta</h1>
      <p>
        Junta cosechas en un lote con un código corto para despacharlo y saber de dónde viene. Una
        cosecha va en un solo lote.
      </p>
      {!arma && <SoloConsulta rol={permisos.rol} que="los lotes" />}
      {/* Mientras se cambia un lote, sus cosechas libres se eligen ahí, no en dos sitios. */}
      {arma && lotes !== null && abierto?.tipo !== 'cambiar' && (
        <ElegirCosechas fincaId={fincaId} cosechas={cosechas} alTerminar={cargar} />
      )}
      <h2>Lotes armados</h2>
      {lotes === null ? (
        <p class="ayuda">Cargando lotes…</p>
      ) : lotes.length === 0 ? (
        <p class="ayuda">Todavía no hay lotes.</p>
      ) : (
        <>
          {pagina.length > 1 && <ControlesPlegables p={plegables} que="lotes" id="lotes" />}
          <ul class="areas" data-prueba="lotes">
            {pagina.map((l) => (
              <li class="area" key={l.registro.id} data-prueba="lote">
                <Plegable
                  id={l.registro.id}
                  p={plegables}
                  resumen={
                    <span class="area-titulo">
                      <strong class="codigo-lote">{l.codigo}</strong> · {coma(l.cantidad)}{' '}
                      {l.unidad}
                      {veVentas && (
                        <span class="detalle-insumo">
                          {' '}
                          ·{' '}
                          {l.saldo > 0 ? `quedan ${coma(l.saldo)} ${l.unidad}` : 'todo despachado'}
                        </span>
                      )}
                      {l.avisos.length > 0 && (
                        <span class="sello-area desconocida"> · revisar</span>
                      )}
                    </span>
                  }
                >
                  {veVentas && l.despachado !== 0 && (
                    <p class="detalle-insumo" data-prueba="saldo-lote">
                      {l.saldo > 0
                        ? `Despachado ${coma(l.despachado)} ${l.unidad} · quedan ${coma(l.saldo)} ${l.unidad}`
                        : `Todo despachado (${coma(l.despachado)} ${l.unidad}): no queda nada por despachar.`}
                    </p>
                  )}
                  <p class="detalle-insumo" data-prueba="origen-lote">
                    De{' '}
                    {l.origen
                      .map((o) => `${o.area} (${o.fechas.map(fechaCorta).join(', ')})`)
                      .join(', ')}
                  </p>
                  {l.avisos.map((a) => (
                    <p class="aviso-ecologico" key={a} data-prueba="aviso-lote">
                      {a}
                    </p>
                  ))}
                  {abierto?.tipo === 'despachar' && abierto.id === l.registro.id ? (
                    <FormularioDespacho
                      fincaId={fincaId}
                      lote={l}
                      lotes={lotes}
                      clientes={clientes}
                      alTerminar={cargar}
                      alCancelar={() => setAbierto(null)}
                    />
                  ) : abierto?.tipo === 'etiqueta' && abierto.id === l.registro.id ? (
                    <EtiquetaQr lote={l} alCerrar={() => setAbierto(null)} />
                  ) : abierto?.tipo === 'cambiar' && abierto.id === l.registro.id ? (
                    <ElegirCosechas
                      fincaId={fincaId}
                      cosechas={cosechas}
                      corrige={l}
                      alTerminar={cargar}
                      alCancelar={() => setAbierto(null)}
                    />
                  ) : (
                    (arma || despacha) && (
                      <div class="acciones-area">
                        {arma && (
                          <button
                            type="button"
                            class="secundario"
                            onClick={() => setAbierto({ tipo: 'etiqueta', id: l.registro.id })}
                            aria-label={`Etiqueta QR del lote ${l.codigo}`}
                          >
                            Etiqueta QR
                          </button>
                        )}
                        {despacha && l.saldo > 0 && (
                          <button
                            type="button"
                            onClick={() => setAbierto({ tipo: 'despachar', id: l.registro.id })}
                            aria-label={`Despachar el lote ${l.codigo}`}
                          >
                            Despachar
                          </button>
                        )}
                        {arma && (
                          <button
                            type="button"
                            class="secundario"
                            onClick={() => setAbierto({ tipo: 'cambiar', id: l.registro.id })}
                            aria-label={`Cambiar las cosechas del lote ${l.codigo}`}
                          >
                            Cambiar cosechas
                          </button>
                        )}
                      </div>
                    )
                  )}
                </Plegable>
              </li>
            ))}
          </ul>
          <Paginador id="lotes" total={lotes.length} p={paginas} que="lotes" />
        </>
      )}
      {veVentas && lotes !== null && estado.finca && (
        <div data-prueba="disponibilidad">
          <h2>Para la tienda en línea</h2>
          <p class="ayuda">
            Un archivo con lo que queda de cada lote, para actualizar el catálogo de la tienda sin
            volver a contar. Se abre en Excel o en la hoja de la tienda.
          </p>
          {lotes.some((l) => l.saldo > 0) ? (
            <button
              type="button"
              class="secundario"
              onClick={() => {
                const nombre = estado.finca?.nombre ?? '';
                const hoy = fechaAgronomica(Date.now());
                descargar(
                  `disponibilidad-${corto(nombre)}-${hoy}.csv`,
                  disponibilidadCsv(lotes, nombre),
                  'text/csv;charset=utf-8',
                );
              }}
            >
              Descargar disponibilidad
            </button>
          ) : (
            <p class="ayuda">No queda nada por vender en los lotes.</p>
          )}
        </div>
      )}
      {veVentas && (
        <>
          <h2>Despachos</h2>
          <ListaDespachos despachos={despachos} />
        </>
      )}
    </section>
  );
}
