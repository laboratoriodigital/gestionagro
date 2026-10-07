/**
 * Ajustes del parqueadero (HU-Q3.2, PARQUEADERO §5.1): los datos legales de la sede, las tarifas
 * con su tope y el PIN de administrador. Ningún campo trae un valor de fábrica (§6.1): todo empieza
 * vacío, la póliza y la impresión automática se responden con Sí o No, y lo que falta sale en rojo
 * junto a su campo. Con un PIN ya puesto, entrar pide el PIN.
 */
import type { Redondeo, Sede, Tarifa, Vehiculo } from '@ed1/parqueadero-schema';
import { ErrorDeValidacion, VEHICULOS } from '@ed1/parqueadero-schema';
import { validarTarifa } from '@ed1/parqueadero-tarifas';
import type { ComponentChildren } from 'preact';
import { useEffect, useMemo, useState } from 'preact/hooks';
import { abrirFormulario } from './actividad.ts';
import {
  type Contexto,
  guardarAjusteRecibo,
  guardarPin,
  guardarSede,
  guardarTarifa,
  leerAjustes,
  PIN_VALIDO,
  TarifaSobreElTope,
  tienePin,
  verificarPin,
} from './almacen.ts';
import type { BaseDeLaCaja } from './datos.ts';
import { useConsulta } from './ganchos.ts';
import { avisoAceptado, avisoDeLaSede, VERSION_DEL_AVISO } from './privacidad.ts';

/** Los vehículos que la caja cobra en M0: los del primer cliente (bitácora parqueadero 9). */
export const VEHICULOS_DE_LA_CAJA: readonly Vehiculo[] = ['carro', 'moto'];

const CAMPOS_TARIFA = [
  'valor',
  'tope',
  'gracia',
  'topeDia',
  'plenaDesde',
  'plenaValor',
  'nocheDesde',
  'nocheHasta',
  'nocheValor',
  'perdido',
  'redondeo',
] as const;
type CampoTarifa = (typeof CAMPOS_TARIFA)[number];
type BorradorTarifa = Record<CampoTarifa, string>;

export interface Borrador {
  nombre: string;
  nit: string;
  direccion: string;
  ciudad: string;
  telefono: string;
  poliza: '' | 'si' | 'no';
  aseguradora: string;
  numeroPoliza: string;
  registro: string;
  imprimir: '' | 'si' | 'no';
  /** La sede acepta el aviso de privacidad vigente (HU-Q4.4 CA2). */
  aviso: boolean;
  pie: string;
  pin: string;
  pin2: string;
  tarifas: Record<string, BorradorTarifa>;
}

const tarifaVacia = (): BorradorTarifa =>
  Object.fromEntries(CAMPOS_TARIFA.map((c) => [c, ''])) as BorradorTarifa;

export const borradorVacio = (): Borrador => ({
  nombre: '',
  nit: '',
  direccion: '',
  ciudad: '',
  telefono: '',
  poliza: '',
  aseguradora: '',
  numeroPoliza: '',
  registro: '',
  imprimir: '',
  aviso: false,
  pie: '',
  pin: '',
  pin2: '',
  tarifas: Object.fromEntries(VEHICULOS_DE_LA_CAJA.map((v) => [v, tarifaVacia()])),
});

const texto = (n: number | null | undefined) => (n === null || n === undefined ? '' : String(n));

function borradorDe(sede: Sede | null, tarifas: readonly Tarifa[], pie: string | null): Borrador {
  const b = borradorVacio();
  if (sede) {
    Object.assign(b, {
      nombre: sede.nombre,
      nit: sede.nit,
      direccion: sede.direccion,
      ciudad: sede.ciudad,
      telefono: sede.telefono,
      poliza: sede.poliza ? 'si' : 'no',
      aseguradora: sede.poliza?.aseguradora ?? '',
      numeroPoliza: sede.poliza?.numero ?? '',
      registro: sede.registro ?? '',
      imprimir: sede.imprimir_siempre ? 'si' : 'no',
      aviso: avisoAceptado(sede),
    });
  }
  b.pie = pie ?? '';
  for (const t of tarifas) {
    b.tarifas[t.vehiculo] = {
      valor: texto(t.valor),
      tope: texto(t.tope_minuto),
      gracia: texto(t.gracia_min),
      topeDia: texto(t.tope_dia),
      plenaDesde: texto(t.plena?.desde_min),
      plenaValor: texto(t.plena?.valor),
      nocheDesde: t.nocturna?.desde ?? '',
      nocheHasta: t.nocturna?.hasta ?? '',
      nocheValor: texto(t.nocturna?.valor),
      perdido: texto(t.perdido),
      redondeo: t.redondeo,
    };
  }
  return b;
}

