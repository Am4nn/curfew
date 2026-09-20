# -*- coding: utf-8 -*-
"""Getting in: the sign-in page, first run, the consent gate, the catalog and
the blocking notice. None of these existed on the v5 canvas."""
from chrome import *

# ---------------------------------------------------------------- Sign in ---
# The three photographs are the generated landing images, which is the whole
# reason they exist: a real member's evidence must never appear on a page a
# stranger can open, and this page is the one a stranger opens.
H = 844
signin = [HEAD, root(H)]
signin.append("""
  <!--
    The collage is three GENERATED photographs, and that is not a shortcut. A
    stranger can open this page, so no member's evidence may be on it, which is
    why these images were made rather than borrowed.
  -->
  <div style="flex: none; height: 300px; position: relative; overflow: hidden;">
    <img src="%s" alt="" style="position: absolute; left: -30px; top: 0; width: 210px; height: 236px; object-fit: cover; border-radius: 0 18px 18px 0;">
    <img src="%s" alt="" style="position: absolute; right: -18px; top: 26px; width: 196px; height: 148px; object-fit: cover; border-radius: 18px 0 0 18px;">
    <img src="%s" alt="" style="position: absolute; right: 22px; top: 186px; width: 168px; height: 126px; object-fit: cover; border-radius: 18px;">
    <div style="position: absolute; inset: 0; background: linear-gradient(to bottom, rgba(0,0,0,0.25) 0%%, rgba(0,0,0,0.1) 40%%, rgba(0,0,0,0.92) 92%%, #000000 100%%);"></div>
  </div>
""" % (SLEEP, GYM, FOOD))

signin.append("""  <div style="flex: none; margin-top: -18px; padding: 0 24px;">
    <span style="font-family: %s; font-size: 13px; font-weight: 700; letter-spacing: 0.34em; color: %s;">CURFEW</span>
    <h1 style="margin: 12px 0 0; font-size: 36px; font-weight: 700; line-height: 1.12; letter-spacing: -0.025em;">Say what you did.<br>Show it if it matters.</h1>
    <p style="margin: 14px 0 0; font-size: 16px; line-height: 1.45; color: %s;">A tracker with three friends watching. Windows you set, a photograph when you say so, and a fine when you miss.</p>
  </div>
""" % (MONO, PINK, GREY))

signin.append(grow())
signin.append("""  <div style="flex: none; padding: 0 24px 34px; display: flex; flex-direction: column; gap: 14px;">
    <button type="button" style="width: 100%%; height: 54px; border: 0; border-radius: 15px; background: #ffffff; color: #000000; font-family: inherit; font-size: 17px; font-weight: 600; display: flex; align-items: center; justify-content: center; gap: 10px;">
      <svg width="19" height="19" viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285f4" d="M21.6 12.2c0-.7-.06-1.4-.18-2.06H12v3.9h5.4a4.6 4.6 0 0 1-2 3.02v2.5h3.23c1.89-1.74 2.97-4.3 2.97-7.36z"/><path fill="#34a853" d="M12 22c2.7 0 4.96-.9 6.62-2.44l-3.23-2.5c-.9.6-2.05.95-3.39.95-2.6 0-4.8-1.76-5.6-4.12H3.08v2.59A10 10 0 0 0 12 22z"/><path fill="#fbbc05" d="M6.4 13.89a6 6 0 0 1 0-3.78V7.52H3.08a10 10 0 0 0 0 8.96z"/><path fill="#ea4335" d="M12 5.98c1.47 0 2.79.5 3.83 1.5l2.86-2.86C16.95 2.99 14.7 2 12 2a10 10 0 0 0-8.92 5.52L6.4 10.1C7.2 7.74 9.4 5.98 12 5.98z"/></svg>
      Continue with Google
    </button>
    <div style="display: flex; align-items: center; gap: 9px; justify-content: center;">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="%s" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>
      <span style="font-size: 13px; color: %s;">Invite only. There is no sign-up on this page.</span>
    </div>
  </div>
""" % (DIM, DIM))
signin.append(logic(H))
write('Signin.dc.html', signin)


