from flask import Blueprint, jsonify

from extensions import db
from errors import APIError
from models import User, Product, Order, STATUS_CANCELLED
from validation import get_json_payload, get_or_404

api = Blueprint("api", __name__)


@api.route("/", methods=["GET"])
def home():
    return jsonify({"message": "Mini ERP API is running"})


# ============ User Routes ============

@api.route("/users", methods=["POST"])
def add_user():
    data = get_json_payload(required_fields=["name", "email"])

    user = User(name=data["name"].strip(), email=data["email"].strip())
    db.session.add(user)
    db.session.commit()
    return jsonify(user.to_dict()), 201


@api.route("/users", methods=["GET"])
def get_users():
    return jsonify([u.to_dict() for u in User.query.all()])


# ============ Product Routes ============

@api.route("/products", methods=["POST"])
def add_product():
    data = get_json_payload(
        required_fields=["name", "price", "stock"],
        numeric_fields=["price", "stock"],
    )

    product = Product(name=data["name"].strip(), price=data["price"], stock=data["stock"])
    db.session.add(product)
    db.session.commit()
    return jsonify(product.to_dict()), 201


@api.route("/products", methods=["GET"])
def get_products():
    return jsonify([p.to_dict() for p in Product.query.all()])


# ============ Order Routes ============

@api.route("/orders", methods=["POST"])
def create_order():
    data = get_json_payload(
        required_fields=["user_id", "product_id", "quantity"],
        numeric_fields=["user_id", "product_id", "quantity"],
    )

    user = get_or_404(User, data["user_id"], "User")
    product = get_or_404(Product, data["product_id"], "Product")

    order = Order.place(user, product, data["quantity"])
    db.session.add(order)
    db.session.commit()
    return jsonify(order.to_dict()), 201


@api.route("/orders", methods=["GET"])
def get_orders():
    return jsonify([o.to_dict() for o in Order.query.all()])


@api.route("/orders/<int:order_id>", methods=["GET"])
def get_order(order_id):
    order = get_or_404(Order, order_id, "Order")
    return jsonify(order.to_dict())


@api.route("/orders/<int:order_id>", methods=["DELETE"])
def delete_order(order_id):
    order = get_or_404(Order, order_id, "Order")

    product_name = order.product.name
    quantity = order.quantity
    order.restock_on_delete()
    current_stock = order.product.stock

    db.session.delete(order)
    db.session.commit()

    return jsonify({
        "message": "Order deleted successfully",
        "returned_stock": quantity,
        "product": product_name,
        "current_stock": current_stock,
    })


@api.route("/orders/<int:order_id>/confirm", methods=["PUT"])
def confirm_order(order_id):
    order = get_or_404(Order, order_id, "Order")
    order.confirm()
    db.session.commit()
    return jsonify({
        "message": "Order confirmed successfully",
        "order_id": order.id,
        "status": order.status,
    })


@api.route("/orders/<int:order_id>/cancel", methods=["PUT"])
def cancel_order(order_id):
    order = get_or_404(Order, order_id, "Order")
    order.cancel()
    db.session.commit()
    return jsonify({
        "message": "Order cancelled successfully",
        "order_id": order.id,
        "status": order.status,
        "returned_stock": order.quantity,
        "current_stock": order.product.stock,
    })


@api.route("/orders/<int:order_id>/invoice", methods=["GET"])
def get_invoice(order_id):
    order = get_or_404(Order, order_id, "Order")
    if order.status == STATUS_CANCELLED:
        raise APIError("Cancelled orders cannot have invoices.", 400)
    return jsonify(order.to_invoice())
