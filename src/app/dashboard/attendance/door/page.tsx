"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";
import { toast } from "sonner";
import { Copy, DoorOpen, Fingerprint, Loader2, RefreshCw, Trash2, Wifi, WifiOff } from "lucide-react";
import { DashboardPageHeader } from "@/components/dashboard/dashboard-page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

type DoorData = {
  server: { host: string };
  devices: {
    id: string;
    name: string;
    serialNumber: string;
    lastSeenAt: string | null;
    lastSyncAt: string | null;
    pendingCommands: number;
  }[];
  members: {
    memberId: string;
    name: string;
    phone: string;
    doorId: number;
    accessGranted: boolean;
    validUntil: string | null;
    enrolled: boolean;
  }[];
  unassignedMembers: number;
  doorCheckInsLast24h: number;
};

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to load");
  return res.json();
};

function timeAgo(iso: string | null): string {
  if (!iso) return "never";
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 48) return `${hrs} h ago`;
  return new Date(iso).toLocaleDateString("en-IN");
}

function CopyField({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border bg-muted/40 px-3 py-2">
      <div className="min-w-0">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="truncate font-mono text-sm">{value}</div>
      </div>
      <Button
        variant="ghost"
        size="icon"
        aria-label={`Copy ${label}`}
        onClick={() => {
          navigator.clipboard?.writeText(value);
          toast.success(`${label} copied`);
        }}
      >
        <Copy className="h-4 w-4" />
      </Button>
    </div>
  );
}

