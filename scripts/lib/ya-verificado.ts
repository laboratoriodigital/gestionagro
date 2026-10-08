/**
 * ¿El PR ya verificó lo que acaba de llegar a `main`? (HU-C11.3, pedido del dueño del 8 oct 2026:
 * casi 2.000 minutos de Actions en 8 días, y un tercio era repetir en `main` lo que el PR ya había
 * corrido.)
 *
 * Un PR al día con `main` se prueba con el árbol exacto que la fusión deja: el CI del PR corre
 * sobre la fusión con su base, y si la rama ya contiene `main`, esa fusión es la rama misma. En ese
 * caso `main` no vuelve a armar ni a abrir navegadores; sí corre las pruebas con el D1 de workerd,
 * que el PR no usa (HU-C11.7).
 *
 * Cerrada a propósito (P1): sin fusión de dos padres, con la rama atrasada, sin una corrida del
 * PR en verde para ese commit o sin poder preguntar, corre todo y lo dice.
 */

export interface HechosDeLaFusion {
  /** El segundo padre del commit de `main` (la punta del PR), o null si no es una fusión. */
  readonly puntaDelPr: string | null;
  /** Si `main` de antes de la fusión ya estaba dentro de la rama del PR. */
  readonly prAlDia: boolean;
  /** Corridas del CI en verde de ese PR para esa punta, o null si no se pudo preguntar. */
  readonly corridasEnVerde: number | null;
}

export interface Decision {
  readonly verificado: boolean;
  readonly motivo: string;
}

export function decidirYaVerificado(h: HechosDeLaFusion): Decision {
  if (h.puntaDelPr === null) {
    return { verificado: false, motivo: 'no es la fusión de un PR: corre todo' };
  }
  const punta = h.puntaDelPr.slice(0, 7);
  if (!h.prAlDia) {
    return {
      verificado: false,
      motivo: `la rama del PR (${punta}) no tenía el main de antes: la fusión es un árbol nuevo, corre todo`,
    };
  }
  if (h.corridasEnVerde === null) {
    return {
      verificado: false,
      motivo: `no se pudo preguntar por el CI del PR (${punta}): corre todo`,
    };
  }
  if (h.corridasEnVerde === 0) {
    return { verificado: false, motivo: `el PR (${punta}) no tiene el CI en verde: corre todo` };
  }
  return {
    verificado: true,
    motivo: `el PR (${punta}) ya verificó este mismo árbol: se saltan navegadores, build y e2e`,
  };
}
