# -*- coding: utf-8 -*-
"""The consent gate, drawn at its real length.

The copy below is `CONSENT` from `src/server/consent.ts` and `TERMS` from
`src/server/policy.ts`, section for section, plus what v4 adds. The mock had
four bullets where the real screen has nineteen sections, which made a legal
document look like a welcome card.

It is deliberately the tallest board on the canvas. That IS the design: this is
a long thing to read and there is no way around it, and a mock that hides the
length hides the only hard part.
"""
import math
from chrome import *

# ---------------------------------------------------------------------------
# WHAT CURFEW STORES. Ren comes first because he is the change: everything
# under him was already true in v3 and nobody is re-reading it for fun.

STORES = [
    ("REN, THE COACH", [
        "Ren reads everything you log: every check-in, every time, every number, and <b>every photograph you have taken</b>. That is new in this version.",
        "He never decides whether a day counted. Passes, misses, streaks, standing and money are arithmetic over your check-ins and they stay that way.",
        "One switch in Settings turns him off. The tab goes, his lines go, and nothing of yours is sent to a model again.",
        "<b>What he reads leaves Curfew.</b> A summary of your record, and the photographs he needs for it, are sent to a model run by another company. Google and DeepSeek today, and this page is updated if that changes.",
        "He keeps one paragraph about you, rewritten every night, and it is the only thing he carries between conversations. You can read it, edit it and clear it in Settings.",
    ]),
    ("BEFORE ANYTHING ELSE", [
        "You must be 18 or older to use Curfew.",
        "Curfew records what you say you did. It does not check whether it is true, and a streak is a record of what you pressed rather than proof of what you did.",
        "It is not health, fitness, medical or financial advice, and nothing in it is a professional opinion.",
    ]),
    ("WHAT IS RECORDED", [
        "Every check-in you press, with the time the server saw it. Client clocks are never trusted.",
        "The photos you attach, where the activity asks for one.",
        "What you configure: which activities you track, their windows, targets and grace.",
        "Your streaks, and a reputation score for each group you are in.",
        "The paragraph Ren keeps about you. Not what you asked him: he rewrites the summary each night and the previous one is gone.",
    ]),
    ("PHOTOS", [
        "Stored in object storage outside this app, and deleted 90 days after they are taken.",
        "Compressed in your browser before they are uploaded. That re-encode also removes every scrap of metadata, GPS included, so location never leaves your device.",
        "Fetched through short-lived signed links, issued only to you and to members of a group you chose to share that activity's evidence with.",
        "You can delete all of them at any time, in Settings.",
    ]),
    ("REPUTATION", [
        "A score from 0 to 1000 in each group, worked out from whether you passed the periods you share with it.",
        "Sharing fewer of the activities a group accepts sets a ceiling below the top. Sharing more raises it.",
        "Doing nothing for a week starts a slow decay. A high score is a record you keep, not one you reach.",
        "Grace protects a streak. It never protects reputation and it never waives a fine.",
    ]),
    ("A SCORE ONLY YOU SEE", [
        "Curfew also keeps one score for you across everything you track, which nobody else ever sees, in any group or anywhere else.",
        "Its only effect is to set where you start in a group you join. It never touches your score inside a group afterwards.",
        "It exists so that leaving a group and rejoining it cannot be used to escape a bad record.",
    ]),
    ("WHAT A GROUP SEES", [
        "Only the activities you choose to share with it, and only from the day you shared them.",
        "For each of those: whether you passed, your streak, and your score in that group.",
        "Your photos, only if you also ticked evidence for that activity in that group.",
        "<b>A photograph you share with a group is read by that group's coaches too.</b> Sharing a picture is sharing it with the coach behind the person.",
        "Nothing else. An activity you track privately is invisible to every group.",
    ]),
    ("LEAVING A GROUP", [
        "Your streaks, standing and photos stop being visible to it immediately.",
        "Money you owe stays owed, and stays visible to the people you owe it to.",
        "Rejoining starts you fresh in that group, never at your old number.",
    ]),
    ("MONEY", [
        "Fines are a record of what members owe each other. Curfew never collects, holds or moves money.",
        "The ledger is append-only. A correction is a new row, never an edit.",
        "Money owed is never deleted, including when you delete your account.",
    ]),
    ("DELETING", [
        "You can delete your photos, one activity's history, all of it, or your account, in Settings.",
        "Ren's paragraph about you goes with any of those, and you can clear it on its own at any time without turning him off.",
        "Deleting your account removes your name, your email and your history, and you cannot sign in again.",
        "Two things survive. Ledger rows, with your name on them, so the people you owe or who owe you can still see who. And check-in records, with nothing identifying left on them.",
    ]),
    ("WHAT ADMINS SEE", [
        "That you checked in, and how often. Never what you checked in, and never your photos.",
        "An admin can switch whole systems off for everyone. Doing so never rewrites your history.",
    ]),
]

