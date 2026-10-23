/**
 * Splendor Core Engine - Deterministic Authoritative State Machine
 * 100% compliant with official rules, PRD specifications, and edge-cases.
 */

import {
  GEM_COLORS,
  ALL_TOKENS,
  TIER_1_CARDS,
  TIER_2_CARDS,
  TIER_3_CARDS,
  CARDS_BY_ID,
  NOBLE_TILES,
  NOBLES_BY_ID
} from './cards-data.js';
import { POWERS_DATA, drawMatchSuperPowers } from './powers-data.js';

/**
 * Utility: Fisher-Yates shuffle returning a new shuffled array
 */
export function shuffle(array) {
  const copy = [...array];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/**
 * Supported Game Modes Configuration
 */
export const GAME_MODES = {
  classic: {
    id: 'classic',
    name: 'Crown of Prestige',
    badge: '👑 Crown of Prestige',
    shortDesc: 'Race to target prestige points (15-35 PTS)',
    description: 'The standard Renaissance competition. Collect gems, purchase developments, and attract nobles to reach the target prestige points.',
    icon: '👑'
  },
  onyx_syndicate: {
    id: 'onyx_syndicate',
    name: 'Shadow Syndicate',
    badge: '🖤 Shadow Syndicate',
    shortDesc: 'First to collect 10 Onyx (black) cards wins',
    description: 'The Black Market Guild offers supreme influence. The first merchant to collect 10 Onyx (black) development cards wins immediately!',
    icon: '🖤',
    targetOnyx: 10
  },
  tier_ladder: {
    id: 'tier_ladder',
    name: 'Guild Hierarchy',
    badge: '🪜 Guild Hierarchy',
    shortDesc: 'Requires 6 Tier 1 cards for Tier 2; 6 Tier 2 cards for Tier 3',
    description: 'Mastery requires true foundation. You must own at least 6 Tier 1 cards to purchase Tier 2 cards, and at least 6 Tier 2 cards to purchase Tier 3 cards.',
    icon: '🪜',
    requiredTierCards: 6
  },
  color_supremacy: {
    id: 'color_supremacy',
    name: 'Merchant Cartel',
    badge: '⭐ Merchant Cartel',
    shortDesc: 'First to 5 cards in a color gets 1 Trophy; first to 3 Trophies wins',
    description: 'Corner the gemstone markets! The first player to reach 5 cards in any color earns that gem’s Monopoly Trophy (1 pt). First player to collect 3 Monopoly Trophies wins!',
    icon: '⭐',
    cardsPerColor: 5,
    targetTrophies: 3
  },
  noble_court: {
    id: 'noble_court',
    name: 'Royal Court Intrigue',
    badge: '⚜️ Royal Court',
    shortDesc: 'First merchant to recruit 3 Noble Patrons wins',
    description: 'Prestige is nothing without royal backing. In this court intrigue, the first merchant to attract 3 Noble patrons wins the crown!',
    icon: '⚜️',
    targetNobles: 3
  },
  rainbow_guild: {
    id: 'rainbow_guild',
    name: 'Renaissance Prism',
    badge: '🌈 Renaissance Prism',
    shortDesc: 'First to own at least 3 cards of each of the 5 colors wins',
    description: 'A true master cannot specialize in only one trade. First merchant to assemble at least 3 development cards in every single gem color (15 cards total) wins!',
    icon: '🌈',
    cardsPerColorReq: 3
  },
  super_powers: {
    id: 'super_powers',
    name: 'Arcane Ascension',
    badge: '⚡ Arcane Ascension',
    shortDesc: '24 Arcane Powers active with customizable draft rules',
    description: '24 legendary super powers await! Combine with Pure Renaissance, Shattered Seals, or Dueling Destinies.',
    icon: '⚡',
    twoPlayerRecommended: true
  }
};

/**
 * Creates initial bank tokens given player count
 */
export function getInitialBank(playerCount) {
  let regularCount = 7;
  if (playerCount === 2) regularCount = 4;
  else if (playerCount === 3) regularCount = 5;

  return {
    diamond: regularCount,
    sapphire: regularCount,
    emerald: regularCount,
    ruby: regularCount,
    onyx: regularCount,
    gold: 5
  };
}

/**
 * Calculate total tokens held by a player or in a supply
 */
export function countTokens(tokens) {
  return ALL_TOKENS.reduce((sum, color) => sum + (tokens[color] || 0), 0);
}

/**
 * Creates a new Game State
 */
export function createGameState(options = {}) {
  const {
    playerNames = ['Player 1', 'Player 2'],
    aiConfigs = [null, { difficulty: 'merchant' }],
    timeLimitSeconds = 60,
    targetPoints = 15,
    gameMode = 'classic'
  } = options;

  const resolvedTargetPoints = parseInt(options.targetPoints || options.winningPoints || targetPoints, 10) || 15;
  const resolvedGameMode = GAME_MODES[gameMode] ? gameMode : 'classic';

  const playerCount = playerNames.length;
  if (playerCount < 2 || playerCount > 4) {
    throw new Error('Player count must be between 2 and 4');
  }

  // Shuffle card decks
  const decks = {
    1: shuffle(TIER_1_CARDS.map(c => c.id)),
    2: shuffle(TIER_2_CARDS.map(c => c.id)),
    3: shuffle(TIER_3_CARDS.map(c => c.id))
  };

  // Draw 4 cards for each tier grid
  const tableCards = {
    1: [null, null, null, null],
    2: [null, null, null, null],
    3: [null, null, null, null]
  };

  for (const tier of [1, 2, 3]) {
    for (let slot = 0; slot < 4; slot++) {
      if (decks[tier].length > 0) {
        tableCards[tier][slot] = decks[tier].pop();
      }
    }
  }

  // Shuffle and pick Nobles (in noble_court mode: 5 for 2P, 6 for 3P, 7 for 4P to ensure plenty of patrons)
  const nobleCount = (resolvedGameMode === 'noble_court')
    ? Math.min(NOBLE_TILES.length, playerCount + 3)
    : (playerCount + 1);
  const shuffledNobles = shuffle(NOBLE_TILES.map(n => n.id)).slice(0, nobleCount);

  // Initialize Players
  const players = playerNames.map((name, idx) => {
    const aiConfig = aiConfigs[idx];
    return {
      id: `p_${idx + 1}`,
      name: name || `Player ${idx + 1}`,
      isAi: !!aiConfig,
      aiDifficulty: aiConfig ? aiConfig.difficulty : null,
      tokens: { diamond: 0, sapphire: 0, emerald: 0, ruby: 0, onyx: 0, gold: 0 },
      bonuses: { diamond: 0, sapphire: 0, emerald: 0, ruby: 0, onyx: 0 },
      cardsPurchased: [],
      cardsReserved: [], // up to 3 cards
      noblesAcquired: [],
      prestigePoints: 0,
      trophies: 0,
      claimedColors: [],
      powersClaimed: [],
      vaultLimit: 10,
      reserveLimit: 3,
      goldPerReserve: 1,
      wildBonuses: 0,
      synergyDiscounts: 0,
      hasSilkRoadCaravan: false,
      hasCelestialAlignment: false,
      hasGuildmasterSovereignty: false,
      totalReservedCount: 0,
      maxGoldSpentSingleCard: 0,
      hasBoughtCardWithZeroTokens: false,
      hasBoughtHighTierWithZeroTokens: false,
      hasBoughtExpensiveTier2: false,
      hasBoughtExpensiveTier2Cash: false,
      hasBoughtHeavyTier3: false,
      hasBoughtFivePointTier3WithZeroGold: false,
      hasSpentFourSameColorSingleBuy: false,
      reservedPurchasedCount: 0,
      totalNoGoldPurchases: 0,
      hasSabotagedOpponentCard: false,
      hasSabotagedHeavyTier3Card: false,
      activeCurses: {},
      stats: {
        tokensGained: 0,
        cardsBought: 0,
        noblesClaimed: 0,
        goldUsed: 0
      }
    };
  });

  let powersRule = options.powersRule;
  if (!powersRule) {
    if (options.enableSuperPowers === true || resolvedGameMode === 'super_powers') {
      powersRule = 'feats';
    } else {
      powersRule = 'none';
    }
  } else if (powersRule === 'nobles') {
    powersRule = 'feats';
  }
  const superPowersEnabled = powersRule !== 'none';

  const modeBadge = GAME_MODES[resolvedGameMode].badge;
  return {
    gameId: `game_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    gameMode: resolvedGameMode,
    superPowersEnabled,
    powersRule,
    pendingPowerDraft: null,
    draftsCompletedRounds: [],
    marketFreezeRounds: 0,
    colorTrophies: { diamond: null, sapphire: null, emerald: null, ruby: null, onyx: null },
    status: 'in_progress', // 'in_progress' | 'final_round' | 'completed'
    turnIndex: 0,
    roundIndex: 1,
    activePlayerIndex: 0,
    startingPlayerIndex: 0,
    players,
    bank: getInitialBank(playerCount),
    decks,
    tableCards,
    nobles: shuffledNobles,
    availablePowers: (superPowersEnabled && powersRule === 'feats') ? drawMatchSuperPowers(7) : [],
    powersRevealed: false,
    extraTurnsRemaining: 0,
    extraTurnsPlayerId: null,
    winnerId: null,
    rankings: null,
    pendingDiscard: null, // { playerId: string, excessCount: number }
    pendingNobleChoice: null, // { playerId: string, nobleIds: string[] }
    moveLog: [
      {
        turn: 0,
        playerId: 'system',
        playerName: 'Game',
        actionType: 'start',
        description: `Game initialized (${modeBadge}) for ${playerCount} players. First player is ${players[0].name}.`,
        timestamp: Date.now()
      }
    ],
    timeLimitSeconds,
    turnDeadline: timeLimitSeconds > 0 ? Date.now() + timeLimitSeconds * 1000 : null,
    targetPoints: resolvedTargetPoints
  };
}

/**
 * Check if a player can afford and is legally qualified to buy a card
 * (respects Tier Ladder constraints in tier_ladder mode)
 */
export function canPlayerBuyCard(state, playerIndex, cardId) {
  if (!cardId) return false;
  const player = state.players[playerIndex];
  if (!player) return false;
  const card = CARDS_BY_ID[cardId];
  if (!card) return false;
  if (!canAffordCard(player, card)) return false;

  if (state.marketFreezeRounds > 0 && !player.cardsReserved.includes(cardId)) {
    return false;
  }

  if (player.activeCurses?.sovereign_sanction?.roundsLeft > 0 && card.tier === 3) {
    return false;
  }

  if (state.gameMode === 'tier_ladder') {
    if (card.tier === 2) {
      const t1Count = player.cardsPurchased.filter(id => CARDS_BY_ID[id] && CARDS_BY_ID[id].tier === 1).length;
      if (t1Count < 6) return false;
    } else if (card.tier === 3) {
      const t2Count = player.cardsPurchased.filter(id => CARDS_BY_ID[id] && CARDS_BY_ID[id].tier === 2).length;
      if (t2Count < 6) return false;
    }
  }

  return true;
}

/**
 * Calculate effective card cost applying any active discounts/modifiers
 */
export function getEffectiveCardCost(player, card) {
  if (!card) return {};
  const cost = { ...card.cost };
  if (player && player.hasInvertedEconomy) {
    if (card.tier === 1) {
      const firstCol = GEM_COLORS.find(c => (cost[c] || 0) > 0) || 'diamond';
      cost[firstCol] = (cost[firstCol] || 0) + 1;
    } else if (card.tier === 3) {
      let discount = 2;
      for (const c of GEM_COLORS) {
        if ((cost[c] || 0) > 0 && discount > 0) {
          const d = Math.min(cost[c], discount);
          cost[c] -= d;
          discount -= d;
        }
      }
    }
  }
  return cost;
}

/**
 * Check if a player can afford a given card
 */
export function canAffordCard(player, card) {
  if (!card) return false;
  const cost = getEffectiveCardCost(player, card);
  const isCoinageMandate = !!(player.activeCurses?.coinage_mandate?.roundsLeft > 0);
  const embargoColor = (player.activeCurses?.guild_embargo?.roundsLeft > 0) ? player.activeCurses.guild_embargo.blockedColor : null;

  let totalDeficit = 0;
  for (const color of GEM_COLORS) {
    const c = cost[color] || 0;
    const bonus = (isCoinageMandate || color === embargoColor) ? 0 : (player.bonuses[color] || 0);
    const needed = Math.max(0, c - bonus);
    const have = player.tokens[color] || 0;
    if (have < needed) {
      totalDeficit += (needed - have);
    }
  }

  const titheSurcharge = (player.activeCurses?.imperial_tithe?.chargesLeft > 0) ? (player.activeCurses.imperial_tithe.surcharge || 3) : 0;
  const celestialBonus = (player.hasCelestialAlignment || (player.powersClaimed && player.powersClaimed.includes('celestial_alignment')))
    ? GEM_COLORS.filter(c => (player.bonuses[c] || 0) >= 3).length
    : 0;
  const wildDiscounts = (player.wildBonuses || 0) + celestialBonus + (player.synergyDiscounts > 0 ? 2 : 0);
  const remainingDeficit = Math.max(0, totalDeficit - wildDiscounts) + titheSurcharge;
  const goldMultiplier = player.hasBlackMarket ? 2 : 1;
  return ((player.tokens.gold || 0) * goldMultiplier) >= remainingDeficit;
}

/**
 * Calculate the exact token payment breakdown for a card
 */
export function calculateCardPayment(player, card) {
  const regularTokensPaid = { diamond: 0, sapphire: 0, emerald: 0, ruby: 0, onyx: 0 };
  let totalDeficit = 0;
  let totalRegularNeeded = 0;

  const cost = getEffectiveCardCost(player, card);
  const isCoinageMandate = !!(player.activeCurses?.coinage_mandate?.roundsLeft > 0);
  const embargoColor = (player.activeCurses?.guild_embargo?.roundsLeft > 0) ? player.activeCurses.guild_embargo.blockedColor : null;

  for (const color of GEM_COLORS) {
    const c = cost[color] || 0;
    const bonus = (isCoinageMandate || color === embargoColor) ? 0 : (player.bonuses[color] || 0);
    const needed = Math.max(0, c - bonus);
    const have = player.tokens[color] || 0;
    const payingRegular = Math.min(have, needed);
    regularTokensPaid[color] = payingRegular;
    totalRegularNeeded += payingRegular;
    if (needed > payingRegular) {
      totalDeficit += (needed - payingRegular);
    }
  }

  const titheSurcharge = (player.activeCurses?.imperial_tithe?.chargesLeft > 0) ? (player.activeCurses.imperial_tithe.surcharge || 3) : 0;

  // Apply wild bonuses, celestial alignment & synergy discounts
  const celestialBonus = (player.hasCelestialAlignment || (player.powersClaimed && player.powersClaimed.includes('celestial_alignment')))
    ? GEM_COLORS.filter(c => (player.bonuses[c] || 0) >= 3).length
    : 0;
  const wildDiscounts = (player.wildBonuses || 0) + celestialBonus + (player.synergyDiscounts > 0 ? 2 : 0);
  const deficitCovered = Math.min(totalDeficit, wildDiscounts);
  const remainingDeficit = (totalDeficit - deficitCovered) + titheSurcharge;

  const goldMultiplier = player.hasBlackMarket ? 2 : 1;
  const actualGoldNeeded = Math.ceil(remainingDeficit / goldMultiplier);

  if ((player.tokens.gold || 0) < actualGoldNeeded) {
    return null; // Cannot afford
  }

  // Any surplus discount after covering deficits reduces the regular tokens paid
  let surplusDiscount = wildDiscounts - deficitCovered;
  if (surplusDiscount > 0) {
    for (const color of GEM_COLORS) {
      if (surplusDiscount <= 0) break;
      const deduction = Math.min(regularTokensPaid[color], surplusDiscount);
      regularTokensPaid[color] -= deduction;
      surplusDiscount -= deduction;
    }
  }

  return {
    regular: regularTokensPaid,
    gold: actualGoldNeeded
  };
}

/**
 * Action 1: Take 3 distinct tokens
 */
export function validateTakeDistinctTokens(state, playerIndex, colors) {
  if (state.activePlayerIndex !== playerIndex) {
    return { valid: false, error: 'Not active player turn' };
  }
  if (state.pendingDiscard || state.pendingNobleChoice || state.pendingPowerDraft) {
    return { valid: false, error: 'Must resolve pending action first' };
  }

  // Validate distinct colors
  if (!Array.isArray(colors) || colors.length === 0) {
    return { valid: false, error: 'No tokens selected' };
  }

  const unique = new Set(colors);
  if (unique.size !== colors.length) {
    return { valid: false, error: 'Tokens must be of distinct colors' };
  }

  if (colors.some(c => c === 'gold' || !GEM_COLORS.includes(c))) {
    return { valid: false, error: 'Invalid gem color or gold chosen' };
  }

  const player = state.players[playerIndex];
  const blockedGem = (player && player.activeCurses?.gem_embargo?.roundsLeft > 0) ? (player.activeCurses.gem_embargo.blockedColor || player.activeCurses.gem_embargo.color) : null;
  if (blockedGem && colors.includes(blockedGem)) {
    return { valid: false, error: `Market Interdict: Taking ${blockedGem.toUpperCase()} tokens is blocked for you!` };
  }

  // Count how many distinct regular gem colors have >= 1 in bank
  const availableColors = GEM_COLORS.filter(c => state.bank[c] > 0);
  const hasPrismatic = player && (player.hasPrismaticHarmony || (player.powersClaimed && player.powersClaimed.includes('prismatic_harmony')));
  const maxAllowed = (hasPrismatic && availableColors.length >= 4) ? 4 : 3;

  if (availableColors.length >= 3) {
    if (colors.length !== 3 && colors.length !== maxAllowed) {
      return { valid: false, error: maxAllowed === 4 ? 'Must select 3 or 4 distinct colors when available' : 'Must select exactly 3 distinct colors when available' };
    }
  } else {
    // If fewer than 3 available, must take exactly availableColors.length distinct tokens
    if (colors.length !== availableColors.length) {
      return { valid: false, error: `Must select all ${availableColors.length} available colors` };
    }
  }

  for (const c of colors) {
    if (state.bank[c] < 1) {
      return { valid: false, error: `Bank has no ${c} tokens available` };
    }
  }

  return { valid: true };
}

export function executeTakeDistinctTokens(state, playerIndex, colors) {
  const validation = validateTakeDistinctTokens(state, playerIndex, colors);
  if (!validation.valid) throw new Error(validation.error);

  const player = state.players[playerIndex];
  const hadZeroInAllColors = colors.length === 3 && colors.every(c => (player.tokens[c] || 0) === 0);

  // Deduct from bank, add to player
  for (const c of colors) {
    state.bank[c] -= 1;
    player.tokens[c] += 1;
  }
  player.stats.tokensGained += colors.length;

  // Silk Road Caravan bonus
  if ((player.hasSilkRoadCaravan || (player.powersClaimed && player.powersClaimed.includes('silk_road_caravan'))) && hadZeroInAllColors && state.bank.gold > 0) {
    state.bank.gold -= 1;
    player.tokens.gold += 1;
    logMove(state, player, 'power_effect', '🐫 Silk Road Caravan: Took 3 fresh gems you did not hold! Gained +1 Gold Joker!');
  }

  const colorNames = colors.map(c => c.charAt(0).toUpperCase() + c.slice(1)).join(', ');
  logMove(state, player, 'take_tokens', `Took ${colors.length} distinct gems: [${colorNames}]`);

  // Toll Collector & Shadow Siphon checks
  const opponents = state.players.filter(p => p.id !== player.id);
  for (const opp of opponents) {
    const oppMax = opp.vaultLimit || 10;
    if (countTokens(opp.tokens) < oppMax) {
      if (opp.hasTollCollector && colors.length > 0) {
        const tollGem = colors.find(c => (player.tokens[c] || 0) > 0);
        if (tollGem) {
          player.tokens[tollGem] -= 1;
          opp.tokens[tollGem] = (opp.tokens[tollGem] || 0) + 1;
          logMove(state, opp, 'power_effect', `⚖️ Toll Collector: ${opp.name} collected 1 ${tollGem} toll from ${player.name}!`);
        }
      }
      if (opp.hasShadowSiphon) {
        const sortedGems = [...GEM_COLORS].filter(c => (player.tokens[c] || 0) > 0).sort((a, b) => player.tokens[b] - player.tokens[a]);
        if (sortedGems.length > 0) {
          const siphonedGem = sortedGems[0];
          player.tokens[siphonedGem] -= 1;
          opp.tokens[siphonedGem] = (opp.tokens[siphonedGem] || 0) + 1;
          logMove(state, opp, 'power_effect', `👤 Shadow Siphon: ${opp.name} siphoned 1 ${siphonedGem} from ${player.name}!`);
        }
      }
    }
  }

  checkAllSuperPowerFeats(state);
  checkPostActionTokenLimit(state, player);
  return state;
}

/**
 * Action 2: Take 2 tokens of the same color
 */
export function validateTakePairTokens(state, playerIndex, color) {
  if (state.activePlayerIndex !== playerIndex) {
    return { valid: false, error: 'Not active player turn' };
  }
  if (state.pendingDiscard || state.pendingNobleChoice || state.pendingPowerDraft) {
    return { valid: false, error: 'Must resolve pending action first' };
  }
  if (!GEM_COLORS.includes(color)) {
    return { valid: false, error: 'Invalid regular gem color' };
  }
  const player = state.players[playerIndex];
  const blockedGem = (player && player.activeCurses?.gem_embargo?.roundsLeft > 0) ? (player.activeCurses.gem_embargo.blockedColor || player.activeCurses.gem_embargo.color) : null;
  if (blockedGem && color === blockedGem) {
    return { valid: false, error: `Market Interdict: Taking ${blockedGem.toUpperCase()} tokens is blocked for you!` };
  }
  if (state.bank[color] < 4) {
    return { valid: false, error: `Stack must have at least 4 ${color} tokens (current: ${state.bank[color]})` };
  }
  return { valid: true };
}

export function executeTakePairTokens(state, playerIndex, color) {
  const validation = validateTakePairTokens(state, playerIndex, color);
  if (!validation.valid) throw new Error(validation.error);

  const player = state.players[playerIndex];
  state.bank[color] -= 2;
  player.tokens[color] += 2;
  player.stats.tokensGained += 2;

  const colorName = color.charAt(0).toUpperCase() + color.slice(1);
  const actionDesc = `Took 2 ${colorName} gems`;

  logMove(state, player, 'take_pair', actionDesc);

  // Toll Collector & Shadow Siphon checks
  const pairOpponents = state.players.filter(p => p.id !== player.id);
  for (const opp of pairOpponents) {
    const oppMax = opp.vaultLimit || 10;
    if (countTokens(opp.tokens) < oppMax) {
      if (opp.hasTollCollector && (player.tokens[color] || 0) > 0) {
        player.tokens[color] -= 1;
        opp.tokens[color] = (opp.tokens[color] || 0) + 1;
        logMove(state, opp, 'power_effect', `⚖️ Toll Collector: ${opp.name} collected 1 ${color} toll from ${player.name}!`);
      }
      if (opp.hasShadowSiphon && (player.tokens[color] || 0) > 0) {
        player.tokens[color] -= 1;
        opp.tokens[color] = (opp.tokens[color] || 0) + 1;
        logMove(state, opp, 'power_effect', `👤 Shadow Siphon: ${opp.name} siphoned 1 ${color} from ${player.name}!`);
      }
    }
  }

  checkAllSuperPowerFeats(state);
  checkPostActionTokenLimit(state, player);
  return state;
}

/**
 * Action 3: Reserve a card (+ 1 gold token if available)
 */
export function validateReserveCard(state, playerIndex, options) {
  const { cardId, tier, slotIndex, fromDeck } = options;
  if (state.activePlayerIndex !== playerIndex) {
    return { valid: false, error: 'Not active player turn' };
  }
  if (state.pendingDiscard || state.pendingNobleChoice || state.pendingPowerDraft) {
    return { valid: false, error: 'Must resolve pending action first' };
  }
  const player = state.players[playerIndex];
  const maxLimit = player.reserveLimit || 3;
  if (player.cardsReserved.length >= maxLimit) {
    return { valid: false, error: `Reserved cards limit (${maxLimit}) already reached` };
  }

  if (fromDeck) {
    if (![1, 2, 3].includes(tier)) {
      return { valid: false, error: 'Invalid deck tier' };
    }
    if (state.decks[tier].length === 0) {
      return { valid: false, error: `Tier ${tier} draw deck is empty` };
    }
  } else {
    // Face-up card on table
    let found = false;
    for (const t of [1, 2, 3]) {
      for (let s = 0; s < 4; s++) {
        if (state.tableCards[t][s] === cardId) {
          found = true;
          break;
        }
      }
    }
    if (!found) {
      return { valid: false, error: 'Card not found on board' };
    }
  }

  return { valid: true };
}

export function executeReserveCard(state, playerIndex, options) {
  const validation = validateReserveCard(state, playerIndex, options);
  if (!validation.valid) throw new Error(validation.error);

  const player = state.players[playerIndex];
  let reservedCardId = null;
  let cardInfo = null;
  let actionDesc = '';

  if (options.fromDeck) {
    reservedCardId = state.decks[options.tier].pop();
    cardInfo = CARDS_BY_ID[reservedCardId];
    actionDesc = `Reserved top blind card from Tier ${options.tier} deck`;
  } else {
    reservedCardId = options.cardId;
    cardInfo = CARDS_BY_ID[reservedCardId];

    // Find and clear slot on board, replenish from deck
    for (const t of [1, 2, 3]) {
      for (let s = 0; s < 4; s++) {
        if (state.tableCards[t][s] === reservedCardId) {
          state.tableCards[t][s] = state.decks[t].length > 0 ? state.decks[t].pop() : null;
          break;
        }
      }
    }
    if (options.sabotage) {
      actionDesc = `⚔️ SABOTAGED ${options.sabotageTargetName || 'Opponent'}! Reserved Tier ${cardInfo.tier} card (${cardInfo.gemBonus} bonus, ${cardInfo.prestigePoints} pts)`;
    } else {
      actionDesc = `Reserved Tier ${cardInfo.tier} card (${cardInfo.gemBonus} bonus, ${cardInfo.prestigePoints} pts)`;
    }
  }

  player.cardsReserved.push(reservedCardId);
  player.totalReservedCount = (player.totalReservedCount || 0) + 1;

  // Sabotage check for feat tracking
  const opponents = state.players.filter(p => p.id !== player.id);
  const oppCanAfford = opponents.some(opp => canPlayerBuyCard(state, state.players.indexOf(opp), reservedCardId));
  if (oppCanAfford) {
    player.hasSabotagedOpponentCard = true;
    if (cardInfo && cardInfo.tier === 3 && cardInfo.prestigePoints >= 4) {
      player.hasSabotagedHeavyTier3Card = true;
    }
  }

  // Award Gold according to player.goldPerReserve (Midas Crucible = 2)
  const goldLimit = player.goldPerReserve || 1;
  const goldAwarded = Math.min(state.bank.gold, goldLimit);
  if (goldAwarded > 0) {
    state.bank.gold -= goldAwarded;
    player.tokens.gold += goldAwarded;
    actionDesc += ` + ${goldAwarded} Gold Joker${goldAwarded > 1 ? 's' : ''}`;
  }

  logMove(state, player, 'reserve', actionDesc);

  checkAllSuperPowerFeats(state);
  checkPostActionTokenLimit(state, player);
  return state;
}

/**
 * Action 4: Purchase a card (from table or reserved hand)
 */
export function validatePurchaseCard(state, playerIndex, cardId) {
  if (state.activePlayerIndex !== playerIndex) {
    return { valid: false, error: 'Not active player turn' };
  }
  if (state.pendingDiscard || state.pendingNobleChoice || state.pendingPowerDraft) {
    return { valid: false, error: 'Must resolve pending action first' };
  }

  const player = state.players[playerIndex];
  const card = CARDS_BY_ID[cardId];
  if (!card) {
    return { valid: false, error: 'Invalid card ID' };
  }

  // Check if card is on board or in player's reserved hand
  const isReserved = player.cardsReserved.includes(cardId);
  let isOnTable = false;
  for (const t of [1, 2, 3]) {
    if (state.tableCards[t].includes(cardId)) {
      isOnTable = true;
      break;
    }
  }

  if (!isReserved && !isOnTable) {
    return { valid: false, error: 'Card not available to purchase' };
  }

  if (!canAffordCard(player, card)) {
    return { valid: false, error: 'Cannot afford this card' };
  }

  // Check market freeze & sovereign sanctions
  if (state.marketFreezeRounds > 0 && !player.cardsReserved.includes(cardId)) {
    return { valid: false, error: 'Market is frozen! Only cards from your reserved hand can be purchased.' };
  }

  if (player.activeCurses?.sovereign_sanction?.roundsLeft > 0 && card.tier === 3) {
    return { valid: false, error: 'Tier 3 card purchases are blocked by Sovereign Sanctions!' };
  }

  if (state.gameMode === 'tier_ladder') {
    if (card.tier === 2) {
      const t1Count = player.cardsPurchased.filter(id => CARDS_BY_ID[id] && CARDS_BY_ID[id].tier === 1).length;
      if (t1Count < 6) {
        return { valid: false, error: `Guild Ladder: Requires at least 6 Tier 1 cards before buying Tier 2 cards (currently have ${t1Count}/6)` };
      }
    } else if (card.tier === 3) {
      const t2Count = player.cardsPurchased.filter(id => CARDS_BY_ID[id] && CARDS_BY_ID[id].tier === 2).length;
      if (t2Count < 6) {
        return { valid: false, error: `Guild Ladder: Requires at least 6 Tier 2 cards before buying Tier 3 cards (currently have ${t2Count}/6)` };
      }
    }
  }

  return { valid: true, isReserved, isOnTable, card };
}

export function executePurchaseCard(state, playerIndex, cardId, options = {}) {
  const validation = validatePurchaseCard(state, playerIndex, cardId);
  if (!validation.valid) throw new Error(validation.error);

  const player = state.players[playerIndex];
  const card = validation.card;
  const payment = calculateCardPayment(player, card);

  // Deduct tokens from player and return to bank
  for (const c of GEM_COLORS) {
    const amt = payment.regular[c];
    if (amt > 0) {
      player.tokens[c] -= amt;
      state.bank[c] += amt;
    }
  }
  if (payment.gold > 0) {
    player.tokens.gold -= payment.gold;
    state.bank.gold += payment.gold;
    player.stats.goldUsed += payment.gold;
  }

  // Remove card from reserved or table
  if (validation.isReserved) {
    player.cardsReserved = player.cardsReserved.filter(id => id !== cardId);
  } else {
    for (const t of [1, 2, 3]) {
      for (let s = 0; s < 4; s++) {
        if (state.tableCards[t][s] === cardId) {
          state.tableCards[t][s] = state.decks[t].length > 0 ? state.decks[t].pop() : null;
          break;
        }
      }
    }
  }

  // Add card to purchased and update player stats
  player.cardsPurchased.push(cardId);
  player.bonuses[card.gemBonus] += 1;
  player.prestigePoints += card.prestigePoints;
  player.stats.cardsBought += 1;

  const desc = options.sabotage
    ? `⚔️ SABOTAGED ${options.sabotageTargetName || 'Opponent'}! Snatched Tier ${card.tier} card (${card.gemBonus} bonus, +${card.prestigePoints} pts)`
    : `Purchased Tier ${card.tier} card (${card.gemBonus} bonus, +${card.prestigePoints} pts)`;

  logMove(state, player, 'purchase', desc);

  // Guildmaster's Sovereignty bonus
  if (player.hasGuildmasterSovereignty || (player.powersClaimed && player.powersClaimed.includes('guildmaster_sovereignty'))) {
    const bonusGem = card.gemBonus;
    if (state.bank[bonusGem] > 0) {
      state.bank[bonusGem] -= 1;
      player.tokens[bonusGem] += 1;
      player.stats.tokensGained += 1;
      logMove(state, player, 'power_effect', `👑 Guildmaster's Sovereignty: Received 1 free ${bonusGem} token from the bank!`);
    }
  }

  // Super Powers Passives & Feat Tracking
  if (player.synergyDiscounts > 0) {
    player.synergyDiscounts -= 1;
  }
  if (player.activeCurses?.imperial_tithe?.chargesLeft > 0) {
    player.activeCurses.imperial_tithe.chargesLeft -= 1;
    if (player.activeCurses.imperial_tithe.chargesLeft <= 0) {
      delete player.activeCurses.imperial_tithe;
    }
  }
  if (validation.isReserved) {
    player.reservedPurchasedCount = (player.reservedPurchasedCount || 0) + 1;
  }
  if (payment.gold === 0) {
    player.totalNoGoldPurchases = (player.totalNoGoldPurchases || 0) + 1;
  }
  if (Object.values(payment.regular || {}).some(v => v >= 4)) {
    player.hasSpentFourSameColorSingleBuy = true;
  }

  const totalTokensSpent = Object.values(payment.regular).reduce((a, b) => a + b, 0) + payment.gold;
  if (totalTokensSpent === 0) {
    player.hasBoughtCardWithZeroTokens = true;
    if (card.tier >= 2) {
      player.hasBoughtHighTierWithZeroTokens = true;
    }
  }
  player.maxGoldSpentSingleCard = Math.max(player.maxGoldSpentSingleCard || 0, payment.gold || 0);
  const totalCardCost = Object.values(card.cost).reduce((a, b) => a + b, 0);
  if (card.tier === 2 && totalCardCost >= 6) {
    player.hasBoughtExpensiveTier2 = true;
  }
  if (card.tier === 2 && totalTokensSpent >= 7) {
    player.hasBoughtExpensiveTier2Cash = true;
  }
  if (card.tier === 3 && card.prestigePoints >= 4) {
    player.hasBoughtHeavyTier3 = true;
  }
  if (card.tier === 3 && card.prestigePoints >= 5 && payment.gold === 0) {
    player.hasBoughtFivePointTier3WithZeroGold = true;
  }

  // Frugal Craftsmanship refund
  if (validation.isReserved && player.hasFrugalCraftsmanship) {
    const refundColor = state.bank[card.gemBonus] > 0
      ? card.gemBonus
      : (GEM_COLORS.find(c => state.bank[c] > 0) || null);
    if (refundColor && state.bank[refundColor] > 0) {
      state.bank[refundColor] -= 1;
      player.tokens[refundColor] += 1;
      logMove(state, player, 'power_effect', `🪙 Frugal Craftsmanship refund: +1 ${refundColor} token!`);
    }
  }

  // Gem Faceter Tithe
  if (player.hasGemFaceterTithe && (card.gemBonus === 'ruby' || card.gemBonus === 'onyx')) {
    const avail = GEM_COLORS.filter(c => state.bank[c] > 0);
    if (avail.length > 0) {
      const bonusCol = avail[Math.floor(Math.random() * avail.length)];
      state.bank[bonusCol] -= 1;
      player.tokens[bonusCol] += 1;
      logMove(state, player, 'power_effect', `💎 Gem Faceter Tithe: +1 ${bonusCol} token!`);
    }
  }

  // Sapphire Sight
  if (player.hasSapphireSight && card.tier === 1 && state.bank.sapphire > 0) {
    state.bank.sapphire -= 1;
    player.tokens.sapphire += 1;
    logMove(state, player, 'power_effect', `🔮 Sapphire Sight: +1 Sapphire token!`);
  }

  // Emerald Alchemist
  if (player.hasEmeraldAlchemist && card.gemBonus === 'emerald' && state.bank.gold > 0) {
    const regularColors = GEM_COLORS.filter(c => (player.tokens[c] || 0) > 0);
    if (regularColors.length > 0) {
      const chosen = regularColors[0];
      player.tokens[chosen] -= 1;
      state.bank[chosen] += 1;
      state.bank.gold -= 1;
      player.tokens.gold += 1;
      logMove(state, player, 'power_effect', `🧪 Emerald Alchemist: converted 1 ${chosen} into 1 Gold Joker!`);
    }
  }
  // Gem Monopoly
  const monopolyOwners = state.players.filter(p => p.id !== player.id && p.monopolyColor === card.gemBonus);
  for (const opp of monopolyOwners) {
    opp.prestigePoints += 1;
    logMove(state, opp, 'power_effect', `👑 Gem Monopoly: ${opp.name} gained +1 Prestige Point because ${player.name} bought a ${card.gemBonus} card!`);
    const isPureObjectiveMode = ['onyx_syndicate', 'color_supremacy', 'noble_court', 'rainbow_guild'].includes(state.gameMode);
    const oppTarget = opp.targetPointsOverride || state.targetPoints || 15;
    if (!isPureObjectiveMode && opp.prestigePoints >= oppTarget && state.status === 'in_progress') {
      state.status = 'final_round';
      state.finalRoundTriggeredBy = opp.id;
    }
  }

  checkAllSuperPowerFeats(state);

  // Check Game Mode Win Conditions
  const isPureObjectiveMode = ['onyx_syndicate', 'color_supremacy', 'noble_court', 'rainbow_guild'].includes(state.gameMode);
  const targetPoints = player.targetPointsOverride || state.targetPoints || 15;
  let modeEndTriggered = false;

  if (state.gameMode === 'onyx_syndicate') {
    const onyxCount = player.bonuses.onyx || 0;
    if (onyxCount >= 10 && state.status === 'in_progress') {
      state.status = 'final_round';
      state.finalRoundTriggeredBy = player.id;
      modeEndTriggered = true;
      logMove(
        state,
        player,
        'final_round_triggered',
        `🖤 Collected 10 Onyx (black) development cards! Shadow Syndicate victory initiated.`
      );
    }
  } else if (state.gameMode === 'color_supremacy') {
    // First to 5 cards in a color claims that color's Monopoly Trophy (1 point)
    if (player.bonuses[card.gemBonus] >= 5 && state.colorTrophies && state.colorTrophies[card.gemBonus] === null) {
      state.colorTrophies[card.gemBonus] = player.id;
      player.trophies = (player.trophies || 0) + 1;
      player.claimedColors = player.claimedColors || [];
      player.claimedColors.push(card.gemBonus);
      logMove(
        state,
        player,
        'trophy_claimed',
        `⭐ Claimed the 5-Card ${card.gemBonus.toUpperCase()} Monopoly Trophy! (${player.trophies}/3 Trophies)`
      );

      if (player.trophies >= 3 && state.status === 'in_progress') {
        state.status = 'final_round';
        state.finalRoundTriggeredBy = player.id;
        modeEndTriggered = true;
        logMove(
          state,
          player,
          'final_round_triggered',
          `⭐ Claimed 3 Color Monopoly Trophies! Final round initiated.`
        );
      }
    }
  } else if (state.gameMode === 'rainbow_guild') {
    const isRainbowComplete = GEM_COLORS.every(c => (player.bonuses[c] || 0) >= 3);
    if (isRainbowComplete && state.status === 'in_progress') {
      state.status = 'final_round';
      state.finalRoundTriggeredBy = player.id;
      modeEndTriggered = true;
      logMove(
        state,
        player,
        'final_round_triggered',
        `🌈 Completed the Renaissance Prism with at least 3 cards in all 5 gem colors! Final round initiated.`
      );
    }
  }

  // Standard or fallback prestige point threshold trigger (only in point-based modes!)
  if (!isPureObjectiveMode && !modeEndTriggered && player.prestigePoints >= targetPoints && state.status === 'in_progress') {
    state.status = 'final_round';
    state.finalRoundTriggeredBy = player.id;
    logMove(
      state,
      player,
      'final_round_triggered',
      `Reached ${player.prestigePoints} prestige points (target: ${targetPoints})! Final round initiated.`
    );
  }

  // Check Noble Visits
  checkNobleVisits(state, player);

  return state;
}

