import { describe, expect, it, vi } from "vitest";

const mockIsFirebaseServerEmulatorMode = vi.fn();
const mockVerifyEmulator = vi.fn();
const mockVerifyProduction = vi.fn();

vi.mock("../../../src/server/firebase/firebaseServerRuntimeMode", () => ({
  isFirebaseServerEmulatorMode: mockIsFirebaseServerEmulatorMode,
}));

vi.mock("../../../src/server/auth/verifyFirebaseTokenEmulator", () => ({
  verifyFirebaseTokenEmulator: mockVerifyEmulator,
}));

vi.mock("../../../src/server/auth/verifyFirebaseTokenProduction", () => ({
  verifyFirebaseTokenProduction: mockVerifyProduction,
}));

describe("verifyFirebaseToken", () => {
  it("uses emulator verifier in emulator mode", async () => {
    mockIsFirebaseServerEmulatorMode.mockReturnValue(true);
    mockVerifyEmulator.mockResolvedValue({ uid: "emu-user" });

    const mod = await import("../../../src/server/auth/verifyFirebaseToken");
    const result = await mod.verifyFirebaseToken("token");

    expect(result).toEqual({ uid: "emu-user" });
    expect(mockVerifyEmulator).toHaveBeenCalledWith("token");
    expect(mockVerifyProduction).not.toHaveBeenCalled();
  });

  it("uses production verifier in production mode", async () => {
    mockIsFirebaseServerEmulatorMode.mockReturnValue(false);
    mockVerifyProduction.mockResolvedValue({ uid: "prod-user" });

    const mod = await import("../../../src/server/auth/verifyFirebaseToken");
    const result = await mod.verifyFirebaseToken("token");

    expect(result).toEqual({ uid: "prod-user" });
    expect(mockVerifyProduction).toHaveBeenCalledWith("token");
  });
});
