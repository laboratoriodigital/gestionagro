/**
 * El adaptador de correo transaccional (PLATAFORMA §4.11, HU-C10.1). Uno solo para todos (P2): el
 * CORE lo usará para el enlace de entrar y los avisos de vencimiento (HU-C10.2, HU-C10.3) y la
 * Tienda para sus correos (HU-T14.3), cada uno con sus secretos. La configuración y la red llegan
 * como parámetros; el paquete no guarda nada fuera del objeto que devuelve.
 *
 * El primer proveedor es Gmail por su API (decisión del dueño del 13 oct 2026): el refresh token de
 * OAuth se cambia por un token de acceso y el mensaje MIME va a `users/me/messages/send`, con el
 * permiso `gmail.send` y nada más. Es HTTP, cabe en el plan gratuito. Resend o el de Cloudflare
 * llegan después como otro proveedor detrás de la misma interfaz, sin que ningún producto cambie.
 *
 * Nunca finge haber enviado (CA3, P1): sin configuración, con el permiso vencido o con cualquier
 * respuesta que no sea un envío aceptado, `enviar` devuelve `enviado: false` con su motivo. No
 * lanza por lo que responda el proveedor: quien llama decide si reintenta o avisa.
 */

export interface Correo {
  /** Una sola dirección. */
  para: string;
  asunto: string;
  texto: string;
  /** Opcional: si llega, el correo lleva las dos versiones y el lector elige. */
  html?: string;
  /** En nombre de quién sale, por ejemplo la tienda. Sin él, sale de Laboratorio Digital. */
  nombre?: string;
  /** A quién le llega la respuesta, por ejemplo el correo del comercio. */
  responderA?: string;
}

/**
 * Por qué no salió:
 * - `no-disponible`: falta configuración o el permiso venció; reintentar no sirve hasta arreglarlo.
 * - `tope`: se llegó al cupo del día, el nuestro o el del proveedor.
 * - `rechazado`: el proveedor no acepta este correo; reintentar no sirve.
 * - `falla`: la red o el proveedor fallaron; se puede reintentar.
 * - `invalido`: el correo está mal armado (una dirección o un salto de línea en el asunto) y no
 *   salió de aquí.
 */
export type MotivoSinEnviar = 'no-disponible' | 'tope' | 'rechazado' | 'falla' | 'invalido';

export type ResultadoDelEnvio =
  | { enviado: true; id: string }
  | { enviado: false; motivo: MotivoSinEnviar; detalle: string };

export interface CorreoTransaccional {
  proveedor: 'gmail';
  /** false si falta configuración: `enviar` responderá «no disponible» sin tocar la red. */
  disponible: boolean;
  enviar(c: Correo): Promise<ResultadoDelEnvio>;
}

/** Lo que Gmail necesita, de los secretos del ambiente (PLATAFORMA §4.11). */
export interface ConfiguracionGmail {
  clienteId?: string | undefined;
  clienteSecreto?: string | undefined;
  refresh?: string | undefined;
  /** La dirección de la cuenta que envía: Gmail no deja poner otra en `From`. */
  remitente?: string | undefined;
}

export const NOMBRE_DE_LA_PLATAFORMA = 'Laboratorio Digital';
const TOKEN_DE_GOOGLE = 'https://oauth2.googleapis.com/token';
const ENVIO_DE_GMAIL = 'https://gmail.googleapis.com/gmail/v1/users/me/messages/send';
/** Las razones con que Gmail dice «demasiados» en un 403 (su guía de errores de uso). */
const RAZONES_DE_TOPE = new Set([
  'rateLimitExceeded',
  'userRateLimitExceeded',
  'dailyLimitExceeded',
  'quotaExceeded',
]);
/** Fijo: las partes van en base64, que no tiene «_», así que la frontera no aparece adentro. */
const FRONTERA = '=_ed1_correo_alternativa';

const sinEnviar = (motivo: MotivoSinEnviar, detalle: string): ResultadoDelEnvio => ({
  enviado: false,
  motivo,
  detalle,
});

