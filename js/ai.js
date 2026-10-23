/**
 * Splendor AI Opponent Engine - 3 Difficulty Tiers
 * - Apprentice (Easy): Greedy 1-ply evaluation
 * - Merchant (Medium): Target-driven heuristic engine builder
 * - Master Guildmaster (Hard): Tempo calculation, hate-drafting, Gold optimization
 */

import { GEM_COLORS, CARDS_BY_ID, NOBLES_BY_ID } from './cards-data.js';
import {
  canAffordCard,
  canPlayerBuyCard,
  getEffectiveCardCost,
  validateTakeDistinctTokens,
  validateTakePairTokens,
  validateReserveCard,
  validatePurchaseCard,
  executeTakeDistinctTokens,
  executeTakePairTokens,
  executeReserveCard,
  executePurchaseCard,
  executeDiscardTokens,
  executeChooseNoble,
  executePassTurn,
  countTokens
} from './engine.js';


/**
 * Compute the next move for an AI player
 */
export function computeAiMove(state, playerIndex) {
  const player = state.players[playerIndex];
  const difficulty = player.aiDifficulty || 'merchant';

  switch (difficulty) {
    case 'apprentice':
      return computeApprenticeMove(state, playerIndex);
    case 'master':
      return computeMasterMove(state, playerIndex);
    case 'grandmaster':
      return computeGrandmasterMove(state, playerIndex);
    case 'merchant':
    default:
      return computeMerchantMove(state, playerIndex);
  }
}

/**
 * AI Discard Decision: Discard tokens least useful for targets
 */
export function computeAiDiscard(state, playerIndex, excessCount) {
  const player = state.players[playerIndex];
  const discardMap = { diamond: 0, sapphire: 0, emerald: 0, ruby: 0, onyx: 0, gold: 0 };
  let remainingToDiscard = excessCount;

  // Prioritize keeping gold (never discard gold unless forced)
  // For grandmaster & master: determine needed colors for targets and preserve them
  let neededColors = [];
  if (player.aiDifficulty === 'grandmaster' || player.aiDifficulty === 'master') {
    const visibleCards = getAllVisibleCardIds(state, player);
    const bestTarget = pickBestTargetCard(state, player, visibleCards);
    if (bestTarget) {
      neededColors = getNeededColorsForCard(player, bestTarget);
    }
  }

  // Discard order: unneeded colors first, then highest count
  const colorsByCount = GEM_COLORS.slice().sort((a, b) => {
    const aNeeded = neededColors.includes(a) ? 1 : 0;
    const bNeeded = neededColors.includes(b) ? 1 : 0;
    if (aNeeded !== bNeeded) return aNeeded - bNeeded;
    return (player.tokens[b] || 0) - (player.tokens[a] || 0);
  });

  while (remainingToDiscard > 0) {
    let discardedInRound = false;
    for (const color of colorsByCount) {
      if (player.tokens[color] - (discardMap[color] || 0) > 0) {
        discardMap[color] += 1;
        remainingToDiscard -= 1;
        discardedInRound = true;
        if (remainingToDiscard === 0) break;
      }
    }
    // If only gold left, discard gold
    if (!discardedInRound && player.tokens.gold - (discardMap.gold || 0) > 0) {
      discardMap.gold += 1;
      remainingToDiscard -= 1;
    }
  }

  return discardMap;
}

/**
 * AI Noble Choice: Select noble providing easiest synergy or denying opponents
 */
export function computeAiNobleChoice(state, playerIndex, nobleIds) {
  if (nobleIds.length <= 1) return nobleIds[0];
  const player = state.players[playerIndex];
  if (player.aiDifficulty === 'grandmaster') {
    const opponents = state.players.filter((_, idx) => idx !== playerIndex);
    let bestNoble = nobleIds[0];
    let maxThreat = -1;
    for (const nId of nobleIds) {
      const noble = NOBLES_BY_ID[nId];
      if (!noble) continue;
      let threat = 0;
      for (const opp of opponents) {
        let missing = 0;
        for (const c of GEM_COLORS) {
          const req = noble.requirements[c] || 0;
          const have = opp.bonuses[c] || 0;
          if (have < req) missing += (req - have);
        }
        if (missing <= 2) threat += (10 - missing);
      }
      if (threat > maxThreat) {
        maxThreat = threat;
        bestNoble = nId;
      }
    }
    return bestNoble;
  }
  return nobleIds[0];
}

// -------------------------------------------------------------
// TIER 1: APPRENTICE (EASY)
// -------------------------------------------------------------
function computeApprenticeMove(state, playerIndex) {
  const player = state.players[playerIndex];
  const legalPurchases = getLegalPurchases(state, playerIndex);
  const tokenCount = countTokens(player.tokens);
  const vaultLimit = player.vaultLimit || 10;
  const reserveLimit = player.reserveLimit || 3;

  // If at or near token limit and can buy, always buy!
  if (tokenCount >= vaultLimit - 1 && legalPurchases.length > 0) {
    return { type: 'purchase', cardId: legalPurchases[0] };
  }

  // 1. If can buy any card, 75% chance to buy it immediately (preferring affordable tier 1)
  if (legalPurchases.length > 0 && Math.random() < 0.75) {
    legalPurchases.sort((a, b) => CARDS_BY_ID[a].tier - CARDS_BY_ID[b].tier);
    return { type: 'purchase', cardId: legalPurchases[0] };
  }

  // 2. Take 2 of same color if valid (only if below token limit)
  if (tokenCount <= vaultLimit - 2 || (player.cardsReserved.length >= reserveLimit && legalPurchases.length === 0)) {
    for (const color of shuffleArray([...GEM_COLORS])) {
      if (validateTakePairTokens(state, playerIndex, color).valid) {
        if (Math.random() < 0.4) {
          return { type: 'take_pair', color };
        }
      }
    }
  }

  // 3. Take distinct tokens if below limit (only if 3 tokens won't exceed vaultLimit or to unblock)
  if (tokenCount <= vaultLimit - 1 || (player.cardsReserved.length >= reserveLimit && legalPurchases.length === 0)) {
    const distinctMove = getAvailableDistinctMove(state, playerIndex);
    if (distinctMove) {
      return distinctMove;
    }
  }

  // 4. Fallback: buy anything legal
  if (legalPurchases.length > 0) {
    return { type: 'purchase', cardId: legalPurchases[0] };
  }

  // 5. Fallback: reserve a random card if possible
  const reserveMove = getRandomReserveMove(state, playerIndex);
  if (reserveMove) return reserveMove;

  // 6. Only take tokens as final fallback
  if (tokenCount <= vaultLimit - 1 || (player.cardsReserved.length >= reserveLimit && legalPurchases.length === 0)) {
    const fallbackTokens = getAvailableDistinctMove(state, playerIndex);
    if (fallbackTokens) return fallbackTokens;
  }

  return { type: 'pass' };
}

