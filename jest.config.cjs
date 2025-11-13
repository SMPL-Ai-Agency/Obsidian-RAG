const baseConfig = {
  preset: 'ts-jest',
  roots: ['<rootDir>/tests', '<rootDir>/services/__tests__'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
    '^obsidian$': '<rootDir>/tests/__mocks__/obsidian.ts'
  }
};

const nodeProject = {
  ...baseConfig,
  displayName: 'node',
  testEnvironment: 'node',
  testPathIgnorePatterns: ['<rootDir>/tests/NotificationManager.test.ts']
};

const jsdomProject = {
  ...baseConfig,
  displayName: 'jsdom',
  testEnvironment: 'jsdom',
  testMatch: ['<rootDir>/tests/NotificationManager.test.ts'],
  testEnvironmentOptions: {
    customExportConditions: ['browser', 'default', 'node']
  }
};

module.exports = {
  projects: [nodeProject, jsdomProject]
};
