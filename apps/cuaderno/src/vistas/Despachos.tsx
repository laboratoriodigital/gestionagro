/**
 * Despachar un lote y ver los despachos (HU-E6.3). Vive en «Lotes»: se despacha de un lote, y se
 * pueden sumar otros con la misma unidad. Solo lo ven propietario y supervisor (CA3).
 */
import { leerNumero } from '@ed1/agro-calc';
import { ErrorDeValidacion } from '@ed1/agro-schema';
import { useEffect, useState } from 'preact/hooks';
import { abrirFormulario } from '../actividad.ts';
import { cuaderno } from '../almacen/abierto.ts';
import {
  type DatosDespacho,
  type Despacho,
  type MedioDePago,
  registrarDespacho,
  type TipoDeCliente,
} from '../almacen/despachos.ts';
import type { Lote } from '../almacen/lotes.ts';
import { Campo, Opciones } from '../componentes/Campo.tsx';

const TIPOS: readonly { valor: TipoDeCliente; texto: string }[] = [
  { valor: 'consumidor', texto: 'Consumidor' },
  { valor: 'restaurante', texto: 'Restaurante' },
  { valor: 'tienda', texto: 'Tienda' },
  { valor: 'cadena', texto: 'Cadena' },
];
const MEDIOS: readonly { valor: MedioDePago; texto: string }[] = [
  { valor: 'efectivo', texto: 'Efectivo' },
  { valor: 'transferencia', texto: 'Transferencia' },
  { valor: 'credito', texto: 'A crédito' },
  { valor: 'otro', texto: 'Otro' },
];
const NOMBRE_TIPO = Object.fromEntries(TIPOS.map((t) => [t.valor, t.texto.toLowerCase()]));
const NOMBRE_MEDIO = Object.fromEntries(MEDIOS.map((m) => [m.valor, m.texto.toLowerCase()]));

const coma = (n: number) => n.toLocaleString('es-CO', { maximumFractionDigits: 3 });
export const pesos = (n: number) => `$ ${n.toLocaleString('es-CO')}`;
const normal = (s: string) => s.trim().replace(/\s+/g, ' ').toLocaleLowerCase('es');