// -------------------------------------------------------------
// TIER 2: MERCHANT (MEDIUM) - HEURISTIC ENGINE BUILDER
// -------------------------------------------------------------
function computeMerchantMove(state, playerIndex) {
  const player = state.players[playerIndex];
  const tableCardIds = getAllVisibleCardIds(state, player);
  const targetCard = pickBestTargetCard(state, player, tableCardIds);
  const legalPurchases = getLegalPurchases(state, playerIndex);
  const tokenCount = countTokens(player.tokens);
  const vaultLimit = player.vaultLimit || 10;
  const reserveLimit = player.reserveLimit || 3;

  // 1. If we can buy our target card, buy it!
  if (targetCard && legalPurchases.includes(targetCard.id)) {
    return { type: 'purchase', cardId: targetCard.id };
  }

  // 2. If we can buy any card giving >= 2 prestige points, buy it
  const highPointPurchases = legalPurchases.filter(id => CARDS_BY_ID[id].prestigePoints >= 2);
  if (highPointPurchases.length > 0) {
    highPointPurchases.sort((a, b) => CARDS_BY_ID[b].prestigePoints - CARDS_BY_ID[a].prestigePoints);
    return { type: 'purchase', cardId: highPointPurchases[0] };
  }

  // 3. If we can buy any card that advances us towards an available noble, buy it
  for (const cardId of legalPurchases) {
    const card = CARDS_BY_ID[cardId];
    if (advancesNoble(state, player, card.gemBonus)) {
      return { type: 'purchase', cardId };
    }
  }

  // 4. CRITICAL: If player holds >= vaultLimit - 1 tokens and has ANY legal purchase, buy to expand engine and avoid discard waste
  if (tokenCount >= vaultLimit - 1 && legalPurchases.length > 0) {
    legalPurchases.sort((a, b) => {
      const cardA = CARDS_BY_ID[a];
      const cardB = CARDS_BY_ID[b];
      return cardB.prestigePoints - cardA.prestigePoints || cardB.tier - cardA.tier;
    });
    return { type: 'purchase', cardId: legalPurchases[0] };
  }

  // 5. If we have a target card and have token room, collect tokens needed for it
  if (targetCard) {
    const neededColors = getNeededColorsForCard(player, targetCard);

    // If we need 2 of the same color and have room (<= vaultLimit - 2), take 2
    if (tokenCount <= vaultLimit - 2 || (player.cardsReserved.length >= reserveLimit && legalPurchases.length === 0)) {
      for (const color of neededColors) {
        if (validateTakePairTokens(state, playerIndex, color).valid) {
          return { type: 'take_pair', color };
        }
      }
    }

    // Otherwise take 3 distinct needed tokens (only if below limit <= vaultLimit - 1 or to unblock)
    if (tokenCount <= vaultLimit - 1 || (player.cardsReserved.length >= reserveLimit && legalPurchases.length === 0)) {
      const smartDistinct = getSmartDistinctTokens(state, playerIndex, neededColors);
      if (smartDistinct) return smartDistinct;
    }
  }

  // 6. Consider reserving target card if it's Tier 2 or 3 and we have room
  if (
    targetCard &&
    targetCard.tier >= 2 &&
    player.cardsReserved.length < reserveLimit &&
    validateReserveCard(state, playerIndex, { cardId: targetCard.id }).valid
  ) {
    return { type: 'reserve', cardId: targetCard.id };
  }

  // 7. Any legal purchase (engine building)
  if (legalPurchases.length > 0) {
    return { type: 'purchase', cardId: legalPurchases[0] };
  }

  // 8. If at token limit (>= vaultLimit) and cannot buy, prioritize reserving to get gold and refresh cards!
  if (tokenCount >= vaultLimit && player.cardsReserved.length < reserveLimit) {
    const reserveMove = getRandomReserveMove(state, playerIndex);
    if (reserveMove) return reserveMove;
  }

  // 9. Fallback: take tokens if below limit or to unblock
  if (tokenCount <= vaultLimit - 1 || (player.cardsReserved.length >= reserveLimit && legalPurchases.length === 0)) {
    const fallbackTokens = getAvailableDistinctMove(state, playerIndex);
    if (fallbackTokens) return fallbackTokens;
  }

  return getRandomReserveMove(state, playerIndex) || { type: 'pass' };
}

