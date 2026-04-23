
import DatabaseService from './services/database.js';

async function checkDB() {
    console.log('--- Database Content Check ---');
    try {
        await DatabaseService.init();
        const records = await DatabaseService.db.all('SELECT * FROM knowledge_base');
        console.log(`Total records: ${records.length}`);
        records.forEach(r => {
            console.log(`[ID: ${r.id}] [Category: ${r.category}] Q: ${r.question_original}`);
            console.log(`A: ${r.answer.substring(0, 50)}...`);
            console.log('---');
        });
    } catch (error) {
        console.error('Error:', error.message);
    } finally {
        if (DatabaseService.db) await DatabaseService.db.close();
    }
}

checkDB();
