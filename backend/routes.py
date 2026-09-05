# routes.py — endpoints /api/*
import re
from datetime import date, datetime, timedelta
from flask import Blueprint, request, jsonify, g
from auth import require_auth
from models import db, Vehicle, LogEntry, Workshop, MileageLog, MaintenanceItem, default_maintenance_for, Feedback, Preference
from vehicle_summary import generate_vehicle_summary
from ocr import parse_invoice_image
from chat_parse import parse_maintenance_text
from places import search_workshops
from config import GEMINI_API_KEY, GOOGLE_PLACES_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
import requests

api = Blueprint("api", __name__, url_prefix="/api")


def compute_health(vehicle: Vehicle) -> float:
    """Salud real del coche — se basa SOLO en el estado de sus mantenimientos
    (cuánto falta o cuánto te has pasado de cada uno), nunca en el kilometraje
    o la edad del coche en sí. Un coche de 150.000 km con todo al día puntúa
    igual de bien que uno de 20.000 km — igual que a una persona no la juzgas
    sana o no por su edad, sino por sus revisiones médicas.
    Estar atrasado penaliza más que "estar en el límite", pero un solo
    mantenimiento atrasado no hunde la nota entera: se promedia con el resto."""
    items = MaintenanceItem.query.filter_by(vehicle_id=vehicle.id, user_id=vehicle.user_id).all()
    if not items:
        return 0.9  # sin mantenimientos todavía (raro, pero por si acaso) — valor neutro
    scores = [it._health_score(vehicle.mileage, vehicle.year) for it in items]
    return round(max(0.05, min(1.0, sum(scores) / len(scores))), 3)


# ---------------- Vehículos ----------------

@api.get("/vehicles")
@require_auth
def list_vehicles():
    vs = Vehicle.query.filter_by(user_id=g.user_id).order_by(Vehicle.created_at).all()
    return jsonify([v.to_dict(health=compute_health(v)) for v in vs])


@api.post("/vehicles")
@require_auth
def create_vehicle():
    d = request.get_json(force=True)
    v = Vehicle(
        user_id=g.user_id,
        brand=d.get("brand", "Mi coche"), model=d.get("model", ""),
        year=int(d.get("year") or 0), plate=d.get("plate", "—"),
        fuel=d.get("fuel", "Diésel"), hp=str(d.get("hp", "—")),
        body_type=d.get("bodyType", "—"), mileage=int(d.get("mileage") or 0),
        eco_label=d.get("label"), photo_url=d.get("photoUri"),
    )
    db.session.add(v)
    db.session.flush()  # asigna v.id antes de crear los mantenimientos que lo referencian
    last_itv = None
    if d.get("lastItvDate"):
        try:
            last_itv = date.fromisoformat(d["lastItvDate"])
        except ValueError:
            pass
    for item in default_maintenance_for(v, last_itv):
        db.session.add(item)
    db.session.commit()
    return jsonify(v.to_dict(health=compute_health(v))), 201


@api.put("/vehicles/<vid>")
@require_auth
def update_vehicle(vid):
    v = Vehicle.query.filter_by(id=vid, user_id=g.user_id).first_or_404()
    d = request.get_json(force=True)
    for src, attr in [("brand", "brand"), ("model", "model"), ("plate", "plate"),
                      ("fuel", "fuel"), ("bodyType", "body_type"), ("label", "eco_label"),
                      ("photoUri", "photo_url")]:
        if src in d:
            setattr(v, attr, d[src])
    if "year" in d: v.year = int(d["year"] or 0)
    if "hp" in d: v.hp = str(d["hp"])
    if "mileage" in d: v.mileage = int(d["mileage"] or 0)
    db.session.commit()
    return jsonify(v.to_dict(health=compute_health(v)))


# ---------------- Historial / mantenimientos ----------------

