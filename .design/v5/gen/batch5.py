# -*- coding: utf-8 -*-
"""The sign-in page, rebuilt around the mark, and a sheet for the mark itself.

The mark is `src/app/mark.tsx`: three 13-unit squares on a 32 grid, 2 of margin,
2 of gutter, zero radius, crispEdges, and the fourth seat empty. None of that is
a parameter here either.
"""
from chrome import *

AMBER = '#ff9f0a'

# --------------------------------------------------------------- Sign in ---
# A stranger opens this page, so the photographs on it are the generated ones.
# That is the same rule that put them on the landing page.
H = 844
si = [HEAD_EMBER, root(H)]

STRIP = [(SLEEP, 'SLEEP', '10:22 PM'), (GYM, 'GYM', '6:12 PM'), (FOOD, 'FOOD', '7:04 PM')]
band = ['  <div style="flex: none; height: 320px; position: relative; overflow: hidden;">\n'
        '    <div style="position: absolute; inset: 0; display: flex; gap: 1px;">\n']
for src, what, when in STRIP:
    band.append(
        '      <span style="flex-grow: 1; flex-basis: 0; position: relative; overflow: hidden; background: #111;">\n'
        '        <img src="' + src + '" alt="" style="position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover;">\n'
        '        <span style="position: absolute; left: 0; right: 0; bottom: 92px; display: flex; flex-direction: column; gap: 2px; padding: 0 10px;">\n'
        '          <span style="font-family: ' + MONO + '; font-size: 10px; font-weight: 700; letter-spacing: 0.14em; color: #ffffff;">' + what + '</span>\n'
        '          <span style="font-family: ' + MONO + '; font-size: 10px; font-weight: 500; letter-spacing: 0.06em; color: rgba(255,255,255,0.62);">' + when + '</span>\n'
        '        </span>\n'
        '      </span>\n')
si.append(''.join(band))
si.append(
    '    </div>\n'
    '    <div style="position: absolute; left: 0; right: 0; top: 0; height: 152px; background: linear-gradient(to bottom, rgba(0,0,0,0.82) 0%, rgba(0,0,0,0.34) 58%, rgba(0,0,0,0));"></div>\n'
    '    <div style="position: absolute; left: 0; right: 0; bottom: 0; height: 196px; background: linear-gradient(to bottom, rgba(0,0,0,0) 0%, rgba(0,0,0,0.70) 44%, #000000 100%);"></div>\n'
    '    <div style="position: absolute; left: 22px; top: 28px;">' + lava_wordmark(30, 64, 16, pfx='lvsi') + '</div>\n'
    '  </div>\n')

si.append(
    '  <div style="flex: none; margin-top: -26px; padding: 0 22px;">\n'
    '    <h1 style="margin: 0; font-size: 36px; font-weight: 700; line-height: 1.1; letter-spacing: -0.03em;">Say what you did.<br>Show it if it matters.</h1>\n'
    '    <p style="margin: 13px 0 0; font-size: 15.5px; line-height: 1.45; color: ' + GREY + ';">A tracker with your friends watching. You pick the windows. Miss one and it costs you.</p>\n'
    '  </div>\n')

HOW = [('01', 'You set the window', 'Nobody imposes a time on you. That is the part other apps get wrong.'),
       ('02', 'A photograph proves it', 'Live camera, never the gallery, and only where you asked for one.'),
       ('03', 'Your friends see it', 'Whatever you chose to share, and the fine when you do not turn up.')]
si.append('  <div style="flex: none; margin: 24px 22px 0; display: flex; flex-direction: column;">\n')
for i, (n, head, body) in enumerate(HOW):
    top = 'transparent' if i == 0 else SEP
    si.append(
        '    <div style="display: flex; gap: 13px; padding: 13px 0; border-top: 0.5px solid ' + top + ';">\n'
        '      <span style="flex: none; margin-top: 2px; font-family: ' + MONO + '; font-size: 11px; font-weight: 700; letter-spacing: 0.06em; color: ' + PINK + ';">' + n + '</span>\n'
        '      <span style="flex-grow: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px;">\n'
        '        <span style="font-size: 15px; font-weight: 600;">' + head + '</span>\n'
        '        <span style="font-size: 12.5px; line-height: 1.42; color: ' + GREY + ';">' + body + '</span>\n'
        '      </span>\n'
        '    </div>\n')
