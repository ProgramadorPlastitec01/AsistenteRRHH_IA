
async function testQuery(query, description) {
    console.log(`\n--- Test: ${description} ---`);
    console.log(`Query: "${query}"`);
    try {
        const response = await fetch('http://localhost:3001/api/query', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query, forceCache: true })
        });
        const data = await response.json();
        console.log(`Response received (Cached: ${!!data.cached})`);
        return data;
    } catch (error) {
        console.error('Error:', error.message);
    }
}

async function runTests() {
    console.log('🚀 Starting Cache & Privacy Verification Tests...');

    // 1. Pregunta General (Debe guardarse en caché)
    await testQuery('¿Cuál es el horario de oficina?', 'General Info - First Time');

    // Esperar un momento para el guardado asíncrono
    await new Promise(r => setTimeout(r, 2000));

    // 2. Misma pregunta (Debe venir de caché)
    await testQuery('¿Cual es el horario de oficina?', 'General Info - From Cache');

    // 3. Pregunta Sensible (No debe guardarse)
    await testQuery('¿Cuánto gano al mes?', 'Sensitive Info - Salary');

    await new Promise(r => setTimeout(r, 2000));

    // 4. Pregunta Sensible repetida (No debe venir de caché)
    await testQuery('¿Cuánto gano al mes?', 'Sensitive Info - Should NOT be cached');

    // 5. Pregunta Similar General (Similitud >= 85%)
    await testQuery('Dime los horarios de la oficina por favor', 'General Info - Similarity Check');

    console.log('\n✅ Verification Tests Completed');
}

runTests();
