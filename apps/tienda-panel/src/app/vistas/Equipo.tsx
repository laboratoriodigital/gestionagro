/**
 * HU-T10.5: el equipo. Quien administra la tienda invita a un colaborador con un enlace por
 * WhatsApp; el colaborador ayuda con el día a día y no ve a dónde llega la plata. Lo que puede y lo
 * que no lo decide la matriz de permisos en la API; aquí se dice en palabras.
 *
 * Validación del 20 oct 2026: la lista de quién tiene acceso, del CORE, con «Quitar». Y el tope de
 * personas del plan (HU-T13.5): con el equipo lleno, el panel no ofrece invitar.
 */

import { puede } from '@ed1/tienda-schema/permisos';
import { Aviso } from '@ed1/ui/v2/componentes';
import { useCallback, useEffect, useState } from 'preact/hooks';
import type { Conexion } from '../api.ts';
import { Confirmar } from '../componentes/index.ts';
import {
  crearInvitacion,
  enlaceDeWhatsApp,
  type Miembro,
  quitarDelEquipo,
  ROLES_INVITABLES,
  type RolInvitable,
  verEquipo,
} from '../equipo.ts';
import { NOMBRE_DEL_ROL } from './ElegirTienda.tsx';

type Estado =
  | { tipo: 'nada' }
  | { tipo: 'creando' }
  | { tipo: 'lista'; enlace: string; mensaje: string; expira: string }
  | { tipo: 'error'; motivo: string };

export function Equipo({
  conexion,
  rol,
  tienda,
  limite = null,
}: {
  conexion: Conexion;
  rol: string;
  tienda: string;
  /** Cuántas personas permite el plan, contándote; `null`: sin límite. */
  limite?: number | null;
}) {
  const [estado, setEstado] = useState<Estado>({ tipo: 'nada' });
  const [miembros, setMiembros] = useState<Miembro[] | null>(null);
  const [falla, setFalla] = useState<string | null>(null);
  // HU-P3.3: a quién se invita: un colaborador o alguien que solo despacha.
  const [invitado, setInvitado] = useState<RolInvitable>('colaborador');
  const gestiona = puede(rol, 'equipo.gestionar');
  const cargar = useCallback(async () => {
    const r = await verEquipo(conexion);
    if (r.tipo === 'ok') {
      setFalla(null);
      setMiembros(r.miembros);
    } else setFalla(r.motivo);
  }, [conexion]);
  useEffect(() => {
    if (gestiona) void cargar();
  }, [gestiona, cargar]);
  const quitar = async (m: Miembro) => {
    const r = await quitarDelEquipo(conexion, m.usuario_id);
    if (r.tipo === 'error') setFalla(r.motivo);
    await cargar();
  };
  const lleno = limite !== null && miembros !== null && miembros.length >= limite;
  if (!gestiona)
    return (
      <main class="contenido">
        <h1>Equipo</h1>
        <p>Solo quien administra la tienda maneja el equipo.</p>
      </main>
    );

  const invitar = async () => {
    setEstado({ tipo: 'creando' });
    const r = await crearInvitacion(conexion, { origen: location.origin, tienda, rol: invitado });
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
      <p>
        En <strong>Despachos</strong>, solo ve y mueve los pedidos, lleva los recaudos y mira el
        inventario: no cambia precios, productos, ajustes ni publica.
      </p>
      <h2>Quién tiene acceso</h2>
      {falla ? (
        <Aviso tono="peligro" titulo="No pudimos leer tu equipo">
          {falla}
        </Aviso>
      ) : null}
      {!miembros && !falla ? <p role="status">Leyendo tu equipo…</p> : null}
      {miembros ? (
        <ul class="lineas">
          {miembros.map((m) => (
            <li key={m.usuario_id}>
              <span>
                <strong>{m.tu ? `${m.nombre} (tú)` : m.nombre}</strong>
                <span class="fila__detalle"> · {NOMBRE_DEL_ROL[m.rol] ?? m.rol}</span>
              </span>
              {m.tu ? null : (
                <Confirmar
                  abrir={`Quitar a ${m.nombre}`}
                  consecuencia="Deja de entrar al panel de la tienda a más tardar en 12 horas. Lo que hizo en la tienda se queda."
                  confirmar={`Sí, quitar a ${m.nombre}`}
                  alConfirmar={() => quitar(m)}
                />
              )}
            </li>
          ))}
        </ul>
      ) : null}

      <h2>Invitar</h2>
      {lleno ? (
        <p class="nota">
          Tu plan permite {limite === 1 ? 'una persona: tú' : `${limite} personas en tu equipo`}.
          Para invitar a alguien más, cambia de plan en <a href="/mas/plan/">Tu plan</a>.
        </p>
      ) : null}
      <fieldset class="ed1-grupo">
        <legend class="ed1-grupo__titulo">¿Cómo va a ayudarte?</legend>
        {ROLES_INVITABLES.map((r) => (
          <label class="casilla" key={r.id} for={`invitar-${r.id}`}>
            <input
              id={`invitar-${r.id}`}
              type="radio"
              name="rol-invitado"
              checked={invitado === r.id}
              onChange={() => setInvitado(r.id)}
            />
            {r.nombre}: {r.hace}
          </label>
        ))}
      </fieldset>
      <button
        class="ed1-boton ed1-boton--primario"
        type="button"
        disabled={estado.tipo === 'creando' || lleno}
        aria-busy={estado.tipo === 'creando' ? 'true' : undefined}
        onClick={() => void invitar()}
      >
        {invitado === 'despachos' ? 'Invitar a Despachos' : 'Invitar a un colaborador'}
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
