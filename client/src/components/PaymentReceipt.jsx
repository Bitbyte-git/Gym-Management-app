import { useState } from 'react';
import { Check, Printer, X, Send, Download, AlertCircle, Loader2, Phone } from 'lucide-react';
import api from '../services/api';

const money = (value) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
  }).format(Number(value || 0));

const date = (value) =>
  value
    ? new Intl.DateTimeFormat('en-IN', {
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(new Date(value))
    : '—';

const shortDate = (value) =>
  value
    ? new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium' }).format(new Date(value))
    : '—';

const title = (value) =>
  String(value || '')
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

export default function PaymentReceipt({ payment: initialPayment, onClose, onPaymentUpdate }) {
  const [payment, setPayment] = useState(initialPayment);
  const [isSending, setIsSending] = useState(false);
  const [feedback, setFeedback] = useState(null); // { type: 'success' | 'error', message: string }
  const [showPhonePrompt, setShowPhonePrompt] = useState(false);
  const [customPhone, setCustomPhone] = useState(
    initialPayment?.member?.mobileNumber || initialPayment?.whatsappRecipient || ''
  );

  const member = payment?.member || {};
  const membership = payment?.membership || {};
  const plan = membership?.membershipPlan || {};
  const issuer = payment?.receiptIssuer || {};
  const refunded = payment?.paymentStatus === 'refunded';

  const defaultPhone = member.mobileNumber || '';
  const currentStatus = payment?.whatsappStatus || 'Not Sent';

  const handleSendWhatsApp = async (recipientToUse) => {
    setIsSending(true);
    setFeedback(null);
    try {
      const payload = recipientToUse ? { contactOverride: recipientToUse } : {};
      const res = await api.post(`/payments/${payment._id}/send-whatsapp`, payload);

      if (res.data?.success) {
        const updated = res.data.data || { ...payment, whatsappStatus: 'Sent' };
        setPayment(updated);
        if (onPaymentUpdate) onPaymentUpdate(updated);
        setFeedback({
          type: 'success',
          message: res.data.message || `Receipt PDF sent to WhatsApp (${res.data.contact || recipientToUse || defaultPhone})!`,
        });
        setShowPhonePrompt(false);
      } else {
        throw new Error(res.data?.error || res.data?.message || 'Failed to send WhatsApp message');
      }
    } catch (err) {
      const errMsg =
        err.response?.data?.error ||
        err.response?.data?.message ||
        err.message ||
        'Failed to send receipt via WhatsApp';
      setFeedback({ type: 'error', message: errMsg });
      // Update local state if backend returned failure record
      if (err.response?.data?.data) {
        setPayment(err.response.data.data);
        if (onPaymentUpdate) onPaymentUpdate(err.response.data.data);
      }
    } finally {
      setIsSending(false);
    }
  };

  const handleTriggerSend = () => {
    if (!defaultPhone) {
      setShowPhonePrompt(true);
    } else {
      handleSendWhatsApp(defaultPhone);
    }
  };

  const downloadPdfUrl = `/api/payments/public/${payment._id}/receipt-pdf?download=true`;

  return (
    <div className="receipt-overlay" role="dialog" aria-modal="true" aria-label="Payment receipt">
      <article className="receipt-sheet">
        <header className="receipt-header">
          <div className="receipt-brand">
            <img src="/Gym-Logo-128.png" alt="Vino Fitness Studio" className="receipt-logo" />
            <div>
              <strong>
                VINO <span>FITNESS STUDIO</span>
              </strong>
              <small>UNISEX FITNESS STUDIO</small>
            </div>
          </div>
          <div className="receipt-title">
            <span>PAYMENT RECEIPT</span>
            <strong>{payment.transactionId}</strong>
          </div>
        </header>

        {/* WhatsApp Delivery Status Banner & Action Bar */}
        <section className="receipt-delivery-bar">
          <div className="receipt-delivery-info">
            <span className="receipt-delivery-label">WhatsApp Status:</span>
            <span className={`whatsapp-status-badge ${currentStatus.toLowerCase().replace(/\s+/g, '-')}`}>
              {currentStatus === 'Sent' && <Check size={13} />}
              {currentStatus === 'Failed' && <AlertCircle size={13} />}
              {currentStatus}
            </span>
            {payment.whatsappSentAt && (
              <small className="receipt-delivery-date">
                Sent: {date(payment.whatsappSentAt)}
              </small>
            )}
            {payment.whatsappRecipient && (
              <small className="receipt-delivery-recipient">
                To: +{payment.whatsappRecipient}
              </small>
            )}
          </div>

          <div className="receipt-delivery-actions">
            <a
              href={downloadPdfUrl}
              target="_blank"
              rel="noreferrer"
              className="outline-btn receipt-pdf-download-btn"
              title="Download official PDF receipt file"
            >
              <Download size={14} /> Download PDF
            </a>
            <button
              type="button"
              className="whatsapp-btn"
              onClick={handleTriggerSend}
              disabled={isSending}
              title="Send official receipt PDF to member's WhatsApp"
            >
              {isSending ? (
                <>
                  <Loader2 size={15} className="spin" /> Sending...
                </>
              ) : (
                <>
                  <Send size={15} /> {currentStatus === 'Sent' ? 'Resend WhatsApp' : 'Send WhatsApp Receipt'}
                </>
              )}
            </button>
            <button
              type="button"
              className="ghost-btn receipt-phone-edit-btn"
              onClick={() => setShowPhonePrompt(true)}
              title="Change recipient WhatsApp phone number"
            >
              <Phone size={13} />
            </button>
          </div>
        </section>

        {/* Feedback Alert */}
        {feedback && (
          <div className={`receipt-feedback-alert ${feedback.type}`}>
            {feedback.type === 'success' ? <Check size={16} /> : <AlertCircle size={16} />}
            <span>{feedback.message}</span>
            <button
              type="button"
              className="receipt-feedback-close"
              onClick={() => setFeedback(null)}
            >
              <X size={14} />
            </button>
          </div>
        )}

        {/* Custom Phone Number Modal */}
        {showPhonePrompt && (
          <div className="receipt-phone-dialog">
            <div className="receipt-phone-box">
              <h4>Specify WhatsApp Recipient Number</h4>
              <p>Enter the 10-digit mobile number (or with country code) to receive the receipt PDF.</p>
              <input
                type="tel"
                value={customPhone}
                onChange={(e) => setCustomPhone(e.target.value)}
                placeholder="e.g. 9876543210 or 919876543210"
                className="receipt-phone-input"
                autoFocus
              />
              <div className="receipt-phone-actions">
                <button
                  type="button"
                  className="ghost-btn"
                  onClick={() => setShowPhonePrompt(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="whatsapp-btn"
                  onClick={() => handleSendWhatsApp(customPhone)}
                  disabled={!customPhone || isSending}
                >
                  {isSending ? 'Sending...' : 'Confirm & Send'}
                </button>
              </div>
            </div>
          </div>
        )}

        <section className="receipt-hero">
          <div>
            <small>AMOUNT RECEIVED</small>
            <strong>{money(payment.amount)}</strong>
            <p>{title(payment.action || 'membership payment')}</p>
          </div>
          <span className={`receipt-status ${refunded ? 'refunded' : ''}`}>
            <Check size={16} />
            {title(payment.paymentStatus)}
          </span>
        </section>

        <section className="receipt-parties">
          <div>
            <small>RECEIVED FROM</small>
            <h3>{member.fullName || 'Member'}</h3>
            <p>{member.memberId || '—'}</p>
            <p>{member.mobileNumber || ''}</p>
          </div>
          <div>
            <small>ISSUED BY</small>
            <h3>{issuer.name || 'Vino Fitness Studio'}</h3>
            <p>{issuer.address || ''}</p>
            <p>{[issuer.phone, issuer.email].filter(Boolean).join(' · ')}</p>
          </div>
        </section>

        <section className="receipt-details">
          <div>
            <small>PAYMENT DATE</small>
            <strong>{date(payment.paymentDate)}</strong>
          </div>
          <div>
            <small>PAYMENT METHOD</small>
            <strong>
              {payment.paymentMethod === 'online_gateway' ? 'Razorpay' : title(payment.paymentMethod)}
            </strong>
          </div>
          <div>
            <small>GATEWAY REFERENCE</small>
            <strong>{payment.gatewayTransactionId || 'Not applicable'}</strong>
          </div>
          <div>
            <small>MEMBERSHIP STATUS</small>
            <strong>{title(membership.status || '—')}</strong>
          </div>
        </section>

        <section className="receipt-line-items">
          <div className="receipt-row receipt-row-head">
            <span>DESCRIPTION</span>
            <span>PERIOD</span>
            <span>AMOUNT</span>
          </div>
          <div className="receipt-row">
            <span>
              <strong>{plan.name || 'Gym membership'}</strong>
              <small>{plan.description || title(payment.action)}</small>
            </span>
            <span>
              {shortDate(membership.startDate)}
              <small>to {shortDate(membership.endDate)}</small>
            </span>
            <strong>{money(payment.amount)}</strong>
          </div>
        </section>

        <section className="receipt-totals">
          <div>
            <span>Membership value</span>
            <strong>{money(membership.totalAmount || payment.amount)}</strong>
          </div>
          <div>
            <span>This payment</span>
            <strong>{money(payment.amount)}</strong>
          </div>
          <div>
            <span>Balance after payment</span>
            <strong>{money(membership.pendingAmount)}</strong>
          </div>
          <div className="receipt-total">
            <span>Amount received</span>
            <strong>{money(payment.amount)}</strong>
          </div>
        </section>

        {refunded && (
          <section className="receipt-refund">
            <strong>REFUNDED</strong>
            <span>
              {payment.refunds?.length
                ? `${money(payment.refunds[0].amount)} · ${date(payment.refunds[0].processedAt)}`
                : money(payment.amount)}
            </span>
            <p>{payment.refunds?.[0]?.reason || payment.refundReason}</p>
          </section>
        )}
        {payment.notes && (
          <p className="receipt-note">
            <strong>Note:</strong> {payment.notes}
          </p>
        )}

        <footer className="receipt-footer">
          <div>
            <strong>Thank you for choosing Vino Fitness Studio.</strong>
            <span>This is a computer-generated payment receipt and does not require a signature.</span>
          </div>
          <div className="receipt-actions">
            <button className="outline-btn" onClick={onClose}>
              <X size={16} /> Close
            </button>
            <button className="lime-btn" onClick={() => window.print()}>
              <Printer size={16} /> Print / Save PDF
            </button>
          </div>
        </footer>
      </article>
    </div>
  );
}
