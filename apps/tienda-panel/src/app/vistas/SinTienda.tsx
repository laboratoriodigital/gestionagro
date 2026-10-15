/** Sin tienda (HU-T8.1): la cuenta entró bien, pero todavía no tiene una tienda. No es un error. */
export function SinTienda({ correo, alSalir }: { correo: string; alSalir: () => void }) {
  return (
    <main class="portada">
      <h1>Tu cuenta todavía no tiene una tienda</h1>
      <p class="portada__entrada">
        Entraste como <span class="cifra">{correo}</span>. Si alguien te invitó a su tienda, abre el
        enlace de la invitación con esta cuenta. Pronto podrás crear tu propia tienda desde aquí.
      </p>
      <button class="ed1-boton ed1-boton--secundario" type="button" onClick={alSalir}>
        Entrar con otra cuenta
      </button>
    </main>
  );
}
