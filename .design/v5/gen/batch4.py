# -*- coding: utf-8 -*-
"""Monk mode, DECIDED 1.16. An aggregate over activities you already track, and
the only thing in Curfew with no streak, no pass and no fine."""
import io, os
from chrome import *

# ------------------------------------------------------------- Monk, read ---
H = 1240
mk = [HEAD, root(H)]
mk.append(nav('Main.dc.html', 'Back to Today',
               right=top_action('Set up', TUNE_ICON, href='MonkSetup.dc.html')))

# The number, and nothing that turns it into a verdict. No flame, no bar to
# clear, no "closes at", because the activity whose subject is compulsive
# behaviour is the one thing here that cannot punish you.
mk.append("""  <div style="flex: none; padding: 4px 20px 0;">
    <h1 style="margin: 0; font-size: 34px; font-weight: 700; letter-spacing: -0.02em;">Monk mode</h1>
    <div style="margin-top: 18px; display: flex; align-items: baseline; gap: 10px;">
      <span style="font-family: %s; font-size: 76px; font-weight: 700; letter-spacing: -0.045em; line-height: 0.9;">71</span>
      <span style="font-family: %s; font-size: 30px; font-weight: 700; color: %s;">&#37;</span>
      <span style="flex-grow: 1;"></span>
      <span style="font-size: 15px; color: %s;">5 of 7 today</span>
    </div>
    <div style="margin-top: 16px; height: 8px; border-radius: 999px; background: %s; position: relative; overflow: hidden;">
      <span style="position: absolute; left: 0; top: 0; bottom: 0; width: 71%%; border-radius: 999px; background: %s;"></span>
    </div>
    <p style="margin: 14px 0 0; font-size: 13.5px; line-height: 1.48; color: %s;">Passed over scheduled. No streak, no bar, no fine.</p>
  </div>
""" % (MONO, MONO, GREY, GREY, CARD2, PINK, GREY))

# Ren speaks here, once, about the week. He reads the number; he never makes it.
mk.append("""  <div style="flex: none; margin: 22px 20px 0; display: flex; align-items: flex-start; gap: 12px;">
    <span style="flex: none; position: relative; width: 34px; height: 34px;">
      <span style="position: absolute; inset: 0; border-radius: 999px; background: radial-gradient(circle at 33%% 25%%, #ffffff 0%%, #ffccd8 18%%, #ff5c7f 44%%, #c11a3e 72%%, #380813 100%%);"></span>
      <span style="position: absolute; inset: 0; border-radius: 999px; background: radial-gradient(circle at 50%% 50%%, transparent 56%%, rgba(0,0,0,0.30) 84%%, rgba(0,0,0,0.54) 100%%);"></span>
      <svg viewBox="0 0 100 100" style="position: absolute; inset: 0; width: 100%%; height: 100%%;" aria-hidden="true">
        <ellipse cx="38" cy="52" rx="5.4" ry="7" fill="#3a0512" opacity="0.9"/>
        <ellipse cx="63" cy="52" rx="5.4" ry="7" fill="#3a0512" opacity="0.9"/>
        <path d="M41 68 Q50.5 74 60 68" stroke="#3a0512" stroke-width="3.4" fill="none" stroke-linecap="round" opacity="0.88"/>
      </svg>
    </span>
    <p style="margin: 0; flex-grow: 1; font-size: 16px; line-height: 1.48; color: %s;">Your weekends are where this goes. Monday to Friday you are at <span style="color:#ffffff;font-weight:600;">84&#37;</span>; Saturday and Sunday you are at <span style="color:#ffffff;font-weight:600;">46&#37;</span>. Same week, twice.</p>
  </div>
""" % GREY)

