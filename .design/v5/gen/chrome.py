# -*- coding: utf-8 -*-
"""Shared chrome for the v5 artboards. Every new board is built from these so
the nav bar, the tab bar and the palette cannot drift board to board."""
import io, os

# The artboards live beside this folder. CURFEW_V5_PROJECT points it at a
# scratchpad copy instead, which is what the publishing session uses.
OUT = os.environ.get('CURFEW_V5_PROJECT') or os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'project')

FOOD  = "/_blob/4d06b38a5688b46932db3a0f6f241639"
GYM   = "/_blob/29a69da1d644f97a416d32616c586889"
SLEEP = "/_blob/18def49919a492fde87296b6ab9320cb"

MONO = "'IBM Plex Mono', ui-monospace, monospace"
PINK, DEEP, GREY, DIM = '#ff375f', '#d81e46', '#8e8e93', '#48484a'
CARD, CARD2, SEP = '#1c1c1e', '#2c2c2e', 'rgba(255,255,255,0.08)'
GREEN, ORANGE, RED = '#30d158', '#ff9f0a', '#ff453a'

HEAD = """<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <script src="./support.js"></script>
</head>
<body>
<x-dc>
<helmet>
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@500;600;700&display=swap">
  <style>
    html, body { margin: 0; background: #000000; overflow: hidden; }
    ::-webkit-scrollbar { width: 0; height: 0; }

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

  </style>
</helmet>
"""


def root(h, extra='', stage=True):
    cls = ' class="stage"' if stage else ''
    return ('\n<div' + cls + ' style="width: 390px; height: %dpx; box-sizing: border-box; background: #000000; '
            "font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', system-ui, sans-serif; "
            '-webkit-font-smoothing: antialiased; color: #ffffff; display: flex; flex-direction: column; '
            'overflow: hidden;%s">\n' % (h, extra))


# The mark. Three 13-unit squares on a 32 grid, 2 of margin and 2 of gutter, and
# the fourth seat stays empty: DECIDED, 2026-09-21. Zero radius and crispEdges
# are the whole character of it, so neither is a parameter.
GOLD = '#ffd23f'


