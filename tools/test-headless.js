const axios = require('axios');
require('dotenv').config({ path: '.env.local' });

const HEADLESSX_URL = process.env.HEADLESSX_API_URL || 'https://headlessx-2jzi.onrender.com/api/render';
const AUTH_TOKEN = process.env.HEADLESSX_AUTH_TOKEN;

async function testHeadless() {
    console.log('Testing HeadlessX connectivity...');
    console.log('Using Token:', AUTH_TOKEN ? `${AUTH_TOKEN.substring(0, 5)}...` : 'UNDEFINED');

    // Test 1: Bearer Token
    console.log('\nTest 1: Authorization: Bearer <token>');
    try {
        await axios.post(HEADLESSX_URL, {
            url: 'https://example.com',
            wait: { selector: 'h1', timeout: 1000 }
        }, { 
            headers: { 'Authorization': `Bearer ${AUTH_TOKEN}` },
            timeout: 10000 
        });
        console.log('✅ Success with Bearer token!');
        return;
    } catch (error) {
        console.log('❌ Failed:', error.response?.status, error.response?.data);
    }

    // Test 2: Raw Token
    console.log('\nTest 2: Authorization: <token>');
    try {
        await axios.post(HEADLESSX_URL, {
            url: 'https://example.com',
            wait: { selector: 'h1', timeout: 1000 }
        }, { 
            headers: { 'Authorization': AUTH_TOKEN },
            timeout: 10000 
        });
        console.log('✅ Success with Raw token!');
        return;
    } catch (error) {
        console.log('❌ Failed:', error.response?.status, error.response?.data);
    }
}

testHeadless();
