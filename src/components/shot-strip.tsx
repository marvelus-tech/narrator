import Image from "next/image";
import { formatCredits, formatCreditUsd, quoteVideo } from "@/shared/economy";
import { publicAsset } from "@/shared/public-asset";

const cards = [
  {
    id: "01A",
    move: "#tracking",
    lens: "35mm",
    stop: "T2.8",
    resolution: "480p" as const,
    src: publicAsset("/showcase/shot-01.webp"),
    alt: "Wide street frame for a tracking move",
    note: "Camera travels with her. This is the default 5 second 480p quote.",
  },
  {
    id: "02A",
    move: "#dolly-in",
    lens: "35mm",
    stop: "T2.0",
    resolution: "480p" as const,
    src: publicAsset("/showcase/shot-02.webp"),
    alt: "Medium frame for a dolly in",
    note: "Camera moves closer. Same 5 second 480p quote.",
  },
  {
    id: "03A",
    move: "#crane-up",
    lens: "50mm",
    stop: "T4",
    resolution: "720p" as const,
    src: publicAsset("/showcase/shot-04.webp"),
    alt: "Doorway frame for a crane up",
    note: "Camera rises. 720p is the higher quote you choose on purpose.",
  },
];

export function ShotStrip() {
  return (
    <section className="cinema-block" aria-labelledby="grammar-title">
      <h2 id="grammar-title">Three moves. Real quotes.</h2>
      <p className="cinema-note">
        Focal length on the card is direction language. The number is the quote for a 5 second clip at that resolution.
      </p>
      <div className="cinema-grammar">
        {cards.map((card) => {
          const quote = quoteVideo(card.resolution, 5);
          return (
            <article key={card.id} className="cinema-card">
              <div className="cinema-sprocket cinema-sprocket-static">
                <span className="cinema-holes" aria-hidden="true" />
                <span className="cinema-cell">
                  <Image src={card.src} alt={card.alt} width={1200} height={502} />
                  <span className="cinema-reticle" aria-hidden="true" />
                  <span>{card.id}</span>
                </span>
                <span className="cinema-holes" aria-hidden="true" />
              </div>
              <h3>{card.move}</h3>
              <p className="cinema-spec">
                {card.lens} · {card.stop} · {card.resolution} · 5s
              </p>
              <p className="cinema-price">
                {formatCredits(quote.millicredits)} cr · {formatCreditUsd(quote.millicredits)}
              </p>
              <p>{card.note}</p>
            </article>
          );
        })}
      </div>
    </section>
  );
}
