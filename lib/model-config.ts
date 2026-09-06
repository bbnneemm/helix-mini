import { promises as fs } from "fs";
import path from "path";

export type ModelConfig = { baseUrl: string; apiKey: string; model: string };
const file = path.join(process.cwd(), ".data", "model-config.json");
const defaults: ModelConfig = { baseUrl: "https://api.openai.com/v1", apiKey: "", model: "gpt-4o-mini" };
async function read() { try { return { ...defaults, ...JSON.parse(await fs.readFile(file, "utf8")) } as ModelConfig; } catch { return { ...defaults }; } }
export async function getModelConfig() { return read(); }
export async function saveModelConfig(config: ModelConfig) { await fs.mkdir(path.dirname(file), { recursive: true }); const tmp = `${file}.${process.pid}.tmp`; await fs.writeFile(tmp, JSON.stringify(config, null, 2)); await fs.rename(tmp, file); return config; }
export async function clearModelConfig() { try { await fs.rm(file); } catch {} }