# --------------------------------------------------------------- First run ---
# 1.15. Deterministic, unskippable, three screens. Every line below is written
# rather than generated: not one model call runs on the screen where somebody
# decides whether this app is worth keeping.
H = 844
first = [HEAD, root(H)]
first.append("""
  <div style="flex: none; height: 44px; padding: 0 20px; display: flex; align-items: center; gap: 6px;">
    <sc-for list="{{pips}}" as="p" hint-placeholder-count="3">
      <span style="width: 26px; height: 3px; border-radius: 999px; background: {{p.fill}};"></span>
    </sc-for>
    <span style="flex-grow: 1;"></span>
    <!-- No Skip. You leave this with one activity set up or you do not leave. -->
    <span style="font-family: %s; font-size: 11px; font-weight: 600; letter-spacing: 0.08em; color: %s;">{{stepLabel}}</span>
  </div>
""" % (MONO, DIM))

REN_SPHERE = """      <div style="position: relative; width: {size}px; height: {size}px;">
        <div style="position: absolute; inset: 0; border-radius: 999px; background: radial-gradient(circle at 33% 25%, #ffffff 0%, #ffccd8 18%, #ff5c7f 44%, #c11a3e 72%, #380813 100%);"></div>
        <div style="position: absolute; inset: 0; border-radius: 999px; background: radial-gradient(circle at 50% 50%, transparent 56%, rgba(0,0,0,0.30) 84%, rgba(0,0,0,0.54) 100%);"></div>
        <div style="position: absolute; inset: 0; border-radius: 999px; background: radial-gradient(circle at 73% 87%, rgba(255,255,255,0.26), transparent 30%);"></div>
        <div style="position: absolute; inset: 0; border-radius: 999px; background: radial-gradient(circle at 31% 23%, rgba(255,255,255,0.92) 0%, rgba(255,255,255,0.30) 17%, transparent 34%);"></div>
        <svg viewBox="0 0 100 100" style="position: absolute; inset: 0; width: 100%; height: 100%;" aria-hidden="true">
          <ellipse cx="38" cy="52" rx="5.4" ry="7.4" fill="#3a0512" opacity="0.9"/>
          <ellipse cx="63" cy="52" rx="5.4" ry="7.4" fill="#3a0512" opacity="0.9"/>
          <ellipse cx="36.3" cy="49" rx="1.9" ry="2.3" fill="#ffffff" opacity="0.85"/>
          <ellipse cx="61.3" cy="49" rx="1.9" ry="2.3" fill="#ffffff" opacity="0.85"/>
          <path d="M41 68 Q50.5 75 60 68" stroke="#3a0512" stroke-width="3.4" fill="none" stroke-linecap="round" opacity="0.88"/>
        </svg>
      </div>
"""

