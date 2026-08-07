import { useState } from "react";
import { useSettings } from "../lib/useSettings";
import { useWidgetVisibility } from "../lib/useWidgetVisibility";
import {
  DEFAULT_CALENDAR_COLORS,
  DEFAULT_CUSTOM_COLORS,
  FONT_PRESET_OPTIONS,
  type CalendarFeed,
  type Theme,
  type ColorScheme,
  type CustomColors,
  type WeatherUnitSystem,
} from "../lib/settings";
import {
  Globe,
  Monitor,
  Zap,
  Leaf,
  Waves,
  Palette,
  Type,
  Sun,
  Moon,
  SunMoon,
  X,
  Plus,
  Trash2,
  Eye,
  EyeOff,
} from "lucide-react";
import styles from "./SettingsDialog.module.css";

const THEMES: { id: Theme; label: string; icon: React.ReactNode }[] = [
  { id: "default", label: "Default", icon: <Globe size={16} /> },
  { id: "retro", label: "Retro", icon: <Monitor size={16} /> },
  { id: "futuristic", label: "Futuristic", icon: <Zap size={16} /> },
  { id: "nature", label: "Nature", icon: <Leaf size={16} /> },
  { id: "ocean", label: "Ocean", icon: <Waves size={16} /> },
  { id: "sunset", label: "Sunset", icon: <Palette size={16} /> },
  { id: "custom", label: "Custom", icon: <Palette size={16} /> },
];

const COLOR_SCHEMES: {
  id: ColorScheme;
  label: string;
  icon: React.ReactNode;
}[] = [
  { id: "system", label: "System", icon: <SunMoon size={14} /> },
  { id: "light", label: "Light", icon: <Sun size={14} /> },
  { id: "dark", label: "Dark", icon: <Moon size={14} /> },
];

const WEATHER_UNITS: { id: WeatherUnitSystem; label: string }[] = [
  { id: "metric", label: "Metric" },
  { id: "imperial", label: "Imperial" },
];

const WIDGETS: {
  id: "clock" | "weather" | "calendar" | "timer" | "tasks";
  label: string;
}[] = [
  { id: "clock", label: "Clock" },
  { id: "weather", label: "Weather" },
  { id: "calendar", label: "Calendar" },
  { id: "timer", label: "Timer" },
  { id: "tasks", label: "Tasks" },
];

interface Props {
  onClose: () => void;
}

