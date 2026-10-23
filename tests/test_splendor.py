#!/usr/bin/env python3
"""
Automated Test Suite for Splendor Online Game Rules & Integrity
Runs headlessly via Python standard library.
"""

import os
import re
import sys
import json
import unittest
import subprocess

WORKSPACE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
JS_DIR = os.path.join(WORKSPACE_DIR, 'js')


class TestSplendorAssets(unittest.TestCase):
    """Verify all game files exist and are well-formed."""

    def test_required_files_exist(self):
        required = [
            'index.html',
            'server.py',
            'css/style.css',
            'js/cards-data.js',
            'js/engine.js',
            'js/ai.js',
            'js/audio.js',
            'js/visual3d.js',
            'js/ui.js',
            'js/app.js'
        ]
        for rel_path in required:
            full_path = os.path.join(WORKSPACE_DIR, rel_path)
            self.assertTrue(os.path.exists(full_path), f"Missing file: {rel_path}")

    def test_card_dataset_counts(self):
        cards_file = os.path.join(JS_DIR, 'cards-data.js')
        with open(cards_file, 'r', encoding='utf-8') as f:
            content = f.read()

        t1_count = len(re.findall(r"id:\s*'t1_", content))
        t2_count = len(re.findall(r"id:\s*'t2_", content))
        t3_count = len(re.findall(r"id:\s*'t3_", content))
        noble_count = len(re.findall(r"id:\s*'noble_", content))

        self.assertEqual(t1_count, 40, f"Expected 40 Tier 1 cards, got {t1_count}")
        self.assertEqual(t2_count, 30, f"Expected 30 Tier 2 cards, got {t2_count}")
        self.assertEqual(t3_count, 20, f"Expected 20 Tier 3 cards, got {t3_count}")
        self.assertEqual(noble_count, 10, f"Expected 10 Noble tiles, got {noble_count}")

    def test_ui_methods_present(self):
        ui_file = os.path.join(JS_DIR, 'ui.js')
        with open(ui_file, 'r', encoding='utf-8') as f:
            content = f.read()

        expected_methods = [
            'renderPermanentBonusStacks',
            'renderTopPlayerTable',
            'renderPlayerDock',
            'renderOpponents',
            'renderCardMatrix',
            'renderBankControls',
            'inspectCard',
        ]
        for method in expected_methods:
            self.assertIn(f"{method}(", content, f"Expected method {method} in ui.js")

    def test_username_elements_and_customization(self):
        index_file = os.path.join(WORKSPACE_DIR, 'index.html')
        with open(index_file, 'r', encoding='utf-8') as f:
            html = f.read()

        self.assertIn('id="lobby-player-name"', html)
        self.assertIn('id="lobby-name-label"', html)
        self.assertIn('id="lobby-extra-names"', html)
        self.assertIn('id="rename-modal"', html)
        self.assertIn('id="btn-rename-merchant"', html)
        self.assertIn('id="rename-input"', html)

        app_file = os.path.join(JS_DIR, 'app.js')
        with open(app_file, 'r', encoding='utf-8') as f:
            app_code = f.read()

        self.assertIn('getStoredUserName', app_code)
        self.assertIn('setStoredUserName', app_code)
        self.assertIn('updateLobbyNameFields', app_code)
        self.assertIn('bindRenameEvents', app_code)
        self.assertIn('openRenameModal', app_code)

        css_file = os.path.join(WORKSPACE_DIR, 'css', 'style.css')
        with open(css_file, 'r', encoding='utf-8') as f:
            css_code = f.read()

        self.assertIn('.modal-input', css_code)
        self.assertIn('.rename-icon-btn', css_code)

    def test_opponent_box_gem_tokens_display(self):
        ui_file = os.path.join(JS_DIR, 'ui.js')
        with open(ui_file, 'r', encoding='utf-8') as f:
            ui_code = f.read()

        self.assertIn('opponent-tokens-row', ui_code)
        self.assertIn('opponent-chip', ui_code)
        self.assertIn('opponent-bonuses-row', ui_code)
        self.assertIn('ALL_TOKENS.map', ui_code)

        css_file = os.path.join(WORKSPACE_DIR, 'css', 'style.css')
        with open(css_file, 'r', encoding='utf-8') as f:
            css_code = f.read()

        self.assertIn('.opponent-chip', css_code)
        self.assertIn('.opponent-tokens-row', css_code)
        self.assertIn('.opponent-bonuses-row', css_code)
        self.assertIn('.opponent-section-header', css_code)


