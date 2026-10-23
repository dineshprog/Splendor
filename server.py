#!/usr/bin/env python3
"""
Splendor Online - Zero-Dependency HTTP & Real-Time WebSocket Server
Serves ES Modules with correct MIME types and manages multiplayer room synchronization.
Pure Python standard library (no pip packages required).
"""

import os
import sys
import json
import base64
import hashlib
import struct
import socket
import threading
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

PORT = 8000
WORKSPACE_DIR = os.path.dirname(os.path.abspath(__file__))

# Active WebSocket rooms:
# { room_id: { 'room_id': str, 'player_count': int, 'timer_sec': int, 'state': dict, 'host_sock': sock, 'clients': { sock: { 'player_id': str, 'name': str, 'is_host': bool } } } }
ROOMS = {}
ROOMS_LOCK = threading.Lock()
SEND_LOCK = threading.Lock()


class SplendorHandler(SimpleHTTPRequestHandler):
    """HTTP Request Handler that supports proper MIME types and WebSocket upgrades."""

    extensions_map = {
        '': 'application/octet-stream',
        '.html': 'text/html',
        '.css': 'text/css',
        '.js': 'application/javascript',
        '.mjs': 'application/javascript',
        '.json': 'application/json',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.svg': 'image/svg+xml',
        '.ico': 'image/x-icon',
    }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=WORKSPACE_DIR, **kwargs)

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()

    def do_GET(self):
        # Check for WebSocket upgrade request
        if self.headers.get('Upgrade', '').lower() == 'websocket':
            self.handle_websocket_upgrade()
            return

        # Normal HTTP file serving
        return super().do_GET()

    def handle_websocket_upgrade(self):
        key = self.headers.get('Sec-WebSocket-Key')
        if not key:
            self.send_error(400, "Missing Sec-WebSocket-Key")
            return

        # Compute Sec-WebSocket-Accept token according to RFC 6455
        magic = b"258EAFA5-E914-47DA-95CA-C5AB0DC85B11"
        sha1 = hashlib.sha1(key.encode('utf-8') + magic).digest()
        accept_token = base64.b64encode(sha1).decode('utf-8')

        # Send 101 Switching Protocols response
        self.send_response(101, 'Switching Protocols')
        self.send_header('Upgrade', 'websocket')
        self.send_header('Connection', 'Upgrade')
        self.send_header('Sec-WebSocket-Accept', accept_token)
        self.end_headers()

        # Detach raw socket from HTTP server handler
        sock = self.request
        sock.setblocking(True)

        current_room = None

        try:
            while True:
                opcode, payload = self.read_websocket_frame(sock)
                if opcode == 0x8:  # Connection close
                    break
                elif opcode == 0x9:  # Ping -> Pong
                    self.send_websocket_frame(sock, 0xA, payload)
                elif opcode == 0x1:  # Text frame
                    data_str = payload.decode('utf-8')
                    try:
                        msg = json.loads(data_str)
                        msg_type = msg.get('type')

                        if msg_type == 'join_room':
                            current_room = str(msg.get('roomId', '')).strip().upper() or 'DEFAULT'
                            player_name = str(msg.get('playerName', '')).strip() or 'Merchant'
                            player_count = int(msg.get('playerCount', 2) or 2)
                            timer_sec = int(msg.get('timerSec', 60) or 60)
                            target_points = int(msg.get('targetPoints', 15) or 15)
                            game_mode = str(msg.get('gameMode', 'classic')).strip() or 'classic'

                            with ROOMS_LOCK:
                                if current_room not in ROOMS:
                                    ROOMS[current_room] = {
                                        'room_id': current_room,
                                        'player_count': max(2, min(4, player_count)),
                                        'timer_sec': timer_sec,
                                        'target_points': target_points,
                                        'game_mode': game_mode,
                                        'state': None,
                                        'host_sock': sock,
                                        'clients': {}
                                    }

                                room = ROOMS[current_room]

                                if sock in room['clients']:
                                    client_info = room['clients'][sock]
                                else:
                                    assigned_id = None
                                    used_ids = set(c['player_id'] for c in room['clients'].values())
                                    for i in range(1, room['player_count'] + 1):
                                        pid = f"p_{i}"
                                        if pid not in used_ids:
                                            assigned_id = pid
                                            break

                                    if not assigned_id:
                                        assigned_id = 'spectator'

                                    is_host = (sock == room['host_sock']) or (assigned_id == 'p_1')
                                    client_info = {
                                        'player_id': assigned_id,
                                        'name': player_name,
                                        'is_host': is_host
                                    }
                                    room['clients'][sock] = client_info

                                players_summary = [
                                    {
                                        'id': c['player_id'],
                                        'name': c['name'],
                                        'isHost': c['is_host']
                                    }
                                    for c in room['clients'].values()
                                    if c['player_id'] != 'spectator'
                                ]

                                # Send room_joined to this socket
                                self.send_json(sock, {
                                    'type': 'room_joined',
                                    'roomId': current_room,
                                    'playerId': client_info['player_id'],
                                    'isHost': client_info['is_host'],
                                    'playerCount': room['player_count'],
                                    'timerSec': room['timer_sec'],
                                    'targetPoints': room.get('target_points', 15),
                                    'gameMode': room.get('game_mode', 'classic'),
                                    'players': players_summary,
                                    'state': room['state']
                                })

                                # Broadcast player_joined to other sockets
                                self.broadcast_to_room(current_room, {
                                    'type': 'player_joined',
                                    'roomId': current_room,
                                    'playerCount': room['player_count'],
                                    'targetPoints': room.get('target_points', 15),
                                    'gameMode': room.get('game_mode', 'classic'),
                                    'players': players_summary,
                                    'newPlayer': {
                                        'id': client_info['player_id'],
                                        'name': client_info['name']
                                    }
                                }, exclude_sock=sock)

                        elif msg_type == 'init_game_state':
                            if current_room:
                                with ROOMS_LOCK:
                                    room = ROOMS.get(current_room)
                                    if room:
                                        room['state'] = msg.get('state')
                                self.broadcast_to_room(current_room, {
                                    'type': 'game_start',
                                    'state': msg.get('state')
                                })

                        elif msg_type == 'update_state':
                            if current_room:
                                with ROOMS_LOCK:
                                    room = ROOMS.get(current_room)
                                    if room:
                                        room['state'] = msg.get('state')
                                self.broadcast_to_room(current_room, {
                                    'type': 'state_sync',
                                    'state': msg.get('state'),
                                    'action': msg.get('action')
                                }, exclude_sock=sock)

                        elif msg_type == 'send_emote':
                            if current_room:
                                with ROOMS_LOCK:
                                    room = ROOMS.get(current_room)
                                    sender_name = 'Merchant'
                                    if room and sock in room['clients']:
                                        sender_name = room['clients'][sock]['name']
                                self.broadcast_to_room(current_room, {
                                    'type': 'remote_emote',
                                    'senderName': msg.get('senderName') or sender_name,
                                    'text': msg.get('text', '')
                                })

                    except json.JSONDecodeError:
                        pass
        except Exception:
            pass
        finally:
            if current_room:
                with ROOMS_LOCK:
                    room = ROOMS.get(current_room)
                    if room and sock in room['clients']:
                        leaving = room['clients'].pop(sock)
                        self.broadcast_to_room(current_room, {
                            'type': 'player_left',
                            'playerId': leaving['player_id'],
                            'name': leaving['name']
                        })
                        if not room['clients'] and not room['state']:
                            del ROOMS[current_room]
            try:
                sock.close()
            except Exception:
                pass

    def read_exact(self, sock, num_bytes):
        """Reads exact number of bytes from socket to prevent TCP fragmentation issues."""
        data = bytearray()
        while len(data) < num_bytes:
            chunk = sock.recv(num_bytes - len(data))
            if not chunk:
                return None
            data.extend(chunk)
        return bytes(data)

    def read_websocket_frame(self, sock):
        """Reads and decodes an RFC 6455 WebSocket frame."""
        head = self.read_exact(sock, 2)
        if not head or len(head) < 2:
            return 0x8, b''

        byte1, byte2 = head[0], head[1]
        opcode = byte1 & 0x0F
        masked = (byte2 & 0x80) != 0
        payload_length = byte2 & 0x7F

        if payload_length == 126:
            ext_len = self.read_exact(sock, 2)
            if not ext_len:
                return 0x8, b''
            payload_length = struct.unpack("!H", ext_len)[0]
        elif payload_length == 127:
            ext_len = self.read_exact(sock, 8)
            if not ext_len:
                return 0x8, b''
            payload_length = struct.unpack("!Q", ext_len)[0]

        masks = b''
        if masked:
            masks = self.read_exact(sock, 4)
            if not masks:
                return 0x8, b''

        payload = bytearray()
        while len(payload) < payload_length:
            chunk = sock.recv(payload_length - len(payload))
            if not chunk:
                break
            payload.extend(chunk)

        if masked:
            unmasked = bytearray(len(payload))
            for i in range(len(payload)):
                unmasked[i] = payload[i] ^ masks[i % 4]
            payload = unmasked

        return opcode, bytes(payload)

    def send_websocket_frame(self, sock, opcode, payload):
        """Encodes and sends an unmasked RFC 6455 WebSocket frame (Server to Client)."""
        length = len(payload)
        header = bytearray()
        header.append(0x80 | (opcode & 0x0F))  # FIN bit + opcode

        if length <= 125:
            header.append(length)
        elif length <= 65535:
            header.append(126)
            header.extend(struct.pack("!H", length))
        else:
            header.append(127)
            header.extend(struct.pack("!Q", length))

        with SEND_LOCK:
            try:
                sock.sendall(bytes(header) + payload)
            except Exception:
                pass

    def send_json(self, sock, msg_dict):
        """Helper to send JSON WebSocket frame."""
        try:
            payload = json.dumps(msg_dict).encode('utf-8')
            self.send_websocket_frame(sock, 0x1, payload)
        except Exception:
            pass

    def broadcast_to_room(self, room_id, msg_dict, exclude_sock=None):
        """Broadcasts a JSON message to all connected clients in the specified room."""
        with ROOMS_LOCK:
            room = ROOMS.get(room_id)
            if not room:
                return
            clients = list(room['clients'].keys())

        payload = json.dumps(msg_dict).encode('utf-8')
        dead_sockets = []
        for client in clients:
            if client != exclude_sock:
                try:
                    self.send_websocket_frame(client, 0x1, payload)
                except Exception:
                    dead_sockets.append(client)

        if dead_sockets:
            with ROOMS_LOCK:
                if room_id in ROOMS:
                    for dead in dead_sockets:
                        if dead in ROOMS[room_id]['clients']:
                            del ROOMS[room_id]['clients'][dead]


def run_server(port=PORT):
    print(f"Starting Splendor Online server on http://localhost:{port} ...")
    print(f"Serving files from: {WORKSPACE_DIR}")
    server = ThreadingHTTPServer(('0.0.0.0', port), SplendorHandler)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping server.")
        server.server_close()


if __name__ == '__main__':
    run_server()

