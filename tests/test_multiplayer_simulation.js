/**
 * Splendor 3-Player & 4-Player Multiplayer Simulation Test
 * Verifies that games with 3 and 4 players (including mixed Human and AI configurations)
 * run smoothly without getting stuck or deadlocking, and respect all game invariants.
 */

import {
  createGameState,
  executeTakeDistinctTokens,
  executeTakePairTokens,
  executeReserveCard,
  executePurchaseCard,
  executeDiscardTokens,
  executeChooseNoble,
  executePassTurn,
  countTokens
} from '../js/engine.js';
import { CARDS_BY_ID, NOBLES_BY_ID, ALL_TOKENS } from '../js/cards-data.js';
import { computeAiMove, computeAiDiscard, computeAiNobleChoice } from '../js/ai.js';

function assert(condition, message) {
  if (!condition) {
    throw new Error(`[ASSERTION FAILED] ${message}`);
  }
}

function verifyInvariants(state, moveDesc = '') {
  const pCount = state.players.length;
  // Invariant 1: Total tokens in game:
  // 3 players: 5 per regular gem * 5 + 5 gold = 30 tokens
  // 4 players: 7 per regular gem * 5 + 5 gold = 40 tokens
  const expectedTotalTokens = pCount === 3 ? 30 : (pCount === 4 ? 40 : 25);

  let totalTokensInGame = countTokens(state.bank);
  for (const player of state.players) {
    totalTokensInGame += countTokens(player.tokens);
  }
  assert(
    totalTokensInGame === expectedTotalTokens,
    `Bank conservation violated after '${moveDesc}': total tokens is ${totalTokensInGame} (expected ${expectedTotalTokens})`
  );

  // Invariant 2: Prestige points
  for (const player of state.players) {
    let expectedPoints = 0;
    for (const cardId of player.cardsPurchased) {
      expectedPoints += CARDS_BY_ID[cardId].prestigePoints;
    }
    for (const nobleId of player.noblesAcquired) {
      expectedPoints += NOBLES_BY_ID[nobleId].prestigePoints;
    }
    assert(
      player.prestigePoints === expectedPoints,
      `Prestige points mismatch for ${player.name}: state has ${player.prestigePoints}, calculated is ${expectedPoints}`
    );

    // Invariant 3: Reserved cards <= 3
    assert(
      player.cardsReserved.length <= 3,
      `${player.name} holds ${player.cardsReserved.length} reserved cards (> 3)`
    );

    // Invariant 4: Token limit <= 10 unless currently in pending discard
    if (!state.pendingDiscard || state.pendingDiscard.playerIndex !== state.players.indexOf(player)) {
      const held = countTokens(player.tokens);
      assert(held <= 10, `${player.name} holds ${held} tokens (> 10)`);
    }
  }

  // Invariant 5: Table cards must have at most 4 per tier
  for (const tier of [1, 2, 3]) {
    assert(state.tableCards[tier].length === 4, `Tier ${tier} table slot count is not 4`);
  }
}

/**
 * Execute a single turn
 */
function playNextTurn(state) {
  const pIdx = state.activePlayerIndex;
  const player = state.players[pIdx];

  // 1. Pending Discard
  if (state.pendingDiscard && state.pendingDiscard.playerIndex === pIdx) {
    const discardMap = computeAiDiscard(state, pIdx, state.pendingDiscard.excessCount);
    executeDiscardTokens(state, pIdx, discardMap);
    verifyInvariants(state, 'executeDiscardTokens');
    return;
  }

  // 2. Pending Noble Choice
  if (state.pendingNobleChoice && state.pendingNobleChoice.playerIndex === pIdx) {
    const nobleId = computeAiNobleChoice(state, pIdx, state.pendingNobleChoice.nobleIds);
    executeChooseNoble(state, pIdx, nobleId);
    verifyInvariants(state, 'executeChooseNoble');
    return;
  }

  // 3. Normal Move (AI or simulated Human using Master/Apprentice heuristics)
  const move = computeAiMove(state, pIdx);
  assert(move !== null, `No move returned for ${player.name} on turn ${state.turnIndex + 1}`);

  let moveDesc = '';
  switch (move.type) {
    case 'take_distinct':
      moveDesc = `Take distinct: [${move.colors.join(', ')}]`;
      executeTakeDistinctTokens(state, pIdx, move.colors);
      break;
    case 'take_pair':
      moveDesc = `Take pair: [${move.color} x 2]`;
      executeTakePairTokens(state, pIdx, move.color);
      break;
    case 'reserve':
      moveDesc = `Reserve card ${move.cardId || `Tier ${move.tier}`}`;
      executeReserveCard(state, pIdx, move);
      break;
    case 'purchase':
      moveDesc = `Buy card ${move.cardId}`;
      executePurchaseCard(state, pIdx, move.cardId);
      break;
    case 'pass':
      moveDesc = `Pass turn`;
      executePassTurn(state, pIdx);
      break;
    default:
      throw new Error(`Unknown move type: ${move.type}`);
  }

  // Immediate post-action discard / noble choice resolution
  if (state.pendingDiscard && state.pendingDiscard.playerIndex === pIdx) {
    const discardMap = computeAiDiscard(state, pIdx, state.pendingDiscard.excessCount);
    executeDiscardTokens(state, pIdx, discardMap);
  }

  if (state.pendingNobleChoice && state.pendingNobleChoice.playerIndex === pIdx) {
    const nobleId = computeAiNobleChoice(state, pIdx, state.pendingNobleChoice.nobleIds);
    executeChooseNoble(state, pIdx, nobleId);
  }

  verifyInvariants(state, moveDesc);
}

