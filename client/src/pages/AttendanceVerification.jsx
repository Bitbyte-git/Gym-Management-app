import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Fingerprint,
  CheckCircle2,
  AlertCircle,
  Pause,
  Play,
  RefreshCw,
  Maximize2,
  Minimize2,
  ArrowLeft,
  Flame,
  ArrowDownRight,
  ArrowUpRight,
  Clock,
  Sparkles,
  ShieldCheck,
  LogOut,
} from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { createMorFinAuth } from '../services/morfinAuth.mjs';
import { createAttendanceScanner } from '../services/attendanceScanner.mjs';
import AttendancePopup from '../components/AttendancePopup';
import { Brand } from '../components/Brand';
import '../attendance-kiosk.css';

const initial = { phase: 'initializing', message: 'Connecting to biometric scanner…' };

export default function AttendanceVerification({ standalone = true }) {
  const nav = useNavigate();
  const { logout, user } = useAuth();
  const [state, setState] = useState(initial);
  const [popup, setPopup] = useState(null);
  const [lastPunch, setLastPunch] = useState(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [pausedState, setPausedState] = useState(false);
  const [clientKey] = useState('');

  const controller = useRef(null);
  const paused = useRef(false);
  const timerRef = useRef(null);
  const containerRef = useRef(null);

  // Keep live clock updated
  useEffect(() => {
    const clockInterval = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(clockInterval);
  }, []);

  const handleClosePopup = useCallback(() => {
    setPopup(null);
  }, []);

  const triggerPopup = (data) => {
    setPopup({ ...data, id: Date.now() });
    if (data.type === 'success' && data.member) {
      setLastPunch({
        name: data.member.fullName || 'Member',
        memberId: data.member.memberId || '',
        profilePicture: data.member.profilePicture || null,
        avatarInitials: data.member.avatarInitials,
        action: data.action || 'Check in',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        session: data.sessionName || getSessionName(),
      });
    }
  };

  const getSessionName = () => {
    const hour = currentTime.getHours();
    if (hour < 12) return 'Morning Session';
    if (hour < 16) return 'Afternoon Session';
    return 'Evening Session';
  };

  const getSessionTiming = () => {
    const hour = currentTime.getHours();
    if (hour < 12) return '5:00 AM – 11:59 AM';
    if (hour < 16) return '12:00 PM – 3:59 PM';
    return '4:00 PM – 10:00 PM';
  };

  useEffect(() => {
    let live = true;
    let exiting = false;

    const unpack = (request) => request.then((r) => r.data.data);
    const transport = {
      capabilities: (signal) => unpack(api.get('/attendance/biometric/capabilities', { signal })),
      candidates: (signal) => unpack(api.get('/attendance/biometric/candidates', { signal })),
      open: (signal) => unpack(api.post('/attendance/biometric/stations', {}, { signal })),
      close: (stationToken) => unpack(api.post('/attendance/biometric/stations/close', { stationToken })),
      challenge: (stationToken, signal) => unpack(api.post('/attendance/biometric/challenges', { stationToken }, { signal })),
      identify: (stationToken, verificationToken, captureOrMatch, signal) => {
        if (captureOrMatch?.matchedMemberId) {
          return unpack(api.post('/attendance/biometric/identify', {
            stationToken,
            verificationToken,
            matchedMemberId: captureOrMatch.matchedMemberId,
            matchedEnrollmentReference: captureOrMatch.matchedEnrollmentReference,
            diagnostics: captureOrMatch.diagnostics,
          }, { signal }));
        }
        return unpack(api.post('/attendance/biometric/identify', {
          stationToken,
          verificationToken,
          probeTemplate: captureOrMatch?.templateBase64,
          templateFormat: captureOrMatch?.templateFormat,
        }, { signal }));
      },
      record: (event, signal) => unpack(api.post('/attendance/biometric/record', event, { signal })),
      rearm: (stationToken) => unpack(api.post('/attendance/biometric/stations/rearm', { stationToken })),
    };

    const scanner = createMorFinAuth({
      baseUrl: import.meta.env.VITE_MANTRA_SERVICE_URL || 'https://localhost:8030/morfinauth',
    });
    const sessionRunner = scanner.runSession;
    scanner.runSession = (options, task) => sessionRunner({ ...options, clientKey }, task);

    const flow = createAttendanceScanner({
      scanner,
      transport,
      onState: (next) => {
        if (!live || exiting) return;
        setState(next);

        if (next.result?.recorded) {
          triggerPopup({
            type: 'success',
            title: 'Thank you! Attendance marked',
            subtitle: next.result.reconfirmed
              ? (next.result.message || 'Check-in confirmed. You are already checked in.')
              : next.result.action === 'checkout'
                ? (next.result.message || `Check-out recorded (${next.result.sessionDurationFormatted || 'session workout'}).`)
                : 'Check-in recorded successfully. Welcome to Vino Fitness Studio!',
            member: next.result.member,
            action: next.result.action === 'checkout' ? 'Check out' : 'Check in',
            sessionName: next.result.sessionName,
            duration: next.result.action === 'checkout' ? next.result.sessionDurationFormatted : null,
            dailySpending: next.result.dailySpending,
          });
        } else if (
          next.code === 'UNKNOWN_FINGERPRINT' ||
          next.code === 'POOR_CAPTURE' ||
          next.code === 'AMBIGUOUS_FINGERPRINT' ||
          (next.phase === 'result' && !next.result?.recorded)
        ) {
          triggerPopup({
            type: 'error',
            title: 'Try again, not Matched',
            subtitle: next.message || 'Fingerprint not recognized. Please scan your finger again.',
          });
        }
      },
    });

    controller.current = flow;

    const stop = async (reason) => {
      await flow.stop(reason);
    };

    const visibility = () => {
      if (document.hidden) {
        void stop('Paused while tab is hidden.');
      } else if (!paused.current && !exiting) {
        void (async () => {
          if (live && !document.hidden && !paused.current && !exiting) {
            await flow.start();
          }
        })();
      }
    };

    const logout = () => {
      exiting = true;
      paused.current = true;
      void stop('Exiting attendance verification.');
    };

    document.addEventListener('visibilitychange', visibility);
    window.addEventListener('pulsefit:auth-stopping', logout);

    if (!document.hidden) {
      void flow.start();
    }

    return () => {
      live = false;
      exiting = true;
      document.removeEventListener('visibilitychange', visibility);
      window.removeEventListener('pulsefit:auth-stopping', logout);
      void flow.stop('Attendance verification closed.');
      controller.current = null;
    };
  }, [clientKey]);

  const togglePause = async () => {
    if (paused.current) {
      paused.current = false;
      setPausedState(false);
      setState(initial);
      await controller.current?.start({ recover: false });
    } else {
      paused.current = true;
      setPausedState(true);
      await controller.current?.stop('Paused by user');
      setState({ phase: 'paused', message: 'Attendance scanner paused.' });
    }
  };

  const handleRetry = async () => {
    paused.current = false;
    setPausedState(false);
    setState(initial);
    await controller.current?.start({ recover: true });
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen?.().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen?.().catch(() => {});
      setIsFullscreen(false);
    }
  };

  const isCapturing = state.phase === 'capturing';
  const isIdentifying = state.phase === 'identifying' || state.phase === 'recording';
  const isReady = isCapturing || state.phase === 'initializing' || state.phase === 'rearming';
  const showVerifiedAvatar = Boolean(lastPunch && !isCapturing && !isIdentifying && !pausedState);

  return (
    <div
      ref={containerRef}
      className={`attendance-verification-module ${standalone ? 'standalone-mode' : ''} ${isFullscreen ? 'fullscreen-mode' : ''}`}
    >
      <AttendancePopup popup={popup} onClose={handleClosePopup} />

      {/* Top Header / Bar */}
      <header className="verification-header">
        <div className="verification-brand-group">
          {standalone && (
            <button
              className="verification-back-btn"
              onClick={() => nav(-1)}
              title="Return to Dashboard"
              aria-label="Back"
            >
              <ArrowLeft size={18} />
            </button>
          )}
          <div className="verification-logo-wrap">
            <img src="/Gym-Logo-128.png" alt="Vino Fitness Studio" className="verification-logo-img" />
            <div>
              <h1 className="verification-studio-name">VINO FITNESS STUDIO</h1>
              <span className="verification-studio-sub">UNISEX FITNESS STUDIO • BIOMETRIC ATTENDANCE</span>
            </div>
          </div>
        </div>

        <div className="verification-header-meta">
          <div className="verification-session-chip">
            <Clock size={14} color="var(--color-primary)" />
            <div>
              <b>{getSessionName()}</b>
              <small>{getSessionTiming()}</small>
            </div>
          </div>

          <div className="verification-time-chip">
            <span className="live-clock-time">
              {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
            <small className="live-clock-date">
              {currentTime.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' })}
            </small>
          </div>

          <div className="verification-controls">
            <button
              className={`verification-tool-btn ${pausedState ? 'paused' : ''}`}
              onClick={togglePause}
              title={pausedState ? 'Resume Scanner' : 'Pause Scanner'}
            >
              {pausedState ? <Play size={16} /> : <Pause size={16} />}
              <span>{pausedState ? 'Resume' : 'Pause'}</span>
            </button>
            <button
              className="verification-tool-btn"
              onClick={handleRetry}
              title="Retry / Reconnect Scanner"
            >
              <RefreshCw size={15} />
            </button>
            <button
              className="verification-tool-btn"
              onClick={toggleFullscreen}
              title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen Kiosk'}
            >
              {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            </button>
            <button
              className="verification-tool-btn"
              onClick={async () => {
                await logout();
                nav('/login');
              }}
              title="Sign out of Attendance Terminal"
            >
              <LogOut size={15} />
              <span>Sign out</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Minimal Visual Verification Center */}
      <main className="verification-body">
        <div className="verification-scanner-stage">
          {/* Circular Interactive Scanner Target */}
          <div
            className={`scanner-target-ring ${
              showVerifiedAvatar
                ? 'verified-avatar-active'
                : isCapturing
                ? 'active-capturing'
                : isIdentifying
                ? 'identifying'
                : pausedState
                ? 'paused'
                : 'waiting'
            }`}
          >
            <div className="scanner-halo-ring outer-halo" />
            <div className="scanner-halo-ring inner-halo" />

            <div className={`scanner-core-circle ${showVerifiedAvatar ? 'has-avatar' : ''}`}>
              {showVerifiedAvatar ? (
                <div className="scanner-avatar-display">
                  {lastPunch.profilePicture ? (
                    <img
                      src={lastPunch.profilePicture}
                      alt={lastPunch.name}
                      className="scanner-center-avatar-img"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                        const fallback = e.currentTarget.parentElement?.querySelector('.scanner-center-avatar-initials');
                        if (fallback) fallback.style.display = 'flex';
                      }}
                    />
                  ) : null}
                  <div
                    className="scanner-center-avatar-initials"
                    style={{ display: lastPunch.profilePicture ? 'none' : 'flex' }}
                  >
                    <span>{lastPunch.avatarInitials || lastPunch.name?.slice(0, 2).toUpperCase() || 'VF'}</span>
                  </div>
                  <div className="scanner-verified-check-pill" title="Verified Identity">
                    <CheckCircle2 size={20} color="#0b130a" strokeWidth={2.8} />
                  </div>
                </div>
              ) : (
                <>
                  <Fingerprint
                    className={`scanner-finger-icon ${isCapturing ? 'finger-scanning' : ''}`}
                    size={82}
                    strokeWidth={1.8}
                  />
                  {isCapturing && <div className="scanner-laser-bar" />}
                </>
              )}
            </div>
          </div>

          {/* Primary Directive Text */}
          <div className="verification-prompt-box">
            <span className="verification-badge-tag">
              <span className={`status-pulse-dot ${pausedState ? 'dot-paused' : 'dot-active'}`} />
              {pausedState
                ? 'SCANNER PAUSED'
                : state.device
                ? `${state.device.model || 'MFS500'} READY`
                : 'CHECKING BIOMETRIC SENSOR'}
            </span>

            <h2 className="verification-main-heading">
              {pausedState
                ? 'Scanner is paused'
                : isCapturing
                ? 'Please place your fingerprint'
                : isIdentifying
                ? 'Verifying your identity…'
                : state.phase === 'initializing'
                ? 'Initializing scanner…'
                : lastPunch
                ? `Welcome, ${lastPunch.name}!`
                : 'Please place your fingerprint'}
            </h2>

            <p className="verification-sub-instruction">
              {pausedState
                ? 'Click "Resume" to enable automatic member attendance.'
                : isCapturing
                ? 'Touch and hold your registered finger firmly on the sensor.'
                : isIdentifying
                ? 'Matching record with studio database. Please keep steady.'
                : lastPunch
                ? `${lastPunch.action.toUpperCase()} VERIFIED (${lastPunch.session}) • Ready for next scan`
                : state.message || 'Place your enrolled finger on the sensor to mark attendance.'}
            </p>
          </div>

          {/* Subtle Live Last Punch Notification Card */}
          {lastPunch && (
            <div className="verification-recent-indicator" role="status" aria-live="polite">
              {lastPunch.profilePicture ? (
                <img
                  src={lastPunch.profilePicture}
                  alt={lastPunch.name}
                  className="recent-punch-avatar-img"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                    if (e.currentTarget.nextElementSibling) e.currentTarget.nextElementSibling.style.display = 'grid';
                  }}
                />
              ) : null}
              <div
                className="recent-punch-avatar"
                style={{ display: lastPunch.profilePicture ? 'none' : 'grid' }}
              >
                {lastPunch.avatarInitials || lastPunch.name.slice(0, 2).toUpperCase()}
              </div>
              <div className="recent-punch-details">
                <div className="recent-punch-line1">
                  <b>{lastPunch.name}</b>
                  <span className={`kiosk-punch-pill ${lastPunch.action.toLowerCase().includes('in') ? 'checkin' : 'checkout'}`}>
                    {lastPunch.action.toLowerCase().includes('in') ? <ArrowDownRight size={12} /> : <ArrowUpRight size={12} />}
                    {lastPunch.action.toUpperCase()}
                  </span>
                </div>
                <div className="recent-punch-line2">
                  <span>{lastPunch.time}</span>
                  <span>•</span>
                  <span>{lastPunch.session}</span>
                </div>
              </div>
              <div className="recent-punch-status">
                <CheckCircle2 size={16} color="var(--color-primary)" />
                <span>Verified</span>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Footer Minimal Status Indicator */}
      <footer className="verification-footer">
        <div className="footer-left-status">
          <ShieldCheck size={14} color="var(--color-primary)" />
          <span>Biometric Protection Active</span>
          <span className="footer-sep">•</span>
          <span>Single check-in per session • Automatic check-out calculation</span>
        </div>
        <div className="footer-right-studio">
          <span>Vino Fitness Studio</span>
        </div>
      </footer>
    </div>
  );
}
