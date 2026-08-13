# models.py — esquema de datos (las tablas se crean solas en el primer arranque)
import uuid
from datetime import datetime, date, timedelta
from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()


def uid() -> str:
    return uuid.uuid4().hex


class Vehicle(db.Model):
    __tablename__ = "vehicles"
    id = db.Column(db.String(32), primary_key=True, default=uid)
    user_id = db.Column(db.String(36), index=True, nullable=False)
    brand = db.Column(db.String(60), nullable=False)
    model = db.Column(db.String(80), default="")
    year = db.Column(db.Integer, default=0)
    plate = db.Column(db.String(16), default="—")
    fuel = db.Column(db.String(20), default="Diésel")       # Diésel/Gasolina/Híbrido/Híbrido ench./Eléctrico
    hp = db.Column(db.String(10), default="—")
    body_type = db.Column(db.String(30), default="—")
    mileage = db.Column(db.Integer, default=0)
    eco_label = db.Column(db.String(5), nullable=True)       # override: B/C/ECO/0; null = auto
    photo_url = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            "id": self.id, "brand": self.brand, "model": self.model,
            "year": self.year, "plate": self.plate, "fuel": self.fuel,
            "hp": self.hp, "bodyType": self.body_type, "mileage": self.mileage,
            "label": self.eco_label, "photoUri": self.photo_url,
        }


class LogEntry(db.Model):
    __tablename__ = "logs"
    id = db.Column(db.String(32), primary_key=True, default=uid)
    user_id = db.Column(db.String(36), index=True, nullable=False)
    vehicle_id = db.Column(db.String(32), db.ForeignKey("vehicles.id"), index=True, nullable=False)
    title = db.Column(db.String(120), nullable=False)
    emoji = db.Column(db.String(8), default="🔧")
    date = db.Column(db.Date, default=date.today)
    mileage = db.Column(db.Integer, default=0)
    place = db.Column(db.String(120), default="—")
    cost = db.Column(db.Float, default=0)
    photos = db.Column(db.JSON, default=list)                # lista de URLs (Supabase Storage)
    notes = db.Column(db.Text, default="")

    def to_dict(self):
        return {
            "id": self.id, "vehicleId": self.vehicle_id, "title": self.title,
            "emoji": self.emoji, "date": self.date.isoformat(),
            "mileage": self.mileage, "place": self.place, "cost": self.cost,
            "photos": self.photos or [], "notes": self.notes,
        }


class MaintenanceItem(db.Model):
    """Un mantenimiento recurrente (aceite, ITV, frenos...). El progreso y la urgencia
    se CALCULAN al leer (to_dict), a partir del kilometraje actual del vehículo — así
    nunca se desincronizan: basta con actualizar vehicle.mileage."""
    __tablename__ = "maintenance_items"
    id = db.Column(db.String(32), primary_key=True, default=uid)
    user_id = db.Column(db.String(36), index=True, nullable=False)
    vehicle_id = db.Column(db.String(32), db.ForeignKey("vehicles.id"), index=True, nullable=False)
    emoji = db.Column(db.String(8), default="🔧")
    title = db.Column(db.String(120), nullable=False)
    detail = db.Column(db.String(200), default="")
    notes = db.Column(db.Text, default="")
    workshop = db.Column(db.String(120), nullable=True)
    cta_label = db.Column(db.String(60), default="Marcar como hecho hoy")
    interval_km = db.Column(db.Integer, nullable=True)     # p.ej. 15000 (aceite)
    interval_days = db.Column(db.Integer, nullable=True)   # p.ej. 730 (ITV, 2 años)
    last_done_km = db.Column(db.Integer, default=0)
    last_done_date = db.Column(db.Date, nullable=True)
    est_cost = db.Column(db.String(20), default="—")       # texto libre, p.ej. "~90 €"
    photos = db.Column(db.JSON, default=list)               # [{uri, sizeLabel}]
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def _urgency(self, vehicle_mileage: int):
        remaining_km = remaining_days = None
        if self.interval_km:
            remaining_km = (self.last_done_km or 0) + self.interval_km - vehicle_mileage
        if self.interval_days and self.last_done_date:
            due = self.last_done_date + timedelta(days=self.interval_days)
            remaining_days = (due - date.today()).days

        if remaining_km is not None and self.interval_km:
            progress = min(max(1 - remaining_km / self.interval_km, 0), 1)
            remaining_text = f"{remaining_km:,} km".replace(",", ".") if remaining_km >= 0 else "atrasado"
        elif remaining_days is not None and self.interval_days:
            progress = min(max(1 - remaining_days / self.interval_days, 0), 1)
            remaining_text = f"{remaining_days} días" if remaining_days >= 0 else "atrasado"
        else:
            progress, remaining_text = 0.0, "—"

        level = "urgent" if progress >= 0.85 else "soon" if progress >= 0.55 else "ok"
        return level, remaining_text, progress, remaining_km, remaining_days

    def to_dict(self, vehicle_mileage: int, past_occurrences=None):
        level, remaining_text, progress, remaining_km, remaining_days = self._urgency(vehicle_mileage)

        stats = [[remaining_text, "Restantes"], [self.est_cost, "Coste estimado"]]
        if self.interval_km:
            next_at = (self.last_done_km or 0) + self.interval_km
            stats += [[f"{next_at:,} km".replace(",", "."), "Próximo a"],
                      [f"{self.interval_km:,} km".replace(",", "."), "Intervalo"]]
        elif self.interval_days and self.last_done_date:
            due = self.last_done_date + timedelta(days=self.interval_days)
            stats += [[due.strftime("%b %Y"), "Vence"], [f"{self.interval_days // 365} años", "Intervalo"]]

        return {
            "id": self.id, "vehicleId": self.vehicle_id, "emoji": self.emoji,
            "title": self.title, "detail": self.detail, "remainingText": remaining_text,
            "progress": round(progress, 3), "level": level, "stats": stats, "notes": self.notes,
            "photos": self.photos or [], "workshop": self.workshop,
            "pastOccurrences": past_occurrences or [], "ctaLabel": self.cta_label,
        }


