from datetime import timedelta
from flask import Blueprint, g, jsonify, request
from sqlalchemy import func, or_

from extensions import db
from errors import APIError
from auth import token_required, admin_required, generate_token
from models import (
    User,
    Product,
    Order,
    STATUS_PAID,
    STATUS_CANCELLED,
    ORDER_STATUSES,
    ROLE_CUSTOMER,
    USER_ROLES,
)
from validation import (
    get_json_payload,
    get_or_404,
    paginate,
    parse_date,
)

api = Blueprint("api", __name__)


@api.route("/", methods=["GET"])
def home():
    return jsonify({"message": "Mini ERP API is running"})


# ============ Auth Routes ============

@api.route("/auth/register", methods=["POST"])
def register():
    """Public registration. New users are created as customers by default."""
    data = get_json_payload(required_fields=["name", "email", "password"])

    email = data["email"].strip().lower()
    if User.query.filter_by(email=email).first():
        raise APIError("Email is already registered.", 409)

    if len(data["password"]) < 6:
        raise APIError("Password must be at least 6 characters.", 400)

    user = User(name=data["name"].strip(), email=email, role=ROLE_CUSTOMER)
    user.set_password(data["password"])
    db.session.add(user)
    db.session.commit()

    token = generate_token(user)
    return jsonify({"user": user.to_dict(), "token": token}), 201


@api.route("/auth/login", methods=["POST"])
def login():
    data = get_json_payload(required_fields=["email", "password"])
    email = data["email"].strip().lower()

    user = User.query.filter_by(email=email).first()
    if user is None or not user.check_password(data["password"]):
        raise APIError("Invalid email or password.", 401)

    token = generate_token(user)
    return jsonify({"user": user.to_dict(), "token": token})


@api.route("/auth/me", methods=["GET"])
@token_required
def me():
    return jsonify(g.current_user.to_dict())


# ============ User Routes (admin-only) ============

@api.route("/users", methods=["POST"])
@admin_required
def add_user():
    """Admin can create users with any role."""
    data = get_json_payload(required_fields=["name", "email", "password"])

    role = data.get("role", ROLE_CUSTOMER)
    if role not in USER_ROLES:
        raise APIError(f"'role' must be one of {list(USER_ROLES)}.", 400)

    email = data["email"].strip().lower()
    if User.query.filter_by(email=email).first():
        raise APIError("Email is already registered.", 409)

    if len(data["password"]) < 6:
        raise APIError("Password must be at least 6 characters.", 400)

    user = User(name=data["name"].strip(), email=email, role=role)
    user.set_password(data["password"])
    db.session.add(user)
    db.session.commit()
    return jsonify(user.to_dict()), 201


@api.route("/users", methods=["GET"])
@admin_required
def get_users():
    """Paginated user list with optional search and role filter."""
    query = User.query

    search = request.args.get("search")
    if search:
        like = f"%{search.strip()}%"
        query = query.filter(or_(User.name.ilike(like), User.email.ilike(like)))

    role = request.args.get("role")
    if role:
        if role not in USER_ROLES:
            raise APIError(f"'role' must be one of {list(USER_ROLES)}.", 400)
        query = query.filter(User.role == role)

    query = query.order_by(User.id.asc())
    return jsonify(paginate(query))


# ============ Product Routes ============

@api.route("/products", methods=["POST"])
@admin_required
def add_product():
    data = get_json_payload(
        required_fields=["name", "price", "stock"],
        numeric_fields=["price", "stock"],
        allow_zero_numeric=True,
    )
    # Price must still be > 0
    if data["price"] <= 0:
        raise APIError("'price' must be greater than zero.", 400)

    product = Product(
        name=data["name"].strip(),
        price=data["price"],
        stock=data["stock"],
    )
    db.session.add(product)
    db.session.commit()
    return jsonify(product.to_dict()), 201


@api.route("/products", methods=["GET"])
@token_required
def get_products():
    """Paginated product list with search and price/stock filters."""
    query = Product.query

    search = request.args.get("search")
    if search:
        query = query.filter(Product.name.ilike(f"%{search.strip()}%"))

    min_price = request.args.get("min_price")
    if min_price is not None:
        try:
            query = query.filter(Product.price >= float(min_price))
        except ValueError:
            raise APIError("'min_price' must be a number.", 400)

    max_price = request.args.get("max_price")
    if max_price is not None:
        try:
            query = query.filter(Product.price <= float(max_price))
        except ValueError:
            raise APIError("'max_price' must be a number.", 400)

    in_stock = request.args.get("in_stock")
    if in_stock is not None:
        if in_stock.lower() in ("true", "1", "yes"):
            query = query.filter(Product.stock > 0)
        elif in_stock.lower() in ("false", "0", "no"):
            query = query.filter(Product.stock == 0)
        else:
            raise APIError("'in_stock' must be true or false.", 400)

    query = query.order_by(Product.id.asc())
    return jsonify(paginate(query))


