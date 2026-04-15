import type { ToolDefinition } from "@/ports/ai-provider";

export const artifactsTool: ToolDefinition = {
  name: "artifacts",
  description: `Create and manage file artifacts that persist across the conversation.

CRITICAL: Before editing an existing file, you MUST use the "get" command to retrieve its current content. Do not rely on conversation history for file contents.

Available commands:
- create: Create a new file with the given content
- update: Update a specific part of an existing file (find and replace). Use "get" first to see the content.
- rewrite: Completely replace a file's content. Use "get" first to see the current content.
- get: Retrieve the content of an existing file. ALWAYS use this before editing.
- delete: Delete a file
- logs: Get console logs from an HTML file execution

The artifacts panel will show all created files. HTML files are executed in a sandboxed iframe and can access other artifacts and attachments.

Workflow for editing:
1. Get current content: { "command": "get", "filename": "page.html" }
2. Then update/rewrite with the retrieved content in mind

Examples:
- Create a new HTML page: { "command": "create", "filename": "page.html", "content": "<!DOCTYPE html>..." }
- Get file content (REQUIRED before editing): { "command": "get", "filename": "page.html" }
- Fix a typo: { "command": "update", "filename": "page.html", "old_str": "Helo", "new_str": "Hello" }
- Delete file: { "command": "delete", "filename": "page.html" }`,
  parameters: {
    type: "object",
    properties: {
      command: {
        type: "string",
        enum: ["create", "update", "rewrite", "get", "delete", "logs"],
        description: "The operation to perform",
      },
      filename: {
        type: "string",
        description: "Filename including extension (e.g., 'index.html', 'styles.css')",
      },
      content: {
        type: "string",
        description: "File content (required for create/rewrite, optional for update)",
      },
      old_str: {
        type: "string",
        description: "String to find and replace (required for update command)",
      },
      new_str: {
        type: "string",
        description: "Replacement string (required for update command)",
      },
    },
    required: ["command", "filename"],
  },
};
