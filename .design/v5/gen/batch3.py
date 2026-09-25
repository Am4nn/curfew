# -*- coding: utf-8 -*-
"""Everything under You, plus the admin console. Settings, sharing across every
group, notifications, your photographs, deleting your data, away days, ops."""
from chrome import *


def rows_card(rows, margin=14):
    """A grouped list. Each row is (label, value, valueTone, kind, extra)."""
    out = '  <div style="flex: none; margin: %dpx 20px 0; border-radius: 14px; background: %s; overflow: hidden;">\n' % (margin, CARD)
    for i, r in enumerate(rows):
        sep = 'transparent' if i == 0 else SEP
        label, value, tone, href = r
        tail = ''
        if value:
            tail += ('<span style="flex: none; font-family: %s; font-size: 15px; font-weight: 500; color: %s;">%s</span>'
                     % (MONO, tone or GREY, value))
        if href:
            tail += ('<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="%s" stroke-width="2.2" '
                     'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex: none;">'
                     '<polyline points="9 4.5 16.5 12 9 19.5"/></svg>' % DIM)
        inner = ("""      <span style="flex-grow: 1; min-width: 0; display: flex; align-items: center; gap: 11px; padding: 13px 16px 13px 0; border-top: 0.5px solid %s;">
        <span style="flex-grow: 1; font-size: 16px; color: %s;">%s</span>%s
      </span>
""" % (sep, tone if (tone and not value) else '#ffffff', label, tail))
        if href:
            out += '    <a href="%s" style="display: flex; align-items: center; padding-left: 16px; text-decoration: none; color: inherit;">\n%s    </a>\n' % (href, inner)
        else:
            out += '    <div style="display: flex; align-items: center; padding-left: 16px;">\n%s    </div>\n' % inner
    return out + '  </div>\n'


# --------------------------------------------------------------- Settings ---
# Checked row for row against src/app/settings/page.tsx, plus what v4 adds.
# Nothing the real screen has is missing from this one.
H = 1710
st = [HEAD, root(H)]
st.append(nav('Main.dc.html', 'Back to Today'))

# THE PROFILE AND THE SETTINGS ARE ONE PAGE. Two pages would mean two routes to
# remember and a profile screen carrying four facts, which is a screen nobody
# opens twice.
st.append("""  <div style="flex: none; padding: 4px 20px 0; display: flex; align-items: center; gap: 16px;">
    <div style="flex: none; position: relative; width: 76px; height: 76px;">
      <span style="position: absolute; inset: 0; border-radius: 999px; background: linear-gradient(150deg, #6f5ab8, #3b2e6b); display: flex; align-items: center; justify-content: center; font-family: %s; font-size: 28px; font-weight: 700; letter-spacing: 0.02em; color: #ffffff;">AA</span>
      <!-- Initials until there is a photograph. A grey silhouette is a face
           that is not yours, and this app is careful about whose face is where. -->
      <button type="button" aria-label="Change your picture" style="position: absolute; right: -2px; bottom: -2px; width: 28px; height: 28px; border-radius: 999px; border: 2px solid #000000; background: %s; display: flex; align-items: center; justify-content: center; padding: 0;">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 8h3l2-3h8l2 3h3v12H3z"/><circle cx="12" cy="13" r="3.2"/></svg>
      </button>
    </div>
    <div style="flex-grow: 1; min-width: 0; display: flex; flex-direction: column; gap: 4px;">
      <h1 style="margin: 0; font-size: 26px; font-weight: 700; letter-spacing: -0.02em;">Aman Arya</h1>
      <span style="font-size: 13.5px; color: %s;">Joined 2 July &middot; 3 groups</span>
    </div>
  </div>
""" % (MONO, PINK, GREY))

# APPEARANCE. Three states and not two: somebody who wants the phone to decide
# is not choosing dark, and a two-way switch makes them choose anyway.
st.append(eyebrow('APPEARANCE', GREY, top=26))
st.append("""  <div style="flex: none; margin: 12px 20px 0; border-radius: 12px; background: %s; padding: 4px; display: flex; gap: 4px;">
    <sc-for list="{{themes}}" as="t" hint-placeholder-count="3">
      <button type="button" onClick="{{t.pick}}" aria-pressed="{{t.onStr}}" style="flex-grow: 1; flex-basis: 0; height: 38px; border: 0; border-radius: 9px; background: {{t.bg}}; color: {{t.fg}}; font-family: inherit; font-size: 14.5px; font-weight: {{t.weight}}; display: flex; align-items: center; justify-content: center; gap: 7px;">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="{{t.fg}}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="{{t.path}}"/></svg>
        {{t.name}}
      </button>
    </sc-for>
  </div>
""" % CARD)

st.append(eyebrow('YOUR DETAILS', GREY, top=26))
st.append(rows_card([
    ('Name', 'Aman Arya', '#ffffff', None),
    ('Email', '125aryaaman', '#ffffff', None),
    ('Time zone', 'Asia/Kolkata', '#ffffff', None),
    ('Your day starts', '4:00 AM', '#ffffff', None),
], margin=12))
st.append('  <p style="flex: none; margin: 10px 20px 0; font-size: 12.5px; line-height: 1.48; color: %s;">Every window and fine is judged in this zone.</p>\n' % GREY)

