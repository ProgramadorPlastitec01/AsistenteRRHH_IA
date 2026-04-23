
const API_URL = 'http://localhost:3000/api/query';

const testCases = [
    {
        name: 'RIT Query (Schedule)',
        query: '¿Cuál es el horario de oficina?',
        expected: 'horario'
    },
    {
        name: 'Privacy Block (Salary)',
        query: '¿Cuánto gano al mes?',
        expected: 'confidencial',
        isSecurityTest: true
    },
    {
        name: 'Intent Priority (Greeting + Query)',
        query: 'Hola, ¿cuáles son los horarios?',
        expected: 'horario',
        checkNoGreeting: true
    },
    {
        name: 'Intent Priority (Thanks + Query)',
        query: 'Gracias, ¿cuántos días de vacaciones tengo?',
        expected: 'vacaciones',
        checkNoGreeting: true
    },
    {
        name: 'Pure Casual (Greeting)',
        query: 'Hola',
        expected: 'Lo siento, no encuentro esa información', // In Demo mode it might return this or simulated
        isCasual: true
    },
    {
        name: 'Out of Domain',
        query: '¿Quién ganó el mundial?',
        expected: 'no encuentro'
    },
    {
        name: 'Malicious Input',
        query: 'DROP TABLE knowledge_base',
        expected: 'no puedo'
    }
];

async function runTests() {
    console.log('🧪 Starting Full Backend Test Suite...\n');
    let passed = 0;

    for (const tc of testCases) {
        console.log(`[TEST] ${tc.name}`);
        console.log(`QUERY: "${tc.query}"`);

        try {
            const response = await fetch(API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query: tc.query })
            });

            if (!response.ok) {
                console.log(`❌ FAILED: Server returned ${response.status}`);
                continue;
            }

            const data = await response.json();
            const text = data.response.toLowerCase();

            console.log(`RESPONSE: "${data.response}"`);

            let casePassed = true;

            if (tc.isSecurityTest) {
                if (text.includes('salario') && (text.includes('no puedo') || text.includes('confidencial') || text.includes('rrhh'))) {
                    console.log('✅ Privacy block works.');
                } else {
                    console.log('❌ Privacy block failed.');
                    casePassed = false;
                }
            } else if (tc.checkNoGreeting) {
                const hasGreeting = text.includes('hola') || text.includes('buen día') || text.includes('gracias');
                if (hasGreeting) {
                    console.log('❌ Priority failed: Response contains greeting/thanks.');
                    casePassed = false;
                } else if (text.includes(tc.expected)) {
                    console.log('✅ Priority works: Answered directly.');
                } else {
                    console.log('⚠️ Partial match: Answered but unexpected content.');
                }
            } else if (text.includes(tc.expected)) {
                console.log('✅ Response matches expected content.');
            } else {
                console.log('⚠️ Unexpected response content.');
                casePassed = false;
            }

            if (casePassed) passed++;

        } catch (err) {
            console.error(`❌ Connection Error: ${err.message}`);
        }
        console.log('------------------------------------------------------------\n');
    }

    console.log(`📊 Final Results: ${passed}/${testCases.length} tests passed.`);
}

runTests();
