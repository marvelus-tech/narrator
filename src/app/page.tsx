import Link from "next/link";
import { CinemaHero } from "@/components/cinema-hero";
import { CinemaPipeline } from "@/components/cinema-pipeline";
import { ShotStrip } from "@/components/shot-strip";
import { pageMeta } from "@/server/meta";
import { creditExamples, landing } from "@/shared/content";
import { routes } from "@/shared/routes";

export const metadata = pageMeta("home");

export default function HomePage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "Nr8tr",
    applicationCategory: "MultimediaApplication",
    operatingSystem: "Web",
    offers: { "@type": "Offer", price: "15", priceCurrency: "USD" },
    description: landing.lede,
  };
  return (
    <div className="cinema">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div className="wrap">
        <CinemaHero />
        <CinemaPipeline />
        <ShotStrip />
        <section className="cinema-block" aria-labelledby="ledger-title">
          <h2 id="ledger-title">What a credit buys</h2>
          <ul className="cinema-ledger">
            {creditExamples.map((item) => (
              <li key={item.label}>
                <strong>{item.label}</strong>
                <span>
                  {item.credits} cr · {item.dollars}
                </span>
                <em>{item.detail}</em>
              </li>
            ))}
          </ul>
          <p className="cinema-limit">
            {landing.limit} <Link href={routes.how}>Read the full path.</Link>
          </p>
        </section>
      </div>
    </div>
  );
}
