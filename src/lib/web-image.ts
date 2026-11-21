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
  const safeOriginal =
    file.size <= maxOutput &&
    /\.(?:jpe?g|png|webp|gif|avif|ico)$/i.test(file.name);
  const url = URL.createObjectURL(file);
  const image = new Image();
  const canvas = document.createElement('canvas');
  try {
    image.src = url;
    try {
      await image.decode();
    } catch {
      // Some mobile browsers cannot decode formats that the Worker can safely validate.
      if (safeOriginal) return file;
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
    const blob = await new Promise<Blob | null>((resolve) => {
      try {
        canvas.toBlob(resolve, 'image/webp', quality);
      } catch {
        resolve(null);
      }
    });
    if (
      !blob ||
      !['image/webp', 'image/png'].includes(blob.type) ||
      !blob.size ||
      blob.size > maxOutput
    ) {
      if (safeOriginal) return file;
      throw new Error(
        'Imaginea nu a putut fi pregătită. Încearcă un JPG sau PNG mai mic.',
      );
    }
    const ext = blob.type === 'image/webp' ? 'webp' : 'png';
    return new File(
      [blob],
      `${file.name.replace(/\.[^.]*$/, '') || 'imagine'}.${ext}`,
      { type: blob.type },
    );
  } finally {
    URL.revokeObjectURL(url);
    canvas.width = 0;
    canvas.height = 0;
  }
}
