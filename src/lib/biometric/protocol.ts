/**
 * eSSL / ZKTeco "ADMS" (push SDK) protocol helpers. Pure functions, no DB.
 *
 * The device talks plain text over HTTP(S):
 *   GET  /iclock/cdata?SN=..&options=all        handshake -> we reply with options
 *   POST /iclock/cdata?SN=..&table=ATTLOG       punches, one per line (PIN \t time \t status \t verify ...)
 *   POST /iclock/cdata?SN=..&table=OPERLOG      user / fingerprint / face changes made on the device
 *   GET  /iclock/getrequest?SN=..               poll -> "C:<id>:<command>" lines, or "OK"
 *   POST /iclock/devicecmd?SN=..                results: "ID=<id>&Return=<code>&CMD=<name>" lines
 */

export type Punch = { pin: number; time: Date; raw: string };

export type TemplateTable = "FINGERTMP" | "FACE" | "BIODATA";

export type CapturedTemplate = {
  pin: number;
  table: TemplateTable;
  /** Stable key within the user, e.g. finger index, or "type:no:index" for BIODATA */
  slot: string;
  /** Tab-separated key=value fields exactly as the device sent them (replayable). */
  data: string;
};

/** Device clocks run on gym local time (IST). "2026-11-28 07:02:11" -> Date. */
export function deviceTimeToDate(s: string, offset = "+05:30"): Date | null {
  const m = s.trim().match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (!m) return null;
  const d = new Date(`${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6] ?? "00"}${offset}`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function lines(body: string): string[] {
  return body
    .split(/\r?\n/)
    .map((l) => l.replace(/\0/g, "").trimEnd())
    .filter((l) => l.trim().length > 0);
}

/** ATTLOG body -> punches. Lines whose PIN isn't numeric are skipped. */
export function parseAttlog(body: string): Punch[] {
  const out: Punch[] = [];
  for (const line of lines(body)) {
    const cols = line.split("\t");
    if (cols.length < 2) continue;
    const pinStr = cols[0].trim();
    if (!/^\d{1,9}$/.test(pinStr)) continue;
    const time = deviceTimeToDate(cols[1]);
    if (!time) continue;
    out.push({ pin: Number(pinStr), time, raw: line });
  }
  return out;
}

/** "PIN=1\tFID=6\tTMP=.." -> { pin: "1", fid: "6", tmp: ".." } (keys lower-cased). */
export function parseFields(s: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of s.split("\t")) {
    const i = part.indexOf("=");
    if (i <= 0) continue;
    out[part.slice(0, i).trim().toLowerCase()] = part.slice(i + 1).trim();
  }
  return out;
}

const PREFIX_TO_TABLE: Record<string, TemplateTable> = {
  FP: "FINGERTMP",
  FINGERTMP: "FINGERTMP",
  FACE: "FACE",
  BIODATA: "BIODATA",
};

/**
 * OPERLOG / FINGERTMP / FACE / BIODATA bodies -> biometric templates.
 * `table` is the ?table= query value; used when lines have no "FP "/"BIODATA " prefix.
 */
export function parseTemplates(body: string, table?: string | null): CapturedTemplate[] {
  const out: CapturedTemplate[] = [];
  const fallback = table ? PREFIX_TO_TABLE[table.toUpperCase()] : undefined;
  for (const line of lines(body)) {
    let tbl: TemplateTable | undefined;
    let rest = line;
    const sp = line.indexOf(" ");
    if (sp > 0) {
      const prefix = line.slice(0, sp).toUpperCase();
      if (PREFIX_TO_TABLE[prefix]) {
        tbl = PREFIX_TO_TABLE[prefix];
        rest = line.slice(sp + 1);
      }
    }
    if (!tbl) {
      if (!fallback || !/^pin=/i.test(line)) continue;
      tbl = fallback;
    }
    const f = parseFields(rest);
    const pinStr = f.pin;
    if (!pinStr || !/^\d{1,9}$/.test(pinStr)) continue;
    const tmp = f.tmp;
    if (!tmp) continue; // nothing restorable
    if (f.valid === "0") continue;
    const slot =
      tbl === "BIODATA"
        ? `${f.type ?? "0"}:${f.no ?? "0"}:${f.index ?? "0"}`
        : (f.fid ?? "0");
    out.push({ pin: Number(pinStr), table: tbl, slot, data: rest.trim() });
  }
  return out;
}

export type CommandResult = { id: number; returnCode: number; cmd?: string };

/** devicecmd body -> results. */
export function parseCommandResults(body: string): CommandResult[] {
  const out: CommandResult[] = [];
  for (const line of lines(body)) {
    const params = new URLSearchParams(line.trim());
    const id = Number(params.get("ID"));
    const ret = Number(params.get("Return"));
    if (!Number.isFinite(id) || params.get("ID") === null) continue;
    out.push({
      id,
      returnCode: Number.isFinite(ret) ? ret : -1,
      cmd: params.get("CMD") ?? undefined,
    });
  }
  return out;
}

/** Names on the device: printable ASCII only, no tabs/newlines, max 24 chars. */
export function deviceSafeName(name: string): string {
  const ascii = name
    .normalize("NFKD")
    .replace(/\s+/g, " ")
    .replace(/[^\x20-\x7E]/g, "")
    .replace(/ +/g, " ")
    .trim();
  return (ascii || "Member").slice(0, 24);
}

export function cmdAddUser(pin: number, name: string): string {
  return `DATA UPDATE USERINFO PIN=${pin}\tName=${deviceSafeName(name)}\tPri=0`;
}

export function cmdDeleteUser(pin: number): string {
  return `DATA DELETE USERINFO PIN=${pin}`;
}

export function cmdRestoreTemplate(table: TemplateTable, data: string): string {
  return `DATA UPDATE ${table} ${data}`;
}

export function formatCommands(cmds: { id: number; command: string }[]): string {
  if (cmds.length === 0) return "OK";
  return cmds.map((c) => `C:${c.id}:${c.command}`).join("\n") + "\n";
}

/** Reply to the GET /iclock/cdata handshake. */
export function handshakeReply(sn: string): string {
  return [
    `GET OPTION FROM: ${sn}`,
    "ATTLOGStamp=None",
    "OPERLOGStamp=None",
    "ATTPHOTOStamp=None",
    "ErrorDelay=30",
    "Delay=10",
    "TransTimes=00:00;14:05",
    "TransInterval=1",
    "TransFlag=TransData AttLog OpLog EnrollUser ChgUser EnrollFP ChgFP FACE",
    "Realtime=1",
    "Encrypt=None",
    "ServerVer=2.4.1",
    "",
  ].join("\n");
}