si.append('  </div>\n')

si.append(grow())
si.append(
    '  <div style="flex: none; padding: 0 22px 32px; display: flex; flex-direction: column; gap: 13px;">\n'
    '    <button type="button" style="width: 100%; height: 54px; border: 0; border-radius: 15px; background: #ffffff; color: #000000; font-family: inherit; font-size: 17px; font-weight: 600; display: flex; align-items: center; justify-content: center; gap: 10px;">\n'
    '      <svg width="19" height="19" viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285f4" d="M21.6 12.2c0-.7-.06-1.4-.18-2.06H12v3.9h5.4a4.6 4.6 0 0 1-2 3.02v2.5h3.23c1.89-1.74 2.97-4.3 2.97-7.36z"/><path fill="#34a853" d="M12 22c2.7 0 4.96-.9 6.62-2.44l-3.23-2.5c-.9.6-2.05.95-3.39.95-2.6 0-4.8-1.76-5.6-4.12H3.08v2.59A10 10 0 0 0 12 22z"/><path fill="#fbbc05" d="M6.4 13.89a6 6 0 0 1 0-3.78V7.52H3.08a10 10 0 0 0 0 8.96z"/><path fill="#ea4335" d="M12 5.98c1.47 0 2.79.5 3.83 1.5l2.86-2.86C16.95 2.99 14.7 2 12 2a10 10 0 0 0-8.92 5.52L6.4 10.1C7.2 7.74 9.4 5.98 12 5.98z"/></svg>\n'
    '      Continue with Google\n'
    '    </button>\n'
    '    <div style="display: flex; align-items: center; gap: 9px; justify-content: center;">\n'
    '      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="' + DIM + '" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>\n'
    '      <span style="font-size: 13px; color: ' + DIM + ';">Invite only. There is no sign-up on this page.</span>\n'
    '    </div>\n'
    '  </div>\n')
si.append(logic(H))
write('Signin.dc.html', si)


# ------------------------------------------------------------- The mark ---
# A reference sheet, so it runs long on purpose. Over-tall beats clipped.
H = 3320
mk = [HEAD_EMBER, root(H)]
mk.append(nav('Signin.dc.html', 'Back to sign in'))
mk.append(title('The mark', 'Three squares on a four-square grid. The fourth seat is the identity, so nothing ever fills it.'))


def tile(inner, label, note=None, bg='#0d0d0f', h=104, border='transparent'):
    out = ('      <div style="flex-grow: 1; flex-basis: 0; display: flex; flex-direction: column; gap: 8px;">\n'
           '        <div style="height: ' + str(h) + 'px; border-radius: 12px; background: ' + bg + '; border: 1px solid ' + border + '; display: flex; align-items: center; justify-content: center;">' + inner + '</div>\n'
           '        <div style="display: flex; flex-direction: column; gap: 2px;">\n'
           '          <span style="font-family: ' + MONO + '; font-size: 9.5px; font-weight: 700; letter-spacing: 0.1em; color: #ffffff;">' + label + '</span>\n')
    if note:
        out += '          <span style="font-size: 11px; line-height: 1.35; color: ' + GREY + ';">' + note + '</span>\n'
    return out + '        </div>\n      </div>\n'


# The mark at rest, large, with room around it.
mk.append('  <div style="flex: none; margin: 22px 20px 0; height: 196px; border-radius: 18px; background: #0d0d0f; display: flex; align-items: center; justify-content: center;">'
          + mark(112) + '</div>\n')

