import tls from "node:tls";
import { randomUUID } from "node:crypto";

// A small SMTP client (implicit TLS, port 465, AUTH LOGIN) so the site
// can send mail from support@buyamsellam.shop through Hostinger without
// adding a mail library. Settings come from SMTP_HOST, SMTP_PORT,
// SMTP_USER and SMTP_PASSWORD; when any is missing, sending is skipped.

export type MailInput = {
  to: string;
  subject: string;
  text: string;
  html: string;
  replyTo?: string;
};

function config() {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASSWORD;
  const port = Number(process.env.SMTP_PORT || 465);
  if (!host || !user || !pass) return null;
  return { host, user, pass, port };
}

export function isMailConfigured() {
  return config() !== null;
}

const b64 = (s: string) => Buffer.from(s, "utf8").toString("base64");
const wrap76 = (s: string) => s.replace(/.{1,76}/g, "$&\r\n");
const encodeHeader = (s: string) => (/^[\x20-\x7e]*$/.test(s) ? s : `=?UTF-8?B?${b64(s)}?=`);

function buildMessage(from: string, input: MailInput) {
  const boundary = `bs_${randomUUID()}`;
  const domain = from.split("@")[1] ?? "buyamsellam.shop";
  const headers = [
    `From: ${encodeHeader("Buyam Sellam")} <${from}>`,
    `To: <${input.to}>`,
    `Subject: ${encodeHeader(input.subject)}`,
    `Date: ${new Date().toUTCString()}`,
    `Message-ID: <${randomUUID()}@${domain}>`,
    ...(input.replyTo ? [`Reply-To: <${input.replyTo}>`] : []),
    "MIME-Version: 1.0",
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
  ];
  const body = [
    `--${boundary}`,
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "",
    wrap76(b64(input.text)),
    `--${boundary}`,
    "Content-Type: text/html; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "",
    wrap76(b64(input.html)),
    `--${boundary}--`,
    "",
  ];
  return [...headers, "", ...body].join("\r\n");
}

export async function sendMail(input: MailInput): Promise<{ sent: boolean; skipped?: boolean }> {
  const cfg = config();
  if (!cfg) return { sent: false, skipped: true };
  if (!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(input.to)) throw new Error("Invalid recipient address.");

  const socket = tls.connect({ host: cfg.host, port: cfg.port, servername: cfg.host });
  socket.setEncoding("utf8");
  socket.setTimeout(20000);

  let buffer = "";
  const waiters: ((reply: { code: number; text: string }) => void)[] = [];
  let failure: Error | null = null;

  const flush = () => {
    // A reply is complete when a line starts with "NNN " (not "NNN-").
    while (waiters.length) {
      const lines = buffer.split("\r\n");
      const endIndex = lines.findIndex((l) => /^\d{3} /.test(l));
      if (endIndex === -1) return;
      const replyLines = lines.slice(0, endIndex + 1);
      buffer = lines.slice(endIndex + 1).join("\r\n");
      const last = replyLines[replyLines.length - 1];
      waiters.shift()!({ code: Number(last.slice(0, 3)), text: replyLines.join("\n") });
    }
  };
  socket.on("data", (chunk: string) => {
    buffer += chunk;
    flush();
  });
  const fail = (err: Error) => {
    failure = err;
    socket.destroy();
  };
  socket.on("error", fail);
  socket.on("timeout", () => fail(new Error("SMTP timeout")));

  const reply = () =>
    new Promise<{ code: number; text: string }>((resolve, reject) => {
      if (failure) return reject(failure);
      const onClose = () => reject(failure ?? new Error("SMTP connection closed"));
      socket.once("close", onClose);
      waiters.push((r) => {
        socket.off("close", onClose);
        resolve(r);
      });
      flush();
    });
  const command = async (line: string, expect: number[]) => {
    socket.write(line + "\r\n");
    const r = await reply();
    if (!expect.includes(r.code)) throw new Error(`SMTP ${r.code}: ${r.text.slice(0, 200)}`);
    return r;
  };

  try {
    const greeting = await reply();
    if (greeting.code !== 220) throw new Error(`SMTP greeting ${greeting.code}`);
    await command(`EHLO ${cfg.user.split("@")[1] ?? "localhost"}`, [250]);
    await command("AUTH LOGIN", [334]);
    await command(b64(cfg.user), [334]);
    await command(b64(cfg.pass), [235]);
    await command(`MAIL FROM:<${cfg.user}>`, [250]);
    await command(`RCPT TO:<${input.to}>`, [250, 251]);
    await command("DATA", [354]);
    const message = buildMessage(cfg.user, input).replace(/\r\n\./g, "\r\n..");
    await command(`${message}\r\n.`, [250]);
    socket.write("QUIT\r\n");
    socket.end();
    return { sent: true };
  } catch (err) {
    socket.destroy();
    throw err;
  }
}
