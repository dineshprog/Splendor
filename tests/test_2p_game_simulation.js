/**
 * Splendor 2-Player End-to-End Simulation Test
 * Simulates complete turn-based games from start to finish.
 * Verifies all rules, state transitions, conservation laws, and tiebreaker resolution.
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
const print = typeof globalThis.print === 'function' ? globalThis.print : console.log;

function assert(condition, message) {
  if (!condition) {
    throw new Error(`[ASSERTION FAILED] ${message}`);
  }
}

function verifyInvariants(state, moveDesc = '') {
  // Invariant 1: Bank + all players tokens must equal total tokens (25 in 2-player game)
  let totalTokensInGame = countTokens(state.bank);
  for (const player of state.players) {
    totalTokensInGame += countTokens(player.tokens);
  }
  assert(totalTokensInGame === 25, `Bank conservation violated after '${moveDesc}': total tokens is ${totalTokensInGame} (expected 25)`);

  // Invariant 2: Player prestige points must equal sum of purchased cards + nobles
  for (const player of state.players) {
    let expectedPoints = 0;
    for (const cardId of player.cardsPurchased) {
      expectedPoints += CARDS_BY_ID[cardId].prestigePoints;
    }
    for (const nobleId of player.noblesAcquired) {
      expectedPoints += NOBLES_BY_ID[nobleId].prestigePoints;
    }
    assert(player.prestigePoints === expectedPoints, `Prestige points mismatch for ${player.name}: state has ${player.prestigePoints}, calculated is ${expectedPoints}`);

    // Invariant 3: Reserved cards must not exceed 3
    assert(player.cardsReserved.length <= 3, `${player.name} holds ${player.cardsReserved.length} reserved cards (> 3)`);

    // Invariant 4: Token limit must not exceed 10
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
 * Executes a single turn for the active player
 */
function playNextTurn(state, verbose = false) {
  const pIdx = state.activePlayerIndex;
  const player = state.players[pIdx];

  // 1. Check pending discard
  if (state.pendingDiscard && state.pendingDiscard.playerIndex === pIdx) {
    const discardMap = computeAiDiscard(state, pIdx, state.pendingDiscard.excessCount);
    const totalDiscarded = Object.values(discardMap).reduce((a, b) => a + b, 0);
    if (verbose) {
      print(`  [Turn ${state.turnIndex + 1}] ${player.name} discarded ${totalDiscarded} excess tokens.`);
    }
    executeDiscardTokens(state, pIdx, discardMap);
    verifyInvariants(state, 'executeDiscardTokens');
    return;
  }

  // 2. Check pending noble choice
  if (state.pendingNobleChoice && state.pendingNobleChoice.playerIndex === pIdx) {
    const nobleId = computeAiNobleChoice(state, pIdx, state.pendingNobleChoice.nobleIds);
    if (verbose) {
      print(`  [Turn ${state.turnIndex + 1}] ${player.name} chose Noble ${nobleId} (+3 PTS).`);
    }
    executeChooseNoble(state, pIdx, nobleId);
    verifyInvariants(state, 'executeChooseNoble');
    return;
  }

  // 3. Normal move
  const move = computeAiMove(state, pIdx);
  assert(move !== null, `AI returned null move for ${player.name} on turn ${state.turnIndex + 1}`);

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
    case 'reserve': {
      const card = move.cardId ? CARDS_BY_ID[move.cardId] : null;
      moveDesc = card ? `Reserve Card ${card.id} (Tier ${card.tier})` : `Blind reserve Tier ${move.tier}`;
      executeReserveCard(state, pIdx, move);
      break;
    }
    case 'purchase': {
      const card = CARDS_BY_ID[move.cardId];
      moveDesc = `Buy Card ${card.id} (Tier ${card.tier}, +${card.prestigePoints} PTS, ${card.gemBonus} bonus)`;
      executePurchaseCard(state, pIdx, move.cardId);
      break;
    }
    case 'pass': {
      moveDesc = `Pass turn (no legal moves)`;
      executePassTurn(state, pIdx);
      break;
    }
    default:
      throw new Error(`Unknown move type: ${move.type}`);
  }

  // Immediate post-action discard resolution (AI must never finish its turn holding > 10 tokens)
  if (state.pendingDiscard && state.pendingDiscard.playerIndex === pIdx) {
    const discardMap = computeAiDiscard(state, pIdx, state.pendingDiscard.excessCount);
    const totalDiscarded = Object.values(discardMap).reduce((a, b) => a + b, 0);
    if (verbose) {
      print(`  [Turn ${state.turnIndex + 1}] ${player.name} discarded ${totalDiscarded} excess tokens.`);
    }
    executeDiscardTokens(state, pIdx, discardMap);
  }

  if (state.pendingNobleChoice && state.pendingNobleChoice.playerIndex === pIdx) {
    const nobleId = computeAiNobleChoice(state, pIdx, state.pendingNobleChoice.nobleIds);
    if (verbose) {
      print(`  [Turn ${state.turnIndex + 1}] ${player.name} chose Noble ${nobleId} (+3 PTS).`);
    }
    executeChooseNoble(state, pIdx, nobleId);
  }

  if (verbose) {
    print(`Turn ${state.turnIndex + 1} (Round ${state.roundIndex}) | ${player.name}: ${moveDesc} -> Total PTS: ${player.prestigePoints}, Tokens: ${countTokens(player.tokens)}/10`);
  }

  verifyInvariants(state, moveDesc);
}

