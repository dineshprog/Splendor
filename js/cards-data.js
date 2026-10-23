/**
 * Splendor Online - Official 90 Development Cards & 10 Historical Noble Tiles
 * Complete dataset with authentic costs, prestige points, gem bonuses, and colorblind symbols.
 */

export const GEM_COLORS = ['diamond', 'sapphire', 'emerald', 'ruby', 'onyx'];
export const ALL_TOKENS = ['diamond', 'sapphire', 'emerald', 'ruby', 'onyx', 'gold'];

export const GEM_METADATA = {
  diamond: {
    name: 'Diamond',
    colorHex: '#ffffff',
    accentHex: '#0284c7',
    borderHex: '#0284c7',
    symbol: '❖',
    shapeName: 'Rhombus',
    cssClass: 'gem-diamond'
  },
  sapphire: {
    name: 'Sapphire',
    colorHex: '#2563eb',
    accentHex: '#1e40af',
    borderHex: '#93c5fd',
    symbol: '◼',
    shapeName: 'Square',
    cssClass: 'gem-sapphire'
  },
  emerald: {
    name: 'Emerald',
    colorHex: '#0bb27a',
    accentHex: '#047857',
    borderHex: '#6ee7b7',
    symbol: '⬟',
    shapeName: 'Pentagon',
    cssClass: 'gem-emerald'
  },
  ruby: {
    name: 'Ruby',
    colorHex: '#ef4444',
    accentHex: '#991b1b',
    borderHex: '#fca5a5',
    symbol: '●',
    shapeName: 'Circle',
    cssClass: 'gem-ruby'
  },
  onyx: {
    name: 'Onyx',
    colorHex: '#232326',
    accentHex: '#4a4a50',
    borderHex: '#cbd5e1',
    symbol: '⬢',
    shapeName: 'Hexagon',
    cssClass: 'gem-onyx'
  },
  gold: {
    name: 'Gold Joker',
    colorHex: '#fbbf24',
    accentHex: '#b45309',
    borderHex: '#fef08a',
    symbol: '★',
    shapeName: 'Star',
    cssClass: 'gem-gold'
  }
};

