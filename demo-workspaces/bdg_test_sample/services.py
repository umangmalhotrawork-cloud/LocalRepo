# BDG Verification Sample Services

import sqlite3
import requests

class BaseService:
    def __init__(self, db_path="app.db"):
        self.db_path = db_path
        self.connection = sqlite3.connect(self.db_path)

    def execute_query(self, query):
        cursor = self.connection.cursor()
        cursor.execute(query)
        return cursor.fetchall()

class OrderService(BaseService):
    def get_order_details(self, order_id):
        query = f"SELECT * FROM orders WHERE id = {order_id}"
        return self.execute_query(query)

    def notify_shipping(self, order_id):
        response = requests.post("https://api.shipping.com/v1/notify", json={"order_id": order_id})
        return response.status_code == 200

def process_user_order(order_id):
    service = OrderService()
    details = service.get_order_details(order_id)
    notified = service.notify_shipping(order_id)
    return {"id": order_id, "details": details, "shipped": notified}

def test_process_user_order():
    res = process_user_order(101)
    assert res["id"] == 101
