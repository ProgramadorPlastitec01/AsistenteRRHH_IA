import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import fs from 'fs';
import path from 'path';

const SQL_PATH = path.join(process.cwd(), 'hr_cache_export.sql');
const DB_PATH = path.join(process.cwd(), 'hr_cache_restored.db');

async function restoreDatabase() {
    console.log(`🚀 Iniciando restauración desde ${SQL_PATH}...`);
    
    if (!fs.existsSync(SQL_PATH)) {
        console.error(`❌ Error: El archivo ${SQL_PATH} no existe.`);
        return;
    }

    const sql = fs.readFileSync(SQL_PATH, 'utf8');
    let db;

    try {
        // Eliminar si ya existe para una restauración limpia
        if (fs.existsSync(DB_PATH)) {
            fs.unlinkSync(DB_PATH);
        }

        db = await open({
            filename: DB_PATH,
            driver: sqlite3.Database
        });

        // Ejecutar el SQL. Nota: exec() puede fallar con scripts muy grandes o múltiples sentencias en algunas versiones,
        // pero para SQLite suele funcionar bien si el script está bien formateado.
        await db.exec(sql);

        console.log(`✅ Restauración completada exitosamente en: ${DB_PATH}`);
        
        const count = await db.get('SELECT COUNT(*) as total FROM knowledge_base');
        console.log(`📊 Total de registros restaurados: ${count.total}`);

    } catch (error) {
        console.error('❌ Error durante la restauración:', error.message);
    } finally {
        if (db) await db.close();
    }
}

restoreDatabase();
