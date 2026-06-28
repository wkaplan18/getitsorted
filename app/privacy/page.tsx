export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-2xl mx-auto px-6 py-16">
        <h1 className="text-3xl font-bold text-gray-900 mb-2" style={{ letterSpacing: '-0.03em' }}>Privacy Policy</h1>
        <p className="text-gray-400 text-sm mb-10">Last updated: June 2026</p>

        <div className="space-y-8 text-gray-600 leading-relaxed">
          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">What we collect</h2>
            <p>When you use Sorted, we collect your WhatsApp phone number, the bill and invoice information you forward to us (including payee names, amounts, and banking details), and your payment status history.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">How we use your data</h2>
            <p>We use your information solely to display your bills on your personal dashboard, send you payment reminders, and notify trusted senders when payments are made. We do not sell or share your data with third parties for marketing purposes.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Third-party services</h2>
            <p>Sorted uses the following third-party services to operate:</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li><strong>Meta (WhatsApp)</strong> — for receiving and sending WhatsApp messages</li>
              <li><strong>Supabase</strong> — for secure database storage</li>
              <li><strong>Anthropic (Claude AI)</strong> — for extracting bill details from messages and documents</li>
              <li><strong>Vercel</strong> — for hosting the application</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Data retention</h2>
            <p>Your bill data is retained for as long as your account is active. You can delete individual bills from your dashboard at any time. To delete your account and all associated data, contact us at the email below.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Security</h2>
            <p>Your data is stored securely using industry-standard encryption. Access to your dashboard requires OTP verification via WhatsApp.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Contact</h2>
            <p>For any privacy-related questions or data deletion requests, send us a WhatsApp message at <strong>+27 76 228 0489</strong>.</p>
          </section>
        </div>
      </div>
    </div>
  )
}
