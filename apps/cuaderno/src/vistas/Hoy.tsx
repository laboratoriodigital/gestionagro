/**
 * «Hoy» (HU-E0.11): lo primero que ve quien abre el cuaderno con su finca. Boceto aprobado por el
 * dueño el 23 oct 2026, inspirado en la landing: el saludo y el resumen del día sobre el verde
 * bosque, cada nave con su cultivo y si se puede cosechar, y lo último que se anotó.
 *
 * - La carencia de hoy sale de `calendarioDeCarencias`, la misma cuenta de «Carencias» y del MCP
 *   (P2). Lo desconocido se dice como desconocido, nunca como «se puede» (P1).
 * - El color nunca va solo: cada estado lleva su texto.
 */
import type { Area, Ciclo, Finca, Registro } from '@ed1/agro-schema';
import { useEffect, useState } from 'preact/hooks';
import { cuaderno } from '../almacen/abierto.ts';
import { calendarioDeCarencias, type FilaDelCalendario } from '../almacen/calendario.ts';
import { diasDesdeTrasplante } from '../almacen/ciclos.ts';
import { pendientesDeSubir, ultimosRegistros } from '../almacen/consultas.ts';
import { TIPOS } from '../anotar.ts';
import { NOMBRE_REGIMEN, nombreDeArea, PRODUCCION } from '../formato.ts';
import { saludo } from './Bienvenida.tsx';

const ZONA = 'America/Bogota';
const FECHA_LARGA = new Intl.DateTimeFormat('es-CO', {
  timeZone: ZONA,
  weekday: 'long',
  day: 'numeric',
  month: 'long',
});
const HORA = new Intl.DateTimeFormat('es-CO', {
  timeZone: ZONA,
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});
const DIA_SEMANA = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

/** «el sábado 25», desde `AAAA-MM-DD`, en el calendario y sin huso (P8). */
function diaDeLaSemana(fecha: string): string {
  const [a, m, d] = fecha.split('-').map(Number) as [number, number, number];
  return `el ${DIA_SEMANA[new Date(Date.UTC(a, m - 1, d)).getUTCDay()]} ${d}`;
}

export type EstadoDeNave = { clase: 'lista' | 'carencia' | 'sin-dato'; texto: string };

/** Lo que dice la fila de una nave hoy: se puede, desde cuándo, o que falta un dato. */
export function estadoDeHoy(fila: FilaDelCalendario): EstadoDeNave {
  if (fila.hoy.color === 'verde') return { clase: 'lista', texto: 'Se puede cosechar' };
  if (fila.hoy.color === 'gris') return { clase: 'sin-dato', texto: 'Falta la carencia' };
  const libre = fila.dias.find((d) => d.color === 'verde');
  return {
    clase: 'carencia',
    texto: libre ? `Desde ${diaDeLaSemana(libre.fecha)}` : 'Todavía no',
  };
}

/** «Hoy puedes cosechar en 2 naves.», con la cuenta de las naves de la finca. */
export function resumenDelDia(estados: readonly EstadoDeNave[]): string {
  const listas = estados.filter((e) => e.clase === 'lista').length;
  if (estados.length === 0) return 'Agrega tus naves para ver qué puedes cosechar.';
  if (listas === 0) return 'Hoy no hay naves para cosechar.';
  if (listas === estados.length && listas > 1) return 'Hoy puedes cosechar en todas tus naves.';
  return `Hoy puedes cosechar en ${listas} ${listas === 1 ? 'nave' : 'naves'}.`;
}

const semana = (c: Ciclo) => Math.floor(diasDesdeTrasplante(c) / 7) + 1;
const tituloDe = (tipo: string) => TIPOS.find((t) => t.id === tipo)?.titulo ?? tipo;

