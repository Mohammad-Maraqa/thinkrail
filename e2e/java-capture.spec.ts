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
	}
	await page.evaluate(() => document.fonts.ready);
	mkdirSync(".thinkrail/context/pr-shots", { recursive: true });
	await page.screenshot({
		path: `.thinkrail/context/pr-shots/java-${process.env.JAVA_CAPTURE_PHASE}.png`,
		animations: "disabled",
	});
});
