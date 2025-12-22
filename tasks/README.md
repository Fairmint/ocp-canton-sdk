# Tasks

## Active

| Task                                                                                  | Status   | Description                                        |
| ------------------------------------------------------------------------------------- | -------- | -------------------------------------------------- |
| [2025.12.22-complete-ocf-sdk-support](2025/12/2025.12.22-complete-ocf-sdk-support.md) | Planning | Complete OCF SDK support + hybrid testing strategy |

## Testing Strategy Summary

**Recommended: Hybrid Approach**

| Test Type         | Tool             | Purpose                                            |
| ----------------- | ---------------- | -------------------------------------------------- |
| Unit tests        | Mocks + fixtures | Fast feedback, type conversions, command building  |
| Integration tests | LocalNet         | Full round-trip, workflow testing, DAML validation |

See task file for detailed testing strategy.

## Related

- [DAML Implementation Task](https://github.com/fairmint/open-captable-protocol-daml/blob/main/tasks/2025/12/2025.12.22-complete-ocf-implementation.md)
- [OCF Implementation Status](https://github.com/fairmint/open-captable-protocol-daml/blob/main/docs/OCF_IMPLEMENTATION_STATUS.md)
