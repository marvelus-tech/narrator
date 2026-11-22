import Image from "next/image";
import { SHOWCASE_FILM, SHOWCASE_GRAMMAR, SHOWCASE_STILL } from "@/shared/showcase-film";
import { formatCredits, formatCreditUsd, quoteVideo } from "@/shared/economy";
import { publicAsset } from "@/shared/public-asset";

export function ShotStrip() {
  return (
    <section className="cinema-block" aria-labelledby="grammar-title">
      <h2 id="grammar-title">Direct the camera, not a slot machine.</h2>
      <p className="cinema-note">
        Focal length is direction. The price is the quote for a 5 second clip at that resolution.
      </p>
      <div className="cinema-grammar">
        {SHOWCASE_GRAMMAR.map((card) => {
          const shot = SHOWCASE_FILM.shots.find((item) => item.id === card.shotId);
          if (!shot) return null;
          const quote = quoteVideo(shot.resolution, shot.seconds);
          return (
            <article key={card.shotId} className="cinema-card">
              <div className="cinema-sprocket cinema-sprocket-static">
                <span className="cinema-holes" aria-hidden="true" />
                <span className="cinema-cell">
                  <Image src={publicAsset(shot.still)} alt={shot.alt} width={SHOWCASE_STILL.width} height={SHOWCASE_STILL.height} sizes="(max-width: 860px) 100vw, 320px" />
                  <span className="cinema-reticle" aria-hidden="true" />
                  <span>{shot.slate}</span>
                </span>
                <span className="cinema-holes" aria-hidden="true" />
              </div>
              <h3>{card.title}</h3>
              <p className="cinema-spec">{shot.resolution} · {shot.seconds}s</p>
              <p className="cinema-price">
                {formatCredits(quote.millicredits)} cr · {formatCreditUsd(quote.millicredits)}
              </p>
              <p>{shot.prompt}</p>
              <p>{card.note}</p>
            </article>
          );
        })}
      </div>
    </section>
  );
}
