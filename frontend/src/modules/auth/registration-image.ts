export const MAX_REGISTRATION_IMAGE_BYTES = 60 * 1024
const imageError = 'Selecciona una imagen PNG o JPEG válida de hasta 60 KiB.'

function matchesFormat(bytes: Uint8Array, type: string): boolean {
  if (type === 'image/png') {
    return bytes.length >= 20 && [137, 80, 78, 71, 13, 10, 26, 10].every((byte, i) => bytes[i] === byte)
      && [0, 0, 0, 0, 73, 69, 78, 68, 174, 66, 96, 130].every((byte, i) => bytes[bytes.length - 12 + i] === byte)
  }
  return type === 'image/jpeg' && bytes.length >= 4 && bytes[0] === 255 && bytes[1] === 216
    && bytes[2] === 255 && bytes[bytes.length - 2] === 255 && bytes[bytes.length - 1] === 217
}

/** Solo imágenes locales acotadas; nunca URLs externas ni otros tipos de data URI. */
export function registrationImageSource(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > 4 * Math.ceil(MAX_REGISTRATION_IMAGE_BYTES / 3) + 23) return null
  const match = value.match(/^data:(image\/(?:png|jpeg));base64,([A-Za-z0-9+/]+={0,2})$/)
  if (!match || match[2]!.length % 4 !== 0) return null
  try {
    const raw = atob(match[2]!)
    const bytes = Uint8Array.from(raw, (character) => character.charCodeAt(0))
    return bytes.length <= MAX_REGISTRATION_IMAGE_BYTES && matchesFormat(bytes, match[1]!) ? value : null
  } catch { return null }
}

export async function readRegistrationImage(file: File): Promise<string> {
  if (!['image/png', 'image/jpeg'].includes(file.type) || file.size <= 0 || file.size > MAX_REGISTRATION_IMAGE_BYTES)
    throw new Error(imageError)
  const bytes = new Uint8Array(await file.arrayBuffer())
  if (bytes.length !== file.size || !matchesFormat(bytes, file.type)) throw new Error(imageError)
  let raw = ''
  for (const byte of bytes) raw += String.fromCharCode(byte)
  const source = `data:${file.type};base64,${btoa(raw)}`
  // La firma por sí sola no prueba que el archivo sea una imagen decodificable.
  const image = new Image()
  image.src = source
  try {
    await image.decode()
    if (!image.naturalWidth || !image.naturalHeight) throw new Error(imageError)
  } catch { throw new Error(imageError) }
  return source
}
