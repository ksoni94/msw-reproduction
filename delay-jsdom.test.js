/**
 * Reproduction: msw's delay("infinite") throws in jest-environment-jsdom
 *
 * In msw v2.12.11, hasRefCounted() was added to delay(). It calls
 * Reflect.get(timeoutId, "ref") on the return value of setTimeout.
 *
 * In jsdom, setTimeout returns a number (browser spec), not a Node.js
 * Timeout object. Reflect.get() on a primitive throws TypeError.
 *
 * This causes delay("infinite") to reject instead of hanging, which
 * breaks any msw handler that uses delay("infinite") to simulate a
 * pending request (e.g. for testing loading states).
 *
 * The functions below are copied from msw v2.12.14 source:
 * - hasRefCounted: src/core/utils/internal/hasRefCounted.ts
 * - delay: src/core/delay.ts
 */

// From msw/src/core/utils/internal/hasRefCounted.ts
function hasRefCounted(value) {
  return (
    typeof Reflect.get(value, "ref") === "function" &&
    typeof Reflect.get(value, "unref") === "function"
  );
}

// From msw/src/core/delay.ts (simplified to just the "infinite" path)
const SET_TIMEOUT_MAX_ALLOWED_INT = 2147483647;

function delay() {
  const delayTime = SET_TIMEOUT_MAX_ALLOWED_INT;
  return new Promise((resolve) => {
    const timeoutId = setTimeout(resolve, delayTime);
    if (delayTime === SET_TIMEOUT_MAX_ALLOWED_INT && hasRefCounted(timeoutId)) {
      timeoutId.unref();
    }
  });
}

// --- Tests ---

it("jsdom's setTimeout returns a number, not a Node.js Timeout object", () => {
  const id = setTimeout(() => {}, 0);
  expect(typeof id).toBe("number");
  clearTimeout(id);
});

it("Reflect.get() throws on a primitive", () => {
  expect(() => Reflect.get(42, "ref")).toThrow(TypeError);
});

it("delay('infinite') rejects instead of hanging", async () => {
  await expect(delay()).rejects.toThrow("Reflect.get called on non-object");
});
