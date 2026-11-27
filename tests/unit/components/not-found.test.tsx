import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import NotFound from "@/app/not-found";

describe("not-found page", () => {
  const html = renderToStaticMarkup(<NotFound />);
  it("renders the copy and a heading", () => {
    expect(html).toMatch(/<h1[^>]*>This room isn(&#x27;|')t here\.<\/h1>/);
    expect(html).toContain("Lost your way");
    expect(html).toContain("The rest of the club does.");
  });
  it("links back to the floor", () => {
    expect(html).toMatch(/<a[^>]*href="\/"[^>]*>Back to the floor<\/a>/);
  });
  it("uses the brand header and sheet styling hooks", () => {
    expect(html).toContain('id="top"');
    expect(html).toContain('src="/brand/logo.png"');
    expect(html).toContain('id="lost"');
    expect(html).toContain('id="book"');
  });
});
