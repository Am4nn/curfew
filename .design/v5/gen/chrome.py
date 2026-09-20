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
# The logotype face, and ONLY the logotype. A mono gives every character the
# same width, which beside three solid blocks reads airy where the mark reads
# dense. Archivo at 900 has the mark's density.
DISPLAY = "'Archivo', 'IBM Plex Mono', ui-monospace, monospace"
# Archivo has a WIDTH axis and the default width is a text width. The mark is
# three wide blocks, so the word is set expanded: 125 at weight 900, tracked
# in. Flat 900 at the default width was the thing that read plain.
LOGOTYPE = "font-weight: 900; font-stretch: 125%; letter-spacing: -0.015em;"
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


EMBER_CSS = """    /*
      THE MARK WITH SOMETHING MOVING IN IT.

      The three squares are apertures cut into black, and behind all of them is
      ONE field, never three. Bodies of molten material drift, swell, merge and
      part; a goo filter (blur, then an alpha ramp) is what makes two of them
      become one thing and then two things again, which is the whole effect.

      NOTHING HERE IS SYNCHRONISED. Five bodies on periods of 13, 17.4, 21.2, 26
      and 30.6 seconds, sharing no common multiple, so the composition does not
      come back around inside any time somebody will sit and watch. Each path is
      asymmetric too, with its keyframes off the halves. That is the difference
      between motion and a metronome, and the earlier version was a metronome
      with a wave painted on it.

      The field BLOOMS on arrival rather than filling like a tank: it comes up
      from 0.55 over 2.2 seconds, decelerating, and then it just lives.

      Sizes are multiples of 32 wherever this is used, so a grid unit lands on a
      whole pixel and the apertures stay as crisp as the flat mark.
    */
    @keyframes emBloom {
      from { opacity: 0; transform: scale(0.55); }
      to   { opacity: 1; transform: scale(1); }
    }
    @keyframes em1 {
      0%   { transform: translate(0, 0)        scale(1); }
      31%  { transform: translate(5.5px, -4px) scale(1.22); }
      57%  { transform: translate(-3px, -8px)  scale(0.86); }
      78%  { transform: translate(-6px, 2px)   scale(1.08); }
      100% { transform: translate(0, 0)        scale(1); }
    }
    @keyframes em2 {
      0%   { transform: translate(0, 0)          scale(1); }
      26%  { transform: translate(-7px, 5px)     scale(0.82); }
      63%  { transform: translate(-2.5px, 10px)  scale(1.3); }
      84%  { transform: translate(4px, 3px)      scale(1.02); }
      100% { transform: translate(0, 0)          scale(1); }
    }
    @keyframes em3 {
      0%   { transform: translate(0, 0)         scale(1); }
      37%  { transform: translate(-9px, -3px)   scale(1.34); }
      68%  { transform: translate(2px, -9.5px)  scale(0.78); }
      100% { transform: translate(0, 0)         scale(1); }
    }
    @keyframes em4 {
      0%   { transform: translate(0, 0)        scale(1); }
      22%  { transform: translate(6px, 7px)    scale(1.16); }
      54%  { transform: translate(11px, -2px)  scale(0.9); }
      81%  { transform: translate(3px, -6px)   scale(1.24); }
      100% { transform: translate(0, 0)        scale(1); }
    }
    @keyframes em5 {
      0%   { transform: translate(0, 0)         scale(1); }
      43%  { transform: translate(-5px, -7px)   scale(1.42); }
      71%  { transform: translate(-10px, 4px)   scale(0.74); }
      100% { transform: translate(0, 0)         scale(1); }
    }
    .em-field { transform-box: view-box; transform-origin: 16px 16px;
                animation: emBloom 2200ms cubic-bezier(0.16, 1, 0.3, 1) both; }
    .em-1, .em-2, .em-3, .em-4, .em-5 { transform-box: view-box; }
    .em-1 { transform-origin:  9px 21px; animation: em1 13000ms ease-in-out infinite; }
    .em-2 { transform-origin: 24px  9px; animation: em2 17400ms ease-in-out infinite; }
    .em-3 { transform-origin: 20px 27px; animation: em3 21200ms ease-in-out infinite; }
    .em-4 { transform-origin:  4px  6px; animation: em4 26000ms ease-in-out infinite; }
    .em-5 { transform-origin: 28px 19px; animation: em5 30600ms ease-in-out infinite; }


    /*
      THE SPLASH. Everything here has to arrive and be read inside two seconds,
      so nothing waits on anything it does not have to.

      The word is set down a letter at a time on a 52ms step, left to right,
      each one dropping the last 6px and settling. A word that fades in is a
      word fading in; a word that lands is a name.
    */
    @keyframes spHalo {
      0%   { opacity: 0; transform: scale(0.72); }
      55%  { opacity: 1; transform: scale(1.04); }
      100% { opacity: 0.82; transform: scale(1); }
    }
    @keyframes spLetter {
      from { opacity: 0; transform: translateY(6px); }
      to   { opacity: 1; transform: none; }
    }
    @keyframes spSoft { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }

    .sp-halo   { animation: spHalo 2600ms cubic-bezier(0.16, 1, 0.3, 1) both; }
    .sp-letter { animation: spLetter 480ms cubic-bezier(0.16, 1, 0.3, 1) both; }
    .sp-line   { animation: spSoft 620ms 1080ms cubic-bezier(0.16, 1, 0.3, 1) both; }
    /* Candidate B has no word to wait for, so its lines come earlier and the
       instruction lands a beat after the observation. */
    .sp-l1     { animation: spSoft 640ms  560ms cubic-bezier(0.16, 1, 0.3, 1) both; }
    .sp-l2     { animation: spSoft 640ms  760ms cubic-bezier(0.16, 1, 0.3, 1) both; }
    .sp-foot   { animation: spSoft 620ms 1400ms cubic-bezier(0.16, 1, 0.3, 1) both; }

    @media (prefers-reduced-motion: reduce) {
      .sp-halo, .sp-letter, .sp-line, .sp-foot, .sp-l1, .sp-l2 { animation: none; }
    }
    @media (prefers-reduced-motion: reduce) {
      .em-field { animation: none; }
      .em-1, .em-2, .em-3, .em-4, .em-5 { animation: none; }
    }
"""