/**
 * Check if player has > 10 tokens and set pendingDiscard state
 */
function checkPostActionTokenLimit(state, player) {
  const vaultMax = player.vaultLimit || 10;
  const total = countTokens(player.tokens);
  if (total > vaultMax) {
    state.pendingDiscard = {
      playerId: player.id,
      playerIndex: state.players.indexOf(player),
      excessCount: total - vaultMax
    };
  } else {
    // If no excess tokens, proceed to next turn
    advanceTurn(state);
  }
}

/**
 * Execute token discard
 */
export function validateDiscardTokens(state, playerIndex, discardMap) {
  if (!state.pendingDiscard) {
    return { valid: false, error: 'No pending token discard' };
  }
  if (state.pendingDiscard.playerIndex !== playerIndex) {
    return { valid: false, error: 'Not the player requiring token discard' };
  }

  const player = state.players[playerIndex];
  let discardTotal = 0;

  for (const color of ALL_TOKENS) {
    const count = discardMap[color] || 0;
    if (count < 0) return { valid: false, error: 'Negative discard count' };
    if (count > (player.tokens[color] || 0)) {
      return { valid: false, error: `Cannot discard more ${color} tokens than owned` };
    }
    discardTotal += count;
  }

  if (discardTotal !== state.pendingDiscard.excessCount) {
    return { valid: false, error: `Must discard exactly ${state.pendingDiscard.excessCount} tokens` };
  }

  return { valid: true };
}

