# Plan

## File formats — decided per file, not once

The three kinds of file here take different formats, and only one of them is a choice.

| File | Format | Why |
|---|---|---|
| `PULL_REQUEST_TEMPLATE.md` | **`.md` — forced** | GitHub supports Markdown only for PR templates. There is no such thing as a PR form. |
| `ISSUE_TEMPLATE/config.yml` | **`.yml` — forced** | It is configuration, not content. |
| `ISSUE_TEMPLATE/*.yml` | **`.yml` — chosen** | See below. |
| `CONTRIBUTING.md`, `SECURITY.md` | **`.md`** | Prose GitHub renders and links from the issue and PR pages. |

### Why issue **forms** rather than Markdown templates

A Markdown issue template pre-fills the body with prompts the reporter is free to edit or
delete — and roughly half do delete them. A YAML form renders as real fields and can mark
one `required`.

That is the whole problem here. A bug report for this extension is close to useless
without four facts, and none of them occur to a reporter unprompted:

- the **version** — it is in the settings card footer, which nobody thinks to look at;
- the **install route** — an unpacked copy keeps running the old content script in
  already-open tabs, which looks exactly like the bug not being fixed;
- **dev or production build** — decides whether a missing source line is a bug at all;
- what the **stack badge** says, including *no badge* and *amber*, which are different
  answers.

A form makes the first four mandatory. A Markdown template makes them a suggestion.

The cost is real and accepted: forms are rigid. A reporter who wants to restructure their
report cannot, and there is no freeform body. Mitigated by giving each form a large first
textarea and a `render:`-typed field for pasted output.

## Structure

```
.github/
├── PULL_REQUEST_TEMPLATE.md
├── CONTRIBUTING.md
├── SECURITY.md
└── ISSUE_TEMPLATE/
    ├── config.yml               chooser: no blank issues, four contact links
    ├── bug_report.yml           bug + needs-triage
    ├── framework_detection.yml  framework + needs-triage
    └── feature_request.yml      enhancement + needs-triage
```

**Framework detection is its own form** rather than a section of the bug form. It needs
completely different fields — framework version, build type, badge text, build config,
and a console probe — and its most common outcomes are *upstream, not fixable* (React 19,
Angular) or *your build config* (tracer, sourcemaps). Mixing it into the bug form would
put six fields in front of every reporter that four fifths of them should skip.

## The PR template's job

Not to be a form — it is Markdown, so every box can be ticked without reading. Its job is
to put four things in front of someone at the moment they are about to get them wrong:

1. the commit subject is a release note;
2. a green tick is not a test run;
3. `docs/<task-slug>/` is expected;
4. three modules must not be informed by upstream `agentation`.

Conditional sections — *if you touched the UI*, *if you added an e2e block*, *if you
touched the manifest* — so the checklist stays short for the change that does none of
those.

## Labels

`framework` and `needs-triage` created; `bug`, `enhancement` reused. A form's `labels:`
are applied **only if the label already exists** — a name that does not is dropped with
no warning, which is a silent failure worth avoiding.
