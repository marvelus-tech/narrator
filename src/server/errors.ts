export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message?: string,
  ) {
    super(message ?? code);
    this.name = "ApiError";
  }
}

const messages: Record<string, string> = {
  origin_required: "This action has to come from the Nr8tr site.",
  origin_mismatch: "This action has to come from the Nr8tr site.",
  invalid_body: "That form could not be read.",
  invalid_email: "Enter a valid email address.",
  weak_password: "Use a password of at least 10 characters.",
  email_taken: "An account with that email already exists.",
  invalid_login: "Email or password is wrong.",
  rate_limited: "Too many attempts. Wait a little and try again.",
  unverified_token: "That verification link is invalid or expired.",
  email_unverified: "Verify your email before generating.",
  account_frozen: "This account is frozen while a payment dispute is open.",
  insufficient_credits: "Not enough credits for that quote.",
  price_changed: "The price moved. Refresh the quote and approve it again.",
  concurrency_limit: "Too many jobs are already running for this plan.",
  take_limit: "That plan cannot start that many takes at once.",
  free_daily_video: "Free accounts can start one draft clip per day.",
  daily_ceiling: "Today's provider ceiling for this plan is used up.",
  capacity: "Generation is paused because the server budget is used up.",
  not_found: "That page is not available.",
  no_clips: "Generate a clip before building the silent cut.",
  bad_upload: "Upload a JPEG, PNG, WebP, or GIF under 8 MB.",
  too_many_refs: "An element can hold 8 reference images.",
  project_limit: "This account has reached its project limit.",
  pack_requires_plan: "Packs are for an active paid plan.",
  pack_too_new: "The 1,000 credit pack unlocks 24 hours after signup.",
  billing_unconfigured: "Stripe is not configured. Demo checkout is off in this environment.",
  demo_billing_disabled: "Demo checkout is disabled.",
  no_customer: "Open a checkout once before the customer portal.",
  integration_unavailable: "Publishing is not configured on this server.",
  integration_plan: "YouTube, X, and TikTok publish on Maker and Studio.",
  render_unavailable: "ffmpeg is not installed, so the silent cut cannot be built. Download the clips instead.",
  planner_unavailable: "The model planner is not configured. The scripted shot plan is unchanged.",
  confirm_required: "Generation needs an explicit confirmation.",
  bad_resolution: "Choose 480p or 720p.",
};

export function errorMessage(code: string): string {
  return messages[code] ?? "Something went wrong. Nothing else was charged.";
}

export function jsonError(err: unknown): Response {
  if (err instanceof ApiError) {
    return Response.json({ error: err.code, message: errorMessage(err.code) }, { status: err.status });
  }
  console.error("api_error", err instanceof Error ? err.name : "unknown");
  return Response.json({ error: "internal", message: errorMessage("internal") }, { status: 500 });
}