RULES = [
    ("WHO CAN USE IT", [
        "You must be 18 or older to hold an account. If you are not, do not create one.",
        "Accounts are approved by an admin and groups are invite-only. Nobody finds a group by searching, and nobody joins one without being asked.",
        "One account per person. Do not share an account, and do not create one for somebody else.",
    ]),
    ("WHAT YOU MAY NOT POST", [
        "No nudity or sexual content. This is grounds for removal without warning.",
        "No content that identifies, targets or harasses another person.",
        "<b>Nobody else in frame without their agreement.</b> A photograph of another person, taken or shared without them agreeing to it, is grounds for removal.",
        "No violence, no hate, nothing illegal where you are.",
        "Nothing that is not yours to post.",
    ]),
    ("WHAT TO KEEP OUT OF A PHOTO", [
        "Documents, cards, screens, addresses, house numbers, number plates, account numbers, anything with an identifier on it.",
        "Your own face is yours to share, and for some activities it is the honest way to prove the thing. Think about who is in the group before you do.",
        "A photograph is visible to every member of a group you shared that activity's evidence with, for as long as it is stored. Assume you cannot take it back once they have seen it.",
        "Curfew removes location and camera metadata from every photo before it is uploaded, but it cannot remove what is in the picture.",
    ]),
    ("REPORTING AND REMOVAL", [
        "Any member can report a photo or a person. Reports go to admins.",
        "Admins may remove any photo and suspend or permanently ban any account, at their discretion, for anything on this page or anything else they judge harmful.",
        "A ban may be issued without warning where the content is serious.",
        "A banned account cannot sign in. Money owed at the time of a ban stays owed and stays visible to the people it is owed to. A ban is not a way to clear a debt.",
        "Admins can see that you checked in and how often. They cannot see your photos or what you checked in, unless a photo is reported to them.",
    ]),
    ("MONEY IS BETWEEN YOU", [
        "Fines are a record of what members have agreed to owe each other. Curfew never collects, holds, transfers or processes money, and is not a payment service, a lender or an escrow.",
        "Settling is something you do between yourselves, elsewhere. Marking a settlement in Curfew records that you say it happened; it does not move anything.",
        "Curfew takes no fee and no cut, and has no stake in any amount recorded.",
        "Any dispute about money is between the members concerned. Curfew will not arbitrate it and cannot reverse it. The ledger is append-only: a correction is a new entry, never an edit.",
    ]),
    ("WHAT CURFEW DOES NOT PROMISE", [
        "The service is provided as it is, with no warranty of any kind. It may be unavailable, lose data, or stop entirely.",
        "Curfew does not verify that anything anybody records is true. A streak is a record of what somebody pressed, not proof of what they did.",
        "Curfew is not health, fitness, medical or financial advice. Nothing here is a professional opinion, and no admin is acting as one.",
        "You are responsible for your own safety in anything you track. If an activity is a bad idea for you, do not track it.",
        "To the fullest extent the law allows, Curfew and its admins are not liable for any loss, injury, dispute, or damage arising from your use of it, from anything another member does, or from anything anybody posts.",
    ]),
    ("YOUR CONTENT", [
        "What you post stays yours. You give Curfew only what it needs to run: to store your photos, and to show them to the members you chose, for as long as they are kept.",
        "That permission ends when the photo is deleted, whether by you or by the retention sweep.",
        "Deleting a photo hides it from everyone at once and nothing will serve it again. The file itself is removed from storage by the nightly sweep, so it can outlive the deletion by up to a day.",
        "You are responsible for what you post and for having the right to post it.",
    ]),
    ("ENDING IT", [
        "You can delete your account at any time, in Settings, and what survives is listed there before you confirm.",
        "Admins may suspend or remove an account for breaking these rules, or close the service entirely, with notice where that is possible.",
        "Money owed survives all of it.",
    ]),
    ("THE LAW THAT APPLIES", [
        "These rules are governed by the laws of India.",
        "If part of this page turns out to be unenforceable, the rest still stands.",
        "These rules can change. A material change means accepting them again before you can carry on using Curfew.",
    ]),
]

