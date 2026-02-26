import Anthropic from "@anthropic-ai/sdk";

let client: Anthropic | null = null;

export function getAnthropicClient(): Anthropic | null {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  if (!client) {
    client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return client;
}

const SYSTEM_PROMPT = `You are a studio project management analyst for a small creative animation studio (3 people). You provide concise, actionable analysis of project health, risks, and recommendations.

IMPORTANT: Always respond with valid JSON matching the exact schema requested. No markdown, no code fences, no commentary outside the JSON. Only output the JSON object.`;

export async function callClaude<T>(userPrompt: string): Promise<T> {
  const anthropic = getAnthropicClient();
  if (!anthropic) {
    throw new Error("Anthropic API key not configured");
  }

  try {
    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2048,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userPrompt }],
    });

    const textBlock = message.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      throw new Error("No text response from AI");
    }

    // Strip potential markdown code fences
    let raw = textBlock.text.trim();
    if (raw.startsWith("```")) {
      raw = raw.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    }

    return JSON.parse(raw) as T;
  } catch (error: unknown) {
    // Surface specific API errors
    if (error && typeof error === "object" && "status" in error) {
      const apiError = error as { status: number; message?: string };
      if (apiError.status === 400 && String(apiError.message || "").includes("credit balance")) {
        throw new Error("Anthropic API credit balance is too low. Please add credits at console.anthropic.com/settings/billing");
      }
      if (apiError.status === 401) {
        throw new Error("Anthropic API key is invalid. Please check your ANTHROPIC_API_KEY.");
      }
      if (apiError.status === 429) {
        throw new Error("Anthropic API rate limit reached. Please try again in a moment.");
      }
    }
    throw error;
  }
}