export function executeDiscardTokens(state, playerIndex, discardMap) {
  const validation = validateDiscardTokens(state, playerIndex, discardMap);
  if (!validation.valid) throw new Error(validation.error);

  const player = state.players[playerIndex];

  for (const color of ALL_TOKENS) {
    const count = discardMap[color] || 0;
    if (count > 0) {
      player.tokens[color] -= count;
      state.bank[color] += count;
    }
  }

  const discardedStr = Object.entries(discardMap)
    .filter(([_, cnt]) => cnt > 0)
    .map(([col, cnt]) => `${cnt} ${col}`)
    .join(', ');

  logMove(state, player, 'discard', `Discarded excess tokens: [${discardedStr}]`);

  state.pendingDiscard = null;
  checkAllSuperPowerFeats(state);
  advanceTurn(state);
  return state;
}

/**
 * Check for eligible nobles
 */
function checkNobleVisits(state, player) {
  const eligibleNobles = [];

  for (const nobleId of state.nobles) {
    const noble = NOBLES_BY_ID[nobleId];
    let eligible = true;
    for (const color of GEM_COLORS) {
      let req = noble.requirements[color] || 0;
      if (player.hasNobleEnvoy && req > 0) {
        req = Math.max(1, req - 1);
      }
      if ((player.bonuses[color] || 0) < req) {
        eligible = false;
        break;
      }
    }
    if (eligible) {
      eligibleNobles.push(nobleId);
    }
  }

  if (eligibleNobles.length === 1) {
    // Single match: automatic visit
    awardNoble(state, player, eligibleNobles[0]);
    checkAllSuperPowerFeats(state);
    if (state.superPowersEnabled && countTokens(player.tokens) > (player.vaultLimit || 10)) {
      checkPostActionTokenLimit(state, player);
    } else {
      advanceTurn(state);
    }
  } else if (eligibleNobles.length > 1) {
    // Multiple matches: player must select one
    state.pendingNobleChoice = {
      playerId: player.id,
      playerIndex: state.players.indexOf(player),
      nobleIds: eligibleNobles
    };
  } else {
    // No noble eligible: advance turn
    if (state.superPowersEnabled && countTokens(player.tokens) > (player.vaultLimit || 10)) {
      checkPostActionTokenLimit(state, player);
    } else {
      advanceTurn(state);
    }
  }
}

