const fs = require('fs');

const files = ['locales/es/common.json', 'locales/pt/common.json'];

files.forEach(file => {
    try {
        const content = fs.readFileSync(file, 'utf8');
        JSON.parse(content);
        console.log(`✅ ${file} is valid`);
    } catch (e) {
        console.error(`❌ ${file} is INVALID: ${e.message}`);
        if (e.message.includes('position')) {
            const pos = parseInt(e.message.match(/position (\d+)/)[1]);
            const content = fs.readFileSync(file, 'utf8');
            const start = Math.max(0, pos - 50);
            const end = Math.min(content.length, pos + 50);
            console.log('Context:');
            console.log(content.substring(start, end));
            console.log('^'.padStart(pos - start + 1));
        }
    }
});
