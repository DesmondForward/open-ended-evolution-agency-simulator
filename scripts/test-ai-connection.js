
const fs = require('fs');
const path = require('path');

// 1. Load .env manually
const envPath = path.resolve(__dirname, '../.env');
console.log(`Loading .env from: ${envPath}`);

let apiKey = '';
let apiUrl = 'https://api.openai.com/v1/responses';

try {
    if (fs.existsSync(envPath)) {
        const envContent = fs.readFileSync(envPath, 'utf8');
        envContent.split('\n').forEach(line => {
            const [key, value] = line.split('=');
            if (key && value) {
                const cleanKey = key.trim();
                const cleanValue = value.trim();
                if (cleanKey === 'VITE_AI_API_KEY') apiKey = cleanValue;
                if (cleanKey === 'VITE_AI_API_URL') apiUrl = cleanValue;
            }
        });
    } else {
        console.error("❌ .env file not found!");
        process.exit(1);
    }
} catch (err) {
    console.error("Error reading .env:", err);
    process.exit(1);
}

if (!apiKey || apiKey === 'YOUR_API_KEY_HERE') {
    console.error("❌ Invalid API Key. Please set VITE_AI_API_KEY in .env");
    process.exit(1);
}

console.log(`✅ API Key found: ${apiKey.substring(0, 4)}...`);
console.log(`Testing URL: ${apiUrl}`);

// 2. Make Request
async function testConnection() {
    console.log("Sending test request to 'gpt-5.2-2025-12-11'...");

    const prompt = "This is a connection test. Reply with 'Connection Successful'.";

    try {
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: 'gpt-5.2-2025-12-11',
                input: [
                    { role: "user", content: prompt }
                ]
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HTTP Error: ${response.status} ${response.statusText}\nBody: ${errorText}`);
        }

        const data = await response.json();
        console.log("✅ Response received!");
        console.log("--- Payload ---");
        console.log(JSON.stringify(data, null, 2));
        console.log("---------------");

    } catch (error) {
        console.error("❌ Connection Failed:", error.message);
        if (error.cause) console.error("Cause:", error.cause);
    }
}

testConnection();
