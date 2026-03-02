
const query = 'Si sali de incapacidad hoy, debo reponer mi tiempo en horas extras';

async function test() {
    console.log(`Testing query: "${query}"`);
    try {
        const response = await fetch('http://localhost:3000/api/query', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query })
        });

        const data = await response.json();
        console.log('\n--- Response ---');
        console.log(JSON.stringify(data, null, 2));
    } catch (error) {
        console.error('Error:', error.message);
    }
}

test();
