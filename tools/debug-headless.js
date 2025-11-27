const axios = require('axios');
const dotenv = require('dotenv');
const path = require('path');

// Load env vars
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const TOKEN = process.env.HEADLESSX_AUTH_TOKEN;
const BASE_URL = 'https://headlessx-2jzi.onrender.com';

console.log('--- Debugging HeadlessX Connection ---');
console.log(`Token loaded: ${TOKEN ? 'YES' : 'NO'}`);
if (TOKEN) {
    console.log(`Token length: ${TOKEN.length}`);
    console.log(`Token start: ${TOKEN.substring(0, 5)}...`);
    console.log(`Token end: ...${TOKEN.substring(TOKEN.length - 5)}`);
    // Check for whitespace
    if (TOKEN.trim() !== TOKEN) {
        console.error('⚠️ WARNING: Token has leading/trailing whitespace!');
    }
}

async function testEndpoint(name, method, url, headers = {}, data = null) {
    console.log(`\nTesting ${name}: ${method} ${url}`);
    try {
        const config = {
            method,
            url,
            headers,
            data,
            validateStatus: () => true // Don't throw on error status
        };
        const response = await axios(config);
        console.log(`Status: ${response.status} ${response.statusText}`);
        if (response.status !== 200) {
            console.log('Response data:', JSON.stringify(response.data, null, 2));
        } else {
            console.log('Success!');
        }
        return response;
    } catch (error) {
        console.error(`Request failed: ${error.message}`);
        if (error.response) {
            console.error('Response status:', error.response.status);
            console.error('Response data:', error.response.data);
        }
    }
}

async function runTests() {
    // 1. Health Check (No Auth)
    await testEndpoint('Health Check', 'GET', `${BASE_URL}/api/health`);

    // 2. Health Check (With Auth Header)
    await testEndpoint('Health Check (Auth Header)', 'GET', `${BASE_URL}/api/health`, {
        'Authorization': `Bearer ${TOKEN}`
    });

    // 3. Render (Auth Header - Bearer)
    await testEndpoint('Render (Bearer)', 'POST', `${BASE_URL}/api/render`, {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${TOKEN}`
    }, {
        url: 'https://example.com'
    });

    // 4. Render (Auth Header - No Bearer)
    await testEndpoint('Render (No Bearer)', 'POST', `${BASE_URL}/api/render`, {
        'Content-Type': 'application/json',
        'Authorization': TOKEN
    }, {
        url: 'https://example.com'
    });

    // 5. Render (X-Token Header)
    await testEndpoint('Render (X-Token)', 'POST', `${BASE_URL}/api/render`, {
        'Content-Type': 'application/json',
        'X-Token': TOKEN
    }, {
        url: 'https://example.com'
    });

    // 6. Render (Query Param)
    await testEndpoint('Render (Query Param)', 'POST', `${BASE_URL}/api/render?token=${TOKEN}`, {
        'Content-Type': 'application/json'
    }, {
        url: 'https://example.com'
    });
}

runTests();
