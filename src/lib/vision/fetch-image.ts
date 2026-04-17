const DEFAULT_MAX_BYTES = 10 * 1024 * 1024;
const DEFAULT_TIMEOUT_MS = 10_000;

const ALLOWED_MIME_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
]);

const MIME_BY_EXT: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
};

export interface FetchedImage {
  mimeType: string;
  data: string;
  bytes: number;
}

export class ImageFetchError extends Error {
  constructor(
    message: string,
    public readonly code: "blocked_host" | "too_large" | "bad_mime" | "network" | "timeout",
  ) {
    super(message);
    this.name = "ImageFetchError";
  }
}

function isPrivateIpHost(hostname: string): boolean {
  if (hostname === "localhost" || hostname === "0.0.0.0") return true;
  if (hostname === "127.0.0.1" || hostname === "[::1]") return true;
  if (hostname.startsWith("10.") || hostname.startsWith("192.168.")) return true;
  if (hostname.startsWith("172.")) {
    const second = parseInt(hostname.split(".")[1], 10);
    if (second >= 16 && second <= 31) return true;
  }
  return false;
}

function isHostAllowed(hostname: string, allowedHosts: string[]): boolean {
  return allowedHosts.some(
    (allowed) => hostname === allowed || hostname.endsWith(`.${allowed}`),
  );
}

function guessMimeFromUrl(url: string): string | null {
  const ext = url.split("?")[0].split(".").pop()?.toLowerCase();
  if (!ext) return null;
  return MIME_BY_EXT[ext] ?? null;
}

export async function fetchImageAsBase64(
  url: string,
  opts: {
    allowedHosts: string[];
    maxBytes?: number;
    timeoutMs?: number;
  },
): Promise<FetchedImage> {
  const maxBytes = opts.maxBytes ?? DEFAULT_MAX_BYTES;
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new ImageFetchError("유효하지 않은 이미지 URL", "blocked_host");
  }

  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new ImageFetchError("HTTP(S)가 아닌 프로토콜", "blocked_host");
  }
  if (isPrivateIpHost(parsed.hostname)) {
    throw new ImageFetchError("사설 IP 호스트 차단", "blocked_host");
  }
  if (!isHostAllowed(parsed.hostname, opts.allowedHosts)) {
    throw new ImageFetchError(
      `허용되지 않은 호스트: ${parsed.hostname}`,
      "blocked_host",
    );
  }

  let res: Response;
  try {
    res = await fetch(parsed.toString(), {
      signal: AbortSignal.timeout(timeoutMs),
      redirect: "follow",
    });
  } catch (err) {
    const isTimeout = err instanceof Error && err.name === "TimeoutError";
    throw new ImageFetchError(
      `이미지 요청 실패: ${err instanceof Error ? err.message : String(err)}`,
      isTimeout ? "timeout" : "network",
    );
  }

  if (!res.ok) {
    throw new ImageFetchError(`이미지 응답 실패 (HTTP ${res.status})`, "network");
  }

  const finalUrl = new URL(res.url);
  if (isPrivateIpHost(finalUrl.hostname) || !isHostAllowed(finalUrl.hostname, opts.allowedHosts)) {
    throw new ImageFetchError("리디렉트가 허용되지 않은 호스트로 이동", "blocked_host");
  }

  const headerMime = res.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase();
  const urlMime = guessMimeFromUrl(url);
  const mimeType = headerMime && ALLOWED_MIME_TYPES.has(headerMime)
    ? headerMime
    : urlMime && ALLOWED_MIME_TYPES.has(urlMime)
      ? urlMime
      : null;

  if (!mimeType) {
    throw new ImageFetchError(
      `지원되지 않는 이미지 MIME: ${headerMime ?? "unknown"}`,
      "bad_mime",
    );
  }

  const buffer = await res.arrayBuffer();
  if (buffer.byteLength > maxBytes) {
    throw new ImageFetchError(
      `이미지 크기 초과: ${buffer.byteLength} > ${maxBytes}`,
      "too_large",
    );
  }

  const data = Buffer.from(buffer).toString("base64");
  return { mimeType, data, bytes: buffer.byteLength };
}
