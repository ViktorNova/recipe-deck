import fs from "node:fs";
import path from "node:path";
import { ensureDir } from "./paths.js";

export class RollingLogWriter {
  private fd: number | null = null;
  private bytesInPart = 0;

  constructor(
    private readonly logDir: string,
    private readonly baseName: string,
    private readonly maxFileBytes: number,
    private readonly maxFiles: number,
  ) {}

  private mainPath(): string {
    return path.join(this.logDir, `${this.baseName}.log`);
  }

  private partPath(i: number): string {
    return path.join(this.logDir, `${this.baseName}.${i}.log`);
  }

  private shiftFiles(): void {
    const tail = this.maxFiles - 1;
    const oldest = this.partPath(tail);
    try {
      fs.unlinkSync(oldest);
    } catch {
      /* missing */
    }
    for (let i = tail; i >= 1; i--) {
      const from = i === 1 ? this.mainPath() : this.partPath(i - 1);
      const to = this.partPath(i);
      try {
        fs.renameSync(from, to);
      } catch {
        /* missing */
      }
    }
  }

  append(chunk: string): void {
    ensureDir(this.logDir);
    const buf = Buffer.from(chunk, "utf8");
    if (this.fd === null) {
      const p = this.mainPath();
      this.fd = fs.openSync(p, "a", 0o640);
      this.bytesInPart = fs.existsSync(p) ? fs.statSync(p).size : 0;
    }
    if (this.bytesInPart + buf.length > this.maxFileBytes) {
      try {
        fs.closeSync(this.fd!);
      } catch {
        /* ignore */
      }
      this.fd = null;
      this.shiftFiles();
      this.bytesInPart = 0;
      const p = this.mainPath();
      this.fd = fs.openSync(p, "a", 0o640);
    }
    if (this.fd === null) return;
    fs.writeSync(this.fd, buf);
    this.bytesInPart += buf.length;
  }

  close(): void {
    if (this.fd !== null) {
      try {
        fs.closeSync(this.fd);
      } catch {
        /* ignore */
      }
      this.fd = null;
    }
  }
}
