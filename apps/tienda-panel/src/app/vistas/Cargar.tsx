/**
 * «Más › Cargar productos y respaldos» (HU-T18.11), para quien administra la tienda en los planes
 * Pro e IA Pro. Dos caminos sobre la misma carga de la API (HU-T12.2): una hoja de productos, que se
 * lee aquí en el teléfono, y el respaldo que baja «Descargar todo». Primero se revisa todo y se dice
 * qué entra; luego se carga por partes, diciendo en cuál va. Nada se borra.
 */

import type { ValorDeFuncion } from '@ed1/tienda-schema';
import { Aviso } from '@ed1/ui/v2/componentes';
import { useState } from 'preact/hooks';
import { type Conexion, pedirAlPanel, type RespuestaDelPanel } from '../api.ts';
import {
  cargaDesdeLaHoja,
  decodificar,
  leerCsv,
  type Problema,
  plantillaCsv,
  problemaDeLaApi,
  respaldoDesde,
} from '../carga-por-lotes.ts';
import { Guia } from '../componentes/index.ts';

interface Resumen {
  productos: number;
  variantes: number;
  colecciones: number;
  envios: number;
  cupones: number;
  paginas: number;
  pedidos: number;
  fotos: number;
  partes: number;
}

type Cual = 'hoja' | 'respaldo';
type Paso =
  | { tipo: 'nada' }
  | { tipo: 'revisando'; cual: Cual }
  | { tipo: 'problemas'; cual: Cual; problemas: Problema[] }
  | { tipo: 'listo'; cual: Cual; carga: unknown; resumen: Resumen }
  | { tipo: 'cargando'; cual: Cual; parte: number; de: number }
  | { tipo: 'hecho'; cual: Cual; resumen: Resumen }
  | { tipo: 'error'; cual: Cual; motivo: string };

const MOSTRAR = 20;

const cuantos = (n: number, uno: string, varios: string) =>
  n === 1 ? `1 ${uno}` : `${n} ${varios}`;

/** Lo que entra, en una frase: solo lo que trae el archivo. */
export function loQueEntra(r: Resumen): string {
  const partes = [
    r.productos ? cuantos(r.productos, 'producto', 'productos') : null,
    r.variantes > r.productos ? cuantos(r.variantes, 'combinación', 'combinaciones') : null,
    r.colecciones ? cuantos(r.colecciones, 'colección', 'colecciones') : null,
    r.envios ? cuantos(r.envios, 'envío', 'envíos') : null,
    r.cupones ? cuantos(r.cupones, 'cupón', 'cupones') : null,
    r.paginas ? cuantos(r.paginas, 'página', 'páginas') : null,
    r.pedidos ? cuantos(r.pedidos, 'pedido cerrado', 'pedidos cerrados') : null,
  ].filter(Boolean);
  if (partes.length === 0) return 'El archivo no trae nada para cargar.';
  const ultima = partes.pop();
  return `${partes.length ? `${partes.join(', ')} y ${ultima}` : ultima}.`;
}

