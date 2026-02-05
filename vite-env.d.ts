
// Fixed: Removed the triple-slash reference to 'vite/client' because it was causing a discovery error.
// The necessary interface definitions for ImportMeta and ImportMetaEnv are provided manually below.

interface ImportMetaEnv {
  readonly VITE_APP_TITLE: string;
  readonly API_KEY: string;
  readonly RESEND_API_KEY: string;
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