/**
 * Award noble to player
 */
function awardNoble(state, player, nobleId) {
  const noble = NOBLES_BY_ID[nobleId];
  state.nobles = state.nobles.filter(id => id !== nobleId);
  player.noblesAcquired.push(nobleId);
  player.prestigePoints += noble.prestigePoints;
  player.stats.noblesClaimed += 1;

  logMove(state, player, 'noble', `Visits by Noble ${noble.name} (+3 pts)!`);

  // In noble_court mode: recruiting 3 nobles triggers victory
  if (state.gameMode === 'noble_court' && player.noblesAcquired.length >= 3 && state.status === 'in_progress') {
    state.status = 'final_round';
    state.finalRoundTriggeredBy = player.id;
    logMove(
      state,
      player,
      'final_round_triggered',
      `⚜️ Recruited 3 Noble Patrons! Noble Court victory initiated.`
    );
  } else {
    const isPureObjectiveMode = ['onyx_syndicate', 'color_supremacy', 'noble_court', 'rainbow_guild'].includes(state.gameMode);
    const targetPoints = player.targetPointsOverride || state.targetPoints || 15;
    if (!isPureObjectiveMode && player.prestigePoints >= targetPoints && state.status === 'in_progress') {
      state.status = 'final_round';
      state.finalRoundTriggeredBy = player.id;
      logMove(
        state,
        player,
        'final_round_triggered',
        `Reached ${player.prestigePoints} prestige points (target: ${targetPoints})! Final round initiated.`
      );
    }
  }
}

