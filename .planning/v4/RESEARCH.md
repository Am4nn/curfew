# RESEARCH.md — what makes people come back, and what makes them quit

ROADMAP theme 3, first deliverable. Written 2026-09-19.

The roadmap asked for this before any redesign: *"A written read of what Duolingo
actually does, what the evidence says about why it works, and what of it survives
contact with an app built on photographs and fines."*

This file is the evidence. `DIRECTION.md` beside it is what I think we should do
about it. They are separate on purpose, so a later reader can disagree with the
second without losing the first.

---

## 0. The finding that reframes the brief

The brief was "make it dopamine addictive, keep users on the app". The evidence
says the second half of that is the wrong target, and that saying so makes the
product stronger rather than weaker.

Eight months of head-to-head testing of habit trackers found the apps with the
highest 30-day retention share two traits: **fast check-in and visible
progress**. Gamification, journaling and social features were described as
"nice-to-have but doesn't predict whether you'll actually use it"
([habi.app](https://habi.app/insights/best-habit-tracker-apps/)).

That is an uncomfortable result for a redesign brief built around reward loops,
and it is the most actionable thing in this document. The single biggest
retention lever available to Curfew today is probably **how many seconds it
takes to log a glass of water**, and Curfew's answer is currently "open the app,
find the row, open a live camera, take a photo, wait for an upload".

There is a second reason to aim at frequency rather than duration. Curfew's
product is things that happen away from the phone, and the next activity type on
the list is a dopamine detox. An app that maximises time-on-app cannot host that
feature honestly. The defensible target is **return often, leave fast**: many
short sessions, high completion rate, falling median session length.

Nothing else in this file contradicts wanting the app to be compulsive to come
back to. It only says the compulsion should attach to finishing the day, not to
scrolling.

---

## 1. Streaks: the strongest lever and its exact failure mode

### What the numbers say

Duolingo calls streaks "the single most effective retention lever in the
product". Users who reach a 7-day streak retain at **2.4x** the rate of users who
never start one, and are **3.6x** more likely to still be engaged long term
([StriveCloud](https://www.strivecloud.io/duolingo-gamification-explained),
[Deconstructor of Fun](https://duolingo.deconstructoroffun.com/mechanics/streaks)).

Consecutive daily activity builds habit strength faster than the same total
activity spread unevenly across a week. The mechanism is loss aversion: a
100-day streak is an investment, and losing it hurts more than building it felt
good.

Two of Duolingo's own additions are worth noting because both are about
protecting the streak rather than growing it:

- **Streak Freeze** cut churn by **21%** among users at risk of breaking a streak.
- **Streak Wager** lifted day-14 retention by **14%**.

### What breaks

The failure mode is specific and well documented, and it is the most important
paragraph in this file.

> The abstinence violation effect ("what the heck, I already broke it") explains
> why users with **longer** streaks are **more** likely to rage-quit than users
> with short streaks after a single miss.
> ([The Decision Lab](https://thedecisionlab.com/insights/consumer-insights/streak-creep-the-perils-of-too-much-gamification))

The abstinence violation effect (AVE) is a real construct from relapse research,
not a growth-blog coinage. It describes what happens when somebody treats a
single lapse as proof of a permanent flaw: guilt, shame, self-blame, and the
conclusion that the whole project is not achievable. Roughly **40% to 60%** of
people who lapse go on to a full relapse within a year, largely because of that
psychological fallout rather than the lapse itself
([Psychology Today](https://www.psychologytoday.com/us/blog/stigma-addiction-and-mental-health/202309/the-abstinence-violation-effect-and-overcoming-it),
[ScienceDirect overview](https://www.sciencedirect.com/topics/psychology/abstinence-violation)).

What counters it, per the same literature: reframing a lapse as information
rather than verdict, self-compassion, and reaching for support. What feeds it:
shame, and a system that presents no intermediate step between one bad day and
total failure.

So a streak counter is a machine that manufactures loss aversion for 99 days and
then, on day 100, hands the user the exact cognitive setup that predicts
abandonment. Duolingo's Streak Freeze is a patch on this, and the 21% churn
number is the size of the wound.

### The second failure mode

Streak maintenance becomes performative: people do the minimum action to keep the
number alive rather than the thing the number was supposed to represent. The
design answer is that **the unit you count is the biggest decision in the
system**. Set the bar at one trivial tap and you recruit users who do not care
and the streak stops meaning anything.

Curfew is unusually well placed here. Its unit is a photograph inside a window.
That is expensive to fake, which is the whole premise of the product.

### What this means for Curfew

Curfew already has streaks, and it already has the freeze: grace, two a month per
activity tracked, spent by hand after a run has ended. That is a better mechanic
than Duolingo's, because it is deliberate rather than automatic, and CLAUDE.md
already notes that "grace is already a retention mechanic wearing a clerk's
clothes".

What Curfew does **not** have is a designed answer to the AVE moment. Today the
Restore sheet says: *"Only the streak comes back. Your fine and your standing in
every group are untouched, and yesterday stays missed."* Every clause of that is
true and the sequence of them is precisely the shame script the relapse
literature warns about, delivered at the exact moment of maximum quit risk.

**The screen a person sees the morning after a miss is the highest-leverage
screen in the entire app, and right now it is the least designed.**

---

## 2. BeReal: the closest analogue, and it died

BeReal is the nearest thing to Curfew that has ever been popular: a window, a
photograph, no filters, friends only. It is worth studying because it collapsed.

Daily actives fell **61%** from about 15 million in October 2022 to under 6
million by March 2023. Monthly actives went from about 73 million in August 2022
to 33 million by March 2023, and into the 20-millions by late 2023
([Dazed](https://www.dazeddigital.com/life-culture/article/61166/1/why-did-bereal-fail-social-media-instagram-authenticity),
[Platformer](https://platformer.substack.com/p/how-bereal-missed-its-moment)).

Three causes, all of which Curfew can hit:

**Forced engagement became dread.** "The buzz became dreaded, causing immediate
stress when users realised it was time to BeReal", and documenting your day
"started to feel like being forced to document your downfall"
([MakeUseOf](https://www.makeuseof.com/why-people-quitting-bereal/)). This is the
danger of a window somebody else chose.

**Loosening the constraint destroyed the product.** When the two-minute window
became optional, people scheduled their posts around the best moment of the day
and the content became the curated feed BeReal existed to oppose
([The Tab](https://thetab.com/2025/09/23/its-time-to-delete-the-rise-and-fall-of-bereal-the-app-which-once-had-us-in-a-chokehold)).
The constraint *was* the product.

**Nothing to do between windows.** One post a day and a feed of friends' posts
is thin. At peak hype only about **9%** of active Android users opened it daily.

### What this means for Curfew

Curfew's windows are chosen by the member, in their own config, insert-only and
future-dated. That is the structural fix for BeReal's first problem: a window you
set yourself is a commitment, and a window pushed at you is an ambush. This is
already the most valuable thing Curfew owns and it should be made visible rather
than buried in a configure screen.

Curfew's second advantage is that it has something to do between windows, which
BeReal never had: other people's days, money, standing, a record.

The thing to be afraid of is the same dread, arriving through notifications
rather than through the window.

---

## 3. Social accountability: the strongest thing Curfew already has

The effect sizes here are larger than anything in the gamification literature.

Peer support directly affected exercise adherence with an effect size of **59%**,
and self-efficacy at **42%**, with self-efficacy and self-regulation acting as
chain mediators
([PMC](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC9955246/)). Social support
predicts exercise adherence with subjective experience and commitment as
mediators ([PMC](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC9517627/)).

Two structural findings matter for how groups should be shaped:

- **Reciprocal accountability beats one-way.** Mutual visibility creates
  "positive interdependence", which produces more motivation than either solo
  effort or being watched.
- **Small beats large.** Groups of **4 to 6** produce better goal outcomes than
  large online communities or pairs alone
  ([Goals & Progress](https://goalsandprogress.com/leveraging-community-support-for-goal-achievement/)).

### The counter-example: leaderboards

Duolingo's leagues are the cautionary half. They produced an arms race and
widespread cheating, with players posting 1,300 XP in hours against a normal
20-50 XP day, which is discouraging to everyone below them
([Kotaku](https://kotaku.com/duolingo-app-cheats-hacks-leagues-xp-why-duohacker-1850506482),
[Screenshot Media](https://screenshot-media.com/culture/gaming/duolingo-cheating-problem/)).
Users report real anxiety about demotion, and XP farming displaces the learning
the XP was a proxy for.

Curfew already refuses an app-wide leaderboard, and reputation is per group with
the global score visible only to its owner. **The evidence supports that
decision and it should be held.** Ranking three friends who chose each other is
a different object from ranking strangers, and the difference is consent.

### What this means for Curfew

The group is Curfew's strongest asset and it is currently the least alive part of
the product. A member sees their group by navigating to it. The people are behind
a tab.

This is the single clearest argument for the feed on Home that the brief asks
for: it converts the group from a place you visit into a thing that happens to
you.

---

## 4. What actually moves behaviour, as opposed to what retains

Retention mechanics keep somebody opening an app. These are the interventions
with evidence for changing what a person does.

### Implementation intentions ("if-then" plans)

The best-supported cheap intervention in the literature. Specifying *when, where
and how* ("if it is 7am and I am in the kitchen, then I take the supplements")
significantly raises follow-through, and works by attaching the action to a
situational cue so that initiation does not require a decision. Multiple
meta-analyses support it, including for physical activity
([PMC](https://pmc.ncbi.nlm.nih.gov/articles/PMC11920387/),
[Wiley](https://bpspsychub.onlinelibrary.wiley.com/doi/10.1111/joop.12540)).

Two refinements:

- **Mental contrasting** (imagine the outcome, then the obstacle that will
  actually stop you) makes it stronger. The combination, MCII, is the evidenced
  version and has been tested specifically against **bedtime procrastination**
  ([Taylor & Francis](https://www.tandfonline.com/doi/full/10.1080/08870446.2025.2491593)).
- It depends on underlying goal commitment. It does not manufacture motivation,
  it converts existing motivation into action.

**Curfew already stores half of this.** A window is a "when". What it never asks
for is the "where" and the "after what". That is a two-field addition to a screen
that already exists, and it is the highest evidence-to-effort ratio item on this
whole page.

### Commitment devices

The evidence is more mixed than the productivity internet suggests. Commitment
contracts produce meaningful effects on savings; evidence for sustained effects
on exercise and smoking cessation is more limited
([Wikipedia overview](https://en.wikipedia.org/wiki/Commitment_device) and the
meta-analytic material cited there).

Curfew's fines are a commitment device. This says: keep money optional, keep it
IOU-only, and do not build the product on the assumption that the fine is what
works. The photograph and the group are more likely to be the active ingredient.

### Rewards, and when they backfire

Self-determination theory gives the rule that lets us resolve the clerk-versus-
coach argument without hand-waving.

Extrinsic rewards can undermine intrinsic motivation (the overjustification
effect), but this is conditional, not automatic:

> **Rewards promote intrinsic motivation when perceived as informational and
> diminish it when perceived as controlling.**
> ([SDT and gamification meta-analysis](https://link.springer.com/article/10.1007/s11423-023-10337-7))

Gamification can support or thwart the three basic needs (autonomy, competence,
relatedness) depending on how it is done. A meta-analysis found gamification
improves intrinsic motivation and perceived autonomy and relatedness, with
minimal impact on competence. Amotivated users respond to extrinsic rewards that
would be harmful to an already-motivated user.

This is the bridge. **The clerk's register is the informational register.** The
reason Curfew's voice rules exist is the same reason SDT says informational
feedback works. The change we need is not to abandon that, it is to add warmth
and social energy without letting either one start making claims.

### Nudge timing

Just-in-time adaptive intervention (JITAI) is the rigorous version of "send a
notification at the right moment". The rule: an intervention must land when the
person is both **vulnerable** (the behaviour is at risk now) and **receptive**
(able to receive, process and act on it)
([Annals of Behavioral Medicine](https://academic.oup.com/abm/article/52/6/446/4733473)).

Curfew's v3.4 rewrite already implements the vulnerable half well: kinds with
triggers, effective deadlines, quiet hours. What it has no signal for is
receptivity. That is a later refinement, not a v4 blocker, but the vocabulary is
worth adopting now.

---

## 5. Non-punitive design, which is the thing people actually recommend

Finch is "the most consistently recommended app in ADHD, anxiety and depression
communities", and the stated reason is not its gamification. It is that the
design **removes the shame spiral** that standard streak apps trigger. The quit
pattern it avoids is described directly: users "missed one day, opened the app
the next morning, and watched a number they had spent two months building drop to
zero" ([habi.app](https://habi.app/insights/finch-alternatives/)).

Note that this is the same finding as section 1, arrived at from the product side
rather than the clinical side. Two independent sources, one conclusion: **the
morning after a miss decides whether you keep a user.**

The rest of what sustains long-term use, per the same surveys: meaningful
progression rather than raw points, an overarching narrative the features support
each other inside, and social accountability
([Naavik](https://naavik.co/deep-dives/deep-dives-new-horizons-in-gamification/)).

Curfew has an unusually strong narrative available and does not currently tell
it: *you said you would, here is what happened, these people saw it.*

---

## 6. The dopamine detox activity, since it is coming

Worth getting the science right before it is designed, because the popular
framing is wrong and building to the popular framing would produce a feature that
does not work.

- The term comes from Dr Cameron Sepah and was **never** about reducing dopamine.
  It is a cognitive-behavioural method for disengaging from compulsive behaviour
  under overstimulation. The receptor-resensitisation claim is untested in
  healthy users and largely unsupported
  ([News-Medical](https://www.news-medical.net/health/Is-Dopamine-Detoxing-Actually-Backed-by-Science.aspx)).
- **Reduction works about as well as abstinence.** A 2023 study of 619 people
  compared giving up smartphones entirely for a week, cutting use by one hour a
  day, and no change. Both intervention arms showed lower anxiety and depression
  and higher life satisfaction, and **cutting an hour a day worked about as well
  as total abstinence**
  ([BBC Science Focus](https://www.sciencefocus.com/science/dopamine-fasting-smartphone-addiction)).
- Extreme practice risks anxiety and loneliness. Structured, evidenced
  alternatives are brief motivational intervention and contingency management,
  which is roughly what Curfew is.
- The best-evidenced dopaminergic intervention available to anyone is protecting
  sleep, which Curfew already tracks.

**Design consequence: build it as a reduction target, not an abstinence vow.** An
abstinence framing is an AVE machine, and the evidence says it buys nothing over
the reduction framing anyway.

---

## 7. AI as a coach: what the evidence supports today

- LLM coaching for behaviour change is an active and credible research area. A
  motivation-aware LLM coaching framework appeared at CHI 2026
  ([ACM](https://dl.acm.org/doi/full/10.1145/3772318.3791123)); GPTCoach for
  physical activity was at CHI 2025
  ([ACM](https://dl.acm.org/doi/10.1145/3706598.3713819)); Stanford's Bloom took
  a CHI 2026 best paper, and the reported reason is that it **privileges human
  autonomy** ([Stanford Report](https://news.stanford.edu/stories/2026/04/ai-health-coach-mindset)).
- People do form a working attachment to a coaching chatbot and it can carry real
  accountability.
- The consistent caveat across this work, and the one to design around:

  > LLMs should not be designed to replace human connection, but rather to foster
  > motivation and bolster existing relationships with coaches and communities.

- Voice and phone-call accountability products exist commercially already, so the
  far-future idea in the brief is not far-fetched; it is shipping.

### What this means for Curfew

ROADMAP theme 2 already set the boundary and the research agrees with it:
**advisory, never the scorer.** Invariant 2 says scoring reads only `checkin.*`
events; invariant 1 says every derived row is rebuildable from events. A model's
output is neither replayable nor rebuildable, so it can be recorded as an event
and it can never decide whether a day counted.

The more interesting constraint is the autonomy one. The best-reviewed system in
this literature won on **not** taking over. For Curfew that points at a coach
whose job is to hand you back to your group rather than to become the
relationship.

---

## 8. Summary: what to steal, what to refuse

| Source | Steal | Refuse |
|---|---|---|
| Duolingo | Streak as the spine; protection mechanics (freeze/wager shapes); milestone moments; deterministic copy variation | Global leagues, XP farming, guilt mascot, bolted-on mini-game mechanics |
| BeReal | The window, the unedited photograph, simultaneity, full-bleed presentation | A window somebody else chose; and never loosen ours, the constraint is the product |
| Finch | Non-punitive lapse handling, narrative coherence | Pet guilt, cuteness as the only reward |
| Habitica | Small-group co-op challenges | Deep RPG systems that displace the actual habit |
| Beeminder/StickK | Commitment with a real cost | Treating the fine as the main mechanism |
| Relapse literature | Lapse as information, self-compassion at the miss | Any screen where one miss reads as a verdict |
| SDT | Informational feedback; autonomy, competence, relatedness | Controlling rewards, anything that makes the user feel managed |
| JITAI | Vulnerable **and** receptive | Notifying on a schedule regardless of state |

## 9. The five claims I would build on

1. **Fast check-in and visible progress out-predict every reward mechanic.**
   Curfew's check-in is currently slow. Fixing that is worth more than any
   feature in this document.
2. **The morning after a miss is where users are lost.** Two independent
   literatures say so. Curfew's version of that screen currently reads as a
   verdict.
3. **Small reciprocal groups are the strongest behavioural lever Curfew has**,
   and they are currently behind a tab.
4. **If-then plans are the cheapest real intervention available**, and Curfew
   already stores half of one.
5. **Warmth is safe when it is informational and dangerous when it is
   controlling.** That is the rule that decides the voice question, and it is
   not a compromise: it is what the evidence actually says.

Sources are linked inline throughout. Where a number appears without a link, it
comes from the source linked at the end of that paragraph.
