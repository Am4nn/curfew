# -*- coding: utf-8 -*-
"""Install the shared motion sheet.

Run once against `chrome.py` (so every generated board gets it) and against the
hand-written boards that predate the generator.

One motion, not sixteen. The sections of a screen rise together on a stagger
that DECELERATES, so the last few land almost at once and the whole thing reads
as one gesture arriving rather than a queue being served. Expo-out, 620ms, and
it runs ONCE: nothing on a page of content loops. A loop is for a character, and
Ren is the only character here.
"""
import io, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
PROJECT = os.environ.get('CURFEW_V5_PROJECT') or os.path.join(os.path.dirname(HERE), 'project')
BS = chr(92)

MOTION = '''
    /*
      REVEAL. The sections of a screen rise together on a stagger that
      DECELERATES: the last few land almost at once, so the whole thing reads
      as one gesture arriving rather than a queue being served.

      Expo-out, 620ms, and it runs ONCE. Nothing on a page of content loops. A
      loop is for a character, and Ren is the only character here.

      The travel is 14px. More is a slide, less and the eye misses it.
    */
    @keyframes rise {
      from { opacity: 0; transform: translateY(14px); }
      to   { opacity: 1; transform: none; }
    }
    @keyframes appear { from { opacity: 0; } to { opacity: 1; } }

    .stage > * { animation: rise 620ms cubic-bezier(0.16, 1, 0.3, 1) both; }
    .stage > *:nth-child(1)  { animation-delay:   0ms; }
    .stage > *:nth-child(2)  { animation-delay:  73ms; }
    .stage > *:nth-child(3)  { animation-delay: 129ms; }
    .stage > *:nth-child(4)  { animation-delay: 173ms; }
    .stage > *:nth-child(5)  { animation-delay: 208ms; }
    .stage > *:nth-child(6)  { animation-delay: 235ms; }
    .stage > *:nth-child(7)  { animation-delay: 256ms; }
    .stage > *:nth-child(8)  { animation-delay: 272ms; }
    .stage > *:nth-child(9)  { animation-delay: 285ms; }
    .stage > *:nth-child(10) { animation-delay: 295ms; }
    .stage > *:nth-child(n+11) { animation-delay: 302ms; }

    /* Chrome does not arrive. It is simply there, and only fades up. */
    .stage > .tabbar { animation: appear 300ms ease-out both; }

    /* A bar draws itself, after the section carrying it has landed. */
    @keyframes fill { from { transform: scaleX(0); } to { transform: scaleX(1); } }
    @keyframes grow { from { transform: scaleY(0); } to { transform: scaleY(1); } }
    .fill { transform-origin: left center;   animation: fill 900ms 300ms cubic-bezier(0.16, 1, 0.3, 1) both; }
    .grow { transform-origin: bottom center; animation: grow 760ms 260ms cubic-bezier(0.16, 1, 0.3, 1) both; }

    /*
      PRESS. 140ms down, and the release rides the same curve rather than
      bouncing: a button that springs back is a button that argues with you.
    */
    button, a { transition: transform 140ms cubic-bezier(0.2, 0, 0, 1); }
    button:active, a:active { transform: scale(0.972); }

    @media (prefers-reduced-motion: reduce) {
      .stage > *, .stage > .tabbar, .fill, .grow { animation: none; }
      button, a { transition: none; }
      button:active, a:active { transform: none; }
    }
'''

SCROLLBAR = '    ::-webkit-scrollbar { width: 0; height: 0; }'

# These do not stage. Their root children are absolutely positioned full-bleed
# layers, and rising them one after another would pull a photograph off its own
# viewfinder. They fade instead.
NO_STAGE = {'Capture', 'Stamp', 'Notice', 'Ren'}


def patch_chrome():
    path = os.path.join(HERE, 'chrome.py')
    s = io.open(path, encoding='utf-8').read()
    if '@keyframes rise' in s:
        return 'chrome.py already carries the motion sheet'
    assert SCROLLBAR in s, 'chrome.py scrollbar anchor'
    s = s.replace(SCROLLBAR, SCROLLBAR + '\n' + MOTION, 1)

    a = "def root(h, extra=''):"
    assert a in s, 'chrome.py root anchor'
    s = s.replace(a, "def root(h, extra='', stage=True):\n    cls = ' class=" + '"stage"' + "' if stage else ''", 1)
    b = "    return ('" + BS + "n<div style=" + '"' + "width: 390px;"
    assert b in s, 'chrome.py root body anchor'
    s = s.replace(b, "    return ('" + BS + "n<div' + cls + ' style=" + '"' + "width: 390px;", 1)

    c = "out = ('  <div style=" + '"' + "flex: none; display: flex; background: rgba(18,18,20,0.96); '"
    assert c in s, 'chrome.py tabbar anchor'
    s = s.replace(c, "out = ('  <div class=" + '"' + "tabbar" + '"' + " style=" + '"'
                  + "flex: none; display: flex; background: rgba(18,18,20,0.96); '", 1)

    io.open(path, 'w', encoding='utf-8', newline='').write(s)
    return 'chrome.py: motion sheet installed, root staged, tab bar exempt'


def patch_board(stem):
    """The boards written before the generator existed. Same sheet, same rules."""
    path = os.path.join(PROJECT, stem + '.dc.html')
    s = io.open(path, encoding='utf-8').read()
    if '@keyframes rise' in s:
        return None
    if SCROLLBAR.strip() in s:
        s = s.replace(SCROLLBAR.strip(), SCROLLBAR.strip() + '\n' + MOTION, 1)
    else:
        # A couple of the early boards style body{margin:0} and nothing else.
        m = re.search(r'(<helmet>.*?<style>\n)', s, re.S)
        if not m:
            return '%s: no <helmet><style> to extend' % stem
        s = s[:m.end(1)] + MOTION + s[m.end(1):]

    if stem not in NO_STAGE:
        m = re.search(r'<div style="width: 390px; height: \d+px;', s)
        if not m:
            return '%s: no 390px root to stage' % stem
        s = s[:m.start()] + '<div class="stage" style=' + s[m.start() + len('<div style='):]
        # The tab bar, when this board has one, is exempt from the cascade.
        tab = '<div style="flex: none; display: flex; background: rgba(18,18,20,0.96);'
        if tab in s:
            s = s.replace(tab, '<div class="tabbar" style="flex: none; display: flex; background: rgba(18,18,20,0.96);', 1)

    io.open(path, 'w', encoding='utf-8', newline='').write(s)
    return '%s: motion' % stem


if __name__ == '__main__':
    print(patch_chrome())
    for stem in sys.argv[1:]:
        note = patch_board(stem)
        if note:
            print('  ' + note)
