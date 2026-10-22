/**
 * Entrar (HU-T8.1, el boceto): «Entrar con Google», con la política aceptada antes (HU-E0.5 CA3).
 * La casilla nunca viene marcada; el botón dice por qué no avanza mientras falte.
 */
import { Aviso } from '@ed1/ui/v2/componentes';
import { useState } from 'preact/hooks';

export function Entrar({ aviso, alEntrar }: { aviso: string | null; alEntrar: () => void }) {
  const [acepta, setAcepta] = useState(false);
  return (
    <main class="portada">
      <p class="etiqueta">TiendaPro</p>
      <h1>El panel de tu tienda</h1>
      <p class="portada__entrada">
        Aquí recibes tus pedidos, cargas tus productos y ves cómo vende tu tienda, desde el
        teléfono.
      </p>
      {aviso ? <Aviso tono="aviso" titulo={aviso} /> : null}
      <label class="acepto">
        <input
          type="checkbox"
          checked={acepta}
          onChange={(e) => setAcepta((e.target as HTMLInputElement).checked)}
        />
        <span>
          Leí y acepto la <a href="/privacidad/">política de tratamiento de datos</a> de mi cuenta.
        </span>
      </label>
      <span class="ed1-boton-con-motivo">
        <button
          class="ed1-boton ed1-boton--primario"
          type="button"
          aria-describedby={acepta ? undefined : 'entrar-motivo'}
          onClick={() => {
            if (acepta) alEntrar();
            else document.getElementById('entrar-motivo')?.focus();
          }}
          aria-disabled={acepta ? undefined : 'true'}
        >
          Entrar con Google
        </button>
        {acepta ? null : (
          <span class="ed1-boton__motivo" id="entrar-motivo" tabindex={-1}>
            Primero acepta la política de datos.
          </span>
        )}
      </span>
    </main>
  );
}