# Construction, drawn rather than described.
mk.append(section('How it is built', top=28))
mk.append('  <div style="flex: none; margin: 14px 20px 0; border-radius: 16px; background: #0d0d0f; padding: 22px; display: flex; flex-direction: column; align-items: center; gap: 16px;">\n')
mk.append('''    <svg viewBox="0 0 32 32" width="256" height="256" shape-rendering="crispEdges" aria-hidden="true" style="display: block;">
      <rect x="0" y="0" width="32" height="32" fill="none" stroke="rgba(255,255,255,0.14)" stroke-width="0.25"/>
      <path d="M2 0v32M15 0v32M17 0v32M30 0v32M0 2h32M0 15h32M0 17h32M0 30h32" stroke="rgba(255,255,255,0.14)" stroke-width="0.25" fill="none"/>
      <rect x="2" y="2" width="13" height="13" fill="#ffffff"/>
      <rect x="17" y="2" width="13" height="13" fill="#ffffff"/>
      <rect x="2" y="17" width="13" height="13" fill="#ffffff"/>
      <rect x="17" y="17" width="13" height="13" fill="none" stroke="rgba(255,55,95,0.55)" stroke-width="0.4" stroke-dasharray="1.6 1.4"/>
    </svg>
''')
mk.append('    <div style="display: flex; flex-wrap: wrap; gap: 6px; justify-content: center;">\n')
for spec in ('32 GRID', '2 MARGIN', '13 SQUARE', '2 GUTTER', '0 RADIUS', 'CRISP EDGES'):
    mk.append('      <span style="padding: 5px 9px; border-radius: 7px; background: ' + CARD2 + '; font-family: ' + MONO
              + '; font-size: 9.5px; font-weight: 600; letter-spacing: 0.08em; color: ' + GREY + ';">' + spec + '</span>\n')
mk.append('    </div>\n  </div>\n')
mk.append('  <p style="flex: none; margin: 12px 20px 0; font-size: 12.5px; line-height: 1.48; color: ' + GREY
          + ';">The dashed seat is not a placeholder. It is the shape, and the mark is wrong without it.</p>\n')

# Sizes.
mk.append(section('At every size', top=28))
mk.append('  <div style="flex: none; margin: 14px 20px 0; border-radius: 16px; background: #0d0d0f; padding: 22px 18px 16px; display: flex; align-items: flex-end; justify-content: space-between;">\n')
for size in (16, 20, 24, 32, 48, 64):
    mk.append('    <div style="display: flex; flex-direction: column; align-items: center; gap: 10px;">' + mark(size)
              + '<span style="font-family: ' + MONO + '; font-size: 9.5px; font-weight: 600; color: ' + DIM + ';">' + str(size) + '</span></div>\n')
mk.append('  </div>\n')
mk.append('  <p style="flex: none; margin: 12px 20px 0; font-size: 12.5px; line-height: 1.48; color: ' + GREY
          + ';">16 is the floor. Below it the 2-unit gutter closes up and the three squares read as one block.</p>\n')

# The word itself. Three settings, one live, so the choice can be pointed at
# rather than described.
mk.append(section('The word', top=28))
mk.append('  <p style="flex: none; margin: 8px 20px 0; font-size: 12.5px; line-height: 1.48; color: ' + GREY
          + ';">The mark is three solid blocks, so it carries the mass. A heavy word beside it is two heavy things competing. The word carries the name and nothing else.</p>\n')
WORDS = [
    ("'Space Grotesk', sans-serif", '500', '0.02em', 'SPACE GROTESK 500', 'Live. Characterful letterforms at a medium weight, so it is not plain and not heavy.', True),
    ("'Archivo', sans-serif", '600', '0em', 'ARCHIVO 600', 'Neutral and sturdy. Safer, and it says less.', False),
    ("'IBM Plex Mono', monospace", '500', '0.24em', 'PLEX MONO 500, TRACKED OUT', 'The body face, made deliberate. Wide and thin against a dense mark.', False),
]
for fam, wt, tr, label, note, live in WORDS:
    mk.append('  <div style="flex: none; margin: 14px 20px 0; border-radius: 14px; background: #0d0d0f; border: 1px solid '
              + ('rgba(255,55,95,0.4)' if live else 'transparent')
              + '; padding: 18px 16px 15px; display: flex; flex-direction: column; gap: 12px;">\n'
              '    <div style="display: flex; align-items: center; gap: 12px;">' + mark(30)
              + '<span style="font-family: ' + fam + '; font-size: 30px; font-weight: ' + wt
              + '; letter-spacing: ' + tr + '; color: #ffffff;">CURFEW</span></div>\n'
              '    <div style="display: flex; align-items: baseline; gap: 8px;">\n'
              '      <span style="font-family: ' + MONO + '; font-size: 9.5px; font-weight: 700; letter-spacing: 0.1em; color: '
              + (PINK if live else GREY) + ';">' + label + '</span>\n'
              '      <span style="flex-grow: 1; font-size: 11.5px; line-height: 1.4; color: ' + GREY + ';">' + note + '</span>\n'
              '    </div>\n'
              '  </div>\n')

