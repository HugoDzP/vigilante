# auth.py — verifica el JWT que emite Supabase Auth
#
# Soporta los DOS sistemas de firma de Supabase, con fallback automático:
#   1. Nuevo (por defecto en proyectos creados recientemente): claves asimétricas
#      ES256/RS256, verificadas contra el endpoint público JWKS. No requiere
#      ningún secreto en el backend — más seguro y es lo que Supabase recomienda.
#   2. Legado: secreto compartido HS256 (Settings → API → JWT Keys → sección
#      "Legacy JWT Secret"). Solo se usa si el JWKS no resuelve el token.
from functools import wraps
import jwt
from jwt import PyJWKClient
from flask import request, jsonify, g
from config import SUPABASE_URL, SUPABASE_JWT_SECRET

_jwk_client = (
    PyJWKClient(f"{SUPABASE_URL}/auth/v1/.well-known/jwks.json", cache_keys=True, lifespan=600)
    if SUPABASE_URL else None
)


def _decode(token: str) -> dict:
    # 1) sistema nuevo: claves asimétricas vía JWKS
    if _jwk_client:
        try:
            signing_key = _jwk_client.get_signing_key_from_jwt(token)
            return jwt.decode(token, signing_key.key, algorithms=["ES256", "RS256"], audience="authenticated")
        except Exception:
            pass  # cae al secreto legado si el JWKS no tiene la clave (proyecto aún en modo legado)
    # 2) fallback: secreto compartido legado (HS256)
    if SUPABASE_JWT_SECRET:
        return jwt.decode(token, SUPABASE_JWT_SECRET, algorithms=["HS256"], audience="authenticated")
    raise jwt.InvalidTokenError("Configura SUPABASE_URL (recomendado) o SUPABASE_JWT_SECRET en el backend")


def require_auth(fn):
    """Valida `Authorization: Bearer <token>` y deja el user_id en g.user_id."""
    @wraps(fn)
    def wrapper(*args, **kwargs):
        header = request.headers.get("Authorization", "")
        if not header.startswith("Bearer "):
            return jsonify(error="Falta el token"), 401
        token = header.removeprefix("Bearer ").strip()
        try:
            payload = _decode(token)
        except jwt.ExpiredSignatureError:
            return jsonify(error="Token caducado"), 401
        except jwt.InvalidTokenError as e:
            return jsonify(error=f"Token inválido: {e}"), 401

        g.user_id = payload["sub"]
        g.user_email = payload.get("email")
        return fn(*args, **kwargs)

    return wrapper
