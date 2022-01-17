declare module 'jquery-simple-upload'
interface JQuerySimpleUploadFile {
  name: string
}

interface UploadError {
  name: string
  code: number
  message: string
}

interface UploadSuccess {
  success: true
  format: string
}
interface UploadFailure {
  success: false
  error: Error
}
type UploadResponse = UploadFailure | UploadSuccess

interface UploadCallbacks {
  start: (file: JQuerySimpleUploadFile) => void
  progress: (progress: number) => void
  success: (data: UploadResponse) => void
  error: (error: UploadError) => void
  cancel?: () => void
}

declare interface JQuery {
  simpleUpload(url: string, callbacks: UploadCallbacks): void
}
