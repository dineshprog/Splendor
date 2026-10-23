/**
 * Splendor UI Controller
 * Coordinates HUD, board rendering, interaction handling, modals, and charts.
 */

import { GEM_COLORS, ALL_TOKENS, GEM_METADATA, CARDS_BY_ID, NOBLES_BY_ID, getCardArtPath, reshuffleCardArtworks } from './cards-data.js?v=7.0';
import {
  canAffordCard,
  calculateCardPayment,
  countTokens,
  validateTakeDistinctTokens,
  validateTakePairTokens,
  GAME_MODES
} from './engine.js?v=7.0';
import { soundEngine } from './audio.js?v=7.0';
import { Card3DVisualizer } from './card-3d.js?v=7.0';
import { POWERS_DATA } from './powers-data.js?v=7.0';

export class SplendorUI {
  constructor(callbacks) {
    this.callbacks = callbacks;
    this.stagedTokens = { diamond: 0, sapphire: 0, emerald: 0, ruby: 0, onyx: 0 };
    this.timerInterval = null;
    this.state = null;
    this.localPlayerId = 'p_1'; // By default player 1 is local human
    this.gameMode = 'solo'; // 'solo' | 'pass_and_play' | 'online'
    this.historyChartCanvas = null;
    this.onRenamePlayer = callbacks.onRenamePlayer;
    this.card3d = new Card3DVisualizer();

    // Super Powers Celebrations & 3D Flight Queue
    this.pendingPowerCelebrations = [];
    this.isCelebratingPower = false;
    this.processedPowerEvents = new Set();
    this.powerCelebrationTimer = null;
    this.currentCelebration = null;
    this.currentGameId = null;

    this.initDOMElements();
    this.bindEvents();
  }

  setGameMode(mode, localPlayerId = 'p_1') {
    this.gameMode = mode;
    this.localPlayerId = localPlayerId;
  }

  isCurrentPlayerLocal() {
    if (!this.state) return false;
    const activePlayer = this.state.players[this.state.activePlayerIndex];
    if (!activePlayer) return false;
    if (activePlayer.isAi) return false;
    // In pass-and-play, every human player taking turns on this device is local!
    if (this.gameMode === 'pass_and_play') return true;
    return activePlayer.id === this.localPlayerId;
  }

  initDOMElements() {
    // Top bar
    this.turnPill = document.getElementById('turn-pill');
    this.turnTimerEl = document.getElementById('turn-timer');
    this.btnSound = document.getElementById('btn-sound');
    this.btnLog = document.getElementById('btn-log');
    this.btnRules = document.getElementById('btn-rules');

    // Board
    this.noblesContainer = document.getElementById('nobles-container');
    this.cardMatrix = document.getElementById('card-matrix');
    this.stagedTokensDisplay = document.getElementById('staged-tokens-display');
    this.btnConfirmTokens = document.getElementById('btn-confirm-tokens');
    this.btnClearTokens = document.getElementById('btn-clear-tokens');

    // Player dock
    this.playerDock = document.querySelector('.player-dock');
    this.playerDockName = document.getElementById('player-dock-name');
    this.playerDockLbl = document.getElementById('player-dock-lbl');
    this.prestigeVal = document.getElementById('prestige-val');
    this.playerGemHoldings = document.getElementById('player-gem-holdings');
    this.playerTokensContainer = document.getElementById('player-tokens-container');
    this.playerBonusesContainer = document.getElementById('player-bonuses-container');
    this.reservedTray = document.getElementById('reserved-tray');
    this.tokenLimitBadge = document.getElementById('token-limit-badge');

    // Opponents
    this.opponentsContainer = document.getElementById('opponents-container');

    // Modals
    this.cardModal = document.getElementById('card-modal');
    this.discardModal = document.getElementById('discard-modal');
    this.nobleModal = document.getElementById('noble-modal');
    this.gameOverModal = document.getElementById('game-over-modal');
    this.rulesModal = document.getElementById('rules-modal');
    this.alertModal = document.getElementById('alert-modal');
    this.confirmModal = document.getElementById('confirm-modal');
    this.logDrawer = document.getElementById('log-drawer');
    this.logList = document.getElementById('log-list');

    // Super Powers elements
    this.powersColumn = document.getElementById('powers-column');
    this.powersContainer = document.getElementById('powers-container');
    this.powerInspectModal = document.getElementById('power-inspect-modal');
    this.powerModalTitle = document.getElementById('power-modal-title');
    this.powerModalBody = document.getElementById('power-modal-body');
    this.powerModalClose = document.getElementById('power-modal-close');

    // Super Power Celebration Modal elements
    this.powerObtainedModal = document.getElementById('power-obtained-modal');
    this.powerObtainedTitle = document.getElementById('power-obtained-title');
    this.powerObtainedSubtitle = document.getElementById('power-obtained-subtitle');
    this.powerObtainedCard = document.getElementById('power-obtained-card');
    this.btnClaimPowerAnim = document.getElementById('btn-claim-power-anim');

    // Arcane Draft Modal elements (Every 4 rounds)
    this.powerDraftModal = document.getElementById('power-draft-modal');
    this.powerDraftTitle = document.getElementById('power-draft-title');
    this.powerDraftSubtitle = document.getElementById('power-draft-subtitle');
    this.draftChooserName = document.getElementById('draft-chooser-name');
    this.powerDraftCardsContainer = document.getElementById('power-draft-cards-container');
    this.draftCard0 = document.getElementById('draft-card-0');
    this.draftCard1 = document.getElementById('draft-card-1');
    this.btnConfirmDraftPick = document.getElementById('btn-confirm-draft-pick');
    this.selectedDraftPowerId = null;

    // Emotes
    this.emotesDrawer = document.getElementById('emotes-drawer');
    this.btnEmotes = document.getElementById('btn-emotes');
  }

  bindEvents() {
    // Rename merchant trigger
    const btnRename = document.getElementById('btn-rename-merchant');
    btnRename?.addEventListener('click', (e) => {
      e.stopPropagation();
      if (this.currentDockPlayer?.isAi) return;
      this.onRenamePlayer?.(this.currentDockPlayerIndex !== undefined ? this.currentDockPlayerIndex : 0);
    });
    this.playerDockName?.addEventListener('click', (e) => {
      e.stopPropagation();
      if (this.currentDockPlayer?.isAi) return;
      this.onRenamePlayer?.(this.currentDockPlayerIndex !== undefined ? this.currentDockPlayerIndex : 0);
    });

    // Sound toggle
    this.btnSound?.addEventListener('click', () => {
      const enabled = soundEngine.toggleSound();
      this.btnSound.innerHTML = enabled ? '🔊 Sound: ON' : '🔇 Sound: OFF';
    });

    // Move Log Drawer
    this.btnLog?.addEventListener('click', () => {
      this.logDrawer?.classList.toggle('open');
    });
    document.getElementById('btn-close-log')?.addEventListener('click', () => {
      this.logDrawer?.classList.remove('open');
    });

    // Rulebook
    this.btnRules?.addEventListener('click', () => {
      this.rulesModal?.classList.remove('hidden');
    });
    document.getElementById('btn-close-rules')?.addEventListener('click', () => {
      this.rulesModal?.classList.add('hidden');
    });

    // Emotes toggle
    this.btnEmotes?.addEventListener('click', () => {
      this.emotesDrawer?.classList.toggle('hidden');
    });

    document.querySelectorAll('.emote-pill').forEach(btn => {
      btn.addEventListener('click', () => {
        const text = btn.getAttribute('data-emote');
        this.broadcastEmote(text);
        this.emotesDrawer?.classList.add('hidden');
      });
    });

    // Staged token buttons
    this.btnConfirmTokens?.addEventListener('click', () => {
      this.confirmStagedTokens();
    });
    this.btnClearTokens?.addEventListener('click', () => {
      this.clearStagedTokens();
    });

    // Power Inspect Modal close
    this.powerModalClose?.addEventListener('click', () => {
      this.powerInspectModal?.classList.add('hidden');
    });

    // Super Power Claim & 3D Fly button
    this.btnClaimPowerAnim?.addEventListener('click', () => {
      this.claimAndFlyPower();
    });

    // Arcane Draft Confirm Selection
    this.btnConfirmDraftPick?.addEventListener('click', () => {
      if (!this.selectedDraftPowerId) return;
      const picked = this.selectedDraftPowerId;
      this.selectedDraftPowerId = null;
      this.powerDraftModal?.classList.add('hidden');
      this.callbacks.onChooseDraftPower?.(picked);
    });

    // Close Modals on backdrop click
    [this.cardModal, this.rulesModal, this.powerInspectModal, this.powerObtainedModal].forEach(modal => {
      modal?.addEventListener('click', (e) => {
        if (e.target === modal) {
          if (modal === this.powerObtainedModal) {
            this.claimAndFlyPower();
          } else {
            modal.classList.add('hidden');
          }
        }
      });
    });
  }

  /**
   * Main render method called whenever state changes
   */
  render(state) {
    this.state = state;

    // Reset celebration queue if new match
    if (this.currentGameId !== state.gameId) {
      this.currentGameId = state.gameId;
      this.pendingPowerCelebrations = [];
      this.processedPowerEvents = new Set();
      this.isCelebratingPower = false;
      this.selectedDraftPowerId = null;
      if (this.powerCelebrationTimer) {
        clearInterval(this.powerCelebrationTimer);
        this.powerCelebrationTimer = null;
      }
    }

    const isTwoPlayer = state.players.length === 2;
    const activePlayer = state.players[state.activePlayerIndex];
    const isLocalTurn = this.isCurrentPlayerLocal();

    this.renderHeader(state, activePlayer, isLocalTurn);
    this.renderTopPlayerTable(state, isTwoPlayer);
    this.renderSuperPowers(state);
    this.renderNobles(state);
    this.renderCardMatrix(state, activePlayer, isLocalTurn);
    this.renderBankControls(state, isLocalTurn);
    this.renderPlayerDock(state, activePlayer, isTwoPlayer);
    this.renderOpponents(state, isTwoPlayer);
    this.renderMoveLog(state);

    // Check for newly awakened Super Powers to celebrate & fly to dashboard
    this.checkAndQueuePowerCelebrations(state);

    this.handlePendingModals(state);
    this.updateTurnTimer(state);

    if (state.status === 'completed' && !this.gameOverShown) {
      this.showGameOverModal(state);
      this.gameOverShown = true;
    }
  }

  getModeObjectiveHTML(player, state) {
    if (!state || !state.gameMode || state.gameMode === 'classic' || !player) return '';
    const mode = state.gameMode;
    if (mode === 'onyx_syndicate') {
      const onyxCount = player.bonuses?.onyx || 0;
      return `<div class="mode-indicator-pill ${onyxCount >= 8 ? 'highlight' : ''}" title="Shadow Syndicate: Collect 10 Onyx Cards to win">🖤 ${onyxCount}/10 Onyx</div>`;
    }
    if (mode === 'tier_ladder') {
      const t1 = player.cardsPurchased.filter(id => CARDS_BY_ID[id] && CARDS_BY_ID[id].tier === 1).length;
      const t2 = player.cardsPurchased.filter(id => CARDS_BY_ID[id] && CARDS_BY_ID[id].tier === 2).length;
      return `<div class="mode-indicator-pill" title="Guild Ladder: Need 6 T1 for T2, 6 T2 for T3">🪜 T1:${Math.min(6, t1)}/6${t1 >= 6 ? '✓' : ''} T2:${Math.min(6, t2)}/6${t2 >= 6 ? '✓' : ''}</div>`;
    }
    if (mode === 'color_supremacy') {
      const trophies = player.trophies || 0;
      const badges = (player.claimedColors || []).map(c => GEM_METADATA[c]?.symbol || c).join('');
      return `<div class="mode-indicator-pill ${trophies >= 2 ? 'highlight' : ''}" title="Color Monopoly: First to 5 in a color = 1 Trophy. 3 to win!">⭐ ${trophies}/3 Trophies ${badges ? `[${badges}]` : ''}</div>`;
    }
    if (mode === 'noble_court') {
      const nobles = player.noblesAcquired.length;
      return `<div class="mode-indicator-pill ${nobles >= 2 ? 'highlight' : ''}" title="Noble Court: First to 3 Noble Patrons wins!">⚜️ ${nobles}/3 Nobles</div>`;
    }
    if (mode === 'rainbow_guild') {
      const completed = GEM_COLORS.filter(c => (player.bonuses[c] || 0) >= 3).length;
      return `<div class="mode-indicator-pill ${completed >= 4 ? 'highlight' : ''}" title="Renaissance Prism: Own >= 3 cards in all 5 colors">🌈 ${completed}/5 Colors</div>`;
    }
    if (mode === 'super_powers') {
      const claimedCount = (player.powersClaimed || []).length;
      if (state.powersRule === 'draft_every_4_rounds') {
        return `<div class="mode-indicator-pill ${claimedCount > 0 ? 'highlight' : ''}" title="Arcane Draft: ${claimedCount} Powers Claimed">⚡ ${claimedCount} Powers Active</div>`;
      }
      if (!state.powersRevealed) {
        return `<div class="mode-indicator-pill" title="Super Powers: Sealed for first 5 rounds, unlocks Rd 6">🔒 Sealed (Rd ${state.roundIndex}/5)</div>`;
      }
      return `<div class="mode-indicator-pill ${claimedCount > 0 ? 'highlight' : ''}" title="Super Powers: ${claimedCount} Powers Claimed">⚡ ${claimedCount} Powers Active</div>`;
    }
    if (state.superPowersEnabled) {
      const claimedCount = (player.powersClaimed || []).length;
      if (claimedCount > 0) {
        return `<div class="mode-indicator-pill highlight" title="Super Powers: ${claimedCount} Powers Claimed">⚡ ${claimedCount} Powers</div>`;
      }
    }
    return '';
  }

