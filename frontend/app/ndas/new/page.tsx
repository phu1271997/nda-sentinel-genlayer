import { NDAWizard } from "@/components/NDAWizard"
import { ConnectWalletButton } from "@/components/ConnectWalletButton"

export default function NewNDAPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">Create NDA</h1>
        <ConnectWalletButton />
      </div>
      <NDAWizard />
    </div>
  )
}
