// Single registry for pages. Header, footer, sitemap, and the route test all read this.
// A page file that is not listed here fails the test, which is how we catch orphans.

export const routes = {
  home: "/",
  pricing: "/pricing",
  how: "/how-it-works",
  login: "/login",
  signup: "/signup",
  terms: "/terms",
  privacy: "/privacy",
  refunds: "/refunds",
  app: "/app",
  newProject: "/app/projects/new",
  billing: "/app/billing",
  settings: "/app/settings",
  project: (id: string) => `/app/projects/${encodeURIComponent(id)}`,
} as const;

export type NavItem = { href: string; label: string };

export const headerNav: NavItem[] = [
  { href: routes.how, label: "How it works" },
  { href: routes.pricing, label: "Pricing" },
];

export const footerNav: NavItem[] = [
  { href: routes.home, label: "Home" },
  { href: routes.how, label: "How it works" },
  { href: routes.pricing, label: "Pricing" },
  { href: routes.signup, label: "Create account" },
  { href: routes.login, label: "Log in" },
  { href: routes.terms, label: "Terms" },
  { href: routes.privacy, label: "Privacy" },
  { href: routes.refunds, label: "Refunds" },
];

export const appNav: NavItem[] = [
  { href: routes.app, label: "Projects" },
  { href: routes.newProject, label: "New brief" },
  { href: routes.billing, label: "Billing" },
  { href: routes.settings, label: "Settings" },
];

export type PageKey =
  | "home"
  | "pricing"
  | "how"
  | "login"
  | "signup"
  | "terms"
  | "privacy"
  | "refunds"
  | "app"
  | "newProject"
  | "project"
  | "billing"
  | "settings";

export type PageSpec = {
  key: PageKey;
  path: string;
  canonical: string;
  file: string;
  index: boolean;
  title: string;
  description: string;
};

export const pages: Record<PageKey, PageSpec> = {
  home: {
    key: "home",
    path: routes.home,
    canonical: routes.home,
    file: "src/app/page.tsx",
    index: true,
    title: "Narrator | Price the shot first",
    description:
      "Turn one film brief into scenes, shots, a lens, and a camera move. See the credit price, approve it, then make the still or the five second clip.",
  },
  pricing: {
    key: "pricing",
    path: routes.pricing,
    canonical: routes.pricing,
    file: "src/app/pricing/page.tsx",
    index: true,
    title: "Pricing | Narrator credits",
    description:
      "Compare Narrator Free, Starter at $15, Maker at $29, and Studio at $59. Monthly credits expire at period end. Credit packs do not expire at all.",
  },
  how: {
    key: "how",
    path: routes.how,
    canonical: routes.how,
    file: "src/app/how-it-works/page.tsx",
    index: true,
    title: "How Narrator works",
    description:
      "A Narrator brief becomes scenes, shots, and reference images. You approve a credit price, then a background job makes the still or the clip.",
  },
  login: {
    key: "login",
    path: routes.login,
    canonical: routes.login,
    file: "src/app/login/page.tsx",
    index: true,
    title: "Log in | Narrator",
    description:
      "Log in to Narrator to open your projects, edit shot lists, and spend credits only on stills and clips you have already priced and approved today.",
  },
  signup: {
    key: "signup",
    path: routes.signup,
    canonical: routes.signup,
    file: "src/app/signup/page.tsx",
    index: true,
    title: "Create your Narrator account",
    description:
      "Create a Narrator account to turn a film brief into a shot plan. Verify your email before the first generation. New accounts receive 15 credits.",
  },
  terms: {
    key: "terms",
    path: routes.terms,
    canonical: routes.terms,
    file: "src/app/terms/page.tsx",
    index: true,
    title: "Terms of use | Narrator",
    description:
      "Narrator terms cover accounts, credits, and generation jobs. Rights in the output follow the model provider. There is no blanket commercial license.",
  },
  privacy: {
    key: "privacy",
    path: routes.privacy,
    canonical: routes.privacy,
    file: "src/app/privacy/page.tsx",
    index: true,
    title: "Privacy | Narrator",
    description:
      "What Narrator stores: your account email, projects, reference uploads, generated files, and billing identifiers. We do not sell personal information.",
  },
  refunds: {
    key: "refunds",
    path: routes.refunds,
    canonical: routes.refunds,
    file: "src/app/refunds/page.tsx",
    index: true,
    title: "Refunds | Narrator",
    description:
      "Failed Narrator jobs return their reserved credits. A finished file you simply dislike stays charged. Cash refunds cover unspent credits within 7 days.",
  },
  app: {
    key: "app",
    path: routes.app,
    canonical: routes.app,
    file: "src/app/app/page.tsx",
    index: false,
    title: "Projects | Narrator",
    description:
      "Your Narrator projects, credit balance, and next brief live here. Open a shot list or start from one sentence about the film you want to make.",
  },
  newProject: {
    key: "newProject",
    path: routes.newProject,
    canonical: routes.newProject,
    file: "src/app/app/projects/new/page.tsx",
    index: false,
    title: "New brief | Narrator",
    description:
      "Write one brief and Narrator drafts a shot list you can edit. Choose aspect, film stock, grade, lens family, and lighting before you generate media.",
  },
  project: {
    key: "project",
    path: "/app/projects/[id]",
    canonical: routes.app,
    file: "src/app/app/projects/[id]/page.tsx",
    index: false,
    title: "Shot list | Narrator",
    description:
      "Edit shots, attach reference images, and generate a priced still or clip. Video defaults to 480p. Choosing 720p shows a separate higher quote.",
  },
  billing: {
    key: "billing",
    path: routes.billing,
    canonical: routes.billing,
    file: "src/app/app/billing/page.tsx",
    index: false,
    title: "Billing | Narrator",
    description:
      "See plan credits, pack credits, and expiry dates. Subscribe to Starter, Maker, or Studio, buy a pack, or open the Stripe customer portal anytime.",
  },
  settings: {
    key: "settings",
    path: routes.settings,
    canonical: routes.settings,
    file: "src/app/app/settings/page.tsx",
    index: false,
    title: "Settings | Narrator",
    description:
      "Review your Narrator email, verification status, and plan. Drive, Dropbox, and social publishing stay optional and off the generation path entirely.",
  },
};

export function safeNextPath(value: string | null | undefined): string {
  if (!value) return routes.app;
  if (!value.startsWith("/app")) return routes.app;
  if (value.startsWith("//") || value.includes("\\") || value.includes("://")) return routes.app;
  return value;
}
