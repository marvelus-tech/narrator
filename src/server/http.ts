import { ApiError } from "./errors";

export async function readJson(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    throw new ApiError(400, "invalid_body");
  }
}

export function json(data: unknown, init?: ResponseInit): Response {
  return Response.json(data, init);
}
