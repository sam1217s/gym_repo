import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';

/**
 * Adaptador del hook `SessionStart` de Claude Code: inyecta la vista `cerebro`
 * del grafo como contexto al abrir una sesion.
 */
const __dirname = path.dirname(fileURLToPath(import.meta.url));

try {
  let output = execSync(`node "${path.join(__dirname, 'graph.js')}" cerebro`, {
    encoding: 'utf8',
    cwd: __dirname,
  });
  output = output.replace(/\x1b\[[0-9;]*m/g, '');
  if (output.length > 8000) output = output.substring(0, 8000) + '\n... [truncado]';

  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'SessionStart',
        additionalContext: `=== ARQUITECTURA DEL PROYECTO (graph.js cerebro) ===\n\n${output}`,
      },
    }),
  );
} catch {
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: 'graph.js no disponible' },
    }),
  );
}
