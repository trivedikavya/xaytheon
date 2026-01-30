/**
 * AI Governance Assistant Service
 * Explains architectural drift and generates code to fix violations
 */

class AIGovernanceService {
  constructor() {
    this.templateCache = new Map();
  }

  /**
   * Explain why a violation is architectural drift
   */
  explainViolation(violation, architecture) {
    const { sourceLayer, targetLayer, severity, type } = violation;

    let explanation = {
      title: `${severity.toUpperCase()}: ${sourceLayer} → ${targetLayer}`,
      problem: "",
      why: "",
      consequences: [],
      solution: "",
      refactoringSteps: [],
    };

    // Generate problem description
    if (type === "skip-layer") {
      explanation.problem = `The ${sourceLayer} layer is directly accessing the ${targetLayer} layer, skipping intermediate layers.`;
      explanation.why = `This violates the ${architecture} principle of layer separation. Each layer should only communicate with its immediate neighbor to maintain loose coupling and high cohesion.`;
      explanation.consequences = [
        "Tight coupling between non-adjacent layers",
        "Difficult to modify or replace intermediate layers",
        "Reduced testability and maintainability",
        "Violation of Single Responsibility Principle",
      ];
    } else if (type === "reverse") {
      explanation.problem = `The ${sourceLayer} layer is depending on the ${targetLayer} layer in reverse architectural order.`;
      explanation.why = `This creates a reverse dependency that violates the Dependency Inversion Principle. Lower layers should not depend on higher layers.`;
      explanation.consequences = [
        "Circular dependencies risk",
        "Inability to reuse lower-layer components",
        "Difficult to test in isolation",
        "Architectural erosion over time",
      ];
    } else {
      explanation.problem = `Unexpected connection from ${sourceLayer} to ${targetLayer}.`;
      explanation.why = `This connection is not part of the standard ${architecture} pattern and may indicate architectural drift.`;
      explanation.consequences = [
        "Inconsistent architecture across codebase",
        "Increased cognitive load for developers",
        "Potential for bugs and unexpected behavior",
      ];
    }

    // Generate solution
    explanation.solution = this.generateSolution(violation, architecture);
    explanation.refactoringSteps = this.generateRefactoringSteps(violation);

    return explanation;
  }

  /**
   * Generate solution for violation
   */
  generateSolution(violation, architecture) {
    const { sourceLayer, targetLayer, type } = violation;

    if (type === "skip-layer") {
      return `Introduce an intermediate service or adapter in the skipped layer to mediate the connection. Move the direct ${targetLayer} access logic into a ${this.getIntermediateLayer(sourceLayer, targetLayer)} that ${sourceLayer} can call.`;
    } else if (type === "reverse") {
      return `Invert the dependency using an interface or event system. Define an interface in the ${sourceLayer} layer that ${targetLayer} implements, allowing ${sourceLayer} to depend on abstractions rather than concrete implementations.`;
    } else {
      return `Refactor to align with ${architecture} principles. Consider moving the logic to the appropriate layer or introducing a proper service boundary.`;
    }
  }

  /**
   * Generate refactoring steps
   */
  generateRefactoringSteps(violation) {
    const { sourceLayer, targetLayer, type } = violation;

    if (type === "skip-layer") {
      const intermediate = this.getIntermediateLayer(sourceLayer, targetLayer);
      return [
        `1. Create a new ${intermediate} service to encapsulate ${targetLayer} access`,
        `2. Move the ${targetLayer} logic from ${sourceLayer} to the new service`,
        `3. Update ${sourceLayer} to call the ${intermediate} service instead`,
        `4. Add tests for the new service layer`,
        `5. Verify that the original functionality is preserved`,
      ];
    } else if (type === "reverse") {
      return [
        `1. Define an interface or abstract class in ${sourceLayer}`,
        `2. Implement the interface in ${targetLayer}`,
        `3. Use dependency injection to provide implementation`,
        `4. Update ${sourceLayer} to depend on interface, not concrete class`,
        `5. Test the inverted dependency structure`,
      ];
    } else {
      return [
        `1. Analyze the current connection and its purpose`,
        `2. Identify the correct layer for the logic`,
        `3. Refactor code to appropriate layer`,
        `4. Update dependencies and imports`,
        `5. Verify functionality and add tests`,
      ];
    }
  }

