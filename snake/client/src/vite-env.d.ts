/// <reference types="vite/client" />

interface ImportMetaEnv {
    readonly VITE_CENTRIFUGO_BASE_ADDRESS: string
}

interface ImportMeta {
    readonly env: ImportMetaEnv
}
