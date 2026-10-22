/**
 * El dominio propio de una tienda (HU-T13.1 y HU-T13.3, TIENDA-3.0 §4.2 y §4.3): lo que escribe el
 * comercio, leído como un hostname, y los registros que tiene que crear en su proveedor, dichos en
 * palabras. Lo usan el panel, que explica, y la API, que decide (P2). Puro y sin red.
 */

import { DOMINIO_DE_LA_MARCA, ZONA_DE_LAS_TIENDAS } from './marca.ts';

/** Las direcciones de la plataforma: una tienda no las conecta como dominio propio. */
export const ZONAS_DE_LA_PLATAFORMA = [
  ZONA_DE_LAS_TIENDAS,
  DOMINIO_DE_LA_MARCA,
  'laboratorio-digital.app',
  'laboratorio-digital.com',
  'laboratorio-digital.co',
] as const;

/**
 * El destino del CNAME de todo dominio propio: el origen de respaldo de Cloudflare for SaaS, en la
 * zona de las tiendas (HU-T18.1).
 */
export const DESTINO_DEL_CNAME = `origen.${ZONA_DE_LAS_TIENDAS}`;

/**
 * Los segundos niveles que se registran como un dominio (`midominio.com.co`): sin esta lista, la raíz
 * de un `.com.co` se leería como un subdominio. Los de Colombia primero; los demás, de la región.
 */
const SEGUNDOS_NIVELES = new Set([
  'com.co',
  'net.co',
  'org.co',
  'edu.co',
  'gov.co',
  'mil.co',
  'nom.co',
  'com.mx',
  'com.ar',
  'com.br',
  'com.pe',
  'com.ec',
  'com.ve',
  'com.pa',
  'com.uy',
  'com.bo',
  'com.py',
  'co.uk',
  'com.es',
]);

export type DominioLeido =
  | {
      ok: true;
      hostname: string;
      /** `midominio.co`: la raíz, sin subdominio (HU-T13.3). */
      raiz: boolean;
      /** La raíz del dominio, para la raíz con «www» y sin ella. */
      registrable: string;
    }
  | { ok: false; motivo: string };

const ETIQUETA = /^(?!-)[a-z0-9-]{1,63}(?<!-)$/;

/** La raíz registrable: `tienda.midominio.com.co` → `midominio.com.co`. */
export function registrableDe(hostname: string): string {
  const partes = hostname.split('.');
  const dos = partes.slice(-2).join('.');
  return partes.slice(SEGUNDOS_NIVELES.has(dos) ? -3 : -2).join('.');
}

/**
 * Lo que escribió el comercio, como hostname: sin `https://`, sin ruta ni puerto, en minúsculas y
 * con los acentos en punycode (`tiendañ.co` → `xn--tienda-1wa.co`). Nunca una dirección de la
 * plataforma, una IP ni un nombre sin punto.
 */
