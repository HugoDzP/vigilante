// src/store.ts — estado global (Zustand)
import { create } from 'zustand';
import type { Level } from './theme';
import type { Fuel, EcoCode } from './lib/eco';
import { sync, HAS_BACKEND } from './lib/api';
import { getAccessToken } from './lib/supabase';
import { sendImmediateReminder } from './lib/notifications';

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
  notifiedLowKm: Record<string, boolean>; // qué mantenimientos por km ya avisaron en este ciclo
  reminderLeadKm: number;
  reminderLeadDays: number;
  loadPreferences: () => Promise<void>;
  updatePreferences: (p: { reminderLeadKm?: number; reminderLeadDays?: number }) => Promise<void>;
  refreshSummary: (vehicleId: string, force?: boolean) => Promise<void>;
  hydrated: boolean;                 // true una vez cargados datos reales del backend
  historyLoaded: Record<string, boolean>;
  maintenanceLoaded: Record<string, boolean>;

  currentVehicle: () => Vehicle | undefined;
  maintenanceFor: (id: string) => MaintenanceItem[];
  historyFor: (id: string) => LogEntry[];

  switchVehicle: (id: string) => void;
  upsertVehicle: (v: Omit<Vehicle, 'id' | 'summary'> & { id?: string }) => string;
  /** Se resuelve cuando el backend confirma (vehículo + sus mantenimientos reales
   * ya cargados) — o de inmediato si no hay backend. Úsalo para no navegar hacia
   * atrás mientras solo hay datos provisionales en pantalla. */
  upsertVehicleAndWait: (v: Omit<Vehicle, 'id' | 'summary'> & { id?: string }) => Promise<string>;
  remapVehicleId: (oldId: string, newId: string) => void;
  setVehiclePhoto: (id: string, uri?: string) => void;
  setVehicleHealth: (id: string, health: number) => void;
  updateMileage: (id: string, km: number) => void;
  dismissMileageAsk: (id: string) => void;
  checkAndNotifyLowRemaining: (vehicleId: string) => Promise<void>;

  addPhoto: (mid: string, p: { uri: string; sizeLabel: string }) => void;
  removePhoto: (mid: string, index: number) => void;
  assignWorkshop: (mid: string, name: string | null) => void;
  updateNotes: (mid: string, notes: string) => void;
  markDone: (mid: string) => void;
  addLog: (e: Omit<LogEntry, 'id'>) => void;

  addWorkshop: (w: Omit<Workshop, 'id'>) => void;
  removeWorkshop: (id: string) => void;

  hydrateFromBackend: () => Promise<void>;
  loadHistoryFor: (vehicleId: string) => Promise<void>;
  loadMaintenanceFor: (vehicleId: string) => Promise<void>;
  refreshMaintenance: (vehicleId: string) => Promise<void>;
  addCustomMaintenance: (vehicleId: string, item: {
    title: string; emoji: string; detail?: string; notes?: string; estCost?: string;
    intervalKm?: number; intervalDays?: number; lastDoneKm?: number; lastDoneDate?: string;
  }) => Promise<void>;
  resetToDemo: () => void;
}

const monthKeyNow = () => {
  const s = new Date().toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
  return s.charAt(0).toUpperCase() + s.slice(1);
};
const dateLabelNow = () => new Date().toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
const historyInFlight = new Set<string>(); // evita fetches duplicados si se llama varias veces seguidas
const maintenanceInFlight = new Set<string>();

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
        progress: 0.92, level: 'urgent' as Level, workshop: 'Taller Rodamotor',
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
        progress: 0.68, level: 'soon' as Level, workshop: 'Taller Rodamotor',
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
      { id: 'h1', vehicleId: 'merc', emoji: '🛢️', title: 'Aceite y filtro', dateLabel: '11 jun', monthKey: 'Junio 2026', mileage: 128_450, place: 'Taller Rodamotor', cost: 89, photos: [], maintenanceId: 'oil' },
      { id: 'h2', vehicleId: 'merc', emoji: '🛞', title: 'Rotación de neumáticos', dateLabel: '2 jun', monthKey: 'Junio 2026', mileage: 127_900, place: 'DIY en Villamora', cost: 0, photos: [] },
      { id: 'h3', vehicleId: 'merc', emoji: '🌬️', title: 'Filtro de habitáculo', dateLabel: '14 abr', monthKey: 'Abril 2026', mileage: 125_300, place: 'DIY', cost: 24, photos: [] },
      { id: 'h4', vehicleId: 'merc', emoji: '🔋', title: 'Batería 12V', dateLabel: '3 abr', monthKey: 'Abril 2026', mileage: 124_880, place: 'AutoStop Rivera', cost: 139, photos: [] },
    ] as LogEntry[],
    workshops: [
      { id: 'w1', name: 'Taller Rodamotor', address: 'Pol. Ind. Villamora', phone: '925 48 XX XX', notes: 'El de confianza · pregunta por Andrés' },
      { id: 'w2', name: 'AutoStop Rivera', address: 'C.C. Vialta', phone: '91 552 XX XX', notes: 'Baterías y neumáticos' },
    ] as Workshop[],
  };
}