mk.append(section('Today', top=26))
mk.append("""  <div style="flex: none; margin: 12px 20px 0; border-radius: 14px; background: %s; overflow: hidden;">
    <sc-for list="{{set}}" as="s" hint-placeholder-count="9">
      <div style="padding-left: 16px;">
        <div style="display: flex; align-items: center; gap: 12px; padding: 11px 16px 11px 0; border-top: 0.5px solid {{s.sep}};">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="{{s.tone}}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex: none;"><path d="{{s.mark}}"/></svg>
          <span style="flex-grow: 1; font-size: 16px; color: {{s.nameTone}};">{{s.name}}</span>
          <span style="font-family: %s; font-size: 12.5px; font-weight: 500; color: {{s.noteTone}};">{{s.note}}</span>
        </div>
      </div>
    </sc-for>
  </div>
  <!--
    A WEEKLY COUNTS ON THE DAYS YOU DID IT AND IS IGNORED OTHERWISE, so the
    denominator moves daily. Gym is in today because he went; on a Wednesday he
    does not go, it is simply not asked, and a weekly can only ever lift a day.
  -->
  <p style="flex: none; margin: 12px 20px 0; font-size: 12.5px; line-height: 1.48; color: %s;">Only what was scheduled counts.</p>
""" % (CARD, MONO, GREY))

mk.append(section('This week', top=26))
mk.append("""  <div style="flex: none; margin: 14px 20px 0; border-radius: 14px; background: %s; padding: 16px 14px 12px;">
    <div style="display: flex; align-items: flex-end; gap: 7px; height: 108px;">
      <sc-for list="{{week}}" as="w" hint-placeholder-count="7">
        <div style="flex-grow: 1; flex-basis: 0; display: flex; flex-direction: column; align-items: center; gap: 6px; height: 100%%; justify-content: flex-end;">
          <span style="font-family: %s; font-size: 10.5px; font-weight: 600; color: {{w.tone}};">{{w.pct}}</span>
          <span style="width: 100%%; height: {{w.h}}px; border-radius: 4px 4px 0 0; background: {{w.fill}};"></span>
        </div>
      </sc-for>
    </div>
    <div style="margin-top: 8px; display: flex; gap: 7px; border-top: 0.5px solid %s; padding-top: 8px;">
      <sc-for list="{{week}}" as="w" hint-placeholder-count="7">
        <span style="flex-grow: 1; flex-basis: 0; text-align: center; font-family: %s; font-size: 10.5px; font-weight: 600; color: {{w.labelTone}};">{{w.label}}</span>
      </sc-for>
    </div>
  </div>
  <!--
    A day where nothing in the set was scheduled is 0 of 0. It is no score at
    all and it must never render as 0%%, so Wednesday carries a dash.
  -->
  <p style="flex: none; margin: 12px 20px 0; font-size: 12.5px; line-height: 1.48; color: %s;">A dash means nothing was scheduled.</p>
""" % (CARD, MONO, SEP, MONO, GREY))
mk.append(grow())
mk.append(tabbar('Main.dc.html'))
mk.append(logic(H, """  renderVals() {
    const SEP = '""" + SEP + """', ON = '""" + PINK + """', OFF = '""" + CARD2 + """';
    const TICK = 'M20 6L9 17l-5-5', CROSS = 'M6 6l12 12M18 6L6 18', DASH = 'M6 12h12';
    const rows = [
      { name: 'Cold shower', state: 'in', note: '6:20 AM' },
      { name: 'No junk food', state: 'in', note: 'held' },
      { name: 'Sleep', state: 'in', note: '10:22 PM' },
      { name: 'Water', state: 'out', note: '7 of 10' },
      { name: 'Reading', state: 'in', note: '24 min' },
      { name: 'Gym', state: 'in', note: 'weekly, counted' },
      { name: 'Screen', state: 'out', note: '3h 40m of 2h' },
      { name: 'Study', state: 'skip', note: 'not scheduled' },
      { name: 'Nightfast', state: 'skip', note: 'not scheduled' },
    ];
    const marks = {
      in:   { mark: TICK,  tone: '""" + GREEN + """', nameTone: '#ffffff', noteTone: '""" + GREY + """' },
      out:  { mark: CROSS, tone: '""" + RED + """',   nameTone: '#ffffff', noteTone: '""" + GREY + """' },
      skip: { mark: DASH,  tone: '""" + DIM + """',   nameTone: '""" + GREY + """', noteTone: '""" + DIM + """' },
    };
    // Wednesday is 0 of 0: nothing scheduled, so no score at all.
    const raw = [
      { label: 'M', pct: 88 }, { label: 'T', pct: 75 }, { label: 'W', pct: null },
      { label: 'T', pct: 100 }, { label: 'F', pct: 71 }, { label: 'S', pct: 40 },
      { label: 'S', pct: 71, today: true },
    ];
    return {
      set: rows.map((r, i) => ({ name: r.name, note: r.note, sep: i === 0 ? 'transparent' : SEP, ...marks[r.state] })),
      week: raw.map((d) => ({
        label: d.label,
        pct: d.pct === null ? '\\u2014' : `${d.pct}%`,
        h: d.pct === null ? 3 : Math.max(6, Math.round((d.pct / 100) * 86)),
        fill: d.pct === null ? '""" + DIM + """' : ON,
        tone: d.pct === null ? '""" + DIM + """' : '#ffffff',
        labelTone: d.today ? '#ffffff' : '""" + GREY + """',
      })),
    };
  }"""))
