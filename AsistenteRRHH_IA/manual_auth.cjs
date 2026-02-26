
const fs = require('fs');
const path = require('path');
const os = require('os');
const readline = require('readline');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const AUTH_DIR = path.join(os.homedir(), '.notebooklm-mcp');
const AUTH_FILE = path.join(AUTH_DIR, 'auth.json');

console.log('\n=== REPARACIÓN MANUAL DE AUTENTICACIÓN NOTEBOOKLM ===\n');
console.log('La autenticación automática falló. Vamos a generar el archivo de credenciales manualmente.\n');
console.log('PASOS:');
console.log('1. Abre tu navegador (Chrome/Edge) y ve a: https://notebooklm.google.com');
console.log('2. Inicia sesión con tu cuenta de Google.');
console.log('3. Abre las Herramientas de Desarrollador (F12) y ve a la pestaña "Network" (Red).');
console.log('4. Recarga la página (F5).');
console.log('5. En la lista de red, busca una petición llamada "notebooks" o cualquier otra que vaya a google.com.');
console.log('6. Haz clic en ella, ve a la sección "Request Headers" (Cabeceras de solicitud).');
console.log('7. Busca el campo "cookie" (o "Cookie"). Copia TODO su contenido (es una cadena larga de texto).');
console.log('\n---------------------------------------------------------');

rl.question('Pega aquí el contenido de la cookie y pulsa Enter:\n> ', (cookieString) => {

    if (!cookieString || cookieString.trim().length < 20) {
        console.error('❌ Error: La cookie parece demasiado corta o vacía.');
        rl.close();
        return;
    }

    // Limpiar comillas si el usuario las incluyó
    let cleanCookies = cookieString.trim();
    if (cleanCookies.startsWith('"') && cleanCookies.endsWith('"')) {
        cleanCookies = cleanCookies.slice(1, -1);
    }
    if (cleanCookies.startsWith('cookie:')) {
        cleanCookies = cleanCookies.replace(/^cookie:\s*/i, '');
    }

    // Validación básica: Debe contener al menos SID o __Secure-1PSID
    if (!cleanCookies.includes('SID=') && !cleanCookies.includes('__Secure-1PSID=')) {
        console.warn('⚠️ Advertencia: La cookie no parece válida (faltan campos SID o __Secure-1PSID).');
        console.warn('   Asegúrate de copiar TODO el contenido del campo "cookie".');
    }

    const authData = {
        cookies: cleanCookies,
        updatedAt: new Date().toISOString()
    };

    try {
        // [MODIFICADO] 1. Guardar en el directorio ACTUAL (Proyecto) - PRIORIDAD 1
        const localAuthFile = path.join(process.cwd(), 'auth.json');
        fs.writeFileSync(localAuthFile, JSON.stringify(authData, null, 2));
        console.log('\n✅ Credenciales guardadas en RAIZ DEL PROYECTO:');
        console.log(`   ${localAuthFile}`);

        // 2. Guardar también en el directorio del usuario (Respaldo)
        if (!fs.existsSync(AUTH_DIR)) {
            fs.mkdirSync(AUTH_DIR, { recursive: true });
        }
        fs.writeFileSync(AUTH_FILE, JSON.stringify(authData, null, 2));
        console.log('   (Backup guardado en perfil de usuario)');

        // 2. Intentar guardar en el perfil de SISTEMA (para el Servicio de Windows)
        // La ruta suele ser C:\Windows\System32\config\systemprofile\.notebooklm-mcp
        // o C:\Windows\SysWOW64\config\systemprofile\.notebooklm-mcp

        const systemProfilePath = process.env.SystemRoot
            ? path.join(process.env.SystemRoot, 'System32', 'config', 'systemprofile', '.notebooklm-mcp')
            : null;

        if (systemProfilePath) {
            try {
                if (!fs.existsSync(systemProfilePath)) {
                    fs.mkdirSync(systemProfilePath, { recursive: true });
                }
                const systemAuthFile = path.join(systemProfilePath, 'auth.json');
                fs.writeFileSync(systemAuthFile, JSON.stringify(authData, null, 2));
                
                // Intentar dar permisos de lectura a todos en el archivo del sistema (para evitar bloqueos del servicio)
                try {
                    const { execSync } = require('child_process');
                    execSync(`icacls "${systemAuthFile}" /grant Everyone:R`, { stdio: 'ignore' });
                } catch (e) { /* ignore permission error if icacls fails */ }

                console.log('✅ Credenciales copiadas al SISTEMA (para el Servicio Backend).');
            } catch (sysErr) {
                console.warn('\n⚠️ No se pudo copiar al perfil de SISTEMA (falta de permisos).');
                console.warn('   El servicio podría no funcionar si corre como LocalSystem.');
                console.warn('   Intenta ejecutar este script como ADMINISTRADOR.');
            }
        }

        console.log('\n✅ PROCESO COMPLETADO.');
        process.exit(0);

    } catch (error) {
        console.error('❌ Error al escribir el archivo:', error.message);
        process.exit(1);
    }
});
