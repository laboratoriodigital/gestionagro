/**
 * La galería del panel (HU-T3.5, `/_galeria/`): cada componente propio de la Tienda en sus estados,
 * con una tienda llena (300 pedidos) para la prueba de CA3: a 360 px nada hace la página más ancha
 * que el teléfono. Son datos de muestra hechos aquí; no llama a la API. No se indexa (todo el
 * panel lleva `noindex`).
 */
import { formatearPesos } from '@ed1/dinero';
import { Aviso, Campo, Contenido, ResumenDeErrores } from '@ed1/ui/v2/componentes';
import { useState } from 'preact/hooks';
import type { Almacen } from '../almacen.ts';
import { usarBorrador } from '../borradores.ts';
import {
  Barra,
  Confirmar,
  DatoTapado,
  ESTADOS_DE_PEDIDO,
  Estado,
  Lista,
  taparNombre,
  validarTodo,
} from '../componentes/index.ts';

export interface PedidoDeMuestra {
  numero: number;
  hora: string;
  total: number;
  estado: string;
  quien: string;
  forma: string;
  ciudad: string;
}

const FORMAS = ['contra entrega', 'transferencia', 'en línea', 'a convenir'];
const CIUDADES = ['Envigado', 'Medellín', 'Bogotá', 'San José de Cúcuta, Norte de Santander'];

/** `n` pedidos de muestra, siempre los mismos: la prueba no depende del azar (P19). */
export function pedidosDeMuestra(n: number): PedidoDeMuestra[] {
  const estados = Object.keys(ESTADOS_DE_PEDIDO);
  return Array.from({ length: n }, (_, i) => ({
    numero: 1001 + i,
    hora: `${String(8 + (i % 12)).padStart(2, '0')}:${String((i * 7) % 60).padStart(2, '0')}`,
    total: 49_000 + ((i * 37_000) % 2_400_000),
    estado: estados[i % estados.length] ?? 'pendiente',
    quien: `Persona de prueba ${i + 1}`,
    forma: FORMAS[i % FORMAS.length] ?? 'a convenir',
    ciudad: CIUDADES[i % CIUDADES.length] ?? 'Medellín',
  }));
}

const VACIO = { nombre: '', precio: '', sku: '' };
type Producto = typeof VACIO;

function FormularioDeMuestra({ almacen }: { almacen: Almacen }) {
  const { valores, cambiar, olvidar } = usarBorrador<Producto>(almacen, 'galeria-producto', VACIO);
  const [errores, setErrores] = useState<{ campo: string; mensaje: string }[]>([]);
  const [guardado, setGuardado] = useState(false);
  const errorDe = (campo: string) => errores.find((e) => e.campo === campo)?.mensaje;
  return (
    <form
      class="formulario"
      noValidate
      onInput={(e) => {
        const campo = e.target as HTMLInputElement;
        if (campo.name in VACIO) cambiar(campo.name as keyof Producto, campo.value);
        setGuardado(false);
      }}
      onSubmit={async (e) => {
        e.preventDefault();
        const todos = validarTodo(valores, [
          {
            campo: 'nombre',
            mirar: (v) => (v.nombre.trim() ? null : 'Escribe el nombre del producto.'),
          },
          {
            campo: 'precio',
            mirar: (v) =>
              /^[0-9]+$/.test(v.precio.replace(/\./g, '')) &&
              Number(v.precio.replace(/\./g, '')) > 0
                ? null
                : 'Escribe el precio en pesos, sin centavos.',
          },
          {
            campo: 'sku',
            mirar: (v) => (v.sku.length <= 40 ? null : 'La referencia tiene máximo 40 caracteres.'),
          },
        ]);
        setErrores(todos);
        if (todos.length === 0) {
          await olvidar();
          setGuardado(true);
        }
      }}
    >
      <ResumenDeErrores errores={errores} />
      <Campo
        id="nombre"
        nombre="nombre"
        etiqueta="Nombre"
        valor={valores.nombre}
        requerido
        {...(errorDe('nombre') ? { error: errorDe('nombre') as string } : {})}
      />
      <Campo
        id="precio"
        nombre="precio"
        etiqueta="Precio"
        valor={valores.precio}
        requerido
        ayuda="En pesos, sin centavos."
        {...(errorDe('precio') ? { error: errorDe('precio') as string } : {})}
      />
      <Campo
        id="sku"
        nombre="sku"
        etiqueta="Referencia"
        valor={valores.sku}
        {...(errorDe('sku') ? { error: errorDe('sku') as string } : {})}
      />
      {guardado ? (
        <Aviso tono="exito" titulo="Guardado">
          Es una muestra: no se envió a ninguna parte.
        </Aviso>
      ) : null}
      <button class="ed1-boton ed1-boton--primario" type="submit">
        Guardar
      </button>
    </form>
  );
}

