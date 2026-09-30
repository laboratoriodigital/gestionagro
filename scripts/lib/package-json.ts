/**
 * Reglas sobre los package.json del monorepo.
 *
 * - Ningún script invoca bash ni sh, ni usa rutas o comandos POSIX: el dueño trabaja en Windows (P3, ADR-18).
 * - Cada clave de las dependencias es un nombre de paquete válido: una nota dentro de
 *   `devDependencies` rompió la instalación en la línea ecommerce («nota en devDependencies»).
 */

export interface Hallazgo {
  archivo: string;
  clave: string;
  motivo: string;
}

const REGLAS_DE_SCRIPT: ReadonlyArray<{ patron: RegExp; motivo: string }> = [
  { patron: /(^|[\s;&|(])(ba|z)?sh(\s|$)/, motivo: 'invoca bash o sh' },
  { patron: /\.sh(\s|$|["'])/, motivo: 'ejecuta un archivo .sh' },
  { patron: /(^|[\s="'])\/[A-Za-z_.]/, motivo: 'usa una ruta absoluta con / fija' },
  {
    patron: /(^|[\s;&|(])(rm|cp|mv|cat|export|chmod|grep|sed|touch|mkdir -p)\s/,
    motivo: 'usa un comando POSIX que no existe en Windows',
  },
  { patron: /\$\{?[A-Za-z_]/, motivo: 'expande una variable con sintaxis POSIX' },
];

export function revisarScripts(
  archivo: string,
  scripts: Readonly<Record<string, string>>,
): Hallazgo[] {
  const hallazgos: Hallazgo[] = [];
  for (const [clave, comando] of Object.entries(scripts)) {
    for (const regla of REGLAS_DE_SCRIPT) {
      if (regla.patron.test(comando)) {
        hallazgos.push({
          archivo,
          clave: `scripts.${clave}`,
          motivo: `${regla.motivo}: «${comando}»`,
        });
      }
    }
  }
  return hallazgos;
}

/** Nombre válido para npm: minúsculas, sin empezar por `.` ni `_`, con alcance opcional. */
const NOMBRE_DE_PAQUETE = /^(?:@[a-z0-9-~][a-z0-9-._~]*\/)?[a-z0-9-~][a-z0-9-._~]*$/;

export function nombreDePaqueteValido(nombre: string): boolean {
  return nombre.length > 0 && nombre.length <= 214 && NOMBRE_DE_PAQUETE.test(nombre);
}

const SECCIONES_DE_DEPENDENCIAS = [
  'dependencies',
  'devDependencies',
  'peerDependencies',
  'optionalDependencies',
] as const;

export function revisarDependencias(
  archivo: string,
  paquete: Readonly<Record<string, unknown>>,
): Hallazgo[] {
  const hallazgos: Hallazgo[] = [];
  for (const seccion of SECCIONES_DE_DEPENDENCIAS) {
    const deps = paquete[seccion];
    if (deps === undefined) continue;
    if (typeof deps !== 'object' || deps === null || Array.isArray(deps)) {
      hallazgos.push({ archivo, clave: seccion, motivo: 'no es un objeto' });
      continue;
    }
    for (const nombre of Object.keys(deps)) {
      if (!nombreDePaqueteValido(nombre)) {
        hallazgos.push({
          archivo,
          clave: `${seccion}.${nombre}`,
          motivo: 'no es un nombre de paquete válido; las notas van en un campo de primer nivel',
        });
      }
    }
  }
  return hallazgos;
}

export function revisarPackageJson(
  archivo: string,
  paquete: Readonly<Record<string, unknown>>,
): Hallazgo[] {
  const scripts = paquete['scripts'];
  const deScripts =
    typeof scripts === 'object' && scripts !== null
      ? revisarScripts(archivo, scripts as Record<string, string>)
      : [];
  return [...deScripts, ...revisarDependencias(archivo, paquete)];
}
