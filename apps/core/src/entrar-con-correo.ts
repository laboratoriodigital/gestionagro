/**
 * Entrar con un enlace a tu correo (HU-C10.2, PLATAFORMA §4.11, ED1 §5.2), para quien no tiene
 * cuenta de Google. Termina igual que entrar con Google: la app vuelve con `#entrar=<código>` y lo
 * canjea en `/api/core/auth/canje`, así que ninguna app cambia su manera de recibir la sesión.
 *
 *   app ───► POST /api/core/auth/correo/pedir {correo, producto, vuelta, politica}
 *            (guarda la huella del enlace y lo manda por correo)
 *   correo ► <cuenta>/entrar/correo/#enlace=<código>
 *   cuenta ► POST /api/core/auth/correo/ver   {enlace}  → para quién es y a qué app entra
 *   cuenta ► POST /api/core/auth/correo/abrir {enlace}  → {vuelta: <pantalla>#entrar=<código>}
 *
 * - **Pedir responde lo mismo exista o no la cuenta (CA1):** el enlace sale siempre, porque abrirlo
 *   crea la cuenta como lo hace Google. Nada de la respuesta dice si la dirección ya estaba.
 * - **Un solo uso, 15 minutos, con el código en el fragmento (CA2, P13):** en la base queda solo su
 *   huella. El fragmento no llega a ningún servidor ni al historial del correo.
 * - **Abrir pide tocar un botón.** Los filtros de correo abren los enlaces para revisarlos, y
 *   algunos corren el JavaScript de la página: si abrir fuera automático, el filtro gastaría el
 *   enlace antes que la persona. Ver no lo gasta.
 * - **Topes (CA3):** 3 enlaces por correo por hora, en la base; 5 por minuto por IP, con el
 *   limitador de Workers. Más allá, se rechaza y se dice cuánto esperar.
 * - Nada de esto escribe el código, el enlace ni la dirección en el log.
 */

import type { CorreoTransaccional } from '@ed1/correo';
import { esDireccion } from '@ed1/correo';
import type { Producto } from '@ed1/productos';
import { hashDe, secretoAlAzar } from '@ed1/tokens';
import type { Context } from 'hono';
import { filaDeAuditoria } from './auditoria.ts';
import { enviarUnaVez } from './correo.ts';
import type { Entorno } from './entrar.ts';
import { PRODUCTO_POR_DEFECTO, productoDe, vueltaDelProducto } from './productos.ts';
import { correoNormalizado, usuarioDeCorreo } from './repositorio.ts';
import { aceptarPolitica, crearSesion } from './sesiones.ts';

export const VIDA_ENLACE_MS = 15 * 60 * 1000;
export const ENLACES_POR_HORA = 3;
const HORA_MS = 60 * 60 * 1000;
/** La pantalla de la cuenta que abre el enlace (`apps/cuenta/src/pages/entrar/correo.astro`). */
export const RUTA_DEL_ENLACE = '/entrar/correo/';

/** El limitador por IP de Workers Rate Limiting; las pruebas pasan uno falso o ninguno. */
export interface Limitador {
  limit(opciones: { key: string }): Promise<{ success: boolean }>;
}

export interface EntornoDeCorreo extends Entorno {
  /** El correo del CORE para un producto (`correo.ts`). */
  correoDe: (producto: Producto) => CorreoTransaccional;
  limitador?: Limitador | undefined;
}

const iso = (ms: number) => new Date(ms).toISOString();

