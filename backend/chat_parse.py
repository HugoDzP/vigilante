# chat_parse.py — entiende frases libres de mantenimiento con Gemini
from gemini import call_gemini

PROMPT_TEMPLATE = """Eres el asistente de una app de mantenimiento de coches. Un usuario
acaba de escribir lo que le ha hecho a su coche. Extrae la información y responde
SOLO con un objeto JSON, sin markdown ni texto extra:

{{
  "title": "tipo de mantenimiento en 2-4 palabras, en español, con mayúscula inicial. Usa categorías típicas cuando encajen: 'Aceite y filtro', 'Neumáticos', 'Pastillas de freno', 'Batería 12V', 'ITV', 'Filtro de habitáculo', 'Líquido refrigerante', 'Escobillas', 'Correa de distribución', 'Embrague', 'Suspensión', 'Bujías'. Si no encaja en ninguna, resume la acción brevemente.",
  "cost": "importe con € si se menciona, formato '89,90 €'; si no se menciona, null",
  "km": "kilometraje si se menciona explícitamente, formato '128.450 km'; si no, null",
  "next": "estimación breve de cuándo tocaría la próxima vez según el tipo de mantenimiento y conocimiento general de coches, en estilo '+15.000 km' o '+2 años'; si no aplica, '—'"
}}

El kilometraje actual del coche (por si el usuario no lo menciona) es: {mileage} km.

Texto del usuario: "{text}"
"""


def parse_maintenance_text(text: str, mileage: int) -> dict:
    parsed = call_gemini([{"text": PROMPT_TEMPLATE.format(mileage=mileage, text=text)}])
    return {
        "title": parsed.get("title") or "Mantenimiento registrado",
        "cost": parsed.get("cost") or "— añadir",
        "km": parsed.get("km") or f"{mileage:,}".replace(",", "."),
        "next": parsed.get("next") or "—",
    }
