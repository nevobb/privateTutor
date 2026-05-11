export interface FirestoreServerConfig {
  readonly projectId: "demo-private-tutor";
  readonly host: "127.0.0.1";
  readonly port: 8080;
  readonly baseUrl: "http://127.0.0.1:8080";
}

export const firestoreServerConfig: FirestoreServerConfig = Object.freeze({
  projectId: "demo-private-tutor",
  host: "127.0.0.1",
  port: 8080,
  baseUrl: "http://127.0.0.1:8080",
});
