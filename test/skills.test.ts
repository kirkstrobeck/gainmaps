import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, it } from 'vitest';

async function readFrontmatter(path: string): Promise<{ name: string; internal: boolean }> {
  const text = await readFile(path, 'utf8');
  if (!text.startsWith('---')) return { name: '', internal: false };
  const end = text.indexOf('---', 3);
  if (end === -1) return { name: '', internal: false };
  const block = text.slice(3, end);
  const nameMatch = block.match(/^name:\s*(.+)$/m);
  const name = nameMatch ? nameMatch[1].trim() : '';
  const internal = /^\s*(?:metadata\.internal|internal):\s*true\s*$/m.test(block);
  return { name, internal };
}

describe('skills frontmatter', () => {
  it('sandbox is internal, ultra-text is not, public skills are exactly ultra-text', async () => {
    const skillsDir = join(process.cwd(), '.claude/skills');
    const entries = await readdir(skillsDir, { withFileTypes: true });
    const paths: string[] = [];
    for (const entry of entries) {
      if (entry.isDirectory() || entry.isSymbolicLink()) {
        paths.push(join(skillsDir, entry.name, 'SKILL.md'));
      }
    }
    assert.ok(paths.length >= 2, 'expected at least 2 skill files');

    const sandboxPath = paths.find((p) => p.includes('/sandbox/'));
    assert.ok(sandboxPath, 'sandbox SKILL.md not found');
    const sandboxFm = await readFrontmatter(sandboxPath);
    assert.equal(sandboxFm.internal, true, 'sandbox must have metadata.internal: true');

    const ultraPath = paths.find((p) => p.includes('/ultra-text/'));
    assert.ok(ultraPath, 'ultra-text SKILL.md not found');
    const ultraFm = await readFrontmatter(ultraPath);
    assert.equal(ultraFm.internal, false, 'ultra-text must not be internal');

    const publicSkills: string[] = [];
    for (const p of paths) {
      const fm = await readFrontmatter(p);
      if (!fm.internal) publicSkills.push(fm.name);
    }

    assert.deepEqual(publicSkills.sort(), ['ultra-text'], 'public skills must be exactly ultra-text');
  });
});
