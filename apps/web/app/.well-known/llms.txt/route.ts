import { llmsTxtResponse } from "@/lib/llms-txt-response";

export async function GET(): Promise<Response> {
  return llmsTxtResponse();
}
