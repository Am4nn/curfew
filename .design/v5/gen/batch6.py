# -*- coding: utf-8 -*-
"""Two splash screens, to be chosen between.

A. The mark, the word, and a line under it.
B. The mark and one statement. No word, no footer, no furniture.
"""
from chrome import *

# The mark, its halo, and nothing else, shared by both so the only difference
# between them is the thing being decided.
def hero(px, pfx, top):
    halo = int(px * 1.2)
    return ("""    <div style="position: relative; width: %dpx; height: %dpx; margin-top: %dpx; display: flex; align-items: center; justify-content: center;">
      <div class="sp-halo" style="position: absolute; width: %dpx; height: %dpx; border-radius: 999px; background: radial-gradient(circle, rgba(255,55,95,0.3) 0%%, rgba(255,55,95,0.09) 42%%, rgba(255,55,95,0) 70%%);"></div>
      <div style="position: relative;">%s</div>
    </div>
""" % (px, px, top, halo, halo, lava_mark(px, pfx)))


# ------------------------------------------------- A. with the word --------
H = 844
a = [HEAD_EMBER, root(H, '', stage=False)]
a.append("""
  <!--
    A splash is the only screen with nothing to do on it, so the mark gets the
    room it never gets anywhere else. The glow behind is NOT a bloom effect: it
    is the field's own light spilling past the apertures, which is the one
    reading under which a glow is honest in this app.
  -->
  <div style="flex-grow: 1;"></div>
  <div style="flex: none; display: flex; flex-direction: column; align-items: center; padding: 0 30px;">
""")
a.append(hero(176, 'lvspa', 0))
a.append("""
    <!--
      THE WORD IS A LOGOTYPE, so it is not in the body face. Archivo at 900,
      tracked in rather than out, because the mark it sits under is three solid
      blocks with a 2-unit gutter and the word has to have the same density.

      It arrives a letter at a time on a 52ms step, each one dropping the last
      6px. A word that fades in is a word fading in. A word that lands is a
      name.
    -->
    <div style="margin-top: 38px; display: flex;">
      <sc-for list="{{letters}}" as="l" hint-placeholder-count="6">
        <span class="sp-letter" style="animation-delay: {{l.delay}}; font-family: %s; font-size: 42px; font-weight: 900; letter-spacing: -0.03em; line-height: 1; color: #ffffff;">{{l.ch}}</span>
      </sc-for>
    </div>

    <p class="sp-line" style="margin: 18px 0 0; font-size: 15.5px; line-height: 1.45; color: %s; text-align: center;">Nothing counts until you say so.</p>
  </div>
  <div style="flex-grow: 1.25;"></div>
""" % (DISPLAY, GREY))
a.append(logic(H, """  renderVals() {
    return {
      letters: 'CURFEW'.split('').map((ch, i) => ({ ch, delay: `${660 + i * 52}ms` })),
    };
  }"""))
write('Splash.dc.html', a)


# ------------------------------------------- B. the mark and a sentence ----
H = 844
b = [HEAD_EMBER, root(H, '', stage=False)]
b.append("""
  <!--
    No word, no footer, no version string. The mark is already the name for
    anybody who has the app installed, and a splash is shown to nobody else.

    So the only thing left to say is what the app is FOR, and it gets said at
    the size of a statement rather than a caption. Two lines, because the
    second one is the instruction and it earns its own line.
  -->
  <div style="flex-grow: 1;"></div>
  <div style="flex: none; display: flex; flex-direction: column; align-items: center; padding: 0 34px;">
""")
b.append(hero(152, 'lvspb', 0))
b.append("""
    <div style="margin-top: 44px; display: flex; flex-direction: column; align-items: center; gap: 2px;">
      <span class="sp-l1" style="font-size: 33px; font-weight: 600; letter-spacing: -0.03em; line-height: 1.16; color: #ffffff;">Windows close.</span>
      <span class="sp-l2" style="font-size: 33px; font-weight: 600; letter-spacing: -0.03em; line-height: 1.16; color: %s;">Be there.</span>
    </div>
  </div>
  <div style="flex-grow: 1.3;"></div>
""" % PINK)
b.append(logic(H))
write('Splash2.dc.html', b)