@api.route("/products/<int:product_id>", methods=["GET"])
@token_required
def get_product(product_id):
    product = get_or_404(Product, product_id, "Product")
    return jsonify(product.to_dict())


@api.route("/products/<int:product_id>", methods=["PUT"])
@admin_required
def update_product(product_id):
    product = get_or_404(Product, product_id, "Product")
    data = get_json_payload(numeric_fields=["price", "stock"], allow_zero_numeric=True)

    if "name" in data:
        if not data["name"] or not data["name"].strip():
            raise APIError("'name' cannot be empty.", 400)
        product.name = data["name"].strip()
    if "price" in data:
        if data["price"] <= 0:
            raise APIError("'price' must be greater than zero.", 400)
        product.price = data["price"]
    if "stock" in data:
        product.stock = data["stock"]

    db.session.commit()
    return jsonify(product.to_dict())


@api.route("/products/<int:product_id>", methods=["DELETE"])
@admin_required
def delete_product(product_id):
    product = get_or_404(Product, product_id, "Product")
    db.session.delete(product)
    db.session.commit()
    return jsonify({"message": "Product deleted successfully", "id": product_id})


# ============ Order Routes ============

@api.route("/orders", methods=["POST"])
@token_required
def create_order():
    """Customers create their own orders. Admin can create on behalf of any user."""
    data = get_json_payload(
        required_fields=["product_id", "quantity"],
        numeric_fields=["product_id", "quantity"],
    )

    # Customers always order for themselves; admins can specify another user_id
    if g.current_user.is_admin() and "user_id" in data:
        user = get_or_404(User, int(data["user_id"]), "User")
    else:
        user = g.current_user

    product = get_or_404(Product, data["product_id"], "Product")

    order = Order.place(user, product, data["quantity"])
    db.session.add(order)
    db.session.commit()
    return jsonify(order.to_dict()), 201


@api.route("/orders", methods=["GET"])
@token_required
def get_orders():
    """Paginated orders. Admins see all, customers only see their own."""
    query = Order.query

    if not g.current_user.is_admin():
        # Customers only see their own orders
        query = query.filter(Order.user_id == g.current_user.id)
    else:
        # Admins can filter by user_id
        user_id = request.args.get("user_id")
        if user_id:
            try:
                query = query.filter(Order.user_id == int(user_id))
            except ValueError:
                raise APIError("'user_id' must be an integer.", 400)

    status = request.args.get("status")
    if status:
        if status not in ORDER_STATUSES:
            raise APIError(f"'status' must be one of {list(ORDER_STATUSES)}.", 400)
        query = query.filter(Order.status == status)

    start_date = parse_date(request.args.get("start_date"), "start_date")
    end_date = parse_date(request.args.get("end_date"), "end_date")
    if start_date:
        query = query.filter(Order.created_at >= start_date)
    if end_date:
        # Include the whole end day
        query = query.filter(Order.created_at < end_date + timedelta(days=1))

    query = query.order_by(Order.created_at.desc())
    return jsonify(paginate(query))


def _get_order_for_user(order_id):
    """Fetch an order, enforcing ownership for non-admin callers."""
    order = get_or_404(Order, order_id, "Order")
    if not g.current_user.is_admin() and order.user_id != g.current_user.id:
        raise APIError("You do not have permission to access this order.", 403)
    return order


@api.route("/orders/<int:order_id>", methods=["GET"])
@token_required
def get_order(order_id):
    order = _get_order_for_user(order_id)
    return jsonify(order.to_dict())


@api.route("/orders/<int:order_id>", methods=["DELETE"])
@token_required
def delete_order(order_id):
    order = _get_order_for_user(order_id)

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
@token_required
def confirm_order(order_id):
    """Mark an order as paid (kept under /confirm for backward compatibility)."""
    order = _get_order_for_user(order_id)
    order.mark_paid()
    db.session.commit()
    return jsonify({
        "message": "Order marked as paid",
        "order_id": order.id,
        "status": order.status,
    })


@api.route("/orders/<int:order_id>/cancel", methods=["PUT"])
@token_required
def cancel_order(order_id):
    order = _get_order_for_user(order_id)
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
@token_required
def get_invoice(order_id):
    order = _get_order_for_user(order_id)
    if order.status == STATUS_CANCELLED:
        raise APIError("Cancelled orders cannot have invoices.", 400)
    return jsonify(order.to_invoice())


