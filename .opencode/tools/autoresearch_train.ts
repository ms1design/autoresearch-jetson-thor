import { tool } from "@opencode-ai/plugin"
import { exec } from "child_process"
import { promisify } from "util"
import { readFileSync, existsSync, writeFileSync, mkdirSync } from "fs"
import * as path from "path"

// Read documentation: https://opencode.ai/docs/custom-tools.md

const execAsync = promisify(exec)

export default tool({
  description: "Run training experiments with the Jetson Thor autoresearch setup. This tool executes the training script for a fixed 5-minute time budget and captures the results. Output is automatically saved to logs/training.log for analysis.",
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
    
    return new Promise((resolve) => {
      // Run train.py and redirect output to logs/training.log
      const proc = exec("uv run train.py >> logs/training.log 2>&1", {
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
        
        if (code === 0) {
          output = `Experiment "${args.experiment_name}" completed:\n` +
                   `  val_bpb: ${valBpb !== null ? valBpb : 'N/A'}\n` +
                   `  peak_memory_mb: ${peakMemoryMb !== null ? peakMemoryMb : 'N/A'}\n` +
                   `  training_seconds: ${trainingSeconds !== null ? trainingSeconds : 'N/A'}\n` +
                   `  Log saved to: logs/training.log`
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
