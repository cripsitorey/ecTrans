import sharp from "sharp";

export async function preprocessImage(buffer: Buffer): Promise<Buffer> {
  return sharp(buffer)
    .rotate()
    .resize({ width: 2000, withoutEnlargement: true })
    .grayscale()
    .normalize()
    .sharpen({ sigma: 1 })
    .threshold(128)
    .png()
    .toBuffer();
}

export async function preprocessImageFromPath(buffer: Buffer): Promise<Buffer> {
  return preprocessImage(buffer);
}
