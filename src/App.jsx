/**
 * Application shell.
 *
 * The 3D scene fills the stage and the two instrument rails float over it,
 * both collapsible, so the scene is never more than one click from being
 * the whole screen. The right rail's contents change with the active tab;
 * the left rail -- selection, wind, transport -- stays put, because those
 * controls are relevant whatever you are looking at.
 */

import { useState } from 'react';

import WindTurbineScene from './components/scene/WindTurbineScene.jsx';
import TurbineSelector from './components/ui/TurbineSelector.jsx';
import WindControls from './components/ui/WindControls.jsx';
import EnergyDashboard from './components/ui/EnergyDashboard.jsx';
import TechnicalParameters from './components/ui/TechnicalParameters.jsx';
import ChartPanel from './components/ui/ChartPanel.jsx';
import TurbineComparison from './components/ui/TurbineComparison.jsx';
import TheoryPanel from './components/ui/TheoryPanel.jsx';
import { RotorMark, ChevronLeftIcon, ChevronRightIcon } from './components/ui/primitives.jsx';
import { useSimulation } from './state/simulationStore.js';
import { T } from './i18n/strings.js';

const TABS = [
  { id: 'live', label: T.tabLive },
  { id: 'charts', label: T.tabCharts },
  { id: 'compare', label: T.tabCompare },
  { id: 'theory', label: T.tabTheory },
];

function Header() {
  const activeTab = useSimulation((s) => s.activeTab);
  const setActiveTab = useSimulation((s) => s.setActiveTab);

  return (
    <header className="header">
      <div className="header__mark">
        <RotorMark className="header__rotor" />
        <div className="header__titles">
          <span className="header__title">{T.appTitle}</span>
          <span className="header__subtitle">{T.appSubtitle}</span>
        </div>
      </div>

      <nav className="header__tabs" role="tablist" aria-label={T.appTitle}>
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            className="tab"
            aria-selected={activeTab === tab.id}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      <span className="header__badge">{T.labBadge}</span>
    </header>
  );
}

/** Right-rail contents for the active tab. */
function RailContents() {
  const activeTab = useSimulation((s) => s.activeTab);

  switch (activeTab) {
    case 'charts':
      return <ChartPanel />;
    case 'compare':
      return <TurbineComparison />;
    case 'theory':
      return <TheoryPanel />;
    default:
      return (
        <>
          <EnergyDashboard />
          <TechnicalParameters />
        </>
      );
  }
}

export default function App() {
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);
  // The comparison table is four columns wide and will not fit the rail's
  // normal width; the 3D scene has room to spare, so the rail takes it.
  const activeTab = useSimulation((s) => s.activeTab);
  const wide = activeTab === 'compare';

  return (
    <div className="app">
      <Header />

      <main className="stage" data-sheet-open={!rightCollapsed}>
        <div className="stage__canvas">
          <WindTurbineScene />
        </div>

        <aside className="rail rail--left" data-collapsed={leftCollapsed}>
          <div className="rail__scroll">
            <TurbineSelector />
            <WindControls />
          </div>
        </aside>

        <button
          type="button"
          className="rail-handle rail-handle--left"
          style={{ left: leftCollapsed ? 0 : 'calc(var(--rail-left) + 14px)' }}
          aria-label={leftCollapsed ? T.expand : T.collapse}
          aria-expanded={!leftCollapsed}
          onClick={() => setLeftCollapsed((v) => !v)}
        >
          {leftCollapsed ? <ChevronRightIcon /> : <ChevronLeftIcon />}
        </button>

        <aside className="rail rail--right" data-collapsed={rightCollapsed} data-wide={wide}>
          <div className="rail__scroll">
            <RailContents />
          </div>
        </aside>

        <button
          type="button"
          className="rail-handle rail-handle--right"
          style={{ right: rightCollapsed ? 0 : `calc(${wide ? 'var(--rail-right-wide)' : 'var(--rail-right)'} + 14px)` }}
          aria-label={rightCollapsed ? T.expand : T.collapse}
          aria-expanded={!rightCollapsed}
          onClick={() => setRightCollapsed((v) => !v)}
        >
          {rightCollapsed ? <ChevronLeftIcon /> : <ChevronRightIcon />}
        </button>

        <p className="stage__hint">{T.cameraHint}</p>
      </main>
    </div>
  );
}