  getCurseBadgesHTML(player) {
    if (!player) return '';
    const badges = [];
    if (player.activeCurses) {
      for (const [key, c] of Object.entries(player.activeCurses)) {
        if (!c) continue;
        if (key === 'guild_embargo' && c.roundsLeft > 0) {
          const col = c.color || c.blockedColor || 'gem';
          badges.push(`<span class="curse-badge" title="Guild Embargo: Cannot use ${col} card discounts for ${c.roundsLeft} round(s)">🚫 Embargo (${col}) (${c.roundsLeft}r)</span>`);
        } else if (key === 'sovereign_sanction' && c.roundsLeft > 0) {
          badges.push(`<span class="curse-badge" title="Sovereign Sanctions: Cannot purchase Tier 3 cards for ${c.roundsLeft} round(s)">🛡️ Sanctions (Tier 3) (${c.roundsLeft}r)</span>`);
        } else if (key === 'coinage_mandate' && c.roundsLeft > 0) {
          badges.push(`<span class="curse-badge" title="Coinage Mandate: All card purchases must be paid in physical tokens/gold for ${c.roundsLeft} round(s)">🪙 Cash Only (${c.roundsLeft}r)</span>`);
        } else if (key === 'imperial_tithe' && (c.chargesLeft > 0 || c.charges > 0)) {
          const ch = c.chargesLeft || c.charges;
          badges.push(`<span class="curse-badge" title="Imperial Tithe: Must pay +3 tokens surcharge on next ${ch} purchase(s)">⚖️ +3 Tithe (${ch} buys)</span>`);
        } else if (key === 'gem_embargo' && c.roundsLeft > 0) {
          const col = c.color || c.blockedColor || 'gem';
          badges.push(`<span class="curse-badge" title="Market Interdict: Barred from taking ${col} tokens for ${c.roundsLeft} round(s)">⛔ Interdict (${col}) (${c.roundsLeft}r)</span>`);
        }
      }
    }
    if (player.vaultLimit && player.vaultLimit < 10) {
      badges.push(`<span class="curse-badge" title="Vault Lockdown: Vault slashed to ${player.vaultLimit} tokens max">⛓️ Vault ${player.vaultLimit} max</span>`);
    }
    if (badges.length === 0) return '';
    return `<div class="player-curses-row" style="display:flex; flex-wrap:wrap; gap:4px; margin-top:3px; justify-content:center;">${badges.join('')}</div>`;
  }

  renderHeader(state, activePlayer, isLocalTurn) {
    if (this.turnPill) {
      this.turnPill.className = `turn-pill ${isLocalTurn ? 'my-turn' : ''}`;
      this.turnPill.innerHTML = `
        <span>Turn ${state.turnIndex + 1} (Round ${state.roundIndex})</span>
        <strong style="color: ${isLocalTurn ? '#fbbf24' : '#ffffff'};">${activePlayer.name}${activePlayer.isAi ? ' (AI)' : ''}</strong>
      `;
    }

    const modeBadge = document.getElementById('mode-badge');
    if (modeBadge && state.gameMode) {
      const modeConfig = GAME_MODES[state.gameMode] || GAME_MODES.classic;
      modeBadge.innerText = modeConfig.badge;
      modeBadge.title = `${modeConfig.name}: ${modeConfig.shortDesc} (Click for rulebook)`;
      modeBadge.onclick = () => {
        document.getElementById('rules-modal')?.classList.remove('hidden');
      };
    }
  }

  setAiThinking(name, difficulty) {
    if (this.turnPill) {
      const diffLabel = difficulty === 'grandmaster' ? 'Grandmaster' : difficulty ? (difficulty.charAt(0).toUpperCase() + difficulty.slice(1)) : 'AI';
      this.turnPill.className = 'turn-pill ai-thinking';
      this.turnPill.innerHTML = `
        <span style="font-size:13px; animation: pulse 1s infinite;">🤔</span>
        <strong style="color:#fbbf24;">${name} (${diffLabel})</strong>
        <span style="font-size:11px; color:#cbd5e1; font-style:italic;">calculating move...</span>
      `;
    }
    const topBadge = document.querySelector('#top-player-table .prestige-lbl');
    if (topBadge && document.getElementById('top-player-table')?.classList.contains('active-turn')) {
      topBadge.textContent = '🤔 THINKING...';
    }
  }

  /**
   * Render Top Player Table (Opposite Side) in 2-Player Head-to-Head Mode
   */
  renderTopPlayerTable(state, isTwoPlayer) {
    const topTable = document.getElementById('top-player-table');
    if (!topTable) return;

    if (!isTwoPlayer) {
      topTable.classList.add('hidden');
      return;
    }

    topTable.classList.remove('hidden');
    const topPlayer = (this.gameMode === 'online')
      ? (state.players.find(p => p.id !== this.localPlayerId) || state.players[1])
      : state.players[1];
    const topPlayerIndex = state.players.indexOf(topPlayer);
    const isTopTurn = state.activePlayerIndex === topPlayerIndex;
    const isTopLocal = (this.gameMode === 'pass_and_play') && !topPlayer.isAi;

    topTable.className = `top-player-table ${isTopTurn ? 'active-turn' : ''}`;

    const isRenameAllowed = !topPlayer.isAi && this.gameMode !== 'online';

    const isPureObjective = ['onyx_syndicate', 'color_supremacy', 'noble_court', 'rainbow_guild'].includes(state.gameMode);
    let topScoreHtml = '';
    let topScoreLabel = isTopTurn ? '👑 ACTIVE TURN' : (isPureObjective ? 'OBJECTIVE' : 'OPPONENT');
    if (isPureObjective) {
      if (state.gameMode === 'onyx_syndicate') {
        topScoreHtml = `<span style="font-family:var(--font-serif); font-size:20px; font-weight:800; color:#cbd5e1; line-height:1;">🖤 ${topPlayer.bonuses?.onyx || 0}<span style="font-size:12px; opacity:0.65; margin-left:2px;">/10</span> <span style="font-size:11px;">ONYX</span></span>`;
      } else if (state.gameMode === 'color_supremacy') {
        topScoreHtml = `<span style="font-family:var(--font-serif); font-size:20px; font-weight:800; color:#fbbf24; line-height:1;">⭐ ${topPlayer.trophies || 0}<span style="font-size:12px; opacity:0.65; margin-left:2px;">/3</span> <span style="font-size:11px;">BADGES</span></span>`;
      } else if (state.gameMode === 'noble_court') {
        topScoreHtml = `<span style="font-family:var(--font-serif); font-size:20px; font-weight:800; color:#fbbf24; line-height:1;">⚜️ ${topPlayer.noblesAcquired.length}<span style="font-size:12px; opacity:0.65; margin-left:2px;">/3</span> <span style="font-size:11px;">NOBLES</span></span>`;
      } else if (state.gameMode === 'rainbow_guild') {
        const done = GEM_COLORS.filter(c => (topPlayer.bonuses[c] || 0) >= 3).length;
        topScoreHtml = `<span style="font-family:var(--font-serif); font-size:20px; font-weight:800; color:#38bdf8; line-height:1;">🌈 ${done}<span style="font-size:12px; opacity:0.65; margin-left:2px;">/5</span> <span style="font-size:11px;">COLORS</span></span>`;
      }
    } else {
      topScoreHtml = `<span style="font-family:var(--font-serif); font-size:24px; font-weight:800; color:var(--text-gold); line-height:1;">
        ${topPlayer.prestigePoints}<span style="font-size:12px; opacity:0.65; font-weight:600; margin-left:2px;">/${state.targetPoints || 15}</span> PTS
      </span>`;
    }

    topTable.innerHTML = `
      <!-- Left: Top Player Info & Prestige & Combined Gem Holdings -->
      <div style="display:flex; align-items:center; gap:10px; flex-shrink:0;">
        <div class="prestige-badge" style="padding:3px 10px; min-width:78px; text-align:center;">
          <div style="font-size:10px; color:${isTopTurn ? '#fbbf24' : 'var(--text-muted)'}; font-weight:800; letter-spacing:1px; text-transform:uppercase; display:flex; align-items:center; justify-content:center; gap:4px;">
            <span id="top-player-name-text" class="${isRenameAllowed ? 'player-dock-name-btn' : ''}" title="${isRenameAllowed ? 'Click to rename opponent' : ''}">${topPlayer.name} ${topPlayer.isAi ? '(AI)' : ''}</span>
            ${isRenameAllowed ? '<button id="btn-rename-p2" class="rename-icon-btn" title="Rename Opponent">✏️</button>' : ''}
          </div>
          ${topScoreHtml}
          <span class="prestige-lbl" style="font-size:8px;">${topScoreLabel}</span>
          ${this.getCurseBadgesHTML(topPlayer)}
        </div>

        <div class="holdings-group">
          <div class="holdings-label" style="font-size:9px;">
            <span>Gem Holdings</span>
            <span style="font-weight:bold; color:${countTokens(topPlayer.tokens) > (topPlayer.vaultLimit || 10) ? '#ef4444' : 'var(--text-muted)'};">${countTokens(topPlayer.tokens)} / ${topPlayer.vaultLimit || 10} Tokens</span>
          </div>
          <div id="p2-gem-holdings" class="gem-holdings-rack"></div>
          <div id="p2-bonuses-container" style="display:none;"></div>
        </div>
      </div>

      <!-- Center: Top Player Reserved Cards Dock -->
      <div class="dock-center">
        <div class="holdings-label" style="font-size:9px;">
          <span>Reserved Cards</span>
          <span style="font-weight:bold; color:var(--text-muted);">${topPlayer.cardsReserved.length} / ${topPlayer.reserveLimit || 3}</span>
        </div>
        <div id="p2-reserved-tray" class="reserved-tray"></div>
      </div>

      <!-- Right: Top Player Nobles Taken -->
      <div class="dock-right">
        <div class="holdings-label" style="font-size:9px; display:flex; justify-content:space-between; align-items:center; width:100%;">
          <span>👑 Nobles</span>
          <span id="p2-nobles-count" style="color:var(--text-gold); font-weight:800;">${topPlayer.noblesAcquired.length}</span>
        </div>
        <div id="p2-nobles-tray" class="player-nobles-tray"></div>
        <div id="p2-powers-tray" class="claimed-powers-list" style="margin-top:2px;"></div>
      </div>
    `;

    if (isRenameAllowed && this.onRenamePlayer) {
      const btnRenameP2 = document.getElementById('btn-rename-p2');
      const textRenameP2 = document.getElementById('top-player-name-text');
      btnRenameP2?.addEventListener('click', (e) => {
        e.stopPropagation();
        this.onRenamePlayer(topPlayerIndex);
      });
      textRenameP2?.addEventListener('click', (e) => {
        e.stopPropagation();
        this.onRenamePlayer(topPlayerIndex);
      });
    }

    // Render Top Player's combined gem holdings (tokens on stacked cards)
    this.renderCombinedGemHoldings(document.getElementById('p2-gem-holdings'), topPlayer);

    // Render Top Player's reserved hand
    const p2Tray = document.getElementById('p2-reserved-tray');
    if (p2Tray) {
      const p2Slots = Math.max(3, topPlayer.reserveLimit || 3);
      for (let i = 0; i < p2Slots; i++) {
        const cardId = topPlayer.cardsReserved[i];
        const miniCard = document.createElement('div');
        if (cardId) {
          const card = CARDS_BY_ID[cardId];
          const canAfford = canAffordCard(topPlayer, card);
          const payment = canAfford ? calculateCardPayment(topPlayer, card) : null;
          miniCard.className = `reserved-mini-card card-gem-${card.gemBonus} ${canAfford ? 'affordable-now' : ''}`;
          miniCard.dataset.cardId = card.id;
          miniCard.innerHTML = `
            <img class="mini-card-art-img" src="${getCardArtPath(card)}" alt="Reserved" onerror="this.src='assets/cards/t${card.tier}_${card.gemBonus}.jpg'" />
            <div class="mini-card-overlay"></div>
            <div class="mini-card-content-layer">
              <div style="display:flex; justify-content:space-between; align-items:center;">
                <span style="font-weight:bold; color:var(--text-gold); font-size:12px;">+${card.prestigePoints}</span>
                <span class="cost-badge gem-${card.gemBonus}" style="padding:1px 3px; font-size:9px;">${GEM_METADATA[card.gemBonus].symbol}</span>
              </div>
              <div style="font-size:8px; text-align:center; opacity:0.6;">Tier ${card.tier}</div>
              <div style="display:flex; flex-wrap:wrap; gap:2px;">
                ${Object.entries(card.cost).map(([c, n]) => `<span class="cost-badge gem-${c}" style="font-size:7.5px; padding:1px 2px;">${n}</span>`).join('')}
              </div>
            </div>
          `;
          if (isTopTurn && isTopLocal) {
            miniCard.style.cursor = 'pointer';
            miniCard.onclick = () => this.inspectCard(card, canAfford, payment, true);
          }
        } else {
          miniCard.className = 'reserved-mini-card empty';
          miniCard.innerHTML = `Slot ${i + 1}`;
        }
        p2Tray.appendChild(miniCard);
      }
    }

    // Render Top Player's Nobles Taken & Claimed Powers
    const p2NoblesTray = document.getElementById('p2-nobles-tray');
    const p2NoblesCount = document.getElementById('p2-nobles-count');
    this.renderNoblesAcquiredTray(p2NoblesTray, p2NoblesCount, topPlayer);
    const p2PowersTray = document.getElementById('p2-powers-tray');
    this.renderClaimedPowers(p2PowersTray, topPlayer, state);
  }

