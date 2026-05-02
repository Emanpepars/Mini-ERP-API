# Mini ERP System API

A backend RESTful API built with **Flask + SQLAlchemy** that simulates a small ERP for managing users, products, and orders. It now ships with **JWT authentication**, **role-based access control (admin / customer)**, **pagination**, **search & filters**, **dashboard KPIs** and **sales reports**. A lightweight HTML/CSS/JS frontend in `frontend/` can be used as a simple client.

---

## Features

### Authentication & Authorization
- JWT-based login & registration
- Password hashing (werkzeug)
- Protected routes via `Authorization: Bearer <token>`
- `GET /auth/me` to fetch the current user
- Role-based access control: **admin** vs **customer**

### Roles
- **Admin** — manage products, view all users, all orders, dashboard, and reports
- **Customer** — browse products, create orders, view only their own orders

### Products
- Create / update / delete (admin only)
- List / get (any authenticated user)
- Search by name, filter by `min_price`, `max_price`, `in_stock`

### Orders
- Customer-created orders with statuses: `pending`, `paid`, `cancelled`
- Stock automatically decreases when an order is created
- Stock is restored when an order is cancelled or deleted
- Filter by `user_id` (admin), `status`, `start_date`, `end_date`
- Customers can only see/modify their own orders

### Users (Admin)
- List users with search by name/email and filter by role
- Create users with any role

### Dashboard (Admin)
- Total users, products, orders
- Total revenue (paid orders only)
- Low-stock products
- Most recent orders

### Reports (Admin)
- Total sales (date range supported)
- Sales grouped by product
- Sales grouped by customer
- Monthly sales summary

### Pagination
List endpoints (`/products`, `/users`, `/orders`) accept `?page=1&limit=10` and respond with:
```json
{ "data": [...], "page": 1, "limit": 10, "total_items": 42, "total_pages": 5 }
```

### Validation & Error Handling
- Centralized JSON validation
- Consistent error responses: `{ "error": "..." }`
- Proper HTTP status codes (400, 401, 403, 404, 409, 500)

---

## Tech Stack

- Python 3
- Flask (application factory + Blueprints)
- Flask-SQLAlchemy
- Flask-Cors
- PyJWT
- SQLite (file-based, in `instance/erp.db`)

---

## Project Structure

```
mini-erp-api/
├── app.py                    # App factory + seeds default admin/customer
├── auth.py                   # JWT helpers + token_required / admin_required
├── config.py                 # Configuration (DB URI, JWT, seeded accounts)
├── extensions.py             # SQLAlchemy instance
├── models.py                 # User, Product, Order + business logic
├── routes.py                 # All API endpoints (auth, users, products, orders, dashboard, reports)
├── validation.py             # JSON parsing, pagination, date parsing helpers
├── errors.py                 # APIError + global error handlers
├── seed.py                   # Demo data script (products, customers, orders)
├── postman_collection.json   # Postman collection with all endpoints
├── .env.example              # Sample environment configuration
├── requirements.txt
├── instance/                 # SQLite database lives here
└── frontend/                 # Static client (index.html, script.js, style.css)
```

---

## Setup

```bash
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python3 app.py
```

The API starts on `http://127.0.0.1:5000`. On first run the database is created and two test accounts are seeded.

### Optional: load demo data

To populate realistic products, extra customers, and a spread of orders so the dashboard and reports look meaningful out of the box:

```bash
python3 seed.py
```

The script is **idempotent** — re-running it skips records that already exist.

### Environment Variables

All variables are optional; sensible defaults are provided. A ready-to-copy template is included in [`.env.example`](.env.example).

| Variable | Default | Purpose |
|----------|---------|---------|
| `SECRET_KEY` | `dev-secret-key` | Flask secret key |
| `JWT_SECRET_KEY` | dev value (change in prod!) | Signing key for JWT |
| `JWT_EXPIRES_HOURS` | `24` | Token lifetime |
| `ADMIN_NAME` | `Admin User` | Seeded admin name |
| `ADMIN_EMAIL` | `admin@example.com` | Seeded admin email |
| `ADMIN_PASSWORD` | `admin123` | Seeded admin password |
| `CUSTOMER_NAME` | `Demo Customer` | Seeded customer name |
| `CUSTOMER_EMAIL` | `customer@example.com` | Seeded customer email |
| `CUSTOMER_PASSWORD` | `customer123` | Seeded customer password |
| `LOW_STOCK_THRESHOLD` | `5` | Threshold for the dashboard low-stock list |