# The lava. This one ships, unlike the six states below it, so it comes
# first, and its scope is stated rather than implied.
mk.append(section('With something moving in it', top=28))
mk.append('  <div style="flex: none; margin: 14px 20px 0; border-radius: 16px; background: #0d0d0f; padding: 24px 20px 20px; display: flex; flex-direction: column; align-items: center; gap: 22px;">\n'
          '    <div>' + lava_mark(96, 'lvA') + '</div>\n'
          '    <div style="width: 100%; display: flex; gap: 16px; align-items: flex-end; justify-content: center;">\n'
          '      <div style="display: flex; flex-direction: column; align-items: center; gap: 9px;">' + lava_mark(64, 'lvB') + '<span style="font-family: ' + MONO + '; font-size: 9.5px; font-weight: 700; letter-spacing: 0.1em; color: ' + GREY + ';">SIGN IN</span></div>\n'
          '      <div style="display: flex; flex-direction: column; align-items: center; gap: 9px;">' + lava_mark(32, 'lvC') + '<span style="font-family: ' + MONO + '; font-size: 9.5px; font-weight: 700; letter-spacing: 0.1em; color: ' + GREY + ';">SPLASH</span></div>\n'
          '    </div>\n'
          '  </div>\n')
mk.append('  <p style="flex: none; margin: 14px 20px 0; font-size: 12.5px; line-height: 1.48; color: ' + GREY + ';">It fills once, on arrival, and stops a sliver short of the top: a solid block is not a window onto anything. What keeps moving after that is the surface and the churn beneath it, because a logo that empties and refills is a loading spinner.</p>\n')
mk.append('  <p style="flex: none; margin: 12px 20px 0; font-size: 12.5px; line-height: 1.48; color: ' + GREY + ';"><b style="color:#ffffff;font-weight:600;">Two places only: sign in and the splash.</b> Everywhere inside the app the mark is flat and white. This is the moment somebody first meets Curfew, and a brand gets one of those.</p>\n')

# The exploration the answer asked for, labelled as exploration.
mk.append(section('If it carried your streak', top=28))
mk.append('  <div style="flex: none; margin: 10px 20px 0; border-radius: 12px; background: rgba(255,159,10,0.1); border: 1px solid rgba(255,159,10,0.32); padding: 12px 14px; display: flex; gap: 11px;">\n'
          '    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="' + AMBER + '" stroke-width="2.2" stroke-linecap="round" aria-hidden="true" style="flex: none; margin-top: 1px;"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 7.5v.01"/></svg>\n'
          '    <span style="flex-grow: 1; font-size: 12.5px; line-height: 1.45; color: #e5c88a;">Exploration. <b style="color:#ffffff;font-weight:600;">The shipped mark is white, everywhere, always.</b> None of the six below is built, and a logo that is never the same twice has stopped being a logo.</span>\n'
          '  </div>\n')

STATES = [
    (mark(52), 'AT REST', 'White. What ships.', '#0d0d0f', 'transparent'),
    (mark(52, PINK), 'ALIVE', 'A run that is still running.', '#0d0d0f', 'transparent'),
    (mark(52, AMBER), 'UNREACHABLE', 'Still standing, and it cannot be saved.', '#0d0d0f', 'transparent'),
    (mark(52, hollow=True, fill='#5a5a5e'), 'BROKEN', 'Hollow. The shape holds, the fill does not.', '#0d0d0f', 'transparent'),
    (mark(52, tint=('#7a0d26', '#d81e46', '#ff5c7f')), 'LONG RUN', 'Three depths reading as momentum.', '#0d0d0f', 'transparent'),
    (mark(52, GOLD, glow=True), 'IMMACULATE', 'The only glow in the app, kept for the only rank that earns it.', '#0d0d0f', 'rgba(255,210,63,0.3)'),
]
for i in range(0, 6, 2):
    mk.append('  <div style="flex: none; margin: 14px 20px 0; display: flex; gap: 12px; align-items: flex-start;">\n')
    for inner, label, note, bg, border in STATES[i:i + 2]:
        mk.append(tile(inner, label, note, bg=bg, border=border, h=104))
    mk.append('  </div>\n')

