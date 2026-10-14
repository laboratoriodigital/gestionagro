/**
 * Lo que la caja abre al primer toque: ajustes, entrada y recibo. Viven aparte porque cargan los
 * esquemas (zod) y los recibos; abrir la caja no los espera (HU-Q3.1 CA3, P19). Están en la
 * precarga del service worker: sin red abren igual.
 */
import { uuidv7 } from '@ed1/ids';
import { faltantesDeSede, juntar } from '@ed1/parqueadero-recibos';
import type { Abonado, Registro, Vehiculo } from '@ed1/parqueadero-schema';
import { useMemo } from 'preact/hooks';
import { Abonados } from './Abonados.tsx';
import { Ahorro } from './Ahorro.tsx';
import { Ajustes as PantallaDeAjustes, VEHICULOS_DE_LA_CAJA } from './Ajustes.tsx';
import { Aviso } from './Aviso.tsx';
import {
  type Ajustes,
  type Contexto,
  faltaParaRegistrar,
  leerAbonados,
  leerAjustes,
} from './almacen.ts';
import { Cuenta } from './Cuenta.tsx';
import type { BaseDeLaCaja } from './datos.ts';
import { Entrada } from './Entrada.tsx';
import { Escanear } from './Escanear.tsx';
import { useConsulta } from './ganchos.ts';
import type { ControlDeImpresora } from './impresora.ts';
import { Letrero } from './Letrero.tsx';
import type { Nube } from './nube.ts';
import { Pendientes } from './Pendientes.tsx';
import { avisoAceptado } from './privacidad.ts';
import { Recibo } from './Recibo.tsx';
import { Reportes } from './Reportes.tsx';
import { Respaldo } from './Respaldo.tsx';
import { Salida } from './Salida.tsx';
import { AbrirTurno, Turno } from './Turno.tsx';
import { type Turno as TurnoAbierto, turnoAbierto, usaTurnos } from './turno.ts';

export type Vista =
  | { readonly es: 'inicio' }
  | { readonly es: 'asistente' }
  | { readonly es: 'ajustes'; readonly enfocar?: string }
  | { readonly es: 'entrada' }
  | { readonly es: 'salida'; readonly estadiaId: string }
  | { readonly es: 'escanear' }
  | { readonly es: 'aviso' }
  | { readonly es: 'letrero' }
  | { readonly es: 'turno' }
  /** `regreso`: el fragmento con que volvió de Google Drive (HU-Q10.1). */
  | { readonly es: 'respaldo'; readonly regreso?: string }
  /** `mensualidad`: abre su recibo para reimprimirlo, desde las entregas pendientes. */
  | { readonly es: 'abonados'; readonly mensualidad?: Registro }
  | { readonly es: 'pendientes' }
  | { readonly es: 'reportes' }
  | { readonly es: 'ahorro' }
  /** `regreso`: el fragmento con que volvió de la cuenta (HU-Q7.6). */
  | { readonly es: 'cuenta'; readonly regreso?: string }
  | { readonly es: 'recibo'; readonly registro: Registro };

/** Los vehículos que la caja puede registrar hoy: los que tienen tarifa. */
const conTarifa = (a: Ajustes): Vehiculo[] =>
  VEHICULOS_DE_LA_CAJA.filter((v) => a.tarifas.some((t) => t.vehiculo === v));

/** Lo que falta para la primera entrada; sin ninguna tarifa, pide la del carro. */
export function queFalta(a: Ajustes): { faltan: string[]; campo: string | undefined } {
  const vehiculos = conTarifa(a);
  const faltan = faltaParaRegistrar(a, vehiculos.length ? vehiculos : ['carro']);
  const campoDeSede = faltantesDeSede(a.sede)[0];
  const campo = campoDeSede
    ? `sede-${campoDeSede}`
    : vehiculos.length
      ? undefined
      : 'tarifa-carro-valor';
  return { faltan, campo };
}

interface Props {
  readonly vista: Exclude<Vista, { es: 'inicio' } | { es: 'asistente' }>;
  readonly db: BaseDeLaCaja;
  readonly reloj: () => number;
  readonly control: ControlDeImpresora;
  readonly prueba: boolean;
  readonly ir: (v: Vista) => void;
  readonly nube?: Nube;
}

