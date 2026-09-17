/**
 * Seeds Nocturne CTF: the challenges, the files players download, the values
 * the vulnerable challenge pages serve, and a default event window.
 *
 *   npm run ctf:seed                 write files, then seed with the service role
 *   npm run ctf:seed -- --sql out.sql  write files, then write SQL to run in the
 *                                      Supabase SQL editor instead
 *   npm run ctf:seed -- --files-only   regenerate public/ctf-files only
 *
 * THIS IS THE ONLY PLACE PLAINTEXT FLAGS EXIST. The database stores
 * sha256(normalizeFlag(flag)); the downloadable files hold the flags only in
 * the encoded form each challenge is about. If this repository is public,
 * anyone can read the answers here - change the flags below (and re-run) for a
 * round where that matters. Set CTF_FLAG_<SLUG> (e.g. CTF_FLAG_CAESARS_GHOST)
 * to override one without editing the file.
 *
 * Re-running is safe: challenges are upserted by slug and keep their
 * active/inactive state, the event window is only created if missing, and no
 * player data is touched.
 */

import fs from "node:fs";
import path from "node:path";

import { createClient } from "@supabase/supabase-js";
import { config as loadEnv } from "dotenv";

import { caesarShift, singleByteXorHex } from "@/lib/ctf/artifacts/ciphers";
import { embedLsb, encodePng, type RgbImage } from "@/lib/ctf/artifacts/png";
import { hashFlag } from "@/lib/ctf/flag";
import type { Database } from "@/lib/supabase/database.types";

loadEnv({ path: ".env.local", quiet: true });
loadEnv({ quiet: true });

type Category = "web" | "crypto" | "forensics" | "misc";

export interface ChallengeSeed {
  slug: string;
  category: Category;
  title: string;
  points: number;
  sort_order: number;
  prompt_md: string;
  explanation_md: string;
  hints: { text: string; cost: number }[];
  file_path: string | null;
}

const DEFAULT_FLAGS: Record<string, string> = {
  "robots-dont-lie": "flag{robots_txt_is_a_map_not_a_lock}",
  "sequential-secrets": "flag{idor_note_eight_was_never_yours}",
  "caesars-ghost": "flag{et_tu_brute_force}",
  "xor-marks-the-spot": "flag{single_byte_keys_leave_patterns}",
  "metadata-never-forgets": "flag{metadata_remembers_what_you_forgot}",
  "packet-whisper": "flag{dns_queries_carry_more_than_names}",
  "know-your-frameworks": "flag{T1059.001}",
  "hidden-in-plain-sight": "flag{least_significant_most_important}",
};

export function flagFor(slug: string): string {
  const override = process.env[`CTF_FLAG_${slug.toUpperCase().replace(/-/g, "_")}`];
  return override || DEFAULT_FLAGS[slug];
}

export const FILES = {
  xor: "/ctf-files/beacon-capture-0412.txt",
  jpeg: "/ctf-files/lobby-cam-03.jpg",
  dns: "/ctf-files/dns-export-wks-fin-003.json",
  png: "/ctf-files/northwind-night-sky.png",
} as const;

const CAESAR_SHIFT = 11;
const XOR_KEY = 0x4e;

