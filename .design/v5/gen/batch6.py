# -*- coding: utf-8 -*-
"""The splash screen: the mark, alive, and one line."""
from chrome import *

# Two seconds, maybe three. Everything on it has to arrive and be read inside
# that, which is why there is one sentence and not two.
H = 844
sp = [HEAD_EMBER, root(H, ' position: relative;', stage=False)]

sp.append("""
  <!--
    A splash is the only screen with nothing to do on it, so it is the one place
    the mark gets the room it never gets anywhere else. 192px, centred, and the
    field inside it blooming as the app comes up.

    The glow behind is NOT a bloom effect. It is the field's own light spilling
    past the apertures, which is the one reading under which a glow is honest
    here: something is lit inside the squares, so it lights what is around them.
  -->
  <div style="position: absolute; left: 50%; top: 50%; width: 320px; margin-left: -160px; margin-top: -170px; display: flex; flex-direction: column; align-items: center;">
    <div style="position: relative; width: 192px; height: 192px; display: flex; align-items: center; justify-content: center;">
      <div class="sp-halo" style="position: absolute; width: 230px; height: 230px; border-radius: 999px; background: radial-gradient(circle, rgba(255,55,95,0.3) 0%, rgba(255,55,95,0.09) 42%, rgba(255,55,95,0) 70%);"></div>
      <div style="position: relative;">""" + lava_mark(192, 'lvsp') + """</div>
    </div>

    <!--
      THE WORD ARRIVES A LETTER AT A TIME, left to right, on a 52ms step. Not a
      fade: a fade of a whole word is a fade, and this is a name being set down.
      The tracking closes as it lands, from 0.5em to 0.07em, so the word gathers
      itself rather than appearing at its final width.
    -->
    <div class="sp-word" style="margin-top: 34px; display: flex;">
      <sc-for list="{{letters}}" as="l" hint-placeholder-count="6">
        <span class="sp-letter" style="animation-delay: {{l.delay}}; font-family: %s; font-size: 30px; font-weight: 600; letter-spacing: 0.07em; color: #ffffff;">{{l.ch}}</span>
      </sc-for>
    </div>

    <p class="sp-line" style="margin: 16px 0 0; font-size: 15px; line-height: 1.45; color: %s; text-align: center; max-width: 250px;">The day is still open.</p>
  </div>

  <!--
    No spinner. The app either comes up in under a second or something is wrong,
    and a spinner on a splash is an apology printed in advance.
  -->
  <div class="sp-foot" style="position: absolute; left: 0; right: 0; bottom: 38px; display: flex; flex-direction: column; align-items: center; gap: 7px;">
    <span style="font-family: %s; font-size: 10px; font-weight: 600; letter-spacing: 0.16em; color: %s;">INVITE ONLY</span>
  </div>
""" % (MONO, GREY, MONO, DIM))

sp.append(logic(H, """  renderVals() {
    // 52ms a letter, and the line waits until the last one has landed.
    return {
      letters: 'CURFEW'.split('').map((ch, i) => ({ ch, delay: `${620 + i * 52}ms` })),
    };
  }"""))
write('Splash.dc.html', sp)
