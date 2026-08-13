# config.py
import os
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.environ.get("DATABASE_URL", "sqlite:///vigilante.db")
# Render/Heroku a veces dan postgres:// (esquema antiguo de SQLAlchemy)
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

SUPABASE_URL = os.environ.get("SUPABASE_URL", "").rstrip("/")   # p.ej. https://xxxx.supabase.co — para verificar JWTs vía JWKS
SUPABASE_JWT_SECRET = os.environ.get("SUPABASE_JWT_SECRET", "")  # solo fallback, sistema legado HS256
GOOGLE_PLACES_KEY = os.environ.get("GOOGLE_PLACES_KEY", "")
ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY", "")
