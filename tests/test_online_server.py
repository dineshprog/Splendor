#!/usr/bin/env python3
"""
Unit tests for Splendor Online WebSocket Server
Verifies RFC 6455 frame handling, room lifecycle, and message routing.
"""

import unittest
import json
import io
import os
import sys
import struct

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from server import SplendorHandler, ROOMS, ROOMS_LOCK


class DummySocket:
    """Mock socket backed by BytesIO for testing RFC 6455 without network permissions."""

    def __init__(self, incoming_bytes=b""):
        self.incoming = io.BytesIO(incoming_bytes)
        self.outgoing = io.BytesIO()

    def recv(self, num_bytes):
        return self.incoming.read(num_bytes)

    def sendall(self, data):
        self.outgoing.write(data)

    def close(self):
        pass


class TestOnlineServer(unittest.TestCase):

    def setUp(self):
        with ROOMS_LOCK:
            ROOMS.clear()
        # Instantiate dummy handler without invoking SimpleHTTPRequestHandler.__init__
        self.handler = SplendorHandler.__new__(SplendorHandler)

    def test_websocket_frame_roundtrip(self):
        """Test encoding and decoding unmasked and masked frames."""
        test_payload = json.dumps({"type": "test_ping", "data": "hello_world"}).encode("utf-8")

        # Encode frame via server
        sock = DummySocket()
        self.handler.send_websocket_frame(sock, 0x1, test_payload)

        # Decode using read_websocket_frame
        read_sock = DummySocket(sock.outgoing.getvalue())
        opcode, payload = self.handler.read_websocket_frame(read_sock)

        self.assertEqual(opcode, 0x1)
        self.assertEqual(payload, test_payload)

    def test_masked_client_frame_decoding(self):
        """Test decoding masked frame from client (RFC 6455 client-to-server)."""
        msg = b'{"type":"join_room","roomId":"TEST1"}'
        mask = b'\x12\x34\x56\x78'
        masked_payload = bytearray(len(msg))
        for i in range(len(msg)):
            masked_payload[i] = msg[i] ^ mask[i % 4]

        # 0x81 = FIN + text frame; 0x80 | len = masked
        header = bytearray([0x81, 0x80 | len(msg)]) + mask + masked_payload
        sock = DummySocket(bytes(header))

        opcode, payload = self.handler.read_websocket_frame(sock)
        self.assertEqual(opcode, 0x1)
        self.assertEqual(payload, msg)

    def test_room_lifecycle_and_multiplayer_routing(self):
        """Simulate 2-player join, state init, and move sync without network sockets."""
        sock_p1 = DummySocket()
        sock_p2 = DummySocket()

        # Step 1: P1 creates room
        with ROOMS_LOCK:
            room_id = "ROOMX"
            ROOMS[room_id] = {
                'room_id': room_id,
                'player_count': 2,
                'timer_sec': 60,
                'state': None,
                'host_sock': sock_p1,
                'clients': {
                    sock_p1: {'player_id': 'p_1', 'name': 'Alice', 'is_host': True}
                }
            }

        # Verify P1 is registered as host in ROOMX
        self.assertIn("ROOMX", ROOMS)
        self.assertEqual(len(ROOMS["ROOMX"]["clients"]), 1)
        self.assertTrue(ROOMS["ROOMX"]["clients"][sock_p1]["is_host"])

        # Step 2: P2 joins
        with ROOMS_LOCK:
            ROOMS["ROOMX"]["clients"][sock_p2] = {
                'player_id': 'p_2',
                'name': 'Bob',
                'is_host': False
            }

        self.assertEqual(len(ROOMS["ROOMX"]["clients"]), 2)
        self.assertEqual(ROOMS["ROOMX"]["clients"][sock_p2]["player_id"], 'p_2')

        # Step 3: Broadcast game_start to all clients in room
        test_state = {"status": "in_progress", "activePlayerIndex": 0}
        self.handler.broadcast_to_room("ROOMX", {
            "type": "game_start",
            "state": test_state
        })

        # Verify both sockets received game_start
        for sock in [sock_p1, sock_p2]:
            read_sock = DummySocket(sock.outgoing.getvalue())
            opcode, payload = self.handler.read_websocket_frame(read_sock)
            self.assertEqual(opcode, 0x1)
            msg = json.loads(payload.decode('utf-8'))
            self.assertEqual(msg["type"], "game_start")
            self.assertEqual(msg["state"]["status"], "in_progress")

        # Step 4: P1 makes a move, broadcast update_state to P2 (exclude P1)
        sock_p2.outgoing = io.BytesIO()  # clear buffer
        sock_p1.outgoing = io.BytesIO()
        test_state["activePlayerIndex"] = 1
        self.handler.broadcast_to_room("ROOMX", {
            "type": "state_sync",
            "state": test_state,
            "action": {"type": "take_distinct", "playerIndex": 0}
        }, exclude_sock=sock_p1)

        # P1 should have received nothing (excluded)
        self.assertEqual(len(sock_p1.outgoing.getvalue()), 0)

        # P2 should have received state_sync
        read_sock = DummySocket(sock_p2.outgoing.getvalue())
        opcode, payload = self.handler.read_websocket_frame(read_sock)
        self.assertEqual(opcode, 0x1)
        msg = json.loads(payload.decode('utf-8'))
        self.assertEqual(msg["type"], "state_sync")
        self.assertEqual(msg["state"]["activePlayerIndex"], 1)

    def test_large_frame_decoding(self):
        """Test decoding payload > 125 bytes (16-bit extended length)."""
        large_text = "x" * 800
        msg = json.dumps({"large": large_text}).encode("utf-8")
        mask = b'\xaa\xbb\xcc\xdd'
        masked_payload = bytearray(len(msg))
        for i in range(len(msg)):
            masked_payload[i] = msg[i] ^ mask[i % 4]

        # 126 signifies 16-bit length follows
        header = bytearray([0x81, 0x80 | 126]) + struct.pack("!H", len(msg)) + mask + masked_payload
        sock = DummySocket(bytes(header))

        opcode, payload = self.handler.read_websocket_frame(sock)
        self.assertEqual(opcode, 0x1)
        self.assertEqual(payload, msg)

    def test_room_game_mode_and_target_points_sync(self):
        """Verify gameMode and targetPoints storage and broadcast in rooms."""
        sock_p1 = DummySocket()
        sock_p2 = DummySocket()

        with ROOMS_LOCK:
            room_id = "SYNDICATE"
            ROOMS[room_id] = {
                'room_id': room_id,
                'player_count': 2,
                'timer_sec': 60,
                'target_points': 25,
                'game_mode': 'onyx_syndicate',
                'state': None,
                'host_sock': sock_p1,
                'clients': {
                    sock_p1: {'player_id': 'p_1', 'name': 'Alice', 'is_host': True}
                }
            }

        self.assertEqual(ROOMS["SYNDICATE"]["game_mode"], 'onyx_syndicate')
        self.assertEqual(ROOMS["SYNDICATE"]["target_points"], 25)

        # Broadcast player_joined including gameMode
        self.handler.broadcast_to_room("SYNDICATE", {
            'type': 'player_joined',
            'roomId': 'SYNDICATE',
            'playerCount': 2,
            'targetPoints': 25,
            'gameMode': 'onyx_syndicate',
            'players': [{'id': 'p_1', 'name': 'Alice', 'isHost': True}, {'id': 'p_2', 'name': 'Bob', 'isHost': False}]
        })

        read_sock = DummySocket(sock_p1.outgoing.getvalue())
        opcode, payload = self.handler.read_websocket_frame(read_sock)
        self.assertEqual(opcode, 0x1)
        msg = json.loads(payload.decode('utf-8'))
        self.assertEqual(msg["gameMode"], "onyx_syndicate")
        self.assertEqual(msg["targetPoints"], 25)


if __name__ == '__main__':
    unittest.main()