---

## Test Accounts

| Role | Email | Password |
|------|-------|----------|
| Admin | `admin@example.com` | `admin123` |
| Customer | `customer@example.com` | `customer123` |

---

## Authentication

Send the JWT in the `Authorization` header for any protected endpoint:
```
Authorization: Bearer <token>
```

---

## API Endpoints

### Health
- `GET /` — `{"message": "Mini ERP API is running"}`

### Auth
- `POST /auth/register` — public, creates a new customer
- `POST /auth/login`
- `GET /auth/me` — auth required

### Users (admin only)
- `GET /users?page=1&limit=10&search=jane&role=customer`
- `POST /users` — body: `{ "name", "email", "password", "role"? }`

### Products
- `GET /products?page=1&limit=10&search=...&min_price=...&max_price=...&in_stock=true` — auth required
- `GET /products/<id>` — auth required
- `POST /products` — admin
- `PUT /products/<id>` — admin
- `DELETE /products/<id>` — admin

### Orders
- `GET /orders?page=1&limit=10&user_id=2&status=paid&start_date=2026-01-01&end_date=2026-12-31` — auth (customers see only their own; `user_id` filter is admin-only)
- `POST /orders` — customer creates own order; admin can pass `user_id` to create on behalf of a user
- `GET /orders/<id>` — owner or admin
- `DELETE /orders/<id>` — owner or admin (restores stock)
- `PUT /orders/<id>/confirm` — marks the order as **paid**
- `PUT /orders/<id>/cancel` — cancels and restores stock
- `GET /orders/<id>/invoice` — only for non-cancelled orders

### Dashboard (admin only)
- `GET /dashboard`

### Reports (admin only)
- `GET /reports/sales?start_date=YYYY-MM-DD&end_date=YYYY-MM-DD`
- `GET /reports/sales/by-product`
- `GET /reports/sales/by-customer`
- `GET /reports/sales/monthly`

---

## Example Requests & Responses

### 1. Register a customer
```http
POST /auth/register
Content-Type: application/json

{ "name": "Jane Doe", "email": "jane@example.com", "password": "secret123" }
```
**Response 201**
```json
{
  "user": { "id": 3, "name": "Jane Doe", "email": "jane@example.com", "role": "customer", "created_at": "..." },
  "token": "eyJhbGciOi..."
}
```

### 2. Login
```http
POST /auth/login
Content-Type: application/json

{ "email": "admin@example.com", "password": "admin123" }
```
**Response 200**
```json
{
  "user": { "id": 1, "name": "Admin User", "email": "admin@example.com", "role": "admin", "created_at": "..." },
  "token": "eyJhbGciOi..."
}
```

### 3. Current user
```http
GET /auth/me
Authorization: Bearer <token>
```

### 4. Create a product (admin)
```http
POST /products
Authorization: Bearer <admin_token>
Content-Type: application/json

{ "name": "Widget", "price": 9.99, "stock": 50 }
```

### 5. List products with filters
```http
GET /products?page=1&limit=10&search=wid&min_price=5&in_stock=true
Authorization: Bearer <token>
```
**Response 200**
```json
{
  "data": [
    { "id": 1, "name": "Widget", "price": 9.99, "stock": 50, "created_at": "..." }
  ],
  "page": 1,
  "limit": 10,
  "total_items": 1,
  "total_pages": 1
}
```

### 6. Create an order (customer)
```http
POST /orders
Authorization: Bearer <customer_token>
Content-Type: application/json

{ "product_id": 1, "quantity": 2 }
```
**Response 201**
```json
{
  "id": 1,
  "user_id": 2,
  "user": "Demo Customer",
  "product_id": 1,
  "product": "Widget",
  "quantity": 2,
  "total_price": 19.98,
  "status": "pending",
  "created_at": "..."
}
```

### 7. Mark an order as paid
```http
PUT /orders/1/confirm
Authorization: Bearer <token>
```
**Response 200**
```json
{ "message": "Order marked as paid", "order_id": 1, "status": "paid" }
```

