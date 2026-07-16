import { useAssemblyStore } from '../store/assemblyStore';
import { RAD2DEG, DEG2RAD } from '../types/geometry';

export function ControlPanel() {
  const theta = useAssemblyStore((s) => s.assembly.driver.theta);
  const omega = useAssemblyStore((s) => s.assembly.driver.omega);
  const isPlaying = useAssemblyStore((s) => s.assembly.driver.isPlaying);
  const setTheta = useAssemblyStore((s) => s.setTheta);
  const setOmega = useAssemblyStore((s) => s.setOmega);
  const togglePlaying = useAssemblyStore((s) => s.togglePlaying);
  const resetAssembly = useAssemblyStore((s) => s.resetAssembly);

  const thetaDeg = theta * RAD2DEG;

  return (
    <div className="control-panel">
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
