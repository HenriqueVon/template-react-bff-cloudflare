// The most a request body may hold. The proxy reads it into memory before forwarding it, so it is bounded: the JSON
// bodies of an app are small, and a Function has little memory. Raise it for a route that takes uploads, or stream them.
export const MAX_BODY_BYTES = 1024 * 1024;

// Reads the body of a request, or returns null when it is larger than `limit`. A declared Content-Length above the limit
// is refused without reading anything; a body without one (chunked) is counted while it is read, and the read stops as
// soon as it passes the limit.
export async function readBodyWithLimit(request: Request, limit = MAX_BODY_BYTES): Promise<Uint8Array | null> {
  const declared = Number(request.headers.get('Content-Length'));
  if (Number.isFinite(declared) && declared > limit) return null;

  if (!request.body) return new Uint8Array(0);

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;

    size += value.byteLength;
    if (size > limit) {
      await reader.cancel();
      return null;
    }

    chunks.push(value);
  }

  const body = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return body;
}
