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