first.append("""
  <!-- 1. He arrives. -->
  <sc-if value="{{isMeet}}" hint-placeholder-val="{{true}}">
    <div style="padding: 44px 26px 0; display: flex; flex-direction: column; align-items: center;">
""" + REN_SPHERE.replace('{size}', '134') + """
      <h1 style="margin: 30px 0 0; font-size: 32px; font-weight: 700; letter-spacing: -0.02em; text-align: center;">This is Ren.</h1>
      <p style="margin: 12px 0 0; font-size: 17px; line-height: 1.5; color: %s; text-align: center;">He reads what you log, your photographs and whatever your groups share with you, and he tells you what he notices.</p>
      <p style="margin: 18px 0 0; font-size: 17px; line-height: 1.5; color: %s; text-align: center;">He never decides whether a day counted. That is arithmetic, and it stays arithmetic.</p>
    </div>
  </sc-if>

  <!-- 2. He asks for something, rather than explaining himself further. -->
  <sc-if value="{{isPick}}" hint-placeholder-val="{{false}}">
    <div style="padding: 20px 20px 0; display: flex; flex-direction: column;">
      <div style="display: flex; align-items: flex-start; gap: 13px;">
""" % (GREY, GREY) + REN_SPHERE.replace('{size}', '44').replace('      <div style="position: relative; width: 44px', '        <div style="flex: none; position: relative; width: 44px') + """        <p style="margin: 0; font-size: 19px; line-height: 1.42; font-weight: 500;">Pick two or three to start. You can change all of it tomorrow.</p>
      </div>

      <div style="margin-top: 22px; border-radius: 14px; background: %s; overflow: hidden;">
        <sc-for list="{{picks}}" as="p" hint-placeholder-count="5">
          <button type="button" onClick="{{p.toggle}}" style="width: 100%%; border: 0; background: transparent; padding: 0 0 0 16px; display: flex; align-items: center; gap: 13px; font-family: inherit; text-align: left;">
            <span style="flex-grow: 1; min-width: 0; display: flex; align-items: center; gap: 13px; padding: 14px 16px 14px 0; border-top: 0.5px solid {{p.sep}};">
              <span style="flex: none; width: 34px; height: 34px; border-radius: 10px; background: {{p.chipBg}}; display: flex; align-items: center; justify-content: center;">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="{{p.chipFg}}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="{{p.path}}"/></svg>
              </span>
              <span style="flex-grow: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px;">
                <span style="font-size: 16px; font-weight: 500; color: #ffffff;">{{p.name}}</span>
                <span style="font-size: 13px; color: %s;">{{p.rule}}</span>
              </span>
              <span style="flex: none; width: 24px; height: 24px; border-radius: 999px; border: 1.6px solid {{p.ringColour}}; background: {{p.ringFill}}; display: flex; align-items: center; justify-content: center;">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="{{p.tickColour}}" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>
              </span>
            </span>
          </button>
        </sc-for>
      </div>
      <p style="margin: 14px 2px 0; font-size: 13px; line-height: 1.45; color: %s;">Defaults are filled in for each one. Nothing here is a commitment you cannot undo, and none of it starts until tomorrow.</p>
    </div>
  </sc-if>

  <!-- 3. He has already helped with something, which is the point of 1.15. -->
  <sc-if value="{{isDone}}" hint-placeholder-val="{{false}}">
    <div style="padding: 40px 26px 0; display: flex; flex-direction: column; align-items: center;">
""" % (CARD, GREY, GREY) + REN_SPHERE.replace('{size}', '104') + """
      <h1 style="margin: 26px 0 0; font-size: 30px; font-weight: 700; letter-spacing: -0.02em; text-align: center;">{{count}} set up.</h1>
      <p style="margin: 11px 0 0; font-size: 17px; line-height: 1.5; color: %s; text-align: center;">Your first windows open tomorrow morning. I will be on Today when they do.</p>

      <div style="margin-top: 26px; width: 100%%; border-radius: 14px; background: %s; padding: 15px 16px; display: flex; flex-direction: column; gap: 10px;">
        <sc-for list="{{chosen}}" as="c" hint-placeholder-count="3">
          <div style="display: flex; align-items: center; gap: 10px;">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="%s" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex: none;"><polyline points="20 6 9 17 4 12"/></svg>
            <span style="flex-grow: 1; font-size: 15px; font-weight: 500;">{{c.name}}</span>
            <span style="font-family: %s; font-size: 12.5px; color: %s;">{{c.when}}</span>
          </div>
        </sc-for>
      </div>
    </div>
  </sc-if>
""" % (GREY, CARD, GREEN, MONO, GREY))

first.append(grow())
first.append("""  <div style="flex: none; padding: 0 20px 34px;">
    <sc-if value="{{notLast}}" hint-placeholder-val="{{true}}">
      <button type="button" onClick="{{next}}" style="width: 100%%; height: 54px; border: 0; border-radius: 15px; background: {{nextBg}}; color: {{nextFg}}; font-family: inherit; font-size: 17px; font-weight: 600;">{{nextLabel}}</button>
    </sc-if>
    <sc-if value="{{isDone}}" hint-placeholder-val="{{false}}">
      <a href="Main.dc.html" style="display: flex; align-items: center; justify-content: center; width: 100%%; height: 54px; border-radius: 15px; background: %s; color: #ffffff; text-decoration: none; font-size: 17px; font-weight: 600;">Go to Today</a>
    </sc-if>
  </div>
""" % PINK)