  /**
   * Get intermediate layer between source and target
   */
  getIntermediateLayer(sourceLayer, targetLayer) {
    const layers = ["view", "controller", "service", "model"];
    const sourceIndex = layers.indexOf(sourceLayer);
    const targetIndex = layers.indexOf(targetLayer);

    if (sourceIndex !== -1 && targetIndex !== -1 && sourceIndex < targetIndex) {
      const intermediate = layers[sourceIndex + 1];
      return intermediate || "service";
    }

    return "service"; // Default fallback
  }

  /**
   * Generate boilerplate code to fix violation
   */
  generateBoilerplateCode(violation, language = "javascript") {
    const { sourceLayer, targetLayer, type, source, target } = violation;

    if (language === "javascript" || language === "typescript") {
      if (type === "skip-layer") {
        return this.generateServiceBoilerplate(violation, language);
      } else if (type === "reverse") {
        return this.generateInterfaceBoilerplate(violation, language);
      }
    }

    return null;
  }

  /**
   * Generate service layer boilerplate
   */
  generateServiceBoilerplate(violation, language) {
    const serviceName = this.extractServiceName(violation.target);
    const isTypeScript = language === "typescript";

    const code = `${isTypeScript ? "// TypeScript" : "// JavaScript"}
// New Service to mediate connection
${isTypeScript ? "interface I" + serviceName + "Service {" : ""}
${isTypeScript ? "  getData(): Promise<any>;" : ""}
${isTypeScript ? "  create(data: any): Promise<any>;" : ""}
${isTypeScript ? "  update(id: string, data: any): Promise<any>;" : ""}
${isTypeScript ? "  delete(id: string): Promise<boolean>;" : ""}
${isTypeScript ? "}" : ""}
${isTypeScript ? "" : ""}
class ${serviceName}Service {
  constructor(${this.extractDependencies(violation)}) {
    ${this.generateConstructorBody(violation)}
  }

  async getData() {
    // Fetch data from ${violation.targetLayer}
    try {
      const result = await this.${this.extractTargetMethod(violation)}();
      return result;
    } catch (error) {
      console.error('Error fetching data:', error);
      throw error;
    }
  }

  async create(data${isTypeScript ? ": any" : ""}) {
    // Validate and create
    ${this.generateValidationCode(violation)}
    return await this.${this.extractTargetMethod(violation)}(data);
  }

  async update(id${isTypeScript ? ": string" : ""}, data${isTypeScript ? ": any" : ""}) {
    // Validate and update
    return await this.${this.extractTargetMethod(violation)}(id, data);
  }

  async delete(id${isTypeScript ? ": string" : ""})${isTypeScript ? ": Promise<boolean>" : ""} {
    // Delete operation
    return await this.${this.extractTargetMethod(violation)}(id);
  }
}

${isTypeScript ? "export default" : "module.exports ="} ${serviceName}Service;
`;

    return {
      filename: `${this.toKebabCase(serviceName)}.service.${language === "typescript" ? "ts" : "js"}`,
      code,
      path: `backend/src/services/${this.toKebabCase(serviceName)}.service.${language === "typescript" ? "ts" : "js"}`,
    };
  }

  /**
   * Generate interface boilerplate for dependency inversion
   */
  generateInterfaceBoilerplate(violation, language) {
    const interfaceName = this.extractInterfaceName(violation);
    const isTypeScript = language === "typescript";

    if (!isTypeScript) {
      // JavaScript doesn't have interfaces, use abstract class pattern
      const code = `// JavaScript - Abstract base class pattern
class ${interfaceName} {
  getData() {
    throw new Error('Method getData() must be implemented');
  }

  processData(data) {
    throw new Error('Method processData() must be implemented');
  }
}

// Implementation example
class ${interfaceName}Impl extends ${interfaceName} {
  async getData() {
    // Implementation from ${violation.targetLayer}
    return await this.fetchFromSource();
  }

  async processData(data) {
    // Process implementation
    return data;
  }

  async fetchFromSource() {
    // Actual implementation
    throw new Error('Not implemented');
  }
}

module.exports = { ${interfaceName}, ${interfaceName}Impl };
`;

      return {
        filename: `${this.toKebabCase(interfaceName)}.js`,
        code,
        path: `backend/src/interfaces/${this.toKebabCase(interfaceName)}.js`,
      };
    } else {
      // TypeScript interface
      const code = `// TypeScript - Interface with implementation
export interface ${interfaceName} {
  getData(): Promise<any>;
  processData(data: any): Promise<any>;
}

// Implementation example
export class ${interfaceName}Impl implements ${interfaceName} {
  async getData(): Promise<any> {
    // Implementation from ${violation.targetLayer}
    return await this.fetchFromSource();
  }

  async processData(data: any): Promise<any> {
    // Process implementation
    return data;
  }

  private async fetchFromSource(): Promise<any> {
    // Actual implementation
    throw new Error('Not implemented');
  }
}
`;

      return {
        filename: `${this.toKebabCase(interfaceName)}.ts`,
        code,
        path: `backend/src/interfaces/${this.toKebabCase(interfaceName)}.ts`,
      };
    }
  }