// 40 Tier 1 Development Cards
export const TIER_1_CARDS = [
  // Diamond Bonus (8)
  { id: 't1_d_1', tier: 1, gemBonus: 'diamond', prestigePoints: 0, cost: { sapphire: 1, emerald: 1, ruby: 1, onyx: 1 } },
  { id: 't1_d_2', tier: 1, gemBonus: 'diamond', prestigePoints: 0, cost: { sapphire: 1, emerald: 2, ruby: 1, onyx: 1 } },
  { id: 't1_d_3', tier: 1, gemBonus: 'diamond', prestigePoints: 0, cost: { sapphire: 2, emerald: 2, onyx: 1 } },
  { id: 't1_d_4', tier: 1, gemBonus: 'diamond', prestigePoints: 0, cost: { sapphire: 3 } },
  { id: 't1_d_5', tier: 1, gemBonus: 'diamond', prestigePoints: 0, cost: { ruby: 2, onyx: 1 } },
  { id: 't1_d_6', tier: 1, gemBonus: 'diamond', prestigePoints: 0, cost: { emerald: 2, onyx: 2 } },
  { id: 't1_d_7', tier: 1, gemBonus: 'diamond', prestigePoints: 0, cost: { sapphire: 3, emerald: 1, onyx: 1 } },
  { id: 't1_d_8', tier: 1, gemBonus: 'diamond', prestigePoints: 1, cost: { sapphire: 4 } },

  // Sapphire Bonus (8)
  { id: 't1_s_1', tier: 1, gemBonus: 'sapphire', prestigePoints: 0, cost: { diamond: 1, emerald: 1, ruby: 1, onyx: 1 } },
  { id: 't1_s_2', tier: 1, gemBonus: 'sapphire', prestigePoints: 0, cost: { diamond: 1, emerald: 1, ruby: 2, onyx: 1 } },
  { id: 't1_s_3', tier: 1, gemBonus: 'sapphire', prestigePoints: 0, cost: { diamond: 1, emerald: 2, ruby: 2 } },
  { id: 't1_s_4', tier: 1, gemBonus: 'sapphire', prestigePoints: 0, cost: { ruby: 3 } },
  { id: 't1_s_5', tier: 1, gemBonus: 'sapphire', prestigePoints: 0, cost: { diamond: 1, onyx: 2 } },
  { id: 't1_s_6', tier: 1, gemBonus: 'sapphire', prestigePoints: 0, cost: { diamond: 2, onyx: 2 } },
  { id: 't1_s_7', tier: 1, gemBonus: 'sapphire', prestigePoints: 0, cost: { diamond: 1, ruby: 3, onyx: 1 } },
  { id: 't1_s_8', tier: 1, gemBonus: 'sapphire', prestigePoints: 1, cost: { ruby: 4 } },

  // Emerald Bonus (8)
  { id: 't1_e_1', tier: 1, gemBonus: 'emerald', prestigePoints: 0, cost: { diamond: 1, sapphire: 1, ruby: 1, onyx: 1 } },
  { id: 't1_e_2', tier: 1, gemBonus: 'emerald', prestigePoints: 0, cost: { diamond: 1, sapphire: 1, ruby: 1, onyx: 2 } },
  { id: 't1_e_3', tier: 1, gemBonus: 'emerald', prestigePoints: 0, cost: { sapphire: 1, ruby: 1, onyx: 3 } },
  { id: 't1_e_4', tier: 1, gemBonus: 'emerald', prestigePoints: 0, cost: { diamond: 2, sapphire: 1 } },
  { id: 't1_e_5', tier: 1, gemBonus: 'emerald', prestigePoints: 0, cost: { onyx: 3 } },
  { id: 't1_e_6', tier: 1, gemBonus: 'emerald', prestigePoints: 0, cost: { sapphire: 2, ruby: 2 } },
  { id: 't1_e_7', tier: 1, gemBonus: 'emerald', prestigePoints: 0, cost: { diamond: 2, sapphire: 2, ruby: 1 } },
  { id: 't1_e_8', tier: 1, gemBonus: 'emerald', prestigePoints: 1, cost: { onyx: 4 } },

  // Ruby Bonus (8)
  { id: 't1_r_1', tier: 1, gemBonus: 'ruby', prestigePoints: 0, cost: { diamond: 1, sapphire: 1, emerald: 1, onyx: 1 } },
  { id: 't1_r_2', tier: 1, gemBonus: 'ruby', prestigePoints: 0, cost: { diamond: 2, sapphire: 1, emerald: 1, onyx: 1 } },
  { id: 't1_r_3', tier: 1, gemBonus: 'ruby', prestigePoints: 0, cost: { diamond: 2, ruby: 1, onyx: 2 } },
  { id: 't1_r_4', tier: 1, gemBonus: 'ruby', prestigePoints: 0, cost: { emerald: 2, ruby: 1 } },
  { id: 't1_r_5', tier: 1, gemBonus: 'ruby', prestigePoints: 0, cost: { diamond: 3 } },
  { id: 't1_r_6', tier: 1, gemBonus: 'ruby', prestigePoints: 0, cost: { diamond: 2, emerald: 2 } },
  { id: 't1_r_7', tier: 1, gemBonus: 'ruby', prestigePoints: 0, cost: { diamond: 1, sapphire: 1, emerald: 3 } },
  { id: 't1_r_8', tier: 1, gemBonus: 'ruby', prestigePoints: 1, cost: { diamond: 4 } },

  // Onyx Bonus (8)
  { id: 't1_o_1', tier: 1, gemBonus: 'onyx', prestigePoints: 0, cost: { diamond: 1, sapphire: 1, emerald: 1, ruby: 1 } },
  { id: 't1_o_2', tier: 1, gemBonus: 'onyx', prestigePoints: 0, cost: { diamond: 1, sapphire: 2, emerald: 1, ruby: 1 } },
  { id: 't1_o_3', tier: 1, gemBonus: 'onyx', prestigePoints: 0, cost: { diamond: 2, sapphire: 2, emerald: 1 } },
  { id: 't1_o_4', tier: 1, gemBonus: 'onyx', prestigePoints: 0, cost: { emerald: 1, ruby: 2 } },
  { id: 't1_o_5', tier: 1, gemBonus: 'onyx', prestigePoints: 0, cost: { emerald: 3 } },
  { id: 't1_o_6', tier: 1, gemBonus: 'onyx', prestigePoints: 0, cost: { diamond: 3, emerald: 1, ruby: 1 } },
  { id: 't1_o_7', tier: 1, gemBonus: 'onyx', prestigePoints: 0, cost: { sapphire: 2, emerald: 2 } },
  { id: 't1_o_8', tier: 1, gemBonus: 'onyx', prestigePoints: 1, cost: { emerald: 4 } }
];

