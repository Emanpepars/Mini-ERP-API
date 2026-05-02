"""Seed the database with demo products, customers, and orders.

Run it after the app has been started at least once (so the DB exists)::

    python3 seed.py

Safe to re-run: it skips items that already exist by name/email and tops up
orders only when the orders table is empty.
"""
from datetime import datetime, timedelta
import random

from app import create_app
from extensions import db
from models import (
    User,
    Product,
    Order,
    ROLE_CUSTOMER,
    STATUS_PENDING,
    STATUS_PAID,
    STATUS_CANCELLED,
)


# Demo product catalog
DEMO_PRODUCTS = [
    {"name": "Laptop", "price": 1200.00, "stock": 15},
    {"name": "Wireless Mouse", "price": 25.50, "stock": 80},
    {"name": "Mechanical Keyboard", "price": 95.00, "stock": 30},
    {"name": "USB-C Hub", "price": 45.00, "stock": 50},
    {"name": "27\" Monitor", "price": 320.00, "stock": 12},
    {"name": "Office Chair", "price": 180.00, "stock": 8},
    {"name": "Desk Lamp", "price": 35.00, "stock": 3},          # low stock
    {"name": "Webcam HD", "price": 60.00, "stock": 2},          # low stock
    {"name": "Notebook (A5)", "price": 4.50, "stock": 200},
    {"name": "Pen Pack", "price": 6.00, "stock": 0},            # out of stock
]

# Extra demo customers (the default customer is already seeded by app.py)
DEMO_CUSTOMERS = [
    {"name": "Alice Johnson", "email": "alice@example.com", "password": "alice123"},
    {"name": "Bob Smith", "email": "bob@example.com", "password": "bob123"},
    {"name": "Carol Davis", "email": "carol@example.com", "password": "carol123"},
]


def seed_products():
    created = 0
    for data in DEMO_PRODUCTS:
        if Product.query.filter_by(name=data["name"]).first():
            continue
        db.session.add(Product(**data))
        created += 1
    db.session.commit()
    print(f"Products: {created} new, {Product.query.count()} total")


def seed_customers():
    created = 0
    for data in DEMO_CUSTOMERS:
        if User.query.filter_by(email=data["email"]).first():
            continue
        user = User(name=data["name"], email=data["email"], role=ROLE_CUSTOMER)
        user.set_password(data["password"])
        db.session.add(user)
        created += 1
    db.session.commit()
    print(f"Customers: {created} new, {User.query.count()} total users")


def seed_orders():
    """Generate a realistic spread of orders across the last few months."""
    if Order.query.count() > 0:
        print(f"Orders: skipped (already {Order.query.count()} present)")
        return

    customers = User.query.filter_by(role=ROLE_CUSTOMER).all()
    products = Product.query.filter(Product.stock > 0).all()

    if not customers or not products:
        print("Orders: skipped (need customers and products first)")
        return

    # ~70% paid, ~20% pending, ~10% cancelled — gives reports something to show
    status_pool = (
        [STATUS_PAID] * 7 + [STATUS_PENDING] * 2 + [STATUS_CANCELLED] * 1
    )

    random.seed(42)  # deterministic demo data
    now = datetime.utcnow()
    created = 0

    for _ in range(25):
        customer = random.choice(customers)
        product = random.choice(products)
        quantity = random.randint(1, min(3, max(1, product.stock)))

        if product.stock < quantity:
            continue

        # Spread orders over the last ~120 days
        days_ago = random.randint(0, 120)
        created_at = now - timedelta(days=days_ago, hours=random.randint(0, 23))
        status = random.choice(status_pool)

        order = Order(
            user_id=customer.id,
            product_id=product.id,
            quantity=quantity,
            total_price=product.price * quantity,
            status=status,
            created_at=created_at,
        )
        # Cancelled orders did not consume stock; everything else did
        if status != STATUS_CANCELLED:
            product.stock -= quantity

        db.session.add(order)
        created += 1

    db.session.commit()
    print(f"Orders: {created} new")


def main():
    app = create_app()
    with app.app_context():
        seed_products()
        seed_customers()
        seed_orders()
        print("Seed complete.")


if __name__ == "__main__":
    main()
