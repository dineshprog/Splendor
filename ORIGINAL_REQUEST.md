# Original User Request

## 2026-10-22T15:54:54Z

Verify, debug, and achieve 100% test pass rate across all 30 Super Powers (12 Common Boons, 10 Rare Artifacts, 8 Mythic Wonders) in the Spendor game engine. Ensure feat requirements, passive benefits, instant actions, and end-to-end AI simulation execute without failure.

Working directory: /Users/rasika/Spendor
Integrity mode: development

## Verification Resources

- Test suite file: tests/test_super_powers.js
- Test runner executable: /System/Library/Frameworks/JavaScriptCore.framework/Versions/Current/Helpers/jsc
- Execution command: /System/Library/Frameworks/JavaScriptCore.framework/Versions/Current/Helpers/jsc -m tests/test_super_powers.js

## Requirements

### R1. Super Powers Test Suite Verification & Bug Fixes
Execute tests/test_super_powers.js using the JavaScriptCore module runner. Identify, diagnose, and resolve any assertion failures, logical discrepancies, or unhandled exceptions across all test stages (Catalog integrity, Round 1-5 Arcane Seal, Common Boons, Rare Artifacts, Mythic Wonders, and AI-vs-AI simulation).

### R2. Engine & Super Power Mechanics Consistency
Ensure all 30 Super Power definitions in js/powers-data.js and their corresponding engine mechanics in js/engine.js (such as discount calculations, feat triggers, token and reserve caps, instant effects, and post-action updates) function accurately in according with the game rules and power descriptions.

### R3. Simulation Robustness
Ensure the 200-turn autonomous AI-vs-AI Super Powers simulation completes cleanly with an active winner, validated end state, and appropriate power activations.

## Acceptance Criteria

### Test Suite Execution
- [ ] Running /System/Library/Frameworks/JavaScriptCore.framework/Versions/Current/Helpers/jsc -m tests/test_super_powers.js from /Users/rasika/Spendor exits with status code 0 and zero assertion errors.
- [ ] Catalog Integrity test confirms all 30 powers exist with valid schemas and balanced tier distributions (2 Common, 2 Rare, 1 Mythic drawn per match).
- [ ] Arcane seal test confirms powers remain locked during Rounds 1–5 and unlock at Round 6.
- [ ] All 12 Common Boons pass both condition checks (checkFeat / getFeatProgress) and game effect execution.
- [ ] All 10 Rare Artifacts pass both condition checks and game effect execution (including fountain_of_synergy synergy discount logic).
- [ ] All 8 Mythic Wonders pass both condition checks and game effect execution.
- [ ] The autonomous AI simulation completes with simState.status === 'completed', simState.winner !== null, and simState.powersRevealed === true.

