import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { AstronomyWidget } from "../AstronomyWidget";
import { SettingsProvider } from "../../lib/useSettings";
import { DEFAULT_SETTINGS, saveSettings } from "../../lib/settings";

const mockGeolocation = {
  getCurrentPosition: vi.fn(),
};

beforeEach(() => {
  vi.stubGlobal("navigator", { geolocation: mockGeolocation });
  localStorage.clear();
});

afterEach(() => {
  localStorage.clear();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function renderWithSettings(settingsPatch: Partial<typeof DEFAULT_SETTINGS> = {}) {
  saveSettings({ ...DEFAULT_SETTINGS, ...settingsPatch });
  return render(
    <SettingsProvider>
      <AstronomyWidget />
    </SettingsProvider>,
  );
}

describe("AstronomyWidget", () => {
  it("shows loading state while fetching", () => {
    mockGeolocation.getCurrentPosition.mockImplementation(() => {
      // never resolves
    });
    renderWithSettings();
    expect(screen.getByLabelText("Loading astronomy")).toBeInTheDocument();
  });

  it("renders sun/moon times and moon phase after successful fetch", async () => {
    mockGeolocation.getCurrentPosition.mockImplementation((success: PositionCallback) => {
      success({ coords: { latitude: 47.5, longitude: 19.0 } } as GeolocationPosition);
    });

    vi.stubGlobal(
      "fetch",
      vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            timezone: "Europe/Budapest",
            utc_offset_seconds: 7200,
            daily: {
              sunrise: ["2026-08-15T05:52"],
              sunset: ["2026-08-15T19:49"],
              moonrise: ["2026-08-15T21:03"],
              moonset: ["2026-08-15T11:28"],
              moon_phase: [0.5],
            },
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            address: { city: "Budapest" },
          }),
        }),
    );

    renderWithSettings();
    await waitFor(() =>
      expect(screen.queryByLabelText("Loading astronomy")).not.toBeInTheDocument(),
    );

    expect(screen.getByText(/Budapest/)).toBeInTheDocument();
    expect(screen.getByText(/Sunrise/)).toBeInTheDocument();
    expect(screen.getByText(/05:52/)).toBeInTheDocument();
    expect(screen.getByText(/Sunset/)).toBeInTheDocument();
    expect(screen.getByText(/19:49/)).toBeInTheDocument();
    expect(screen.getByText(/Moonrise/)).toBeInTheDocument();
    expect(screen.getByText(/21:03/)).toBeInTheDocument();
    expect(screen.getByText(/Moonset/)).toBeInTheDocument();
    expect(screen.getByText(/11:28/)).toBeInTheDocument();
    expect(screen.getByText(/Full Moon · 100% illuminated/)).toBeInTheDocument();
    expect(screen.getAllByText("Time:").length).toBeGreaterThan(0);
    expect(screen.getByText("Percent Illuminated:")).toBeInTheDocument();
    expect(screen.getByText(/Updated just now/)).toBeInTheDocument();
  });

  it("uses manual coordinates when configured", async () => {
    mockGeolocation.getCurrentPosition.mockImplementation(() => {
      throw new Error("Geolocation should not be used");
    });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          timezone: "Europe/Budapest",
          utc_offset_seconds: 7200,
          daily: {
            sunrise: ["2026-08-15T05:52"],
            sunset: ["2026-08-15T19:49"],
            moonrise: ["2026-08-15T21:03"],
            moonset: ["2026-08-15T11:28"],
            moon_phase: [0.5],
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          address: { city: "Budapest" },
        }),
      });

    vi.stubGlobal("fetch", fetchMock);

    renderWithSettings({
      astronomyUseDeviceLocation: false,
      astronomyManualLatitude: "47.4979",
      astronomyManualLongitude: "19.0402",
    });
    await waitFor(() =>
      expect(screen.queryByLabelText("Loading astronomy")).not.toBeInTheDocument(),
    );

    expect(mockGeolocation.getCurrentPosition).not.toHaveBeenCalled();
    expect(fetchMock.mock.calls[0]?.[0]).toContain("latitude=47.4979");
    expect(fetchMock.mock.calls[0]?.[0]).toContain("longitude=19.0402");
  });

  it("shows error message when geolocation is denied", async () => {
    mockGeolocation.getCurrentPosition.mockImplementation(
      (_success: unknown, error: PositionErrorCallback) => {
        error({ code: 1, message: "denied" } as GeolocationPositionError);
      },
    );
    renderWithSettings();
    await waitFor(() =>
      expect(screen.queryByLabelText("Loading astronomy")).not.toBeInTheDocument(),
    );
    expect(screen.getByText(/Location access denied/)).toBeInTheDocument();
  });

  it("uses the configured refresh interval", () => {
    const setIntervalSpy = vi.spyOn(globalThis, "setInterval");
    mockGeolocation.getCurrentPosition.mockImplementation(() => {
      // no-op
    });

    renderWithSettings({ astronomyRefreshMinutes: 12 });

    expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 12 * 60 * 1000);
  });

  it("scrubs the chart to the hovered time and resets on mouse leave", async () => {
    mockGeolocation.getCurrentPosition.mockImplementation((success: PositionCallback) => {
      success({ coords: { latitude: 47.5, longitude: 19.0 } } as GeolocationPosition);
    });

    vi.stubGlobal(
      "fetch",
      vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            timezone: "Europe/Budapest",
            utc_offset_seconds: 7200,
            daily: {
              sunrise: ["2026-08-15T05:52"],
              sunset: ["2026-08-15T19:49"],
              moonrise: ["2026-08-15T21:03"],
              moonset: ["2026-08-15T11:28"],
              moon_phase: [0.5],
            },
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            address: { city: "Budapest" },
          }),
        }),
    );

    renderWithSettings();
    await waitFor(() =>
      expect(screen.queryByLabelText("Loading astronomy")).not.toBeInTheDocument(),
    );

    const sunChart = screen.getByRole("img", { name: /Sun altitude chart/ });
    vi.spyOn(sunChart, "getBoundingClientRect").mockReturnValue({
      x: 0,
      y: 0,
      left: 0,
      top: 0,
      right: 220,
      bottom: 50,
      width: 220,
      height: 50,
      toJSON: () => ({}),
    } as DOMRect);

    // clientX 110 maps to viewBox x=110 → minute 720 (12:00), which is daytime
    fireEvent.mouseMove(sunChart, { clientX: 110, clientY: 20 });
    expect(screen.getByText("12:00 · Day")).toBeInTheDocument();
    expect(screen.getByText("12:00")).toBeInTheDocument();
    expect(screen.getByText("Day")).toBeInTheDocument();

    fireEvent.mouseLeave(sunChart);
    expect(screen.queryByText("12:00 · Day")).not.toBeInTheDocument();
  });
});