export function Pantalla({ vista, db, reloj, control, prueba, ir, nube }: Props) {
  // Los ids de los registros son UUIDv7: ordenan por instante (ADR-4).
  const ctx = useMemo<Contexto>(() => ({ reloj, nuevoId: () => uuidv7(reloj) }), [reloj]);
  const inicio = () => ir({ es: 'inicio' });
  switch (vista.es) {
    case 'ajustes':
      return <PantallaDeAjustes db={db} ctx={ctx} alTerminar={inicio} enfocar={vista.enfocar} />;
    case 'entrada':
      return <EntradaOFalta db={db} ctx={ctx} ir={ir} />;
    case 'salida':
      return (
        <Salida
          db={db}
          ctx={ctx}
          estadiaId={vista.estadiaId}
          alCobrar={(r) => ir({ es: 'recibo', registro: r })}
          alVolver={inicio}
        />
      );
    case 'escanear':
      return (
        <Escanear
          db={db}
          alEncontrar={(id) => ir({ es: 'salida', estadiaId: id })}
          alVolver={inicio}
        />
      );
    case 'turno':
      return (
        <Turno
          db={db}
          ctx={ctx}
          control={control}
          alAbrir={inicio}
          alRespaldo={() => ir({ es: 'respaldo' })}
          alVolver={inicio}
        />
      );
    case 'respaldo':
      return (
        <Respaldo
          db={db}
          ctx={ctx}
          {...(nube ? { nube } : {})}
          {...(vista.regreso ? { regreso: vista.regreso } : {})}
          alVolver={inicio}
        />
      );
    case 'abonados':
      return (
        <Abonados
          db={db}
          ctx={ctx}
          control={control}
          {...(vista.mensualidad ? { mensualidad: vista.mensualidad } : {})}
          alVolver={inicio}
        />
      );
    case 'pendientes':
      return (
        <Pendientes
          db={db}
          reloj={reloj}
          alAbrir={(r) =>
            ir(
              r.tipo === 'pago_abonado'
                ? { es: 'abonados', mensualidad: r }
                : { es: 'recibo', registro: r },
            )
          }
          alVolver={inicio}
        />
      );
    case 'reportes':
      return <Reportes db={db} reloj={reloj} alVolver={inicio} />;
    case 'ahorro':
      return (
        <Ahorro
          db={db}
          reloj={reloj}
          alCosto={() => ir({ es: 'ajustes', enfocar: 'sede-costoPapel' })}
          alVolver={inicio}
        />
      );
    case 'cuenta':
      return (
        <Cuenta
          db={db}
          reloj={reloj}
          {...(nube ? { nube } : {})}
          {...(vista.regreso ? { regreso: vista.regreso } : {})}
          alAjustes={() => ir({ es: 'ajustes' })}
          alVolver={inicio}
        />
      );
    case 'aviso':
      return (
        <Aviso
          db={db}
          control={control}
          alAjustes={() => ir({ es: 'ajustes', enfocar: 'aviso' })}
          alVolver={inicio}
        />
      );
    case 'letrero':
      return <Letrero db={db} alAjustes={() => ir({ es: 'ajustes' })} alVolver={inicio} />;
    default:
      return (
        <Recibo
          db={db}
          ctx={ctx}
          control={control}
          registro={vista.registro}
          prueba={prueba}
          alNueva={() => ir({ es: 'entrada' })}
          alVolver={inicio}
        />
      );
  }
}

/** Mientras falte un dato legal, «Entrada» dice qué falta y lleva al campo (HU-Q3.2 CA2). */
function EntradaOFalta({ db, ctx, ir }: Pick<Props, 'db' | 'ir'> & { ctx: Contexto }) {
  const ajustes = useConsulta<Ajustes | null>(() => leerAjustes(db), null);
  const abonados = useConsulta<Abonado[] | null>(() => leerAbonados(db), null);
  const turno = useConsulta<TurnoAbierto | null | undefined>(() => turnoAbierto(db), undefined);
  if (!ajustes || !abonados || turno === undefined)
    return <section class="tarjeta" aria-busy="true" />;
  const { faltan, campo } = queFalta(ajustes);
  // Ningún recibo fuera de un turno (HU-Q3.9 CA4): al abrirlo, sigue la entrada.
  if (faltan.length === 0 && usaTurnos(ajustes.sede) && !turno) {
    return (
      <AbrirTurno
        db={db}
        ctx={ctx}
        alAbrir={() => undefined}
        alVolver={() => ir({ es: 'inicio' })}
      />
    );
  }
  if (faltan.length === 0) {
    return (
      <Entrada
        db={db}
        ctx={ctx}
        vehiculos={conTarifa(ajustes)}
        pideNumero={avisoAceptado(ajustes.sede)}
        abonados={abonados}
        alRegistrar={(r) => ir({ es: 'recibo', registro: r })}
        alCancelar={() => ir({ es: 'inicio' })}
      />
    );
  }
  return (
    <section class="tarjeta" data-prueba="falta-para-entrada">
      <h1>Nueva entrada</h1>
      <p class="error" data-prueba="falta">
        Antes del primer recibo falta: {juntar(faltan)}.
      </p>
      <button
        type="button"
        class="boton boton-principal"
        onClick={() => ir(campo ? { es: 'ajustes', enfocar: campo } : { es: 'ajustes' })}
      >
        Completar los ajustes
      </button>
      <button type="button" class="boton boton-secundario" onClick={() => ir({ es: 'inicio' })}>
        Volver al inicio
      </button>
    </section>
  );
}