first.append(logic(H, """  constructor(props) {
    super(props);
    // Water and Sleep are pre-ticked, which is the only nudge in the tutorial.
    // Leaving with nothing is not an outcome this screen offers.
    this.state = { step: 0, on: { water: true, sleep: true, gym: false, read: false, food: false } };
  }
  renderVals() {
    const ON = '""" + PINK + """', OFF = '""" + CARD2 + """', SEP = '""" + SEP + """';
    const step = this.state.step, on = this.state.on;
    const defs = [
      { key: 'water', name: 'Water', rule: '8 glasses, any time', when: 'all day',
        path: 'M12 3s6 6.4 6 10.2A6 6 0 0 1 6 13.2C6 9.4 12 3 12 3z' },
      { key: 'sleep', name: 'Sleep', rule: 'In bed 10:30 PM, up 6:30 AM', when: '10:30 PM',
        path: 'M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z' },
      { key: 'gym',   name: 'Gym', rule: 'Three a week, photo on the way out', when: 'Mon Wed Fri',
        path: 'M6.5 8v8M17.5 8v8M3.5 10v4M20.5 10v4M6.5 12h11' },
      { key: 'read',  name: 'Reading', rule: '20 minutes before bed', when: '9:00 PM',
        path: 'M4 5.5A2.5 2.5 0 0 1 6.5 3H12v17H6.5A2.5 2.5 0 0 0 4 22zM20 5.5A2.5 2.5 0 0 0 17.5 3H12v17h5.5a2.5 2.5 0 0 1 2.5 2z' },
      { key: 'food',  name: 'Food', rule: 'Three meals, under 2,000 calories', when: 'all day',
        path: 'M6 3v8a2.5 2.5 0 0 0 5 0V3M8.5 11v10M18 3c-1.6 1.4-2.4 3.4-2.4 5.6 0 1.6.8 2.6 2.4 2.8V21' },
    ];
    const count = defs.filter((d) => on[d.key]).length;
    return {
      pips: [0, 1, 2].map((i) => ({ fill: i <= step ? ON : OFF })),
      stepLabel: `STEP ${step + 1} OF 3`,
      isMeet: step === 0, isPick: step === 1, isDone: step === 2, notLast: step < 2,
      nextLabel: step === 0 ? 'Hello, Ren' : (count === 0 ? 'Pick at least one' : `Set up ${count}`),
      nextBg: step === 0 || count > 0 ? ON : OFF,
      nextFg: step === 0 || count > 0 ? '#ffffff' : '""" + DIM + """',
      next: () => { if (step === 1 && count === 0) return; this.setState({ step: step + 1 }); },
      count,
      chosen: defs.filter((d) => on[d.key]).map((d) => ({ name: d.name, when: d.when })),
      picks: defs.map((d, i) => ({
        name: d.name, rule: d.rule, path: d.path,
        sep: i === 0 ? 'transparent' : SEP,
        chipBg: on[d.key] ? 'rgba(255,55,95,0.16)' : OFF,
        chipFg: on[d.key] ? ON : '#ffffff',
        ringColour: on[d.key] ? ON : '#5a5a5e',
        ringFill: on[d.key] ? ON : 'transparent',
        tickColour: on[d.key] ? '#ffffff' : 'transparent',
        toggle: () => this.setState({ on: { ...on, [d.key]: !on[d.key] } }),
      })),
    };
  }"""))
write('Welcome.dc.html', first)


# ------------------------------------------------------------ Consent gate ---
# The one screen v4 cannot ship without. It carries what Curfew stores, what a
# model is now allowed to read, and 1.18: sharing a photograph with a group
# consents to that group's coaches reading it too.
H = 1004
consent = [HEAD, root(H)]
consent.append("""
  <!--
    Phase 9's blocking overlay, reused. No tab bar, no back control and no way
    around it: the whole app is behind this until it is answered. Curfew has
    exactly one screen with no escape and this is it.
  -->
  <div style="flex: none; height: 44px; padding: 0 20px; display: flex; align-items: center;">
    <span style="font-family: %s; font-size: 11px; font-weight: 700; letter-spacing: 0.12em; color: %s;">CURFEW 4.0</span>
  </div>
""" % (MONO, PINK))
consent.append(title('What changes, and what you are agreeing to',
                     'Curfew has a coach in it now. He reads things, so this needs saying plainly before you carry on.'))

