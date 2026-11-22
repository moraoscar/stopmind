import fs from 'node:fs';
import path from 'node:path';

// Fixes Swift 6.2 strict concurrency error in expo-modules-jsi@58.0.23:
// "sending 'slot' risks causing data races" in JavaScriptObject.swift
const candidates = [
  path.resolve(
    process.cwd(),
    'node_modules/expo-modules-jsi/apple/Sources/ExpoModulesJSI/Runtime/Values/JavaScriptObject.swift'
  ),
  path.resolve(
    process.cwd(),
    'apps/mobile/node_modules/expo-modules-jsi/apple/Sources/ExpoModulesJSI/Runtime/Values/JavaScriptObject.swift'
  ),
];

const original = `    nonisolated(unsafe) let slot = buffer.baseAddress!
    expo.emplaceUndefined(slot)
    defer {
      expo.destroyValues(slot, 1)
    }
    // The runtime can't be deallocated during a call on its JavaScript thread, so it's borrowed without
    // a retain.
    try runtime._withUnsafeGuaranteedRef { runtime in
      try JavaScriptActor.assumeIsolated {
        try encode(JavaScriptValue.Slot(slot), runtime)
      }
    }
    body(slot.pointee)`;

const patched = `    let slot = UncheckedSendable(buffer.baseAddress!)
    expo.emplaceUndefined(slot.value)
    defer {
      expo.destroyValues(slot.value, 1)
    }
    // The runtime can't be deallocated during a call on its JavaScript thread, so it's borrowed without
    // a retain.
    try runtime._withUnsafeGuaranteedRef { runtime in
      try JavaScriptActor.assumeIsolated {
        try encode(JavaScriptValue.Slot(slot.value), runtime)
      }
    }
    body(slot.value.pointee)`;

for (const targetFile of candidates) {
  if (!fs.existsSync(targetFile)) continue;
  const content = fs.readFileSync(targetFile, 'utf8');
  if (content.includes(patched)) {
    console.log(`[patch-expo-jsi] Patch already applied (${targetFile}).`);
  } else if (content.includes(original)) {
    fs.writeFileSync(targetFile, content.replace(original, patched), 'utf8');
    console.log(`[patch-expo-jsi] Applied Swift 6.2 concurrency patch (${targetFile}).`);
  }
}
