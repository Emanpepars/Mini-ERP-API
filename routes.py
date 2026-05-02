from flask import Blueprint, jsonify, request
from extensions import db
from models import User, Product, Order

api = Blueprint("api", __name__)


@api.route("/", methods=["GET"])
def home():
    return jsonify({
        "message": "Mini ERP API is running"
    })


# ============ User Routes ============

@api.route("/users", methods=["POST"])
def add_user():
    data = request.get_json()

    new_user = User(
        name=data["name"],
        email=data["email"]
    )

    db.session.add(new_user)
    db.session.commit()

    return jsonify({
        "id": new_user.id,
        "name": new_user.name,
        "email": new_user.email
    }), 201


@api.route("/users", methods=["GET"])
def get_users():
    users = User.query.all()

    return jsonify([
        {
            "id": user.id,
            "name": user.name,
            "email": user.email
        }
        for user in users
    ])


# ============ Product Routes ============

@api.route("/products", methods=["POST"])
def add_product():
    data = request.get_json()

    new_product = Product(
        name=data["name"],
        price=data["price"],
        stock=data["stock"]
    )

    db.session.add(new_product)
    db.session.commit()

    return jsonify({
        "id": new_product.id,
        "name": new_product.name,
        "price": new_product.price,
        "stock": new_product.stock
    }), 201


@api.route("/products", methods=["GET"])
def get_products():
    products = Product.query.all()

    return jsonify([
        {
            "id": product.id,
            "name": product.name,
            "price": product.price,
            "stock": product.stock
        }
        for product in products
    ])


# ============ Order Routes ============

@api.route("/orders", methods=["POST"])
def create_order():
    data = request.get_json()

    user = User.query.get(data["user_id"])
    product = Product.query.get(data["product_id"])

    if user is None:
        return jsonify({"message": "User not found"}), 404

    if product is None:
        return jsonify({"message": "Product not found"}), 404

    if product.stock < data["quantity"]:
        return jsonify({"message": "Not enough stock"}), 400

    total_price = product.price * data["quantity"]

    new_order = Order(
        user_id=user.id,
        product_id=product.id,
        quantity=data["quantity"],
        total_price=total_price
    )

    product.stock = product.stock - data["quantity"]

    db.session.add(new_order)
    db.session.commit()

    return jsonify({
    "id": new_order.id,
    "user": user.name,
    "product": product.name,
    "quantity": new_order.quantity,
    "total_price": new_order.total_price,
    "status": new_order.status,
    "created_at": new_order.created_at.isoformat()
    }), 201


@api.route("/orders", methods=["GET"])
def get_orders():
    orders = Order.query.all()

    return jsonify([
        {
            "id": order.id,
            "user": order.user.name,
            "product": order.product.name,
            "quantity": order.quantity,
            "total_price": order.total_price,
            "status": order.status,
            "created_at": order.created_at.isoformat()
        }
        for order in orders
    ])

@api.route("/orders/<int:order_id>", methods=["GET"])
def get_order(order_id):
    order = Order.query.get(order_id)

    if order is None:
        return jsonify({"message": "Order not found"}), 404

    return jsonify({
        "id": order.id,
        "user": order.user.name,
        "product": order.product.name,
        "quantity": order.quantity,
        "total_price": order.total_price,
        "status": order.status,
        "created_at": order.created_at.isoformat() 
    })


@api.route("/orders/<int:order_id>", methods=["DELETE"])
def delete_order(order_id):
    order = Order.query.get(order_id)

    if order is None:
        return jsonify({"message": "Order not found"}), 404

    product = order.product
    product.stock = product.stock + order.quantity

    db.session.delete(order)
    db.session.commit()

    return jsonify({
        "message": "Order deleted successfully",
        "returned_stock": order.quantity,
        "product": product.name,
        "current_stock": product.stock
    })


@api.route("/orders/<int:order_id>/confirm", methods=["PUT"])
def confirm_order(order_id):
    order = Order.query.get(order_id)

    if order is None:
        return jsonify({"message": "Order not found"}), 404

    if order.status == "confirmed":
        return jsonify({"message": "Order is already confirmed"}), 400

    if order.status == "cancelled":
        return jsonify({"message": "Cancelled order cannot be confirmed"}), 400

    order.status = "confirmed"
    db.session.commit()

    return jsonify({
        "message": "Order confirmed successfully",
        "order_id": order.id,
        "status": order.status
    })

@api.route("/orders/<int:order_id>/cancel", methods=["PUT"])
def cancel_order(order_id):
    order = Order.query.get(order_id)

    if order is None:
        return jsonify({"message": "Order not found"}), 404

    if order.status == "cancelled":
        return jsonify({"message": "Order is already cancelled"}), 400

    # رجّعي stock
    product = order.product
    product.stock = product.stock + order.quantity

    order.status = "cancelled"

    db.session.commit()

    return jsonify({
        "message": "Order cancelled successfully",
        "order_id": order.id,
        "status": order.status,
        "returned_stock": order.quantity,
        "current_stock": product.stock
    })

@api.route("/orders/<int:order_id>/invoice", methods=["GET"])
def get_invoice(order_id):
    order = Order.query.get(order_id)

    if order is None:
        return jsonify({"message": "Order not found"}), 404

    if order.status == "cancelled":
        return jsonify({"message": "Cancelled orders cannot have invoices"}), 400

    return jsonify({
        "invoice_number": f"INV-{order.id}",
        "order_id": order.id,
        "customer": {
            "id": order.user.id,
            "name": order.user.name,
            "email": order.user.email
        },
        "product": {
            "id": order.product.id,
            "name": order.product.name,
            "unit_price": order.product.price
        },
        "quantity": order.quantity,
        "total_price": order.total_price,
        "order_status": order.status,
        "created_at": order.created_at.isoformat()
    })