class Workshop(db.Model):
    __tablename__ = "workshops"
    id = db.Column(db.String(32), primary_key=True, default=uid)
    user_id = db.Column(db.String(36), index=True, nullable=False)
    name = db.Column(db.String(120), nullable=False)
    address = db.Column(db.String(200), default="—")
    phone = db.Column(db.String(30), default="—")
    notes = db.Column(db.String(200), default="")
    place_id = db.Column(db.String(120), nullable=True)      # id de Google Places, si vino de ahí

    def to_dict(self):
        return {"id": self.id, "name": self.name, "address": self.address,
                "phone": self.phone, "notes": self.notes}


class MileageLog(db.Model):
    """Histórico de lecturas de km → permite calcular km/mes y predicciones."""
    __tablename__ = "mileage_logs"
    id = db.Column(db.String(32), primary_key=True, default=uid)
    user_id = db.Column(db.String(36), index=True, nullable=False)
    vehicle_id = db.Column(db.String(32), index=True, nullable=False)
    km = db.Column(db.Integer, nullable=False)
    at = db.Column(db.DateTime, default=datetime.utcnow)


def default_maintenance_for(vehicle: "Vehicle") -> list[MaintenanceItem]:
    """Mantenimientos típicos con los que arranca un vehículo recién añadido.
    Usa el kilometraje/fecha actuales como punto de partida — no sabemos su
    historial real, así que no aparecen como urgentes desde el primer día."""
    items = []
    if vehicle.fuel != "Eléctrico":
        items.append(MaintenanceItem(
            user_id=vehicle.user_id, vehicle_id=vehicle.id, emoji="🛢️",
            title="Aceite y filtro", detail="Cada 15.000 km",
            interval_km=15000, last_done_km=vehicle.mileage, est_cost="~90 €",
            notes="Consulta el manual de tu coche para el tipo de aceite recomendado.",
            cta_label="Programar recordatorio",
        ))
    items.append(MaintenanceItem(
        user_id=vehicle.user_id, vehicle_id=vehicle.id, emoji="📅",
        title="ITV", detail="Cada 2 años (coches de más de 4 años)",
        interval_days=730, last_done_date=date.today(), est_cost="~45 €",
        notes="Pide cita previa con antelación en tu estación más cercana.",
        cta_label="Pedir cita ITV",
    ))
    items.append(MaintenanceItem(
        user_id=vehicle.user_id, vehicle_id=vehicle.id, emoji="⚠️",
        title="Pastillas de freno", detail="Revisión recomendada cada 40.000 km",
        interval_km=40000, last_done_km=vehicle.mileage, est_cost="~135 €",
        notes="El desgaste depende del estilo de conducción — revisa antes si notas ruidos o vibración al frenar.",
        cta_label="Marcar como hecho hoy",
    ))
    return items
