# -*- coding: utf-8 -*-
"""The group, in full: shared evidence, the week, the ledger, settings, and the
invite. v3 had all five and the v5 canvas had none of them."""
from chrome import *

# --------------------------------------------------------------- Evidence ---
H = 1150
ev = [HEAD, root(H)]
ev.append(nav('Group.dc.html', 'Back to Wing'))
ev.append(title('What Wing shared', 'Only what each member switched on for this group. Nothing here was collected, all of it was offered.'))

SHOTS = [
    ('Today', [
        ('M', 'Mira', 'Gym', '6:40 PM', GYM, 'STREAK 12'),
        ('A', 'Anya', 'Food', '7:05 PM', FOOD, 'STREAK 6'),
    ]),
    ('Yesterday', [
        ('R', 'Rahul', 'Sleep', '11:20 PM', SLEEP, 'STREAK 24'),
    ]),
]
TINTS = {'M': 'linear-gradient(150deg, #4a7fb8, #27486b)',
         'A': 'linear-gradient(150deg, #b8744a, #70402a)',
         'R': 'linear-gradient(150deg, #6f5ab8, #3b2e6b)'}

for heading, shots in SHOTS:
    ev.append(eyebrow(heading.upper(), GREY, top=24))
    for initial, name, what, when, src, badge in shots:
        ev.append("""  <div style="flex: none; margin: 12px 20px 0; display: flex; flex-direction: column; gap: 9px;">
    <div style="display: flex; align-items: center; gap: 10px;">
      <span style="flex: none; width: 30px; height: 30px; border-radius: 999px; background: %s; display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 600;">%s</span>
      <span style="font-size: 15px; font-weight: 600;">%s</span>
      <span style="font-size: 15px; color: %s;">logged %s</span>
      <span style="flex-grow: 1;"></span>
      <span style="font-family: %s; font-size: 12px; font-weight: 500; color: %s;">%s</span>
    </div>
    <div style="height: 196px; border-radius: 14px; background: %s; position: relative; overflow: hidden;">
      <img src="%s" alt="%s&#39;s %s" style="position: absolute; inset: 0; width: 100%%; height: 100%%; object-fit: cover;">
      <span style="position: absolute; left: 0; right: 0; bottom: 0; height: 74px; background: linear-gradient(to bottom, rgba(0,0,0,0) 0%%, rgba(0,0,0,0.74) 82%%);"></span>
      <span style="position: absolute; left: 12px; bottom: 11px; display: flex; align-items: center; gap: 5px;">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="%s" aria-hidden="true"><path d="M12 2c0 4.2-5 5.2-5 10.2a5 5 0 0 0 10 0c0-2.1-1-3.2-1-3.2s-1 2-2.1 2c-1.1 0 1.1-4.2-1.9-9z"/></svg>
        <span style="font-family: %s; font-size: 11.5px; font-weight: 600; letter-spacing: 0.05em; color: #ffffff;">%s</span>
      </span>
    </div>
  </div>
""" % (TINTS[initial], initial, name, GREY, what, MONO, DIM, when,
       CARD, src, name, what, PINK, MONO, badge))

ev.append("""  <div style="flex: none; margin: 22px 20px 0;">
    <button type="button" style="width: 100%%; height: 46px; border: 1px solid #3a3a3c; border-radius: 13px; background: transparent; color: #ffffff; font-family: inherit; font-size: 15px; font-weight: 500;">Load older</button>
  </div>
  <!--
    Nothing before the day you joined is here, and that is a fix rather than a
    limit: a group used to see a member's whole back catalogue the moment they
    joined.
  -->
  <p style="flex: none; margin: 16px 20px 0; font-size: 12.5px; line-height: 1.48; color: %s;">Wing sees nothing you logged before you joined, and a photograph disappears from here the moment you stop sharing that activity.</p>
""" % GREY)
ev.append(grow())
ev.append(tabbar('Groups.dc.html'))
ev.append(logic(H))
write('Evidence.dc.html', ev)


# ------------------------------------------------------------ Group stats ---
H = 1210
gs = [HEAD, root(H)]
gs.append(nav('Group.dc.html', 'Back to Wing'))
gs.append(title('Wing this week', 'Mon 15 to Sun 21 September. Everything counted here is something a member chose to share.'))

