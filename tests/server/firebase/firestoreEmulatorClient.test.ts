import { beforeEach, describe, expect, it, vi } from "vitest";

const mockInitializeApp = vi.fn();
const mockGetApps = vi.fn();
const mockGetFirestore = vi.fn();
const mockConnectFirestoreEmulator = vi.fn();

vi.mock("firebase/app", () => ({
  initializeApp: mockInitializeApp,
  getApps: mockGetApps,
}));

vi.mock("firebase/firestore/lite", () => ({
  getFirestore: mockGetFirestore,
  connectFirestoreEmulator: mockConnectFirestoreEmulator,
}));

const EMULATOR_CONNECTED_APPS_KEY = "__privateTutorFirestoreEmulatorConnectedApps";
const EMULATOR_ENV_READY_KEY = "__privateTutorFirestoreEmulatorEnvReady";

function makeApp(name = "demo-private-tutor-firestore-emulator") {
  return { name } as { name: string };
}

describe("firestoreEmulatorClient", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    delete (globalThis as typeof globalThis & { [EMULATOR_CONNECTED_APPS_KEY]?: Set<string> })[
      EMULATOR_CONNECTED_APPS_KEY
    ];
    delete (globalThis as typeof globalThis & { [EMULATOR_ENV_READY_KEY]?: boolean })[
      EMULATOR_ENV_READY_KEY
    ];
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("ok", { status: 200 })));
  });

  it("connects Firestore emulator for a user-specific app and reuses that user's singleton client", async () => {
    const app = makeApp("demo-private-tutor-firestore-emulator-YWxpY2U");
    const db = {};
    mockGetApps.mockReturnValue([]);
    mockInitializeApp.mockReturnValue(app);
    mockGetFirestore.mockReturnValue(db);

    const firestoreClientModule = await import("../../../src/server/firebase/firestoreEmulatorClient");

    await firestoreClientModule.getFirestoreEmulatorClient("alice");
    await firestoreClientModule.getFirestoreEmulatorClient("alice");

    expect(mockInitializeApp).toHaveBeenCalledTimes(1);
    expect(mockConnectFirestoreEmulator).toHaveBeenCalledTimes(1);
    expect(mockConnectFirestoreEmulator).toHaveBeenCalledWith(
      db,
      "127.0.0.1",
      8080,
      expect.objectContaining({
        mockUserToken: expect.objectContaining({
          sub: "alice",
          user_id: "alice",
        }),
      })
    );
  });

  it("connects Firestore emulator for an existing user-specific app (hot-reload path) exactly once", async () => {
    const app = makeApp("demo-private-tutor-firestore-emulator-Ym9i");
    const db = {};
    mockGetApps.mockReturnValue([app]);
    mockGetFirestore.mockReturnValue(db);

    const firestoreClientModule = await import("../../../src/server/firebase/firestoreEmulatorClient");

    await firestoreClientModule.getFirestoreEmulatorClient("bob");
    await firestoreClientModule.getFirestoreEmulatorClient("bob");

    expect(mockInitializeApp).not.toHaveBeenCalled();
    expect(mockConnectFirestoreEmulator).toHaveBeenCalledTimes(1);
    expect(mockConnectFirestoreEmulator).toHaveBeenCalledWith(
      db,
      "127.0.0.1",
      8080,
      expect.objectContaining({
        mockUserToken: expect.objectContaining({
          sub: "bob",
          user_id: "bob",
        }),
      })
    );
  });
});
