// src/theme.ts
export const T = {
  bg0: '#050B14', bg1: '#0B1424',
  card: '#131F35', cardA: 'rgba(19,31,53,0.88)',
  stroke: 'rgba(116,138,176,0.15)',
  steel: '#8493AB', steelDim: '#586784',
  mint: '#34E8A4', mintDim: 'rgba(52,232,164,0.13)',
  amber: '#FFAE4D', amberDim: 'rgba(255,174,77,0.13)',
  danger: '#FF6478', dangerDim: 'rgba(255,100,120,0.13)',
  accent: '#4D8DFF', ink: '#ECF1FA', ink2: '#ACB9CE',
} as const;

export const LEVEL = {
  ok:     { color: T.mint,   dim: T.mintDim,   label: 'Al día'  },
  soon:   { color: T.amber,  dim: T.amberDim,  label: 'Pronto'  },
  urgent: { color: T.danger, dim: T.dangerDim, label: 'Urgente' },
} as const;
export type Level = keyof typeof LEVEL;

export const shadowCard = {
  shadowColor: '#000', shadowOpacity: 0.32, shadowRadius: 16,
  shadowOffset: { width: 0, height: 8 }, elevation: 8,
};
export const glowMint = {
  shadowColor: T.mint, shadowOpacity: 0.35, shadowRadius: 10,
  shadowOffset: { width: 0, height: 5 }, elevation: 6,
};
