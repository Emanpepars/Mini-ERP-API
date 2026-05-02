from flask import Flask
from config import Config
from extensions import db
from models import User, Product, Order
from routes import api


def create_app(config_class=Config):
    """Application factory for creating the Flask app."""
    app = Flask(__name__)
    app.config.from_object(config_class)

    # Initialize extensions
    db.init_app(app)

    # Register blueprints
    app.register_blueprint(api)

    # Create database tables
    with app.app_context():
        db.create_all()

    return app


# Create the application instance
app = create_app()


if __name__ == "__main__":
    app.run(debug=True)
