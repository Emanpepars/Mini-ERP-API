"""JWT helpers and route decorators for authentication and role-based access."""
from datetime import datetime, timedelta
from functools import wraps

import jwt
from flask import current_app, g, request

from errors import APIError
from models import User, ROLE_ADMIN


def generate_token(user):
    """Build a signed JWT for the given user."""
    payload = {
        # PyJWT 2.10+ requires 'sub' to be a string per JWT spec
        "sub": str(user.id),
        "role": user.role,
        "iat": datetime.utcnow(),
        "exp": datetime.utcnow() + timedelta(hours=current_app.config["JWT_EXPIRES_HOURS"]),
    }
    token = jwt.encode(
        payload,
        current_app.config["JWT_SECRET_KEY"],
        algorithm=current_app.config["JWT_ALGORITHM"],
    )
    # PyJWT >= 2.x returns a str already; keep this for safety
    if isinstance(token, bytes):
        token = token.decode("utf-8")
    return token


def decode_token(token):
    """Decode and verify a JWT. Raises APIError on any problem."""
    try:
        return jwt.decode(
            token,
            current_app.config["JWT_SECRET_KEY"],
            algorithms=[current_app.config["JWT_ALGORITHM"]],
        )
    except jwt.ExpiredSignatureError:
        raise APIError("Token has expired. Please log in again.", 401)
    except jwt.InvalidTokenError:
        raise APIError("Invalid authentication token.", 401)


def _extract_token():
    """Pull the bearer token out of the Authorization header."""
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise APIError("Missing or invalid Authorization header.", 401)
    return auth_header.split(" ", 1)[1].strip()


def token_required(view_func):
    """Decorator that requires a valid JWT and loads the current user into `g`."""
    @wraps(view_func)
    def wrapper(*args, **kwargs):
        token = _extract_token()
        payload = decode_token(token)

        try:
            user_id = int(payload.get("sub"))
        except (TypeError, ValueError):
            raise APIError("Invalid authentication token.", 401)

        user = User.query.get(user_id)
        if user is None:
            raise APIError("User in token no longer exists.", 401)

        # Make the current user available everywhere in the request
        g.current_user = user
        return view_func(*args, **kwargs)

    return wrapper


def admin_required(view_func):
    """Decorator that requires the caller to be an authenticated admin."""
    @wraps(view_func)
    @token_required
    def wrapper(*args, **kwargs):
        if g.current_user.role != ROLE_ADMIN:
            raise APIError("Admin privileges required.", 403)
        return view_func(*args, **kwargs)

    return wrapper
