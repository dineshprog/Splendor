/**
 * Splendor Main App Coordinator
 * Coordinates Lobby, Engine, AI, UI, 3D Canvas, Audio, and Networking.
 */

import {
  createGameState,
  executeTakeDistinctTokens,
  executeTakePairTokens,
  executeReserveCard,
  executePurchaseCard,
  executeDiscardTokens,
  executeChooseNoble,
  executeChooseDraftPower,
  executePassTurn,
  GAME_MODES
} from './engine.js?v=7.0';
import { computeAiMove, computeAiDiscard, computeAiNobleChoice, computeAiDraftChoice } from './ai.js?v=7.0';
import { SplendorUI } from './ui.js?v=7.0';
import { reshuffleCardArtworks } from './cards-data.js?v=7.0';
import { GemTokenVisualizer } from './visual3d.js?v=7.0';
import { soundEngine } from './audio.js?v=7.0';

class SplendorApp {
  constructor() {
    this.state = null;
    this.ui = null;
    this.visualizer = null;
    this.gameMode = 'solo'; // 'solo' | 'pass_and_play' | 'online'
    this.ws = null;
    this.roomId = null;
    this.isProcessingAi = false;

    // Online state
    this.onlineAction = 'create'; // 'create' | 'join'
    this.onlinePlayerId = null;
    this.onlinePlayerName = '';
    this.isOnlineHost = false;
    this.onlinePlayers = [];
    this.onlinePlayerCount = 2;
    this.onlineTimerSec = 60;

    this.init();
  }

  init() {
    // Check if URL has room parameter
    const params = new URLSearchParams(window.location.search);
    const roomParam = params.get('room');
    if (roomParam) {
      this.roomId = roomParam.trim().toUpperCase();
      this.gameMode = 'online';
      this.onlineAction = 'join';
    }

    // Initialize UI
    this.ui = new SplendorUI({
      onTakeDistinctTokens: (colors) => this.handlePlayerTakeDistinct(colors),
      onTakePairTokens: (color) => this.handlePlayerTakePair(color),
      onReserveCard: (opts) => this.handlePlayerReserve(opts),
      onPurchaseCard: (cardId) => this.handlePlayerPurchase(cardId),
      onDiscardTokens: (discardMap) => this.handlePlayerDiscard(discardMap),
      onChooseNoble: (nobleId) => this.handlePlayerChooseNoble(nobleId),
      onChooseDraftPower: (powerId) => this.handlePlayerChooseDraftPower(powerId),
      onUpdateVisualizer: (bank, staged) => this.visualizer?.update(bank, staged),
      onTurnTimeout: () => this.handleTurnTimeout(),
      onSendEmote: (text) => this.sendEmoteNetwork(text),
      onRenamePlayer: (playerIdx) => this.openRenameModal(playerIdx)
    });

    // Initialize 3D / 2D Token Visualizer
    const canvasContainer = document.getElementById('gem-canvas-container');
    if (canvasContainer) {
      this.visualizer = new GemTokenVisualizer(canvasContainer, (color) => {
        this.ui.handleTokenClick(color);
      });
    }

    this.bindLobbyEvents();
    this.bindRenameEvents();

    // Check for saved game in localStorage to resume on reload
    if (!roomParam) {
      try {
        const savedStr = localStorage.getItem('splendor_saved_game');
        if (savedStr) {
          const saved = JSON.parse(savedStr);
          if (saved && saved.state && saved.state.status && saved.state.status !== 'completed') {
            this.state = saved.state;
            this.gameMode = saved.gameMode || 'solo';
            this.ui.setGameMode(this.gameMode, saved.localPlayerId || 'p_1');
            const hasAiInPassAndPlay = (this.gameMode === 'pass_and_play') && this.state.players.some(p => p.isAi);
            const badgeText = this.gameMode === 'solo'
              ? 'SOLO VS AI'
              : (hasAiInPassAndPlay ? 'PASS & PLAY (+AI)' : 'PASS & PLAY');
            this.updateRoomBadge(badgeText);
            document.getElementById('lobby-modal')?.classList.add('hidden');
            this.syncGameState();
            return;
          }
        }
      } catch (_) {}
    }

    // Show lobby modal (or setup join view if link was clicked)
    document.getElementById('lobby-modal')?.classList.remove('hidden');
    if (this.gameMode === 'online' && this.roomId) {
      this.setupJoinViaLinkLobby(this.roomId);
    }
  }

  setupJoinViaLinkLobby(roomId) {
    const modeSelect = document.getElementById('lobby-mode-select');
    if (modeSelect) modeSelect.value = 'online';

    const codeInput = document.getElementById('lobby-room-code-input');
    if (codeInput) codeInput.value = roomId;

    this.onlineAction = 'join';
    this.updateOnlineLobbyTabs?.();

    const subtitle = document.querySelector('#lobby-modal .modal-subtitle');
    if (subtitle) {
      subtitle.innerHTML = `✦ Invited to Join Online Room <strong style="color:var(--text-gold);">#${roomId}</strong> ✦`;
    }

    const btnStart = document.getElementById('btn-start-game');
    if (btnStart) {
      btnStart.innerText = `Enter Room #${roomId}`;
    }
  }

  getStoredUserName(key = 'splendor_username', fallback = 'Merchant 1') {
    try {
      return localStorage.getItem(key) || fallback;
    } catch (_) {
      return fallback;
    }
  }

  setStoredUserName(key, value) {
    try {
      if (value && typeof value === 'string') {
        localStorage.setItem(key, value.trim());
      }
    } catch (_) {}
  }

