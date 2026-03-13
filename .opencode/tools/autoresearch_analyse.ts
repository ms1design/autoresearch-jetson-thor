import { tool } from "@opencode-ai/plugin"
import { readFileSync, existsSync } from "fs"

// Read documentation: https://opencode.ai/docs/custom-tools.md

export default tool({
  description: "Analyze training results from the Jetson Thor autoresearch setup. This tool parses training logs (from logs/training.log), extracts key metrics (val_bpb, memory usage, training time), and provides comprehensive analysis of experiment results. Use this tool to verify experiment results instead of parsing logs manually.",
  args: {
    log_file: tool.schema.string().describe("Path to the training log file (default: logs/training.log)").optional(),
    results_file: tool.schema.string().describe("Path to results.tsv file for comparative analysis").optional(),
  },
  async execute(args, context) {
    const worktree = context.worktree
    
    // Default paths
    const logFile = (args.log_file || "logs/training.log").replace(/^\.\/?/, "")
    const fullLogPath = logFile.startsWith("/") ? logFile : `${worktree}/${logFile}`
    
    const resultsFile = (args.results_file || "results.tsv").replace(/^\.\/?/, "")
    const fullResultsPath = resultsFile.startsWith("/") ? resultsFile : `${worktree}/${resultsFile}`
    
    // Parse log file
    try {
      let logContent = ""
      if (existsSync(fullLogPath)) {
        logContent = readFileSync(fullLogPath, "utf8") || ""
      }
      
      // Ensure logContent is a string
      if (typeof logContent !== "string") {
        logContent = String(logContent || "")
      }
      
      // Extract key metrics
      const valBpbMatch = logContent && typeof logContent === "string" ? logContent.match(/val_bpb:\s+([0-9.]+)/) : null
      const memoryMatch = logContent && typeof logContent === "string" ? logContent.match(/peak_vram_mb:\s+([0-9.]+)/) : null
      const trainingTimeMatch = logContent && typeof logContent === "string" ? logContent.match(/training_seconds:\s+([0-9.]+)/) : null
      
      let logAnalysis: Record<string, any> = {
        val_bpb: null,
        peak_memory_mb: null,
        training_seconds: null,
        success: false,
      }
      
      if (valBpbMatch && valBpbMatch[1]) {
        logAnalysis.val_bpb = parseFloat(valBpbMatch[1])
        logAnalysis.success = true
      }
      if (memoryMatch && memoryMatch[1]) {
        logAnalysis.peak_memory_mb = parseFloat(memoryMatch[1])
      }
      if (trainingTimeMatch && trainingTimeMatch[1]) {
        logAnalysis.training_seconds = parseFloat(trainingTimeMatch[1])
      }
      
      // Calculate memory in GB
      if (logAnalysis.peak_memory_mb) {
        logAnalysis.peak_memory_gb = (logAnalysis.peak_memory_mb / 1024).toFixed(2)
      } else {
        logAnalysis.peak_memory_gb = null
      }
      
      // Parse results TSV if available
      let resultsAnalysis: Record<string, any> | null = null
      if (existsSync(fullResultsPath)) {
        let resultsContent = ""
        try {
          resultsContent = readFileSync(fullResultsPath, "utf8") || ""
        } catch (readError) {
          resultsContent = ""
        }
        
        if (resultsContent && typeof resultsContent === "string" && resultsContent.trim().length > 0) {
          const lines = resultsContent.trim().split("\n")
          
          if (lines.length > 1) {
            const results: Record<string, any>[] = []
            for (let i = 1; i < lines.length; i++) {
              const parts = lines[i].split("\t")
              if (parts.length >= 4) {
                const [commit, valBpb, memoryGb, status, ...descriptionParts] = parts
                if (typeof valBpb === "string" && typeof memoryGb === "string" && typeof status === "string") {
                  results.push({
                    commit,
                    val_bpb: parseFloat(valBpb) || 0,
                    memory_gb: parseFloat(memoryGb) || 0,
                    status,
                    description: descriptionParts.join("\t"),
                  })
                }
              }
            }
            
            if (results.length > 0) {
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
        }
      }
      
      // Build summary string directly
      const summaryText = `Log Analysis: ${logAnalysis.success ? 'Success' : 'Failed'}\n` +
        `val_bpb: ${logAnalysis.val_bpb}\n` +
        `peak_memory_gb: ${logAnalysis.peak_memory_gb}\n` +
        `training_seconds: ${logAnalysis.training_seconds}\n` +
        (resultsAnalysis ? `\nResults Analysis: ${JSON.stringify(resultsAnalysis)}` : '')
      
      return summaryText
    } catch (error: any) {
      return `Error: ${error.message}`
    }
  },
})
