const crypto = require('node:crypto');
const config = require('../config/env');
function keyFor(version) {
  const encoded = config.biometric.keys[version];
  if (typeof encoded !== 'string' || !/^[A-Za-z0-9+/]{43}=$/.test(encoded)) throw new Error('Biometric encryption key must be configured as 32 random Base64 bytes');
  const key = Buffer.from(encoded, 'base64');
  if (key.length !== 32 || key.toString('base64') !== encoded) throw new Error('Invalid biometric encryption key');
  return key;
}
function encrypt(bytes, context) {
  const keyVersion = config.biometric.keyVersion;
  const nonce = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', keyFor(keyVersion), nonce);
  cipher.setAAD(Buffer.from(context));
  const ciphertext = Buffer.concat([cipher.update(bytes), cipher.final()]);
  return { ciphertext: ciphertext.toString('base64'), nonce: nonce.toString('base64'), tag: cipher.getAuthTag().toString('base64'), keyVersion };
}
function decrypt(envelope, context) {
  const decipher = crypto.createDecipheriv('aes-256-gcm', keyFor(envelope.keyVersion), Buffer.from(envelope.nonce, 'base64'));
  decipher.setAAD(Buffer.from(context));
  decipher.setAuthTag(Buffer.from(envelope.tag, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(envelope.ciphertext, 'base64')), decipher.final()]);
}
module.exports = { encrypt, decrypt, keyFor };
