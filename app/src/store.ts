// src/store.ts — estado global (Zustand)
import { create } from 'zustand';
import type { Level } from './theme';
import type { Fuel, EcoCode } from './lib/eco';
import { sync, HAS_BACKEND } from './lib/api';

export interface Vehicle {
  id: string; name: string; short: string; initial: string;
  brand: string; model: string; year: number; plate: string;
  fuel: Fuel; hp: number | string; bodyType: string;
  mileage: number; monthlyKm: number; health: number;
  label: EcoCode | null;          // override manual; null = auto (combustible+año)
  photoUri?: string; notes?: string; summary: string;
}

export interface MaintenanceItem {
  id: string; vehicleId: string; emoji: string;
  title: string; detail: string; remainingText: string;
  progress: number; level: Level;
  stats: [string, string][]; notes: string;
  photos: { uri: string; sizeLabel: string }[];
  workshop: string | null;
  pastOccurrences: { title: string; meta: string; cost: string }[];
  ctaLabel: string;
}

export interface LogEntry {
  id: string; vehicleId: string; emoji: string; title: string;
  dateLabel: string; monthKey: string; mileage: number;
  place: string; cost: number; photos: string[]; maintenanceId?: string;
}

export interface Workshop { id: string; name: string; address: string; phone: string; notes: string; }

interface S {
  vehicles: Vehicle[]; currentVehicleId: string;
  maintenance: MaintenanceItem[]; history: LogEntry[]; workshops: Workshop[];
  mileageAskDismissed: Record<string, boolean>;
  hydrated: boolean;                 // true una vez cargados datos reales del backend
  historyLoaded: Record<string, boolean>;

  currentVehicle: () => Vehicle | undefined;
  maintenanceFor: (id: string) => MaintenanceItem[];
  historyFor: (id: string) => LogEntry[];

  switchVehicle: (id: string) => void;
  upsertVehicle: (v: Omit<Vehicle, 'id' | 'summary'> & { id?: string }) => string;
  remapVehicleId: (oldId: string, newId: string) => void;
  setVehiclePhoto: (id: string, uri?: string) => void;
  updateMileage: (id: string, km: number) => void;
  dismissMileageAsk: (id: string) => void;

  addPhoto: (mid: string, p: { uri: string; sizeLabel: string }) => void;
  removePhoto: (mid: string, index: number) => void;
  assignWorkshop: (mid: string, name: string | null) => void;
  markDone: (mid: string) => void;
  addLog: (e: Omit<LogEntry, 'id'>) => void;

  addWorkshop: (w: Omit<Workshop, 'id'>) => void;
  removeWorkshop: (id: string) => void;

  hydrateFromBackend: () => Promise<void>;
  loadHistoryFor: (vehicleId: string) => Promise<void>;
  resetToDemo: () => void;
}

const monthKeyNow = () => {
  const s = new Date().toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
  return s.charAt(0).toUpperCase() + s.slice(1);
};
const dateLabelNow = () => new Date().toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
const historyInFlight = new Set<string>(); // evita fetches duplicados si se llama varias veces seguidas

