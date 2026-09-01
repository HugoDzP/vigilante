# chat_parse.py — entiende frases libres de mantenimiento con Gemini
from gemini import call_gemini

PROMPT_TEMPLATE = """Eres el asistente conversacional de una app de mantenimiento de coches
llamada Vigilante. Un usuario acaba de escribir un mensaje en el chat. Responde SOLO con un
objeto JSON, sin markdown ni texto extra:

{{
  "isMaintenance": true si el mensaje describe algo que se le ha hecho al coche (una reparación,
    revisión, cambio de pieza, repostaje, etc.); false si es un saludo, agradecimiento, pregunta
    genérica o cualquier cosa que NO sea describir un mantenimiento realizado,
  "reply": "SOLO si isMaintenance es false: una respuesta breve, natural y amable en español al
    mensaje del usuario (saluda si saluda, responde si pregunta algo simple, y si no entiendes qué
    quiere, invítale a contarte qué le ha hecho al coche). Si isMaintenance es true, deja este
    campo como null.",
  "title": "SOLO si isMaintenance es true: tipo de mantenimiento en 2-4 palabras, en español, con
    mayúscula inicial. Usa categorías típicas cuando encajen: 'Aceite y filtro', 'Neumáticos',
    'Pastillas de freno', 'Batería 12V', 'ITV', 'Filtro de habitáculo', 'Líquido refrigerante',
    'Escobillas', 'Correa de distribución', 'Embrague', 'Suspensión', 'Bujías'. Si no encaja en
    ninguna, resume la acción brevemente. Si isMaintenance es false, null.",
  "cost": "importe con € si se menciona, formato '89,90 €'; si no, null",
  "km": "kilometraje si se menciona explícitamente, formato '128.450 km'; si no, null",
  "next": "estimación breve de cuándo tocaría la próxima vez según el tipo de mantenimiento y
    conocimiento general de coches, en estilo '+15.000 km' o '+2 años'; si no aplica, null"
}}

El kilometraje actual del coche (por si el usuario no lo menciona) es: {mileage} km.

Mensaje del usuario: "{text}"
"""


def parse_maintenance_text(text: str, mileage: int) -> dict:
    parsed = call_gemini([{"text": PROMPT_TEMPLATE.format(mileage=mileage, text=text)}])

    if not parsed.get("isMaintenance", True):
        return {
            "isMaintenance": False,
            "reply": parsed.get("reply") or "Cuéntame qué le has hecho al coche y lo apunto 🙂",
        }

    return {
        "isMaintenance": True,
        "title": parsed.get("title") or "Mantenimiento registrado",
        "cost": parsed.get("cost") or "— añadir",
        "km": parsed.get("km") or f"{mileage:,}".replace(",", "."),
        "next": parsed.get("next") or "—",
    }
