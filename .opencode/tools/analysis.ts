import { tool } from "@opencode-ai/plugin"
import path from "path"

export default tool({
  description: "Analyze training results from the Jetson Thor autoresearch setup. This tool parses training logs, extracts key metrics (val_bpb, memory usage, training time), and provides a comprehensive analysis of experiment results. Use this tool to verify experiment results instead of parsing logs manually.",
  args: {
    log_file: tool.schema.string().describe("Path to the training log file (e.g., run.log)").optional(),
    results_file: tool.schema.string().describe("Path to results.tsv file for comparative analysis").optional(),
  },
  async execute(args, context) {
    const worktree = context.worktree
    const logFile = args.log_file || path.join(worktree, "run.log")
    const resultsFile = args.results_file || path.join(worktree, "results.tsv")
    
    let logAnalysis = null
    let resultsAnalysis = null
    
    // Parse log file
    try {
      const logContent = Bun.file(logFile).exists() ? await Bun.file(logFile).text() : ""
      
      // Extract key metrics
      const valBpbMatch = logContent.match(/val_bpb:\s+([0-9.]+)/)
      const memoryMatch = logContent.match(/peak_vram_mb:\s+([0-9.]+)/)
      const trainingTimeMatch = logContent.match(/training_seconds:\s+([0-9.]+)/)
      const totalTimeMatch = logContent.match(/total_seconds:\s+([0-9.]+)/)
      const tokensMatch = logContent.match(/total_tokens_M:\s+([0-9.]+)/)
      const stepsMatch = logContent.match(/num_steps:\s+(\d+)/)
      const paramsMatch = logContent.match(/num_params_M:\s+([0-9.]+)/)
      const depthMatch = logContent.match(/depth:\s+(\d+)/)
      const mfuMatch = logContent.match(/mfu_percent:\s+([0-9.]+)/)
      
      logAnalysis = {
        val_bpb: valBpbMatch ? parseFloat(valBpbMatch[1]) : null,
        peak_memory_mb: memoryMatch ? parseFloat(memoryMatch[1]) : null,
        training_seconds: trainingTimeMatch ? parseFloat(trainingTimeMatch[1]) : null,
        total_seconds: totalTimeMatch ? parseFloat(totalTimeMatch[1]) : null,
        total_tokens_M: tokensMatch ? parseFloat(tokensMatch[1]) : null,
        num_steps: stepsMatch ? parseInt(stepsMatch[1]) : null,
        num_params_M: paramsMatch ? parseFloat(paramsMatch[1]) : null,
        depth: depthMatch ? parseInt(depthMatch[1]) : null,
        mfu_percent: mfuMatch ? parseFloat(mfuMatch[1]) : null,
        has_error: logContent.includes("FAIL") || logContent.includes("Traceback"),
        error_details: logContent.includes("FAIL") ? "Training failed" : null,
      }
      
      // Calculate memory in GB
      if (logAnalysis.peak_memory_mb) {
        logAnalysis.peak_memory_gb = (logAnalysis.peak_memory_mb / 1024).toFixed(2)
      }
      
      // Analyze success status
      logAnalysis.success = logAnalysis.val_bpb !== null && !logAnalysis.has_error
    } catch (error: any) {
      logAnalysis = {
        error: `Failed to parse log file: ${error.message}`,
        success: false,
      }
    }
    
    // Analyze results TSV if available
    try {
      if (Bun.file(resultsFile).exists()) {
        const resultsContent = await Bun.file(resultsFile).text()
        const lines = resultsContent.trim().split("\n")
        
        if (lines.length > 1) {
          const results = []
          for (let i = 1; i < lines.length; i++) {
            const [commit, valBpb, memoryGb, status, description] = lines[i].split("\t")
            results.push({
              commit,
              val_bpb: parseFloat(valBpb),
              memory_gb: parseFloat(memoryGb),
              status,
              description,
            })
          }
          
          // Find best result
          const validResults = results.filter(r => r.val_bpb && !isNaN(r.val_bpb))
          const bestResult = validResults.reduce((best, current) => 
            current.val_bpb < best.val_bpb ? current : best
          , validResults[0])
          
          resultsAnalysis = {
            total_experiments: results.length,
            valid_experiments: validResults.length,
            status_breakdown: {
              keep: results.filter(r => r.status === "keep").length,
              discard: results.filter(r => r.status === "discard").length,
              crash: results.filter(r => r.status === "crash").length,
            },
            best_result: bestResult || null,
            recent_results: results.slice(-5), // Last 5 experiments
          }
        }
      }
    } catch (error: any) {
      resultsAnalysis = {
        error: `Failed to parse results file: ${error.message}`,
      }
    }
    
    return {
      log_analysis: logAnalysis,
      results_analysis: resultsAnalysis,
      summary: {
        success: logAnalysis?.success || false,
        val_bpb: logAnalysis?.val_bpb,
        peak_memory_gb: logAnalysis?.peak_memory_gb,
        status: logAnalysis?.has_error ? "FAILED" : logAnalysis?.success ? "SUCCESS" : "UNKNOWN",
      },
    }
  },
})
