import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { StockWidget } from '../StockWidget'
import { SettingsProvider } from '../../lib/useSettings'
import { DEFAULT_SETTINGS, saveSettings } from '../../lib/settings'

function quoteResponse(symbol: string, price: number) {
  const todayOpen = Math.floor(Date.now() / 1000) - 3600
  return {
    ok: true,
    json: async () => ({
      chart: {
        result: [
          {
            meta: {
              symbol,
              longName: `${symbol} Inc.`,
              currency: 'USD',
              regularMarketPrice: price,
              regularMarketTime: todayOpen + 1800,
              currentTradingPeriod: { regular: { start: todayOpen, end: todayOpen + 6.5 * 3600 } },
            },
            timestamp: [todayOpen - 86_400, todayOpen],
            indicators: { quote: [{ close: [price - 1, price] }] },
          },
        ],
        error: null,
      },
    }),
  }
}

function renderStocks(symbols: string[]) {
  saveSettings({ ...DEFAULT_SETTINGS, stockSymbols: symbols })
  return render(
    <SettingsProvider>
      <StockWidget />
    </SettingsProvider>,
  )
}

describe('StockWidget behaviour', () => {
  beforeEach(() => localStorage.clear())
  afterEach(() => {
    vi.unstubAllGlobals()
    localStorage.clear()
  })

  it('shows the symbols that loaded when another one fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) =>
        decodeURIComponent(String(input)).includes('/chart/MSFT') ? { ok: false, json: async () => ({}) } : quoteResponse('AAPL', 200),
      ),
    )
    renderStocks(['AAPL', 'MSFT'])

    expect(await screen.findByText(/\$200\.00/)).toBeInTheDocument()
    expect(screen.getByText('Could not load stock data.')).toBeInTheDocument()
  })

  it('keeps the last quote when a refresh fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce(quoteResponse('AAPL', 200)).mockResolvedValue({ ok: false, json: async () => ({}) }),
    )
    renderStocks(['AAPL'])
    expect(await screen.findByText(/\$200\.00/)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Refresh stock quotes' }))

    await waitFor(() => expect(screen.getByText(/couldn.t refresh/i)).toBeInTheDocument())
    expect(screen.getByText(/\$200\.00/)).toBeInTheDocument()
  })
})
