import notebookLMClient from './src/utils/notebookLMClient.js';

// Mock de fetch para entorno de node si fuera necesario, pero aquí usaremos el del navegador o asumimos ejecución en entorno compatible
// Como esto corre en el servidor de desarrollo, mejor hago un script que se pueda ejecutar con node si extraigo la lógica,
// pero 'notebookLMClient' usa '/api' relativo, así que depende del navegador o proxy.

// Mejor estrategia: Crear un archivo de test que el usuario pueda abrir o inyectar logs más agresivos en la app.
// Voy a optar por inyectar logs agresivos en VoiceChat.jsx primero.
