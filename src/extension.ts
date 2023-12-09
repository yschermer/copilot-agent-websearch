import * as vscode from 'vscode';
import { createChatAgent } from './chatAgent';

export function activate(context: vscode.ExtensionContext) {
  const agent = createChatAgent();
  context.subscriptions.push(agent);
}

export function deactivate() {
  // Clean up any resources if necessary
}