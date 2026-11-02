const crypto = require('crypto');
const config = require('../config/env');
const Payment = require('../models/Payment');
const { generateReceiptPdfBuffer } = require('./pdfReceiptGenerator');

/**
 * Normalizes phone numbers to standard E.164-style country-code digits without leading '+':
 * - 10 digits (India) -> prepends '91' (e.g. 9876543210 -> 919876543210)
 * - 11 digits starting with 0 -> strips 0, prepends '91' (e.g. 09876543210 -> 919876543210)
 * - 12 digits starting with 91 -> keeps as is (919876543210)
 * - Other valid international numbers with country code (e.g. 14155552671) -> returns clean digits
 */
function formatContact(phone) {
  if (!phone) return null;
  const digits = String(phone).replace(/\D/g, '');
  if (digits.length === 10) return `91${digits}`;
  if (digits.length === 11 && digits.startsWith('0')) return `91${digits.slice(1)}`;
  if (digits.length === 12 && digits.startsWith('91')) return digits;
  if (digits.length >= 10 && digits.length <= 15) return digits;
  return null;
}

/**
 * Builds comma-separated dynamic template parameters based on param count.
 * Sanitize all fields to eliminate accidental commas that would break Meta's param delimiter.
 */
function buildTemplateParams(count = 1, { member, payment }) {
  const memberName = (member?.fullName || 'Valued Member').replace(/,/g, ' ').trim();
  const receiptId = (payment.transactionId || String(payment._id).slice(-8)).replace(/,/g, ' ').trim();
  const dateStr = new Date(payment.paymentDate || Date.now())
    .toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
    .replace(/,/g, ' ');
  const amountStr = `Rs ${Number(payment.amount || 0).toFixed(2)}`.replace(/,/g, ' ');

  const pool = [memberName, receiptId, dateStr, amountStr];

  if (count <= 1) return memberName;
  if (count === 2) return `${memberName},${receiptId}`;
  if (count === 3) return `${memberName},${receiptId},${dateStr}`;
  if (count === 4) return `${memberName},${receiptId},${amountStr},${dateStr}`;

  const params = [...pool];
  while (params.length < count) {
    params.push(memberName);
  }
  return params.slice(0, count).join(',');
}

/**
 * Uploads a PDF buffer to Cloudinary if credentials are configured.
 */