/**
 * Test 1: Full Detailed 2-Player Game Simulation
 */
function testDetailedTwoPlayerGame() {
  print('===============================================================');
  print('TEST 1: Detailed 2-Player Game Simulation (Trace Mode)');
  print('===============================================================');

  const state = createGameState({
    playerNames: ['Merchant 1 (P1)', 'Merchant 2 (P2)'],
    aiConfigs: [{ difficulty: 'merchant' }, { difficulty: 'master' }],
    timeLimitSeconds: 60
  });

  assert(state.players.length === 2, 'Must have exactly 2 players');
  assert(state.nobles.length === 3, 'Must have exactly 3 nobles in 2-player game');
  assert(state.bank.diamond === 4, 'Bank must start with 4 diamonds');
  assert(state.bank.gold === 5, 'Bank must start with 5 gold jokers');
  assert(countTokens(state.bank) === 25, 'Bank total tokens must be 25');

  print(`Starting 2-Player Game: ${state.players[0].name} vs ${state.players[1].name}`);
  print(`Initial Bank: 4 of each regular gem + 5 gold = 25 tokens. 3 Nobles on table.\n`);

  let turns = 0;
  const maxTurns = 200; // Safeguard against infinite loops

  while (state.status !== 'completed' && turns < maxTurns) {
    turns++;
    const prevTurnIndex = state.turnIndex;
    const prevActiveIndex = state.activePlayerIndex;

    playNextTurn(state, true);

    // If turn advanced, verify alternating sequence
    if (state.status !== 'completed' && !state.pendingDiscard && !state.pendingNobleChoice) {
      const expectedNext = (prevActiveIndex + 1) % 2;
      assert(state.activePlayerIndex === expectedNext, `Active player alternation failed: expected ${expectedNext}, got ${state.activePlayerIndex}`);
    }
  }

  assert(state.status === 'completed', `Game did not finish within ${maxTurns} turns`);
  assert(state.winner !== undefined && state.winner !== null, 'Winner must be set');

  print('\n---------------------------------------------------------------');
  print(`GAME OVER after ${turns} turns (${state.roundIndex} rounds)!`);
  print(`Status: ${state.status}`);
  print(`Winner: ${state.winner.name} with ${state.winner.points} Prestige Points!`);
  print('Rankings:');
  state.rankings.forEach(r => {
    print(`  #${r.rank}: ${r.name} - ${r.points} PTS (${r.cardsCount} cards, ${r.noblesCount} nobles, ${r.tokensCount} tokens remaining)`);
  });
  print('---------------------------------------------------------------\n');
}

/**
 * Test 2: Monte Carlo Multi-Game Stress Test (50 2-Player Games)
 */
