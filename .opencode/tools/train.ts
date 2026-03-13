import { tool } from "@opencode-ai/plugin"
import path from "path"

export default tool({
  description: "Run training experiments with the Jetson Thor autoresearch setup. This tool executes the training script for a fixed 5-minute time budget and captures the results. Use this tool instead of running docker commands directly. Output is automatically saved to logs/run.log for analysis.",
  args: {
    experiment_name: tool.schema.string().describe("Name of the experiment for logging purposes"),
    description: tool.schema.string().describe("Description of what changes or parameters are being tested in this experiment"),
  },
  async execute(args, context) {
    const worktree = context.worktree
    // Logs are saved in ./logs/ directory via Docker volume mapping
    // The container writes to /workspace/logs/run.log which maps to ./logs/run.log
    const logFile = path.join(worktree, "logs", "run.log")
    
    try {
      // Run the training command using the scripts/train.sh launcher
      // The script redirects output to /workspace/logs/run.log inside the container
      // which is mapped to ./logs/run.log in the project directory
      await Bun.$`./scripts/train.sh`.quiet()
      
      // Wait a moment for the log file to be written
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      // Read the log file content
      const logContent = await Bun.file(logFile).text()
      
      // Extract key metrics from output
      const valBpbMatch = logContent.match(/val_bpb:\s+([0-9.]+)/)
      const memoryMatch = logContent.match(/peak_vram_mb:\s+([0-9.]+)/)
      const trainingTimeMatch = logContent.match(/training_seconds:\s+([0-9.]+)/)
      
      const valBpb = valBpbMatch ? parseFloat(valBpbMatch[1]) : null
      const memoryMb = memoryMatch ? parseFloat(memoryMatch[1]) : null
      const trainingTime = trainingTimeMatch ? parseFloat(trainingTimeMatch[1]) : null
      
      return {
        success: true,
        experiment: args.experiment_name,
        description: args.description,
        results: {
          val_bpb: valBpb,
          peak_memory_mb: memoryMb,
          training_seconds: trainingTime,
          raw_output: logContent,
        },
      }
    } catch (error: any) {
      // Try to read the log file even on error (for crash analysis)
      let logContent = ""
      try {
        logContent = await Bun.file(logFile).text()
      } catch {
        logContent = "Log file not found - training may have failed before logging started"
      }
      
      return {
        success: false,
        error: error.message,
        raw_output: logContent,
      }
    }
  },
})
