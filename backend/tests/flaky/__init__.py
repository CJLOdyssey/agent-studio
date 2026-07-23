"""Flaky test quarantine policy and instructions.

====================================================================
  FLAKY TEST QUARANTINE POLICY
====================================================================

A test is "flaky" when it passes or fails non-deterministically under
the same code, environment, and inputs. Flaky tests erode trust in CI
and waste engineering time diagnosing false positives.

When a test is identified as flaky:

  1. QUARANTINE — Mark it with ``@flaky_test`` from ``tests.conftest_flaky``.
     This applies ``pytest.mark.flaky`` for CI-level retry (via
     pytest-rerunfailures) and wraps the function with in-process
     retry logic. The test is automatically skipped unless
     ``--run-flaky`` is passed.

  2. FILE A TICKET — Create a bug ticket with:
     - The test name and file location.
     - The observed failure mode (e.g. race condition, timing dependency,
       external service flakiness).
     - The branch and CI run where it was first observed.

  3. CI DETECTION — CI runs with ``--run-flaky`` so that quarantined
     tests are re-evaluated on every build. If the test passes
     consistently over one sprint, it may be de-quarantined.

  4. FIX WITHIN ONE SPRINT — The owning team must fix the root cause
     within one sprint. Flaky tests left in quarantine beyond one
     sprint trigger an escalation.

  5. DE-QUARANTINE — After the root cause is fixed and the test has
     passed consistently in CI for at least 5 consecutive runs:
     - Remove the ``@flaky_test`` decorator.
     - Close the ticket with the fix commit reference.
     - Remove any entries from this file's quarantine registry.

====================================================================
  QUARANTINE REGISTRY
====================================================================

Add entries here when quarantining a test. Remove when de-quarantined.

Format: ``(test_path, test_name, ticket_url, date_quarantined, reason)``

Registry:
    # Example:
    # ("tests/routers/test_agents.py", "test_create_agent_concurrent",
    #  "https://github.com/org/repo/issues/123", "2025-01-15",
    #  "Race condition on unique name constraint when two agents created simultaneously"),
"""

# Quarantine registry (populate when tests are quarantined)
QUARANTINE_REGISTRY: list[tuple[str, str, str, str, str]] = []
