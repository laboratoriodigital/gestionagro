/**
 * Lo que el CORE usa del módulo `cloudflare:workers` de workerd (HU-C5.6). El repositorio no trae
 * los tipos de Cloudflare: basta con esto. En las pruebas, `vitest.config.ts` lo cambia por
 * `tests/stubs/cloudflare-workers.ts`, porque Node no tiene ese módulo.
 */
declare module 'cloudflare:workers' {
  export abstract class WorkerEntrypoint<Env = unknown> {
    protected readonly ctx: unknown;
    protected readonly env: Env;
    constructor(ctx: unknown, env: Env);
  }
}