async function uploadToCloudinary(buffer, filename) {
  const { cloudName, apiKey, apiSecret, folder } = config.cloudinary || {};
  if (!cloudName || !apiKey || !apiSecret) return null;

  try {
    const timestamp = Math.round(Date.now() / 1000);
    const paramsToSign = `folder=${folder}&timestamp=${timestamp}${apiSecret}`;
    const signature = crypto.createHash('sha1').update(paramsToSign).digest('hex');

    const formData = new FormData();
    const blob = new Blob([buffer], { type: 'application/pdf' });
    formData.append('file', blob, `${filename}.pdf`);
    formData.append('api_key', apiKey);
    formData.append('timestamp', String(timestamp));
    formData.append('signature', signature);
    formData.append('folder', folder);

    const uploadRes = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/raw/upload`, {
      method: 'POST',
      body: formData,
    });

    if (!uploadRes.ok) return null;
    const json = await uploadRes.json();
    return json.secure_url || json.url || null;
  } catch {
    return null;
  }
}

/**
 * Uploads a PDF buffer to Catbox for instant, public HTTP 200 hosting.
 * Crucial when running on localhost where external WhatsApp servers cannot access localhost URLs.
 */
async function uploadToCatbox(buffer, filename) {
  try {
    const formData = new FormData();
    const blob = new Blob([buffer], { type: 'application/pdf' });
    formData.append('reqtype', 'fileupload');
    formData.append('fileToUpload', blob, filename || 'receipt.pdf');
    const res = await fetch('https://catbox.moe/user/api.php', {
      method: 'POST',
      body: formData,
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return null;
    const url = (await res.text()).trim();
    if (/^https?:\/\/files\.catbox\.moe\//i.test(url)) {
      return url;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Resolves or generates the public HTTP 200 URL for the PDF receipt.
 */
async function resolvePublicPdfUrl(payment) {
  // If payment already has a public cloud URL that is not localhost, probe it
  if (payment.pdfUrl && /^https:\/\//i.test(payment.pdfUrl) && !payment.pdfUrl.includes('localhost')) {
    try {
      const probe = await fetch(payment.pdfUrl, { method: 'HEAD', signal: AbortSignal.timeout(5000) });
      if (probe.ok) return payment.pdfUrl;
    } catch {
      // Continue to regenerate / fallback
    }
  }

  // Generate fresh PDF buffer
  const buffer = await generateReceiptPdfBuffer(payment);
  const filename = `Receipt-${payment.transactionId || payment._id}`;

  // 1. Attempt Cloudinary upload first if configured
  const cloudUrl = await uploadToCloudinary(buffer, filename);
  if (cloudUrl) return cloudUrl;

  // 2. Check if APP_URL is a publicly reachable domain (not localhost)
  const appUrl = (process.env.APP_URL || config.appUrl || '').replace(/\/+$/, '');
  const isLocalhost = !appUrl || /localhost|127\.0\.0\.1/i.test(appUrl);

  if (isLocalhost) {
    // When running on localhost, Meta WhatsApp servers cannot fetch localhost URLs.
    // Use Catbox to provide a public direct HTTPS 200 URL.
    const catboxUrl = await uploadToCatbox(buffer, `${filename}.pdf`);
    if (catboxUrl) return catboxUrl;
  }

  // 3. Fallback to direct public backend route
  const backendBase = (appUrl || 'http://localhost:5000').replace(/\/+$/, '');
  return `${backendBase}/api/payments/public/${payment._id}/receipt-pdf?download=true`;
}

/**
 * Sends a Payment Receipt PDF via Tendigit WhatsApp Cloud API.
 * Includes auto-healing for parameter count mismatches.
 *
 * @param {Object} options
 * @param {Object} options.payment Mongoose Payment document or populated object
 * @param {string} [options.contactOverride] Optional phone override
 * @param {Object} [options.memberDetails] Optional member profile override
 * @returns {Promise<{ success: boolean, contact: string, message: string, error?: string, payment: Object }>}
 */
async function sendPaymentReceiptWhatsApp({ payment, contactOverride, memberDetails }) {
  if (!payment) {
    throw new Error('Payment record is required');
  }

  const member = memberDetails || payment.member || {};
  const rawContact = contactOverride || member.mobileNumber || member.phone;
  const formattedContact = formatContact(rawContact);

  if (!formattedContact) {
    const errorMsg = `Invalid recipient mobile number: "${rawContact || 'Not provided'}". Must be a valid 10-15 digit mobile number.`;
    await Payment.findByIdAndUpdate(payment._id || payment.id, {
      $set: {
        whatsappStatus: 'Failed',
        whatsappError: errorMsg,
        whatsappRecipient: rawContact || null,
      },
    });
    return {
      success: false,
      contact: rawContact,
      message: errorMsg,
      error: errorMsg,
    };
  }

  const licenseNumber = process.env.TENDIGIT_LICENSE_NUMBER || config.whatsapp?.licenseNumber;
  const apiKey = process.env.TENDIGIT_API_KEY || config.whatsapp?.apiKey;
  const templateName = process.env.TENDIGIT_TEMPLATE_NAME || config.whatsapp?.templateName || 'Sample_bill_pdf';
  const endpoint = process.env.TENDIGIT_ENDPOINT || config.whatsapp?.endpoint || 'https://login.tendigit.in/api/sendtemplate.php';
  const targetParamCount = Number(process.env.TENDIGIT_PARAM_COUNT || config.whatsapp?.paramCount || 1);

  // Check credentials
  if (!licenseNumber || !apiKey || licenseNumber === 'your_license_number_here' || apiKey === 'your_api_key_here') {
    const configError = 'Tendigit WhatsApp API credentials not configured. Please set TENDIGIT_LICENSE_NUMBER and TENDIGIT_API_KEY in server/.env';
    await Payment.findByIdAndUpdate(payment._id || payment.id, {
      $set: {
        whatsappStatus: 'Failed',
        whatsappError: configError,
        whatsappRecipient: formattedContact,
      },
    });
    return {
      success: false,
      contact: formattedContact,
      message: configError,
      error: configError,
    };
  }

  // 1. Resolve direct public PDF URL
  let pdfUrl = await resolvePublicPdfUrl(payment);

  // 2. Prepare request runner
  const executeTendigitCall = async (paramCount) => {
    const paramString = buildTemplateParams(paramCount, { member, payment });
    const url = new URL(endpoint);
    url.searchParams.set('LicenseNumber', licenseNumber);
    url.searchParams.set('APIKey', apiKey);
    url.searchParams.set('Contact', formattedContact);
    url.searchParams.set('Template', templateName);
    url.searchParams.set('Param', paramString);
    url.searchParams.set('Fileurl', pdfUrl);

    const res = await fetch(url.toString(), {
      method: 'GET',
      headers: { Accept: 'application/json, text/plain, */*' },
      signal: AbortSignal.timeout(20000),
    });

    const text = await res.text();
    let json = null;
    try {
      json = JSON.parse(text);
    } catch {
      // Body is not JSON
    }

    const isSuccess =
      json?.ApiResponse?.toLowerCase() === 'success' ||
      json?.status?.toLowerCase() === 'success' ||
      /success/i.test(text);

    return { ok: isSuccess, status: res.status, raw: text, json };
  };

  try {
    let result = await executeTendigitCall(targetParamCount);

    // Auto-healing logic: Check if Meta/Tendigit failed because of parameter count mismatch
    if (!result.ok) {
      const match = (result.raw || '').match(/(?:expected|requires|parameter count(?: is|:)?)\s*(\d+)/i) ||
                    (result.raw || '').match(/(\d+)\s*(?:parameters? expected|params? expected)/i);
      if (match && Number(match[1]) && Number(match[1]) !== targetParamCount) {
        const healedCount = Number(match[1]);
        const retryResult = await executeTendigitCall(healedCount);
        if (retryResult.ok) {
          result = retryResult;
        }
      }
    }

    const isSuccess = result.ok;
    const errorText = isSuccess ? null : (result.json?.message || result.json?.error || result.raw || 'WhatsApp gateway error');
    const now = new Date();

    const updatedPayment = await Payment.findByIdAndUpdate(
      payment._id || payment.id,
      {
        $set: {
          pdfUrl,
          whatsappStatus: isSuccess ? 'Sent' : 'Failed',
          whatsappSentAt: isSuccess ? now : (payment.whatsappSentAt || null),
          whatsappRecipient: formattedContact,
          whatsappResponse: result.json || { raw: result.raw },
          whatsappError: errorText,
        },
      },
      { returnDocument: 'after' }
    ).populate('member', 'memberId fullName mobileNumber address');

    return {
      success: isSuccess,
      contact: formattedContact,
      message: isSuccess
        ? `Payment receipt successfully sent to +${formattedContact}`
        : `WhatsApp delivery failed: ${errorText}`,
      error: errorText,
      payment: updatedPayment || payment,
    };
  } catch (err) {
    const errorMsg = err.message || 'Network error while contacting Tendigit WhatsApp API';
    const updatedPayment = await Payment.findByIdAndUpdate(
      payment._id || payment.id,
      {
        $set: {
          pdfUrl,
          whatsappStatus: 'Failed',
          whatsappRecipient: formattedContact,
          whatsappError: errorMsg,
        },
      },
      { returnDocument: 'after' }
    ).populate('member', 'memberId fullName mobileNumber address');

    return {
      success: false,
      contact: formattedContact,
      message: `Failed to send WhatsApp receipt: ${errorMsg}`,
      error: errorMsg,
      payment: updatedPayment || payment,
    };
  }
}

module.exports = {
  formatContact,
  buildTemplateParams,
  resolvePublicPdfUrl,
  sendPaymentReceiptWhatsApp,
};