@api.get("/vehicles/<vid>/history")
@require_auth
def history(vid):
    logs = (LogEntry.query
            .filter_by(user_id=g.user_id, vehicle_id=vid)
            .order_by(LogEntry.date.desc()).all())
    return jsonify([l.to_dict() for l in logs])


# ---------------- Predicciones de mantenimiento ----------------

@api.get("/vehicles/<vid>/maintenance")
@require_auth
def list_maintenance(vid):
    v = Vehicle.query.filter_by(id=vid, user_id=g.user_id).first_or_404()
    items = MaintenanceItem.query.filter_by(vehicle_id=vid, user_id=g.user_id).all()
    out = []
    for it in items:
        past = (LogEntry.query
                .filter_by(user_id=g.user_id, vehicle_id=vid, title=it.title)
                .order_by(LogEntry.date.desc()).limit(3).all())
        past_dicts = [{"title": p.title, "meta": f"{p.mileage:,} km · {p.date.strftime('%b %Y')}".replace(",", "."),
                       "cost": f"{p.cost:g} €"} for p in past]
        out.append(it.to_dict(v, past_dicts))
    return jsonify(out)


@api.post("/vehicles/<vid>/maintenance")
@require_auth
def create_custom_maintenance(vid):
    """Crea un mantenimiento personalizado (fuera de los 3 que se siembran
    automáticamente) — usado desde el formulario 'Añadir a mano' de la app."""
    v = Vehicle.query.filter_by(id=vid, user_id=g.user_id).first_or_404()
    d = request.get_json(force=True)
    title = (d.get("title") or "").strip()
    if not title:
        return jsonify(error="El título es obligatorio"), 400

    it = MaintenanceItem(
        user_id=g.user_id, vehicle_id=vid,
        emoji=d.get("emoji") or "🔧", title=title,
        detail=d.get("detail", ""), notes=d.get("notes", ""),
        est_cost=d.get("estCost") or "—",
        cta_label=d.get("ctaLabel") or "Marcar como hecho hoy",
    )
    interval_km = d.get("intervalKm")
    interval_days = d.get("intervalDays")
    if interval_km:
        it.interval_km = int(interval_km)
        it.last_done_km = int(d.get("lastDoneKm") or v.mileage)
    if interval_days:
        it.interval_days = int(interval_days)
        it.last_done_date = date.fromisoformat(d["lastDoneDate"]) if d.get("lastDoneDate") else date.today()

    db.session.add(it)
    db.session.commit()
    return jsonify(it.to_dict(v)), 201


@api.put("/maintenance/<mid>")
@require_auth
def update_maintenance(mid):
    it = MaintenanceItem.query.filter_by(id=mid, user_id=g.user_id).first_or_404()
    d = request.get_json(force=True)
    if "workshop" in d: it.workshop = d["workshop"]
    if "notes" in d: it.notes = d["notes"]
    if "estCost" in d: it.est_cost = d["estCost"]
    db.session.commit()
    v = Vehicle.query.get(it.vehicle_id)
    return jsonify(it.to_dict(v))


@api.post("/maintenance/<mid>/photos")
@require_auth
def add_maintenance_photo(mid):
    it = MaintenanceItem.query.filter_by(id=mid, user_id=g.user_id).first_or_404()
    d = request.get_json(force=True)
    photos = list(it.photos or [])
    photos.append({"uri": d.get("uri"), "sizeLabel": d.get("sizeLabel", "")})
    it.photos = photos
    db.session.commit()
    v = Vehicle.query.get(it.vehicle_id)
    return jsonify(it.to_dict(v))


@api.delete("/maintenance/<mid>/photos/<int:index>")
@require_auth
def remove_maintenance_photo(mid, index):
    it = MaintenanceItem.query.filter_by(id=mid, user_id=g.user_id).first_or_404()
    photos = list(it.photos or [])
    if 0 <= index < len(photos):
        photos.pop(index)
    it.photos = photos
    db.session.commit()
    v = Vehicle.query.get(it.vehicle_id)
    return jsonify(it.to_dict(v))