# The two boards that show the mark alive take this head instead. Every
# other board would be carrying rules for an element it does not contain.
_ARCHIVO = ('  <link rel="stylesheet" '
            'href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@100..125,500..900&display=swap">\n')
HEAD_EMBER = (HEAD.replace("  </style>", EMBER_CSS + "  </style>", 1)
              .replace("  <style>", _ARCHIVO + "  <style>", 1))


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


def lava_mark(size, pfx='lv'):
    """The mark as three apertures onto one drifting field of molten material.
    `size` should be a multiple of 32 so every unit lands on a whole pixel.
    `pfx` keeps the filter and gradient ids apart when a board carries more than
    one of these."""
    d = {'s': size, 'p': pfx}
    return ("""<svg viewBox="0 0 32 32" width="{s}" height="{s}" aria-hidden="true" style="flex: none; display: block;">\
<defs>\
<clipPath id="{p}-seats"><rect x="2" y="2" width="13" height="13"/><rect x="17" y="2" width="13" height="13"/><rect x="2" y="17" width="13" height="13"/></clipPath>\
<filter id="{p}-goo" x="-60%" y="-60%" width="220%" height="220%" color-interpolation-filters="sRGB">\
<feGaussianBlur in="SourceGraphic" stdDeviation="2.4" result="soft"/>\
<feColorMatrix in="soft" type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 17 -6.4" result="goo"/>\
<feGaussianBlur in="goo" stdDeviation="0.75"/>\
</filter>\
<radialGradient id="{p}-warm" cx="38%" cy="74%" r="76%">\
<stop offset="0" stop-color="#ff5c7f" stop-opacity="0.34"/><stop offset="1" stop-color="#ff375f" stop-opacity="0"/></radialGradient>\
</defs>\
<g clip-path="url(#{p}-seats)">\
<rect x="0" y="0" width="32" height="32" fill="#160207"/>\
<rect x="0" y="0" width="32" height="32" fill="url(#{p}-warm)"/>\
<g class="em-field" filter="url(#{p}-goo)">\
<circle class="em-4" cx="4"  cy="6"  r="9.6" fill="#7d0c26"/>\
<circle class="em-2" cx="24" cy="9"  r="7.4" fill="#c11a3e"/>\
<circle class="em-1" cx="9"  cy="21" r="8.8" fill="#ff375f"/>\
<circle class="em-3" cx="20" cy="27" r="6.2" fill="#ff6b57"/>\
<circle class="em-5" cx="28" cy="19" r="5.0" fill="#e0234b"/>\
</g>\
</g></svg>""").format(**d)


