import Image from "next/image";
import { PIPELINE_FRAMES } from "@/shared/showcase-film";
import { landing } from "@/shared/content";
import { publicAsset } from "@/shared/public-asset";

export function CinemaPipeline() {
  return (
    <section className="cinema-block" aria-labelledby="pipeline-title">
      <h2 id="pipeline-title">Premise to cut in four moves.</h2>
      <div className="cinema-pipeline">
        {landing.pipeline.map((step, index) => {
          const frame = PIPELINE_FRAMES[index];
          return (
            <article key={step.n} className="cinema-card">
              <p className="cinema-slate">{step.n}</p>
              <div className="cinema-mini">
                <Image src={publicAsset(frame.src)} alt={frame.alt} width={frame.width} height={frame.height} sizes="(max-width: 860px) 100vw, 240px" />
              </div>
              <h3>{step.title}</h3>
              <p>{step.body}</p>
            </article>
          );
        })}
      </div>
    </section>
  );
}
