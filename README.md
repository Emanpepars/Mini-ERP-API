# Mini ERP System API

A backend RESTful API built using Flask and SQLAlchemy that simulates a mini ERP system for managing users, products, and orders with real business logic.

---

## Features

### User Management

- Create users
- Retrieve all users

### Product Management

- Create products
- Retrieve all products
- Track product stock

### Order Management

- Create orders linked to users and products
- Automatically reduce product stock when an order is created
- Restore stock when an order is cancelled or deleted

### Order Lifecycle

- Draft → Confirmed → Cancelled
- Prevent invalid state transitions

### Business Logic

- Validate stock before order creation
- Prevent confirming cancelled orders
- Prevent duplicate confirmations

### Invoice Generation

- Generate invoice for each order
- Includes customer details, product info, and total price
- Prevent invoice generation for cancelled orders

---

## Tech Stack

- Python
- Flask
- Flask-SQLAlchemy
- SQLite

---

## API Endpoints

### Users

POST /users  
GET /users

### Products

POST /products  
GET /products

### Orders

POST /orders  
GET /orders  
GET /orders/<id>  
DELETE /orders/<id>  
PUT /orders/<id>/confirm  
PUT /orders/<id>/cancel  
GET /orders/<id>/invoice

---

## How to Run

python3 -m venv venv  
source venv/bin/activate  
pip install -r requirements.txt  
python3 app.py

---

## Notes

- This project demonstrates backend system design similar to real ERP systems such as Odoo
- Focuses on relational database modeling and business logic implementation
- Designed as a learning project for backend development and API design