// -------------------------------------------------------------
// TIER 3: MASTER GUILDMASTER (HARD) - TEMPO & HATE-DRAFTING
// -------------------------------------------------------------
function computeMasterMove(state, playerIndex) {
  const player = state.players[playerIndex];
  const legalPurchases = getLegalPurchases(state, playerIndex);
  const tokenCount = countTokens(player.tokens);
  const targetPoints = player.targetPointsOverride || state.targetPoints || 15;
  const vaultLimit = player.vaultLimit || 10;
  const reserveLimit = player.reserveLimit || 3;

  // 1. ENDGAME WINNING MOVE: If any purchase pushes player to >= targetPoints, do it immediately!
  for (const cardId of legalPurchases) {
    const card = CARDS_BY_ID[cardId];
    if (player.prestigePoints + card.prestigePoints >= targetPoints) {
      return { type: 'purchase', cardId };
    }
  }

  // 2. CRITICAL: If player holds >= vaultLimit - 1 tokens and has legal purchase, buy to expand engine & prevent discard waste
  if (tokenCount >= vaultLimit - 1 && legalPurchases.length > 0) {
    legalPurchases.sort((a, b) => {
      const cardA = CARDS_BY_ID[a];
      const cardB = CARDS_BY_ID[b];
      return cardB.prestigePoints - cardA.prestigePoints || cardB.tier - cardA.tier;
    });
    return { type: 'purchase', cardId: legalPurchases[0] };
  }

  // 3. HATE-DRAFTING / CARD DENIAL:
  const leadingOpponent = state.players
    .filter((_, idx) => idx !== playerIndex)
    .sort((a, b) => b.prestigePoints - a.prestigePoints)[0];

  if (leadingOpponent && leadingOpponent.prestigePoints >= 10 && player.cardsReserved.length < reserveLimit) {
    for (const tier of [3, 2]) {
      for (const cardId of state.tableCards[tier]) {
        if (!cardId) continue;
        const card = CARDS_BY_ID[cardId];
        if (card.prestigePoints >= 3) {
          const turnsAway = turnsToAfford(leadingOpponent, card);
          if (turnsAway <= 1 && validateReserveCard(state, playerIndex, { cardId }).valid) {
            return { type: 'reserve', cardId };
          }
        }
      }
    }
  }

  // 4. BEST VALUE PURCHASE: Evaluate all legal purchases by Tempo Score
  if (legalPurchases.length > 0) {
    let bestPurchaseId = null;
    let highestScore = -Infinity;

    for (const cardId of legalPurchases) {
      const card = CARDS_BY_ID[cardId];
      let score = card.prestigePoints * 10;
      if (advancesNoble(state, player, card.gemBonus)) score += 8;
      const payment = getCostInTokens(player, card);
      score += (10 - payment);

      if (score > highestScore) {
        highestScore = score;
        bestPurchaseId = cardId;
      }
    }

    if (bestPurchaseId && (highestScore >= 12 || tokenCount >= vaultLimit - 2)) {
      return { type: 'purchase', cardId: bestPurchaseId };
    }
  }

  // 5. TARGET SELECTION WITH TEMPO EVALUATION
  const allVisible = getAllVisibleCardIds(state, player);
  const evaluatedTargets = allVisible.map(cardId => {
    const card = CARDS_BY_ID[cardId];
    const turns = turnsToAfford(player, card);
    const nobleBonus = advancesNoble(state, player, card.gemBonus) ? 3 : 0;
    const value = card.prestigePoints * 3 + nobleBonus + (4 - card.tier);
    const tempo = value / Math.max(1, turns);
    return { card, turns, tempo };
  });

  evaluatedTargets.sort((a, b) => b.tempo - a.tempo);
  const bestTarget = evaluatedTargets[0]?.card;

  if (bestTarget) {
    const needed = getNeededColorsForCard(player, bestTarget);

    // If opponent might steal our best target and it's valuable, reserve it
    if (
      bestTarget.prestigePoints >= 2 &&
      player.cardsReserved.length < reserveLimit &&
      !player.cardsReserved.includes(bestTarget.id) &&
      validateReserveCard(state, playerIndex, { cardId: bestTarget.id }).valid
    ) {
      const opponentTurns = leadingOpponent ? turnsToAfford(leadingOpponent, bestTarget) : 99;
      if (opponentTurns <= 2) {
        return { type: 'reserve', cardId: bestTarget.id };
      }
    }

    // Take 2 same color if needed and have token room
    if (tokenCount <= vaultLimit - 2 || (player.cardsReserved.length >= reserveLimit && legalPurchases.length === 0)) {
      for (const col of needed) {
        if (validateTakePairTokens(state, playerIndex, col).valid) {
          return { type: 'take_pair', color: col };
        }
      }
    }

    // Take 3 distinct needed tokens (only if below limit <= vaultLimit - 1 or to unblock)
    if (tokenCount <= vaultLimit - 1 || (player.cardsReserved.length >= reserveLimit && legalPurchases.length === 0)) {
      const smartDistinct = getSmartDistinctTokens(state, playerIndex, needed);
      if (smartDistinct) return smartDistinct;
    }
  }

  // 6. If can buy any card now, do so
  if (legalPurchases.length > 0) {
    return { type: 'purchase', cardId: legalPurchases[0] };
  }

  // 7. General token pickup (<= vaultLimit - 1 or to unblock)
  if (tokenCount <= vaultLimit - 1 || (player.cardsReserved.length >= reserveLimit && legalPurchases.length === 0)) {
    const distinct = getAvailableDistinctMove(state, playerIndex);
    if (distinct) return distinct;
  }

  // 8. Reserve random card
  if (player.cardsReserved.length < reserveLimit) {
    const reserveMove = getRandomReserveMove(state, playerIndex);
    if (reserveMove) return reserveMove;
  }

  // 9. Fallback tokens (<= vaultLimit - 1 or to unblock)
  if (tokenCount <= vaultLimit - 1 || (player.cardsReserved.length >= reserveLimit && legalPurchases.length === 0)) {
    const fallbackTokens = getAvailableDistinctMove(state, playerIndex);
    if (fallbackTokens) return fallbackTokens;
  }

  return { type: 'pass' };
}

// -------------------------------------------------------------
// TIER 4: GRANDMASTER DINESH (GREEDY SABOTEUR)
// -------------------------------------------------------------
function cloneState(state) {
  return JSON.parse(JSON.stringify(state));
}

function calculateGemsToSpend(player, card) {
  const cost = getEffectiveCardCost(player, card);
  let gemsNeeded = 0;
  for (const c of GEM_COLORS) {
    const costVal = cost[c] || 0;
    const bonus = player.bonuses[c] || 0;
    gemsNeeded += Math.max(0, costVal - bonus);
  }
  const wildDiscounts = (player.wildBonuses || 0) + (player.synergyDiscounts > 0 ? 2 : 0);
  return Math.max(0, gemsNeeded - wildDiscounts);
}

function evaluateOpponentBestThreat(simState, dineshIndex) {
  const opponents = simState.players.filter((_, idx) => idx !== dineshIndex);
  if (opponents.length === 0) return 0;
  const opp = opponents.slice().sort((a, b) => b.prestigePoints - a.prestigePoints)[0];
  let maxThreat = 0;
  const targetPoints = opp.targetPointsOverride || simState.targetPoints || 15;

  const oppIndex = simState.players.indexOf(opp);
  for (const tier of [3, 2, 1]) {
    for (const cardId of simState.tableCards[tier]) {
      if (!cardId) continue;
      const card = CARDS_BY_ID[cardId];
      if (canPlayerBuyCard(simState, oppIndex, cardId)) {
        const noble = unlocksNoble(simState, opp, card.gemBonus);
        const pts = opp.prestigePoints + card.prestigePoints + (noble ? 3 : 0);

        let oppModeWin = false;
        if (simState.gameMode === 'onyx_syndicate') {
          if ((opp.bonuses.onyx || 0) + (card.gemBonus === 'onyx' ? 1 : 0) >= 10) oppModeWin = true;
        } else if (simState.gameMode === 'color_supremacy') {
          const wouldClaim = (opp.bonuses[card.gemBonus] || 0) + 1 >= 5 && simState.colorTrophies && simState.colorTrophies[card.gemBonus] === null;
          if ((opp.trophies || 0) + (wouldClaim ? 1 : 0) >= 3) oppModeWin = true;
        } else if (simState.gameMode === 'noble_court') {
          if (noble && (opp.noblesAcquired.length + 1) >= 3) oppModeWin = true;
        } else if (simState.gameMode === 'rainbow_guild') {
          const wouldRainbow = GEM_COLORS.every(c => (opp.bonuses[c] || 0) + (card.gemBonus === c ? 1 : 0) >= 3);
          if (wouldRainbow) oppModeWin = true;
        }

        if (oppModeWin || pts >= targetPoints) return 150000;
        const t = card.prestigePoints * 900 + (noble ? 4500 : 0) + (oppModeWin ? 20000 : 0);
        if (t > maxThreat) maxThreat = t;
      }
    }
  }
  for (const cardId of opp.cardsReserved) {
    const card = CARDS_BY_ID[cardId];
    if (canPlayerBuyCard(simState, oppIndex, cardId)) {
      const noble = unlocksNoble(simState, opp, card.gemBonus);
      const pts = opp.prestigePoints + card.prestigePoints + (noble ? 3 : 0);

      let oppModeWin = false;
      if (simState.gameMode === 'onyx_syndicate') {
        if ((opp.bonuses.onyx || 0) + (card.gemBonus === 'onyx' ? 1 : 0) >= 10) oppModeWin = true;
      } else if (simState.gameMode === 'color_supremacy') {
        const wouldClaim = (opp.bonuses[card.gemBonus] || 0) + 1 >= 5 && simState.colorTrophies && simState.colorTrophies[card.gemBonus] === null;
        if ((opp.trophies || 0) + (wouldClaim ? 1 : 0) >= 3) oppModeWin = true;
      } else if (simState.gameMode === 'noble_court') {
        if (noble && (opp.noblesAcquired.length + 1) >= 3) oppModeWin = true;
      } else if (simState.gameMode === 'rainbow_guild') {
        const wouldRainbow = GEM_COLORS.every(c => (opp.bonuses[c] || 0) + (card.gemBonus === c ? 1 : 0) >= 3);
        if (wouldRainbow) oppModeWin = true;
      }

      if (oppModeWin || pts >= targetPoints) return 150000;
      const t = card.prestigePoints * 900 + (noble ? 4500 : 0) + (oppModeWin ? 20000 : 0);
      if (t > maxThreat) maxThreat = t;
    }
  }
  return maxThreat;
}

