/**
 * Splendor Game Modes Test Suite
 * Validates all 6 dynamic game modes:
 * 1. Classic Splendor
 * 2. Shadow Syndicate (Collect 10 Black Cards)
 * 3. Guild Ladder (Tier Lock: 6 T1 for T2, 6 T2 for T3)
 * 4. Color Monopoly (First to 5 in a color = 1 pt, first to 3 pts wins)
 * 5. Noble Court (First to 3 Nobles)
 * 6. Renaissance Prism (At least 3 cards in all 5 colors)
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
  validatePurchaseCard,
  canPlayerBuyCard,
  countTokens,
  GAME_MODES
} from '../js/engine.js';
import { CARDS_BY_ID, NOBLES_BY_ID, GEM_COLORS } from '../js/cards-data.js';
import { computeAiMove, computeAiDiscard, computeAiNobleChoice } from '../js/ai.js';

function assert(condition, message) {
  if (!condition) {
    throw new Error(`[ASSERTION FAILED] ${message}`);
  }
}

const log = (typeof print === 'function') ? print : (typeof console !== 'undefined' && console.log ? console.log : () => {});

function playNextTurn(state) {
  const pIdx = state.activePlayerIndex;
  const move = computeAiMove(state, pIdx);

  switch (move.type) {
    case 'purchase':
      executePurchaseCard(state, pIdx, move.cardId, { sabotage: move.sabotage, sabotageTargetName: move.sabotageTargetName });
      break;
    case 'take_pair':
      executeTakePairTokens(state, pIdx, move.color);
      break;
    case 'take_distinct':
      executeTakeDistinctTokens(state, pIdx, move.colors);
      break;
    case 'reserve':
      executeReserveCard(state, pIdx, { cardId: move.cardId, tier: move.tier, fromDeck: move.fromDeck, sabotage: move.sabotage });
      break;
    case 'pass':
      executePassTurn(state, pIdx);
      break;
    default:
      throw new Error(`Unknown move type: ${move.type}`);
  }

  // Handle immediate post-action decisions
  if (state.pendingDiscard && state.pendingDiscard.playerIndex === pIdx) {
    const discardMap = computeAiDiscard(state, pIdx, state.pendingDiscard.excessCount);
    executeDiscardTokens(state, pIdx, discardMap);
  }

  if (state.pendingNobleChoice && state.pendingNobleChoice.playerIndex === pIdx) {
    const nobleId = computeAiNobleChoice(state, pIdx, state.pendingNobleChoice.nobleIds);
    executeChooseNoble(state, pIdx, nobleId);
  }
}

// ----------------------------------------------------------------------------
// TEST 1: Metadata & Engine Registration
// ----------------------------------------------------------------------------
function testGameModesMetadata() {
  log('TEST 1: Verifying GAME_MODES Metadata & Initialization');
  const expectedModes = ['classic', 'onyx_syndicate', 'tier_ladder', 'color_supremacy', 'noble_court', 'rainbow_guild'];
  for (const m of expectedModes) {
    assert(GAME_MODES[m] !== undefined, `Missing mode definition for: ${m}`);
    assert(typeof GAME_MODES[m].name === 'string', `Mode ${m} missing name`);
    assert(typeof GAME_MODES[m].badge === 'string', `Mode ${m} missing badge`);
  }

  const state = createGameState({ gameMode: 'tier_ladder' });
  assert(state.gameMode === 'tier_ladder', `Expected gameMode 'tier_ladder', got '${state.gameMode}'`);
  log('  ✓ All 6 game modes registered in engine successfully.');
}

// ----------------------------------------------------------------------------
// TEST 2: Guild Ladder Rule Validation
// ----------------------------------------------------------------------------
function testTierLadderRules() {
  log('TEST 2: Guild Ladder (Tier Lock) Rule Validation');
  const state = createGameState({ gameMode: 'tier_ladder' });
  const p1 = state.players[0];

  // Give p1 enough tokens to afford anything
  p1.tokens = { diamond: 10, sapphire: 10, emerald: 10, ruby: 10, onyx: 10, gold: 5 };

  // Find a Tier 1, Tier 2, and Tier 3 card
  const t1CardId = state.tableCards[1].find(c => c !== null);
  const t2CardId = state.tableCards[2].find(c => c !== null);
  const t3CardId = state.tableCards[3].find(c => c !== null);

  assert(t1CardId && t2CardId && t3CardId, 'Board must have cards of each tier');

  // Initial state: p1 has 0 Tier 1 cards
  const canBuyT1 = validatePurchaseCard(state, 0, t1CardId);
  assert(canBuyT1.valid, 'Player should be able to purchase Tier 1 card');

  const canBuyT2_Blocked = validatePurchaseCard(state, 0, t2CardId);
  assert(!canBuyT2_Blocked.valid, 'Tier 2 purchase must be blocked when player has < 6 Tier 1 cards');
  assert(canBuyT2_Blocked.error.includes('Guild Ladder'), `Expected Guild Ladder error, got: ${canBuyT2_Blocked.error}`);
  assert(!canPlayerBuyCard(state, 0, t2CardId), 'canPlayerBuyCard must return false for locked Tier 2 card');

  const canBuyT3_Blocked = validatePurchaseCard(state, 0, t3CardId);
  assert(!canBuyT3_Blocked.valid, 'Tier 3 purchase must be blocked when player has < 6 Tier 2 cards');
  assert(!canPlayerBuyCard(state, 0, t3CardId), 'canPlayerBuyCard must return false for locked Tier 3 card');

  // Now simulate player having 6 Tier 1 cards
  p1.cardsPurchased = [
    't1_d_1', 't1_d_2', 't1_d_3', 't1_d_4', 't1_d_5', 't1_d_6'
  ];

  const canBuyT2_Unlocked = validatePurchaseCard(state, 0, t2CardId);
  assert(canBuyT2_Unlocked.valid, 'Tier 2 purchase must be unlocked once player has 6 Tier 1 cards');
  assert(canPlayerBuyCard(state, 0, t2CardId), 'canPlayerBuyCard must return true once 6 Tier 1 cards owned');

  // Tier 3 should still be blocked (needs 6 Tier 2 cards)
  const canBuyT3_StillBlocked = validatePurchaseCard(state, 0, t3CardId);
  assert(!canBuyT3_StillBlocked.valid, 'Tier 3 must remain blocked until 6 Tier 2 cards owned');

  // Add 6 Tier 2 cards
  p1.cardsPurchased.push('t2_d_1', 't2_d_2', 't2_d_3', 't2_d_4', 't2_d_5', 't2_d_6');
  const canBuyT3_Unlocked = validatePurchaseCard(state, 0, t3CardId);
  assert(canBuyT3_Unlocked.valid, 'Tier 3 purchase must be unlocked once player has 6 Tier 2 cards');
  log('  ✓ Guild Ladder strict gating (6 T1 → T2, 6 T2 → T3) verified 100% compliant.');
}

// ----------------------------------------------------------------------------
// TEST 3: Color Monopoly Trophy Claiming
// ----------------------------------------------------------------------------
function testColorMonopolyMechanics() {
  log('TEST 3: Color Monopoly Trophy Claiming & Win Mechanics');
  const state = createGameState({ gameMode: 'color_supremacy' });
  const p1 = state.players[0];

  assert(state.colorTrophies.ruby === null, 'Ruby trophy must initially be unallocated');
  assert(p1.trophies === 0, 'Initial trophies must be 0');

  // Give p1 4 ruby bonuses, then purchase 5th ruby card
  p1.bonuses.ruby = 4;
  p1.tokens = { diamond: 10, sapphire: 10, emerald: 10, ruby: 10, onyx: 10, gold: 5 };

  // Pick a ruby card on board or inject one
  const rubyCardId = 't1_r_1'; // ruby bonus
  state.tableCards[1][0] = rubyCardId;

  executePurchaseCard(state, 0, rubyCardId);
  assert(p1.bonuses.ruby === 5, 'Ruby bonus should now be 5');
  assert(state.colorTrophies.ruby === p1.id, 'Ruby trophy must be assigned to p1');
  assert(p1.trophies === 1, `Expected p1 trophies to be 1, got ${p1.trophies}`);

  // Test that second player reaching 5 rubies does NOT steal trophy
  const p2 = state.players[1];
  p2.bonuses.ruby = 4;
  p2.tokens = { diamond: 10, sapphire: 10, emerald: 10, ruby: 10, onyx: 10, gold: 5 };
  const rubyCardId2 = 't1_r_2';
  state.tableCards[1][1] = rubyCardId2;
  state.activePlayerIndex = 1;

  executePurchaseCard(state, 1, rubyCardId2);
  assert(p2.bonuses.ruby === 5, 'p2 ruby bonus is 5');
  assert(state.colorTrophies.ruby === p1.id, 'p1 must retain ruby trophy (first to 5)');
  assert(p2.trophies === 0, 'p2 must not receive already-claimed trophy');

  log('  ✓ Color Monopoly trophy racing & first-to-claim mechanics verified.');
}

// ----------------------------------------------------------------------------
// TEST 4: Full Simulation of All 6 Game Modes with AI
// ----------------------------------------------------------------------------
function testFullGameSimulations() {
  log('\nTEST 4: End-to-End Autonomous Simulation Across All 6 Game Modes');
  const modes = [
    'classic',
    'onyx_syndicate',
    'tier_ladder',
    'color_supremacy',
    'noble_court',
    'rainbow_guild'
  ];

  for (const mode of modes) {
    const state = createGameState({
      gameMode: mode,
      playerNames: ['Dinesh (Grandmaster)', 'Master Bot'],
      aiConfigs: [{ difficulty: 'grandmaster' }, { difficulty: 'master' }],
      targetPoints: 15
    });

    let turns = 0;
    while (state.status !== 'completed' && turns < 300) {
      turns++;
      playNextTurn(state);
    }

    assert(state.status === 'completed', `Game mode ${mode} timed out after ${turns} turns!`);
    assert(state.winner !== null, `Game mode ${mode} finished without declaring a winner`);

    const winInfo = state.rankings[0];
    log(`  ✓ Mode '${mode}': Completed in ${turns} turns (${state.roundIndex} rounds). Winner: ${winInfo.name} (${winInfo.points} pts, ${winInfo.cardsCount} cards)`);
  }
}

// Execute suite
try {
  testGameModesMetadata();
  testTierLadderRules();
  testColorMonopolyMechanics();
  testFullGameSimulations();
  log('\nALL 6 GAME MODES TESTS PASSED SUCCESSFULLY! (EXIT CODE 0)');
} catch (err) {
  log(`\nTEST FAILED: ${err.message}`);
  if (err.stack) log(err.stack);
  throw err;
}