export function SettingsDialog({ onClose }: Props) {
  const { settings, updateSettings } = useSettings();
  const { visibility, toggleWidget } = useWidgetVisibility();
  const [calendarFeeds, setCalendarFeeds] = useState<CalendarFeed[]>(
    settings.calendarFeeds.length > 0
      ? settings.calendarFeeds
      : [{ url: "", color: DEFAULT_CALENDAR_COLORS[0] }],
  );
  const [weatherRefreshMin, setWeatherRefreshMin] = useState(
    settings.weatherRefreshMinutes,
  );
  const [weatherUnitSystem, setWeatherUnitSystem] = useState<WeatherUnitSystem>(
    settings.weatherUnitSystem,
  );
  const [weatherShowExtraDetails, setWeatherShowExtraDetails] = useState(
    settings.weatherShowExtraDetails,
  );
  const [showBuyMeACoffeeWidget, setShowBuyMeACoffeeWidget] = useState(
    settings.showBuyMeACoffeeWidget,
  );
  const [calendarHidePastEvents, setCalendarHidePastEvents] = useState(
    settings.calendarHidePastEvents,
  );
  const [calendarShowAllDayEvents, setCalendarShowAllDayEvents] = useState(
    settings.calendarShowAllDayEvents,
  );
  const [workMin, setWorkMin] = useState(settings.pomodoroWorkMinutes);
  const [breakMin, setBreakMin] = useState(settings.pomodoroBreakMinutes);
  const [customColors, setCustomColors] = useState<CustomColors>(
    settings.customColors || DEFAULT_CUSTOM_COLORS,
  );

  const updateCalendarFeed = (index: number, patch: Partial<CalendarFeed>) => {
    setCalendarFeeds((prev) =>
      prev.map((calendarFeed, currentIndex) =>
        currentIndex === index ? { ...calendarFeed, ...patch } : calendarFeed,
      ),
    );
  };

  const addCalendarFeed = () => {
    setCalendarFeeds((prev) => [
      ...prev,
      {
        url: "",
        color:
          DEFAULT_CALENDAR_COLORS[prev.length % DEFAULT_CALENDAR_COLORS.length],
      },
    ]);
  };

  const removeCalendarFeed = (index: number) => {
    setCalendarFeeds((prev) => {
      const next = prev.filter(
        (_calendarFeed, currentIndex) => currentIndex !== index,
      );
      return next.length > 0
        ? next
        : [{ url: "", color: DEFAULT_CALENDAR_COLORS[0] }];
    });
  };

  const save = () => {
    updateSettings({
      calendarFeeds,
      weatherRefreshMinutes: weatherRefreshMin,
      weatherUnitSystem,
      weatherShowExtraDetails,
      showBuyMeACoffeeWidget,
      calendarHidePastEvents,
      calendarShowAllDayEvents,
      pomodoroWorkMinutes: workMin,
      pomodoroBreakMinutes: breakMin,
      ...(settings.theme === "custom" && { customColors }),
    });
    onClose();
  };

  return (
    <div
      className={styles.backdrop}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-label="Settings"
      >
        <div className={styles.header}>
          <h2 className={styles.title}>Settings</h2>
          <button
            className={styles.close}
            onClick={onClose}
            aria-label="Close settings"
          >
            <X size={16} />
          </button>
        </div>

        <div className={styles.body}>
          {/* Theme */}
          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>Theme</h3>
            <div className={styles.themeGrid}>
              {THEMES.map((t) => (
                <button
                  key={t.id}
                  className={[
                    styles.themeSwatch,
                    settings.theme === t.id ? styles.themeActive : "",
                  ].join(" ")}
                  onClick={() => updateSettings({ theme: t.id })}
                  aria-pressed={settings.theme === t.id}
                >
                  <span className={styles.themeEmoji}>{t.icon}</span>
                  <span className={styles.themeLabel}>{t.label}</span>
                </button>
              ))}
            </div>
          </section>

          {/* Appearance */}
          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>Appearance</h3>
            <div className={styles.segmented}>
              {COLOR_SCHEMES.map((s) => (
                <button
                  key={s.id}
                  className={[
                    styles.segment,
                    settings.colorScheme === s.id ? styles.segmentActive : "",
                  ].join(" ")}
                  onClick={() => updateSettings({ colorScheme: s.id })}
                  aria-pressed={settings.colorScheme === s.id}
                >
                  {s.icon}
                  {s.label}
                </button>
              ))}
            </div>
          </section>

          {/* Fonts */}
          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>Fonts</h3>
            <div className={styles.fontGrid}>
              {FONT_PRESET_OPTIONS.map((fontOption) => (
                <button
                  key={fontOption.id}
                  className={[
                    styles.fontSwatch,
                    settings.fontPreset === fontOption.id
                      ? styles.fontActive
                      : "",
                  ].join(" ")}
                  onClick={() => updateSettings({ fontPreset: fontOption.id })}
                  aria-pressed={settings.fontPreset === fontOption.id}
                >
                  <span className={styles.fontIcon}>
                    <Type size={14} />
                  </span>
                  <span
                    className={styles.fontLabel}
                    style={{ fontFamily: fontOption.fontFamily }}
                  >
                    {fontOption.label}
                  </span>
                </button>
              ))}
            </div>
          </section>

          {/* Custom Colors (shown when custom theme is selected) */}
          {settings.theme === "custom" && (
            <section className={styles.section}>
              <h3 className={styles.sectionTitle}>Custom Colors</h3>
              <div className={styles.colorPickerGrid}>
                <div className={styles.colorInputGroup}>
                  <label className={styles.colorLabel}>
                    Primary Color
                    <div className={styles.colorInputWrapper}>
                      <input
                        type="color"
                        className={styles.colorInput}
                        value={customColors.primary}
                        onChange={(e) =>
                          setCustomColors({
                            ...customColors,
                            primary: e.target.value,
                          })
                        }
                      />
                      <span className={styles.colorValue}>
                        {customColors.primary}
                      </span>
                    </div>
                  </label>
                </div>
                <div className={styles.colorInputGroup}>
                  <label className={styles.colorLabel}>
                    Hover Color
                    <div className={styles.colorInputWrapper}>
                      <input
                        type="color"
                        className={styles.colorInput}
                        value={customColors.primaryHover}
                        onChange={(e) =>
                          setCustomColors({
                            ...customColors,
                            primaryHover: e.target.value,
                          })
                        }
                      />
                      <span className={styles.colorValue}>
                        {customColors.primaryHover}
                      </span>
                    </div>
                  </label>
                </div>
                <div className={styles.colorInputGroup}>
                  <label className={styles.colorLabel}>
                    Background Color
                    <div className={styles.colorInputWrapper}>
                      <input
                        type="color"
                        className={styles.colorInput}
                        value={customColors.background}
                        onChange={(e) =>
                          setCustomColors({
                            ...customColors,
                            background: e.target.value,
                          })
                        }
                      />
                      <span className={styles.colorValue}>
                        {customColors.background}
                      </span>
                    </div>
                  </label>
                </div>
                <div className={styles.colorInputGroup}>
                  <label className={styles.colorLabel}>
                    Font Color
                    <div className={styles.colorInputWrapper}>
                      <input
                        type="color"
                        className={styles.colorInput}
                        value={customColors.fontColor}
                        onChange={(e) =>
                          setCustomColors({
                            ...customColors,
                            fontColor: e.target.value,
                          })
                        }
                      />
                      <span className={styles.colorValue}>
                        {customColors.fontColor}
                      </span>
                    </div>
                  </label>
                </div>
                <div className={styles.colorInputGroup}>
                  <label className={styles.colorLabel}>
                    Secondary Font Color
                    <div className={styles.colorInputWrapper}>
                      <input
                        type="color"
                        className={styles.colorInput}
                        value={customColors.secondaryFontColor}
                        onChange={(e) =>
                          setCustomColors({
                            ...customColors,
                            secondaryFontColor: e.target.value,
                          })
                        }
                      />
                      <span className={styles.colorValue}>
                        {customColors.secondaryFontColor}
                      </span>
                    </div>
                  </label>
                </div>
              </div>
              <p className={styles.hint}>
                Choose your custom accent colors, background, and font colors.
                They will be applied to buttons, links, interactive elements,
                and text throughout the app.
              </p>
            </section>
          )}

          {/* Widgets */}
          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>Widgets</h3>
            <div className={styles.widgetGrid}>
              {WIDGETS.map((widget) => (
                <button
                  key={widget.id}
                  className={[
                    styles.widgetToggle,
                    visibility[widget.id] ? styles.widgetVisible : "",
                  ].join(" ")}
                  onClick={() => toggleWidget(widget.id)}
                  title={`Toggle ${widget.label} widget`}
                >
                  {visibility[widget.id] ? (
                    <Eye size={14} />
                  ) : (
                    <EyeOff size={14} />
                  )}
                  <span>{widget.label}</span>
                </button>
              ))}
            </div>
          </section>

          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>Support</h3>
            <div className={styles.widgetGrid}>
              <button
                className={[
                  styles.widgetToggle,
                  showBuyMeACoffeeWidget ? styles.widgetVisible : "",
                ].join(" ")}
                onClick={() => setShowBuyMeACoffeeWidget((value) => !value)}
                type="button"
              >
                {showBuyMeACoffeeWidget ? (
                  <Eye size={14} />
                ) : (
                  <EyeOff size={14} />
                )}
                <span>Show Buy Me a Coffee button</span>
              </button>
            </div>
            <p className={styles.hint}>
              Hide the floating support button anytime without affecting the
              rest of your layout.
            </p>
          </section>

          {/* Calendar */}
          <section className={styles.section}>
            <div className={styles.sectionHeader}>
              <h3 className={styles.sectionTitle}>Calendar Feeds</h3>
              <button
                className={styles.addCalendarBtn}
                onClick={addCalendarFeed}
                type="button"
              >
                <Plus size={14} />
                Add link
              </button>
            </div>
            <p className={styles.hint}>
              Paste one or more ICS or CSV calendar URLs. Google share links,
              Outlook published calendar links, and webcal:// feeds are
              supported too. Choose a color for each calendar and its events
              will use that color in the calendar widget.
            </p>
            <div className={styles.calendarList}>
              {calendarFeeds.map((calendarFeed, index) => (
                <div className={styles.calendarRow} key={index}>
                  <input
                    className={[styles.input, styles.calendarUrlInput].join(
                      " ",
                    )}
                    type="url"
                    placeholder={
                      index === 0
                        ? "https://calendar.example.com/feed.ics"
                        : "https://outlook.office.com/calendar/.../calendar.ics"
                    }
                    value={calendarFeed.url}
                    onChange={(e) =>
                      updateCalendarFeed(index, { url: e.target.value })
                    }
                  />
                  <label className={styles.calendarColorField}>
                    <span className={styles.calendarColorLabel}>Color</span>
                    <input
                      aria-label={`Calendar color ${index + 1}`}
                      className={styles.calendarColorInput}
                      type="color"
                      value={calendarFeed.color}
                      onChange={(e) =>
                        updateCalendarFeed(index, { color: e.target.value })
                      }
                    />
                  </label>
                  <button
                    aria-label={`Remove calendar link ${index + 1}`}
                    className={styles.removeCalendarBtn}
                    onClick={() => removeCalendarFeed(index)}
                    type="button"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          </section>

          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>Calendar Display</h3>
            <div className={styles.widgetGrid}>
              <button
                className={[
                  styles.widgetToggle,
                  calendarHidePastEvents ? styles.widgetVisible : "",
                ].join(" ")}
                onClick={() => setCalendarHidePastEvents((value) => !value)}
                type="button"
              >
                {calendarHidePastEvents ? (
                  <EyeOff size={14} />
                ) : (
                  <Eye size={14} />
                )}
                <span>Show past events</span>
              </button>
              <button
                className={[
                  styles.widgetToggle,
                  calendarShowAllDayEvents ? styles.widgetVisible : "",
                ].join(" ")}
                onClick={() => setCalendarShowAllDayEvents((value) => !value)}
                type="button"
              >
                {calendarShowAllDayEvents ? (
                  <Eye size={14} />
                ) : (
                  <EyeOff size={14} />
                )}
                <span>Show all-day events</span>
              </button>
            </div>
          </section>

          {/* Pomodoro */}
          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>Weather Refresh</h3>
            <div className={styles.intervalRow}>
              <label className={styles.intervalLabel}>
                Refresh every (min)
                <input
                  className={styles.numberInput}
                  type="number"
                  min={1}
                  max={180}
                  value={weatherRefreshMin}
                  onChange={(e) =>
                    setWeatherRefreshMin(
                      Math.max(1, parseInt(e.target.value) || 1),
                    )
                  }
                />
              </label>
            </div>
            <p className={styles.hint}>
              Weather updates automatically using this interval. You can still
              refresh it manually anytime.
            </p>
          </section>

          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>Weather Display</h3>
            <div className={styles.segmented}>
              {WEATHER_UNITS.map((unit) => (
                <button
                  key={unit.id}
                  className={[
                    styles.segment,
                    weatherUnitSystem === unit.id ? styles.segmentActive : "",
                  ].join(" ")}
                  onClick={() => setWeatherUnitSystem(unit.id)}
                  aria-pressed={weatherUnitSystem === unit.id}
                  type="button"
                >
                  {unit.label}
                </button>
              ))}
            </div>
            <div className={styles.widgetGrid}>
              <button
                className={[
                  styles.widgetToggle,
                  weatherShowExtraDetails ? styles.widgetVisible : "",
                ].join(" ")}
                onClick={() => setWeatherShowExtraDetails((value) => !value)}
                type="button"
              >
                {weatherShowExtraDetails ? (
                  <Eye size={14} />
                ) : (
                  <EyeOff size={14} />
                )}
                <span>Show extra weather details</span>
              </button>
            </div>
          </section>

          {/* Pomodoro */}
          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>Pomodoro Intervals</h3>
            <div className={styles.intervalRow}>
              <label className={styles.intervalLabel}>
                Work (min)
                <input
                  className={styles.numberInput}
                  type="number"
                  min={1}
                  max={120}
                  value={workMin}
                  onChange={(e) =>
                    setWorkMin(Math.max(1, parseInt(e.target.value) || 1))
                  }
                />
              </label>
              <label className={styles.intervalLabel}>
                Break (min)
                <input
                  className={styles.numberInput}
                  type="number"
                  min={1}
                  max={60}
                  value={breakMin}
                  onChange={(e) =>
                    setBreakMin(Math.max(1, parseInt(e.target.value) || 1))
                  }
                />
              </label>
            </div>
          </section>
        </div>

        <div className={styles.footer}>
          <button className={styles.btnGhost} onClick={onClose}>
            Cancel
          </button>
          <button className={styles.btnPrimary} onClick={save}>
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
