"use client"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { AlertCircle } from "lucide-react"
import Link from "next/link"

interface ConsentDialogProps {
  open: boolean
  onAccept: () => void
  onDecline: () => void
}

export function ConsentDialog({ open, onAccept, onDecline }: ConsentDialogProps) {
  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-md" onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-primary" />
            Interview Consent & Recording Notice
          </DialogTitle>
          <DialogDescription className="space-y-3 pt-2">
            <p>
              This interview session will be <strong>recorded and analyzed</strong> for the following purposes:
            </p>
            <ul className="list-disc list-inside space-y-1 text-sm">
              <li>Interview review and evaluation</li>
              <li>Quality assurance and integrity verification</li>
              <li>Training and improvement of our interview process</li>
              <li>Analytics and performance assessment</li>
            </ul>
            <p className="text-sm pt-2">
              By continuing, you agree to the recording and analysis of this interview session and consent to our{" "}
              <Link href="/user-agreement" target="_blank" className="text-primary hover:underline font-medium">
                User Agreement
              </Link>
              .
            </p>
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={onDecline} className="w-full sm:w-auto bg-transparent">
            Decline
          </Button>
          <Button onClick={onAccept} className="w-full sm:w-auto">
            Accept & Continue
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