export function buildChallenges(): ChallengeSeed[] {
  return [
    {
      slug: "robots-dont-lie",
      category: "web",
      title: "Robots Don't Lie",
      points: 100,
      sort_order: 1,
      prompt_md: [
        "Northwind Polytechnic's staff intranet lives at [/ctf/site](/ctf/site).",
        "",
        "The web team insists nothing sensitive is linked from it. They are right: nothing is *linked*.",
        "",
        "Find the flag.",
      ].join("\n"),
      explanation_md: [
        "`robots.txt` asks well-behaved crawlers to stay away from certain paths. It does not stop anyone, and it tells an attacker exactly where the interesting pages are. Checking it is one of the first steps of web reconnaissance.",
        "",
        "The flag was in an HTML comment. Comments are sent to every visitor - **View Source** (Ctrl+U) shows them. Anything sensitive has to be protected by real access control on the server, never hidden.",
      ].join("\n"),
      hints: [
        { text: "Websites tell search engine crawlers where *not* to go. Where does that list live?", cost: 25 },
        {
          text: "Open [/ctf/site/robots.txt](/ctf/site/robots.txt), visit the path it disallows, then view the page source (Ctrl+U).",
          cost: 50,
        },
      ],
      file_path: null,
    },
    {
      slug: "sequential-secrets",
      category: "web",
      title: "Sequential Secrets",
      points: 200,
      sort_order: 2,
      prompt_md: [
        "Northwind Notes lets every member of staff keep private notes. Now that you have joined, you have one too:",
        "",
        "[/api/ctf/notes/7](/api/ctf/notes/7)",
        "",
        "The notes service checks that you are signed in. Does it check anything else?",
      ].join("\n"),
      explanation_md: [
        "This is an **Insecure Direct Object Reference (IDOR)**. The service confirmed *who you are* but never asked whether note 8 was *yours* - the record id in the URL was the only thing standing between you and someone else's data.",
        "",
        "It sits under **OWASP A01:2021 - Broken Access Control**, the same category the web application incident in NocturneAnalysis asks you to rule in or out. The fix is an ownership check on every read (`where owner = current_user`), or row-level security in the database, not ids that are harder to guess.",
        "",
        "See the [OWASP Top 10 reference](/owasp).",
      ].join("\n"),
      hints: [
        { text: "Look at the address you used to read your own note. What is the only thing in it that identifies the note?", cost: 50 },
        { text: "Change the 7 to the next number up.", cost: 100 },
      ],
      file_path: null,
    },
    {
      slug: "caesars-ghost",
      category: "crypto",
      title: "Caesar's Ghost",
      points: 100,
      sort_order: 1,
      prompt_md: [
        "An intercepted message from a very old-fashioned attacker:",
        "",
        "```",
        caesarShift(flagFor("caesars-ghost"), CAESAR_SHIFT),
        "```",
        "",
        "Every letter was moved the same distance along the alphabet. Punctuation was left alone.",
      ].join("\n"),
      explanation_md: [
        "A **Caesar cipher** shifts every letter by a fixed amount. There are only 25 possible shifts, so it falls to brute force by hand - and here you also knew the first four letters of the plaintext (`flag`), which gives the shift away immediately.",
        "",
        "That second idea, a **known-plaintext attack**, breaks far stronger ciphers than this one. Predictable headers and file formats are exactly the kind of known plaintext real attacks use.",
      ].join("\n"),
      hints: [
        { text: "There are only 25 possible shifts. Try them all - by hand or with a few lines of code.", cost: 25 },
        { text: "The plaintext starts with `flag`. How many letters is it from `f` to the first letter of the message?", cost: 50 },
      ],
      file_path: null,
    },
    {
      slug: "xor-marks-the-spot",
      category: "crypto",
      title: "XOR Marks the Spot",
      points: 300,
      sort_order: 2,
      prompt_md: [
        "Before WKS-FIN-003 was contained, its implant sent one last payload. The reverse engineer says the malware \"encrypts\" everything with a **single-byte XOR key**.",
        "",
        "Download the capture and recover what it sent.",
      ].join("\n"),
      explanation_md: [
        "XOR with one repeated byte has only 256 possible keys. Try each, keep the output that is readable text, and you are done - or XOR the first ciphertext byte with `f`, since the plaintext starts with `flag{`.",
        "",
        "Commodity malware still uses single-byte XOR to hide strings and configuration from simple scanners. It stops `strings`; it does not stop an analyst.",
      ].join("\n"),
      hints: [
        { text: "The payload is hex. Turn it back into raw bytes first.", cost: 50 },
        {
          text: "Try all 256 keys and look for readable output. In CyberChef: *From Hex*, then *XOR Brute Force*. In Python: `bytes(b ^ k for b in data)` for each `k` in `range(256)`.",
          cost: 100,
        },
      ],
      file_path: FILES.xor,
    },
    {
      slug: "metadata-never-forgets",
      category: "forensics",
      title: "Metadata Never Forgets",
      points: 200,
      sort_order: 1,
      prompt_md: [
        "Facilities exported this still from lobby camera 3 for an incident report.",
        "",
        "Someone left more in the file than the picture shows.",
      ].join("\n"),
      explanation_md: [
        "Image files carry **metadata** alongside the pixels: camera make and model, timestamps, GPS positions, editing software and free-text comments. `exiftool` shows all of it, and `strings` finds readable text in any file.",
        "",
        "Investigators rely on metadata to date and place evidence. Attackers rely on it too - photos posted online have given away home locations and internal hostnames.",
      ].join("\n"),
      hints: [
        { text: "A photo is more than its pixels. Look at the file's metadata.", cost: 50 },
        { text: "Run `exiftool lobby-cam-03.jpg`, or `strings lobby-cam-03.jpg`. No tools installed? Open the file in a hex viewer and read the text near the start.", cost: 100 },
      ],
      file_path: FILES.jpeg,
    },
    {
      slug: "packet-whisper",
      category: "forensics",
      title: "Packet Whisper",
      points: 400,
      sort_order: 2,
      prompt_md: [
        "EDR raised an alert for unusual DNS volume from **WKS-FIN-003**. This is the host's DNS log export for the hour - the same format the NocturneAnalysis console uses.",
        "",
        "Most of it is ordinary Northwind traffic. Something left the network hidden inside a query name.",
      ].join("\n"),
      explanation_md: [
        "This is **DNS exfiltration** (ATT&CK T1048 and T1071.004). DNS is allowed out of almost every network, so malware packs stolen data into subdomain labels, often base64 or hex encoded, and sends it to a domain the attacker controls. The attacker's name server simply logs the queries.",
        "",
        "Tells to hunt for: long, high-entropy labels; many unique subdomains under one rarely seen domain; TXT queries from a workstation; and a steady beacon-like rhythm. The phishing incident in NocturneAnalysis has you read exactly these logs.",
      ].join("\n"),
      hints: [
        { text: "Group the queries by their parent domain. Which one has lots of different, meaningless-looking subdomains?", cost: 100 },
        { text: "Those labels are base64. Base64 of `flag{` starts with `ZmxhZ3`.", cost: 150 },
      ],
      file_path: FILES.dns,
    },
    {
      slug: "know-your-frameworks",
      category: "misc",
      title: "Know Your Frameworks",
      points: 100,
      sort_order: 1,
      prompt_md: [
        "In the NocturneAnalysis phishing incident, a malicious attachment launches an encoded PowerShell command.",
        "",
        "Which MITRE ATT&CK **sub-technique** ID describes adversaries using PowerShell for execution?",
        "",
        "Submit it in the flag wrapper, for example `flag{T0000.000}`. The platform's [ATT&CK reference](/mitre) is fair game.",
      ].join("\n"),
      explanation_md: [
        "**T1059.001 - Command and Scripting Interpreter: PowerShell.** The parent technique T1059 covers every interpreter; the `.001` sub-technique narrows it to PowerShell.",
        "",
        "Mapping what you see to ATT&CK IDs is how SOC teams describe an intrusion in a shared language, measure detection coverage and compare incidents. Every NocturneAnalysis scenario asks you to do it.",
      ].join("\n"),
      hints: [
        { text: "Look under the **Execution** tactic in the [ATT&CK reference](/mitre), at *Command and Scripting Interpreter*.", cost: 25 },
      ],
      file_path: null,
    },
    {
      slug: "hidden-in-plain-sight",
      category: "misc",
      title: "Hidden in Plain Sight",
      points: 500,
      sort_order: 2,
      prompt_md: [
        "**The hardest challenge - save it for last.**",
        "",
        "The Northwind astronomy club posted this photo of the night sky. It looks untouched, and almost every pixel is exactly what it seems. *Almost.*",
        "",
        "Tools that can help: `zsteg`, Stegsolve, or a few lines of Python with Pillow.",
      ].join("\n"),
      explanation_md: [
        "This is **least significant bit (LSB) steganography**. Changing the lowest bit of a colour value moves it by at most 1 out of 255 - invisible to the eye - so each pixel can carry three hidden bits in its red, green and blue values.",
        "",
        "It only survives lossless formats. Re-save the PNG as a JPEG and the message is gone, which is why the challenge ships a PNG. Steganography is used to smuggle data and malware configuration past controls that only inspect what files *look* like.",
      ].join("\n"),
      hints: [
        { text: "Nothing is in the metadata this time. The message is in the lowest bit of the colour values.", cost: 100 },
        {
          text: [
            "Read bit 0 of R, G and B for each pixel, left to right and top to bottom, and group the bits into bytes, most significant bit first. zsteg calls this `b1,rgb,msb,xy`. In Python:",
            "",
            "```python",
            "from PIL import Image",
            "img = Image.open('northwind-night-sky.png').convert('RGB')",
            "bits = [b & 1 for b in img.tobytes()]",
            "data = bytes(int(''.join(map(str, bits[i:i+8])), 2) for i in range(0, 4000, 8))",
            "print(data.split(b'\\x00')[0])",
            "```",
          ].join("\n"),
          cost: 150,
        },
      ],
      file_path: FILES.png,
    },
  ];
}