write('Monk.dc.html', mk)


# ------------------------------------------------------------ Monk, set up ---
H = 1400
ms = [HEAD, root(H)]
ms.append(nav('Monk.dc.html', 'Back to Monk mode',
               right=top_action('Save', SAVE_ICON)))
ms.append(title('Set up Monk mode', 'What counts, and how hard.'))

# Compulsory activities. Free, because it still only reads `passed`.
ms.append(section('Always in', top=26))
ms.append("""  <p style="flex: none; margin: 8px 20px 0; font-size: 13.5px; line-height: 1.48; color: %s;">Three are compulsory.</p>
  <div style="flex: none; margin: 14px 20px 0; border-radius: 14px; background: %s; overflow: hidden;">
    <sc-for list="{{fixed}}" as="f" hint-placeholder-count="3">
      <div style="padding-left: 16px;">
        <div style="display: flex; align-items: center; gap: 12px; padding: 12px 16px 12px 0; border-top: 0.5px solid {{f.sep}};">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="%s" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex: none;"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>
          <span style="flex-grow: 1; font-size: 16px;">{{f.name}}</span>
          <span style="font-family: %s; font-size: 10.5px; font-weight: 700; letter-spacing: 0.08em; color: %s;">COMPULSORY</span>
        </div>
      </div>
    </sc-for>
  </div>
""" % (GREY, CARD, GREY, MONO, GREY))

# Required categories. Costs a category field on each module, and it is what
# lets somebody who runs and somebody who lifts both have a real monk day.
ms.append(section('Four kinds, all covered', top=26))
ms.append("""  <p style="flex: none; margin: 8px 20px 0; font-size: 13.5px; line-height: 1.48; color: %s;">A body, a food, a mind and a sleep.</p>
  <div style="flex: none; margin: 14px 20px 0; display: flex; flex-direction: column; gap: 8px;">
    <sc-for list="{{cats}}" as="c" hint-placeholder-count="4">
      <div style="border-radius: 13px; background: %s; padding: 13px 15px; display: flex; align-items: center; gap: 12px;">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="{{c.tone}}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex: none;"><path d="{{c.mark}}"/></svg>
        <span style="flex: none; width: 58px; font-family: %s; font-size: 11px; font-weight: 700; letter-spacing: 0.08em; color: %s;">{{c.kind}}</span>
        <span style="flex-grow: 1; font-size: 15px; color: {{c.tone2}};">{{c.covered}}</span>
      </div>
    </sc-for>
  </div>
""" % (GREY, CARD, MONO, GREY))

