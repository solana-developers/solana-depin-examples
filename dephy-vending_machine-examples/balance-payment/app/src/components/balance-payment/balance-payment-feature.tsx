import { useWallet } from '@solana/wallet-adapter-react'
import { WalletButton } from '../solana/solana-provider'
import { useBalancePaymentProgram } from './balance-payment-data-access'
import { useEffect, useState, useRef } from 'react'
import { BN } from '@coral-xyz/anchor'
import keccak from 'keccak'
import { useTransactionToast } from '../ui/ui-layout'
import toast from 'react-hot-toast'
import { finalizeEvent, generateSecretKey } from 'nostr-tools/pure'
import { Relay } from 'nostr-tools/relay'
import bs58 from 'bs58'

const SIGN_MESSAGE_PREFIX = 'DePHY vending machine/Example:\n'
const RELAY_ENDPOINT = import.meta.env.VITE_RELAY_ENDPOINT || 'ws://127.0.0.1:8000'

// define charge status
type ChargeStatus = 'idle' | 'requested' | 'working' | 'available' | 'error'

export default function BalancePaymentFeature() {
  const transactionToast = useTransactionToast()
  const { publicKey, wallet, signMessage } = useWallet()
  const { program, getGlobalPubkey, getUserAccountPubkey, generate64ByteUUIDPayload } = useBalancePaymentProgram()

  const [selectedTab, setSelectedTab] = useState<'decharge' | 'gacha'>('decharge')
  const [recoverInfo, setRecoverInfo] = useState<any>()
  const [serialNumberStr, setSerialNumberStr] = useState<string | null>(null)
  const [serialNumberBytes, setSerialNumberBytes] = useState<Uint8Array | null>(null)
  const [globalAccount, setGlobalAccount] = useState<any>(null)
  const [userAccount, setUserAccount] = useState<any>(null)
  const [vaultBalance, setVaultBalance] = useState<number | null>(null)
  const [depositAmount, setDepositAmount] = useState<string>('')
  const [withdrawAmount, setWithdrawAmount] = useState<string>('')
  const [machinePubkey, setMachinePubkey] = useState<string>(
    'd041ea9854f2117b82452457c4e6d6593a96524027cd4032d2f40046deb78d93',
  )
  const [relay, setRelay] = useState<Relay>()
  const [sk, setSk] = useState<Uint8Array | null>(null)
  const [chargeStatus, setChargeStatus] = useState<ChargeStatus>('idle')
  const [events, setEvents] = useState<any[]>([])
  const [expandedEventIndex, setExpandedEventIndex] = useState<number | null>(null)
  const [isChargeDisabled, setIsChargeDisabled] = useState(false)
  const isTabDisabled = chargeStatus !== 'idle' && chargeStatus !== 'available'
  const [initialRequestId, setInitialRequestId] = useState<string | null>(null)
  const [initialPayload, setInitialPayload] = useState<string | null>(null)
  const [stopFlag, setStopFlag] = useState(false)
  const [isStopPending, setIsStopPending] = useState(false)

  const subscriptionRef = useRef<any>(null)

  useEffect(() => {
    const { uuid, uuidBytes } = generate64ByteUUIDPayload()
    setSerialNumberStr(uuid)
    setSerialNumberBytes(uuidBytes)
  }, [selectedTab])

  useEffect(() => {
    if (!globalAccount) {
      fetchGlobalAccount()
    }
  }, [program])

  useEffect(() => {
    if (!userAccount) {
      fetchUserAccount()
    }
  }, [program, publicKey])

  useEffect(() => {
    if (publicKey) {
      const intervalId = setInterval(fetchUserAccount, 3000)

      return () => clearInterval(intervalId)
    }
  }, [publicKey])

  useEffect(() => {
    ;(async () => {
      const sk = generateSecretKey()
      setSk(sk)

      try {
        const relay = await Relay.connect(RELAY_ENDPOINT)
        setRelay(relay)
        toast.success(`connected to ${relay.url}`)
      } catch (error) {
        toast.error(`fail to connect relay, ${error}`)
      }
    })()
  }, [])

  const solToLamports = (sol: string): BN => {
    const solNumber = parseFloat(sol)
    if (isNaN(solNumber) || solNumber < 0) {
      throw new Error('Invalid SOL amount')
    }
    return new BN(solNumber * 10 ** 9)
  }

  const handleRegister = async () => {
    if (!publicKey || !program) {
      console.error('Wallet not connected or program not loaded')
      return
    }

    try {
      const transactionSignature = await program.methods
        .register()
        .accountsPartial({
          user: publicKey,
        })
        .rpc()

      console.log('Register transaction signature:', transactionSignature)
      transactionToast(transactionSignature)

      const userAccountPubkey = getUserAccountPubkey(publicKey)
      const user = await program.account.userAccount.fetch(userAccountPubkey)
      setUserAccount(user)
      const userVaultBalance = await program.provider.connection.getBalance(user.vault)
      setVaultBalance(userVaultBalance)
    } catch (error) {
      toast.error(`Error registering user account: ${error}`)
    }
  }

  const handleDeposit = async () => {
    if (!publicKey || !program || !depositAmount) {
      console.error('Wallet not connected or program not loaded or amount not set')
      return
    }

    try {
      const amount = solToLamports(depositAmount)
      const transactionSignature = await program.methods
        .deposit(amount)
        .accountsPartial({
          user: publicKey,
        })
        .rpc()

      console.log('Deposit transaction signature:', transactionSignature)
      transactionToast(transactionSignature)

      const userAccountPubkey = getUserAccountPubkey(publicKey)
      const user = await program.account.userAccount.fetch(userAccountPubkey)
      const userVaultBalance = await program.provider.connection.getBalance(user.vault)
      setVaultBalance(userVaultBalance)
    } catch (error) {
      toast.error(`Error depositing: ${error}`)
    }
  }

  const handleWithdraw = async () => {
    if (!publicKey || !program || !withdrawAmount) {
      console.error('Wallet not connected or program not loaded or amount not set')
      return
    }

    try {
      const amount = solToLamports(withdrawAmount)
      const transactionSignature = await program.methods
        .withdraw(amount)
        .accountsPartial({
          user: publicKey,
        })
        .rpc()

      console.log('Withdraw transaction signature:', transactionSignature)
      transactionToast(transactionSignature)

      const userAccountPubkey = getUserAccountPubkey(publicKey)
      const user = await program.account.userAccount.fetch(userAccountPubkey)
      const userVaultBalance = await program.provider.connection.getBalance(user.vault)
      setVaultBalance(userVaultBalance)
    } catch (error) {
      toast.error(`Error withdrawing: ${error}`)
    }
  }

  const handleSelectTab = (tab: 'decharge' | 'gacha') => {
    if (isTabDisabled) {
      return
    }
    setSelectedTab(tab)
    handleReset()
  }

  const fetchGlobalAccount = async () => {
    if (!program) return

    const globalAccountPubkey = getGlobalPubkey()
    const global = await program.account.globalAccount.fetch(globalAccountPubkey)
    setGlobalAccount(global)
  }

  const fetchUserAccount = async () => {
    if (!publicKey || !program) return

    const userAccountPubkey = getUserAccountPubkey(publicKey)
    console.log('userAccountPubkey:', userAccountPubkey.toString())
    const user = await program.account.userAccount.fetch(userAccountPubkey)
    const userVaultBalance = await program.provider.connection.getBalance(user.vault)
    setVaultBalance(userVaultBalance)
    setUserAccount(user)
  }

  const handleCharge = async () => {
    if (!wallet || !publicKey || !signMessage || !serialNumberBytes) {
      console.error('Wallet not connected or serial number not generated')
      return
    }

    setIsChargeDisabled(true)

    const userAccountPubkey = getUserAccountPubkey(publicKey)
    const user = await program.account.userAccount.fetch(userAccountPubkey)

    const nonce = user.nonce
    const payload = serialNumberBytes
    const deadline = new BN(Date.now() / 1000 + 60 * 30) // 30 minutes later

    const message = Buffer.concat([payload, nonce.toArrayLike(Buffer, 'le', 8), deadline.toArrayLike(Buffer, 'le', 8)])
    const messageHash = keccak('keccak256').update(message).digest()
    const hashedMessageBase58 = bs58.encode(messageHash)
    const digest = new TextEncoder().encode(`${SIGN_MESSAGE_PREFIX}${hashedMessageBase58}`)

    let recoverInfo
    try {
      const signature = await signMessage(digest)
      recoverInfo = {
        signature: Array.from(signature),
        payload: Array.from(payload),
        deadline: deadline.toNumber(),
      }
      setRecoverInfo(recoverInfo)
    } catch (error) {
      toast.error(`Error signing message: ${error}`)
      setIsChargeDisabled(false)
      return
    }

    try {
      await publishToRelay(nonce.toNumber(), recoverInfo, publicKey.toString())
    } catch (error) {
      toast.error(`Error publishing to relay: ${error}`)
      setIsChargeDisabled(false)
      return
    }

    try {
      await listenFromRelay()
    } catch (error) {
      toast.error(`Error listening from relay: ${error}`)
      setIsChargeDisabled(false)
    }
  }

  const handleStop = async () => {
    if (!sk || !relay || !machinePubkey || !initialRequestId || !initialPayload) {
      toast.error('Not initialized')
      return
    }

    setIsStopPending(true)
    try {
      const sTag = selectedTab === 'decharge' ? 'dephy-decharge-controller' : 'dephy-gacha-controller'
      const contentData = {
        Request: {
          to_status: 'Available',
          reason: 'UserRequest',
          initial_request: initialRequestId,
          payload: initialPayload,
        },
      }

      const content = JSON.stringify(contentData)
      const eventTemplate = {
        kind: 1573,
        created_at: Math.floor(Date.now() / 1000),
        tags: [
          ['s', sTag],
          ['p', machinePubkey],
        ],
        content,
      }
      const signedEvent = finalizeEvent(eventTemplate, sk)
      await relay.publish(signedEvent)
      toast.success(`Stop request id [${initialRequestId}]`)
      setStopFlag(true)
    } catch (error) {
      toast.error(`Failed to send stop request: ${error}`)
      setIsStopPending(false)
    }
  }

  const publishToRelay = async (nonce: number, recoverInfo: any, user: string) => {
    if (!sk) {
      toast.error('sk not initialized')
      return
    }
    if (!machinePubkey) {
      toast.error('machinePubkey not initialized')
      return
    }
    if (!relay) {
      toast.error('relay not initialized')
      return
    }
    const sTag = selectedTab === 'decharge' ? 'dephy-decharge-controller' : 'dephy-gacha-controller'

    const payload = JSON.stringify({
      recover_info: JSON.stringify(recoverInfo),
      nonce,
      user,
    })

    setInitialPayload(payload)

    const contentData = {
      Request: {
        to_status: 'Working',
        reason: 'UserRequest',
        initial_request: '0000000000000000000000000000000000000000000000000000000000000000',
        payload,
      },
    }

    const content = JSON.stringify(contentData)

    let eventTemplate = {
      kind: 1573,
      created_at: Math.floor(Date.now() / 1000),
      tags: [
        ['s', sTag],
        ['p', machinePubkey],
      ],
      content,
    }
    const signedEvent = finalizeEvent(eventTemplate, sk)
    await relay.publish(signedEvent)
  }

  const listenFromRelay = async () => {
    if (!sk) {
      toast.error('sk not initialized')
      return
    }
    if (!machinePubkey) {
      toast.error('machinePubkey not initialized')
      return
    }
    if (!relay) {
      toast.error('relay not initialized')
      return
    }

    const sTag = selectedTab === 'decharge' ? 'dephy-decharge-controller' : 'dephy-gacha-controller'

    // clear old subscription
    if (subscriptionRef.current) {
      subscriptionRef.current.close()
    }

    // create new subscription
    subscriptionRef.current = relay.subscribe(
      [
        {
          kinds: [1573],
          since: Math.floor(Date.now() / 1000),
          '#s': [sTag],
          '#p': [machinePubkey],
        },
      ],
      {
        onevent: async (event) => {
          console.log('event received:', event)
          try {
            const content = JSON.parse(event.content)
            if (content.Request) {
              setChargeStatus('requested')
              setInitialRequestId(event.id)
            } else if (content.Status) {
              if (content.Status.status === 'Working') {
                setChargeStatus('working')
              } else if (content.Status.status === 'Available') {
                setChargeStatus('available')
                setIsChargeDisabled(false)
              }
            }
            setEvents((prevEvents) => [...prevEvents, event])
          } catch (error) {
            console.error('Error parsing event content:', error)
            setChargeStatus('error')
            setEvents((prevEvents) => [...prevEvents, { error: 'Failed to parse event content', rawEvent: event }])
          }
        },
        oneose() {
          console.log('eose received')
        },
        onclose(reason) {
          console.log('close received:', reason)
        },
      },
    )
  }

  // reset status
  const handleReset = () => {
    // clear old subscription
    if (subscriptionRef.current) {
      subscriptionRef.current.close()
      subscriptionRef.current = null
    }

    setRecoverInfo(null)
    setEvents([])
    setChargeStatus('idle')
    setIsChargeDisabled(false)
    setInitialRequestId(null)
    setInitialPayload(null)
    setStopFlag(false)
    setIsStopPending(false)
  }

  const ProgressBar = () => {
    let progress = 0
    // let statusText = ''
    let barColor = 'bg-gray-300' // default gray

    const statusTextMap = {
      decharge: {
        requested: 'Requested - Waiting for charging station...',
        working: 'Working - Charging in progress...',
        available: `Available - Charging ${stopFlag ? 'stopped' : 'completed'}!`,
        error: 'Error - Charging failed!',
        idle: 'Idle - Ready to charge',
      },
      gacha: {
        requested: 'Requested - Waiting for gacha machine...',
        working: 'Working - Gacha in progress...',
        available: 'Available - Gacha completed!',
        error: 'Error - Gacha failed!',
        idle: 'Idle - Ready to play',
      },
    }

    const statusText = statusTextMap[selectedTab][chargeStatus]

    switch (chargeStatus) {
      case 'requested':
        progress = 33
        // statusText = 'Requested - Waiting for charging station...'
        barColor = 'bg-blue-500'
        break
      case 'working':
        progress = 66
        // statusText = 'Working - Charging in progress...'
        barColor = 'bg-blue-500'
        break
      case 'available':
        progress = 100
        // statusText = 'Available - Charging completed!'
        barColor = 'bg-green-500'
        break
      case 'error':
        progress = 100
        // statusText = 'Error - Something went wrong!'
        barColor = 'bg-red-500'
        break
      default:
        progress = 0
        // statusText = 'Idle - Ready to charge'
        barColor = 'bg-gray-300'
    }

    return (
      <div className="w-full mb-8">
        <div className="h-2 w-full bg-gray-200 rounded-full overflow-hidden">
          <div className={`h-full ${barColor} transition-all duration-500`} style={{ width: `${progress}%` }}></div>
        </div>
        <p className="mt-2 text-sm text-gray-600">{statusText}</p>
      </div>
    )
  }

  const EventJsonViewer = ({ event, index }: { event: any; index: number }) => {
    const isExpanded = expandedEventIndex === index

    const toggleExpand = () => {
      if (isExpanded) {
        setExpandedEventIndex(null)
      } else {
        setExpandedEventIndex(index)
      }
    }

    const getPurpose = () => {
      const sTag = event.tags.find((t: string[]) => t[0] === 's')?.[1]
      const eventType = sTag === 'dephy-decharge-controller' ? 'Decharge' : 'Gacha'

      try {
        const content = JSON.parse(event.content)
        if (content.Request) return `${eventType} Request`
        if (content.Status) return `${eventType} Status: ${content.Status.status}`
      } catch {
        return 'Invalid Event'
      }
      return 'Unknown Event'
    }

    const formatTime = (timestamp: number) => {
      return new Date(timestamp * 1000).toLocaleString()
    }

    return (
      <div className="mt-4 p-4 bg-base-100 rounded-lg shadow-md">
        <div className="font-bold cursor-pointer flex justify-between items-center" onClick={toggleExpand}>
          <span>
            <span className="mr-2">{isExpanded ? '▲' : '▼'}</span>
            Event {index + 1} - {getPurpose()}
          </span>
          <div className="flex items-center">
            <span className="text-sm text-gray-500 mr-2">{formatTime(event.created_at)}</span>
          </div>
        </div>
        {isExpanded && (
          <pre className="mt-2 break-all whitespace-pre-wrap text-xs">{JSON.stringify(event, null, 2)}</pre>
        )}
      </div>
    )
  }

  return publicKey ? (
    <div className="max-w-4xl mx-auto p-4">
      {/* Tab */}
      <div className="inline-flex p-1 bg-gray-100 rounded-full mb-8">
        <button
          className={`px-6 py-2 rounded-full text-sm font-medium transition-all duration-300 ${
            selectedTab === 'decharge' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
          } ${isTabDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
          onClick={() => handleSelectTab('decharge')}
          disabled={isTabDisabled}
        >
          Decharge
          {selectedTab === 'decharge' && isTabDisabled && <span className="ml-2 animate-pulse">(Processing...)</span>}
        </button>
        <button
          className={`px-6 py-2 rounded-full text-sm font-medium transition-all duration-300 ${
            selectedTab === 'gacha' ? 'bg-white text-pink-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
          } ${isTabDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
          onClick={() => handleSelectTab('gacha')}
          disabled={isTabDisabled}
        >
          Gacha
          {selectedTab === 'gacha' && isTabDisabled && <span className="ml-2 animate-pulse">(Processing...)</span>}
        </button>
      </div>

      <div className="flex flex-wrap gap-4 mb-8">
        {/* userAccount */}
        <div className="flex-1 p-4 bg-base-200 rounded-lg shadow-md">
          <h2 className="text-xl font-bold mb-2">User Account</h2>
          {userAccount ? (
            <div className="space-y-2">
              <p>
                <span className="font-semibold">Nonce:</span> <span>{userAccount.nonce.toString()}</span>
              </p>
              <p>
                <span className="font-semibold">Locked Amount:</span>{' '}
                <span>{userAccount.lockedAmount.toNumber() / 10 ** 9} SOL</span>
              </p>
              <p>
                <span className="font-semibold">Vault:</span> <span>{userAccount.vault.toString()}</span>
              </p>
              <p>
                <span className="font-semibold">Vault Balance:</span>{' '}
                <span>{vaultBalance ? `${vaultBalance / 10 ** 9} SOL` : 'Loading...'}</span>
              </p>
            </div>
          ) : (
            <div className="flex flex-col items-center">
              <p>No user account data found.</p>
              <button className="btn btn-primary mt-4" onClick={handleRegister} disabled={!publicKey}>
                Register
              </button>
            </div>
          )}
        </div>

        {/* deposit */}
        <div className="flex-1 p-4 bg-base-200 rounded-lg shadow-md">
          <h2 className="text-xl font-bold mb-4">Deposit</h2>
          <div className="space-y-4">
            <input
              type="text"
              placeholder="Amount (SOL)"
              value={depositAmount}
              onChange={(e) => setDepositAmount(e.target.value)}
              className="input input-bordered w-full placeholder:text-sm"
            />
            <button className="btn btn-primary w-full" onClick={handleDeposit} disabled={!depositAmount}>
              Deposit
            </button>
          </div>
        </div>

        {/* withdraw */}
        <div className="flex-1 p-4 bg-base-200 rounded-lg shadow-md">
          <h2 className="text-xl font-bold mb-4">Withdraw</h2>
          <div className="space-y-4">
            <input
              type="text"
              placeholder="Amount (SOL)"
              value={withdrawAmount}
              onChange={(e) => setWithdrawAmount(e.target.value)}
              className="input input-bordered w-full placeholder:text-sm"
            />
            <button className="btn btn-primary w-full" onClick={handleWithdraw} disabled={!withdrawAmount}>
              Withdraw
            </button>
          </div>
        </div>
      </div>

      <div className="mb-8 p-4 bg-base-200 rounded-lg shadow-md">
        <h2 className="text-xl font-bold mb-4">{selectedTab === 'decharge' ? 'Charge' : 'Gacha'}</h2>
        <ProgressBar />

        {events.map((event, index) => (
          <EventJsonViewer key={index} event={event} index={index} />
        ))}

        {/* reset */}
        {chargeStatus === 'available' && (
          <button className="btn btn-secondary w-full mt-4" onClick={handleReset}>
            Reset
          </button>
        )}

        {serialNumberBytes && (
          <div className="mt-4 p-4 bg-base-100 rounded-lg shadow-md">
            <h2 className="text-xl font-bold mb-2">Charger Serial Number</h2>
            <p className="break-all">{serialNumberStr}</p>
          </div>
        )}

        <div className="mt-4 p-4 bg-base-100 rounded-lg shadow-md">
          <h2 className="text-xl font-bold mb-2">Machine Pubkey</h2>
          <input
            type="text"
            placeholder="Enter Machine Pubkey"
            value={machinePubkey || ''}
            onChange={(e) => setMachinePubkey(e.target.value)}
            className="input input-bordered w-full placeholder:text-sm mt-4"
          />
        </div>

        {/* charge */}
        <button
          className={`btn w-full mt-4 border-none ${
            selectedTab === 'decharge' ? 'bg-blue-500 hover:bg-blue-600' : 'bg-pink-500 hover:bg-pink-600'
          } text-white`}
          onClick={handleCharge}
          disabled={!wallet || !serialNumberBytes || !machinePubkey || isChargeDisabled || chargeStatus !== 'idle'}
        >
          {selectedTab === 'decharge' ? 'Start Charge' : 'Play Gacha'}
        </button>

        {/* stop */}
        {selectedTab === 'decharge' && (
          <button
            className="btn w-full mt-2 bg-red-500 hover:bg-red-600 text-white border-none"
            onClick={handleStop}
            disabled={chargeStatus !== 'working' || !initialRequestId || isStopPending} 
          >
            {isStopPending ? (
              <span className="flex items-center justify-center">
                <svg className="animate-spin h-5 w-5 mr-2" viewBox="0 0 24 24">
                  <path
                    fill="currentColor"
                    d="M12,4V1L8,5l4,4V6c3.31,0,6,2.69,6,6c0,1.01-.25,1.97-.7,2.8l1.46,1.46C19.54,15.03,20,13.57,20,12c0-4.42-3.58-8-8-8zm0,14c-3.31,0-6-2.69-6-6c0-1.01.25-1.97.7-2.8L5.24,7.74C4.46,8.97,4,10.43,4,12c0,4.42,3.58,8,8,8v3l4-4l-4-4V18z"
                  />
                </svg>
                Stopping...
              </span>
            ) : (
              'Stop Charge'
            )}
          </button>
        )}

        {recoverInfo && (
          <div className="mt-6 p-6 bg-base-100 rounded-lg shadow-md">
            <h2 className="text-xl font-bold mb-4">Recover Info</h2>
            <div className="space-y-2">
              <p>
                <span className="font-semibold">Signature:</span>{' '}
                <span className="break-all">{recoverInfo.signature.join(', ')}</span>
              </p>
              <p>
                <span className="font-semibold">Payload:</span>{' '}
                <span className="break-all">{recoverInfo.payload.join(', ')}</span>
              </p>
              <p>
                <span className="font-semibold">Deadline:</span> <span>{recoverInfo.deadline.toString()}</span>
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  ) : (
    <div className="max-w-4xl mx-auto">
      <div className="hero py-[64px]">
        <div className="hero-content text-center">
          <WalletButton />
        </div>
      </div>
    </div>
  )
}
