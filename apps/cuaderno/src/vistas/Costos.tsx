/**
 * Costos (HU-E7.1 y HU-E7.2): la bodega de insumos con su costo promedio ponderado, las compras y
 * ajustes, el costo de los insumos aplicados por nave y ciclo, y la mano de obra por nave. Los costos son del plan Finca
 * (ARQUITECTURA §2.4) y solo los ven propietario y supervisor (§9); el campo no se bloquea nunca:
 * una existencia negativa se avisa (CA3).
 */
import { leerNumero } from '@gestionagro/agro-calc';
import { ErrorDeValidacion, type Insumo } from '@gestionagro/agro-schema';
import { useEffect, useState } from 'preact/hooks';
import { cuaderno } from '../almacen/abierto.ts';
import {
  type CostoDeArea,
  costoDeInsumosPorArea,
  type ExistenciaDeInsumo,
  estadoDeBodega,
  registrarMovimiento,
} from '../almacen/bodega.ts';
import { leerInsumos } from '../almacen/insumos.ts';
import { leerSesion, planDeLaFinca } from '../almacen/sesion.ts';
import { Campo, CampoSeleccion, Opciones } from '../componentes/Campo.tsx';
import { ManoDeObra } from './ManoDeObra.tsx';
import { SinFinca, usarFinca } from './usarFinca.tsx';
import { usarPermisos } from './usarPermisos.tsx';

const pesos = (n: number) => `$ ${Math.round(n).toLocaleString('es-CO')}`;
const cantidad = (n: number) => n.toLocaleString('es-CO', { maximumFractionDigits: 2 });

function FormularioMovimiento(props: {
  fincaId: string;
  insumos: Insumo[];
  alGuardar: () => void;
}) {
  const [insumoId, setInsumoId] = useState('');
  const [clase, setClase] = useState<'compra' | 'ajuste' | ''>('compra');
  const [texto, setTexto] = useState('');
  const [precio, setPrecio] = useState('');
  const [nota, setNota] = useState('');
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [listo, setListo] = useState<string | null>(null);
  const unidad = props.insumos.find((i) => i.id === insumoId)?.unidad ?? '';

  const guardar = async (e: Event) => {
    e.preventDefault();
    const err: Record<string, string> = {};
    if (!insumoId) err['insumo'] = 'Elige el insumo.';
    const c = leerNumero(texto);
    if (!c.ok) err['cantidad'] = texto ? c.motivo : 'Escribe la cantidad.';
    let precioTotal: number | null = null;
    if (clase === 'compra' && precio.trim()) {
      const leido = leerNumero(precio.replace(/\./g, ''));
      if (!leido.ok || !Number.isInteger(leido.valor) || leido.valor <= 0) {
        err['precio'] = 'Escribe el precio en pesos, sin decimales, o déjalo vacío.';
      } else precioTotal = leido.valor;
    }
    setErrores(err);
    setListo(null);
    if (Object.keys(err).length > 0 || !c.ok || !clase) return;
    try {
      await registrarMovimiento(cuaderno(), props.fincaId, {
        insumoId,
        clase,
        cantidad: c.valor,
        precioTotal,
        nota,
      });
      setTexto('');
      setPrecio('');
      setNota('');
      setListo(
        clase === 'compra'
          ? 'Compra guardada en este teléfono.'
          : 'Ajuste guardado en este teléfono.',
      );
      props.alGuardar();
    } catch (error) {
      setErrores({
        general:
          error instanceof ErrorDeValidacion
            ? `No se guardó: ${error.campos.map((x) => x.motivo).join('; ')}.`
            : 'No se pudo guardar en el teléfono. Inténtalo otra vez.',
      });
    }
  };

  return (
    <form
      class="formulario-area"
      onSubmit={(e) => void guardar(e)}
      noValidate
      data-prueba="formulario-bodega"
    >
      <h3>Registrar una compra o un ajuste</h3>
      <CampoSeleccion
        id="bodega-insumo"
        etiqueta="Insumo"
        indicacion="Elige el insumo"
        opciones={props.insumos.map((i) => ({
          valor: i.id,
          texto: `${i.nombre_comercial} (${i.unidad})`,
        }))}
        valor={insumoId}
        error={errores['insumo']}
        alCambiar={setInsumoId}
      />
      <Opciones
        nombre="bodega-clase"
        leyenda="Qué fue"
        opciones={[
          { valor: 'compra', texto: 'Compra' },
          { valor: 'ajuste', texto: 'Ajuste por conteo' },
        ]}
        valor={clase}
        alCambiar={setClase}
      />
      <Campo
        id="bodega-cantidad"
        etiqueta={`Cantidad${unidad ? ` (${unidad})` : ''}`}
        ayuda={
          clase === 'ajuste'
            ? 'Con signo menos si faltaba (por ejemplo −50); sin signo si sobraba.'
            : 'Lo que entró a la bodega.'
        }
        decimal
        valor={texto}
        error={errores['cantidad']}
        alCambiar={setTexto}
      />
      {clase === 'compra' && (
        <Campo
          id="bodega-precio"
          etiqueta="Precio total pagado en pesos (opcional)"
          ayuda="Sin precio, el costo de ese insumo queda «sin dato» hasta la próxima compra con precio."
          decimal
          valor={precio}
          error={errores['precio']}
          alCambiar={setPrecio}
        />
      )}
      <Campo id="bodega-nota" etiqueta="Nota (opcional)" valor={nota} alCambiar={setNota} />
      {errores['general'] && (
        <p class="error" role="alert">
          {errores['general']}
        </p>
      )}
      {listo && (
        <p class="exito" role="status">
          {listo}
        </p>
      )}
      <div class="acciones">
        <button type="submit">Guardar</button>
      </div>
    </form>
  );
}

