# Context

## Why not a Settings toggle

Every other row in the card maps to a `Settings` key in `chrome.storage.sync`, which is
what makes them apply everywhere and persist. That is precisely wrong for this one: the
request is "get out of *this* tab", and a synced setting cannot express per-tab state at
all. So this row is deliberately outside the settings model — a `SettingsCallbacks`
method (`onHideUntilRestart`) rather than an `onChange` patch, and a `data-action`
attribute rather than `data-setting`.

## Why sessionStorage over the alternatives

- **A `chrome.tabs`-scoped flag** would need the background worker to track tab identity
  and message the content script — more moving parts for a UI nicety, and it would not
  survive a reload without extra bookkeeping.
- **An in-memory flag** would not survive a reload, and "until restart" is meant to
  outlast F5.
- **`sessionStorage`** is per-tab, reload-surviving and auto-clearing on close with no
  code — the semantics fall out of the platform.

The read is wrapped in try/catch: `sessionStorage` throws in a sandboxed iframe or with
storage disabled, and the honest fallback there is "not hidden".

## Interaction with the rest of the overlay

Hiding sets `display: none` on the shadow host, so nothing inside it renders or
hit-tests — the same host `createUiRoot` builds. It does not tear down state; a reload
rebuilds from the flag rather than restoring a torn-down tree. The card node lingers in
the hidden host until its normal lifecycle removes it, which is why the e2e assertion
checks visibility rather than DOM count — a hidden node still counts.

## Why there is no un-hide path in the tab

Considered and rejected. A visible "show again" affordance contradicts the feature — the
tab is supposed to look extension-free. The popup could offer it, but the popup already
has an inspect toggle, and wiring un-hide there means the content script has to accept an
"unhide" message and re-show, which is more surface than the feature earns. Closing the
tab is the documented way back; devtools clears the key for anyone who needs it sooner.
