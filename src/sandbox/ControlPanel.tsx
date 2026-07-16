import { useAssemblyStore } from '../store/assemblyStore';
import { RAD2DEG, DEG2RAD } from '../types/geometry';

export function ControlPanel() {
  const theta = useAssemblyStore((s) => s.assembly.driver.theta);
  const omega = useAssemblyStore((s) => s.assembly.driver.omega);
  const isPlaying = useAssemblyStore((s) => s.assembly.driver.isPlaying);
  const viewMode = useAssemblyStore((s) => s.viewMode);
  const setTheta = useAssemblyStore((s) => s.setTheta);
  const setOmega = useAssemblyStore((s) => s.setOmega);
  const togglePlaying = useAssemblyStore((s) => s.togglePlaying);
  const resetAssembly = useAssemblyStore((s) => s.resetAssembly);
  const setViewMode = useAssemblyStore((s) => s.setViewMode);

  const thetaDeg = theta * RAD2DEG;

  return (
    <div className="control-panel">
      <h2>View</h2>
      <div className="control-row view-toggle">
        <button className={viewMode === 'toy' ? 'active' : ''} onClick={() => setViewMode('toy')}>
          Finished Toy
        </button>
        <button className={viewMode === 'mechanism' ? 'active' : ''} onClick={() => setViewMode('mechanism')}>
          Mechanism
        </button>
      </div>
      <p className="hint">
        "Finished Toy" mounts the mechanism in an open wooden box - the way a real crank automaton is built, gears and cams
        proudly visible through the frame. "Mechanism" strips the box for a bare validation view.
      </p>

      <h2>Driver Input</h2>
      <div className="control-row">
        <button onClick={() => togglePlaying()}>{isPlaying ? 'Pause' : 'Play'}</button>
        <button onClick={resetAssembly}>Reset</button>
      </div>
      <label className="control-row">
        <span>Crank angle theta: {thetaDeg.toFixed(1)} deg</span>
        <input
          type="range"
          min={0}
          max={360}
          step={0.5}
          value={thetaDeg}
          onChange={(e) => setTheta(Number(e.target.value) * DEG2RAD)}
        />
      </label>
      <label className="control-row">
        <span>Speed (omega): {omega.toFixed(2)} rad/s</span>
        <input type="range" min={0} max={4} step={0.05} value={omega} onChange={(e) => setOmega(Number(e.target.value))} />
      </label>
      <p className="hint">Sweeps 0-360 deg continuously while playing; drag the slider to scrub a specific pose.</p>
    </div>
  );
}
