# -*- coding: utf-8 -*-
"""Rebuild canvas.json from a declared row layout, and refuse to write it if any
board's three heights disagree.

The three heights are the root element's, the $preview hint's and the canvas
frame's. They have to be the same number. When they are not, overflow:hidden
clips the content and the frame paints the difference as empty background, which
is exactly the bug that cost an afternoon on Main.
"""
import io, json, os, re, sys

# The artboards live beside this folder. CURFEW_V5_PROJECT points it at a
# scratchpad copy instead, which is what the publishing session uses.
OUT = os.environ.get('CURFEW_V5_PROJECT') or os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'project')

ROWS = [
    ('Five tabs', ['Main', 'Coach', 'Stats', 'Groups', 'Activities']),
    ('Getting in', ['Splash', 'Signin', 'Welcome', 'Catalog', 'Configure', 'Notice']),
    ('In a group', ['Group', 'GroupStats', 'Evidence', 'Standing', 'Ranks', 'Ledger',
                    'GroupSettings', 'Invite']),
    ('Monk mode', ['Monk', 'MonkSetup', 'MonkLocked']),
    ('The moments', ['Capture', 'Declare', 'Stamp', 'Restore']),
    ('Helping each other', ['Nudge', 'Nudged']),
    ('You, and everything under it', ['Settings', 'Sharing', 'Notifs', 'Photos', 'Away', 'Data', 'Switches']),
    ('The mark, and Ren', ['Mark', 'Ren']),
    ('Behind the glass', ['Admin']),
    # Its own row. It is six thousand pixels of policy and it would otherwise
    # leave every board beside it floating in empty canvas.
    ('The gate', ['Consent']),
]

TITLES = {
    'Main': 'Home', 'Coach': 'Ren', 'Stats': 'Your record', 'Groups': 'Groups',
    'Activities': 'Your activities', 'Signin': 'Sign in', 'Welcome': 'First run',
    'Consent': 'The consent gate', 'Catalog': 'Add an activity',
    'Configure': 'Configure · Sleep', 'Notice': 'A release notice',
    'Splash': 'Opening Curfew',
    'Group': 'One group', 'GroupStats': 'The group’s week',
    'Evidence': 'What the group shared', 'Standing': 'Standing & money',
    'Ranks': 'How standing works', 'Ledger': 'The full ledger',
    'GroupSettings': 'Group settings', 'Invite': 'An invitation',
    'Monk': 'Monk mode', 'MonkSetup': 'Monk mode · set up',
    'MonkLocked': 'Monk mode · not yet', 'Capture': 'Check in · tap through it',
    'Declare': 'Check in · no camera', 'Stamp': 'The day is done',
    'Restore': 'After a miss', 'Nudge': 'Nudge a friend', 'Nudged': 'Being nudged',
    'Settings': 'You', 'Sharing': 'What you share', 'Notifs': 'Notifications',
    'Photos': 'Your photographs', 'Away': 'Away days', 'Data': 'Your data',
    'Switches': 'Ren and nudges, off', 'Ren': 'Ren, every mood', 'Admin': 'Ops',
    'Mark': 'The mark',
}

STATIC = {'Stamp', 'Nudged', 'Ren', 'Signin', 'Notice', 'Evidence', 'Photos',
          'Ledger', 'Mark', 'Splash'}

ROOT_RE = re.compile(r'width:\s*390px;\s*height:\s*(\d+)px')
PREVIEW_RE = re.compile(r'"\$preview"\s*:\s*\{\s*"width"\s*:\s*390\s*,\s*"height"\s*:\s*(\d+)\s*\}')

COL, GAP, TITLE_UP = 470, 320, 250


def heights(stem):
    path = os.path.join(OUT, stem + '.dc.html')
    src = io.open(path, encoding='utf-8').read()
    root = ROOT_RE.search(src)
    prev = PREVIEW_RE.search(src)
    if not root:
        sys.exit('%s: no 390px root element found' % stem)
    if not prev:
        sys.exit('%s: no $preview hint found' % stem)
    return int(root.group(1)), int(prev.group(1))


declared = [s for _, stems in ROWS for s in stems]
on_disk = sorted(f[:-8] for f in os.listdir(OUT) if f.endswith('.dc.html'))
missing = sorted(set(on_disk) - set(declared))
unknown = sorted(set(declared) - set(on_disk))
if missing or unknown:
    sys.exit('layout out of step. On disk but unplaced: %s. Placed but absent: %s.'
             % (missing or 'none', unknown or 'none'))
if len(declared) != len(set(declared)):
    sys.exit('a board is placed in two rows')

boards, order, notes = {}, [], {}
y, bad = 0, []
for i, (heading, stems) in enumerate(ROWS):
    tallest = 0
    for j, stem in enumerate(stems):
        root_h, preview_h = heights(stem)
        if root_h != preview_h:
            bad.append('%s: root %d, $preview %d' % (stem, root_h, preview_h))
        boards[stem + '.dc.html'] = {
            'x': j * COL, 'y': y, 'w': 390, 'h': root_h,
            'title': TITLES[stem],
        }
        if stem not in STATIC:
            boards[stem + '.dc.html']['is_interactive'] = True
        order.append(stem + '.dc.html')
        tallest = max(tallest, root_h)
    notes['t-%d' % i] = {
        'kind': 'title1', 'color': 'pink', 'text': heading,
        'x': 0, 'y': y - TITLE_UP, 'w': 640, 'maxW': max(640, len(stems) * COL - 80),
    }
    y += tallest + GAP

if bad:
    sys.exit('heights disagree, nothing written:\n  ' + '\n  '.join(bad))

index_path = os.path.join(OUT, 'canvas.json')
index = json.load(io.open(index_path, encoding='utf-8'))
index['boards'] = boards
index['order'] = order
index['notes'] = notes
index['launch'] = {'view': 'canvas'}
io.open(index_path, 'w', encoding='utf-8', newline='').write(
    json.dumps(index, indent=2, sort_keys=True, ensure_ascii=False) + '\n')

print('%d boards in %d rows, every height agrees.' % (len(boards), len(ROWS)))
for i, (heading, stems) in enumerate(ROWS):
    print('  %-20s %s' % (heading, ' '.join(stems)))
