const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });

console.log('Checking environment variables...');
console.log('HEADLESSX_API_URL exists:', !!process.env.HEADLESSX_API_URL);
console.log('DATABASE_URL exists:', !!process.env.DATABASE_URL);
console.log('POSTGRES_URL exists:', !!process.env.POSTGRES_URL);
console.log('GROQ_API_KEY exists:', !!process.env.GROQ_API_KEY);
