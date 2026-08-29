import { formatRemaining } from "../core/time";
import type { PlaybackState, ResolvedSettings } from "../core/types";

export type CountdownStyle = "circle" | "bar" | "square";
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

export function renderMonitorSvg(style: CountdownStyle, state: PlaybackState, settings: ResolvedSettings, options: MonitorDisplayOptions = {}): string {
  const color = stateColor(state, settings);
  const status = statusLabel(state);
  const time = formatRemaining(state.remainingSeconds, settings);
  const [nameLine1] = clipNameLines(state.clipName || "Resolume");
  const timeValue = escapeXml(time.replace(/^T−/, ""));
  const remainingFraction = Math.max(0, Math.min(1, state.durationSeconds > 0 ? state.remainingSeconds / state.durationSeconds : 1 - state.position));
  const showClipName = options.showClipName ?? true;
  const name = showClipName ? `<text x="72" y="25" text-anchor="middle" fill="#e4e4e7" font-size="14" font-weight="700">${nameLine1}</text>` : "";
  const signAt = (y: number) => settings.showSign ? `<text x="72" y="${y}" text-anchor="middle" fill="#a1a1aa" font-size="10" font-weight="700">T−</text>` : "";
  const ringY = showClipName ? 80 : 72;
  const ringRadius = showClipName ? 43 : 51;
  const circumference = 2 * Math.PI * ringRadius;
  const ringLength = remainingFraction * circumference;
  const ring = `<circle cx="72" cy="${ringY}" r="${ringRadius}" fill="none" stroke="#27272a" stroke-width="9"/><circle cx="72" cy="${ringY}" r="${ringRadius}" fill="none" stroke="${color}" stroke-width="9" stroke-linecap="round" stroke-dasharray="${ringLength.toFixed(2)} ${(circumference - ringLength).toFixed(2)}" transform="rotate(-90 72 ${ringY})"/>`;
  const barWidth = (remainingFraction * 116).toFixed(1);
  const barY = showClipName ? 91 : 88;
  const bar = `<rect x="14" y="${barY}" width="116" height="14" rx="7" fill="#27272a"/><rect x="14" y="${barY}" width="${barWidth}" height="14" rx="7" fill="${color}"/>`;
  const squareY = showClipName ? 35 : 13;
  const squareHeight = showClipName ? 94 : 118;
  const square = `<rect x="14" y="${squareY}" width="116" height="${squareHeight}" rx="14" fill="none" stroke="#27272a" stroke-width="9"/><rect x="14" y="${squareY}" width="116" height="${squareHeight}" rx="14" fill="none" stroke="${color}" stroke-width="9" stroke-linecap="round" pathLength="100" stroke-dasharray="${(remainingFraction * 100).toFixed(1)} 100"/>`;
  const content = status
    ? `<text x="72" y="70" text-anchor="middle" fill="#fff" font-size="16" font-weight="700">${status}</text>`
    : style === "bar"
      ? `${name}${signAt(showClipName ? 49 : 43)}<text x="72" y="${showClipName ? 77 : 72}" text-anchor="middle" fill="#fff" font-size="27" font-weight="800">${timeValue}</text>${bar}`
      : style === "square"
        ? `${name}${square}${signAt(showClipName ? 65 : 58)}<text x="72" y="${showClipName ? 92 : 86}" text-anchor="middle" fill="#fff" font-size="25" font-weight="800">${timeValue}</text>`
        : `${name}${ring}${signAt(ringY - 8)}<text x="72" y="${ringY + 13}" text-anchor="middle" fill="#fff" font-size="${showClipName ? 22 : 25}" font-weight="800">${timeValue}</text>`;
  const frame = status || style === "bar" ? `<rect x="5" y="5" width="134" height="134" rx="15" fill="none" stroke="${status ? color : "#27272a"}" stroke-width="3"/>` : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="144" height="144" viewBox="0 0 144 144"><rect width="144" height="144" rx="18" fill="#09090b"/>${frame}${content}</svg>`;
}
