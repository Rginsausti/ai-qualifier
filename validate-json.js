const fs = require('fs');
const path = require('path');

const locales = ['en', 'es', 'de', 'fr', 'it', 'pt', 'ja'];
let hasError = false;

console.log('Starting JSON validation...');

locales.forEach(locale => {
    const filePath = path.join(__dirname, 'locales', locale, 'common.json');
    try {
        if (!fs.existsSync(filePath)) {
            console.error(`❌ ${locale} NOT FOUND`);
            hasError = true;
            return;
        }
        const content = fs.readFileSync(filePath, 'utf8');
        JSON.parse(content);
        console.log(`✅ ${locale} OK`);
    } catch (e) {
        console.error(`❌ ${locale} INVALID: ${e.message}`);
        hasError = true;
    }
});

if (hasError) {
    console.log('Validation FAILED.');
    process.exit(1);
} else {
    console.log('All files are valid JSON.');
    process.exit(0);
}
