import Link from "next/link";

export default function NotFound() {
  return (
    <main className="route-fallback">
      <section className="card">
        <div className="empty-state">
          <div className="empty-icon">?</div>
          <h1>Page not found</h1>
          <p>The requested control-panel view does not exist.</p>
          <Link className="button button-primary" href="/">
            Return to overview
          </Link>
        </div>
      </section>
    </main>
  );
}
