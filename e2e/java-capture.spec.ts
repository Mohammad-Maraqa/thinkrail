import { mkdirSync, realpathSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { enterDefaultWorkspace, openFixtureProject, openPersistedChat } from "./fixtures/app";
import { E2E_FIXTURE_REPO } from "./fixtures/paths";
import { seedWorkspaceSession } from "./fixtures/sessions";

test("Java chat highlighting review evidence", async ({ page }) => {
	await page.setViewportSize({ width: 1280, height: 900 });
	const workers: string[] = [];
	page.on("worker", (worker) => workers.push(worker.url()));
	await openFixtureProject(page);
	const code = [
		"public class Greeting {",
		'    private final String message = "Hello, Java!";',
		"",
		"    public String greet(String name) {",
		'        return message + " " + name;',
		"    }",
		"}",
	].join("\n");
	seedWorkspaceSession(realpathSync(E2E_FIXTURE_REPO), {
		name: "Java syntax highlighting",
		messages: [
			{ role: "user", text: "Show a Java greeting class.", timestamp: 1_700_300_000_000 },
			{
				role: "assistant",
				text: `Here is a Java greeting class:\n\n\`\`\`java\n${code}\n\`\`\``,
				timestamp: 1_700_300_001_000,
			},
		],
	});
	await enterDefaultWorkspace(page);
	await openPersistedChat(page, "Java syntax highlighting");
	const message = page.locator('[data-testid="chat-message"][data-role="assistant"]');
	const block = message.locator("pre").last();
	await expect(block).toContainText(code);
	if (process.env.JAVA_CAPTURE_PHASE === "before") {
		await expect(block.locator("span")).toHaveCount(0);
	} else {
		await expect(block).toHaveClass(/shiki/);
		await expect(block.locator('span[style*="--code-keyword"]').first()).toBeVisible();
		expect(workers.some((url) => url.includes("highlighter.worker"))).toBe(true);
		const worker = page.workers().find((entry) => entry.url().includes("highlighter.worker"));
		if (!worker) throw new Error("No production highlighter worker");
		const reply = await worker.evaluate(async () => {
			type Reply = { id: number; html: string | null; failed?: boolean };
			const scope = globalThis as unknown as {
				postMessage: (reply: Reply) => void;
				onmessage: ((event: MessageEvent) => void) | null;
			};
			const original = scope.postMessage;
			let timer: ReturnType<typeof setTimeout> | undefined;
			try {
				return await new Promise<Reply>((resolve, reject) => {
					timer = setTimeout(() => reject(new Error("Java worker probe timed out")), 10_000);
					scope.postMessage = (result) => {
						if (result.id === -117300001) resolve(result);
						else original.call(scope, result);
					};
					if (!scope.onmessage) throw new Error("Worker handler missing");
					scope.onmessage(
						new MessageEvent("message", {
							data: {
								id: -117300001,
								code: 'public class WorkerProof { private String message = "hello"; }',
								lang: "java",
							},
						}),
					);
				});
			} finally {
				clearTimeout(timer);
				scope.postMessage = original;
			}
		});
		expect(reply.failed).not.toBe(true);
		expect(reply.html).toContain('class="shiki');
		expect(reply.html).toContain("--code-keyword");
		expect(reply.html?.replace(/<[^>]+>/g, "").replaceAll("&quot;", '"')).toBe(
			'public class WorkerProof { private String message = "hello"; }',
		);
		console.log("JAVA_WASM_WORKER_PROBE", JSON.stringify(reply));
	}
	await page.evaluate(() => document.fonts.ready);
	mkdirSync(".thinkrail/context/pr-shots", { recursive: true });
	await page.screenshot({
		path: `.thinkrail/context/pr-shots/java-${process.env.JAVA_CAPTURE_PHASE}.png`,
		animations: "disabled",
	});
});