ROWS = [
    (PINK, 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4.5 21a7.5 7.5 0 0 1 15 0',
     'Ren reads everything you log',
     'Every check-in, every time, every number, and <b style="color:#ffffff;font-weight:600;">every photograph you have taken</b>. That is new. Until now nothing read your pictures, and a model does now.'),
    (ORANGE, 'M3 8h3l2-3h8l2 3h3v12H3zM12 13m-3.4 0a3.4 3.4 0 1 0 6.8 0 3.4 3.4 0 1 0-6.8 0',
     'A photograph you share with a group is read for them too',
     'If you share Food with Wing, Wing&#39;s members see your meals, and their coaches read them the same way yours reads yours. Sharing a picture is sharing it with the coach behind the person.'),
    (GREEN, 'M20 6L9 17l-5-5',
     'He never decides whether a day counted',
     'Not one number in this app comes from a model. Passes, misses, streaks, standing and money are arithmetic over your check-ins and they stay that way.'),
    (GREY, 'M4 12h16M12 4v16',
     'Turn him off and off is real',
     'One switch in Settings. The tab goes, his lines go, and nothing of yours is sent to a model again. What is left is the tracker, which is a whole app on its own.'),
]
consent.append('  <div style="flex: none; margin: 22px 20px 0; border-radius: 16px; background: %s; overflow: hidden;">\n' % CARD)
for i, (colour, path, head, body) in enumerate(ROWS):
    sep = 'transparent' if i == 0 else SEP
    consent.append("""    <div style="display: flex; gap: 13px; padding: 16px; border-top: 0.5px solid %s;">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="%s" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex: none; margin-top: 2px;"><path d="%s"/></svg>
      <div style="flex-grow: 1; min-width: 0; display: flex; flex-direction: column; gap: 5px;">
        <span style="font-size: 15.5px; font-weight: 600; line-height: 1.3;">%s</span>
        <span style="font-size: 13.5px; line-height: 1.48; color: %s;">%s</span>
      </div>
    </div>
""" % (sep, colour, path, head, GREY, body))
consent.append('  </div>\n')

consent.append("""  <div style="flex: none; margin: 18px 20px 0; display: flex; gap: 11px;">
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="%s" stroke-width="2" stroke-linecap="round" aria-hidden="true" style="flex: none; margin-top: 1px;"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 7.5v.01"/></svg>
    <span style="font-size: 13px; line-height: 1.48; color: %s;">The money you owe is not deleted by anything on this screen, and never has been. A balance is a record of what two people agreed, so it survives you leaving.</span>
  </div>
""" % (DIM, GREY))

consent.append(grow())
consent.append("""  <div style="flex: none; padding: 0 20px 30px; display: flex; flex-direction: column; gap: 12px;">
    <div style="display: flex; gap: 14px;">
      <a href="Data.dc.html" style="flex-grow: 1; height: 52px; border-radius: 15px; border: 1px solid #3a3a3c; display: flex; align-items: center; justify-content: center; text-decoration: none; color: #ffffff; font-size: 16px; font-weight: 500;">Read the terms</a>
      <button type="button" style="flex-grow: 1; height: 52px; border: 0; border-radius: 15px; background: %s; color: #ffffff; font-family: inherit; font-size: 17px; font-weight: 600;">I accept</button>
    </div>
    <span style="text-align: center; font-size: 12.5px; color: %s;">Every member accepts this once. Nobody is carried over silently.</span>
  </div>
""" % (PINK, DIM))
consent.append(logic(H))
write('Consent.dc.html', consent)


# ---------------------------------------------------------------- Catalog ---
# /activities/add. Cold shower and no junk food are drawn here because Monk
# mode aggregates activities and cannot count a condition that is not a type.
H = 1180
cat = [HEAD, root(H)]
cat.append(nav('Activities.dc.html', 'Back to your activities'))
cat.append(title('Add an activity', 'Fourteen to choose from. Each one arrives with a default rule you can change before it starts.'))

