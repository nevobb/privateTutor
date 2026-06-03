import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import { getMockTutorResponse } from "../../src/lib/tutor";
import { JUDGE_SYSTEM_PROMPT, buildJudgePrompt } from "./judgeRubrics";

// Load .env.local manually if it exists to ensure API keys are available in vitest
try {
  const envLocalPath = path.resolve(__dirname, "../../.env.local");
  if (fs.existsSync(envLocalPath)) {
    const envLocal = fs.readFileSync(envLocalPath, "utf-8");
    for (const line of envLocal.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const index = trimmed.indexOf("=");
      if (index !== -1) {
        const key = trimmed.substring(0, index).trim();
        const value = trimmed.substring(index + 1).trim();
        if (key && value && !process.env[key]) {
          process.env[key] = value;
        }
      }
    }
  }
} catch (e) {
  // Fail silently if .env.local cannot be read
}

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
const JUDGE_MODEL = "gemini-2.5-pro";

interface DatasetItem {
  id: string;
  description: string;
  student_query: string;
  retrieved_context: string;
  expected_intent: string;
}

interface EvaluationResult {
  scores: {
    pedagogy: number;
    groundedness: number;
    hebrewQuality: number;
  };
  justification: {
    pedagogy: string;
    groundedness: string;
    hebrewQuality: string;
  };
  passed: boolean;
}

async function runJudge(query: string, context: string, tutorResponse: string): Promise<EvaluationResult> {
  if (!GEMINI_API_KEY || GEMINI_API_KEY.trim().length === 0) {
    // If no key is set, return a stubbed evaluation
    return {
      scores: { pedagogy: 3, groundedness: 4, hebrewQuality: 4 },
      justification: {
        pedagogy: "Skipped API call: GEMINI_API_KEY is not set.",
        groundedness: "Skipped API call: GEMINI_API_KEY is not set.",
        hebrewQuality: "Skipped API call: GEMINI_API_KEY is not set."
      },
      passed: true
    };
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${JUDGE_MODEL}:generateContent?key=${encodeURIComponent(GEMINI_API_KEY)}`;
  
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      systemInstruction: {
        parts: [{ text: JUDGE_SYSTEM_PROMPT }]
      },
      contents: [
        {
          parts: [{ text: buildJudgePrompt(query, context, tutorResponse) }]
        }
      ],
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0,
      }
    })
  });

  if (!response.ok) {
    throw new Error(`Gemini Judge API request failed with status ${response.status}: ${response.statusText}`);
  }

  const data = await response.json();
  const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!rawText) {
    throw new Error("Gemini Judge returned an empty response candidate.");
  }

  return JSON.parse(rawText.trim()) as EvaluationResult;
}

describe("Automated Tutor Behavior Evaluation (LLM-as-a-Judge)", () => {
  const datasetPath = path.join(__dirname, "dataset.json");
  const dataset: DatasetItem[] = JSON.parse(fs.readFileSync(datasetPath, "utf-8"));
  const reportResults: any[] = [];

  it("evaluates all dataset prompts and generates eval_report.json", async () => {
    console.log(`Evaluating ${dataset.length} test cases...`);

    try {
      for (const testCase of dataset) {
        // 1. Generate response using the local tutor pipeline
        const tutorResult = await getMockTutorResponse(
          testCase.student_query,
          "Learning",
          "Normal Learning"
        );
        const responseText = tutorResult.message.content;

        // 2. Evaluate response using the Gemini Pro judge
        const evaluation = await runJudge(
          testCase.student_query,
          testCase.retrieved_context,
          responseText
        );

        // Save case report
        reportResults.push({
          id: testCase.id,
          description: testCase.description,
          student_query: testCase.student_query,
          tutor_response: responseText,
          evaluation
        });
      }
    } finally {
      // Write final evaluation report to disk
      const reportPath = path.join(__dirname, "eval_report.json");
      fs.writeFileSync(reportPath, JSON.stringify(reportResults, null, 2));
      console.log(`Evaluation report successfully saved to ${reportPath}`);
    }

    // Run assertions after saving the report so we get results for all cases
    if (GEMINI_API_KEY) {
      const failures = reportResults.filter(r => !r.evaluation.passed);
      if (failures.length > 0) {
        console.error("Evaluation failed for some test cases:", failures.map(f => f.id));
      }
      expect(failures.length).toBe(0);
    }
  }, 60000);
});