/**
 * Resolve noble choice when multiple eligible
 */
export function executeChooseNoble(state, playerIndex, nobleId) {
  if (!state.pendingNobleChoice) {
    throw new Error('No pending noble choice');
  }
  if (state.pendingNobleChoice.playerIndex !== playerIndex) {
    throw new Error('Not the player selecting noble');
  }
  if (!state.pendingNobleChoice.nobleIds.includes(nobleId)) {
    throw new Error('Selected noble is not among eligible options');
  }

  const player = state.players[playerIndex];
  awardNoble(state, player, nobleId);
  checkAllSuperPowerFeats(state);
  state.pendingNobleChoice = null;
  if (state.superPowersEnabled && countTokens(player.tokens) > (player.vaultLimit || 10)) {
    checkPostActionTokenLimit(state, player);
  } else {
    advanceTurn(state);
  }
  return state;
}

/**
 * Action: Pass turn when no legal actions are available
 */
export function validatePassTurn(state, playerIndex) {
  if (state.activePlayerIndex !== playerIndex) {
    return { valid: false, error: 'Not active player turn' };
  }
  if (state.pendingDiscard || state.pendingNobleChoice || state.pendingPowerDraft) {
    return { valid: false, error: 'Must resolve pending action first' };
  }
  return { valid: true };
}

export function executePassTurn(state, playerIndex) {
  const validation = validatePassTurn(state, playerIndex);
  if (!validation.valid) throw new Error(validation.error);

  const player = state.players[playerIndex];
  logMove(state, player, 'pass', `${player.name} passed turn (no legal actions available).`);
  advanceTurn(state);
  return state;
}

/**
 * Advances the turn to the next player, checks endgame round completion
 */