st.append(eyebrow('REN AND YOUR FRIENDS', GREY, top=26))
st.append(rows_card([
    ('Ren', 'ON', PINK, 'Switches.dc.html'),
    ('What Ren remembers', '1 paragraph', '#ffffff', 'Memory.dc.html'),
    ('Nudges from friends', 'ON', PINK, 'Switches.dc.html'),
    ('Notifications', '2 devices', '#ffffff', 'Notifs.dc.html'),
], margin=12))

# HOW YOU ARE JUDGED. Repairs and away days sit here rather than on a configure
# screen, because they are rules the app applies to you and not numbers you set.
st.append(eyebrow('HOW YOU ARE JUDGED', GREY, top=26))
st.append(rows_card([
    ('Activities', '7 tracked', '#ffffff', 'Activities.dc.html'),
    ('Monk mode', '71% today', '#ffffff', 'MonkSetup.dc.html'),
    ('Repairs', '2 of 14 left', '#ffffff', 'Restore.dc.html'),
    ('Away days', '2 left this month', '#ffffff', 'Away.dc.html'),
    ('How standing works', None, None, 'Ranks.dc.html'),
], margin=12))

st.append(eyebrow('WHAT OTHERS SEE', GREY, top=26))
st.append(rows_card([
    ('What you share', '3 groups', '#ffffff', 'Sharing.dc.html'),
    ('Your photographs', '148 stored', '#ffffff', 'Photos.dc.html'),
    ('Photo retention', '90 days', GREY, None),
], margin=12))

st.append(eyebrow('YOUR DATA', GREY, top=26))
st.append(rows_card([
    ('Terms, and what Curfew stores', 'accepted 21 Sep', '#ffffff', 'Consent.dc.html'),
    ('Download everything', None, None, 'Data.dc.html'),
    ('Delete data', None, RED, 'Data.dc.html'),
], margin=12))

# The only route into Ops, and it is only here for an account that has one.
st.append(eyebrow('ADMIN', ORANGE, top=26))
st.append(rows_card([
    ('Ops', 'all green', GREEN, 'Admin.dc.html'),
], margin=12))

st.append("""  <div style="flex: none; margin: 26px 20px 0; border-radius: 14px; background: %s; overflow: hidden;">
    <button type="button" style="width: 100%%; border: 0; background: transparent; padding: 15px 16px; text-align: left; font-family: inherit; font-size: 16px; color: %s;">Sign out</button>
  </div>
""" % (CARD, RED))
st.append(grow())
st.append(tabbar('Main.dc.html'))
st.append(logic(H, """  constructor(props) {
    super(props);
    this.state = { theme: 'dark' };
  }
  renderVals() {
    const on = this.state.theme;
    const defs = [
      { key: 'dark',   name: 'Dark',   path: 'M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z' },
      { key: 'light',  name: 'Light',  path: 'M12 4.2v2M12 17.8v2M4.2 12h2M17.8 12h2M6.7 6.7l1.4 1.4M15.9 15.9l1.4 1.4M17.3 6.7l-1.4 1.4M8.1 15.9l-1.4 1.4M12 8.2a3.8 3.8 0 1 0 0 7.6 3.8 3.8 0 0 0 0-7.6z' },
      { key: 'system', name: 'System', path: 'M3 5h18v11H3zM8.5 20h7' },
    ];
    return {
      themes: defs.map((d) => ({
        name: d.name, path: d.path,
        onStr: on === d.key ? 'true' : 'false',
        bg: on === d.key ? '""" + CARD2 + """' : 'transparent',
        fg: on === d.key ? '#ffffff' : '""" + GREY + """',
        weight: on === d.key ? '600' : '400',
        pick: () => this.setState({ theme: d.key }),
      })),
    };
  }"""))
write('Settings.dc.html', st)


# ---------------------------------------------------------------- Sharing ---
# One screen for every group at once, because the question people actually ask
# is "who can see my meals", and that answer is spread across three screens
# otherwise.
H = 1300
sh = [HEAD, root(H)]
sh.append(nav('Settings.dc.html', 'Back to you'))
sh.append(title('What you share', 'On means they see it, photographs included.'))

# Three groups, unrolled, so each one is its own card with its own heading. A
# loop inside a loop is not a shape these artboards are documented to support,
# and the answer here is three blocks rather than a clever one.
GROUPS = [('Wing', '3 members', 'wing'), ('Deep Work', '4 members', 'deep'),
          ('Morning', '2 members, no money', 'morning')]
sh.append("""  <!--
    1.35. THE CEILING IS STATED WHERE THE TOGGLE IS.
    It was explained in four different sentences on four screens, and on none of
    them was there a switch. The number moves to where the decision happens.
  -->
  <div style="flex: none; margin: 20px 20px 0; border-radius: 14px; background: %s; padding: 15px 16px; display: flex; flex-direction: column; gap: 10px;">
    <div style="display: flex; align-items: baseline; gap: 8px;">
      <span style="font-family: %s; font-size: 11px; font-weight: 700; letter-spacing: 0.1em; color: %s;">WHAT SHARING BUYS</span>
    </div>
    <span style="font-size: 13.5px; line-height: 1.5; color: %s;">Your ceiling is the share of a group you share. <span style="color:#ffffff;">Four of five in Wing caps you at 850.</span> Your score settles down, two points a day.</span>
  </div>
""" % (CARD, MONO, GREY, GREY))

