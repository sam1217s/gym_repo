import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';

/**
 * Adaptador del hook `PostToolUse`: tras editar un archivo del proyecto,
 * reinyecta el grafo actualizado. Se ignora a si mismo para no entrar en bucle.
 */
const __dirname = path.dirname(fileURLToPath(import.meta.url));

let input = '';
process.stdin.on('data', (chunk) => {
  input += chunk;
});

process.stdin.on('end', () => {
  try {
    const data = JSON.parse(input);
    const filePath = data?.tool_input?.file_path || data?.tool_response?.filePath || '';

    const graphFiles = ['graph.js', 'graph-hook.js', 'graph-posttool.js'];
    const isGraphFile = graphFiles.some((f) => filePath.endsWith(f));
    const isProjectFile =
      (filePath.endsWith('.js') || filePath.endsWith('.vue')) && !filePath.includes('node_modules');
    if (!isProjectFile || isGraphFile) process.exit(0);

    const fileName = path.basename(filePath);
    let output = execSync(`node "${path.join(__dirname, 'graph.js')}" cerebro`, {
      encoding: 'utf8',
      cwd: __dirname,
    });
    output = output.replace(/\x1b\[[0-9;]*m/g, '');
    if (output.length > 8000) output = output.substring(0, 8000) + '\n... [truncado]';

    process.stdout.write(
      JSON.stringify({
        hookSpecificOutput: {
          hookEventName: 'PostToolUse',
          additionalContext: `=== GRAFO ACTUALIZADO (despues de editar ${fileName}) ===\n\n${output}`,
        },
      }),
    );
  } catch {
    process.exit(0);
  }
});
