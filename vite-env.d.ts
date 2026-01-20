
interface ImportMetaEnv {
  readonly VITE_APP_TITLE: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare namespace NodeJS {
  interface ProcessEnv {
    readonly API_KEY: string;
    readonly RESEND_API_KEY: string;
    readonly [key: string]: string | undefined;
  }
}

// Fixed: Removed the triple-slash reference to "vite/client" as it cannot be found.
// Fixed: Removed the "process" declaration as it conflicts with the global "process" variable.