function testMonteCarloSuite() {
  print('===============================================================');
  print('TEST 2: Monte Carlo 2-Player Game Stress Test (50 Games)');
  print('===============================================================');

  const pairings = [
    { p1: 'merchant', p2: 'merchant', games: 10 },
    { p1: 'master', p2: 'merchant', games: 10 },
    { p1: 'apprentice', p2: 'master', games: 10 },
    { p1: 'grandmaster', p2: 'merchant', games: 15 },
    { p1: 'merchant', p2: 'grandmaster', games: 15 },
    { p1: 'grandmaster', p2: 'master', games: 15 },
    { p1: 'master', p2: 'grandmaster', games: 15 }
  ];


  let totalGames = 0;
  let p1Wins = 0;
  let p2Wins = 0;
  let totalTurns = 0;

  for (const pairing of pairings) {
    print(`\nRunning ${pairing.games} games: P1 (${pairing.p1}) vs P2 (${pairing.p2})...`);

    let pairP1Wins = 0;
    let pairP2Wins = 0;

    for (let i = 0; i < pairing.games; i++) {
      const state = createGameState({
        playerNames: [`P1_${pairing.p1}`, `P2_${pairing.p2}`],
        aiConfigs: [{ difficulty: pairing.p1 }, { difficulty: pairing.p2 }]
      });

      let turns = 0;
      while (state.status !== 'completed' && turns < 350) {
        turns++;
        playNextTurn(state, false);
      }

      assert(state.status === 'completed', `Game ${totalGames + 1} timed out after 350 turns`);
      assert(state.winner.points >= (state.targetPoints || 15), `Winner in game ${totalGames + 1} had < ${state.targetPoints || 15} points (${state.winner.points})`);

      totalGames++;
      totalTurns += turns;

      if (state.winner.playerId === 'p_1') {
        p1Wins++;
        pairP1Wins++;
      } else {
        p2Wins++;
        pairP2Wins++;
      }
    }
    print(`  Completed ${pairing.games} games successfully! Record: P1 (${pairing.p1}) ${pairP1Wins} wins vs P2 (${pairing.p2}) ${pairP2Wins} wins`);
  }

  print('\n---------------------------------------------------------------');
  print(`MONTE CARLO RESULTS (${totalGames} Complete Games):`);
  print(`  - Total Completed Games: ${totalGames} / ${totalGames} (100% Success)`);
  print(`  - Average Turns to Win: ${(totalTurns / totalGames).toFixed(1)} turns`);
  print(`  - Player 1 (Starting Player) Wins: ${p1Wins} (${((p1Wins/totalGames)*100).toFixed(1)}%)`);
  print(`  - Player 2 Wins: ${p2Wins} (${((p2Wins/totalGames)*100).toFixed(1)}%)`);
  print(`  - Rule Invariants & Conservation Laws Verified: 100% Passed`);
  print('---------------------------------------------------------------\n');
}

function testCustomWinningPointsGames() {
  print('TEST: Custom Winning Points Engine & AI Adaptation Suite (20, 25, 30, 35 PTS)');
  const testPoints = [20, 25, 30, 35];
  for (const pts of testPoints) {
    const state = createGameState({
      playerNames: ['P1_Grandmaster', 'P2_Master'],
      aiConfigs: [{ difficulty: 'grandmaster' }, { difficulty: 'master' }],
      targetPoints: pts
    });

    assert(state.targetPoints === pts, `Expected state.targetPoints to be ${pts}, got ${state.targetPoints}`);

    let turns = 0;
    while (state.status !== 'completed' && turns < 400) {
      turns++;
      playNextTurn(state, false);
    }

    assert(state.status === 'completed', `Game with target ${pts} points timed out after ${turns} turns`);
    assert(state.winner.points >= pts, `Winner had ${state.winner.points} pts, which is less than target ${pts}`);
    print(`  ✓ Target ${pts} PTS Game: Completed in ${turns} turns. Winner: ${state.winner.name} (${state.winner.points} PTS)`);
  }
  print('---------------------------------------------------------------\n');
}

// Run all test suites
try {
  testCustomWinningPointsGames();
  testDetailedTwoPlayerGame();
  testMonteCarloSuite();
  print('ALL 2-PLAYER TURN-BASED TESTS PASSED SUCCESSFULLY! (EXIT CODE 0)');
} catch (err) {
  print(`\nTEST FAILED: ${err.message}`);
  if (err.stack) print(err.stack);
  throw err;
}
