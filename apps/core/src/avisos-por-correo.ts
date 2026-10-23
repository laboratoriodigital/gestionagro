/**
 * Los avisos de vencimiento por correo (HU-C10.3, PLATAFORMA §4.8 punto 5). A 7 días y a 1 día de
 * vencer el plan pagado de un espacio, quienes lo administran reciben un correo. Es la misma marca
 * que la app ya muestra (`avisoDelPlan`, HU-C5.5), ahora también por correo.
 *
 * - **Desde el cron que ya existe (CA1)**, el de cada 15 minutos, pero solo en la primera vuelta de
 *   cada hora y de 8 a. m. a 7 p. m. de Bogotá: nadie recibe un aviso de pago a medianoche, y la
 *   consulta corre 12 veces al día, no 96.
 * - **Un aviso no se repite (CA2):** su clave en `correo_del_core` lleva el espacio, el escalón, la
 *   fecha de vencimiento y la persona. Dos corridas el mismo día mandan uno; pagar otro periodo
 *   cambia la fecha y el siguiente aviso vuelve a salir.
 * - **Lo que no salió se reintenta** en la hora siguiente, hasta 3 veces. Sin la configuración del
 *   correo no se escribe nada: el aviso sale cuando exista.
 * - Hasta 20 correos por vuelta: cada uno son una o dos llamadas al proveedor, y el plan gratuito
 *   da 50 por invocación. Lo que quede, sale en la hora siguiente.
 */
import type { CorreoTransaccional } from '@ed1/correo';
import type { BaseD1 } from '@ed1/d1';
import type { Producto } from '@ed1/productos';
import { enviarUnaVez, INTENTOS_DE_UN_AVISO } from './correo.ts';
import {
  type AvisoDelPlan,
  avisoDelPlan,
  type CatalogoDelCore,
  origenesDelProducto,
  planesDe,
  productoDe,
  rolAdministra,
} from './productos.ts';

export const CORREOS_POR_VUELTA = 20;
const DIA_MS = 24 * 60 * 60 * 1000;
/** Bogotá no tiene horario de verano: UTC−5 todo el año. */
const BOGOTA_MS = -5 * 60 * 60 * 1000;

/** Si esta vuelta del cron es la que manda avisos: la primera de cada hora, de 8 a 19 en Bogotá. */
export function esHoraDeAvisar(ahora: number): boolean {
  const bogota = new Date(ahora + BOGOTA_MS);
  return bogota.getUTCMinutes() < 15 && bogota.getUTCHours() >= 8 && bogota.getUTCHours() < 20;
}

const FECHA = new Intl.DateTimeFormat('es-CO', {
  day: 'numeric',
  month: 'long',
  timeZone: 'America/Bogota',
});

/** La pantalla de la app del producto en este destino, para que el aviso lleve a pagar. */
export function appDelProducto(
  producto: Producto,
  destino: string | undefined,
  origenesDeLaCelda: readonly string[],
): string | null {
  const ruta = producto.app.rutas_de_vuelta[0] ?? '/';
  const origenes = producto.app.origenes;
  // El agro toma los suyos de `ORIGENES_APP`, que el despliegue pone por destino: el primero es el
  // del sitio de ese destino.
  const origen =
    origenes === 'celdas.json › sitio'
      ? origenesDelProducto(producto, origenesDeLaCelda)[0]
      : destino === 'produccion'
        ? origenes.produccion
        : origenes.staging;
  return origen ? `${origen}${ruta}` : null;
}