gs.append("""  <div style="flex: none; margin: 20px 20px 0; display: flex; gap: 10px;">
    <sc-for list="{{figures}}" as="f" hint-placeholder-count="3">
      <div style="flex-grow: 1; flex-basis: 0; border-radius: 14px; background: %s; padding: 14px 13px; display: flex; flex-direction: column; gap: 4px;">
        <span style="font-family: %s; font-size: 28px; font-weight: 700; letter-spacing: -0.03em; line-height: 1; color: {{f.tone}};">{{f.value}}</span>
        <span style="font-size: 12px; line-height: 1.3; color: %s;">{{f.label}}</span>
      </div>
    </sc-for>
  </div>
""" % (CARD, MONO, GREY))

# Day by day. One hue, two states, and the count is written on the column
# rather than left to the height, so nothing depends on colour alone.
gs.append(section('Day by day', top=26))
gs.append("""  <div style="flex: none; margin: 14px 20px 0; border-radius: 14px; background: %s; padding: 16px 14px 12px;">
    <div style="display: flex; align-items: flex-end; gap: 7px; height: 124px;">
      <sc-for list="{{days}}" as="d" hint-placeholder-count="7">
        <div style="flex-grow: 1; flex-basis: 0; display: flex; flex-direction: column; align-items: center; gap: 6px; height: 100%%; justify-content: flex-end;">
          <span style="font-family: %s; font-size: 11px; font-weight: 600; color: {{d.tone}};">{{d.count}}</span>
          <span style="width: 100%%; height: {{d.h}}px; border-radius: 4px 4px 0 0; background: {{d.fill}};"></span>
        </div>
      </sc-for>
    </div>
    <div style="margin-top: 8px; display: flex; gap: 7px; border-top: 0.5px solid %s; padding-top: 8px;">
      <sc-for list="{{days}}" as="d" hint-placeholder-count="7">
        <span style="flex-grow: 1; flex-basis: 0; text-align: center; font-family: %s; font-size: 10.5px; font-weight: 600; letter-spacing: 0.04em; color: {{d.labelTone}};">{{d.label}}</span>
      </sc-for>
    </div>
    <span style="display: block; margin-top: 11px; font-size: 12.5px; color: %s;">Out of 21 shared activities a day. Sunday has not finished.</span>
  </div>
""" % (CARD, MONO, SEP, MONO, GREY))

gs.append(section('Who carried it', top=26))
gs.append("""  <div style="flex: none; margin: 14px 20px 0; border-radius: 14px; background: %s; padding: 6px 16px 14px;">
    <sc-for list="{{members}}" as="m" hint-placeholder-count="3">
      <div style="padding-top: 14px; display: flex; flex-direction: column; gap: 7px;">
        <div style="display: flex; align-items: baseline; gap: 8px;">
          <span style="font-size: 15px; font-weight: 500;">{{m.name}}</span>
          <span style="flex-grow: 1;"></span>
          <span style="font-family: %s; font-size: 15px; font-weight: 700;">{{m.pct}}</span>
          <span style="font-size: 12.5px; color: %s;">{{m.of}}</span>
        </div>
        <span style="height: 6px; border-radius: 999px; background: %s; position: relative; overflow: hidden;">
          <span style="position: absolute; left: 0; top: 0; bottom: 0; width: {{m.pct}}; background: {{m.fill}}; border-radius: 999px;"></span>
        </span>
      </div>
    </sc-for>
  </div>
""" % (CARD, MONO, GREY, CARD2))

