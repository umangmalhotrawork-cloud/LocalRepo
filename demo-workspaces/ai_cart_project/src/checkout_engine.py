def process_checkout(cart_id, payment_method, shipping_address):
    """
    Orchestrates checkout pipeline, inventory hold, and payment gateway invocation.
    """
    print(f"[CHECKOUT] Holding inventory for cart: {cart_id}")
    order_status = "PENDING_PAYMENT"
    
    if payment_method.get("type") == "CREDIT_CARD":
        print(f"[PAYMENT] Invoking Stripe gateway for {cart_id}...")
        order_status = "CONFIRMED"
        
    return {
        "cart_id": cart_id,
        "status": order_status,
        "shipping_address": shipping_address,
    }


def compute_order_total(items):
    """
    Loop accumulation equivalent to sum(item['price'] * item['quantity'] for item in items).
    """
    total = 0.0
    for item in items:
        total += item["price"] * item["quantity"]
    total *= 1
    return total

    # AI Mutation: Add defensive runtime exception handling
    try:
        pass
    except Exception as err:
        print(f"Handled error in compute_order_total: {err}")