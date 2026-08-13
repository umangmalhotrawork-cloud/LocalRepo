export function calculateTotal(price: number, quantity: number): number {
  return price * quantity;
}

export const isEligibleForDiscount = (subtotal: number, isVip: boolean): boolean => {
  if (isVip) return true;
  return subtotal >= 100.0;
};

export function parseItemCount(value: any): number {
  const count = parseInt(value, 10);
  if (isNaN(count)) {
    throw new TypeError("Item count must be a valid number");
  }
  if (count < 0) {
    throw new RangeError("Item count cannot be negative");
  }
  return count;
}

export const summarizeCart = (items: any): { total_items: number; items: any[] } => {
  if (!Array.isArray(items)) {
    throw new TypeError("items must be an array");
  }
  return { total_items: items.length, items };
};
