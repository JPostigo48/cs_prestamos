import sharp from 'sharp';

/** Decodificación estricta: 60 KiB, 4 MP, lados de 4096 y 2 s de proceso.
 * Solo comprueba integridad de imagen; la vigencia documental requiere revisión humana.
 */
export async function isRegistrationImage(value: unknown): Promise<boolean> {
  if (typeof value !== 'string' || value.length > 82000) return false;
  const match = /^data:image\/(png|jpeg);base64,([A-Za-z0-9+/]+={0,2})$/.exec(
    value,
  );
  if (!match) return false;
  const bytes = Buffer.from(match[2], 'base64');
  if (bytes.length > 60 * 1024 || bytes.toString('base64') !== match[2])
    return false;
  // Exigir cierre también: algunos decodificadores toleran la falta de IEND/EOI.
  if (match[1] === 'png') {
    if (
      !bytes
        .subarray(-12)
        .equals(Buffer.from('0000000049454e44ae426082', 'hex'))
    )
      return false;
  } else if (!bytes.subarray(-2).equals(Buffer.from([0xff, 0xd9]))) {
    return false;
  }
  try {
    const decoder = sharp(bytes, {
      failOn: 'warning',
      limitInputPixels: 4_000_000,
      sequentialRead: true,
    }).timeout({ seconds: 2 });
    const metadata = await decoder.metadata();
    if (
      metadata.format !== match[1] ||
      !metadata.width ||
      !metadata.height ||
      metadata.width > 4096 ||
      metadata.height > 4096 ||
      (metadata.pages ?? 1) !== 1
    )
      return false;
    // metadata() no decodifica los píxeles; consumirlos es imprescindible.
    await decoder.raw().toBuffer();
    return true;
  } catch {
    return false;
  }
}
