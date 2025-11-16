# Feature Specification: NotebookLM UI Version Support (Old & New UI Compatibility)

**Feature Branch**: `008-notebooklm-ui-ui`
**Created**: 2025-11-15
**Status**: Draft
**Input**: User description: "いま、 NotebookLM にアップデートが来ており、新しいUIにおいて、現在のコードが動かなくなってしまった。しかし、アカウントごとに新UI、休UIの利用が異なり、私が今運用しているアカウントでは、両方対応が必要になっている。
ついては、両UIが使えるような設定の設計。wsの環境による切り替えの方法。今後、新アカウントに両アカウントも切り替わった際に、設定ファイルのみで移行できる対応、この点を対応できるようにしたい。

また、実装に当たって、実際の画面をChromeDevtoolなどを使って、DOMの解析を行って、実装目処を付ける必要があると思っており、その点も考慮した対応計画を作りたい"

## Clarifications

### Session 2025-11-15

- Q: What should be the default UI version when workspace configuration doesn't specify one? → A: Old UI (maintain backward compatibility, safer for existing workspaces)
- Q: When configured UI version doesn't match the actual NotebookLM UI (e.g., config says "old" but account shows "new"), what should happen? → A: Fail request immediately with error message to Slack user
- Q: When configuration file is malformed or has invalid UI version settings, what should happen on bot startup? → A: Refuse to start, exit with error code
- Q: What format and detail level should the DOM selector documentation have? → A: Detailed mapping with interaction steps (selector + action + expected result)
- Q: How should workspace UI version isolation be maintained during concurrent requests? → A: Browser instance per workspace (separate Playwright contexts)

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Workspace Operating with Legacy UI (Priority: P1)

An operator manages a workspace (ws1) where the NotebookLM account still uses the old UI. They need the bot to continue functioning without any manual intervention or code changes.

**Why this priority**: This ensures existing operations are not disrupted. The bot must continue to work for accounts that haven't migrated to the new UI yet.

**Independent Test**: Can be fully tested by running the bot against a workspace configured with old UI settings and verifying that all NotebookLM interactions (content upload, summary generation) complete successfully.

**Acceptance Scenarios**:

1. **Given** workspace ws1 is configured to use old UI, **When** a user posts a URL in Slack, **Then** the bot processes the request using old UI selectors and returns a summary
2. **Given** workspace ws1 configuration specifies old UI, **When** the bot launches NotebookLM, **Then** it uses the old UI DOM selectors and element interactions
3. **Given** the bot is processing a request for ws1, **When** it needs to interact with NotebookLM interface, **Then** it applies the correct UI version logic without errors

---

### User Story 2 - Workspace Operating with New UI (Priority: P1)

An operator manages a workspace (ws2) where the NotebookLM account has been migrated to the new UI. They need the bot to work with the new interface without affecting other workspaces.

**Why this priority**: Critical for supporting migrated accounts. Without this, the bot becomes non-functional for new UI accounts.

**Independent Test**: Can be fully tested by running the bot against a workspace configured with new UI settings and verifying that all NotebookLM interactions work correctly with the updated interface.

**Acceptance Scenarios**:

1. **Given** workspace ws2 is configured to use new UI, **When** a user posts a URL in Slack, **Then** the bot processes the request using new UI selectors and returns a summary
2. **Given** workspace ws2 configuration specifies new UI, **When** the bot launches NotebookLM, **Then** it uses the new UI DOM selectors and element interactions
3. **Given** the bot is processing a request for ws2, **When** NotebookLM presents the new interface, **Then** it correctly identifies and interacts with all necessary elements

---

### User Story 3 - Configuration-Based UI Migration (Priority: P2)

An operator needs to migrate a workspace from old UI to new UI after the NotebookLM account is updated. They want to achieve this by only updating a configuration file, without code changes or redeployment.

**Why this priority**: Ensures smooth migration path and operational flexibility. Allows operators to respond quickly to NotebookLM UI changes.

**Independent Test**: Can be fully tested by changing a workspace's UI version setting in the configuration file, restarting the bot, and verifying that the bot now uses the correct UI selectors for that workspace.

**Acceptance Scenarios**:

1. **Given** workspace ws1 is using old UI, **When** operator updates the UI version in configuration file and restarts the bot, **Then** the workspace operates with new UI selectors
2. **Given** configuration file specifies UI version per workspace, **When** bot initializes, **Then** each workspace loads the appropriate UI interaction logic
3. **Given** multiple workspaces with different UI versions, **When** bot handles concurrent requests, **Then** each request uses the correct UI version without interference

---

### User Story 4 - UI Investigation and Validation (Priority: P3)

A developer needs to investigate the DOM structure of both old and new NotebookLM UIs to determine the correct selectors and interaction patterns for implementation.

**Why this priority**: This is a development-phase activity that enables the other stories. While important, it's lower priority than the actual functionality.

**Independent Test**: Can be tested by using browser developer tools to analyze both UI versions, documenting the differences, and creating a selector mapping that covers all required interactions.

**Acceptance Scenarios**:

