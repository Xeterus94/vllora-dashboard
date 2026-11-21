export type MediaPurpose = 'gallery' | 'logo' | 'favicon';
const maxInput = 32 * 1024 * 1024,
  maxOutput = 8 * 1024 * 1024;
const settings = {
  gallery: [2000, 0.82],
  logo: [1024, 0.95],
  favicon: [256, 0.95],
} as const;
export async function webImage(
  file: File,
  purpose: MediaPurpose = 'gallery',
): Promise<File> {
  if (!file.size || file.size > maxInput)
    throw new Error('Alege o imagine mai mică de 32 MB.');
  const url = URL.createObjectURL(file);
  const image = new Image();
  const canvas = document.createElement('canvas');
  try {
    image.src = url;
    try {
      await image.decode();
    } catch {
      throw new Error(
        'Telefonul sau browserul nu poate deschide această imagine. Încearcă un JPG, PNG sau WebP.',
      );
    }
    const width = image.naturalWidth,
      height = image.naturalHeight;
    if (!width || !height || width * height > 40_000_000)
      throw new Error('Imaginea poate avea cel mult 40 megapixeli.');
    const [longest, quality] = settings[purpose],
      ratio = Math.min(1, longest / Math.max(width, height));
    canvas.width = Math.max(1, Math.round(width * ratio));
    canvas.height = Math.max(1, Math.round(height * ratio));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Browserul nu poate pregăti imaginea.');
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    let blob = await new Promise<Blob | null>((resolve) => {
      try {
        canvas.toBlob(resolve, 'image/webp', quality);
      } catch {
        resolve(null);
      }
    });
    if (blob?.type !== 'image/webp' || !blob.size || blob.size > maxOutput) {
      try {
        const { default: encode } = await import('@jsquash/webp/encode.js');
        const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
        blob = new Blob(
          [await encode(pixels, { quality: Math.round(quality * 100) })],
          {
            type: 'image/webp',
          },
        );
      } catch {
        throw new Error(
          'Conversia în WebP nu a reușit. Încearcă alt browser sau o imagine mai mică.',
        );
      }
    }
    if (!blob.size || blob.size > maxOutput)
      throw new Error(
        'Imaginea WebP depășește 8 MB. Alege o imagine mai mică.',
      );
    return new File(
      [blob],
      `${file.name.replace(/\.[^.]*$/, '') || 'imagine'}.webp`,
      {
        type: 'image/webp',
      },
    );
  } finally {
    URL.revokeObjectURL(url);
    canvas.width = 0;
    canvas.height = 0;
  }
}
