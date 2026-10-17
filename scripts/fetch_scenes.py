#!/usr/bin/env python3
# /// script
# requires-python = ">=3.11"
# dependencies = ["Pillow==12.3.0"]
# ///
"""Download official press-kit illustrations for this local, personal guide."""
import argparse
import io
import json
from pathlib import Path
from urllib.request import Request, urlopen
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--force', action='store_true', help='Download again even if an image already exists.')
    args = parser.parse_args()
    scenes = json.loads((ROOT / 'scripts/scenes.json').read_text())
    folder = ROOT / 'public/game-assets/scenes'
    folder.mkdir(parents=True, exist_ok=True)
    for name, url in scenes.items():
        target = folder / (name + '.webp')
        if target.exists() and not args.force:
            print(f'Already available: {name}')
            continue
        request = Request(url, headers={'User-Agent': 'CastNChillPersonalGuide/1.0'})
        with urlopen(request, timeout=45) as response:
            bitmap = Image.open(io.BytesIO(response.read())).convert('RGB')
        bitmap.thumbnail((1500, 900))
        temporary = target.with_suffix('.tmp')
        bitmap.save(temporary, format='WEBP', quality=92, method=6)
        temporary.replace(target)
        print(f'Saved {target.relative_to(ROOT)}')


if __name__ == '__main__':
    main()
