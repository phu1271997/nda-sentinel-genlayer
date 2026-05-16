import { ReportLeakForm } from "@/components/ReportLeakForm"
import { ConnectWalletButton } from "@/components/ConnectWalletButton"

export default function ReportLeakPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-end mb-8">
        <ConnectWalletButton />
      </div>
      <ReportLeakForm />
    </div>
  )
}
