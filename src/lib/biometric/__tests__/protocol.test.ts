import {
  cmdAddUser,
  cmdDeleteUser,
  deviceSafeName,
  deviceTimeToDate,
  formatCommands,
  handshakeReply,
  parseAttlog,
  parseCommandResults,
  parseTemplates,
} from "../protocol";

describe("biometric ADMS protocol", () => {
  it("reads device time as IST", () => {
    expect(deviceTimeToDate("2026-11-28 07:02:11")?.toISOString()).toBe("2026-11-28T01:32:11.000Z");
    expect(deviceTimeToDate("garbage")).toBeNull();
  });

  it("parses ATTLOG punches and skips bad lines", () => {
    const body =
      "12\t2026-11-28 07:02:11\t0\t1\t0\t0\t0\n" +
      "abc\t2026-11-28 07:03:00\t0\t1\n" +
      "\n" +
      "7\t2026-11-28 18:45:00\t0\t15\t\t0\t0\r\n";
    const p = parseAttlog(body);
    expect(p.map((x) => x.pin)).toEqual([12, 7]);
    expect(p[1].time.toISOString()).toBe("2026-11-28T13:15:00.000Z");
  });

  it("extracts replayable fingerprint, face and BIODATA templates from OPERLOG", () => {
    const body = [
      "OPLOG 6\t0\t2026-11-28 07:00:00\t12\t0\t0\t0",
      "USER PIN=12\tName=Ravi\tPri=0\tPasswd=\tCard=\tGrp=1",
      "FP PIN=12\tFID=6\tSize=4\tValid=1\tTMP=QUJDRA==",
      "FACE PIN=12\tFID=0\tSize=4\tValid=1\tTMP=RkFDRQ==",
      "BIODATA Pin=12\tNo=0\tIndex=0\tValid=1\tDuress=0\tType=9\tMajorVer=5\tMinorVer=8\tFormat=0\tTmp=QklP",
      "FP PIN=13\tFID=1\tSize=4\tValid=0\tTMP=WA==",
    ].join("\n");
    const t = parseTemplates(body, "OPERLOG");
    expect(t).toHaveLength(3);
    expect(t[0]).toEqual({
      pin: 12,
      table: "FINGERTMP",
      slot: "6",
      data: "PIN=12\tFID=6\tSize=4\tValid=1\tTMP=QUJDRA==",
    });
    expect(t[1].table).toBe("FACE");
    expect(t[2]).toMatchObject({ table: "BIODATA", slot: "9:0:0" });
  });

  it("accepts un-prefixed lines when posted to a template table", () => {
    const t = parseTemplates("PIN=3\tFID=2\tSize=4\tValid=1\tTMP=QQ==", "FINGERTMP");
    expect(t).toEqual([{ pin: 3, table: "FINGERTMP", slot: "2", data: "PIN=3\tFID=2\tSize=4\tValid=1\tTMP=QQ==" }]);
  });

  it("parses devicecmd results", () => {
    expect(parseCommandResults("ID=5&Return=0&CMD=DATA\nID=6&Return=-1002&CMD=DATA\n")).toEqual([
      { id: 5, returnCode: 0, cmd: "DATA" },
      { id: 6, returnCode: -1002, cmd: "DATA" },
    ]);
  });

  it("formats commands and handshake", () => {
    expect(formatCommands([])).toBe("OK");
    expect(formatCommands([{ id: 1, command: cmdDeleteUser(4) }])).toBe("C:1:DATA DELETE USERINFO PIN=4\n");
    expect(cmdAddUser(4, "Ravi\tKumar\nஎ")).toBe("DATA UPDATE USERINFO PIN=4\tName=Ravi Kumar\tPri=0");
    expect(handshakeReply("SN1")).toContain("GET OPTION FROM: SN1");
  });

  it("keeps device names short and ASCII", () => {
    expect(deviceSafeName("ಭೂಮಿ")).toBe("Member");
    expect(deviceSafeName("A".repeat(40))).toHaveLength(24);
  });
});
