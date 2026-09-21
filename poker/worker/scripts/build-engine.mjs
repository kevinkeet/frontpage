// Extracts the game engine from poker/index.html so the home-game server runs the very
// same evaluator, charts and bot logic as the app. Run automatically by `wrangler deploy`
// and `wrangler dev` (see [build] in wrangler.toml). The output is not committed.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(join(here, '..', '..', 'index.html'), 'utf8');
const block = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]).find(s => s.includes('window.Poker={'));
if (!block || !block.includes('botDecide')) throw new Error('engine block not found in poker/index.html');
const out = `// GENERATED from poker/index.html by scripts/build-engine.mjs. Do not edit.
const window = {};
${block}
export default window.Poker;
`;
const target = join(here, '..', 'src', 'engine.generated.js');
// Only touch the file when it changed: `wrangler dev` watches src/ and would otherwise rebuild forever.
if (existsSync(target) && readFileSync(target, 'utf8') === out) console.log('engine.generated.js is up to date');
else { writeFileSync(target, out); console.log(`engine.generated.js written (${(out.length / 1024).toFixed(1)} KB)`); }
