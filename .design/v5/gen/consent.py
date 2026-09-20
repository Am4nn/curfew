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
# Height, estimated from the copy rather than guessed, then given slack. The
# board has to be taller than its content or overflow:hidden eats the end of a
# legal document, which is the worst possible thing to clip.

CHARS_PER_LINE = 50.0
LINE_PX = 20.0


def bullet_px(text):
    plain = text.replace('<b>', '').replace('</b>', '')
    return math.ceil(len(plain) / CHARS_PER_LINE) * LINE_PX + 11


def block_px(sections):
    total = 0
    for heading, lines in sections:
        total += 15 + 11 + sum(bullet_px(t) for t in lines) + 22
    return total


H = int((56 + 30 + 108 + 44 + block_px(STORES) + 44 + block_px(RULES) + 190) * 1.06)

c = [HEAD, root(H)]

# The bar. It is the one screen in the app with no back control, no tab bar and
# no way around it, so the bar carries the state of the gate and nothing else.
c.append("""
  <div style="flex: none; padding: 20px 20px 13px; border-bottom: 0.5px solid %s; display: flex; align-items: center; gap: 10px;">
    <svg viewBox="0 0 32 32" width="15" height="15" shape-rendering="crispEdges" aria-hidden="true" style="flex: none; display: block;"><rect x="2" y="2" width="13" height="13" fill="#ffffff"/><rect x="17" y="2" width="13" height="13" fill="#ffffff"/><rect x="2" y="17" width="13" height="13" fill="#ffffff"/></svg>
    <span style="font-family: %s; font-size: 13px; font-weight: 700; letter-spacing: 0.16em;">{{bar}}</span>
  </div>

  <p style="flex: none; margin: 20px 20px 0; font-size: 13.5px; line-height: 1.6; color: #c7c7cc;">{{intro}}</p>
""" % (SEP, MONO))


def render(label, sections, top):
    out = ('  <div style="flex: none; margin: %dpx 20px 0;"><span style="font-family: %s; font-size: 11.5px; '
           'font-weight: 700; letter-spacing: 0.16em; color: #ffffff;">%s</span></div>\n' % (top, MONO, label))
    for heading, lines in sections:
        out += ('  <div style="flex: none; margin: 22px 20px 0; display: flex; flex-direction: column; gap: 11px;">\n'
                '    <span style="font-family: %s; font-size: 10px; font-weight: 700; letter-spacing: 0.16em; '
                'color: %s;">%s</span>\n' % (MONO, GREY, heading))
        for text in lines:
            out += ('    <div style="display: flex; gap: 10px;">\n'
                    '      <span style="flex: none; font-size: 11px; line-height: 1.7; color: %s;">&bull;</span>\n'
                    '      <span style="flex-grow: 1; font-size: 12.5px; line-height: 1.6; color: %s;">%s</span>\n'
                    '    </div>\n' % (DIM, GREY, text))
        out += '  </div>\n'
    return out


c.append(render('WHAT CURFEW STORES', STORES, 30))
c.append(render('THE RULES', RULES, 36))

c.append(grow())

# The timezone is collected HERE and nowhere else, because every window, streak
# and fine is judged in it and a wrong one is wrong from the first day.
c.append("""  <div style="flex: none; margin-top: 26px; padding: 18px 20px 30px; border-top: 0.5px solid %s; display: flex; flex-direction: column; gap: 14px;">
    <div style="display: flex; flex-direction: column; gap: 7px;">
      <label for="zone" style="font-family: %s; font-size: 10px; font-weight: 700; letter-spacing: 0.14em; color: %s;">YOUR TIME ZONE</label>
      <div style="display: flex; align-items: center; gap: 11px; height: 48px; padding: 0 15px; border-radius: 13px; background: %s;">
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="%s" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex: none;"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.2 2"/></svg>
        <input id="zone" type="text" value="Asia/Kolkata" readonly style="flex-grow: 1; min-width: 0; border: 0; background: transparent; color: #ffffff; font-family: inherit; font-size: 16px; padding: 0;">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="%s" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex: none;"><polyline points="6 9.5 12 15.5 18 9.5"/></svg>
      </div>
      <span style="font-size: 12px; line-height: 1.45; color: %s;">Every window, streak and fine is judged in this zone. A day belongs to you, never to UTC.</span>
    </div>

    <button type="button" style="width: 100%%; height: 54px; border: 0; border-radius: 15px; background: %s; color: #ffffff; font-family: inherit; font-size: 17px; font-weight: 600;">I am 18 or older, and I agree</button>
    <span style="text-align: center; font-size: 12px; color: %s;">Both of these stay in Settings afterwards, always.</span>
  </div>
""" % (SEP, MONO, GREY, CARD, GREY, DIM, GREY, PINK, DIM))

# A tweak rather than a control, because the two states are one screen and the
# difference between them is two sentences.
c.append(logic(H, """  renderVals() {
    // At the 4.0 release every existing member meets this as a re-accept, and
    // every member after them meets it as a gate. Same document, two framings.
    const returning = this.props.returning ?? false;
    return {
      bar: returning ? 'THE RULES HAVE CHANGED' : 'BEFORE YOU START',
      intro: returning
        ? 'Curfew has a coach in it now, and he reads your photographs. That is a material change, so this needs accepting again before you carry on. What is new is at the top; the rest is unchanged.'
        : 'Curfew keeps a record of what you say you did, and shows some of it to people you choose. Two things to read: what it stores, and the rules you are agreeing to. There is no way past this page and no dismiss on it.',
    };
  }""", '"returning":{"editor":"boolean","default":false}'))

write('Consent.dc.html', c)
print('    estimated %dpx' % H)