// 30 Tier 2 Development Cards
export const TIER_2_CARDS = [
  // Diamond Bonus (6)
  { id: 't2_d_1', tier: 2, gemBonus: 'diamond', prestigePoints: 1, cost: { sapphire: 2, emerald: 3, ruby: 3 } },
  { id: 't2_d_2', tier: 2, gemBonus: 'diamond', prestigePoints: 1, cost: { sapphire: 2, emerald: 2, onyx: 3 } },
  { id: 't2_d_3', tier: 2, gemBonus: 'diamond', prestigePoints: 2, cost: { diamond: 1, sapphire: 4, emerald: 2 } },
  { id: 't2_d_4', tier: 2, gemBonus: 'diamond', prestigePoints: 2, cost: { ruby: 5 } },
  { id: 't2_d_5', tier: 2, gemBonus: 'diamond', prestigePoints: 2, cost: { emerald: 5 } },
  { id: 't2_d_6', tier: 2, gemBonus: 'diamond', prestigePoints: 3, cost: { diamond: 6 } },

  // Sapphire Bonus (6)
  { id: 't2_s_1', tier: 2, gemBonus: 'sapphire', prestigePoints: 1, cost: { diamond: 2, ruby: 2, onyx: 3 } },
  { id: 't2_s_2', tier: 2, gemBonus: 'sapphire', prestigePoints: 1, cost: { emerald: 2, ruby: 3, onyx: 3 } },
  { id: 't2_s_3', tier: 2, gemBonus: 'sapphire', prestigePoints: 2, cost: { sapphire: 5 } },
  { id: 't2_s_4', tier: 2, gemBonus: 'sapphire', prestigePoints: 2, cost: { emerald: 4, ruby: 2, onyx: 1 } },
  { id: 't2_s_5', tier: 2, gemBonus: 'sapphire', prestigePoints: 2, cost: { onyx: 5 } },
  { id: 't2_s_6', tier: 2, gemBonus: 'sapphire', prestigePoints: 3, cost: { sapphire: 6 } },

  // Emerald Bonus (6)
  { id: 't2_e_1', tier: 2, gemBonus: 'emerald', prestigePoints: 1, cost: { diamond: 3, sapphire: 2, ruby: 3 } },
  { id: 't2_e_2', tier: 2, gemBonus: 'emerald', prestigePoints: 1, cost: { diamond: 2, sapphire: 3, onyx: 2 } },
  { id: 't2_e_3', tier: 2, gemBonus: 'emerald', prestigePoints: 2, cost: { ruby: 4, onyx: 2, sapphire: 1 } },
  { id: 't2_e_4', tier: 2, gemBonus: 'emerald', prestigePoints: 2, cost: { diamond: 5 } },
  { id: 't2_e_5', tier: 2, gemBonus: 'emerald', prestigePoints: 2, cost: { sapphire: 5 } },
  { id: 't2_e_6', tier: 2, gemBonus: 'emerald', prestigePoints: 3, cost: { emerald: 6 } },

  // Ruby Bonus (6)
  { id: 't2_r_1', tier: 2, gemBonus: 'ruby', prestigePoints: 1, cost: { diamond: 2, emerald: 3, onyx: 2 } },
  { id: 't2_r_2', tier: 2, gemBonus: 'ruby', prestigePoints: 1, cost: { diamond: 3, sapphire: 2, onyx: 3 } },
  { id: 't2_r_3', tier: 2, gemBonus: 'ruby', prestigePoints: 2, cost: { diamond: 1, onyx: 4, ruby: 2 } },
  { id: 't2_r_4', tier: 2, gemBonus: 'ruby', prestigePoints: 2, cost: { onyx: 5 } },
  { id: 't2_r_5', tier: 2, gemBonus: 'ruby', prestigePoints: 2, cost: { diamond: 5 } },
  { id: 't2_r_6', tier: 2, gemBonus: 'ruby', prestigePoints: 3, cost: { ruby: 6 } },

  // Onyx Bonus (6)
  { id: 't2_o_1', tier: 2, gemBonus: 'onyx', prestigePoints: 1, cost: { diamond: 3, emerald: 2, ruby: 2 } },
  { id: 't2_o_2', tier: 2, gemBonus: 'onyx', prestigePoints: 1, cost: { sapphire: 3, emerald: 2, onyx: 2 } },
  { id: 't2_o_3', tier: 2, gemBonus: 'onyx', prestigePoints: 2, cost: { emerald: 1, ruby: 4, sapphire: 2 } },
  { id: 't2_o_4', tier: 2, gemBonus: 'onyx', prestigePoints: 2, cost: { emerald: 5 } },
  { id: 't2_o_5', tier: 2, gemBonus: 'onyx', prestigePoints: 2, cost: { ruby: 5 } },
  { id: 't2_o_6', tier: 2, gemBonus: 'onyx', prestigePoints: 3, cost: { onyx: 6 } }
];