TYPES = [
    ('Cold shower', 'Once a day, confirm window', 'NEW', 'M12 3v9M12 3c-3 2.6-5 5-5 7.2a5 5 0 0 0 10 0C17 8 15 5.6 12 3z'),
    ('No junk food', 'Held or slipped, no photograph', 'NEW', 'M4 4l16 16M7.5 3.5v7a2.5 2.5 0 0 0 5 0v-7M10 10.5V20'),
    ('Gym', 'Three a week, photo on the way out', None, 'M6.5 8v8M17.5 8v8M3.5 10v4M20.5 10v4M6.5 12h11'),
    ('Study', 'Minutes a day, photo required', None, 'M3 7l9-4 9 4-9 4zM7 10.5V16c0 1.4 2.2 2.6 5 2.6s5-1.2 5-2.6v-5.5'),
    ('Steps', 'At or above a number', None, 'M8 4v7a3 3 0 0 0 6 0M9 18.5h6'),
    ('Screen', 'At or below a number', None, 'M3 5h18v11H3zM8.5 20h7'),
    ('Nightfast', 'Nothing after a time you set', None, 'M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z'),
    ('Sugar-free', 'Held or slipped, confirm window', None, 'M5 12h14M9 8l-4 4 4 4M15 8l4 4-4 4'),
    ('Office', 'Weekdays, 10 AM to 2 PM', None, 'M4 21V6l8-3 8 3v15M9 21v-5h6v5'),
    ('Supplements', 'Once a day, no window', None, 'M8.5 4.5h7l-1 15h-5zM8 9.5h8'),
]
cat.append(section('Not tracking yet', top=26))
cat.append('  <div style="flex: none; margin: 12px 20px 0; border-radius: 14px; background: %s; overflow: hidden;">\n' % CARD)
for i, (name, rule, tag, path) in enumerate(TYPES):
    sep = 'transparent' if i == 0 else SEP
    badge = ''
    if tag:
        badge = ('<span style="flex: none; font-family: %s; font-size: 9.5px; font-weight: 700; letter-spacing: 0.1em; '
                 'color: %s; border: 1px solid %s; border-radius: 5px; padding: 1px 5px;">%s</span>' % (MONO, PINK, PINK, tag))
    cat.append("""    <div style="display: flex; align-items: center; gap: 13px; padding-left: 16px;">
      <span style="flex-grow: 1; min-width: 0; display: flex; align-items: center; gap: 13px; padding: 12px 16px 12px 0; border-top: 0.5px solid %s;">
        <span style="flex: none; width: 34px; height: 34px; border-radius: 10px; background: %s; display: flex; align-items: center; justify-content: center;">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="%s"/></svg>
        </span>
        <span style="flex-grow: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px;">
          <span style="display: flex; align-items: center; gap: 7px;"><span style="font-size: 16px; font-weight: 500;">%s</span>%s</span>
          <span style="font-size: 13px; color: %s;">%s</span>
        </span>
        <a href="Configure.dc.html" aria-label="Add %s" style="flex: none; width: 32px; height: 32px; border-radius: 999px; background: %s; display: flex; align-items: center; justify-content: center; text-decoration: none;">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.6" stroke-linecap="round" aria-hidden="true"><path d="M12 6v12M6 12h12"/></svg>
        </a>
      </span>
    </div>
""" % (sep, CARD2, path, name, badge, GREY, rule, name, PINK))
cat.append('  </div>\n')

cat.append(section('Already tracking', top=26))
cat.append("""  <div style="flex: none; margin: 12px 20px 0; display: flex; flex-wrap: wrap; gap: 8px;">
    <sc-for list="{{have}}" as="h" hint-placeholder-count="7">
      <span style="display: flex; align-items: center; gap: 6px; padding: 8px 12px; border-radius: 999px; background: %s;">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="%s" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>
        <span style="font-size: 14px; color: %s;">{{h.name}}</span>
      </span>
    </sc-for>
  </div>
  <p style="flex: none; margin: 16px 20px 0; font-size: 13px; line-height: 1.48; color: %s;">Whatever you add starts tomorrow, and the first few days are marked settling so a half-set-up activity never counts against you.</p>
""" % (CARD, GREEN, GREY, GREY))
cat.append(grow())
cat.append(tabbar('Activities.dc.html'))
cat.append(logic(H, """  renderVals() {
    return {
      have: ['Water', 'Sleep', 'Food', 'Reading', 'Gym', 'Supplements', 'Nightfast']
        .map((name) => ({ name })),
    };
  }"""))
