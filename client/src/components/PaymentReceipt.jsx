import { Check, Printer, X } from 'lucide-react';

const money = value => new Intl.NumberFormat('en-IN', {
  style: 'currency', currency: 'INR', minimumFractionDigits: 2,
}).format(Number(value || 0));
const date = value => value ? new Intl.DateTimeFormat('en-IN', {
  dateStyle: 'medium', timeStyle: 'short',
}).format(new Date(value)) : '—';
const shortDate = value => value ? new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium' }).format(new Date(value)) : '—';
const title = value => String(value || '').replaceAll('_', ' ').replace(/\b\w/g, letter => letter.toUpperCase());

export default function PaymentReceipt({ payment, onClose }) {
  const member = payment.member || {};
  const membership = payment.membership || {};
  const plan = membership.membershipPlan || {};
  const issuer = payment.receiptIssuer || {};
  const refunded = payment.paymentStatus === 'refunded';

  return <div className="receipt-overlay" role="dialog" aria-modal="true" aria-label="Payment receipt">
    <article className="receipt-sheet">
      <header className="receipt-header">
        <div className="receipt-brand">
          <img src="/Gym-Logo-128.png" alt="Vino Fitness Studio" className="receipt-logo" />
          <div><strong>VINO <span>FITNESS STUDIO</span></strong><small>UNISEX FITNESS STUDIO</small></div>
        </div>
        <div className="receipt-title"><span>PAYMENT RECEIPT</span><strong>{payment.transactionId}</strong></div>
      </header>

      <section className="receipt-hero">
        <div><small>AMOUNT RECEIVED</small><strong>{money(payment.amount)}</strong><p>{title(payment.action || 'membership payment')}</p></div>
        <span className={`receipt-status ${refunded ? 'refunded' : ''}`}><Check size={16}/>{title(payment.paymentStatus)}</span>
      </section>

      <section className="receipt-parties">
        <div><small>RECEIVED FROM</small><h3>{member.fullName || 'Member'}</h3><p>{member.memberId || '—'}</p><p>{member.mobileNumber || ''}</p></div>
        <div><small>ISSUED BY</small><h3>{issuer.name || 'Vino Fitness Studio'}</h3><p>{issuer.address || ''}</p><p>{[issuer.phone, issuer.email].filter(Boolean).join(' · ')}</p></div>
      </section>

      <section className="receipt-details">
        <div><small>PAYMENT DATE</small><strong>{date(payment.paymentDate)}</strong></div>
        <div><small>PAYMENT METHOD</small><strong>{payment.paymentMethod === 'online_gateway' ? 'Razorpay' : title(payment.paymentMethod)}</strong></div>
        <div><small>GATEWAY REFERENCE</small><strong>{payment.gatewayTransactionId || 'Not applicable'}</strong></div>
        <div><small>MEMBERSHIP STATUS</small><strong>{title(membership.status || '—')}</strong></div>
      </section>

      <section className="receipt-line-items">
        <div className="receipt-row receipt-row-head"><span>DESCRIPTION</span><span>PERIOD</span><span>AMOUNT</span></div>
        <div className="receipt-row"><span><strong>{plan.name || 'Gym membership'}</strong><small>{plan.description || title(payment.action)}</small></span><span>{shortDate(membership.startDate)}<small>to {shortDate(membership.endDate)}</small></span><strong>{money(payment.amount)}</strong></div>
      </section>

      <section className="receipt-totals">
        <div><span>Membership value</span><strong>{money(membership.totalAmount || payment.amount)}</strong></div>
        <div><span>This payment</span><strong>{money(payment.amount)}</strong></div>
        <div><span>Balance after payment</span><strong>{money(membership.pendingAmount)}</strong></div>
        <div className="receipt-total"><span>Amount received</span><strong>{money(payment.amount)}</strong></div>
      </section>

      {refunded && <section className="receipt-refund"><strong>REFUNDED</strong><span>{payment.refunds?.length ? `${money(payment.refunds[0].amount)} · ${date(payment.refunds[0].processedAt)}` : money(payment.amount)}</span><p>{payment.refunds?.[0]?.reason || payment.refundReason}</p></section>}
      {payment.notes && <p className="receipt-note"><strong>Note:</strong> {payment.notes}</p>}

      <footer className="receipt-footer">
        <div><strong>Thank you for choosing Vino Fitness Studio.</strong><span>This is a computer-generated payment receipt and does not require a signature.</span></div>
        <div className="receipt-actions"><button className="outline-btn" onClick={onClose}><X size={16}/> Close</button><button className="lime-btn" onClick={() => window.print()}><Printer size={16}/> Print / Save PDF</button></div>
      </footer>
    </article>
  </div>;
}