@api.post("/maintenance/<mid>/done")
@require_auth
def mark_maintenance_done(mid):
    it = MaintenanceItem.query.filter_by(id=mid, user_id=g.user_id).first_or_404()
    v = Vehicle.query.filter_by(id=it.vehicle_id, user_id=g.user_id).first_or_404()

    log = LogEntry(
        user_id=g.user_id, vehicle_id=v.id, title=it.title, emoji=it.emoji,
        date=date.today(), mileage=v.mileage, place=it.workshop or "—",
        cost=0, photos=[p.get("uri") for p in (it.photos or [])],
    )
    db.session.add(log)

    # reinicia el ciclo: "hecho hoy" a este kilometraje/fecha
    if it.interval_km:
        it.last_done_km = v.mileage
    if it.interval_days or it.kind == "itv":
        it.last_done_date = date.today()
    it.photos = []
    db.session.commit()
    return jsonify(it.to_dict(v)), 200


@api.post("/maintenance")
@require_auth
def add_maintenance():
    d = request.get_json(force=True)
    log = LogEntry(
        user_id=g.user_id,
        vehicle_id=d["vehicleId"],
        title=d.get("title", "Mantenimiento"),
        emoji=d.get("emoji", "🔧"),
        date=date.fromisoformat(d["date"]) if d.get("date") else date.today(),
        mileage=int(d.get("mileage") or 0),
        place=d.get("place", "—"),
        cost=float(d.get("cost") or 0),
        photos=d.get("photos", []),
        notes=d.get("notes", ""),
    )
    db.session.add(log)
    db.session.commit()
    return jsonify(log.to_dict()), 201


# ---------------- Kilometraje periódico ----------------

@api.post("/mileage")
@require_auth
def push_mileage():
    d = request.get_json(force=True)
    vid, km = d["vehicleId"], int(d["km"])
    v = Vehicle.query.filter_by(id=vid, user_id=g.user_id).first_or_404()
    if km < v.mileage:
        return jsonify(error=f"El km ({km}) es menor que el actual ({v.mileage})"), 400
    v.mileage = km
    db.session.add(MileageLog(user_id=g.user_id, vehicle_id=vid, km=km))
    db.session.commit()
    # km/mes estimado a partir de las dos últimas lecturas
    monthly = _monthly_km(vid)
    return jsonify(ok=True, mileage=km, monthlyKm=monthly, health=compute_health(v))


def _monthly_km(vid: str) -> int:
    rows = (MileageLog.query.filter_by(vehicle_id=vid)
            .order_by(MileageLog.at.desc()).limit(2).all())
    if len(rows) < 2:
        return 0
    dk = rows[0].km - rows[1].km
    days = max((rows[0].at - rows[1].at).days, 1)
    return round(dk / days * 30)


# ---------------- Parsing del chat ----------------
# Con GEMINI_API_KEY configurada, entiende frases libres de verdad (vía Gemini).
# Sin ella, o si Gemini falla por lo que sea, cae en un diccionario de palabras
# clave — más simple, pero nunca deja al chat sin responder.

DICT = [
    (r"aceite|filtro de aceite", "Aceite y filtro", "+15.000 km"),
    (r"rueda|neum[aá]tico|llanta", "Neumáticos", "rotar +10.000 km"),
    (r"freno|pastilla|disco", "Frenos", "revisar +20.000 km"),
    (r"bater[ií]a", "Batería 12V", "+4 años"),
    (r"itv", "ITV", "+2 años"),
    (r"habit[aá]culo|polen|antipolen", "Filtro de habitáculo", "+1 año"),
    (r"anticongelante|refrigerante", "Líquido refrigerante", "+2 años"),
    (r"escobilla|limpiaparabrisas", "Escobillas", "+1 año"),
    (r"correa", "Correa de distribución", "+60.000 km"),
    (r"embrague", "Embrague", "revisión"),
    (r"amortiguador|suspensi[oó]n", "Suspensión", "revisar +40.000 km"),
    (r"buj[ií]a", "Bujías", "+40.000 km"),
]