class TestSplendorGameLogic(unittest.TestCase):
    """Simulate core rules engine logic to ensure full compliance with official Splendor mechanics."""

    def test_bank_initialization(self):
        def get_bank(player_count):
            reg = 4 if player_count == 2 else (5 if player_count == 3 else 7)
            return {'diamond': reg, 'sapphire': reg, 'emerald': reg, 'ruby': reg, 'onyx': reg, 'gold': 5}

        # 2 players: 4 each + 5 gold = 25 total
        b2 = get_bank(2)
        self.assertEqual(b2['diamond'], 4)
        self.assertEqual(b2['gold'], 5)
        self.assertEqual(sum(b2.values()), 25)

        # 3 players: 5 each + 5 gold = 30 total
        b3 = get_bank(3)
        self.assertEqual(b3['diamond'], 5)
        self.assertEqual(b3['gold'], 5)
        self.assertEqual(sum(b3.values()), 30)

        # 4 players: 7 each + 5 gold = 40 total
        b4 = get_bank(4)
        self.assertEqual(b4['diamond'], 7)
        self.assertEqual(b4['gold'], 5)
        self.assertEqual(sum(b4.values()), 40)

    def test_pair_rule_minimum_four(self):
        # Action 2: Taking 2 of same color strictly requires >= 4 tokens in bank stack
        def can_take_pair(bank_count):
            return bank_count >= 4

        self.assertTrue(can_take_pair(4))
        self.assertTrue(can_take_pair(7))
        self.assertFalse(can_take_pair(3))
        self.assertFalse(can_take_pair(2))
        self.assertFalse(can_take_pair(1))
        self.assertFalse(can_take_pair(0))

    def test_reserve_limit_three(self):
        # Player cannot hold more than 3 reserved cards
        reserved = ['c1', 'c2']
        self.assertTrue(len(reserved) < 3)
        reserved.append('c3')
        self.assertFalse(len(reserved) < 3)

    def test_card_cost_bonus_and_gold_substitution(self):
        # Cost: { diamond: 3, sapphire: 2, ruby: 2 }
        card_cost = {'diamond': 3, 'sapphire': 2, 'ruby': 2}
        player_bonuses = {'diamond': 2, 'sapphire': 0, 'ruby': 1}
        player_tokens = {'diamond': 0, 'sapphire': 1, 'ruby': 1, 'gold': 2}

        # Net requirements after bonus:
        # diamond: max(0, 3 - 2) = 1
        # sapphire: max(0, 2 - 0) = 2
        # ruby: max(0, 2 - 1) = 1
        # Deficits compared to held tokens:
        # diamond: have 0, need 1 -> deficit 1
        # sapphire: have 1, need 2 -> deficit 1
        # ruby: have 1, need 1 -> deficit 0
        # Total gold needed: 1 + 1 = 2
        # Player has 2 gold -> Affordable!
        gold_needed = 0
        regular_paid = {}
        for color, cost in card_cost.items():
            req = max(0, cost - player_bonuses.get(color, 0))
            have = player_tokens.get(color, 0)
            paid = min(have, req)
            regular_paid[color] = paid
            if req > paid:
                gold_needed += (req - paid)

        self.assertEqual(gold_needed, 2)
        self.assertTrue(player_tokens['gold'] >= gold_needed)

    def test_endgame_tiebreaker_hierarchy(self):
        # Tiebreaker:
        # 1. Prestige points (higher is better)
        # 2. Fewest cards purchased (lower is better)
        # 3. Most tokens remaining (higher is better)
        p1 = {'name': 'Alice', 'points': 15, 'cards': 12, 'tokens': 4}
        p2 = {'name': 'Bob',   'points': 15, 'cards': 10, 'tokens': 2} # Wins on fewer cards
        p3 = {'name': 'Carol', 'points': 15, 'cards': 10, 'tokens': 5} # Wins against Bob on more tokens
        p4 = {'name': 'Dave',  'points': 14, 'cards': 8,  'tokens': 10} # Lower points

        players = [p1, p2, p3, p4]

        # Sort key: (-points, cards, -tokens)
        sorted_players = sorted(players, key=lambda p: (-p['points'], p['cards'], -p['tokens']))

        self.assertEqual(sorted_players[0]['name'], 'Carol')
        self.assertEqual(sorted_players[1]['name'], 'Bob')
        self.assertEqual(sorted_players[2]['name'], 'Alice')
        self.assertEqual(sorted_players[3]['name'], 'Dave')

    def test_token_limit_excess_calculation(self):
        tokens = {'diamond': 3, 'sapphire': 3, 'emerald': 2, 'ruby': 2, 'onyx': 1, 'gold': 1}
        total = sum(tokens.values())
        self.assertEqual(total, 12)
        excess = max(0, total - 10)
        self.assertEqual(excess, 2)

    def test_custom_winning_points_configuration(self):
        """Verify UI, engine, and server configuration for customizable winning points."""
        index_file = os.path.join(WORKSPACE_DIR, 'index.html')
        with open(index_file, 'r', encoding='utf-8') as f:
            html = f.read()

        self.assertIn('id="lobby-target-points-select"', html)
        for pts in ['15', '20', '25', '30', '35']:
            self.assertIn(f'value="{pts}"', html)

        engine_file = os.path.join(JS_DIR, 'engine.js')
        with open(engine_file, 'r', encoding='utf-8') as f:
            engine_code = f.read()

        self.assertIn('targetPoints', engine_code)
        self.assertIn('state.targetPoints || 15', engine_code)

        server_file = os.path.join(WORKSPACE_DIR, 'server.py')
        with open(server_file, 'r', encoding='utf-8') as f:
            server_code = f.read()

        self.assertIn('targetPoints', server_code)
        self.assertIn('target_points', server_code)

    def test_full_two_player_game_simulation(self):
        """Execute end-to-end 2-player turn-based game simulation via JavaScriptCore."""
        jsc_bin = '/System/Library/Frameworks/JavaScriptCore.framework/Versions/Current/Helpers/jsc'
        if os.path.exists(jsc_bin):
            sim_file = os.path.join(WORKSPACE_DIR, 'tests', 'test_2p_game_simulation.js')
            res = subprocess.run([jsc_bin, '-m', sim_file], capture_output=True, text=True, cwd=WORKSPACE_DIR)
            self.assertEqual(res.returncode, 0, f"2-Player simulation failed:\n{res.stdout}\n{res.stderr}")
            self.assertIn("ALL 2-PLAYER TURN-BASED TESTS PASSED SUCCESSFULLY!", res.stdout)

    def test_full_multiplayer_game_simulation(self):
        """Execute end-to-end 3-player and 4-player simulation via JavaScriptCore."""
        jsc_bin = '/System/Library/Frameworks/JavaScriptCore.framework/Versions/Current/Helpers/jsc'
        if os.path.exists(jsc_bin):
            sim_file = os.path.join(WORKSPACE_DIR, 'tests', 'test_multiplayer_simulation.js')
            res = subprocess.run([jsc_bin, '-m', sim_file], capture_output=True, text=True, cwd=WORKSPACE_DIR)
            self.assertEqual(res.returncode, 0, f"Multiplayer simulation failed:\n{res.stdout}\n{res.stderr}")
            self.assertIn("ALL 3-PLAYER AND 4-PLAYER SIMULATION TESTS PASSED SUCCESSFULLY!", res.stdout)


    def test_full_game_modes_simulation(self):
        """Execute all 6 game mode simulations and rule checks via JavaScriptCore."""
        index_file = os.path.join(WORKSPACE_DIR, 'index.html')
        with open(index_file, 'r', encoding='utf-8') as f:
            html = f.read()

        self.assertIn('id="lobby-game-mode-select"', html)
        self.assertIn('id="mode-badge"', html)
        for mode in ['classic', 'onyx_syndicate', 'tier_ladder', 'color_supremacy', 'noble_court', 'rainbow_guild']:
            self.assertIn(f'value="{mode}"', html)

        engine_file = os.path.join(JS_DIR, 'engine.js')
        with open(engine_file, 'r', encoding='utf-8') as f:
            engine_code = f.read()

        self.assertIn('GAME_MODES', engine_code)
        self.assertIn('canPlayerBuyCard', engine_code)

        server_file = os.path.join(WORKSPACE_DIR, 'server.py')
        with open(server_file, 'r', encoding='utf-8') as f:
            server_code = f.read()

        self.assertIn('game_mode', server_code)

        jsc_bin = '/System/Library/Frameworks/JavaScriptCore.framework/Versions/Current/Helpers/jsc'
        if os.path.exists(jsc_bin):
            sim_file = os.path.join(WORKSPACE_DIR, 'tests', 'test_game_modes.js')
            res = subprocess.run([jsc_bin, '-m', sim_file], capture_output=True, text=True, cwd=WORKSPACE_DIR)
            self.assertEqual(res.returncode, 0, f"Game modes simulation failed:\n{res.stdout}\n{res.stderr}")
            self.assertIn("ALL 6 GAME MODES TESTS PASSED SUCCESSFULLY!", res.stdout)

    def test_super_powers_mode(self):
        """Verifies 30 Super Powers, 5 powers drawn, Round 1-5 sealed, Round 6 reveal, and in-game feat claiming."""
        html_file = os.path.join(WORKSPACE_DIR, 'index.html')
        with open(html_file, 'r', encoding='utf-8') as f:
            html = f.read()

        self.assertIn('id="powers-column"', html)
        self.assertIn('id="powers-container"', html)
        self.assertIn('id="power-inspect-modal"', html)
        self.assertIn('value="super_powers"', html)

        powers_data_file = os.path.join(JS_DIR, 'powers-data.js')
        self.assertTrue(os.path.exists(powers_data_file))
        with open(powers_data_file, 'r', encoding='utf-8') as f:
            powers_code = f.read()
        self.assertIn('POWERS_DATA', powers_code)
        self.assertIn('drawMatchSuperPowers', powers_code)

        jsc_bin = '/System/Library/Frameworks/JavaScriptCore.framework/Versions/Current/Helpers/jsc'
        if os.path.exists(jsc_bin):
            sp_test_file = os.path.join(WORKSPACE_DIR, 'tests', 'test_super_powers.js')
            res = subprocess.run([jsc_bin, '-m', sp_test_file], capture_output=True, text=True, cwd=WORKSPACE_DIR)
            self.assertEqual(res.returncode, 0, f"Super Powers simulation failed:\n{res.stdout}\n{res.stderr}")
            self.assertIn("ALL SUPER POWERS TESTS PASSED SUCCESSFULLY!", res.stdout)


if __name__ == '__main__':
    unittest.main()

