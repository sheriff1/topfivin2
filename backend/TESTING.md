# Backend Test Infrastructure Setup

## Overview

Jest testing framework configured for Node.js backend with the following structure:

### Configuration Files

- **jest.config.js** - Jest configuration with coverage thresholds and test patterns
- **package.json** - Updated with test scripts and dev dependencies

### Test Organization

- **src/**tests**/** - Test directory (mirrors src/ structure)
- **src/**/\*.test.js\*\* - Co-located test files (alternative pattern)

### Available Commands

```bash
# Run all tests
npm test

# Run tests in watch mode (auto-rerun on file changes)
npm run test:watch

# Generate coverage report
npm run test:coverage
```

### Testing Stack

- **Jest 29.7.0** - Test runner and assertion library
- **Supertest 6.3.3** - HTTP assertion library for testing Express routes (Issue #43)

### Coverage Thresholds

Minimum coverage requirements:

- Branches: 50%
- Functions: 50%
- Lines: 50%
- Statements: 50%

### Implementation Roadmap

**Phase 1 (Foundation)**

- ✅ Jest configuration and CI integration
- Issue #42: Unit tests for services (statProcessor, rankings, teams, audit)
- Issue #43: Integration tests for API routes using supertest
- Issue #44: Frontend component unit tests (Vitest/React Testing Library)
- Issue #45: Frontend hooks and utility tests

**Phase 2 (Enhanced)**

- Issue #46: E2E tests with Playwright
- Issue #47: API contract tests for response schema validation

### Example Test Structure

```javascript
describe("Module Name", () => {
  beforeEach(() => {
    // Setup before each test
  });

  afterEach(() => {
    // Cleanup after each test
  });

  describe("Feature Group", () => {
    it("should do something specific", () => {
      expect(actual).toBe(expected);
    });
  });
});
```

### Best Practices

1. Use descriptive test names (`it('should...', ...)`)
2. Test behavior, not implementation
3. Keep tests focused and isolated
4. Use `beforeEach`/`afterEach` for setup/cleanup
5. Mock external dependencies (database, API calls, Redis)

### Next Steps

1. **Issue #42**: Implement unit tests for services
2. **Issue #43**: Create integration tests for API routes
3. **Issue #56**: Add Jest to GitHub Actions CI pipeline