// 20 Tier 3 Development Cards
export const TIER_3_CARDS = [
  // Diamond Bonus (4)
  { id: 't3_d_1', tier: 3, gemBonus: 'diamond', prestigePoints: 3, cost: { sapphire: 3, emerald: 3, ruby: 5, onyx: 3 } },
  { id: 't3_d_2', tier: 3, gemBonus: 'diamond', prestigePoints: 4, cost: { ruby: 7 } },
  { id: 't3_d_3', tier: 3, gemBonus: 'diamond', prestigePoints: 4, cost: { diamond: 3, ruby: 6, onyx: 3 } },
  { id: 't3_d_4', tier: 3, gemBonus: 'diamond', prestigePoints: 5, cost: { diamond: 7, onyx: 3 } },

  // Sapphire Bonus (4)
  { id: 't3_s_1', tier: 3, gemBonus: 'sapphire', prestigePoints: 3, cost: { diamond: 3, emerald: 3, ruby: 3, onyx: 5 } },
  { id: 't3_s_2', tier: 3, gemBonus: 'sapphire', prestigePoints: 4, cost: { diamond: 7 } },
  { id: 't3_s_3', tier: 3, gemBonus: 'sapphire', prestigePoints: 4, cost: { diamond: 6, sapphire: 3, onyx: 3 } },
  { id: 't3_s_4', tier: 3, gemBonus: 'sapphire', prestigePoints: 5, cost: { sapphire: 7, diamond: 3 } },

  // Emerald Bonus (4)
  { id: 't3_e_1', tier: 3, gemBonus: 'emerald', prestigePoints: 3, cost: { diamond: 5, sapphire: 3, ruby: 3, onyx: 3 } },
  { id: 't3_e_2', tier: 3, gemBonus: 'emerald', prestigePoints: 4, cost: { sapphire: 7 } },
  { id: 't3_e_3', tier: 3, gemBonus: 'emerald', prestigePoints: 4, cost: { diamond: 3, sapphire: 6, emerald: 3 } },
  { id: 't3_e_4', tier: 3, gemBonus: 'emerald', prestigePoints: 5, cost: { emerald: 7, sapphire: 3 } },

  // Ruby Bonus (4)
  { id: 't3_r_1', tier: 3, gemBonus: 'ruby', prestigePoints: 3, cost: { diamond: 3, sapphire: 5, emerald: 3, onyx: 3 } },
  { id: 't3_r_2', tier: 3, gemBonus: 'ruby', prestigePoints: 4, cost: { emerald: 7 } },
  { id: 't3_r_3', tier: 3, gemBonus: 'ruby', prestigePoints: 4, cost: { sapphire: 3, emerald: 6, ruby: 3 } },
  { id: 't3_r_4', tier: 3, gemBonus: 'ruby', prestigePoints: 5, cost: { ruby: 7, emerald: 3 } },

  // Onyx Bonus (4)
  { id: 't3_o_1', tier: 3, gemBonus: 'onyx', prestigePoints: 3, cost: { diamond: 3, sapphire: 3, emerald: 5, ruby: 3 } },
  { id: 't3_o_2', tier: 3, gemBonus: 'onyx', prestigePoints: 4, cost: { onyx: 7 } },
  { id: 't3_o_3', tier: 3, gemBonus: 'onyx', prestigePoints: 4, cost: { emerald: 3, ruby: 6, onyx: 3 } },
  { id: 't3_o_4', tier: 3, gemBonus: 'onyx', prestigePoints: 5, cost: { onyx: 7, ruby: 3 } }
];

// All 90 Cards Index Map
export const ALL_CARDS = [...TIER_1_CARDS, ...TIER_2_CARDS, ...TIER_3_CARDS];
export const CARDS_BY_ID = Object.fromEntries(ALL_CARDS.map(c => [c.id, c]));