export default function BiometricDoorPage() {
  const { data, error, isLoading, mutate } = useSWR<DoorData>("/api/biometric", fetcher, {
    refreshInterval: 30000,
  });
  const [serial, setSerial] = useState("");
  const [deviceName, setDeviceName] = useState("Main door");
  const [busy, setBusy] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  async function act(action: string, extra: Record<string, unknown> = {}, okMsg?: string) {
    setBusy(action);
    try {
      const res = await fetch("/api/biometric", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...extra }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(body?.error?.message ?? body?.error ?? body?.message ?? "Something went wrong");
        return false;
      }
      if (okMsg) toast.success(okMsg);
      await mutate();
      return true;
    } finally {
      setBusy(null);
    }
  }

  const members = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = data?.members ?? [];
    if (!q) return list;
    return list.filter(
      (m) => m.name.toLowerCase().includes(q) || m.phone.includes(q) || String(m.doorId) === q,
    );
  }, [data?.members, query]);

  const allowedCount = data?.members.filter((m) => m.accessGranted).length ?? 0;
  const enrolledCount = data?.members.filter((m) => m.enrolled).length ?? 0;

  return (
    <div className="space-y-6">
      <DashboardPageHeader
        title="Biometric door"
        description="Members scan face or fingerprint to open the door. Each scan counts as attendance, and access stops automatically when a membership expires."
        actions={
          <Button
            variant="outline"
            onClick={() => act("syncNow", {}, "Door access re-checked")}
            disabled={busy !== null || !data}
          >
            {busy === "syncNow" ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Sync access now
          </Button>
        }
      />

      {error && (
        <p className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          Couldn&apos;t load door settings. Refresh the page to try again.
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Door check-ins (last 24 h)</CardDescription>
            <CardTitle className="text-3xl">{data?.doorCheckInsLast24h ?? "–"}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Members with door access</CardDescription>
            <CardTitle className="text-3xl">{data ? allowedCount : "–"}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Face / fingerprint saved</CardDescription>
            <CardTitle className="text-3xl">{data ? enrolledCount : "–"}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DoorOpen className="h-5 w-5 text-primary" /> 1. Connect the device
            </CardTitle>
            <CardDescription>
              On the device: Menu → Comm. → Cloud Server Setting (ADMS). Enter these values, turn on
              HTTPS if the option exists, and save.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <CopyField label="Server address" value={data?.server.host ?? "…"} />
            <div className="grid grid-cols-2 gap-2">
              <CopyField label="Port" value="443" />
              <CopyField label="Proxy" value="Off" />
            </div>
            <p className="pt-1 text-xs text-muted-foreground">
              The device must have internet (Wi-Fi or LAN). It checks in every few seconds.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wifi className="h-5 w-5 text-primary" /> 2. Add it here
            </CardTitle>
            <CardDescription>
              Find the serial number on the device: Menu → System Info → Device Info (or the sticker on the back).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <form
              className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
              onSubmit={async (e) => {
                e.preventDefault();
                const ok = await act(
                  "addDevice",
                  { serialNumber: serial, name: deviceName },
                  "Device added",
                );
                if (ok) setSerial("");
              }}
            >
              <div className="space-y-1.5">
                <Label htmlFor="sn">Serial number</Label>
                <Input id="sn" value={serial} onChange={(e) => setSerial(e.target.value)} placeholder="e.g. CQZ7224960123" required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="dname">Name</Label>
                <Input id="dname" value={deviceName} onChange={(e) => setDeviceName(e.target.value)} required />
              </div>
              <Button type="submit" disabled={busy !== null}>
                {busy === "addDevice" && <Loader2 className="h-4 w-4 animate-spin" />}
                Add
              </Button>
            </form>

            {data?.devices.length ? (
              <ul className="divide-y rounded-lg border">
                {data.devices.map((d) => {
                  const online = d.lastSeenAt && Date.now() - new Date(d.lastSeenAt).getTime() < 5 * 60000;
                  return (
                    <li key={d.id} className="flex items-center justify-between gap-3 p-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 font-medium">
                          {online ? (
                            <Wifi className="h-4 w-4 text-emerald-500" />
                          ) : (
                            <WifiOff className="h-4 w-4 text-muted-foreground" />
                          )}
                          {d.name}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {d.serialNumber} · last seen {timeAgo(d.lastSeenAt)}
                          {d.pendingCommands > 0 && ` · ${d.pendingCommands} updates waiting`}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Remove ${d.name}`}
                        disabled={busy !== null}
                        onClick={() => {
                          if (confirm(`Remove ${d.name}? It will stop sending attendance.`)) {
                            act("removeDevice", { deviceId: d.id }, "Device removed");
                          }
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No devices yet.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1.5">
            <CardTitle className="flex items-center gap-2">
              <Fingerprint className="h-5 w-5 text-primary" /> 3. Enroll members
            </CardTitle>
            <CardDescription>
              Each member gets a Door ID. Active members are sent to the device automatically. On the
              device, open User Mgt → find the Door ID → enroll face or fingerprint.
            </CardDescription>
          </div>
          {(data?.unassignedMembers ?? 0) > 0 && (
            <Button onClick={() => act("assignDoorIds", {}, "Door IDs assigned")} disabled={busy !== null}>
              {busy === "assignDoorIds" && <Loader2 className="h-4 w-4 animate-spin" />}
              Give Door IDs to {data?.unassignedMembers} members
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-3">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name, phone or Door ID"
            className="max-w-sm"
          />
          {isLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading…
            </div>
          ) : members.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {data?.members.length ? "No matches." : "No members have Door IDs yet."}
            </p>
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 font-medium">Door ID</th>
                    <th className="px-3 py-2 font-medium">Member</th>
                    <th className="px-3 py-2 font-medium">Door access</th>
                    <th className="px-3 py-2 font-medium">Valid till</th>
                    <th className="px-3 py-2 font-medium">Face / finger</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {members.map((m) => (
                    <tr key={m.memberId}>
                      <td className="px-3 py-2 font-mono font-semibold">{m.doorId}</td>
                      <td className="px-3 py-2">
                        <div className="font-medium">{m.name}</div>
                        <div className="text-xs text-muted-foreground">{m.phone}</div>
                      </td>
                      <td className="px-3 py-2">
                        {m.accessGranted ? <Badge>Allowed</Badge> : <Badge variant="destructive">Blocked</Badge>}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {m.validUntil ? new Date(m.validUntil).toLocaleDateString("en-IN") : "–"}
                      </td>
                      <td className="px-3 py-2">
                        {m.enrolled ? <Badge variant="secondary">Saved</Badge> : <span className="text-muted-foreground">Not yet</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