  updateLobbyNameFields(mode, count) {
    const p1Label = document.getElementById('lobby-name-label');
    const p1Input = document.getElementById('lobby-player-name');
    const extraNamesContainer = document.getElementById('lobby-extra-names');
    if (!p1Input || !extraNamesContainer) return;

    if (!p1Input.value) {
      p1Input.value = this.getStoredUserName('splendor_username', 'Merchant 1');
    }

    if (mode === 'solo' || mode === 'online') {
      if (p1Label) p1Label.innerText = 'Your Name:';
      extraNamesContainer.style.display = 'none';
      extraNamesContainer.innerHTML = '';
    } else {
      // Pass & Play mode: support configuring each extra player as Human or AI!
      if (p1Label) p1Label.innerText = 'Player 1 (Bottom Table):';
      extraNamesContainer.style.display = 'flex';
      extraNamesContainer.innerHTML = '';

      for (let i = 2; i <= count; i++) {
        const row = document.createElement('div');
        row.style.display = 'flex';
        row.style.justifyContent = 'space-between';
        row.style.alignItems = 'center';
        row.style.gap = '8px';
        row.style.padding = '4px 0';
        row.style.borderTop = '1px solid rgba(255,255,255,0.06)';

        const labelText = (i === 2 && count === 2) ? 'Player 2 (Top Table):' : `Player ${i}:`;
        const defaultHumanName = this.getStoredUserName(`splendor_p${i}_name`, `Merchant ${i}`);

        row.innerHTML = `
          <label style="font-size:13px; color:#e2e8f0; font-weight:600; min-width:68px;">${labelText}</label>
          <div style="display:flex; align-items:center; gap:8px; flex:1; justify-content:flex-end;">
            <select id="lobby-p${i}-type" class="secondary-btn" style="background:#1e1b2b; color:#fff; font-size:12px; padding:4px 8px; flex-shrink:0;">
              <option value="human">🧑 Human</option>
              <option value="grandmaster">🤖 Grandmaster: Dinesh</option>
              <option value="master">🤖 Master Bot</option>
              <option value="merchant">🤖 Merchant Bot</option>
              <option value="apprentice">🤖 Apprentice Bot</option>
            </select>
            <input type="text" id="lobby-p${i}-name" class="modal-input" value="${defaultHumanName}" placeholder="Merchant ${i}..." maxlength="20" style="background:#1e1b2b; color:#fff; width:130px;" />
          </div>
        `;

        const typeSelect = row.querySelector(`#lobby-p${i}-type`);
        const nameInput = row.querySelector(`#lobby-p${i}-name`);
        typeSelect?.addEventListener('change', () => {
          const val = typeSelect.value;
          if (val === 'grandmaster') {
            nameInput.value = (count === 2 || i === 2) ? 'Dinesh' : `Dinesh ${i - 1}`;
          } else if (val === 'master') {
            nameInput.value = `Bot ${i} (Master)`;
          } else if (val === 'merchant') {
            nameInput.value = `Bot ${i} (Merchant)`;
          } else if (val === 'apprentice') {
            nameInput.value = `Bot ${i} (Apprentice)`;
          } else {
            nameInput.value = this.getStoredUserName(`splendor_p${i}_name`, `Merchant ${i}`);
          }
        });

        extraNamesContainer.appendChild(row);
      }
    }
  }

