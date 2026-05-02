import os

# Get the base directory of the project
BASE_DIR = os.path.abspath(os.path.dirname(__file__))


class Config:
    """Base configuration class."""
    SECRET_KEY = os.environ.get("SECRET_KEY") or "dev-secret-key"

    # Database configuration
    SQLALCHEMY_DATABASE_URI = f"sqlite:///{os.path.join(BASE_DIR, 'instance', 'erp.db')}"
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    # JWT configuration
    JWT_SECRET_KEY = os.environ.get("JWT_SECRET_KEY") or "dev-jwt-secret-please-change-in-production-32bytes"
    JWT_ALGORITHM = "HS256"
    JWT_EXPIRES_HOURS = int(os.environ.get("JWT_EXPIRES_HOURS", 24))

    # Default seeded test accounts (used by app.py on first run)
    ADMIN_NAME = os.environ.get("ADMIN_NAME", "Admin User")
    ADMIN_EMAIL = os.environ.get("ADMIN_EMAIL", "admin@example.com")
    ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "admin123")

    CUSTOMER_NAME = os.environ.get("CUSTOMER_NAME", "Demo Customer")
    CUSTOMER_EMAIL = os.environ.get("CUSTOMER_EMAIL", "customer@example.com")
    CUSTOMER_PASSWORD = os.environ.get("CUSTOMER_PASSWORD", "customer123")

    # Default low-stock threshold for the dashboard
    LOW_STOCK_THRESHOLD = int(os.environ.get("LOW_STOCK_THRESHOLD", 5))