function runSimulationGame(name, playerNames, aiConfigs, maxRounds = 120, targetPoints = 15) {
  const state = createGameState({
    playerNames,
    aiConfigs,
    timeLimitSeconds: null,
    targetPoints
  });

  verifyInvariants(state, 'initialState');

  let roundsSeen = 0;
  while (state.status !== 'completed') {
    playNextTurn(state);
    if (state.roundIndex > roundsSeen) {
      roundsSeen = state.roundIndex;
    }
    if (roundsSeen > maxRounds) {
      throw new Error(`Simulation exceeded max rounds (${maxRounds}) without completing! Possible infinite loop.`);
    }
  }

  assert(state.winner !== null, `Game ended with status 'completed' but no winner was declared!`);
  const winner = state.winner.player || state.players.find(p => p.id === state.winnerId);
  assert(winner !== undefined, `Winner ID ${state.winnerId} not found in players array`);
  assert(winner.prestigePoints >= (state.targetPoints || 15), `Winner ${winner.name} won with only ${winner.prestigePoints} PTS (< ${state.targetPoints || 15})`);

  print(`  ✓ ${name}: Completed in ${state.turnIndex} turns (${state.roundIndex} rounds). Winner: ${winner.name} (${winner.prestigePoints} pts, ${winner.cardsPurchased.length} cards)`);
  return state;
}

print('===============================================================');
print('TEST: Multiplayer 3-Player and 4-Player Simulation Suite');
print('===============================================================');

// Scenario 1: 3-Player Game (Pass & Play: 2 Humans + 1 AI Dinesh)
// Human players are simulated via default ai engine as stand-ins
runSimulationGame(
  '3P: 2 Humans + 1 Grandmaster (Dinesh)',
  ['Alice', 'Bob', 'Dinesh'],
  [null, null, { difficulty: 'grandmaster' }]
);

// Scenario 2: 3-Player Game (1 Human + 2 AIs: Grandmaster + Master)
runSimulationGame(
  '3P: 1 Human + Grandmaster + Master',
  ['Alice', 'Dinesh', 'Bot 2 (Master)'],
  [null, { difficulty: 'grandmaster' }, { difficulty: 'master' }]
);

// Scenario 3: 3-Player Game (All AI: Grandmaster + Master + Merchant)
runSimulationGame(
  '3P: All AI (Dinesh + Master + Merchant)',
  ['Dinesh', 'Bot 2 (Master)', 'Bot 3 (Merchant)'],
  [{ difficulty: 'grandmaster' }, { difficulty: 'master' }, { difficulty: 'merchant' }]
);

// Scenario 4: 4-Player Game (Pass & Play: 2 Humans + 2 AIs: Dinesh + Master)
runSimulationGame(
  '4P: 2 Humans + Grandmaster + Master',
  ['Alice', 'Bob', 'Dinesh', 'Bot 4 (Master)'],
  [null, null, { difficulty: 'grandmaster' }, { difficulty: 'master' }]
);

// Scenario 5: 4-Player Game (All AI: Dinesh + Master + Merchant + Apprentice)
runSimulationGame(
  '4P: All AI (Dinesh + Master + Merchant + Apprentice)',
  ['Dinesh', 'Bot 2 (Master)', 'Bot 3 (Merchant)', 'Bot 4 (Apprentice)'],
  [{ difficulty: 'grandmaster' }, { difficulty: 'master' }, { difficulty: 'merchant' }, { difficulty: 'apprentice' }]
);

// Scenario 6: Stress test 5 additional 3P/4P games to verify round 2-3 stability
print('\nRunning 5 additional randomized 3P/4P stress games...');
for (let i = 1; i <= 5; i++) {
  const pCount = (i % 2 === 0) ? 4 : 3;
  const names = pCount === 3
    ? ['Player 1', 'Dinesh', 'Bot 3']
    : ['Player 1', 'Player 2', 'Dinesh', 'Bot 4'];
  const diffs = ['grandmaster', 'master', 'merchant', 'apprentice'];
  const configs = names.map((_, idx) => (idx === 0 ? null : { difficulty: diffs[idx % diffs.length] }));

  runSimulationGame(`Stress Game #${i} (${pCount}P)`, names, configs);
}

// Scenario 7: Custom Target Winning Points (20 and 25 PTS)
runSimulationGame(
  '3P: Custom 20 PTS (Grandmaster + Master + Merchant)',
  ['Dinesh', 'Bot 2 (Master)', 'Bot 3 (Merchant)'],
  [{ difficulty: 'grandmaster' }, { difficulty: 'master' }, { difficulty: 'merchant' }],
  150,
  20
);

runSimulationGame(
  '4P: Custom 25 PTS (Dinesh + Master + Merchant + Apprentice)',
  ['Dinesh', 'Bot 2 (Master)', 'Bot 3 (Merchant)', 'Bot 4 (Apprentice)'],
  [{ difficulty: 'grandmaster' }, { difficulty: 'master' }, { difficulty: 'merchant' }, { difficulty: 'apprentice' }],
  180,
  25
);

print('\nALL 3-PLAYER AND 4-PLAYER SIMULATION TESTS PASSED SUCCESSFULLY! (EXIT CODE 0)');