function advanceTurn(state) {
  // If Chronos Hourglass extra turns are active
  if (state.extraTurnsRemaining > 0) {
    if (state.extraTurnsPlayerId) {
      const targetIdx = state.players.findIndex(p => p.id === state.extraTurnsPlayerId);
      if (targetIdx !== -1 && state.activePlayerIndex !== targetIdx) {
        // If turn finished was an opponent's turn, immediately transfer active turn to the power owner!
        state.activePlayerIndex = targetIdx;
        state.turnIndex += 1;
        state.turnDeadline = state.timeLimitSeconds > 0 ? Date.now() + state.timeLimitSeconds * 1000 : null;
        logMove(
          state,
          state.players[state.activePlayerIndex],
          'extra_turn',
          `⏳ Chronos Hourglass: Turn seized! Taking consecutive turn! (${state.extraTurnsRemaining} extra turns left)`
        );
        return;
      }
    }

    state.extraTurnsRemaining -= 1;
    if (state.extraTurnsRemaining === 0) {
      state.extraTurnsPlayerId = null;
    }
    state.turnIndex += 1;
    state.turnDeadline = state.timeLimitSeconds > 0 ? Date.now() + state.timeLimitSeconds * 1000 : null;
    logMove(
      state,
      state.players[state.activePlayerIndex],
      'extra_turn',
      `⏳ Chronos Hourglass: Taking consecutive turn! (${state.extraTurnsRemaining} extra turns left)`
    );
    return;
  }

  const nextPlayerIndex = (state.activePlayerIndex + 1) % state.players.length;

  // Round completed when turn passes back to starting player
  if (nextPlayerIndex === state.startingPlayerIndex) {
    state.roundIndex += 1;

    // Decrement global market freeze
    if (state.marketFreezeRounds > 0) {
      state.marketFreezeRounds -= 1;
      if (state.marketFreezeRounds === 0) {
        logMove(state, state.players[nextPlayerIndex], 'power_effect', '❄️ Market Freeze has expired! Card purchases from the table are restored.');
      }
    }

    // If final round was triggered, game ends now!
    if (state.status === 'final_round') {
      completeGame(state);
      return;
    }
  }

  // Decrement round-based active curses for the entering player
  const enteringPlayer = state.players[nextPlayerIndex];
  if (enteringPlayer && enteringPlayer.activeCurses) {
    for (const [curseKey, curseObj] of Object.entries(enteringPlayer.activeCurses)) {
      if (curseObj && typeof curseObj.roundsLeft === 'number') {
        curseObj.roundsLeft -= 1;
        if (curseObj.roundsLeft <= 0) {
          delete enteringPlayer.activeCurses[curseKey];
          logMove(state, enteringPlayer, 'power_effect', `✨ Curse Expired: ${curseKey.replace('_', ' ')} has lifted from ${enteringPlayer.name}.`);
        }
      }
    }
  }

  state.activePlayerIndex = nextPlayerIndex;
  state.turnIndex += 1;
  state.turnDeadline = state.timeLimitSeconds > 0 ? Date.now() + state.timeLimitSeconds * 1000 : null;

  // Check Super Powers reveal at Round 6 (for 'feats' rule)
  if (state.superPowersEnabled && state.powersRule === 'feats' && !state.powersRevealed && state.roundIndex >= 6) {
    state.powersRevealed = true;
    logMove(
      state,
      state.players[state.activePlayerIndex],
      'powers_revealed',
      '⚡ The Arcane Seals have shattered! All 7 Super Powers are now revealed and ready to claim!'
    );
    checkAllSuperPowerFeats(state);
  }

  // Check Arcane Draft (Every 4 Rounds: 4, 8, 12, 16, 20, 24)
  if (state.superPowersEnabled && state.powersRule === 'draft_every_4_rounds') {
    checkAndTriggerPowerDraft(state);
  }
}

/**
 * Schedule of Arcane Drafts by Round:
 * Round 4 & 8: Common Boons
 * Round 12 & 16: Rare Relics / Curses
 * Round 20 & 24: Mythic Wonders
 * After Round 24: Powers stop!
 */
export const DRAFT_ROUNDS_TIER = {
  4: 'common',
  8: 'common',
  12: 'rare',
  16: 'rare',
  20: 'mythic',
  24: 'mythic'
};

export function checkAndTriggerPowerDraft(state) {
  if (state.status !== 'in_progress') return;
  const round = state.roundIndex;
  if (!DRAFT_ROUNDS_TIER[round]) return; // Drafts stop after Round 24
  if (state.draftsCompletedRounds && state.draftsCompletedRounds.includes(round)) return;

  state.draftsCompletedRounds = state.draftsCompletedRounds || [];
  state.draftsCompletedRounds.push(round);

  const tier = DRAFT_ROUNDS_TIER[round];
  const draftSchedule = [4, 8, 12, 16, 20, 24];
  const draftNumber = draftSchedule.indexOf(round) + 1;

  // Alternating chooser across draft cycles
  const chooserIndex = (draftNumber - 1) % state.players.length;
  const otherIndex = (chooserIndex + 1) % state.players.length;

  const chooser = state.players[chooserIndex];
  const otherPlayer = state.players[otherIndex];

  // Find unclaimed powers of required tier
  const claimedSet = new Set();
  state.players.forEach(p => (p.powersClaimed || []).forEach(id => claimedSet.add(id)));

  let tierPowers = Object.values(POWERS_DATA).filter(p => p.tier === tier && !claimedSet.has(p.id));
  if (tierPowers.length < 2) {
    tierPowers = Object.values(POWERS_DATA).filter(p => !claimedSet.has(p.id));
  }

  const shuffled = tierPowers.slice().sort(() => 0.5 - Math.random());
  const cardA = shuffled[0];
  const cardB = shuffled[1];

  if (!cardA || !cardB) return;

  state.pendingPowerDraft = {
    round,
    tier,
    tierName: tier === 'common' ? 'Common Boon' : (tier === 'rare' ? 'Rare Artifact' : 'Mythic Wonder'),
    draftNumber,
    choosingPlayerIndex: chooserIndex,
    choosingPlayerId: chooser.id,
    choosingPlayerName: chooser.name,
    otherPlayerIndex: otherIndex,
    otherPlayerId: otherPlayer.id,
    otherPlayerName: otherPlayer.name,
    cards: [cardA.id, cardB.id]
  };

  logMove(
    state,
    chooser,
    'draft_initiated',
    `⚔️ Round ${round} Arcane Draft (${tier.toUpperCase()})! ${chooser.name} must choose 1 power; remaining card will go to ${otherPlayer.name}!`
  );
}

export function executeChooseDraftPower(state, playerIndex, chosenPowerId) {
  if (!state.pendingPowerDraft) {
    throw new Error('No arcane draft is currently pending');
  }
  if (state.pendingPowerDraft.choosingPlayerIndex !== playerIndex) {
    throw new Error('Not your turn to choose in the arcane draft');
  }
  if (!state.pendingPowerDraft.cards.includes(chosenPowerId)) {
    throw new Error(`Invalid card chosen: ${chosenPowerId}`);
  }

  const { cards, choosingPlayerIndex, otherPlayerIndex } = state.pendingPowerDraft;
  const chosenId = chosenPowerId;
  const remainingId = cards.find(id => id !== chosenId);

  const chooser = state.players[choosingPlayerIndex];
  const otherPlayer = state.players[otherPlayerIndex];

  // 1. Chooser claims chosen card
  chooser.powersClaimed = chooser.powersClaimed || [];
  chooser.powersClaimed.push(chosenId);
  const defChosen = POWERS_DATA[chosenId];
  if (defChosen.type === 'passive') {
    applySuperPowerPassive(state, choosingPlayerIndex, chosenId);
  } else if (defChosen.type === 'instant') {
    executeSuperPowerInstant(state, choosingPlayerIndex, chosenId);
  }

  // 2. Other player receives remaining card
  otherPlayer.powersClaimed = otherPlayer.powersClaimed || [];
  otherPlayer.powersClaimed.push(remainingId);
  const defRemaining = POWERS_DATA[remainingId];
  if (defRemaining.type === 'passive') {
    applySuperPowerPassive(state, otherPlayerIndex, remainingId);
  } else if (defRemaining.type === 'instant') {
    executeSuperPowerInstant(state, otherPlayerIndex, remainingId);
  }

  // Sequential celebration events for Three.js 3D flight & modal
  state.unlockedPowerEvents = state.unlockedPowerEvents || [];
  state.unlockedPowerEvents.push({
    powerId: chosenId,
    playerId: chooser.id,
    playerIndex: choosingPlayerIndex,
    playerName: chooser.name,
    timestamp: Date.now()
  });
  state.unlockedPowerEvents.push({
    powerId: remainingId,
    playerId: otherPlayer.id,
    playerIndex: otherPlayerIndex,
    playerName: otherPlayer.name,
    timestamp: Date.now() + 50
  });

  logMove(
    state,
    chooser,
    'draft_resolved',
    `⚔️ Arcane Draft Complete: ${chooser.name} drafted ${defChosen.name} (${defChosen.icon})! ${otherPlayer.name} received ${defRemaining.name} (${defRemaining.icon})!`
  );

  state.pendingPowerDraft = null;
  return state;
}

/**
 * Completes the game, computes rankings according to tiebreaker rules
 */
