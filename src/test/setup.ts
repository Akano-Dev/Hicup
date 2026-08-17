import '@testing-library/jest-dom/vitest'
import 'fake-indexeddb/auto'

// jsdom implements neither of these, and both are used during normal rendering.
if (!window.matchMedia) {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as typeof window.matchMedia
}

// fake-indexeddb's structured clone returns plain objects rather than Blob
// instances, which jsdom's createObjectURL rejects. Stub both unconditionally.
let objectUrlCounter = 0
globalThis.URL.createObjectURL = () => `blob:test/${++objectUrlCounter}`
globalThis.URL.revokeObjectURL = () => {}
