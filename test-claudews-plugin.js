// Test script to debug ClaudeWS plugin API call
const axios = require('axios');

async function testPluginAPI() {
    try {
        // Test direct call to ClaudeWS
        console.log('\n=== Testing direct ClaudeWS API ===');
        const directResponse = await axios.get('https://thanh-vibe.roxane.one/api/agent-factory/plugins', {
            headers: {
                'x-api-key': '12345'
            }
        });
        console.log('Direct API Response:', directResponse.data);

        // Test through PrivOS Studio API
        console.log('\n=== Testing via PrivOS Studio API ===');
        const privosResponse = await axios.get('https://thanh-10001.roxane.one/api/v1/claudews-servers/3c141197-5b85-44e7-bf3e-2cdd874d3855/plugins', {
            headers: {
                'Content-Type': 'application/json',
                'x-request-from': 'internal'
            },
            withCredentials: true
        });
        console.log('PrivOS API Response:', privosResponse.data);

    } catch (error) {
        console.error('\n=== Error Details ===');
        console.error('Message:', error.message);
        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Status Text:', error.response.statusText);
            console.error('Response Data:', error.response.data);
        }
    }
}

testPluginAPI();
