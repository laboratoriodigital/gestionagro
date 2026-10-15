/**
 * «Descargar todo» (HU-T10.7, TIENDA-3.0 §1.3: «tus datos son tuyos»). El archivo completo en
 * `tienda-export/1`, que sirve para volver, y las hojas en CSV o XLSX, armadas aquí en el teléfono.
 * Los datos personales de los compradores, solo para quien administra la tienda: piden haber
 * entrado hace poco y quedan en el registro (CA2).
 */
import { puede } from '@ed1/tienda-schema/permisos';
import { Aviso } from '@ed1/ui/v2/componentes';
import { useState } from 'preact/hooks';
import { type Conexion, pedirAlPanel } from '../api.ts';
import { Casilla } from '../componentes/index.ts';
import { aCsv, aXlsx, type Exportacion, hojasDe, nombreDelArchivo } from '../exportar.ts';

type Formato = 'json' | 'xlsx' | 'csv-productos' | 'csv-pedidos';

function guardar(nombre: string, datos: BlobPart, tipo: string) {
  const url = URL.createObjectURL(new Blob([datos], { type: tipo }));
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

const pedidos = (n: number) => (n === 1 ? '1 pedido' : `${n} pedidos`);

export function Datos({
  conexion,
  rol,
  alVencer,
}: {
  conexion: Conexion;
  rol: string;
  alVencer: (motivo: string) => void;
}) {
  const [personales, setPersonales] = useState(false);
  const [ocupado, setOcupado] = useState<Formato | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [listo, setListo] = useState<Exportacion | null>(null);
  const puedePersonales = puede(rol, 'exportar.datos_personales');

  const descargar = async (formato: Formato) => {
    setOcupado(formato);
    setError(null);
    const conPersonales = formato === 'json' && personales;
    const r = await pedirAlPanel<Exportacion>(
      conexion,
      conPersonales ? 'exportar?datos=personales' : 'exportar',
    );
    setOcupado(null);
    if (r.tipo === 'sin-sesion') return alVencer(r.motivo);
    if (r.tipo !== 'ok') return setError(r.motivo);
    const e = r.datos;
    const [productos, delPedido] = hojasDe(e);
    if (formato === 'json')
      guardar(nombreDelArchivo(e, 'json'), JSON.stringify(e, null, 2), 'application/json');
    else if (formato === 'xlsx')
      guardar(
        nombreDelArchivo(e, 'xlsx'),
        aXlsx(hojasDe(e)),
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      );
    else {
      const hoja = formato === 'csv-productos' ? productos : delPedido;
      if (hoja) guardar(nombreDelArchivo(e, 'csv', hoja.nombre), aCsv(hoja.filas), 'text/csv');
    }
    setListo(e);
  };

  const boton = (formato: Formato, texto: string, primario = false) => (
    <button
      class={`ed1-boton ${primario ? 'ed1-boton--primario' : 'ed1-boton--secundario'}`}
      type="button"
      disabled={ocupado !== null}
      aria-busy={ocupado === formato ? 'true' : undefined}
      onClick={() => void descargar(formato)}
    >
      {texto}
    </button>
  );

  const excluidos = listo
    ? listo.excluidos.pedidosEnCurso + listo.excluidos.pedidosSinSuVariante
    : 0;
  return (
    <main class="contenido">
      <p>
        <a href="/mas/">Más</a>
      </p>
      <h1>Descargar todo</h1>
      <p>
        Tus datos son tuyos. El archivo completo trae los ajustes, los productos con sus fotos por
        enlace, las colecciones, los envíos, los cupones, las páginas y los pedidos cerrados: con él
        puedes cargar la tienda otra vez, aquí o en otro lado.
      </p>
      {error ? (
        <Aviso tono="peligro" titulo="No se descargó">
          {error}
        </Aviso>
      ) : null}
      {listo ? (
        <Aviso tono="info" titulo="Listo">
          Se descargó con{' '}
          {listo.productos.length === 1 ? '1 producto' : `${listo.productos.length} productos`} y{' '}
          {pedidos(listo.pedidos.length)}.
          {excluidos
            ? ` No van ${pedidos(excluidos)}: ${listo.excluidos.pedidosEnCurso} en curso y ${listo.excluidos.pedidosSinSuVariante} con un producto que ya no se vende como se vendió.`
            : ''}
          {listo.datosPersonales ? ' Lleva los datos personales: guárdalo en un lugar seguro.' : ''}
        </Aviso>
      ) : null}
      {puedePersonales ? (
        <Casilla
          id="personales"
          marcada={personales}
          alCambiar={setPersonales}
          etiqueta={
            <span>
              Incluir los datos personales de los compradores (contactos de los pedidos y
              solicitudes). Pide que hayas entrado hace poco y queda en el registro.
            </span>
          }
        />
      ) : null}
      <div class="acciones">
        {boton(
          'json',
          personales ? 'Descargar todo, con datos personales' : 'Descargar todo',
          true,
        )}
        <h2>Hojas para Excel</h2>
        <p class="nota">Sin datos personales. Se arman en tu teléfono.</p>
        {boton('xlsx', 'Productos y pedidos en Excel')}
        {boton('csv-productos', 'Productos en CSV')}
        {boton('csv-pedidos', 'Pedidos en CSV')}
      </div>
    </main>
  );
}
