import Link from "next/link";

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-neutral-50 text-neutral-900">
      <div className="mx-auto max-w-3xl px-4 py-12">
        
        {/* Header */}
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
            Last updated: {new Date().toLocaleDateString()}
          </p>
        </div>

        {/* Content */}
        <div className="space-y-8 text-sm leading-relaxed">
          
          <section>
            <h2 className="text-lg font-semibold mb-2">1. Who We Are</h2>
            <p>
              This platform is operated for fundraising purposes by the
              organisation running the campaign (“we”, “us”, “our”).
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">
              2. What Data We Collect
            </h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>Your name</li>
              <li>Your email address</li>
              <li>Your purchase or entry details</li>
            </ul>
            <p className="mt-2">
              We do not collect or store your payment card details.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">
              3. How Your Data Is Used
            </h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>Process your entries or purchases</li>
              <li>Send confirmation emails</li>
              <li>Contact you regarding your entry or booking</li>
              <li>Administer the fundraising campaign</li>
            </ul>
            <p className="mt-2">
              We do not use your data for marketing unless explicitly stated.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">4. Payments</h2>
            <p>
              All payments are processed securely by Stripe.
            </p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li>Your card details are never stored on this platform</li>
              <li>Payments are handled securely via Stripe</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">5. Data Sharing</h2>
            <p>
              We do not sell, rent, or share your personal data with third
              parties.
            </p>
            <p className="mt-2">
              Data is only shared where necessary to process payments or comply
              with legal obligations.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">
              6. Data Retention
            </h2>
            <p>
              Your data is stored securely and retained only for as long as
              necessary to complete the campaign.
            </p>
            <p className="mt-2">
              We may retain data longer where required for legal, accounting, or
              regulatory purposes.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">
              7. Your Rights
            </h2>
            <ul className="list-disc pl-5 space-y-1">
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
            <h2 className="text-lg font-semibold mb-2">
              8. Data Security
            </h2>
            <p>
              We take appropriate technical and organisational measures to
              protect your data from unauthorised access, loss, or misuse.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">
              9. Changes to This Policy
            </h2>
            <p>
              We may update this policy from time to time. The latest version
              will always be available on this page.
            </p>
          </section>
        </div>

        {/* Footer */}
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
