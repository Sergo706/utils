import z, { type ZodType } from "zod";
/**
 * A task to be executed during configuration initialization.
 * Receives the configuration object as a parameter and can optionally return a Promise
 * for asynchronous setup that will be safely awaited.
 */
type InitializationTask = (config: unknown) => Promise<void> | void;

/**
 * Creates a type-safe configuration manager for a project.
 * 
 * This utility allows projects to define their own configuration schema and manage
 * a global configuration state with runtime validation and detailed error reporting.
 * 
 * @template T - The type of the configuration object (inferred from schema).
 * @param schema - A Zod schema used to validate the configuration.
 * @param projectName - The name of the project (used in error messages).
 * @returns An object containing `defineConfiguration` and `getConfiguration` functions.
 * 
 * @example
 * const MySchema = z.object({ apiKey: z.string() });
 * const { defineConfiguration, getConfiguration } = createConfigManager(MySchema, "MyProject");
 * 
 * defineConfiguration({ apiKey: "secret" });
 * const { apiKey } = getConfiguration();
 */
export function createConfigManager<T>(schema: ZodType<T>, projectName = "App") {
  let cfg: T | undefined;

  /**
   * Validates, freezes, and stores the project configuration.
   * This should typically be called once during the application's bootstrapping phase.
   * 
   * @param config - The raw configuration object to validate.
   * @param initializations - Optional array of functions to run after validation.
   *   Each initialization task receives the parsed `config` as a parameter. Any returned 
   *   Promises are awaited concurrently before the configuration is finalized.
   * @throws Error with detailed Zod validation failure information if validation fails.
   */
  async function defineConfiguration(config: unknown, initializations: InitializationTask[] = []): Promise<void> {
    try {
      const validated = schema.parse(config);  
      const promises = initializations.map(f => f(validated)); 
      await Promise.all(promises);

      cfg = Object.freeze(validated);
    } catch (err) {
      if (err instanceof z.ZodError) {
        const details = err.issues.map(issue => {
          const path = issue.path.length ? issue.path.join(".") : "(root)";
          const received = JSON.stringify(issue.input);
          return `• Path: ${path}\n  Message: ${issue.message}\n  Received: ${received}\n  Code: ${issue.code}`;
        }).join("\n");
        const pretty = z.prettifyError(err);
        throw new Error(`[${projectName}] Configuration validation failed with ${err.issues.length} error(s):\n${details}\n\nPretty Print:\n${pretty}`);
      }
      throw new Error(`[${projectName}] Failed to process configuration: ${err}`);
    }
  }

  /**
   * Retrieves the validated and frozen configuration object.
   * 
   * @returns The configuration object of type T.
   * @throws Error if getConfiguration is called before a successful defineConfiguration call.
   */
  function getConfiguration(): T {
    if (!cfg) {
      console.trace(`Premature getConfiguration() call for ${projectName}`);
      throw new Error(`[${projectName}] Access Error: Configuration must be initialized via defineConfiguration() before access.`);
    }
    return cfg;
  }

  return {
    defineConfiguration,
    getConfiguration,
  };
}