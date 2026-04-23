/**
 * test_api.js — Script básico de validación del backend
 *
 * Uso: Con el servidor corriendo en otra terminal (node server.js), ejecutar:
 *   node test_api.js
 */

const BASE_URL = 'http://localhost:3000';

const pass = (msg) => console.log(`  ✅ ${msg}`);
const fail = (msg) => console.error(`  ❌ ${msg}`);
const section = (title) => console.log(`\n🔹 ${title}`);

async function check(name, fn) {
    try {
        await fn();
        pass(name);
    } catch (err) {
        fail(`${name} → ${err.message}`);
    }
}

async function runTests() {
    console.log('╔══════════════════════════════════════════╗');
    console.log('║  AsistenteRRHH_IA — Backend API Tests   ║');
    console.log('╚══════════════════════════════════════════╝');

    // ──────────────────────────────────────────────
    section('1. GET /api/health');
    await check('Responde con status 200', async () => {
        const res = await fetch(`${BASE_URL}/api/health`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
    });
    await check('Contiene campo "status"', async () => {
        const res = await fetch(`${BASE_URL}/api/health`);
        const data = await res.json();
        if (!data.status) throw new Error('Falta campo "status"');
    });
    await check('status es "ready" o "initializing"', async () => {
        const res = await fetch(`${BASE_URL}/api/health`);
        const data = await res.json();
        if (!['ready', 'initializing'].includes(data.status))
            throw new Error(`status inesperado: ${data.status}`);
    });

    // ──────────────────────────────────────────────
    section('2. POST /api/query');
    await check('Responde con status 200 para consulta simple', async () => {
        const res = await fetch(`${BASE_URL}/api/query`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: 'hola' })
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
    });
    await check('Devuelve campo "response" de tipo string', async () => {
        const res = await fetch(`${BASE_URL}/api/query`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: 'hola' })
        });
        const data = await res.json();
        if (typeof data.response !== 'string') throw new Error(`Tipo inesperado: ${typeof data.response}`);
        if (data.response.length < 2) throw new Error('Respuesta vacía o muy corta');
    });
    await check('Rechaza query vacío con 400', async () => {
        const res = await fetch(`${BASE_URL}/api/query`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: '' })
        });
        if (res.status !== 400) throw new Error(`Se esperaba 400, recibido ${res.status}`);
    });
    await check('Rechaza body sin query con 400', async () => {
        const res = await fetch(`${BASE_URL}/api/query`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({})
        });
        if (res.status !== 400) throw new Error(`Se esperaba 400, recibido ${res.status}`);
    });

    // ──────────────────────────────────────────────
    section('3. GET /api/system-status');
    await check('Responde con status 200', async () => {
        const res = await fetch(`${BASE_URL}/api/system-status`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
    });
    await check('Contiene array "services" con al menos 3 entradas', async () => {
        const res = await fetch(`${BASE_URL}/api/system-status`);
        const data = await res.json();
        if (!Array.isArray(data.services)) throw new Error('Falta campo "services"');
        if (data.services.length < 3) throw new Error(`Solo ${data.services.length} servicios — se esperaban ≥3`);
    });
    await check('Cada servicio tiene campos id, name y status', async () => {
        const res = await fetch(`${BASE_URL}/api/system-status`);
        const data = await res.json();
        for (const svc of data.services) {
            if (!svc.id || !svc.name || !svc.status)
                throw new Error(`Servicio incompleto: ${JSON.stringify(svc)}`);
        }
    });

    // ──────────────────────────────────────────────
    section('4. POST /api/reset');
    await check('Responde con { success: true }', async () => {
        const res = await fetch(`${BASE_URL}/api/reset`, { method: 'POST' });
        const data = await res.json();
        if (!data.success) throw new Error('No devolvió { success: true }');
    });

    // ──────────────────────────────────────────────
    section('5. Rutas no existentes');
    await check('GET /api/nonexistent devuelve 404 con JSON', async () => {
        const res = await fetch(`${BASE_URL}/api/nonexistent`);
        if (res.status !== 404) throw new Error(`Se esperaba 404, recibido ${res.status}`);
        const data = await res.json();
        if (!data.error) throw new Error('Falta campo "error" en respuesta 404');
    });

    // ──────────────────────────────────────────────
    section('6. Pruebas de Estrés y Concurrencia (Phase 5)');
    await check('Soporta 5 peticiones simultáneas de Query', async () => {
        const queries = ['hola', 'qué haces', 'quien eres', 'vacaciones', 'nómina'];
        const start = Date.now();

        const promises = queries.map(q =>
            fetch(`${BASE_URL}/api/query`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query: q })
            }).then(r => r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)))
        );

        const results = await Promise.all(promises);
        const totalTime = Date.now() - start;

        if (results.length !== 5) throw new Error('No se recibieron todas las respuestas');
        console.log(`    ℹ️ Tiempo total para 5 queries concurrentes: ${totalTime}ms`);
        console.log(`    ℹ️ Promedio por query: ${(totalTime / 5).toFixed(0)}ms`);
    });

    // ──────────────────────────────────────────────
    section('7. Verificación de Analytics');
    await check('GET /api/analytics devuelve historial', async () => {
        const res = await fetch(`${BASE_URL}/api/analytics`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (!Array.isArray(data.events)) throw new Error('Falta array "events"');
        console.log(`    ℹ️ Eventos encontrados: ${data.events.length}`);
    });

    console.log('\n──────────────────────────────────────────');
    console.log('  Pruebas completadas. Corrige los ❌ antes de hacer deploy.');
    console.log('──────────────────────────────────────────\n');
}

runTests().catch((err) => {
    console.error('\n💥 Error crítico ejecutando las pruebas:', err.message);
    console.error('   ¿Está el servidor corriendo en el puerto 3000?\n');
    process.exit(1);
});
