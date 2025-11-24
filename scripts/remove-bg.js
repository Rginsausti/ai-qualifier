const Jimp = require('jimp');
const path = require('path');

const files = ['separador_new_1.png', 'separador_new_2.png', 'separador_new_3.png'];
const inputDir = path.join(__dirname, '../public/images');
const outputDir = path.join(__dirname, '../public/images');

async function processImages() {
    console.log('Starting image processing...');
    for (const file of files) {
        try {
            const inputPath = path.join(inputDir, file);
            console.log(`Reading ${inputPath}`);
            const image = await Jimp.read(inputPath);

            console.log(`Processing ${file}...`);
            image.scan(0, 0, image.bitmap.width, image.bitmap.height, function (x, y, idx) {
                const red = this.bitmap.data[idx + 0];
                const green = this.bitmap.data[idx + 1];
                const blue = this.bitmap.data[idx + 2];

                // If pixel is close to white, make it transparent
                // Using a slightly lower threshold to catch compression artifacts
                if (red > 230 && green > 230 && blue > 230) {
                    this.bitmap.data[idx + 3] = 0; // Alpha
                }
            });

            const outFile = file.replace('_new_', '_transparent_');
            const outputPath = path.join(outputDir, outFile);
            await image.writeAsync(outputPath);
            console.log(`Saved to ${outputPath}`);
        } catch (err) {
            console.error(`Error processing ${file}:`, err);
        }
    }
    console.log('Done.');
}

processImages();