# Not a scoreboard of failure: it names the ACTIVITY the group finds hard, and
# never the member who missed it most.
gs.append(section('What Wing finds hard', top=26))
gs.append("""  <div style="flex: none; margin: 14px 20px 0; border-radius: 14px; background: %s; overflow: hidden;">
    <sc-for list="{{hard}}" as="h" hint-placeholder-count="3">
      <div style="padding-left: 16px;">
        <div style="display: flex; align-items: center; gap: 12px; padding: 13px 16px 13px 0; border-top: 0.5px solid {{h.sep}};">
          <span style="flex-grow: 1; font-size: 16px; font-weight: 500;">{{h.name}}</span>
          <span style="font-family: %s; font-size: 14px; font-weight: 600; color: {{h.tone}};">{{h.miss}}</span>
          <span style="font-size: 13px; color: %s;">missed</span>
        </div>
      </div>
    </sc-for>
  </div>
  <p style="flex: none; margin: 14px 20px 0; font-size: 12.5px; line-height: 1.48; color: %s;">Counted across the group, never per person. Who missed what is on nobody&#39;s screen but their own.</p>
""" % (CARD, MONO, GREY, GREY))
gs.append(grow())
gs.append(tabbar('Groups.dc.html'))
gs.append(logic(H, """  renderVals() {
    const ON = '""" + PINK + """', OFF = '""" + CARD2 + """', SEP = '""" + SEP + """';
    // Sunday is today and unfinished, so it is drawn flat grey rather than as
    // a short bar: an unfinished day is not a bad day.
    const raw = [
      { label: 'MON', count: 19 }, { label: 'TUE', count: 14 }, { label: 'WED', count: 21 },
      { label: 'THU', count: 18 }, { label: 'FRI', count: 12 }, { label: 'SAT', count: 20 },
      { label: 'SUN', count: 9, running: true },
    ];
    return {
      figures: [
        { value: '113', label: 'passed of 138 shared', tone: '#ffffff' },
        { value: '82%', label: 'of the week held', tone: ON },
        { value: '2', label: 'clean days, all three', tone: '#ffffff' },
      ],
      days: raw.map((d) => ({
        label: d.label, count: d.count,
        h: Math.round((d.count / 21) * 104),
        fill: d.running ? OFF : ON,
        tone: d.running ? '""" + DIM + """' : '#ffffff',
        labelTone: d.running ? '#ffffff' : '""" + GREY + """',
      })),
      members: [
        { name: 'Rahul', pct: '91%', of: '31 of 34', fill: ON },
        { name: 'Mira',  pct: '84%', of: '38 of 45', fill: ON },
        { name: 'Anya',  pct: '73%', of: '44 of 59', fill: ON },
      ],
      hard: [
        { name: 'Gym',     miss: '9', tone: '#ffffff', sep: 'transparent' },
        { name: 'Reading', miss: '7', tone: '#ffffff', sep: SEP },
        { name: 'Water',   miss: '5', tone: '#ffffff', sep: SEP },
      ],
    };
  }"""))
write('GroupStats.dc.html', gs)


# ----------------------------------------------------------------- Ledger ---
# Append-only, so a mistake is a compensating row and never an edit. The
# correction below is drawn as its own entry for exactly that reason.
H = 1130
led = [HEAD, root(H)]
led.append(nav('Standing.dc.html', 'Back to your standing'))
led.append(title('Wing ledger', 'Every entry since the group started. Nothing here is ever edited or removed.'))

led.append("""  <div style="flex: none; margin: 20px 20px 0; border-radius: 14px; background: %s; padding: 16px; display: flex; align-items: baseline; gap: 10px;">
    <div style="flex-grow: 1; display: flex; flex-direction: column; gap: 3px;">
      <span style="font-size: 13px; color: %s;">You are owed</span>
      <span style="font-family: %s; font-size: 30px; font-weight: 700; letter-spacing: -0.02em; color: %s;">&#8377;140</span>
    </div>
    <div style="flex-grow: 1; display: flex; flex-direction: column; gap: 3px;">
      <span style="font-size: 13px; color: %s;">You owe</span>
      <span style="font-family: %s; font-size: 30px; font-weight: 700; letter-spacing: -0.02em;">&#8377;60</span>
    </div>
  </div>
""" % (CARD, GREY, MONO, GREEN, GREY, MONO))

