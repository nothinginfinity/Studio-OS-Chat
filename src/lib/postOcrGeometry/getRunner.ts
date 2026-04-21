import { DefaultPostOcrRunner } from "./runner";
import type { PostOcrRunner } from "./types";

export function getPostOcrRunner(): PostOcrRunner {
  return new DefaultPostOcrRunner();
}
