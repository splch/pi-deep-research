import { writeFileSync } from "node:fs";
import { defineTool, type AgentToolResult } from "@earendil-works/pi-coding-agent";
import type { Deferred } from "../deferred.js";
import type { SourceStore } from "../sources.js";
import {
  SubmitFindingsParams,
  SubmitPlanParams,
  SubmitReflectionParams,
  SubmitVerdictParams,
  type SubmitFindingsPayload,
  type SubmitPlanPayload,
  type SubmitReflectionPayload,
  type SubmitVerdictPayload,
} from "../types.js";

/**
 * Terminating "structured output" tools. Pi has no output-schema flag, so the
 * idiom is: give the worker a tool whose TypeBox params ARE the schema, return
 * `terminate: true`, and resolve a deferred with the validated params. Because
 * worker SDK sessions run in-process, this closure runs in our process - no
 * JSONL parsing, and the payload is already schema-validated by the tool layer.
 */
export function createSubmitFindingsTool(sink: Deferred<SubmitFindingsPayload>) {
  return defineTool({
    name: "submit_findings",
    label: "Submit findings",
    description:
      "Call ONCE when done researching your angle. Report every claim with at least one citation to a URL you actually fetched. This ends your task.",
    parameters: SubmitFindingsParams,
    async execute(_toolCallId, params): Promise<AgentToolResult<SubmitFindingsPayload>> {
      if (!sink.settled) sink.resolve(params);
      return {
        content: [{ type: "text", text: `Recorded ${params.findings.length} finding(s).` }],
        details: params,
        terminate: true,
      };
    },
  });
}

/**
 * File-writing variant of submit_findings for the subprocess backend: the worker
 * runs in a child process where an in-process deferred is unreachable, so it
 * persists its sources and writes the validated payload to a file the parent reads.
 */
export function createFileSubmitFindingsTool(store: SourceStore, resultPath: string, sourcesPath: string) {
  return defineTool({
    name: "submit_findings",
    label: "Submit findings",
    description:
      "Call ONCE when done researching your angle. Report every claim with at least one citation to a URL you actually fetched. This ends your task.",
    parameters: SubmitFindingsParams,
    async execute(_toolCallId, params): Promise<AgentToolResult<SubmitFindingsPayload>> {
      store.persist(sourcesPath);
      writeFileSync(resultPath, JSON.stringify(params), "utf8");
      return {
        content: [{ type: "text", text: `Recorded ${params.findings.length} finding(s).` }],
        details: params,
        terminate: true,
      };
    },
  });
}

export function createSubmitPlanTool(sink: Deferred<SubmitPlanPayload>) {
  return defineTool({
    name: "submit_plan",
    label: "Submit research plan",
    description:
      "Call ONCE with the refined question and the research angles to investigate. This ends the planning step.",
    parameters: SubmitPlanParams,
    async execute(_toolCallId, params): Promise<AgentToolResult<SubmitPlanPayload>> {
      if (!sink.settled) sink.resolve(params);
      return {
        content: [{ type: "text", text: `Recorded plan with ${params.angles.length} angle(s).` }],
        details: params,
        terminate: true,
      };
    },
  });
}

export function createSubmitReflectionTool(sink: Deferred<SubmitReflectionPayload>) {
  return defineTool({
    name: "submit_reflection",
    label: "Submit reflection",
    description:
      "Call ONCE with your coverage assessment: gaps, unresolved conflicts, and the follow-up angles (if any) needed to close them. This ends the reflection step.",
    parameters: SubmitReflectionParams,
    async execute(_toolCallId, params): Promise<AgentToolResult<SubmitReflectionPayload>> {
      if (!sink.settled) sink.resolve(params);
      return {
        content: [
          {
            type: "text",
            text: `Recorded reflection: ${params.gaps.length} gap(s), ${params.conflicts.length} conflict(s), ${params.followUpAngles.length} follow-up angle(s).`,
          },
        ],
        details: params,
        terminate: true,
      };
    },
  });
}

export function createSubmitVerdictTool(sink: Deferred<SubmitVerdictPayload>) {
  return defineTool({
    name: "submit_verdict",
    label: "Submit verdict",
    description:
      "Call ONCE with your verdict on whether the provided source excerpts support the claim. This ends the check.",
    parameters: SubmitVerdictParams,
    async execute(_toolCallId, params): Promise<AgentToolResult<SubmitVerdictPayload>> {
      if (!sink.settled) sink.resolve(params);
      return {
        content: [{ type: "text", text: `Recorded verdict: ${params.verdict}.` }],
        details: params,
        terminate: true,
      };
    },
  });
}
