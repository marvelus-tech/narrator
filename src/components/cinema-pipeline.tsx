import Image from "next/image";
import { landing } from "@/shared/content";

const art = [
  { src: "/showcase/shot-03.webp", alt: "Slate still of the sealed envelope" },
  { src: "/showcase/cast-01.webp", alt: "Cast reference used on the brief" },
  { src: "/showcase/shot-01.webp", alt: "First frame of the shot strip" },
  { src: "/showcase/shot-04.webp", alt: "Doorway frame for the motion take" },
] as const;

export function CinemaPipeline() {
  return (
    <section className="cinema-block" aria-labelledby="pipeline-title">
      <h2 id="pipeline-title">From brief to take.</h2>
      <div className="cinema-pipeline">
        {landing.pipeline.map((step, index) => (
          <article key={step.n} className="cinema-card">
            <p className="cinema-slate">{step.n}</p>
            <div className="cinema-mini">
              <Image src={art[index].src} alt={art[index].alt} width={320} height={180} />
            </div>
            <h3>{step.title}</h3>
            <p>{step.body}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
