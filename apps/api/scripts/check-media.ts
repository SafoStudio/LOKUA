import { ok as assert, rejects, strictEqual } from 'node:assert/strict';
import sharp from 'sharp';
import { processImage } from '../src/modules/storage/infrastructure/process-image.js';

async function main() {
  const args = process.argv.slice(2);
  if (args.includes('--help')) { console.log('Usage: pnpm --filter api check:media'); return; }
  strictEqual(args.length, 0, 'This check accepts no arguments');
  console.log('🚀 Starting image processing check...');

  function fixture(width = 24, height = 16) {
    return sharp({ create: { width, height, channels: 3, background: '#8473a0' } });
  }

  const jpeg = await fixture(2250, 1000).jpeg().withMetadata({ orientation: 6 }).toBuffer();
  assert((await sharp(jpeg).metadata()).exif, 'JPEG fixture has no EXIF');
  const png = await fixture().png().toBuffer();
  const webp = await fixture().webp().toBuffer();

  for (const [input, type] of [[jpeg, 'image/jpeg'], [png, 'image/png'], [webp, 'image/webp']] as const) {
    const output = await processImage(input, type);
    const metadata = await sharp(output).metadata();
    strictEqual(metadata.format, 'webp');
    assert(!metadata.exif && !metadata.icc && !metadata.xmp, 'Image metadata survived processing');
    if (type === 'image/jpeg') {
      assert(metadata.width && metadata.height && metadata.height > metadata.width, 'EXIF orientation was not applied');
      strictEqual(metadata.height, 1920, 'Large image was not resized');
    }
  }
  await rejects(processImage(png, 'image/jpeg'), { statusCode: 415 });
  await rejects(processImage(png.subarray(0, 12), 'image/png'), { statusCode: 415 });
  console.log(`✅ PASS: Sharp/libvips ${sharp.versions.vips}: JPEG, PNG, WebP, EXIF, resizing and format rejection`);
}

try {
  await main();
} catch (error) {
  console.error(`❌ FAIL: ${error instanceof Error ? error.message : 'Unexpected media check error'}`);
  process.exitCode = 1;
}
