# AI Adaptive Thinking Request Shape

Anthropic adaptive thinking accepts `thinking: { type: 'adaptive' }`.

Reasoning effort is sent as `output_config.effort`, not inside the `thinking` object. Keeping effort out of `thinking` avoids API 400 responses such as:

```text
thinking.adaptive.effort: Extra inputs are not permitted
```

This note documents the Sprint 14 admin connection-test fix.