async function cuerpo(c: Context): Promise<Record<string, unknown>> {
  try {
    const leido = (await c.req.json()) as unknown;
    return typeof leido === 'object' && leido !== null ? (leido as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

const texto = (valor: unknown) =>
  typeof valor === 'string' && valor.trim() ? valor.trim() : undefined;

const NO_DISPONIBLE =
  'Entrar con tu correo no está disponible en este momento. Puedes entrar con Google, o intentarlo más tarde.';

/** El correo con el enlace: corto, sin nada técnico, y con qué hacer si no lo pidió. */
export function correoDelEnlace(producto: Pick<Producto, 'nombre'>, enlace: string) {
  const asunto = `Tu enlace para entrar a ${producto.nombre}`;
  const plano = [
    'Hola:',
    '',
    `Toca este enlace para entrar a ${producto.nombre}:`,
    enlace,
    '',
    'Sirve una sola vez y vence en 15 minutos. Ábrelo en el teléfono o el computador donde quieres quedar con tu sesión abierta.',
    '',
    'Si no lo pediste tú, no hagas nada: nadie entra sin abrir este enlace.',
  ].join('\n');
  // El enlace es nuestro origen y un código en base64url: no lleva nada que escapar.
  const html = [
    '<p>Hola:</p>',
    `<p>Toca el botón para entrar a ${producto.nombre.replace(/[<>&"]/g, '')}.</p>`,
    `<p><a href="${enlace}" style="display:inline-block;padding:12px 20px;border-radius:999px;background:#1a1a1a;color:#ffffff;text-decoration:none">Entrar</a></p>`,
    '<p>Sirve una sola vez y vence en 15 minutos. Ábrelo en el teléfono o el computador donde quieres quedar con tu sesión abierta.</p>',
    '<p>Si no lo pediste tú, no hagas nada: nadie entra sin abrir este enlace.</p>',
  ].join('\n');
  return { asunto, texto: plano, html };
}

export async function pedirEnlace(c: Context, e: EntornoDeCorreo): Promise<Response> {
  const datos = await cuerpo(c);
  const pedido = productoDe(e.catalogo, texto(datos['producto']));
  if ('motivo' in pedido) {
    return c.json(
      { estado: 'invalido', motivo: 'Esta aplicación no está disponible para entrar.' },
      400,
    );
  }
  const { producto } = pedido;
  const vuelta = vueltaDelProducto(texto(datos['vuelta']), producto, e.origenes);
  if (!vuelta) {
    return c.json(
      { estado: 'invalido', motivo: 'Esta dirección de regreso no es de esta aplicación.' },
      400,
    );
  }
  // HU-E0.5 CA3: sin aceptar la política vigente del producto no se crea ni se abre una cuenta.
  const vigente = e.catalogo.politicas[producto.id];
  const politica = texto(datos['politica']);
  if (!vigente || politica !== vigente) {
    return c.json(
      {
        estado: 'politica',
        motivo: `Para entrar, acepta la política de tratamiento de datos vigente (versión ${vigente ?? '?'}).`,
      },
      400,
    );
  }
  const crudo = texto(datos['correo']);
  const correo = crudo ? correoNormalizado(crudo) : '';
  if (!esDireccion(correo)) {
    return c.json(
      { estado: 'correo', motivo: 'Revisa tu correo: no parece una dirección completa.' },
      400,
    );
  }
  const ip = c.req.header('cf-connecting-ip') ?? 'sin-ip';
  if (e.limitador && !(await e.limitador.limit({ key: ip })).success) {
    c.header('retry-after', '60');
    return c.json(
      {
        estado: 'espera',
        motivo: 'Pediste muchos enlaces seguidos. Espera un minuto e intenta de nuevo.',
      },
      429,
    );
  }
  const ahora = e.ahora();
  const recientes = await e.db
    .prepare('SELECT count(*) AS n FROM enlace_correo WHERE correo = ? AND creado > ?')
    .bind(correo, iso(ahora - HORA_MS))
    .first<{ n: number }>();
  if ((recientes?.n ?? 0) >= ENLACES_POR_HORA) {
    c.header('retry-after', '3600');
    return c.json(
      {
        estado: 'espera',
        motivo:
          'Ya te enviamos 3 enlaces en la última hora. Revisa tu correo, también la carpeta de spam, o intenta en un rato.',
      },
      429,
    );
  }
  const codigo = secretoAlAzar();
  const huella = await hashDe(codigo);
  await e.db
    .prepare(
      'INSERT INTO enlace_correo (codigo_hash, correo, producto, vuelta, politica, creado, expira) VALUES (?, ?, ?, ?, ?, ?, ?)',
    )
    .bind(huella, correo, producto.id, vuelta, politica, iso(ahora), iso(ahora + VIDA_ENLACE_MS))
    .run();
  const enlace = `${new URL(c.req.url).origin}${RUTA_DEL_ENLACE}#enlace=${codigo}`;
  const r = await enviarUnaVez(
    e.db,
    e.correoDe(producto),
    { clave: `enlace:${huella}`, tipo: 'enlace' },
    { para: correo, ...correoDelEnlace(producto, enlace) },
    ahora,
  );
  if (r.estado === 'enviado') {
    return c.json({
      estado: 'enviado',
      motivo: `Te enviamos un enlace a ${correo}. Ábrelo en los próximos 15 minutos.`,
    });
  }
  // No salió: el enlace no sirve a nadie y no debe contar para el tope de la persona.
  await e.db.prepare('DELETE FROM enlace_correo WHERE codigo_hash = ?').bind(huella).run();
  if (r.estado === 'fallido' && (r.motivo === 'rechazado' || r.motivo === 'invalido')) {
    return c.json(
      {
        estado: 'correo',
        motivo: 'No pudimos enviar a esa dirección. Revisa que esté bien escrita.',
      },
      400,
    );
  }
  c.header('retry-after', '600');
  return c.json({ estado: 'no-disponible', motivo: NO_DISPONIBLE }, 503);
}

const VENCIDO = 'Este enlace ya se usó o venció. Pide otro desde la aplicación.';

/** Para quién es el enlace y a qué app entra, sin gastarlo. */
export async function verEnlace(c: Context, e: Entorno): Promise<Response> {
  const enlace = texto((await cuerpo(c))['enlace']);
  if (!enlace) return c.json({ estado: 'vencido', motivo: VENCIDO }, 410);
  const fila = await e.db
    .prepare(
      'SELECT correo, producto FROM enlace_correo WHERE codigo_hash = ? AND usado IS NULL AND expira > ?',
    )
    .bind(await hashDe(enlace), iso(e.ahora()))
    .first<{ correo: string; producto: string }>();
  const pedido = fila ? productoDe(e.catalogo, fila.producto) : null;
  if (!fila || !pedido || !('producto' in pedido)) {
    return c.json({ estado: 'vencido', motivo: VENCIDO }, 410);
  }
  return c.json({ estado: 'vigente', correo: fila.correo, producto: pedido.producto.nombre });
}

/**
 * Gasta el enlace y abre la sesión. El mismo UPDATE comprueba que no se haya usado ni vencido: dos
 * toques a la vez abren una sola sesión.
 */
export async function abrirEnlace(c: Context, e: Entorno): Promise<Response> {
  const enlace = texto((await cuerpo(c))['enlace']);
  if (!enlace) return c.json({ estado: 'vencido', motivo: VENCIDO }, 410);
  const ahora = e.ahora();
  const huella = await hashDe(enlace);
  const gastado = await e.db
    .prepare(
      'UPDATE enlace_correo SET usado = ? WHERE codigo_hash = ? AND usado IS NULL AND expira > ?',
    )
    .bind(iso(ahora), huella, iso(ahora))
    .run();
  if (gastado.meta.changes !== 1) return c.json({ estado: 'vencido', motivo: VENCIDO }, 410);
  const fila = await e.db
    .prepare('SELECT correo, producto, vuelta, politica FROM enlace_correo WHERE codigo_hash = ?')
    .bind(huella)
    .first<{ correo: string; producto: string; vuelta: string; politica: string }>();
  // El producto pudo pausarse en estos 15 minutos, y la vuelta se revisa de nuevo con lo de hoy.
  const pedido = fila ? productoDe(e.catalogo, fila.producto) : null;
  const producto = pedido && 'producto' in pedido ? pedido.producto : null;
  const vuelta = producto ? vueltaDelProducto(fila?.vuelta, producto, e.origenes) : null;
  if (!fila || !producto || !vuelta) {
    return c.json(
      { estado: 'no-disponible', motivo: 'Esta aplicación no está disponible para entrar ahora.' },
      409,
    );
  }
  const usuario = await usuarioDeCorreo(
    e.db,
    fila.correo,
    () => ahora,
    producto.id === PRODUCTO_POR_DEFECTO ? fila.politica : null,
  );
  await aceptarPolitica(e.db, usuario.id, producto.id, fila.politica, ahora);
  const codigo = await crearSesion(e.db, usuario.id, ahora, producto.id);
  await filaDeAuditoria(e.db, {
    instante: iso(ahora),
    producto: producto.id,
    org_id: null,
    usuario_id: usuario.id,
    accion: 'entrada',
    detalle: { proveedor: 'correo' },
  }).run();
  return c.json({ estado: 'listo', vuelta: `${vuelta}#entrar=${codigo}` });
}