# ---------------------------------------------------------------------------
# HOW IT IS DRAWN. The first version of this was accurate and ugly: nineteen
# sections of naked bullets on black, which is a wall rather than a screen.
#
# The fix is the house idiom it should have used from the start. Every section
# is a CARD with an icon in a tinted chip and its heading in mono, which is how
# every other board on this canvas presents a group of facts. Cards give the
# document rhythm, and rhythm is the only thing that makes six thousand pixels
# of policy readable.
#
# Nothing is hidden behind a disclosure. A consent gate that folds its terms
# away behind taps is the exact dark pattern this app is careful not to be.

ICONS = {
    'REN, THE COACH': 'M12 3.2a8.8 8.8 0 1 0 0 17.6 8.8 8.8 0 0 0 0-17.6M9.2 10.6v1.3M14.8 10.6v1.3M9.3 15.2a3.8 3.8 0 0 0 5.4 0',
    'BEFORE ANYTHING ELSE': 'M12 3.2a8.8 8.8 0 1 0 0 17.6 8.8 8.8 0 0 0 0-17.6M12 11.2v5M12 7.7v.01',
    'WHAT IS RECORDED': 'M4 6h16M4 12h16M4 18h10',
    'PHOTOS': 'M3 8h3l2-3h8l2 3h3v12H3zM12 13m-3.4 0a3.4 3.4 0 1 0 6.8 0 3.4 3.4 0 1 0-6.8 0',
    'REPUTATION': 'M12 3.2 19.5 6v6c0 4.2-3 7.2-7.5 8.8C7.5 19.2 4.5 16.2 4.5 12V6Z',
    'A SCORE ONLY YOU SEE': 'M4 4l16 16M10.6 10.7a2 2 0 0 0 2.8 2.8M6.7 6.9C4.6 8.2 3 10 2.5 12c1.2 3.5 5 6 9.5 6 1.5 0 2.9-.3 4.2-.8M17.6 15.1c1.4-.9 2.5-2 3-3.1-1.2-3.5-5-6-9.5-6-.7 0-1.4.1-2 .2',
    'WHAT A GROUP SEES': 'M9 11.4a3.4 3.4 0 1 0 0-6.8 3.4 3.4 0 0 0 0 6.8M2.5 20a6.5 6.5 0 0 1 13 0M17 9a3 3 0 0 1 0 5M19.5 20a6.5 6.5 0 0 0-3.2-5.2',
    'LEAVING A GROUP': 'M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 16l-4-4 4-4M6 12h10',
    'MONEY': 'M6 4.5h11M6 9h11M15 4.5c0 3.4-2.6 4.8-6 4.8l7 9.7',
    'DELETING': 'M4 7h16M9 7V5h6v2M6.5 7l1 13h9l1-13',
    'WHAT ADMINS SEE': 'M2.5 12c1.2-3.5 5-6 9.5-6s8.3 2.5 9.5 6c-1.2 3.5-5 6-9.5 6s-8.3-2.5-9.5-6M12 9.4a2.6 2.6 0 1 0 0 5.2 2.6 2.6 0 0 0 0-5.2',
    'WHO CAN USE IT': 'M11 11.5a3.8 3.8 0 1 0 0-7.6 3.8 3.8 0 0 0 0 7.6M3.5 20.5a7.5 7.5 0 0 1 11.3-6.5M16 18.5l1.8 1.8 3.7-4',
    'WHAT YOU MAY NOT POST': 'M12 3.2a8.8 8.8 0 1 0 0 17.6 8.8 8.8 0 0 0 0-17.6M5.8 5.8l12.4 12.4',
    'WHAT TO KEEP OUT OF A PHOTO': 'M3 8h3l1.6-2.4M11 5h5l2 3h3v10M3 12v8h13M4 4l16 16M14.4 14.6a3.4 3.4 0 0 1-4.9-4.9',
    'REPORTING AND REMOVAL': 'M5 21V3.5M5 3.5h12l-2.2 4.3L17 12H5',
    'MONEY IS BETWEEN YOU': 'M3 9h18M7 5 3 9l4 4M17 19l4-4-4-4M21 15H3',
    'WHAT CURFEW DOES NOT PROMISE': 'M12 3.5 21.2 19.5H2.8zM12 10v4.2M12 16.8v.01',
    'YOUR CONTENT': 'M6 3h8l4 4v14H6zM14 3v4.2h4',
    'ENDING IT': 'M12 3v8.4M7.4 6.2a7 7 0 1 0 9.2 0',
    'THE LAW THAT APPLIES': 'M12 4.2v15.6M7 19.8h10M12 6.4 5 9.2M12 6.4l7 2.8M5 9.2 2.9 13.6a3 3 0 0 0 4.2 0zM19 9.2l-2.1 4.4a3 3 0 0 0 4.2 0z',
}

