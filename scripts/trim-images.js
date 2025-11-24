const sharp = require('sharp');
const path = require('path');

const files = ['separador_transparent_4.png'];
const inputDir = path.join(__dirname, '../public/images');
const outputDir = path.join(__dirname, '../public/images');

async function trimImages() {
    console.log('Starting image trimming...');

    for (const file of files) {
        const inputPath = path.join(inputDir, file);
        const outFile = file.replace('_transparent_', '_trimmed_');
        const outputPath = path.join(outputDir, outFile);

        console.log(`Trimming ${file} -> ${outFile}`);

        try {
            await sharp(inputPath)
                .trim() // Automatically removes transparent/background pixels from edges
                .toFile(outputPath);

            console.log(`Saved to ${outputPath}`);

        } catch (err) {
            console.error(`Error processing ${file}:`, err);
        }
    }
    console.log('Done.');
}

trimImages();
