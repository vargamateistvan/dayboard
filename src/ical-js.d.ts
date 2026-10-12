declare module 'ical.js' {
  export class Time {
    static fromJSDate(date: Date, useUTC?: boolean): Time
    isDate: boolean
    year: number
    month: number
    day: number
    hour: number
    minute: number
    second: number
    /** TZID kept when the feed has no VTIMEZONE for it. */
    timezone?: string
    toJSDate(): Date
    toString(): string
    convertToZone(zone: unknown): Time
  }

  export const TimezoneService: {
    has(tzid: string): boolean
  }

  export const Timezone: {
    utcTimezone: unknown
  }

  export class Component {
    constructor(data: unknown)
    getAllSubcomponents(name: string): Component[]
    getAllProperties(name?: string): Property[]
    getFirstProperty(name: string): Property | null
    getFirstPropertyValue(name: string): unknown
  }

  export class Event {
    constructor(component: Component)
    uid: string
    summary: string
    startDate: Time
    endDate: Time
    recurrenceId: Time | null
    isRecurring(): boolean
    isRecurrenceException(): boolean
    iterator(startTime?: Time): RecurExpansion
    getOccurrenceDetails(time: Time): OccurrenceDetails
    relateException(event: Event): void
    exceptions: Record<string, Event>
    component: Component
  }

  export class RecurExpansion {
    next(): Time | null
  }

  export class Property {
    getFirstValue(): unknown
    getValues(): unknown[]
    getParameter(name: string): string | null
  }

  export interface OccurrenceDetails {
    recurrenceId: Time
    startDate: Time
    endDate: Time
    item: Event
  }

  export function parse(input: string): unknown

  const ICAL: {
    Time: typeof Time
    Component: typeof Component
    Event: typeof Event
    TimezoneService: typeof TimezoneService
    Timezone: typeof Timezone
    parse: typeof parse
  }

  export default ICAL
}
