import { test } from 'node:test';
import assert from 'node:assert/strict';
import { designLibrary } from '../../src/core/design-library.js';
import { expectCode } from '../helpers.js';

test('offline library exposes pinned sources, searchable styles, attribution, and bounded reads only', () => {
  const sources = designLibrary({})['sources'] as { source: string; revision: string }[];
  assert.equal(sources.length, 6);
  assert.ok(sources.every((source) => /^[a-f0-9]{40}$/.test(source.revision)));
  const source = 'AI-Visual-Prompt-Cookbook';
  const matches = designLibrary({ source, query: 'editorial', limit: 2 });
  const files = matches['files'] as string[];
  assert.equal(files.length, 2);
  assert.equal(matches['next_offset'], 2);
  const file = files[0]!;
  const read = designLibrary({ source, file });
  assert.match(String(read['license']), /CC-BY-4.0/);
  assert.match(String(read['content']), /prompt/i);
  assert.ok(String(read['content']).length <= 16000);
  expectCode(() => designLibrary({ source, file: '../../package.json' }), 'INVALID_INPUT');
  expectCode(() => designLibrary({ source: 'unknown' }), 'INVALID_INPUT');
  expectCode(() => designLibrary({ file }), 'INVALID_INPUT');
});
