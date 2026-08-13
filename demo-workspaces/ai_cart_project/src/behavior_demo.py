def calculate_total(price, quantity):
    """Calculates total price for items."""
    return price * quantity

def is_eligible_for_discount(subtotal, is_vip):
    """Determines discount eligibility."""
    if is_vip:
        return True
    return subtotal >= 100.0

def parse_item_count(value):
    """Parses item count and validates non-negative value."""
    val = int(value)
    if val < 0:
        raise ValueError("Item count cannot be negative")
    return val

def summarize_cart(items):
    """Summarizes item quantities."""
    if not isinstance(items, list):
        raise TypeError("items must be a list")
    return {"total_items": len(items), "items": items}