/** El correo de un aviso: qué vence, cuándo, y adónde ir. Sin nada técnico. */
export function correoDelAviso(datos: {
  escalon: Exclude<AvisoDelPlan, 'en-gracia'>;
  espacio: string;
  plan: string;
  producto: string;
  vence: string;
  app: string | null;
  graciaDias: number;
}) {
  const cuando = datos.escalon === 'vence-en-1-dia' ? 'mañana' : 'en 7 días';
  const fecha = FECHA.format(new Date(datos.vence));
  const gracia =
    datos.graciaDias > 0
      ? ` Si se te pasa, tienes ${datos.graciaDias} días más antes de que el espacio vuelva al plan gratuito.`
      : ' Si se te pasa, el espacio vuelve al plan gratuito y no pierdes nada de lo que tienes guardado.';
  const asunto = `Tu plan de ${datos.espacio} vence ${cuando}`;
  const texto = [
    'Hola:',
    '',
    `El plan ${datos.plan} de ${datos.espacio} en ${datos.producto} vence el ${fecha}.${gracia}`,
    '',
    ...(datos.app ? [`Para renovarlo, entra a ${datos.producto}:`, datos.app, ''] : []),
    'Recibes este correo porque administras ese espacio.',
  ].join('\n');
  return { asunto, texto };
}

interface PorVencer {
  id: string;
  nombre: string;
  producto: string;
  plan_pagado: string;
  vence_pagado: string;
}

/** Cuántos avisos salieron en esta vuelta. */
export async function mandarAvisos(
  db: BaseD1,
  catalogo: CatalogoDelCore,
  correoDe: (producto: Producto) => CorreoTransaccional,
  entorno: { destino: string | undefined; origenes: readonly string[] },
  ahora: number,
): Promise<number> {
  if (!esHoraDeAvisar(ahora)) return 0;
  const { results } = await db
    .prepare(
      `SELECT id, nombre, producto, plan AS plan_pagado, plan_vence AS vence_pagado
         FROM organizacion INDEXED BY organizacion_por_vencimiento
        WHERE plan_vence IS NOT NULL AND plan_vence > ? AND plan_vence <= ? AND estado = 'activa'
        ORDER BY plan_vence`,
    )
    .bind(new Date(ahora).toISOString(), new Date(ahora + 7 * DIA_MS).toISOString())
    .all<PorVencer>();
  let enviados = 0;
  let intentados = 0;
  for (const org of results) {
    const escalon = avisoDelPlan(catalogo, org, ahora);
    if (escalon !== 'vence-en-1-dia' && escalon !== 'vence-en-7-dias') continue;
    const pedido = productoDe(catalogo, org.producto);
    if (!('producto' in pedido)) continue;
    const { producto } = pedido;
    const plan = planesDe(catalogo, org.producto).find((p) => p.id === org.plan_pagado);
    const { results: personas } = await db
      .prepare(
        'SELECT m.usuario_id, m.rol, u.email FROM membresia m JOIN usuario u ON u.id = m.usuario_id WHERE m.org_id = ?',
      )
      .bind(org.id)
      .all<{ usuario_id: string; rol: string; email: string }>();
    const mensaje = correoDelAviso({
      escalon,
      espacio: org.nombre,
      plan: plan?.nombre ?? org.plan_pagado,
      producto: producto.nombre,
      vence: org.vence_pagado,
      app: appDelProducto(producto, entorno.destino, entorno.origenes),
      graciaDias: producto.gracia_dias ?? 0,
    });
    for (const persona of personas) {
      if (!rolAdministra(catalogo, org.producto, persona.rol)) continue;
      if (intentados >= CORREOS_POR_VUELTA) return enviados;
      const r = await enviarUnaVez(
        db,
        correoDe(producto),
        {
          clave: `aviso:${org.id}:${escalon}:${org.vence_pagado}:${persona.usuario_id}`,
          tipo: 'aviso',
          intentos: INTENTOS_DE_UN_AVISO,
        },
        { para: persona.email, ...mensaje },
        ahora,
      );
      if (r.estado === 'repetido') continue;
      intentados++;
      if (r.estado === 'enviado') enviados++;
      // Sin configuración o sin cupo, los demás tampoco saldrían en esta vuelta.
      if (r.estado === 'fallido' && (r.motivo === 'no-disponible' || r.motivo === 'tope')) {
        return enviados;
      }
    }
  }
  return enviados;
}
