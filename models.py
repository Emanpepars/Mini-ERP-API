from datetime import datetime
from werkzeug.security import generate_password_hash, check_password_hash

from extensions import db
from errors import APIError


# Order status values
STATUS_PENDING = "pending"
STATUS_PAID = "paid"
STATUS_CANCELLED = "cancelled"
ORDER_STATUSES = (STATUS_PENDING, STATUS_PAID, STATUS_CANCELLED)

# User role values
ROLE_ADMIN = "admin"
ROLE_CUSTOMER = "customer"
USER_ROLES = (ROLE_ADMIN, ROLE_CUSTOMER)


class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(120), nullable=False, unique=True, index=True)
    password_hash = db.Column(db.String(255), nullable=False)
    role = db.Column(db.String(20), nullable=False, default=ROLE_CUSTOMER)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def set_password(self, raw_password):
        # Hash the password using werkzeug (no extra dependency needed)
        self.password_hash = generate_password_hash(raw_password)

    def check_password(self, raw_password):
        return check_password_hash(self.password_hash, raw_password)

    def is_admin(self):
        return self.role == ROLE_ADMIN

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "email": self.email,
            "role": self.role,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class Product(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False, index=True)
    price = db.Column(db.Float, nullable=False)
    stock = db.Column(db.Integer, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "price": self.price,
            "stock": self.stock,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class Order(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False, index=True)
    product_id = db.Column(db.Integer, db.ForeignKey("product.id"), nullable=False)
    quantity = db.Column(db.Integer, nullable=False)
    total_price = db.Column(db.Float, nullable=False)
    status = db.Column(db.String(20), nullable=False, default=STATUS_PENDING, index=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, index=True)

    user = db.relationship("User")
    product = db.relationship("Product")

    @classmethod
    def place(cls, user, product, quantity):
        # Reduce product stock when an order is placed
        if product.stock < quantity:
            raise APIError("Not enough stock available.", 400)
        order = cls(
            user_id=user.id,
            product_id=product.id,
            quantity=quantity,
            total_price=product.price * quantity,
            status=STATUS_PENDING,
        )
        product.stock -= quantity
        return order

    def mark_paid(self):
        if self.status == STATUS_PAID:
            raise APIError("Order is already paid.", 400)
        if self.status == STATUS_CANCELLED:
            raise APIError("A cancelled order cannot be paid.", 400)
        self.status = STATUS_PAID

    def cancel(self):
        if self.status == STATUS_CANCELLED:
            raise APIError("Order is already cancelled.", 400)
        # Return the stock back to the product
        self.product.stock += self.quantity
        self.status = STATUS_CANCELLED

    def restock_on_delete(self):
        # When deleting an active order, return the stock
        if self.status != STATUS_CANCELLED:
            self.product.stock += self.quantity

    def to_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "user": self.user.name if self.user else None,
            "product_id": self.product_id,
            "product": self.product.name if self.product else None,
            "quantity": self.quantity,
            "total_price": self.total_price,
            "status": self.status,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }

    def to_invoice(self):
        return {
            "invoice_number": f"INV-{self.id}",
            "order_id": self.id,
            "customer": {
                "id": self.user.id,
                "name": self.user.name,
                "email": self.user.email,
            },
            "product": {
                "id": self.product.id,
                "name": self.product.name,
                "unit_price": self.product.price,
            },
            "quantity": self.quantity,
            "total_price": self.total_price,
            "order_status": self.status,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
