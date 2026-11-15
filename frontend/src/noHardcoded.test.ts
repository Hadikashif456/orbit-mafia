import { describe, it, expect } from 'vitest';
// @ts-expect-error Node built-in without @types/node
import * as fs from 'node:fs';
// @ts-expect-error Node built-in without @types/node
import * as path from 'node:path';

declare const process: { cwd: () => string };

const FORBIDDEN_STRINGS = [
  'demo_month',
  'fake_data',
  'mockDaily',
  'detailSource',
  'Kenji Mori',
  'Emily Carter',
  'Yuki Tanaka',
  'Eman Fatima',
];

function getAllFiles(dirPath: string, arrayOfFiles: string[] = []): string[] {
  const files: string[] = fs.readdirSync(dirPath);

  for (const file of files) {
    const fullPath = path.join(dirPath, file);
    if (fs.statSync(fullPath).isDirectory()) {
      arrayOfFiles = getAllFiles(fullPath, arrayOfFiles);
    } else {
      arrayOfFiles.push(fullPath);
    }
  }

  return arrayOfFiles;
}

describe('No Hardcoded Data Guard', () => {
  it('ensures no hardcoded mock imports or fake crew names exist outside mocks and tests', () => {
    const cwd = process.cwd();
    const candidateSrc = path.join(cwd, 'src');
    const candidateFrontendSrc = path.join(cwd, 'frontend', 'src');
    const srcDir = fs.existsSync(candidateSrc) ? candidateSrc : candidateFrontendSrc;

    const allFiles = getAllFiles(srcDir);
    const violations: { file: string; forbidden: string }[] = [];

    for (const filePath of allFiles) {
      const normalizedPath = filePath.replace(/\\/g, '/');

      // Skip files inside src/mocks and all test files (*.test.ts, *.test.tsx)
      if (normalizedPath.includes('/src/mocks/')) {
        continue;
      }
      if (normalizedPath.endsWith('.test.ts') || normalizedPath.endsWith('.test.tsx')) {
        continue;
      }

      const content = fs.readFileSync(filePath, 'utf-8');

      for (const forbidden of FORBIDDEN_STRINGS) {
        if (content.includes(forbidden)) {
          violations.push({
            file: normalizedPath,
            forbidden,
          });
        }
      }
    }

    expect(
      violations,
      `Found hardcoded strings in source files:\n${violations
        .map((v) => `  ${v.file} contains "${v.forbidden}"`)
        .join('\n')}`
    ).toEqual([]);
  });
});
