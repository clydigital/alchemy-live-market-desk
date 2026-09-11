import { readFile, mkdir, writeFile, realpath } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { evaluateHistoricalShadows, historicalShadowMarkdown } from '../lib/intelligence/historical-shadow-evaluator.ts';

export async function evaluateExport(inputPath: string, outputDirectory: string) {
  const input = await realpath(inputPath);
  const out = resolve(outputDirectory);
  await mkdir(out, { recursive: true });
  const target = await realpath(out);
  if (input === join(target,'historical-shadow-evaluation.json') || input === join(target,'historical-shadow-evaluation.md')) throw new Error('Output must not overwrite the input export.');
  const bytes = await readFile(input);
  const report = { inputSha256: createHash('sha256').update(bytes).digest('hex'), ...evaluateHistoricalShadows(JSON.parse(bytes.toString('utf8'))) };
  // Exclusive output creation also prevents following an existing symlink or replacing a previous report.
  await writeFile(join(target,'historical-shadow-evaluation.json'), JSON.stringify(report,null,2)+'\n', { flag: 'wx' });
  await writeFile(join(target,'historical-shadow-evaluation.md'), historicalShadowMarkdown(report), { flag: 'wx' });
  return report;
}
if (typeof process !== 'undefined' && process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.length !== 4) throw new Error('Usage: node --experimental-strip-types scripts/evaluate-historical-shadows.ts export.json output-directory');
  await evaluateExport(process.argv[2],process.argv[3]);
}
