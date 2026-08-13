# ocr.py — extrae datos de una factura/ticket de taller con la API de Claude
import json
from config import ANTHROPIC_API_KEY

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
    if not ANTHROPIC_API_KEY:
        raise RuntimeError("ANTHROPIC_API_KEY no configurada")

    import anthropic  # import perezoso: la app arranca aunque falte el paquete

    client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
    msg = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=400,
        messages=[{
            "role": "user",
            "content": [
                {"type": "image", "source": {"type": "base64", "media_type": "image/jpeg", "data": image_b64}},
                {"type": "text", "text": PROMPT},
            ],
        }],
    )
    raw = "".join(b.text for b in msg.content if b.type == "text")
    raw = raw.replace("```json", "").replace("```", "").strip()
    data = json.loads(raw)
    if data.get("error"):
        return None
    return {
        "title": data.get("title") or "Mantenimiento",
        "date": data.get("date") or "—",
        "cost": data.get("cost") or "—",
        "km": data.get("km") or "—",
        "workshop": data.get("workshop"),
    }