  /**
   * Combined Gem Holdings: renders 5 gem card stacks + 1 Gold Joker slot.
   * Matches user's design:
   * - Front card face shows token count in bold and gem color theme
   * - If player owns multiple cards of that gem, peeking card edges layer underneath
   *   (e.g., 3 cards total = 1 main card face + 2 peeking card edges below it)
   */
  renderCombinedGemHoldings(containerEl, player) {
    if (!containerEl || !player) return;
    containerEl.className = 'gem-holdings-rack';
    containerEl.innerHTML = '';

    const GEM_EMBLEMS = { diamond: '💎', sapphire: '🔷', emerald: '⬟', ruby: '🔺', onyx: '⬢' };

    // 5 Gem colors
    GEM_COLORS.forEach(color => {
      const tokenCount = player.tokens[color] || 0;
      const cards = (player.cardsPurchased || [])
        .map(id => CARDS_BY_ID[id])
        .filter(c => c && c.gemBonus === color);
      const cardsCount = cards.length;

      const stackWrap = document.createElement('div');
      stackWrap.className = 'gem-card-stack';
      stackWrap.title = `${player.name}: ${tokenCount} ${color.toUpperCase()} token(s), ${cardsCount} bonus card(s). ${cardsCount > 0 ? 'Click to inspect cards.' : ''}`;

      const isZeroAll = (tokenCount === 0 && cardsCount === 0);
      const hasNoCards = (cardsCount === 0);

      // Top / main card face
      const mainCard = document.createElement('div');
      mainCard.className = `card-stack-main card-gem-${color} card-stack-gem-${color} ${isZeroAll ? 'zero-all' : ''} ${hasNoCards && !isZeroAll ? 'no-cards' : ''}`;

      mainCard.innerHTML = `
        <div class="card-stack-top-bar">
          <span class="card-bonus-gem gem-${color}" style="width:17px; height:17px; font-size:10px; border-radius:3px; box-shadow:0 2px 4px rgba(0,0,0,0.6);" title="${color.toUpperCase()} Gem">${GEM_METADATA[color].symbol}</span>
          <span class="card-stack-badge" title="${cardsCount} Permanent Card Bonus(es)">${cardsCount > 0 ? `+${cardsCount}` : '0'}</span>
        </div>
        <div class="card-stack-token-val" title="${tokenCount} tokens held">${tokenCount}</div>
      `;
      stackWrap.appendChild(mainCard);

      // Sublayers: peeking card edges beneath the top card (capped at max 3 to prevent vertical overflow)
      if (cardsCount > 1) {
        const sublayers = document.createElement('div');
        sublayers.className = 'card-stack-sublayers';

        const visibleSlices = Math.min(cardsCount - 1, 3);
        for (let i = 0; i < visibleSlices; i++) {
          const edge = document.createElement('div');
          edge.className = `card-stack-peeking-edge card-gem-${color}`;
          sublayers.appendChild(edge);
        }
        stackWrap.appendChild(sublayers);
      }

      // Clicking card stack: inspect purchased cards
      if (cards.length > 0) {
        stackWrap.onclick = (e) => {
          e.stopPropagation();
          if (cards.length === 1) {
            this.inspectCard(cards[0], false, null, 'purchased');
          } else {
            this.inspectPurchasedGemGroup(cards, color, player);
          }
        };
      }

      containerEl.appendChild(stackWrap);
    });

    // 6th Slot: Gold Wildcard Joker tokens
    const goldCount = player.tokens.gold || 0;
    const goldStack = document.createElement('div');
    goldStack.className = 'gem-card-stack';
    goldStack.title = `${player.name}: ${goldCount} Gold Joker token(s) (Wildcard)`;

    const goldCard = document.createElement('div');
    goldCard.className = `card-stack-main card-gem-gold ${goldCount === 0 ? 'zero-all' : ''}`;
    goldCard.innerHTML = `
      <div class="card-stack-top-bar">
        <span class="card-bonus-gem gem-gold" style="width:17px; height:17px; font-size:10px; border-radius:3px; box-shadow:0 2px 4px rgba(0,0,0,0.6);" title="Gold Joker Wildcard">★</span>
        <span class="card-stack-badge" style="color:#ffffff; background:rgba(0,0,0,0.5);">Wild</span>
      </div>
      <div class="card-stack-token-val">${goldCount}</div>
    `;
    goldStack.appendChild(goldCard);
    containerEl.appendChild(goldStack);
  }

  /**
   * Modal dialog to inspect all purchased cards for a specific gem color
   */
  inspectPurchasedGemGroup(cards, color, player) {
    if (!this.cardModal) return;
    soundEngine.playCardSnap();

    const titleEl = document.getElementById('card-modal-title');
    const bodyEl = document.getElementById('card-modal-body');
    const actionsEl = document.getElementById('card-modal-actions');

    const totalPts = cards.reduce((sum, c) => sum + (c.prestigePoints || 0), 0);

    titleEl.innerHTML = `${player.name}'s ${color.toUpperCase()} Cards (${cards.length} cards · +${totalPts} PTS)`;

    bodyEl.innerHTML = `
      <div style="font-size:12px; color:var(--text-muted); margin-bottom:10px;">
        All ${cards.length} permanent ${color} bonus cards acquired by ${player.name}:
      </div>
      <div style="display:flex; flex-direction:column; gap:8px; max-height:260px; overflow-y:auto; padding-right:4px;">
        ${cards.map((c) => `
          <div class="card-gem-${color}" style="display:flex; justify-content:space-between; align-items:center; padding:8px 12px; border-radius:6px; border:1px solid rgba(255,255,255,0.2);">
            <div>
              <div style="font-size:12px; font-weight:bold; color:var(--text-gold);">
                Tier ${c.tier} Development Card ${c.prestigePoints > 0 ? `(+${c.prestigePoints} Prestige)` : ''}
              </div>
              <div style="display:flex; gap:4px; margin-top:4px;">
                ${Object.entries(c.cost).map(([gem, cost]) => `
                  <span class="cost-badge gem-${gem}" style="font-size:9px; padding:1px 4px;">${gem} × ${cost}</span>
                `).join('')}
              </div>
            </div>
            <div style="font-size:18px; font-weight:800; color:var(--text-gold);">
              ${c.prestigePoints > 0 ? `+${c.prestigePoints}` : ''}
            </div>
          </div>
        `).join('')}
      </div>
    `;

    actionsEl.innerHTML = `
      <button class="secondary-btn" style="width:100%;" id="btn-close-purchased-group">Close</button>
    `;
    document.getElementById('btn-close-purchased-group')?.addEventListener('click', () => {
      this.cardModal.classList.add('hidden');
    });

    this.cardModal.classList.remove('hidden');
  }

  /**
   * Compatibility wrapper for permanent bonus stacks
   */
  renderPermanentBonusStacks(containerEl, player) {
    this.renderCombinedGemHoldings(containerEl, player);
  }

  /**
   * Render Super Powers Column (Shown in Super Powers mode, to the left of Nobles)
   */
  renderSuperPowers(state) {
    if (!this.powersColumn || !this.powersContainer) return;

    if (!state.superPowersEnabled || state.powersRule !== 'feats') {
      this.powersColumn.classList.add('hidden');
      return;
    }

    this.powersColumn.classList.remove('hidden');
    this.powersContainer.innerHTML = '';

    const availablePowers = state.availablePowers || [];

    // First 5 rounds: Powers are sealed (7 slots)
    if (!state.powersRevealed) {
      for (let i = 0; i < 7; i++) {
        const sealedCard = document.createElement('div');
        sealedCard.className = 'power-card sealed';
        sealedCard.title = `Arcane Power Seal #${i + 1} · Shatters at Round 6! Click to inspect`;
        sealedCard.onclick = () => {
          this.inspectSealedPower(state.roundIndex);
        };
        sealedCard.innerHTML = `
          <div class="seal-icon">🔒</div>
          <div class="seal-title">Arcane Seal</div>
          <div class="seal-countdown">Rd ${state.roundIndex} / 5</div>
          <div class="seal-subtitle">Unlocks at Rd 6</div>
        `;
        this.powersContainer.appendChild(sealedCard);
      }
      return;
    }

    // Round 6+: Revealed powers!
    availablePowers.forEach((powerState) => {
      const powerDef = POWERS_DATA[powerState.id];
      if (!powerDef) return;

      const isClaimed = powerState.claimedBy !== null;
      const claimedPlayer = isClaimed ? state.players.find(p => p.id === powerState.claimedBy) : null;
      const card = document.createElement('div');
      card.className = `power-card revealed tier-${powerState.tier} ${isClaimed ? 'claimed' : ''}`;
      card.style.cursor = 'pointer';
      card.title = `${powerState.name} (${powerDef.tierName}) · Click to inspect details`;
      card.onclick = () => this.inspectPower(powerState, powerDef, state);

      const activePlayer = state.players[state.activePlayerIndex];
      let featProgress = isClaimed 
        ? `✓ ${claimedPlayer ? claimedPlayer.name : 'Claimed'}` 
        : powerDef.getFeatProgress(state, activePlayer);

      card.innerHTML = `
        <div class="power-card-header">
          <span class="power-tier-badge">${powerState.tier}</span>
          <span class="power-type-pill">${powerState.type.toUpperCase()}</span>
        </div>
        <div class="power-card-body">
          <div class="power-card-icon">${powerState.icon}</div>
          <div class="power-card-name" title="${powerState.name}">${powerState.name}</div>
        </div>
        <div class="power-feat-badge" title="${powerDef.featDesc}">${featProgress}</div>
      `;

      this.powersContainer.appendChild(card);
    });
  }

  /**
   * Inspect a sealed arcane power
   */
  inspectSealedPower(currentRound) {
    if (!this.powerInspectModal || !this.powerModalBody) return;
    this.powerModalTitle.textContent = '🔒 Sealed Arcane Power';
    const roundsLeft = Math.max(1, 6 - currentRound);
    this.powerModalBody.innerHTML = `
      <div class="power-modal-card" style="border-color:#a855f7; text-align:center;">
        <div style="font-size:42px; margin-bottom:8px; filter:drop-shadow(0 0 10px #c084fc);">🔒</div>
        <div style="font-family:var(--font-serif); font-size:18px; font-weight:700; color:#c084fc; letter-spacing:1px;">
          ARCANE GUILD SEAL
        </div>
        <div style="font-size:13px; color:#cbd5e1; line-height:1.6; margin-top:8px;">
          Seven legendary Super Powers have been infused into this match. Ancient guild treaties keep them sealed during the opening 5 rounds of the game.
        </div>
        <div style="margin-top:14px; background:rgba(251,191,36,0.1); border:1px solid rgba(251,191,36,0.3); border-radius:8px; padding:10px; color:#fbbf24; font-weight:700; font-size:14px;">
          ⏳ Currently in Round ${currentRound} / 5<br>
          <span style="font-size:12px; font-weight:normal; color:#e2e8f0;">Unlocks automatically at the start of Round 6 (${roundsLeft} round${roundsLeft > 1 ? 's' : ''} left)!</span>
        </div>
      </div>
    `;
    this.powerInspectModal.classList.remove('hidden');
  }

  /**
   * Inspect an unlocked super power
   */
  inspectPower(powerState, powerDef, state) {
    if (!this.powerInspectModal || !this.powerModalBody) return;
    const isClaimed = powerState.claimedBy !== null;
    const claimedPlayer = isClaimed ? state.players.find(p => p.id === powerState.claimedBy) : null;
    const activePlayer = state.players[state.activePlayerIndex];
    const featProgress = isClaimed 
      ? `Claimed by ${claimedPlayer ? claimedPlayer.name : 'Player'}` 
      : powerDef.getFeatProgress(state, activePlayer);

    this.powerModalTitle.textContent = `⚡ ${powerState.name}`;
    this.powerModalBody.innerHTML = `
      <div class="power-modal-card" style="border-color:${powerState.colorHex};">
        <div class="power-modal-header">
          <div class="power-modal-icon">${powerState.icon}</div>
          <div class="power-modal-info">
            <div class="power-modal-name">${powerState.name}</div>
            <div style="display:flex; gap:6px; align-items:center;">
              <span class="power-tier-badge" style="background:${powerState.colorHex}22; color:${powerState.colorHex}; border:1px solid ${powerState.colorHex}66;">
                ${powerDef.tierName}
              </span>
              <span class="power-type-pill">${powerDef.type.toUpperCase()}</span>
              ${isClaimed ? `<span style="font-size:10px; color:#4ade80; font-weight:700; background:rgba(34,197,94,0.15); padding:1px 6px; border-radius:4px; border:1px solid rgba(34,197,94,0.4);">✓ Claimed by ${claimedPlayer ? claimedPlayer.name : ''}</span>` : ''}
            </div>
          </div>
        </div>

        <div class="power-modal-desc" style="border-left-color:${powerState.colorHex};">
          <strong>Effect:</strong> ${powerDef.description}
        </div>

        <div class="power-modal-feat">
          <div style="font-weight:700; color:#fbbf24; margin-bottom:3px; display:flex; justify-content:space-between;">
            <span>🎯 Unlocking Feat:</span>
            <span>${featProgress}</span>
          </div>
          <div>${powerDef.featDesc}</div>
        </div>
      </div>
    `;
    this.powerInspectModal.classList.remove('hidden');
  }

  /**
   * Render claimed power badges on player dock or opponent view
   */
  renderClaimedPowers(containerEl, player, state) {
    if (!containerEl) return;
    containerEl.innerHTML = '';
    const powers = player?.powersClaimed || [];
    if (powers.length === 0) return;

    powers.forEach(powerId => {
      const def = POWERS_DATA[powerId];
      if (!def) return;
      const chip = document.createElement('div');
      chip.className = 'claimed-power-badge';
      chip.style.borderColor = def.colorHex;
      chip.title = `${def.name} (${def.tierName}): ${def.shortDesc}`;
      chip.innerHTML = `<span>${def.icon}</span> <span>${def.name}</span>`;
      chip.onclick = () => {
        const pState = (state.availablePowers || []).find(p => p.id === powerId) || {
          id: def.id,
          name: def.name,
          tier: def.tier,
          tierName: def.tierName,
          colorHex: def.colorHex,
          icon: def.icon,
          type: def.type,
          claimedBy: player.id
        };
        this.inspectPower(pState, def, state);
      };
      containerEl.appendChild(chip);
    });
  }

  /**
   * Queue Super Power unlock celebrations
   */
  checkAndQueuePowerCelebrations(state) {
    if (!state.unlockedPowerEvents || state.unlockedPowerEvents.length === 0) return;

    for (const ev of state.unlockedPowerEvents) {
      const key = `${ev.powerId}_${ev.playerId}_${ev.timestamp || 0}`;
      if (!this.processedPowerEvents.has(key)) {
        this.processedPowerEvents.add(key);
        this.pendingPowerCelebrations.push(ev);
      }
    }

    if (!this.isCelebratingPower && this.pendingPowerCelebrations.length > 0) {
      this.processNextPowerCelebration(state);
    }
  }

  processNextPowerCelebration(state) {
    if (this.pendingPowerCelebrations.length === 0) {
      this.isCelebratingPower = false;
      return;
    }

    const event = this.pendingPowerCelebrations.shift();
    this.isCelebratingPower = true;
    this.showPowerCelebrationDialog(event, state);
  }

