import type { ExtensionAPI, ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
import { Key } from "@earendil-works/pi-tui";
import { abortActiveRun, handleResearchCommand, hasActiveRun, researchArgumentCompletions } from "./command.js";

export default function (pi: ExtensionAPI) {
  pi.registerCommand("research", {
    description: "Deep research: clarify -> plan -> parallel web research -> verify -> cited report",
    getArgumentCompletions: (prefix: string) => researchArgumentCompletions(prefix),
    handler: async (args: string, ctx: ExtensionCommandContext) => {
      await handleResearchCommand(pi, args, ctx);
    },
  });

  pi.registerShortcut(Key.ctrlAlt("r"), {
    description: "Cancel the active deep-research run",
    handler: (ctx) => {
      if (abortActiveRun()) ctx.ui.notify("Cancelling research run...", "warning");
      else if (!hasActiveRun()) ctx.ui.notify("No active research run.", "info");
    },
  });
}