function evaluateGrandmasterState(state, playerIndex, priorState = null, chosenMove = null) {
  const dinesh = state.players[playerIndex];
  const opponents = state.players.filter((_, idx) => idx !== playerIndex);
  const opp = opponents.slice().sort((a, b) => b.prestigePoints - a.prestigePoints)[0];
  const targetPoints = dinesh.targetPointsOverride || state.targetPoints || 15;
  const oppTargetPoints = (opp && opp.targetPointsOverride) || state.targetPoints || 15;

  let score = 0;

  // 1. Dinesh Prestige Points & Win Condition
  score += dinesh.prestigePoints * 2500;
  if (dinesh.prestigePoints >= targetPoints) {
    score += 200000;
    if (opp && dinesh.prestigePoints > opp.prestigePoints) {
      score += 80000;
    } else if (opp && dinesh.prestigePoints === opp.prestigePoints && dinesh.cardsPurchased.length < opp.cardsPurchased.length) {
      score += 80000; // Tiebreaker win (fewer cards)
    }
  }

  // Game Mode Specific Win & Progression Valuations
  if (state.gameMode === 'onyx_syndicate') {
    const dOnyx = dinesh.bonuses.onyx || 0;
    score += dOnyx * 6000;
    if (dOnyx >= 10) score += 250000;
    if (opp) {
      const oOnyx = opp.bonuses.onyx || 0;
      score -= oOnyx * 5500;
      if (oOnyx >= 10) score -= 250000;
      else if (oOnyx >= 8) score -= 80000;
    }
  } else if (state.gameMode === 'color_supremacy') {
    const dTrophies = dinesh.trophies || 0;
    score += dTrophies * 50000;
    if (dTrophies >= 3) score += 250000;
    if (opp) {
      const oTrophies = opp.trophies || 0;
      score -= oTrophies * 45000;
      if (oTrophies >= 3) score -= 250000;
    }
  } else if (state.gameMode === 'noble_court') {
    score += dinesh.noblesAcquired.length * 40000;
    if (dinesh.noblesAcquired.length >= 3) score += 250000;
    if (opp) {
      score -= opp.noblesAcquired.length * 35000;
      if (opp.noblesAcquired.length >= 3) score -= 250000;
    }
  } else if (state.gameMode === 'rainbow_guild') {
    const dRainbowCount = GEM_COLORS.filter(c => (dinesh.bonuses[c] || 0) >= 3).length;
    score += dRainbowCount * 25000;
    if (dRainbowCount === 5) score += 250000;
    if (opp) {
      const oRainbowCount = GEM_COLORS.filter(c => (opp.bonuses[c] || 0) >= 3).length;
      score -= oRainbowCount * 22000;
      if (oRainbowCount === 5) score -= 250000;
    }
  }

  // Opponent point threat
  if (opp) {
    score -= opp.prestigePoints * 2200;
    if (opp.prestigePoints >= oppTargetPoints) {
      score -= 120000;
    }
  }

  // 2. Nobles: Acquisition & Proximity
  score += dinesh.noblesAcquired.length * 5000;
  if (opp) {
    score -= opp.noblesAcquired.length * 5000;
  }

  const nobleDemand = {};
  GEM_COLORS.forEach(c => nobleDemand[c] = 0);

  for (const nId of state.nobles) {
    const noble = NOBLES_BY_ID[nId];
    if (!noble) continue;
    let dineshDeficit = 0;
    let oppDeficit = 0;

    for (const c of GEM_COLORS) {
      const req = noble.requirements[c] || 0;
      const dHave = dinesh.bonuses[c] || 0;
      const oHave = opp ? (opp.bonuses[c] || 0) : 0;
      if (req > dHave) {
        const d = req - dHave;
        dineshDeficit += d;
        nobleDemand[c] += d * 4;
      }
      if (req > oHave) {
        oppDeficit += (req - oHave);
      }
    }

    if (dineshDeficit === 0) score += 5000;
    else if (dineshDeficit === 1) score += 2000;
    else if (dineshDeficit === 2) score += 800;

    // SABOTAGE: severe penalty if opponent is close to noble
    if (oppDeficit === 1) score -= 2500;
    else if (oppDeficit === 2) score -= 800;
  }

  // 3. Dinesh Bonus Engine
  for (const c of GEM_COLORS) {
    const b = dinesh.bonuses[c] || 0;
    const dem = nobleDemand[c] || 0;
    score += Math.min(5, b) * (280 + dem * 25);
    if (b > 5) score += (b - 5) * 50;
  }

  // 4. Dinesh Points Progress & Card Valuation
  const candidateCards = [];
  for (const tier of [3, 2, 1]) {
    for (const id of state.tableCards[tier]) {
      if (id) candidateCards.push(CARDS_BY_ID[id]);
    }
  }
  for (const id of dinesh.cardsReserved) {
    candidateCards.push(CARDS_BY_ID[id]);
  }

  const cardDemand = {};
  GEM_COLORS.forEach(c => cardDemand[c] = 0);

  for (const card of candidateCards) {
    let missing = 0;
    const needed = [];
    const cost = getEffectiveCardCost(dinesh, card);
    for (const c of GEM_COLORS) {
      const cCost = cost[c] || 0;
      const b = dinesh.bonuses[c] || 0;
      const have = dinesh.tokens[c] || 0;
      const req = Math.max(0, cCost - b);
      if (have < req) {
        missing += (req - have);
        needed.push({ c, diff: req - have });
      }
    }
    const wildDiscounts = (dinesh.wildBonuses || 0) + (dinesh.synergyDiscounts > 0 ? 2 : 0);
    missing = Math.max(0, missing - wildDiscounts);
    const goldMultiplier = dinesh.hasBlackMarket ? 2 : 1;
    missing = Math.max(0, missing - (dinesh.tokens.gold || 0) * goldMultiplier);

    if (card.prestigePoints > 0) {
      const pts = card.prestigePoints;
      if (missing === 0) {
        score += pts * 650;
      } else if (missing <= 1) {
        score += pts * 350;
        needed.forEach(item => cardDemand[item.c] += pts * 30);
      } else if (missing <= 2) {
        score += pts * 200;
        needed.forEach(item => cardDemand[item.c] += pts * 20);
      } else if (missing <= 3) {
        score += pts * 100;
        needed.forEach(item => cardDemand[item.c] += pts * 10);
      }
    }
  }

  // 5. Dinesh Token Valuation
  for (const c of GEM_COLORS) {
    const count = dinesh.tokens[c] || 0;
    if (count > 0) {
      const totDemand = (nobleDemand[c] || 0) + (cardDemand[c] || 0);
      score += count * (totDemand > 0 ? (50 + Math.min(60, totDemand)) : 10);
    }
  }
  score += (dinesh.tokens.gold || 0) * 110;

  // -----------------------------------------------------------
  // 6. RUTHLESS SABOTAGE & OPPONENT GEM INFLATION ENGINE
  // -----------------------------------------------------------
  if (opp) {
    // 6A. Opponent Immediate Buy Threats
    let oppCanWin = false;
    let oppCanGetNoble = false;
    for (const tier of [3, 2, 1]) {
      for (const cardId of state.tableCards[tier]) {
        if (!cardId) continue;
        const card = CARDS_BY_ID[cardId];
        if (canAffordCard(opp, card)) {
          const nobleGained = unlocksNoble(state, opp, card.gemBonus);
          const oppPtsNext = opp.prestigePoints + card.prestigePoints + (nobleGained ? 3 : 0);
          if (oppPtsNext >= oppTargetPoints) oppCanWin = true;
          if (nobleGained) oppCanGetNoble = true;
          if (card.prestigePoints >= 3) score -= card.prestigePoints * 500;
          else if (card.prestigePoints >= 2) score -= card.prestigePoints * 300;
        }
      }
    }
    for (const cardId of opp.cardsReserved) {
      const card = CARDS_BY_ID[cardId];
      if (canAffordCard(opp, card)) {
        const nobleGained = unlocksNoble(state, opp, card.gemBonus);
        const oppPtsNext = opp.prestigePoints + card.prestigePoints + (nobleGained ? 3 : 0);
        if (oppPtsNext >= oppTargetPoints) oppCanWin = true;
        if (nobleGained) oppCanGetNoble = true;
        if (card.prestigePoints >= 3) score -= card.prestigePoints * 500;
      }
    }
    if (oppCanWin) score -= 110000;
    if (oppCanGetNoble) score -= 10000;

    // 6B. Opponent Target Hijacking:
    // Check what cards the opponent was closest to buying in priorState!
    if (priorState && chosenMove) {
      const priorOpp = priorState.players.find(p => p.id === opp.id);
      if (priorOpp) {
        for (const tier of [3, 2, 1]) {
          for (const cardId of priorState.tableCards[tier]) {
            if (!cardId) continue;
            const card = CARDS_BY_ID[cardId];
            let oppMissingTokens = 0;
            const cost = getEffectiveCardCost(priorOpp, card);
            for (const c of GEM_COLORS) {
              const cCost = cost[c] || 0;
              const b = priorOpp.bonuses[c] || 0;
              const have = priorOpp.tokens[c] || 0;
              const req = Math.max(0, cCost - b);
              if (have < req) oppMissingTokens += (req - have);
            }
            const priorWild = (priorOpp.wildBonuses || 0) + (priorOpp.synergyDiscounts > 0 ? 2 : 0);
            oppMissingTokens = Math.max(0, oppMissingTokens - priorWild);
            oppMissingTokens = Math.max(0, oppMissingTokens - (priorOpp.tokens.gold || 0) * (priorOpp.hasBlackMarket ? 2 : 1));

            // If opponent was within 1-2 tokens of this card, and Dinesh stole or reserved it:
            if (oppMissingTokens <= 2) {
              if (chosenMove.cardId === cardId) {
                // Snatched or reserved opponent's prime target!
                score += (card.prestigePoints * 300) + 1800;
              }
            }
          }
        }
      }
    }

    // 6C. Gem Starvation: Deplete gems the opponent desperately needs
    const oppNeededColors = {};
    GEM_COLORS.forEach(c => oppNeededColors[c] = 0);

    // Opponent reserved cards (high commitment)
    for (const cardId of opp.cardsReserved) {
      const card = CARDS_BY_ID[cardId];
      const cost = getEffectiveCardCost(opp, card);
      for (const c of GEM_COLORS) {
        const cCost = cost[c] || 0;
        const b = opp.bonuses[c] || 0;
        const have = opp.tokens[c] || 0;
        if (cCost - b > have) oppNeededColors[c] += (cCost - b - have) * 3;
      }
    }

    // Opponent closest table cards
    for (const tier of [3, 2, 1]) {
      for (const cardId of state.tableCards[tier]) {
        if (!cardId) continue;
        const card = CARDS_BY_ID[cardId];
        const cost = getEffectiveCardCost(opp, card);
        let miss = 0;
        for (const c of GEM_COLORS) {
          const cCost = cost[c] || 0;
          const b = opp.bonuses[c] || 0;
          const have = opp.tokens[c] || 0;
          if (cCost - b > have) miss += (cCost - b - have);
        }
        const oppWild = (opp.wildBonuses || 0) + (opp.synergyDiscounts > 0 ? 2 : 0);
        miss = Math.max(0, miss - oppWild);
        if (miss <= 3) {
          for (const c of GEM_COLORS) {
            const cCost = cost[c] || 0;
            const b = opp.bonuses[c] || 0;
            const have = opp.tokens[c] || 0;
            if (cCost - b > have) oppNeededColors[c] += (cCost - b - have);
          }
        }
      }
    }

    // Reward starving bank gems that opponent needs
    for (const c of GEM_COLORS) {
      const need = oppNeededColors[c] || 0;
      if (need > 0) {
        const bankLeft = state.bank[c] || 0;
        if (bankLeft === 0) score += 400 + need * 25; // Bank completely starved of opponent's gem!
        else if (bankLeft <= 1) score += 200 + need * 15;
      }
    }

    // 6D. Force Player to Spend More Gems:
    // Penalize states where cheap cards (cost <= 3 gems) are left for the opponent
    let cheapCardsForOpponent = 0;
    for (const tier of [1, 2]) {
      for (const cardId of state.tableCards[tier]) {
        if (!cardId) continue;
        const card = CARDS_BY_ID[cardId];
        const costInGems = calculateGemsToSpend(opp, card);
        if (costInGems <= 3) {
          cheapCardsForOpponent++;
        }
      }
    }
    // The fewer cheap cards available to opponent, the more gems they must spend!
    score -= cheapCardsForOpponent * 50;
  }

  // 7. Engine Building: reward having cards that generate permanent gem discounts
  score += dinesh.cardsPurchased.length * 80;

  return score;
}

