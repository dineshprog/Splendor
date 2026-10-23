/**
 * Splendor Super Powers Mode Comprehensive Test Suite
 * Executed via JavaScriptCore (jsc -m tests/test_super_powers.js)
 * Tests ALL 30 Super Powers:
 * - 12 Common Boons
 * - 10 Rare Artifacts (including new curses: guild_embargo, sovereign_sanction, vault_lockdown, coinage_mandate, imperial_tithe, espionage_heist, market_freeze)
 * - 8 Mythic Wonders
 * Validates 7-power balanced draw, sealed state, active curses, pure objective modes, and autonomous AI vs AI simulation.
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
  canAffordCard,
  canPlayerBuyCard,
  calculateCardPayment,
  countTokens,
  checkSuperPowerFeats,
  checkAllSuperPowerFeats,
  applySuperPowerPassive,
  executeSuperPowerInstant,
  GAME_MODES
} from '../js/engine.js';
import { POWERS_DATA, drawMatchSuperPowers } from '../js/powers-data.js';
import { CARDS_BY_ID, NOBLES_BY_ID, GEM_COLORS, ALL_TOKENS } from '../js/cards-data.js';
import { computeAiMove, computeAiDiscard } from '../js/ai.js';

function assert(condition, message) {
  if (!condition) {
    throw new Error(`Assertion Failed: ${message}`);
  }
}

print('===============================================================');
print('   SPLENDOR SUPER POWERS TEST SUITE (30 POWERS / 7 MATCH DRAW)');
print('===============================================================\n');

// -----------------------------------------------------------------
// TEST 1: CATALOG INTEGRITY & RANDOM MATCH DRAW
// -----------------------------------------------------------------
print('TEST 1: Verifying Super Powers Catalog Integrity & Balanced 7-Power Draw...');
const powerKeys = Object.keys(POWERS_DATA);
assert(powerKeys.length === 30, `Expected exactly 30 super powers in catalog, found ${powerKeys.length}`);

const commonList = Object.values(POWERS_DATA).filter(p => p.tier === 'common');
const rareList = Object.values(POWERS_DATA).filter(p => p.tier === 'rare');
const mythicList = Object.values(POWERS_DATA).filter(p => p.tier === 'mythic');

assert(commonList.length === 12, `Expected 12 Common powers, found ${commonList.length}`);
assert(rareList.length === 10, `Expected 10 Rare powers, found ${rareList.length}`);
assert(mythicList.length === 8, `Expected 8 Mythic powers, found ${mythicList.length}`);

for (const power of Object.values(POWERS_DATA)) {
  assert(power.id && typeof power.id === 'string', `Power missing valid id: ${power.name}`);
  assert(power.name && typeof power.name === 'string', `Power missing name: ${power.id}`);
  assert(['common', 'rare', 'mythic'].includes(power.tier), `Invalid tier for ${power.id}`);
  assert(['passive', 'instant'].includes(power.type), `Invalid type for ${power.id}`);
  assert(typeof power.checkFeat === 'function', `checkFeat must be a function for ${power.id}`);
  assert(typeof power.getFeatProgress === 'function', `getFeatProgress must be a function for ${power.id}`);
}

// Test 20 balanced draws (3 Common, 2 Rare, 2 Mythic = 7 total)
for (let i = 0; i < 20; i++) {
  const drawn = drawMatchSuperPowers(7);
  assert(drawn.length === 7, `Expected drawn powers to be 7, got ${drawn.length}`);
  const tiers = drawn.map(p => p.tier);
  const commonCount = tiers.filter(t => t === 'common').length;
  const rareCount = tiers.filter(t => t === 'rare').length;
  const mythicCount = tiers.filter(t => t === 'mythic').length;
  assert(commonCount === 3, `Expected 3 Common powers drawn, got ${commonCount}`);
  assert(rareCount === 2, `Expected 2 Rare powers drawn, got ${rareCount}`);
  assert(mythicCount === 2, `Expected 2 Mythic powers drawn, got ${mythicCount}`);

  const ids = drawn.map(p => p.id);
  const uniqueIds = new Set(ids);
  assert(uniqueIds.size === 7, 'Drawn powers must contain 7 distinct powers');
}
print('  ✓ All 30 powers verified & balanced 3-Common / 2-Rare / 2-Mythic draw confirmed.\n');

// -----------------------------------------------------------------
// TEST 2: FIRST 5 ROUNDS SEALED & ROUND 6 UNLOCK
// -----------------------------------------------------------------
print('TEST 2: Verifying Arcane Seal in Rounds 1-5 & Unlock at Round 6...');
const sealState = createGameState({
  playerNames: ['Lorenzo', 'Dinesh'],
  aiConfigs: [null, null],
  gameMode: 'super_powers'
});

assert(sealState.gameMode === 'super_powers', 'Game mode must be super_powers');
assert(sealState.superPowersEnabled === true, 'superPowersEnabled must be true');
assert(Array.isArray(sealState.availablePowers) && sealState.availablePowers.length === 7, 'Must have 7 available powers');
assert(sealState.powersRevealed === false, 'Powers MUST be sealed (powersRevealed = false) at match start');

// Force Midas Crucible into available powers
sealState.availablePowers[0] = {
  ...POWERS_DATA.midas_crucible,
  claimedBy: null
};

// Player 1 gives themselves 4 gold (feat requires 4 gold)
sealState.players[0].tokens.gold = 4;
assert(POWERS_DATA.midas_crucible.checkFeat(sealState, sealState.players[0]) === true, 'Feat requirement is met');

// During round 1, check feats - must NOT unlock because powers are sealed!
checkAllSuperPowerFeats(sealState);
assert(sealState.availablePowers[0].claimedBy === null, 'Power MUST NOT be claimed while sealed in Round 1');
assert(sealState.players[0].powersClaimed.length === 0, 'Player must have 0 claimed powers while sealed');

// Advance turns through rounds 1 to 5
while (sealState.roundIndex < 6) {
  assert(sealState.powersRevealed === false, `Powers must remain sealed in Round ${sealState.roundIndex}`);
  executePassTurn(sealState, sealState.activePlayerIndex);
}

// Now roundIndex === 6!
assert(sealState.roundIndex === 6, 'Should now be Round 6');
assert(sealState.powersRevealed === true, 'Powers MUST be revealed at the start of Round 6!');
assert(sealState.availablePowers[0].claimedBy === 'p_1', 'Midas Crucible should now be unlocked and claimed by Player 1!');
assert(sealState.players[0].powersClaimed.includes('midas_crucible'), 'Player 1 powersClaimed must include midas_crucible');
assert(sealState.players[0].goldPerReserve === 2, 'Midas Crucible passive effect (2 gold per reserve) must be active');
print('  ✓ Sealed arcane state in Rounds 1-5 and automatic shatter at Round 6 verified.\n');

// -----------------------------------------------------------------
// TEST 3: ALL 12 COMMON BOONS (FEAT & EFFECT TESTS)
// -----------------------------------------------------------------
print('TEST 3: Verifying All 12 Common Boons (Feat Checks + Game Effects)...');

// 3.1 Midas Crucible
{
  const p = POWERS_DATA.midas_crucible;
  const st = createGameState({ playerNames: ['P1', 'P2'], gameMode: 'super_powers' });
  st.powersRevealed = true;
  st.players[0].tokens.gold = 3;
  assert(p.checkFeat(st, st.players[0]) === false, 'midas_crucible false at 3 gold');
  st.players[0].tokens.gold = 4;
  assert(p.checkFeat(st, st.players[0]) === true, 'midas_crucible true at 4 gold');

  applySuperPowerPassive(st, 0, 'midas_crucible');
  assert(st.players[0].goldPerReserve === 2, 'goldPerReserve is 2');
  st.players[0].tokens.gold = 0;
  st.bank.gold = 5;
  const cardId = st.tableCards[1][0];
  executeReserveCard(st, 0, { cardId });
  assert(st.players[0].tokens.gold === 2, 'Player received 2 gold on reserve from Midas Crucible');
}

// 3.2 Endless Vault
{
  const p = POWERS_DATA.endless_vault;
  const st = createGameState({ playerNames: ['P1', 'P2'], gameMode: 'super_powers' });
  st.powersRevealed = true;
  st.players[0].tokens = { diamond: 3, sapphire: 3, emerald: 3, ruby: 0, onyx: 0, gold: 0 };
  assert(p.checkFeat(st, st.players[0]) === false, 'endless_vault false at 9 tokens');
  st.players[0].tokens.ruby = 2;
  assert(p.checkFeat(st, st.players[0]) === true, 'endless_vault true with 11 tokens across 4 colors');

  applySuperPowerPassive(st, 0, 'endless_vault');
  assert(st.players[0].vaultLimit === 14, 'vault limit is 14');
}

// 3.3 Double Quarry
{
  const p = POWERS_DATA.double_quarry;
  const st = createGameState({ playerNames: ['P1', 'P2'], gameMode: 'super_powers' });
  st.powersRevealed = true;
  st.players[0].consecutivePairs = 2;
  assert(p.checkFeat(st, st.players[0]) === false, 'double_quarry false at 2 consecutive pairs');
  st.players[0].consecutivePairs = 3;
  assert(p.checkFeat(st, st.players[0]) === true, 'double_quarry true at 3 consecutive pairs');

  applySuperPowerPassive(st, 0, 'double_quarry');
  assert(st.players[0].hasDoubleQuarry === true, 'hasDoubleQuarry is active');
}

// 3.4 Prismatic Harmony
{
  const p = POWERS_DATA.prismatic_harmony;
  const st = createGameState({ playerNames: ['P1', 'P2'], gameMode: 'super_powers' });
  st.powersRevealed = true;
  st.players[0].tokens = { diamond: 2, sapphire: 2, emerald: 2, ruby: 2, onyx: 1, gold: 0 };
  assert(p.checkFeat(st, st.players[0]) === false, 'prismatic_harmony false with 1 onyx');
  st.players[0].tokens.onyx = 2;
  assert(p.checkFeat(st, st.players[0]) === true, 'prismatic_harmony true with 2 of all 5 gems');

  applySuperPowerPassive(st, 0, 'prismatic_harmony');
  assert(st.players[0].hasPrismaticHarmony === true, 'hasPrismaticHarmony active');
}

// 3.5 Noble Envoy
{
  const p = POWERS_DATA.noble_envoy;
  const st = createGameState({ playerNames: ['P1', 'P2'], gameMode: 'super_powers' });
  st.powersRevealed = true;
  st.players[0].cardsPurchased = ['c1', 'c2', 'c3', 'c4', 'c5', 'c6'];
  assert(p.checkFeat(st, st.players[0]) === false, 'noble_envoy false with 6 cards');
  st.players[0].cardsPurchased.push('c7');
  assert(p.checkFeat(st, st.players[0]) === true, 'noble_envoy true with 7 cards & 0 nobles');

  applySuperPowerPassive(st, 0, 'noble_envoy');
  assert(st.players[0].hasNobleEnvoy === true, 'hasNobleEnvoy active');
}

// 3.6 Diamond Cartel
{
  const p = POWERS_DATA.diamond_cartel;
  const st = createGameState({ playerNames: ['P1', 'P2'], gameMode: 'super_powers' });
  st.powersRevealed = true;
  st.players[0].bonuses.diamond = 4;
  assert(p.checkFeat(st, st.players[0]) === false, 'diamond_cartel false with 4 diamonds');
  st.players[0].bonuses.diamond = 5;
  assert(p.checkFeat(st, st.players[0]) === true, 'diamond_cartel true with 5 diamonds');

  applySuperPowerPassive(st, 0, 'diamond_cartel');
  assert(st.players[0].hasDiamondCartel === true, 'hasDiamondCartel active');
}

// 3.7 Smuggler's Warehouse
{
  const p = POWERS_DATA.smugglers_warehouse;
  const st = createGameState({ playerNames: ['P1', 'P2'], gameMode: 'super_powers' });
  st.powersRevealed = true;
  const t1 = Object.keys(CARDS_BY_ID).filter(id => CARDS_BY_ID[id].tier === 1);
  const t2 = Object.keys(CARDS_BY_ID).filter(id => CARDS_BY_ID[id].tier === 2);
  const t3 = Object.keys(CARDS_BY_ID).filter(id => CARDS_BY_ID[id].tier === 3);
  st.players[0].cardsReserved = [t1[0], t1[1], t2[0]];
  assert(p.checkFeat(st, st.players[0]) === false, 'smugglers_warehouse false with 1 T2/T3');
  st.players[0].cardsReserved = [t1[0], t2[0], t3[0]];
  assert(p.checkFeat(st, st.players[0]) === true, 'smugglers_warehouse true with 2 T2/T3');

  applySuperPowerPassive(st, 0, 'smugglers_warehouse');
  assert(st.players[0].reserveLimit === 4, 'reserveLimit is 4');
}

// 3.8 Alchemical Duplication
{
  const p = POWERS_DATA.alchemical_duplication;
  const st = createGameState({ playerNames: ['P1', 'P2'], gameMode: 'super_powers' });
  st.powersRevealed = true;
  st.players[0].consecutivePairs = 1;
  assert(p.checkFeat(st, st.players[0]) === false, 'alchemical_duplication false at 1 consecutive pair');
  st.players[0].consecutivePairs = 2;
  assert(p.checkFeat(st, st.players[0]) === true, 'alchemical_duplication true at 2 consecutive pairs');

  applySuperPowerPassive(st, 0, 'alchemical_duplication');
  assert(st.players[0].hasAlchemicalDuplication === true, 'hasAlchemicalDuplication active');
}

// 3.9 Shadow Siphon
{
  const p = POWERS_DATA.shadow_siphon;
  const st = createGameState({ playerNames: ['P1', 'P2'], gameMode: 'super_powers' });
  st.powersRevealed = true;
  st.players[0].cardsPurchased = ['c1', 'c2', 'c3', 'c4'];
  st.players[0].tokens = { diamond: 1, sapphire: 0, emerald: 0, ruby: 0, onyx: 0, gold: 0 };
  assert(p.checkFeat(st, st.players[0]) === false, 'shadow_siphon false when holding tokens');
  st.players[0].tokens.diamond = 0;
  assert(p.checkFeat(st, st.players[0]) === true, 'shadow_siphon true with 4 cards and 0 tokens');

  applySuperPowerPassive(st, 0, 'shadow_siphon');
  assert(st.players[0].hasShadowSiphon === true, 'hasShadowSiphon active');
}

// 3.10 Bribed Courier
{
  const p = POWERS_DATA.bribed_courier;
  const st = createGameState({ playerNames: ['P1', 'P2'], gameMode: 'super_powers' });
  st.powersRevealed = true;
  st.players[0].totalReservedCount = 1;
  assert(p.checkFeat(st, st.players[0]) === false, 'bribed_courier false with 1 reserved total');
  st.players[0].totalReservedCount = 2;
  assert(p.checkFeat(st, st.players[0]) === true, 'bribed_courier true with 2 reserved total');

  executeSuperPowerInstant(st, 0, 'bribed_courier');
  assert(st.players[0].cardsReserved.length >= 1, 'Reserved top Tier 1 card');
  assert((st.players[0].tokens.gold || 0) >= 2, 'Gained 2 Gold Jokers');
}

// 3.11 Market Interdict (gem_embargo_boon)
{
  const p = POWERS_DATA.gem_embargo_boon;
  const st = createGameState({ playerNames: ['P1', 'P2'], gameMode: 'super_powers' });
  st.powersRevealed = true;
  st.players[0].tokens = { diamond: 3, sapphire: 0, emerald: 0, ruby: 0, onyx: 0, gold: 0 };
  assert(p.checkFeat(st, st.players[0]) === false, 'gem_embargo_boon false with 3 diamonds');
  st.players[0].tokens.diamond = 4;
  assert(p.checkFeat(st, st.players[0]) === true, 'gem_embargo_boon true with 4 diamonds');

  executeSuperPowerInstant(st, 0, 'gem_embargo_boon');
  assert(st.players[1].activeCurses?.gem_embargo?.roundsLeft === 3, 'Opponent cursed with gem_embargo for 3 rounds');
}

// 3.12 Merchant's Resurgence
{
  const p = POWERS_DATA.merchants_resurgence;
  const st = createGameState({ playerNames: ['P1', 'P2'], gameMode: 'super_powers' });
  st.powersRevealed = true;
  st.players[0].cardsPurchased = ['c1', 'c2', 'c3', 'c4', 'c5'];
  st.players[0].cardsReserved = [];
  st.players[0].tokens = { diamond: 0, sapphire: 0, emerald: 0, ruby: 0, onyx: 0, gold: 0 };
  assert(p.checkFeat(st, st.players[0]) === true, 'merchants_resurgence true with 5 cards, 0 res, 0 tokens');

  executeSuperPowerInstant(st, 0, 'merchants_resurgence');
  assert(countTokens(st.players[0].tokens) === 3, 'Gained 3 tokens from bank');
}
print('  ✓ All 12 Common Boons verified with 100% feat & effect fidelity.\n');

// -----------------------------------------------------------------
// TEST 4: ALL 10 RARE ARTIFACTS (FEAT & EFFECT TESTS)
// -----------------------------------------------------------------
print('TEST 4: Verifying All 10 Rare Artifacts (Feat Checks + Game Effects)...');

// 4.1 Guild Embargo
{
  const p = POWERS_DATA.guild_embargo;
  const st = createGameState({ playerNames: ['P1', 'P2'], gameMode: 'super_powers' });
  st.powersRevealed = true;
  st.players[0].bonuses.ruby = 4;
  assert(p.checkFeat(st, st.players[0]) === false, 'guild_embargo false with 4 ruby');
  st.players[0].bonuses.ruby = 5;
  assert(p.checkFeat(st, st.players[0]) === true, 'guild_embargo true with 5 ruby');

  st.players[1].bonuses.diamond = 3;
  executeSuperPowerInstant(st, 0, 'guild_embargo');
  assert(st.players[1].activeCurses?.guild_embargo?.roundsLeft === 5, 'Opponent cursed with guild_embargo for 5 rounds');
  assert(st.players[1].activeCurses?.guild_embargo?.color === 'diamond', 'Diamond discounts blocked');
}

// 4.2 Sovereign Sanctions
{
  const p = POWERS_DATA.sovereign_sanction;
  const st = createGameState({ playerNames: ['P1', 'P2'], gameMode: 'super_powers' });
  st.powersRevealed = true;
  const t3 = Object.keys(CARDS_BY_ID).filter(id => CARDS_BY_ID[id].tier === 3);
  st.players[0].cardsPurchased = [t3[0]];
  assert(p.checkFeat(st, st.players[0]) === false, 'sovereign_sanction false with 1 T3 card');
  st.players[0].cardsPurchased = [t3[0], t3[1]];
  assert(p.checkFeat(st, st.players[0]) === true, 'sovereign_sanction true with 2 T3 cards');

  executeSuperPowerInstant(st, 0, 'sovereign_sanction');
  assert(st.players[1].activeCurses?.sovereign_sanction?.roundsLeft === 5, 'Opponent cursed with sovereign_sanction for 5 rounds');
  assert(canPlayerBuyCard(st, 1, t3[2]) === false, 'Opponent cannot buy Tier 3 card under sovereign sanctions');
}

// 4.3 Vault Lockdown
{
  const p = POWERS_DATA.vault_lockdown;
  const st = createGameState({ playerNames: ['P1', 'P2'], gameMode: 'super_powers' });
  st.powersRevealed = true;
  st.players[0].tokens = { diamond: 5, sapphire: 5, emerald: 0, ruby: 0, onyx: 0, gold: 0 };
  st.players[0].cardsReserved = ['c1'];
  assert(p.checkFeat(st, st.players[0]) === false, 'vault_lockdown false with reserved cards');
  st.players[0].cardsReserved = [];
  assert(p.checkFeat(st, st.players[0]) === true, 'vault_lockdown true with 10 tokens and 0 reserved');

  st.players[1].tokens = { diamond: 5, sapphire: 5, emerald: 0, ruby: 0, onyx: 0, gold: 0 }; // 10 tokens
  applySuperPowerPassive(st, 0, 'vault_lockdown');
  assert(st.players[1].vaultLimit === 7, 'Opponent vault slashed to 7');
  assert(countTokens(st.players[1].tokens) === 7, 'Opponent discarded down to 7 tokens');
}

// 4.4 Coinage Mandate
{
  const p = POWERS_DATA.coinage_mandate;
  const st = createGameState({ playerNames: ['P1', 'P2'], gameMode: 'super_powers' });
  st.powersRevealed = true;
  st.players[0].cardsPurchased = ['c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'c7'];
  st.players[0].tokens.gold = 0;
  assert(p.checkFeat(st, st.players[0]) === false, 'coinage_mandate false with 7 cards');
  st.players[0].cardsPurchased.push('c8');
  assert(p.checkFeat(st, st.players[0]) === true, 'coinage_mandate true with 8 cards & 0 gold');

  executeSuperPowerInstant(st, 0, 'coinage_mandate');
  assert(st.players[1].activeCurses?.coinage_mandate?.roundsLeft === 3, 'Coinage mandate active for 3 rounds');
}

// 4.5 Imperial Tithe
{
  const p = POWERS_DATA.imperial_tithe;
  const st = createGameState({ playerNames: ['P1', 'P2'], gameMode: 'super_powers' });
  st.powersRevealed = true;
  st.players[0].hasSpentFourSameColorSingleBuy = false;
  assert(p.checkFeat(st, st.players[0]) === false, 'imperial_tithe false before spend');
  st.players[0].hasSpentFourSameColorSingleBuy = true;
  assert(p.checkFeat(st, st.players[0]) === true, 'imperial_tithe true after spending 4 same gem');

  executeSuperPowerInstant(st, 0, 'imperial_tithe');
  assert(st.players[1].activeCurses?.imperial_tithe?.chargesLeft === 3, 'Imperial tithe has 3 charges');
}

// 4.6 Inverted Economy
{
  const p = POWERS_DATA.inverted_economy;
  const st = createGameState({ playerNames: ['P1', 'P2'], gameMode: 'super_powers' });
  st.powersRevealed = true;
  const t2 = Object.keys(CARDS_BY_ID).filter(id => CARDS_BY_ID[id].tier === 2);
  st.players[0].cardsPurchased = [t2[0], t2[1], t2[2]];
  assert(p.checkFeat(st, st.players[0]) === false, 'inverted_economy false with 3 T2');
  st.players[0].cardsPurchased.push(t2[3]);
  assert(p.checkFeat(st, st.players[0]) === true, 'inverted_economy true with 4 T2');

  applySuperPowerPassive(st, 0, 'inverted_economy');
  assert(st.players[0].hasInvertedEconomy === true, 'hasInvertedEconomy active');
}

// 4.7 Aristocrat's Heist
{
  const p = POWERS_DATA.aristocrats_heist;
  const st = createGameState({ playerNames: ['P1', 'P2'], gameMode: 'super_powers' });
  st.powersRevealed = true;
  st.players[0].bonuses = { diamond: 3, sapphire: 3, emerald: 3, ruby: 2, onyx: 0 };
  assert(p.checkFeat(st, st.players[0]) === false, 'aristocrats_heist false with 11 bonuses');
  st.players[0].bonuses.ruby = 3;
  assert(p.checkFeat(st, st.players[0]) === true, 'aristocrats_heist true with 12 bonuses');

  const initialNobles = st.nobles.length;
  executeSuperPowerInstant(st, 0, 'aristocrats_heist');
  assert(st.nobles.length === initialNobles - 1, 'One noble claimed from table');
  assert(st.players[0].noblesAcquired.length === 1, 'Player acquired noble');
}

// 4.8 Black Market Master
{
  const p = POWERS_DATA.black_market_master;
  const st = createGameState({ playerNames: ['P1', 'P2'], gameMode: 'super_powers' });
  st.powersRevealed = true;
  st.players[0].maxGoldSpentSingleCard = 2;
  assert(p.checkFeat(st, st.players[0]) === false, 'black_market_master false at 2 gold');
  st.players[0].maxGoldSpentSingleCard = 3;
  assert(p.checkFeat(st, st.players[0]) === true, 'black_market_master true at 3 gold');

  applySuperPowerPassive(st, 0, 'black_market_master');
  assert(st.players[0].hasBlackMarket === true, 'hasBlackMarket active');
}

// 4.9 Espionage Heist
{
  const p = POWERS_DATA.espionage_heist;
  const st = createGameState({ playerNames: ['P1', 'P2'], gameMode: 'super_powers' });
  st.powersRevealed = true;
  st.players[0].cardsReserved = ['c1', 'c2'];
  assert(p.checkFeat(st, st.players[0]) === false, 'espionage_heist false with 2 reserved');
  st.players[0].cardsReserved.push('c3');
  assert(p.checkFeat(st, st.players[0]) === true, 'espionage_heist true with 3 reserved');

  st.players[0].cardsReserved = [];
  st.players[1].cardsReserved = ['stolen_card_1'];
  executeSuperPowerInstant(st, 0, 'espionage_heist');
  assert(st.players[1].cardsReserved.length === 0, 'Opponent lost reserved card');
  assert(st.players[0].cardsReserved.includes('stolen_card_1'), 'Player stole opponent reserved card');
}

// 4.10 Market Freeze
{
  const p = POWERS_DATA.market_freeze;
  const st = createGameState({ playerNames: ['P1', 'P2'], gameMode: 'super_powers' });
  st.powersRevealed = true;
  st.players[0].reservedPurchasedCount = 2;
  assert(p.checkFeat(st, st.players[0]) === false, 'market_freeze false at 2 reserved buys');
  st.players[0].reservedPurchasedCount = 3;
  assert(p.checkFeat(st, st.players[0]) === true, 'market_freeze true at 3 reserved buys');

  executeSuperPowerInstant(st, 0, 'market_freeze');
  assert(st.marketFreezeRounds === 3, 'Market frozen for 3 rounds');
  const tableCard = st.tableCards[1][0];
  assert(canPlayerBuyCard(st, 0, tableCard) === false, 'Table card cannot be purchased during market freeze');
}
print('  ✓ All 10 Rare Artifacts verified with 100% feat & effect fidelity.\n');

// -----------------------------------------------------------------
// TEST 5: ALL 8 MYTHIC WONDERS (FEAT & EFFECT TESTS)
// -----------------------------------------------------------------
print('TEST 5: Verifying All 8 Mythic Wonders (Feat Checks + Game Effects)...');

// 5.1 Chronos Hourglass
{
  const p = POWERS_DATA.chronos_hourglass;
  const st = createGameState({ playerNames: ['P1', 'P2'], gameMode: 'super_powers' });
  st.powersRevealed = true;
  st.players[0].consecutiveNoGoldPurchases = 1;
  assert(p.checkFeat(st, st.players[0]) === false, 'chronos_hourglass false at 1 buy');
  st.players[0].consecutiveNoGoldPurchases = 2;
  assert(p.checkFeat(st, st.players[0]) === true, 'chronos_hourglass true at 2 consecutive pure buys');

  executeSuperPowerInstant(st, 0, 'chronos_hourglass');
  assert(st.extraTurnsPlayerId === 'p_1', 'extraTurnsPlayerId set');
  assert(st.extraTurnsRemaining === 2, '2 extra turns remaining (3 consecutive turns total)');
}

// 5.2 Royal Usurpation
{
  const p = POWERS_DATA.royal_usurpation;
  const st = createGameState({ playerNames: ['P1', 'P2'], gameMode: 'super_powers' });
  st.powersRevealed = true;
  const t3 = Object.keys(CARDS_BY_ID).filter(id => CARDS_BY_ID[id].tier === 3);
  st.players[0].cardsPurchased = [t3[0], t3[1], t3[2]];
  st.players[1].noblesAcquired = [st.nobles[0]];
  assert(p.checkFeat(st, st.players[0]) === true, 'royal_usurpation true with 3 T3 and opponent noble');

  st.players[1].prestigePoints = 6;
  st.players[0].prestigePoints = 0;
  executeSuperPowerInstant(st, 0, 'royal_usurpation');
  assert(st.players[0].noblesAcquired.length === 1, 'Player stole noble');
  assert(st.players[0].prestigePoints === 3, 'Player gained +3 pts');
  assert(st.players[1].prestigePoints === 3, 'Opponent lost -3 pts');
}

// 5.3 Grand Inquisitor
{
  const p = POWERS_DATA.grand_inquisitor;
  const st = createGameState({ playerNames: ['P1', 'P2'], gameMode: 'super_powers' });
  st.powersRevealed = true;
  const t3 = Object.keys(CARDS_BY_ID).filter(id => CARDS_BY_ID[id].tier === 3);
  st.players[0].cardsPurchased = [t3[0], t3[1]];
  st.players[0].noblesAcquired = [st.nobles[0]];
  assert(p.checkFeat(st, st.players[0]) === true, 'grand_inquisitor true with 2 T3 cards & 1 noble');

  st.players[1].prestigePoints = 8;
  st.players[0].prestigePoints = 2;
  executeSuperPowerInstant(st, 0, 'grand_inquisitor');
  assert(st.players[1].prestigePoints === 3, 'Opponent lost 5 points');
  assert(st.players[0].prestigePoints === 4, 'Player gained +2 points');
}

// 5.4 Philosopher's Magnum Opus
{
  const p = POWERS_DATA.philosophers_magnum_opus;
  const st = createGameState({ playerNames: ['P1', 'P2'], gameMode: 'super_powers' });
  st.powersRevealed = true;
  st.players[0].tokens.gold = 4;
  assert(p.checkFeat(st, st.players[0]) === false, 'philosophers_magnum_opus false at 4 gold');
  st.players[0].tokens.gold = 5;
  assert(p.checkFeat(st, st.players[0]) === true, 'philosophers_magnum_opus true at 5 gold');

  executeSuperPowerInstant(st, 0, 'philosophers_magnum_opus');
  assert(st.players[0].tokens.gold === 0, 'Gold surrendered to bank');
  assert(st.players[0].wildBonuses === 5, '5 permanent wildcard discounts active');
}

// 5.5 Market Cataclysm
{
  const p = POWERS_DATA.market_cataclysm;
  const st = createGameState({ playerNames: ['P1', 'P2'], gameMode: 'super_powers' });
  st.powersRevealed = true;
  st.players[0].cardsPurchased = new Array(13).fill('dummy');
  assert(p.checkFeat(st, st.players[0]) === false, 'market_cataclysm false at 13 cards');
  st.players[0].cardsPurchased.push('dummy14');
  assert(p.checkFeat(st, st.players[0]) === true, 'market_cataclysm true at 14 cards');

  executeSuperPowerInstant(st, 0, 'market_cataclysm');
  assert(st.players[0].cardsPurchased.length === 15, 'Free Tier 3 card added');
}

// 5.6 Dynastic Hegemony
{
  const p = POWERS_DATA.dynastic_hegemony;
  const st = createGameState({ playerNames: ['P1', 'P2'], gameMode: 'super_powers' });
  st.powersRevealed = true;
  st.players[0].bonuses = { diamond: 3, sapphire: 3, emerald: 3, ruby: 3, onyx: 2 };
  assert(p.checkFeat(st, st.players[0]) === false, 'dynastic_hegemony false with 2 onyx');
  st.players[0].bonuses.onyx = 3;
  assert(p.checkFeat(st, st.players[0]) === true, 'dynastic_hegemony true with 3 of each color');

  applySuperPowerPassive(st, 0, 'dynastic_hegemony');
  assert(st.players[0].targetPointsOverride === 12, 'Winning threshold reduced to 12 points');
}

// 5.7 Bankrupting Curse
{
  const p = POWERS_DATA.bankrupting_curse;
  const st = createGameState({ playerNames: ['P1', 'P2'], gameMode: 'super_powers' });
  st.powersRevealed = true;
  st.players[0].hasBoughtFivePointTier3WithZeroGold = false;
  assert(p.checkFeat(st, st.players[0]) === false, 'bankrupting_curse false before pure 5pt buy');
  st.players[0].hasBoughtFivePointTier3WithZeroGold = true;
  assert(p.checkFeat(st, st.players[0]) === true, 'bankrupting_curse true after pure 5pt buy');

  st.players[1].tokens = { diamond: 2, sapphire: 2, emerald: 2, ruby: 1, onyx: 1, gold: 2 };
  executeSuperPowerInstant(st, 0, 'bankrupting_curse');
  assert(countTokens(st.players[1].tokens) === 0, 'Opponent completely stripped of tokens');
}

// 5.8 Emperor's Regalia
{
  const p = POWERS_DATA.emperors_regalia;
  const st = createGameState({ playerNames: ['P1', 'P2'], gameMode: 'super_powers' });
  st.powersRevealed = true;
  st.players[0].prestigePoints = 13;
  st.players[0].noblesAcquired = [];
  assert(p.checkFeat(st, st.players[0]) === false, 'emperors_regalia false at 13 pts');
  st.players[0].prestigePoints = 14;
  assert(p.checkFeat(st, st.players[0]) === true, 'emperors_regalia true at 14 pts with 0 nobles');

  const totalNoblesOnBoard = st.nobles.length;
  executeSuperPowerInstant(st, 0, 'emperors_regalia');
  assert(st.nobles.length === 0, 'All table nobles recruited');
  assert(st.players[0].noblesAcquired.length === totalNoblesOnBoard, 'Player claimed all nobles');
}
print('  ✓ All 8 Mythic Wonders verified with 100% feat & effect fidelity.\n');

// -----------------------------------------------------------------
// TEST 6: PURE OBJECTIVE MODES & SUPER POWERS TOGGLE
// -----------------------------------------------------------------
print('TEST 6: Verifying Pure Objective Modes & Universal Super Powers Toggle...');

// 6.1 Super Powers Enabled in Classic Mode via Toggle
{
  const st = createGameState({
    playerNames: ['P1', 'P2'],
    gameMode: 'classic',
    enableSuperPowers: true
  });
  assert(st.gameMode === 'classic', 'Game mode is classic');
  assert(st.superPowersEnabled === true, 'superPowersEnabled is true via toggle');
  assert(st.availablePowers.length === 7, '7 super powers drawn for classic mode');
  print('    ✓ Super Powers toggle cleanly activates powers in Classic mode');
}

// 6.2 Pure Objective Mode (Onyx Syndicate) Does NOT End on 15 Points
{
  const st = createGameState({
    playerNames: ['P1', 'P2'],
    gameMode: 'onyx_syndicate'
  });
  st.players[0].prestigePoints = 14;
  st.players[0].bonuses.onyx = 3;

  // Find a card worth 3 points that is NOT onyx
  const rubyCardId = Object.keys(CARDS_BY_ID).find(id => CARDS_BY_ID[id].gemBonus === 'ruby' && CARDS_BY_ID[id].prestigePoints >= 3);
  st.tableCards[2][0] = rubyCardId;
  const card = CARDS_BY_ID[rubyCardId];
  for (const c of GEM_COLORS) st.players[0].tokens[c] = card.cost[c] || 0;

  executePurchaseCard(st, 0, rubyCardId);
  assert(st.players[0].prestigePoints >= 17, `Player has ${st.players[0].prestigePoints} points (above 15)`);
  assert(st.status === 'in_progress', 'Pure objective mode MUST NOT end game on prestige points!');
  print('    ✓ Onyx Syndicate ignores 15 prestige points threshold (pure objective victory only)');
}

// 6.3 Pure Objective Mode (Color Supremacy) Does NOT End on 15 Points
{
  const st = createGameState({
    playerNames: ['P1', 'P2'],
    gameMode: 'color_supremacy'
  });
  st.players[0].prestigePoints = 14;
  st.players[0].trophies = 1;

  const cardId = Object.keys(CARDS_BY_ID).find(id => CARDS_BY_ID[id].prestigePoints >= 3);
  st.tableCards[2][0] = cardId;
  const card = CARDS_BY_ID[cardId];
  for (const c of GEM_COLORS) st.players[0].tokens[c] = card.cost[c] || 0;

  executePurchaseCard(st, 0, cardId);
  assert(st.players[0].prestigePoints >= 17, 'Player has 17+ points');
  assert(st.status === 'in_progress', 'Color Supremacy MUST NOT end game on prestige points!');
  print('    ✓ Color Supremacy ignores prestige points threshold');
}

// 6.4 Pure Objective Mode (Noble Court) Does NOT End on 15 Points
{
  const st = createGameState({
    playerNames: ['P1', 'P2'],
    gameMode: 'noble_court'
  });
  st.players[0].prestigePoints = 14;
  st.players[0].noblesAcquired = ['n1']; // 1 noble

  const cardId = Object.keys(CARDS_BY_ID).find(id => CARDS_BY_ID[id].prestigePoints >= 3);
  st.tableCards[2][0] = cardId;
  const card = CARDS_BY_ID[cardId];
  for (const c of GEM_COLORS) st.players[0].tokens[c] = card.cost[c] || 0;

  executePurchaseCard(st, 0, cardId);
  assert(st.players[0].prestigePoints >= 17, 'Player has 17+ points');
  assert(st.status === 'in_progress', 'Noble Court MUST NOT end game on prestige points without 3 nobles!');
  print('    ✓ Noble Court ignores prestige points threshold');
}

// 6.5 Pure Objective Mode (Rainbow Guild) Does NOT End on 15 Points
{
  const st = createGameState({
    playerNames: ['P1', 'P2'],
    gameMode: 'rainbow_guild'
  });
  st.players[0].prestigePoints = 14;
  st.players[0].bonuses = { diamond: 2, sapphire: 2, emerald: 2, ruby: 2, onyx: 2 };

  const cardId = Object.keys(CARDS_BY_ID).find(id => CARDS_BY_ID[id].prestigePoints >= 3);
  st.tableCards[2][0] = cardId;
  const card = CARDS_BY_ID[cardId];
  for (const c of GEM_COLORS) st.players[0].tokens[c] = card.cost[c] || 0;

  executePurchaseCard(st, 0, cardId);
  assert(st.players[0].prestigePoints >= 17, 'Player has 17+ points');
  assert(st.status === 'in_progress', 'Rainbow Guild MUST NOT end game on prestige points without 3 of all colors!');
  print('    ✓ Renaissance Prism ignores prestige points threshold');
}

print('  ✓ All pure objective modes and toggle configurations verified.\n');

// -----------------------------------------------------------------
// TEST 7: END-TO-END AUTONOMOUS SIMULATION (AI VS AI)
// -----------------------------------------------------------------
print('TEST 7: Running End-to-End Autonomous AI vs AI Match in Super Powers Mode...');
const simState = createGameState({
  playerNames: ['Master Bot', 'Grandmaster Dinesh'],
  aiConfigs: [{ difficulty: 'master' }, { difficulty: 'grandmaster' }],
  targetPoints: 15,
  gameMode: 'super_powers'
});

let turnsCount = 0;
const MAX_TURNS = 200;

while (simState.status !== 'completed' && turnsCount < MAX_TURNS) {
  const activeIdx = simState.activePlayerIndex;

  // Resolve pending discard if any
  if (simState.pendingDiscard && simState.pendingDiscard.playerIndex === activeIdx) {
    const discardMap = computeAiDiscard(simState, activeIdx, simState.pendingDiscard.excessCount);
    executeDiscardTokens(simState, activeIdx, discardMap);
    turnsCount++;
    continue;
  }

  // Resolve pending noble choice if any
  if (simState.pendingNobleChoice && simState.pendingNobleChoice.playerIndex === activeIdx) {
    executeChooseNoble(simState, activeIdx, simState.pendingNobleChoice.nobleIds[0]);
    turnsCount++;
    continue;
  }

  // AI Move
  const move = computeAiMove(simState, activeIdx);
  if (!move) {
    executePassTurn(simState, activeIdx);
  } else {
    switch (move.type) {
      case 'purchase':
        executePurchaseCard(simState, activeIdx, move.cardId, { sabotage: move.sabotage, sabotageTargetName: move.sabotageTargetName });
        break;
      case 'reserve':
        executeReserveCard(simState, activeIdx, {
          cardId: move.cardId,
          tier: move.tier,
          fromDeck: move.fromDeck,
          sabotage: move.sabotage
        });
        break;
      case 'take_distinct':
        executeTakeDistinctTokens(simState, activeIdx, move.colors);
        break;
      case 'take_pair':
        executeTakePairTokens(simState, activeIdx, move.color);
        break;
      default:
        executePassTurn(simState, activeIdx);
    }
  }

  turnsCount++;
}

assert(simState.status === 'completed', `Simulation failed to complete within ${MAX_TURNS} turns (Round: ${simState.roundIndex}, P1: ${simState.players[0].prestigePoints} pts, P2: ${simState.players[1].prestigePoints} pts, Status: ${simState.status})`);
assert(simState.winner !== null, 'Game completed but winner is null');
assert(simState.roundIndex >= 6, 'Game should have naturally progressed past Round 6');
assert(simState.powersRevealed === true, 'Powers must have been revealed during match');

const totalPowersClaimed = simState.players.reduce((sum, p) => sum + (p.powersClaimed || []).length, 0);
assert(Array.isArray(simState.unlockedPowerEvents), 'simState.unlockedPowerEvents should be an array');
assert(simState.unlockedPowerEvents.length === totalPowersClaimed,
  `Expected unlockedPowerEvents count (${simState.unlockedPowerEvents.length}) to match total powers claimed (${totalPowersClaimed})`);
for (const ev of simState.unlockedPowerEvents) {
  assert(ev.powerId && ev.playerId && typeof ev.playerIndex === 'number', `Invalid unlock event payload: ${JSON.stringify(ev)}`);
}
print(`  ✓ Match completed in ${turnsCount} turns (${simState.roundIndex} rounds).`);
print(`  ✓ Winner: ${simState.winner.name} (${simState.winner.points} pts, ${simState.winner.cardsCount} cards).`);
print(`  ✓ Super Powers claimed during match: ${totalPowersClaimed}/7.`);
print(`  ✓ Super Power unlock event stream verified with ${simState.unlockedPowerEvents.length} sequential celebration events.`);

print('\n===============================================================');
print('   ALL SUPER POWERS TESTS PASSED SUCCESSFULLY! (EXIT CODE 0) ');
print('===============================================================');
