// BDG Verification Sample API Engine

class PaymentGateway {
  async chargeCard(amount, token) {
    const response = await fetch('https://api.stripe.com/v1/charges', {
      method: 'POST',
      body: JSON.stringify({ amount, token }),
    });
    return response.json();
  }
}

async function handleCheckout(cartId, total) {
  const gateway = new PaymentGateway();
  const result = await gateway.chargeCard(total, 'tok_visa');
  return result;
}

module.exports = { PaymentGateway, handleCheckout };
