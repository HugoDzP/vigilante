# gemini.py — cliente mínimo para la API de Gemini (capa gratuita), compartido
# por el OCR de facturas y el parsing inteligente del chat.
import json
import requests
from config import GEMINI_API_KEY

GEMINI_URL = (
    "https://generativelanguage.googleapis.com/v1beta/models/"
    "gemini-flash-latest:generateContent"
)


def call_gemini(parts: list[dict], timeout: int = 20) -> dict:
    """Llama a Gemini con las 'parts' dadas (texto y/o imagen inline_data) y
    devuelve el JSON ya parseado de la respuesta. El prompt debe pedir
    explícitamente salida JSON (aquí forzamos responseMimeType)."""
    if not GEMINI_API_KEY:
        raise RuntimeError("GEMINI_API_KEY no configurada")

    resp = requests.post(
        f"{GEMINI_URL}?key={GEMINI_API_KEY}",
        json={
            "contents": [{"parts": parts}],
            "generationConfig": {"responseMimeType": "application/json"},
        },
        timeout=timeout,
    )
    resp.raise_for_status()
    data = resp.json()
    try:
        raw = data["candidates"][0]["content"]["parts"][0]["text"]
    except (KeyError, IndexError):
        raise RuntimeError(f"Respuesta inesperada de Gemini: {data}")
    return json.loads(raw)
