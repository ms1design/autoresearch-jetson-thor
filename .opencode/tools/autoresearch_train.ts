import { tool } from "@opencode-ai/plugin"
import { exec } from "child_process"
import { promisify } from "util"
import { readFileSync, existsSync, writeFileSync, mkdirSync, appendFileSync } from "fs"
import * as childProcess from "child_process"
import * as path from "path"

// Read documentation: https://opencode.ai/docs/custom-tools.md

const execAsync = promisify(exec)

export default tool({
  description: "Run training experiments with the Jetson Thor autoresearch setup. This tool executes the training script for a fixed 5-minute time budget, saves results to logs/training.log, adds a row to results.tsv, and generates progress.png.",
  args: {
    experiment_name: tool.schema.string().describe("Name of the experiment for logging purposes"),
    description: tool.schema.string().describe("Description of what changes or parameters are being tested in this experiment"),
  },
  async execute(args, context) {
    const worktree = context.worktree
    const logsDir = path.join(worktree, "logs")
    
    // Ensure logs directory exists
    if (!existsSync(logsDir)) {
      mkdirSync(logsDir, { recursive: true })
    }
    
    const logPath = path.join(logsDir, "training.log")
    const resultsPath = path.join(worktree, "results.tsv")
    const progressPngPath = path.join(worktree, "progress.png")
    
    return new Promise((resolve) => {
      // Run train.sh and redirect output to logs/training.log
      const proc = exec("./train.sh > logs/training.log 2>&1", {
        cwd: worktree,
        maxBuffer: 1024 * 1024 * 1024, // 1GB buffer
        env: { ...process.env }
      })
      
      let stdout = ""
      let stderr = ""
      
      proc.stdout?.on("data", (data) => {
        stdout += data.toString()
      })
      
      proc.stderr?.on("data", (data) => {
        stderr += data.toString()
      })
      
      proc.on("close", (code) => {
        // Parse the log file for metrics
        let valBpb = null
        let peakMemoryMb = null
        let trainingSeconds = null
        let output = ""
        
        if (existsSync(logPath)) {
          const logContent = readFileSync(logPath, "utf8")
          const valBpbMatch = logContent.match(/val_bpb:\s+([0-9.]+)/)
          const memoryMatch = logContent.match(/peak_vram_mb:\s+([0-9.]+)/)
          const trainingMatch = logContent.match(/training_seconds:\s+([0-9.]+)/)
          
          if (valBpbMatch) valBpb = parseFloat(valBpbMatch[1])
          if (memoryMatch) peakMemoryMb = parseFloat(memoryMatch[1])
          if (trainingMatch) trainingSeconds = parseFloat(trainingMatch[1])
        }
        
        if (code === 0 && valBpb !== null) {
          // Calculate memory in GB (train.py now reports absolute value)
          const peakMemoryGb = peakMemoryMb !== null ? (peakMemoryMb / 1024).toFixed(1) : "0.0"
          
          // Determine status - training is successful if exit code is 0 and val_bpb is present
          // (even if memory measurement is negative, the training itself succeeded)
          const status = valBpb !== null && trainingSeconds !== null ? "keep" : "crash"
          
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
          const newRecord = `${gitHash}\t${valBpbFormatted}\t${peakMemoryGb}\t${status}\t${args.description || "training experiment"}`
          appendFileSync(resultsPath, newRecord + "\n")
          
          // Generate progress.png if the script exists
          const generateProgressScriptPath = path.join(worktree, "generate_progress.py")
          if (existsSync(generateProgressScriptPath)) {
            try {
              childProcess.execSync(`cd "${worktree}" && uv run python "${generateProgressScriptPath}" "${resultsPath}" "${progressPngPath}"`, { encoding: "utf8" })
            } catch (e) {
              console.warn("Could not generate progress.png:", (e as any).stdout || (e as any).message)
            }
          }
          
          output = `Experiment "${args.experiment_name}" completed:\n` +
                   `  val_bpb: ${valBpb}\n` +
                   `  peak_memory_mb: ${peakMemoryMb !== null ? peakMemoryMb : 'N/A'}\n` +
                   `  peak_memory_gb: ${peakMemoryGb}\n` +
                   `  training_seconds: ${trainingSeconds !== null ? trainingSeconds : 'N/A'}\n` +
                   `  status: ${status}\n` +
                   `  Log saved to: logs/training.log\n` +
                   `  Results appended to: results.tsv\n` +
                   `  progress.png generated at: ${progressPngPath}`
        } else {
          output = `Experiment "${args.experiment_name}" failed with exit code ${code}\n` +
                   `  Check logs/training.log for details`
        }
        
        resolve(output)
      })
      
      proc.on("error", (error) => {
        resolve(`Failed to start training: ${error.message}`)
      })
    })
  },
})
