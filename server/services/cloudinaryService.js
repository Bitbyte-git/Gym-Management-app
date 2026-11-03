const cloudinary = require('cloudinary').v2;
const config = require('../config/env');

function getCloudinary() {
  const { cloudName, apiKey, apiSecret } = config.cloudinary || {};
  if (!cloudName || !apiKey || !apiSecret) {
    const error = new Error('Cloudinary is not configured. Please add CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET to server/.env');
    error.statusCode = 503;
    error.code = 'CLOUDINARY_NOT_CONFIGURED';
    throw error;
  }
  cloudinary.config({
    cloud_name: cloudName,
    api_key: apiKey,
    api_secret: apiSecret,
    secure: true,
  });
  return cloudinary;
}

function isConfigured() {
  const { cloudName, apiKey, apiSecret } = config.cloudinary || {};
  return Boolean(cloudName && apiKey && apiSecret);
}

/**
 * Uploads an avatar image (Buffer, file path, or base64 data URI) to Cloudinary.
 * Applies automatic face centering, square cropping, and modern format optimization.
 */
async function uploadAvatar(fileInput, options = {}) {
  const cld = getCloudinary();
  const folder = options.folder || config.cloudinary.avatarsFolder || 'gym-avatars';

  const defaultTransformation = [
    { width: 500, height: 500, crop: 'fill', gravity: 'face' },
    { quality: 'auto', fetch_format: 'auto' },
  ];

  const uploadOptions = {
    folder,
    resource_type: 'image',
    transformation: defaultTransformation,
    allowed_formats: ['jpg', 'png', 'jpeg', 'webp', 'gif'],
    ...options,
  };

  // If buffer is passed (from multer memoryStorage)
  if (Buffer.isBuffer(fileInput)) {
    return new Promise((resolve, reject) => {
      const stream = cld.uploader.upload_stream(uploadOptions, (error, result) => {
        if (error) return reject(error);
        resolve({
          url: result.secure_url || result.url,
          secureUrl: result.secure_url,
          publicId: result.public_id,
          format: result.format,
          width: result.width,
          height: result.height,
        });
      });
      stream.end(fileInput);
    });
  }

  // If base64 data URI or string path is passed
  if (typeof fileInput === 'string') {
    const result = await cld.uploader.upload(fileInput, uploadOptions);
    return {
      url: result.secure_url || result.url,
      secureUrl: result.secure_url,
      publicId: result.public_id,
      format: result.format,
      width: result.width,
      height: result.height,
    };
  }

  throw new Error('Unsupported image input type for Cloudinary upload');
}

/**
 * Removes an image by public ID
 */
async function deleteImage(publicId) {
  if (!isConfigured() || !publicId) return null;
  const cld = getCloudinary();
  return cld.uploader.destroy(publicId);
}

module.exports = {
  isConfigured,
  uploadAvatar,
  deleteImage,
};

