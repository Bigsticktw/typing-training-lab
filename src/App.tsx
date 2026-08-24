import { lazy, Suspense, useEffect, useState } from 'react';
import { GameCanvas } from './components/core/GameCanvas';
import { ResultScreen } from './components/overlays/ResultScreen';
import { SettingsPanel } from './components/overlays/SettingsPanel';
import { MultiplayerLobby } from './components/multiplayer/MultiplayerLobby';
import { RoomView } from './components/multiplayer/RoomView';
import { MultiplayerGameCanvas } from './components/multiplayer/MultiplayerGameCanvas';
import { MultiplayerResultScreen } from './components/multiplayer/MultiplayerResultScreen';
import { useGameStore } from './store/useGameStore';
import { useSettingsStore } from './store/useSettingsStore';
import { useMultiplayerStore } from './store/useMultiplayerStore';
import { LayoutDashboard, Keyboard, Users } from 'lucide-react';
import clsx from 'clsx';
import { SoundManager } from './components/core/SoundManager';
import { syncPendingSheetsSessions } from './services/GoogleSheetsSync';

const Dashboard = lazy(() =>
  import('./components/stats/Dashboard').then((module) => ({ default: module.Dashboard })),
);

function App() {
  const { status } = useGameStore();
  const { theme } = useSettingsStore();
  const { status: multiplayerStatus } = useMultiplayerStore();
  const [activeTab, setActiveTab] = useState<'game' | 'multiplayer' | 'stats'>('game');
  const visibleTab =
    status === 'playing'
      ? 'game'
      : multiplayerStatus === 'playing'
        ? 'multiplayer'
        : activeTab;

  // Set theme attribute on body
  useEffect(() => {
    document.body.setAttribute('data-theme', theme);
  }, [theme]);

  // Retry locally queued sessions when the app opens or the browser reconnects.
  useEffect(() => {
    void syncPendingSheetsSessions();
    const handleOnline = () => void syncPendingSheetsSessions();
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, []);

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)] transition-colors duration-300 font-inter selection:bg-[var(--accent)] selection:text-[var(--bg-primary)] flex flex-col">
      <SoundManager />

      {/* 導覽列 */}
      <nav className="flex justify-center p-4 gap-4 z-50">
        <div className="flex bg-[var(--keyboard-bg)] rounded-xl p-1.5 shadow-xl border border-[var(--text-secondary)]/10">
          <button
            onClick={() => setActiveTab('game')}
            className={clsx(
              "flex items-center gap-2 px-6 py-2 rounded-lg font-bold transition-all",
              visibleTab === 'game'
                ? "bg-[var(--accent)] text-[var(--bg-primary)] shadow-[0_0_15px_var(--accent)]"
                : "opacity-50 hover:opacity-100"
            )}
          >
            <Keyboard size={18} />
            訓練模式
          </button>
          <button
            data-testid="nav-multiplayer"
            onClick={() => setActiveTab('multiplayer')}
            className={clsx(
              "flex items-center gap-2 px-6 py-2 rounded-lg font-bold transition-all",
              visibleTab === 'multiplayer'
                ? "bg-[var(--accent)] text-[var(--bg-primary)] shadow-[0_0_15px_var(--accent)]"
                : "opacity-50 hover:opacity-100"
            )}
          >
            <Users size={18} />
            多人對戰
          </button>
          <button
            onClick={() => setActiveTab('stats')}
            className={clsx(
              "flex items-center gap-2 px-6 py-2 rounded-lg font-bold transition-all",
              visibleTab === 'stats'
                ? "bg-[var(--accent)] text-[var(--bg-primary)] shadow-[0_0_15px_var(--accent)]"
                : "opacity-50 hover:opacity-100"
            )}
          >
            <LayoutDashboard size={18} />
            數據統計
          </button>
        </div>
      </nav>

      <main className="flex-1 flex flex-col container mx-auto px-4 relative">
        {visibleTab === 'game' ? (
          <>
            {status !== 'finished' ? (
              <>
                <GameCanvas />
                <SettingsPanel />
              </>
            ) : (
              <ResultScreen />
            )}
          </>
        ) : visibleTab === 'multiplayer' ? (
          <>
            {multiplayerStatus === 'lobby' && <MultiplayerLobby />}
            {multiplayerStatus === 'in-room' && <RoomView />}
            {multiplayerStatus === 'playing' && <MultiplayerGameCanvas />}
            {multiplayerStatus === 'finished' && <MultiplayerResultScreen />}
          </>
        ) : (
          <Suspense fallback={<div className="py-20 text-center opacity-60">載入統計資料…</div>}>
            <Dashboard />
          </Suspense>
        )}
      </main>

      {/* Footer */}
      <footer className="p-6 text-center text-xs opacity-20 font-mono tracking-widest uppercase">
        Typing Training Lab • Built for deliberate practice
      </footer>
    </div>
  );
}

export default App;
