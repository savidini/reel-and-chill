import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const local = root + '.venv/bin/python';
const command = existsSync(local) ? local : 'uv';
const args = existsSync(local) ? [] : ['run', '--script'];
const sceneTask = process.argv[2] === '--scenes';
const script = sceneTask ? 'fetch_scenes.py' : 'import_game.py';
const result = spawnSync(command, [...args, root + 'scripts/' + script, ...process.argv.slice(sceneTask ? 3 : 2)], {
  cwd: root, stdio: 'inherit', env: { ...process.env, UV_CACHE_DIR: root + '.cache/uv' },
});
if (result.error) console.error('Install uv or create .venv with UnityPy 1.25.4 first.', result.error.message);
process.exit(result.status ?? 1);