for gname, gnote, gkey in GROUPS:
    sh.append("""  <div style="flex: none; margin: 24px 20px 0;">
    <div style="display: flex; align-items: baseline; gap: 9px;">
      <span style="font-size: 20px; font-weight: 700; letter-spacing: 0.01em;">%s</span>
      <span style="font-size: 13px; color: %s;">%s</span>
    </div>
    <div style="margin-top: 12px; border-radius: 14px; background: %s; overflow: hidden;">
      <sc-for list="{{%s}}" as="r" hint-placeholder-count="4">
        <div style="padding-left: 16px;">
          <div style="display: flex; align-items: center; gap: 11px; padding: 11px 16px 11px 0; border-top: 0.5px solid {{r.sep}};">
            <span style="flex-grow: 1; font-size: 16px; color: {{r.tone}};">{{r.name}}</span>
            <span role="switch" aria-checked="{{r.onStr}}" style="flex: none; width: 46px; height: 28px; border-radius: 999px; background: {{r.track}}; display: flex; align-items: center; justify-content: {{r.justify}};">
              <span style="width: 24px; height: 24px; margin: 0 2px; border-radius: 999px; background: #ffffff;"></span>
            </span>
          </div>
        </div>
      </sc-for>
    </div>
  </div>
""" % (gname, GREY, gnote, CARD, gkey))

sh.append("""  <p style="flex: none; margin: 20px 20px 0; font-size: 12.5px; line-height: 1.48; color: %s;">Stops now and takes back what was sent. They have already seen them.</p>
""" % GREY)
sh.append(grow())
sh.append(tabbar('Main.dc.html'))
sh.append(logic(H, """  renderVals() {
    const ON = '""" + PINK + """', OFF = '""" + CARD2 + """', SEP = '""" + SEP + """';
    // 1.33: one switch. The second flag is still written, and it is written
    // from this one, so what a past period was judged against is untouched.
    const paint = (rows) => rows.map(([name, on], i) => ({
      name, sep: i === 0 ? 'transparent' : SEP,
      tone: on ? '#ffffff' : '#8e8e93',
      onStr: on ? 'true' : 'false',
      track: on ? ON : OFF, justify: on ? 'flex-end' : 'flex-start',
    }));
    return {
      // 1.29: Monk mode has a share toggle like anything else. It is
      // comparable between members only because 1.16's requirements make it
      // mean the same thing for everybody, which was the point of them. No
      // camera switch on it: there is no photograph, only a percentage.
      wing: paint([['Monk mode', true, false], ['Gym', true, true], ['Food', true, true], ['Sleep', true, false], ['Water', false, false]]),
      deep: paint([['Study', true, true], ['Screen', true, false], ['Reading', false, false]]),
      morning: paint([['Sleep', true, false], ['Cold shower', true, false]]),
    };
  }"""))
write('Sharing.dc.html', sh)


# ---------------------------------------------------------- Notifications ---
# Quiet hours is a real setting and nothing overrides it, which is the whole
# point of drawing it above the per-activity times rather than below them.
H = 1210
nt = [HEAD, root(H)]
nt.append(nav('Settings.dc.html', 'Back to you'))
nt.append(title('Notifications', 'One notification, one activity.'))

nt.append("""  <div style="flex: none; margin: 20px 20px 0; border-radius: 14px; background: %s; overflow: hidden;">
    <div style="display: flex; align-items: center; gap: 12px; padding: 14px 16px;">
      <span style="flex-grow: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px;">
        <span style="font-size: 16px; font-weight: 500;">Remind me before a window closes</span>
        <span style="font-size: 12.5px; color: %s;">Nothing for what is already done.</span>
      </span>
      <span role="switch" aria-checked="true" style="flex: none; width: 51px; height: 31px; border-radius: 999px; background: %s; display: flex; align-items: center; justify-content: flex-end;">
        <span style="width: 27px; height: 27px; margin: 0 2px; border-radius: 999px; background: #ffffff;"></span>
      </span>
    </div>
    <div style="display: flex; align-items: center; gap: 12px; padding: 14px 16px; border-top: 0.5px solid %s;">
      <span style="flex-grow: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px;">
        <span style="font-size: 16px; font-weight: 500;">Quiet hours</span>
        <span style="font-size: 12.5px; color: %s;">Nothing at all, whatever is open.</span>
      </span>
      <span style="flex: none; display: flex; gap: 6px;">
        <span style="padding: 6px 10px; border-radius: 8px; background: %s; font-family: %s; font-size: 14px; font-weight: 500;">10:30 PM</span>
        <span style="padding: 6px 10px; border-radius: 8px; background: %s; font-family: %s; font-size: 14px; font-weight: 500;">7:00 AM</span>
      </span>
    </div>
  </div>
""" % (CARD, GREY, PINK, SEP, GREY, CARD2, MONO, CARD2, MONO))

