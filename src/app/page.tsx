"use client";

import { useAutoConnect } from "@/components/AutoConnectProvider";
import { DisplayValue, LabelValueGrid } from "@/components/LabelValueGrid";
import { ThemeToggle } from "@/components/ThemeToggle";
import { WalletSelector as ShadcnWalletSelector } from "@/components/WalletSelector";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import { isMainnet } from "@/utils";
import { Aptos, AptosConfig, Network } from "@aptos-labs/ts-sdk";
import { WalletSelector as AntdWalletSelector } from "@aptos-labs/wallet-adapter-ant-design";
import { WalletConnector as MuiWalletSelector } from "@aptos-labs/wallet-adapter-mui-design";
import {
	AccountInfo,
	AptosChangeNetworkOutput,
	NetworkInfo,
	WalletInfo,
	isAptosNetwork,
	useWallet,
} from "@aptos-labs/wallet-adapter-react";
import { init as initTelegram } from "@telegram-apps/sdk";
import { AlertCircle, Loader2 } from "lucide-react";
import Image from "next/image";
import { AgentRuntime, createAptosTools, WalletSigner } from "move-agent-kit";
import { ChatAnthropic } from "@langchain/anthropic";
import { AgentExecutor, createReactAgent } from "langchain/agents";
import {
	ChatPromptTemplate,
	SystemMessagePromptTemplate,
	HumanMessagePromptTemplate,
} from "@langchain/core/prompts";

// Imports for registering a browser extension wallet plugin on page load
import { MyWallet } from "@/utils/standardWallet";
import { registerWallet } from "@aptos-labs/wallet-standard";
import { HumanMessage } from "@langchain/core/messages";
import { Button } from "@/components/ui/button";
import { pull } from "langchain/hub";
import { useEffect, useState } from "react";

// Example of how to register a browser extension wallet plugin.
// Browser extension wallets should call registerWallet once on page load.
// When you click "Connect Wallet", you should see "Example Wallet"
(function () {
	if (typeof window === "undefined") return;
	const myWallet = new MyWallet();
	registerWallet(myWallet);
})();

const isTelegramMiniApp =
	typeof window !== "undefined" &&
	(window as any).TelegramWebviewProxy !== undefined;
if (isTelegramMiniApp) {
	initTelegram();
}

