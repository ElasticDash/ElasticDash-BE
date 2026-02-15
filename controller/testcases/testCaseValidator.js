// Input validation for test case and ai call
module.exports = {
  validateTestCase(data) {
    if (!data.name || typeof data.name !== 'string') return false;
    return true;
  },
  validateAiCall(data) {
    if (!data.test_case_id || !data.ai_model || !data.input || !data.expected_output) return false;
    return true;
  }
};
