import { type NextRequest, NextResponse } from "next/server";
import { cleanTextForSpeech } from "@/lib/speech-utils";

export const dynamic = "force-dynamic";

function cleanForSpeech(raw: string): string {
  return cleanTextForSpeech(raw, 500);
}

function splitIntoChunks(text: string, maxLen = 170): string[] {
  if (text.length <= maxLen) return [text.trim()];
  const chunks: string[] = [];
  const parts = text.split(/(?<=[.!?\n\r,])\s+|\s+/).filter(Boolean);
  let current = "";

  for (const part of parts) {
    if ((current ? current + " " + part : part).length <= maxLen) {
      current = current ? current + " " + part : part;
    } else {
      if (current) {
        chunks.push(current);
        current = "";
      }
      if (part.length <= maxLen) {
        current = part;
      } else {
        for (let i = 0; i < part.length; i += maxLen) {
          chunks.push(part.slice(i, i + maxLen));
        }
      }
    }
  }
  if (current) chunks.push(current);
  return chunks.filter((c) => c.trim().length > 0);
}

async function fetchGoogleTTSAudio(text: string): Promise<Buffer> {
  const url = `https://translate.google.com/translate_tts?ie=UTF-8&tl=th&client=tw-ob&q=${encodeURIComponent(
    text
  )}`;
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    },
    signal: AbortSignal.timeout(8000),
  });

  if (!res.ok) {
    throw new Error(`TTS upstream returned status ${res.status}`);
  }

  const arrayBuf = await res.arrayBuffer();
  return Buffer.from(arrayBuf);
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const rawText = searchParams.get("text") || "";

  const text = cleanForSpeech(rawText).slice(0, 500);
  if (!text) {
    return NextResponse.json(
      { error: "Text parameter is required" },
      { status: 400 }
    );
  }

  try {
    const chunks = splitIntoChunks(text, 175);
    // Limit to at most 4 chunks (~700 chars max speech per request)
    const activeChunks = chunks.slice(0, 4);

    const buffers: Buffer[] = [];
    for (const chunk of activeChunks) {
      const buf = await fetchGoogleTTSAudio(chunk);
      buffers.push(buf);
    }

    const combined = Buffer.concat(buffers);

    return new Response(combined, {
      status: 200,
      headers: {
        "Content-Type": "audio/mpeg",
        "Content-Length": combined.length.toString(),
        "Cache-Control": "public, max-age=86400, s-maxage=86400",
      },
    });
  } catch (error: any) {
    console.error("[TTS API Error]:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to generate speech audio" },
      { status: 502 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const rawText = typeof body?.text === "string" ? body.text : "";
    const text = cleanForSpeech(rawText).slice(0, 500);

    if (!text) {
      return NextResponse.json(
        { error: "Text parameter is required" },
        { status: 400 }
      );
    }

    const chunks = splitIntoChunks(text, 175).slice(0, 4);
    const buffers: Buffer[] = [];
    for (const chunk of chunks) {
      const buf = await fetchGoogleTTSAudio(chunk);
      buffers.push(buf);
    }

    const combined = Buffer.concat(buffers);
    return new Response(combined, {
      status: 200,
      headers: {
        "Content-Type": "audio/mpeg",
        "Content-Length": combined.length.toString(),
        "Cache-Control": "public, max-age=86400, s-maxage=86400",
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to generate speech audio" },
      { status: 500 }
    );
  }
}

