/**
 * XAYTHEON — Taint Analyzer Service
 * Simulates static/dynamic data flow analysis (taint tracking) 
 * to detect how untrusted sources reach sensitive sinks.
 */

class TaintAnalyzerService {
    constructor() {
        this.scans = [];
    }

    /**
     * Run a simulated Taint Scan on a "codebase"
     */
    runTaintScan(files) {
        const findings = [];

        files.forEach(file => {
            const lines = file.content.split('\n');
            const sources = []; // untrusted inputs

            lines.forEach((line, i) => {
                // Mock source detection
                if (line.includes('req.body') || line.includes('req.query')) {
                    sources.push({ variable: this.extractVar(line), line: i + 1 });
                }

                // Mock Sink detection (Injection Points)
                sources.forEach(source => {
                    if (line.includes(source.variable)) {
                        if (line.includes('eval(') || line.includes('query(') || line.includes('innerHTML')) {
                            findings.push({
                                file: file.name,
                                type: line.includes('eval') ? 'CODE_INJECTION' : line.includes('query') ? 'SQL_INJECTION' : 'XSS',
                                sourceLine: source.line,
                                sinkLine: i + 1,
                                variable: source.variable,
                                severity: 'CRITICAL',
                                description: `Untrusted data from '${source.variable}' reached a sensitive sink without sanitization.`
                            });
                        }
                    }
                });
            });
        });

        const scanId = `SCAN_${Date.now()}`;
        this.scans.push({ id: scanId, findings, status: 'COMPLETE', timestamp: Date.now() });
        return { scanId, findings };
    }

    extractVar(line) {
        const match = line.match(/(const|let|var)\s+(\w+)\s*=/);
        return match ? match[2] : 'unknown';
    }

    getHistory() {
        return this.scans;
    }
}

module.exports = new TaintAnalyzerService();
