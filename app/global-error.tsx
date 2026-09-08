"use client";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body>
        <main className="route-fallback">
          <section className="card">
            <div className="empty-state">
              <div className="empty-icon">!</div>
              <h1>Havenerr control panel is unavailable</h1>
              <p>Reload the application to recover the administrative interface.</p>
              <button className="button button-primary" onClick={reset}>
                Reload control panel
              </button>
            </div>
          </section>
        </main>
      </body>
    </html>
  );
}
