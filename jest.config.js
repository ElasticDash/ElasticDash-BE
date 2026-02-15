module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/controller/**/*.test.js'],
  transform: {
    '^.+\\.js$': 'babel-jest',
  },
};