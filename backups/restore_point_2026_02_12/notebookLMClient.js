/**
 * NotebookLM MCP Client
 * Handles communication with the NotebookLM backend server
 */

class NotebookLMClient {
    constructor() {
        this.conversationId = null;
        // Detectar si estamos en localhost o en una IP de red
        // Asumimos que el backend siempre corre en el puerto 3000 del mismo host
        const hostname = window.location.hostname;
        this.apiBaseUrl = `http://${hostname}:3000/api`;
        console.log('NotebookLM Client configured for:', this.apiBaseUrl);
    }

    async initialize() {
        try {
            const response = await fetch(`${this.apiBaseUrl}/health`);
            const data = await response.json();
            console.log('NotebookLM Backend Status:', data.status);
            return data.status === 'ready';
        } catch (error) {
            console.error('No se pudo conectar con el servidor backend:', error);
            return false;
        }
    }

    /**
     * Consulta real al cuaderno de NotebookLM
     */
    async query(query) {
        try {
            const response = await fetch(`${this.apiBaseUrl}/query`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    query: query,
                    conversationId: this.conversationId
                }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Error en la consulta');
            }

            const data = await response.json();

            // Guardamos el ID de conversación para mantener el contexto
            if (data.conversationId) {
                this.conversationId = data.conversationId;
            }

            return data.response;
        } catch (error) {
            console.error('Error al consultar NotebookLM:', error);
            // Propagate the specific error message to the UI
            throw new Error(error.message || 'Lo siento, no pude procesar tu consulta. Por favor, contacta con un humano de RRHH de forma amable.');
        }
    }

    resetConversation() {
        this.conversationId = null;
    }
}

export default new NotebookLMClient();