  showPowerCelebrationDialog(event, state) {
    if (!this.powerObtainedModal || !this.powerObtainedCard) {
      this.isCelebratingPower = false;
      return;
    }

    const powerDef = POWERS_DATA[event.powerId];
    if (!powerDef) {
      this.isCelebratingPower = false;
      if (this.pendingPowerCelebrations.length > 0) {
        this.processNextPowerCelebration(state);
      }
      return;
    }

    const player = (state.players || []).find(p => p.id === event.playerId) ||
                   (state.players ? state.players[event.playerIndex] : null) ||
                   { name: event.playerName || 'Merchant', id: event.playerId };

    const isLocal = player.id === this.localPlayerId;

    if (this.powerObtainedTitle) {
      this.powerObtainedTitle.textContent = isLocal
        ? '⚡ SUPER POWER AWAKENED! ⚡'
        : `⚡ ${player.name.toUpperCase()} AWAKENED A POWER! ⚡`;
      this.powerObtainedTitle.style.color = powerDef.colorHex || '#fef08a';
      this.powerObtainedTitle.style.textShadow = `0 0 16px ${powerDef.colorHex || 'rgba(251,191,36,0.85)'}`;
    }

    if (this.powerObtainedSubtitle) {
      this.powerObtainedSubtitle.innerHTML = `<strong>${player.name}</strong> has mastered: <em style="color:#fde047;">${powerDef.featDesc}</em>`;
    }

    // Render celebratory card content
    this.powerObtainedCard.className = `power-card-celebration tier-${powerDef.tier || 'common'}`;
    this.powerObtainedCard.style.borderColor = powerDef.colorHex || '#fbbf24';
    this.powerObtainedCard.innerHTML = `
      <div class="power-celebration-top">
        <span class="power-tier-badge" style="background:${powerDef.colorHex || '#fbbf24'}22; color:${powerDef.colorHex || '#fbbf24'}; border:1px solid ${powerDef.colorHex || '#fbbf24'}66;">
          ${powerDef.tierName || (powerDef.tier ? powerDef.tier.toUpperCase() : 'BOON')}
        </span>
        <span class="power-type-pill">${(powerDef.type || 'passive').toUpperCase()}</span>
      </div>
      <div class="power-celebration-icon">${powerDef.icon || '⚡'}</div>
      <div class="power-celebration-title" style="color:${powerDef.colorHex || '#ffffff'};">${powerDef.name}</div>
      <div class="power-celebration-feat">✦ Feat: ${powerDef.featDesc}</div>
      <div class="power-celebration-desc">${powerDef.shortDesc || powerDef.description}</div>
    `;

    // Glow aura styling
    const glowEl = document.querySelector('.power-sparkle-glow');
    if (glowEl) {
      glowEl.style.background = `radial-gradient(circle, ${powerDef.colorHex || '#fbbf24'}88 0%, rgba(168, 85, 247, 0.4) 55%, transparent 75%)`;
    }

    // Reveal modal
    this.powerObtainedModal.classList.remove('hidden');

    // Trigger audio fanfare
    soundEngine.playPowerUnlocked();

    // Start 3D sparkling particle emitter in Three.js scene
    requestAnimationFrame(() => {
      const cardRect = this.powerObtainedCard?.getBoundingClientRect();
      if (cardRect && this.card3d) {
        this.card3d.startPowerDialogSparks(cardRect, powerDef.colorHex || '#fbbf24');
      }
    });

    this.currentCelebration = { event, powerDef, player };

    // Auto-claim countdown timer (4 seconds)
    if (this.powerCelebrationTimer) {
      clearInterval(this.powerCelebrationTimer);
      this.powerCelebrationTimer = null;
    }

    let remainingSec = 4;
    const updateBtn = () => {
      if (this.btnClaimPowerAnim) {
        this.btnClaimPowerAnim.innerHTML = `⚡ Claim &amp; Fly to Dashboard (${remainingSec}s) ⚡`;
      }
    };
    updateBtn();

    this.powerCelebrationTimer = setInterval(() => {
      remainingSec--;
      if (remainingSec <= 0) {
        clearInterval(this.powerCelebrationTimer);
        this.powerCelebrationTimer = null;
        this.claimAndFlyPower();
      } else {
        updateBtn();
      }
    }, 1000);
  }

  claimAndFlyPower() {
    if (!this.currentCelebration) return;

    if (this.powerCelebrationTimer) {
      clearInterval(this.powerCelebrationTimer);
      this.powerCelebrationTimer = null;
    }

    const { powerDef, player } = this.currentCelebration;
    this.currentCelebration = null;

    // Stop continuous dialog sparkles
    this.card3d?.stopPowerDialogSparks();

    // Origin card element
    const fromEl = this.powerObtainedCard;

    // Find destination element
    let toEl = null;
    const isTwoPlayer = this.state?.players.length === 2;
    if (player.id === this.localPlayerId || (isTwoPlayer && this.currentDockPlayer?.id === player.id)) {
      toEl = document.getElementById('player-powers-tray');
    } else if (isTwoPlayer) {
      toEl = document.getElementById('p2-powers-tray');
    } else {
      const pIdx = this.state?.players.findIndex(p => p.id === player.id) ?? -1;
      toEl = document.getElementById(`opp-${pIdx}-powers-tray`) || document.getElementById(`opponent-card-${pIdx}`);
    }
    if (!toEl) {
      toEl = document.getElementById('player-powers-tray') || document.getElementById('player-dock');
    }

    // Hide celebration dialog
    this.powerObtainedModal?.classList.add('hidden');

    // Trigger 3D flying card to user dashboard
    this.card3d?.flySuperPowerCard({
      powerDef,
      fromEl,
      toEl,
      duration: 1250,
      onComplete: () => {
        soundEngine.playGemChime(1.5);
        if (toEl) {
          toEl.classList.add('pulse-pill');
          setTimeout(() => toEl.classList.remove('pulse-pill'), 450);
        }

        // Re-render docks so new badge appears immediately
        if (this.state) {
          const activePlayer = this.state.players[this.state.activePlayerIndex];
          this.renderPlayerDock(this.state, activePlayer, this.state.players.length === 2);
          this.renderOpponents(this.state, this.state.players.length === 2);
          this.renderSuperPowers(this.state);
        }

        // Small delay before next queued celebration if multiple unlocked
        setTimeout(() => {
          this.isCelebratingPower = false;
          if (this.pendingPowerCelebrations.length > 0) {
            this.processNextPowerCelebration(this.state);
          }
        }, 300);
      }
    });
  }

  renderNobles(state) {
    if (!this.noblesContainer) return;
    this.noblesContainer.innerHTML = '';

    state.nobles.forEach(nobleId => {
      const noble = NOBLES_BY_ID[nobleId];
      if (!noble) return;

      const card = document.createElement('div');
      card.className = 'noble-card';
      card.style.cursor = 'pointer';
      card.title = `${noble.name} (${noble.title}) · Click to inspect`;
      card.onclick = () => this.inspectNoble(noble);
      card.innerHTML = `
        <img class="noble-art-img" src="assets/nobles/${noble.id}.jpg" alt="${noble.name}" onerror="this.style.display='none'" />
        <div class="noble-art-overlay"></div>
        <div class="noble-content-layer">
          <div class="noble-header">
            <span class="noble-points">+${noble.prestigePoints}</span>
            <span class="noble-avatar">${noble.avatar}</span>
          </div>
          <div class="noble-reqs">
            ${Object.entries(noble.requirements).map(([gem, count]) => `
              <span class="cost-badge gem-${gem}">${GEM_METADATA[gem].symbol} ${count}</span>
            `).join('')}
          </div>
          <div class="noble-name" title="${noble.title}">${noble.name}</div>
        </div>
      `;
      this.noblesContainer.appendChild(card);
    });
  }

  /**
   * Render nobles acquired tray in player dashboard
   */
  renderNoblesAcquiredTray(containerEl, countEl, player) {
    if (!containerEl || !player) return;
    const nobles = (player.noblesAcquired || []).map(id => NOBLES_BY_ID[id]).filter(Boolean);
    if (countEl) {
      countEl.innerText = nobles.length;
    }
    containerEl.innerHTML = '';

    if (nobles.length === 0) {
      const emptySlot = document.createElement('div');
      emptySlot.className = 'player-noble-tile empty';
      emptySlot.title = 'Nobles visit automatically when you collect their required card bonuses (+3 PTS each)';
      emptySlot.innerHTML = `
        <span class="empty-noble-icon">👑</span>
        <span class="empty-noble-text">None</span>
      `;
      containerEl.appendChild(emptySlot);
      return;
    }

    nobles.forEach(noble => {
      const tile = document.createElement('div');
      tile.className = 'player-noble-tile acquired';
      tile.title = `${noble.name} (${noble.title}) · +${noble.prestigePoints} Prestige Points\nClick to inspect noble.`;
      tile.innerHTML = `
        <img class="mini-noble-art-img" src="assets/nobles/${noble.id}.jpg" alt="${noble.name}" onerror="this.style.display='none'" />
        <div class="mini-noble-overlay"></div>
        <div class="mini-noble-content">
          <span class="mini-noble-pts">+${noble.prestigePoints}</span>
          <span class="mini-noble-avatar">${noble.avatar || '👑'}</span>
        </div>
      `;
      tile.onclick = (e) => {
        e.stopPropagation();
        this.inspectNoble(noble);
      };
      containerEl.appendChild(tile);
    });
  }

  /**
   * Modal dialog to inspect a historical noble tile
   */
  inspectNoble(noble) {
    if (!this.cardModal || !noble) return;
    soundEngine.playCardSnap();

    const titleEl = document.getElementById('card-modal-title');
    const bodyEl = document.getElementById('card-modal-body');
    const actionsEl = document.getElementById('card-modal-actions');

    titleEl.innerHTML = `👑 ${noble.name} · +${noble.prestigePoints} PTS`;

    bodyEl.innerHTML = `
      <div style="display:flex; gap:14px; align-items:center;">
        <div style="position:relative; width:94px; height:94px; border-radius:8px; overflow:hidden; border:2px solid var(--border-gold); flex-shrink:0;">
          <img src="assets/nobles/${noble.id}.jpg" alt="${noble.name}" style="width:100%; height:100%; object-fit:cover;" onerror="this.style.display='none'" />
          <div style="position:absolute; inset:0; background:rgba(10,8,16,0.25);"></div>
          <div style="position:absolute; top:4px; left:4px; font-weight:900; color:#fbbf24; font-size:18px; font-family:var(--font-serif); text-shadow:0 2px 4px #000;">
            +${noble.prestigePoints}
          </div>
        </div>
        <div style="display:flex; flex-direction:column; gap:6px;">
          <div style="font-size:14px; font-weight:bold; color:#fef08a;">${noble.title}</div>
          <div style="font-size:11px; color:var(--text-muted); line-height:1.4;">
            Patron of the Renaissance jewel merchants. Visits a guild once the required permanent gem bonuses are established.
          </div>
          <div style="margin-top:4px;">
            <div style="font-size:10px; text-transform:uppercase; color:var(--text-muted); margin-bottom:3px; letter-spacing:0.5px; font-weight:bold;">Requirements:</div>
            <div style="display:flex; gap:4px; flex-wrap:wrap;">
              ${Object.entries(noble.requirements).map(([gem, count]) => `
                <span class="cost-badge gem-${gem}" style="font-size:10.5px; padding:2px 6px;">${GEM_METADATA[gem].symbol} ${count} ${gem.toUpperCase()}</span>
              `).join('')}
            </div>
          </div>
        </div>
      </div>
    `;

    actionsEl.innerHTML = `
      <button class="secondary-btn" style="width:100%;" id="btn-close-noble-inspect">Close</button>
    `;
    document.getElementById('btn-close-noble-inspect')?.addEventListener('click', () => {
      this.cardModal.classList.add('hidden');
    });

    this.cardModal.classList.remove('hidden');
  }

  renderCardMatrix(state, activePlayer, isLocalTurn) {
    if (!this.cardMatrix) return;
    this.cardMatrix.innerHTML = '';

    // Render Tier 3 at top, Tier 2 middle, Tier 1 bottom
    for (const tier of [3, 2, 1]) {
      const row = document.createElement('div');
      row.className = 'tier-row';

      // Deck draw pile with authentic Renaissance card back
      const deckCount = state.decks[tier].length;
      const deckPile = document.createElement('div');
      deckPile.className = `deck-pile tier-${tier}`;
      deckPile.innerHTML = `
        <img class="deck-art-img" src="assets/decks/deck_t${tier}.jpg" alt="Tier ${tier} Deck" onerror="this.style.display='none'" />
        <div class="deck-overlay">
          <span class="deck-tier-num">${'●'.repeat(tier)}</span>
          <span class="deck-count">${deckCount} cards</span>
        </div>
      `;
      const reserveLimit = activePlayer.reserveLimit || 3;
      const goldGained = activePlayer.goldPerReserve || 1;
      if (isLocalTurn && deckCount > 0 && activePlayer.cardsReserved.length < reserveLimit) {
        deckPile.title = `Click to blind reserve top card (+${goldGained} Gold)`;
        deckPile.onclick = () => this.promptBlindReserve(tier);
      }
      row.appendChild(deckPile);

      // 4 Card Slots with authentic Renaissance card art
      const cardsRow = document.createElement('div');
      cardsRow.className = 'cards-row';

      for (let s = 0; s < 4; s++) {
        const cardId = state.tableCards[tier][s];
        const cardSlot = document.createElement('div');

        if (!cardId) {
          cardSlot.className = 'dev-card empty-slot';
          cardSlot.innerHTML = `<span style="margin:auto; opacity:0.3;">Empty</span>`;
        } else {
          const card = CARDS_BY_ID[cardId];
          const canAfford = canAffordCard(activePlayer, card);
          const payment = canAfford ? calculateCardPayment(activePlayer, card) : null;
          const isAffordableWithGold = payment && payment.gold > 0;

          let isTierLocked = false;
          let tierLockText = '';
          if (state.gameMode === 'tier_ladder') {
            const t1Count = activePlayer.cardsPurchased.filter(id => CARDS_BY_ID[id] && CARDS_BY_ID[id].tier === 1).length;
            const t2Count = activePlayer.cardsPurchased.filter(id => CARDS_BY_ID[id] && CARDS_BY_ID[id].tier === 2).length;
            if (tier === 2 && t1Count < 6) {
              isTierLocked = true;
              tierLockText = `Req 6 T1 (${t1Count}/6)`;
            } else if (tier === 3 && t2Count < 6) {
              isTierLocked = true;
              tierLockText = `Req 6 T2 (${t2Count}/6)`;
            }
          }

          let affordClass = 'unaffordable';
          if (isLocalTurn && !isTierLocked) {
            if (canAfford) {
              affordClass = isAffordableWithGold ? 'affordable-gold' : 'affordable-now';
            }
          }

          cardSlot.className = `dev-card card-gem-${card.gemBonus} ${affordClass}`;
          cardSlot.dataset.cardId = card.id;
          cardSlot.dataset.tier = String(card.tier);
          cardSlot.innerHTML = `
            <img class="card-art-img" src="${getCardArtPath(card)}" alt="Tier ${card.tier} ${card.gemBonus}" onerror="this.src='assets/cards/t${card.tier}_${card.gemBonus}.jpg'" />
            <div class="card-art-overlay"></div>
            ${isTierLocked ? `
              <div class="tier-locked-overlay">
                <span style="font-size:16px;">🔒</span>
                <span class="tier-locked-text">${tierLockText}</span>
              </div>
            ` : ''}
            <div class="card-content-layer">
              <div class="card-top">
                <span class="card-points">${card.prestigePoints > 0 ? card.prestigePoints : ''}</span>
                <span class="card-bonus-gem gem-${card.gemBonus}">${GEM_METADATA[card.gemBonus].symbol}</span>
              </div>
              <div class="card-costs">
                ${Object.entries(card.cost).map(([gem, cost]) => {
                  const discount = activePlayer.bonuses[gem] || 0;
                  const needed = Math.max(0, cost - discount);
                  const have = activePlayer.tokens[gem] || 0;
                  const isShort = isLocalTurn && have < needed;
                  return `
                    <span class="cost-badge gem-${gem}" style="${isShort ? 'box-shadow: 0 0 4px #ef4444;' : ''}">
                      ${GEM_METADATA[gem].symbol} ${cost}
                    </span>
                  `;
                }).join('')}
              </div>
            </div>
          `;

          if (isLocalTurn) {
            cardSlot.onclick = () => this.inspectCard(card, canAfford, payment);
          }
        }
        cardsRow.appendChild(cardSlot);
      }

      row.appendChild(cardsRow);
      this.cardMatrix.appendChild(row);
    }
  }

