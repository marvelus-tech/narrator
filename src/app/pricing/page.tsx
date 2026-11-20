import Link from "next/link";
import { creditExamples, packCards, planCards, pricingFaq } from "@/shared/content";
import { PLANS } from "@/shared/economy";
import { routes } from "@/shared/routes";
import { pageMeta } from "@/server/meta";

export const metadata = pageMeta("pricing");

export default function PricingPage() {
  return (
    <div className="wrap section">
      <p className="kicker">Monthly plans</p>
      <h1>Pay for credits, not a generation buffet.</h1>
      <p className="lede">
        One credit has a face value of $0.05. Stills and clips are quoted at 1.25 times the provider cost before you spend anything. Plan credits expire at period end. Packs do not.
      </p>
      <p className="panel">
        Free includes {PLANS.free.credits} credits once, after email verification, with one draft clip a day. Then quotes only.
      </p>
      <div className="cards">
        {planCards.map((card) => (
          <article key={card.id} className={card.highlight ? "panel highlight" : "panel"}>
            {card.highlight ? <p className="kicker">{card.highlightLabel}</p> : <p className="kicker">Monthly</p>}
            <h2>{card.name}</h2>
            <p className="price">{card.price}<span> / month</span></p>
            <p><strong>{card.credits} credits</strong> this period. {card.blurb}</p>
            <ul>
              <li>{card.concurrency} jobs at once</li>
              <li>{card.takes} take{card.takes === 1 ? "" : "s"} per click</li>
              <li>Plan credits expire at period end</li>
            </ul>
            <Link className="btn" href={routes.signup}>Choose {card.name}</Link>
          </article>
        ))}
      </div>
      <section className="section">
        <h2>What the credits buy</h2>
        {creditExamples.map((item) => (
          <p key={item.label} className="example-row">
            <strong>{item.label}</strong>: {item.credits} credits ({item.dollars}). {item.detail}
          </p>
        ))}
        <p className="muted">480p is the default. 720p is a separate quote you choose on the shot. There is no auto-refill.</p>
      </section>
      <section className="section">
        <h2>Packs</h2>
        <p>Packs are face value, they do not expire, and they require a paid plan. New accounts cannot buy the 1,000 credit pack for 24 hours.</p>
        <div className="cards">
          {packCards.map((pack) => (
            <article key={pack.id} className="panel">
              <h3>{pack.credits} credits</h3>
              <p className="price">{pack.price}</p>
              <p>{pack.note}</p>
            </article>
          ))}
        </div>
      </section>
      <section className="faq section">
        <h2>Pricing questions</h2>
        {pricingFaq.map((item) => (
          <details key={item.q}>
            <summary>{item.q}</summary>
            <p>{item.a}</p>
          </details>
        ))}
        <p><Link href={routes.refunds}>Refund rules</Link></p>
      </section>
    </div>
  );
}
