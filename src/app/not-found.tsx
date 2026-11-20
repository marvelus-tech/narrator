import Link from "next/link";
import { routes } from "@/shared/routes";

export default function NotFound() {
  return (
    <div className="wrap section">
      <h1>That page is not here</h1>
      <p className="lede">The link may be old. The home page and the pricing page are the public starting points.</p>
      <p>
        <Link className="btn" href={routes.home}>Back home</Link>
      </p>
    </div>
  );
}
