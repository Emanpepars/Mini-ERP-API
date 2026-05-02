# Mini ERP API

A simple backend API built with Flask and SQLAlchemy to manage users, products, and orders.

## Features

- Create and list users
- Create and list products
- Create orders
- Update product stock when an order is created
- Return stock when an order is deleted
- Relational database models using SQLAlchemy

## Tech Stack

- Python
- Flask
- Flask-SQLAlchemy
- SQLite

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

## How to Run

```bash
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python3 app.py
```