# The expensive one, priced out loud on the screen that sells it.
ms.append(section('Stricter on a monk day', top=26))
ms.append("""  <p style="flex: none; margin: 8px 20px 0; font-size: 13.5px; line-height: 1.48; color: %s;">Your target on the left, the monk bar on the right.</p>
  <div style="flex: none; margin: 14px 20px 0; border-radius: 14px; background: %s; overflow: hidden;">
    <sc-for list="{{bars}}" as="b" hint-placeholder-count="5">
      <div style="padding-left: 16px;">
        <div style="display: flex; align-items: center; gap: 11px; padding: 12px 16px 12px 0; border-top: 0.5px solid {{b.sep}};">
          <span style="flex-grow: 1; font-size: 16px;">{{b.name}}</span>
          <span style="font-family: %s; font-size: 14px; font-weight: 500; color: %s;">{{b.yours}}</span>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="%s" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex: none;"><path d="M5 12h13M13 6.5l5.5 5.5L13 17.5"/></svg>
          <span style="flex: none; min-width: 62px; text-align: right; font-family: %s; font-size: 14px; font-weight: 700; color: {{b.tone}};">{{b.monk}}</span>
        </div>
      </div>
    </sc-for>
  </div>
""" % (GREY, CARD, MONO, GREY, DIM, MONO))

ms.append(section('Also counting', top=26))
ms.append("""  <div style="flex: none; margin: 14px 20px 0; display: flex; flex-wrap: wrap; gap: 8px;">
    <sc-for list="{{extra}}" as="e" hint-placeholder-count="6">
      <span style="display: flex; align-items: center; gap: 7px; padding: 8px 12px; border-radius: 999px; background: {{e.bg}}; border: 1px solid {{e.border}};">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="{{e.tone}}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="{{e.mark}}"/></svg>
        <span style="font-size: 14px; color: {{e.text}};">{{e.name}}</span>
      </span>
    </sc-for>
  </div>
""")

# Invariant 5 applied to a view. A live set would let a setting rewrite the
# past, which nothing in Curfew has ever done.
ms.append("""  <div style="flex: none; margin: 26px 20px 0; display: flex; gap: 11px;">
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="%s" stroke-width="2" stroke-linecap="round" aria-hidden="true" style="flex: none; margin-top: 1px;"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 7.5v.01"/></svg>
    <span style="font-size: 13.5px; line-height: 1.48; color: %s;">Counts from tomorrow.</span>
  </div>
  <div style="flex: none; margin: 22px 20px 0; border-radius: 14px; background: %s; overflow: hidden;">
    <button type="button" style="width: 100%%; border: 0; background: transparent; padding: 15px 16px; text-align: left; font-family: inherit; font-size: 16px; color: %s;">Turn Monk mode off</button>
  </div>
""" % (ORANGE, GREY, CARD, RED))
ms.append(grow())
ms.append(tabbar('Main.dc.html'))
ms.append(logic(H, """  renderVals() {
    const SEP = '""" + SEP + """';
    const TICK = 'M20 6L9 17l-5-5';
    return {
      fixed: ['Sleep', 'No junk food', 'Screen'].map((name, i) => ({ name, sep: i === 0 ? 'transparent' : SEP })),
      cats: [
        { kind: 'BODY',  covered: 'Gym, Cold shower', mark: TICK, tone: '""" + GREEN + """', tone2: '#ffffff' },
        { kind: 'FOOD',  covered: 'No junk food, Water', mark: TICK, tone: '""" + GREEN + """', tone2: '#ffffff' },
        { kind: 'MIND',  covered: 'Reading, Study', mark: TICK, tone: '""" + GREEN + """', tone2: '#ffffff' },
        { kind: 'SLEEP', covered: 'Sleep', mark: TICK, tone: '""" + GREEN + """', tone2: '#ffffff' },
      ],
      bars: [
        { name: 'Water', yours: '8 glasses', monk: '10', tone: '""" + ORANGE + """', sep: 'transparent' },
        { name: 'Screen', yours: 'under 3h', monk: 'under 2h', tone: '""" + ORANGE + """', sep: SEP },
        { name: 'Sleep', yours: 'in bed 10:30 PM', monk: '10:00 PM', tone: '""" + ORANGE + """', sep: SEP },
        { name: 'Reading', yours: '20 min', monk: 'same', tone: '""" + GREY + """', sep: SEP },
        { name: 'Cold shower', yours: 'once', monk: 'same', tone: '""" + GREY + """', sep: SEP },
      ],
      extra: [
        { name: 'Gym', on: true }, { name: 'Cold shower', on: true }, { name: 'Water', on: true },
        { name: 'Reading', on: true }, { name: 'Study', on: true }, { name: 'Nightfast', on: false },
      ].map((e) => ({
        name: e.name, mark: TICK,
        bg: e.on ? 'rgba(255,55,95,0.14)' : 'transparent',
        border: e.on ? 'rgba(255,55,95,0.4)' : '#3a3a3c',
        tone: e.on ? '""" + PINK + """' : 'transparent',
        text: e.on ? '#ffffff' : '""" + GREY + """',
      })),
    };
  }"""))
