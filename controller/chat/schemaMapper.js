// Minimal parameter mapping for API schema preparation

// Stub: attempt to find parameter schema from a registry (not yet implemented)
export function findApiParameters(path, method) {
  // Placeholder: would lookup from openapi-doc or services registry
  // For now, return null to skip schema-based mapping
  return null;
}

// Prepare API schema by merging step definition with parameters
export function prepareApiSchema(step, parametersSchema) {
  const providedArgs = step.api.parameters || step.api.input || {};

  return {
    path: process.env.BACKEND_URL + step.api.path,
    method: step.api.method,
    requestBody: step.api.requestBody,
    parameters: providedArgs,
    parametersSchema,
  };
}
