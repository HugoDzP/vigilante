# ocr.py — extrae datos de una factura/ticket con Google Gemini (capa gratuita)
#
# Gemini Flash tiene una capa gratuita genuina (hasta 1.500 peticiones/día) que
# entiende imágenes y puede devolver JSON estructurado — perfecto para esto sin
# gastar créditos de pago. Se consigue la clave gratis en aistudio.google.com.
import json
import requests
from config import GEMINI_API_KEY

GEMINI_URL = (
    "https://generativelanguage.googleapis.com/v1beta/models/"
    "gemini-flash-latest:generateContent"
)

PROMPT = """Analiza esta factura o ticket de un taller/tienda de automoción español.
Extrae los datos y responde SOLO con un objeto JSON, sin markdown ni texto extra:

{
  "title": "tipo de mantenimiento en 2-4 palabras, p. ej. 'Aceite y filtro'",
  "date": "fecha en formato 'D mmm AAAA' en español, p. ej. '11 jun 2026'; si no aparece, null",
  "cost": "importe total con IVA como '89,90 €'; si no aparece, null",
  "km": "kilometraje como '128.450 km' si figura en la factura; si no, null",
  "workshop": "nombre del taller/comercio; si no aparece, null"
}

Si la imagen no parece una factura de automoción, responde:
{"error": "no_invoice"}"""


def parse_invoice_image(image_b64: str) -> dict | None:
    """Devuelve dict con title/date/cost/km/workshop, o None si no es factura."""
    if not GEMINI_API_KEY:
        raise RuntimeError("GEMINI_API_KEY no configurada")

    resp = requests.post(
        f"{GEMINI_URL}?key={GEMINI_API_KEY}",
        json={
            "contents": [{
                "parts": [
                    {"inline_data": {"mime_type": "image/jpeg", "data": image_b64}},
                    {"text": PROMPT},
                ],
            }],
            "generationConfig": {"responseMimeType": "application/json"},
        },
        timeout=20,
    )
    resp.raise_for_status()
    data = resp.json()

    try:
        raw = data["candidates"][0]["content"]["parts"][0]["text"]
    except (KeyError, IndexError):
        raise RuntimeError(f"Respuesta inesperada de Gemini: {data}")

    parsed = json.loads(raw)
    if parsed.get("error"):
        return None
    return {
        "title": parsed.get("title") or "Mantenimiento",
        "date": parsed.get("date") or "—",
        "cost": parsed.get("cost") or "—",
        "km": parsed.get("km") or "—",
        "workshop": parsed.get("workshop"),
    }