nt.append(section('When, per activity', top=26))
nt.append("""  <p style="flex: none; margin: 8px 20px 0; font-size: 13px; line-height: 1.48; color: %s;">Before a window shuts. Three a day at most.</p>
  <div style="flex: none; margin: 14px 20px 0; border-radius: 14px; background: %s; overflow: hidden;">
    <sc-for list="{{acts}}" as="a" hint-placeholder-count="6">
      <div style="padding-left: 16px;">
        <div style="display: flex; align-items: center; gap: 12px; padding: 12px 16px 12px 0; border-top: 0.5px solid {{a.sep}};">
          <span style="flex-grow: 1; font-size: 16px; color: {{a.tone}};">{{a.name}}</span>
          <span style="font-family: %s; font-size: 14px; font-weight: 500; color: {{a.valueTone}};">{{a.value}}</span>
          <span role="switch" aria-checked="{{a.onStr}}" style="flex: none; width: 46px; height: 28px; border-radius: 999px; background: {{a.track}}; display: flex; align-items: center; justify-content: {{a.justify}};">
            <span style="width: 24px; height: 24px; margin: 0 2px; border-radius: 999px; background: #ffffff;"></span>
          </span>
        </div>
      </div>
    </sc-for>
  </div>
""" % (GREY, CARD, MONO))

# The register on a lock screen is the opposite of the register on a screen,
# and this is the only place in the app that says so out loud.
nt.append(section('What one sounds like', top=26))
nt.append("""  <div style="flex: none; margin: 14px 20px 0; border-radius: 16px; background: #161618; border: 0.5px solid rgba(255,255,255,0.09); padding: 14px 15px; display: flex; gap: 12px;">
    <span style="flex: none; width: 34px; height: 34px; border-radius: 9px; background: %s; display: flex; align-items: center; justify-content: center;"><svg viewBox="0 0 32 32" width="19" height="19" shape-rendering="crispEdges" aria-hidden="true" style="display: block;"><rect x="2" y="2" width="13" height="13" fill="#ffffff"/><rect x="17" y="2" width="13" height="13" fill="#ffffff"/><rect x="2" y="17" width="13" height="13" fill="#ffffff"/></svg></span>
    <div style="flex-grow: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px;">
      <div style="display: flex; align-items: baseline; gap: 7px;">
        <span style="font-size: 13.5px; font-weight: 600;">Curfew</span>
        <span style="flex-grow: 1;"></span>
        <span style="font-family: %s; font-size: 11.5px; color: %s;">now</span>
      </div>
      <span style="font-size: 14.5px; font-weight: 600;">Don&#39;t break a 24 day streak</span>
      <span style="font-size: 14px; line-height: 1.4; color: #c7c7cc;">Reading shuts at 11:59 PM. Rahul and Priya already logged theirs.</span>
    </div>
  </div>
  <div style="flex: none; margin: 14px 20px 0;">
    <button type="button" style="width: 100%%; height: 46px; border: 1px solid #3a3a3c; border-radius: 13px; background: transparent; color: #ffffff; font-family: inherit; font-size: 15px; font-weight: 500;">Send me a test</button>
  </div>
  <p style="flex: none; margin: 14px 20px 0; font-size: 12.5px; line-height: 1.48; color: %s;">Progress comes from the activity, in its own words.</p>
""" % (PINK, MONO, DIM, GREY))
nt.append(grow())
nt.append(tabbar('Main.dc.html'))
nt.append(logic(H, """  renderVals() {
    const ON = '""" + PINK + """', OFF = '""" + CARD2 + """', SEP = '""" + SEP + """';
    const defs = [
      { name: 'Water', on: true, value: '45 min' },
      { name: 'Sleep', on: true, value: '30 min' },
      { name: 'Food', on: true, value: '60 min' },
      { name: 'Reading', on: true, value: '30 min' },
      { name: 'Gym', on: false, value: 'off' },
      { name: 'Supplements', on: false, value: 'off' },
    ];
    return {
      acts: defs.map((d, i) => ({
        name: d.name, value: d.value, sep: i === 0 ? 'transparent' : SEP,
        tone: d.on ? '#ffffff' : '""" + GREY + """',
        valueTone: d.on ? '#ffffff' : '""" + DIM + """',
        onStr: d.on ? 'true' : 'false',
        track: d.on ? ON : OFF, justify: d.on ? 'flex-end' : 'flex-start',
      })),
    };
  }"""))
write('Notifs.dc.html', nt)


# ----------------------------------------------------------- Your photos ---
H = 1120
ph = [HEAD, root(H)]
ph.append(nav('Settings.dc.html', 'Back to you'))
ph.append(title('Your photographs', '148, newest first. Yours alone.'))

ph.append("""  <div style="flex: none; margin: 20px 20px 0; border-radius: 14px; background: %s; padding: 14px 16px; display: flex; gap: 12px;">
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="%s" stroke-width="2" stroke-linecap="round" aria-hidden="true" style="flex: none; margin-top: 1px;"><circle cx="12" cy="12" r="9"/><path d="M12 7.6v5l3 2"/></svg>
    <span style="flex-grow: 1; font-size: 13.5px; line-height: 1.48; color: %s;">Deleted 90 days after it was taken.</span>
  </div>
""" % (CARD, ORANGE, GREY))

