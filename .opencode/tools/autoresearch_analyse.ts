import { tool } from "@opencode-ai/plugin"
import { readFileSync, existsSync } from "fs"
import * as path from "path"

// Read documentation: https://opencode.ai/docs/custom-tools.md

export default tool({
  description: "Analyze training results from results.tsv file. This tool reads the existing results.tsv and returns the latest experiment metrics to the LLM for review. It does not modify any files.",
  args: {
    results_file: tool.schema.string().describe("Path to results.tsv file for analysis (default: results.tsv)").optional(),
  },
  async execute(args, context) {
    const worktree = context.worktree
    
    // Default results.tsv path
    const resultsFile = (args.results_file || "results.tsv").replace(/^\.\/?/, "")
    const fullResultsPath = resultsFile.startsWith("/") ? resultsFile : path.join(worktree, resultsFile)
    
    try {
      // Check if results.tsv exists
      if (!existsSync(fullResultsPath)) {
        return "No results.tsv file found. Run autoresearch_train first to generate results."
      }
      
      // Read results.tsv
      const resultsContent = readFileSync(fullResultsPath, "utf8")
      const lines = resultsContent.trim().split("\n")
      
      // Skip header, get data rows
      const dataLines = lines.slice(1).filter(line => line.trim() !== "")
      
      if (dataLines.length === 0) {
        return "No experiments found in results.tsv."
      }
      
      // Parse the latest (last) experiment
      const latestLine = dataLines[dataLines.length - 1]
      const parts = latestLine.split("\t")
      
      if (parts.length < 5) {
        return "Invalid results.tsv format. Expected columns: commit, val_bpb, memory_gb, status, description"
      }
      
      const latestResult = {
        commit: parts[0],
        val_bpb: parseFloat(parts[1]),
        memory_gb: parseFloat(parts[2]),
        status: parts[3],
        description: parts.slice(4).join("\t"),
      }
      
      // Build summary string
      const summaryText = `Latest Experiment Results:\n` +
        `  commit: ${latestResult.commit}\n` +
        `  val_bpb: ${latestResult.val_bpb}\n` +
        `  memory_gb: ${latestResult.memory_gb}\n` +
        `  status: ${latestResult.status}\n` +
        `  description: ${latestResult.description}\n` +
        `Total experiments in results.tsv: ${dataLines.length}`
      
      return summaryText
    } catch (error: any) {
      return `Error: ${error.message}`
    }
  },
})
