import { formatRemaining } from "../core/time";
import type { PlaybackState, ResolvedSettings } from "../core/types";

export type MonitorView = "time" | "name" | "progress";
export type MonitorDisplayOptions = { showClipName?: boolean };

function escapeXml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[character]!);
}

function statusLabel(state: PlaybackState): string | undefined {
  switch (state.status) {
    case "connecting": return "CONNECTING";
    case "no-clip": return "NO CLIP";
    case "no-signal": return "NO SIGNAL";
    case "port-in-use": return "PORT IN USE";
    default: return undefined;
  }
}

export function stateColor(state: PlaybackState, settings: ResolvedSettings): string {
  if (state.status !== "ok") return state.status === "connecting" ? "#3b82f6" : "#dc2626";
  if (state.remainingSeconds <= settings.criticalSeconds) return "#dc2626";
  if (state.remainingSeconds <= settings.warningSeconds) return "#eab308";
  return "#16a34a";
}

function clipNameLines(value: string, width = 16, maxLines = 2): string[] {
  const characters = Array.from(value || "Resolume");
  const lines: string[] = [];
  for (let index = 0; index < maxLines && index * width < characters.length; index += 1) {
    const isLast = index === maxLines - 1;
    const hasMore = characters.length > (index + 1) * width;
    const end = (index + 1) * width - (isLast && hasMore ? 1 : 0);
    const line = characters.slice(index * width, end).join("") + (isLast && hasMore ? "…" : "");
    lines.push(escapeXml(line));
  }
  return lines.length > 0 ? lines : ["Resolume"];
}

export function renderMonitorSvg(view: MonitorView, state: PlaybackState, settings: ResolvedSettings, options: MonitorDisplayOptions = {}): string {
  const color = stateColor(state, settings);
  const status = statusLabel(state);
  const time = formatRemaining(state.remainingSeconds, settings);
  const [nameLine1] = clipNameLines(state.clipName || "Resolume");
  const nameLines = clipNameLines(state.clipName || "Resolume", 11, 3);
  const progress = Math.round(Math.max(0, Math.min(1, state.position)) * 116);
  const percent = Math.round(Math.max(0, Math.min(1, state.position)) * 100);
  const timeValue = escapeXml(time.replace(/^T−/, ""));
  const remainingFraction = Math.max(0, Math.min(1, state.durationSeconds > 0 ? state.remainingSeconds / state.durationSeconds : 1 - state.position));
  const showTimeName = options.showClipName ?? true;
  const ringY = showTimeName ? 80 : 72;
  const ringRadius = showTimeName ? 43 : 51;
  const circumference = 2 * Math.PI * ringRadius;
  const ringLength = remainingFraction * circumference;
  const timeName = showTimeName ? `<text x="72" y="25" text-anchor="middle" fill="#e4e4e7" font-size="14" font-weight="700">${nameLine1}</text>` : "";
  const ring = `<circle cx="72" cy="${ringY}" r="${ringRadius}" fill="none" stroke="#27272a" stroke-width="9"/><circle cx="72" cy="${ringY}" r="${ringRadius}" fill="none" stroke="${color}" stroke-width="9" stroke-linecap="round" stroke-dasharray="${ringLength.toFixed(2)} ${(circumference - ringLength).toFixed(2)}" transform="rotate(-90 72 ${ringY})"/>`;
  const sign = settings.showSign ? `<text x="72" y="${ringY - 8}" text-anchor="middle" fill="#a1a1aa" font-size="10" font-weight="700">T−</text>` : "";
  const nameStartY = nameLines.length === 1 ? 59 : nameLines.length === 2 ? 44 : 33;
  const nameText = nameLines.map((line, index) => `<text x="17" y="${nameStartY + index * 27}" text-anchor="start" fill="#fff" font-size="21" font-weight="750">${line}</text>`).join("");
  const content = status
    ? `<text x="72" y="70" text-anchor="middle" fill="#fff" font-size="16" font-weight="700">${status}</text>`
    : view === "name"
      ? `${nameText}<line x1="17" y1="101" x2="127" y2="101" stroke="#27272a" stroke-width="2"/><text x="17" y="123" text-anchor="start" fill="#a1a1aa" font-size="14">${escapeXml(time)}</text>`
      : view === "progress"
        ? `<text x="72" y="31" text-anchor="middle" fill="#d1d5db" font-size="14" font-weight="700">${nameLine1}</text><text x="72" y="63" text-anchor="middle" fill="#fff" font-size="25" font-weight="800">${percent}%</text><rect x="14" y="76" width="116" height="12" rx="6" fill="#27272a"/><rect x="14" y="76" width="${progress}" height="12" rx="6" fill="${color}"/><text x="72" y="113" text-anchor="middle" fill="#d1d5db" font-size="14">${escapeXml(time)}</text>`
        : `${timeName}${ring}${sign}<text x="72" y="${ringY + 13}" text-anchor="middle" fill="#fff" font-size="${showTimeName ? 22 : 25}" font-weight="800">${timeValue}</text>`;
  const frameColor = view === "time" && !status ? "#27272a" : color;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="144" height="144" viewBox="0 0 144 144"><rect width="144" height="144" rx="18" fill="#09090b"/><rect x="5" y="5" width="134" height="134" rx="15" fill="none" stroke="${frameColor}" stroke-width="${view === "time" ? 3 : 7}"/>${content}</svg>`;
}
