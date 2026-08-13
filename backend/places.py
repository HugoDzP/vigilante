# places.py — Google Places API (New) · Text Search
import requests
from config import GOOGLE_PLACES_KEY

URL = "https://places.googleapis.com/v1/places:searchText"
FIELDS = "places.id,places.displayName,places.formattedAddress,places.nationalPhoneNumber,places.location"


def search_workshops(query: str, limit: int = 5) -> list[dict]:
    """Busca talleres/comercios de automoción. La API key vive SOLO aquí,
    nunca en la app móvil."""
    if not GOOGLE_PLACES_KEY:
        return []

    resp = requests.post(
        URL,
        headers={
            "Content-Type": "application/json",
            "X-Goog-Api-Key": GOOGLE_PLACES_KEY,
            "X-Goog-FieldMask": FIELDS,
        },
        json={
            "textQuery": f"taller {query}" if "taller" not in query.lower() else query,
            "languageCode": "es",
            "regionCode": "ES",
            "maxResultCount": limit,
        },
        timeout=8,
    )
    resp.raise_for_status()
    out = []
    for p in resp.json().get("places", []):
        loc = p.get("location", {})
        out.append({
            "placeId": p.get("id"),
            "name": p.get("displayName", {}).get("text", "—"),
            "address": p.get("formattedAddress", "—"),
            "phone": p.get("nationalPhoneNumber"),
            "lat": loc.get("latitude"),
            "lng": loc.get("longitude"),
        })
    return out
