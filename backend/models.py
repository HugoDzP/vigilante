# models.py — esquema de datos (las tablas se crean solas en el primer arranque)
import uuid
from datetime import datetime, date
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