def mark(size, fill='#ffffff', hollow=False, radius=0, tint=None, glow=False):
    """tint takes three colours, one per square, for the exploration sheet only.
    The shipped mark is one colour."""
    fills = tint or (fill, fill, fill)
    seats = ((2, 2), (17, 2), (2, 17))
    body = ''
    for (x, y), colour in zip(seats, fills):
        if hollow:
            body += ('<rect x="%s" y="%s" width="12" height="12" rx="%d" fill="none" stroke="%s" stroke-width="1.6"/>'
                     % (x + 0.8, y + 0.8, radius, colour))
        else:
            body += '<rect x="%d" y="%d" width="13" height="13" rx="%d" fill="%s"/>' % (x, y, radius, colour)
    shadow = (' filter="drop-shadow(0 0 %dpx rgba(255,210,63,0.55))"' % max(3, size // 6)) if glow else ''
    return ('<svg viewBox="0 0 32 32" width="%d" height="%d" shape-rendering="crispEdges" '
            'aria-hidden="true" style="flex: none; display: block;"%s>%s</svg>'
            % (size, size, shadow, body))


def wordmark(size=13, colour=None, gap=10, mark_size=None):
    return ('<span style="display: flex; align-items: center; gap: %dpx;">%s'
            '<span style="font-family: %s; font-size: %dpx; font-weight: 700; letter-spacing: 0.34em; '
            'color: %s;">CURFEW</span></span>'
            % (gap, mark(mark_size or (size + 5), colour or '#ffffff'), MONO, size, colour or '#ffffff'))


def nav(href, label, right=''):
    """44px nav bar. The 44x44 target is offset -12px so the chevron's optical
    left edge lands on the 20px margin, above the large title's first letter."""
    return ("""  <div style="flex: none; height: 44px; padding: 0 20px; display: flex; align-items: center;">
    <a href="%s" aria-label="%s" style="flex: none; width: 44px; height: 44px; margin-left: -12px; display: flex; align-items: center; justify-content: center; text-decoration: none;">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="15 4.5 7.5 12 15 19.5"/></svg>
    </a>
    <span style="flex-grow: 1;"></span>
%s  </div>
""" % (href, label, right))


def title(text, sub=None, top=4):
    out = '  <div style="flex: none; padding: %dpx 20px 0;">\n' % top
    out += '    <h1 style="margin: 0; font-size: 34px; font-weight: 700; letter-spacing: -0.02em;">%s</h1>\n' % text
    if sub:
        out += ('    <span style="display: block; margin-top: 6px; font-size: 15px; line-height: 1.42; color: %s;">%s</span>\n'
                % (GREY, sub))
    out += '  </div>\n'
    return out


def section(text, top=26):
    return ('  <div style="flex: none; margin: %dpx 20px 0;"><span style="font-size: 20px; font-weight: 700; '
            'letter-spacing: 0.01em;">%s</span></div>\n' % (top, text))


def eyebrow(text, colour=None, top=26):
    return ('  <div style="flex: none; margin: %dpx 20px 0;"><span style="font-family: %s; font-size: 11px; '
            'font-weight: 700; letter-spacing: 0.1em; color: %s;">%s</span></div>\n'
            % (top, MONO, colour or GREY, text))


_TABS = [
    ('Main.dc.html', 'Today',
     '<rect x="3" y="4" width="18" height="17" rx="4" fill="%s"/><path d="M8 2.5v3M16 2.5v3" stroke="%s" stroke-width="2" stroke-linecap="round"/>',
     '<rect x="3" y="4" width="18" height="17" rx="4"/><path d="M8 2.5v3M16 2.5v3M3 9.5h18"/>'),
    ('Coach.dc.html', 'Ren', None, None),
    ('Stats.dc.html', 'Stats',
     '<path d="M3 3v18h18" stroke="%s" stroke-width="2.4" fill="none" stroke-linecap="round"/><path d="M7 15l4-5 4 3 5-7" stroke="%s" stroke-width="2.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>',
     '<path d="M3 3v18h18"/><path d="M7 15l4-5 4 3 5-7"/>'),
    ('Groups.dc.html', 'Groups',
     '<circle cx="9" cy="8" r="3.4" fill="%s"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0" fill="%s"/><path d="M17 8.5a3 3 0 0 1 0 5" stroke="#ff375f" stroke-width="1.9" fill="none" stroke-linecap="round"/><path d="M19.5 20a6.5 6.5 0 0 0-3.2-5.2" stroke="#ff375f" stroke-width="1.9" fill="none" stroke-linecap="round"/>',
     '<circle cx="9" cy="8" r="3.4"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M17 8.5a3 3 0 0 1 0 5"/><path d="M19.5 20a6.5 6.5 0 0 0-3.2-5.2"/>'),
    ('Activities.dc.html', 'You',
     '<circle cx="12" cy="8" r="3.6" fill="%s"/><path d="M4.5 20a7.5 7.5 0 0 1 15 0" fill="%s"/>',
     '<circle cx="12" cy="8" r="3.6"/><path d="M4.5 20a7.5 7.5 0 0 1 15 0"/>'),
]


def _ren_icon(colour, active):
    """Ren's tab icon is Ren himself: a shaded sphere with a face, never a
    generic chat bubble. Lit when active, flat grey when not."""
    if active:
        return ('<defs><radialGradient id="rentab" cx="33%" cy="25%" r="78%">'
                '<stop offset="0%" stop-color="#ffffff"/><stop offset="20%" stop-color="#ffccd8"/>'
                '<stop offset="52%" stop-color="#ff5c7f"/><stop offset="100%" stop-color="#b3153a"/>'
                '</radialGradient></defs>'
                '<circle cx="12" cy="12" r="9.3" fill="url(#rentab)"/>'
                '<ellipse cx="8.5" cy="8" rx="3.4" ry="2.3" transform="rotate(-32 8.5 8)" fill="rgba(255,255,255,0.4)"/>'
                '<ellipse cx="9.1" cy="12.4" rx="1.45" ry="2" fill="#3a0512" opacity="0.9"/>'
                '<ellipse cx="15.2" cy="12.4" rx="1.45" ry="2" fill="#3a0512" opacity="0.9"/>')
    return ('<circle cx="12" cy="12" r="9.3" fill="%s"/>'
            '<ellipse cx="8.5" cy="8" rx="3.6" ry="2.5" transform="rotate(-32 8.5 8)" fill="rgba(255,255,255,0.34)"/>'
            '<ellipse cx="9.1" cy="12.4" rx="1.45" ry="2" fill="#000000" opacity="0.82"/>'
            '<ellipse cx="15.2" cy="12.4" rx="1.45" ry="2" fill="#000000" opacity="0.82"/>' % colour)


def tabbar(active=None):
    """iOS reserves 83pt here: 49 of content over the home-indicator area, which
    these artboards do not draw. The active tab is FILLED as well as tinted, so
    the state is never carried by colour alone."""
    out = ('  <div class="tabbar" style="flex: none; display: flex; background: rgba(18,18,20,0.96); '
           'border-top: 0.5px solid #2c2c2e; padding: 0 6px 8px;">\n')
    for href, label, filled, stroked in _TABS:
        on = (href == active)
        colour = PINK if on else GREY
        cur = ' aria-current="page"' if on else ''
        if label == 'Ren':
            svg = ('<svg width="25" height="25" viewBox="0 0 24 24" aria-hidden="true">%s</svg>'
                   % _ren_icon(colour, on))
        elif on:
            svg = '<svg width="25" height="25" viewBox="0 0 24 24" aria-hidden="true">%s</svg>' % (filled % (colour, colour))
        else:
            svg = ('<svg width="25" height="25" viewBox="0 0 24 24" fill="none" stroke="%s" stroke-width="1.9" '
                   'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">%s</svg>' % (colour, stroked))
        out += ('    <a href="%s"%s style="flex-grow: 1; height: 49px; text-decoration: none; display: flex; '
                'flex-direction: column; align-items: center; justify-content: center; gap: 2px;">\n      %s\n'
                '      <span style="font-size: 10px; font-weight: 500; color: %s;">%s</span>\n    </a>\n'
                % (href, cur, svg, colour, label))
    return out + '  </div>\n'


def grow():
    return '  <div style="flex-grow: 1;"></div>\n'


def logic(h, body='  renderVals() { return {}; }', props=''):
    extra = (', ' + props) if props else ''
    return ("""
</div>
</x-dc>

<script type="text/x-dc" data-dc-script data-props='{"$preview":{"width":390,"height":%d}%s}'>
class Component extends DCLogic {
%s
}
</script>
</body>
</html>
""" % (h, extra, body))


def write(name, parts):
    path = os.path.join(OUT, name)
    io.open(path, 'w', encoding='utf-8', newline='').write(''.join(parts))
    print('  %-22s %6d bytes' % (name, os.path.getsize(path)))
