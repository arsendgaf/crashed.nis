import { TokenIssuanceError } from '@/shared/errors/auth.errors'

const MAX_DECOMPRESSED_TOKEN_SIZE = 16 * 1024

export const compressToken = async (token: string): Promise<string> => {
  try {
    const compressed = new Response(
      new Blob([token]).stream().pipeThrough(new CompressionStream('gzip')),
    )
    const bytes = new Uint8Array(await compressed.arrayBuffer())
    let binary = ''

    for (const byte of bytes) {
      binary += String.fromCharCode(byte)
    }

    return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/u, '')
  } catch (cause) {
    throw new TokenIssuanceError('Token compression failed.', { cause })
  }
}

export const decompressToken = async (token: string): Promise<string> => {
  try {
    const base64 = token.replaceAll('-', '+').replaceAll('_', '/')
    const binary = atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, '='))
    const compressed = Uint8Array.from(binary, (character) => character.charCodeAt(0))
    const reader = new Blob([compressed])
      .stream()
      .pipeThrough(new DecompressionStream('gzip'))
      .getReader()
    const chunks: Uint8Array[] = []
    let size = 0

    try {
      while (true) {
        const { done, value } = await reader.read()

        if (done) {
          break
        }

        size += value.byteLength

        if (size > MAX_DECOMPRESSED_TOKEN_SIZE) {
          await reader.cancel()
          throw new Error('The decompressed token is too large.')
        }

        chunks.push(value)
      }
    } finally {
      reader.releaseLock()
    }

    const bytes = new Uint8Array(size)
    let offset = 0

    for (const chunk of chunks) {
      bytes.set(chunk, offset)
      offset += chunk.byteLength
    }

    return new TextDecoder('utf-8', { fatal: true, ignoreBOM: false }).decode(bytes)
  } catch (cause) {
    throw new Error('The refresh token cookie is invalid.', { cause })
  }
}
