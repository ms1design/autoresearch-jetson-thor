import { tool } from "@opencode-ai/plugin"
import { readFileSync, existsSync, appendFileSync, mkdirSync, writeFileSync } from "fs"
import * as path from "path"
import * as childProcess from "child_process"

export default tool({
  description: "Triage latest training results. Adds experiment metrics to results.tsv with the specified status (keep, discard, or crash). Reads experiment_name and description from logs/training.log.",
  args: {
    status: tool.schema.string().describe("Status for this experiment: 'keep', 'discard', or 'crash'"),
  },
  async execute(args, context) {
    const worktree = context.worktree
    
    const logsDir = path.join(worktree, "logs")
    const logPath = path.join(logsDir, "training.log")
    const resultsPath = path.join(worktree, "results.tsv")
    
    // Ensure logs directory exists
    if (!existsSync(logsDir)) {
      mkdirSync(logsDir, { recursive: true })
    }
    
    try {
      // Check if log file exists
      if (!existsSync(logPath)) {
        return "No training log found at logs/training.log. Run autoresearch_train first."
      }
      
      // Read log file and extract metrics
      const logContent = readFileSync(logPath, "utf8")
      
      let valBpb = null
      let peakVramMb = null
      let trainingSeconds = null
      let experimentName = "training experiment"
      let description = "training experiment"
      
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
          const value = line.split(":")[1].trim()
          experimentName = value || "training experiment"
        } else if (line.startsWith("description:")) {
          const value = line.split(":")[1].trim()
          description = value || "training experiment"
        }
      }
      
      // Check if all metrics were found
      if (valBpb === null || peakVramMb === null || trainingSeconds === null) {
        return "Could not extract all required metrics from logs/training.log. Expected: val_bpb, peak_vram_mb, training_seconds"
      }
      
      // Calculate memory in GB
      const peakMemoryGb = (peakVramMb / 1024).toFixed(1)
      
      // Determine status
      const status = args.status
      
      // Validate status
      if (!["keep", "discard", "crash"].includes(status)) {
        return "Invalid status. Must be 'keep', 'discard', or 'crash'"
      }
      
      // Get commit hash
      const gitHash = childProcess.execSync("git rev-parse --short HEAD", { cwd: worktree, encoding: "utf8" }).trim()
      
      // Format val_bpb with 6 decimal places
      const valBpbFormatted = valBpb.toFixed(6)
      
      // Create results.tsv with headers if it doesn't exist
      const resultsHeader = "commit\tval_bpb\tmemory_gb\tstatus\tdescription"
      if (!existsSync(resultsPath)) {
        writeFileSync(resultsPath, resultsHeader + "\n")
      }
      
      // Append to results.tsv
      const newRecord = `${gitHash}\t${valBpbFormatted}\t${peakMemoryGb}\t${status}\t${description}`
      appendFileSync(resultsPath, newRecord + "\n")
      
      const output = `Triage recorded:\n` +
               `  commit: ${gitHash}\n` +
               `  val_bpb: ${valBpb}\n` +
               `  peak_memory_gb: ${peakMemoryGb}\n` +
               `  status: ${status}\n` +
               `  description: ${description}\n` +
               `  Log file: ${logPath}\n` +
               `  Results appended to: ${resultsPath}`
      
      return output
    } catch (error: any) {
      return `Error: ${error.message}`
    }
  },
})
