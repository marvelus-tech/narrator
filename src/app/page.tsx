import Link from "next/link";
import { CinemaHero } from "@/components/cinema-hero";
import { CinemaPipeline } from "@/components/cinema-pipeline";
import { ShotStrip } from "@/components/shot-strip";
import { pageMeta } from "@/server/meta";
import { creditExamples, landing } from "@/shared/content";
import { pages, routes } from "@/shared/routes";

export const metadata = pageMeta("home");

export default function HomePage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "Nr8tr",
    applicationCategory: "MultimediaApplication",
    operatingSystem: "Web",
    offers: { "@type": "Offer", price: "15", priceCurrency: "USD" },
    description: pages.home.description,
  };
  return (
    <div className="cinema cinema-home">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div className="wrap">
        <CinemaHero />
        <CinemaPipeline />
        <ShotStrip />
        <section className="cinema-block" aria-labelledby="ledger-title">
          <h2 id="ledger-title">Studio-grade takes. Without the studio tax.</h2>
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
            <li>
              <strong>Failed job</strong>
              <span>100% returned</span>
              <em>The hold comes back if the provider fails. A file you keep stays charged.</em>
            </li>
          </ul>
          <p className="cinema-limit">{landing.limit}</p>
          <p className="cinema-links">
            <Link href={routes.pricing}>Pricing</Link>
            <Link href={routes.how}>How it works</Link>
            <Link href={routes.signup}>Direct your first scene</Link>
          </p>
        </section>
      </div>
    </div>
  );
}
