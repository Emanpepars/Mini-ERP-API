import os

# Get the base directory of the project
BASE_DIR = os.path.abspath(os.path.dirname(__file__))


class Config:
    """Base configuration class."""
    SECRET_KEY = os.environ.get("SECRET_KEY") or "dev-secret-key"
    
    # Database configuration
    SQLALCHEMY_DATABASE_URI = f"sqlite:///{os.path.join(BASE_DIR, 'instance', 'erp.db')}"
    SQLALCHEMY_TRACK_MODIFICATIONS = False
