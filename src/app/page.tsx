import Link from "next/link";
import { creditExamples, steps } from "@/shared/content";
import { routes } from "@/shared/routes";
import { pageMeta } from "@/server/meta";

export const metadata = pageMeta("home");

export default function HomePage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "Narrator",
    applicationCategory: "MultimediaApplication",
    operatingSystem: "Web",
    offers: { "@type": "Offer", price: "15", priceCurrency: "USD" },
    description: "Turn one film brief into an editable shot list with a credit price before each still or clip.",
  };
  return (
    <div className="wrap">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <section className="hero">
        <div>
          <p className="kicker">Shot planning desk</p>
          <h1>One brief. A shot list you can price.</h1>
          <p className="lede">
            Narrator drafts scenes and shots from a paragraph, keeps your reference images next to them, and holds credits only after you approve a quote.
          </p>
          <div className="actions">
            <Link className="btn" href={routes.signup}>Start a brief</Link>
            <Link className="btn-ghost" href={routes.pricing}>See pricing</Link>
          </div>
        </div>
        <aside className="panel">
          <p className="kicker">What a credit buys</p>
          <h2>Examples, not a buffet</h2>
          {creditExamples.map((item) => (
            <p key={item.label} className="example-row">
              <strong>{item.label}</strong><br />
              {item.credits} credits, {item.dollars} at face value. {item.detail}
            </p>
          ))}
        </aside>
      </section>
      <section className="section">
        <h2>How a brief becomes frames</h2>
        <div className="steps">
          {steps.map((step) => (
            <article key={step.n} className="panel">
              <p className="num">{step.n}</p>
              <h3>{step.title}</h3>
              <p>{step.body}</p>
            </article>
          ))}
        </div>
        <p className="muted">
          Monthly plan credits expire at the end of the paid period. Pack credits do not expire. A finished file you dislike stays charged. A failed job returns the hold.
          <Link href={routes.how}> Read the full path.</Link>
        </p>
      </section>
    </div>
  );
}
