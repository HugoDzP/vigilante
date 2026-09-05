# vehicle_summary.py — el "Resumen Vigilante" del Dashboard, generado con Gemini
# a partir del estado REAL del coche (no es texto fijo). Si Gemini falla o no
# está configurada, cae en un resumen igualmente real pero sin IA (calculado
# directamente de los números), nunca en una frase genérica inventada.
from gemini import call_gemini

PROMPT_TEMPLATE = """Eres el asistente de una app de mantenimiento de coches. Con estos datos
reales de un vehículo, escribe un resumen breve (máximo 2 frases cortas, en español, tono
cercano) para el usuario. Si algo está urgente o pasado de fecha, dilo con claridad y sugiere
la acción concreta. Si todo está bien, dilo con tranquilidad, sin alarmismo. Responde SOLO con
un objeto JSON: {{"summary": "..."}}

Kilometraje actual: {mileage} km
Ritmo medio de uso: {monthly_km} km/mes
Salud calculada: {health}%
Mantenimientos:
{items_text}
"""


def _fallback_summary(items: list[dict], health: float) -> str:
    """Resumen sin IA, calculado directamente de los datos — se usa si Gemini
    falla o no está configurada. Sigue siendo información real, no una frase
    de relleno inventada."""
    urgent = [i for i in items if i.get("level") == "urgent"]
    if urgent:
        names = ", ".join(i["title"] for i in urgent[:2])
        return f"Tienes {len(urgent)} mantenimiento{'s' if len(urgent) != 1 else ''} urgente{'s' if len(urgent) != 1 else ''}: {names}. Échale un vistazo cuanto antes."
    soon = [i for i in items if i.get("level") == "soon"]
    if soon:
        return f"{len(soon)} mantenimiento{'s' if len(soon) != 1 else ''} se acerca{'n' if len(soon) != 1 else ''} — nada urgente todavía, pero no lo dejes para el último día."
    return f"Todo en orden — salud del {round(health * 100)}%. Sigo vigilando por ti. 🛡️"


def generate_vehicle_summary(mileage: int, monthly_km: int, health: float, items: list[dict]) -> str:
    items_text = "\n".join(
        f"- {i['title']}: {i['remainingText']} restantes ({i['level']})" for i in items
    ) or "- (sin mantenimientos todavía)"

    try:
        parsed = call_gemini([{"text": PROMPT_TEMPLATE.format(
            mileage=mileage, monthly_km=monthly_km, health=round(health * 100), items_text=items_text,
        )}])
        summary = (parsed.get("summary") or "").strip()
        if summary:
            return summary
    except Exception as e:
        print(f"Resumen Vigilante: Gemini falló, uso el cálculo directo: {e}", flush=True)

    return _fallback_summary(items, health)
