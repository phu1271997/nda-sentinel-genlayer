"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Wallet } from "lucide-react"

export function ConnectWalletButton() {
  const [address, setAddress] = useState<string | null>(null)
  
  useEffect(() => {
    const checkConnection = async () => {
      if (typeof window !== "undefined" && (window as any).ethereum) {
        const accounts = await (window as any).ethereum.request({ method: 'eth_accounts' });
        if (accounts.length > 0) {
          setAddress(accounts[0]);
        }
      }
    }
    checkConnection();
  }, [])

  const connect = async () => {
    if (typeof window !== "undefined" && (window as any).ethereum) {
      try {
        const accounts = await (window as any).ethereum.request({ method: 'eth_requestAccounts' });
        if (accounts.length > 0) {
          setAddress(accounts[0]);
        }
      } catch (err) {
        console.error(err);
      }
    } else {
      alert("Please install MetaMask or a compatible Web3 wallet.");
    }
  }

  return (
    <Button onClick={connect} variant={address ? "outline" : "default"} className="font-mono">
      <Wallet className="mr-2 h-4 w-4" />
      {address ? `${address.substring(0, 6)}...${address.substring(38)}` : "Connect Wallet"}
    </Button>
  )
}
