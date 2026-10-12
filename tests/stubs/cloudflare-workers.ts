/**
 * `cloudflare:workers` para las pruebas en Node (HU-C5.6): solo guarda `ctx` y `env`, como workerd.
 * `vitest.config.ts` lo pone en lugar del módulo real.
 */
export abstract class WorkerEntrypoint<Env = unknown> {
  protected readonly ctx: unknown;
  protected readonly env: Env;
  constructor(ctx: unknown, env: Env) {
    this.ctx = ctx;
    this.env = env;
  }
}