write('MonkSetup.dc.html', ms)


# ------------------------------------------------- Monk, not available yet ---
# If you do not track something it requires, it does not appear. Not a score
# capped by absent rules, and not 100% over two easy things.
H = 924
ml = [HEAD, root(H)]
ml.append(nav('Main.dc.html', 'Back to Today'))
ml.append("""  <div style="flex: none; padding: 4px 20px 0;">
    <h1 style="margin: 0; font-size: 34px; font-weight: 700; letter-spacing: -0.02em; color: %s;">Monk mode</h1>
    <p style="margin: 14px 0 0; font-size: 18px; line-height: 1.45; font-weight: 500;">You are two short of the four kinds it needs, so there is no number to show you yet.</p>
    <p style="margin: 12px 0 0; font-size: 14.5px; line-height: 1.5; color: %s;">A monk day needs a body, a food, a mind and a sleep.</p>
  </div>
""" % (GREY, GREY))

ml.append("""  <div style="flex: none; margin: 24px 20px 0; display: flex; flex-direction: column; gap: 9px;">
    <sc-for list="{{cats}}" as="c" hint-placeholder-count="4">
      <div style="border-radius: 13px; background: {{c.bg}}; border: 1px solid {{c.border}}; padding: 13px 15px; display: flex; align-items: center; gap: 12px;">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="{{c.tone}}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex: none;"><path d="{{c.mark}}"/></svg>
        <span style="flex: none; width: 58px; font-family: %s; font-size: 11px; font-weight: 700; letter-spacing: 0.08em; color: %s;">{{c.kind}}</span>
        <span style="flex-grow: 1; font-size: 15px; color: {{c.textTone}};">{{c.covered}}</span>
        <sc-if value="{{c.missing}}" hint-placeholder-val="{{false}}">
          <a href="Catalog.dc.html" style="flex: none; height: 30px; padding: 0 12px; border-radius: 999px; background: %s; display: flex; align-items: center; text-decoration: none; color: #ffffff; font-size: 14px; font-weight: 600;">Add</a>
        </sc-if>
      </div>
    </sc-for>
  </div>
""" % (MONO, GREY, PINK))

ml.append("""  <div style="flex: none; margin: 26px 20px 0; border-radius: 14px; background: %s; padding: 16px; display: flex; flex-direction: column; gap: 9px;">
    <span style="font-size: 15.5px; font-weight: 600;">Also compulsory, and you have them</span>
    <div style="display: flex; flex-wrap: wrap; gap: 7px;">
      <sc-for list="{{fixed}}" as="f" hint-placeholder-count="3">
        <span style="display: flex; align-items: center; gap: 6px; padding: 7px 11px; border-radius: 999px; background: %s;">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="%s" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>
          <span style="font-size: 13.5px; color: %s;">{{f.name}}</span>
        </span>
      </sc-for>
    </div>
  </div>

  <p style="flex: none; margin: 20px 20px 0; font-size: 12.5px; line-height: 1.48; color: %s;">Add both and it appears tomorrow.</p>
""" % (CARD, CARD2, GREEN, GREY, GREY))
ml.append(grow())
ml.append("""  <div style="flex: none; padding: 0 20px 22px;">
    <a href="Catalog.dc.html" style="display: flex; align-items: center; justify-content: center; width: 100%%; height: 52px; border-radius: 15px; background: %s; color: #ffffff; text-decoration: none; font-size: 17px; font-weight: 600;">Add what is missing</a>
  </div>
""" % PINK)
ml.append(tabbar('Main.dc.html'))
ml.append(logic(H, """  renderVals() {
    const TICK = 'M20 6L9 17l-5-5', CROSS = 'M6 6l12 12M18 6L6 18';
    const have = (kind, covered) => ({ kind, covered, mark: TICK, tone: '""" + GREEN + """',
      textTone: '#ffffff', bg: '""" + CARD + """', border: 'transparent', missing: false });
    const need = (kind, covered) => ({ kind, covered, mark: CROSS, tone: '""" + ORANGE + """',
      textTone: '""" + GREY + """', bg: 'transparent', border: 'rgba(255,159,10,0.38)', missing: true });
    return {
      cats: [
        have('BODY', 'Gym'),
        need('FOOD', 'Nothing yet. No junk food, or Water.'),
        have('MIND', 'Reading'),
        need('SLEEP', 'Nothing yet. Sleep, or Nightfast.'),
      ],
      fixed: ['Screen'].map((name) => ({ name })),
    };
  }"""))