# The four sentences that matter most, at the top, in the shape the v5 board
# already had. Somebody who reads nothing else has to hit these.
SUMMARY = [
    (PINK, 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8M4.5 21a7.5 7.5 0 0 1 15 0',
     'Ren reads everything you log',
     'Every check-in, every number, and <b style="color:#ffffff;font-weight:600;">every photograph you have taken</b>. That part is new.'),
    (ORANGE, 'M3 8h3l2-3h8l2 3h3v12H3zM12 13m-3.4 0a3.4 3.4 0 1 0 6.8 0 3.4 3.4 0 1 0-6.8 0',
     'A photo you share is read for them too',
     'Share Food with Wing and Wing&#39;s coaches read your meals the way yours reads them.'),
    (GREEN, 'M20 6L9 17l-5-5',
     'He never decides whether a day counted',
     'Passes, misses, streaks, standing and money are arithmetic over your check-ins.'),
    (GREY, 'M12 3v8.4M7.4 6.2a7 7 0 1 0 9.2 0',
     'Turn him off and off is real',
     'The tab goes, his lines go, and nothing of yours is sent to a model again.'),
]

# ---------------------------------------------------------------------------
# Height, estimated from the copy rather than guessed, then given slack. The
# board has to be taller than its content, and the end of a legal document is
# the worst thing on the canvas to clip.

CHARS_PER_LINE = 49.0
LINE_PX = 20.0
CARD_CHROME = 30 + 13 + 32 + 12          # icon row, gap, padding, gap to the next


def bullet_px(text):
    plain = text.replace('<b>', '').replace('</b>', '')
    return math.ceil(len(plain) / CHARS_PER_LINE) * LINE_PX + 12


def block_px(sections):
    return sum(CARD_CHROME + sum(bullet_px(t) for t in lines) for _, lines in sections)


SUMMARY_PX = 22 + sum(20 + math.ceil(len(b) / 44.0) * 19 + 28 for _, _, _, b in SUMMARY)
H = int((40 + 96 + 130 + SUMMARY_PX + 54 + block_px(STORES) + 54 + block_px(RULES) + 210) * 1.04)

c = [HEAD, root(H)]

# The bar. The one screen in the app with no back control, no tab bar and no way
# around it, so it carries the state of the gate and nothing else.
# No eyebrow over the title. "BEFORE YOU START" above "Before you carry on" is
# the same sentence twice and the second one is better. The mark stays, small,
# because this is the one screen with no chrome of any other kind on it.
c.append("""
  <div style="flex: none; padding: 26px 20px 0;">
    <svg viewBox="0 0 32 32" width="17" height="17" shape-rendering="crispEdges" aria-hidden="true" style="display: block;"><rect x="2" y="2" width="13" height="13" fill="#ffffff"/><rect x="17" y="2" width="13" height="13" fill="#ffffff"/><rect x="2" y="17" width="13" height="13" fill="#ffffff"/></svg>
    <h1 style="margin: 18px 0 0; font-size: 32px; font-weight: 700; letter-spacing: -0.025em; line-height: 1.12;">{{title}}</h1>
    <p style="margin: 12px 0 0; font-size: 14.5px; line-height: 1.5; color: %s;">{{intro}}</p>
  </div>
""" % GREY)

