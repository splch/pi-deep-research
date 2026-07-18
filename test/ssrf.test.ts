import { describe, expect, it } from "vitest";
import { assertPublicHttpUrl, isPrivateAddress, SsrfError } from "../src/tools/ssrf.js";

const publicResolver = async () => ["93.184.216.34"];
const privateResolver = async () => ["10.1.2.3"];
const mixedResolver = async () => ["93.184.216.34", "192.168.0.1"];

describe("isPrivateAddress", () => {
  it("blocks private and special v4 ranges", () => {
    for (const ip of [
      "127.0.0.1",
      "10.0.0.1",
      "172.16.5.5",
      "172.31.255.255",
      "192.168.1.1",
      "169.254.169.254",
      "100.64.0.1",
      "0.0.0.0",
      "198.18.0.1",
      "224.0.0.1",
      "255.255.255.255",
    ]) {
      expect(isPrivateAddress(ip), ip).toBe(true);
    }
  });
  it("allows public v4", () => {
    for (const ip of ["93.184.216.34", "8.8.8.8", "172.32.0.1", "100.128.0.1"]) {
      expect(isPrivateAddress(ip), ip).toBe(false);
    }
  });
  it("blocks private v6", () => {
    for (const ip of ["::1", "::", "fe80::1", "fc00::1", "fd12:3456::1", "ff02::1", "::ffff:10.0.0.1", "64:ff9b::a00:1"]) {
      expect(isPrivateAddress(ip), ip).toBe(true);
    }
  });
  it("blocks non-canonical spellings of private v6 (uncompressed, hex-mapped v4)", () => {
    for (const ip of [
      "0:0:0:0:0:0:0:1", // ::1 uncompressed
      "0:0:0:0:0:0:0:0", // :: uncompressed
      "::ffff:7f00:1", // 127.0.0.1 hex-mapped
      "::ffff:a9fe:a9fe", // 169.254.169.254 (cloud metadata) hex-mapped
      "0:0:0:0:0:ffff:a00:1", // 10.0.0.1 hex-mapped, uncompressed
      "::FFFF:169.254.169.254", // uppercase
      "64:ff9b:1::1", // RFC 8215 local-use NAT64
    ]) {
      expect(isPrivateAddress(ip), ip).toBe(true);
    }
  });
  it("allows public v6 and mapped-public", () => {
    expect(isPrivateAddress("2606:2800:220:1:248:1893:25c8:1946")).toBe(false);
    expect(isPrivateAddress("::ffff:93.184.216.34")).toBe(false);
    expect(isPrivateAddress("::ffff:5db8:d822")).toBe(false); // 93.184.216.34 hex-mapped
  });
});

describe("assertPublicHttpUrl", () => {
  it("rejects non-http protocols", async () => {
    await expect(assertPublicHttpUrl("ftp://example.com/x", publicResolver)).rejects.toThrow(SsrfError);
    await expect(assertPublicHttpUrl("file:///etc/passwd", publicResolver)).rejects.toThrow(SsrfError);
  });
  it("rejects localhost and internal-suffix hostnames without resolving", async () => {
    const boom = async () => {
      throw new Error("should not resolve");
    };
    await expect(assertPublicHttpUrl("http://localhost:8080/", boom)).rejects.toThrow(SsrfError);
    await expect(assertPublicHttpUrl("http://foo.local/", boom)).rejects.toThrow(SsrfError);
    await expect(assertPublicHttpUrl("http://svc.internal/", boom)).rejects.toThrow(SsrfError);
  });
  it("rejects IP-literal private targets", async () => {
    await expect(assertPublicHttpUrl("http://169.254.169.254/latest/meta-data", publicResolver)).rejects.toThrow(
      SsrfError,
    );
    await expect(assertPublicHttpUrl("http://[::1]/", publicResolver)).rejects.toThrow(SsrfError);
    await expect(assertPublicHttpUrl("http://[::ffff:a9fe:a9fe]/latest", publicResolver)).rejects.toThrow(SsrfError);
    await expect(assertPublicHttpUrl("http://[0:0:0:0:0:0:0:1]/", publicResolver)).rejects.toThrow(SsrfError);
  });
  it("rejects credentials in URL", async () => {
    await expect(assertPublicHttpUrl("http://user:pass@example.com/", publicResolver)).rejects.toThrow(SsrfError);
  });
  it("rejects hostnames resolving to any private address", async () => {
    await expect(assertPublicHttpUrl("https://evil.example.com/", privateResolver)).rejects.toThrow(SsrfError);
    await expect(assertPublicHttpUrl("https://rebind.example.com/", mixedResolver)).rejects.toThrow(SsrfError);
  });
  it("accepts public hosts", async () => {
    const url = await assertPublicHttpUrl("https://example.com/page?a=1", publicResolver);
    expect(url.hostname).toBe("example.com");
  });
});
