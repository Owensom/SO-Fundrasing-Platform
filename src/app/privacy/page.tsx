import Link from "next/link";

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-neutral-50 text-neutral-900">
      <div className="mx-auto max-w-3xl px-4 py-12">
        <div className="mb-10">
          <Link
            href="/"
            className="text-sm text-neutral-500 hover:text-neutral-700"
          >
            ← Back to home
          </Link>

          <h1 className="mt-4 text-3xl font-semibold tracking-tight">
            Privacy Policy
          </h1>

          <p className="mt-2 text-sm text-neutral-500">
            Last updated: {new Date().toLocaleDateString("en-GB")}
          </p>
        </div>

        <div className="space-y-8 text-sm leading-relaxed">
          <section>
            <h2 className="mb-2 text-lg font-semibold">1. Who We Are</h2>
            <p>
              This platform is operated for fundraising purposes by the
              organisation running the campaign (“we”, “us”, “our”).
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-semibold">
              2. What Data We Collect
            </h2>
            <p>When you enter a raffle, squares game, or purchase an event ticket, we may collect:</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>Your name</li>
              <li>Your email address</li>
              <li>Your purchase or entry details</li>
              <li>Your selected tickets, squares, seats, tables, or bookings</li>
            </ul>
            <p className="mt-2">
              We do not collect or store your payment card details.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-semibold">
              3. How Your Data Is Used
            </h2>
            <p>We use your data only to:</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>Process your entries or purchases</li>
              <li>Send confirmation emails</li>
              <li>Contact you regarding your entry, booking, or prize</li>
              <li>Administer and manage the fundraising campaign</li>
            </ul>
            <p className="mt-2">
              We do not use your data for marketing unless this is clearly
              stated and you have agreed where required.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-semibold">4. Payments</h2>
            <p>
              All payments are processed securely by Stripe. We do not store
              your card details.
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>Your card details are never stored on this platform</li>
              <li>Payments are handled securely via Stripe</li>
              <li>
                Payment processing may be subject to Stripe’s own privacy and
                security policies
              </li>
            </ul>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-semibold">5. Data Sharing</h2>
            <p>
              We do not sell, rent, or share your personal data with third
              parties for marketing purposes.
            </p>
            <p className="mt-2">
              Data is only shared where necessary to process payments, operate
              the campaign, or comply with legal obligations.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-semibold">6. Data Retention</h2>
            <p>
              Your data is stored securely and retained only for as long as
              necessary to complete the campaign.
            </p>
            <p className="mt-2">
              We may retain data longer where required for legal, accounting, or
              regulatory purposes. After this, data will be deleted or
              anonymised where appropriate.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-semibold">7. Your Rights</h2>
            <p>Under UK GDPR, you may have the right to:</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>Access your personal data</li>
              <li>Request correction of inaccurate data</li>
              <li>Request deletion of your data</li>
              <li>Object to or restrict processing</li>
            </ul>
            <p className="mt-2">
              To exercise these rights, please contact the organisation running
              the campaign.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-semibold">8. Data Security</h2>
            <p>
              We take appropriate technical and organisational measures to
              protect your data from unauthorised access, loss, misuse, or
              disclosure.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-semibold">
              9. Changes to This Policy
            </h2>
            <p>
              We may update this policy from time to time. The latest version
              will always be available on this page.
            </p>
          </section>
        </div>

        <div className="mt-12 border-t pt-6 text-xs text-neutral-500">
          <p>
            This campaign is run by the organisation listed on the fundraising
            page.
          </p>
        </div>
      </div>
    </main>
  );
}