# ============ Dashboard Routes (admin-only) ============

@api.route("/dashboard", methods=["GET"])
@admin_required
def dashboard():
    """One-call snapshot of the most useful KPIs."""
    from flask import current_app
    threshold = current_app.config.get("LOW_STOCK_THRESHOLD", 5)

    total_users = User.query.count()
    total_products = Product.query.count()
    total_orders = Order.query.count()

    # Revenue counts only paid orders
    revenue = db.session.query(func.coalesce(func.sum(Order.total_price), 0.0))\
        .filter(Order.status == STATUS_PAID).scalar()

    low_stock_products = (
        Product.query.filter(Product.stock <= threshold)
        .order_by(Product.stock.asc())
        .all()
    )

    recent_orders = (
        Order.query.order_by(Order.created_at.desc()).limit(5).all()
    )

    return jsonify({
        "total_users": total_users,
        "total_products": total_products,
        "total_orders": total_orders,
        "total_revenue": float(revenue or 0),
        "low_stock_threshold": threshold,
        "low_stock_products": [p.to_dict() for p in low_stock_products],
        "recent_orders": [o.to_dict() for o in recent_orders],
    })


# ============ Report Routes (admin-only) ============

@api.route("/reports/sales", methods=["GET"])
@admin_required
def report_total_sales():
    """Total sales for paid orders, optionally filtered by date range."""
    query = Order.query.filter(Order.status == STATUS_PAID)

    start_date = parse_date(request.args.get("start_date"), "start_date")
    end_date = parse_date(request.args.get("end_date"), "end_date")
    if start_date:
        query = query.filter(Order.created_at >= start_date)
    if end_date:
        query = query.filter(Order.created_at < end_date + timedelta(days=1))

    totals = query.with_entities(
        func.coalesce(func.sum(Order.total_price), 0.0),
        func.coalesce(func.sum(Order.quantity), 0),
        func.count(Order.id),
    ).one()

    return jsonify({
        "total_sales": float(totals[0] or 0),
        "total_units_sold": int(totals[1] or 0),
        "total_orders": int(totals[2] or 0),
        "start_date": request.args.get("start_date"),
        "end_date": request.args.get("end_date"),
    })


@api.route("/reports/sales/by-product", methods=["GET"])
@admin_required
def report_sales_by_product():
    """Group paid sales by product."""
    rows = (
        db.session.query(
            Product.id,
            Product.name,
            func.coalesce(func.sum(Order.quantity), 0),
            func.coalesce(func.sum(Order.total_price), 0.0),
        )
        .join(Order, Order.product_id == Product.id)
        .filter(Order.status == STATUS_PAID)
        .group_by(Product.id, Product.name)
        .order_by(func.sum(Order.total_price).desc())
        .all()
    )

    return jsonify([
        {
            "product_id": r[0],
            "product": r[1],
            "units_sold": int(r[2]),
            "revenue": float(r[3]),
        }
        for r in rows
    ])


@api.route("/reports/sales/by-customer", methods=["GET"])
@admin_required
def report_sales_by_customer():
    """Group paid sales by customer."""
    rows = (
        db.session.query(
            User.id,
            User.name,
            User.email,
            func.count(Order.id),
            func.coalesce(func.sum(Order.total_price), 0.0),
        )
        .join(Order, Order.user_id == User.id)
        .filter(Order.status == STATUS_PAID)
        .group_by(User.id, User.name, User.email)
        .order_by(func.sum(Order.total_price).desc())
        .all()
    )

    return jsonify([
        {
            "user_id": r[0],
            "name": r[1],
            "email": r[2],
            "orders_count": int(r[3]),
            "total_spent": float(r[4]),
        }
        for r in rows
    ])


@api.route("/reports/sales/monthly", methods=["GET"])
@admin_required
def report_monthly_sales():
    """Group paid sales by month (YYYY-MM)."""
    # strftime works in SQLite; for Postgres swap to to_char/date_trunc
    month_expr = func.strftime("%Y-%m", Order.created_at)
    rows = (
        db.session.query(
            month_expr.label("month"),
            func.count(Order.id),
            func.coalesce(func.sum(Order.total_price), 0.0),
        )
        .filter(Order.status == STATUS_PAID)
        .group_by("month")
        .order_by("month")
        .all()
    )

    return jsonify([
        {
            "month": r[0],
            "orders_count": int(r[1]),
            "revenue": float(r[2]),
        }
        for r in rows
    ])