export function FormularioDespacho(props: {
  fincaId: string;
  lote: Lote;
  lotes: Lote[];
  clientes: DatosDespacho['cliente'][];
  alTerminar: () => void;
  alCancelar: () => void;
}) {
  const [cliente, setCliente] = useState('');
  const [tipo, setTipo] = useState<TipoDeCliente | ''>('');
  const [lineas, setLineas] = useState<{ lote: Lote; cantidad: string }[]>([
    { lote: props.lote, cantidad: '' },
  ]);
  const [precio, setPrecio] = useState('');
  const [medio, setMedio] = useState<MedioDePago | ''>('');
  const [errores, setErrores] = useState<Record<string, string>>({});
  useEffect(() => abrirFormulario(), []);

  const otros = props.lotes.filter(
    (l) =>
      l.saldo > 0 &&
      l.unidad === props.lote.unidad &&
      !lineas.some((x) => x.lote.registro.id === l.registro.id),
  );
  const elegirCliente = (nombre: string) => {
    setCliente(nombre);
    const conocido = props.clientes.find((c) => normal(c.nombre) === normal(nombre));
    if (conocido) setTipo(conocido.tipo);
  };

  const guardar = async (e: Event) => {
    e.preventDefault();
    const err: Record<string, string> = {};
    // Un precio que no se puede leer se dice; nunca se guarda como cero (CA5, P1).
    let precioUnitario: number | null = null;
    if (precio.trim()) {
      const leido = leerNumero(precio.replace(/\./g, ''));
      if (!leido.ok || !Number.isInteger(leido.valor) || leido.valor <= 0) {
        err['precio'] = 'Escribe el precio en pesos, sin decimales, o déjalo vacío.';
      } else precioUnitario = leido.valor;
    }
    const cantidades = lineas.map((l, i) => {
      const leido = leerNumero(l.cantidad);
      if (!leido.ok || leido.valor <= 0) err[`cantidad-${i}`] = 'Escribe cuánto sale de este lote.';
      return leido.ok ? leido.valor : 0;
    });
    setErrores(err);
    if (Object.keys(err).length > 0) return;
    try {
      await registrarDespacho(cuaderno(), props.fincaId, {
        cliente: { nombre: cliente, tipo },
        lineas: lineas.map((l, i) => ({
          loteId: l.lote.registro.id,
          cantidad: cantidades[i] ?? 0,
        })),
        precioUnitario,
        medioPago: medio,
      });
      props.alTerminar();
    } catch (error) {
      setErrores({
        general:
          error instanceof ErrorDeValidacion
            ? `No se guardó: ${error.campos.map((c) => c.motivo).join('; ')}.`
            : 'No se pudo guardar en el teléfono. Inténtalo otra vez.',
      });
    }
  };

  return (
    <form
      class="formulario-area"
      onSubmit={(e) => void guardar(e)}
      noValidate
      data-prueba="formulario-despacho"
    >
      <h3>Despachar el lote {props.lote.codigo}</h3>
      <div class="campo">
        <label for="despacho-cliente">Cliente</label>
        <input
          id="despacho-cliente"
          type="text"
          autoComplete="off"
          list="despacho-clientes"
          value={cliente}
          onInput={(e) => elegirCliente((e.currentTarget as HTMLInputElement).value)}
        />
        <datalist id="despacho-clientes">
          {props.clientes.map((c) => (
            <option key={c.nombre} value={c.nombre} />
          ))}
        </datalist>
      </div>
      <Opciones
        nombre="despacho-tipo"
        leyenda="Tipo de cliente"
        opciones={TIPOS}
        valor={tipo}
        alCambiar={setTipo}
      />
      {lineas.map((l, i) => (
        <Campo
          key={l.lote.registro.id}
          id={`despacho-cantidad-${i}`}
          etiqueta={`Cantidad del lote ${l.lote.codigo} (${l.lote.unidad})`}
          ayuda={`Quedan ${coma(l.lote.saldo)} ${l.lote.unidad}.`}
          decimal
          valor={l.cantidad}
          error={errores[`cantidad-${i}`]}
          alCambiar={(v) => setLineas(lineas.map((x, j) => (j === i ? { ...x, cantidad: v } : x)))}
        />
      ))}
      {otros.length > 0 && (
        <div class="campo">
          <label for="despacho-otro-lote">Sumar otro lote (opcional)</label>
          <select
            id="despacho-otro-lote"
            value=""
            onChange={(e) => {
              const id = (e.currentTarget as HTMLSelectElement).value;
              const lote = otros.find((l) => l.registro.id === id);
              if (lote) setLineas([...lineas, { lote, cantidad: '' }]);
            }}
          >
            <option value="">Elige un lote</option>
            {otros.map((l) => (
              <option key={l.registro.id} value={l.registro.id}>
                {l.codigo} · quedan {coma(l.saldo)} {l.unidad}
              </option>
            ))}
          </select>
        </div>
      )}
      <Campo
        id="despacho-precio"
        etiqueta={`Precio por ${props.lote.unidad} en pesos (opcional)`}
        ayuda="Si lo dejas vacío, queda «sin precio anotado»."
        decimal
        valor={precio}
        error={errores['precio']}
        alCambiar={setPrecio}
      />
      <Opciones
        nombre="despacho-medio"
        leyenda="Cómo te pagó"
        opciones={MEDIOS}
        valor={medio}
        alCambiar={setMedio}
      />
      {errores['general'] && (
        <p class="error" role="alert">
          {errores['general']}
        </p>
      )}
      <div class="acciones">
        <button type="button" class="secundario" onClick={props.alCancelar}>
          Cancelar
        </button>
        <button type="submit">Guardar despacho</button>
      </div>
    </form>
  );
}

export function ListaDespachos(props: { despachos: Despacho[] }) {
  if (props.despachos.length === 0) return <p class="ayuda">Todavía no hay despachos.</p>;
  return (
    <ul class="areas" data-prueba="despachos">
      {props.despachos.map((d) => (
        <li class="area" key={d.registro.id} data-prueba="despacho">
          <p class="area-titulo">
            <strong>{d.datos.cliente.nombre}</strong> · {NOMBRE_TIPO[d.datos.cliente.tipo]} ·{' '}
            {d.registro.fecha_agronomica.split('-').reverse().join('/')}
          </p>
          <p class="detalle-insumo">
            {d.datos.lineas
              .map((l, i) => `${d.codigos[i] ?? l.codigo}: ${coma(l.cantidad)} ${d.datos.unidad}`)
              .join(' · ')}
          </p>
          <p class="detalle-insumo" data-prueba="precio-despacho">
            {d.total === null || d.datos.precio_unitario_cop === null
              ? 'Sin precio anotado'
              : `${pesos(d.datos.precio_unitario_cop)} por ${d.datos.unidad} · total ${pesos(d.total)}`}{' '}
            · {NOMBRE_MEDIO[d.datos.medio_pago]}
          </p>
        </li>
      ))}
    </ul>
  );
}
