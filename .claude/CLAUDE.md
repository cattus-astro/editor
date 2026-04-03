
You are an expert in TypeScript, Angular, and scalable web application development. You write functional, maintainable, performant, and accessible code following Angular and TypeScript best practices.

## Before starting work

- **Plan first**: Write a plan to `.claude/tasks/TASK_NAME.md` with detailed implementation steps, reasoning, and broken-down tasks. Think MVP — don't over-plan.
- **Wait for approval**: Ask me to review the plan first. Do not continue until I approve.

## While implementing

- **Update the plan**: Keep the plan file up to date as you work. After completing tasks, append detailed descriptions of changes for handover.
- **External docs**: Always use Context7 MCP for external library/API documentation, code generation, or setup steps without me having to explicitly ask.
- **Token reporting**: After completing a task, report how many tokens you used.
- **Task cleanup**: Delete the created task file only after obtaining my explicit confirmation.
- **Subagent token savings**: When target files are known and few, use Read(offset/limit) directly instead of Explore subagent. Never re-read files already returned by a subagent.
- **Explore agent usage**: Only use when the search target is unclear or broad codebase exploration is needed. If API names, type names, or file locations can be inferred, use Grep/Glob directly.
- **Minimize file reads**: For files over 500 lines, use `offset/limit` to read only the needed sections (imports, specific methods, etc.). For reference files, use Grep to check patterns instead of reading the entire file.
- **No unnecessary file reads**: Do not read files that are not direct modification targets (routes, configs, etc.) unless specific information is needed from them.

## TypeScript Best Practices

- Use strict type checking
- Prefer type inference when the type is obvious
- Avoid the `any` type; use `unknown` when type is uncertain

## Angular Best Practices

- Always use standalone components over NgModules
- Must NOT set `standalone: true` inside Angular decorators. It's the default in Angular v20+.
- Use signals for state management
- Implement lazy loading for feature routes
- Do NOT use the `@HostBinding` and `@HostListener` decorators. Put host bindings inside the `host` object of the `@Component` or `@Directive` decorator instead
- Use `NgOptimizedImage` for all static images.
  - `NgOptimizedImage` does not work for inline base64 images.

## Accessibility Requirements

- It MUST pass all AXE checks.
- It MUST follow all WCAG AA minimums, including focus management, color contrast, and ARIA attributes.

### Components

- Keep components small and focused on a single responsibility
- Use `input()` and `output()` functions instead of decorators
- Use `computed()` for derived state
- Set `changeDetection: ChangeDetectionStrategy.OnPush` in `@Component` decorator
- Prefer inline templates for small components
- Prefer Reactive forms instead of Template-driven ones
- Do NOT use `ngClass`, use `class` bindings instead
- Do NOT use `ngStyle`, use `style` bindings instead
- When using external templates/styles, use paths relative to the component TS file.

## State Management

- Use signals for local component state
- Use `computed()` for derived state
- Keep state transformations pure and predictable
- Do NOT use `mutate` on signals, use `update` or `set` instead

## Templates

- Keep templates simple and avoid complex logic
- Use native control flow (`@if`, `@for`, `@switch`) instead of `*ngIf`, `*ngFor`, `*ngSwitch`
- Use the async pipe to handle observables
- Do not assume globals like (`new Date()`) are available.

## Services

- Design services around a single responsibility
- Use the `providedIn: 'root'` option for singleton services
- Use the `inject()` function instead of constructor injection