GREETINGS = re.compile(
    r"^\s*(hola|hey|holi|buenas|hi|qu[eé] tal|gracias|vale|ok|okay|adi[oó]s"
    r"|buenos d[ií]as|buenas tardes|buenas noches)[\s!.,¡¿?]*$",
    re.IGNORECASE,
)


def parse_text_fallback(text: str, mileage: int) -> dict:
    t = text.lower()

    if GREETINGS.match(t):
        return {"isMaintenance": False, "reply": "¡Hola! Cuéntame qué le has hecho al coche y lo apunto 🙂"}

    cost = re.search(r"(\d+(?:[.,]\d+)?)\s*€", t)
    km = re.search(r"(\d{1,3}(?:[.\s]\d{3})+|\d{4,6})\s*km", t)
    hit = next(((title, nxt) for p, title, nxt in DICT if re.search(p, t)), None)
    return {
        "isMaintenance": True,
        "title": hit[0] if hit else "Mantenimiento registrado",
        "next": hit[1] if hit else "—",
        "cost": f"{cost.group(1)} €" if cost else "— añadir",
        "km": km.group(1) if km else f"{mileage:,}".replace(",", "."),
    }


@api.post("/parse-text")
@require_auth
def parse_text():
    d = request.get_json(force=True)
    text = d.get("text") or ""
    mileage = int(d.get("mileage") or 0)

    if GEMINI_API_KEY:
        try:
            return jsonify(parse_maintenance_text(text, mileage))
        except Exception as e:
            print(f"Gemini falló en /parse-text, uso el diccionario de respaldo: {e}")

    return jsonify(parse_text_fallback(text, mileage))


# ---------------- OCR de facturas ----------------

@api.post("/parse-invoice")
@require_auth
def parse_invoice():
    if not GEMINI_API_KEY:
        return jsonify(error="OCR no configurado"), 503
    d = request.get_json(force=True)
    image_b64 = d.get("image", "")
    if len(image_b64) < 100:
        return jsonify(error="Imagen vacía"), 400
    try:
        data = parse_invoice_image(image_b64)
    except Exception as e:
        return jsonify(error=f"OCR falló: {e}"), 502
    if data is None:
        return jsonify(error="La imagen no parece una factura"), 422
    return jsonify(data)


# ---------------- Talleres ----------------

@api.get("/places/search")
@require_auth
def places_search():
    if not GOOGLE_PLACES_KEY:
        return jsonify(error="not_configured"), 501
    q = request.args.get("q", "").strip()
    if len(q) < 3:
        return jsonify([])
    try:
        return jsonify(search_workshops(q))
    except Exception as e:
        print(f"Places falló para q={q!r}: {e}", flush=True)  # flush=True: que salga YA en los logs de Render
        return jsonify(error=f"Places falló: {e}"), 502


@api.get("/workshops")
@require_auth
def list_workshops():
    ws = Workshop.query.filter_by(user_id=g.user_id).all()
    return jsonify([w.to_dict() for w in ws])


@api.post("/workshops")
@require_auth
def add_workshop():
    d = request.get_json(force=True)
    w = Workshop(
        user_id=g.user_id, name=d["name"],
        address=d.get("address", "—"), phone=d.get("phone") or "—",
        notes=d.get("notes", ""), place_id=d.get("placeId"),
    )
    db.session.add(w)
    db.session.commit()
    return jsonify(w.to_dict()), 201


@api.delete("/workshops/<wid>")
@require_auth
def delete_workshop(wid):
    w = Workshop.query.filter_by(id=wid, user_id=g.user_id).first_or_404()
    db.session.delete(w)
    db.session.commit()
    return jsonify(ok=True)


