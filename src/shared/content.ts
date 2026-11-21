import { formatCredits, formatCreditUsd, formatUsdFromCents, PACKS, PLANS, quoteStill, quoteVideo } from "./economy";

export const stillQuote = quoteStill();
export const draftQuote = quoteVideo("480p", 5);
export const finishQuote = quoteVideo("720p", 5);

export const creditExamples = [
  {
    label: "One still",
    detail: "A reference-capable frame at the catalog still price.",
    credits: formatCredits(stillQuote.millicredits),
    dollars: formatCreditUsd(stillQuote.millicredits),
  },
  {
    label: "5 second draft",
    detail: "480p video. This is the default generate button.",
    credits: formatCredits(draftQuote.millicredits),
    dollars: formatCreditUsd(draftQuote.millicredits),
  },
  {
    label: "5 second finish",
    detail: "720p video. You choose this on purpose. It is a higher quote.",
    credits: formatCredits(finishQuote.millicredits),
    dollars: formatCreditUsd(finishQuote.millicredits),
  },
];

export const pricingFaq = [
  {
    q: "When do monthly credits expire?",
    a: "Plan credits expire at the end of the paid period. A failed renewal grants nothing. Unused plan credits do not roll into the next month.",
  },
  {
    q: "Do packs expire?",
    a: "No. Pack credits stay until you spend them. You need a paid plan to buy a pack. The 1,000 credit pack is locked for the first 24 hours of a new account.",
  },
  {
    q: "Which credits are spent first?",
    a: "Plan credits go first, then other credits that expire soonest, then packs. That way a monthly grant is used before a pack sits behind it.",
  },
  {
    q: "What if a job fails?",
    a: "The credit hold is returned. A finished file you simply dislike stays charged. Make another take at a new quoted price.",
  },
  {
    q: "Can I get a cash refund?",
    a: "Duplicate or mistaken charges can be refunded within 7 days, and only for credits that are still unspent. Those credits are removed in the same step. Cancel keeps the plan until the period ends.",
  },
  {
    q: "Who owns the pictures?",
    a: "Rights follow the provider that made the file. Narrator does not grant a separate commercial-use license. Mock files are samples for trying the product.",
  },
];

export const planCards = (["starter", "maker", "studio"] as const).map((id) => {
  const plan = PLANS[id];
  return {
    ...plan,
    price: formatUsdFromCents(plan.priceCents),
    highlight: id === "maker",
    highlightLabel: "Fits a finished short",
  };
});

export const packCards = (Object.keys(PACKS) as (keyof typeof PACKS)[]).map((id) => {
  const pack = PACKS[id];
  return {
    ...pack,
    price: formatUsdFromCents(pack.priceCents),
    note: pack.minAccountAgeMs > 0 ? "Available 24 hours after the account is created." : "Face value. No auto-refill.",
  };
});

export const landing = {
  kicker: "Direction desk",
  title: "Price the shot before you shoot it.",
  lede:
    "One paragraph becomes scenes, shots, and a camera move. You approve the credit price. Narrator makes the still or the clip.",
  limit:
    "No dialogue, no score, and no commercial clearance. Clips default to 5 seconds at 480p. 720p is a separate quote. Nothing runs past 10 seconds. A failed job returns the hold.",
  pipeline: [
    { n: "01", title: "Brief", body: "One paragraph. Narrator drafts the scenes." },
    { n: "02", title: "Reference cast", body: "Name the person, the place, and the prop. Eight images each." },
    { n: "03", title: "Shot strip", body: "Size, angle, move, and five seconds. Edit any line." },
    { n: "04", title: "Motion take", body: "The quote locks first. A failed job returns the hold." },
  ],
};

export const steps = [
  {
    n: "01",
    title: "Write the brief",
    body: "One paragraph is enough. Narrator drafts scenes and shots with size, angle, movement, and a five second duration you can edit.",
  },
  {
    n: "02",
    title: "Lock the references",
    body: "Add characters, places, and props. Each can hold up to eight images. Those references are named in the prompt for every shot they belong to.",
  },
  {
    n: "03",
    title: "Approve the price",
    body: "A still, a 480p draft, and a 720p finish each show a credit price before the job starts. Credits are held, then captured or returned.",
  },
];

export const legal = {
  terms: [
    "Narrator is a planning and generation desk. You write a brief, edit a shot list, and approve a credit price before a still or a clip is made.",
    "You must give a real email and keep your password private. One person, one account. Verified email is required before any generation.",
    "Credits are a prepaid unit with a face value of $0.05. Plan credits expire at the end of the paid period. Pack credits do not expire. Free accounts receive 15 credits once, after email verification.",
    "A quote is the most you will be charged for that job. If the provider settles lower, the difference is returned. If the provider or Narrator fails the job, the hold is returned. A completed file stays charged.",
    "Output rights follow the provider that rendered the file. Narrator does not promise that a file is cleared for commercial use, and it does not promise a finished film with dialogue, music, and a cut.",
    "Do not upload images you do not have rights to use. Do not ask for content that is illegal. We may freeze generation and publishing if a card payment is disputed.",
    "Optional Drive, Dropbox, and social publishing run only when you ask, and only on Maker and Studio. They are not part of the credit price.",
    "These terms are the product rules for this app. They are not a substitute for advice from your own lawyer.",
  ],
  privacy: [
    "We store the email and password hash you use to sign in, a session cookie, and whether the email is verified.",
    "We store projects, shot lists, reference images you upload, and files the generator writes. Uploads are limited in size and type.",
    "Billing uses Stripe. Narrator stores the Stripe customer id and the credit ledger. Card numbers stay with Stripe.",
    "If you connect a publishing tool, that request is sent only when you press the button, and only to the integration you configured.",
    "We do not sell personal information. Server logs avoid provider tokens and signed media URLs.",
    "You can stop using the account at any time. Cash refunds of unspent credits follow the refund page.",
  ],
  refunds: [
    "A job that fails before a file is delivered returns the reserved credits to the buckets they came from. If those plan credits have already expired, the return is a short 24 hour promo so a provider failure is not a silent loss.",
    "A file that rendered and you do not like stays charged. Order another take. Each take has its own quote.",
    "Cancel in the customer portal. The plan remains until the period ends, then the remaining plan credits expire. Pack credits stay.",
    "Cash refunds are for duplicate or mistaken charges within 7 days, and only for credits that are still unspent. The refund and the credit removal happen together.",
    "A chargeback freezes new generation and publishing until it is resolved.",
  ],
};
