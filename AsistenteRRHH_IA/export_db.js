import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import fs from 'fs';
import path from 'path';

const DB_PATH = path.join(process.cwd(), 'hr_cache.db');
const EXPORT_PATH = path.join(process.cwd(), 'hr_cache_export.sql');

async function exportDatabase() {
    console.log('🚀 Iniciando exportación de hr_cache.db a SQL...');
    
    let db;
    try {
        db = await open({
            filename: DB_PATH,
            driver: sqlite3.Database
        });

        let sqlOutput = '-- HR Cache Database Export\n';
        sqlOutput += '-- Generated at: ' + new Date().toISOString() + '\n\n';
        
        // Disable foreign keys and wrap in transaction for speed
        sqlOutput += 'PRAGMA foreign_keys=OFF;\n';
        sqlOutput += 'BEGIN TRANSACTION;\n\n';

        // 1. Get Table Schema
        const tables = await db.all("SELECT name, sql FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'");
        
        for (const table of tables) {
            sqlOutput += `DROP TABLE IF EXISTS ${table.name};\n`;
            sqlOutput += `${table.sql};\n\n`;
            
            // 2. Get Data
            const rows = await db.all(`SELECT * FROM ${table.name}`);
            if (rows.length > 0) {
                const columns = Object.keys(rows[0]);
                const columnsStr = columns.join(', ');
                
                for (const row of rows) {
                    const values = columns.map(col => {
                        const val = row[col];
                        if (val === null) return 'NULL';
                        if (typeof val === 'string') return `'${val.replace(/'/g, "''")}'`;
                        return val;
                    });
                    sqlOutput += `INSERT INTO ${table.name} (${columnsStr}) VALUES (${values.join(', ')});\n`;
                }
                sqlOutput += '\n';
            }
        }

        // 3. Get Indexes
        const indexes = await db.all("SELECT sql FROM sqlite_master WHERE type='index' AND name NOT LIKE 'sqlite_%' AND sql IS NOT NULL");
        for (const idx of indexes) {
            sqlOutput += `${idx.sql};\n`;
        }

        sqlOutput += '\nCOMMIT;\n';

        fs.writeFileSync(EXPORT_PATH, sqlOutput);
        console.log(`✅ Exportación completada exitosamente en: ${EXPORT_PATH}`);
        console.log(`📊 Total de tablas exportadas: ${tables.length}`);
        
    } catch (error) {
        console.error('❌ Error durante la exportación:', error.message);
    } finally {
        if (db) await db.close();
    }
}

exportDatabase();
