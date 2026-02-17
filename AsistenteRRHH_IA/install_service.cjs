var Service = require('node-windows').Service;
var path = require('path');

// Crear un nuevo objeto de servicio
var svc = new Service({
    name: 'Asistente RRHH IA Backend',
    description: 'Backend Node.js para el Kiosco de RRHH que gestiona NotebookLM y Google TTS.',
    script: path.join(__dirname, 'server.js'),
    env: [
        { name: "PORT", value: "3000" },
        { name: "NODE_ENV", value: "production" }
    ]
});

// Escuchar evento de instalación
svc.on('install', function () {
    svc.start();
    console.log('✅ Servicio instalado y arrancado exitosamente.');
    console.log('El backend ahora se ejecutará automáticamente al iniciar Windows.');
});

// Escuchar eventos de error
svc.on('error', function (err) {
    console.log('❌ Error:', err);
});

svc.on('alreadyinstalled', function () {
    console.log('⚠️ El servicio ya estaba instalado.');
    svc.start();
});

svc.install();
