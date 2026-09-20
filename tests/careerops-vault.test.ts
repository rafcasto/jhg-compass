import { describe, it, expect } from "vitest";
import { generateKeyPairSync, privateDecrypt, constants } from "node:crypto";
import { encryptForWorker, generatePassword, hostOf, portalFor } from "@/lib/careerops/vault";

describe("portal-account vault (browser side)", () => {
  it("encrypts for the Pi's public key so only its private key can read it", async () => {
    const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
    const spki = publicKey.export({ type: "spki", format: "der" }).toString("base64");
    const enc = await encryptForWorker(spki, "Tr0ub4dor&3 — pässwörd");
    expect(privateDecrypt({ key: privateKey, padding: constants.RSA_PKCS1_OAEP_PADDING, oaepHash: "sha256" }, Buffer.from(enc, "base64")).toString("utf8")).toBe("Tr0ub4dor&3 — pässwörd");
    expect(enc).not.toContain("Tr0ub4dor");
  });
  it("generates a strong per-portal password and recognises portals", () => {
    const p = generatePassword();
    expect(p).toHaveLength(20); expect(p).not.toBe(generatePassword());
    expect(hostOf("https://westpacnz.wd105.myworkdayjobs.com/en-US/x")).toBe("westpacnz.wd105.myworkdayjobs.com");
    expect(portalFor("westpacnz.wd105.myworkdayjobs.com")).toBe("workday");
    expect(portalFor("kiwibankpeople.csod.com")).toBe("csod");
    expect(portalFor("careers.anz.com")).toBe("generic");
  });
});
