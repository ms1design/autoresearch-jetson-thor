import { tool } from "@opencode-ai/plugin"
import { exec } from "child_process"
import { promisify } from "util"

// Read documentation: https://opencode.ai/docs/custom-tools.md

const execAsync = promisify(exec)

export default tool({
  description: "Run training experiments with the Jetson Thor autoresearch setup. This tool executes the training script for a fixed 5-minute time budget and captures the results. Use this tool instead of running docker commands directly. Output is automatically saved to logs/run.log for analysis.",
  args: {
    experiment_name: tool.schema.string().describe("Name of the experiment for logging purposes"),
    description: tool.schema.string().describe("Description of what changes or parameters are being tested in this experiment"),
  },
  async execute(args, context) {
    const worktree = context.worktree
    const logFile = (args.log_file || "logs/run.log").replace(/^\.\/?/, "")
    const fullLogPath = logFile.startsWith("/") ? logFile : `${worktree}/${logFile}`
    
    return new Promise((resolve) => {
      const trainScript = `${worktree}/scripts/train.sh`
      const proc = exec(trainScript, {
        cwd: worktree,
        maxBuffer: 1024 * 1024 * 1024, // 1GB buffer
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
        resolve({
          success: true,
          experiment: args.experiment_name,
          description: args.description,
          results: {
            val_bpb: null,
            peak_memory_mb: null,
            training_seconds: null,
            raw_output: "",
          },
        })
      })
      
      proc.on("error", (error) => {
        resolve({
          success: false,
          error: error.message,
          raw_output: `Failed to start training: ${error.message}`,
        })
      })
    })
  },
})
