from flask import request
from errors import APIError


def get_json_payload(required_fields=None, numeric_fields=None):
    """Parse JSON body, ensure required fields exist, and coerce numeric fields.

    Raises APIError(400) for any missing or malformed input so route handlers
    don't have to repeat the same checks.
    """
    data = request.get_json(silent=True)
    if data is None:
        raise APIError("Request body must be valid JSON.", 400)

    for field in required_fields or []:
        value = data.get(field)
        if value is None or (isinstance(value, str) and value.strip() == ""):
            raise APIError(f"'{field}' is required.", 400)

    for field in numeric_fields or []:
        if field not in data:
            continue
        try:
            data[field] = float(data[field]) if "." in str(data[field]) else int(data[field])
        except (TypeError, ValueError):
            raise APIError(f"'{field}' must be a number.", 400)
        if data[field] <= 0:
            raise APIError(f"'{field}' must be greater than zero.", 400)

    return data


def get_or_404(model, entity_id, name):
    instance = model.query.get(entity_id)
    if instance is None:
        raise APIError(f"{name} not found.", 404)
    return instance