  bindLobbyEvents() {
    const btnStart = document.getElementById('btn-start-game');
    const modeSelect = document.getElementById('lobby-mode-select');
    const playersSelect = document.getElementById('lobby-players-count');
    const timerSelect = document.getElementById('lobby-timer-select');
    const targetPointsSelect = document.getElementById('lobby-target-points-select');
    const gameModeSelect = document.getElementById('lobby-game-mode-select');
    const gameModeDesc = document.getElementById('lobby-mode-description');
    const gameModeRow = document.getElementById('lobby-game-mode-row');
    const aiDifficultySelect = document.getElementById('lobby-ai-diff-select');
    const p1Input = document.getElementById('lobby-player-name');
    const onlineOptions = document.getElementById('lobby-online-options');
    const playersCountRow = document.getElementById('lobby-players-count-row');
    const timerRow = timerSelect?.parentElement;
    const targetPointsRow = document.getElementById('lobby-target-points-row');
    const tabCreate = document.getElementById('btn-tab-create-room');
    const tabJoin = document.getElementById('btn-tab-join-room');
    const joinCodeRow = document.getElementById('lobby-join-code-row');

    const powersRuleSelect = document.getElementById('lobby-powers-rule-select');
    const powersRuleDesc = document.getElementById('lobby-powers-rule-desc');
    const btnResume = document.getElementById('btn-resume-game');

    btnResume?.addEventListener('click', () => {
      document.getElementById('lobby-modal')?.classList.add('hidden');
    });

    if (p1Input) {
      p1Input.value = this.getStoredUserName('splendor_username', 'Merchant 1');
    }

    if (targetPointsSelect) {
      const storedPoints = this.getStoredUserName('splendor_winning_points', '15');
      if (['15', '20', '25', '30', '35'].includes(storedPoints)) {
        targetPointsSelect.value = storedPoints;
      }
      targetPointsSelect.addEventListener('change', () => {
        this.setStoredUserName('splendor_winning_points', targetPointsSelect.value);
      });
    }

    if (powersRuleSelect) {
      const storedRule = this.getStoredUserName('splendor_powers_rule', 'draft_every_4_rounds');
      if (['none', 'nobles', 'draft_every_4_rounds'].includes(storedRule)) {
        powersRuleSelect.value = storedRule;
      }
      const updatePowersRuleDesc = () => {
        const val = powersRuleSelect.value;
        this.setStoredUserName('splendor_powers_rule', val);
        if (powersRuleDesc) {
          if (val === 'none') {
            powersRuleDesc.innerText = 'No super powers enabled. Standard merchant rules apply.';
          } else if (val === 'nobles') {
            powersRuleDesc.innerText = '7 Arcane Powers are sealed for the first 5 rounds. Starting at Round 6, powers can be claimed like nobles by achieving feats!';
          } else {
            powersRuleDesc.innerText = 'Every 4 rounds, 2 power cards appear on screen. The chooser takes one, and the rival gets the other! Stops after Round 24.';
          }
        }
      };
      powersRuleSelect.addEventListener('change', updatePowersRuleDesc);
      updatePowersRuleDesc();
    }

    if (gameModeSelect) {
      const storedMode = this.getStoredUserName('splendor_game_mode', 'classic');
      if (['classic', 'super_powers', 'onyx_syndicate', 'tier_ladder', 'color_supremacy', 'noble_court', 'rainbow_guild'].includes(storedMode)) {
        gameModeSelect.value = storedMode;
      }
      const updateModeDescription = () => {
        const val = gameModeSelect.value;
        const isPureObjective = ['onyx_syndicate', 'color_supremacy', 'noble_court', 'rainbow_guild'].includes(val);
        if (targetPointsRow) {
          targetPointsRow.style.display = isPureObjective ? 'none' : 'flex';
        }
        if (powersRuleSelect && val === 'super_powers') {
          if (powersRuleSelect.value === 'none') {
            powersRuleSelect.value = 'draft_every_4_rounds';
            powersRuleSelect.dispatchEvent(new Event('change'));
          }
        }
        const descriptions = {
          classic: 'Race to target prestige points (15-35 PTS). The timeless Renaissance competition.',
          super_powers: '24 legendary super powers await! Choose your draft style or feat mode in the Super Powers Rule dropdown.',
          onyx_syndicate: 'The Black Market Guild offers supreme influence. First player to collect 10 Onyx (black) development cards wins immediately!',
          tier_ladder: 'Mastery requires true foundation. You must own at least 6 Tier 1 cards to purchase Tier 2 cards, and at least 6 Tier 2 cards to purchase Tier 3 cards.',
          color_supremacy: 'Corner the gemstone markets! The first player to buy 5 cards in any color earns that gem\'s Monopoly Trophy (1 pt). First player to collect 3 Trophies wins!',
          noble_court: 'Prestige is nothing without royal backing. In this court intrigue, the first merchant to attract 3 Noble patrons wins the crown!',
          rainbow_guild: 'A true master cannot specialize in only one trade. First merchant to assemble at least 3 development cards in each of the 5 colors (15 cards total) wins!'
        };
        if (gameModeDesc) gameModeDesc.innerText = descriptions[val] || descriptions.classic;
      };
      gameModeSelect.addEventListener('change', () => {
        this.setStoredUserName('splendor_game_mode', gameModeSelect.value);
        updateModeDescription();
      });
      updateModeDescription();
    }

    const updateOnlineTabs = () => {
      if (this.onlineAction === 'create') {
        tabCreate?.style.setProperty('background', 'var(--bg-gold)');
        tabCreate?.style.setProperty('color', '#000');
        tabCreate?.style.setProperty('font-weight', '700');
        tabJoin?.style.setProperty('background', '#1e1b2b');
        tabJoin?.style.setProperty('color', '#cbd5e1');
        tabJoin?.style.setProperty('font-weight', 'normal');
        if (joinCodeRow) joinCodeRow.style.display = 'none';
        if (playersCountRow) playersCountRow.style.display = 'flex';
        if (timerRow) timerRow.style.display = 'flex';
        if (targetPointsRow) targetPointsRow.style.display = 'flex';
        if (gameModeRow) gameModeRow.style.display = 'flex';
        if (btnStart) btnStart.innerText = 'Create Room & Get Link';
      } else {
        tabJoin?.style.setProperty('background', 'var(--bg-gold)');
        tabJoin?.style.setProperty('color', '#000');
        tabJoin?.style.setProperty('font-weight', '700');
        tabCreate?.style.setProperty('background', '#1e1b2b');
        tabCreate?.style.setProperty('color', '#cbd5e1');
        tabCreate?.style.setProperty('font-weight', 'normal');
        if (joinCodeRow) joinCodeRow.style.display = 'flex';
        if (playersCountRow) playersCountRow.style.display = 'none';
        if (timerRow) timerRow.style.display = 'none';
        if (targetPointsRow) targetPointsRow.style.display = 'none';
        if (gameModeRow) gameModeRow.style.display = 'none';
        if (btnStart) btnStart.innerText = 'Join Online Room';
      }
    };
    this.updateOnlineLobbyTabs = updateOnlineTabs;

    tabCreate?.addEventListener('click', () => {
      this.onlineAction = 'create';
      updateOnlineTabs();
    });
    tabJoin?.addEventListener('click', () => {
      this.onlineAction = 'join';
      updateOnlineTabs();
    });

    const refreshNameFields = () => {
      const mode = modeSelect ? modeSelect.value : 'solo';
      const count = playersSelect ? parseInt(playersSelect.value, 10) : 4;
      const isSolo = mode === 'solo';
      const isOnline = mode === 'online';

      const aiDiffRow = document.getElementById('lobby-ai-diff-row');
      if (aiDiffRow) aiDiffRow.style.display = isSolo ? 'flex' : 'none';
      if (onlineOptions) onlineOptions.style.display = isOnline ? 'flex' : 'none';

      if (btnResume) {
        const hasActiveGame = !!(this.state && this.state.status && this.state.status !== 'completed');
        btnResume.style.display = hasActiveGame ? 'inline-block' : 'none';
      }

      if (isOnline) {
        updateOnlineTabs();
      } else {
        if (playersCountRow) playersCountRow.style.display = 'flex';
        if (timerRow) timerRow.style.display = 'flex';
        const isPureObjective = ['onyx_syndicate', 'color_supremacy', 'noble_court', 'rainbow_guild'].includes(gameModeSelect?.value);
        if (targetPointsRow) targetPointsRow.style.display = isPureObjective ? 'none' : 'flex';
        if (gameModeRow) gameModeRow.style.display = 'flex';
        if (btnStart) btnStart.innerText = 'Enter the Merchant Guild';
      }

      this.updateLobbyNameFields(mode, count);
    };

    modeSelect?.addEventListener('change', refreshNameFields);
    playersSelect?.addEventListener('change', refreshNameFields);

    refreshNameFields();

    btnStart?.addEventListener('click', () => {
      if (this.state && this.state.status && this.state.status !== 'completed') {
        if (!window.confirm('A match is currently in progress. Start a new game and discard your current progress?')) {
          return;
        }
      }

      const mode = modeSelect.value;
      const count = parseInt(playersSelect.value, 10);
      const timerSec = parseInt(timerSelect.value, 10);
      const targetPoints = targetPointsSelect ? (parseInt(targetPointsSelect.value, 10) || 15) : 15;
      const gameMode = gameModeSelect ? gameModeSelect.value : 'classic';
      const powersRule = powersRuleSelect ? powersRuleSelect.value : 'draft_every_4_rounds';
      const enableSuperPowers = powersRule !== 'none';
      const aiDiff = aiDifficultySelect ? aiDifficultySelect.value : 'merchant';
      const p1Name = (p1Input?.value || '').trim() || 'Merchant 1';
      this.setStoredUserName('splendor_username', p1Name);

      const playerConfigs = [
        { name: p1Name, isAi: false, difficulty: null }
      ];

      if (mode === 'solo') {
        for (let i = 2; i <= count; i++) {
          let name;
          if (aiDiff === 'grandmaster') {
            name = (count === 2 || i === 2) ? 'Dinesh' : `Dinesh ${i - 1}`;
          } else {
            name = `Bot ${i} (${aiDiff.charAt(0).toUpperCase() + aiDiff.slice(1)})`;
          }
          playerConfigs.push({ name, isAi: true, difficulty: aiDiff });
        }
      } else if (mode === 'pass_and_play') {
        for (let i = 2; i <= count; i++) {
          const typeSelect = document.getElementById(`lobby-p${i}-type`);
          const nameInput = document.getElementById(`lobby-p${i}-name`);
          const type = typeSelect ? typeSelect.value : 'human';
          const isAi = type !== 'human';
          const diff = isAi ? type : null;

          const defaultHumanName = this.getStoredUserName(`splendor_p${i}_name`, `Merchant ${i}`);
          const defaultAiName = (diff === 'grandmaster')
            ? ((count === 2 || i === 2) ? 'Dinesh' : `Dinesh ${i - 1}`)
            : `Bot ${i} (${diff ? (diff.charAt(0).toUpperCase() + diff.slice(1)) : 'AI'})`;

          const pName = (nameInput?.value || '').trim() || (isAi ? defaultAiName : defaultHumanName);
          if (!isAi) {
            this.setStoredUserName(`splendor_p${i}_name`, pName);
          }
          playerConfigs.push({ name: pName, isAi, difficulty: diff });
        }
      }

      document.getElementById('lobby-modal')?.classList.add('hidden');
      soundEngine.init();

      if (mode === 'online') {
        if (this.onlineAction === 'create') {
          const code = Math.random().toString(36).substring(2, 8).toUpperCase();
          this.startOnlineGame({
            roomId: code,
            playerName: p1Name,
            playerCount: count,
            timerSec,
            targetPoints,
            gameMode,
            isHost: true
          });
        } else {
          const codeInput = document.getElementById('lobby-room-code-input');
          const code = (codeInput?.value || this.roomId || '').trim().toUpperCase();
          if (!code) {
            this.ui.showGameAlert('Room Code Required', 'Please enter a valid 6-character room code to join.');
            document.getElementById('lobby-modal')?.classList.remove('hidden');
            return;
          }
          this.startOnlineGame({
            roomId: code,
            playerName: p1Name,
            playerCount: count,
            timerSec,
            targetPoints,
            gameMode,
            isHost: false
          });
        }
      } else {
        this.startLocalGame({ mode, count, timerSec, targetPoints, gameMode, aiDiff, playerConfigs, enableSuperPowers, powersRule });
      }
    });

    // Header new game trigger
    document.getElementById('btn-new-game')?.addEventListener('click', () => {
      refreshNameFields();
      document.getElementById('lobby-modal')?.classList.remove('hidden');
    });
  }

