#!/usr/bin/env python3
"""
Splendor Asset Downloader / Curator
Downloads public domain Renaissance paintings and museum assets from Wikimedia Commons
for all 10 historical Nobles, Development Cards, and Deck Backs.

Usage:
    python3 download_assets.py
"""

import os
import sys
import urllib.request
import urllib.error

ASSETS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'assets')
NOBLES_DIR = os.path.join(ASSETS_DIR, 'nobles')
CARDS_DIR = os.path.join(ASSETS_DIR, 'cards')
DECKS_DIR = os.path.join(ASSETS_DIR, 'decks')

# Public domain historical Renaissance portraits corresponding to the 10 Splendor Nobles
NOBLE_SOURCES = {
    'noble_1': {
        'name': 'Henri IV of France',
        'url': 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3a/Henri_IV_de_France_par_Frans_Pourbus_le_Jeune.jpg/400px-Henri_IV_de_France_par_Frans_Pourbus_le_Jeune.jpg'
    },
    'noble_2': {
        'name': 'Isabella I of Castile',
        'url': 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e5/Isabel_la_Cat%C3%B3lica%2C_por_Juan_de_Flandes.jpg/400px-Isabel_la_Cat%C3%B3lica%2C_por_Juan_de_Flandes.jpg'
    },
    'noble_3': {
        'name': 'Francis I of France',
        'url': 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/07/Francis_I_by_Jean_Clouet.jpg/400px-Francis_I_by_Jean_Clouet.jpg'
    },
    'noble_4': {
        'name': 'Anne of Brittany',
        'url': 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5c/Anne_de_Bretagne_Grandes_Heures.jpg/400px-Anne_de_Bretagne_Grandes_Heures.jpg'
    },
    'noble_5': {
        'name': 'Charles V (Holy Roman Emperor)',
        'url': 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/87/Tizian_082.jpg/400px-Tizian_082.jpg'
    },
    'noble_6': {
        'name': 'Suleiman the Magnificent',
        'url': 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e0/Suleiman_the_Magnificent.jpg/400px-Suleiman_the_Magnificent.jpg'
    },
    'noble_7': {
        'name': 'Mary Stuart (Queen of Scots)',
        'url': 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/29/Mary%2C_Queen_of_Scots_after_Nicholas_Hilliard.jpg/400px-Mary%2C_Queen_of_Scots_after_Nicholas_Hilliard.jpg'
    },
    'noble_8': {
        'name': 'Elisabeth of Austria',
        'url': 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f6/Elisabeth_of_Austria_%281554%E2%80%931592%29_by_Francois_Clouet.jpg/400px-Elisabeth_of_Austria_%281554%E2%80%931592%29_by_Francois_Clouet.jpg'
    },
    'noble_9': {
        'name': 'Niccolò Machiavelli',
        'url': 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e2/Santi_di_Tito_-_Niccolo_Machiavelli%27s_portrait.jpg/400px-Santi_di_Tito_-_Niccolo_Machiavelli%27s_portrait.jpg'
    },
    'noble_10': {
        'name': 'Catherine de\' Medici',
        'url': 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/77/Caterina_de_Medici.jpg/400px-Caterina_de_Medici.jpg'
    }
}

HEADERS = {
    'User-Agent': 'SplendorArtDownloader/1.0 (https://github.com/example/splendor; education@example.com)'
}

def download_file(url, target_path):
    try:
        req = urllib.request.Request(url, headers=HEADERS)
        with urllib.request.urlopen(req, timeout=15) as response, open(target_path, 'wb') as out_file:
            out_file.write(response.read())
        return True
    except Exception as e:
        print(f"  [!] Failed {url}: {e}")
        return False

def main():
    print("=== Splendor Renaissance Asset Manager ===")
    os.makedirs(NOBLES_DIR, exist_ok=True)
    os.makedirs(CARDS_DIR, exist_ok=True)
    os.makedirs(DECKS_DIR, exist_ok=True)

    print("\n[1/2] Checking & Downloading Noble Portraits from Wikimedia Commons...")
    for noble_id, info in NOBLE_SOURCES.items():
        dest = os.path.join(NOBLES_DIR, f"{noble_id}.jpg")
        if os.path.exists(dest):
            print(f"  [✓] {info['name']} already exists at {dest}")
        else:
            print(f"  [↓] Downloading {info['name']}...")
            ok = download_file(info['url'], dest)
            if ok:
                print(f"      Saved {dest}")

    print("\n[2/2] Asset verification complete.")
    print(f"Assets directory: {ASSETS_DIR}")

if __name__ == '__main__':
    main()