1. **Given** access to both old and new NotebookLM UIs, **When** developer inspects DOM using browser developer tools, **Then** all interactive elements are documented with element name, CSS selector, action type, and expected result
2. **Given** documented selector mappings for both UIs, **When** implementation begins, **Then** developers have detailed interaction steps for each UI element
3. **Given** selector differences between UIs, **When** creating abstraction layer, **Then** all interaction points are covered by version-specific logic with documented expected behaviors

---

### Edge Cases

- What happens when a workspace's UI version setting doesn't match the actual NotebookLM account UI? → Request fails immediately with error message to Slack user indicating mismatch and suggesting configuration update
- How does the system handle a workspace where the UI version is not explicitly configured? → Defaults to old UI version
- What happens when NotebookLM updates to a third UI version in the future?
- How does the system behave when DOM selectors for one UI version fail during runtime? → Request fails with error message to Slack user
- What happens when configuration file is malformed or missing UI version settings? → Bot refuses to start and exits with error code
- How does the system handle race conditions when multiple workspaces with different UI versions process requests simultaneously? → Separate browser instances/Playwright contexts per workspace ensure complete isolation

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST support workspace-specific UI version configuration that can be set independently for each workspace
- **FR-002**: System MUST maintain separate DOM selector sets for old UI and new UI versions
- **FR-003**: System MUST load the correct UI selector set based on workspace configuration at runtime
- **FR-004**: System MUST allow UI version configuration to be changed through configuration file updates only, without code changes
- **FR-005**: System MUST persist UI version settings across bot restarts
- **FR-006**: System MUST handle requests from multiple workspaces with different UI versions concurrently without interference using separate browser instances/Playwright contexts per workspace
- **FR-007**: System MUST validate UI version configuration on startup and refuse to start with error code if configuration is malformed or contains invalid UI version settings
- **FR-008**: System MUST default to old UI version when workspace configuration doesn't specify one (maintains backward compatibility)
- **FR-009**: System MUST log which UI version is being used for each request for debugging purposes
- **FR-010**: System MUST fail the request immediately when configured UI version's selectors don't match the actual NotebookLM interface, sending an error message to the Slack user
- **FR-011**: System MUST provide clear error messages to Slack users when UI interaction fails, indicating which UI version was attempted and suggesting configuration update
- **FR-012**: Investigation process MUST produce detailed documentation mapping each UI interaction (element name, CSS selector, action type, expected result) for both old and new UIs before implementation

### Key Entities

- **UI Version Configuration**: Workspace-specific setting that determines which NotebookLM UI version the bot should expect (old or new)
- **UI Selector Set**: Collection of DOM selectors and interaction logic specific to one UI version
- **Workspace Context**: Runtime context that includes the active UI version for processing requests

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Bot successfully processes requests for workspaces using old UI without errors (100% success rate)
- **SC-002**: Bot successfully processes requests for workspaces using new UI without errors (100% success rate)
- **SC-003**: Operators can migrate a workspace from old UI to new UI configuration in under 2 minutes by editing configuration file only
- **SC-004**: Bot handles concurrent requests from workspaces with different UI versions without cross-contamination (100% isolation)
- **SC-005**: Configuration changes take effect within one bot restart cycle (under 30 seconds)
- **SC-006**: Investigation phase produces complete detailed selector documentation (element name, CSS selector, action type, expected result) covering all interaction points for both UIs before implementation begins
- **SC-007**: Error messages clearly indicate which UI version failed and why, reducing troubleshooting time by 80%

## Assumptions

- Both old and new NotebookLM UIs are functionally equivalent (same capabilities, just different DOM structure)
- UI version is stable per account and doesn't change mid-session
- Workspace configuration is stored in environment files or similar persistent configuration
- The bot has access to browser automation tools capable of DOM inspection and interaction
- Operators have file system access to modify configuration files
- Configuration changes require bot restart to take effect (graceful restart is acceptable)
- Old UI will remain available for some transition period (not immediately deprecated)
- DOM structure within each UI version is relatively stable between minor updates
- Investigation can be performed using standard browser developer tools
- The bot already has workspace isolation mechanisms in place (AsyncLocalStorage as noted in CLAUDE.md)
- Each workspace uses a separate browser instance/Playwright context for isolation (existing architecture)

## Scope Limitations

### In Scope

- Support for exactly two UI versions (current old UI and new UI)
- Workspace-level UI version configuration
- Configuration file-based settings (no database changes required)
- DOM analysis and documentation for both UI versions
- Error handling and logging for UI version mismatches
- Concurrent multi-workspace operation with different UI versions

### Out of Scope

- Automatic UI version detection (configuration must be explicit)
- Support for more than two UI versions simultaneously
- UI version migration automation (manual configuration update required)
- Backward compatibility with previous bot versions
- UI version setting via Slack commands or web interface
- Rollback mechanisms if new UI selectors fail
- Performance optimization for UI interaction speed
- Cross-workspace UI version synchronization
- Real-time configuration updates without restart

## Dependencies

- Existing workspace isolation using AsyncLocalStorage (as documented in CLAUDE.md)
- Playwright browser automation framework (already in use)
- Chrome DevTools or equivalent for DOM analysis
- Environment configuration system for workspace settings
- Existing bot restart procedures
- Access to accounts with both old and new NotebookLM UIs for testing

## Open Questions

None - all critical aspects have reasonable defaults or can be inferred from existing system architecture.
