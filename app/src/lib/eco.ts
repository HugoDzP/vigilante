// src/lib/eco.ts — etiqueta ambiental DGT a partir de combustible + año
export type Fuel = 'Diésel' | 'Gasolina' | 'Híbrido' | 'Híbrido ench.' | 'Eléctrico';
export type EcoCode = 'B' | 'C' | 'ECO' | '0' | 'NONE';

export const FUELS: Fuel[] = ['Diésel', 'Gasolina', 'Híbrido', 'Híbrido ench.', 'Eléctrico'];

export const ECO_META: Record<EcoCode, { label: string; colors: [string, string] }> = {
  B:    { label: 'Etiqueta B',   colors: ['#F7C948', '#F7C948'] },
  C:    { label: 'Etiqueta C',   colors: ['#3DBB6B', '#3DBB6B'] },
  ECO:  { label: 'Etiqueta ECO', colors: ['#3DBB6B', '#2E7CF6'] }, // mitad verde / mitad azul
  '0':  { label: 'Etiqueta 0',   colors: ['#2E7CF6', '#2E7CF6'] },
  NONE: { label: 'Sin etiqueta', colors: ['#3A4664', '#3A4664'] },
};

/**
 * Reglas DGT:
 *  - Eléctrico → 0 · PHEV (≥40 km autonomía, casi todos) → 0
 *  - Híbrido no enchufable / GLP / GNC → ECO
 *  - Gasolina: ≥2006 → C · 2001–2005 → B
 *  - Diésel:   ≥2014 → C · 2006–2013 → B
 * Casos especiales (PHEV <40 km → ECO) se cubren con override manual.
 */
export function ecoFromSpecs(fuel: Fuel | string, year: number | string): EcoCode {
  const y = typeof year === 'number' ? year : parseInt(year) || 0;
  if (fuel === 'Eléctrico') return '0';
  if (typeof fuel === 'string' && fuel.startsWith('Híbrido ench')) return '0';
  if (fuel === 'Híbrido') return 'ECO';
  if (fuel === 'Gasolina') return y >= 2006 ? 'C' : y >= 2001 ? 'B' : 'NONE';
  if (fuel === 'Diésel') return y >= 2014 ? 'C' : y >= 2006 ? 'B' : 'NONE';
  return 'NONE';
}
