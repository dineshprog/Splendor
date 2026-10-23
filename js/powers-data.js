/**
 * Splendor Super Powers (Arcane Guild Powers) Dataset
 * 24 Unique Super Powers divided evenly across 3 Tiers (8-8-8 Balanced Model):
 * - Tier 1: Tactical Boons (Common / Cyan) - 8 Powers
 * - Tier 2: Relic Artifacts & Adversarial Curses (Rare / Purple) - 8 Powers
 * - Tier 3: Mythic Wonders (Legendary / Gold) - 8 Powers
 *
 * Streamlined to eliminate all duplicate mechanics, single-color biases,
 * and consecutive-token requirements in favor of strategic milestone feats.
 */

import { GEM_COLORS, CARDS_BY_ID, NOBLES_BY_ID } from './cards-data.js';

const countTokens = tokens => Object.values(tokens || {}).reduce((s, n) => s + (n || 0), 0);

export const POWERS_DATA = {
  // -------------------------------------------------------------
  // TIER 1: TACTICAL BOONS (COMMON / CYAN) - 8 POWERS
  // -------------------------------------------------------------
  midas_crucible: {
    id: 'midas_crucible',
    name: 'Midas Crucible',
    tier: 'common',
    tierName: 'Common Boon',
    colorHex: '#38bdf8',
    icon: '⚱️',
    type: 'passive',
    shortDesc: 'Reserving cards awards 2 Gold Jokers instead of 1.',
    description: 'The alchemical crucible duplicates refined gold. Whenever you reserve a development card, gain 2 Gold Jokers from the bank instead of 1 (if available).',
    featDesc: 'Hold at least 4 Gold Jokers simultaneously in your hand.',
    checkFeat: (state, player) => (player.tokens.gold || 0) >= 4,
    getFeatProgress: (state, player) => `${Math.min(4, player.tokens.gold || 0)}/4 Gold Jokers`
  },

  endless_vault: {
    id: 'endless_vault',
    name: 'Endless Vault',
    tier: 'common',
    tierName: 'Common Boon',
    colorHex: '#38bdf8',
    icon: '🏛️',
    type: 'passive',
    shortDesc: 'Token storage limit increased from 10 to 14.',
    description: 'Expanding deep beneath the merchant guildhall, your treasury can hold up to 14 tokens before requiring any token discards.',
    featDesc: 'Hold 10 tokens with at least 2 tokens in 4 distinct gem colors.',
    checkFeat: (state, player) => countTokens(player.tokens) >= 10 && GEM_COLORS.filter(c => (player.tokens[c] || 0) >= 2).length >= 4,
    getFeatProgress: (state, player) => `${countTokens(player.tokens)}/10 Tokens (${GEM_COLORS.filter(c => (player.tokens[c] || 0) >= 2).length}/4 Colors 2+)`
  },

  prismatic_harmony: {
    id: 'prismatic_harmony',
    name: 'Prismatic Harmony',
    tier: 'common',
    tierName: 'Common Boon',
    colorHex: '#38bdf8',
    icon: '🌈',
    type: 'passive',
    shortDesc: 'Take 4 distinct tokens instead of 3 when available.',
    description: 'Attunement to all elements. When taking distinct tokens, you may select 4 different colors instead of 3.',
    featDesc: 'Hold at least 2 tokens of all 5 regular gem colors simultaneously (10 tokens).',
    checkFeat: (state, player) => GEM_COLORS.every(c => (player.tokens[c] || 0) >= 2),
    getFeatProgress: (state, player) => `${GEM_COLORS.filter(c => (player.tokens[c] || 0) >= 2).length}/5 Colors (with 2+ gems)`
  },

  noble_envoy: {
    id: 'noble_envoy',
    name: 'Noble Envoy',
    tier: 'common',
    tierName: 'Common Boon',
    colorHex: '#38bdf8',
    icon: '📜',
    type: 'passive',
    shortDesc: 'Nobles require 1 fewer bonus in each color to visit.',
    description: 'Diplomatic charm flatters high society. All noble patrons require 1 fewer card bonus in each color (minimum 1) to visit your merchant court.',
    featDesc: 'Own at least 7 development cards while possessing 0 Nobles.',
    checkFeat: (state, player) => player.cardsPurchased.length >= 7 && player.noblesAcquired.length === 0,
    getFeatProgress: (state, player) => `${Math.min(7, player.cardsPurchased.length)}/7 Cards (Nobles: ${player.noblesAcquired.length}/0)`
  },

  smugglers_warehouse: {
    id: 'smugglers_warehouse',
    name: "Smuggler's Warehouse",
    tier: 'common',
    tierName: 'Common Boon',
    colorHex: '#38bdf8',
    icon: '📦',
    type: 'passive',
    shortDesc: 'Hold up to 4 reserved cards (normally 3).',
    description: 'Secret storage compartments allow your guild to hold up to 4 reserved cards simultaneously.',
    featDesc: 'Hold 3 reserved cards with at least two Tier 2 or Tier 3 cards.',
    checkFeat: (state, player) => player.cardsReserved.length >= 3 && player.cardsReserved.filter(id => CARDS_BY_ID[id] && CARDS_BY_ID[id].tier >= 2).length >= 2,
    getFeatProgress: (state, player) => `${player.cardsReserved.filter(id => CARDS_BY_ID[id] && CARDS_BY_ID[id].tier >= 2).length}/2 Tier 2/3 Reserved (${player.cardsReserved.length}/3 Total)`
  },

  shadow_siphon: {
    id: 'shadow_siphon',
    name: 'Shadow Siphon',
    tier: 'common',
    tierName: 'Common Boon',
    colorHex: '#38bdf8',
    icon: '👤',
    type: 'passive',
    shortDesc: 'Whenever opponent takes bank tokens, siphon 1 token to your hand.',
    description: 'Informants in rival vaults. Whenever your opponent takes tokens from the bank, siphon 1 token of their most abundant color for yourself.',
    featDesc: 'Own at least 4 development cards while holding zero tokens in hand.',
    checkFeat: (state, player) => player.cardsPurchased.length >= 4 && countTokens(player.tokens) === 0,
    getFeatProgress: (state, player) => `${Math.min(4, player.cardsPurchased.length)}/4 Cards (Tokens: ${countTokens(player.tokens)}/0)`
  },

  merchants_resurgence: {
    id: 'merchants_resurgence',
    name: "Merchant's Resurgence",
    tier: 'common',
    tierName: 'Common Boon',
    colorHex: '#38bdf8',
    icon: '💰',
    type: 'instant',
    shortDesc: 'Instantly gain 3 free tokens of your choice from bank.',
    description: 'Desperation fuels Renaissance reinvention. Instantly receive 3 tokens of your choice from the bank.',
    featDesc: 'End your turn with exactly 0 tokens, 0 reserved cards, and at least 5 cards owned.',
    checkFeat: (state, player) => countTokens(player.tokens) === 0 && player.cardsReserved.length === 0 && player.cardsPurchased.length >= 5,
    getFeatProgress: (state, player) => `${countTokens(player.tokens)}/0 Tokens | ${player.cardsReserved.length}/0 Res | ${Math.min(5, player.cardsPurchased.length)}/5 Cards`
  },

  silk_road_caravan: {
    id: 'silk_road_caravan',
    name: 'Silk Road Caravan',
    tier: 'common',
    tierName: 'Common Boon',
    colorHex: '#38bdf8',
    icon: '🐫',
    type: 'passive',
    shortDesc: 'Taking 3 distinct gems you do not hold awards +1 Gold Joker.',
    description: 'Caravan masteries reward diversity. Whenever you take 3 distinct tokens that are all colors you held 0 of, claim +1 Gold Joker from the bank (if available).',
    featDesc: 'End your turn holding at least 1 token of 4 different colors.',
    checkFeat: (state, player) => GEM_COLORS.filter(c => (player.tokens[c] || 0) >= 1).length >= 4,
    getFeatProgress: (state, player) => `${GEM_COLORS.filter(c => (player.tokens[c] || 0) >= 1).length}/4 Different Gem Colors in Hand`
  },

  // -------------------------------------------------------------
  // TIER 2: RELIC ARTIFACTS & ADVERSARIAL CURSES (RARE / PURPLE) - 8 POWERS
  // -------------------------------------------------------------
  guild_embargo: {
    id: 'guild_embargo',
    name: 'Guild Embargo',
    tier: 'rare',
    tierName: 'Rare Artifact',
    colorHex: '#c084fc',
    icon: '🚫',
    type: 'instant',
    shortDesc: "Curse: Opponent cannot use discounts from their highest color for 5 rounds!",
    description: 'A crushing mercantilist cartel embargo. For the next 5 rounds, your opponent cannot apply card discounts from their most abundant card color when purchasing cards!',
    featDesc: 'Own at least 5 development cards of any single color.',
    checkFeat: (state, player) => GEM_COLORS.some(c => (player.bonuses[c] || 0) >= 5),
    getFeatProgress: (state, player) => `${Math.max(...GEM_COLORS.map(c => player.bonuses[c] || 0))}/5 Cards of 1 Color`
  },

  sovereign_sanction: {
    id: 'sovereign_sanction',
    name: 'Sovereign Sanctions',
    tier: 'rare',
    tierName: 'Rare Artifact',
    colorHex: '#c084fc',
    icon: '🛡️',
    type: 'instant',
    shortDesc: 'Curse: Opponent cannot purchase Tier 3 cards for 5 rounds!',
    description: 'Royal trade sanctions paralyze your rival. Opponent is completely barred from purchasing prestigious Tier 3 development cards for 5 rounds!',
    featDesc: 'Purchase at least 2 Tier 3 development cards.',
    checkFeat: (state, player) => player.cardsPurchased.filter(id => CARDS_BY_ID[id] && CARDS_BY_ID[id].tier === 3).length >= 2,
    getFeatProgress: (state, player) => `${player.cardsPurchased.filter(id => CARDS_BY_ID[id] && CARDS_BY_ID[id].tier === 3).length}/2 Tier 3 Cards`
  },

  vault_lockdown: {
    id: 'vault_lockdown',
    name: 'Vault Lockdown',
    tier: 'rare',
    tierName: 'Rare Artifact',
    colorHex: '#c084fc',
    icon: '⛓️',
    type: 'passive',
    shortDesc: "Curse Opponent: Their token vault limit is permanently slashed to 7!",
    description: 'Mercantile blockades restrict your rival. Your opponent’s maximum token capacity is permanently reduced to 7 (excess discarded immediately)!',
    featDesc: 'Hold at least 10 tokens simultaneously with 0 reserved cards.',
    checkFeat: (state, player) => countTokens(player.tokens) >= 10 && player.cardsReserved.length === 0,
    getFeatProgress: (state, player) => `${countTokens(player.tokens)}/10 Tokens (Reserved: ${player.cardsReserved.length}/0)`
  },

  coinage_mandate: {
    id: 'coinage_mandate',
    name: 'Coinage Mandate',
    tier: 'rare',
    tierName: 'Rare Artifact',
    colorHex: '#c084fc',
    icon: '🪙',
    type: 'instant',
    shortDesc: 'Curse: Opponent cannot use card discounts for 3 rounds (must pay 100% in cash)!',
    description: 'The Venetian Mint mandates physical coin settlement. For 3 rounds, opponent cannot use any permanent card bonuses — all card purchases must be paid in physical tokens and gold!',
    featDesc: 'Accumulate 8 development cards with 0 Gold Jokers in hand.',
    checkFeat: (state, player) => player.cardsPurchased.length >= 8 && (player.tokens.gold || 0) === 0,
    getFeatProgress: (state, player) => `${Math.min(8, player.cardsPurchased.length)}/8 Cards (Gold: ${player.tokens.gold || 0}/0)`
  },

  imperial_tithe: {
    id: 'imperial_tithe',
    name: 'Imperial Tithe',
    tier: 'rare',
    tierName: 'Rare Artifact',
    colorHex: '#c084fc',
    icon: '⚖️',
    type: 'instant',
    shortDesc: 'Curse: Opponent must pay +3 tokens surcharge on next 3 card purchases!',
    description: 'Crown tax collectors impose an exorbitant levy. Your rival must pay an additional surcharge of +3 physical tokens to the bank on each of their next 3 card purchases!',
    featDesc: 'Spend at least 4 tokens of the same color on a single card purchase.',
    checkFeat: (state, player) => !!player.hasSpentFourSameColorSingleBuy,
    getFeatProgress: (state, player) => player.hasSpentFourSameColorSingleBuy ? 'Done ✓' : '0/1 Single Color Buy (4+ tokens)'
  },

  espionage_heist: {
    id: 'espionage_heist',
    name: 'Espionage Heist',
    tier: 'rare',
    tierName: 'Rare Artifact',
    colorHex: '#c084fc',
    icon: '🗝️',
    type: 'instant',
    shortDesc: 'Steal 1 reserved card directly from your opponent’s hand!',
    description: 'Master infiltrators crack the rival vault. Select and snatch 1 reserved card directly from your opponent into your own reserved hand!',
    featDesc: 'Hold 3 reserved cards simultaneously in your hand.',
    checkFeat: (state, player) => player.cardsReserved.length >= 3,
    getFeatProgress: (state, player) => `${player.cardsReserved.length}/3 Reserved Cards in Hand`
  },

  black_market_master: {
    id: 'black_market_master',
    name: 'Black Market Master',
    tier: 'rare',
    tierName: 'Rare Artifact',
    colorHex: '#c084fc',
    icon: '🕶️',
    type: 'passive',
    shortDesc: 'Gold Jokers count as 2 tokens on card purchases.',
    description: 'Shadow syndicates prize gold above all. Every Gold Joker in your possession satisfies 2 tokens of deficit when purchasing any development card.',
    featDesc: 'Spend at least 3 Gold Jokers on a single card purchase.',
    checkFeat: (state, player) => (player.maxGoldSpentSingleCard || 0) >= 3,
    getFeatProgress: (state, player) => `${Math.min(3, player.maxGoldSpentSingleCard || 0)}/3 Gold Jokers in single purchase`
  },

  market_freeze: {
    id: 'market_freeze',
    name: 'Market Freeze',
    tier: 'rare',
    tierName: 'Rare Artifact',
    colorHex: '#c084fc',
    icon: '❄️',
    type: 'instant',
    shortDesc: 'The card market is frozen for 3 rounds (only reserved cards can be bought)!',
    description: 'Winter freezes the trade canals. For 3 rounds, no merchant may buy cards directly from the table — only cards already in a player’s reserved hand can be purchased!',
    featDesc: 'Purchase at least 3 cards directly from your reserved hand.',
    checkFeat: (state, player) => (player.reservedPurchasedCount || 0) >= 3,
    getFeatProgress: (state, player) => `${Math.min(3, player.reservedPurchasedCount || 0)}/3 Reserved Cards Purchased`
  },

  // -------------------------------------------------------------
  // TIER 3: MYTHIC WONDERS (SUPER RARE / GOLD) - 8 POWERS
  // -------------------------------------------------------------
  chronos_hourglass: {
    id: 'chronos_hourglass',
    name: 'Chronos Hourglass',
    tier: 'mythic',
    tierName: 'Mythic Wonder',
    colorHex: '#fbbf24',
    icon: '⏳',
    type: 'instant',
    shortDesc: 'Take 3 consecutive turns back-to-back!',
    description: 'Time bends to your royal command. Immediately take 3 consecutive full turns while your rival is frozen in time!',
    featDesc: 'Purchase at least 4 development cards across the match without using Gold Jokers.',
    checkFeat: (state, player) => (player.totalNoGoldPurchases || 0) >= 4,
    getFeatProgress: (state, player) => `${Math.min(4, player.totalNoGoldPurchases || 0)}/4 Pure Purchases (0 Gold)`
  },

  royal_usurpation: {
    id: 'royal_usurpation',
    name: 'Royal Usurpation',
    tier: 'mythic',
    tierName: 'Mythic Wonder',
    colorHex: '#fbbf24',
    icon: '🏰',
    type: 'instant',
    shortDesc: 'Steal 1 Noble directly from opponent’s court (+3 to you, -3 to them)!',
    description: 'A palace coup transfers royal favor. Steal 1 Noble patron directly from your rival’s court into your own court (+3 PTS to you, -3 PTS to them)!',
    featDesc: 'Own at least 3 Tier 3 cards while opponent possesses at least 1 Noble.',
    checkFeat: (state, player) => {
      const opponents = state.players.filter(p => p.id !== player.id);
      const t3Count = player.cardsPurchased.filter(id => CARDS_BY_ID[id] && CARDS_BY_ID[id].tier === 3).length;
      return t3Count >= 3 && opponents.some(opp => opp.noblesAcquired.length >= 1);
    },
    getFeatProgress: (state, player) => {
      const opp = state.players.filter(p => p.id !== player.id).sort((a, b) => b.noblesAcquired.length - a.noblesAcquired.length)[0];
      const t3Count = player.cardsPurchased.filter(id => CARDS_BY_ID[id] && CARDS_BY_ID[id].tier === 3).length;
      return `T3 Cards: ${t3Count}/3 | Opp Nobles: ${opp ? opp.noblesAcquired.length : 0}/1`;
    }
  },

  grand_inquisitor: {
    id: 'grand_inquisitor',
    name: 'The Grand Inquisitor',
    tier: 'mythic',
    tierName: 'Mythic Wonder',
    colorHex: '#fbbf24',
    icon: '⚡',
    type: 'instant',
    shortDesc: 'Drain 5 Prestige Points from opponent; gain 2 yourself!',
    description: 'An unyielding ecclesiastical audit. Deduct 5 Prestige Points directly from your opponent (minimum 0), and siphon 2 of those points to yourself!',
    featDesc: 'Own at least TWO Tier 3 cards AND at least one Noble.',
    checkFeat: (state, player) => {
      const t3Count = player.cardsPurchased.filter(id => CARDS_BY_ID[id] && CARDS_BY_ID[id].tier === 3).length;
      return t3Count >= 2 && player.noblesAcquired.length >= 1;
    },
    getFeatProgress: (state, player) => {
      const t3Count = player.cardsPurchased.filter(id => CARDS_BY_ID[id] && CARDS_BY_ID[id].tier === 3).length;
      return `T3 Cards: ${t3Count}/2 | Noble: ${player.noblesAcquired.length > 0 ? '✓' : '✗'}`;
    }
  },

  philosophers_magnum_opus: {
    id: 'philosophers_magnum_opus',
    name: "Philosopher's Magnum Opus",
    tier: 'mythic',
    tierName: 'Mythic Wonder',
    colorHex: '#fbbf24',
    icon: '☀️',
    type: 'instant',
    shortDesc: 'All 5 Gold Jokers turn into 5 Permanent Wildcard Bonuses!',
    description: 'The ultimate triumph of alchemy. All 5 Gold Jokers in your hand transform into 5 permanent wildcard bonuses, discounting every future card by 5 tokens!',
    featDesc: 'Hold all 5 Gold Jokers in the game simultaneously in your hand (5 Wild Gems Feat).',
    checkFeat: (state, player) => (player.tokens.gold || 0) >= 5,
    getFeatProgress: (state, player) => `${Math.min(5, player.tokens.gold || 0)}/5 Gold Jokers`
  },

  market_cataclysm: {
    id: 'market_cataclysm',
    name: 'Market Cataclysm',
    tier: 'mythic',
    tierName: 'Mythic Wonder',
    colorHex: '#fbbf24',
    icon: '☄️',
    type: 'instant',
    shortDesc: 'Wipe all 12 cards from board; claim 1 free Tier 3 card!',
    description: 'A great fire sweeps the merchant district. Wipe and discard all 12 cards on the table, deal 12 fresh cards, and take 1 free Tier 3 card without paying!',
    featDesc: 'Own at least 14 development cards across all tiers.',
    checkFeat: (state, player) => player.cardsPurchased.length >= 14,
    getFeatProgress: (state, player) => `${Math.min(14, player.cardsPurchased.length)}/14 Cards`
  },

  bankrupting_curse: {
    id: 'bankrupting_curse',
    name: 'The Bankrupting Curse',
    tier: 'mythic',
    tierName: 'Mythic Wonder',
    colorHex: '#fbbf24',
    icon: '💀',
    type: 'instant',
    shortDesc: 'Strip opponent of ALL their tokens and gold back to the bank!',
    description: 'Venetian bailiffs seize all enemy cash reserves. Empty your opponent’s entire token pouch back to the bank!',
    featDesc: 'Purchase a Tier 3 card worth 5 Prestige Points using 0 Gold Jokers.',
    checkFeat: (state, player) => !!player.hasBoughtFivePointTier3WithZeroGold,
    getFeatProgress: (state, player) => player.hasBoughtFivePointTier3WithZeroGold ? 'Done ✓' : '0/1 Pure 5-PT T3 Card'
  },

  celestial_alignment: {
    id: 'celestial_alignment',
    name: 'Celestial Alignment',
    tier: 'mythic',
    tierName: 'Mythic Wonder',
    colorHex: '#fbbf24',
    icon: '🌌',
    type: 'passive',
    shortDesc: 'Gain +1 permanent Wildcard bonus for each color with 3+ cards.',
    description: 'The celestial spheres harmonize with your merchant empire. For every gem color in which you own at least 3 development cards, gain +1 permanent Wildcard discount!',
    featDesc: 'Own at least 3 card bonuses in at least 3 different gem colors.',
    checkFeat: (state, player) => GEM_COLORS.filter(c => (player.bonuses[c] || 0) >= 3).length >= 3,
    getFeatProgress: (state, player) => `${GEM_COLORS.filter(c => (player.bonuses[c] || 0) >= 3).length}/3 Colors with 3+ Cards`
  },

  guildmaster_sovereignty: {
    id: 'guildmaster_sovereignty',
    name: "Guildmaster's Sovereignty",
    tier: 'mythic',
    tierName: 'Mythic Wonder',
    colorHex: '#fbbf24',
    icon: '👑',
    type: 'passive',
    shortDesc: 'Buying any card awards 1 free token of that card’s gem color.',
    description: 'Absolute dominion over guild commerce. Whenever you purchase any development card, automatically gain 1 physical token of that card’s bonus color from the bank (if available).',
    featDesc: 'Own at least 10 development cards across any tiers.',
    checkFeat: (state, player) => player.cardsPurchased.length >= 10,
    getFeatProgress: (state, player) => `${Math.min(10, player.cardsPurchased.length)}/10 Cards Purchased`
  }
};

/**
 * Draw 7 balanced Super Powers for a match:
 * 3 Common Boons, 2 Rare Relics, 2 Mythic Wonders
 */
export function drawMatchSuperPowers(count = 7) {
  const allPowers = Object.values(POWERS_DATA);
  const common = allPowers.filter(p => p.tier === 'common').sort(() => 0.5 - Math.random());
  const rare = allPowers.filter(p => p.tier === 'rare').sort(() => 0.5 - Math.random());
  const mythic = allPowers.filter(p => p.tier === 'mythic').sort(() => 0.5 - Math.random());

  const selected = [
    common[0],
    common[1],
    common[2],
    rare[0],
    rare[1],
    mythic[0],
    mythic[1]
  ];

  // Return a cloned state object for each
  return selected.map(p => ({
    id: p.id,
    name: p.name,
    tier: p.tier,
    tierName: p.tierName,
    colorHex: p.colorHex,
    icon: p.icon,
    type: p.type,
    shortDesc: p.shortDesc,
    description: p.description,
    featDesc: p.featDesc,
    claimedBy: null
  }));
}