// ------------------------------------------------------------------ files --

/** Deterministic, so re-running the seed does not churn the committed files. */
function prng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function buildXorFile(): string {
  const hex = singleByteXorHex(flagFor("xor-marks-the-spot"), XOR_KEY);
  return [
    "# Northwind SOC - network capture extract",
    "# case:      IR-2025-0412",
    "# host:      WKS-FIN-003 (10.20.5.33)",
    "# direction: outbound, tcp/8443",
    "# note:      final payload before containment; implant uses single-byte XOR",
    "",
    hex.match(/.{1,32}/g)!.join("\n"),
    "",
  ].join("\n");
}

export function buildDnsLog(): object[] {
  const rand = prng(0x0412);
  const client = "10.20.5.33";
  const resolver = "10.20.1.10";
  const exfilDomain = "sync.telemetry-cdn.example";

  const b64 = (text: string) => Buffer.from(text, "utf8").toString("base64").replace(/=+$/, "");
  const exfilLabels = [
    b64("host=WKS-FIN-003"),
    b64("user=k.lim"),
    b64("stage=collect"),
    Buffer.from(flagFor("packet-whisper"), "utf8").toString("base64").replace(/=+$/, ""),
    b64("files=3 ok"),
    b64("stage=done"),
  ];
  for (const label of exfilLabels) {
    if (label.length > 63 || /[+/]/.test(label)) {
      throw new Error(`Exfil label "${label}" is not a valid DNS label; pick a different flag.`);
    }
  }

  const normal: [string, string, string][] = [
    ["portal.northwind.example", "A", "10.20.1.25"],
    ["mail.northwind.example", "A", "10.20.1.30"],
    ["cdn.northwind.example", "A", "10.20.1.40"],
    ["time.northwind.example", "A", "10.20.1.11"],
    ["fs01.northwind.example", "A", "10.20.2.15"],
    ["updates.vendor-patch.example", "A", "203.0.113.20"],
    ["login.office-suite.example", "A", "198.51.100.14"],
    ["wpad.northwind.example", "A", "NXDOMAIN"],
  ];

  const start = Date.parse("2025-04-12T14:00:00.000Z");
  const events: { ts: number; domain: string; type: string; response: string }[] = [];

  for (let i = 0; i < 34; i += 1) {
    const [domain, type, response] = normal[Math.floor(rand() * normal.length)];
    const hex = Math.floor(rand() * 0xffffffff).toString(16).padStart(8, "0");
    const name = domain.startsWith("cdn.") ? `${hex}.${domain}` : domain;
    events.push({ ts: start + Math.floor(rand() * 3600) * 1000, domain: name, type, response });
  }
  exfilLabels.forEach((label, i) => {
    events.push({
      ts: start + (1820 + i * 30 + Math.floor(rand() * 4)) * 1000,
      domain: `${label}.${exfilDomain}`,
      type: "TXT",
      response: '"ack"',
    });
  });
  events.sort((a, b) => a.ts - b.ts);

  return events.map((event, i) => {
    const nx = event.response === "NXDOMAIN";
    return {
      id: `log-dns-${String(i + 1).padStart(3, "0")}`,
      ts: new Date(event.ts).toISOString(),
      source: "dns",
      message: `query=${event.domain} type=${event.type} response=${nx ? "-" : event.response} rcode=${nx ? "NXDOMAIN" : "NOERROR"} client=${client}`,
      host: "WKS-FIN-003",
      domain: event.domain,
      src_ip: client,
      dst_ip: resolver,
      action: nx ? "nxdomain" : "resolved",
      fields: { query_type: event.type, rcode: nx ? "NXDOMAIN" : "NOERROR" },
    };
  });
}