  bindRenameEvents() {
    const renameModal = document.getElementById('rename-modal');
    const renameInput = document.getElementById('rename-input');
    const btnCancel = document.getElementById('btn-cancel-rename');
    const btnSave = document.getElementById('btn-save-rename');

    const closeRenameModal = () => {
      renameModal?.classList.add('hidden');
    };

    const saveNewName = () => {
      const idx = this.targetRenamePlayerIndex !== undefined ? this.targetRenamePlayerIndex : 0;
      if (!this.state || !this.state.players || !this.state.players[idx]) return;
      const newName = (renameInput?.value || '').trim();
      if (!newName) return;

      const player = this.state.players[idx];
      const oldName = player.name;
      player.name = newName;

      if (idx === 0) {
        this.setStoredUserName('splendor_username', newName);
      } else {
        this.setStoredUserName(`splendor_p${idx + 1}_name`, newName);
      }

      if (this.state.moveHistory) {
        this.state.moveHistory.push({
          turn: this.state.turnIndex + 1,
          round: this.state.roundIndex,
          playerId: player.id,
          playerName: newName,
          actionType: 'rename',
          description: `Merchant '${oldName}' is now known as '${newName}'.`,
          timestamp: Date.now()
        });
      }

      soundEngine.playCardReserve();
      this.broadcastStateIfOnline();
      this.syncGameState();
      closeRenameModal();
    };

    btnCancel?.addEventListener('click', closeRenameModal);
    btnSave?.addEventListener('click', saveNewName);

    renameInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        saveNewName();
      } else if (e.key === 'Escape') {
        closeRenameModal();
      }
    });

    renameModal?.addEventListener('click', (e) => {
      if (e.target === renameModal) closeRenameModal();
    });
  }

  openRenameModal(playerIdx = 0) {
    if (!this.state || !this.state.players || !this.state.players[playerIdx]) return;
    const player = this.state.players[playerIdx];
    if (player.isAi) return; // Disallow renaming AI players during game
    this.targetRenamePlayerIndex = playerIdx;

    const renameModal = document.getElementById('rename-modal');
    const renameInput = document.getElementById('rename-input');
    const renameLabel = document.getElementById('rename-modal-label');

    if (renameLabel) {
      renameLabel.innerText = `Merchant Name (${player.name}):`;
    }
    if (renameInput) {
      renameInput.value = player.name;
      renameModal?.classList.remove('hidden');
      setTimeout(() => {
        renameInput.focus();
        renameInput.select();
      }, 50);
    } else {
      renameModal?.classList.remove('hidden');
    }
  }

  startLocalGame(config) {
    reshuffleCardArtworks();
    const { mode, count, timerSec, targetPoints, gameMode, aiDiff, playerConfigs, enableSuperPowers } = config;
    this.gameMode = mode;
    this.isProcessingAi = false;
    this.ui.setGameMode(mode, 'p_1');

    const playerNames = [];
    const aiConfigs = [];

    if (playerConfigs && playerConfigs.length === count) {
      for (let i = 0; i < count; i++) {
        const p = playerConfigs[i];
        playerNames.push(p.name);
        aiConfigs.push(p.isAi ? { difficulty: p.difficulty || aiDiff || 'merchant' } : null);
      }
    } else {
      const p1Name = (config.customNames && config.customNames[0])
        ? config.customNames[0]
        : this.getStoredUserName('splendor_username', 'Merchant 1');

      if (mode === 'solo') {
        playerNames.push(p1Name);
        aiConfigs.push(null);

        for (let i = 2; i <= count; i++) {
          let name;
          if (aiDiff === 'grandmaster') {
            name = (count === 2 || i === 2) ? 'Dinesh' : `Dinesh ${i - 1}`;
          } else {
            name = `Bot ${i} (${aiDiff.charAt(0).toUpperCase() + aiDiff.slice(1)})`;
          }
          playerNames.push(name);
          aiConfigs.push({ difficulty: aiDiff });
        }
      } else {
        playerNames.push(p1Name);
        aiConfigs.push(null);

        for (let i = 2; i <= count; i++) {
          const pName = (config.customNames && config.customNames[i - 1])
            ? config.customNames[i - 1]
            : this.getStoredUserName(`splendor_p${i}_name`, `Merchant ${i}`);
          playerNames.push(pName);
          aiConfigs.push(null);
        }
      }
    }

    const powersRule = config.powersRule || (enableSuperPowers ? 'draft_every_4_rounds' : 'none');
    this.state = createGameState({
      playerNames,
      aiConfigs,
      timeLimitSeconds: timerSec,
      targetPoints: targetPoints || 15,
      gameMode: gameMode || 'classic',
      enableSuperPowers: enableSuperPowers === true,
      powersRule
    });

    const hasAiInPassAndPlay = (mode === 'pass_and_play') && aiConfigs.some(cfg => cfg !== null);
    const badgeText = mode === 'solo'
      ? 'SOLO VS AI'
      : (hasAiInPassAndPlay ? 'PASS & PLAY (+AI)' : 'PASS & PLAY');
    this.updateRoomBadge(badgeText);
    this.syncGameState();
  }

  syncGameState() {
    if (!this.state) return;
    this.ui.render(this.state);
    this.visualizer?.update(this.state.bank, this.ui.stagedTokens);

    // Save to localStorage for full persistence across reloads
    try {
      if (this.state.status === 'completed') {
        localStorage.removeItem('splendor_saved_game');
        sessionStorage.removeItem('splendor_state');
      } else {
        const payload = JSON.stringify({
          state: this.state,
          gameMode: this.gameMode,
          localPlayerId: this.ui.localPlayerId,
          savedAt: Date.now()
        });
        localStorage.setItem('splendor_saved_game', payload);
        sessionStorage.setItem('splendor_state', JSON.stringify(this.state));
      }
    } catch (_) {}

    // Check if AI turn
    this.checkNextTurnAi();
  }

  checkNextTurnAi() {
    if (this.state.status === 'completed' || this.isProcessingAi) return;

    // Check if an Arcane Draft requires an AI chooser
    if (this.state.pendingPowerDraft) {
      const chooserIdx = this.state.pendingPowerDraft.choosingPlayerIndex;
      const chooser = this.state.players[chooserIdx];
      if (chooser && chooser.isAi) {
        this.isProcessingAi = true;
        this.ui?.setAiThinking(chooser.name, chooser.aiDifficulty || 'merchant');

        setTimeout(() => {
          try {
            if (this.state.pendingPowerDraft) {
              const cards = this.state.pendingPowerDraft.cards;
              const chosenId = computeAiDraftChoice(this.state, chooserIdx, cards);
              executeChooseDraftPower(this.state, chooserIdx, chosenId);
              soundEngine.playTrumpet();
              this.broadcastStateIfOnline({
                type: 'draft_power',
                playerIndex: chooserIdx,
                chosenPowerId: chosenId,
                summary: `${chooser.name} drafted an arcane power`
              });
            }
          } catch (e) {
            console.error('Error in AI draft pick:', e);
          }
          this.isProcessingAi = false;
          this.syncGameState();
        }, 1300);
        return;
      }
      // If chooser is a human, pause until they make their selection
      return;
    }

    const activePlayer = this.state.players[this.state.activePlayerIndex];
    if (activePlayer && activePlayer.isAi) {
      this.isProcessingAi = true;

      // Determine thoughtful thinking delay based on difficulty
      let thinkDelay = 1800; // Default
      if (activePlayer.aiDifficulty === 'apprentice') thinkDelay = 1000;
      else if (activePlayer.aiDifficulty === 'merchant') thinkDelay = 1300;
      else if (activePlayer.aiDifficulty === 'master') thinkDelay = 1600;
      else if (activePlayer.aiDifficulty === 'grandmaster') thinkDelay = 2000;

      // Surface thinking indicator in the UI
      this.ui?.setAiThinking(activePlayer.name, activePlayer.aiDifficulty);

      setTimeout(() => {
        try {
          this.executeAiTurn(activePlayer);
        } catch (e) {
          console.error('Error in AI turn:', e);
          try {
            executePassTurn(this.state, this.state.activePlayerIndex);
          } catch (_) {}
          this.isProcessingAi = false;
          this.syncGameState();
        }
      }, thinkDelay);
    }
  }

  executeAiTurn(activePlayer) {
    const pIdx = this.state.activePlayerIndex;

    const finishAiTurn = (delayMs = 0) => {
      setTimeout(() => {
        this.isProcessingAi = false;
        this.syncGameState();
      }, delayMs);
    };

    // 1. Pending Discard
    if (this.state.pendingDiscard && this.state.pendingDiscard.playerIndex === pIdx) {
      const discardMap = computeAiDiscard(this.state, pIdx, this.state.pendingDiscard.excessCount);
      executeDiscardTokens(this.state, pIdx, discardMap);
      finishAiTurn(300);
      return;
    }

    // 2. Pending Noble Choice
    if (this.state.pendingNobleChoice && this.state.pendingNobleChoice.playerIndex === pIdx) {
      const nobleId = computeAiNobleChoice(this.state, pIdx, this.state.pendingNobleChoice.nobleIds);
      executeChooseNoble(this.state, pIdx, nobleId);
      finishAiTurn(300);
      return;
    }

    // 3. Normal Move
    const move = computeAiMove(this.state, pIdx);
    if (!move) {
      console.warn(`AI (${activePlayer.name}) computed no move, passing turn.`);
      executePassTurn(this.state, pIdx);
      finishAiTurn(300);
      return;
    }

    let hasAnimation = false;
    switch (move.type) {
      case 'take_distinct':
        hasAnimation = true;
        this.ui?.flyTokensToPlayer(move.colors, pIdx);
        executeTakeDistinctTokens(this.state, pIdx, move.colors);
        soundEngine.playChipClink();
        break;
      case 'take_pair':
        hasAnimation = true;
        this.ui?.flyTokensToPlayer([move.color, move.color], pIdx);
        executeTakePairTokens(this.state, pIdx, move.color);
        soundEngine.playChipClink();
        break;
      case 'reserve':
        hasAnimation = true;
        this.ui?.animateCardAction({
          cardId: move.cardId,
          tier: move.tier,
          fromDeck: move.fromDeck,
          isReserve: true,
          playerIndex: pIdx
        });
        if (this.state.bank.gold > 0 && activePlayer.cardsReserved.length < 3) {
          this.ui?.flyTokensToPlayer(['gold'], pIdx);
        }
        executeReserveCard(this.state, pIdx, move);
        soundEngine.playCardSnap();
        break;
      case 'purchase':
        hasAnimation = true;
        this.ui?.animateCardAction({
          cardId: move.cardId,
          isReserve: false,
          playerIndex: pIdx
        });
        executePurchaseCard(this.state, pIdx, move.cardId, move);
        soundEngine.playCardPurchase();
        break;

      case 'pass':
        executePassTurn(this.state, pIdx);
        break;
    }

    // 4. Immediately resolve post-action requirements for AI (Discard & Noble Choice)
    if (this.state.pendingDiscard && this.state.pendingDiscard.playerIndex === pIdx) {
      const discardMap = computeAiDiscard(this.state, pIdx, this.state.pendingDiscard.excessCount);
      executeDiscardTokens(this.state, pIdx, discardMap);
    }

    if (this.state.pendingNobleChoice && this.state.pendingNobleChoice.playerIndex === pIdx) {
      const nobleId = computeAiNobleChoice(this.state, pIdx, this.state.pendingNobleChoice.nobleIds);
      executeChooseNoble(this.state, pIdx, nobleId);
    }

    // Allow token/card animation (~1150ms) or card buy settle delay before clearing processing flag & syncing
    const settleDelay = hasAnimation ? 1250 : 450;
    finishAiTurn(settleDelay);
  }

  // -------------------------------------------------------------
  // PLAYER ACTION HANDLERS
  // -------------------------------------------------------------
  handlePlayerTakeDistinct(colors) {
    try {
      const pIdx = this.state.activePlayerIndex;
      const player = this.state.players[pIdx];
      executeTakeDistinctTokens(this.state, pIdx, colors);
      this.broadcastStateIfOnline({
        type: 'take_distinct',
        playerIndex: pIdx,
        colors,
        summary: `${player.name} took ${colors.length} gems`
      });
      this.syncGameState();
    } catch (err) {
      this.ui.showGameAlert('⚠️ Invalid Move', err.message);
    }
  }

  handlePlayerTakePair(color) {
    try {
      const pIdx = this.state.activePlayerIndex;
      const player = this.state.players[pIdx];
      executeTakePairTokens(this.state, pIdx, color);
      this.broadcastStateIfOnline({
        type: 'take_pair',
        playerIndex: pIdx,
        color,
        summary: `${player.name} took 2 ${color} gems`
      });
      this.syncGameState();
    } catch (err) {
      this.ui.showGameAlert('⚠️ Invalid Move', err.message);
    }
  }

  handlePlayerReserve(opts) {
    try {
      const pIdx = this.state.activePlayerIndex;
      const player = this.state.players[pIdx];
      const hasGoldInBank = (this.state.bank.gold || 0) > 0 && player.cardsReserved.length < 3;

      this.ui?.animateCardAction({
        cardId: opts.cardId,
        tier: opts.tier,
        fromDeck: opts.fromDeck,
        isReserve: true,
        playerIndex: pIdx
      });
      if (hasGoldInBank) {
        this.ui?.flyTokensToPlayer(['gold'], pIdx);
      }

      executeReserveCard(this.state, pIdx, opts);
      this.broadcastStateIfOnline({
        type: 'reserve',
        playerIndex: pIdx,
        opts,
        summary: `${player.name} reserved a card`
      });
      this.syncGameState();
    } catch (err) {
      this.ui.showGameAlert('⚠️ Cannot Reserve', err.message);
    }
  }

  handlePlayerPurchase(cardId) {
    try {
      const pIdx = this.state.activePlayerIndex;
      const player = this.state.players[pIdx];

      this.ui?.animateCardAction({
        cardId,
        isReserve: false,
        playerIndex: pIdx
      });

      executePurchaseCard(this.state, pIdx, cardId);
      this.broadcastStateIfOnline({
        type: 'purchase',
        playerIndex: pIdx,
        cardId,
        summary: `${player.name} purchased a card`
      });
      this.syncGameState();
    } catch (err) {
      this.ui.showGameAlert('⚠️ Cannot Purchase', err.message);
    }
  }

  handlePlayerDiscard(discardMap) {
    try {
      const pIdx = this.state.activePlayerIndex;
      const player = this.state.players[pIdx];
      executeDiscardTokens(this.state, pIdx, discardMap);
      this.broadcastStateIfOnline({
        type: 'discard',
        playerIndex: pIdx,
        summary: `${player?.name || 'Player'} discarded excess tokens`
      });
      this.syncGameState();
    } catch (err) {
      this.ui.showGameAlert('⚠️ Discard Error', err.message);
    }
  }

  handlePlayerChooseNoble(nobleId) {
    try {
      const pIdx = this.state.activePlayerIndex;
      const player = this.state.players[pIdx];
      executeChooseNoble(this.state, pIdx, nobleId);
      this.broadcastStateIfOnline({
        type: 'noble',
        playerIndex: pIdx,
        nobleId,
        summary: `Noble visited ${player?.name || 'Player'} (+3 PTS)`
      });
      this.syncGameState();
    } catch (err) {
      this.ui.showGameAlert('⚠️ Noble Error', err.message);
    }
  }

  handlePlayerChooseDraftPower(chosenPowerId) {
    try {
      if (!this.state.pendingPowerDraft) return;
      const chooserIdx = this.state.pendingPowerDraft.choosingPlayerIndex;
      const chooser = this.state.players[chooserIdx];
      executeChooseDraftPower(this.state, chooserIdx, chosenPowerId);
      soundEngine.playTrumpet();
      this.broadcastStateIfOnline({
        type: 'draft_power',
        playerIndex: chooserIdx,
        chosenPowerId,
        summary: `${chooser?.name || 'Player'} drafted an arcane power`
      });
      this.syncGameState();
    } catch (err) {
      this.ui.showGameAlert('⚠️ Draft Error', err.message);
    }
  }

  handleTurnTimeout() {
    const activePlayer = this.state.players[this.state.activePlayerIndex];
    if (activePlayer && !activePlayer.isAi) {
      if (this.gameMode === 'online' && activePlayer.id !== this.onlinePlayerId) return;

      const pIdx = this.state.activePlayerIndex;
      const move = computeAiMove(this.state, pIdx);
      if (move) {
        if (move.type === 'take_distinct') executeTakeDistinctTokens(this.state, pIdx, move.colors);
        else if (move.type === 'take_pair') executeTakePairTokens(this.state, pIdx, move.color);
        else if (move.type === 'purchase') executePurchaseCard(this.state, pIdx, move.cardId, move);
        else if (move.type === 'reserve') executeReserveCard(this.state, pIdx, move);
        else executePassTurn(this.state, pIdx);
      } else {
        executePassTurn(this.state, pIdx);
      }
      this.broadcastStateIfOnline({
        type: 'timeout',
        playerIndex: pIdx,
        summary: `${activePlayer.name} turn timed out`
      });
      this.syncGameState();
    }
  }

  updateRoomBadge(text) {
    const badge = document.getElementById('room-badge');
    if (badge) {
      const target = this.state?.targetPoints || this.onlineTargetPoints || 15;
      badge.innerText = `${text} · 🎯 ${target} PTS`;
      if (this.gameMode === 'online') {
        badge.classList.add('interactive');
        badge.title = 'Click to copy room link';
        badge.onclick = () => {
          const shareLink = `${window.location.origin}${window.location.pathname}?room=${this.roomId}`;
          if (navigator.clipboard) {
            navigator.clipboard.writeText(shareLink).then(() => {
              this.ui.showToast('📋 Room link copied to clipboard!');
            });
          } else {
            this.ui.showToast(`Room #${this.roomId}`);
          }
        };
      } else {
        badge.classList.remove('interactive');
        badge.title = '';
        badge.onclick = null;
      }
    }

    const modeBadge = document.getElementById('mode-badge');
    if (modeBadge) {
      const modeKey = this.state?.gameMode || this.onlineGameMode || 'classic';
      const modeInfo = GAME_MODES[modeKey] || GAME_MODES.classic;
      modeBadge.innerText = modeInfo.badge;
      modeBadge.title = `${modeInfo.name}: ${modeInfo.shortDesc} (Click for rulebook)`;
      modeBadge.onclick = () => {
        document.getElementById('rules-modal')?.classList.remove('hidden');
      };
    }
  }

  // -------------------------------------------------------------
  // ONLINE MULTIPLAYER & NETWORKING
  // -------------------------------------------------------------
  startOnlineGame({ roomId, playerName, playerCount = 2, timerSec = 60, targetPoints = 15, gameMode = 'classic', isHost = false }) {
    this.gameMode = 'online';
    this.roomId = roomId;
    this.onlinePlayerName = playerName;
    this.isOnlineHost = isHost;
    this.onlinePlayerCount = playerCount;
    this.onlineTimerSec = timerSec;
    this.onlineTargetPoints = targetPoints || 15;
    this.onlineGameMode = gameMode || 'classic';

    // Update browser URL
    window.history.pushState({}, '', `?room=${roomId}`);
    this.updateRoomBadge(`🌐 ROOM #${roomId}`);

    // Show Online Waiting Room Modal
    this.showOnlineWaitingModal(roomId);

    // Connect WebSocket
    this.connectWebSocket(roomId, playerName, playerCount, timerSec);
  }

  showOnlineWaitingModal(roomId) {
    const modal = document.getElementById('online-lobby-modal');
    if (!modal) return;

    document.getElementById('online-modal-room-code').innerText = `ROOM #${roomId}`;
    const shareLink = `${window.location.origin}${window.location.pathname}?room=${roomId}`;
    const linkInput = document.getElementById('online-share-link');
    if (linkInput) linkInput.value = shareLink;

    const copyBtn = document.getElementById('btn-copy-room-link');
    if (copyBtn) {
      copyBtn.onclick = () => {
        if (navigator.clipboard) {
          navigator.clipboard.writeText(shareLink).then(() => {
            this.ui.showToast('📋 Room link copied to clipboard!');
          });
        } else {
          linkInput.select();
          document.execCommand('copy');
          this.ui.showToast('📋 Room link copied!');
        }
      };
    }

    const leaveBtn = document.getElementById('btn-leave-online-room');
    if (leaveBtn) {
      leaveBtn.onclick = () => {
        if (this.ws) {
          try { this.ws.close(); } catch (_) {}
          this.ws = null;
        }
        window.history.pushState({}, '', window.location.pathname);
        modal.classList.add('hidden');
        document.getElementById('lobby-modal')?.classList.remove('hidden');
      };
    }

    const forceStartBtn = document.getElementById('btn-force-start-online');
    if (forceStartBtn) {
      forceStartBtn.style.display = this.isOnlineHost ? 'inline-block' : 'none';
      forceStartBtn.onclick = () => {
        if (this.onlinePlayers && this.onlinePlayers.length >= 2) {
          this.initAndBroadcastOnlineGame();
        } else {
          this.ui.showToast('Waiting for at least 1 more player to join...');
        }
      };
    }

    this.renderOnlinePlayersList();
    modal.classList.remove('hidden');
  }

  renderOnlinePlayersList() {
    const listEl = document.getElementById('online-players-list');
    const badgeEl = document.getElementById('online-player-count-badge');
    const statusEl = document.getElementById('online-waiting-status');
    if (!listEl) return;

    const currentCount = this.onlinePlayers.length;
    const maxCount = this.onlinePlayerCount || 2;
    if (badgeEl) badgeEl.innerText = `${currentCount} / ${maxCount}`;

    listEl.innerHTML = '';
    for (let i = 0; i < maxCount; i++) {
      const p = this.onlinePlayers[i];
      const row = document.createElement('div');
      if (p) {
        const isMe = (p.id === this.onlinePlayerId);
        row.className = `online-player-row ${isMe ? 'is-me' : ''}`;
        row.innerHTML = `
          <div style="display:flex; align-items:center; gap:8px;">
            <span style="font-size:16px;">${p.isHost ? '👑' : '🧑'}</span>
            <strong style="color:${isMe ? '#fbbf24' : '#ffffff'}; font-size:13px;">${p.name} ${isMe ? '(You)' : ''}</strong>
          </div>
          <span class="online-status-tag ready">✓ Ready</span>
        `;
      } else {
        row.className = 'online-player-row';
        row.innerHTML = `
          <div style="display:flex; align-items:center; gap:8px; opacity:0.6;">
            <span style="font-size:16px;">⏳</span>
            <span style="font-size:13px; color:var(--text-muted); font-style:italic;">Waiting for Player ${i + 1}...</span>
          </div>
          <span class="online-status-tag waiting">Waiting</span>
        `;
      }
      listEl.appendChild(row);
    }

    if (statusEl) {
      if (currentCount >= maxCount) {
        statusEl.innerText = this.isOnlineHost
          ? '✦ All players joined! Launching game... ✦'
          : '✦ Room is full! Waiting for host to launch... ✦';
        statusEl.style.color = '#34d399';
      } else {
        statusEl.innerText = `⏳ Waiting for ${maxCount - currentCount} more player(s) to join...`;
        statusEl.style.color = '#cbd5e1';
      }
    }
  }

  connectWebSocket(roomId, playerName, playerCount, timerSec) {
    this.updateRoomBadge(`🌐 ROOM #${roomId}`);
    const host = window.location.host || 'localhost:8000';
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const url = `${protocol}//${host}/ws?room=${roomId}`;

    try {
      if (this.ws) {
        try { this.ws.close(); } catch (_) {}
      }
      this.ws = new WebSocket(url);

      this.ws.onopen = () => {
        console.log('Connected to Splendor WebSocket Gateway');
        this.ws.send(JSON.stringify({
          type: 'join_room',
          roomId,
          playerName: playerName || this.onlinePlayerName || 'Merchant',
          playerCount: playerCount || this.onlinePlayerCount || 2,
          timerSec: timerSec || this.onlineTimerSec || 60,
          targetPoints: this.onlineTargetPoints || 15,
          gameMode: this.onlineGameMode || 'classic'
        }));
      };

      this.ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          this.handleNetworkMessage(msg);
        } catch (e) {
          console.error('Error handling WebSocket message:', e);
        }
      };

      this.ws.onerror = (e) => {
        console.warn('WebSocket connection error:', e);
      };

      this.ws.onclose = () => {
        console.log('WebSocket closed');
      };
    } catch (e) {
      console.error('Failed to initialize WebSocket:', e);
      this.ui.showGameAlert('Connection Error', 'Could not connect to multiplayer server. Please ensure server.py is running.');
    }
  }

  handleNetworkMessage(msg) {
    switch (msg.type) {
      case 'room_joined': {
        this.onlinePlayerId = msg.playerId;
        this.isOnlineHost = msg.isHost;
        this.onlinePlayerCount = msg.playerCount;
        this.onlineTimerSec = msg.timerSec;
        if (msg.targetPoints) {
          this.onlineTargetPoints = msg.targetPoints;
        }
        if (msg.gameMode) {
          this.onlineGameMode = msg.gameMode;
        }
        this.updateRoomBadge(`🌐 ROOM #${this.roomId}`);
        this.onlinePlayers = msg.players || [];
        this.renderOnlinePlayersList();

        if (msg.state) {
          // Reconnecting to active game
          this.state = msg.state;
          document.getElementById('online-lobby-modal')?.classList.add('hidden');
          this.ui.setGameMode('online', this.onlinePlayerId);
          this.syncGameState();
          this.ui.showToast(`Reconnected as ${this.onlinePlayerName || 'Player'} (${msg.playerId})`);
        } else {
          // Check if room is now full and I am host
          if (this.isOnlineHost && this.onlinePlayers.length >= this.onlinePlayerCount) {
            setTimeout(() => this.initAndBroadcastOnlineGame(), 600);
          }
        }
        break;
      }

      case 'player_joined': {
        this.onlinePlayers = msg.players || [];
        this.renderOnlinePlayersList();
        soundEngine.playChipClink();
        if (msg.newPlayer) {
          this.ui.showToast(`${msg.newPlayer.name} joined the room!`);
        }
        if (this.isOnlineHost && this.onlinePlayers.length >= this.onlinePlayerCount) {
          setTimeout(() => this.initAndBroadcastOnlineGame(), 600);
        }
        break;
      }

      case 'game_start': {
        this.state = msg.state;
        document.getElementById('online-lobby-modal')?.classList.add('hidden');
        this.ui.setGameMode('online', this.onlinePlayerId);
        soundEngine.playNobleFanfare();
        this.syncGameState();
        this.ui.showToast('✦ Game has started! Good luck. ✦');
        break;
      }

      case 'state_sync': {
        this.state = msg.state;
        if (msg.action) {
          if (msg.action.type === 'take_distinct') {
            this.ui?.flyTokensToPlayer(msg.action.colors, msg.action.playerIndex);
            soundEngine.playChipClink();
          } else if (msg.action.type === 'take_pair') {
            this.ui?.flyTokensToPlayer([msg.action.color, msg.action.color], msg.action.playerIndex);
            soundEngine.playChipClink();
          } else if (msg.action.type === 'purchase') {
            this.ui?.animateCardAction({
              cardId: msg.action.cardId,
              isReserve: false,
              playerIndex: msg.action.playerIndex
            });
            soundEngine.playCardPurchase();
          } else if (msg.action.type === 'reserve') {
            this.ui?.animateCardAction({
              cardId: msg.action.opts?.cardId,
              tier: msg.action.opts?.tier,
              fromDeck: msg.action.opts?.fromDeck,
              isReserve: true,
              playerIndex: msg.action.playerIndex
            });
            soundEngine.playCardSnap();
          }
          if (msg.action.summary) {
            this.ui.showToast(msg.action.summary);
          }
        }
        this.syncGameState();
        break;
      }

      case 'remote_emote': {
        this.ui.displayFloatingEmote(msg.senderName, msg.text);
        break;
      }

      case 'player_left': {
        this.ui.showToast(`⚠️ ${msg.name} left the room`);
        this.onlinePlayers = this.onlinePlayers.filter(p => p.id !== msg.playerId);
        this.renderOnlinePlayersList();
        break;
      }
    }
  }

  initAndBroadcastOnlineGame() {
    if (!this.onlinePlayers || this.onlinePlayers.length < 2) return;
    reshuffleCardArtworks();

    const playerNames = this.onlinePlayers.map(p => p.name);
    const aiConfigs = this.onlinePlayers.map(() => null);

    this.state = createGameState({
      playerNames,
      aiConfigs,
      timeLimitSeconds: this.onlineTimerSec,
      targetPoints: this.onlineTargetPoints || 15,
      gameMode: this.onlineGameMode || 'classic'
    });

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'init_game_state',
        roomId: this.roomId,
        state: this.state
      }));
    }
  }

  broadcastStateIfOnline(action = null) {
    if (this.gameMode === 'online' && this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'update_state',
        roomId: this.roomId,
        state: this.state,
        action
      }));
    }
  }

  sendEmoteNetwork(text) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      const activeName = this.state?.players?.find(p => p.id === this.onlinePlayerId)?.name || this.onlinePlayerName || 'Merchant';
      this.ws.send(JSON.stringify({
        type: 'send_emote',
        roomId: this.roomId,
        senderName: activeName,
        text
      }));
    }
  }
}

// Bootstrap on DOM ready
window.addEventListener('DOMContentLoaded', () => {
  window.app = new SplendorApp();
});

