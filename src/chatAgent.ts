import * as vscode from 'vscode';
import { Progress } from 'vscode';
import { browseWeb } from './webBrowser';

export function createChatAgent() {
    return vscode.chat.createChatAgent('webBrowsingAgent', handleChatRequest);
}

async function handleChatRequest(request: vscode.ChatAgentRequest, context: vscode.ChatAgentContext, progress: Progress<vscode.ChatAgentProgress>): Promise<vscode.ChatAgentResult2> {
    console.log(`Received chat request: ${JSON.stringify(request)}`);
    
    const response = await browseWeb(request.prompt);
    progress.report({
        content: response
    });
    
    return Promise.resolve({});
}