  /**
   * Generate recommendations for multiple violations
   */
  generateRecommendations(violations) {
    const recommendations = [];

    // Group by type
    const byType = {
      "skip-layer": violations.filter((v) => v.type === "skip-layer"),
      reverse: violations.filter((v) => v.type === "reverse"),
      unexpected: violations.filter((v) => v.type === "unexpected"),
    };

    // Priority 1: Fix critical reverse dependencies
    if (byType.reverse.length > 0) {
      recommendations.push({
        priority: 1,
        category: "Reverse Dependencies",
        description: `Fix ${byType.reverse.length} reverse dependencies using dependency inversion`,
        violations: byType.reverse.slice(0, 5).map((v) => v.id),
        estimatedEffort: `${byType.reverse.length * 2}h`,
      });
    }

    // Priority 2: Fix skip-layer violations
    if (byType["skip-layer"].length > 0) {
      recommendations.push({
        priority: 2,
        category: "Skip-Layer Violations",
        description: `Introduce ${byType["skip-layer"].length} intermediate services`,
        violations: byType["skip-layer"].slice(0, 5).map((v) => v.id),
        estimatedEffort: `${byType["skip-layer"].length * 1.5}h`,
      });
    }

    // Priority 3: Review unexpected connections
    if (byType.unexpected.length > 0) {
      recommendations.push({
        priority: 3,
        category: "Unexpected Connections",
        description: `Review and refactor ${byType.unexpected.length} unexpected connections`,
        violations: byType.unexpected.slice(0, 5).map((v) => v.id),
        estimatedEffort: `${byType.unexpected.length * 1}h`,
      });
    }

    return recommendations;
  }

  /**
   * Helper: Extract service name from file path
   */
  extractServiceName(filePath) {
    const filename = filePath.split("/").pop().replace(/\.[^.]+$/, "");
    return this.toPascalCase(filename);
  }

  /**
   * Helper: Extract interface name
   */
  extractInterfaceName(violation) {
    const base = this.extractServiceName(violation.target);
    return `I${base}Provider`;
  }

  /**
   * Helper: Extract dependencies
   */
  extractDependencies(violation) {
    return `${this.toLowerFirst(this.extractServiceName(violation.target))}Repository`;
  }

  /**
   * Helper: Generate constructor body
   */
  generateConstructorBody(violation) {
    const repo = this.toLowerFirst(this.extractServiceName(violation.target)) + "Repository";
    return `this.${repo} = ${repo};`;
  }

  /**
   * Helper: Extract target method
   */
  extractTargetMethod(violation) {
    return this.toLowerFirst(this.extractServiceName(violation.target)) + "Repository.findAll";
  }

  /**
   * Helper: Generate validation code
   */
  generateValidationCode(violation) {
    return `if (!data) throw new Error('Data is required');`;
  }

  /**
   * Helper: Convert to kebab-case
   */
  toKebabCase(str) {
    return str
      .replace(/([a-z])([A-Z])/g, "$1-$2")
      .replace(/[\s_]+/g, "-")
      .toLowerCase();
  }

  /**
   * Helper: Convert to PascalCase
   */
  toPascalCase(str) {
    return str
      .replace(/[-_](\w)/g, (_, c) => c.toUpperCase())
      .replace(/^\w/, (c) => c.toUpperCase());
  }

  /**
   * Helper: Convert to lowercase first
   */
  toLowerFirst(str) {
    return str.charAt(0).toLowerCase() + str.slice(1);
  }
}

module.exports = new AIGovernanceService();
