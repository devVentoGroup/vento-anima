"use strict";

const crypto = require("crypto");
const { PKPass } = require("passkit-generator");
const forge = require("node-forge");
const fs = require("fs/promises");
const os = require("os");
const path = require("path");

const TRANSPARENT_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+Nn3kAAAAASUVORK5CYII=";

const getEnv = (name) => {
  const value = process.env[name];
  if (!value) throw new Error(`Missing env: ${name}`);
  return value;
};

const fetchBuffer = async (url) => {
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Failed to fetch image: ${res.status} | url: ${url}${body ? ` | ${body.slice(0, 200)}` : ""}`);
  }
  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
};

const decodeP12 = (p12Buffer, password) => {
  const p12Asn1 = forge.asn1.fromDer(p12Buffer.toString("binary"));
  const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, password);
  const certBags = p12.getBags({ bagType: forge.pki.oids.certBag });
  const certBag = certBags[forge.pki.oids.certBag]?.[0];
  if (!certBag?.cert) throw new Error("Missing certificate in p12.");
  const keyBags = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag });
  let keyBag = keyBags[forge.pki.oids.pkcs8ShroudedKeyBag]?.[0];
  if (!keyBag?.key) {
    const fallback = p12.getBags({ bagType: forge.pki.oids.keyBag });
    keyBag = fallback[forge.pki.oids.keyBag]?.[0];
  }
  if (!keyBag?.key) throw new Error("Missing private key in p12.");
  return {
    certPem: forge.pki.certificateToPem(certBag.cert),
    keyPem: forge.pki.privateKeyToPem(keyBag.key),
  };
};

const derToPem = (derBuffer) => {
  const asn1 = forge.asn1.fromDer(derBuffer.toString("binary"));
  const cert = forge.pki.certificateFromAsn1(asn1);
  return forge.pki.certificateToPem(cert);
};

const createAuthToken = () => crypto.randomBytes(32).toString("hex");

const getUserFromToken = async (token) => {
  const url = getEnv("SUPABASE_URL");
  const key = getEnv("SUPABASE_ANON_KEY");
  const res = await fetch(`${url}/auth/v1/user`, {
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: key,
      "Content-Type": "application/json",
    },
  });
  if (!res.ok) return null;
  return res.json();
};

const buildEmployeePassJson = ({
  serialNumber,
  passTypeIdentifier,
  teamIdentifier,
  orgName,
  description,
  accountName,
  role,
  siteName,
  vigenciaText,
  authToken,
  webServiceUrl,
  barcodePayload,
  lastModified,
}) => {
  const resolvedOrgName = orgName || "Vento";
  const resolvedLastModified = lastModified || new Date().toISOString();
  const barcodeValue = barcodePayload || `emp:${serialNumber}`;
  return {
    formatVersion: 1,
    passTypeIdentifier,
    serialNumber,
    teamIdentifier,
    organizationName: resolvedOrgName,
    description: description || "Carnet laboral",
    suppressStripShine: true,
    lastModified: resolvedLastModified,
    foregroundColor: "rgb(27, 26, 31)",
    backgroundColor: "rgb(255, 255, 255)",
    labelColor: "rgb(95, 104, 118)",
    barcode: {
      format: "PKBarcodeFormatQR",
      message: barcodeValue,
      messageEncoding: "utf-8",
    },
    barcodes: [
      { format: "PKBarcodeFormatQR", message: barcodeValue, messageEncoding: "utf-8" },
    ],
    storeCard: {
      headerFields: [
        { key: "role", label: "CARGO", value: role || "Empleado", textAlignment: "PKTextAlignmentRight" },
      ],
      primaryFields: [
        { key: "name", label: "NOMBRE", value: String(accountName || "").trim() || "Empleado" },
      ],
      secondaryFields: [
        { key: "site", label: "Sede", value: siteName || "-" },
        { key: "vigencia", label: "Vigencia", value: vigenciaText || "Vigente", textAlignment: "PKTextAlignmentRight" },
      ],
      backFields: [{ key: "serial", label: "ID", value: String(serialNumber) }],
    },
    ...(webServiceUrl && authToken
      ? { webServiceURL: webServiceUrl, authenticationToken: authToken }
      : {}),
  };
};

const buildPkPassBuffer = async ({
  passJson,
  logoUrl,
  iconUrl,
  stripUrl,
  strip2xUrl,
  hideLogo,
}) => {
  const p12Buffer = Buffer.from(getEnv("APPLE_PASS_P12_BASE64"), "base64");
  const wwdrBuffer = Buffer.from(getEnv("APPLE_WWDR_PEM_BASE64"), "base64");
  const p12Password = getEnv("APPLE_PASS_P12_PASSWORD");
  const { certPem, keyPem } = decodeP12(p12Buffer, p12Password);
  const wwdrPem = derToPem(wwdrBuffer);

  const hideLogoFlag =
    typeof hideLogo === "boolean" ||
    ["1", "true", "yes"].includes(String(process.env.APPLE_PASS_HIDE_LOGO || "").toLowerCase());
  const defaultLogoUrl = getEnv("APPLE_PASS_LOGO_URL");
  const resolvedLogoUrl = hideLogoFlag ? null : logoUrl || defaultLogoUrl;
  const resolvedIconUrl = iconUrl || process.env.APPLE_PASS_ICON_URL || defaultLogoUrl;
  const versionTag = encodeURIComponent(String(passJson?.lastModified || Date.now()));
  const withCacheBust = (u) => (!u ? u : `${u}${u.includes("?") ? "&" : "?"}v=${versionTag}`);

  const logoBuffer = hideLogoFlag
    ? Buffer.from(TRANSPARENT_PNG_BASE64, "base64")
    : await fetchBuffer(withCacheBust(resolvedLogoUrl));
  const iconBuffer =
    resolvedIconUrl === resolvedLogoUrl ? logoBuffer : await fetchBuffer(withCacheBust(resolvedIconUrl));

  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "anima-emp-pass-"));
  const modelDir = `${tempRoot}.pass`;
  await fs.rename(tempRoot, modelDir);
  await fs.writeFile(path.join(modelDir, "pass.json"), JSON.stringify(passJson, null, 2));
  await fs.writeFile(path.join(modelDir, "icon.png"), iconBuffer);
  await fs.writeFile(path.join(modelDir, "icon@2x.png"), iconBuffer);
  await fs.writeFile(path.join(modelDir, "icon@3x.png"), iconBuffer);
  await fs.writeFile(path.join(modelDir, "logo.png"), logoBuffer);
  await fs.writeFile(path.join(modelDir, "logo@2x.png"), logoBuffer);
  await fs.writeFile(path.join(modelDir, "logo@3x.png"), logoBuffer);

  const pass = await PKPass.from({
    model: modelDir,
    certificates: {
      wwdr: Buffer.from(wwdrPem),
      signerCert: Buffer.from(certPem),
      signerKey: Buffer.from(keyPem),
      signerKeyPassphrase: p12Password,
    },
  });

  return pass.getAsBuffer();
};

module.exports = {
  getEnv,
  getUserFromToken,
  createAuthToken,
  buildEmployeePassJson,
  buildPkPassBuffer,
};
