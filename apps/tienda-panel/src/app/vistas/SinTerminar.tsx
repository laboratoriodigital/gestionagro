/**
 * HU-P1.1 (sprint PF1): las compras sin terminar. Quien marcó «Recordarme mi compra si no la
 * termino» en el carrito y no hizo el pedido en 2 horas sale aquí, con lo que llevaba y su
 * contacto. El comerciante le escribe desde su propio WhatsApp con el mensaje listo y marca
 * «Ya le escribí». Ver los contactos pide el mismo permiso que ver los datos de entrega.
 */
import type { ValorDeFuncion } from '@ed1/tienda-schema';
import { Aviso } from '@ed1/ui/v2/componentes';
import { useCallback, useEffect, useState } from 'preact/hooks';
import { type Conexion, pedirAlPanel } from '../api.ts';
import { enPesos } from '../catalogo.ts';
import { Confirmar } from '../componentes/index.ts';

interface CompraSinTerminar {
  codigo: string;
  actualizado: string;
  totalCop: number;
  productos: string[];
  contacto: { tipo: 'whatsapp' | 'correo'; valor: string } | null;
}

/** El enlace para escribirle, con el mensaje listo y el enlace de la tienda. */
export function enlaceParaEscribir(
  c: NonNullable<CompraSinTerminar['contacto']>,
  tienda: string | undefined,
  productos: readonly string[],
): string {
  const texto = `Hola. Vimos que dejaste sin terminar tu compra${tienda ? ` en ${tienda}` : ''}: ${productos.join(', ')}. ¿Te ayudamos a terminarla?`;
  return c.tipo === 'whatsapp'
    ? `https://wa.me/${c.valor.replace(/\D/g, '')}?text=${encodeURIComponent(texto)}`
    : `mailto:${c.valor}?subject=${encodeURIComponent('Tu compra')}&body=${encodeURIComponent(texto)}`;
}

export function SinTerminar({
  conexion,
  tienda,
  funciones,
  alVencer,
}: {
  conexion: Conexion;
  tienda: string | undefined;
  funciones: Record<string, ValorDeFuncion> | null;
  alVencer: (motivo: string) => void;
}) {
  const [compras, setCompras] = useState<CompraSinTerminar[] | null>(null);
  const [falla, setFalla] = useState<string | null>(null);
  const incluida = funciones?.['compras_sin_terminar'] === true;

  const cargar = useCallback(async () => {
    const r = await pedirAlPanel<{ compras: CompraSinTerminar[] }>(
      conexion,
      'compras-sin-terminar',
    );
    if (r.tipo === 'sin-sesion') return alVencer(r.motivo);
    if (r.tipo !== 'ok') return setFalla(r.motivo);
    setCompras(r.datos.compras);
  }, [conexion, alVencer]);
  useEffect(() => {
    if (incluida) void cargar();
  }, [cargar, incluida]);

  const escrita = async (codigo: string) => {
    const r = await pedirAlPanel(conexion, 'compras-sin-terminar/escrita', { cuerpo: { codigo } });
    if (r.tipo === 'sin-sesion') return alVencer(r.motivo);
    await cargar();
  };

  return (
    <main class="contenido">
      <h1>Compras sin terminar</h1>
      <p class="nota">
        Quienes dejaron su WhatsApp o su correo en el carrito y pidieron que les recordaras su
        compra. Salen aquí 2 horas después, si no hicieron el pedido, y se borran solas a los 30
        días.
      </p>
      {!incluida ? (
        <Aviso tono="info" titulo="Es de los planes Pro e IA Pro">
          Con Pro, tus clientes pueden dejarte su contacto en el carrito para que les recuerdes su
          compra. <a href="/mas/plan/">Ver tu plan</a>
        </Aviso>
      ) : null}
      {falla ? (
        <Aviso tono="peligro" titulo="No pudimos leerlas">
          {falla}
        </Aviso>
      ) : null}
      {incluida && compras?.length === 0 ? <p>No hay compras sin terminar por ahora.</p> : null}
      {compras && compras.length > 0 ? (
        <ul class="lineas">
          {compras.map((c) => (
            <li key={c.codigo} class="compra-sin-terminar">
              <p>
                <strong>{enPesos(c.totalCop)}</strong> · {c.productos.join(', ')}
              </p>
              <p class="nota">
                Carrito <span class="cifra">{c.codigo}</span>
                {c.contacto ? ` · ${c.contacto.valor}` : ' · no se pudo leer el contacto'}
              </p>
              <p class="acciones acciones--fila">
                {c.contacto ? (
                  <a
                    class="ed1-boton ed1-boton--primario"
                    href={enlaceParaEscribir(c.contacto, tienda, c.productos)}
                    target="_blank"
                    rel="noopener"
                  >
                    {c.contacto.tipo === 'whatsapp'
                      ? 'Escribirle por WhatsApp'
                      : 'Escribirle un correo'}
                  </a>
                ) : null}
                <Confirmar
                  abrir="Ya le escribí"
                  consecuencia="Sale de esta lista y queda en el registro."
                  confirmar="Sí, ya le escribí"
                  alConfirmar={() => escrita(c.codigo)}
                />
              </p>
            </li>
          ))}
        </ul>
      ) : null}
      <p>
        <a href="/pedidos/">Volver a pedidos</a>
      </p>
    </main>
  );
}
