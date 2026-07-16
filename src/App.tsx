import './App.css';
import { SandboxCanvas } from './sandbox/SandboxCanvas';
import { ControlPanel } from './sandbox/ControlPanel';
import { ValidationPanel } from './sandbox/ValidationPanel';
import { useAssemblyStore } from './store/assemblyStore';

function App() {
  const assemblyName = useAssemblyStore((s) => s.assembly.name);

  return (
    <div className="app-shell">
      <header className="app-header">
        <h1>Automaton Designer</h1>
        <span className="assembly-name">{assemblyName}</span>
      </header>
      <main className="app-main">
        <div className="canvas-wrap">
          <SandboxCanvas />
        </div>
        <aside className="sidebar">
          <ControlPanel />
          <ValidationPanel />
        </aside>
      </main>
    </div>
  );
}

export default App;