export function buildSkyImage(): RgbImage {
  const width = 480;
  const height = 300;
  const rand = prng(0x5c7);
  const pixels = new Uint8Array(width * height * 3);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const t = y / height;
      const i = (y * width + x) * 3;
      pixels[i] = Math.round(8 + 30 * t);
      pixels[i + 1] = Math.round(12 + 34 * t);
      pixels[i + 2] = Math.round(38 + 60 * t);
    }
  }
  // Stars.
  for (let s = 0; s < 260; s += 1) {
    const x = Math.floor(rand() * width);
    const y = Math.floor(rand() * height * 0.8);
    const b = 150 + Math.floor(rand() * 105);
    const r = rand() < 0.1 ? 1 : 0;
    for (let dy = -r; dy <= r; dy += 1) {
      for (let dx = -r; dx <= r; dx += 1) {
        const px = x + dx;
        const py = y + dy;
        if (px < 0 || py < 0 || px >= width || py >= height) continue;
        const i = (py * width + px) * 3;
        pixels[i] = b;
        pixels[i + 1] = b;
        pixels[i + 2] = Math.min(255, b + 20);
      }
    }
  }
  // Moon.
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const d = Math.hypot(x - 380, y - 70);
      const shadow = Math.hypot(x - 392, y - 62);
      if (d < 26 && shadow >= 24) {
        const i = (y * width + x) * 3;
        pixels[i] = 236;
        pixels[i + 1] = 232;
        pixels[i + 2] = 210;
      }
    }
  }
  // Horizon: a dark treeline.
  for (let x = 0; x < width; x += 1) {
    const top = Math.round(height - 40 - 14 * Math.sin(x / 23) - 8 * Math.sin(x / 7.3) - rand() * 3);
    for (let y = top; y < height; y += 1) {
      const i = (y * width + x) * 3;
      pixels[i] = 6;
      pixels[i + 1] = 10;
      pixels[i + 2] = 12;
    }
  }
  return { width, height, pixels };
}