function getGrandmasterLegalMoves(state, playerIndex) {
  const player = state.players[playerIndex];
  const opponents = state.players.filter((_, idx) => idx !== playerIndex);
  const opp = opponents.slice().sort((a, b) => b.prestigePoints - a.prestigePoints)[0];
  const targetPoints = player.targetPointsOverride || state.targetPoints || 15;
  const oppTargetPoints = (opp && opp.targetPointsOverride) || state.targetPoints || 15;
  const moves = [];
  const tokenCount = countTokens(player.tokens);
  const legalPurchases = [];

  // 1. Purchases (table cards + reserved cards)
  for (const tier of [3, 2, 1]) {
    for (const cardId of state.tableCards[tier]) {
      if (canPlayerBuyCard(state, playerIndex, cardId)) {
        // Detect if this purchase hijacks a card the opponent needs
        let hijacks = false;
        if (opp) {
          let oppDiff = 0;
          const card = CARDS_BY_ID[cardId];
          const cost = getEffectiveCardCost(opp, card);
          for (const c of GEM_COLORS) {
            const cCost = cost[c] || 0;
            const b = opp.bonuses[c] || 0;
            const have = opp.tokens[c] || 0;
            if (cCost - b > have) oppDiff += (cCost - b - have);
          }
          const oppWild = (opp.wildBonuses || 0) + (opp.synergyDiscounts > 0 ? 2 : 0);
          oppDiff = Math.max(0, oppDiff - oppWild);
          oppDiff = Math.max(0, oppDiff - (opp.tokens.gold || 0) * (opp.hasBlackMarket ? 2 : 1));
          if (oppDiff <= 2) hijacks = true;
        }
        const m = {
          type: 'purchase',
          cardId,
          sabotage: hijacks,
          sabotageTargetName: hijacks && opp ? opp.name : null
        };
        moves.push(m);
        legalPurchases.push(m);
      }
    }
  }
  for (const cardId of player.cardsReserved) {
    if (canPlayerBuyCard(state, playerIndex, cardId)) {
      const m = { type: 'purchase', cardId };
      moves.push(m);
      legalPurchases.push(m);
    }
  }

  // 2. Take pairs
  for (const c of GEM_COLORS) {
    if (validateTakePairTokens(state, playerIndex, c).valid) {
      moves.push({ type: 'take_pair', color: c });
    }
  }

  // 3. Take distinct
  const maxVault = player.vaultLimit || 10;
  if (tokenCount < maxVault) {
    const available = GEM_COLORS.filter(c => state.bank[c] > 0);
    const maxTake = (player.hasPrismaticHarmony && available.length >= 4) ? 4 : 3;
    const k = Math.min(maxTake, available.length);
    if (k > 0) {
      function getCombos(arr, len, start = 0, current = []) {
        if (current.length === len) return [current];
        const res = [];
        for (let i = start; i < arr.length; i++) {
          res.push(...getCombos(arr, len, i + 1, [...current, arr[i]]));
        }
        return res;
      }
      const combos = getCombos(available, k);
      for (const combo of combos) {
        if (validateTakeDistinctTokens(state, playerIndex, combo).valid) {
          moves.push({ type: 'take_distinct', colors: combo });
        }
      }
    }
  } else if (player.cardsReserved.length >= (player.reserveLimit || 3) && legalPurchases.length === 0) {
    // Only allow token swapping at max tokens if we have reserved cards we cannot afford and can grab a missing gem
    const needed = new Set();
    for (const cardId of player.cardsReserved) {
      const card = CARDS_BY_ID[cardId];
      const cost = getEffectiveCardCost(player, card);
      for (const c of GEM_COLORS) {
        const cCost = cost[c] || 0;
        const b = player.bonuses[c] || 0;
        const have = player.tokens[c] || 0;
        if (cCost - b > have && state.bank[c] > 0) needed.add(c);
      }
    }
    if (needed.size > 0) {
      const available = GEM_COLORS.filter(c => state.bank[c] > 0);
      const k = Math.min(3, available.length);
      if (k > 0) {
        function getCombos(arr, len, start = 0, current = []) {
          if (current.length === len) return [current];
          const res = [];
          for (let i = start; i < arr.length; i++) {
            res.push(...getCombos(arr, len, i + 1, [...current, arr[i]]));
          }
          return res;
        }
        const combos = getCombos(available, k).filter(combo => combo.some(c => needed.has(c)));
        for (const combo of combos) {
          if (validateTakeDistinctTokens(state, playerIndex, combo).valid) {
            moves.push({ type: 'take_distinct', colors: combo });
          }
        }
      }
    }
  }

  // 4. Reserve cards (strategic filtering + robust fallbacks)
  if (player.cardsReserved.length < (player.reserveLimit || 3)) {
    for (const tier of [3, 2, 1]) {
      for (const cardId of state.tableCards[tier]) {
        if (!cardId) continue;
        const card = CARDS_BY_ID[cardId];
        const deniesNoble = opp && canAffordCard(opp, card) && unlocksNoble(state, opp, card.gemBonus);
        const deniesWin = opp && canAffordCard(opp, card) && (opp.prestigePoints + card.prestigePoints >= oppTargetPoints);

        // Detect if this card is being actively saved for by opponent
        let oppDiff = 0;
        if (opp) {
          const cost = getEffectiveCardCost(opp, card);
          for (const c of GEM_COLORS) {
            const cCost = cost[c] || 0;
            const b = opp.bonuses[c] || 0;
            const have = opp.tokens[c] || 0;
            if (cCost - b > have) oppDiff += (cCost - b - have);
          }
          const oppWild = (opp.wildBonuses || 0) + (opp.synergyDiscounts > 0 ? 2 : 0);
          oppDiff = Math.max(0, oppDiff - oppWild);
          oppDiff = Math.max(0, oppDiff - (opp.tokens.gold || 0) * (opp.hasBlackMarket ? 2 : 1));
        }
        const hijacksTarget = opp && oppDiff <= 2 && (card.prestigePoints >= 1 || card.tier >= 2);

        if (card.prestigePoints >= 1 || deniesNoble || deniesWin || hijacksTarget || card.tier >= 2) {
          if (validateReserveCard(state, playerIndex, { cardId }).valid) {
            moves.push({
              type: 'reserve',
              cardId,
              sabotage: deniesNoble || deniesWin || hijacksTarget,
              sabotageTargetName: (deniesNoble || deniesWin || hijacksTarget) && opp ? opp.name : null
            });
          }
        }
      }
    }

    // Fallback reserves to prevent deadlock when no purchases exist and bank tokens are limited
    if (moves.length === 0 || (legalPurchases.length === 0 && tokenCount >= 8)) {
      for (const tier of [2, 1, 3]) {
        for (const cardId of state.tableCards[tier]) {
          if (cardId && validateReserveCard(state, playerIndex, { cardId }).valid) {
            moves.push({ type: 'reserve', cardId });
          }
        }
        if (state.decks[tier].length > 0) {
          moves.push({ type: 'reserve', tier, fromDeck: true });
        }
      }
    }
  }

  if (moves.length === 0) {
    moves.push({ type: 'pass' });
  }

  return moves;
}

