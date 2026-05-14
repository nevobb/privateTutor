import { beforeEach, describe, expect, it, vi } from "vitest";

const mockInitializeApp = vi.fn();
const mockGetApps = vi.fn();
const mockGetFirestore = vi.fn();
const mockConnectFirestoreEmulator = vi.fn();

vi.mock("firebase/app", () => ({
  initializeApp: mockInitializeApp,
  getApps: mockGetApps,
}));

vi.mock("firebase/firestore", () => ({
  getFirestore: mockGetFirestore,
  connectFirestoreEmulator: mockConnectFirestoreEmulator,
}));

const EMULATOR_CONNECTED_APPS_KEY = "__privateTutorFirestoreEmulatorConnectedApps";

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
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("ok", { status: 200 })));
  });

  it("connects Firestore emulator for a freshly initialized app and reuses singleton client", async () => {
    const app = makeApp();
    const db = {};
    mockGetApps.mockReturnValue([]);
    mockInitializeApp.mockReturnValue(app);
    mockGetFirestore.mockReturnValue(db);

    const firestoreClientModule = await import("../../../src/server/firebase/firestoreEmulatorClient");

    await firestoreClientModule.getFirestoreEmulatorClient();
    await firestoreClientModule.getFirestoreEmulatorClient();

    expect(mockInitializeApp).toHaveBeenCalledTimes(1);
    expect(mockConnectFirestoreEmulator).toHaveBeenCalledTimes(1);
    expect(mockConnectFirestoreEmulator).toHaveBeenCalledWith(db, "127.0.0.1", 8080);
  });

  it("connects Firestore emulator for an existing app (hot-reload path) exactly once", async () => {
    const app = makeApp();
    const db = {};
    mockGetApps.mockReturnValue([app]);
    mockGetFirestore.mockReturnValue(db);

    const firestoreClientModule = await import("../../../src/server/firebase/firestoreEmulatorClient");

    await firestoreClientModule.getFirestoreEmulatorClient();
    await firestoreClientModule.getFirestoreEmulatorClient();

    expect(mockInitializeApp).not.toHaveBeenCalled();
    expect(mockConnectFirestoreEmulator).toHaveBeenCalledTimes(1);
    expect(mockConnectFirestoreEmulator).toHaveBeenCalledWith(db, "127.0.0.1", 8080);
  });
});