/** Inserts a JPEG COM segment after the APPn headers. */
function withJpegComment(jpeg: Buffer, comment: string): Buffer {
  let offset = 2;
  while (jpeg[offset] === 0xff && jpeg[offset + 1] >= 0xe0 && jpeg[offset + 1] <= 0xef) {
    offset += 2 + jpeg.readUInt16BE(offset + 2);
  }
  const body = Buffer.from(comment, "utf8");
  const segment = Buffer.alloc(4);
  segment[0] = 0xff;
  segment[1] = 0xfe;
  segment.writeUInt16BE(body.length + 2, 2);
  return Buffer.concat([jpeg.subarray(0, offset), segment, body, jpeg.subarray(offset)]);
}

async function buildLobbyJpeg(): Promise<Buffer> {
  // sharp ships with Next.js; it is only needed to regenerate this one file.
  const { default: sharp } = await import("sharp");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="400">
  <rect width="640" height="400" fill="#3b4148"/>
  <rect y="260" width="640" height="140" fill="#6b6259"/>
  <rect x="40" y="60" width="180" height="200" fill="#1f2a33" stroke="#9aa5ad" stroke-width="6"/>
  <rect x="236" y="60" width="180" height="200" fill="#1f2a33" stroke="#9aa5ad" stroke-width="6"/>
  <rect x="470" y="150" width="130" height="110" fill="#7a5c3e"/>
  <rect x="455" y="140" width="160" height="16" fill="#8d6c4b"/>
  <circle cx="520" cy="118" r="16" fill="#c9a07a"/>
  <rect x="505" y="134" width="30" height="20" fill="#2d4a6b"/>
  <text x="470" y="200" font-family="sans-serif" font-size="18" fill="#e8dcc8">RECEPTION</text>
  <rect x="0" y="0" width="640" height="34" fill="#000" opacity="0.55"/>
  <text x="12" y="23" font-family="monospace" font-size="18" fill="#e6e6e6">CAM 03  LOBBY  2025-04-12 21:47:09</text>
  <circle cx="620" cy="17" r="7" fill="#e53935"/>
</svg>`;
  const jpeg = await sharp(Buffer.from(svg))
    .jpeg({ quality: 82 })
    .withExif({
      IFD0: {
        Make: "Northwind Facilities",
        Model: "LobbyCam 3",
        ImageDescription: "Lobby camera 3 - still export for IR-2025-0412",
        Artist: "facilities.desk",
        DateTime: "2025:04:12 21:47:09",
      },
    })
    .toBuffer();
  return withJpegComment(jpeg, `Exported by facilities.desk. Evidence tag: ${flagFor("metadata-never-forgets")}`);
}

export async function writeFiles(root = process.cwd()): Promise<void> {
  const dir = path.join(root, "public", "ctf-files");
  fs.mkdirSync(dir, { recursive: true });
  const out = (file: string) => path.join(root, "public", file);

  fs.writeFileSync(out(FILES.xor), buildXorFile());
  fs.writeFileSync(out(FILES.dns), `${JSON.stringify(buildDnsLog(), null, 2)}\n`);
  fs.writeFileSync(out(FILES.png), encodePng(embedLsb(buildSkyImage(), flagFor("hidden-in-plain-sight"))));
  fs.writeFileSync(out(FILES.jpeg), await buildLobbyJpeg());
}

// ---------------------------------------------------------------- database --

function sqlString(value: string | null): string {
  return value === null ? "null" : `'${value.replace(/'/g, "''")}'`;
}

