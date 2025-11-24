const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const files = ['separador_new_4.png'];
const inputDir = path.join(__dirname, '../public/images');
const outputDir = path.join(__dirname, '../public/images');

async function processImages() {
    console.log('Starting image processing with Sharp...');

    for (const file of files) {
        const inputPath = path.join(inputDir, file);
        const outFile = file.replace('_new_', '_transparent_');
        const outputPath = path.join(outputDir, outFile);

        console.log(`Processing ${file} -> ${outFile}`);

        try {
            // Create a buffer from the file
            const metadata = await sharp(inputPath).metadata();

            // We want to make white transparent. 
            // Sharp doesn't have a direct "replace color" but we can use band manipulation or a threshold.
            // A common trick is to use the image as its own alpha channel after inverting and thresholding?
            // Or just use linear operation.

            // Simpler approach: Ensure it has alpha, then use raw pixel access if needed, 
            // OR use 'toColourspace' and modulation.

            // Actually, for a simple "white to transparent", we can use:
            // .ensureAlpha()
            // .threshold() is for b/w.

            // Let's use raw pixel manipulation for precision, similar to Jimp but with Sharp's speed.
            const { data, info } = await sharp(inputPath)
                .ensureAlpha()
                .raw()
                .toBuffer({ resolveWithObject: true });

            const pixels = data;
            let modifications = 0;

            for (let i = 0; i < pixels.length; i += 4) {
                const r = pixels[i];
                const g = pixels[i + 1];
                const b = pixels[i + 2];

                // If pixel is white-ish
                if (r > 240 && g > 240 && b > 240) {
                    pixels[i + 3] = 0; // Set alpha to 0
                    modifications++;
                }
            }

            console.log(`Modified ${modifications} pixels.`);

            await sharp(pixels, {
                raw: {
                    width: info.width,
                    height: info.height,
                    channels: 4
                }
            })
                .png()
                .toFile(outputPath);

            console.log(`Saved to ${outputPath}`);

        } catch (err) {
            console.error(`Error processing ${file}:`, err);
        }
    }
    console.log('Done.');
}

processImages();
