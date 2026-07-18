import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

export type ResolveAddresses = (hostname: string) => Promise<string[]>;

const defaultResolve: ResolveAddresses = async (hostname) => {
  const results = await lookup(hostname, { all: true, verbatim: true });
  return results.map((r) => r.address);
};

const BLOCKED_HOST_SUFFIXES = [".localhost", ".local", ".internal", ".home.arpa"];

export class SsrfError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SsrfError";
  }
}

function isPrivateV4(address: string): boolean {
  const octets = address.split(".").map(Number);
  if (octets.length !== 4 || octets.some((o) => Number.isNaN(o) || o < 0 || o > 255)) return true;
  const [a, b] = octets as [number, number, number, number];
  if (a === 0 || a === 10 || a === 127) return true;
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT 100.64/10
  if (a === 169 && b === 254) return true; // link-local incl. cloud metadata 169.254.169.254
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 0) return true; // 192.0.0/24 + 192.0.2/24 doc range
  if (a === 192 && b === 168) return true;
  if (a === 198 && (b === 18 || b === 19)) return true; // benchmark 198.18/15
  if (a >= 224) return true; // multicast + reserved 224/4, 240/4, broadcast
  return false;
}

type V6Groups = [number, number, number, number, number, number, number, number];

/**
 * Expand an IPv6 literal into eight 16-bit groups, handling `::` compression,
 * uncompressed forms, and dotted-quad tails. Judging the expanded groups (rather
 * than string prefixes) means every spelling of an address is caught - e.g.
 * "0:0:0:0:0:0:0:1" for ::1, or "::ffff:7f00:1" for 127.0.0.1.
 */
function v6ToGroups(rawAddress: string): V6Groups | undefined {
  let address = rawAddress.toLowerCase();
  const dotted = address.match(/^(.*:)((?:\d{1,3}\.){3}\d{1,3})$/);
  if (dotted) {
    const octets = dotted[2]!.split(".").map(Number);
    if (octets.some((o) => o > 255)) return undefined;
    const [a, b, c, d] = octets as [number, number, number, number];
    address = `${dotted[1]}${((a << 8) | b).toString(16)}:${((c << 8) | d).toString(16)}`;
  }
  const halves = address.split("::");
  if (halves.length > 2) return undefined;
  const head = halves[0] ? halves[0].split(":") : [];
  const tail = halves.length === 2 && halves[1] ? halves[1].split(":") : [];
  const groups =
    halves.length === 2
      ? [...head, ...new Array<string>(Math.max(0, 8 - head.length - tail.length)).fill("0"), ...tail]
      : head;
  if (groups.length !== 8) return undefined;
  const nums = groups.map((group) => (/^[0-9a-f]{1,4}$/.test(group) ? Number.parseInt(group, 16) : Number.NaN));
  return nums.some(Number.isNaN) ? undefined : (nums as V6Groups);
}

function isPrivateV6(rawAddress: string): boolean {
  const groups = v6ToGroups(rawAddress);
  if (!groups) return true; // unparseable: treat as unsafe
  const [g0, g1, g2, g3, g4, g5, g6, g7] = groups;
  if (g0 === 0 && g1 === 0 && g2 === 0 && g3 === 0 && g4 === 0) {
    // IPv4-mapped ::ffff:0:0/96 in any spelling (hex or dotted): judge the embedded IPv4.
    if (g5 === 0xffff) return isPrivateV4(`${g6 >> 8}.${g6 & 0xff}.${g7 >> 8}.${g7 & 0xff}`);
    if (g5 === 0 && g6 === 0 && (g7 === 0 || g7 === 1)) return true; // :: unspecified, ::1 loopback
  }
  if (g0 === 0x64 && g1 === 0xff9b) return true; // NAT64 translation prefixes: conservatively blocked
  if ((g0 & 0xfe00) === 0xfc00) return true; // fc00::/7 unique local
  if ((g0 & 0xffc0) === 0xfe80) return true; // fe80::/10 link-local
  if ((g0 & 0xff00) === 0xff00) return true; // ff00::/8 multicast
  return false;
}

export function isPrivateAddress(address: string): boolean {
  const version = isIP(address);
  if (version === 4) return isPrivateV4(address);
  if (version === 6) return isPrivateV6(address);
  return true; // not an IP at all: treat as unsafe
}

/**
 * Validates that a URL is plain http(s) to a public host. Hostnames are
 * DNS-resolved and every resolved address must be public. Note: resolution
 * happens before fetch (small TOCTOU window vs. DNS rebinding); acceptable
 * for v1 because workers hold no secrets and fetch is GET-only.
 */
export async function assertPublicHttpUrl(
  raw: string,
  resolveAddresses: ResolveAddresses = defaultResolve,
): Promise<URL> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new SsrfError(`Not a valid URL: ${raw}`);
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new SsrfError(`Blocked protocol "${url.protocol}" (only http/https allowed)`);
  }
  if (url.username || url.password) {
    throw new SsrfError("URLs with embedded credentials are blocked");
  }
  const hostname = url.hostname.replace(/^\[|\]$/g, "");
  const lower = hostname.toLowerCase();
  if (lower === "localhost" || BLOCKED_HOST_SUFFIXES.some((s) => lower.endsWith(s))) {
    throw new SsrfError(`Blocked hostname: ${hostname}`);
  }
  if (isIP(hostname)) {
    if (isPrivateAddress(hostname)) throw new SsrfError(`Blocked non-public IP: ${hostname}`);
    return url;
  }
  let addresses: string[];
  try {
    addresses = await resolveAddresses(hostname);
  } catch {
    throw new SsrfError(`DNS resolution failed for ${hostname}`);
  }
  if (addresses.length === 0) throw new SsrfError(`No DNS addresses for ${hostname}`);
  for (const address of addresses) {
    if (isPrivateAddress(address)) {
      throw new SsrfError(`Blocked: ${hostname} resolves to non-public address ${address}`);
    }
  }
  return url;
}