// Datos de ejemplo — solo se usan en modo demo (sin backend real conectado)
function demoSeed() {
  return {
    vehicles: [
      {
        id: 'merc', name: 'Mercedes C 220d', short: 'Mercedes', initial: 'M',
        brand: 'Mercedes', model: 'C 220d', year: 2019, plate: '4827 KLM',
        fuel: 'Diésel' as Fuel, hp: 194, bodyType: 'Berlina',
        mileage: 128_450, monthlyKm: 1_240, health: 0.82, label: null,
        summary: 'Llevas 4 mantenimientos al día en 2026 y has ahorrado ~180 € adelantándote a las averías. Solo te quedan los frenos para tenerlo impecable. 💪',
      },
      {
        id: 'lexus', name: 'Lexus IS 300h', short: 'Lexus', initial: 'L',
        brand: 'Lexus', model: 'IS 300h', year: 2021, plate: '7301 MNP',
        fuel: 'Híbrido' as Fuel, hp: 223, bodyType: 'Berlina',
        mileage: 64_210, monthlyKm: 860, health: 0.94, label: null,
        summary: 'El Lexus está impecable: 94% de salud y todo al día. El híbrido apenas desgasta frenos — sigue así. ✨',
      },
    ] as Vehicle[],
    maintenance: [
      {
        id: 'brakes', vehicleId: 'merc', emoji: '⚠️', title: 'Pastillas de freno',
        detail: 'Delanteras · taller recomendado', remainingText: '480 km',
        progress: 0.92, level: 'urgent' as Level, workshop: 'Taller Premier',
        stats: [['480 km', 'Restantes'], ['~135 €', 'Coste estimado'], ['52.000 km', 'Última vez'], ['Delanteras', 'Posición']] as [string, string][],
        notes: 'Vibración leve al frenar fuerte. Cambiar pastillas y revisar discos en el mismo taller.',
        photos: [],
        pastOccurrences: [
          { title: 'Pastillas + discos del.', meta: '52.000 km · mar 2023', cost: '210 €' },
          { title: 'Pastillas traseras', meta: '78.400 km · ene 2024', cost: '95 €' },
        ],
        ctaLabel: 'Marcar como hecho hoy',
      },
      {
        id: 'oil', vehicleId: 'merc', emoji: '🛢️', title: 'Aceite y filtro',
        detail: '5W-30 Long Life · cada 15.000 km', remainingText: '1.550 km',
        progress: 0.68, level: 'soon' as Level, workshop: 'Taller Premier',
        stats: [['1.550 km', 'Restantes'], ['89 €', 'Último coste'], ['130.000 km', 'Próximo a'], ['15.000 km', 'Intervalo']] as [string, string][],
        notes: 'Aceite 5W-30 Long Life (norma MB 229.52). Filtro Mann HU 6004x. Guarda el ticket en fotos.',
        photos: [],
        pastOccurrences: [
          { title: 'Aceite y filtro', meta: '128.450 km · jun 2026', cost: '89 €' },
          { title: 'Aceite y filtro', meta: '113.500 km · oct 2025', cost: '85 €' },
        ],
        ctaLabel: 'Programar recordatorio',
      },
      {
        id: 'itv', vehicleId: 'merc', emoji: '📅', title: 'ITV',
        detail: 'Estación de Toledo · cita previa', remainingText: '92 días',
        progress: 0.24, level: 'ok' as Level, workshop: null,
        stats: [['92 días', 'Restantes'], ['~45 €', 'Coste estimado'], ['sep 2026', 'Vence'], ['Toledo', 'Estación']] as [string, string][],
        notes: 'Pide cita previa online — en verano la estación de Toledo se llena.',
        photos: [],
        pastOccurrences: [{ title: 'ITV favorable', meta: 'sep 2024', cost: '44 €' }],
        ctaLabel: 'Pedir cita ITV',
      },
      {
        id: 'oil-lx', vehicleId: 'lexus', emoji: '🛢️', title: 'Aceite y filtro',
        detail: '0W-20 híbrido · cada 15.000 km', remainingText: '6.800 km',
        progress: 0.42, level: 'ok' as Level, workshop: null,
        stats: [['6.800 km', 'Restantes'], ['—', 'Último coste'], ['71.000 km', 'Próximo a'], ['15.000 km', 'Intervalo']] as [string, string][],
        notes: 'Aceite 0W-20 específico para híbridos Toyota/Lexus.',
        photos: [], pastOccurrences: [], ctaLabel: 'Programar recordatorio',
      },
    ] as MaintenanceItem[],
    history: [
      { id: 'h1', vehicleId: 'merc', emoji: '🛢️', title: 'Aceite y filtro', dateLabel: '11 jun', monthKey: 'Junio 2026', mileage: 128_450, place: 'Taller Premier', cost: 89, photos: [], maintenanceId: 'oil' },
      { id: 'h2', vehicleId: 'merc', emoji: '🛞', title: 'Rotación de neumáticos', dateLabel: '2 jun', monthKey: 'Junio 2026', mileage: 127_900, place: 'DIY en Consuegra', cost: 0, photos: [] },
      { id: 'h3', vehicleId: 'merc', emoji: '🌬️', title: 'Filtro de habitáculo', dateLabel: '14 abr', monthKey: 'Abril 2026', mileage: 125_300, place: 'DIY', cost: 24, photos: [] },
      { id: 'h4', vehicleId: 'merc', emoji: '🔋', title: 'Batería 12V', dateLabel: '3 abr', monthKey: 'Abril 2026', mileage: 124_880, place: 'Norauto Madrid Río', cost: 139, photos: [] },
    ] as LogEntry[],
    workshops: [
      { id: 'w1', name: 'Taller Premier', address: 'Pol. Ind. Consuegra', phone: '925 48 XX XX', notes: 'El de confianza · pregunta por Andrés' },
      { id: 'w2', name: 'Norauto Madrid Río', address: 'C.C. Madrid Río', phone: '91 552 XX XX', notes: 'Baterías y neumáticos' },
    ] as Workshop[],
  };
}

