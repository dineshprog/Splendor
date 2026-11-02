/**
 * Splendor Online — Universal Network Transport Layer
 * Provides serverless WebRTC Peer-to-Peer multiplayer (ideal for GitHub Pages & static hosting)
 * and backward-compatible WebSocket support (for local server.py or custom cloud relay servers).
 */

const DEFAULT_ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  { urls: 'stun:global.stun.twilio.com:3478' }
];

export class SplendorNetwork {
  constructor(options = {}) {
    this.onMessage = options.onMessage || (() => {});
    this.onStatus = options.onStatus || (() => {});
    this.onError = options.onError || (() => {});
    this.onRoomJoined = options.onRoomJoined || (() => {});

    this.transport = 'p2p'; // 'p2p' | 'websocket'
    this.peer = null;
    this.ws = null;
    this.isHost = false;
    this.roomId = null;
    this.playerName = 'Merchant';
    this.playerCount = 2;
    this.timerSec = 60;
    this.targetPoints = 15;
    this.gameMode = 'classic';
    this.localPlayerId = null;

    // WebRTC P2P Host State
    this.clients = new Map(); // peerId -> { conn, playerId, name, isHost }
    this.currentGameState = null;

    // WebRTC P2P Guest State
    this.hostConn = null; // DataConnection to host

    this.isConnected = false;
    this.reconnectTimer = null;
  }

