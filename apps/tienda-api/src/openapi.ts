/**
 * La API pública de una tienda, descrita en OpenAPI 3.1 (HU-T15.2, TIENDA-3.0 §11.8 y §13.2).
 *
 * - **Sale de los esquemas zod** con los que la API valida cada cuerpo (`z.toJSONSchema`, JSON
 *   Schema 2020-12, el de OpenAPI 3.1): lo que se describe es lo que se acepta, sin escribirlo dos
 *   veces (P2).
 * - **Se hornea con cada tienda** en `/openapi.json`, con su dirección como servidor, y la anuncia
 *   `/.well-known/api-catalog` (RFC 9727). Ninguno pasa por un Worker (static-first).
 * - **Solo lo que usa quien no es el navegador de la tienda:** el cobro, su estado, el aviso de Bold
 *   y la medición quedan fuera; son del navegador o de Bold.
 * - **El contrato solo crece** (§2): `contrato/openapi-v1.json` guarda la versión publicada y
 *   `cambiosQueRompen` dice qué de lo nuevo dejaría de servirle a un cliente de la anterior (CA2).
 */
import { z } from 'zod';
import { PeticionDeAvisame } from './avisame.ts';
import { PeticionDeCotizar } from './cotizar.ts';
import { PeticionDePedido, PeticionDeSeguimiento } from './pedidos.ts';
import { PeticionDeSeguimientoDeSolicitud, PeticionDeSolicitud } from './solicitudes.ts';

type Esquema = Record<string, unknown>;

interface Ruta {
  ruta: string;
  metodo: 'get' | 'post';
  id: string;
  resumen: string;
  descripcion: string;
  cuerpo?: z.ZodType;
  /** El límite por IP, en palabras; el 429 lo acompaña de `Retry-After`. */
  limite?: string;
}

const RUTAS: readonly Ruta[] = [
  {
    ruta: '/api/v1/tienda',
    metodo: 'get',
    id: 'tienda',
    resumen: 'La tienda',
    descripcion: 'El nombre y el estado de la tienda de esta dirección.',
  },
  {
    ruta: '/api/v1/cotizar',
    metodo: 'post',
    id: 'cotizar',
    resumen: 'Cotizar un carrito',
    descripcion:
      'El subtotal, el descuento, el envío y el total de unas combinaciones, con los avisos de lo que cambió (precio, existencias, cupón o envío) y el carrito corregido. No aparta unidades ni escribe nada. Las combinaciones (`variante`) salen de `/catalogo.json`.',
    cuerpo: PeticionDeCotizar,
    limite: '30 por minuto',
  },
  {
    ruta: '/api/v1/pedidos',
    metodo: 'post',
    id: 'registrarPedido',
    resumen: 'Registrar un pedido para enviarlo por WhatsApp',
    descripcion:
      'Lo envía la persona desde la tienda: exige que haya aceptado los términos publicados (`terminos` es la huella de `/legal/terminos/index.md`) y una forma de pago de las que ofrece la tienda. Un agente no lo usa en nombre de nadie: prepara el pedido con el MCP de la tienda y la persona lo confirma.',
    cuerpo: PeticionDePedido,
    limite: '10 por minuto',
  },
  {
    ruta: '/api/v1/seguimiento',
    metodo: 'post',
    id: 'seguimiento',
    resumen: 'Seguir un pedido',
    descripcion:
      'El estado, los pasos y las líneas de un pedido, con su código y el secreto de su enlace de seguimiento. Cualquier fallo responde lo mismo, y nada dice quién compró.',
    cuerpo: PeticionDeSeguimiento,
    limite: '20 por minuto',
  },
  {
    ruta: '/api/v1/avisame',
    metodo: 'post',
    id: 'avisame',
    resumen: 'Avísame cuando haya',
    descripcion:
      'Suma una persona interesada en una combinación agotada. No guarda ningún dato de quien lo pide.',
    cuerpo: PeticionDeAvisame,
    limite: '10 por minuto',
  },
  {
    ruta: '/api/v1/solicitudes',
    metodo: 'post',
    id: 'radicarSolicitud',
    resumen: 'Radicar una solicitud',
    descripcion:
      'Una petición, queja, reclamo, retracto, garantía o solicitud sobre los datos personales, con su radicado y la fecha.',
    cuerpo: PeticionDeSolicitud,
    limite: '5 por minuto',
  },
  {
    ruta: '/api/v1/solicitudes/seguimiento',
    metodo: 'post',
    id: 'seguimientoDeSolicitud',
    resumen: 'Seguir una solicitud',
    descripcion: 'En qué va una solicitud y su respuesta, con su radicado y su secreto.',
    cuerpo: PeticionDeSeguimientoDeSolicitud,
    limite: '20 por minuto',
  },
];

/** El esquema de un cuerpo, como lo acepta la API (la entrada de zod, no su salida). */
function esquemaDe(cuerpo: z.ZodType): Esquema {
  const { $schema: _, ...resto } = z.toJSONSchema(cuerpo, {
    target: 'draft-2020-12',
    io: 'input',
    unrepresentable: 'any',
  }) as Esquema;
  return resto;
}

