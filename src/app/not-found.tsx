import Link from "next/link";
export default function NotFound() {
  return (
    <div className="page-head empty">
      <h1>This page isn’t here.</h1>
      <p>It may have moved, or you may not have access.</p>
      <Link className="button" href="/sessions">
        Explore sessions
      </Link>
    </div>
  );
}