export default function Home() {
	const {
		account,
		connected,
		network,
		wallet,
		changeNetwork,
		signAndSubmitTransaction,
		signMessage,
		signTransaction,
	} = useWallet();
	const [response, setResponse] = useState({} as any)
	const [isLoading, setIsLoading] = useState(false)
	const [input, setInput] = useState("")

	// wallet signer
	const signer = new WalletSigner({} as any, useWallet());
	const aptos = new Aptos(
		new AptosConfig({
			network: Network.MAINNET,
		})
	);
	const agentRuntime = new AgentRuntime(signer, aptos);
	const tools = createAptosTools(agentRuntime);

	// Setup LLM -- can use OpenAI or any other supported LLM
	const llm = new ChatAnthropic({
		temperature: 0.7,
		model: "claude-3-5-sonnet-20241022",
		anthropicApiKey:
			process.env.NEXT_PUBLIC_ANTHROPIC_API_KEY
	});

	const getAiResponse = async () => {
		setIsLoading(true)
		try {
			const chatPrompt = (await pull<ChatPromptTemplate>("hwchase17/react"))
	
			const agent = await createReactAgent({
				llm,
				tools,
				prompt: chatPrompt
			});
	
			const agentExecutor = new AgentExecutor({
				agent,
				tools,
			});

			if(!input) {
				throw new Error("input required") 
			}
	
			// output can be streamed too
			const r = await agentExecutor.invoke({
				input: input,
			});
	
			setResponse(r)
			setIsLoading(false)
		} catch (e: any) {
			setIsLoading(false)
			alert(e.message)
		}
	};

	return (
		<main className="flex flex-col w-full max-w-[1000px] p-6 pb-12 md:px-8 gap-6">
			<div className="flex justify-between gap-6 pb-10">
				<div className="flex flex-col gap-2 md:gap-3">
					<h1 className="text-xl sm:text-3xl font-semibold tracking-tight">
						Aptos Wallet Adapter Tester
						{network?.name ? ` — ${network.name}` : ""}
					</h1>
					<a
						href="https://github.com/aptos-labs/aptos-wallet-adapter/tree/main/apps/nextjs-example"
						target="_blank"
						rel="noreferrer"
						className="text-sm text-muted-foreground underline underline-offset-2 font-medium leading-none"
					>
						Demo App Source Code
					</a>
				</div>
				<ThemeToggle />
			</div>
			<WalletSelection />
			{connected && (
				<WalletConnection
					account={account}
					network={network}
					wallet={wallet}
					changeNetwork={changeNetwork}
				/>
			)}
			{connected && isMainnet(connected, network?.name) && (
				<Alert variant="warning">
					<AlertCircle className="h-4 w-4" />
					<AlertTitle>Warning</AlertTitle>
					<AlertDescription>
						The transactions flows below will not work on the Mainnet network.
					</AlertDescription>
				</Alert>
			)}
			{connected && (
				<>
					<Card>
						<CardHeader>
							<CardTitle>Get Address Through Agent</CardTitle>
						</CardHeader>
						<CardContent className="flex flex-col flex-wrap gap-4">
							<input onChange={(e) => setInput(e.target.value)} className="p-2 border border-white rounded-lg" placeholder="Query" />
							<Button onClick={getAiResponse}>
								{isLoading ? <Loader2  /> : <>Get Response</>}
							</Button>
							{response && 
								<div className="flex flex-col gap-6">
									<h4 className="text-lg font-medium">Response</h4>
									<LabelValueGrid
										items={[
											{
												label: "Input",
												value: response.input
											},
											{
												label: "Output",
												value: response.output
											}
										]}
									/>
								</div>
							}
						</CardContent>
					</Card>
				</>
			)}
		</main>
	);
}

function WalletSelection() {
	const { autoConnect, setAutoConnect } = useAutoConnect();

	return (
		<Card>
			<CardHeader>
				<CardTitle>Wallet Selection</CardTitle>
				<CardDescription>
					Connect a wallet using one of the following wallet selectors.
				</CardDescription>
			</CardHeader>
			<CardContent>
				<div className="flex flex-wrap gap-6 pt-6 pb-12 justify-between items-center">
					<div className="flex flex-col gap-4 items-center">
						<div className="text-sm text-muted-foreground">shadcn/ui</div>
						<ShadcnWalletSelector />
					</div>
					<div className="flex flex-col gap-4 items-center">
						<div className="text-sm text-muted-foreground">Ant Design</div>
						<AntdWalletSelector />
					</div>
					<div className="flex flex-col gap-4 items-center">
						<div className="text-sm text-muted-foreground">Material UI</div>
						<MuiWalletSelector />
					</div>
				</div>
				<label className="flex items-center gap-4 cursor-pointer">
					<Switch
						id="auto-connect-switch"
						checked={autoConnect}
						onCheckedChange={setAutoConnect}
					/>
					<Label htmlFor="auto-connect-switch">
						Auto reconnect on page load
					</Label>
				</label>
			</CardContent>
		</Card>
	);
}

interface WalletConnectionProps {
	account: AccountInfo | null;
	network: NetworkInfo | null;
	wallet: WalletInfo | null;
	changeNetwork: (network: Network) => Promise<AptosChangeNetworkOutput>;
}

