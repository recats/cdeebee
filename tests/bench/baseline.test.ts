import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { isAbsolute } from 'node:path';

describe('bench/baseline.json', () => {
  it('records repository-relative bench file paths only', () => {
    const baseline = JSON.parse(readFileSync('bench/baseline.json', 'utf8')) as { files: Array<{ filepath: string }> };
    expect(baseline.files.length).toBeGreaterThan(0);
    for (const { filepath } of baseline.files) {
      expect(isAbsolute(filepath), filepath).toBe(false);
      expect(filepath, filepath).toMatch(/^tests\/bench\/[\w.-]+\.bench\.ts$/);
    }
  });
});