# Where it sits.
mk.append(section('On a surface', top=28))
mk.append('  <div style="flex: none; margin: 14px 20px 0; display: flex; gap: 12px; align-items: flex-start;">\n')
mk.append(tile('<span style="width: 74px; height: 74px; border-radius: 17px; background: #0a0a0a; border: 1px solid rgba(255,255,255,0.07); display: flex; align-items: center; justify-content: center;">'
               + mark(40) + '</span>', 'APP ICON', 'The tile has the radius. The mark never does.', bg='#151517', h=104))
mk.append(tile('<span style="width: 58px; height: 100px; border-radius: 9px; background: #000000; border: 1px solid rgba(255,255,255,0.09); display: flex; align-items: center; justify-content: center;">'
               + lava_mark(32, 'lvD') + '</span>', 'SPLASH', 'Centred on true black, nothing else on it.', bg='#151517', h=104))
mk.append(tile(wordmark(17, mark_size=22, gap=9), 'LOCKUP', 'Archivo 900, tracked in, never out. Never stacked.', bg='#0d0d0f', h=104))
mk.append('  </div>\n')

# The don'ts, drawn wrong on purpose.
mk.append(section('Never', top=28))
mk.append('  <div style="flex: none; margin: 14px 20px 0; display: flex; gap: 12px; align-items: flex-start;">\n')
mk.append(tile(mark(48, radius=4), 'ROUNDED', 'Zero radius is the house style and this is the house mark.',
               bg='rgba(255,69,58,0.08)', border='rgba(255,69,58,0.3)', h=92))
mk.append(tile('<span style="width: 48px; height: 48px; background: linear-gradient(135deg, #8b5cf6, #ec4899); -webkit-mask-image: none; display: flex; align-items: center; justify-content: center; border-radius: 4px;">'
               + mark(30, '#ffffff') + '</span>', 'GRADIENT', 'A purple wash is the default AI interface, arriving uninvited.',
               bg='rgba(255,69,58,0.08)', border='rgba(255,69,58,0.3)', h=92))
mk.append('  </div>\n')
mk.append('  <div style="flex: none; margin: 12px 20px 0; display: flex; gap: 12px; align-items: flex-start;">\n')
mk.append(tile('<svg viewBox="0 0 32 32" width="48" height="48" shape-rendering="crispEdges" aria-hidden="true" style="display: block;">'
               '<rect x="2" y="2" width="13" height="13" fill="#ffffff"/><rect x="17" y="2" width="13" height="13" fill="#ffffff"/>'
               '<rect x="2" y="17" width="13" height="13" fill="#ffffff"/><rect x="17" y="17" width="13" height="13" fill="#ffffff"/></svg>',
               'FOURTH SEAT', 'Four squares is a different logo for a different company.',
               bg='rgba(255,69,58,0.08)', border='rgba(255,69,58,0.3)', h=92))
mk.append(tile(mark(48, tint=('#30d158', '#0a84ff', '#ff9f0a')), 'ONE HUE PER SQUARE',
               'Three colours means three things, and it means none.',
               bg='rgba(255,69,58,0.08)', border='rgba(255,69,58,0.3)', h=92))
mk.append('  </div>\n')

mk.append('  <p style="flex: none; margin: 20px 20px 0; font-size: 12.5px; line-height: 1.48; color: ' + GREY
          + ';">The mark is <span style="font-family: ' + MONO + '; color: #ffffff;">src/app/mark.tsx</span>, and it fills with the theme foreground token rather than a hex, so it follows light and dark without a second asset.</p>\n')
mk.append(grow())
mk.append(logic(H))
write('Mark.dc.html', mk)
