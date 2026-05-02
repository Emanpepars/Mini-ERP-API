from flask import Flask
from flask_cors import CORS
from config import Config
from extensions import db
from errors import register_error_handlers
from models import User, Product, Order, ROLE_ADMIN, ROLE_CUSTOMER  # noqa: F401
from routes import api


def seed_default_users(app):
    """Create the default admin and customer accounts on first run."""
    with app.app_context():
        # Admin account
        if not User.query.filter_by(email=app.config["ADMIN_EMAIL"]).first():
            admin = User(
                name=app.config["ADMIN_NAME"],
                email=app.config["ADMIN_EMAIL"],
                role=ROLE_ADMIN,
            )
            admin.set_password(app.config["ADMIN_PASSWORD"])
            db.session.add(admin)

        # Customer account
        if not User.query.filter_by(email=app.config["CUSTOMER_EMAIL"]).first():
            customer = User(
                name=app.config["CUSTOMER_NAME"],
                email=app.config["CUSTOMER_EMAIL"],
                role=ROLE_CUSTOMER,
            )
            customer.set_password(app.config["CUSTOMER_PASSWORD"])
            db.session.add(customer)

        db.session.commit()


def create_app(config_class=Config):
    """Application factory for creating the Flask app."""
    app = Flask(__name__)
    CORS(app)
    app.config.from_object(config_class)

    db.init_app(app)
    register_error_handlers(app)
    app.register_blueprint(api)

    with app.app_context():
        db.create_all()

    seed_default_users(app)
    return app


# Create the application instance
app = create_app()


if __name__ == "__main__":
    app.run(debug=True)