export function Hoy(props: { finca: Finca; areas: Area[]; ciclos: Ciclo[] }) {
  const { finca, areas, ciclos } = props;
  const [filas, setFilas] = useState<FilaDelCalendario[] | null>(null);
  const [ultimos, setUltimos] = useState<Registro[]>([]);
  const [pendientes, setPendientes] = useState<Set<string>>(new Set());

  useEffect(() => {
    const db = cuaderno();
    void (async () => {
      setFilas(await calendarioDeCarencias(db, finca.id, areas));
      setUltimos(
        await ultimosRegistros(
          db,
          finca.id,
          TIPOS.map((t) => t.id),
          3,
        ),
      );
      setPendientes(await pendientesDeSubir(db));
    })();
  }, [finca.id, areas]);

  const naves = (filas ?? []).filter((f) => f.area.padre_id === null);
  const estados = naves.map(estadoDeHoy);
  const ahora = new Date();
  const cicloDe = (areaId: string) =>
    ciclos.find((c) => c.estado === 'activo' && c.area_ids.includes(areaId));

  return (
    <>
      <section class="hoy" aria-labelledby="titulo-finca" data-prueba="hoy">
        <p class="hoy__fecha">{FECHA_LARGA.format(ahora)}</p>
        <h1 id="titulo-finca">{finca.nombre}</h1>
        <p class="hoy__lugar">
          {finca.municipio} · {PRODUCCION[finca.regimen] ?? NOMBRE_REGIMEN[finca.regimen]}
        </p>
        {filas && (
          <>
            <p class="hoy__resumen" data-prueba="hoy-resumen">
              {saludo(Number(HORA.format(ahora).slice(0, 2)))}. {resumenDelDia(estados)}
            </p>
            {naves.length > 0 && (
              <p class="hoy__chips">
                <span class="chip chip--lima">
                  {estados.filter((e) => e.clase === 'lista').length} para cosechar
                </span>
                {estados.some((e) => e.clase === 'carencia') && (
                  <span class="chip">
                    {estados.filter((e) => e.clase === 'carencia').length} en carencia
                  </span>
                )}
                {estados.some((e) => e.clase === 'sin-dato') && (
                  <span class="chip">
                    {estados.filter((e) => e.clase === 'sin-dato').length} sin dato
                  </span>
                )}
              </p>
            )}
          </>
        )}
      </section>

      {naves.length > 0 && (
        <section class="tablero" aria-labelledby="titulo-naves">
          <h2 id="titulo-naves">Tus naves hoy</h2>
          <ul class="tablero__lista" data-prueba="hoy-naves">
            {naves.map((f, i) => {
              const ciclo = cicloDe(f.area.id);
              const estado = estados[i] as EstadoDeNave;
              return (
                <li key={f.area.id} class="tablero__fila">
                  <span>
                    <strong>{f.area.nombre}</strong>
                    <span class="tablero__detalle">
                      {ciclo ? `${ciclo.cultivo} · semana ${semana(ciclo)}` : 'Sin ciclo activo'}
                    </span>
                  </span>
                  <a class={`estado-nave estado-nave--${estado.clase}`} href="/agro/app/carencias/">
                    {estado.texto}
                  </a>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {ultimos.length > 0 && (
        <section class="tablero" aria-labelledby="titulo-ultimo">
          <h2 id="titulo-ultimo">Lo último</h2>
          <ul class="tablero__lista" data-prueba="hoy-ultimos">
            {ultimos.map((r) => (
              <li key={r.id} class="tablero__fila">
                <span>
                  {tituloDe(r.tipo)} · {nombreDeArea(areas, r.area_ids[0])}
                </span>
                <span class="tablero__detalle">
                  <span class="cifra">{HORA.format(new Date(r.instante_evento))}</span>
                  {pendientes.has(r.id) && ' · solo en este teléfono'}
                </span>
              </li>
            ))}
          </ul>
          <p class="tablero__mas">
            <a href="/agro/app/historial/">Ver el historial</a>
          </p>
        </section>
      )}
    </>
  );
}
