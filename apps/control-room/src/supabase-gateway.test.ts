import { afterEach, describe, expect, it, vi } from "vitest";
import { bearerToken, persistBrand, requestEmailOtp, verifyEmailOtp, type SupabaseRuntimeConfig } from "./supabase-gateway.js";

const config: SupabaseRuntimeConfig = { url: "https://project.supabase.co", publishableKey: "sb_publishable_test" };

afterEach(() => vi.unstubAllGlobals());

describe("supabase gateway", () => {
  it("requests and verifies an email OTP without putting it in the URL", async () => {
    const mockedFetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({}), { status: 200 }));
    vi.stubGlobal("fetch", mockedFetch);
    await requestEmailOtp(config, "owner@example.com");
    await verifyEmailOtp(config, "owner@example.com", "123456");
    const [url, init] = mockedFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://project.supabase.co/auth/v1/otp");
    expect(init.body).toBe(JSON.stringify({ email: "owner@example.com", create_user: true }));
    expect((init.headers as Record<string, string>).apikey).toBe("sb_publishable_test");
    const [verifyUrl, verifyInit] = mockedFetch.mock.calls[1] as [string, RequestInit];
    expect(verifyUrl).toBe("https://project.supabase.co/auth/v1/verify");
    expect(JSON.parse(String(verifyInit.body)).token).toBe("123456");
  });

  it("persists a brand using the caller token and workspace boundary", async () => {
    const mockedFetch = vi.fn().mockResolvedValue(new Response(JSON.stringify([]), { status: 201 }));
    vi.stubGlobal("fetch", mockedFetch);
    await persistBrand(config, "user-token", "workspace-id", {
      id: "rigzip",
      name: "RigZip",
      archetype: "LOCAL_TWO_SIDED_MARKETPLACE",
      offering: "Commercial vehicle rental",
      audience: "Businesses",
      businessModel: "Commission",
      objectives: ["Validate demand"],
      primaryValueEvent: "completed_booking",
      targetGeographies: ["US"],
      languages: ["en"],
      constraints: [],
      status: "DISCOVERY",
    });
    const [, init] = mockedFetch.mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer user-token");
    expect(JSON.parse(String(init.body)).workspace_id).toBe("workspace-id");
  });

  it("accepts only a well-formed bearer token", () => {
    expect(bearerToken("Bearer abc.def")).toBe("abc.def");
    expect(bearerToken("Basic abc")).toBeNull();
    expect(bearerToken(undefined)).toBeNull();
  });
});