### 8. Cancel an order (restores stock)
```http
PUT /orders/1/cancel
Authorization: Bearer <token>
```

### 9. Admin dashboard
```http
GET /dashboard
Authorization: Bearer <admin_token>
```
**Response 200**
```json
{
  "total_users": 2,
  "total_products": 5,
  "total_orders": 12,
  "total_revenue": 299.85,
  "low_stock_threshold": 5,
  "low_stock_products": [ { "id": 2, "name": "Gadget", "price": 4.5, "stock": 2, "created_at": "..." } ],
  "recent_orders": [ ... ]
}
```

### 10. Sales report
```http
GET /reports/sales?start_date=2026-01-01&end_date=2026-12-31
Authorization: Bearer <admin_token>
```
**Response 200**
```json
{
  "total_sales": 299.85,
  "total_units_sold": 30,
  "total_orders": 12,
  "start_date": "2026-01-01",
  "end_date": "2026-12-31"
}
```

### Error response shape
```json
{ "error": "Admin privileges required." }
```

---

## How to Test the API

A complete end-to-end flow you can run in **Postman** (import `postman_collection.json`) or with **curl**.

### 0. (Optional) Load demo data
```bash
python3 seed.py
```

### 1. Login as Admin
```bash
curl -X POST http://127.0.0.1:5000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"admin123"}'
```
Copy the `token` value into the Postman variable `{{admin_token}}` (the included collection does this automatically via a test script).

### 2. Login as Customer
```bash
curl -X POST http://127.0.0.1:5000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"customer@example.com","password":"customer123"}'
```
Save its `token` as `{{customer_token}}`.

### 3. Create a product (admin)
```bash
curl -X POST http://127.0.0.1:5000/products \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Widget","price":9.99,"stock":50}'
```
A 403 confirms RBAC if you try the same call with the customer token.

### 4. Create an order (customer)
```bash
curl -X POST http://127.0.0.1:5000/orders \
  -H "Authorization: Bearer $CUSTOMER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"product_id":1,"quantity":2}'
```
The product's stock drops by 2 immediately. Then mark it paid:
```bash
curl -X PUT http://127.0.0.1:5000/orders/1/confirm \
  -H "Authorization: Bearer $CUSTOMER_TOKEN"
```

### 5. Check the dashboard (admin)
```bash
curl http://127.0.0.1:5000/dashboard \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```
You'll see totals, revenue (from paid orders only), low-stock products, and the most recent orders.

### 6. Check the reports (admin)
```bash
curl http://127.0.0.1:5000/reports/sales        -H "Authorization: Bearer $ADMIN_TOKEN"
curl http://127.0.0.1:5000/reports/sales/by-product   -H "Authorization: Bearer $ADMIN_TOKEN"
curl http://127.0.0.1:5000/reports/sales/by-customer  -H "Authorization: Bearer $ADMIN_TOKEN"
curl http://127.0.0.1:5000/reports/sales/monthly      -H "Authorization: Bearer $ADMIN_TOKEN"
```

### Postman quick start
1. Import **`postman_collection.json`** into Postman.
2. The collection ships with three variables: `base_url`, `admin_token`, `customer_token`.
3. Run **Auth → Login as Admin** and **Auth → Login as Customer** — their test scripts auto-populate the token variables.
4. Every other request is already wired up to use the right token.

---

## CV Summary

- **Mini ERP REST API (Flask + SQLAlchemy)** — Designed and built a production-style backend featuring JWT authentication, role-based access control (admin/customer), pagination, search & filtering, and automatic stock management across product/order lifecycles, with a clean application-factory architecture (Blueprints, centralized validation, custom error handling).
- **Business intelligence endpoints** — Implemented admin-only dashboard and reporting APIs (total revenue, sales by product/customer, monthly summaries, low-stock alerts) backed by efficient SQLAlchemy aggregate queries, plus a Postman collection and seed script for instant evaluation.

---

## Notes

- Demonstrates backend system design similar to real ERP systems such as Odoo
- Focuses on relational modeling, validation, business logic, RBAC, and reporting
- Designed as a learning project for backend development and API design
