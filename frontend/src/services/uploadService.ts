/**
 * Upload Service
 * Handles media file uploads to S3 via presigned URLs
 */

export interface PresignedUrlRequest {
  fileName: string
  fileSize: number
  fileType: string
  checksum?: string
}

export interface PresignedUrlResponse {
  uploadUrl: string
  s3Key: string
  fields?: Record<string, string>
  expiresAt: string
}

export interface UploadProgress {
  loaded: number
  total: number
  percentage: number
  bytesPerSecond?: number
}

export type UploadProgressCallback = (progress: UploadProgress) => void

export class UploadError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public retryable: boolean = false
  ) {
    super(message)
    this.name = 'UploadError'
  }
}

/**
 * Retries a function with exponential backoff
 */
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  let lastError: Error | undefined

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error as Error

      // Check if error is retryable
      if (error instanceof UploadError && !error.retryable) {
        throw error
      }

      // Don't retry on the last attempt
      if (attempt === maxRetries) {
        break
      }

      // Calculate delay with exponential backoff
      const delay = baseDelay * Math.pow(2, attempt)
      await new Promise((resolve) => setTimeout(resolve, delay))
    }
  }

  throw lastError || new Error('Retry failed')
}

/**
 * Requests a presigned URL from the backend
 */
export async function requestPresignedUrl(
  request: PresignedUrlRequest
): Promise<PresignedUrlResponse> {
  const response = await retryWithBackoff(async () => {
    const res = await fetch('/api/v1/media/upload', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    })

    if (!res.ok) {
      const retryable = res.status === 429 || res.status >= 500
      throw new UploadError(
        `Failed to get presigned URL: ${res.statusText}`,
        res.status,
        retryable
      )
    }

    return res
  }, 3, 2000)

  return response.json()
}

/**
 * Uploads a file directly to S3 using a presigned URL
 */
export async function uploadToS3(
  file: File,
  presignedUrl: string,
  onProgress?: UploadProgressCallback,
  signal?: AbortSignal
): Promise<{ etag: string }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()

    // Track progress
    let startTime = Date.now()
    let lastLoaded = 0

    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable) {
        const now = Date.now()
        const elapsed = (now - startTime) / 1000 // seconds
        const loaded = e.loaded - lastLoaded

        const bytesPerSecond = elapsed > 0 ? loaded / elapsed : 0

        onProgress?.({
          loaded: e.loaded,
          total: e.total,
          percentage: Math.round((e.loaded / e.total) * 100),
          bytesPerSecond,
        })

        lastLoaded = e.loaded
        startTime = now
      }
    })

    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        // Extract ETag from response headers
        const etag = xhr.getResponseHeader('ETag') || ''
        resolve({ etag: etag.replace(/"/g, '') })
      } else {
        reject(
          new UploadError(
            `S3 upload failed with status ${xhr.status}`,
            xhr.status,
            xhr.status >= 500
          )
        )
      }
    })

    xhr.addEventListener('error', () => {
      reject(new UploadError('Network error during upload', undefined, true))
    })

    xhr.addEventListener('timeout', () => {
      reject(new UploadError('Upload timeout', undefined, true))
    })

    xhr.addEventListener('abort', () => {
      reject(new UploadError('Upload aborted', undefined, false))
    })

    // Handle abort signal
    if (signal) {
      signal.addEventListener('abort', () => {
        xhr.abort()
      })
    }

    // Start upload
    xhr.open('PUT', presignedUrl)
    xhr.setRequestHeader('Content-Type', file.type)
    xhr.timeout = 10 * 60 * 1000 // 10 minutes timeout
    xhr.send(file)
  })
}

/**
 * Confirms upload completion with the backend
 */
export async function confirmUpload(
  s3Key: string,
  etag: string,
  metadata: {
    fileName: string
    fileSize: number
    fileType: string
  }
): Promise<{ assetId: string; url: string; thumbnailUrl?: string }> {
  const response = await fetch('/api/v1/media/confirm', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      s3Key,
      etag,
      ...metadata,
    }),
  })

  if (!response.ok) {
    throw new UploadError(
      `Failed to confirm upload: ${response.statusText}`,
      response.status,
      false
    )
  }

  return response.json()
}

/**
 * Complete upload flow: request presigned URL, upload to S3, confirm with backend
 */
export async function uploadFile(
  file: File,
  onProgress?: UploadProgressCallback,
  signal?: AbortSignal
): Promise<{ assetId: string; url: string; thumbnailUrl?: string }> {
  // Step 1: Request presigned URL
  const presignedData = await requestPresignedUrl({
    fileName: file.name,
    fileSize: file.size,
    fileType: file.type,
  })

  // Step 2: Upload to S3
  const { etag } = await uploadToS3(
    file,
    presignedData.uploadUrl,
    onProgress,
    signal
  )

  // Step 3: Confirm upload with backend
  const result = await confirmUpload(presignedData.s3Key, etag, {
    fileName: file.name,
    fileSize: file.size,
    fileType: file.type,
  })

  return result
}
