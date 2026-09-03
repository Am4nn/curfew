// The rules, and what Curfew is not responsible for.
//
// This lives in code beside the consent gate for the same reason the privacy
// text does: every claim in it has to stay true as the code changes, and a
// policy nobody can diff quietly stops being accurate.
//
// It is a plainly written document, not a reviewed one. Have a lawyer read it
// before real users, particularly the liability and jurisdiction sections.

/** Where disputes go. Set this to your own city before launch. */
export const JURISDICTION = {
  country: "India",
  city: "Bengaluru",
} as const;

export const MINIMUM_AGE = 18;

export interface PolicySection {
  heading: string;
  lines: string[];
}

export const TERMS: PolicySection[] = [
  {
    heading: "WHO CAN USE IT",
    lines: [
      `You must be ${MINIMUM_AGE} or older to hold an account. If you are not, do not create one.`,
      "Accounts are approved by an admin and groups are invite-only. Nobody finds a group by searching, and nobody joins one without being asked.",
      "One account per person. Do not share an account, and do not create one for somebody else.",
    ],
  },
  {
    heading: "WHAT YOU MAY NOT POST",
    lines: [
      "No nudity or sexual content. This is grounds for removal without warning.",
      "No content that identifies, targets or harasses another person.",
      "**Nobody else in frame without their agreement.** A photograph of another person, taken or shared without them agreeing to it, is grounds for removal.",
      "No violence, no hate, nothing illegal where you are.",
      "Nothing that is not yours to post.",
    ],
  },
  {
    heading: "WHAT TO KEEP OUT OF A PHOTO",
    lines: [
      "Documents, cards, screens, addresses, house numbers, number plates, account numbers, anything with an identifier on it.",
      "Your own face is yours to share, and for some activities it is the honest way to prove the thing. Think about who is in the group before you do.",
      "A photograph is visible to every member of a group you shared that activity's evidence with, for as long as it is stored. Assume you cannot take it back once they have seen it.",
      "Curfew removes location and camera metadata from every photo before it is uploaded, but it cannot remove what is in the picture.",
    ],
  },
  {
    heading: "REPORTING AND REMOVAL",
    lines: [
      "Any member can report a photo or a person. Reports go to admins.",
      "Admins may remove any photo and suspend or permanently ban any account, at their discretion, for anything on this page or anything else they judge harmful.",
      "A ban may be issued without warning where the content is serious.",
      "A banned account cannot sign in. Money owed at the time of a ban stays owed and stays visible to the people it is owed to. A ban is not a way to clear a debt.",
      "Admins can see that you checked in and how often. They cannot see your photos or what you checked in, unless a photo is reported to them.",
    ],
  },
  {
    heading: "MONEY IS BETWEEN YOU",
    lines: [
      "Fines are a record of what members have agreed to owe each other. Curfew never collects, holds, transfers or processes money, and is not a payment service, a lender or an escrow.",
      "Settling is something you do between yourselves, elsewhere. Marking a settlement in Curfew records that you say it happened; it does not move anything.",
      "Curfew takes no fee and no cut, and has no stake in any amount recorded.",
      "Any dispute about money is between the members concerned. Curfew will not arbitrate it and cannot reverse it. The ledger is append-only: a correction is a new entry, never an edit.",
    ],
  },
  {
    heading: "WHAT CURFEW DOES NOT PROMISE",
    lines: [
      "The service is provided as it is, with no warranty of any kind. It may be unavailable, lose data, or stop entirely.",
      "Curfew does not verify that anything anybody records is true. A streak is a record of what somebody pressed, not proof of what they did.",
      "Curfew is not health, fitness, medical or financial advice. Nothing here is a professional opinion, and no admin is acting as one.",
      "You are responsible for your own safety in anything you track. If an activity is a bad idea for you, do not track it.",
      "To the fullest extent the law allows, Curfew and its admins are not liable for any loss, injury, dispute, or damage arising from your use of it, from anything another member does, or from anything anybody posts.",
    ],
  },
  {
    heading: "YOUR CONTENT",
    lines: [
      "What you post stays yours. You give Curfew only what it needs to run: to store your photos, and to show them to the members you chose, for as long as they are kept.",
      "That permission ends when the photo is deleted, whether by you or by the retention sweep.",
      "You are responsible for what you post and for having the right to post it.",
    ],
  },
  {
    heading: "ENDING IT",
    lines: [
      "You can delete your account at any time, in Settings, and what survives is listed there before you confirm.",
      "Admins may suspend or remove an account for breaking these rules, or close the service entirely, with notice where that is possible.",
      "Money owed survives all of it.",
    ],
  },
  {
    heading: "THE LAW THAT APPLIES",
    lines: [
      `These rules are governed by the laws of ${JURISDICTION.country}.`,
      `Any dispute goes to the courts of ${JURISDICTION.city}, ${JURISDICTION.country}.`,
      "If part of this page turns out to be unenforceable, the rest still stands.",
      "These rules can change. A material change means accepting them again before you can carry on using Curfew.",
    ],
  },
];
