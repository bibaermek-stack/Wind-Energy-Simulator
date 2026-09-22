/**
 * Application shell.
 *
 * The 3D scene fills the stage and the two instrument rails float over it,
 * both collapsible, so the scene is never more than one click from being
 * the whole screen.
 *
 * The mode switch is the primary control and sits at the head of the
 * header, left of everything else. What changes with it is the *contents*
 * of the rails and the scene, never their arrangement -- so the wind
 * simulation is exactly where it was, and switching modes feels like
 * turning to a different instrument on the same bench rather than opening a
 * different application.
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
import SolarControls from './components/ui/SolarControls.jsx';
import SolarDashboard from './components/ui/SolarDashboard.jsx';
import SolarChartPanel from './components/ui/SolarChart.jsx';
import TrackingComparison from './components/ui/TrackingComparison.jsx';
import SolarTheory from './components/ui/SolarTheory.jsx';
import EnergyFlow from './components/ui/EnergyFlow.jsx';
import { RotorMark, ChevronLeftIcon, ChevronRightIcon } from './components/ui/primitives.jsx';
import { useSimulation } from './state/simulationStore.js';
import { MODES, MODE_ORDER, MODE_TABS, modeOf } from './modes/energyModes.js';
import { T } from './i18n/strings.js';

const TAB_LABELS = {
  live: T.tabLive,
  charts: T.tabCharts,
  compare: T.tabCompare,
  flow: T.tabFlow,
  theory: T.tabTheory,
};

/** The primary WIND | SOLAR | HYBRID control. */
function ModeSwitch() {
  const mode = useSimulation((s) => s.mode);
  const setMode = useSimulation((s) => s.setMode);

  return (
    <div className="mode-switch" role="group" aria-label={T.appTitle}>
      {MODE_ORDER.map((id) => (
        <button
          key={id}
          type="button"
          className="mode-switch__option"
          style={{ '--mode-accent': MODES[id].accent }}
          aria-pressed={mode === id}
          onClick={() => setMode(id)}
        >
          <span className="mode-switch__label">{MODES[id].label.kk}</span>
          <span className="mode-switch__sub">{MODES[id].sublabel.kk}</span>
        </button>
      ))}
    </div>
  );
}

function Header() {
  const mode = useSimulation((s) => s.mode);
  const activeTab = useSimulation((s) => s.activeTab);
  const setActiveTab = useSimulation((s) => s.setActiveTab);
  const tabs = MODE_TABS[mode] ?? MODE_TABS.wind;

  return (
    <header className="header">
      <div className="header__mark">
        <RotorMark className="header__rotor" />
        <div className="header__titles">
          <span className="header__title">{T.appTitle}</span>
          <span className="header__subtitle">{T.appSubtitle}</span>
        </div>
      </div>

      <ModeSwitch />

      <nav className="header__tabs" role="tablist" aria-label={T.appTitle}>
        {tabs.map((tab) => (
          <button
            key={tab}
            type="button"
            role="tab"
            className="tab"
            aria-selected={activeTab === tab}
            onClick={() => setActiveTab(tab)}
          >
            {TAB_LABELS[tab]}
          </button>
        ))}
      </nav>

      <span className="header__badge">{T.labBadge}</span>
    </header>
  );
}

/** Left-rail contents: the controls for whatever the mode generates with. */
function Controls() {
  const mode = modeOf(useSimulation((s) => s.mode));

  return (
    <>
      {mode.hasWind && (
        <>
          <TurbineSelector />
          <WindControls />
        </>
      )}
      {mode.hasSolar && <SolarControls />}
    </>
  );
}

/** Right-rail contents for the active tab in the active mode. */
function RailContents() {
  const modeId = useSimulation((s) => s.mode);
  const activeTab = useSimulation((s) => s.activeTab);
  const mode = modeOf(modeId);

  if (activeTab === 'flow') return <EnergyFlow />;

  if (activeTab === 'theory') {
    return (
      <>
        {mode.hasSolar && <SolarTheory />}
        {mode.hasWind && <TheoryPanel />}
      </>
    );
  }

  if (modeId === 'solar') {
    if (activeTab === 'charts') return <SolarChartPanel />;
    if (activeTab === 'compare') return <TrackingComparison />;
    return <SolarDashboard />;
  }

  if (modeId === 'hybrid') {
    return (
      <>
        <EnergyFlow />
        <SolarDashboard />
        <EnergyDashboard />
      </>
    );
  }

  // wind
  if (activeTab === 'charts') return <ChartPanel />;
  if (activeTab === 'compare') return <TurbineComparison />;
  return (
    <>
      <EnergyDashboard />
      <TechnicalParameters />
    </>
  );
}

export default function App() {
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);
  const activeTab = useSimulation((s) => s.activeTab);
  const mode = useSimulation((s) => s.mode);

  // The comparison table (three turbines, or two solar panels) will not
  // fit the rail's normal width; the 3D scene has room to spare.
  const wide = activeTab === 'compare';

  return (
    <div className="app" data-mode={mode}>
      <Header />

      <main className="stage" data-sheet-open={!rightCollapsed}>
        <div className="stage__canvas">
          <WindTurbineScene />
        </div>

        <aside className="rail rail--left" data-collapsed={leftCollapsed}>
          <div className="rail__scroll">
            <Controls />
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
