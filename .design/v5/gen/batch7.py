# -*- coding: utf-8 -*-
"""Two boards the decisions of 2026-09-21 created.

CoachDown: 1.23 and 1.26. The nightly job failed, or you are out of questions,
or the month's budget stopped him. Three ways for a coach to be unavailable and
none of them had a screen.

Memory: 1.25. He keeps a rolling summary of you, and you can read it, edit it
and clear it. A model writing a description of somebody who may not read it is
the indefensible version of this feature.
"""
from chrome import *

AMBER = ORANGE


def sphere(px, grey=False):
    """Ren, and QUIET's palette when he has nothing to say."""
    if grey:
        skin = ('radial-gradient(circle at 33% 25%, #ffffff 0%, #525a63 18%, #373d44 44%, '
                '#22262b 72%, #0e1013 100%)')
        ink = '#aab2ba'
    else:
        skin = ('radial-gradient(circle at 33% 25%, #ffffff 0%, #ffccd8 18%, #ff5c7f 44%, '
                '#c11a3e 72%, #380813 100%)')
        ink = '#3a0512'
    return ("""<span style="flex: none; position: relative; display: block; width: %dpx; height: %dpx;">
      <span style="position: absolute; inset: 0; border-radius: 999px; background: %s;"></span>
      <span style="position: absolute; inset: 0; border-radius: 999px; background: radial-gradient(circle at 50%% 50%%, transparent 56%%, rgba(0,0,0,0.30) 84%%, rgba(0,0,0,0.54) 100%%);"></span>
      <span style="position: absolute; inset: 0; border-radius: 999px; background: radial-gradient(circle at 31%% 23%%, rgba(255,255,255,0.9) 0%%, rgba(255,255,255,0.28) 17%%, transparent 34%%);"></span>
      <svg viewBox="0 0 100 100" style="position: absolute; inset: 0; width: 100%%; height: 100%%;" aria-hidden="true">
        <path d="M31 45h13 M56 45h13" stroke="%s" stroke-width="3.6" stroke-linecap="round" fill="none"/>
        <path d="M45 66h10" stroke="%s" stroke-width="3.4" stroke-linecap="round" fill="none"/>
      </svg>
    </span>""" % (px, px, skin, ink, ink))


# -------------------------------------------------- Ren, unavailable -------
H = 900
cd = [HEAD, root(H)]
cd.append(nav('Main.dc.html', 'Back to Today'))
cd.append("""
  <!--
    HE HAS NOTHING, AND HE SAYS SO. 1.23 chose silence over a written fallback
    line, because a fallback would be the same sentence every time it happened
    and a coach who says the same thing whenever he is broken is worse than one
    who says nothing.

    So the face is QUIET's, grey, eyes shut. That mood already means "his hours
    are your quiet hours" and it costs nothing to mean this too.
  -->
  <div style="flex: none; padding: 32px 24px 0; display: flex; flex-direction: column; align-items: center;">
    """ + sphere(104, grey=True) + """
    <h1 style="margin: 24px 0 0; font-size: 26px; font-weight: 700; letter-spacing: -0.02em; text-align: center;">Nothing from last night.</h1>
    <p style="margin: 12px 0 0; font-size: 15.5px; line-height: 1.45; color: %s; text-align: center;">The job that reads your week did not finish.</p>
  </div>
""" % GREY)

# The recompute. It exists ONLY because a failure is on record.
cd.append("""  <div style="flex: none; margin: 24px 16px 0; border-radius: 16px; background: %s; padding: 16px; display: flex; flex-direction: column; gap: 12px;">
    <div style="display: flex; align-items: center; gap: 12px;">
      <span style="flex: none; width: 30px; height: 30px; border-radius: 9px; background: rgba(255,159,10,0.14); display: flex; align-items: center; justify-content: center;">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="%s" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3.5 21.2 19.5H2.8zM12 10v4.2M12 16.8v.01"/></svg>
      </span>
      <span style="flex-grow: 1; font-family: %s; font-size: 10.5px; font-weight: 700; letter-spacing: 0.13em; color: #ffffff;">FAILED 04:12, RETRIED 3 TIMES</span>
    </div>
    <span style="font-size: 13.5px; line-height: 1.45; color: %s;">The failure was recorded.</span>
    <button type="button" style="width: 100%%; height: 48px; border: 0; border-radius: 14px; background: %s; color: #ffffff; font-family: inherit; font-size: 16px; font-weight: 600; display: flex; align-items: center; justify-content: center; gap: 8px;">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 12a8 8 0 0 1 13.7-5.7L21 9"/><path d="M21 4v5h-5"/></svg>
      Try again
    </button>
  </div>
""" % (CARD, AMBER, MONO, GREY, PINK))

# And the box, off, for one of two reasons that look the same and are not.
cd.append("""  <div style="flex: none; margin: 20px 16px 0; display: flex; flex-direction: column; gap: 8px;">
    <div style="display: flex; align-items: center; gap: 8px; padding: 12px 16px; border-radius: 16px; background: %s; opacity: 0.55;">
      <span style="flex-grow: 1; font-size: 15.5px; color: %s;">Ask Ren</span>
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="%s" stroke-width="2" stroke-linecap="round" aria-hidden="true" style="flex: none;"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>
    </div>
    <span style="font-size: 12.5px; line-height: 1.45; color: %s; padding: 0 2px;">{{askNote}}</span>
  </div>
""" % (CARD, DIM, DIM, GREY))

