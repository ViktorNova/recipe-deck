export class LogRingBuffer {
  private lines: string[] = [];
  private bytes = 0;

  constructor(
    private readonly maxLines: number,
    private readonly maxBytes: number,
  ) {}

  push(line: string): void {
    const chunk = line.endsWith("\n") ? line : `${line}\n`;
    this.lines.push(chunk);
    this.bytes += Buffer.byteLength(chunk, "utf8");
    while (this.lines.length > this.maxLines || this.bytes > this.maxBytes) {
      const removed = this.lines.shift();
      if (removed) this.bytes -= Buffer.byteLength(removed, "utf8");
      else break;
    }
  }

  clear(): void {
    this.lines = [];
    this.bytes = 0;
  }

  snapshot(): string {
    return this.lines.join("");
  }

  tailLines(n: number): string[] {
    return this.lines.slice(-n);
  }
}
