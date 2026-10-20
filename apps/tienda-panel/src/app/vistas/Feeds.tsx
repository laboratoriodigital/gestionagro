/**
 * HU-T14.5: debajo de Ajustes › Agentes, las direcciones de los feeds encendidos, para pegarlas en
 * Google Merchant Center y en el Commerce Manager de Meta, y los productos que quedaron fuera de la
 * versión publicada, con su motivo (CA2). Los cambios llegan a los feeds al publicar.
 */
import { Aviso } from '@ed1/ui/v2/componentes';
import { useEffect, useState } from 'preact/hooks';
import { type Conexion, pedirAlPanel } from '../api.ts';

interface FeedsDelPanel {
  encendidos: { google: boolean; meta: boolean; agentes: boolean };
  urls: { google?: string; meta?: string; agentes?: string };
  fuera: { slug: string; nombre: string; motivo: string }[] | null;
}

const NOMBRES = {
  google: 'Google Merchant Center',
  meta: 'Catálogo de Meta',
  agentes: 'Asistentes de compra',
} as const;

export function FeedsDeLaTienda({
  conexion,
  alVencer,
}: {
  conexion: Conexion;
  alVencer: (motivo: string) => void;
}) {
  const [feeds, setFeeds] = useState<FeedsDelPanel | null>(null);
  useEffect(() => {
    void (async () => {
      const r = await pedirAlPanel<FeedsDelPanel>(conexion, 'feeds');
      if (r.tipo === 'sin-sesion') return alVencer(r.motivo);
      if (r.tipo === 'ok') setFeeds(r.datos);
    })();
  }, [conexion, alVencer]);
  if (!feeds) return null;
  const encendidos = (['google', 'meta', 'agentes'] as const).filter((k) => feeds.encendidos[k]);
  if (encendidos.length === 0) return null;
  return (
    <section aria-labelledby="feeds">
      <h2 id="feeds">Tus feeds</h2>
      <p>Pega cada dirección en su servicio. Se actualizan solos cada vez que publicas.</p>
      <dl class="datos">
        {encendidos.map((k) => (
          <div key={k}>
            <dt>{NOMBRES[k]}</dt>
            <dd class="cifra">{feeds.urls[k] ?? 'Aparece cuando publiques'}</dd>
          </div>
        ))}
      </dl>
      {feeds.fuera && feeds.fuera.length > 0 ? (
        <Aviso tono="aviso" titulo="No salen en los feeds">
          <ul>
            {feeds.fuera.map((f) => (
              <li key={f.slug}>
                {f.nombre}: {f.motivo}.
              </li>
            ))}
          </ul>
          Agrégales lo que falta y publica.
        </Aviso>
      ) : null}
    </section>
  );
}
