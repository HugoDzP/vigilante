# routes.py — endpoints /api/*
import re
from datetime import date, datetime
from flask import Blueprint, request, jsonify, g
from auth import require_auth
from models import db, Vehicle, LogEntry, Workshop, MileageLog
from ocr import parse_invoice_image
from places import search_workshops
from config import ANTHROPIC_API_KEY, GOOGLE_PLACES_KEY

api = Blueprint("api", __name__, url_prefix="/api")


# ---------------- Vehículos ----------------

@api.get("/vehicles")
@require_auth
def list_vehicles():
    vs = Vehicle.query.filter_by(user_id=g.user_id).order_by(Vehicle.created_at).all()
    return jsonify([v.to_dict() for v in vs])


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
    db.session.commit()
    return jsonify(v.to_dict()), 201


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
    return jsonify(v.to_dict())


# ---------------- Historial / mantenimientos ----------------

@api.get("/vehicles/<vid>/history")
@require_auth
def history(vid):
    logs = (LogEntry.query
            .filter_by(user_id=g.user_id, vehicle_id=vid)
            .order_by(LogEntry.date.desc()).all())
    return jsonify([l.to_dict() for l in logs])


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
    return jsonify(ok=True, mileage=km, monthlyKm=monthly)


def _monthly_km(vid: str) -> int:
    rows = (MileageLog.query.filter_by(vehicle_id=vid)
            .order_by(MileageLog.at.desc()).limit(2).all())
    if len(rows) < 2:
        return 0
    dk = rows[0].km - rows[1].km
    days = max((rows[0].at - rows[1].at).days, 1)
    return round(dk / days * 30)


# ---------------- Parsing del chat ----------------

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


@api.post("/parse-text")
@require_auth
def parse_text():
    d = request.get_json(force=True)
    text = (d.get("text") or "").lower()
    mileage = int(d.get("mileage") or 0)

    cost = re.search(r"(\d+(?:[.,]\d+)?)\s*€", text)
    km = re.search(r"(\d{1,3}(?:[.\s]\d{3})+|\d{4,6})\s*km", text)
    hit = next(((t, n) for p, t, n in DICT if re.search(p, text)), None)

    return jsonify({
        "title": hit[0] if hit else "Mantenimiento registrado",
        "next": hit[1] if hit else "—",
        "cost": f"{cost.group(1)} €" if cost else "— añadir",
        "km": km.group(1) if km else f"{mileage:,}".replace(",", "."),
    })


# ---------------- OCR de facturas ----------------

@api.post("/parse-invoice")
@require_auth
def parse_invoice():
    if not ANTHROPIC_API_KEY:
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
        return jsonify([])
    q = request.args.get("q", "").strip()
    if len(q) < 3:
        return jsonify([])
    try:
        return jsonify(search_workshops(q))
    except Exception as e:
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
