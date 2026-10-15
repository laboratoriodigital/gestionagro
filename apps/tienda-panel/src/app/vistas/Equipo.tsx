/**
 * HU-T10.5: el equipo. Quien administra la tienda invita a un colaborador con un enlace por
 * WhatsApp; el colaborador ayuda con el día a día y no ve a dónde llega la plata. Lo que puede y lo
 * que no lo decide la matriz de permisos en la API; aquí se dice en palabras.
 */

import { puede } from '@ed1/tienda-schema/permisos';
import { Aviso } from '@ed1/ui/v2/componentes';
import { useState } from 'preact/hooks';
import type { Conexion } from '../api.ts';
import { crearInvitacion, enlaceDeWhatsApp } from '../equipo.ts';

type Estado =
  | { tipo: 'nada' }
  | { tipo: 'creando' }
  | { tipo: 'lista'; enlace: string; mensaje: string; expira: string }
  | { tipo: 'error'; motivo: string };

export function Equipo({
  conexion,
  rol,
  tienda,
}: {
  conexion: Conexion;
  rol: string;
  tienda: string;
}) {
  const [estado, setEstado] = useState<Estado>({ tipo: 'nada' });
  if (!puede(rol, 'equipo.gestionar'))
    return (
      <main class="contenido">
        <h1>Equipo</h1>
        <p>Solo quien administra la tienda maneja el equipo.</p>
      </main>
    );

  const invitar = async () => {
    setEstado({ tipo: 'creando' });
    const r = await crearInvitacion(conexion, { origen: location.origin, tienda });
    setEstado(
      r.tipo === 'ok'
        ? { tipo: 'lista', enlace: r.enlace, mensaje: r.mensaje, expira: r.expira }
        : { tipo: 'error', motivo: r.motivo },
    );
  };

  return (
    <main class="contenido">
      <p>
        <a href="/mas/">Más</a>
      </p>
      <h1>Equipo</h1>
      <p>Invita a alguien que te ayude con la tienda. Como colaborador puede:</p>
      <ul>
        <li>ver y atender los pedidos, despacharlos y llevar los recaudos;</li>
        <li>cargar productos, fotos e inventario;</li>
        <li>cambiar envíos, cupones y la apariencia, y publicar.</li>
      </ul>
      <p>
        No puede cambiar el cobro, el dominio, el plan, el equipo ni cómo llegan los pedidos, ni
        descargar los datos de tus compradores.
      </p>
      <button
        class="ed1-boton ed1-boton--primario"
        type="button"
        disabled={estado.tipo === 'creando'}
        aria-busy={estado.tipo === 'creando' ? 'true' : undefined}
        onClick={() => void invitar()}
      >
        Invitar a un colaborador
      </button>
      {estado.tipo === 'error' ? (
        <Aviso tono="peligro" titulo="No se creó la invitación">
          {estado.motivo}
        </Aviso>
      ) : null}
      {estado.tipo === 'lista' ? (
        <Aviso tono="exito" titulo="La invitación está lista">
          <p>Sirve una sola vez. Mándala por WhatsApp a la persona que vas a invitar.</p>
          <p>
            <a
              class="ed1-boton ed1-boton--primario"
              href={enlaceDeWhatsApp(estado.mensaje)}
              target="_blank"
              rel="noopener"
            >
              Mandar por WhatsApp
            </a>
          </p>
          <p class="nota">
            O copia el enlace: <span class="cifra">{estado.enlace}</span>
          </p>
        </Aviso>
      ) : null}
    </main>
  );
}
