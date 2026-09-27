import { createHash, createPublicKey } from 'node:crypto';

export function extensionIdFromPublicKey(encodedPublicKey) {
  if (typeof encodedPublicKey !== 'string') {
    throw new TypeError('Chrome extension public key must be a base64 string');
  }
  const normalized = encodedPublicKey.replace(/\s+/g, '');
  if (!normalized || !/^[A-Za-z0-9+/]+={0,2}$/.test(normalized)) {
    throw new Error('Invalid Chrome extension public key: expected base64');
  }

  const der = Buffer.from(normalized, 'base64');
  if (der.toString('base64').replace(/=+$/, '') !== normalized.replace(/=+$/, '')) {
    throw new Error('Invalid Chrome extension public key: malformed base64');
  }
  let key;
  try {
    key = createPublicKey({ key: der, format: 'der', type: 'spki' });
  } catch (error) {
    throw new Error('Invalid Chrome extension public key: not a DER SubjectPublicKeyInfo key', { cause: error });
  }
  if (key.asymmetricKeyType !== 'rsa') {
    throw new Error('Invalid Chrome extension public key: Chrome extension IDs require RSA keys');
  }

  const digest = createHash('sha256').update(der).digest().subarray(0, 16);
  let id = '';
  for (const byte of digest) {
    id += String.fromCharCode(97 + (byte >> 4), 97 + (byte & 0x0f));
  }
  return id;
}
