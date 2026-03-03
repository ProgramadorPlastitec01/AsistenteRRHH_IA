
async function testAccuracy(query) {
    console.log(`\n--- Test: ${query} ---`);
    try {
        const response = await fetch('http://localhost:3000/api/query', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query })
        });
        const data = await response.json();
        console.log(`Response received (Out of Scope: ${!!data.outOfScope})`);
        console.log(`Text: "${data.response?.substring(0, 100)}..."`);
        return data;
    } catch (error) {
        console.error('Error:', error.message);
    }
}

async function run() {
    console.log('🚀 Starting Final Accuracy & Hybrid Engine Verification...');

    // En DEMO_MODE, las respuestas están hardcoded y marcadas como simulated.
    // El retry logic en server.js tiene un check para omitir reintentos en DEMO_MODE 
    // para evitar bucles infinitos con respuestas simuladas estáticas.

    // Test 1: Pregunta General (Caché hit si existe)
    await testAccuracy('¿Cuál es el horario de oficina?');

    // Test 2: Pregunta que podría fallar (Simulando flujo)
    await testAccuracy('Dime sobre el reglamento interno');

    console.log('\n✅ Verification Script Completed');
}

run();
