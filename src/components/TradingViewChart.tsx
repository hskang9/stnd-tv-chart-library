import { useEffect } from 'react'
import type { ResolutionString } from '../../public/tradingview/charting_library/charting_library'

import datafeed from '@/utils/datafeed'

const chartingLibraryPath = '/tradingview/charting_library/'

function TradingViewChart({
  symbol = 'IP/USDC',
  interval = '1H',
}: {
  symbol: string
  interval: ResolutionString
}) {
  useEffect(() => {
    if (typeof window !== 'undefined' && window.TradingView) {
      // Get the client's local timezone
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

      // biome-ignore lint/suspicious/noExplicitAny: <explanation>
      const widget = new (window.TradingView as { widget: any }).widget({
        container: 'tv_chart_container',
        locale: 'en',
        library_path: chartingLibraryPath,
        datafeed: datafeed,
        symbol,
        interval,
        fullscreen: false,
        debug: true,
        timezone,
        enabled_features: ['show_exchange_logos'],
        disabled_features: ['volume_force_overlay'], // This line disables the volume overlay
        theme: 'dark',
        overrides: {
          'paneProperties.background': '#000000',
          'volumePaneSize': 'medium', // Adjust the size of the volume pane
        },
      })
      widget.onChartReady(() => {
        const chart = widget.activeChart()
        chart.createStudy(
          'Moving Average',
          false,
          false,
          { length: 7, source: 'close', offset: 0 },
          {
            'Plot.color': 'rgba(241, 156, 56, 0.7)',
          }
        )
        chart.createStudy(
          'Moving Average',
          false,
          false,
          { length: 25, source: 'close', offset: 0 },
          {
            'Plot.color': 'rgba(234, 61, 247, 0.7)',
          }
        )
        chart.createStudy(
          'Moving Average',
          false,
          false,
          { length: 99, source: 'close', offset: 0 },
          {
            'Plot.color': 'rgba(116, 252, 253, 0.7)',
          }
        ) 

        /*
        chart.getSeries().setChartStyleProperties(1, {
          upColor: '#E6DAFE',
          downColor: '#7142CF',
          borderUpColor: '#E6DAFE',
          borderDownColor: '#7142CF',
          wickUpColor: '#E4DADB',
          wickDownColor: '#E4DADB',
        })
        */
      })
    }
  }, [symbol, interval])

  return <div id="tv_chart_container" />
}

export default TradingViewChart
