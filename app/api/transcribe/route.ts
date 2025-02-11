/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import {
  createReadStream,
  writeFileSync,
  unlinkSync,
  existsSync,
  mkdirSync,
} from "fs";
import path from "path";
import fetch from "node-fetch";

const endpoint = process.env.ATC_AZURE_ENDPOINT || "";
const apiKey = process.env.ATC_AZURE_OPENAI_KEY || "";

if (!endpoint || !apiKey) {
  throw new Error(
    "Azure OpenAI configuration is missing in environment variables."
  );
}

async function saveBlobToFile(blob: Blob, filename: string): Promise<string> {
  const buffer = Buffer.from(await blob.arrayBuffer());
  const tempDir = path.join(process.cwd(), "temp");

  if (!existsSync(tempDir)) {
    mkdirSync(tempDir, { recursive: true });
  }

  const filePath = path.join(tempDir, filename);
  writeFileSync(filePath, buffer);
  return filePath;
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const audioBlob = formData.get("audio") as Blob;

    if (!audioBlob) {
      return NextResponse.json(
        { error: "No audio file found" },
        { status: 400 }
      );
    }

    const audioFilePath = await saveBlobToFile(audioBlob, "recording.wav");

    // Azure Whisper API URL
    const url = `${endpoint}/openai/audio/transcriptions?api-version=2024-08-01-preview`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "api-key": apiKey,
      },
      body: JSON.stringify({
        file: createReadStream(audioFilePath),
        model: "whisper-1",
      }),
    });

    unlinkSync(audioFilePath);

    if (!response.ok) {
      const errorDetails = await response.text();
      return NextResponse.json(
        { error: `Azure API Error: ${errorDetails}` },
        { status: response.status }
      );
    }

    const result: any = await response.json();

    return NextResponse.json({ text: result.text });
  } catch (error) {
    console.error("Error during transcription:", error);
    return NextResponse.json(
      { error: "Transcription failed" },
      { status: 500 }
    );
  }
}
