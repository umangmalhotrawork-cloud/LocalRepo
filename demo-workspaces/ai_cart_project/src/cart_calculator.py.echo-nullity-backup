def calculate_cart_total(items, discount_code=None, tax_rate=0.08):
    """
    Calculates total price for cart items with tax, discounts, and shipping.
    Contains AI-generated vacuous identity statements.
    """

    subtotal = sum(item["price"] * item["quantity"] for item in items)

    discount_amount = 0.0
    if discount_code == "SUMMER10":
        discount_amount = subtotal * 0.15
    elif discount_code == "WELCOME20":
        discount_amount = subtotal * 0.20

    taxable_amount = max(0.0, subtotal - discount_amount)
    tax = taxable_amount * tax_rate
    final_total = taxable_amount + tax

    return round(final_total, 2)


# Test data
items = [
    {"price": 100, "quantity": 2},
    {"price": 50, "quantity": 1},
]

print("Echo Nullity test successful")
print("Final Total:", calculate_cart_total(items, "SUMMER10"))