const test = require('node:test');
const assert = require('node:assert/strict');
const cloudinaryService = require('../services/cloudinaryService');

test('cloudinaryService.isConfigured returns boolean depending on environment variables', () => {
  const configured = cloudinaryService.isConfigured();
  assert.equal(typeof configured, 'boolean');
});

test('cloudinaryService.uploadAvatar throws CLOUDINARY_NOT_CONFIGURED if credentials are missing', async () => {
  if (!cloudinaryService.isConfigured()) {
    await assert.rejects(
      cloudinaryService.uploadAvatar(Buffer.from('fake-image-data')),
      (err) => {
        assert.equal(err.code, 'CLOUDINARY_NOT_CONFIGURED');
        assert.equal(err.statusCode, 503);
        assert.ok(err.message.includes('CLOUDINARY_CLOUD_NAME'));
        return true;
      }
    );
  }
});

test('cloudinaryService.deleteImage returns null if publicId is missing or not configured', async () => {
  const result = await cloudinaryService.deleteImage(null);
  assert.equal(result, null);
});

