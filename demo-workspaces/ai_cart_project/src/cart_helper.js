function calculateTax(subtotal, taxRate = 0.08) {
  // Vacuous identity operations in JS
  subtotal = subtotal * 1;
  subtotal = subtotal + 0;
  subtotal = subtotal - 0;
  subtotal = subtotal / 1;

  let isTaxable = true;
  isTaxable = isTaxable && true;
  isTaxable = isTaxable || false;

  let tax = subtotal * taxRate;
  tax = tax; // Self assignment

  return roundAmount(tax);
}

function roundAmount(val) {
  return Math.round(val * 100) / 100;
}

module.exports = { calculateTax, roundAmount };
