import { handleOAuthUserInfo, linkOAuthAccount } from "better-auth/oauth2";
import { beforeEach, describe, expect, it, vi } from "vitest";

function makeUnsignedJwt(payload: Record<string, unknown>): string {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${header}.${body}.sig`;
}

describe("Better Auth LINE configuration & email-only access policy", () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.LINE_CLIENT_ID = "test-line-channel-id";
    process.env.LINE_CLIENT_SECRET = "test-line-channel-secret";
    process.env.GOOGLE_CLIENT_ID = "test-google-client-id";
    process.env.GOOGLE_CLIENT_SECRET = "test-google-client-secret";
  });

  it("registers LINE social provider with disableSignUp and trustedProviders linking", async () => {
    const { auth } = await import("./auth");
    const ctx = await auth.$context;

    const lineProvider = ctx.socialProviders.find((p) => p.id === "line");
    expect(lineProvider).toBeDefined();
    expect(lineProvider?.options?.disableSignUp).toBe(true);
    expect(ctx.trustedProviders).toContain("line");
    expect(ctx.trustedProviders).toContain("google");
    expect(ctx.options.account?.accountLinking?.allowDifferentEmails).toBe(true);
  });

  it("returns null email from unlinked LINE profile when email claim is missing or whitespace-only", async () => {
    const { auth, pool } = await import("./auth");
    vi.spyOn(pool, "query").mockResolvedValue({ rows: [] } as never);
    const ctx = await auth.$context;
    const lineProvider = ctx.socialProviders.find((p) => p.id === "line");
    expect(lineProvider).toBeDefined();

    const noEmailResult = await lineProvider!.getUserInfo({
      accessToken: "line-access",
      idToken: makeUnsignedJwt({
        sub: "U1234567890",
        name: "LINE Officer",
        picture: "https://profile.line-scdn.net/avatar.jpg",
      }),
    });
    expect(noEmailResult?.user.email).toBeNull();

    const blankEmailResult = await lineProvider!.getUserInfo({
      accessToken: "line-access",
      idToken: makeUnsignedJwt({
        sub: "U1234567890",
        name: "LINE Officer",
        email: "   ",
      }),
    });
    expect(blankEmailResult?.user.email).toBeNull();
  });

  it("resolves linked DB user email for pre-connected LINE account without LINE email claim", async () => {
    const { auth, pool } = await import("./auth");
    const querySpy = vi
      .spyOn(pool, "query")
      .mockResolvedValue({ rows: [{ email: "Somchai.P@Fisheries.GO.TH" }] } as never);
    const ctx = await auth.$context;
    const lineProvider = ctx.socialProviders.find((p) => p.id === "line");

    const info = await lineProvider!.getUserInfo({
      accessToken: "line-access",
      idToken: makeUnsignedJwt({
        sub: "U-linked-no-email",
        name: "Somchai LINE",
        picture: "https://profile.line-scdn.net/somchai.jpg",
      }),
    });

    expect(querySpy).toHaveBeenCalledWith(expect.stringContaining("provider_id = 'line'"), [
      "U-linked-no-email",
    ]);
    expect(info?.user.email).toBe("somchai.p@fisheries.go.th");
  });

  it("links LINE without email and Google with personal email via Connect & Sync when authenticated", async () => {
    const { auth } = await import("./auth");
    const ctx = await auth.$context;

    const createAccountSpy = vi.fn().mockResolvedValue({
      id: "acc-linked-1",
      providerId: "line",
      accountId: "U-no-email",
      userId: "user-001",
    });
    const fakeAdapter = {
      findAccountByKey: vi.fn().mockResolvedValue(null),
      createAccount: createAccountSpy,
      updateUser: vi.fn(),
    };
    const fakeContext = Object.assign(Object.create(Object.getPrototypeOf(ctx)), ctx, {
      internalAdapter: fakeAdapter,
    });
    const endpointCtx = {
      context: fakeContext,
      request: new Request("http://localhost:3000/api/auth/callback/line"),
    } as unknown as Parameters<typeof linkOAuthAccount>[0];

    const lineLinkResult = await linkOAuthAccount(endpointCtx, {
      link: { userId: "user-001", email: "somchai@fisheries.go.th" },
      userInfo: {
        name: "LINE Somchai",
        email: null as unknown as string,
        emailVerified: false,
      },
      account: {
        providerId: "line",
        accountId: "U-no-email",
        accessToken: "line-token",
      },
      profile: { sub: "U-no-email" },
      scopes: ["openid", "profile", "email"],
    });
    expect(lineLinkResult).toEqual({ linked: true });

    const googleLinkResult = await linkOAuthAccount(endpointCtx, {
      link: { userId: "user-001", email: "somchai@fisheries.go.th" },
      userInfo: {
        name: "Somchai Personal",
        email: "somchai.personal@gmail.com",
        emailVerified: true,
      },
      account: {
        providerId: "google",
        accountId: "G-personal",
        accessToken: "google-token",
      },
      profile: { sub: "G-personal", email: "somchai.personal@gmail.com" },
      scopes: ["openid", "profile", "email"],
    });
    expect(googleLinkResult).toEqual({ linked: true });
    expect(createAccountSpy).toHaveBeenCalledTimes(2);
  });

  it("normalizes returned LINE email and preserves avatar URL", async () => {
    const { auth } = await import("./auth");
    const ctx = await auth.$context;
    const lineProvider = ctx.socialProviders.find((p) => p.id === "line");

    const info = await lineProvider!.getUserInfo({
      accessToken: "line-access",
      idToken: makeUnsignedJwt({
        sub: "U99999",
        name: "Somchai",
        email: "  Somchai.P@Fisheries.GO.TH ",
        picture: "https://profile.line-scdn.net/somchai.jpg",
      }),
    });

    expect(info?.user.email).toBe("somchai.p@fisheries.go.th");
    expect(info?.user.image).toBe("https://profile.line-scdn.net/somchai.jpg");
  });

  it("denies sign-in with signup disabled when LINE email is not pre-registered in DB", async () => {
    const { auth } = await import("./auth");
    const ctx = await auth.$context;
    const lineProvider = ctx.socialProviders.find((p) => p.id === "line")!;

    const createUserSpy = vi.fn();
    const fakeAdapter = {
      findAccountOwnerByKey: vi.fn().mockResolvedValue(null),
      findUserByEmail: vi.fn().mockResolvedValue(null),
      createUser: createUserSpy,
    };

    const fakeContext = Object.assign(Object.create(Object.getPrototypeOf(ctx)), ctx, {
      internalAdapter: fakeAdapter,
    });
    const endpointCtx = {
      context: fakeContext,
      request: new Request("http://localhost:3000/api/auth/callback/line"),
    } as unknown as Parameters<typeof handleOAuthUserInfo>[0];

    const result = await handleOAuthUserInfo(endpointCtx, {
      userInfo: {
        id: "U-unregistered",
        name: "Outsider",
        email: "outsider@gmail.com",
        emailVerified: false,
      },
      account: {
        providerId: "line",
        accountId: "U-unregistered",
        accessToken: "token",
      },
      callbackURL: "/",
      disableSignUp: lineProvider.options?.disableSignUp,
    });

    expect(result.error).toBe("signup disabled");
    expect(result.data).toBeNull();
    expect(fakeAdapter.findUserByEmail).toHaveBeenCalledWith("outsider@gmail.com", {
      includeAccounts: true,
    });
    expect(createUserSpy).not.toHaveBeenCalled();
  });

  it("links LINE account and issues session when LINE email matches existing DB user", async () => {
    const { auth } = await import("./auth");
    const ctx = await auth.$context;
    const lineProvider = ctx.socialProviders.find((p) => p.id === "line")!;

    const existingUser = {
      id: "user-001",
      name: "สมชาย ประมง",
      email: "somchai@fisheries.go.th",
      emailVerified: false,
      role: "user",
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const linkAccountSpy = vi.fn().mockResolvedValue({
      id: "acc-line-1",
      providerId: "line",
      accountId: "U-registered",
      userId: "user-001",
    });
    const createSessionSpy = vi.fn().mockResolvedValue({
      id: "sess-1",
      token: "session-token-123",
      userId: "user-001",
      expiresAt: new Date(Date.now() + 86400_000),
    });

    const fakeAdapter = {
      findAccountOwnerByKey: vi.fn().mockResolvedValue(null),
      findUserByEmail: vi.fn().mockResolvedValue({
        user: existingUser,
        accounts: [],
      }),
      linkAccount: linkAccountSpy,
      createSession: createSessionSpy,
      createUser: vi.fn(),
    };

    const fakeContext = Object.assign(Object.create(Object.getPrototypeOf(ctx)), ctx, {
      internalAdapter: fakeAdapter,
    });
    const endpointCtx = {
      context: fakeContext,
      request: new Request("http://localhost:3000/api/auth/callback/line"),
    } as unknown as Parameters<typeof handleOAuthUserInfo>[0];

    const result = await handleOAuthUserInfo(endpointCtx, {
      userInfo: {
        id: "U-registered",
        name: "LINE Somchai",
        email: "somchai@fisheries.go.th",
        image: "https://profile.line-scdn.net/somchai.jpg",
        emailVerified: false,
      },
      account: {
        providerId: "line",
        accountId: "U-registered",
        accessToken: "line-token",
        idToken: "line-id-token",
      },
      callbackURL: "/",
      disableSignUp: lineProvider.options?.disableSignUp,
    });

    expect(result.error).toBeNull();
    expect(result.isRegister).toBe(false);
    expect(result.data?.user.id).toBe("user-001");
    expect(result.data?.session.token).toBe("session-token-123");
    expect(linkAccountSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        providerId: "line",
        accountId: "U-registered",
        userId: "user-001",
      }),
    );
    expect(fakeAdapter.createUser).not.toHaveBeenCalled();
  });
});
