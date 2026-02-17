
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

    const authData = {
        cookies: cleanCookies,
        updatedAt: new Date().toISOString()
    };

    try {
        // 1. Guardar en el directorio del usuario actual (para pruebas locales)
        if (!fs.existsSync(AUTH_DIR)) {
            fs.mkdirSync(AUTH_DIR, { recursive: true });
        }

        fs.writeFileSync(AUTH_FILE, JSON.stringify(authData, null, 2));

        console.log('\n✅ Credenciales guardadas para TU USUARIO en:');
        console.log(`   ${AUTH_FILE}`);

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
                console.log('✅ Credenciales copiadas al SISTEMA (para el Servicio Backend).');
            } catch (sysErr) {
                console.warn('\n⚠️ No se pudo copiar al perfil de SISTEMA (falta de permisos).');
                console.warn('   El servicio podría no funcionar si corre como LocalSystem.');
                console.warn('   Intenta ejecutar este script como ADMINISTRADOR.');
            }
        }

        console.log('\n✅ PROCESO COMPLETADO.');
        console.log('Reiniciando servicio backend para aplicar cambios...');

        // Intentar reiniciar el servicio automáticamente
        const { exec } = require('child_process');
        exec('net stop "asistenterrhhiabackend.exe" && net start "asistenterrhhiabackend.exe"', (err, stdout) => {
            if (err) {
                console.log('   (No se pudo reiniciar el servicio automáticamente. Hazlo manualmente si es necesario).');
            } else {
                console.log('   Servicio reiniciado exitosamente.');
            }
            process.exit(0);
        });

    } catch (error) {
        console.error('❌ Error al escribir el archivo:', error.message);
        process.exit(1);
    }
});
