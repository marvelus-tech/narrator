import Link from "next/link";
import { steps } from "@/shared/content";
import { routes } from "@/shared/routes";
import { pageMeta } from "@/server/meta";

export const metadata = pageMeta("how");

export default function HowPage() {
  return (
    <div className="wrap section">
      <p className="kicker">Workflow</p>
      <h1>From a paragraph to a priced shot.</h1>
      <p className="lede">
        Nr8tr is the desk where a brief becomes an editable shot list. It is not a promise of a finished film with dialogue, music, and a cut.
      </p>
      <div className="steps">
        {steps.map((step) => (
          <article key={step.n} className="panel">
            <p className="num">{step.n}</p>
            <h2>{step.title}</h2>
            <p>{step.body}</p>
          </article>
        ))}
      </div>
      <section className="section">
        <h2>What happens after you approve</h2>
        <p>The job is queued. Credits are reserved in one database transaction. A background worker calls the configured image or video provider, or a local sample when no key is set. On success the smaller of the quote and the settled provider bill is captured. On failure the hold is returned.</p>
        <p>You can download each file, download a zip, or build a silent cut when ffmpeg is installed. Drive and Dropbox are on every plan. YouTube, X, and TikTok publish on Maker and Studio. None of them change the credit price.</p>
        <p>Rights follow the provider that made the file. Sample files in mock mode are for trying the desk.</p>
        <p><Link className="btn" href={routes.signup}>Create an account</Link></p>
      </section>
    </div>
  );
}
