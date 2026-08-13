// src/lib/api.ts — cliente del backend Flask (Render) con degradación elegante
import { getAccessToken } from './supabase';

const BASE = process.env.EXPO_PUBLIC_API_URL ?? '';
export const HAS_BACKEND = !!BASE;

async function req<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = await getAccessToken();
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
  });
  if (!res.ok) throw new Error(`API ${res.status}: ${await res.text()}`);
  return res.json();
}

// ---------- Parsing de texto (chat) ----------
export interface ParsedMaintenance {
  title: string; cost: string; km: string; next: string;
}

/** Parser local por diccionario: fallback cuando no hay backend */
export function parseTextLocal(text: string, mileage: number): ParsedMaintenance {
  const t = text.toLowerCase();
  const cost = t.match(/(\d+(?:[.,]\d+)?)\s*€/)?.[1] ?? null;
  const km = t.match(/(\d{1,3}(?:[.\s]\d{3})+|\d{4,6})\s*km/)?.[1] ?? null;
  const dict: [RegExp, string, string][] = [
    [/aceite|filtro de aceite/, 'Aceite y filtro', '+15.000 km'],
    [/rueda|neum[aá]tico|llanta/, 'Neumáticos', 'rotar +10.000 km'],
    [/freno|pastilla|disco/, 'Frenos', 'revisar +20.000 km'],
    [/bater[ií]a/, 'Batería 12V', '+4 años'],
    [/itv/, 'ITV', '+2 años'],
    [/habit[aá]culo|polen|antipolen/, 'Filtro de habitáculo', '+1 año'],
    [/anticongelante|refrigerante/, 'Líquido refrigerante', '+2 años'],
    [/escobilla|limpiaparabrisas/, 'Escobillas', '+1 año'],
  ];
  const hit = dict.find(([re]) => re.test(t));
  return {
    title: hit?.[1] ?? 'Mantenimiento registrado',
    next: hit?.[2] ?? '—',
    cost: cost ? `${cost} €` : '— añadir',
    km: km ?? mileage.toLocaleString('es-ES'),
  };
}

export async function parseText(text: string, mileage: number): Promise<ParsedMaintenance> {
  if (!HAS_BACKEND) return parseTextLocal(text, mileage);
  try {
    return await req<ParsedMaintenance>('/api/parse-text', {
      method: 'POST', body: JSON.stringify({ text, mileage }),
    });
  } catch {
    return parseTextLocal(text, mileage); // si Render está dormido, no bloqueamos al usuario
  }
}

// ---------- OCR de facturas ----------
export interface InvoiceData {
  title: string; date: string; cost: string; km: string; workshop: string | null;
}

/** Manda la foto en base64 al backend, que llama a la API de Claude para extraer datos */
export async function parseInvoice(base64: string): Promise<InvoiceData | null> {
  if (!HAS_BACKEND) return null; // sin backend no hay OCR: la app lo comunica y ofrece entrada manual
  return req<InvoiceData>('/api/parse-invoice', {
    method: 'POST', body: JSON.stringify({ image: base64 }),
  });
}

// ---------- Talleres (Google Places vía backend) ----------
export interface PlaceResult {
  name: string; address: string; phone: string | null;
  lat: number; lng: number; placeId: string;
}

export async function searchPlaces(query: string): Promise<PlaceResult[]> {
  if (!HAS_BACKEND) return []; // sin backend: alta manual de talleres
  return req<PlaceResult[]>(`/api/places/search?q=${encodeURIComponent(query)}`);
}

// ---------- Sincronización (cuando exista el backend) ----------
export const sync = {
  vehicles: () => req('/api/vehicles'),
  createVehicle: (v: unknown) => req('/api/vehicles', { method: 'POST', body: JSON.stringify(v) }),
  updateVehicle: (id: string, v: unknown) => req(`/api/vehicles/${id}`, { method: 'PUT', body: JSON.stringify(v) }),
  history: (vehicleId: string) => req(`/api/vehicles/${vehicleId}/history`),
  pushLog: (log: unknown) => req('/api/maintenance', { method: 'POST', body: JSON.stringify(log) }),
  pushMileage: (vehicleId: string, km: number) =>
    req('/api/mileage', { method: 'POST', body: JSON.stringify({ vehicleId, km }) }),

  // Predicciones de mantenimiento
  maintenance: (vehicleId: string) => req(`/api/vehicles/${vehicleId}/maintenance`),
  updateMaintenance: (id: string, v: unknown) => req(`/api/maintenance/${id}`, { method: 'PUT', body: JSON.stringify(v) }),
  addMaintenancePhoto: (id: string, photo: { uri: string; sizeLabel: string }) =>
    req(`/api/maintenance/${id}/photos`, { method: 'POST', body: JSON.stringify(photo) }),
  removeMaintenancePhoto: (id: string, index: number) =>
    req(`/api/maintenance/${id}/photos/${index}`, { method: 'DELETE' }),
  maintenanceDone: (id: string) => req(`/api/maintenance/${id}/done`, { method: 'POST' }),
};
