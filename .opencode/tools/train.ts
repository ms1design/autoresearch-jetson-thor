import { tool } from "@opencode-ai/plugin"

export default tool({
  description: "Run training experiments with the Jetson Thor autoresearch setup. This tool executes the training script for a fixed 5-minute time budget and captures the results. Use this tool instead of running docker commands directly.",
  args: {
    experiment_name: tool.schema.string().describe("Name of the experiment for logging purposes"),
    description: tool.schema.string().describe("Description of what changes or parameters are being tested in this experiment"),
  },
  async execute(args, context) {
    const worktree = context.worktree
    
    try {
      // Run the training command using the scripts/train.sh launcher
      const result = await Bun.$`./scripts/train.sh`.text()
      
      // Extract key metrics from output
      const valBpbMatch = result.match(/val_bpb:\s+([0-9.]+)/)
      const memoryMatch = result.match(/peak_vram_mb:\s+([0-9.]+)/)
      const trainingTimeMatch = result.match(/training_seconds:\s+([0-9.]+)/)
      
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
          raw_output: result,
        },
      }
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        raw_output: error.stdout || error.stderr || "Unknown error occurred",
      }
    }
  },
})
