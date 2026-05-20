export interface FirestoreServerConfig {
  readonly projectId: string;
  readonly host: string;
  readonly port: number;
  readonly baseUrl: string;
}

export const firestoreServerConfig: FirestoreServerConfig = Object.freeze({
  projectId: "demo-private-tutor",
  host: "127.0.0.1",
  port: 8080,
  baseUrl: "http://127.0.0.1:8080",
});
