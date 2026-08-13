// src/lib/exportPdf.ts — dossier de mantenimiento en PDF (expo-print + expo-sharing)
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { ecoFromSpecs, ECO_META } from './eco';
import type { Vehicle, LogEntry } from '../store';

export async function exportHistoryPdf(car: Vehicle, logs: LogEntry[]) {
  const code = car.label ?? ecoFromSpecs(car.fuel, car.year);
  const eco = ECO_META[code];
  const total = logs.reduce((a, l) => a + l.cost, 0);
  const today = new Date().toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });

  const rows = logs.map(l => `
    <tr>
      <td><b>${l.title}</b><div class="dd">${l.dateLabel} · ${l.mileage.toLocaleString('es-ES')} km · ${l.place}${l.photos.length ? ` · ${l.photos.length} foto(s)` : ''}</div></td>
      <td class="r">${l.cost} €</td>
    </tr>`).join('');

  // SVG embebido para el círculo de la etiqueta — más fiable que CSS (flex/float) en el
  // motor de renderizado limitado que usa expo-print para generar el PDF.
  const dotSvg = `<svg width="13" height="13" viewBox="0 0 13 13" style="vertical-align:-2px">
    <circle cx="6.5" cy="6.5" r="6" fill="${eco.colors[0]}" stroke="rgba(0,0,0,0.15)" stroke-width="1"/>
    ${eco.colors[0] !== eco.colors[1] ? `<path d="M 6.5 0.5 A 6 6 0 0 1 6.5 12.5 Z" fill="${eco.colors[1]}"/>` : ''}
  </svg>`;

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
    body{font-family:-apple-system,Helvetica,sans-serif;color:#1B2436;padding:36px;background:#F2F5FA}
    .dh{display:flex;justify-content:space-between;border-bottom:3px solid #1B2436;padding-bottom:14px}
    .dh small{font-size:9px;letter-spacing:3px;color:#7A87A0;font-weight:800}
    h1{font-size:22px;margin:4px 0 0}
    .meta{font-size:12px;color:#46536E;margin:12px 0;display:flex;align-items:center;gap:10px}
    .eco{display:inline-flex;align-items:center;gap:6px;font-size:10px;font-weight:800;border:1px solid #C9D4E8;background:#E6ECF6;border-radius:99px;padding:4px 10px}
    table{width:100%;border-collapse:collapse;margin-top:8px}
    td{padding:10px 0;border-bottom:1px solid #DDE4EF;font-size:12px;vertical-align:top}
    .dd{color:#7A87A0;font-size:10.5px;margin-top:2px}
    .r{text-align:right;font-weight:800;white-space:nowrap}
    .total{display:flex;justify-content:space-between;font-weight:800;font-size:14px;margin-top:14px}
    .foot{text-align:center;font-size:9px;letter-spacing:2px;color:#8C97AE;margin-top:28px}
  </style></head><body>
    <div class="dh">
      <div><small>INFORME DE MANTENIMIENTO</small><h1>${car.name}</h1></div>
      <small>VIGILANTE<br>${today.toUpperCase()}</small>
    </div>
    <div class="meta">
      <span>${car.plate} · ${car.fuel} · ${car.year} · ${car.mileage.toLocaleString('es-ES')} km</span>
      <span class="eco">${dotSvg}${eco.label}</span>
    </div>
    <table>${rows}</table>
    <div class="total"><span>Total · ${logs.length} registros</span><span>${total.toLocaleString('es-ES')} €</span></div>
    <div class="foot">GENERADO CON VIGILANTE</div>
  </body></html>`;

  const { uri } = await Print.printToFileAsync({ html });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: `Historial ${car.name}` });
  }
  return uri;
}
