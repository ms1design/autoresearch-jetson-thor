import { tool } from "@opencode-ai/plugin"
import { readFileSync, existsSync } from "fs"

// Read documentation: https://opencode.ai/docs/custom-tools.md

export default tool({
  description: "Analyze training results from the Jetson Thor autoresearch setup. This tool parses training logs (from logs/run.log), extracts key metrics (val_bpb, memory usage, training time), and provides comprehensive analysis of experiment results. Use this tool to verify experiment results instead of parsing logs manually.",
  args: {
    log_file: tool.schema.string().describe("Path to the training log file (e.g., logs/run.log)").optional(),
    results_file: tool.schema.string().describe("Path to results.tsv file for comparative analysis").optional(),
  },
  async execute(args, context) {
    const worktree = context.worktree
    
    // Default paths
    const logFile = (args.log_file || "logs/run.log").replace(/^\.\/?/, "")
    const fullLogPath = logFile.startsWith("/") ? logFile : `${worktree}/${logFile}`
    
    const resultsFile = (args.results_file || "results.tsv").replace(/^\.\/?/, "")
    const fullResultsPath = resultsFile.startsWith("/") ? resultsFile : `${worktree}/${resultsFile}`
    
    // Parse log file
    try {
      let logContent = ""
      if (existsSync(fullLogPath)) {
        logContent = readFileSync(fullLogPath, "utf8")
      }
      
      // Extract key metrics
      const valBpbMatch = logContent.match(/val_bpb:\s+([0-9.]+)/)
      const memoryMatch = logContent.match(/peak_vram_mb:\s+([0-9.]+)/)
      const trainingTimeMatch = logContent.match(/training_seconds:\s+([0-9.]+)/)
      
      const logAnalysis = {
        val_bpb: valBpbMatch ? parseFloat(valBpbMatch[1]) : null,
        peak_memory_mb: memoryMatch ? parseFloat(memoryMatch[1]) : null,
        training_seconds: trainingTimeMatch ? parseFloat(trainingTimeMatch[1]) : null,
        success: valBpbMatch !== null,
      }
      
      // Calculate memory in GB
      if (logAnalysis.peak_memory_mb) {
        logAnalysis.peak_memory_gb = (logAnalysis.peak_memory_mb / 1024).toFixed(2)
      }
      
      // Parse results TSV if available
      let resultsAnalysis = null
      if (existsSync(fullResultsPath)) {
        const resultsContent = readFileSync(fullResultsPath, "utf8")
        const lines = resultsContent.trim().split("\n")
        
        if (lines.length > 1) {
          const results = []
          for (let i = 1; i < lines.length; i++) {
            const parts = lines[i].split("\t")
            if (parts.length >= 4) {
              const [commit, valBpb, memoryGb, status, ...descriptionParts] = parts
              results.push({
                commit,
                val_bpb: parseFloat(valBpb) || 0,
                memory_gb: parseFloat(memoryGb) || 0,
                status,
                description: descriptionParts.join("\t"),
              })
            }
          }
          
          const validResults = results.filter(r => r.val_bpb && !isNaN(r.val_bpb))
          const bestResult = validResults.length > 0 ? validResults.reduce((best, current) => 
            current.val_bpb < best.val_bpb ? current : best
          , validResults[0]) : null
          
          resultsAnalysis = {
            total_experiments: results.length,
            valid_experiments: validResults.length,
            status_breakdown: {
              keep: results.filter(r => r.status === "keep").length,
              discard: results.filter(r => r.status === "discard").length,
              crash: results.filter(r => r.status === "crash").length,
            },
            best_result: bestResult,
          }
        }
      }
      
      return {
        log_analysis: logAnalysis,
        results_analysis: resultsAnalysis,
        summary: {
          success: logAnalysis.success,
          val_bpb: logAnalysis.val_bpb,
          peak_memory_gb: logAnalysis.peak_memory_gb,
        },
      }
    } catch (error: any) {
      return {
        log_analysis: { success: false, error: error.message },
        results_analysis: null,
        summary: { success: false },
      }
    }
  },
})
