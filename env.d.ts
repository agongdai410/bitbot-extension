/// <reference types="vite/client" />

interface DocumentPictureInPicture extends EventTarget {
  window: Window | null
  requestWindow(option?: { width?: number; height?: number }): Promise<Window>
}

export declare global {
  interface documentPictureInPicture extends DocumentPictureInPicture {}

  const __DEV__: boolean

  interface Window {
    documentPictureInPicture: DocumentPictureInPicture
    trustedTypes: any
  }

  interface Navigator {
    userAgentData: {
      platform: string
    }
  }

  interface PromiseConstructor {
    withResolvers: () => {
      promise: Promise<any>
      resolve: (value: any) => void
      reject: (reason: any) => void
    }
  }
}

export {}