function computeGrandmasterMove(state, playerIndex) {
  const player = state.players[playerIndex];
  const opponents = state.players.filter((_, idx) => idx !== playerIndex);
  const leadingOpponent = opponents.slice().sort((a, b) => b.prestigePoints - a.prestigePoints)[0];
  const targetPoints = player.targetPointsOverride || state.targetPoints || 15;
  const oppTargetPoints = (leadingOpponent && leadingOpponent.targetPointsOverride) || state.targetPoints || 15;

  // 1. INSTANT WIN CHECK: If any legal purchase wins right now, TAKE IT!
  const legalPurchases = [];
  for (const tier of [3, 2, 1]) {
    for (const id of state.tableCards[tier]) {
      if (canPlayerBuyCard(state, playerIndex, id)) legalPurchases.push(id);
    }
  }
  for (const id of player.cardsReserved) {
    if (canPlayerBuyCard(state, playerIndex, id)) legalPurchases.push(id);
  }

  if (legalPurchases.length > 0) {
    let winningCardId = null;
    let maxWinPts = -1;
    for (const id of legalPurchases) {
      const card = CARDS_BY_ID[id];
      const nobleGained = unlocksNoble(state, player, card.gemBonus);
      const pts = player.prestigePoints + card.prestigePoints + (nobleGained ? 3 : 0);
      const oppPts = leadingOpponent ? leadingOpponent.prestigePoints : 0;

      let isModeWin = false;
      if (state.gameMode === 'onyx_syndicate') {
        const nextOnyx = (player.bonuses.onyx || 0) + (card.gemBonus === 'onyx' ? 1 : 0);
        if (nextOnyx >= 10) isModeWin = true;
      } else if (state.gameMode === 'color_supremacy') {
        const nextBonus = (player.bonuses[card.gemBonus] || 0) + 1;
        const wouldClaimTrophy = (nextBonus >= 5 && state.colorTrophies && state.colorTrophies[card.gemBonus] === null);
        if ((player.trophies || 0) + (wouldClaimTrophy ? 1 : 0) >= 3) isModeWin = true;
      } else if (state.gameMode === 'noble_court') {
        if (nobleGained && (player.noblesAcquired.length + 1) >= 3) isModeWin = true;
      } else if (state.gameMode === 'rainbow_guild') {
        const isNowComplete = GEM_COLORS.every(c => {
          const b = (player.bonuses[c] || 0) + (card.gemBonus === c ? 1 : 0);
          return b >= 3;
        });
        if (isNowComplete) isModeWin = true;
      }

      if (isModeWin || pts >= targetPoints || (oppPts >= oppTargetPoints && pts >= oppPts)) {
        if (pts > maxWinPts || isModeWin) {
          maxWinPts = pts;
          winningCardId = id;
          if (isModeWin) break;
        }
      }
    }
    if (winningCardId) {
      return {
        type: 'purchase',
        cardId: winningCardId,
        sabotage: false
      };
    }
  }

  const legalMoves = getGrandmasterLegalMoves(state, playerIndex);
  if (legalMoves.length === 1) return legalMoves[0];

  let bestMove = legalMoves[0];
  let bestScore = -Infinity;

  for (const move of legalMoves) {
    const simState = cloneState(state);
    const pIdx = simState.activePlayerIndex;

    try {
      if (move.type === 'purchase') {
        executePurchaseCard(simState, pIdx, move.cardId);
      } else if (move.type === 'take_pair') {
        executeTakePairTokens(simState, pIdx, move.color);
      } else if (move.type === 'take_distinct') {
        executeTakeDistinctTokens(simState, pIdx, move.colors);
      } else if (move.type === 'reserve') {
        executeReserveCard(simState, pIdx, move);
      } else {
        executePassTurn(simState, pIdx);
      }

      if (simState.pendingNobleChoice && simState.pendingNobleChoice.playerIndex === pIdx) {
        const nobleId = simState.pendingNobleChoice.nobleIds[0];
        executeChooseNoble(simState, pIdx, nobleId);
      }

      if (simState.pendingDiscard && simState.pendingDiscard.playerIndex === pIdx) {
        const discardMap = computeAiDiscard(simState, pIdx, simState.pendingDiscard.excessCount);
        executeDiscardTokens(simState, pIdx, discardMap);
      }

      // 2-Ply Evaluation: evaluate Dinesh state and subtract opponent's counter-threat
      const rawScore = evaluateGrandmasterState(simState, playerIndex, state, move);
      const oppThreat = evaluateOpponentBestThreat(simState, playerIndex);
      const netScore = rawScore - (oppThreat * 0.9);

      if (netScore > bestScore) {
        bestScore = netScore;
        bestMove = move;
      }
    } catch (e) {
      // Skip invalid simulation branch
    }
  }

  return bestMove;
}