led.append(eyebrow('EVERY ENTRY', GREY, top=26))
led.append("""  <div style="flex: none; margin: 12px 20px 0; border-radius: 14px; background: %s; overflow: hidden;">
    <sc-for list="{{entries}}" as="e" hint-placeholder-count="8">
      <div style="padding-left: 16px;">
        <div style="display: flex; align-items: flex-start; gap: 12px; padding: 13px 16px 13px 0; border-top: 0.5px solid {{e.sep}};">
          <span style="flex: none; margin-top: 3px; width: 7px; height: 7px; border-radius: 999px; background: {{e.dot}};"></span>
          <div style="flex-grow: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px;">
            <div style="display: flex; align-items: center; gap: 7px;">
              <span style="font-size: 15px; font-weight: 500;">{{e.what}}</span>
              <sc-if value="{{e.isCorrection}}" hint-placeholder-val="{{false}}">
                <span style="font-family: %s; font-size: 9.5px; font-weight: 700; letter-spacing: 0.1em; color: %s; border: 1px solid %s; border-radius: 5px; padding: 1px 5px;">CORRECTION</span>
              </sc-if>
            </div>
            <span style="font-size: 13px; line-height: 1.4; color: %s;">{{e.detail}}</span>
          </div>
          <div style="flex: none; display: flex; flex-direction: column; align-items: flex-end; gap: 3px;">
            <span style="font-family: %s; font-size: 15px; font-weight: 600; color: {{e.tone}};">{{e.amount}}</span>
            <span style="font-family: %s; font-size: 11px; color: %s;">{{e.when}}</span>
          </div>
        </div>
      </div>
    </sc-for>
  </div>
  <p style="flex: none; margin: 16px 20px 0; font-size: 12.5px; line-height: 1.48; color: %s;">Curfew moves no money. This is a record of what three people agreed, and settling it is between you.</p>
""" % (CARD, MONO, ORANGE, ORANGE, GREY, MONO, MONO, DIM, GREY))
led.append(grow())
led.append(tabbar('Groups.dc.html'))
led.append(logic(H, """  renderVals() {
    const SEP = '""" + SEP + """';
    const rows = [
      { what: 'Fine settled', detail: 'Anya missed Gym. Split between you and Rahul.',
        amount: '+\\u20b920', tone: '""" + GREEN + """', when: 'SUN 21', dot: '""" + GREEN + """' },
      { what: 'Fine settled', detail: 'You missed Reading. Split between Mira and Anya.',
        amount: '\\u2212\\u20b940', tone: '#ffffff', when: 'SAT 20', dot: '""" + RED + """' },
      { what: 'Fine reversed', detail: 'Friday was inside Mira\\u2019s away days and should never have been charged.',
        amount: '+\\u20b920', tone: '""" + GREEN + """', when: 'SAT 20', dot: '""" + ORANGE + """', isCorrection: true },
      { what: 'Fine settled', detail: 'Mira missed Sleep. Split between you, Rahul and Anya.',
        amount: '+\\u20b913', tone: '""" + GREEN + """', when: 'FRI 19', dot: '""" + GREEN + """' },
      { what: 'Fine uncharged', detail: 'Everybody missed Water, so there was nobody to pay.',
        amount: '\\u20b90', tone: '""" + GREY + """', when: 'THU 18', dot: '""" + DIM + """' },
      { what: 'Fine settled', detail: 'You missed Gym. Split between Mira and Rahul.',
        amount: '\\u2212\\u20b920', tone: '#ffffff', when: 'WED 17', dot: '""" + RED + """' },
      { what: 'Paid in person', detail: 'Rahul marked \\u20b9100 as handed over. Both of you confirmed.',
        amount: '+\\u20b9100', tone: '""" + GREEN + """', when: 'TUE 16', dot: '#ffffff' },
      { what: 'Group started', detail: 'Wing opened with a \\u20b920 fine and grace switched on.',
        amount: '\\u2014', tone: '""" + DIM + """', when: 'JUL 02', dot: '""" + DIM + """' },
    ];
    return { entries: rows.map((r, i) => ({ ...r, sep: i === 0 ? 'transparent' : SEP,
      isCorrection: !!r.isCorrection })) };
  }"""))
write('Ledger.dc.html', led)


# --------------------------------------------------------- Group settings ---
H = 1330
gset = [HEAD, root(H)]
gset.append(nav('Group.dc.html', 'Back to Wing'))
gset.append(title('Wing', 'Three members. You joined 2 July.'))

gset.append(section('What you share here', top=26))
gset.append("""  <p style="flex: none; margin: 8px 20px 0; font-size: 13.5px; line-height: 1.48; color: %s;">Two switches per activity. The first lets Wing see that you did it, the second lets Wing see the photograph.</p>
  <div style="flex: none; margin: 14px 20px 0; border-radius: 14px; background: %s; overflow: hidden;">
    <sc-for list="{{shares}}" as="s" hint-placeholder-count="5">
      <div style="padding-left: 16px;">
        <div style="display: flex; align-items: center; gap: 12px; padding: 13px 16px 13px 0; border-top: 0.5px solid {{s.sep}};">
          <span style="flex-grow: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px;">
            <span style="font-size: 16px; font-weight: 500;">{{s.name}}</span>
            <span style="font-size: 12.5px; color: %s;">{{s.note}}</span>
          </span>
          <button type="button" onClick="{{s.togglePhoto}}" aria-label="Share the photograph" style="flex: none; width: 34px; height: 34px; border-radius: 9px; border: 1px solid {{s.photoBorder}}; background: {{s.photoBg}}; display: flex; align-items: center; justify-content: center;">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="{{s.photoFg}}" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 8h3l2-3h8l2 3h3v12H3z"/><circle cx="12" cy="13" r="3.4"/></svg>
          </button>
          <button type="button" onClick="{{s.toggle}}" role="switch" aria-checked="{{s.onStr}}" aria-label="Share {{s.name}} with Wing" style="flex: none; width: 51px; height: 31px; border-radius: 999px; border: 0; background: {{s.track}}; padding: 0; display: flex; align-items: center; justify-content: {{s.justify}};">
            <span style="width: 27px; height: 27px; margin: 0 2px; border-radius: 999px; background: #ffffff;"></span>
          </button>
        </div>
      </div>
    </sc-for>
  </div>
""" % (GREY, CARD, GREY))