GRID = [('TODAY', [(FOOD, 'Food', '7:04 PM'), (GYM, 'Gym', '6:12 PM')]),
        ('YESTERDAY', [(SLEEP, 'Sleep', '11:20 PM'), (FOOD, 'Food', '8:40 PM'), (GYM, 'Gym', '7:02 PM')]),
        ('FRI 19 SEPTEMBER', [(FOOD, 'Food', '9:10 PM'), (SLEEP, 'Sleep', '10:52 PM'),
                              (GYM, 'Gym', '6:35 PM'), (FOOD, 'Food', '1:20 PM')])]
for heading, items in GRID:
    ph.append(eyebrow(heading, GREY, top=24))
    ph.append('  <div style="flex: none; margin: 10px 20px 0; display: flex; flex-wrap: wrap; gap: 8px;">\n')
    for src, what, when in items:
        ph.append("""    <span style="width: 109px; height: 109px; border-radius: 12px; background: %s; position: relative; overflow: hidden;">
      <img src="%s" alt="%s, %s" style="position: absolute; inset: 0; width: 100%%; height: 100%%; object-fit: cover;">
      <span style="position: absolute; left: 0; right: 0; bottom: 0; height: 44px; background: linear-gradient(to bottom, rgba(0,0,0,0), rgba(0,0,0,0.78));"></span>
      <span style="position: absolute; left: 8px; bottom: 7px; font-family: %s; font-size: 10px; font-weight: 600; letter-spacing: 0.05em; color: #ffffff;">%s</span>
    </span>
""" % (CARD, src, what, when, MONO, what.upper()))
    ph.append('  </div>\n')

ph.append(grow())
ph.append(tabbar('Main.dc.html'))
ph.append(logic(H))
write('Photos.dc.html', ph)


# ------------------------------------------------------------- Your data ---
H = 1080
dt = [HEAD, root(H)]
dt.append(nav('Settings.dc.html', 'Back to you'))
dt.append(title('Your data', 'What Curfew holds. Each of these is final.'))

dt.append(eyebrow('WHAT IS HELD', GREY, top=24))
dt.append("""  <div style="flex: none; margin: 12px 20px 0; border-radius: 14px; background: %s; overflow: hidden;">
    <sc-for list="{{held}}" as="h" hint-placeholder-count="5">
      <div style="padding-left: 16px;">
        <div style="display: flex; align-items: center; gap: 12px; padding: 12px 16px 12px 0; border-top: 0.5px solid {{h.sep}};">
          <span style="flex-grow: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px;">
            <span style="font-size: 16px;">{{h.name}}</span>
            <span style="font-size: 12.5px; color: %s;">{{h.note}}</span>
          </span>
          <span style="font-family: %s; font-size: 16px; font-weight: 600;">{{h.count}}</span>
        </div>
      </div>
    </sc-for>
  </div>
""" % (CARD, GREY, MONO))

DEL = [
    ('Delete every photograph', 'The check-ins stay and so do the streaks. Only the pictures go, from here and from every group.', RED),
    ('Delete your history', 'Every check-in, score, streak and standing. Groups keep their totals and lose your rows.', RED),
    ('Delete your account', 'Everything above, plus the account itself. You cannot sign back in, invitation or not.', RED),
]
dt.append(eyebrow('DELETE', RED, top=26))
dt.append('  <div style="flex: none; margin: 12px 20px 0; border-radius: 14px; background: %s; overflow: hidden;">\n' % CARD)
for i, (label, note, tone) in enumerate(DEL):
    sep = 'transparent' if i == 0 else SEP
    dt.append("""    <button type="button" style="width: 100%%; border: 0; background: transparent; padding: 0 0 0 16px; display: flex; font-family: inherit; text-align: left;">
      <span style="flex-grow: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px; padding: 14px 16px 14px 0; border-top: 0.5px solid %s;">
        <span style="font-size: 16px; color: %s;">%s</span>
        <span style="font-size: 12.5px; line-height: 1.45; color: %s;">%s</span>
      </span>
    </button>
""" % (sep, tone, label, GREY, note))
dt.append('  </div>\n')

dt.append("""  <div style="flex: none; margin: 20px 20px 0; border-radius: 14px; background: %s; padding: 15px 16px; display: flex; gap: 12px;">
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="%s" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex: none; margin-top: 1px;"><path d="M12 2v20M17 6.5C17 4.6 14.8 3.5 12 3.5S7 4.6 7 6.5 9.2 10 12 11s5 2.3 5 4.2-2.2 3.3-5 3.3-5-1.4-5-3.3"/></svg>
    <div style="flex-grow: 1; display: flex; flex-direction: column; gap: 4px;">
      <span style="font-size: 15px; font-weight: 600;">Money is never deleted</span>
      <span style="font-size: 13px; line-height: 1.45; color: %s;">Ledger entries stay. They belong to both of you.</span>
    </div>
  </div>
  <div style="flex: none; margin: 20px 20px 0;">
    <button type="button" style="width: 100%%; height: 48px; border: 1px solid #3a3a3c; border-radius: 13px; background: transparent; color: #ffffff; font-family: inherit; font-size: 15px; font-weight: 500;">Download everything first</button>
  </div>
""" % (CARD, GREY, GREY))
dt.append(grow())
dt.append(tabbar('Main.dc.html'))
dt.append(logic(H, """  renderVals() {
    const SEP = '""" + SEP + """';
    const rows = [
      { name: 'Check-ins', note: 'Every press, since 2 July', count: '2,914' },
      { name: 'Photographs', note: 'Live camera only, 90 day retention', count: '148' },
      { name: 'Scores and streaks', note: 'All of it rebuildable from the check-ins', count: '1,206' },
      { name: 'Groups', note: 'Wing, Deep Work, Morning', count: '3' },
      { name: 'Ledger entries', note: 'Append-only, never edited', count: '61' },
    ];
    return { held: rows.map((r, i) => ({ ...r, sep: i === 0 ? 'transparent' : SEP })) };
  }"""))