// -------------------------------------------------------------
// HELPER FUNCTIONS
// -------------------------------------------------------------

function getLegalPurchases(state, playerIndex) {
  const player = state.players[playerIndex];
  const purchases = [];

  // Table cards
  for (const tier of [1, 2, 3]) {
    for (const cardId of state.tableCards[tier]) {
      if (canPlayerBuyCard(state, playerIndex, cardId)) {
        purchases.push(cardId);
      }
    }
  }

  // Reserved cards
  for (const cardId of player.cardsReserved) {
    if (canPlayerBuyCard(state, playerIndex, cardId)) {
      purchases.push(cardId);
    }
  }

  return purchases;
}

function getAllVisibleCardIds(state, player) {
  const cards = [];
  for (const tier of [1, 2, 3]) {
    for (const cardId of state.tableCards[tier]) {
      if (cardId) cards.push(cardId);
    }
  }
  for (const cardId of player.cardsReserved) {
    cards.push(cardId);
  }
  return cards;
}

function pickBestTargetCard(state, player, cardIds) {
  let bestCard = null;
  let bestScore = -Infinity;

  for (const cardId of cardIds) {
    const card = CARDS_BY_ID[cardId];
    if (!card) continue;

    let score = card.prestigePoints * 4;
    if (advancesNoble(state, player, card.gemBonus)) score += 3;

    // Favor cheaper cards early game, higher tier late game
    const totalBonus = Object.values(player.bonuses).reduce((a, b) => a + b, 0);
    if (totalBonus < 4) {
      if (card.tier === 1) score += 3;
    } else {
      if (card.tier >= 2) score += 4;
    }

    // Mode-specific strategic adjustments
    if (state.gameMode === 'onyx_syndicate') {
      if (card.gemBonus === 'onyx') score += 18;
    } else if (state.gameMode === 'tier_ladder') {
      const t1Count = player.cardsPurchased.filter(id => CARDS_BY_ID[id] && CARDS_BY_ID[id].tier === 1).length;
      const t2Count = player.cardsPurchased.filter(id => CARDS_BY_ID[id] && CARDS_BY_ID[id].tier === 2).length;
      if (t1Count < 6) {
        if (card.tier === 1) score += 14;
        else score -= 25; // Locked in ladder
      } else if (t2Count < 6) {
        if (card.tier === 2) score += 14;
        else if (card.tier === 3) score -= 25;
      }
    } else if (state.gameMode === 'color_supremacy') {
      if (state.colorTrophies && state.colorTrophies[card.gemBonus] === null) {
        const curInColor = player.bonuses[card.gemBonus] || 0;
        if (curInColor < 5) score += (curInColor + 1) * 4;
      }
    } else if (state.gameMode === 'noble_court') {
      if (advancesNoble(state, player, card.gemBonus)) score += 18;
    } else if (state.gameMode === 'rainbow_guild') {
      const curInColor = player.bonuses[card.gemBonus] || 0;
      if (curInColor < 3) score += (3 - curInColor) * 6;
    }

    const turns = turnsToAfford(player, card);
    score -= turns * 1.5;

    if (score > bestScore) {
      bestScore = score;
      bestCard = card;
    }
  }

  return bestCard;
}