function WalletConnection({
	account,
	network,
	wallet,
	changeNetwork,
}: WalletConnectionProps) {
	const isValidNetworkName = () => {
		if (isAptosNetwork(network)) {
			return Object.values<string | undefined>(Network).includes(network?.name);
		}
		// If the configured network is not an Aptos network, i.e is a custom network
		// we resolve it as a valid network name
		return true;
	};

	// TODO: Do a proper check for network change support
	const isNetworkChangeSupported = wallet?.name === "Nightly";

	return (
		<Card>
			<CardHeader>
				<CardTitle>Wallet Connection</CardTitle>
			</CardHeader>
			<CardContent className="flex flex-col gap-10 pt-6">
				<div className="flex flex-col gap-6">
					<h4 className="text-lg font-medium">Wallet Details</h4>
					<LabelValueGrid
						items={[
							{
								label: "Icon",
								value: wallet?.icon ? (
									<Image
										src={wallet.icon}
										alt={wallet.name}
										width={24}
										height={24}
									/>
								) : (
									"Not Present"
								),
							},
							{
								label: "Name",
								value: <p>{wallet?.name ?? "Not Present"}</p>,
							},
							{
								label: "URL",
								value: wallet?.url ? (
									<a
										href={wallet.url}
										target="_blank"
										rel="noreferrer"
										className="text-blue-600 dark:text-blue-300"
									>
										{wallet.url}
									</a>
								) : (
									"Not Present"
								),
							},
						]}
					/>
				</div>

				<div className="flex flex-col gap-6">
					<h4 className="text-lg font-medium">Account Info</h4>
					<LabelValueGrid
						items={[
							{
								label: "Address",
								value: (
									<DisplayValue
										value={account?.address ?? "Not Present"}
										isCorrect={!!account?.address}
									/>
								),
							},
							{
								label: "Public key",
								value: (
									<DisplayValue
										value={account?.publicKey.toString() ?? "Not Present"}
										isCorrect={!!account?.publicKey}
									/>
								),
							},
							{
								label: "ANS name",
								subLabel: "(only if attached)",
								value: <p>{account?.ansName ?? "Not Present"}</p>,
							},
							{
								label: "Min keys required",
								subLabel: "(only for multisig)",
								value: (
									<p>{account?.minKeysRequired?.toString() ?? "Not Present"}</p>
								),
							},
						]}
					/>
				</div>

				<div className="flex flex-col gap-6">
					<h4 className="text-lg font-medium">Network Info</h4>
					<LabelValueGrid
						items={[
							{
								label: "Network name",
								value: (
									<DisplayValue
										value={network?.name ?? "Not Present"}
										isCorrect={isValidNetworkName()}
										expected={Object.values<string>(Network).join(", ")}
									/>
								),
							},
							{
								label: "URL",
								value: network?.url ? (
									<a
										href={network.url}
										target="_blank"
										rel="noreferrer"
										className="text-blue-600 dark:text-blue-300"
									>
										{network.url}
									</a>
								) : (
									"Not Present"
								),
							},
							{
								label: "Chain ID",
								value: <p>{network?.chainId ?? "Not Present"}</p>,
							},
						]}
					/>
				</div>

				<div className="flex flex-col gap-6">
					<h4 className="text-lg font-medium">Change Network</h4>
					<RadioGroup
						value={network?.name}
						orientation="horizontal"
						className="flex gap-6"
						onValueChange={(value: Network) => changeNetwork(value)}
						disabled={!isNetworkChangeSupported}
					>
						<div className="flex items-center space-x-2">
							<RadioGroupItem value={Network.DEVNET} id="devnet-radio" />
							<Label htmlFor="devnet-radio">Devnet</Label>
						</div>
						<div className="flex items-center space-x-2">
							<RadioGroupItem value={Network.TESTNET} id="testnet-radio" />
							<Label htmlFor="testnet-radio">Testnet</Label>
						</div>
						<div className="flex items-center space-x-2">
							<RadioGroupItem value={Network.MAINNET} id="mainnet-radio" />
							<Label htmlFor="mainnet-radio">Mainnet</Label>
						</div>
					</RadioGroup>
					{!isNetworkChangeSupported && (
						<div className="text-sm text-red-600 dark:text-red-400">
							* {wallet?.name ?? "This wallet"} does not support network change
							requests
						</div>
					)}
				</div>
			</CardContent>
		</Card>
	);
}