export function leerDominio(texto: string): DominioLeido {
  const limpio = texto.trim().toLowerCase();
  if (!limpio)
    return { ok: false, motivo: 'Escribe la dirección de tu tienda, como www.midominio.co.' };
  let hostname: string;
  try {
    hostname = new URL(/^[a-z]+:\/\//.test(limpio) ? limpio : `https://${limpio}`).hostname;
  } catch {
    return { ok: false, motivo: 'Eso no parece una dirección. Escríbela como www.midominio.co.' };
  }
  hostname = hostname.replace(/\.$/, '');
  if (/^[0-9.]+$/.test(hostname) || hostname.includes(':')) {
    return { ok: false, motivo: 'Escribe el nombre de tu dominio, no una IP.' };
  }
  const partes = hostname.split('.');
  if (partes.length < 2 || hostname.length > 253 || !partes.every((p) => ETIQUETA.test(p))) {
    return { ok: false, motivo: 'Eso no parece una dirección. Escríbela como www.midominio.co.' };
  }
  if (ZONAS_DE_LA_PLATAFORMA.some((z) => hostname === z || hostname.endsWith(`.${z}`))) {
    return {
      ok: false,
      motivo: 'Esa dirección ya es de la plataforma: tu tienda la tiene sin conectar nada.',
    };
  }
  const registrable = registrableDe(hostname);
  if (registrable.split('.').length < 2 || SEGUNDOS_NIVELES.has(hostname)) {
    return { ok: false, motivo: 'Falta el nombre de tu dominio, como midominio.com.co.' };
  }
  return { ok: true, hostname, raiz: hostname === registrable, registrable };
}

/** Lo que el comercio crea en su proveedor de dominio, con el nombre relativo y el completo. */
export interface Registro {
  tipo: 'CNAME' | 'TXT';
  /** Lo que se escribe en «Nombre» o «Host» en casi todos los proveedores: sin la raíz. */
  nombre: string;
  /** El nombre completo, para los proveedores que lo piden así. */
  completo: string;
  valor: string;
  /** Para qué sirve, en palabras. */
  paraQue: string;
}

/** `_acme-challenge.www.midominio.co` en `midominio.co` → `_acme-challenge.www`. */
export function nombreRelativo(completo: string, registrable: string): string {
  if (completo === registrable) return '@';
  return completo.endsWith(`.${registrable}`)
    ? completo.slice(0, -(registrable.length + 1))
    : completo;
}

/** Lo que Cloudflare pide para validar un hostname: su propiedad y su certificado, por TXT. */
export interface Validacion {
  propiedad: { nombre: string; valor: string } | null;
  certificado: { nombre: string; valor: string }[];
}

/**
 * Los tres registros de TIENDA §4.2, en el orden en que se crean: los TXT primero, para que el
 * certificado esté listo antes de que llegue el tráfico (sin un minuto sin HTTPS), y el CNAME al
 * final. Una raíz solo se conecta si el proveedor del comercio deja un CNAME en ella (CNAME
 * flattening, ALIAS o ANAME, HU-T13.3); si no, se redirige desde el proveedor (`REDIRIGIR_LA_RAIZ`).
 */
export function registrosDelDominio(hostname: string, v: Validacion): Registro[] {
  const registrable = registrableDe(hostname);
  const txt = (completo: string, valor: string, paraQue: string): Registro => ({
    tipo: 'TXT',
    nombre: nombreRelativo(completo, registrable),
    completo,
    valor,
    paraQue,
  });
  return [
    ...(v.propiedad
      ? [txt(v.propiedad.nombre, v.propiedad.valor, 'Prueba que el dominio es tuyo.')]
      : []),
    ...v.certificado.map((c) =>
      txt(
        c.nombre,
        c.valor,
        'Deja listo el candado (HTTPS) antes de que llegue la primera visita.',
      ),
    ),
    {
      tipo: 'CNAME' as const,
      nombre: nombreRelativo(hostname, registrable),
      completo: hostname,
      valor: DESTINO_DEL_CNAME,
      paraQue:
        hostname === registrable
          ? 'Lleva a tu tienda a quien escriba la dirección sin «www». Si tu proveedor no deja un CNAME en «@», usa un registro ALIAS o ANAME con el mismo valor. Créalo de último.'
          : 'Lleva a tu tienda a quien escriba esta dirección. Créalo de último.',
    },
  ];
}

export const ESTADOS_DEL_DOMINIO = [
  'pendiente',
  'validando',
  'activo',
  'error',
  'retirado',
] as const;
export type EstadoDelDominio = (typeof ESTADOS_DEL_DOMINIO)[number];

/** El estado, como lo lee el comercio. */
export const ESTADO_EN_PALABRAS: Readonly<Record<EstadoDelDominio, string>> = {
  pendiente: 'Esperando tus registros',
  validando: 'Registros encontrados: preparando el candado',
  activo: 'Conectado',
  error: 'No se pudo conectar',
  retirado: 'Desconectado',
};

/**
 * HU-T13.3 CA1: cómo redirigir la raíz a «www» desde los proveedores de dominio más usados en
 * Colombia, cuando no dejan un CNAME en la raíz. Nunca se pide mover el dominio ni su DNS a la
 * cuenta de la plataforma (CA2, HA2): el dominio sigue siendo del comercio, en su proveedor.
 */
export const REDIRIGIR_LA_RAIZ: readonly { proveedor: string; pasos: string }[] = [
  {
    proveedor: 'GoDaddy',
    pasos:
      'En «Mis productos», abre tu dominio y entra a «DNS». En «Reenvío» (Forwarding), agrega uno para el dominio: destino https://www.tudominio, tipo permanente (301).',
  },
  {
    proveedor: 'Hostinger',
    pasos:
      'En «Dominios», abre tu dominio y entra a «Redirigir dominio». Escribe https://www.tudominio y elige redirección permanente (301).',
  },
  {
    proveedor: 'Namecheap',
    pasos:
      'En «Domain List», pulsa «Manage» junto a tu dominio. En «Redirect Domain», agrega el origen «tudominio» y el destino https://www.tudominio.',
  },
  {
    proveedor: 'Cloudflare',
    pasos:
      'Cloudflare deja un CNAME en la raíz (CNAME flattening): conecta la dirección sin «www» aquí mismo, como otra dirección de tu tienda.',
  },
  {
    proveedor: 'Otro proveedor',
    pasos:
      'Busca en su panel «Reenvío», «Redirección» o «Forwarding» de dominio, y redirige la raíz a https://www.tudominio de forma permanente (301). Si no lo encuentras, pregúntale a su soporte por «redirigir el dominio raíz a www».',
  },
];