const DIRECCION =
  /^[!#-'*+\-/-9=?A-Z^-~]+(\.[!#-'*+\-/-9=?A-Z^-~]+)*@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)+$/;

/** Una sola dirección, en ASCII, sin nada que pueda partir un encabezado. */
export const esDireccion = (d: string): boolean => d.length <= 254 && DIRECCION.test(d);

/** Lo que tiene de malo el correo, o null. Se revisa antes de tocar la red o el cupo. */
export function problemaDelCorreo(c: Correo): string | null {
  if (!esDireccion(c.para)) return 'la dirección del destinatario no es una sola dirección válida';
  if (c.responderA !== undefined && !esDireccion(c.responderA)) {
    return 'la dirección para responder no es válida';
  }
  // Un salto de línea en un encabezado agregaría otros, por ejemplo una copia oculta.
  // biome-ignore lint/suspicious/noControlCharactersInRegex: es justo lo que se busca.
  const control = /[\u0000-\u001f\u007f]/;
  if (control.test(c.asunto)) return 'el asunto lleva un carácter de control';
  if (c.nombre !== undefined && control.test(c.nombre))
    return 'el nombre lleva un carácter de control';
  if (c.asunto.trim() === '') return 'el asunto está vacío';
  if (c.texto.trim() === '') return 'el texto está vacío';
  return null;
}

function base64(bytes: Uint8Array): string {
  let binario = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binario += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binario);
}

const utf8 = (s: string): Uint8Array => new TextEncoder().encode(s);

/**
 * El texto como palabras codificadas de RFC 2047 (`=?UTF-8?B?…?=`), de a lo sumo 45 bytes cada una
 * para que ninguna pase de 75 caracteres, sin partir una letra, y dobladas en líneas aparte.
 */
export function palabrasCodificadas(texto: string): string {
  const palabras: string[] = [];
  let trozo = '';
  for (const letra of texto) {
    if (utf8(trozo + letra).length > 45) {
      palabras.push(trozo);
      trozo = '';
    }
    trozo += letra;
  }
  if (trozo !== '' || palabras.length === 0) palabras.push(trozo);
  return palabras.map((p) => `=?UTF-8?B?${base64(utf8(p))}?=`).join('\r\n ');
}

/** El cuerpo en base64, en líneas de 76 (RFC 2045), con los saltos de línea como CRLF. */
function cuerpoEnBase64(texto: string): string {
  const b = base64(utf8(texto.replace(/\r?\n/g, '\r\n')));
  return (b.match(/.{1,76}/g) ?? ['']).join('\r\n');
}

/** El mensaje MIME completo, tal como sale. `remitente` es la dirección de la cuenta que envía. */
export function armarMensaje(c: Correo, remitente: string): string {
  const quien = c.nombre ? `${c.nombre} vía ${NOMBRE_DE_LA_PLATAFORMA}` : NOMBRE_DE_LA_PLATAFORMA;
  const encabezados = [
    `From: ${palabrasCodificadas(quien)} <${remitente}>`,
    `To: <${c.para}>`,
    ...(c.responderA ? [`Reply-To: <${c.responderA}>`] : []),
    `Subject: ${palabrasCodificadas(c.asunto)}`,
    'MIME-Version: 1.0',
    // Es transaccional: que ningún contestador automático responda (RFC 3834).
    'Auto-Submitted: auto-generated',
  ];
  const parte = (tipo: string, contenido: string) =>
    [
      `Content-Type: ${tipo}; charset=UTF-8`,
      'Content-Transfer-Encoding: base64',
      '',
      cuerpoEnBase64(contenido),
    ].join('\r\n');
  if (c.html === undefined) {
    return [...encabezados, parte('text/plain', c.texto)].join('\r\n');
  }
  return [
    ...encabezados,
    `Content-Type: multipart/alternative; boundary="${FRONTERA}"`,
    '',
    `--${FRONTERA}`,
    parte('text/plain', c.texto),
    `--${FRONTERA}`,
    parte('text/html', c.html),
    `--${FRONTERA}--`,
    '',
  ].join('\r\n');
}

