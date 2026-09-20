# -*- coding: utf-8 -*-
"""Getting in: the sign-in page, first run, the consent gate, the catalog and
the blocking notice. None of these existed on the v5 canvas."""
from chrome import *

# ---------------------------------------------------------------- Sign in ---
# Moved to batch5.py when it was rebuilt around the mark. Two files writing one
# board is a file-order bug waiting to happen, and it happened once.



# --------------------------------------------------------------- First run ---
# 1.15. Deterministic, unskippable, three screens. Every line below is written
# rather than generated: not one model call runs on the screen where somebody
# decides whether this app is worth keeping.
H = 872
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

MARK = ('<svg viewBox="0 0 32 32" width="{size}" height="{size}" shape-rendering="crispEdges" aria-hidden="true" '
        'style="flex: none; display: block;"><rect x="2" y="2" width="13" height="13" fill="#ffffff"/>'
        '<rect x="17" y="2" width="13" height="13" fill="#ffffff"/>'
        '<rect x="2" y="17" width="13" height="13" fill="#ffffff"/></svg>')

first.append("""
  <!-- 1. He arrives, and the refusal is on the same screen. -->
  <sc-if value="{{isMeet}}" hint-placeholder-val="{{true}}">
    <div style="padding: 40px 26px 0; display: flex; flex-direction: column; align-items: center;">
""" + REN_SPHERE.replace('{size}', '130') + """
      <h1 style="margin: 28px 0 0; font-size: 32px; font-weight: 700; letter-spacing: -0.02em; text-align: center;">This is Ren.</h1>
      <p style="margin: 12px 0 0; font-size: 17px; line-height: 1.5; color: %s; text-align: center;">He reads what you log, your photographs and whatever your groups share with you, and he tells you what he notices.</p>
      <p style="margin: 16px 0 0; font-size: 17px; line-height: 1.5; color: %s; text-align: center;">He never decides whether a day counted. That is arithmetic, and it stays arithmetic.</p>
    </div>
  </sc-if>

  <!-- 2. Something is asked for, rather than more explaining. -->
  <sc-if value="{{isPick}}" hint-placeholder-val="{{false}}">
    <div style="padding: 20px 20px 0; display: flex; flex-direction: column;">
      <div style="display: flex; align-items: flex-start; gap: 13px;">
        <sc-if value="{{ren}}" hint-placeholder-val="{{true}}">
""" % (GREY, GREY) + REN_SPHERE.replace('{size}', '44').replace('      <div style="position: relative; width: 44px', '        <div style="flex: none; position: relative; width: 44px') + """        </sc-if>
        <sc-if value="{{noRen}}" hint-placeholder-val="{{false}}">
          <span style="flex: none; margin-top: 4px;">""" + MARK.replace('{size}', '26') + """</span>
        </sc-if>
        <p style="margin: 0; flex-grow: 1; font-size: 19px; line-height: 1.42; font-weight: 500;">{{pickLine}}</p>
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

  <!-- 3. Something has already been helped with, which is the point of 1.15. -->
  <sc-if value="{{isDone}}" hint-placeholder-val="{{false}}">
    <div style="padding: 38px 26px 0; display: flex; flex-direction: column; align-items: center;">
      <sc-if value="{{ren}}" hint-placeholder-val="{{true}}">
""" % (CARD, GREY, GREY) + REN_SPHERE.replace('{size}', '100') + """      </sc-if>
      <sc-if value="{{noRen}}" hint-placeholder-val="{{false}}">
        <span style="margin-top: 14px;">""" + MARK.replace('{size}', '62') + """</span>
      </sc-if>

      <h1 style="margin: 26px 0 0; font-size: 30px; font-weight: 700; letter-spacing: -0.02em; text-align: center;">{{count}} set up.</h1>
      <p style="margin: 11px 0 0; font-size: 17px; line-height: 1.5; color: %s; text-align: center;">{{doneLine}}</p>

      <div style="margin-top: 24px; width: 100%%; border-radius: 14px; background: %s; padding: 15px 16px; display: flex; flex-direction: column; gap: 10px;">
        <sc-for list="{{chosen}}" as="c" hint-placeholder-count="3">
          <div style="display: flex; align-items: center; gap: 10px;">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="%s" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex: none;"><polyline points="20 6 9 17 4 12"/></svg>
            <span style="flex-grow: 1; font-size: 15px; font-weight: 500;">{{c.name}}</span>
            <span style="font-family: %s; font-size: 12.5px; color: %s;">{{c.when}}</span>
          </div>
        </sc-for>
      </div>

      <!-- Said once, and only to somebody who said no. Nagging a person about
           a thing they declined is how a switch stops being a real switch. -->
      <sc-if value="{{noRen}}" hint-placeholder-val="{{false}}">
        <div style="margin-top: 16px; width: 100%%; border-radius: 14px; background: %s; padding: 14px 16px; display: flex; gap: 12px;">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="%s" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex: none; margin-top: 1px;"><path d="M12 3v8.4M7.4 6.2a7 7 0 1 0 9.2 0"/></svg>
          <span style="flex-grow: 1; font-size: 13px; line-height: 1.45; color: %s;">Ren is off. Nothing of yours goes to a model, and there is no coach tab. Switch him on any time in Settings.</span>
        </div>
      </sc-if>
    </div>
  </sc-if>
""" % (GREY, CARD, GREEN, MONO, GREY, CARD, GREY, GREY))

