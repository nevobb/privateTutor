export interface AuthEmulatorConfig {
  readonly projectId: "demo-private-tutor";
  readonly host: "127.0.0.1";
  readonly port: 9099;
  readonly baseUrl: "http://127.0.0.1:9099";
  readonly apiKey: "demo-key";
}

export const authEmulatorConfig: AuthEmulatorConfig = Object.freeze({
  projectId: "demo-private-tutor",
  host: "127.0.0.1",
  port: 9099,
  baseUrl: "http://127.0.0.1:9099",
  apiKey: "demo-key",
});