# ---------------- Feedback de testers ----------------

@api.post("/feedback")
@require_auth
def send_feedback():
    d = request.get_json(force=True)
    message = (d.get("message") or "").strip()
    if not message:
        return jsonify(error="El mensaje no puede estar vacío"), 400
    fb = Feedback(
        user_id=g.user_id,
        category=d.get("category", "other"),
        message=message,
        app_version=d.get("appVersion"),
        platform=d.get("platform"),
    )
    db.session.add(fb)
    db.session.commit()
    return jsonify(fb.to_dict()), 201


# ---------------- Borrado de cuenta (obligatorio por política de Google Play) ----------------

@api.delete("/account")
@require_auth
def delete_account():
    uid_ = g.user_id

    # 1) borra todos los datos del usuario en nuestra base de datos
    Feedback.query.filter_by(user_id=uid_).delete()
    Preference.query.filter_by(user_id=uid_).delete()
    MileageLog.query.filter_by(user_id=uid_).delete()
    MaintenanceItem.query.filter_by(user_id=uid_).delete()
    LogEntry.query.filter_by(user_id=uid_).delete()
    Workshop.query.filter_by(user_id=uid_).delete()
    Vehicle.query.filter_by(user_id=uid_).delete()
    db.session.commit()

    # 2) borra la cuenta de Supabase Auth en sí (requiere la service_role key)
    if SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY:
        try:
            requests.delete(
                f"{SUPABASE_URL}/auth/v1/admin/users/{uid_}",
                headers={
                    "apikey": SUPABASE_SERVICE_ROLE_KEY,
                    "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
                },
                timeout=10,
            )
        except Exception as e:
            print(f"No se pudo borrar el usuario de Supabase Auth (datos ya borrados): {e}")

    return jsonify(ok=True)


# ---------------- Resumen Vigilante (con IA, cacheado unas horas) ----------------

SUMMARY_TTL = timedelta(hours=6)  # no regeneramos en cada apertura — Gemini cuesta y no hace falta tanta frecuencia

@api.get("/vehicles/<vid>/summary")
@require_auth
def vehicle_summary(vid):
    v = Vehicle.query.filter_by(id=vid, user_id=g.user_id).first_or_404()
    fresh = v.ai_summary and v.ai_summary_at and (datetime.utcnow() - v.ai_summary_at) < SUMMARY_TTL
    force = request.args.get("force") == "1"

    if fresh and not force:
        return jsonify(summary=v.ai_summary, cached=True)

    items = MaintenanceItem.query.filter_by(vehicle_id=vid, user_id=g.user_id).all()
    items_dicts = [it.to_dict(v) for it in items]
    monthly = _monthly_km(vid)
    v.ai_summary = generate_vehicle_summary(v.mileage, monthly, compute_health(v), items_dicts)
    v.ai_summary_at = datetime.utcnow()
    db.session.commit()
    return jsonify(summary=v.ai_summary, cached=False)


# ---------------- Preferencias (umbrales de aviso personalizables) ----------------

@api.get("/preferences")
@require_auth
def get_preferences():
    p = Preference.query.get(g.user_id)
    if not p:
        p = Preference(user_id=g.user_id, reminder_lead_km=1000, reminder_lead_days=60)  # valores por defecto, sin guardar todavía
    return jsonify(p.to_dict())


@api.put("/preferences")
@require_auth
def update_preferences():
    d = request.get_json(force=True)
    p = Preference.query.get(g.user_id)
    if not p:
        p = Preference(user_id=g.user_id)
        db.session.add(p)
    if "reminderLeadKm" in d: p.reminder_lead_km = max(50, int(d["reminderLeadKm"]))
    if "reminderLeadDays" in d: p.reminder_lead_days = max(1, int(d["reminderLeadDays"]))
    db.session.commit()
    return jsonify(p.to_dict())
