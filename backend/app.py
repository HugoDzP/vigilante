# app.py — factory de la aplicación
from flask import Flask, jsonify
from flask_cors import CORS
from config import DATABASE_URL
from models import db
from routes import api


def create_app() -> Flask:
    app = Flask(__name__)
    app.config["SQLALCHEMY_DATABASE_URI"] = DATABASE_URL
    app.config["SQLALCHEMY_ENGINE_OPTIONS"] = {"pool_pre_ping": True, "pool_recycle": 280}

    CORS(app)  # la app móvil llama desde cualquier origen
    db.init_app(app)
    app.register_blueprint(api)

    with app.app_context():
        db.create_all()  # crea las tablas en el primer arranque

    @app.get("/health")
    def health():
        return jsonify(ok=True, service="vigilante-api")

    @app.errorhandler(404)
    def not_found(_):
        return jsonify(error="No encontrado"), 404

    @app.errorhandler(500)
    def server_error(e):
        return jsonify(error="Error interno"), 500

    return app


if __name__ == "__main__":
    create_app().run(debug=True)