first.append(grow())

# THE REFUSAL SITS UNDER THE PRIMARY, not beside it. Side by side makes two
# equal choices out of one obvious one and one honest escape.
first.append("""  <div style="flex: none; padding: 0 20px 30px;">
    <sc-if value="{{notLast}}" hint-placeholder-val="{{true}}">
      <button type="button" onClick="{{next}}" style="width: 100%%; height: 54px; border: 0; border-radius: 15px; background: {{nextBg}}; color: {{nextFg}}; font-family: inherit; font-size: 17px; font-weight: 600;">{{nextLabel}}</button>
    </sc-if>
    <sc-if value="{{isMeet}}" hint-placeholder-val="{{true}}">
      <button type="button" onClick="{{decline}}" style="margin-top: 6px; width: 100%%; height: 44px; border: 0; background: transparent; color: %s; font-family: inherit; font-size: 15px;">I do not want a coach</button>
      <p style="margin: 0; text-align: center; font-size: 12.5px; line-height: 1.4; color: %s;">Nothing of yours is sent to a model, and you can switch him on later in Settings.</p>
    </sc-if>
    <sc-if value="{{isDone}}" hint-placeholder-val="{{false}}">
      <a href="Main.dc.html" style="display: flex; align-items: center; justify-content: center; width: 100%%; height: 54px; border-radius: 15px; background: %s; color: #ffffff; text-decoration: none; font-size: 17px; font-weight: 600;">Go to Today</a>
    </sc-if>
  </div>
""" % (GREY, DIM, PINK))

first.append(logic(H, """  constructor(props) {
    super(props);
    // Water and Sleep are pre-ticked, which is the only nudge in the tutorial.
    // Leaving with nothing is not an outcome this screen offers.
    this.state = { step: 0, ren: true, on: { water: true, sleep: true, gym: false, read: false, food: false } };
  }
  renderVals() {
    const ON = '""" + PINK + """', OFF = '""" + CARD2 + """', SEP = '""" + SEP + """';
    const step = this.state.step, on = this.state.on, ren = this.state.ren;
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
      ren, noRen: !ren,
      // He asks on the picking screen only if he is still here. Otherwise the
      // app asks, in its own voice, and he is not mentioned.
      pickLine: ren
        ? 'Pick two or three to start. You can change all of it tomorrow.'
        : 'Pick two or three to start. Nothing here begins until tomorrow.',
      doneLine: ren
        ? 'Your first windows open tomorrow morning. I will be on Today when they do.'
        : 'Your first windows open tomorrow morning.',
      nextLabel: step === 0
        ? (ren ? 'Hello, Ren' : 'Carry on')
        : (count === 0 ? 'Pick at least one' : `Set up ${count}`),
      nextBg: step === 0 || count > 0 ? ON : OFF,
      nextFg: step === 0 || count > 0 ? '#ffffff' : '""" + DIM + """',
      next: () => { if (step === 1 && count === 0) return; this.setState({ step: step + 1 }); },
      decline: () => this.setState({ ren: false, step: 1 }),
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
# Moved to consent.py. It is nineteen sections of real policy copy lifted from
# src/server/consent.ts and src/server/policy.ts, and it does not belong in a
# file with four other boards in it.



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
    <span style="font-family: %s; font-size: 11px; font-weight: 700; letter-spacing: 0.12em; color: %s;">WHAT&#39;S NEW</span>
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
