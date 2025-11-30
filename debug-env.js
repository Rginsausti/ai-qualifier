const fs = require('fs');
const path = require('path');

const envPath = path.join(process.cwd(), '.env.local');

try {
  if (!fs.existsSync(envPath)) {
    console.log(JSON.stringify({ error: 'FILE_NOT_FOUND' }));
    process.exit(1);
  }

  const content = fs.readFileSync(envPath, 'utf8');
  const lines = content.split('\n');
  const result = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    if (!trimmed) continue;
    
    if (trimmed.startsWith('#')) {
        result.push({ line: i+1, type: 'COMMENT', content: trimmed.substring(0, 10) + '...' });
        continue;
    }
    
    if (trimmed.startsWith('//')) {
        result.push({ line: i+1, type: 'INVALID_COMMENT', content: trimmed.substring(0, 10) + '...' });
        continue;
    }

    const parts = trimmed.split('=');
    const key = parts[0].trim();
    const val = parts.slice(1).join('=');
    
    result.push({ line: i+1, type: 'KEY', key: key, val_len: val.length });
  }
  fs.writeFileSync('env-analysis.json', JSON.stringify(result, null, 2));
  console.log('DONE');
} catch (e) {
  fs.writeFileSync('env-analysis.json', JSON.stringify({ error: e.message }));
}