write('MonkLocked.dc.html', ml)


# -------------------------------------------- the Monk row on Home (1.16) ---
# A percentage, no flame, no "closes at". It is a reading of the day rather
# than a thing to press, so it sits after the activities and before the people.
path = os.path.join(OUT, 'Main.dc.html')
s = io.open(path, encoding='utf-8').read()
anchor = """  <div style="flex: none; margin: 24px 20px 0; display: flex; align-items: baseline; gap: 8px;">
    <span style="flex-grow: 1; font-size: 20px; font-weight: 700; letter-spacing: 0.01em;">Running out of time</span>
  </div>
"""
if anchor not in s or 'Monk.dc.html"' in s:
    raise SystemExit('  Main.dc.html already carries the Monk row')
monk_row = """  <!--
    MONK MODE, 1.16. A reading of the activities above rather than a thing to
    press, so it carries a percentage and none of the furniture of an activity:
    no flame, no "closes at", no button. It cannot be missed, so there is
    nothing here to dread.
  -->
  <a href="Monk.dc.html" style="flex: none; margin: 14px 20px 0; border-radius: 14px; background: #1c1c1e; padding: 14px 16px; display: flex; align-items: center; gap: 14px; text-decoration: none; color: inherit;">
    <span style="flex: none; position: relative; width: 44px; height: 44px;">
      <svg width="44" height="44" viewBox="0 0 44 44" aria-hidden="true">
        <circle cx="22" cy="22" r="18.5" fill="none" stroke="#2c2c2e" stroke-width="5"/>
        <circle cx="22" cy="22" r="18.5" fill="none" stroke="#ff375f" stroke-width="5" stroke-linecap="round" stroke-dasharray="82.5 116.2" transform="rotate(-90 22 22)"/>
      </svg>
    </span>
    <span style="flex-grow: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px;">
      <span style="font-size: 16px; font-weight: 500;">Monk mode</span>
      <span style="font-size: 13px; color: #8e8e93;">5 of 7 counted today</span>
    </span>
    <span style="flex: none; display: flex; align-items: baseline; gap: 1px;">
      <span style="font-family: 'IBM Plex Mono', ui-monospace, monospace; font-size: 22px; font-weight: 700; letter-spacing: -0.02em;">71</span>
      <span style="font-family: 'IBM Plex Mono', ui-monospace, monospace; font-size: 13px; font-weight: 700; color: #8e8e93;">&#37;</span>
    </span>
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#48484a" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex: none;"><polyline points="9 4.5 16.5 12 9 19.5"/></svg>
  </a>

"""
s = s.replace(anchor, monk_row + anchor)

# The board grows by the row plus its margin.
old_root = 'height: 1628px'
assert old_root in s
s = s.replace(old_root, 'height: 1730px')
s = s.replace('"height":1628', '"height":1730')
io.open(path, 'w', encoding='utf-8', newline='').write(s)
print('  %-22s %6d bytes  (Monk row added, 1628 -> 1730)' % ('Main.dc.html', len(s)))