export type Errores = Record<string, string>;

/** Un entero de pesos o minutos como lo escribe el cajero: `15000` o `15.000`. */
function entero(valor: string): number | null | 'mal' {
  const limpio = valor.trim().replaceAll('.', '');
  if (limpio === '') return null;
  return /^\d{1,9}$/.test(limpio) ? Number(limpio) : 'mal';
}

type TarifaSinMeta = Omit<Tarifa, 'id' | 'org_id' | 'version' | 'actualizado' | 'entidad'>;

/**
 * Lee el formulario: lo que está bien para guardar y los errores por campo. Una tarifa con todos
 * sus campos vacíos es un vehículo que la sede no recibe; a medias, es un error.
 */
export function leerBorrador(
  b: Borrador,
  hayPin: boolean,
  vigenteDesde: string,
): { errores: Errores; tarifas: TarifaSinMeta[] } {
  const errores: Errores = {};
  const falta = (campo: string) => {
    errores[campo] = 'Falta este dato';
  };
  for (const campo of ['nombre', 'nit', 'direccion', 'ciudad', 'telefono'] as const) {
    if (!b[campo].trim()) falta(`sede-${campo}`);
  }
  if (!b.poliza) errores['sede-poliza'] = 'Diga si el parqueadero tiene póliza';
  if (b.poliza === 'si') {
    if (!b.aseguradora.trim()) falta('sede-aseguradora');
    if (!b.numeroPoliza.trim()) falta('sede-numeroPoliza');
  }
  if (!b.imprimir) errores['sede-imprimir'] = 'Diga si el recibo se imprime al registrar';
  if (!hayPin || b.pin || b.pin2) {
    if (!PIN_VALIDO.test(b.pin)) errores['pin'] = 'El PIN es de 4 a 6 números';
    else if (b.pin !== b.pin2) errores['pin2'] = 'No es igual al PIN';
  }

  const tarifas: TarifaSinMeta[] = [];
  for (const v of VEHICULOS_DE_LA_CAJA) {
    const t = b.tarifas[v] ?? tarifaVacia();
    if (CAMPOS_TARIFA.every((c) => t[c].trim() === '')) continue;
    const id = (c: CampoTarifa) => `tarifa-${v}-${c}`;
    const n: Record<string, number | null> = {};
    for (const c of CAMPOS_TARIFA) {
      if (c === 'nocheDesde' || c === 'nocheHasta' || c === 'redondeo') continue;
      const x = entero(t[c]);
      if (x === 'mal') errores[id(c)] = 'Escriba solo números';
      else n[c] = x;
    }
    for (const c of ['valor', 'tope', 'gracia'] as const) {
      if (n[c] === null && !errores[id(c)]) falta(id(c));
    }
    if (!t.redondeo) errores[id('redondeo')] = 'Elija cómo redondear';
    const conPlena = n['plenaDesde'] !== null || n['plenaValor'] !== null;
    if (conPlena && n['plenaDesde'] === null) falta(id('plenaDesde'));
    if (conPlena && n['plenaValor'] === null) falta(id('plenaValor'));
    const conNoche = Boolean(t.nocheDesde || t.nocheHasta || t.nocheValor);
    if (conNoche) {
      for (const c of ['nocheDesde', 'nocheHasta'] as const) {
        if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(t[c]))
          errores[id(c)] = 'Escriba la hora como 20:00';
      }
      if (n['nocheValor'] === null) falta(id('nocheValor'));
    }
    if (Object.keys(errores).some((k) => k.startsWith(`tarifa-${v}-`))) continue;
    const tarifa: TarifaSinMeta = {
      vehiculo: v,
      modo: 'minuto',
      valor: n['valor'] ?? 0,
      fraccion_min: null,
      gracia_min: n['gracia'] ?? 0,
      tope_dia: n['topeDia'] ?? null,
      plena: conPlena ? { desde_min: n['plenaDesde'] ?? 0, valor: n['plenaValor'] ?? 0 } : null,
      nocturna: conNoche
        ? { desde: t.nocheDesde, hasta: t.nocheHasta, valor: n['nocheValor'] ?? 0 }
        : null,
      perdido: n['perdido'] ?? null,
      redondeo: t.redondeo as Redondeo,
      tope_minuto: n['tope'] ?? null,
      vigente_desde: vigenteDesde,
    };
    // HU-Q3.2 CA3: una tarifa por encima del tope no se guarda, y la caja dice por qué.
    const DE_CAMPO: Record<string, CampoTarifa> = {
      valor: 'valor',
      'plena.valor': 'plenaValor',
      'nocturna.valor': 'nocheValor',
      gracia_min: 'gracia',
      'plena.desde_min': 'plenaDesde',
      'nocturna.hasta': 'nocheHasta',
    };
    const problemas = validarTarifa(tarifa, tarifa.tope_minuto);
    for (const p of problemas) errores[id(DE_CAMPO[p.campo] ?? 'valor')] = p.motivo;
    if (problemas.length === 0) tarifas.push(tarifa);
  }
  if (tarifas.length === 0 && !Object.keys(errores).some((k) => k.startsWith('tarifa-'))) {
    errores['tarifa-carro-valor'] = 'Ponga la tarifa de al menos un vehículo';
  }
  return { errores, tarifas };
}