const RESPUESTA: Esquema = {
  type: 'object',
  description:
    'Toda respuesta trae `estado`, que dice qué pasó, y, si algo no salió, `motivo`, en palabras para la persona.',
  properties: { estado: { type: 'string' }, motivo: { type: 'string' } },
  required: ['estado'],
};
const json = (descripcion: string) => ({
  description: descripcion,
  content: { 'application/json': { schema: { $ref: '#/components/schemas/Respuesta' } } },
});

/** El documento, sin `servers`: el horno pone la dirección de cada tienda. */
export function apiPublica(): Esquema {
  const paths: Record<string, Record<string, Esquema>> = {};
  for (const r of RUTAS) {
    const respuestas: Record<string, Esquema> = {
      '200': json('Hecho.'),
      ...(r.cuerpo ? { '422': json('El cuerpo no cumple el esquema o falta algo.') } : {}),
      '404': json('La tienda o lo pedido no existe.'),
      ...(r.limite
        ? {
            '429': {
              ...json(`Pasó el límite: ${r.limite} por IP.`),
              headers: { 'Retry-After': { schema: { type: 'integer' } } },
            },
          }
        : {}),
      '503': {
        ...json('La tienda está en pausa unos minutos: se puede leer, no escribir.'),
        headers: { 'Retry-After': { schema: { type: 'integer' } } },
      },
    };
    paths[r.ruta] = {
      [r.metodo]: {
        operationId: r.id,
        summary: r.resumen,
        description: r.limite ? `${r.descripcion} Límite: ${r.limite} por IP.` : r.descripcion,
        ...(r.cuerpo
          ? {
              requestBody: {
                required: true,
                content: { 'application/json': { schema: esquemaDe(r.cuerpo) } },
              },
            }
          : {}),
        responses: respuestas,
      },
    };
  }
  return {
    openapi: '3.1.0',
    info: {
      title: 'API pública de la tienda',
      version: 'v1',
      description:
        'Lo que cualquiera puede hacer con una tienda de TiendaPro sin entrar: cotizar, registrar un pedido que la persona acepta, seguirlo, pedir aviso y radicar solicitudes. El catálogo está horneado en `/catalogo.json` y `/catalogo.md`; un agente prepara pedidos con el MCP de la tienda, y el pago y la aceptación los hace siempre la persona. Los precios son en pesos colombianos e incluyen IVA.',
    },
    paths,
    components: { schemas: { Respuesta: RESPUESTA } },
  };
}

type Documento = {
  paths?: Record<
    string,
    Record<string, { requestBody?: { content?: Record<string, { schema?: Esquema }> } }>
  >;
};

const cuerpoDe = (d: Documento, ruta: string, metodo: string) =>
  d.paths?.[ruta]?.[metodo]?.requestBody?.content?.['application/json']?.schema;

/**
 * CA2: lo que cambió de `anterior` a `nuevo` que le haría fallar a un cliente que ya la usa: una ruta
 * o un método que se fue, un campo que se quitó, uno que ahora es obligatorio, un tipo distinto o un
 * valor permitido que ya no lo es. Lo que se agrega (rutas, campos opcionales, valores) no rompe.
 */
export function cambiosQueRompen(anterior: Documento, nuevo: Documento): string[] {
  const fallas: string[] = [];
  const comparar = (donde: string, a: Esquema | undefined, n: Esquema | undefined) => {
    if (!a) return;
    if (!n) {
      fallas.push(`${donde}: ya no se describe`);
      return;
    }
    if (a['type'] !== undefined && JSON.stringify(a['type']) !== JSON.stringify(n['type'])) {
      fallas.push(
        `${donde}: el tipo pasó de ${JSON.stringify(a['type'])} a ${JSON.stringify(n['type'])}`,
      );
    }
    if (Array.isArray(a['enum'])) {
      const ahora = new Set(Array.isArray(n['enum']) ? n['enum'] : []);
      for (const v of a['enum']) {
        if (!ahora.has(v)) fallas.push(`${donde}: ya no acepta ${JSON.stringify(v)}`);
      }
    }
    if ('const' in a && JSON.stringify(a['const']) !== JSON.stringify(n['const'])) {
      fallas.push(`${donde}: el valor fijo cambió`);
    }
    const pa = (a['properties'] ?? {}) as Record<string, Esquema>;
    const pn = (n['properties'] ?? {}) as Record<string, Esquema>;
    for (const k of Object.keys(pa)) {
      if (!(k in pn)) fallas.push(`${donde}.${k}: se quitó`);
      else comparar(`${donde}.${k}`, pa[k], pn[k]);
    }
    const ra = new Set((a['required'] ?? []) as string[]);
    for (const k of (n['required'] ?? []) as string[]) {
      if (!ra.has(k)) fallas.push(`${donde}.${k}: ahora es obligatorio`);
    }
    if (a['items'] && typeof a['items'] === 'object') {
      comparar(`${donde}[]`, a['items'] as Esquema, n['items'] as Esquema | undefined);
    }
  };
  for (const [ruta, metodos] of Object.entries(anterior.paths ?? {})) {
    for (const metodo of Object.keys(metodos)) {
      const donde = `${metodo.toUpperCase()} ${ruta}`;
      if (!nuevo.paths?.[ruta]?.[metodo]) {
        fallas.push(`${donde}: se quitó`);
        continue;
      }
      comparar(donde, cuerpoDe(anterior, ruta, metodo), cuerpoDe(nuevo, ruta, metodo));
    }
  }
  return fallas;
}