gset.append(section('Who runs Wing', top=26))
gset.append("""  <div style="flex: none; margin: 14px 20px 0; border-radius: 14px; background: %s; overflow: hidden;">
    <sc-for list="{{people}}" as="p" hint-placeholder-count="3">
      <div style="padding-left: 16px;">
        <div style="display: flex; align-items: center; gap: 12px; padding: 12px 16px 12px 0; border-top: 0.5px solid {{p.sep}};">
          <span style="flex: none; width: 32px; height: 32px; border-radius: 999px; background: {{p.tint}}; display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 600;">{{p.initial}}</span>
          <span style="flex-grow: 1; font-size: 16px; font-weight: 500;">{{p.name}}</span>
          <span style="font-family: %s; font-size: 10.5px; font-weight: 700; letter-spacing: 0.08em; color: {{p.roleTone}};">{{p.role}}</span>
        </div>
      </div>
    </sc-for>
  </div>
""" % (CARD, MONO))

gset.append(section('The rules here', top=26))
gset.append("""  <div style="flex: none; margin: 14px 20px 0; border-radius: 14px; background: %s; overflow: hidden;">
    <sc-for list="{{rules}}" as="r" hint-placeholder-count="4">
      <div style="padding-left: 16px;">
        <div style="display: flex; align-items: center; gap: 12px; padding: 13px 16px 13px 0; border-top: 0.5px solid {{r.sep}};">
          <span style="flex-grow: 1; font-size: 16px;">{{r.name}}</span>
          <span style="font-family: %s; font-size: 15px; font-weight: 600; color: {{r.tone}};">{{r.value}}</span>
        </div>
      </div>
    </sc-for>
  </div>
  <p style="flex: none; margin: 12px 20px 0; font-size: 12.5px; line-height: 1.48; color: %s;">Only Mira can change these, and a change she makes today takes effect tomorrow. A day already being judged keeps the rules it started under.</p>
""" % (CARD, MONO, GREY))