function guardar(nombre: string, datos: string, tipo: string) {
  const url = URL.createObjectURL(new Blob([datos], { type: tipo }));
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function Cargar({
  conexion,
  tienda,
  funciones,
  alVencer,
}: {
  conexion: Conexion;
  tienda: { slug: string; nombre: string };
  funciones: Record<string, ValorDeFuncion> | null;
  alVencer: (motivo: string) => void;
}) {
  const [paso, setPaso] = useState<Paso>({ tipo: 'nada' });
  const ocupado = paso.tipo === 'revisando' || paso.tipo === 'cargando';

  const volver = (
    <p>
      <a href="/mas/">Más</a>
    </p>
  );
  if (funciones?.['carga_por_lotes'] !== true)
    return (
      <main class="contenido">
        {volver}
        <h1>Cargar productos y respaldos</h1>
        <Aviso tono="info" titulo="Es de los planes Pro e IA Pro">
          Con Pro cargas tus productos desde una hoja de Excel, de una vez, y subes el respaldo de
          tu tienda cuando lo necesites.
        </Aviso>
        <p>
          <a href="/mas/plan/">Ver los planes</a>
        </p>
      </main>
    );

  const revisar = async (cual: Cual, carga: unknown, filasDeLaHoja: number[][]) => {
    setPaso({ tipo: 'revisando', cual });
    const r = await pedirAlPanel<{ ok: true; resumen: Resumen }>(conexion, 'importar/revisar', {
      cuerpo: { carga },
    });
    if (r.tipo === 'sin-sesion') return alVencer(r.motivo);
    if (r.tipo === 'ok') return setPaso({ tipo: 'listo', cual, carga, resumen: r.datos.resumen });
    if (r.tipo === 'error' && r.problemas)
      return setPaso({
        tipo: 'problemas',
        cual,
        problemas: r.problemas.map((p) => problemaDeLaApi(p, filasDeLaHoja)),
      });
    setPaso({ tipo: 'error', cual, motivo: r.motivo });
  };

  const leerArchivo = async (cual: Cual, archivo: File | undefined) => {
    if (!archivo) return;
    setPaso({ tipo: 'revisando', cual });
    const texto = decodificar(new Uint8Array(await archivo.arrayBuffer()));
    if (cual === 'hoja') {
      const lectura = cargaDesdeLaHoja(leerCsv(texto), tienda);
      if (!lectura.carga) return setPaso({ tipo: 'problemas', cual, problemas: lectura.problemas });
      return revisar(cual, lectura.carga, lectura.filas);
    }
    const respaldo = respaldoDesde(texto);
    if (!respaldo.ok) return setPaso({ tipo: 'error', cual, motivo: respaldo.motivo });
    return revisar(cual, respaldo.carga, []);
  };

  const cargar = async () => {
    if (paso.tipo !== 'listo') return;
    const { cual, carga, resumen } = paso;
    let parte: number | null = 0;
    while (parte !== null) {
      setPaso({ tipo: 'cargando', cual, parte: parte + 1, de: resumen.partes });
      const r: RespuestaDelPanel<{ siguiente: number | null }> = await pedirAlPanel(
        conexion,
        'importar/aplicar',
        { cuerpo: { carga, parte } },
      );
      if (r.tipo === 'sin-sesion') return alVencer(r.motivo);
      if (r.tipo !== 'ok') {
        return setPaso({
          tipo: 'error',
          cual,
          motivo:
            r.estado === 'fallida'
              ? `Entraron ${parte} de ${resumen.partes} partes y la siguiente no se pudo cargar. Vuelve a subir el mismo archivo: lo que ya entró no se repite.`
              : `Entraron ${parte} de ${resumen.partes} partes. ${r.motivo}`,
        });
      }
      parte = r.datos.siguiente;
    }
    setPaso({ tipo: 'hecho', cual, resumen });
  };

  const estadoDe = (cual: Cual) => {
    if (paso.tipo === 'nada' || paso.cual !== cual) return null;
    if (paso.tipo === 'revisando') return <p role="status">Revisando el archivo…</p>;
    if (paso.tipo === 'cargando')
      return (
        <p role="status">
          Cargando… parte {paso.parte} de {paso.de}. No cierres esta pantalla.
        </p>
      );
    if (paso.tipo === 'error')
      return (
        <Aviso tono="peligro" titulo="No se cargó">
          {paso.motivo}
        </Aviso>
      );
    if (paso.tipo === 'problemas')
      return (
        <Aviso
          tono="peligro"
          titulo={
            paso.problemas.length === 1
              ? 'Falta corregir una cosa'
              : `Falta corregir ${paso.problemas.length} cosas`
          }
        >
          <ul>
            {paso.problemas.slice(0, MOSTRAR).map((p) => (
              <li key={`${p.fila}-${p.mensaje}`}>{p.mensaje}</li>
            ))}
          </ul>
          {paso.problemas.length > MOSTRAR ? (
            <p>Y {paso.problemas.length - MOSTRAR} más. Corrige estos y vuelve a subirlo.</p>
          ) : (
            <p>Corrígelo en tu archivo y vuelve a subirlo. Todavía no se cargó nada.</p>
          )}
        </Aviso>
      );
    if (paso.tipo === 'listo')
      return (
        <div role="status">
          <Aviso tono="info" titulo="Todo en orden">
            Se va a cargar: {loQueEntra(paso.resumen)}
            {paso.cual === 'respaldo' && paso.resumen.fotos
              ? ' Las fotos no viajan en el respaldo: las que ya están en tu tienda se quedan.'
              : ''}
          </Aviso>
          <div class="acciones">
            <button
              class="ed1-boton ed1-boton--primario"
              type="button"
              onClick={() => void cargar()}
            >
              Cargar
            </button>
            <button
              class="ed1-boton ed1-boton--secundario"
              type="button"
              onClick={() => setPaso({ tipo: 'nada' })}
            >
              Cancelar
            </button>
          </div>
        </div>
      );
    return (
      <Aviso tono="exito" titulo="Listo">
        Se cargó: {loQueEntra(paso.resumen)}{' '}
        {paso.cual === 'hoja'
          ? 'Ponles foto en Productos y publica para que salgan en tu tienda.'
          : 'Publica para que tu tienda muestre lo que volvió.'}{' '}
        <a href="/productos/">Ver productos</a>
      </Aviso>
    );
  };

  return (
    <main class="contenido">
      {volver}
      <h1>Cargar productos y respaldos</h1>
      <Guia guia="cargar-productos" />

      <h2>Tus productos, desde una hoja</h2>
      <p>
        Escribe tus productos en Excel, una fila por talla o color, y súbelos de una vez. Los nuevos
        se crean y los que ya tienen su referencia se actualizan: lo que no esté en la hoja no se
        toca. Las fotos se ponen después, en cada producto.
      </p>
      <div class="acciones">
        <button
          class="ed1-boton ed1-boton--secundario"
          type="button"
          onClick={() => guardar('plantilla-productos.csv', plantillaCsv(), 'text/csv')}
        >
          Descargar la plantilla
        </button>
      </div>
      <p class="nota">
        También sirve la hoja «Productos en CSV» de <a href="/mas/datos/">Descargar todo</a>: cambia
        precios o inventario y vuelve a subirla. En Excel, guárdala como «CSV». Hasta 500 filas por
        hoja.
      </p>
      <div class="ed1-campo">
        <label class="ed1-campo__etiqueta" for="hoja-de-productos">
          Elige tu hoja (CSV)
        </label>
        <input
          class="ed1-campo__control"
          id="hoja-de-productos"
          type="file"
          accept=".csv,text/csv"
          disabled={ocupado}
          onChange={(e) => {
            const input = e.target as HTMLInputElement;
            void leerArchivo('hoja', input.files?.[0]);
            input.value = '';
          }}
        />
      </div>
      {estadoDe('hoja')}

      <h2>Subir un respaldo</h2>
      <p>
        El archivo que baja «Descargar todo» trae tus productos, colecciones, envíos, cupones,
        páginas, ajustes y pedidos cerrados. Súbelo para volver a ponerlos: no borra nada de lo que
        ya tienes, y los datos personales de tus compradores no se suben.
      </p>
      <div class="ed1-campo">
        <label class="ed1-campo__etiqueta" for="respaldo">
          Elige el respaldo (.json)
        </label>
        <input
          class="ed1-campo__control"
          id="respaldo"
          type="file"
          accept=".json,application/json"
          disabled={ocupado}
          onChange={(e) => {
            const input = e.target as HTMLInputElement;
            void leerArchivo('respaldo', input.files?.[0]);
            input.value = '';
          }}
        />
      </div>
      {estadoDe('respaldo')}
    </main>
  );
}