write('Data.dc.html', dt)


# ------------------------------------------------------------- Away days ---
# Declared in advance and capped, so it is a plan rather than an excuse made
# after a miss. A repair is the one you spend afterwards, and it is a different
# thing on a different screen.
H = 1010
aw = [HEAD, root(H)]
aw.append(nav('Settings.dc.html', 'Back to you'))
aw.append(title('Away days', 'Declared in advance. Those days do not count against you.'))

aw.append("""  <div style="flex: none; margin: 22px 20px 0; border-radius: 16px; background: %s; padding: 18px 16px; display: flex; align-items: center; gap: 16px;">
    <div style="flex: none; display: flex; flex-direction: column; align-items: center;">
      <span style="font-family: %s; font-size: 40px; font-weight: 700; letter-spacing: -0.03em; line-height: 1;">2</span>
      <span style="margin-top: 3px; font-family: %s; font-size: 10.5px; font-weight: 600; letter-spacing: 0.08em; color: %s;">LEFT</span>
    </div>
    <div style="flex-grow: 1; display: flex; flex-direction: column; gap: 5px;">
      <span style="font-size: 15.5px; font-weight: 600;">Four a month, two spent</span>
      <span style="font-size: 13px; line-height: 1.45; color: %s;">Resets on 1 October. Unspent days do not carry over.</span>
    </div>
  </div>
""" % (CARD, MONO, MONO, GREY, GREY))

aw.append(section('Coming up', top=26))
aw.append("""  <div style="flex: none; margin: 14px 20px 0; border-radius: 14px; background: %s; overflow: hidden;">
    <sc-for list="{{trips}}" as="t" hint-placeholder-count="2">
      <div style="padding-left: 16px;">
        <div style="display: flex; align-items: center; gap: 12px; padding: 13px 16px 13px 0; border-top: 0.5px solid {{t.sep}};">
          <span style="flex: none; width: 7px; height: 7px; border-radius: 999px; background: {{t.dot}};"></span>
          <span style="flex-grow: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px;">
            <span style="font-size: 16px; font-weight: 500;">{{t.when}}</span>
            <span style="font-size: 12.5px; color: %s;">{{t.note}}</span>
          </span>
          <span style="font-family: %s; font-size: 11px; font-weight: 700; letter-spacing: 0.08em; color: {{t.tone}};">{{t.state}}</span>
        </div>
      </div>
    </sc-for>
  </div>
  <div style="flex: none; margin: 14px 20px 0;">
    <button type="button" style="width: 100%%; height: 50px; border: 0; border-radius: 14px; background: %s; color: #ffffff; font-family: inherit; font-size: 16px; font-weight: 600;">Declare days away</button>
  </div>
""" % (CARD, GREY, MONO, PINK))

aw.append(section('What an away day does', top=26))
aw.append("""  <div style="flex: none; margin: 14px 20px 0; display: flex; flex-direction: column; gap: 13px;">
    <sc-for list="{{effects}}" as="e" hint-placeholder-count="4">
      <div style="display: flex; gap: 11px;">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="{{e.tone}}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex: none; margin-top: 2px;"><path d="{{e.path}}"/></svg>
        <span style="flex-grow: 1; font-size: 14.5px; line-height: 1.45; color: #c7c7cc;">{{e.text}}</span>
      </div>
    </sc-for>
  </div>
  <p style="flex: none; margin: 18px 20px 0; font-size: 12.5px; line-height: 1.48; color: %s;">Your group sees that you are away.</p>
""" % GREY)
aw.append(grow())
aw.append(tabbar('Main.dc.html'))
aw.append(logic(H, """  renderVals() {
    const SEP = '""" + SEP + """', TICK = 'M20 6L9 17l-5-5', CROSS = 'M6 6l12 12M18 6L6 18';
    return {
      trips: [
        { when: 'Fri 26 to Sat 27 September', note: 'Declared 18 September', state: 'BOOKED',
          tone: '""" + PINK + """', dot: '""" + PINK + """', sep: 'transparent' },
        { when: 'Sat 6 September', note: 'Wedding. Spent.', state: 'USED',
          tone: '""" + GREY + """', dot: '""" + DIM + """', sep: SEP },
      ],
      effects: [
        { path: TICK, tone: '""" + GREEN + """', text: 'Nothing scheduled that day is asked of you, and nothing is judged.' },
        { path: TICK, tone: '""" + GREEN + """', text: 'Your streaks hold where they are. They do not go up and they do not break.' },
        { path: TICK, tone: '""" + GREEN + """', text: 'No fine in any group, and you are not counted in anybody else\\u2019s split.' },
        { path: CROSS, tone: '""" + RED + """', text: 'It does not count as a clean day toward IMMACULATE. A day you did not do the work is not a day you did the work.' },
      ],
    };
  }"""))