function completeGame(state) {
  state.status = 'completed';

  // Compute rankings based on active Game Mode
  const scoredPlayers = state.players.map(p => {
    const onyxCount = p.bonuses.onyx || 0;
    const trophies = p.trophies || 0;
    const noblesCount = p.noblesAcquired.length;
    const rainbowComplete = GEM_COLORS.every(c => (p.bonuses[c] || 0) >= 3);
    const colorsCompleted = GEM_COLORS.filter(c => (p.bonuses[c] || 0) >= 3).length;

    return {
      playerId: p.id,
      name: p.name,
      isAi: p.isAi,
      points: p.prestigePoints,
      cardsCount: p.cardsPurchased.length,
      tokensCount: countTokens(p.tokens),
      noblesCount,
      onyxCount,
      trophies,
      rainbowComplete,
      colorsCompleted,
      player: p
    };
  });

  scoredPlayers.sort((a, b) => {
    if (state.gameMode === 'onyx_syndicate') {
      const aOnyxWin = a.onyxCount >= 10 ? 1 : 0;
      const bOnyxWin = b.onyxCount >= 10 ? 1 : 0;
      if (bOnyxWin !== aOnyxWin) return bOnyxWin - aOnyxWin;
      if (b.onyxCount !== a.onyxCount) return b.onyxCount - a.onyxCount;
      if (b.points !== a.points) return b.points - a.points;
      if (a.cardsCount !== b.cardsCount) return a.cardsCount - b.cardsCount;
      return b.tokensCount - a.tokensCount;
    }

    if (state.gameMode === 'color_supremacy') {
      const aTrophyWin = a.trophies >= 3 ? 1 : 0;
      const bTrophyWin = b.trophies >= 3 ? 1 : 0;
      if (bTrophyWin !== aTrophyWin) return bTrophyWin - aTrophyWin;
      if (b.trophies !== a.trophies) return b.trophies - a.trophies;
      if (b.points !== a.points) return b.points - a.points;
      if (a.cardsCount !== b.cardsCount) return a.cardsCount - b.cardsCount;
      return b.tokensCount - a.tokensCount;
    }

    if (state.gameMode === 'noble_court') {
      const aNobleWin = a.noblesCount >= 3 ? 1 : 0;
      const bNobleWin = b.noblesCount >= 3 ? 1 : 0;
      if (bNobleWin !== aNobleWin) return bNobleWin - aNobleWin;
      if (b.noblesCount !== a.noblesCount) return b.noblesCount - a.noblesCount;
      if (b.points !== a.points) return b.points - a.points;
      if (a.cardsCount !== b.cardsCount) return a.cardsCount - b.cardsCount;
      return b.tokensCount - a.tokensCount;
    }

    if (state.gameMode === 'rainbow_guild') {
      const aRainbow = a.rainbowComplete ? 1 : 0;
      const bRainbow = b.rainbowComplete ? 1 : 0;
      if (bRainbow !== aRainbow) return bRainbow - aRainbow;
      if (b.colorsCompleted !== a.colorsCompleted) return b.colorsCompleted - a.colorsCompleted;
      if (b.points !== a.points) return b.points - a.points;
      if (a.cardsCount !== b.cardsCount) return a.cardsCount - b.cardsCount;
      return b.tokensCount - a.tokensCount;
    }

    // Default (Classic / Tier Ladder):
    // 1. Highest prestige points
    // 2. Fewest cards purchased
    // 3. Most tokens remaining
    if (b.points !== a.points) return b.points - a.points;
    if (a.cardsCount !== b.cardsCount) return a.cardsCount - b.cardsCount;
    if (b.tokensCount !== a.tokensCount) return b.tokensCount - a.tokensCount;
    return 0;
  });

  // Assign ranks
  let currentRank = 1;
  for (let i = 0; i < scoredPlayers.length; i++) {
    if (i > 0) {
      const prev = scoredPlayers[i - 1];
      const curr = scoredPlayers[i];
      if (
        curr.points === prev.points &&
        curr.cardsCount === prev.cardsCount &&
        curr.tokensCount === prev.tokensCount
      ) {
        curr.rank = prev.rank;
      } else {
        curr.rank = i + 1;
      }
    } else {
      scoredPlayers[0].rank = 1;
    }
  }

  state.rankings = scoredPlayers;
  state.winnerId = scoredPlayers[0].playerId;
  state.winner = scoredPlayers[0];

  let winReason = `${scoredPlayers[0].points} prestige points`;
  if (state.gameMode === 'onyx_syndicate' && scoredPlayers[0].onyxCount >= 10) {
    winReason = `${scoredPlayers[0].onyxCount} Onyx cards (Shadow Syndicate Master)`;
  } else if (state.gameMode === 'color_supremacy' && scoredPlayers[0].trophies >= 3) {
    winReason = `${scoredPlayers[0].trophies} Color Monopoly Trophies`;
  } else if (state.gameMode === 'noble_court' && scoredPlayers[0].noblesCount >= 3) {
    winReason = `${scoredPlayers[0].noblesCount} Noble Patrons`;
  } else if (state.gameMode === 'rainbow_guild' && scoredPlayers[0].rainbowComplete) {
    winReason = `Renaissance Prism Mastery (3+ cards in all 5 colors)`;
  }

  logMove(
    state,
    scoredPlayers[0].player,
    'game_over',
    `Game Over! Winner: ${scoredPlayers[0].name} with ${winReason}!`
  );
}

/**
 * Append move to log
 */
function logMove(state, player, actionType, description) {
  state.moveLog.push({
    turn: state.turnIndex,
    playerId: player.id,
    playerName: player.name,
    actionType,
    description,
    timestamp: Date.now()
  });
}

/**
 * Applies passive effects when a player claims a passive super power
 */
export function applySuperPowerPassive(state, playerIndex, powerId) {
  const player = state.players[playerIndex];
  if (!player) return;

  switch (powerId) {
    case 'midas_crucible':
      player.goldPerReserve = 2;
      break;
    case 'endless_vault':
      player.vaultLimit = 14;
      break;
    case 'silk_road_caravan':
      player.hasSilkRoadCaravan = true;
      break;
    case 'shadow_siphon':
      player.hasShadowSiphon = true;
      break;
    case 'smugglers_warehouse':
      player.reserveLimit = 4;
      break;
    case 'prismatic_harmony':
      player.hasPrismaticHarmony = true;
      break;
    case 'noble_envoy':
      player.hasNobleEnvoy = true;
      break;
    case 'vault_lockdown': {
      const opponents = state.players.filter(p => p.id !== player.id);
      for (const opp of opponents) {
        opp.vaultLimit = 7;
        const oppTotal = countTokens(opp.tokens);
        if (oppTotal > 7) {
          let excess = oppTotal - 7;
          for (const c of ALL_TOKENS) {
            if (excess <= 0) break;
            const take = Math.min(opp.tokens[c] || 0, excess);
            if (take > 0) {
              opp.tokens[c] -= take;
              state.bank[c] += take;
              excess -= take;
            }
          }
          logMove(state, opp, 'power_effect', `⛓️ Vault Lockdown: ${opp.name}'s vault slashed to 7 tokens! Discarded excess.`);
        }
      }
      break;
    }
    case 'black_market_master':
      player.hasBlackMarket = true;
      break;
    case 'celestial_alignment':
      player.hasCelestialAlignment = true;
      break;
    case 'guildmaster_sovereignty':
      player.hasGuildmasterSovereignty = true;
      break;
  }
}

/**
 * Executes instant effects when a player claims an instant super power
 */