  renderBankControls(state, isLocalTurn) {
    if (!this.stagedTokensDisplay) return;

    // Display staged tokens
    const stagedEntries = Object.entries(this.stagedTokens).filter(([_, cnt]) => cnt > 0);
    if (stagedEntries.length > 0) {
      this.stagedTokensDisplay.innerHTML = stagedEntries.map(([col, cnt]) => `
        <span class="token-chip-pill gem-${col}" style="cursor:pointer;" title="Click to remove from selection" data-col="${col}">
          <span>${GEM_METADATA[col].symbol}</span>
          <span>${GEM_METADATA[col].name.toUpperCase()} × ${cnt}</span>
          <span style="font-size:10px; opacity:0.75; margin-left:4px;">✕</span>
        </span>
      `).join('');

      this.stagedTokensDisplay.querySelectorAll('.token-chip-pill').forEach(el => {
        el.onclick = () => {
          const col = el.getAttribute('data-col');
          if (this.stagedTokens[col] > 0) {
            this.stagedTokens[col]--;
            soundEngine.playChipClink();
            this.updateBankVisuals();
          }
        };
      });
    } else {
      this.stagedTokensDisplay.innerHTML = '<span style="font-size:12px; color:var(--text-muted);">Click a stack in the bank to pick tokens</span>';
    }

    // Validate if staged combination is legal
    let canConfirm = false;
    let comboLabel = '';
    if (isLocalTurn) {
      if (stagedEntries.length === 1 && stagedEntries[0][1] === 2) {
        canConfirm = validateTakePairTokens(state, state.activePlayerIndex, stagedEntries[0][0]).valid;
        if (canConfirm) comboLabel = ' (Take 2 Same)';
      } else if (stagedEntries.length >= 1) {
        const colors = stagedEntries.map(([col]) => col);
        canConfirm = validateTakeDistinctTokens(state, state.activePlayerIndex, colors).valid;
        if (canConfirm) comboLabel = ` (Take ${colors.length} Distinct)`;
      }
    }

    // Update bank rule hint dynamically based on active player's powers
    const activePlayer = state ? state.players[state.activePlayerIndex] : null;
    const hasPrismatic = activePlayer && (activePlayer.hasPrismaticHarmony || (activePlayer.powersClaimed && activePlayer.powersClaimed.includes('prismatic_harmony')));
    const bankHintEl = document.querySelector('.bank-rule-hint');
    if (bankHintEl) {
      if (hasPrismatic) {
        bankHintEl.innerHTML = '<strong style="color:#38bdf8;">🌈 Prismatic Harmony:</strong> Take 4 distinct (or 3) or 2 same';
      } else {
        bankHintEl.textContent = 'Take 3 distinct or 2 same (stack ≥ 4)';
      }
    }

    if (this.btnConfirmTokens) {
      this.btnConfirmTokens.disabled = !canConfirm;
      this.btnConfirmTokens.innerHTML = canConfirm ? `Take Tokens${comboLabel}` : 'Take Tokens';
    }
    if (this.btnClearTokens) {
      this.btnClearTokens.disabled = stagedEntries.length === 0;
    }
  }

  renderPlayerDock(state, activePlayer, isTwoPlayer) {
    let bottomPlayer;
    if (this.gameMode === 'online') {
      bottomPlayer = state.players.find(p => p.id === this.localPlayerId) || state.players[0];
    } else if (this.gameMode === 'pass_and_play') {
      bottomPlayer = isTwoPlayer ? state.players[0] : activePlayer;
    } else {
      bottomPlayer = state.players[0];
    }

    const isBottomTurn = (bottomPlayer.id === activePlayer.id);

    const isBottomLocal = (this.gameMode === 'pass_and_play')
      ? !bottomPlayer.isAi
      : (bottomPlayer.id === this.localPlayerId);

    // Active turn glow on bottom dock
    if (this.playerDock) {
      if (isBottomTurn) {
        this.playerDock.classList.add('active-turn');
      } else {
        this.playerDock.classList.remove('active-turn');
      }
    }

    this.currentDockPlayer = bottomPlayer;
    this.currentDockPlayerIndex = state.players.indexOf(bottomPlayer);

    const btnRename = document.getElementById('btn-rename-merchant');
    if (btnRename) {
      btnRename.style.display = bottomPlayer.isAi ? 'none' : 'inline-block';
    }

    // Name and labels
    if (this.playerDockName) {
      this.playerDockName.innerText = `${bottomPlayer.name}${bottomPlayer.isAi ? ' (AI)' : ''}`;
      this.playerDockName.style.color = isBottomTurn ? '#fbbf24' : 'var(--text-muted)';
      this.playerDockName.style.cursor = bottomPlayer.isAi ? 'default' : 'pointer';
      this.playerDockName.title = bottomPlayer.isAi ? '' : 'Click to rename your merchant';
    }
    const isPureObjective = ['onyx_syndicate', 'color_supremacy', 'noble_court', 'rainbow_guild'].includes(state.gameMode);
    if (this.playerDockLbl) {
      const modeLabel = isPureObjective ? 'OBJECTIVE' : (isTwoPlayer ? 'YOU (BOTTOM TABLE)' : 'PRESTIGE');
      const curseHtml = this.getCurseBadgesHTML(bottomPlayer);
      this.playerDockLbl.innerHTML = (isBottomTurn ? '👑 ACTIVE TURN' : modeLabel) + curseHtml;
    }

    if (this.prestigeVal) {
      if (isPureObjective) {
        if (state.gameMode === 'onyx_syndicate') {
          this.prestigeVal.innerHTML = `🖤 ${bottomPlayer.bonuses?.onyx || 0}<span style="font-size:13px; opacity:0.65; font-weight:600; margin-left:2px;">/10</span> <span style="font-size:10px; font-weight:700;">ONYX</span>`;
        } else if (state.gameMode === 'color_supremacy') {
          this.prestigeVal.innerHTML = `⭐ ${bottomPlayer.trophies || 0}<span style="font-size:13px; opacity:0.65; font-weight:600; margin-left:2px;">/3</span> <span style="font-size:10px; font-weight:700;">BADGES</span>`;
        } else if (state.gameMode === 'noble_court') {
          this.prestigeVal.innerHTML = `⚜️ ${bottomPlayer.noblesAcquired.length}<span style="font-size:13px; opacity:0.65; font-weight:600; margin-left:2px;">/3</span> <span style="font-size:10px; font-weight:700;">NOBLES</span>`;
        } else if (state.gameMode === 'rainbow_guild') {
          const done = GEM_COLORS.filter(c => (bottomPlayer.bonuses[c] || 0) >= 3).length;
          this.prestigeVal.innerHTML = `🌈 ${done}<span style="font-size:13px; opacity:0.65; font-weight:600; margin-left:2px;">/5</span> <span style="font-size:10px; font-weight:700;">COLORS</span>`;
        }
      } else {
        this.prestigeVal.innerHTML = `${bottomPlayer.prestigePoints}<span style="font-size:13px; opacity:0.65; font-weight:600; margin-left:2px;">/${state.targetPoints || 15}</span> <span style="font-size:10px; font-weight:700;">PTS</span>`;
      }
    }

    // Token Holdings
    const totalTokens = countTokens(bottomPlayer.tokens);
    const bottomVaultLimit = bottomPlayer.vaultLimit || 10;
    if (this.tokenLimitBadge) {
      this.tokenLimitBadge.innerText = `${totalTokens} / ${bottomVaultLimit}`;
      this.tokenLimitBadge.style.color = totalTokens > bottomVaultLimit ? '#ef4444' : 'var(--text-muted)';
    }

    // Render combined gem holdings (tokens on stacked cards)
    if (this.playerGemHoldings) {
      this.renderCombinedGemHoldings(this.playerGemHoldings, bottomPlayer);
    }

    if (this.playerTokensContainer) {
      this.playerTokensContainer.innerHTML = ALL_TOKENS.map(color => `
        <div class="token-chip-pill gem-${color}">
          <span>${GEM_METADATA[color].symbol}</span>
          <strong>${bottomPlayer.tokens[color] || 0}</strong>
        </div>
      `).join('');
    }

    // Permanent Gem Bonuses - backwards compatibility container
    if (this.playerBonusesContainer) {
      this.renderPermanentBonusStacks(this.playerBonusesContainer, bottomPlayer);
    }

    // Reserved Cards
    if (this.reservedTray) {
      this.reservedTray.innerHTML = '';
      const bottomSlots = Math.max(3, bottomPlayer.reserveLimit || 3);
      for (let i = 0; i < bottomSlots; i++) {
        const cardId = bottomPlayer.cardsReserved[i];
        const miniCard = document.createElement('div');
        if (cardId) {
          const card = CARDS_BY_ID[cardId];
          const canAfford = canAffordCard(bottomPlayer, card);
          const payment = canAfford ? calculateCardPayment(bottomPlayer, card) : null;

          miniCard.className = `reserved-mini-card card-gem-${card.gemBonus} ${canAfford ? 'affordable-now' : ''}`;
          miniCard.dataset.cardId = card.id;
          miniCard.innerHTML = `
            <img class="mini-card-art-img" src="${getCardArtPath(card)}" alt="Reserved" onerror="this.src='assets/cards/t${card.tier}_${card.gemBonus}.jpg'" />
            <div class="mini-card-overlay"></div>
            <div class="mini-card-content-layer">
              <div style="display:flex; justify-content:space-between; align-items:center;">
                <span style="font-weight:bold; color:var(--text-gold); font-size:13px;">+${card.prestigePoints}</span>
                <span class="cost-badge gem-${card.gemBonus}" style="padding:1px 3px;">${GEM_METADATA[card.gemBonus].symbol}</span>
              </div>
              <div style="font-size:8.5px; text-align:center; opacity:0.6;">Tier ${card.tier}</div>
              <div style="display:flex; flex-wrap:wrap; gap:2px;">
                ${Object.entries(card.cost).map(([c, n]) => `<span class="cost-badge gem-${c}" style="font-size:8px; padding:1px 2px;">${n}</span>`).join('')}
              </div>
            </div>
          `;
          if (isBottomTurn && isBottomLocal) {
            miniCard.style.cursor = 'pointer';
            miniCard.onclick = () => this.inspectCard(card, canAfford, payment, true);
          } else {
            miniCard.style.cursor = 'pointer';
            miniCard.onclick = () => this.inspectCard(card, false, null, 'preview');
          }
        } else {
          miniCard.className = 'reserved-mini-card empty';
          miniCard.innerHTML = `Slot ${i + 1}`;
        }
        this.reservedTray.appendChild(miniCard);
      }
    }

    // Reserved cards count
    const playerReservedCount = document.getElementById('player-reserved-count');
    if (playerReservedCount) {
      playerReservedCount.innerText = `${bottomPlayer.cardsReserved.length} / ${bottomPlayer.reserveLimit || 3}`;
    }

    // Nobles Taken Tray & Claimed Powers in Player Dock
    const playerNoblesTray = document.getElementById('player-nobles-tray');
    const playerNoblesCount = document.getElementById('player-nobles-count');
    this.renderNoblesAcquiredTray(playerNoblesTray, playerNoblesCount, bottomPlayer);
    const playerPowersTray = document.getElementById('player-powers-tray');
    this.renderClaimedPowers(playerPowersTray, bottomPlayer, state);
  }

