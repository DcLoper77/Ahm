"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, Card } from "@/components/ui";

export default function InviteLandingPage() {
  const router = useRouter();
  return (
    <div className="auth-page">
      <section className="auth-visual">
        <div className="auth-brand">
          <span className="brand-mark">H</span>
          <span className="brand-wordmark">
            havenerr<span>.</span>
          </span>
        </div>
        <div className="auth-visual-copy">
          <span className="auth-kicker">Administrator invitation</span>
          <h1>Use the secure link you received.</h1>
          <p>
            Invitation links are one-use bearer links. Open the complete link from your approved
            channel to begin setup.
          </p>
        </div>
        <div className="auth-visual-footer">Invitation links expire after 48 hours.</div>
      </section>
      <section className="auth-panel">
        <Card className="auth-card">
          <h2>Invitation link required</h2>
          <p>
            Ask the inviter to issue a new link if yours is missing, expired, or already accepted.
          </p>
          <Button variant="primary" className="auth-submit" onClick={() => router.push("/login")}>
            Go to sign in
          </Button>
          <p className="auth-footnote">
            <Link href="/login">Return to admin sign in</Link>
          </p>
        </Card>
      </section>
    </div>
  );
}
