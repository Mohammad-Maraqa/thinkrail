import { expect, test } from "bun:test";
import { createJavaScriptRegexEngine } from "shiki/engine/javascript";
import {
	chatShikiLanguageId,
	createChatHighlighter,
	SHIKI_FILE_LANGUAGES,
	shikiLanguageId,
} from "./highlighter";

test("the Monaco Shiki language registration list has no duplicate ids", () => {
	const ids = SHIKI_FILE_LANGUAGES.map((language) => language.id);
	expect(new Set(ids).size).toBe(ids.length);
});

test("Scala is recognized for chat fences and Scala files", () => {
	const scala = SHIKI_FILE_LANGUAGES.find((language) => language.id === "scala");
	expect(scala?.extensions).toContain(".scala");
	expect(scala?.chat).toBe(true);
	expect(shikiLanguageId("Scala")).toBe("scala");
	expect(chatShikiLanguageId("scala")).toBe("scala");
});

test("Java is recognized for chat fences and Java files", () => {
	const java = SHIKI_FILE_LANGUAGES.find((language) => language.id === "java");
	expect(java?.extensions).toContain(".java");
	expect(java?.chat).toBe(true);
	for (const alias of ["java", "Java", " JAVA "]) {
		expect(shikiLanguageId(alias)).toBe("java");
		expect(chatShikiLanguageId(alias)).toBe("java");
	}
	expect(shikiLanguageId("Kotlin")).toBe("kotlin");
	expect(chatShikiLanguageId("Kotlin")).toBeNull();
	expect(chatShikiLanguageId("mermaid")).toBeNull();
	expect(chatShikiLanguageId("unknown-language")).toBeNull();
});

test("a Java chat fence renders with Shiki tokens", async () => {
	const highlight = createChatHighlighter(createJavaScriptRegexEngine);
	const code = 'public class Greeting { private String message = "hello"; }';
	const html = await highlight(code, "Java");
	expect(html).toContain('class="shiki');
	expect(html).toContain("<span");
	expect(html).toContain("--code-keyword");
	expect(html?.replace(/<[^>]+>/g, "").replaceAll("&quot;", '"')).toBe(code);
	expect(await highlight(code, "java")).toBe(html);
});

test("a Scala chat fence renders with Shiki tokens", async () => {
	const highlight = createChatHighlighter(createJavaScriptRegexEngine);
	const html = await highlight('object Greeting { val message: String = "hello" }', "scala");
	expect(html).not.toBeNull();
	expect(html).toContain("<span");
});

test("every Monaco language id is supplied by its Shiki grammar", async () => {
	const modules = await Promise.all(SHIKI_FILE_LANGUAGES.map((language) => language.load()));
	for (const [index, language] of SHIKI_FILE_LANGUAGES.entries()) {
		expect(
			modules[index]?.default.some((registration) => registration.name === language.id),
			language.id,
		).toBe(true);
	}
});
