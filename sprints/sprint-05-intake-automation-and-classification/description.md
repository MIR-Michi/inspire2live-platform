# Sprint 05 — Intake Automation & Classification

**Phase:** 2 draft backlog
**Status:** Not Started

## Goal

Replace the manual-only capture bottleneck with structured intake automation while keeping human review in control.

## Rationale

Sprint 04 proves the communications workflow operationally. The next highest-leverage step is reducing coordinator effort in the intake layer without sacrificing trust, auditability, or signal quality.

## Draft acceptance criteria

- WhatsApp Business API webhook lands raw inbound messages in the intake queue.
- Rule-based classification pre-fills content type, confidence, and Peter/founder signals.
- Manual coordinator correction remains available on every captured item.
- Classification corrections are reusable as system rules or training examples.
- Delivery notes from the Sprint 04 pilot are reflected in the intake workflow.
