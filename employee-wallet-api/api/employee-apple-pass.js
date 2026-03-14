"use strict";

const {
  getEnv,
  getUserFromToken,
  buildEmployeePassJson,
  buildPkPassBuffer,
  createAuthToken,
} = require("../lib/wallet-pass");

function parseToken(req) {
  const authHeader = req.headers?.authorization || "";
  const fromHeader = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  const fromQuery = typeof req.query?.token === "string" ? req.query.token : null;
  return fromHeader || fromQuery;
}

async function supabaseServiceFetch(pathUrl, options = {}) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  const res = await fetch(`${url}${pathUrl}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${key}`,
      apikey: key,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  return res;
}

async function getEmployeeEligibility(employeeId) {
  const res = await supabaseServiceFetch("/rest/v1/rpc/employee_wallet_eligibility", {
    method: "POST",
    body: JSON.stringify({ p_employee_id: employeeId }),
  });
  if (!res.ok) return null;
  const data = await res.json();
  return Array.isArray(data) && data.length > 0 ? data[0] : null;
}

async function getEmployeeWithSite(employeeId) {
  const res = await supabaseServiceFetch(
    `/rest/v1/employees?id=eq.${employeeId}&select=id,full_name,role,site_id`
  );
  if (!res.ok) return null;
  const arr = await res.json();
  const emp = arr?.[0];
  if (!emp || !emp.site_id) return emp;
  const siteRes = await supabaseServiceFetch(
    `/rest/v1/sites?id=eq.${emp.site_id}&select=name`
  );
  if (!siteRes.ok) return emp;
  const siteArr = await siteRes.json();
  emp.site_name = siteArr?.[0]?.name ?? null;
  return emp;
}

module.exports = async function handler(req, res) {
  if (req.method !== "GET" && req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const token = parseToken(req);
    if (!token) {
      res.status(401).json({ error: "Missing token" });
      return;
    }

    const user = await getUserFromToken(token);
    if (!user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const employeeId = user.id;
    const eligibility = await getEmployeeEligibility(employeeId);
    if (!eligibility || !eligibility.wallet_eligible) {
      res.status(403).json({
        error: "No elegible para carnet laboral",
        reason: !eligibility
          ? "No se pudo verificar elegibilidad"
          : !eligibility.contract_active
            ? "Sin contrato vigente"
            : !eligibility.documents_complete
              ? "Faltan documentos requeridos"
              : "Estado no elegible",
      });
      return;
    }

    const employee = await getEmployeeWithSite(employeeId);
    if (!employee) {
      res.status(500).json({ error: "No se encontró el empleado" });
      return;
    }

    const fullName = String(employee.full_name ?? "").trim() || "Empleado";
    const role = String(employee.role ?? "").trim() || "Empleado";
    const siteName = String(employee.site_name ?? "").trim() || "Sede";
    const contractStart = eligibility.contract_start_date || "";
    const contractEnd = eligibility.contract_end_date || "";
    const vigenciaText =
      contractStart && contractEnd ? `${contractStart} - ${contractEnd}` : "Vigente";

    const passTypeIdentifier =
      process.env.APPLE_EMPLOYEE_PASS_TYPE_ID ||
      process.env.APPLE_PASS_TYPE_ID ||
      getEnv("APPLE_PASS_TYPE_ID");
    const teamIdentifier = getEnv("APPLE_TEAM_ID");
    const orgName = process.env.APPLE_EMPLOYEE_ORG_NAME || "Vento";
    const description = process.env.APPLE_EMPLOYEE_PASS_DESCRIPTION || "Carnet laboral";

    const serialNumber = `emp-${employeeId}`;
    const authToken = createAuthToken();
    const webServiceUrl = process.env.PASS_WEB_SERVICE_URL || null;

    const passJson = buildEmployeePassJson({
      serialNumber,
      passTypeIdentifier,
      teamIdentifier,
      orgName,
      description,
      accountName: fullName,
      role,
      siteName,
      vigenciaText,
      authToken,
      webServiceUrl,
      barcodePayload: `emp:${employeeId}`,
      lastModified: new Date().toISOString(),
    });

    const logoUrl = process.env.APPLE_PASS_LOGO_URL || getEnv("APPLE_PASS_LOGO_URL");
    const iconUrl = process.env.APPLE_PASS_ICON_URL || logoUrl;

    const pkpass = await buildPkPassBuffer({
      passJson,
      logoUrl,
      iconUrl,
      stripUrl: null,
      strip2xUrl: null,
      hideLogo: false,
    });

    res.setHeader("Content-Type", "application/vnd.apple.pkpass");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=vento-carnet-${Date.now()}.pkpass`
    );
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    res.status(200).send(pkpass);
  } catch (error) {
    res.status(500).json({ error: error?.message || "Pass creation failed" });
  }
};
