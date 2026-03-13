import { tool } from "@opencode-ai/plugin"
import { readFileSync, existsSync } from "fs"
import * as path from "path"

// Read documentation: https://opencode.ai/docs/custom-tools.md

export default tool({
  description: "Analyze latest training results from logs/training.log. This tool extracts experiment metrics (val_bpb, peak_vram_mb, training_seconds) from the log file and returns them for review.",
  args: {
    log_file: tool.schema.string().describe("Path to training log file (default: logs/training.log)").optional(),
  },
  async execute(args, context) {
    const worktree = context.worktree
    
    // Default log file path
    const logFile = (args.log_file || "logs/training.log").replace(/^\.\/?/, "")
    const fullLog_path = logFile.startsWith("/") ? logFile : path.join(worktree, logFile)
    const resultsPath = path.join(worktree, "results.tsv")
    
    try {
      // Check if log file exists
      if (!existsSync(fullLog_path)) {
        return "No training log found at logs/training.log. Run autoresearch_train first."
      }
      
      // Read log file and extract metrics
      const logContent = readFileSync(fullLog_path, "utf8")
      
      let valBpb = null
      let peakVramMb = null
      let trainingSeconds = null
      let experimentName = ""
      let description = ""
      
      for (const line of logContent.split("\n")) {
        if (line.startsWith("val_bpb:")) {
          const match = line.match(/val_bpb:\s+([0-9.]+)/)
          if (match) valBpb = parseFloat(match[1])
        } else if (line.startsWith("peak_vram_mb:")) {
          const match = line.match(/peak_vram_mb:\s+([0-9.]+)/)
          if (match) peakVramMb = parseFloat(match[1])
        } else if (line.startsWith("training_seconds:")) {
          const match = line.match(/training_seconds:\s+([0-9.]+)/)
          if (match) trainingSeconds = parseFloat(match[1])
        } else if (line.startsWith("experiment_name:")) {
          experimentName = line.split(":")[1].trim()
        } else if (line.startsWith("description:")) {
          description = line.split(":")[1].trim()
        }
      }
      
      // Check if all metrics were found
      if (valBpb === null || peakVramMb === null || trainingSeconds === null) {
        return "Could not extract all required metrics from logs/training.log. Expected: val_bpb, peak_vram_mb, training_seconds"
      }
      
      const memoryGb = (peakVramMb / 1024).toFixed(1)
      
      // Read results.tsv and get last 5 entries for comparison
      let previousResults = ""
      if (existsSync(resultsPath)) {
        const resultsContent = readFileSync(resultsPath, "utf8")
        const lines = resultsContent.split("\n")
        // Get last 5 rows (excluding header) in chronological order (oldest first)
        const dataLines = lines.slice(1).filter(line => line.trim() !== "")
        const last5 = dataLines.slice(-5)
        
        if (last5.length > 0) {
          previousResults = "\n\nPrevious Results (last 5 entries):\n"
          for (const line of last5) {
            previousResults += `  ${line}\n`
          }
        }
      }
      
      // Build summary string (Previous Results first, then Latest Training Results)
      const summaryText = previousResults +
        `Latest Training Results:\n` +
        `  experiment_name: ${experimentName || "N/A"}\n` +
        `  description: ${description || "N/A"}\n` +
        `  val_bpb: ${valBpb}\n` +
        `  peak_vram_mb: ${peakVramMb}\n` +
        `  peak_memory_gb: ${memoryGb}\n` +
        `  training_seconds: ${trainingSeconds}\n` +
        `  Log file: ${fullLog_path}` +
        `\n\nTo triage these results, use: autoresearch_triage with status "keep", "discard", or "crash"\n` +
        `  - Use "keep" if val_bpb is better than previous results (lower is better)\n` +
        `  - Use "discard" if results are worse or unreliable\n` +
        `  - Use "crash" if training failed but you want to record it`
      
      return summaryText
    } catch (error: any) {
      return `Error: ${error.message}`
    }
  },
})
