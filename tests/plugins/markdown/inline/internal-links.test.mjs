import assert from "node:assert/strict";
import { afterEach, test } from "node:test";

import {
	resolveInternalHref,
	setInternalLinkBase,
} from "../../../../src/plugins/rehype-internal-links.mjs";
import { siteMarkdownProcessor } from "../../../../src/utils/markdown-processor.mjs";

const renderer = await siteMarkdownProcessor.createRenderer({});

async function render(markdown) {
	const { code } = await renderer.render(markdown);
	return code;
}

afterEach(() => {
	setInternalLinkBase("/");
});

test("renders ama:// links as site-root paths when base is /", async () => {
	const html = await render("[第二篇](ama://posts/second-blog/)");
	assert.match(html, /<a href="\/posts\/second-blog\/">第二篇<\/a>/);
});

test("prefixes ama:// links with the configured site base", async () => {
	setInternalLinkBase("/amara-blog/");
	const html = await render("[第二篇](ama://posts/second-blog/)");
	assert.match(html, /<a href="\/amara-blog\/posts\/second-blog\/">第二篇<\/a>/);
});

test("normalizes a base written without surrounding slashes", async () => {
	setInternalLinkBase("amara-blog");
	const html = await render("[归档](ama://archive/)");
	assert.match(html, /<a href="\/amara-blog\/archive\/">归档<\/a>/);
});

test("keeps hash and query in the rewritten href", async () => {
	const html = await render("[小节](ama://posts/second-blog/#sec)");
	assert.match(html, /<a href="\/posts\/second-blog\/#sec">小节<\/a>/);

	// 非 ASCII 锚点会被 micromark 百分号编码，改写只负责前缀，不应影响这部分
	const encoded = await render("[小节](ama://posts/second-blog/#小结)");
	assert.match(encoded, /href="\/posts\/second-blog\/#%E5%B0%8F%E7%BB%93"/);
});

test("leaves ordinary links, images and anchors untouched", async () => {
	const html = await render(
		[
			"[absolute](/posts/second-blog/)",
			"[relative](../second-blog/)",
			"[external](https://example.com/x)",
			"![image](/images/demo.webp)",
			"[anchor](#section)",
		].join("\n\n"),
	);
	assert.match(html, /<a href="\/posts\/second-blog\/">absolute<\/a>/);
	assert.match(html, /<a href="\.\.\/second-blog\/">relative<\/a>/);
	assert.match(html, /<a href="https:\/\/example\.com\/x">external<\/a>/);
	assert.match(html, /<img src="\/images\/demo\.webp"/);
	assert.match(html, /<a href="#section">anchor<\/a>/);
});

test("is idempotent for already rewritten links", async () => {
	const html = await render("[second](/amara-blog/posts/second-blog/)");
	setInternalLinkBase("/amara-blog/");
	assert.match(html, /<a href="\/amara-blog\/posts\/second-blog\/">second<\/a>/);
});

test("resolveInternalHref handles scheme variants", () => {
	const cases = [
		["ama://posts/a/", "/posts/a/"],
		["ama:///posts/a/", "/posts/a/"],
		["ama:/posts/a/", "/posts/a/"],
		["ama:posts/a/", "/posts/a/"],
		["ama://", "/"],
		["ama://posts/a/?page=2", "/posts/a/?page=2"],
	];
	for (const [input, expected] of cases) {
		assert.equal(resolveInternalHref(input, "/"), expected, input);
	}
	assert.equal(
		resolveInternalHref("ama://posts/a/", "/amara-blog/"),
		"/amara-blog/posts/a/",
	);
});

test("resolveInternalHref leaves non-scheme hrefs alone", () => {
	for (const href of [
		"/posts/a/",
		"../posts/a/",
		"https://example.com/ama://x",
		"#ama://anchor",
		"mailto:a@example.com",
	]) {
		assert.equal(resolveInternalHref(href, "/amara-blog/"), href);
	}
});