# The summary card.
c.append('  <div style="flex: none; margin: 22px 20px 0; border-radius: 16px; background: %s; overflow: hidden;">\n' % CARD)
for i, (colour, path, head, body) in enumerate(SUMMARY):
    sep = 'transparent' if i == 0 else SEP
    c.append("""    <div style="display: flex; gap: 13px; padding: 15px 16px; border-top: 0.5px solid %s;">
      <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="%s" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex: none; margin-top: 2px;"><path d="%s"/></svg>
      <div style="flex-grow: 1; min-width: 0; display: flex; flex-direction: column; gap: 4px;">
        <span style="font-size: 15px; font-weight: 600; line-height: 1.3;">%s</span>
        <span style="font-size: 13px; line-height: 1.45; color: %s;">%s</span>
      </div>
    </div>
""" % (sep, colour, path, head, GREY, body))
c.append('  </div>\n')


def part(label, note, sections, tint, top):
    """A labelled part, then one card per section. The tint separates the two
    documents at a glance; the label says which is which, so the colour is
    never the only thing carrying it."""
    out = ('  <div style="flex: none; margin: %dpx 20px 0; display: flex; align-items: center; gap: 11px;">\n'
           '    <span style="font-family: %s; font-size: 11.5px; font-weight: 700; letter-spacing: 0.16em; '
           'color: #ffffff;">%s</span>\n'
           '    <span style="flex-grow: 1; height: 1px; background: %s;"></span>\n'
           '    <span style="font-family: %s; font-size: 10.5px; font-weight: 600; color: %s;">%s</span>\n'
           '  </div>\n' % (top, MONO, label, SEP, MONO, DIM, note))
    for heading, lines in sections:
        out += ('  <div style="flex: none; margin: 12px 20px 0; border-radius: 16px; background: %s; '
                'padding: 16px;">\n'
                '    <div style="display: flex; align-items: center; gap: 11px;">\n'
                '      <span style="flex: none; width: 30px; height: 30px; border-radius: 9px; background: %s; '
                'display: flex; align-items: center; justify-content: center;">\n'
                '        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="%s" stroke-width="1.9" '
                'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="%s"/></svg>\n'
                '      </span>\n'
                '      <span style="flex-grow: 1; font-family: %s; font-size: 10.5px; font-weight: 700; '
                'letter-spacing: 0.13em; color: #ffffff;">%s</span>\n'
                '    </div>\n'
                '    <div style="margin-top: 13px; display: flex; flex-direction: column; gap: 12px;">\n'
                % (CARD, tint[0], tint[1], ICONS[heading], MONO, heading))
        for text in lines:
            out += ('      <div style="display: flex; gap: 10px;">\n'
                    '        <span style="flex: none; margin-top: 7px; width: 3px; height: 3px; border-radius: 999px; '
                    'background: %s;"></span>\n'
                    '        <span style="flex-grow: 1; font-size: 12.5px; line-height: 1.6; color: %s;">%s</span>\n'
                    '      </div>\n' % (tint[1], GREY, text))
        out += '    </div>\n  </div>\n'
    return out


c.append(part('WHAT CURFEW STORES', '11 SECTIONS', STORES, ('rgba(255,55,95,0.14)', PINK), 30))
c.append(part('THE RULES', '9 SECTIONS', RULES, ('rgba(255,159,10,0.13)', ORANGE), 34))

c.append(grow())

