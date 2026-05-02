from flask import request
from errors import APIError


def get_json_payload(required_fields=None, numeric_fields=None, allow_zero_numeric=False):
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
        if allow_zero_numeric:
            if data[field] < 0:
                raise APIError(f"'{field}' cannot be negative.", 400)
        else:
            if data[field] <= 0:
                raise APIError(f"'{field}' must be greater than zero.", 400)

    return data


def get_or_404(model, entity_id, name):
    instance = model.query.get(entity_id)
    if instance is None:
        raise APIError(f"{name} not found.", 404)
    return instance


def get_pagination():
    """Read ?page=&limit= from query string and return safe ints."""
    try:
        page = int(request.args.get("page", 1))
        limit = int(request.args.get("limit", 10))
    except (TypeError, ValueError):
        raise APIError("'page' and 'limit' must be integers.", 400)

    if page < 1:
        raise APIError("'page' must be >= 1.", 400)
    if limit < 1 or limit > 100:
        raise APIError("'limit' must be between 1 and 100.", 400)

    return page, limit


def paginate(query, serializer=lambda x: x.to_dict()):
    """Run a paginated query and return the standard response shape."""
    page, limit = get_pagination()
    total_items = query.count()
    items = query.limit(limit).offset((page - 1) * limit).all()
    total_pages = (total_items + limit - 1) // limit if limit else 0

    return {
        "data": [serializer(item) for item in items],
        "page": page,
        "limit": limit,
        "total_items": total_items,
        "total_pages": total_pages,
    }


def parse_date(value, field_name):
    """Parse YYYY-MM-DD string to a datetime; raise APIError if malformed."""
    from datetime import datetime
    if value is None or value == "":
        return None
    try:
        return datetime.strptime(value, "%Y-%m-%d")
    except ValueError:
        raise APIError(f"'{field_name}' must be in YYYY-MM-DD format.", 400)
