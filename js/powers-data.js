/**
 * Splendor Super Powers (Arcane Guild Powers) Dataset
 * 30 Unique Super Powers divided into 3 Tiers:
 * - Tier 1: Tactical Boons (Common / Cyan) - 12 Powers
 * - Tier 2: Relic Artifacts (Rare / Purple) - 10 Powers
 * - Tier 3: Mythic Wonders (Legendary / Gold) - 8 Powers
 *
 * Updated with high-impact adversarial curses (Guild Embargo, Sovereign Sanctions,
 * Coinage Mandate, Imperial Tithe, Espionage Heist) and proactive feats without trail-by-point restrictions.
 */

import { GEM_COLORS, CARDS_BY_ID, NOBLES_BY_ID } from './cards-data.js';

const countTokens = tokens => Object.values(tokens || {}).reduce((s, n) => s + (n || 0), 0);

export const POWERS_DATA = {
  // -------------------------------------------------------------
  // TIER 1: TACTICAL BOONS (COMMON / CYAN) - 12 POWERS
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

  double_quarry: {
    id: 'double_quarry',
    name: 'Double Quarry',
    tier: 'common',
    tierName: 'Common Boon',
    colorHex: '#38bdf8',
    icon: '⛏️',
    type: 'passive',
    shortDesc: 'Taking 2 same gems also grants 1 random distinct gem.',
    description: 'Rich gemstone veins yield collateral riches. Taking a pair of 2 same gems also grants 1 additional token of any different color from the bank.',
    featDesc: 'Take a pair of 2 same gems in 3 consecutive rounds.',
    checkFeat: (state, player) => (player.consecutivePairs || 0) >= 3,
    getFeatProgress: (state, player) => `${Math.min(3, player.consecutivePairs || 0)}/3 Consecutive Pairs`
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

  diamond_cartel: {
    id: 'diamond_cartel',
    name: 'Diamond Cartel',
    tier: 'common',
    tierName: 'Common Boon',
    colorHex: '#38bdf8',
    icon: '💠',
    type: 'passive',
    shortDesc: 'All cards with Diamond cost require 1 less Diamond.',
    description: 'Direct diamond cutting agreements lower overhead. All development cards requiring Diamond cost 1 fewer Diamond for you.',
    featDesc: 'Own at least 5 Diamond bonus development cards.',
    checkFeat: (state, player) => (player.bonuses.diamond || 0) >= 5,
    getFeatProgress: (state, player) => `${Math.min(5, player.bonuses.diamond || 0)}/5 Diamonds`
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

  alchemical_duplication: {
    id: 'alchemical_duplication',
    name: 'Alchemical Duplication',
    tier: 'common',
    tierName: 'Common Boon',
    colorHex: '#38bdf8',
    icon: '🧪',
    type: 'passive',
    shortDesc: 'Taking a pair of 2 gems also gives 1 token of another available pair.',
    description: 'Catalytic resonance duplicates gemstone yields. Whenever you take 2 tokens of the same color, gain 1 bonus token of any other color that also has 2+ in bank.',
    featDesc: 'Take pairs of 2 same gems in 2 consecutive turns.',
    checkFeat: (state, player) => (player.consecutivePairs || 0) >= 2,
    getFeatProgress: (state, player) => `${Math.min(2, player.consecutivePairs || 0)}/2 Consecutive Pairs`
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
    description: 'Informants in the rival vaults. Whenever your opponent takes tokens from the bank, claim 1 token of their most abundant color for yourself.',
    featDesc: 'Own at least 4 development cards while holding zero tokens in hand.',
    checkFeat: (state, player) => player.cardsPurchased.length >= 4 && countTokens(player.tokens) === 0,
    getFeatProgress: (state, player) => `${Math.min(4, player.cardsPurchased.length)}/4 Cards (Tokens: ${countTokens(player.tokens)}/0)`
  },

  bribed_courier: {
    id: 'bribed_courier',
    name: 'Bribed Courier',
    tier: 'common',
    tierName: 'Common Boon',
    colorHex: '#38bdf8',
    icon: '📬',
    type: 'instant',
    shortDesc: 'Instantly blind reserve top Tier 1 card + gain 2 Gold Jokers.',
    description: 'Couriers intercept royal shipments. Instantly draw the top card of the Tier 1 deck into your reserved hand (ignoring limit) and gain 2 Gold Jokers!',
    featDesc: 'Have reserved at least 2 cards across the match.',
    checkFeat: (state, player) => (player.totalReservedCount || 0) >= 2,
    getFeatProgress: (state, player) => `${Math.min(2, player.totalReservedCount || 0)}/2 Reserved Total`
  },

  gem_embargo_boon: {
    id: 'gem_embargo_boon',
    name: 'Market Interdict',
    tier: 'common',
    tierName: 'Common Boon',
    colorHex: '#38bdf8',
    icon: '⛔',
    type: 'instant',
    shortDesc: 'Opponent cannot take tokens of your most abundant gem for 3 rounds.',
    description: 'Proclaim an immediate trade interdict. Opponent is prohibited from taking tokens of your most abundant gem color for the next 3 rounds.',
    featDesc: 'Hold at least 4 tokens of the exact same color in hand.',
    checkFeat: (state, player) => GEM_COLORS.some(c => (player.tokens[c] || 0) >= 4),
    getFeatProgress: (state, player) => `${Math.max(...GEM_COLORS.map(c => player.tokens[c] || 0))}/4 of 1 Color`
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

  // -------------------------------------------------------------
  // TIER 2: RELIC ARTIFACTS (RARE / PURPLE) - 10 POWERS
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
    description: 'Venetian customs levy heavy extortion. Opponent must surrender an additional 3 tokens to the bank on their next 3 card purchases.',
    featDesc: 'Spend at least 4 tokens of the same color on a single card purchase.',
    checkFeat: (state, player) => !!player.hasSpentFourSameColorSingleBuy,
    getFeatProgress: (state, player) => player.hasSpentFourSameColorSingleBuy ? 'Done ✓' : '0/1 Buy (paid 4+ same gem)'
  },

  inverted_economy: {
    id: 'inverted_economy',
    name: 'Inverted Economy',
    tier: 'rare',
    tierName: 'Rare Artifact',
    colorHex: '#c084fc',
    icon: '🔄',
    type: 'passive',
    shortDesc: 'Tier 1 cards cost +1 token, but Tier 3 cards cost 2 fewer!',
    description: 'Skipping the peasantry for high aristocracy. Tier 1 cards cost you +1 token, but powerful Tier 3 cards cost 2 fewer tokens!',
    featDesc: 'Own at least 4 Tier 2 development cards.',
    checkFeat: (state, player) => player.cardsPurchased.filter(id => CARDS_BY_ID[id] && CARDS_BY_ID[id].tier === 2).length >= 4,
    getFeatProgress: (state, player) => `${player.cardsPurchased.filter(id => CARDS_BY_ID[id] && CARDS_BY_ID[id].tier === 2).length}/4 Tier 2 Cards`
  },

  aristocrats_heist: {
    id: 'aristocrats_heist',
    name: "Aristocrat's Heist",
    tier: 'rare',
    tierName: 'Rare Artifact',
    colorHex: '#c084fc',
    icon: '🎭',
    type: 'instant',
    shortDesc: 'Instantly recruit 1 Noble from the board regardless of reqs.',
    description: 'Forged royal lineages fool the nobility. Instantly recruit any 1 Noble currently on the board, ignoring all requirements!',
    featDesc: 'Accumulate a total of 12 card bonuses across all colors.',
    checkFeat: (state, player) => Object.values(player.bonuses).reduce((a, b) => a + b, 0) >= 12,
    getFeatProgress: (state, player) => `${Object.values(player.bonuses).reduce((a, b) => a + b, 0)}/12 Bonuses`
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
    description: 'Counterfeit craftsmanship multiplies gold value. Each Gold Joker you spend counts as 2 tokens of your required color.',
    featDesc: 'Spend at least 3 Gold Jokers on a single card purchase.',
    checkFeat: (state, player) => (player.maxGoldSpentSingleCard || 0) >= 3,
    getFeatProgress: (state, player) => `${Math.min(3, player.maxGoldSpentSingleCard || 0)}/3 Gold in 1 Buy`
  },

  espionage_heist: {
    id: 'espionage_heist',
    name: 'Espionage Heist',
    tier: 'rare',
    tierName: 'Rare Artifact',
    colorHex: '#c084fc',
    icon: '🗝️',
    type: 'instant',
    shortDesc: "Steal 1 reserved card directly from your opponent's private hand!",
    description: 'Master thieves infiltrate your rival’s desk. Instantly seize 1 reserved card from your opponent’s hand into your reserved hand (if space permits)!',
    featDesc: 'Hold 3 reserved cards simultaneously in your hand.',
    checkFeat: (state, player) => player.cardsReserved.length >= 3,
    getFeatProgress: (state, player) => `${player.cardsReserved.length}/3 Reserved Cards`
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
    description: 'A sudden market closure halts public trading. For 3 rounds, neither merchant can purchase cards from the table — purchases can ONLY be made from reserved hands!',
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
    featDesc: 'Complete 2 card purchases in consecutive turns without using Gold Jokers.',
    checkFeat: (state, player) => (player.consecutiveNoGoldPurchases || 0) >= 2,
    getFeatProgress: (state, player) => `${Math.min(2, player.consecutiveNoGoldPurchases || 0)}/2 Consecutive Pure Buys`
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

  dynastic_hegemony: {
    id: 'dynastic_hegemony',
    name: 'Dynastic Hegemony',
    tier: 'mythic',
    tierName: 'Mythic Wonder',
    colorHex: '#fbbf24',
    icon: '🏆',
    type: 'passive',
    shortDesc: 'Winning prestige goal reduced to 12 Points for you!',
    description: 'Your dynasty gains divine right. The winning prestige requirement is lowered to 12 points for you, while remaining standard for your opponent!',
    featDesc: 'Own at least 3 development cards in all 5 gem colors (15 cards total).',
    checkFeat: (state, player) => GEM_COLORS.every(c => (player.bonuses[c] || 0) >= 3),
    getFeatProgress: (state, player) => `${GEM_COLORS.filter(c => (player.bonuses[c] || 0) >= 3).length}/5 Colors with 3+ Cards`
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

  emperors_regalia: {
    id: 'emperors_regalia',
    name: "The Emperor's Regalia",
    tier: 'mythic',
    tierName: 'Mythic Wonder',
    colorHex: '#fbbf24',
    icon: '⚜️',
    type: 'instant',
    shortDesc: 'Instantly recruit ALL remaining Nobles on the table!',
    description: 'Ascend to the imperial throne. Immediately claim every remaining Noble tile left on the table into your court!',
    featDesc: 'Reach at least 14 Prestige Points without owning any Nobles.',
    checkFeat: (state, player) => player.prestigePoints >= 14 && player.noblesAcquired.length === 0,
    getFeatProgress: (state, player) => `${Math.min(14, player.prestigePoints)}/14 PTS (Nobles: ${player.noblesAcquired.length}/0)`
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