export function buildSql(): string {
  const lines = ["-- Nocturne CTF seed. Contains flag hashes and challenge secrets: do not commit.", "begin;", ""];

  for (const c of buildChallenges()) {
    lines.push(
      `insert into public.ctf_challenges (slug, category, title, points, sort_order, prompt_md, explanation_md, hints, file_path, flag_hash)`,
      `values (${[
        sqlString(c.slug),
        sqlString(c.category),
        sqlString(c.title),
        c.points,
        c.sort_order,
        sqlString(c.prompt_md),
        sqlString(c.explanation_md),
        `${sqlString(JSON.stringify(c.hints))}::jsonb`,
        sqlString(c.file_path),
        sqlString(hashFlag(flagFor(c.slug))),
      ].join(", ")})`,
      `on conflict (slug) do update set category = excluded.category, title = excluded.title, points = excluded.points,`,
      `  sort_order = excluded.sort_order, prompt_md = excluded.prompt_md, explanation_md = excluded.explanation_md,`,
      `  hints = excluded.hints, file_path = excluded.file_path, flag_hash = excluded.flag_hash;`,
      "",
    );
  }

  for (const key of ["robots-dont-lie", "sequential-secrets"]) {
    lines.push(
      `insert into public.ctf_site_secrets (key, value) values (${sqlString(key)}, ${sqlString(flagFor(key))})`,
      `on conflict (key) do update set value = excluded.value;`,
    );
  }

  lines.push(
    "",
    "insert into public.ctf_event (id, starts_at, ends_at) values (1, now(), now() + interval '14 days')",
    "on conflict (id) do nothing;",
    "",
    "commit;",
    "",
  );
  return lines.join("\n");
}

async function seedWithServiceRole(): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error(
      "Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local, or run with --sql <file> and paste the SQL into the Supabase SQL editor.",
    );
  }
  const db = createClient<Database>(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const rows = buildChallenges().map((c) => ({ ...c, flag_hash: hashFlag(flagFor(c.slug)) }));
  const challenges = await db.from("ctf_challenges").upsert(rows, { onConflict: "slug" });
  if (challenges.error) throw challenges.error;

  const secrets = await db.from("ctf_site_secrets").upsert(
    ["robots-dont-lie", "sequential-secrets"].map((key) => ({ key, value: flagFor(key) })),
    { onConflict: "key" },
  );
  if (secrets.error) throw secrets.error;

  const { data: event } = await db.from("ctf_event").select("id").eq("id", 1).maybeSingle();
  if (!event) {
    const now = Date.now();
    const created = await db.from("ctf_event").insert({
      id: 1,
      starts_at: new Date(now).toISOString(),
      ends_at: new Date(now + 14 * 24 * 3600 * 1000).toISOString(),
    });
    if (created.error) throw created.error;
  }
}

async function main() {
  const args = process.argv.slice(2);
  await writeFiles();
  process.stdout.write("Wrote public/ctf-files.\n");
  if (args.includes("--files-only")) return;

  const sqlIndex = args.indexOf("--sql");
  if (sqlIndex >= 0) {
    const target = args[sqlIndex + 1];
    if (!target) throw new Error("--sql needs a file path, e.g. --sql ctf-seed.sql");
    fs.writeFileSync(target, buildSql());
    process.stdout.write(`Wrote ${target}. Run it in the Supabase SQL editor, then delete it.\n`);
    return;
  }

  await seedWithServiceRole();
  process.stdout.write("Seeded the CTF challenges.\n");
}

if (process.argv[1]?.endsWith("ctf-seed.ts")) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