def lava_wordmark(word_size=20, mark_size=64, gap=14, colour='#ffffff', pfx='lv'):
    return ('<span style="display: flex; align-items: center; gap: {g}px;">{m}'
            '<span style="font-family: {f}; font-size: {w}px; {L} '
            'color: {c};">CURFEW</span></span>').format(
        g=gap, m=lava_mark(mark_size, pfx), f=DISPLAY, w=word_size, L=LOGOTYPE, c=colour)


ADD_ICON = 'M12 5v14M5 12h14'
SAVE_ICON = 'M20 6L9 17l-5-5'
TUNE_ICON = 'M4 7h9M17 7h3M4 17h3M11 17h9M14 4.5v5M8 14.5v5'


def top_action(label, icon=ADD_ICON, href=None, aria=None, indent='    '):
    """The one shape a top-right control takes: the icon, then the word, filled
    with the theme red and fully rounded. A bare glyph in a corner is a control
    people do not read, and every board that had one had a different one."""
    svg = ('<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.5" '
           'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="%s"/></svg>' % icon)
    inner = ('style="flex: none; height: 34px; margin-right: -2px; padding: 0 14px; border-radius: 999px; '
             'border: 0; background: %s; color: #ffffff; font-family: inherit; font-size: 15px; '
             'font-weight: 600; display: flex; align-items: center; gap: 7px; text-decoration: none;"'
             % PINK)
    label_span = '<span>%s</span>' % label
    if href:
        return '%s<a href="%s" %s>%s%s</a>\n' % (indent, href, inner, svg, label_span)
    return '%s<button type="button"%s %s>%s%s</button>\n' % (
        indent, (' aria-label="%s"' % aria) if aria else '', inner, svg, label_span)


def wordmark(size=13, colour=None, gap=10, mark_size=None):
    return ('<span style="display: flex; align-items: center; gap: %dpx;">%s'
            '<span style="font-family: %s; font-size: %dpx; %s '
            'color: %s;">CURFEW</span></span>'
            % (gap, mark(mark_size or (size + 5), colour or '#ffffff'), DISPLAY, size,
               LOGOTYPE, colour or '#ffffff'))


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
    # A checklist, not a person. The tab holds what you track, and a
    # silhouette said 'profile' to everybody who looked at it.
    ('Activities.dc.html', 'Activities',
     '<rect x="9" y="4.9" width="11" height="2.3" fill="%s"/><rect x="9" y="10.85" width="11" height="2.3" fill="%s"/><rect x="9" y="16.8" width="11" height="2.3" fill="#ff375f"/><path d="M3.4 6.1l1.7 1.7L8.1 4.8M3.4 12.05l1.7 1.7L8.1 10.75M3.4 18l1.7 1.7L8.1 16.7" stroke="#ff375f" stroke-width="2.1" fill="none" stroke-linecap="round" stroke-linejoin="round"/>',
     '<path d="M9 6h11M9 12h11M9 18h11"/><path d="M3.4 6.1l1.7 1.7L8.1 4.8M3.4 12.05l1.7 1.7L8.1 10.75M3.4 18l1.7 1.7L8.1 16.7"/>'),
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