  renderOpponents(state, isTwoPlayer) {
    if (!this.opponentsContainer) return;

    if (isTwoPlayer) {
      document.body.classList.add('two-player-mode');
      this.opponentsContainer.innerHTML = '';
      return;
    }

    document.body.classList.remove('two-player-mode');
    this.opponentsContainer.innerHTML = '';

    state.players.forEach((p, idx) => {
      const isCurrentTurn = idx === state.activePlayerIndex;
      const isLocal = (p.id === this.localPlayerId);
      const card = document.createElement('div');
      card.className = `opponent-card ${isCurrentTurn ? 'active-turn' : ''}`;
      card.dataset.playerIndex = String(idx);
      card.id = `opponent-card-${idx}`;

      const roleTag = p.isAi ? ' (AI)' : (isLocal ? ' (You)' : '');
      const totalTokens = countTokens(p.tokens);

      const isPureObjective = ['onyx_syndicate', 'color_supremacy', 'noble_court', 'rainbow_guild'].includes(state.gameMode);
      let oppScoreDisplay = '';
      if (isPureObjective) {
        if (state.gameMode === 'onyx_syndicate') {
          oppScoreDisplay = `<span class="opponent-score">🖤 ${p.bonuses?.onyx || 0}/10 ONYX</span>`;
        } else if (state.gameMode === 'color_supremacy') {
          oppScoreDisplay = `<span class="opponent-score">⭐ ${p.trophies || 0}/3 BADGES</span>`;
        } else if (state.gameMode === 'noble_court') {
          oppScoreDisplay = `<span class="opponent-score">⚜️ ${p.noblesAcquired.length}/3 NOBLES</span>`;
        } else if (state.gameMode === 'rainbow_guild') {
          const done = GEM_COLORS.filter(c => (p.bonuses[c] || 0) >= 3).length;
          oppScoreDisplay = `<span class="opponent-score">🌈 ${done}/5 COLORS</span>`;
        }
      } else {
        oppScoreDisplay = `<span class="opponent-score">${p.prestigePoints}<span style="font-size:10px; opacity:0.65; font-weight:600; margin-left:2px;">/${state.targetPoints || 15}</span> PTS</span>`;
      }

      card.innerHTML = `
        <div class="opponent-header">
          <div style="display:flex; align-items:center; gap:5px; min-width:0;">
            <span class="opponent-name" title="${p.name}">${p.name}${roleTag}</span>
            ${isCurrentTurn ? '<span class="opponent-turn-tag">TURN</span>' : ''}
          </div>
          <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap; justify-content:flex-end;">
            ${oppScoreDisplay}
            ${this.getModeObjectiveHTML(p, state)}
            ${this.getCurseBadgesHTML(p)}
            <div id="opp-${idx}-powers-tray" class="claimed-powers-list"></div>
          </div>
        </div>

        <div class="opponent-substats">
          <span>🃏 Reserved: <strong>${p.cardsReserved.length}/${p.reserveLimit || 3}</strong></span>
          <span>👑 Nobles: <strong>${p.noblesAcquired.length}</strong></span>
        </div>

        <!-- Gems Held (Tokens in hand) -->
        <div class="opponent-section">
          <div class="opponent-section-header">
            <span>Gems Held</span>
            <span class="opponent-count-badge ${totalTokens > (p.vaultLimit || 10) ? 'overflow' : ''}">${totalTokens} / ${p.vaultLimit || 10}</span>
          </div>
          <div class="opponent-tokens-row">
            ${ALL_TOKENS.map(c => {
              const qty = p.tokens[c] || 0;
              return `
                <div class="opponent-chip gem-${c} ${qty > 0 ? 'active' : 'zero'}" title="${p.name}: ${qty} ${GEM_METADATA[c].name} token(s)">
                  <span class="chip-sym">${GEM_METADATA[c].symbol}</span>
                  <span class="chip-qty">${qty}</span>
                </div>
              `;
            }).join('')}
          </div>
        </div>

        <!-- Permanent Card Bonuses -->
        <div class="opponent-section">
          <div class="opponent-section-header">
            <span>Bonus Cards</span>
            <span class="opponent-count-badge">${p.cardsPurchased.length} cards</span>
          </div>
          <div class="opponent-bonuses-row">
            ${GEM_COLORS.map(c => {
              const bonus = p.bonuses[c] || 0;
              return `
                <div class="mini-bonus-badge gem-${c} ${bonus > 0 ? 'active' : 'zero'}" data-color="${c}" title="${p.name}: +${bonus} ${GEM_METADATA[c].name} card bonus${bonus > 0 ? ' (Click to inspect cards)' : ''}">
                  <span class="bonus-sym">${GEM_METADATA[c].symbol}</span>
                  <span class="bonus-qty">+${bonus}</span>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      `;

      // Enable clicking bonus card badge to inspect purchased cards
      card.querySelectorAll('.mini-bonus-badge').forEach(badge => {
        const color = badge.getAttribute('data-color');
        if (p.bonuses[color] > 0) {
          badge.style.cursor = 'pointer';
          badge.onclick = (e) => {
            e.stopPropagation();
            const cards = (p.cardsPurchased || [])
              .map(id => CARDS_BY_ID[id])
              .filter(cd => cd && cd.gemBonus === color);
            if (cards.length > 0) {
              this.inspectPurchasedGemGroup(cards, color, p);
            }
          };
        }
      });

      this.opponentsContainer.appendChild(card);

      const oppPowersTray = card.querySelector(`#opp-${idx}-powers-tray`);
      if (oppPowersTray) {
        this.renderClaimedPowers(oppPowersTray, p, state);
      }
    });
  }

  renderMoveLog(state) {
    if (!this.logList) return;
    this.logList.innerHTML = '';
    const reversed = [...state.moveLog].reverse();
    reversed.forEach(entry => {
      const el = document.createElement('div');
      const isSabotage = entry.description && entry.description.includes('⚔️ SABOTAGED');
      el.className = `log-entry ${isSabotage ? 'sabotage-entry' : ''}`;
      el.innerHTML = `
        <div style="display:flex; justify-content:space-between;">
          <strong style="color:${isSabotage ? '#f87171' : 'var(--text-gold)'};">${entry.playerName}</strong>
          <span class="log-time">${new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
        </div>
        <div style="margin-top:2px;">${entry.description}</div>
      `;
      this.logList.appendChild(el);
    });
  }


  // -------------------------------------------------------------
  // GAME-STYLED DIALOG HELPERS (replace native alert / confirm)
  // -------------------------------------------------------------
  showGameAlert(title, message, onClose) {
    const modal = this.alertModal;
    document.getElementById('alert-modal-title').textContent = title;
    document.getElementById('alert-modal-body').innerHTML = message;
    modal.classList.remove('hidden');
    const btn = document.getElementById('alert-modal-ok');
    const close = () => {
      modal.classList.add('hidden');
      btn.removeEventListener('click', close);
      if (onClose) onClose();
    };
    btn.addEventListener('click', close);
    // Clicking backdrop also closes
    const onBackdrop = (e) => {
      if (e.target === modal) { close(); modal.removeEventListener('click', onBackdrop); }
    };
    modal.addEventListener('click', onBackdrop);
  }

  showGameConfirm(title, message, onConfirm, onCancel) {
    const modal = this.confirmModal;
    document.getElementById('confirm-modal-title').textContent = title;
    document.getElementById('confirm-modal-body').innerHTML = message;
    modal.classList.remove('hidden');
    const btnOk = document.getElementById('confirm-modal-ok');
    const btnCancel = document.getElementById('confirm-modal-cancel');
    const closeWith = (result) => {
      modal.classList.add('hidden');
      btnOk.removeEventListener('click', doConfirm);
      btnCancel.removeEventListener('click', doCancel);
      if (result && onConfirm) onConfirm();
      if (!result && onCancel) onCancel();
    };
    const doConfirm = () => closeWith(true);
    const doCancel = () => closeWith(false);
    btnOk.addEventListener('click', doConfirm);
    btnCancel.addEventListener('click', doCancel);
    const onBackdrop = (e) => {
      if (e.target === modal) { closeWith(false); modal.removeEventListener('click', onBackdrop); }
    };
    modal.addEventListener('click', onBackdrop);
  }

