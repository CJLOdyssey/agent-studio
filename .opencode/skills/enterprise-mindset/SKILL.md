---
name: enterprise-mindset
description: Ensures code follows enterprise-grade production quality standards including security, scalability, observability, and maintainability. Use when writing production code that needs to meet enterprise requirements.
---
# Enterprise Mindset

Ensures code meets enterprise-grade production standards.

## Quality Dimensions

### Security
- No hardcoded secrets or credentials
- Input validation and sanitization
- Authentication and authorization checks
- Rate limiting and DoS protection
- Proper dependency management (no vulnerable packages)
- SQL injection prevention (parameterized queries)

### Scalability
- Stateless where possible
- Proper caching strategy
- Database query optimization (N+1 prevention)
- Connection pool management
- Async/background processing for heavy operations
- Horizontal scaling considerations

### Observability
- Structured logging with proper levels
- Metrics tracking (counters, histograms, gauges)
- Distributed tracing
- Health check endpoints
- Error tracking with context
- Audit logging for critical operations

### Maintainability
- Clear error messages and documentation
- Consistent code style and patterns
- Proper test coverage (unit, integration, e2e)
- Configuration management (env vars, feature flags)
- Graceful degradation and fallback handling
- Version compatibility handling

## Review Checklist

Before considering code enterprise-ready, verify:
- [ ] Security review completed
- [ ] Performance testing done
- [ ] Error paths handled
- [ ] Logging added at appropriate levels
- [ ] Configuration externalized
- [ ] Tests written for critical paths
- [ ] Documentation updated
- [ ] Monitoring/alerting configured