function advancesNoble(state, player, bonusColor) {
  for (const nobleId of state.nobles) {
    const noble = NOBLES_BY_ID[nobleId];
    const req = noble.requirements[bonusColor] || 0;
    const have = player.bonuses[bonusColor] || 0;
    if (req > 0 && have < req) {
      return true;
    }
  }
  return false;
}

function unlocksNoble(state, player, bonusColor) {
  for (const nobleId of state.nobles) {
    const noble = NOBLES_BY_ID[nobleId];
    if (!noble) continue;
    let eligible = true;
    for (const color of GEM_COLORS) {
      const req = noble.requirements[color] || 0;
      let have = player.bonuses[color] || 0;
      if (color === bonusColor) have += 1;
      if (have < req) {
        eligible = false;
        break;
      }
    }
    if (eligible) return true;
  }
  return false;
}

function turnsToAfford(player, card) {
  if (!card) return 99;
  const cost = getEffectiveCardCost(player, card);
  let missing = 0;
  for (const color of GEM_COLORS) {
    const c = cost[color] || 0;
    const bonus = player.bonuses[color] || 0;
    const req = Math.max(0, c - bonus);
    const have = player.tokens[color] || 0;
    if (have < req) missing += (req - have);
  }
  const wildDiscounts = (player.wildBonuses || 0) + (player.synergyDiscounts > 0 ? 2 : 0);
  missing = Math.max(0, missing - wildDiscounts);
  const goldMultiplier = player.hasBlackMarket ? 2 : 1;
  missing = Math.max(0, missing - (player.tokens.gold || 0) * goldMultiplier);
  return Math.ceil(missing / 2.5); // Approx ~2.5 tokens acquired per turn
}

function getNeededColorsForCard(player, card) {
  if (!card) return [];
  const cost = getEffectiveCardCost(player, card);
  const wildDiscounts = (player.wildBonuses || 0) + (player.synergyDiscounts > 0 ? 2 : 0);
  let totalDeficit = 0;
  const needed = [];
  for (const color of GEM_COLORS) {
    const c = cost[color] || 0;
    const bonus = player.bonuses[color] || 0;
    const req = Math.max(0, c - bonus);
    const have = player.tokens[color] || 0;
    if (have < req) {
      totalDeficit += (req - have);
      needed.push(color);
    }
  }
  if (totalDeficit <= wildDiscounts) {
    return [];
  }
  return needed;
}

function getCostInTokens(player, card) {
  if (!card) return 0;
  const cost = getEffectiveCardCost(player, card);
  let tokens = 0;
  for (const color of GEM_COLORS) {
    const c = cost[color] || 0;
    const bonus = player.bonuses[color] || 0;
    tokens += Math.max(0, c - bonus);
  }
  const wildDiscounts = (player.wildBonuses || 0) + (player.synergyDiscounts > 0 ? 2 : 0);
  return Math.max(0, tokens - wildDiscounts);
}

function getSmartDistinctTokens(state, playerIndex, preferredColors) {
  const player = state.players[playerIndex];
  const tokenCount = countTokens(player.tokens);
  const vaultLimit = player.vaultLimit || 10;
  if (tokenCount >= vaultLimit) {
    // Only allow token swapping if at vaultLimit tokens AND we have needed colors available in bank
    if (!preferredColors || preferredColors.length === 0) return null;
    const hasNeededInBank = preferredColors.some(c => state.bank[c] > 0 && (player.tokens[c] || 0) === 0);
    if (!hasNeededInBank) return null;
  }

  const availableInBank = GEM_COLORS.filter(c => state.bank[c] > 0);
  if (availableInBank.length === 0) return null;

  const chosen = [];
  const hasPrismatic = player && (player.hasPrismaticHarmony || (player.powersClaimed && player.powersClaimed.includes('prismatic_harmony')));
  const targetDistinct = (hasPrismatic && availableInBank.length >= 4) ? 4 : 3;

  // Pick preferred first
  for (const color of preferredColors) {
    if (availableInBank.includes(color) && !chosen.includes(color)) {
      chosen.push(color);
      if (chosen.length === targetDistinct) break;
    }
  }

  // Fill up to targetDistinct with remaining available colors
  if (chosen.length < targetDistinct && chosen.length < availableInBank.length) {
    for (const color of availableInBank) {
      if (!chosen.includes(color)) {
        chosen.push(color);
        if (chosen.length === targetDistinct || chosen.length === availableInBank.length) break;
      }
    }
  }

  const validation = validateTakeDistinctTokens(state, playerIndex, chosen);
  if (validation.valid) {
    return { type: 'take_distinct', colors: chosen };
  }
  return null;
}

function getAvailableDistinctMove(state, playerIndex) {
  const player = state.players[playerIndex];
  const vaultLimit = player.vaultLimit || 10;
  if (countTokens(player.tokens) >= vaultLimit) return null;

  const availableInBank = GEM_COLORS.filter(c => state.bank[c] > 0);
  if (availableInBank.length === 0) return null;

  const hasPrismatic = player && (player.hasPrismaticHarmony || (player.powersClaimed && player.powersClaimed.includes('prismatic_harmony')));
  const maxAllowed = (hasPrismatic && availableInBank.length >= 4) ? 4 : 3;
  const countToPick = Math.min(maxAllowed, availableInBank.length);
  const colors = availableInBank.slice(0, countToPick);

  const validation = validateTakeDistinctTokens(state, playerIndex, colors);
  if (validation.valid) {
    return { type: 'take_distinct', colors };
  }
  return null;
}

function getRandomReserveMove(state, playerIndex) {
  const player = state.players[playerIndex];
  const reserveLimit = player.reserveLimit || 3;
  if (player.cardsReserved.length >= reserveLimit) return null;

  // Try reserving from table tier 1 or 2
  for (const tier of [2, 1, 3]) {
    for (const cardId of state.tableCards[tier]) {
      if (cardId && validateReserveCard(state, playerIndex, { cardId }).valid) {
        return { type: 'reserve', cardId };
      }
    }
    // Or from deck
    if (state.decks[tier].length > 0) {
      return { type: 'reserve', tier, fromDeck: true };
    }
  }
  return null;
}

function shuffleArray(arr) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}
