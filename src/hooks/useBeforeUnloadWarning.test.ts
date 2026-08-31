import { describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { useBeforeUnloadWarning } from "@/hooks/useBeforeUnloadWarning";

describe("useBeforeUnloadWarning", () => {
  it("registers beforeunload when enabled and removes it on cleanup", () => {
    const addSpy = vi.spyOn(window, "addEventListener");
    const removeSpy = vi.spyOn(window, "removeEventListener");

    const { unmount } = renderHook(() =>
      useBeforeUnloadWarning(true, "Custom message"),
    );

    expect(addSpy).toHaveBeenCalledWith(
      "beforeunload",
      expect.any(Function),
    );

    unmount();

    expect(removeSpy).toHaveBeenCalledWith(
      "beforeunload",
      expect.any(Function),
    );
  });

  it("does not register the listener when disabled", () => {
    const addSpy = vi.spyOn(window, "addEventListener");
    const removeSpy = vi.spyOn(window, "removeEventListener");

    const { rerender } = renderHook(
      ({ isEnabled }: { isEnabled: boolean }) =>
        useBeforeUnloadWarning(isEnabled, "msg"),
      { initialProps: { isEnabled: false } },
    );

    expect(addSpy).not.toHaveBeenCalled();

    rerender({ isEnabled: true });
    expect(addSpy).toHaveBeenCalledTimes(1);

    removeSpy.mockClear();
    addSpy.mockClear();

    rerender({ isEnabled: false });

    expect(removeSpy).toHaveBeenCalledTimes(1);
  });

  it("prevents default and sets returnValue on the beforeunload event", () => {
    const addSpy = vi.spyOn(window, "addEventListener");

    renderHook(() => useBeforeUnloadWarning(true, "Please confirm"));

    const handler = addSpy.mock.calls.find(
      ([event]) => event === "beforeunload",
    )?.[1] as EventListener;

    expect(handler).toBeDefined();

    const event = new Event("beforeunload") as BeforeUnloadEvent;
    event.preventDefault = vi.fn();

    handler(event);

    expect(event.preventDefault).toHaveBeenCalled();
    expect(event.returnValue).toBe("Please confirm");
  });

  it("uses an empty string returnValue when no message is provided", () => {
    const addSpy = vi.spyOn(window, "addEventListener");

    renderHook(() => useBeforeUnloadWarning(true));

    const handler = addSpy.mock.calls.find(
      ([event]) => event === "beforeunload",
    )?.[1] as EventListener;

    const event = new Event("beforeunload") as BeforeUnloadEvent;
    event.preventDefault = vi.fn();

    handler(event);

    expect(event.preventDefault).toHaveBeenCalled();
    expect(event.returnValue).toBe("");
  });
});
