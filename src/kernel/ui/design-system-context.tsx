'use client'

import { createContext, useContext, type CSSProperties, type ReactNode } from 'react'
import { DEFAULT_DASHBOARD_DESIGN, type DashboardDesignConfig } from '@/kernel/dashboard'

const DesignSystemContext = createContext<DashboardDesignConfig>(DEFAULT_DASHBOARD_DESIGN)

export function useDesignSystem(): DashboardDesignConfig {
  return useContext(DesignSystemContext)
}

function radiusValue(radius: DashboardDesignConfig['radius']): string {
  if (radius === 'crisp') return '0.5rem'
  if (radius === 'soft') return '1.25rem'
  return '0.75rem'
}

function shadowValue(elevation: DashboardDesignConfig['elevation']): string {
  if (elevation === 'minimal') return '0 1px 2px rgb(15 23 42 / 0.04)'
  if (elevation === 'layered') return '0 12px 32px rgb(15 23 42 / 0.10)'
  return '0 4px 16px rgb(15 23 42 / 0.07)'
}

function motionValue(motion: DashboardDesignConfig['motion']): string {
  if (motion === 'calm') return '260ms'
  if (motion === 'expressive') return '160ms'
  return '210ms'
}

export function DesignSystemProvider({ config, children }: { config: DashboardDesignConfig; children: ReactNode }) {
  const style = {
    '--i2l-radius-card': radiusValue(config.radius),
    '--i2l-shadow-card': shadowValue(config.elevation),
    '--i2l-motion-standard': motionValue(config.motion),
    '--i2l-dashboard-gap': config.density === 'compact' ? '0.75rem' : '1rem',
  } as CSSProperties

  return (
    <DesignSystemContext.Provider value={config}>
      <div
        className="contents"
        style={style}
        data-dashboard-density={config.density}
        data-motion-profile={config.motion}
      >
        {children}
      </div>
    </DesignSystemContext.Provider>
  )
}
