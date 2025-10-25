import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"

export default function UserAgreementPage() {
  return (
    <div className="min-h-screen bg-background p-4 py-12">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Link>
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-3xl">User Agreement</CardTitle>
            <CardDescription>Last updated: January 2025</CardDescription>
          </CardHeader>
          <CardContent className="prose prose-sm max-w-none dark:prose-invert space-y-6">
            <section>
              <h2 className="text-xl font-semibold mb-3">1. Acceptance of Terms</h2>
              <p>
                By accessing and using this interview platform, you accept and agree to be bound by the terms and
                provisions of this agreement. If you do not agree to these terms, please do not use this service.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">2. Recording and Data Collection</h2>
              <p>
                By participating in an interview session, you acknowledge and consent to the following data collection
                practices:
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Audio and video recording of the entire interview session</li>
                <li>Collection of metadata including timestamps, connection quality, and session duration</li>
                <li>Analysis of interview content for quality assurance and training purposes</li>
                <li>Storage of recordings for review, evaluation, and compliance purposes</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">3. Use of Recorded Content</h2>
              <p>Recorded interview sessions may be used for:</p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Candidate evaluation and hiring decisions</li>
                <li>Quality assurance and interviewer training</li>
                <li>Compliance with legal and regulatory requirements</li>
                <li>Improvement of our interview platform and processes</li>
                <li>Analytics and performance assessment</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">4. Data Privacy and Security</h2>
              <p>
                We are committed to protecting your privacy and securing your data. All recordings and personal
                information are:
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Stored securely using industry-standard encryption</li>
                <li>Accessible only to authorized personnel</li>
                <li>Retained in accordance with our data retention policies</li>
                <li>Protected in compliance with applicable data protection laws</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">5. User Responsibilities</h2>
              <p>As a user of this platform, you agree to:</p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Provide accurate and truthful information</li>
                <li>Conduct yourself professionally during interview sessions</li>
                <li>Not record or share interview content without explicit permission</li>
                <li>Respect the confidentiality of interview questions and discussions</li>
                <li>Use the platform only for its intended purpose</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">6. Intellectual Property</h2>
              <p>
                All content, features, and functionality of this platform are owned by the platform operator and are
                protected by international copyright, trademark, and other intellectual property laws.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">7. Limitation of Liability</h2>
              <p>
                The platform is provided "as is" without warranties of any kind. We shall not be liable for any
                indirect, incidental, special, consequential, or punitive damages resulting from your use of or
                inability to use the service.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">8. Technical Requirements</h2>
              <p>Users are responsible for:</p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Ensuring stable internet connectivity</li>
                <li>Providing necessary camera and microphone permissions</li>
                <li>Using compatible browsers and devices</li>
                <li>Maintaining appropriate technical setup for video interviews</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">9. Termination</h2>
              <p>
                We reserve the right to terminate or suspend access to the platform immediately, without prior notice,
                for conduct that we believe violates this agreement or is harmful to other users, us, or third parties.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">10. Changes to Terms</h2>
              <p>
                We reserve the right to modify these terms at any time. Continued use of the platform after changes
                constitutes acceptance of the modified terms.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">11. Contact Information</h2>
              <p>
                For questions about this agreement or our practices, please contact us through the appropriate channels
                provided on our platform.
              </p>
            </section>

            <section className="pt-4 border-t">
              <p className="text-sm text-muted-foreground">
                By using this platform, you acknowledge that you have read, understood, and agree to be bound by this
                User Agreement.
              </p>
            </section>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