gset.append("""  <div style="flex: none; margin: 26px 20px 0; border-radius: 14px; background: %s; overflow: hidden;">
    <button type="button" style="width: 100%%; border: 0; background: transparent; padding: 15px 16px; text-align: left; font-family: inherit; font-size: 16px; color: #ffffff;">Invite somebody</button>
    <button type="button" style="width: 100%%; border: 0; border-top: 0.5px solid %s; background: transparent; padding: 15px 16px; text-align: left; font-family: inherit; font-size: 16px; color: %s;">Leave Wing</button>
  </div>
  <p style="flex: none; margin: 12px 20px 0; font-size: 12.5px; line-height: 1.48; color: %s;">Leaving stops the sharing immediately. What you owe stays on the ledger, because a balance is a record of what two people agreed.</p>
""" % (CARD, SEP, RED, GREY))
gset.append(grow())
gset.append(tabbar('Groups.dc.html'))
gset.append(logic(H, """  constructor(props) {
    super(props);
    this.state = { on: { gym: true, food: true, sleep: true, water: false, reading: true },
                   photo: { gym: true, food: true, sleep: false, water: false, reading: false } };
  }
  renderVals() {
    const ON = '""" + PINK + """', OFF = '""" + CARD2 + """', SEP = '""" + SEP + """';
    const defs = [
      { key: 'gym', name: 'Gym', note: 'Three a week' },
      { key: 'food', name: 'Food', note: 'Three meals, under 2,000 calories' },
      { key: 'sleep', name: 'Sleep', note: 'In bed 10:30 PM, up 6:30 AM' },
      { key: 'water', name: 'Water', note: 'Eight glasses' },
      { key: 'reading', name: 'Reading', note: 'Twenty minutes' },
    ];
    const s = this.state;
    return {
      shares: defs.map((d, i) => {
        const on = s.on[d.key], photo = on && s.photo[d.key];
        return {
          name: d.name, note: d.note, sep: i === 0 ? 'transparent' : SEP,
          track: on ? ON : OFF, justify: on ? 'flex-end' : 'flex-start', onStr: on ? 'true' : 'false',
          photoBg: photo ? ON : 'transparent',
          photoBorder: photo ? ON : (on ? '#3a3a3c' : '#2a2a2c'),
          photoFg: photo ? '#ffffff' : (on ? '""" + GREY + """' : '""" + DIM + """'),
          toggle: () => this.setState({ on: { ...s.on, [d.key]: !on } }),
          togglePhoto: () => { if (on) this.setState({ photo: { ...s.photo, [d.key]: !s.photo[d.key] } }); },
        };
      }),
      people: [
        { initial: 'M', name: 'Mira', role: 'RUNS IT', roleTone: '""" + PINK + """',
          tint: 'linear-gradient(150deg, #4a7fb8, #27486b)', sep: 'transparent' },
        { initial: 'A', name: 'Anya', role: 'MEMBER', roleTone: '""" + GREY + """',
          tint: 'linear-gradient(150deg, #b8744a, #70402a)', sep: SEP },
        { initial: 'Y', name: 'You', role: 'MEMBER', roleTone: '""" + GREY + """',
          tint: 'linear-gradient(150deg, #6f5ab8, #3b2e6b)', sep: SEP },
      ],
      rules: [
        { name: 'Fine for a miss', value: '\\u20b920', tone: '#ffffff', sep: 'transparent' },
        { name: 'Grace a month', value: '2', tone: '#ffffff', sep: SEP },
        { name: 'Away days a month', value: '4', tone: '#ffffff', sep: SEP },
        { name: 'Money', value: 'ON', tone: '""" + PINK + """', sep: SEP },
      ],
    };
  }"""))
write('GroupSettings.dc.html', gset)


# ----------------------------------------------------------------- Invite ---
H = 1080
inv = [HEAD, root(H)]
inv.append("""
  <div style="flex: none; height: 44px; padding: 0 20px; display: flex; align-items: center;">
    <span style="font-family: %s; font-size: 11px; font-weight: 700; letter-spacing: 0.12em; color: %s;">INVITATION</span>
  </div>
""" % (MONO, PINK))
inv.append("""  <div style="flex: none; padding: 4px 20px 0; display: flex; flex-direction: column; align-items: flex-start; gap: 14px;">
    <div style="display: flex; align-items: center;">
      <sc-for list="{{faces}}" as="f" hint-placeholder-count="3">
        <span style="width: 42px; height: 42px; margin-right: -11px; border-radius: 999px; border: 2px solid #000000; background: {{f.tint}}; display: flex; align-items: center; justify-content: center; font-size: 15px; font-weight: 600;">{{f.initial}}</span>
      </sc-for>
    </div>
    <h1 style="margin: 0; font-size: 32px; font-weight: 700; letter-spacing: -0.025em; line-height: 1.15;">Mira asked you<br>to join Wing</h1>
    <span style="font-size: 15px; line-height: 1.45; color: %s;">Three members. A &#8377;20 fine for a miss, split between whoever passed, and two grace a month.</span>
  </div>
""" % GREY)

