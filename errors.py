from flask import jsonify
from sqlalchemy.exc import IntegrityError


class APIError(Exception):
    def __init__(self, message, status=400):
        super().__init__(message)
        self.message = message
        self.status = status


def register_error_handlers(app):
    @app.errorhandler(APIError)
    def handle_api_error(err):
        return jsonify({"error": err.message}), err.status

    @app.errorhandler(IntegrityError)
    def handle_integrity_error(err):
        return jsonify({"error": "Database constraint violated (e.g. duplicate value)."}), 409

    @app.errorhandler(404)
    def handle_not_found(_):
        return jsonify({"error": "Resource not found."}), 404

    @app.errorhandler(405)
    def handle_method_not_allowed(_):
        return jsonify({"error": "Method not allowed."}), 405

    @app.errorhandler(500)
    def handle_server_error(_):
        return jsonify({"error": "Internal server error."}), 500
