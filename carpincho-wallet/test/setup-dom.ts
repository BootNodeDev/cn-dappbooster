import { GlobalRegistrator } from '@happy-dom/global-registrator'

if (typeof globalThis.window === 'undefined') {
  GlobalRegistrator.register({ url: 'http://localhost:3011' })
}
