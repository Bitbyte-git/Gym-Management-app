const fail = (message, statusCode = 400) => { throw Object.assign(new Error(message), { statusCode }); };
const fingers = ['right_thumb', 'right_index', 'right_middle', 'right_ring', 'right_little', 'left_thumb', 'left_index', 'left_middle', 'left_ring', 'left_little'];
function decodeBase64(value, maxBytes, label) {
  if (typeof value !== 'string' || !value.length || value.length > Math.ceil(maxBytes / 3) * 4 ||
      value.length % 4 !== 0 || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value)) fail(label + ' must be bounded canonical Base64');
  const bytes = Buffer.from(value, 'base64');
  if (!bytes.length || bytes.length > maxBytes || bytes.toString('base64') !== value) fail(label + ' has invalid size or encoding');
  return bytes;
}
function boundedText(value, label, max = 128) {
  if (typeof value !== 'string' || !value.trim() || value.length > max || /[\x00-\x1f]/.test(value)) fail(label + ' is required and must be bounded text');
  return value.trim();
}
function validateCapture(capture, fingerPosition) {
  if (!capture || typeof capture !== 'object' || Array.isArray(capture)) fail('Capture data is required');
  if (!fingers.includes(fingerPosition)) fail('Select a supported finger position');
  if (capture.templateFormat !== 'FMR_V2005') fail('Only vendor-confirmed FMR_V2005 templates are enabled');
  if (capture.vendorErrorCode !== 0 && capture.vendorErrorCode !== '0') fail('Vendor capture did not succeed');
  if (capture.deviceModel !== 'MFS500') fail('An MFS500 capture is required');
  const template = decodeBase64(capture.templateBase64, 64 * 1024, 'Template');
  if (template.length < 4 || template.subarray(0, 4).toString('ascii') !== 'FMR\0') fail('Invalid FMR template header');
  let image;
  if (capture.imageBase64 !== undefined) {
    if (capture.imageFormat !== 'BMP') fail('Only vendor-confirmed BMP images are enabled');
    image = decodeBase64(capture.imageBase64, 512 * 1024, 'Image');
    if (image.length < 26 || image.subarray(0, 2).toString() !== 'BM') fail('Invalid BMP image header');
  }
  if (!Number.isFinite(capture.quality) || capture.quality < 60 || capture.quality > 100) fail('Capture quality must be between 60 and 100; please retry');
  if (capture.nfiq !== undefined && (!Number.isInteger(capture.nfiq) || capture.nfiq < 1 || capture.nfiq > 5)) fail('Invalid NFIQ');
  for (const field of ['imageWidth', 'imageHeight']) {
    if (capture[field] !== undefined && (!Number.isInteger(capture[field]) || capture[field] < 1 || capture[field] > 4096)) fail('Invalid image dimensions');
  }
  if (typeof capture.capturedAt !== 'string' || !Number.isFinite(Date.parse(capture.capturedAt))) fail('A valid capture time is required');
  return { template, image, deviceSerial: boundedText(capture.deviceSerial, 'Device serial') };
}
module.exports = { validateCapture, decodeBase64, fail, fingers };
