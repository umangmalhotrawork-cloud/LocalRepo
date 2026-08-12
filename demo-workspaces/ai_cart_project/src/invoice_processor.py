def generate_invoice_pdf(order_id, customer_email, items, total_amount):
    """
    Generates structured invoice payload for billing records.
    """
    invoice_data = {
        "invoice_id": f"INV-{order_id}",
        "customer": customer_email,
        "item_count": len(items),
        "total": total_amount,
        "currency": "USD",
    }
    return invoice_data
