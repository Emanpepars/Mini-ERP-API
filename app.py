from flask import Flask
from flask_cors import CORS
from config import Config
from extensions import db
from errors import register_error_handlers
from models import User, Product, Order
from routes import api


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

    return app


# Create the application instance
app = create_app()


if __name__ == "__main__":
    app.run(debug=True)
