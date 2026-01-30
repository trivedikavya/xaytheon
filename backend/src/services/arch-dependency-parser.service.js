const axios = require("axios");
const path = require("path");

/**
 * Architectural Dependency Parser Service
 * Parses imports and function calls to build directional dependency graph
 * for architectural drift detection
 */

// Common import/require patterns for different languages
const IMPORT_PATTERNS = {
  javascript: [
    /import\s+.*?\s+from\s+['"]([^'"]+)['"]/g,
    /require\s*\(['"]([^'"]+)['"]\)/g,
    /import\s*\(['"]([^'"]+)['"]\)/g, // Dynamic imports
  ],
  typescript: [
    /import\s+.*?\s+from\s+['"]([^'"]+)['"]/g,
    /require\s*\(['"]([^'"]+)['"]\)/g,
    /import\s+type\s+.*?\s+from\s+['"]([^'"]+)['"]/g,
  ],
  python: [
    /^import\s+([^\s]+)/gm,
    /^from\s+([^\s]+)\s+import/gm,
  ],
  java: [
    /import\s+([\w.]+);/g,
  ],
};

// Function call patterns
const FUNCTION_CALL_PATTERNS = {
  javascript: [
    /(\w+)\s*\(/g, // Simple function calls
    /(\w+)\.(\w+)\s*\(/g, // Method calls
  ],
  typescript: [
    /(\w+)\s*\(/g,
    /(\w+)\.(\w+)\s*\(/g,
  ],
  python: [
    /(\w+)\s*\(/g,
    /(\w+)\.(\w+)\s*\(/g,
  ],
};

class ArchitecturalDependencyParserService {
  constructor() {
    this.cache = new Map();
    this.cacheExpiry = 3600000; // 1 hour
  }

  /**
   * Parse entire repository for architectural dependencies
   */
  async parseRepository(owner, repo) {
    const cacheKey = `arch-deps:${owner}/${repo}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    try {
      // Fetch repository structure
      const files = await this.fetchRepositoryFiles(owner, repo);

      // Parse each file
      const fileNodes = [];
      for (const file of files) {
        if (this.isCodeFile(file.path)) {
          const node = await this.parseFile(owner, repo, file.path);
          if (node) {
            fileNodes.push(node);
          }
        }
      }

      // Build dependency graph
      const graph = this.buildDependencyGraph(fileNodes);

      // Analyze layer structure
      const layers = this.inferLayers(fileNodes);

      const result = {
        repository: `${owner}/${repo}`,
        timestamp: new Date().toISOString(),
        files: fileNodes,
        graph,
        layers,
        statistics: this.calculateStatistics(fileNodes, graph),
      };

      this.setCache(cacheKey, result);
      return result;
    } catch (error) {
      console.error("Error parsing repository:", error);
      throw error;
    }
  }

  /**
   * Parse individual file for dependencies
   */
  async parseFile(owner, repo, filePath) {
    try {
      const content = await this.fetchFileContent(owner, repo, filePath);
      if (!content) return null;

      const language = this.detectLanguage(filePath);
      const imports = this.extractImports(content, language);
      const functionCalls = this.extractFunctionCalls(content, language);
      const exports = this.extractExports(content, language);

      // Infer layer from file path
      const layer = this.inferLayer(filePath);

      return {
        path: filePath,
        language,
        layer,
        imports,
        exports,
        functionCalls,
        lines: content.split("\n").length,
        complexity: this.calculateFileComplexity(content),
      };
    } catch (error) {
      console.error(`Error parsing file ${filePath}:`, error);
      return null;
    }
  }

  /**
   * Extract import statements
   */
  extractImports(content, language) {
    const imports = [];
    const patterns = IMPORT_PATTERNS[language] || IMPORT_PATTERNS.javascript;

    patterns.forEach((pattern) => {
      const matches = content.matchAll(pattern);
      for (const match of matches) {
        const importPath = match[1];
        if (importPath && !importPath.startsWith(".")) {
          // External dependency
          imports.push({
            path: importPath,
            type: "external",
            line: this.getLineNumber(content, match.index),
          });
        } else if (importPath) {
          // Internal dependency
          imports.push({
            path: importPath,
            type: "internal",
            line: this.getLineNumber(content, match.index),
          });
        }
      }
    });

    return imports;
  }

  /**
   * Extract function calls
   */
  extractFunctionCalls(content, language) {
    const calls = [];
    const patterns = FUNCTION_CALL_PATTERNS[language] || FUNCTION_CALL_PATTERNS.javascript;

    patterns.forEach((pattern) => {
      const matches = content.matchAll(pattern);
      for (const match of matches) {
        if (match[2]) {
          // Method call (object.method())
          calls.push({
            object: match[1],
            function: match[2],
            type: "method",
            line: this.getLineNumber(content, match.index),
          });
        } else if (match[1]) {
          // Simple function call
          calls.push({
            function: match[1],
            type: "function",
            line: this.getLineNumber(content, match.index),
          });
        }
      }
    });

    return calls;
  }

  /**
   * Extract exports
   */
  extractExports(content, language) {
    const exports = [];

    if (language === "javascript" || language === "typescript") {
      // Named exports
      const namedExports = content.matchAll(/export\s+(?:const|let|var|function|class)\s+(\w+)/g);
      for (const match of namedExports) {
        exports.push({
          name: match[1],
          type: "named",
          line: this.getLineNumber(content, match.index),
        });
      }

      // Default export
      const defaultExport = content.match(/export\s+default\s+(\w+)/);
      if (defaultExport) {
        exports.push({
          name: defaultExport[1],
          type: "default",
          line: this.getLineNumber(content, defaultExport.index),
        });
      }
    }

    return exports;
  }

  /**
   * Build dependency graph from file nodes
   */
  buildDependencyGraph(fileNodes) {
    const nodes = [];
    const edges = [];

    // Create nodes
    fileNodes.forEach((file) => {
      nodes.push({
        id: file.path,
        label: path.basename(file.path),
        layer: file.layer,
        complexity: file.complexity,
        lines: file.lines,
      });
    });

    // Create edges from imports
    fileNodes.forEach((file) => {
      file.imports.forEach((imp) => {
        if (imp.type === "internal") {
          // Resolve relative path
          const targetPath = this.resolveImportPath(file.path, imp.path);
          const target = fileNodes.find((f) => f.path === targetPath || f.path.includes(imp.path));

          if (target) {
            edges.push({
              source: file.path,
              target: target.path,
              type: "import",
              sourceLayer: file.layer,
              targetLayer: target.layer,
              line: imp.line,
            });
          }
        }
      });
    });

    return { nodes, edges };
  }

  /**
   * Infer architectural layers
   */
  inferLayers(fileNodes) {
    const layerMap = {};

    fileNodes.forEach((file) => {
      const layer = file.layer;
      if (!layerMap[layer]) {
        layerMap[layer] = {
          name: layer,
          files: [],
          count: 0,
        };
      }
      layerMap[layer].files.push(file.path);
      layerMap[layer].count++;
    });

    // Calculate layer statistics
    const layers = Object.values(layerMap).map((layer) => ({
      ...layer,
      percentage: (layer.count / fileNodes.length) * 100,
    }));

    // Sort by typical architecture order
    const order = ["view", "controller", "service", "model", "utils", "config", "test", "unknown"];
    layers.sort((a, b) => {
      const indexA = order.indexOf(a.name);
      const indexB = order.indexOf(b.name);
      return (indexA === -1 ? 999 : indexA) - (indexB === -1 ? 999 : indexB);
    });

    return layers;
  }

  /**
   * Infer layer from file path
   */
  inferLayer(filePath) {
    const lowerPath = filePath.toLowerCase();

    // Layer detection patterns
    const patterns = {
      view: ["/views?/", "/components/", "/ui/", "/pages/", "/templates/", ".jsx", ".vue", ".html"],
      controller: ["/controllers?/", "/handlers/", "/routes/", "/api/"],
      service: ["/services?/", "/business/", "/domain/", "/use-?cases?/"],
      model: ["/models?/", "/entities/", "/schemas?/", "/database/", "/db/"],
      utils: ["/utils?/", "/helpers?/", "/lib/", "/common/"],
      config: ["/config/", "/settings/", ".config."],
      test: ["/tests?/", "/__tests__/", ".test.", ".spec."],
    };

    for (const [layer, layerPatterns] of Object.entries(patterns)) {
      if (layerPatterns.some((pattern) => lowerPath.includes(pattern))) {
        return layer;
      }
    }

    return "unknown";
  }

  /**
   * Calculate file complexity
   */
  calculateFileComplexity(content) {
    let complexity = 1; // Base complexity

    // Count control structures
    const controlStructures = [
      /\bif\s*\(/g,
      /\bfor\s*\(/g,
      /\bwhile\s*\(/g,
      /\bswitch\s*\(/g,
      /\bcatch\s*\(/g,
      /\?\s*.*?\s*:/g, // Ternary
    ];

    controlStructures.forEach((pattern) => {
      const matches = content.match(pattern) || [];
      complexity += matches.length;
    });

    return complexity;
  }

  /**
   * Calculate repository statistics
   */
  calculateStatistics(fileNodes, graph) {
    const totalFiles = fileNodes.length;
    const totalLines = fileNodes.reduce((sum, f) => sum + f.lines, 0);
    const totalImports = fileNodes.reduce((sum, f) => sum + f.imports.length, 0);
    const totalExports = fileNodes.reduce((sum, f) => sum + f.exports.length, 0);
    const avgComplexity =
      fileNodes.reduce((sum, f) => sum + f.complexity, 0) / totalFiles;

    const layerDistribution = {};
    fileNodes.forEach((f) => {
      layerDistribution[f.layer] = (layerDistribution[f.layer] || 0) + 1;
    });

    return {
      totalFiles,
      totalLines,
      totalImports,
      totalExports,
      totalEdges: graph.edges.length,
      avgComplexity: Math.round(avgComplexity),
      layerDistribution,
    };
  }

  /**
   * Detect language from file extension
   */
  detectLanguage(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    const languageMap = {
      ".js": "javascript",
      ".jsx": "javascript",
      ".ts": "typescript",
      ".tsx": "typescript",
      ".py": "python",
      ".java": "java",
      ".go": "go",
      ".rb": "ruby",
      ".php": "php",
    };
    return languageMap[ext] || "unknown";
  }

  /**
   * Check if file is code file
   */
  isCodeFile(filePath) {
    const codeExtensions = [".js", ".jsx", ".ts", ".tsx", ".py", ".java", ".go", ".rb", ".php"];
    const ext = path.extname(filePath).toLowerCase();
    return codeExtensions.includes(ext);
  }

  /**
   * Resolve relative import path
   */
  resolveImportPath(fromPath, importPath) {
    const dir = path.dirname(fromPath);
    return path.normalize(path.join(dir, importPath));
  }

  /**
   * Get line number from content index
   */
  getLineNumber(content, index) {
    return content.substring(0, index).split("\n").length;
  }

  /**
   * Fetch repository files from GitHub
   */
  async fetchRepositoryFiles(owner, repo) {
    const url = `https://api.github.com/repos/${owner}/${repo}/git/trees/main?recursive=1`;
    const response = await axios.get(url, {
      headers: { Accept: "application/vnd.github.v3+json" },
    });
    return response.data.tree.filter((item) => item.type === "blob");
  }

  /**
   * Fetch file content from GitHub
   */
  async fetchFileContent(owner, repo, filePath) {
    try {
      const url = `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`;
      const response = await axios.get(url, {
        headers: { Accept: "application/vnd.github.v3.raw" },
      });
      return response.data;
    } catch (error) {
      console.error(`Error fetching file ${filePath}:`, error.message);
      return null;
    }
  }

  /**
   * Cache management
   */
  getFromCache(key) {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.cacheExpiry) {
      return cached.data;
    }
    return null;
  }

  setCache(key, data) {
    this.cache.set(key, { data, timestamp: Date.now() });
  }

  clearCache() {
    this.cache.clear();
  }
}

module.exports = new ArchitecturalDependencyParserService();