export const useVigilante = create<S>((set, get) => ({
  ...demoSeed(),
  currentVehicleId: 'merc',
  mileageAskDismissed: {},
  hydrated: false,
  historyLoaded: {},

  currentVehicle: () => {
    const { vehicles, currentVehicleId } = get();
    return vehicles.find(v => v.id === currentVehicleId) ?? vehicles[0];
  },
  maintenanceFor: id => get().maintenance.filter(m => m.vehicleId === id),
  historyFor: id => {
    get().loadHistoryFor(id); // dispara la carga en segundo plano si hace falta (no bloquea)
    return get().history.filter(h => h.vehicleId === id);
  },

  switchVehicle: id => set({ currentVehicleId: id }),

  upsertVehicle: v => {
    const id = v.id ?? `v${Date.now()}`;
    const isNew = !v.id;
    set(s => {
      const exists = s.vehicles.some(x => x.id === id);
      const base: Vehicle = {
        summary: 'Vehículo recién añadido — registra su primer mantenimiento desde el Chat y empiezo a vigilarlo. 🛡️',
        ...(exists ? s.vehicles.find(x => x.id === id)! : { health: 0.9, monthlyKm: 0 } as any),
        ...v, id,
        name: `${v.brand} ${v.model}`.trim(),
        short: v.brand, initial: v.brand.charAt(0).toUpperCase(),
      };
      const maintenance = exists ? s.maintenance : [...s.maintenance, {
        id: `itv-${id}`, vehicleId: id, emoji: '📅', title: 'ITV',
        detail: 'Calculada desde la matriculación', remainingText: '—',
        progress: 0.08, level: 'ok' as Level, workshop: null,
        stats: [['—', 'Restantes'], ['~45 €', 'Coste estimado'], ['—', 'Vence'], ['—', 'Estación']] as [string, string][],
        notes: 'Añade la fecha de tu última ITV para calcular el vencimiento.',
        photos: [], pastOccurrences: [], ctaLabel: 'Programar recordatorio',
      }];
      return {
        vehicles: exists ? s.vehicles.map(x => (x.id === id ? base : x)) : [...s.vehicles, base],
        maintenance, currentVehicleId: id,
      };
    });

    // Guarda en el backend en segundo plano — la UI ya se actualizó, no bloquea la navegación
    if (HAS_BACKEND) {
      const payload = {
        brand: v.brand, model: v.model, year: v.year, plate: v.plate,
        fuel: v.fuel, hp: v.hp, bodyType: v.bodyType, mileage: v.mileage,
        label: v.label, photoUri: v.photoUri,
      };
      if (isNew) {
        sync.createVehicle(payload)
          .then((res: any) => { if (res?.id && res.id !== id) get().remapVehicleId(id, res.id); })
          .catch(e => console.warn('No se pudo guardar el vehículo en el backend:', e));
      } else {
        sync.updateVehicle(id, payload).catch(e => console.warn('No se pudo actualizar el vehículo en el backend:', e));
      }
    }
    return id;
  },

  remapVehicleId: (oldId, newId) => set(s => ({
    vehicles: s.vehicles.map(v => (v.id === oldId ? { ...v, id: newId } : v)),
    maintenance: s.maintenance.map(m => (m.vehicleId === oldId ? { ...m, vehicleId: newId } : m)),
    history: s.history.map(h => (h.vehicleId === oldId ? { ...h, vehicleId: newId } : h)),
    currentVehicleId: s.currentVehicleId === oldId ? newId : s.currentVehicleId,
  })),

  setVehiclePhoto: (id, uri) =>
    set(s => ({ vehicles: s.vehicles.map(v => (v.id === id ? { ...v, photoUri: uri } : v)) })),

  updateMileage: (id, km) =>
    set(s => ({
      vehicles: s.vehicles.map(v => (v.id === id ? { ...v, mileage: km } : v)),
      mileageAskDismissed: { ...s.mileageAskDismissed, [id]: true },
    })),

  dismissMileageAsk: id =>
    set(s => ({ mileageAskDismissed: { ...s.mileageAskDismissed, [id]: true } })),

  addPhoto: (mid, p) =>
    set(s => ({ maintenance: s.maintenance.map(m => (m.id === mid ? { ...m, photos: [...m.photos, p] } : m)) })),

  removePhoto: (mid, index) =>
    set(s => ({
      maintenance: s.maintenance.map(m =>
        m.id === mid ? { ...m, photos: m.photos.filter((_, i) => i !== index) } : m
      ),
    })),

  assignWorkshop: (mid, name) =>
    set(s => ({ maintenance: s.maintenance.map(m => (m.id === mid ? { ...m, workshop: name } : m)) })),

  addLog: e => set(s => ({ history: [{ ...e, id: `h${Date.now()}` }, ...s.history] })),

  markDone: mid => {
    const m = get().maintenance.find(x => x.id === mid);
    if (!m) return;
    const car = get().vehicles.find(v => v.id === m.vehicleId)!;
    get().addLog({
      vehicleId: m.vehicleId, emoji: m.emoji, title: m.title,
      dateLabel: dateLabelNow(), monthKey: monthKeyNow(),
      mileage: car.mileage, place: m.workshop ?? '—', cost: 0,
      photos: m.photos.map(p => p.uri), maintenanceId: m.id,
    });
    set(s => ({
      maintenance: s.maintenance.map(x =>
        x.id === mid ? { ...x, progress: 0.02, level: 'ok' as Level, remainingText: '✓ hoy' } : x
      ),
    }));
  },

  addWorkshop: w => set(s => ({ workshops: [...s.workshops, { ...w, id: `w${Date.now()}` }] })),
  removeWorkshop: id => set(s => ({ workshops: s.workshops.filter(w => w.id !== id) })),

  // ---------- Sincronización con el backend ----------
  hydrateFromBackend: async () => {
    if (!HAS_BACKEND) return; // sin backend: se queda con los datos demo
    try {
      const raw = await sync.vehicles() as any[];
      const vehicles: Vehicle[] = raw.map(v => ({
        id: v.id, name: `${v.brand} ${v.model}`.trim(), short: v.brand,
        initial: (v.brand?.[0] ?? '?').toUpperCase(),
        brand: v.brand, model: v.model, year: v.year, plate: v.plate,
        fuel: v.fuel, hp: v.hp, bodyType: v.bodyType, mileage: v.mileage,
        health: 0.9, monthlyKm: 0, label: v.label, photoUri: v.photoUri,
        summary: 'Registra tu primer mantenimiento desde el Chat y empiezo a vigilarlo. 🛡️',
      }));
      set({
        vehicles,
        currentVehicleId: vehicles[0]?.id ?? '',
        maintenance: [], history: [], historyLoaded: {},
        hydrated: true,
      });
    } catch (e) {
      console.warn('No se pudo cargar el garaje del backend:', e);
    }
  },

  loadHistoryFor: async (vehicleId: string) => {
    if (!HAS_BACKEND || get().historyLoaded[vehicleId] || historyInFlight.has(vehicleId)) return;
    historyInFlight.add(vehicleId);
    try {
      const raw = await sync.history(vehicleId) as any[];
      const entries: LogEntry[] = raw.map(l => ({
        id: l.id, vehicleId: l.vehicleId, emoji: l.emoji ?? '🔧', title: l.title,
        dateLabel: new Date(l.date).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }),
        monthKey: (() => { const s = new Date(l.date).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' }); return s.charAt(0).toUpperCase() + s.slice(1); })(),
        mileage: l.mileage, place: l.place, cost: l.cost, photos: l.photos ?? [],
      }));
      set(s => ({
        history: [...s.history.filter(h => h.vehicleId !== vehicleId), ...entries],
        historyLoaded: { ...s.historyLoaded, [vehicleId]: true },
      }));
    } catch (e) {
      console.warn('No se pudo cargar el historial del backend:', e);
    } finally {
      historyInFlight.delete(vehicleId);
    }
  },

  resetToDemo: () => set({ ...demoSeed(), currentVehicleId: 'merc', hydrated: false, historyLoaded: {} }),
}));