export function Galeria({ almacen }: { almacen: Almacen }) {
  const [archivado, setArchivado] = useState(false);
  const pedidos = pedidosDeMuestra(300);
  return (
    <main class="contenido">
      <h1>Componentes del panel</h1>
      <p class="nota">Muestras con datos inventados. Nada de esta página llega a una tienda.</p>

      <h2>Barra</h2>
      <Barra
        tienda="Comercio Ensayo Uno, con un nombre larguísimo para probar el teléfono"
        rol="Propietario"
      />

      <h2>Estados de un pedido</h2>
      <p class="estados">
        {Object.keys(ESTADOS_DE_PEDIDO).map((id) => (
          <Estado key={id} id={id} />
        ))}
        <Estado id="uno_que_no_existe" />
      </p>

      <h2>Datos tapados</h2>
      <dl class="datos">
        <div>
          <dt>Quién recibe</dt>
          <dd>
            <DatoTapado tipo="nombre" valor="Persona de Prueba" />
          </dd>
        </div>
        <div>
          <dt>Celular</dt>
          <dd>
            <DatoTapado tipo="celular" valor="+57 300 123 4567" />
          </dd>
        </div>
        <div>
          <dt>Correo</dt>
          <dd>
            <DatoTapado tipo="correo" valor="ensayo@ejemplo.co" />
          </dd>
        </div>
      </dl>

      <h2>Avisos en la vista de la acción</h2>
      <Aviso tono="peligro" titulo="2 cosas necesitan tu atención">
        Un pago llegó por menos de lo que valía el pedido.
      </Aviso>
      <Aviso tono="exito" titulo="Pedido confirmado" />

      <h2>Lo que no se puede deshacer</h2>
      {archivado ? <Aviso tono="exito" titulo="Producto archivado" /> : null}
      <Confirmar
        abrir="Archivar el producto"
        consecuencia="Deja de verse en la tienda y no se puede volver a pedir. Los pedidos que ya lo tienen no cambian."
        confirmar="Sí, archivarlo"
        alConfirmar={() => setArchivado(true)}
      />

      <h2>Un formulario con todos sus errores a la vez</h2>
      <FormularioDeMuestra almacen={almacen} />

      <h2>Cargando, vacío y error</h2>
      <Contenido
        titulo="Pedidos"
        estado={{ tipo: 'cargando' }}
        vacio={{ porque: '' }}
        elemento={() => null}
      />
      <Contenido
        titulo="Pedidos"
        estado={{ tipo: 'listo', elementos: [] }}
        vacio={{
          porque: 'Todavía no tienes pedidos. Llegan aquí cuando alguien compra en tu tienda.',
        }}
        elemento={() => null}
      />
      <Contenido
        titulo="Pedidos"
        estado={{
          tipo: 'error',
          causa: 'No pudimos traer tus pedidos. Revisa la señal e intenta otra vez.',
        }}
        vacio={{ porque: '' }}
        elemento={() => null}
      />

      <h2>Una tienda llena: 300 pedidos</h2>
      <Lista
        titulo="Pedidos de muestra"
        estado={{ tipo: 'listo', elementos: pedidos }}
        vacio={{ porque: 'Sin pedidos.' }}
        fila={(p) => ({
          href: '/_galeria/',
          dato: `#${p.numero} · ${p.hora}`,
          monto: formatearPesos(p.total),
          estado: <Estado id={p.estado} />,
          detalle: `${taparNombre(p.quien)} · ${p.forma} · ${p.ciudad}`,
        })}
      />
    </main>
  );
}