# THE FOOTER IS PINNED, and the button does not accept until the document has
# been reached the end of.
#
# It is disabled and it SAYS WHY, with a progress line along the top edge of the
# bar. A grey button that will not explain itself is the thing people tap three
# times and then complain about, and on the one screen with no way around it
# that is an unkind place to be silent.
#
# The progress line doubles as the answer to "how much of this is there",
# which on a seven-thousand-pixel document is the first thing anybody wants.
#
# The timezone is collected HERE and nowhere else, because every window, streak
# and fine is judged in it and a wrong one is wrong from the first day.
c.append("""  <div style="flex: none; margin-top: 28px; border-top: 0.5px solid %s; position: relative;">
    <span style="position: absolute; left: 0; top: -1px; height: 2px; width: {{progress}}; background: {{progressTone}};"></span>
    <div style="padding: 20px 20px 30px; display: flex; flex-direction: column; gap: 15px;">
      <div style="display: flex; flex-direction: column; gap: 8px;">
        <label for="zone" style="font-family: %s; font-size: 10px; font-weight: 700; letter-spacing: 0.14em; color: %s;">YOUR TIME ZONE</label>
        <div style="display: flex; align-items: center; gap: 11px; height: 50px; padding: 0 15px; border-radius: 14px; background: %s;">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="%s" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex: none;"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.2 2"/></svg>
          <input id="zone" type="text" value="Asia/Kolkata" readonly style="flex-grow: 1; min-width: 0; border: 0; background: transparent; color: #ffffff; font-family: inherit; font-size: 16px; padding: 0;">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="%s" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex: none;"><polyline points="6 9.5 12 15.5 18 9.5"/></svg>
        </div>
      </div>

      <button type="button" aria-disabled="{{waitingStr}}" style="width: 100%%; height: 54px; border: 0; border-radius: 15px; background: {{buttonBg}}; color: {{buttonFg}}; font-family: inherit; font-size: 17px; font-weight: 600; display: flex; align-items: center; justify-content: center; gap: 9px;">
        <sc-if value="{{waiting}}" hint-placeholder-val="{{true}}">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="{{buttonFg}}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 4.5v14M6 13l6 6 6-6"/></svg>
        </sc-if>
        {{buttonLabel}}
      </button>
      <span style="text-align: center; font-size: 12.5px; line-height: 1.4; color: {{noteTone}};">{{note}}</span>
    </div>
  </div>
""" % (SEP, MONO, GREY, CARD, GREY, DIM))

# A tweak rather than a control, because the two states are one screen and the
# difference between them is three sentences.
c.append(logic(H, """  renderVals() {
    // At the 4.0 release every existing member meets this as a re-accept, and
    // every member after them meets it as a gate. Same document, two framings.
    const returning = this.props.returning ?? false;
    // `read` is the state after somebody reaches the end. Both states are
    // levers rather than controls, because a control on a mock is a feature
    // somebody will ask about.
    const read = this.props.read ?? false;
    return {
      title: returning ? 'Three things changed' : 'Before you carry on',
      intro: returning
        ? 'Curfew has a coach in it now and he reads your photographs. That is a material change, so this needs accepting again. What is new is at the top and the rest is word for word what you accepted before. Read to the end and the button wakes up.'
        : 'Curfew keeps a record of what you say you did, and shows some of it to people you choose. Two things to read: what it stores, and the rules. There is no way past this page and no dismiss on it, and the button at the end only wakes up once you get there.',
      waiting: !read,
      waitingStr: read ? 'false' : 'true',
      progress: read ? '100%' : '34%',
      progressTone: read ? '""" + GREEN + """' : '""" + PINK + """',
      buttonBg: read ? '""" + PINK + """' : '""" + CARD + """',
      buttonFg: read ? '#ffffff' : '""" + DIM + """',
      buttonLabel: read ? 'I am 18 or older, and I agree' : 'Read to the end first',
      note: read
        ? 'Both of these stay in Settings afterwards, always.'
        : 'Two thirds of it left. Nobody is asked to agree to something they have not been shown.',
      noteTone: read ? '""" + DIM + """' : '""" + GREY + """',
    };
  }""", '"returning":{"editor":"boolean","default":false},'
        '"read":{"editor":"boolean","default":false}'))

write('Consent.dc.html', c)
print('    %dpx, %d sections' % (H, len(STORES) + len(RULES)))
