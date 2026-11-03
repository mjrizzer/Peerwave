export default function Loading() {
  return (
    <div className="page-content" aria-label="Loading content" role="status">
      <div className="page-head">
        <h1>One moment…</h1>
      </div>
      <div className="grid-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="skeleton" />
        ))}
      </div>
    </div>
  );
}
