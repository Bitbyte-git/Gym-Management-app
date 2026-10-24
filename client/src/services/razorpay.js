let scriptPromise;

const loadRazorpay = () => {
  if (window.Razorpay) return Promise.resolve();
  if (!scriptPromise) {
    scriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.async = true;
      script.onload = resolve;
      script.onerror = () => reject(new Error('Unable to load Razorpay Checkout'));
      document.head.appendChild(script);
    });
  }
  return scriptPromise;
};

export const openRazorpayCheckout = async (order) => {
  await loadRazorpay();
  return new Promise((resolve, reject) => {
    let completed = false;
    const checkout = new window.Razorpay({
      key: order.keyId,
      order_id: order.orderId,
      amount: order.amount,
      currency: order.currency,
      name: order.name,
      description: order.description,
      theme: { color: '#c9ff18' },
      handler: (response) => {
        completed = true;
        resolve(response);
      },
      modal: {
        ondismiss: () => {
          if (!completed) reject(new Error('Payment window closed'));
        },
      },
    });
    checkout.on('payment.failed', (response) => reject(new Error(response.error?.description || 'Payment failed')));
    checkout.open();
  });
};
