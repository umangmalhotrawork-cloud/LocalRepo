function calculateTotal(price, quantity) {
  return price * quantity;
}

const isEligibleForDiscount = (subtotal, isVip) => {
  if (isVip) return true;
  return subtotal >= 100.0;
};

function parseItemCount(value) {
  const count = parseInt(value, 10);
  if (isNaN(count)) {
    throw new TypeError("Item count must be a valid number");
  }
  if (count < 0) {
    throw new RangeError("Item count cannot be negative");
  }
  return count;
}

const summarizeCart = (items) => {
  if (!Array.isArray(items)) {
    throw new TypeError("items must be an array");
  }
  return { total_items: items.length, items };
};

module.exports = {
  calculateTotal,
  isEligibleForDiscount,
  parseItemCount,
  summarizeCart,
};
