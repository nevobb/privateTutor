import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGetFirebaseAdminFirestore = vi.fn();
const mockGetFirebaseServerMode = vi.fn();
const mockGetRequiredServerProjectId = vi.fn();
const mockFetch = vi.fn();

vi.mock("../../../src/server/firebase/firebaseAdminApp", () => ({
  getFirebaseAdminFirestore: mockGetFirebaseAdminFirestore,
}));

vi.mock("../../../src/server/firebase/firebaseServerRuntimeMode", () => ({
  getFirebaseServerMode: mockGetFirebaseServerMode,
  getRequiredServerProjectId: mockGetRequiredServerProjectId,
}));

describe("firestoreEmulatorClient", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();

    mockGetRequiredServerProjectId.mockReturnValue("demo-private-tutor");
    mockGetFirebaseAdminFirestore.mockReturnValue({ marker: "db" });
    mockFetch.mockResolvedValue(new Response("ok", { status: 200 }));
    vi.stubGlobal("fetch", mockFetch);
  });

  it("reuses a per-user singleton client", async () => {
    mockGetFirebaseServerMode.mockReturnValue("emulator");

    const firestoreClientModule = await import("../../../src/server/firebase/firestoreEmulatorClient");

    const first = await firestoreClientModule.getFirestoreEmulatorClient("alice");
    const second = await firestoreClientModule.getFirestoreEmulatorClient("alice");

    expect(first).toBe(second);
    expect(mockGetFirebaseAdminFirestore).toHaveBeenCalledTimes(1);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("skips emulator reachability check in production mode", async () => {
    mockGetFirebaseServerMode.mockReturnValue("production");

    const firestoreClientModule = await import("../../../src/server/firebase/firestoreEmulatorClient");

    await firestoreClientModule.getFirestoreEmulatorClient("bob");

    expect(mockGetFirebaseAdminFirestore).toHaveBeenCalledTimes(1);
    expect(mockFetch).not.toHaveBeenCalled();
  });
});