inv.append(section('What Wing tracks', top=26))
inv.append("""  <p style="flex: none; margin: 8px 20px 0; font-size: 13.5px; line-height: 1.48; color: %s;">Choose what they see. You can change every line of this afterwards, and nothing you logged before today is ever shown to them.</p>
  <div style="flex: none; margin: 14px 20px 0; border-radius: 14px; background: %s; overflow: hidden;">
    <sc-for list="{{rows}}" as="r" hint-placeholder-count="4">
      <div style="padding-left: 16px;">
        <div style="display: flex; align-items: center; gap: 12px; padding: 13px 16px 13px 0; border-top: 0.5px solid {{r.sep}};">
          <span style="flex-grow: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px;">
            <span style="font-size: 16px; font-weight: 500;">{{r.name}}</span>
            <span style="font-size: 12.5px; color: {{r.noteTone}};">{{r.note}}</span>
          </span>
          <sc-if value="{{r.tracked}}" hint-placeholder-val="{{true}}">
            <button type="button" onClick="{{r.toggle}}" role="switch" aria-checked="{{r.onStr}}" aria-label="Share {{r.name}}" style="flex: none; width: 51px; height: 31px; border-radius: 999px; border: 0; background: {{r.track}}; padding: 0; display: flex; align-items: center; justify-content: {{r.justify}};">
              <span style="width: 27px; height: 27px; margin: 0 2px; border-radius: 999px; background: #ffffff;"></span>
            </button>
          </sc-if>
          <!--
            An activity the group tracks and you do not is the interesting case.
            It offers setup rather than a dead switch, because the alternative
            is joining a group and being silently absent from a third of it.
          -->
          <sc-if value="{{r.untracked}}" hint-placeholder-val="{{false}}">
            <a href="Configure.dc.html" style="flex: none; height: 32px; padding: 0 13px; border-radius: 999px; background: %s; display: flex; align-items: center; text-decoration: none; color: #ffffff; font-size: 14px; font-weight: 600;">Set up</a>
          </sc-if>
        </div>
      </div>
    </sc-for>
  </div>
""" % (GREY, CARD, PINK))

inv.append("""  <div style="flex: none; margin: 22px 20px 0; border-radius: 14px; background: %s; padding: 15px 16px; display: flex; gap: 12px;">
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="%s" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex: none; margin-top: 1px;"><path d="M3 8h3l2-3h8l2 3h3v12H3z"/><circle cx="12" cy="13" r="3.4"/></svg>
    <div style="flex-grow: 1; display: flex; flex-direction: column; gap: 4px;">
      <span style="font-size: 15px; font-weight: 600;">Photographs are a separate switch</span>
      <span style="font-size: 13px; line-height: 1.45; color: %s;">Sharing an activity shares that you did it. Sharing the picture is a second decision, per activity, and it means Wing&#39;s coaches read it too.</span>
    </div>
  </div>
""" % (CARD, ORANGE, GREY))

inv.append(grow())
inv.append("""  <div style="flex: none; padding: 0 20px 30px; display: flex; flex-direction: column; gap: 11px;">
    <a href="Group.dc.html" style="display: flex; align-items: center; justify-content: center; width: 100%%; height: 54px; border-radius: 15px; background: %s; color: #ffffff; text-decoration: none; font-size: 17px; font-weight: 600;">Join Wing</a>
    <button type="button" style="width: 100%%; height: 48px; border: 0; background: transparent; color: %s; font-family: inherit; font-size: 16px;">Not now</button>
  </div>
""" % (PINK, GREY))
inv.append(logic(H, """  constructor(props) {
    super(props);
    this.state = { on: { gym: true, sleep: true, food: false } };
  }
  renderVals() {
    const ON = '""" + PINK + """', OFF = '""" + CARD2 + """', SEP = '""" + SEP + """';
    const defs = [
      { key: 'gym', name: 'Gym', note: 'You track this. Three a week.' },
      { key: 'sleep', name: 'Sleep', note: 'You track this. In bed 10:30 PM.' },
      { key: 'food', name: 'Food', note: 'You track this. Three meals a day.' },
    ];
    const s = this.state;
    const rows = defs.map((d, i) => {
      const on = s.on[d.key];
      return { name: d.name, note: d.note, noteTone: '""" + GREY + """', sep: i === 0 ? 'transparent' : SEP,
        tracked: true, untracked: false, onStr: on ? 'true' : 'false',
        track: on ? ON : OFF, justify: on ? 'flex-end' : 'flex-start',
        toggle: () => this.setState({ on: { ...s.on, [d.key]: !on } }) };
    });
    rows.push({ name: 'Cold shower', note: 'Wing tracks this and you do not', noteTone: '""" + ORANGE + """',
      sep: SEP, tracked: false, untracked: true, onStr: 'false', track: OFF, justify: 'flex-start',
      toggle: () => {} });
    return {
      rows,
      faces: [
        { initial: 'M', tint: 'linear-gradient(150deg, #4a7fb8, #27486b)' },
        { initial: 'A', tint: 'linear-gradient(150deg, #b8744a, #70402a)' },
        { initial: 'R', tint: 'linear-gradient(150deg, #6f5ab8, #3b2e6b)' },
      ],
    };
  }"""))
write('Invite.dc.html', inv)
