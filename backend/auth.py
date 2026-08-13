# auth.py — verifica el JWT que emite Supabase Auth
from functools import wraps
import jwt
from flask import request, jsonify, g
from config import SUPABASE_JWT_SECRET


def require_auth(fn):
    """Valida `Authorization: Bearer <token>` y deja el user_id en g.user_id.

    Supabase firma sus tokens con HS256 usando el JWT Secret del proyecto
    (Settings → API → JWT Secret). El claim `sub` es el UUID del usuario.
    """
    @wraps(fn)
    def wrapper(*args, **kwargs):
        header = request.headers.get("Authorization", "")
        if not header.startswith("Bearer "):
            return jsonify(error="Falta el token"), 401
        token = header.removeprefix("Bearer ").strip()
        try:
            payload = jwt.decode(
                token,
                SUPABASE_JWT_SECRET,
                algorithms=["HS256"],
                audience="authenticated",
            )
        except jwt.ExpiredSignatureError:
            return jsonify(error="Token caducado"), 401
        except jwt.InvalidTokenError as e:
            return jsonify(error=f"Token inválido: {e}"), 401

        g.user_id = payload["sub"]
        g.user_email = payload.get("email")
        return fn(*args, **kwargs)

    return wrapper