export function executeSuperPowerInstant(state, playerIndex, powerId) {
  const player = state.players[playerIndex];
  if (!player) return;
  const opponents = state.players.filter(p => p.id !== player.id);
  const leadingOpp = opponents.slice().sort((a, b) => b.prestigePoints - a.prestigePoints)[0];
  const wealthiestOpp = opponents.slice().sort((a, b) => countTokens(b.tokens) - countTokens(a.tokens))[0];
  const isPureObjectiveMode = ['onyx_syndicate', 'color_supremacy', 'noble_court', 'rainbow_guild'].includes(state.gameMode);

  switch (powerId) {
    case 'merchants_resurgence': {
      let gained = 0;
      while (gained < 3) {
        const sortedBank = GEM_COLORS.filter(c => state.bank[c] > 0).sort((a, b) => state.bank[b] - state.bank[a]);
        if (sortedBank.length === 0) break;
        const col = sortedBank[0];
        state.bank[col] -= 1;
        player.tokens[col] += 1;
        gained += 1;
      }
      logMove(state, player, 'power_effect', `💰 Merchant's Resurgence: Gained ${gained} tokens from bank!`);
      break;
    }
    case 'guild_embargo': {
      const opp = leadingOpp;
      if (opp) {
        const sortedOppColors = [...GEM_COLORS].sort((a, b) => (opp.bonuses[b] || 0) - (opp.bonuses[a] || 0));
        const blockedColor = sortedOppColors[0] || 'diamond';
        opp.activeCurses = opp.activeCurses || {};
        opp.activeCurses.guild_embargo = {
          color: blockedColor,
          blockedColor: blockedColor,
          roundsLeft: 5
        };
        logMove(state, player, 'power_effect', `🚫 Guild Embargo: ${opp.name} cannot use ${blockedColor} discounts for 5 rounds!`);
      }
      break;
    }
    case 'sovereign_sanction': {
      const opp = leadingOpp;
      if (opp) {
        opp.activeCurses = opp.activeCurses || {};
        opp.activeCurses.sovereign_sanction = {
          roundsLeft: 5
        };
        logMove(state, player, 'power_effect', `🛡️ Sovereign Sanctions: ${opp.name} cannot purchase Tier 3 cards for 5 rounds!`);
      }
      break;
    }
    case 'coinage_mandate': {
      const opp = leadingOpp;
      if (opp) {
        opp.activeCurses = opp.activeCurses || {};
        opp.activeCurses.coinage_mandate = {
          roundsLeft: 3
        };
        logMove(state, player, 'power_effect', `🪙 Coinage Mandate: ${opp.name} cannot use card bonuses for 3 rounds!`);
      }
      break;
    }
    case 'imperial_tithe': {
      const opp = leadingOpp;
      if (opp) {
        opp.activeCurses = opp.activeCurses || {};
        opp.activeCurses.imperial_tithe = {
          charges: 3,
          chargesLeft: 3,
          surcharge: 3
        };
        logMove(state, player, 'power_effect', `⚖️ Imperial Tithe: ${opp.name} must pay +3 tokens surcharge on next 3 buys!`);
      }
      break;
    }
    case 'espionage_heist': {
      const oppWithReserved = opponents.slice().filter(p => p.cardsReserved.length > 0)
        .sort((a, b) => b.prestigePoints - a.prestigePoints || b.cardsReserved.length - a.cardsReserved.length)[0];
      if (oppWithReserved && oppWithReserved.cardsReserved.length > 0) {
        const stolenCardId = oppWithReserved.cardsReserved.pop();
        player.cardsReserved.push(stolenCardId);
        player.totalReservedCount = (player.totalReservedCount || 0) + 1;
        const card = CARDS_BY_ID[stolenCardId];
        logMove(state, player, 'power_effect', `🗝️ Espionage Heist: Stole reserved Tier ${card ? card.tier : ''} card from ${oppWithReserved.name}!`);
      }
      break;
    }
    case 'market_freeze': {
      state.marketFreezeRounds = 3;
      logMove(state, player, 'power_effect', `❄️ Market Freeze: Table cards frozen for 3 rounds! Only reserved cards can be bought!`);
      break;
    }
    case 'aristocrats_heist': {
      if (state.nobles.length > 0) {
        const stolenNobleId = state.nobles.shift();
        const noble = NOBLES_BY_ID[stolenNobleId];
        player.noblesAcquired.push(stolenNobleId);
        player.prestigePoints += noble.prestigePoints;
        player.stats.noblesClaimed += 1;
        logMove(state, player, 'power_effect', `🎭 Aristocrat's Heist recruited Noble ${noble.name} (+3 pts)!`);
        if (state.gameMode === 'noble_court' && player.noblesAcquired.length >= 3 && state.status === 'in_progress') {
          state.status = 'final_round';
          state.finalRoundTriggeredBy = player.id;
        } else if (!isPureObjectiveMode && player.prestigePoints >= (player.targetPointsOverride || state.targetPoints || 15) && state.status === 'in_progress') {
          state.status = 'final_round';
          state.finalRoundTriggeredBy = player.id;
        }
      }
      break;
    }
    case 'chronos_hourglass': {
      state.extraTurnsPlayerId = player.id;
      state.extraTurnsRemaining = 2; // Current turn finishes, then 2 extra = 3 consecutive turns!
      logMove(state, player, 'power_effect', '⏳ Chronos Hourglass activated! 3 consecutive turns granted!');
      break;
    }
    case 'grand_inquisitor': {
      const opp = leadingOpp;
      if (opp) {
        const drained = Math.min(5, opp.prestigePoints);
        opp.prestigePoints -= drained;
        player.prestigePoints += 2;
        logMove(state, player, 'power_effect', `⚡ Grand Inquisitor: Drained ${drained} points from ${opp.name}, player gained +2 points!`);
        if (!isPureObjectiveMode && player.prestigePoints >= (player.targetPointsOverride || state.targetPoints || 15) && state.status === 'in_progress') {
          state.status = 'final_round';
          state.finalRoundTriggeredBy = player.id;
        }
      }
      break;
    }
    case 'philosophers_magnum_opus': {
      player.tokens.gold = Math.max(0, (player.tokens.gold || 0) - 5);
      state.bank.gold += 5;
      player.wildBonuses = (player.wildBonuses || 0) + 5;
      logMove(state, player, 'power_effect', '☀️ Philosopher\'s Magnum Opus: 5 Gold Jokers converted into 5 permanent wildcard discounts!');
      break;
    }
    case 'royal_usurpation': {
      const oppWithNobles = opponents.slice().filter(p => p.noblesAcquired.length > 0)
        .sort((a, b) => b.prestigePoints - a.prestigePoints || b.noblesAcquired.length - a.noblesAcquired.length)[0];
      const opp = oppWithNobles || leadingOpp;
      if (opp && opp.noblesAcquired.length > 0) {
        const stolenId = opp.noblesAcquired.pop();
        const noble = NOBLES_BY_ID[stolenId];
        opp.prestigePoints = Math.max(0, opp.prestigePoints - noble.prestigePoints);
        player.noblesAcquired.push(stolenId);
        player.prestigePoints += noble.prestigePoints;
        player.stats.noblesClaimed += 1;
        logMove(state, player, 'power_effect', `🏰 Royal Usurpation: Stole Noble ${noble.name} from ${opp.name} (+3 pts to you, -3 pts to opponent)!`);
        if (state.gameMode === 'noble_court' && player.noblesAcquired.length >= 3 && state.status === 'in_progress') {
          state.status = 'final_round';
          state.finalRoundTriggeredBy = player.id;
        } else if (!isPureObjectiveMode && player.prestigePoints >= (player.targetPointsOverride || state.targetPoints || 15) && state.status === 'in_progress') {
          state.status = 'final_round';
          state.finalRoundTriggeredBy = player.id;
        }
      }
      break;
    }
    case 'market_cataclysm': {
      const discardedT3 = [...state.tableCards[3]].filter(id => id !== null);
      for (const t of [1, 2, 3]) {
        for (let s = 0; s < 4; s++) {
          state.tableCards[t][s] = state.decks[t].length > 0 ? state.decks[t].pop() : null;
        }
      }
      let freeCardId = null;
      const t3Slot = state.tableCards[3].findIndex(id => id !== null);
      if (t3Slot !== -1) {
        freeCardId = state.tableCards[3][t3Slot];
        state.tableCards[3][t3Slot] = state.decks[3].length > 0 ? state.decks[3].pop() : null;
      } else if (discardedT3.length > 0) {
        freeCardId = discardedT3[0];
      }
      if (freeCardId) {
        const card = CARDS_BY_ID[freeCardId];
        if (card) {
          player.cardsPurchased.push(freeCardId);
          player.bonuses[card.gemBonus] += 1;
          player.prestigePoints += card.prestigePoints;
          player.stats.cardsBought += 1;
          logMove(state, player, 'power_effect', `☄️ Market Cataclysm refreshed market! Awarded Tier 3 card (${card.gemBonus} bonus, +${card.prestigePoints} pts) for FREE!`);
          if (!isPureObjectiveMode && player.prestigePoints >= (player.targetPointsOverride || state.targetPoints || 15) && state.status === 'in_progress') {
            state.status = 'final_round';
            state.finalRoundTriggeredBy = player.id;
          }
        }
      }
      break;
    }
    case 'bankrupting_curse': {
      const opp = wealthiestOpp || leadingOpp;
      if (opp) {
        for (const c of ALL_TOKENS) {
          state.bank[c] += (opp.tokens[c] || 0);
          opp.tokens[c] = 0;
        }
        logMove(state, player, 'power_effect', `💀 Bankrupting Curse: Seized all tokens from ${opp.name} back to the bank!`);
      }
      break;
    }
  }
}

/**
 * Check and claim super power feats for a specific player
 */
export function checkSuperPowerFeats(state, playerIndex) {
  if (!state.superPowersEnabled || !state.powersRevealed) return;
  const player = state.players[playerIndex];
  if (!player || !state.availablePowers) return;

  for (const powerState of state.availablePowers) {
    if (powerState.claimedBy !== null) continue;
    const powerDef = POWERS_DATA[powerState.id];
    if (!powerDef) continue;

    if (powerDef.checkFeat(state, player)) {
      powerState.claimedBy = player.id;
      player.powersClaimed = player.powersClaimed || [];
      player.powersClaimed.push(powerState.id);
      state.unlockedPowerEvents = state.unlockedPowerEvents || [];
      state.unlockedPowerEvents.push({
        powerId: powerState.id,
        playerId: player.id,
        playerIndex,
        playerName: player.name,
        timestamp: Date.now()
      });

      logMove(
        state,
        player,
        'power_unlocked',
        `⚡ UNLOCKED ${powerState.name} (${powerDef.tierName})! ${powerDef.shortDesc}`
      );

      if (powerDef.type === 'instant') {
        executeSuperPowerInstant(state, playerIndex, powerState.id);
      } else {
        applySuperPowerPassive(state, playerIndex, powerState.id);
      }
    }
  }
}

/**
 * Check and claim super power feats across all players (iterative cascade)
 */
export function checkAllSuperPowerFeats(state) {
  if (!state.superPowersEnabled || !state.powersRevealed) return;

  // Iteratively resolve any cascading claims across players
  let previousUnclaimed = -1;
  while (true) {
    const currentUnclaimed = (state.availablePowers || []).filter(p => p.claimedBy === null).length;
    if (currentUnclaimed === 0 || currentUnclaimed === previousUnclaimed) break;
    previousUnclaimed = currentUnclaimed;

    // Active player gets first priority
    checkSuperPowerFeats(state, state.activePlayerIndex);
    for (let i = 0; i < state.players.length; i++) {
      if (i !== state.activePlayerIndex) {
        checkSuperPowerFeats(state, i);
      }
    }
  }
}

export { POWERS_DATA, drawMatchSuperPowers };
