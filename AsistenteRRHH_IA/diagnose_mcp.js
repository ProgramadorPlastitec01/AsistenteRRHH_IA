
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

async function diagnose() {
    console.log('Starting diagnosis...');
    try {
        const transport = new StdioClientTransport({
            command: 'npx',
            args: ['notebooklm-mcp-server', 'mcp'],
            env: {
                ...process.env,
                NOTEBOOKLM_AUTH_FILE: process.cwd() + '\\auth.json'
            }
        });

        const client = new Client({
            name: 'diagnose-client',
            version: '1.0.0'
        }, {
            capabilities: {}
        });

        console.log('Connecting to MCP server...');
        await client.connect(transport);
        console.log('Connected!');

        console.log('Listing notebooks...');
        const listResult = await client.callTool({
            name: 'notebook_list',
            arguments: {}
        });

        const listText = listResult.content[0].text;
        console.log('Notebook List Raw:\n', listText);

        // Find RRHH notebook
        const rrhhMatch = listText.match(/-\s+\*\*(.*?(?:RRHH|Recursos Humanos).*?)\*\*\s+.*?\s+ID:\s+([a-f0-9-]+)/i);
        let notebookId;
        if (rrhhMatch) {
            notebookId = rrhhMatch[2];
            console.log(`Found RRHH Notebook ID: ${notebookId}`);
        } else {
            console.log('RRHH Notebook not found, picking first one...');
            const anyMatch = listText.match(/ID:\s+([a-f0-9-]+)/i);
            if (anyMatch) {
                notebookId = anyMatch[1];
                console.log(`Using Fallback Notebook ID: ${notebookId}`);
            } else {
                console.error('No notebooks found!');
                return;
            }
        }

        console.log(`Querying notebook ${notebookId}...`);
        try {
            const queryResult = await client.callTool({
                name: 'notebook_query',
                arguments: {
                    notebook_id: notebookId,
                    query: 'Hola, ¿estás funcionando?'
                }
            });
            console.log('Query Result Raw:\n', JSON.stringify(queryResult, null, 2));
        } catch (qError) {
            console.error('Query Failed:', qError);
        }

        client.close();

    } catch (error) {
        console.error('Diagnosis Failed:', error);
    }
}

diagnose();