cd.append("""  <p style="flex: none; margin: 20px 16px 0; font-size: 12px; line-height: 1.45; color: %s;">Every other number is arithmetic over your check-ins.</p>
""" % DIM)
cd.append(grow())
cd.append(tabbar('Coach.dc.html'))
cd.append(logic(H, """  renderVals() {
    // The cap and the budget stop are the same component with different words,
    // and the difference matters: one is yours and resets tonight, the other is
    // the month's and resets on the 1st.
    const budget = this.props.budget ?? false;
    return {
      askNote: budget
        ? 'Ask Ren is off until 1 October. The month\\u2019s budget for questions is spent. His nightly lines carry on as usual, because those cost a known three a day.'
        : '12 of 12 questions today. More tomorrow morning.',
    };
  }""", '"budget":{"editor":"boolean","default":false}'))
write('CoachDown.dc.html', cd)


# ------------------------------------------- What Ren remembers, 1.25 ------
H = 1080
mm = [HEAD, root(H)]
mm.append(nav('Settings.dc.html', 'Back to you'))
mm.append(title('What Ren remembers',
                'One paragraph, rewritten every night.'))

mm.append("""  <div style="flex: none; margin: 20px 16px 0; border-radius: 16px; background: %s; padding: 16px 16px; display: flex; flex-direction: column; gap: 12px;">
    <div style="display: flex; align-items: center; gap: 8px;">
      <span style="font-family: %s; font-size: 10px; font-weight: 700; letter-spacing: 0.14em; color: %s;">REWRITTEN LAST NIGHT, 04:07</span>
    </div>
    <!--
      Plain text in a real editable field, not a quote block. It has to be
      obvious that this is a thing you can change, because being able to change
      it is the whole answer to "a model wrote a paragraph about me".
    -->
    <p style="margin: 0; font-size: 14.5px; line-height: 1.6; color: #ffffff;">Aman is steady on Water, Sleep and Food and has been for months. Gym is the one that goes, and it goes on Tuesdays, which he has said is because the day runs long rather than because of the gym. He asked once whether the streak or the standing mattered more and preferred the answer that it was the standing. He does not want to be told he is nearly there.</p>
  </div>
""" % (CARD, MONO, GREY))

mm.append("""  <div style="flex: none; margin: 12px 16px 0; display: flex; gap: 12px;">
    <button type="button" style="flex-grow: 1; height: 46px; border: 1px solid #3a3a3c; border-radius: 13px; background: transparent; color: #ffffff; font-family: inherit; font-size: 15px; font-weight: 500; display: flex; align-items: center; justify-content: center; gap: 8px;">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20h4L19 9a2.1 2.1 0 0 0-3-3L5 17z"/></svg>
      Edit it
    </button>
    <button type="button" style="flex-grow: 1; height: 46px; border: 1px solid rgba(255,69,58,0.4); border-radius: 13px; background: transparent; color: %s; font-family: inherit; font-size: 15px; font-weight: 500; display: flex; align-items: center; justify-content: center; gap: 8px;">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="%s" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7h16M9 7V5h6v2M6.5 7l1 13h9l1-13"/></svg>
      Clear it
    </button>
  </div>
""" % (RED, RED))

NOTES = [
    (GREY, 'M4 6h16M4 12h16M4 18h10',
     'It is a summary, not a transcript',
     'Nothing is kept word for word.'),
    (AMBER, 'M4 20h4L19 9a2.1 2.1 0 0 0-3-3L5 17z',
     'Editing it has a cost, and here it is',
     'Edit a line and he treats it as his own.'),
    (RED, 'M4 7h16M9 7V5h6v2M6.5 7l1 13h9l1-13',
     'Clearing it does not stop him',
     'He starts again tonight from your record, which he can always read. To stop him reading anything, turn him off.'),
    (GREEN, 'M12 3.2 19.5 6v6c0 4.2-3 7.2-7.5 8.8C7.5 19.2 4.5 16.2 4.5 12V6Z',
     'It goes when your data goes',
     'Deleting your account deletes this with everything else, and Delete data lists it by name before you confirm.'),
]
mm.append('  <div style="flex: none; margin: 24px 16px 0; border-radius: 16px; background: %s; overflow: hidden;">\n' % CARD)
for i, (colour, path, head, body) in enumerate(NOTES):
    sep = 'transparent' if i == 0 else SEP
    mm.append("""    <div style="display: flex; gap: 12px; padding: 12px 16px; border-top: 0.5px solid %s;">
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="%s" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex: none; margin-top: 2px;"><path d="%s"/></svg>
      <div style="flex-grow: 1; min-width: 0; display: flex; flex-direction: column; gap: 4px;">
        <span style="font-size: 14.5px; font-weight: 600; line-height: 1.35;">%s</span>
        <span style="font-size: 12.5px; line-height: 1.45; color: %s;">%s</span>
      </div>
    </div>
""" % (sep, colour, path, head, GREY, body))
mm.append('  </div>\n')

mm.append(grow())
mm.append(tabbar('Main.dc.html'))
mm.append(logic(H))
write('Memory.dc.html', mm)
