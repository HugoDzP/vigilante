# ocr.py — extrae datos de una factura/ticket con Gemini (capa gratuita)
from gemini import call_gemini

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
    parsed = call_gemini([
        {"inline_data": {"mime_type": "image/jpeg", "data": image_b64}},
        {"text": PROMPT},
    ])
    if parsed.get("error"):
        return None
    return {
        "title": parsed.get("title") or "Mantenimiento",
        "date": parsed.get("date") or "—",
        "cost": parsed.get("cost") or "—",
        "km": parsed.get("km") or "—",
        "workshop": parsed.get("workshop"),
    }
