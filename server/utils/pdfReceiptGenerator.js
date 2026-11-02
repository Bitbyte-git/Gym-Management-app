const PDFDocument = require('pdfkit');
const config = require('../config/env');

const formatMoney = (amount = 0) => {
  return `INR ${Number(amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const formatDate = (dateStr) => {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

const formatDateTime = (dateStr) => {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
};

/**
 * Generates an elegant, printable A4 PDF receipt buffer for a given payment record.
 * @param {Object} payment Populated payment object
 * @returns {Promise<Buffer>}
 */
function generateReceiptPdfBuffer(payment) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margin: 40,
        info: {
          Title: `Receipt-${payment.transactionId || payment._id}`,
          Author: config.gym?.name || 'Vino Fitness Studio',
          Subject: 'Payment Receipt',
        },
      });

      const buffers = [];
      doc.on('data', chunk => buffers.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', err => reject(err));

      const member = payment.member || {};
      const membership = payment.membership || {};
      const plan = membership.membershipPlan || {};
      const gym = config.gym || {};
      const isRefunded = payment.paymentStatus === 'refunded';

      const primaryColor = '#0f172a';
      const secondaryColor = '#475569';
      const accentGreen = '#16a34a';
      const lightBg = '#f8fafc';
      const borderColor = '#e2e8f0';

      // --- HEADER ---
      doc.rect(40, 40, 515, 65).fill(lightBg).stroke(borderColor);

      doc.fillColor(primaryColor).fontSize(18).font('Helvetica-Bold')
        .text((gym.name || 'VINO FITNESS STUDIO').toUpperCase(), 55, 52);
      doc.fillColor(secondaryColor).fontSize(9).font('Helvetica')
        .text('UNISEX FITNESS STUDIO · OFFICIAL PAYMENT RECEIPT', 55, 74);

      doc.fillColor(primaryColor).fontSize(13).font('Helvetica-Bold')
        .text('PAYMENT RECEIPT', 380, 52, { align: 'right', width: 160 });
      doc.fillColor(secondaryColor).fontSize(9).font('Helvetica')
        .text(`ID: ${payment.transactionId || String(payment._id).slice(-8).toUpperCase()}`, 380, 72, { align: 'right', width: 160 });

      // --- STATUS BANNER ---
      const statusTop = 115;
      const statusColor = isRefunded ? '#dc2626' : (payment.paymentStatus === 'completed' ? accentGreen : '#d97706');
      const statusText = (isRefunded ? 'REFUNDED' : (payment.paymentStatus === 'completed' ? 'PAID & VERIFIED' : payment.paymentStatus || 'PENDING')).toUpperCase();

      doc.rect(40, statusTop, 515, 28).fillAndStroke('#f1f5f9', borderColor);
      doc.fillColor(statusColor).fontSize(10).font('Helvetica-Bold')
        .text(`STATUS: ${statusText}`, 55, statusTop + 8);
      doc.fillColor(primaryColor).fontSize(12).font('Helvetica-Bold')
        .text(`AMOUNT: ${formatMoney(payment.amount)}`, 350, statusTop + 7, { align: 'right', width: 190 });

      // --- PARTIES (RECEIVED FROM & ISSUED BY) ---
      const partiesTop = 155;
      // Member Box
      doc.rect(40, partiesTop, 250, 95).fillAndStroke('#ffffff', borderColor);
      doc.fillColor(secondaryColor).fontSize(8).font('Helvetica-Bold').text('RECEIVED FROM (MEMBER)', 52, partiesTop + 10);
      doc.fillColor(primaryColor).fontSize(11).font('Helvetica-Bold').text(member.fullName || 'Member', 52, partiesTop + 24);
      doc.fillColor(secondaryColor).fontSize(9).font('Helvetica')
        .text(`Member ID: ${member.memberId || '—'}`, 52, partiesTop + 40)
        .text(`Contact: ${member.mobileNumber || '—'}`, 52, partiesTop + 54)
        .text(`Address: ${member.address || '—'}`, 52, partiesTop + 68, { width: 230, ellipsis: true });

      // Issuer Box
      doc.rect(305, partiesTop, 250, 95).fillAndStroke('#ffffff', borderColor);
      doc.fillColor(secondaryColor).fontSize(8).font('Helvetica-Bold').text('ISSUED BY', 317, partiesTop + 10);
      doc.fillColor(primaryColor).fontSize(11).font('Helvetica-Bold').text(gym.name || 'Vino Fitness Studio', 317, partiesTop + 24);
      doc.fillColor(secondaryColor).fontSize(9).font('Helvetica')
        .text(`Address: ${gym.address || 'MG Road, Bengaluru'}`, 317, partiesTop + 40, { width: 230 })
        .text(`Phone: ${gym.phone || '+91 98765 43210'}`, 317, partiesTop + 54)
        .text(`Email: ${gym.email || 'support@vinofitness.com'}`, 317, partiesTop + 68);

      // --- PAYMENT METADATA GRID ---
      const metaTop = 262;
      doc.rect(40, metaTop, 515, 42).fillAndStroke(lightBg, borderColor);

      const colW = 515 / 4;
      // Col 1: Date
      doc.fillColor(secondaryColor).fontSize(8).font('Helvetica').text('PAYMENT DATE', 45, metaTop + 8);
      doc.fillColor(primaryColor).fontSize(9).font('Helvetica-Bold').text(formatDateTime(payment.paymentDate), 45, metaTop + 20, { width: colW - 10 });

      // Col 2: Method
      const methodLabel = payment.paymentMethod === 'online_gateway' ? 'Online (Razorpay)' : (payment.paymentMethod || 'Cash').toUpperCase();
      doc.fillColor(secondaryColor).fontSize(8).font('Helvetica').text('PAYMENT METHOD', 40 + colW, metaTop + 8);
      doc.fillColor(primaryColor).fontSize(9).font('Helvetica-Bold').text(methodLabel, 40 + colW, metaTop + 20);

      // Col 3: Action
      const actionLabel = (payment.action || 'new_membership').replace(/_/g, ' ').toUpperCase();
      doc.fillColor(secondaryColor).fontSize(8).font('Helvetica').text('PURPOSE', 40 + colW * 2, metaTop + 8);
      doc.fillColor(primaryColor).fontSize(9).font('Helvetica-Bold').text(actionLabel, 40 + colW * 2, metaTop + 20);

      // Col 4: Gateway Ref
      const refId = payment.gatewayTransactionId || payment.transactionId || 'N/A';
      doc.fillColor(secondaryColor).fontSize(8).font('Helvetica').text('REFERENCE ID', 40 + colW * 3, metaTop + 8);
      doc.fillColor(primaryColor).fontSize(9).font('Helvetica-Bold').text(refId, 40 + colW * 3, metaTop + 20, { width: colW - 10, ellipsis: true });

      // --- LINE ITEMS TABLE ---
      const tableTop = 316;
      doc.rect(40, tableTop, 515, 24).fill(primaryColor);
      doc.fillColor('#ffffff').fontSize(9).font('Helvetica-Bold')
        .text('DESCRIPTION', 55, tableTop + 7)
        .text('MEMBERSHIP PERIOD', 270, tableTop + 7)
        .text('AMOUNT', 450, tableTop + 7, { align: 'right', width: 90 });

      const itemTop = tableTop + 24;
      doc.rect(40, itemTop, 515, 48).fillAndStroke('#ffffff', borderColor);

      const planName = plan.name || 'Gym Membership Access';
      const planDesc = plan.description || (payment.action ? payment.action.replace(/_/g, ' ') : 'Standard Access');
      doc.fillColor(primaryColor).fontSize(10).font('Helvetica-Bold').text(planName, 55, itemTop + 10);
      doc.fillColor(secondaryColor).fontSize(8).font('Helvetica').text(planDesc, 55, itemTop + 24, { width: 200, ellipsis: true });

      const periodText = membership.startDate && membership.endDate
        ? `${formatDate(membership.startDate)} - ${formatDate(membership.endDate)}`
        : 'Active Plan';
      doc.fillColor(primaryColor).fontSize(9).font('Helvetica').text(periodText, 270, itemTop + 15);

      doc.fillColor(primaryColor).fontSize(10).font('Helvetica-Bold')
        .text(formatMoney(payment.amount), 450, itemTop + 15, { align: 'right', width: 90 });

      // --- SUMMARY & TOTALS ---
      const totalsTop = itemTop + 56;
      const totalBoxW = 220;
      const totalBoxX = 555 - totalBoxW;

      doc.rect(totalBoxX, totalsTop, totalBoxW, 75).fillAndStroke(lightBg, borderColor);

      const totalAmount = membership.totalAmount || payment.amount;
      const pendingAmount = membership.pendingAmount !== undefined ? membership.pendingAmount : 0;

      doc.fillColor(secondaryColor).fontSize(9).font('Helvetica')
        .text('Total Membership Plan:', totalBoxX + 12, totalsTop + 10)
        .text(formatMoney(totalAmount), totalBoxX + 110, totalsTop + 10, { align: 'right', width: 98 });

      doc.fillColor(secondaryColor).fontSize(9).font('Helvetica')
        .text('Pending Balance:', totalBoxX + 12, totalsTop + 26)
        .text(formatMoney(pendingAmount), totalBoxX + 110, totalsTop + 26, { align: 'right', width: 98 });

      doc.rect(totalBoxX, totalsTop + 44, totalBoxW, 31).fill(accentGreen);
      doc.fillColor('#ffffff').fontSize(10).font('Helvetica-Bold')
        .text('AMOUNT RECEIVED', totalBoxX + 12, totalsTop + 54)
        .text(formatMoney(payment.amount), totalBoxX + 110, totalsTop + 54, { align: 'right', width: 98 });

      // Left-side notes / payment summary info
      if (payment.notes) {
        doc.rect(40, totalsTop, 285, 75).fillAndStroke(lightBg, borderColor);
        doc.fillColor(secondaryColor).fontSize(8).font('Helvetica-Bold').text('NOTES', 50, totalsTop + 8);
        doc.fillColor(primaryColor).fontSize(9).font('Helvetica').text(payment.notes, 50, totalsTop + 22, { width: 265 });
      }

      // --- FOOTER ---
      const footerTop = 460;
      doc.strokeColor(borderColor).lineWidth(1).moveTo(40, footerTop).lineTo(555, footerTop).stroke();

      doc.fillColor(secondaryColor).fontSize(8).font('Helvetica')
        .text('This is a computer-generated receipt issued by Vino Fitness Studio and does not require a physical signature.', 40, footerTop + 10, { align: 'center', width: 515 });
      doc.fillColor(secondaryColor).fontSize(7).font('Helvetica')
        .text('For queries regarding this receipt, please contact management or reception. Keep this copy for your records.', 40, footerTop + 22, { align: 'center', width: 515 });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

module.exports = { generateReceiptPdfBuffer };
