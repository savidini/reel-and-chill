"""Build the guide's original 5×7 display alphabet. Requires fontTools."""
from pathlib import Path
from fontTools.fontBuilder import FontBuilder
from fontTools.pens.ttGlyphPen import TTGlyphPen

ROWS = {
    'A': '01110 10001 10001 11111 10001 10001 10001',
    'B': '11110 10001 10001 11110 10001 10001 11110',
    'C': '01111 10000 10000 10000 10000 10000 01111',
    'D': '11110 10001 10001 10001 10001 10001 11110',
    'E': '11111 10000 10000 11110 10000 10000 11111',
    'F': '11111 10000 10000 11110 10000 10000 10000',
    'G': '01111 10000 10000 10111 10001 10001 01111',
    'H': '10001 10001 10001 11111 10001 10001 10001',
    'I': '11111 00100 00100 00100 00100 00100 11111',
    'J': '00111 00010 00010 00010 10010 10010 01100',
    'K': '10001 10010 10100 11000 10100 10010 10001',
    'L': '10000 10000 10000 10000 10000 10000 11111',
    'M': '10001 11011 10101 10101 10001 10001 10001',
    'N': '10001 11001 11001 10101 10011 10011 10001',
    'O': '01110 10001 10001 10001 10001 10001 01110',
    'P': '11110 10001 10001 11110 10000 10000 10000',
    'Q': '01110 10001 10001 10001 10101 10010 01101',
    'R': '11110 10001 10001 11110 10100 10010 10001',
    'S': '01111 10000 10000 01110 00001 00001 11110',
    'T': '11111 00100 00100 00100 00100 00100 00100',
    'U': '10001 10001 10001 10001 10001 10001 01110',
    'V': '10001 10001 10001 10001 10001 01010 00100',
    'W': '10001 10001 10001 10101 10101 10101 01010',
    'X': '10001 10001 01010 00100 01010 10001 10001',
    'Y': '10001 10001 01010 00100 00100 00100 00100',
    'Z': '11111 00001 00010 00100 01000 10000 11111',
    '0': '01110 10001 10011 10101 11001 10001 01110',
    '1': '00100 01100 00100 00100 00100 00100 01110',
    '2': '01110 10001 00001 00010 00100 01000 11111',
    '3': '11110 00001 00001 01110 00001 00001 11110',
    '4': '00010 00110 01010 10010 11111 00010 00010',
    '5': '11111 10000 10000 11110 00001 00001 11110',
    '6': '01110 10000 10000 11110 10001 10001 01110',
    '7': '11111 00001 00010 00100 01000 01000 01000',
    '8': '01110 10001 10001 01110 10001 10001 01110',
    '9': '01110 10001 10001 01111 00001 00001 01110',
    '&': '01100 10010 10100 01000 10101 10010 01101',
    '-': '00000 00000 00000 11111 00000 00000 00000',
    '.': '00000 00000 00000 00000 00000 01100 01100',
    ',': '00000 00000 00000 00000 01100 01100 01000',
    ':': '00000 01100 01100 00000 01100 01100 00000',
    "'": '00100 00100 01000 00000 00000 00000 00000',
    '/': '00001 00001 00010 00100 01000 10000 10000',
    '!': '00100 00100 00100 00100 00100 00000 00100',
    '?': '01110 10001 00001 00010 00100 00000 00100',
    '(': '00010 00100 01000 01000 01000 00100 00010',
    ')': '01000 00100 00010 00010 00010 00100 01000',
    '+': '00000 00100 00100 11111 00100 00100 00000',
    ' ': '00000 00000 00000 00000 00000 00000 00000',
}

builder = FontBuilder(800, isTTF=True)
glyphs = {'.notdef': TTGlyphPen(None).glyph()}
cmap = {}
metrics = {'.notdef': (600, 0)}
for char, rows in ROWS.items():
    name = f'uni{ord(char):04X}'
    pen = TTGlyphPen(None)
    edges = set()
    for row, bits in enumerate(rows.split()):
        for col, bit in enumerate(bits):
            if bit == '1':
                x, y = col * 100, (6 - row) * 100
                corners = [(x, y), (x, y + 100), (x + 100, y + 100), (x + 100, y)]
                for a, b in zip(corners, corners[1:] + corners[:1]):
                    if (b, a) in edges:
                        edges.remove((b, a))
                    else:
                        edges.add((a, b))
    # Trace the silhouette so adjoining cells have no rasterisation seams.
    while edges:
        start, end = min(edges)
        edges.remove((start, end))
        pen.moveTo(start)
        while end != start:
            pen.lineTo(end)
            edge = min(edge for edge in edges if edge[0] == end)
            edges.remove(edge)
            end = edge[1]
        pen.closePath()
    glyphs[name] = pen.glyph()
    metrics[name] = (350 if char == ' ' else 600, 0)
    cmap[ord(char)] = name
    if char.isalpha():
        cmap[ord(char.lower())] = name
for alias, original in [('’', "'"), ('‘', "'"), ('–', '-'), ('—', '-'), ('·', '.')]:
    cmap[ord(alias)] = cmap[ord(original)]
builder.setupGlyphOrder(list(glyphs))
builder.setupCharacterMap(cmap)
builder.setupGlyf(glyphs)
builder.setupHorizontalMetrics(metrics)
builder.setupHorizontalHeader(ascent=700, descent=-100)
builder.setupNameTable({'familyName': 'Cast Pixel', 'styleName': 'Regular', 'uniqueFontIdentifier': 'CastPixel-Regular-1', 'fullName': 'Cast Pixel Regular', 'psName': 'CastPixel-Regular', 'version': 'Version 1.0'})
builder.setupOS2(sTypoAscender=700, sTypoDescender=-100, usWinAscent=700, usWinDescent=100, sCapHeight=700)
builder.setupPost()
builder.setupMaxp()
builder.save(Path(__file__).resolve().parent.parent / 'public/fonts/CastPixel.ttf')