interface PropsCampo {
  readonly id: string;
  readonly etiqueta: string;
  readonly errores: Errores;
  readonly ayuda?: string;
  readonly children: ComponentChildren;
}

function Campo({ id, etiqueta, errores, ayuda, children }: PropsCampo) {
  const error = errores[id];
  return (
    <div class="campo" data-error={error ? '' : undefined}>
      <label for={id}>{etiqueta}</label>
      {children}
      {ayuda && <span class="ayuda">{ayuda}</span>}
      {error && (
        <p class="error" id={`${id}-error`} data-prueba={`error-${id}`}>
          {error}
        </p>
      )}
    </div>
  );
}

interface Props {
  readonly db: BaseDeLaCaja;
  readonly ctx: Contexto;
  readonly alTerminar: () => void;
  /** El campo al que lleva «Antes del primer recibo falta…» (HU-Q3.2 CA2). */
  readonly enfocar?: string | undefined;
}

export function Ajustes({ db, ctx, alTerminar, enfocar }: Props) {
  const [cargado, setCargado] = useState(false);
  const [conPin, setConPin] = useState(false);
  const [desbloqueado, setDesbloqueado] = useState(false);
  const [pinDeEntrada, setPinDeEntrada] = useState('');
  const [avisoPin, setAvisoPin] = useState('');
  const [b, setB] = useState<Borrador>(borradorVacio);
  const [ids, setIds] = useState<{
    sede: string | null;
    ajuste: string | null;
    tarifas: Record<string, string>;
  }>({
    sede: null,
    ajuste: null,
    tarifas: {},
  });
  const [avisoGuardado, setAvisoGuardado] = useState<Sede['aviso_privacidad']>(null);
  const [errores, setErrores] = useState<Errores>({});
  const [guardando, setGuardando] = useState(false);
  /** `undefined`: sin cambios; `null`: quitar la imagen. */
  const [qrPago, setQrPago] = useState<Blob | null | undefined>(undefined);
  const qrGuardado = useConsulta(async () => {
    const m = await db.meta.get('qr_pago');
    return m?.clave === 'qr_pago' ? m.datos : null;
  }, null);
  const qrVisible = qrPago === undefined ? qrGuardado : qrPago;

  useEffect(() => abrirFormulario(), []);

  useEffect(() => {
    void (async () => {
      const a = await leerAjustes(db);
      setB(borradorDe(a.sede, a.tarifas, a.ajuste?.pie ?? null));
      setAvisoGuardado(a.sede?.aviso_privacidad ?? null);
      setIds({
        sede: a.sede?.id ?? null,
        ajuste: a.ajuste?.id ?? null,
        tarifas: Object.fromEntries(a.tarifas.map((t) => [t.vehiculo, t.id])),
      });
      const hay = await tienePin(db);
      setConPin(hay);
      setDesbloqueado(!hay);
      setCargado(true);
    })();
  }, [db]);

  useEffect(() => {
    if (desbloqueado && enfocar) document.getElementById(enfocar)?.focus();
  }, [desbloqueado, enfocar]);

  const poner = (campo: keyof Borrador) => (e: Event) =>
    setB({ ...b, [campo]: (e.currentTarget as HTMLInputElement).value });
  const ponerTarifa = (v: Vehiculo, campo: CampoTarifa) => (e: Event) =>
    setB({
      ...b,
      tarifas: {
        ...b.tarifas,
        [v]: {
          ...(b.tarifas[v] ?? tarifaVacia()),
          [campo]: (e.currentTarget as HTMLInputElement).value,
        },
      },
    });

  async function entrar(e: Event) {
    e.preventDefault();
    if (await verificarPin(db, pinDeEntrada)) {
      setDesbloqueado(true);
      setAvisoPin('');
    } else {
      setAvisoPin('Ese no es el PIN de administrador');
    }
  }

  async function guardar(e: Event) {
    e.preventDefault();
    const { errores: encontrados, tarifas } = leerBorrador(
      b,
      conPin,
      new Date(ctx.reloj()).toISOString(),
    );
    setErrores(encontrados);
    const primero = Object.keys(encontrados)[0];
    if (primero) {
      document.getElementById(primero)?.focus();
      return;
    }
    setGuardando(true);
    try {
      await guardarSede(
        db,
        {
          nombre: b.nombre,
          nit: b.nit,
          direccion: b.direccion,
          ciudad: b.ciudad,
          telefono: b.telefono,
          poliza: b.poliza === 'si' ? { aseguradora: b.aseguradora, numero: b.numeroPoliza } : null,
          registro: b.registro.trim() || null,
          imprimir_siempre: b.imprimir === 'si',
          // Aceptarlo otra vez no cambia la fecha en que se aceptó esta versión.
          aviso_privacidad: !b.aviso
            ? null
            : avisoAceptado({ aviso_privacidad: avisoGuardado })
              ? avisoGuardado
              : { version: VERSION_DEL_AVISO, aceptado: new Date(ctx.reloj()).toISOString() },
        },
        ids.sede,
        ctx,
      );
      for (const t of tarifas) await guardarTarifa(db, t, ids.tarifas[t.vehiculo] ?? null, ctx);
      await guardarAjusteRecibo(db, { pie: b.pie.trim() || null }, ids.ajuste, ctx);
      if (b.pin) await guardarPin(db, b.pin);
      if (qrPago) await db.meta.put({ clave: 'qr_pago', datos: qrPago });
      else if (qrPago === null) await db.meta.delete('qr_pago');
      alTerminar();
    } catch (error) {
      if (error instanceof ErrorDeValidacion) {
        setErrores(
          Object.fromEntries(error.campos.map((c) => [`sede-${c.campo.split('.')[0]}`, c.motivo])),
        );
      } else if (error instanceof TarifaSobreElTope) {
        setErrores({ 'tarifa-carro-valor': error.message });
      } else {
        setErrores({ general: `No se pudo guardar: ${String(error)}` });
      }
    } finally {
      setGuardando(false);
    }
  }

  if (!cargado) return <p>Cargando ajustes…</p>;

  if (!desbloqueado) {
    return (
      <form class="tarjeta" onSubmit={entrar} data-prueba="pedir-pin">
        <h1>Ajustes</h1>
        <p>Lo que toca dinero o los textos del recibo pide el PIN de administrador.</p>
        <div class="campo">
          <label for="pin-entrada">PIN de administrador</label>
          <input
            id="pin-entrada"
            type="password"
            inputMode="numeric"
            autoComplete="off"
            value={pinDeEntrada}
            onInput={(e) => setPinDeEntrada(e.currentTarget.value)}
          />
        </div>
        {avisoPin && (
          <p class="error" role="alert">
            {avisoPin}
          </p>
        )}
        <button type="submit" class="boton boton-principal">
          Entrar
        </button>
        <button type="button" class="boton boton-secundario" onClick={alTerminar}>
          Volver a la caja
        </button>
      </form>
    );
  }

  const entrada = (id: string, valor: string, alCambiar: (e: Event) => void, extra = {}) => (
    <input
      id={id}
      value={valor}
      onInput={alCambiar}
      aria-invalid={errores[id] ? 'true' : undefined}
      aria-describedby={errores[id] ? `${id}-error` : undefined}
      {...extra}
    />
  );
  const numero = { inputMode: 'numeric', autoComplete: 'off' };

  return (
    <form class="tarjeta" onSubmit={guardar} noValidate data-prueba="ajustes">
      <h1>Ajustes del parqueadero</h1>
      <p class="ayuda">
        Todo esto sale en el recibo. Nada viene lleno: escriba lo del parqueadero.
      </p>

      <fieldset class="grupo">
        <legend>Su parqueadero</legend>
        <Campo id="sede-nombre" etiqueta="Nombre del parqueadero" errores={errores}>
          {entrada('sede-nombre', b.nombre, poner('nombre'), { maxLength: 40 })}
        </Campo>
        <Campo
          id="sede-nit"
          etiqueta="NIT, con el dígito"
          errores={errores}
          ayuda="Como sale en el RUT: 900.000.000-0"
        >
          {entrada('sede-nit', b.nit, poner('nit'), { maxLength: 16 })}
        </Campo>
        <Campo id="sede-direccion" etiqueta="Dirección" errores={errores}>
          {entrada('sede-direccion', b.direccion, poner('direccion'), { maxLength: 60 })}
        </Campo>
        <Campo id="sede-ciudad" etiqueta="Ciudad" errores={errores}>
          {entrada('sede-ciudad', b.ciudad, poner('ciudad'), { maxLength: 30 })}
        </Campo>
        <Campo id="sede-telefono" etiqueta="Teléfono" errores={errores}>
          {entrada('sede-telefono', b.telefono, poner('telefono'), {
            inputMode: 'tel',
            maxLength: 18,
          })}
        </Campo>
        <fieldset class="campo" data-error={errores['sede-poliza'] ? '' : undefined}>
          <legend>¿Tiene póliza de responsabilidad?</legend>
          <div class="opciones">
            {(['si', 'no'] as const).map((x, i) => (
              <button
                key={x}
                id={i === 0 ? 'sede-poliza' : undefined}
                type="button"
                class="opcion"
                aria-pressed={b.poliza === x}
                onClick={() => setB({ ...b, poliza: x })}
              >
                {x === 'si' ? 'Sí' : 'No'}
              </button>
            ))}
          </div>
          {errores['sede-poliza'] && (
            <p class="error" data-prueba="error-sede-poliza">
              {errores['sede-poliza']}
            </p>
          )}
        </fieldset>
        {b.poliza === 'si' && (
          <div class="dos">
            <Campo id="sede-aseguradora" etiqueta="Aseguradora" errores={errores}>
              {entrada('sede-aseguradora', b.aseguradora, poner('aseguradora'), { maxLength: 30 })}
            </Campo>
            <Campo id="sede-numeroPoliza" etiqueta="Número" errores={errores}>
              {entrada('sede-numeroPoliza', b.numeroPoliza, poner('numeroPoliza'), {
                maxLength: 30,
              })}
            </Campo>
          </div>
        )}
        <Campo id="sede-registro" etiqueta="Registro de la ciudad (si lo tiene)" errores={errores}>
          {entrada('sede-registro', b.registro, poner('registro'), { maxLength: 30 })}
        </Campo>
        <fieldset class="campo">
          <legend>¿Imprimir el recibo al registrar?</legend>
          <div class="opciones">
            {(['si', 'no'] as const).map((x, i) => (
              <button
                key={x}
                id={i === 0 ? 'sede-imprimir' : undefined}
                type="button"
                class="opcion"
                aria-pressed={b.imprimir === x}
                onClick={() => setB({ ...b, imprimir: x })}
              >
                {x === 'si' ? 'Sí, siempre' : 'No, con un botón'}
              </button>
            ))}
          </div>
          {errores['sede-imprimir'] && (
            <p class="error" data-prueba="error-sede-imprimir">
              {errores['sede-imprimir']}
            </p>
          )}
        </fieldset>
        <Campo
          id="pie"
          etiqueta="Línea al pie del recibo (opcional)"
          errores={errores}
          ayuda="El horario, por ejemplo"
        >
          {entrada('pie', b.pie, poner('pie'), { maxLength: 64 })}
        </Campo>
      </fieldset>

      <fieldset class="grupo">
        <legend>Tarifas</legend>
        <p class="ayuda">
          Por minuto iniciado. Deje vacío el vehículo que no recibe. El tope legal es el de la norma
          de su ciudad: la caja no deja guardar una tarifa que lo pase.
        </p>
        {VEHICULOS_DE_LA_CAJA.map((v) => {
          const t = b.tarifas[v] ?? tarifaVacia();
          const id = (c: CampoTarifa) => `tarifa-${v}-${c}`;
          const caja = (c: CampoTarifa, etiqueta: string, ayuda?: string) => (
            <Campo id={id(c)} etiqueta={etiqueta} errores={errores} {...(ayuda ? { ayuda } : {})}>
              {entrada(id(c), t[c], ponerTarifa(v, c), numero)}
            </Campo>
          );
          return (
            <fieldset key={v} class="grupo" data-prueba={`tarifa-${v}`}>
              <legend>{VEHICULOS[v].nombre}</legend>
              <div class="dos">
                {caja('valor', 'Pesos por minuto')}
                {caja('tope', 'Tope legal por minuto')}
              </div>
              <div class="dos">
                {caja('gracia', 'Minutos de gracia')}
                {caja('topeDia', 'Tope por día', 'Opcional')}
              </div>
              <div class="dos">
                {caja('plenaDesde', 'Día completo pasados (min)', 'Opcional')}
                {caja('plenaValor', 'Valor del día completo')}
              </div>
              <div class="dos">
                <Campo
                  id={id('nocheDesde')}
                  etiqueta="Noche desde"
                  errores={errores}
                  ayuda="Opcional, 20:00"
                >
                  {entrada(id('nocheDesde'), t.nocheDesde, ponerTarifa(v, 'nocheDesde'), {
                    maxLength: 5,
                  })}
                </Campo>
                <Campo id={id('nocheHasta')} etiqueta="Noche hasta" errores={errores} ayuda="05:30">
                  {entrada(id('nocheHasta'), t.nocheHasta, ponerTarifa(v, 'nocheHasta'), {
                    maxLength: 5,
                  })}
                </Campo>
              </div>
              <div class="dos">
                {caja('nocheValor', 'Valor de la noche')}
                {caja('perdido', 'Tiquete perdido', 'Opcional')}
              </div>
              <Campo id={id('redondeo')} etiqueta="Redondeo" errores={errores}>
                <select
                  id={id('redondeo')}
                  value={t.redondeo}
                  onChange={ponerTarifa(v, 'redondeo')}
                >
                  <option value="">Elija</option>
                  <option value="ninguno">Sin redondeo</option>
                  <option value="abajo_50">Hacia abajo, a $50</option>
                  <option value="abajo_100">Hacia abajo, a $100</option>
                </select>
              </Campo>
            </fieldset>
          );
        })}
      </fieldset>

      <fieldset class="grupo">
        <legend>Cobro con QR o transferencia</legend>
        <p class="ayuda">
          Opcional. La imagen del QR de su banco o de su billetera: la caja la muestra al cobrar. El
          dinero va directo a su cuenta.
        </p>
        <ImagenDelQr
          imagen={qrVisible}
          errores={errores}
          alElegir={(archivo) => {
            setErrores({ ...errores, 'qr-pago': '' });
            if (archivo && archivo.size > 500_000) {
              setErrores({ ...errores, 'qr-pago': 'La imagen pesa más de 500 KB: recórtela' });
            } else {
              setQrPago(archivo);
            }
          }}
        />
      </fieldset>

      <fieldset class="grupo" data-prueba="aviso-privacidad">
        <legend>Aviso de privacidad</legend>
        <p class="ayuda">
          Antes de pedir el WhatsApp de un conductor, el parqueadero acepta su aviso de privacidad y
          lo pone a la vista. La caja lo llena con los datos de arriba.
        </p>
        <details>
          <summary>Leer el aviso (versión {VERSION_DEL_AVISO})</summary>
          {avisoDeLaSede(b).parrafos.map((p) => (
            <p key={p}>{p}</p>
          ))}
        </details>
        <label class="casilla">
          <input
            id="aviso"
            class="casilla-marca"
            type="checkbox"
            checked={b.aviso}
            onChange={(e) => setB({ ...b, aviso: e.currentTarget.checked })}
          />
          <span>
            El parqueadero acepta este aviso de privacidad (versión {VERSION_DEL_AVISO}) y responde
            por los números de sus conductores.
          </span>
        </label>
      </fieldset>

      <fieldset class="grupo">
        <legend>Seguridad</legend>
        <p class="ayuda">
          {conPin
            ? 'Para cambiar el PIN, escriba uno nuevo dos veces. Si no, déjelo vacío.'
            : 'El PIN de administrador protege las tarifas y los datos del recibo.'}
        </p>
        <div class="dos">
          <Campo id="pin" etiqueta={conPin ? 'PIN nuevo' : 'PIN (4 a 6 números)'} errores={errores}>
            {entrada('pin', b.pin, poner('pin'), { type: 'password', ...numero })}
          </Campo>
          <Campo id="pin2" etiqueta="Repita el PIN" errores={errores}>
            {entrada('pin2', b.pin2, poner('pin2'), { type: 'password', ...numero })}
          </Campo>
        </div>
      </fieldset>

      {errores['general'] && (
        <p class="error" role="alert">
          {errores['general']}
        </p>
      )}
      {Object.keys(errores).length > 0 && (
        <p class="error" role="alert" data-prueba="hay-errores">
          Revise lo que está en rojo.
        </p>
      )}
      <button type="submit" class="boton boton-principal" disabled={guardando}>
        Guardar
      </button>
      <button type="button" class="boton boton-secundario" onClick={alTerminar}>
        Volver a la caja sin guardar
      </button>
    </form>
  );
}

/** La imagen del QR de pagos, con su vista previa y «Quitar». */
function ImagenDelQr({
  imagen,
  errores,
  alElegir,
}: {
  imagen: Blob | null;
  errores: Errores;
  alElegir: (archivo: Blob | null) => void;
}) {
  const url = useMemo(() => (imagen ? URL.createObjectURL(imagen) : null), [imagen]);
  useEffect(() => () => (url ? URL.revokeObjectURL(url) : undefined), [url]);
  return (
    <div class="campo" data-error={errores['qr-pago'] ? '' : undefined}>
      <label for="qr-pago">Imagen del QR de pagos</label>
      <input
        id="qr-pago"
        type="file"
        accept="image/png,image/jpeg,image/webp"
        onChange={(e) => alElegir(e.currentTarget.files?.[0] ?? null)}
      />
      {errores['qr-pago'] && (
        <p class="error" id="qr-pago-error">
          {errores['qr-pago']}
        </p>
      )}
      {url && (
        <>
          <img class="qr-pago" src={url} alt="El QR de pagos guardado" />
          <button type="button" class="boton boton-secundario" onClick={() => alElegir(null)}>
            Quitar la imagen
          </button>
        </>
      )}
    </div>
  );
}
