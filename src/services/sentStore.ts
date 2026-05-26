import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type SentRecord = {
  cardId: string;
  sentAt: string;
  groups: string[];
};

export class SentStore {
  private readonly filePath = path.resolve(process.cwd(), "data", "sent-cards.json");
  private records = new Map<string, SentRecord>();
  private loaded = false;

  async has(cardId: string): Promise<boolean> {
    await this.load();
    return this.records.has(cardId);
  }

  async list(): Promise<SentRecord[]> {
    await this.load();
    return [...this.records.values()].sort((a, b) => b.sentAt.localeCompare(a.sentAt));
  }

  async markSent(cardId: string, groups: string[]): Promise<void> {
    await this.load();
    this.records.set(cardId, { cardId, groups, sentAt: new Date().toISOString() });
    await this.flush();
  }

  private async load(): Promise<void> {
    if (this.loaded) {
      return;
    }

    try {
      const raw = await readFile(this.filePath, "utf8");
      const parsed = JSON.parse(raw) as SentRecord[];
      this.records = new Map(parsed.map((record) => [record.cardId, record]));
    } catch {
      this.records = new Map();
    }

    this.loaded = true;
  }

  private async flush(): Promise<void> {
    await mkdir(path.dirname(this.filePath), { recursive: true });
    await writeFile(this.filePath, JSON.stringify([...this.records.values()], null, 2));
  }
}