  showToast(text, icon = '💎') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const pill = document.createElement('div');
    pill.className = 'toast-pill';
    pill.innerHTML = `<span>${icon}</span> <span>${text}</span>`;
    container.appendChild(pill);
    setTimeout(() => {
      pill.remove();
    }, 3000);
  }

  // -------------------------------------------------------------
  // TOKEN STAGING LOGIC
  // -------------------------------------------------------------
  handleTokenClick(color) {
    if (!this.state) return;
    if (!this.isCurrentPlayerLocal()) return;

    soundEngine.playChipClink();

    if (color === 'gold') {
      this.showGameAlert('⚜️ Gold Joker', 'Gold Joker tokens cannot be directly taken from the bank.<br><br>You earn <strong style="color:var(--text-gold);">1 Gold</strong> when you <strong>Reserve a Card</strong>.');
      return;
    }

    const currentCount = this.stagedTokens[color] || 0;
    const stagedEntries = Object.entries(this.stagedTokens).filter(([_, c]) => c > 0);

    // If already staged 2 of this color, unstage
    if (currentCount === 2) {
      this.stagedTokens[color] = 0;
      this.updateBankVisuals();
      return;
    }

    // If already staged 1 of this color:
    if (currentCount === 1) {
      // Can only take 2 if no other colors are staged and bank has >= 4
      if (stagedEntries.length === 1 && this.state.bank[color] >= 4) {
        this.stagedTokens[color] = 2;
      } else {
        this.stagedTokens[color] = 0; // Toggle off
      }
      this.updateBankVisuals();
      return;
    }

    // If currently 0 staged for this color:
    // If a pair is already staged, reset and stage this 1
    if (stagedEntries.length === 1 && stagedEntries[0][1] === 2) {
      this.clearStagedTokens();
      this.stagedTokens[color] = 1;
      this.updateBankVisuals();
      return;
    }

    // Otherwise staging distinct tokens (max 3, or 4 with Prismatic Harmony)
    const activePlayer = this.state.players[this.state.activePlayerIndex];
    const hasPrismatic = activePlayer && (activePlayer.hasPrismaticHarmony || (activePlayer.powersClaimed && activePlayer.powersClaimed.includes('prismatic_harmony')));
    const maxDistinct = hasPrismatic ? 4 : 3;
    if (stagedEntries.length < maxDistinct && this.state.bank[color] > 0) {
      this.stagedTokens[color] = 1;
    } else if (stagedEntries.length >= 3 && !hasPrismatic && this.state.bank[color] > 0) {
      this.showToast('Unlock Prismatic Harmony (Rd 6 Boon) to take 4 distinct tokens!', '🌈');
    }

    this.updateBankVisuals();
  }

  updateBankVisuals() {
    this.renderBankControls(this.state, true);
    if (this.callbacks.onUpdateVisualizer) {
      this.callbacks.onUpdateVisualizer(this.state.bank, this.stagedTokens);
    }
  }

  clearStagedTokens() {
    this.stagedTokens = { diamond: 0, sapphire: 0, emerald: 0, ruby: 0, onyx: 0 };
    this.updateBankVisuals();
  }

  confirmStagedTokens() {
    const stagedEntries = Object.entries(this.stagedTokens).filter(([_, cnt]) => cnt > 0);
    if (stagedEntries.length === 0) return;

    // Trigger gem fly animation to the CURRENT player's dashboard!
    const activePlayerIndex = this.state ? this.state.activePlayerIndex : 0;
    const colorsToFly = [];
    stagedEntries.forEach(([color, cnt]) => {
      for (let i = 0; i < cnt; i++) {
        colorsToFly.push(color);
      }
    });
    this.flyTokensToPlayer(colorsToFly, activePlayerIndex);

    if (stagedEntries.length === 1 && stagedEntries[0][1] === 2) {
      this.callbacks.onTakePairTokens(stagedEntries[0][0]);
    } else {
      const colors = stagedEntries.map(([col]) => col);
      this.callbacks.onTakeDistinctTokens(colors);
    }
    this.clearStagedTokens();
  }

  // -------------------------------------------------------------
  // FLYING TOKEN DOM ANIMATION TO CURRENT PLAYER DASHBOARD
  // -------------------------------------------------------------
  getVisibleTarget(selectors) {
    for (const sel of selectors) {
      if (!sel) continue;
      const el = (typeof sel === 'string') ? document.querySelector(sel) : sel;
      if (el) {
        const rect = el.getBoundingClientRect();
        if (rect && rect.width > 0 && rect.height > 0) {
          return el;
        }
      }
    }
    return null;
  }

  getCurrentPlayerTarget(color, playerIndex) {
    const state = this.state;
    if (!state) return null;
    const pIdx = (playerIndex !== undefined) ? playerIndex : state.activePlayerIndex;
    const player = state.players[pIdx];
    if (!player) return null;

    const isTwoPlayer = state.players.length === 2;

    if (isTwoPlayer) {
      const isTargetBottom = (this.gameMode === 'online')
        ? (player.id === this.localPlayerId)
        : (pIdx === 0);

      if (isTargetBottom) {
        // Local player at bottom dock (target the visible card stack in player-gem-holdings)
        return this.getVisibleTarget([
          `#player-gem-holdings .card-gem-${color} .card-stack-token-val`,
          `#player-gem-holdings .card-gem-${color}`,
          '#player-gem-holdings',
          '#player-dock'
        ]);
      } else {
        // Opponent at top table
        return this.getVisibleTarget([
          `#p2-gem-holdings .card-gem-${color} .card-stack-token-val`,
          `#p2-gem-holdings .card-gem-${color}`,
          '#p2-gem-holdings',
          '#top-player-table'
        ]);
      }
    }

    // 3 or 4 players mode:
    const isBottomTurn = (this.gameMode === 'pass_and_play')
      ? (state.activePlayerIndex === pIdx)
      : (player.id === this.localPlayerId);

    if (isBottomTurn) {
      return this.getVisibleTarget([
        `#player-gem-holdings .card-gem-${color} .card-stack-token-val`,
        `#player-gem-holdings .card-gem-${color}`,
        '#player-gem-holdings',
        '#player-dock'
      ]);
    }

    // Opponent card in left sidebar
    return this.getVisibleTarget([
      `.opponent-card[data-player-index="${pIdx}"] .opponent-chip.gem-${color}`,
      `#opponent-card-${pIdx} .opponent-chip.gem-${color}`,
      `.opponent-card[data-player-index="${pIdx}"]`,
      `#opponent-card-${pIdx}`,
      '.opponent-card.active-turn',
      '#opponents-container'
    ]);
  }

  flyTokensToPlayer(colors, playerIndex) {
    if (!colors || colors.length === 0) return;
    const pIdx = (playerIndex !== undefined) ? playerIndex : (this.state ? this.state.activePlayerIndex : 0);
    colors.forEach((color, i) => {
      this.flyTokenToPlayer(color, i * 140, pIdx);
    });
  }

  flyTokenToPlayer(color, delayMs = 0, playerIndex) {
    setTimeout(() => {
      const meta = (typeof GEM_METADATA !== 'undefined' ? GEM_METADATA : window.GEM_METADATA)?.[color];
      const bankCanvas = document.getElementById('bank-canvas') || document.querySelector('.bank-section');
      if (!bankCanvas) return;

      const pIdx = (playerIndex !== undefined) ? playerIndex : (this.state ? this.state.activePlayerIndex : 0);
      const targetEl = this.getCurrentPlayerTarget(color, pIdx);
      if (!targetEl) return;

      const srcRect = bankCanvas.getBoundingClientRect();
      const dstRect = targetEl.getBoundingClientRect();
      if (!dstRect || dstRect.width === 0 || dstRect.height === 0) return;

      const colors = ['diamond', 'sapphire', 'emerald', 'ruby', 'onyx', 'gold'];
      const colIdx = colors.indexOf(color);
      let startX = srcRect.left + srcRect.width * 0.5;
      if (colIdx !== -1) {
        const colWidth = srcRect.width / colors.length;
        startX = srcRect.left + colIdx * colWidth + colWidth * 0.5;
      }
      const startY = srcRect.top + srcRect.height * 0.45;

      const endX = dstRect.left + dstRect.width * 0.5;
      const endY = dstRect.top + dstRect.height * 0.5;

      const dx = endX - startX;
      const dy = endY - startY;

      // Arc curvature: curve upward/outward dynamically towards the destination
      const dist = Math.hypot(dx, dy) || 1;
      const arcHeight = Math.min(80, Math.max(35, dist * 0.22));
      const midX = dx * 0.5 + (dx > 0 ? -25 : 25);
      const midY = dy * 0.5 - arcHeight;

      const chip = document.createElement('div');
      chip.className = 'flying-token-dom';
      chip.textContent = meta?.symbol || '●';

      if (color === 'diamond') {
        chip.style.backgroundColor = '#ffffff';
        chip.style.color = '#0284c7';
        chip.style.borderColor = '#0284c7';
      } else if (color === 'onyx') {
        chip.style.backgroundColor = '#232326';
        chip.style.color = '#ffffff';
        chip.style.borderColor = '#cbd5e1';
      } else if (color === 'gold') {
        chip.style.backgroundColor = '#fbbf24';
        chip.style.color = '#78350f';
        chip.style.borderColor = '#fef08a';
      } else {
        chip.style.backgroundColor = meta?.colorHex || '#555';
        chip.style.color = '#ffffff';
        chip.style.borderColor = meta?.borderHex || meta?.accentHex || 'rgba(255,255,255,0.6)';
      }

      chip.style.left = `${startX - 14}px`;
      chip.style.top  = `${startY - 14}px`;
      chip.style.setProperty('--fx-mx', `${midX}px`);
      chip.style.setProperty('--fx-my', `${midY}px`);
      chip.style.setProperty('--fx-ex', `${dx}px`);
      chip.style.setProperty('--fx-ey', `${dy}px`);
      chip.style.animation = 'tokenFlyArc 0.95s cubic-bezier(0.2, 0.8, 0.3, 1) forwards';

      document.body.appendChild(chip);
      chip.addEventListener('animationend', () => {
        chip.remove();
        if (targetEl && targetEl.classList) {
          targetEl.classList.add('pulse-pill');
          setTimeout(() => targetEl.classList.remove('pulse-pill'), 350);
        }
      }, { once: true });
    }, delayMs);
  }

  // Backwards compatibility alias
  flyTokenToDock(color, delayMs = 0) {
    this.flyTokenToPlayer(color, delayMs, this.state ? this.state.activePlayerIndex : 0);
  }

  /**
   * Fly a 3D card from deck or table slot to the user dashboard
   */
  animateCardAction({ cardId, tier, fromDeck = false, isReserve = false, playerIndex, onComplete = null }) {
    const pIdx = (playerIndex !== undefined) ? playerIndex : (this.state ? this.state.activePlayerIndex : 0);
    const card = cardId ? (CARDS_BY_ID[cardId] || null) : null;
    const cardTier = tier || (card ? card.tier : 1);

    // Find destination element
    const toEl = this.getCardDestinationElement(card, pIdx, isReserve);

    // Find origin element
    let fromEl = null;
    if (fromDeck) {
      fromEl = document.querySelector(`.deck-pile.tier-${cardTier}`);
    } else if (cardId) {
      fromEl = document.querySelector(`.dev-card[data-card-id="${cardId}"]`)
            || document.querySelector(`.reserved-mini-card[data-card-id="${cardId}"]`)
            || document.querySelector(`.deck-pile.tier-${cardTier}`);
    }

    if (!fromEl) {
      fromEl = document.querySelector(`.deck-pile.tier-${cardTier}`) || document.querySelector('.card-matrix');
    }

    const wasOnTable = fromEl && fromEl.classList.contains('dev-card');

    const cardData = card || {
      id: cardId || `t${cardTier}_card`,
      tier: cardTier,
      gemBonus: 'gold',
      prestigePoints: 0
    };

    this.card3d?.flyCard({
      card: cardData,
      fromEl,
      toEl,
      isReserve,
      fromDeck,
      duration: 1150,
      onComplete: () => {
        onComplete?.();
      }
    });

    // If card was taken from table, also animate a fresh replacement card dealing from deck to fill the slot!
    if (wasOnTable && this.card3d) {
      setTimeout(() => {
        this.card3d.flyDeckToSlot({ tier: cardTier, slotEl: fromEl });
      }, 350);
    }
  }

  getCardDestinationElement(card, pIdx, isReserve) {
    const state = this.state;
    const player = state ? state.players[pIdx] : null;
    const isTwoPlayer = state && state.players.length === 2;
    const gemColor = card ? card.gemBonus : 'diamond';

    if (isReserve) {
      // Destination: Reserved cards tray
      if (isTwoPlayer) {
        const isTargetBottom = (this.gameMode === 'online')
          ? (player?.id === this.localPlayerId)
          : (pIdx === 0);
        return isTargetBottom
          ? (document.getElementById('reserved-tray') || document.getElementById('player-dock'))
          : (document.getElementById('p2-reserved-tray') || document.getElementById('top-player-table'));
      } else {
        const isTargetBottom = (this.gameMode === 'pass_and_play')
          ? (state.activePlayerIndex === pIdx)
          : (player?.id === this.localPlayerId);
        return isTargetBottom
          ? (document.getElementById('reserved-tray') || document.getElementById('player-dock'))
          : (document.getElementById(`opponent-card-${pIdx}`) || document.getElementById('opponents-container'));
      }
    } else {
      // Destination: Gem card holdings stack (purchased card)
      if (isTwoPlayer) {
        const isTargetBottom = (this.gameMode === 'online')
          ? (player?.id === this.localPlayerId)
          : (pIdx === 0);
        return isTargetBottom
          ? (document.querySelector(`#player-gem-holdings .card-gem-${gemColor}`) || document.getElementById('player-dock'))
          : (document.querySelector(`#p2-gem-holdings .card-gem-${gemColor}`) || document.getElementById('top-player-table'));
      } else {
        const isTargetBottom = (this.gameMode === 'pass_and_play')
          ? (state.activePlayerIndex === pIdx)
          : (player?.id === this.localPlayerId);
        return isTargetBottom
          ? (document.querySelector(`#player-gem-holdings .card-gem-${gemColor}`) || document.getElementById('player-dock'))
          : (document.querySelector(`#opponent-card-${pIdx} .mini-bonus-badge.gem-${gemColor}`) || document.getElementById(`opponent-card-${pIdx}`));
      }
    }
  }


  // -------------------------------------------------------------
  // CARD INSPECTION & ACTIONS
  // -------------------------------------------------------------
  inspectCard(card, canAfford, payment, isReserved = false) {
    if (!this.cardModal) return;

    soundEngine.playCardSnap();

    const titleEl = document.getElementById('card-modal-title');
    const bodyEl = document.getElementById('card-modal-body');
    const actionsEl = document.getElementById('card-modal-actions');

    titleEl.innerHTML = `Tier ${card.tier} Development Card (+${card.prestigePoints} Points)`;

    bodyEl.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; background:rgba(0,0,0,0.3); padding:12px; border-radius:8px;">
        <div>
          <div style="font-size:11px; color:var(--text-muted);">PERMANENT GEM BONUS</div>
          <div style="font-size:18px; font-weight:bold; color:${GEM_METADATA[card.gemBonus].colorHex};">
            ${GEM_METADATA[card.gemBonus].symbol} ${card.gemBonus.toUpperCase()}
          </div>
        </div>
        <div>
          <div style="font-size:11px; color:var(--text-muted);">PRESTIGE VALUE</div>
          <div style="font-size:24px; font-weight:bold; color:var(--text-gold);">
            ${card.prestigePoints} PTS
          </div>
        </div>
      </div>

      <div style="margin-top:12px;">
        <div style="font-size:12px; color:var(--text-muted); margin-bottom:6px;">ACQUISITION COST:</div>
        <div style="display:flex; gap:8px;">
          ${Object.entries(card.cost).map(([c, n]) => `
            <span class="cost-badge gem-${c}" style="font-size:13px; padding:4px 8px;">
              ${GEM_METADATA[c].symbol} ${c} × ${n}
            </span>
          `).join('')}
        </div>
      </div>

      ${payment && payment.gold > 0 ? `
        <div style="margin-top:8px; font-size:12px; color:#fbbf24; background:rgba(251,191,36,0.1); padding:8px; border-radius:6px; border:1px solid rgba(251,191,36,0.3);">
          ★ Uses ${payment.gold} Gold Joker token(s) to substitute for missing gems.
        </div>
      ` : ''}
      ${isReserved === 'purchased' ? `
        <div style="margin-top:8px; font-size:12px; color:#10b981; background:rgba(16,185,129,0.15); padding:8px; border-radius:6px; border:1px solid rgba(16,185,129,0.4); text-align:center; font-weight:600;">
          ✓ Already Purchased & Active in Permanent Bonus Stack
        </div>
      ` : ''}
      ${isReserved === 'preview' ? `
        <div style="margin-top:8px; font-size:12px; color:var(--text-muted); background:rgba(255,255,255,0.05); padding:8px; border-radius:6px; text-align:center;">
          (Reserved Card Preview)
        </div>
      ` : ''}
    `;

    // Check Guild Ladder constraint
    let isTierLocked = false;
    let tierLockMsg = '';
    if (this.state && this.state.gameMode === 'tier_ladder' && isReserved !== 'purchased' && isReserved !== 'preview') {
      const activePlayer = this.state.players[this.state.activePlayerIndex];
      if (card.tier === 2) {
        const t1Count = activePlayer.cardsPurchased.filter(id => CARDS_BY_ID[id] && CARDS_BY_ID[id].tier === 1).length;
        if (t1Count < 6) {
          isTierLocked = true;
          tierLockMsg = `Guild Ladder: Requires 6 Tier 1 cards before buying Tier 2 (you have ${t1Count}/6)`;
        }
      } else if (card.tier === 3) {
        const t2Count = activePlayer.cardsPurchased.filter(id => CARDS_BY_ID[id] && CARDS_BY_ID[id].tier === 2).length;
        if (t2Count < 6) {
          isTierLocked = true;
          tierLockMsg = `Guild Ladder: Requires 6 Tier 2 cards before buying Tier 3 (you have ${t2Count}/6)`;
        }
      }
    }

    if (isTierLocked) {
      bodyEl.innerHTML += `
        <div style="margin-top:8px; font-size:12px; color:#f87171; background:rgba(239,68,68,0.15); padding:8px; border-radius:6px; border:1px solid rgba(239,68,68,0.4); text-align:center; font-weight:600;">
          🔒 ${tierLockMsg}
        </div>
      `;
    }

    actionsEl.innerHTML = '';

    if (isReserved !== 'purchased' && isReserved !== 'preview') {
      // Purchase Button
      const btnBuy = document.createElement('button');
      btnBuy.className = 'action-btn';
      btnBuy.innerHTML = `Purchase Card ${payment && payment.gold > 0 ? '(with Gold)' : ''}`;
      btnBuy.disabled = !canAfford || isTierLocked;
      if (isTierLocked) btnBuy.title = tierLockMsg;
      btnBuy.onclick = () => {
        this.cardModal.classList.add('hidden');
        soundEngine.playCardPurchase();
        this.callbacks.onPurchaseCard(card.id);
      };
      actionsEl.appendChild(btnBuy);

      // Reserve Button (only if not already reserved and player holds < reserveLimit reserved cards)
      const activePlayer = this.state.players[this.state.activePlayerIndex];
      const maxReserve = activePlayer.reserveLimit || 3;
      const goldGain = activePlayer.goldPerReserve || 1;
      if (!isReserved && activePlayer.cardsReserved.length < maxReserve) {
        const btnReserve = document.createElement('button');
        btnReserve.className = 'secondary-btn';
        btnReserve.innerHTML = `Reserve Card (+${goldGain} Gold)`;
        btnReserve.onclick = () => {
          this.cardModal.classList.add('hidden');
          soundEngine.playCardSnap();
          this.callbacks.onReserveCard({ cardId: card.id });
        };
        actionsEl.appendChild(btnReserve);
      }
    }

    // Always provide a Close button
    const btnClose = document.createElement('button');
    btnClose.className = 'secondary-btn';
    btnClose.innerHTML = 'Close';
    btnClose.onclick = () => this.cardModal.classList.add('hidden');
    actionsEl.appendChild(btnClose);

    this.cardModal.classList.remove('hidden');
  }

  promptBlindReserve(tier) {
    this.showGameConfirm(
      `⚜️ Reserve Tier ${tier} Card`,
      `Reserve the top face-down card from the <strong>Tier ${tier}</strong> deck?<br><br>You will receive <strong style="color:var(--text-gold);">1 Gold Joker</strong> token if available.`,
      () => {
        soundEngine.playCardSnap();
        this.callbacks.onReserveCard({ tier, fromDeck: true });
      }
    );
  }

  // -------------------------------------------------------------
  // PENDING ACTION MODALS (DISCARD & NOBLE)
  // -------------------------------------------------------------
  handlePendingModals(state) {
    // 1. Pending Discard Modal
    if (state.pendingDiscard) {
      const pIdx = state.pendingDiscard.playerIndex;
      const discardPlayer = state.players[pIdx];
      const isDiscardLocal = (this.gameMode === 'pass_and_play')
        ? (!discardPlayer?.isAi)
        : (state.pendingDiscard.playerId === this.localPlayerId);

      if (isDiscardLocal) {
        this.showDiscardModal(state, state.pendingDiscard.excessCount);
      } else {
        this.discardModal?.classList.add('hidden');
      }
    } else {
      this.discardModal?.classList.add('hidden');
    }

    // 2. Pending Noble Choice Modal
    if (state.pendingNobleChoice) {
      const pIdx = state.pendingNobleChoice.playerIndex;
      const noblePlayer = state.players[pIdx];
      const isNobleLocal = (this.gameMode === 'pass_and_play')
        ? (!noblePlayer?.isAi)
        : (state.pendingNobleChoice.playerId === this.localPlayerId);

      if (isNobleLocal) {
        this.showNobleChoiceModal(state, state.pendingNobleChoice.nobleIds);
      } else {
        this.nobleModal?.classList.add('hidden');
      }
    } else {
      this.nobleModal?.classList.add('hidden');
    }

    // 3. Pending Arcane Draft Modal (Every 4 Rounds)
    if (state.pendingPowerDraft) {
      this.showPowerDraftModal(state);
    } else {
      this.powerDraftModal?.classList.add('hidden');
    }
  }

  showPowerDraftModal(state) {
    if (!this.powerDraftModal || !state.pendingPowerDraft) return;
    const draft = state.pendingPowerDraft;
    const chooser = state.players[draft.choosingPlayerIndex];
    const otherPlayer = state.players[draft.otherPlayerIndex];
    if (!chooser || !otherPlayer) return;

    const isChooserLocal = (this.gameMode === 'pass_and_play')
      ? (!chooser.isAi)
      : (draft.choosingPlayerId === this.localPlayerId);

    if (this.powerDraftTitle) {
      this.powerDraftTitle.innerHTML = `⚔️ ARCANE DRAFT — ROUND ${draft.round} (${draft.tierName.toUpperCase()}) ⚔️`;
    }

    if (this.powerDraftSubtitle) {
      if (isChooserLocal) {
        this.powerDraftSubtitle.innerHTML = `<strong style="color: #38bdf8;">${chooser.name}</strong>'s Choice: Pick 1 power for your arsenal. The other goes to <strong style="color: #fcd34d;">${otherPlayer.name}</strong>!`;
      } else {
        this.powerDraftSubtitle.innerHTML = `<strong style="color: #f59e0b;">${chooser.name}</strong> (AI) is evaluating arcane powers...`;
      }
    }

    const cardElements = [this.draftCard0, this.draftCard1];
    draft.cards.forEach((powerId, idx) => {
      const el = cardElements[idx];
      if (!el) return;
      const def = POWERS_DATA[powerId];
      if (!def) return;

      const isSelected = this.selectedDraftPowerId === powerId;
      const isOther = this.selectedDraftPowerId && this.selectedDraftPowerId !== powerId;

      el.className = `draft-card-choice tier-${def.tier || 'common'}`;
      if (isSelected) el.classList.add('selected-for-draft');
      if (isOther) el.classList.add('draft-card-other-pick');
      if (!isChooserLocal) el.classList.add('disabled');

      const targetBadge = def.target === 'opponent'
        ? `<span class="draft-card-badge badge-curse">⚡ RIVAL CURSE</span>`
        : `<span class="draft-card-badge badge-boon">✨ BENEFICIAL BOON</span>`;

      const typeBadge = `<span class="draft-card-badge badge-passive">${def.type.toUpperCase()}</span>`;

      el.innerHTML = `
        <div class="draft-card-top">
          <span style="color:${def.colorHex}; font-weight:800; font-size:11px;">✦ ${def.tierName.toUpperCase()}</span>
          ${typeBadge}
        </div>
        <div class="draft-card-icon">${def.icon}</div>
        <div class="draft-card-title">${def.name}</div>
        <div>${targetBadge}</div>
        <div class="draft-card-desc">${def.desc}</div>
      `;

      el.onclick = () => {
        if (!isChooserLocal) return;
        this.selectedDraftPowerId = powerId;
        soundEngine.playCardSnap();
        this.showPowerDraftModal(this.state);
      };
    });

    if (this.btnConfirmDraftPick) {
      if (isChooserLocal) {
        this.btnConfirmDraftPick.disabled = !this.selectedDraftPowerId;
        this.btnConfirmDraftPick.innerHTML = this.selectedDraftPowerId
          ? `✦ Claim ${POWERS_DATA[this.selectedDraftPowerId]?.name || 'Power'} ✦`
          : 'Select a Power to Claim';
      } else {
        this.btnConfirmDraftPick.disabled = true;
        this.btnConfirmDraftPick.innerText = `⏳ ${chooser.name} is choosing...`;
      }
    }

    this.powerDraftModal.classList.remove('hidden');
  }

  showDiscardModal(state, excessCount) {
    if (!this.discardModal || !state.pendingDiscard) return;
    const pIdx = state.pendingDiscard.playerIndex;
    const player = state.players[pIdx];
    if (!player) return;

    const listEl = document.getElementById('discard-tokens-list');
    const remainingEl = document.getElementById('discard-remaining-count');
    const btnConfirm = document.getElementById('btn-confirm-discard');

    const discardMap = { diamond: 0, sapphire: 0, emerald: 0, ruby: 0, onyx: 0, gold: 0 };

    const updateUI = () => {
      const currentlySelected = Object.values(discardMap).reduce((a, b) => a + b, 0);
      const remaining = excessCount - currentlySelected;
      remainingEl.innerText = `${remaining}`;
      remainingEl.style.color = remaining === 0 ? '#10b981' : '#ef4444';
      btnConfirm.disabled = remaining !== 0;
    };

    listEl.innerHTML = '';
    ALL_TOKENS.forEach(color => {
      const owned = player.tokens[color] || 0;
      if (owned === 0) return;

      const row = document.createElement('div');
      row.className = 'discard-row';
      row.innerHTML = `
        <span class="token-chip-pill gem-${color}">
          ${GEM_METADATA[color].symbol} ${color} (Owned: ${owned})
        </span>
        <div class="counter-controls">
          <button class="counter-btn" id="dec-${color}">-</button>
          <strong id="val-${color}">0</strong>
          <button class="counter-btn" id="inc-${color}">+</button>
        </div>
      `;
      listEl.appendChild(row);

      row.querySelector(`#inc-${color}`).onclick = () => {
        const total = Object.values(discardMap).reduce((a, b) => a + b, 0);
        if (discardMap[color] < owned && total < excessCount) {
          discardMap[color]++;
          row.querySelector(`#val-${color}`).innerText = discardMap[color];
          soundEngine.playChipClink();
          updateUI();
        }
      };

      row.querySelector(`#dec-${color}`).onclick = () => {
        if (discardMap[color] > 0) {
          discardMap[color]--;
          row.querySelector(`#val-${color}`).innerText = discardMap[color];
          soundEngine.playChipClink();
          updateUI();
        }
      };
    });

    updateUI();

    btnConfirm.onclick = () => {
      this.discardModal.classList.add('hidden');
      this.callbacks.onDiscardTokens(discardMap);
    };

    this.discardModal.classList.remove('hidden');
  }

  showNobleChoiceModal(state, nobleIds) {
    if (!this.nobleModal) return;
    const listEl = document.getElementById('noble-choice-list');
    listEl.innerHTML = '';

    soundEngine.playNobleFanfare();

    nobleIds.forEach(nobleId => {
      const noble = NOBLES_BY_ID[nobleId];
      const card = document.createElement('div');
      card.className = 'noble-card';
      card.style.cursor = 'pointer';
      card.innerHTML = `
        <div class="noble-header">
          <span class="noble-points">+3 PTS</span>
          <span class="noble-avatar">${noble.avatar}</span>
        </div>
        <div class="noble-name">${noble.name}</div>
        <div style="font-size:10px; color:var(--text-muted);">${noble.title}</div>
      `;
      card.onclick = () => {
        this.nobleModal.classList.add('hidden');
        this.callbacks.onChooseNoble(nobleId);
      };
      listEl.appendChild(card);
    });

    this.nobleModal.classList.remove('hidden');
  }

  // -------------------------------------------------------------
  // TURN TIMER
  // -------------------------------------------------------------
  updateTurnTimer(state) {
    if (!this.turnTimerEl) return;
    if (this.timerInterval) clearInterval(this.timerInterval);

    if (state.timeLimitSeconds <= 0 || !state.turnDeadline) {
      this.turnTimerEl.innerHTML = '';
      return;
    }

    const tick = () => {
      const remainingSec = Math.max(0, Math.ceil((state.turnDeadline - Date.now()) / 1000));
      const mins = Math.floor(remainingSec / 60);
      const secs = remainingSec % 60;
      this.turnTimerEl.innerText = `⏱ ${mins}:${secs < 10 ? '0' : ''}${secs}`;

      if (remainingSec <= 10) {
        this.turnTimerEl.classList.add('warning');
        if (remainingSec === 10 || remainingSec === 5) {
          soundEngine.playTurnChime();
        }
      } else {
        this.turnTimerEl.classList.remove('warning');
      }

      if (remainingSec === 0) {
        clearInterval(this.timerInterval);
        if (this.callbacks.onTurnTimeout) {
          this.callbacks.onTurnTimeout();
        }
      }
    };

    tick();
    this.timerInterval = setInterval(tick, 1000);
  }

  // -------------------------------------------------------------
  // GAME OVER & ANALYTICS
  // -------------------------------------------------------------
  showGameOverModal(state) {
    if (!this.gameOverModal) return;
    soundEngine.playVictory();

    const target = state.targetPoints || 15;
    const subTitle = document.getElementById('game-over-subtitle');
    if (subTitle) {
      if (state.gameMode === 'onyx_syndicate') {
        subTitle.innerText = `The Shadow Syndicate has crowned a master! (Goal: 10 Onyx Cards)`;
      } else if (state.gameMode === 'color_supremacy') {
        subTitle.innerText = `The Color Monopoly Champion has claimed 3 Trophies!`;
      } else if (state.gameMode === 'noble_court') {
        subTitle.innerText = `The Noble Court has bestowed royal favor! (Goal: 3 Noble Patrons)`;
      } else if (state.gameMode === 'rainbow_guild') {
        subTitle.innerText = `The Renaissance Prism Master has assembled all 5 gemstone disciplines!`;
      } else if (state.gameMode === 'tier_ladder') {
        subTitle.innerText = `The Guild Ladder Master has triumphed with structured craftsmanship!`;
      } else {
        subTitle.innerText = `The Merchant Guild has reached the ${target} prestige points goal!`;
      }
    }

    const podiumList = document.getElementById('podium-list');
    podiumList.innerHTML = '';

    state.rankings.forEach(entry => {
      let modeDetail = '';
      if (state.gameMode === 'onyx_syndicate') {
        modeDetail = ` | 🖤 ${entry.onyxCount}/10 Onyx`;
      } else if (state.gameMode === 'color_supremacy') {
        modeDetail = ` | ⭐ ${entry.trophies}/3 Trophies`;
      } else if (state.gameMode === 'noble_court') {
        modeDetail = ` | ⚜️ ${entry.noblesCount}/3 Nobles`;
      } else if (state.gameMode === 'rainbow_guild') {
        modeDetail = ` | 🌈 ${entry.colorsCompleted}/5 Colors (3+)`;
      }

      const isPureObjective = ['onyx_syndicate', 'color_supremacy', 'noble_court', 'rainbow_guild'].includes(state.gameMode);
      let scoreText = `${entry.points} PTS`;
      if (isPureObjective) {
        if (state.gameMode === 'onyx_syndicate') scoreText = `🖤 ${entry.onyxCount}/10 ONYX`;
        else if (state.gameMode === 'color_supremacy') scoreText = `⭐ ${entry.trophies}/3 BADGES`;
        else if (state.gameMode === 'noble_court') scoreText = `⚜️ ${entry.noblesCount}/3 NOBLES`;
        else if (state.gameMode === 'rainbow_guild') scoreText = `🌈 ${entry.colorsCompleted}/5 COLORS`;
      }

      const row = document.createElement('div');
      row.style.display = 'flex';
      row.style.justifyContent = 'space-between';
      row.style.padding = '8px 12px';
      row.style.background = entry.rank === 1 ? 'rgba(212,175,55,0.2)' : 'rgba(255,255,255,0.04)';
      row.style.border = entry.rank === 1 ? '1px solid var(--border-gold)' : '1px solid rgba(255,255,255,0.1)';
      row.style.borderRadius = '6px';
      row.innerHTML = `
        <div>
          <strong style="color:${entry.rank === 1 ? 'var(--text-gold)' : '#fff'};">
            #${entry.rank} ${entry.name} ${entry.isAi ? '(AI)' : ''}
          </strong>
          <div style="font-size:11px; color:var(--text-muted);">
            Cards: ${entry.cardsCount} | Tokens: ${entry.tokensCount} | Nobles: ${entry.noblesCount}${modeDetail}
          </div>
        </div>
        <div style="font-family:var(--font-serif); font-size:20px; font-weight:800; color:var(--text-gold);">
          ${scoreText}
        </div>
      `;
      podiumList.appendChild(row);
    });

    this.drawMatchAnalytics(state);

    document.getElementById('btn-play-again').onclick = () => {
      window.location.reload();
    };

    this.gameOverModal.classList.remove('hidden');
  }

  drawMatchAnalytics(state) {
    const canvas = document.getElementById('analytics-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width = 460;
    const h = canvas.height = 140;

    ctx.clearRect(0, 0, w, h);

    // Render simple bar comparison of Prestige Points & Engine sizes
    ctx.fillStyle = '#94a3b8';
    ctx.font = '10px sans-serif';
    ctx.fillText('FINAL PRESTIGE & CARD BONUSES BREAKDOWN', 10, 16);

    const barWidth = 35;
    const spacing = 100;
    const target = state.targetPoints || 15;
    const maxVal = Math.max(target, 20);

    state.players.forEach((p, idx) => {
      const x = 30 + idx * spacing;
      const totalBonus = Object.values(p.bonuses).reduce((a, b) => a + b, 0);

      // Points bar
      const ptsH = Math.min(80, (p.prestigePoints / maxVal) * 80);
      ctx.fillStyle = '#fbbf24';
      ctx.fillRect(x, h - 25 - ptsH, barWidth, ptsH);

      // Bonus bar
      const bonH = Math.min(80, (totalBonus / maxVal) * 80);
      ctx.fillStyle = '#38bdf8';
      ctx.fillRect(x + barWidth + 4, h - 25 - bonH, barWidth, bonH);

      // Label
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 10px sans-serif';
      ctx.fillText(p.name.substring(0, 8), x, h - 8);
    });
  }

  // -------------------------------------------------------------
  // EMOTE BROADCAST
  // -------------------------------------------------------------
  broadcastEmote(text) {
    this.displayFloatingEmote('You', text);
    if (this.callbacks.onSendEmote) {
      this.callbacks.onSendEmote(text);
    }
  }

  displayFloatingEmote(senderName, text) {
    const bubble = document.createElement('div');
    bubble.className = 'floating-emote';
    bubble.innerHTML = `<strong>${senderName}:</strong> "${text}"`;
    bubble.style.bottom = `${80 + Math.random() * 40}px`;
    bubble.style.left = `${20 + Math.random() * 20}%`;
    document.body.appendChild(bubble);
    setTimeout(() => bubble.remove(), 2500);
  }
}