write('Away.dc.html', aw)


# ----------------------------------------------------------------- Admin ---
# SCHEDULER sits first, above Evidence and Drift, because a job that did not
# run explains every other number under it.
H = 1620
ad = [HEAD, root(H)]
ad.append("""
  <div style="flex: none; height: 44px; padding: 0 20px; display: flex; align-items: center; gap: 9px;">
    <span style="font-family: %s; font-size: 11px; font-weight: 700; letter-spacing: 0.12em; color: %s;">ADMIN</span>
    <span style="flex-grow: 1;"></span>
    <span style="font-family: %s; font-size: 11px; font-weight: 600; letter-spacing: 0.06em; color: %s;">PRODUCTION &middot; 4.0.0</span>
  </div>
""" % (MONO, PINK, MONO, DIM))
ad.append(title('Ops'))

ad.append(eyebrow('SCHEDULER', GREY, top=24))
ad.append("""  <div style="flex: none; margin: 12px 20px 0; border-radius: 14px; background: %s; overflow: hidden;">
    <sc-for list="{{jobs}}" as="j" hint-placeholder-count="3">
      <div style="padding-left: 16px;">
        <div style="display: flex; align-items: center; gap: 12px; padding: 13px 16px 13px 0; border-top: 0.5px solid {{j.sep}};">
          <span style="flex: none; width: 8px; height: 8px; border-radius: 999px; background: {{j.dot}};"></span>
          <span style="flex-grow: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px;">
            <span style="font-size: 16px; font-weight: 500;">{{j.name}}</span>
            <span style="font-family: %s; font-size: 12px; color: %s;">{{j.cron}}</span>
          </span>
          <span style="flex: none; display: flex; flex-direction: column; align-items: flex-end; gap: 2px;">
            <span style="font-family: %s; font-size: 14px; font-weight: 600; color: {{j.tone}};">{{j.ago}}</span>
            <span style="font-size: 11.5px; color: %s;">{{j.state}}</span>
          </span>
        </div>
      </div>
    </sc-for>
  </div>
  <p style="flex: none; margin: 11px 20px 0; font-size: 12.5px; line-height: 1.48; color: %s;">Heartbeats, not deliveries.</p>
""" % (CARD, MONO, DIM, MONO, GREY, GREY))

ad.append(eyebrow('FAILURES, LAST 7 DAYS', GREY, top=26))
ad.append("""  <div style="flex: none; margin: 12px 20px 0; border-radius: 14px; background: %s; padding: 16px; display: flex; align-items: center; gap: 13px;">
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="%s" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>
    <span style="flex-grow: 1; font-size: 15.5px;">Nothing. No job has reported a failure.</span>
  </div>
""" % (CARD, GREEN))

# 1.26. The bill is a fact about the month and it belongs beside the jobs,
# never on a provider dashboard somebody has to remember to open.
ad.append(eyebrow('COACH', GREY, top=26))
ad.append("""  <div style="flex: none; margin: 12px 20px 0; border-radius: 14px; background: %s; overflow: hidden;">
    <sc-for list="{{coach}}" as="c" hint-placeholder-count="4">
      <div style="padding-left: 16px;">
        <div style="display: flex; align-items: center; gap: 12px; padding: 12px 16px 12px 0; border-top: 0.5px solid {{c.sep}};">
          <span style="flex-grow: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px;">
            <span style="font-size: 15.5px;">{{c.name}}</span>
            <span style="font-size: 12px; color: %s;">{{c.note}}</span>
          </span>
          <span style="font-family: %s; font-size: 15px; font-weight: 600; color: {{c.tone}};">{{c.value}}</span>
        </div>
      </div>
    </sc-for>
  </div>
  <div style="flex: none; margin: 12px 20px 0; height: 6px; border-radius: 999px; background: %s; position: relative; overflow: hidden;">
    <span class="fill" style="position: absolute; left: 0; top: 0; bottom: 0; width: 41%%; border-radius: 999px; background: %s;"></span>
  </div>
  <p style="flex: none; margin: 10px 20px 0; font-size: 12.5px; line-height: 1.48; color: %s;">Above the ceiling, Ask Ren stops. Nightly lines carry on.</p>
""" % (CARD, GREY, MONO, CARD2, PINK, GREY))

ad.append(eyebrow('EVIDENCE', GREY, top=26))
ad.append("""  <div style="flex: none; margin: 12px 20px 0; display: flex; gap: 10px;">
    <sc-for list="{{figures}}" as="f" hint-placeholder-count="3">
      <div style="flex-grow: 1; flex-basis: 0; border-radius: 14px; background: %s; padding: 14px 13px; display: flex; flex-direction: column; gap: 4px;">
        <span style="font-family: %s; font-size: 26px; font-weight: 700; letter-spacing: -0.03em; line-height: 1;">{{f.value}}</span>
        <span style="font-size: 12px; line-height: 1.3; color: %s;">{{f.label}}</span>
      </div>
    </sc-for>
  </div>
""" % (CARD, MONO, GREY))

