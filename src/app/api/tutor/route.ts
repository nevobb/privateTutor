import { handleTutorRequest } from "../../../server/tutor/handleTutorRequest";

export async function POST(request: Request): Promise<Response> {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const result = await handleTutorRequest(body);

  if (!result.ok) {
    return Response.json(result.error, { status: result.status });
  }

  return Response.json(result.response);
}
