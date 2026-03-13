import { tool } from "@opencode-ai/plugin"
import { exec } from "child_process"

export default tool({
  description: "Run training experiment with the Jetson Thor autoresearch setup. This tool executes training with the provided experiment name and description. Results must be manually added to results.tsv using autoresearch_triage tool.",
  args: {
    experiment_name: tool.schema.string().describe("Name of the experiment for logging purposes"),
    description: tool.schema.string().describe("Description of what changes or parameters are being tested in this experiment"),
  },
  async execute(args, context) {
    const worktree = context.worktree
    
    return new Promise((resolve) => {
      // Run train.sh with experiment name and description arguments
      const command = `./train.sh --experiment-name "${args.experiment_name}" --description "${args.description.replace(/"/g, '\\"')}"`;
      const proc = exec(command, {
        cwd: worktree,
        maxBuffer: 1024 * 1024 * 1024, // 1GB buffer
        env: { ...process.env }
      })
      
      let stdout = ""
      let stderr = ""
      
      proc.stdout?.on("data", (data) => {
        stdout += data.toString()
        process.stdout.write(data) // Forward output to console
      })
      
      proc.stderr?.on("data", (data) => {
        stderr += data.toString()
        process.stderr.write(data) // Forward error output to console
      })
      
      proc.on("close", (code) => {
        if (code === 0) {
          resolve(`Training completed. Check logs/training.log for results. Use autoresearch_triage to add results to results.tsv.`)
        } else {
          resolve(`Training failed with exit code ${code}. Check logs/training.log for details.`)
        }
      })
      
      proc.on("error", (error) => {
        resolve(`Failed to start training: ${error.message}`)
      })
    })
  },
})