  async ensurePeerJsLoaded() {
    if (typeof window !== 'undefined' && typeof window.Peer !== 'undefined') {
      return true;
    }
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'js/peerjs.min.js';
      script.onload = () => {
        if (typeof window.Peer !== 'undefined') resolve(true);
        else reject(new Error('PeerJS not found after loading js/peerjs.min.js'));
      };
      script.onerror = () => {
        // Fallback to public CDN if local path fails
        const cdn = document.createElement('script');
        cdn.src = 'https://unpkg.com/peerjs@1.5.4/dist/peerjs.min.js';
        cdn.onload = () => resolve(true);
        cdn.onerror = () => reject(new Error('Could not load PeerJS library'));
        document.head.appendChild(cdn);
      };
      document.head.appendChild(script);
    });
  }

  formatPeerId(roomId) {
    const clean = String(roomId || '').trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
    return `splendor-v2-${clean}`;
  }

  async connect({
    roomId,
    playerName,
    playerCount = 2,
    timerSec = 60,
    targetPoints = 15,
    gameMode = 'classic',
    isHost = false,
    transport = 'p2p',
    customServerUrl = ''
  }) {
    this.close();

    this.roomId = String(roomId || '').trim().toUpperCase();
    this.playerName = (playerName || 'Merchant').trim();
    this.playerCount = Math.max(2, Math.min(4, parseInt(playerCount, 10) || 2));
    this.timerSec = parseInt(timerSec, 10) || 60;
    this.targetPoints = parseInt(targetPoints, 10) || 15;
    this.gameMode = gameMode || 'classic';
    this.isHost = !!isHost;
    this.transport = transport;

    if (this.transport === 'websocket') {
      this.connectWebSocket(customServerUrl);
    } else {
      await this.connectP2P();
    }
  }

  // =========================================================================
  // WebRTC PEER-TO-PEER (SERVERLESS / GITHUB PAGES)
  // =========================================================================
  async connectP2P() {
    try {
      await this.ensurePeerJsLoaded();
    } catch (err) {
      console.error('PeerJS loading error:', err);
      this.onError('Multiplayer library failed to load. Please verify your internet connection.');
      return;
    }

    if (this.isHost) {
      this.initP2PHost();
    } else {
      this.initP2PGuest();
    }
  }

  initP2PHost() {
    const hostPeerId = this.formatPeerId(this.roomId);
    this.onStatus('Creating secure P2P room...', false);

    try {
      this.peer = new window.Peer(hostPeerId, {
        debug: 1,
        config: { iceServers: DEFAULT_ICE_SERVERS }
      });

      this.peer.on('open', (id) => {
        this.isConnected = true;
        this.localPlayerId = 'p_1';
        this.onStatus('🟢 P2P Room Ready. Waiting for players to join...', false);

        // Notify local app that host has joined room as p_1
        this.onMessage({
          type: 'room_joined',
          roomId: this.roomId,
          playerId: 'p_1',
          isHost: true,
          playerCount: this.playerCount,
          timerSec: this.timerSec,
          targetPoints: this.targetPoints,
          gameMode: this.gameMode,
          players: [{ id: 'p_1', name: this.playerName, isHost: true }],
          state: null
        });
      });

      this.peer.on('connection', (conn) => {
        this.setupHostIncomingConnection(conn);
      });

      this.peer.on('error', (err) => {
        console.warn('PeerJS Host Error:', err);
        if (err.type === 'unavailable-id') {
          // Room ID is currently taken; notify user
          this.onError(`Room #${this.roomId} is already active or was recently occupied. Please choose a different room code or create a new room.`);
        } else {
          this.onError(`P2P Connection Error: ${err.message || err.type}`);
        }
      });

      this.peer.on('close', () => {
        this.isConnected = false;
        this.onStatus('P2P room closed', true);
      });
    } catch (e) {
      console.error('Failed to initialize P2P host:', e);
      this.onError(`Failed to create P2P room: ${e.message}`);
    }
  }

  setupHostIncomingConnection(conn) {
    conn.on('open', () => {
      console.log(`[Host] Guest connected: ${conn.peer}`);
    });

    conn.on('data', (raw) => {
      let msg = raw;
      if (typeof raw === 'string') {
        try { msg = JSON.parse(raw); } catch (_) {}
      }
      this.handleHostReceivedMessage(conn, msg);
    });

    conn.on('close', () => {
      this.handleHostClientDisconnected(conn);
    });

    conn.on('error', (err) => {
      console.warn(`[Host] Connection error with peer ${conn.peer}:`, err);
    });
  }

  handleHostReceivedMessage(conn, msg) {
    if (!msg || typeof msg !== 'object') return;

    switch (msg.type) {
      case 'join_room': {
        const guestName = (msg.playerName || `Merchant ${this.clients.size + 2}`).trim();

        // Check if this guest is reconnecting to an active game
        let assignedId = null;
        if (this.currentGameState && this.currentGameState.players) {
          const matched = this.currentGameState.players.find(p => p.name === guestName && p.id !== 'p_1');
          if (matched) {
            assignedId = matched.id;
          }
        }

        if (!assignedId) {
          // Assign next available slot
          const usedIds = new Set(['p_1']);
          for (const c of this.clients.values()) {
            usedIds.add(c.playerId);
          }
          for (let i = 2; i <= this.playerCount; i++) {
            const pid = `p_${i}`;
            if (!usedIds.has(pid)) {
              assignedId = pid;
              break;
            }
          }
          if (!assignedId) {
            assignedId = 'spectator';
          }
        }

        this.clients.set(conn.peer, {
          conn,
          playerId: assignedId,
          name: guestName,
          isHost: false
        });

        const playersSummary = [
          { id: 'p_1', name: this.playerName, isHost: true },
          ...Array.from(this.clients.values()).map(c => ({
            id: c.playerId,
            name: c.name,
            isHost: false
          }))
        ];

        // 1. Reply to joining guest with room_joined
        try {
          conn.send({
            type: 'room_joined',
            roomId: this.roomId,
            playerId: assignedId,
            isHost: false,
            playerCount: this.playerCount,
            timerSec: this.timerSec,
            targetPoints: this.targetPoints,
            gameMode: this.gameMode,
            players: playersSummary,
            state: this.currentGameState
          });
        } catch (e) {
          console.error('[Host] Failed to send room_joined to guest:', e);
        }

        // 2. Broadcast player_joined to all other guests
        this.broadcastToGuests({
          type: 'player_joined',
          roomId: this.roomId,
          playerCount: this.playerCount,
          targetPoints: this.targetPoints,
          gameMode: this.gameMode,
          players: playersSummary,
          newPlayer: { id: assignedId, name: guestName }
        }, conn);

        // 3. Update host local player list
        this.onMessage({
          type: 'player_joined',
          roomId: this.roomId,
          playerCount: this.playerCount,
          targetPoints: this.targetPoints,
          gameMode: this.gameMode,
          players: playersSummary,
          newPlayer: { id: assignedId, name: guestName }
        });
        break;
      }

      case 'update_state': {
        this.currentGameState = msg.state;
        // Forward state_sync to local host
        this.onMessage({
          type: 'state_sync',
          state: msg.state,
          action: msg.action
        });
        // Forward state_sync to all other guests
        this.broadcastToGuests({
          type: 'state_sync',
          state: msg.state,
          action: msg.action
        }, conn);
        break;
      }

      case 'send_emote': {
        const client = this.clients.get(conn.peer);
        const sender = msg.senderName || client?.name || 'Merchant';
        // Display on host
        this.onMessage({
          type: 'remote_emote',
          senderName: sender,
          text: msg.text
        });
        // Forward to other guests
        this.broadcastToGuests({
          type: 'remote_emote',
          senderName: sender,
          text: msg.text
        }, conn);
        break;
      }
    }
  }

  handleHostClientDisconnected(conn) {
    const client = this.clients.get(conn.peer);
    if (!client) return;

    this.clients.delete(conn.peer);
    console.log(`[Host] Guest left: ${client.name} (${client.playerId})`);

    const leaveMsg = {
      type: 'player_left',
      playerId: client.playerId,
      name: client.name
    };

    // Forward to remaining guests
    this.broadcastToGuests(leaveMsg);
    // Forward to local host
    this.onMessage(leaveMsg);
  }

  broadcastToGuests(msgObj, excludeConn = null) {
    for (const client of this.clients.values()) {
      if (client.conn !== excludeConn && client.conn.open) {
        try {
          client.conn.send(msgObj);
        } catch (e) {
          console.warn(`[Host] Error broadcasting to ${client.name}:`, e);
        }
      }
    }
  }

  initP2PGuest() {
    this.onStatus(`Connecting to Host for Room #${this.roomId}...`, false);

    try {
      // Guest creates Peer with auto-assigned ID
      this.peer = new window.Peer(undefined, {
        debug: 1,
        config: { iceServers: DEFAULT_ICE_SERVERS }
      });

      this.peer.on('open', () => {
        const hostPeerId = this.formatPeerId(this.roomId);
        console.log(`[Guest] Peer initialized. Connecting to host ${hostPeerId}...`);

        this.hostConn = this.peer.connect(hostPeerId, {
          reliable: true
        });

        this.hostConn.on('open', () => {
          this.isConnected = true;
          this.onStatus('🟢 Connected to Host! Joining room...', false);

          // Send join request to host
          this.hostConn.send({
            type: 'join_room',
            roomId: this.roomId,
            playerName: this.playerName
          });
        });

        this.hostConn.on('data', (raw) => {
          let msg = raw;
          if (typeof raw === 'string') {
            try { msg = JSON.parse(raw); } catch (_) {}
          }
          if (msg.type === 'room_joined') {
            this.localPlayerId = msg.playerId;
            this.targetPoints = msg.targetPoints || this.targetPoints;
            this.gameMode = msg.gameMode || this.gameMode;
          }
          this.onMessage(msg);
        });

        this.hostConn.on('close', () => {
          this.isConnected = false;
          this.onStatus('⚠️ Connection to room host was closed.', true);
          this.onError('Host closed the room or disconnected.');
        });

        this.hostConn.on('error', (err) => {
          console.warn('[Guest] Connection error:', err);
          this.onError(`Connection error: ${err.message || 'Host connection failed'}`);
        });
      });

      this.peer.on('error', (err) => {
        console.warn('PeerJS Guest Error:', err);
        if (err.type === 'peer-unavailable') {
          this.onError(`Room #${this.roomId} was not found. Please verify the 6-character room code and ensure the host has created the room.`);
        } else {
          this.onError(`Multiplayer Connection Error: ${err.message || err.type}`);
        }
      });
    } catch (e) {
      console.error('Failed to initialize P2P guest:', e);
      this.onError(`Failed to connect to room: ${e.message}`);
    }
  }

  // =========================================================================
  // WEBSOCKET FALLBACK (LOCAL SERVER.PY OR CUSTOM RELAY)
  // =========================================================================
  connectWebSocket(customServerUrl = '') {
    let url = customServerUrl;
    if (!url) {
      const host = window.location.host || 'localhost:8000';
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      url = `${protocol}//${host}/ws?room=${this.roomId}`;
    }

    this.onStatus(`Connecting to WebSocket server (${url})...`, false);

    try {
      this.ws = new WebSocket(url);

      this.ws.onopen = () => {
        this.isConnected = true;
        this.onStatus('🟢 Connected to Splendor Server', false);
        this.ws.send(JSON.stringify({
          type: 'join_room',
          roomId: this.roomId,
          playerName: this.playerName,
          playerCount: this.playerCount,
          timerSec: this.timerSec,
          targetPoints: this.targetPoints,
          gameMode: this.gameMode
        }));
      };

      this.ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'room_joined') {
            this.localPlayerId = msg.playerId;
            this.isHost = msg.isHost;
          }
          this.onMessage(msg);
        } catch (e) {
          console.error('Error handling WebSocket message:', e);
        }
      };

      this.ws.onerror = (e) => {
        console.warn('WebSocket connection error:', e);
        this.onError('Could not connect to WebSocket server. If hosted on GitHub Pages, switch to WebRTC P2P in Settings.');
      };

      this.ws.onclose = () => {
        this.isConnected = false;
        this.onStatus('WebSocket closed', true);
      };
    } catch (e) {
      console.error('Failed to initialize WebSocket:', e);
      this.onError(`Failed to initialize WebSocket: ${e.message}`);
    }
  }

  // =========================================================================
  // MESSAGE SENDING (UNIFIED API)
  // =========================================================================
  send(msg) {
    if (this.transport === 'websocket') {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify(msg));
      }
      return;
    }

    // P2P Transport
    if (this.isHost) {
      // Host handling outgoing messages
      if (msg.type === 'init_game_state') {
        this.currentGameState = msg.state;
        // Broadcast game_start to guests
        this.broadcastToGuests({
          type: 'game_start',
          state: msg.state
        });
        // Dispatch to host locally
        this.onMessage({
          type: 'game_start',
          state: msg.state
        });
      } else if (msg.type === 'update_state') {
        this.currentGameState = msg.state;
        // Broadcast state_sync to all guests
        this.broadcastToGuests({
          type: 'state_sync',
          state: msg.state,
          action: msg.action
        });
      } else if (msg.type === 'send_emote') {
        const sender = msg.senderName || this.playerName || 'Merchant';
        // Broadcast to all guests
        this.broadcastToGuests({
          type: 'remote_emote',
          senderName: sender,
          text: msg.text
        });
        // Display on host
        this.onMessage({
          type: 'remote_emote',
          senderName: sender,
          text: msg.text
        });
      }
    } else {
      // Guest sending message to Host
      if (this.hostConn && this.hostConn.open) {
        try {
          this.hostConn.send(msg);
        } catch (e) {
          console.error('[Guest] Failed to send message to host:', e);
        }
      }
    }
  }

  close() {
    this.isConnected = false;

    if (this.ws) {
      try { this.ws.close(); } catch (_) {}
      this.ws = null;
    }

    if (this.hostConn) {
      try { this.hostConn.close(); } catch (_) {}
      this.hostConn = null;
    }

    for (const client of this.clients.values()) {
      try { client.conn.close(); } catch (_) {}
    }
    this.clients.clear();

    if (this.peer) {
      try { this.peer.destroy(); } catch (_) {}
      this.peer = null;
    }

    this.currentGameState = null;
  }
}

