import sharp from 'sharp';
import fs from 'node:fs';

async function convertFavicon() {
  try {
    const svgBuffer = fs.readFileSync('./public/favicon.svg');

    await sharp(svgBuffer)
      .png()
      .resize(32, 32)
      .toFile('./public/favicon.png');

    await sharp(svgBuffer)
      .png()
      .resize(180, 180)
      .toFile('./public/apple-touch-icon.png');

    console.log('✓ Favicon images created successfully');
    console.log('  - favicon.png (32x32)');
    console.log('  - apple-touch-icon.png (180x180)');
  } catch (error) {
    console.error('Error converting favicon:', error);
    process.exit(1);
  }
}

convertFavicon();