const base64url = (s: string): string =>
  base64(utf8(s)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

async function cuerpoJson(r: Response): Promise<Record<string, unknown>> {
  const d = (await r.json().catch(() => null)) as unknown;
  return d !== null && typeof d === 'object' ? (d as Record<string, unknown>) : {};
}

/** La razón del primer error de una respuesta de Google, para el log; nunca su mensaje. */
function razonDeGoogle(d: Record<string, unknown>): string {
  const e = d['error'];
  if (typeof e === 'string') return e;
  if (e && typeof e === 'object') {
    const errores = (e as { errors?: { reason?: unknown }[]; status?: unknown }).errors;
    const razon = errores?.[0]?.reason;
    if (typeof razon === 'string') return razon;
    const estado = (e as { status?: unknown }).status;
    if (typeof estado === 'string') return estado;
  }
  return 'sin razón';
}

type Acceso = { token: string } | { sin: ResultadoDelEnvio };

/**
 * Gmail por su API. El token de acceso se pide en el primer envío y se reusa mientras el objeto
 * viva; si Gmail responde 401, se pide otro una vez. Cada corrida crea el suyo, así que no
 * hace falta un reloj.
 */
export function correoGmail(conf: ConfiguracionGmail, fetchFn: typeof fetch): CorreoTransaccional {
  const { clienteId, clienteSecreto, refresh, remitente } = conf;
  const completa = Boolean(clienteId && clienteSecreto && refresh && remitente);
  let acceso: string | null = null;

  async function pedirAcceso(): Promise<Acceso> {
    let r: Response;
    try {
      r = await fetchFn(TOKEN_DE_GOOGLE, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: clienteId ?? '',
          client_secret: clienteSecreto ?? '',
          refresh_token: refresh ?? '',
          grant_type: 'refresh_token',
        }).toString(),
      });
    } catch (e) {
      return { sin: sinEnviar('falla', `Google no respondió (${(e as Error).message})`) };
    }
    const d = await cuerpoJson(r);
    if (r.ok && typeof d['access_token'] === 'string') return { token: d['access_token'] };
    if (r.status >= 500) return { sin: sinEnviar('falla', `Google respondió ${r.status}`) };
    // invalid_grant: el permiso venció o lo quitaron. invalid_client: el cliente no es ese.
    return {
      sin: sinEnviar(
        'no-disponible',
        `el permiso de Gmail no sirve (${r.status} ${razonDeGoogle(d)}): hay que volver a darlo`,
      ),
    };
  }

  async function mandar(token: string, raw: string): Promise<Response | ResultadoDelEnvio> {
    try {
      return await fetchFn(ENVIO_DE_GMAIL, {
        method: 'POST',
        headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
        body: JSON.stringify({ raw }),
      });
    } catch (e) {
      return sinEnviar('falla', `Gmail no respondió (${(e as Error).message})`);
    }
  }

  return {
    proveedor: 'gmail',
    disponible: completa,
    async enviar(c) {
      if (!completa || !remitente) {
        return sinEnviar('no-disponible', 'falta la configuración de Gmail');
      }
      const problema = problemaDelCorreo(c);
      if (problema) return sinEnviar('invalido', problema);
      const raw = base64url(armarMensaje(c, remitente));
      for (let intento = 0; intento < 2; intento++) {
        if (acceso === null) {
          const a = await pedirAcceso();
          if ('sin' in a) return a.sin;
          acceso = a.token;
        }
        const r = await mandar(acceso, raw);
        if (!(r instanceof Response)) return r;
        const d = await cuerpoJson(r);
        if (r.ok && typeof d['id'] === 'string') return { enviado: true, id: d['id'] };
        if (r.ok) return sinEnviar('falla', 'Gmail respondió sin el id del mensaje');
        if (r.status === 401) {
          acceso = null;
          continue;
        }
        const razon = razonDeGoogle(d);
        if (r.status === 429 || (r.status === 403 && RAZONES_DE_TOPE.has(razon))) {
          return sinEnviar('tope', `Gmail respondió ${r.status} (${razon})`);
        }
        if (r.status === 403) {
          return sinEnviar('no-disponible', `Gmail respondió 403 (${razon})`);
        }
        if (r.status >= 500) return sinEnviar('falla', `Gmail respondió ${r.status}`);
        return sinEnviar('rechazado', `Gmail respondió ${r.status} (${razon})`);
      }
      return sinEnviar('no-disponible', 'Gmail no aceptó el token de acceso dos veces');
    },
  };
}

/**
 * El cupo de quien envía delante del proveedor (PLATAFORMA §4.11: 400 al día para la cuenta y un
 * tope por tienda, TIENDA §15.5). `tomar` reserva un envío y dice si quedaba; quien llama lleva la
 * cuenta donde la tenga. Un correo mal armado o un proveedor sin configurar no gastan cupo.
 */
export function conCupo(
  correo: CorreoTransaccional,
  tomar: () => Promise<boolean>,
): CorreoTransaccional {
  return {
    proveedor: correo.proveedor,
    disponible: correo.disponible,
    async enviar(c) {
      if (!correo.disponible) return correo.enviar(c);
      const problema = problemaDelCorreo(c);
      if (problema) return sinEnviar('invalido', problema);
      if (!(await tomar())) return sinEnviar('tope', 'se llegó al cupo de correos del día');
      return correo.enviar(c);
    },
  };
}
