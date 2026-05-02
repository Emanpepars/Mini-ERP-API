# Mini ERP System API

A backend RESTful API built with Flask and SQLAlchemy that simulates a mini ERP system for managing users, products, and orders with real business logic. Ships with a lightweight HTML/CSS/JS frontend for interacting with the API.

---

## Features

### User Management

- Create users (unique email enforced at the database level)
- Retrieve all users

### Product Management

- Create products with price and stock
- Retrieve all products
- Track product stock automatically

### Order Management

- Create orders linked to users and products
- Automatically reduce product stock when an order is created
- Restore stock when an order is cancelled or deleted
- Retrieve a single order or list all orders

### Order Lifecycle

- Draft → Confirmed → Cancelled
- Prevent invalid state transitions (e.g. confirming a cancelled order, double-confirming, double-cancelling)

### Business Logic

- Validate stock availability before order creation
- Enforce positive numeric values for price, stock, and quantity
- Centralized request validation and JSON payload parsing

### Invoice Generation

- Generate an invoice for any non-cancelled order
- Includes customer details, product info, quantity, and total price
- Prevent invoice generation for cancelled orders

### Error Handling

- Custom `APIError` exception with consistent JSON error responses
- Handlers for 400 / 404 / 405 / 409 (integrity) / 500
- Friendly messages for malformed JSON and missing/invalid fields

### Frontend

- Static HTML/CSS/JS client in `frontend/` for browsing users, products, and orders
- CORS enabled on the API for local frontend usage

---

## Tech Stack

- Python 3
- Flask (application factory pattern + Blueprints)
- Flask-SQLAlchemy
- Flask-CORS
- SQLite

---

## Project Structure

```
mini-erp-api/
├── app.py            # App factory and entry point
├── config.py         # Configuration (DB URI, secret key)
├── extensions.py     # SQLAlchemy instance
├── models.py         # User, Product, Order models + business logic
├── routes.py         # API blueprint with all endpoints
├── validation.py     # JSON payload parsing and lookup helpers
├── errors.py         # APIError + global error handlers
├── requirements.txt
├── instance/         # SQLite database lives here
└── frontend/         # Static client (index.html, script.js, style.css)
```

---

## API Endpoints

### Health

`GET /` — returns `{"message": "Mini ERP API is running"}`

### Users

- `POST /users` — body: `{ "name", "email" }`
- `GET /users`

### Products

- `POST /products` — body: `{ "name", "price", "stock" }`
- `GET /products`

### Orders

- `POST /orders` — body: `{ "user_id", "product_id", "quantity" }`
- `GET /orders`
- `GET /orders/<id>`
- `DELETE /orders/<id>` — restores stock if not already cancelled
- `PUT /orders/<id>/confirm`
- `PUT /orders/<id>/cancel`
- `GET /orders/<id>/invoice`

---

## How to Run

```bash
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python3 app.py
```

The API starts on `http://127.0.0.1:5000` by default. Open `frontend/index.html` in a browser to use the UI.

> Note: the frontend depends on `Flask-CORS`, which is imported by `app.py`. If it isn't installed yet, run `pip install flask-cors`.

---

## Notes

- Demonstrates backend system design similar to real ERP systems such as Odoo
- Focuses on relational database modeling, validation, and business logic
- Designed as a learning project for backend development and API design
