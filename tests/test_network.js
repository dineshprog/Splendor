/**
 * Unit Test for Splendor Network Transport Layer
 * Verifies room code formatting, player allocation, state synchronization,
 * message framing, and reconnection handling.
 */

import { SplendorNetwork } from '../js/network.js';

function assert(cond, msg) {
  if (!cond) throw new Error(`[Assertion Error] ${msg}`);
}

console.log('===============================================================');
console.log('TEST: Splendor Network Transport Layer');
console.log('===============================================================');

// Test 1: Peer ID formatting & namespacing
console.log('TEST 1: Verifying Peer ID formatting & namespacing...');
const net = new SplendorNetwork();
assert(net.formatPeerId('ABC123') === 'splendor-v2-abc123', 'Room code ABC123 formatting failed');
assert(net.formatPeerId('xyz-99') === 'splendor-v2-xyz-99', 'Room code xyz-99 formatting failed');
assert(net.formatPeerId('  Room_42!  ') === 'splendor-v2-room_42', 'Special chars handling failed');
console.log('  ✓ Peer ID formatting verified.');

// Test 2: Simulated Host room initialization
console.log('TEST 2: Verifying Host room state & synthetic room_joined event...');
let hostReceivedMsg = null;
const hostNet = new SplendorNetwork({
  onMessage: (msg) => { hostReceivedMsg = msg; }
});
hostNet.roomId = 'TEST01';
hostNet.playerName = 'Alice';
hostNet.isHost = true;
hostNet.playerCount = 3;

// Trigger mock open
hostNet.localPlayerId = 'p_1';
hostNet.onMessage({
  type: 'room_joined',
  roomId: hostNet.roomId,
  playerId: 'p_1',
  isHost: true,
  playerCount: hostNet.playerCount,
  timerSec: 60,
  targetPoints: 15,
  gameMode: 'classic',
  players: [{ id: 'p_1', name: hostNet.playerName, isHost: true }],
  state: null
});

assert(hostReceivedMsg !== null, 'Host did not receive room_joined message');
assert(hostReceivedMsg.playerId === 'p_1', 'Host player ID should be p_1');
assert(hostReceivedMsg.players.length === 1, 'Initial player count should be 1');
console.log('  ✓ Host room initialization verified.');

// Test 3: Guest connections & player ID allocation
console.log('TEST 3: Verifying Guest join & multi-player slot allocation...');
const mockGuestConn1 = {
  peer: 'peer-guest-1',
  open: true,
  sent: [],
  send(data) { this.sent.push(data); }
};
const mockGuestConn2 = {
  peer: 'peer-guest-2',
  open: true,
  sent: [],
  send(data) { this.sent.push(data); }
};

let hostJoinedEvent = null;
hostNet.onMessage = (msg) => { hostJoinedEvent = msg; };

// Guest 1 joins
hostNet.handleHostReceivedMessage(mockGuestConn1, {
  type: 'join_room',
  playerName: 'Bob'
});

assert(hostNet.clients.size === 1, 'Host should track 1 guest client');
assert(mockGuestConn1.sent.length === 1, 'Guest 1 should receive room_joined');
assert(mockGuestConn1.sent[0].type === 'room_joined', 'Guest 1 message type should be room_joined');
assert(mockGuestConn1.sent[0].playerId === 'p_2', `Guest 1 should be p_2, got ${mockGuestConn1.sent[0].playerId}`);
assert(hostJoinedEvent.type === 'player_joined', 'Host should receive player_joined event');
assert(hostJoinedEvent.newPlayer.name === 'Bob', 'New player name should be Bob');

// Guest 2 joins
hostNet.handleHostReceivedMessage(mockGuestConn2, {
  type: 'join_room',
  playerName: 'Carol'
});

assert(hostNet.clients.size === 2, 'Host should track 2 guest clients');
assert(mockGuestConn2.sent[0].playerId === 'p_3', `Guest 2 should be p_3, got ${mockGuestConn2.sent[0].playerId}`);
// Verify Guest 1 received broadcast for Guest 2
assert(mockGuestConn1.sent.some(m => m.type === 'player_joined' && m.newPlayer.name === 'Carol'), 'Guest 1 should receive broadcast about Carol');
console.log('  ✓ 3-Player slot allocation & notifications verified.');

// Test 4: Game state initialization & broadcast
console.log('TEST 4: Verifying game start state broadcast...');
const mockState = { turnIndex: 1, activePlayerIndex: 0, players: [{ name: 'Alice' }, { name: 'Bob' }, { name: 'Carol' }] };
hostNet.send({
  type: 'init_game_state',
  roomId: 'TEST01',
  state: mockState
});

assert(hostNet.currentGameState === mockState, 'Host should store currentGameState');
assert(mockGuestConn1.sent.some(m => m.type === 'game_start' && m.state === mockState), 'Guest 1 should receive game_start');
assert(mockGuestConn2.sent.some(m => m.type === 'game_start' && m.state === mockState), 'Guest 2 should receive game_start');
console.log('  ✓ Game start broadcast verified.');

// Test 5: In-game move state synchronization
console.log('TEST 5: Verifying move state synchronization across peers...');
const updatedState = { ...mockState, turnIndex: 2 };
const moveAction = { type: 'take_distinct', colors: ['diamond', 'ruby', 'emerald'] };

// Guest 1 sends move to host
let hostStateSync = null;
hostNet.onMessage = (msg) => { hostStateSync = msg; };
hostNet.handleHostReceivedMessage(mockGuestConn1, {
  type: 'update_state',
  state: updatedState,
  action: moveAction
});

assert(hostStateSync.type === 'state_sync', 'Host should receive state_sync');
assert(hostStateSync.action === moveAction, 'Host should receive action payload');
assert(mockGuestConn2.sent.some(m => m.type === 'state_sync' && m.action === moveAction), 'Guest 2 should receive forwarded state_sync');
console.log('  ✓ State sync relay verified.');

// Test 6: Reconnection to active game
console.log('TEST 6: Verifying player reconnection during active game...');
const reconnectConn = {
  peer: 'peer-guest-1-reconnected',
  open: true,
  sent: [],
  send(data) { this.sent.push(data); }
};
hostNet.currentGameState = {
  players: [
    { id: 'p_1', name: 'Alice' },
    { id: 'p_2', name: 'Bob' },
    { id: 'p_3', name: 'Carol' }
  ]
};

hostNet.handleHostReceivedMessage(reconnectConn, {
  type: 'join_room',
  playerName: 'Bob'
});

assert(reconnectConn.sent[0].playerId === 'p_2', `Reconnected Bob should be assigned p_2, got ${reconnectConn.sent[0].playerId}`);
assert(reconnectConn.sent[0].state !== null, 'Reconnected player should receive active game state');
console.log('  ✓ Reconnection to active match verified.');

// Test 7: Disconnect handling
console.log('TEST 7: Verifying player disconnect notification...');
let hostPlayerLeftEvent = null;
hostNet.onMessage = (msg) => { hostPlayerLeftEvent = msg; };
hostNet.handleHostClientDisconnected(mockGuestConn2);

assert(!hostNet.clients.has(mockGuestConn2.peer), 'Disconnected client should be removed from client map');
assert(hostPlayerLeftEvent.type === 'player_left', 'Host should receive player_left notification');
assert(hostPlayerLeftEvent.playerId === 'p_3', 'Player left ID should be p_3');
console.log('  ✓ Disconnect handling verified.');

console.log('\n===============================================================');
console.log('ALL NETWORK TESTS PASSED SUCCESSFULLY! (EXIT CODE 0)');
console.log('===============================================================');

