import { initApp, type FreeAppStore } from '@freeappstore/sdk'

const APP_ID = 'message'

let _fas: FreeAppStore | null = null

export function getFas(): FreeAppStore {
  if (_fas) return _fas
  _fas = initApp({ appId: APP_ID })
  return _fas
}