ad.append(eyebrow('DRIFT', GREY, top=26))
ad.append("""  <div style="flex: none; margin: 12px 20px 0; border-radius: 14px; background: %s; overflow: hidden;">
    <sc-for list="{{drift}}" as="d" hint-placeholder-count="5">
      <div style="padding-left: 16px;">
        <div style="display: flex; align-items: center; gap: 12px; padding: 12px 16px 12px 0; border-top: 0.5px solid {{d.sep}};">
          <span style="flex-grow: 1; font-size: 15.5px;">{{d.name}}</span>
          <span style="font-family: %s; font-size: 15px; font-weight: 600; color: {{d.tone}};">{{d.value}}</span>
        </div>
      </div>
    </sc-for>
  </div>
""" % (CARD, MONO))

ad.append(eyebrow('CONTROLS', ORANGE, top=26))
ad.append("""  <div style="flex: none; margin: 12px 20px 0; border-radius: 14px; background: %s; overflow: hidden;">
    <sc-for list="{{controls}}" as="c" hint-placeholder-count="4">
      <div style="padding-left: 16px;">
        <div style="display: flex; align-items: center; gap: 12px; padding: 12px 16px 12px 0; border-top: 0.5px solid {{c.sep}};">
          <span style="flex-grow: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px;">
            <span style="font-size: 16px;">{{c.name}}</span>
            <span style="font-size: 12px; color: %s;">{{c.note}}</span>
          </span>
          <span role="switch" aria-checked="{{c.onStr}}" style="flex: none; width: 46px; height: 28px; border-radius: 999px; background: {{c.track}}; display: flex; align-items: center; justify-content: {{c.justify}};">
            <span style="width: 24px; height: 24px; margin: 0 2px; border-radius: 999px; background: #ffffff;"></span>
          </span>
        </div>
      </div>
    </sc-for>
  </div>
  <p style="flex: none; margin: 11px 20px 0; font-size: 12.5px; line-height: 1.48; color: %s;">Takes effect now. Rewrites nothing.</p>
""" % (CARD, GREY, GREY))
ad.append(grow())
ad.append(logic(H, """  renderVals() {
    const SEP = '""" + SEP + """';
    return {
      jobs: [
        { name: 'Scoring', cron: '0 * * * *  \\u2192  /api/cron/score', ago: '12m', state: 'on time',
          dot: '""" + GREEN + """', tone: '#ffffff', sep: 'transparent' },
        { name: 'Reminders', cron: '*/15 * * * *  \\u2192  /api/cron/remind', ago: '4m', state: 'on time',
          dot: '""" + GREEN + """', tone: '#ffffff', sep: SEP },
        { name: 'Nightly', cron: '0 7 * * *  \\u2192  /api/cron/nightly', ago: '6h 41m', state: 'on time',
          dot: '""" + GREEN + """', tone: '#ffffff', sep: SEP },
        // 1.23: the coach is its OWN schedule, not folded into nightly. A
        // slow provider must not be able to make the full replay, the
        // sweeps and verify run long.
        { name: 'Coach', cron: '0 4 * * *  \u2192  /api/cron/coach', ago: '2h 51m', state: 'on time',
          dot: '""" + GREEN + """', tone: '#ffffff', sep: SEP },
      ],
      figures: [
        { value: '148', label: 'photographs stored' },
        { value: '0', label: 'orphaned in R2' },
        { value: '3', label: 'swept last night' },
      ],
      drift: [
        { name: 'Scores', value: 'none', tone: '""" + GREEN + """', sep: 'transparent' },
        { name: 'Outcomes', value: 'none', tone: '""" + GREEN + """', sep: SEP },
        { name: 'Streaks', value: 'none', tone: '""" + GREEN + """', sep: SEP },
        { name: 'Reputation', value: 'none', tone: '""" + GREEN + """', sep: SEP },
        { name: 'Monk mode', value: 'none', tone: '""" + GREEN + """', sep: SEP },
      ],
      coach: [
        { name: 'Provider', note: 'COACH_PROVIDER, swappable from env', value: 'gemini',
          tone: '#ffffff', sep: 'transparent' },
        { name: 'Calls this month', note: '93 nightly, 218 asked', value: '311',
          tone: '#ffffff', sep: SEP },
        { name: 'Estimated spend', note: 'Against a \u20b9900 ceiling', value: '\u20b9372',
          tone: '#ffffff', sep: SEP },
        { name: 'Hard stop', note: 'Ask Ren off above the ceiling', value: 'ARMED',
          tone: '""" + GREEN + """', sep: SEP },
      ],
      controls: [
        { name: 'Money', note: 'Fines and the ledger, everywhere', on: true, sep: 'transparent' },
        { name: 'Photographs', note: 'Evidence capture and upload', on: true, sep: SEP },
        { name: 'Ren', note: 'The coach, for every account', on: true, sep: SEP },
        { name: 'Nudges', note: 'Member to member notifications', on: true, sep: SEP },
      ].map((c) => ({ ...c, onStr: c.on ? 'true' : 'false',
        track: c.on ? '""" + PINK + """' : '""" + CARD2 + """',
        justify: c.on ? 'flex-end' : 'flex-start' })),
    };
  }"""))
write('Admin.dc.html', ad)
