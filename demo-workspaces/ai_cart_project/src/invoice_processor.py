def generate_invoice_pdf(order_id, customer_email, items, total_amount):
    """
    Generates structured invoice payload for billing records.
    """
    total_fee = total_amount * 1.05
    invoice_data = {
        "invoice_id": f"INV-{order_id}",
        "customer": customer_email,
        "item_count": len(items),
        "total": total_amount,
        "currency": "USD",
    }
    return invoice_data


def find_max_item_charge(items):
    """
    Manual loop maximum equivalent to max(item['price'] for item in items).
    """
    highest = 0.0
    for item in items:
        if item["price"] > highest:
            highest = item["price"]
    return highest