export const useVigilante = create<S>((set, get) => ({
  ...demoSeed(),
  currentVehicleId: 'merc',
  mileageAskDismissed: {},
  notifiedLowKm: {},
  reminderLeadKm: 1000,
  reminderLeadDays: 60,
  hydrated: false,
  historyLoaded: {},
  maintenanceLoaded: {},

  currentVehicle: () => {
    const { vehicles, currentVehicleId } = get();
    return vehicles.find(v => v.id === currentVehicleId) ?? vehicles[0];
  },
  maintenanceFor: id => {
    if (get().vehicles.some(v => v.id === id)) get().loadMaintenanceFor(id);
    return get().maintenance.filter(m => m.vehicleId === id);
  },
  historyFor: id => {
    if (get().vehicles.some(v => v.id === id)) get().loadHistoryFor(id);
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
        ...((v as any).lastItvDate ? { lastItvDate: (v as any).lastItvDate } : {}),
      };
      if (isNew) {
        sync.createVehicle(payload)
          .then((res: any) => {
            if (res?.id && res.id !== id) get().remapVehicleId(id, res.id);
            get().loadMaintenanceFor(res?.id ?? id);
          })
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

  upsertVehicleAndWait: async (v) => {
    const isNew = !v.id;
    if (!HAS_BACKEND || !isNew) {
      // Edición, o sin backend: no hay nada real que esperar — comportamiento de siempre.
      return get().upsertVehicle(v);
    }
    // Creación con backend real: mandamos directamente al servidor y esperamos
    // su respuesta (vehículo + mantenimientos ya calculados de verdad), en vez
    // de mostrar primero un provisional con guiones y corregirlo después.
    const payload = {
      brand: v.brand, model: v.model, year: v.year, plate: v.plate,
      fuel: v.fuel, hp: v.hp, bodyType: v.bodyType, mileage: v.mileage,
      label: v.label, photoUri: v.photoUri,
      ...((v as any).lastItvDate ? { lastItvDate: (v as any).lastItvDate } : {}),
    };
    try {
      const res: any = await sync.createVehicle(payload);
      const realId = res.id;
      const vehicle: Vehicle = {
        id: realId, name: `${v.brand} ${v.model}`.trim(), short: v.brand,
        initial: v.brand.charAt(0).toUpperCase(),
        brand: v.brand, model: v.model, year: v.year, plate: v.plate,
        fuel: v.fuel, hp: v.hp, bodyType: v.bodyType, mileage: v.mileage,
        health: res.health ?? 0.9, monthlyKm: 0, label: v.label, photoUri: v.photoUri,
        summary: 'Registra tu primer mantenimiento desde el Chat y empiezo a vigilarlo. 🛡️',
      };
      set(s => ({ vehicles: [...s.vehicles, vehicle], currentVehicleId: realId }));
      await get().loadMaintenanceFor(realId);
      get().refreshSummary(realId); // no bloquea — se actualiza en cuanto llegue
      return realId;
    } catch (e) {
      console.warn('No se pudo crear el vehículo en el backend, se guarda solo en local:', e);
      return get().upsertVehicle(v); // red de seguridad: al menos que no se pierda el dato
    }
  },

  setVehiclePhoto: (id, uri) =>
    set(s => ({ vehicles: s.vehicles.map(v => (v.id === id ? { ...v, photoUri: uri } : v)) })),

  setVehicleHealth: (id, health) =>
    set(s => ({ vehicles: s.vehicles.map(v => (v.id === id ? { ...v, health } : v)) })),

  updateMileage: (id, km) =>
    set(s => ({
      vehicles: s.vehicles.map(v => (v.id === id ? { ...v, mileage: km } : v)),
      mileageAskDismissed: { ...s.mileageAskDismissed, [id]: true },
    })),

  dismissMileageAsk: id =>
    set(s => ({ mileageAskDismissed: { ...s.mileageAskDismissed, [id]: true } })),

  checkAndNotifyLowRemaining: async (vehicleId: string) => {
    const { maintenance, notifiedLowKm, reminderLeadKm } = get();
    for (const it of maintenance) {
      if (it.vehicleId !== vehicleId) continue;
      if (!it.remainingText.includes('km')) continue; // solo nos interesan los de kilómetros aquí
      const remaining = parseInt(it.remainingText.replace(/[^\d]/g, ''), 10);
      if (Number.isNaN(remaining)) continue;

      if (remaining <= reminderLeadKm) {
        if (!notifiedLowKm[it.id]) {
          await sendImmediateReminder(it.title, `Solo quedan ${it.remainingText} — ${it.detail || 'toca para ver el detalle'}.`);
          set(s => ({ notifiedLowKm: { ...s.notifiedLowKm, [it.id]: true } }));
        }
      } else if (notifiedLowKm[it.id]) {
        // volvió a subir el margen (p.ej. tras marcarlo hecho) — permite avisar otra vez en el futuro
        set(s => ({ notifiedLowKm: { ...s.notifiedLowKm, [it.id]: false } }));
      }
    }
  },

  loadPreferences: async () => {
    if (!HAS_BACKEND) return;
    try {
      const p: any = await sync.preferences();
      set({
        reminderLeadKm: typeof p.reminderLeadKm === 'number' ? p.reminderLeadKm : 1000,
        reminderLeadDays: typeof p.reminderLeadDays === 'number' ? p.reminderLeadDays : 60,
      });
    } catch (e) {
      console.warn('No se pudieron cargar las preferencias:', e);
    }
  },

  updatePreferences: async (p) => {
    set(s => ({
      reminderLeadKm: p.reminderLeadKm ?? s.reminderLeadKm,
      reminderLeadDays: p.reminderLeadDays ?? s.reminderLeadDays,
    }));
    if (HAS_BACKEND) {
      try { await sync.updatePreferences(p); }
      catch (e) { console.warn('No se pudieron guardar las preferencias en el backend:', e); }
    }
  },

  refreshSummary: async (vehicleId, force = false) => {
    if (!HAS_BACKEND) return;
    try {
      const res: any = await sync.vehicleSummary(vehicleId, force);
      if (res?.summary) {
        set(s => ({ vehicles: s.vehicles.map(v => (v.id === vehicleId ? { ...v, summary: res.summary } : v)) }));
      }
    } catch (e) {
      console.warn('No se pudo cargar el Resumen Vigilante:', e);
    }
  },

  addPhoto: (mid, p) => {
    set(s => ({ maintenance: s.maintenance.map(m => (m.id === mid ? { ...m, photos: [...m.photos, p] } : m)) }));
    if (HAS_BACKEND) sync.addMaintenancePhoto(mid, p).catch(e => console.warn('No se pudo subir la foto:', e));
  },

  removePhoto: (mid, index) => {
    set(s => ({
      maintenance: s.maintenance.map(m =>
        m.id === mid ? { ...m, photos: m.photos.filter((_, i) => i !== index) } : m
      ),
    }));
    if (HAS_BACKEND) sync.removeMaintenancePhoto(mid, index).catch(e => console.warn('No se pudo borrar la foto:', e));
  },

  assignWorkshop: (mid, name) => {
    set(s => ({ maintenance: s.maintenance.map(m => (m.id === mid ? { ...m, workshop: name } : m)) }));
    if (HAS_BACKEND) sync.updateMaintenance(mid, { workshop: name }).catch(e => console.warn('No se pudo asignar el taller:', e));
  },

  updateNotes: (mid, notes) => {
    set(s => ({ maintenance: s.maintenance.map(m => (m.id === mid ? { ...m, notes } : m)) }));
    if (HAS_BACKEND) sync.updateMaintenance(mid, { notes }).catch(e => console.warn('No se pudieron guardar las notas:', e));
  },

  addLog: e => set(s => ({ history: [{ ...e, id: `h${Date.now()}` }, ...s.history] })),

  markDone: mid => {
    const m = get().maintenance.find(x => x.id === mid);
    if (!m) return;
    const car = get().vehicles.find(v => v.id === m.vehicleId);
    if (!car) return;
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
      notifiedLowKm: { ...s.notifiedLowKm, [mid]: false },
    }));
    if (HAS_BACKEND) {
      sync.maintenanceDone(mid)
        .then(() => get().refreshMaintenance(m.vehicleId)) // recalcula con los datos reales del servidor
        .catch(e => console.warn('No se pudo marcar como hecho en el backend:', e));
    }
  },

  addWorkshop: w => {
    const tempId = `w${Date.now()}`;
    set(s => ({ workshops: [...s.workshops, { ...w, id: tempId }] }));
    if (HAS_BACKEND) {
      sync.createWorkshop(w)
        .then((res: any) => {
          if (res?.id) set(s => ({ workshops: s.workshops.map(x => (x.id === tempId ? { ...x, id: res.id } : x)) }));
        })
        .catch(e => console.warn('No se pudo guardar el taller en el backend:', e));
    }
  },
  removeWorkshop: id => {
    set(s => ({ workshops: s.workshops.filter(w => w.id !== id) }));
    if (HAS_BACKEND) sync.deleteWorkshop(id).catch(e => console.warn('No se pudo borrar el taller en el backend:', e));
  },

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
        health: typeof v.health === 'number' ? v.health : 0.9, monthlyKm: 0, label: v.label, photoUri: v.photoUri,
        summary: 'Registra tu primer mantenimiento desde el Chat y empiezo a vigilarlo. 🛡️',
      }));

      let workshops: Workshop[] = [];
      try { workshops = await sync.workshops() as Workshop[]; }
      catch (e) { console.warn('No se pudieron cargar los talleres del backend:', e); }

      set({
        vehicles, workshops,
        currentVehicleId: vehicles[0]?.id ?? '',
        maintenance: [], history: [], historyLoaded: {}, maintenanceLoaded: {},
        hydrated: true,
      });
      get().loadPreferences(); // en paralelo, no bloquea el arranque
    } catch (e) {
      console.warn('No se pudo cargar el garaje del backend:', e);
    }
  },

  loadHistoryFor: async (vehicleId: string) => {
    if (!HAS_BACKEND || get().historyLoaded[vehicleId] || historyInFlight.has(vehicleId)) return;
    if (!(await getAccessToken())) return; // modo demo con backend configurado pero sin sesión real
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

  loadMaintenanceFor: async (vehicleId: string) => {
    if (!HAS_BACKEND || get().maintenanceLoaded[vehicleId] || maintenanceInFlight.has(vehicleId)) return;
    if (!(await getAccessToken())) return;
    maintenanceInFlight.add(vehicleId);
    try {
      const raw = await sync.maintenance(vehicleId) as MaintenanceItem[];
      set(s => ({
        maintenance: [...s.maintenance.filter(m => m.vehicleId !== vehicleId), ...raw],
        maintenanceLoaded: { ...s.maintenanceLoaded, [vehicleId]: true },
      }));
    } catch (e) {
      console.warn('No se pudieron cargar los mantenimientos del backend:', e);
    } finally {
      maintenanceInFlight.delete(vehicleId);
    }
  },

  refreshMaintenance: async (vehicleId: string) => {
    if (!HAS_BACKEND) return;
    try {
      const raw = await sync.maintenance(vehicleId) as MaintenanceItem[];
      set(s => ({ maintenance: [...s.maintenance.filter(m => m.vehicleId !== vehicleId), ...raw] }));
      get().checkAndNotifyLowRemaining(vehicleId);
    } catch (e) {
      console.warn('No se pudo refrescar el mantenimiento:', e);
    }
  },

  addCustomMaintenance: async (vehicleId, item) => {
    if (HAS_BACKEND) {
      try {
        await sync.createMaintenance(vehicleId, item);
        await get().refreshMaintenance(vehicleId);
        return;
      } catch (e) {
        console.warn('No se pudo crear el mantenimiento en el backend:', e);
      }
    }
    // Sin backend (modo demo): lo añadimos solo en local
    const car = get().vehicles.find(v => v.id === vehicleId);
    set(s => ({
      maintenance: [...s.maintenance, {
        id: `m${Date.now()}`, vehicleId, emoji: item.emoji, title: item.title,
        detail: item.detail ?? '', remainingText: '—', progress: 0, level: 'ok' as Level,
        stats: [['—', 'Restantes'], [item.estCost ?? '—', 'Coste estimado']],
        notes: item.notes ?? '', photos: [], workshop: null, pastOccurrences: [],
        ctaLabel: 'Marcar como hecho hoy',
      }],
    }));
  },

  resetToDemo: () => set({ ...demoSeed(), currentVehicleId: 'merc', hydrated: false, historyLoaded: {}, maintenanceLoaded: {} }),
}));