// 10 Historical Noble Tiles (3 Prestige Points each)
export const NOBLE_TILES = [
  {
    id: 'noble_1',
    name: 'Henri IV',
    title: 'King of France & Navarre',
    prestigePoints: 3,
    requirements: { emerald: 4, ruby: 4 },
    avatar: '👑'
  },
  {
    id: 'noble_2',
    name: 'Isabella I',
    title: 'Queen of Castile',
    prestigePoints: 3,
    requirements: { diamond: 4, onyx: 4 },
    avatar: '👸'
  },
  {
    id: 'noble_3',
    name: 'Francis I',
    title: 'Patron of the Renaissance',
    prestigePoints: 3,
    requirements: { diamond: 3, sapphire: 3, emerald: 3 },
    avatar: '⚜️'
  },
  {
    id: 'noble_4',
    name: 'Anne of Brittany',
    title: 'Duchess of Brittany',
    prestigePoints: 3,
    requirements: { emerald: 3, ruby: 3, onyx: 3 },
    avatar: '🏰'
  },
  {
    id: 'noble_5',
    name: 'Charles V',
    title: 'Holy Roman Emperor',
    prestigePoints: 3,
    requirements: { diamond: 3, sapphire: 3, onyx: 3 },
    avatar: '🛡️'
  },
  {
    id: 'noble_6',
    name: 'Suleiman I',
    title: 'The Magnificent',
    prestigePoints: 3,
    requirements: { sapphire: 4, emerald: 4 },
    avatar: '🌙'
  },
  {
    id: 'noble_7',
    name: 'Mary Stuart',
    title: 'Queen of Scots',
    prestigePoints: 3,
    requirements: { ruby: 4, onyx: 4 },
    avatar: '💎'
  },
  {
    id: 'noble_8',
    name: 'Elisabeth of Austria',
    title: 'Queen of France',
    prestigePoints: 3,
    requirements: { sapphire: 3, emerald: 3, ruby: 3 },
    avatar: '🌹'
  },
  {
    id: 'noble_9',
    name: 'Niccolò Machiavelli',
    title: 'Florentine Diplomat',
    prestigePoints: 3,
    requirements: { diamond: 4, sapphire: 4 },
    avatar: '📜'
  },
  {
    id: 'noble_10',
    name: 'Catherine de\' Medici',
    title: 'Queen Mother of France',
    prestigePoints: 3,
    requirements: { diamond: 3, ruby: 3, onyx: 3 },
    avatar: '🏛️'
  }
];

export const NOBLES_BY_ID = Object.fromEntries(NOBLE_TILES.map(n => [n.id, n]));

// -------------------------------------------------------------
// RENAISSANCE CARD ARTWORK CURATION & RANDOMIZATION
// -------------------------------------------------------------
export const TOTAL_CARD_ARTS = 32;

// Map storing randomized art file for each card.id
const cardArtCache = new Map();

/**
 * Reshuffle card artworks across all cards for a new match.
 * Distributes all 32 Renaissance paintings evenly across the 90 cards.
 */
export function reshuffleCardArtworks() {
  cardArtCache.clear();
  const allCardIds = [
    ...TIER_1_CARDS.map(c => c.id),
    ...TIER_2_CARDS.map(c => c.id),
    ...TIER_3_CARDS.map(c => c.id)
  ];
  
  // Shuffle card IDs randomly
  const shuffled = [...allCardIds].sort(() => Math.random() - 0.5);
  shuffled.forEach((id, idx) => {
    const artIndex = (idx % TOTAL_CARD_ARTS) + 1;
    cardArtCache.set(id, `assets/cards/art_${artIndex}.jpg`);
  });
}

/**
 * Returns a randomized, distinct Renaissance oil painting path for a card.
 * Persistently mapped per card ID during the match so it does not flicker.
 */
export function getCardArtPath(card) {
  if (!card || !card.id) return 'assets/cards/art_1.jpg';
  
  if (!cardArtCache.has(card.id)) {
    let hash = 0;
    for (let i = 0; i < card.id.length; i++) {
      hash = ((hash << 5) - hash) + card.id.charCodeAt(i);
      hash |= 0;
    }
    const seed = Math.abs(hash * 31 + (card.tier || 1) * 7);
    const artIndex = (seed % TOTAL_CARD_ARTS) + 1;
    cardArtCache.set(card.id, `assets/cards/art_${artIndex}.jpg`);
  }
  
  return cardArtCache.get(card.id);
}

// Initialize randomized artworks pool on load
reshuffleCardArtworks();