write('Catalog.dc.html', cat)


# ----------------------------------------------------------------- Notice ---
# The blocking release notice, over Home. Got it is the only control, and an
# acknowledgement cannot be taken back, which is why publishing has a --dry.
H = 844
notice = [HEAD, root(H, ' position: relative;')]
notice.append("""
  <!-- Home, dimmed, so it is obvious what is behind this and that it is yours. -->
  <div style="position: absolute; inset: 0; opacity: 0.22; display: flex; flex-direction: column; padding: 16px 20px 0;">
    <span style="font-size: 34px; font-weight: 700;">Today</span>
    <span style="margin-top: 22px; font-size: 44px; font-weight: 700;">4 <span style="font-size: 20px; color: %s;">of 7</span></span>
    <div style="margin-top: 16px; display: flex; gap: 4px;">
      <sc-for list="{{segs}}" as="s" hint-placeholder-count="7">
        <span style="flex-grow: 1; height: 5px; border-radius: 999px; background: {{s.fill}};"></span>
      </sc-for>
    </div>
    <sc-for list="{{ghost}}" as="g" hint-placeholder-count="5">
      <div style="margin-top: 18px; display: flex; align-items: center; gap: 12px;">
        <span style="width: 34px; height: 34px; border-radius: 10px; background: %s;"></span>
        <span style="flex-grow: 1; height: 13px; border-radius: 4px; background: %s;"></span>
      </div>
    </sc-for>
  </div>
  <div style="position: absolute; inset: 0; background: rgba(0,0,0,0.72);"></div>
""" % (GREY, CARD2, CARD))

notice.append("""
  <div style="position: absolute; left: 16px; right: 16px; top: 132px; border-radius: 22px; background: #161618; border: 0.5px solid rgba(255,255,255,0.1); padding: 26px 22px 22px; display: flex; flex-direction: column;">
    <span style="font-family: %s; font-size: 11px; font-weight: 700; letter-spacing: 0.12em; color: %s;">CURFEW 4.0</span>
    <h2 style="margin: 12px 0 0; font-size: 26px; font-weight: 700; letter-spacing: -0.02em; line-height: 1.2;">Ren, nudges, and Monk mode</h2>

    <div style="margin-top: 18px; display: flex; flex-direction: column; gap: 14px;">
      <sc-for list="{{lines}}" as="l" hint-placeholder-count="4">
        <div style="display: flex; gap: 11px;">
          <span style="flex: none; margin-top: 7px; width: 5px; height: 5px; border-radius: 999px; background: %s;"></span>
          <span style="flex-grow: 1; font-size: 15px; line-height: 1.5; color: %s;">{{l.text}}</span>
        </div>
      </sc-for>
    </div>

    <!--
      The words came out of release-notes.json in the same commit as the change
      they describe, so they went through review with the code. Nothing here was
      typed at the moment of publishing.
    -->
    <button type="button" style="margin-top: 24px; width: 100%%; height: 50px; border: 0; border-radius: 14px; background: %s; color: #ffffff; font-family: inherit; font-size: 17px; font-weight: 600;">Got it</button>
    <span style="margin-top: 11px; text-align: center; font-size: 12px; color: %s;">There is no dismiss. Got it is final.</span>
  </div>
""" % (MONO, PINK, PINK, '#c7c7cc', PINK, DIM))

notice.append(logic(H, """  renderVals() {
    const ON = '""" + PINK + """', OFF = '""" + CARD2 + """';
    return {
      segs: Array.from({ length: 7 }, (_, i) => ({ fill: i < 4 ? ON : OFF })),
      ghost: Array.from({ length: 5 }, () => ({})),
      lines: [
        { text: 'Ren is a coach who reads what you log, including your photographs, and says what he notices. He never scores anything.' },
        { text: 'You can see who in your groups is at risk right now, and nudge them. Four set messages, no typing.' },
        { text: 'Monk mode reads the activities you already track and gives the day a percentage. No streak, no pass, no fine.' },
        { text: 'Cold shower and No junk food are new activities. Both are a held-or-slipped answer with no photograph.' },
      ],
    };
  }"""))
write('Notice.dc.html', notice)
