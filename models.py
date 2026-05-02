from datetime import datetime
from extensions import db
from errors import APIError


STATUS_DRAFT = "draft"
STATUS_CONFIRMED = "confirmed"
STATUS_CANCELLED = "cancelled"


class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(120), nullable=False, unique=True)

    def to_dict(self):
        return {"id": self.id, "name": self.name, "email": self.email}


class Product(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    price = db.Column(db.Float, nullable=False)
    stock = db.Column(db.Integer, nullable=False)

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "price": self.price,
            "stock": self.stock,
        }


class Order(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False)
    product_id = db.Column(db.Integer, db.ForeignKey("product.id"), nullable=False)
    quantity = db.Column(db.Integer, nullable=False)
    total_price = db.Column(db.Float, nullable=False)
    status = db.Column(db.String(20), nullable=False, default=STATUS_DRAFT)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    user = db.relationship("User")
    product = db.relationship("Product")

    @classmethod
    def place(cls, user, product, quantity):
        if product.stock < quantity:
            raise APIError("Not enough stock available.", 400)
        order = cls(
            user_id=user.id,
            product_id=product.id,
            quantity=quantity,
            total_price=product.price * quantity,
        )
        product.stock -= quantity
        return order

    def confirm(self):
        if self.status == STATUS_CONFIRMED:
            raise APIError("Order is already confirmed.", 400)
        if self.status == STATUS_CANCELLED:
            raise APIError("A cancelled order cannot be confirmed.", 400)
        self.status = STATUS_CONFIRMED

    def cancel(self):
        if self.status == STATUS_CANCELLED:
            raise APIError("Order is already cancelled.", 400)
        self.product.stock += self.quantity
        self.status = STATUS_CANCELLED

    def restock_on_delete(self):
        if self.status != STATUS_CANCELLED:
            self.product.stock += self.quantity

    def to_dict(self):
        return {
            "id": self.id,
            "user": self.user.name,
            "product": self.product.name,
            "quantity": self.quantity,
            "total_price": self.total_price,
            "status": self.status,
            "created_at": self.created_at.isoformat(),
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
            "created_at": self.created_at.isoformat(),
        }
