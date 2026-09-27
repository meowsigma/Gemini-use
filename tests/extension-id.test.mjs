import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { extensionIdFromPublicKey } from '../scripts/extension-id.mjs';

const publicKey = readFileSync(fileURLToPath(new URL('../keys/chrome-extension-public-key.base64', import.meta.url)), 'utf8').trim();

test('derives the fixed Chrome extension ID from the published public key', () => {
  assert.equal(extensionIdFromPublicKey(publicKey), 'ejoejobdhogfjnodinblgbambdkphfap');
});

test('rejects malformed public keys instead of registering the wrong native host origin', () => {
  assert.throws(() => extensionIdFromPublicKey('not-a-base64-public-key'), /public key/i);
});