export function Costos() {
  const estado = usarFinca();
  const permisos = usarPermisos();
  const [plan, setPlan] = useState<string | null>(null);
  const [bodega, setBodega] = useState<ExistenciaDeInsumo[] | null>(null);
  const [porArea, setPorArea] = useState<CostoDeArea[]>([]);
  const [insumos, setInsumos] = useState<Insumo[]>([]);
  const [nombres, setNombres] = useState<{
    areas: Map<string, string>;
    ciclos: Map<string, string>;
  }>({
    areas: new Map(),
    ciclos: new Map(),
  });
  const fincaId = !estado.cargando && estado.finca ? estado.finca.id : null;

  const cargar = () => {
    if (!fincaId) return;
    const db = cuaderno();
    void (async () => {
      setPlan(planDeLaFinca(await leerSesion(db)));
      setInsumos(await leerInsumos(db, fincaId));
      setBodega(await estadoDeBodega(db, fincaId));
      setPorArea(await costoDeInsumosPorArea(db, fincaId));
      setNombres({
        areas: new Map((await db.area.toArray()).map((a) => [a.id, a.nombre])),
        ciclos: new Map(
          (await db.ciclo.toArray()).map((c) => [c.id, `${c.cultivo} · ${c.variedad}`]),
        ),
      });
    })();
  };
  useEffect(cargar, [fincaId]);

  if (estado.cargando || plan === null || permisos.rol === undefined)
    return <p>Abriendo tu cuaderno…</p>;
  if (!fincaId) return <SinFinca />;

  const titulo = <h1 id="titulo-costos">Costos</h1>;
  if (plan === 'gratuito') {
    return (
      <section aria-labelledby="titulo-costos" data-prueba="costos-plan">
        {titulo}
        <p>
          Los costos vienen con el plan Finca: lo que tienes en bodega y cuánto vale, cuánto cuesta
          lo que se aplica en cada nave y, después, la mano de obra y el costo por kilo.
        </p>
        <p class="ayuda">
          Mientras tanto, anota la cantidad usada en cada aplicación: cuando tengas el plan, la
          bodega y los costos salen de esos registros.
        </p>
      </section>
    );
  }
  if (!permisos.puedeRegistro('leer', 'movimiento_insumo')) {
    return (
      <section aria-labelledby="titulo-costos">
        {titulo}
        <p class="ayuda" data-prueba="solo-consulta">
          Los costos los ven el propietario y el supervisor de la finca.
        </p>
      </section>
    );
  }

  return (
    <section aria-labelledby="titulo-costos">
      {titulo}
      <h2>Bodega</h2>
      {bodega === null ? (
        <p class="ayuda">Calculando…</p>
      ) : bodega.length === 0 ? (
        <p class="ayuda">Todavía no hay compras ni aplicaciones con cantidad.</p>
      ) : (
        <ul class="areas" data-prueba="bodega">
          {bodega.map((b) => (
            <li class="area" key={b.insumoId} data-prueba="existencia">
              <p class="area-titulo">
                <strong>{b.insumo}</strong> · quedan {cantidad(b.existencia)} {b.unidad}
              </p>
              <p class="detalle-insumo">
                {b.costoUnitario === null
                  ? 'Costo sin dato: alguna compra no tiene precio.'
                  : `${pesos(b.costoUnitario)} por ${b.unidad}${b.valor === null ? '' : ` · en bodega ${pesos(b.valor)}`}`}
              </p>
              {b.quedoNegativa && (
                <p class="aviso-ecologico" data-prueba="aviso-negativa">
                  Se aplicó más de lo que entró: falta registrar alguna compra o un ajuste.
                </p>
              )}
              {b.sinCantidad > 0 && (
                <p class="ayuda">
                  {b.sinCantidad === 1 ? '1 aplicación' : `${b.sinCantidad} aplicaciones`} sin
                  cantidad anotada: no se descontaron.
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
      {permisos.puedeRegistro('escribir', 'movimiento_insumo') && (
        <FormularioMovimiento fincaId={fincaId} insumos={insumos} alGuardar={cargar} />
      )}
      <h2>Insumos aplicados por nave</h2>
      {porArea.length === 0 ? (
        <p class="ayuda">Todavía no hay aplicaciones.</p>
      ) : (
        <table class="tabla-rendimiento" data-prueba="costo-por-area">
          <thead>
            <tr>
              <th scope="col">Nave y ciclo</th>
              <th scope="col">Costo</th>
            </tr>
          </thead>
          <tbody>
            {porArea.map((c) => (
              <tr key={`${c.areaId}|${c.cicloId}`}>
                <th scope="row">
                  {nombres.areas.get(c.areaId) ?? 'Área'}
                  <span class="detalle-insumo">
                    {c.cicloId ? ` · ${nombres.ciclos.get(c.cicloId) ?? 'ciclo'}` : ' · sin ciclo'}{' '}
                    · {c.aplicaciones} {c.aplicaciones === 1 ? 'aplicación' : 'aplicaciones'}
                  </span>
                </th>
                <td>
                  {pesos(c.costo)}
                  {c.sinCosto > 0 && <span class="detalle-insumo"> · {c.sinCosto} sin costo</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {permisos.puede('leer', 'valor_jornal') && (
        <ManoDeObra
          fincaId={fincaId}
          areas={nombres.areas}
          puedeCambiar={permisos.puede('escribir', 'valor_jornal')}
        />
      )}
    </section>
  );
}
