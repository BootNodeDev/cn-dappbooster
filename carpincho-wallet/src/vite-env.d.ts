/// <reference types="vite/client" />

declare const __APP_VERSION__: string

declare module '*.svg' {
  const src: string
  export default src
}
