export type OscValue = number | string | boolean;
export type OscMessage = { address: string; args: OscValue[] };

function paddedLength(length: number): number {
  return (length + 3) & ~3;
}

function encodeString(value: string): Buffer {
  const raw = Buffer.from(`${value}\0`, "utf8");
  const result = Buffer.alloc(paddedLength(raw.length));
  raw.copy(result);
  return result;
}

export function encodeOscMessage(address: string, args: OscValue[] = []): Buffer {
  if (!address.startsWith("/")) throw new Error("OSC address must start with /");
  const tags = [","];
  const values: Buffer[] = [];
  for (const arg of args) {
    if (typeof arg === "string") {
      tags.push("s");
      values.push(encodeString(arg));
    } else if (typeof arg === "boolean") {
      tags.push(arg ? "T" : "F");
    } else if (Number.isInteger(arg)) {
      tags.push("i");
      const value = Buffer.alloc(4);
      value.writeInt32BE(arg);
      values.push(value);
    } else {
      tags.push("f");
      const value = Buffer.alloc(4);
      value.writeFloatBE(arg);
      values.push(value);
    }
  }
  return Buffer.concat([encodeString(address), encodeString(tags.join("")), ...values]);
}

function readString(buffer: Buffer, offset: number): [string, number] {
  const end = buffer.indexOf(0, offset);
  if (end < 0) throw new Error("Invalid OSC string");
  return [buffer.toString("utf8", offset, end), offset + paddedLength(end - offset + 1)];
}

/** Reads only the OSC address so high-volume unrelated messages can be dropped cheaply. */
export function peekOscAddress(buffer: Buffer): string | undefined {
  if (buffer.length === 0 || buffer[0] !== 47) return undefined;
  const end = buffer.indexOf(0);
  if (end <= 1) return undefined;
  return buffer.toString("utf8", 0, end);
}

function decodeMessage(buffer: Buffer): OscMessage {
  let offset = 0;
  const [address, afterAddress] = readString(buffer, offset);
  offset = afterAddress;
  const [tags, afterTags] = readString(buffer, offset);
  offset = afterTags;
  if (!tags.startsWith(",")) throw new Error("Invalid OSC type tag");
  const args: OscValue[] = [];
  for (const tag of tags.slice(1)) {
    switch (tag) {
      case "i": args.push(buffer.readInt32BE(offset)); offset += 4; break;
      case "f": args.push(buffer.readFloatBE(offset)); offset += 4; break;
      case "s": { const [value, next] = readString(buffer, offset); args.push(value); offset = next; break; }
      case "T": args.push(true); break;
      case "F": args.push(false); break;
      default: throw new Error(`Unsupported OSC type tag: ${tag}`);
    }
  }
  return { address, args };
}

export function decodeOscPacket(buffer: Buffer, acceptAddress?: (address: string) => boolean): OscMessage[] {
  const [header] = readString(buffer, 0);
  if (header !== "#bundle") return acceptAddress && !acceptAddress(header) ? [] : [decodeMessage(buffer)];
  const messages: OscMessage[] = [];
  let offset = 16;
  while (offset + 4 <= buffer.length) {
    const size = buffer.readInt32BE(offset);
    offset += 4;
    if (size <= 0 || offset + size > buffer.length) throw new Error("Invalid OSC bundle element");
    messages.push(...decodeOscPacket(buffer.subarray(offset, offset + size), acceptAddress));
    offset += size;
  }
  return messages;
}
