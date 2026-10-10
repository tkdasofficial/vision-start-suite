import { describe, expect, it } from "vitest";
import { providerCallbackUrl } from "@/lib/cloud/oauth-urls";

describe("providerCallbackUrl", () => {
  it("builds the callback for each provider from one origin", () => {
    const origin = "https://project--e26fe501-ea6b-4f0e-b783-e17668983052.lovable.app";
    expect(providerCallbackUrl(origin, "google")).toBe(`${origin}/google/callback`);
    expect(providerCallbackUrl(origin, "github")).toBe(`${origin}/github/callback`);
    expect(providerCallbackUrl(origin, "cloudflare")).toBe(`${origin}/cloudflare/callback`);
  });

  it("trims a trailing slash so provider dashboards stay 200 OK", () => {
    expect(providerCallbackUrl("https://vision.example.com/", "cloudflare")).toBe(
      "https://vision.example.com/cloudflare/callback"
    );
  });

  it("keeps the exact origin when it has no trailing slash", () => {
    expect(providerCallbackUrl("https://id-preview--e26fe501-ea6b-4f0e-b783-e17668983052.lovable.app", "google")).toBe(
      "https://id-preview--e26fe501-ea6b-4f0e-b783-e17668983052.lovable.app/google/callback"
    );
  });
});
